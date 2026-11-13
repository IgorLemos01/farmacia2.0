// ============================================================
//  VIEW: RECEITAS — ficha de dispensação com vários medicamentos
//
//  - Medicamento novo no estoque? "+ Cadastrar novo medicamento" direto na busca,
//    sem perder o que já foi digitado na receita.
//  - RMS e laboratório vêm do catálogo, mas podem ser corrigidos conforme a caixa entregue.
//  - Dose e posologia são opcionais (o nome comercial costuma já trazer a dosagem).
//  - Farmacêutico responsável: o usuário logado (se for farmacêutico) ou escolhido na lista.
// ============================================================

import { api, sessao } from '../api.js';
import { criarAutocomplete } from '../autocomplete.js';
import { baixarPdfReceita, formatarDataBR, imprimirPdfReceita } from '../pdf.js';
import { criarSeletorPaciente } from '../seletorPaciente.js';
import { botoesAcoes, confirmarEExcluir, escapeHtml as esc, hojeISO, ligarAcoes, semAcento } from '../utils.js';

const MAX_MEDICAMENTOS = 12; // limite da API (3 por folha impressa)
const MAX_NA_LISTA = 3;

const ICONE_PDF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>';
const ICONE_IMPRIMIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
const ICONE_LIXO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

const normalizar = texto => String(texto ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** O nome comercial já traz a dosagem? ("ALPRAZOLAM 0,25 MG", "DIPIRONA 500MG/ML") */
export const nomeTemDosagem = nome => /\d+([.,]\d+)?\s*(mg|mcg|µg|g|ml|ui|%)(?![a-z])/i.test(String(nome ?? ''));

function medicamentosDaLinha(receita) {
  const itens = receita.itens?.length ? receita.itens : [{ medicamento: receita.medicamentos || '—', rms: '' }];
  const visiveis = itens.slice(0, MAX_NA_LISTA).map(i => `
    <span class="med-resumo">• ${esc(i.medicamento)}${i.rms ? ` <small>RMS ${esc(i.rms)}</small>` : ''}</span>`).join('');
  const resto = itens.length - MAX_NA_LISTA;
  return visiveis + (resto > 0 ? `<span class="med-resumo"><small>+ ${resto} medicamento(s)</small></span>` : '');
}

/** Formulário simples para cadastrar um medicamento no catálogo por cima da receita aberta. */
function abrirCadastroMedicamento(descricaoInicial = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-sobreposto';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Cadastrar novo medicamento</h3>
          <button class="modal-close" type="button" data-fechar aria-label="Fechar">&times;</button>
        </div>
        <form novalidate>
          <p class="form-dica-topo">O medicamento entra no catálogo e já fica escolhido nesta receita. O que você já digitou na receita não se perde.</p>
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label" for="nm_descricao">Descrição / apresentação <span class="req">*</span></label>
              <input type="text" class="form-input" id="nm_descricao" maxlength="255" placeholder="Ex: ALPRAZOLAM 0,25 MG 30 CPRS"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="nm_rms">RMS (Registro MS)</label>
              <input type="text" class="form-input" id="nm_rms" maxlength="30" inputmode="numeric" placeholder="13 dígitos da caixa"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="nm_laboratorio">Laboratório / Fabricante</label>
              <input type="text" class="form-input" id="nm_laboratorio" maxlength="150" placeholder="Ex: EMS, Eurofarma, Prati..."/>
            </div>
          </div>
          <p class="form-erro" role="alert" hidden></p>
          <div class="form-acoes">
            <button type="button" class="btn btn-secondary" data-fechar>Cancelar</button>
            <button type="submit" class="btn btn-primary" data-salvar>Cadastrar e usar</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    const campo = id => overlay.querySelector(`#nm_${id}`);
    const erro = overlay.querySelector('.form-erro');
    campo('descricao').value = descricaoInicial.toUpperCase();

    let terminado = false;
    const fechar = (resultado) => {
      if (terminado) return;
      terminado = true;
      overlay.classList.remove('active');
      document.removeEventListener('keydown', aoTeclar, true);
      setTimeout(() => overlay.remove(), 250);
      resolve(resultado);
    };
    function aoTeclar(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); fechar(null); } }
    document.addEventListener('keydown', aoTeclar, true);
    overlay.querySelectorAll('[data-fechar]').forEach(b => { b.onclick = () => fechar(null); });

    overlay.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      erro.hidden = true;
      const descricao = campo('descricao').value.replace(/\s+/g, ' ').trim();
      if (!descricao) { erro.textContent = 'Informe a descrição do medicamento.'; erro.hidden = false; return; }
      const rms = campo('rms').value.replace(/\s/g, '');
      if (rms && !/^\d+$/.test(rms)) { erro.textContent = 'O RMS deve ter só números.'; erro.hidden = false; return; }
      const botao = overlay.querySelector('[data-salvar]');
      botao.disabled = true;
      try {
        const med = await api.cadastrarCatalogoMedicamento({ descricao, rms, laboratorio: campo('laboratorio').value.trim() || null });
        fechar(med);
      } catch (e) {
        // já existe e está ativo: usa o existente em vez de duplicar
        if (e.status === 409 && e.dados?.medicamento) { fechar(e.dados.medicamento); return; }
        erro.textContent = e.message;
        erro.hidden = false;
        botao.disabled = false;
      }
    };
    requestAnimationFrame(() => { overlay.classList.add('active'); campo(descricaoInicial ? 'rms' : 'descricao').focus(); });
  });
}

