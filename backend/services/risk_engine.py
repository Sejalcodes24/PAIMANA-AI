def calculate_cost_risk(project):

    cost_growth = (
        (project["current_cost"] - project["original_cost"])
        / project["original_cost"]
    ) * 100

    if cost_growth >= 20:
        risk = 90
    elif cost_growth >= 10:
        risk = 70
    elif cost_growth >= 5:
        risk = 40
    else:
        risk = 20

    return risk


def calculate_delay_risk(project):

    progress_gap = (
        project["physical_progress"]
        - project["financial_progress"]
    )

    if progress_gap <= -10:
        risk = 90
    elif progress_gap <= -5:
        risk = 70
    elif progress_gap <= 0:
        risk = 50
    else:
        risk = 30

    return risk


def calculate_overall_risk(project):

    cost_risk = calculate_cost_risk(project)
    delay_risk = calculate_delay_risk(project)

    overall = (
        cost_risk * 0.4 +
        delay_risk * 0.6
    )

    return round(overall)