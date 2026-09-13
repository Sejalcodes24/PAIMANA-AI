import pandas as pd
import numpy as np
import os

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import GradientBoostingClassifier


# ============================================
# PATH
# ============================================

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "ml_prediction_data.csv"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "early_warning_results.csv"
)


# ============================================
# CONFIGURATION
# ============================================

RISK_THRESHOLD = 0.70

MONTH_ORDER = {
    "Jan_2026": 1,
    "Feb_2026": 2,
    "March_2026": 3,
    "April_2026": 4,
    "May_2026": 5,
    "June_2026": 6,
    "July_2026": 7
}


# ============================================
# LOAD DATA
# ============================================

print("\n================================")
print("PAIMANA AI - EARLY WARNING")
print("================================")

df = pd.read_csv(INPUT_FILE)

print("\nDataset shape:", df.shape)

df["month_number"] = df["snapshot_month"].map(MONTH_ORDER)

df = df.sort_values(
    ["project_code", "month_number"]
).reset_index(drop=True)


# ============================================
# FEATURES
# ============================================

TARGET = "future_risk"

drop_columns = [
    TARGET,
    "month_number",
    "project_code",
    "project_name",
    "snapshot_month"
]

categorical_features = [
    "sector",
    "line_ministry",
    "implementing_agency"
]

numerical_features = [
    column
    for column in df.columns
    if column not in drop_columns + categorical_features
]


# ============================================
# STORAGE FOR PREDICTIONS
# ============================================

all_predictions = []


# ============================================
# ROLLING TIME-BASED PREDICTION
# ============================================

# We need previous months for training.
# Start prediction from March so that
# multiple monthly risk snapshots can be tracked.

prediction_months = [3, 4, 5, 6]


for prediction_month in prediction_months:

    print("\n--------------------------------")
    print(
        f"Predicting month number: "
        f"{prediction_month}"
    )
    print("--------------------------------")


    # ----------------------------------------
    # TRAIN ONLY ON PREVIOUS MONTHS
    # ----------------------------------------

    train_df = df[
        df["month_number"] < prediction_month
    ].copy()

    current_df = df[
        df["month_number"] == prediction_month
    ].copy()


    if train_df.empty or current_df.empty:
        continue


    X_train = train_df.drop(
        columns=drop_columns
    )

    y_train = train_df[TARGET]

    X_current = current_df.drop(
        columns=drop_columns
    )


    # ----------------------------------------
    # PREPROCESSING
    # ----------------------------------------

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median")
            )
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                )
            ),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore"
                )
            )
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                numeric_pipeline,
                numerical_features
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_features
            )
        ]
    )


    # ----------------------------------------
    # GRADIENT BOOSTING
    # ----------------------------------------

    classifier = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=3,
        random_state=42
    )


    model = Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessor
            ),
            (
                "classifier",
                classifier
            )
        ]
    )


    # ----------------------------------------
    # TRAIN
    # ----------------------------------------

    model.fit(
        X_train,
        y_train
    )

    print(
        f"Training rows: {len(train_df)}"
    )

    print(
        f"Prediction rows: {len(current_df)}"
    )


    # ----------------------------------------
    # PREDICT RISK PROBABILITY
    # ----------------------------------------

    risk_probability = model.predict_proba(
        X_current
    )[:, 1]


    current_predictions = pd.DataFrame({
        "project_code":
            current_df["project_code"].values,

        "project_name":
            current_df["project_name"].values,

        "snapshot_month":
            current_df["snapshot_month"].values,

        "month_number":
            current_df["month_number"].values,

        "risk_probability":
            risk_probability
    })


    all_predictions.append(
        current_predictions
    )


# ============================================
# COMBINE PREDICTIONS
# ============================================

predictions_df = pd.concat(
    all_predictions,
    ignore_index=True
)

predictions_df = predictions_df.sort_values(
    ["project_code", "month_number"]
).reset_index(drop=True)


# ============================================
# RISK TREND
# ============================================

