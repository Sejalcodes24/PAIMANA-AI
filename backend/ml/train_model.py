import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score


# --------------------------------------------------
# 1. Load real historical PAIMANA data
# --------------------------------------------------

df = pd.read_csv("data/ml_training_data.csv")

print("Dataset loaded successfully!")
print("Shape:", df.shape)


# --------------------------------------------------
# 2. Features and targets
# --------------------------------------------------

features = [
    "category",
    "implementing_agency",
    "original_cost"
]

X = df[features]

# Target 1: Cost overrun percentage
y_cost = df["cost_overrun_percent"]

# Target 2: Time overrun in months
y_time = df["time_overrun_months"]


# --------------------------------------------------
# 3. Train/Test split
# --------------------------------------------------

X_train, X_test, y_cost_train, y_cost_test, y_time_train, y_time_test = train_test_split(
    X,
    y_cost,
    y_time,
    test_size=0.20,
    random_state=42
)


# --------------------------------------------------
# 4. Handle categorical data
# --------------------------------------------------

categorical_features = [
    "category",
    "implementing_agency"
]

numeric_features = [
    "original_cost"
]

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_features
        ),
        (
            "numeric",
            "passthrough",
            numeric_features
        )
    ]
)


# --------------------------------------------------
# 5. Cost Overrun Model
# --------------------------------------------------

cost_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "model",
            RandomForestRegressor(
                n_estimators=200,
                random_state=42,
                max_depth=6,
                min_samples_leaf=3
            )
        )
    ]
)

cost_model.fit(X_train, y_cost_train)

cost_predictions = cost_model.predict(X_test)


# --------------------------------------------------
# 6. Time Overrun Model
# --------------------------------------------------

time_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "model",
            RandomForestRegressor(
                n_estimators=200,
                random_state=42,
                max_depth=6,
                min_samples_leaf=3
            )
        )
    ]
)

time_model.fit(X_train, y_time_train)

time_predictions = time_model.predict(X_test)


# --------------------------------------------------
# 7. Evaluate Cost Overrun Model
# --------------------------------------------------

cost_mae = mean_absolute_error(
    y_cost_test,
    cost_predictions
)

cost_r2 = r2_score(
    y_cost_test,
    cost_predictions
)


# --------------------------------------------------
# 8. Evaluate Time Overrun Model
# --------------------------------------------------

time_mae = mean_absolute_error(
    y_time_test,
    time_predictions
)

time_r2 = r2_score(
    y_time_test,
    time_predictions
)


# --------------------------------------------------
# 9. Display results
# --------------------------------------------------

print("\n==============================")
print("COST OVERRUN MODEL")
print("==============================")

print("MAE:", round(cost_mae, 2))
print("R²:", round(cost_r2, 3))


print("\n==============================")
print("TIME OVERRUN MODEL")
print("==============================")

print("MAE:", round(time_mae, 2))
print("R²:", round(time_r2, 3))


print("\nTraining completed successfully!")