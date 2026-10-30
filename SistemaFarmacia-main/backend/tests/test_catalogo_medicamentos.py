import pytest

from tests.conftest import cadastrar, criar_medicamento, login


@pytest.fixture
def auth_funcionario(client, admin_token):
    cadastrar(client, "funcionario@farmacia.com", token=admin_token)
    return {"Authorization": f"Bearer {login(client, 'funcionario@farmacia.com')}"}


def _post(client, auth, **corpo):
    return client.post("/api/catalogo-medicamentos", json=corpo, headers=auth)


# ───────────── permissões ─────────────
def test_exige_login(client):
    assert client.get("/api/catalogo-medicamentos").status_code == 401


def test_funcionario_consulta_mas_nao_altera(client, auth, auth_funcionario):
    med = criar_medicamento(client, auth)
    lista = client.get("/api/catalogo-medicamentos?ativos=true", headers=auth_funcionario)
    assert lista.status_code == 200 and len(lista.get_json()["itens"]) == 1

    assert _post(client, auth_funcionario, descricao="Novo", rms="1").status_code == 403
    assert client.put(f"/api/catalogo-medicamentos/{med['id']}", json={"laboratorio": "X"}, headers=auth_funcionario).status_code == 403
    assert client.post("/api/catalogo-medicamentos/importar", json={"itens": [{"descricao": "X"}]}, headers=auth_funcionario).status_code == 403


# ───────────── cadastro e edição ─────────────
def test_cadastrar_normaliza_espacos(client, auth):
    med = criar_medicamento(client, auth, "  ALPRAZOLAM   0,25 MG   30 CPRS  ", " 1023506630034 ", "EMS   LTDA ")
    assert med["descricao"] == "ALPRAZOLAM 0,25 MG 30 CPRS"
    assert med["rms"] == "1023506630034"
    assert med["laboratorio"] == "EMS LTDA"
    assert med["ativo"] is True


def test_laboratorio_e_rms_opcionais_e_rms_so_aceita_texto(client, auth):
    resp = _post(client, auth, descricao="SEM LAB", rms="1023506630034")
    assert resp.status_code == 201
    assert resp.get_json()["medicamento"]["laboratorio"] is None
    assert _post(client, auth, descricao="SEM RMS").get_json()["medicamento"]["rms"] == ""
    # RMS é identificador, não número: como número perderia zeros à esquerda, a API exige texto
    assert _post(client, auth, descricao="RMS NUMERO", rms=1023506630034).status_code == 400


def test_descricao_obrigatoria(client, auth):
    for descricao in ("", "   "):
        assert _post(client, auth, descricao=descricao, rms="1").status_code == 400


def test_rms_em_notacao_cientifica_e_recusado(client, auth):
    resp = _post(client, auth, descricao="Estragado pelo Excel", rms="1,02351E+12")
    assert resp.status_code == 400
    assert "notação científica" in resp.get_json()["message"]


def test_mesmo_rms_e_descricao_nao_repete_mas_rms_igual_com_outra_descricao_pode(client, auth):
    criar_medicamento(client, auth, "AMOXICILINA 500 MG", "111")
    assert _post(client, auth, descricao="amoxicilina  500 mg", rms="111").status_code == 400   # mesma coisa
    assert _post(client, auth, descricao="AMOXICILINA 250 MG", rms="111").status_code == 201    # outra apresentação
    assert _post(client, auth, descricao="AMOXICILINA 500 MG", rms="222").status_code == 201    # outro RMS


def test_editar_e_nao_roubar_a_identidade_de_outro(client, auth):
    a = criar_medicamento(client, auth, "AAA", "1", "Lab A")
    b = criar_medicamento(client, auth, "BBB", "2", "Lab B")
    ok = client.put(f"/api/catalogo-medicamentos/{b['id']}", json={"laboratorio": "Lab Novo", "descricao": "BBB 10 MG"}, headers=auth)
    assert ok.status_code == 200 and ok.get_json()["medicamento"]["laboratorio"] == "Lab Novo"

    conflito = client.put(f"/api/catalogo-medicamentos/{b['id']}", json={"rms": "1", "descricao": "aaa"}, headers=auth)
    assert conflito.status_code == 400
    assert client.put("/api/catalogo-medicamentos/999", json={"laboratorio": "X"}, headers=auth).status_code == 404
    assert a["id"] != b["id"]


def test_validacao_nao_altera_parcialmente(client, auth):
    med = criar_medicamento(client, auth)
    resp = client.put(f"/api/catalogo-medicamentos/{med['id']}", json={"laboratorio": "Novo Lab", "ativo": "nao"}, headers=auth)
    assert resp.status_code == 400
    atual = client.get("/api/catalogo-medicamentos", headers=auth).get_json()["itens"][0]
    assert atual["laboratorio"] == "EMS INDUSTRIA FARMACEUTICA LTDA"


