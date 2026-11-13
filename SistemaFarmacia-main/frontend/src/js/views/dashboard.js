// ============================================================
//  VIEW: DASHBOARD E RELATÓRIOS
//
//  Abas: Visão Geral · Manipulação · Exames · Receitas.
//  Cada aba tem o PRÓPRIO período (de/até): mudar ou limpar a data de uma
//  categoria atualiza só os números, o gráfico e a tabela dela.
//  As abas de categoria trazem a listagem paginada e a exportação em PDF/Excel.
// ============================================================

import { api } from '../api.js';
import { formatarDataBR } from '../pdf.js';
import { exportarExcel, exportarPdf, formatarCelula, RELATORIOS, textoPeriodo } from '../relatorios.js';
import { state } from '../state.js';
import { escapeHtml as esc, formatarMoeda, hojeISO } from '../utils.js';

const ABAS = [
  { chave: 'geral', rotulo: 'Visão Geral' },
  { chave: 'manipulacoes', rotulo: 'Manipulação' },
  { chave: 'exames', rotulo: 'Exames' },
  { chave: 'receitas', rotulo: 'Receitas' },
];
const CORES = {
  manipulacoes: { cor: '#9333ea', fundo: '#fdf4ff', tipo: 'Manipulação' },
  exames: { cor: '#0284c7', fundo: '#f0f9ff', tipo: 'Exame' },
  receitas: { cor: '#059669', fundo: '#ecfdf5', tipo: 'Receita' },
};
const TAMANHOS_PAGINA = [20, 50, 100];

/** Estado das abas (fica guardado enquanto o sistema está aberto, por aba). */
const estado = {
  aba: 'geral',
  filtros: {
    geral: { de: '', ate: '' },
    manipulacoes: { de: '', ate: '', pagina: 1, limite: 20 },
    exames: { de: '', ate: '', pagina: 1, limite: 20 },
    receitas: { de: '', ate: '', pagina: 1, limite: 20 },
  },
};

