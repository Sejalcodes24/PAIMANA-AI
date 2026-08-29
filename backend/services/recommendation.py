def get_risk_level(overall_risk):

    if overall_risk >= 75:
        return "HIGH"

    elif overall_risk >= 40:
        return "MEDIUM"

    else:
        return "LOW"


def generate_reasons(project):

    reasons = []

    cost_growth = (
        (project["current_cost"] - project["original_cost"])
        / project["original_cost"]
    ) * 100

    if cost_growth >= 10:
        reasons.append(
            f"Project cost has increased by {cost_growth:.1f}% "
            "from the original cost."
        )

    if project["financial_progress"] < project["physical_progress"]:
        reasons.append(
            "Financial progress is lower than physical progress."
        )

    if project["physical_progress"] < 50:
        reasons.append(
            "Current physical progress is below 50%."
        )

    if not reasons:
        reasons.append(
            "No major risk indicators detected from current project data."
        )

    return reasons


def generate_recommendations(project):

    recommendations = []

    cost_growth = (
        (project["current_cost"] - project["original_cost"])
        / project["original_cost"]
    ) * 100

    if cost_growth >= 10:
        recommendations.append(
            "Review cost escalation and revised project estimates."
        )

    if project["financial_progress"] < project["physical_progress"]:
        recommendations.append(
            "Review expenditure efficiency and financial progress."
        )

    if project["physical_progress"] < 50:
        recommendations.append(
            "Monitor contractor performance and project execution closely."
        )

    if not recommendations:
        recommendations.append(
            "Continue regular project monitoring."
        )

    return recommendations