def get_risk_level(overall_risk):
    if overall_risk >= 75:
        return "HIGH"
    elif overall_risk >= 40:
        return "MEDIUM"
    else:
        return "LOW"


def generate_reasons(project):
    reasons = []

    cost_growth = 0

    if project.original_cost > 0:
        cost_growth = (
            (project.current_cost - project.original_cost)
            / project.original_cost
        ) * 100

    progress_gap = (
        project.physical_progress
        - project.financial_progress
    )

    if cost_growth >= 10:
        reasons.append(
            f"Project cost has increased by {cost_growth:.1f}%."
        )

    if progress_gap < 0:
        reasons.append(
            "Financial progress is lower than physical progress."
        )

    if project.physical_progress < 50:
        reasons.append(
            "Physical progress is below 50%."
        )

    if not reasons:
        reasons.append(
            "No major risk indicators detected from current project data."
        )

    return reasons


def generate_recommendations(
    project,
    shap_drivers=None,
    risk_level="LOW"
):
    recommendations = []

    # ==========================================
    # SHAP-BASED RECOMMENDATIONS
    # ==========================================

    driver_actions = {
        "progress_expenditure_gap":
            "Investigate expenditure efficiency and the gap between financial and physical progress.",

        "progress_velocity":
            "Review the current execution pace and identify causes of slow physical progress.",

        "months_to_completion":
            "Review the remaining project schedule and upcoming completion milestones.",

        "required_progress_per_month":
            "Prepare an acceleration or recovery plan to achieve the required monthly progress.",

        "schedule_pressure":
            "Increase schedule monitoring and review activities affecting timely completion.",

        "cost_overrun_percent":
            "Review the project's cost overrun and identify the major sources of cost escalation.",

        "cost_escalation_percent":
            "Review revised project estimates and investigate the causes of cost escalation.",

        "gap_change":
            "Investigate the worsening trend between financial and physical progress.",

        "physical_progress":
            "Review the current execution status and identify activities causing low physical progress.",

        "remaining_progress":
            "Review the remaining physical work and prepare a milestone-based completion plan.",

        "expenditure_velocity":
            "Review expenditure trends against actual physical progress.",

        "expenditure_ratio":
            "Review expenditure utilisation in relation to the project's physical progress.",

        "progress_change":
            "Investigate recent changes in physical progress and identify execution bottlenecks."
    }

    # ==========================================
    # LOW RISK
    # ==========================================

    if risk_level == "LOW":

        # Only provide monitoring/corrective suggestions.
        low_risk_drivers = [
            "months_to_completion",
            "required_progress_per_month",
            "schedule_pressure",
            "physical_progress",
            "progress_velocity",
            "progress_change"
        ]

        if shap_drivers:
            for driver in shap_drivers:
                if driver in low_risk_drivers:
                    recommendations.append(
                        driver_actions[driver]
                    )

        if not recommendations:
            recommendations.append(
                "Continue regular monitoring and review upcoming project milestones."
            )

    # ==========================================
    # MEDIUM RISK
    # ==========================================

    elif risk_level == "MEDIUM":

        if shap_drivers:
            for driver in shap_drivers:
                if driver in driver_actions:
                    recommendations.append(
                        driver_actions[driver]
                    )

        # Additional corrective action
        recommendations.append(
            "Increase monitoring frequency and review corrective actions with the project team."
        )

    # ==========================================
    # HIGH RISK
    # ==========================================

    elif risk_level == "HIGH":

        if shap_drivers:
            for driver in shap_drivers:
                if driver in driver_actions:
                    recommendations.append(
                        driver_actions[driver]
                    )

        # High-risk escalation
        recommendations.append(
            "Initiate senior-level review and prepare a time-bound project recovery plan."
        )

        recommendations.append(
            "Review critical milestones, implementation constraints, and immediate intervention requirements."
        )

    # ==========================================
    # RULE-BASED INDICATORS
    # ==========================================

    cost_growth = 0

    if project.original_cost > 0:
        cost_growth = (
            (project.current_cost - project.original_cost)
            / project.original_cost
        ) * 100

    progress_gap = (
        project.physical_progress
        - project.financial_progress
    )

    # Cost escalation is relevant for MEDIUM/HIGH
    if risk_level in ["MEDIUM", "HIGH"]:

        if cost_growth >= 10:
            recommendations.append(
                "Review cost escalation and revised project estimates."
            )

        if progress_gap < 0:
            recommendations.append(
                "Investigate expenditure efficiency and financial-progress mismatch."
            )

    # ==========================================
    # REMOVE DUPLICATES
    # ==========================================

    recommendations = list(
        dict.fromkeys(recommendations)
    )

    # ==========================================
    # LIMIT OUTPUT
    # ==========================================

    # Keep the dashboard concise.
    recommendations = recommendations[:5]

    # ==========================================
    # DEFAULT
    # ==========================================

    if not recommendations:

        if risk_level == "LOW":
            recommendations.append(
                "Continue regular monitoring and review upcoming project milestones."
            )

        elif risk_level == "MEDIUM":
            recommendations.append(
                "Increase monitoring frequency and review corrective actions."
            )

        else:
            recommendations.append(
                "Initiate senior-level review and prepare a project recovery plan."
            )

    return recommendations