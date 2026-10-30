import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));

async function renderizar(filtros) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  const { renderDashboard } = await import('../src/js/views/dashboard.js');
  document.body.innerHTML = '<div id="c"></div>';
  const container = document.getElementById('c');
  await renderDashboard(container, '', filtros);
  return container.textContent.replace(/\s+/g, ' ');
}

beforeEach(() => {
  localStorage.clear();
  guardar('clientes', [{ id: 1, nome: 'Ana', cpf: '1', rg: '1', telefone: '1', email: 'a@a', endereco: 'R', sexo: 'F' }]);
  guardar('manipulacoes', [
    { id: 1, cliente_id: 1, cliente_nome: 'Ana', formula: 'Fórmula de Outubro Cedo', data: '2026-10-01', valor: 10 },
    { id: 2, cliente_id: 1, cliente_nome: 'Ana', formula: 'Fórmula de Outubro Tarde', data: '2026-10-20', valor: 30 },
  ]);
  guardar('exames', [{ id: 3, cliente_id: 1, cliente_nome: 'Ana', tipo_exame: 'Exame de Setembro', data: '2026-09-10', valor: 5 }]);
  guardar('receitas', []);
});

describe('filtro de período do dashboard', () => {
  it('sem filtro soma tudo', async () => {
    const texto = await renderizar({});
    expect(texto).toContain('Receita total');
    expect(texto).toMatch(/R\$\s45,00/);
    expect(texto).toContain('Fórmula de Outubro Cedo');
    expect(texto).toContain('Exame de Setembro');
  });

  it('aplica "De" e "Até" às métricas e à lista de serviços', async () => {
    const texto = await renderizar({ de: '2026-10-15', ate: '2026-10-31' });
    expect(texto).toContain('Receita no período');
    expect(texto).toContain('Manipulações no período');
    expect(texto).toMatch(/R\$\s30,00/);
    expect(texto).not.toMatch(/R\$\s45,00/);
    expect(texto).toContain('Fórmula de Outubro Tarde');
    expect(texto).not.toContain('Fórmula de Outubro Cedo');
    expect(texto).not.toContain('Exame de Setembro');
    expect(texto).toContain('Exibindo de 15/10/2026 até 31/10/2026');
  });

  it('período sem nenhum registro zera os totais', async () => {
    const texto = await renderizar({ de: '2026-01-01', ate: '2026-01-31' });
    expect(texto).toMatch(/R\$\s0,00/);
    expect(texto).toContain('Nenhum serviço registrado');
  });

  it('datas digitadas ao contrário são invertidas', async () => {
    const texto = await renderizar({ de: '2026-10-31', ate: '2026-10-15' });
    expect(texto).toContain('Exibindo de 15/10/2026 até 31/10/2026');
    expect(texto).toMatch(/R\$\s30,00/);
  });

  it('a lista de clientes não depende do período', async () => {
    const texto = await renderizar({ de: '2026-01-01', ate: '2026-01-31' });
    expect(texto).toMatch(/1\s*Clientes cadastrados/);
  });
});
