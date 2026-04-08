/* js/pages/servicos.js — (Manipulação e Exames) */
var FC = window.FC = window.FC || {};
FC.pages = FC.pages || {};

FC.pages.servicos = (function(){
  var currentTipo = ''; // 'manipulacao' ou 'exame'
  var list = [];
  var clientesMap = {};

  function init(){
    // Inicia UI das duas abas
    var uiMan = document.getElementById('manipulacaoUi');
    if(uiMan) uiMan.innerHTML = buildHtml('manipulacao', 'Manipulação', '⚗️', 'Fórmula / Prescrição', 'Ex: Paracetamol 500mg, 30 cápsulas...');
    
    var uiEx = document.getElementById('page-exames');
    if(uiEx) uiEx.innerHTML = buildHtml('exame', 'Exames Regulatórios', '🔬', 'Tipo de Exame', 'Ex: Glicemia, Pressão Arterial, Teste Covid...');

    // Handlers
    ['manipulacao', 'exame'].forEach(function(t){
      var btn = document.getElementById('btnNovo_'+t);
      if(btn) btn.addEventListener('click', function(){ openForm(t); });
      var btnSalvar = document.getElementById('btnSalvarSrv_'+t);
      if(btnSalvar) btnSalvar.addEventListener('click', function(){ save(t); });
      var bEl = document.getElementById('sBusca_'+t);
      if(bEl) bEl.addEventListener('input', function(){ renderTable(t); });
    });

    window.addEventListener('pageShow', function(e){
      if(e.pageName === 'manipulacao' || e.pageName === 'exames'){
        currentTipo = e.pageName === 'exames' ? 'exame' : 'manipulacao';
        loadData(currentTipo);
      }
    });
  }

  function buildHtml(tipo, titulo, ico, labelPrinc, holderPrinc){
    return `
      <div class="card">
        <div class="card-head">
          <div class="search-bar"><span class="ico">🔍</span><input placeholder="Buscar por cliente ou dados..." id="sBusca_${tipo}"/></div>
          <button class="btn btn-primary" id="btnNovo_${tipo}">＋ Novo ${titulo}</button>
        </div>
        <div class="tbl-wrap" id="sTbl_${tipo}"></div>
        <div id="sPag_${tipo}" class="pagination"></div>
      </div>
      <!-- Modal Form -->
      <div class="modal-overlay h" id="mdSrv_${tipo}">
        <div class="modal-box wide">
          <div class="modal-title">Novo Serviço de ${titulo}</div>
          <div class="form-grid">
            <div class="fg full">
               <label>Cliente Associado*</label>
               <select id="fs_cli_${tipo}"><option value="">Carregando clientes...</option></select>
            </div>
            <div class="fg"><label>Data do Atendimento*</label><input type="date" id="fs_data_${tipo}" value="${new Date().toISOString().slice(0,10)}"/></div>
            <div class="fg"><label>${tipo==='manipulacao'?'Data de Entrega*':'Data do Exame*'}</label><input type="date" id="fs_prazo_${tipo}"/></div>
            
            <div class="fg full"><label>${labelPrinc}*</label><textarea id="fs_desc_${tipo}" placeholder="${holderPrinc}"></textarea></div>
            
            <div class="fg"><label>Valor Final (R$)*</label><input type="number" id="fs_val_${tipo}" step="0.01" min="0" placeholder="0.00"/></div>
            <div class="fg">
               <label>Forma de Pagamento</label>
               <select id="fs_pag_${tipo}">
                 <option value="pix">Pix</option><option value="cartao">Cartão de Crédito/Débito</option>
                 <option value="dinheiro">Dinheiro</option><option value="convenio">Convênio</option>
                 <option value="fiado">A Receber</option>
               </select>
            </div>
            <div class="fg full"><label>Observações / Orientações ao Paciente</label><input type="text" id="fs_obs_${tipo}"/></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="FC.utils.closeModal('mdSrv_${tipo}')">Cancelar</button>
            <button class="btn btn-primary" id="btnSalvarSrv_${tipo}">Salvar e Gerar Código</button>
          </div>
        </div>
      </div>
    `;
  }

  async function loadData(tipo){
    FC.utils.set('sTbl_'+tipo, '<table class="tbl"><tbody>'+FC.utils.skel(4,5)+'</tbody></table>');
    
    // Parallell load
    var [c, s] = await Promise.all([
      FC.db.getClientes(),
      FC.db.getServicos({tipo: tipo})
    ]);
    
    list = s || [];
    var sel = document.getElementById('fs_cli_'+tipo);
    if(sel){
      sel.innerHTML = '<option value="">Selecione o Cliente...</option>';
      c.filter(x=>x.ativo!==false).forEach(function(cl){
        clientesMap[cl.id] = cl;
        var opt = document.createElement('option');
        opt.value = cl.id; opt.innerText = cl.nome + (cl.cpf?' — '+cl.cpf:'');
        sel.appendChild(opt);
      });
    }
    renderTable(tipo);
  }

  var pag = { manipulacao:1, exame:1 }; var pSize = 15;
  function renderTable(tipo){
    var busca = (FC.utils.gv('sBusca_'+tipo) || '').toLowerCase();
    
    var fd = list.filter(function(s){
      var cName = (clientesMap[s.cliente_id]||{}).nome || '';
      return cName.toLowerCase().includes(busca) || 
             (s.formula&&s.formula.toLowerCase().includes(busca)) ||
             (s.tipo_exame&&s.tipo_exame.toLowerCase().includes(busca));
    });

    var maxPag = Math.ceil(fd.length/pSize) || 1;
    if(pag[tipo]>maxPag) pag[tipo]=maxPag;
    var slice = fd.slice((pag[tipo]-1)*pSize, pag[tipo]*pSize);

    var html = '<table class="tbl"><thead><tr><th>ORC/Data</th><th>Cliente</th><th>Detalhes</th><th>Valor/Pgto</th><th style="width:80px">Recibo</th></tr></thead><tbody>';
    slice.forEach(function(s){
      var cName = (clientesMap[s.cliente_id]||{}).nome || 'Desconhecido';
      var dHead = tipo==='manipulacao'? s.formula : s.tipo_exame;
      html += `<tr>
        <td><div style="font-weight:700;color:var(--text)">#${FC.utils.padNum(s.orc_num)}</div><div style="font-size:11px;color:var(--text3)">${FC.utils.fmtDate(s.data)}</div></td>
        <td><div style="font-weight:600">${FC.utils.esc(cName)}</div></td>
        <td><div style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${FC.utils.esc(dHead)}">${FC.utils.esc(dHead)}</div></td>
        <td>
           <div style="font-weight:700;color:var(--accent)">${FC.utils.fmt(s.valor)}</div>
           <div style="margin-top:2px;">${FC.utils.pagBadge(s.pagamento)}</div>
        </td>
        <td><button class="btn-icon" data-id="${s.id}" onclick="FC.pages.orcamentos.print('${s.id}')">🖨️</button></td>
      </tr>`;
    });
    if(fd.length===0) html += `<tr><td colspan="5" class="empty-state">Nenhuma ${tipo} registrada.</td></tr>`;
    html += '</tbody></table>';

    FC.utils.set('sTbl_'+tipo, html);
    FC.utils.set('sPag_'+tipo, `
      <div>Mostrando ${slice.length} de ${fd.length} ${tipo}s</div>
      <div class="pag-btns">
        <button class="pag-btn" onclick="FC.pages.servicos.np('${tipo}',-1)" ${pag[tipo]<=1?'disabled':''}>◀</button>
        <button class="pag-btn" onclick="FC.pages.servicos.np('${tipo}',1)" ${pag[tipo]>=maxPag?'disabled':''}>▶</button>
      </div>
    `);
  }

  function np(tipo, d){ pag[tipo] += d; renderTable(tipo); }

  function openForm(tipo){
    if(FC.auth.check(tipo)==='none') return FC.utils.toast('Sem permissão.','er');
    FC.utils.sv('fs_cli_'+tipo,''); FC.utils.sv('fs_data_'+tipo,new Date().toISOString().slice(0,10));
    FC.utils.sv('fs_prazo_'+tipo,''); FC.utils.sv('fs_desc_'+tipo,'');
    FC.utils.sv('fs_val_'+tipo,'0'); FC.utils.sv('fs_obs_'+tipo,'');
    FC.utils.openModal('mdSrv_'+tipo);
  }

  async function save(tipo){
    var cid=FC.utils.gv('fs_cli_'+tipo), data=FC.utils.gv('fs_data_'+tipo), val=FC.utils.gv('fs_val_'+tipo),
        desc=FC.utils.gv('fs_desc_'+tipo), prazo=FC.utils.gv('fs_prazo_'+tipo);
    
    if(!cid || !data || !val || !desc) return FC.utils.toast('Preencha os campos obrigatórios (*).','yw');
    
    var obj = {
      cliente_id: cid, tipo: tipo, data: data, valor: parseFloat(val),
      pagamento: FC.utils.gv('fs_pag_'+tipo), obs: FC.utils.gv('fs_obs_'+tipo), prazo: prazo||null,
      criado_por: FC.auth.getUser().nome
    };
    if(tipo==='manipulacao') obj.formula = desc; else obj.tipo_exame = desc;

    var btn = document.getElementById('btnSalvarSrv_'+tipo);
    var prev = btn.innerText; btn.innerText="Salvando..."; btn.disabled=true;
    
    var num = await FC.db.saveServico(obj);
    
    btn.innerText=prev; btn.disabled=false;
    FC.utils.toast('Salvo com sucesso! ORC #'+FC.utils.padNum(num));
    FC.utils.closeModal('mdSrv_'+tipo);
    loadData(tipo);
  }

  return { init:init, np:np };
})();
