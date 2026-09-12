const API_BASE =
  window.PAIMANA_API_BASE ||
  "http://127.0.0.1:8000";


const GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@2884453/geojson/india.geojson";



/* =====================================================
   MONTH CONFIG
===================================================== */

const MONTH_LABELS = {

  Jan_2026: "January 2026",

  Feb_2026: "February 2026",

  March_2026: "March 2026",

  April_2026: "April 2026",

  May_2026: "May 2026",

  June_2026: "June 2026",

  July_2026: "July 2026"

};



let months = [];

let currentMonth = "";

let allRows = [];

let filteredRows = [];


let charts = {};

let map = null;

let mapLayer = null;

let mapReady = false;


let selectedMapState = null;

let statewiseData = [];
let statewiseLoadedMonth = "";


let selectedMinistry =
  "All Ministries";


let selectedSector =
  "All Sectors";


let ministryOffset = 0;

let sectorOffset = 0;


let accessibilityStep = 0;



/* =====================================================
   HELPERS
===================================================== */

const $ = (selector) =>
  document.querySelector(selector);


const $$ = (selector) =>
  document.querySelectorAll(selector);


const num = (value) => {

  const n =
    Number(
      String(value ?? "")
        .replace(/,/g, "")
    );

  return Number.isFinite(n)
    ? n
    : 0;
};


const esc = (value) =>
  String(value ?? "")
    .replace(
      /[&<>\"']/g,
      (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[c])
    );


const fmt = (
  value,
  digits = 1
) =>
  new Intl.NumberFormat(
    "en-IN",
    {
      maximumFractionDigits:
        digits,

      minimumFractionDigits: 0
    }
  ).format(num(value));


const money = (value) =>
  `₹ ${fmt(value)} Cr`;

function toast(message) {
  const element = $("#toast");

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(window.paimanaToastTimer);

  window.paimanaToastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2500);
}


function labelMonth(month) {

  return (
    MONTH_LABELS[month] ||
    String(month || "")
      .replace("_", " ") ||
    "—"
  );

}





/* =====================================================
   DATA FIELD NORMALIZATION
===================================================== */

function pick(
  row,
  keys,
  fallback = ""
) {

  for (const key of keys) {

    if (
      row &&
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {

      return row[key];

    }

  }

  return fallback;

}



/* =====================================================
   STATE NORMALIZATION
===================================================== */

function normalizeState(value) {

  const raw =
    String(value || "").trim();


  const aliases = {

    "jammu & kashmir":
      "Jammu and Kashmir",

    "jammu and kashmir":
      "Jammu and Kashmir",

    "nct of delhi":
      "Delhi",

    "orissa":
      "Odisha",

    "uttaranchal":
      "Uttarakhand"

  };


  return (
    aliases[raw.toLowerCase()] ||
    raw
  );

}



function getState(row) {

  const direct =
    pick(
      row,
      [
        "state",
        "state_name",
        "state_ut",
        "state/ut",
        "State",
        "State Name",
        "STATE"
      ]
    );


  if (direct) {

    return normalizeState(direct);

  }


  /*
   * Fallback only when the state is
   * actually visible inside project text.
   */

  const text =
    String(
      pick(
        row,
        [
          "project_name",
          "Project Name"
        ],
        ""
      )
    );


  const states = [

    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Chandigarh",
    "Puducherry",
    "Andaman and Nicobar Islands"

  ];


  const lower =
    text.toLowerCase();


  return normalizeState(

    states.find(
      (state) =>
        lower.includes(
          state.toLowerCase()
        )
    ) ||
    "Other / Not detected"

  );

}



/* =====================================================
   NORMALIZE MONTHLY PROJECT DATA
===================================================== */

function normalizeRow(row) {

  const original =
    num(
      pick(
        row,
        [
          "original_cost",
          "original_cost_cr",
          "sanctioned_cost",
          "Original Cost"
        ],
        0
      )
    );


  const revised =
    num(
      pick(
        row,
        [
          "revised_cost",
          "latest_revised_cost",
          "current_cost",
          "revised_cost_cr",
          "Revised Cost"
        ],
        original
      )
    );


  const expenditure =
    num(
      pick(
        row,
        [
          "expenditure",
          "expenditure_cumulative",
          "cumulative_expenditure",
          "Expenditure"
        ],
        0
      )
    );


  const physical =
    num(
      pick(
        row,
        [
          "physical_progress",
          "physical_progress_pct",
          "physical_progress_percentage",
          "Physical Progress"
        ],
        0
      )
    );


  const suppliedFinancial =
    pick(
      row,
      [
        "financial_progress",
        "financial_progress_pct",
        "financial_progress_percentage",
        "Financial Progress"
      ],
      null
    );


  const financial =
    suppliedFinancial !== null
      ? num(suppliedFinancial)
      : (
          original > 0
            ? Math.min(
                100,
                (expenditure / original) * 100
              )
            : 0
        );


  const current =
    revised > 0
      ? revised
      : original;


  const costGrowth =
    original > 0
      ? (
          (current - original) /
          original
        ) * 100
      : 0;


  const gap =
    physical - financial;


  /*
   * Same rule structure as
   * services/risk_engine.py
   */

  const costRisk =
    costGrowth >= 20
      ? 90
      : costGrowth >= 10
        ? 70
        : costGrowth >= 5
          ? 40
          : 20;


  const delayRisk =
    gap <= -10
      ? 90
      : gap <= -5
        ? 70
        : gap <= 0
          ? 50
          : 30;


  const risk =
    Math.round(
      costRisk * 0.4 +
      delayRisk * 0.6
    );


  const level =
    risk >= 75
      ? "High"
      : risk >= 40
        ? "Medium"
        : "Low";


  return {

    ...row,

    project_id:
      pick(
        row,
        [
          "project_id",
          "project_code",
          "Project ID",
          "Project Code"
        ],
        "—"
      ),

    project_code:
      pick(
        row,
        [
          "project_code",
          "project_id",
          "Project Code",
          "Project ID"
        ],
        "—"
      ),

    project_name:
      pick(
        row,
        [
          "project_name",
          "Project Name",
          "name"
        ],
        "Unnamed project"
      ),

    line_ministry:
      pick(
        row,
        [
          "line_ministry",
          "ministry",
          "Ministry",
          "Line Ministry"
        ],
        "Not specified"
      ),

    sector:
      pick(
        row,
        [
          "sector",
          "Sector"
        ],
        "Other"
      ),

    state:
      getState(row),

    original_cost:
      original,

    current_cost:
      current,

    revised_cost:
      revised,

    expenditure:
      expenditure,

    physical_progress:
      physical,

    financial_progress:
      financial,

    cost_growth:
      costGrowth,

    cost_risk:
      costRisk,

    delay_risk:
      delayRisk,

    risk:
      risk,

    level:
      level

  };

}



/* =====================================================
   API
===================================================== */

async function fetchJSON(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      options
    );


  if (!response.ok) {

    throw new Error(
      `${response.status} ${response.statusText}`
    );

  }


  return response.json();

}



async function fetchMonth(month) {

  let page = 1;

  const rows = [];


  while (true) {

    const data =
      await fetchJSON(
        `${API_BASE}/paimana-projects/?month=${encodeURIComponent(month)}&page=${page}&limit=100`
      );


    const pageRows =
      Array.isArray(data.projects)
        ? data.projects
        : [];


    rows.push(
      ...pageRows
    );


    if (
      !pageRows.length ||
      page >= num(data.total_pages)
    ) {

      break;

    }


    page += 1;

  }


  return rows.map(
    normalizeRow
  );

}

/* =====================================================
   STATEWISE JULY 2026 DATA
===================================================== */

