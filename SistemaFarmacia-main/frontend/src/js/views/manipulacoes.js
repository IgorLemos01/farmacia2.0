// ============================================================
//  VIEW: MANIPULAÇÕES DE MEDICAMENTOS
// ============================================================

import { api } from '../api.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, hojeISO, ligarAcoes } from '../utils.js';

export async function renderManipulacoes(container) {
  const [manipulacoes, clientes] = await Promise.all([
    api.listarManipulacoes(),
    api.listarClientes(),
  ]);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Pedidos de Manipulação</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Controle de fórmulas, prazos de entrega e pagamentos</p>
        </div>
        <button class="btn btn-primary" id="btnAbrirModalManip">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova Manipulação
        </button>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Cliente / Paciente</th>
              <th>Fórmula / Composição</th>
              <th>Data Pedido</th>
              <th>Prazo Entrega</th>
              <th>Valor & Pagamento</th>
              <th>Observações</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${
              manipulacoes.length === 0
                ? `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhuma fórmula cadastrada.</td></tr>`
                : manipulacoes.map(m => `
                    <tr>
                      <td>
                        <div style="font-weight: 700; color: var(--text-title);">${esc(m.cliente_nome || 'Cliente #' + m.cliente_id)}</div>
                      </td>
                      <td style="max-width: 280px;">
                        <div style="font-weight: 600; color: var(--color-primary-dark); font-size: 0.88rem;">${esc(m.formula)}</div>
                      </td>
                      <td>${esc(m.data || '-')}</td>
                      <td>
                        <span class="badge badge-warning">📅 ${esc(m.prazo_entrega || 'A definir')}</span>
                      </td>
                      <td>
                        <div style="font-weight: 700;">R$ ${Number(m.valor || 0).toFixed(2)}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${esc(m.forma_pagamento || 'Não informado')}</div>
                      </td>
                      <td style="font-size: 0.78rem; color: var(--text-muted); max-width: 180px;">
                        ${esc(m.observacoes || '-')}
                      </td>
                      <td style="text-align: right;"><div class="row-actions">${botoesAcoes(m.id)}</div></td>
                    </tr>
                  `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVA MANIPULAÇÃO -->
    <div class="modal-overlay" id="modalNovaManip">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="tituloModalManip">Novo Pedido de Manipulação</h3>
          <button class="modal-close" id="btnFecharModalManip">&times;</button>
        </div>
        <form id="formNovaManip">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label">Selecionar Cliente <span class="req">*</span></label>
              <select class="form-select" id="manip_cliente_id" required>
                <option value="">-- Escolha um cliente --</option>
                ${clientes.map(c => `<option value="${Number(c.id)}">${esc(c.nome)} (CPF: ${esc(c.cpf)})</option>`).join('')}
              </select>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Fórmula / Composição do Medicamento <span class="req">*</span></label>
              <textarea class="form-textarea" id="manip_formula" required placeholder="Ex: Minoxidil 5%, Biotina 2mg, Loção qsp 60ml"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Data do Pedido</label>
              <input type="date" class="form-input" id="manip_data" value="${hojeISO()}"/>
            </div>

            <div class="form-group">
              <label class="form-label">Prazo Previsto de Entrega</label>
              <input type="date" class="form-input" id="manip_prazo"/>
            </div>

            <div class="form-group">
              <label class="form-label">Valor (R$)</label>
              <input type="number" step="0.01" class="form-input" id="manip_valor" placeholder="0.00"/>
            </div>

            <div class="form-group">
              <label class="form-label">Forma de Pagamento</label>
              <select class="form-select" id="manip_pagamento">
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Instruções de Uso & Observações</label>
              <textarea class="form-textarea" id="manip_obs" placeholder="Posologia, modo de conservação, etc."></textarea>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnCancelarManip">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarManip">Registrar Manipulação</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById('modalNovaManip');
  const form = document.getElementById('formNovaManip');
  const selectCliente = document.getElementById('manip_cliente_id');
  let editando = null;

  function abrirModal(item = null) {
    editando = item;
    form.reset();
    document.getElementById('tituloModalManip').textContent = item ? 'Editar Pedido de Manipulação' : 'Novo Pedido de Manipulação';
    document.getElementById('btnSalvarManip').textContent = item ? 'Salvar Alterações' : 'Registrar Manipulação';
    // O paciente de um pedido já registrado não pode ser trocado.
    selectCliente.disabled = !!item;
    if (item) {
      selectCliente.value = String(item.cliente_id);
      document.getElementById('manip_formula').value = item.formula || '';
      document.getElementById('manip_data').value = item.data || '';
      document.getElementById('manip_prazo').value = item.prazo_entrega || '';
      document.getElementById('manip_valor').value = item.valor ?? '';
      document.getElementById('manip_pagamento').value = item.forma_pagamento || 'PIX';
      document.getElementById('manip_obs').value = item.observacoes || '';
    }
    modal.classList.add('active');
  }
  const fecharModal = () => modal.classList.remove('active');

  document.getElementById('btnAbrirModalManip').onclick = () => abrirModal();
  document.getElementById('btnFecharModalManip').onclick = fecharModal;
  document.getElementById('btnCancelarManip').onclick = fecharModal;

  const porId = id => manipulacoes.find(m => String(m.id) === String(id));
  ligarAcoes(container, {
    editar: id => abrirModal(porId(id)),
    excluir: id => confirmarEExcluir({
      mensagem: `Excluir o pedido de manipulação de ${porId(id)?.cliente_nome || 'este cliente'}? Esta ação não pode ser desfeita.`,
      excluir: () => api.excluirManipulacao(id),
      aoConcluir: () => renderManipulacoes(container),
    }),
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      formula: document.getElementById('manip_formula').value.trim(),
      data: document.getElementById('manip_data').value,
      prazo_entrega: document.getElementById('manip_prazo').value || null,
      valor: parseFloat(document.getElementById('manip_valor').value) || 0,
      forma_pagamento: document.getElementById('manip_pagamento').value,
      observacoes: document.getElementById('manip_obs').value.trim() || null,
    };
    if (!editando) {
      const clienteId = parseInt(selectCliente.value, 10);
      const clienteSelecionado = clientes.find(c => c.id === clienteId);
      payload.cliente_id = clienteId;
      payload.cliente_nome = clienteSelecionado ? clienteSelecionado.nome : null;
    }

    try {
      if (editando) await api.atualizarManipulacao(editando.id, payload);
      else await api.cadastrarManipulacao(payload);
      fecharModal();
      await renderManipulacoes(container);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };
}
