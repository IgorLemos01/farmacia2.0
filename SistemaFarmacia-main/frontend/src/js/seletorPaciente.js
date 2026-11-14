// ============================================================
//  SELETOR DE PACIENTE — usado em Manipulação, Exames e Receitas
//
//  - Busca o paciente por nome, CPF ou telefone (sem limite de 50 da lista).
//  - Mostra em destaque o ALERTA DE ALERGIA do cliente.
//  - Cliente novo? "+ Cadastrar" abre o cadastro rápido (nome + WhatsApp).
// ============================================================

import { api } from './api.js';
import { criarAutocomplete } from './autocomplete.js';
import { abrirFormularioCliente } from './formCliente.js';
import { formatarDataBR } from './pdf.js';
import { escapeHtml as esc } from './utils.js';

/**
 * @param {object} opcoes
 * @param {HTMLElement} opcoes.raiz   Elemento onde o seletor é desenhado.
 * @param {string} opcoes.id          id do campo de busca (para o <label for>).
 * @param {(cliente:object|null)=>void} [opcoes.aoMudar]
 */
export function criarSeletorPaciente({ raiz, id, aoMudar = () => {} }) {
  raiz.innerHTML = `
    <div><input type="text" class="form-input" id="${esc(id)}" autocomplete="off"
                placeholder="Buscar paciente por nome, CPF ou telefone…"/></div>
    <div class="paciente-card" hidden></div>`;
  const input = raiz.querySelector('input');
  const cartao = raiz.querySelector('.paciente-card');
  let paciente = null;
  let podeTrocar = true;

  function desenhar() {
    const p = paciente;
    cartao.hidden = false;
    cartao.innerHTML = `
      <div class="paciente-card-topo">
        <strong>${esc(p.nome)}</strong>
        ${podeTrocar ? '<button type="button" class="btn-limpar" data-trocar aria-label="Trocar paciente" title="Trocar paciente">x</button>' : ''}
      </div>
      ${p.alergia ? `
        <div class="alerta-alergia" role="alert">
          <strong>⚠️ ALERTA DE ALERGIA</strong>
          <span>${esc(p.alergia)}</span>
        </div>` : ''}
      <div class="paciente-card-dados">
        <span><b>WhatsApp:</b> ${esc(p.telefone || '—')}</span>
        <span><b>CPF:</b> ${esc(p.cpf || '—')}</span>
        <span><b>RG:</b> ${esc(p.rg || '—')}</span>
        <span><b>Nascimento:</b> ${esc(formatarDataBR(p.data_nascimento) || '—')}</span>
      </div>`;

    cartao.querySelector('[data-trocar]')?.addEventListener('click', () => limpar());
  }

  function definir(cliente, opcoes = {}) {
    paciente = cliente;
    podeTrocar = opcoes.podeTrocar ?? true;
    input.value = cliente.nome;
    input.readOnly = true;
    input.classList.add('selecionado');
    desenhar();
    aoMudar(paciente);
  }

  function limpar({ focar = true } = {}) {
    paciente = null;
    podeTrocar = true;
    input.readOnly = false;
    input.classList.remove('selecionado');
    input.value = '';
    cartao.hidden = true;
    cartao.replaceChildren();
    aoMudar(null);
    if (focar) input.focus();
  }

  criarAutocomplete({
    input,
    minimo: 2,
    maximo: 10,
    buscar: termo => api.listarClientes(termo),
    rotulo: c => (c.alergia ? `${c.nome}  ⚠️` : c.nome),
    detalhe: c => [c.telefone, c.cpf && `CPF ${c.cpf}`, c.alergia && `Alergia: ${c.alergia}`].filter(Boolean).join(' · '),
    aoEscolher: c => definir(c),
    acaoExtra: termo => ({
      rotulo: termo ? `+ Cadastrar novo cliente "${termo}"` : '+ Cadastrar novo cliente',
      aoAcionar: async (texto) => {
        const novo = await abrirFormularioCliente({ modo: 'rapido', nomeInicial: texto });
        if (novo) definir(novo);
        else input.focus();
      },
    }),
  });

  return {
    definir,
    limpar,
    get paciente() { return paciente; },
    input,
  };
}
