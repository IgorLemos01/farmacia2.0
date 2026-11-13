// ============================================================
//  PDF DA RECEITA — ficha de dispensação (padrão da Farmácia Couto)
//
//  Formato compacto de balcão: FOLHA DE CHEQUE (175 × 80 mm, paisagem).
//  - Só os medicamentos lançados aparecem: nada de blocos em branco.
//  - Até 3 medicamentos por folha; receitas maiores geram mais folhas,
//    cada uma com o cabeçalho e os dados do paciente.
//  - O farmacêutico responsável vem da receita (cadastro do usuário), nunca do código.
//
//  A biblioteca jsPDF só é baixada quando alguém pede o PDF/impressão.
// ============================================================

export const EMPRESA = 'FARMÁCIA COUTO LTDA';
export const AVISO_LEGAL =
  'CIENTE QUE DE ACORDO COM A PORTARIA 344/98 E RDC Nº 20/2011 NÃO É PERMITIDO A TROCA OU DEVOLUÇÃO DE MEDICAMENTO CONTROLADO/ ANTIBIÓTICO.';

/** Tamanho da folha (mm): padrão de folha de cheque. */
export const FOLHA = { largura: 175, altura: 80 };
/** Medicamentos por folha (o que cabe na folha de cheque mantendo a leitura confortável). */
export const MEDICAMENTOS_POR_FOLHA = 3;

const MARGEM = 4;
const LARGURA = FOLHA.largura - MARGEM * 2;
const ALTURA_TITULO = 6;
const ALTURA_LINHA = 5;
const ALTURA_ASSINATURA = 7;
const FONTE_ROTULO = 6.5;
const FONTE_VALOR = 7;

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

/** "ANA SOUZA (Farmacêutica Responsável) — CRF-SE 1234", ou '' sem farmacêutico. */
export function textoFarmaceutico(farmaceutico) {
  if (!farmaceutico?.nome) return '';
  let texto = farmaceutico.nome.toUpperCase();
  if (farmaceutico.cargo) texto += ` (${farmaceutico.cargo})`;
  if (farmaceutico.registro_profissional) texto += ` — ${farmaceutico.registro_profissional}`;
  return texto;
}

/** Reduz a fonte até o texto caber na largura; se ainda não couber, corta com "…". */
function ajustarTexto(doc, texto, larguraMax, tamanho = FONTE_VALOR, minimo = 5) {
  let t = String(texto ?? '');
  doc.setFontSize(tamanho);
  while (doc.getTextWidth(t) > larguraMax && doc.getFontSize() > minimo) {
    doc.setFontSize(doc.getFontSize() - 0.25);
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
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, altura);

    const yTexto = y + altura / 2 + 0.9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTE_ROTULO);
    doc.text(rotulo, x + 1.2, yTexto);
    const larguraRotulo = doc.getTextWidth(rotulo) + 1; // rótulo + respiro antes do valor

    if (valor) {
      doc.setFont('helvetica', negritoValor ? 'bold' : 'normal');
      const texto = ajustarTexto(doc, valor, w - larguraRotulo - 2.4);
      doc.text(texto, x + 1.2 + larguraRotulo, yTexto);
    }
    x += w;
  }
  return y + altura;
}

/** Divide os itens em folhas de até MEDICAMENTOS_POR_FOLHA (sempre ao menos uma folha). */
export function dividirEmFolhas(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  if (!lista.length) return [[]];
  const folhas = [];
  for (let i = 0; i < lista.length; i += MEDICAMENTOS_POR_FOLHA) folhas.push(lista.slice(i, i + MEDICAMENTOS_POR_FOLHA));
  return folhas;
}

/**
 * Monta o PDF da receita no padrão da ficha da farmácia, em folha de cheque.
 *
 * @param {Function} JsPDF  Construtor do jsPDF (injetado para facilitar os testes).
 * @param {object} receita  Receita com `itens`, `data_venda`, `farmaceutico` etc.
 * @param {object} paciente Dados do cliente: nome, rg, cpf, data_nascimento, telefone.
 */
