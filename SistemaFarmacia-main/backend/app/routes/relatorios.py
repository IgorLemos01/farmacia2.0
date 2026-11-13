from flask import request
from flask_jwt_extended import jwt_required
from flask_restx import Namespace, Resource

from app.auth_utils import usuario_atual
from app.services.relatorio_service import CATEGORIAS, RelatorioService

ns = Namespace("relatorios", description="Relatórios por categoria: manipulação, exames e receitas")


@ns.route("/<string:categoria>")
@ns.param("categoria", "manipulacoes, exames ou receitas")
class Relatorio(Resource):
    @jwt_required()
    @ns.doc(
        description=(
            "Relatório de uma categoria, com período próprio. `resumo` cobre todo o período; `itens` traz a "
            "página pedida, ou todas as linhas com `todos=true` (para exportar PDF/Excel). "
            "Acesso: administrador, módulo Dashboard ou o módulo da própria categoria."
        ),
        security="Bearer",
        params={
            "de": "Data inicial (AAAA-MM-DD), opcional",
            "ate": "Data final (AAAA-MM-DD), opcional",
            "pagina": "Página (padrão 1)",
            "limite": "Linhas por página (padrão 20, máximo 200)",
            "todos": "true = todas as linhas do período (máximo 10000)",
        },
    )
    def get(self, categoria):
        """Gerar relatório da categoria"""
        if categoria not in CATEGORIAS:
            ns.abort(404, "Relatório inexistente. Use manipulacoes, exames ou receitas.")
        usuario = usuario_atual()
        if not usuario or not usuario.tem_acesso(categoria, "dashboard"):
            ns.abort(403, "Você não tem acesso a este relatório.")
        try:
            return RelatorioService.gerar(
                categoria,
                de=request.args.get("de") or None,
                ate=request.args.get("ate") or None,
                pagina=request.args.get("pagina", 1, type=int),
                limite=request.args.get("limite", 20, type=int),
                todos=request.args.get("todos", "").lower() in ("1", "true", "sim"),
            ), 200
        except LookupError as e:
            ns.abort(404, str(e))
        except ValueError as e:
            ns.abort(400, str(e))
