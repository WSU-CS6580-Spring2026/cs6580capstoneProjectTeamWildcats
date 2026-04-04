from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
import os

import joblib
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from huggingface_hub import HfApi, create_repo, upload_folder
from huggingface_hub.utils import RepositoryNotFoundError

TARGET_COLUMN = "traffic_count_total"
RANDOM_STATE = 42
DEFAULT_SPLIT_STRATEGY = "time"
VALID_SPLIT_STRATEGIES = {"random", "time"}
SEQUENCE_LENGTH = 48
FORECAST_HORIZON = 72
WEEKLY_LAG_HOURS = 168


def add_engineered_features(data: pd.DataFrame) -> pd.DataFrame:
    engineered = data.copy()
    engineered["date_hour"] = pd.to_datetime(engineered["date_hour"], errors="coerce")
    engineered["date"] = (
        pd.to_datetime(engineered["date"], errors="coerce")
        if "date" in engineered.columns
        else engineered["date_hour"].dt.normalize()
    )

    engineered["day_of_week_num"] = pd.to_datetime(engineered["date_hour"]).dt.dayofweek
    engineered["month"] = engineered["date_hour"].dt.month
    engineered["is_peak_hour"] = engineered["hour"].isin([7, 8, 9, 15, 16, 17]).astype(int)
    engineered["temp_dewpoint_spread"] = engineered["temp_f"] - engineered["dewpoint_f"]

    # Engineer Numeric columns for  Holdiday Weekends and Distance From a Holiday Weekend
    daily = (
        engineered.groupby("date")[["is_federal_holiday"]]
        .max()
        .sort_index()
        .reset_index()
    )

    daily["date"] = pd.to_datetime(daily["date"], errors="coerce").dt.normalize()
    daily["weekday"] = daily["date"].dt.dayofweek

    daily["is_holiday_weekend"] = False

    holiday_dates = daily.loc[daily["is_federal_holiday"], "date"]

    for holiday_date in holiday_dates:
        wd = holiday_date.dayofweek

        if wd <= 2:
            saturday = holiday_date - pd.Timedelta(days=(wd + 2))
            sunday = saturday + pd.Timedelta(days=1)
            window_start = saturday
            window_end = holiday_date

        elif wd <= 4:
            saturday = holiday_date + pd.Timedelta(days=(5 - wd))
            sunday = saturday + pd.Timedelta(days=1)
            window_start = holiday_date
            window_end = sunday

        else:
            saturday = holiday_date - pd.Timedelta(days=(wd - 5))
            sunday = saturday + pd.Timedelta(days=1)
            window_start = saturday
            window_end = sunday

        daily.loc[
            (daily["date"] >= window_start) &
            (daily["date"] <= window_end),
            "is_holiday_weekend"
        ] = True

    daily["last_hw"] = daily["date"].where(daily["is_holiday_weekend"]).ffill()
    daily["days_since"] = (daily["date"] - daily["last_hw"]).dt.days

    daily["next_hw"] = daily["date"].where(daily["is_holiday_weekend"]).bfill()
    daily["days_until"] = (daily["next_hw"] - daily["date"]).dt.days

    daily["distance_to_holiday_weekend"] = daily[
        ["days_since", "days_until"]
    ].min(axis=1)

    # Merge back to hourly
    engineered = engineered.merge(
        daily[["date", "distance_to_holiday_weekend"]],
        on="date",
        how="left"
    )

    # Engineer lag features for traffic_count_total
    lag_hours = [1, 2, 3, 6, 12, 24, 168]

    for lag in lag_hours:
        engineered[f"traffic_lag_{lag}"] = (
            engineered[TARGET_COLUMN].shift(lag)
        )

    # adding in features that encode cyclical time patterns
    engineered["hour_sin"] = np.sin(2 * np.pi * engineered["hour"] / 24)
    engineered["hour_cos"] = np.cos(2 * np.pi * engineered["hour"] / 24)

    engineered["day_of_week_sin"] = np.sin(2 * np.pi * engineered["day_of_week_num"] / 7)
    engineered["day_of_week_cos"] = np.cos(2 * np.pi * engineered["day_of_week_num"] / 7)

    engineered["month_sin"] = np.sin(2 * np.pi * engineered["month"] / 12)
    engineered["month_cos"] = np.cos(2 * np.pi * engineered["month"] / 12)

    # Drop day of week numeric
    engineered = engineered.drop(columns=["day_of_week_num"])

    return engineered


