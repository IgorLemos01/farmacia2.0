import pytest

from tests.conftest import CLIENTE, cadastrar, criar_catalogo, login


@pytest.fixture
def cliente_id(client, auth):
    return client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]["id"]


@pytest.fixture
def auth_atendente(client, admin_token):
    cadastrar(client, "atendente@farmacia.com", token=admin_token)
    return {"Authorization": f"Bearer {login(client, 'atendente@farmacia.com')}"}


# ───────────── permissões ─────────────
def test_exige_login(client):
    assert client.get("/api/catalogo-exames").status_code == 401


def test_atendente_consulta_mas_nao_altera(client, auth, auth_atendente):
    exame = criar_catalogo(client, auth, "Hemograma", 13)

    lista = client.get("/api/catalogo-exames?ativos=true", headers=auth_atendente)
    assert lista.status_code == 200 and len(lista.get_json()["itens"]) == 1

    assert client.post("/api/catalogo-exames", json={"nome": "Novo", "valor": 1}, headers=auth_atendente).status_code == 403
    assert client.put(f"/api/catalogo-exames/{exame['id']}", json={"valor": 99}, headers=auth_atendente).status_code == 403
    assert client.post("/api/catalogo-exames/importar", json={"itens": [{"nome": "X", "valor": 1}]}, headers=auth_atendente).status_code == 403


# ───────────── cadastro, edição, validações ─────────────
def test_cadastrar_normaliza_nome_e_valor(client, auth):
    exame = criar_catalogo(client, auth, "  Glicemia   EM  jejum ", 7)
    assert exame["nome"] == "Glicemia EM jejum"
    assert exame["valor"] == 7.0 and exame["ativo"] is True


def test_nome_repetido_ignorando_maiusculas(client, auth):
    criar_catalogo(client, auth, "Hemograma Completo", 13)
    for nome in ("hemograma completo", "HEMOGRAMA   COMPLETO"):
        resp = client.post("/api/catalogo-exames", json={"nome": nome, "valor": 1}, headers=auth)
        assert resp.status_code == 400
        assert "Já existe" in resp.get_json()["message"]


@pytest.mark.parametrize("valor", [-1, "abc", True, None, 1e12])
def test_valor_invalido(client, auth, valor):
    resp = client.post("/api/catalogo-exames", json={"nome": "Exame X", "valor": valor}, headers=auth)
    assert resp.status_code == 400


def test_valor_e_arredondado_para_centavos(client, auth):
    assert criar_catalogo(client, auth, "Exame A", 12.345)["valor"] == 12.35
    assert criar_catalogo(client, auth, "Exame B", 0.1 + 0.2)["valor"] == 0.3
    assert criar_catalogo(client, auth, "Exame C", 0)["valor"] == 0.0


def test_editar_nome_e_valor(client, auth):
    exame = criar_catalogo(client, auth, "T4", 13)
    resp = client.put(f"/api/catalogo-exames/{exame['id']}", json={"nome": "T4 Livre", "valor": 15.5}, headers=auth)
    assert resp.status_code == 200
    assert (resp.get_json()["exame"]["nome"], resp.get_json()["exame"]["valor"]) == ("T4 Livre", 15.5)


def test_editar_nao_pode_roubar_nome_de_outro(client, auth):
    criar_catalogo(client, auth, "T3", 11)
    outro = criar_catalogo(client, auth, "T4", 13)
    assert client.put(f"/api/catalogo-exames/{outro['id']}", json={"nome": "t3"}, headers=auth).status_code == 400
    # manter o próprio nome (mudando só maiúsculas) é permitido
    assert client.put(f"/api/catalogo-exames/{outro['id']}", json={"nome": "t4"}, headers=auth).status_code == 200


def test_exame_inexistente_404(client, auth):
    assert client.put("/api/catalogo-exames/999", json={"valor": 1}, headers=auth).status_code == 404


def test_validacao_nao_altera_parcialmente(client, auth):
    exame = criar_catalogo(client, auth, "TSH", 13)
    assert client.put(f"/api/catalogo-exames/{exame['id']}", json={"nome": "TSH Novo", "valor": -5}, headers=auth).status_code == 400
    atual = client.get("/api/catalogo-exames", headers=auth).get_json()["itens"][0]
    assert atual["nome"] == "TSH"


