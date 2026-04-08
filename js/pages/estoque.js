/* js/pages/estoque.js */
var FC = window.FC = window.FC || {};
FC.pages = FC.pages || {};

FC.pages.estoque = (function(){
  var ui = null;
  var list = [];
  var editId = null;

  function init(){
    ui = document.getElementById('page-estoque');
    if(!ui) return;
    
    ui.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="search-bar"><span class="ico">🔍</span><input placeholder="Buscar produto ou SKU..." id="eBusca"/></div>
          <button class="btn btn-primary" id="btnNovoE">＋ Novo Produto</button>
        </div>
        <div class="tbl-wrap" id="eTbl"></div>
      </div>
      <!-- Modal Form -->
      <div class="modal-overlay h" id="mdEstoque">
        <div class="modal-box">
          <div class="modal-title" id="mTitleE">Novo Produto</div>
          <div class="form-grid">
            <div class="fg full"><label>Nome do Produto*</label><input type="text" id="fe_nome" placeholder="Ex: Rinosoro 3%"/></div>
            <div class="fg"><label>SKU / Código</label><input type="text" id="fe_sku"/></div>
            <div class="fg"><label>Validade</label><input type="date" id="fe_val"/></div>
            <div class="fg"><label>Qtd em Estoque*</label><input type="number" id="fe_qtd" min="0" value="0"/></div>
            <div class="fg"><label>Qtd Mínima (Aviso)*</label><input type="number" id="fe_min" min="0" value="5"/></div>
            <div class="fg"><label>Fornecedor</label><input type="text" id="fe_for"/></div>
            <div class="fg"><label>Preço de Venda (R$)</label><input type="number" id="fe_preco" step="0.01" min="0" value="0"/></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="FC.utils.closeModal('mdEstoque')">Cancelar</button>
            <button class="btn btn-primary" id="btnSalvarE">Salvar Produto</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnNovoE').addEventListener('click', function(){
      if(FC.auth.check('estoque')==='none') return FC.utils.toast('Sem permissão.','er');
      editId = null;
      document.getElementById('mTitleE').innerText = "Novo Produto";
      ['fe_nome','fe_sku','fe_val','fe_for'].forEach(function(i){ FC.utils.sv(i,''); });
      FC.utils.sv('fe_qtd','0'); FC.utils.sv('fe_min','5'); FC.utils.sv('fe_preco','0');
      FC.utils.openModal('mdEstoque');
    });

    document.getElementById('btnSalvarE').addEventListener('click', save);
    document.getElementById('eBusca').addEventListener('input', renderTable);

    window.addEventListener('pageShow', function(e){
      if(e.pageName === 'estoque') loadData();
    });
  }

  async function loadData(){
    FC.utils.set('eTbl', '<table class="tbl"><tbody>'+FC.utils.skel(4,5)+'</tbody></table>');
    list = await FC.db.getEstoque();
    renderTable();
  }

  function renderTable(){
    var busca = FC.utils.gv('eBusca').toLowerCase();
    var fd = list.filter(function(e){ return e.nome.toLowerCase().includes(busca) || (e.sku&&e.sku.toLowerCase().includes(busca)); });

    var html = '<table class="tbl"><thead><tr><th>Produto/SKU</th><th>Qtd/Mín</th><th>Preço</th><th>Validade</th><th>Ações</th></tr></thead><tbody>';
    fd.forEach(function(e){
      var isLow = parseFloat(e.qtd) <= parseFloat(e.min||0);
      var cls = parseFloat(e.qtd) <= 0 ? 'stock-out' : (isLow ? 'stock-low' : '');
      html += `<tr class="${cls}">
        <td><div style="font-weight:600">${FC.utils.esc(e.nome)}</div><div style="font-size:11px;color:var(--text3)">SKU: ${FC.utils.esc(e.sku||'—')}</div></td>
        <td>
           <div style="font-weight:700">${e.qtd} un.</div>
           <div style="font-size:11px;color:var(--text2)">Aviso: ${e.min}</div>
        </td>
        <td><div style="font-weight:600">${FC.utils.fmt(e.preco)}</div></td>
        <td>${FC.utils.fmtDate(e.val)}</td>
        <td>
          <div class="actions">
            <button class="btn-icon" data-id="${e.id}" title="Editar" onclick="FC.pages.estoque.edit('${e.id}')">✏️</button>
            <button class="btn-icon" data-id="${e.id}" style="color:var(--err)" onclick="FC.pages.estoque.del('${e.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
    });
    if(fd.length===0) html += '<tr><td colspan="5" class="empty-state">Nenhum produto cadastrado.</td></tr>';
    html += '</tbody></table>';
    FC.utils.set('eTbl', html);
  }

  async function save(){
    var nome = FC.utils.gv('fe_nome');
    if(!nome){ FC.utils.toast('Preencha o nome do produto.','yw'); return; }

    var btn = document.getElementById('btnSalvarE');
    var prev = btn.innerText; btn.innerText = "Salvando..."; btn.disabled=true;

    await FC.db.saveEstoque({
      id: editId,
      nome: nome,
      sku: FC.utils.gv('fe_sku') || null,
      val: FC.utils.gv('fe_val') || null,
      qtd: parseFloat(FC.utils.gv('fe_qtd')||0),
      min: parseFloat(FC.utils.gv('fe_min')||5),
      preco: parseFloat(FC.utils.gv('fe_preco')||0),
      fornecedor: FC.utils.gv('fe_for') || null
    });

    btn.innerText = prev; btn.disabled=false;
    FC.utils.toast('Produto salvo!');
    FC.utils.closeModal('mdEstoque');
    loadData();
  }

  function edit(id){
    if(FC.auth.check('estoque')==='none') return FC.utils.toast('Sem permissão.','er');
    var idx = list.find(function(x){ return x.id===id; });
    if(!idx) return;
    editId = idx.id;
    document.getElementById('mTitleE').innerText = "Editar Produto";
    FC.utils.sv('fe_nome', idx.nome); FC.utils.sv('fe_sku', idx.sku);
    FC.utils.sv('fe_val', idx.val); FC.utils.sv('fe_qtd', idx.qtd);
    FC.utils.sv('fe_min', idx.min); FC.utils.sv('fe_preco', idx.preco);
    FC.utils.sv('fe_for', idx.fornecedor);
    FC.utils.openModal('mdEstoque');
  }

  async function del(id){
    if(FC.auth.check('estoque')!=='edit') return FC.utils.toast('Sem permissão.','er');
    if(!confirm('Deseja excluir este produto definitivamente?')) return;
    await FC.db.delEstoque(id);
    FC.utils.toast('Produto removido.','ok');
    loadData();
  }

  return { init:init, edit:edit, del:del };
})();
