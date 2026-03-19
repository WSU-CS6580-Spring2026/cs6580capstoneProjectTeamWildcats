"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Thermometer,
  Droplets,
  Wind,
  Snowflake,
  CloudRain,
  Car,
  TrendingUp,
  TrendingDown,
  Minus,
  Sun,
  Cloud,
  CloudSnow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageMeta } from "./chat-messages";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WeatherData {
  temp_f: number | null;
  humidity_pct: number | null;
  wind_speed_mph: number | null;
  snow_depth_in: number | null;
  precip_1hr_in: number | null;
  weather_available: boolean;
}

interface TrafficData {
  prediction: number;
  confidence: string;
  model: string;
  forecast_72h?: { hours_ahead: number; prediction: number }[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTrafficLevel(vph: number) {
  if (vph < 80) return { label: "Low", color: "text-green-500", bg: "bg-green-500", pct: Math.min((vph / 80) * 25, 25) };
  if (vph < 180) return { label: "Moderate", color: "text-yellow-500", bg: "bg-yellow-500", pct: 25 + ((vph - 80) / 100) * 25 };
  if (vph < 300) return { label: "Heavy", color: "text-orange-500", bg: "bg-orange-500", pct: 50 + ((vph - 180) / 120) * 25 };
  return { label: "Severe", color: "text-red-500", bg: "bg-red-500", pct: Math.min(75 + ((vph - 300) / 200) * 25, 100) };
}

function getWeatherCondition(w: WeatherData) {
  if (!w.weather_available) return { label: "Unknown", Icon: Cloud, gradient: "from-gray-400 to-gray-600" };
  const snow = w.snow_depth_in ?? 0;
  const precip = w.precip_1hr_in ?? 0;
  const temp = w.temp_f ?? 32;

  if (snow > 5 || (precip > 0.1 && temp < 33))
    return { label: "Snowy", Icon: CloudSnow, gradient: "from-blue-400 to-indigo-600" };
  if (precip > 0.05)
    return { label: "Rainy", Icon: CloudRain, gradient: "from-slate-400 to-blue-600" };
  if (temp < 25)
    return { label: "Freezing", Icon: Snowflake, gradient: "from-cyan-400 to-blue-700" };
  if (temp < 40)
    return { label: "Cold", Icon: Cloud, gradient: "from-blue-300 to-blue-500" };
  return { label: "Mild", Icon: Sun, gradient: "from-amber-300 to-orange-500" };
}

function getTrend(forecast: { hours_ahead: number; prediction: number }[]) {
  if (forecast.length < 4) return "stable";
  const first = forecast.slice(0, 4).reduce((s, f) => s + f.prediction, 0) / 4;
  const last = forecast.slice(-4).reduce((s, f) => s + f.prediction, 0) / 4;
  if (last > first * 1.15) return "up";
  if (last < first * 0.85) return "down";
  return "stable";
}

/* ------------------------------------------------------------------ */
/*  Sparkline SVG                                                      */
/* ------------------------------------------------------------------ */

function Sparkline({ data, className }: { data: { hours_ahead: number; prediction: number }[]; className?: string }) {
  const { points, fillPoints, maxY, minY } = useMemo(() => {
    if (!data.length) return { points: "", fillPoints: "", maxY: 0, minY: 0 };
    const vals = data.map((d) => d.prediction);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    const w = 280;
    const h = 60;
    const pad = 4;

    const pts = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (d.prediction - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    });

    const line = pts.join(" ");
    const fill = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
    return { points: line, fillPoints: fill, maxY: max, minY: min };
  }, [data]);

  if (!data.length) return null;

  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 280 60" className="w-full h-auto" preserveAspectRatio="none">
        {/* Gradient fill */}
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#sparkFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* Labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5 px-1">
        <span>+{data[0].hours_ahead}h</span>
        <span className="font-medium text-foreground">{Math.round(minY)}–{Math.round(maxY)} veh/hr</span>
        <span>+{data[data.length - 1].hours_ahead}h</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weather Card                                                       */
/* ------------------------------------------------------------------ */

function WeatherCard({ weather }: { weather: WeatherData }) {
  const condition = getWeatherCondition(weather);
  const CondIcon = condition.Icon;

  if (!weather.weather_available) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="rounded-xl border bg-card/60 backdrop-blur-sm p-3 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Cloud className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weather</p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400">No sensor data for this period</p>
        </div>
      </motion.div>
    );
  }

