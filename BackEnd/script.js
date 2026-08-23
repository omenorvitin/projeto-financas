/* ================= DADOS ================= */
const DEFAULT_DATA = {
  config:{moeda:'BRL',diaInicio:1,tema:'light',notif:true},
  contas:[
    {id:1,nome:'Conta Corrente',tipo:'corrente',saldo:3540.75,cor:'#2563eb',icon:'fa-solid fa-building-columns'},
    {id:2,nome:'Poupança',tipo:'poupanca',saldo:8200.00,cor:'#16a34a',icon:'fa-solid fa-piggy-bank'},
    {id:3,nome:'Carteira',tipo:'carteira',saldo:320.50,cor:'#d97706',icon:'fa-solid fa-wallet'},
    {id:4,nome:'Cartão Nubank',tipo:'cartao',saldo:0,limite:5000,diaFecho:5,diaVencto:10,cor:'#7c3aed',icon:'fa-solid fa-credit-card'}
  ],
  categorias:[
    {id:1,nome:'Alimentação',tipo:'despesa',cor:'#f97316',icon:'fa-solid fa-utensils',subs:['Mercado','Restaurantes','Delivery','Café']},
    {id:2,nome:'Transporte',tipo:'despesa',cor:'#0ea5e9',icon:'fa-solid fa-car',subs:['Combustível','Uber','Ônibus','Manutenção']},
    {id:3,nome:'Moradia',tipo:'despesa',cor:'#8b5cf6',icon:'fa-solid fa-house',subs:['Aluguel','Contas de casa','Internet','Móveis']},
    {id:4,nome:'Saúde',tipo:'despesa',cor:'#ef4444',icon:'fa-solid fa-pills',subs:['Farmácia','Médicos','Plano de saúde','Academia']},
    {id:5,nome:'Lazer',tipo:'despesa',cor:'#ec4899',icon:'fa-solid fa-gamepad',subs:['Cinema','Viagens','Streaming','Festas']},
    {id:6,nome:'Educação',tipo:'despesa',cor:'#14b8a6',icon:'fa-solid fa-graduation-cap',subs:['Cursos','Livros','Mensalidade']},
    {id:7,nome:'Assinaturas',tipo:'despesa',cor:'#6366f1',icon:'fa-solid fa-mobile-screen',subs:['Netflix','Spotify','Software','Clube']},
    {id:8,nome:'Investimentos',tipo:'despesa',cor:'#22c55e',icon:'fa-solid fa-chart-line',subs:['Renda fixa','Ações','Fundo de emergência']},
    {id:9,nome:'Outros',tipo:'despesa',cor:'#94a3b8',icon:'fa-solid fa-box',subs:['Presentes','Impostos','Outros']},
    {id:10,nome:'Salário',tipo:'receita',cor:'#10b981',icon:'fa-solid fa-briefcase',subs:['Salário','Freelance','13º']},
    {id:11,nome:'Rendimentos',tipo:'receita',cor:'#f59e0b',icon:'fa-solid fa-chart-pie',subs:['Juros','Dividendos']}
  ],
  transacoes:[],
  orcamentos:[{categoria_id:1,limite:1200},{categoria_id:2,limite:400},{categoria_id:3,limite:1800},{categoria_id:4,limite:300},{categoria_id:5,limite:350},{categoria_id:7,limite:150},{categoria_id:8,limite:500}],
  metas:[{id:1,nome:'Viagem para Praia',alvo:5000,atual:2350,dataLimite:'2025-12-15'},{id:2,nome:'Fundo de Emergência',alvo:10000,atual:8200,dataLimite:'2026-06-30'}]
};

let db = null;
let currentType = 'despesa';
let editingId = null;
let charts = {};

/* ================= AUTENTICAÇÃO ================= */
// Mesma chave usada por login.html ao salvar o usuário depois do login.
const STORAGE_KEY = 'usuario';
let usuarioAtual = null;

/**
 * Garante que existe um usuário logado antes de deixar o dashboard
 * carregar. Sem isso, qualquer pessoa conseguia abrir index.html direto,
 * sem passar pelo login.
 */
function verificarAutenticacao() {
  const usuarioJSON = localStorage.getItem(STORAGE_KEY);
  if (!usuarioJSON) {
    window.location.href = './login.html';
    return false;
  }
  try {
    usuarioAtual = JSON.parse(usuarioJSON);
    if (!usuarioAtual || !usuarioAtual.id) throw new Error('usuário inválido');
    return true;
  } catch (e) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = './login.html';
    return false;
  }
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = './login.html';
}

const EMOJI_TO_FA = {
  '🏦':'fa-solid fa-building-columns','🐷':'fa-solid fa-piggy-bank','👛':'fa-solid fa-wallet','💳':'fa-solid fa-credit-card',
  '🍔':'fa-solid fa-utensils','🚗':'fa-solid fa-car','🏠':'fa-solid fa-house','💊':'fa-solid fa-pills','🎮':'fa-solid fa-gamepad',
  '📚':'fa-solid fa-graduation-cap','📱':'fa-solid fa-mobile-screen','📈':'fa-solid fa-chart-line','📦':'fa-solid fa-box',
  '💼':'fa-solid fa-briefcase','📊':'fa-solid fa-chart-pie','💰':'fa-solid fa-coins'
};
function migrateIcons(d){
  d.contas.forEach(c=>{ if(c.icon && EMOJI_TO_FA[c.icon]) c.icon=EMOJI_TO_FA[c.icon]; });
  d.categorias.forEach(c=>{ if(c.icon && EMOJI_TO_FA[c.icon]) c.icon=EMOJI_TO_FA[c.icon]; });
  return d;
}
async function loadDB(){
  try{
    const res = await fetch(`/api/data?usuario_id=${usuarioAtual.id}`);
    if(res.ok){
      const d = await res.json();
      if(d && d.contas && d.transacoes){ return migrateIcons(d); }
    }
  }catch(e){
    console.warn('Não foi possível falar com o backend, usando dados locais de exemplo.', e);
  }
  // Nada salvo ainda no banco (ou backend fora do ar): gera o exemplo padrão
  const d = JSON.parse(JSON.stringify(DEFAULT_DATA));
  d.transacoes = seedTransactions();
  await saveDB(d);
  return d;
}
async function saveDB(data){
  const payload = data || db;
  try{
    await fetch('/api/data', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ usuario_id: usuarioAtual.id, ...payload })
    });
  }catch(e){
    console.warn('Falha ao salvar no backend:', e);
  }
}

