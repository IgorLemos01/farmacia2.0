import datetime

from app.extensions import db
from app.models.catalogo_exame import CatalogoExame
from app.models.cliente import Cliente
from app.models.exame import Exame, ExameItem
from app.utils import parse_data, parse_valor, texto_opcional

FORMAS_PAGAMENTO = ("Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX", "Outro")
MAX_ITENS = 30  # exames por atendimento


def _forma_pagamento(valor):
    if valor in (None, ""):
        return None
    if valor not in FORMAS_PAGAMENTO:
        raise ValueError("Forma de pagamento inválida.")
    return valor


def _id_inteiro(valor) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool)


def _montar_itens(itens, pedido_atual: Exame | None = None) -> list[ExameItem]:
    """
    Converte a lista enviada em ExameItem.

    - Item novo: `{catalogo_id, valor?}` — o nome é copiado do catálogo; o valor é o do catálogo,
      a menos que o atendente informe outro (desconto, preço combinado etc.).
    - Item já salvo (edição): `{id, valor?}` — mantém o nome original, mesmo que o catálogo
      tenha mudado depois; o valor pode ser corrigido.
    """
    if not isinstance(itens, list) or not itens:
        raise ValueError("Adicione pelo menos um exame ao pedido.")
    if len(itens) > MAX_ITENS:
        raise ValueError(f"Um pedido pode ter no máximo {MAX_ITENS} exames.")

    existentes = {i.id: i for i in pedido_atual.itens} if pedido_atual else {}
    novos = []
    for posicao, bruto in enumerate(itens, start=1):
        if not isinstance(bruto, dict):
            raise ValueError(f"Exame {posicao}: formato inválido.")

        catalogo_id = bruto.get("catalogo_id")
        if catalogo_id is not None:
            item = db.session.get(CatalogoExame, catalogo_id) if _id_inteiro(catalogo_id) else None
            if item is None or not item.ativo:
                raise ValueError(f"Exame {posicao}: escolha um exame da lista do catálogo.")
            nome, valor_padrao, origem = item.nome, item.valor, item.id
        elif _id_inteiro(bruto.get("id")) and bruto["id"] in existentes:
            antigo = existentes[bruto["id"]]
            nome, valor_padrao, origem = antigo.nome, antigo.valor, antigo.catalogo_id
        else:
            raise ValueError(f"Exame {posicao}: escolha um exame da lista do catálogo.")

        if bruto.get("valor") in (None, ""):
            valor = valor_padrao
        else:
            try:
                valor = parse_valor(bruto["valor"], "Valor")
            except ValueError as e:
                raise ValueError(f"Exame {posicao} ({nome}): {e}")

        novos.append(ExameItem(ordem=posicao, catalogo_id=origem, nome=nome, valor=valor))
    return novos


class ExameService:
    """Regras de negócio para pedidos de exames (vários exames por atendimento)."""

    @staticmethod
    def listar(cliente_id: int = None, limite: int = 50, pagina: int = 1):
        query = Exame.query
        if cliente_id:
            query = query.filter_by(cliente_id=cliente_id)

        query = query.order_by(Exame.data.desc(), Exame.id.desc())
        paginacao = query.paginate(page=pagina, per_page=max(1, min(limite or 50, 200)), error_out=False)

        return {
            "total": paginacao.total,
            "paginas": paginacao.pages,
            "pagina_atual": paginacao.page,
            "itens": [e.to_dict() for e in paginacao.items],
        }

    @staticmethod
    def obter_por_id(exame_id: int) -> Exame:
        return db.session.get(Exame, exame_id)

    @staticmethod
    def cadastrar(dados: dict) -> Exame:
        cliente_id = dados.get("cliente_id")
        if not cliente_id:
            raise ValueError("O ID do cliente (cliente_id) é obrigatório.")
        if not db.session.get(Cliente, cliente_id):
            raise ValueError(f"Cliente com ID {cliente_id} não encontrado.")

        pedido = Exame(
            cliente_id=cliente_id,
            data=parse_data(dados.get("data"), "Data do exame") or datetime.date.today(),
            forma_pagamento=_forma_pagamento(dados.get("forma_pagamento")),
            observacoes=texto_opcional(dados.get("observacoes"), 5000, "Observações"),
            itens=_montar_itens(dados.get("itens")),
        )
        pedido.recalcular_total()
        db.session.add(pedido)
        db.session.commit()
        return pedido

    @staticmethod
    def atualizar(exame_id: int, dados: dict) -> Exame:
        pedido = db.session.get(Exame, exame_id)
        if not pedido:
            raise LookupError("Exame não encontrado.")
        dados = dados or {}

        # Valida tudo antes de alterar qualquer campo.
        itens = _montar_itens(dados["itens"], pedido) if "itens" in dados else None
        mudancas = {}
        if "data" in dados and dados["data"]:
            mudancas["data"] = parse_data(dados["data"], "Data do exame")
        if "forma_pagamento" in dados:
            mudancas["forma_pagamento"] = _forma_pagamento(dados["forma_pagamento"])
        if "observacoes" in dados:
            mudancas["observacoes"] = texto_opcional(dados["observacoes"], 5000, "Observações")

        for campo, valor in mudancas.items():
            setattr(pedido, campo, valor)
        if itens is not None:
            pedido.itens = itens  # os antigos são apagados (delete-orphan)
            pedido.recalcular_total()
        db.session.commit()
        return pedido

    @staticmethod
    def deletar(exame_id: int):
        pedido = db.session.get(Exame, exame_id)
        if not pedido:
            raise LookupError("Exame não encontrado.")
        db.session.delete(pedido)
        db.session.commit()
