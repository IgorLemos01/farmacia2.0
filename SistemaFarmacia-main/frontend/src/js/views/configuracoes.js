// ============================================================
//  VIEW: CONFIGURAÇÕES (SOMENTE ADMIN) — USUÁRIOS E CATÁLOGO DE EXAMES
// ============================================================

import { api, MODO_DEMO, sessao } from '../api.js';
import { botoesAcoes, escapeHtml as esc, ligarAcoes } from '../utils.js';
import { MODULOS, PERFIS, podeAcessar, rotulosDosModulos, ROTA_CONFIGURACOES } from '../permissoes.js';
import { renderCatalogo } from './catalogo.js';
import { renderCatalogoMedicamentos } from './catalogo_medicamentos.js';

const dataBR = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '-');

const ABAS = {
  usuarios: { titulo: 'Usuários', render: renderUsuarios },
  catalogo: { titulo: 'Catálogo de Exames', render: renderCatalogo },
  medicamentos: { titulo: 'Catálogo de Medicamentos', render: renderCatalogoMedicamentos },
};
let abaAtual = 'usuarios';

export async function renderConfiguracoes(container) {
  const logado = sessao.usuario();

  // A API também recusa quem não é admin; aqui só evitamos mostrar uma tela inútil.
  if (!podeAcessar(logado, ROTA_CONFIGURACOES)) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 48px 24px;">
        <p style="font-size: 1.05rem; font-weight: 800; color: var(--text-title); margin-bottom: 6px;">Acesso restrito</p>
        <p style="font-size: 0.88rem; color: var(--text-muted);">Somente administradores podem gerenciar usuários e os catálogos de exames e medicamentos.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    ${MODO_DEMO ? `
      <div class="card" style="margin-bottom: 16px; padding: 14px 20px; font-size: 0.85rem; color: var(--badge-warning-text); background: var(--badge-warning-bg);">
        <strong>Modo demonstração:</strong> os dados desta tela são fictícios, ficam salvos só neste navegador e não existe login real.
      </div>` : ''}
    <div class="tabs" role="tablist">
      ${Object.entries(ABAS).map(([chave, aba]) =>
        `<button type="button" class="tab ${chave === abaAtual ? 'active' : ''}" role="tab" data-aba="${chave}" aria-selected="${chave === abaAtual}">${esc(aba.titulo)}</button>`).join('')}
    </div>
    <div id="conteudoConfig"></div>`;

  const conteudo = container.querySelector('#conteudoConfig');

  async function mostrarAba() {
    try {
      await ABAS[abaAtual].render(conteudo);
    } catch (err) {
      if (err.status === 401) return; // a tela de login já foi exibida
      conteudo.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <p style="font-weight: 700; color: var(--text-title); margin-bottom: 6px;">Não foi possível carregar os dados.</p>
          <p style="font-size: 0.85rem;">${esc(err.message)}</p>
        </div>`;
    }
  }

  container.querySelectorAll('[data-aba]').forEach(botao => {
    botao.onclick = () => {
      abaAtual = botao.dataset.aba;
      container.querySelectorAll('[data-aba]').forEach(b => {
        const ativa = b.dataset.aba === abaAtual;
        b.classList.toggle('active', ativa);
        b.setAttribute('aria-selected', String(ativa));
      });
      mostrarAba();
    };
  });

  await mostrarAba();
}

