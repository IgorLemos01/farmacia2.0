import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campo, digitarEEscolher, guardar, ler, montar, sobreposto } from './ajuda.js';

const fc = nome => document.getElementById('fc_' + nome);
const salvarCliente = () => sobreposto().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
const erroCliente = () => sobreposto().querySelector('.form-erro');

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));
  guardar('clientes', []);
  ['manipulacoes', 'exames', 'receitas'].forEach(k => guardar(k, []));
});

describe('cadastro rápido na tela de Clientes', () => {
  it('só nome e WhatsApp são obrigatórios; os opcionais ficam recolhidos', async () => {
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    campo('btnAbrirModalCliente').click();
    expect(sobreposto().querySelector('details.secao-opcional').open).toBe(false);
    expect(sobreposto().querySelectorAll('.req')).toHaveLength(2);

    fc('nome').value = 'José da Silva';
    fc('telefone').value = '79988887777';
    salvarCliente();
    await vi.waitFor(() => expect(ler('clientes')).toHaveLength(1));
    expect(ler('clientes')[0]).toMatchObject({ nome: 'José da Silva', telefone: '(79) 98888-7777', cpf: null, rg: null });
    await vi.waitFor(() => expect(c.textContent).toContain('José da Silva'));
    expect(c.textContent).not.toContain('incompleto');   // sem aviso de cadastro incompleto
  });

  it.each([
    [{ nome: '', telefone: '79988887777' }, 'Nome completo'],
    [{ nome: 'José', telefone: '' }, 'WhatsApp'],
    [{ nome: 'José', telefone: '1234' }, 'DDD'],
    [{ nome: 'José', telefone: '79988887777', cpf: '123.456.789-00' }, 'CPF inválido'],
    [{ nome: 'José', telefone: '79988887777', email: 'sem-arroba' }, 'E-mail inválido'],
    [{ nome: 'José', telefone: '79988887777', cep: '123' }, 'CEP inválido'],
  ])('avisa no próprio formulário: %o', async (dados, trecho) => {
    await montar('../src/js/views/clientes.js', 'renderClientes');
    campo('btnAbrirModalCliente').click();
    Object.entries(dados).forEach(([k, v]) => { fc(k).value = v; });
    salvarCliente();
    await vi.waitFor(() => expect(erroCliente().hidden).toBe(false));
    expect(erroCliente().textContent).toContain(trecho);
    expect(ler('clientes')).toEqual([]);
  });

  it('as alergias continuam no formulário e na lista', async () => {
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    campo('btnAbrirModalCliente').click();
    fc('nome').value = 'Maria';
    fc('telefone').value = '(79) 3211-4455';
    fc('alergia').value = 'Dipirona';
    salvarCliente();
    await vi.waitFor(() => expect(c.querySelector('tbody').textContent).toContain('Dipirona'));
    expect(ler('clientes')[0].telefone).toBe('(79) 3211-4455');
  });

  it('editar depois permite completar os dados e salva o endereço em partes', async () => {
    guardar('clientes', [{ id: 1, nome: 'Ana', telefone: '(79) 99999-0000' }]);
    const c = await montar('../src/js/views/clientes.js', 'renderClientes');
    c.querySelector('[data-acao="editar"]').click();
    expect(sobreposto().querySelector('.modal-title').textContent).toBe('Editar Cliente');
    expect(sobreposto().querySelector('.campo-pendente')).toBeNull();
    fc('cpf').value = '52998224725';
    fc('cep').value = '49000000';
    fc('endereco').value = 'Rua A';
    fc('numero').value = '10';
    fc('cidade').value = 'Lagarto';
    fc('estado').value = 'SE';
    salvarCliente();
    await vi.waitFor(() => expect(ler('clientes')[0].cpf).toBe('529.982.247-25'));
    expect(ler('clientes')[0]).toMatchObject({ cep: '49000-000', estado: 'SE' });
    await vi.waitFor(() => expect(c.textContent).toContain('Rua A, 10 - Lagarto/SE - CEP 49000-000'));
  });
});

describe('cadastro rápido e complemento durante o atendimento', () => {
  it('na Manipulação, "+ Cadastrar novo cliente" cria o paciente só com nome e WhatsApp e já o escolhe', async () => {
    await montar('../src/js/views/manipulacoes.js', 'renderManipulacoes');
    campo('btnAbrirModalManip').click();
    campo('manip_formula').value = 'Minoxidil 5%';
    await digitarEEscolher(campo('manip_paciente'), 'Paciente Novo', '+ Cadastrar novo cliente');
    expect(fc('nome').value).toBe('Paciente Novo');
    fc('telefone').value = '79999990000';
    salvarCliente();
    await vi.waitFor(() => expect(campo('manip_paciente').readOnly).toBe(true));
    expect(campo('manip_paciente').value).toBe('Paciente Novo');
    expect(campo('manip_formula').value).toBe('Minoxidil 5%'); // o pedido aberto não se perde
    expect(document.querySelector('.paciente-card').textContent).not.toContain('incompleto');
    expect(ler('clientes')).toHaveLength(1);
  });

  it('digitar um telefone na busca já preenche o WhatsApp do cadastro rápido', async () => {
    await montar('../src/js/views/manipulacoes.js', 'renderManipulacoes');
    campo('btnAbrirModalManip').click();
    await digitarEEscolher(campo('manip_paciente'), '79 98888-1111', '+ Cadastrar novo cliente');
    expect(fc('telefone').value).toBe('(79) 98888-1111');
    expect(fc('nome').value).toBe('');
  });

  it('o cartão do paciente mostra a alergia e não mostra aviso nem botão de cadastro incompleto', async () => {
    guardar('clientes', [{ id: 1, nome: 'Ana Souza', telefone: '(79) 99999-0000', alergia: 'AAS' }]);
    await montar('../src/js/views/manipulacoes.js', 'renderManipulacoes');
    campo('btnAbrirModalManip').click();
    await digitarEEscolher(campo('manip_paciente'), 'ana', 'Ana Souza');
    expect(document.querySelector('.alerta-alergia').textContent).toContain('AAS');
    expect(document.querySelector('[data-completar]')).toBeNull();
    expect(document.querySelector('.paciente-card').textContent).not.toMatch(/incompleto|Completar/);
  });

  it('cancelar o cadastro rápido volta ao pedido sem criar cliente', async () => {
    await montar('../src/js/views/manipulacoes.js', 'renderManipulacoes');
    campo('btnAbrirModalManip').click();
    await digitarEEscolher(campo('manip_paciente'), 'Fulano', '+ Cadastrar novo cliente');
    sobreposto().querySelector('[data-fechar]').click();
    await new Promise(r => setTimeout(r, 30));
    expect(ler('clientes')).toEqual([]);
    expect(campo('manip_paciente').readOnly).toBe(false);
  });

  it('busca o paciente além dos 50 primeiros (sem lista fixa)', async () => {
    const muitos = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, nome: `Cliente ${String(i + 1).padStart(2, '0')}`, telefone: '(79) 90000-0000' }));
    guardar('clientes', muitos);
    await montar('../src/js/views/manipulacoes.js', 'renderManipulacoes');
    campo('btnAbrirModalManip').click();
    await digitarEEscolher(campo('manip_paciente'), 'Cliente 79', 'Cliente 79');
    expect(campo('manip_paciente').value).toBe('Cliente 79');
  });
});
