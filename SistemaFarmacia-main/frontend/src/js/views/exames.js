// ============================================================
//  VIEW: EXAMES — pedido com vários exames por atendimento
//
//  O paciente costuma fazer vários exames na mesma visita (ex.: glicemia +
//  teste de gravidez + ácido úrico + hemograma). O atendente busca no catálogo,
//  adiciona quantos precisar, ajusta o valor de cada um e o total é somado na hora.
// ============================================================

import { api } from '../api.js';
import { criarAutocomplete } from '../autocomplete.js';
import { parseValorBR } from '../csv.js';
import { formatarDataBR } from '../pdf.js';
import { criarSeletorPaciente } from '../seletorPaciente.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, formatarMoeda, hojeISO, ligarAcoes, semAcento } from '../utils.js';

const MAX_EXAMES = 30; // mesmo limite da API
const MAX_NA_LISTA = 3;
const FORMAS_PAGAMENTO = ['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Outro'];
const ICONE_LIXO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

/** "13.5" → "13,50" (para o campo de valor). */
const valorParaCampo = v => Number(v ?? 0).toFixed(2).replace('.', ',');

function examesDaLinha(pedido) {
  const itens = pedido.itens?.length ? pedido.itens : [{ nome: pedido.tipo_exame || '—' }];
  const visiveis = itens.slice(0, MAX_NA_LISTA)
    .map(i => `<span class="badge badge-info" style="font-size: 0.76rem; font-weight: 600;">🩺 ${esc(i.nome)}</span>`).join(' ');
  const resto = itens.length - MAX_NA_LISTA;
  return `<div class="lista-badges">${visiveis}${resto > 0 ? ` <span class="badge badge-neutral">+ ${resto}</span>` : ''}</div>`;
}

