import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
const ler = chave => JSON.parse(localStorage.getItem('fc_demo_' + chave));
const campo = id => document.getElementById(id);
const enviar = id => campo(id).dispatchEvent(new Event('submit', { cancelable: true }));
const cartao = () => document.querySelector('#rec_paciente_area .paciente-card');

const CLIENTES = [
  { id: 1, nome: 'Igor Lemos', cpf: '123.456.789-00', rg: '36452718', data_nascimento: '1999-10-01', telefone: '(79) 98845-3518', sexo: 'M', email: 'i@x.com', endereco: 'R' },
  { id: 2, nome: 'Ana Souza', cpf: '111.111.111-11', rg: '1', data_nascimento: '1990-01-01', telefone: '(79) 90000-0000', sexo: 'F', email: 'a@x.com', endereco: 'R' },
];
const med = (id, descricao, rms, laboratorio, ativo = true) => ({ id, descricao, rms, laboratorio, ativo, criado_em: '2026-10-01T09:00:00', atualizado_em: '2026-10-01T09:00:00' });
const CATALOGO = [
  med(1, 'ALPRAZOLAM 0,25 MG 30 CPRS', '1023506630034', 'EMS INDUSTRIA FARMACEUTICA LTDA'),
  med(2, 'AMOXICILINA 500 MG CX 21 COMP.', '1256801470025', 'PRATI,DONADUZZI &CIA LTDA'),
  med(3, 'CLONAZEPAM 2 MG 30 COMP', '1111111111111', 'LAB X', false), // desativado
];

let baixarPdf;
let alerta;

async function montar() {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  baixarPdf = vi.fn(async () => 'receita.pdf');
  // baixar e imprimir usam o mesmo "gerador" falso
  vi.doMock('../src/js/pdf.js', async () => ({ ...(await vi.importActual('../src/js/pdf.js')), baixarPdfReceita: baixarPdf, imprimirPdfReceita: baixarPdf }));
  const { renderReceitas } = await import('../src/js/views/receitas.js');
  document.body.innerHTML = '<div id="c"></div>';
  const container = document.getElementById('c');
  await renderReceitas(container);
  return container;
}

