const API_BASE = "http://127.0.0.1:8000";

const CURRENT_SNAPSHOT = "July 2026";
const HIST_PAGE_SIZE = 25;

let projects = [];
let historicalProjects = [];

let historicalFiltered = [];
let historicalPage = 1;


// =====================================================
// BASIC HELPERS
// =====================================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);


const pageNames = {

  dashboard: "Dashboard",

  projects: "Project Portfolio",

  progress: "Project Progress",

  cost: "Cost & Expenditure",

  schedule: "Schedule & Delays",

  risk: "Risk Analysis",

  historical: "Historical Trends",

  warnings: "Early Warnings",

  sector: "Sector Analysis",

  assistant: "AI Assistant",

  reports: "Reports"

};


function num(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const n = Number(
    String(value).replace(/,/g, "")
  );

  return Number.isFinite(n) ? n : 0;
}


function fmt(value, digits = 0) {

  return num(value).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    }
  );

}


function pct(value) {

  return `${fmt(value, 1)}%`;

}


function escapeHTML(value) {

  return String(value ?? "").replace(
    /[&<>"']/g,

    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character])

  );

}


function percentValue(value) {

  const n = num(value);

  if (n >= 0 && n <= 1) {

    return n * 100;

  }

  return n;

}


// =====================================================
// RISK
// =====================================================

function riskLevel(score) {

  score = Math.max(
    0,
    Math.min(100, num(score))
  );

  if (score >= 70) {

    return "High";

  }

  if (score >= 40) {

    return "Medium";

  }

  return "Low";

}


function riskBadge(level, score) {

  return `

    <span class="risk-badge ${String(level).toLowerCase()}">

      <span>●</span>

      ${fmt(score)}

      ·

      ${level}

    </span>

  `;

}


// =====================================================
// API
// =====================================================

async function fetchJSON(url) {

  const response = await fetch(url);

  if (!response.ok) {

    throw new Error(
      `${response.status} ${response.statusText} — ${url}`
    );

  }

  return response.json();

}


async function fetchCurrentProjects() {

  return fetchJSON(
    `${API_BASE}/paimana-projects/`
  );

}


async function fetchHistoricalProjects() {

  return fetchJSON(
    `${API_BASE}/historical-projects/`
  );

}


// =====================================================
// DATE HELPERS
// =====================================================

function parseDate(value) {

  if (!value) {

    return null;

  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return null;

  }

  return date;

}


// =====================================================
// CURRENT PROJECT RISK CALCULATION
// =====================================================

function buildRisk(raw) {

  const originalCost =
    num(raw.original_cost);


  const revisedCost =
    num(raw.revised_cost);


  const currentCost =
    revisedCost > 0
      ? revisedCost
      : originalCost;


  const physical =
    Math.max(
      0,
      Math.min(
        100,
        num(raw.physical_progress)
      )
    );


  /*
    expenditure_ratio is used as a
    financial progress proxy.
  */

  const financial =
    Math.max(
      0,
      Math.min(
        100,
        percentValue(raw.expenditure_ratio)
      )
    );


  // -------------------------------------------------
  // COST RISK
  // -------------------------------------------------

  let costOverrun =
    num(raw.cost_overrun_percent);


  /*
    If cost_overrun_percent is missing,
    calculate it from original/revised cost.
  */

  if (
    !costOverrun &&
    originalCost > 0 &&
    revisedCost > 0
  ) {

    costOverrun =
      (
        (revisedCost - originalCost)
        /
        originalCost
      ) * 100;

  }


  /*
    Convert cost escalation into
    a 0–100 risk score.
  */

  const costRisk =
    Math.max(
      0,
      Math.min(
        100,
        costOverrun * 2
      )
    );


  // -------------------------------------------------
  // DELAY RISK
  // -------------------------------------------------

  const originalDate =
    parseDate(
      raw.original_completion_date
    );


  const revisedDate =
    parseDate(
      raw.revised_completion_date
    );


  const snapshotDate =
    new Date("2026-07-31T00:00:00");


  let delayRisk = 0;


  /*
    If revised completion date is later
    than original completion date,
    calculate schedule-extension risk.
  */

  if (
    originalDate &&
    revisedDate &&
    revisedDate > originalDate
  ) {

    const extensionDays =
      (
        revisedDate.getTime()
        -
        originalDate.getTime()
      ) / 86400000;


    /*
      Rough normalization:
      365 days extension ≈ 100 risk.
    */

    delayRisk =
      Math.min(
        100,
        Math.max(
          0,
          extensionDays / 3.65
        )
      );

  }


  /*
    If project should already have completed
    by July 2026 but physical progress is
    still incomplete, add an overdue signal.
  */

  const targetDate =
    revisedDate || originalDate;


  if (
    targetDate &&
    targetDate < snapshotDate &&
    physical < 100
  ) {

    delayRisk =
      Math.min(
        100,
        delayRisk + 35
      );

  }


  // -------------------------------------------------
  // PROGRESS RISK
  // -------------------------------------------------

  const progressRisk =
    100 - physical;


  // -------------------------------------------------
  // OVERALL RISK
  // -------------------------------------------------

  const overallRisk =
    Math.round(
      (
        costRisk * 0.40 +
        delayRisk * 0.40 +
        progressRisk * 0.20
      ) * 10
    ) / 10;


  // -------------------------------------------------
  // REASONS
  // -------------------------------------------------

  const reasons = [];


  if (costRisk >= 70) {

    reasons.push(
      "High cost escalation signal."
    );

  }
  else if (costRisk >= 40) {

    reasons.push(
      "Moderate cost escalation signal."
    );

  }


  if (delayRisk >= 70) {

    reasons.push(
      "High schedule-delay signal."
    );

  }
  else if (delayRisk >= 40) {

    reasons.push(
      "Schedule slippage requires attention."
    );

  }


  if (physical < 50) {

    reasons.push(
      "Physical progress is below 50%."
    );

  }


  if (!reasons.length) {

    reasons.push(
      "No major risk indicator crossed the alert threshold."
    );

  }


  return {

    original: originalCost,

    current: currentCost,

    physical: physical,

    financial: financial,

    costRisk: costRisk,

    delayRisk: delayRisk,

    risk: overallRisk,

    level: riskLevel(overallRisk),

    reasons: reasons

  };

}


// =====================================================
// NORMALIZE CURRENT 1775 PROJECTS
// =====================================================