/* ================= DADOS DE EXEMPLO ================= */
function seedTransactions(){
  const now = new Date();
  const y=now.getFullYear(), m=now.getMonth();
  function d(day,mo=0,yr=0){ return new Date(yr||y, (mo||m)+ (yr?0:0), day).toISOString().slice(0,10); }
  const t=[];
  t.push({id:1,desc:'Salário',valor:5200,data:d(5),tipo:'receita',categoria_id:10,conta_id:1,forma:'Transferência',status:'pago',anexo:null,recorrente:null,parcela_atual:null,parcela_total:null});
  t.push({id:2,desc:'Mercado Extra',valor:486.30,data:d(6),tipo:'despesa',categoria_id:1,conta_id:1,forma:'Débito',status:'pago',anexo:null,recorrente:null,parcela_atual:1,parcela_total:1});
  t.push({id:3,desc:'Aluguel',valor:1500,data:d(8),tipo:'despesa',categoria_id:3,conta_id:1,forma:'PIX',status:'pago',anexo:null,recorrente:'mensal',parcela_atual:null,parcela_total:null});
  t.push({id:4,desc:'Netflix',valor:39.90,data:d(9),tipo:'despesa',categoria_id:7,conta_id:1,forma:'Crédito',status:'pago',anexo:null,recorrente:'mensal',parcela_atual:null,parcela_total:null});
  t.push({id:5,desc:'Uber',valor:24.50,data:d(10),tipo:'despesa',categoria_id:2,conta_id:3,forma:'Débito',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:6,desc:'Restaurante Pizzaria',valor:89.00,data:d(12),tipo:'despesa',categoria_id:1,conta_id:3,forma:'PIX',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:7,desc:'Farmácia',valor:76.20,data:d(14),tipo:'despesa',categoria_id:4,conta_id:1,forma:'Débito',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:8,desc:'Iphone 13 (12x)',valor:499.90,data:d(15),tipo:'despesa',categoria_id:9,conta_id:4,forma:'Crédito',status:'pago',anexo:null,parcela_atual:3,parcela_total:12});
  t.push({id:9,desc:'Academia',valor:99.90,data:d(16),tipo:'despesa',categoria_id:4,conta_id:1,forma:'Débito',status:'pago',anexo:null,recorrente:'mensal',parcela_atual:null,parcela_total:null});
  t.push({id:10,desc:'Cinema + pipoca',valor:58,data:d(18),tipo:'despesa',categoria_id:5,conta_id:3,forma:'Dinheiro',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:11,desc:'Spotify',valor:21.90,data:d(20),tipo:'despesa',categoria_id:7,conta_id:1,forma:'Crédito',status:'pago',anexo:null,recorrente:'mensal',parcela_atual:null,parcela_total:null});
  t.push({id:12,desc:'Cache de freelancer',valor:800,data:d(22),tipo:'receita',categoria_id:10,conta_id:1,forma:'PIX',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:13,desc:'Conta de luz',valor:142.35,data:d(25),tipo:'despesa',categoria_id:3,conta_id:1,forma:'Débito',status:'pendente',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:14,desc:'Internet Fibra',valor:99.90,data:d(28),tipo:'despesa',categoria_id:3,conta_id:1,forma:'Débito',status:'pendente',anexo:null,recorrente:'mensal',parcela_atual:null,parcela_total:null});
  const pm = m-1<0?11:m-1; const py = m-1<0?y-1:y;
  function dPrev(day){ return new Date(py,pm,day).toISOString().slice(0,10); }
  t.push({id:15,desc:'Salário',valor:5200,data:dPrev(5),tipo:'receita',categoria_id:10,conta_id:1,forma:'Transferência',status:'pago',anexo:null,recorrente:null,parcela_atual:null,parcela_total:null});
  t.push({id:16,desc:'Mercado',valor:512.80,data:dPrev(6),tipo:'despesa',categoria_id:1,conta_id:1,forma:'Débito',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:17,desc:'Aluguel',valor:1500,data:dPrev(8),tipo:'despesa',categoria_id:3,conta_id:1,forma:'PIX',status:'pago',anexo:null,recorrente:null,parcela_atual:null,parcela_total:null});
  t.push({id:18,desc:'Combustível',valor:180,data:dPrev(12),tipo:'despesa',categoria_id:2,conta_id:1,forma:'Débito',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:19,desc:'Restaurante',valor:120,data:dPrev(15),tipo:'despesa',categoria_id:1,conta_id:3,forma:'PIX',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:20,desc:'Farmácia',valor:65.40,data:dPrev(18),tipo:'despesa',categoria_id:4,conta_id:1,forma:'Débito',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:21,desc:'Netflix',valor:39.90,data:dPrev(9),tipo:'despesa',categoria_id:7,conta_id:1,forma:'Crédito',status:'pago',anexo:null,recorrente:null,parcela_atual:null,parcela_total:null});
  t.push({id:22,desc:'Rendimento Poupança',valor:45.30,data:dPrev(20),tipo:'receita',categoria_id:11,conta_id:2,forma:'Transferência',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  t.push({id:23,desc:'Transferência p/ Poupança',valor:500,data:d(7),tipo:'transferencia',categoria_id:null,conta_id:1,conta_dest_id:2,forma:'Transferência',status:'pago',anexo:null,parcela_atual:null,parcela_total:null});
  return t.sort((a,b)=>b.data.localeCompare(a.data));
}

/* ================= UTILIDADES ================= */
function fmt(v){
  const moeda = db.config.moeda;
  const sym = {BRL:'R$',USD:'US$',EUR:'€'}[moeda]||'R$';
  const dec = {BRL:2,USD:2,EUR:2}[moeda]||2;
  return sym + ' ' + v.toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
}
function fmtData(d){
  if(!d) return '';
  const [y,m,dd]=d.split('-');
  if(!y||!m||!dd) return d;
  return dd+'/'+m+'/'+y;
}
function today(){ return new Date().toISOString().slice(0,10); }
function catById(id){ return db.categorias.find(c=>c.id===id); }
function contaById(id){ return db.contas.find(c=>c.id===id); }
function catIconHtml(cat){ return cat&&cat.icon?`<i class="${cat.icon}"></i>`:'<i class="fa-solid fa-box"></i>'; }
function catColor(cat){ return cat?cat.cor:'#94a3b8'; }
function catName(id){ const c=catById(id); return c?c.nome:''; }
function monthLabel(key){ if(!key) return ''; const [y,m]=key.split('-'); const names=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return names[parseInt(m)-1]+'/'+y; }
function monthLabelFull(key){ if(!key) return ''; const [y,m]=key.split('-'); const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']; return names[parseInt(m)-1]+' de '+y; }
function toast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast show '+(type||'');
  setTimeout(()=>t.className='toast',2200);
}
function esc(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'<','>':'>','"':'"',"'":'&#39;'}[c])); }

