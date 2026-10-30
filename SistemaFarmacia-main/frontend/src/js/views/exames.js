// ============================================================
//  VIEW: EXAMES E PROCEDIMENTOS FARMACÊUTICOS
// ============================================================

import { api } from '../api.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, formatarMoeda, hojeISO, ligarAcoes } from '../utils.js';

export async function renderExames(container) {
  const [exames, clientes, catalogo] = await Promise.all([
    api.listarExames(),
    api.listarClientes(),
    api.listarCatalogoExames({ apenasAtivos: true }),
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
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${
              exames.length === 0
                ? `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum exame registrado.</td></tr>`
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
                      <td style="text-align: right;"><div class="row-actions">${botoesAcoes(e.id)}</div></td>
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
          <h3 class="modal-title" id="tituloModalExame">Registrar Exame / Teste Clínico</h3>
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
              <label class="form-label" for="exame_tipo">Exame <span class="req">*</span></label>
              <input type="text" class="form-input" id="exame_tipo" list="listaCatalogoExames" autocomplete="off" required
                     placeholder="Digite para buscar no catálogo…"/>
              <datalist id="listaCatalogoExames">
                ${catalogo.map(c => `<option value="${esc(c.nome)}"></option>`).join('')}
              </datalist>
              <small id="dicaExame" role="status" style="display: block; margin-top: 6px; font-size: 0.78rem; color: var(--text-muted);"></small>
            </div>

            <div class="form-group">
              <label class="form-label">Data de Realização</label>
              <input type="date" class="form-input" id="exame_data" value="${hojeISO()}"/>
            </div>

            <div class="form-group">
              <label class="form-label" for="exame_valor">Valor (do catálogo)</label>
              <input type="text" class="form-input" id="exame_valor" readonly tabindex="-1" placeholder="—"/>
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
            <button type="submit" class="btn btn-primary" id="btnSalvarExame">Salvar Exame</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById('modalNovoExame');
  const form = document.getElementById('formNovoExame');
  const selectCliente = document.getElementById('exame_cliente_id');
  const campoTipo = document.getElementById('exame_tipo');
  const campoValor = document.getElementById('exame_valor');
  const dica = document.getElementById('dicaExame');
  const btnSalvar = document.getElementById('btnSalvarExame');
  let editando = null;

  // O exame só pode ser escolhido no catálogo: o nome digitado precisa existir lá.
  const normalizar = texto => texto.replace(/\s+/g, ' ').trim().toLowerCase();
  const porNome = new Map(catalogo.map(c => [normalizar(c.nome), c]));
  const escolhido = () => porNome.get(normalizar(campoTipo.value));

  campoTipo.addEventListener('input', () => {
    if (editando) return;
    const item = escolhido();
    campoValor.value = item ? formatarMoeda(item.valor) : '';
    dica.textContent = campoTipo.value.trim() && !item ? 'Escolha um exame da lista do catálogo.' : '';
  });

  function abrirModal(item = null) {
    editando = item;
    form.reset();
    document.getElementById('tituloModalExame').textContent = item ? 'Editar Exame / Teste Clínico' : 'Registrar Exame / Teste Clínico';
    btnSalvar.textContent = item ? 'Salvar Alterações' : 'Salvar Exame';
    // O paciente, o exame e o valor de um registro já feito não mudam.
    selectCliente.disabled = !!item;
    campoTipo.readOnly = !!item;
    campoValor.value = '';
    dica.textContent = '';
    btnSalvar.disabled = false;
    if (item) {
      selectCliente.value = String(item.cliente_id);
      campoTipo.value = item.tipo_exame || '';
      campoValor.value = item.valor != null ? formatarMoeda(item.valor) : '';
      document.getElementById('exame_data').value = item.data || '';
      document.getElementById('exame_pagamento').value = item.forma_pagamento || 'PIX';
      document.getElementById('exame_obs').value = item.observacoes || '';
      dica.textContent = 'O exame e o valor não podem ser alterados. Para trocar, exclua este registro e cadastre de novo.';
    } else if (!catalogo.length) {
      btnSalvar.disabled = true;
      dica.textContent = 'O catálogo está vazio. Peça a um administrador para cadastrar os exames em Configurações → Catálogo de Exames.';
    }
    modal.classList.add('active');
  }
  const fecharModal = () => modal.classList.remove('active');

  document.getElementById('btnAbrirModalExame').onclick = () => abrirModal();
  document.getElementById('btnFecharModalExame').onclick = fecharModal;
  document.getElementById('btnCancelarExame').onclick = fecharModal;

  const porId = id => exames.find(x => String(x.id) === String(id));
  ligarAcoes(container, {
    editar: id => abrirModal(porId(id)),
    excluir: id => confirmarEExcluir({
      mensagem: `Excluir o exame "${porId(id)?.tipo_exame || ''}" de ${porId(id)?.cliente_nome || 'este paciente'}? Esta ação não pode ser desfeita.`,
      excluir: () => api.excluirExame(id),
      aoConcluir: () => renderExames(container),
    }),
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      data: document.getElementById('exame_data').value,
      forma_pagamento: document.getElementById('exame_pagamento').value,
      observacoes: document.getElementById('exame_obs').value.trim() || null,
    };
    if (!editando) {
      const item = escolhido();
      if (!item) {
        alert('Escolha um exame da lista do catálogo.');
        campoTipo.focus();
        return;
      }
      payload.catalogo_id = item.id;
      const clienteId = parseInt(selectCliente.value, 10);
      const clienteSelecionado = clientes.find(c => c.id === clienteId);
      payload.cliente_id = clienteId;
      payload.cliente_nome = clienteSelecionado ? clienteSelecionado.nome : null;
    }

    try {
      if (editando) await api.atualizarExame(editando.id, payload);
      else await api.cadastrarExame(payload);
      fecharModal();
      await renderExames(container);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
  };
}
