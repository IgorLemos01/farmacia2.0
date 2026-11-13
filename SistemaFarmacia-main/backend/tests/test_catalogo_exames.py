import pytest

from tests.conftest import CLIENTE, cadastrar, criar_catalogo, login


@pytest.fixture
def cliente_id(client, auth):
    return client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]["id"]


@pytest.fixture
def auth_funcionario(client, admin_token):
    cadastrar(client, "funcionario@farmacia.com", token=admin_token)
    return {"Authorization": f"Bearer {login(client, 'funcionario@farmacia.com')}"}


# ───────────── permissões ─────────────
def test_exige_login(client):
    assert client.get("/api/catalogo-exames").status_code == 401


def test_funcionario_consulta_mas_nao_altera(client, auth, auth_funcionario):
    exame = criar_catalogo(client, auth, "Hemograma", 13)

    lista = client.get("/api/catalogo-exames?ativos=true", headers=auth_funcionario)
    assert lista.status_code == 200 and len(lista.get_json()["itens"]) == 1

    assert client.post("/api/catalogo-exames", json={"nome": "Novo", "valor": 1}, headers=auth_funcionario).status_code == 403
    assert client.put(f"/api/catalogo-exames/{exame['id']}", json={"valor": 99}, headers=auth_funcionario).status_code == 403
    assert client.post("/api/catalogo-exames/importar", json={"itens": [{"nome": "X", "valor": 1}]}, headers=auth_funcionario).status_code == 403


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
def _pedido(client, auth, cliente_id, *itens, **extra):
    return client.post("/api/exames", json={"cliente_id": cliente_id, "itens": list(itens), **extra}, headers=auth)


