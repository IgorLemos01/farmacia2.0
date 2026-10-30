import pytest

from app import create_app
from app.extensions import db
from app.modulos import MODULOS
from app.services.auth_service import AuthService


@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "segredo-de-teste-com-tamanho-suficiente-123",
    })
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def cadastrar(client, email, perfil="funcionario", token=None, modulos=None):
    """Cria um usuário pela API. Funcionário sem `modulos` informados recebe todos os módulos."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    corpo = {"nome": "Usuário Teste", "email": email, "senha": "senha123", "perfil": perfil}
    if modulos is not None:
        corpo["modulos"] = modulos
    elif perfil == "funcionario":
        corpo["modulos"] = list(MODULOS)
    return client.post("/api/auth/cadastro", json=corpo, headers=headers)


def login(client, email):
    resp = client.post("/api/auth/login", json={"email": email, "senha": "senha123"})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()["access_token"]


@pytest.fixture
def admin_token(client, app):
    # O cadastro pela API exige um admin logado; o primeiro admin nasce direto no banco
    # (em produção, pelo comando `flask --app run criar-admin`).
    with app.app_context():
        AuthService.cadastrar("Usuário Teste", "admin@farmacia.com", "senha123", "admin")
    return login(client, "admin@farmacia.com")


@pytest.fixture
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


CLIENTE = {
    "nome": "Maria Souza",
    "cpf": "111.222.333-44",
    "rg": "1.234.567",
    "data_nascimento": "1990-05-15",
    "sexo": "F",
    "telefone": "(75) 99999-0000",
    "email": "maria@email.com",
    "endereco": "Rua A, 1",
}


def criar_catalogo(client, auth, nome="Glicemia", valor=10.0):
    """Cadastra um exame no catálogo (como admin) e devolve o registro."""
    resp = client.post("/api/catalogo-exames", json={"nome": nome, "valor": valor}, headers=auth)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["exame"]


def criar_medicamento(client, auth, descricao="ALPRAZOLAM 0,25 MG 30 CPRS", rms="1023506630034", laboratorio="EMS INDUSTRIA FARMACEUTICA LTDA"):
    """Cadastra um medicamento no catálogo (como admin) e devolve o registro."""
    resp = client.post(
        "/api/catalogo-medicamentos",
        json={"descricao": descricao, "rms": rms, "laboratorio": laboratorio},
        headers=auth,
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["medicamento"]
