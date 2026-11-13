import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campo, digitarEEscolher, enviar, guardar, ler, montar, sugestoes } from './ajuda.js';

const exame = (id, nome, valor, ativo = true) => ({ id, nome, valor, ativo, criado_em: '2026-10-01T09:00:00', atualizado_em: '2026-10-01T09:00:00' });
const CATALOGO = [
  exame(1, 'Glicemia em jejum', 10), exame(2, 'Teste de gravidez', 18), exame(3, 'Ácido úrico', 12),
  exame(4, 'Hemograma completo', 20), exame(5, 'Exame Antigo', 99, false),
];
const CLIENTE = { id: 1, nome: 'Ana Souza', telefone: '(79) 99999-0000', alergia: 'Iodo' };

const linhas = () => [...document.querySelectorAll('#exame_itens tr')];
const busca = () => campo('exame_busca');
const total = () => campo('exame_total').textContent.replace(/\s/g, ' ');

let alerta;
beforeEach(() => {
  localStorage.clear();
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
  vi.stubGlobal('confirm', vi.fn(() => true));
  guardar('clientes', [CLIENTE]);
  guardar('catalogo_exames', CATALOGO);
  guardar('exames', []);
});

async function abrir() {
  const c = await montar('../src/js/views/exames.js', 'renderExames');
  campo('btnAbrirModalExame').click();
  return c;
}

