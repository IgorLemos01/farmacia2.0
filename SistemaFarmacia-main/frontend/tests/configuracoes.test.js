import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
const ler = chave => JSON.parse(localStorage.getItem('fc_demo_' + chave));
const enviar = id => document.getElementById(id).dispatchEvent(new Event('submit', { cancelable: true }));
const preencher = (id, valor) => { document.getElementById(id).value = valor; };

async function montar(apiUrl = '') {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', apiUrl);
  const { renderConfiguracoes } = await import('../src/js/views/configuracoes.js');
  document.body.innerHTML = '<div id="c"></div>';
  const container = document.getElementById('c');
  await renderConfiguracoes(container);
  return container;
}

let alerta;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('fc_demo_sessao', '1'); // entrou como o administrador da demonstração
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
});

const marcados = () => [...document.querySelectorAll('input[name="usr_modulo"]')].filter(c => c.checked).map(c => c.value);
const marcar = (...chaves) => document.querySelectorAll('input[name="usr_modulo"]').forEach(c => { c.checked = chaves.includes(c.value); });

describe('Configurações — modo demonstração', () => {
  it('lista os usuários fictícios com perfil e acessos', async () => {
    const c = await montar();
    expect(c.textContent).toContain('Modo demonstração');
    expect(c.textContent).toContain('Administrador Demonstração');
    expect(c.textContent).toContain('Funcionário Demonstração');
    expect(c.textContent).toContain('Todos os módulos + Configurações');
    expect(c.querySelectorAll('[data-acao="excluir"]')).toHaveLength(0); // usuários não são excluídos
  });

  it('cria funcionário com os módulos escolhidos', async () => {
    const c = await montar();
    document.getElementById('btnAbrirModalUsuario').click();
    expect(marcados()).toEqual([]); // novo funcionário começa sem módulo
    preencher('usr_nome', 'Carla Dias');
    preencher('usr_email', 'Carla@Farmacia.com');
    preencher('usr_senha', 'segredo1');
    marcar('clientes', 'exames');
    enviar('formUsuario');

    await vi.waitFor(() => expect(c.textContent).toContain('Carla Dias'));
    const criado = ler('usuarios').find(u => u.nome === 'Carla Dias');
    expect(criado).toMatchObject({ email: 'carla@farmacia.com', perfil: 'funcionario', modulos: ['clientes', 'exames'], ativo: true });
    expect(criado.senha).toBeUndefined(); // senha nunca é guardada
  });

  it('administrador marca e trava todos os módulos', async () => {
    const c = await montar();
    document.getElementById('btnAbrirModalUsuario').click();
    preencher('usr_nome', 'Nova Admin');
    preencher('usr_email', 'nova@farmacia.com');
    preencher('usr_senha', 'segredo1');
    preencher('usr_perfil', 'admin');
    document.getElementById('usr_perfil').dispatchEvent(new Event('change'));
    expect(marcados()).toHaveLength(5);
    expect([...document.querySelectorAll('input[name="usr_modulo"]')].every(i => i.disabled)).toBe(true);

    enviar('formUsuario');
    await vi.waitFor(() => expect(c.textContent).toContain('Nova Admin'));
    expect(ler('usuarios').find(u => u.nome === 'Nova Admin')).toMatchObject({ perfil: 'admin' });
  });

  it('recusa funcionário sem módulo, e-mail repetido e senha curta, com aviso na janela', async () => {
    await montar();
    const erro = () => document.getElementById('erroUsuario');
    document.getElementById('btnAbrirModalUsuario').click();
    preencher('usr_nome', 'Outro Admin');
    preencher('usr_email', 'admin@demo.com');
    preencher('usr_senha', 'segredo1');
    enviar('formUsuario');
    expect(erro().hidden).toBe(false);
    expect(erro().textContent).toContain('ao menos um módulo');

    marcar('clientes');
    enviar('formUsuario');
    await vi.waitFor(() => expect(erro().textContent).toContain('E-mail já cadastrado'));

    preencher('usr_email', 'novo@demo.com');
    preencher('usr_senha', '123');
    enviar('formUsuario');
    expect(erro().textContent).toContain('pelo menos 6');
    expect(ler('usuarios') === null || !ler('usuarios').some(u => u.email === 'novo@demo.com')).toBe(true);
  });

  it('edita perfil, módulos e desativa o acesso', async () => {
    const c = await montar();
    c.querySelectorAll('[data-acao="editar"]')[1].click(); // Funcionário
    expect(document.getElementById('tituloModalUsuario').textContent).toBe('Editar Usuário');
    expect(document.getElementById('usr_email').disabled).toBe(true);
    expect(marcados()).toEqual(['clientes', 'exames', 'receitas']);

    marcar('dashboard', 'receitas');
    document.getElementById('usr_ativo').checked = false;
    enviar('formUsuario');

    await vi.waitFor(() => expect(c.textContent).toContain('Desativado'));
    expect(ler('usuarios')[1]).toMatchObject({ perfil: 'funcionario', modulos: ['dashboard', 'receitas'], ativo: false });
  });

  it('mostra nomes como texto, sem executar HTML', async () => {
    guardar('usuarios', [{ id: 1, nome: '<img src=x onerror="window.__xss=1">', email: '"><script>1</script>', perfil: 'admin', ativo: true }]);
    const c = await montar();
    expect(c.querySelector('tbody img')).toBeNull();
    expect(c.querySelector('tbody script')).toBeNull();
    expect(c.textContent).toContain('<img src=x');
  });
});

describe('Configurações — API real', () => {
  it('funcionário vê "Acesso restrito" e nenhuma chamada é feita', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com/api');
    const { sessao } = await import('../src/js/api.js');
    sessao.salvar('tok', { id: 2, nome: 'Bia', perfil: 'funcionario', modulos: ['clientes'] });
    const { renderConfiguracoes } = await import('../src/js/views/configuracoes.js');
    document.body.innerHTML = '<div id="c"></div>';
    const c = document.getElementById('c');
    await renderConfiguracoes(c);

    expect(c.textContent).toContain('Acesso restrito');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admin não pode mudar o próprio perfil nem se desativar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      itens: [{ id: 1, nome: 'Leandro Couto', email: 'l@c.com', perfil: 'admin', ativo: true, criado_em: '2026-10-01T10:00:00' }],
    }), { status: 200 })));
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com/api');
    const { sessao } = await import('../src/js/api.js');
    sessao.salvar('tok', { id: 1, nome: 'Leandro Couto', perfil: 'admin', modulos: [] });
    const { renderConfiguracoes } = await import('../src/js/views/configuracoes.js');
    document.body.innerHTML = '<div id="c"></div>';
    const c = document.getElementById('c');
    await renderConfiguracoes(c);

    expect(c.textContent).toContain('(você)');
    c.querySelector('[data-acao="editar"]').click();
    expect(document.getElementById('usr_perfil').disabled).toBe(true);
    expect(document.getElementById('usr_ativo').disabled).toBe(true);
    expect(document.getElementById('avisoProprioUsuario').style.display).toBe('');
  });
});
