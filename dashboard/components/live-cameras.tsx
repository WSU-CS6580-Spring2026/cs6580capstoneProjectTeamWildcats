"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ChevronLeft, ChevronRight, RefreshCw, Maximize2, Minimize2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrafficCamera } from "@/lib/udot";

export function LiveCameraButton({ isOpen, onToggle }: { isOpen?: boolean; onToggle?: (open: boolean) => void } = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen ?? internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); onToggle?.(v); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-red-300 transition-colors"
      >
        <Camera className="h-3 w-3" />
        <span className="hidden sm:inline">Road Cameras</span>
        <span className="sm:hidden">Cameras</span>
      </button>

      <AnimatePresence>
        {open && <LiveCameraModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function LiveCameraModal({ onClose }: { onClose: () => void }) {
  const [cameras, setCameras] = useState<TrafficCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadCameras();
    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      setImgKey(k => k + 1); // Force image reload
    }, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const loadCameras = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cameras");
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setImgKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const cam = cameras[selected];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} role="button" tabIndex={0} aria-label="Close camera viewer" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={cn(
          "relative z-10 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col",
          expanded ? "w-full h-full max-w-none max-h-none rounded-none" : "w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Camera className="h-4 w-4 text-white/70 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-white truncate">UDOT Traffic Cameras</span>
            <span className="text-[9px] sm:text-[10px] text-white/60 bg-white/5 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap hidden sm:inline">
              Snapshots • ~60s
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={handleRefresh}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Refresh" aria-label="Refresh camera">
              <RefreshCw className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50", refreshing && "animate-spin")} />
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors hidden sm:block" title={expanded ? "Shrink" : "Expand"} aria-label={expanded ? "Shrink" : "Expand"}>
              {expanded ? <Minimize2 className="h-4 w-4 text-white/50" /> : <Maximize2 className="h-4 w-4 text-white/50" />}
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Close" aria-label="Close camera viewer">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Camera className="h-8 w-8 text-white/50 animate-pulse" />
              <p className="text-sm text-white/60">Loading cameras...</p>
            </div>
          </div>
        ) : cameras.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Camera className="h-8 w-8 text-white/50" />
              <p className="text-sm text-white/50">No cameras found for this area</p>
              <p className="text-xs text-white/50">UDOT may not have cameras near Snowbasin currently</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row flex-1 min-h-0">
            {/* Camera list — sidebar */}
            <div className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto">
              <div className="flex lg:flex-col gap-1 p-2 lg:p-2 overflow-x-auto lg:overflow-x-hidden scrollbar-hide">
                {cameras.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(i)}
                    className={cn(
                      "shrink-0 flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-colors min-w-35 lg:min-w-0 lg:w-full",
                      selected === i ? "bg-blue-500/15 text-blue-300 border border-blue-500/20" : "text-white/60 hover:bg-white/5"
                    )}
                  >
                    <Camera className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{c.roadway}</p>
                      <p className="text-[10px] text-white/60 truncate">{c.direction} {c.location && `• ${c.location}`}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Camera view */}
            <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-3">
              {cam && (
                <>
                  {/* Image */}
                  <div className="relative flex-1 rounded-lg sm:rounded-xl overflow-hidden bg-black/50 min-h-40 sm:min-h-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`${cam.id}-${imgKey}`}
                      src={`/api/cameras/${btoa(cam.imageUrl)}?t=${imgKey}`}
                      alt={`${cam.roadway} ${cam.direction}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        // Fallback: try direct URL if proxy fails
                        if (!el.dataset.fallback) {
                          el.dataset.fallback = "1";
                          el.src = `${cam.imageUrl}?t=${imgKey}`;
                        }
                      }}
                    />

                    {/* UDOT badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                      <Camera className="h-3 w-3 text-white/70" />
                      <span className="text-[10px] font-medium text-white/80">UDOT</span>
                    </div>

                    {/* Nav arrows */}
                    {cameras.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelected(s => s > 0 ? s - 1 : cameras.length - 1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                          aria-label="Previous camera"
                        >
                          <ChevronLeft className="h-5 w-5 text-white" />
                        </button>
                        <button
                          onClick={() => setSelected(s => s < cameras.length - 1 ? s + 1 : 0)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                          aria-label="Next camera"
                        >
                          <ChevronRight className="h-5 w-5 text-white" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Camera info bar */}
                  <div className="flex items-center justify-between mt-1.5 sm:mt-2 px-1 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/60 shrink-0" />
                      <span className="text-[10px] sm:text-xs text-white/60 truncate">
                        {cam.roadway} {cam.direction} {cam.location && `— ${cam.location}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/50 shrink-0">
                      {selected + 1} / {cameras.length}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