async function fetchStatewiseData(month) {

  try {

    const url =
      `${API_BASE}/project-monitoring/state?month=${encodeURIComponent(month)}`;

    console.log(
      "Fetching statewise data:",
      url
    );

    const data =
      await fetchJSON(url);

    console.log(
      "STATEWISE BACKEND RESPONSE:",
      data
    );


    let states = [];

    if (Array.isArray(data)) {

      states = data;

    }
    else if (Array.isArray(data.states)) {

      states = data.states;

    }
    else if (Array.isArray(data.data)) {

      states = data.data;

    }


    statewiseData =
      states.map((item) => ({

        ...item,

        state:
          item.state ||
          item.state_name ||
          item.stateName ||
          item["State"] ||
          item["State Name"] ||
          item["State Wise Details"] ||
          ""

      }));


    statewiseLoadedMonth =
      month;


    console.log(
      "STATEWISE DATA LOADED:",
      statewiseData.length,
      statewiseData
    );


    return statewiseData;


  } catch (error) {

    console.error(
      "Statewise data loading failed:",
      error
    );

    statewiseData = [];

    statewiseLoadedMonth = "";

    return [];

  }

}


/* =====================================================
   STATEWISE LOOKUP
===================================================== */

function getStatewiseStat(state) {

  const normalized =
    normalizeState(state)
      .trim()
      .toLowerCase();

  if (!statewiseData || !statewiseData.length) {
    return null;
  }

  return (
    statewiseData.find((item) => {

      const itemState =
        normalizeState(
          item.state ||
          item.state_name ||
          item.stateName ||
          item["State"] ||
          item["State Name"] ||
          item["State Wise Details"] ||
          ""
        )
        .trim()
        .toLowerCase();

      return itemState === normalized;

    }) || null
  );

}



/* =====================================================
   RISK BADGE
===================================================== */

function riskBadge(project) {

  return `
    <span class="risk-badge risk-${project.level.toLowerCase()}">
      <i></i>
      ${project.risk}/100 · ${project.level}
    </span>
  `;

}



/* =====================================================
   FILTER
===================================================== */

function getFilteredRows() {

  let rows =
    [...allRows];


  const sector =
    $("#globalSector")?.value ||
    "all";


  const risk =
    $("#globalRisk")?.value ||
    "all";


  if (sector !== "all") {

    rows =
      rows.filter(
        (p) =>
          p.sector === sector
      );

  }


  if (risk !== "all") {

    rows =
      rows.filter(
        (p) =>
          p.level.toLowerCase() ===
          risk
      );

  }


  return rows;

}



/* =====================================================
   AGGREGATION
===================================================== */

function aggregate(
  rows,
  key
) {

  const groups = {};


  rows.forEach(
    (project) => {

      const groupKey =
        project[key] ||
        "Other";


      if (!groups[groupKey]) {

        groups[groupKey] = {

          key:
            groupKey,

          count:
            0,

          original:
            0,

          revised:
            0,

          expenditure:
            0,

          physical:
            0,

          risk:
            0,

          high:
            0,

          medium:
            0,

          low:
            0

        };

      }


      const group =
        groups[groupKey];


      group.count += 1;

      group.original +=
        project.original_cost;

      group.revised +=
        project.current_cost;

      group.expenditure +=
        project.expenditure;

      group.physical +=
        project.physical_progress;

      group.risk +=
        project.risk;


      group[
        project.level.toLowerCase()
      ] += 1;

    }
  );


  return Object.values(groups)

    .map(
      (group) => ({

        ...group,

        avgPhysical:
          group.count
            ? group.physical /
              group.count
            : 0,

        avgRisk:
          group.count
            ? group.risk /
              group.count
            : 0

      })
    )

    .sort(
      (a, b) =>
        b.count - a.count
    );

}



/* =====================================================
   OVERALL STATS
===================================================== */

function overallStats(rows) {

  const count =
    rows.length;


  return {

    count,

    original:
      rows.reduce(
        (sum, p) =>
          sum + p.original_cost,
        0
      ),

    revised:
      rows.reduce(
        (sum, p) =>
          sum + p.current_cost,
        0
      ),

    expenditure:
      rows.reduce(
        (sum, p) =>
          sum + p.expenditure,
        0
      ),

    avgPhysical:
      count
        ? rows.reduce(
            (sum, p) =>
              sum +
              p.physical_progress,
            0
          ) / count
        : 0,

    avgRisk:
      count
        ? rows.reduce(
            (sum, p) =>
              sum + p.risk,
            0
          ) / count
        : 0

  };

}



/* =====================================================
   CHART HELPERS
===================================================== */

function destroyChart(id) {

  if (charts[id]) {

    charts[id].destroy();

    delete charts[id];

  }

}



function makeChart(
  id,
  type,
  data,
  options = {}
) {

  destroyChart(id);


  const canvas =
    $(id);


  if (
    !canvas ||
    typeof Chart ===
      "undefined"
  ) {

    return;

  }


  charts[id] =
    new Chart(
      canvas,
      {

        type,

        data,

        options: {

          responsive: true,

          maintainAspectRatio:
            false,

          interaction: {

            mode: "index",

            intersect: false

          },

          plugins: {

            legend: {

              position: "bottom",

              labels: {

                boxWidth: 10,

                font: {
                  size: 10
                }

              }

            },

            tooltip: {

              callbacks: {

                label: (ctx) =>

                  `${
                    ctx.dataset.label
                      ? ctx.dataset.label +
                        ": "
                      : ""
                  }${fmt(ctx.raw)}`

              }

            }

          },

          ...options

        }

      }
    );

}



/* =====================================================
   DASHBOARD CHARTS
===================================================== */

function renderDashboardCharts(rows) {

  const sectors =
    aggregate(
      rows,
      "sector"
    ).slice(0, 10);


  makeChart(
    "#sectorChart",
    "doughnut",
    {

      labels:
        sectors.map(
          (x) => x.key
        ),

      datasets: [

        {

          label:
            "Projects",

          data:
            sectors.map(
              (x) => x.count
            ),

          backgroundColor: [

            "#17395b",
            "#4e8a62",
            "#e7a51a",
            "#d86f50",
            "#5871b5",
            "#8b62a9",
            "#d36b9b",
            "#6ea7c4",
            "#83966e",
            "#8b95a0"

          ],

          borderWidth:
            2,

          borderColor:
            "#fff"

        }

      ]

    },

    {

      plugins: {

        legend: {

          position:
            "right"

        }

      }

    }

  );



  const stats =
    overallStats(rows);


  makeChart(
    "#costChart",
    "bar",
    {

      labels: [

        "Original Cost",

        "Revised / Current",

        "Expenditure"

      ],

      datasets: [

        {

          label:
            "₹ Cr",

          data: [

            stats.original,

            stats.revised,

            stats.expenditure

          ],

          backgroundColor: [

            "#182d57",
            "#284795",
            "#7082bb"

          ],

          borderRadius:
            4,

          maxBarThickness:
            72

        }

      ]

    },

    {

      plugins: {

        legend: {
          display: false
        }

      },

      scales: {

        y: {

          beginAtZero:
            true,

          ticks: {

            callback:
              (v) =>
                `₹${fmt(v)}`

          }

        }

      }

    }

  );



  const bands = [

    "< 20",

    "20–40",

    "40–60",

    "60–80",

    "≥ 80"

  ];


  const bandCounts = [
    0,
    0,
    0,
    0,
    0
  ];


  rows.forEach(
    (project) => {

      const value =
        project.physical_progress;


      const index =
        value < 20
          ? 0
          : value < 40
            ? 1
            : value < 60
              ? 2
              : value < 80
                ? 3
                : 4;


      bandCounts[index] += 1;

    }
  );


  makeChart(
    "#progressChart",
    "bar",
    {

      labels:
        bands,

      datasets: [

        {

          label:
            "Projects",

          data:
            bandCounts,

          backgroundColor: [

            "#9fe59f",
            "#8dcc8d",
            "#79ae7a",
            "#5e8662",
            "#48634e"

          ],

          borderRadius:
            3,

          maxBarThickness:
            55

        }

      ]

    },

    {

      plugins: {

        legend: {
          display: false
        }

      },

      scales: {

        y: {

          beginAtZero:
            true,

          ticks: {
            precision: 0
          }

        }

      }

    }

  );



  const states =
    aggregate(
      rows,
      "state"
    )

      .filter(
        (x) =>
          x.key !==
          "Other / Not detected"
      )

      .slice(0, 18);


  makeChart(
    "#stateChart",
    "doughnut",
    {

      labels:
        states.map(
          (x) => x.key
        ),

      datasets: [

        {

          label:
            "Projects",

          data:
            states.map(
              (x) => x.count
            ),

          backgroundColor: [

            "#2f4c78",
            "#5aa05b",
            "#efb44c",
            "#df795c",
            "#6c6fd0",
            "#6f59b2",
            "#d85f9a",
            "#72a8c8",
            "#7ca06c",
            "#8995a4",
            "#b16d6d",
            "#5f91b7",
            "#8b76c2",
            "#d68b55",
            "#638d74",
            "#a67a9b",
            "#6e8b9e",
            "#9a9a62"

          ],

          borderWidth:
            2,

          borderColor:
            "#fff"

        }

      ]

    },

    {

      plugins: {

        legend: {

          position:
            "right",

          labels: {

            font: {
              size: 9
            }

          }

        }

      }

    }

  );

}



