/* js/pages/orcamentos.js (Contém Relatórios Consolidados e Exportação) */
var FC = window.FC = window.FC || {};
FC.pages = FC.pages || {};

FC.pages.orcamentos = (function(){
  var ui = null;
  var list = [];
  var clientesMap = {};

  function init(){
    ui = document.getElementById('page-orcamentos');
    if(!ui) return;
    
    ui.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div style="display:flex;gap:1rem;flex:1;flex-wrap:wrap;">
            <div class="search-bar" style="max-width:250px"><span class="ico">🔍</span><input placeholder="Busca geral..." id="oBusca"/></div>
            <select id="oFiltroMes" style="padding:.65rem 1rem;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:var(--rs);color:var(--text);"><option value="">Todos os Meses</option></select>
            <select id="oFiltroTipo" style="padding:.65rem 1rem;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:var(--rs);color:var(--text);">
              <option value="">Todos os Tipos</option><option value="manipulacao">Manipulações</option><option value="exame">Exames</option>
            </select>
          </div>
          <button class="btn btn-secondary" id="btnExportar">📄 Exportar CSV</button>
        </div>
        
        <div class="stats-grid" id="oStats"></div>

        <div class="tbl-wrap" id="oTbl"></div>
        <div id="oPag" class="pagination"></div>
      </div>
    `;

    // Filtros de Mês Dinâmico (Últimos 12 meses)
    var fMes = document.getElementById('oFiltroMes');
    var dt = new Date();
    for(var i=0; i<12; i++){
      var val = dt.getFullYear()+'-'+FC.utils.padNum(dt.getMonth()+1).slice(-2);
      var text = dt.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
      text = text.charAt(0).toUpperCase() + text.slice(1);
      fMes.innerHTML += `<option value="${val}">${text}</option>`;
      dt.setMonth(dt.getMonth()-1);
    }
    
    fMes.value = new Date().getFullYear()+'-'+FC.utils.padNum(new Date().getMonth()+1).slice(-2);

    ['oBusca','oFiltroMes','oFiltroTipo'].forEach(function(el){
       document.getElementById(el).addEventListener('input', renderTable);
    });

    document.getElementById('btnExportar').addEventListener('click', exportarCSV);

    window.addEventListener('pageShow', function(e){
      if(e.pageName === 'orcamentos') loadData();
    });
  }

  async function loadData(){
    FC.utils.set('oTbl', '<table class="tbl"><tbody>'+FC.utils.skel(5,6)+'</tbody></table>');
    var [c, s] = await Promise.all([
      FC.db.getClientes(),
      FC.db.getServicos()
    ]);
    
    c.forEach(function(cl){ clientesMap[cl.id] = cl; });
    list = s || [];
    renderTable();
  }

  var pag=1; var pSize=20;
  function renderTable(){
    var busca = FC.utils.gv('oBusca').toLowerCase();
    var fMes = FC.utils.gv('oFiltroMes');
    var fTipo = FC.utils.gv('oFiltroTipo');

    var fd = list.filter(function(s){
      var pass = true;
      if(fTipo && s.tipo !== fTipo) pass = false;
      if(fMes && !s.data.startsWith(fMes)) pass = false;
      return pass;
    });

    if(busca){
      fd = fd.filter(function(s){
        var cName = (clientesMap[s.cliente_id]||{}).nome || '';
        return cName.toLowerCase().includes(busca) || 
               String(s.orc_num||'').includes(busca) ||
               (s.formula&&s.formula.toLowerCase().includes(busca)) ||
               (s.tipo_exame&&s.tipo_exame.toLowerCase().includes(busca));
      });
    }

    var totalValor = fd.reduce(function(acc,s){ return acc + parseFloat(s.valor||0); },0);
    var qtdPgts = fd.filter(function(s){ return s.pagamento!=='fiado'; }).length;
    var pendentes = fd.filter(function(s){ return s.pagamento==='fiado'; }).reduce(function(acc,s){ return acc + parseFloat(s.valor||0); },0);

    FC.utils.set('oStats', `
      <div class="stat-card" style="--c:#60a5fa"><div class="stat-label">Total Filtrado</div><div class="stat-value">${FC.utils.fmt(totalValor)}</div></div>
      <div class="stat-card" style="--c:#34d399"><div class="stat-label">Qtd Negócios (Pagos)</div><div class="stat-value">${qtdPgts} un.</div></div>
      <div class="stat-card" style="--c:#f87171"><div class="stat-label">Valor Pendente (A Receber)</div><div class="stat-value">${FC.utils.fmt(pendentes)}</div></div>
    `);

    var maxPag = Math.ceil(fd.length/pSize) || 1;
    if(pag>maxPag) pag=maxPag;
    var slice = fd.slice((pag-1)*pSize, pag*pSize);

    var html = '<table class="tbl"><thead><tr><th>ORC/Data</th><th>Cliente</th><th>Serviço/Detalhe</th><th>Valor</th><th>Pagamento</th><th style="width:80px">Ações</th></tr></thead><tbody>';
    slice.forEach(function(s){
      var cName = (clientesMap[s.cliente_id]||{}).nome || 'Desconhecido';
      var dHead = s.tipo==='manipulacao'? s.formula : s.tipo_exame;
      html += `<tr>
        <td><div style="font-weight:700">#${FC.utils.padNum(s.orc_num)}</div><div style="font-size:11px;color:var(--text3)">${FC.utils.fmtDate(s.data)}</div></td>
        <td><div style="font-weight:600">${FC.utils.esc(cName)}</div></td>
        <td>${FC.utils.tipoBadge(s.tipo)}<div style="font-size:12px;margin-top:4px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${FC.utils.esc(dHead)}</div></td>
        <td><div style="font-weight:700;color:var(--text)">${FC.utils.fmt(s.valor)}</div></td>
        <td>${FC.utils.pagBadge(s.pagamento)}</td>
        <td>
           <button class="btn-icon" title="Imprimir" onclick="FC.pages.orcamentos.print('${s.id}')">🖨️</button>
        </td>
      </tr>`;
    });
    if(fd.length===0) html += '<tr><td colspan="6" class="empty-state">Nenhum orçamento encontrado nesses filtros.</td></tr>';
    html += '</tbody></table>';

    FC.utils.set('oTbl', html);
    FC.utils.set('oPag', `
      <div>Mostrando ${slice.length} de ${fd.length} registros</div>
      <div class="pag-btns">
        <button class="pag-btn" onclick="FC.pages.orcamentos.np(-1)" ${pag<=1?'disabled':''}>◀ Anterior</button>
        <button class="pag-btn" onclick="FC.pages.orcamentos.np(1)" ${pag>=maxPag?'disabled':''}>Próxima ▶</button>
      </div>
    `);
  }

  function np(d){ pag+=d; renderTable(); }

  // Imprimir via Blob (sem document.write inseguro)
  function print(id){
    var s = list.find(function(x){ return x.id===id; });
    if(!s) return;
    var c = clientesMap[s.cliente_id] || {};

    var pgtStr = {pix:'PIX',dinheiro:'Dinheiro',cartao:'Cartão',convenio:'Convênio',fiado:'Pendente (Fiado)'}[s.pagamento]||s.pagamento;
    var sType = s.tipo==='manipulacao'?'Manipulação de Fórmulas':'Exame Regulatório';
    var header = `ORÇAMENTO Nº ${FC.utils.padNum(s.orc_num)}`;
    var data = FC.utils.fmtDate(s.data);
    var details = s.tipo==='manipulacao' ? s.formula : s.tipo_exame;

    var htmlBlobo = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${header}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0;padding:20px;background:#f9f9f9}
      .r{background:#fff;padding:40px;max-width:800px;margin:0 auto;border:1px solid #ccc;border-top:5px solid #00c9a7}
      .h{display:flex;justify-content:space-between;border-bottom:2px solid #eee;padding-bottom:15px;margin-bottom:30px}
      .h1{font-size:24px;color:#0f0f1a;font-weight:bold;margin:0}
      .t{width:100%;border-collapse:collapse;margin:20px 0}
      .t th,.t td{padding:12px;border:1px solid #ddd;text-align:left}
      .t th{background:#f4f4f4}
      .v{font-size:20px;font-weight:bold;color:#00a88c;text-align:right;}
      .f{text-align:center;margin-top:40px;font-size:12px;color:#777;border-top:1px solid #eee;padding-top:20px}
      @media print { body{padding:0;background:#fff;} .r{border:none;max-width:none} }
    </style></head><body onload="window.print()">
    <div class="r">
      <div class="h">
         <div>
            <h1 class="h1">Farmácia Couto</h1>
            <div style="color:#666;margin-top:5px">Sistema de Gestão • E-mail: faleconosco@farmaciacouto.com</div>
         </div>
         <div style="text-align:right">
            <h2 style="margin:0;color:#555">${header}</h2>
            <div>Data: ${data}</div>
         </div>
      </div>
      
      <div style="margin-bottom:25px">
         <strong>Cliente:</strong> ${FC.utils.esc(c.nome)}<br/>
         <strong>CPF:</strong> ${FC.utils.esc(c.cpf||'Não informado')} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Telefone:</strong> ${FC.utils.esc(c.tel)}
      </div>

      <table class="t">
         <thead><tr><th>Tipo do Serviço</th><th>Status de Pagamento</th></tr></thead>
         <tbody><tr><td>${sType}</td><td>${pgtStr}</td></tr></tbody>
      </table>

      <div style="background:#fcfcfc;border:1px solid #eee;padding:15px;border-radius:4px;min-height:100px;margin-bottom:20px">
        <strong>Detalhes / Prescrição:</strong><br/><br/>
        <div style="white-space:pre-wrap;">${FC.utils.esc(details)}</div>
      </div>

      ${s.obs ? `<div style="margin-bottom:20px;color:#555"><strong>Observações:</strong> ${FC.utils.esc(s.obs)}</div>` : ''}

      <div class="v">Total Bruto: ${FC.utils.fmt(s.valor)}</div>
      
      <div class="f">
        Documento gerado automaticamente pelo sistema em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>
    </body></html>`;

    var blob = new Blob([htmlBlobo], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'width=900,height=700');
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
  }

  // Exportar para CSV
  function exportarCSV(){
    var busca = FC.utils.gv('oBusca').toLowerCase();
    var fMes = FC.utils.gv('oFiltroMes');
    var fTipo = FC.utils.gv('oFiltroTipo');
    var fd = list.filter(function(s){
      var pass = true;
      if(fTipo && s.tipo !== fTipo) pass = false;
      if(fMes && !s.data.startsWith(fMes)) pass = false;
      return pass;
    });
    if(busca){
      fd = fd.filter(function(s){
        var cName = (clientesMap[s.cliente_id]||{}).nome || '';
        return cName.toLowerCase().includes(busca) || String(s.orc_num).includes(busca);
      });
    }

    if(fd.length===0) return FC.utils.toast('Nenhum dado para exportar.','yw');
    var csv = "\uFEFFORC;Data;Cliente;Serviço;Valor;Pagamento;Atendente\n"; // Bom pt-br encoding
    fd.forEach(function(s){
       var c = clientesMap[s.cliente_id]||{};
       var det = s.tipo==='manipulacao'?s.formula:s.tipo_exame;
       var l = [
         s.orc_num,
         FC.utils.fmtDate(s.data),
         c.nome,
         (s.tipo+' - '+det).replace(/;/g,','), // safe pra csv
         parseFloat(s.valor||0).toFixed(2).replace('.',','),
         s.pagamento,
         s.criado_por
       ];
       csv += l.join(';') + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'Orcamentos_Farmacia_' + (fMes||'todos') + '.csv';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
  }

  return { init:init, np:np, print:print };
})();
