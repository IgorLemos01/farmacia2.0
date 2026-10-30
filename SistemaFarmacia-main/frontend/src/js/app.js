// ============================================================
//  APP.JS — PONTO DE ENTRADA DO FRONTEND MINIMALISTA
// ============================================================

import { state } from './state.js';
import { api, sessao, MODO_DEMO, API_DOCS_URL } from './api.js';
import { escapeHtml } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { renderClientes } from './views/clientes.js';
import { renderManipulacoes } from './views/manipulacoes.js';
import { renderExames } from './views/exames.js';
import { renderReceitas } from './views/receitas.js';

const ROUTE_CONFIG = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Acompanhe métricas, atendimentos e desempenho em tempo real.',
    render: renderDashboard,
  },
  clientes: {
    title: 'Clientes & Pacientes',
    subtitle: 'Gestão completa com prontuário e histórico 360° unificado.',
    render: renderClientes,
  },
  manipulacoes: {
    title: 'Laboratório de Manipulação',
    subtitle: 'Controle de fórmulas, dosagens e prazos de entrega.',
    render: renderManipulacoes,
  },
  exames: {
    title: 'Exames & Procedimentos',
    subtitle: 'Acompanhamento clínico e exames rápidos realizados.',
    render: renderExames,
  },
  receitas: {
    title: 'Receituário Médico',
    subtitle: 'Registro de medicamentos prescritos e médicos responsáveis.',
    render: renderReceitas,
  },
};

class AppRouter {
  constructor() {
    this.mainContent = document.getElementById('mainContentArea');
    this.titleEl = document.getElementById('pageTitleText');
    this.subtitleEl = document.getElementById('pageSubtitleText');
    this.searchInput = document.getElementById('globalSearchInput');

    this.initEventListeners();
  }

  navigate(route) {
    if (!ROUTE_CONFIG[route]) route = 'dashboard';
    state.navigate(route);
  }

  renderCurrent() {
    const route = state.currentRoute;
    const config = ROUTE_CONFIG[route];

    // Atualiza cabeçalho
    if (this.titleEl) this.titleEl.textContent = config.title;
    if (this.subtitleEl) this.subtitleEl.textContent = config.subtitle;

    // Atualiza links da sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      const target = item.getAttribute('data-route');
      if (target === route) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Renderiza a view ativa; falhas da API viram uma mensagem na tela
    if (this.mainContent) {
      Promise.resolve(config.render(this.mainContent, state.searchTerm)).catch(err => {
        if (err.status === 401) return; // a tela de login já foi exibida
        this.mainContent.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <p style="font-weight: 700; color: var(--text-title); margin-bottom: 6px;">Não foi possível carregar os dados.</p>
            <p style="font-size: 0.85rem;">${escapeHtml(err.message)}</p>
          </div>`;
      });
    }
  }

  initEventListeners() {
    // Cliques na navegação
    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const route = el.getAttribute('data-route');
        this.navigate(route);
      });
    });

    // Campo de busca com debounce
    if (this.searchInput) {
      let timeout;
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          const term = e.target.value.trim();
          state.setSearch(term);
          // Se pesquisou e não está em clientes, navega para clientes
          if (term && state.currentRoute !== 'clientes') {
            this.navigate('clientes');
          } else if (state.currentRoute === 'clientes') {
            this.renderCurrent();
          }
        }, 250);
      });
    }

    // Atalho de teclado (Ctrl + K ou Cmd + F) para buscar
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        if (this.searchInput) {
          this.searchInput.focus();
          this.searchInput.select();
        }
      }
    });
  }
}

// ── Sessão / login ──────────────────────────────────────────
const PERFIS = { admin: 'Administrador', atendente: 'Atendente', demo: 'Dados fictícios' };

function exibirUsuario(usuario) {
  state.currentUser = usuario;
  document.getElementById('userNameText').textContent = usuario?.nome || '';
  document.getElementById('userRoleText').textContent = PERFIS[usuario?.perfil] || '';
}

function abrirLogin() {
  document.getElementById('modalLogin').classList.add('active');
  document.getElementById('login_email').focus();
}

function initSessao(router) {
  document.getElementById('linkAjudaApi').addEventListener('click', () => {
    window.open(API_DOCS_URL, '_blank', 'noopener');
  });

  if (MODO_DEMO) {
    document.getElementById('badgeModoDemo').style.display = '';
    exibirUsuario(sessao.usuario());
    router.renderCurrent();
    return;
  }

  // Clique no perfil encerra a sessão
  const badge = document.getElementById('userProfileBadge');
  badge.title = 'Sair do sistema';
  badge.addEventListener('click', () => {
    if (!confirm('Deseja sair do sistema?')) return;
    sessao.limpar();
    window.location.reload();
  });

  const form = document.getElementById('formLogin');
  const erroEl = document.getElementById('loginErro');
  const btn = document.getElementById('btnEntrar');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroEl.hidden = true;
    btn.disabled = true;
    try {
      const usuario = await api.login(
        document.getElementById('login_email').value.trim(),
        document.getElementById('login_senha').value,
      );
      form.reset();
      document.getElementById('modalLogin').classList.remove('active');
      exibirUsuario(usuario);
      router.renderCurrent();
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener('fc:sessao-expirada', () => {
    exibirUsuario(null);
    abrirLogin();
  });

  if (sessao.token()) {
    exibirUsuario(sessao.usuario());
    router.renderCurrent();
  } else {
    abrirLogin();
  }
}

// Inicializa a aplicação ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  const router = new AppRouter();
  window.appRouter = router;

  state.subscribe(() => {
    router.renderCurrent();
  });

  initSessao(router);
});
