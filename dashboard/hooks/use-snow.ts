"use client";

import { useState, useEffect } from "react";

const SNOW_STORAGE_KEY = "snowbase-snow-enabled";

export function useSnow() {
  const [snowEnabled, setSnowEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SNOW_STORAGE_KEY);
    if (stored !== null) {
      setSnowEnabled(stored === "true");
    }
  }, []);

  const toggleSnow = () => {
    const newValue = !snowEnabled;
    setSnowEnabled(newValue);
    localStorage.setItem(SNOW_STORAGE_KEY, String(newValue));
  };

  return {
    snowEnabled: mounted ? snowEnabled : true,
    toggleSnow,
    mounted,
  };
}
