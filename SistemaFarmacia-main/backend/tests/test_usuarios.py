from tests.conftest import cadastrar, login


def _id_por_email(client, auth, email):
    itens = client.get("/api/usuarios", headers=auth).get_json()["itens"]
    return next(u["id"] for u in itens if u["email"] == email)


def _cabecalho(token):
    return {"Authorization": f"Bearer {token}"}


def test_listar_exige_admin(client, auth, admin_token):
    assert client.get("/api/usuarios").status_code == 401

    cadastrar(client, "funcionario@farmacia.com", token=admin_token)
    funcionario = _cabecalho(login(client, "funcionario@farmacia.com"))
    assert client.get("/api/usuarios", headers=funcionario).status_code == 403

    resp = client.get("/api/usuarios", headers=auth)
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.get_json()["itens"]]
    assert set(emails) == {"admin@farmacia.com", "funcionario@farmacia.com"}
    assert "senha_hash" not in resp.get_json()["itens"][0]


def test_admin_altera_nome_e_perfil(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token)
    uid = _id_por_email(client, auth, "ana@farmacia.com")

    resp = client.put(f"/api/usuarios/{uid}", json={"nome": "Ana Paula", "perfil": "admin"}, headers=auth)
    assert resp.status_code == 200
    usuario = resp.get_json()["usuario"]
    assert (usuario["nome"], usuario["perfil"]) == ("Ana Paula", "admin")


def test_redefinir_senha(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token)
    uid = _id_por_email(client, auth, "ana@farmacia.com")

    assert client.put(f"/api/usuarios/{uid}", json={"senha": "novasenha1"}, headers=auth).status_code == 200
    assert client.post("/api/auth/login", json={"email": "ana@farmacia.com", "senha": "senha123"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "ana@farmacia.com", "senha": "novasenha1"}).status_code == 200


def test_senha_vazia_na_edicao_mantem_a_atual(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token)
    uid = _id_por_email(client, auth, "ana@farmacia.com")
    assert client.put(f"/api/usuarios/{uid}", json={"nome": "Ana Maria", "senha": ""}, headers=auth).status_code == 200
    login(client, "ana@farmacia.com")


def test_validacoes(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token)
    uid = _id_por_email(client, auth, "ana@farmacia.com")
    for corpo in ({"nome": "ab"}, {"perfil": "dono"}, {"senha": "123"}, {"ativo": "sim"}):
        assert client.put(f"/api/usuarios/{uid}", json=corpo, headers=auth).status_code == 400, corpo
    assert client.put("/api/usuarios/999", json={"nome": "Fulano"}, headers=auth).status_code == 404


def test_validacao_nao_altera_nada_parcialmente(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token)
    uid = _id_por_email(client, auth, "ana@farmacia.com")
    client.put(f"/api/usuarios/{uid}", json={"nome": "Nome Novo", "perfil": "invalido"}, headers=auth)
    itens = client.get("/api/usuarios", headers=auth).get_json()["itens"]
    assert next(u for u in itens if u["id"] == uid)["nome"] == "Usuário Teste"


def test_admin_nao_pode_rebaixar_nem_desativar_a_si_mesmo(client, auth):
    meu_id = client.get("/api/auth/me", headers=auth).get_json()["id"]
    assert client.put(f"/api/usuarios/{meu_id}", json={"perfil": "funcionario"}, headers=auth).status_code == 400
    assert client.put(f"/api/usuarios/{meu_id}", json={"ativo": False}, headers=auth).status_code == 400
    assert client.put(f"/api/usuarios/{meu_id}", json={"nome": "Meu Novo Nome"}, headers=auth).status_code == 200


def test_usuario_desativado_perde_acesso_na_hora(client, auth, admin_token):
    cadastrar(client, "ana@farmacia.com", token=admin_token)
    token_ana = login(client, "ana@farmacia.com")
    assert client.get("/api/clientes", headers=_cabecalho(token_ana)).status_code == 200

    uid = _id_por_email(client, auth, "ana@farmacia.com")
    assert client.put(f"/api/usuarios/{uid}", json={"ativo": False}, headers=auth).status_code == 200

    # token que ainda estava dentro do prazo
    resp = client.get("/api/clientes", headers=_cabecalho(token_ana))
    assert resp.status_code == 401
    assert "desativado" in resp.get_json()["msg"]
    # e não consegue entrar de novo
    assert client.post("/api/auth/login", json={"email": "ana@farmacia.com", "senha": "senha123"}).status_code == 401

    # reativar devolve o acesso
    client.put(f"/api/usuarios/{uid}", json={"ativo": True}, headers=auth)
    assert client.get("/api/clientes", headers=_cabecalho(token_ana)).status_code == 200


def test_admin_rebaixado_perde_poder_mesmo_com_token_antigo(client, auth, admin_token):
    cadastrar(client, "segundo@farmacia.com", perfil="admin", token=admin_token)
    token_segundo = login(client, "segundo@farmacia.com")
    uid = _id_por_email(client, auth, "segundo@farmacia.com")

    client.put(f"/api/usuarios/{uid}", json={"perfil": "funcionario"}, headers=auth)

    antigo = _cabecalho(token_segundo)  # o token ainda diz "admin"
    assert client.get("/api/usuarios", headers=antigo).status_code == 403
    assert cadastrar(client, "novo@farmacia.com", token=token_segundo).status_code == 403
