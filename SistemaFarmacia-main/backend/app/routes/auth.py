# pyrefly: ignore[missing-import]
from flask_restx import Namespace, Resource, fields
# pyrefly: ignore[missing-import]
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.auth_utils import admin_required
from app.extensions import db
from app.models.usuario import Usuario
from app.services.auth_service import AuthService, EmailJaCadastrado

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
            example="funcionario",
            description="Perfil do usuário: 'admin' (acesso total) ou 'funcionario' (só os módulos liberados)",
            enum=["admin", "funcionario"],
            default="funcionario",
        ),
        "modulos": fields.List(
            fields.String,
            required=False,
            example=["clientes", "receitas"],
            description="Módulos do funcionário (dashboard, clientes, manipulacoes, exames, receitas). Ignorado para admin.",
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
    @admin_required
    @ns.expect(modelo_cadastro, validate=True)
    @ns.doc(
        description=(
            "Cria um novo usuário. Requer token de um **administrador**. "
            "O primeiro administrador é criado pelo comando de terminal `flask --app run criar-admin`."
        ),
        security="Bearer",
    )
    def post(self):
        """Cadastrar novo usuário (somente admin)"""
        dados = ns.payload
        try:
            usuario = AuthService.cadastrar(
                dados.get("nome"),
                dados.get("email"),
                dados.get("senha"),
                dados.get("perfil", "funcionario"),
                dados.get("modulos"),
            )
        except EmailJaCadastrado as e:
            ns.abort(409, str(e))  # 409 Conflict = e-mail duplicado
        except ValueError as e:
            ns.abort(400, str(e))

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
        usuario = db.session.get(Usuario, int(get_jwt_identity()))

        if not usuario:
            ns.abort(404, "Usuário não encontrado.")

        return usuario.to_dict(), 200
