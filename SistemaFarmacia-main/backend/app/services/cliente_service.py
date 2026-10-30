# pyrefly: ignore[missing-import]
from sqlalchemy import or_

from app.extensions import db
from app.models.cliente import Cliente
from app.utils import parse_data, texto_obrigatorio


class ClienteService:
    """Regras de negócio para gerenciamento de clientes."""

    @staticmethod
    def listar(busca: str = None, limite: int = 50, pagina: int = 1):
        query = Cliente.query

        if busca:
            termo = f"%{busca.strip()}%"
            query = query.filter(
                or_(
                    Cliente.nome.ilike(termo),
                    Cliente.cpf.like(termo),
                    Cliente.telefone.like(termo),
                    Cliente.email.ilike(termo),
                )
            )

        query = query.order_by(Cliente.nome.asc())
        paginacao = query.paginate(page=pagina, per_page=limite, error_out=False)

        return {
            "total": paginacao.total,
            "paginas": paginacao.pages,
            "pagina_atual": paginacao.page,
            "itens": [c.to_dict() for c in paginacao.items],
        }

    @staticmethod
    def obter_por_id(cliente_id: int) -> Cliente:
        return db.session.get(Cliente, cliente_id)

    @staticmethod
    def cadastrar(dados: dict) -> Cliente:
        cpf = dados.get("cpf", "").strip()
        if not cpf:
            raise ValueError("CPF é obrigatório.")

        # Verifica se CPF já existe
        if Cliente.query.filter_by(cpf=cpf).first():
            raise ValueError(f"Já existe um cliente cadastrado com o CPF {cpf}.")

        # Validação de campos obrigatórios
        campos_obrigatorios = [
            ("nome", "Nome"),
            ("cpf", "CPF"),
            ("rg", "RG"),
            ("data_nascimento", "Data de nascimento"),
            ("sexo", "Sexo"),
            ("telefone", "Telefone"),
            ("email", "E-mail"),
            ("endereco", "Endereço"),
        ]

        for campo, label in campos_obrigatorios:
            if not dados.get(campo):
                raise ValueError(f"O campo '{label}' é obrigatório.")

        sexo = dados.get("sexo")
        if sexo not in ("M", "F", "Outro"):
            raise ValueError("Sexo inválido. Utilize 'M', 'F' ou 'Outro'.")

        data_nasc = parse_data(dados.get("data_nascimento"), "Data de nascimento")

        cliente = Cliente(
            nome=dados["nome"].strip(),
            cpf=cpf,
            rg=dados["rg"].strip(),
            data_nascimento=data_nasc,
            sexo=sexo,
            telefone=dados["telefone"].strip(),
            email=dados["email"].strip().lower(),
            endereco=dados["endereco"].strip(),
            alergia=dados.get("alergia"),
            observacoes=dados.get("observacoes"),
        )

        db.session.add(cliente)
        db.session.commit()
        return cliente

    @staticmethod
    def atualizar(cliente_id: int, dados: dict) -> Cliente:
        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise ValueError("Cliente não encontrado.")

        novo_cpf = dados.get("cpf")
        if novo_cpf and novo_cpf != cliente.cpf:
            existente = Cliente.query.filter_by(cpf=novo_cpf).first()
            if existente and existente.id != cliente_id:
                raise ValueError(f"O CPF {novo_cpf} já pertence a outro cliente.")
            cliente.cpf = novo_cpf

        if "nome" in dados:
            cliente.nome = texto_obrigatorio(dados["nome"], "Nome")
        if "rg" in dados:
            cliente.rg = texto_obrigatorio(dados["rg"], "RG")
        if "data_nascimento" in dados:
            data_nasc = parse_data(dados["data_nascimento"], "Data de nascimento")
            if not data_nasc:
                raise ValueError("Data de nascimento é obrigatória.")
            cliente.data_nascimento = data_nasc
        if "sexo" in dados:
            if dados["sexo"] not in ("M", "F", "Outro"):
                raise ValueError("Sexo inválido. Utilize 'M', 'F' ou 'Outro'.")
            cliente.sexo = dados["sexo"]
        if "telefone" in dados:
            cliente.telefone = texto_obrigatorio(dados["telefone"], "Telefone")
        if "email" in dados:
            cliente.email = texto_obrigatorio(dados["email"], "E-mail").lower()
        if "endereco" in dados:
            cliente.endereco = texto_obrigatorio(dados["endereco"], "Endereço")
        if "alergia" in dados:
            cliente.alergia = dados.get("alergia")
        if "observacoes" in dados:
            cliente.observacoes = dados.get("observacoes")

        db.session.commit()
        return cliente

    @staticmethod
    def deletar(cliente_id: int):
        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise ValueError("Cliente não encontrado.")

        # Integridade referencial
        if cliente.manipulacoes.count() > 0 or cliente.exames.count() > 0 or cliente.receitas.count() > 0:
            raise ValueError(
                "Não é possível excluir este cliente pois existem manipulações, exames ou receitas vinculados."
            )

        db.session.delete(cliente)
        db.session.commit()

    @staticmethod
    def obter_dossie(cliente_id: int) -> dict:
        """Retorna os dados cadastrais do cliente + histórico completo de saúde."""
        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise ValueError("Cliente não encontrado.")

        return {
            "cliente": cliente.to_dict(),
            "historico": {
                "manipulacoes": [m.to_dict() for m in cliente.manipulacoes.order_by(db.desc("data")).all()],
                "exames": [e.to_dict() for e in cliente.exames.order_by(db.desc("data")).all()],
                "receitas": [r.to_dict() for r in cliente.receitas.order_by(db.desc("data_venda")).all()],
            },
        }
