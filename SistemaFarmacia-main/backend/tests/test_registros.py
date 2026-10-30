import pytest

from tests.conftest import CLIENTE


@pytest.fixture
def cliente_id(client, auth):
    return client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]["id"]


@pytest.mark.parametrize("rota,payload,chave", [
    ("/api/manipulacoes", {"formula": "Biotina 2mg", "valor": 30.5, "forma_pagamento": "PIX"}, "manipulacao"),
    ("/api/exames", {"tipo_exame": "Pressão arterial", "valor": 5, "forma_pagamento": "Dinheiro"}, "exame"),
    ("/api/receitas", {"medico_prescritor": "Dra. Ana (CRM 1)", "medicamentos": "Amoxicilina"}, "receita"),
])
def test_cadastrar_e_listar(client, auth, cliente_id, rota, payload, chave):
    resp = client.post(rota, json={"cliente_id": cliente_id, **payload}, headers=auth)
    assert resp.status_code == 201, resp.get_json()
    item = resp.get_json()[chave]
    assert item["cliente_nome"] == "Maria Souza"

    lista = client.get(rota, headers=auth).get_json()
    assert lista["total"] == 1


@pytest.mark.parametrize("rota,payload,campo", [
    ("/api/manipulacoes", {"formula": "X"}, "data"),
    ("/api/manipulacoes", {"formula": "X"}, "prazo_entrega"),
    ("/api/exames", {"tipo_exame": "X"}, "data"),
    ("/api/receitas", {"medico_prescritor": "Dr", "medicamentos": "X"}, "data_venda"),
])
def test_data_invalida_retorna_400(client, auth, cliente_id, rota, payload, campo):
    resp = client.post(rota, json={"cliente_id": cliente_id, **payload, campo: "31/12/2026"}, headers=auth)
    assert resp.status_code == 400
    assert "AAAA-MM-DD" in resp.get_json()["message"]


def test_cliente_inexistente_retorna_400(client, auth):
    resp = client.post("/api/exames", json={"cliente_id": 999, "tipo_exame": "X"}, headers=auth)
    assert resp.status_code == 400


def test_manipulacao_com_opcionais_null(client, auth, cliente_id):
    resp = client.post("/api/manipulacoes", json={
        "cliente_id": cliente_id, "formula": "X", "data": None,
        "prazo_entrega": None, "valor": None, "observacoes": None,
    }, headers=auth)
    assert resp.status_code == 201, resp.get_json()


def test_exame_com_opcionais_null(client, auth, cliente_id):
    resp = client.post("/api/exames", json={
        "cliente_id": cliente_id, "tipo_exame": "X", "valor": None, "observacoes": None,
    }, headers=auth)
    assert resp.status_code == 201, resp.get_json()
