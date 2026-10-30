import datetime
from app.extensions import db
from app.utils import agora_utc


class Receita(db.Model):
    """
    Tabela de receitas médicas associadas a clientes.

    Campos:
        cliente_id          — FK para clientes (NOT NULL).
        data_venda          — Data da venda/atendimento (NOT NULL).
        medico_prescritor   — Nome do médico que prescreveu (NOT NULL).
        medicamentos        — Lista/descrição dos medicamentos prescritos (NOT NULL).
        criado_em           — Data/hora de criação do registro.
    """

    __tablename__ = "receitas"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False, index=True)
    data_venda = db.Column(db.Date, nullable=False, default=datetime.date.today)
    medico_prescritor = db.Column(db.String(200), nullable=False)
    medicamentos = db.Column(db.Text, nullable=False)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    # Relacionamento
    cliente = db.relationship("Cliente", back_populates="receitas")

    def to_dict(self):
        """Retorna representação em dicionário da receita."""
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nome": self.cliente.nome if self.cliente else None,
            "data_venda": self.data_venda.isoformat() if self.data_venda else None,
            "medico_prescritor": self.medico_prescritor,
            "medicamentos": self.medicamentos,
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Receita id={self.id} cliente_id={self.cliente_id} medico='{self.medico_prescritor}'>"
