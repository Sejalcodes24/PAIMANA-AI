from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.projects import router as projects_router
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


@app.get("/")
def home():
    return {
        "message": "PAIMANA AI Backend is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


app.include_router(projects_router)
app.include_router(risk_router)
app.include_router(dashboard_router)