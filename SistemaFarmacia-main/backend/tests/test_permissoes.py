"""
Regra de acesso por módulo, conferida no servidor (não só escondida na tela).

Resumo da regra:
- admin: tudo;
- funcionário: só os módulos liberados, mais a CONSULTA da lista de clientes quando algum
  módulo precisa escolher um paciente, e a consulta dos catálogos do próprio módulo;
- dashboard: dá leitura das listas (clientes, manipulações, exames, receitas), nunca escrita.
"""
import pytest

from tests.conftest import CLIENTE, cadastrar, criar_catalogo, criar_medicamento, login


@pytest.fixture
def dados(client, auth):
    """Um registro de cada tipo, criado pelo admin, para as rotas de detalhe terem o que achar."""
    cliente = client.post("/api/clientes", json=CLIENTE, headers=auth).get_json()["cliente"]
    exame_cat = criar_catalogo(client, auth, "Hemograma", 13)
    medicamento = criar_medicamento(client, auth)
    manip = client.post("/api/manipulacoes", json={"cliente_id": cliente["id"], "formula": "Biotina"}, headers=auth).get_json()["manipulacao"]
    exame = client.post("/api/exames", json={"cliente_id": cliente["id"], "catalogo_id": exame_cat["id"]}, headers=auth).get_json()["exame"]
    receita = client.post("/api/receitas", json={"cliente_id": cliente["id"], "itens": [{"catalogo_id": medicamento["id"]}]}, headers=auth).get_json()["receita"]
    return {"cliente": cliente["id"], "manip": manip["id"], "exame": exame["id"], "receita": receita["id"], "exame_cat": exame_cat["id"], "med": medicamento["id"]}


def _funcionario(client, admin_token, modulos, email="func@farmacia.com"):
    assert cadastrar(client, email, token=admin_token, modulos=modulos).status_code == 201
    return {"Authorization": f"Bearer {login(client, email)}"}


def _status(client, headers, metodo, url, corpo=None):
    return client.open(url, method=metodo, headers=headers, json=corpo).status_code


def _rotas(d):
    """(nome, método, url, corpo) de toda a API protegida por módulo."""
    c, m, e, r = d["cliente"], d["manip"], d["exame"], d["receita"]
    return [
        ("clientes: listar", "GET", "/api/clientes", None),
        ("clientes: ver um", "GET", f"/api/clientes/{c}", None),
        ("clientes: criar", "POST", "/api/clientes", {**CLIENTE, "cpf": "999.999.999-99"}),
        ("clientes: editar", "PUT", f"/api/clientes/{c}", {"telefone": "(75) 90000-0000"}),
        ("clientes: excluir", "DELETE", f"/api/clientes/{c}", None),
        ("clientes: dossiê", "GET", f"/api/clientes/{c}/dossie", None),
        ("manipulações: listar", "GET", "/api/manipulacoes", None),
        ("manipulações: ver uma", "GET", f"/api/manipulacoes/{m}", None),
        ("manipulações: criar", "POST", "/api/manipulacoes", {"cliente_id": c, "formula": "X"}),
        ("manipulações: editar", "PUT", f"/api/manipulacoes/{m}", {"observacoes": "x"}),
        ("manipulações: excluir", "DELETE", f"/api/manipulacoes/{m}", None),
        ("exames: listar", "GET", "/api/exames", None),
        ("exames: ver um", "GET", f"/api/exames/{e}", None),
        ("exames: criar", "POST", "/api/exames", {"cliente_id": c, "catalogo_id": d["exame_cat"]}),
        ("exames: editar", "PUT", f"/api/exames/{e}", {"observacoes": "x"}),
        ("exames: excluir", "DELETE", f"/api/exames/{e}", None),
        ("receitas: listar", "GET", "/api/receitas", None),
        ("receitas: ver uma", "GET", f"/api/receitas/{r}", None),
        ("receitas: criar", "POST", "/api/receitas", {"cliente_id": c, "itens": [{"catalogo_id": d["med"]}]}),
        ("receitas: editar", "PUT", f"/api/receitas/{r}", {"observacoes": "x"}),
        ("receitas: excluir", "DELETE", f"/api/receitas/{r}", None),
        ("catálogo de exames: consultar", "GET", "/api/catalogo-exames?ativos=true", None),
        ("catálogo de medicamentos: consultar", "GET", "/api/catalogo-medicamentos?ativos=true", None),
        ("usuários: listar", "GET", "/api/usuarios", None),
    ]


