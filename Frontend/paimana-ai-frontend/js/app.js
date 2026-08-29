const projects = [
  {id:1427,name:"National Highway Project",state:"Uttar Pradesh",sector:"Transport",original:500,current:560,physical:52,financial:48,risk:87,costRisk:72,delayRisk:91,level:"High"},
  {id:1098,name:"Urban Infrastructure Project",state:"Maharashtra",sector:"Urban Development",original:300,current:315,physical:72,financial:70,risk:56,costRisk:41,delayRisk:63,level:"Medium"},
  {id:1842,name:"Irrigation Development Project",state:"Rajasthan",sector:"Water Resources",original:400,current:470,physical:35,financial:30,risk:79,costRisk:78,delayRisk:77,level:"High"},
  {id:1621,name:"Regional Power Transmission",state:"Gujarat",sector:"Energy",original:620,current:644,physical:69,financial:66,risk:64,costRisk:51,delayRisk:71,level:"Medium"},
  {id:1184,name:"National Logistics Corridor",state:"Madhya Pradesh",sector:"Transport",original:850,current:858,physical:81,financial:80,risk:39,costRisk:22,delayRisk:48,level:"Low"},
  {id:1931,name:"Drinking Water Mission",state:"Rajasthan",sector:"Water Resources",original:270,current:279,physical:61,financial:63,risk:34,costRisk:28,delayRisk:39,level:"Low"}
];

const pageNames={dashboard:"Dashboard",projects:"Projects",risk:"Risk Analytics",warnings:"Early Warnings",assistant:"AI Assistant",reports:"Reports"};
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

