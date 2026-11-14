// ============================================================
//  ORÇAMENTOS EM PDF — Exames e Manipulação
//  Gerados no formulário, sem salvar o atendimento. Podem ser baixados (PDF)
//  ou impressos direto. A4 em pé: dados da farmácia, cliente (se escolhido),
//  itens com valores, total, detalhes (ex.: prazo), validade e quem emitiu.
// ============================================================

import { EMPRESA, formatarDataBR, imprimirDocumento } from './pdf.js';

/** Dados públicos da farmácia (os mesmos do rodapé do site). */
export const DADOS_FARMACIA = {
  cnpj: '53.835.152/0001-70',
  endereco: 'Dt. Jorrinho s/n, Tucano — BA, CEP 48790-000',
  whatsapp: '(75) 99115-4571',
};
/** Por quantos dias o orçamento vale. */
export const VALIDADE_DIAS = 7;

/** Título, cabeçalho da coluna e nome do arquivo de cada tipo de orçamento. */
export const TIPOS_ORCAMENTO = {
  exames: { titulo: 'ORÇAMENTO DE EXAMES', coluna: 'Exame', arquivo: 'orcamento-exames', contagem: 'exame(s)' },
  manipulacao: { titulo: 'ORÇAMENTO DE MANIPULAÇÃO', coluna: 'Fórmula / composição', arquivo: 'orcamento-manipulacao', contagem: 'fórmula(s)' },
};

const moeda = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(a, m - 1, d + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function nomeArquivoOrcamento(cliente, data, tipo = 'exames') {
  const nome = String(cliente?.nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cliente';
  return `${TIPOS_ORCAMENTO[tipo].arquivo}-${nome}-${data}.pdf`;
}

/**
 * @param {Function} JsPDF
 * @param {object} p
 * @param {'exames'|'manipulacao'} [p.tipo='exames']
 * @param {{nome:string, valor:number}[]} p.itens   Itens e valores.
 * @param {object} [p.cliente]  Cliente escolhido (nome, telefone) — opcional.
 * @param {string} p.data       Data do orçamento (AAAA-MM-DD).
 * @param {[string, string][]} [p.detalhes]  Linhas extras, ex.: [['Prazo de entrega', '20/11/2026']].
 * @param {object} [p.usuario]  Quem emitiu (nome, cargo, registro_profissional).
 */
export function montarPdfOrcamento(JsPDF, { tipo = 'exames', itens, cliente = null, data, detalhes = [], usuario = null }) {
  const cfg = TIPOS_ORCAMENTO[tipo];
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const L = 210, M = 18, LARG = L - 2 * M;
  const total = itens.reduce((t, i) => t + (Number(i.valor) || 0), 0);
  doc.setProperties({ title: `${cfg.titulo} — ${cliente?.nome || 'cliente'}`, subject: EMPRESA, creator: EMPRESA });

  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(EMPRESA, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`CNPJ ${DADOS_FARMACIA.cnpj} · ${DADOS_FARMACIA.endereco} · WhatsApp ${DADOS_FARMACIA.whatsapp}`, M, y + 6);
  doc.setTextColor(0);
  doc.setDrawColor(7, 33, 98);
  doc.setLineWidth(0.6);
  doc.line(M, y + 10, M + LARG, y + 10);

  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(cfg.titulo, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Data: ${formatarDataBR(data)}`, M + LARG, y, { align: 'right' });

  y += 9;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(cliente?.nome || '—', M + 17, y);
  if (cliente?.telefone) {
    doc.setFont('helvetica', 'bold');
    doc.text('WhatsApp:', M + LARG - 55, y);
    doc.setFont('helvetica', 'normal');
    doc.text(cliente.telefone, M + LARG, y, { align: 'right' });
  }

  // Tabela
  y += 9;
  doc.setFillColor(237, 242, 252);
  doc.rect(M, y, LARG, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('#', M + 3, y + 5.4);
  doc.text(cfg.coluna, M + 12, y + 5.4);
  doc.text('Valor', M + LARG - 3, y + 5.4, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  itens.forEach((item, i) => {
    const linhas = doc.splitTextToSize(String(item.nome || ''), LARG - 50);
    const altura = Math.max(8, linhas.length * 4.6 + 3.4);
    if (y + altura > 260) { doc.addPage('a4', 'portrait'); y = 20; }
    doc.text(String(i + 1), M + 3, y + 5.4);
    doc.text(linhas, M + 12, y + 5.4);
    doc.text(moeda(item.valor), M + LARG - 3, y + 5.4, { align: 'right' });
    y += altura;
    doc.line(M, y, M + LARG, y);
  });

  y += 3;
  doc.setFillColor(7, 33, 98);
  doc.rect(M + LARG - 80, y, 80, 10, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(`TOTAL: ${moeda(total)}`, M + LARG - 3, y + 6.8, { align: 'right' });
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`${itens.length} ${cfg.contagem}`, M, y + 6.8);
  y += 18;

  // Detalhes (prazo de entrega, observações...)
  const preenchidos = detalhes.filter(([, valor]) => valor);
  if (preenchidos.length) {
    doc.setFontSize(10);
    for (const [rotulo, valor] of preenchidos) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${rotulo}:`, M, y);
      doc.setFont('helvetica', 'normal');
      const linhas = doc.splitTextToSize(String(valor), LARG - 42);
      doc.text(linhas, M + 40, y);
      y += linhas.length * 4.8 + 2;
    }
    y += 4;
  }

  doc.setFontSize(9);
  doc.setTextColor(70);
  const avisos = [
    `Orçamento válido até ${formatarDataBR(somarDias(data, VALIDADE_DIAS))} (${VALIDADE_DIAS} dias). Valores sujeitos a alteração após essa data.`,
    'Este documento é apenas um orçamento: não é recibo nem comprovante de pagamento.',
  ];
  avisos.forEach(t => { doc.text(doc.splitTextToSize(t, LARG), M, y); y += 5.5; });
  if (usuario?.nome) {
    y += 4;
    doc.text(`Emitido por: ${[usuario.nome, usuario.cargo, usuario.registro_profissional].filter(Boolean).join(' — ')}`, M, y);
  }
  doc.setTextColor(0);
  return doc;
}

async function montar(dados) {
  const { jsPDF } = await import('jspdf');
  return montarPdfOrcamento(jsPDF, dados);
}

/** Baixa o orçamento em PDF. */
export async function baixarPdfOrcamento(dados) {
  const doc = await montar(dados);
  const arquivo = nomeArquivoOrcamento(dados.cliente, dados.data, dados.tipo);
  doc.save(arquivo);
  return arquivo;
}

/** Abre a impressão do orçamento direto (sem baixar). */
export async function imprimirPdfOrcamento(dados) {
  const doc = await montar(dados);
  await imprimirDocumento(doc, nomeArquivoOrcamento(dados.cliente, dados.data, dados.tipo), 'Impressão do orçamento');
}
