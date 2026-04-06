# Final Report — Snowbasin Congestion Engine (Team Wildcats)

## Executive Summary
Snowbasin Resort experiences recurring congestion on Trappers Loop (SR-167), especially during weekend and holiday travel windows. Our semester project built a forecasting application that predicts hourly traffic demand up to 72 hours ahead so operations teams can plan staffing, parking, guest messaging, and traffic mitigation before peak buildup.

The final system combines historical lane-count traffic data, weather observations, and federal holiday context into a unified hourly dataset. We trained forecasting models, validated performance with holdout evaluation, and deployed prediction capability into a user-facing dashboard and assistant workflow. Over multiple sprints, we improved both technical performance and usability. By Sprint 5, user testing showed clear opportunities to reduce confusion and streamline the prediction workflow, which directly shaped final interface priorities.

In short: this project delivered an end-to-end, decision-support “congestion engine” that is not just a model in a notebook, but a practical planning tool.

## The Data Journey

### Data used
We integrated three core data streams:

1. **Traffic counts (Trappers Loop SR-167)**
   - Hourly lane counts from yearly CSV files (`Trappers_Loop_2015.csv` through `Trappers_Loop_2024.csv` and related exports).
2. **Weather observations (SBBWK station)**
   - Multi-year Excel workbooks with meteorological signals (temperature, humidity, wind, snow, precipitation, etc.).
3. **U.S. federal holidays**
   - Calendar context to capture holiday-related travel behavior.

The inventory audit shows the scale and heterogeneity of these inputs, including different row counts, formats (CSV + XLSX), and schema naming conventions.

### Biggest cleaning hurdles
The hardest data-engineering problems were consistency, granularity, and alignment:

- **Wide-to-long reshaping for traffic data:**
  Traffic arrived with hourly columns (`H0000...H2300`), which had to be melted into a normalized timestamped format.
- **Timestamp standardization across sources:**
  Weather timestamps included string artifacts (e.g., `MST`) and required parsing, rounding to hourly buckets, and coercion of invalid rows.
- **Lane-level to roadway-level aggregation:**
  Multiple lanes had to be consolidated into an hourly total while retaining lane metadata.
- **Unit/schema normalization in weather files:**
  Weather features with varied naming needed column remapping and numeric coercion.
- **Temporal joins and missingness:**
  Traffic and weather were merged on hour-level timestamps, then enriched with holiday/weekend signals. The pipeline also generates a data quality report to track nulls and coverage.

### Biggest feature-engineering hurdles
Key challenge: encode recurring traffic behavior without overfitting.

We engineered:
- **Temporal features:** hour, month, weekend/holiday flags, peak-hour indicator.
- **Cyclical encodings:** sine/cosine transforms for hour/day/month periodicity.
- **Weather interaction:** temperature–dewpoint spread.
- **Holiday proximity feature:** distance to holiday weekends.
- **Autoregressive lags:** prior traffic counts at 1, 2, 3, 6, 12, 24, and 168 hours.

These features were essential for capturing strong weekly periodicity and short-term inertia in mountain-road demand.

## Modeling & Results

### Baseline model(s)
Our modeling progression used two baselines at different phases:

1. **Early benchmark (Sprint 3):** `DummyRegressor` (mean strategy)
   - RMSE: **295.82**
   - MAE: **253.32**
   - R²: **~0.00**

2. **Final sequence baseline:** weekly naive sequence baseline (`baseline_weekly_naive`)
   - RMSE: **110.57**
   - MAE: **61.94**
   - R²: **0.8946**
   - Weighted MSE: **168.40**

### Champion model evolution
- **Sprint 3 champion:** `RandomForestRegressor`
  - RMSE: **102.91**
  - MAE: **59.02**
  - R²: **0.8790**
- **Final champion:** sequence **LSTM** model (`lstm_model`)
  - RMSE: **106.58**
  - MAE: **71.40**
  - R²: **0.9021**
  - Weighted MSE: **155.04**

### Final evaluation takeaways
- Relative to the final naive sequence baseline, the LSTM improved **RMSE** and **R²**, indicating better overall fit on held-out sequence data.
- The LSTM had higher **MAE** than the naive baseline, suggesting some larger absolute misses despite better aggregate variance capture.
- Weighted error reduction indicates better horizon-aware performance for multi-step forecasting priorities.

Operationally, this is strong enough to support planning decisions (staffing, parking allocation, messaging) while still requiring human oversight for atypical events.

## User Testing Impact (Sprint 5)
Sprint 5 testing (March 29–31, 2026) included three observed users and produced a consistent set of usability findings:
- dashboard felt crowded,
- model names (Random Forest/LSTM) were confusing,
- users were unclear on the exact action path to trigger predictions,
- some responses/content were too dense,
- readability/contrast and snow animation controls needed refinement,
- trust/onboarding expectations were not explicit enough.

These findings directly changed final application priorities:
1. **Onboarding-first guidance** at top of experience (“what this app does” and quick steps).
2. **Simplified prediction path** with clearly visible date/time + predict controls.
3. **Reduced cognitive load around model choice** (default-friendly behavior, advanced terms de-emphasized).
4. **Content and visual polish** (shorter responses, improved hierarchy/contrast, clearer controls).

Net effect: user testing shifted the project from “model-centric demo” toward “decision-ready product experience.”

## Recommendations & Future Work

### What the stakeholder should do now
Based on learned temporal/holiday/seasonal patterns in the model outputs, Snowbasin operations should:

1. **Pre-stage staffing for forecasted peak windows (72h lookahead):**
   Use predicted high-demand blocks to schedule parking attendants, traffic marshals, and guest-services staffing before congestion begins.
2. **Use dynamic parking and arrival messaging:**
   Push guest notifications the day before and morning-of high-risk windows to flatten arrival surges.
3. **Coordinate with roadway/transit context feeds:**
   Pair forecast outputs with UDOT/UTA status cards to proactively update traveler expectations and contingency routing.
4. **Set threshold-based triggers:**
   Define traffic prediction thresholds (e.g., medium/high/severe) tied to predetermined operational playbooks.
5. **Maintain human-in-the-loop review:**
   Keep supervisor override for storms, incidents, special events, and anomalous days.

### If we had 3 more months
1. **Modeling enhancements**
   - Add event-aware covariates (powder alerts, resort events, school breaks).
   - Test hybrid ensembles (LSTM + tree-based residual correction).
   - Improve calibration and quantify predictive uncertainty (prediction intervals).
2. **MLOps and reliability**
   - Automated retraining cadence with drift monitoring.
   - Backtesting dashboards by season/holiday regime.
   - Better fallback behavior during missing weather telemetry.
3. **Product UX improvements**
   - Guided “one-click forecast” mode for first-time users.
   - Role-based views (operations manager vs. dispatcher vs. public-facing summary).
   - Accessibility hardening and mobile optimization.
4. **Decision integration**
   - Alerting hooks (email/SMS/Slack) when forecast crosses operational thresholds.
   - Scenario planner (“What if arrival shifts by +1 hour?”).
   - Post-incident review workflow to compare forecast vs. actual and refine playbooks.

---

This report is intended as the definitive semester record of the Snowbasin Congestion Engine project: data-to-model-to-product, with user testing directly informing the final system direction.
