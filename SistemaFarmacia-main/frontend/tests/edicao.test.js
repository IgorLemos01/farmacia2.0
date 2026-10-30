import { beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENTE = {
  id: 1, nome: 'Ana Souza', cpf: '111.111.111-11', rg: '1', data_nascimento: '1990-01-01', sexo: 'F',
  telefone: '(75) 90000-0000', email: 'ana@x.com', endereco: 'Rua A', alergia: null, observacoes: null,
};

const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
const ler = chave => JSON.parse(localStorage.getItem('fc_demo_' + chave));

async function montar(arquivoView, funcao, ...args) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  const modulo = await import(arquivoView);
  document.body.innerHTML = '<div id="c"></div>';
  const container = document.getElementById('c');
  await modulo[funcao](container, ...args);
  return container;
}

const enviar = id => document.getElementById(id).dispatchEvent(new Event('submit', { cancelable: true }));

let alerta;
beforeEach(() => {
  localStorage.clear();
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
  vi.stubGlobal('confirm', vi.fn(() => true));
});

describe('clientes', () => {
  it('edita pelo formulário preenchido e mantém o mesmo registro', async () => {
    guardar('clientes', [CLIENTE]);
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');

    c.querySelector('[data-acao="editar"]').click();
    expect(document.getElementById('tituloModalCliente').textContent).toBe('Editar Cliente');
    expect(document.getElementById('cli_nome').value).toBe('Ana Souza');
    expect(document.getElementById('cli_nasc').value).toBe('1990-01-01');

    document.getElementById('cli_nome').value = 'Ana Maria Souza';
    enviar('formNovoCliente');

    await vi.waitFor(() => expect(c.textContent).toContain('Ana Maria Souza'));
    const salvos = ler('clientes');
    expect(salvos).toHaveLength(1);
    expect(salvos[0].id).toBe(1);
  });

  it('o botão "Novo Cliente" abre o formulário vazio, mesmo depois de uma edição', async () => {
    guardar('clientes', [CLIENTE]);
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    c.querySelector('[data-acao="editar"]').click();
    document.getElementById('btnAbrirModalCliente').click();
    expect(document.getElementById('tituloModalCliente').textContent).toBe('Novo Cliente');
    expect(document.getElementById('cli_nome').value).toBe('');
  });

  it('edição mantém o nome em dia nos registros do cliente (modo demonstração)', async () => {
    guardar('clientes', [CLIENTE]);
    guardar('exames', [{ id: 9, cliente_id: 1, cliente_nome: 'Ana Souza', tipo_exame: 'Glicemia', data: '2026-10-01', valor: 5 }]);
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    c.querySelector('[data-acao="editar"]').click();
    document.getElementById('cli_nome').value = 'Ana Lima';
    enviar('formNovoCliente');
    await vi.waitFor(() => expect(ler('exames')[0].cliente_nome).toBe('Ana Lima'));
  });

  it('recusa CPF que já é de outro cliente', async () => {
    guardar('clientes', [CLIENTE, { ...CLIENTE, id: 2, nome: 'Bia', cpf: '222.222.222-22' }]);
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    c.querySelectorAll('[data-acao="editar"]')[1].click();
    document.getElementById('cli_cpf').value = CLIENTE.cpf;
    enviar('formNovoCliente');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toContain('já pertence a outro cliente');
    expect(ler('clientes')[1].cpf).toBe('222.222.222-22');
  });

  it('exclui após confirmação', async () => {
    guardar('clientes', [CLIENTE]);
    ['manipulacoes', 'exames', 'receitas'].forEach(chave => guardar(chave, [])); // sem histórico
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    c.querySelector('[data-acao="excluir"]').click();
    expect(confirm).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(c.textContent).toContain('Nenhum cliente encontrado'));
    expect(ler('clientes')).toEqual([]);
  });

  it('não exclui se o usuário cancelar a confirmação', async () => {
    guardar('clientes', [CLIENTE]);
    vi.stubGlobal('confirm', vi.fn(() => false));
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    c.querySelector('[data-acao="excluir"]').click();
    await new Promise(r => setTimeout(r, 20));
    expect(ler('clientes')).toHaveLength(1);
  });

  it('não exclui cliente com histórico e explica o motivo', async () => {
    guardar('clientes', [CLIENTE]);
    guardar('receitas', [{ id: 5, cliente_id: 1, medico_prescritor: 'Dr. X', medicamentos: 'Dipirona', data_venda: '2026-10-01' }]);
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    c.querySelector('[data-acao="excluir"]').click();
    await vi.waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toContain('vinculados');
    expect(ler('clientes')).toHaveLength(1);
  });
});

describe.each([
  {
    nome: 'manipulações', arquivo: '../src/js/views/manipulacoes.js', funcao: 'renderManipulacoes', chave: 'manipulacoes',
    registro: { id: 7, cliente_id: 1, cliente_nome: 'Ana Souza', formula: 'Minoxidil 5%', data: '2026-10-10', valor: 50, forma_pagamento: 'PIX' },
    form: 'formNovaManip', campo: 'manip_formula', select: 'manip_cliente_id', titulo: 'tituloModalManip', novo: 'Novo Pedido de Manipulação', campoApi: 'formula',
  },
  {
    nome: 'exames', arquivo: '../src/js/views/exames.js', funcao: 'renderExames', chave: 'exames',
    registro: { id: 7, cliente_id: 1, cliente_nome: 'Ana Souza', tipo_exame: 'Glicemia', data: '2026-10-10', valor: 10, forma_pagamento: 'PIX', observacoes: 'Normal' },
    form: 'formNovoExame', campo: 'exame_obs', select: 'exame_cliente_id', titulo: 'tituloModalExame', novo: 'Registrar Exame / Teste Clínico', campoApi: 'observacoes',
  },
])('$nome', ({ arquivo, funcao, chave, registro, form, campo, select, titulo, novo, campoApi }) => {
  beforeEach(() => {
    guardar('clientes', [CLIENTE]);
    guardar(chave, [registro]);
  });

  it('edita sem trocar o paciente', async () => {
    const c = await montar(arquivo, funcao);
    c.querySelector('[data-acao="editar"]').click();
    expect(document.getElementById(select).disabled).toBe(true);
    expect(document.getElementById(campo).value).not.toBe('');

    document.getElementById(campo).value = 'Texto Editado';
    enviar(form);
    await vi.waitFor(() => expect(ler(chave)[0][campoApi]).toBe('Texto Editado'));
    expect(ler(chave)).toHaveLength(1);
    expect(ler(chave)[0].cliente_id).toBe(1);
    expect(ler(chave)[0].id).toBe(7);
  });

  it('o botão de novo registro volta ao modo de cadastro', async () => {
    const c = await montar(arquivo, funcao);
    c.querySelector('[data-acao="editar"]').click();
    c.querySelector('.btn.btn-primary').click();
    expect(document.getElementById(titulo).textContent).toBe(novo);
    expect(document.getElementById(select).disabled).toBe(false);
  });

  it('exclui após confirmação', async () => {
    const c = await montar(arquivo, funcao);
    c.querySelector('[data-acao="excluir"]').click();
    await vi.waitFor(() => expect(ler(chave)).toEqual([]));
  });
});
