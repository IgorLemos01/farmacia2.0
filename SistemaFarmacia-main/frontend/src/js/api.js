// ============================================================
//  API CLIENT — COMUNICAÇÃO COM O BACKEND FLASK
// ============================================================

const API_BASE_URL = 'http://localhost:5000/api';

// Dados de demonstração ricos caso o backend não esteja ativo no momento
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

// Funções auxiliares para localStorage
function getStorage(key, defaultVal) {
  const v = localStorage.getItem('fc_' + key);
  return v ? JSON.parse(v) : defaultVal;
}

function setStorage(key, val) {
  localStorage.setItem('fc_' + key, JSON.stringify(val));
}

// Inicializa o mock no localStorage se necessário
if (!localStorage.getItem('fc_clientes')) setStorage('clientes', MOCK_DATA.clientes);
if (!localStorage.getItem('fc_manipulacoes')) setStorage('manipulacoes', MOCK_DATA.manipulacoes);
if (!localStorage.getItem('fc_exames')) setStorage('exames', MOCK_DATA.exames);
if (!localStorage.getItem('fc_receitas')) setStorage('receitas', MOCK_DATA.receitas);

export const api = {
  // --- Clientes ---
  async listarClientes(termo = '') {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const url = `${API_BASE_URL}/clientes${termo ? `?q=${encodeURIComponent(termo)}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        return data.itens || [];
      }
    } catch (_) {}

    // Fallback local
    const lista = getStorage('clientes', MOCK_DATA.clientes);
    if (!termo) return lista;
    const q = termo.toLowerCase();
    return lista.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.cpf.includes(q) ||
      c.telefone.includes(q)
    );
  },

  async cadastrarCliente(dados) {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dados),
      });
      if (res.ok) {
        const data = await res.json();
        return data.cliente;
      }
    } catch (_) {}

    // Fallback local
    const lista = getStorage('clientes', MOCK_DATA.clientes);
    const novo = {
      id: Date.now(),
      ...dados,
      criado_em: new Date().toISOString(),
    };
    lista.unshift(novo);
    setStorage('clientes', lista);
    return novo;
  },

  async obterDossieCliente(id) {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/clientes/${id}/dossie`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) return await res.json();
    } catch (_) {}

    // Fallback local
    const clientes = getStorage('clientes', MOCK_DATA.clientes);
    const cliente = clientes.find(c => c.id == id);
    const manipulacoes = getStorage('manipulacoes', MOCK_DATA.manipulacoes).filter(m => m.cliente_id == id);
    const exames = getStorage('exames', MOCK_DATA.exames).filter(e => e.cliente_id == id);
    const receitas = getStorage('receitas', MOCK_DATA.receitas).filter(r => r.cliente_id == id);

    return {
      cliente,
      historico: { manipulacoes, exames, receitas },
    };
  },

  // --- Manipulações ---
  async listarManipulacoes() {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/manipulacoes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        return data.itens || [];
      }
    } catch (_) {}
    return getStorage('manipulacoes', MOCK_DATA.manipulacoes);
  },

  async cadastrarManipulacao(dados) {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/manipulacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dados),
      });
      if (res.ok) {
        const data = await res.json();
        return data.manipulacao;
      }
    } catch (_) {}

    const lista = getStorage('manipulacoes', MOCK_DATA.manipulacoes);
    const novo = { id: Date.now(), ...dados, criado_em: new Date().toISOString() };
    lista.unshift(novo);
    setStorage('manipulacoes', lista);
    return novo;
  },

  // --- Exames ---
  async listarExames() {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/exames`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        return data.itens || [];
      }
    } catch (_) {}
    return getStorage('exames', MOCK_DATA.exames);
  },

  async cadastrarExame(dados) {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/exames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dados),
      });
      if (res.ok) {
        const data = await res.json();
        return data.exame;
      }
    } catch (_) {}

    const lista = getStorage('exames', MOCK_DATA.exames);
    const novo = { id: Date.now(), ...dados, criado_em: new Date().toISOString() };
    lista.unshift(novo);
    setStorage('exames', lista);
    return novo;
  },

  // --- Receitas ---
  async listarReceitas() {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/receitas`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        return data.itens || [];
      }
    } catch (_) {}
    return getStorage('receitas', MOCK_DATA.receitas);
  },

  async cadastrarReceita(dados) {
    try {
      const token = localStorage.getItem('fc_jwt_token');
      const res = await fetch(`${API_BASE_URL}/receitas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dados),
      });
      if (res.ok) {
        const data = await res.json();
        return data.receita;
      }
    } catch (_) {}

    const lista = getStorage('receitas', MOCK_DATA.receitas);
    const novo = { id: Date.now(), ...dados, criado_em: new Date().toISOString() };
    lista.unshift(novo);
    setStorage('receitas', lista);
    return novo;
  },
};
