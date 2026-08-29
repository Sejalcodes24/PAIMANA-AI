// =====================================================
// PAIMANA AI - FRONTEND
// Connected with FastAPI Backend
// =====================================================

const API_BASE = "http://127.0.0.1:8000";

let projects = [];
let dashboardData = null;
let sectorRiskData = [];
let stateRiskData = [];


// =====================================================
// BASIC HELPERS
// =====================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const pageNames = {
  dashboard: "Dashboard",
  projects: "Projects",
  risk: "Risk Analytics",
  warnings: "Early Warnings",
  assistant: "AI Assistant",
  reports: "Reports"
};


// =====================================================
// API FUNCTIONS
// =====================================================

// Get all projects
async function fetchProjects() {
  const response = await fetch(`${API_BASE}/projects`);

  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }

  return await response.json();
}


// Get risk information for one project
async function fetchProjectRisk(projectId) {
  const response = await fetch(
    `${API_BASE}/projects/${projectId}/risk`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch risk for project ${projectId}`);
  }

  return await response.json();
}


// Get dashboard overview
async function fetchDashboardOverview() {
  const response = await fetch(
    `${API_BASE}/dashboard/overview`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard overview");
  }

  return await response.json();
}


// Get risk by sector
async function fetchSectorRisk() {
  const response = await fetch(
    `${API_BASE}/dashboard/sector-risk`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch sector risk");
  }

  return await response.json();
}


// Get risk by state
async function fetchStateRisk() {
  const response = await fetch(
    `${API_BASE}/dashboard/state-risk`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch state risk");
  }

  return await response.json();
}


// =====================================================
// LOAD ALL BACKEND DATA
// =====================================================

async function loadBackendData() {

  try {

    // Fetch projects
    const rawProjects = await fetchProjects();

    // Fetch risk for every project
    const riskData = await Promise.all(
      rawProjects.map(project =>
        fetchProjectRisk(project.project_id)
      )
    );


    // Combine project data + risk data
    projects = rawProjects.map((project, index) => {

      const risk = riskData[index];

      let level = "Low";

      if (risk.risk_level === "HIGH") {
        level = "High";
      }
      else if (risk.risk_level === "MEDIUM") {
        level = "Medium";
      }

      return {

        id: project.project_id,

        name: project.project_name,

        state: project.state,

        sector: project.sector,

        original: project.original_cost,

        current: project.current_cost,

        physical: project.physical_progress,

        financial: project.financial_progress,

        costRisk: risk.cost_risk,

        delayRisk: risk.delay_risk,

        risk: risk.overall_risk,

        level: level,

        reasons: risk.reasons || [],

        recommendations:
          risk.recommended_actions || []

      };

    });


    // Other dashboard APIs
    dashboardData = await fetchDashboardOverview();

    sectorRiskData = await fetchSectorRisk();

    stateRiskData = await fetchStateRisk();


    // Render everything
    renderAll();


    // Update timestamp
    if ($("#dataDate")) {
      $("#dataDate").textContent = "Live";
    }


  } catch (error) {

    console.error("Backend connection error:", error);

    toast(
      "Unable to connect to PAIMANA backend"
    );

  }

}


// =====================================================
// RISK BADGE
// =====================================================

function riskBadge(level, score) {

  const cls = level.toLowerCase();

  return `
    <span class="risk-badge ${cls}">
      <span>●</span>
      ${score} · ${level}
    </span>
  `;

}


// =====================================================
// PROJECT TABLE
// =====================================================

function renderProjectTable(list = projects) {

  const table = $("#projectTable");

  if (!table) return;


  if (list.length === 0) {

    table.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;">
          No projects found
        </td>
      </tr>
    `;

    return;

  }


  table.innerHTML = list.map(project => `

    <tr>

      <td>

        <div class="project-cell">

          ${project.name}

          <small>
            Project ID ${project.id}
          </small>

        </div>

      </td>

      <td>
        ${project.state}
      </td>

      <td>
        ${project.sector}
      </td>

      <td>
        ₹${project.original} Cr
      </td>

      <td>
        ₹${project.current} Cr
      </td>

      <td>
        ${project.physical}%
      </td>

      <td>
        ${project.financial}%
      </td>

      <td>
        ${riskBadge(project.level, project.risk)}
      </td>

    </tr>

  `).join("");

}