function normalizeCurrent(raw) {

  const risk =
    buildRisk(raw);


  return {

    raw: raw,

    id:
      raw.project_code ||
      raw.sr_no ||
      raw.project_id ||
      "—",


    name:
      raw.project_name ||
      "Unnamed project",


    /*
      Current CSV does not contain a state field.
    */

    state:
      raw.state ||
      "Not available",


    sector:
      raw.sector ||
      "Other",


    ministry:
      raw.line_ministry ||
      "Not available",


    agency:
      raw.implementing_agency ||
      "Not available",


    original:
      risk.original,


    current:
      risk.current,


    physical:
      risk.physical,


    financial:
      risk.financial,


    costRisk:
      risk.costRisk,


    delayRisk:
      risk.delayRisk,


    risk:
      risk.risk,


    level:
      risk.level,


    reasons:
      risk.reasons

  };

}


// =====================================================
// LOAD BACKEND DATA
// =====================================================

async function loadBackendData() {

  try {

    /*
      IMPORTANT:

      Current portfolio:
      /paimana-projects/

      Historical:
      /historical-projects/
    */

    const [
      rawCurrent,
      rawHistorical
    ] = await Promise.all([

      fetchCurrentProjects(),

      fetchHistoricalProjects()

    ]);


    if (!Array.isArray(rawCurrent)) {

      throw new Error(
        "/paimana-projects/ did not return an array"
      );

    }


    if (!Array.isArray(rawHistorical)) {

      throw new Error(
        "/historical-projects/ did not return an array"
      );

    }


    /*
      Current = 1775 July 2026 projects
    */

    projects =
      rawCurrent.map(
        normalizeCurrent
      );


    /*
      Historical = smaller historical dataset only
    */

    historicalProjects =
      rawHistorical;


    historicalFiltered =
      historicalProjects.slice();


    const dateElement =
      $("#dataDate");


    if (dateElement) {

      dateElement.textContent =
        CURRENT_SNAPSHOT;

    }


    console.log(
      `PAIMANA current projects loaded: ${projects.length}`
    );


    console.log(
      `PAIMANA historical projects loaded: ${historicalProjects.length}`
    );


    populateFilters();

    renderAll();

  }
  catch (error) {

    console.error(
      "PAIMANA frontend error:",
      error
    );


    if ($("#dataDate")) {

      $("#dataDate").textContent =
        "Error";

    }


    toast(
      "Data load failed — check browser console"
    );

  }

}


// =====================================================
// FILTER DROPDOWNS
// =====================================================

function populateFilters() {

  /*
    Current 1775 sectors
  */

  const sectors =
    [
      ...new Set(
        projects
          .map(project => project.sector)
          .filter(Boolean)
      )
    ].sort();


  const projectSector =
    $("#projectSector");


  if (projectSector) {

    projectSector.innerHTML =

      `<option value="all">
        All Sectors
      </option>`

      +

      sectors
        .map(
          sector =>
            `
            <option value="${escapeHTML(sector)}">
              ${escapeHTML(sector)}
            </option>
            `
        )
        .join("");

  }


  /*
    Historical sectors
  */

  const historicalSector =
    $("#historicalSector");


  const historicalSectors =
    [
      ...new Set(
        historicalProjects
          .map(project => project.sector)
          .filter(Boolean)
      )
    ].sort();


  if (historicalSector) {

    historicalSector.innerHTML =

      `<option value="all">
        All Sectors
      </option>`

      +

      historicalSectors
        .map(
          sector =>
            `
            <option value="${escapeHTML(sector)}">
              ${escapeHTML(sector)}
            </option>
            `
        )
        .join("");

  }

}


// =====================================================
// DASHBOARD KPIs
// =====================================================

function renderDashboardKPIs() {

  const total =
    projects.length;


  const high =
    projects.filter(
      project =>
        project.level === "High"
    ).length;


  const delay =
    projects.filter(
      project =>
        project.delayRisk >= 70
    ).length;


  const currentCost =
    projects.reduce(
      (sum, project) =>
        sum + project.current,
      0
    );


  const averagePhysical =
    total
      ? projects.reduce(
          (sum, project) =>
            sum + project.physical,
          0
        ) / total
      : 0;


  if ($("#totalProjects")) {

    $("#totalProjects").textContent =
      fmt(total);

  }


  if ($("#highRisk")) {

    $("#highRisk").textContent =
      fmt(high);

  }


  if ($("#costExposure")) {

    $("#costExposure").textContent =
      `₹${fmt(currentCost)} Cr`;

  }


  if ($("#delayRisk")) {

    $("#delayRisk").textContent =
      fmt(delay);

  }


  if ($("#avgProgress")) {

    $("#avgProgress").textContent =
      pct(averagePhysical);

  }


  /*
    AI Assistant context
  */

  if ($("#aiProjects")) {

    $("#aiProjects").textContent =
      fmt(total);

  }


  if ($("#aiHighRisk")) {

    $("#aiHighRisk").textContent =
      fmt(high);

  }


  if ($("#aiHistorical")) {

    $("#aiHistorical").textContent =
      fmt(historicalProjects.length);

  }

}


// =====================================================
// RISK DISTRIBUTION
// =====================================================

function renderRiskDistribution(
  list = projects
) {

  const total =
    list.length;


  const high =
    list.filter(
      project =>
        project.level === "High"
    ).length;


  const medium =
    list.filter(
      project =>
        project.level === "Medium"
    ).length;


  const low =
    Math.max(
      0,
      total - high - medium
    );


  const highPercent =
    total
      ? Math.round(
          high / total * 100
        )
      : 0;


  const mediumPercent =
    total
      ? Math.round(
          medium / total * 100
        )
      : 0;


  const lowPercent =
    Math.max(
      0,
      100 -
      highPercent -
      mediumPercent
    );


  if ($("#riskTotal")) {

    $("#riskTotal").textContent =
      fmt(total);

  }


  if ($("#highRiskCount")) {

    $("#highRiskCount").textContent =
      fmt(high);

  }


  if ($("#mediumRiskCount")) {

    $("#mediumRiskCount").textContent =
      fmt(medium);

  }


  if ($("#lowRiskCount")) {

    $("#lowRiskCount").textContent =
      fmt(low);

  }


  if ($("#highRiskPercent")) {

    $("#highRiskPercent").textContent =
      `${highPercent}%`;

  }


  if ($("#mediumRiskPercent")) {

    $("#mediumRiskPercent").textContent =
      `${mediumPercent}%`;

  }


  if ($("#lowRiskPercent")) {

    $("#lowRiskPercent").textContent =
      `${lowPercent}%`;

  }


  const donut =
    $("#riskDonut");


  if (donut) {

    donut.style.background =

      `conic-gradient(
        #d94b55 0 ${highPercent}%,
        #d99522 ${highPercent}% ${highPercent + mediumPercent}%,
        #2e9d6f ${highPercent + mediumPercent}% 100%
      )`;

  }

}


