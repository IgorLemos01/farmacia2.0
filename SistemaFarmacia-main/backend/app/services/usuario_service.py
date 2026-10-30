from app.extensions import db
from app.modulos import MODULOS, PERFIS, normalizar_modulos
from app.models.usuario import Usuario
from app.services.auth_service import gerar_hash, validar_senha


class UsuarioService:
    """Regras de negócio da gestão de usuários (uso restrito a administradores)."""

    @staticmethod
    def listar() -> list[Usuario]:
        return Usuario.query.order_by(Usuario.nome.asc()).all()

    @staticmethod
    def atualizar(usuario_id: int, dados: dict, ator_id: int) -> Usuario:
        """
        Atualiza nome, perfil, módulos, situação (ativo) e/ou senha de um usuário.

        - `admin` sempre acessa todos os módulos.
        - `funcionario` precisa ter pelo menos um módulo; se `modulos` não for enviado,
          mantém os que já tinha.

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
                raise ValueError("Perfil inválido. Use 'admin' ou 'funcionario'.")
            if proprio and dados["perfil"] != "admin":
                raise ValueError("Você não pode remover o seu próprio acesso de administrador.")
            mudancas["perfil"] = dados["perfil"]

        if "ativo" in dados:
            if not isinstance(dados["ativo"], bool):
                raise ValueError("O campo 'ativo' deve ser verdadeiro ou falso.")
            if proprio and not dados["ativo"]:
                raise ValueError("Você não pode desativar o seu próprio usuário.")
            mudancas["ativo"] = dados["ativo"]

        if "modulos" in dados:
            mudancas["modulos"] = normalizar_modulos(dados["modulos"])

        # Resultado final de perfil + módulos (vale também quando só um dos dois foi enviado).
        perfil_final = mudancas.get("perfil", usuario.perfil)
        if perfil_final == "admin":
            mudancas["modulos"] = list(MODULOS)
        else:
            modulos_finais = mudancas.get("modulos", usuario.modulos_lista)
            if not modulos_finais:
                raise ValueError("Escolha ao menos um módulo para o funcionário.")
            mudancas["modulos"] = modulos_finais

        senha = dados.get("senha")
        if senha:
            mudancas["senha_hash"] = gerar_hash(validar_senha(senha))

        modulos = mudancas.pop("modulos")
        for campo, valor in mudancas.items():
            setattr(usuario, campo, valor)
        usuario.definir_modulos(modulos)
        db.session.commit()
        return usuario
