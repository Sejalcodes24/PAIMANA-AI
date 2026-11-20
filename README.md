# PAIMANA AI

An interactive infrastructure-project monitoring, explainable risk analytics, What-If simulation, and conversational AI assistant portal modeled on MoSPI's **PAIMANA** (Project Assessment, Infrastructure Monitoring and Analytics for Nation-Building) structure.

> **Notice:** PAIMANA AI is an independent monitoring and analytics application. Official government seals or ministry marks are intentionally omitted, and map data uses open DataMeet India boundaries (CC BY 4.0).

---

## Implemented Features

- **Formal Monitoring Dashboard (`/`)**:
  - Coordinated header branding in `src/assets/logos/`: original **PAIMANA AI** SVG logo (`paimana-ai-logo.svg`) and India-inspired **Ministry of Statistics and Programme Implementation** wordmark (`mospi-wordmark.svg`) featuring saffron, white, green, and blue data-wheel motifs (no official seals fabricated).
  - Prominent navy blue (`#081B33`, `#0B2545`, `#13315C`) and crisp white portal layout with restrained cyan-blue (`#0284C7`, `#38BDF8`) and saffron (`#FF9933`, `#E66C0A`) accents, layered card depth, subtle 3D hover lift, and `prefers-reduced-motion` support.
  - **Rotating Sector Infrastructure Banner & Live Sector Explorer**: Showcases Railways, Power & Nuclear Energy (incl. Kudankulam Nuclear), Roadways & Expressways, and Urban Metro with AI-generated editorial photography (`src/assets/images/`), accessible Pause/Resume and Next/Previous controls, and clickable sector cards backed by live monthly project counts, outlays, physical progress %, risk scores, and project drill-downs.
  - Reporting month selector (`2026-01` through `2026-07`) updating KPIs, sector showcase, charts, watchlist, and state aggregates dynamically from backend APIs.
  - 4-column KPI strip covering tracked projects ($\ge$ ₹150 Crore), anticipated outlay & escalation, delayed projects, and High/Critical risk exposure.
  - **Interactive India State Map (Leaflet + GeoJSON)**: Uses locally hosted India State/UT boundary GeoJSON (`public/data/india-states.geojson`, sourced from DataMeet India boundaries, CC BY 4.0) with choropleth modes for **Project Count**, **Original Outlay**, **Revised Outlay**, and **Expenditure**, with hover tooltips and a state inspector. These figures come from the supplied July 2026 state-wise CSV; the map does not claim state-level risk or delay data.
  - **Honest Geo Granularity**: The monthly project-level CSV does not contain individual State/UT assignments. The separate July state-wise report powers the map at aggregate level only; it is not used to assign individual project records to states or create project drill-downs.
  - **Sector & Risk Charts + Priority Watchlist + Flash Reports**: Clickable sector cost bars, risk-tier breakdown bars, high-risk watchlist table, and monthly flash report highlights.
- **Projects Directory (`Projects`)**:
  - Live search, State/UT, Sector, Rule-Based Risk Tier, and Commissioning Status filters, multi-column sorting, pagination, loading skeletons, empty states, and error retry handling.
- **Project Detail & Explainable Dual Risk Engine (`Project Detail`)**:
  - Clearly separates **Rule-Based Risk Score (0–100)** (weighted rubric across schedule slippage, cost escalation, financial-vs-physical lag, and bottlenecks) from **ML Predictive Delay Hazard (%)** (calibrated logistic hazard model with feature-level log-odds attributions).
  - Displays monthly historical progression across ingested snapshots and bottleneck-specific corrective recommendations.
- **What-If Risk Simulator (`What-If Lab`)**:
  - Adjust simulated schedule slippage, anticipated cost, physical progress, and bottleneck clearances via `POST /api/what-if/simulate`. Simulated outputs are clearly marked as **unsaved simulations** leaving official source records unchanged.
- **Conversational, Data-Grounded AI Assistant (`Ask AI Assistant`)**:
  - Intent-aware routing (`src/server/chatbot.ts`) handles greetings and small talk naturally, answers general questions about portal features and risk tiers, asks clarifying follow-up questions on ambiguous prompts, and grounds project/state/sector answers strictly in the active reporting month's records via `@google/genai` (`gemini-4-hydrogen`) with clickable **Cited Dataset Evidence** links.
  - Falls back cleanly to a deterministic conversational and data-grounded router when `GEMINI_API_KEY` is not configured or unavailable.
- **CSV Ingestion, Deduplication & OpenAPI Docs**:
  - `src/server/dataImporter.ts` handles header aliases, `N/A`/`--` missing-value normalization, and skips duplicate-named `(1)` files (`paimana_2026_02 (1).csv`) as well as duplicate `projectCode::reportingMonth` records.
  - Interactive OpenAPI reference available at `/api/docs` (schema at `/api/openapi.json`).

