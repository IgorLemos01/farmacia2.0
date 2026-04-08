/* js/pages/clientes.js */
var FC = window.FC = window.FC || {};
FC.pages = FC.pages || {};

FC.pages.clientes = (function(){
  var ui = null;
  var list = [];
  var editId = null;

  function init(){
    ui = document.getElementById('clientesUi');
    if(!ui) return;
    
    ui.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="search-bar"><span class="ico">🔍</span><input placeholder="Buscar por nome, telefone ou CPF..." id="cBusca"/></div>
          <button class="btn btn-primary" id="btnNovoC">＋ Novo Cliente</button>
        </div>
        <div class="tbl-wrap" id="cTbl"></div>
        <div id="cPag" class="pagination"></div>
      </div>
      <!-- Modal Form -->
      <div class="modal-overlay h" id="mdCliente">
        <div class="modal-box wide">
          <div class="modal-title" id="mTitleC">Novo Cliente</div>
          <div class="form-grid">
            <div class="fg full"><label>Nome Completo*</label><input type="text" id="fc_nome" placeholder="Ex: João da Silva"/></div>
            <div class="fg"><label>Data Nascimento</label><input type="date" id="fc_nasc"/></div>
            <div class="fg"><label>CPF</label><input type="text" id="fc_cpf" placeholder="000.000.000-00" maxlength="14" oninput="FC.utils.maskCPF(this)"/></div>
            <div class="fg"><label>Telefone* (WhatsApp)</label><input type="tel" id="fc_tel" placeholder="(00) 00000-0000" maxlength="15" oninput="FC.utils.maskPhone(this)"/></div>
            <div class="fg"><label>E-mail</label><input type="email" id="fc_email" placeholder="email@exemplo.com"/></div>
            <div class="fg full"><label>Endereço Completo</label><input type="text" id="fc_end" placeholder="Rua, número, bairro..."/></div>
            <div class="fg full"><label>Observações / Histórico de Saúde</label><textarea id="fc_obs" placeholder="Alergias, medicamentos de uso contínuo, etc."></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="FC.utils.closeModal('mdCliente')">Cancelar</button>
            <button class="btn btn-primary" id="btnSalvarC">Salvar Cliente</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnNovoC').addEventListener('click', function(){
      if(FC.auth.check('clientes')==='none') return FC.utils.toast('Sem permissão.','er');
      editId = null;
      document.getElementById('mTitleC').innerText = "Novo Cliente";
      FC.utils.sv('fc_nome',''); FC.utils.sv('fc_nasc',''); FC.utils.sv('fc_cpf','');
      FC.utils.sv('fc_tel',''); FC.utils.sv('fc_email',''); FC.utils.sv('fc_end',''); FC.utils.sv('fc_obs','');
      FC.utils.openModal('mdCliente');
    });

    document.getElementById('btnSalvarC').addEventListener('click', save);
    document.getElementById('cBusca').addEventListener('input', function(){ renderTable(); });

    window.addEventListener('pageShow', function(e){
      if(e.pageName === 'clientes') loadData();
    });
  }

  async function loadData(){
    FC.utils.set('cTbl', '<table class="tbl"><tbody>'+FC.utils.skel(5,4)+'</tbody></table>');
    list = await FC.db.getClientes();
    list = list.filter(function(x){ return x.ativo!==false; });
    renderTable();
  }

  var pag=1; var pSize=15;
  function renderTable(){
    var busca = FC.utils.gv('cBusca').toLowerCase();
    var fd = list.filter(function(c){
      return c.nome.toLowerCase().includes(busca) ||
             (c.tel&&c.tel.includes(busca)) ||
             (c.cpf&&c.cpf.includes(busca));
    });

    var maxPag = Math.ceil(fd.length/pSize) || 1;
    if(pag>maxPag) pag=maxPag;
    var slice = fd.slice((pag-1)*pSize, pag*pSize);

    var html = '<table class="tbl"><thead><tr><th>Nome / CPF</th><th>Contato</th><th>Nascimento</th><th style="width:80px">Ações</th></tr></thead><tbody>';
    slice.forEach(function(c){
      html += `<tr>
        <td><div style="font-weight:600">${FC.utils.esc(c.nome)}</div><div style="font-size:11px;color:var(--text3);margin-top:2px;">${FC.utils.esc(c.cpf||'Sem CPF')}</div></td>
        <td><div>${FC.utils.esc(c.tel)}</div><div style="font-size:11px;color:var(--text2)">${FC.utils.esc(c.email||'')}</div></td>
        <td>${FC.utils.fmtDate(c.nasc)}</td>
        <td>
          <div class="actions">
            <button class="btn-icon" data-id="${c.id}" title="Editar" onclick="FC.pages.clientes.edit('${c.id}')">✏️</button>
            <button class="btn-icon" data-id="${c.id}" style="color:var(--err)" onclick="FC.pages.clientes.del('${c.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
    });
    if(fd.length===0) html += '<tr><td colspan="4" class="empty-state">Nenhum cliente encontrado.</td></tr>';
    html += '</tbody></table>';

    FC.utils.set('cTbl', html);
    FC.utils.set('cPag', `
      <div>Mostrando ${slice.length} de ${fd.length} clientes</div>
      <div class="pag-btns">
        <button class="pag-btn" onclick="FC.pages.clientes.np(-1)" ${pag<=1?'disabled':''}>◀ Anterior</button>
        <button class="pag-btn" onclick="FC.pages.clientes.np(1)" ${pag>=maxPag?'disabled':''}>Próxima ▶</button>
      </div>
    `);
  }

  async function save(){
    var nome = FC.utils.gv('fc_nome');
    var tel = FC.utils.gv('fc_tel');
    var cpf = FC.utils.gv('fc_cpf');
    
    if(!nome || !tel){ FC.utils.toast('Preencha os campos obrigatórios (*).','yw'); return; }
    if(cpf && !FC.utils.validarCPF(cpf)){ FC.utils.toast('CPF inválido.','er'); return; }

    var btn = document.getElementById('btnSalvarC');
    var prev = btn.innerText; btn.innerText = "Salvando..."; btn.disabled=true;

    await FC.db.saveCliente({
      id: editId,
      nome: nome,
      nasc: FC.utils.gv('fc_nasc') || null,
      cpf: cpf || null,
      tel: tel,
      email: FC.utils.gv('fc_email') || null,
      endereco: FC.utils.gv('fc_end') || null,
      obs: FC.utils.gv('fc_obs') || null
    });

    btn.innerText = prev; btn.disabled=false;
    FC.utils.toast('Cliente salvo com sucesso!');
    FC.utils.closeModal('mdCliente');
    loadData();
  }

  function edit(id){
    if(FC.auth.check('clientes')==='none') return FC.utils.toast('Sem permissão.','er');
    var c = list.find(function(x){ return x.id===id; });
    if(!c) return;
    editId = c.id;
    document.getElementById('mTitleC').innerText = "Editar Cliente";
    FC.utils.sv('fc_nome', c.nome);
    FC.utils.sv('fc_nasc', c.nasc);
    FC.utils.sv('fc_cpf', c.cpf);
    FC.utils.sv('fc_tel', c.tel);
    FC.utils.sv('fc_email', c.email);
    FC.utils.sv('fc_end', c.endereco);
    FC.utils.sv('fc_obs', c.obs);
    FC.utils.openModal('mdCliente');
  }

  async function del(id){
    if(FC.auth.check('clientes')!=='edit') return FC.utils.toast('Sem permissão.','er');
    if(!confirm('Tem certeza que deseja excluir este cliente?')) return;
    await FC.db.delCliente(id);
    FC.utils.toast('Cliente removido.','ok');
    loadData();
  }

  function np(d){ pag+=d; renderTable(); }

  return { init:init, edit:edit, del:del, np:np };
})();