/* =====================================================
   CHART DATA TABLES
===================================================== */

function renderDashboardDataTables(rows) {

  const sectorData =
    aggregate(
      rows,
      "sector"
    );


  const stateData =
    aggregate(
      rows,
      "state"
    );


  const stats =
    overallStats(rows);


  $("#sectorDataBody")
    .innerHTML =

    sectorData

      .map(
        (x) => `

          <tr>

            <td>
              ${esc(x.key)}
            </td>

            <td>
              ${x.count}
            </td>

            <td>
              ${money(x.revised)}
            </td>

            <td>
              ${fmt(x.avgPhysical)}%
            </td>

            <td>
              ${fmt(x.avgRisk)}
            </td>

          </tr>

        `
      )

      .join("")

      ||
      emptyRow(5);



  $("#costDataBody")
    .innerHTML =

    [

      [
        "Original Cost",
        stats.original
      ],

      [
        "Revised / Current",
        stats.revised
      ],

      [
        "Expenditure",
        stats.expenditure
      ]

    ]

      .map(
        ([label, value]) => `

          <tr>

            <td>
              ${label}
            </td>

            <td>
              ${money(value)}
            </td>

          </tr>

        `
      )

      .join("");



  $("#progressDataBody")
    .innerHTML =

    [

      [
        "< 20",
        rows.filter(
          (p) =>
            p.physical_progress < 20
        ).length
      ],

      [
        "20–40",
        rows.filter(
          (p) =>
            p.physical_progress >= 20 &&
            p.physical_progress < 40
        ).length
      ],

      [
        "40–60",
        rows.filter(
          (p) =>
            p.physical_progress >= 40 &&
            p.physical_progress < 60
        ).length
      ],

      [
        "60–80",
        rows.filter(
          (p) =>
            p.physical_progress >= 60 &&
            p.physical_progress < 80
        ).length
      ],

      [
        "≥ 80",
        rows.filter(
          (p) =>
            p.physical_progress >= 80
        ).length
      ]

    ]

      .map(
        ([band, count]) => `

          <tr>

            <td>
              ${band}
            </td>

            <td>
              ${count}
            </td>

          </tr>

        `
      )

      .join("");



  $("#stateDataBody")
    .innerHTML =

    stateData

      .map(
        (x) => `

          <tr>

            <td>
              ${esc(x.key)}
            </td>

            <td>
              ${x.count}
            </td>

            <td>
              ${fmt(x.avgPhysical)}%
            </td>

            <td>
              ${fmt(x.avgRisk)}
            </td>

          </tr>

        `
      )

      .join("")

      ||
      emptyRow(4);

}



function emptyRow(colspan) {

  return `

    <tr>

      <td
        colspan="${colspan}"
        class="empty"
      >
        No data available.
      </td>

    </tr>

  `;

}



/* =====================================================
   KPI
===================================================== */

function renderKPIs(rows) {

  const stats =
    overallStats(rows);


  const high =
    rows.filter(
      (p) =>
        p.level === "High"
    ).length;


  const delay =
    rows.filter(
      (p) =>
        p.delay_risk >= 70
    ).length;


  $("#kpiProjects")
    .textContent =
      fmt(
        rows.length,
        0
      );


  $("#kpiHigh")
    .textContent =
      fmt(
        high,
        0
      );


  $("#kpiCost")
    .textContent =
      money(
        stats.revised
      );


  $("#kpiDelay")
    .textContent =
      fmt(
        delay,
        0
      );


  $("#kpiProgress")
    .textContent =
      `${fmt(stats.avgPhysical)}%`;


  const top =
    [...rows]
      .sort(
        (a, b) =>
          b.risk - a.risk
      )[0];


  $("#summaryText")
    .textContent =

      rows.length

        ? `${high} high-risk projects and ${delay} elevated delay-risk projects are present in ${labelMonth(currentMonth)}. ${
            top
              ? `Highest current risk: ${top.project_name}.`
              : ""
          }`

        : "No projects match the selected filters.";

}



/* =====================================================
   IMPORTANT PROJECTS
===================================================== */

function renderImportant(rows) {

  const list =
    [...rows]
      .sort(
        (a, b) =>
          b.risk - a.risk
      )
      .slice(0, 8);


  $("#importantProjects")
    .innerHTML =

      list

        .map(
          (p) => `

            <tr
              class="project-row"
              data-project-id="${esc(p.project_id)}"
            >

              <td>

                <div class="project-name">

                  ${esc(p.project_name)}

                  <small>
                    ID ${esc(p.project_code)}
                  </small>

                </div>

              </td>


              <td>
                ${esc(p.sector)}
              </td>


              <td>
                ${esc(p.state)}
              </td>


              <td>
                ${fmt(p.physical_progress)}%
              </td>


              <td>
                ${
                  p.cost_growth >= 0
                    ? "+"
                    : ""
                }${fmt(p.cost_growth)}%
              </td>


              <td>
                ${riskBadge(p)}
              </td>

            </tr>

          `
        )

        .join("")

        ||
        emptyRow(6);


  bindProjectRows(
    $("#importantProjects")
  );

}



/* =====================================================
   PROJECT CLICK
===================================================== */

function bindProjectRows(
  container
) {

  if (!container) return;


  container
    .querySelectorAll(
      ".project-row"
    )
    .forEach(
      (row) => {

        row.addEventListener(
          "click",
          () => {

            const project =
              allRows.find(
                (p) =>
                  String(
                    p.project_id
                  ) ===
                  String(
                    row.dataset.projectId
                  )
              );


            if (project) {

              openProjectModal(
                project
              );

            }

          }
        );

      }
    );

}



/* =====================================================
   SELECTORS
===================================================== */

function populateSelectors() {

  const sectors =
    [
      ...new Set(
        allRows
          .map(
            (p) => p.sector
          )
          .filter(Boolean)
      )
    ].sort();


  [
    "globalSector",
    "projectSector"
  ].forEach(
    (id) => {

      const select =
        $("#" + id);


      if (!select) return;


      const old =
        select.value;


      select.innerHTML =

        `
          <option value="all">
            All Sectors
          </option>
        ` +

        sectors
          .map(
            (sector) => `

              <option
                value="${esc(sector)}"
              >
                ${esc(sector)}
              </option>

            `
          )
          .join("");


      if (
        sectors.includes(old)
      ) {

        select.value =
          old;

      }

    }
  );

}



/* =====================================================
   PROJECT TABLE
===================================================== */