// =====================================================
// RISK TABLE
// =====================================================

function renderRiskTable(
  list = projects
    .slice()
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 5)
) {

  const table = $("#riskTable");

  if (!table) return;


  if (list.length === 0) {

    table.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;">
          No projects found
        </td>
      </tr>
    `;

    return;

  }


  table.innerHTML = list.map(project => `

    <tr>

      <td>

        <div class="project-cell">

          ${project.name}

          <small>
            ID ${project.id}
          </small>

        </div>

      </td>

      <td>
        ${project.sector}
      </td>

      <td>
        ${project.state}
      </td>

      <td>
        ${riskBadge(project.level, project.risk)}
      </td>

      <td>
        <span class="risk-number">
          ${project.costRisk}%
        </span>
      </td>

      <td>
        <span class="risk-number">
          ${project.delayRisk}%
        </span>
      </td>

      <td>
        <span class="risk-badge ${project.level.toLowerCase()}">
          ${project.level}
        </span>
      </td>

    </tr>

  `).join("");

}


// =====================================================
// DASHBOARD KPI
// =====================================================

function renderDashboardKPIs() {

  if (!dashboardData) return;


  $("#totalProjects").textContent =
    dashboardData.total_projects;


  $("#highRisk").textContent =
    dashboardData.high_risk_projects;


  $("#delayRisk").textContent =
    dashboardData.delay_risk_projects;


  // Total current cost
  const totalCurrentCost = projects.reduce(
    (sum, project) =>
      sum + Number(project.current),
    0
  );


  $("#costExposure").textContent =
    `₹${totalCurrentCost.toLocaleString("en-IN")} Cr`;

}


// =====================================================
// RISK DISTRIBUTION
// =====================================================

function renderRiskDistribution(list = projects) {

  const total = list.length;

  if (!total) return;


  const high = list.filter(
    p => p.level === "High"
  ).length;


  const medium = list.filter(
    p => p.level === "Medium"
  ).length;


  const low = list.filter(
    p => p.level === "Low"
  ).length;


  const highPercent =
    Math.round((high / total) * 100);


  const mediumPercent =
    Math.round((medium / total) * 100);


  const lowPercent =
    Math.round((low / total) * 100);


  // Text values

  $("#riskTotal").textContent = total;

  $("#highRiskCount").textContent = high;
  $("#mediumRiskCount").textContent = medium;
  $("#lowRiskCount").textContent = low;

  $("#highRiskPercent").textContent =
    `${highPercent}%`;

  $("#mediumRiskPercent").textContent =
    `${mediumPercent}%`;

  $("#lowRiskPercent").textContent =
    `${lowPercent}%`;


  // Donut chart

  const donut = $("#riskDonut");

  if (donut) {

    donut.style.background =
      `conic-gradient(
        #e5484d 0% ${highPercent}%,
        #e9a72c ${highPercent}% ${highPercent + mediumPercent}%,
        #55b889 ${highPercent + mediumPercent}% 100%
      )`;

  }

}


// =====================================================
// RISK BY SECTOR
// =====================================================

function renderSectorBars(metric = "risk") {

  const container = $("#sectorBars");

  if (!container) return;


  if (sectorRiskData.length === 0) {

    container.innerHTML =
      "<p>No sector data available.</p>";

    return;

  }


  container.innerHTML = sectorRiskData.map(item => {

    let score = item.average_risk;


    if (metric === "risk") {

      score = item.average_risk;

    }

    else if (metric === "delay") {

      const sectorProjects =
        projects.filter(
          p => p.sector === item.sector
        );

      if (sectorProjects.length) {

        score = Math.round(
          sectorProjects.reduce(
            (sum, p) => sum + p.delayRisk,
            0
          ) / sectorProjects.length
        );

      }

    }

    else if (metric === "cost") {

      const sectorProjects =
        projects.filter(
          p => p.sector === item.sector
        );

      if (sectorProjects.length) {

        score = Math.round(
          sectorProjects.reduce(
            (sum, p) => sum + p.costRisk,
            0
          ) / sectorProjects.length
        );

      }

    }


    return `

      <div class="bar-row">

        <div class="bar-label">
          ${item.sector}
        </div>

        <div class="bar-track">

          <i
            style="width:${Math.min(score, 100)}%"
          ></i>

        </div>

        <strong>
          ${score}
        </strong>

      </div>

    `;

  }).join("");

}


// =====================================================
// EARLY WARNINGS
// =====================================================

function renderWarnings() {

  const container = $("#warningGrid");

  if (!container) return;


  const warningProjects = projects
    .filter(project =>
      project.level === "High" ||
      project.costRisk >= 70 ||
      project.delayRisk >= 70 ||
      project.physical < 50
    )
    .sort(
      (a, b) => b.risk - a.risk
    );


  if (warningProjects.length === 0) {

    container.innerHTML = `

      <div class="panel">

        <h3>
          No major warnings
        </h3>

        <p>
          No high-priority risk indicators
          detected in the current project data.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =
    warningProjects.map(project => {

      const reason =
        project.reasons.length > 0
          ? project.reasons[0]
          : "Risk indicators detected.";

      return `

        <article class="panel warning-card">

          <div class="warning-top">

            <span class="risk-badge ${project.level.toLowerCase()}">
              ${project.level}
            </span>

            <strong>
              Risk ${project.risk}
            </strong>

          </div>

          <h3>
            ${project.name}
          </h3>

          <p>
            ${reason}
          </p>

          <small>
            ${project.state} · ${project.sector}
          </small>

        </article>

      `;

    }).join("");

}


// =====================================================
// DASHBOARD WARNINGS
// =====================================================

function renderDashboardWarnings() {

  const container =
    $("#dashboardWarnings");

  if (!container) return;


  const warnings = projects
    .filter(project =>
      project.level === "High" ||
      project.costRisk >= 70 ||
      project.delayRisk >= 70 ||
      project.physical < 50
    )
    .sort(
      (a, b) => b.risk - a.risk
    )
    .slice(0, 3);


  if (warnings.length === 0) {

    container.innerHTML = `
      <div class="alert-item">
        <strong>No critical warnings</strong>
        <small>
          Current project data has no high-priority alerts.
        </small>
      </div>
    `;

    return;

  }


  container.innerHTML =
    warnings.map(project => `

      <div class="alert-item">

        <strong>
          ${project.name}
        </strong>

        <small>
          Risk ${project.risk} ·
          Cost ${project.costRisk} ·
          Delay ${project.delayRisk}
        </small>

      </div>

    `).join("");

}


// =====================================================
// PORTFOLIO INSIGHT
// =====================================================

function renderPortfolioInsight() {

  const element =
    $("#portfolioInsight");

  if (!element) return;


  if (projects.length === 0) {

    element.textContent =
      "No project data available.";

    return;

  }


  const highestRisk =
    projects
      .slice()
      .sort((a, b) => b.risk - a.risk)[0];


  const highRiskCount =
    projects.filter(
      p => p.level === "High"
    ).length;


  const avgRisk = Math.round(
    projects.reduce(
      (sum, p) => sum + p.risk,
      0
    ) / projects.length
  );


  element.innerHTML = `

    The current portfolio contains
    <b>${projects.length}</b> monitored projects
    with an average risk score of
    <b>${avgRisk}/100</b>.
    The highest current risk signal is associated
    with <b>${highestRisk.name}</b>
    with a backend-calculated risk score of
    <b>${highestRisk.risk}/100</b>.
    There are currently
    <b>${highRiskCount}</b> high-risk projects
    requiring immediate attention.

  `;

}


// =====================================================
// RISK ANALYTICS PAGE
// =====================================================

function renderRiskAnalytics() {

  if (projects.length === 0) return;


  const avgRisk = Math.round(
    projects.reduce(
      (sum, p) => sum + p.risk,
      0
    ) / projects.length
  );


  const avgCostRisk = Math.round(
    projects.reduce(
      (sum, p) => sum + p.costRisk,
      0
    ) / projects.length
  );


  const avgDelayRisk = Math.round(
    projects.reduce(
      (sum, p) => sum + p.delayRisk,
      0
    ) / projects.length
  );


  $("#avgPortfolioRisk").textContent =
    avgRisk;


  $("#avgCostRisk").textContent =
    avgCostRisk;


  $("#avgDelayRisk").textContent =
    avgDelayRisk;


  // Overall factors

  const maxCostRisk =
    Math.max(...projects.map(p => p.costRisk));


  const maxProgressGap =
    Math.max(
      ...projects.map(
        p => Math.abs(
          p.physical - p.financial
        )
      )
    );


  $("#factorCost").textContent =
    `${maxCostRisk}%`;

  $("#factorCostBar").style.width =
    `${Math.min(maxCostRisk, 100)}%`;


  $("#factorProgress").textContent =
    `${maxProgressGap}%`;

  $("#factorProgressBar").style.width =
    `${Math.min(maxProgressGap * 5, 100)}%`;


  // Project risk summary

  const summary =
    $("#riskSummary");

  if (!summary) return;


  summary.innerHTML =
    projects
      .slice()
      .sort((a, b) => b.risk - a.risk)
      .map(project => `

        <div class="alert-item">

          <strong>
            ${project.name}
          </strong>

          <small>
            Overall: ${project.risk}
            · Cost: ${project.costRisk}
            · Delay: ${project.delayRisk}
          </small>

        </div>

      `).join("");

}


// =====================================================
// FILTER DASHBOARD
// =====================================================

function filteredDashboard() {

  const sector =
    $("#sectorFilter")?.value || "all";

  const risk =
    $("#riskFilter")?.value || "all";

  const state =
    $("#stateFilter")?.value || "all";


  const list = projects.filter(project =>

    (sector === "all" ||
      project.sector === sector)

    &&

    (risk === "all" ||
      project.level === risk)

    &&

    (state === "all" ||
      project.state === state)

  );


  renderRiskTable(list);

  renderRiskDistribution(list);


  $("#totalProjects").textContent =
    list.length;


  $("#highRisk").textContent =
    list.filter(
      p => p.level === "High"
    ).length;


  $("#delayRisk").textContent =
    list.filter(
      p => p.delayRisk >= 70
    ).length;


  const currentCost =
    list.reduce(
      (sum, p) => sum + Number(p.current),
      0
    );


  $("#costExposure").textContent =
    `₹${currentCost.toLocaleString("en-IN")} Cr`;

}


// =====================================================
// PROJECT FILTER
// =====================================================

function filterProjects() {

  const search =
    $("#projectSearch")?.value
      .toLowerCase()
      .trim() || "";


  const risk =
    $("#projectRisk")?.value || "all";


  const sector =
    $("#projectSector")?.value || "all";


  const filtered =
    projects.filter(project => {

      const searchMatch =
        !search ||

        `${project.name}
          ${project.state}
          ${project.sector}
          ${project.id}`
          .toLowerCase()
          .includes(search);


      const riskMatch =
        risk === "all" ||
        project.level === risk;


      const sectorMatch =
        sector === "all" ||
        project.sector === sector;


      return (
        searchMatch &&
        riskMatch &&
        sectorMatch
      );

    });


  renderProjectTable(filtered);

}


// =====================================================
// NAVIGATION
// =====================================================

function showPage(name) {

  $$(".page").forEach(page => {

    page.classList.remove("active");

  });


  const target =
    $(`#page-${name}`);


  if (target) {

    target.classList.add("active");

  }


  $$(".nav-item").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === name
    );

  });


  if ($("#pageCrumb")) {

    $("#pageCrumb").textContent =
      pageNames[name] || name;

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  $("#sidebar")?.classList.remove("open");

}


