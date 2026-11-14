// ============================================================
//  VIEW: CLIENTES (TABELA MINIMALISTA, MODAL E DOSSIÊ 360°)
// ============================================================

import { api } from '../api.js';
import { abrirFormularioCliente } from '../formCliente.js';
import { formatarDataBR } from '../pdf.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, formatarMoeda, ligarAcoes } from '../utils.js';
import { SEXOS } from '../validacao.js';

export async function renderClientes(container, searchTerm = '') {
  const clientes = await api.listarClientes(searchTerm);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Clientes Cadastrados</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">${clientes.length} paciente(s) ${searchTerm ? 'encontrado(s)' : 'na lista'} · cadastro rápido: só nome e WhatsApp</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary" id="btnAbrirModalCliente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Cliente
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table-modern table-compact">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>CPF / RG</th>
              <th>WhatsApp / Endereço</th>
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
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(c.email || '')}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="font-weight: 600; font-family: monospace;">${esc(c.cpf || '—')}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(c.rg || '-')}</div>
                      </td>
                      <td>
                        <div style="font-weight: 500;">${esc(c.telefone)}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${esc(c.endereco_completo || '')}">${esc(c.endereco_completo || '—')}</div>
                      </td>
                      <td>
                        <span class="badge badge-neutral">${c.sexo === 'M' ? 'Masc' : c.sexo === 'F' ? 'Fem' : c.sexo ? 'Outro' : '—'}</span>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${esc(formatarDataBR(c.data_nascimento) || '—')}</div>
                      </td>
                      <td>
                        ${
                          c.alergia
                            ? `<span class="badge badge-danger" title="${esc(c.alergia)}">⚠️ ${esc(c.alergia)}</span>`
                            : `<span class="badge badge-success">Nenhuma</span>`
                        }
                      </td>
                      <td style="text-align: right;">
                        <div class="row-actions">
                          <button class="btn btn-secondary btn-sm" onclick="window.abrirDossie(${Number(c.id)})" style="border-radius: var(--radius-pill); font-weight: 600; white-space: nowrap;">
                            Dossiê 360°
                          </button>
                          ${botoesAcoes(c.id)}
                        </div>
                      </td>
                    </tr>
                  `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- DRAWER LATERAL: DOSSIÊ 360° DO CLIENTE -->
    <div class="drawer-overlay" id="drawerDossie">
      <div class="drawer-panel" id="drawerDossieContent">
        <!-- Preenchido dinamicamente via abrirDossie(id) -->
      </div>
    </div>
  `;

  // Cadastro e edição: formulário compartilhado (o mesmo usado no balcão das outras telas)
  const recarregar = () => renderClientes(container, searchTerm);
  document.getElementById('btnAbrirModalCliente').onclick = async () => {
    if (await abrirFormularioCliente({ modo: 'novo' })) await recarregar();
  };

  const porId = id => clientes.find(c => String(c.id) === String(id));
  ligarAcoes(container, {
    editar: async id => {
      const cliente = porId(id);
      if (await abrirFormularioCliente({ modo: 'editar', cliente })) await recarregar();
    },
    excluir: id => confirmarEExcluir({
      mensagem: `Excluir o cadastro de ${porId(id)?.nome || 'este cliente'}? Esta ação não pode ser desfeita.`,
      excluir: () => api.excluirCliente(id),
      aoConcluir: recarregar,
    }),
  });

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
            <span style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">CPF: ${esc(c.cpf || '—')} • RG: ${esc(c.rg || '—')}</span>
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
        <div><strong>WhatsApp:</strong> ${esc(c.telefone)}</div>
        <div><strong>E-mail:</strong> ${esc(c.email || '—')}</div>
        <div><strong>Nascimento:</strong> ${esc(formatarDataBR(c.data_nascimento) || '—')}</div>
        <div><strong>Sexo:</strong> ${esc(SEXOS[c.sexo] || '—')}</div>
        <div style="grid-column: 1 / -1;"><strong>Endereço:</strong> ${esc(c.endereco_completo || '—')}</div>
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
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-title);">${(ex.itens?.length ? ex.itens : [{ nome: ex.tipo_exame, valor: ex.valor }]).map(i => `• ${esc(i.nome)} <span style="font-weight: 500; color: var(--text-muted);">${formatarMoeda(i.valor)}</span>`).join('<br>')}</div>
                  <div style="font-size: 0.78rem; color: var(--text-body); margin-top: 4px;">${esc(ex.observacoes || 'Sem observações')}</div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                    <span>Data: ${esc(formatarDataBR(ex.data) || ex.data)}</span>
                    <strong style="color: var(--color-primary-dark);">Total ${formatarMoeda(ex.valor)}</strong>
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
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-title);">${r.medico_prescritor ? esc(r.medico_prescritor) : 'Receita'}</div>
                  <div style="font-size: 0.78rem; color: var(--text-body); margin-top: 4px;">
                    ${(r.itens?.length ? r.itens : [{ medicamento: r.medicamentos || '—' }]).map(i => `
                      <div>• ${esc(i.medicamento)}${i.quantidade ? ` <span style="color: var(--text-muted);">(${esc(i.quantidade)} un.)</span>` : ''}</div>`).join('')}
                  </div>
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
