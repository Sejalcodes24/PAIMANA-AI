from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import pandas as pd
import os

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


# ==========================================
# LOAD SHAP LOCAL DRIVERS
# ==========================================

BASE_DIR = os.path.dirname(
    os.path.dirname(__file__)
)

SHAP_FILE = os.path.join(
    BASE_DIR,
    "data",
    "shap_local_drivers.csv"
)


def get_shap_drivers(project_code):

    if not os.path.exists(SHAP_FILE):
        return []

    try:
        shap_df = pd.read_csv(SHAP_FILE)

        project_drivers = shap_df[
            shap_df["project_code"] == project_code
        ].copy()

        if project_drivers.empty:
            return []

        # Use the latest available SHAP snapshot
        month_order = {
            "Jan_2026": 1,
            "Feb_2026": 2,
            "March_2026": 3,
            "April_2026": 4,
            "May_2026": 5,
            "June_2026": 6,
            "July_2026": 7
        }

        project_drivers["month_number"] = (
            project_drivers["snapshot_month"]
            .map(month_order)
        )

        latest_month = (
            project_drivers["month_number"]
            .max()
        )

        project_drivers = project_drivers[
            project_drivers["month_number"]
            == latest_month
        ]

        project_drivers = project_drivers.sort_values(
            "shap_value",
            ascending=False
        )

        return project_drivers["feature"].tolist()

    except Exception:
        return []
    
# ==========================================
# PROJECT RISK API
# ==========================================

@router.get("/projects/{project_id}/risk")
def get_project_risk(
    project_id: int,
    db: Session = Depends(get_db)
):

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


    # ======================================
    # RULE-BASED RISK
    # ======================================

    cost_risk = calculate_cost_risk(project)

    delay_risk = calculate_delay_risk(project)

    overall_risk = calculate_overall_risk(project)

    risk_level = get_risk_level(
        overall_risk
    )


    # ======================================
    # SHAP DRIVERS
    # ======================================

    shap_drivers = get_shap_drivers(
    project.project_code
)

    # ======================================
    # REASONS
    # ======================================

    reasons = generate_reasons(
        project
    )


    # ======================================
    # RECOMMENDATIONS
    # ======================================

    recommendations = generate_recommendations(
    project,
    shap_drivers,
    risk_level
)


    # ======================================
    # RESPONSE
    # ======================================

    return {

        "project_id":
            project.project_id,

        "cost_risk":
            cost_risk,

        "delay_risk":
            delay_risk,

        "overall_risk":
            overall_risk,

        "risk_level":
            risk_level,

        "reasons":
            reasons,

        "shap_drivers":
            shap_drivers,

        "recommended_actions":
            recommendations
    }