function renderProjectTable(rows) {

  const search =
    (
      $("#projectSearch")
        ?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const sector =
    $("#projectSector")
      ?.value ||
    "all";


  const risk =
    $("#projectRisk")
      ?.value ||
    "all";


  const list =
    rows.filter(
      (p) => {

        const haystack =

          `${p.project_name} ${p.project_code} ${p.state} ${p.line_ministry}`
            .toLowerCase();


        return (

          (!search ||
            haystack.includes(
              search
            ))

          &&

          (
            sector === "all" ||
            p.sector === sector
          )

          &&

          (
            risk === "all" ||
            p.level.toLowerCase() ===
              risk
          )

        );

      }
    );


  $("#projectCountLabel")
    .textContent =
      fmt(
        list.length,
        0
      );


  $("#projectTable")
    .innerHTML =

      list
        .slice(0, 500)

        .map(
          (p) => `

            <tr
              class="project-row"
              data-project-id="${esc(p.project_id)}"
            >

              <td>

                <div class="project-name">

                  ${esc(p.project_name)}

                  <small>
                    ${esc(p.project_code)}
                  </small>

                </div>

              </td>


              <td>
                ${esc(p.line_ministry)}
              </td>


              <td>
                ${esc(p.sector)}
              </td>


              <td>
                ${esc(p.state)}
              </td>


              <td>
                ${money(p.original_cost)}
              </td>


              <td>
                ${money(p.current_cost)}
              </td>


              <td>
                ${fmt(p.physical_progress)}%
              </td>


              <td>
                ${riskBadge(p)}
              </td>

            </tr>

          `
        )

        .join("")

        ||
        emptyRow(8);


  bindProjectRows(
    $("#projectTable")
  );

}



/* =====================================================
   RISK PAGE
===================================================== */

function renderRiskPage(rows) {

  const high =
    rows.filter(
      (p) =>
        p.level === "High"
    ).length;


  const medium =
    rows.filter(
      (p) =>
        p.level === "Medium"
    ).length;


  const low =
    rows.length -
    high -
    medium;


  $("#riskHighCount")
    .textContent =
      fmt(
        high,
        0
      );


  $("#riskMediumCount")
    .textContent =
      fmt(
        medium,
        0
      );


  $("#riskLowCount")
    .textContent =
      fmt(
        low,
        0
      );


  const states =
    aggregate(
      rows,
      "state"
    )
      .filter(
        (x) =>
          x.key !==
          "Other / Not detected"
      );


  $("#topRiskState")
    .textContent =

      states.sort(
        (a, b) =>
          b.avgRisk -
          a.avgRisk
      )[0]?.key ||
      "—";


  $("#riskTable")
    .innerHTML =

      [...rows]

        .sort(
          (a, b) =>
            b.risk -
            a.risk
        )

        .slice(0, 300)

        .map(
          (p) => `

            <tr
              class="project-row"
              data-project-id="${esc(p.project_id)}"
            >

              <td>

                <div class="project-name">

                  ${esc(p.project_name)}

                  <small>
                    ${esc(p.project_code)}
                  </small>

                </div>

              </td>


              <td>
                ${esc(p.state)}
              </td>


              <td>
                ${esc(p.sector)}
              </td>


              <td>
                ${fmt(p.cost_risk)}
              </td>


              <td>
                ${fmt(p.delay_risk)}
              </td>


              <td>
                ${riskBadge(p)}
              </td>


              <td>

                ${
                  esc(
                    p.cost_growth >= 10
                      ? `Cost increased ${p.cost_growth.toFixed(1)}%`
                      : p.financial_progress <
                          p.physical_progress
                        ? "Financial progress trails physical progress"
                        : "No major indicator"
                  )
                }

              </td>

            </tr>

          `
        )

        .join("")

        ||
        emptyRow(7);


  bindProjectRows(
    $("#riskTable")
  );

}



/* =====================================================
   MINI KPIs
===================================================== */

function makeMiniKpis(
  target,
  stats
) {

  $(target)
    .innerHTML =

      [

        [
          "Projects",
          fmt(
            stats.count,
            0
          )
        ],

        [
          "Original",
          money(
            stats.original
          )
        ],

        [
          "Revised",
          money(
            stats.revised
          )
        ],

        [
          "Avg Progress",
          `${fmt(
            stats.avgPhysical
          )}%`
        ],

        [
          "Avg Risk",
          fmt(
            stats.avgRisk
          )
        ]

      ]

        .map(
          ([label, value]) => `

            <div class="mini-kpi">

              <span>
                ${label}
              </span>

              <strong>
                ${value}
              </strong>

            </div>

          `
        )

        .join("");

}



/* =====================================================
   MINISTRY / SECTOR CHOICE DATA
===================================================== */

function getMinistryItems(rows) {

  return [

    "All Ministries",

    ...aggregate(
      rows,
      "line_ministry"
    )
      .map(
        (x) => x.key
      )
      .sort()

  ];

}



function getSectorItems(rows) {

  return [

    "All Sectors",

    ...aggregate(
      rows,
      "sector"
    )
      .map(
        (x) => x.key
      )
      .sort()

  ];

}



/* =====================================================
   SLIDER
===================================================== */

function renderChoiceSlider(
  type,
  rows
) {

  const isMinistry =
    type === "ministry";


  const items =
    isMinistry
      ? getMinistryItems(rows)
      : getSectorItems(rows);


  const offset =
    isMinistry
      ? ministryOffset
      : sectorOffset;


  const selected =
    isMinistry
      ? selectedMinistry
      : selectedSector;


  const visible =

    items.length <= 5

      ? items

      : Array.from(
          {
            length:
              Math.min(
                5,
                items.length
              )
          },
          (_, i) =>
            items[
              offset + i
            ]
        );


  const container =

    $(
      isMinistry
        ? "#ministryChoices"
        : "#sectorChoices"
    );


  container.innerHTML =

    visible

      .map(
        (item) => `

          <button
            class="choice-item ${
              item === selected
                ? "active"
                : ""
            }"
            data-value="${esc(item)}"
          >
            ${esc(item)}
          </button>

        `
      )

      .join("");


  container
    .querySelectorAll(
      "button"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            if (isMinistry) {

              selectedMinistry =
                button.dataset.value;

            } else {

              selectedSector =
                button.dataset.value;

            }


            renderAnalysisPage(
              rows
            );

          }
        );

      }
    );


  const prev =
    $(
      isMinistry
        ? "#ministryPrev"
        : "#sectorPrev"
    );


  const next =
    $(
      isMinistry
        ? "#ministryNext"
        : "#sectorNext"
    );


  const position =
    $(
      isMinistry
        ? "#ministryPosition"
        : "#sectorPosition"
    );


  prev.disabled =
    items.length <= 5;


  next.disabled =
    items.length <= 5;


  position.textContent =

    items.length

      ? `${Math.min(
          offset + 1,
          items.length
        )} / ${items.length}`

      : "0 / 0";

}



/* =====================================================
   MINISTRY DETAIL
===================================================== */

function renderMinistryDetail(
  rows
) {

  const list =

    selectedMinistry ===
    "All Ministries"

      ? rows

      : rows.filter(
          (p) =>
            p.line_ministry ===
            selectedMinistry
        );


  $("#ministryTitle")
    .textContent =
      selectedMinistry;


  makeMiniKpis(
    "#ministryKpis",
    overallStats(list)
  );


  const sectors =
    aggregate(
      list,
      "sector"
    );


  $("#ministrySectorTable")
    .innerHTML =

      sectors

        .map(
          (x) => `

            <tr>

              <td>
                ${esc(x.key)}
              </td>

              <td>
                ${x.count}
              </td>

              <td>
                ${money(x.original)}
              </td>

              <td>
                ${money(x.revised)}
              </td>

              <td>
                ${fmt(
                  x.avgPhysical
                )}%
              </td>

              <td>
                ${fmt(
                  x.avgRisk
                )}
              </td>

            </tr>

          `
        )

        .join("")

        ||
        emptyRow(6);


  makeChart(
    "#ministrySectorChart",
    "bar",
    {

      labels:
        sectors
          .slice(0, 12)
          .map(
            (x) =>
              x.key
          ),

      datasets: [

        {

          label:
            "Projects",

          data:
            sectors
              .slice(0, 12)
              .map(
                (x) =>
                  x.count
              ),

          backgroundColor:
            "#315b7e",

          borderRadius:
            4

        }

      ]

    },

    {

      plugins: {

        legend: {
          display: false
        }

      },

      scales: {

        y: {

          beginAtZero:
            true,

          ticks: {
            precision: 0
          }

        }

      }

    }

  );

}



