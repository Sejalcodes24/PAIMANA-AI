from sqlalchemy import Column, Integer, String, Float, Date
from database import Base


class ProjectDB(Base):
    __tablename__ = "projects"

    project_id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    project_code = Column(
        Integer,
        index=True,
        nullable=True
    )

    project_name = Column(
        String(1000),
        nullable=False
    )

    sector = Column(
        String(255),
        nullable=False
    )

    line_ministry = Column(
        String(255),
        nullable=True
    )

    implementing_agency = Column(
        String(255),
        nullable=True
    )

    state = Column(
        String(100),
        nullable=False,
        default="Unknown"
    )

    original_cost = Column(
        Float,
        nullable=False,
        default=0
    )

    current_cost = Column(
        Float,
        nullable=False,
        default=0
    )

    expenditure = Column(
        Float,
        nullable=False,
        default=0
    )

    physical_progress = Column(
        Float,
        nullable=False,
        default=0
    )

    financial_progress = Column(
        Float,
        nullable=False,
        default=0
    )

    original_completion_date = Column(
        Date,
        nullable=True
    )

    revised_completion_date = Column(
        Date,
        nullable=True
    )

    sanction_date = Column(
        Date,
        nullable=True
    )

    snapshot_month = Column(
        String(20),
        index=True,
        nullable=False
    )

    snapshot_year = Column(
        Integer,
        index=True,
        nullable=False
    )