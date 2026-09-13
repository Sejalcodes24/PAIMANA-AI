import os
import re
import pandas as pd

from database import SessionLocal
from models.project_db import ProjectDB


# =====================================================
# MONTH -> FILE MAPPING
# =====================================================

MONTHLY_FOLDER = os.path.join(
    os.path.dirname(__file__),
    "data",
    "monthly"
)

MONTH_FILES = {
    "Jan_2026": "Jan_2026_clean (1).csv",
    "Feb_2026": "Feb_2026_clean (1).csv",
    "March_2026": "March_2026_clean (1).csv",
    "April_2026": "April_2026_clean (1).csv",
    "May_2026": "May_2026_clean (1).csv",
    "June_2026": "June_2026_clean (1).csv",
    "July_2026": "July_2026.csv"
}


# =====================================================
# HEADER NORMALIZATION
# =====================================================

def normalize_header(value):
    """
    Converts different header formats into one
    standard format.

    Example:
        'Original Cost\n(in cr.)'
        -> 'original_cost'

        'Sector Name'
        -> 'sector'
    """

    value = str(value).strip().lower()

    value = value.replace("\n", " ")
    value = re.sub(r"\s+", " ", value)

    header_map = {

        "sr. no.": "sr_no",
        "sr no.": "sr_no",
        "sr no": "sr_no",

        "sector name": "sector",
        "sector": "sector",

        "line ministry": "line_ministry",
        "ministry": "line_ministry",

        "implementing agency":
            "implementing_agency",

        "project code":
            "project_code",

        "project name":
            "project_name",

        "original cost (in cr.)":
            "original_cost",

        "original cost (in cr)":
            "original_cost",

        "original cost":
            "original_cost",

        "revised cost (in cr.)":
            "revised_cost",

        "revised cost (in cr)":
            "revised_cost",

        "revised cost":
            "revised_cost",

        "expenditure (in cr.)":
            "expenditure",

        "expenditure (in cr)":
            "expenditure",

        "expenditure":
            "expenditure",

        "physical progress (in %)":
            "physical_progress",

        "physical progress (%)":
            "physical_progress",

        "physical progress":
            "physical_progress",

        "original date of commissioning":
            "original_completion_date",

        "original completion date":
            "original_completion_date",

        "revised date of commissioning":
            "revised_completion_date",

        "revised completion date":
            "revised_completion_date",

        "sanction date":
            "sanction_date",

        "cost overrun percent":
            "cost_overrun_percent",

        "cost overrun %":
            "cost_overrun_percent",

        "expenditure ratio":
            "expenditure_ratio",

        "snapshot month":
            "snapshot_month"
    }

    return header_map.get(
        value,
        value
    )


# =====================================================
# CLEAN TEXT
# =====================================================

def clean_text(value, default="Unknown"):

    if pd.isna(value):
        return default

    value = str(value).strip()

    if not value:
        return default

    return value


# =====================================================
# CLEAN NUMBER
# =====================================================

def clean_number(value, default=0.0):

    if pd.isna(value):
        return default

    try:

        return float(
            str(value)
            .replace(",", "")
            .strip()
        )

    except (ValueError, TypeError):

        return default


# =====================================================
# CLEAN PROJECT CODE
# =====================================================

def clean_project_code(value):

    if pd.isna(value):
        return None

    try:

        return int(
            float(value)
        )

    except (ValueError, TypeError):

        return None


# =====================================================
# CLEAN DATE
# =====================================================

def clean_date(value):

    if pd.isna(value):
        return None

    value = str(value).strip()

    if not value:
        return None

    parsed = pd.to_datetime(
        value,
        dayfirst=True,
        errors="coerce"
    )

    if pd.isna(parsed):
        return None

    return parsed.date()


# =====================================================
# READ CSV
# =====================================================

def read_monthly_csv(file_path):

    # Read first line to determine whether
    # a title row exists.
    with open(
        file_path,
        "r",
        encoding="utf-8-sig"
    ) as file:

        first_line = (
            file.readline()
            .strip()
            .strip('"')
        )

    # Jan-Jun files:
    #
    # Projects Details
    # actual headers...
    #
    if first_line == "Projects Details":

        df = pd.read_csv(
            file_path,
            skiprows=1
        )

    else:

        # July / standardized CSV
        df = pd.read_csv(
            file_path
        )

    # Normalize all headers.
    df.columns = [
        normalize_header(column)
        for column in df.columns
    ]

    return df


# =====================================================
# REQUIRED COLUMNS
# =====================================================

REQUIRED_COLUMNS = {
    "project_code",
    "project_name",
    "sector",
    "line_ministry",
    "implementing_agency",
    "original_cost",
    "revised_cost",
    "expenditure",
    "physical_progress",
    "original_completion_date",
    "revised_completion_date",
    "sanction_date"
}


# =====================================================
# VALIDATE ALL MONTHLY FILES
# =====================================================

