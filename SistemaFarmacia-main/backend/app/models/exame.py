import datetime
from app.extensions import db
from app.utils import agora_utc


class Exame(db.Model):
    """
    Tabela de exames realizados para clientes.

    Campos:
        cliente_id      — FK para clientes (NOT NULL).
        tipo_exame      — Tipo/descrição do exame realizado (NOT NULL).
        data            — Data de realização do exame (NOT NULL).
        valor           — Valor cobrado pelo exame.
        forma_pagamento — Forma de pagamento utilizada.
        observacoes     — Observações adicionais.
        criado_em       — Data/hora de criação do registro.
    """

    __tablename__ = "exames"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False, index=True)
    tipo_exame = db.Column(db.String(200), nullable=False)
    data = db.Column(db.Date, nullable=False, default=datetime.date.today)
    valor = db.Column(db.Numeric(10, 2), nullable=True)
    forma_pagamento = db.Column(
        db.Enum("Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Outro"),
        nullable=True,
    )
    observacoes = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    # Relacionamento
    cliente = db.relationship("Cliente", back_populates="exames")

    def to_dict(self):
        """Retorna representação em dicionário do exame."""
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nome": self.cliente.nome if self.cliente else None,
            "tipo_exame": self.tipo_exame,
            "data": self.data.isoformat() if self.data else None,
            "valor": float(self.valor) if self.valor is not None else None,
            "forma_pagamento": self.forma_pagamento,
            "observacoes": self.observacoes,
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Exame id={self.id} tipo='{self.tipo_exame}' cliente_id={self.cliente_id}>"
