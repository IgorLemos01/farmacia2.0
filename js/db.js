/* js/db.js — Camada de dados com Supabase + localStorage */
var FC = window.FC = window.FC || {};

FC.db = (function(){
  var sb = null;

  // Inicia Supabase a partir do localStorage
  (function init(){
    var url = localStorage.getItem('sb_url');
    var key = localStorage.getItem('sb_key');
    if(url && key && window.supabase){
      try{ sb = window.supabase.createClient(url,key); keepAlive(); }catch(e){}
    }
  })();

  function keepAlive(){
    if(!sb) return;
    var last = parseInt(localStorage.getItem('fc_ka')||'0');
    if(Date.now()-last > 5*24*60*60*1000){
      sb.from('orc_counter').select('id').limit(1).then(function(){
        localStorage.setItem('fc_ka',Date.now());
      }).catch(function(){});
    }
  }

  function lsGet(k){ try{ return JSON.parse(localStorage.getItem('fc_'+k)||'[]'); }catch(e){ return []; } }
  function lsSet(k,v){ localStorage.setItem('fc_'+k,JSON.stringify(v)); }

  function seedAdmin(){
    var users = lsGet('users');
    if(!users.find(function(u){ return u.perfil==='admin'; })){
      users.push({ id:'admin-001', nome:'Administrador', email:'admin@farmaciacouto.com',
        senha:'Couto@2025!', perfil:'admin', ativo:true, criado_em:new Date().toISOString(), perms:{} });
      lsSet('users',users);
    }
  }

  function normPerms(perms,perfil){
    var mods=['clientes','manipulacao','exames','orcamentos','estoque','usuarios'];
    var out={};
    mods.forEach(function(m){
      if(perfil==='admin'){ out[m]='edit'; return; }
      if(m==='usuarios'){ out[m]=(perfil==='gerente')?'edit':'none'; return; }
      if(m==='estoque'){ out[m]=(perfil==='atendente')?'none':'edit'; return; }
      out[m]=(perms&&perms[m])||(perfil==='atendente'?'read':'edit');
    });
    return out;
  }

  // ── Clientes ──────────────────────────────────────────
  async function getClientes(){
    if(sb){ var r=await sb.from('clientes').select('*').order('nome'); if(!r.error){ lsSet('clientes',r.data); return r.data; } }
    return lsGet('clientes');
  }
  async function saveCliente(obj){
    if(!obj.id) obj.id=uid();
    if(!obj.criado_em) obj.criado_em=new Date().toISOString();
    var arr=lsGet('clientes');
    var i=arr.findIndex(function(c){ return c.id===obj.id; });
    if(i>=0) arr[i]=Object.assign({},arr[i],obj); else arr.push(obj);
    lsSet('clientes',arr);
    if(sb) await sb.from('clientes').upsert(obj);
    return obj.id;
  }
  async function delCliente(id){
    var arr=lsGet('clientes');
    lsSet('clientes',arr.map(function(c){ return c.id===id?Object.assign({},c,{ativo:false}):c; }));
    if(sb) await sb.from('clientes').update({ativo:false}).eq('id',id);
  }

  // ── Serviços ──────────────────────────────────────────
  async function getServicos(f){
    f=f||{};
    if(sb){
      var q=sb.from('servicos').select('*').order('criado_em',{ascending:false}).limit(1000);
      if(f.tipo) q=q.eq('tipo',f.tipo);
      if(f.de)   q=q.gte('data',f.de);
      if(f.ate)  q=q.lte('data',f.ate);
      if(f.pag)  q=q.eq('pagamento',f.pag);
      if(f.cid)  q=q.eq('cliente_id',f.cid);
      var r=await q;
      if(!r.error){ if(!f.tipo&&!f.de&&!f.ate) lsSet('servicos',r.data); return r.data; }
    }
    var arr=lsGet('servicos');
    if(f.tipo) arr=arr.filter(function(s){ return s.tipo===f.tipo; });
    if(f.de)   arr=arr.filter(function(s){ return s.data>=f.de; });
    if(f.ate)  arr=arr.filter(function(s){ return s.data<=f.ate; });
    if(f.pag)  arr=arr.filter(function(s){ return s.pagamento===f.pag; });
    if(f.cid)  arr=arr.filter(function(s){ return s.cliente_id===f.cid; });
    return arr;
  }
  async function saveServico(obj){
    var num;
    if(sb){ var r=await sb.rpc('next_orc_num'); num=r.error?nextOrcNum():r.data; }
    else { num=nextOrcNum(); }
    obj.id=uid();
    obj.orc_num=num;
    obj.criado_em=new Date().toISOString();
    var arr=lsGet('servicos'); arr.unshift(obj); lsSet('servicos',arr.slice(0,3000));
    if(sb) await sb.from('servicos').insert([obj]);
    return num;
  }
  function nextOrcNum(){
    var n=parseInt(localStorage.getItem('fc_orc_n')||'0')+1;
    localStorage.setItem('fc_orc_n',n); return n;
  }

  // ── Estoque ───────────────────────────────────────────
  async function getEstoque(){
    if(sb){ var r=await sb.from('estoque').select('*').order('nome'); if(!r.error){ lsSet('estoque',r.data); return r.data; } }
    return lsGet('estoque');
  }
  async function saveEstoque(obj){
    if(!obj.id) obj.id=uid();
    if(!obj.criado_em) obj.criado_em=new Date().toISOString();
    obj.atualizado_em=new Date().toISOString();
    var arr=lsGet('estoque');
    var i=arr.findIndex(function(x){ return x.id===obj.id; });
    if(i>=0) arr[i]=Object.assign({},arr[i],obj); else arr.push(obj);
    lsSet('estoque',arr);
    if(sb) await sb.from('estoque').upsert(obj);
  }
  async function delEstoque(id){
    lsSet('estoque',lsGet('estoque').filter(function(i){ return i.id!==id; }));
    if(sb) await sb.from('estoque').delete().eq('id',id);
  }

  // ── Usuários ──────────────────────────────────────────
  async function getUsers(){
    seedAdmin();
    if(sb){ var r=await sb.from('system_users').select('*').order('nome'); if(!r.error) return r.data; }
    return lsGet('users');
  }
  async function saveUser(obj,senha){
    if(!obj.id) obj.id=uid();
    if(!obj.criado_em) obj.criado_em=new Date().toISOString();
    var arr=lsGet('users');
    var i=arr.findIndex(function(u){ return u.id===obj.id; });
    if(i>=0){ arr[i]=Object.assign({},arr[i],obj); if(senha) arr[i].senha=senha; }
    else { arr.push(Object.assign({},obj,{senha:senha||'',ativo:true})); }
    lsSet('users',arr);
    if(sb){
      if(senha&&i<0){
        try{ var res=await sb.auth.admin.createUser({email:obj.email,password:senha,email_confirm:true}); if(!res.error) obj.auth_id=res.data.user.id; }catch(e){}
        var {senha:_s,...d}=obj; await sb.from('system_users').insert([d]);
      } else if(i>=0){
        var {senha:_s,...d}=obj; await sb.from('system_users').update(d).eq('id',obj.id);
      }
    }
  }
  async function delUser(id){
    lsSet('users',lsGet('users').map(function(u){ return u.id===id?Object.assign({},u,{ativo:false}):u; }));
    if(sb) await sb.from('system_users').update({ativo:false}).eq('id',id);
  }

  // ── Auth ──────────────────────────────────────────────
  async function loginSB(email,pass){
    if(!sb) return null;
    var r=await sb.auth.signInWithPassword({email:email,password:pass});
    if(r.error) return null;
    var p=await sb.from('system_users').select('*').eq('email',email).single();
    if(p.error) return null;
    return {user:Object.assign({id:r.data.user.id,email:email},p.data)};
  }
  function logoutSB(){ if(sb) sb.auth.signOut(); }
  function config(url,key){
    localStorage.setItem('sb_url',url); localStorage.setItem('sb_key',key);
    if(window.supabase){ try{ sb=window.supabase.createClient(url,key); keepAlive(); return true; }catch(e){} }
    return false;
  }

  return {
    lsGet:lsGet, lsSet:lsSet, seedAdmin:seedAdmin, normPerms:normPerms,
    isConfigured:function(){ return !!sb; }, config:config,
    getClientes:getClientes, saveCliente:saveCliente, delCliente:delCliente,
    getServicos:getServicos, saveServico:saveServico,
    getEstoque:getEstoque, saveEstoque:saveEstoque, delEstoque:delEstoque,
    getUsers:getUsers, saveUser:saveUser, delUser:delUser,
    loginSB:loginSB, logoutSB:logoutSB
  };
})();
