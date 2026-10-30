import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
const ler = chave => JSON.parse(localStorage.getItem('fc_demo_' + chave));
const enviar = id => document.getElementById(id).dispatchEvent(new Event('submit', { cancelable: true }));
const digitar = (id, valor) => {
  const el = document.getElementById(id);
  el.value = valor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const exame = (id, nome, valor, ativo = true) => ({ id, nome, valor, ativo, criado_em: '2026-10-01T09:00:00', atualizado_em: '2026-10-01T09:00:00' });
const CLIENTE = { id: 1, nome: 'Ana Souza', cpf: '1', rg: '1', telefone: '1', email: 'a@a', endereco: 'R', sexo: 'F', data_nascimento: '2000-01-01' };

async function montar(arquivo, funcao, ...args) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  const modulo = await import(arquivo);
  document.body.innerHTML = '<div id="c"></div>';
  const container = document.getElementById('c');
  await modulo[funcao](container, ...args);
  return container;
}

/** Simula o usuário escolhendo um arquivo no <input type="file">. */
async function escolherArquivo(conteudo, nome = 'exames.csv') {
  const bytes = typeof conteudo === 'string' ? new TextEncoder().encode(conteudo) : new Uint8Array(conteudo);
  const arquivo = { name: nome, size: bytes.length, arrayBuffer: async () => bytes.buffer };
  const input = document.getElementById('arquivoImportar');
  Object.defineProperty(input, 'files', { value: [arquivo], configurable: true });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(document.getElementById('resumoImportar').textContent.trim()).not.toBe(''));
}

let alerta;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('fc_demo_sessao', '1'); // entrou como o administrador da demonstração
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
  vi.stubGlobal('confirm', vi.fn(() => true));
  guardar('catalogo_exames', [exame(1, 'Hemograma COMPLETO', 13), exame(2, 'Glicemia EM JEJUM', 7), exame(3, 'Antigo', 5, false)]);
});

describe('Catálogo de Exames (tela do administrador)', () => {
  it('lista os exames com valor em reais e esconde os desativados', async () => {
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    expect(c.textContent).toContain('2 exame(s) disponível(is)');
    expect(c.textContent).toMatch(/R\$\s13,00/);
    expect(c.querySelector('tr[data-busca*="antigo"]').hidden).toBe(true);

    document.getElementById('mostrarInativos').click();
    expect(c.querySelector('tr[data-busca*="antigo"]').hidden).toBe(false);
  });

  it('busca ignorando maiúsculas e acentos', async () => {
    guardar('catalogo_exames', [exame(1, 'Sumário de urina', 9), exame(2, 'TSH', 13)]);
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    digitar('buscaCatalogo', 'SUMARIO');
    const visiveis = [...c.querySelectorAll('tr[data-busca]')].filter(tr => !tr.hidden).map(tr => tr.textContent);
    expect(visiveis).toHaveLength(1);
    expect(visiveis[0]).toContain('Sumário de urina');

    digitar('buscaCatalogo', 'nada disso');
    expect(document.getElementById('semResultadoCatalogo').hidden).toBe(false);
  });

  it('adiciona exame', async () => {
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    document.getElementById('btnNovoCatalogo').click();
    document.getElementById('cat_nome').value = '  T4   Livre ';
    document.getElementById('cat_valor').value = '15.5';
    enviar('formCatalogo');
    await vi.waitFor(() => expect(c.textContent).toContain('T4 Livre'));
    expect(ler('catalogo_exames').find(e => e.nome === 'T4 Livre')).toMatchObject({ valor: 15.5, ativo: true });
  });

  it('recusa nome repetido (ignorando maiúsculas) e explica', async () => {
    await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    document.getElementById('btnNovoCatalogo').click();
    document.getElementById('cat_nome').value = 'hemograma completo';
    document.getElementById('cat_valor').value = '1';
    enviar('formCatalogo');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(alerta.mock.calls[0][0]).toContain('Já existe');
    expect(ler('catalogo_exames')).toHaveLength(3);
  });

  it('edita nome e valor mantendo o mesmo registro', async () => {
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    c.querySelector('tr[data-busca*="hemograma"] [data-acao="editar"]').click();
    expect(document.getElementById('cat_nome').value).toBe('Hemograma COMPLETO');
    expect(document.getElementById('cat_valor').value).toBe('13');
    document.getElementById('cat_valor').value = '15';
    enviar('formCatalogo');
    await vi.waitFor(() => expect(c.textContent).toMatch(/R\$\s15,00/));
    expect(ler('catalogo_exames').find(e => e.id === 1).valor).toBe(15);
  });

  it('"remover" apenas desativa, e dá para reativar', async () => {
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    c.querySelector('tr[data-busca*="hemograma"] [data-acao="excluir"]').click();
    expect(confirm).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(ler('catalogo_exames').find(e => e.id === 1).ativo).toBe(false));
    expect(ler('catalogo_exames')).toHaveLength(3); // nada foi apagado

    await vi.waitFor(() => expect(c.textContent).toContain('1 exame(s) disponível(is)'));
    document.getElementById('mostrarInativos').click();
    c.querySelector('tr[data-busca*="hemograma"] [data-acao="reativar"]').click();
    await vi.waitFor(() => expect(ler('catalogo_exames').find(e => e.id === 1).ativo).toBe(true));
  });

  it('mostra nomes como texto, sem executar HTML', async () => {
    guardar('catalogo_exames', [exame(1, '<img src=x onerror="window.__xss=1">', 5)]);
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    expect(c.querySelector('tbody img')).toBeNull();
    expect(c.textContent).toContain('<img src=x');
  });

  it('catálogo vazio orienta o administrador', async () => {
    guardar('catalogo_exames', []);
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    expect(c.textContent).toContain('O catálogo está vazio');
  });
});

