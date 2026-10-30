import os
import urllib.parse
from dotenv import load_dotenv

load_dotenv()


class Config:
    # --- Tipo de Banco: 'mssql' (SQL Server) ou 'mysql' ---
    DB_TYPE = os.getenv("DB_TYPE", "mssql").lower()

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT") or ("1433" if DB_TYPE == "mssql" else "3306")
    DB_NAME = os.getenv("DB_NAME", "farmacia_couto")
    DB_USER = os.getenv("DB_USER", "")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server")
    DB_TRUSTED = os.getenv("DB_TRUSTED_CONNECTION", "yes").lower() in ("yes", "true", "1")

    if DB_TYPE == "mssql":
        # Conexão Microsoft SQL Server (SSMS)
        if DB_TRUSTED or not DB_USER:
            # Autenticação do Windows (Padrão SSMS)
            params = urllib.parse.quote_plus(
                f"DRIVER={{{DB_DRIVER}}};SERVER={DB_HOST};DATABASE={DB_NAME};Trusted_Connection=yes;TrustServerCertificate=yes;"
            )
        else:
            # Autenticação SQL Server (Usuário e Senha)
            params = urllib.parse.quote_plus(
                f"DRIVER={{{DB_DRIVER}}};SERVER={DB_HOST};DATABASE={DB_NAME};UID={DB_USER};PWD={DB_PASSWORD};TrustServerCertificate=yes;"
            )
        SQLALCHEMY_DATABASE_URI = f"mssql+pyodbc:///?odbc_connect={params}"
    else:
        # Conexão MySQL padrão
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- JWT ---
    # Sem valor padrão: um segredo conhecido permitiria forjar tokens.
    # A validação acontece em create_app().
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")

    # --- CORS ---
    # Origens (separadas por vírgula) autorizadas a chamar a API.
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]

    # Necessário para que os erros do flask-jwt-extended (token ausente,
    # expirado ou inválido) virem 401; sem isso o flask-restx responde 500
    # quando DEBUG está desligado.
    PROPAGATE_EXCEPTIONS = True

    # --- Ambiente ---
    DEBUG = os.getenv("FLASK_ENV", "development") == "development"
