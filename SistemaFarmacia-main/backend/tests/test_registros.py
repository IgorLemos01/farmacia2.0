import pytest

from tests.conftest import CLIENTE, criar_catalogo


@pytest.fixture
def cliente_id(client, auth):
    return client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]["id"]


@pytest.fixture
def catalogo_id(client, auth):
    return criar_catalogo(client, auth, "Pressão arterial", 5)["id"]


def _resolver(payload, catalogo_id):
    """Troca o marcador "__CATALOGO__" pelo id real do exame criado no catálogo."""
    return {k: (catalogo_id if v == "__CATALOGO__" else v) for k, v in payload.items()}


@pytest.mark.parametrize("rota,payload,chave", [
    ("/api/manipulacoes", {"formula": "Biotina 2mg", "valor": 30.5, "forma_pagamento": "PIX"}, "manipulacao"),
    ("/api/exames", {"catalogo_id": "__CATALOGO__", "forma_pagamento": "Dinheiro"}, "exame"),
    ("/api/receitas", {"medico_prescritor": "Dra. Ana (CRM 1)", "medicamentos": "Amoxicilina"}, "receita"),
])
def test_cadastrar_e_listar(client, auth, cliente_id, catalogo_id, rota, payload, chave):
    resp = client.post(rota, json={"cliente_id": cliente_id, **_resolver(payload, catalogo_id)}, headers=auth)
    assert resp.status_code == 201, resp.get_json()
    item = resp.get_json()[chave]
    assert item["cliente_nome"] == "Maria Souza"

    lista = client.get(rota, headers=auth).get_json()
    assert lista["total"] == 1


@pytest.mark.parametrize("rota,payload,campo", [
    ("/api/manipulacoes", {"formula": "X"}, "data"),
    ("/api/manipulacoes", {"formula": "X"}, "prazo_entrega"),
    ("/api/exames", {"catalogo_id": "__CATALOGO__"}, "data"),
    ("/api/receitas", {"medico_prescritor": "Dr", "medicamentos": "X"}, "data_venda"),
])
def test_data_invalida_retorna_400(client, auth, cliente_id, catalogo_id, rota, payload, campo):
    resp = client.post(rota, json={"cliente_id": cliente_id, **_resolver(payload, catalogo_id), campo: "31/12/2026"}, headers=auth)
    assert resp.status_code == 400
    assert "AAAA-MM-DD" in resp.get_json()["message"]


def test_cliente_inexistente_retorna_400(client, auth, catalogo_id):
    resp = client.post("/api/exames", json={"cliente_id": 999, "catalogo_id": catalogo_id}, headers=auth)
    assert resp.status_code == 400


def test_manipulacao_com_opcionais_null(client, auth, cliente_id):
    resp = client.post("/api/manipulacoes", json={
        "cliente_id": cliente_id, "formula": "X", "data": None,
        "prazo_entrega": None, "valor": None, "observacoes": None,
    }, headers=auth)
    assert resp.status_code == 201, resp.get_json()


def test_exame_com_opcionais_null(client, auth, cliente_id, catalogo_id):
    resp = client.post("/api/exames", json={
        "cliente_id": cliente_id, "catalogo_id": catalogo_id, "data": None, "observacoes": None,
    }, headers=auth)
    assert resp.status_code == 201, resp.get_json()


@pytest.mark.parametrize("rota,payload,chave,campo", [
    ("/api/manipulacoes", {"formula": "Biotina"}, "manipulacao", "formula"),
    ("/api/receitas", {"medico_prescritor": "Dr. X", "medicamentos": "Dipirona"}, "receita", "medicamentos"),
])
def test_editar_e_excluir(client, auth, cliente_id, rota, payload, chave, campo):
    criado = client.post(rota, json={"cliente_id": cliente_id, **payload}, headers=auth).get_json()[chave]

    resp = client.put(f"{rota}/{criado['id']}", json={campo: "Valor Novo"}, headers=auth)
    assert resp.status_code == 200
    assert resp.get_json()[chave][campo] == "Valor Novo"

    # campo obrigatório vazio ou nulo é recusado (antes: erro 500)
    for vazio in ("", "   ", None):
        assert client.put(f"{rota}/{criado['id']}", json={campo: vazio}, headers=auth).status_code == 400

    assert client.delete(f"{rota}/{criado['id']}", headers=auth).status_code == 200
    assert client.get(f"{rota}/{criado['id']}", headers=auth).status_code == 404
