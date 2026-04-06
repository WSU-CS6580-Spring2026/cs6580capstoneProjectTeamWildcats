"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Message, MessageMeta } from "@/components/chat-messages";
const ChatMessages = dynamic(() => import("@/components/chat-messages").then(m => m.ChatMessages), { ssr: false });
import { ChatInput, type ModelType } from "@/components/chat-input";
import { Snowflake, LogIn, Droplets, Wind, CloudRain, CloudSnow, Sun, Cloud, CloudSun, Gauge, Loader2, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { SnowAnimation } from "@/components/snow-animation";
import { OfflineBanner } from "@/components/offline-banner";
import {
  WeatherThemeProvider,
  useWeatherTheme,
  type WeatherCondition,
  type TrafficLevel,
} from "@/contexts/weather-theme";
import { useGeolocation, mentionsUserLocation } from "@/hooks/use-geolocation";
import { Button } from "@/components/ui/button";
import { DayTimeSelector } from "@/components/day-time-selector";
import { RoadConditionsCard } from "@/components/road-conditions-card";
import { TransitAlertsCard } from "@/components/transit-alerts-card";
import { BottomSheet } from "@/components/bottom-sheet";
import { LiveCameraButton } from "@/components/live-cameras";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type TimeOfDay = "night" | "dawn" | "morning" | "noon" | "afternoon" | "evening" | "dusk";

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 22 || hour < 5) return "night";
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 10) return "morning";
  if (hour >= 10 && hour < 14) return "noon";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "dusk"; // 20-22
}

const TIME_GRADIENTS: Record<TimeOfDay, string> = {
  night:     "from-slate-950 via-indigo-950 to-slate-900",
  dawn:      "from-indigo-900 via-purple-900 to-orange-950",
  morning:   "from-blue-800 via-sky-800 to-indigo-900",
  noon:      "from-sky-700 via-blue-700 to-indigo-800",
  afternoon: "from-blue-800 via-indigo-800 to-slate-800",
  evening:   "from-orange-900 via-red-950 to-indigo-950",
  dusk:      "from-indigo-950 via-purple-950 to-slate-900",
};

// Weather overrides the base time gradient for strong conditions
const WEATHER_GRADIENTS: Partial<Record<WeatherCondition, string>> = {
  snowy:    "from-slate-800 via-blue-900 to-indigo-950",
  rainy:    "from-slate-900 via-gray-800 to-slate-800",
  freezing: "from-slate-900 via-cyan-950 to-blue-950",
};

function getGradient(condition: WeatherCondition, hour: number): string {
  // Strong weather overrides time-of-day
  if (WEATHER_GRADIENTS[condition]) return WEATHER_GRADIENTS[condition]!;
  // Otherwise use time-based gradient
  return TIME_GRADIENTS[getTimeOfDay(hour)];
}

const CONDITION_META: Record<WeatherCondition, { label: string; Icon: typeof Cloud }> = {
  snowy: { label: "Snowy", Icon: CloudSnow },
  rainy: { label: "Rainy", Icon: CloudRain },
  freezing: { label: "Freezing", Icon: Snowflake },
  cold: { label: "Cold", Icon: Cloud },
  mild: { label: "Mild", Icon: CloudSun },
  clear: { label: "Clear", Icon: Sun },
  default: { label: "Loading...", Icon: Cloud },
};

const TRAFFIC_META: Record<TrafficLevel, { label: string; color: string }> = {
  none: { label: "", color: "" },
  low: { label: "Low Traffic", color: "text-green-400" },
  moderate: { label: "Moderate Traffic", color: "text-yellow-400" },
  heavy: { label: "Heavy Traffic", color: "text-orange-400" },
  severe: { label: "Severe Traffic", color: "text-red-400" },
};

/* ------------------------------------------------------------------ */
/*  Glass styles that adapt to time-of-day                             */
/* ------------------------------------------------------------------ */