// =====================================================
// TOAST
// =====================================================

function toast(message) {

  const element =
    $("#toast");

  if (!element) return;


  element.textContent =
    message;


  element.classList.add("show");


  clearTimeout(
    window.__toast
  );


  window.__toast =
    setTimeout(() => {

      element.classList.remove("show");

    }, 2200);

}


// =====================================================
// AI ASSISTANT
// =====================================================

function addMessage(
  text,
  user = false
) {

  const box =
    $("#messages");

  if (!box) return;


  const wrap =
    document.createElement("div");


  wrap.className =
    `message ${user ? "user" : "bot"}`;


  wrap.innerHTML = user

    ? `
      <div>
        <p>${text}</p>
        <time>Just now</time>
      </div>
    `

    : `
      <div class="bot-avatar">
        ✦
      </div>

      <div>
        <p>${text}</p>
        <time>Just now</time>
      </div>
    `;


  box.appendChild(wrap);


  box.scrollTop =
    box.scrollHeight;

}


// =====================================================
// LOCAL AI USING BACKEND DATA
// =====================================================

function localAI(question) {

  const q =
    question.toLowerCase();


  // Highest risk
  if (
    q.includes("highest risk") ||
    q.includes("highest-risk")
  ) {

    const highest =
      projects
        .slice()
        .sort(
          (a, b) => b.risk - a.risk
        )[0];


    if (!highest) {

      return "No project data is currently available.";

    }


    return `

      The highest-risk project in the
      current backend dataset is
      <b>${highest.name}</b> with an overall
      risk score of <b>${highest.risk}/100</b>.
      Cost risk is <b>${highest.costRisk}%</b>
      and delay risk is
      <b>${highest.delayRisk}%</b>.

    `;

  }


  // High risk transport
  if (
    q.includes("transport") &&
    q.includes("risk")
  ) {

    const transport =
      projects.filter(
        p => p.sector === "Transport"
      );


    if (transport.length === 0) {

      return "There are no Transport projects in the current dataset.";

    }


    return transport.map(p => `

      <b>${p.name}</b>
      — Overall risk ${p.risk}/100,
      Cost risk ${p.costRisk}%,
      Delay risk ${p.delayRisk}%.

    `).join("<br><br>");

  }


  // Cost
  if (q.includes("cost")) {

    const highestCost =
      projects
        .slice()
        .sort(
          (a, b) =>
            b.costRisk - a.costRisk
        )[0];


    return `

      The project with the highest
      backend-calculated cost risk is
      <b>${highestCost.name}</b>
      with a cost risk score of
      <b>${highestCost.costRisk}%</b>.
      Its original cost was
      ₹${highestCost.original} Cr and
      current cost is
      ₹${highestCost.current} Cr.

    `;

  }


  // Delay
  if (q.includes("delay")) {

    const highestDelay =
      projects
        .slice()
        .sort(
          (a, b) =>
            b.delayRisk - a.delayRisk
        )[0];


    return `

      The project with the highest
      delay-risk score is
      <b>${highestDelay.name}</b>
      with a delay risk of
      <b>${highestDelay.delayRisk}%</b>.

    `;

  }


  // Main portfolio risks
  if (
    q.includes("main") &&
    q.includes("risk")
  ) {

    const avgRisk =
      Math.round(
        projects.reduce(
          (sum, p) => sum + p.risk,
          0
        ) / projects.length
      );


    return `

      The current portfolio has
      <b>${projects.length}</b> monitored projects.
      The average backend-calculated risk
      score is <b>${avgRisk}/100</b>.
      The main indicators are cost escalation,
      delay risk and the gap between
      physical and financial progress.

    `;

  }


  // Specific project
  const project =
    projects.find(p =>
      q.includes(
        p.name.toLowerCase()
      )
    );


  if (project) {

    return `

      <b>${project.name}</b><br><br>

      State: <b>${project.state}</b><br>
      Sector: <b>${project.sector}</b><br>
      Overall risk: <b>${project.risk}/100</b><br>
      Cost risk: <b>${project.costRisk}%</b><br>
      Delay risk: <b>${project.delayRisk}%</b><br>
      Physical progress: <b>${project.physical}%</b><br>
      Financial progress: <b>${project.financial}%</b>

    `;

  }


  return `

    I can analyze the projects currently
    loaded from the PAIMANA backend.

    Try asking about:
    <br><br>

    • Highest risk projects<br>
    • Cost risk<br>
    • Delay risk<br>
    • Transport projects<br>
    • A specific project

  `;

}


