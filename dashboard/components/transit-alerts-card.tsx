"use client";

import { useEffect, useState } from "react";
import { Bus, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import type { ServiceAlert } from "@/lib/uta";

export function TransitAlertsCard() {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/transit-alerts");
        if (res.ok && mounted) setAlerts(await res.json());
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-slate-800/60 backdrop-blur-lg border border-white/10 p-4">
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading transit alerts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-800/60 backdrop-blur-lg border border-white/10 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
        <Bus className="h-4 w-4 text-blue-400" />
        UTA Transit Alerts
      </h3>

      {alerts.length === 0 ? (
        <p className="text-xs text-white/50 flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
          No active service alerts
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                alert.severity === "WARNING" ? "text-amber-400" : "text-blue-400"
              }`} />
              <div className="min-w-0">
                <span className="text-white/80 font-medium">{alert.header}</span>
                {alert.description && (
                  <p className="text-white/50 line-clamp-2 mt-0.5">{alert.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-white/30">Source: UTA GTFS-Realtime</p>
    </div>
  );
}
