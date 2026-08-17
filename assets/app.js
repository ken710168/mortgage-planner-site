const $=id=>document.getElementById(id);
const money=n=>'$'+Math.round(Number(n)||0).toLocaleString('zh-TW');
let combined=[];

function pmt(p,annual,months){if(p<=0||months<=0)return 0;const r=annual/100/12;if(Math.abs(r)<1e-12)return p/months;return p*r/(1-Math.pow(1+r,-months));}

function addRateRow(month='',rate=''){
  const d=document.createElement('div');d.className='row rateRow';
  d.innerHTML=`<label>第幾期起<input class="rateMonth" type="number" min="2" value="${month}"></label><label>新年利率（%）<input class="rateValue" type="number" step="0.001" value="${rate}"></label><button class="btn danger remove">刪除</button>`;
  d.querySelector('.remove').onclick=()=>{d.remove();calculate();};d.querySelectorAll('input').forEach(x=>x.oninput=calculate);$('rateRows').appendChild(d);
}

function addExtraLoan(def={}){
  const d=document.createElement('div');d.className='loanBox extraLoan';
  d.innerHTML=`<div class="loanHead"><input class="loanName" value="${def.name||'國土署自購住宅貸款'}" style="max-width:360px"><button class="btn danger removeLoan">刪除此貸款</button></div><div class="grid"><label>第幾期撥款<input class="startMonth" type="number" value="${def.start??1}"></label><label>貸款額度（元）<input class="loanPrincipal" type="number" value="${def.principal??2300000}"></label><label>年利率（%）<input class="loanRate" type="number" step="0.001" value="${def.rate??1.762}"></label><label>貸款年數<input class="loanYears" type="number" value="${def.years??20}"></label><label>額外月數<input class="loanMonths" type="number" min="0" max="11" value="${def.months??0}"></label><label>寬限期（月）<input class="loanGrace" type="number" value="${def.grace??60}"></label></div>`;
  d.querySelector('.removeLoan').onclick=()=>{d.remove();calculate();};d.querySelectorAll('input').forEach(x=>x.oninput=calculate);$('extraLoans').appendChild(d);
}

function getRateChanges(total){return [...document.querySelectorAll('.rateRow')].map(r=>({month:+r.querySelector('.rateMonth').value,rate:+r.querySelector('.rateValue').value})).filter(x=>x.month>=2&&x.month<=total&&Number.isFinite(x.rate)).sort((a,b)=>a.month-b.month);}
function getExtraLoans(){return [...document.querySelectorAll('.extraLoan')].map(r=>({name:r.querySelector('.loanName').value||'追加貸款',start:Math.max(1,+r.querySelector('.startMonth').value||1),principal:+r.querySelector('.loanPrincipal').value||0,rate:+r.querySelector('.loanRate').value||0,months:(+r.querySelector('.loanYears').value||0)*12+(+r.querySelector('.loanMonths').value||0),grace:Math.max(0,+r.querySelector('.loanGrace').value||0)})).filter(x=>x.principal>0&&x.months>0);}

function mainSchedule(principal,total,currentRate,changes,grace,horizon){let rows=[],bal=principal,rate=currentRate,totalInt=0,changeMap=new Map(changes.map(x=>[x.month,x.rate]));for(let m=1;m<=horizon;m++){if(m>total||bal<=.005){rows.push({pay:0,interest:0,balance:0});continue;}if(changeMap.has(m))rate=changeMap.get(m);const interest=bal*rate/100/12;let pay,pp;if(m<=grace){pay=interest;pp=0;}else{const rem=total-m+1;pay=pmt(bal,rate,rem);pp=Math.max(0,pay-interest);if(pp>bal){pp=bal;pay=bal+interest;}}bal-=pp;totalInt+=interest;rows.push({pay,interest,balance:Math.max(0,bal)});}return {rows,totalInt};}
function extraSchedule(loan,horizon){const rows=Array.from({length:horizon},()=>({pay:0,interest:0,balance:0}));let bal=loan.principal,totalInt=0;for(let local=1;local<=loan.months;local++){const global=loan.start+local-1;if(global>horizon||bal<=.005)break;const interest=bal*loan.rate/100/12;let pay,pp;if(local<=loan.grace){pay=interest;pp=0;}else{const rem=loan.months-local+1;pay=pmt(bal,loan.rate,rem);pp=Math.max(0,pay-interest);if(pp>bal){pp=bal;pay=bal+interest;}}bal-=pp;totalInt+=interest;rows[global-1]={pay,interest,balance:Math.max(0,bal)};}return {rows,totalInt};}

