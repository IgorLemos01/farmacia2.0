import datetime

from app.extensions import db
from app.models.catalogo_medicamento import CatalogoMedicamento
from app.models.cliente import Cliente
from app.models.receita import Receita, ReceitaItem
from app.models.usuario import Usuario
from app.services.catalogo_medicamento_service import normalizar_laboratorio, normalizar_rms
from app.utils import parse_data, texto_opcional

MAX_ITENS = 12  # a ficha impressa (tamanho cheque) leva 3 por folha; acima disso gera mais folhas


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

    `rms` e `laboratorio`, quando enviados no item, substituem os do catálogo só nesta
    receita (a caixa entregue pode ser de outro fabricante). O catálogo não muda.
    Dose e posologia são opcionais (o nome comercial costuma já trazer a dosagem).
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

        rms, laboratorio = copia[1], copia[2]
        try:
            if "rms" in bruto:
                rms = normalizar_rms(bruto.get("rms"))
            if "laboratorio" in bruto:
                laboratorio = normalizar_laboratorio(bruto.get("laboratorio"))
        except ValueError as e:
            raise ValueError(f"Medicamento {posicao}: {e}")

        novos.append(
            ReceitaItem(
                ordem=posicao,
                medicamento=copia[0],
                rms=rms,
                laboratorio=laboratorio,
                dose=_texto(bruto.get("dose"), 60, "Dose", posicao),
                posologia=_texto(bruto.get("posologia"), 200, "Posologia", posicao),
                lote=_texto(bruto.get("lote"), 60, "Lote", posicao),
                validade=_texto(bruto.get("validade"), 20, "Validade", posicao),
                quantidade=_quantidade(bruto.get("quantidade"), posicao),
            )
        )
    return novos


def farmaceuticos_ativos() -> list[Usuario]:
    return (
        Usuario.query.filter_by(ativo=True, farmaceutico=True)
        .order_by(Usuario.nome.asc())
        .all()
    )


def _aplicar_farmaceutico(receita: Receita, usuario: Usuario | None) -> None:
    receita.farmaceutico_id = usuario.id if usuario else None
    receita.farmaceutico_nome = usuario.nome if usuario else None
    receita.farmaceutico_cargo = usuario.cargo if usuario else None
    receita.farmaceutico_registro = usuario.registro_profissional if usuario else None


def _resolver_farmaceutico(dados: dict, ator: Usuario | None, obrigatorio: bool):
    """
    Decide quem é o farmacêutico responsável pela receita.

    1. `farmaceutico_id` enviado: precisa ser um usuário ativo marcado como farmacêutico.
    2. Sem escolha: o próprio usuário logado, se for farmacêutico.
    3. Senão, se houver um único farmacêutico ativo, ele (responsável técnico).
    4. Com vários farmacêuticos e nenhum escolhido: pede para escolher.
       Sem nenhum farmacêutico cadastrado, a ficha sai com o campo em branco (assinatura à mão).

    Devolve (encontrou_decisao, usuario_ou_None).
    """
    escolhido = dados.get("farmaceutico_id")
    if escolhido not in (None, ""):
        valido = isinstance(escolhido, int) and not isinstance(escolhido, bool)
        usuario = db.session.get(Usuario, escolhido) if valido else None
        if not usuario or not usuario.ativo or not usuario.farmaceutico:
            raise ValueError("Farmacêutico responsável inválido. Escolha um da lista.")
        return True, usuario
    if not obrigatorio:
        return False, None
    if ator and ator.ativo and ator.farmaceutico:
        return True, ator
    disponiveis = farmaceuticos_ativos()
    if len(disponiveis) == 1:
        return True, disponiveis[0]
    if len(disponiveis) > 1:
        raise ValueError("Selecione o farmacêutico responsável pela receita.")
    return True, None


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
    def cadastrar(dados: dict, ator: Usuario | None = None) -> Receita:
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
        _, farmaceutico = _resolver_farmaceutico(dados, ator, obrigatorio=True)
        _aplicar_farmaceutico(receita, farmaceutico)
        db.session.add(receita)
        db.session.commit()
        return receita

    @staticmethod
    def atualizar(receita_id: int, dados: dict) -> Receita:
        receita = db.session.get(Receita, receita_id)
        if not receita:
            raise LookupError("Receita não encontrada.")
        dados = dados or {}

        # Valida tudo antes de alterar qualquer campo.
        itens = _montar_itens(dados["itens"], receita) if "itens" in dados else None
        # Na edição o responsável só muda se outro for escolhido (o da emissão é mantido).
        trocar, farmaceutico = _resolver_farmaceutico(dados, None, obrigatorio=False)
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
        if trocar:
            _aplicar_farmaceutico(receita, farmaceutico)
        db.session.commit()
        return receita

    @staticmethod
    def deletar(receita_id: int):
        receita = db.session.get(Receita, receita_id)
        if not receita:
            raise LookupError("Receita não encontrada.")
        db.session.delete(receita)
        db.session.commit()
