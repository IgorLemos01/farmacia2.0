// ============================================================
//  API CLIENT — COMUNICAÇÃO COM O BACKEND FLASK
//
//  Com VITE_API_URL definida (frontend/.env), o sistema usa a API real
//  e exige login. Sem ela, roda em MODO DEMONSTRAÇÃO com dados fictícios
//  guardados só no navegador — nunca há "fallback" silencioso entre os dois.
// ============================================================

import { CHAVES_MODULOS } from './permissoes.js';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const MODO_DEMO = !API_BASE_URL;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ── Sessão (token JWT + usuário logado) ─────────────────────
const TOKEN_KEY = 'fc_jwt_token';
const USUARIO_KEY = 'fc_usuario';

const DEMO_SESSAO_KEY = 'fc_demo_sessao';

export const sessao = {
  token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  /** Usuário logado, ou null. Na demonstração é o usuário fictício escolhido na tela de entrada. */
  usuario() {
    if (MODO_DEMO) return demoSessaoUsuario();
    try {
      return JSON.parse(localStorage.getItem(USUARIO_KEY));
    } catch (_) {
      return null;
    }
  },
  autenticado() {
    return MODO_DEMO ? demoSessaoUsuario() !== null : !!localStorage.getItem(TOKEN_KEY);
  },
  salvar(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  },
  /** Atualiza só os dados do usuário (ex.: módulos mudados pelo administrador), mantendo o token. */
  guardarUsuario(usuario) {
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  },
  limpar() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    localStorage.removeItem(DEMO_SESSAO_KEY);
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
      observacoes: null,
      itens: [
        { id: 101, medicamento: 'ALPRAZOLAM 0,25 MG 30 CPRS', rms: '9000000000011', laboratorio: 'LAB DEMONSTRAÇÃO A', dose: '0,25 mg', posologia: '1 comprimido à noite', lote: 'DEMO01', validade: '02/2028', quantidade: 1 },
      ],
      medicamentos: 'ALPRAZOLAM 0,25 MG 30 CPRS',
      criado_em: '2026-10-22T10:45:00',
    },
    {
      id: 2,
      cliente_id: 2,
      cliente_nome: 'Carlos Eduardo Santos',
      data_venda: '2026-10-23',
      medico_prescritor: null,
      observacoes: 'Tomar com água.',
      itens: [
        { id: 102, medicamento: 'AMOXICILINA 500 MG CX 21 COMP.', rms: '9000000000028', laboratorio: 'LAB DEMONSTRAÇÃO B', dose: '500 mg', posologia: '1 comprimido de 8 em 8 horas', lote: 'DEMO02', validade: '05/2028', quantidade: 1 },
        { id: 103, medicamento: 'CLONAZEPAM 2 MG 30 COMP', rms: '9000000000035', laboratorio: 'LAB DEMONSTRAÇÃO A', dose: null, posologia: null, lote: 'DEMO03', validade: '09/2027', quantidade: 2 },
      ],
      medicamentos: 'AMOXICILINA 500 MG CX 21 COMP.; CLONAZEPAM 2 MG 30 COMP',
      criado_em: '2026-10-23T08:20:00',
    },
  ],
  // Amostra FICTÍCIA (RMS e laboratórios inventados): o site de demonstração é público.
  catalogo_medicamentos: [
    ['ALPRAZOLAM 0,25 MG 30 CPRS', '9000000000011', 'LAB DEMONSTRAÇÃO A'],
    ['AMOXICILINA 500 MG CX 21 COMP.', '9000000000028', 'LAB DEMONSTRAÇÃO B'],
    ['CLONAZEPAM 2 MG 30 COMP', '9000000000035', 'LAB DEMONSTRAÇÃO A'],
    ['PREGABALINA 75 MG 30 CÁPS', '9000000000042', 'LAB DEMONSTRAÇÃO C'],
    ['AMITRIPTILINA 25 MG 30 CPR', '9000000000059', 'LAB DEMONSTRAÇÃO B'],
    ['RISPERIDONA 1 MG/ML SOLUÇÃO', '9000000000066', 'LAB DEMONSTRAÇÃO C'],
  ].map(([descricao, rms, laboratorio], i) => ({
    id: i + 1, rms, descricao, laboratorio, ativo: true, criado_em: '2026-10-01T09:00:00', atualizado_em: '2026-10-01T09:00:00',
  })),
  catalogo_exames: [
    ['Glicemia em jejum', 10], ['Hemograma completo', 20], ['TSH', 25], ['Colesterol total e frações', 30],
    ['Triglicerídeos', 15], ['Ácido úrico', 12], ['Teste de gravidez', 18], ['Sumário de urina', 12],
  ].map(([nome, valor], i) => ({
    id: i + 1, nome, valor, ativo: true, criado_em: '2026-10-01T09:00:00', atualizado_em: '2026-10-01T09:00:00',
  })),
  usuarios: [
    {
      id: 1,
      nome: 'Administrador Demonstração',
      email: 'admin@demo.com',
      perfil: 'admin',
      modulos: CHAVES_MODULOS,
      ativo: true,
      criado_em: '2026-10-01T09:00:00',
    },
    {
      id: 2,
      nome: 'Funcionário Demonstração',
      email: 'funcionario@demo.com',
      perfil: 'funcionario',
      modulos: ['clientes', 'exames', 'receitas'],
      ativo: true,
      criado_em: '2026-10-05T14:30:00',
    },
  ],
};

