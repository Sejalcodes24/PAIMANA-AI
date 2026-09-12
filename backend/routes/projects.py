from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.project_db import ProjectDB


router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


# Get projects
# Optional filters:
# /projects/
# /projects/?month=July_2026
# /projects/?month=July_2026&sector=Aviation & Aviation Infrastructure
@router.get("/")
def get_projects(
    month: str | None = None,
    sector: str | None = None,
    db: Session = Depends(get_db)
):

    query = db.query(ProjectDB)

    # Month filter
    if month:
        query = query.filter(
            ProjectDB.snapshot_month == month
        )

    # Sector filter
    if sector:
        query = query.filter(
            ProjectDB.sector == sector
        )

    projects = query.all()

    return projects


# Get single project
@router.get("/{project_id}")
def get_project(
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

    return project