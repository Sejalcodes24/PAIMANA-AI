from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.project_db import ProjectDB


router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)


@router.get("/")
def get_projects(
    db: Session = Depends(get_db)
):

    projects = db.query(ProjectDB).all()

    return projects


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