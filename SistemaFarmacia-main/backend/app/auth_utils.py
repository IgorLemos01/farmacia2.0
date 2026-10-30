from functools import wraps

# pyrefly: ignore[missing-import]
from flask_jwt_extended import get_jwt_identity, jwt_required
# pyrefly: ignore[missing-import]
from flask_restx import abort

from app.extensions import db
from app.models.usuario import Usuario


def usuario_atual() -> Usuario | None:
    """Usuário dono do token da requisição atual (buscado no banco)."""
    return db.session.get(Usuario, int(get_jwt_identity()))


def admin_required(fn):
    """
    Exige token válido de um administrador ativo.

    O perfil é lido do banco a cada chamada, e não do token: se um admin for
    rebaixado, o acesso some na hora, sem esperar o token expirar.
    """

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        usuario = usuario_atual()
        if not usuario or not usuario.ativo or not usuario.eh_admin:
            abort(403, "Apenas administradores podem executar esta ação.")
        return fn(*args, **kwargs)

    return wrapper


def modulo_required(*modulos: str):
    """
    Exige token válido de um usuário ativo que seja admin ou tenha pelo menos um dos módulos.

    Como em `admin_required`, os módulos são lidos do banco a cada chamada: quando o
    administrador retira um módulo, o acesso some na hora.
    """

    def decorador(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            usuario = usuario_atual()
            if not usuario or not usuario.tem_acesso(*modulos):
                abort(403, "Você não tem acesso a este módulo.")
            return fn(*args, **kwargs)

        return wrapper

    return decorador
