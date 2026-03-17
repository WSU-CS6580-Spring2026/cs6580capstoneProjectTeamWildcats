"""
Helper script to load and use models from Hugging Face Hub.

This script demonstrates how to download and use the trained models
from Hugging Face Hub in your dashboard or other applications.
"""

from __future__ import annotations

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from huggingface_hub import hf_hub_download
from pathlib import Path


class TrafficLSTM(nn.Module):
    """LSTM model architecture for traffic prediction."""

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
        output = self.fc(last_hidden)
        return output


def load_lstm_model(repo_id: str, token: str | None = None):
    """Load LSTM model from Hugging Face Hub.

    Args:
        repo_id: Repository ID (e.g., 'username/snowbasin-traffic-lstm')
        token: Hugging Face API token (optional, only needed for private repos)

    Returns:
        Dictionary containing:
        - model: Loaded PyTorch model
        - preprocessor: Feature preprocessor
        - target_scaler: Target variable scaler
        - config: Model configuration
    """
    import json

    # Download all necessary files
    model_path = hf_hub_download(
        repo_id=repo_id, filename="champion_lstm.pth", token=token
    )
    preprocessor_path = hf_hub_download(
        repo_id=repo_id, filename="lstm_preprocessor.joblib", token=token
    )
    scaler_path = hf_hub_download(
        repo_id=repo_id, filename="lstm_target_scaler.joblib", token=token
    )
    config_path = hf_hub_download(
        repo_id=repo_id, filename="lstm_config.json", token=token
    )

    # Load configuration
    with open(config_path) as f:
        config = json.load(f)

    # Load preprocessor and scaler
    preprocessor = joblib.load(preprocessor_path)
    target_scaler = joblib.load(scaler_path)

    # Initialize and load model
    model = TrafficLSTM(
        input_size=config["input_size"],
        hidden_size=config.get("hidden_size", 128),
        horizon=config.get("horizon", 72),
    )
    model.load_state_dict(torch.load(model_path, weights_only=True))
    model.eval()

    return {
        "model": model,
        "preprocessor": preprocessor,
        "target_scaler": target_scaler,
        "config": config,
    }


def predict_with_lstm(
    model_dict: dict, features_df: pd.DataFrame, use_sequences: bool = False
) -> np.ndarray:
    """Make predictions using the LSTM model.

    Args:
        model_dict: Dictionary returned by load_lstm_model()
        features_df: DataFrame with required features
        use_sequences: If True, expects features_df to contain sequential data

    Returns:
        Array of predictions (in original scale)
    """
    model = model_dict["model"]
    preprocessor = model_dict["preprocessor"]
    target_scaler = model_dict["target_scaler"]
    config = model_dict["config"]

    # Preprocess features
    X_processed = preprocessor.transform(features_df)

    if use_sequences:
        # Assuming X_processed is already in the correct sequence format
        # Shape should be (batch_size, seq_length, features)
        X_tensor = torch.tensor(X_processed, dtype=torch.float32)
    else:
        # If not using sequences, just make a single prediction
        # Reshape to (1, 1, features) - one sample, one timestep
        X_tensor = torch.tensor(X_processed, dtype=torch.float32).unsqueeze(0)

    # Make prediction
    with torch.no_grad():
        predictions = model(X_tensor)

    # Convert back to numpy and inverse transform
    predictions_np = predictions.cpu().numpy()
    predictions_original = target_scaler.inverse_transform(
        predictions_np.reshape(-1, 1)
    ).flatten()

    return predictions_original


# Example usage
if __name__ == "__main__":
    # Example: Load LSTM model
    print("Loading LSTM model from Hugging Face...")
    lstm_model_dict = load_lstm_model(
        repo_id="YOUR_USERNAME/snowbasin-traffic-lstm"
    )
    print("LSTM model loaded successfully!")
    print(f"Model configuration: {lstm_model_dict['config']}")

    # Example prediction (you would need actual feature data)
    # sample_features = pd.DataFrame({...})  # Your feature data
    # lstm_predictions = predict_with_lstm(lstm_model_dict, sample_features)
