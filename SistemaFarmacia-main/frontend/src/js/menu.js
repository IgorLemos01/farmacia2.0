// ============================================================
//  MENU E BOTÕES — esconde o que o usuário não pode usar
//  (a proteção de verdade está no backend; isto só evita mostrar o que daria erro)
// ============================================================

import { podeAcessar, ROTA_CONFIGURACOES } from './permissoes.js';

const ocultar = (el, sim) => { if (el) el.style.display = sim ? 'none' : ''; };

/** Mostra no menu só as telas liberadas; some também com a busca e o botão que levam a Clientes. */
export function aplicarPermissoesNaTela(usuario, doc = document) {
  const itens = [...doc.querySelectorAll('.nav-item[data-route]')];
  itens.forEach(item => ocultar(item, !podeAcessar(usuario, item.dataset.route)));

  // Os títulos "MENU" e "GERAL" só aparecem se houver algum item visível na seção
  const algumModulo = itens.some(i => i.dataset.route !== ROTA_CONFIGURACOES && podeAcessar(usuario, i.dataset.route));
  ocultar(doc.getElementById('tituloMenu'), !algumModulo);
  ocultar(doc.getElementById('tituloGeral'), !podeAcessar(usuario, ROTA_CONFIGURACOES));

  const veClientes = podeAcessar(usuario, 'clientes');
  ocultar(doc.querySelector('.search-pill-container'), !veClientes);
  ocultar(doc.getElementById('btnNovoAtendimento'), !veClientes);
}
