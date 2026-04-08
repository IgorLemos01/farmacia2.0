/* js/app.js — Core da aplicação */
var FC = window.FC = window.FC || {};

document.addEventListener("DOMContentLoaded", function(){
  // Bind Login Form
  var btnLogin = document.getElementById('btnLogin');
  if(btnLogin){
    btnLogin.addEventListener('click', async function(){
      var btn = this;
      var email = FC.utils.gv('loginEmail');
      var pass  = FC.utils.gv('loginPass');
      if(!email || !pass){ FC.utils.toast('Preencha os campos.','yw'); return; }
      
      btn.disabled = true; btn.innerText = "Entrando...";
      var ok = await FC.auth.login(email, pass);
      if(ok) window.location.reload();
      else { btn.disabled = false; btn.innerText = "Entrar no sistema"; }
    });
  }

  // Init auth
  if(FC.auth.init()){
    document.getElementById('loginPage').classList.add('h');
    document.getElementById('app').classList.remove('h');
    
    var u = FC.auth.getUser();
    FC.utils.set('sbName', u.nome);
    FC.utils.set('sbRole', u.perfil.toUpperCase());
    FC.utils.set('sbAvatar', (u.nome||'U').substring(0,2).toUpperCase());

    initAppShell();
  } else {
    document.getElementById('loginPage').classList.remove('h');
    document.getElementById('app').classList.add('h');
  }
});

function initAppShell(){
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', function(){
    FC.auth.logout();
    window.location.reload();
  });

  // Load modules
  if(FC.pages){
    if(FC.pages.dashboard) FC.pages.dashboard.init();
    if(FC.pages.clientes) FC.pages.clientes.init();
    if(FC.pages.servicos) FC.pages.servicos.init();
    if(FC.pages.estoque) FC.pages.estoque.init();
    if(FC.pages.orcamentos) FC.pages.orcamentos.init();
    if(FC.pages.usuarios) FC.pages.usuarios.init();
  }

  // Sidebar Logic
  var items = document.querySelectorAll('.sb-item');
  items.forEach(function(item){
    var mod = item.getAttribute('data-page');
    // Hide if no permission
    if(mod && FC.auth.check(mod) === 'none' && mod !== 'dashboard'){
      item.classList.add('h');
      // hide category if specific
      if(mod === 'usuarios') document.getElementById('adminSection').classList.add('h');
    }

    item.addEventListener('click', function(){
      if(!mod) return;
      items.forEach(function(i){ i.classList.remove('active'); });
      item.classList.add('active');

      document.querySelectorAll('.page-content').forEach(function(p){ p.classList.add('h'); });
      var pEl = document.getElementById('page-' + mod);
      if(pEl) pEl.classList.remove('h');

      FC.utils.set('pageTitle', item.innerText.replace(/[^\w\sÀ-ú]/g,'').trim());
      
      // trigger resize or maps if needed
      var ev = new Event('pageShow');
      ev.pageName = mod;
      window.dispatchEvent(ev);

      // close sidebar on mobile
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sbOverlay').classList.remove('on');
    });
  });

  // Mobile Menu
  document.getElementById('menuTrigger').addEventListener('click', function(){
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sbOverlay').classList.add('on');
  });
  document.getElementById('sbOverlay').addEventListener('click', function(){
    document.getElementById('sidebar').classList.remove('open');
    this.classList.remove('on');
  });

  // Clock
  setInterval(function(){
    var now = new Date();
    FC.utils.set('clock', now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) + ' · ' + now.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}));
  }, 1000);
}
