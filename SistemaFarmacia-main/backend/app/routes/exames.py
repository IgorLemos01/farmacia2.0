from flask import request
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required

from app.routes.campos import NumeroOpcional, TextoOpcional
from app.services.exame_service import ExameService

ns = Namespace("exames", description="Gestão de exames e procedimentos rápidos da farmácia")

FORMAS_PAGAMENTO = ["Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Outro"]

modelo_exame_entrada = ns.model(
    "ExameEntrada",
    {
        "cliente_id": fields.Integer(required=True, example=1, description="ID do cliente"),
        "tipo_exame": fields.String(required=True, example="Glicemia Capilar / Perfil Lipídico", description="Tipo de exame"),
        "data": TextoOpcional(required=False, example="2026-10-23", description="Data de realização (AAAA-MM-DD)"),
        "valor": NumeroOpcional(required=False, example=25.00, description="Valor cobrado"),
        "forma_pagamento": fields.String(required=False, enum=FORMAS_PAGAMENTO, example="PIX"),
        "observacoes": TextoOpcional(required=False, example="Resultado: Glicemia em jejum 92 mg/dL. Normal."),
    },
)

modelo_exame_edicao = ns.model(
    "ExameEdicao",
    {
        "tipo_exame": TextoOpcional(required=False, example="Glicemia Capilar"),
        "data": TextoOpcional(required=False, example="2026-10-23"),
        "valor": NumeroOpcional(required=False, example=25.00),
        "forma_pagamento": fields.String(required=False, enum=FORMAS_PAGAMENTO, example="PIX"),
        "observacoes": TextoOpcional(required=False, example="Resultado normal."),
    },
)


@ns.route("")
class ExameListaCriacao(Resource):
    @jwt_required()
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

    @jwt_required()
    @ns.expect(modelo_exame_entrada, validate=True)
    @ns.doc(description="Registra um novo exame para o cliente.", security="Bearer")
    def post(self):
        """Registrar novo exame"""
        dados = ns.payload
        try:
            exame = ExameService.cadastrar(dados)
            return {"mensagem": "Exame registrado com sucesso.", "exame": exame.to_dict()}, 201
        except ValueError as e:
            ns.abort(400, str(e))


@ns.route("/<int:id>")
@ns.param("id", "ID do exame")
class ExameDetalhe(Resource):
    @jwt_required()
    @ns.doc(description="Obtém detalhes de um exame realizado.", security="Bearer")
    def get(self, id):
        """Obter exame por ID"""
        exame = ExameService.obter_por_id(id)
        if not exame:
            ns.abort(404, "Exame não encontrado.")
        return exame.to_dict(), 200

    @jwt_required()
    @ns.expect(modelo_exame_edicao, validate=False)
    @ns.doc(description="Atualiza dados de um exame existente.", security="Bearer")
    def put(self, id):
        """Atualizar exame"""
        dados = ns.payload
        try:
            exame = ExameService.atualizar(id, dados)
            return {"mensagem": "Exame atualizado com sucesso.", "exame": exame.to_dict()}, 200
        except ValueError as e:
            ns.abort(400, str(e))

    @jwt_required()
    @ns.doc(description="Exclui um exame registrado.", security="Bearer")
    def delete(self, id):
        """Excluir exame"""
        try:
            ExameService.deletar(id)
            return {"mensagem": "Exame excluído com sucesso."}, 200
        except ValueError as e:
            ns.abort(400, str(e))
