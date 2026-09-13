import os
import re

import pandas as pd

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from google import genai

from database import get_db
from models.project_db import ProjectDB

from services.risk_engine import (
    calculate_cost_risk,
    calculate_delay_risk,
    calculate_overall_risk
)

from services.recommendation import (
    get_risk_level,
    generate_reasons,
    generate_recommendations
)


load_dotenv()


router = APIRouter(
    prefix="/assistant",
    tags=["AI Assistant"]
)


# ============================================================
# Gemini
# ============================================================

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY not found in .env"
    )

client = genai.Client(
    api_key=api_key
)


# ============================================================
# Request model
# ============================================================

class ChatRequest(BaseModel):
    message: str


# ============================================================
# File paths
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(__file__)
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)

ML_FILE = os.path.join(
    DATA_DIR,
    "ml_prediction_data.csv"
)

SHAP_FILE = os.path.join(
    DATA_DIR,
    "shap_local_drivers.csv"
)

EARLY_WARNING_FILE = os.path.join(
    DATA_DIR,
    "early_warning_results.csv"
)


# ============================================================
# Month ordering
# ============================================================

MONTH_ORDER = {
    "Jan_2026": 1,
    "Feb_2026": 2,
    "March_2026": 3,
    "April_2026": 4,
    "May_2026": 5,
    "June_2026": 6,
    "July_2026": 7
}


# ============================================================
# Get ML feature information
# ============================================================

def get_ml_features(project_code):

    if not os.path.exists(ML_FILE):
        return None

    try:

        df = pd.read_csv(
            ML_FILE,
            low_memory=False
        )

        df = df[
            df["project_code"] == project_code
        ].copy()

        if df.empty:
            return None

        df["month_number"] = (
            df["snapshot_month"]
            .map(MONTH_ORDER)
        )

        df = df.sort_values(
            "month_number"
        )

        latest = df.iloc[-1]

        return {
            "snapshot_month":
                latest["snapshot_month"],

            "expenditure_ratio":
                float(latest["expenditure_ratio"])
                if pd.notna(
                    latest["expenditure_ratio"]
                )
                else None,

            "cost_overrun_percent":
                float(latest["cost_overrun_percent"])
                if pd.notna(
                    latest["cost_overrun_percent"]
                )
                else None,

            "progress_change":
                float(latest["progress_change"])
                if pd.notna(
                    latest["progress_change"]
                )
                else None,

            "expenditure_change":
                float(latest["expenditure_change"])
                if pd.notna(
                    latest["expenditure_change"]
                )
                else None,

            "progress_velocity":
                float(latest["progress_velocity"])
                if pd.notna(
                    latest["progress_velocity"]
                )
                else None,

            "expenditure_velocity":
                float(latest["expenditure_velocity"])
                if pd.notna(
                    latest["expenditure_velocity"]
                )
                else None,

            "months_elapsed":
                float(latest["months_elapsed"])
                if pd.notna(
                    latest["months_elapsed"]
                )
                else None,

            "progress_expenditure_gap":
                float(
                    latest["progress_expenditure_gap"]
                )
                if pd.notna(
                    latest["progress_expenditure_gap"]
                )
                else None,

            "gap_change":
                float(latest["gap_change"])
                if pd.notna(
                    latest["gap_change"]
                )
                else None,

            "cost_escalation_percent":
                float(
                    latest["cost_escalation_percent"]
                )
                if pd.notna(
                    latest["cost_escalation_percent"]
                )
                else None,

            "months_observed":
                float(latest["months_observed"])
                if pd.notna(
                    latest["months_observed"]
                )
                else None,

            "project_age":
                float(latest["project_age"])
                if pd.notna(
                    latest["project_age"]
                )
                else None,

            "months_to_completion":
                float(
                    latest["months_to_completion"]
                )
                if pd.notna(
                    latest["months_to_completion"]
                )
                else None,

            "remaining_progress":
                float(latest["remaining_progress"])
                if pd.notna(
                    latest["remaining_progress"]
                )
                else None,

            "required_progress_per_month":
                float(
                    latest["required_progress_per_month"]
                )
                if pd.notna(
                    latest["required_progress_per_month"]
                )
                else None,

            "schedule_pressure":
                float(
                    latest["schedule_pressure"]
                )
                if pd.notna(
                    latest["schedule_pressure"]
                )
                else None,

            # IMPORTANT:
            # future_risk is a target/label,
            # not a prediction probability.
            "future_risk":
                int(latest["future_risk"])
                if pd.notna(
                    latest["future_risk"]
                )
                else None
        }

    except Exception:
        return None


