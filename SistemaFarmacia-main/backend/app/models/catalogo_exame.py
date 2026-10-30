from app.extensions import db
from app.utils import agora_utc


class CatalogoExame(db.Model):
    """
    Catálogo de exames oferecidos (nome e valor), mantido pelo administrador.

    Ao registrar um exame para um cliente, o nome e o valor são COPIADOS daqui para
    o registro (tabela `exames`). Assim, mudar o preço no catálogo não altera exames
    já realizados.

    Campos:
        nome          — Nome do exame (único, sem diferenciar maiúsculas).
        valor         — Valor atual cobrado.
        ativo         — False = removido da lista de escolha, mas o histórico continua válido.
        criado_em     — Data/hora de criação.
        atualizado_em — Data/hora da última alteração.
    """

    __tablename__ = "catalogo_exames"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(200), nullable=False, unique=True, index=True)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)
    atualizado_em = db.Column(db.DateTime, nullable=False, default=agora_utc, onupdate=agora_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "valor": float(self.valor),
            "ativo": self.ativo,
            "criado_em": self.criado_em.isoformat(),
            "atualizado_em": self.atualizado_em.isoformat(),
        }

    def __repr__(self):
        return f"<CatalogoExame id={self.id} nome='{self.nome}' ativo={self.ativo}>"
