// ============================================================
//  RELATÓRIOS POR CATEGORIA — colunas, exportação PDF e Excel
//
//  Cada categoria (Manipulação, Exames, Receitas) tem os próprios cabeçalhos.
//  O emissor (nome, cargo e CRF) vem do usuário logado, nunca do código.
// ============================================================

import { EMPRESA, formatarDataBR } from './pdf.js';
import { baixarArquivo, gerarXlsx, TIPO_XLSX } from './xlsx.js';

const moeda = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

/**
 * Colunas de cada relatório. `tipo` define o formato (texto, data, moeda, numero);
 * `largura` é a largura na planilha; `peso` é a largura relativa no PDF.
 */
export const RELATORIOS = {
  manipulacoes: {
    titulo: 'Relatório de Manipulação',
    curto: 'Manipulação',
    descricao: 'Fórmulas manipuladas / pedidos do laboratório',
    temValor: true,
    colunas: [
      { chave: 'data', titulo: 'Data', tipo: 'data', largura: 12, peso: 9 },
      { chave: 'cliente_nome', titulo: 'Cliente', largura: 28, peso: 18 },
      { chave: 'cliente_telefone', titulo: 'WhatsApp', largura: 17, peso: 12 },
      { chave: 'formula', titulo: 'Fórmula / Composição', largura: 50, peso: 30 },
      { chave: 'prazo_entrega', titulo: 'Prazo de entrega', tipo: 'data', largura: 14, peso: 10 },
      { chave: 'forma_pagamento', titulo: 'Pagamento', largura: 17, peso: 11 },
      { chave: 'valor', titulo: 'Valor', tipo: 'moeda', largura: 13, peso: 10 },
    ],
  },
  exames: {
    titulo: 'Relatório de Exames',
    curto: 'Exames',
    descricao: 'Exames laboratoriais e testes rápidos realizados',
    temValor: true,
    colunas: [
      { chave: 'data', titulo: 'Data', tipo: 'data', largura: 12, peso: 9 },
      { chave: 'cliente_nome', titulo: 'Cliente', largura: 28, peso: 18 },
      { chave: 'cliente_telefone', titulo: 'WhatsApp', largura: 17, peso: 12 },
      { chave: 'exames', titulo: 'Exames realizados', largura: 50, peso: 32 },
      { chave: 'quantidade_exames', titulo: 'Qtd.', tipo: 'numero', largura: 7, peso: 5 },
      { chave: 'forma_pagamento', titulo: 'Pagamento', largura: 17, peso: 11 },
      { chave: 'valor', titulo: 'Total', tipo: 'moeda', largura: 13, peso: 10 },
    ],
  },
  receitas: {
    titulo: 'Relatório de Receitas',
    curto: 'Receitas',
    descricao: 'Medicamentos controlados/antibióticos dispensados via receita',
    temValor: false,
    colunas: [
      { chave: 'data', titulo: 'Data', tipo: 'data', largura: 12, peso: 9 },
      { chave: 'cliente_nome', titulo: 'Cliente', largura: 28, peso: 17 },
      { chave: 'cliente_telefone', titulo: 'WhatsApp', largura: 17, peso: 12 },
      { chave: 'medicamentos', titulo: 'Medicamentos', largura: 55, peso: 32 },
      { chave: 'unidades', titulo: 'Unid.', tipo: 'numero', largura: 8, peso: 6 },
      { chave: 'medico_prescritor', titulo: 'Médico prescritor', largura: 28, peso: 14 },
      { chave: 'farmaceutico', titulo: 'Farmacêutico', largura: 24, peso: 12 },
    ],
  },
};

/** Texto do período: "01/10/2026 a 31/10/2026", "a partir de ...", "até ..." ou "Todo o período". */
export function textoPeriodo({ de, ate } = {}) {
  if (de && ate) return `${formatarDataBR(de)} a ${formatarDataBR(ate)}`;
  if (de) return `A partir de ${formatarDataBR(de)}`;
  if (ate) return `Até ${formatarDataBR(ate)}`;
  return 'Todo o período';
}

/** "Ana Souza — Farmacêutica Responsável — CRF-SE 1234" (usuário logado). */
export function textoEmissor(usuario) {
  if (!usuario?.nome) return '';
  return [usuario.nome, usuario.cargo, usuario.registro_profissional].filter(Boolean).join(' — ');
}

/** Valor da célula formatado para tela/PDF. */
export function formatarCelula(coluna, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (coluna.tipo === 'data') return formatarDataBR(valor) || String(valor);
  if (coluna.tipo === 'moeda') return moeda(valor);
  return String(valor);
}

/** Linhas de resumo (para o cabeçalho do PDF/planilha). */
export function linhasResumo(categoria, resumo = {}) {
  const partes = [`Registros: ${resumo.quantidade ?? 0}`, `Clientes atendidos: ${resumo.clientes_atendidos ?? 0}`];
  if (RELATORIOS[categoria].temValor) {
    partes.push(`Faturamento: ${moeda(resumo.valor_total)}`, `Ticket médio: ${moeda(resumo.ticket_medio)}`);
  }
  if (categoria === 'exames') partes.push(`Exames realizados: ${resumo.total_exames ?? 0}`);
  if (categoria === 'receitas') partes.push(`Medicamentos dispensados: ${resumo.total_medicamentos ?? 0}`);
  return partes.join('   ·   ');
}