// =====================================================
// SECTOR STATISTICS
// =====================================================

function sectorStats(
  list = projects
) {

  const map = {};


  list.forEach(project => {

    const sector =
      project.sector ||
      "Other";


    if (!map[sector]) {

      map[sector] = {

        sector: sector,

        count: 0,

        risk: 0,

        delay: 0,

        cost: 0,

        high: 0

      };

    }


    const item =
      map[sector];


    item.count++;

    item.risk +=
      project.risk;

    item.delay +=
      project.delayRisk;

    item.cost +=
      project.current;


    if (
      project.level === "High"
    ) {

      item.high++;

    }

  });


  return Object
    .values(map)
    .map(item => ({

      ...item,

      avgRisk:
        item.risk /
        item.count,

      avgDelay:
        item.delay /
        item.count,

      avgCost:
        item.cost /
        item.count

    }));

}


// =====================================================
// SECTOR BARS
// =====================================================

function renderSectorBars(
  metric = "risk"
) {

  const box =
    $("#sectorBars");


  if (!box) {

    return;

  }


  const stats =
    sectorStats()
      .sort((a, b) => {

        const aValue =
          metric === "delay"
            ? a.avgDelay
            : metric === "cost"
              ? a.avgCost
              : a.avgRisk;


        const bValue =
          metric === "delay"
            ? b.avgDelay
            : metric === "cost"
              ? b.avgCost
              : b.avgRisk;


        return bValue - aValue;

      })
      .slice(0, 8);


  if (!stats.length) {

    box.innerHTML =
      "<p class='muted'>No sector data available.</p>";

    return;

  }


  const max =
    metric === "cost"
      ? Math.max(
          ...stats.map(
            item =>
              item.avgCost
          ),
          1
        )
      : 100;


  box.innerHTML =

    stats
      .map(item => {

        const value =

          metric === "delay"
            ? item.avgDelay

            : metric === "cost"
              ? item.avgCost

              : item.avgRisk;


        const width =
          Math.min(
            100,
            value / max * 100
          );


        return `

          <div class="bar-row">

            <span>
              ${escapeHTML(item.sector)}
            </span>

            <div class="bar-track">

              <i
                style="width:${width}%"
              ></i>

            </div>

            <strong>

              ${
                metric === "cost"
                  ? "₹" + fmt(value) + "Cr"
                  : fmt(value)
              }

            </strong>

          </div>

        `;

      })
      .join("");

}


// =====================================================
// RISK TABLE
// =====================================================

function renderRiskTable(
  list =
    projects
      .slice()
      .sort(
        (a, b) =>
          b.risk - a.risk
      )
      .slice(0, 7)
) {

  const table =
    $("#riskTable");


  if (!table) {

    return;

  }


  if (!list.length) {

    table.innerHTML = `

      <tr>

        <td colspan="7">
          No projects found.
        </td>

      </tr>

    `;

    return;

  }


  table.innerHTML =

    list
      .map(project => `

        <tr>

          <td>

            <div class="project-cell">

              ${escapeHTML(project.name)}

              <small>
                Project ID
                ${escapeHTML(project.id)}
              </small>

            </div>

          </td>


          <td>
            ${escapeHTML(project.sector)}
          </td>


          <td>
            ${escapeHTML(project.state)}
          </td>


          <td>
            ${riskBadge(
              project.level,
              project.risk
            )}
          </td>


          <td>
            <span class="risk-number">
              ${fmt(project.costRisk)}%
            </span>
          </td>


          <td>
            <span class="risk-number">
              ${fmt(project.delayRisk)}%
            </span>
          </td>


          <td>
            <span class="risk-badge ${project.level.toLowerCase()}">
              ${project.level}
            </span>
          </td>

        </tr>

      `)
      .join("");

}


// =====================================================
// PROJECT PORTFOLIO TABLE
// =====================================================

function renderProjectTable(
  list = projects
) {

  const table =
    $("#projectTable");


  if (!table) {

    return;

  }


  if (!list.length) {

    table.innerHTML = `

      <tr>

        <td colspan="8">
          No projects match the selected filters.
        </td>

      </tr>

    `;

    return;

  }


  table.innerHTML =

    list
      .map(project => `

        <tr>

          <td>

            <div class="project-cell">

              ${escapeHTML(project.name)}

              <small>
                ID ${escapeHTML(project.id)}
              </small>

            </div>

          </td>


          <td>
            ${escapeHTML(project.state)}
          </td>


          <td>
            ${escapeHTML(project.sector)}
          </td>


          <td>
            ₹${fmt(project.original)} Cr
          </td>


          <td>
            ₹${fmt(project.current)} Cr
          </td>


          <td>
            ${pct(project.physical)}
          </td>


          <td>
            ${pct(project.financial)}
          </td>


          <td>
            ${riskBadge(
              project.level,
              project.risk
            )}
          </td>

        </tr>

      `)
      .join("");

}


// =====================================================
// DASHBOARD WARNINGS
// =====================================================

function renderDashboardWarnings() {

  const box =
    $("#dashboardWarnings");


  if (!box) {

    return;

  }


  const warnings =

    projects

      .filter(
        project =>

          project.level === "High" ||

          project.costRisk >= 70 ||

          project.delayRisk >= 70 ||

          project.physical < 50
      )

      .sort(
        (a, b) =>
          b.risk - a.risk
      )

      .slice(0, 4);


  if (!warnings.length) {

    box.innerHTML = `

      <div class="alert-item">

        <strong>
          No critical warnings
        </strong>

        <small>
          Current project data has no high-priority alerts.
        </small>

      </div>

    `;

    return;

  }


  box.innerHTML =

    warnings
      .map(project => `

        <div class="alert-item">

          <strong>
            ${escapeHTML(project.name)}
          </strong>

          <small>
            Risk ${fmt(project.risk)}
            · Cost ${fmt(project.costRisk)}
            · Delay ${fmt(project.delayRisk)}
          </small>

        </div>

      `)
      .join("");

}


