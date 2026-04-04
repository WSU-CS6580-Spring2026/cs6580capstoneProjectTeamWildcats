"use client";
import { useState, useEffect, useCallback } from "react";

export type SpaceStatus = "online" | "warming" | "offline" | "unknown";

interface SpaceHealth {
  status: SpaceStatus;
  models: {
    lstm: boolean;
  } | null;
  training_data: boolean | null;
}

export function useSpaceStatus() {
  const [health, setHealth] = useState<SpaceHealth>({
    status: "unknown",
    models: null,
    training_data: null,
  });

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/warmup", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        setHealth({
          status: "online",
          models: data.models || null,
          training_data: data.training_data ?? null,
        });
      } else if (res.status === 503) {
        setHealth({ status: "warming", models: null, training_data: null });
      } else {
        setHealth({ status: "offline", models: null, training_data: null });
      }
    } catch {
      setHealth({ status: "offline", models: null, training_data: null });
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [check]);

  return {
    status: health.status,
    models: health.models,
    trainingData: health.training_data,
    refresh: check,
  };
}
