from flask import request
from flask_restx import Namespace, Resource, fields
from app.auth_utils import modulo_required

from app.routes.campos import NumeroOpcional, TextoOpcional
from app.services.manipulacao_service import ManipulacaoService

ns = Namespace("manipulacoes", description="Gestão de pedidos de manipulação de medicamentos")

FORMAS_PAGAMENTO = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Outro"]

modelo_manipulacao_entrada = ns.model(
    "ManipulacaoEntrada",
    {
        "cliente_id": fields.Integer(required=True, example=1, description="ID do cliente"),
        "formula": fields.String(required=True, example="Minoxidil 5%, Biotina 2mg, Loção qsp 60ml", description="Fórmula/Composição"),
        "data": TextoOpcional(required=False, example="2026-10-23", description="Data do pedido (AAAA-MM-DD). Padrão hoje"),
        "prazo_entrega": TextoOpcional(required=False, example="2026-10-26", description="Data prevista de entrega"),
        "valor": NumeroOpcional(required=False, example=85.50, description="Valor cobrado"),
        "forma_pagamento": fields.String(required=False, enum=FORMAS_PAGAMENTO, example="PIX"),
        "observacoes": TextoOpcional(required=False, example="Uso tópico, aplicar à noite"),
    },
)

modelo_manipulacao_edicao = ns.model(
    "ManipulacaoEdicao",
    {
        "formula": TextoOpcional(required=False, example="Minoxidil 5%, Biotina 2mg"),
        "data": TextoOpcional(required=False, example="2026-10-23"),
        "prazo_entrega": TextoOpcional(required=False, example="2026-10-26"),
        "valor": NumeroOpcional(required=False, example=85.50),
        "forma_pagamento": fields.String(required=False, enum=FORMAS_PAGAMENTO, example="PIX"),
        "observacoes": TextoOpcional(required=False, example="Uso tópico, aplicar à noite"),
    },
)


@ns.route("")
class ManipulacaoListaCriacao(Resource):
    @modulo_required('manipulacoes', 'dashboard')
    @ns.doc(
        description="Lista pedidos de manipulação, com filtro opcional por cliente e paginação.",
        security="Bearer",
        params={
            "cliente_id": "Filtrar por ID do cliente específico",
            "pagina": "Número da página (padrão 1)",
            "limite": "Itens por página (padrão 50)",
        },
    )
    def get(self):
        """Listar pedidos de manipulação"""
        cliente_id = request.args.get("cliente_id", type=int)
        pagina = request.args.get("pagina", 1, type=int)
        limite = request.args.get("limite", 50, type=int)

        resultado = ManipulacaoService.listar(cliente_id=cliente_id, limite=limite, pagina=pagina)
        return resultado, 200

    @modulo_required('manipulacoes')
    @ns.expect(modelo_manipulacao_entrada, validate=True)
    @ns.doc(description="Registra um novo pedido de manipulação para um cliente.", security="Bearer")
    def post(self):
        """Cadastrar novo pedido de manipulação"""
        dados = ns.payload
        try:
            manipulacao = ManipulacaoService.cadastrar(dados)
            return {"mensagem": "Manipulação cadastrada com sucesso.", "manipulacao": manipulacao.to_dict()}, 201
        except ValueError as e:
            ns.abort(400, str(e))


@ns.route("/<int:id>")
@ns.param("id", "ID do pedido de manipulação")
class ManipulacaoDetalhe(Resource):
    @modulo_required('manipulacoes', 'dashboard')
    @ns.doc(description="Obtém detalhes de um pedido de manipulação.", security="Bearer")
    def get(self, id):
        """Obter manipulação por ID"""
        manipulacao = ManipulacaoService.obter_por_id(id)
        if not manipulacao:
            ns.abort(404, "Pedido de manipulação não encontrado.")
        return manipulacao.to_dict(), 200

    @modulo_required('manipulacoes')
    @ns.expect(modelo_manipulacao_edicao, validate=False)
    @ns.doc(description="Atualiza dados de uma manipulação existente.", security="Bearer")
    def put(self, id):
        """Atualizar manipulação"""
        dados = ns.payload
        try:
            manipulacao = ManipulacaoService.atualizar(id, dados)
            return {"mensagem": "Manipulação atualizada com sucesso.", "manipulacao": manipulacao.to_dict()}, 200
        except ValueError as e:
            ns.abort(400, str(e))

    @modulo_required('manipulacoes')
    @ns.doc(description="Exclui um pedido de manipulação.", security="Bearer")
    def delete(self, id):
        """Excluir manipulação"""
        try:
            ManipulacaoService.deletar(id)
            return {"mensagem": "Pedido de manipulação excluído com sucesso."}, 200
        except ValueError as e:
            ns.abort(400, str(e))
