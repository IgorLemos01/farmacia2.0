from tests.conftest import CLIENTE, criar_catalogo


def criar_cliente(client, auth, **extra):
    resp = client.post("/api/clientes", json={**CLIENTE, **extra}, headers=auth)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["cliente"]


def test_cadastrar_e_listar_com_busca(client, auth):
    criar_cliente(client, auth)
    resp = client.get("/api/clientes?q=maria", headers=auth)
    dados = resp.get_json()
    assert dados["total"] == 1
    assert dados["itens"][0]["nome"] == "Maria Souza"


def test_cpf_duplicado(client, auth):
    criar_cliente(client, auth)
    resp = client.post("/api/clientes", json=CLIENTE, headers=auth)
    assert resp.status_code == 400
    assert "CPF" in resp.get_json()["message"]


def test_data_invalida_no_cadastro_retorna_400(client, auth):
    resp = client.post("/api/clientes", json={**CLIENTE, "data_nascimento": "15/05/1990"}, headers=auth)
    assert resp.status_code == 400


def test_data_invalida_na_edicao_retorna_400_e_nao_500(client, auth):
    c = criar_cliente(client, auth)
    resp = client.put(f"/api/clientes/{c['id']}", json={"data_nascimento": "data-ruim"}, headers=auth)
    assert resp.status_code == 400
    assert "AAAA-MM-DD" in resp.get_json()["message"]


def test_editar_e_obter_cliente(client, auth):
    c = criar_cliente(client, auth)
    resp = client.put(f"/api/clientes/{c['id']}", json={"telefone": "(75) 98888-1111"}, headers=auth)
    assert resp.status_code == 200
    assert client.get(f"/api/clientes/{c['id']}", headers=auth).get_json()["telefone"] == "(75) 98888-1111"


def test_cliente_inexistente_404(client, auth):
    assert client.get("/api/clientes/999", headers=auth).status_code == 404


def test_nao_exclui_cliente_com_historico(client, auth):
    c = criar_cliente(client, auth)
    client.post("/api/receitas", json={"cliente_id": c["id"], "medico_prescritor": "Dr. X", "medicamentos": "Dipirona"}, headers=auth)
    assert client.delete(f"/api/clientes/{c['id']}", headers=auth).status_code == 400


def test_dossie_reune_historico(client, auth):
    c = criar_cliente(client, auth)
    client.post("/api/manipulacoes", json={"cliente_id": c["id"], "formula": "Minoxidil 5%", "valor": 50}, headers=auth)
    exame = criar_catalogo(client, auth, "Glicemia", 10)
    client.post("/api/exames", json={"cliente_id": c["id"], "catalogo_id": exame["id"]}, headers=auth)
    client.post("/api/receitas", json={"cliente_id": c["id"], "medico_prescritor": "Dr. X", "medicamentos": "Dipirona"}, headers=auth)

    dossie = client.get(f"/api/clientes/{c['id']}/dossie", headers=auth).get_json()
    h = dossie["historico"]
    assert (len(h["manipulacoes"]), len(h["exames"]), len(h["receitas"])) == (1, 1, 1)


def test_campos_opcionais_aceitam_null(client, auth):
    """O formulário envia null para alergia/observações vazias."""
    c = criar_cliente(client, auth, alergia=None, observacoes=None)
    assert c["alergia"] is None


def test_editar_cliente_com_campo_obrigatorio_vazio_retorna_400(client, auth):
    c = criar_cliente(client, auth)
    for campo in ("nome", "rg", "telefone", "email", "endereco"):
        for vazio in ("", None):
            resp = client.put(f"/api/clientes/{c['id']}", json={campo: vazio}, headers=auth)
            assert resp.status_code == 400, (campo, vazio)


def test_excluir_cliente_sem_historico(client, auth):
    c = criar_cliente(client, auth)
    assert client.delete(f"/api/clientes/{c['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/clientes/{c['id']}", headers=auth).status_code == 404
