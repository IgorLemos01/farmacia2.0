from app.extensions import db
from app.utils import agora_utc

# Campos que completam o cadastro. O atendimento começa só com nome e telefone
# (cadastro rápido) e estes vão sendo preenchidos nos atendimentos seguintes.
CAMPOS_COMPLEMENTARES = {
    "cpf": "CPF",
    "rg": "RG",
    "data_nascimento": "Data de nascimento",
    "sexo": "Sexo",
    "email": "E-mail",
    "cep": "CEP",
    "endereco": "Rua / Logradouro",
    "numero": "Número",
    "bairro": "Bairro",
    "cidade": "Cidade",
    "estado": "Estado (UF)",
}


class Cliente(db.Model):
    """
    Tabela de clientes da farmácia (cadastro progressivo).

    Obrigatórios: nome e telefone (WhatsApp). Todo o resto é opcional e pode ser
    completado em atendimentos futuros.

    - cpf: único quando informado (vários clientes podem ficar sem CPF). A unicidade é
      garantida pelo serviço e, no banco, por índice único filtrado (ver backend/db/).
    - endereco: rua/logradouro (em cadastros antigos, guarda o endereço completo).
    - alergia: alergias conhecidas — aparecem em destaque nas telas de atendimento.
    """

    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(150), nullable=False, index=True)
    telefone = db.Column(db.String(20), nullable=False)
    cpf = db.Column(db.String(14), nullable=True, index=True)
    rg = db.Column(db.String(20), nullable=True)
    data_nascimento = db.Column(db.Date, nullable=True)
    sexo = db.Column(db.String(10), nullable=True)  # 'M', 'F' ou 'Outro'
    email = db.Column(db.String(150), nullable=True)
    cep = db.Column(db.String(9), nullable=True)
    endereco = db.Column(db.String(300), nullable=True)
    numero = db.Column(db.String(20), nullable=True)
    complemento = db.Column(db.String(100), nullable=True)
    bairro = db.Column(db.String(100), nullable=True)
    cidade = db.Column(db.String(100), nullable=True)
    estado = db.Column(db.String(2), nullable=True)
    alergia = db.Column(db.Text, nullable=True)
    observacoes = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    # Relacionamentos
    manipulacoes = db.relationship("Manipulacao", back_populates="cliente", lazy="dynamic")
    exames = db.relationship("Exame", back_populates="cliente", lazy="dynamic")
    receitas = db.relationship("Receita", back_populates="cliente", lazy="dynamic")

    @property
    def endereco_completo(self) -> str:
        """'Rua A, 10 - apto 2 - Centro - Aracaju/SE - CEP 49000-000' (só com o que foi preenchido)."""
        rua = ", ".join(p for p in (self.endereco, self.numero) if p)
        if rua and self.complemento:
            rua = f"{rua} - {self.complemento}"
        cidade_uf = "/".join(p for p in (self.cidade, self.estado) if p)
        partes = [p for p in (rua, self.bairro, cidade_uf) if p]
        if self.cep:
            partes.append(f"CEP {self.cep}")
        return " - ".join(partes)

    @property
    def campos_pendentes(self) -> list[str]:
        """Rótulos dos campos complementares ainda vazios."""
        return [rotulo for campo, rotulo in CAMPOS_COMPLEMENTARES.items() if not getattr(self, campo)]

    def to_dict(self):
        """Retorna representação em dicionário do cliente."""
        pendentes = self.campos_pendentes
        return {
            "id": self.id,
            "nome": self.nome,
            "telefone": self.telefone,
            "cpf": self.cpf,
            "rg": self.rg,
            "data_nascimento": self.data_nascimento.isoformat() if self.data_nascimento else None,
            "sexo": self.sexo,
            "email": self.email,
            "cep": self.cep,
            "endereco": self.endereco,
            "numero": self.numero,
            "complemento": self.complemento,
            "bairro": self.bairro,
            "cidade": self.cidade,
            "estado": self.estado,
            "endereco_completo": self.endereco_completo,
            "alergia": self.alergia,
            "observacoes": self.observacoes,
            "cadastro_completo": not pendentes,
            "campos_pendentes": pendentes,
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Cliente {self.nome} — Tel: {self.telefone}>"