# ───────────── desativar / reativar ─────────────
def test_desativar_some_da_lista_de_escolha_e_pode_reativar(client, auth):
    med = criar_medicamento(client, auth)
    client.put(f"/api/catalogo-medicamentos/{med['id']}", json={"ativo": False}, headers=auth)

    assert client.get("/api/catalogo-medicamentos?ativos=true", headers=auth).get_json()["itens"] == []
    assert len(client.get("/api/catalogo-medicamentos", headers=auth).get_json()["itens"]) == 1

    repetido = _post(client, auth, descricao=med["descricao"], rms=med["rms"])
    assert repetido.status_code == 400 and "desativado" in repetido.get_json()["message"]

    client.put(f"/api/catalogo-medicamentos/{med['id']}", json={"ativo": True}, headers=auth)
    assert len(client.get("/api/catalogo-medicamentos?ativos=true", headers=auth).get_json()["itens"]) == 1


# ───────────── importação ─────────────
def test_importar_cria_atualiza_e_relata_problemas(client, auth):
    criar_medicamento(client, auth, "ALPRAZOLAM 0,25 MG", "1", "Lab Antigo")
    igual = criar_medicamento(client, auth, "CLONAZEPAM 2 MG", "2", "Lab Igual")
    inativo = criar_medicamento(client, auth, "ANTIGO", "3", "Lab X")
    client.put(f"/api/catalogo-medicamentos/{inativo['id']}", json={"ativo": False}, headers=auth)

    resp = client.post("/api/catalogo-medicamentos/importar", json={"itens": [
        {"rms": "9", "descricao": "NOVO 10 MG", "laboratorio": "Lab Novo", "linha": 2},     # novo
        {"rms": "1", "descricao": "alprazolam 0,25 mg", "laboratorio": "Lab Atual", "linha": 3},  # existe → atualiza lab
        {"rms": "2", "descricao": "CLONAZEPAM 2 MG", "laboratorio": "Lab Igual", "linha": 4},     # idêntico
        {"rms": "3", "descricao": "ANTIGO", "laboratorio": "Lab X", "linha": 5},                  # desativado → reativa
        {"rms": "5", "descricao": "", "laboratorio": "L", "linha": 6},                            # sem descrição
        {"rms": "1,02E+12", "descricao": "EXCEL ESTRAGOU", "linha": 7},                           # notação científica
        {"rms": "9", "descricao": "NOVO 10 MG", "laboratorio": "Outro", "linha": 8},              # repetido no arquivo
    ]}, headers=auth)

    assert resp.status_code == 200, resp.get_json()
    r = resp.get_json()
    assert (r["criados"], r["atualizados"], r["iguais"]) == (1, 2, 1)
    assert sorted(e["linha"] for e in r["erros"]) == [6, 7, 8]
    assert "notação científica" in next(e for e in r["erros"] if e["linha"] == 7)["motivo"]

    itens = {i["descricao"]: i for i in client.get("/api/catalogo-medicamentos", headers=auth).get_json()["itens"]}
    assert itens["ALPRAZOLAM 0,25 MG"]["laboratorio"] == "Lab Atual"   # mantém a grafia original
    assert itens["ANTIGO"]["ativo"] is True
    assert itens["NOVO 10 MG"]["laboratorio"] == "Lab Novo"            # o repetido não sobrescreveu
    assert igual["id"] == itens["CLONAZEPAM 2 MG"]["id"]


def test_importar_limites(client, auth):
    assert client.post("/api/catalogo-medicamentos/importar", json={"itens": []}, headers=auth).status_code == 400
    muitos = [{"descricao": f"MED {i}", "rms": str(i)} for i in range(1001)]
    assert client.post("/api/catalogo-medicamentos/importar", json={"itens": muitos}, headers=auth).status_code == 400
    assert client.post("/api/catalogo-medicamentos/importar", json={}, headers=auth).status_code == 400
    assert client.post("/api/catalogo-medicamentos/importar", json={"itens": ["x", 5]}, headers=auth).status_code == 400


def test_importar_o_csv_real_inteiro_nao_perde_nenhum(client, auth):
    """Os 13 dígitos do RMS não podem virar número (perderia zeros/precisão) e todos devem entrar."""
    itens = [{"rms": str(1023506630000 + i), "descricao": f"MEDICAMENTO {i}", "laboratorio": f"LAB {i % 5}"} for i in range(123)]
    r = client.post("/api/catalogo-medicamentos/importar", json={"itens": itens}, headers=auth).get_json()
    assert (r["criados"], r["erros"]) == (123, [])
    salvos = client.get("/api/catalogo-medicamentos", headers=auth).get_json()["itens"]
    assert len(salvos) == 123 and all(len(m["rms"]) == 13 for m in salvos)
