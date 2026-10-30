import bcrypt

from app.extensions import db
from app.models.usuario import Usuario

PERFIS = ("admin", "atendente")


class UsuarioService:
    """Regras de negócio da gestão de usuários (uso restrito a administradores)."""

    @staticmethod
    def listar() -> list[Usuario]:
        return Usuario.query.order_by(Usuario.nome.asc()).all()

    @staticmethod
    def atualizar(usuario_id: int, dados: dict, ator_id: int) -> Usuario:
        """
        Atualiza nome, perfil, situação (ativo) e/ou senha de um usuário.

        Raises:
            LookupError: usuário não encontrado.
            ValueError: dado inválido, ou tentativa de o administrador tirar o
                próprio acesso (rebaixar ou desativar a si mesmo).
        """
        usuario = db.session.get(Usuario, usuario_id)
        if not usuario:
            raise LookupError("Usuário não encontrado.")
        proprio = usuario.id == ator_id

        # Valida tudo antes de alterar qualquer campo.
        mudancas = {}

        if "nome" in dados:
            nome = (dados["nome"] or "").strip()
            if len(nome) < 3:
                raise ValueError("Nome deve ter pelo menos 3 caracteres.")
            mudancas["nome"] = nome

        if "perfil" in dados:
            if dados["perfil"] not in PERFIS:
                raise ValueError("Perfil inválido. Use 'admin' ou 'atendente'.")
            if proprio and dados["perfil"] != "admin":
                raise ValueError("Você não pode remover o seu próprio acesso de administrador.")
            mudancas["perfil"] = dados["perfil"]

        if "ativo" in dados:
            if not isinstance(dados["ativo"], bool):
                raise ValueError("O campo 'ativo' deve ser verdadeiro ou falso.")
            if proprio and not dados["ativo"]:
                raise ValueError("Você não pode desativar o seu próprio usuário.")
            mudancas["ativo"] = dados["ativo"]

        senha = dados.get("senha")
        if senha:
            if len(senha) < 6:
                raise ValueError("Senha deve ter pelo menos 6 caracteres.")
            mudancas["senha_hash"] = bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        for campo, valor in mudancas.items():
            setattr(usuario, campo, valor)
        db.session.commit()
        return usuario