describe('Importar CSV', () => {
  it('mostra o resumo, importa e informa o que aconteceu', async () => {
    const c = await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    document.getElementById('btnImportarCatalogo').click();
    await escolherArquivo('Exame;Valor\nTSH;13,00\nHemograma COMPLETO;14,00\nGlicemia EM JEJUM;7,00\n;5\nRuim;abc\n');

    const resumo = document.getElementById('resumoImportar').textContent;
    expect(resumo).toContain('3 exame(s) prontos para importar');
    expect(resumo).toContain('2 linha(s) com problema');
    expect(resumo).toContain('Linha 5');
    expect(document.getElementById('btnConfirmarImportar').textContent).toBe('Importar 3 exame(s)');

    document.getElementById('btnConfirmarImportar').click();
    await vi.waitFor(() => expect(document.getElementById('resumoImportar').textContent).toContain('Importação concluída'));
    const resultado = document.getElementById('resumoImportar').textContent;
    expect(resultado).toMatch(/1 novo\(s\) · 1 com valor atualizado · 1 já estavam iguais/);

    const salvos = ler('catalogo_exames');
    expect(salvos.find(e => e.nome === 'TSH')).toMatchObject({ valor: 13, ativo: true });
    expect(salvos.find(e => e.id === 1).valor).toBe(14);   // valor atualizado
    expect(salvos).toHaveLength(4);                          // nada foi apagado

    document.getElementById('btnCancelarImportar').click();  // fechar recarrega a lista
    await vi.waitFor(() => expect(c.textContent).toContain('TSH'));
  });

  it('lê arquivo salvo pelo Excel do Windows (acentos em Windows-1252)', async () => {
    await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    document.getElementById('btnImportarCatalogo').click();
    const nome = [0x53, 0x75, 0x6d, 0xe1, 0x72, 0x69, 0x6f]; // "Sumário"
    const csv = [...new TextEncoder().encode('Exame;Valor\n'), ...nome, ...new TextEncoder().encode(';9\n')];
    await escolherArquivo(csv);
    document.getElementById('btnConfirmarImportar').click();
    await vi.waitFor(() => expect(ler('catalogo_exames').some(e => e.nome === 'Sumário')).toBe(true));
  });

  it('arquivo sem exames válidos não habilita a importação', async () => {
    await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    document.getElementById('btnImportarCatalogo').click();
    await escolherArquivo('Exame;Valor\n;;\nSem valor;\n');
    expect(document.getElementById('btnConfirmarImportar').disabled).toBe(true);
    expect(document.getElementById('resumoImportar').textContent).toContain('0');
  });

  it('recusa arquivo grande demais', async () => {
    await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    document.getElementById('btnImportarCatalogo').click();
    const input = document.getElementById('arquivoImportar');
    Object.defineProperty(input, 'files', { value: [{ name: 'x.csv', size: 5 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) }], configurable: true });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(document.getElementById('resumoImportar').textContent).toContain('grande demais'));
    expect(document.getElementById('btnConfirmarImportar').disabled).toBe(true);
  });
});

describe('Configurações: abas', () => {
  it('alterna entre Usuários e Catálogo de Exames', async () => {
    const c = await montar('../src/js/views/configuracoes.js', 'renderConfiguracoes');
    expect(c.textContent).toContain('Usuários do Sistema');

    c.querySelector('[data-aba="catalogo"]').click();
    await vi.waitFor(() => expect(c.textContent).toContain('Catálogo de Exames'));
    expect(c.querySelector('[data-aba="catalogo"]').classList.contains('active')).toBe(true);
    expect(c.textContent).toContain('Hemograma COMPLETO');
    expect(c.textContent).not.toContain('Usuários do Sistema');
  });
});

