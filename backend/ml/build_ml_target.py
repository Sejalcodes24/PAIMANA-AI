import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "ml_features.csv"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "ml_prediction_data.csv"
)

df = pd.read_csv(INPUT_FILE)

print("Original dataset:", df.shape)

# ---------------------------------------------------------
# 1. Sort projects chronologically
# ---------------------------------------------------------

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

df = df.sort_values(
    ["project_code", "month_number"]
).reset_index(drop=True)

# ---------------------------------------------------------
# 2. Get NEXT snapshot values
# ---------------------------------------------------------

df["next_physical_progress"] = (
    df.groupby("project_code")["physical_progress"]
    .shift(-1)
)

df["next_expenditure_ratio"] = (
    df.groupby("project_code")["expenditure_ratio"]
    .shift(-1)
)

# ---------------------------------------------------------
# 3. Calculate future deterioration indicators
# ---------------------------------------------------------

# Positive value means physical progress decreased
df["future_progress_drop"] = (
    df["physical_progress"]
    - df["next_physical_progress"]
)

# Positive value means expenditure is ahead of physical progress
df["future_gap"] = (
    df["next_expenditure_ratio"]
    - df["next_physical_progress"]
)

# ---------------------------------------------------------
# 4. Define future-risk target
# ---------------------------------------------------------
#
# future_risk = 1 when:
#
# A. Physical progress drops by at least 5 percentage points
# OR
# B. Expenditure exceeds physical progress by >= 20 points
#
# This deliberately does NOT use future cost-overrun changes.
# ---------------------------------------------------------

df["future_risk"] = (
    (df["future_progress_drop"] >= 5)
    |
    (df["future_gap"] >= 20)
).astype(int)

# ---------------------------------------------------------
# 5. Remove rows without a future snapshot
# ---------------------------------------------------------

df = df[
    df["next_physical_progress"].notna()
].copy()

# ---------------------------------------------------------
# 6. Remove future/helper columns
# ---------------------------------------------------------

drop_columns = [
    "month_number",
    "next_physical_progress",
    "next_expenditure_ratio",
    "future_progress_drop",
    "future_gap"
]

df = df.drop(columns=drop_columns)

# ---------------------------------------------------------
# 7. Save prediction dataset
# ---------------------------------------------------------

df.to_csv(
    OUTPUT_FILE,
    index=False
)

print("\n================================")
print("ML PREDICTION DATA CREATED")
print("================================")

print("Shape:", df.shape)

print("\nTarget distribution:")
print(df["future_risk"].value_counts())

print("\nTarget percentage:")
print(
    df["future_risk"]
    .value_counts(normalize=True)
    .mul(100)
    .round(2)
)

print("\nTarget distribution by month:")
print(
    df.groupby("snapshot_month")["future_risk"]
    .agg(["count", "sum", "mean"])
    .round(4)
)

print("\nSaved to:")
print(OUTPUT_FILE)