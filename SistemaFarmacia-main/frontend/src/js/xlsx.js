// ============================================================
//  PLANILHA EXCEL (.xlsx) — gerador mínimo, sem biblioteca externa
//
//  Um .xlsx é um ZIP com alguns XML dentro. Aqui o ZIP é montado sem compressão
//  (método "store"), o que o Excel, o LibreOffice e o Google Planilhas abrem
//  normalmente. Datas viram datas de verdade e valores viram números com R$.
// ============================================================

const enc = new TextEncoder();

// ── CRC-32 (exigido pelo formato ZIP) ──
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Monta um ZIP sem compressão. `arquivos`: [{ nome, conteudo (string) }]. */
export function montarZip(arquivos, agora = new Date()) {
  const dosHora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
  const dosData = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const partes = [];
  const central = [];
  let deslocamento = 0;

  for (const { nome, conteudo } of arquivos) {
    const nomeBytes = enc.encode(nome);
    const dados = typeof conteudo === 'string' ? enc.encode(conteudo) : conteudo;
    const crc = crc32(dados);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);        // versão necessária
    local.setUint16(6, 0x0800, true);    // nomes em UTF-8
    local.setUint16(8, 0, true);         // sem compressão
    local.setUint16(10, dosHora, true);
    local.setUint16(12, dosData, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nomeBytes.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nomeBytes, dados);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, dosHora, true);
    dir.setUint16(14, dosData, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, dados.length, true);
    dir.setUint32(24, dados.length, true);
    dir.setUint16(28, nomeBytes.length, true);
    dir.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(dir.buffer), nomeBytes);

    deslocamento += 30 + nomeBytes.length + dados.length;
  }

  const tamanhoCentral = central.reduce((t, p) => t + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);

  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const saida = new Uint8Array(todas.reduce((t, p) => t + p.length, 0));
  let pos = 0;
  for (const p of todas) { saida.set(p, pos); pos += p.length; }
  return saida;
}

// ── Planilha ──
const xml = texto => String(texto ?? '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function nomeColuna(indice) {
  let n = indice + 1;
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** '2026-10-30' → número de série de data do Excel (1900). */
export function dataExcel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000;
}

// Estilos: 0 normal · 1 cabeçalho · 2 moeda · 3 data · 4 título · 5 total (rótulo) · 6 total (moeda)
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
  <fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF2FC"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF072162"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function celula(ref, valor, tipo, estiloTexto = 0) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (tipo === 'moeda' || tipo === 'numero') {
    const n = Number(valor);
    if (!Number.isFinite(n)) return '';
    return `<c r="${ref}"${tipo === 'moeda' ? ' s="2"' : ''}><v>${n}</v></c>`;
  }
  if (tipo === 'data') {
    const serie = dataExcel(valor);
    if (serie !== null) return `<c r="${ref}" s="3"><v>${serie}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${estiloTexto ? ` s="${estiloTexto}"` : ''}><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
}

/**
 * Gera o arquivo .xlsx (bytes).
 *
 * @param {object} p
 * @param {string} p.aba        Nome da aba (até 31 caracteres).
 * @param {string} p.titulo     Título na primeira linha.
 * @param {string[]} [p.subtitulos] Linhas abaixo do título (período, emissor...).
 * @param {{titulo:string, tipo?:'texto'|'moeda'|'data'|'numero', largura?:number}[]} p.colunas
 * @param {any[][]} p.linhas
 * @param {any[]} [p.total]     Linha de total (mesma ordem das colunas).
 */
export function gerarXlsx({ aba, titulo, subtitulos = [], colunas, linhas, total = null }) {
  const nomeAba = String(aba || 'Planilha').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  const rows = [];
  let r = 1;
  rows.push(`<row r="${r}">${celula(`A${r}`, titulo, 'texto', 4)}</row>`);
  r++;
  for (const sub of subtitulos) { rows.push(`<row r="${r}">${celula(`A${r}`, sub, 'texto')}</row>`); r++; }
  r++; // linha em branco
  const linhaCabecalho = r;
  rows.push(`<row r="${r}">${colunas.map((c, i) => celula(`${nomeColuna(i)}${r}`, c.titulo, 'texto', 1)).join('')}</row>`);
  r++;
  for (const linha of linhas) {
    rows.push(`<row r="${r}">${colunas.map((c, i) => celula(`${nomeColuna(i)}${r}`, linha[i], c.tipo || 'texto')).join('')}</row>`);
    r++;
  }
  if (total) {
    rows.push(`<row r="${r}">${colunas.map((c, i) => {
      const ref = `${nomeColuna(i)}${r}`;
      const v = total[i];
      if (v === null || v === undefined || v === '') return '';
      return c.tipo === 'moeda' ? `<c r="${ref}" s="6"><v>${Number(v)}</v></c>` : celula(ref, v, c.tipo === 'numero' ? 'numero' : 'texto', 5);
    }).join('')}</row>`);
  }

  const larguras = colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura || 18}" customWidth="1"/>`).join('');
  const planilha = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="${linhaCabecalho}" topLeftCell="A${linhaCabecalho + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${larguras}</cols>
  <sheetData>${rows.join('')}</sheetData>
  ${linhas.length ? `<autoFilter ref="A${linhaCabecalho}:${nomeColuna(colunas.length - 1)}${linhaCabecalho + linhas.length}"/>` : ''}
</worksheet>`;

  return montarZip([
    { nome: '[Content_Types].xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>` },
    { nome: '_rels/.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { nome: 'xl/workbook.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xml(nomeAba)}" sheetId="1" r:id="rId1"/></sheets>
  ${linhas.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(nomeAba).replace(/'/g, "''")}'!$A$${linhaCabecalho}:$${nomeColuna(colunas.length - 1)}$${linhaCabecalho + linhas.length}</definedName></definedNames>` : ''}
</workbook>` },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { nome: 'xl/styles.xml', conteudo: ESTILOS },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: planilha },
  ]);
}

/** Inicia o download de bytes no navegador. */
export function baixarArquivo(bytes, nome, tipo) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
