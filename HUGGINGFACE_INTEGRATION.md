# Hugging Face Integration Guide (LSTM)

This guide explains how to train the LSTM model, upload it to Hugging Face Hub, and load it in downstream applications.

## Training and Upload

```bash
export HF_TOKEN="your_token_here"
python src/train_model.py \
  --push-to-hf \
  --hf-repo-name "your-username/snowbasin-traffic"
```

The upload flow publishes an LSTM repository:

- `your-username/snowbasin-traffic-lstm`

Expected artifacts:
- `champion_lstm.pth`
- `lstm_preprocessor.joblib`
- `lstm_target_scaler.joblib`
- `lstm_config.json`
- `README.md`

## Loading the LSTM Model

```python
from src.load_from_huggingface import load_lstm_model

lstm_dict = load_lstm_model("your-username/snowbasin-traffic-lstm")
model = lstm_dict["model"]
preprocessor = lstm_dict["preprocessor"]
target_scaler = lstm_dict["target_scaler"]
```

## Prediction Helper

```python
from src.load_from_huggingface import predict_with_lstm

predictions = predict_with_lstm(lstm_dict, features_df)
```

## Notes

- Random Forest loading/prediction helpers were removed from `src/load_from_huggingface.py`.
- Prefer the LSTM workflow for all new integration work.
