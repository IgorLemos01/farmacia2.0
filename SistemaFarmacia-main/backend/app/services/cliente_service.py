import datetime

# pyrefly: ignore[missing-import]
from sqlalchemy import or_

from app.extensions import db
from app.models.cliente import Cliente
from app.utils import (
    normalizar_cep,
    normalizar_cpf,
    normalizar_email,
    normalizar_telefone,
    normalizar_uf,
    parse_data,
    texto_opcional,
)

SEXOS = ("M", "F", "Outro")


def _nome(valor) -> str:
    if not isinstance(valor, str) or not " ".join(valor.split()):
        raise ValueError("O campo 'Nome completo' é obrigatório.")
    nome = " ".join(valor.split())
    if len(nome) < 2:
        raise ValueError("Informe o nome do cliente.")
    if len(nome) > 150:
        raise ValueError("O nome deve ter no máximo 150 caracteres.")
    return nome


def _sexo(valor):
    if valor in (None, ""):
        return None
    if valor not in SEXOS:
        raise ValueError("Sexo inválido. Utilize 'M', 'F' ou 'Outro'.")
    return valor


def _nascimento(valor):
    data = parse_data(valor, "Data de nascimento")
    if data and data > datetime.date.today():
        raise ValueError("A data de nascimento não pode ser no futuro.")
    if data and data.year < 1900:
        raise ValueError("Data de nascimento inválida.")
    return data


def _texto_livre(valor, rotulo: str, maximo: int = 5000):
    return texto_opcional(valor, maximo, rotulo)


# campo → função que valida/normaliza o valor enviado (None = apagar)
_NORMALIZADORES = {
    "nome": _nome,
    "telefone": normalizar_telefone,
    "cpf": normalizar_cpf,
    "rg": lambda v: texto_opcional(v, 20, "RG"),
    "data_nascimento": _nascimento,
    "sexo": _sexo,
    "email": normalizar_email,
    "cep": normalizar_cep,
    "endereco": lambda v: texto_opcional(v, 300, "Rua / Logradouro"),
    "numero": lambda v: texto_opcional(v, 20, "Número"),
    "complemento": lambda v: texto_opcional(v, 100, "Complemento"),
    "bairro": lambda v: texto_opcional(v, 100, "Bairro"),
    "cidade": lambda v: texto_opcional(v, 100, "Cidade"),
    "estado": normalizar_uf,
    "alergia": lambda v: _texto_livre(v, "Alergias"),
    "observacoes": lambda v: _texto_livre(v, "Observações"),
}


def _validar(dados: dict, campos) -> dict:
    """Valida só os campos informados; devolve {campo: valor normalizado}."""
    if not isinstance(dados, dict):
        raise ValueError("Dados inválidos.")
    return {campo: _NORMALIZADORES[campo](dados.get(campo)) for campo in campos}


def _conferir_cpf_unico(cpf, ignorar_id=None):
    if not cpf:
        return
    existente = Cliente.query.filter(Cliente.cpf == cpf).first()
    if existente and existente.id != ignorar_id:
        raise ValueError(f"O CPF {cpf} já pertence ao cliente {existente.nome}.")


class ClienteService:
    """
    Regras de negócio para clientes (cadastro progressivo).

    Só nome e telefone são obrigatórios: no balcão o cliente nem sempre tem documentos.
    O restante pode ser completado depois (PUT parcial).
    """

    @staticmethod
    def listar(busca: str = None, limite: int = 50, pagina: int = 1):
        query = Cliente.query
        limite = max(1, min(limite or 50, 200))

        if busca and busca.strip():
            termo = f"%{busca.strip()}%"
            query = query.filter(
                or_(
                    Cliente.nome.ilike(termo),
                    Cliente.cpf.like(termo),
                    Cliente.telefone.like(termo),
                    Cliente.email.ilike(termo),
                )
            )

        query = query.order_by(Cliente.nome.asc())
        paginacao = query.paginate(page=pagina, per_page=limite, error_out=False)
        itens = paginacao.items

        return {
            "total": paginacao.total,
            "paginas": paginacao.pages,
            "pagina_atual": paginacao.page,
            "itens": [c.to_dict() for c in itens],
        }

    @staticmethod
    def obter_por_id(cliente_id: int) -> Cliente:
        return db.session.get(Cliente, cliente_id)

    @staticmethod
    def cadastrar(dados: dict) -> Cliente:
        """Cria o cliente. Obrigatórios: nome e telefone; os outros campos são opcionais."""
        valores = _validar(dados, _NORMALIZADORES.keys())
        _conferir_cpf_unico(valores["cpf"])

        cliente = Cliente(**valores)
        db.session.add(cliente)
        db.session.commit()
        return cliente

    @staticmethod
    def atualizar(cliente_id: int, dados: dict) -> Cliente:
        """Atualiza só os campos enviados (permite completar o cadastro aos poucos)."""
        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise LookupError("Cliente não encontrado.")
        if not isinstance(dados, dict):
            raise ValueError("Dados inválidos.")

        campos = [c for c in _NORMALIZADORES if c in dados]
        # CPF igual ao já salvo não é revalidado (cadastros antigos podem ter CPF fora do padrão)
        if "cpf" in campos and (dados.get("cpf") or None) == cliente.cpf:
            campos.remove("cpf")
        valores = _validar(dados, campos)
        if "cpf" in valores:
            _conferir_cpf_unico(valores["cpf"], ignorar_id=cliente.id)

        for campo, valor in valores.items():
            setattr(cliente, campo, valor)
        db.session.commit()
        return cliente

    @staticmethod
    def deletar(cliente_id: int):
        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise LookupError("Cliente não encontrado.")

        # Integridade referencial
        if cliente.manipulacoes.count() > 0 or cliente.exames.count() > 0 or cliente.receitas.count() > 0:
            raise ValueError(
                "Não é possível excluir este cliente pois existem manipulações, exames ou receitas vinculados."
            )

        db.session.delete(cliente)
        db.session.commit()

    @staticmethod
    def obter_dossie(cliente_id: int) -> dict:
        """Retorna os dados cadastrais do cliente + histórico completo de saúde."""
        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise LookupError("Cliente não encontrado.")

        return {
            "cliente": cliente.to_dict(),
            "historico": {
                "manipulacoes": [m.to_dict() for m in cliente.manipulacoes.order_by(db.desc("data")).all()],
                "exames": [e.to_dict() for e in cliente.exames.order_by(db.desc("data")).all()],
                "receitas": [r.to_dict() for r in cliente.receitas.order_by(db.desc("data_venda")).all()],
            },
        }
