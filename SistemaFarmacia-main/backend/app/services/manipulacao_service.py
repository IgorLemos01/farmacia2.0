import datetime
from app.extensions import db
from app.models.manipulacao import Manipulacao
from app.models.cliente import Cliente


class ManipulacaoService:
    """Regras de negócio para pedidos de manipulação."""

    @staticmethod
    def listar(cliente_id: int = None, limite: int = 50, pagina: int = 1):
        query = Manipulacao.query
        if cliente_id:
            query = query.filter_by(cliente_id=cliente_id)

        query = query.order_by(Manipulacao.data.desc(), Manipulacao.id.desc())
        paginacao = query.paginate(page=pagina, per_page=limite, error_out=False)

        return {
            "total": paginacao.total,
            "paginas": paginacao.pages,
            "pagina_atual": paginacao.page,
            "itens": [m.to_dict() for m in paginacao.items],
        }

    @staticmethod
    def obter_por_id(manipulacao_id: int) -> Manipulacao:
        return Manipulacao.query.get(manipulacao_id)

    @staticmethod
    def cadastrar(dados: dict) -> Manipulacao:
        cliente_id = dados.get("cliente_id")
        if not cliente_id:
            raise ValueError("O ID do cliente (cliente_id) é obrigatório.")

        cliente = Cliente.query.get(cliente_id)
        if not cliente:
            raise ValueError(f"Cliente com ID {cliente_id} não encontrado.")

        formula = dados.get("formula", "").strip()
        if not formula:
            raise ValueError("A fórmula/composição do medicamento é obrigatória.")

        data_pedido = dados.get("data")
        if data_pedido:
            if isinstance(data_pedido, str):
                data_pedido = datetime.date.fromisoformat(data_pedido)
        else:
            data_pedido = datetime.date.today()

        prazo = dados.get("prazo_entrega")
        if prazo and isinstance(prazo, str):
            prazo = datetime.date.fromisoformat(prazo)

        manipulacao = Manipulacao(
            cliente_id=cliente_id,
            data=data_pedido,
            formula=formula,
            prazo_entrega=prazo,
            valor=dados.get("valor"),
            forma_pagamento=dados.get("forma_pagamento"),
            observacoes=dados.get("observacoes"),
        )

        db.session.add(manipulacao)
        db.session.commit()
        return manipulacao

    @staticmethod
    def atualizar(manipulacao_id: int, dados: dict) -> Manipulacao:
        manipulacao = Manipulacao.query.get(manipulacao_id)
        if not manipulacao:
            raise ValueError("Pedido de manipulação não encontrado.")

        if "formula" in dados:
            manipulacao.formula = dados["formula"].strip()
        if "data" in dados and dados["data"]:
            val = dados["data"]
            manipulacao.data = datetime.date.fromisoformat(val) if isinstance(val, str) else val
        if "prazo_entrega" in dados:
            val = dados["prazo_entrega"]
            manipulacao.prazo_entrega = datetime.date.fromisoformat(val) if isinstance(val, str) else val
        if "valor" in dados:
            manipulacao.valor = dados["valor"]
        if "forma_pagamento" in dados:
            manipulacao.forma_pagamento = dados["forma_pagamento"]
        if "observacoes" in dados:
            manipulacao.observacoes = dados["observacoes"]

        db.session.commit()
        return manipulacao

    @staticmethod
    def deletar(manipulacao_id: int):
        manipulacao = Manipulacao.query.get(manipulacao_id)
        if not manipulacao:
            raise ValueError("Pedido de manipulação não encontrado.")
        db.session.delete(manipulacao)
        db.session.commit()