# ───────────── desativar / reativar ─────────────
def test_desativar_some_da_lista_de_escolha_e_pode_reativar(client, auth):
    exame = criar_catalogo(client, auth, "ASLO", 11)
    client.put(f"/api/catalogo-exames/{exame['id']}", json={"ativo": False}, headers=auth)

    assert client.get("/api/catalogo-exames?ativos=true", headers=auth).get_json()["itens"] == []
    assert len(client.get("/api/catalogo-exames", headers=auth).get_json()["itens"]) == 1  # admin ainda vê

    # cadastrar de novo o mesmo nome orienta a reativar
    resp = client.post("/api/catalogo-exames", json={"nome": "aslo", "valor": 12}, headers=auth)
    assert resp.status_code == 400 and "desativado" in resp.get_json()["message"]

    client.put(f"/api/catalogo-exames/{exame['id']}", json={"ativo": True}, headers=auth)
    assert len(client.get("/api/catalogo-exames?ativos=true", headers=auth).get_json()["itens"]) == 1


def test_ativo_precisa_ser_booleano(client, auth):
    exame = criar_catalogo(client, auth, "ASLO", 11)
    assert client.put(f"/api/catalogo-exames/{exame['id']}", json={"ativo": "nao"}, headers=auth).status_code == 400


# ───────────── importação ─────────────
def test_importar_cria_atualiza_e_relata_problemas(client, auth):
    criar_catalogo(client, auth, "Hemograma", 10)
    igual = criar_catalogo(client, auth, "T3", 11)
    antigo = criar_catalogo(client, auth, "Antigo", 5)
    client.put(f"/api/catalogo-exames/{antigo['id']}", json={"ativo": False}, headers=auth)

    resp = client.post("/api/catalogo-exames/importar", json={"itens": [
        {"nome": "Glicemia", "valor": 7, "linha": 2},          # novo
        {"nome": "hemograma", "valor": 13, "linha": 3},        # existe → atualiza valor
        {"nome": "T3", "valor": 11, "linha": 4},               # idêntico
        {"nome": "Antigo", "valor": 5, "linha": 5},            # desativado → reativa
        {"nome": "", "valor": 5, "linha": 6},                  # sem nome
        {"nome": "Sem valor", "valor": None, "linha": 7},      # sem valor
        {"nome": "Negativo", "valor": -3, "linha": 8},         # valor inválido
        {"nome": "GLICEMIA", "valor": 9, "linha": 9},          # repetido no arquivo
    ]}, headers=auth)

    assert resp.status_code == 200, resp.get_json()
    r = resp.get_json()
    assert (r["criados"], r["atualizados"], r["iguais"]) == (1, 2, 1)
    assert sorted(e["linha"] for e in r["erros"]) == [6, 7, 8, 9]
    assert "repetido" in next(e for e in r["erros"] if e["linha"] == 9)["motivo"]

    itens = {i["nome"]: i for i in client.get("/api/catalogo-exames", headers=auth).get_json()["itens"]}
    assert itens["Hemograma"]["valor"] == 13.0      # mantém o nome original, só o valor mudou
    assert itens["Antigo"]["ativo"] is True
    assert itens["Glicemia"]["valor"] == 7.0        # o repetido (9) não sobrescreveu
    assert igual["id"] == itens["T3"]["id"]


def test_importar_limites(client, auth):
    assert client.post("/api/catalogo-exames/importar", json={"itens": []}, headers=auth).status_code == 400
    muitos = [{"nome": f"Exame {i}", "valor": 1} for i in range(1001)]
    assert client.post("/api/catalogo-exames/importar", json={"itens": muitos}, headers=auth).status_code == 400
    assert client.post("/api/catalogo-exames/importar", json={}, headers=auth).status_code == 400


def test_importar_recusa_itens_que_nao_sao_objetos(client, auth):
    resp = client.post("/api/catalogo-exames/importar", json={"itens": ["texto", 5, {"nome": "Ok", "valor": 1}]}, headers=auth)
    assert resp.status_code == 400
    assert client.get("/api/catalogo-exames", headers=auth).get_json()["itens"] == []  # nada foi gravado