# ============================================================
# Get SHAP drivers
# ============================================================

def get_shap_drivers(project_code):

    if not os.path.exists(SHAP_FILE):
        return []

    try:

        df = pd.read_csv(
            SHAP_FILE
        )

        df = df[
            df["project_code"] == project_code
        ].copy()

        if df.empty:
            return []

        df["month_number"] = (
            df["snapshot_month"]
            .map(MONTH_ORDER)
        )

        latest_month = (
            df["month_number"].max()
        )

        df = df[
            df["month_number"]
            == latest_month
        ]

        df = df.sort_values(
            "shap_value",
            ascending=False
        )

        drivers = []

        for _, row in df.head(5).iterrows():

            drivers.append({
                "feature": row["feature"],
                "shap_value":
                    round(
                        float(row["shap_value"]),
                        4
                    )
            })

        return drivers

    except Exception:
        return []


# ============================================================
# Get Early Warning information
# ============================================================

def get_early_warning(project_code):

    if not os.path.exists(
        EARLY_WARNING_FILE
    ):
        return None

    try:

        df = pd.read_csv(
            EARLY_WARNING_FILE,
            low_memory=False
        )

        df = df[
            df["project_code"] == project_code
        ].copy()

        if df.empty:
            return None

        df["month_number"] = (
            df["snapshot_month"]
            .map(MONTH_ORDER)
        )

        df = df.sort_values(
            "month_number"
        )

        latest = df.iloc[-1]

        return {
            "snapshot_month":
                latest["snapshot_month"],

            "risk_probability":
                round(
                    float(
                        latest["risk_probability"]
                    ),
                    4
                ),

            "risk_change":
                round(
                    float(
                        latest["risk_change"]
                    ),
                    4
                ),

            "risk_level":
                latest["risk_level"],

            "early_warning":
                bool(
                    latest["early_warning"]
                ),

            "warning_reason":
                latest["warning_reason"]
        }

    except Exception:
        return None


# ============================================================
# Build trusted project context
# ============================================================

def get_project_context(project):

    # ----------------------------------------
    # Rule-based risk
    # ----------------------------------------

    cost_risk = calculate_cost_risk(
        project
    )

    delay_risk = calculate_delay_risk(
        project
    )

    overall_risk = calculate_overall_risk(
        project
    )

    risk_level = get_risk_level(
        overall_risk
    )

    reasons = generate_reasons(
        project
    )

    # ----------------------------------------
    # ML / SHAP / Early Warning
    # ----------------------------------------

    ml_features = get_ml_features(
        project.project_code
    )

    shap_drivers = get_shap_drivers(
        project.project_code
    )

    early_warning = get_early_warning(
        project.project_code
    )

    # ----------------------------------------
    # Recommendations
    # ----------------------------------------

    shap_feature_names = [
        item["feature"]
        for item in shap_drivers
    ]

    recommendations = generate_recommendations(
        project,
        shap_feature_names,
        risk_level
    )

    # ----------------------------------------
    # Final trusted context
    # ----------------------------------------

    return {

        "project": {
            "project_id":
                project.project_id,

            "project_code":
                project.project_code,

            "project_name":
                project.project_name,

            "state":
                project.state,

            "sector":
                project.sector,

            "line_ministry":
                project.line_ministry,

            "implementing_agency":
                project.implementing_agency,

            "original_cost":
                project.original_cost,

            "current_cost":
                project.current_cost,

            "expenditure":
                project.expenditure,

            "physical_progress":
                project.physical_progress,

            "financial_progress":
                project.financial_progress,

            "original_completion_date":
                str(
                    project.original_completion_date
                )
                if project.original_completion_date
                else None,

            "revised_completion_date":
                str(
                    project.revised_completion_date
                )
                if project.revised_completion_date
                else None,

            "sanction_date":
                str(
                    project.sanction_date
                )
                if project.sanction_date
                else None,

            "snapshot_month":
                project.snapshot_month,

            "snapshot_year":
                project.snapshot_year
        },

        "rule_based_risk": {
            "cost_risk":
                cost_risk,

            "delay_risk":
                delay_risk,

            "overall_risk":
                overall_risk,

            "risk_level":
                risk_level,

            "reasons":
                reasons
        },

        "ml_features":
            ml_features,

        "shap_drivers":
            shap_drivers,

        "early_warning":
            early_warning,

        "recommended_actions":
            recommendations
    }