# Rotas liberadas (as demais devem responder 403) para cada conjunto de módulos.
LEITURA_CLIENTES = {"clientes: listar", "clientes: ver um"}
LIBERADO = {
    "somente clientes": ({"clientes"}, {n for n, *_ in [
        ("clientes: listar",), ("clientes: ver um",), ("clientes: criar",), ("clientes: editar",), ("clientes: excluir",), ("clientes: dossiê",)]}),
    "somente manipulações": ({"manipulacoes"}, LEITURA_CLIENTES | {"manipulações: listar", "manipulações: ver uma", "manipulações: criar", "manipulações: editar", "manipulações: excluir"}),
    "somente exames": ({"exames"}, LEITURA_CLIENTES | {"exames: listar", "exames: ver um", "exames: criar", "exames: editar", "exames: excluir", "catálogo de exames: consultar"}),
    "somente receitas": ({"receitas"}, LEITURA_CLIENTES | {"receitas: listar", "receitas: ver uma", "receitas: criar", "receitas: editar", "receitas: excluir", "catálogo de medicamentos: consultar"}),
    "somente dashboard": ({"dashboard"}, LEITURA_CLIENTES | {"manipulações: listar", "manipulações: ver uma", "exames: listar", "exames: ver um", "receitas: listar", "receitas: ver uma"}),
}


@pytest.mark.parametrize("nome", list(LIBERADO))
def test_funcionario_so_acessa_o_que_foi_liberado(client, admin_token, dados, nome):
    modulos, liberadas = LIBERADO[nome]
    func = _funcionario(client, admin_token, sorted(modulos))

    erros = []
    for rota, metodo, url, corpo in _rotas(dados):
        # as exclusões vão por último na lista, mas o cliente só pode ser apagado sem histórico:
        # aqui só importa liberado (≠ 403) ou bloqueado (= 403)
        status = _status(client, func, metodo, url, corpo)
        if rota in liberadas and status == 403:
            erros.append(f"{rota}: devia estar liberada e deu 403")
        if rota not in liberadas and status != 403:
            erros.append(f"{rota}: devia dar 403 e deu {status}")
    assert not erros, "\n".join(erros)


def test_admin_acessa_tudo(client, auth, dados):
    # o dossiê, a leitura e as edições; as exclusões ficam de fora porque mudariam os dados
    for rota, metodo, url, corpo in _rotas(dados):
        if metodo == "DELETE" or rota == "clientes: criar":
            continue
        assert _status(client, auth, metodo, url, corpo) != 403, rota


def test_combinar_modulos_soma_as_permissoes(client, admin_token, dados):
    func = _funcionario(client, admin_token, ["exames", "receitas"])
    assert _status(client, func, "GET", "/api/exames") == 200
    assert _status(client, func, "GET", "/api/receitas") == 200
    assert _status(client, func, "GET", "/api/catalogo-exames") == 200
    assert _status(client, func, "GET", "/api/catalogo-medicamentos") == 200
    assert _status(client, func, "GET", "/api/manipulacoes") == 403
    assert _status(client, func, "POST", "/api/clientes", {**CLIENTE, "cpf": "1"}) == 403


