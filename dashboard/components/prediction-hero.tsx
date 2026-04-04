"use client";

import { useState, useMemo, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronUp,
  ChevronDown,
  Sun,
  Cloud,
  CloudSnow,
  CloudSun,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWeatherTheme,
  type WeatherCondition,
  type TrafficLevel,
} from "@/contexts/weather-theme";

/* ------------------------------------------------------------------ */
/*  Background gradients per condition                                 */
/* ------------------------------------------------------------------ */

const SCENE_GRADIENTS: Record<WeatherCondition, { light: string; dark: string }> = {
  snowy:    { light: "from-blue-200 via-blue-100 to-indigo-100", dark: "from-slate-800 via-blue-900 to-indigo-950" },
  rainy:    { light: "from-slate-300 via-gray-200 to-blue-100",  dark: "from-slate-900 via-gray-800 to-slate-800" },
  freezing: { light: "from-cyan-200 via-blue-100 to-indigo-100", dark: "from-slate-900 via-cyan-950 to-blue-950" },
  cold:     { light: "from-blue-100 via-sky-100 to-slate-100",   dark: "from-slate-800 via-blue-900 to-slate-900" },
  mild:     { light: "from-amber-100 via-orange-50 to-yellow-50", dark: "from-slate-800 via-amber-950 to-slate-900" },
  clear:    { light: "from-sky-200 via-blue-100 to-cyan-50",     dark: "from-slate-800 via-indigo-950 to-slate-900" },
  default:  { light: "from-muted to-muted",                       dark: "from-muted to-muted" },
};

const CONDITION_META: Record<WeatherCondition, { label: string; emoji: string; Icon: typeof Cloud }> = {
  snowy:    { label: "Snowy",    emoji: "🌨️", Icon: CloudSnow },
  rainy:    { label: "Rainy",    emoji: "🌧️", Icon: CloudRain },
  freezing: { label: "Freezing", emoji: "🥶", Icon: Snowflake },
  cold:     { label: "Cold",     emoji: "❄️",  Icon: Cloud },
  mild:     { label: "Mild",     emoji: "🌤️", Icon: CloudSun },
  clear:    { label: "Clear",    emoji: "☀️",  Icon: Sun },
  default:  { label: "",         emoji: "",    Icon: Cloud },
};

const TRAFFIC_META: Record<TrafficLevel, { label: string; color: string; barColor: string; textColor: string }> = {
  none:     { label: "",          color: "",              barColor: "",             textColor: "" },
  low:      { label: "Low",      color: "text-green-500", barColor: "bg-green-500", textColor: "text-green-600 dark:text-green-400" },
  moderate: { label: "Moderate", color: "text-yellow-500", barColor: "bg-yellow-500", textColor: "text-yellow-600 dark:text-yellow-400" },
  heavy:    { label: "Heavy",    color: "text-orange-500", barColor: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400" },
  severe:   { label: "Severe",   color: "text-red-500",    barColor: "bg-red-500",    textColor: "text-red-600 dark:text-red-400" },
};

/* ------------------------------------------------------------------ */
/*  Particles                                                          */
/* ------------------------------------------------------------------ */

interface Particle { id: number; x: number; size: number; opacity: number; duration: number; delay: number; drift: number }

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i, x: Math.random() * 100, size: Math.random() * 8 + 5,
    opacity: Math.random() * 0.5 + 0.25, duration: Math.random() * 8 + 6,
    delay: Math.random() * -12, drift: Math.random() * 30 - 15,
  }));
}

function SnowParticles() {
  const p = useMemo(() => makeParticles(25), []);
  return <>{p.map(f => (
    <div key={f.id} className="absolute top-0 animate-snowfall"
      style={{ left: `${f.x}%`, opacity: f.opacity, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, ["--drift" as string]: `${f.drift}px` }}>
      <span className="text-white/60 select-none" style={{ fontSize: f.size }}>❄</span>
    </div>
  ))}</>;
}

