// ============================================================
//  PDF DA RECEITA — ficha de dispensação (padrão da Farmácia Couto)
//
//  Formato compacto de balcão: folha de cheque em RETRATO (80 × 175 mm, em pé).
//  - Só os medicamentos lançados aparecem: nada de blocos ou linhas em branco.
//  - Até 4 medicamentos por folha; receitas maiores geram mais folhas,
//    cada uma com o cabeçalho e os dados do paciente.
//  - Nomes longos (medicamento, laboratório, farmacêutico) quebram em até 2 linhas
//    em vez de serem cortados.
//  - O farmacêutico responsável vem da receita (cadastro do usuário), nunca do código.
//
//  A biblioteca jsPDF só é baixada quando alguém pede o PDF/impressão.
// ============================================================

export const EMPRESA = 'FARMÁCIA COUTO LTDA';
export const AVISO_LEGAL =
  'CIENTE QUE DE ACORDO COM A PORTARIA 344/98 E RDC Nº 20/2011 NÃO É PERMITIDO A TROCA OU DEVOLUÇÃO DE MEDICAMENTO CONTROLADO/ ANTIBIÓTICO.';

/** Tamanho da folha (mm): folha de cheque em pé (retrato). */
export const FOLHA = { largura: 80, altura: 175, orientacao: 'portrait' };
/** Medicamentos por folha (cabem com folga mesmo com nomes longos em 2 linhas). */
export const MEDICAMENTOS_POR_FOLHA = 4;

const MARGEM = 4;
const LARGURA = FOLHA.largura - MARGEM * 2;
const ALTURA_TITULO = 7;
const ALTURA_LINHA = 5;
const ALTURA_ASSINATURA = 9;
const FONTE_ROTULO = 6.3;
const FONTE_VALOR = 7;
const FONTE_MINIMA = 5.5;
const ENTRELINHA = 2.7;

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

/**
 * Cabe o texto na largura: tenta em 1 linha (reduzindo um pouco a fonte); se não der,
 * quebra em até `maxLinhas`; se ainda sobrar, reduz a fonte até o mínimo e, por fim, corta com "…".
 * Devolve { linhas, tamanho }.
 */
function encaixarTexto(doc, texto, larguraMax, maxLinhas = 1) {
  const t = String(texto ?? '');
  for (let tamanho = FONTE_VALOR; tamanho >= FONTE_VALOR - 0.5; tamanho -= 0.25) {
    doc.setFontSize(tamanho);
    if (doc.getTextWidth(t) <= larguraMax) return { linhas: [t], tamanho };
  }
  for (let tamanho = FONTE_VALOR; tamanho >= FONTE_MINIMA; tamanho -= 0.25) {
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(t, larguraMax);
    if (linhas.length <= maxLinhas) return { linhas, tamanho };
  }
  doc.setFontSize(FONTE_MINIMA);
  const linhas = doc.splitTextToSize(t, larguraMax).slice(0, maxLinhas);
  let ultima = linhas[linhas.length - 1];
  while (ultima.length > 1 && doc.getTextWidth(ultima + '…') > larguraMax) ultima = ultima.slice(0, -1);
  linhas[linhas.length - 1] = ultima + '…';
  return { linhas, tamanho: FONTE_MINIMA };
}

/**
 * Desenha uma linha da tabela dividida em células. Cada célula tem um rótulo em negrito
 * seguido do valor. `largura` é a fração da linha (as frações somam 1). Célula com
 * `quebrar: true` pode ocupar 2 linhas de texto; a altura da linha acompanha.
 */
function desenharLinha(doc, y, celulas, alturaMinima = ALTURA_LINHA) {
  // 1º passo: mede cada célula
  let x = MARGEM;
  const medidas = celulas.map(c => {
    const w = LARGURA * c.largura;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTE_ROTULO);
    const larguraRotulo = doc.getTextWidth(c.rotulo) + 1;
    let texto = null;
    if (c.valor) {
      doc.setFont('helvetica', c.negritoValor ? 'bold' : 'normal');
      texto = encaixarTexto(doc, c.valor, w - larguraRotulo - 2.2, c.quebrar ? 2 : 1);
    }
    const medida = { ...c, x, w, larguraRotulo, texto };
    x += w;
    return medida;
  });
  const linhasMax = Math.max(1, ...medidas.map(m => (m.texto ? m.texto.linhas.length : 1)));
  const altura = Math.max(alturaMinima, ALTURA_LINHA + (linhasMax - 1) * ENTRELINHA);

  // 2º passo: desenha
  for (const m of medidas) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(m.x, y, m.w, altura);
    const yTexto = y + 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTE_ROTULO);
    doc.text(m.rotulo, m.x + 1.1, yTexto);
    if (m.texto) {
      doc.setFont('helvetica', m.negritoValor ? 'bold' : 'normal');
      doc.setFontSize(m.texto.tamanho);
      m.texto.linhas.forEach((linha, i) => doc.text(linha, m.x + 1.1 + m.larguraRotulo, yTexto + i * ENTRELINHA));
    }
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
 * Monta o PDF da receita no padrão da ficha da farmácia, em folha de cheque em pé.
 *
 * @param {Function} JsPDF  Construtor do jsPDF (injetado para facilitar os testes).
 * @param {object} receita  Receita com `itens`, `data_venda`, `farmaceutico` etc.
 * @param {object} paciente Dados do cliente: nome, rg, cpf, data_nascimento, telefone.
 */
