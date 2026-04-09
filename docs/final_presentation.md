---
marp: true
title: CS-6580 Sprint 6 Final Presentation
paginate: true
theme: default
---

# Snowbasin Congestion Engine
## CS-6580 Final Presentation

**Team Wildcats**  
Dani Lopez • Hazem Dawahi • Roberto Camposeco • Kevin Bell  

**Live App:** https://dashboard-snowbasin-wildcats.vercel.app/

---

# 1) The Hook: Why This Matters

## Stakeholder
Snowbasin Resort operations teams managing weekend/holiday guest arrivals.

## Business Problem
Traffic surges on Trappers Loop (SR-167) create:
- arrival delays,
- parking bottlenecks,
- staffing misalignment,
- poor guest experience.

## Project Goal
Forecast hourly traffic demand **up to 72 hours ahead** so teams can act before congestion forms.

---

# 2) CRISP-DM Journey (Semester Arc)

- **Business Understanding:** define congestion risk + operational decisions.
- **Data Understanding:** collect traffic, weather, holiday context.
- **Data Prep:** normalize multi-year, mixed-format sources.
- **Modeling:** benchmark baseline vs advanced approaches.
- **Evaluation:** compare metrics + user utility.
- **Deployment/Review:** production-style dashboard + user-tested workflow.

**Sprint 6 focus:** lock code, polish docs, present decision-ready insights.

---

# 3) Data Pipeline (High-Level)

## Inputs
1. **Traffic counts** (Trappers Loop, multi-year hourly lane data)
2. **Weather observations** (SBBWK station)
3. **U.S. federal holidays** (travel-behavior context)

## Core preparation steps
- wide-to-long reshaping of hourly traffic columns,
- timestamp cleaning/alignment to hourly grain,
- lane aggregation to roadway totals,
- temporal join of traffic + weather + holiday features,
- quality checks for nulls and coverage.

---

# 4) Feature Engineering + Modeling Approach

## Features we engineered
- Time: hour, month, weekend/holiday flags, peak-hour indicator
- Cyclical encodings: sin/cos for periodicity
- Weather interaction: temperature–dewpoint spread
- Holiday proximity signal
- Lagged traffic features: 1, 2, 3, 6, 12, 24, 168 hours

## Modeling path
- Dummy baseline (early benchmark)
- Weekly naive sequence baseline
- Random Forest (mid-project champion)
- **LSTM sequence model (final champion)**

---

# 5) Results: Baseline vs Champion

## Early benchmark (DummyRegressor)
- RMSE: **295.82**
- MAE: **253.32**
- R²: **~0.00**

## Final sequence baseline (weekly naive)
- RMSE: **110.57**
- MAE: **61.94**
- R²: **0.8946**

## Final champion (LSTM)
- RMSE: **106.58**
- MAE: **71.40**
- R²: **0.9021**

**Takeaway:** LSTM improved fit/variance capture and weighted error for multi-step forecasting.

---

# 6) The Pivot: What User Testing Changed

## Surprising finding
Users trusted the concept, but many were confused by the workflow and model terminology.

## Key pain points from Sprint 5
- dashboard felt crowded,
- Random Forest vs LSTM labels were unclear,
- users were unsure what action actually triggers predictions,
- content density + contrast issues reduced readability.

## Product changes we prioritized
- onboarding-first guidance,
- simpler prediction path (date/time + clear predict action),
- reduced emphasis on technical model labels,
- improved hierarchy, readability, and control visibility.

---

# 7) Live Demo Plan (3–4 Minutes)

## Demo scenario
"Operations manager planning Saturday morning powder-day traffic"

## Walkthrough script
1. Open dashboard homepage.
2. Select realistic forecast date/time window.
3. Trigger prediction.
4. Interpret congestion signal + related context cards.
5. Explain operations action (staffing/parking messaging).

## Success criterion
A stakeholder can understand and act on results in under 1 minute.

---

# 8) Business Recommendation

Based on model outputs and user-tested workflow, Snowbasin should:

1. **Pre-stage staffing** for predicted high-demand windows.
2. **Send dynamic arrival messaging** to flatten surge behavior.
3. **Use threshold playbooks** (medium/high/severe congestion).
4. **Keep human-in-the-loop overrides** for storms/incidents.

This project is decision support, not autopilot.

---

# 9) Sprint 6 Deliverables Checklist

## Phase 1 (Due April 16, 2026)
- [x] Code freeze + final merge hygiene
- [x] Reproducibility path in repository docs
- [x] Final report with executive-to-technical narrative

## Phase 2 (Due April 23, 2026)
- [x] Final slide deck (this file)
- [x] Live demo flow prepared
- [x] Recommendation + Q&A narrative ready

---

# 10) Extra Credit Deployment Status

## Deployment challenge target
Public URL access with no local Python install required.

## Current live endpoint
https://dashboard-snowbasin-wildcats.vercel.app/

## Portfolio impact
A functioning live app strengthens this as a professional artifact beyond the course.

---

# 11) Risks, Limits, and Future Work

## Known limits
- forecast misses can occur during atypical events,
- MAE tradeoff remains vs naive baseline,
- external incident/event covariates are limited.

## Next 3 months roadmap
- event-aware covariates + ensemble residual correction,
- uncertainty intervals + drift monitoring,
- role-based UX + alerting hooks (Slack/SMS/email),
- post-incident forecast-vs-actual review workflow.

---

# 12) Closing

## Final Message
We turned a semester-long ML build into a stakeholder-ready congestion planning tool.

## Ask
We welcome feedback on:
- deployment hardening,
- operational threshold tuning,
- feature expansion for winter event conditions.

# Thank you — Q&A