// =====================================================
// PORTFOLIO INSIGHT
// =====================================================

function renderPortfolioInsight() {

  const element =
    $("#portfolioInsight");


  if (!element) {

    return;

  }


  if (!projects.length) {

    element.textContent =
      "No project data available.";

    return;

  }


  const highestRisk =

    projects
      .slice()
      .sort(
        (a, b) =>
          b.risk - a.risk
      )[0];


  const highRiskCount =

    projects.filter(
      project =>
        project.level === "High"
    ).length;


  const averageRisk =

    projects.reduce(
      (sum, project) =>
        sum + project.risk,
      0
    ) / projects.length;


  const sector =

    sectorStats()
      .sort(
        (a, b) =>
          b.avgRisk -
          a.avgRisk
      )[0];


  element.innerHTML = `

    The July 2026 portfolio contains

    <b>
      ${fmt(projects.length)}
    </b>

    monitored projects with an average derived risk score of

    <b>
      ${fmt(averageRisk)}/100
    </b>.

    The highest current signal is

    <b>
      ${escapeHTML(highestRisk.name)}
    </b>

    at

    <b>
      ${fmt(highestRisk.risk)}/100
    </b>.

    There are

    <b>
      ${fmt(highRiskCount)}
    </b>

    high-risk projects requiring attention.

    ${
      sector
        ? `
          <br><br>
          <b>${escapeHTML(sector.sector)}</b>
          has the highest average risk among the current sectors.
        `
        : ""
    }

  `;

}


// =====================================================
// PROJECT PROGRESS
// =====================================================

function renderProgress() {

  if (!projects.length) {

    return;

  }


  const averagePhysical =

    projects.reduce(
      (sum, project) =>
        sum + project.physical,
      0
    ) / projects.length;


  const averageFinancial =

    projects.reduce(
      (sum, project) =>
        sum + project.financial,
      0
    ) / projects.length;


  const below50 =

    projects.filter(
      project =>
        project.physical < 50
    ).length;


  const largestGap =

    Math.max(
      ...projects.map(
        project =>
          Math.abs(
            project.physical -
            project.financial
          )
      ),
      0
    );


  $("#progressPhysical").textContent =
    pct(averagePhysical);


  $("#progressFinancial").textContent =
    pct(averageFinancial);


  $("#progressBelow").textContent =
    fmt(below50);


  $("#progressGap").textContent =
    pct(largestGap);


  const bands = [

    [
      "0–25%",
      projects.filter(
        project =>
          project.physical <= 25
      ).length
    ],

    [
      "26–50%",
      projects.filter(
        project =>
          project.physical > 25 &&
          project.physical <= 50
      ).length
    ],

    [
      "51–75%",
      projects.filter(
        project =>
          project.physical > 50 &&
          project.physical <= 75
      ).length
    ],

    [
      "76–100%",
      projects.filter(
        project =>
          project.physical > 75
      ).length
    ]

  ];


  const maxBand =
    Math.max(
      ...bands.map(
        band => band[1]
      ),
      1
    );


  $("#progressBars").innerHTML =

    bands
      .map(
        band => `

          <div class="bar-row">

            <span>
              ${band[0]}
            </span>

            <div class="bar-track">

              <i
                style="width:${band[1] / maxBand * 100}%"
              ></i>

            </div>

            <strong>
              ${fmt(band[1])}
            </strong>

          </div>

        `
      )
      .join("");


  const gaps =

    projects
      .slice()
      .sort(
        (a, b) =>

          Math.abs(
            b.physical -
            b.financial
          )

          -

          Math.abs(
            a.physical -
            a.financial
          )
      )
      .slice(0, 7);


  $("#progressGapList").innerHTML =

    gaps
      .map(project => `

        <div class="mini-item">

          <strong>
            ${escapeHTML(project.name)}
          </strong>

          <small>

            Physical
            ${fmt(project.physical)}%

            ·

            Financial
            ${fmt(project.financial)}%

            ·

            Gap
            ${fmt(
              Math.abs(
                project.physical -
                project.financial
              )
            )}%

          </small>

        </div>

      `)
      .join("");

}


// =====================================================
// COST PAGE
// =====================================================

function renderCost() {

  if (!projects.length) {

    return;

  }


  const originalTotal =

    projects.reduce(
      (sum, project) =>
        sum + project.original,
      0
    );


  const currentTotal =

    projects.reduce(
      (sum, project) =>
        sum + project.current,
      0
    );


  const increase =
    currentTotal -
    originalTotal;


  const averageMovement =

    projects.reduce(
      (sum, project) => {

        if (!project.original) {

          return sum;

        }


        return sum +

          (
            (
              project.current -
              project.original
            )

            /

            project.original
          ) * 100;

      },
      0
    ) / projects.length;


  $("#originalCostTotal").textContent =
    `₹${fmt(originalTotal)} Cr`;


  $("#currentCostTotal").textContent =
    `₹${fmt(currentTotal)} Cr`;


  $("#costIncrease").textContent =
    `₹${fmt(increase)} Cr`;


  $("#avgCostMovement").textContent =
    pct(averageMovement);


  const list =

    projects
      .slice()
      .sort((a, b) => {

        const aChange =
          a.original
            ? (
                (a.current - a.original)
                /
                a.original
              ) * 100
            : 0;


        const bChange =
          b.original
            ? (
                (b.current - b.original)
                /
                b.original
              ) * 100
            : 0;


        return bChange - aChange;

      })
      .slice(0, 10);


  $("#costTable").innerHTML =

    list
      .map(project => {

        const change =

          project.original

            ? (
                (
                  project.current -
                  project.original
                )

                /

                project.original

              ) * 100

            : 0;


        return `

          <tr>

            <td>

              <div class="project-cell">

                ${escapeHTML(project.name)}

                <small>
                  ID ${escapeHTML(project.id)}
                </small>

              </div>

            </td>


            <td>
              ${escapeHTML(project.sector)}
            </td>


            <td>
              ₹${fmt(project.original)} Cr
            </td>


            <td>
              ₹${fmt(project.current)} Cr
            </td>


            <td>
              ${pct(change)}
            </td>


            <td>
              ${pct(project.financial)}
            </td>

          </tr>

        `;

      })
      .join("");

}