/* =====================================================
   SECTOR DETAIL
===================================================== */

function renderSectorDetail(
  rows
) {

  const list =

    selectedSector ===
    "All Sectors"

      ? rows

      : rows.filter(
          (p) =>
            p.sector ===
            selectedSector
        );


  $("#sectorTitle")
    .textContent =
      selectedSector;


  makeMiniKpis(
    "#sectorKpis",
    overallStats(list)
  );


  const riskCounts = [

    list.filter(
      (p) =>
        p.level === "High"
    ).length,

    list.filter(
      (p) =>
        p.level === "Medium"
    ).length,

    list.filter(
      (p) =>
        p.level === "Low"
    ).length

  ];


  makeChart(
    "#sectorRiskChart",
    "doughnut",
    {

      labels: [
        "High",
        "Medium",
        "Low"
      ],

      datasets: [

        {

          data:
            riskCounts,

          backgroundColor: [

            "#c73545",
            "#d9a116",
            "#2f8f59"

          ],

          borderColor:
            "#fff",

          borderWidth:
            2

        }

      ]

    }
  );


  const ministries =
    aggregate(
      list,
      "line_ministry"
    );


  $("#sectorMinistryTable")
    .innerHTML =

      ministries

        .map(
          (x) => `

            <tr>

              <td>
                ${esc(x.key)}
              </td>

              <td>
                ${x.count}
              </td>

              <td>
                ${money(
                  x.original
                )}
              </td>

              <td>
                ${money(
                  x.revised
                )}
              </td>

              <td>
                ${fmt(
                  x.avgPhysical
                )}%
              </td>

              <td>
                ${fmt(
                  x.avgRisk
                )}
              </td>

            </tr>

          `
        )

        .join("")

        ||
        emptyRow(6);

}



/* =====================================================
   ANALYSIS PAGE
===================================================== */

function renderAnalysisPage(
  rows
) {

  const ministryItems =
    getMinistryItems(
      rows
    );


  const sectorItems =
    getSectorItems(
      rows
    );


  if (
    !ministryItems.includes(
      selectedMinistry
    )
  ) {

    selectedMinistry =
      "All Ministries";

  }


  if (
    !sectorItems.includes(
      selectedSector
    )
  ) {

    selectedSector =
      "All Sectors";

  }


  ministryOffset =
    Math.min(
      ministryOffset,
      Math.max(
        0,
        ministryItems.length - 1
      )
    );


  sectorOffset =
    Math.min(
      sectorOffset,
      Math.max(
        0,
        sectorItems.length - 1
      )
    );


  renderChoiceSlider(
    "ministry",
    rows
  );


  renderChoiceSlider(
    "sector",
    rows
  );


  renderMinistryDetail(
    rows
  );


  renderSectorDetail(
    rows
  );

}



/* =====================================================
   MAP COLORS
===================================================== */

function stateRiskColor(
  avgRisk,
  hasData
) {

  if (!hasData) {

    return "#dce6ec";

  }


  if (avgRisk >= 75) {

    return "#c73545";

  }


  if (avgRisk >= 40) {

    return "#d9a116";

  }


  return "#2f8f59";

}



/* =====================================================
   GEOJSON STATE
===================================================== */

function stateFromGeoJSON(
  feature
) {

  return normalizeState(

    feature?.properties?.name ||

    feature?.properties?.NAME_1 ||

    feature?.properties?.st_nm ||

    feature?.properties?.STATE_NAME ||

    ""

  );

}



/* =====================================================
   MAP DATA
===================================================== */

function renderMapData(
  rows
) {
  /* =====================================================
   MAP DATA
===================================================== */

function renderMapData(
  rows
) {

  /*
   * State colours now come from the
   * dedicated July 2026 state-wise dataset.
   *
   * We do NOT try to invent states from
   * project names.
   */

  const stateStats = {};

  statewiseData.forEach(
    (item) => {

      const state =
        normalizeState(
          item.state
        );

      stateStats[state] = {

        ...item,

        count:
          num(
            item.project_count
          ),

        original:
          num(
            item.original_cost
          ),

        revised:
          num(
            item.latest_cost ??
            item.revised_cost
          ),

        expenditure:
          num(
            item.expenditure
          )

      };

    }
  );


  /*
   * Fallback for any state data that
   * may still be available from project rows.
   *
   * This keeps the existing dashboard
   * behaviour intact.
   */

  if (
    !statewiseData.length
  ) {

    aggregate(
      rows,
      "state"
    ).forEach(
      (x) => {

        const state =
          normalizeState(
            x.key
          );

        if (
          state !==
          "Other / Not detected"
        ) {

          stateStats[state] = x;

        }

      }
    );

  }


  if (!mapLayer) {

    return;

  }


  mapLayer.eachLayer(
    (layer) => {

      const state =
        stateFromGeoJSON(
          layer.feature
        );


      const stat =
        stateStats[state];


      layer.setStyle({

        fillColor:
          stateRiskColor(
            stat?.avgRisk || 0,
            Boolean(stat)
          ),

        fillOpacity:
          stat
            ? 0.78
            : 0.28,

        color:
          "#ffffff",

        weight:
          1

      });


      /*
       * MAP HOVER TOOLTIP
       */

      layer.bindTooltip(

        `

          <strong>
            ${esc(state)}
          </strong>

          <br>

          ${
            stat

              ? `
                Projects:
                ${fmt(
                  stat.count,
                  0
                )}

                <br>

                Original:
                ${money(
                  stat.original
                )}

                <br>

                Latest:
                ${money(
                  stat.revised
                )}

                <br>

                Expenditure:
                ${money(
                  stat.expenditure
                )}
              `

              : "No project data"
          }

        `,

        {

          sticky:
            true,

          direction:
            "top"

        }

      );

    }
  );

}

  

}


/* =====================================================
   MAP PANEL
===================================================== */