export function montarPdfReceita(JsPDF, receita, paciente = {}) {
  const formato = [FOLHA.largura, FOLHA.altura];
  const doc = new JsPDF({ unit: 'mm', format: formato, orientation: FOLHA.orientacao });
  paciente = paciente || {};
  const nome = paciente.nome || receita.cliente_nome || '';
  doc.setProperties({ title: `Receita — ${nome}`, subject: EMPRESA, creator: EMPRESA });

  const folhas = dividirEmFolhas(receita.itens);
  const farmaceutico = textoFarmaceutico(receita.farmaceutico);

  folhas.forEach((itens, indice) => {
    if (indice > 0) doc.addPage(formato, FOLHA.orientacao);
    let y = MARGEM;

    // Título
    doc.setLineWidth(0.2);
    doc.rect(MARGEM, y, LARGURA, ALTURA_TITULO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(EMPRESA, MARGEM + LARGURA / 2, y + ALTURA_TITULO / 2 + 1.2, { align: 'center' });
    y += ALTURA_TITULO;
    if (folhas.length > 1) {
      doc.setFontSize(FONTE_ROTULO);
      doc.text(`FOLHA ${indice + 1}/${folhas.length}`, MARGEM + LARGURA, y + 2.6, { align: 'right' });
      y += 3.6;
    }

    // Paciente (só os campos preenchidos)
    y = desenharLinha(doc, y, [{ largura: 1, rotulo: 'NOME:', valor: nome, quebrar: true }]);
    const contato = paciente.telefone || '';
    const nascimento = formatarDataBR(paciente.data_nascimento);
    const linhaContato = [
      contato && { rotulo: 'CONTATO:', valor: contato },
      nascimento && { rotulo: 'NASC.:', valor: nascimento },
    ].filter(Boolean);
    const linhaDocs = [
      paciente.rg && { rotulo: 'RG:', valor: paciente.rg },
      paciente.cpf && { rotulo: 'CPF:', valor: paciente.cpf },
    ].filter(Boolean);
    for (const linha of [linhaContato, linhaDocs]) {
      if (linha.length === 2) {
        linha[0].largura = 0.52;
        linha[1].largura = 0.48;
        y = desenharLinha(doc, y, linha);
      } else if (linha.length === 1) {
        y = desenharLinha(doc, y, [{ ...linha[0], largura: 1 }]);
      }
    }

    // Medicamentos: só os lançados, e em cada um só os campos preenchidos
    for (const item of itens) {
      y += 1.2; // respiro entre o paciente e cada medicamento
      y = desenharLinha(doc, y, [{ largura: 1, rotulo: 'MEDICAMENTO:', valor: item.medicamento || '', negritoValor: true, quebrar: true }]);
      const rmsQuant = [
        item.rms && { rotulo: 'RMS:', valor: item.rms },
        item.quantidade != null && item.quantidade !== '' && { rotulo: 'QUANT.:', valor: String(item.quantidade) },
      ].filter(Boolean);
      const loteValidade = [
        item.lote && { rotulo: 'LOTE:', valor: item.lote },
        item.validade && { rotulo: 'VALIDADE:', valor: item.validade },
      ].filter(Boolean);
      if (rmsQuant.length === 2) y = desenharLinha(doc, y, [{ ...rmsQuant[0], largura: 0.66 }, { ...rmsQuant[1], largura: 0.34 }]);
      else if (rmsQuant.length === 1) y = desenharLinha(doc, y, [{ ...rmsQuant[0], largura: 1 }]);
      if (loteValidade.length === 2) y = desenharLinha(doc, y, [{ ...loteValidade[0], largura: 0.46 }, { ...loteValidade[1], largura: 0.54 }]);
      else if (loteValidade.length === 1) y = desenharLinha(doc, y, [{ ...loteValidade[0], largura: 1 }]);
      if (item.laboratorio) y = desenharLinha(doc, y, [{ largura: 1, rotulo: 'LABORATÓRIO:', valor: item.laboratorio, quebrar: true }]);
    }

    // Farmacêutico, data e assinatura (farmacêutico em branco = assinar à mão)
    y += 1.2;
    y = desenharLinha(doc, y, [{ largura: 1, rotulo: 'FARMACÊUTICO:', valor: farmaceutico, negritoValor: true, quebrar: true }]);
    y = desenharLinha(doc, y, [{ largura: 1, rotulo: 'DATA:', valor: formatarDataBR(receita.data_venda) }]);
    y = desenharLinha(doc, y, [{ largura: 1, rotulo: 'ASS:' }], ALTURA_ASSINATURA);

    // Aviso legal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.6);
    const linhasAviso = doc.splitTextToSize(AVISO_LEGAL, LARGURA - 2.2);
    const alturaAviso = linhasAviso.length * 2.4 + 1.6;
    doc.rect(MARGEM, y, LARGURA, alturaAviso);
    doc.text(linhasAviso, MARGEM + 1.1, y + 2.6);
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
