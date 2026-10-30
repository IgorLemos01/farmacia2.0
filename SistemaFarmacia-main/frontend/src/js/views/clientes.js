// ============================================================
//  VIEW: CLIENTES (TABELA MINIMALISTA, MODAL E DOSSIÊ 360°)
// ============================================================

import { api } from '../api.js';
import { escapeHtml as esc } from '../utils.js';

export async function renderClientes(container, searchTerm = '') {
  const clientes = await api.listarClientes(searchTerm);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Clientes Cadastrados</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Total de ${clientes.length} paciente(s) na base</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary" id="btnAbrirModalCliente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Cliente
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>CPF / RG</th>
              <th>Contato</th>
              <th>Sexo / Nasc.</th>
              <th>Alergias</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${
              clientes.length === 0
                ? `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum cliente encontrado.</td></tr>`
                : clientes.map(c => `
                    <tr>
                      <td>
                        <div class="cell-user">
                          <div class="user-initials">${esc(c.nome.substring(0, 2).toUpperCase())}</div>
                          <div>
                            <div style="font-weight: 700; color: var(--text-title);">${esc(c.nome)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(c.email)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="font-weight: 600; font-family: monospace;">${esc(c.cpf)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(c.rg || '-')}</div>
                      </td>
                      <td>
                        <div style="font-weight: 500;">${esc(c.telefone)}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${esc(c.endereco)}</div>
                      </td>
                      <td>
                        <span class="badge badge-neutral">${c.sexo === 'M' ? 'Masc' : c.sexo === 'F' ? 'Fem' : 'Outro'}</span>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${esc(c.data_nascimento || '-')}</div>
                      </td>
                      <td>
                        ${
                          c.alergia
                            ? `<span class="badge badge-danger" title="${esc(c.alergia)}">⚠️ ${esc(c.alergia)}</span>`
                            : `<span class="badge badge-success">Nenhuma</span>`
                        }
                      </td>
                      <td style="text-align: right;">
                        <button class="btn btn-secondary btn-sm" onclick="window.abrirDossie(${Number(c.id)})" style="border-radius: var(--radius-pill); font-weight: 600;">
                          Dossiê 360° →
                        </button>
                      </td>
                    </tr>
                  `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL DE CADASTRO DE CLIENTE -->
    <div class="modal-overlay" id="modalNovoCliente">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Novo Cliente</h3>
          <button class="modal-close" id="btnFecharModalCliente">&times;</button>
        </div>
        <form id="formNovoCliente">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label">Nome Completo <span class="req">*</span></label>
              <input type="text" class="form-input" id="cli_nome" required placeholder="Ex: Ana Maria dos Santos"/>
            </div>

            <div class="form-group">
              <label class="form-label">CPF <span class="req">*</span></label>
              <input type="text" class="form-input" id="cli_cpf" required placeholder="000.000.000-00"/>
            </div>

            <div class="form-group">
              <label class="form-label">RG <span class="req">*</span></label>
              <input type="text" class="form-input" id="cli_rg" required placeholder="0.000.000-SSP"/>
            </div>

            <div class="form-group">
              <label class="form-label">Data de Nascimento <span class="req">*</span></label>
              <input type="date" class="form-input" id="cli_nasc" required/>
            </div>

            <div class="form-group">
              <label class="form-label">Sexo <span class="req">*</span></label>
              <select class="form-select" id="cli_sexo" required>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Telefone / WhatsApp <span class="req">*</span></label>
              <input type="tel" class="form-input" id="cli_tel" required placeholder="(79) 99999-9999"/>
            </div>

            <div class="form-group">
              <label class="form-label">E-mail <span class="req">*</span></label>
              <input type="email" class="form-input" id="cli_email" required placeholder="cliente@email.com"/>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Endereço Completo <span class="req">*</span></label>
              <input type="text" class="form-input" id="cli_end" required placeholder="Rua, número, bairro, cidade - UF"/>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Alergias Conhecidas</label>
              <input type="text" class="form-input" id="cli_alergia" placeholder="Ex: Dipirona, Penicilina, Iodo..."/>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Observações Gerais</label>
              <textarea class="form-textarea" id="cli_obs" placeholder="Preferências de contato, histórico ou informações complementares..."></textarea>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnCancelarCliente">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Cadastro</button>
          </div>
        </form>
      </div>
    </div>

    <!-- DRAWER LATERAL: DOSSIÊ 360° DO CLIENTE -->
    <div class="drawer-overlay" id="drawerDossie">
      <div class="drawer-panel" id="drawerDossieContent">
        <!-- Preenchido dinamicamente via abrirDossie(id) -->
      </div>
    </div>
  `;

  // Handlers do Modal
  const modal = document.getElementById('modalNovoCliente');
  document.getElementById('btnAbrirModalCliente').onclick = () => modal.classList.add('active');
  document.getElementById('btnFecharModalCliente').onclick = () => modal.classList.remove('active');
  document.getElementById('btnCancelarCliente').onclick = () => modal.classList.remove('active');

  // Submit do formulário de cliente
  document.getElementById('formNovoCliente').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nome: document.getElementById('cli_nome').value.trim(),
      cpf: document.getElementById('cli_cpf').value.trim(),
      rg: document.getElementById('cli_rg').value.trim(),
      data_nascimento: document.getElementById('cli_nasc').value,
      sexo: document.getElementById('cli_sexo').value,
      telefone: document.getElementById('cli_tel').value.trim(),
      email: document.getElementById('cli_email').value.trim(),
      endereco: document.getElementById('cli_end').value.trim(),
      alergia: document.getElementById('cli_alergia').value.trim() || null,
      observacoes: document.getElementById('cli_obs').value.trim() || null,
    };

    try {
      await api.cadastrarCliente(payload);
      modal.classList.remove('active');
      await renderClientes(container);
    } catch (err) {
      alert('Erro ao cadastrar cliente: ' + err.message);
    }
  };

  // Função global de Dossiê 360°
  window.abrirDossie = async (id) => {
    const drawer = document.getElementById('drawerDossie');
    const drawerContent = document.getElementById('drawerDossieContent');
    drawer.classList.add('active');

    drawerContent.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Carregando histórico do paciente...</div>`;

    let dossie;
    try {
      dossie = await api.obterDossieCliente(id);
    } catch (err) {
      drawerContent.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Não foi possível carregar o dossiê: ${esc(err.message)}</div>`;
      return;
    }
    const c = dossie.cliente;
    const h = dossie.historico;

    drawerContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div style="display: flex; gap: 14px; align-items: center;">
          <div class="user-initials" style="width: 52px; height: 52px; font-size: 1.2rem;">${esc(c.nome.substring(0, 2).toUpperCase())}</div>
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-title);">${esc(c.nome)}</h3>
            <span style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">CPF: ${esc(c.cpf)} • RG: ${esc(c.rg)}</span>
          </div>
        </div>
        <button class="modal-close" onclick="document.getElementById('drawerDossie').classList.remove('active')">&times;</button>
      </div>

      ${
        c.alergia
          ? `<div style="background: #fde8e8; border: 1px solid #f8b4b4; padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 20px;">
               <div style="color: #9b1c1c; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                 ⚠️ ALERTA DE ALERGIA:
               </div>
               <div style="color: #771d1d; font-size: 0.82rem; margin-top: 2px;">${esc(c.alergia)}</div>
             </div>`
          : ''
      }

      <div style="background: #f8faf9; border: 1px solid var(--border-light); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 24px; font-size: 0.84rem; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div><strong>Telefone:</strong> ${esc(c.telefone)}</div>
        <div><strong>E-mail:</strong> ${esc(c.email)}</div>
        <div><strong>Nascimento:</strong> ${esc(c.data_nascimento)}</div>
        <div><strong>Sexo:</strong> ${c.sexo === 'M' ? 'Masculino' : c.sexo === 'F' ? 'Feminino' : 'Outro'}</div>
        <div style="grid-column: 1 / -1;"><strong>Endereço:</strong> ${esc(c.endereco)}</div>
      </div>

      <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-title); margin-bottom: 12px;">Histórico Clínico Unificado</h4>

      <!-- Seção Manipulações -->
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Fórmulas Manipuladas (${h.manipulacoes.length})</span>
        </div>
        ${
          h.manipulacoes.length === 0
            ? `<p style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;">Nenhuma fórmula registrada.</p>`
            : h.manipulacoes.map(m => `
                <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; margin-bottom: 8px;">
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-title);">${esc(m.formula)}</div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    <span>Data: ${esc(m.data)} • Prazo: ${esc(m.prazo_entrega || '-')}</span>
                    <strong style="color: var(--color-primary-dark);">R$ ${Number(m.valor || 0).toFixed(2)} (${esc(m.forma_pagamento || '-')})</strong>
                  </div>
                </div>
              `).join('')
        }
      </div>

      <!-- Seção Exames -->
      <div style="margin-bottom: 20px;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Exames Realizados (${h.exames.length})</span>
        ${
          h.exames.length === 0
            ? `<p style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; margin-top: 6px;">Nenhum exame registrado.</p>`
            : h.exames.map(ex => `
                <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; margin-top: 8px;">
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-title);">${esc(ex.tipo_exame)}</div>
                  <div style="font-size: 0.78rem; color: var(--text-body); margin-top: 4px;">${esc(ex.observacoes || 'Sem observações')}</div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    <span>Data: ${esc(ex.data)}</span>
                    <strong style="color: var(--color-primary-dark);">R$ ${Number(ex.valor || 0).toFixed(2)}</strong>
                  </div>
                </div>
              `).join('')
        }
      </div>

      <!-- Seção Receitas -->
      <div>
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Receitas Médicas (${h.receitas.length})</span>
        ${
          h.receitas.length === 0
            ? `<p style="font-size: 0.78rem; color: var(--text-muted); font-style: italic; margin-top: 6px;">Nenhuma receita registrada.</p>`
            : h.receitas.map(r => `
                <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; margin-top: 8px;">
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-title);">${esc(r.medico_prescritor)}</div>
                  <div style="font-size: 0.78rem; color: var(--text-body); margin-top: 4px;"><strong>Prescrição:</strong> ${esc(r.medicamentos)}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Data de atendimento: ${esc(r.data_venda)}</div>
                </div>
              `).join('')
        }
      </div>
    `;
  };

  // Fecha drawer ao clicar fora
  document.getElementById('drawerDossie').onclick = (e) => {
    if (e.target.id === 'drawerDossie') {
      document.getElementById('drawerDossie').classList.remove('active');
    }
  };
}
