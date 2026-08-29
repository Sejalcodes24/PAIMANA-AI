from fastapi import APIRouter

from services.risk_engine import (
    calculate_cost_risk,
    calculate_delay_risk,
    calculate_overall_risk
)

router = APIRouter()

from services.recommendation import (
    get_risk_level,
    generate_reasons,
    generate_recommendations
)



@router.get("/projects/{project_id}/risk")
def get_project_risk(project_id: int):

    from main import projects

    for project in projects:

        if project["project_id"] == project_id:

            cost_risk = calculate_cost_risk(project)
            delay_risk = calculate_delay_risk(project)
            overall_risk = calculate_overall_risk(project)

            risk_level = get_risk_level(overall_risk)

            reasons = generate_reasons(project)

            recommendations = generate_recommendations(project)

            return {
                "project_id": project_id,
                "cost_risk": cost_risk,
                "delay_risk": delay_risk,
                "overall_risk": overall_risk,
                "risk_level": risk_level,
                "reasons": reasons,
                "recommended_actions": recommendations
            }

    return {
        "error": "Project not found"
    }