/** Digita no campo, espera a lista de sugestões e escolhe a que contém `alvo` (como o usuário faria com o mouse). */
async function digitarEEscolher(input, texto, alvo) {
  input.focus();
  input.value = texto;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const lista = input.parentElement.querySelector('.autocomplete-lista');
  await vi.waitFor(() => {
    expect(lista.hidden).toBe(false);
    expect([...lista.querySelectorAll('.autocomplete-item')].some(li => li.textContent.includes(alvo))).toBe(true);
  });
  const li = [...lista.querySelectorAll('.autocomplete-item')].find(x => x.textContent.includes(alvo));
  li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

const itens = () => [...document.querySelectorAll('#rec_itens .med-item')];
const nomeDoItem = el => el.querySelector('.med-nome');

async function escolherMedicamento(el, texto, alvo) {
  await digitarEEscolher(nomeDoItem(el), texto, alvo);
}

beforeEach(() => {
  localStorage.clear();
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
  vi.stubGlobal('confirm', vi.fn(() => true));
  guardar('clientes', CLIENTES);
  guardar('catalogo_medicamentos', CATALOGO);
  guardar('receitas', []);
});

describe('lista de receitas', () => {
  it('mostra paciente, medicamentos, médico (ou traço) e as ações, inclusive o PDF', async () => {
    guardar('receitas', [{
      id: 5, cliente_id: 1, cliente_nome: 'Igor Lemos', data_venda: '2026-10-30', medico_prescritor: null, observacoes: null,
      itens: [{ id: 50, medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '1023506630034' }, { id: 51, medicamento: 'AMOXICILINA 500 MG', rms: '1' }],
      medicamentos: 'ALPRAZOLAM 0,25 MG 30 CPRS; AMOXICILINA 500 MG',
    }]);
    const c = await montar();
    const linha = c.querySelector('tbody tr');
    expect(linha.textContent).toContain('Igor Lemos');
    expect(linha.textContent).toContain('ALPRAZOLAM 0,25 MG 30 CPRS');
    expect(linha.textContent).toContain('AMOXICILINA 500 MG');
    expect(linha.textContent).toContain('30/10/2026');
    expect(linha.textContent).toContain('—'); // sem médico
    expect(linha.querySelector('[data-acao="pdf"]')).not.toBeNull();
    expect(linha.querySelector('[data-acao="editar"]')).not.toBeNull();
    expect(linha.querySelector('[data-acao="excluir"]')).not.toBeNull();
  });

  it('com mais de 3 medicamentos mostra "+ N"', async () => {
    guardar('receitas', [{
      id: 5, cliente_id: 1, cliente_nome: 'Igor Lemos', data_venda: '2026-10-30',
      itens: [1, 2, 3, 4, 5].map(n => ({ id: n, medicamento: `MED ${n}`, rms: '' })),
    }]);
    const c = await montar();
    expect(c.querySelector('tbody').textContent).toContain('+ 2 medicamento(s)');
  });

  it('nomes são mostrados como texto, sem executar HTML', async () => {
    guardar('receitas', [{
      id: 5, cliente_id: 1, cliente_nome: '<img src=x onerror="window.__xss=1">', data_venda: '2026-10-30', medico_prescritor: '<b>Dr</b>',
      itens: [{ id: 1, medicamento: '<script>1</script>', rms: '"><i>' }],
    }]);
    const c = await montar();
    expect(c.querySelector('tbody img, tbody b, tbody script, tbody i')).toBeNull();
    expect(c.textContent).toContain('<img src=x');
  });

  it('receita antiga (só com resumo de texto) continua aparecendo', async () => {
    guardar('receitas', [{ id: 5, cliente_id: 1, cliente_nome: 'Igor Lemos', data_venda: '2026-10-30', medicamentos: 'Dipirona 500mg' }]);
    const c = await montar();
    expect(c.querySelector('tbody').textContent).toContain('Dipirona 500mg');
  });
});

describe('nova receita', () => {
  it('abre com um bloco de medicamento e sem paciente, no formato da ficha', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    expect(campo('tituloModalReceita').textContent).toBe('Nova Receita');
    expect(itens()).toHaveLength(1);
    expect(cartao().hidden).toBe(true);
    for (const seletor of ['.med-nome', '.med-dose', '.med-posologia', '.med-rms', '.med-lote', '.med-validade', '.med-laboratorio', '.med-quant']) {
      expect(itens()[0].querySelector(seletor), seletor).not.toBeNull();
    }
    expect(campo('rec_medico').required).toBe(false);          // médico é opcional
    expect(campo('btnSalvarImprimirReceita').textContent).toBe('Salvar e imprimir');
    expect(itens()[0].querySelector('.med-dose').placeholder).toContain('opcional');
  });

  it('escolher o paciente mostra o cartão com os dados; o "x" desfaz', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');

    const card = cartao();
    expect(card.hidden).toBe(false);
    for (const dado of ['Igor Lemos', '123.456.789-00', '36452718', '01/10/1999', '(79) 98845-3518']) expect(card.textContent).toContain(dado);
    expect(campo('rec_paciente').readOnly).toBe(true);

    cartao().querySelector('[data-trocar]').click();
    expect(card.hidden).toBe(true);
    expect(campo('rec_paciente').value).toBe('');
    expect(campo('rec_paciente').readOnly).toBe(false);
  });

  it('escolher o medicamento puxa RMS e laboratório (editáveis); desativados não aparecem', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    const item = itens()[0];

    nomeDoItem(item).focus();
    nomeDoItem(item).dispatchEvent(new Event('input', { bubbles: true }));
    const lista = nomeDoItem(item).parentElement.querySelector('.autocomplete-lista');
    await vi.waitFor(() => expect(lista.hidden).toBe(false));
    expect(lista.textContent).not.toContain('CLONAZEPAM');   // desativado

    await escolherMedicamento(item, 'alprazol', 'ALPRAZOLAM');
    expect(nomeDoItem(item).value).toBe('ALPRAZOLAM 0,25 MG 30 CPRS');
    expect(item.querySelector('.med-rms').value).toBe('1023506630034');
    expect(item.querySelector('.med-laboratorio').value).toBe('EMS INDUSTRIA FARMACEUTICA LTDA');
    expect(item.querySelector('.med-rms').readOnly).toBe(false);
    expect(item.querySelector('.med-laboratorio').readOnly).toBe(false);
  });

  it('buscar também funciona pelo RMS ou pelo laboratório', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await escolherMedicamento(itens()[0], '1256801470025', 'AMOXICILINA');
    expect(nomeDoItem(itens()[0]).value).toBe('AMOXICILINA 500 MG CX 21 COMP.');
  });

  it('apagar ou trocar o texto desfaz a escolha e limpa RMS e laboratório', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    const item = itens()[0];
    await escolherMedicamento(item, 'alprazol', 'ALPRAZOLAM');
    nomeDoItem(item).value = 'ALPRAZOLAM 0,25 MG 30 CPRS x';
    nomeDoItem(item).dispatchEvent(new Event('input', { bubbles: true }));
    expect(item.querySelector('.med-rms').value).toBe('');
    expect(item.querySelector('.med-laboratorio').value).toBe('');
    expect(nomeDoItem(item).classList.contains('invalido')).toBe(false);   // ainda digitando: não pisca vermelho

    nomeDoItem(item).dispatchEvent(new Event('blur'));                      // saiu do campo com nome inexistente
    await vi.waitFor(() => expect(nomeDoItem(item).classList.contains('invalido')).toBe(true));

    await escolherMedicamento(item, 'alprazol', 'ALPRAZOLAM');              // escolher na lista limpa o aviso
    nomeDoItem(item).dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 200));
    expect(nomeDoItem(item).classList.contains('invalido')).toBe(false);
  });

  it('o botão + adiciona mais medicamentos e o lixo remove (o último não pode ser removido)', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    expect(itens()[0].querySelector('.med-remover').hidden).toBe(true);

    campo('btnAdicionarMedicamento').click();
    campo('btnAdicionarMedicamento').click();
    expect(itens()).toHaveLength(3);
    expect(itens()[0].querySelector('.med-remover').hidden).toBe(false);

    itens()[1].querySelector('.med-remover').click();
    expect(itens()).toHaveLength(2);
    itens()[1].querySelector('.med-remover').click();
    expect(itens()).toHaveLength(1);
    expect(itens()[0].querySelector('.med-remover').hidden).toBe(true);
  });

  it('limita a 12 medicamentos', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    for (let i = 0; i < 20; i++) if (!campo('btnAdicionarMedicamento').disabled) campo('btnAdicionarMedicamento').click();
    expect(itens()).toHaveLength(12);
    expect(campo('btnAdicionarMedicamento').disabled).toBe(true);
    itens()[0].querySelector('.med-remover').click();
    expect(campo('btnAdicionarMedicamento').disabled).toBe(false);
  });

  it('salva uma receita com dois medicamentos, copiando RMS e laboratório do catálogo', async () => {
    const c = await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    campo('rec_medico').value = 'Dr. Carlos — CRM-SE 123';
    campo('rec_obs').value = 'Tomar com água';

    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    itens()[0].querySelector('.med-dose').value = '0,25 mg';
    itens()[0].querySelector('.med-posologia').value = '1 comprimido à noite';
    itens()[0].querySelector('.med-lote').value = '4Q6312';
    itens()[0].querySelector('.med-validade').value = '02/2027';
    itens()[0].querySelector('.med-quant').value = '2';

    campo('btnAdicionarMedicamento').click();
    await escolherMedicamento(itens()[1], 'amoxi', 'AMOXICILINA');
    itens()[1].querySelector('.med-quant').value = '1';

    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));

    const r = ler('receitas')[0];
    expect(r).toMatchObject({ cliente_id: 1, cliente_nome: 'Igor Lemos', medico_prescritor: 'Dr. Carlos — CRM-SE 123', observacoes: 'Tomar com água' });
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0]).toMatchObject({
      medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '1023506630034', laboratorio: 'EMS INDUSTRIA FARMACEUTICA LTDA',
      dose: '0,25 mg', posologia: '1 comprimido à noite', lote: '4Q6312', validade: '02/2027', quantidade: 2,
    });
    expect(r.itens[1]).toMatchObject({ medicamento: 'AMOXICILINA 500 MG CX 21 COMP.', rms: '1256801470025', quantidade: 1 });
    expect(r.medicamentos).toBe('ALPRAZOLAM 0,25 MG 30 CPRS; AMOXICILINA 500 MG CX 21 COMP.');
    expect(baixarPdf).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(c.querySelector('tbody').textContent).toContain('ALPRAZOLAM'));
  });

  it('o médico é opcional', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'ana', 'Ana Souza');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
    expect(ler('receitas')[0].medico_prescritor).toBeNull();
  });

  it('"Salvar e imprimir" salva e entrega ao gerador a receita com os itens e os dados do paciente', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    campo('btnSalvarImprimirReceita').click();

    await vi.waitFor(() => expect(baixarPdf).toHaveBeenCalledOnce());
    const [receita, paciente] = baixarPdf.mock.calls[0];
    expect(ler('receitas')).toHaveLength(1);
    expect(receita.itens[0]).toMatchObject({ medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '1023506630034' });
    expect(paciente).toMatchObject({ nome: 'Igor Lemos', cpf: '123.456.789-00', rg: '36452718', telefone: '(79) 98845-3518' });
  });

  it('se o PDF falhar, a receita já está salva e o usuário é avisado', async () => {
    await montar();
    baixarPdf.mockRejectedValueOnce(new Error('sem memória'));
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    campo('btnSalvarImprimirReceita').click();
    await vi.waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toContain('receita foi salva');
    expect(ler('receitas')).toHaveLength(1);
  });

  it('não salva sem paciente', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    enviar('formReceita');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledWith('Escolha o paciente (ou cadastre um novo pela busca).'));
    expect(ler('receitas')).toEqual([]);
  });

  it('não salva medicamento digitado à mão, fora do catálogo, e diz qual linha', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    campo('btnAdicionarMedicamento').click();
    nomeDoItem(itens()[1]).value = 'REMÉDIO INVENTADO';
    nomeDoItem(itens()[1]).dispatchEvent(new Event('input', { bubbles: true }));
    enviar('formReceita');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toBe('Medicamento 2: escolha um medicamento da lista ou use "+ Cadastrar novo medicamento".');
    expect(ler('receitas')).toEqual([]);
  });

  it('digitar o nome exato de um medicamento do catálogo também vale (sem clicar na lista)', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    nomeDoItem(itens()[0]).value = 'alprazolam  0,25 mg 30 cprs';
    nomeDoItem(itens()[0]).dispatchEvent(new Event('input', { bubbles: true }));
    expect(itens()[0].querySelector('.med-rms').value).toBe('1023506630034');
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
  });

  it('recusa quantidade que não é número inteiro', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    itens()[0].querySelector('.med-quant').value = '1.5';
    enviar('formReceita');
    await new Promise(r => setTimeout(r, 30));
    expect(ler('receitas')).toEqual([]);
  });

  it('catálogo vazio orienta a cadastrar o medicamento na hora', async () => {
    guardar('catalogo_medicamentos', []);
    await montar();
    campo('btnAbrirModalReceita').click();
    expect(campo('rec_dica_catalogo').textContent).toContain('+ Cadastrar novo medicamento');
    expect(campo('btnSalvarReceita').disabled).toBe(false);
  });
});

