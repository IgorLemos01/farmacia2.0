// ============================================================
//  PÁGINA DE LOGIN — entre a landing page e o sistema
//
//  Com a API configurada (VITE_API_URL): e-mail e senha.
//  Em modo demonstração: escolhe-se um usuário fictício (não há senha).
// ============================================================

import { api, sessao, MODO_DEMO } from './api.js';
import { PERFIS, rotulosDosModulos } from './permissoes.js';

export const DESTINO = 'sistema.html';

/**
 * Liga a página de login.
 *
 * @param {object}   [opcoes]
 * @param {(destino:string)=>void} [opcoes.irPara]  Como navegar (injetável nos testes).
 * @param {string}   [opcoes.busca]  Query string da página (para o aviso de sessão expirada).
 */
export function iniciarLogin({ irPara = destino => window.location.replace(destino), busca = window.location.search } = {}) {
  const $ = id => document.getElementById(id);

  // Quem já está logado vai direto para o sistema (se a sessão estiver vencida, o sistema devolve para cá)
  if (sessao.autenticado()) {
    irPara(DESTINO);
    return;
  }

  const form = $('formLogin');
  const botao = $('btnEntrar');
  const erro = $('loginErro');

  const mostrarErro = (mensagem) => { erro.textContent = mensagem; erro.hidden = false; };
  const limparErro = () => { erro.textContent = ''; erro.hidden = true; };
  const ocupado = (sim) => {
    botao.disabled = sim;
    botao.textContent = sim ? 'Entrando…' : 'Entrar';
  };

  if (new URLSearchParams(busca).get('expirou')) {
    const aviso = $('avisoSessao');
    aviso.textContent = 'Sua sessão terminou. Entre novamente para continuar.';
    aviso.hidden = false;
  }

  // ── Modo demonstração: escolher o usuário fictício ──
  if (MODO_DEMO) {
    $('avisoDemo').hidden = false;
    $('camposApi').hidden = true;
    $('camposDemo').hidden = false;

    const select = $('login_demo');
    api.usuariosDaDemonstracao().forEach(u => {
      const opcao = document.createElement('option');
      opcao.value = String(u.id);
      const acessos = u.perfil === 'admin' ? 'todos os módulos' : rotulosDosModulos(u).join(', ');
      opcao.textContent = `${u.nome} — ${PERFIS[u.perfil]} (${acessos})`;
      select.appendChild(opcao);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      limparErro();
      try {
        api.entrarNaDemonstracao(select.value);
        irPara(DESTINO);
      } catch (err) {
        mostrarErro(err.message);
      }
    });
    select.focus();
    return;
  }

  // ── Com a API: e-mail e senha ──
  const campoEmail = $('login_email');
  const campoSenha = $('login_senha');
  const olho = $('btnMostrarSenha');

  olho.addEventListener('click', () => {
    const mostrar = campoSenha.type === 'password';
    campoSenha.type = mostrar ? 'text' : 'password';
    olho.setAttribute('aria-pressed', String(mostrar));
    olho.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    olho.title = mostrar ? 'Ocultar senha' : 'Mostrar senha';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErro();

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;
    if (!email || !senha) {
      mostrarErro('Informe o e-mail e a senha.');
      (email ? campoSenha : campoEmail).focus();
      return;
    }

    ocupado(true);
    try {
      await api.login(email, senha);
      irPara(DESTINO);
    } catch (err) {
      mostrarErro(err.message);
      campoSenha.value = '';
      campoSenha.focus();
      ocupado(false);
    }
  });

  campoEmail.focus();
}
