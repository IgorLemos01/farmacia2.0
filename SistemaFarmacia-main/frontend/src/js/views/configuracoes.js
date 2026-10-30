// ============================================================
//  VIEW: CONFIGURAÇÕES — GESTÃO DE USUÁRIOS (SOMENTE ADMIN)
// ============================================================

import { api, MODO_DEMO, sessao } from '../api.js';
import { botoesAcoes, escapeHtml as esc, ligarAcoes } from '../utils.js';

const NOME_PERFIL = { admin: 'Administrador', atendente: 'Atendente' };

const dataBR = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '-');

export async function renderConfiguracoes(container) {
  const logado = sessao.usuario();

  // A API também recusa quem não é admin; aqui só evitamos mostrar uma tela inútil.
  if (logado?.perfil !== 'admin' && logado?.perfil !== 'demo') {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 48px 24px;">
        <p style="font-size: 1.05rem; font-weight: 800; color: var(--text-title); margin-bottom: 6px;">Acesso restrito</p>
        <p style="font-size: 0.88rem; color: var(--text-muted);">Somente administradores podem gerenciar usuários e acessos.</p>
      </div>`;
    return;
  }

  const usuarios = await api.listarUsuarios();

  container.innerHTML = `
    ${MODO_DEMO ? `
      <div class="card" style="margin-bottom: 16px; padding: 14px 20px; font-size: 0.85rem; color: var(--badge-warning-text); background: var(--badge-warning-bg);">
        <strong>Modo demonstração:</strong> estes usuários são fictícios, ficam salvos só neste navegador e não existe login real.
      </div>` : ''}

    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 14px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-title); letter-spacing: -0.4px;">Usuários do Sistema</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Usuários não são excluídos: desative o acesso de quem saiu da equipe.</p>
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
              <th>Situação</th>
              <th>Criado em</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${usuarios.length === 0
              ? `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhum usuário cadastrado.</td></tr>`
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
                    <td><span class="badge ${u.perfil === 'admin' ? 'badge-info' : 'badge-neutral'}">${esc(NOME_PERFIL[u.perfil] || u.perfil)}</span></td>
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
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="tituloModalUsuario">Novo Usuário</h3>
          <button class="modal-close" id="btnFecharModalUsuario" type="button">&times;</button>
        </div>
        <form id="formUsuario">
          <div class="form-grid">
            <div class="form-group form-group-full">
              <label class="form-label" for="usr_nome">Nome <span class="req">*</span></label>
              <input type="text" class="form-input" id="usr_nome" required minlength="3" placeholder="Ex: Ana Silva"/>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label" for="usr_email">E-mail de acesso <span class="req">*</span></label>
              <input type="email" class="form-input" id="usr_email" required placeholder="ana@farmaciacouto.com.br"/>
            </div>

            <div class="form-group">
              <label class="form-label" for="usr_perfil">Perfil</label>
              <select class="form-select" id="usr_perfil">
                <option value="atendente">Atendente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="usr_senha"><span id="textoSenhaUsuario">Senha</span> <span class="req" id="obrigSenhaUsuario">*</span></label>
              <input type="password" class="form-input" id="usr_senha" minlength="6" autocomplete="new-password"/>
            </div>

            <div class="form-group form-group-full" id="grupoAtivoUsuario">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--text-body); cursor: pointer;">
                <input type="checkbox" id="usr_ativo"/> Acesso ativo (desmarque para impedir o login)
              </label>
            </div>

            <p id="avisoProprioUsuario" class="form-group-full" style="display: none; font-size: 0.8rem; color: var(--text-muted);">
              Você não pode mudar o seu próprio perfil nem desativar o seu usuário.
            </p>
          </div>

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
  let editando = null;
  let proprio = false;

  function abrirModal(usuario = null) {
    editando = usuario;
    proprio = !!usuario && String(usuario.id) === String(logado?.id);
    form.reset();

    campo('tituloModalUsuario').textContent = usuario ? 'Editar Usuário' : 'Novo Usuário';
    campo('btnSalvarUsuario').textContent = usuario ? 'Salvar Alterações' : 'Criar Usuário';

    // E-mail é o login: definido na criação e não muda depois.
    campo('usr_email').disabled = !!usuario;
    campo('usr_senha').required = !usuario;
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
    }
    modal.classList.add('active');
  }
  const fecharModal = () => modal.classList.remove('active');

  campo('btnAbrirModalUsuario').onclick = () => abrirModal();
  campo('btnFecharModalUsuario').onclick = fecharModal;
  campo('btnCancelarUsuario').onclick = fecharModal;

  ligarAcoes(container, {
    editar: id => abrirModal(usuarios.find(u => String(u.id) === String(id))),
    excluir: () => {},
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const nome = campo('usr_nome').value.trim();
    const senha = campo('usr_senha').value;

    try {
      if (editando) {
        const payload = { nome };
        if (!proprio) {
          payload.perfil = campo('usr_perfil').value;
          payload.ativo = campo('usr_ativo').checked;
        }
        if (senha) payload.senha = senha;
        await api.atualizarUsuario(editando.id, payload);

        if (proprio && !MODO_DEMO) {
          // mantém o nome do topo da página em dia
          sessao.salvar(sessao.token(), { ...logado, nome });
          window.dispatchEvent(new CustomEvent('fc:usuario-atualizado'));
        }
      } else {
        await api.cadastrarUsuario({
          nome,
          email: campo('usr_email').value.trim(),
          senha,
          perfil: campo('usr_perfil').value,
        });
      }
      fecharModal();
      await renderConfiguracoes(container);
    } catch (err) {
      alert('Erro ao salvar usuário: ' + err.message);
    }
  };
}
