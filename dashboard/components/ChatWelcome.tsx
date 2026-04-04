"use client";

import { Mountain, AlertTriangle, Thermometer, Brain, TreePine, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelType } from "@/components/chat-input";
import { useSpaceStatus } from "@/hooks/use-space-status";

interface ChatWelcomeProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  isGuest?: boolean;
  onSend?: (message: string) => void;
}

const QUICK_PROMPTS = [
  { icon: "🚗", label: "Traffic today 8am", message: "How busy is traffic to Snowbasin today at 8am?" },
  { icon: "📅", label: "Saturday 9am", message: "How busy is traffic to Snowbasin this Saturday at 9am?" },
  { icon: "🏔️", label: "SR-167 conditions", message: "What are the current road conditions on SR-167 Trappers Loop to Snowbasin?" },
  { icon: "🚌", label: "UTA transit", message: "What UTA bus and transit options are there to get to Snowbasin?" },
  { icon: "🗺️", label: "Directions", message: "How do I get to Snowbasin Resort from Ogden?" },
  { icon: "⚠️", label: "Road closures", message: "Are there any road closures or traction laws on SR-39 or SR-167 right now?" },
];

function ModelStatusBadge({ modelKey }: { modelKey: "lstm" }) {
  const { status, models } = useSpaceStatus();

  if (status === "unknown") {
    return (
      <div className="mt-2 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Checking...</span>
      </div>
    );
  }

  if (status === "warming") {
    return (
      <div className="mt-2 flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Starting up...</span>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="mt-2 flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">Offline</span>
      </div>
    );
  }

  // Online — check individual model
  const modelReady = models?.[modelKey] ?? false;
  return (
    <div className="mt-2 flex items-center gap-1">
      <div className={cn("h-2 w-2 rounded-full", modelReady ? "bg-green-500" : "bg-red-500")} />
      <span className={cn("text-xs font-medium", modelReady ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
        {modelReady ? "Ready" : "Failed to load"}
      </span>
    </div>
  );
}

export function ChatWelcome({ selectedModel, onModelChange, isGuest, onSend }: ChatWelcomeProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Snowbasin Traffic Assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          ML-powered traffic predictions · Live UDOT road conditions · UTA service alerts
        </p>
        {isGuest && (
          <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              👤 Guest Mode — chats are not saved
            </span>
          </div>
        )}
      </div>

      {/* Model Info */}
      <div className="rounded-xl border border-green-500/30 bg-green-50 dark:bg-green-950/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-base bg-green-500 text-white">
            📊
          </div>
          <div>
            <p className="text-xs font-semibold">LSTM Neural Network</p>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Uses real 48-hour traffic sequences to predict the next 72 hours of traffic patterns.
        </p>
        <ModelStatusBadge modelKey="lstm" />
      </div>

      {/* Capability Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <TreePine className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold">Traffic Prediction</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Real historical data from Trappers Loop sensors (2015-2024). Just provide day and time.
          </p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Try:</p>
            <p className="text-xs text-muted-foreground italic">"How busy Saturday at 8am?"</p>
            <p className="text-xs text-muted-foreground italic">"Traffic tomorrow morning"</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Mountain className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold">Road Conditions</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Live UDOT data: passes, closures, plows, traction laws.
          </p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Try:</p>
            <p className="text-xs text-muted-foreground italic">"SR-167 conditions to Snowbasin?"</p>
            <p className="text-xs text-muted-foreground italic">"Any closures on I-80?"</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
              <Thermometer className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold">Weather & Transit</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            UDOT weather stations along I-15/I-80. UTA service alerts for bus detours.
          </p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Try:</p>
            <p className="text-xs text-muted-foreground italic">"Surface temp at Parley's Summit"</p>
            <p className="text-xs text-muted-foreground italic">"UTA service alerts"</p>
          </div>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      {onSend && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1 font-medium">Quick questions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onSend(p.message)}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted hover:border-primary/40 transition-colors"
              >
                <span>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prediction parameters info */}
      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold">How It Works</p>
            <p className="text-xs text-muted-foreground">
              Just tell me a <span className="font-medium text-foreground">day and time</span> — the 📊 LSTM model will use real historical weather and traffic data from Trappers Loop sensors automatically.
            </p>
            <p className="text-xs text-muted-foreground italic mt-1">
              "How busy is traffic to Snowbasin this Saturday at 9am?"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
