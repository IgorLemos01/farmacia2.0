import pytest

from app import create_app
from tests.conftest import cadastrar, login


def test_cadastro_sem_login_e_recusado_mesmo_com_banco_vazio(client):
    """Antes, quem chegasse primeiro criava o administrador. Agora o primeiro admin vem do comando de terminal."""
    resp = cadastrar(client, "primeiro@farmacia.com", perfil="admin")
    assert resp.status_code == 401
    assert client.get("/api/usuarios").status_code == 401


def test_cadastro_sem_token_bloqueado_apos_primeiro_usuario(client, admin_token):
    resp = cadastrar(client, "intruso@farmacia.com", perfil="admin")
    assert resp.status_code == 401


def test_funcionario_nao_pode_cadastrar_usuarios(client, admin_token):
    assert cadastrar(client, "funcionario@farmacia.com", token=admin_token).status_code == 201
    token_funcionario = login(client, "funcionario@farmacia.com")

    resp = cadastrar(client, "outro@farmacia.com", perfil="admin", token=token_funcionario)
    assert resp.status_code == 403


def test_admin_cadastra_funcionario_e_admin(client, admin_token):
    r1 = cadastrar(client, "a1@farmacia.com", perfil="funcionario", token=admin_token)
    r2 = cadastrar(client, "a2@farmacia.com", perfil="admin", token=admin_token)
    assert r1.get_json()["usuario"]["perfil"] == "funcionario"
    assert r2.get_json()["usuario"]["perfil"] == "admin"


def test_login_senha_errada(client, admin_token):
    resp = client.post("/api/auth/login", json={"email": "admin@farmacia.com", "senha": "errada1"})
    assert resp.status_code == 401


def test_me_retorna_usuario_logado(client, auth):
    resp = client.get("/api/auth/me", headers=auth)
    assert resp.status_code == 200
    assert resp.get_json()["email"] == "admin@farmacia.com"


def test_rotas_de_dados_exigem_token(client):
    for rota in ("/api/clientes", "/api/manipulacoes", "/api/exames", "/api/receitas"):
        assert client.get(rota).status_code == 401


def test_producao_sem_jwt_secret_nao_sobe():
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        create_app({"DEBUG": False, "JWT_SECRET_KEY": "", "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})


def test_desenvolvimento_sem_jwt_secret_gera_segredo_temporario():
    app = create_app({"DEBUG": True, "JWT_SECRET_KEY": "", "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    assert len(app.config["JWT_SECRET_KEY"]) >= 32


def test_cors_so_libera_origens_configuradas(client):
    ok = client.options("/api/auth/login", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"

    bloqueado = client.options("/api/auth/login", headers={"Origin": "https://site-malicioso.com", "Access-Control-Request-Method": "POST"})
    assert "Access-Control-Allow-Origin" not in bloqueado.headers


def test_token_invalido_retorna_401(client, admin_token):
    for token in ("lixo", admin_token[:-4] + "abcd"):
        resp = client.get("/api/clientes", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401


def test_em_producao_token_invalido_retorna_401_e_nao_500():
    """Sem PROPAGATE_EXCEPTIONS, o flask-restx transforma erros de JWT em 500."""
    app = create_app({
        "DEBUG": False,
        "TESTING": False,
        "JWT_SECRET_KEY": "segredo-de-teste-com-tamanho-suficiente-123",
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    client = app.test_client()
    assert client.get("/api/clientes", headers={"Authorization": "Bearer lixo"}).status_code == 401
    assert client.get("/api/clientes").status_code == 401
