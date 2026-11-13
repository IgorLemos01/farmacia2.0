from app.extensions import db
from app.modulos import MODULOS
from app.utils import agora_utc


class Usuario(db.Model):
    """
    Tabela de usuários do sistema.

    Campos:
        id          — Chave primária auto incrementada.
        nome        — Nome completo do usuário.
        email       — E-mail único usado no login.
        senha_hash  — Hash bcrypt da senha (nunca armazenamos a senha em texto puro).
        perfil      — 'admin' (acesso total, gerencia usuários e catálogos) ou 'funcionario'.
        modulos     — Módulos liberados, separados por vírgula (ex.: "clientes,receitas"). Vale para
                      o funcionário; o admin sempre acessa todos.
        ativo       — Se False, o usuário está desativado e não consegue logar.
        cargo       — Cargo exibido em receitas e relatórios (ex.: "Farmacêutico Responsável").
        registro_profissional — Registro no conselho (ex.: "CRF-SE 1234").
        farmaceutico — True = pode ser escolhido como farmacêutico responsável das receitas.
        criado_em   — Data/hora de criação do registro.
    """

    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    senha_hash = db.Column(db.String(255), nullable=False)
    perfil = db.Column(db.Enum("admin", "funcionario"), nullable=False, default="funcionario")
    modulos = db.Column(db.String(200), nullable=False, default="")
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    cargo = db.Column(db.String(80), nullable=True)
    registro_profissional = db.Column(db.String(40), nullable=True)
    farmaceutico = db.Column(db.Boolean, nullable=False, default=False)
    criado_em = db.Column(db.DateTime, nullable=False, default=agora_utc)

    @property
    def eh_admin(self) -> bool:
        return self.perfil == "admin"

    @property
    def modulos_lista(self) -> list[str]:
        """Módulos guardados para este usuário, válidos e na ordem padrão."""
        guardados = {m for m in (self.modulos or "").split(",") if m}
        return [m for m in MODULOS if m in guardados]

    def definir_modulos(self, lista) -> None:
        self.modulos = ",".join(lista)

    @property
    def modulos_efetivos(self) -> list[str]:
        """Módulos que o usuário realmente acessa: todos para o admin, os liberados para o funcionário."""
        return list(MODULOS) if self.eh_admin else self.modulos_lista

    def tem_acesso(self, *modulos: str) -> bool:
        """True se o usuário está ativo e é admin ou tem pelo menos um dos módulos informados."""
        if not self.ativo:
            return False
        if self.eh_admin:
            return True
        liberados = self.modulos_lista
        return any(m in liberados for m in modulos)

    def to_dict(self):
        """Retorna representação segura do usuário (sem a senha)."""
        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
            "perfil": self.perfil,
            "modulos": self.modulos_efetivos,
            "ativo": self.ativo,
            "cargo": self.cargo,
            "registro_profissional": self.registro_profissional,
            "farmaceutico": bool(self.farmaceutico),
            "criado_em": self.criado_em.isoformat(),
        }

    def responsavel_dict(self):
        """Dados públicos do farmacêutico (para receitas e relatórios)."""
        return {
            "id": self.id,
            "nome": self.nome,
            "cargo": self.cargo,
            "registro_profissional": self.registro_profissional,
        }

    def __repr__(self):
        return f"<Usuario {self.email}>"
