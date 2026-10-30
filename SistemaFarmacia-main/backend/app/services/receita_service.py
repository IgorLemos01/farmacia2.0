import datetime
from app.extensions import db
from app.models.receita import Receita
from app.models.cliente import Cliente
from app.utils import parse_data, texto_obrigatorio


class ReceitaService:
    """Regras de negócio para registro de receitas médicas."""

    @staticmethod
    def listar(cliente_id: int = None, limite: int = 50, pagina: int = 1):
        query = Receita.query
        if cliente_id:
            query = query.filter_by(cliente_id=cliente_id)

        query = query.order_by(Receita.data_venda.desc(), Receita.id.desc())
        paginacao = query.paginate(page=pagina, per_page=limite, error_out=False)

        return {
            "total": paginacao.total,
            "paginas": paginacao.pages,
            "pagina_atual": paginacao.page,
            "itens": [r.to_dict() for r in paginacao.items],
        }

    @staticmethod
    def obter_por_id(receita_id: int) -> Receita:
        return db.session.get(Receita, receita_id)

    @staticmethod
    def cadastrar(dados: dict) -> Receita:
        cliente_id = dados.get("cliente_id")
        if not cliente_id:
            raise ValueError("O ID do cliente (cliente_id) é obrigatório.")

        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise ValueError(f"Cliente com ID {cliente_id} não encontrado.")

        medico = dados.get("medico_prescritor", "").strip()
        if not medico:
            raise ValueError("O nome do médico prescritor é obrigatório.")

        medicamentos = dados.get("medicamentos", "").strip()
        if not medicamentos:
            raise ValueError("A descrição dos medicamentos é obrigatória.")

        data_venda = parse_data(dados.get("data_venda"), "Data da venda") or datetime.date.today()

        receita = Receita(
            cliente_id=cliente_id,
            data_venda=data_venda,
            medico_prescritor=medico,
            medicamentos=medicamentos,
        )

        db.session.add(receita)
        db.session.commit()
        return receita

    @staticmethod
    def atualizar(receita_id: int, dados: dict) -> Receita:
        receita = db.session.get(Receita, receita_id)
        if not receita:
            raise ValueError("Receita não encontrada.")

        if "medico_prescritor" in dados:
            receita.medico_prescritor = texto_obrigatorio(dados["medico_prescritor"], "Médico prescritor")
        if "medicamentos" in dados:
            receita.medicamentos = texto_obrigatorio(dados["medicamentos"], "Medicamentos")
        if "data_venda" in dados and dados["data_venda"]:
            receita.data_venda = parse_data(dados["data_venda"], "Data da venda")

        db.session.commit()
        return receita

    @staticmethod
    def deletar(receita_id: int):
        receita = db.session.get(Receita, receita_id)
        if not receita:
            raise ValueError("Receita não encontrada.")
        db.session.delete(receita)
        db.session.commit()
