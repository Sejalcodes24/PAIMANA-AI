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


# --------------------------------------------------
# 5. State-wise data for Map Analysis
# --------------------------------------------------

@router.get("/state")
def get_state_wise(month: str = "July_2026"):

    # Currently state-wise source is available
    # for July 2026.
    if month != "July_2026":
        return {
            "month": month,
            "states": [],
            "message": "State-wise dataset currently available for July 2026 only."
        }

    state_file = os.path.join(
        BASE_DIR,
        "data",
        "statewise",
        "July_2026_State-Wise.csv"
    )

    if not os.path.exists(state_file):
        return {
            "error": "July 2026 state-wise dataset not found"
        }

    # First row is only:
    # "State Wise Details"
    df = pd.read_csv(
        state_file,
        skiprows=1,
        header=None,
        names=[
            "s_no",
            "state",
            "project_count",
            "costs",
            "expenditure"
        ]
    )

    # Remove empty rows
    df = df.dropna(
        how="all"
    )

    results = []

    for _, row in df.iterrows():

        state = str(
            row["state"]
        ).strip()

        if not state or state.lower() == "nan":
            continue

        project_count = pd.to_numeric(
            row["project_count"],
            errors="coerce"
        )

        expenditure = pd.to_numeric(
            row["expenditure"],
            errors="coerce"
        )

        costs = str(
            row["costs"]
        ).strip()

        # Expected format:
        # Original Cost (Revised Cost)
        original_cost = 0.0
        revised_cost = 0.0

        if "(" in costs and ")" in costs:

            try:
                original_part = (
                    costs.split("(")[0]
                    .strip()
                )

                revised_part = (
                    costs.split("(")[1]
                    .replace(")", "")
                    .strip()
                )

                original_cost = float(
                    original_part
                    .replace(",", "")
                )

                revised_cost = float(
                    revised_part
                    .replace(",", "")
                )

            except (ValueError, IndexError):
                pass

        results.append({
            "state": state,
            "project_count": (
                int(project_count)
                if pd.notna(project_count)
                else 0
            ),
            "original_cost": round(
                original_cost,
                2
            ),
            "revised_cost": round(
                revised_cost,
                2
            ),
            "expenditure": round(
                float(expenditure)
                if pd.notna(expenditure)
                else 0.0,
                2
            )
        })

    return {
        "month": "July_2026",
        "states": results
    }

# --------------------------------------------------
# 5. July 2026 State-wise data
# --------------------------------------------------

STATEWISE_DIR = os.path.join(
    BASE_DIR,
    "data",
    "statewise"
)


@router.get("/state")
def get_state_wise(month: str = "July_2026"):

    if month != "July_2026":
        return {
            "error": "State-wise data is currently available only for July 2026"
        }

    file_path = os.path.join(
        STATEWISE_DIR,
        "July_2026_State-Wise.csv"
    )

    if not os.path.exists(file_path):
        return {
            "error": "July 2026 state-wise CSV not found"
        }

    try:

        # File structure:
        #
        # "State Wise Details"
        #
        # "1","Maharashtra","182",
        # "535255.42 (601442.86)",
        # "454254.95"

        df = pd.read_csv(
            file_path,
            skiprows=1,
            header=None,
            names=[
                "sr_no",
                "state",
                "project_count",
                "cost",
                "expenditure"
            ]
        )

        # Remove completely empty rows
        df = df.dropna(
            how="all"
        )

        results = []

        for _, row in df.iterrows():

            state = str(
                row["state"]
            ).strip()

            if not state or state.lower() == "nan":
                continue

            # Project count
            try:
                project_count = int(
                    float(
                        row["project_count"]
                    )
                )
            except (
                ValueError,
                TypeError
            ):
                project_count = 0

            # --------------------------------------------------
            # Cost field:
            #
            # 535255.42 (601442.86)
            #
            # first value  = original cost
            # second value = latest/revised cost
            # --------------------------------------------------

            cost_text = str(
                row["cost"]
            ).strip()

            original_cost = 0.0
            latest_cost = 0.0

            try:

                if "(" in cost_text:

                    original_part = (
                        cost_text
                        .split("(")[0]
                        .strip()
                    )

                    latest_part = (
                        cost_text
                        .split("(")[1]
                        .replace(")", "")
                        .strip()
                    )

                    original_cost = float(
                        original_part
                    )

                    latest_cost = float(
                        latest_part
                    )

                else:

                    original_cost = float(
                        cost_text
                    )

                    latest_cost = (
                        original_cost
                    )

            except (
                ValueError,
                TypeError
            ):

                original_cost = 0.0
                latest_cost = 0.0

            # Expenditure
            try:

                expenditure = float(
                    str(
                        row["expenditure"]
                    )
                    .replace(",", "")
                    .strip()
                )

            except (
                ValueError,
                TypeError
            ):

                expenditure = 0.0

            results.append({

                "state": state,

                "project_count":
                    project_count,

                "original_cost":
                    round(
                        original_cost,
                        2
                    ),

                "latest_cost":
                    round(
                        latest_cost,
                        2
                    ),

                "expenditure":
                    round(
                        expenditure,
                        2
                    )

            })

        return {

            "month": "July_2026",

            "data_as_of":
                "July 2026",

            "states": results

        }

    except Exception as e:

        return {
            "error":
                f"Failed to read state-wise data: {str(e)}"
        }