import datetime


def agora_utc() -> datetime.datetime:
    """Data/hora atual em UTC, sem fuso (as colunas DateTime do banco são "naive")."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


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