# ───────────── exames registrados usam o catálogo ─────────────
def test_exame_copia_nome_e_valor_do_catalogo(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma COMPLETO", 13)
    resp = client.post("/api/exames", json={"cliente_id": cliente_id, "catalogo_id": item["id"]}, headers=auth)
    assert resp.status_code == 201, resp.get_json()
    exame = resp.get_json()["exame"]
    assert (exame["tipo_exame"], exame["valor"]) == ("Hemograma COMPLETO", 13.0)


def test_valor_enviado_pelo_cliente_e_ignorado(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    exame = client.post("/api/exames", json={
        "cliente_id": cliente_id, "catalogo_id": item["id"], "valor": 1, "tipo_exame": "Outro nome",
    }, headers=auth).get_json()["exame"]
    assert (exame["tipo_exame"], exame["valor"]) == ("Hemograma", 13.0)


@pytest.mark.parametrize("corpo", [
    {"tipo_exame": "Digitado à mão", "valor": 5},    # fora do catálogo
    {"catalogo_id": 999},                            # não existe
    {"catalogo_id": "1"},                            # tipo errado
    {"catalogo_id": True},
])
def test_nao_aceita_exame_fora_do_catalogo(client, auth, cliente_id, corpo):
    criar_catalogo(client, auth, "Hemograma", 13)
    resp = client.post("/api/exames", json={"cliente_id": cliente_id, **corpo}, headers=auth)
    assert resp.status_code == 400


def test_nao_registra_exame_desativado(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "ASLO", 11)
    client.put(f"/api/catalogo-exames/{item['id']}", json={"ativo": False}, headers=auth)
    resp = client.post("/api/exames", json={"cliente_id": cliente_id, "catalogo_id": item["id"]}, headers=auth)
    assert resp.status_code == 400


def test_mudar_preco_nao_altera_exames_ja_feitos(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 20)
    feito = client.post("/api/exames", json={"cliente_id": cliente_id, "catalogo_id": item["id"]}, headers=auth).get_json()["exame"]

    client.put(f"/api/catalogo-exames/{item['id']}", json={"valor": 25, "nome": "Hemograma Completo"}, headers=auth)
    novo = client.post("/api/exames", json={"cliente_id": cliente_id, "catalogo_id": item["id"]}, headers=auth).get_json()["exame"]

    antigo = client.get(f"/api/exames/{feito['id']}", headers=auth).get_json()
    assert (antigo["tipo_exame"], antigo["valor"]) == ("Hemograma", 20.0)       # passado intacto
    assert (novo["tipo_exame"], novo["valor"]) == ("Hemograma Completo", 25.0)  # novo usa o preço novo


def test_editar_exame_nao_muda_nome_nem_valor(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    exame = client.post("/api/exames", json={"cliente_id": cliente_id, "catalogo_id": item["id"]}, headers=auth).get_json()["exame"]

    resp = client.put(f"/api/exames/{exame['id']}", json={
        "tipo_exame": "Fraude", "valor": 0.01, "observacoes": "Resultado normal", "forma_pagamento": "PIX",
    }, headers=auth)
    assert resp.status_code == 200
    editado = resp.get_json()["exame"]
    assert (editado["tipo_exame"], editado["valor"]) == ("Hemograma", 13.0)
    assert (editado["observacoes"], editado["forma_pagamento"]) == ("Resultado normal", "PIX")


def test_excluir_exame_registrado(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    exame = client.post("/api/exames", json={"cliente_id": cliente_id, "catalogo_id": item["id"]}, headers=auth).get_json()["exame"]
    assert client.delete(f"/api/exames/{exame['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/exames/{exame['id']}", headers=auth).status_code == 404
    # o catálogo não é afetado
    assert len(client.get("/api/catalogo-exames", headers=auth).get_json()["itens"]) == 1


def test_nome_de_uma_letra_e_valido(client, auth):
    """Há exames com nome de 1 letra (ex.: "K" = potássio)."""
    assert criar_catalogo(client, auth, "K", 19.7)["nome"] == "K"
    r = client.post("/api/catalogo-exames/importar", json={"itens": [{"nome": "Na", "valor": 7}, {"nome": "P", "valor": 8}]}, headers=auth).get_json()
    assert (r["criados"], r["erros"]) == (2, [])
    assert client.post("/api/catalogo-exames", json={"nome": "   ", "valor": 1}, headers=auth).status_code == 400
