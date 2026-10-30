// ============================================================
//  VIEW: RECEITAS — ficha de dispensação com vários medicamentos
// ============================================================

import { api } from '../api.js';
import { criarAutocomplete } from '../autocomplete.js';
import { baixarPdfReceita, formatarDataBR } from '../pdf.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, hojeISO, ligarAcoes, semAcento } from '../utils.js';

const MAX_MEDICAMENTOS = 12; // limite da API (a ficha em PDF cabe em uma página)
const MAX_NA_LISTA = 3;

const ICONE_PDF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>';
const ICONE_LIXO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

const normalizar = texto => String(texto ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function medicamentosDaLinha(receita) {
  const itens = receita.itens?.length ? receita.itens : [{ medicamento: receita.medicamentos || '—', rms: '' }];
  const visiveis = itens.slice(0, MAX_NA_LISTA).map(i => `
    <span class="med-resumo">• ${esc(i.medicamento)}${i.rms ? ` <small>RMS ${esc(i.rms)}</small>` : ''}</span>`).join('');
  const resto = itens.length - MAX_NA_LISTA;
  return visiveis + (resto > 0 ? `<span class="med-resumo"><small>+ ${resto} medicamento(s)</small></span>` : '');
}

export async function renderReceitas(container) {
  const [receitas, catalogo] = await Promise.all([
    api.listarReceitas(),
    api.listarCatalogoMedicamentos({ apenasAtivos: true }),
  ]);

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Receitas Médicas</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Fichas de dispensação com os medicamentos entregues. Gere o PDF para imprimir.</p>
        </div>
        <button class="btn btn-primary" id="btnAbrirModalReceita">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova Receita
        </button>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Medicamentos</th>
              <th>Médico Prescritor</th>
              <th>Data</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${receitas.length === 0
              ? `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhuma receita registrada.</td></tr>`
              : receitas.map(r => `
                  <tr>
                    <td><div style="font-weight: 700; color: var(--text-title);">${esc(r.cliente_nome || 'Cliente #' + r.cliente_id)}</div></td>
                    <td style="max-width: 360px;">${medicamentosDaLinha(r)}</td>
                    <td>${r.medico_prescritor ? esc(r.medico_prescritor) : '<span style="color: var(--text-muted);">—</span>'}</td>
                    <td><span class="badge badge-neutral">🗓️ ${esc(formatarDataBR(r.data_venda) || r.data_venda)}</span></td>
                    <td style="text-align: right;">
                      <div class="row-actions">
                        <button type="button" class="btn-icon" data-acao="pdf" data-id="${esc(r.id)}" title="Gerar PDF" aria-label="Gerar PDF">${ICONE_PDF}</button>
                        ${botoesAcoes(r.id)}
                      </div>
                    </td>
                  </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVA / EDITAR RECEITA -->
    <div class="modal-overlay" id="modalReceita">
      <div class="modal-card modal-wide">
        <div class="modal-header">
          <h3 class="modal-title" id="tituloModalReceita">Nova Receita</h3>
          <button class="modal-close" id="btnFecharModalReceita" type="button">&times;</button>
        </div>
        <form id="formReceita" novalidate>
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label" for="rec_paciente">Paciente <span class="req">*</span></label>
              <div><input type="text" class="form-input" id="rec_paciente" autocomplete="off" placeholder="Buscar paciente por nome ou CPF…"/></div>
              <div class="paciente-card" id="rec_paciente_card" hidden></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="rec_data">Data da Venda <span class="req">*</span></label>
              <input type="date" class="form-input" id="rec_data" value="${hojeISO()}"/>
            </div>

            <div class="form-group">
              <label class="form-label" for="rec_medico">Médico Prescritor</label>
              <input type="text" class="form-input" id="rec_medico" maxlength="200" placeholder="Dr. Nome — CRM 12345"/>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Medicamentos <span class="req">*</span></label>
              <div id="rec_itens"></div>
              <button type="button" class="btn btn-secondary" id="btnAdicionarMedicamento">+ Adicionar Medicamento</button>
              <small id="rec_dica_catalogo" style="display: block; margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);"></small>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label" for="rec_obs">Observações</label>
              <textarea class="form-textarea" id="rec_obs" maxlength="2000" placeholder="Instruções adicionais..."></textarea>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary" id="btnCancelarReceita">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarReceita">Salvar</button>
            <button type="button" class="btn btn-primary" id="btnSalvarPdfReceita">Salvar e gerar PDF</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const campo = id => document.getElementById(id);
  const modal = campo('modalReceita');
  const form = campo('formReceita');
  const listaItens = campo('rec_itens');
  const cartao = campo('rec_paciente_card');
  const inputPaciente = campo('rec_paciente');
  const btnAdicionar = campo('btnAdicionarMedicamento');
  const botoesSalvar = [campo('btnSalvarReceita'), campo('btnSalvarPdfReceita')];

  const catalogoPorId = new Map(catalogo.map(m => [m.id, m]));
  let editando = null;
  let paciente = null;

  // ── Paciente ────────────────────────────────────────────
  function mostrarPaciente(p, { podeTrocar }) {
    paciente = p;
    inputPaciente.value = p.nome;
    inputPaciente.readOnly = true;
    inputPaciente.classList.add('selecionado');
    cartao.hidden = false;
    cartao.innerHTML = `
      <div class="paciente-card-topo">
        <strong>${esc(p.nome)}</strong>
        ${podeTrocar ? '<button type="button" class="btn-limpar" id="rec_paciente_limpar" aria-label="Trocar paciente" title="Trocar paciente">x</button>' : ''}
      </div>
      <div class="paciente-card-dados">
        <span><b>CPF:</b> ${esc(p.cpf || '—')}</span>
        <span><b>RG:</b> ${esc(p.rg || '—')}</span>
        <span><b>Nascimento:</b> ${esc(formatarDataBR(p.data_nascimento) || '—')}</span>
        <span><b>Contato:</b> ${esc(p.telefone || '—')}</span>
      </div>`;
    if (podeTrocar) campo('rec_paciente_limpar').onclick = () => limparPaciente();
  }

  function limparPaciente({ focar = true } = {}) {
    paciente = null;
    inputPaciente.readOnly = false;
    inputPaciente.classList.remove('selecionado');
    inputPaciente.value = '';
    cartao.hidden = true;
    cartao.replaceChildren();
    if (focar) inputPaciente.focus();
  }

  criarAutocomplete({
    input: inputPaciente,
    minimo: 2,
    buscar: termo => api.listarClientes(termo),
    rotulo: c => c.nome,
    detalhe: c => (c.cpf ? `CPF ${c.cpf}` : ''),
    aoEscolher: c => mostrarPaciente(c, { podeTrocar: true }),
  });

  // ── Medicamentos ────────────────────────────────────────
  function buscarNoCatalogo(termo) {
    const t = semAcento(termo);
    return catalogo
      .filter(m => !t || semAcento(`${m.descricao} ${m.rms} ${m.laboratorio || ''}`).includes(t))
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  }

  /** Descobre qual medicamento do catálogo (ou item já salvo) o campo representa. `null` = não escolhido. */
  function resolverItem(el) {
    const digitado = normalizar(el.querySelector('.med-nome').value);
    if (!digitado) return null;

    const escolhido = catalogoPorId.get(Number(el.dataset.catalogoId));
    if (escolhido && normalizar(escolhido.descricao) === digitado) return { catalogo_id: escolhido.id, med: escolhido };

    if (el.dataset.itemId && normalizar(el.dataset.nomeOriginal) === digitado) {
      return {
        id: Number(el.dataset.itemId),
        med: { descricao: el.dataset.nomeOriginal, rms: el.dataset.rmsOriginal || '', laboratorio: el.dataset.labOriginal || '' },
      };
    }

    const iguais = catalogo.filter(m => normalizar(m.descricao) === digitado);
    return iguais.length === 1 ? { catalogo_id: iguais[0].id, med: iguais[0] } : null;
  }

  function atualizarCamposDoItem(el) {
    const resolvido = resolverItem(el);
    el.querySelector('.med-rms').value = resolvido?.med.rms || '';
    el.querySelector('.med-laboratorio').value = resolvido?.med.laboratorio || '';
    el.querySelector('.med-nome').classList.remove('invalido'); // só volta a marcar quando sair do campo (ver abaixo)
  }

  /** Destaca em vermelho um nome que não é do catálogo — apenas ao sair do campo, não a cada tecla. */
  function marcarSeInvalido(el) {
    const nome = el.querySelector('.med-nome');
    nome.classList.toggle('invalido', !resolverItem(el) && !!nome.value.trim());
  }

  function atualizarControlesDaLista() {
    const total = listaItens.children.length;
    listaItens.querySelectorAll('.med-remover').forEach(b => { b.hidden = total <= 1; });
    btnAdicionar.disabled = total >= MAX_MEDICAMENTOS;
    btnAdicionar.title = total >= MAX_MEDICAMENTOS ? `Máximo de ${MAX_MEDICAMENTOS} medicamentos por receita` : '';
  }

  function adicionarItem(item = null) {
    const el = document.createElement('div');
    el.className = 'med-item';
    el.innerHTML = `
      <div class="med-linha med-linha-1">
        <div><input type="text" class="form-input med-nome" autocomplete="off" placeholder="💊 Nome do medicamento *" aria-label="Nome do medicamento"/></div>
        <input type="text" class="form-input med-dose" maxlength="60" placeholder="Dose (ex: 500mg)" aria-label="Dose"/>
        <input type="text" class="form-input med-posologia" maxlength="200" placeholder="Posologia" aria-label="Posologia"/>
        <button type="button" class="btn-icon btn-icon-danger med-remover" title="Remover medicamento" aria-label="Remover medicamento">${ICONE_LIXO}</button>
      </div>
      <div class="med-linha med-linha-2">
        <input type="text" class="form-input med-rms" readonly tabindex="-1" placeholder="RMS" aria-label="RMS"/>
        <input type="text" class="form-input med-lote" maxlength="60" placeholder="Lote" aria-label="Lote"/>
        <input type="text" class="form-input med-validade" maxlength="20" placeholder="Validade" aria-label="Validade"/>
        <input type="text" class="form-input med-laboratorio" readonly tabindex="-1" placeholder="Laboratório" aria-label="Laboratório"/>
        <input type="number" class="form-input med-quant" min="1" max="9999" step="1" placeholder="Quant" aria-label="Quantidade"/>
      </div>`;
    listaItens.appendChild(el);

    const nome = el.querySelector('.med-nome');
    if (item) {
      // item já salvo: guarda a cópia original (RMS e laboratório da época da receita)
      Object.assign(el.dataset, { itemId: item.id, nomeOriginal: item.medicamento, rmsOriginal: item.rms || '', labOriginal: item.laboratorio || '' });
      nome.value = item.medicamento;
      el.querySelector('.med-dose').value = item.dose || '';
      el.querySelector('.med-posologia').value = item.posologia || '';
      el.querySelector('.med-lote').value = item.lote || '';
      el.querySelector('.med-validade').value = item.validade || '';
      el.querySelector('.med-quant').value = item.quantidade ?? '';
      atualizarCamposDoItem(el);
    }

    criarAutocomplete({
      input: nome,
      buscar: buscarNoCatalogo,
      maximo: 10,
      rotulo: m => m.descricao,
      detalhe: m => [m.rms && `RMS ${m.rms}`, m.laboratorio].filter(Boolean).join(' · '),
      aoEscolher: m => {
        nome.value = m.descricao;
        el.dataset.catalogoId = m.id;
        atualizarCamposDoItem(el);
      },
    });
    nome.addEventListener('input', () => atualizarCamposDoItem(el));
    // pequena espera: escolher na lista (mousedown) acontece antes de o campo perder o foco
    nome.addEventListener('blur', () => setTimeout(() => marcarSeInvalido(el), 150));
    el.querySelector('.med-remover').onclick = () => { el.remove(); atualizarControlesDaLista(); };

    atualizarControlesDaLista();
    return el;
  }

  btnAdicionar.onclick = () => {
    const el = adicionarItem();
    el.querySelector('.med-nome').focus();
  };

  // ── Abrir / fechar ──────────────────────────────────────
  async function abrirModal(receita = null) {
    editando = receita;
    paciente = null;
    form.reset();
    campo('rec_data').value = hojeISO();
    listaItens.replaceChildren();
    limparPaciente({ focar: false });
    campo('tituloModalReceita').textContent = receita ? 'Editar Receita' : 'Nova Receita';
    campo('rec_dica_catalogo').textContent = catalogo.length
      ? ''
      : 'O catálogo de medicamentos está vazio. Peça a um administrador para cadastrar em Configurações → Catálogo de Medicamentos.';
    botoesSalvar.forEach(b => { b.disabled = !catalogo.length && !receita; });

    if (receita) {
      campo('rec_data').value = receita.data_venda || hojeISO();
      campo('rec_medico').value = receita.medico_prescritor || '';
      campo('rec_obs').value = receita.observacoes || '';
      (receita.itens || []).forEach(i => adicionarItem(i));
      // o paciente de uma receita já registrada não pode ser trocado
      let dados;
      try { dados = await api.obterCliente(receita.cliente_id); } catch (_) { dados = { nome: receita.cliente_nome || 'Paciente' }; }
      mostrarPaciente(dados, { podeTrocar: false });
    } else {
      adicionarItem();
    }
    modal.classList.add('active');
    if (!receita) inputPaciente.focus();
  }
  const fecharModal = () => modal.classList.remove('active');

  campo('btnAbrirModalReceita').onclick = () => abrirModal();
  campo('btnFecharModalReceita').onclick = fecharModal;
  campo('btnCancelarReceita').onclick = fecharModal;

  // ── Salvar ──────────────────────────────────────────────
  /** Lê o formulário e devolve o corpo da requisição. Lança Error com mensagem para o usuário. */
  function coletar() {
    if (!editando && !paciente) throw new Error('Escolha o paciente.');
    if (!campo('rec_data').value) throw new Error('Informe a data da venda.');

    const itens = [...listaItens.children].map((el, i) => {
      const resolvido = resolverItem(el);
      if (!resolvido) throw new Error(`Medicamento ${i + 1}: escolha um medicamento da lista do catálogo.`);
      const quant = el.querySelector('.med-quant').value.trim();
      if (quant && !/^\d+$/.test(quant)) throw new Error(`Medicamento ${i + 1}: a quantidade deve ser um número inteiro.`);
      const valor = seletor => el.querySelector(seletor).value.trim() || null;
      return {
        ...(resolvido.catalogo_id ? { catalogo_id: resolvido.catalogo_id } : { id: resolvido.id }),
        dose: valor('.med-dose'),
        posologia: valor('.med-posologia'),
        lote: valor('.med-lote'),
        validade: valor('.med-validade'),
        quantidade: quant ? parseInt(quant, 10) : null,
      };
    });

    const corpo = {
      data_venda: campo('rec_data').value,
      medico_prescritor: campo('rec_medico').value.trim() || null,
      observacoes: campo('rec_obs').value.trim() || null,
      itens,
    };
    if (!editando) {
      corpo.cliente_id = paciente.id;
      corpo.cliente_nome = paciente.nome;
    }
    return corpo;
  }

  async function salvar({ gerarPdf }) {
    let corpo;
    try {
      corpo = coletar();
    } catch (err) {
      alert(err.message);
      return;
    }

    botoesSalvar.forEach(b => { b.disabled = true; });
    try {
      const receita = editando ? await api.atualizarReceita(editando.id, corpo) : await api.cadastrarReceita(corpo);
      if (gerarPdf) {
        try {
          await baixarPdfReceita(receita, paciente);
        } catch (err) {
          alert('A receita foi salva, mas não foi possível gerar o PDF: ' + err.message);
        }
      }
      fecharModal();
      await renderReceitas(container);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      botoesSalvar.forEach(b => { b.disabled = false; });
    }
  }

  form.onsubmit = (e) => { e.preventDefault(); salvar({ gerarPdf: false }); };
  campo('btnSalvarPdfReceita').onclick = () => salvar({ gerarPdf: true });

  // ── Ações da tabela ─────────────────────────────────────
  const porId = id => receitas.find(r => String(r.id) === String(id));
  ligarAcoes(container, {
    editar: id => abrirModal(porId(id)),
    excluir: id => confirmarEExcluir({
      mensagem: `Excluir a receita de ${porId(id)?.cliente_nome || 'este paciente'}? Esta ação não pode ser desfeita.`,
      excluir: () => api.excluirReceita(id),
      aoConcluir: () => renderReceitas(container),
    }),
    pdf: async (id, botao) => {
      const receita = porId(id);
      botao.disabled = true;
      try {
        const dados = await api.obterCliente(receita.cliente_id);
        await baixarPdfReceita(receita, dados);
      } catch (err) {
        alert('Não foi possível gerar o PDF: ' + err.message);
      } finally {
        botao.disabled = false;
      }
    },
  });
}