const GLASS_STYLES: Record<TimeOfDay, { card: string; cardBorder: string; sheet: string }> = {
  night:     { card: "bg-slate-800/50",    cardBorder: "border-white/10",        sheet: "bg-slate-900/90" },
  dawn:      { card: "bg-indigo-900/40",   cardBorder: "border-purple-300/10",   sheet: "bg-indigo-950/90" },
  morning:   { card: "bg-sky-800/40",      cardBorder: "border-sky-300/10",      sheet: "bg-sky-950/90" },
  noon:      { card: "bg-blue-700/30",     cardBorder: "border-blue-200/10",     sheet: "bg-blue-950/90" },
  afternoon: { card: "bg-indigo-800/40",   cardBorder: "border-indigo-300/10",   sheet: "bg-indigo-950/90" },
  evening:   { card: "bg-orange-950/40",   cardBorder: "border-orange-300/8",    sheet: "bg-slate-950/90" },
  dusk:      { card: "bg-indigo-950/45",   cardBorder: "border-purple-300/8",    sheet: "bg-slate-950/90" },
};

function getGlassStyle(hour: number) {
  return GLASS_STYLES[getTimeOfDay(hour)];
}

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
  const p = useMemo(() => makeParticles(30), []);
  return <>{p.map(f => (
    <div key={f.id} className="absolute top-0 animate-snowfall"
      style={{ left: `${f.x}%`, opacity: f.opacity, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, ["--drift" as string]: `${f.drift}px` }}>
      <span className="text-white/60 select-none" style={{ fontSize: f.size }}>❄</span>
    </div>
  ))}</>;
}

function RainParticles() {
  const p = useMemo(() => makeParticles(40), []);
  return <>{p.map(f => (
    <div key={f.id} className="absolute top-0 animate-rainfall"
      style={{ left: `${f.x}%`, opacity: f.opacity * 0.6, animationDuration: `${f.duration * 0.35}s`, animationDelay: `${f.delay}s` }}>
      <div className="w-px bg-blue-300/50 rounded-full" style={{ height: f.size * 2 }} />
    </div>
  ))}</>;
}

function SunGlow() {
  return (
    <div className="absolute -top-10 -right-10 w-48 h-48 animate-pulse-slow pointer-events-none">
      <div className="absolute inset-0 rounded-full bg-yellow-300/20 blur-3xl" />
      <div className="absolute inset-6 rounded-full bg-orange-200/25 blur-2xl" />
    </div>
  );
}

function CloudDrift() {
  const clouds = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    id: i,
    y: 5 + Math.random() * 30,
    size: 40 + Math.random() * 60,
    opacity: 0.04 + Math.random() * 0.06,
    duration: 30 + Math.random() * 40,
    delay: -(Math.random() * 30),
  })), []);

  return <>{clouds.map(c => (
    <div key={c.id} className="absolute animate-drive pointer-events-none"
      style={{ top: `${c.y}%`, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}>
      <div className="rounded-full bg-white blur-2xl" style={{ width: c.size, height: c.size * 0.5, opacity: c.opacity }} />
    </div>
  ))}</>;
}

function StarTwinkle({ count = 20 }: { count?: number }) {
  const [stars, setStars] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number; brightness: number }[]>([]);
  useEffect(() => {
    setStars(Array.from({ length: count }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 50,
      size: 1 + Math.random() * 2.5, duration: 2 + Math.random() * 4, delay: Math.random() * 5,
      brightness: 0.15 + Math.random() * 0.35,
    })));
  }, [count]);

  if (stars.length === 0) return null;
  return <>{stars.map(s => (
    <div key={s.id} className="absolute rounded-full bg-white animate-pulse-slow pointer-events-none"
      style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.brightness,
        animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }} />
  ))}</>;
}

function MoonGlow() {
  return (
    <div className="absolute top-8 right-12 pointer-events-none">
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-blue-200/5 blur-2xl" />
        <div className="absolute -inset-3 rounded-full bg-blue-100/8 blur-xl" />
        <div className="w-12 h-12 rounded-full bg-linear-to-br from-gray-100/20 to-gray-300/10 shadow-lg shadow-blue-200/5" />
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gray-400/10" />
        <div className="absolute bottom-3 left-2 w-2 h-2 rounded-full bg-gray-400/8" />
      </div>
    </div>
  );
}

function SunriseGlow() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-32">
        <div className="absolute inset-0 rounded-t-full bg-orange-400/10 blur-3xl" />
        <div className="absolute inset-4 rounded-t-full bg-yellow-300/8 blur-2xl" />
        <div className="absolute inset-8 rounded-t-full bg-pink-300/6 blur-xl" />
      </div>
    </div>
  );
}

