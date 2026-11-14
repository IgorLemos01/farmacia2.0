// ============================================================
//  ORÇAMENTO DE EXAMES (PDF) — gerado na tela de Exames, sem salvar nada.
//  A4 em pé: dados da farmácia, cliente (se escolhido), lista de exames com
//  valores, total, validade e quem emitiu (usuário logado).
// ============================================================

import { EMPRESA, formatarDataBR } from './pdf.js';

/** Dados públicos da farmácia (os mesmos do rodapé do site). */
export const DADOS_FARMACIA = {
  cnpj: '53.835.152/0001-70',
  endereco: 'Dt. Jorrinho s/n, Tucano — BA, CEP 48790-000',
  whatsapp: '(75) 99115-4571',
};
/** Por quantos dias o orçamento vale. */
export const VALIDADE_DIAS = 7;

const moeda = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(a, m - 1, d + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function nomeArquivoOrcamento(cliente, data) {
  const nome = String(cliente?.nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cliente';
  return `orcamento-exames-${nome}-${data}.pdf`;
}

/**
 * @param {Function} JsPDF
 * @param {object} p
 * @param {{nome:string, valor:number}[]} p.itens   Exames e valores.
 * @param {object} [p.cliente]  Cliente escolhido (nome, telefone) — opcional.
 * @param {string} p.data       Data do orçamento (AAAA-MM-DD).
 * @param {object} [p.usuario]  Quem emitiu (nome, cargo, registro_profissional).
 */
export function montarPdfOrcamento(JsPDF, { itens, cliente = null, data, usuario = null }) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const L = 210, M = 18, LARG = L - 2 * M;
  const total = itens.reduce((t, i) => t + (Number(i.valor) || 0), 0);
  doc.setProperties({ title: `Orçamento de exames — ${cliente?.nome || 'cliente'}`, subject: EMPRESA, creator: EMPRESA });

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
  doc.text('ORÇAMENTO DE EXAMES', M, y);
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

  // Tabela de exames
  y += 9;
  doc.setFillColor(237, 242, 252);
  doc.rect(M, y, LARG, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('#', M + 3, y + 5.4);
  doc.text('Exame', M + 12, y + 5.4);
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
  doc.text(`${itens.length} exame(s)`, M, y + 6.8);

  y += 20;
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

export async function baixarPdfOrcamento(dados) {
  const { jsPDF } = await import('jspdf');
  const doc = montarPdfOrcamento(jsPDF, dados);
  const arquivo = nomeArquivoOrcamento(dados.cliente, dados.data);
  doc.save(arquivo);
  return arquivo;
}