  const stats = [
    { icon: Droplets, label: "Humidity", value: weather.humidity_pct != null ? `${Math.round(weather.humidity_pct)}%` : "N/A", color: "text-blue-400" },
    { icon: Wind, label: "Wind", value: weather.wind_speed_mph != null ? `${weather.wind_speed_mph.toFixed(1)} mph` : "N/A", color: "text-teal-400" },
    { icon: Snowflake, label: "Snow", value: weather.snow_depth_in != null ? `${weather.snow_depth_in.toFixed(1)}"` : "N/A", color: "text-cyan-300" },
    { icon: CloudRain, label: "Precip", value: weather.precip_1hr_in != null ? `${weather.precip_1hr_in.toFixed(2)}"` : "N/A", color: "text-indigo-400" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="rounded-xl overflow-hidden border"
    >
      {/* Header with gradient */}
      <div className={cn("bg-linear-to-br text-white p-4 relative overflow-hidden", condition.gradient)}>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10" />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold mb-0.5">Conditions</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold leading-none">
                {weather.temp_f != null ? `${Math.round(weather.temp_f)}°` : "—"}
              </span>
              <span className="text-sm font-medium text-white/80 mb-0.5">F</span>
            </div>
            <p className="text-xs text-white/80 mt-1 font-medium">{condition.label}</p>
          </div>
          <CondIcon className="h-12 w-12 text-white/80" strokeWidth={1.5} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-border bg-card/80 backdrop-blur-sm">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center py-2.5 px-1 gap-0.5">
            <s.icon className={cn("h-3.5 w-3.5", s.color)} />
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <span className="text-xs font-semibold">{s.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Traffic Card                                                       */
/* ------------------------------------------------------------------ */

function TrafficCard({ traffic }: { traffic: TrafficData }) {
  const level = getTrafficLevel(traffic.prediction);
  const forecast = traffic.forecast_72h;
  const trend = forecast ? getTrend(forecast) : "stable";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const isLstm = traffic.model?.toLowerCase().includes("lstm");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
      className="rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", level.bg + "/15")}>
              <Car className={cn("h-5 w-5", level.color)} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Traffic</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold leading-none">{Math.round(traffic.prediction)}</span>
                <span className="text-xs text-muted-foreground">veh/hr</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={cn("text-sm font-bold", level.color)}>{level.label}</span>
            <div className="flex items-center gap-0.5 justify-end mt-0.5">
              <TrendIcon className={cn("h-3 w-3", trend === "up" ? "text-red-400" : trend === "down" ? "text-green-400" : "text-muted-foreground")} />
              <span className="text-[10px] text-muted-foreground">
                {trend === "up" ? "Increasing" : trend === "down" ? "Decreasing" : "Stable"}
              </span>
            </div>
          </div>
        </div>

        {/* Traffic level bar */}
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${level.pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            className={cn("absolute inset-y-0 left-0 rounded-full", level.bg)}
          />
          {/* Segment markers */}
          <div className="absolute inset-0 flex">
            <div className="w-1/4 border-r border-background/50" />
            <div className="w-1/4 border-r border-background/50" />
            <div className="w-1/4 border-r border-background/50" />
            <div className="w-1/4" />
          </div>
        </div>
        <div className="flex justify-between mt-1 text-[8px] text-muted-foreground">
          <span>Low</span>
          <span>Moderate</span>
          <span>Heavy</span>
          <span>Severe</span>
        </div>
      </div>

      {/* LSTM Forecast Chart */}
      {isLstm && forecast && forecast.length > 0 && (
        <div className="border-t px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
            72-Hour Forecast
          </p>
          <Sparkline data={forecast} className={level.color} />
        </div>
      )}

      {/* Confidence badge */}
      <div className="border-t px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {isLstm ? "🧠 LSTM" : "🌲 Random Forest"} prediction
        </span>
        <span className="text-[10px] font-medium text-muted-foreground capitalize">
          Confidence: {traffic.confidence}
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Export                                                        */
/* ------------------------------------------------------------------ */

export function PredictionCards({ meta }: { meta: MessageMeta }) {
  const debug = meta?.debug;
  if (!debug?.mlResponse) return null;

  const res = debug.mlResponse as Record<string, unknown>;
  const details = res.details as Record<string, unknown> | undefined;
  const inputParams = (details?.input_params ?? debug.mlRequest) as Record<string, unknown> | undefined;

  // Extract weather data
  const weatherAvailable = inputParams?.weather_available !== false && inputParams?.temp_f != null;
  const weather: WeatherData = {
    temp_f: inputParams?.temp_f != null ? Number(inputParams.temp_f) : null,
    humidity_pct: inputParams?.humidity_pct != null ? Number(inputParams.humidity_pct) : null,
    wind_speed_mph: inputParams?.wind_speed_mph != null ? Number(inputParams.wind_speed_mph) : null,
    snow_depth_in: inputParams?.snow_depth_in != null ? Number(inputParams.snow_depth_in) : null,
    precip_1hr_in: inputParams?.precip_1hr_in != null ? Number(inputParams.precip_1hr_in) : null,
    weather_available: weatherAvailable,
  };

  // Extract traffic data
  const traffic: TrafficData = {
    prediction: Number(res.prediction ?? 0),
    confidence: String(res.confidence ?? ""),
    model: String(res.model ?? meta.model ?? ""),
    forecast_72h: (details?.forecast_72h as TrafficData["forecast_72h"]) ?? undefined,
  };

  // Only show if we have a valid prediction
  if (!traffic.prediction && traffic.prediction !== 0) return null;

  return (
    <div className="mt-3 w-full max-w-[85%] sm:max-w-[80%] grid gap-3 sm:grid-cols-2">
      <WeatherCard weather={weather} />
      <TrafficCard traffic={traffic} />
    </div>
  );
}
