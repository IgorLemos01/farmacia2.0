import datetime
from app.extensions import db
from app.utils import agora_utc


class Receita(db.Model):
    """
    Receita (ficha de dispensação) de um cliente, com um ou mais medicamentos.

    Campos:
        cliente_id          — FK para clientes (NOT NULL).
        data_venda          — Data da venda/atendimento (NOT NULL).
        medico_prescritor   — Médico que prescreveu (opcional).
        observacoes         — Instruções adicionais (opcional).
        itens               — Medicamentos da receita (tabela `receita_itens`).
        criado_em           — Data/hora de criação do registro.
    """

    __tablename__ = "receitas"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False, index=True)
    data_venda = db.Column(db.Date, nullable=False, default=datetime.date.today)
    medico_prescritor = db.Column(db.String(200), nullable=True)
    observacoes = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    # Relacionamentos
    cliente = db.relationship("Cliente", back_populates="receitas")
    itens = db.relationship(
        "ReceitaItem",
        back_populates="receita",
        cascade="all, delete-orphan",
        order_by="ReceitaItem.ordem",
        lazy="selectin",
    )

    def to_dict(self):
        """Retorna representação em dicionário da receita."""
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nome": self.cliente.nome if self.cliente else None,
            "data_venda": self.data_venda.isoformat() if self.data_venda else None,
            "medico_prescritor": self.medico_prescritor,
            "observacoes": self.observacoes,
            "itens": [i.to_dict() for i in self.itens],
            # resumo para listagens: "ALPRAZOLAM 0,25 MG; AMOXICILINA 500 MG"
            "medicamentos": "; ".join(i.medicamento for i in self.itens),
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Receita id={self.id} cliente_id={self.cliente_id} itens={len(self.itens)}>"


class ReceitaItem(db.Model):
    """
    Um medicamento dentro de uma receita.

    `medicamento`, `rms` e `laboratorio` são cópias do catálogo no momento do registro:
    mudar o catálogo depois não altera receitas já emitidas.
    Lote, validade e quantidade são informados pelo atendente (vêm da embalagem).
    """

    __tablename__ = "receita_itens"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    receita_id = db.Column(db.Integer, db.ForeignKey("receitas.id", ondelete="CASCADE"), nullable=False, index=True)
    ordem = db.Column(db.Integer, nullable=False, default=0)
    medicamento = db.Column(db.String(255), nullable=False)
    rms = db.Column(db.String(30), nullable=False, default="")
    laboratorio = db.Column(db.String(150), nullable=True)
    dose = db.Column(db.String(60), nullable=True)
    posologia = db.Column(db.String(200), nullable=True)
    lote = db.Column(db.String(60), nullable=True)
    validade = db.Column(db.String(20), nullable=True)
    quantidade = db.Column(db.Integer, nullable=True)

    receita = db.relationship("Receita", back_populates="itens")

    def to_dict(self):
        return {
            "id": self.id,
            "medicamento": self.medicamento,
            "rms": self.rms,
            "laboratorio": self.laboratorio,
            "dose": self.dose,
            "posologia": self.posologia,
            "lote": self.lote,
            "validade": self.validade,
            "quantidade": self.quantidade,
        }

    def __repr__(self):
        return f"<ReceitaItem id={self.id} medicamento='{self.medicamento}'>"
