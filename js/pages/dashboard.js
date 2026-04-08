/* js/pages/dashboard.js */
var FC = window.FC = window.FC || {};
FC.pages = FC.pages || {};

FC.pages.dashboard = (function(){
  var ui = null;

  function init(){
    ui = document.getElementById('dashboardUi');
    if(!ui) return;
    window.addEventListener('pageShow', function(e){
      if(e.pageName === 'dashboard') render();
    });
    render();
  }

  async function render(){
    ui.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card" style="--c:var(--blue);"><div class="stat-label">Total Clientes</div><div class="stat-value skel" style="width:60px;height:32px;"></div></div>
        <div class="stat-card" style="--c:var(--purple);"><div class="stat-label">Manipulações (Mês)</div><div class="stat-value skel" style="width:60px;height:32px;"></div></div>
        <div class="stat-card" style="--c:var(--teal);"><div class="stat-label">Exames (Mês)</div><div class="stat-value skel" style="width:60px;height:32px;"></div></div>
        <div class="stat-card" style="--c:var(--green);"><div class="stat-label">Faturamento</div><div class="stat-value skel" style="width:80px;height:32px;"></div></div>
      </div>
      <div class="form-grid">
        <div class="card"><div class="card-head"><div class="card-title">Últimos Serviços</div></div><div class="tbl-wrap" id="dashTbl">Carregando...</div></div>
        <div class="card alerts-grid" id="dashAlerts">Carregando Alertas...</div>
      </div>
    `;

    var [clientes, servicos, estoque] = await Promise.all([
      FC.db.getClientes(),
      FC.db.getServicos(),
      FC.db.getEstoque()
    ]);

    // Calcular stats
    var hoje = new Date(); var m = hoje.getMonth(); var y = hoje.getFullYear();
    var mesSrvs = servicos.filter(function(s){
      try{ var d = new Date(s.data+'T00:00:00'); return d.getMonth()===m && d.getFullYear()===y; }catch(e){return false;}
    });
    var qMan = mesSrvs.filter(function(s){return s.tipo==='manipulacao'}).length;
    var qEx  = mesSrvs.filter(function(s){return s.tipo==='exame'}).length;
    var totFaturado = mesSrvs.reduce(function(acc,s){ return acc+parseFloat(s.valor||0); },0);

    ui.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card" style="--c:#60a5fa"><div class="stat-label">Total Clientes</div><div class="stat-value">${clientes.length}</div></div>
        <div class="stat-card" style="--c:#a78bfa"><div class="stat-label">Manipulações (Mês)</div><div class="stat-value">${qMan}</div></div>
        <div class="stat-card" style="--c:#00c9a7"><div class="stat-label">Exames (Mês)</div><div class="stat-value">${qEx}</div></div>
        <div class="stat-card" style="--c:#34d399"><div class="stat-label">Faturamento (Mês)</div><div class="stat-value">${FC.utils.fmt(totFaturado)}</div></div>
      </div>
      <div class="form-grid">
        <div class="card"><div class="card-head"><div class="card-title">Últimos Serviços</div></div><div class="tbl-wrap" id="dashTbl"></div></div>
        <div class="card">
           <div class="card-head"><div class="card-title">Avisos e Alertas</div></div>
           <div class="alerts-grid" id="dashAlerts" style="grid-template-columns:1fr; gap:10px;"></div>
        </div>
      </div>
    `;

    // Tabela Recentes
    var cTable = '<table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>Status</th></tr></thead><tbody>';
    servicos.slice(0,6).forEach(function(s){
      cTable += `<tr><td>${FC.utils.fmtDate(s.data)}</td><td>${FC.utils.tipoBadge(s.tipo)}</td><td>${FC.utils.pagBadge(s.pagamento)}</td></tr>`;
    });
    if(servicos.length===0) cTable += '<tr><td colspan="3" class="empty-state">Nenhum serviço registrado</td></tr>';
    cTable += '</tbody></table>';
    FC.utils.set('dashTbl', cTable);

    // Alertas
    var alertsHtml = '';
    var vencidos = servicos.filter(function(s){ return s.pagamento==='fiado'; });
    if(vencidos.length > 0){
      alertsHtml += `<div class="alert-card danger"><div class="alert-card-title">⚠️ Pagamentos Pendentes</div>`;
      vencidos.slice(0,3).forEach(function(v){
        alertsHtml += `<div class="alert-item">ORC ${v.orc_num} — ${FC.utils.fmt(v.valor)}</div>`;
      });
      alertsHtml += `</div>`;
    }

    var estAlerts = estoque.filter(function(e){ return parseFloat(e.qtd) <= parseFloat(e.minQtd||0); });
    if(estAlerts.length > 0){
      alertsHtml += `<div class="alert-card warn"><div class="alert-card-title">⚠️ Estoque Baixo</div>`;
      estAlerts.slice(0,3).forEach(function(e){
        alertsHtml += `<div class="alert-item">${FC.utils.esc(e.nome)} — Restam: ${e.qtd}</div>`;
      });
      alertsHtml += `</div>`;
    }

    if(!alertsHtml) alertsHtml = `<div class="empty-state" style="padding:1rem;">Tudo tranquilo por aqui 🎉</div>`;
    FC.utils.set('dashAlerts', alertsHtml);
  }

  return { init: init };
})();
