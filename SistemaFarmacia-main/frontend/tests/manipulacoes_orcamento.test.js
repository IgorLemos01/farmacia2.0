import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campo, digitarEEscolher, guardar, ler } from './ajuda.js';

let baixar, imprimir, alerta;

async function abrir() {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  baixar = vi.fn(async () => 'orcamento.pdf');
  imprimir = vi.fn(async () => {});
  vi.doMock('../src/js/orcamento.js', async () => ({ ...(await vi.importActual('../src/js/orcamento.js')), baixarPdfOrcamento: baixar, imprimirPdfOrcamento: imprimir }));
  const { renderManipulacoes } = await import('../src/js/views/manipulacoes.js');
  document.body.innerHTML = '<div id="c"></div>';
  await renderManipulacoes(document.getElementById('c'));
  campo('btnAbrirModalManip').click();
}

beforeEach(() => {
  localStorage.clear();
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
  guardar('clientes', [{ id: 1, nome: 'Ana Souza', telefone: '(79) 99999-0000' }]);
  guardar('manipulacoes', []);
});

describe('orçamento de manipulação', () => {
  it('pede fórmula e valor antes de gerar', async () => {
    await abrir();
    campo('btnOrcamentoManip').click();
    expect(alerta).toHaveBeenCalledWith('Informe a fórmula / composição para gerar o orçamento.');
    campo('manip_formula').value = 'Minoxidil 5%';
    campo('btnImprimirOrcamentoManip').click();
    expect(alerta).toHaveBeenLastCalledWith('Informe o valor da fórmula para gerar o orçamento.');
    expect(baixar).not.toHaveBeenCalled();
    expect(imprimir).not.toHaveBeenCalled();
  });

  it('baixa o PDF e imprime com fórmula, valor, cliente e prazo, sem salvar o pedido', async () => {
    await abrir();
    await digitarEEscolher(campo('manip_paciente'), 'ana', 'Ana Souza');
    campo('manip_formula').value = 'Minoxidil 5%, Biotina 2mg, Loção qsp 60ml';
    campo('manip_valor').value = '89.9';
    campo('manip_prazo').value = '2026-11-20';

    campo('btnOrcamentoManip').click();
    await vi.waitFor(() => expect(baixar).toHaveBeenCalledOnce());
    const dados = baixar.mock.calls[0][0];
    expect(dados).toMatchObject({ tipo: 'manipulacao', itens: [{ nome: 'Minoxidil 5%, Biotina 2mg, Loção qsp 60ml', valor: 89.9 }] });
    expect(dados.cliente.nome).toBe('Ana Souza');
    expect(dados.detalhes).toContainEqual(['Prazo de entrega', '20/11/2026']);

    campo('btnImprimirOrcamentoManip').click();
    await vi.waitFor(() => expect(imprimir).toHaveBeenCalledOnce());
    expect(imprimir.mock.calls[0][0].tipo).toBe('manipulacao');
    expect(ler('manipulacoes')).toEqual([]);
    vi.doUnmock('../src/js/orcamento.js');
  });

  it('o PDF de manipulação tem o título, a fórmula, o prazo e o total', async () => {
    const { montarPdfOrcamento, nomeArquivoOrcamento } = await vi.importActual('../src/js/orcamento.js');
    const { jsPDF } = await import('jspdf');
    const t = montarPdfOrcamento(jsPDF, {
      tipo: 'manipulacao', data: '2026-11-14', cliente: { nome: 'Ana Souza' },
      itens: [{ nome: 'Minoxidil 5%', valor: 89.9 }], detalhes: [['Prazo de entrega', '20/11/2026'], ['Observações', '']],
    }).output();
    for (const esperado of ['AMENTO DE MANIPULA', 'rmula / composi', 'Minoxidil 5%', '89,90', 'Prazo de entrega', '20/11/2026']) expect(t, esperado).toContain(esperado);
    expect(t).not.toContain('Observa');   // detalhe vazio não aparece
    expect(nomeArquivoOrcamento({ nome: 'Ana Souza' }, '2026-11-14', 'manipulacao')).toBe('orcamento-manipulacao-ana-souza-2026-11-14.pdf');
  });
});
