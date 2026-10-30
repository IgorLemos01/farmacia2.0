"""Escolha de perfil (funcionário/administrador) e de módulos ao criar e editar usuários."""
import pytest

from tests.conftest import cadastrar

TODOS = ["dashboard", "clientes", "manipulacoes", "exames", "receitas"]


def _usuario(client, auth, email):
    return next(u for u in client.get("/api/usuarios", headers=auth).get_json()["itens"] if u["email"] == email)


# ───────────── criar ─────────────
def test_cria_funcionario_com_modulos_escolhidos(client, admin_token):
    resp = cadastrar(client, "ana@farmacia.com", token=admin_token, modulos=["receitas", "clientes", "clientes"])
    assert resp.status_code == 201
    u = resp.get_json()["usuario"]
    assert (u["perfil"], u["modulos"]) == ("funcionario", ["clientes", "receitas"])  # sem repetidos, ordem padrão


def test_funcionario_precisa_de_pelo_menos_um_modulo(client, admin_token):
    for modulos in ([], None):
        corpo = {"nome": "Ana Silva", "email": "ana@farmacia.com", "senha": "senha123", "perfil": "funcionario"}
        if modulos is not None:
            corpo["modulos"] = modulos
        resp = client.post("/api/auth/cadastro", json=corpo, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 400, modulos
        assert "ao menos um módulo" in resp.get_json()["message"]


@pytest.mark.parametrize("modulos", [["financeiro"], ["clientes", 5], "clientes", [None], ["CLIENTES"], ["configuracoes"]])
def test_modulo_invalido_e_recusado(client, admin_token, modulos):
    resp = client.post("/api/auth/cadastro", json={
        "nome": "Ana Silva", "email": "ana@farmacia.com", "senha": "senha123", "perfil": "funcionario", "modulos": modulos,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400


def test_admin_sempre_recebe_todos_os_modulos_mesmo_pedindo_menos(client, admin_token):
    u = cadastrar(client, "chefe@farmacia.com", perfil="admin", token=admin_token, modulos=["receitas"]).get_json()["usuario"]
    assert u["modulos"] == TODOS


@pytest.mark.parametrize("perfil", ["dono", "atendente", "ADMIN", ""])     # "atendente" era o nome antigo do perfil
def test_perfil_desconhecido_e_recusado_e_nada_e_gravado(client, auth, admin_token, perfil):
    base = {"nome": "Ana Silva", "email": "ana@farmacia.com", "senha": "senha123", "modulos": ["clientes"]}
    resp = client.post("/api/auth/cadastro", json={**base, "perfil": perfil}, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400
    assert "perfil" in resp.get_json().get("errors", {})            # a API aponta o campo errado
    assert all(u["email"] != "ana@farmacia.com" for u in client.get("/api/usuarios", headers=auth).get_json()["itens"])


@pytest.mark.parametrize("corpo,trecho", [
    ({"email": "sem-arroba"}, "E-mail inválido"),
    ({"email": "a@b"}, "E-mail inválido"),
    ({"nome": "ab"}, "pelo menos 3"),
    ({"senha": "123"}, "pelo menos 6"),
])
def test_validacoes_do_cadastro(client, admin_token, corpo, trecho):
    base = {"nome": "Ana Silva", "email": "ana@farmacia.com", "senha": "senha123", "perfil": "funcionario", "modulos": ["clientes"]}
    resp = client.post("/api/auth/cadastro", json={**base, **corpo}, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400
    assert trecho in resp.get_json()["message"]


def test_email_repetido_continua_409_e_ignora_maiusculas(client, admin_token):
    assert cadastrar(client, "ana@farmacia.com", token=admin_token).status_code == 201
    assert cadastrar(client, "ANA@Farmacia.com ", token=admin_token).status_code == 409


def test_login_ignora_maiusculas_e_espacos_no_email(client, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token)
    resp = client.post("/api/auth/login", json={"email": "  ANA@farmacia.com ", "senha": "senha123"})
    assert resp.status_code == 200


# ───────────── editar ─────────────
def test_editar_modulos_do_funcionario(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token, modulos=["clientes"])
    uid = _usuario(client, auth, "ana@farmacia.com")["id"]
    r = client.put(f"/api/usuarios/{uid}", json={"modulos": ["exames", "dashboard"]}, headers=auth)
    assert r.status_code == 200
    assert r.get_json()["usuario"]["modulos"] == ["dashboard", "exames"]


def test_editar_outro_campo_nao_mexe_nos_modulos(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token, modulos=["clientes", "receitas"])
    uid = _usuario(client, auth, "ana@farmacia.com")["id"]
    client.put(f"/api/usuarios/{uid}", json={"nome": "Ana Maria"}, headers=auth)
    assert _usuario(client, auth, "ana@farmacia.com")["modulos"] == ["clientes", "receitas"]


@pytest.mark.parametrize("corpo", [{"modulos": []}, {"modulos": ["financeiro"]}, {"modulos": "clientes"}])
def test_editar_com_modulos_invalidos(client, auth, admin_token, corpo):
    cadastrar(client, "ana@farmacia.com", token=admin_token, modulos=["clientes"])
    uid = _usuario(client, auth, "ana@farmacia.com")["id"]
    assert client.put(f"/api/usuarios/{uid}", json=corpo, headers=auth).status_code == 400
    assert _usuario(client, auth, "ana@farmacia.com")["modulos"] == ["clientes"]      # nada mudou


def test_promover_e_rebaixar(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token, modulos=["receitas"])
    uid = _usuario(client, auth, "ana@farmacia.com")["id"]

    promovida = client.put(f"/api/usuarios/{uid}", json={"perfil": "admin"}, headers=auth).get_json()["usuario"]
    assert (promovida["perfil"], promovida["modulos"]) == ("admin", TODOS)

    # rebaixar sem dizer os módulos mantém todos (o que ela já acessava); com lista, usa a lista
    mantida = client.put(f"/api/usuarios/{uid}", json={"perfil": "funcionario"}, headers=auth).get_json()["usuario"]
    assert (mantida["perfil"], mantida["modulos"]) == ("funcionario", TODOS)
    escolhida = client.put(f"/api/usuarios/{uid}", json={"perfil": "funcionario", "modulos": ["clientes"]}, headers=auth).get_json()["usuario"]
    assert escolhida["modulos"] == ["clientes"]


def test_rebaixar_exigindo_modulo_vazio_e_recusado(client, auth, admin_token):
    cadastrar(client, "chefe@farmacia.com", perfil="admin", token=admin_token)
    uid = _usuario(client, auth, "chefe@farmacia.com")["id"]
    resp = client.put(f"/api/usuarios/{uid}", json={"perfil": "funcionario", "modulos": []}, headers=auth)
    assert resp.status_code == 400
    assert _usuario(client, auth, "chefe@farmacia.com")["perfil"] == "admin"


def test_admin_nao_pode_se_rebaixar_nem_mudar_os_proprios_modulos(client, auth):
    meu = client.get("/api/auth/me", headers=auth).get_json()
    assert client.put(f"/api/usuarios/{meu['id']}", json={"perfil": "funcionario", "modulos": ["clientes"]}, headers=auth).status_code == 400
    # enviar módulos sendo admin é inofensivo: continua com todos
    r = client.put(f"/api/usuarios/{meu['id']}", json={"modulos": ["clientes"]}, headers=auth)
    assert r.status_code == 200 and r.get_json()["usuario"]["modulos"] == TODOS


def test_lista_de_usuarios_mostra_perfil_e_modulos(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token, modulos=["exames"])
    itens = {u["email"]: u for u in client.get("/api/usuarios", headers=auth).get_json()["itens"]}
    assert itens["ana@farmacia.com"]["modulos"] == ["exames"]
    assert itens["admin@farmacia.com"]["modulos"] == TODOS
