from fastapi import APIRouter
import pandas as pd
import os


router = APIRouter(
    prefix="/paimana-projects",
    tags=["PAIMANA Projects"]
)


def get_monthly_data():

    file_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "data",
        "paimana_monthly_combined.csv"
    )

    if not os.path.exists(file_path):
        return None

    return pd.read_csv(file_path)


# 1. Get available months
@router.get("/months")
def get_available_months():

    df = get_monthly_data()

    if df is None:
        return {
            "error": "paimana_monthly_combined.csv not found"
        }

    months = (
        df["snapshot_month"]
        .dropna()
        .unique()
        .tolist()
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

    months.sort(
        key=lambda x: month_order.get(x, 999)
    )

    return {
        "months": months
    }


# 2. Get projects for selected month
# Pagination prevents Swagger/frontend from loading thousands
# of records at once.
@router.get("/")
def get_paimana_projects(
    month: str = None,
    page: int = 1,
    limit: int = 50
):

    df = get_monthly_data()

    if df is None:
        return {
            "error": "paimana_monthly_combined.csv not found"
        }

    if page < 1:
        return {
            "error": "page must be 1 or greater"
        }

    if limit < 1 or limit > 100:
        return {
            "error": "limit must be between 1 and 100"
        }

    if month:
        df = df[
            df["snapshot_month"] == month
        ]

    total_projects = len(df)

    start = (page - 1) * limit
    end = start + limit

    paginated_df = df.iloc[start:end]

    paginated_df = paginated_df.astype(object)

    paginated_df = paginated_df.where(
        pd.notnull(paginated_df),
        None
    )

    return {
        "month": month,
        "page": page,
        "limit": limit,
        "total_projects": total_projects,
        "total_pages": (
            total_projects + limit - 1
        ) // limit,
        "projects": paginated_df.to_dict(
            orient="records"
        )
    }


# 3. Get monthly history of one project
@router.get("/{project_code}/history")
def get_project_history(project_code: int):

    df = get_monthly_data()

    if df is None:
        return {
            "error": "paimana_monthly_combined.csv not found"
        }

    df = df[
        df["project_code"] == project_code
    ]

    if df.empty:
        return {
            "error": "Project not found"
        }

    df = df.astype(object)

    df = df.where(
        pd.notnull(df),
        None
    )

    return {
        "project_code": project_code,
        "history": df.to_dict(
            orient="records"
        )
    }