function EveningGlow() {
  return (
    <div className="absolute top-0 right-0 w-72 h-72 pointer-events-none">
      <div className="absolute inset-0 rounded-full bg-orange-500/8 blur-3xl" />
      <div className="absolute inset-8 rounded-full bg-red-400/6 blur-2xl" />
      <div className="absolute inset-16 rounded-full bg-pink-400/5 blur-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Traffic gauge                                                      */
/* ------------------------------------------------------------------ */

function TrafficGauge({ value, level }: { value: number; level: TrafficLevel }) {
  const meta = TRAFFIC_META[level];
  const maxVph = 500;
  const angle = Math.min((value / maxVph) * 180, 180);
  const r = 60;
  const circumference = Math.PI * r;
  const filled = (angle / 180) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-18.75">
        <svg viewBox="0 0 140 75" className="w-full h-full">
          <path d="M 10 68 A 60 60 0 0 1 130 68" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" className="text-white/10" />
          <motion.path d="M 10 68 A 60 60 0 0 1 130 68" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            className={meta.color || "text-white/50"}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - filled }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <motion.span className="text-3xl font-bold text-white leading-none"
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >{Math.round(value)}</motion.span>
          <span className="text-[10px] text-white/50 mt-0.5">vehicles/hr</span>
        </div>
      </div>
      {meta.label && <span className={cn("text-sm font-bold mt-1", meta.color)}>{meta.label}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated traffic road with cars                                    */
/* ------------------------------------------------------------------ */

interface CarData { id: number; lane: number; speed: number; delay: number; color: string; size: number }

const CAR_COLORS = ["#60a5fa", "#f87171", "#fbbf24", "#34d399", "#a78bfa", "#fb923c", "#e879f9", "#38bdf8"];

function TrafficRoad({ count, level }: { count: number; level: TrafficLevel }) {
  const [cars, setCars] = useState<CarData[]>([]);
  useEffect(() => {
    const numCars = count <= 0 ? 1 : count < 80 ? 3 : count < 180 ? 6 : count < 300 ? 9 : 14;
    const baseSpeed = level === "severe" ? 14 : level === "heavy" ? 9 : level === "moderate" ? 5 : 3;

    setCars(Array.from({ length: numCars }, (_, i): CarData => ({
      id: i,
      lane: i % 3,
      speed: baseSpeed + Math.random() * 3,
      delay: -(Math.random() * 12),
      color: CAR_COLORS[i % CAR_COLORS.length],
      size: 0.85 + Math.random() * 0.3,
    })));
  }, [count, level]);

  // Road surface color based on congestion
  const roadBg = level === "severe" ? "bg-red-950/40" : level === "heavy" ? "bg-orange-950/30" : "bg-white/3";

  return (
    <div className="mt-3 -mx-5 -mb-5">
      {/* Label */}
      <div className="flex items-center justify-between px-5 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-1.5 w-1.5 rounded-full", level === "severe" ? "bg-red-400 animate-pulse" : level === "heavy" ? "bg-orange-400" : level === "moderate" ? "bg-yellow-400" : "bg-green-400")} />
          <span className="text-[10px] text-white/60 uppercase tracking-widest font-semibold">Predicted Traffic</span>
        </div>
        <span className="text-[10px] text-white/50">~{count} veh/hr</span>
      </div>

      {/* Road */}
      <div className={cn("relative w-full h-14 overflow-hidden rounded-b-2xl", roadBg)}>
        {/* Road surface texture */}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/2 to-transparent" />

        {/* Lane dividers */}
        <div className="absolute inset-0 flex flex-col justify-around py-2.5">
          {[0, 1].map(i => (
            <div key={i} className="w-full h-px flex items-center overflow-hidden">
              <div className="flex gap-4 animate-lane-scroll">
                {Array.from({ length: 30 }, (_, j) => (
                  <div key={j} className="w-5 h-px bg-yellow-400/25 shrink-0 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Shoulder lines */}
        <div className="absolute top-1 left-0 right-0 h-px bg-white/8" />
        <div className="absolute bottom-1 left-0 right-0 h-px bg-white/8" />

        {/* Cars */}
        {cars.map((car) => {
          const topPos = car.lane === 0 ? "6%" : car.lane === 1 ? "36%" : "66%";
          return (
            <div key={car.id} className="absolute animate-drive"
              style={{ top: topPos, animationDuration: `${car.speed}s`, animationDelay: `${car.delay}s` }}>
              <svg width={22 * car.size} height={11 * car.size} viewBox="0 0 22 11" fill="none">
                {/* Shadow */}
                <ellipse cx="11" cy="10" rx="8" ry="1" fill="black" opacity="0.2" />
                {/* Body */}
                <rect x="1" y="3.5" width="19" height="5.5" rx="2" fill={car.color} opacity="0.85" />
                {/* Roof */}
                <rect x="5" y="1" width="9" height="4.5" rx="1.5" fill={car.color} opacity="0.65" />
                {/* Windshield */}
                <rect x="12" y="1.5" width="3" height="3" rx="0.5" fill="white" opacity="0.25" />
                {/* Side window */}
                <rect x="6" y="1.5" width="5" height="3" rx="0.5" fill="white" opacity="0.2" />
                {/* Headlights */}
                <circle cx="19.5" cy="6" r="0.8" fill="#fef08a" opacity="0.9" />
                <circle cx="19.5" cy="7.5" r="0.5" fill="#fef08a" opacity="0.6" />
                {/* Tail lights */}
                <rect x="0.5" y="4.5" width="1" height="1.5" rx="0.3" fill="#ef4444" opacity="0.8" />
                <rect x="0.5" y="7" width="1" height="1" rx="0.3" fill="#ef4444" opacity="0.6" />
              </svg>
            </div>
          );
        })}

        {/* Congestion overlay for severe */}
        {level === "severe" && (
          <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" style={{ animationDuration: "3s" }} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline                                                          */
/* ------------------------------------------------------------------ */

function ForecastSparkline({ data }: { data: { hours_ahead: number; prediction: number }[] }) {
  const { points, fillPoints, maxVal, minVal } = useMemo(() => {
    const vals = data.map(d => d.prediction);
    const max = Math.max(...vals); const min = Math.min(...vals);
    const range = max - min || 1; const w = 300, h = 60, pad = 2;
    const pts = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (d.prediction - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    });
    return { points: pts.join(" "), fillPoints: `${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`, maxVal: max, minVal: min };
  }, [data]);

  return (
    <div className="w-full">
      <svg viewBox="0 0 300 60" className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#gSparkFill)" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-white/50 mt-1">
        <span>Now</span>
        <span>{Math.round(minVal)}–{Math.round(maxVal)} veh/hr</span>
        <span>+{data[data.length - 1].hours_ahead}h</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat pill                                                          */
/* ------------------------------------------------------------------ */

function StatPill({ icon: Icon, value, color }: { icon: typeof Wind; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5">
      <Icon className={cn("h-3.5 w-3.5", color)} />
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

function getUtahTimeParams() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Denver" }));
  return {
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
    hour: now.getHours(),
  };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function GuestPage() {
  return (
    <WeatherThemeProvider>
      <GuestPageInner />
    </WeatherThemeProvider>
  );
}

function GuestPageInner() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("snowbasin-onboarding-dismissed")) setShowOnboarding(true);
  }, []);
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("snowbasin-onboarding-dismissed", "true");
  };
  const { position: userPosition, requestPosition } = useGeolocation();
  const { theme, updateFromPrediction } = useWeatherTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const selectedModel = "lstm" as const;
  const abortControllerRef = useRef<AbortController | null>(null);

  const utahNow = getUtahTimeParams();
  const [selectedDay, setSelectedDay] = useState(utahNow.dayOfWeek);
  const [selectedDayLabel, setSelectedDayLabel] = useState("Today");
  const [selectedHour, setSelectedHour] = useState(utahNow.hour);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const initialFetched = useRef(false);

  const fetchDashboardPrediction = useCallback(async (day: string, hour: number) => {
    setDashLoading(true); setDashError(null);
    try {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Denver" }));
      let targetDate = new Date(now);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      let diff = dayNames.indexOf(day) - now.getDay();
      if (diff < 0) diff += 7;
      targetDate.setDate(targetDate.getDate() + diff);

      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hour, day_of_week: day, month: targetDate.getMonth() + 1,
          is_weekend: dayNames.indexOf(day) === 0 || dayNames.indexOf(day) === 6,
          model: selectedModel,
        }),
      });
      if (!res.ok) { setDashError("Prediction service unavailable"); return; }
      const data = await res.json();
      updateFromPrediction(data, selectedModel);
    } catch { setDashError("Failed to connect"); }
    finally { setDashLoading(false); }
  }, [selectedModel, updateFromPrediction]);

  useEffect(() => {
    if (!initialFetched.current) {
      initialFetched.current = true;
      fetchDashboardPrediction(utahNow.dayOfWeek, utahNow.hour);
    }
  }, []);

  const handleDayChange = (day: string, label: string) => { setSelectedDay(day); setSelectedDayLabel(label); fetchDashboardPrediction(day, selectedHour); };
  const handleHourChange = (hour: number) => { setSelectedHour(hour); fetchDashboardPrediction(selectedDay, hour); };
  const handleSendMessage = async (content: string) => {
    if (isLoading) return;
    const wantsLocation = mentionsUserLocation(content);
    let coordinates = userPosition;
    if (wantsLocation && !coordinates) coordinates = await requestPosition();

    const userMessage: Message = { id: `temp-${Date.now()}`, role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true); setStreamingContent("");
    abortControllerRef.current = new AbortController();

    try {
      const body: Record<string, unknown> = {
        content, guest: true, model: selectedModel,
        previousMessages: messages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (wantsLocation && coordinates) body.userCoordinates = coordinates;

      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: abortControllerRef.current.signal,
      });
      if (!response.ok) throw new Error("Failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let fullContent = "";
      let responseMeta: MessageMeta | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.meta) responseMeta = parsed.meta;
            if (parsed.error && !fullContent) fullContent = parsed.error;
            if (parsed.content) { fullContent += parsed.content; setStreamingContent(fullContent); }
          } catch { /* ignore */ }
        }
      }

      if (fullContent) {
        setMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: "assistant", content: fullContent, meta: responseMeta }]);
      }
      if (responseMeta?.debug?.mlResponse) {
        updateFromPrediction(responseMeta.debug.mlResponse as Record<string, unknown>, responseMeta.model, responseMeta.debug.mlRequest as Record<string, unknown> | undefined);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    } finally {
      setIsLoading(false); setStreamingContent(""); abortControllerRef.current = null;
    }
  };

  const handleStop = () => abortControllerRef.current?.abort();
  const handleEditMessage = (messageId: string, newContent: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) { setMessages(messages.slice(0, idx)); handleSendMessage(newContent); }
  };

  const { condition, trafficLevel, temp_f, humidity_pct, wind_speed_mph, snow_depth_in, precip_1hr_in, prediction, confidence, model, forecast_72h } = theme;
  const condMeta = CONDITION_META[condition];
  const timeOfDay = getTimeOfDay(selectedHour);
  const gradient = getGradient(condition, selectedHour);
  const glass = getGlassStyle(selectedHour);
  const hasWeather = condition !== "default" && temp_f != null;
  const showSnow = condition === "snowy" || condition === "freezing";
  const isLstm = model?.toLowerCase().includes("lstm");
  const hasForecast = isLstm && forecast_72h && forecast_72h.length > 0;
  const trend = hasForecast
    ? (() => { const f = forecast_72h!; const first = f.slice(0, 4).reduce((s, v) => s + v.prediction, 0) / 4; const last = f.slice(-4).reduce((s, v) => s + v.prediction, 0) / 4; if (last > first * 1.15) return "up"; if (last < first * 0.85) return "down"; return "stable"; })()
    : "stable";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const hourLabel = selectedHour > 12 ? `${selectedHour - 12} PM` : selectedHour === 12 ? "12 PM" : `${selectedHour} AM`;

  return (
    <main id="main-content" className="relative min-h-dvh overflow-x-hidden">
      {/* Full-screen weather background */}
      <div className={cn("absolute inset-0 bg-linear-to-br transition-all duration-1000", gradient)} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Weather-based animations */}
        {(condition === "snowy" || condition === "freezing") && <SnowParticles />}
        {condition === "rainy" && <RainParticles />}
        {condition === "cold" && <CloudDrift />}

        {/* Time-of-day animations */}
        {(timeOfDay === "night" || timeOfDay === "dusk") && <StarTwinkle count={35} />}
        {(timeOfDay === "night" || timeOfDay === "dusk") && <MoonGlow />}
        {timeOfDay === "dawn" && <SunriseGlow />}
        {(timeOfDay === "morning" || timeOfDay === "noon") && condition !== "rainy" && condition !== "snowy" && <SunGlow />}
        {timeOfDay === "afternoon" && condition !== "rainy" && condition !== "snowy" && <CloudDrift />}
        {(timeOfDay === "evening") && <EveningGlow />}
        {(timeOfDay === "evening") && <StarTwinkle count={10} />}
      </div>

      <OfflineBanner />

      {/* Dashboard content */}
      <div className="relative z-10 h-full overflow-y-auto pb-20 scrollbar-hide">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-10 pt-4 sm:pt-8 pb-24 space-y-3 sm:space-y-5"
        >

          {/* Header -- full width */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex items-start justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                <Snowflake className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white">Snowbasin Traffic</h1>
                  <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">Guest</span>
                </div>
                <p className="text-xs text-white/50">
                  {selectedDayLabel} at {hourLabel}
                  {dashLoading && " — updating..."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <LiveCameraButton />
              <Link href="/login" aria-label="Sign In">
                <Button variant="ghost" size="sm" className="gap-1.5 text-white/70 hover:text-white hover:bg-white/10 h-8 px-3" aria-label="Sign In">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Sign In</span>
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Onboarding banner */}
          <AnimatePresence>
            {showOnboarding && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className={cn("rounded-2xl backdrop-blur-lg p-4 sm:p-5 border", glass.card, glass.cardBorder)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <h2 className="text-sm font-semibold text-white">Welcome to Snowbasin Traffic</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-white/70">
                      <div className="flex items-start gap-2">
                        <span className="text-white font-bold">1.</span>
                        <span>Pick a <strong className="text-white">day and time</strong> below to see predicted traffic on SR-167.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-white font-bold">2.</span>
                        <span>View live <strong className="text-white">road conditions</strong> and weather from UDOT sensors.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-white font-bold">3.</span>
                        <span>Tap the <strong className="text-white">chat bubble</strong> to ask follow-up questions.</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={dismissOnboarding} className="text-white/50 hover:text-white p-1 -mt-1 -mr-1 shrink-0" aria-label="Dismiss welcome message">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main grid: Weather left, Traffic right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">

            {/* LEFT -- Weather panel */}
            <AnimatePresence mode="wait">
              <motion.div key={condition + String(prediction)}
                initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
                className={cn("rounded-2xl backdrop-blur-lg p-6 flex flex-col justify-between", glass.card, `border ${glass.cardBorder}`)}
              >
                {hasWeather ? (
                  <div className="flex items-center gap-5">
                    <condMeta.Icon className="h-20 w-20 lg:h-24 lg:w-24 text-white/80 shrink-0" strokeWidth={1} />
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="text-7xl lg:text-8xl font-bold text-white leading-none tracking-tight">{Math.round(temp_f!)}°</span>
                        <span className="text-2xl text-white/50 mb-3">F</span>
                      </div>
                      <p className="text-lg text-white/70 font-medium mt-1">{condMeta.label}</p>
                    </div>
                  </div>
                ) : dashLoading ? (
                  <div className="flex items-center gap-5">
                    <Loader2 className="h-20 w-20 text-white/50 animate-spin shrink-0" />
                    <div>
                      <span className="text-5xl font-bold text-white/50">--°</span>
                      <p className="text-sm text-white/60 mt-1">Fetching prediction...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-5">
                    <Gauge className="h-20 w-20 text-white/60 shrink-0" strokeWidth={1} />
                    <div>
                      <p className="text-xl text-white/60">Weather data unavailable</p>
                      <p className="text-sm text-white/60 mt-1">No sensor data for this period</p>
                    </div>
                  </div>
                )}

                {hasWeather && (
                  <div className="flex flex-wrap gap-2 mt-5">
                    {humidity_pct != null && <StatPill icon={Droplets} value={`${Math.round(humidity_pct)}% humidity`} color="text-blue-300" />}
                    {wind_speed_mph != null && <StatPill icon={Wind} value={`${wind_speed_mph.toFixed(1)} mph wind`} color="text-teal-300" />}
                    {snow_depth_in != null && snow_depth_in > 0 && <StatPill icon={Snowflake} value={`${snow_depth_in.toFixed(1)}" snow`} color="text-cyan-200" />}
                    {precip_1hr_in != null && precip_1hr_in > 0 && <StatPill icon={CloudRain} value={`${precip_1hr_in.toFixed(2)}" precip`} color="text-indigo-300" />}
                  </div>
                )}

                {/* Day/Time selector inside weather panel */}
                <div className="mt-5 pt-4 border-t border-white/10">
                  <DayTimeSelector selectedDay={selectedDay} selectedHour={selectedHour}
                    onDayChange={handleDayChange} onHourChange={handleHourChange} loading={dashLoading} />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* RIGHT -- Traffic panel */}
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className={cn("rounded-2xl backdrop-blur-lg p-5 flex flex-col", glass.card, `border ${glass.cardBorder}`)}
            >
              <div className="flex flex-col sm:flex-row items-center gap-5 flex-1">
                <TrafficGauge value={prediction ?? 0} level={trafficLevel} />
                <div className="flex-1 space-y-3 w-full">
                  {/* Model + trend */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1">
                      <span className="text-xs">{isLstm ? "📊" : "⚡"}</span>
                      <span className="text-[11px] text-white/70 font-medium">{isLstm ? "📊 Deep Analysis" : "⚡ Quick Forecast"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
                      <TrendIcon className={cn("h-3.5 w-3.5", trend === "up" ? "text-red-400" : trend === "down" ? "text-green-400" : "text-white/60")} />
                      <span className="text-[11px] text-white/60">{trend === "up" ? "Increasing" : trend === "down" ? "Decreasing" : "Stable"}</span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/5 px-3 py-2.5">
                      <p className="text-[10px] text-white/60 uppercase tracking-wide">Prediction</p>
                      <p className="text-base font-semibold text-white">{Math.round(prediction ?? 0)} <span className="text-white/60 font-normal text-sm">veh/hr</span></p>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2.5">
                      <p className="text-[10px] text-white/60 uppercase tracking-wide">Confidence</p>
                      <p className="text-base font-semibold text-white capitalize">{confidence ?? "—"}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2.5">
                      <p className="text-[10px] text-white/60 uppercase tracking-wide">Day & Time</p>
                      <p className="text-base font-semibold text-white">{selectedDayLabel} {hourLabel}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2.5">
                      <p className="text-[10px] text-white/60 uppercase tracking-wide">Congestion</p>
                      <p className={cn("text-base font-semibold", TRAFFIC_META[trafficLevel].color || "text-white/60")}>
                        {TRAFFIC_META[trafficLevel].label || "None"}
                      </p>
                    </div>
                  </div>

                  {/* 72h forecast */}
                  {hasForecast && (
                    <div className="text-white">
                      <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-1">72-Hour Forecast</p>
                      <ForecastSparkline data={forecast_72h!} />
                    </div>
                  )}
                </div>
              </div>

              {/* Road */}
              <TrafficRoad count={prediction ?? 0} level={trafficLevel} />
              {dashError && <p className="text-xs text-red-400 mt-3">{dashError}</p>}
            </motion.div>
          </div>

          {/* Bottom row -- UDOT + UTA full width */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-5"
          >
            <RoadConditionsCard />
            <TransitAlertsCard />
          </motion.div>

          <p className="text-center text-xs text-white/50">
            <Link href="/signup" className="text-blue-400 hover:underline">Create an account</Link> to save chat history
          </p>

          <div className="h-8" />
        </motion.div>
      </div>

      {/* Bottom Sheet Chat */}
      <BottomSheet
        inputArea={
          <ChatInput onSend={handleSendMessage} onStop={handleStop} isLoading={isLoading}
            selectedModel="lstm" onModelChange={() => {}} />
        }
      >
        {messages.length > 0 || isLoading ? (
          <ChatMessages messages={messages} isLoading={isLoading} streamingContent={streamingContent}
            onEditMessage={handleEditMessage} onResendMessage={(c) => handleSendMessage(c)}
            onRetry={() => { const last = [...messages].reverse().find(m => m.role === "user"); if (last) handleSendMessage(last.content); }}
            onSuggest={handleSendMessage} />
        ) : (
          <div className="flex items-center justify-center h-32 text-sm text-white/60">
            Ask about traffic, weather, or plan your trip
          </div>
        )}
      </BottomSheet>

      {showSnow && <SnowAnimation />}
    </main>
  );
}
