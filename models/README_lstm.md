---
tags:
- traffic-prediction
- sklearn
- pytorch
- time-series
library_name: pytorch
---

# snowbasin-traffic-lstm

## Model Description
This model predicts traffic counts for Snowbasin ski resort based on time, weather, and historical traffic data.

## Model Type
LSTM

## Performance Metrics
- RMSE: 106.57768987722693
- MAE: 71.40272130053302
- R2: 0.902086433245663

## Features
The model uses the following features:
- Temporal features (hour, day of week, month with cyclical encoding)
- Weather data (temperature, humidity, precipitation, wind speed, snow depth)
- Traffic lag features (1, 2, 3, 6, 12, 24, 168 hours)
- Special features (peak hours, federal holidays, holiday weekends)

## Usage

### Random Forest Model
```python
import joblib
from huggingface_hub import hf_hub_download

# Download model
model_path = hf_hub_download(repo_id="YOUR_USERNAME/snowbasin-traffic-lstm", filename="champion_model.joblib")
model = joblib.load(model_path)

# Make predictions
predictions = model.predict(X)
```

### LSTM Model
```python
import torch
from huggingface_hub import hf_hub_download

# Download model
model_path = hf_hub_download(repo_id="YOUR_USERNAME/snowbasin-traffic-lstm", filename="champion_lstm.pth")

# Load model architecture (you'll need the TrafficLSTM class)
model = TrafficLSTM(input_size=33)  # Adjust input_size based on your features
model.load_state_dict(torch.load(model_path))
model.eval()
```

## Training Details
- Split Strategy: sequence
- Train Rows: 44600
- Test Rows: 10521

## Citation
Developed by Team Wildcats for CS6580 Capstone Project - Spring 2026
