import { describe, expect, it } from 'vitest';
import { lerArquivoTexto, lerCsvExames, parseValorBR } from '../src/js/csv.js';

describe('parseValorBR', () => {
  it.each([
    ['13', 13], ['13,5', 13.5], ['7,00', 7], ['1.250,00', 1250], ['1.250', 1250], ['12.5', 12.5], ['12.50', 12.5],
    ['R$ 13,00', 13], [' R$1.250,50 ', 1250.5], ['0', 0], ['930', 930],
  ])('%s → %s', (entrada, esperado) => expect(parseValorBR(entrada)).toBe(esperado));

  it.each([[''], ['   '], [null], [undefined], ['abc'], ['-5'], ['1e3'], ['12,3,4'], ['R$']])('%j é inválido', entrada =>
    expect(parseValorBR(entrada)).toBeNull());
});

describe('lerCsvExames', () => {
  it('lê o CSV gerado a partir da planilha (separador ; e vírgula decimal)', () => {
    const { itens, erros } = lerCsvExames('Exame;Valor\r\nGlicemia EM JEJUM;7,00\r\nHemograma COMPLETO;13,00\r\n');
    expect(erros).toEqual([]);
    expect(itens).toEqual([
      { linha: 2, nome: 'Glicemia EM JEJUM', valor: 7 },
      { linha: 3, nome: 'Hemograma COMPLETO', valor: 13 },
    ]);
  });

  it('ignora o BOM do Excel, linhas em branco e espaços sobrando', () => {
    const { itens } = lerCsvExames('﻿Exame;Valor\n\n  TSH   Ultra  ;13\n;;\n');
    expect(itens).toEqual([{ linha: 3, nome: 'TSH Ultra', valor: 13 }]);
  });

  it('aceita vírgula como separador, com valores entre aspas', () => {
    const { itens } = lerCsvExames('nome,valor\n"Exame, com vírgula","1.250,50"\n"Com ""aspas""",9\n');
    expect(itens).toEqual([
      { linha: 2, nome: 'Exame, com vírgula', valor: 1250.5 },
      { linha: 3, nome: 'Com "aspas"', valor: 9 },
    ]);
  });

  it('aceita tabulação (colar direto da planilha)', () => {
    expect(lerCsvExames('Exame\tValor\nT3\t11').itens).toEqual([{ linha: 2, nome: 'T3', valor: 11 }]);
  });

  it('sem linha de título usa as duas primeiras colunas', () => {
    expect(lerCsvExames('T3;11\nT4;13').itens).toEqual([
      { linha: 1, nome: 'T3', valor: 11 },
      { linha: 2, nome: 'T4', valor: 13 },
    ]);
  });

  it('com várias colunas de valor, escolhe "aproximado"', () => {
    const csv = 'EXAMES;VALORES MINIMOS;VALORES  CARTAO 2X;VALORES APROXIMADOS;COTAÇÃO\nT3;10;10,55;11;\nT4;12;12,66;13;';
    expect(lerCsvExames(csv).itens).toEqual([
      { linha: 2, nome: 'T3', valor: 11 },
      { linha: 3, nome: 'T4', valor: 13 },
    ]);
  });

  it('relata as linhas com problema sem derrubar as boas', () => {
    const { itens, erros } = lerCsvExames('Exame;Valor\nOk;5\n;7\nSem valor;\nValor ruim;abc\nNegativo;-3\n');
    expect(itens).toEqual([{ linha: 2, nome: 'Ok', valor: 5 }]);
    expect(erros).toEqual([
      { linha: 3, nome: '', motivo: 'Sem nome de exame.' },
      { linha: 4, nome: 'Sem valor', motivo: 'Sem valor.' },
      { linha: 5, nome: 'Valor ruim', motivo: 'Valor inválido: "abc".' },
      { linha: 6, nome: 'Negativo', motivo: 'Valor inválido: "-3".' },
    ]);
  });

  it('arquivo vazio não gera nada', () => {
    expect(lerCsvExames('')).toEqual({ itens: [], erros: [] });
    expect(lerCsvExames('Exame;Valor\n')).toEqual({ itens: [], erros: [] });
  });
});

