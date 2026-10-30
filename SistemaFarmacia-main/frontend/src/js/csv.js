// ============================================================
//  LEITURA DE CSV DE EXAMES (nome + valor) — roda no navegador
// ============================================================

const semAcentoMinusculo = texto =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Converte um valor em reais escrito como na planilha: "13", "13,5", "1.250,00", "R$ 13,00", "12.5".
 * Devolve `null` se não for um número não negativo.
 */
export function parseValorBR(texto) {
  let t = String(texto ?? '').replace(/R\$/gi, '').replace(/\s/g, '');
  if (!t) return null;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); // 1.250 · 1.250,50
  else if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); //                  13,5 · 1250,5
  // senão: ponto decimal comum (12.5)

  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const numero = Number(t);
  return Number.isFinite(numero) ? numero : null;
}

/** Divide o texto em linhas e campos, respeitando aspas ("Ex, com vírgula") e quebras CRLF/LF. */
function tokenizar(texto, delimitador) {
  const linhas = [];
  let linha = [];
  let campo = '';
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else entreAspas = false;
      } else campo += c;
    } else if (c === '"' && campo === '') {
      entreAspas = true;
    } else if (c === delimitador) {
      linha.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

function detectarDelimitador(texto) {
  const primeira = texto.split(/\r?\n/).find(l => l.trim()) || '';
  if (primeira.includes(';')) return ';';
  if (primeira.includes('\t')) return '\t';
  return ',';
}

/**
 * Lê o CSV (exportado do Excel/Google Planilhas) e separa o que dá para importar.
 *
 * - Aceita separador `;`, `,` ou tabulação e com ou sem linha de título.
 * - Com título, procura as colunas pelo nome: "Exame"/"Nome" e "Valor…" (se houver várias
 *   colunas de valor, prefere a que tiver "aproximado" no nome).
 * - Sem título, usa a 1ª coluna como nome e a 2ª como valor.
 *
 * @returns {{ itens: {linha:number, nome:string, valor:number}[],
 *             erros: {linha:number, nome:string, motivo:string}[] }}
 */
export function lerCsvExames(textoBruto) {
  const texto = String(textoBruto ?? '').replace(/^﻿/, '');
  const linhas = tokenizar(texto, detectarDelimitador(texto));

  let colNome = 0;
  let colValor = 1;
  let inicio = 0;

  const cabecalho = (linhas[0] || []).map(semAcentoMinusculo);
  const ixNome = cabecalho.findIndex(c => /^(exames?|nome)\b/.test(c));
  const ixValores = cabecalho.map((c, i) => (/valor|preco/.test(c) ? i : -1)).filter(i => i >= 0);
  if (ixNome >= 0 || (ixValores.length && parseValorBR(linhas[0][ixValores[0]]) === null)) {
    inicio = 1;
    if (ixNome >= 0) colNome = ixNome;
    if (ixValores.length) colValor = ixValores.find(i => /aproxim/.test(cabecalho[i])) ?? ixValores[0];
  }

  const itens = [];
  const erros = [];
  for (let i = inicio; i < linhas.length; i++) {
    const celulas = linhas[i];
    if (celulas.every(c => !String(c).trim())) continue; // linha em branco
    const linha = i + 1;
    const nome = String(celulas[colNome] ?? '').replace(/\s+/g, ' ').trim();
    const valor = parseValorBR(celulas[colValor]);

    if (!nome) erros.push({ linha, nome: '', motivo: 'Sem nome de exame.' });
    else if (valor === null) {
      const bruto = String(celulas[colValor] ?? '').trim();
      erros.push({ linha, nome, motivo: bruto ? `Valor inválido: "${bruto}".` : 'Sem valor.' });
    } else itens.push({ linha, nome, valor });
  }
  return { itens, erros };
}

/**
 * Lê um arquivo de texto escolhendo a codificação certa: planilhas salvas no Excel
 * do Windows costumam vir em Windows-1252 e ficariam com acentos quebrados em UTF-8.
 */
export async function lerArquivoTexto(arquivo) {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (_) {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
