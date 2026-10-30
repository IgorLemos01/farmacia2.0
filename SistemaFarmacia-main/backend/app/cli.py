"""
Comandos de terminal para administrar o sistema.

    flask --app run criar-admin
    flask --app run redefinir-senha --email alguem@exemplo.com

A senha NUNCA fica no código nem no repositório: é digitada na hora (sem aparecer na tela)
ou gerada pelo comando e mostrada uma única vez.
"""
import secrets

import click

from app.services.auth_service import AuthService, EmailJaCadastrado


def _gerar_senha() -> str:
    # 16 caracteres aleatórios, sem símbolos que atrapalham ao digitar ou copiar
    return secrets.token_urlsafe(12).replace("-", "x").replace("_", "y")


def _obter_senha(senha: str | None, gerar: bool) -> tuple[str, bool]:
    """Devolve (senha, foi_gerada). Pergunta duas vezes quando precisa digitar."""
    if gerar:
        return _gerar_senha(), True
    if senha:
        return senha, False
    return click.prompt("Senha", hide_input=True, confirmation_prompt="Repita a senha"), False


def registrar(app) -> None:
    @app.cli.command("criar-admin")
    @click.option("--nome", prompt="Nome completo", help="Nome do administrador.")
    @click.option("--email", prompt="E-mail de acesso", help="E-mail usado no login.")
    @click.option("--senha", envvar="ADMIN_SENHA", default=None, help="Senha (se omitida, será pedida; evite digitar aqui).")
    @click.option("--gerar-senha", is_flag=True, help="Gera uma senha forte e mostra uma única vez.")
    def criar_admin(nome, email, senha, gerar_senha):
        """Cria um usuário administrador (acesso total ao sistema)."""
        senha, gerada = _obter_senha(senha, gerar_senha)
        try:
            usuario = AuthService.cadastrar(nome, email, senha, perfil="admin")
        except EmailJaCadastrado:
            raise click.ClickException(
                "Já existe um usuário com esse e-mail. Para trocar a senha dele use: flask --app run redefinir-senha"
            )
        except ValueError as e:
            raise click.ClickException(str(e))

        click.echo(f"Administrador criado: {usuario.nome} <{usuario.email}>")
        if gerada:
            click.echo(f"Senha gerada (anote agora, ela não será mostrada de novo): {senha}")

    @app.cli.command("redefinir-senha")
    @click.option("--email", prompt="E-mail do usuário", help="E-mail de quem terá a senha trocada.")
    @click.option("--senha", envvar="ADMIN_SENHA", default=None, help="Nova senha (se omitida, será pedida).")
    @click.option("--gerar-senha", is_flag=True, help="Gera uma senha forte e mostra uma única vez.")
    def redefinir_senha(email, senha, gerar_senha):
        """Troca a senha de um usuário (útil se o único administrador esquecer a dele)."""
        senha, gerada = _obter_senha(senha, gerar_senha)
        try:
            usuario = AuthService.redefinir_senha(email, senha)
        except LookupError as e:
            raise click.ClickException(str(e))
        except ValueError as e:
            raise click.ClickException(str(e))

        click.echo(f"Senha de {usuario.email} redefinida.")
        if gerada:
            click.echo(f"Nova senha (anote agora, ela não será mostrada de novo): {senha}")