# ============================================================
# What-If Simulation
# ============================================================

def run_what_if(
    project,
    physical_progress=None,
    financial_progress=None,
    current_cost=None
):
    """
    Run the same What-If risk logic used by the
    /what-if/projects/{project_id} endpoint.
    """

    current_cost_risk = calculate_cost_risk(project)
    current_delay_risk = calculate_delay_risk(project)
    current_overall_risk = calculate_overall_risk(project)
    current_risk_level = get_risk_level(
        current_overall_risk
    )

    simulated_physical = (
        physical_progress
        if physical_progress is not None
        else project.physical_progress
    )

    simulated_financial = (
        financial_progress
        if financial_progress is not None
        else project.financial_progress
    )

    simulated_cost = (
        current_cost
        if current_cost is not None
        else project.current_cost
    )

    if not 0 <= simulated_physical <= 100:
        return {
            "error":
                "physical_progress must be between 0 and 100"
        }

    if not 0 <= simulated_financial <= 100:
        return {
            "error":
                "financial_progress must be between 0 and 100"
        }

    if simulated_cost < 0:
        return {
            "error":
                "current_cost cannot be negative"
        }

    class SimulatedProject:
        pass

    simulated_project = SimulatedProject()

    simulated_project.original_cost = (
        project.original_cost
    )

    simulated_project.current_cost = (
        simulated_cost
    )

    simulated_project.physical_progress = (
        simulated_physical
    )

    simulated_project.financial_progress = (
        simulated_financial
    )

    simulated_cost_risk = calculate_cost_risk(
        simulated_project
    )

    simulated_delay_risk = calculate_delay_risk(
        simulated_project
    )

    simulated_overall_risk = calculate_overall_risk(
        simulated_project
    )

    simulated_risk_level = get_risk_level(
        simulated_overall_risk
    )

    risk_change = (
        simulated_overall_risk
        - current_overall_risk
    )

    if risk_change < 0:
        impact = "Risk reduced"
    elif risk_change > 0:
        impact = "Risk increased"
    else:
        impact = "No change in risk"

    return {
        "current": {
            "physical_progress":
                project.physical_progress,

            "financial_progress":
                project.financial_progress,

            "current_cost":
                project.current_cost,

            "overall_risk":
                current_overall_risk,

            "risk_level":
                current_risk_level
        },

        "what_if": {
            "physical_progress":
                simulated_physical,

            "financial_progress":
                simulated_financial,

            "current_cost":
                simulated_cost,

            "overall_risk":
                simulated_overall_risk,

            "risk_level":
                simulated_risk_level
        },

        "risk_change":
            risk_change,

        "impact":
            impact
    }
# ============================================================
# Main assistant endpoint
# ============================================================

