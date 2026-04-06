from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import json
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from huggingface_hub import hf_hub_download
from typing import Optional

app = FastAPI()

#Model repo────────────────────────
LSTM_REPO = "hazemdhW26/snowbasin-traffic-lstm"

#LSTM architecture (must match training) ──────────────────────────────────
class TrafficLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=128, horizon=72):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=2,
            dropout=0.2,
            batch_first=True,
        )
        self.fc = nn.Linear(hidden_size, horizon)

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]
        return self.fc(last_hidden)

#Load LSTM + preprocessor + scaler──
print("Loading LSTM model...")
try:
    lstm_model_path = hf_hub_download(repo_id=LSTM_REPO, filename="champion_lstm.pth")
    lstm_preprocessor_path = hf_hub_download(repo_id=LSTM_REPO, filename="lstm_preprocessor.joblib")
    lstm_scaler_path = hf_hub_download(repo_id=LSTM_REPO, filename="lstm_target_scaler.joblib")
    lstm_config_path = hf_hub_download(repo_id=LSTM_REPO, filename="lstm_config.json")

    with open(lstm_config_path) as f:
        lstm_config = json.load(f)

    lstm_preprocessor = joblib.load(lstm_preprocessor_path)
    lstm_target_scaler = joblib.load(lstm_scaler_path)

    lstm_model = TrafficLSTM(
        input_size=lstm_config["input_size"],
        hidden_size=lstm_config.get("hidden_size", 128),
        horizon=lstm_config.get("horizon", 72),
    )
    lstm_model.load_state_dict(torch.load(lstm_model_path, weights_only=True))
    lstm_model.eval()
    lstm_loaded = True
    print("LSTM loaded.")
except Exception as e:
    print(f"LSTM failed to load: {e}")
    lstm_loaded = False

#Load training data for LSTM sequence lookup ──────────────────────────────
DATASET_REPO = "hazemdhW26/snowbasin-traffic-data"

