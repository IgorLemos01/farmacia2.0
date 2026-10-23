import bcrypt
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.usuario import Usuario


class AuthService:
    """
    Camada de serviço responsável pelas regras de negócio de autenticação.

    Mantida separada das rotas para que a lógica possa ser testada
    independentemente do HTTP.
    """

    @staticmethod
    def cadastrar(nome: str, email: str, senha: str, perfil: str = "atendente") -> Usuario:
        """
        Cria um novo usuário no banco.

        Raises:
            ValueError: se o e-mail já estiver cadastrado.
        """
        if Usuario.query.filter_by(email=email.lower()).first():
            raise ValueError("E-mail já cadastrado.")

        senha_hash = bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        usuario = Usuario(
            nome=nome.strip(),
            email=email.lower().strip(),
            senha_hash=senha_hash,
            perfil=perfil,
        )
        db.session.add(usuario)
        db.session.commit()
        return usuario

    @staticmethod
    def login(email: str, senha: str) -> dict:
        """
        Valida credenciais e retorna um token JWT se corretas.

        Raises:
            ValueError: se e-mail não encontrado, senha incorreta ou usuário inativo.
        """
        usuario = Usuario.query.filter_by(email=email.lower()).first()

        if not usuario:
            raise ValueError("E-mail ou senha incorretos.")

        if not usuario.ativo:
            raise ValueError("Usuário desativado. Entre em contato com o administrador.")

        senha_valida = bcrypt.checkpw(senha.encode("utf-8"), usuario.senha_hash.encode("utf-8"))
        if not senha_valida:
            raise ValueError("E-mail ou senha incorretos.")

        # O token carrega o id do usuário como identidade
        token = create_access_token(
            identity=str(usuario.id),
            additional_claims={"perfil": usuario.perfil, "nome": usuario.nome},
        )

        return {
            "access_token": token,
            "usuario": usuario.to_dict(),
        }
