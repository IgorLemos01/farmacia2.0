import pytest

from tests.conftest import CLIENTE, criar_medicamento


@pytest.fixture
def cliente_id(client, auth):
    return client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]["id"]


@pytest.fixture
def alprazolam(client, auth):
    return criar_medicamento(client, auth, "ALPRAZOLAM 0,25 MG 30 CPRS", "1023506630034", "EMS INDUSTRIA FARMACEUTICA LTDA")


@pytest.fixture
def amoxicilina(client, auth):
    return criar_medicamento(client, auth, "AMOXICILINA 500 MG CX 21 COMP.", "1256801470025", "PRATI,DONADUZZI &CIA LTDA")


def _criar(client, auth, cliente_id, itens, **extra):
    return client.post("/api/receitas", json={"cliente_id": cliente_id, "itens": itens, **extra}, headers=auth)


# ───────────── cadastro ─────────────
def test_cadastra_receita_com_varios_medicamentos(client, auth, cliente_id, alprazolam, amoxicilina):
    resp = _criar(client, auth, cliente_id, [
        {"catalogo_id": alprazolam["id"], "dose": "0,25 mg", "posologia": "1 cp à noite", "lote": "4Q6312", "validade": "02/2027", "quantidade": 2},
        {"catalogo_id": amoxicilina["id"], "quantidade": "1"},
    ], data_venda="2026-10-30", medico_prescritor="Dr. Carlos (CRM-SE 123)", observacoes="Tomar com água")

    assert resp.status_code == 201, resp.get_json()
    r = resp.get_json()["receita"]
    assert r["cliente_nome"] == "Maria Souza"
    assert (r["data_venda"], r["medico_prescritor"], r["observacoes"]) == ("2026-10-30", "Dr. Carlos (CRM-SE 123)", "Tomar com água")
    assert len(r["itens"]) == 2

    primeiro, segundo = r["itens"]
    # RMS, descrição e laboratório vêm do catálogo
    assert primeiro["medicamento"] == "ALPRAZOLAM 0,25 MG 30 CPRS"
    assert (primeiro["rms"], primeiro["laboratorio"]) == ("1023506630034", "EMS INDUSTRIA FARMACEUTICA LTDA")
    assert (primeiro["dose"], primeiro["posologia"], primeiro["lote"], primeiro["validade"], primeiro["quantidade"]) == ("0,25 mg", "1 cp à noite", "4Q6312", "02/2027", 2)
    assert segundo["medicamento"] == "AMOXICILINA 500 MG CX 21 COMP." and segundo["quantidade"] == 1
    assert r["medicamentos"] == "ALPRAZOLAM 0,25 MG 30 CPRS; AMOXICILINA 500 MG CX 21 COMP."


def test_medico_e_observacoes_sao_opcionais(client, auth, cliente_id, alprazolam):
    r = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}], medico_prescritor=None, observacoes="").get_json()["receita"]
    assert r["medico_prescritor"] is None and r["observacoes"] is None
    assert r["itens"][0]["lote"] is None and r["itens"][0]["quantidade"] is None


def test_exige_ao_menos_um_medicamento(client, auth, cliente_id):
    for itens in ([], None):
        resp = client.post("/api/receitas", json={"cliente_id": cliente_id, "itens": itens}, headers=auth)
        assert resp.status_code == 400


def test_limite_de_medicamentos_por_receita(client, auth, cliente_id, alprazolam):
    item = {"catalogo_id": alprazolam["id"]}
    assert _criar(client, auth, cliente_id, [item] * 12).status_code == 201
    resp = _criar(client, auth, cliente_id, [item] * 13)
    assert resp.status_code == 400 and "no máximo 12" in resp.get_json()["message"]


@pytest.mark.parametrize("item", [
    {"dose": "sem catálogo"},                      # fora do catálogo (texto livre)
    {"medicamento": "DIGITADO À MÃO", "rms": "1"}, # idem
    {"catalogo_id": 999},                          # não existe
    {"catalogo_id": "1"},                          # tipo errado
    {"catalogo_id": True},
    {"id": 123},                                   # id de item que não é desta receita
])
def test_nao_aceita_medicamento_fora_do_catalogo(client, auth, cliente_id, alprazolam, item):
    resp = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}, item])
    assert resp.status_code == 400
    assert "Medicamento 2" in resp.get_json()["message"]            # diz qual linha
    assert client.get("/api/receitas", headers=auth).get_json()["total"] == 0  # nada foi gravado


def test_nao_aceita_medicamento_desativado(client, auth, cliente_id, alprazolam):
    client.put(f"/api/catalogo-medicamentos/{alprazolam['id']}", json={"ativo": False}, headers=auth)
    assert _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}]).status_code == 400


@pytest.mark.parametrize("campo,valor", [
    ("quantidade", 0), ("quantidade", -1), ("quantidade", "abc"), ("quantidade", 1.5), ("quantidade", True), ("quantidade", 10000),
    ("dose", "x" * 61), ("posologia", "x" * 201), ("lote", "x" * 61), ("validade", "x" * 21), ("dose", 5),
])
def test_valida_campos_do_item(client, auth, cliente_id, alprazolam, campo, valor):
    resp = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"], campo: valor}])
    assert resp.status_code == 400, (campo, valor)


def test_data_invalida_e_cliente_inexistente(client, auth, cliente_id, alprazolam):
    item = [{"catalogo_id": alprazolam["id"]}]
    resp = _criar(client, auth, cliente_id, item, data_venda="30/10/2026")
    assert resp.status_code == 400 and "AAAA-MM-DD" in resp.get_json()["message"]
    assert client.post("/api/receitas", json={"cliente_id": 999, "itens": item}, headers=auth).status_code == 400


