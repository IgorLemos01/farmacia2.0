// ============================================================
//  API CLIENT — COMUNICAÇÃO COM O BACKEND FLASK
//
//  Com VITE_API_URL definida (frontend/.env), o sistema usa a API real
//  e exige login. Sem ela, roda em MODO DEMONSTRAÇÃO com dados fictícios
//  guardados só no navegador — nunca há "fallback" silencioso entre os dois.
// ============================================================

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const MODO_DEMO = !API_BASE_URL;
export const API_DOCS_URL = API_BASE_URL ? `${API_BASE_URL}/docs` : 'http://localhost:5000/api/docs';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ── Sessão (token JWT + usuário logado) ─────────────────────
const TOKEN_KEY = 'fc_jwt_token';
const USUARIO_KEY = 'fc_usuario';

const USUARIO_DEMO = { nome: 'Usuário Demonstração', perfil: 'demo' };

export const sessao = {
  token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  usuario() {
    if (MODO_DEMO) return USUARIO_DEMO;
    try {
      return JSON.parse(localStorage.getItem(USUARIO_KEY));
    } catch (_) {
      return null;
    }
  },
  salvar(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  },
  limpar() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
  },
};

async function request(path, { method = 'GET', body } = {}) {
  const token = sessao.token();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.', 0);
  }

  const data = await res.json().catch(() => null);

  if (res.status === 401 && path !== '/auth/login') {
    sessao.limpar();
    window.dispatchEvent(new CustomEvent('fc:sessao-expirada'));
  }
  if (!res.ok) {
    // flask-restx devolve { message, errors? }, flask-jwt-extended devolve { msg }
    let mensagem = data?.message || data?.msg || `Erro ${res.status} na requisição.`;
    if (data?.errors) {
      mensagem += ': ' + Object.entries(data.errors).map(([campo, erro]) => `${campo} (${erro})`).join('; ');
    }
    throw new ApiError(mensagem, res.status);
  }
  return data;
}

// ── Modo demonstração (dados fictícios no navegador) ────────
// Dados fictícios usados apenas no modo demonstração
const MOCK_DATA = {
  clientes: [
    {
      id: 1,
      nome: 'Mariana Ribeiro Costa',
      cpf: '123.456.789-01',
      rg: '1.234.567-SSP/SE',
      data_nascimento: '1992-04-18',
      sexo: 'F',
      telefone: '(79) 99882-1144',
      email: 'mariana.costa@email.com',
      endereco: 'Av. Beira Mar, 420 - 13 de Julho, Aracaju/SE',
      alergia: 'Dipirona e AAS',
      observacoes: 'Paciente prefere contato pelo WhatsApp pela manhã.',
      criado_em: '2026-10-15T10:30:00',
    },
    {
      id: 2,
      nome: 'Carlos Eduardo Santos',
      cpf: '234.567.890-12',
      rg: '2.345.678-SSP/SE',
      data_nascimento: '1985-08-25',
      sexo: 'M',
      telefone: '(79) 99123-4567',
      email: 'carlos.edu@email.com',
      endereco: 'Rua das Laranjeiras, 88 - Centro, Aracaju/SE',
      alergia: null,
      observacoes: 'Retira pedidos pessoalmente na filial Centro.',
      criado_em: '2026-10-18T14:15:00',
    },
    {
      id: 3,
      nome: 'Fernanda Albuquerque Lima',
      cpf: '345.678.901-23',
      rg: '3.456.789-SSP/SE',
      data_nascimento: '1998-11-03',
      sexo: 'F',
      telefone: '(79) 98765-4321',
      email: 'fernanda.lima@email.com',
      endereco: 'Rua Francisco Porto, 102 - Salgado Filho, Aracaju/SE',
      alergia: 'Penicilina e Sulfa',
      observacoes: 'Alergias graves a antibióticos da família betalactâmicos.',
      criado_em: '2026-10-20T09:00:00',
    },
  ],
  manipulacoes: [
    {
      id: 1,
      cliente_id: 1,
      cliente_nome: 'Mariana Ribeiro Costa',
      data: '2026-10-22',
      formula: 'Minoxidil 5%, Biotina 2mg, Loção Capilar qsp 60ml',
      prazo_entrega: '2026-10-24',
      valor: 89.90,
      forma_pagamento: 'PIX',
      observacoes: 'Uso tópico diário à noite.',
      criado_em: '2026-10-22T11:00:00',
    },
    {
      id: 2,
      cliente_id: 2,
      cliente_nome: 'Carlos Eduardo Santos',
      data: '2026-10-23',
      formula: 'Melatonina 3mg, Passiflora 150mg (60 cápsulas)',
      prazo_entrega: '2026-10-25',
      valor: 64.00,
      forma_pagamento: 'Cartão de Crédito',
      observacoes: 'Tomar 1 cápsula 30 min antes de dormir.',
      criado_em: '2026-10-23T08:30:00',
    },
  ],
  exames: [
    {
      id: 1,
      cliente_id: 1,
      cliente_nome: 'Mariana Ribeiro Costa',
      tipo_exame: 'Glicemia Capilar',
      data: '2026-10-20',
      valor: 20.00,
      forma_pagamento: 'PIX',
      observacoes: 'Em jejum. Resultado: 91 mg/dL (Dentro da faixa normal).',
      criado_em: '2026-10-20T09:30:00',
    },
    {
      id: 2,
      cliente_id: 3,
      cliente_nome: 'Fernanda Albuquerque Lima',
      tipo_exame: 'Aferição de Pressão Arterial & Perfil Lipídico',
      data: '2026-10-21',
      valor: 35.00,
      forma_pagamento: 'Dinheiro',
      observacoes: 'PA: 120x80 mmHg. Colesterol Total: 182 mg/dL.',
      criado_em: '2026-10-21T15:00:00',
    },
  ],
  receitas: [
    {
      id: 1,
      cliente_id: 1,
      cliente_nome: 'Mariana Ribeiro Costa',
      data_venda: '2026-10-22',
      medico_prescritor: 'Dra. Juliana Prado (CRM-SE 4589)',
      medicamentos: 'Loção Capilar Manipulada 60ml + Polivitamínico A-Z',
      criado_em: '2026-10-22T10:45:00',
    },
    {
      id: 2,
      cliente_id: 2,
      cliente_nome: 'Carlos Eduardo Santos',
      data_venda: '2026-10-23',
      medico_prescritor: 'Dr. Roberto Lemos (CRM-SE 3120)',
      medicamentos: 'Melatonina Composta 60 caps',
      criado_em: '2026-10-23T08:20:00',
    },
  ],
};

