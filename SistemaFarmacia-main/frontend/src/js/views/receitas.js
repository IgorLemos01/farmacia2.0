// ============================================================
//  VIEW: RECEITAS MÉDICAS
// ============================================================

import { api } from '../api.js';
import { escapeHtml as esc } from '../utils.js';

export async function renderReceitas(container) {
  const [receitas, clientes] = await Promise.all([
    api.listarReceitas(),
    api.listarClientes(),
  ]);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Receitas Médicas</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Registro de prescrições, médicos e medicamentos dispensados</p>
        </div>
        <button class="btn btn-primary" id="btnAbrirModalReceita">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Registrar Receita
        </button>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Médico Prescritor</th>
              <th>Medicamentos Prescritos</th>
              <th>Data do Atendimento</th>
            </tr>
          </thead>
          <tbody>
            ${
              receitas.length === 0
                ? `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhuma receita registrada.</td></tr>`
                : receitas.map(r => `
                    <tr>
                      <td>
                        <div style="font-weight: 700; color: var(--text-title);">${esc(r.cliente_nome || 'Cliente #' + r.cliente_id)}</div>
                      </td>
                      <td>
                        <div style="font-weight: 600; color: var(--text-title);">${esc(r.medico_prescritor)}</div>
                      </td>
                      <td style="max-width: 320px;">
                        <div style="font-size: 0.86rem; color: var(--text-body);">${esc(r.medicamentos)}</div>
                      </td>
                      <td>
                        <span class="badge badge-neutral">🗓️ ${esc(r.data_venda)}</span>
                      </td>
                    </tr>
                  `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVA RECEITA -->
    <div class="modal-overlay" id="modalNovaReceita">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Registrar Receita Médica</h3>
          <button class="modal-close" id="btnFecharModalReceita">&times;</button>
        </div>
        <form id="formNovaReceita">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label">Selecionar Paciente <span class="req">*</span></label>
              <select class="form-select" id="rec_cliente_id" required>
                <option value="">-- Escolha um cliente --</option>
                ${clientes.map(c => `<option value="${Number(c.id)}">${esc(c.nome)} (CPF: ${esc(c.cpf)})</option>`).join('')}
              </select>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Médico Prescritor (Nome e CRM) <span class="req">*</span></label>
              <input type="text" class="form-input" id="rec_medico" required placeholder="Ex: Dr. Carlos Eduardo (CRM-SE 12345)"/>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Medicamentos Prescritos & Posologia <span class="req">*</span></label>
              <textarea class="form-textarea" id="rec_medicamentos" required placeholder="Ex: Amoxicilina 500mg (21 caps), Paracetamol 750mg (10 cpr)"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Data da Venda / Atendimento</label>
              <input type="date" class="form-input" id="rec_data" value="${new Date().toISOString().split('T')[0]}"/>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnCancelarReceita">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Receita</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById('modalNovaReceita');
  document.getElementById('btnAbrirModalReceita').onclick = () => modal.classList.add('active');
  document.getElementById('btnFecharModalReceita').onclick = () => modal.classList.remove('active');
  document.getElementById('btnCancelarReceita').onclick = () => modal.classList.remove('active');

  document.getElementById('formNovaReceita').onsubmit = async (e) => {
    e.preventDefault();
    const clienteId = parseInt(document.getElementById('rec_cliente_id').value, 10);
    const clienteSelecionado = clientes.find(c => c.id === clienteId);

    const payload = {
      cliente_id: clienteId,
      cliente_nome: clienteSelecionado ? clienteSelecionado.nome : null,
      medico_prescritor: document.getElementById('rec_medico').value.trim(),
      medicamentos: document.getElementById('rec_medicamentos').value.trim(),
      data_venda: document.getElementById('rec_data').value,
    };

    try {
      await api.cadastrarReceita(payload);
      modal.classList.remove('active');
      await renderReceitas(container);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };
}
