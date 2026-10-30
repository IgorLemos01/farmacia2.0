import { describe, expect, it } from 'vitest';
import { AVISO_LEGAL, formatarDataBR, montarPdfReceita, nomeArquivoReceita } from '../src/js/pdf.js';

const paciente = { nome: 'Igor Lemos', rg: '36452718', cpf: '123.456.789-00', data_nascimento: '1999-10-01', telefone: '(79) 98845-3518' };
const item = (n, extra = {}) => ({
  medicamento: `MEDICAMENTO ${n} 10 MG`, rms: `10235066300${String(n).padStart(2, '0')}`, laboratorio: 'EMS INDUSTRIA FARMACEUTICA LTDA',
  lote: `L${n}`, validade: '02/2027', quantidade: n, ...extra,
});

async function gerar(receita, dados = paciente) {
  const { jsPDF } = await import('jspdf');
  const doc = montarPdfReceita(jsPDF, receita, dados);
  // dentro do PDF os parênteses do texto aparecem com barra (\\( \\)); remove para comparar com o texto original
  return { doc, texto: doc.output().replace(/\\([()])/g, '$1') };
}

describe('formatarDataBR', () => {
  it('converte AAAA-MM-DD', () => {
    expect(formatarDataBR('2026-10-30')).toBe('30/10/2026');
    expect(formatarDataBR('2026-10-30', { anoCurto: true })).toBe('30/10/26');
    expect(formatarDataBR('2026-10-30T12:00:00')).toBe('30/10/2026');
  });
  it('devolve vazio para valores inválidos', () => {
    for (const v of [null, undefined, '', 'abc', '30/10/2026']) expect(formatarDataBR(v)).toBe('');
  });
});

describe('nomeArquivoReceita', () => {
  it('usa o nome do paciente sem acentos nem caracteres especiais', () => {
    expect(nomeArquivoReceita({ data_venda: '2026-10-30' }, { nome: 'José D\'Ávila / Jr.' })).toBe('receita-jose-d-avila-jr-2026-10-30.pdf');
  });
  it('cai para o nome da receita e para valores padrão', () => {
    expect(nomeArquivoReceita({ cliente_nome: 'Ana Souza', data_venda: '2026-01-02' }, null)).toBe('receita-ana-souza-2026-01-02.pdf');
    expect(nomeArquivoReceita({}, {})).toBe('receita-paciente-sem-data.pdf');
  });
});

describe('montarPdfReceita', () => {
  it('traz os campos da ficha da farmácia, com os dados do paciente e do medicamento', async () => {
    const { texto } = await gerar({ data_venda: '2026-10-30', itens: [item(1, { medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '1023506630034', lote: '4Q6312' })] });
    for (const esperado of [
      'FARM', 'COUTO LTDA', 'NOME COMPLETO:', 'Igor Lemos', 'RG:', '36452718', 'CPF:', '123.456.789-00',
      'DATA NASC.:', '01/10/1999', 'CONTATO:', '(79) 98845-3518', 'MEDICAMENTO:', 'ALPRAZOLAM 0,25 MG 30 CPRS',
      'RMS:', '1023506630034', 'LOTE:', '4Q6312', 'VALIDADE:', '02/2027', 'QUANT.:', 'LEANDRO COUTO', 'DATA:', '30/10/26', 'ASS:',
      'PORTARIA 344/98 E RDC',
    ]) expect(texto, esperado).toContain(esperado);
  });

  it('mantém 3 blocos de medicamento (linhas em branco para preencher à mão) mesmo com 1 item', async () => {
    const { texto } = await gerar({ data_venda: '2026-10-30', itens: [item(1)] });
    expect(texto.match(/\(MEDICAMENTO:\)/g)).toHaveLength(3);
    expect(texto.match(/\(LABORAT.RIO:\)/g)).toHaveLength(3);
  });

  it('com mais itens, cria um bloco para cada um e cabe em uma página (até 12)', async () => {
    const itens = Array.from({ length: 12 }, (_, i) => item(i + 1));
    const { doc, texto } = await gerar({ data_venda: '2026-10-30', itens });
    expect(texto.match(/\(MEDICAMENTO:\)/g)).toHaveLength(12);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(texto).toContain('MEDICAMENTO 12 10 MG');
  });

  it('não corta o laboratório nem o nome do medicamento mais longos da planilha real', async () => {
    const { texto } = await gerar({ data_venda: '2026-10-30', itens: [item(1, {
      medicamento: 'KOLLAGENASE COM CLORANFENICOL 0,6U/G POMADA DERMATOLOGICA',
      laboratorio: 'MULTILAB IND.E COM. DE PROD. FARMAC.LTDA',
    })] });
    expect(texto).toContain('KOLLAGENASE COM CLORANFENICOL 0,6U/G POMADA DERMATOLOGICA');
    expect(texto).toContain('MULTILAB IND.E COM. DE PROD. FARMAC.LTDA');
    expect(texto).not.toContain('…');
  });

  it('funciona sem dados opcionais (sem RG, CPF, lote, quantidade)', async () => {
    const { texto } = await gerar({ data_venda: '2026-10-30', cliente_nome: 'Só Nome', itens: [{ medicamento: 'X 1 MG', rms: '', laboratorio: null }] }, { nome: 'Só Nome' });
    expect(texto).toContain('Só Nome');
    expect(texto).toContain('X 1 MG');
  });

  it('o aviso legal é o texto oficial', () => {
    expect(AVISO_LEGAL).toBe('CIENTE QUE DE ACORDO COM A PORTARIA 344/98 E RDC Nº 20/2011 NÃO É PERMITIDO A TROCA OU DEVOLUÇÃO DE MEDICAMENTO CONTROLADO/ ANTIBIÓTICO.');
  });
});