const demo = {
  ler(chave) {
    try {
      const v = localStorage.getItem('fc_demo_' + chave);
      if (v) return JSON.parse(v);
    } catch (_) {}
    return structuredClone(MOCK_DATA[chave]);
  },
  gravar(chave, lista) {
    try {
      localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
    } catch (_) {}
  },
  inserir(chave, dados) {
    const lista = demo.ler(chave);
    const novo = { id: Date.now(), ...dados, criado_em: new Date().toISOString() };
    lista.unshift(novo);
    demo.gravar(chave, lista);
    return novo;
  },
};

// Remove dados antigos gravados por versões anteriores (sem prefixo "demo").
['clientes', 'manipulacoes', 'exames', 'receitas'].forEach(k => {
  try { localStorage.removeItem('fc_' + k); } catch (_) {}
});

const comBusca = termo => (termo ? `?q=${encodeURIComponent(termo)}` : '');

export const api = {
  // --- Autenticação ---
  async login(email, senha) {
    const data = await request('/auth/login', { method: 'POST', body: { email, senha } });
    sessao.salvar(data.access_token, data.usuario);
    return data.usuario;
  },

  // --- Clientes ---
  async listarClientes(termo = '') {
    if (!MODO_DEMO) return (await request(`/clientes${comBusca(termo)}`)).itens || [];

    const lista = demo.ler('clientes');
    if (!termo) return lista;
    const q = termo.toLowerCase();
    return lista.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.cpf.includes(q) ||
      c.telefone.includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  },

  async cadastrarCliente(dados) {
    if (!MODO_DEMO) return (await request('/clientes', { method: 'POST', body: dados })).cliente;

    if (demo.ler('clientes').some(c => c.cpf === dados.cpf)) {
      throw new ApiError(`Já existe um cliente cadastrado com o CPF ${dados.cpf}.`, 400);
    }
    return demo.inserir('clientes', dados);
  },

  async obterDossieCliente(id) {
    if (!MODO_DEMO) return request(`/clientes/${encodeURIComponent(id)}/dossie`);

    const cliente = demo.ler('clientes').find(c => c.id == id);
    if (!cliente) throw new ApiError('Cliente não encontrado.', 404);
    const doCliente = chave => demo.ler(chave).filter(item => item.cliente_id == id);
    return {
      cliente,
      historico: {
        manipulacoes: doCliente('manipulacoes'),
        exames: doCliente('exames'),
        receitas: doCliente('receitas'),
      },
    };
  },

  // --- Manipulações ---
  async listarManipulacoes() {
    if (!MODO_DEMO) return (await request('/manipulacoes')).itens || [];
    return demo.ler('manipulacoes');
  },

  async cadastrarManipulacao(dados) {
    if (!MODO_DEMO) return (await request('/manipulacoes', { method: 'POST', body: dados })).manipulacao;
    return demo.inserir('manipulacoes', dados);
  },

  // --- Exames ---
  async listarExames() {
    if (!MODO_DEMO) return (await request('/exames')).itens || [];
    return demo.ler('exames');
  },

  async cadastrarExame(dados) {
    if (!MODO_DEMO) return (await request('/exames', { method: 'POST', body: dados })).exame;
    return demo.inserir('exames', dados);
  },

  // --- Receitas ---
  async listarReceitas() {
    if (!MODO_DEMO) return (await request('/receitas')).itens || [];
    return demo.ler('receitas');
  },

  async cadastrarReceita(dados) {
    if (!MODO_DEMO) return (await request('/receitas', { method: 'POST', body: dados })).receita;
    return demo.inserir('receitas', dados);
  },
};
