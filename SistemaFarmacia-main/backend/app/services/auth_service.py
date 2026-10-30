import re

import bcrypt
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.modulos import MODULOS, PERFIS, normalizar_modulos
from app.models.usuario import Usuario

SENHA_MINIMA = 6
_EMAIL_VALIDO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailJaCadastrado(ValueError):
    """O e-mail informado já pertence a outro usuário."""


def gerar_hash(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def validar_senha(senha) -> str:
    if not isinstance(senha, str) or len(senha) < SENHA_MINIMA:
        raise ValueError(f"Senha deve ter pelo menos {SENHA_MINIMA} caracteres.")
    return senha


class AuthService:
    """
    Camada de serviço responsável pelas regras de negócio de autenticação.

    Mantida separada das rotas para que a lógica possa ser testada
    independentemente do HTTP (e reaproveitada pelos comandos de terminal).
    """

    @staticmethod
    def cadastrar(nome: str, email: str, senha: str, perfil: str = "funcionario", modulos=None) -> Usuario:
        """
        Cria um novo usuário no banco.

        - `admin` sempre acessa todos os módulos (a lista enviada é ignorada).
        - `funcionario` precisa de pelo menos um módulo.

        Raises:
            EmailJaCadastrado: o e-mail já existe (a rota responde 409).
            ValueError: qualquer dado inválido (a rota responde 400).
        """
        nome = nome.strip() if isinstance(nome, str) else ""
        if len(nome) < 3:
            raise ValueError("Nome deve ter pelo menos 3 caracteres.")
        if len(nome) > 120:
            raise ValueError("Nome deve ter no máximo 120 caracteres.")

        email = email.strip().lower() if isinstance(email, str) else ""
        if len(email) > 120 or not _EMAIL_VALIDO.match(email):
            raise ValueError("E-mail inválido.")

        validar_senha(senha)

        if perfil not in PERFIS:
            raise ValueError("Perfil inválido. Use 'admin' ou 'funcionario'.")
        lista = list(MODULOS) if perfil == "admin" else normalizar_modulos(modulos)
        if perfil != "admin" and not lista:
            raise ValueError("Escolha ao menos um módulo para o funcionário.")

        if Usuario.query.filter_by(email=email).first():
            raise EmailJaCadastrado("E-mail já cadastrado.")

        usuario = Usuario(nome=nome, email=email, senha_hash=gerar_hash(senha), perfil=perfil)
        usuario.definir_modulos(lista)
        db.session.add(usuario)
        db.session.commit()
        return usuario

    @staticmethod
    def redefinir_senha(email: str, nova_senha: str) -> Usuario:
        """Troca a senha de um usuário existente (usada pelo comando de terminal)."""
        validar_senha(nova_senha)
        usuario = Usuario.query.filter_by(email=(email or "").strip().lower()).first()
        if not usuario:
            raise LookupError("Nenhum usuário com esse e-mail.")
        usuario.senha_hash = gerar_hash(nova_senha)
        db.session.commit()
        return usuario

    @staticmethod
    def login(email: str, senha: str) -> dict:
        """
        Valida credenciais e retorna um token JWT se corretas.

        Raises:
            ValueError: se e-mail não encontrado, senha incorreta ou usuário inativo.
        """
        usuario = Usuario.query.filter_by(email=(email or "").strip().lower()).first()

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