/** Dados de versões antigas: perfil "atendente" vira "funcionario"; sem módulos, libera todos. */
function normalizarUsuarioDemo(u) {
  const perfil = u.perfil === 'admin' ? 'admin' : 'funcionario';
  const modulos = perfil === 'admin' || !Array.isArray(u.modulos)
    ? [...CHAVES_MODULOS]
    : CHAVES_MODULOS.filter(chave => u.modulos.includes(chave));
  return { ...u, perfil, modulos };
}

function demoSessaoUsuario() {
  const id = localStorage.getItem(DEMO_SESSAO_KEY);
  if (!id) return null;
  return demo.ler('usuarios').find(u => String(u.id) === id && u.ativo) ?? null;
}

const demo = {
  ler(chave) {
    let lista;
    try {
      const v = localStorage.getItem('fc_demo_' + chave);
      if (v) lista = JSON.parse(v);
    } catch (_) {}
    lista = lista ?? structuredClone(MOCK_DATA[chave]);
    return chave === 'usuarios' ? lista.map(normalizarUsuarioDemo) : lista;
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
  atualizar(chave, id, dados) {
    const lista = demo.ler(chave);
    const i = lista.findIndex(item => String(item.id) === String(id));
    if (i < 0) throw new ApiError('Registro não encontrado.', 404);
    const definidos = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined));
    lista[i] = { ...lista[i], ...definidos, id: lista[i].id };
    demo.gravar(chave, lista);
    return lista[i];
  },
  remover(chave, id) {
    const lista = demo.ler(chave);
    const restante = lista.filter(item => String(item.id) !== String(id));
    if (restante.length === lista.length) throw new ApiError('Registro não encontrado.', 404);
    demo.gravar(chave, restante);
  },
};

// Remove dados antigos gravados por versões anteriores (sem prefixo "demo").
['clientes', 'manipulacoes', 'exames', 'receitas'].forEach(k => {
  try { localStorage.removeItem('fc_' + k); } catch (_) {}
});

const comBusca = termo => (termo ? `?q=${encodeURIComponent(termo)}` : '');
const segmento = id => encodeURIComponent(id);

