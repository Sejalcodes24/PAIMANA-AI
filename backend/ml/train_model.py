import pandas as pd
import os

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score
)


# ============================================
# PATH
# ============================================

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "ml_prediction_data.csv"
)


# ============================================
# LOAD DATA
# ============================================

print("\n================================")
print("PAIMANA AI - THRESHOLD TUNING")
print("================================")

df = pd.read_csv(INPUT_FILE)

print("\nDataset shape:", df.shape)


# ============================================
# MONTH ORDER
# ============================================

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


# ============================================
# TIME-BASED SPLIT
# ============================================

train_df = df[df["month_number"] <= 5].copy()
test_df = df[df["month_number"] == 6].copy()

TARGET = "future_risk"

drop_columns = [
    TARGET,
    "month_number",
    "project_code",
    "project_name",
    "snapshot_month"
]

X_train = train_df.drop(columns=drop_columns)
y_train = train_df[TARGET]

X_test = test_df.drop(columns=drop_columns)
y_test = test_df[TARGET]


# ============================================
# FEATURES
# ============================================

categorical_features = [
    "sector",
    "line_ministry",
    "implementing_agency"
]

numerical_features = [
    column
    for column in X_train.columns
    if column not in categorical_features
]


# ============================================
# PREPROCESSING
# ============================================

numeric_pipeline = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="median"))
    ]
)

numeric_pipeline_scaled = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ]
)

categorical_pipeline = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore"))
    ]
)


# ============================================
# MODELS
# ============================================

models = {

    "Logistic Regression": (
        LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=42
        ),
        True
    ),

    "Random Forest": (
        RandomForestClassifier(
            n_estimators=300,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        ),
        False
    ),

    "Gradient Boosting": (
        GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=3,
            random_state=42
        ),
        False
    )
}


# ============================================
# THRESHOLDS
# ============================================

thresholds = [
    0.30,
    0.35,
    0.40,
    0.45,
    0.50,
    0.55,
    0.60,
    0.65,
    0.70
]


# ============================================
# TRAIN MODELS
# ============================================

all_results = []


for model_name, (classifier, needs_scaling) in models.items():

    print("\n--------------------------------")
    print(f"Training: {model_name}")
    print("--------------------------------")

    if needs_scaling:

        preprocessor = ColumnTransformer(
            transformers=[
                (
                    "numeric",
                    numeric_pipeline_scaled,
                    numerical_features
                ),
                (
                    "categorical",
                    categorical_pipeline,
                    categorical_features
                )
            ]
        )

    else:

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


    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier)
        ]
    )


    model.fit(X_train, y_train)

    print("Training completed.")


    # Probability of Future Risk
    probabilities = model.predict_proba(X_test)[:, 1]


    # ========================================
    # TEST DIFFERENT THRESHOLDS
    # ========================================

    for threshold in thresholds:

        y_pred = (
            probabilities >= threshold
        ).astype(int)


        precision = precision_score(
            y_test,
            y_pred,
            zero_division=0
        )

        recall = recall_score(
            y_test,
            y_pred,
            zero_division=0
        )

        f1 = f1_score(
            y_test,
            y_pred,
            zero_division=0
        )


        all_results.append({
            "Model": model_name,
            "Threshold": threshold,
            "Precision": precision,
            "Recall": recall,
            "F1": f1
        })


# ============================================
# RESULTS
# ============================================

results_df = pd.DataFrame(all_results)

print("\n\n================================")
print("THRESHOLD RESULTS")
print("================================")


for model_name in models.keys():

    print(f"\n\n===== {model_name} =====")

    model_results = results_df[
        results_df["Model"] == model_name
    ].copy()

    display_results = model_results.copy()

    display_results[
        ["Precision", "Recall", "F1"]
    ] = display_results[
        ["Precision", "Recall", "F1"]
    ].round(4)

    print(
        display_results.to_string(
            index=False
        )
    )


# ============================================
# BEST F1 AT EACH MODEL
# ============================================

print("\n\n================================")
print("BEST F1 THRESHOLD")
print("================================")


for model_name in models.keys():

    model_results = results_df[
        results_df["Model"] == model_name
    ]

    best = model_results.loc[
        model_results["F1"].idxmax()
    ]

    print(
        f"\n{model_name}"
    )

    print(
        f"Threshold : {best['Threshold']:.2f}"
    )

    print(
        f"Precision : {best['Precision']:.4f}"
    )

    print(
        f"Recall    : {best['Recall']:.4f}"
    )

    print(
        f"F1        : {best['F1']:.4f}"
    )


# ============================================
# SAVE RESULTS
# ============================================

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "threshold_results.csv"
)

results_df.to_csv(
    OUTPUT_FILE,
    index=False
)

print("\n\n================================")
print("THRESHOLD TUNING COMPLETED")
print("================================")

print("\nResults saved to:")
print(OUTPUT_FILE)