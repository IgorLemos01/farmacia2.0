from app.extensions import db
from app.utils import agora_utc


class Cliente(db.Model):
    """
    Tabela de clientes da farmácia.

    Campos obrigatórios (NOT NULL):
        nome            — Nome completo do cliente.
        cpf             — CPF único do cliente.
        rg              — RG do cliente.
        data_nascimento — Data de nascimento.
        sexo            — Sexo: 'M', 'F' ou 'Outro'.
        telefone        — Telefone de contato.
        email           — E-mail do cliente.
        endereco        — Endereço completo.

    Campos opcionais:
        alergia         — Alergias conhecidas do cliente.
        observacoes     — Observações gerais.
        criado_em       — Data/hora de criação do registro.
    """

    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(150), nullable=False)
    cpf = db.Column(db.String(14), nullable=False, unique=True, index=True)
    rg = db.Column(db.String(20), nullable=False)
    data_nascimento = db.Column(db.Date, nullable=False)
    sexo = db.Column(db.Enum("M", "F", "Outro"), nullable=False)
    telefone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    endereco = db.Column(db.String(300), nullable=False)
    alergia = db.Column(db.Text, nullable=True)
    observacoes = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    # Relacionamentos
    manipulacoes = db.relationship("Manipulacao", back_populates="cliente", lazy="dynamic")
    exames = db.relationship("Exame", back_populates="cliente", lazy="dynamic")
    receitas = db.relationship("Receita", back_populates="cliente", lazy="dynamic")

    def to_dict(self):
        """Retorna representação em dicionário do cliente."""
        return {
            "id": self.id,
            "nome": self.nome,
            "cpf": self.cpf,
            "rg": self.rg,
            "data_nascimento": self.data_nascimento.isoformat() if self.data_nascimento else None,
            "sexo": self.sexo,
            "telefone": self.telefone,
            "email": self.email,
            "endereco": self.endereco,
            "alergia": self.alergia,
            "observacoes": self.observacoes,
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Cliente {self.nome} — CPF: {self.cpf}>"
