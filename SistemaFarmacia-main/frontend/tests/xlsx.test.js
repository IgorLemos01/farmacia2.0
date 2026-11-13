import { describe, expect, it } from 'vitest';
import { crc32, dataExcel, gerarXlsx, montarZip } from '../src/js/xlsx.js';

const texto = bytes => new TextDecoder().decode(bytes);

describe('ZIP e planilha', () => {
  it('CRC-32 confere com o valor de referência', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('o ZIP tem os cabeçalhos e o diretório central', () => {
    const zip = montarZip([{ nome: 'a.txt', conteudo: 'olá' }]);
    const dv = new DataView(zip.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(dv.getUint16(zip.length - 22 + 10, true)).toBe(1);
    expect(texto(zip)).toContain('olá');
  });

  it('datas viram número de série do Excel', () => {
    expect(dataExcel('1900-03-01')).toBe(61);
    expect(dataExcel('2026-10-30')).toBe(46325);
    expect(dataExcel('30/10/2026')).toBeNull();
  });

  it('gera a planilha com cabeçalhos, números, datas, total e texto escapado', () => {
    const bytes = gerarXlsx({
      aba: 'Exames', titulo: 'Relatório', subtitulos: ['Período: X'],
      colunas: [{ titulo: 'Data', tipo: 'data' }, { titulo: 'Cliente' }, { titulo: 'Valor', tipo: 'moeda' }],
      linhas: [['2026-10-30', 'Ana <&> "B"', 12.5], ['2026-10-31', null, 7]],
      total: ['TOTAL', null, 19.5],
    });
    const conteudo = texto(bytes);
    for (const parte of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml', '_rels/.rels']) {
      expect(conteudo).toContain(parte);
    }
    expect(conteudo).toContain('<sheet name="Exames"');
    expect(conteudo).toContain('Ana &lt;&amp;&gt; &quot;B&quot;');
    expect(conteudo).toContain('<v>46325</v>');
    expect(conteudo).toContain('<c r="C5" s="2"><v>12.5</v></c>');
    expect(conteudo).toContain('<c r="C7" s="6"><v>19.5</v></c>');
    expect(conteudo).toContain('state="frozen"');
  });
});