function riskBadge(level,score){
  const cls=level.toLowerCase();
  return `<span class="risk-badge ${cls}"><span>●</span>${score} · ${level}</span>`;
}
function renderRiskTable(list=projects.slice().sort((a,b)=>b.risk-a.risk).slice(0,5)){
  $("#riskTable").innerHTML=list.map(p=>`<tr>
    <td><div class="project-cell">${p.name}<small>ID ${p.id}</small></div></td>
    <td>${p.sector}</td><td>${p.state}</td>
    <td>${riskBadge(p.level,p.risk)}</td>
    <td><span class="risk-number">${p.costRisk}%</span></td>
    <td><span class="risk-number">${p.delayRisk}%</span></td>
    <td><span class="risk-badge ${p.level.toLowerCase()}">${p.level}</span></td>
  </tr>`).join("");
}
function renderProjectTable(list=projects){
  $("#projectTable").innerHTML=list.map(p=>`<tr>
    <td><div class="project-cell">${p.name}<small>Project ID ${p.id}</small></div></td>
    <td>${p.state}</td><td>${p.sector}</td><td>₹${p.original} Cr</td><td>₹${p.current} Cr</td>
    <td>${p.physical}%</td><td>${p.financial}%</td><td>${riskBadge(p.level,p.risk)}</td>
  </tr>`).join("");
}
function showPage(name){
  $$(".page").forEach(p=>p.classList.remove("active"));
  $(`#page-${name}`).classList.add("active");
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  $("#pageCrumb").textContent=pageNames[name];
  window.scrollTo({top:0,behavior:"smooth"});
  $("#sidebar").classList.remove("open");
}
function toast(msg){
  const t=$("#toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2200);
}
function filteredDashboard(){
  const sector=$("#sectorFilter").value,risk=$("#riskFilter").value,state=$("#stateFilter").value;
  let list=projects.filter(p=>(sector==="all"||p.sector===sector)&&(risk==="all"||p.level===risk)&&(state==="all"||p.state===state));
  renderRiskTable(list);
  $("#totalProjects").textContent=sector==="all"&&risk==="all"&&state==="all"?"1,981":list.length.toLocaleString();
  $("#highRisk").textContent=sector==="all"&&risk==="all"&&state==="all"?"247":list.filter(p=>p.level==="High").length;
  $("#delayRisk").textContent=sector==="all"&&risk==="all"&&state==="all"?"318":list.filter(p=>p.delayRisk>=60).length;
}
function filterProjects(){
  const q=$("#projectSearch").value.toLowerCase(),r=$("#projectRisk").value,s=$("#projectSector").value;
  renderProjectTable(projects.filter(p=>
    (!q||`${p.name} ${p.state} ${p.sector}`.toLowerCase().includes(q)) &&
    (r==="all"||p.level===r)&&(s==="all"||p.sector===s)
  ));
}
function addMessage(text,user=false){
  const box=$("#messages"),wrap=document.createElement("div");
  wrap.className=`message ${user?"user": "bot"}`;
  wrap.innerHTML=user?`<div><p>${text}</p><time>Just now</time></div>`:`<div class="bot-avatar">✦</div><div><p>${text}</p><time>Just now</time></div>`;
  box.appendChild(wrap);box.scrollTop=box.scrollHeight;
}
function localAI(q){
  const x=q.toLowerCase();
  if(x.includes("high-risk")&&x.includes("transport")){
    const ps=projects.filter(p=>p.sector==="Transport"&&p.level==="High");
    return `There is <b>${ps.length}</b> high-risk transport project in the current demo dataset: <b>${ps[0]?.name||"none"}</b>. Its overall predicted risk is <b>${ps[0]?.risk||0}%</b>, with delay risk at <b>${ps[0]?.delayRisk||0}%</b>.`;
  }
  if(x.includes("why")&&x.includes("high risk")||x.includes("why")&&x.includes("national highway")){
    return `<b>National Highway Project</b> is classified as high risk in this prototype (87/100). The strongest signals are delay risk (91%), cost risk (72%), and the gap between physical and financial progress. In a production system, these explanations should be generated from the trained model's feature-attribution outputs.`;
  }
  if(x.includes("main")&&x.includes("risk")){
    return `The current portfolio view shows the strongest risk concentration in <b>Transport</b>. Key signals include schedule/milestone slippage, physical-progress deviation, cost escalation and expenditure-pattern changes.`;
  }
  if(x.includes("cost")) return `The prototype currently highlights <b>Irrigation Development Project</b> as the strongest cost-risk example, with a 78% cost-risk score and current cost of ₹470 Cr versus ₹400 Cr original cost.`;
  return `I can analyze project-level risk, cost escalation, delay indicators and portfolio trends. Try asking about <b>National Highway Project</b>, high-risk transport projects, or the main portfolio risks.`;
}
function setup(){
  renderRiskTable();renderProjectTable();
  $$(".nav-item").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
  $$("[data-page-link]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.pageLink)));
  $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#resetFilters").addEventListener("click",()=>{$("#sectorFilter").value="all";$("#riskFilter").value="all";$("#stateFilter").value="all";filteredDashboard()});
  ["sectorFilter","riskFilter","stateFilter"].forEach(id=>$("#"+id).addEventListener("change",filteredDashboard));
  $("#projectSearch").addEventListener("input",filterProjects);$("#projectRisk").addEventListener("change",filterProjects);$("#projectSector").addEventListener("change",filterProjects);
  $("#refreshBtn").addEventListener("click",()=>{toast("Portfolio view refreshed");});
  $("#exportBtn").addEventListener("click",()=>toast("Snapshot export prepared (prototype)"));
  $("#notifyBtn").addEventListener("click",()=>showPage("warnings"));
  $("#reportBtn").addEventListener("click",()=>toast("Report generation started (prototype)"));
  $$(".suggestions button").forEach(b=>b.addEventListener("click",()=>{ $("#chatInput").value=b.dataset.prompt; $("#chatForm").requestSubmit(); }));
  $("#chatForm").addEventListener("submit",e=>{e.preventDefault();const input=$("#chatInput"),q=input.value.trim();if(!q)return;addMessage(q,true);input.value="";setTimeout(()=>addMessage(localAI(q)),350)});
}
setup();
