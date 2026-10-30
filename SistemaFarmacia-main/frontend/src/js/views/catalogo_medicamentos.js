// ============================================================
//  VIEW: CATÁLOGO DE MEDICAMENTOS (SOMENTE ADMIN) — dentro de Configurações
// ============================================================

import { api } from '../api.js';
import { lerArquivoTexto, lerCsvMedicamentos } from '../csv.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, ligarAcoes, semAcento } from '../utils.js';

const LIMITE_ARQUIVO = 2 * 1024 * 1024; // 2 MB
const MAX_ERROS_NA_TELA = 8;

const listaErros = erros => `
  <ul class="import-erros">
    ${erros.slice(0, MAX_ERROS_NA_TELA).map(e => `<li>Linha ${esc(e.linha)}${e.nome ? ` (${esc(e.nome)})` : ''}: ${esc(e.motivo)}</li>`).join('')}
    ${erros.length > MAX_ERROS_NA_TELA ? `<li>…e mais ${erros.length - MAX_ERROS_NA_TELA}.</li>` : ''}
  </ul>`;

export async function renderCatalogoMedicamentos(container) {
  const medicamentos = await api.listarCatalogoMedicamentos();
  const ativos = medicamentos.filter(m => m.ativo).length;

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Catálogo de Medicamentos</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">
            ${ativos} medicamento(s) disponível(is). Mudar o catálogo não altera receitas já emitidas.
          </p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="btnImportarMedicamentos">Importar CSV</button>
          <button class="btn btn-primary" id="btnNovoMedicamento">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Medicamento
          </button>
        </div>
      </div>

      <div class="table-toolbar">
        <input type="search" class="form-input" id="buscaMedicamentos" placeholder="Buscar por nome, RMS ou laboratório…" aria-label="Buscar medicamento"/>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-body); cursor: pointer;">
          <input type="checkbox" id="mostrarMedicamentosInativos"/> Mostrar desativados
        </label>
      </div>

      <div class="table-responsive">
        <table class="table-modern table-compact">
          <thead>
            <tr>
              <th>Medicamento</th>
              <th>RMS</th>
              <th>Laboratório</th>
              <th>Situação</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody id="corpoMedicamentos">
            ${medicamentos.length === 0
              ? `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">O catálogo está vazio. Use <strong>Importar CSV</strong> ou <strong>Novo Medicamento</strong>.</td></tr>`
              : medicamentos.map(m => `
                  <tr class="${m.ativo ? '' : 'linha-inativa'}" data-busca="${esc(semAcento(`${m.descricao} ${m.rms} ${m.laboratorio || ''}`))}" data-ativo="${m.ativo ? 1 : 0}" ${m.ativo ? '' : 'hidden'}>
                    <td style="font-weight: 600; color: var(--text-title);">${esc(m.descricao)}</td>
                    <td style="font-family: monospace;">${m.rms ? esc(m.rms) : '<span style="color: var(--text-muted);">—</span>'}</td>
                    <td>${m.laboratorio ? esc(m.laboratorio) : '<span style="color: var(--text-muted);">—</span>'}</td>
                    <td><span class="badge ${m.ativo ? 'badge-success' : 'badge-neutral'}">${m.ativo ? 'Ativo' : 'Desativado'}</span></td>
                    <td style="text-align: right;">
                      <div class="row-actions">
                        ${botoesAcoes(m.id, { excluir: m.ativo })}
                        ${m.ativo ? '' : `<button type="button" class="btn btn-secondary btn-sm" data-acao="reativar" data-id="${esc(m.id)}">Reativar</button>`}
                      </div>
                    </td>
                  </tr>`).join('')}
            <tr id="semResultadoMedicamentos" hidden><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">Nenhum medicamento encontrado.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVO / EDITAR MEDICAMENTO -->
    <div class="modal-overlay" id="modalMedicamento">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="tituloModalMedicamento">Novo Medicamento</h3>
          <button class="modal-close" id="btnFecharModalMedicamento" type="button">&times;</button>
        </div>
        <form id="formMedicamento">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label" for="med_descricao">Descrição <span class="req">*</span></label>
              <input type="text" class="form-input" id="med_descricao" required maxlength="255" placeholder="Ex: ALPRAZOLAM 0,25 MG 30 CPRS"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="med_rms">RMS</label>
              <input type="text" class="form-input" id="med_rms" maxlength="30" inputmode="numeric" placeholder="13 dígitos"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="med_laboratorio">Laboratório</label>
              <input type="text" class="form-input" id="med_laboratorio" maxlength="150" placeholder="Ex: EMS INDUSTRIA FARMACEUTICA LTDA"/>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnCancelarMedicamento">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarMedicamento">Adicionar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL IMPORTAR CSV -->
    <div class="modal-overlay" id="modalImportarMedicamentos">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Importar medicamentos de um CSV</h3>
          <button class="modal-close" id="btnFecharImportarMedicamentos" type="button">&times;</button>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-body); margin-bottom: 14px;">
          O arquivo precisa ter as colunas <strong>RMS</strong>, <strong>Descrição</strong> e <strong>Laboratório</strong>
          (outras colunas, como Lote e Quantidade, são ignoradas). Nenhum medicamento é apagado.
        </p>
        <p style="font-size: 0.85rem; color: var(--badge-warning-text); background: var(--badge-warning-bg); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 14px;">
          <strong>Atenção:</strong> não abra e salve o CSV no Excel antes de importar: ele troca os números de 13 dígitos do RMS
          por notação científica e <strong>apaga os dígitos</strong>. Importe o arquivo original.
        </p>
        <input type="file" class="form-input" id="arquivoImportarMedicamentos" accept=".csv,.txt,text/csv,text/plain" aria-label="Arquivo CSV"/>
        <div id="resumoImportarMedicamentos" style="margin-top: 16px;"></div>
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
          <button type="button" class="btn btn-secondary" id="btnCancelarImportarMedicamentos">Fechar</button>
          <button type="button" class="btn btn-primary" id="btnConfirmarImportarMedicamentos" disabled>Importar</button>
        </div>
      </div>
    </div>
  `;

  const campo = id => document.getElementById(id);
  const recarregar = () => renderCatalogoMedicamentos(container);

  // ── Busca e "mostrar desativados" ──
  function aplicarFiltro() {
    const termo = semAcento(campo('buscaMedicamentos').value.trim());
    const mostrarInativos = campo('mostrarMedicamentosInativos').checked;
    let visiveis = 0;
    container.querySelectorAll('#corpoMedicamentos tr[data-busca]').forEach(tr => {
      const mostrar = (mostrarInativos || tr.dataset.ativo === '1') && tr.dataset.busca.includes(termo);
      tr.hidden = !mostrar;
      if (mostrar) visiveis++;
    });
    campo('semResultadoMedicamentos').hidden = visiveis > 0 || medicamentos.length === 0;
  }
  campo('buscaMedicamentos').addEventListener('input', aplicarFiltro);
  campo('mostrarMedicamentosInativos').addEventListener('change', aplicarFiltro);
  aplicarFiltro();

  // ── Novo / editar ──
  const modal = campo('modalMedicamento');
  let editando = null;

  function abrirModal(medicamento = null) {
    editando = medicamento;
    campo('formMedicamento').reset();
    campo('tituloModalMedicamento').textContent = medicamento ? 'Editar Medicamento' : 'Novo Medicamento';
    campo('btnSalvarMedicamento').textContent = medicamento ? 'Salvar Alterações' : 'Adicionar';
    if (medicamento) {
      campo('med_descricao').value = medicamento.descricao;
      campo('med_rms').value = medicamento.rms || '';
      campo('med_laboratorio').value = medicamento.laboratorio || '';
    }
    modal.classList.add('active');
    campo('med_descricao').focus();
  }
  const fecharModal = () => modal.classList.remove('active');

  campo('btnNovoMedicamento').onclick = () => abrirModal();
  campo('btnFecharModalMedicamento').onclick = fecharModal;
  campo('btnCancelarMedicamento').onclick = fecharModal;

  const porId = id => medicamentos.find(m => String(m.id) === String(id));
  ligarAcoes(container, {
    editar: id => abrirModal(porId(id)),
    excluir: id => confirmarEExcluir({
      mensagem: `Remover "${porId(id)?.descricao}" da lista de medicamentos?\n\nReceitas já emitidas continuam como estão, e você pode reativar depois.`,
      excluir: () => api.atualizarCatalogoMedicamento(id, { ativo: false }),
      aoConcluir: recarregar,
    }),
    reativar: async (id) => {
      try {
        await api.atualizarCatalogoMedicamento(id, { ativo: true });
        await recarregar();
      } catch (err) {
        alert('Erro ao reativar: ' + err.message);
      }
    },
  });

  campo('formMedicamento').onsubmit = async (e) => {
    e.preventDefault();
    const dados = {
      descricao: campo('med_descricao').value.trim(),
      rms: campo('med_rms').value.trim(),
      laboratorio: campo('med_laboratorio').value.trim() || null,
    };
    try {
      if (editando) await api.atualizarCatalogoMedicamento(editando.id, dados);
      else await api.cadastrarCatalogoMedicamento(dados);
      fecharModal();
      await recarregar();
    } catch (err) {
      alert('Erro ao salvar medicamento: ' + err.message);
    }
  };

  // ── Importar CSV ──
  const modalImportar = campo('modalImportarMedicamentos');
  let lidos = [];

  const resetImportacao = () => {
    lidos = [];
    campo('arquivoImportarMedicamentos').value = '';
    campo('resumoImportarMedicamentos').innerHTML = '';
    campo('btnConfirmarImportarMedicamentos').disabled = true;
    campo('btnConfirmarImportarMedicamentos').textContent = 'Importar';
  };
  const fecharImportar = () => {
    const concluiu = modalImportar.dataset.concluiu === '1';
    modalImportar.classList.remove('active');
    if (concluiu) recarregar();
  };

  campo('btnImportarMedicamentos').onclick = () => {
    resetImportacao();
    modalImportar.dataset.concluiu = '0';
    modalImportar.classList.add('active');
  };
  campo('btnFecharImportarMedicamentos').onclick = fecharImportar;
  campo('btnCancelarImportarMedicamentos').onclick = fecharImportar;

  campo('arquivoImportarMedicamentos').onchange = async (e) => {
    const arquivo = e.target.files[0];
    const resumo = campo('resumoImportarMedicamentos');
    const botao = campo('btnConfirmarImportarMedicamentos');
    botao.disabled = true;
    lidos = [];
    if (!arquivo) { resumo.innerHTML = ''; return; }
    if (arquivo.size > LIMITE_ARQUIVO) {
      resumo.innerHTML = `<div class="import-resumo" role="alert">O arquivo é grande demais (máximo 2 MB). Confira se é mesmo o CSV de medicamentos.</div>`;
      return;
    }

    const { itens, erros } = lerCsvMedicamentos(await lerArquivoTexto(arquivo));
    lidos = itens;
    resumo.innerHTML = `
      <div class="import-resumo">
        <strong>${itens.length}</strong> medicamento(s) prontos para importar${erros.length ? `, <strong>${erros.length}</strong> linha(s) com problema (serão ignoradas)` : ''}.
        ${erros.length ? listaErros(erros) : ''}
      </div>`;
    if (itens.length) {
      botao.disabled = false;
      botao.textContent = `Importar ${itens.length} medicamento(s)`;
    }
  };

  campo('btnConfirmarImportarMedicamentos').onclick = async () => {
    const botao = campo('btnConfirmarImportarMedicamentos');
    botao.disabled = true;
    try {
      const r = await api.importarCatalogoMedicamentos(lidos);
      modalImportar.dataset.concluiu = '1';
      campo('resumoImportarMedicamentos').innerHTML = `
        <div class="import-resumo" role="status">
          <strong>Importação concluída.</strong><br/>
          ${r.criados} novo(s) · ${r.atualizados} atualizado(s) · ${r.iguais} já estavam iguais
          ${r.erros.length ? `<br/><span style="color: var(--badge-danger-text);">${r.erros.length} linha(s) ignorada(s):</span>${listaErros(r.erros)}` : ''}
        </div>`;
      botao.textContent = 'Concluído';
    } catch (err) {
      botao.disabled = false;
      alert('Erro ao importar: ' + err.message);
    }
  };
}