def test_catalogos_nunca_sao_alterados_por_funcionario(client, admin_token, dados):
    func = _funcionario(client, admin_token, ["exames", "receitas", "dashboard", "clientes", "manipulacoes"])
    assert _status(client, func, "POST", "/api/catalogo-exames", {"nome": "Novo", "valor": 1}) == 403
    assert _status(client, func, "PUT", f"/api/catalogo-exames/{dados['exame_cat']}", {"valor": 0.01}) == 403
    assert _status(client, func, "POST", "/api/catalogo-medicamentos", {"descricao": "Novo"}) == 403
    assert _status(client, func, "PUT", f"/api/catalogo-medicamentos/{dados['med']}", {"laboratorio": "X"}) == 403
    assert _status(client, func, "POST", "/api/catalogo-exames/importar", {"itens": [{"nome": "X", "valor": 1}]}) == 403


# ───────────── mudanças valem na hora, mesmo com o token antigo ─────────────
def test_retirar_um_modulo_vale_imediatamente(client, auth, admin_token, dados):
    func = _funcionario(client, admin_token, ["exames", "receitas"])
    assert _status(client, func, "GET", "/api/exames") == 200

    uid = next(u["id"] for u in client.get("/api/usuarios", headers=auth).get_json()["itens"] if u["email"] == "func@farmacia.com")
    assert client.put(f"/api/usuarios/{uid}", json={"modulos": ["receitas"]}, headers=auth).status_code == 200

    assert _status(client, func, "GET", "/api/exames") == 403          # mesmo token de antes
    assert _status(client, func, "GET", "/api/receitas") == 200


def test_liberar_um_modulo_vale_imediatamente(client, auth, admin_token, dados):
    func = _funcionario(client, admin_token, ["receitas"])
    assert _status(client, func, "GET", "/api/manipulacoes") == 403
    uid = next(u["id"] for u in client.get("/api/usuarios", headers=auth).get_json()["itens"] if u["email"] == "func@farmacia.com")
    client.put(f"/api/usuarios/{uid}", json={"modulos": ["receitas", "manipulacoes"]}, headers=auth)
    assert _status(client, func, "GET", "/api/manipulacoes") == 200


def test_promover_a_admin_libera_tudo_e_rebaixar_tira(client, auth, admin_token, dados):
    func = _funcionario(client, admin_token, ["receitas"])
    uid = next(u["id"] for u in client.get("/api/usuarios", headers=auth).get_json()["itens"] if u["email"] == "func@farmacia.com")

    client.put(f"/api/usuarios/{uid}", json={"perfil": "admin"}, headers=auth)
    assert _status(client, func, "GET", "/api/usuarios") == 200
    assert _status(client, func, "GET", "/api/manipulacoes") == 200

    client.put(f"/api/usuarios/{uid}", json={"perfil": "funcionario", "modulos": ["receitas"]}, headers=auth)
    assert _status(client, func, "GET", "/api/usuarios") == 403
    assert _status(client, func, "GET", "/api/manipulacoes") == 403
    assert _status(client, func, "GET", "/api/receitas") == 200


def test_mensagem_de_acesso_negado(client, admin_token, dados):
    func = _funcionario(client, admin_token, ["receitas"])
    resp = client.get("/api/manipulacoes", headers=func)
    assert resp.status_code == 403
    assert "não tem acesso" in resp.get_json()["message"]


def test_me_traz_os_modulos_para_a_tela_montar_o_menu(client, admin_token):
    func = _funcionario(client, admin_token, ["receitas", "clientes"])
    me = client.get("/api/auth/me", headers=func).get_json()
    assert (me["perfil"], me["modulos"]) == ("funcionario", ["clientes", "receitas"])  # ordem padrão do sistema

    me_admin = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}).get_json()
    assert me_admin["perfil"] == "admin" and set(me_admin["modulos"]) == {"dashboard", "clientes", "manipulacoes", "exames", "receitas"}


def test_login_devolve_perfil_e_modulos(client, admin_token):
    _funcionario(client, admin_token, ["exames"])
    usuario = client.post("/api/auth/login", json={"email": "func@farmacia.com", "senha": "senha123"}).get_json()["usuario"]
    assert (usuario["perfil"], usuario["modulos"]) == ("funcionario", ["exames"])