export async function renderReceitas(container) {
  const [receitas, catalogo, farmaceuticos] = await Promise.all([
    api.listarReceitas(),
    api.listarCatalogoMedicamentos({ apenasAtivos: true }),
    api.listarFarmaceuticos().catch(() => []),
  ]);
  const logado = sessao.usuario();

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Receitas Médicas</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Fichas de dispensação com os medicamentos entregues. Imprima no tamanho de folha de cheque.</p>
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
              <th>Médico / Farmacêutico</th>
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
                    <td>
                      <div>${r.medico_prescritor ? esc(r.medico_prescritor) : '<span style="color: var(--text-muted);">—</span>'}</div>
                      <div style="font-size: 0.72rem; color: var(--text-muted);">${r.farmaceutico ? `Farm.: ${esc(r.farmaceutico.nome)}` : ''}</div>
                    </td>
                    <td><span class="badge badge-neutral">🗓️ ${esc(formatarDataBR(r.data_venda) || r.data_venda)}</span></td>
                    <td style="text-align: right;">
                      <div class="row-actions">
                        <button type="button" class="btn-icon" data-acao="imprimir" data-id="${esc(r.id)}" title="Imprimir ficha" aria-label="Imprimir ficha">${ICONE_IMPRIMIR}</button>
                        <button type="button" class="btn-icon" data-acao="pdf" data-id="${esc(r.id)}" title="Baixar PDF" aria-label="Baixar PDF">${ICONE_PDF}</button>
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
              <div id="rec_paciente_area"></div>
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
              <label class="form-label" for="rec_farmaceutico">Farmacêutico Responsável ${farmaceuticos.length ? '<span class="req">*</span>' : ''}</label>
              ${farmaceuticos.length
                ? `<select class="form-select" id="rec_farmaceutico">
                     <option value="">-- Selecione o farmacêutico do turno --</option>
                     ${farmaceuticos.map(f => `<option value="${Number(f.id)}">${esc(f.nome)}${f.registro_profissional ? ` — ${esc(f.registro_profissional)}` : ''}</option>`).join('')}
                   </select>`
                : `<p class="form-dica" id="rec_farmaceutico">Nenhum farmacêutico cadastrado: a ficha sai com o campo em branco para assinatura à mão.
                     Um administrador pode marcar o farmacêutico (com o CRF) em Configurações → Usuários.</p>`}
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">Medicamentos <span class="req">*</span></label>
              <div id="rec_itens"></div>
              <button type="button" class="btn btn-secondary" id="btnAdicionarMedicamento">+ Adicionar Medicamento</button>
              <small id="rec_dica_catalogo" class="form-dica"></small>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label" for="rec_obs">Observações</label>
              <textarea class="form-textarea" id="rec_obs" maxlength="2000" placeholder="Instruções adicionais..."></textarea>
            </div>
          </div>

          <div class="form-acoes">
            <button type="button" class="btn btn-secondary" id="btnCancelarReceita">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarReceita">Salvar</button>
            <button type="button" class="btn btn-primary" id="btnSalvarImprimirReceita">Salvar e imprimir</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const campo = id => document.getElementById(id);
  const modal = campo('modalReceita');
  const form = campo('formReceita');
  const listaItens = campo('rec_itens');
  const btnAdicionar = campo('btnAdicionarMedicamento');
  const selectFarmaceutico = farmaceuticos.length ? campo('rec_farmaceutico') : null;
  const botoesSalvar = [campo('btnSalvarReceita'), campo('btnSalvarImprimirReceita')];

  const catalogoPorId = new Map(catalogo.map(m => [m.id, m]));
  let editando = null;

  const seletor = criarSeletorPaciente({ raiz: campo('rec_paciente_area'), id: 'rec_paciente' });

  /** Farmacêutico padrão: o próprio usuário (se for farmacêutico) ou o único cadastrado. */
  function farmaceuticoPadrao() {
    if (farmaceuticos.some(f => String(f.id) === String(logado?.id))) return String(logado.id);
    return farmaceuticos.length === 1 ? String(farmaceuticos[0].id) : '';
  }

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

  /**
   * Quando o medicamento escolhido muda, RMS e laboratório recebem os do catálogo.
   * Depois disso o atendente pode corrigi-los (a caixa entregue pode ser de outro fabricante).
   */
  function atualizarCamposDoItem(el) {
    const resolvido = resolverItem(el);
    const chave = resolvido ? `${resolvido.catalogo_id ?? ''}|${resolvido.id ?? ''}` : '';
    if (chave !== (el.dataset.chaveAtual || '')) {
      el.dataset.chaveAtual = chave;
      el.querySelector('.med-rms').value = resolvido?.med.rms || '';
      el.querySelector('.med-laboratorio').value = resolvido?.med.laboratorio || '';
    }
    const temDosagem = nomeTemDosagem(el.querySelector('.med-nome').value);
    el.querySelector('.med-dose').placeholder = temDosagem ? 'Dose (já no nome)' : 'Dose (opcional)';
    el.querySelector('.med-nome').classList.remove('invalido'); // só volta a marcar quando sair do campo
  }

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

  function escolherMedicamento(el, m) {
    el.querySelector('.med-nome').value = m.descricao;
    el.dataset.catalogoId = m.id;
    atualizarCamposDoItem(el);
    el.querySelector('.med-lote').focus();
  }

  function adicionarItem(item = null) {
    const el = document.createElement('div');
    el.className = 'med-item';
    el.innerHTML = `
      <div class="med-linha med-linha-1">
        <div><input type="text" class="form-input med-nome" autocomplete="off" placeholder="💊 Buscar medicamento no catálogo *" aria-label="Nome do medicamento"/></div>
        <input type="text" class="form-input med-dose" maxlength="60" placeholder="Dose (opcional)" aria-label="Dose (opcional)"/>
        <input type="text" class="form-input med-posologia" maxlength="200" placeholder="Posologia (opcional)" aria-label="Posologia (opcional)"/>
        <button type="button" class="btn-icon btn-icon-danger med-remover" title="Remover medicamento" aria-label="Remover medicamento">${ICONE_LIXO}</button>
      </div>
      <div class="med-linha med-linha-2">
        <input type="text" class="form-input med-rms" maxlength="30" inputmode="numeric" placeholder="RMS" aria-label="RMS (Registro MS)" title="Registro no Ministério da Saúde — pode ser corrigido conforme a caixa"/>
        <input type="text" class="form-input med-lote" maxlength="60" placeholder="Lote" aria-label="Lote"/>
        <input type="text" class="form-input med-validade" maxlength="20" placeholder="Validade" aria-label="Validade"/>
        <input type="text" class="form-input med-laboratorio" maxlength="150" placeholder="Laboratório / Fabricante" aria-label="Laboratório" title="Troque se a caixa entregue for de outro fabricante"/>
        <input type="number" class="form-input med-quant" min="1" max="9999" step="1" placeholder="Quant" aria-label="Quantidade"/>
      </div>`;
    listaItens.appendChild(el);

    const nome = el.querySelector('.med-nome');
    if (item) {
      // item já salvo: guarda a cópia original e mantém RMS/laboratório gravados na receita
      Object.assign(el.dataset, { itemId: item.id, nomeOriginal: item.medicamento, rmsOriginal: item.rms || '', labOriginal: item.laboratorio || '' });
      el.dataset.chaveAtual = `|${item.id}`;
      nome.value = item.medicamento;
      el.querySelector('.med-rms').value = item.rms || '';
      el.querySelector('.med-laboratorio').value = item.laboratorio || '';
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
      aoEscolher: m => escolherMedicamento(el, m),
      acaoExtra: termo => ({
        rotulo: termo ? `+ Cadastrar novo medicamento "${termo}"` : '+ Cadastrar novo medicamento',
        aoAcionar: async (texto) => {
          const med = await abrirCadastroMedicamento(texto);
          if (!med) { nome.focus(); return; }
          if (!catalogoPorId.has(med.id)) {
            catalogo.push(med);
            catalogoPorId.set(med.id, med);
          }
          escolherMedicamento(el, med);
          campo('rec_dica_catalogo').textContent = '';
          botoesSalvar.forEach(b => { b.disabled = false; });
        },
      }),
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
    form.reset();
    campo('rec_data').value = hojeISO();
    listaItens.replaceChildren();
    seletor.limpar({ focar: false });
    campo('tituloModalReceita').textContent = receita ? 'Editar Receita' : 'Nova Receita';
    campo('rec_dica_catalogo').textContent = catalogo.length
      ? ''
      : 'O catálogo está vazio: use "+ Cadastrar novo medicamento" na busca do medicamento.';
    botoesSalvar.forEach(b => { b.disabled = false; });
    if (selectFarmaceutico) selectFarmaceutico.value = farmaceuticoPadrao();

    if (receita) {
      campo('rec_data').value = receita.data_venda || hojeISO();
      campo('rec_medico').value = receita.medico_prescritor || '';
      campo('rec_obs').value = receita.observacoes || '';
      if (selectFarmaceutico) {
        const atual = receita.farmaceutico?.id;
        selectFarmaceutico.value = farmaceuticos.some(f => String(f.id) === String(atual)) ? String(atual) : '';
      }
      (receita.itens || []).forEach(i => adicionarItem(i));
      // o paciente de uma receita já registrada não pode ser trocado
      let dados;
      try { dados = await api.obterCliente(receita.cliente_id); } catch (_) { dados = { id: receita.cliente_id, nome: receita.cliente_nome || 'Paciente', telefone: '' }; }
      seletor.definir(dados, { podeTrocar: false });
    } else {
      adicionarItem();
    }
    modal.classList.add('active');
    if (!receita) seletor.input.focus();
  }
  const fecharModal = () => modal.classList.remove('active');

  campo('btnAbrirModalReceita').onclick = () => abrirModal();
  campo('btnFecharModalReceita').onclick = fecharModal;
  campo('btnCancelarReceita').onclick = fecharModal;

  // ── Salvar ──────────────────────────────────────────────
  /** Lê o formulário e devolve o corpo da requisição. Lança Error com mensagem para o usuário. */
  function coletar() {
    if (!editando && !seletor.paciente) throw new Error('Escolha o paciente (ou cadastre um novo pela busca).');
    if (!campo('rec_data').value) throw new Error('Informe a data da venda.');

    const itens = [...listaItens.children].map((el, i) => {
      const resolvido = resolverItem(el);
      if (!resolvido) throw new Error(`Medicamento ${i + 1}: escolha um medicamento da lista ou use "+ Cadastrar novo medicamento".`);
      const quant = el.querySelector('.med-quant').value.trim();
      if (quant && !/^\d+$/.test(quant)) throw new Error(`Medicamento ${i + 1}: a quantidade deve ser um número inteiro.`);
      const rms = el.querySelector('.med-rms').value.replace(/\s/g, '');
      if (rms && !/^\d+$/.test(rms)) throw new Error(`Medicamento ${i + 1}: o RMS deve ter só números.`);
      const valor = seletor => el.querySelector(seletor).value.trim() || null;
      return {
        ...(resolvido.catalogo_id ? { catalogo_id: resolvido.catalogo_id } : { id: resolvido.id }),
        rms,
        laboratorio: valor('.med-laboratorio'),
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
    if (selectFarmaceutico) {
      // receita antiga sem farmacêutico pode ser editada sem escolher um (fica como estava)
      if (!selectFarmaceutico.value && !editando) throw new Error('Selecione o farmacêutico responsável.');
      if (selectFarmaceutico.value) corpo.farmaceutico_id = Number(selectFarmaceutico.value);
    }
    if (!editando) {
      corpo.cliente_id = seletor.paciente.id;
      corpo.cliente_nome = seletor.paciente.nome;
    }
    return corpo;
  }

  async function salvar({ imprimir }) {
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
      if (imprimir) {
        try {
          await imprimirPdfReceita(receita, seletor.paciente);
        } catch (err) {
          alert('A receita foi salva, mas não foi possível gerar a impressão: ' + err.message);
        }
      }
      fecharModal();
      await renderReceitas(container);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      botoesSalvar.forEach(b => { b.disabled = false; });
    }
  }

  form.onsubmit = (e) => { e.preventDefault(); salvar({ imprimir: false }); };
  campo('btnSalvarImprimirReceita').onclick = () => salvar({ imprimir: true });

  // ── Ações da tabela ─────────────────────────────────────
  const porId = id => receitas.find(r => String(r.id) === String(id));
  async function gerar(id, botao, funcao) {
    const receita = porId(id);
    botao.disabled = true;
    try {
      const dados = await api.obterCliente(receita.cliente_id);
      await funcao(receita, dados);
    } catch (err) {
      alert('Não foi possível gerar a ficha: ' + err.message);
    } finally {
      botao.disabled = false;
    }
  }
  ligarAcoes(container, {
    editar: id => abrirModal(porId(id)),
    excluir: id => confirmarEExcluir({
      mensagem: `Excluir a receita de ${porId(id)?.cliente_nome || 'este paciente'}? Esta ação não pode ser desfeita.`,
      excluir: () => api.excluirReceita(id),
      aoConcluir: () => renderReceitas(container),
    }),
    pdf: (id, botao) => gerar(id, botao, baixarPdfReceita),
    imprimir: (id, botao) => gerar(id, botao, imprimirPdfReceita),
  });
}