describe('Cadastro de exame usa o catálogo', () => {
  beforeEach(() => {
    guardar('clientes', [CLIENTE]);
    guardar('exames', []);
  });

  async function abrirFormulario() {
    const c = await montar('../src/js/views/exames.js', 'renderExames');
    document.getElementById('btnAbrirModalExame').click();
    return c;
  }

  it('escolher o exame preenche o valor (travado)', async () => {
    await abrirFormulario();
    expect(document.getElementById('exame_valor').readOnly).toBe(true);
    digitar('exame_tipo', 'hemograma completo');
    expect(document.getElementById('exame_valor').value).toMatch(/R\$\s13,00/);
    expect(document.getElementById('dicaExame').textContent).toBe('');
  });

  it('só oferece exames ativos na lista de escolha', async () => {
    await abrirFormulario();
    const opcoes = [...document.querySelectorAll('#listaCatalogoExames option')].map(o => o.value);
    expect(opcoes).toEqual(['Glicemia EM JEJUM', 'Hemograma COMPLETO']); // em ordem alfabética, sem o desativado "Antigo"
  });

  it('registra copiando nome e valor do catálogo', async () => {
    const c = await abrirFormulario();
    document.getElementById('exame_cliente_id').value = '1';
    digitar('exame_tipo', 'Glicemia EM JEJUM');
    enviar('formNovoExame');
    await vi.waitFor(() => expect(ler('exames')).toHaveLength(1));
    expect(ler('exames')[0]).toMatchObject({ tipo_exame: 'Glicemia EM JEJUM', valor: 7, cliente_id: 1 });
    await vi.waitFor(() => expect(c.textContent).toContain('Glicemia EM JEJUM'));
  });

  it('não deixa registrar exame digitado fora da lista', async () => {
    await abrirFormulario();
    document.getElementById('exame_cliente_id').value = '1';
    digitar('exame_tipo', 'Exame inventado');
    expect(document.getElementById('dicaExame').textContent).toContain('Escolha um exame da lista');
    expect(document.getElementById('exame_valor').value).toBe('');
    enviar('formNovoExame');
    await new Promise(r => setTimeout(r, 20));
    expect(alerta).toHaveBeenCalledWith('Escolha um exame da lista do catálogo.');
    expect(ler('exames')).toEqual([]);
  });

  it('na edição, exame e valor ficam travados e o preço antigo é mantido', async () => {
    guardar('exames', [{ id: 9, cliente_id: 1, cliente_nome: 'Ana Souza', tipo_exame: 'Hemograma', valor: 10, data: '2026-10-01', forma_pagamento: 'PIX', observacoes: null }]);
    const c = await montar('../src/js/views/exames.js', 'renderExames');
    c.querySelector('[data-acao="editar"]').click();
    expect(document.getElementById('exame_tipo').readOnly).toBe(true);
    expect(document.getElementById('exame_valor').value).toMatch(/R\$\s10,00/);   // preço da época, não o do catálogo (13)

    document.getElementById('exame_obs').value = 'Resultado normal';
    enviar('formNovoExame');
    await vi.waitFor(() => expect(ler('exames')[0].observacoes).toBe('Resultado normal'));
    expect(ler('exames')[0]).toMatchObject({ tipo_exame: 'Hemograma', valor: 10 });
  });

  it('catálogo vazio bloqueia o cadastro e orienta', async () => {
    guardar('catalogo_exames', []);
    await abrirFormulario();
    expect(document.getElementById('btnSalvarExame').disabled).toBe(true);
    expect(document.getElementById('dicaExame').textContent).toContain('Configurações → Catálogo de Exames');
  });
});

describe('nomes de uma letra', () => {
  it('aceita exame "K" na importação (modo demonstração)', async () => {
    guardar('catalogo_exames', []);
    await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    document.getElementById('btnImportarCatalogo').click();
    await escolherArquivo('Exame;Valor\nK;197\nMg;126\n');
    document.getElementById('btnConfirmarImportar').click();
    await vi.waitFor(() => expect(document.getElementById('resumoImportar').textContent).toContain('Importação concluída'));
    expect(ler('catalogo_exames').map(e => e.nome).sort()).toEqual(['K', 'Mg']);
    expect(document.getElementById('resumoImportar').textContent).toContain('2 novo(s)');
  });

  it('o aviso sobre sobrescrever valores aparece antes de importar', async () => {
    await montar('../src/js/views/catalogo.js', 'renderCatalogo');
    expect(document.getElementById('modalImportar').textContent).toContain('volta ao valor do arquivo');
  });
});
