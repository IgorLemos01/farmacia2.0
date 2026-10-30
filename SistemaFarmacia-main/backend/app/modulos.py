"""Perfis e módulos de acesso do sistema."""

PERFIS = ("admin", "funcionario")

# Cada módulo corresponde a uma tela do sistema. A tela de Configurações (usuários e
# catálogos) não é um módulo: é exclusiva do perfil admin.
MODULOS = ("dashboard", "clientes", "manipulacoes", "exames", "receitas")

# Quem pode CONSULTAR a lista de clientes: todo módulo que precisa escolher um paciente
# ou mostrar dados dele. Criar, editar, excluir e abrir o dossiê exige o módulo "clientes".
MODULOS_QUE_LEEM_CLIENTES = ("clientes", "manipulacoes", "exames", "receitas", "dashboard")


def normalizar_modulos(valor) -> list[str]:
    """
    Valida uma lista de módulos e devolve sem repetidos, na ordem padrão do sistema.

    Raises:
        ValueError: se não for uma lista ou houver módulo desconhecido.
    """
    if valor is None:
        return []
    if not isinstance(valor, (list, tuple)):
        raise ValueError("Módulos inválidos: envie uma lista.")
    escolhidos = set()
    for modulo in valor:
        if not isinstance(modulo, str) or modulo not in MODULOS:
            raise ValueError(f"Módulo inválido: {modulo!r}.")
        escolhidos.add(modulo)
    return [m for m in MODULOS if m in escolhidos]
