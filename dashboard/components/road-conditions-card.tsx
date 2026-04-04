"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Construction, Loader2 } from "lucide-react";
import type { SkiCanyonData } from "@/lib/udot";

export function RoadConditionsCard() {
  const [data, setData] = useState<SkiCanyonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/road-conditions");
        if (res.ok && mounted) setData(await res.json());
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 300_000); // refresh every 5 min
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-slate-800/60 backdrop-blur-lg border border-white/10 p-4">
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading road conditions...</span>
        </div>
      </div>
    );
  }

  const hasData = data && (data.passes.length > 0 || data.conditions.length > 0 || data.alerts.length > 0);

  return (
    <div className="rounded-2xl bg-slate-800/60 backdrop-blur-lg border border-white/10 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
        <Construction className="h-4 w-4 text-orange-400" />
        UDOT Road Conditions
      </h3>

      {!hasData ? (
        <p className="text-xs text-white/50 flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
          No active road alerts — conditions normal
        </p>
      ) : (
        <div className="space-y-2">
          {/* Mountain passes */}
          {data!.passes.slice(0, 3).map((pass, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                pass.roadStatus?.toLowerCase().includes("open") ? "bg-green-400" :
                pass.roadStatus?.toLowerCase().includes("closed") ? "bg-red-400" : "bg-yellow-400"
              }`} />
              <div className="min-w-0">
                <span className="text-white/80 font-medium">{pass.name}</span>
                <span className="text-white/50 ml-1.5">
                  {pass.roadStatus}
                  {pass.travelRestriction && ` — ${pass.travelRestriction}`}
                </span>
              </div>
            </div>
          ))}

          {/* Active alerts */}
          {data!.alerts.slice(0, 2).map((alert, i) => (
            <div key={`a${i}`} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-white/60">{alert.description}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-white/50">Source: UDOT Real-Time API</p>
    </div>
  );
}
