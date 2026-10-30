# pyrefly: ignore[missing-import]
from flask import request
# pyrefly: ignore[missing-import]
from flask_jwt_extended import jwt_required
# pyrefly: ignore[missing-import]
from flask_restx import Namespace, Resource, fields

from app.auth_utils import admin_required
from app.routes.campos import TextoOpcional
from app.services.catalogo_medicamento_service import CatalogoMedicamentoService

ns = Namespace(
    "catalogo-medicamentos",
    description="Catálogo de medicamentos: RMS, descrição e laboratório (alteração somente por administradores)",
)

modelo_medicamento_entrada = ns.model(
    "CatalogoMedicamentoEntrada",
    {
        "descricao": fields.String(required=True, example="ALPRAZOLAM 0,25 MG 30 CPRS"),
        "rms": TextoOpcional(required=False, example="1023506630034", description="Registro no Ministério da Saúde"),
        "laboratorio": TextoOpcional(required=False, example="EMS INDUSTRIA FARMACEUTICA LTDA"),
    },
)

modelo_medicamento_edicao = ns.model(
    "CatalogoMedicamentoEdicao",
    {
        "descricao": TextoOpcional(required=False, example="ALPRAZOLAM 0,25 MG 30 CPRS"),
        "rms": TextoOpcional(required=False, example="1023506630034"),
        "laboratorio": TextoOpcional(required=False, example="EMS INDUSTRIA FARMACEUTICA LTDA"),
        "ativo": fields.Boolean(required=False, example=True, description="False remove da lista de escolha"),
    },
)

modelo_importacao = ns.model(
    "CatalogoMedicamentoImportacao",
    {
        "itens": fields.List(
            fields.Raw,
            required=True,
            description="Lista de {rms, descricao, laboratorio, linha?}. RMS + descrição existentes são atualizados.",
        ),
    },
)


@ns.route("")
class MedicamentoLista(Resource):
    @jwt_required()
    @ns.doc(
        description="Lista o catálogo. Qualquer usuário logado pode consultar (a receita usa esta lista).",
        security="Bearer",
        params={"ativos": "true = só os medicamentos disponíveis para escolha"},
    )
    def get(self):
        """Listar medicamentos do catálogo"""
        apenas_ativos = request.args.get("ativos", "").lower() in ("1", "true", "sim")
        return {"itens": [m.to_dict() for m in CatalogoMedicamentoService.listar(apenas_ativos)]}, 200

    @admin_required
    @ns.expect(modelo_medicamento_entrada, validate=True)
    @ns.doc(description="Adiciona um medicamento ao catálogo (somente administrador).", security="Bearer")
    def post(self):
        """Adicionar medicamento ao catálogo"""
        try:
            medicamento = CatalogoMedicamentoService.cadastrar(ns.payload)
        except ValueError as e:
            ns.abort(400, str(e))
        return {"mensagem": "Medicamento adicionado ao catálogo.", "medicamento": medicamento.to_dict()}, 201


@ns.route("/<int:id>")
@ns.param("id", "ID do medicamento no catálogo")
class MedicamentoDetalhe(Resource):
    @admin_required
    @ns.expect(modelo_medicamento_edicao, validate=False)
    @ns.doc(
        description=(
            "Altera descrição, RMS, laboratório ou situação. `ativo: false` remove da lista de escolha "
            "sem apagar o histórico. Receitas já emitidas NÃO mudam."
        ),
        security="Bearer",
    )
    def put(self, id):
        """Atualizar medicamento do catálogo"""
        try:
            medicamento = CatalogoMedicamentoService.atualizar(id, ns.payload or {})
        except LookupError as e:
            ns.abort(404, str(e))
        except ValueError as e:
            ns.abort(400, str(e))
        return {"mensagem": "Medicamento atualizado.", "medicamento": medicamento.to_dict()}, 200


@ns.route("/importar")
class MedicamentoImportar(Resource):
    @admin_required
    @ns.expect(modelo_importacao, validate=True)
    @ns.doc(
        description="Importa vários medicamentos de uma vez (a tela lê o CSV e envia a lista). Somente administrador.",
        security="Bearer",
    )
    def post(self):
        """Importar medicamentos em lote"""
        try:
            resultado = CatalogoMedicamentoService.importar(ns.payload["itens"])
        except ValueError as e:
            ns.abort(400, str(e))
        return resultado, 200
