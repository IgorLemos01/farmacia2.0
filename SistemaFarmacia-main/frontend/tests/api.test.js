import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function carregarApi(apiUrl) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', apiUrl);
  return import('../src/js/api.js');
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('modo demonstração (sem VITE_API_URL)', () => {
  it('usa dados fictícios e não chama a rede', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { api, MODO_DEMO } = await carregarApi('');

    expect(MODO_DEMO).toBe(true);
    expect((await api.listarClientes()).length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('impede CPF duplicado', async () => {
    const { api } = await carregarApi('');
    const [primeiro] = await api.listarClientes();
    await expect(api.cadastrarCliente({ ...primeiro, id: undefined })).rejects.toThrow('CPF');
  });
});

describe('modo API (com VITE_API_URL)', () => {
  it('envia o token e devolve os itens', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ itens: [{ id: 1 }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const { api, sessao } = await carregarApi('https://api.exemplo.com/api/');
    sessao.salvar('tok123', { nome: 'Ana' });

    expect(await api.listarClientes('ana')).toEqual([{ id: 1 }]);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.exemplo.com/api/clientes?q=ana');
    expect(opts.headers.Authorization).toBe('Bearer tok123');
  });

  it('não cai para dados fictícios quando o servidor falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { api } = await carregarApi('https://api.exemplo.com/api');
    await expect(api.listarClientes()).rejects.toThrow('Não foi possível conectar');
  });

  it('repassa a mensagem de erro do backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Já existe um cliente cadastrado com o CPF 1.' }), { status: 400 }),
    ));
    const { api } = await carregarApi('https://api.exemplo.com/api');
    await expect(api.cadastrarCliente({})).rejects.toThrow('Já existe um cliente');
  });

  it('em 401 limpa a sessão e avisa o app para pedir login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: 'Token has expired' }), { status: 401 })));
    const { api, sessao } = await carregarApi('https://api.exemplo.com/api');
    sessao.salvar('expirado', { nome: 'Ana' });
    const ouvinte = vi.fn();
    window.addEventListener('fc:sessao-expirada', ouvinte);

    await expect(api.listarExames()).rejects.toThrow('Token has expired');
    expect(sessao.token()).toBeNull();
    expect(ouvinte).toHaveBeenCalledOnce();
    window.removeEventListener('fc:sessao-expirada', ouvinte);
  });

  it('login guarda token e usuário', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ access_token: 'novo', usuario: { nome: 'Ana', perfil: 'admin' } }), { status: 200 },
    )));
    const { api, sessao } = await carregarApi('https://api.exemplo.com/api');
    await api.login('ana@x.com', 'senha123');
    expect(sessao.token()).toBe('novo');
    expect(sessao.usuario().nome).toBe('Ana');
  });
});

describe('erros de validação', () => {
  it('inclui os campos inválidos na mensagem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Input payload validation failed', errors: { cpf: "'cpf' is a required property" } }),
      { status: 400 },
    )));
    const { api } = await carregarApi('https://api.exemplo.com/api');
    await expect(api.cadastrarCliente({})).rejects.toThrow("cpf ('cpf' is a required property)");
  });
});
