"""Relatórios separados por categoria, cada um com seu período."""
import pytest

from tests.conftest import CLIENTE, cadastrar, criar_catalogo, criar_medicamento, login


@pytest.fixture
def base(client, auth):
    cid = client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]["id"]
    outro = client.post("/api/clientes", json={"nome": "João", "telefone": "79988887777"}, headers=auth).get_json()["cliente"]["id"]
    glic = criar_catalogo(client, auth, "Glicemia", 10)["id"]
    hemo = criar_catalogo(client, auth, "Hemograma", 20)["id"]
    med = criar_medicamento(client, auth)["id"]

    def manip(data, valor, forma="PIX", cliente=cid):
        client.post("/api/manipulacoes", json={"cliente_id": cliente, "formula": f"F {data}", "data": data, "valor": valor, "forma_pagamento": forma}, headers=auth)

    manip("2026-10-01", 10)
    manip("2026-10-20", 30, "Dinheiro")
    manip("2026-10-20", 5, cliente=outro)
    client.post("/api/exames", json={"cliente_id": cid, "data": "2026-10-05", "itens": [{"catalogo_id": glic}, {"catalogo_id": hemo}], "forma_pagamento": "PIX"}, headers=auth)
    client.post("/api/exames", json={"cliente_id": outro, "data": "2026-09-10", "itens": [{"catalogo_id": glic, "valor": 8}]}, headers=auth)
    client.post("/api/receitas", json={"cliente_id": cid, "data_venda": "2026-10-21", "itens": [{"catalogo_id": med, "quantidade": 2}]}, headers=auth)
    return cid


def _rel(client, auth, categoria, **params):
    resp = client.get(f"/api/relatorios/{categoria}", query_string=params, headers=auth)
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()


def test_cada_categoria_so_traz_os_proprios_registros(client, auth, base):
    m = _rel(client, auth, "manipulacoes")
    e = _rel(client, auth, "exames")
    r = _rel(client, auth, "receitas")
    assert (m["total"], e["total"], r["total"]) == (3, 2, 1)
    assert m["resumo"]["valor_total"] == 45.0
    assert e["resumo"]["valor_total"] == 38.0 and e["resumo"]["total_exames"] == 3
    assert "valor_total" not in r["resumo"]
    assert r["resumo"]["mais_dispensados"][0]["unidades"] == 2


def test_periodo_vale_so_para_a_categoria_pedida(client, auth, base):
    m = _rel(client, auth, "manipulacoes", de="2026-10-15", ate="2026-10-31")
    assert m["total"] == 2 and m["resumo"]["valor_total"] == 35.0
    assert m["resumo"]["clientes_atendidos"] == 2
    assert m["resumo"]["ticket_medio"] == 17.5
    assert m["resumo"]["por_dia"] == [{"data": "2026-10-20", "quantidade": 2, "valor": 35.0}]
    assert {p["forma"]: p["valor"] for p in m["resumo"]["por_pagamento"]} == {"Dinheiro": 30.0, "PIX": 5.0}

    e = _rel(client, auth, "exames", de="2026-10-01")
    assert e["total"] == 1 and e["itens"][0]["exames"] == "Glicemia; Hemograma"
    assert e["resumo"]["mais_realizados"][0] == {"nome": "Glicemia", "quantidade": 1, "valor": 10.0}


def test_datas_invertidas_e_invalidas(client, auth, base):
    assert _rel(client, auth, "manipulacoes", de="2026-10-31", ate="2026-10-15")["periodo"] == {"de": "2026-10-15", "ate": "2026-10-31"}
    resp = client.get("/api/relatorios/manipulacoes?de=31/10/2026", headers=auth)
    assert resp.status_code == 400 and "AAAA-MM-DD" in resp.get_json()["message"]
    assert client.get("/api/relatorios/vendas", headers=auth).status_code == 404


def test_paginacao_e_exportacao(client, auth, base):
    p1 = _rel(client, auth, "manipulacoes", limite=2, pagina=1)
    p2 = _rel(client, auth, "manipulacoes", limite=2, pagina=2)
    assert (p1["paginas"], len(p1["itens"]), len(p2["itens"])) == (2, 2, 1)
    assert p1["itens"][0]["data"] >= p1["itens"][1]["data"]  # mais recentes primeiro
    assert p1["resumo"]["valor_total"] == 45.0               # resumo cobre o período todo
    todos = _rel(client, auth, "manipulacoes", todos="true", limite=1)
    assert len(todos["itens"]) == 3 and todos["itens"][0]["cliente_telefone"]


def test_acesso_pelo_modulo_da_categoria_ou_dashboard(client, admin_token, base):
    cadastrar(client, "ex@f.com", token=admin_token, modulos=["exames"])
    func = {"Authorization": f"Bearer {login(client, 'ex@f.com')}"}
    assert client.get("/api/relatorios/exames", headers=func).status_code == 200
    assert client.get("/api/relatorios/manipulacoes", headers=func).status_code == 403
    assert client.get("/api/relatorios/receitas").status_code == 401