describe('editar, excluir e PDF da lista', () => {
  const RECEITA = {
    id: 5, cliente_id: 1, cliente_nome: 'Igor Lemos', data_venda: '2026-10-20', medico_prescritor: 'Dr. A', observacoes: 'Obs',
    itens: [
      { id: 50, medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '1023506630034', laboratorio: 'EMS INDUSTRIA FARMACEUTICA LTDA', dose: '0,25 mg', posologia: null, lote: 'L1', validade: '02/2027', quantidade: 1 },
    ],
    medicamentos: 'ALPRAZOLAM 0,25 MG 30 CPRS',
  };

  beforeEach(() => guardar('receitas', [RECEITA]));

  it('abre preenchida, com o paciente travado (sem "x")', async () => {
    const c = await montar();
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(cartao().hidden).toBe(false));

    expect(campo('tituloModalReceita').textContent).toBe('Editar Receita');
    expect(cartao().textContent).toContain('Igor Lemos');
    expect(cartao().querySelector('[data-trocar]')).toBeNull();
    expect(campo('rec_paciente').readOnly).toBe(true);
    expect(campo('rec_data').value).toBe('2026-10-20');
    expect(campo('rec_medico').value).toBe('Dr. A');
    expect(campo('rec_obs').value).toBe('Obs');
    expect(itens()).toHaveLength(1);
    expect(nomeDoItem(itens()[0]).value).toBe('ALPRAZOLAM 0,25 MG 30 CPRS');
    expect(itens()[0].querySelector('.med-rms').value).toBe('1023506630034');
    expect(itens()[0].querySelector('.med-lote').value).toBe('L1');
  });

  it('mantém a cópia original do medicamento mesmo que o catálogo tenha mudado, e permite acrescentar outro', async () => {
    // depois de emitida a receita, o catálogo mudou: RMS novo e medicamento desativado
    guardar('catalogo_medicamentos', [med(1, 'ALPRAZOLAM 0,25 MG 30 CPRS', '9999999999999', 'LAB NOVO', false), CATALOGO[1]]);
    const c = await montar();
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(cartao().hidden).toBe(false));

    expect(itens()[0].querySelector('.med-rms').value).toBe('1023506630034');            // cópia da época
    itens()[0].querySelector('.med-lote').value = 'L1-corrigido';
    campo('btnAdicionarMedicamento').click();
    await escolherMedicamento(itens()[1], 'amoxi', 'AMOXICILINA');
    enviar('formReceita');

    await vi.waitFor(() => expect(ler('receitas')[0].itens).toHaveLength(2));
    const [primeiro, segundo] = ler('receitas')[0].itens;
    expect(primeiro).toMatchObject({ id: 50, medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '1023506630034', laboratorio: 'EMS INDUSTRIA FARMACEUTICA LTDA', lote: 'L1-corrigido' });
    expect(segundo).toMatchObject({ medicamento: 'AMOXICILINA 500 MG CX 21 COMP.', rms: '1256801470025' });
    expect(ler('receitas')[0].cliente_id).toBe(1);
  });

  it('trocar o medicamento de um item usa o novo do catálogo', async () => {
    const c = await montar();
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(cartao().hidden).toBe(false));
    await escolherMedicamento(itens()[0], 'amoxi', 'AMOXICILINA');
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')[0].itens[0].medicamento).toBe('AMOXICILINA 500 MG CX 21 COMP.'));
    expect(ler('receitas')[0].itens[0].rms).toBe('1256801470025');
  });

  it('apagar o médico e as observações grava vazio', async () => {
    const c = await montar();
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(cartao().hidden).toBe(false));
    campo('rec_medico').value = '';
    campo('rec_obs').value = '';
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')[0].medico_prescritor).toBeNull());
    expect(ler('receitas')[0].observacoes).toBeNull();
  });

  it('o botão "Nova Receita" depois de editar volta ao cadastro vazio', async () => {
    const c = await montar();
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(cartao().hidden).toBe(false));
    campo('btnAbrirModalReceita').click();
    await vi.waitFor(() => expect(campo('tituloModalReceita').textContent).toBe('Nova Receita'));
    expect(cartao().hidden).toBe(true);
    expect(campo('rec_medico').value).toBe('');
    expect(itens()).toHaveLength(1);
    expect(nomeDoItem(itens()[0]).value).toBe('');
  });

  it('exclui após confirmação', async () => {
    const c = await montar();
    c.querySelector('[data-acao="excluir"]').click();
    expect(confirm).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(ler('receitas')).toEqual([]));
    await vi.waitFor(() => expect(c.textContent).toContain('Nenhuma receita registrada'));
  });

  it('o ícone de PDF da lista busca os dados do paciente e gera o PDF', async () => {
    const c = await montar();
    c.querySelector('[data-acao="pdf"]').click();
    await vi.waitFor(() => expect(baixarPdf).toHaveBeenCalledOnce());
    const [receita, paciente] = baixarPdf.mock.calls[0];
    expect(receita.id).toBe(5);
    expect(paciente).toMatchObject({ nome: 'Igor Lemos', cpf: '123.456.789-00' });
  });
});

