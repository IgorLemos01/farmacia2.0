from flask import request
from flask_restx import Namespace, Resource, fields
from app.auth_utils import modulo_required

from app.routes.campos import TextoOpcional
from app.services.exame_service import FORMAS_PAGAMENTO as FORMAS, ExameService

ns = Namespace("exames", description="Gestão de exames e procedimentos rápidos da farmácia")

FORMAS_PAGAMENTO = list(FORMAS)

_DESCRICAO_ITENS = (
    "Exames do pedido (1 a 30). Item novo: {catalogo_id, valor?} — o nome vem do catálogo e o valor, "
    "se omitido, também. Na edição, item já salvo: {id, valor?} (mantém o nome original)."
)

modelo_exame_entrada = ns.model(
    "ExameEntrada",
    {
        "cliente_id": fields.Integer(required=True, example=1, description="ID do cliente"),
        "itens": fields.List(fields.Raw, required=True, description=_DESCRICAO_ITENS,
                             example=[{"catalogo_id": 1}, {"catalogo_id": 2, "valor": 15.5}]),
        "data": TextoOpcional(required=False, example="2026-10-23", description="Data de realização (AAAA-MM-DD)"),
        "forma_pagamento": TextoOpcional(required=False, example="PIX", description=" | ".join(FORMAS)),
        "observacoes": TextoOpcional(required=False, example="Glicemia em jejum 92 mg/dL. Normal."),
    },
)

modelo_exame_edicao = ns.model(
    "ExameEdicao",
    {
        "itens": fields.List(fields.Raw, required=False, description="Se enviada, substitui a lista. " + _DESCRICAO_ITENS),
        "data": TextoOpcional(required=False, example="2026-10-23"),
        "forma_pagamento": TextoOpcional(required=False, enum=FORMAS_PAGAMENTO, example="PIX"),
        "observacoes": TextoOpcional(required=False, example="Resultado normal."),
    },
)


@ns.route("")
class ExameListaCriacao(Resource):
    @modulo_required('exames', 'dashboard')
    @ns.doc(
        description="Lista exames registrados, com filtro opcional por cliente e paginação.",
        security="Bearer",
        params={
            "cliente_id": "Filtrar por ID do cliente específico",
            "pagina": "Número da página (padrão 1)",
            "limite": "Itens por página (padrão 50)",
        },
    )
    def get(self):
        """Listar exames"""
        cliente_id = request.args.get("cliente_id", type=int)
        pagina = request.args.get("pagina", 1, type=int)
        limite = request.args.get("limite", 50, type=int)

        resultado = ExameService.listar(cliente_id=cliente_id, limite=limite, pagina=pagina)
        return resultado, 200

    @modulo_required('exames')
    @ns.expect(modelo_exame_entrada, validate=True)
    @ns.doc(description="Registra um pedido com um ou mais exames para o cliente; o total é calculado pelo servidor.", security="Bearer")
    def post(self):
        """Registrar pedido de exames"""
        dados = ns.payload
        try:
            exame = ExameService.cadastrar(dados)
            return {"mensagem": "Exame registrado com sucesso.", "exame": exame.to_dict()}, 201
        except ValueError as e:
            ns.abort(400, str(e))


@ns.route("/<int:id>")
@ns.param("id", "ID do exame")
class ExameDetalhe(Resource):
    @modulo_required('exames', 'dashboard')
    @ns.doc(description="Obtém detalhes de um exame realizado.", security="Bearer")
    def get(self, id):
        """Obter exame por ID"""
        exame = ExameService.obter_por_id(id)
        if not exame:
            ns.abort(404, "Exame não encontrado.")
        return exame.to_dict(), 200

    @modulo_required('exames')
    @ns.expect(modelo_exame_edicao, validate=False)
    @ns.doc(description="Atualiza data, pagamento, observações e/ou a lista de exames (e seus valores).", security="Bearer")
    def put(self, id):
        """Atualizar exame"""
        dados = ns.payload
        try:
            exame = ExameService.atualizar(id, dados)
            return {"mensagem": "Exame atualizado com sucesso.", "exame": exame.to_dict()}, 200
        except LookupError as e:
            ns.abort(404, str(e))
        except ValueError as e:
            ns.abort(400, str(e))

    @modulo_required('exames')
    @ns.doc(description="Exclui um exame registrado.", security="Bearer")
    def delete(self, id):
        """Excluir exame"""
        try:
            ExameService.deletar(id)
            return {"mensagem": "Exame excluído com sucesso."}, 200
        except LookupError as e:
            ns.abort(404, str(e))
        except ValueError as e:
            ns.abort(400, str(e))
