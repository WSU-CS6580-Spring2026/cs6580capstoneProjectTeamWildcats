"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type WeatherCondition = "snowy" | "rainy" | "freezing" | "cold" | "mild" | "clear" | "default";
export type TrafficLevel = "low" | "moderate" | "heavy" | "severe" | "none";

export interface WeatherTheme {
  condition: WeatherCondition;
  trafficLevel: TrafficLevel;
  temp_f: number | null;
  humidity_pct: number | null;
  wind_speed_mph: number | null;
  snow_depth_in: number | null;
  precip_1hr_in: number | null;
  prediction: number | null;
  confidence: string | null;
  model: string | null;
  forecast_72h: { hours_ahead: number; prediction: number }[] | null;
}

interface WeatherThemeContextType {
  theme: WeatherTheme;
  updateFromPrediction: (mlResponse: Record<string, unknown>, model?: string, mlRequest?: Record<string, unknown>) => void;
  reset: () => void;
}

const DEFAULT_THEME: WeatherTheme = {
  condition: "default",
  trafficLevel: "none",
  temp_f: null,
  humidity_pct: null,
  wind_speed_mph: null,
  snow_depth_in: null,
  precip_1hr_in: null,
  prediction: null,
  confidence: null,
  model: null,
  forecast_72h: null,
};

const WeatherThemeContext = createContext<WeatherThemeContextType>({
  theme: DEFAULT_THEME,
  updateFromPrediction: () => {},
  reset: () => {},
});

function resolveCondition(params: Record<string, unknown>): WeatherCondition {
  const weatherAvailable = params.weather_available !== false && params.temp_f != null;
  if (!weatherAvailable) return "default";

  const temp = Number(params.temp_f ?? 32);
  const snow = Number(params.snow_depth_in ?? 0);
  const precip = Number(params.precip_1hr_in ?? 0);

  if (snow > 5 || (precip > 0.1 && temp < 33)) return "snowy";
  if (precip > 0.05) return "rainy";
  if (temp < 25) return "freezing";
  if (temp < 40) return "cold";
  if (temp < 60) return "mild";
  return "clear";
}

function resolveTraffic(vph: number): TrafficLevel {
  if (vph <= 0) return "none";
  if (vph < 80) return "low";
  if (vph < 180) return "moderate";
  if (vph < 300) return "heavy";
  return "severe";
}

export function WeatherThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<WeatherTheme>(DEFAULT_THEME);

  const updateFromPrediction = useCallback(
    (mlResponse: Record<string, unknown>, model?: string, mlRequest?: Record<string, unknown>) => {
      const details = mlResponse.details as Record<string, unknown> | undefined;
      const inputParams = (details?.input_params ?? mlRequest ?? {}) as Record<string, unknown>;
      const prediction = Number(mlResponse.prediction ?? 0);

      // Validate forecast_72h — must be an array with correct shape
      const rawForecast = details?.forecast_72h;
      const forecast = Array.isArray(rawForecast) && rawForecast.length > 0
        && typeof rawForecast[0]?.hours_ahead === "number"
        && typeof rawForecast[0]?.prediction === "number"
        ? (rawForecast as { hours_ahead: number; prediction: number }[])
        : null;

      // Safe number extraction helper
      const safeNum = (val: unknown): number | null => {
        if (val == null) return null;
        const n = Number(val);
        return isFinite(n) ? n : null;
      };

      // Full replace — no stale data from previous prediction
      setTheme({
        condition: resolveCondition(inputParams),
        trafficLevel: resolveTraffic(prediction),
        temp_f: safeNum(inputParams.temp_f),
        humidity_pct: safeNum(inputParams.humidity_pct),
        wind_speed_mph: safeNum(inputParams.wind_speed_mph),
        snow_depth_in: safeNum(inputParams.snow_depth_in),
        precip_1hr_in: safeNum(inputParams.precip_1hr_in),
        prediction,
        confidence: mlResponse.confidence ? String(mlResponse.confidence) : null,
        model: model ?? String(mlResponse.model ?? ""),
        forecast_72h: forecast, // null for RF, array for LSTM
      });
    },
    []
  );

  const reset = useCallback(() => setTheme(DEFAULT_THEME), []);

  return (
    <WeatherThemeContext.Provider value={{ theme, updateFromPrediction, reset }}>
      {children}
    </WeatherThemeContext.Provider>
  );
}

export const useWeatherTheme = () => useContext(WeatherThemeContext);