/* ================= NAVEGAÇÃO ================= */
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click',()=>switchPage(btn.dataset.page));
});
function switchPage(page){
  document.querySelectorAll('main').forEach(m=>m.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  window.scrollTo({top:0});
  renderPage(page);
}
function renderPage(page){
  if(page==='home') renderHome();
  else if(page==='trans') renderTransacoes();
  else if(page==='contas') renderContas();
  else if(page==='cartoes') renderCartoes();
  else if(page==='orcamento') renderOrcamento();
  else if(page==='metas') renderMetas();
  else if(page==='relatorios') renderRelatorios();
  else if(page==='config') renderConfig();
}

/* ================= FINANCEIRO ================= */
function getMonthRange(diaInicio){
  const now = new Date();
  let y=now.getFullYear(), m=now.getMonth();
  let start, end;
  if(diaInicio===1){
    start=new Date(y,m,1);
    end=new Date(y,m+1,1);
  }else{
    const todayDay=now.getDate();
    if(todayDay<diaInicio){
      start=new Date(y,m-1,diaInicio);
      end=new Date(y,m,diaInicio);
    }else{
      start=new Date(y,m,diaInicio);
      end=new Date(y,m+1,diaInicio);
    }
  }
  return {start:start, end:end, startISO:start.toISOString().slice(0,10), endISO:end.toISOString().slice(0,10)};
}
function saldoConta(id){
  const conta = contaById(id);
  if(!conta) return 0;
  let s = conta.saldo;
  db.transacoes.forEach(t=>{
    if(t.status!=='pago') return;
    if(t.tipo==='receita' && t.conta_id===id) s+=t.valor;
    else if(t.tipo==='despesa' && t.conta_id===id) s-=t.valor;
    else if(t.tipo==='transferencia'){
      if(t.conta_id===id) s-=t.valor;
      if(t.conta_dest_id===id) s+=t.valor;
    }
  });
  return arred(s);
}
function saldoTotal(){
  let s=0;
  db.contas.forEach(c=>{ if(c.tipo!=='cartao') s+=saldoConta(c.id); });
  return arred(s);
}
function arred(v){ return Math.round(v*100)/100; }
function sumReceitas(range){ return arred(db.transacoes.filter(t=>t.tipo==='receita' && t.status==='pago' && t.data>=range.startISO && t.data<range.endISO).reduce((a,t)=>a+t.valor,0)); }
function sumDespesas(range){ return arred(db.transacoes.filter(t=>t.tipo==='despesa' && t.status==='pago' && t.data>=range.startISO && t.data<range.endISO).reduce((a,t)=>a+t.valor,0)); }
function sumDespesasPorCat(range,catId){ return arred(db.transacoes.filter(t=>t.tipo==='despesa' && t.status==='pago' && t.categoria_id===catId && t.data>=range.startISO && t.data<range.endISO).reduce((a,t)=>a+t.valor,0)); }

/* ================= HOME ================= */
function renderHome(){
  const range = getMonthRange(db.config.diaInicio);
  document.getElementById('heroSaldo').textContent = fmt(saldoTotal());
  const receitas = sumReceitas(range), despesas = sumDespesas(range);
  const saldoMes = arred(receitas-despesas);
  document.getElementById('heroSub').textContent = (saldoMes>=0?'+':'')+fmt(saldoMes)+' no mês financeiro ('+monthLabelFull(range.startISO.slice(0,7))+')';
  document.getElementById('stReceitas').textContent = fmt(receitas);
  document.getElementById('stDespesas').textContent = fmt(despesas);
  const prevEnd = new Date(range.start); prevEnd.setMinutes(-1);
  const prevStart = new Date(range.start);
  prevStart.setMonth(prevStart.getMonth()-1);
  const prevRange={startISO:prevStart.toISOString().slice(0,10),endISO:prevEnd.toISOString().slice(0,10)};
  const pRec=sumReceitas(prevRange), pDes=sumDespesas(prevRange);
  const cmp=(cur,prev)=>{
    if(prev===0) return '<span class="cmp up">— novo</span>';
    const diff=((cur-prev)/prev)*100;
    const cls=diff>=0?'up':'down';
    return '<span class="cmp '+cls+'">'+(diff>=0?'+':'')+diff.toFixed(1)+'% vs mês ant.</span>';
  };
  document.getElementById('cmpReceitas').innerHTML = cmp(receitas,pRec);
  document.getElementById('cmpDespesas').innerHTML = cmp(despesas,pDes);
  const diasTotal = Math.round((range.end-range.start)/86400000);
  const diasRestantes = Math.max(1, Math.round((range.end-new Date())/86400000));
  const disponivel = arred(saldoMes);
  const daily = arred(disponivel/diasRestantes);
  document.getElementById('dailyVal').textContent = fmt(daily);
  document.getElementById('dailySub').textContent = 'Saldo do mês ('+fmt(saldoMes)+') ÷ '+diasRestantes+' dias restantes de '+diasTotal;
  const gastosCat = {};
  db.transacoes.filter(t=>t.tipo==='despesa'&&t.status==='pago'&&t.data>=range.startISO&&t.data<range.endISO).forEach(t=>{
    const cn = catName(t.categoria_id)||'Outros';
    gastosCat[cn]=(gastosCat[cn]||0)+t.valor;
  });
  const labels=Object.keys(gastosCat), vals=Object.values(gastosCat).map(v=>arred(v));
  const colors=labels.map(l=>{const c=db.categorias.find(x=>x.nome===l); return c?c.cor:'#94a3b8';});
  document.getElementById('chartMonthLbl').textContent = monthLabelFull(range.startISO.slice(0,7));
  makeDoughnut('chartCat',labels,vals,colors);
  const saldoEvo = [];
  const balLabels=[];
  for(let i=5;i>=0;i--){
    let d=new Date(range.start);
    d.setMonth(d.getMonth()-i);
    const rs={startISO:d.toISOString().slice(0,10),endISO:new Date(d.getFullYear(),d.getMonth()+1,d.getDate()).toISOString().slice(0,10)};
    const r=sumReceitas(rs), ds=sumDespesas(rs);
    saldoEvo.push(arred(r-ds));
    balLabels.push(monthLabel(d.toISOString().slice(0,7)));
  }
  makeBar('chartBal',balLabels,saldoEvo);
  const fim7 = new Date(); fim7.setDate(fim7.getDate()+7);
  const fim7ISO = fim7.toISOString().slice(0,10);
  const hj = today();
  const week = db.transacoes.filter(t=>t.data>=hj && t.data<=fim7ISO && t.status!=='pago').sort((a,b)=>a.data.localeCompare(b.data));
  const wc=document.getElementById('weekContas');
  if(week.length===0){ wc.innerHTML='<div class="empty"><div class="em"><i class="fa-solid fa-circle-check"></i></div>Nenhuma conta a pagar/receber nos próximos 7 dias.</div>'; }
  else{
    wc.innerHTML=week.map(t=>{
      const lbl=t.tipo==='receita'?'Receber':'Pagar';
      const valCls=t.tipo==='receita'?'val-pos':'val-neg';
      return `<div class="list-item">
        <div class="cat-ico" style="background:var(--blue-bg)"><i class="fa-solid ${t.tipo==='receita'?'fa-coins':'fa-calendar'}"></i></div>
        <div class="info"><div class="t">${esc(t.desc)}</div><div class="s">Vence ${fmtData(t.data)} · ${lbl}</div></div>
        <span class="${valCls} money">${t.tipo==='receita'?'+':'-'}${fmt(t.valor)}</span>
      </div>`;
    }).join('');
  }
  const ult = db.transacoes.filter(t=>t.tipo!=='transferencia').sort((a,b)=>b.data.localeCompare(a.data)).slice(0,8);
  const ut=document.getElementById('ultimasTrans');
  if(ult.length===0){ ut.innerHTML='<div class="empty"><div class="em"><i class="fa-solid fa-money-bill-wave"></i></div>Nenhuma transação ainda.</div>'; }
  else{
    ut.innerHTML=ult.map(t=>{
      const cat=catById(t.categoria_id);
      const cls=t.tipo==='receita'?'val-pos':'val-neg';
      const sign=t.tipo==='receita'?'+':'-';
      return `<div class="list-item">
        <div class="cat-ico" style="background:${catColor(cat)}22">${catIconHtml(cat)}</div>
        <div class="info"><div class="t">${esc(t.desc)}</div><div class="s">${fmtData(t.data)} · ${cat?cat.nome:''} · ${statusChip(t.status)}</div></div>
        <span class="${cls} money">${sign}${fmt(t.valor)}</span>
      </div>`;
    }).join('');
  }
}
function statusChip(s){
  const m={pago:'<span class="chip green"><i class="fa-solid fa-circle-check"></i> Pago</span>',pendente:'<span class="chip amber"><i class="fa-solid fa-clock"></i> Pendente</span>',agendado:'<span class="chip blue"><i class="fa-solid fa-calendar"></i> Agendado</span>'};
  return m[s]||'';
}

/* ================= GRÁFICOS ================= */
function makeDoughnut(id,labels,data,colors){
  const ctx=document.getElementById(id);
  if(!ctx) return;
  if(charts[id]) charts[id].destroy();
  if(data.length===0){ charts[id]=null; return; }
  charts[id]=new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderColor:getComputedStyle(document.body).getPropertyValue('--card').trim(),borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,font:{size:11},color:getComputedStyle(document.body).getPropertyValue('--muted')}},tooltip:{callbacks:{label:c=>c.label+': '+fmt(c.parsed)}}}}});
}
function makeBar(id,labels,data){
  const ctx=document.getElementById(id);
  if(!ctx) return;
  if(charts[id]) charts[id].destroy();
  const pos=data.map(v=>v>=0?v:0), neg=data.map(v=>v<0?v:0);
  charts[id]=new Chart(ctx,{type:'bar',data:{labels,datasets:[
    {data:pos,backgroundColor:'#16a34a',borderRadius:6},
    {data:neg,backgroundColor:'#dc2626',borderRadius:6}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.parsed.raw)}}},scales:{x:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--muted'),font:{size:11}},grid:{display:false}},y:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--muted'),callback:v=>fmt(v)},grid:{color:getComputedStyle(document.body).getPropertyValue('--border')}}}}});
}