function updateMapPanel(
  state,
  clicked = false
) {

  /*
   * ===================================================
   * NORMALIZE STATE
   * ===================================================
   */

  const normalized =
    normalizeState(state);


  /*
   * ===================================================
   * GET STATE-WISE DATA
   *
   * This comes from:
   * July_2026_State-Wise.csv
   *
   * Example:
   *
   * Maharashtra
   * Projects      = 182
   * Original      = 535255.42
   * Revised       = 601442.86
   * Expenditure   = 454254.95
   * ===================================================
   */

  const stateStat =
    getStatewiseStat(
      normalized
    );


  /*
   * ===================================================
   * PROJECT ROWS
   *
   * These are used ONLY when we need
   * project-level calculations such as
   * physical progress / risk.
   * ===================================================
   */

  const rows =
    state === "All India"

      ? filteredRows

      : filteredRows.filter(
          (p) => {

            const projectState =
              normalizeState(
                p.state ||
                p.State ||
                p.state_name ||
                p.stateName ||
                ""
              );

            return (
              projectState ===
              normalized
            );

          }
        );


  /*
   * ===================================================
   * PROJECT STATS
   * ===================================================
   */

  const projectStats =
    overallStats(
      rows
    );


  /*
   * ===================================================
   * STATE-WISE SUMMARY VALUES
   *
   * IMPORTANT:
   *
   * Statewise CSV is the source of truth for:
   *
   * 1. Project count
   * 2. Original cost
   * 3. Revised cost
   * 4. Expenditure
   *
   * We support multiple possible field names
   * so frontend doesn't break if backend
   * response naming changes.
   * ===================================================
   */

  const stateProjects =
    stateStat
      ? num(
          stateStat.project_count ??
          stateStat.projects ??
          stateStat.count ??
          stateStat.projectCount ??
          0
        )
      : 0;


  const stateOriginal =
    stateStat
      ? num(
          stateStat.original_cost ??
          stateStat.original ??
          stateStat.originalCost ??
          0
        )
      : 0;


  const stateRevised =
    stateStat
      ? num(
          stateStat.latest_cost ??
          stateStat.revised_cost ??
          stateStat.revised ??
          stateStat.latestCost ??
          stateStat.revisedCost ??
          0
        )
      : 0;


  const stateExpenditure =
    stateStat
      ? num(
          stateStat.expenditure ??
          stateStat.expenditure_cumulative ??
          stateStat.expenditureCum ??
          0
        )
      : 0;


  /*
   * ===================================================
   * FINAL SUMMARY VALUES
   * ===================================================
   */

  const projects =
    state === "All India"

      ? projectStats.count

      : stateProjects;


  const original =
    state === "All India"

      ? projectStats.original

      : stateOriginal;


  const revised =
    state === "All India"

      ? projectStats.revised

      : stateRevised;


  const expenditure =
    state === "All India"

      ? projectStats.expenditure

      : stateExpenditure;


  /*
   * ===================================================
   * PROGRESS
   *
   * State-wise CSV does NOT contain physical progress.
   *
   * Therefore:
   *
   * - If project rows for the state exist,
   *   calculate from those rows.
   *
   * - Otherwise show "—"
   *
   * Never show fake 0.
   * ===================================================
   */

  const hasProjectRows =
    rows.length > 0;


  const avgPhysical =
    hasProjectRows
      ? projectStats.avgPhysical
      : null;


  /*
   * ===================================================
   * RISK
   *
   * Same rule:
   * Calculate only if real project rows exist.
   * ===================================================
   */

  const avgRisk =
    hasProjectRows
      ? projectStats.avgRisk
      : null;


  /*
   * ===================================================
   * HIGH RISK COUNT
   * ===================================================
   */

  const high =
    hasProjectRows

      ? rows.filter(
          (p) =>
            p.level === "High"
        ).length

      : null;


  /*
   * ===================================================
   * LEFT SIDE STATE PANEL
   * ===================================================
   */

  const title =
    $("#mapStateTitle");

  if (title) {

    title.textContent =
      state;

  }


  /*
   * SUBTITLE
   */

  const subtitle =
    $("#mapStateSub");

  if (subtitle) {

    subtitle.textContent =

      state === "All India"

        ? "Data as of July 2026 — selected month portfolio summary"

        : clicked

          ? "Data as of July 2026 — selected state"

          : "Data as of July 2026 — hovering over state";

  }


  /*
   * ===================================================
   * PROJECT COUNT
   * ===================================================
   */

  const projectsElement =
    $("#mapProjects");

  if (projectsElement) {

    projectsElement.textContent =
      fmt(
        projects,
        0
      );

  }


  /*
   * ===================================================
   * ORIGINAL COST
   * ===================================================
   */

  const originalElement =
    $("#mapOriginal");

  if (originalElement) {

    originalElement.textContent =
      money(
        original
      );

  }


  /*
   * ===================================================
   * REVISED COST
   * ===================================================
   */

  const revisedElement =
    $("#mapRevised");

  if (revisedElement) {

    revisedElement.textContent =
      money(
        revised
      );

  }


  /*
   * ===================================================
   * EXPENDITURE
   * ===================================================
   */

  const expenditureElement =
    $("#mapExpenditure");


  if (expenditureElement) {

    expenditureElement.textContent =
      money(
        expenditure
      );

  }


  /*
   * ===================================================
   * PHYSICAL PROGRESS
   * ===================================================
   */

  const progressElement =
    $("#mapProgress");

  if (progressElement) {

    progressElement.textContent =

      avgPhysical !== null &&
      avgPhysical !== undefined

        ? `${fmt(
            avgPhysical
          )}%`

        : "—";

  }


  /*
   * ===================================================
   * AVG RISK
   * ===================================================
   */

  const riskElement =
    $("#mapRisk");

  if (riskElement) {

    riskElement.textContent =

      avgRisk !== null &&
      avgRisk !== undefined

        ? fmt(
            avgRisk
          )

        : "—";

  }


  /*
   * ===================================================
   * HIGH RISK PROJECTS
   * ===================================================
   */

  const highElement =
    $("#mapHigh");

  if (highElement) {

    highElement.textContent =

      high !== null &&
      high !== undefined

        ? fmt(
            high,
            0
          )

        : "—";

  }


  /*
   * ===================================================
   * REMOVE / CLEAR OLD DETAILED ANALYSIS
   * ===================================================
   *
   * We don't generate the old project table here.
   *
   * The map page should show the state summary
   * instead of repeating detailed project analysis.
   * ===================================================
   */

  const detailTitle =
    $("#stateDetailTitle");

  const detailSub =
    $("#stateDetailSub");

  const detailBody =
    $("#stateDetailBody");


  if (detailTitle) {

    detailTitle.textContent = "";

  }


  if (detailSub) {

    detailSub.textContent = "";

  }


  if (detailBody) {

    detailBody.innerHTML = "";

  }

}



/* =====================================================
   MAP INITIALIZATION
===================================================== */

async function initMap() {

  if (
    mapReady ||
    !$("#indiaMap") ||
    typeof L ===
      "undefined"
  ) {

    return;

  }


  map =
    L.map(
      "indiaMap",
      {

        zoomControl:
          false,

        scrollWheelZoom:
          false,

        attributionControl:
          true

      }
    )
      .setView(
        [22.5, 79],
        4.7
      );


  L.control.zoom(
    {
      position:
        "bottomright"
    }
  )
    .addTo(map);


  try {

    const geo =
      await fetch(
        GEOJSON_URL
      ).then(
        (response) => {

          if (!response.ok) {

            throw new Error(
              "GeoJSON unavailable"
            );

          }

          return response.json();

        }
      );


    mapLayer =
      L.geoJSON(
        geo,
        {

          style: {

            fillColor:
              "#dce6ec",

            fillOpacity:
              0.35,

            color:
              "#fff",

            weight:
              1

          },


          onEachFeature:
            (
              feature,
              layer
            ) => {

              layer.on({

                mouseover:
                  () => {

                    const state =
                      stateFromGeoJSON(
                        feature
                      );


                    updateMapPanel(
                      state,
                      false
                    );


                    layer.setStyle({

                      weight:
                        2,

                      fillOpacity:
                        0.95

                    });


                    $("#mapTip")
                      .textContent =
                        state;

                  },


                mouseout:
                  () => {

                    renderMapData(
                      filteredRows
                    );


                    if (
                      selectedMapState
                    ) {

                      updateMapPanel(
                        selectedMapState,
                        true
                      );

                    } else {

                      updateMapPanel(
                        "All India",
                        false
                      );

                    }

                  },


                click:
                  () => {

                    selectedMapState =
                      stateFromGeoJSON(
                        feature
                      );


                    updateMapPanel(
                      selectedMapState,
                      true
                    );


                    document
                      .querySelector(
                        "#stateDetailCard"
                      )
                      ?.scrollIntoView(
                        {
                          behavior:
                            "smooth",

                          block:
                            "start"
                        }
                      );

                  }

              });

            }

        }
      )
      .addTo(map);


    map.fitBounds(
      mapLayer.getBounds(),
      {
        padding:
          [10, 10]
      }
    );


    mapReady =
      true;


    renderMapData(
      filteredRows
    );


  } catch (error) {

    console.error(
      error
    );


    $("#indiaMap")
      .innerHTML = `

        <div class="map-error">

          India state boundary data
          could not be loaded.

          State analytics remain
          available below.

        </div>

      `;

  }

}



/* =====================================================
   MAP PAGE
===================================================== */

