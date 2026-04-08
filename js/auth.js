/* js/auth.js — Autenticação e Sessão */
var FC = window.FC = window.FC || {};

FC.auth = (function(){
  var user = null;
  var perms = null;

  function init(){
    var s = sessionStorage.getItem('fc_sess');
    if(s){
      try{
        var d = JSON.parse(s);
        var timeout = 8 * 60 * 60 * 1000; // 8 horas
        if(d.l && (Date.now() - d.l < timeout)){
          user = d.u;
          perms = FC.db.normPerms(d.p, user.perfil);
          return true;
        } else {
          sessionStorage.removeItem('fc_sess');
          FC.utils.toast('Sessão expirada. Faça login novamente.', 'yw');
        }
      }catch(e){}
    }
    return false;
  }

  async function login(email, pass){
    email = email.trim().toLowerCase();
    
    // Rate limit
    var attempts = JSON.parse(localStorage.getItem('fc_la') || '{"c":0,"l":0}');
    if(attempts.l > Date.now()){
      var min = Math.ceil((attempts.l - Date.now()) / 60000);
      FC.utils.toast('Muitas tentativas. Aguarde ' + min + ' min.', 'er');
      return false;
    }

    try {
      var success = false;
      var uid = null;
      var dbUser = null;

      // Supabase
      if(FC.db.isConfigured()){
        var res = await FC.db.loginSB(email, pass);
        if(res && res.user){
          dbUser = res.user;
          success = true;
        }
      }

      // Fallback
      if(!success){
        FC.db.seedAdmin();
        var users = FC.db.lsGet('users');
        var u = users.find(function(x){ return x.email === email && x.senha === pass && x.ativo; });
        if(u){ dbUser = u; success = true; }
      }

      if(success && dbUser){
        user = dbUser;
        perms = FC.db.normPerms(dbUser.perms, dbUser.perfil);
        sessionStorage.setItem('fc_sess', JSON.stringify({u: user, p: dbUser.perms, l: Date.now()}));
        localStorage.removeItem('fc_la');
        return true;
      } else {
        attempts.c++;
        if(attempts.c >= 5){
          attempts.l = Date.now() + 15 * 60000;
          FC.utils.toast('Acesso bloqueado por 15 min.', 'er');
        } else {
          FC.utils.toast('E-mail ou senha incorretos.', 'er');
        }
        localStorage.setItem('fc_la', JSON.stringify(attempts));
        return false;
      }
    } catch(e) {
      FC.utils.toast('Erro ao fazer login.', 'er');
      return false;
    }
  }

  function logout(){
    user = null; perms = null;
    sessionStorage.removeItem('fc_sess');
    FC.db.logoutSB();
  }

  function check(mod){
    if(!user) return 'none';
    return (perms && perms[mod]) || 'none';
  }

  return {
    init: init,
    login: login,
    logout: logout,
    check: check,
    getUser: function(){ return user; },
    getPerms: function(){ return perms; }
  };
})();
