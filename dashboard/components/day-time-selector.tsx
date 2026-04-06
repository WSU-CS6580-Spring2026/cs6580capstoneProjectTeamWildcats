"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface DayTimeSelectorProps {
  selectedDay: string;
  selectedHour: number;
  onDayChange: (day: string, dayLabel: string) => void;
  onHourChange: (hour: number) => void;
  loading?: boolean;
}

const HOURS = [
  { label: "6 AM", value: 6 },
  { label: "8 AM", value: 8 },
  { label: "9 AM", value: 9 },
  { label: "10 AM", value: 10 },
  { label: "12 PM", value: 12 },
  { label: "2 PM", value: 14 },
  { label: "4 PM", value: 16 },
  { label: "6 PM", value: 18 },
  { label: "8 PM", value: 20 },
];

function getUtahNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Denver" })
  );
}

export function DayTimeSelector({
  selectedDay,
  selectedHour,
  onDayChange,
  onHourChange,
  loading,
}: DayTimeSelectorProps) {
  const days = useMemo(() => {
    const now = getUtahNow();
    const result: { label: string; dayOfWeek: string; date: Date }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "long" });
      let label: string;
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      else label = d.toLocaleDateString("en-US", { weekday: "short" });
      result.push({ label, dayOfWeek, date: d });
    }
    return result;
  }, []);

  return (
    <div className="space-y-3">
      {/* Day selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {days.map((d) => (
          <button
            key={d.dayOfWeek + d.date.getDate()}
            onClick={() => onDayChange(d.dayOfWeek, d.label)}
            disabled={loading}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              "border border-white/10 backdrop-blur-sm",
              selectedDay === d.dayOfWeek
                ? "bg-white/20 text-white border-white/30 shadow-lg"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Time selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {HOURS.map((h) => (
          <button
            key={h.value}
            onClick={() => onHourChange(h.value)}
            disabled={loading}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
              "border border-white/10 backdrop-blur-sm",
              selectedHour === h.value
                ? "bg-white/20 text-white border-white/30 shadow-lg"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            )}
          >
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}
