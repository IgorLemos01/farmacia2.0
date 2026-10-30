// ============================================================
//  UTILITÁRIOS COMPARTILHADOS
// ============================================================

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapa texto vindo do usuário/banco antes de inserir em template HTML.
 * Evita XSS: um nome como `<img src=x onerror=...>` vira texto, não código.
 */
export function escapeHtml(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/** Data de hoje (AAAA-MM-DD) no fuso do navegador. `toISOString()` usa UTC e erra o dia à noite no Brasil. */
export function hojeISO(data = new Date()) {
  const dois = n => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

/** Mantém só os itens cuja data (campo `campoData`) está entre `de` e `ate` (ambos opcionais, inclusive). */
export function filtrarPorPeriodo(lista, campoData, de, ate) {
  if (!de && !ate) return lista;
  return lista.filter(item => {
    const dia = String(item[campoData] || '').slice(0, 10);
    if (!dia) return false;
    return (!de || dia >= de) && (!ate || dia <= ate);
  });
}

// ── Ações de linha (editar / excluir) ───────────────────────
const ICONE_EDITAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const ICONE_EXCLUIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

/** Botões de editar e excluir de uma linha da tabela (use dentro de `<div class="row-actions">`). */
export function botoesAcoes(id, { excluir = true } = {}) {
  const i = escapeHtml(id);
  return `<button type="button" class="btn-icon" data-acao="editar" data-id="${i}" title="Editar" aria-label="Editar">${ICONE_EDITAR}</button>` +
    (excluir
      ? `<button type="button" class="btn-icon btn-icon-danger" data-acao="excluir" data-id="${i}" title="Excluir" aria-label="Excluir">${ICONE_EXCLUIR}</button>`
      : '');
}

/** Liga os botões gerados por `botoesAcoes` dentro de `container`. */
export function ligarAcoes(container, { editar, excluir }) {
  container.querySelectorAll('[data-acao]').forEach(botao => {
    botao.addEventListener('click', (ev) => {
      ev.stopPropagation();
      (botao.dataset.acao === 'editar' ? editar : excluir)(botao.dataset.id);
    });
  });
}

/** Pede confirmação, exclui e atualiza a tela; erros (ex.: cliente com histórico) aparecem num aviso. */
export async function confirmarEExcluir({ mensagem, excluir, aoConcluir }) {
  if (!window.confirm(mensagem)) return;
  try {
    await excluir();
    await aoConcluir();
  } catch (err) {
    window.alert('Não foi possível excluir: ' + err.message);
  }
}
