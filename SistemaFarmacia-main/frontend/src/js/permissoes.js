// ============================================================
//  PERMISSÕES — perfis e módulos (a regra de verdade fica no backend;
//  aqui só decidimos o que mostrar na tela)
// ============================================================

/** Módulos que o administrador pode liberar para um funcionário. A chave é igual ao nome da rota. */
export const MODULOS = [
  { chave: 'dashboard', rotulo: 'Dashboard', descricao: 'Totais e resumo dos serviços (só consulta)' },
  { chave: 'clientes', rotulo: 'Clientes', descricao: 'Cadastro de pacientes e dossiê' },
  { chave: 'manipulacoes', rotulo: 'Manipulação', descricao: 'Pedidos de manipulação' },
  { chave: 'exames', rotulo: 'Exames', descricao: 'Registro de exames' },
  { chave: 'receitas', rotulo: 'Receitas', descricao: 'Receitas e PDF da ficha' },
];

export const CHAVES_MODULOS = MODULOS.map(m => m.chave);

export const PERFIS = { admin: 'Administrador', funcionario: 'Funcionário' };

/** Configurações (usuários e catálogos) não é um módulo: é só do administrador. */
export const ROTA_CONFIGURACOES = 'configuracoes';

/** O usuário pode abrir esta tela? */
export function podeAcessar(usuario, rota) {
  if (!usuario) return false;
  if (rota === ROTA_CONFIGURACOES) return usuario.perfil === 'admin';
  if (!CHAVES_MODULOS.includes(rota)) return false;
  if (usuario.perfil === 'admin') return true;
  return Array.isArray(usuario.modulos) && usuario.modulos.includes(rota);
}

/** Primeira tela liberada, na ordem do menu; `null` se o usuário não tem nenhuma. */
export function primeiraRotaPermitida(usuario) {
  return [...CHAVES_MODULOS, ROTA_CONFIGURACOES].find(rota => podeAcessar(usuario, rota)) ?? null;
}

/** Nomes dos módulos do usuário, na ordem do menu (para mostrar em listas). */
export function rotulosDosModulos(usuario) {
  return MODULOS.filter(m => podeAcessar(usuario, m.chave)).map(m => m.rotulo);
}
