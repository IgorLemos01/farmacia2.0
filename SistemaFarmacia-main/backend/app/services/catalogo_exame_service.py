from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.catalogo_exame import CatalogoExame
from app.utils import parse_valor

LIMITE_IMPORTACAO = 1000


def _normalizar_nome(nome) -> str:
    """Tira espaços sobrando; devolve o nome como o usuário escreveu (sem mudar maiúsculas)."""
    if not isinstance(nome, str):
        raise ValueError("O nome do exame é obrigatório.")
    nome = " ".join(nome.split())
    if not nome:
        raise ValueError("O nome do exame é obrigatório.")  # nomes de 1 letra são válidos (ex.: "K" = potássio)
    if len(nome) > 200:
        raise ValueError("O nome do exame deve ter no máximo 200 caracteres.")
    return nome


def _indice_por_nome() -> dict:
    """Todos os exames (inclusive desativados) indexados pelo nome sem diferenciar maiúsculas."""
    return {e.nome.casefold(): e for e in CatalogoExame.query.all()}


class CatalogoExameService:
    """Regras de negócio do catálogo de exames (alterado apenas por administradores)."""

    @staticmethod
    def listar(apenas_ativos: bool = False) -> list[CatalogoExame]:
        query = CatalogoExame.query
        if apenas_ativos:
            query = query.filter_by(ativo=True)
        return query.order_by(CatalogoExame.nome.asc()).all()

    @staticmethod
    def obter(exame_id: int) -> CatalogoExame | None:
        return db.session.get(CatalogoExame, exame_id)

    @staticmethod
    def _gravar():
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError("Já existe um exame com um nome equivalente.")

    @staticmethod
    def cadastrar(dados: dict) -> CatalogoExame:
        nome = _normalizar_nome(dados.get("nome"))
        valor = parse_valor(dados.get("valor"), "Valor")

        existente = _indice_por_nome().get(nome.casefold())
        if existente:
            if existente.ativo:
                raise ValueError(f"Já existe um exame chamado '{existente.nome}'.")
            raise ValueError(f"Já existe um exame chamado '{existente.nome}' (desativado). Reative-o na lista.")

        exame = CatalogoExame(nome=nome, valor=valor, ativo=True)
        db.session.add(exame)
        CatalogoExameService._gravar()
        return exame

    @staticmethod
    def atualizar(exame_id: int, dados: dict) -> CatalogoExame:
        """
        Altera nome, valor e/ou situação (ativo). Desativar tira o exame da lista de
        escolha sem apagar nada: exames já registrados continuam como estão.

        Raises:
            LookupError: exame não encontrado.
            ValueError: dado inválido ou nome repetido.
        """
        exame = db.session.get(CatalogoExame, exame_id)
        if not exame:
            raise LookupError("Exame não encontrado no catálogo.")

        mudancas = {}
        if "nome" in dados:
            nome = _normalizar_nome(dados["nome"])
            outro = _indice_por_nome().get(nome.casefold())
            if outro and outro.id != exame.id:
                raise ValueError(f"Já existe um exame chamado '{outro.nome}'.")
            mudancas["nome"] = nome
        if "valor" in dados:
            mudancas["valor"] = parse_valor(dados["valor"], "Valor")
        if "ativo" in dados:
            if not isinstance(dados["ativo"], bool):
                raise ValueError("O campo 'ativo' deve ser verdadeiro ou falso.")
            mudancas["ativo"] = dados["ativo"]

        for campo, valor in mudancas.items():
            setattr(exame, campo, valor)
        CatalogoExameService._gravar()
        return exame

    @staticmethod
    def importar(itens) -> dict:
        """
        Cadastra vários exames de uma vez (ex.: vindos de uma planilha CSV).

        - Nome novo: cria.
        - Nome que já existe: atualiza o valor (e reativa, se estava desativado).
        - Linhas inválidas ou repetidas no arquivo são ignoradas e listadas em `erros`;
          as demais são gravadas.
        """
        if not isinstance(itens, list) or not itens:
            raise ValueError("Nenhum exame para importar.")
        if len(itens) > LIMITE_IMPORTACAO:
            raise ValueError(f"Importe no máximo {LIMITE_IMPORTACAO} exames por vez.")

        indice = _indice_por_nome()
        vistos = set()
        criados = atualizados = iguais = 0
        erros = []

        for posicao, item in enumerate(itens, start=1):
            bruto = item if isinstance(item, dict) else {}
            linha = bruto.get("linha", posicao)
            try:
                nome = _normalizar_nome(bruto.get("nome"))
                valor = parse_valor(bruto.get("valor"), "Valor")
            except ValueError as e:
                erros.append({"linha": linha, "nome": str(bruto.get("nome") or ""), "motivo": str(e)})
                continue

            chave = nome.casefold()
            if chave in vistos:
                erros.append({"linha": linha, "nome": nome, "motivo": "Nome repetido no arquivo."})
                continue
            vistos.add(chave)

            existente = indice.get(chave)
            if existente is None:
                novo = CatalogoExame(nome=nome, valor=valor, ativo=True)
                db.session.add(novo)
                indice[chave] = novo
                criados += 1
            elif existente.valor != valor or not existente.ativo:
                existente.valor = valor
                existente.ativo = True
                atualizados += 1
            else:
                iguais += 1

        CatalogoExameService._gravar()
        return {"criados": criados, "atualizados": atualizados, "iguais": iguais, "erros": erros}
