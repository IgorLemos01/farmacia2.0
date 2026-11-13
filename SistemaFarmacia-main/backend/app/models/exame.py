import datetime
from decimal import Decimal

from app.extensions import db
from app.utils import agora_utc


class Exame(db.Model):
    """
    Pedido de exames de um atendimento (um paciente pode fazer vários exames na mesma visita).

    Campos:
        cliente_id      — FK para clientes (NOT NULL).
        data            — Data de realização (NOT NULL).
        valor           — Valor TOTAL do pedido (soma dos itens), guardado para relatórios.
        forma_pagamento — Forma de pagamento utilizada.
        observacoes     — Resultados / parecer farmacêutico.
        itens           — Exames do pedido (tabela `exame_itens`).
    """

    __tablename__ = "exames"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False, index=True)
    data = db.Column(db.Date, nullable=False, default=datetime.date.today, index=True)
    valor = db.Column(db.Numeric(10, 2), nullable=True)
    forma_pagamento = db.Column(
        db.Enum("Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Outro"),
        nullable=True,
    )
    observacoes = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    # Relacionamentos
    cliente = db.relationship("Cliente", back_populates="exames")
    itens = db.relationship(
        "ExameItem",
        back_populates="exame",
        cascade="all, delete-orphan",
        order_by="ExameItem.ordem",
        lazy="selectin",
    )

    def recalcular_total(self) -> None:
        self.valor = sum((Decimal(i.valor) for i in self.itens), Decimal("0.00"))

    def to_dict(self):
        """Retorna representação em dicionário do pedido de exames."""
        nomes = "; ".join(i.nome for i in self.itens)
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nome": self.cliente.nome if self.cliente else None,
            "data": self.data.isoformat() if self.data else None,
            "itens": [i.to_dict() for i in self.itens],
            "quantidade_exames": len(self.itens),
            # resumo para listagens e compatibilidade com telas antigas
            "tipo_exame": nomes,
            "valor": float(self.valor) if self.valor is not None else None,
            "valor_total": float(self.valor) if self.valor is not None else 0.0,
            "forma_pagamento": self.forma_pagamento,
            "observacoes": self.observacoes,
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Exame id={self.id} itens={len(self.itens)} cliente_id={self.cliente_id}>"


class ExameItem(db.Model):
    """
    Um exame dentro de um pedido.

    `nome` é copiado do catálogo no momento do registro (o histórico não muda se o
    catálogo mudar). `valor` vem do catálogo, mas pode ser ajustado no atendimento.
    """

    __tablename__ = "exame_itens"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    exame_id = db.Column(db.Integer, db.ForeignKey("exames.id", ondelete="CASCADE"), nullable=False, index=True)
    ordem = db.Column(db.Integer, nullable=False, default=0)
    catalogo_id = db.Column(db.Integer, nullable=True)
    nome = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    exame = db.relationship("Exame", back_populates="itens")

    def to_dict(self):
        return {
            "id": self.id,
            "catalogo_id": self.catalogo_id,
            "nome": self.nome,
            "valor": float(self.valor),
        }

    def __repr__(self):
        return f"<ExameItem id={self.id} nome='{self.nome}'>"