function renderMapPage(
  rows
) {

  filteredRows =
    rows;


  $("#mapPeriod")
    .textContent =
      labelMonth(
        currentMonth
      );


  renderMapData(
    rows
  );


  if (selectedMapState) {

    updateMapPanel(
      selectedMapState,
      true
    );

  } else {

    updateMapPanel(
      "All India",
      false
    );

  }

}



/* =====================================================
   RENDER EVERYTHING
===================================================== */

function renderAll() {

  filteredRows =
    getFilteredRows();


  const period =
    labelMonth(
      currentMonth
    );


  [
    "#dashPeriod",
    "#mapPeriod",
    "#selectedPeriodLabel"
  ]
    .forEach(
      (id) => {

        if ($(id)) {

          $(id)
            .textContent =
              period;

        }

      }
    );


  $("#monthValue")
    .textContent =
      period;


  renderKPIs(
    filteredRows
  );


  renderDashboardCharts(
    filteredRows
  );


  renderDashboardDataTables(
    filteredRows
  );


  renderImportant(
    filteredRows
  );


  renderProjectTable(
    filteredRows
  );


  renderRiskPage(
    filteredRows
  );


  renderAnalysisPage(
    filteredRows
  );


  renderMapPage(
    filteredRows
  );

}



/* =====================================================
   MONTH SLIDER
===================================================== */

function renderMonthSlider() {

  const container =
    $("#monthSlider");


  container.innerHTML =

    months

      .map(
        (month) => `

          <button
            class="month-chip ${
              month === currentMonth
                ? "active"
                : ""
            }"
            data-month="${esc(month)}"
          >

            ${esc(
              labelMonth(
                month
              ).split(" ")[0]
            )}

          </button>

        `
      )

      .join("");


  container
    .querySelectorAll(
      "button"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () =>
            selectMonth(
              button.dataset.month
            )
        );

      }
    );

}



/* =====================================================
   YEAR FILTER
===================================================== */

function renderYearFilter() {

  const years =
    [
      ...new Set(
        months
          .map(
            (month) =>
              String(
                month
              ).split("_").pop()
          )
          .filter(Boolean)
      )
    ]
      .sort();


  const select =
    $("#yearFilter");


  select.innerHTML =

    years

      .map(
        (year) => `

          <option
            value="${esc(year)}"
          >
            ${esc(year)}
          </option>

        `
      )

      .join("");


  select.value =
    String(
      currentMonth
    )
      .split("_")
      .pop();

}



/* =====================================================
   SELECT MONTH
===================================================== */

async function selectMonth(month) {

  if (!month) {
    return;
  }

  currentMonth = month;

  renderMonthSlider();
  renderYearFilter();

  toast(
    `Loading ${labelMonth(month)}…`
  );

  try {

    // ---------------------------------------------
    // Load selected month's project data
    // ---------------------------------------------

    allRows =
      await fetchMonth(
        month
      );


    // ---------------------------------------------
    // Load state-wise data
    //
    // State-wise CSV currently available
    // for July 2026.
    // ---------------------------------------------

    await fetchStatewiseData(
      month
    );


    selectedMapState =
      null;


    populateSelectors();

    renderAll();


    // ---------------------------------------------
    // Make sure map gets the latest state data
    // after renderAll()
    // ---------------------------------------------

    if (
      mapReady &&
      mapLayer
    ) {

      renderMapData(
        filteredRows
      );

      updateMapPanel(
        "All India",
        false
      );

    }


    toast(
      `${labelMonth(month)} loaded`
    );


  } catch (error) {

    console.error(
      "Month loading failed:",
      error
    );

    allRows = [];

    statewiseData = [];

    statewiseLoadedMonth = "";

    renderAll();

    toast(
      "Monthly data could not be loaded. Check FastAPI."
    );

  }

}



/* =====================================================
   YEAR CHANGE
===================================================== */

function handleYearChange(
  year
) {

  const matches =
    months.filter(
      (month) =>
        String(
          month
        ).endsWith(
          `_${year}`
        )
    );


  if (!matches.length) {

    return;

  }


  const preferred =
    matches.find(
      (month) =>
        month ===
        currentMonth
    ) ||
    matches[
      matches.length - 1
    ];


  selectMonth(
    preferred
  );

}



/* =====================================================
   PAGE NAVIGATION
===================================================== */

function showPage(
  page
) {

  $$(".page")
    .forEach(
      (section) => {

        section.classList.toggle(
          "active",
          section.id ===
            `page-${page}`
        );

      }
    );


  $$(".nav-link")
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            page
        );

      }
    );


  window.scrollTo(
    {
      top: 0,
      behavior:
        "smooth"
    }
  );


  if (
    page === "map" &&
    !mapReady
  ) {

    setTimeout(
      initMap,
      60
    );

  }


  if (
    page === "map"
  ) {

    setTimeout(
      () =>
        map?.invalidateSize(),
      120
    );

  }

}



/* =====================================================
   CHART DATA / CHART TOGGLE
===================================================== */

function setupChartToggles() {

  $$(".chart-card")
    .forEach(
      (card) => {

        const buttons =
          card.querySelectorAll(
            ".chart-tools button"
          );


        const chartBody =
          card.querySelector(
            ".chart-body"
          );


        const dataBody =
          card.querySelector(
            ".data-body"
          );


        buttons.forEach(
          (button) => {

            button.addEventListener(
              "click",
              () => {

                const showData =
                  button.dataset.view ===
                  "data";


                buttons.forEach(
                  (b) =>
                    b.classList.toggle(
                      "active",
                      b === button
                    )
                );


                chartBody
                  ?.classList.toggle(
                    "hidden",
                    showData
                  );


                dataBody
                  ?.classList.toggle(
                    "hidden",
                    !showData
                  );

              }
            );

          }
        );

      }
    );

}



/* =====================================================
   MINISTRY / SECTOR SLIDER CONTROLS
===================================================== */

function setupAnalysisSliderControls() {

  $("#ministryPrev").onclick =
    () => {

      ministryOffset =
        Math.max(
          0,
          ministryOffset - 1
        );


      renderChoiceSlider(
        "ministry",
        filteredRows
      );

    };


  $("#ministryNext").onclick =
    () => {

      ministryOffset =
        Math.min(
          Math.max(
            0,
            getMinistryItems(
              filteredRows
            ).length - 1
          ),

          ministryOffset + 1
        );


      renderChoiceSlider(
        "ministry",
        filteredRows
      );

    };


  $("#sectorPrev").onclick =
    () => {

      sectorOffset =
        Math.max(
          0,
          sectorOffset - 1
        );


      renderChoiceSlider(
        "sector",
        filteredRows
      );

    };


  $("#sectorNext").onclick =
    () => {

      sectorOffset =
        Math.min(
          Math.max(
            0,
            getSectorItems(
              filteredRows
            ).length - 1
          ),

          sectorOffset + 1
        );


      renderChoiceSlider(
        "sector",
        filteredRows
      );

    };

}



/* =====================================================
   ACCESSIBILITY
===================================================== */

function setupAccessibility() {

  $("#accessBtn").onclick =
    () => {

      accessibilityStep =
        (
          accessibilityStep + 1
        ) % 3;


      document.body
        .classList.remove(
          "font-plus",
          "font-large"
        );


      if (
        accessibilityStep ===
        1
      ) {

        document.body
          .classList.add(
            "font-plus"
          );

      }


      if (
        accessibilityStep ===
        2
      ) {

        document.body
          .classList.add(
            "font-large"
          );

      }


      toast(

        accessibilityStep === 0

          ? "Default font size"

          : accessibilityStep === 1

            ? "Larger font"

            : "Largest font"

      );

    };


  $("#contrastBtn").onclick =
    () => {

      document.body
        .classList.toggle(
          "high-contrast"
        );


      toast(
        "Contrast updated"
      );

    };


  $("#langBtn").onclick =
    () =>
      toast(
        "Hindi language layer is reserved for the next phase"
      );


  $("#topLangBtn").onclick =
    () =>
      toast(
        "Hindi language layer is reserved for the next phase"
      );

}



