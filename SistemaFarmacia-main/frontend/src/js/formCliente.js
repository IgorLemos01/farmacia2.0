// ============================================================
//  FORMULÁRIO DE CLIENTE — cadastro rápido e progressivo
//
//  Obrigatórios: nome e WhatsApp/telefone. O resto (documentos, endereço) é
//  opcional e pode ser completado nos próximos atendimentos.
//  Usado pela tela de Clientes e pelas telas de atendimento (Manipulação,
//  Exames e Receitas), por cima do formulário que já está aberto.
// ============================================================

import { api } from './api.js';
import { escapeHtml as esc } from './utils.js';
import {
  aplicarMascara, CAMPOS_COMPLEMENTARES, camposPendentes, mascaraCep, mascaraCpf, mascaraTelefone,
  SEXOS, UFS, validarCliente,
} from './validacao.js';

const CAMPOS = [
  'nome', 'telefone', 'alergia', 'cpf', 'rg', 'data_nascimento', 'sexo', 'email',
  'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'observacoes',
];

const TITULOS = {
  novo: 'Novo Cliente',
  rapido: 'Cadastro Rápido',
  editar: 'Editar Cliente',
  completar: 'Completar Cadastro',
};

function html(modo) {
  return `
    <div class="modal-card modal-wide">
      <div class="modal-header">
        <h3 class="modal-title">${esc(TITULOS[modo])}</h3>
        <button class="modal-close" type="button" data-fechar aria-label="Fechar">&times;</button>
      </div>
      <form novalidate>
        <p class="form-dica-topo">
          ${modo === 'completar'
            ? 'Preencha o que o cliente tiver em mãos agora. Os campos destacados ainda estão em branco; nada aqui é obrigatório.'
            : 'Só <strong>nome</strong> e <strong>WhatsApp</strong> são obrigatórios. Documentos e endereço podem ficar para o próximo atendimento.'}
        </p>
        <div class="form-grid">
          <div class="form-group form-group-full">
            <label class="form-label" for="fc_nome">Nome completo <span class="req">*</span></label>
            <input type="text" class="form-input" id="fc_nome" maxlength="150" autocomplete="off" placeholder="Ex: Ana Maria dos Santos"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="fc_telefone">WhatsApp / Telefone <span class="req">*</span></label>
            <input type="tel" class="form-input" id="fc_telefone" inputmode="tel" autocomplete="off" placeholder="(79) 99999-9999"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="fc_alergia">⚠️ Alergias conhecidas</label>
            <input type="text" class="form-input" id="fc_alergia" maxlength="5000" placeholder="Ex: Dipirona, Penicilina, Iodo..."/>
          </div>
        </div>

        <details class="secao-opcional" ${modo === 'editar' || modo === 'completar' ? 'open' : ''}>
          <summary>Dados complementares <small>(opcionais)</small></summary>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="fc_cpf">CPF</label>
              <input type="text" class="form-input" id="fc_cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_rg">RG</label>
              <input type="text" class="form-input" id="fc_rg" maxlength="20" autocomplete="off" placeholder="0.000.000-SSP"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_data_nascimento">Data de nascimento</label>
              <input type="date" class="form-input" id="fc_data_nascimento"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_sexo">Sexo</label>
              <select class="form-select" id="fc_sexo">
                <option value="">Não informado</option>
                ${Object.entries(SEXOS).map(([v, r]) => `<option value="${v}">${r}</option>`).join('')}
              </select>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label" for="fc_email">E-mail</label>
              <input type="email" class="form-input" id="fc_email" maxlength="150" autocomplete="off" placeholder="cliente@email.com"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_cep">CEP</label>
              <input type="text" class="form-input" id="fc_cep" inputmode="numeric" autocomplete="off" placeholder="49000-000"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_endereco">Rua / Logradouro</label>
              <input type="text" class="form-input" id="fc_endereco" maxlength="300" placeholder="Rua, avenida, povoado..."/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_numero">Número</label>
              <input type="text" class="form-input" id="fc_numero" maxlength="20" placeholder="Ex: 123 ou S/N"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_complemento">Complemento</label>
              <input type="text" class="form-input" id="fc_complemento" maxlength="100" placeholder="Apto, bloco, referência"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_bairro">Bairro</label>
              <input type="text" class="form-input" id="fc_bairro" maxlength="100"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_cidade">Cidade</label>
              <input type="text" class="form-input" id="fc_cidade" maxlength="100"/>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc_estado">Estado (UF)</label>
              <select class="form-select" id="fc_estado">
                <option value="">—</option>
                ${UFS.map(uf => `<option value="${uf}">${uf}</option>`).join('')}
              </select>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label" for="fc_observacoes">Observações gerais</label>
              <textarea class="form-textarea" id="fc_observacoes" maxlength="5000" placeholder="Preferências de contato, histórico ou informações complementares..."></textarea>
            </div>
          </div>
        </details>

        <p class="form-erro" role="alert" hidden></p>

        <div class="form-acoes">
          <button type="button" class="btn btn-secondary" data-fechar>Cancelar</button>
          <button type="submit" class="btn btn-primary" data-salvar>${modo === 'editar' || modo === 'completar' ? 'Salvar Alterações' : 'Salvar Cadastro'}</button>
        </div>
      </form>
    </div>`;
}

