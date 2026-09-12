from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.project_db import ProjectDB


router = APIRouter(
    prefix="/paimana-projects",
    tags=["PAIMANA Projects"]
)


# =====================================================
# AVAILABLE MONTHS
# =====================================================

@router.get("/months")
def get_available_months(
    db: Session = Depends(get_db)
):

    rows = (
        db.query(
            ProjectDB.snapshot_month,
            ProjectDB.snapshot_year
        )
        .distinct()
        .all()
    )

    month_order = {
        "Jan_2026": 1,
        "Feb_2026": 2,
        "March_2026": 3,
        "April_2026": 4,
        "May_2026": 5,
        "June_2026": 6,
        "July_2026": 7
    }

    months = [
        row.snapshot_month
        for row in rows
        if row.snapshot_month
    ]

    months = list(set(months))

    months.sort(
        key=lambda x: month_order.get(x, 999)
    )

    return {
        "months": months
    }


# =====================================================
# MONTH-WISE PROJECT DATA
# =====================================================

@router.get("/")
def get_paimana_projects(
    month: str | None = None,
    page: int = 1,
    limit: int = 100,
    db: Session = Depends(get_db)
):

    if page < 1:
        return {
            "error": "page must be 1 or greater"
        }

    if limit < 1 or limit > 100:
        return {
            "error": "limit must be between 1 and 100"
        }

    query = db.query(ProjectDB)

    # Selected month filter
    if month:
        query = query.filter(
            ProjectDB.snapshot_month == month
        )

    # Stable ordering
    query = query.order_by(
        ProjectDB.project_id
    )

    total_projects = query.count()

    offset = (page - 1) * limit

    projects = (
        query
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "month": month,
        "page": page,
        "limit": limit,
        "total_projects": total_projects,
        "total_pages": (
            (total_projects + limit - 1) // limit
            if total_projects
            else 0
        ),
        "projects": [
            {
                "project_id": project.project_id,
                "project_code": project.project_code,
                "project_name": project.project_name,
                "sector": project.sector,
                "line_ministry": project.line_ministry,
                "implementing_agency": project.implementing_agency,
                "state": project.state,
                "original_cost": project.original_cost,
                "current_cost": project.current_cost,
                "revised_cost": project.current_cost,
                "expenditure": project.expenditure,
                "physical_progress": project.physical_progress,
                "financial_progress": project.financial_progress,
                "original_completion_date": (
                    project.original_completion_date.isoformat()
                    if project.original_completion_date
                    else None
                ),
                "revised_completion_date": (
                    project.revised_completion_date.isoformat()
                    if project.revised_completion_date
                    else None
                ),
                "sanction_date": (
                    project.sanction_date.isoformat()
                    if project.sanction_date
                    else None
                ),
                "snapshot_month": project.snapshot_month,
                "snapshot_year": project.snapshot_year
            }
            for project in projects
        ]
    }


# =====================================================
# PROJECT HISTORY
# =====================================================

@router.get("/{project_code}/history")
def get_project_history(
    project_code: int,
    db: Session = Depends(get_db)
):

    projects = (
        db.query(ProjectDB)
        .filter(
            ProjectDB.project_code == project_code
        )
        .order_by(
            ProjectDB.snapshot_year,
            ProjectDB.project_id
        )
        .all()
    )

    if not projects:
        return {
            "error": "Project not found"
        }

    return {
        "project_code": project_code,
        "history": [
            {
                "project_id": project.project_id,
                "project_code": project.project_code,
                "project_name": project.project_name,
                "sector": project.sector,
                "line_ministry": project.line_ministry,
                "implementing_agency": project.implementing_agency,
                "state": project.state,
                "original_cost": project.original_cost,
                "current_cost": project.current_cost,
                "expenditure": project.expenditure,
                "physical_progress": project.physical_progress,
                "financial_progress": project.financial_progress,
                "snapshot_month": project.snapshot_month,
                "snapshot_year": project.snapshot_year
            }
            for project in projects
        ]
    }