export async function renderExames(container) {
  const [exames, catalogo] = await Promise.all([
    api.listarExames(),
    api.listarCatalogoExames({ apenasAtivos: true }),
  ]);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Exames Realizados</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Cada atendimento pode ter vários exames, com o total calculado automaticamente</p>
        </div>
        <button class="btn btn-primary" id="btnAbrirModalExame">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Registrar Exames
        </button>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Exames</th>
              <th>Data</th>
              <th>Total & Pagamento</th>
              <th>Resultado / Observações</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${exames.length === 0
              ? `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum exame registrado.</td></tr>`
              : exames.map(e => `
                  <tr>
                    <td><div style="font-weight: 700; color: var(--text-title);">${esc(e.cliente_nome || 'Cliente #' + e.cliente_id)}</div></td>
                    <td style="max-width: 320px;">${examesDaLinha(e)}</td>
                    <td>${esc(formatarDataBR(e.data) || '-')}</td>
                    <td>
                      <div style="font-weight: 700;">${formatarMoeda(e.valor)}</div>
                      <div style="font-size: 0.72rem; color: var(--text-muted);">${esc(e.forma_pagamento || 'Não informado')} · ${Number(e.itens?.length || 1)} exame(s)</div>
                    </td>
                    <td style="font-size: 0.82rem; color: var(--text-body); max-width: 240px;">${esc(e.observacoes || '-')}</td>
                    <td style="text-align: right;"><div class="row-actions">${botoesAcoes(e.id)}</div></td>
                  </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL: PEDIDO DE EXAMES -->
    <div class="modal-overlay" id="modalNovoExame">
      <div class="modal-card modal-wide">
        <div class="modal-header">
          <h3 class="modal-title" id="tituloModalExame">Registrar Exames</h3>
          <button class="modal-close" id="btnFecharModalExame" type="button">&times;</button>
        </div>
        <form id="formNovoExame" novalidate>
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label" for="exame_paciente">Paciente <span class="req">*</span></label>
              <div id="exame_paciente_area"></div>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label" for="exame_busca">Exames do atendimento <span class="req">*</span></label>
              <div><input type="text" class="form-input" id="exame_busca" autocomplete="off"
                          placeholder="🔍 Digite para buscar no catálogo e pressione Enter para adicionar…"/></div>
              <div class="carrinho">
                <table class="carrinho-tabela">
                  <thead><tr><th>#</th><th>Exame</th><th style="width: 150px;">Valor (R$)</th><th style="width: 44px;"></th></tr></thead>
                  <tbody id="exame_itens"></tbody>
                  <tfoot>
                    <tr>
                      <td colspan="2"><span id="exame_qtd">0 exame(s)</span></td>
                      <td class="carrinho-total" colspan="2">Total: <strong id="exame_total">R$ 0,00</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <small id="dicaExame" role="status" class="form-dica"></small>
            </div>

            <div class="form-group">
              <label class="form-label" for="exame_data">Data de Realização</label>
              <input type="date" class="form-input" id="exame_data" value="${hojeISO()}"/>
            </div>

            <div class="form-group">
              <label class="form-label" for="exame_pagamento">Forma de Pagamento</label>
              <select class="form-select" id="exame_pagamento">
                ${FORMAS_PAGAMENTO.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
                <option value="">Não informado</option>
              </select>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label" for="exame_obs">Resultado & Parecer Farmacêutico</label>
              <textarea class="form-textarea" id="exame_obs" maxlength="5000" placeholder="Valores aferidos, orientação ao paciente, etc."></textarea>
            </div>
          </div>

          <div class="form-acoes">
            <button type="button" class="btn btn-secondary" id="btnCancelarExame">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarExame">Salvar Exames</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const campo = id => document.getElementById(id);
  const modal = campo('modalNovoExame');
  const form = campo('formNovoExame');
  const busca = campo('exame_busca');
  const corpoItens = campo('exame_itens');
  const dica = campo('dicaExame');
  const btnSalvar = campo('btnSalvarExame');
  let editando = null;

  const seletor = criarSeletorPaciente({ raiz: campo('exame_paciente_area'), id: 'exame_paciente' });

  // ── Carrinho de exames ──────────────────────────────────
  // Cada linha guarda de onde veio: catalogoId (novo) ou itemId (já salvo, na edição).
  function linhas() {
    return [...corpoItens.querySelectorAll('tr')];
  }

  function valorDaLinha(tr) {
    return parseValorBR(tr.querySelector('.exame-valor').value);
  }

  function atualizarTotal() {
    const todas = linhas();
    let total = 0;
    let invalido = false;
    todas.forEach((tr, i) => {
      tr.querySelector('.carrinho-ordem').textContent = String(i + 1);
      const v = valorDaLinha(tr);
      tr.querySelector('.exame-valor').classList.toggle('invalido', v === null);
      if (v === null) invalido = true;
      else total += v;
    });
    campo('exame_qtd').textContent = `${todas.length} exame(s)`;
    campo('exame_total').textContent = invalido ? '—' : formatarMoeda(total);
    campo('exame_total').closest('tfoot').hidden = !todas.length;
    corpoItens.closest('.carrinho').classList.toggle('vazio', !todas.length);
    busca.disabled = todas.length >= MAX_EXAMES;
    busca.placeholder = todas.length >= MAX_EXAMES
      ? `Máximo de ${MAX_EXAMES} exames por atendimento`
      : '🔍 Digite para buscar no catálogo e pressione Enter para adicionar…';
  }

  function jaNoPedido(nome) {
    return linhas().find(tr => semAcento(tr.dataset.nome) === semAcento(nome));
  }

  function adicionarLinha({ catalogoId = null, itemId = null, nome, valor }) {
    const tr = document.createElement('tr');
    tr.dataset.nome = nome;
    if (catalogoId != null) tr.dataset.catalogoId = catalogoId;
    if (itemId != null) tr.dataset.itemId = itemId;
    tr.innerHTML = `
      <td class="carrinho-ordem"></td>
      <td class="carrinho-nome"></td>
      <td><input type="text" class="form-input exame-valor" inputmode="decimal" aria-label="Valor do exame"/></td>
      <td><button type="button" class="btn-icon btn-icon-danger" title="Remover exame" aria-label="Remover exame">${ICONE_LIXO}</button></td>`;
    tr.querySelector('.carrinho-nome').textContent = nome;
    const inputValor = tr.querySelector('.exame-valor');
    inputValor.value = valorParaCampo(valor);
    inputValor.addEventListener('input', atualizarTotal);
    inputValor.addEventListener('blur', () => {
      const v = parseValorBR(inputValor.value);
      if (v !== null) inputValor.value = valorParaCampo(v);
    });
    tr.querySelector('button').onclick = () => { tr.remove(); atualizarTotal(); busca.focus(); };
    corpoItens.appendChild(tr);
    atualizarTotal();
    return tr;
  }

  function adicionarDoCatalogo(item) {
    dica.textContent = '';
    const repetido = jaNoPedido(item.nome);
    if (repetido) {
      dica.textContent = `"${item.nome}" já está no pedido.`;
      repetido.classList.add('destaque');
      setTimeout(() => repetido.classList.remove('destaque'), 1200);
    } else {
      adicionarLinha({ catalogoId: item.id, nome: item.nome, valor: item.valor });
    }
    // o campo de busca fica livre para o próximo exame (antes a tela travava aqui)
    busca.value = '';
    busca.focus();
  }

  criarAutocomplete({
    input: busca,
    maximo: 12,
    buscar: termo => {
      const t = semAcento(termo);
      return catalogo
        .filter(c => !t || semAcento(c.nome).includes(t))
        .sort((a, b) => {
          // quem começa com o termo vem primeiro
          const pa = semAcento(a.nome).startsWith(t) ? 0 : 1;
          const pb = semAcento(b.nome).startsWith(t) ? 0 : 1;
          return pa - pb || a.nome.localeCompare(b.nome, 'pt-BR');
        });
    },
    rotulo: c => (jaNoPedido(c.nome) ? `✓ ${c.nome}` : c.nome),
    detalhe: c => formatarMoeda(c.valor),
    aoEscolher: adicionarDoCatalogo,
  });

  // ── Abrir / fechar ──────────────────────────────────────
  async function abrirModal(pedido = null) {
    editando = pedido;
    form.reset();
    corpoItens.replaceChildren();
    dica.textContent = '';
    seletor.limpar({ focar: false });
    campo('exame_data').value = hojeISO();
    campo('tituloModalExame').textContent = pedido ? 'Editar Atendimento de Exames' : 'Registrar Exames';
    btnSalvar.textContent = pedido ? 'Salvar Alterações' : 'Salvar Exames';
    btnSalvar.disabled = false;

    if (pedido) {
      campo('exame_data').value = pedido.data || hojeISO();
      campo('exame_pagamento').value = pedido.forma_pagamento || '';
      campo('exame_obs').value = pedido.observacoes || '';
      (pedido.itens || []).forEach(i => adicionarLinha({ itemId: i.id, nome: i.nome, valor: i.valor }));
      // o paciente de um atendimento já registrado não pode ser trocado
      let dados;
      try { dados = await api.obterCliente(pedido.cliente_id); } catch (_) { dados = { id: pedido.cliente_id, nome: pedido.cliente_nome || 'Paciente', telefone: '' }; }
      seletor.definir(dados, { podeTrocar: false });
    } else if (!catalogo.length) {
      btnSalvar.disabled = true;
      dica.textContent = 'O catálogo está vazio. Peça a um administrador para cadastrar os exames em Configurações → Catálogo de Exames.';
    }
    atualizarTotal();
    modal.classList.add('active');
    if (!pedido) seletor.input.focus();
  }
  const fecharModal = () => modal.classList.remove('active');

  campo('btnAbrirModalExame').onclick = () => abrirModal();
  campo('btnFecharModalExame').onclick = fecharModal;
  campo('btnCancelarExame').onclick = fecharModal;

  const porId = id => exames.find(x => String(x.id) === String(id));
  ligarAcoes(container, {
    editar: id => abrirModal(porId(id)),
    excluir: id => confirmarEExcluir({
      mensagem: `Excluir o atendimento de exames de ${porId(id)?.cliente_nome || 'este paciente'} (${porId(id)?.itens?.length || 1} exame(s))? Esta ação não pode ser desfeita.`,
      excluir: () => api.excluirExame(id),
      aoConcluir: () => renderExames(container),
    }),
  });

  // ── Salvar ──────────────────────────────────────────────
  function coletar() {
    if (!editando && !seletor.paciente) throw new Error('Escolha o paciente (ou cadastre um novo pela busca).');
    const todas = linhas();
    if (!todas.length) throw new Error('Adicione pelo menos um exame ao atendimento.');
    const itens = todas.map((tr, i) => {
      const valor = valorDaLinha(tr);
      if (valor === null) throw new Error(`Exame ${i + 1} (${tr.dataset.nome}): informe um valor válido, ex.: 15,00.`);
      return tr.dataset.itemId
        ? { id: Number(tr.dataset.itemId), valor }
        : { catalogo_id: Number(tr.dataset.catalogoId), valor };
    });
    const corpo = {
      itens,
      data: campo('exame_data').value || hojeISO(),
      forma_pagamento: campo('exame_pagamento').value || null,
      observacoes: campo('exame_obs').value.trim() || null,
    };
    if (!editando) corpo.cliente_id = seletor.paciente.id;
    return corpo;
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    let corpo;
    try {
      corpo = coletar();
    } catch (err) {
      alert(err.message);
      return;
    }
    btnSalvar.disabled = true;
    try {
      if (editando) await api.atualizarExame(editando.id, corpo);
      else await api.cadastrarExame(corpo);
      fecharModal();
      await renderExames(container);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      btnSalvar.disabled = false;
    }
  };

  // Enter na busca sem lista aberta não envia o formulário
  busca.addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.preventDefault(); });
}
