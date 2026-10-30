// ============================================================
//  VIEW: CATÁLOGO DE EXAMES (SOMENTE ADMIN) — dentro de Configurações
// ============================================================

import { api } from '../api.js';
import { lerArquivoTexto, lerCsvExames } from '../csv.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, formatarMoeda, ligarAcoes, semAcento } from '../utils.js';

const LIMITE_ARQUIVO = 1024 * 1024; // 1 MB
const MAX_ERROS_NA_TELA = 8;

const listaErros = erros => `
  <ul class="import-erros">
    ${erros.slice(0, MAX_ERROS_NA_TELA).map(e => `<li>Linha ${esc(e.linha)}${e.nome ? ` (${esc(e.nome)})` : ''}: ${esc(e.motivo)}</li>`).join('')}
    ${erros.length > MAX_ERROS_NA_TELA ? `<li>…e mais ${erros.length - MAX_ERROS_NA_TELA}.</li>` : ''}
  </ul>`;

export async function renderCatalogo(container) {
  const exames = await api.listarCatalogoExames();
  const ativos = exames.filter(e => e.ativo).length;

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Catálogo de Exames</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">
            ${ativos} exame(s) disponível(is). Mudar um valor aqui não altera exames já registrados.
          </p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="btnImportarCatalogo">Importar CSV</button>
          <button class="btn btn-primary" id="btnNovoCatalogo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Exame
          </button>
        </div>
      </div>

      <div class="table-toolbar">
        <input type="search" class="form-input" id="buscaCatalogo" placeholder="Buscar exame…" aria-label="Buscar exame"/>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-body); cursor: pointer;">
          <input type="checkbox" id="mostrarInativos"/> Mostrar desativados
        </label>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Exame</th>
              <th>Valor</th>
              <th>Situação</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody id="corpoCatalogo">
            ${exames.length === 0
              ? `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">O catálogo está vazio. Use <strong>Importar CSV</strong> ou <strong>Novo Exame</strong>.</td></tr>`
              : exames.map(e => `
                  <tr class="${e.ativo ? '' : 'linha-inativa'}" data-busca="${esc(semAcento(e.nome))}" data-ativo="${e.ativo ? 1 : 0}" ${e.ativo ? '' : 'hidden'}>
                    <td style="font-weight: 600; color: var(--text-title);">${esc(e.nome)}</td>
                    <td style="font-weight: 700;">${esc(formatarMoeda(e.valor))}</td>
                    <td><span class="badge ${e.ativo ? 'badge-success' : 'badge-neutral'}">${e.ativo ? 'Ativo' : 'Desativado'}</span></td>
                    <td style="text-align: right;">
                      <div class="row-actions">
                        ${botoesAcoes(e.id, { excluir: e.ativo })}
                        ${e.ativo ? '' : `<button type="button" class="btn btn-secondary btn-sm" data-acao="reativar" data-id="${esc(e.id)}">Reativar</button>`}
                      </div>
                    </td>
                  </tr>`).join('')}
            <tr id="semResultadoCatalogo" hidden><td colspan="4" style="text-align: center; padding: 30px; color: var(--text-muted);">Nenhum exame encontrado.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVO / EDITAR EXAME -->
    <div class="modal-overlay" id="modalCatalogo">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="tituloModalCatalogo">Novo Exame</h3>
          <button class="modal-close" id="btnFecharModalCatalogo" type="button">&times;</button>
        </div>
        <form id="formCatalogo">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label" for="cat_nome">Nome do exame <span class="req">*</span></label>
              <input type="text" class="form-input" id="cat_nome" required maxlength="200" placeholder="Ex: Hemograma completo"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="cat_valor">Valor (R$) <span class="req">*</span></label>
              <input type="number" class="form-input" id="cat_valor" required min="0" step="0.01" placeholder="0,00"/>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnCancelarCatalogo">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarCatalogo">Adicionar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL IMPORTAR CSV -->
    <div class="modal-overlay" id="modalImportar">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Importar exames de um CSV</h3>
          <button class="modal-close" id="btnFecharModalImportar" type="button">&times;</button>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-body); margin-bottom: 14px;">
          Na planilha, use <strong>Arquivo → Salvar como → CSV</strong>. O arquivo precisa ter uma coluna com o nome
          do exame e outra com o valor. Nenhum exame é apagado.
        </p>
        <p style="font-size: 0.85rem; color: var(--badge-warning-text); background: var(--badge-warning-bg); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 14px;">
          <strong>Atenção:</strong> exame que já existe (mesmo nome) <strong>volta ao valor do arquivo</strong>, inclusive
          os que você corrigiu na tela. Use a importação para a carga inicial; depois, ajuste os valores pela própria tela.
        </p>
        <input type="file" class="form-input" id="arquivoImportar" accept=".csv,.txt,text/csv,text/plain" aria-label="Arquivo CSV"/>
        <div id="resumoImportar" style="margin-top: 16px;"></div>
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
          <button type="button" class="btn btn-secondary" id="btnCancelarImportar">Fechar</button>
          <button type="button" class="btn btn-primary" id="btnConfirmarImportar" disabled>Importar</button>
        </div>
      </div>
    </div>
  `;

  const campo = id => document.getElementById(id);
  const recarregar = () => renderCatalogo(container);

  // ── Busca e "mostrar desativados" ──
  function aplicarFiltro() {
    const termo = semAcento(campo('buscaCatalogo').value.trim());
    const mostrarInativos = campo('mostrarInativos').checked;
    let visiveis = 0;
    container.querySelectorAll('#corpoCatalogo tr[data-busca]').forEach(tr => {
      const mostrar = (mostrarInativos || tr.dataset.ativo === '1') && tr.dataset.busca.includes(termo);
      tr.hidden = !mostrar;
      if (mostrar) visiveis++;
    });
    campo('semResultadoCatalogo').hidden = visiveis > 0 || exames.length === 0;
  }
  campo('buscaCatalogo').addEventListener('input', aplicarFiltro);
  campo('mostrarInativos').addEventListener('change', aplicarFiltro);
  aplicarFiltro();

  // ── Novo / editar ──
  const modal = campo('modalCatalogo');
  let editando = null;

  function abrirModal(exame = null) {
    editando = exame;
    campo('formCatalogo').reset();
    campo('tituloModalCatalogo').textContent = exame ? 'Editar Exame' : 'Novo Exame';
    campo('btnSalvarCatalogo').textContent = exame ? 'Salvar Alterações' : 'Adicionar';
    if (exame) {
      campo('cat_nome').value = exame.nome;
      campo('cat_valor').value = exame.valor;
    }
    modal.classList.add('active');
    campo('cat_nome').focus();
  }
  const fecharModal = () => modal.classList.remove('active');

  campo('btnNovoCatalogo').onclick = () => abrirModal();
  campo('btnFecharModalCatalogo').onclick = fecharModal;
  campo('btnCancelarCatalogo').onclick = fecharModal;

  const porId = id => exames.find(e => String(e.id) === String(id));
  ligarAcoes(container, {
    editar: id => abrirModal(porId(id)),
    excluir: id => confirmarEExcluir({
      mensagem: `Remover "${porId(id)?.nome}" da lista de exames?\n\nOs exames já registrados continuam como estão, e você pode reativar depois.`,
      excluir: () => api.atualizarCatalogoExame(id, { ativo: false }),
      aoConcluir: recarregar,
    }),
    reativar: async (id) => {
      try {
        await api.atualizarCatalogoExame(id, { ativo: true });
        await recarregar();
      } catch (err) {
        alert('Erro ao reativar: ' + err.message);
      }
    },
  });

  campo('formCatalogo').onsubmit = async (e) => {
    e.preventDefault();
    const dados = { nome: campo('cat_nome').value.trim(), valor: parseFloat(campo('cat_valor').value) };
    try {
      if (editando) await api.atualizarCatalogoExame(editando.id, dados);
      else await api.cadastrarCatalogoExame(dados);
      fecharModal();
      await recarregar();
    } catch (err) {
      alert('Erro ao salvar exame: ' + err.message);
    }
  };

  // ── Importar CSV ──
  const modalImportar = campo('modalImportar');
  let lidos = [];

  const resetImportacao = () => {
    lidos = [];
    campo('arquivoImportar').value = '';
    campo('resumoImportar').innerHTML = '';
    campo('btnConfirmarImportar').disabled = true;
    campo('btnConfirmarImportar').textContent = 'Importar';
  };
  const fecharImportar = () => {
    const concluiu = modalImportar.dataset.concluiu === '1';
    modalImportar.classList.remove('active');
    if (concluiu) recarregar();
  };

  campo('btnImportarCatalogo').onclick = () => {
    resetImportacao();
    modalImportar.dataset.concluiu = '0';
    modalImportar.classList.add('active');
  };
  campo('btnFecharModalImportar').onclick = fecharImportar;
  campo('btnCancelarImportar').onclick = fecharImportar;

  campo('arquivoImportar').onchange = async (e) => {
    const arquivo = e.target.files[0];
    const resumo = campo('resumoImportar');
    campo('btnConfirmarImportar').disabled = true;
    lidos = [];
    if (!arquivo) { resumo.innerHTML = ''; return; }
    if (arquivo.size > LIMITE_ARQUIVO) {
      resumo.innerHTML = `<div class="import-resumo" role="alert">O arquivo é grande demais (máximo 1 MB). Confira se é mesmo o CSV de exames.</div>`;
      return;
    }

    const { itens, erros } = lerCsvExames(await lerArquivoTexto(arquivo));
    lidos = itens;
    resumo.innerHTML = `
      <div class="import-resumo">
        <strong>${itens.length}</strong> exame(s) prontos para importar${erros.length ? `, <strong>${erros.length}</strong> linha(s) com problema (serão ignoradas)` : ''}.
        ${erros.length ? listaErros(erros) : ''}
      </div>`;
    if (itens.length) {
      campo('btnConfirmarImportar').disabled = false;
      campo('btnConfirmarImportar').textContent = `Importar ${itens.length} exame(s)`;
    }
  };

  campo('btnConfirmarImportar').onclick = async () => {
    const botao = campo('btnConfirmarImportar');
    botao.disabled = true;
    try {
      const r = await api.importarCatalogoExames(lidos);
      modalImportar.dataset.concluiu = '1';
      campo('resumoImportar').innerHTML = `
        <div class="import-resumo" role="status">
          <strong>Importação concluída.</strong><br/>
          ${r.criados} novo(s) · ${r.atualizados} com valor atualizado · ${r.iguais} já estavam iguais
          ${r.erros.length ? `<br/><span style="color: var(--badge-danger-text);">${r.erros.length} linha(s) ignorada(s):</span>${listaErros(r.erros)}` : ''}
        </div>`;
      botao.textContent = 'Concluído';
    } catch (err) {
      botao.disabled = false;
      alert('Erro ao importar: ' + err.message);
    }
  };
}