/* =====================================================
   PROJECT DETAIL MODAL
===================================================== */

function openProjectModal(
  project
) {

  $("#projectModalTitle")
    .textContent =
      project.project_name;


  $("#projectModalBody")
    .innerHTML = `

      <div class="detail-grid">

        <div>

          <span>
            Project ID
          </span>

          <strong>
            ${esc(
              project.project_code
            )}
          </strong>

        </div>


        <div>

          <span>
            Ministry
          </span>

          <strong>
            ${esc(
              project.line_ministry
            )}
          </strong>

        </div>


        <div>

          <span>
            State
          </span>

          <strong>
            ${esc(
              project.state
            )}
          </strong>

        </div>


        <div>

          <span>
            Sector
          </span>

          <strong>
            ${esc(
              project.sector
            )}
          </strong>

        </div>


        <div>

          <span>
            Original Cost
          </span>

          <strong>
            ${money(
              project.original_cost
            )}
          </strong>

        </div>


        <div>

          <span>
            Revised / Current Cost
          </span>

          <strong>
            ${money(
              project.current_cost
            )}
          </strong>

        </div>


        <div>

          <span>
            Physical Progress
          </span>

          <strong>
            ${fmt(
              project.physical_progress
            )}%
          </strong>

        </div>


        <div>

          <span>
            Financial Progress
          </span>

          <strong>
            ${fmt(
              project.financial_progress
            )}%
          </strong>

        </div>


        <div>

          <span>
            Cost Risk
          </span>

          <strong>
            ${fmt(
              project.cost_risk
            )}/100
          </strong>

        </div>


        <div>

          <span>
            Delay Risk
          </span>

          <strong>
            ${fmt(
              project.delay_risk
            )}/100
          </strong>

        </div>


        <div>

          <span>
            Overall Risk
          </span>

          <strong>
            ${riskBadge(
              project
            )}
          </strong>

        </div>

      </div>

    `;


  $("#projectModal")
    .classList.remove(
      "hidden"
    );

}



/* =====================================================
   ADMIN MODAL
===================================================== */

function setupAdminModal() {

  $("#adminOpen").onclick =
    () =>
      $("#adminModal")
        .classList.remove(
          "hidden"
        );


  $("#adminClose").onclick =
    () =>
      $("#adminModal")
        .classList.add(
          "hidden"
        );


  $("#adminModal").onclick =
    (event) => {

      if (
        event.target.id ===
        "adminModal"
      ) {

        $("#adminModal")
          .classList.add(
            "hidden"
          );

      }

    };


  $("#projectModalClose").onclick =
    () =>
      $("#projectModal")
        .classList.add(
          "hidden"
        );


  $("#adminLogin").onsubmit =
    (event) => {

      event.preventDefault();


      /*
       * IMPORTANT:
       * Do NOT call an invented endpoint.
       *
       * Backend currently has no
       * admin authentication route.
       */

      toast(
        "Admin authentication needs its backend endpoint first"
      );

    };

}



/* =====================================================
   PROTOTYPE ASSISTANT
===================================================== */

function setupChat() {

  $("#chatForm").onsubmit =
    (event) => {

      event.preventDefault();


      const query =
        $("#chatInput")
          .value
          .trim();


      if (!query) {

        return;

      }


      $("#messages")
        .insertAdjacentHTML(

          "beforeend",

          `

            <div class="message user">

              <b>
                You:
              </b>

              ${esc(query)}

            </div>

          `

        );


      const q =
        query.toLowerCase();


      let answer =

        "I can summarize the selected month from the loaded project data. Try asking about risk, sectors, states, cost or progress.";



      if (
        q.includes(
          "highest risk"
        ) &&
        q.includes(
          "project"
        )
      ) {

        answer =

          [...filteredRows]

            .sort(
              (a, b) =>
                b.risk -
                a.risk
            )

            .slice(0, 3)

            .map(
              (p) =>
                `${esc(
                  p.project_name
                )} — ${p.risk}/100`
            )

            .join("<br>") ||

          answer;

      }


      else if (
        q.includes(
          "sector"
        )
      ) {

        const x =
          aggregate(
            filteredRows,
            "sector"
          )[0];


        answer =

          x

            ? `${esc(
                x.key
              )} has ${x.count} projects with average risk ${fmt(
                x.avgRisk
              )}.`

            : answer;

      }


      else if (
        q.includes(
          "state"
        )
      ) {

        const x =

          aggregate(
            filteredRows,
            "state"
          )

            .filter(
              (s) =>
                s.key !==
                "Other / Not detected"
            )

            .sort(
              (a, b) =>
                b.avgRisk -
                a.avgRisk
            )[0];


        answer =

          x

            ? `${esc(
                x.key
              )} has the highest detected average risk at ${fmt(
                x.avgRisk
              )}.`

            : answer;

      }


      else if (
        q.includes(
          "cost"
        )
      ) {

        const stats =
          overallStats(
            filteredRows
          );


        answer =

          `Selected portfolio: original ${money(
            stats.original
          )}, revised/current ${money(
            stats.revised
          )}, expenditure ${money(
            stats.expenditure
          )}.`;

      }


      $("#messages")
        .insertAdjacentHTML(

          "beforeend",

          `

            <div class="message bot">

              ${answer}

            </div>

          `

        );


      $("#chatInput")
        .value = "";

    };


  $$(".suggestions button")
    .forEach(
      (button) => {

        button.onclick =
          () => {

            $("#chatInput")
              .value =
                button.dataset.prompt;


            $("#chatForm")
              .requestSubmit();

          };

      }
    );

}



/* =====================================================
   GENERAL EVENTS
===================================================== */

function setupEvents() {

  $$(".nav-link")
    .forEach(
      (button) => {

        button.onclick =
          () =>
            showPage(
              button.dataset.page
            );

      }
    );


  $$("[data-page]")
    .forEach(
      (button) => {

        if (
          !button.classList
            .contains(
              "nav-link"
            )
        ) {

          button.onclick =
            () =>
              showPage(
                button.dataset.page
              );

        }

      }
    );


  $("#globalSector").onchange =
    renderAll;


  $("#globalRisk").onchange =
    renderAll;


  $("#clearFilters").onclick =
    () => {

      $("#globalSector")
        .value =
        "all";


      $("#globalRisk")
        .value =
        "all";


      renderAll();

    };


  $("#projectSearch").oninput =
    () =>
      renderProjectTable(
        filteredRows
      );


  $("#projectSector").onchange =
    () =>
      renderProjectTable(
        filteredRows
      );


  $("#projectRisk").onchange =
    () =>
      renderProjectTable(
        filteredRows
      );


  $("#yearFilter").onchange =
    (event) =>
      handleYearChange(
        event.target.value
      );

}



/* =====================================================
   INITIALIZATION
===================================================== */

async function init() {

  try {

    setupEvents();

    setupChartToggles();

    setupAnalysisSliderControls();

    setupAccessibility();

    setupAdminModal();

    setupChat();


    const data =
      await fetchJSON(
        `${API_BASE}/paimana-projects/months`
      );


    months =
      (
        data.months ||
        []
      ).slice();


    const knownOrder =
      Object.keys(
        MONTH_LABELS
      );


    months.sort(
      (a, b) =>
        knownOrder.indexOf(a) -
        knownOrder.indexOf(b)
    );


    if (!months.length) {

      throw new Error(
        "No months returned by backend"
      );

    }


    currentMonth =

      months.includes(
        "July_2026"
      )

        ? "July_2026"

        : months[
            months.length - 1
          ];


    renderMonthSlider();

    renderYearFilter();


    await selectMonth(
      currentMonth
    );


  } catch (error) {

    console.error(
      error
    );


    toast(
      "Unable to connect to FastAPI. Start the backend on port 8000."
    );

  }

}


init();