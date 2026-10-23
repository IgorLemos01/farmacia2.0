# Exporta todos os modelos para que o SQLAlchemy consiga criar as tabelas
# quando chamamos db.create_all().
from app.models.usuario import Usuario

__all__ = ["Usuario"]