/**
 * Abre o formulário de cliente por cima da tela atual.
 *
 * @param {object}  opcoes
 * @param {'novo'|'rapido'|'editar'|'completar'} [opcoes.modo='novo']
 * @param {object}  [opcoes.cliente]      Cliente a editar/completar.
 * @param {string}  [opcoes.nomeInicial]  Texto já digitado na busca (cadastro rápido).
 * @returns {Promise<object|null>} O cliente salvo, ou null se cancelou.
 */
export function abrirFormularioCliente({ modo = 'novo', cliente = null, nomeInicial = '' } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-sobreposto';
    overlay.innerHTML = html(modo);
    document.body.appendChild(overlay);

    const form = overlay.querySelector('form');
    const erro = overlay.querySelector('.form-erro');
    const salvar = overlay.querySelector('[data-salvar]');
    const campo = nome => overlay.querySelector(`#fc_${nome}`);

    aplicarMascara(campo('telefone'), mascaraTelefone);
    aplicarMascara(campo('cpf'), mascaraCpf);
    aplicarMascara(campo('cep'), mascaraCep);

    if (cliente) {
      CAMPOS.forEach(c => { campo(c).value = cliente[c] ?? ''; });
    } else if (nomeInicial) {
      // texto digitado na busca: se for número, provavelmente é o telefone
      const soNumeros = nomeInicial.replace(/\D/g, '');
      if (soNumeros.length >= 8 && soNumeros.length === nomeInicial.replace(/[\s().-]/g, '').length) {
        campo('telefone').value = mascaraTelefone(nomeInicial);
      } else {
        campo('nome').value = nomeInicial;
      }
    }

    if (modo === 'completar') {
      const pendentes = Object.keys(CAMPOS_COMPLEMENTARES).filter(c => !cliente?.[c]);
      pendentes.forEach(c => campo(c).classList.add('campo-pendente'));
    }

    let terminado = false;
    function fechar(resultado) {
      if (terminado) return;
      terminado = true;
      overlay.classList.remove('active');
      document.removeEventListener('keydown', aoTeclar, true);
      setTimeout(() => overlay.remove(), 250);
      resolve(resultado);
    }
    function aoTeclar(ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); fechar(null); }
    }
    document.addEventListener('keydown', aoTeclar, true);
    overlay.querySelectorAll('[data-fechar]').forEach(b => { b.onclick = () => fechar(null); });

    const mostrarErro = msg => { erro.textContent = msg; erro.hidden = false; };

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      erro.hidden = true;
      const dados = Object.fromEntries(CAMPOS.map(c => [c, campo(c).value.trim() || null]));
      // CPF antigo (fora do padrão) que não foi mexido não é revalidado, como no servidor
      if (cliente && (dados.cpf || null) === (cliente.cpf || null)) delete dados.cpf;

      try {
        validarCliente(dados);
      } catch (e) {
        mostrarErro(e.message);
        return;
      }

      salvar.disabled = true;
      try {
        const salvo = cliente ? await api.atualizarCliente(cliente.id, dados) : await api.cadastrarCliente(dados);
        fechar(salvo);
      } catch (e) {
        mostrarErro(e.message);
        salvar.disabled = false;
      }
    };

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      const primeiro = modo === 'completar'
        ? overlay.querySelector('.campo-pendente') || campo('nome')
        : (campo('nome').value ? campo('telefone') : campo('nome'));
      primeiro.focus();
    });
  });
}

/** Etiqueta "Cadastro incompleto" com a lista do que falta (para tabelas e cartões). */
export function seloCadastro(cliente) {
  const pendentes = cliente?.campos_pendentes ?? camposPendentes(cliente);
  if (!pendentes.length) return '';
  return `<span class="badge badge-warning" title="Falta: ${esc(pendentes.join(', '))}">Cadastro incompleto</span>`;
}