/* ================= TRANSAÇÕES ================= */
function fillTransFilters(){
  const mesSel=document.getElementById('fTransMes');
  const keys=[...new Set(db.transacoes.map(t=>t.data.slice(0,7)))].sort().reverse();
  mesSel.innerHTML='<option value="">Todos os meses</option>'+keys.map(k=>`<option value="${k}">${monthLabelFull(k)}</option>`).join('');
  const catSel=document.getElementById('fTransCat');
  catSel.innerHTML='<option value="">Todas categorias</option>'+db.categorias.filter(c=>c.tipo==='despesa').map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')+db.categorias.filter(c=>c.tipo==='receita').map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
}
function renderTransacoes(){
  fillTransFilters();
  const busca=document.getElementById('fTransBusca').value.toLowerCase();
  const mes=document.getElementById('fTransMes').value;
  const tipo=document.getElementById('fTransTipo').value;
  const cat=document.getElementById('fTransCat').value;
  let list=db.transacoes.slice();
  if(busca) list=list.filter(t=>(t.desc||'').toLowerCase().includes(busca));
  if(mes) list=list.filter(t=>t.data.slice(0,7)===mes);
  if(tipo) list=list.filter(t=>t.tipo===tipo);
  if(cat) list=list.filter(t=>t.categoria_id===parseInt(cat));
  list.sort((a,b)=>b.data.localeCompare(a.data)||b.id-a.id);
  const el=document.getElementById('transList');
  if(list.length===0){ el.innerHTML='<div class="empty"><div class="em"><i class="fa-solid fa-magnifying-glass"></i></div>Nenhuma transação encontrada.</div>'; return; }
  el.innerHTML=`<div style="overflow-x:auto"><table>
    <thead><tr><th>Data</th><th>Descrição</th><th class="mobile-hide">Categoria</th><th class="mobile-hide">Conta</th><th class="mobile-hide">Status</th><th style="text-align:right">Valor</th><th></th></tr></thead>
    <tbody>${list.map(t=>{
      const cat=catById(t.categoria_id);
      const valCls=t.tipo==='receita'?'val-pos':t.tipo==='transferencia'?'val-neu':'val-neg';
      const sign=t.tipo==='receita'?'+':t.tipo==='transferencia'?'⇄':'-';
      return `<tr>
        <td>${fmtData(t.data)}</td>
        <td><b>${esc(t.desc)}</b>${t.recorrente?` <span class="chip teal"><i class="fa-solid fa-rotate"></i></span>`:''}${t.parcela_total>1?` <span class="chip gray">${t.parcela_atual}/${t.parcela_total}x</span>`:''}</td>
        <td class="mobile-hide">${cat?cat.nome:'—'}</td>
        <td class="mobile-hide">${contaById(t.conta_id)?contaById(t.conta_id).nome:''}</td>
        <td class="mobile-hide">${statusChip(t.status)}</td>
        <td style="text-align:right" class="money ${valCls}">${sign}${fmt(t.valor)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn-icon" onclick="duplicar(${t.id})" title="Duplicar"><i class="fa-regular fa-copy"></i></button>
          <button class="btn-icon" onclick="editTrans(${t.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon" onclick="delTrans(${t.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}
function duplicar(id){ const t=db.transacoes.find(x=>x.id===id); const cp=JSON.parse(JSON.stringify(t)); cp.id=Date.now(); cp.desc=cp.desc+' (cópia)'; db.transacoes.push(cp); saveDB(); toast('Transação duplicada'); renderTransacoes(); }
function delTrans(id){ if(!confirm('Excluir esta transação?'))return; db.transacoes=db.transacoes.filter(t=>t.id!==id); saveDB(); toast('Transação excluída','error'); renderTransacoes(); }
function editTrans(id){ const t=db.transacoes.find(x=>x.id===id); openModal(t); }

/* ================= MODAL TRANSAÇÃO ================= */
function openModal(t){
  editingId = t?t.id:null;
  document.getElementById('modalTitle').textContent = t?'Editar transação':'Nova transação';
  fillCatSelect();
  fillContaSelect();
  fillCartaoSelect();
  setTipo(t?t.tipo:'despesa');
  document.getElementById('tDesc').value = t?t.desc:'';
  document.getElementById('tValor').value = t?t.valor:'';
  document.getElementById('tData').value = t?t.data:today();
  document.getElementById('tCategoria').value = t?t.categoria_id||'':'';
  document.getElementById('tConta').value = t?t.conta_id:'';
  if(t&&t.conta_dest_id) document.getElementById('tContaDest').value=t.conta_dest_id;
  document.getElementById('tForma').value = t?t.forma:'PIX';
  document.getElementById('tStatus').value = t?t.status:'pago';
  document.getElementById('tCartao').value = t?(t.cartao_id||''):'';
  document.getElementById('tParcela').value = t?(t.parcela_total||1):1;
  document.getElementById('tRecorrente').value = t?(t.recorrente||''):'';
  document.getElementById('tObs').value = '';
  document.getElementById('modalBg').classList.add('open');
}
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }
document.getElementById('modalBg').addEventListener('click',e=>{ if(e.target.id==='modalBg') closeModal(); });
function setTipo(tipo){
  currentType=tipo;
  document.querySelectorAll('.type-opt').forEach(b=>{
    b.classList.remove('active','exp','des','trans');
    if(b.dataset.tipo===tipo) b.classList.add('active',tipo);
  });
  document.getElementById('tPrefix').textContent=fmt(0).replace('0,00','').trim();
  const isTrans=tipo==='transferencia';
  document.getElementById('rowContaDest').classList.toggle('hidden',!isTrans);
  document.getElementById('rowConta').classList.toggle('hidden',isTrans);
  const isCartao=tipo==='despesa';
  document.getElementById('rowParcela').classList.toggle('hidden',!isCartao);
  document.getElementById('rowRecorrente').classList.toggle('hidden',!isCartao);
  document.getElementById('rowCartao').classList.toggle('hidden',!(isCartao));
  fillCatSelect();
  fillContaSelect();
}
function fillCatSelect(){
  const sel=document.getElementById('tCategoria');
  const cats=db.categorias.filter(c=>c.tipo===currentType);
  sel.innerHTML=cats.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
}
function fillContaSelect(){
  const sel=document.getElementById('tConta');
  const contas=db.contas.filter(c=>c.tipo!=='cartao');
  sel.innerHTML=contas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  const dest=document.getElementById('tContaDest');
  dest.innerHTML=contas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
}
function fillCartaoSelect(){
  const sel=document.getElementById('tCartao');
  const cartoes=db.contas.filter(c=>c.tipo==='cartao');
  sel.innerHTML=cartoes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  if(cartoes.length===0) sel.innerHTML='<option value="">Sem cartão</option>';
}
function saveTransaction(){
  const desc=document.getElementById('tDesc').value.trim();
  const valor=parseFloat(document.getElementById('tValor').value);
  const data=document.getElementById('tData').value;
  const cat=parseInt(document.getElementById('tCategoria').value);
  const conta=parseInt(document.getElementById('tConta').value);
  const contaDest=parseInt(document.getElementById('tContaDest').value);
  const forma=document.getElementById('tForma').value;
  const status=document.getElementById('tStatus').value;
  const cartao=parseInt(document.getElementById('tCartao').value)||null;
  const parcelas=parseInt(document.getElementById('tParcela').value)||1;
  const recorrente=document.getElementById('tRecorrente').value;
  if(!desc||isNaN(valor)||valor<=0||!data){ toast('Preencha descrição, valor e data','error'); return; }
  if(currentType==='transferencia' && !contaDest){ toast('Selecione a conta destino','error'); return; }
  const base={desc,valor:arred(valor),data,tipo:currentType,categoria_id:currentType==='transferencia'?null:cat,conta_id:conta,conta_dest_id:currentType==='transferencia'?contaDest:null,forma,status,anexo:null,recorrente:currentType==='despesa'?recorrente:null,
    parcela_atual:1,parcela_total:currentType==='despesa'?parcelas:1,cartao_id:currentType==='despesa'&&cartao&&parcelas>0?cartao:null};
  if(editingId){
    const i=db.transacoes.findIndex(x=>x.id===editingId);
    db.transacoes[i]={...db.transacoes[i],...base}; db.transacoes[i].id=editingId;
    toast('Transação atualizada');
  }else{
    if(currentType==='despesa' && parcelas>1){
      for(let p=0;p<parcelas;p++){
        const dt=new Date(data); dt.setMonth(dt.getMonth()+p);
        db.transacoes.push({id:Date.now()+p,desc:desc+' ('+(p+1)+'/'+parcelas+')',valor:arred(valor/parcelas),data:dt.toISOString().slice(0,10),tipo:currentType,categoria_id:cat,conta_id:conta,forma,status:p===0?status:'agendado',anexo:null,recorrente:null,parcela_atual:p+1,parcela_total:parcelas,cartao_id:cartao});
      }
      toast('Despesa parcelada em '+parcelas+'x gerada');
    }else{
      db.transacoes.push({id:Date.now(),...base,parcela_total:1,parcela_atual:1});
      toast('Transação adicionada!');
    }
  }
  saveDB(); closeModal(); renderTransacoes();
}

/* ================= CONTAS ================= */
function renderContas(){
  const consolidado=saldoTotal();
  document.getElementById('saldoConsolidado').textContent=fmt(consolidado);
  const grid=document.getElementById('contasGrid');
  grid.innerHTML=db.contas.filter(c=>c.tipo!=='cartao').map(c=>{
    const saldo=saldoConta(c.id);
    const cls=saldo>=0?'val-pos':'val-neg';
    return `<div class="card">
      <div class="mb"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px"><i class="${c.icon}"></i></span><h3>${esc(c.nome)}</h3></div>
      <button class="btn-icon" onclick="delConta(${c.id})"><i class="fa-solid fa-trash"></i></button></div>
      <div class="lbl" style="font-size:12px;color:var(--muted)">${tipoConta(c.tipo)}</div>
      <div class="val money ${cls}" style="font-size:24px;font-weight:800;margin-top:6px">${fmt(saldo)}</div>
    </div>`;
  }).join('')+`<div class="card" style="display:grid;place-items:center;min-height:120px;border:2px dashed var(--border);cursor:pointer" onclick="openContaModal()"><div style="text-align:center;color:var(--fab)"><div style="font-size:30px"><i class="fa-solid fa-plus"></i></div><div style="font-size:13px;font-weight:700;margin-top:4px">Nova conta</div></div></div>`;
  const transf=db.transacoes.filter(t=>t.tipo==='transferencia').sort((a,b)=>b.data.localeCompare(a.data)).slice(0,8);
  const el=document.getElementById('transfList');
  if(transf.length===0){ el.innerHTML='<div class="empty"><div class="em"><i class="fa-solid fa-arrows-rotate"></i></div>Nenhuma transferência.</div>'; }
  else{
    el.innerHTML=transf.map(t=>`<div class="list-item">
      <div class="cat-ico" style="background:var(--blue-bg)"><i class="fa-solid fa-arrows-rotate"></i></div>
      <div class="info"><div class="t">${esc(t.desc)}</div><div class="s">${fmtData(t.data)} · ${contaById(t.conta_id)?contaById(t.conta_id).nome:''} → ${contaById(t.conta_dest_id)?contaById(t.conta_dest_id).nome:''}</div></div>
      <span class="val-neu money">${fmt(t.valor)}</span>
    </div>`).join('');
  }
}
function tipoConta(t){ return {corrente:'Conta corrente',poupanca:'Poupança',carteira:'Carteira física',cartao:'Cartão de crédito'}[t]||t; }
function openContaModal(c){
  document.getElementById('modalContaTitle').textContent=c?'Editar conta':'Nova conta';
  document.getElementById('cNome').value=c?c.nome:'';
  document.getElementById('cTipo').value=c?c.tipo:'corrente';
  document.getElementById('cSaldo').value=c?c.saldo:0;
  document.getElementById('cLimite').value=c&&c.limite?c.limite:0;
  document.getElementById('cFecho').value=c&&c.diaFecho?c.diaFecho:5;
  document.getElementById('cVencto').value=c&&c.diaVencto?c.diaVencto:10;
  applyContaFields();
  document.getElementById('modalContaBg').classList.add('open');
}
function applyContaFields(){
  const t=document.getElementById('cTipo').value;
  const isCartao=t==='cartao';
  document.getElementById('rowCartaoLimite').classList.toggle('hidden',!isCartao);
  document.getElementById('rowCartaoFecho').classList.toggle('hidden',!isCartao);
  document.getElementById('rowCartaoVencto').classList.toggle('hidden',!isCartao);
}
document.getElementById('cTipo').addEventListener('change',applyContaFields);
function closeContaModal(){ document.getElementById('modalContaBg').classList.remove('open'); }
document.getElementById('modalContaBg').addEventListener('click',e=>{ if(e.target.id==='modalContaBg') closeContaModal(); });
function saveConta(){
  const nome=document.getElementById('cNome').value.trim();
  const tipo=document.getElementById('cTipo').value;
  const saldo=parseFloat(document.getElementById('cSaldo').value)||0;
  if(!nome){ toast('Informe o nome','error'); return; }
  const mapa={id:Date.now(),nome,tipo,saldo:arred(saldo),icon:tipo==='cartao'?'fa-solid fa-credit-card':tipo==='poupanca'?'fa-solid fa-piggy-bank':tipo==='carteira'?'fa-solid fa-wallet':'fa-solid fa-building-columns',cor:tipo==='cartao'?'#7c3aed':'#2563eb'};
  if(tipo==='cartao'){ mapa.limite=parseFloat(document.getElementById('cLimite').value)||0; mapa.diaFecho=parseInt(document.getElementById('cFecho').value)||5; mapa.diaVencto=parseInt(document.getElementById('cVencto').value)||10; }
  db.contas.push(mapa); saveDB(); closeContaModal(); toast('Conta adicionada'); renderContas(); renderCartoes();
}
function delConta(id){ if(!confirm('Excluir conta?'))return; db.contas=db.contas.filter(c=>c.id!==id); saveDB(); toast('Conta excluída','error'); renderContas(); renderCartoes(); }

/* ================= CARTÕES ================= */
function renderCartoes(){
  const cartoes=db.contas.filter(c=>c.tipo==='cartao');
  const grid=document.getElementById('cartoesGrid');
  if(cartoes.length===0){ grid.innerHTML='<div class="card"><div class="empty">Nenhum cartão cadastrado.</div></div>'; }
  else{
    grid.innerHTML=cartoes.map(c=>{
      const gasto=db.transacoes.filter(t=>t.cartao_id===c.id&&t.status==='pago').reduce((a,t)=>a+t.valor,0);
      const pct=c.limite>0?Math.min(100,(gasto/c.limite)*100):0;
      const cls=pct>=100?'over':pct>=80?'warn':'ok';
      return `<div class="card">
        <div class="mb"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px"><i class="${c.icon}"></i></span><h3>${esc(c.nome)}</h3></div><button class="btn-icon" onclick="delConta(${c.id})"><i class="fa-solid fa-trash"></i></button></div>
        <div class="val money" style="font-size:24px;font-weight:800">${fmt(arred(gasto))}</div>
        <div class="lbl" style="font-size:12px;color:var(--muted);margin-top:2px">Fatura utilizada de ${fmt(c.limite)}</div>
        <div class="progress ${cls}"><div style="width:${pct}%"></div></div>
        ${pct>=80?`<div class="budget-alert ${pct>=100?'over':'warn'}" style="margin-top:10px">${pct>=100?'<i class="fa-solid fa-triangle-exclamation"></i> Limite atingido!':'<i class="fa-solid fa-triangle-exclamation"></i> Cuidado, próximo do limite ('+pct.toFixed(0)+'%)'}</div>`:''}
        <div class="s" style="font-size:12px;color:var(--muted);margin-top:8px">Fechamento dia ${c.diaFecho} · Vencimento dia ${c.diaVencto}</div>
      </div>`;
    }).join('')+`<div class="card" style="display:grid;place-items:center;min-height:120px;border:2px dashed var(--border);cursor:pointer" onclick="openContaModal()"><div style="text-align:center;color:var(--fab)"><div style="font-size:30px"><i class="fa-solid fa-plus"></i></div><div style="font-size:13px;font-weight:700;margin-top:4px">Novo cartão</div></div></div>`;
  }
  const fat=document.getElementById('faturaList');
  const keys=[...new Set(db.transacoes.filter(t=>t.cartao_id&&t.status==='pago').map(t=>t.data.slice(0,7)))].sort().reverse().slice(0,6);
  if(keys.length===0){ fat.innerHTML='<div class="empty">Nenhuma fatura.</div>'; }
  else{
    fat.innerHTML=keys.map(k=>{
      const g=db.transacoes.filter(t=>t.cartao_id&&t.status==='pago'&&t.data.slice(0,7)===k).reduce((a,t)=>a+t.valor,0);
      return `<div class="list-item"><div class="cat-ico" style="background:var(--purple-bg)"><i class="fa-solid fa-credit-card"></i></div><div class="info"><div class="t">Fatura ${monthLabel(k)}</div><div class="s">${db.transacoes.filter(t=>t.cartao_id&&t.status==='pago'&&t.data.slice(0,7)===k).length} lançamentos</div></div><span class="val-neg money">${fmt(arred(g))}</span></div>`;
    }).join('');
  }
}

/* ================= ORÇAMENTO ================= */
function renderOrcamento(){
  const range=getMonthRange(db.config.diaInicio);
  const catOrc=db.orcamentos;
  const list=document.getElementById('orcamentoList');
  if(catOrc.length===0){ list.innerHTML='<div class="card"><div class="empty">Nenhum orçamento definido. Adicione abaixo.</div></div>'; }
  else{
    list.innerHTML=catOrc.map(o=>{
      const cat=catById(o.categoria_id);
      const gasto=sumDespesasPorCat(range,o.categoria_id);
      const pct=o.limite>0?(gasto/o.limite)*100:0;
      const cls=pct>=100?'over':pct>=80?'warn':'ok';
      const restante=arred(o.limite-gasto);
      return `<div class="card">
        <div class="mb"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">${catIconHtml(cat)}</span><h3 style="font-size:15px">${cat?cat.nome:'Categoria'}</h3></div>
        <button class="btn-icon" onclick="delOrcamento(${o.categoria_id})"><i class="fa-solid fa-trash"></i></button></div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span class="money">${fmt(gasto)}</span><span style="color:var(--muted)">de ${fmt(o.limite)}</span></div>
        <div class="progress ${cls}"><div style="width:${Math.min(100,pct)}%"></div></div>
        <div class="s" style="font-size:12px;margin-top:6px;${restante<0?'color:var(--red)':restante<=o.limite*0.2?'color:var(--amber)':'color:var(--muted)'}">${gasto>o.limite?'<i class="fa-solid fa-circle-exclamation"></i> Estourou o orçamento em '+fmt(Math.abs(restante)):'Restam '+fmt(restante)+' ('+pct.toFixed(0)+'% usado)'}</div>
      </div>`;
    }).join('');
  }
  list.innerHTML+='<div class="card"><div class="mb"><h3>Adicionar orçamento</h3></div><div class="form-row"><div class="g2"><div><select id="novaCatOrc">'+db.categorias.filter(c=>c.tipo==='despesa').map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')+'</select></div><div><input type="number" id="novaLimite" placeholder="Limite R$" step="0.01"></div></div></div><button class="btn primary" onclick="addOrcamento()"><i class="fa-solid fa-plus"></i> Adicionar</button></div>';
}
function addOrcamento(){
  const cat=parseInt(document.getElementById('novaCatOrc').value);
  const lim=parseFloat(document.getElementById('novaLimite').value);
  if(!lim||lim<=0){ toast('Informe o limite','error'); return; }
  if(db.orcamentos.find(o=>o.categoria_id===cat)){ db.orcamentos.find(o=>o.categoria_id===cat).limite=lim; toast('Orçamento atualizado'); }
  else db.orcamentos.push({categoria_id:cat,limite:lim});
  saveDB(); renderOrcamento(); toast('Orçamento salvo');
}
function delOrcamento(catId){ db.orcamentos=db.orcamentos.filter(o=>o.categoria_id!==catId); saveDB(); renderOrcamento(); toast('Orçamento removido','error'); }

/* ================= METAS ================= */
function renderMetas(){
  const grid=document.getElementById('metasGrid');
  if(db.metas.length===0){ grid.innerHTML='<div class="card"><div class="empty">Nenhuma meta. Crie sua primeira meta!</div></div>'; }
  else{
    grid.innerHTML=db.metas.map(m=>{
      const pct=m.alvo>0?(m.atual/m.alvo)*100:0;
      const cls=pct>=100?'ok':pct>=50?'warn':'over';
      const falta=m.alvo-m.atual;
      return `<div class="card">
        <div class="mb"><h3><i class="fa-solid fa-trophy"></i> ${esc(m.nome)}</h3><button class="btn-icon" onclick="delMeta(${m.id})"><i class="fa-solid fa-trash"></i></button></div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span class="money">${fmt(m.atual)}</span><span style="color:var(--muted)">de ${fmt(m.alvo)}</span></div>
        <div class="progress ${cls}"><div style="width:${Math.min(100,pct)}%"></div></div>
        <div class="s" style="font-size:12px;margin-top:6px;color:var(--muted)">${pct.toFixed(0)}% · ${m.dataLimite?'até '+fmtData(m.dataLimite):''} · falta ${fmt(falta)}</div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <input type="number" id="aporte_${m.id}" placeholder="Aporte R$" step="0.01" style="font-size:13px;padding:7px">
          <button class="btn primary sm" onclick="addAporte(${m.id})"><i class="fa-solid fa-piggy-bank"></i> Aportar</button>
        </div>
      </div>`;
    }).join('');
  }
  grid.innerHTML+='<button class="btn outline" onclick="openMetaModal()" style="margin-top:4px"><i class="fa-solid fa-plus"></i> Nova meta</button>';
}
function openMetaModal(){ document.getElementById('modalMetaTitle').textContent='Nova meta'; document.getElementById('mNome').value=''; document.getElementById('mAlvo').value=''; document.getElementById('mData').value=''; document.getElementById('mAporte').value='0'; document.getElementById('modalMetaBg').classList.add('open'); }
function closeMetaModal(){ document.getElementById('modalMetaBg').classList.remove('open'); }
document.getElementById('modalMetaBg').addEventListener('click',e=>{ if(e.target.id==='modalMetaBg') closeMetaModal(); });
function saveMeta(){
  const nome=document.getElementById('mNome').value.trim();
  const alvo=parseFloat(document.getElementById('mAlvo').value);
  const data=document.getElementById('mData').value;
  const aporte=parseFloat(document.getElementById('mAporte').value)||0;
  if(!nome||!alvo||alvo<=0){ toast('Preencha nome e valor alvo','error'); return; }
  db.metas.push({id:Date.now(),nome,alvo,atual:aporte,dataLimite:data||null});
  saveDB(); closeMetaModal(); renderMetas(); toast('Meta criada!');
}
function addAporte(id){ const m=db.metas.find(x=>x.id===id); const v=parseFloat(document.getElementById('aporte_'+id).value); if(!v||v<=0){ toast('Informe um valor','error'); return; } m.atual=arred(m.atual+v); if(m.atual>=m.alvo) toast('🎉 Meta atingida!'); else toast('Aporte registrado'); saveDB(); renderMetas(); }
function delMeta(id){ if(!confirm('Excluir meta?'))return; db.metas=db.metas.filter(m=>m.id!==id); saveDB(); renderMetas(); toast('Meta excluída','error'); }

/* ================= RELATÓRIOS ================= */
function relRange(periodo){
  const now=new Date();
  if(periodo==='mes'){ return getMonthRange(1); }
  if(periodo==='trimestre'){ const m=now.getMonth(); const qStart=new Date(now.getFullYear(),Math.floor(m/3)*3,1); const qEnd=new Date(now.getFullYear(),Math.floor(m/3)*3+3,1); return {startISO:qStart.toISOString().slice(0,10),endISO:qEnd.toISOString().slice(0,10)}; }
  if(periodo==='ano'){ return {startISO:now.getFullYear()+'-01-01',endISO:(now.getFullYear()+1)+'-01-01'}; }
  return {startISO:'0000-01-01',endISO:'9999-12-31'};
}
function renderRelatorios(){
  const catSel=document.getElementById('fRelCat');
  const contaSel=document.getElementById('fRelConta');
  catSel.innerHTML='<option value="">Todas categorias</option>'+db.categorias.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  contaSel.innerHTML='<option value="">Todas contas</option>'+db.contas.filter(c=>c.tipo!=='cartao').map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  const periodo=document.getElementById('fRelPeriodo').value;
  const cat=document.getElementById('fRelCat').value;
  const conta=document.getElementById('fRelConta').value;
  const range=relRange(periodo);
  let tx=db.transacoes.filter(t=>t.data>=range.startISO&&t.data<range.endISO);
  if(cat) tx=tx.filter(t=>t.categoria_id===parseInt(cat));
  if(conta) tx=tx.filter(t=>t.conta_id===parseInt(conta));
  const rec=tx.filter(t=>t.tipo==='receita'&&t.status==='pago').reduce((a,t)=>a+t.valor,0);
  const des=tx.filter(t=>t.tipo==='despesa'&&t.status==='pago').reduce((a,t)=>a+t.valor,0);
  document.getElementById('relRec').textContent=fmt(arred(rec));
  document.getElementById('relDes').textContent=fmt(arred(des));
  document.getElementById('relSal').textContent=fmt(arred(rec-des));
  const mesKeys=[...new Set(tx.map(t=>t.data.slice(0,7)))].sort();
  const recM=mesKeys.map(k=>arred(tx.filter(t=>t.data.slice(0,7)===k&&t.tipo==='receita'&&t.status==='pago').reduce((a,t)=>a+t.valor,0)));
  const desM=mesKeys.map(k=>arred(tx.filter(t=>t.data.slice(0,7)===k&&t.tipo==='despesa'&&t.status==='pago').reduce((a,t)=>a+t.valor,0)));
  const ctx=document.getElementById('chartCompare');
  if(charts['chartCompare']) charts['chartCompare'].destroy();
  charts['chartCompare']=new Chart(ctx,{type:'bar',data:{labels:mesKeys.map(monthLabel),datasets:[
    {label:'Receitas',data:recM,backgroundColor:'#16a34a',borderRadius:6},
    {label:'Despesas',data:desM,backgroundColor:'#dc2626',borderRadius:6}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmt(c.parsed.y)}},legend:{labels:{color:getComputedStyle(document.body).getPropertyValue('--muted')}}},scales:{x:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--muted')},grid:{display:false}},y:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--muted'),callback:v=>fmt(v)},grid:{color:getComputedStyle(document.body).getPropertyValue('--border')}}}}});
  const gastosCat={};
  tx.filter(t=>t.tipo==='despesa'&&t.status==='pago').forEach(t=>{ const cn=catName(t.categoria_id)||'Outros'; gastosCat[cn]=(gastosCat[cn]||0)+t.valor; });
  const gl=Object.keys(gastosCat), gv=Object.values(gastosCat).map(arred);
  const gc=gl.map(l=>{const c=db.categorias.find(x=>x.nome===l);return c?c.cor:'#94a3b8';});
  makeDoughnut('chartRelCat',gl,gv,gc);
}
function exportCSV(){
  let csv='Data;Descrição;Tipo;Valor;Categoria;Conta;Status\n';
  const separador=';';
  db.transacoes.forEach(t=>{
    const cat=catById(t.categoria_id);
    csv+=[t.data, '"'+(t.desc||'').replace(/"/g,'""')+'"', t.tipo, t.valor.toFixed(2).replace('.',','), cat?cat.nome:'', contaById(t.conta_id)?contaById(t.conta_id).nome:'', t.status].join(separador)+'\n';
  });
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='relatorio_transacoes.csv'; a.click();
  toast('CSV exportado');
}

/* ================= CONFIG ================= */
function renderConfig(){
  document.getElementById('cfgMoeda').value=db.config.moeda||'BRL';
  document.getElementById('cfgDiaInicio').value=db.config.diaInicio||1;
  document.getElementById('cfgTema').value=db.config.tema||'light';
  document.getElementById('cfgNotif').value=db.config.notif?'1':'0';
  const list=document.getElementById('catConfigList');
  list.innerHTML=db.categorias.map(c=>`<div class="list-item"><div class="cat-ico" style="background:${c.cor}22">${catIconHtml(c)}</div><div class="info"><div class="t">${esc(c.nome)}</div><div class="s">${c.subs.join(' · ')}</div></div><span class="chip ${c.tipo==='receita'?'green':'red'}">${c.tipo}</span></div>`).join('')+'<button class="btn outline sm" style="margin-top:12px" onclick="openCatModal()"><i class="fa-solid fa-plus"></i> Nova categoria</button>';
}
function saveConfig(){
  db.config.moeda=document.getElementById('cfgMoeda').value;
  db.config.diaInicio=parseInt(document.getElementById('cfgDiaInicio').value)||1;
  const tema=document.getElementById('cfgTema').value;
  db.config.tema=tema;
  db.config.notif=document.getElementById('cfgNotif').value==='1';
  document.body.dataset.theme=tema;
  document.getElementById('themeBtn').innerHTML=tema==='dark'?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';
  saveDB(); renderHome(); toast('Configurações salvas');
}
function openCatModal(){
  const nome=prompt('Nome da nova categoria:'); if(!nome)return;
  const tipo=prompt('Tipo (receita/despesa):')||'despesa';
  db.categorias.push({id:Date.now(),nome,tipo,cor:'#'+Math.floor(Math.random()*16777215).toString(16),icon:'fa-solid fa-box',subs:[]});
  saveDB(); renderConfig(); renderTransacoes(); toast('Categoria adicionada');
}
async function resetData(){
  if(!confirm('Apagar todos os dados e restaurar exemplo?'))return;
  try{ await fetch(`/api/data?usuario_id=${usuarioAtual.id}`, {method:'DELETE'}); }catch(e){}
  location.reload();
}
document.getElementById('themeBtn').addEventListener('click',()=>{
  const cur=document.body.dataset.theme;
  const next=cur==='dark'?'light':'dark';
  document.body.dataset.theme=next;
  db.config.tema=next; saveDB();
  document.getElementById('themeBtn').innerHTML=next==='dark'?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';
});

/* ================= INIT ================= */
async function start(){
  if(!verificarAutenticacao()) return; // redireciona para login.html se necessário
  db = await loadDB();
  init();
}
function init(){
  document.body.dataset.theme=db.config.tema||'light';
  document.getElementById('themeBtn').innerHTML=(db.config.tema||'light')==='dark'?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';
  document.getElementById('tPrefix').textContent=fmt(0).replace('0,00','').trim();
  document.getElementById('tData').value=today();
  renderHome();
  ['fTransBusca','fTransMes','fTransTipo','fTransCat'].forEach(id=>{ document.getElementById(id).addEventListener('input',renderTransacoes); document.getElementById(id).addEventListener('change',renderTransacoes); });
  ['fRelPeriodo','fRelCat','fRelConta'].forEach(id=>{ document.getElementById(id).addEventListener('change',renderRelatorios); });
  window.addEventListener('resize',()=>{ if(document.getElementById('page-home').classList.contains('active')) renderHome(); else if(document.getElementById('page-relatorios').classList.contains('active')) renderRelatorios(); });
}
start();
