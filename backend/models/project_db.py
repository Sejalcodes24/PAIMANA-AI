from sqlalchemy import Column, Integer, String, Float
from database import Base


class ProjectDB(Base):
    __tablename__ = "projects"

    project_id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(255), nullable=False)
    state = Column(String(100), nullable=False)
    sector = Column(String(100), nullable=False)

    original_cost = Column(Float, nullable=False)
    current_cost = Column(Float, nullable=False)

    physical_progress = Column(Float, nullable=False)
    financial_progress = Column(Float, nullable=False)