// ───────────── feedback do cliente (nov/2026) ─────────────
describe('ajustes do atendimento de receitas', () => {
  const sobreposto = () => document.querySelector('.modal-overlay.modal-sobreposto');

  it('laboratório e RMS podem ser trocados na hora conforme a caixa entregue, sem mudar o catálogo', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'amoxi', 'AMOXICILINA');
    expect(itens()[0].querySelector('.med-laboratorio').value).toBe('PRATI,DONADUZZI &CIA LTDA');
    itens()[0].querySelector('.med-laboratorio').value = 'EUROFARMA';
    itens()[0].querySelector('.med-rms').value = '1004300990011';
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
    expect(ler('receitas')[0].itens[0]).toMatchObject({ medicamento: 'AMOXICILINA 500 MG CX 21 COMP.', laboratorio: 'EUROFARMA', rms: '1004300990011' });
    expect(ler('catalogo_medicamentos')[1].laboratorio).toBe('PRATI,DONADUZZI &CIA LTDA');
  });

  it('RMS com letras é recusado com aviso da linha', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'amoxi', 'AMOXICILINA');
    itens()[0].querySelector('.med-rms').value = '1,02E+12';
    enviar('formReceita');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledWith('Medicamento 1: o RMS deve ter só números.'));
  });

  it('dose e posologia ficam em branco quando o nome já traz a dosagem', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    expect(itens()[0].querySelector('.med-dose').placeholder).toBe('Dose (já no nome)');
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
    expect(ler('receitas')[0].itens[0]).toMatchObject({ dose: null, posologia: null });
  });

  it('"+ Cadastrar novo medicamento" cria no catálogo e já escolhe, sem perder o que foi digitado', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    campo('rec_medico').value = 'Dra. Paula';
    itens()[0].querySelector('.med-lote').value = 'LT9';

    await digitarEEscolher(nomeDoItem(itens()[0]), 'losartana 50 mg', '+ Cadastrar novo medicamento');
    expect(sobreposto()).not.toBeNull();
    expect(sobreposto().querySelector('#nm_descricao').value).toBe('LOSARTANA 50 MG');
    sobreposto().querySelector('#nm_rms').value = '1000000000001';
    sobreposto().querySelector('#nm_laboratorio').value = 'EMS';
    sobreposto().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => expect(nomeDoItem(itens()[0]).value).toBe('LOSARTANA 50 MG'));
    expect(itens()[0].querySelector('.med-rms').value).toBe('1000000000001');
    expect(itens()[0].querySelector('.med-lote').value).toBe('LT9');
    expect(campo('rec_medico').value).toBe('Dra. Paula');
    expect(ler('catalogo_medicamentos').some(m => m.descricao === 'LOSARTANA 50 MG')).toBe(true);

    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
    expect(ler('receitas')[0].itens[0]).toMatchObject({ medicamento: 'LOSARTANA 50 MG', lote: 'LT9', laboratorio: 'EMS' });
  });

  it('cadastrar um medicamento que já existe usa o existente (sem duplicar)', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(nomeDoItem(itens()[0]), 'zzz', '+ Cadastrar novo medicamento');
    sobreposto().querySelector('#nm_descricao').value = 'alprazolam 0,25 mg 30 cprs';
    sobreposto().querySelector('#nm_rms').value = '1023506630034';
    sobreposto().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(nomeDoItem(itens()[0]).value).toBe('ALPRAZOLAM 0,25 MG 30 CPRS'));
    expect(ler('catalogo_medicamentos')).toHaveLength(3);
  });

  it('o alerta de alergia do paciente aparece em destaque', async () => {
    guardar('clientes', [{ ...CLIENTES[0], alergia: 'Dipirona e penicilina' }, CLIENTES[1]]);
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    const alerta = cartao().querySelector('.alerta-alergia');
    expect(alerta).not.toBeNull();
    expect(alerta.getAttribute('role')).toBe('alert');
    expect(alerta.textContent).toContain('Dipirona e penicilina');
  });
});