// PUT/DELETE genéricos. `resposta` é a chave com o registro no JSON devolvido pela API.
async function atualizarRegistro(rota, chave, resposta, id, dados) {
  if (!MODO_DEMO) return (await request(`/${rota}/${segmento(id)}`, { method: 'PUT', body: dados }))[resposta];
  return demo.atualizar(chave, id, dados);
}

async function excluirRegistro(rota, chave, id) {
  if (!MODO_DEMO) {
    await request(`/${rota}/${segmento(id)}`, { method: 'DELETE' });
    return;
  }
  demo.remover(chave, id);
}

const DEMO_HISTORICO = ['manipulacoes', 'exames', 'receitas'];

// ── Catálogo de exames (modo demonstração: mesmas regras do backend) ──
const normalizarNome = nome => String(nome ?? '').replace(/\s+/g, ' ').trim();

function validarNomeCatalogo(nome) {
  const limpo = normalizarNome(nome);
  if (!limpo) throw new ApiError('O nome do exame é obrigatório.', 400); // 1 letra vale (ex.: "K" = potássio)
  if (limpo.length > 200) throw new ApiError('O nome do exame deve ter no máximo 200 caracteres.', 400);
  return limpo;
}

function validarValorCatalogo(valor) {
  if (valor === null || valor === undefined || valor === '' || typeof valor === 'boolean') throw new ApiError('Valor é obrigatório.', 400);
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new ApiError('Valor inválido.', 400);
  if (numero < 0) throw new ApiError('Valor não pode ser negativo.', 400);
  if (numero > 99999999.99) throw new ApiError('Valor muito alto.', 400);
  return Math.round(numero * 100) / 100;
}

/** Mesmas regras do backend para nome, e-mail, perfil e módulos de um usuário. */
function validarUsuarioDemo({ nome, email, perfil, modulos }) {
  const nomeLimpo = normalizarNome(nome);
  if (nomeLimpo.length < 3) throw new ApiError('Nome deve ter pelo menos 3 caracteres.', 400);
  const emailLimpo = String(email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLimpo)) throw new ApiError('E-mail inválido.', 400);
  if (perfil !== 'admin' && perfil !== 'funcionario') throw new ApiError("Perfil inválido. Use 'admin' ou 'funcionario'.", 400);
  if (modulos !== undefined && modulos !== null && !Array.isArray(modulos)) throw new ApiError('Módulos inválidos: envie uma lista.', 400);
  const invalido = (modulos || []).find(m => !CHAVES_MODULOS.includes(m));
  if (invalido !== undefined) throw new ApiError(`Módulo inválido: '${invalido}'.`, 400);

  const escolhidos = CHAVES_MODULOS.filter(chave => (modulos || []).includes(chave));
  if (perfil === 'funcionario' && !escolhidos.length) throw new ApiError('Escolha ao menos um módulo para o funcionário.', 400);
  return {
    nome: nomeLimpo,
    email: emailLimpo,
    perfil,
    modulos: perfil === 'admin' ? [...CHAVES_MODULOS] : escolhidos,
  };
}

const mesmoNome = (a, b) => a.toLowerCase() === b.toLowerCase();

// ── Catálogo de medicamentos e receitas (modo demonstração: mesmas regras do backend) ──
const MAX_ITENS_RECEITA = 12;
const NOTACAO_CIENTIFICA = /^\d+([.,]\d+)?e[+-]?\d+$/i;
const resumoItens = itens => itens.map(i => i.medicamento).join('; ');
const chaveMedicamento = (rms, descricao) => `${rms}|${descricao.toLowerCase()}`;

function validarDescricaoMedicamento(valor) {
  const texto = normalizarNome(valor);
  if (!texto) throw new ApiError('A descrição do medicamento é obrigatória.', 400);
  if (texto.length > 255) throw new ApiError('A descrição deve ter no máximo 255 caracteres.', 400);
  return texto;
}

