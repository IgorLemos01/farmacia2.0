import secrets

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_restx import Api

from app.config import Config
from app.extensions import db


def create_app(config_extra: dict | None = None) -> Flask:
    """
    Factory function que cria e configura a instância Flask.

    Usar uma factory facilita os testes (cada teste pode criar
    uma app isolada com configurações diferentes via `config_extra`).
    """
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_extra:
        app.config.update(config_extra)

    if not app.config.get("JWT_SECRET_KEY"):
        if not app.config["DEBUG"]:
            raise RuntimeError(
                "JWT_SECRET_KEY não definida. Configure-a no .env antes de rodar em produção."
            )
        # Em desenvolvimento, gera um segredo temporário (os tokens deixam de
        # valer quando o servidor reinicia).
        app.config["JWT_SECRET_KEY"] = secrets.token_hex(32)
        app.logger.warning("JWT_SECRET_KEY não definida; usando segredo temporário de desenvolvimento.")

    # --- Extensões ---
    # A API usa token no cabeçalho Authorization (sem cookies), então não
    # precisa de supports_credentials.
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)
    jwt = JWTManager(app)

    # Token malformado ou com assinatura inválida: responde 401 (o padrão é 422),
    # para que o frontend trate como sessão encerrada e peça login de novo.
    @jwt.invalid_token_loader
    def _token_invalido(motivo):
        return {"msg": "Sessão inválida. Faça login novamente."}, 401

    # Usuário desativado (ou removido) perde o acesso imediatamente, mesmo com um
    # token ainda dentro do prazo de validade.
    @jwt.token_in_blocklist_loader
    def _usuario_sem_acesso(jwt_header, jwt_payload):
        from app.models.usuario import Usuario

        usuario = db.session.get(Usuario, int(jwt_payload["sub"]))
        return usuario is None or not usuario.ativo

    @jwt.revoked_token_loader
    def _token_revogado(jwt_header, jwt_payload):
        return {"msg": "Usuário desativado ou removido. Faça login novamente."}, 401

    # --- API REST com Swagger embutido ---
    api = Api(
        app,
        version="1.0",
        title="Farmácia Couto — API",
        description="API do sistema de gestão da Farmácia Couto.",
        doc="/api/docs",           # Swagger UI disponível em: http://localhost:5000/api/docs
        prefix="/api",
        authorizations={
            "Bearer": {
                "type": "apiKey",
                "in": "header",
                "name": "Authorization",
                "description": 'Cole o token assim: **Bearer &lt;seu_token&gt;**',
            }
        },
    )

    # --- Registro de namespaces (grupos de rotas) ---
    from app.routes.auth import ns as auth_ns
    from app.routes.clientes import ns as clientes_ns
    from app.routes.manipulacoes import ns as manipulacoes_ns
    from app.routes.exames import ns as exames_ns
    from app.routes.receitas import ns as receitas_ns
    from app.routes.usuarios import ns as usuarios_ns
    from app.routes.catalogo_exames import ns as catalogo_ns
    from app.routes.catalogo_medicamentos import ns as catalogo_med_ns

    api.add_namespace(auth_ns)
    api.add_namespace(clientes_ns)
    api.add_namespace(manipulacoes_ns)
    api.add_namespace(exames_ns)
    api.add_namespace(receitas_ns)
    api.add_namespace(usuarios_ns)
    api.add_namespace(catalogo_ns)
    api.add_namespace(catalogo_med_ns)

    # --- Comandos de terminal (criar-admin, redefinir-senha) ---
    from app.cli import registrar as registrar_comandos

    registrar_comandos(app)

    # --- Cria as tabelas no banco se ainda não existirem ---
    with app.app_context():
        from app import models  # noqa: garante que os modelos são importados antes do create_all
        db.create_all()

    return app