describe('farmacêutico responsável (vem do cadastro de usuários)', () => {
  const usuario = (id, nome, extra = {}) => ({ id, nome, email: `${id}@x.com`, perfil: 'funcionario', modulos: ['receitas'], ativo: true, criado_em: '2026-10-01', ...extra });

  async function salvarComPaciente() {
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    enviar('formReceita');
  }

  it('o farmacêutico logado assina a própria receita', async () => {
    guardar('usuarios', [
      usuario(1, 'Ana Farmacêutica', { farmaceutico: true, registro_profissional: 'CRF-SE 1', cargo: 'Farmacêutica Responsável' }),
      usuario(2, 'Bruno Farmacêutico', { farmaceutico: true, registro_profissional: 'CRF-SE 2' }),
    ]);
    localStorage.setItem('fc_demo_sessao', '2');
    await montar();
    campo('btnAbrirModalReceita').click();
    expect(campo('rec_farmaceutico').value).toBe('2');
    await salvarComPaciente();
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
    expect(ler('receitas')[0].farmaceutico).toMatchObject({ nome: 'Bruno Farmacêutico', registro_profissional: 'CRF-SE 2' });
  });

  it('atendente com vários farmacêuticos precisa escolher o do turno', async () => {
    guardar('usuarios', [
      usuario(1, 'Ana Farmacêutica', { farmaceutico: true, registro_profissional: 'CRF-SE 1' }),
      usuario(2, 'Bruno Farmacêutico', { farmaceutico: true, registro_profissional: 'CRF-SE 2' }),
      usuario(3, 'Carla Atendente'),
    ]);
    localStorage.setItem('fc_demo_sessao', '3');
    await montar();
    campo('btnAbrirModalReceita').click();
    expect(campo('rec_farmaceutico').value).toBe('');
    expect(campo('rec_farmaceutico').textContent).toContain('CRF-SE 1');
    await salvarComPaciente();
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledWith('Selecione o farmacêutico responsável.'));
    campo('rec_farmaceutico').value = '1';
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
    expect(ler('receitas')[0].farmaceutico.nome).toBe('Ana Farmacêutica');
  });

  it('sem farmacêutico cadastrado, avisa que a ficha sai em branco para assinatura', async () => {
    guardar('usuarios', [usuario(3, 'Carla Atendente')]);
    localStorage.setItem('fc_demo_sessao', '3');
    await montar();
    campo('btnAbrirModalReceita').click();
    expect(campo('rec_farmaceutico').tagName).toBe('P');
    expect(campo('rec_farmaceutico').textContent).toContain('em branco');
    await salvarComPaciente();
    await vi.waitFor(() => expect(ler('receitas')).toHaveLength(1));
    expect(ler('receitas')[0].farmaceutico).toBeNull();
  });
});

describe('nomeTemDosagem', () => {
  it('reconhece a dosagem no nome comercial', async () => {
    const { nomeTemDosagem } = await import('../src/js/views/receitas.js');
    for (const nome of ['ALPRAZOLAM 0,25 MG', 'Dipirona 500mg/mL', 'AMOXICILINA 500MG', 'Insulina 100 UI', 'Minoxidil 5%']) expect(nomeTemDosagem(nome), nome).toBe(true);
    for (const nome of ['SORO FISIOLÓGICO', 'POMADA X', '']) expect(nomeTemDosagem(nome), nome).toBe(false);
  });
});
