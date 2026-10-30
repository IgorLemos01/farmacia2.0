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

import { filtrarPorPeriodo, hojeISO } from '../src/js/utils.js';

describe('hojeISO', () => {
  it('usa o dia local, não o dia em UTC', () => {
    // 23:30 do dia 30/10 no fuso do navegador
    expect(hojeISO(new Date(2026, 9, 30, 23, 30))).toBe('2026-10-30');
    expect(hojeISO(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
});

describe('filtrarPorPeriodo', () => {
  const lista = [
    { id: 1, data: '2026-10-01' },
    { id: 2, data: '2026-10-15' },
    { id: 3, data: '2026-10-31' },
    { id: 4, data: null },
  ];
  const ids = (...args) => filtrarPorPeriodo(lista, 'data', ...args).map(i => i.id);

  it('sem período devolve tudo', () => expect(ids('', '')).toEqual([1, 2, 3, 4]));
  it('limites são inclusivos', () => expect(ids('2026-10-01', '2026-10-15')).toEqual([1, 2]));
  it('só "de"', () => expect(ids('2026-10-15', '')).toEqual([2, 3]));
  it('só "até"', () => expect(ids('', '2026-10-15')).toEqual([1, 2]));
  it('ignora registros sem data quando há filtro', () => expect(ids('2026-01-01', '2026-12-31')).toEqual([1, 2, 3]));
});