print("Loading training data from HuggingFace Dataset...")
try:
    traffic_csv_path = hf_hub_download(repo_id=DATASET_REPO, filename="snowbasin_hourly_joined.csv", repo_type="dataset")
    training_data = pd.read_csv(traffic_csv_path, parse_dates=["date_hour"])
    training_data = training_data.sort_values("date_hour").reset_index(drop=True)
    # Pre-compute engineered features needed by the LSTM preprocessor
    training_data["month"] = training_data["date_hour"].dt.month
    training_data["hour"] = training_data["date_hour"].dt.hour
    training_data["day_of_week"] = training_data["date_hour"].dt.day_name()
    day_num_map = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
                   "Friday": 4, "Saturday": 5, "Sunday": 6}
    training_data["day_of_week_num"] = training_data["day_of_week"].map(day_num_map)
    training_data["is_weekend"] = training_data["day_of_week_num"].isin([5, 6]).astype(int)
    training_data["is_peak_hour"] = training_data["hour"].isin([7, 8, 9, 15, 16, 17]).astype(int)
    training_data["temp_dewpoint_spread"] = training_data["temp_f"] - training_data["dewpoint_f"]
    training_data["is_federal_holiday"] = training_data["is_federal_holiday"].astype(int)

    # Compute REAL distance_to_holiday_weekend (same logic as train_model.py)
    try:
        holidays_csv_path = hf_hub_download(repo_id=DATASET_REPO, filename="us_federal_holidays.csv", repo_type="dataset")
        holidays_df = pd.read_csv(holidays_csv_path)
        holiday_dates_raw = pd.to_datetime(holidays_df["observed_date"]).dt.date

        daily = pd.DataFrame({"date": training_data["date_hour"].dt.date.unique()})
        daily["date"] = pd.to_datetime(daily["date"])
        daily = daily.sort_values("date").reset_index(drop=True)
        daily["is_holiday_weekend"] = False

        for hd in holiday_dates_raw:
            holiday_date = pd.Timestamp(hd)
            wd = holiday_date.dayofweek
            if wd <= 2:
                saturday = holiday_date - pd.Timedelta(days=(wd + 2))
                window_start = saturday
                window_end = holiday_date
            elif wd <= 4:
                sunday = holiday_date + pd.Timedelta(days=(5 - wd)) + pd.Timedelta(days=1)
                window_start = holiday_date
                window_end = sunday
            else:
                saturday = holiday_date - pd.Timedelta(days=(wd - 5))
                sunday = saturday + pd.Timedelta(days=1)
                window_start = saturday
                window_end = sunday

            daily.loc[
                (daily["date"] >= window_start) & (daily["date"] <= window_end),
                "is_holiday_weekend"
            ] = True

        daily["last_hw"] = daily["date"].where(daily["is_holiday_weekend"]).ffill()
        daily["days_since"] = (daily["date"] - daily["last_hw"]).dt.days
        daily["next_hw"] = daily["date"].where(daily["is_holiday_weekend"]).bfill()
        daily["days_until"] = (daily["next_hw"] - daily["date"]).dt.days
        daily["distance_to_holiday_weekend"] = daily[["days_since", "days_until"]].min(axis=1)

        # Merge back to hourly training_data
        training_data["date_only"] = training_data["date_hour"].dt.date.astype(str)
        daily["date_only"] = daily["date"].dt.date.astype(str)
        dist_map = daily.set_index("date_only")["distance_to_holiday_weekend"].to_dict()
        training_data["distance_to_holiday_weekend"] = training_data["date_only"].map(dist_map).fillna(30).astype(int)
        training_data = training_data.drop(columns=["date_only"])
        print(f"Holiday distances computed: min={training_data['distance_to_holiday_weekend'].min()}, max={training_data['distance_to_holiday_weekend'].max()}")
    except Exception as e:
        print(f"Holiday distance computation failed, using default 30: {e}")
        training_data["distance_to_holiday_weekend"] = 30

    # Traffic lag features
    for lag in [1, 2, 3, 6, 12, 24, 168]:
        training_data[f"traffic_lag_{lag}"] = training_data["traffic_count_total"].shift(lag)

    # Cyclical encodings
    training_data["hour_sin"] = np.sin(2 * np.pi * training_data["hour"] / 24)
    training_data["hour_cos"] = np.cos(2 * np.pi * training_data["hour"] / 24)
    training_data["day_of_week_sin"] = np.sin(2 * np.pi * training_data["day_of_week_num"] / 7)
    training_data["day_of_week_cos"] = np.cos(2 * np.pi * training_data["day_of_week_num"] / 7)
    training_data["month_sin"] = np.sin(2 * np.pi * training_data["month"] / 12)
    training_data["month_cos"] = np.cos(2 * np.pi * training_data["month"] / 12)

    # Drop rows with NaN lags (first 168 rows)
    training_data = training_data.dropna(subset=["traffic_lag_168"]).reset_index(drop=True)

    print(f"Training data loaded: {len(training_data)} rows, "
          f"{training_data['date_hour'].min()} to {training_data['date_hour'].max()}")
    training_data_loaded = True
except Exception as e:
    print(f"Training data failed to load: {e}")
    training_data_loaded = False

#Feature columns (same order as training) ─────────────────────────────────
LSTM_FEATURE_COLS = [
    "lane_count", "temp_f", "dewpoint_f", "humidity_pct", "wind_speed_mph",
    "snow_depth_in", "precip_1hr_in", "hour", "month", "temp_dewpoint_spread",
    "is_weekend", "is_federal_holiday", "is_peak_hour",
    "distance_to_holiday_weekend",
    "traffic_lag_1", "traffic_lag_2", "traffic_lag_3",
    "traffic_lag_6", "traffic_lag_12", "traffic_lag_24", "traffic_lag_168",
    "hour_sin", "hour_cos", "day_of_week_sin", "day_of_week_cos",
    "month_sin", "month_cos", "day_of_week",
]


def find_best_48h_sequence(day_of_week: str, hour: int, month: int) -> Optional[pd.DataFrame]:
    """Find the best matching 48-hour sequence from training data."""
    if not training_data_loaded:
        return None

    matches = training_data[
        (training_data["day_of_week"] == day_of_week) &
        (training_data["hour"] == hour) &
        (training_data["month"] == month)
    ]

    if matches.empty:
        matches = training_data[
            (training_data["day_of_week"] == day_of_week) &
            (training_data["hour"] == hour)
        ]

    if matches.empty:
        return None

    best_idx = matches.index[-1]
    start_idx = best_idx - 47
    if start_idx < 0:
        start_idx = 0

    sequence = training_data.iloc[start_idx:best_idx + 1].copy()

    if len(sequence) < 48:
        return None

    return sequence


