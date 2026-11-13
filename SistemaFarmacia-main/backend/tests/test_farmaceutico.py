"""Farmacêutico responsável carregado do cadastro de usuários (nada fixo no código)."""
from tests.conftest import CLIENTE, criar_medicamento, login


def _usuario(client, auth, email, **extra):
    corpo = {"nome": "Usuário " + email.split("@")[0], "email": email, "senha": "senha123", "perfil": "funcionario",
             "modulos": ["receitas"], **extra}
    resp = client.post("/api/auth/cadastro", json=corpo, headers=auth)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["usuario"]


def _receita(client, headers, cliente_id, med_id, **extra):
    return client.post("/api/receitas", json={"cliente_id": cliente_id, "itens": [{"catalogo_id": med_id}], **extra}, headers=headers)


def _base(client, auth):
    cliente = client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]["id"]
    return cliente, criar_medicamento(client, auth)["id"]


def test_farmaceutico_exige_registro_profissional(client, auth):
    corpo = {"nome": "Sem CRF", "email": "x@f.com", "senha": "senha123", "perfil": "funcionario", "modulos": ["receitas"], "farmaceutico": True}
    resp = client.post("/api/auth/cadastro", json=corpo, headers=auth)
    assert resp.status_code == 400 and "CRF" in resp.get_json()["message"]

    u = _usuario(client, auth, "y@f.com")
    assert client.put(f"/api/usuarios/{u['id']}", json={"farmaceutico": True}, headers=auth).status_code == 400
    ok = client.put(f"/api/usuarios/{u['id']}", json={"farmaceutico": True, "registro_profissional": " crf-se  1234 ", "cargo": "Farmacêutica"}, headers=auth)
    assert ok.status_code == 200
    assert (ok.get_json()["usuario"]["registro_profissional"], ok.get_json()["usuario"]["farmaceutico"]) == ("CRF-SE 1234", True)


def test_sem_farmaceutico_cadastrado_receita_sai_em_branco(client, auth):
    cliente, med = _base(client, auth)
    r = _receita(client, auth, cliente, med)
    assert r.status_code == 201
    assert r.get_json()["receita"]["farmaceutico"] is None


def test_farmaceutico_logado_assina_a_propria_receita(client, auth):
    cliente, med = _base(client, auth)
    _usuario(client, auth, "outro@f.com", farmaceutico=True, registro_profissional="CRF-SE 1")
    _usuario(client, auth, "ana@f.com", farmaceutico=True, registro_profissional="CRF-SE 2", cargo="Farmacêutica Responsável")
    headers = {"Authorization": f"Bearer {login(client, 'ana@f.com')}"}
    f = _receita(client, headers, cliente, med).get_json()["receita"]["farmaceutico"]
    assert (f["nome"], f["registro_profissional"], f["cargo"]) == ("Usuário ana", "CRF-SE 2", "Farmacêutica Responsável")


def test_atendente_usa_o_unico_farmaceutico_ou_escolhe_entre_varios(client, auth):
    cliente, med = _base(client, auth)
    _usuario(client, auth, "atendente@f.com")
    rt = _usuario(client, auth, "rt@f.com", farmaceutico=True, registro_profissional="CRF-SE 10")
    atendente = {"Authorization": f"Bearer {login(client, 'atendente@f.com')}"}

    # um só farmacêutico: é o responsável técnico, carregado automaticamente
    assert _receita(client, atendente, cliente, med).get_json()["receita"]["farmaceutico"]["id"] == rt["id"]

    # dois farmacêuticos: precisa escolher
    outro = _usuario(client, auth, "plantao@f.com", farmaceutico=True, registro_profissional="CRF-SE 11")
    resp = _receita(client, atendente, cliente, med)
    assert resp.status_code == 400 and "farmacêutico" in resp.get_json()["message"]
    escolhido = _receita(client, atendente, cliente, med, farmaceutico_id=outro["id"]).get_json()["receita"]
    assert escolhido["farmaceutico"]["registro_profissional"] == "CRF-SE 11"

    # a lista para o dropdown
    lista = client.get("/api/usuarios/farmaceuticos", headers=atendente).get_json()["itens"]
    assert {u["registro_profissional"] for u in lista} == {"CRF-SE 10", "CRF-SE 11"}
    assert "email" not in lista[0]


def test_nao_aceita_farmaceutico_invalido_ou_desativado(client, auth):
    cliente, med = _base(client, auth)
    comum = _usuario(client, auth, "comum@f.com")
    f = _usuario(client, auth, "f@f.com", farmaceutico=True, registro_profissional="CRF-SE 3")
    assert _receita(client, auth, cliente, med, farmaceutico_id=comum["id"]).status_code == 400
    assert _receita(client, auth, cliente, med, farmaceutico_id=999).status_code == 400
    client.put(f"/api/usuarios/{f['id']}", json={"ativo": False}, headers=auth)
    assert _receita(client, auth, cliente, med, farmaceutico_id=f["id"]).status_code == 400


def test_receita_guarda_copia_do_farmaceutico(client, auth):
    cliente, med = _base(client, auth)
    f = _usuario(client, auth, "f@f.com", farmaceutico=True, registro_profissional="CRF-SE 3")
    receita = _receita(client, auth, cliente, med, farmaceutico_id=f["id"]).get_json()["receita"]

    client.put(f"/api/usuarios/{f['id']}", json={"registro_profissional": "CRF-SE 999", "nome": "Nome Novo"}, headers=auth)
    salva = client.get(f"/api/receitas/{receita['id']}", headers=auth).get_json()
    assert (salva["farmaceutico"]["nome"], salva["farmaceutico"]["registro_profissional"]) == ("Usuário f", "CRF-SE 3")

    # editar outros campos não troca o responsável
    editada = client.put(f"/api/receitas/{receita['id']}", json={"observacoes": "x"}, headers=auth).get_json()["receita"]
    assert editada["farmaceutico"]["registro_profissional"] == "CRF-SE 3"
