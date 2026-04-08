/* js/pages/usuarios.js */
var FC = window.FC = window.FC || {};
FC.pages = FC.pages || {};

FC.pages.usuarios = (function(){
  var ui = null;
  var list = [];
  var editId = null;

  function init(){
    ui = document.getElementById('page-usuarios');
    if(!ui) return;
    
    ui.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="card-title">Gerenciamento de Acessos</div>
          <button class="btn btn-primary" id="btnNovoU" style="background:var(--accent2);color:#fff;">＋ Novo Colaborador</button>
        </div>
        <div class="alert-box alert-info">Gerentes podem criar/editar usuários, mas não gerentes. Administradores têm acesso total.</div>
        <div class="tbl-wrap" id="uTbl"></div>
      </div>
      <!-- Modal Form -->
      <div class="modal-overlay h" id="mdUsu">
        <div class="modal-box wide">
          <div class="modal-title" id="mTitleU">Novo Colaborador</div>
          <div class="form-grid">
            <div class="fg"><label>Nome Completo*</label><input type="text" id="fu_nome" placeholder="Nome real"/></div>
            <div class="fg"><label>E-mail de Acesso*</label><input type="email" id="fu_email" placeholder="usuario@farmaciacouto.com"/></div>
            
            <div class="fg"><label>Senha*</label><input type="password" id="fu_senha" placeholder="Mínimo 6 caracteres"/></div>
            <div class="fg">
               <label>Nível de Perfil*</label>
               <select id="fu_perfil" onchange="FC.pages.usuarios.togglePerms()">
                 <option value="atendente">Atendente (Básico)</option>
                 <option value="farmaceutico">Farmacêutico</option>
                 <option value="gerente">Gerente</option>
                 <option value="admin">Administrador (Total)</option>
               </select>
            </div>
            
            <div class="fg full" id="fu_perms_box">
                <label style="border-bottom:1px solid var(--border);padding-bottom:.5rem;margin-bottom:.5rem;margin-top:.5rem">Permissões de Módulos Específicos</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                    <div style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="ck_cli_e"/><label>Criar/Editar Clientes</label></div>
                    <div style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="ck_man_e"/><label>Criar Manipulações</label></div>
                    <div style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="ck_exa_e"/><label>Criar Exames</label></div>
                    <div style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="ck_orc_e"/><label>Emitir Pagamentos / Atualizar Status</label></div>
                    <div style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="ck_est_e"/><label>Gerenciar Estoque / Produtos</label></div>
                </div>
            </div>

          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="FC.utils.closeModal('mdUsu')">Cancelar</button>
            <button class="btn btn-primary" id="btnSalvarU" style="background:var(--accent2);color:#fff;">Salvar Credenciamento</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnNovoU').addEventListener('click', function(){
      if(FC.auth.check('usuarios')!=='edit') return FC.utils.toast('Sem permissão.','er');
      editId = null;
      document.getElementById('mTitleU').innerText = "Novo Colaborador";
      FC.utils.sv('fu_nome',''); FC.utils.sv('fu_email',''); FC.utils.sv('fu_senha','');
      FC.utils.sv('fu_perfil','atendente');
      document.getElementById('fu_email').disabled=false;
      togglePerms();
      FC.utils.openModal('mdUsu');
    });

    document.getElementById('btnSalvarU').addEventListener('click', save);

    window.addEventListener('pageShow', function(e){
      if(e.pageName === 'usuarios') loadData();
    });
  }

  async function loadData(){
    FC.utils.set('uTbl', '<table class="tbl"><tbody>'+FC.utils.skel(3,4)+'</tbody></table>');
    list = await FC.db.getUsers();
    list = list.filter(function(x){ return x.ativo!==false; });
    renderTable();
  }

  function renderTable(){
    var html = '<table class="tbl"><thead><tr><th>Colaborador</th><th>Perfil de Acesso</th><th>Criado Em</th><th style="width:80px">Ações</th></tr></thead><tbody>';
    
    var uLogado = FC.auth.getUser();

    list.forEach(function(u){
      var bad = u.perfil==='admin' ? FC.utils.tipoBadge('manipulacao') /*blue*/ : (u.perfil==='gerente'?FC.utils.tipoBadge('produto'):FC.utils.tipoBadge('exame'));
      
      var editBtn = '';
      if(uLogado.perfil === 'admin' || (uLogado.perfil === 'gerente' && u.perfil !== 'admin' && u.perfil !== 'gerente')){
        editBtn = `
          <button class="btn-icon" data-id="${u.id}" title="Editar" onclick="FC.pages.usuarios.edit('${u.id}')">✏️</button>
          ${ u.id!==uLogado.id && u.id!=='admin-001' ? `<button class="btn-icon" data-id="${u.id}" style="color:var(--err)" onclick="FC.pages.usuarios.del('${u.id}')">🗑️</button>` : ''}
        `;
      }

      html += `<tr>
        <td><div style="font-weight:600">${FC.utils.esc(u.nome)}</div><div style="font-size:11px;color:var(--text3)">${FC.utils.esc(u.email)}</div></td>
        <td>${bad.replace('Manipulação','Admin').replace('Produto','Gerente').replace('Exame',u.perfil)}</td>
        <td>${FC.utils.fmtDate(u.criado_em.split('T')[0])}</td>
        <td><div class="actions">${editBtn}</div></td>
      </tr>`;
    });
    html += '</tbody></table>';
    FC.utils.set('uTbl', html);
  }

  function togglePerms(){
     var p = FC.utils.gv('fu_perfil');
     var box = document.getElementById('fu_perms_box');
     if(p==='admin' || p==='gerente'){ box.style.opacity='0.5'; box.style.pointerEvents='none'; }
     else { box.style.opacity='1'; box.style.pointerEvents='auto'; }

     // Reset ou marca auto
     if(p==='atendente'){
         document.getElementById('ck_cli_e').checked = true;
         document.getElementById('ck_man_e').checked = true;
         document.getElementById('ck_exa_e').checked = true;
         document.getElementById('ck_orc_e').checked = false; // Não recebe pagamentos
         document.getElementById('ck_est_e').checked = false;
     } else if(p==='farmaceutico'){
         document.getElementById('ck_cli_e').checked = true;
         document.getElementById('ck_man_e').checked = true;
         document.getElementById('ck_exa_e').checked = false;
         document.getElementById('ck_orc_e').checked = true;
         document.getElementById('ck_est_e').checked = true;
     } else {
         document.getElementById('ck_cli_e').checked = true;
         document.getElementById('ck_man_e').checked = true;
         document.getElementById('ck_exa_e').checked = true;
         document.getElementById('ck_orc_e').checked = true;
         document.getElementById('ck_est_e').checked = true;
     }
  }

  async function save(){
    var nome = FC.utils.gv('fu_nome'), email = FC.utils.gv('fu_email').toLowerCase(),
        senha = FC.utils.gv('fu_senha'), perfil = FC.utils.gv('fu_perfil');
    
    if(!nome || !email){ FC.utils.toast('Preencha nome e e-mail.','yw'); return; }
    if(!editId && (!senha || senha.length<6)){ FC.utils.toast('Nova senha requer no mínimo 6 caracteres.','yw'); return; }

    var logado = FC.auth.getUser();
    if(logado.perfil==='gerente' && (perfil==='admin' || perfil==='gerente')){
        return FC.utils.toast('Você não tem permissão para criar Admins/Gerentes.','er');
    }

    var obj = {
      id: editId,
      nome: nome, email: email, perfil: perfil,
      perms: {
        clientes: document.getElementById('ck_cli_e').checked ? 'edit' : 'read',
        manipulacao: document.getElementById('ck_man_e').checked ? 'edit' : 'read',
        exames: document.getElementById('ck_exa_e').checked ? 'edit' : 'read',
        orcamentos: document.getElementById('ck_orc_e').checked ? 'edit' : 'read',
        estoque: document.getElementById('ck_est_e').checked ? 'edit' : 'read'
      }
    };

    var btn = document.getElementById('btnSalvarU');
    var prev = btn.innerText; btn.innerText = "Provisionando..."; btn.disabled=true;

    await FC.db.saveUser(obj, senha || null);

    btn.innerText = prev; btn.disabled=false;
    FC.utils.toast('Acesso concedido com sucesso!');
    FC.utils.closeModal('mdUsu');
    loadData();
  }

  function edit(id){
    var u = list.find(function(x){ return x.id===id; });if(!u) return;
    editId = u.id;
    document.getElementById('mTitleU').innerText = "Editar Colaborador";
    FC.utils.sv('fu_nome', u.nome); FC.utils.sv('fu_email', u.email); FC.utils.sv('fu_senha','');
    document.getElementById('fu_email').disabled=true;
    FC.utils.sv('fu_perfil', u.perfil);
    
    var p = u.perms || {};
    document.getElementById('ck_cli_e').checked = p.clientes==='edit';
    document.getElementById('ck_man_e').checked = p.manipulacao==='edit';
    document.getElementById('ck_exa_e').checked = p.exames==='edit';
    document.getElementById('ck_orc_e').checked = p.orcamentos==='edit';
    document.getElementById('ck_est_e').checked = p.estoque==='edit';
    
    var box = document.getElementById('fu_perms_box');
    if(u.perfil==='admin' || u.perfil==='gerente'){ box.style.opacity='0.5'; box.style.pointerEvents='none'; }
    else { box.style.opacity='1'; box.style.pointerEvents='auto'; }

    FC.utils.openModal('mdUsu');
  }

  async function del(id){
    if(id==='admin-001') return;
    if(!confirm('Excluir este acesso impedirá o usuário de logar imediatamente. Deseja revogar acesso?')) return;
    await FC.db.delUser(id);
    FC.utils.toast('Acesso revogado.','ok');
    loadData();
  }

  return { init:init, togglePerms:togglePerms, edit:edit, del:del };
})();
