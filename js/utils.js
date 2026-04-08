/* js/utils.js — Funções auxiliares globais */
var FC = window.FC = window.FC || {};

FC.utils = {
  esc: function(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },
  uid: function(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); },
  padNum: function(n){ return String(n||0).padStart(4,'0'); },
  fmt: function(v){ return 'R$ '+parseFloat(v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); },
  fmtDate: function(d){
    if(!d) return '—';
    try{ var dt=new Date(d+'T12:00:00'); return dt.toLocaleDateString('pt-BR'); }catch(e){ return d; }
  },
  set: function(id,html){ var el=document.getElementById(id); if(el) el.innerHTML=html||''; },
  gv: function(id){ var el=document.getElementById(id); return el?el.value.trim():''; },
  sv: function(id,v){ var el=document.getElementById(id); if(el) el.value=(v!=null?v:''); },
  maskCPF: function(el){
    var v=el.value.replace(/\D/g,'').slice(0,11);
    v=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
    el.value=v;
  },
  maskPhone: function(el){
    var v=el.value.replace(/\D/g,'').slice(0,11);
    v=v.replace(/^(\d{2})(\d)/,'($1) $2').replace(/(\d{4,5})(\d{4})$/,'$1-$2');
    el.value=v;
  },
  validarCPF: function(cpf){
    cpf=cpf.replace(/\D/g,'');
    if(cpf.length!==11||/^(\d)\1+$/.test(cpf)) return false;
    var s=0,r;
    for(var i=1;i<=9;i++) s+=parseInt(cpf[i-1])*(11-i);
    r=(s*10)%11; if(r===10||r===11) r=0;
    if(r!==parseInt(cpf[9])) return false;
    s=0;
    for(var i=1;i<=10;i++) s+=parseInt(cpf[i-1])*(12-i);
    r=(s*10)%11; if(r===10||r===11) r=0;
    return r===parseInt(cpf[10]);
  },
  validarEmail: function(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); },
  toast: function(msg,type){
    type=type||'ok';
    var map={ok:'✅',er:'❌',yw:'⚠️'};
    var box=document.getElementById('toasts'); if(!box) return;
    var el=document.createElement('div');
    el.className='toast t-'+type;
    el.textContent=(map[type]||'ℹ️')+' '+msg;
    box.appendChild(el);
    setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(function(){ el.remove(); },350); },4000);
  },
  openModal: function(id){ var el=document.getElementById(id); if(el) el.classList.remove('h'); },
  closeModal: function(id){ var el=document.getElementById(id); if(el) el.classList.add('h'); },
  tipoBadge: function(tipo){
    var map={manipulacao:['Manipulação','blue'],exame:['Exame','purple'],produto:['Produto','teal']};
    var d=map[tipo]||[tipo,'gray'];
    return '<span class="badge badge-'+d[1]+'">'+FC.utils.esc(d[0])+'</span>';
  },
  pagBadge: function(pag){
    var map={pix:['Pix','green'],dinheiro:['Dinheiro','teal'],cartao:['Cartão','blue'],convenio:['Convênio','purple'],fiado:['A Receber','red']};
    var d=map[pag]||[pag,'gray'];
    return '<span class="badge badge-'+d[1]+'">'+FC.utils.esc(d[0])+'</span>';
  },
  skel: function(rows,cols){
    var out='';
    for(var i=0;i<rows;i++){
      out+='<tr>';
      for(var j=0;j<cols;j++) out+='<td><div class="skel" style="height:18px;margin:2px 0"></div></td>';
      out+='</tr>';
    }
    return out;
  }
};

// Aliases globais convenientes
function esc(s){ return FC.utils.esc(s); }
function padNum(n){ return FC.utils.padNum(n); }
function fmt(v){ return FC.utils.fmt(v); }
function fmtDate(d){ return FC.utils.fmtDate(d); }
function gv(id){ return FC.utils.gv(id); }
function sv(id,v){ return FC.utils.sv(id,v); }
function uid(){ return FC.utils.uid(); }
function toast(m,t){ return FC.utils.toast(m,t); }
function openModal(id){ return FC.utils.openModal(id); }
function closeModal(id){ return FC.utils.closeModal(id); }
