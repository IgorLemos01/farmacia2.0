// ============================================================
//  STATE MANAGEMENT SIMPLES E REATIVO
// ============================================================

export const state = {
  currentRoute: 'dashboard',
  searchTerm: '',
  // Preenchido após o login (ou com o usuário fictício no modo demonstração)
  currentUser: null,
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
