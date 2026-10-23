// ============================================================
//  STATE MANAGEMENT SIMPLES E REATIVO
// ============================================================

export const state = {
  currentRoute: 'dashboard',
  searchTerm: '',
  currentUser: {
    nome: 'Igor Lemos',
    cargo: 'Farmacêutico Responsável',
    email: 'igor@farmaciacouto.com.br',
    avatar: '👨🏻‍⚕️',
  },
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  navigate(route) {
    this.currentRoute = route;
    this.notify();
  },

  setSearch(term) {
    this.searchTerm = term;
    this.notify();
  },

  notify() {
    this.listeners.forEach(fn => fn(this));
  },
};
