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
        if not usuario or not usuario.ativo or usuario.perfil != "admin":
            abort(403, "Apenas administradores podem executar esta ação.")
        return fn(*args, **kwargs)

    return wrapper
