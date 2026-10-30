# pyrefly: ignore[missing-import]
from flask import request
# pyrefly: ignore[missing-import]
from flask_jwt_extended import jwt_required
# pyrefly: ignore[missing-import]
from flask_restx import Namespace, Resource, fields

from app.auth_utils import admin_required
from app.routes.campos import TextoOpcional
from app.services.catalogo_exame_service import CatalogoExameService

ns = Namespace("catalogo-exames", description="Catálogo de exames e valores (alteração somente por administradores)")

modelo_catalogo_entrada = ns.model(
    "CatalogoExameEntrada",
    {
        "nome": fields.String(required=True, example="Hemograma completo"),
        "valor": fields.Float(required=True, example=13.0, description="Valor cobrado, em reais"),
    },
)

modelo_catalogo_edicao = ns.model(
    "CatalogoExameEdicao",
    {
        "nome": TextoOpcional(required=False, example="Hemograma completo"),
        "valor": fields.Float(required=False, example=15.0),
        "ativo": fields.Boolean(required=False, example=True, description="False remove da lista de escolha"),
    },
)

modelo_importacao = ns.model(
    "CatalogoExameImportacao",
    {
        "itens": fields.List(
            fields.Raw,
            required=True,
            description="Lista de {nome, valor, linha?}. Nome existente tem o valor atualizado.",
        ),
    },
)


@ns.route("")
class CatalogoLista(Resource):
    @jwt_required()
    @ns.doc(
        description="Lista o catálogo. Qualquer usuário logado pode consultar (o cadastro de exames usa esta lista).",
        security="Bearer",
        params={"ativos": "true = só os exames disponíveis para escolha"},
    )
    def get(self):
        """Listar exames do catálogo"""
        apenas_ativos = request.args.get("ativos", "").lower() in ("1", "true", "sim")
        return {"itens": [e.to_dict() for e in CatalogoExameService.listar(apenas_ativos)]}, 200

    @admin_required
    @ns.expect(modelo_catalogo_entrada, validate=True)
    @ns.doc(description="Adiciona um exame ao catálogo (somente administrador).", security="Bearer")
    def post(self):
        """Adicionar exame ao catálogo"""
        try:
            exame = CatalogoExameService.cadastrar(ns.payload)
        except ValueError as e:
            ns.abort(400, str(e))
        return {"mensagem": "Exame adicionado ao catálogo.", "exame": exame.to_dict()}, 201


@ns.route("/<int:id>")
@ns.param("id", "ID do exame no catálogo")
class CatalogoDetalhe(Resource):
    @admin_required
    @ns.expect(modelo_catalogo_edicao, validate=False)
    @ns.doc(
        description=(
            "Altera nome, valor ou situação. `ativo: false` remove o exame da lista de escolha "
            "sem apagar o histórico. Exames já registrados NÃO mudam de valor."
        ),
        security="Bearer",
    )
    def put(self, id):
        """Atualizar exame do catálogo"""
        try:
            exame = CatalogoExameService.atualizar(id, ns.payload or {})
        except LookupError as e:
            ns.abort(404, str(e))
        except ValueError as e:
            ns.abort(400, str(e))
        return {"mensagem": "Exame atualizado.", "exame": exame.to_dict()}, 200


@ns.route("/importar")
class CatalogoImportar(Resource):
    @admin_required
    @ns.expect(modelo_importacao, validate=True)
    @ns.doc(
        description="Importa vários exames de uma vez (a tela lê o CSV e envia a lista). Somente administrador.",
        security="Bearer",
    )
    def post(self):
        """Importar exames em lote"""
        try:
            resultado = CatalogoExameService.importar(ns.payload["itens"])
        except ValueError as e:
            ns.abort(400, str(e))
        return resultado, 200
