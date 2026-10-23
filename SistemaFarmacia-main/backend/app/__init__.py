from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_restx import Api

from app.config import Config
from app.extensions import db


def create_app() -> Flask:
    """
    Factory function que cria e configura a instância Flask.

    Usar uma factory facilita os testes (cada teste pode criar
    uma app isolada com configurações diferentes).
    """
    app = Flask(__name__)
    app.config.from_object(Config)

    # --- Extensões ---
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    db.init_app(app)
    JWTManager(app)

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

    api.add_namespace(auth_ns)
    api.add_namespace(clientes_ns)
    api.add_namespace(manipulacoes_ns)
    api.add_namespace(exames_ns)
    api.add_namespace(receitas_ns)

    # --- Cria as tabelas no banco se ainda não existirem ---
    with app.app_context():
        from app import models  # noqa: garante que os modelos são importados antes do create_all
        db.create_all()

    return app
