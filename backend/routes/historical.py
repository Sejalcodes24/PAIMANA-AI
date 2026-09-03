from fastapi import APIRouter
import pandas as pd
import os

router = APIRouter(
    prefix="/historical-projects",
    tags=["Historical Projects"]
)


@router.get("/")
def get_historical_projects():

    file_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "data",
        "historical_projects_clean.csv"
    )

    if not os.path.exists(file_path):
        return {
            "error": "historical_projects_clean.csv not found",
            "path": file_path
        }

    df = pd.read_csv(file_path)

    df = df.astype(object)
    df = df.where(pd.notnull(df), None)

    return df.to_dict(orient="records")