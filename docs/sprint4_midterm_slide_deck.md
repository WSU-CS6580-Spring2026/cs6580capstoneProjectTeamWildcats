# CS-6580 Sprint 4 Midterm MVP Presentation (Updated)

> Suggested runtime: 7–10 minutes, ~10 slides.

---

## Slide 1 — Title / Hook
**Snowbasin Congestion Engine: Midterm to Early Product Transition**
Team Wildcats

**Business Question:**
How can Snowbasin predict peak-hour Trappers Loop traffic 72 hours ahead to improve staffing, parking, and guest arrival communication?

**Stakeholder:**
Snowbasin operations managers and resort leadership.

---

## Slide 2 — Why This Matters
- Peak-day congestion degrades guest experience and increases operating risk.
- Staffing and parking decisions are often reactive instead of proactive.
- A production-ready prediction workflow can improve daily decision-making.

**Target business outcomes:**
- Reduce overflow parking incidents.
- Improve staffing precision.
- Improve arrival guidance on high-volume days.

---

## Slide 3 — Data Sources and Join Logic
**Primary inputs**
- UDOT Trappers Loop hourly traffic counts (`data/raw/trappersLoopCounts/*`).
- SBBWK station weather history (`data/raw/weatherData/*.xlsx`).
- U.S. federal holiday calendar (`data/raw/federalHolidayData/us_federal_holidays_2015_2026.csv`).

**Join key and grain**
- Common hourly grain (`date_hour`).
- Traffic and weather aligned hourly.
- Holiday/weekend enrichments added.

---

## Slide 4 — EDA Snapshot
Use these repository visuals:
- `results/traffic_count_distribution.svg`
- `results/temperature_distribution.svg`
- `results/correlation_heatmap.svg`

Talking points:
- Clear seasonality in weather and traffic volume.
- Hour-of-day and calendar effects matter.
- Weather spread and precipitation influence traffic variance.

---

## Slide 5 — Feature Engineering + Modeling
Engineered features used by model:
- `month`
- `is_peak_hour` (1 for 07–09 and 15–17)
- `temp_dewpoint_spread` = `temp_f - dewpoint_f`

Transformations:
- Numeric imputation + scaling (`SimpleImputer` + `StandardScaler`).
- Categorical imputation + encoding (`OneHotEncoder` for `day_of_week`).

Model comparison (from `results/training_summary.json`):
- Baseline RMSE: **295.82**
- Baseline MAE: **253.32**
- Champion RMSE: **102.91**
- Champion MAE: **59.02**
- Champion R²: **0.879**

---

## Slide 6 — Midterm MVP (What Was Delivered)
**MVP app:** `src/app.py` (Gradio, local-first demo)

MVP flow:
1. Load `models/champion_model.joblib`.
2. Enter weather + calendar + traffic context inputs.
3. Click **Predict traffic volume**.
4. Return predicted hourly vehicle count in real-time.

MVP run commands:
```bash
python src/train_model.py
python src/app.py
```

---

## Slide 7 — Current Status: Beyond MVP
Since creating the original Sprint 4 deck, the team moved from MVP to an **early-stage end product**.

**Now demonstrated in class and team reviews via deployed app:**
- Live dashboard: https://dashboard-snowbasin-wildcats.vercel.app/login
- Main dashboard URL: https://dashboard-snowbasin-wildcats.vercel.app/

**Model and related assets:**
- Hugging Face profile/repo: https://huggingface.co/hazemdhW26

Narrative to present:
- MVP was a proving step.
- Current focus is product integration, usability, and deployment readiness.

---

## Slide 8 — Demo Plan (Updated)
**Preferred demo:** deployed dashboard login flow
1. Open `https://dashboard-snowbasin-wildcats.vercel.app/login`.
2. Authenticate and navigate to prediction workflow.
3. Show model-backed traffic prediction output and dashboard interaction.

**Fallback demo:** local MVP (`src/app.py`) if internet/service issues occur.

---

## Slide 9 — Reproducibility and Delivery Evidence
- `requirements.txt` maintained for environment setup.
- Reproducible pipeline scripts:
  - `src/data_cleaning.py`
  - `src/train_model.py`
  - `src/app.py` (MVP fallback)
- Deployment/model references documented in `README.md`:
  - Vercel dashboard link
  - Hugging Face model profile
  - Data export endpoint

---

## Slide 10 — Risks, Next Steps, Ask
**Current risks**
- Distribution drift from changing weather/traffic patterns.
- Early-stage product hardening still needed (monitoring, reliability, UX polish).
- Authentication/user-flow edge cases as deployment evolves.

**Next Sprint opportunities**
- Hyperparameter tuning + model calibration.
- Add lag-based temporal features for 72-hour horizon fidelity.
- Add monitoring and alerting for model and app health.
- Formalize deployment checks and rollback process.

**Ask to stakeholders**
- Confirm operational thresholds for “high congestion.”
- Provide feedback on deployed dashboard usability and decision usefulness.

---

## Presenter Notes (optional)
- Keep each slide to ~45–60 seconds.
- Emphasize transition story: **MVP delivered -> early end product deployed**.
- If deployed demo fails, use local MVP and stored metrics/visuals as fallback.
