# pyrefly: ignore[missing-import]
from flask_restx import Namespace, Resource, fields
# pyrefly: ignore[missing-import]
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.auth_service import AuthService

# Namespace agrupa as rotas de autenticação e aparece como seção no Swagger
ns = Namespace("auth", description="Cadastro e autenticação de usuários")

# --- Modelos do Swagger (usados para validação e documentação) ---

modelo_cadastro = ns.model(
    "Cadastro",
    {
        "nome": fields.String(required=True, example="Ana Silva", description="Nome completo"),
        "email": fields.String(required=True, example="ana@farmaciacouto.com", description="E-mail de login"),
        "senha": fields.String(required=True, example="senha123", description="Senha (mín. 6 caracteres)"),
        "perfil": fields.String(
            example="atendente",
            description="Perfil do usuário: 'admin' ou 'atendente'",
            enum=["admin", "atendente"],
            default="atendente",
        ),
    },
)

modelo_login = ns.model(
    "Login",
    {
        "email": fields.String(required=True, example="ana@farmaciacouto.com"),
        "senha": fields.String(required=True, example="senha123"),
    },
)


# --- Endpoints ---

@ns.route("/cadastro")
class Cadastro(Resource):
    @ns.expect(modelo_cadastro, validate=True)
    @ns.doc(description="Cria um novo usuário no sistema. Perfis disponíveis: 'admin' ou 'atendente'.")
    def post(self):
        """Cadastrar novo usuário"""
        dados = ns.payload

        nome = dados.get("nome", "").strip()
        email = dados.get("email", "").strip()
        senha = dados.get("senha", "")
        perfil = dados.get("perfil", "atendente")

        # Validações simples antes de passar para o serviço
        if len(nome) < 3:
            ns.abort(400, "Nome deve ter pelo menos 3 caracteres.")
        if len(senha) < 6:
            ns.abort(400, "Senha deve ter pelo menos 6 caracteres.")
        if perfil not in ("admin", "atendente"):
            ns.abort(400, "Perfil inválido. Use 'admin' ou 'atendente'.")

        try:
            usuario = AuthService.cadastrar(nome, email, senha, perfil)
        except ValueError as e:
            ns.abort(409, str(e))  # 409 Conflict = e-mail duplicado

        return {"mensagem": "Usuário cadastrado com sucesso.", "usuario": usuario.to_dict()}, 201


@ns.route("/login")
class Login(Resource):
    @ns.expect(modelo_login, validate=True)
    @ns.doc(description="Autentica um usuário e retorna um token JWT.")
    def post(self):
        """Fazer login"""
        dados = ns.payload
        email = dados.get("email", "")
        senha = dados.get("senha", "")

        try:
            resultado = AuthService.login(email, senha)
        except ValueError as e:
            ns.abort(401, str(e))  # 401 Unauthorized

        return resultado, 200


@ns.route("/me")
class Me(Resource):
    @jwt_required()
    @ns.doc(
        description="Retorna os dados do usuário logado. Requer token JWT no cabeçalho Authorization.",
        security="Bearer",
    )
    def get(self):
        """Ver meu perfil (requer token)"""
        from app.models.usuario import Usuario

        usuario_id = get_jwt_identity()
        usuario = Usuario.query.get(usuario_id)

        if not usuario:
            ns.abort(404, "Usuário não encontrado.")

        return usuario.to_dict(), 200
