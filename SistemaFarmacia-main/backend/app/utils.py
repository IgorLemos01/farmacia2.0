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


def texto_opcional(valor, maximo: int, rotulo: str):
    """Texto sem espaços nas pontas, ou None se vier vazio. ValueError se não for texto ou passar do limite."""
    if valor is None:
        return None
    if not isinstance(valor, str):
        raise ValueError(f"{rotulo} inválido.")
    texto = valor.strip()
    if not texto:
        return None
    if len(texto) > maximo:
        raise ValueError(f"{rotulo} deve ter no máximo {maximo} caracteres.")
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


# ── Validações de cadastro (CPF, telefone, CEP, UF, e-mail) ──────────────────

UFS = (
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
)


def so_digitos(valor) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def cpf_valido(digitos: str) -> bool:
    """Confere os dois dígitos verificadores do CPF (11 dígitos, sem repetição)."""
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(digitos[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(digitos[tamanho]):
            return False
    return True


def normalizar_cpf(valor):
    """CPF formatado '000.000.000-00', ou None se vier vazio. ValueError se for inválido."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    if not isinstance(valor, str):
        raise ValueError("CPF inválido.")
    digitos = so_digitos(valor)
    if not cpf_valido(digitos):
        raise ValueError("CPF inválido. Confira os números ou deixe o campo em branco.")
    return f"{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}"


def normalizar_telefone(valor, obrigatorio: bool = True):
    """Telefone/WhatsApp com DDD: 10 ou 11 dígitos (aceita +55 na frente)."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        if obrigatorio:
            raise ValueError("O campo 'WhatsApp / Telefone' é obrigatório.")
        return None
    if not isinstance(valor, str):
        raise ValueError("Telefone inválido.")
    digitos = so_digitos(valor)
    if len(digitos) in (12, 13) and digitos.startswith("55"):
        digitos = digitos[2:]
    if len(digitos) not in (10, 11):
        raise ValueError("Telefone inválido. Informe o DDD e o número, ex.: (79) 99999-9999.")
    if len(digitos) == 11:
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"


def normalizar_cep(valor):
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    if not isinstance(valor, str):
        raise ValueError("CEP inválido.")
    digitos = so_digitos(valor)
    if len(digitos) != 8:
        raise ValueError("CEP inválido. Use 8 números, ex.: 49000-000.")
    return f"{digitos[:5]}-{digitos[5:]}"


def normalizar_uf(valor):
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    if not isinstance(valor, str) or valor.strip().upper() not in UFS:
        raise ValueError("Estado (UF) inválido. Use a sigla, ex.: SE.")
    return valor.strip().upper()


def normalizar_email(valor, maximo: int = 150):
    texto = texto_opcional(valor, maximo, "E-mail")
    if texto is None:
        return None
    texto = texto.lower()
    if " " in texto or texto.count("@") != 1 or "." not in texto.split("@")[1]:
        raise ValueError("E-mail inválido.")
    return texto
