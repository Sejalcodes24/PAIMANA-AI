import pandas as pd
import os


# --------------------------------------------------
# 1. Paths
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "paimana_monthly_combined.csv"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "ml_features.csv"
)


# --------------------------------------------------
# 2. Load data
# --------------------------------------------------

df = pd.read_csv(INPUT_FILE)

print("Original dataset shape:", df.shape)


# --------------------------------------------------
# 3. Define correct month order
# --------------------------------------------------

month_order = {
    "Jan_2026": 1,
    "Feb_2026": 2,
    "March_2026": 3,
    "April_2026": 4,
    "May_2026": 5,
    "June_2026": 6,
    "July_2026": 7
}

df["month_number"] = df["snapshot_month"].map(month_order)


# --------------------------------------------------
# 4. Sort project histories chronologically
# --------------------------------------------------

df = df.sort_values(
    by=["project_code", "month_number"]
).reset_index(drop=True)


# --------------------------------------------------
# 5. Convert numeric columns
# --------------------------------------------------

numeric_columns = [
    "original_cost",
    "revised_cost",
    "expenditure",
    "physical_progress",
    "cost_overrun_percent",
    "expenditure_ratio"
]

for column in numeric_columns:
    df[column] = pd.to_numeric(
        df[column],
        errors="coerce"
    )


# --------------------------------------------------
# 6. Calculate time elapsed between observations
# --------------------------------------------------

df["months_elapsed"] = (
    df.groupby("project_code")["month_number"]
    .diff()
)


# --------------------------------------------------
# 7. Calculate changes
# --------------------------------------------------

df["progress_change"] = (
    df.groupby("project_code")["physical_progress"]
    .diff()
)

df["expenditure_change"] = (
    df.groupby("project_code")["expenditure_ratio"]
    .diff()
)


# --------------------------------------------------
# 8. Calculate monthly velocity
# --------------------------------------------------

df["progress_velocity"] = (
    df["progress_change"]
    / df["months_elapsed"]
)

df["expenditure_velocity"] = (
    df["expenditure_change"]
    / df["months_elapsed"]
)


# --------------------------------------------------
# 9. Progress vs expenditure gap
# --------------------------------------------------

df["progress_expenditure_gap"] = (
    df["expenditure_ratio"]
    - df["physical_progress"]
)


# --------------------------------------------------
# 10. Change in progress-expenditure gap
# --------------------------------------------------

df["gap_change"] = (
    df.groupby("project_code")["progress_expenditure_gap"]
    .diff()
)


# --------------------------------------------------
# 11. Cost escalation
# --------------------------------------------------

df["revised_cost_clean"] = df["revised_cost"].replace(
    0,
    pd.NA
)

df["cost_escalation_percent"] = (
    (
        (df["revised_cost_clean"] - df["original_cost"])
        / df["original_cost"]
    ) * 100
)


# --------------------------------------------------
# 12. Number of months observed for project
# --------------------------------------------------

df["months_observed"] = (
    df.groupby("project_code")["project_code"]
    .transform("count")
)


# --------------------------------------------------
# 13. Project age and schedule pressure
# --------------------------------------------------

# Convert monthly snapshot into an actual date
df["snapshot_date"] = pd.to_datetime(
    df["snapshot_month"].str.replace("_2026", ""),
    format="%B",
    errors="coerce"
).apply(
    lambda x: x.replace(year=2026)
    if pd.notna(x)
    else pd.NaT
)


# Convert project dates
df["sanction_date"] = pd.to_datetime(
    df["sanction_date"],
    dayfirst=True,
    errors="coerce"
)

df["original_completion_date"] = pd.to_datetime(
    df["original_completion_date"],
    dayfirst=True,
    errors="coerce"
)

df["revised_completion_date"] = pd.to_datetime(
    df["revised_completion_date"],
    dayfirst=True,
    errors="coerce"
)


# --------------------------------------------------
# 14. Calculate project age
# --------------------------------------------------

df["project_age"] = (
    (df["snapshot_date"] - df["sanction_date"]).dt.days
    / 30.44
)


# --------------------------------------------------
# 15. Determine expected completion date
# --------------------------------------------------

df["completion_date"] = (
    df["revised_completion_date"]
    .fillna(df["original_completion_date"])
)


# --------------------------------------------------
# 16. Calculate months remaining
# --------------------------------------------------

df["months_to_completion"] = (
    (df["completion_date"] - df["snapshot_date"]).dt.days
    / 30.44
)


# --------------------------------------------------
# 17. Calculate remaining physical progress
# --------------------------------------------------

df["remaining_progress"] = (
    100 - df["physical_progress"]
)


# --------------------------------------------------
# 18. Required progress per month
# --------------------------------------------------

df["required_progress_per_month"] = (
    df["remaining_progress"]
    / df["months_to_completion"].clip(lower=1)
)


# --------------------------------------------------
# 19. Schedule pressure
# --------------------------------------------------

df["schedule_pressure"] = (
    df["required_progress_per_month"]
    / df["progress_velocity"].clip(lower=0.1)
)


# --------------------------------------------------
# 20. Keep useful ML columns
# --------------------------------------------------

feature_columns = [
    "project_code",
    "project_name",
    "sector",
    "line_ministry",
    "implementing_agency",
    "snapshot_month",

    "original_cost",
    "revised_cost",
    "expenditure",
    "physical_progress",
    "expenditure_ratio",
    "cost_overrun_percent",

    "progress_change",
    "expenditure_change",
    "progress_velocity",
    "expenditure_velocity",
    "months_elapsed",

    "progress_expenditure_gap",
    "gap_change",

    "cost_escalation_percent",
    "months_observed",

    "project_age",
    "months_to_completion",
    "remaining_progress",
    "required_progress_per_month",
    "schedule_pressure"
]


# --------------------------------------------------
# 21. Create ML dataset
# --------------------------------------------------

ml_df = df[feature_columns].copy()


# --------------------------------------------------
# 22. Save dataset
# --------------------------------------------------

ml_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# --------------------------------------------------
# 23. Validation
# --------------------------------------------------

print("\nML feature dataset created successfully.")

print("Shape:", ml_df.shape)

print("\nColumns:")
print(ml_df.columns.tolist())

print("\nMissing values:")
print(
    ml_df.isnull().sum()
)

print("\nSample:")
print(
    ml_df.head(10).to_string()
)

print("\nSaved to:")
print(OUTPUT_FILE)