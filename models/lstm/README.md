---
tags:
- traffic-prediction
- pytorch
- time-series
library_name: pytorch
---

# snowbasin-traffic-lstm

## Model Description
This model predicts traffic counts for Snowbasin ski resort based on time, weather, and historical traffic data.

## Model Type
LSTM Neural Network

## Performance Metrics
- RMSE: 104.68406516040494
- MAE: 68.94930388211087
- R2: 0.9055348922165798

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
model_path = hf_hub_download(repo_id="YOUR_USERNAME/snowbasin-traffic-lstm", filename="champion_lstm.pth")

# Load model architecture (you'll need the TrafficLSTM class)
model = TrafficLSTM(input_size=34)  # Adjust input_size based on your features
model.load_state_dict(torch.load(model_path))
model.eval()
```

## Training Details
- Split Strategy: sequence
- Train Rows: 44600
- Test Rows: 10521

## Citation
Developed by Team Wildcats for CS6580 Capstone Project - Spring 2026