---

## Architecture & Key Files

- **Full-Stack Runtime**: Express + Vite (`server.ts` on port `3000`) with React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), and Leaflet.
  - *Note on Environment Adaptation*: This workspace runs inside the AI Studio Node/Express/Vite container without direct access to a user's local Windows directory (`C:/Users/...`). The data pipeline, risk engine, OpenAPI endpoints, and frontend are implemented in TypeScript/Express so the entire full-stack app runs from a single command on port `3000`. Drop additional monthly PAIMANA CSV files directly into `data/monthly/` and restart the server to ingest them automatically.
- **Assets & Data Files**:
  - `src/assets/logos/paimana-ai-logo.svg` & `src/assets/logos/mospi-wordmark.svg` — Coordinated original SVG header marks
  - `src/assets/images/sector_*.jpg` — Generated sector infrastructure photography (Railways, Nuclear/Power, Highways, Urban Metro)
  - `data/monthly/paimana_2026_01.csv` through `paimana_2026_07.csv` — converted from the supplied PAIMANA monthly project snapshots.
  - `data/source_reports/` — July state-wise aggregate CSV; valid April–June Flash Report PDFs are served from `public/reports/`.
  - `data/flash_reports/flash_reports.json` — report-card metadata for April–July 2026; PDFs are linked for April–June, and July links to the official PIB release because the supplied July PDF is damaged.
  - `public/data/statewise/july-2026.json` — normalized July 2026 state-wise project count and financial summary, derived from the supplied state-wise CSV.
  - See `DATA_PROVENANCE.md` for source mapping and limitations.
  - `public/data/india-states.geojson`
- **Core Modules**:
  - `src/shared/types.ts` — Shared TypeScript domain interfaces
  - `src/shared/risk.ts` — Rule-Based Risk Rubric, ML Delay Hazard model, Recommendations, and What-If Simulator
  - `src/server/dataImporter.ts` — RFC-4180 CSV parser, header normalizer, duplicate `(1)` detector, state alias mapper
  - `src/server/repository.ts` — Multi-month repository, aggregations, search/filter/sort/pagination
  - `src/server/chatbot.ts` — Conversational intent router & server-side `@google/genai` grounded assistant with deterministic fallback
  - `src/server/openapi.ts` — OpenAPI 3.0 spec & `/api/docs` HTML viewer
  - `src/components/dashboard/SectorShowcaseBanner.tsx` — Rotating sector photo showcase & live sector project breakdown
  - `server.ts` — Express API server + Vite middleware

---

## Setup & Commands

### Prerequisites
- Node.js 20+ and npm

### Environment Variables
Copy `.env.example` to `.env` if running locally outside AI Studio:
- `PORT` (default `3000`)
- `GEMINI_API_KEY` (optional; enables live Gemini responses in `/api/assistant/chat`. When unset, the deterministic conversational & data-grounded fallback runs automatically.)
- `GEMINI_MODEL` (optional; defaults to `gemini-4-hydrogen`)

### Run Commands
```bash
# Install dependencies
npm install

# Run unit tests (risk engine + CSV importer + chatbot intent router)
npm test

# Start development server (Express API + Vite SPA on http://localhost:3000)
npm run dev

# Build production bundle and run production server
npm run build
npm start
```

### Key API Endpoints
- `GET /api/health` — Service & dataset ingestion health
- `GET /api/dashboard/summary?month=2026-03` — Portfolio KPIs, charts, state aggregates, watchlist
- `GET /api/projects` — Search, filter, sort, paginate projects
- `GET /api/projects/:projectCode` — Project detail, monthly history, dual risk breakdown
- `POST /api/what-if/simulate` — Non-mutating What-If risk simulation
- `GET /api/reports/flash` — Monthly flash reports metadata
- `POST /api/assistant/chat` — Conversational & data-grounded AI assistant endpoint
- `GET /api/docs` & `GET /api/openapi.json` — OpenAPI documentation

---

## Known Limitations

- **State-Level Location Granularity**: The monthly project-level CSV does not provide individual State/UT assignments. The July state-wise CSV supports aggregate map views only. Exact project coordinates and project-to-state mapping are not inferred.
- **In-Memory CSV Repository**: Monthly CSVs in `data/monthly/` are parsed and indexed in memory on startup (`DATABASE_URL` in `.env.example` is reserved if extending to PostgreSQL).
- **State-wise Map Coverage**: The supplied state-wise summary is for July 2026 only. The map remains explicitly tied to July source data even if another project reporting month is selected.
