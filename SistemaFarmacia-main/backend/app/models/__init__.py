# Exporta todos os modelos para que o SQLAlchemy consiga criar as tabelas
# quando chamamos db.create_all().
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.manipulacao import Manipulacao
from app.models.exame import Exame
from app.models.receita import Receita

__all__ = ["Usuario", "Cliente", "Manipulacao", "Exame", "Receita"]
