"use client";

import { useState, useCallback, useRef } from "react";
import { MessageSquare, X, Clock, Plus, Trash2, ChevronUp } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Chat } from "@/lib/db/schema";

interface BottomSheetProps {
  children: React.ReactNode;
  inputArea: React.ReactNode;
  chats?: Chat[];
  currentChatId?: string | null;
  onSelectChat?: (chatId: string | null) => void;
  onDeleteChat?: (chatId: string) => void;
  onOpen?: () => void;
}

type SheetTab = "chat" | "history";

// Snap points as percentage from bottom (0 = full screen, 100 = closed)
const SNAP_CLOSED = 100;
const SNAP_HALF = 45;   // 55% of screen
const SNAP_FULL = 2;    // nearly full screen (2% top padding)

function getClosestSnap(pct: number): number {
  const snaps = [SNAP_FULL, SNAP_HALF, SNAP_CLOSED];
  let closest = snaps[0];
  let minDist = Math.abs(pct - snaps[0]);
  for (const s of snaps) {
    const d = Math.abs(pct - s);
    if (d < minDist) { minDist = d; closest = s; }
  }
  return closest;
}

export function BottomSheet({ children, inputArea, chats, currentChatId, onSelectChat, onDeleteChat, onOpen: onOpenProp }: BottomSheetProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SheetTab>("chat");
  const [currentSnap, setCurrentSnap] = useState(SNAP_HALF);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartPct = useRef(SNAP_HALF);

  // Motion value: percentage from top (0% = full, 100% = closed)
  const sheetY = useMotionValue(SNAP_CLOSED);
  const sheetHeight = useTransform(sheetY, (v) => `${100 - v}vh`);
  const backdropOpacity = useTransform(sheetY, [SNAP_CLOSED, SNAP_HALF, SNAP_FULL], [0, 0.3, 0.5]);

  const animateTo = useCallback((snap: number) => {
    animate(sheetY, snap, { type: "spring", damping: 30, stiffness: 300 });
    setCurrentSnap(snap);
    if (snap === SNAP_CLOSED) {
      setTimeout(() => setOpen(false), 300);
    }
  }, [sheetY]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    onOpenProp?.();
    sheetY.set(SNAP_CLOSED);
    requestAnimationFrame(() => animateTo(SNAP_HALF));
  }, [sheetY, animateTo]);

  const handleClose = useCallback(() => {
    animateTo(SNAP_CLOSED);
  }, [animateTo]);

  // Drag via handle
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartPct.current = sheetY.get();

    const handleMove = (ev: PointerEvent) => {
      const dy = ev.clientY - dragStartY.current;
      const vh = window.innerHeight;
      const deltaPct = (dy / vh) * 100;
      const newPct = Math.max(SNAP_FULL - 5, Math.min(SNAP_CLOSED + 5, dragStartPct.current + deltaPct));
      sheetY.set(newPct);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      const current = sheetY.get();
      const snap = getClosestSnap(current);
      animateTo(snap);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [sheetY, animateTo]);

  // Double-tap handle to toggle between half and full
  const lastTap = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      animateTo(currentSnap === SNAP_FULL ? SNAP_HALF : SNAP_FULL);
    }
    lastTap.current = now;
  }, [currentSnap, animateTo]);

  const isFullScreen = currentSnap === SNAP_FULL;

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-white hover:bg-white/90 shadow-xl shadow-black/30 ring-2 ring-white/20 flex items-center justify-center hover:scale-105 active:scale-95"
            aria-label="Open chat"
          >
            <MessageSquare className="h-6 w-6 text-blue-600" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sheet + Backdrop */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 bg-black z-40"
              style={{ opacity: backdropOpacity }}
              onClick={handleClose}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              ref={sheetRef}
              className={cn(
                "dark fixed bottom-0 left-0 right-0 z-50 flex flex-col overflow-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.4)]",
                isFullScreen ? "rounded-none" : "rounded-t-3xl"
              )}
              style={{ height: sheetHeight }}
            >
              {/* Frosted glass background */}
              <div className="absolute inset-0 bg-white/10 backdrop-blur-2xl" />
              <div className="absolute inset-0 bg-linear-to-b from-white/8 to-transparent" />
              {!isFullScreen && <div className="absolute inset-x-0 top-0 h-px bg-white/20" />}

              {/* Content wrapper */}
              <div className="relative z-10 flex flex-col h-full">
                {/* Drag handle — grab and pull up/down */}
                <div
                  className="flex items-center justify-center pt-3 pb-1.5 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
                  onPointerDown={handlePointerDown}
                  onClick={handleDoubleTap}
                >
                  <div className={cn(
                    "rounded-full bg-white/30 transition-all",
                    isFullScreen ? "h-1 w-8" : "h-1 w-10"
                  )} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setTab("chat")}
                      className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all",
                        tab === "chat"
                          ? "bg-white/15 text-white shadow-sm shadow-black/10"
                          : "text-white/60 hover:text-white/80 hover:bg-white/5")}>
                      <MessageSquare className="h-3.5 w-3.5" /> Chat
                    </button>
                    <button onClick={() => setTab("history")}
                      className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all",
                        tab === "history"
                          ? "bg-white/15 text-white shadow-sm shadow-black/10"
                          : "text-white/60 hover:text-white/80 hover:bg-white/5")}>
                      <Clock className="h-3.5 w-3.5" /> History
                      {chats && chats.length > 0 && (
                        <span className="ml-0.5 bg-white/10 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full">{chats.length}</span>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Expand / collapse toggle */}
                    <motion.button
                      onClick={() => animateTo(currentSnap === SNAP_FULL ? SNAP_HALF : SNAP_FULL)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                      aria-label={isFullScreen ? "Half screen" : "Full screen"}
                    >
                      <ChevronUp className={cn("h-4 w-4 text-white/60 transition-transform", isFullScreen && "rotate-180")} />
                    </motion.button>
                    <motion.button
                      onClick={handleClose}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                      aria-label="Close chat"
                    >
                      <X className="h-4 w-4 text-white/60" />
                    </motion.button>
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-5 h-px bg-white/10 shrink-0" />

                {/* Content */}
                {tab === "chat" ? (
                  <>
                    <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
                    <div className="shrink-0 border-t border-white/5">{inputArea}</div>
                  </>
                ) : (
                  <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-3 pb-3">
                    <button onClick={() => { onSelectChat?.(null); setTab("chat"); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-sm font-medium transition-colors mb-2">
                      <Plus className="h-4 w-4" /> New conversation
                    </button>
                    {!chats || chats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-white/50">
                        <Clock className="h-8 w-8 mb-2" />
                        <p className="text-sm">No conversations yet</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {chats.map((chat) => (
                          <div key={chat.id} className={cn("group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
                            currentChatId === chat.id ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/8 hover:text-white/80")}>
                            <button onClick={() => { onSelectChat?.(chat.id); setTab("chat"); }}
                              className="flex-1 flex items-center gap-2 min-w-0 text-left">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm truncate">{chat.title || "Untitled"}</p>
                                <p className="text-[10px] text-white/50 mt-0.5">
                                  {new Date(chat.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </p>
                              </div>
                            </button>
                            {onDeleteChat && (
                              <button onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                                className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all">
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
