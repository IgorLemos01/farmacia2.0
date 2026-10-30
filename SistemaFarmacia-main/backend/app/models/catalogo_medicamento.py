from app.extensions import db
from app.utils import agora_utc


class CatalogoMedicamento(db.Model):
    """
    Catálogo de medicamentos (controlados e antibióticos) mantido pelo administrador.

    Ao registrar uma receita, RMS, descrição e laboratório são COPIADOS daqui para o
    item da receita (tabela `receita_itens`). Assim, alterar o catálogo depois não
    muda receitas já emitidas.

    Campos:
        rms           — Registro no Ministério da Saúde (13 dígitos; vazio se não houver).
        descricao     — Nome/apresentação do medicamento (ex.: "ALPRAZOLAM 0,25 MG 30 CPRS").
        laboratorio   — Fabricante.
        ativo         — False = some da lista de escolha, mas o histórico continua válido.
    A combinação (rms, descricao) é única.
    """

    __tablename__ = "catalogo_medicamentos"
    __table_args__ = (db.UniqueConstraint("rms", "descricao", name="uq_catalogo_medicamentos_rms_descricao"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    rms = db.Column(db.String(30), nullable=False, default="", index=True)
    descricao = db.Column(db.String(255), nullable=False)
    laboratorio = db.Column(db.String(150), nullable=True)
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)
    atualizado_em = db.Column(db.DateTime, nullable=False, default=agora_utc, onupdate=agora_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "rms": self.rms,
            "descricao": self.descricao,
            "laboratorio": self.laboratorio,
            "ativo": self.ativo,
            "criado_em": self.criado_em.isoformat(),
            "atualizado_em": self.atualizado_em.isoformat(),
        }

    def __repr__(self):
        return f"<CatalogoMedicamento id={self.id} rms='{self.rms}' descricao='{self.descricao}'>"
