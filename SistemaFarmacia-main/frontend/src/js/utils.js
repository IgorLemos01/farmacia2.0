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
