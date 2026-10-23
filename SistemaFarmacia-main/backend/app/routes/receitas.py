from flask import request
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required

from app.services.receita_service import ReceitaService

ns = Namespace("receitas", description="Gestão de receitas médicas vinculadas aos clientes")

modelo_receita_entrada = ns.model(
    "ReceitaEntrada",
    {
        "cliente_id": fields.Integer(required=True, example=1, description="ID do paciente/cliente"),
        "data_venda": fields.String(required=False, example="2026-10-23", description="Data do atendimento/venda (AAAA-MM-DD)"),
        "medico_prescritor": fields.String(required=True, example="Dr. Carlos Eduardo (CRM-SE 12345)", description="Médico prescritor"),
        "medicamentos": fields.String(required=True, example="Amoxicilina 500mg (21 caps), Paracetamol 750mg (10 cpr)", description="Medicamentos prescritos"),
    },
)

modelo_receita_edicao = ns.model(
    "ReceitaEdicao",
    {
        "data_venda": fields.String(required=False, example="2026-10-23"),
        "medico_prescritor": fields.String(required=False, example="Dr. Carlos Eduardo (CRM-SE 12345)"),
        "medicamentos": fields.String(required=False, example="Amoxicilina 500mg"),
    },
)


@ns.route("")
class ReceitaListaCriacao(Resource):
    @jwt_required()
    @ns.doc(
        description="Lista receitas médicas registradas, com filtro opcional por paciente/cliente e paginação.",
        security="Bearer",
        params={
            "cliente_id": "Filtrar por ID do cliente específico",
            "pagina": "Número da página (padrão 1)",
            "limite": "Itens por página (padrão 50)",
        },
    )
    def get(self):
        """Listar receitas médicas"""
        cliente_id = request.args.get("cliente_id", type=int)
        pagina = request.args.get("pagina", 1, type=int)
        limite = request.args.get("limite", 50, type=int)

        resultado = ReceitaService.listar(cliente_id=cliente_id, limite=limite, pagina=pagina)
        return resultado, 200

    @jwt_required()
    @ns.expect(modelo_receita_entrada, validate=True)
    @ns.doc(description="Cadastra uma nova receita médica associada ao paciente.", security="Bearer")
    def post(self):
        """Cadastrar nova receita"""
        dados = ns.payload
        try:
            receita = ReceitaService.cadastrar(dados)
            return {"mensagem": "Receita registrada com sucesso.", "receita": receita.to_dict()}, 201
        except ValueError as e:
            ns.abort(400, str(e))


@ns.route("/<int:id>")
@ns.param("id", "ID da receita")
class ReceitaDetalhe(Resource):
    @jwt_required()
    @ns.doc(description="Obtém detalhes de uma receita médica.", security="Bearer")
    def get(self, id):
        """Obter receita por ID"""
        receita = ReceitaService.obter_por_id(id)
        if not receita:
            ns.abort(404, "Receita não encontrada.")
        return receita.to_dict(), 200

    @jwt_required()
    @ns.expect(modelo_receita_edicao, validate=False)
    @ns.doc(description="Atualiza dados de uma receita médica existente.", security="Bearer")
    def put(self, id):
        """Atualizar receita"""
        dados = ns.payload
        try:
            receita = ReceitaService.atualizar(id, dados)
            return {"mensagem": "Receita atualizada com sucesso.", "receita": receita.to_dict()}, 200
        except ValueError as e:
            ns.abort(400, str(e))

    @jwt_required()
    @ns.doc(description="Exclui uma receita médica.", security="Bearer")
    def delete(self, id):
        """Excluir receita"""
        try:
            ReceitaService.deletar(id)
            return {"mensagem": "Receita excluída com sucesso."}, 200
        except ValueError as e:
            ns.abort(400, str(e))
