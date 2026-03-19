"use client";

import { useEffect, useMemo, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeatherTheme, type WeatherCondition, type TrafficLevel } from "@/contexts/weather-theme";

/* ------------------------------------------------------------------ */
/*  Config maps                                                        */
/* ------------------------------------------------------------------ */

const GRADIENTS: Record<WeatherCondition, { light: string; dark: string }> = {
  snowy: {
    light: "from-blue-100 via-blue-50 to-white",
    dark: "from-slate-900 via-blue-950 to-slate-950",
  },
  rainy: {
    light: "from-slate-200 via-gray-100 to-blue-50",
    dark: "from-slate-950 via-gray-900 to-slate-900",
  },
  freezing: {
    light: "from-cyan-100 via-blue-50 to-indigo-50",
    dark: "from-slate-950 via-cyan-950 to-blue-950",
  },
  cold: {
    light: "from-blue-50 via-sky-50 to-slate-50",
    dark: "from-slate-950 via-blue-950 to-slate-900",
  },
  mild: {
    light: "from-amber-50 via-orange-50 to-yellow-50",
    dark: "from-slate-900 via-amber-950 to-slate-950",
  },
  clear: {
    light: "from-sky-100 via-blue-50 to-cyan-50",
    dark: "from-slate-900 via-indigo-950 to-slate-950",
  },
  default: {
    light: "from-background to-background",
    dark: "from-background to-background",
  },
};

const TRAFFIC_GLOW: Record<TrafficLevel, string> = {
  none: "",
  low: "shadow-[inset_0_0_120px_rgba(34,197,94,0.06)]",
  moderate: "shadow-[inset_0_0_120px_rgba(234,179,8,0.08)]",
  heavy: "shadow-[inset_0_0_120px_rgba(249,115,22,0.1)]",
  severe: "shadow-[inset_0_0_120px_rgba(239,68,68,0.12)]",
};

/* ------------------------------------------------------------------ */
/*  Snowflakes                                                         */
/* ------------------------------------------------------------------ */

interface Particle {
  id: number;
  x: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 10 + 6,
    opacity: Math.random() * 0.5 + 0.3,
    duration: Math.random() * 10 + 8,
    delay: Math.random() * -15,
    drift: Math.random() * 40 - 20,
  }));
}

/* ---- Snow ---- */
function SnowParticles() {
  const particles = useMemo(() => generateParticles(40), []);
  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 animate-snowfall"
          style={{
            left: `${p.x}%`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        >
          <span
            className="text-blue-300/70 dark:text-white/60 select-none"
            style={{ fontSize: p.size }}
          >
            ❄
          </span>
        </div>
      ))}
    </>
  );
}

/* ---- Rain ---- */
function RainParticles() {
  const particles = useMemo(() => generateParticles(60), []);
  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 animate-rainfall"
          style={{
            left: `${p.x}%`,
            opacity: p.opacity * 0.7,
            animationDuration: `${p.duration * 0.4}s`,
            animationDelay: `${p.delay}s`,
          }}
        >
          <div
            className="w-[1.5px] bg-blue-400/50 dark:bg-blue-300/40 rounded-full"
            style={{ height: p.size * 2.5 }}
          />
        </div>
      ))}
    </>
  );
}

/* ---- Sun rays ---- */
function SunRays() {
  return (
    <div className="absolute -top-20 -right-20 w-80 h-80 animate-pulse-slow">
      <div className="absolute inset-0 rounded-full bg-yellow-300/10 dark:bg-amber-400/5 blur-3xl" />
      <div className="absolute inset-8 rounded-full bg-orange-200/15 dark:bg-amber-500/5 blur-2xl" />
      <div className="absolute inset-16 rounded-full bg-yellow-100/20 dark:bg-yellow-400/5 blur-xl" />
    </div>
  );
}

/* ---- Frost overlay ---- */
function FrostOverlay() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/30 dark:from-cyan-200/5 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/20 dark:from-blue-200/5 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/20 dark:from-cyan-200/5 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white/20 dark:from-cyan-200/5 to-transparent pointer-events-none" />
    </>
  );
}

