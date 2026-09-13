
from fastapi import APIRouter, Query
import pandas as pd
import os

from database import SessionLocal
from models.project_db import ProjectDB
from services.recommendation import generate_recommendations


router = APIRouter(
    prefix="/early-warning",
    tags=["Early Warning"]
)


BASE_DIR = os.path.dirname(os.path.dirname(__file__))

EARLY_WARNING_FILE = os.path.join(
    BASE_DIR,
    "data",
    "early_warning_results.csv"
)

SHAP_FILE = os.path.join(
    BASE_DIR,
    "data",
    "shap_local_drivers.csv"
)


def get_shap_drivers(project_code, snapshot_month):

    if not os.path.exists(SHAP_FILE):
        return []

    try:
        shap_df = pd.read_csv(SHAP_FILE)

        drivers = shap_df[
            (shap_df["project_code"] == project_code)
            & (shap_df["snapshot_month"] == snapshot_month)
        ]

        if drivers.empty:
            return []

        drivers = drivers.sort_values(
            "shap_value",
            ascending=False
        )

        return drivers["feature"].head(5).tolist()

    except Exception:
        return []


# ---------------------------------------------------------
# EARLY WARNING LIST
# ---------------------------------------------------------

@router.get("")
def get_early_warnings(
    warnings_only: bool = Query(True),
    risk_level: str = Query(None),
    limit: int = Query(100, ge=1, le=1000)
):

    if not os.path.exists(EARLY_WARNING_FILE):
        return {
            "error": "Early warning results file not found"
        }

    try:
        df = pd.read_csv(EARLY_WARNING_FILE)

        # Show only actual warnings
        if warnings_only:
            df = df[df["early_warning"] == True]

        # Filter by risk level
        if risk_level:
            df = df[
                df["risk_level"].str.upper()
                == risk_level.upper()
            ]

        df = df.head(limit)

        db = SessionLocal()

        results = []

        try:

            for _, row in df.iterrows():

                project_code = int(row["project_code"])
                snapshot_month = row["snapshot_month"]

                # Find matching project snapshot
                project = (
                    db.query(ProjectDB)
                    .filter(
                        ProjectDB.project_code == project_code,
                        ProjectDB.snapshot_month == snapshot_month
                    )
                    .first()
                )

                # Get SHAP drivers
                shap_drivers = get_shap_drivers(
                    project_code,
                    snapshot_month
                )

                # Get recommendations
                recommendations = []

                if project:

                    recommendations = generate_recommendations(
                        project,
                        shap_drivers,
                        row["risk_level"]
                    )

                results.append({
                    "project_code": project_code,
                    "project_name": row["project_name"],
                    "snapshot_month": snapshot_month,
                    "risk_probability": round(
                        float(row["risk_probability"]),
                        4
                    ),
                    "risk_change": round(
                        float(row["risk_change"]),
                        4
                    ),
                    "risk_level": row["risk_level"],
                    "early_warning": bool(
                        row["early_warning"]
                    ),
                    "warning_reason": row["warning_reason"],
                    "shap_drivers": shap_drivers,
                    "recommended_actions": recommendations
                })

        finally:
            db.close()

        return {
            "total": len(results),
            "warnings_only": warnings_only,
            "risk_level_filter": risk_level,
            "early_warnings": results
        }

    except Exception as e:

        return {
            "error": str(e)
        }


# ---------------------------------------------------------
# EARLY WARNING SUMMARY
# ---------------------------------------------------------

@router.get("/summary")
def get_early_warning_summary():

    if not os.path.exists(EARLY_WARNING_FILE):
        return {
            "error": "Early warning results file not found"
        }

    try:

        df = pd.read_csv(EARLY_WARNING_FILE)

        # Total prediction rows
        total_prediction_rows = len(df)

        # Unique projects
        projects_monitored = df["project_code"].nunique()

        # High-risk predictions
        high_risk_predictions = len(
            df[
                df["risk_level"].str.upper() == "HIGH"
            ]
        )

        # Actual early warnings
        early_warnings = len(
            df[
                df["early_warning"] == True
            ]
        )

        # Warning percentage
        if total_prediction_rows > 0:

            warning_rate = (
                early_warnings
                / total_prediction_rows
            ) * 100

        else:

            warning_rate = 0

        # Find latest warning month
        latest_warning_month = None

        warning_df = df[
            df["early_warning"] == True
        ].copy()

        if not warning_df.empty:

            month_order = {
                "Jan_2026": 1,
                "Feb_2026": 2,
                "March_2026": 3,
                "April_2026": 4,
                "May_2026": 5,
                "June_2026": 6,
                "July_2026": 7
            }

            warning_df["month_number"] = (
                warning_df["snapshot_month"].map(
                    month_order
                )
            )

            warning_df = warning_df.sort_values(
                "month_number"
            )

            latest_warning_month = (
                warning_df["snapshot_month"].iloc[-1]
            )

        return {
            "total_prediction_rows": total_prediction_rows,
            "projects_monitored": projects_monitored,
            "high_risk_predictions": high_risk_predictions,
            "early_warnings": early_warnings,
            "warning_rate": round(warning_rate, 2),
            "latest_warning_month": latest_warning_month
        }

    except Exception as e:

        return {
            "error": str(e)
        }

