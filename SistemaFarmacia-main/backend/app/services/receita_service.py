import datetime

from app.extensions import db
from app.models.catalogo_medicamento import CatalogoMedicamento
from app.models.cliente import Cliente
from app.models.receita import Receita, ReceitaItem
from app.utils import parse_data, texto_opcional

MAX_ITENS = 12  # a ficha em PDF cabe em uma página com até 12 medicamentos


def _quantidade(valor, posicao: int):
    if valor is None or valor == "":
        return None
    if isinstance(valor, bool):
        raise ValueError(f"Medicamento {posicao}: quantidade inválida.")
    try:
        numero = int(valor)
    except (TypeError, ValueError):
        raise ValueError(f"Medicamento {posicao}: a quantidade deve ser um número inteiro maior que zero.")
    if str(valor).strip() != str(numero) or not 1 <= numero <= 9999:
        raise ValueError(f"Medicamento {posicao}: a quantidade deve ser um número inteiro maior que zero.")
    return numero


def _texto(valor, maximo: int, rotulo: str, posicao: int):
    try:
        return texto_opcional(valor, maximo, rotulo)
    except ValueError as e:
        raise ValueError(f"Medicamento {posicao}: {e}")


def _montar_itens(itens, receita_atual: Receita | None = None) -> list[ReceitaItem]:
    """
    Converte a lista enviada pelo cliente em ReceitaItem.

    Cada medicamento vem do catálogo (`catalogo_id`), e RMS/descrição/laboratório são
    copiados dele. Ao editar uma receita, `id` de um item já existente mantém a cópia
    original, mesmo que o catálogo tenha mudado depois.
    """
    if not isinstance(itens, list) or not itens:
        raise ValueError("Adicione pelo menos um medicamento à receita.")
    if len(itens) > MAX_ITENS:
        raise ValueError(f"Uma receita pode ter no máximo {MAX_ITENS} medicamentos.")

    existentes = {i.id: i for i in receita_atual.itens} if receita_atual else {}
    novos = []

    for posicao, bruto in enumerate(itens, start=1):
        if not isinstance(bruto, dict):
            raise ValueError(f"Medicamento {posicao}: formato inválido.")

        catalogo_id = bruto.get("catalogo_id")
        if catalogo_id is not None:
            valido = isinstance(catalogo_id, int) and not isinstance(catalogo_id, bool)
            medicamento = db.session.get(CatalogoMedicamento, catalogo_id) if valido else None
            if medicamento is None or not medicamento.ativo:
                raise ValueError(f"Medicamento {posicao}: escolha um medicamento da lista do catálogo.")
            copia = (medicamento.descricao, medicamento.rms, medicamento.laboratorio)
        elif bruto.get("id") in existentes:
            antigo = existentes[bruto["id"]]
            copia = (antigo.medicamento, antigo.rms, antigo.laboratorio)
        else:
            raise ValueError(f"Medicamento {posicao}: escolha um medicamento da lista do catálogo.")

        novos.append(
            ReceitaItem(
                ordem=posicao,
                medicamento=copia[0],
                rms=copia[1],
                laboratorio=copia[2],
                dose=_texto(bruto.get("dose"), 60, "Dose", posicao),
                posologia=_texto(bruto.get("posologia"), 200, "Posologia", posicao),
                lote=_texto(bruto.get("lote"), 60, "Lote", posicao),
                validade=_texto(bruto.get("validade"), 20, "Validade", posicao),
                quantidade=_quantidade(bruto.get("quantidade"), posicao),
            )
        )
    return novos


class ReceitaService:
    """Regras de negócio para receitas (fichas de dispensação) com vários medicamentos."""

    @staticmethod
    def listar(cliente_id: int = None, limite: int = 50, pagina: int = 1):
        query = Receita.query
        if cliente_id:
            query = query.filter_by(cliente_id=cliente_id)

        query = query.order_by(Receita.data_venda.desc(), Receita.id.desc())
        paginacao = query.paginate(page=pagina, per_page=limite, error_out=False)

        return {
            "total": paginacao.total,
            "paginas": paginacao.pages,
            "pagina_atual": paginacao.page,
            "itens": [r.to_dict() for r in paginacao.items],
        }

    @staticmethod
    def obter_por_id(receita_id: int) -> Receita:
        return db.session.get(Receita, receita_id)

    @staticmethod
    def cadastrar(dados: dict) -> Receita:
        cliente_id = dados.get("cliente_id")
        if not cliente_id:
            raise ValueError("O ID do cliente (cliente_id) é obrigatório.")

        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise ValueError(f"Cliente com ID {cliente_id} não encontrado.")

        receita = Receita(
            cliente_id=cliente_id,
            data_venda=parse_data(dados.get("data_venda"), "Data da venda") or datetime.date.today(),
            medico_prescritor=texto_opcional(dados.get("medico_prescritor"), 200, "Médico prescritor"),
            observacoes=texto_opcional(dados.get("observacoes"), 2000, "Observações"),
            itens=_montar_itens(dados.get("itens")),
        )
        db.session.add(receita)
        db.session.commit()
        return receita

    @staticmethod
    def atualizar(receita_id: int, dados: dict) -> Receita:
        receita = db.session.get(Receita, receita_id)
        if not receita:
            raise ValueError("Receita não encontrada.")

        # Valida tudo antes de alterar qualquer campo.
        itens = _montar_itens(dados["itens"], receita) if "itens" in dados else None
        mudancas = {}
        if "medico_prescritor" in dados:
            mudancas["medico_prescritor"] = texto_opcional(dados["medico_prescritor"], 200, "Médico prescritor")
        if "observacoes" in dados:
            mudancas["observacoes"] = texto_opcional(dados["observacoes"], 2000, "Observações")
        if "data_venda" in dados and dados["data_venda"]:
            mudancas["data_venda"] = parse_data(dados["data_venda"], "Data da venda")

        for campo, valor in mudancas.items():
            setattr(receita, campo, valor)
        if itens is not None:
            receita.itens = itens  # os antigos são apagados (delete-orphan)
        db.session.commit()
        return receita

    @staticmethod
    def deletar(receita_id: int):
        receita = db.session.get(Receita, receita_id)
        if not receita:
            raise ValueError("Receita não encontrada.")
        db.session.delete(receita)
        db.session.commit()
