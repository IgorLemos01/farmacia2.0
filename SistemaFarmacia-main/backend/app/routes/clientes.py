from flask import request
from flask_restx import Namespace, Resource, fields
from app.auth_utils import modulo_required
from app.modulos import MODULOS_QUE_LEEM_CLIENTES

from app.routes.campos import NumeroOpcional, TextoOpcional
from app.services.cliente_service import ClienteService

ns = Namespace("clientes", description="Gestão de clientes da farmácia")

# --- Modelos do Swagger ---
modelo_cliente_entrada = ns.model(
    "ClienteEntrada",
    {
        "nome": fields.String(required=True, example="João Silva", description="Nome completo"),
        "cpf": fields.String(required=True, example="123.456.789-00", description="CPF único"),
        "rg": fields.String(required=True, example="12.345.678-9", description="RG"),
        "data_nascimento": fields.String(required=True, example="1990-05-15", description="Formato AAAA-MM-DD"),
        "sexo": fields.String(required=True, example="M", enum=["M", "F", "Outro"]),
        "telefone": fields.String(required=True, example="(79) 99999-8888"),
        "email": fields.String(required=True, example="joao.silva@email.com"),
        "endereco": fields.String(required=True, example="Rua das Flores, 123, Centro"),
        "alergia": TextoOpcional(required=False, example="Dipirona, Penicilina", description="Alergias conhecidas"),
        "observacoes": TextoOpcional(required=False, example="Cliente prefere contato via WhatsApp"),
    },
)

modelo_cliente_edicao = ns.model(
    "ClienteEdicao",
    {
        "nome": TextoOpcional(required=False, example="João Silva"),
        "cpf": TextoOpcional(required=False, example="123.456.789-00"),
        "rg": TextoOpcional(required=False, example="12.345.678-9"),
        "data_nascimento": TextoOpcional(required=False, example="1990-05-15"),
        "sexo": TextoOpcional(required=False, example="M", enum=["M", "F", "Outro"]),
        "telefone": TextoOpcional(required=False, example="(79) 99999-8888"),
        "email": TextoOpcional(required=False, example="joao.silva@email.com"),
        "endereco": TextoOpcional(required=False, example="Rua das Flores, 123, Centro"),
        "alergia": TextoOpcional(required=False, example="Dipirona, Penicilina"),
        "observacoes": TextoOpcional(required=False, example="Cliente prefere contato via WhatsApp"),
    },
)


@ns.route("")
class ClienteListaCriacao(Resource):
    @modulo_required(*MODULOS_QUE_LEEM_CLIENTES)
    @ns.doc(
        description="Lista clientes cadastrados com suporte a busca textual (nome, CPF, telefone ou e-mail) e paginação.",
        security="Bearer",
        params={
            "q": "Termo de busca (nome, CPF, telefone ou email)",
            "pagina": "Número da página (padrão 1)",
            "limite": "Quantidade de itens por página (padrão 50)",
        },
    )
    def get(self):
        """Listar clientes"""
        termo = request.args.get("q")
        pagina = request.args.get("pagina", 1, type=int)
        limite = request.args.get("limite", 50, type=int)

        resultado = ClienteService.listar(busca=termo, limite=limite, pagina=pagina)
        return resultado, 200

    @modulo_required('clientes')
    @ns.expect(modelo_cliente_entrada, validate=True)
    @ns.doc(description="Cadastra um novo cliente na farmácia.", security="Bearer")
    def post(self):
        """Cadastrar novo cliente"""
        dados = ns.payload
        try:
            cliente = ClienteService.cadastrar(dados)
            return {"mensagem": "Cliente cadastrado com sucesso.", "cliente": cliente.to_dict()}, 201
        except ValueError as e:
            ns.abort(400, str(e))


@ns.route("/<int:id>")
@ns.param("id", "ID do cliente")
class ClienteDetalhe(Resource):
    @modulo_required(*MODULOS_QUE_LEEM_CLIENTES)
    @ns.doc(description="Obtém os detalhes de um cliente pelo ID.", security="Bearer")
    def get(self, id):
        """Obter cliente por ID"""
        cliente = ClienteService.obter_por_id(id)
        if not cliente:
            ns.abort(404, "Cliente não encontrado.")
        return cliente.to_dict(), 200

    @modulo_required('clientes')
    @ns.expect(modelo_cliente_edicao, validate=False)
    @ns.doc(description="Atualiza dados de um cliente existente.", security="Bearer")
    def put(self, id):
        """Atualizar cliente"""
        dados = ns.payload
        try:
            cliente = ClienteService.atualizar(id, dados)
            return {"mensagem": "Cliente atualizado com sucesso.", "cliente": cliente.to_dict()}, 200
        except ValueError as e:
            ns.abort(400, str(e))

    @modulo_required('clientes')
    @ns.doc(description="Remove um cliente (apenas se não houver registros vinculados).", security="Bearer")
    def delete(self, id):
        """Excluir cliente"""
        try:
            ClienteService.deletar(id)
            return {"mensagem": "Cliente removido com sucesso."}, 200
        except ValueError as e:
            ns.abort(400, str(e))


@ns.route("/<int:id>/dossie")
@ns.param("id", "ID do cliente")
class ClienteDossie(Resource):
    @modulo_required('clientes')
    @ns.doc(
        description="Retorna a visão 360° do cliente: dados cadastrais + histórico de manipulações, exames e receitas médicas.",
        security="Bearer",
    )
    def get(self, id):
        """Obter prontuário/dossiê completo do cliente"""
        try:
            return ClienteService.obter_dossie(id), 200
        except ValueError as e:
            ns.abort(404, str(e))
