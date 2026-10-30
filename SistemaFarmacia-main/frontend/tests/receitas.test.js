import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
const ler = chave => JSON.parse(localStorage.getItem('fc_demo_' + chave));
const campo = id => document.getElementById(id);
const enviar = id => campo(id).dispatchEvent(new Event('submit', { cancelable: true }));

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
  vi.doMock('../src/js/pdf.js', async () => ({ ...(await vi.importActual('../src/js/pdf.js')), baixarPdfReceita: baixarPdf }));
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
    expect(campo('rec_paciente_card').hidden).toBe(true);
    for (const seletor of ['.med-nome', '.med-dose', '.med-posologia', '.med-rms', '.med-lote', '.med-validade', '.med-laboratorio', '.med-quant']) {
      expect(itens()[0].querySelector(seletor), seletor).not.toBeNull();
    }
    expect(campo('rec_medico').required).toBe(false);          // médico é opcional
    expect(campo('btnSalvarPdfReceita').textContent).toBe('Salvar e gerar PDF');
  });

  it('escolher o paciente mostra o cartão com os dados; o "x" desfaz', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');

    const cartao = campo('rec_paciente_card');
    expect(cartao.hidden).toBe(false);
    for (const dado of ['Igor Lemos', '123.456.789-00', '36452718', '01/10/1999', '(79) 98845-3518']) expect(cartao.textContent).toContain(dado);
    expect(campo('rec_paciente').readOnly).toBe(true);

    campo('rec_paciente_limpar').click();
    expect(cartao.hidden).toBe(true);
    expect(campo('rec_paciente').value).toBe('');
    expect(campo('rec_paciente').readOnly).toBe(false);
  });

  it('escolher o medicamento puxa RMS e laboratório (travados); desativados não aparecem', async () => {
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
    expect(item.querySelector('.med-rms').readOnly).toBe(true);
    expect(item.querySelector('.med-laboratorio').readOnly).toBe(true);
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

  it('"Salvar e gerar PDF" salva e entrega ao gerador a receita com os itens e os dados do paciente', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await digitarEEscolher(campo('rec_paciente'), 'igor', 'Igor Lemos');
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    campo('btnSalvarPdfReceita').click();

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
    campo('btnSalvarPdfReceita').click();
    await vi.waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toContain('receita foi salva');
    expect(ler('receitas')).toHaveLength(1);
  });

  it('não salva sem paciente', async () => {
    await montar();
    campo('btnAbrirModalReceita').click();
    await escolherMedicamento(itens()[0], 'alprazol', 'ALPRAZOLAM');
    enviar('formReceita');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledWith('Escolha o paciente.'));
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
    expect(alerta.mock.calls[0][0]).toBe('Medicamento 2: escolha um medicamento da lista do catálogo.');
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

  it('catálogo vazio avisa e bloqueia o cadastro', async () => {
    guardar('catalogo_medicamentos', []);
    await montar();
    campo('btnAbrirModalReceita').click();
    expect(campo('rec_dica_catalogo').textContent).toContain('Catálogo de Medicamentos');
    expect(campo('btnSalvarReceita').disabled).toBe(true);
    expect(campo('btnSalvarPdfReceita').disabled).toBe(true);
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
    await vi.waitFor(() => expect(campo('rec_paciente_card').hidden).toBe(false));

    expect(campo('tituloModalReceita').textContent).toBe('Editar Receita');
    expect(campo('rec_paciente_card').textContent).toContain('Igor Lemos');
    expect(campo('rec_paciente_limpar')).toBeNull();
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
    await vi.waitFor(() => expect(campo('rec_paciente_card').hidden).toBe(false));

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
    await vi.waitFor(() => expect(campo('rec_paciente_card').hidden).toBe(false));
    await escolherMedicamento(itens()[0], 'amoxi', 'AMOXICILINA');
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')[0].itens[0].medicamento).toBe('AMOXICILINA 500 MG CX 21 COMP.'));
    expect(ler('receitas')[0].itens[0].rms).toBe('1256801470025');
  });

  it('apagar o médico e as observações grava vazio', async () => {
    const c = await montar();
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(campo('rec_paciente_card').hidden).toBe(false));
    campo('rec_medico').value = '';
    campo('rec_obs').value = '';
    enviar('formReceita');
    await vi.waitFor(() => expect(ler('receitas')[0].medico_prescritor).toBeNull());
    expect(ler('receitas')[0].observacoes).toBeNull();
  });

  it('o botão "Nova Receita" depois de editar volta ao cadastro vazio', async () => {
    const c = await montar();
    c.querySelector('[data-acao="editar"]').click();
    await vi.waitFor(() => expect(campo('rec_paciente_card').hidden).toBe(false));
    campo('btnAbrirModalReceita').click();
    await vi.waitFor(() => expect(campo('tituloModalReceita').textContent).toBe('Nova Receita'));
    expect(campo('rec_paciente_card').hidden).toBe(true);
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