/* ---- Cloud layer ---- */
function CloudLayer() {
  return (
    <div className="absolute inset-x-0 top-0 h-48 overflow-hidden opacity-30 dark:opacity-15">
      <div className="absolute top-4 left-[10%] w-48 h-16 bg-gray-300 dark:bg-gray-600 rounded-full blur-2xl animate-cloud-drift" />
      <div className="absolute top-12 left-[40%] w-64 h-20 bg-gray-200 dark:bg-gray-700 rounded-full blur-3xl animate-cloud-drift-slow" />
      <div className="absolute top-6 left-[70%] w-40 h-14 bg-gray-300 dark:bg-gray-600 rounded-full blur-2xl animate-cloud-drift" style={{ animationDelay: "-8s" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Traffic pulse ring                                                 */
/* ------------------------------------------------------------------ */

function TrafficPulse({ level }: { level: TrafficLevel }) {
  if (level === "none" || level === "low") return null;

  const colors: Record<string, string> = {
    moderate: "border-yellow-400/20",
    heavy: "border-orange-400/25",
    severe: "border-red-500/30",
  };

  return (
    <div className="absolute bottom-4 right-4 pointer-events-none">
      <div className={`w-3 h-3 rounded-full ${level === "moderate" ? "bg-yellow-400" : level === "heavy" ? "bg-orange-400" : "bg-red-500"} animate-pulse`} />
      <div className={`absolute inset-0 w-3 h-3 rounded-full border-2 ${colors[level]} animate-ping`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Condition label                                                    */
/* ------------------------------------------------------------------ */

function ConditionLabel({ condition, temp, prediction, trafficLevel }: {
  condition: WeatherCondition;
  temp: number | null;
  prediction: number | null;
  trafficLevel: TrafficLevel;
}) {
  if (condition === "default") return null;

  const condLabels: Record<WeatherCondition, string> = {
    snowy: "🌨️ Snowy",
    rainy: "🌧️ Rainy",
    freezing: "🥶 Freezing",
    cold: "❄️ Cold",
    mild: "🌤️ Mild",
    clear: "☀️ Clear",
    default: "",
  };

  const trafficLabels: Record<TrafficLevel, { text: string; color: string }> = {
    none: { text: "", color: "" },
    low: { text: "Low Traffic", color: "text-green-600 dark:text-green-400" },
    moderate: { text: "Moderate Traffic", color: "text-yellow-600 dark:text-yellow-400" },
    heavy: { text: "Heavy Traffic", color: "text-orange-600 dark:text-orange-400" },
    severe: { text: "Severe Traffic", color: "text-red-600 dark:text-red-400" },
  };

  const tl = trafficLabels[trafficLevel];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-3 right-14 z-30 flex items-center gap-2 rounded-full bg-background/70 dark:bg-background/60 backdrop-blur-md border px-3 py-1.5 shadow-sm"
    >
      <span className="text-xs font-medium">{condLabels[condition]}</span>
      {temp != null && <span className="text-xs text-muted-foreground">{Math.round(temp)}°F</span>}
      {tl.text && (
        <>
          <span className="text-muted-foreground/40">•</span>
          <span className={`text-xs font-medium ${tl.color}`}>{tl.text}</span>
        </>
      )}
      {prediction != null && prediction > 0 && (
        <span className="text-[10px] text-muted-foreground">{Math.round(prediction)} veh/hr</span>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Background Component                                          */
/* ------------------------------------------------------------------ */

function WeatherBackgroundComponent() {
  const { theme } = useWeatherTheme();
  const { condition, trafficLevel, temp_f, prediction } = theme;
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const gradient = isDark ? GRADIENTS[condition].dark : GRADIENTS[condition].light;
  const glow = TRAFFIC_GLOW[trafficLevel];
  const isActive = condition !== "default";

  return (
    <>
      {/* Full-screen gradient background */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key={condition}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className={`fixed inset-0 z-0 bg-gradient-to-br ${gradient} ${glow}`}
            aria-hidden="true"
          >
            {/* Particle effects based on condition */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {(condition === "snowy" || condition === "freezing") && <SnowParticles />}
              {condition === "rainy" && <RainParticles />}
              {(condition === "mild" || condition === "clear") && <SunRays />}
              {(condition === "freezing" || condition === "snowy") && <FrostOverlay />}
              {(condition === "rainy" || condition === "cold") && <CloudLayer />}
            </div>

            {/* Traffic pulse indicator */}
            <TrafficPulse level={trafficLevel} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Condition label badge */}
      <AnimatePresence>
        {isActive && (
          <ConditionLabel
            condition={condition}
            temp={temp_f}
            prediction={prediction}
            trafficLevel={trafficLevel}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export const WeatherBackground = memo(WeatherBackgroundComponent);