function validarRms(valor) {
  const rms = String(valor ?? '').replace(/\s/g, '');
  if (NOTACAO_CIENTIFICA.test(rms)) throw new ApiError('RMS em notação científica: o Excel estragou o número. Use o CSV original.', 400);
  if (rms.length > 30) throw new ApiError('O RMS deve ter no máximo 30 caracteres.', 400);
  return rms;
}

const validarLaboratorio = valor => {
  const texto = normalizarNome(valor);
  if (texto.length > 150) throw new ApiError('Laboratório deve ter no máximo 150 caracteres.', 400);
  return texto || null;
};

function textoItem(valor, maximo, rotulo, posicao) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (texto.length > maximo) throw new ApiError(`Medicamento ${posicao}: ${rotulo} deve ter no máximo ${maximo} caracteres.`, 400);
  return texto;
}

function quantidadeItem(valor, posicao) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  if (typeof valor === 'boolean' || !Number.isInteger(numero) || numero < 1 || numero > 9999) {
    throw new ApiError(`Medicamento ${posicao}: a quantidade deve ser um número inteiro maior que zero.`, 400);
  }
  return numero;
}

function montarItensReceita(itens, receitaAtual = null) {
  if (!Array.isArray(itens) || !itens.length) throw new ApiError('Adicione pelo menos um medicamento à receita.', 400);
  if (itens.length > MAX_ITENS_RECEITA) throw new ApiError(`Uma receita pode ter no máximo ${MAX_ITENS_RECEITA} medicamentos.`, 400);

  const catalogo = demo.ler('catalogo_medicamentos');
  const existentes = receitaAtual?.itens || [];

  return itens.map((bruto, i) => {
    const posicao = i + 1;
    const naoEscolhido = () => new ApiError(`Medicamento ${posicao}: escolha um medicamento da lista do catálogo.`, 400);
    let copia;
    let id = Date.now() + i;

    if (bruto?.catalogo_id !== null && bruto?.catalogo_id !== undefined) {
      const med = catalogo.find(m => m.id === bruto.catalogo_id && m.ativo);
      if (!med) throw naoEscolhido();
      copia = { medicamento: med.descricao, rms: med.rms, laboratorio: med.laboratorio };
    } else {
      const antigo = existentes.find(x => x.id === bruto?.id);
      if (!antigo) throw naoEscolhido();
      copia = { medicamento: antigo.medicamento, rms: antigo.rms, laboratorio: antigo.laboratorio };
      id = antigo.id;
    }
    return {
      id,
      ...copia,
      dose: textoItem(bruto.dose, 60, 'Dose', posicao),
      posologia: textoItem(bruto.posologia, 200, 'Posologia', posicao),
      lote: textoItem(bruto.lote, 60, 'Lote', posicao),
      validade: textoItem(bruto.validade, 20, 'Validade', posicao),
      quantidade: quantidadeItem(bruto.quantidade, posicao),
    };
  });
}

