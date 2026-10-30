# pyrefly: ignore[missing-import]
from flask_jwt_extended import get_jwt_identity
# pyrefly: ignore[missing-import]
from flask_restx import Namespace, Resource, fields

from app.auth_utils import admin_required
from app.routes.campos import TextoOpcional
from app.services.usuario_service import UsuarioService

ns = Namespace("usuarios", description="Gestão de usuários (somente administradores)")

modelo_usuario_edicao = ns.model(
    "UsuarioEdicao",
    {
        "nome": TextoOpcional(required=False, example="Ana Silva"),
        "perfil": fields.String(required=False, enum=["admin", "funcionario"], example="funcionario"),
        "modulos": fields.List(
            fields.String,
            required=False,
            example=["clientes", "receitas"],
            description="Módulos liberados (dashboard, clientes, manipulacoes, exames, receitas). O admin acessa todos.",
        ),
        "ativo": fields.Boolean(required=False, example=True, description="False desativa o acesso"),
        "senha": TextoOpcional(required=False, example="nova-senha", description="Redefine a senha (mín. 6 caracteres)"),
    },
)


@ns.route("")
class UsuarioLista(Resource):
    @admin_required
    @ns.doc(description="Lista todos os usuários do sistema.", security="Bearer")
    def get(self):
        """Listar usuários"""
        return {"itens": [u.to_dict() for u in UsuarioService.listar()]}, 200


@ns.route("/<int:id>")
@ns.param("id", "ID do usuário")
class UsuarioDetalhe(Resource):
    @admin_required
    @ns.expect(modelo_usuario_edicao, validate=False)
    @ns.doc(
        description=(
            "Altera nome, perfil, módulos, situação (ativo) ou redefine a senha. "
            "O administrador não pode rebaixar nem desativar o próprio usuário."
        ),
        security="Bearer",
    )
    def put(self, id):
        """Atualizar usuário"""
        try:
            usuario = UsuarioService.atualizar(id, ns.payload or {}, ator_id=int(get_jwt_identity()))
        except LookupError as e:
            ns.abort(404, str(e))
        except ValueError as e:
            ns.abort(400, str(e))
        return {"mensagem": "Usuário atualizado com sucesso.", "usuario": usuario.to_dict()}, 200
