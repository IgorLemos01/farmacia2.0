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
  alerta = vi.fn();
  vi.stubGlobal('alert', alerta);
});

describe('Configurações — modo demonstração', () => {
  it('lista os usuários fictícios e avisa que é demonstração', async () => {
    const c = await montar();
    expect(c.textContent).toContain('Modo demonstração');
    expect(c.textContent).toContain('Administrador Demonstração');
    expect(c.textContent).toContain('Atendente Demonstração');
    expect(c.querySelectorAll('[data-acao="excluir"]')).toHaveLength(0); // usuários não são excluídos
  });

  it('cria usuário', async () => {
    const c = await montar();
    document.getElementById('btnAbrirModalUsuario').click();
    preencher('usr_nome', 'Carla Dias');
    preencher('usr_email', 'Carla@Farmacia.com');
    preencher('usr_senha', 'segredo1');
    preencher('usr_perfil', 'atendente');
    enviar('formUsuario');

    await vi.waitFor(() => expect(c.textContent).toContain('Carla Dias'));
    const criado = ler('usuarios').find(u => u.nome === 'Carla Dias');
    expect(criado).toMatchObject({ email: 'carla@farmacia.com', perfil: 'atendente', ativo: true });
    expect(criado.senha).toBeUndefined(); // senha nunca é guardada
  });

  it('recusa e-mail repetido e senha curta', async () => {
    await montar();
    document.getElementById('btnAbrirModalUsuario').click();
    preencher('usr_nome', 'Outro Admin');
    preencher('usr_email', 'admin@demo.com');
    preencher('usr_senha', 'segredo1');
    enviar('formUsuario');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledTimes(1));
    expect(alerta.mock.calls[0][0]).toContain('E-mail já cadastrado');

    preencher('usr_email', 'novo@demo.com');
    preencher('usr_senha', '123');
    enviar('formUsuario');
    await vi.waitFor(() => expect(alerta).toHaveBeenCalledTimes(2));
    expect(alerta.mock.calls[1][0]).toContain('pelo menos 6');
  });

  it('edita perfil e desativa o acesso', async () => {
    const c = await montar();
    c.querySelectorAll('[data-acao="editar"]')[1].click(); // Atendente
    expect(document.getElementById('tituloModalUsuario').textContent).toBe('Editar Usuário');
    expect(document.getElementById('usr_email').disabled).toBe(true);
    expect(document.getElementById('usr_senha').required).toBe(false);

    preencher('usr_perfil', 'admin');
    document.getElementById('usr_ativo').checked = false;
    enviar('formUsuario');

    await vi.waitFor(() => expect(c.textContent).toContain('Desativado'));
    expect(ler('usuarios')[1]).toMatchObject({ perfil: 'admin', ativo: false });
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
  it('atendente vê "Acesso restrito" e nenhuma chamada é feita', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com/api');
    const { sessao } = await import('../src/js/api.js');
    sessao.salvar('tok', { id: 2, nome: 'Bia', perfil: 'atendente' });
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
    sessao.salvar('tok', { id: 1, nome: 'Leandro Couto', perfil: 'admin' });
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