#Request model──────────────────────
class PredictRequest(BaseModel):
    hour: int
    day_of_week: str
    month: int
    is_weekend: bool = False
    is_federal_holiday: bool = False
    temp_f: Optional[float] = None
    humidity_pct: Optional[float] = None
    wind_speed_mph: Optional[float] = None
    snow_depth_in: Optional[float] = None
    precip_1hr_in: Optional[float] = None
    dewpoint_f: Optional[float] = None
    distance_to_holiday_weekend: Optional[int] = None
    lane_count: int = 2
    model: str = "lstm"


#Endpoints──────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": {
            "lstm": lstm_loaded,
        },
        "training_data": training_data_loaded,
    }


@app.post("/predict")
def predict(req: PredictRequest):
    try:
        return predict_lstm(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def predict_lstm(req: PredictRequest) -> dict:
    """LSTM: uses real 48-hour sequence from training data."""
    if not lstm_loaded:
        raise HTTPException(status_code=503, detail="LSTM model not available")

    sequence = find_best_48h_sequence(req.day_of_week, req.hour, req.month)

    if sequence is None or not training_data_loaded:
        raise HTTPException(
            status_code=422,
            detail="Could not find matching historical sequence for LSTM prediction"
        )

    seq_features = sequence[LSTM_FEATURE_COLS].copy()
    seq_start = str(sequence["date_hour"].iloc[0])
    seq_end = str(sequence["date_hour"].iloc[-1])
    seq_traffic_counts = sequence["traffic_count_total"].tolist()

    X_processed = lstm_preprocessor.transform(seq_features)
    X_tensor = torch.tensor(X_processed, dtype=torch.float32).unsqueeze(0)

    with torch.no_grad():
        raw_predictions = lstm_model(X_tensor)

    predictions_np = raw_predictions.cpu().numpy().flatten()
    predictions_original = lstm_target_scaler.inverse_transform(
        predictions_np.reshape(-1, 1)
    ).flatten()

    primary_prediction = float(max(0, predictions_original[0]))

    forecast_72h = [
        {"hours_ahead": i, "prediction": round(max(0, float(p)))}
        for i, p in enumerate(predictions_original)
    ]

    # Get real weather — first try the sequence, then broaden search
    weather_rows = sequence[sequence["temp_f"].notna()]
    weather_source_note = "from matched sequence"

    if weather_rows.empty and training_data_loaded:
        target_day = sequence["date_hour"].iloc[-1].day
        broader = training_data[
            (training_data["temp_f"].notna()) &
            (training_data["month"] == req.month)
        ]
        if not broader.empty:
            broader = broader.copy()
            broader["day_diff"] = (broader["date_hour"].dt.day - target_day).abs()
            broader["hour_diff"] = (broader["hour"] - req.hour).abs()
            broader = broader.sort_values(["day_diff", "hour_diff"])
            weather_rows = broader.head(1)
            weather_source_note = "from nearest match in training data (same month, closest date)"

    if not weather_rows.empty:
        weather_row = weather_rows.iloc[-1]
        weather_data = {
            "temp_f": float(weather_row["temp_f"]),
            "humidity_pct": float(weather_row["humidity_pct"]) if pd.notna(weather_row.get("humidity_pct")) else None,
            "wind_speed_mph": float(weather_row["wind_speed_mph"]) if pd.notna(weather_row.get("wind_speed_mph")) else None,
            "snow_depth_in": float(weather_row["snow_depth_in"]) if pd.notna(weather_row.get("snow_depth_in")) else None,
            "precip_1hr_in": float(weather_row["precip_1hr_in"]) if pd.notna(weather_row.get("precip_1hr_in")) else None,
            "weather_source": f"{weather_row.get('date_hour', 'unknown')} ({weather_source_note})",
        }
    else:
        weather_data = None

    return {
        "prediction": round(primary_prediction),
        "model": "lstm",
        "confidence": "high",
        "details": {
            "input_params": {
                "hour": req.hour,
                "day_of_week": req.day_of_week,
                "month": req.month,
                "is_weekend": req.is_weekend,
                "weather_available": weather_data is not None,
                **(weather_data if weather_data else {"weather_note": "No weather sensors recorded for this sequence period"}),
            },
            "sequence_used": {
                "start": seq_start,
                "end": seq_end,
                "length": len(sequence),
                "sample_traffic": seq_traffic_counts[-5:],
            },
            "forecast_72h": forecast_72h,
        },
    }