predictions_df["previous_risk"] = (
    predictions_df
    .groupby("project_code")["risk_probability"]
    .shift(1)
)

predictions_df["risk_change"] = (
    predictions_df["risk_probability"]
    -
    predictions_df["previous_risk"]
)


# ============================================
# CHECK RISK INCREASE
# ============================================

predictions_df["risk_increasing"] = (
    predictions_df["risk_change"] > 0
)


# ============================================
# THREE-SNAPSHOT INCREASING TREND
# ============================================

# Risk must increase across 3 consecutive
# month-to-month transitions.

predictions_df["increase_1"] = (
    predictions_df
    .groupby("project_code")["risk_probability"]
    .diff(1) > 0
)

predictions_df["increase_2"] = (
    predictions_df
    .groupby("project_code")["increase_1"]
    .shift(1)
)

predictions_df["sustained_increase"] = (
    predictions_df["increase_1"]
    &
    predictions_df["increase_2"]
)
# ============================================
# MEANINGFUL RISK INCREASE
# ============================================

# Require at least a 5 percentage-point
# increase compared with two snapshots earlier.

predictions_df["meaningful_increase"] = (
    predictions_df["risk_probability"]
    -
    predictions_df
    .groupby("project_code")["risk_probability"]
    .shift(2)
    >= 0.05
)


# ============================================
# EARLY WARNING
# ============================================

predictions_df["early_warning"] = (
    (predictions_df["risk_probability"]
     >= RISK_THRESHOLD)
    &
    predictions_df["sustained_increase"]
    &
    predictions_df["meaningful_increase"]
)


# ============================================
# RISK LEVEL
# ============================================

def get_risk_level(probability):

    if probability >= 0.70:
        return "HIGH"

    elif probability >= 0.40:
        return "MEDIUM"

    else:
        return "LOW"


predictions_df["risk_level"] = (
    predictions_df["risk_probability"]
    .apply(get_risk_level)
)


# ============================================
# WARNING REASON
# ============================================

def get_warning_reason(row):

    if row["early_warning"]:

        return (
            "Risk probability is above 70%, "
            "has increased across consecutive "
            "snapshots, and shows a meaningful "
            "upward trend."
        )

    elif row["risk_probability"] >= RISK_THRESHOLD:

        return (
            "Risk probability is above 70%, "
            "but a sustained increasing trend "
            "has not yet been confirmed."
        )

    else:

        return (
            "No early warning condition detected."
        )


predictions_df["warning_reason"] = (
    predictions_df.apply(
        get_warning_reason,
        axis=1
    )
)


# ============================================
# ROUND VALUES
# ============================================

predictions_df["risk_probability"] = (
    predictions_df["risk_probability"]
    .round(4)
)

predictions_df["risk_change"] = (
    predictions_df["risk_change"]
    .round(4)
)


# ============================================
# SAVE
# ============================================

predictions_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ============================================
# SUMMARY
# ============================================

print("\n================================")
print("EARLY WARNING SUMMARY")
print("================================")

print(
    "\nTotal prediction rows:",
    len(predictions_df)
)

print(
    "Projects monitored:",
    predictions_df["project_code"]
    .nunique()
)

print(
    "High-risk predictions:",
    (
        predictions_df["risk_level"] == "HIGH"
    ).sum()
)

print(
    "Early warnings generated:",
    predictions_df["early_warning"].sum()
)


# ============================================
# SHOW EARLY WARNINGS
# ============================================

warnings = predictions_df[
    predictions_df["early_warning"]
].copy()


print("\n================================")
print("EARLY WARNING PROJECTS")
print("================================")


if warnings.empty:

    print(
        "\nNo projects currently satisfy "
        "the early-warning condition."
    )

else:

    print(
        warnings[
            [
                "project_code",
                "project_name",
                "snapshot_month",
                "risk_probability",
                "risk_change",
                "risk_level",
                "warning_reason"
            ]
        ].to_string(index=False)
    )


print("\n================================")
print("EARLY WARNING COMPLETED")
print("================================")

print("\nResults saved to:")
print(OUTPUT_FILE)