function RainParticles() {
  const p = useMemo(() => makeParticles(35), []);
  return <>{p.map(f => (
    <div key={f.id} className="absolute top-0 animate-rainfall"
      style={{ left: `${f.x}%`, opacity: f.opacity * 0.6, animationDuration: `${f.duration * 0.35}s`, animationDelay: `${f.delay}s` }}>
      <div className="w-px bg-blue-300/50 rounded-full" style={{ height: f.size * 2 }} />
    </div>
  ))}</>;
}

function SunGlow() {
  return (
    <div className="absolute -top-10 -right-10 w-40 h-40 animate-pulse-slow pointer-events-none">
      <div className="absolute inset-0 rounded-full bg-yellow-300/20 dark:bg-amber-400/10 blur-3xl" />
      <div className="absolute inset-6 rounded-full bg-orange-200/25 dark:bg-amber-500/10 blur-2xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline for 72h forecast                                         */
/* ------------------------------------------------------------------ */

function ForecastSparkline({ data }: { data: { hours_ahead: number; prediction: number }[] }) {
  const { points, fillPoints, maxVal, minVal } = useMemo(() => {
    const vals = data.map(d => d.prediction);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    const w = 300, h = 50, pad = 2;

    const pts = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (d.prediction - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    });
    return {
      points: pts.join(" "),
      fillPoints: `${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`,
      maxVal: max, minVal: min,
    };
  }, [data]);

  return (
    <div className="w-full">
      <svg viewBox="0 0 300 50" className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="heroSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#heroSparkFill)" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[9px] text-white/50 mt-0.5">
        <span>Now</span>
        <span>{Math.round(minVal)}–{Math.round(maxVal)} veh/hr</span>
        <span>+{data[data.length - 1].hours_ahead}h</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Traffic gauge arc                                                   */
/* ------------------------------------------------------------------ */

function TrafficGauge({ value, level }: { value: number; level: TrafficLevel }) {
  const meta = TRAFFIC_META[level];
  // Map value to 0-180 degrees for a semi-circle
  const maxVph = 500;
  const angle = Math.min((value / maxVph) * 180, 180);

  // SVG arc
  const r = 52;
  const cx = 60, cy = 58;
  const startX = cx - r, startY = cy;
  const endAngleRad = (Math.PI * (180 - angle)) / 180;
  const endX = cx + r * Math.cos(endAngleRad - Math.PI);
  const endY = cy - r * Math.sin(endAngleRad - Math.PI) * -1; // flip for SVG
  // Actually let me simplify - just use stroke-dasharray approach
  const circumference = Math.PI * r; // half circle
  const filled = (angle / 180) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-30 h-16.25">
        <svg viewBox="0 0 120 65" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 8 58 A 52 52 0 0 1 112 58"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-white/10"
          />
          {/* Filled arc */}
          <motion.path
            d="M 8 58 A 52 52 0 0 1 112 58"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={meta.color}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - filled }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
          <motion.span
            className="text-2xl font-bold text-white leading-none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {Math.round(value)}
          </motion.span>
          <span className="text-[9px] text-white/50 mt-0.5">veh/hr</span>
        </div>
      </div>
      <span className={cn("text-xs font-bold mt-1", meta.textColor)}>{meta.label} Traffic</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weather stat pill                                                   */
/* ------------------------------------------------------------------ */

function StatPill({ icon: Icon, label, value, color }: {
  icon: typeof Wind;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-sm px-2.5 py-1">
      <Icon className={cn("h-3 w-3", color)} />
      <span className="text-[10px] text-white/60">{label}</span>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Hero Panel                                                    */
/* ------------------------------------------------------------------ */

function PredictionHeroComponent({ snowEnabled, onToggleSnow }: { snowEnabled?: boolean; onToggleSnow?: () => void }) {
  const { theme } = useWeatherTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const { condition, trafficLevel, temp_f, humidity_pct, wind_speed_mph, snow_depth_in, precip_1hr_in, prediction, confidence, model, forecast_72h } = theme;
  const isActive = condition !== "default" || (prediction != null && prediction > 0);

  if (!isActive) return null;

  const condMeta = CONDITION_META[condition];
  const gradient = isDark ? SCENE_GRADIENTS[condition].dark : SCENE_GRADIENTS[condition].light;
  const hasWeather = condition !== "default" && temp_f != null;
  const isLstm = model?.toLowerCase().includes("lstm");
  const hasForecast = isLstm && forecast_72h && forecast_72h.length > 0;

  // Traffic trend
  const trend = hasForecast
    ? (() => {
        const f = forecast_72h!;
        const first = f.slice(0, 4).reduce((s, v) => s + v.prediction, 0) / 4;
        const last = f.slice(-4).reduce((s, v) => s + v.prediction, 0) / 4;
        if (last > first * 1.15) return "up";
        if (last < first * 0.85) return "down";
        return "stable";
      })()
    : "stable";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <AnimatePresence mode="wait">
      {collapsed ? (
        /* ---- Collapsed: thin summary bar ---- */
        <motion.button
          key="collapsed"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 40 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setCollapsed(false)}
          className="relative w-full shrink-0 isolate flex items-center gap-3 px-4 text-white overflow-hidden hover:brightness-110 transition-all border-b border-white/10"
        >
          <div className={cn("absolute inset-0 bg-linear-to-r", gradient)} />
          <ChevronDown className="relative z-10 h-4 w-4 text-white/60 shrink-0" />
          <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
            {hasWeather && (
              <span className="text-sm font-semibold">
                {condMeta.emoji} {Math.round(temp_f!)}°F {condMeta.label}
              </span>
            )}
            <span className="text-white/50">|</span>
            <span className={cn("text-sm font-semibold flex items-center gap-1", TRAFFIC_META[trafficLevel].color)}>
              <Car className="h-3.5 w-3.5" />
              {Math.round(prediction ?? 0)} veh/hr — {TRAFFIC_META[trafficLevel].label}
            </span>
            {confidence && (
              <>
                <span className="text-white/50">|</span>
                <span className="text-xs text-white/50 capitalize">{isLstm ? "📊 Deep" : "⚡ Quick"} • {confidence}</span>
              </>
            )}
          </div>
          {onToggleSnow && (
            <div
              className="relative z-10 rounded-full bg-white/10 hover:bg-white/20 p-1.5 transition-colors shrink-0"
              onClick={(e) => { e.stopPropagation(); onToggleSnow(); }}
              role="button"
              title={snowEnabled ? "Disable snow" : "Enable snow"}
            >
              <Snowflake className={cn("h-4 w-4", snowEnabled ? "text-blue-300" : "text-white/50")} />
            </div>
          )}
        </motion.button>
      ) : (
        /* ---- Expanded: full hero panel ---- */
        <motion.div
          key="expanded"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="relative w-full overflow-hidden shrink-0 isolate"
        >
          {/* Animated background */}
          <div className={cn("absolute inset-0 bg-linear-to-br", gradient)} />
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {(condition === "snowy" || condition === "freezing") && <SnowParticles />}
            {condition === "rainy" && <RainParticles />}
            {(condition === "mild" || condition === "clear") && <SunGlow />}
          </div>

          <div className="relative z-10 px-4 sm:px-6 py-4 sm:py-5">
            {/* Collapse button — top-left */}
            <button
              onClick={() => setCollapsed(true)}
              className="absolute top-2 left-3 z-20 rounded-full bg-white/10 hover:bg-white/20 p-1.5 transition-colors"
              title="Minimize"
            >
              <ChevronUp className="h-4 w-4 text-white/70" />
            </button>
            {/* Snow toggle — top-right, matching style */}
            {onToggleSnow && (
              <button
                onClick={onToggleSnow}
                className="absolute top-2 right-3 z-20 rounded-full bg-white/10 hover:bg-white/20 p-1.5 transition-colors"
                title={snowEnabled ? "Disable snow" : "Enable snow"}
              >
                <Snowflake className={cn("h-4 w-4", snowEnabled ? "text-blue-300" : "text-white/50")} />
              </button>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              {/* Left: Weather */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex items-center gap-4 flex-1 min-w-0"
              >
                {hasWeather ? (
                  <div className="flex items-center gap-3">
                    <condMeta.Icon className="h-12 w-12 sm:h-14 sm:w-14 text-white/80" strokeWidth={1.2} />
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="text-4xl sm:text-5xl font-bold text-white leading-none tracking-tight">
                          {Math.round(temp_f!)}°
                        </span>
                        <span className="text-lg text-white/60 mb-1">F</span>
                      </div>
                      <p className="text-sm text-white/70 font-medium mt-0.5">{condMeta.label}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Gauge className="h-10 w-10 text-white/60" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm text-white/70">Weather data unavailable</p>
                      <p className="text-xs text-white/60">No sensor data for this period</p>
                    </div>
                  </div>
                )}

                {hasWeather && (
                  <div className="hidden sm:flex flex-wrap gap-1.5 ml-2">
                    {humidity_pct != null && <StatPill icon={Droplets} label="Humidity" value={`${Math.round(humidity_pct)}%`} color="text-blue-300" />}
                    {wind_speed_mph != null && <StatPill icon={Wind} label="Wind" value={`${wind_speed_mph.toFixed(1)} mph`} color="text-teal-300" />}
                    {snow_depth_in != null && snow_depth_in > 0 && <StatPill icon={Snowflake} label="Snow" value={`${snow_depth_in.toFixed(1)}"`} color="text-cyan-200" />}
                    {precip_1hr_in != null && precip_1hr_in > 0 && <StatPill icon={CloudRain} label="Precip" value={`${precip_1hr_in.toFixed(2)}"`} color="text-indigo-300" />}
                  </div>
                )}
              </motion.div>

              <div className="hidden sm:block w-px h-20 bg-white/15" />

              {/* Right: Traffic */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center gap-4 sm:gap-6"
              >
                <TrafficGauge value={prediction ?? 0} level={trafficLevel} />

                <div className="flex flex-col items-start gap-1 min-w-35">
                  {hasForecast ? (
                    <div className="w-full text-white">
                      <p className="text-[9px] uppercase tracking-widest text-white/60 font-semibold mb-1">72-Hour Forecast</p>
                      <ForecastSparkline data={forecast_72h!} />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <TrendIcon className={cn("h-4 w-4", trend === "up" ? "text-red-400" : trend === "down" ? "text-green-400" : "text-white/50")} />
                        <span className="text-xs text-white/60">
                          {trend === "up" ? "Increasing" : trend === "down" ? "Decreasing" : "Stable"}
                        </span>
                      </div>
                      {confidence && (
                        <span className="text-[10px] text-white/60 capitalize">Confidence: {confidence}</span>
                      )}
                    </>
                  )}
                  <span className="text-[10px] text-white/50 mt-0.5">
                    {isLstm ? "📊 Deep Analysis" : "⚡ Quick Forecast"}
                  </span>
                </div>
              </motion.div>
            </div>

            {hasWeather && (
              <div className="flex sm:hidden flex-wrap gap-1.5 mt-3 justify-center">
                {humidity_pct != null && <StatPill icon={Droplets} label="Humidity" value={`${Math.round(humidity_pct)}%`} color="text-blue-300" />}
                {wind_speed_mph != null && <StatPill icon={Wind} label="Wind" value={`${wind_speed_mph.toFixed(1)} mph`} color="text-teal-300" />}
                {snow_depth_in != null && snow_depth_in > 0 && <StatPill icon={Snowflake} label="Snow" value={`${snow_depth_in.toFixed(1)}"`} color="text-cyan-200" />}
                {precip_1hr_in != null && precip_1hr_in > 0 && <StatPill icon={CloudRain} label="Precip" value={`${precip_1hr_in.toFixed(2)}"`} color="text-indigo-300" />}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const PredictionHero = memo(PredictionHeroComponent);