// =====================================================
// SCHEDULE PAGE
// =====================================================

function renderSchedule() {

  const highDelay =

    projects.filter(
      project =>
        project.delayRisk >= 70
    ).length;


  const averageDelay =

    projects.length

      ? projects.reduce(
          (sum, project) =>
            sum + project.delayRisk,
          0
        ) / projects.length

      : 0;


  const highOverall =

    projects.filter(
      project =>
        project.level === "High"
    ).length;


  const lowProgress =

    projects.filter(
      project =>
        project.physical < 50
    ).length;


  $("#scheduleHigh").textContent =
    fmt(highDelay);


  $("#scheduleAvg").textContent =
    pct(averageDelay);


  $("#scheduleOverallHigh").textContent =
    fmt(highOverall);


  $("#scheduleLowProgress").textContent =
    fmt(lowProgress);


  const list =

    projects
      .slice()
      .sort(
        (a, b) =>
          b.delayRisk -
          a.delayRisk
      )
      .slice(0, 12);


  $("#scheduleTable").innerHTML =

    list
      .map(project => `

        <tr>

          <td>

            <div class="project-cell">

              ${escapeHTML(project.name)}

              <small>
                ID ${escapeHTML(project.id)}
              </small>

            </div>

          </td>


          <td>
            ${escapeHTML(project.sector)}
          </td>


          <td>
            ${escapeHTML(project.state)}
          </td>


          <td>
            ${riskBadge(
              riskLevel(project.delayRisk),
              project.delayRisk
            )}
          </td>


          <td>
            ${pct(project.physical)}
          </td>


          <td>
            ${riskBadge(
              project.level,
              project.risk
            )}
          </td>

        </tr>

      `)
      .join("");

}


// =====================================================
// RISK ANALYTICS
// =====================================================

function renderRiskAnalytics() {

  if (!projects.length) {

    return;

  }


  const averageRisk =

    projects.reduce(
      (sum, project) =>
        sum + project.risk,
      0
    ) / projects.length;


  const averageCostRisk =

    projects.reduce(
      (sum, project) =>
        sum + project.costRisk,
      0
    ) / projects.length;


  const averageDelayRisk =

    projects.reduce(
      (sum, project) =>
        sum + project.delayRisk,
      0
    ) / projects.length;


  $("#avgPortfolioRisk").textContent =
    fmt(averageRisk);


  $("#avgCostRisk").textContent =
    fmt(averageCostRisk);


  $("#avgDelayRisk").textContent =
    fmt(averageDelayRisk);


  $("#riskHighCount").textContent =

    fmt(
      projects.filter(
        project =>
          project.level === "High"
      ).length
    );


  const stats =

    sectorStats()
      .sort(
        (a, b) =>
          b.avgRisk -
          a.avgRisk
      );


  const box =
    $("#riskSectorBars");


  const maxRisk =

    Math.max(
      ...stats.map(
        item =>
          item.avgRisk
      ),
      1
    );


  box.innerHTML =

    stats
      .slice(0, 8)
      .map(item => `

        <div class="bar-row">

          <span>
            ${escapeHTML(item.sector)}
          </span>

          <div class="bar-track">

            <i
              style="width:${item.avgRisk / maxRisk * 100}%"
            ></i>

          </div>

          <strong>
            ${fmt(item.avgRisk)}
          </strong>

        </div>

      `)
      .join("");


  const maxCostRisk =

    Math.max(
      ...projects.map(
        project =>
          project.costRisk
      ),
      0
    );


  const maxDelayRisk =

    Math.max(
      ...projects.map(
        project =>
          project.delayRisk
      ),
      0
    );


  const maxProgressGap =

    Math.max(
      ...projects.map(
        project =>
          Math.abs(
            project.physical -
            project.financial
          )
      ),
      0
    );


  $("#factorList").innerHTML = `

    <div class="factor-item">

      <strong>
        Peak cost-risk signal ·
        ${fmt(maxCostRisk)}%
      </strong>

      <small>
        Highest project-level cost-risk signal currently loaded.
      </small>

    </div>


    <div class="factor-item">

      <strong>
        Peak delay-risk signal ·
        ${fmt(maxDelayRisk)}%
      </strong>

      <small>
        Highest project-level delay-risk signal currently loaded.
      </small>

    </div>


    <div class="factor-item">

      <strong>
        Largest progress gap ·
        ${fmt(maxProgressGap)}%
      </strong>

      <small>
        Largest absolute difference between physical and financial progress.
      </small>

    </div>

  `;


  $("#riskSummary").innerHTML =

    projects

      .slice()
      .sort(
        (a, b) =>
          b.risk -
          a.risk
      )

      .slice(0, 10)

      .map(project => `

        <tr>

          <td>

            <div class="project-cell">

              ${escapeHTML(project.name)}

              <small>
                ID ${escapeHTML(project.id)}
              </small>

            </div>

          </td>


          <td>
            ${escapeHTML(project.sector)}
          </td>


          <td>
            ${escapeHTML(project.state)}
          </td>


          <td>
            ${riskBadge(
              project.level,
              project.risk
            )}
          </td>


          <td>
            ${fmt(project.costRisk)}%
          </td>


          <td>
            ${fmt(project.delayRisk)}%
          </td>

        </tr>

      `)
      .join("");

}


// =====================================================
// HISTORICAL COST OVERRUN
// =====================================================

function historicalOverrun(row) {

  if (
    row.cost_overrun_percent !== null &&
    row.cost_overrun_percent !== undefined &&
    row.cost_overrun_percent !== ""
  ) {

    return num(
      row.cost_overrun_percent
    );

  }


  const original =
    num(row.original_cost);


  const revised =
    num(row.revised_cost);


  if (
    original &&
    revised
  ) {

    return (
      (revised - original)
      /
      original
    ) * 100;

  }


  return 0;

}


// =====================================================
// HISTORICAL PAGE
// =====================================================

