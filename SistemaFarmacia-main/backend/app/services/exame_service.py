import datetime
from app.extensions import db
from app.models.exame import Exame
from app.models.cliente import Cliente
from app.utils import parse_data


class ExameService:
    """Regras de negócio para registro de exames."""

    @staticmethod
    def listar(cliente_id: int = None, limite: int = 50, pagina: int = 1):
        query = Exame.query
        if cliente_id:
            query = query.filter_by(cliente_id=cliente_id)

        query = query.order_by(Exame.data.desc(), Exame.id.desc())
        paginacao = query.paginate(page=pagina, per_page=limite, error_out=False)

        return {
            "total": paginacao.total,
            "paginas": paginacao.pages,
            "pagina_atual": paginacao.page,
            "itens": [e.to_dict() for e in paginacao.items],
        }

    @staticmethod
    def obter_por_id(exame_id: int) -> Exame:
        return db.session.get(Exame, exame_id)

    @staticmethod
    def cadastrar(dados: dict) -> Exame:
        cliente_id = dados.get("cliente_id")
        if not cliente_id:
            raise ValueError("O ID do cliente (cliente_id) é obrigatório.")

        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise ValueError(f"Cliente com ID {cliente_id} não encontrado.")

        tipo_exame = dados.get("tipo_exame", "").strip()
        if not tipo_exame:
            raise ValueError("O tipo do exame é obrigatório.")

        data_exame = parse_data(dados.get("data"), "Data do exame") or datetime.date.today()

        exame = Exame(
            cliente_id=cliente_id,
            tipo_exame=tipo_exame,
            data=data_exame,
            valor=dados.get("valor"),
            forma_pagamento=dados.get("forma_pagamento"),
            observacoes=dados.get("observacoes"),
        )

        db.session.add(exame)
        db.session.commit()
        return exame

    @staticmethod
    def atualizar(exame_id: int, dados: dict) -> Exame:
        exame = db.session.get(Exame, exame_id)
        if not exame:
            raise ValueError("Exame não encontrado.")

        if "tipo_exame" in dados:
            exame.tipo_exame = dados["tipo_exame"].strip()
        if "data" in dados and dados["data"]:
            exame.data = parse_data(dados["data"], "Data do exame")
        if "valor" in dados:
            exame.valor = dados["valor"]
        if "forma_pagamento" in dados:
            exame.forma_pagamento = dados["forma_pagamento"]
        if "observacoes" in dados:
            exame.observacoes = dados["observacoes"]

        db.session.commit()
        return exame

    @staticmethod
    def deletar(exame_id: int):
        exame = db.session.get(Exame, exame_id)
        if not exame:
            raise ValueError("Exame não encontrado.")
        db.session.delete(exame)
        db.session.commit()