def load_and_validate_files():

    monthly_data = {}

    total_rows = 0

    print()
    print("Validating monthly files...")
    print("--------------------------------")

    for month, filename in MONTH_FILES.items():

        file_path = os.path.join(
            MONTHLY_FOLDER,
            filename
        )

        if not os.path.exists(file_path):

            raise FileNotFoundError(
                f"Missing file: {filename}"
            )

        df = read_monthly_csv(
            file_path
        )

        # Remove completely empty rows.
        df = df.dropna(
            how="all"
        )

        missing_columns = (
            REQUIRED_COLUMNS
            - set(df.columns)
        )

        if missing_columns:

            raise ValueError(
                f"{filename} is missing columns: "
                f"{sorted(missing_columns)}"
            )

        monthly_data[month] = df

        total_rows += len(df)

        print(
            f"{month:<12} -> {len(df)} rows"
        )

    print("--------------------------------")

    print(
        f"Expected total rows: {total_rows}"
    )

    return monthly_data, total_rows


# =====================================================
# IMPORT DATA
# =====================================================

def import_monthly_data():

    db = SessionLocal()

    try:

        # -------------------------------------------------
        # VERY IMPORTANT:
        # Validate ALL files BEFORE deleting DB data.
        # -------------------------------------------------

        monthly_data, expected_total = (
            load_and_validate_files()
        )

        print()
        print(
            "All monthly files validated successfully."
        )


        # -------------------------------------------------
        # Now safe to clear old data.
        # -------------------------------------------------

        print()
        print(
            "Removing old imported data..."
        )

        db.query(ProjectDB).delete()

        db.commit()


        imported_total = 0


        # =================================================
        # IMPORT EACH MONTH
        # =================================================

        for month, df in monthly_data.items():

            month_imported = 0

            print()
            print(
                f"Importing {month}..."
            )


            for _, row in df.iterrows():

                # -----------------------------------------
                # Project code
                # -----------------------------------------

                project_code = clean_project_code(
                    row.get("project_code")
                )


                # -----------------------------------------
                # Project name
                # -----------------------------------------

                project_name = clean_text(
                    row.get("project_name")
                )


                # -----------------------------------------
                # Skip invalid rows
                # -----------------------------------------

                if (
                    project_code is None
                    or project_name.lower()
                    == "project_name"
                    or project_name == "Unknown"
                ):

                    continue


                # -----------------------------------------
                # Basic fields
                # -----------------------------------------

                sector = clean_text(
                    row.get("sector")
                )

                line_ministry = clean_text(
                    row.get("line_ministry"),
                    "Not specified"
                )

                implementing_agency = clean_text(
                    row.get("implementing_agency"),
                    "Not specified"
                )


                # -----------------------------------------
                # Financial values
                # -----------------------------------------

                original_cost = clean_number(
                    row.get("original_cost")
                )

                revised_cost = clean_number(
                    row.get("revised_cost")
                )

                expenditure = clean_number(
                    row.get("expenditure")
                )


                # -----------------------------------------
                # Physical progress
                # -----------------------------------------

                physical_progress = clean_number(
                    row.get("physical_progress")
                )


                # -----------------------------------------
                # Current cost
                # -----------------------------------------

                current_cost = (
                    revised_cost
                    if revised_cost > 0
                    else original_cost
                )


                # -----------------------------------------
                # Financial progress
                #
                # Derived from:
                # expenditure / original cost
                # -----------------------------------------

                financial_progress = 0.0

                if original_cost > 0:

                    financial_progress = min(
                        100.0,
                        (
                            expenditure
                            / original_cost
                        ) * 100
                    )


                # -----------------------------------------
                # Create database record
                # -----------------------------------------

                project = ProjectDB(

                    project_code=project_code,

                    project_name=project_name,

                    sector=sector,

                    line_ministry=line_ministry,

                    implementing_agency=implementing_agency,

                    # Current source data does not contain
                    # a dedicated state column.
                    state="Unknown",

                    original_cost=original_cost,

                    current_cost=current_cost,

                    expenditure=expenditure,

                    physical_progress=physical_progress,

                    financial_progress=financial_progress,

                    original_completion_date=clean_date(
                        row.get(
                            "original_completion_date"
                        )
                    ),

                    revised_completion_date=clean_date(
                        row.get(
                            "revised_completion_date"
                        )
                    ),

                    sanction_date=clean_date(
                        row.get(
                            "sanction_date"
                        )
                    ),

                    # Month comes from our mapping,
                    # not from CSV content.
                    snapshot_month=month,

                    snapshot_year=2026
                )


                db.add(project)

                imported_total += 1
                month_imported += 1


            print(
                f"{month} imported: "
                f"{month_imported}"
            )


        # =================================================
        # FINAL COMMIT
        # =================================================

        db.commit()


        print()
        print("================================")
        print(
            "MONTHLY DATA IMPORTED SUCCESSFULLY"
        )
        print("================================")

        print(
            f"Expected rows : {expected_total}"
        )

        print(
            f"Imported rows : {imported_total}"
        )


        if imported_total != expected_total:

            print()
            print(
                "WARNING: Some invalid rows were skipped."
            )


    except Exception as e:

        db.rollback()

        print()
        print("================================")
        print("IMPORT FAILED")
        print("================================")

        print(e)


    finally:

        db.close()


# =====================================================
# MAIN
# =====================================================

if __name__ == "__main__":

    import_monthly_data()