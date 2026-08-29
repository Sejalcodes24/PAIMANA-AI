from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.risk import router as risk_router
from routes.dashboard import router as dashboard_router

app = FastAPI(title="PAIMANA AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# HOME
# -----------------------------

@app.get("/")
def home():
    return {
        "message": "PAIMANA AI Backend is running"
    }


# -----------------------------
# HEALTH CHECK
# -----------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# -----------------------------
# DUMMY PROJECT DATA
# -----------------------------

projects = [
    {
        "project_id": 1427,
        "project_name": "National Highway Project",
        "state": "Uttar Pradesh",
        "sector": "Transport",
        "original_cost": 500,
        "current_cost": 560,
        "physical_progress": 52,
        "financial_progress": 48
    },

    {
        "project_id": 1098,
        "project_name": "Urban Infrastructure Project",
        "state": "Maharashtra",
        "sector": "Urban Development",
        "original_cost": 300,
        "current_cost": 315,
        "physical_progress": 72,
        "financial_progress": 70
    },

    {
        "project_id": 1842,
        "project_name": "Irrigation Development Project",
        "state": "Rajasthan",
        "sector": "Water Resources",
        "original_cost": 400,
        "current_cost": 470,
        "physical_progress": 35,
        "financial_progress": 30
    }
]


# -----------------------------
# GET ALL PROJECTS
# -----------------------------

@app.get("/projects")
def get_projects():
    return projects


# -----------------------------
# GET PROJECT BY ID
# -----------------------------

@app.get("/projects/{project_id}")
def get_project(project_id: int):

    for project in projects:

        if project["project_id"] == project_id:
            return project

    return {
        "error": "Project not found"
    }


# -----------------------------
# RISK ROUTES
# -----------------------------

app.include_router(risk_router)
app.include_router(dashboard_router)