@router.post("/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):

    user_message = request.message.strip()

    if not user_message:
        return {
            "message": "",
            "project_found": False,
            "project_id": None,
            "response": "Please provide a question."
        }

    # ========================================================
    # Identify project number
    # ========================================================

    project_numbers = re.findall(
        r"\b\d{4,10}\b",
        user_message
    )

    project = None

    for number in project_numbers:

        number = int(number)

        # First try project_id
        project = (
            db.query(ProjectDB)
            .filter(
                ProjectDB.project_id == number
            )
            .first()
        )

        if project:
            break

        # Then try project_code
        project = (
            db.query(ProjectDB)
            .filter(
                ProjectDB.project_code == number
            )
            .order_by(
                ProjectDB.snapshot_year.desc(),
                ProjectDB.project_id.desc()
            )
            .first()
        )

        if project:
            break

    # ========================================================
    # Detect What-If request
    # ========================================================

    what_if_data = None

    if project:

        message_lower = user_message.lower()

        is_what_if = any(
            phrase in message_lower
            for phrase in [
                "what if",
                "what happens if",
                "suppose",
                "if physical progress",
                "if financial progress",
                "increase physical progress",
                "reduce physical progress"
            ]
        )

        if is_what_if:

            physical_value = None
            financial_value = None
            cost_value = None

            # --------------------------------------------
            # Physical progress
            # --------------------------------------------

            physical_match = re.search(
                r"(?:physical progress|physical)"
                r"(?:\s+of\s+project\s+\d+)?"
                r"(?:\s*(?:becomes|become|is|to|at|reaches|reach))?"
                r"\s*(\d+(?:\.\d+)?)\s*%",
                message_lower
            )

            if physical_match:
                physical_value = float(
                    physical_match.group(1)
                )

            # --------------------------------------------
            # Financial progress
            # --------------------------------------------

            financial_match = re.search(
                r"(?:financial progress|financial)"
                r"(?:\s+of\s+project\s+\d+)?"
                r"(?:\s*(?:becomes|become|is|to|at|reaches|reach))?"
                r"\s*(\d+(?:\.\d+)?)\s*%",
                message_lower
            )

            if financial_match:
                financial_value = float(
                    financial_match.group(1)
                )

            # --------------------------------------------
            # Current cost
            # --------------------------------------------

            cost_match = re.search(
                r"(?:current cost|cost)"
                r"(?:\s+of\s+project\s+\d+)?"
                r"(?:\s*(?:becomes|become|is|to|at|reaches|reach))?"
                r"\s*(?:₹|rs\.?|inr)?\s*"
                r"(\d+(?:\.\d+)?)",
                message_lower
            )

            if cost_match:
                cost_value = float(
                    cost_match.group(1)
                )

            # --------------------------------------------
            # Run simulation
            # --------------------------------------------

            what_if_data = run_what_if(
                project,
                physical_progress=physical_value,
                financial_progress=financial_value,
                current_cost=cost_value
            )

    # ========================================================
    # Build trusted context
    # ========================================================

    if project:

        trusted_context = get_project_context(
            project
        )

        context_text = f"""
TRUSTED PAIMANA AI BACKEND DATA:

{trusted_context}
"""

        # Add What-If result if available
        if what_if_data:

            context_text += f"""

WHAT-IF SIMULATION RESULT:

{what_if_data}

IMPORTANT:
The What-If result above was calculated by the
PAIMANA AI backend risk engine.

Do not recalculate or change these values.

Explain the simulated impact to the user.
"""

        context_text += """

IMPORTANT:
These values come from the PAIMANA AI backend.

Use them as the source of truth.

Do not invent or modify project-specific numbers.
"""

    else:

        context_text = """
No specific project was identified from the user's message.

Do not invent project-specific information.
"""

    # ========================================================
    # Gemini system instruction
    # ========================================================

    system_instruction = """
You are the AI Assistant for PAIMANA AI, developed by team RiskX
for Smart India Hackathon 2026 Problem Statement 103.

PAIMANA AI is an intelligent infrastructure project monitoring
system built on top of PAIMANA data. It moves infrastructure
monitoring from retrospective reporting toward predictive and
prescriptive decision support.

The system follows:

Monitor → Analyse → Predict → Explain → Warn → Recommend → What-If

The system includes:

- ML-based risk prediction
- Rule-based cost and delay risk analysis
- SHAP-based explainability
- Early-warning detection
- Risk-based recommendations
- What-If risk simulation

IMPORTANT DATA-GROUNDING RULES:

1. Treat the backend-provided project context as the trusted
source of project-specific facts.

2. NEVER invent project-specific values, calculations, features,
dates, risk scores, SHAP drivers, probabilities, warnings,
or recommendations.

3. If a required project-specific value is not present in the
backend context, explicitly say that the information is unavailable.

4. Do not confuse PAIMANA AI with any sales, marketing, AI SDR,
or unrelated platform.

5. Do not claim that SHAP features prove causation. SHAP values
represent model contribution/importance for the prediction.

6. future_risk in the ML prediction dataset is the target/label
used for model evaluation. It is NOT a probability and must
never be presented as the model's predicted probability.

7. risk_probability from the early-warning dataset is the
model's predicted probability.

8. Early-warning status must be taken from the backend
early-warning result. Do not independently invent or infer
an early warning.

WHAT-IF RULES:

9. When a What-If Simulation Result is provided, ALWAYS treat
the backend What-If result as the source of truth.

10. NEVER independently recalculate, estimate, or modify the
What-If risk score.

11. Clearly state that the What-If simulation uses the current
PAIMANA AI backend risk-engine logic.

12. Only describe changes that are explicitly present in the
What-If Simulation Result.

13. Do NOT claim that the What-If simulation recalculated ML
features such as:

- schedule pressure
- required progress per month
- progress velocity
- expenditure velocity
- project age
- months to completion
- SHAP values
- ML risk probability

unless those values are explicitly provided by the backend
What-If result.

14. The current What-If simulation changes only the supplied
project indicators:

- physical progress
- financial progress
- current cost

Any indicator not supplied remains unchanged.

15. If explaining why the What-If risk changed, use only the
backend risk-engine logic and values provided in the context.

16. For the current risk engine:

- Cost Risk is determined from cost growth.
- Delay Risk is determined from the difference between physical
  progress and financial progress.
- Overall Risk = 40% Cost Risk + 60% Delay Risk.

17. Do not describe physical progress below 50% as the direct
formula for Delay Risk. The 50% threshold may appear as a
recommendation/reason indicator, but it is NOT the formula
used to calculate Delay Risk.

18. If the backend says risk changed from one score to another,
report that exact change.

19. If the backend says No change in risk, do not claim that
the project became safer or riskier.

20. Do not introduce additional What-If assumptions that were
not supplied by the user or backend.

RESPONSE STYLE:

- Be concise but informative.
- Use clear headings and bullet points when useful.
- Explain technical ML information in simple, judge-friendly
  language when appropriate.
- Distinguish clearly between:
  a) current rule-based risk,
  b) ML prediction,
  c) early warning,
  d) SHAP explanation,
  e) What-If simulation.

The goal is to explain trusted backend results, not to fabricate
additional analysis.
"""

    # ========================================================
    # Gemini prompt
    # ========================================================

    prompt = f"""
USER QUESTION:
{user_message}

TRUSTED PAIMANA AI BACKEND CONTEXT:
{context_text}

Answer the user's question using the trusted
PAIMANA AI backend information provided above.

If the question is project-specific, prioritize
the backend data over general knowledge.

For What-If questions, use the backend What-If
Simulation Result as the source of truth.

Do not independently recalculate or invent
What-If results.

Explain technical ML information in simple,
judge-friendly language when appropriate.
"""

    # ========================================================
    # Gemini
    # ========================================================

    interaction = client.interactions.create(
        model="gemini-3.8-flash",
        input=prompt,
        system_instruction=system_instruction
    )

    # ========================================================
    # Response
    # ========================================================

    return {
        "message": user_message,

        "project_found": project is not None,

        "project_id": (
            project.project_id
            if project
            else None
        ),

        "response": interaction.output_text
    }