export function nomeArquivoRelatorio(categoria, { de, ate } = {}, extensao) {
  const periodo = de || ate ? `${de || 'inicio'}_a_${ate || 'hoje'}` : 'todo-periodo';
  return `relatorio-${categoria}-${periodo}.${extensao}`;
}

function agoraBR(data = new Date()) {
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Excel ───────────────────────────────────────────────
export function montarXlsxRelatorio(categoria, relatorio, usuario, agora = new Date()) {
  const cfg = RELATORIOS[categoria];
  const linhas = relatorio.itens.map(item => cfg.colunas.map(c => item[c.chave]));
  let total = null;
  if (cfg.temValor) {
    total = cfg.colunas.map((c, i) => (i === 0 ? 'TOTAL' : c.tipo === 'moeda' ? relatorio.resumo.valor_total : null));
  }
  return gerarXlsx({
    aba: cfg.curto,
    titulo: `${EMPRESA} — ${cfg.titulo}`,
    subtitulos: [
      `Período: ${textoPeriodo(relatorio.periodo)}`,
      linhasResumo(categoria, relatorio.resumo),
      `Emitido por: ${textoEmissor(usuario) || '—'} em ${agoraBR(agora)}`,
    ],
    colunas: cfg.colunas.map(c => ({ titulo: c.titulo, tipo: c.tipo, largura: c.largura })),
    linhas,
    total,
  });
}

export function exportarExcel(categoria, relatorio, usuario) {
  const bytes = montarXlsxRelatorio(categoria, relatorio, usuario);
  baixarArquivo(bytes, nomeArquivoRelatorio(categoria, relatorio.periodo, 'xlsx'), TIPO_XLSX);
}

// ── PDF (A4 paisagem) ───────────────────────────────────
export function montarPdfRelatorio(JsPDF, categoria, relatorio, usuario, agora = new Date()) {
  const cfg = RELATORIOS[categoria];
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const L = 297, A = 210, M = 12, LARG = L - 2 * M;
  const somaPesos = cfg.colunas.reduce((t, c) => t + c.peso, 0);
  const larguras = cfg.colunas.map(c => (c.peso / somaPesos) * LARG);
  doc.setProperties({ title: `${cfg.titulo} — ${textoPeriodo(relatorio.periodo)}`, subject: EMPRESA, creator: EMPRESA });

  let y;
  function cabecalhoPagina(primeira) {
    y = M;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(primeira ? 13 : 10);
    doc.text(`${EMPRESA} — ${cfg.titulo}`, M, y + 4);
    y += primeira ? 8 : 6;
    if (primeira) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Período: ${textoPeriodo(relatorio.periodo)}`, M, y + 3);
      y += 5;
      doc.text(linhasResumo(categoria, relatorio.resumo), M, y + 3);
      y += 5;
      doc.text(`Emitido por: ${textoEmissor(usuario) || '—'} em ${agoraBR(agora)}`, M, y + 3);
      y += 7;
    }
    // cabeçalho da tabela
    doc.setFillColor(237, 242, 252);
    doc.rect(M, y, LARG, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = M;
    cfg.colunas.forEach((c, i) => {
      const alinhar = c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : 'left';
      doc.text(c.titulo, alinhar === 'right' ? x + larguras[i] - 1.5 : x + 1.5, y + 4.3, { align: alinhar });
      x += larguras[i];
    });
    y += 6.5;
    doc.setFont('helvetica', 'normal');
  }

  cabecalhoPagina(true);
  doc.setFontSize(7.8);
  if (!relatorio.itens.length) {
    doc.text('Nenhum registro no período.', M + 1.5, y + 6);
  }
  relatorio.itens.forEach((item, n) => {
    const textos = cfg.colunas.map((c, i) => doc.splitTextToSize(formatarCelula(c, item[c.chave]), larguras[i] - 3));
    const altura = Math.max(...textos.map(t => t.length)) * 3.3 + 2.4;
    if (y + altura > A - M - 6) {
      doc.addPage('a4', 'landscape');
      cabecalhoPagina(false);
      doc.setFontSize(7.8);
    }
    if (n % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(M, y, LARG, altura, 'F');
    }
    let x = M;
    cfg.colunas.forEach((c, i) => {
      const direita = c.tipo === 'moeda' || c.tipo === 'numero';
      doc.text(textos[i], direita ? x + larguras[i] - 1.5 : x + 1.5, y + 3.6, { align: direita ? 'right' : 'left' });
      x += larguras[i];
    });
    y += altura;
    doc.setDrawColor(232, 237, 234);
    doc.line(M, y, M + LARG, y);
  });

  if (cfg.temValor && relatorio.itens.length) {
    if (y + 8 > A - M - 6) { doc.addPage('a4', 'landscape'); cabecalhoPagina(false); }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`TOTAL DO PERÍODO: ${moeda(relatorio.resumo.valor_total)}`, M + LARG - 1.5, y + 6, { align: 'right' });
  }

  // rodapé com numeração
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(`${cfg.titulo} · ${textoPeriodo(relatorio.periodo)}`, M, A - 6);
    doc.text(`Página ${p} de ${paginas}`, L - M, A - 6, { align: 'right' });
    doc.setTextColor(0);
  }
  return doc;
}

export async function exportarPdf(categoria, relatorio, usuario) {
  const { jsPDF } = await import('jspdf');
  const doc = montarPdfRelatorio(jsPDF, categoria, relatorio, usuario);
  doc.save(nomeArquivoRelatorio(categoria, relatorio.periodo, 'pdf'));
}
