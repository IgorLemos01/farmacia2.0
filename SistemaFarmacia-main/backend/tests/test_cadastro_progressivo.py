"""Cadastro rápido de clientes: só nome e telefone são obrigatórios; o resto completa depois."""
import pytest

from tests.conftest import cadastrar, login


def _post(client, auth, **dados):
    return client.post("/api/clientes", json=dados, headers=auth)


def test_cadastro_rapido_so_com_nome_e_telefone(client, auth):
    resp = _post(client, auth, nome="  José   da Silva ", telefone="79999998888")
    assert resp.status_code == 201, resp.get_json()
    c = resp.get_json()["cliente"]
    assert (c["nome"], c["telefone"]) == ("José da Silva", "(79) 99999-8888")
    assert c["cpf"] is None and c["data_nascimento"] is None and c["sexo"] is None
    assert c["cadastro_completo"] is False
    assert "CPF" in c["campos_pendentes"] and "Data de nascimento" in c["campos_pendentes"]


@pytest.mark.parametrize("dados,trecho", [
    ({"telefone": "79999998888"}, "nome"),
    ({"nome": "José"}, "telefone"),
    ({"nome": "José", "telefone": "1234"}, "DDD"),
])
def test_nome_e_telefone_sao_obrigatorios(client, auth, dados, trecho):
    resp = _post(client, auth, **dados)
    assert resp.status_code == 400
    assert trecho.lower() in str(resp.get_json()).lower()


def test_varios_clientes_sem_cpf(client, auth):
    for nome in ("Ana", "Bia", "Caio"):
        assert _post(client, auth, nome=nome, telefone="(79) 3211-0000", cpf="").status_code == 201
    assert client.get("/api/clientes", headers=auth).get_json()["total"] == 3


@pytest.mark.parametrize("campo,valor", [
    ("cpf", "123.456.789-00"),           # dígito verificador errado
    ("cpf", "111.111.111-11"),
    ("email", "sem-arroba"),
    ("cep", "4900"),
    ("estado", "XX"),
    ("sexo", "Masculino"),
    ("data_nascimento", "2999-01-01"),
])
def test_campos_opcionais_sao_validados_quando_informados(client, auth, campo, valor):
    assert _post(client, auth, nome="Ana", telefone="79999998888", **{campo: valor}).status_code == 400


def test_completar_cadastro_aos_poucos(client, auth):
    c = _post(client, auth, nome="Ana", telefone="79999998888", alergia="Dipirona").get_json()["cliente"]

    resp = client.put(f"/api/clientes/{c['id']}", json={"cpf": "52998224725", "cep": "49000000", "estado": "se"}, headers=auth)
    assert resp.status_code == 200, resp.get_json()
    c = resp.get_json()["cliente"]
    assert (c["cpf"], c["cep"], c["estado"]) == ("529.982.247-25", "49000-000", "SE")
    assert c["alergia"] == "Dipirona"  # não mexe no que não foi enviado

    completo = client.put(f"/api/clientes/{c['id']}", json={
        "rg": "123", "data_nascimento": "1990-01-01", "sexo": "F", "email": "ANA@X.COM",
        "endereco": "Rua A", "numero": "10", "bairro": "Centro", "cidade": "Aracaju",
    }, headers=auth).get_json()["cliente"]
    assert completo["cadastro_completo"] is True and completo["campos_pendentes"] == []
    assert completo["email"] == "ana@x.com"
    assert completo["endereco_completo"] == "Rua A, 10 - Centro - Aracaju/SE - CEP 49000-000"


def test_cpf_unico_entre_clientes(client, auth):
    a = _post(client, auth, nome="Ana", telefone="79999998888", cpf="529.982.247-25").get_json()["cliente"]
    b = _post(client, auth, nome="Bia", telefone="79999997777").get_json()["cliente"]
    resp = client.put(f"/api/clientes/{b['id']}", json={"cpf": "529.982.247-25"}, headers=auth)
    assert resp.status_code == 400 and "Ana" in resp.get_json()["message"]
    # reenviar o próprio CPF não é conflito
    assert client.put(f"/api/clientes/{a['id']}", json={"cpf": "529.982.247-25", "nome": "Ana Maria"}, headers=auth).status_code == 200


def test_atendente_de_exames_cadastra_e_completa_paciente(client, admin_token):
    cadastrar(client, "balcao@farmacia.com", token=admin_token, modulos=["exames"])
    func = {"Authorization": f"Bearer {login(client, 'balcao@farmacia.com')}"}

    c = client.post("/api/clientes", json={"nome": "Paciente Novo", "telefone": "79988887777"}, headers=func)
    assert c.status_code == 201
    cid = c.get_json()["cliente"]["id"]
    assert client.put(f"/api/clientes/{cid}", json={"rg": "999"}, headers=func).status_code == 200
    # excluir e ver o dossiê continuam exigindo o módulo Clientes
    assert client.delete(f"/api/clientes/{cid}", headers=func).status_code == 403
    assert client.get(f"/api/clientes/{cid}/dossie", headers=func).status_code == 403


def test_editar_cliente_inexistente_404(client, auth):
    assert client.put("/api/clientes/999", json={"nome": "X"}, headers=auth).status_code == 404
    assert client.delete("/api/clientes/999", headers=auth).status_code == 404
