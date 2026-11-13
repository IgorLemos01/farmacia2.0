"""
Relatórios por categoria de serviço (manipulação, exames e receitas).

Cada categoria é filtrada pelo próprio período (de/até) e devolve:
- `resumo`: totais do período inteiro (quantidade, faturamento, ticket médio,
  por forma de pagamento, por dia e os itens mais frequentes);
- `itens`: as linhas da página pedida (ou todas, para exportar).
"""
from decimal import Decimal

# pyrefly: ignore[missing-import]
from sqlalchemy import func
# pyrefly: ignore[missing-import]
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.exame import Exame, ExameItem
from app.models.manipulacao import Manipulacao
from app.models.receita import Receita, ReceitaItem
from app.utils import parse_data

CATEGORIAS = ("manipulacoes", "exames", "receitas")
LIMITE_PAGINA = 200
LIMITE_EXPORTACAO = 10000


def _dinheiro(valor) -> float:
    return float(Decimal(valor or 0).quantize(Decimal("0.01")))


def _periodo(de, ate):
    inicio = parse_data(de, "Data inicial")
    fim = parse_data(ate, "Data final")
    if inicio and fim and inicio > fim:
        inicio, fim = fim, inicio  # datas digitadas ao contrário
    return inicio, fim


def _config(categoria):
    if categoria == "manipulacoes":
        return Manipulacao, Manipulacao.data
    if categoria == "exames":
        return Exame, Exame.data
    if categoria == "receitas":
        return Receita, Receita.data_venda
    raise LookupError("Relatório inexistente. Use manipulacoes, exames ou receitas.")


def _linha(categoria, registro) -> dict:
    cliente = registro.cliente
    base = {
        "id": registro.id,
        "cliente_id": registro.cliente_id,
        "cliente_nome": cliente.nome if cliente else None,
        "cliente_telefone": cliente.telefone if cliente else None,
    }
    if categoria == "manipulacoes":
        return {
            **base,
            "data": registro.data.isoformat(),
            "formula": registro.formula,
            "prazo_entrega": registro.prazo_entrega.isoformat() if registro.prazo_entrega else None,
            "valor": _dinheiro(registro.valor),
            "forma_pagamento": registro.forma_pagamento,
            "observacoes": registro.observacoes,
        }
    if categoria == "exames":
        return {
            **base,
            "data": registro.data.isoformat(),
            "exames": "; ".join(i.nome for i in registro.itens),
            "quantidade_exames": len(registro.itens),
            "valor": _dinheiro(registro.valor),
            "forma_pagamento": registro.forma_pagamento,
            "observacoes": registro.observacoes,
        }
    return {
        **base,
        "data": registro.data_venda.isoformat(),
        "medicamentos": "; ".join(i.medicamento for i in registro.itens),
        "quantidade_medicamentos": len(registro.itens),
        "unidades": sum(i.quantidade or 0 for i in registro.itens),
        "medico_prescritor": registro.medico_prescritor,
        "farmaceutico": registro.farmaceutico_nome,
    }


class RelatorioService:
    @staticmethod
    def gerar(categoria: str, de=None, ate=None, pagina: int = 1, limite: int = 20, todos: bool = False) -> dict:
        modelo, coluna_data = _config(categoria)
        inicio, fim = _periodo(de, ate)

        filtros = []
        if inicio:
            filtros.append(coluna_data >= inicio)
        if fim:
            filtros.append(coluna_data <= fim)

        base = modelo.query.filter(*filtros)
        total = base.count()

        # --- Resumo do período inteiro (independe da página) ---
        tem_valor = categoria != "receitas"
        soma = func.coalesce(func.sum(modelo.valor), 0) if tem_valor else None

        por_dia_q = db.session.query(coluna_data, func.count(modelo.id), *( [soma] if tem_valor else [] )).filter(*filtros)
        por_dia = [
            {"data": d.isoformat(), "quantidade": q, "valor": _dinheiro(v[0]) if tem_valor else None}
            for d, q, *v in por_dia_q.group_by(coluna_data).order_by(coluna_data).all()
        ]

        clientes_atendidos = (
            db.session.query(func.count(func.distinct(modelo.cliente_id))).filter(*filtros).scalar() or 0
        )
        resumo = {"quantidade": total, "clientes_atendidos": clientes_atendidos, "por_dia": por_dia}

        if tem_valor:
            valor_total = db.session.query(soma).filter(*filtros).scalar() or 0
            resumo["valor_total"] = _dinheiro(valor_total)
            resumo["ticket_medio"] = _dinheiro(Decimal(valor_total) / total) if total else 0.0
            pagamentos = (
                db.session.query(modelo.forma_pagamento, func.count(modelo.id), soma)
                .filter(*filtros)
                .group_by(modelo.forma_pagamento)
                .all()
            )
            resumo["por_pagamento"] = sorted(
                (
                    {"forma": forma or "Não informado", "quantidade": q, "valor": _dinheiro(v)}
                    for forma, q, v in pagamentos
                ),
                key=lambda x: -x["valor"],
            )

        if categoria == "exames":
            mais = (
                db.session.query(ExameItem.nome, func.count(ExameItem.id), func.coalesce(func.sum(ExameItem.valor), 0))
                .join(Exame, ExameItem.exame_id == Exame.id)
                .filter(*filtros)
                .group_by(ExameItem.nome)
                .order_by(func.count(ExameItem.id).desc(), ExameItem.nome)
                .limit(5)
                .all()
            )
            resumo["total_exames"] = (
                db.session.query(func.count(ExameItem.id)).join(Exame, ExameItem.exame_id == Exame.id).filter(*filtros).scalar() or 0
            )
            resumo["mais_realizados"] = [{"nome": n, "quantidade": q, "valor": _dinheiro(v)} for n, q, v in mais]
        elif categoria == "receitas":
            unidades = func.coalesce(func.sum(ReceitaItem.quantidade), 0)
            mais = (
                db.session.query(ReceitaItem.medicamento, func.count(ReceitaItem.id), unidades)
                .join(Receita, ReceitaItem.receita_id == Receita.id)
                .filter(*filtros)
                .group_by(ReceitaItem.medicamento)
                .order_by(func.count(ReceitaItem.id).desc(), ReceitaItem.medicamento)
                .limit(5)
                .all()
            )
            resumo["total_medicamentos"] = (
                db.session.query(func.count(ReceitaItem.id)).join(Receita, ReceitaItem.receita_id == Receita.id).filter(*filtros).scalar() or 0
            )
            resumo["mais_dispensados"] = [{"nome": n, "quantidade": q, "unidades": int(u or 0)} for n, q, u in mais]

        # --- Linhas ---
        ordenada = base.options(joinedload(modelo.cliente)).order_by(coluna_data.desc(), modelo.id.desc())
        if todos:
            if total > LIMITE_EXPORTACAO:
                raise ValueError(
                    f"O período tem {total} registros; o máximo para exportar é {LIMITE_EXPORTACAO}. Reduza o período."
                )
            registros, pagina, paginas = ordenada.all(), 1, 1
        else:
            limite = max(1, min(limite or 20, LIMITE_PAGINA))
            paginacao = ordenada.paginate(page=max(1, pagina or 1), per_page=limite, error_out=False)
            registros, pagina, paginas = paginacao.items, paginacao.page, paginacao.pages

        return {
            "categoria": categoria,
            "periodo": {"de": inicio.isoformat() if inicio else None, "ate": fim.isoformat() if fim else None},
            "resumo": resumo,
            "total": total,
            "pagina_atual": pagina,
            "paginas": paginas,
            "itens": [_linha(categoria, r) for r in registros],
        }
