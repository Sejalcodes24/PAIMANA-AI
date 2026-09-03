from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.project_db import ProjectDB

from services.risk_engine import (
    calculate_cost_risk,
    calculate_delay_risk,
    calculate_overall_risk
)


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


# -------------------------------------------------
# DASHBOARD OVERVIEW
# -------------------------------------------------

@router.get("/overview")
def dashboard_overview(db: Session = Depends(get_db)):

    projects = db.query(ProjectDB).all()

    total_projects = len(projects)

    high_risk = 0
    medium_risk = 0
    low_risk = 0

    cost_risk_projects = 0
    delay_risk_projects = 0

    for project in projects:

        cost_risk = calculate_cost_risk(project)
        delay_risk = calculate_delay_risk(project)
        overall_risk = calculate_overall_risk(project)

        if overall_risk >= 75:
            high_risk += 1

        elif overall_risk >= 40:
            medium_risk += 1

        else:
            low_risk += 1

        if cost_risk >= 75:
            cost_risk_projects += 1

        if delay_risk >= 75:
            delay_risk_projects += 1

    return {
        "total_projects": total_projects,
        "high_risk_projects": high_risk,
        "medium_risk_projects": medium_risk,
        "low_risk_projects": low_risk,
        "cost_risk_projects": cost_risk_projects,
        "delay_risk_projects": delay_risk_projects
    }


# -------------------------------------------------
# HIGH RISK PROJECTS
# -------------------------------------------------

@router.get("/high-risk")
def high_risk_projects(db: Session = Depends(get_db)):

    projects = db.query(ProjectDB).all()

    result = []

    for project in projects:

        risk = calculate_overall_risk(project)

        if risk >= 75:

            result.append({
                "project_id": project.project_id,
                "project_name": project.project_name,
                "state": project.state,
                "sector": project.sector,
                "risk_score": risk
            })

    result.sort(
        key=lambda x: x["risk_score"],
        reverse=True
    )

    return result


# -------------------------------------------------
# RISK BY STATE
# -------------------------------------------------

@router.get("/state-risk")
def state_risk(db: Session = Depends(get_db)):

    projects = db.query(ProjectDB).all()

    state_data = {}

    for project in projects:

        state = project.state
        risk = calculate_overall_risk(project)

        if state not in state_data:
            state_data[state] = {
                "projects": 0,
                "total_risk": 0
            }

        state_data[state]["projects"] += 1
        state_data[state]["total_risk"] += risk

    result = []

    for state, data in state_data.items():

        average_risk = (
            data["total_risk"] / data["projects"]
        )

        result.append({
            "state": state,
            "projects": data["projects"],
            "average_risk": round(average_risk)
        })

    return result


# -------------------------------------------------
# RISK BY SECTOR
# -------------------------------------------------

@router.get("/sector-risk")
def sector_risk(db: Session = Depends(get_db)):

    projects = db.query(ProjectDB).all()

    sector_data = {}

    for project in projects:

        sector = project.sector
        risk = calculate_overall_risk(project)

        if sector not in sector_data:
            sector_data[sector] = {
                "projects": 0,
                "total_risk": 0
            }

        sector_data[sector]["projects"] += 1
        sector_data[sector]["total_risk"] += risk

    result = []

    for sector, data in sector_data.items():

        average_risk = (
            data["total_risk"] / data["projects"]
        )

        result.append({
            "sector": sector,
            "projects": data["projects"],
            "average_risk": round(average_risk)
        })

    return result