describe('lerArquivoTexto', () => {
  const arquivo = bytes => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer });

  it('lê UTF-8', async () => {
    expect(await lerArquivoTexto(arquivo(new TextEncoder().encode('Sumário;9')))).toBe('Sumário;9');
  });

  it('cai para Windows-1252 (Excel do Windows) em vez de quebrar os acentos', async () => {
    // "Sumário" em Windows-1252: o "á" é o byte 0xE1, inválido em UTF-8
    const bytes = [0x53, 0x75, 0x6d, 0xe1, 0x72, 0x69, 0x6f];
    expect(await lerArquivoTexto(arquivo(bytes))).toBe('Sumário');
  });
});

import { lerCsvMedicamentos } from '../src/js/csv.js';

describe('lerCsvMedicamentos', () => {
  it('lê o CSV gerado a partir da planilha de controlados', () => {
    const { itens, erros } = lerCsvMedicamentos('RMS;Descrição;Laboratório\r\n1023506630034;ALPRAZOLAM 0,25 MG 30 CPRS;EMS INDUSTRIA FARMACEUTICA LTDA\r\n1677304970028;AMOX+CLAVULANATO 400MG/5 ML PÓ;LEGRAND PHARMA\r\n');
    expect(erros).toEqual([]);
    expect(itens).toEqual([
      { linha: 2, rms: '1023506630034', descricao: 'ALPRAZOLAM 0,25 MG 30 CPRS', laboratorio: 'EMS INDUSTRIA FARMACEUTICA LTDA' },
      { linha: 3, rms: '1677304970028', descricao: 'AMOX+CLAVULANATO 400MG/5 ML PÓ', laboratorio: 'LEGRAND PHARMA' },
    ]);
  });

  it('importa direto a planilha de estoque, ignorando lote, validade e quantidade', () => {
    const csv = 'RMS;Descrição;Lote;VALIDADE;Quantidade;Laboratório\n1023506630034;ALPRAZOLAM 0,25 MG   30 CPRS   ;4Q6312;19/02/2027;2;EMS LTDA   \n';
    expect(lerCsvMedicamentos(csv).itens).toEqual([
      { linha: 2, rms: '1023506630034', descricao: 'ALPRAZOLAM 0,25 MG 30 CPRS', laboratorio: 'EMS LTDA' },
    ]);
  });

  it('sem título usa a ordem RMS, Descrição, Laboratório', () => {
    expect(lerCsvMedicamentos('111;TESTE 10 MG;LAB X').itens).toEqual([
      { linha: 1, rms: '111', descricao: 'TESTE 10 MG', laboratorio: 'LAB X' },
    ]);
  });

  it('aceita medicamento sem RMS e sem laboratório', () => {
    expect(lerCsvMedicamentos('RMS;Descrição;Laboratório\n;SEM TUDO;\n').itens).toEqual([
      { linha: 2, rms: '', descricao: 'SEM TUDO', laboratorio: '' },
    ]);
  });

  it('o RMS não vira número: zeros à esquerda e os 13 dígitos são preservados', () => {
    expect(lerCsvMedicamentos('RMS;Descrição;Laboratório\n0023506630034;X;Y').itens[0].rms).toBe('0023506630034');
  });

  it('recusa RMS que o Excel transformou em notação científica e linhas sem descrição', () => {
    const { itens, erros } = lerCsvMedicamentos('RMS;Descrição;Laboratório\n1,02351E+12;ESTRAGADO;LAB\n123;;LAB\n456;OK;LAB\n');
    expect(itens).toEqual([{ linha: 4, rms: '456', descricao: 'OK', laboratorio: 'LAB' }]);
    expect(erros.map(e => e.linha)).toEqual([2, 3]);
    expect(erros[0].motivo).toContain('notação científica');
    expect(erros[1].motivo).toBe('Sem descrição do medicamento.');
  });

  it('arquivo vazio não gera nada', () => {
    expect(lerCsvMedicamentos('')).toEqual({ itens: [], erros: [] });
  });
});
