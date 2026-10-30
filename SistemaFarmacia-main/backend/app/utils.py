import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation


def agora_utc() -> datetime.datetime:
    """Data/hora atual em UTC, sem fuso (as colunas DateTime do banco são "naive")."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def texto_obrigatorio(valor, rotulo: str) -> str:
    """Devolve o texto sem espaços nas pontas; levanta ValueError se vier vazio ou nulo."""
    texto = (valor or "").strip() if isinstance(valor, str) or valor is None else ""
    if not texto:
        raise ValueError(f"O campo '{rotulo}' é obrigatório.")
    return texto


def parse_valor(valor, rotulo: str = "Valor") -> Decimal:
    """
    Converte um número em Decimal com 2 casas (dinheiro).

    Aceita número ou texto numérico com ponto decimal ("12.5"); a conversão de
    "R$ 1.250,00" é feita pelo frontend.

    Raises:
        ValueError: ausente, não numérico, negativo ou grande demais.
    """
    if valor is None or isinstance(valor, bool) or valor == "":
        raise ValueError(f"{rotulo} é obrigatório.")
    try:
        numero = Decimal(str(valor).strip())
    except InvalidOperation:
        raise ValueError(f"{rotulo} inválido.")
    if not numero.is_finite():
        raise ValueError(f"{rotulo} inválido.")
    if numero < 0:
        raise ValueError(f"{rotulo} não pode ser negativo.")
    if numero > Decimal("99999999.99"):
        raise ValueError(f"{rotulo} muito alto.")
    return numero.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_data(valor, campo: str = "Data"):
    """
    Converte 'AAAA-MM-DD' em datetime.date.

    Aceita None/'' (retorna None) e objetos date já convertidos.

    Raises:
        ValueError: com mensagem amigável se o formato for inválido,
        para que a rota responda 400 em vez de 500.
    """
    if valor in (None, ""):
        return None
    if isinstance(valor, datetime.date):
        return valor
    try:
        return datetime.date.fromisoformat(str(valor))
    except ValueError:
        raise ValueError(f"{campo} inválida. Use o formato AAAA-MM-DD.")
