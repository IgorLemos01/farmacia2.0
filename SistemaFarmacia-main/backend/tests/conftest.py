import pytest

from app import create_app
from app.extensions import db


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


def cadastrar(client, email, perfil="atendente", token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post(
        "/api/auth/cadastro",
        json={"nome": "Usuário Teste", "email": email, "senha": "senha123", "perfil": perfil},
        headers=headers,
    )


def login(client, email):
    resp = client.post("/api/auth/login", json={"email": email, "senha": "senha123"})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()["access_token"]


@pytest.fixture
def admin_token(client):
    assert cadastrar(client, "admin@farmacia.com").status_code == 201
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
