---
title: Snowbasin Traffic Prediction API
emoji: 🚗
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# Snowbasin Traffic Prediction FastAPI

A clean REST API for predicting traffic to Snowbasin ski resort using a Random Forest model.

## Endpoints

- `GET /health` — health check / keep-warm ping
- `POST /predict` — traffic prediction