describe('pedido com vários exames', () => {
  it('adiciona vários exames seguidos: o campo de busca não trava depois do primeiro', async () => {
    await abrir();
    await digitarEEscolher(busca(), 'ácido', 'Ácido úrico');
    expect(busca().value).toBe('');                 // livre para o próximo
    expect(busca().disabled).toBe(false);
    await digitarEEscolher(busca(), 'glic', 'Glicemia em jejum');
    await digitarEEscolher(busca(), 'gravidez', 'Teste de gravidez');
    await digitarEEscolher(busca(), 'hemo', 'Hemograma completo');
    expect(linhas().map(tr => tr.querySelector('.carrinho-nome').textContent))
      .toEqual(['Ácido úrico', 'Glicemia em jejum', 'Teste de gravidez', 'Hemograma completo']);
    expect(total()).toContain('60,00');
    expect(campo('exame_qtd').textContent).toBe('4 exame(s)');
  });

  it('o valor de cada exame pode ser editado e o total é recalculado; remover também recalcula', async () => {
    await abrir();
    await digitarEEscolher(busca(), 'glic', 'Glicemia');
    await digitarEEscolher(busca(), 'hemo', 'Hemograma');
    const valor = linhas()[1].querySelector('.exame-valor');
    expect(valor.value).toBe('20,00');
    valor.value = '15,50';
    valor.dispatchEvent(new Event('input'));
    expect(total()).toContain('25,50');

    valor.value = 'abc';
    valor.dispatchEvent(new Event('input'));
    expect(valor.classList.contains('invalido')).toBe(true);
    expect(total()).toBe('—');

    linhas()[1].querySelector('button').click();
    expect(linhas()).toHaveLength(1);
    expect(total()).toContain('10,00');
  });

  it('não repete o mesmo exame no pedido e avisa', async () => {
    await abrir();
    await digitarEEscolher(busca(), 'glic', 'Glicemia');
    await digitarEEscolher(busca(), 'glic', 'Glicemia');
    expect(linhas()).toHaveLength(1);
    expect(campo('dicaExame').textContent).toContain('já está no pedido');
  });

  it('só oferece exames ativos', async () => {
    await abrir();
    busca().focus();
    busca().value = 'exame';
    busca().dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    expect(sugestoes(busca()).map(li => li.textContent).join()).not.toContain('Antigo');
  });

  it('salva o pedido com os itens, o valor ajustado e o total; aparece no histórico', async () => {
    const c = await abrir();
    await digitarEEscolher(campo('exame_paciente'), 'ana', 'Ana Souza');
    expect(document.querySelector('.alerta-alergia').textContent).toContain('Iodo');
    await digitarEEscolher(busca(), 'glic', 'Glicemia');
    await digitarEEscolher(busca(), 'gravidez', 'Teste de gravidez');
    linhas()[1].querySelector('.exame-valor').value = '15';
    campo('exame_obs').value = 'Glicemia 92 mg/dL';
    enviar('formNovoExame');

    await vi.waitFor(() => expect(ler('exames')).toHaveLength(1));
    const salvo = ler('exames')[0];
    expect(salvo).toMatchObject({ cliente_id: 1, forma_pagamento: 'PIX', observacoes: 'Glicemia 92 mg/dL' });
    expect(salvo.itens.map(i => [i.nome, i.valor])).toEqual([['Glicemia em jejum', 10], ['Teste de gravidez', 15]]);
    await vi.waitFor(() => expect(c.querySelector('tbody').textContent).toContain('Teste de gravidez'));
    expect(c.querySelector('tbody').textContent).toMatch(/R\$\s25,00/);
    expect(c.querySelector('tbody').textContent).toContain('2 exame(s)');
  });

  it('não salva sem paciente nem sem exames', async () => {
    await abrir();
    await digitarEEscolher(busca(), 'glic', 'Glicemia');
    enviar('formNovoExame');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledWith('Escolha o paciente (ou cadastre um novo pela busca).'));

    await digitarEEscolher(campo('exame_paciente'), 'ana', 'Ana Souza');
    linhas()[0].querySelector('button').click();
    enviar('formNovoExame');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledWith('Adicione pelo menos um exame ao atendimento.'));
    expect(ler('exames')).toEqual([]);
  });

  it('na edição mantém o nome da época, permite ajustar valores e incluir exames', async () => {
    guardar('exames', [{ id: 9, cliente_id: 1, cliente_nome: 'Ana Souza', data: '2026-10-01', forma_pagamento: 'PIX', observacoes: null,
      itens: [{ id: 90, catalogo_id: 1, nome: 'Glicemia (nome antigo)', valor: 8 }] }]);
    const c = await montar('../src/js/views/exames.js', 'renderExames');
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(campo('exame_paciente').readOnly).toBe(true));
    expect(linhas()[0].querySelector('.carrinho-nome').textContent).toBe('Glicemia (nome antigo)');
    linhas()[0].querySelector('.exame-valor').value = '9,00';
    await digitarEEscolher(busca(), 'hemo', 'Hemograma');
    enviar('formNovoExame');
    await vi.waitFor(() => expect(ler('exames')[0].itens).toHaveLength(2));
    expect(ler('exames')[0].itens.map(i => [i.nome, i.valor])).toEqual([['Glicemia (nome antigo)', 9], ['Hemograma completo', 20]]);
  });

  it('exame antigo (um por registro) continua aparecendo e pode ser editado', async () => {
    guardar('exames', [{ id: 3, cliente_id: 1, cliente_nome: 'Ana Souza', tipo_exame: 'Glicemia Capilar', data: '2026-10-01', valor: 20 }]);
    const c = await montar('../src/js/views/exames.js', 'renderExames');
    expect(c.querySelector('tbody').textContent).toContain('Glicemia Capilar');
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(linhas()).toHaveLength(1));
    expect(linhas()[0].querySelector('.exame-valor').value).toBe('20,00');
  });

  it('catálogo vazio bloqueia o cadastro e orienta', async () => {
    guardar('catalogo_exames', []);
    await abrir();
    expect(campo('btnSalvarExame').disabled).toBe(true);
    expect(campo('dicaExame').textContent).toContain('Configurações → Catálogo de Exames');
  });
});

describe('digitação rápida', () => {
  it('Enter logo depois de digitar escolhe o resultado da busca nova, não o da lista anterior', async () => {
    await abrir();
    busca().focus();                                     // abre a lista com todos (Ácido úrico primeiro)
    await vi.waitFor(() => expect(sugestoes(busca()).length).toBeGreaterThan(0));
    busca().value = 'glic';
    busca().dispatchEvent(new Event('input', { bubbles: true }));
    busca().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(linhas()).toHaveLength(1));
    expect(linhas()[0].querySelector('.carrinho-nome').textContent).toBe('Glicemia em jejum');
  });
});