async function renderUsuarios(container) {
  const logado = sessao.usuario();
  const usuarios = await api.listarUsuarios();

  container.innerHTML = `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Usuários do Sistema</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Escolha o perfil e os módulos de cada pessoa. Usuários não são excluídos: desative o acesso de quem saiu da equipe.</p>
        </div>
        <button class="btn btn-primary" id="btnAbrirModalUsuario">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Usuário
        </button>
      </div>

      <div class="table-responsive">
        <table class="table-modern">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Acessos</th>
              <th>Situação</th>
              <th>Criado em</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${usuarios.length === 0
              ? `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum usuário cadastrado.</td></tr>`
              : usuarios.map(u => `
                  <tr>
                    <td>
                      <div class="cell-user">
                        <div class="user-initials">${esc((u.nome || '').substring(0, 2).toUpperCase())}</div>
                        <div>
                          <div style="font-weight: 700; color: var(--text-title);">${esc(u.nome)}${String(u.id) === String(logado?.id) ? ' <span style="font-weight: 500; color: var(--text-muted);">(você)</span>' : ''}</div>
                          <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(u.email)}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="badge ${u.perfil === 'admin' ? 'badge-info' : 'badge-neutral'}">${esc(PERFIS[u.perfil] || u.perfil)}</span></td>
                    <td style="max-width: 280px;">${acessosDoUsuario(u)}</td>
                    <td><span class="badge ${u.ativo ? 'badge-success' : 'badge-danger'}">${u.ativo ? 'Ativo' : 'Desativado'}</span></td>
                    <td>${esc(dataBR(u.criado_em))}</td>
                    <td style="text-align: right;"><div class="row-actions">${botoesAcoes(u.id, { excluir: false })}</div></td>
                  </tr>
                `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL NOVO / EDITAR USUÁRIO -->
    <div class="modal-overlay" id="modalUsuario">
      <div class="modal-card modal-wide">
        <div class="modal-header">
          <h3 class="modal-title" id="tituloModalUsuario">Novo Usuário</h3>
          <button class="modal-close" id="btnFecharModalUsuario" type="button">&times;</button>
        </div>
        <form id="formUsuario" novalidate>
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label" for="usr_nome">Nome <span class="req">*</span></label>
              <input type="text" class="form-input" id="usr_nome" maxlength="120" placeholder="Ex: Ana Silva"/>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label" for="usr_email">E-mail de acesso <span class="req">*</span></label>
              <input type="email" class="form-input" id="usr_email" maxlength="120" autocomplete="off" placeholder="ana@farmaciacouto.com.br"/>
            </div>

            <div class="form-group">
              <label class="form-label" for="usr_perfil">Perfil <span class="req">*</span></label>
              <select class="form-select" id="usr_perfil">
                <option value="funcionario">Funcionário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="usr_senha"><span id="textoSenhaUsuario">Senha</span> <span class="req" id="obrigSenhaUsuario">*</span></label>
              <input type="password" class="form-input" id="usr_senha" autocomplete="new-password"/>
            </div>

            <fieldset class="form-group form-group-full modulos-campo" id="grupoModulos">
              <legend class="form-label">Módulos que ele pode acessar</legend>
              <div class="modulos-grid">
                ${MODULOS.map(m => `
                  <label class="modulo-opcao">
                    <input type="checkbox" name="usr_modulo" value="${esc(m.chave)}"/>
                    <span><strong>${esc(m.rotulo)}</strong><small>${esc(m.descricao)}</small></span>
                  </label>`).join('')}
              </div>
              <small class="modulos-dica" id="dicaModulos"></small>
            </fieldset>

            <div class="form-group form-group-full" id="grupoAtivoUsuario">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--text-body); cursor: pointer;">
                <input type="checkbox" id="usr_ativo"/> Acesso ativo (desmarque para impedir o login)
              </label>
            </div>

            <p id="avisoProprioUsuario" class="form-group-full" style="display: none; font-size: 0.8rem; color: var(--text-muted);">
              Você não pode mudar o seu próprio perfil nem desativar o seu usuário.
            </p>
          </div>

          <p id="erroUsuario" role="alert" hidden style="margin-bottom: 14px; padding: 10px 14px; border-radius: var(--radius-md); background: var(--badge-danger-bg); color: var(--badge-danger-text); font-size: 0.83rem;"></p>

          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btnCancelarUsuario">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btnSalvarUsuario">Criar Usuário</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById('modalUsuario');
  const form = document.getElementById('formUsuario');
  const campo = id => document.getElementById(id);
  const caixasModulos = () => [...form.querySelectorAll('input[name="usr_modulo"]')];
  let editando = null;
  let proprio = false;

  /** Administrador acessa tudo: as caixas ficam marcadas e travadas. Funcionário escolhe. */
  function ajustarModulos() {
    const admin = campo('usr_perfil').value === 'admin';
    caixasModulos().forEach(caixa => {
      if (admin) caixa.checked = true;
      caixa.disabled = admin || proprio;
    });
    campo('dicaModulos').textContent = admin
      ? 'O administrador acessa todos os módulos e também a tela de Configurações (usuários e catálogos).'
      : 'Marque ao menos um módulo. A tela de Configurações é exclusiva do administrador.';
  }

  const mostrarErro = (mensagem) => { campo('erroUsuario').textContent = mensagem; campo('erroUsuario').hidden = false; };
  const limparErro = () => { campo('erroUsuario').textContent = ''; campo('erroUsuario').hidden = true; };

  function abrirModal(usuario = null) {
    editando = usuario;
    proprio = !!usuario && String(usuario.id) === String(logado?.id);
    form.reset();
    limparErro();

    campo('tituloModalUsuario').textContent = usuario ? 'Editar Usuário' : 'Novo Usuário';
    campo('btnSalvarUsuario').textContent = usuario ? 'Salvar Alterações' : 'Criar Usuário';

    // E-mail é o login: definido na criação e não muda depois.
    campo('usr_email').disabled = !!usuario;
    campo('textoSenhaUsuario').textContent = usuario ? 'Nova senha (opcional)' : 'Senha';
    campo('obrigSenhaUsuario').style.display = usuario ? 'none' : '';
    campo('usr_senha').placeholder = usuario ? 'Deixe em branco para manter a atual' : 'Mínimo de 6 caracteres';
    campo('grupoAtivoUsuario').style.display = usuario ? '' : 'none';
    campo('usr_perfil').disabled = proprio;
    campo('usr_ativo').disabled = proprio;
    campo('avisoProprioUsuario').style.display = proprio ? '' : 'none';

    if (usuario) {
      campo('usr_nome').value = usuario.nome || '';
      campo('usr_email').value = usuario.email || '';
      campo('usr_perfil').value = usuario.perfil;
      campo('usr_ativo').checked = !!usuario.ativo;
      caixasModulos().forEach(caixa => { caixa.checked = (usuario.modulos || []).includes(caixa.value); });
    }
    ajustarModulos();
    modal.classList.add('active');
    campo('usr_nome').focus();
  }
  const fecharModal = () => modal.classList.remove('active');

  campo('usr_perfil').addEventListener('change', ajustarModulos);
  campo('btnAbrirModalUsuario').onclick = () => abrirModal();
  campo('btnFecharModalUsuario').onclick = fecharModal;
  campo('btnCancelarUsuario').onclick = fecharModal;

  ligarAcoes(container, {
    editar: id => abrirModal(usuarios.find(u => String(u.id) === String(id))),
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    limparErro();

    const nome = campo('usr_nome').value.trim();
    const email = campo('usr_email').value.trim();
    const senha = campo('usr_senha').value;
    const perfil = campo('usr_perfil').value;
    const modulos = caixasModulos().filter(c => c.checked).map(c => c.value);

    // Avisos na própria janela, antes de enviar
    if (nome.length < 3) return mostrarErro('Informe o nome (pelo menos 3 letras).');
    if (!editando && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return mostrarErro('Informe um e-mail válido.');
    if (!editando && senha.length < 6) return mostrarErro('A senha precisa ter pelo menos 6 caracteres.');
    if (editando && senha && senha.length < 6) return mostrarErro('A nova senha precisa ter pelo menos 6 caracteres.');
    if (perfil === 'funcionario' && !modulos.length) return mostrarErro('Marque ao menos um módulo para o funcionário.');

    const botao = campo('btnSalvarUsuario');
    botao.disabled = true;
    try {
      if (editando) {
        const payload = { nome };
        if (!proprio) {
          payload.perfil = perfil;
          payload.modulos = modulos;
          payload.ativo = campo('usr_ativo').checked;
        }
        if (senha) payload.senha = senha;
        await api.atualizarUsuario(editando.id, payload);

        if (proprio && !MODO_DEMO) {
          // mantém o nome do topo da página em dia
          sessao.guardarUsuario({ ...logado, nome });
          window.dispatchEvent(new CustomEvent('fc:usuario-atualizado'));
        }
      } else {
        await api.cadastrarUsuario({ nome, email, senha, perfil, modulos });
      }
      fecharModal();
      await renderUsuarios(container);
    } catch (err) {
      mostrarErro(err.message);
    } finally {
      botao.disabled = false;
    }
  };
}

/** Resumo do que o usuário acessa, em etiquetas. */
function acessosDoUsuario(u) {
  if (u.perfil === 'admin') return '<span style="font-size: 0.8rem; color: var(--text-body);">Todos os módulos + Configurações</span>';
  const nomes = rotulosDosModulos(u);
  if (!nomes.length) return '<span style="font-size: 0.8rem; color: var(--badge-danger-text);">Nenhum módulo</span>';
  return `<div style="display: flex; flex-wrap: wrap; gap: 4px;">${nomes.map(n => `<span class="badge badge-neutral">${esc(n)}</span>`).join('')}</div>`;
}
