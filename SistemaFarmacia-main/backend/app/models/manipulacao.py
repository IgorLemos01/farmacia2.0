import datetime
from app.extensions import db
from app.utils import agora_utc


class Manipulacao(db.Model):
    """
    Tabela de pedidos de manipulação de medicamentos.

    Campos:
        cliente_id      — FK para clientes (NOT NULL).
        data            — Data do pedido de manipulação (NOT NULL).
        formula         — Fórmula / composição do medicamento (NOT NULL).
        prazo_entrega   — Prazo de entrega estimado.
        valor           — Valor cobrado pelo serviço.
        forma_pagamento — Forma de pagamento utilizada.
        observacoes     — Observações adicionais.
        criado_em       — Data/hora de criação do registro.
    """

    __tablename__ = "manipulacoes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False, index=True)
    data = db.Column(db.Date, nullable=False, default=datetime.date.today)
    formula = db.Column(db.Text, nullable=False)
    prazo_entrega = db.Column(db.Date, nullable=True)
    valor = db.Column(db.Numeric(10, 2), nullable=True)
    forma_pagamento = db.Column(
        db.Enum("Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Outro"),
        nullable=True,
    )
    observacoes = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    # Relacionamento
    cliente = db.relationship("Cliente", back_populates="manipulacoes")

    def to_dict(self):
        """Retorna representação em dicionário da manipulação."""
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nome": self.cliente.nome if self.cliente else None,
            "data": self.data.isoformat() if self.data else None,
            "formula": self.formula,
            "prazo_entrega": self.prazo_entrega.isoformat() if self.prazo_entrega else None,
            "valor": float(self.valor) if self.valor is not None else None,
            "forma_pagamento": self.forma_pagamento,
            "observacoes": self.observacoes,
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Manipulacao id={self.id} cliente_id={self.cliente_id}>"