def build_features_and_target(data: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    required = {
        TARGET_COLUMN,
        "lane_count",
        "temp_f",
        "dewpoint_f",
        "humidity_pct",
        "wind_speed_mph",
        "snow_depth_in",
        "precip_1hr_in",
        "hour",
        "day_of_week",
        "is_weekend",
        "is_federal_holiday",
        "month",
        "is_peak_hour",
        "temp_dewpoint_spread",
        "distance_to_holiday_weekend",
        "traffic_lag_1",
        "traffic_lag_2",
        "traffic_lag_3",
        "traffic_lag_6",
        "traffic_lag_12",
        "traffic_lag_24",
        "traffic_lag_168",
        "hour_sin",
        "hour_cos",
        "day_of_week_sin",
        "day_of_week_cos",
        "month_sin",
        "month_cos",
    }
    missing = required - set(data.columns)
    if missing:
        raise ValueError(f"Missing required columns for training: {sorted(missing)}")

    feature_columns = [
        "lane_count",
        "temp_f",
        "dewpoint_f",
        "humidity_pct",
        "wind_speed_mph",
        "snow_depth_in",
        "precip_1hr_in",
        "hour",
        "month",
        "temp_dewpoint_spread",
        "is_weekend",
        "is_federal_holiday",
        "is_peak_hour",
        "day_of_week",
        "distance_to_holiday_weekend",
        "traffic_lag_1",
        "traffic_lag_2",
        "traffic_lag_3",
        "traffic_lag_6",
        "traffic_lag_12",
        "traffic_lag_24",
        "traffic_lag_168",
        "hour_sin",
        "hour_cos",
        "day_of_week_sin",
        "day_of_week_cos",
        "month_sin",
        "month_cos",
    ]
    return data[feature_columns], data[TARGET_COLUMN]


def drop_missing_target_rows(data: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Exclude records with missing response values before model fitting.

    The model can safely impute missing feature values, but imputing the response
    variable would create synthetic traffic trends and bias evaluation metrics.
    """

    filtered = data.dropna(subset=[TARGET_COLUMN]).copy()
    dropped_count = int(len(data) - len(filtered))
    return filtered, dropped_count

def build_horizon_weights(horizon: int) -> np.ndarray:
    weights = np.linspace(1.0, 0.3, num=horizon, dtype=np.float32)
    return weights / weights.sum()


def weighted_mse_numpy(
    predictions: np.ndarray,
    targets: np.ndarray,
    weights: np.ndarray,
) -> float:
    error = (predictions - targets) ** 2
    weighted_error = error * weights.reshape(1, -1)
    return float(weighted_error.mean())

# Functions necessary for rnn/lstm model
# build preprocessor for LSTM model
def build_lstm_preprocessor() -> ColumnTransformer:
    numeric_features = [
        "lane_count",
        "temp_f",
        "dewpoint_f",
        "humidity_pct",
        "wind_speed_mph",
        "snow_depth_in",
        "precip_1hr_in",
        "hour",
        "month",
        "temp_dewpoint_spread",
        "is_weekend",
        "is_federal_holiday",
        "is_peak_hour",
        "distance_to_holiday_weekend",
        "traffic_lag_1",
        "traffic_lag_2",
        "traffic_lag_3",
        "traffic_lag_6",
        "traffic_lag_12",
        "traffic_lag_24",
        "traffic_lag_168",
        "hour_sin",
        "hour_cos",
        "day_of_week_sin",
        "day_of_week_cos",
        "month_sin",
        "month_cos",
    ]
    categorical_features = ["day_of_week"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]), numeric_features),
            ("categorical", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
            ]), categorical_features),
        ],
        remainder="drop"
    )

    return preprocessor

# This ensures all rows in a sequence fed into the model are continuous
# It returns an array of dataframes, where each dataframe is a continuous sequence of rows with no gaps in the date_hour column.
def split_into_continuous_segments(df: pd.DataFrame) -> list[pd.DataFrame]:
    df = df.sort_values("date_hour").copy()

    df["date_hour"] = pd.to_datetime(df["date_hour"])
    df["time_diff"] = df["date_hour"].diff().dt.total_seconds() / 3600

    # Start a new sequence whenever the time difference between consecutive rows is over 1 hour
    df["segment_id"] = (df["time_diff"] > 1).cumsum()

    segments = []

    for _, seg in df.groupby("segment_id"):
        seg = seg.drop(columns=["time_diff", "segment_id"])
        if len(seg) >= 121:
            segments.append(seg)

    return segments

# Create sliding window sequences within each segment, separating features and target and returning feature and target arrays suitable for RNN/LSTM
def build_sequences(
    segments: list[pd.DataFrame],
    feature_cols: list[str],
    target_col: str,
    seq_length: int = SEQUENCE_LENGTH,
    horizon: int = FORECAST_HORIZON,
    weekly_lag_hours: int | None = None,
):
    X, y, naive_weekly_predictions = [], [], []
    min_history = max(seq_length, weekly_lag_hours or 0)

    for seg in segments:
        features = seg[feature_cols].values
        target = seg[target_col].values

        for i in range(min_history, len(seg) - horizon + 1):
            # the features window for one sample/window is the previous seq_length rows(48), and the target is the next horizon(72) rows after that
            X.append(features[i-seq_length:i])
            y.append(target[i:i+horizon])
            if weekly_lag_hours is not None:
                naive_weekly_predictions.append(target[i-weekly_lag_hours:i-weekly_lag_hours+horizon])

    if weekly_lag_hours is not None:
        return np.array(X), np.array(y), np.array(naive_weekly_predictions)
    return np.array(X), np.array(y), None

# Create pytorch traffic dataset for RNN/LSTM
class TrafficDataset(Dataset):
    def __init__(self, X: np.ndarray, y: np.ndarray):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

# Define LSTM model for traffic prediction
class TrafficLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=128, horizon=72):
        super().__init__()

        self.lstm = nn.LSTM(input_size=input_size, hidden_size=hidden_size, num_layers=2, dropout=0.2, batch_first=True)
        self.fc = nn.Linear(hidden_size, horizon)

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]
        output = self.fc(last_hidden)
        return output

#Create weighted mse loss function to prioritize accuracy nearer to the current time point in the horizon, then train the LSTM model
def weighted_mse(predictions, targets, weights):
    error = (predictions - targets) ** 2
    weighted_error = error * weights
    return weighted_error.mean()

def train_lstm_model(X, y, epochs=25, batch_size=128):
    dataset = TrafficDataset(X, y)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=False, drop_last=True)

    model = TrafficLSTM(input_size=X.shape[2])

    # Create weights for custom loss function to prioritize accuracy nearer to the current time point
    horizon = y.shape[1]
    weights = torch.tensor(build_horizon_weights(horizon), dtype=torch.float32)

    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(epochs):

        epoch_loss = 0.0

        for batch_X, batch_y in dataloader:
            optimizer.zero_grad()
            predictions = model(batch_X)
            loss = weighted_mse(predictions, batch_y, weights=weights.to(predictions.device))
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()

        print(f"Epoch {epoch+1}/{epochs}, Loss: {epoch_loss:.5f}")

    return model


def create_model_card(model_name: str, metrics: dict) -> str:
    """Create a README.md model card for Hugging Face."""
    card = f"""---
tags:
- traffic-prediction
- pytorch
- time-series
library_name: pytorch
---

# {model_name}

## Model Description
This model predicts traffic counts for Snowbasin ski resort based on time, weather, and historical traffic data.

## Model Type
LSTM Neural Network

## Performance Metrics
- RMSE: {metrics.get('rmse', 'N/A')}
- MAE: {metrics.get('mae', 'N/A')}
- R2: {metrics.get('r2', 'N/A')}

## Features
The model uses the following features:
- Temporal features (hour, day of week, month with cyclical encoding)
- Weather data (temperature, humidity, precipitation, wind speed, snow depth)
- Traffic lag features (1, 2, 3, 6, 12, 24, 168 hours)
- Special features (peak hours, federal holidays, holiday weekends)

## Usage

```python
import torch
from huggingface_hub import hf_hub_download

# Download model
model_path = hf_hub_download(repo_id="YOUR_USERNAME/{model_name}", filename="champion_lstm.pth")

# Load model architecture (you'll need the TrafficLSTM class)
model = TrafficLSTM(input_size=34)  # Adjust input_size based on your features
model.load_state_dict(torch.load(model_path))
model.eval()
```

## Training Details
- Split Strategy: {metrics.get('split_strategy', 'time')}
- Train Rows: {metrics.get('train_rows', 'N/A')}
- Test Rows: {metrics.get('test_rows', 'N/A')}

## Citation
Developed by Team Wildcats for CS6580 Capstone Project - Spring 2026
"""
    return card


def push_to_huggingface(
    model_dir: Path,
    repo_name: str,
    hf_token: str | None = None,
    private: bool = False,
) -> str:
    """Push model artifacts to Hugging Face Hub."""
    if hf_token is None:
        hf_token = os.environ.get("HF_TOKEN")
        if hf_token is None:
            raise ValueError(
                "HuggingFace token not provided. Either pass hf_token parameter or set HF_TOKEN environment variable."
            )

    api = HfApi()

    try:
        create_repo(
            repo_id=repo_name,
            token=hf_token,
            private=private,
            exist_ok=True,
        )
        print(f"Repository {repo_name} created/verified successfully")
    except Exception as e:
        print(f"Error creating repository: {e}")
        raise

    try:
        api.upload_folder(
            folder_path=str(model_dir),
            repo_id=repo_name,
            token=hf_token,
        )
        repo_url = f"https://huggingface.co/{repo_name}"
        print(f"Model uploaded successfully to {repo_url}")
        return repo_url
    except Exception as e:
        print(f"Error uploading model: {e}")
        raise


def train_and_evaluate(
    input_file: Path,
    model_dir: Path = Path("models"),
    results_dir: Path = Path("results"),
    test_size: float = 0.2,
    split_strategy: str = DEFAULT_SPLIT_STRATEGY,
    compare_with_time_split: bool = True,
    push_to_hf: bool = False,
    hf_repo_name: str | None = None,
    hf_token: str | None = None,
    hf_private: bool = False,
) -> dict[str, float | str | int]:
    if not input_file.exists():
        raise FileNotFoundError(
            f"{input_file} was not found. Run `python src/data_cleaning.py` first to build processed data."
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    results_dir.mkdir(parents=True, exist_ok=True)

    data = pd.read_csv(input_file)
    engineered = add_engineered_features(data)
    engineered, dropped_target_rows = drop_missing_target_rows(engineered)

    if engineered.empty:
        raise ValueError(
            "No training rows available after removing records with missing target values."
        )

    features, target = build_features_and_target(engineered)

    # LSTM model training and evaluation _____________________________________________________________________________________________________

    # preprocess data for LSTM
    # Split into train and test
    train_raw_df, test_raw_df = train_test_split(engineered, test_size=test_size, shuffle=False)

    # Preprocess Features (Scale and impute)
    preprocessor = build_lstm_preprocessor()
    # Fit preprocessor on train data and transform train data
    X_train = preprocessor.fit_transform(train_raw_df)
    # transform test data with the same preprocessor fitted on train data
    X_test = preprocessor.transform(test_raw_df)

    # Scale Target
    target_scaler = StandardScaler()
    # fit target scaler on train target and transform train target
    y_train = target_scaler.fit_transform(
        train_raw_df[[TARGET_COLUMN]]
    ).flatten()
    # transform test target with the same target scaler fitted on train target
    y_test = target_scaler.transform(
        test_raw_df[[TARGET_COLUMN]]
    ).flatten()

    # rebuild train and test dataframes with preprocessed features and scaled target for sequence building
    train_lstm_df = pd.DataFrame(X_train)
    train_lstm_df[TARGET_COLUMN] = y_train
    train_lstm_df["date_hour"] = train_raw_df["date_hour"].values

    test_lstm_df = pd.DataFrame(X_test)
    test_lstm_df[TARGET_COLUMN] = y_test
    test_lstm_df["date_hour"] = test_raw_df["date_hour"].values

    # build sequences separately on train and test to avoid data leakage
    train_segments = split_into_continuous_segments(train_lstm_df)
    test_segments = split_into_continuous_segments(test_lstm_df)

    feature_columns = train_lstm_df.columns.drop([TARGET_COLUMN, "date_hour"]).tolist()

    X_train_seq, y_train_seq, _ = build_sequences(
        train_segments,
        feature_columns,
        TARGET_COLUMN,
        weekly_lag_hours=WEEKLY_LAG_HOURS,
    )

    X_test_seq, y_test_seq, y_test_weekly_naive = build_sequences(
        test_segments,
        feature_columns,
        TARGET_COLUMN,
        weekly_lag_hours=WEEKLY_LAG_HOURS,
    )

    print(f"Built {len(X_train_seq)} training sequences and {len(X_test_seq)} testing sequences of length 48 hours with a 72 hour horizon for LSTM model.")

    # Train and Save LSTM model
    lstm_model = train_lstm_model(X_train_seq, y_train_seq)
    torch.save(lstm_model.state_dict(), model_dir / "champion_lstm.pth")

    # Save LSTM preprocessor and target scaler for later use
    joblib.dump(preprocessor, model_dir / "lstm_preprocessor.joblib")
    joblib.dump(target_scaler, model_dir / "lstm_target_scaler.joblib")

    # Save model configuration
    lstm_config = {
        "input_size": int(X_train_seq.shape[2]),
        "hidden_size": 128,
        "horizon": 72,
        "seq_length": 48,
        "feature_columns": feature_columns,
    }
    with open(model_dir / "lstm_config.json", "w", encoding='utf-8') as f:
        json.dump(lstm_config, f, indent=2)

    # Evaluate LSTM model
    lstm_model.eval()

    test_dataset = TrafficDataset(X_test_seq, y_test_seq)
    test_loader = DataLoader(test_dataset, batch_size=256, shuffle=False)

    predictions = []

    with torch.no_grad():
        for batch_X, _ in test_loader:
            preds = lstm_model(batch_X)
            predictions.append(preds.cpu().numpy())

    lstm_predictions = np.vstack(predictions)

    # Assess LSTM
    y_true_lstm = target_scaler.inverse_transform(
    y_test_seq.reshape(-1,1)
    ).flatten()

    y_pred_lstm = target_scaler.inverse_transform(
        lstm_predictions.reshape(-1,1)
    ).flatten()

    y_pred_weekly_naive = target_scaler.inverse_transform(
        y_test_weekly_naive.reshape(-1, 1)
    ).flatten()

    lstm_rmse = np.sqrt(mean_squared_error(y_true_lstm, y_pred_lstm))
    lstm_mae = mean_absolute_error(y_true_lstm, y_pred_lstm)
    lstm_r2 = r2_score(y_true_lstm, y_pred_lstm)
    weekly_naive_rmse = np.sqrt(mean_squared_error(y_true_lstm, y_pred_weekly_naive))
    weekly_naive_mae = mean_absolute_error(y_true_lstm, y_pred_weekly_naive)
    weekly_naive_r2 = r2_score(y_true_lstm, y_pred_weekly_naive)

    horizon_weights = build_horizon_weights(y_test_seq.shape[1])

    # Inverse transform full sequences to preserve shape
    y_true_seq_original = target_scaler.inverse_transform(
        y_test_seq.reshape(-1, 1)
    ).reshape(y_test_seq.shape)

    y_pred_seq_original = target_scaler.inverse_transform(
        lstm_predictions.reshape(-1, 1)
    ).reshape(lstm_predictions.shape)

    y_naive_seq_original = target_scaler.inverse_transform(
        y_test_weekly_naive.reshape(-1, 1)
    ).reshape(y_test_weekly_naive.shape)

    # Get weighted MSE in real units
    lstm_weighted_mse = weighted_mse_numpy(
        y_pred_seq_original,
        y_true_seq_original,
        horizon_weights
    )

    weekly_naive_weighted_mse = weighted_mse_numpy(
        y_naive_seq_original,
        y_true_seq_original,
        horizon_weights
    )

    # Horizon-wise RMSE (without flattening) to see how accuracy changes across the 72 hour horizon for both LSTM and weekly naive predictions
    rmse_per_horizon_lstm = np.sqrt(
        ((y_pred_seq_original - y_true_seq_original) ** 2).mean(axis=0)
    )

    rmse_per_horizon_naive = np.sqrt(
        ((y_naive_seq_original - y_true_seq_original) ** 2).mean(axis=0)
    )

    print("LSTM RMSE:", lstm_rmse)
    print("LSTM MAE:", lstm_mae)
    print("LSTM R2:", lstm_r2)
    print("LSTM weighted MSE:", lstm_weighted_mse)
    print("Weekly naive RMSE:", weekly_naive_rmse)
    print("Weekly naive MAE:", weekly_naive_mae)
    print("Weekly naive R2:", weekly_naive_r2)
    print("Weekly naive weighted MSE:", weekly_naive_weighted_mse)
    print("LSTM RMSE per horizon:", rmse_per_horizon_lstm)
    print("Weekly naive RMSE per horizon:", rmse_per_horizon_naive)


    metrics_df = pd.DataFrame(
        [
            {
                "split_strategy": "sequence",
                "model": "baseline_weekly_naive",
                "rmse": weekly_naive_rmse,
                "mae": weekly_naive_mae,
                "r2": weekly_naive_r2,
                "weighted_mse": weekly_naive_weighted_mse,
            },
            {
                "split_strategy": "sequence",
                "model": "lstm_model",
                "rmse": lstm_rmse,
                "mae": lstm_mae,
                "r2": lstm_r2,
                "weighted_mse": lstm_weighted_mse,
            }
        ]
    )
    metrics_file = results_dir / "model_metrics.csv"
    metrics_df.to_csv(metrics_file, index=False)

    horizon_df = pd.DataFrame({
    "horizon_step": np.arange(1, len(rmse_per_horizon_lstm) + 1),
    "lstm_rmse": rmse_per_horizon_lstm,
    "naive_rmse": rmse_per_horizon_naive,
    })

    horizon_file = results_dir / "horizon_rmse.csv"
    horizon_df.to_csv(horizon_file, index=False)

    summary = {
        "split_strategy": "sequence",
        "train_rows": len(X_train_seq),
        "test_rows": len(X_test_seq),
        "dropped_target_rows": dropped_target_rows,
        "baseline_weekly_naive_rmse": weekly_naive_rmse,
        "baseline_weekly_naive_mae": weekly_naive_mae,
        "baseline_weekly_naive_r2": weekly_naive_r2,
        "baseline_weekly_naive_weighted_mse": weekly_naive_weighted_mse,
        "lstm_rmse": lstm_rmse,
        "lstm_mae": lstm_mae,
        "lstm_r2": lstm_r2,
        "lstm_weighted_mse": lstm_weighted_mse,
        "metrics_file": str(metrics_file)
    }
    summary_file = results_dir / "training_summary.json"
    summary_file.write_text(json.dumps(summary, indent=2), encoding='utf-8')
    summary["summary_file"] = str(summary_file)

    # Create model card for Hugging Face
    lstm_metrics = {
        "rmse": lstm_rmse,
        "mae": lstm_mae,
        "r2": lstm_r2,
        "split_strategy": "sequence",
        "train_rows": len(X_train_seq),
        "test_rows": len(X_test_seq),
    }
    lstm_card = create_model_card("snowbasin-traffic-lstm", lstm_metrics)
    (model_dir / "README_lstm.md").write_text(lstm_card, encoding='utf-8')

    # Push to Hugging Face if requested
    if push_to_hf:
        if hf_repo_name is None:
            raise ValueError("hf_repo_name must be provided when push_to_hf=True")

        # Create LSTM directory with all artifacts
        lstm_dir = model_dir / "lstm"
        lstm_dir.mkdir(parents=True, exist_ok=True)

        shutil.copy(model_dir / "champion_lstm.pth", lstm_dir / "champion_lstm.pth")
        shutil.copy(model_dir / "lstm_preprocessor.joblib", lstm_dir / "lstm_preprocessor.joblib")
        shutil.copy(model_dir / "lstm_target_scaler.joblib", lstm_dir / "lstm_target_scaler.joblib")
        shutil.copy(model_dir / "lstm_config.json", lstm_dir / "lstm_config.json")
        shutil.copy(model_dir / "README_lstm.md", lstm_dir / "README.md")

        # Upload LSTM model
        try:
            lstm_repo = f"{hf_repo_name}-lstm"
            lstm_url = push_to_huggingface(lstm_dir, lstm_repo, hf_token, hf_private)
            summary["huggingface_lstm_url"] = lstm_url
        except Exception as e:
            print(f"Failed to upload LSTM model: {e}")
            summary["huggingface_lstm_error"] = str(e)

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train and evaluate the Snowbasin traffic model.")
    parser.add_argument(
        "--input-file",
        type=Path,
        default=Path("data/processed/snowbasin_hourly_joined.csv"),
        help="Processed CSV created by src/data_cleaning.py",
    )
    parser.add_argument("--model-dir", type=Path, default=Path("models"))
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument(
        "--split-strategy",
        choices=sorted(VALID_SPLIT_STRATEGIES),
        default=DEFAULT_SPLIT_STRATEGY,
        help="random uses shuffled rows; time trains on earliest rows and tests on latest rows.",
    )
    parser.add_argument(
        "--skip-time-comparison",
        action="store_true",
        help="Skip time-split comparison when using the random split strategy.",
    )
    parser.add_argument(
        "--push-to-hf",
        action="store_true",
        help="Push trained models to Hugging Face Hub.",
    )
    parser.add_argument(
        "--hf-repo-name",
        type=str,
        help="Base name for Hugging Face repository (e.g., 'username/snowbasin-traffic'). Will create *-lstm repo.",
    )
    parser.add_argument(
        "--hf-token",
        type=str,
        help="Hugging Face API token. If not provided, will use HF_TOKEN environment variable.",
    )
    parser.add_argument(
        "--hf-private",
        action="store_true",
        help="Create private Hugging Face repositories.",
    )
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    summary = train_and_evaluate(
        input_file=args.input_file,
        model_dir=args.model_dir,
        results_dir=args.results_dir,
        test_size=args.test_size,
        split_strategy=args.split_strategy,
        compare_with_time_split=not args.skip_time_comparison,
        push_to_hf=args.push_to_hf,
        hf_repo_name=args.hf_repo_name,
        hf_token=args.hf_token,
        hf_private=args.hf_private,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
