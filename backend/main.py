from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.projects import router as projects_router
from routes.risk import router as risk_router
from routes.dashboard import router as dashboard_router
from routes.historical import router as historical_router
from routes.paimana import router as paimana_router
from routes import project_monitoring
from routes import what_if
from routes import early_warning


app = FastAPI(title="PAIMANA AI")
@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


app.include_router(projects_router)
app.include_router(risk_router)
app.include_router(dashboard_router)
app.include_router(historical_router)
app.include_router(paimana_router)
app.include_router(project_monitoring.router)
app.include_router(what_if.router)
app.include_router(
    early_warning.router
)