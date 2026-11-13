import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guardar, montar } from './ajuda.js';

const manip = (id, data, valor, forma = 'PIX', cliente_id = 1) => ({ id, cliente_id, cliente_nome: 'Ana', formula: `Fórmula ${id}`, data, valor, forma_pagamento: forma });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('alert', vi.fn());
  guardar('clientes', [{ id: 1, nome: 'Ana', telefone: '(79) 99999-0000' }, { id: 2, nome: 'Bia', telefone: '(79) 98888-0000' }]);
  guardar('manipulacoes', [manip(1, '2026-10-01', 10), manip(2, '2026-10-20', 30, 'Dinheiro'), manip(3, '2026-10-21', 5, 'PIX', 2)]);
  guardar('exames', [
    { id: 4, cliente_id: 1, cliente_nome: 'Ana', data: '2026-09-10', forma_pagamento: 'PIX', itens: [{ id: 40, nome: 'Glicemia', valor: 10 }, { id: 41, nome: 'TSH', valor: 25 }] },
    { id: 5, cliente_id: 2, cliente_nome: 'Bia', data: '2026-10-15', forma_pagamento: null, itens: [{ id: 50, nome: 'Glicemia', valor: 8 }] },
  ]);
  guardar('receitas', [{ id: 6, cliente_id: 1, cliente_nome: 'Ana', data_venda: '2026-10-22', medico_prescritor: 'Dr. X', itens: [{ id: 60, medicamento: 'ALPRAZOLAM 0,25 MG', quantidade: 2 }] }]);
});

const texto = c => c.textContent.replace(/\s+/g, ' ');
const aba = (c, chave) => c.querySelector(`[data-aba="${chave}"]`);
const conteudo = c => c.querySelector('#dashConteudo');

async function abrirAba(c, chave, esperado) {
  aba(c, chave).click();
  await vi.waitFor(() => expect(texto(conteudo(c))).toContain(esperado));
}

function mudarPeriodo(c, de, ate) {
  const caixa = conteudo(c).querySelector('[data-filtro]');
  caixa.querySelector('[data-campo="de"]').value = de;
  caixa.querySelector('[data-campo="ate"]').value = ate;
  caixa.querySelector('[data-campo="ate"]').dispatchEvent(new Event('change'));
}