function renderHistorical() {

  historicalFiltered =
    historicalProjects.slice();


  historicalPage = 1;


  const overruns =

    historicalProjects
      .map(
        historicalOverrun
      )
      .filter(
        value =>
          Number.isFinite(value)
      );


  const averageOverrun =

    overruns.length

      ? overruns.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / overruns.length

      : 0;


  const positiveOverruns =

    overruns.filter(
      value =>
        value > 0
    ).length;


  const sectorCounts = {};


  historicalProjects.forEach(
    project => {

      const sector =
        project.sector ||
        "Other";


      sectorCounts[sector] =
        (
          sectorCounts[sector] ||
          0
        ) + 1;

    }
  );


  const topSector =

    Object.entries(
      sectorCounts
    )
      .sort(
        (a, b) =>
          b[1] - a[1]
      )[0];


  $("#historicalCount").textContent =
    fmt(
      historicalProjects.length
    );


  $("#histRecords").textContent =
    fmt(
      historicalProjects.length
    );


  $("#histAvgOverrun").textContent =
    pct(averageOverrun);


  $("#histOverrunCount").textContent =
    fmt(positiveOverruns);


  $("#histTopSector").textContent =

    topSector
      ? escapeHTML(topSector[0])
      : "—";


  renderHistoricalTable();

}


// =====================================================
// HISTORICAL TABLE
// =====================================================

function renderHistoricalTable() {

  const table =
    $("#historicalTable");


  if (!table) {

    return;

  }


  const start =
    (
      historicalPage - 1
    ) * HIST_PAGE_SIZE;


  const rows =

    historicalFiltered.slice(
      start,
      start + HIST_PAGE_SIZE
    );


  const totalPages =

    Math.max(
      1,
      Math.ceil(
        historicalFiltered.length /
        HIST_PAGE_SIZE
      )
    );


  if (!rows.length) {

    table.innerHTML = `

      <tr>

        <td colspan="10">
          No historical records found.
        </td>

      </tr>

    `;

  }
  else {

    table.innerHTML =

      rows
        .map(row => `

          <tr>

            <td>

              <div class="project-cell">

                ${escapeHTML(
                  row.project_name
                )}

                <small>
                  Sr. No.
                  ${escapeHTML(
                    row.sr_no
                  )}
                </small>

              </div>

            </td>


            <td>
              ${escapeHTML(
                row.project_code
              )}
            </td>


            <td>
              ${escapeHTML(
                row.sector
              )}
            </td>


            <td>
              ${escapeHTML(
                row.line_ministry
              )}
            </td>


            <td>
              ${escapeHTML(
                row.implementing_agency
              )}
            </td>


            <td>
              ₹${fmt(
                row.original_cost
              )} Cr
            </td>


            <td>
              ₹${fmt(
                row.revised_cost
              )} Cr
            </td>


            <td>
              ₹${fmt(
                row.expenditure
              )} Cr
            </td>


            <td>
              ${pct(
                row.physical_progress
              )}
            </td>


            <td>
              ${pct(
                historicalOverrun(row)
              )}
            </td>

          </tr>

        `)
        .join("");

  }


  $("#histPageInfo").textContent =

    `Page ${historicalPage} of ${totalPages}`;


  $("#histPrev").disabled =
    historicalPage <= 1;


  $("#histNext").disabled =
    historicalPage >= totalPages;

}


// =====================================================
// HISTORICAL FILTER
// =====================================================

function filterHistorical() {

  const search =

    (
      $("#historicalSearch")?.value ||
      ""
    )
      .toLowerCase()
      .trim();


  const sector =

    $("#historicalSector")?.value ||
    "all";


  historicalFiltered =

    historicalProjects.filter(
      row => {

        const text = `

          ${row.project_name || ""}

          ${row.project_code || ""}

          ${row.line_ministry || ""}

          ${row.implementing_agency || ""}

          ${row.sector || ""}

        `.toLowerCase();


        return (

          (
            !search ||
            text.includes(search)
          )

          &&

          (
            sector === "all" ||
            row.sector === sector
          )

        );

      }
    );


  historicalPage = 1;

  renderHistoricalTable();

}


// =====================================================
// SECTOR PAGE
// =====================================================

function renderSectorPage() {

  const table =
    $("#sectorTable");


  if (!table) {

    return;

  }


  const stats =

    sectorStats()
      .sort(
        (a, b) =>
          b.count -
          a.count
      );


  const total =
    projects.length || 1;


  table.innerHTML =

    stats
      .map(item => `

        <tr>

          <td>
            <strong>
              ${escapeHTML(
                item.sector
              )}
            </strong>
          </td>


          <td>
            ${fmt(item.count)}
          </td>


          <td>
            ${pct(
              item.count /
              total *
              100
            )}
          </td>


          <td>
            ${fmt(item.avgRisk)}
          </td>


          <td>
            ${fmt(item.high)}
          </td>


          <td>
            ₹${fmt(item.cost)} Cr
          </td>

        </tr>

      `)
      .join("");

}


// =====================================================
// EARLY WARNINGS PAGE
// =====================================================

function renderWarnings() {

  const box =
    $("#warningGrid");


  if (!box) {

    return;

  }


  const warnings =

    projects

      .filter(
        project =>

          project.level === "High" ||

          project.costRisk >= 70 ||

          project.delayRisk >= 70 ||

          project.physical < 50
      )

      .sort(
        (a, b) =>
          b.risk -
          a.risk
      )

      .slice(0, 12);


  if (!warnings.length) {

    box.innerHTML = `

      <article class="panel">

        <h3>
          No major warnings
        </h3>

        <p>
          No high-priority indicators were detected.
        </p>

      </article>

    `;

    return;

  }


  box.innerHTML =

    warnings
      .map(project => {

        const reason =
          project.reasons?.[0] ||
          "Risk indicator detected.";


        return `

          <article
            class="panel warning-card
            ${
              project.level === "High"
                ? "critical"
                : "attention"
            }"
          >

            <div class="warning-head">

              <span
                class="risk-badge ${project.level.toLowerCase()}"
              >
                ${project.level}
              </span>

              <time>
                July 2026 signal
              </time>

            </div>


            <h3>
              ${escapeHTML(
                project.name
              )}
            </h3>


            <p>
              ${escapeHTML(reason)}
            </p>


            <div class="warning-meta">

              <span>
                ${escapeHTML(
                  project.sector
                )}
              </span>

              <span>
                ${escapeHTML(
                  project.state
                )}
              </span>

              <strong>
                Risk ${fmt(
                  project.risk
                )}
              </strong>

            </div>

          </article>

        `;

      })
      .join("");

}


// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(name) {

  $$(".page").forEach(
    page =>
      page.classList.remove(
        "active"
      )
  );


  $(`#page-${name}`)?.classList.add(
    "active"
  );


  $$(".nav-item").forEach(
    button =>
      button.classList.toggle(
        "active",
        button.dataset.page === name
      )
  );


  if ($("#pageCrumb")) {

    $("#pageCrumb").textContent =
      pageNames[name] || name;

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  $("#sidebar")?.classList.remove(
    "open"
  );

}


// =====================================================
// PROJECT FILTER
// =====================================================

function filterProjects() {

  const search =

    (
      $("#projectSearch")?.value ||
      ""
    )
      .toLowerCase()
      .trim();


  const risk =

    $("#projectRisk")?.value ||
    "all";


  const sector =

    $("#projectSector")?.value ||
    "all";


  const filtered =

    projects.filter(
      project => {

        const text = `

          ${project.name}

          ${project.state}

          ${project.sector}

          ${project.id}

        `.toLowerCase();


        return (

          (
            !search ||
            text.includes(search)
          )

          &&

          (
            risk === "all" ||
            project.level === risk
          )

          &&

          (
            sector === "all" ||
            project.sector === sector
          )

        );

      }
    );


  renderProjectTable(
    filtered
  );

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


  if (!box) {

    return;

  }


  const element =
    document.createElement("div");


  element.className =
    `message ${
      user
        ? "user"
        : "bot"
    }`;


  element.innerHTML =

    user

      ? `

        <div>

          <p>
            ${escapeHTML(text)}
          </p>

          <time>
            Now
          </time>

        </div>

      `

      : `

        <div class="bot-avatar">
          ✦
        </div>

        <div>

          <p>
            ${text}
          </p>

          <time>
            Now
          </time>

        </div>

      `;


  box.appendChild(
    element
  );


  box.scrollTop =
    box.scrollHeight;

}


// =====================================================
// LOCAL AI
// =====================================================

function localAI(question) {

  const q =
    question
      .toLowerCase();


  /*
    Highest risk
  */

  if (
    q.includes("highest") &&
    q.includes("risk")
  ) {

    const top =

      projects
        .slice()
        .sort(
          (a, b) =>
            b.risk -
            a.risk
        )
        .slice(0, 3);


    if (!top.length) {

      return "No project data is currently loaded.";

    }


    return `

      The highest current risk projects are:

      ${top
        .map(
          project =>
            `<b>${escapeHTML(
              project.name
            )}</b>
            (${fmt(project.risk)}/100)`
        )
        .join(", ")}.

    `;

  }


  /*
    Transport
  */

  if (
    q.includes("transport")
  ) {

    const transportProjects =

      projects.filter(
        project =>

          project.sector
            .toLowerCase()
            .includes("transport")

          &&

          project.level === "High"
      )
      .slice(0, 5);


    if (!transportProjects.length) {

      return `
        No high-risk transport projects
        were found in the current dataset.
      `;

    }


    return `

      Found

      <b>
        ${transportProjects.length}
      </b>

      high-risk transport projects:

      ${transportProjects
        .map(
          project =>
            `<b>${escapeHTML(
              project.name
            )}</b>`
        )
        .join(", ")}.

    `;

  }


  /*
    Cost
  */

  if (
    q.includes("cost")
  ) {

    const averageMovement =

      projects.length

        ? projects.reduce(
            (sum, project) => {

              if (!project.original) {

                return sum;

              }


              return sum +

                (
                  (
                    project.current -
                    project.original
                  )

                  /

                  project.original

                ) * 100;

            },
            0
          ) / projects.length

        : 0;


    return `

      Across the July 2026 portfolio,
      the average current-vs-original
      cost movement is approximately

      <b>
        ${pct(averageMovement)}
      </b>.

    `;

  }


  /*
    Delay
  */

  if (
    q.includes("delay")
  ) {

    const count =

      projects.filter(
        project =>
          project.delayRisk >= 70
      ).length;


    return `

      <b>
        ${fmt(count)}
      </b>

      projects currently have
      derived delay risk at or above 70%.

    `;

  }


  /*
    Portfolio
  */

  if (
    q.includes("main") ||
    q.includes("portfolio")
  ) {

    const high =

      projects.filter(
        project =>
          project.level === "High"
      ).length;


    const averageRisk =

      projects.length

        ? projects.reduce(
            (sum, project) =>
              sum + project.risk,
            0
          ) / projects.length

        : 0;


    return `

      The July 2026 portfolio contains

      <b>
        ${fmt(projects.length)}
      </b>

      monitored projects,

      with

      <b>
        ${fmt(high)}
      </b>

      high-risk projects and an
      average derived risk score of

      <b>
        ${fmt(averageRisk)}/100
      </b>.

    `;

  }


  /*
    Specific project
  */

  const project =

    projects.find(
      item =>
        q.includes(
          item.name.toLowerCase()
        )
    );


  if (project) {

    return `

      <b>
        ${escapeHTML(
          project.name
        )}
      </b>

      <br><br>

      Sector:
      <b>
        ${escapeHTML(
          project.sector
        )}
      </b>

      <br>

      State:
      <b>
        ${escapeHTML(
          project.state
        )}
      </b>

      <br>

      Overall risk:
      <b>
        ${fmt(project.risk)}/100
      </b>

      <br>

      Cost risk:
      <b>
        ${fmt(project.costRisk)}%
      </b>

      <br>

      Delay risk:
      <b>
        ${fmt(project.delayRisk)}%
      </b>

      <br>

      Physical progress:
      <b>
        ${pct(project.physical)}
      </b>

      <br>

      Financial progress:
      <b>
        ${pct(project.financial)}
      </b>

    `;

  }


  return `

    I can analyze the July 2026
    PAIMANA project dataset.

    <br><br>

    Try asking about:

    <br><br>

    • Highest risk projects

    <br>

    • Cost risk

    <br>

    • Delay risk

    <br>

    • Transport projects

    <br>

    • Physical progress

    <br>

    • A specific project

  `;

}


// =====================================================
// CSV EXPORT
// =====================================================

