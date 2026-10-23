import os
import urllib.parse
from dotenv import load_dotenv

load_dotenv()


class Config:
    # --- Tipo de Banco: 'mssql' (SQL Server) ou 'mysql' ---
    DB_TYPE = os.getenv("DB_TYPE", "mssql").lower()

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "1433" if DB_TYPE == "mssql" else "3306")
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
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "farmacia-couto-secret-key-2026")

    # --- Ambiente ---
    DEBUG = os.getenv("FLASK_ENV", "development") == "development"
