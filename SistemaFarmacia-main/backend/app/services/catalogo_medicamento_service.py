import re

from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.catalogo_medicamento import CatalogoMedicamento
from app.utils import texto_opcional

LIMITE_IMPORTACAO = 1000
_NOTACAO_CIENTIFICA = re.compile(r"^\d+([.,]\d+)?e[+-]?\d+$", re.IGNORECASE)


def _normalizar_descricao(valor) -> str:
    if not isinstance(valor, str):
        raise ValueError("A descrição do medicamento é obrigatória.")
    texto = " ".join(valor.split())
    if not texto:
        raise ValueError("A descrição do medicamento é obrigatória.")
    if len(texto) > 255:
        raise ValueError("A descrição deve ter no máximo 255 caracteres.")
    return texto


def _normalizar_rms(valor) -> str:
    """RMS sem espaços ('' se não houver). Recusa número que o Excel transformou em 1,02E+12."""
    if valor is None:
        return ""
    if not isinstance(valor, (str, int)) or isinstance(valor, bool):
        raise ValueError("RMS inválido.")
    rms = "".join(str(valor).split())
    if _NOTACAO_CIENTIFICA.match(rms):
        raise ValueError("RMS em notação científica: o Excel estragou o número. Use o CSV original.")
    if len(rms) > 30:
        raise ValueError("O RMS deve ter no máximo 30 caracteres.")
    return rms


def _normalizar_laboratorio(valor):
    if isinstance(valor, str):
        valor = " ".join(valor.split())
    return texto_opcional(valor, 150, "Laboratório")


def _chave(rms: str, descricao: str) -> tuple:
    return (rms, descricao.casefold())


def _indice() -> dict:
    """Todos os medicamentos (inclusive desativados), indexados por (RMS, descrição sem diferenciar maiúsculas)."""
    return {_chave(m.rms, m.descricao): m for m in CatalogoMedicamento.query.all()}


class CatalogoMedicamentoService:
    """Regras do catálogo de medicamentos (alterado apenas por administradores)."""

    @staticmethod
    def listar(apenas_ativos: bool = False) -> list[CatalogoMedicamento]:
        query = CatalogoMedicamento.query
        if apenas_ativos:
            query = query.filter_by(ativo=True)
        return query.order_by(CatalogoMedicamento.descricao.asc()).all()

    @staticmethod
    def _gravar():
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError("Já existe um medicamento com esse RMS e essa descrição.")

    @staticmethod
    def cadastrar(dados: dict) -> CatalogoMedicamento:
        descricao = _normalizar_descricao(dados.get("descricao"))
        rms = _normalizar_rms(dados.get("rms"))
        laboratorio = _normalizar_laboratorio(dados.get("laboratorio"))

        existente = _indice().get(_chave(rms, descricao))
        if existente:
            if existente.ativo:
                raise ValueError(f"Já existe '{existente.descricao}' com esse RMS.")
            raise ValueError(f"Já existe '{existente.descricao}' com esse RMS (desativado). Reative-o na lista.")

        medicamento = CatalogoMedicamento(rms=rms, descricao=descricao, laboratorio=laboratorio, ativo=True)
        db.session.add(medicamento)
        CatalogoMedicamentoService._gravar()
        return medicamento

    @staticmethod
    def atualizar(medicamento_id: int, dados: dict) -> CatalogoMedicamento:
        """
        Altera RMS, descrição, laboratório e/ou situação (ativo). Receitas já emitidas
        guardam uma cópia e não mudam.

        Raises:
            LookupError: medicamento não encontrado.
            ValueError: dado inválido ou combinação RMS + descrição repetida.
        """
        medicamento = db.session.get(CatalogoMedicamento, medicamento_id)
        if not medicamento:
            raise LookupError("Medicamento não encontrado no catálogo.")

        mudancas = {}
        if "descricao" in dados:
            mudancas["descricao"] = _normalizar_descricao(dados["descricao"])
        if "rms" in dados:
            mudancas["rms"] = _normalizar_rms(dados["rms"])
        if "laboratorio" in dados:
            mudancas["laboratorio"] = _normalizar_laboratorio(dados["laboratorio"])
        if "ativo" in dados:
            if not isinstance(dados["ativo"], bool):
                raise ValueError("O campo 'ativo' deve ser verdadeiro ou falso.")
            mudancas["ativo"] = dados["ativo"]

        nova_chave = _chave(mudancas.get("rms", medicamento.rms), mudancas.get("descricao", medicamento.descricao))
        outro = _indice().get(nova_chave)
        if outro and outro.id != medicamento.id:
            raise ValueError(f"Já existe '{outro.descricao}' com esse RMS.")

        for campo, valor in mudancas.items():
            setattr(medicamento, campo, valor)
        CatalogoMedicamentoService._gravar()
        return medicamento

    @staticmethod
    def importar(itens) -> dict:
        """
        Cadastra vários medicamentos de uma vez (ex.: vindos de uma planilha CSV).

        - RMS + descrição novos: cria.
        - Já existe: atualiza o laboratório (e reativa, se estava desativado).
        - Linhas inválidas ou repetidas no arquivo são ignoradas e listadas em `erros`.
        """
        if not isinstance(itens, list) or not itens:
            raise ValueError("Nenhum medicamento para importar.")
        if len(itens) > LIMITE_IMPORTACAO:
            raise ValueError(f"Importe no máximo {LIMITE_IMPORTACAO} medicamentos por vez.")

        indice = _indice()
        vistos = set()
        criados = atualizados = iguais = 0
        erros = []

        for posicao, item in enumerate(itens, start=1):
            bruto = item if isinstance(item, dict) else {}
            linha = bruto.get("linha", posicao)
            try:
                descricao = _normalizar_descricao(bruto.get("descricao"))
                rms = _normalizar_rms(bruto.get("rms"))
                laboratorio = _normalizar_laboratorio(bruto.get("laboratorio"))
            except ValueError as e:
                erros.append({"linha": linha, "nome": str(bruto.get("descricao") or ""), "motivo": str(e)})
                continue

            chave = _chave(rms, descricao)
            if chave in vistos:
                erros.append({"linha": linha, "nome": descricao, "motivo": "Medicamento repetido no arquivo."})
                continue
            vistos.add(chave)

            existente = indice.get(chave)
            if existente is None:
                novo = CatalogoMedicamento(rms=rms, descricao=descricao, laboratorio=laboratorio, ativo=True)
                db.session.add(novo)
                indice[chave] = novo
                criados += 1
            elif existente.laboratorio != laboratorio or not existente.ativo:
                existente.laboratorio = laboratorio
                existente.ativo = True
                atualizados += 1
            else:
                iguais += 1

        CatalogoMedicamentoService._gravar()
        return {"criados": criados, "atualizados": atualizados, "iguais": iguais, "erros": erros}