function exportCSV(
  rows,
  filename
) {

  if (!rows.length) {

    toast(
      "No data available"
    );

    return;

  }


  const keys =
    Object.keys(rows[0]);


  const csv = [

    keys.join(","),

    ...rows.map(
      row =>

        keys
          .map(
            key =>
              `"${String(
                row[key] ?? ""
              ).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
    )

  ].join("\n");


  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement("a");


  link.href =
    url;


  link.download =
    filename;


  link.click();


  URL.revokeObjectURL(
    url
  );


  toast(
    "Export prepared"
  );

}


// =====================================================
// REPORTS
// =====================================================

function report(type) {

  if (
    type === "historical"
  ) {

    exportCSV(
      historicalProjects,
      "paimana_historical_projects.csv"
    );

    return;

  }


  if (
    type === "cost"
  ) {

    exportCSV(

      projects.map(
        project => ({

          project:
            project.name,

          sector:
            project.sector,

          original_cost:
            project.original,

          current_cost:
            project.current,

          physical_progress:
            project.physical,

          financial_progress:
            project.financial

        })
      ),

      "paimana_cost_snapshot.csv"

    );

    return;

  }


  if (
    type === "schedule"
  ) {

    exportCSV(

      projects.map(
        project => ({

          project:
            project.name,

          sector:
            project.sector,

          delay_risk:
            project.delayRisk,

          physical_progress:
            project.physical,

          overall_risk:
            project.risk

        })
      ),

      "paimana_schedule_snapshot.csv"

    );

    return;

  }


  exportCSV(

    projects.map(
      project => ({

        project:
          project.name,

        sector:
          project.sector,

        state:
          project.state,

        risk:
          project.risk,

        cost_risk:
          project.costRisk,

        delay_risk:
          project.delayRisk,

        level:
          project.level

      })
    ),

    "paimana_risk_snapshot.csv"

  );

}


// =====================================================
// TOAST
// =====================================================

function toast(message) {

  const element =
    $("#toast");


  if (!element) {

    return;

  }


  element.textContent =
    message;


  element.classList.add(
    "show"
  );


  clearTimeout(
    window.__toast
  );


  window.__toast =

    setTimeout(
      () =>
        element.classList.remove(
          "show"
        ),
      2200
    );

}


// =====================================================
// RESET PROJECT FILTERS
// =====================================================

function resetProjectFilters() {

  if ($("#projectSearch")) {

    $("#projectSearch").value =
      "";

  }


  if ($("#projectRisk")) {

    $("#projectRisk").value =
      "all";

  }


  if ($("#projectSector")) {

    $("#projectSector").value =
      "all";

  }


  renderProjectTable();

}


// =====================================================
// RENDER EVERYTHING
// =====================================================

function renderAll() {

  /*
    Dashboard
  */

  renderDashboardKPIs();

  renderRiskDistribution();

  renderSectorBars();

  renderRiskTable();

  renderDashboardWarnings();

  renderPortfolioInsight();


  /*
    Project pages
  */

  renderProjectTable();

  renderProgress();

  renderCost();

  renderSchedule();


  /*
    Risk
  */

  renderRiskAnalytics();


  /*
    Historical
  */

  renderHistorical();


  /*
    Monitoring
  */

  renderWarnings();

  renderSectorPage();

}


// =====================================================
// EVENTS
// =====================================================

function setupEvents() {


  // Sidebar navigation

  $$(".nav-item").forEach(
    button => {

      button.addEventListener(
        "click",
        () =>
          showPage(
            button.dataset.page
          )
      );

    }
  );


  // Internal page links

  $$("[data-page-link]").forEach(
    button => {

      button.addEventListener(
        "click",
        () =>
          showPage(
            button.dataset.pageLink
          )
      );

    }
  );


  // Mobile sidebar

  $("#mobileMenu")?.addEventListener(
    "click",
    () =>
      $("#sidebar")?.classList.toggle(
        "open"
      )
  );


  // Notifications

  $("#notifyBtn")?.addEventListener(
    "click",
    () =>
      showPage("warnings")
  );


  // Refresh

  $("#refreshBtn")?.addEventListener(
    "click",
    async () => {

      toast(
        "Refreshing July 2026 data..."
      );

      await loadBackendData();

    }
  );


  // Dashboard export

  $("#exportBtn")?.addEventListener(
    "click",
    () =>
      report("risk")
  );


  // Project filters

  $("#projectSearch")
    ?.addEventListener(
      "input",
      filterProjects
    );


  $("#projectRisk")
    ?.addEventListener(
      "change",
      filterProjects
    );


  $("#projectSector")
    ?.addEventListener(
      "change",
      filterProjects
    );


  $("#projectReset")
    ?.addEventListener(
      "click",
      resetProjectFilters
    );


  // Sector chart selector

  $("#sectorMetric")
    ?.addEventListener(
      "change",
      event =>
        renderSectorBars(
          event.target.value
        )
    );


  // Historical filters

  $("#historicalSearch")
    ?.addEventListener(
      "input",
      filterHistorical
    );


  $("#historicalSector")
    ?.addEventListener(
      "change",
      filterHistorical
    );


  // Historical pagination

  $("#histPrev")
    ?.addEventListener(
      "click",
      () => {

        if (
          historicalPage > 1
        ) {

          historicalPage--;

          renderHistoricalTable();

        }

      }
    );


  $("#histNext")
    ?.addEventListener(
      "click",
      () => {

        const pages =

          Math.max(
            1,
            Math.ceil(
              historicalFiltered.length /
              HIST_PAGE_SIZE
            )
          );


        if (
          historicalPage < pages
        ) {

          historicalPage++;

          renderHistoricalTable();

        }

      }
    );


  // AI chat

  $("#chatForm")
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();


        const input =
          $("#chatInput");


        const question =
          input?.value.trim();


        if (!question) {

          return;

        }


        addMessage(
          question,
          true
        );


        input.value =
          "";


        setTimeout(
          () =>
            addMessage(
              localAI(question)
            ),
          200
        );

      }
    );


  // AI suggestion buttons

  $$(".suggestions button")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const input =
              $("#chatInput");


            input.value =
              button.dataset.prompt;


            $("#chatForm")
              ?.requestSubmit();

          }
        );

      }
    );


  // Reports

  $("#reportBtn")
    ?.addEventListener(
      "click",
      () =>
        report("risk")
    );


  $$(".report-action")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            report(
              button.dataset.report
            )
        );

      }
    );

}


// =====================================================
// INITIALIZE
// =====================================================

async function init() {

  setupEvents();

  await loadBackendData();

}


init();