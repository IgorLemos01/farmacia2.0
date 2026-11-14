import { describe, expect, it } from 'vitest';
import { AVISO_LEGAL, dividirEmFolhas, FOLHA, formatarDataBR, montarPdfReceita, nomeArquivoReceita, textoFarmaceutico } from '../src/js/pdf.js';

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

const FARMACEUTICO = { id: 3, nome: 'Ana Souza', cargo: 'Farmacêutica Responsável', registro_profissional: 'CRF-SE 1234' };

describe('montarPdfReceita', () => {
  it('traz os campos da ficha da farmácia, com os dados do paciente e do medicamento', async () => {
    const { texto } = await gerar({ data_venda: '2026-10-30', farmaceutico: FARMACEUTICO, itens: [item(1, { medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '1023506630034', lote: '4Q6312' })] });
    for (const esperado of [
      'FARM', 'COUTO LTDA', 'NOME:', 'Igor Lemos', 'RG:', '36452718', 'CPF:', '123.456.789-00',
      'NASC.:', '01/10/1999', 'CONTATO:', '(79) 98845-3518', 'MEDICAMENTO:', 'ALPRAZOLAM 0,25 MG 30 CPRS',
      'RMS:', '1023506630034', 'LOTE:', '4Q6312', 'VALIDADE:', '02/2027', 'QUANT.:', 'DATA:', '30/10/2026', 'ASS:',
      'PORTARIA 344/98 E RDC', 'ANA SOUZA', 'CRF-SE 1234',
    ]) expect(texto, esperado).toContain(esperado);
  });

  it('sai em retrato (em pé): folha de cheque de 80 × 175 mm', async () => {
    const { doc } = await gerar({ data_venda: '2026-10-30', itens: [item(1)] });
    expect(FOLHA).toEqual({ largura: 80, altura: 175, orientacao: 'portrait' });
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(80, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(175, 0);
  });

  it('esconde as linhas de campos não preenchidos (paciente e medicamento)', async () => {
    const { texto } = await gerar(
      { data_venda: '2026-10-30', itens: [{ medicamento: 'DIPIRONA 500MG', rms: '', laboratorio: null, lote: '', validade: '', quantidade: null }] },
      { nome: 'José Silva', telefone: '(75) 98888-0000' },
    );
    expect(texto).toContain('DIPIRONA 500MG');
    expect(texto).toContain('CONTATO:');
    for (const rotulo of ['RG:', 'CPF:', 'NASC.:', 'RMS:', 'LOTE:', 'VALIDADE:', 'LABORAT', 'QUANT.:']) expect(texto, rotulo).not.toContain(rotulo);
  });

  it('não desenha blocos em branco: com 1 ou 2 medicamentos só aparecem eles', async () => {
    for (const n of [1, 2]) {
      const itens = Array.from({ length: n }, (_, i) => item(i + 1));
      const { doc, texto } = await gerar({ data_venda: '2026-10-30', itens });
      expect(texto.match(/\(MEDICAMENTO:\)/g)).toHaveLength(n);
      expect(texto.match(/\(LABORAT.RIO:\)/g)).toHaveLength(n);
      expect(doc.getNumberOfPages()).toBe(1);
    }
  });

  it('cabe até 4 medicamentos por folha; mais itens geram outras folhas, todas com cabeçalho', async () => {
    const itens = Array.from({ length: 9 }, (_, i) => item(i + 1));
    const { doc, texto } = await gerar({ data_venda: '2026-10-30', itens });
    expect(doc.getNumberOfPages()).toBe(3);
    expect(texto.match(/\(MEDICAMENTO:\)/g)).toHaveLength(9);
    expect(texto.match(/\(NOME:\)/g)).toHaveLength(3);
    expect(texto).toContain('FOLHA 3/3');
    expect(texto).toContain('MEDICAMENTO 9 10 MG');
  });

  it('o farmacêutico vem da receita (nada fixo no código); sem ele o campo fica em branco', async () => {
    const sem = await gerar({ data_venda: '2026-10-30', farmaceutico: null, itens: [item(1)] });
    expect(sem.texto).toContain('FARMAC');
    expect(sem.texto).not.toContain('LEANDRO');
    const outro = await gerar({ data_venda: '2026-10-30', farmaceutico: { nome: 'Bruno Lima', registro_profissional: 'CRF-SE 77' }, itens: [item(1)] });
    expect(outro.texto).toContain('BRUNO LIMA');
    expect(outro.texto).toContain('CRF-SE 77');
  });

  it('não corta o laboratório nem o nome do medicamento mais longos da planilha real', async () => {
    const { texto } = await gerar({ data_venda: '2026-10-30', itens: [item(1, {
      medicamento: 'KOLLAGENASE COM CLORANFENICOL 0,6U/G POMADA DERMATOLOGICA',
      laboratorio: 'MULTILAB IND.E COM. DE PROD. FARMAC.LTDA',
    })] });
    // nomes longos quebram em 2 linhas em vez de serem cortados
    const semQuebra = texto.replace(/\) Tj[\s\S]*?\(/g, ' ');
    expect(semQuebra).toContain('KOLLAGENASE COM CLORANFENICOL');
    expect(semQuebra).toContain('POMADA DERMATOLOGICA');
    expect(semQuebra).toContain('MULTILAB IND.E COM.');
    expect(semQuebra).toContain('FARMAC.LTDA');
    expect(texto).not.toContain('…');
  });

  it('funciona sem dados opcionais (sem RG, CPF, lote, quantidade)', async () => {
    const { texto } = await gerar({ data_venda: '2026-10-30', cliente_nome: 'Só Nome', itens: [{ medicamento: 'X 1 MG', rms: '', laboratorio: null }] }, { nome: 'Só Nome' });
    expect(texto).toContain('Só Nome');
    expect(texto).toContain('X 1 MG');
  });

  it('divide os itens em folhas de 4', () => {
    expect(dividirEmFolhas([]).length).toBe(1);
    expect(dividirEmFolhas([1, 2, 3, 4]).length).toBe(1);
    expect(dividirEmFolhas([1, 2, 3, 4, 5]).map(f => f.length)).toEqual([4, 1]);
    expect(dividirEmFolhas(undefined)).toEqual([[]]);
  });

  it('monta o texto do farmacêutico com cargo e CRF', () => {
    expect(textoFarmaceutico(FARMACEUTICO)).toBe('ANA SOUZA (Farmacêutica Responsável) — CRF-SE 1234');
    expect(textoFarmaceutico({ nome: 'Bia' })).toBe('BIA');
    expect(textoFarmaceutico(null)).toBe('');
  });

  it('o aviso legal é o texto oficial', () => {
    expect(AVISO_LEGAL).toBe('CIENTE QUE DE ACORDO COM A PORTARIA 344/98 E RDC Nº 20/2011 NÃO É PERMITIDO A TROCA OU DEVOLUÇÃO DE MEDICAMENTO CONTROLADO/ ANTIBIÓTICO.');
  });
});
