import datetime
from app.extensions import db


class Usuario(db.Model):
    """
    Tabela de usuários do sistema.

    Campos:
        id          — Chave primária auto incrementada.
        nome        — Nome completo do usuário.
        email       — E-mail único usado no login.
        senha_hash  — Hash bcrypt da senha (nunca armazenamos a senha em texto puro).
        perfil      — Nível de acesso: 'admin' ou 'atendente'.
        ativo       — Se False, o usuário está desativado e não consegue logar.
        criado_em   — Data/hora de criação do registro.
    """

    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    senha_hash = db.Column(db.String(255), nullable=False)
    perfil = db.Column(db.Enum("admin", "atendente"), nullable=False, default="atendente")
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

    def to_dict(self):
        """Retorna representação segura do usuário (sem a senha)."""
        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
            "perfil": self.perfil,
            "ativo": self.ativo,
            "criado_em": self.criado_em.isoformat(),
        }

    def __repr__(self):
        return f"<Usuario {self.email}>"
