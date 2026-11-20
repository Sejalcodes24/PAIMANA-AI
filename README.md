# PAIMANA AI 🇮🇳
### AI-Powered Infrastructure Monitoring, Risk Intelligence & Decision Support

PAIMANA AI is a full-stack infrastructure monitoring and analytics platform inspired by the monitoring framework of **PAIMANA (Project Assessment, Infrastructure Monitoring and Analytics for Nation-Building)**.

The platform brings infrastructure project data, explainable risk analytics, predictive delay assessment, interactive visualizations, and AI-assisted insights into a unified dashboard.

It helps users explore project performance, identify potential delays and cost overruns, understand risk factors, and simulate corrective actions through an interactive What-If environment.

> **Disclaimer:** PAIMANA AI is an independent analytics application and is not an official government platform. It does not represent or claim affiliation with MoSPI or any government ministry. Source data and geographic limitations are documented in [DATA_PROVENANCE.md](DATA_PROVENANCE.md).

---

## ✨ Key Features

### 1. Infrastructure Monitoring Dashboard
- Portfolio-level KPIs covering tracked projects, anticipated outlay, cost escalation, delays, and risk exposure.
- Dynamic reporting month selection from January to July 2026.
- Interactive sector explorer covering Railways, Power, Roadways, and Urban Metro infrastructure.
- Sector-level project counts, financial outlays, physical progress, and risk insights.
- Risk distribution charts, sector comparisons, priority watchlists, and monthly flash reports.

### 2. Interactive India State Map
- Leaflet-based interactive map with locally hosted GeoJSON boundaries.
- Multiple visualization modes:
  - Project Count
  - Original Outlay
  - Revised Outlay
  - Expenditure
- Interactive state tooltips and state-level financial summaries.

**Data transparency:** The map uses a separate July 2026 state-wise aggregate report. Individual project-to-state assignments and exact project coordinates are not fabricated.

### 3. Project Directory & Exploration
- Search infrastructure projects.
- Filter by State/UT, sector, risk tier, and commissioning status.
- Sort project records using multiple parameters.
- Paginated project listings with loading and error states.
- Detailed project-level information.

### 4. Explainable Dual Risk Intelligence

PAIMANA AI uses two distinct risk assessment approaches:

**Rule-Based Risk Score (0–100)**
- Evaluates schedule delays.
- Measures cost escalation.
- Considers financial expenditure against physical progress.
- Accounts for project bottlenecks.
- Provides explainable risk factors and corrective recommendations.

**ML Predictive Delay Hazard (%)**
- Uses a calibrated logistic hazard model.
- Estimates potential delay probability.
- Provides feature-level log-odds attributions to help explain predictions.

The two outputs are presented separately to distinguish rule-based assessment from ML-based prediction.

### 5. What-If Risk Simulator
Explore how potential corrective actions can influence project risk.

Users can simulate changes to:
- Schedule slippage.
- Anticipated project cost.
- Physical progress.
- Project bottleneck clearances.

The simulator returns updated risk assessments through the `POST /api/what-if/simulate` endpoint.

All simulations are non-mutating: simulated changes do not overwrite source project records.

### 6. AI-Powered Conversational Assistant
An intent-aware assistant that supports natural-language interaction with the platform.

Capabilities include:
- Natural responses to greetings and general conversation.
- Explanations of portal features and risk classifications.
- Clarification of ambiguous questions.
- State-wise, sector-wise, and project-specific queries.
- Responses grounded in the active reporting month's project records.
- Clickable dataset evidence references.

Powered by Google's Gemini integration through `@google/genai`.

A deterministic conversational and data-grounded fallback is available when the Gemini API key is not configured or the service is unavailable.

### 7. Data Ingestion & API Documentation
- CSV ingestion and parsing.
- Header normalization and support for alternate column names.
- Handling of missing values such as `N/A` and `--`.
- Duplicate filename and duplicate project-record detection.
- Automatic loading of available monthly snapshots.
- Interactive OpenAPI documentation.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Motion | Motion |
| Maps | Leaflet, GeoJSON |
| Charts & Visualization | Recharts |
| Backend | Node.js, Express |
| AI Integration | Google Gemini, `@google/genai` |
| Risk Analytics | TypeScript, Logistic Hazard Model |
| Data Processing | CSV ingestion, normalization, aggregation |
| API Documentation | OpenAPI 3.0 |

---

## 🏗️ System Architecture

```text
                  PAIMANA AI
                      |
          React + TypeScript Frontend
                      |
                 REST APIs
                      |
              Express Backend
                      |
       +--------------+--------------+
       |              |              |
   Repository     Risk Engine    AI Assistant
       |              |              |
   CSV Datasets   Risk Scoring    Gemini API
       |          What-If Lab     Fallback Router
       |
   Data Aggregation
       |
   Dashboard & Project Insights
```

