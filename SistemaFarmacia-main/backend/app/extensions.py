from flask_sqlalchemy import SQLAlchemy

# Instância do SQLAlchemy compartilhada por toda a aplicação.
# Criada aqui para evitar importações circulares.
db = SQLAlchemy()
