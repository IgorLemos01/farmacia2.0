// ============================================================
//  API CLIENT — COMUNICAÇÃO COM O BACKEND FLASK
//
//  Com VITE_API_URL definida (frontend/.env), o sistema usa a API real
//  e exige login. Sem ela, roda em MODO DEMONSTRAÇÃO com dados fictícios
//  guardados só no navegador — nunca há "fallback" silencioso entre os dois.
// ============================================================

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
      ativo: true,
      criado_em: '2026-10-01T09:00:00',
    },
    {
      id: 2,
      nome: 'Atendente Demonstração',
      email: 'atendente@demo.com',
      perfil: 'atendente',
      ativo: true,
      criado_em: '2026-10-05T14:30:00',
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

const mesmoNome = (a, b) => a.toLowerCase() === b.toLowerCase();

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

  async cadastrarReceita(dados) {
    if (!MODO_DEMO) return (await request('/receitas', { method: 'POST', body: dados })).receita;
    return demo.inserir('receitas', dados);
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

  atualizarReceita: (id, dados) => atualizarRegistro('receitas', 'receitas', 'receita', id, dados),
  excluirReceita: id => excluirRegistro('receitas', 'receitas', id),

  // --- Usuários (administrador) ---
  async listarUsuarios() {
    if (!MODO_DEMO) return (await request('/usuarios')).itens || [];
    return demo.ler('usuarios');
  },

  async cadastrarUsuario({ nome, email, senha, perfil }) {
    if (!MODO_DEMO) {
      return (await request('/auth/cadastro', { method: 'POST', body: { nome, email, senha, perfil } })).usuario;
    }
    if ((nome || '').trim().length < 3) throw new ApiError('Nome deve ter pelo menos 3 caracteres.', 400);
    if ((senha || '').length < 6) throw new ApiError('Senha deve ter pelo menos 6 caracteres.', 400);
    if (demo.ler('usuarios').some(u => u.email === email.trim().toLowerCase())) {
      throw new ApiError('E-mail já cadastrado.', 409);
    }
    // No modo demonstração a senha não é guardada: não existe login.
    return demo.inserir('usuarios', { nome: nome.trim(), email: email.trim().toLowerCase(), perfil, ativo: true });
  },

  async atualizarUsuario(id, dados) {
    if (!MODO_DEMO) return atualizarRegistro('usuarios', 'usuarios', 'usuario', id, dados);
    if ('nome' in dados && (dados.nome || '').trim().length < 3) throw new ApiError('Nome deve ter pelo menos 3 caracteres.', 400);
    if (dados.senha && dados.senha.length < 6) throw new ApiError('Senha deve ter pelo menos 6 caracteres.', 400);
    const { senha: _senha, ...resto } = dados;
    return demo.atualizar('usuarios', id, resto);
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
};