// =====================================================
// REFRESH DATA
// =====================================================

async function refreshData() {

  toast("Refreshing backend data...");

  await loadBackendData();

  toast("Backend data refreshed");

}


// =====================================================
// RESET FILTERS
// =====================================================

function resetFilters() {

  if ($("#sectorFilter"))
    $("#sectorFilter").value = "all";

  if ($("#riskFilter"))
    $("#riskFilter").value = "all";

  if ($("#stateFilter"))
    $("#stateFilter").value = "all";


  filteredDashboard();

}


// =====================================================
// RENDER EVERYTHING
// =====================================================

function renderAll() {

  renderProjectTable();

  renderRiskTable();

  renderDashboardKPIs();

  renderRiskDistribution();

  renderSectorBars();

  renderDashboardWarnings();

  renderWarnings();

  renderPortfolioInsight();

  renderRiskAnalytics();

}


// =====================================================
// SETUP EVENT LISTENERS
// =====================================================

function setupEvents() {


  // Navigation

  $$(".nav-item").forEach(button => {

    button.addEventListener(
      "click",
      () =>
        showPage(
          button.dataset.page
        )
    );

  });


  // Internal page links

  $$("[data-page-link]").forEach(button => {

    button.addEventListener(
      "click",
      () =>
        showPage(
          button.dataset.pageLink
        )
    );

  });


  // Mobile menu

  $("#mobileMenu")?.addEventListener(
    "click",
    () =>
      $("#sidebar")?.classList.toggle("open")
  );


  // Dashboard filters

  ["sectorFilter", "riskFilter", "stateFilter"]
    .forEach(id => {

      $(`#${id}`)?.addEventListener(
        "change",
        filteredDashboard
      );

    });


  // Reset

  $("#resetFilters")?.addEventListener(
    "click",
    resetFilters
  );


  // Project filters

  $("#projectSearch")?.addEventListener(
    "input",
    filterProjects
  );


  $("#projectRisk")?.addEventListener(
    "change",
    filterProjects
  );


  $("#projectSector")?.addEventListener(
    "change",
    filterProjects
  );


  // Sector metric

  $("#sectorMetric")?.addEventListener(
    "change",
    event =>
      renderSectorBars(
        event.target.value
      )
  );


  // Refresh

  $("#refreshBtn")?.addEventListener(
    "click",
    refreshData
  );


  // Export

  $("#exportBtn")?.addEventListener(
    "click",
    () =>
      toast(
        "Snapshot export prepared"
      )
  );


  // Notification

  $("#notifyBtn")?.addEventListener(
    "click",
    () =>
      showPage("warnings")
  );


  // Report

  $("#reportBtn")?.addEventListener(
    "click",
    () =>
      toast(
        "Report generation started"
      )
  );


  // AI suggestion buttons

  $$(".suggestions button").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        $("#chatInput").value =
          button.dataset.prompt;

        $("#chatForm").requestSubmit();

      }
    );

  });


  // AI chat

  $("#chatForm")?.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      const input =
        $("#chatInput");


      const question =
        input.value.trim();


      if (!question) return;


      addMessage(
        question,
        true
      );


      input.value = "";


      setTimeout(
        () =>
          addMessage(
            localAI(question)
          ),
        300
      );

    }
  );

}


// =====================================================
// APPLICATION START
// =====================================================

async function init() {

  setupEvents();

  await loadBackendData();

}


// Start application

init();