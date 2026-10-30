// ============================================================
//  PDF DA RECEITA — ficha de dispensação (padrão da Farmácia Couto)
//
//  A biblioteca jsPDF só é baixada quando alguém pede o PDF, para não
//  pesar no carregamento normal do sistema.
// ============================================================

export const EMPRESA = 'FARMÁCIA COUTO LTDA';
export const FARMACEUTICO = 'LEANDRO COUTO';
export const AVISO_LEGAL =
  'CIENTE QUE DE ACORDO COM A PORTARIA 344/98 E RDC Nº 20/2011 NÃO É PERMITIDO A TROCA OU DEVOLUÇÃO DE MEDICAMENTO CONTROLADO/ ANTIBIÓTICO.';

/** A ficha impressa tem espaço para 3 medicamentos; com menos, as linhas ficam em branco para preencher à mão. */
const BLOCOS_MINIMOS = 3;

// A4 em milímetros
const MARGEM = 15;
const LARGURA = 180;
const ALTURA_TITULO = 9;
const ALTURA_LINHA = 7.5;
const ALTURA_ASSINATURA = 11;

const doisDigitos = n => String(n).padStart(2, '0');

/** '2026-10-30' → '30/10/2026' (ou '30/10/26' com `anoCurto`). */
export function formatarDataBR(iso, { anoCurto = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  return `${m[3]}/${m[2]}/${anoCurto ? m[1].slice(2) : m[1]}`;
}

/** Nome de arquivo seguro: receita-maria-souza-2026-10-30.pdf */
export function nomeArquivoReceita(receita, paciente) {
  const nome = String(paciente?.nome || receita?.cliente_nome || 'paciente')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'paciente';
  return `receita-${nome}-${String(receita?.data_venda || '').slice(0, 10) || 'sem-data'}.pdf`;
}

/** Reduz a fonte até o texto caber na largura; se ainda não couber, corta com "…". */
function ajustarTexto(doc, texto, larguraMax, tamanho = 9.5, minimo = 6) {
  let t = String(texto ?? '');
  doc.setFontSize(tamanho);
  while (doc.getTextWidth(t) > larguraMax && doc.getFontSize() > minimo) {
    doc.setFontSize(doc.getFontSize() - 0.5);
  }
  if (doc.getTextWidth(t) > larguraMax) {
    while (t.length > 1 && doc.getTextWidth(t + '…') > larguraMax) t = t.slice(0, -1);
    t += '…';
  }
  return t;
}

/**
 * Desenha uma linha da tabela dividida em células. Cada célula tem um rótulo em negrito
 * seguido do valor. `largura` é a fração da linha (as frações somam 1).
 */
function desenharLinha(doc, y, altura, celulas) {
  let x = MARGEM;
  for (const { largura, rotulo, valor = '', negritoValor = false } of celulas) {
    const w = LARGURA * largura;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, altura);

    const yTexto = y + altura / 2 + 1.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(rotulo, x + 1.8, yTexto);
    const larguraRotulo = doc.getTextWidth(rotulo) + 1.6; // rótulo + respiro antes do valor

    if (valor) {
      doc.setFont('helvetica', negritoValor ? 'bold' : 'normal');
      const texto = ajustarTexto(doc, valor, w - larguraRotulo - 3.6);
      doc.text(texto, x + 1.8 + larguraRotulo, yTexto);
    }
    x += w;
  }
  return y + altura;
}

/**
 * Monta o PDF da receita no padrão da ficha da farmácia.
 *
 * @param {Function} JsPDF  Construtor do jsPDF (injetado para facilitar os testes).
 * @param {object} receita  Receita com `itens`, `data_venda` etc.
 * @param {object} paciente Dados do cliente: nome, rg, cpf, data_nascimento, telefone.
 */
export function montarPdfReceita(JsPDF, receita, paciente = {}) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const nome = paciente.nome || receita.cliente_nome || '';
  doc.setProperties({ title: `Receita — ${nome}`, subject: EMPRESA, creator: EMPRESA });

  let y = MARGEM;

  // Título
  doc.setLineWidth(0.3);
  doc.rect(MARGEM, y, LARGURA, ALTURA_TITULO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text(EMPRESA, MARGEM + LARGURA / 2, y + ALTURA_TITULO / 2 + 1.7, { align: 'center' });
  y += ALTURA_TITULO;

  // Paciente
  y = desenharLinha(doc, y, ALTURA_LINHA, [{ largura: 1, rotulo: 'NOME COMPLETO:', valor: nome }]);
  y = desenharLinha(doc, y, ALTURA_LINHA, [
    { largura: 0.28, rotulo: 'RG:', valor: paciente.rg || '' },
    { largura: 0.38, rotulo: 'CPF:', valor: paciente.cpf || '' },
    { largura: 0.34, rotulo: 'DATA NASC.:', valor: formatarDataBR(paciente.data_nascimento) },
  ]);
  y = desenharLinha(doc, y, ALTURA_LINHA, [{ largura: 1, rotulo: 'CONTATO:', valor: paciente.telefone || '' }]);

  // Medicamentos (no mínimo 3 blocos, como na ficha impressa)
  const itens = receita.itens || [];
  const blocos = Math.max(BLOCOS_MINIMOS, itens.length);
  for (let i = 0; i < blocos; i++) {
    const item = itens[i] || {};
    y = desenharLinha(doc, y, ALTURA_LINHA, [
      { largura: 0.72, rotulo: 'MEDICAMENTO:', valor: item.medicamento || '' },
      { largura: 0.28, rotulo: 'RMS:', valor: item.rms || '' },
    ]);
    y = desenharLinha(doc, y, ALTURA_LINHA, [
      { largura: 0.17, rotulo: 'LOTE:', valor: item.lote || '' },
      { largura: 0.19, rotulo: 'VALIDADE:', valor: item.validade || '' },
      { largura: 0.46, rotulo: 'LABORATÓRIO:', valor: item.laboratorio || '' },
      { largura: 0.18, rotulo: 'QUANT.:', valor: item.quantidade != null ? String(item.quantidade) : '' },
    ]);
  }

  // Farmacêutico, data e assinatura
  y = desenharLinha(doc, y, ALTURA_LINHA, [
    { largura: 0.78, rotulo: 'FARMACÊUTICO:', valor: FARMACEUTICO, negritoValor: true },
    { largura: 0.22, rotulo: 'DATA:', valor: formatarDataBR(receita.data_venda, { anoCurto: true }) },
  ]);
  y = desenharLinha(doc, y, ALTURA_ASSINATURA, [{ largura: 1, rotulo: 'ASS:' }]);

  // Aviso legal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const linhasAviso = doc.splitTextToSize(AVISO_LEGAL, LARGURA - 4);
  const alturaAviso = linhasAviso.length * 4.2 + 3.5;
  doc.rect(MARGEM, y, LARGURA, alturaAviso);
  doc.text(linhasAviso, MARGEM + 2, y + 5);

  return doc;
}

/** Gera o PDF da receita e inicia o download no navegador. Devolve o nome do arquivo. */
export async function baixarPdfReceita(receita, paciente) {
  const { jsPDF } = await import('jspdf');
  const doc = montarPdfReceita(jsPDF, receita, paciente);
  const arquivo = nomeArquivoReceita(receita, paciente);
  doc.save(arquivo);
  return arquivo;
}
