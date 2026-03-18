# CS-6580 Sprint 4 Midterm MVP Presentation

> Suggested runtime: 7–10 minutes, ~10 slides.

---

## Slide 1 — Title / Hook
**Snowbasin Congestion Engine: Midterm MVP**  
Team Wildcats  

**Business Question:**  
How can Snowbasin predict peak-hour Trappers Loop traffic 72 hours ahead to improve staffing, parking, and guest arrival communication?

**Stakeholder:**  
Snowbasin operations managers and resort leadership.

---

## Slide 2 — Why This Matters
- Peak-day congestion degrades guest experience and increases operating risk.
- Staffing and parking decisions are currently reactive.
- A usable prediction product can drive proactive operations.

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

## Slide 5 — Sprint 3 Feature Engineering
Engineered features used by model:
- `month`
- `is_peak_hour` (1 for 07–09 and 15–17)
- `temp_dewpoint_spread` = `temp_f - dewpoint_f`

Transformations:
- Numeric imputation + scaling (`SimpleImputer` + `StandardScaler`).
- Categorical imputation + encoding (`OneHotEncoder` for `day_of_week`).

---

## Slide 6 — Baseline vs Champion (Core Result)
**Baseline model:** `DummyRegressor(strategy='mean')`  
**Champion model:** `RandomForestRegressor`

From `results/training_summary.json`:
- Baseline RMSE: **295.82**
- Baseline MAE: **253.32**
- Champion RMSE: **102.91**
- Champion MAE: **59.02**
- Champion R²: **0.879**

**Narrative:** Champion materially outperforms baseline, validating business usefulness.

---

## Slide 7 — Evaluation Visuals
Use these artifacts:
- `results/actual_vs_predicted.svg`
- `results/residual_plot.svg`

Talking points:
- Actual-vs-predicted points cluster near diagonal.
- Residual plot shows reduced large-error frequency.
- Supports selecting the random-forest pipeline as current champion.

---

## Slide 8 — Beyond MVP: Deployed Product

What changed since midterm:
- Dashboard deployed at `dashboard-snowbasin-wildcats.vercel.app`
- Both RF and LSTM deployed to HuggingFace with training dataset
- Claude AI chat — understands natural language, routes to correct model
- Live UDOT + UTA integrations
- Google Maps with user geolocation
- Sources panel — shows what data each prediction used

Architecture:
```
User → Next.js + Tailwind (Vercel)
         ├→ Supabase Auth + PostgreSQL (chat history, users)
         ├→ Claude AI (intent detection + response generation)
         ├→ HuggingFace Space (FastAPI → RF + LSTM + Dataset)
         ├→ UDOT API (road conditions, weather stations)
         ├→ UTA GTFS-RT (service alerts)
         └→ Google Maps (geolocation, markers, directions)
```

How a prediction works:
```
1. User asks a traffic question in natural language
2. Dashboard extracts day, time, month and resolves the full date
   - "Saturday at 9am" → Saturday, March 22, 2026 at 9:00 AM
   - "tomorrow morning" → Thursday, March 19, 2026 at 8:00 AM
   - "3 hours from now" → today, current hour + 3
   - "trip plan for Saturday" → Saturday, March 22, 2026 at 9:00 AM
   - Full date and time always shown in the response

3. Sends request to HuggingFace FastAPI

   ─── Random Forest ───
   Finds matching day/hour/month in training data
   → pulls traffic lags (1h, 2h, 3h, 6h, 12h, 24h, 1 week)
   → pulls weather from nearest row with sensor data
   → feeds to RF → single prediction

   ─── LSTM ───
   Finds matching day/hour/month in training data
   → grabs 48 hours leading up to that point
   → feeds sequence to LSTM → 72-hour forecast

4. Dashboard also fetches UDOT / UTA / Maps if relevant (parallel)
5. All results passed to Claude → writes one response with full date/time
6. Sources panel shows: matched date, lags, weather, forecast
```

What gets fetched and when:
```
"how busy Saturday 9am"        → ML prediction
"SR-167 road conditions"       → UDOT API
"UTA alerts"                   → UTA GTFS-RT
"directions from my location"  → geolocation + Google Maps
"full trip plan for Saturday"  → ML + UDOT + UTA + Maps (all parallel)
```

---

## Slide 9 — Live Demo

Demo flow:
1. "How busy Saturday at 9am?" → prediction with full date + 6-hour trend
2. Switch RF ↔ LSTM → open Sources panel to show matched data
3. "SR-167 road conditions" → live UDOT data
4. "Directions from my location" → geolocation + map
5. "Full trip plan for Saturday" → ML + UDOT + UTA + Maps with full date/time

Fallback: local `src/app.py` if internet is down

---

## Slide 10 — Reproducibility and Delivery
- `requirements.txt` added for environment setup.
- Pipeline scripts are reproducible and file-based:
  - `src/data_cleaning.py`
  - `src/train_model.py`
  - `src/app.py`
- Tests in `tests/` validate cleaning, inventory audit, and training artifacts.

---

## Slide 11 — Risks, Next Steps, Ask
**Current risks**
- Distribution drift from new weather/traffic patterns.
- Need for stronger experiment/board process evidence.

**Next Sprint opportunities**
- Hyperparameter tuning + model calibration.
- Add lag-based temporal features for 72-hour horizon fidelity.
- Deploy MVP to cloud endpoint and add monitoring.

**Ask to stakeholders**
- Confirm operational thresholds for “high congestion.”
- Provide feedback on MVP inputs and dashboard UX.

---

## Presenter Notes (optional)
- Keep each slide to ~45–60 seconds.
- Spend extra time on Slide 6 (impact) and Slide 8 (live demo).
- If demo fails, use saved metrics + screenshots as fallback evidence.