### Core Modules

| File | Responsibility |
|---|---|
| `server.ts` | Express server and Vite integration |
| `src/shared/types.ts` | Shared domain interfaces |
| `src/shared/risk.ts` | Risk engine, ML assessment, recommendations, and simulation |
| `src/server/dataImporter.ts` | CSV parsing, normalization, and deduplication |
| `src/server/repository.ts` | Data loading, aggregation, search, and filtering |
| `src/server/chatbot.ts` | AI assistant and intent-aware routing |
| `src/server/openapi.ts` | OpenAPI specification |
| `src/components/dashboard/` | Dashboard components and sector showcase |

---

## 📁 Project Structure

```text
PAIMANA-AI/
│
├── data/
│   ├── monthly/
│   │   ├── paimana_2026_01.csv
│   │   ├── paimana_2026_02.csv
│   │   ├── paimana_2026_03.csv
│   │   └── ... July 2026
│   │
│   ├── flash_reports/
│   └── source_reports/
│
├── public/
│   ├── data/
│   │   ├── india-states.geojson
│   │   └── statewise/
│   └── reports/
│
├── src/
│   ├── assets/
│   ├── components/
│   ├── pages/
│   ├── server/
│   └── shared/
│
├── server.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── DATA_PROVENANCE.md
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20 or later
- npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Sejalcodes24/PAIMANA-AI.git
cd PAIMANA-AI
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root using `.env.example` as a reference.

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-4-hydrogen
```

The Gemini API key is optional.

Without it, the application uses its deterministic conversational and data-grounded fallback.

**Never commit your actual `.env` file or API keys to GitHub.**

### 4. Start the Development Server

```bash
npm run dev
```

Open:

**http://localhost:3000**

### 5. Build for Production

```bash
npm run build
```

To start the production server on Windows PowerShell:

```powershell
$env:NODE_ENV="production"
npm start
```

On Linux/macOS, use:

```bash
npm start
```

---

## 🔌 API Reference

The backend exposes RESTful endpoints for dashboard data, project exploration, simulations, and AI-assisted queries.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Application and dataset health |
| GET | `/api/dashboard/summary` | Dashboard KPIs and analytics |
| GET | `/api/projects` | Search, filter, sort, and paginate projects |
| GET | `/api/projects/:projectCode` | Project details and monthly history |
| POST | `/api/what-if/simulate` | Run a non-mutating risk simulation |
| GET | `/api/reports/flash` | Monthly flash report metadata |
| POST | `/api/assistant/chat` | Conversational AI assistant |
| GET | `/api/docs` | Interactive API documentation |
| GET | `/api/openapi.json` | OpenAPI specification |

Example dashboard request:

```http
GET /api/dashboard/summary?month=2026-03
```

---

## 📊 Data Sources & Transparency

The application uses supplied PAIMANA monthly project snapshots covering January–July 2026, along with a separate July 2026 state-wise aggregate report.

Data processing includes:
- CSV header normalization.
- Missing-value handling.
- Duplicate record detection.
- Monthly reporting snapshots.
- Aggregation for dashboard visualizations.

### Geographic Data Limitations

The monthly project-level datasets do not provide individual State/UT assignments.

Therefore:
- State-level map visualizations use the separate July 2026 aggregate report.
- Project records are not artificially assigned to states.
- Exact project coordinates are not invented.
- The state-wise map remains tied to July 2026 data, regardless of the selected project reporting month.

For detailed source mappings and limitations, see **[DATA_PROVENANCE.md](DATA_PROVENANCE.md)**.

---

## 🧪 Testing & Development

Run the automated test suite:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run lint
```

Create the production build:

```bash
npm run build
```

---

## 🔮 Future Scope

Potential areas for further development include:

- Persistent database integration.
- Automated ingestion of updated project reports.
- Expanded historical trend analysis.
- More granular project-level geospatial information when reliable source data becomes available.
- Enhanced predictive model evaluation and monitoring.
- Role-based access and administrative workflows.

---

## ⚠️ Known Limitations

- Project-level State/UT mapping is unavailable in the supplied monthly datasets.
- The state-wise map currently uses July 2026 aggregate data only.
- Monthly CSV datasets are loaded into an in-memory repository.
- Gemini-powered responses require a valid API key; fallback functionality is available without one.
- ML predictions are analytical estimates and should not be interpreted as guaranteed project outcomes.

---

## 👩‍💻 Project

**PAIMANA AI — Infrastructure Monitoring & Risk Intelligence**

Developed as an independent full-stack analytics project.

**GitHub:** [Sejalcodes24/PAIMANA-AI](https://github.com/Sejalcodes24/PAIMANA-AI)

---

*Built to make