export const api = {
  // --- Autenticação ---
  async login(email, senha) {
    if (MODO_DEMO) throw new ApiError('No modo demonstração não há senha: escolha um usuário da lista.', 400);
    const data = await request('/auth/login', { method: 'POST', body: { email, senha } });
    sessao.salvar(data.access_token, data.usuario);
    return data.usuario;
  },

  /** Dados atuais do usuário logado (perfil e módulos podem ter mudado desde o login). */
  async me() {
    if (MODO_DEMO) {
      const usuario = demoSessaoUsuario();
      if (!usuario) throw new ApiError('Sessão encerrada.', 401);
      return usuario;
    }
    const usuario = await request('/auth/me');
    sessao.guardarUsuario(usuario);
    return usuario;
  },

  // Somente no modo demonstração: usuários fictícios para escolher na tela de entrada
  usuariosDaDemonstracao() {
    return demo.ler('usuarios').filter(u => u.ativo);
  },

  entrarNaDemonstracao(id) {
    const usuario = demo.ler('usuarios').find(u => String(u.id) === String(id) && u.ativo);
    if (!usuario) throw new ApiError('Escolha um usuário da lista.', 400);
    localStorage.setItem(DEMO_SESSAO_KEY, String(usuario.id));
    return usuario;
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

  async obterCliente(id) {
    if (!MODO_DEMO) return request(`/clientes/${segmento(id)}`);
    const cliente = demo.ler('clientes').find(c => String(c.id) === String(id));
    if (!cliente) throw new ApiError('Cliente não encontrado.', 404);
    return cliente;
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

  async cadastrarExame({ catalogo_id, ...dados }) {
    if (!MODO_DEMO) return (await request('/exames', { method: 'POST', body: { catalogo_id, ...dados } })).exame;
    const item = demo.ler('catalogo_exames').find(e => e.id === catalogo_id && e.ativo);
    if (!item) throw new ApiError('Escolha um exame da lista do catálogo.', 400);
    // nome e valor vêm do catálogo, nunca do formulário
    return demo.inserir('exames', { ...dados, tipo_exame: item.nome, valor: item.valor });
  },

  // --- Receitas ---
  async listarReceitas() {
    if (!MODO_DEMO) return (await request('/receitas')).itens || [];
    return demo.ler('receitas');
  },

  async cadastrarReceita({ itens, ...dados }) {
    if (!MODO_DEMO) return (await request('/receitas', { method: 'POST', body: { ...dados, itens } })).receita;
    const lista = montarItensReceita(itens);
    return demo.inserir('receitas', {
      ...dados,
      medico_prescritor: textoItem(dados.medico_prescritor, 200, 'Médico prescritor', 0) ?? null,
      observacoes: textoItem(dados.observacoes, 2000, 'Observações', 0) ?? null,
      itens: lista,
      medicamentos: resumoItens(lista),
    });
  },

  // --- Editar e excluir ---
  async atualizarCliente(id, dados) {
    if (MODO_DEMO) {
      if (dados.cpf && demo.ler('clientes').some(c => c.cpf === dados.cpf && String(c.id) !== String(id))) {
        throw new ApiError(`O CPF ${dados.cpf} já pertence a outro cliente.`, 400);
      }
      const atualizado = demo.atualizar('clientes', id, dados);
      // Nos dados fictícios o nome do cliente é copiado em cada registro: mantém em sincronia.
      DEMO_HISTORICO.forEach(chave => {
        demo.gravar(chave, demo.ler(chave).map(r =>
          String(r.cliente_id) === String(id) ? { ...r, cliente_nome: atualizado.nome } : r));
      });
      return atualizado;
    }
    return atualizarRegistro('clientes', 'clientes', 'cliente', id, dados);
  },

  async excluirCliente(id) {
    if (MODO_DEMO && DEMO_HISTORICO.some(chave => demo.ler(chave).some(r => String(r.cliente_id) === String(id)))) {
      throw new ApiError('Não é possível excluir este cliente pois existem manipulações, exames ou receitas vinculados.', 400);
    }
    return excluirRegistro('clientes', 'clientes', id);
  },

  atualizarManipulacao: (id, dados) => atualizarRegistro('manipulacoes', 'manipulacoes', 'manipulacao', id, dados),
  excluirManipulacao: id => excluirRegistro('manipulacoes', 'manipulacoes', id),

  // Nome e valor do exame não mudam depois de registrados (só data, pagamento e observações).
  atualizarExame(id, { data, forma_pagamento, observacoes }) {
    return atualizarRegistro('exames', 'exames', 'exame', id, { data, forma_pagamento, observacoes });
  },
  excluirExame: id => excluirRegistro('exames', 'exames', id),

  async atualizarReceita(id, { itens, ...dados }) {
    if (!MODO_DEMO) return atualizarRegistro('receitas', 'receitas', 'receita', id, itens === undefined ? dados : { ...dados, itens });
    const atual = demo.ler('receitas').find(r => String(r.id) === String(id));
    if (!atual) throw new ApiError('Receita não encontrada.', 404);

    const mudancas = {};
    if ('medico_prescritor' in dados) mudancas.medico_prescritor = textoItem(dados.medico_prescritor, 200, 'Médico prescritor', 0);
    if ('observacoes' in dados) mudancas.observacoes = textoItem(dados.observacoes, 2000, 'Observações', 0);
    if (dados.data_venda) mudancas.data_venda = dados.data_venda;
    if (itens !== undefined) {
      mudancas.itens = montarItensReceita(itens, atual);
      mudancas.medicamentos = resumoItens(mudancas.itens);
    }
    return demo.atualizar('receitas', id, mudancas);
  },
  excluirReceita: id => excluirRegistro('receitas', 'receitas', id),

  // --- Usuários (administrador) ---
  async listarUsuarios() {
    if (!MODO_DEMO) return (await request('/usuarios')).itens || [];
    return demo.ler('usuarios');
  },

  async cadastrarUsuario({ nome, email, senha, perfil, modulos }) {
    if (!MODO_DEMO) {
      return (await request('/auth/cadastro', { method: 'POST', body: { nome, email, senha, perfil, modulos } })).usuario;
    }
    const dados = validarUsuarioDemo({ nome, email, perfil, modulos });
    if ((senha || '').length < 6) throw new ApiError('Senha deve ter pelo menos 6 caracteres.', 400);
    if (demo.ler('usuarios').some(u => u.email === dados.email)) throw new ApiError('E-mail já cadastrado.', 409);
    // No modo demonstração a senha não é guardada: não existe login com senha.
    return demo.inserir('usuarios', { ...dados, ativo: true });
  },

  async atualizarUsuario(id, dados) {
    if (!MODO_DEMO) return atualizarRegistro('usuarios', 'usuarios', 'usuario', id, dados);

    const atual = demo.ler('usuarios').find(u => String(u.id) === String(id));
    if (!atual) throw new ApiError('Usuário não encontrado.', 404);
    const proprio = String(sessao.usuario()?.id) === String(id);

    if (dados.senha && dados.senha.length < 6) throw new ApiError('Senha deve ter pelo menos 6 caracteres.', 400);
    if (proprio && 'perfil' in dados && dados.perfil !== 'admin') {
      throw new ApiError('Você não pode remover o seu próprio acesso de administrador.', 400);
    }
    if (proprio && dados.ativo === false) throw new ApiError('Você não pode desativar o seu próprio usuário.', 400);
    if ('ativo' in dados && typeof dados.ativo !== 'boolean') throw new ApiError("O campo 'ativo' deve ser verdadeiro ou falso.", 400);

    const final = validarUsuarioDemo({
      nome: 'nome' in dados ? dados.nome : atual.nome,
      email: atual.email,
      perfil: 'perfil' in dados ? dados.perfil : atual.perfil,
      modulos: 'modulos' in dados ? dados.modulos : atual.modulos,
    });
    const { senha: _senha, ...resto } = dados;
    return demo.atualizar('usuarios', id, { ...resto, nome: final.nome, perfil: final.perfil, modulos: final.modulos });
  },

  // --- Catálogo de exames ---
  // Todos podem consultar; criar, editar, desativar e importar é só do administrador (a API confere).
  async listarCatalogoExames({ apenasAtivos = false } = {}) {
    if (!MODO_DEMO) return (await request(`/catalogo-exames${apenasAtivos ? '?ativos=true' : ''}`)).itens || [];
    return demo.ler('catalogo_exames')
      .filter(e => !apenasAtivos || e.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async cadastrarCatalogoExame({ nome, valor }) {
    if (!MODO_DEMO) return (await request('/catalogo-exames', { method: 'POST', body: { nome, valor } })).exame;
    const limpo = validarNomeCatalogo(nome);
    const preco = validarValorCatalogo(valor);
    const existente = demo.ler('catalogo_exames').find(e => mesmoNome(e.nome, limpo));
    if (existente) {
      throw new ApiError(`Já existe um exame chamado '${existente.nome}'${existente.ativo ? '.' : ' (desativado). Reative-o na lista.'}`, 400);
    }
    const agora = new Date().toISOString();
    return demo.inserir('catalogo_exames', { nome: limpo, valor: preco, ativo: true, atualizado_em: agora });
  },

  async atualizarCatalogoExame(id, dados) {
    if (!MODO_DEMO) return atualizarRegistro('catalogo-exames', 'catalogo_exames', 'exame', id, dados);
    const mudancas = {};
    if ('nome' in dados) {
      mudancas.nome = validarNomeCatalogo(dados.nome);
      const outro = demo.ler('catalogo_exames').find(e => mesmoNome(e.nome, mudancas.nome) && String(e.id) !== String(id));
      if (outro) throw new ApiError(`Já existe um exame chamado '${outro.nome}'.`, 400);
    }
    if ('valor' in dados) mudancas.valor = validarValorCatalogo(dados.valor);
    if ('ativo' in dados) {
      if (typeof dados.ativo !== 'boolean') throw new ApiError("O campo 'ativo' deve ser verdadeiro ou falso.", 400);
      mudancas.ativo = dados.ativo;
    }
    return demo.atualizar('catalogo_exames', id, { ...mudancas, atualizado_em: new Date().toISOString() });
  },

  async importarCatalogoExames(itens) {
    if (!MODO_DEMO) return request('/catalogo-exames/importar', { method: 'POST', body: { itens } });
    if (!Array.isArray(itens) || !itens.length) throw new ApiError('Nenhum exame para importar.', 400);
    if (itens.length > 1000) throw new ApiError('Importe no máximo 1000 exames por vez.', 400);

    const lista = demo.ler('catalogo_exames');
    const vistos = new Set();
    const erros = [];
    let criados = 0, atualizados = 0, iguais = 0;

    itens.forEach((item, i) => {
      const linha = item?.linha ?? i + 1;
      let nome, valor;
      try {
        nome = validarNomeCatalogo(item?.nome);
        valor = validarValorCatalogo(item?.valor);
      } catch (err) {
        erros.push({ linha, nome: String(item?.nome ?? ''), motivo: err.message });
        return;
      }
      const chave = nome.toLowerCase();
      if (vistos.has(chave)) { erros.push({ linha, nome, motivo: 'Nome repetido no arquivo.' }); return; }
      vistos.add(chave);

      const existente = lista.find(e => mesmoNome(e.nome, nome));
      if (!existente) {
        lista.push({ id: Date.now() + i, nome, valor, ativo: true, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
        criados++;
      } else if (existente.valor !== valor || !existente.ativo) {
        Object.assign(existente, { valor, ativo: true, atualizado_em: new Date().toISOString() });
        atualizados++;
      } else iguais++;
    });

    demo.gravar('catalogo_exames', lista);
    return { criados, atualizados, iguais, erros };
  },

  // --- Catálogo de medicamentos ---
  // Todos podem consultar; criar, editar, desativar e importar é só do administrador (a API confere).
  async listarCatalogoMedicamentos({ apenasAtivos = false } = {}) {
    if (!MODO_DEMO) return (await request(`/catalogo-medicamentos${apenasAtivos ? '?ativos=true' : ''}`)).itens || [];
    return demo.ler('catalogo_medicamentos')
      .filter(m => !apenasAtivos || m.ativo)
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  },

  async cadastrarCatalogoMedicamento({ descricao, rms, laboratorio }) {
    if (!MODO_DEMO) {
      return (await request('/catalogo-medicamentos', { method: 'POST', body: { descricao, rms, laboratorio } })).medicamento;
    }
    const dados = { descricao: validarDescricaoMedicamento(descricao), rms: validarRms(rms), laboratorio: validarLaboratorio(laboratorio) };
    const existente = demo.ler('catalogo_medicamentos').find(m => chaveMedicamento(m.rms, m.descricao) === chaveMedicamento(dados.rms, dados.descricao));
    if (existente) throw new ApiError(`Já existe '${existente.descricao}' com esse RMS${existente.ativo ? '.' : ' (desativado). Reative-o na lista.'}`, 400);
    return demo.inserir('catalogo_medicamentos', { ...dados, ativo: true, atualizado_em: new Date().toISOString() });
  },

  async atualizarCatalogoMedicamento(id, dados) {
    if (!MODO_DEMO) return atualizarRegistro('catalogo-medicamentos', 'catalogo_medicamentos', 'medicamento', id, dados);
    const atual = demo.ler('catalogo_medicamentos').find(m => String(m.id) === String(id));
    if (!atual) throw new ApiError('Medicamento não encontrado no catálogo.', 404);

    const mudancas = {};
    if ('descricao' in dados) mudancas.descricao = validarDescricaoMedicamento(dados.descricao);
    if ('rms' in dados) mudancas.rms = validarRms(dados.rms);
    if ('laboratorio' in dados) mudancas.laboratorio = validarLaboratorio(dados.laboratorio);
    if ('ativo' in dados) {
      if (typeof dados.ativo !== 'boolean') throw new ApiError("O campo 'ativo' deve ser verdadeiro ou falso.", 400);
      mudancas.ativo = dados.ativo;
    }
    const chave = chaveMedicamento(mudancas.rms ?? atual.rms, mudancas.descricao ?? atual.descricao);
    const outro = demo.ler('catalogo_medicamentos').find(m => chaveMedicamento(m.rms, m.descricao) === chave && String(m.id) !== String(id));
    if (outro) throw new ApiError(`Já existe '${outro.descricao}' com esse RMS.`, 400);
    return demo.atualizar('catalogo_medicamentos', id, { ...mudancas, atualizado_em: new Date().toISOString() });
  },

  async importarCatalogoMedicamentos(itens) {
    if (!MODO_DEMO) return request('/catalogo-medicamentos/importar', { method: 'POST', body: { itens } });
    if (!Array.isArray(itens) || !itens.length) throw new ApiError('Nenhum medicamento para importar.', 400);
    if (itens.length > 1000) throw new ApiError('Importe no máximo 1000 medicamentos por vez.', 400);

    const lista = demo.ler('catalogo_medicamentos');
    const vistos = new Set();
    const erros = [];
    let criados = 0, atualizados = 0, iguais = 0;

    itens.forEach((item, i) => {
      const linha = item?.linha ?? i + 1;
      let descricao, rms, laboratorio;
      try {
        descricao = validarDescricaoMedicamento(item?.descricao);
        rms = validarRms(item?.rms);
        laboratorio = validarLaboratorio(item?.laboratorio);
      } catch (err) {
        erros.push({ linha, nome: String(item?.descricao ?? ''), motivo: err.message });
        return;
      }
      const chave = chaveMedicamento(rms, descricao);
      if (vistos.has(chave)) { erros.push({ linha, nome: descricao, motivo: 'Medicamento repetido no arquivo.' }); return; }
      vistos.add(chave);

      const existente = lista.find(m => chaveMedicamento(m.rms, m.descricao) === chave);
      if (!existente) {
        const agora = new Date().toISOString();
        lista.push({ id: Date.now() + i, rms, descricao, laboratorio, ativo: true, criado_em: agora, atualizado_em: agora });
        criados++;
      } else if (existente.laboratorio !== laboratorio || !existente.ativo) {
        Object.assign(existente, { laboratorio, ativo: true, atualizado_em: new Date().toISOString() });
        atualizados++;
      } else iguais++;
    });

    demo.gravar('catalogo_medicamentos', lista);
    return { criados, atualizados, iguais, erros };
  },
};