# ───────────── o catálogo não altera receitas já emitidas ─────────────
def test_receita_guarda_copia_do_catalogo(client, auth, cliente_id, alprazolam):
    receita = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}]).get_json()["receita"]

    client.put(f"/api/catalogo-medicamentos/{alprazolam['id']}", json={"descricao": "ALPRAZOLAM 0,5 MG", "rms": "999", "laboratorio": "OUTRO LAB"}, headers=auth)
    client.put(f"/api/catalogo-medicamentos/{alprazolam['id']}", json={"ativo": False}, headers=auth)

    item = client.get(f"/api/receitas/{receita['id']}", headers=auth).get_json()["itens"][0]
    assert (item["medicamento"], item["rms"], item["laboratorio"]) == ("ALPRAZOLAM 0,25 MG 30 CPRS", "1023506630034", "EMS INDUSTRIA FARMACEUTICA LTDA")


# ───────────── edição ─────────────
def test_editar_cabecalho_sem_mexer_nos_itens(client, auth, cliente_id, alprazolam):
    receita = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"], "lote": "L1"}], medico_prescritor="Dr. A").get_json()["receita"]
    resp = client.put(f"/api/receitas/{receita['id']}", json={"medico_prescritor": "", "observacoes": "Nova obs", "data_venda": "2026-11-02"}, headers=auth)
    assert resp.status_code == 200
    r = resp.get_json()["receita"]
    assert (r["medico_prescritor"], r["observacoes"], r["data_venda"]) == (None, "Nova obs", "2026-11-02")
    assert [i["lote"] for i in r["itens"]] == ["L1"]


def test_editar_itens_mantem_copia_antiga_adiciona_e_remove(client, auth, cliente_id, alprazolam, amoxicilina):
    receita = _criar(client, auth, cliente_id, [
        {"catalogo_id": alprazolam["id"], "lote": "L1"},
        {"catalogo_id": amoxicilina["id"], "lote": "L2"},
    ]).get_json()["receita"]
    id_alpra = receita["itens"][0]["id"]

    # o catálogo muda depois da receita emitida
    client.put(f"/api/catalogo-medicamentos/{alprazolam['id']}", json={"descricao": "ALPRAZOLAM RENOMEADO"}, headers=auth)
    novo = criar_medicamento(client, auth, "CLONAZEPAM 2 MG", "555", "Lab C")

    resp = client.put(f"/api/receitas/{receita['id']}", json={"itens": [
        {"id": id_alpra, "lote": "L1-corrigido", "quantidade": 3},   # mantém a cópia original
        {"catalogo_id": novo["id"], "lote": "L3"},                    # novo; a amoxicilina saiu
    ]}, headers=auth)
    assert resp.status_code == 200, resp.get_json()
    itens = resp.get_json()["receita"]["itens"]
    assert [i["medicamento"] for i in itens] == ["ALPRAZOLAM 0,25 MG 30 CPRS", "CLONAZEPAM 2 MG"]
    assert [i["lote"] for i in itens] == ["L1-corrigido", "L3"] and itens[0]["quantidade"] == 3

    # a receita volta do banco igual, sem itens órfãos
    ref = client.get(f"/api/receitas/{receita['id']}", headers=auth).get_json()
    assert [i["medicamento"] for i in ref["itens"]] == ["ALPRAZOLAM 0,25 MG 30 CPRS", "CLONAZEPAM 2 MG"]


def test_editar_com_erro_nao_altera_nada(client, auth, cliente_id, alprazolam):
    receita = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}], observacoes="Original").get_json()["receita"]
    resp = client.put(f"/api/receitas/{receita['id']}", json={"observacoes": "Mudou", "itens": [{"dose": "sem catálogo"}]}, headers=auth)
    assert resp.status_code == 400
    ref = client.get(f"/api/receitas/{receita['id']}", headers=auth).get_json()
    assert ref["observacoes"] == "Original" and len(ref["itens"]) == 1


def test_editar_nao_permite_zerar_medicamentos(client, auth, cliente_id, alprazolam):
    receita = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}]).get_json()["receita"]
    assert client.put(f"/api/receitas/{receita['id']}", json={"itens": []}, headers=auth).status_code == 400


# ───────────── exclusão e listagem ─────────────
def test_excluir_receita_apaga_os_itens(client, auth, cliente_id, alprazolam, app):
    from app.models.receita import ReceitaItem

    receita = _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}] * 3).get_json()["receita"]
    assert client.delete(f"/api/receitas/{receita['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/receitas/{receita['id']}", headers=auth).status_code == 404
    with app.app_context():
        assert ReceitaItem.query.count() == 0
    # o catálogo continua intacto
    assert len(client.get("/api/catalogo-medicamentos", headers=auth).get_json()["itens"]) == 1


def test_listagem_traz_itens_e_resumo(client, auth, cliente_id, alprazolam, amoxicilina):
    _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}, {"catalogo_id": amoxicilina["id"]}])
    lista = client.get("/api/receitas", headers=auth).get_json()
    assert lista["total"] == 1
    assert len(lista["itens"][0]["itens"]) == 2
    assert "ALPRAZOLAM" in lista["itens"][0]["medicamentos"] and "AMOXICILINA" in lista["itens"][0]["medicamentos"]


def test_dossie_inclui_itens_da_receita(client, auth, cliente_id, alprazolam):
    _criar(client, auth, cliente_id, [{"catalogo_id": alprazolam["id"]}])
    dossie = client.get(f"/api/clientes/{cliente_id}/dossie", headers=auth).get_json()
    assert dossie["historico"]["receitas"][0]["itens"][0]["medicamento"] == "ALPRAZOLAM 0,25 MG 30 CPRS"