export function montarPdfReceita(JsPDF, receita, paciente = {}) {
  const doc = new JsPDF({ unit: 'mm', format: [FOLHA.largura, FOLHA.altura], orientation: 'landscape' });
  paciente = paciente || {};
  const nome = paciente.nome || receita.cliente_nome || '';
  doc.setProperties({ title: `Receita — ${nome}`, subject: EMPRESA, creator: EMPRESA });

  const folhas = dividirEmFolhas(receita.itens);
  const farmaceutico = textoFarmaceutico(receita.farmaceutico);

  folhas.forEach((itens, indice) => {
    if (indice > 0) doc.addPage([FOLHA.largura, FOLHA.altura], 'landscape');
    let y = MARGEM;

    // Título
    doc.setLineWidth(0.2);
    doc.rect(MARGEM, y, LARGURA, ALTURA_TITULO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(EMPRESA, MARGEM + LARGURA / 2, y + ALTURA_TITULO / 2 + 1.2, { align: 'center' });
    if (folhas.length > 1) {
      doc.setFontSize(FONTE_ROTULO);
      doc.text(`FOLHA ${indice + 1}/${folhas.length}`, MARGEM + LARGURA - 1.5, y + ALTURA_TITULO / 2 + 0.9, { align: 'right' });
    }
    y += ALTURA_TITULO;

    // Paciente
    y = desenharLinha(doc, y, ALTURA_LINHA, [
      { largura: 0.64, rotulo: 'NOME COMPLETO:', valor: nome },
      { largura: 0.36, rotulo: 'CONTATO:', valor: paciente.telefone || '' },
    ]);
    y = desenharLinha(doc, y, ALTURA_LINHA, [
      { largura: 0.3, rotulo: 'RG:', valor: paciente.rg || '' },
      { largura: 0.36, rotulo: 'CPF:', valor: paciente.cpf || '' },
      { largura: 0.34, rotulo: 'DATA NASC.:', valor: formatarDataBR(paciente.data_nascimento) },
    ]);

    // Medicamentos: só os lançados (sem blocos vazios)
    for (const item of itens) {
      y = desenharLinha(doc, y, ALTURA_LINHA, [
        { largura: 0.72, rotulo: 'MEDICAMENTO:', valor: item.medicamento || '', negritoValor: true },
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
      { largura: 0.8, rotulo: 'FARMACÊUTICO:', valor: farmaceutico, negritoValor: true },
      { largura: 0.2, rotulo: 'DATA:', valor: formatarDataBR(receita.data_venda, { anoCurto: true }) },
    ]);
    y = desenharLinha(doc, y, ALTURA_ASSINATURA, [{ largura: 1, rotulo: 'ASS:' }]);

    // Aviso legal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.6);
    const linhasAviso = doc.splitTextToSize(AVISO_LEGAL, LARGURA - 2.4);
    const alturaAviso = linhasAviso.length * 2.4 + 1.6;
    doc.rect(MARGEM, y, LARGURA, alturaAviso);
    doc.text(linhasAviso, MARGEM + 1.2, y + 2.6);
  });

  return doc;
}

async function carregarJsPdf() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

/** Gera o PDF da receita e inicia o download no navegador. Devolve o nome do arquivo. */
export async function baixarPdfReceita(receita, paciente) {
  const doc = montarPdfReceita(await carregarJsPdf(), receita, paciente);
  const arquivo = nomeArquivoReceita(receita, paciente);
  doc.save(arquivo);
  return arquivo;
}

/**
 * Abre a impressão da ficha direto (sem baixar arquivo). O PDF já tem o tamanho de
 * folha de cheque; na janela de impressão, use "Tamanho real" / escala 100%.
 * Se o navegador não conseguir imprimir pelo quadro oculto, baixa o PDF.
 */
export async function imprimirPdfReceita(receita, paciente) {
  const doc = montarPdfReceita(await carregarJsPdf(), receita, paciente);
  const url = URL.createObjectURL(doc.output('blob'));
  const quadro = document.createElement('iframe');
  quadro.className = 'quadro-impressao';
  quadro.title = 'Impressão da receita';
  await new Promise(resolve => {
    let pronto = false;
    const baixar = () => doc.save(nomeArquivoReceita(receita, paciente));
    quadro.onload = () => {
      if (pronto) return;
      pronto = true;
      try {
        quadro.contentWindow.focus();
        quadro.contentWindow.print();
      } catch (_) {
        baixar();
      }
      resolve();
    };
    // navegador que não abre PDF dentro da página: baixa o arquivo para imprimir
    setTimeout(() => { if (!pronto) { pronto = true; baixar(); resolve(); } }, 8000);
    quadro.src = url;
    document.body.appendChild(quadro);
  });
  // limpa depois (a janela de impressão precisa do documento aberto)
  setTimeout(() => { quadro.remove(); URL.revokeObjectURL(url); }, 60000);
}
