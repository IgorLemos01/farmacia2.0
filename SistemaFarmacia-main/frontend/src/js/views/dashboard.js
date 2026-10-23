// ============================================================
//  VIEW: DASHBOARD — ESTILO FUNCIONAL CLEAN
// ============================================================

import { api } from '../api.js';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
}

function formatDateTimeBR() {
  const now = new Date();
  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const data = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return `${hora} &nbsp;|&nbsp; ${data}.`;
}

// Últimos 7 dias para receita
function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      iso: d.toISOString().split('T')[0],
    });
  }
  return days;
}

function calcReceita7Dias(manipulacoes, exames, dataInicio) {
  const dias = getLast7Days();
  return dias.map(({ label, iso }) => {
    const total = [
      ...manipulacoes.filter(m => m.data === iso),
      ...exames.filter(e => e.data === iso),
    ].reduce((acc, item) => acc + Number(item.valor || 0), 0);
    return { label, total };
  });
}

export async function renderDashboard(container, searchTerm, filtros = {}) {
  // Monta referência de data atual para filtros
  const hoje = new Date().toISOString().split('T')[0];
  const de = filtros.de || '';
  const ate = filtros.ate || '';

  // Carrega os dados
  const [clientes, manipulacoes, exames, receitas] = await Promise.all([
    api.listarClientes(),
    api.listarManipulacoes(),
    api.listarExames(),
    api.listarReceitas(),
  ]);

  // --- Métricas ---
  const atendimentosHoje = [
    ...manipulacoes.filter(m => m.data === hoje),
    ...exames.filter(e => e.data === hoje),
    ...receitas.filter(r => r.data_venda === hoje),
  ].length;

  const receitaTotal = [...manipulacoes, ...exames].reduce(
    (acc, item) => acc + Number(item.valor || 0), 0
  );
  const receitaHoje = [...manipulacoes, ...exames]
    .filter(item => (item.data || item.data_venda) === hoje)
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);

  // Receita 7 dias
  const receita7Dias = calcReceita7Dias(manipulacoes, exames);
  const maxReceita = Math.max(...receita7Dias.map(d => d.total), 1);

  // Últimos Serviços (últimos 8 registros unificados)
  const ultimos = [
    ...manipulacoes.map(m => ({
      tipo: 'Manipulação',
      cliente: m.cliente_nome || '—',
      descricao: (m.formula || '').substring(0, 48) + ((m.formula || '').length > 48 ? '…' : ''),
      data: m.data,
      valor: m.valor,
      ts: m.criado_em || m.data,
    })),
    ...exames.map(e => ({
      tipo: 'Exame',
      cliente: e.cliente_nome || '—',
      descricao: e.tipo_exame,
      data: e.data,
      valor: e.valor,
      ts: e.criado_em || e.data,
    })),
    ...receitas.map(r => ({
      tipo: 'Receita',
      cliente: r.cliente_nome || '—',
      descricao: r.medico_prescritor,
      data: r.data_venda,
      valor: null,
      ts: r.criado_em || r.data_venda,
    })),
  ].sort((a, b) => (b.ts > a.ts ? 1 : -1)).slice(0, 8);

  // Receita por tipo de serviço
  const totalManipulacaoValor = manipulacoes.reduce((a, m) => a + Number(m.valor || 0), 0);
  const totalExameValor = exames.reduce((a, e) => a + Number(e.valor || 0), 0);

  // --- Atualiza o relógio no header ---
  if (window._dashClockInterval) clearInterval(window._dashClockInterval);

  container.innerHTML = `
    <!-- CABEÇALHO DO DASHBOARD -->
    <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 22px; flex-wrap: wrap; gap: 8px;">
      <div>
        <h1 style="font-size: 1.7rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.5px; line-height: 1.2;">Dashboard</h1>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">Visão geral do sistema</p>
      </div>
      <div id="dashClock" style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; text-align: right;"></div>
    </div>

    <!-- FILTRO DE PERÍODO -->
    <div class="card" style="margin-bottom: 20px; padding: 16px 20px;">
      <div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap;">
        <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-title);">Período:</span>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">De</label>
            <input type="date" id="filtro_de" class="form-input" style="height: 36px; width: 160px; font-size: 0.85rem;"
              value="${de}" max="${hoje}" />
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Até</label>
            <input type="date" id="filtro_ate" class="form-input" style="height: 36px; width: 160px; font-size: 0.85rem;"
              value="${ate}" max="${hoje}" />
          </div>
          <button id="btnLimparFiltro" class="btn btn-secondary btn-sm" style="margin-top: 20px; height: 36px;">
            Limpar
          </button>
        </div>
      </div>
    </div>

    <!-- SAUDAÇÃO -->
    <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-body); margin-bottom: 14px;">
      ${getGreeting()}, <span style="color: var(--color-primary-dark);">Administrador!</span>
    </p>

    <!-- LINHA DE 6 MÉTRICAS -->
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 22px;">

      <!-- Clientes -->
      <div class="card" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; cursor: pointer;" onclick="window.appRouter.navigate('clientes')">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #eef2ff; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span style="font-size: 2rem; font-weight: 800; color: var(--text-title); line-height: 1;">${clientes.length}</span>
        </div>
        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">Clientes cadastrados</span>
      </div>

      <!-- Atendimentos Hoje -->
      <div class="card" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #ecfdf5; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <span style="font-size: 2rem; font-weight: 800; color: var(--text-title); line-height: 1;">${atendimentosHoje}</span>
        </div>
        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">Atendimentos hoje</span>
      </div>

      <!-- Manipulações -->
      <div class="card" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; cursor: pointer;" onclick="window.appRouter.navigate('manipulacoes')">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #fdf4ff; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v4M14 2v4M8 6h8M6 10h12l-2 11H8L6 10z"/></svg>
          </div>
          <span style="font-size: 2rem; font-weight: 800; color: var(--text-title); line-height: 1;">${manipulacoes.length}</span>
        </div>
        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">Manipulações total</span>
      </div>

      <!-- Exames -->
      <div class="card" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 8px; cursor: pointer;" onclick="window.appRouter.navigate('exames')">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #f0f9ff; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span style="font-size: 2rem; font-weight: 800; color: var(--text-title); line-height: 1;">${exames.length}</span>
        </div>
        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">Exames total</span>
      </div>

      <!-- Receita Total -->
      <div class="card" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #fef9ee; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span style="font-size: 1.35rem; font-weight: 800; color: var(--text-title); line-height: 1; white-space: nowrap;">${formatCurrency(receitaTotal)}</span>
        </div>
        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">Receita total</span>
        <span style="font-size: 0.72rem; color: #059669; font-weight: 600;">+${formatCurrency(receitaHoje)} hoje</span>
      </div>

      <!-- A Receber -->
      <div class="card" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #fff1f2; display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span style="font-size: 1.35rem; font-weight: 800; color: var(--text-title); line-height: 1; white-space: nowrap;">${formatCurrency(0)}</span>
        </div>
        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">A receber</span>
      </div>
    </div>

    <!-- LINHA INFERIOR: ÚLTIMOS SERVIÇOS + RECEITA 7 DIAS -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">

      <!-- ÚLTIMOS SERVIÇOS -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 18px 22px 14px; border-bottom: 1px solid var(--border-light);">
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-title);">Últimos Serviços</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 1px;">Registros mais recentes</div>
        </div>

        <div style="padding: 14px 0;">
          ${
            ultimos.length === 0
              ? `<div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 0.88rem;">
                   Nenhum serviço registrado
                 </div>`
              : ultimos.map(item => {
                  const cor = item.tipo === 'Manipulação' ? '#9333ea' : item.tipo === 'Exame' ? '#0284c7' : '#059669';
                  const bg  = item.tipo === 'Manipulação' ? '#fdf4ff' : item.tipo === 'Exame' ? '#f0f9ff' : '#ecfdf5';
                  return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 22px; border-bottom: 1px solid var(--border-light);">
                      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        <span style="font-size: 0.68rem; font-weight: 700; background: ${bg}; color: ${cor}; padding: 3px 9px; border-radius: 99px; white-space: nowrap; flex-shrink: 0;">${item.tipo}</span>
                        <div style="min-width: 0;">
                          <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-title); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.cliente}</div>
                          <div style="font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${item.descricao}</div>
                        </div>
                      </div>
                      <div style="text-align: right; flex-shrink: 0; margin-left: 10px;">
                        ${item.valor != null
                          ? `<div style="font-size: 0.85rem; font-weight: 700; color: var(--text-title);">${formatCurrency(item.valor)}</div>`
                          : ''}
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${formatDateBR(item.data)}</div>
                      </div>
                    </div>
                  `;
                }).join('')
          }
        </div>
      </div>

      <!-- COLUNA DIREITA: RECEITA 7 DIAS + POR TIPO -->
      <div style="display: flex; flex-direction: column; gap: 18px;">

        <!-- RECEITA 7 DIAS -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div style="padding: 18px 22px 14px; border-bottom: 1px solid var(--border-light);">
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-title);">Receita (7 dias)</div>
          </div>
          <div style="padding: 6px 0;">
            ${receita7Dias.map(({ label, total }) => {
              const pct = maxReceita > 0 ? (total / maxReceita) * 100 : 0;
              return `
                <div style="display: flex; align-items: center; padding: 8px 22px; gap: 12px;">
                  <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; width: 36px; flex-shrink: 0;">${label}</span>
                  <div style="flex: 1; height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: var(--color-primary-dark); border-radius: 99px; transition: width 0.6s ease;"></div>
                  </div>
                  <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-title); min-width: 64px; text-align: right;">${formatCurrency(total)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- POR TIPO DE SERVIÇO -->
        <div class="card" style="padding: 18px 22px;">
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-title); margin-bottom: 14px;">Por Tipo de Serviço</div>

          ${totalManipulacaoValor === 0 && totalExameValor === 0
            ? `<p style="font-size: 0.82rem; color: var(--text-muted); font-style: italic;">Sem dados no período</p>`
            : `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${[
                  { label: 'Manipulações', valor: totalManipulacaoValor, cor: '#9333ea', bg: '#fdf4ff' },
                  { label: 'Exames', valor: totalExameValor, cor: '#0284c7', bg: '#f0f9ff' },
                ].map(({ label, valor, cor, bg }) => {
                  const total = totalManipulacaoValor + totalExameValor || 1;
                  const pct = Math.round((valor / total) * 100);
                  return `
                    <div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-title);">${label}</span>
                        <span style="font-size: 0.82rem; font-weight: 700; color: ${cor};">${formatCurrency(valor)}</span>
                      </div>
                      <div style="height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background: ${cor}; border-radius: 99px;"></div>
                      </div>
                      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">${pct}% do total</div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
        </div>
      </div>
    </div>
  `;

  // Relógio em tempo real
  const clockEl = document.getElementById('dashClock');
  function tickClock() {
    if (clockEl) clockEl.innerHTML = formatDateTimeBR();
  }
  tickClock();
  window._dashClockInterval = setInterval(tickClock, 30000);

  // Filtros de período
  document.getElementById('btnLimparFiltro').onclick = () => {
    document.getElementById('filtro_de').value = '';
    document.getElementById('filtro_ate').value = '';
    renderDashboard(container, '', {});
  };
  document.getElementById('filtro_de').onchange = (e) => {
    renderDashboard(container, '', {
      de: e.target.value,
      ate: document.getElementById('filtro_ate').value,
    });
  };
  document.getElementById('filtro_ate').onchange = (e) => {
    renderDashboard(container, '', {
      de: document.getElementById('filtro_de').value,
      ate: e.target.value,
    });
  };
}
