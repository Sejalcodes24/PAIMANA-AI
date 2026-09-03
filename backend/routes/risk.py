from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.project_db import ProjectDB

from services.risk_engine import (
    calculate_cost_risk,
    calculate_delay_risk,
    calculate_overall_risk
)

from services.recommendation import (
    get_risk_level,
    generate_reasons,
    generate_recommendations
)


router = APIRouter()


@router.get("/projects/{project_id}/risk")
def get_project_risk(
    project_id: int,
    db: Session = Depends(get_db)
):

    project = (
        db.query(ProjectDB)
        .filter(ProjectDB.project_id == project_id)
        .first()
    )

    if project is None:
        return {
            "error": "Project not found"
        }

    cost_risk = calculate_cost_risk(project)
    delay_risk = calculate_delay_risk(project)
    overall_risk = calculate_overall_risk(project)

    risk_level = get_risk_level(overall_risk)

    reasons = generate_reasons(project)

    recommendations = generate_recommendations(project)

    return {
        "project_id": project.project_id,
        "cost_risk": cost_risk,
        "delay_risk": delay_risk,
        "overall_risk": overall_risk,
        "risk_level": risk_level,
        "reasons": reasons,
        "recommended_actions": recommendations
    }