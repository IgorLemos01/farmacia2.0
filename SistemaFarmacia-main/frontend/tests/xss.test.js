import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('telas não executam HTML vindo dos dados', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', '');
  });

  it('lista de clientes mostra o nome malicioso como texto', async () => {
    const malicioso = '<img src=x onerror="window.__xss=1">';
    localStorage.setItem('fc_demo_clientes', JSON.stringify([{
      id: 1, nome: malicioso, cpf: '1', rg: '2', telefone: '3', email: 'a@b.c',
      endereco: '<b>rua</b>', sexo: 'F', data_nascimento: '2000-01-01', alergia: '"><script>x</script>',
    }]));
    const { renderClientes } = await import('../src/js/views/clientes.js');
    document.body.innerHTML = '<div id="c"></div>';
    const container = document.getElementById('c');

    await renderClientes(container);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('tbody b')).toBeNull();
    expect(container.querySelector('tbody script')).toBeNull();
    expect(container.textContent).toContain(malicioso);
  });
});
