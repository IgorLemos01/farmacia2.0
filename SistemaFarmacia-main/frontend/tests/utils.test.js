import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../src/js/utils.js';

describe('escapeHtml', () => {
  it('neutraliza tags e atributos', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml("O'Neil & Cia")).toBe('O&#39;Neil &amp; Cia');
  });

  it('trata valores vazios e não-texto', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});
