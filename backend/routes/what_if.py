from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.project_db import ProjectDB

from services.risk_engine import (
    calculate_cost_risk,
    calculate_delay_risk,
    calculate_overall_risk
)

from services.recommendation import get_risk_level


router = APIRouter(
    prefix="/what-if",
    tags=["What-If Simulation"]
)


@router.post("/projects/{project_id}")
def what_if_simulation(
    project_id: int,
    physical_progress: float | None = None,
    financial_progress: float | None = None,
    current_cost: float | None = None,
    db: Session = Depends(get_db)
):

    # ==========================================
    # FIND PROJECT
    # ==========================================

    project = (
        db.query(ProjectDB)
        .filter(
            ProjectDB.project_id == project_id
        )
        .first()
    )

    if project is None:
        return {
            "error": "Project not found"
        }


    # ==========================================
    # CURRENT RISK
    # ==========================================

    current_cost_risk = calculate_cost_risk(
        project
    )

    current_delay_risk = calculate_delay_risk(
        project
    )

    current_overall_risk = calculate_overall_risk(
        project
    )

    current_risk_level = get_risk_level(
        current_overall_risk
    )


    # ==========================================
    # CREATE WHAT-IF VALUES
    # ==========================================

    simulated_physical = (
        physical_progress
        if physical_progress is not None
        else project.physical_progress
    )

    simulated_financial = (
        financial_progress
        if financial_progress is not None
        else project.financial_progress
    )

    simulated_cost = (
        current_cost
        if current_cost is not None
        else project.current_cost
    )


    # ==========================================
    # VALIDATE VALUES
    # ==========================================

    if not 0 <= simulated_physical <= 100:
        return {
            "error": "physical_progress must be between 0 and 100"
        }

    if not 0 <= simulated_financial <= 100:
        return {
            "error": "financial_progress must be between 0 and 100"
        }

    if simulated_cost < 0:
        return {
            "error": "current_cost cannot be negative"
        }


    # ==========================================
    # SIMULATE WITHOUT CHANGING DATABASE
    # ==========================================

    class SimulatedProject:
        pass


    simulated_project = SimulatedProject()

    simulated_project.original_cost = (
        project.original_cost
    )

    simulated_project.current_cost = (
        simulated_cost
    )

    simulated_project.physical_progress = (
        simulated_physical
    )

    simulated_project.financial_progress = (
        simulated_financial
    )


    # ==========================================
    # SIMULATED RISK
    # ==========================================

    simulated_cost_risk = calculate_cost_risk(
        simulated_project
    )

    simulated_delay_risk = calculate_delay_risk(
        simulated_project
    )

    simulated_overall_risk = calculate_overall_risk(
        simulated_project
    )

    simulated_risk_level = get_risk_level(
        simulated_overall_risk
    )


    # ==========================================
    # RISK CHANGE
    # ==========================================

    risk_change = (
        simulated_overall_risk
        - current_overall_risk
    )


    if risk_change < 0:
        impact = "Risk reduced"

    elif risk_change > 0:
        impact = "Risk increased"

    else:
        impact = "No change in risk"


    # ==========================================
    # RESPONSE
    # ==========================================

    return {

        "project_id":
            project.project_id,

        "current": {
            "physical_progress":
                project.physical_progress,

            "financial_progress":
                project.financial_progress,

            "current_cost":
                project.current_cost,

            "overall_risk":
                current_overall_risk,

            "risk_level":
                current_risk_level
        },

        "what_if": {
            "physical_progress":
                simulated_physical,

            "financial_progress":
                simulated_financial,

            "current_cost":
                simulated_cost,

            "overall_risk":
                simulated_overall_risk,

            "risk_level":
                simulated_risk_level
        },

        "risk_change":
            risk_change,

        "impact":
            impact
    }