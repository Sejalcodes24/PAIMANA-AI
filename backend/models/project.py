from pydantic import BaseModel


class Project(BaseModel):
    project_id: int
    project_name: str
    state: str
    sector: str

    original_cost: float
    current_cost: float

    physical_progress: float
    financial_progress: float