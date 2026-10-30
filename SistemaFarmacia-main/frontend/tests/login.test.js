import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pagina = readFileSync(resolve(process.cwd(), 'login.html'), 'utf8');
const corpo = pagina.slice(pagina.indexOf('<body'), pagina.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');

async function montar({ apiUrl = '', busca = '' } = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', apiUrl);
  document.body.innerHTML = corpo;
  const irPara = vi.fn();
  const { iniciarLogin } = await import('../src/js/login.js');
  iniciarLogin({ irPara, busca });
  return { irPara };
}
const $ = id => document.getElementById(id);
const enviar = () => $('formLogin').dispatchEvent(new Event('submit', { cancelable: true }));

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

describe('Login — modo demonstração', () => {
  it('lista os usuários fictícios com perfil e acessos e entra sem senha', async () => {
    const { irPara } = await montar();
    expect($('avisoDemo').hidden).toBe(false);
    expect($('camposApi').hidden).toBe(true);
    const opcoes = [...$('login_demo').options].map(o => o.textContent);
    expect(opcoes[0]).toContain('Administrador');
    expect(opcoes.join('|')).toContain('Funcionário');

    $('login_demo').selectedIndex = 1;
    enviar();
    expect(irPara).toHaveBeenCalledWith('sistema.html');
    expect(localStorage.getItem('fc_demo_sessao')).toBe($('login_demo').value);
  });

  it('quem já entrou vai direto para o sistema', async () => {
    localStorage.setItem('fc_demo_sessao', '1');
    const { irPara } = await montar();
    expect(irPara).toHaveBeenCalledWith('sistema.html');
  });

  it('mostra o aviso de sessão expirada', async () => {
    await montar({ busca: '?expirou=1' });
    expect($('avisoSessao').hidden).toBe(false);
  });
});

describe('Login — com a API', () => {
  const API = 'https://api.exemplo.com/api';

  it('exige e-mail e senha antes de chamar a API', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const { irPara } = await montar({ apiUrl: API });
    enviar();
    expect($('loginErro').hidden).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(irPara).not.toHaveBeenCalled();
  });

  it('entra com credenciais válidas e guarda a sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'tok', usuario: { id: 1, nome: 'Ana', perfil: 'funcionario', modulos: ['clientes'] },
    }), { status: 200 })));
    const { irPara } = await montar({ apiUrl: API });
    $('login_email').value = 'ana@farmacia.com';
    $('login_senha').value = 'segredo1';
    enviar();
    await vi.waitFor(() => expect(irPara).toHaveBeenCalledWith('sistema.html'));
    expect(localStorage.getItem('fc_jwt_token')).toBeTruthy();
  });

  it('mostra o erro e limpa a senha quando as credenciais são recusadas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'E-mail ou senha incorretos.' }), { status: 401 })));
    const { irPara } = await montar({ apiUrl: API });
    $('login_email').value = 'ana@farmacia.com';
    $('login_senha').value = 'errada';
    enviar();
    await vi.waitFor(() => expect($('loginErro').hidden).toBe(false));
    expect($('loginErro').textContent).toContain('incorretos');
    expect($('login_senha').value).toBe('');
    expect($('btnEntrar').disabled).toBe(false);
    expect(irPara).not.toHaveBeenCalled();
  });

  it('botão do olho alterna a visibilidade da senha', async () => {
    await montar({ apiUrl: API });
    $('btnMostrarSenha').click();
    expect($('login_senha').type).toBe('text');
    $('btnMostrarSenha').click();
    expect($('login_senha').type).toBe('password');
  });
});
