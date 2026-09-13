import pandas as pd
import os
import shap

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import GradientBoostingClassifier


# ============================================
# PATHS
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
    "shap_feature_importance.csv"
)

LOCAL_OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "shap_local_drivers.csv"
)

# ============================================
# LOAD DATA
# ============================================

print("\n================================")
print("PAIMANA AI - SHAP EXPLAINABILITY")
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

categorical_pipeline = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
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


# ============================================
# MODEL
# ============================================

classifier = GradientBoostingClassifier(
    n_estimators=200,
    learning_rate=0.05,
    max_depth=3,
    random_state=42
)

model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("classifier", classifier)
    ]
)


# ============================================
# TRAIN
# ============================================

print("\nTraining Gradient Boosting...")

model.fit(
    X_train,
    y_train
)

print("Training completed.")


# ============================================
# TRANSFORM DATA
# ============================================

print("\nPreparing data for SHAP...")

X_test_transformed = (
    model.named_steps["preprocessor"]
    .transform(X_test)
)

# Convert transformed data to a numeric NumPy array
X_test_transformed = X_test_transformed.toarray() \
    if hasattr(X_test_transformed, "toarray") \
    else X_test_transformed

X_test_transformed = X_test_transformed.astype(float)

print(
    "Transformed test shape:",
    X_test_transformed.shape
)


# ============================================
# FEATURE NAMES
# ============================================

feature_names = (
    model
    .named_steps["preprocessor"]
    .get_feature_names_out()
)


# ============================================
# SHAP
# ============================================

print("\nCalculating SHAP values...")

explainer = shap.TreeExplainer(
    model.named_steps["classifier"]
)

shap_values = explainer.shap_values(
    X_test_transformed
)

print("SHAP calculation completed.")


# ============================================
# GLOBAL FEATURE IMPORTANCE
# ============================================

mean_abs_shap = abs(shap_values).mean(axis=0)

# ============================================
# HANDLE SHAP OUTPUT
# ============================================

# For binary classification, SHAP may return
# either a 2D array or a list of arrays.

if isinstance(shap_values, list):
    shap_matrix = shap_values[-1]
else:
    shap_matrix = shap_values

shap_matrix = pd.DataFrame(
    shap_matrix,
    columns=feature_names
)


# ============================================
# GLOBAL FEATURE IMPORTANCE
# ============================================

mean_abs_shap = (
    shap_matrix.abs()
    .mean(axis=0)
)

importance_df = pd.DataFrame({
    "feature": feature_names,
    "mean_abs_shap": mean_abs_shap
})

importance_df = importance_df.sort_values(
    "mean_abs_shap",
    ascending=False
).reset_index(drop=True)


# ============================================
# CLEAN GLOBAL FEATURE NAMES
# ============================================

importance_df["feature"] = (
    importance_df["feature"]
    .str.replace(
        "numeric__",
        "",
        regex=False
    )
    .str.replace(
        "categorical__",
        "",
        regex=False
    )
)


# ============================================
# LOCAL SHAP DRIVERS
# ============================================

print("\nPreparing project-level SHAP drivers...")

local_rows = []

for row_index in range(len(shap_matrix)):

    row = shap_matrix.iloc[row_index]

    # Select features contributing positively
    # toward the risk class.
    positive_drivers = (
        row[row > 0]
        .sort_values(ascending=False)
        .head(5)
    )

    for feature, shap_value in positive_drivers.items():

        clean_feature = (
            feature
            .replace("numeric__", "")
            .replace("categorical__", "")
        )

        local_rows.append({
            "project_code": test_df.iloc[row_index]["project_code"],
            "snapshot_month": test_df.iloc[row_index]["snapshot_month"],
            "feature": clean_feature,
            "shap_value": shap_value
        })


local_drivers_df = pd.DataFrame(local_rows)


# ============================================
# DISPLAY TOP FEATURES
# ============================================

print("\n================================")
print("TOP 20 GLOBAL RISK DRIVERS")
print("================================")

print(
    importance_df.head(20).to_string(
        index=False
    )
)


print("\n================================")
print("LOCAL SHAP DRIVERS GENERATED")
print("================================")

print(
    "Project-level driver rows:",
    len(local_drivers_df)
)


# ============================================
# SAVE GLOBAL IMPORTANCE
# ============================================

importance_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ============================================
# SAVE LOCAL DRIVERS
# ============================================

local_drivers_df.to_csv(
    LOCAL_OUTPUT_FILE,
    index=False
)


# ============================================
# COMPLETED
# ============================================

print("\n================================")
print("SHAP EXPLAINABILITY COMPLETED")
print("================================")

print("\nGlobal importance saved to:")
print(OUTPUT_FILE)

print("\nLocal drivers saved to:")
print(LOCAL_OUTPUT_FILE)