// ============================================================
//  VIEW: EXAMES E PROCEDIMENTOS FARMACÊUTICOS
// ============================================================

import { api } from '../api.js';
import { escapeHtml as esc } from '../utils.js';

export async function renderExames(container) {
  const [exames, clientes] = await Promise.all([
    api.listarExames(),
    api.listarClientes(),
  ]);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Exames Realizados</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Glicemia, pressão arterial, perfil lipídico e testes rápidos</p>
        </div>
        <button class="btn btn-primary" id="btnAbrirModalExame">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Registrar Exame
        </button>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Tipo de Exame</th>
              <th>Data</th>
              <th>Valor & Pagamento</th>
              <th>Resultado / Observações</th>
            </tr>
          </thead>
          <tbody>
            ${
              exames.length === 0
                ? `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum exame registrado.</td></tr>`
                : exames.map(e => `
                    <tr>
                      <td>
                        <div style="font-weight: 700; color: var(--text-title);">${esc(e.cliente_nome || 'Cliente #' + e.cliente_id)}</div>
                      </td>
                      <td>
                        <span class="badge badge-info" style="font-size: 0.8rem; font-weight: 600;">🩺 ${esc(e.tipo_exame)}</span>
                      </td>
                      <td>${esc(e.data || '-')}</td>
                      <td>
                        <div style="font-weight: 700;">R$ ${Number(e.valor || 0).toFixed(2)}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${esc(e.forma_pagamento || '-')}</div>
                      </td>
                      <td style="font-size: 0.82rem; color: var(--text-body); max-width: 240px;">
                        ${esc(e.observacoes || '-')}
                      </td>
                    </tr>
                  `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVO EXAME -->
    <div class="modal-overlay" id="modalNovoExame">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Registrar Exame / Teste Clínico</h3>
          <button class="modal-close" id="btnFecharModalExame">&times;</button>
        </div>
        <form id="formNovoExame">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label">Selecionar Paciente <span class="req">*</span></label>
              <select class="form-select" id="exame_cliente_id" required>
                <option value="">-- Escolha um cliente --</option>
                ${clientes.map(c => `<option value="${Number(c.id)}">${esc(c.nome)} (CPF: ${esc(c.cpf)})</option>`).join('')}
              </select>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Tipo de Exame / Procedimento <span class="req">*</span></label>
              <input type="text" class="form-input" id="exame_tipo" required placeholder="Ex: Glicemia Capilar, Pressão Arterial, Teste Rápido COVID..."/>
            </div>

            <div class="form-group">
              <label class="form-label">Data de Realização</label>
              <input type="date" class="form-input" id="exame_data" value="${new Date().toISOString().split('T')[0]}"/>
            </div>

            <div class="form-group">
              <label class="form-label">Valor (R$)</label>
              <input type="number" step="0.01" class="form-input" id="exame_valor" placeholder="0.00"/>
            </div>

            <div class="form-group">
              <label class="form-label">Forma de Pagamento</label>
              <select class="form-select" id="exame_pagamento">
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Resultado & Parecer Farmacêutico</label>
              <textarea class="form-textarea" id="exame_obs" placeholder="Valores aferidos, orientação ao paciente, etc."></textarea>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnCancelarExame">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Exame</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById('modalNovoExame');
  document.getElementById('btnAbrirModalExame').onclick = () => modal.classList.add('active');
  document.getElementById('btnFecharModalExame').onclick = () => modal.classList.remove('active');
  document.getElementById('btnCancelarExame').onclick = () => modal.classList.remove('active');

  document.getElementById('formNovoExame').onsubmit = async (e) => {
    e.preventDefault();
    const clienteId = parseInt(document.getElementById('exame_cliente_id').value, 10);
    const clienteSelecionado = clientes.find(c => c.id === clienteId);

    const payload = {
      cliente_id: clienteId,
      cliente_nome: clienteSelecionado ? clienteSelecionado.nome : null,
      tipo_exame: document.getElementById('exame_tipo').value.trim(),
      data: document.getElementById('exame_data').value,
      valor: parseFloat(document.getElementById('exame_valor').value) || 0,
      forma_pagamento: document.getElementById('exame_pagamento').value,
      observacoes: document.getElementById('exame_obs').value.trim() || null,
    };

    try {
      await api.cadastrarExame(payload);
      modal.classList.remove('active');
      await renderExames(container);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };
}
