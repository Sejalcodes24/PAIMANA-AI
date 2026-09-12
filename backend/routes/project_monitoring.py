from fastapi import APIRouter
from fastapi.responses import FileResponse
import pandas as pd
import os


router = APIRouter(
    prefix="/project-monitoring",
    tags=["Project Monitoring"]
)


# --------------------------------------------------
# Common paths
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

DATA_FILE = os.path.join(
    BASE_DIR,
    "data",
    "paimana_monthly_combined.csv"
)

PDF_DIR = os.path.join(
    BASE_DIR,
    "data",
    "flash_reports"
)


# --------------------------------------------------
# Load monthly PAIMANA data
# --------------------------------------------------

def get_monthly_data():

    if not os.path.exists(DATA_FILE):
        return None

    return pd.read_csv(DATA_FILE)


# --------------------------------------------------
# 1. Flash Report list
# --------------------------------------------------

@router.get("/reports")
def get_flash_reports():

    reports = []

    report_files = {
        "April_2026": "FlashReport_April2026.pdf",
        "May_2026": "FlashReport_May2026.pdf",
        "June_2026": "FlashReport_June_2026.pdf",
        "July_2026": "FlashReport_July_2026.pdf"
    }

    for month, filename in report_files.items():

        file_path = os.path.join(
            PDF_DIR,
            filename
        )

        reports.append({
            "month": month,
            "file_name": filename,
            "available": os.path.exists(file_path),
            "url": f"/project-monitoring/reports/{month}"
        })

    return {
        "reports": reports
    }

# --------------------------------------------------
# 2. Open specific Flash Report PDF
# --------------------------------------------------

@router.get("/reports/{month}")
def get_flash_report(month: str):

    report_files = {
        "April_2026": "FlashReport_April2026.pdf",
        "May_2026": "FlashReport_May2026.pdf",
        "June_2026": "FlashReport_June_2026.pdf",
        "July_2026": "FlashReport_July_2026.pdf"
    }

    if month not in report_files:
        return {
            "error": "Report not found"
        }

    file_path = os.path.join(
        PDF_DIR,
        report_files[month]
    )

    if not os.path.exists(file_path):
        return {
            "error": "PDF file not available"
        }

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=report_files[month]
    )

# --------------------------------------------------
# 3. Ministry-wise data
# --------------------------------------------------

@router.get("/ministry")
def get_ministry_wise(month: str = "July_2026"):

    df = get_monthly_data()

    if df is None:
        return {
            "error": "PAIMANA monthly dataset not found"
        }

    current_df = df[
        df["snapshot_month"] == month
    ].copy()

    if current_df.empty:
        return {
            "error": f"No data found for {month}"
        }

    month_order = [
        "Jan_2026",
        "Feb_2026",
        "March_2026",
        "April_2026",
        "May_2026",
        "June_2026",
        "July_2026"
    ]

    if month not in month_order:
        return {
            "error": "Invalid month"
        }

    month_index = month_order.index(month)

    previous_df = pd.DataFrame()

    if month_index > 0:

        previous_month = month_order[month_index - 1]

        previous_df = df[
            df["snapshot_month"] == previous_month
        ].copy()

    results = []

    for ministry, group in current_df.groupby(
        "line_ministry",
        dropna=False
    ):

        ministry = (
            str(ministry)
            if pd.notna(ministry)
            else "Unknown"
        )

        project_codes = set(
            group["project_code"].dropna().tolist()
        )

        if not previous_df.empty:

            previous_group = previous_df[
                previous_df["line_ministry"] == ministry
            ]

            previous_codes = set(
                previous_group["project_code"]
                .dropna()
                .tolist()
            )

            newly_added = len(
                project_codes - previous_codes
            )

        else:
            newly_added = None

        original_cost = (
            pd.to_numeric(
                group["original_cost"],
                errors="coerce"
            )
            .fillna(0)
            .sum()
        )

        latest_cost = (
            pd.to_numeric(
                group["revised_cost"],
                errors="coerce"
            )
            .fillna(0)
            .sum()
        )

        expenditure = (
            pd.to_numeric(
                group["expenditure"],
                errors="coerce"
            )
            .fillna(0)
            .sum()
        )

        results.append({
            "ministry": ministry,
            "project_count": int(len(project_codes)),
            "original_cost": float(round(original_cost, 2)),
            "latest_cost": float(round(latest_cost, 2)),
            "expenditure": float(round(expenditure, 2)),
            "newly_added_projects": (
                int(newly_added)
                if newly_added is not None
                else None
            )
        })

    results.sort(
        key=lambda x: x["project_count"],
        reverse=True
    )

    return {
        "month": month,
        "ministries": results
    }


# --------------------------------------------------
# 4. Sector-wise data
# --------------------------------------------------

@router.get("/sector")
def get_sector_wise(month: str = "July_2026"):

    df = get_monthly_data()

    if df is None:
        return {
            "error": "PAIMANA monthly dataset not found"
        }

    current_df = df[
        df["snapshot_month"] == month
    ].copy()

    if current_df.empty:
        return {
            "error": f"No data found for {month}"
        }

    month_order = [
        "Jan_2026",
        "Feb_2026",
        "March_2026",
        "April_2026",
        "May_2026",
        "June_2026",
        "July_2026"
    ]

    if month not in month_order:
        return {
            "error": "Invalid month"
        }

    month_index = month_order.index(month)

    previous_df = pd.DataFrame()

    if month_index > 0:

        previous_month = month_order[
            month_index - 1
        ]

        previous_df = df[
            df["snapshot_month"] == previous_month
        ].copy()

    results = []

    for sector, group in current_df.groupby(
        "sector",
        dropna=False
    ):

        sector = (
            str(sector)
            if pd.notna(sector)
            else "Unknown"
        )

        project_codes = set(
            group["project_code"].dropna().tolist()
        )

        if not previous_df.empty:

            previous_group = previous_df[
                previous_df["sector"] == sector
            ]

            previous_codes = set(
                previous_group["project_code"]
                .dropna()
                .tolist()
            )

            newly_added = len(
                project_codes - previous_codes
            )

        else:
            newly_added = None

        original_cost = (
            pd.to_numeric(
                group["original_cost"],
                errors="coerce"
            )
            .fillna(0)
            .sum()
        )

        latest_cost = (
            pd.to_numeric(
                group["revised_cost"],
                errors="coerce"
            )
            .fillna(0)
            .sum()
        )

        expenditure = (
            pd.to_numeric(
                group["expenditure"],
                errors="coerce"
            )
            .fillna(0)
            .sum()
        )

        results.append({
            "sector": sector,
            "project_count": int(len(project_codes)),
            "original_cost": float(round(original_cost, 2)),
            "latest_cost": float(round(latest_cost, 2)),
            "expenditure": float(round(expenditure, 2)),
            "newly_added_projects": (
                int(newly_added)
                if newly_added is not None
                else None
            )
        })

    results.sort(
        key=lambda x: x["project_count"],
        reverse=True
    )

    return {
        "month": month,
        "sectors": results
    }