def test_exame_copia_nome_e_valor_do_catalogo(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma COMPLETO", 13)
    resp = _pedido(client, auth, cliente_id, {"catalogo_id": item["id"]})
    assert resp.status_code == 201, resp.get_json()
    exame = resp.get_json()["exame"]
    assert (exame["tipo_exame"], exame["valor"]) == ("Hemograma COMPLETO", 13.0)
    assert exame["itens"] == [{"id": exame["itens"][0]["id"], "catalogo_id": item["id"], "nome": "Hemograma COMPLETO", "valor": 13.0}]


def test_nome_vem_do_catalogo_mas_valor_pode_ser_ajustado(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    exame = _pedido(client, auth, cliente_id, {"catalogo_id": item["id"], "valor": 10.5, "nome": "Outro nome"}).get_json()["exame"]
    assert (exame["tipo_exame"], exame["valor"]) == ("Hemograma", 10.5)


@pytest.mark.parametrize("item", [
    {"nome": "Digitado à mão", "valor": 5},          # fora do catálogo
    {"catalogo_id": 999},                            # não existe
    {"catalogo_id": "1"},                            # tipo errado
    {"catalogo_id": True},
    "texto",
])
def test_nao_aceita_exame_fora_do_catalogo(client, auth, cliente_id, item):
    criar_catalogo(client, auth, "Hemograma", 13)
    assert _pedido(client, auth, cliente_id, item).status_code == 400


@pytest.mark.parametrize("valor", [-1, "abc", True, 100000000])
def test_valor_ajustado_invalido(client, auth, cliente_id, valor):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    resp = _pedido(client, auth, cliente_id, {"catalogo_id": item["id"], "valor": valor})
    assert resp.status_code == 400
    assert "Hemograma" in resp.get_json()["message"]


def test_pedido_sem_itens_ou_com_itens_demais(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    assert _pedido(client, auth, cliente_id).status_code == 400
    assert _pedido(client, auth, cliente_id, *[{"catalogo_id": item["id"]}] * 31).status_code == 400
    assert _pedido(client, auth, cliente_id, *[{"catalogo_id": item["id"]}] * 30).status_code == 201


def test_nao_registra_exame_desativado(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "ASLO", 11)
    client.put(f"/api/catalogo-exames/{item['id']}", json={"ativo": False}, headers=auth)
    assert _pedido(client, auth, cliente_id, {"catalogo_id": item["id"]}).status_code == 400


def test_varios_exames_no_mesmo_atendimento_somam_o_total(client, auth, cliente_id):
    """Feedback do cliente: o paciente faz vários exames na mesma visita."""
    glicemia = criar_catalogo(client, auth, "Glicemia em jejum", 10)
    gravidez = criar_catalogo(client, auth, "Teste de gravidez", 18)
    urico = criar_catalogo(client, auth, "Ácido úrico", 12)
    hemo = criar_catalogo(client, auth, "Hemograma", 20)
    resp = _pedido(
        client, auth, cliente_id,
        {"catalogo_id": urico["id"]}, {"catalogo_id": glicemia["id"]},
        {"catalogo_id": gravidez["id"], "valor": "15.50"}, {"catalogo_id": hemo["id"]},
        forma_pagamento="PIX",
    )
    assert resp.status_code == 201, resp.get_json()
    exame = resp.get_json()["exame"]
    assert [i["nome"] for i in exame["itens"]] == ["Ácido úrico", "Glicemia em jejum", "Teste de gravidez", "Hemograma"]
    assert exame["quantidade_exames"] == 4
    assert exame["valor"] == 57.5
    # histórico do cliente
    historico = client.get(f"/api/clientes/{cliente_id}/dossie", headers=auth).get_json()["historico"]["exames"]
    assert len(historico) == 1 and historico[0]["quantidade_exames"] == 4


def test_mudar_preco_nao_altera_exames_ja_feitos(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 20)
    feito = _pedido(client, auth, cliente_id, {"catalogo_id": item["id"]}).get_json()["exame"]

    client.put(f"/api/catalogo-exames/{item['id']}", json={"valor": 25, "nome": "Hemograma Completo"}, headers=auth)
    novo = _pedido(client, auth, cliente_id, {"catalogo_id": item["id"]}).get_json()["exame"]

    antigo = client.get(f"/api/exames/{feito['id']}", headers=auth).get_json()
    assert (antigo["tipo_exame"], antigo["valor"]) == ("Hemograma", 20.0)       # passado intacto
    assert (novo["tipo_exame"], novo["valor"]) == ("Hemograma Completo", 25.0)  # novo usa o preço novo


def test_editar_pedido_troca_itens_e_recalcula(client, auth, cliente_id):
    a = criar_catalogo(client, auth, "Hemograma", 13)
    b = criar_catalogo(client, auth, "TSH", 25)
    exame = _pedido(client, auth, cliente_id, {"catalogo_id": a["id"]}).get_json()["exame"]

    # o nome do catálogo muda depois; o item já salvo mantém o nome original
    client.put(f"/api/catalogo-exames/{a['id']}", json={"nome": "Hemograma Novo"}, headers=auth)
    resp = client.put(f"/api/exames/{exame['id']}", json={
        "itens": [{"id": exame["itens"][0]["id"], "valor": 11}, {"catalogo_id": b["id"]}],
        "observacoes": "Resultado normal", "forma_pagamento": "PIX",
    }, headers=auth)
    assert resp.status_code == 200, resp.get_json()
    editado = resp.get_json()["exame"]
    assert [(i["nome"], i["valor"]) for i in editado["itens"]] == [("Hemograma", 11.0), ("TSH", 25.0)]
    assert editado["valor"] == 36.0
    assert (editado["observacoes"], editado["forma_pagamento"]) == ("Resultado normal", "PIX")

    # editar só a observação mantém os itens
    so_obs = client.put(f"/api/exames/{exame['id']}", json={"observacoes": "x", "tipo_exame": "Fraude"}, headers=auth).get_json()["exame"]
    assert so_obs["valor"] == 36.0 and so_obs["tipo_exame"] == "Hemograma; TSH"

    # item de outro pedido não pode ser "reaproveitado"
    outro = _pedido(client, auth, cliente_id, {"catalogo_id": b["id"]}).get_json()["exame"]
    assert client.put(f"/api/exames/{exame['id']}", json={"itens": [{"id": outro["itens"][0]["id"]}]}, headers=auth).status_code == 400


def test_forma_de_pagamento_invalida(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    assert _pedido(client, auth, cliente_id, {"catalogo_id": item["id"]}, forma_pagamento="Fiado").status_code == 400
    assert _pedido(client, auth, cliente_id, {"catalogo_id": item["id"]}, forma_pagamento=None).status_code == 201


def test_excluir_exame_registrado(client, auth, cliente_id):
    item = criar_catalogo(client, auth, "Hemograma", 13)
    exame = _pedido(client, auth, cliente_id, {"catalogo_id": item["id"]}).get_json()["exame"]
    assert client.delete(f"/api/exames/{exame['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/exames/{exame['id']}", headers=auth).status_code == 404
    assert client.delete(f"/api/exames/{exame['id']}", headers=auth).status_code == 404
    # o catálogo não é afetado
    assert len(client.get("/api/catalogo-exames", headers=auth).get_json()["itens"]) == 1


def test_nome_de_uma_letra_e_valido(client, auth):
    """Há exames com nome de 1 letra (ex.: "K" = potássio)."""
    assert criar_catalogo(client, auth, "K", 19.7)["nome"] == "K"
    r = client.post("/api/catalogo-exames/importar", json={"itens": [{"nome": "Na", "valor": 7}, {"nome": "P", "valor": 8}]}, headers=auth).get_json()
    assert (r["criados"], r["erros"]) == (2, [])
    assert client.post("/api/catalogo-exames", json={"nome": "   ", "valor": 1}, headers=auth).status_code == 400