/** Volta ao estado inicial (usado nos testes). */
export function reiniciarDashboard() {
  estado.aba = 'geral';
  Object.keys(estado.filtros).forEach(k => Object.assign(estado.filtros[k], { de: '', ate: '', pagina: 1 }));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatDateTimeBR() {
  const now = new Date();
  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const data = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return `${hora} &nbsp;|&nbsp; ${data}.`;
}

const diaDeslocado = (iso, dias) => {
  const d = new Date(iso + 'T00:00:00');
  return hojeISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
};

/** Atalhos de período. */
function periodoRapido(tipo, hoje = hojeISO()) {
  const [a, m] = hoje.split('-').map(Number);
  const doisDig = n => String(n).padStart(2, '0');
  if (tipo === 'hoje') return { de: hoje, ate: hoje };
  if (tipo === '7d') return { de: diaDeslocado(hoje, -6), ate: hoje };
  if (tipo === 'mes') return { de: `${a}-${doisDig(m)}-01`, ate: hoje };
  if (tipo === 'mes-passado') {
    const ini = new Date(a, m - 2, 1);
    const fim = new Date(a, m - 1, 0);
    return { de: hojeISO(ini), ate: hojeISO(fim) };
  }
  return { de: '', ate: '' };
}

/** Corrige datas invertidas e devolve uma cópia. */
function normalizarPeriodo({ de, ate }) {
  if (de && ate && de > ate) return { de: ate, ate: de };
  return { de: de || '', ate: ate || '' };
}

function filtroPeriodoHtml(chave, { de, ate }, extra = '') {
  const hoje = hojeISO();
  return `
    <div class="card filtro-periodo" data-filtro="${chave}">
      <div class="filtro-linha">
        <span class="filtro-titulo">Período:</span>
        <label class="filtro-campo">De
          <input type="date" class="form-input" data-campo="de" value="${esc(de)}" max="${hoje}"/>
        </label>
        <label class="filtro-campo">Até
          <input type="date" class="form-input" data-campo="ate" value="${esc(ate)}" max="${hoje}"/>
        </label>
        <div class="filtro-atalhos">
          <button type="button" class="btn btn-secondary btn-sm" data-rapido="hoje">Hoje</button>
          <button type="button" class="btn btn-secondary btn-sm" data-rapido="7d">7 dias</button>
          <button type="button" class="btn btn-secondary btn-sm" data-rapido="mes">Este mês</button>
          <button type="button" class="btn btn-secondary btn-sm" data-rapido="mes-passado">Mês passado</button>
          <button type="button" class="btn btn-secondary btn-sm" data-rapido="limpar" id="btnLimparFiltro">Limpar</button>
        </div>
        ${extra}
      </div>
      ${de || ate
        ? `<span class="filtro-ativo">Exibindo ${de ? `de ${formatarDataBR(de)} ` : ''}${ate ? `até ${formatarDataBR(ate)}` : ''}</span>`
        : '<span class="filtro-ativo filtro-ativo-neutro">Todo o período</span>'}
    </div>`;
}

function ligarFiltro(raiz, chave, aoMudar) {
  const caixa = raiz.querySelector(`[data-filtro="${chave}"]`);
  const ler = () => ({ de: caixa.querySelector('[data-campo="de"]').value, ate: caixa.querySelector('[data-campo="ate"]').value });
  caixa.querySelectorAll('[data-campo]').forEach(i => { i.onchange = () => aoMudar(ler()); });
  caixa.querySelectorAll('[data-rapido]').forEach(b => { b.onclick = () => aoMudar(periodoRapido(b.dataset.rapido)); });
}

function cartaoMetrica({ icone, fundo, valor, rotulo, extra = '', grande = true, rota }) {
  return `
    <div class="card metrica" ${rota ? `data-ir="${rota}" style="cursor: pointer;"` : ''}>
      <div class="metrica-topo">
        <div class="metrica-icone" style="background: ${fundo};">${icone}</div>
        <span class="metrica-valor ${grande ? '' : 'metrica-valor-menor'}">${valor}</span>
      </div>
      <span class="metrica-rotulo">${rotulo}</span>
      ${extra}
    </div>`;
}

const ICONES = {
  clientes: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  calendario: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  manipulacoes: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v4M14 2v4M8 6h8M6 10h12l-2 11H8L6 10z"/></svg>',
  exames: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  receitas: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  dinheiro: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  ticket: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

/** Barras horizontais simples (gráfico de linhas de valor). */
function barras(itens, { rotulo, valor, formatar, cor = 'var(--color-primary-dark)' }) {
  if (!itens.length) return '<p class="vazio-curto">Sem dados no período</p>';
  const maximo = Math.max(...itens.map(valor), 1);
  return `<div class="barras">${itens.map(i => `
    <div class="barra-linha">
      <span class="barra-rotulo" title="${esc(rotulo(i))}">${esc(rotulo(i))}</span>
      <div class="barra-trilho"><div class="barra-preenchida" style="width: ${(valor(i) / maximo) * 100}%; background: ${cor};"></div></div>
      <span class="barra-valor">${esc(formatar(i))}</span>
    </div>`).join('')}</div>`;
}

/** Agrupa a série diária por mês quando o período é longo (para o gráfico caber). */
function serieParaGrafico(porDia) {
  if (porDia.length <= 31) return porDia.map(d => ({ ...d, rotulo: formatarDataBR(d.data).slice(0, 5) }));
  const meses = new Map();
  porDia.forEach(d => {
    const chave = d.data.slice(0, 7);
    const atual = meses.get(chave) || { rotulo: `${chave.slice(5, 7)}/${chave.slice(0, 4)}`, quantidade: 0, valor: 0 };
    atual.quantidade += d.quantidade;
    atual.valor += Number(d.valor || 0);
    meses.set(chave, atual);
  });
  return [...meses.values()];
}

// ════════════════════════════════════════════════════════
//  Ponto de entrada
// ════════════════════════════════════════════════════════
export async function renderDashboard(container, searchTerm, filtros) {
  // compatibilidade: filtros passados direto valem para a Visão Geral
  if (filtros) Object.assign(estado.filtros.geral, { de: filtros.de || '', ate: filtros.ate || '' });
  if (window._dashClockInterval) clearInterval(window._dashClockInterval);

  container.innerHTML = `
    <div class="dash-topo">
      <div>
        <h1 class="dash-titulo">Dashboard</h1>
        <p class="dash-subtitulo">Visão geral e relatórios por serviço</p>
      </div>
      <div id="dashClock" class="dash-relogio"></div>
    </div>
    <p class="dash-saudacao">${getGreeting()}, <span>${esc((state.currentUser?.nome || 'Administrador').split(' ')[0])}!</span></p>
    <div class="tabs" role="tablist">
      ${ABAS.map(a => `<button type="button" class="tab ${a.chave === estado.aba ? 'active' : ''}" role="tab" data-aba="${a.chave}" aria-selected="${a.chave === estado.aba}">${esc(a.rotulo)}</button>`).join('')}
    </div>
    <div id="dashConteudo"></div>`;

  const clockEl = container.querySelector('#dashClock');
  const tick = () => { if (clockEl) clockEl.innerHTML = formatDateTimeBR(); };
  tick();
  window._dashClockInterval = setInterval(tick, 30000);

  const conteudo = container.querySelector('#dashConteudo');
  container.querySelectorAll('[data-aba]').forEach(botao => {
    botao.onclick = () => {
      estado.aba = botao.dataset.aba;
      container.querySelectorAll('[data-aba]').forEach(b => {
        const ativa = b.dataset.aba === estado.aba;
        b.classList.toggle('active', ativa);
        b.setAttribute('aria-selected', String(ativa));
      });
      mostrarAba(conteudo);
    };
  });
  await mostrarAba(conteudo);
}

async function mostrarAba(conteudo) {
  const aba = estado.aba;
  conteudo.innerHTML = '<div class="card carregando-bloco">Carregando…</div>';
  try {
    if (aba === 'geral') await renderVisaoGeral(conteudo);
    else await renderCategoria(conteudo, aba);
  } catch (err) {
    if (err.status === 401) return;
    conteudo.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <p style="font-weight: 700; color: var(--text-title); margin-bottom: 6px;">Não foi possível carregar os dados.</p>
        <p style="font-size: 0.85rem;">${esc(err.message)}</p>
      </div>`;
  }
}

// ════════════════════════════════════════════════════════
//  Visão Geral (todas as categorias juntas, com o próprio período)
// ════════════════════════════════════════════════════════
async function renderVisaoGeral(area) {
  const { de, ate } = normalizarPeriodo(estado.filtros.geral);
  Object.assign(estado.filtros.geral, { de, ate });
  const filtrando = !!(de || ate);
  const hoje = hojeISO();
  const fim7 = ate || hoje;
  const ini7 = diaDeslocado(fim7, -6);

  const [totalClientes, manip, exames, receitas, hManip, hExames, hReceitas, s7Manip, s7Exames] = await Promise.all([
    api.totalClientes(),
    api.relatorio('manipulacoes', { de, ate, limite: 8 }),
    api.relatorio('exames', { de, ate, limite: 8 }),
    api.relatorio('receitas', { de, ate, limite: 8 }),
    api.relatorio('manipulacoes', { de: hoje, ate: hoje, limite: 1 }),
    api.relatorio('exames', { de: hoje, ate: hoje, limite: 1 }),
    api.relatorio('receitas', { de: hoje, ate: hoje, limite: 1 }),
    api.relatorio('manipulacoes', { de: ini7, ate: fim7, limite: 1 }),
    api.relatorio('exames', { de: ini7, ate: fim7, limite: 1 }),
  ]);

  const atendimentosHoje = hManip.total + hExames.total + hReceitas.total;
  const receitaTotal = (manip.resumo.valor_total || 0) + (exames.resumo.valor_total || 0);
  const receitaHoje = (hManip.resumo.valor_total || 0) + (hExames.resumo.valor_total || 0);

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const iso = diaDeslocado(ini7, i);
    const soma = [s7Manip, s7Exames].reduce((t, r) => t + Number(r.resumo.por_dia.find(d => d.data === iso)?.valor || 0), 0);
    dias.push({ rotulo: iso.slice(5), total: soma });
  }

  const descricao = { manipulacoes: i => i.formula, exames: i => i.exames, receitas: i => i.medicamentos || i.medico_prescritor || 'Receita' };
  const ultimos = [['manipulacoes', manip], ['exames', exames], ['receitas', receitas]]
    .flatMap(([cat, rel]) => rel.itens.map(i => ({
      cat, cliente: i.cliente_nome || '—', descricao: String(descricao[cat](i) || ''), data: i.data, valor: cat === 'receitas' ? null : i.valor,
      ordem: `${i.data}-${String(i.id).padStart(12, '0')}`,
    })))
    .sort((a, b) => (b.ordem > a.ordem ? 1 : -1))
    .slice(0, 8);

  const vManip = manip.resumo.valor_total || 0;
  const vExames = exames.resumo.valor_total || 0;

  area.innerHTML = `
    ${filtroPeriodoHtml('geral', { de, ate })}

    <div class="metricas-grid">
      ${cartaoMetrica({ icone: ICONES.clientes, fundo: '#eef2ff', valor: totalClientes, rotulo: 'Clientes cadastrados', rota: 'clientes' })}
      ${cartaoMetrica({ icone: ICONES.calendario, fundo: '#ecfdf5', valor: atendimentosHoje, rotulo: 'Atendimentos hoje' })}
      ${cartaoMetrica({ icone: ICONES.manipulacoes, fundo: '#fdf4ff', valor: manip.total, rotulo: filtrando ? 'Manipulações no período' : 'Manipulações total', rota: 'aba:manipulacoes' })}
      ${cartaoMetrica({ icone: ICONES.exames, fundo: '#f0f9ff', valor: exames.total, rotulo: filtrando ? 'Atendimentos de exames no período' : 'Atendimentos de exames', rota: 'aba:exames' })}
      ${cartaoMetrica({ icone: ICONES.receitas, fundo: '#ecfdf5', valor: receitas.total, rotulo: filtrando ? 'Receitas no período' : 'Receitas total', rota: 'aba:receitas' })}
      ${cartaoMetrica({
        icone: ICONES.dinheiro, fundo: '#fef9ee', valor: formatarMoeda(receitaTotal), grande: false,
        rotulo: filtrando ? 'Receita no período' : 'Receita total',
        extra: `<span class="metrica-extra">+${formatarMoeda(receitaHoje)} hoje</span>`,
      })}
    </div>

    <div class="dash-duas-colunas">
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="card-cabecalho">
          <div class="card-titulo">Últimos Serviços</div>
          <div class="card-subtitulo">${filtrando ? 'Registros do período' : 'Registros mais recentes'}</div>
        </div>
        <div style="padding: 6px 0;">
          ${ultimos.length === 0
            ? '<div class="vazio-bloco">Nenhum serviço registrado</div>'
            : ultimos.map(item => `
                <div class="servico-linha">
                  <div class="servico-esq">
                    <span class="servico-tipo" style="background: ${CORES[item.cat].fundo}; color: ${CORES[item.cat].cor};">${CORES[item.cat].tipo}</span>
                    <div style="min-width: 0;">
                      <div class="servico-cliente">${esc(item.cliente)}</div>
                      <div class="servico-desc">${esc(item.descricao)}</div>
                    </div>
                  </div>
                  <div class="servico-dir">
                    ${item.valor != null ? `<div class="servico-valor">${formatarMoeda(item.valor)}</div>` : ''}
                    <div class="servico-data">${esc(formatarDataBR(item.data))}</div>
                  </div>
                </div>`).join('')}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div class="card" style="padding: 0; overflow: hidden;">
          <div class="card-cabecalho"><div class="card-titulo">Receita (7 dias${ate ? ` até ${formatarDataBR(ate)}` : ''})</div></div>
          <div style="padding: 10px 22px;">
            ${barras(dias, { rotulo: d => d.rotulo, valor: d => d.total, formatar: d => formatarMoeda(d.total) })}
          </div>
        </div>
        <div class="card" style="padding: 18px 22px;">
          <div class="card-titulo" style="margin-bottom: 14px;">Por Tipo de Serviço</div>
          ${vManip === 0 && vExames === 0
            ? '<p class="vazio-curto">Sem dados no período</p>'
            : [
                { rotulo: 'Manipulações', valor: vManip, cor: CORES.manipulacoes.cor },
                { rotulo: 'Exames', valor: vExames, cor: CORES.exames.cor },
              ].map(({ rotulo, valor, cor }) => {
                const pct = Math.round((valor / (vManip + vExames || 1)) * 100);
                return `
                  <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                      <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-title);">${rotulo}</span>
                      <span style="font-size: 0.82rem; font-weight: 700; color: ${cor};">${formatarMoeda(valor)}</span>
                    </div>
                    <div class="barra-trilho"><div class="barra-preenchida" style="width: ${pct}%; background: ${cor};"></div></div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">${pct}% do total</div>
                  </div>`;
              }).join('')}
        </div>
      </div>
    </div>`;

  ligarFiltro(area, 'geral', periodo => {
    Object.assign(estado.filtros.geral, periodo);
    mostrarAba(area);
  });
  area.querySelectorAll('[data-ir]').forEach(el => {
    el.onclick = () => {
      const destino = el.dataset.ir;
      if (destino.startsWith('aba:')) document.querySelector(`[data-aba="${destino.slice(4)}"]`)?.click();
      else window.appRouter?.navigate(destino);
    };
  });
}

// ════════════════════════════════════════════════════════
//  Relatório de uma categoria (Manipulação, Exames ou Receitas)
// ════════════════════════════════════════════════════════
async function renderCategoria(area, categoria) {
  const cfg = RELATORIOS[categoria];
  const filtro = estado.filtros[categoria];
  Object.assign(filtro, normalizarPeriodo(filtro));
  const rel = await api.relatorio(categoria, { de: filtro.de, ate: filtro.ate, pagina: filtro.pagina, limite: filtro.limite });
  // página além do fim (ex.: depois de diminuir o período): volta para a última
  if (rel.paginas && filtro.pagina > rel.paginas) {
    filtro.pagina = rel.paginas;
    return renderCategoria(area, categoria);
  }
  const r = rel.resumo;
  const cor = CORES[categoria];

  const metricas = [
    cartaoMetrica({ icone: ICONES[categoria], fundo: cor.fundo, valor: r.quantidade, rotulo: categoria === 'exames' ? 'Atendimentos' : 'Registros' }),
    cartaoMetrica({ icone: ICONES.clientes, fundo: '#eef2ff', valor: r.clientes_atendidos, rotulo: 'Clientes atendidos' }),
  ];
  if (cfg.temValor) {
    metricas.push(
      cartaoMetrica({ icone: ICONES.dinheiro, fundo: '#fef9ee', valor: formatarMoeda(r.valor_total), grande: false, rotulo: 'Faturamento' }),
      cartaoMetrica({ icone: ICONES.ticket, fundo: '#fff1f2', valor: formatarMoeda(r.ticket_medio), grande: false, rotulo: 'Ticket médio' }),
    );
  }
  if (categoria === 'exames') metricas.push(cartaoMetrica({ icone: ICONES.exames, fundo: '#f0f9ff', valor: r.total_exames, rotulo: 'Exames realizados' }));
  if (categoria === 'receitas') {
    metricas.push(cartaoMetrica({ icone: ICONES.receitas, fundo: '#ecfdf5', valor: r.total_medicamentos, rotulo: 'Medicamentos dispensados' }));
  }

  const serie = serieParaGrafico(r.por_dia || []);
  const ranking = categoria === 'exames' ? r.mais_realizados : categoria === 'receitas' ? r.mais_dispensados : null;

  const inicio = rel.total ? (rel.pagina_atual - 1) * filtro.limite + 1 : 0;
  const fim = Math.min(rel.pagina_atual * filtro.limite, rel.total);

  area.innerHTML = `
    ${filtroPeriodoHtml(categoria, filtro, `
      <div class="filtro-exportar">
        <button type="button" class="btn btn-secondary btn-sm" data-exportar="pdf" ${rel.total ? '' : 'disabled'}>⬇ PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" data-exportar="xlsx" ${rel.total ? '' : 'disabled'}>⬇ Excel</button>
      </div>`)}

    <div class="relatorio-cabecalho">
      <h2>${esc(cfg.titulo)}</h2>
      <p>${esc(cfg.descricao)} · ${esc(textoPeriodo(filtro))}</p>
    </div>

    <div class="metricas-grid">${metricas.join('')}</div>

    <div class="dash-duas-colunas">
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="card-cabecalho">
          <div class="card-titulo">${cfg.temValor ? 'Faturamento' : 'Receitas'} por ${serie.length && serie[0].rotulo.length > 5 ? 'mês' : 'dia'}</div>
        </div>
        <div style="padding: 10px 22px; max-height: 330px; overflow-y: auto;">
          ${cfg.temValor
            ? barras(serie, { rotulo: d => d.rotulo, valor: d => Number(d.valor || 0), formatar: d => `${formatarMoeda(d.valor)} (${d.quantidade})`, cor: cor.cor })
            : barras(serie, { rotulo: d => d.rotulo, valor: d => d.quantidade, formatar: d => `${d.quantidade} receita(s)`, cor: cor.cor })}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 18px;">
        ${cfg.temValor ? `
          <div class="card" style="padding: 18px 22px;">
            <div class="card-titulo" style="margin-bottom: 12px;">Por forma de pagamento</div>
            ${barras(r.por_pagamento || [], { rotulo: p => p.forma, valor: p => p.valor, formatar: p => `${formatarMoeda(p.valor)} (${p.quantidade})`, cor: cor.cor })}
          </div>` : ''}
        ${ranking ? `
          <div class="card" style="padding: 18px 22px;">
            <div class="card-titulo" style="margin-bottom: 12px;">${categoria === 'exames' ? 'Exames mais realizados' : 'Medicamentos mais dispensados'}</div>
            ${barras(ranking, {
              rotulo: x => x.nome, valor: x => x.quantidade, cor: cor.cor,
              formatar: x => (categoria === 'exames' ? `${x.quantidade}× · ${formatarMoeda(x.valor)}` : `${x.quantidade}× · ${x.unidades} un.`),
            })}
          </div>` : ''}
      </div>
    </div>

    <div class="card" style="padding: 0; overflow: hidden; margin-top: 18px;">
      <div class="card-cabecalho card-cabecalho-linha">
        <div>
          <div class="card-titulo">Registros</div>
          <div class="card-subtitulo">${rel.total ? `Mostrando ${inicio}–${fim} de ${rel.total}` : 'Nenhum registro no período'}</div>
        </div>
        <label class="filtro-campo filtro-campo-linha">Por página
          <select class="form-select" data-limite>
            ${TAMANHOS_PAGINA.map(n => `<option value="${n}" ${n === filtro.limite ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="table-responsive">
        <table class="table-modern table-compact tabela-relatorio">
          <thead><tr>${cfg.colunas.map(c => `<th class="${c.tipo === 'moeda' || c.tipo === 'numero' ? 'num' : ''}">${esc(c.titulo)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rel.itens.length === 0
              ? `<tr><td colspan="${cfg.colunas.length}" class="vazio-bloco">Nenhum registro no período.</td></tr>`
              : rel.itens.map(item => `<tr>${cfg.colunas.map(c => `<td class="${c.tipo === 'moeda' || c.tipo === 'numero' ? 'num' : ''}">${esc(formatarCelula(c, item[c.chave]))}</td>`).join('')}</tr>`).join('')}
          </tbody>
          ${cfg.temValor && rel.total ? `
            <tfoot><tr><td colspan="${cfg.colunas.length - 1}">Total do período</td><td class="num">${formatarMoeda(r.valor_total)}</td></tr></tfoot>` : ''}
        </table>
      </div>
      ${rel.paginas > 1 ? `
        <div class="paginacao">
          <button type="button" class="btn btn-secondary btn-sm" data-pagina="${rel.pagina_atual - 1}" ${rel.pagina_atual <= 1 ? 'disabled' : ''}>‹ Anterior</button>
          <span>Página ${rel.pagina_atual} de ${rel.paginas}</span>
          <button type="button" class="btn btn-secondary btn-sm" data-pagina="${rel.pagina_atual + 1}" ${rel.pagina_atual >= rel.paginas ? 'disabled' : ''}>Próxima ›</button>
        </div>` : ''}
    </div>`;

  const recarregar = () => mostrarAba(area);
  ligarFiltro(area, categoria, periodo => {
    Object.assign(filtro, periodo, { pagina: 1 });
    recarregar();
  });
  area.querySelectorAll('[data-pagina]').forEach(b => {
    b.onclick = () => { filtro.pagina = Number(b.dataset.pagina); recarregar(); };
  });
  area.querySelector('[data-limite]').onchange = (e) => {
    filtro.limite = Number(e.target.value);
    filtro.pagina = 1;
    recarregar();
  };
  area.querySelectorAll('[data-exportar]').forEach(botao => {
    botao.onclick = async () => {
      const original = botao.textContent;
      botao.disabled = true;
      botao.textContent = 'Gerando…';
      try {
        const completo = await api.relatorio(categoria, { de: filtro.de, ate: filtro.ate, todos: true });
        const usuario = state.currentUser;
        if (botao.dataset.exportar === 'pdf') await exportarPdf(categoria, completo, usuario);
        else exportarExcel(categoria, completo, usuario);
      } catch (err) {
        alert('Não foi possível exportar: ' + err.message);
      } finally {
        botao.disabled = false;
        botao.textContent = original;
      }
    };
  });
}
