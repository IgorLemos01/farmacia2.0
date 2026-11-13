// Utilidades compartilhadas pelos testes das telas (modo demonstração).
import { expect, vi } from 'vitest';

export const guardar = (chave, lista) => localStorage.setItem('fc_demo_' + chave, JSON.stringify(lista));
export const ler = chave => JSON.parse(localStorage.getItem('fc_demo_' + chave));
export const campo = id => document.getElementById(id);
export const enviar = id => campo(id).dispatchEvent(new Event('submit', { cancelable: true }));

/** Carrega a tela no modo demonstração (sem API) e desenha num container novo. */
export async function montar(arquivo, funcao, ...args) {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', '');
  const modulo = await import(arquivo);
  document.body.innerHTML = '<div id="c"></div>';
  const container = document.getElementById('c');
  await modulo[funcao](container, ...args);
  return container;
}

/** Itens visíveis na lista de sugestões ligada ao campo. */
export function sugestoes(input) {
  return [...input.parentElement.querySelectorAll('.autocomplete-lista .autocomplete-item')];
}

/** Digita no campo, espera a lista de sugestões e escolhe a que contém `alvo` (como faria o mouse). */
export async function digitarEEscolher(input, texto, alvo) {
  input.focus();
  input.value = texto;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const lista = input.parentElement.querySelector('.autocomplete-lista');
  await vi.waitFor(() => {
    expect(lista.hidden).toBe(false);
    expect(sugestoes(input).some(li => li.textContent.includes(alvo))).toBe(true);
  });
  sugestoes(input).find(li => li.textContent.includes(alvo))
    .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

/** Formulário sobreposto aberto (cadastro rápido de cliente / medicamento). */
export const sobreposto = () => document.querySelector('.modal-overlay.modal-sobreposto');
