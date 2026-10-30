"""Comandos de terminal: `flask --app run criar-admin` e `redefinir-senha`."""
import pytest

from app.models.usuario import Usuario
from tests.conftest import login


@pytest.fixture
def runner(app):
    return app.test_cli_runner()


def _rodar(runner, *args, entrada=None):
    return runner.invoke(args=list(args), input=entrada)


def test_cria_admin_com_senha_digitada_duas_vezes(runner, client):
    r = _rodar(runner, "criar-admin", "--nome", "Leandro Couto", "--email", "Leandro@Farmacia.com", entrada="segredo-forte\nsegredo-forte\n")
    assert r.exit_code == 0, r.output
    assert "Administrador criado" in r.output and "leandro@farmacia.com" in r.output
    assert "segredo-forte" not in r.output.replace("Repita a senha", "")          # a senha digitada não é repetida na tela

    token = client.post("/api/auth/login", json={"email": "leandro@farmacia.com", "senha": "segredo-forte"}).get_json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).get_json()
    assert me["perfil"] == "admin" and len(me["modulos"]) == 5


def test_senhas_diferentes_nao_criam_nada(runner, app):
    r = _rodar(runner, "criar-admin", "--nome", "Leandro Couto", "--email", "l@farmacia.com", entrada="uma-senha\noutra-senha\numa-senha\noutra-senha\n")
    assert r.exit_code != 0 or "Administrador criado" not in r.output
    with app.app_context():
        assert Usuario.query.count() == 0


def test_gerar_senha_mostra_uma_vez_e_ela_funciona(runner, client):
    r = _rodar(runner, "criar-admin", "--nome", "Leandro Couto", "--email", "l@farmacia.com", "--gerar-senha")
    assert r.exit_code == 0, r.output
    senha = r.output.split("depois): ")[-1].strip() if "depois): " in r.output else r.output.split(": ")[-1].strip()
    assert len(senha) >= 12
    assert client.post("/api/auth/login", json={"email": "l@farmacia.com", "senha": senha}).status_code == 200

    outra = _rodar(runner, "criar-admin", "--nome", "Outra Pessoa", "--email", "o@farmacia.com", "--gerar-senha").output.split(": ")[-1].strip()
    assert outra != senha                                                        # cada senha gerada é diferente


def test_senha_pela_variavel_de_ambiente(runner, client):
    r = runner.invoke(args=["criar-admin", "--nome", "Leandro Couto", "--email", "l@farmacia.com"], env={"ADMIN_SENHA": "via-ambiente"})
    assert r.exit_code == 0, r.output
    assert client.post("/api/auth/login", json={"email": "l@farmacia.com", "senha": "via-ambiente"}).status_code == 200


@pytest.mark.parametrize("args,trecho", [
    (["--nome", "Leandro Couto", "--email", "sem-arroba", "--senha", "segredo123"], "E-mail inválido"),
    (["--nome", "Le", "--email", "l@farmacia.com", "--senha", "segredo123"], "pelo menos 3"),
    (["--nome", "Leandro Couto", "--email", "l@farmacia.com", "--senha", "123"], "pelo menos 6"),
])
def test_dados_invalidos(runner, app, args, trecho):
    r = _rodar(runner, "criar-admin", *args)
    assert r.exit_code != 0
    assert trecho in r.output
    with app.app_context():
        assert Usuario.query.count() == 0


def test_email_repetido_orienta_a_usar_redefinir_senha(runner):
    _rodar(runner, "criar-admin", "--nome", "Leandro Couto", "--email", "l@farmacia.com", "--senha", "segredo123")
    r = _rodar(runner, "criar-admin", "--nome", "Leandro Couto", "--email", "L@farmacia.com", "--senha", "segredo123")
    assert r.exit_code != 0
    assert "redefinir-senha" in r.output


def test_redefinir_senha(runner, client):
    _rodar(runner, "criar-admin", "--nome", "Leandro Couto", "--email", "l@farmacia.com", "--senha", "senha-antiga")
    r = _rodar(runner, "redefinir-senha", "--email", "l@farmacia.com", "--senha", "senha-nova-123")
    assert r.exit_code == 0, r.output
    assert client.post("/api/auth/login", json={"email": "l@farmacia.com", "senha": "senha-antiga"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "l@farmacia.com", "senha": "senha-nova-123"}).status_code == 200


def test_redefinir_senha_de_quem_nao_existe(runner):
    r = _rodar(runner, "redefinir-senha", "--email", "ninguem@farmacia.com", "--senha", "senha-nova-123")
    assert r.exit_code != 0 and "Nenhum usuário" in r.output


def test_redefinir_nao_muda_perfil_nem_modulos(runner, client, app):
    _rodar(runner, "criar-admin", "--nome", "Leandro Couto", "--email", "l@farmacia.com", "--senha", "senha-antiga")
    _rodar(runner, "redefinir-senha", "--email", "l@farmacia.com", "--gerar-senha")
    with app.app_context():
        u = Usuario.query.filter_by(email="l@farmacia.com").one()
        assert u.perfil == "admin" and u.ativo