describe('dashboard com relatórios separados por categoria', () => {
  it('tem as abas Visão Geral, Manipulação, Exames e Receitas', async () => {
    const c = await montar('../src/js/views/dashboard.js', 'renderDashboard', '');
    expect([...c.querySelectorAll('[data-aba]')].map(b => b.textContent)).toEqual(['Visão Geral', 'Manipulação', 'Exames', 'Receitas']);
  });

  it('cada categoria mostra só os próprios registros e totais', async () => {
    const c = await montar('../src/js/views/dashboard.js', 'renderDashboard', '');
    await abrirAba(c, 'exames', 'Relatório de Exames');
    const t = texto(conteudo(c));
    expect(t).toContain('Glicemia; TSH');
    expect(t).not.toContain('Fórmula 1');
    expect(t).toMatch(/R\$\s43,00/);      // faturamento de exames
    expect(t).toContain('Exames realizados');
    expect(t).toContain('Exames mais realizados');

    await abrirAba(c, 'receitas', 'Relatório de Receitas');
    expect(texto(conteudo(c))).toContain('ALPRAZOLAM 0,25 MG');
    expect(texto(conteudo(c))).not.toContain('Faturamento');
  });

  it('o período de uma categoria não muda o das outras', async () => {
    const c = await montar('../src/js/views/dashboard.js', 'renderDashboard', '');
    await abrirAba(c, 'manipulacoes', 'Relatório de Manipulação');
    mudarPeriodo(c, '2026-10-15', '2026-10-31');
    await vi.waitFor(() => expect(texto(conteudo(c))).toContain('Exibindo de 15/10/2026 até 31/10/2026'));
    expect(texto(conteudo(c))).toMatch(/R\$\s35,00/);
    expect(texto(conteudo(c))).not.toContain('Fórmula 1');

    await abrirAba(c, 'exames', 'Relatório de Exames');
    expect(texto(conteudo(c))).toContain('Todo o período');      // exames continua sem filtro
    expect(texto(conteudo(c))).toMatch(/R\$\s43,00/);

    await abrirAba(c, 'manipulacoes', 'Relatório de Manipulação');
    expect(texto(conteudo(c))).toContain('Exibindo de 15/10/2026 até 31/10/2026'); // e a manipulação guardou o seu

    conteudo(c).querySelector('[data-rapido="limpar"]').click();
    await vi.waitFor(() => expect(texto(conteudo(c))).toContain('Fórmula 1'));
    expect(texto(conteudo(c))).toMatch(/R\$\s45,00/);
  });

  it('lista paginada com navegação e escolha de quantidade por página', async () => {
    guardar('manipulacoes', Array.from({ length: 25 }, (_, i) => manip(i + 1, `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, 1)));
    const c = await montar('../src/js/views/dashboard.js', 'renderDashboard', '');
    await abrirAba(c, 'manipulacoes', 'Mostrando 1–20 de 25');
    expect(conteudo(c).querySelectorAll('tbody tr')).toHaveLength(20);
    conteudo(c).querySelector('[data-pagina="2"]').click();
    await vi.waitFor(() => expect(texto(conteudo(c))).toContain('Mostrando 21–25 de 25'));
    expect(conteudo(c).querySelectorAll('tbody tr')).toHaveLength(5);

    const limite = conteudo(c).querySelector('[data-limite]');
    limite.value = '50';
    limite.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(texto(conteudo(c))).toContain('Mostrando 1–25 de 25'));
  });

  it('exporta PDF e Excel com TODAS as linhas do período da categoria', async () => {
    vi.resetModules();
    const exportarPdf = vi.fn(async () => {});
    const exportarExcel = vi.fn();
    vi.doMock('../src/js/relatorios.js', async () => ({ ...(await vi.importActual('../src/js/relatorios.js')), exportarPdf, exportarExcel }));
    guardar('manipulacoes', Array.from({ length: 25 }, (_, i) => manip(i + 1, '2026-10-05', 2)));
    vi.stubEnv('VITE_API_URL', '');
    const { renderDashboard } = await import('../src/js/views/dashboard.js');
    document.body.innerHTML = '<div id="c"></div>';
    const c = document.getElementById('c');
    await renderDashboard(c, '');
    await abrirAba(c, 'manipulacoes', 'Mostrando 1–20 de 25');

    conteudo(c).querySelector('[data-exportar="xlsx"]').click();
    await vi.waitFor(() => expect(exportarExcel).toHaveBeenCalledOnce());
    const [categoria, relatorio] = exportarExcel.mock.calls[0];
    expect(categoria).toBe('manipulacoes');
    expect(relatorio.itens).toHaveLength(25);

    conteudo(c).querySelector('[data-exportar="pdf"]').click();
    await vi.waitFor(() => expect(exportarPdf).toHaveBeenCalledOnce());
    vi.doUnmock('../src/js/relatorios.js');
  });
});

describe('arquivos exportados', () => {
  const usuario = { nome: 'Ana Souza', cargo: 'Farmacêutica Responsável', registro_profissional: 'CRF-SE 1234' };
  const relatorio = {
    periodo: { de: '2026-10-01', ate: '2026-10-31' },
    resumo: { quantidade: 2, clientes_atendidos: 1, valor_total: 43, ticket_medio: 21.5, total_exames: 3 },
    itens: [
      { data: '2026-10-05', cliente_nome: 'Ana', cliente_telefone: '(79) 99999-0000', exames: 'Glicemia; TSH', quantidade_exames: 2, forma_pagamento: 'PIX', valor: 35 },
      { data: '2026-10-15', cliente_nome: 'Bia', cliente_telefone: null, exames: 'Glicemia', quantidade_exames: 1, forma_pagamento: null, valor: 8 },
    ],
  };

  it('PDF traz o título da categoria, cabeçalhos, emissor logado e total', async () => {
    const { montarPdfRelatorio } = await import('../src/js/relatorios.js');
    const { jsPDF } = await import('jspdf');
    const doc = montarPdfRelatorio(jsPDF, 'exames', relatorio, usuario);
    const t = doc.output();
    for (const esperado of ['Relat', 'Exames realizados', 'WhatsApp', 'Glicemia; TSH', 'Ana Souza', 'CRF-SE 1234', '01/10/2026 a 31/10/2026', 'TOTAL DO PER', 'gina 1 de 1']) {
      expect(t, esperado).toContain(esperado);
    }
  });

  it('Excel traz os cabeçalhos da categoria, o período e o emissor', async () => {
    const { montarXlsxRelatorio } = await import('../src/js/relatorios.js');
    const t = new TextDecoder().decode(montarXlsxRelatorio('receitas', {
      periodo: { de: null, ate: null }, resumo: { quantidade: 1, clientes_atendidos: 1, total_medicamentos: 1 },
      itens: [{ data: '2026-10-22', cliente_nome: 'Ana', medicamentos: 'ALPRAZOLAM', unidades: 2, medico_prescritor: 'Dr. X', farmaceutico: 'Ana Souza' }],
    }, usuario));
    for (const esperado of ['Relatório de Receitas', 'Medicamentos', 'Médico prescritor', 'Farmacêutico', 'Todo o período', 'CRF-SE 1234', 'ALPRAZOLAM']) {
      expect(t, esperado).toContain(esperado);
    }
    expect(t).not.toContain('Faturamento');
  });
});