function calculate(){
  const principal=+$('principal').value||0,total=(+$('years').value||0)*12+(+$('months').value||0),rate=+$('currentRate').value||0,grace=Math.max(0,+$('mainGrace').value||0);if(principal<=0||total<=0)return;
  const extra=getExtraLoans(),maxExtra=extra.reduce((m,l)=>Math.max(m,l.start+l.months-1),0),horizon=Math.max(total,maxExtra),changes=getRateChanges(total),main=mainSchedule(principal,total,rate,changes,grace,horizon),extras=extra.map(l=>({loan:l,...extraSchedule(l,horizon)}));
  combined=[];let peak=0;for(let i=0;i<horizon;i++){const mr=main.rows[i]||{pay:0,interest:0,balance:0};let ep=0,ei=0,eb=0;extras.forEach(e=>{const r=e.rows[i];ep+=r.pay;ei+=r.interest;eb+=r.balance;});const tp=mr.pay+ep;peak=Math.max(peak,tp);combined.push({m:i+1,main:mr.pay,extra:ep,total:tp,interest:mr.interest+ei,balance:mr.balance+eb});}
  const extraInterest=extras.reduce((s,e)=>s+e.totalInt,0),borrowed=principal+extra.reduce((s,l)=>s+l.principal,0);
  $('mCurrent').textContent=money(combined[0]?.total||0);$('mPeak').textContent=money(peak);$('mInterest').textContent=money(main.totalInt+extraInterest);$('mBorrowed').textContent=money(borrowed);$('mBalance').textContent=money(combined[0]?.balance||0);
  const actual=+$('actualPayment').value||0;if(actual>0){$('compare').style.display='block';$('compare').textContent=`銀行本期實際需繳 ${money(actual)}；與模型理論值相差 ${money(actual-(combined[0]?.total||0))}。`;}else $('compare').style.display='none';
  const events=[{month:1,text:'主要房貸目前狀態'},...changes.map(x=>({month:x.month,text:`主要房貸利率調整為 ${x.rate.toFixed(3)}%`})),...extra.map(l=>({month:l.start,text:`${l.name} 撥款 ${money(l.principal)}`}))].sort((a,b)=>a.month-b.month);
  $('eventBody').innerHTML=events.map(e=>{const r=combined[e.month-1]||{};return `<tr><td>${e.month}</td><td>${e.text}</td><td>${money(r.main)}</td><td>${money(r.extra)}</td><td>${money(r.total)}</td></tr>`}).join('');
  $('detailBody').innerHTML=combined.map(r=>`<tr><td>${r.m}</td><td>${money(r.main)}</td><td>${money(r.extra)}</td><td>${money(r.total)}</td><td>${money(r.interest)}</td><td>${money(r.balance)}</td></tr>`).join('');
}

function exportCSV(){if(!combined.length)return;const rows=[['期數','主要房貸','追加貸款','合計月付','本期利息','總剩餘本金'],...combined.map(r=>[r.m,r.main.toFixed(2),r.extra.toFixed(2),r.total.toFixed(2),r.interest.toFixed(2),r.balance.toFixed(2)])];const csv='\uFEFF'+rows.map(r=>r.join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='房貸每期明細.csv';a.click();URL.revokeObjectURL(url);}
function defaults(){['rateRows','extraLoans'].forEach(id=>$(id).innerHTML='');$('principal').value=6500000;$('currentRate').value=1.775;$('mainGrace').value=60;$('years').value=40;$('months').value=0;$('actualPayment').value='';addRateRow(37,1.900);addRateRow(49,2.025);addRateRow(61,2.150);addRateRow(73,2.275);addExtraLoan({name:'國土署自購住宅貸款',start:1,principal:2300000,rate:1.762,years:20,months:0,grace:60});calculate();}

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active');if(b.dataset.tab==='result')calculate();});
['principal','currentRate','mainGrace','years','months','actualPayment'].forEach(id=>$(id).oninput=calculate);$('addRate').onclick=()=>addRateRow();$('addExtra').onclick=()=>addExtraLoan();$('calcBtn').onclick=calculate;$('resetBtn').onclick=defaults;$('csvBtn').onclick=exportCSV;defaults();

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'inline-block';
});
const installBtn = document.getElementById('installBtn');
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.style.display = 'none';
  });
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
