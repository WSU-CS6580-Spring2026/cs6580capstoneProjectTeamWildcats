"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Send, Square, CalendarDays, Clock, ChevronLeft, Mic, MicOff } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

export type ModelType = "random-forest" | "lstm";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
}

const HOURS = [
  { label: "5 AM", value: 5 }, { label: "6 AM", value: 6 },
  { label: "7 AM", value: 7 }, { label: "8 AM", value: 8 },
  { label: "9 AM", value: 9 }, { label: "10 AM", value: 10 },
  { label: "11 AM", value: 11 }, { label: "12 PM", value: 12 },
  { label: "1 PM", value: 13 }, { label: "2 PM", value: 14 },
  { label: "3 PM", value: 15 }, { label: "4 PM", value: 16 },
  { label: "5 PM", value: 17 }, { label: "6 PM", value: 18 },
  { label: "7 PM", value: 19 }, { label: "8 PM", value: 20 },
  { label: "9 PM", value: 21 }, { label: "10 PM", value: 22 },
  { label: "11 PM", value: 23 },
];

export function ChatInput({
  onSend,
  onStop,
  isLoading,
  disabled,
  selectedModel,
  onModelChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [step, setStep] = useState<"date" | "time">("date");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const calendarButtonRef = useRef<HTMLDivElement>(null);
  const calendarPopupRef = useRef<HTMLDivElement>(null);
  const [calendarStyle, setCalendarStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e: MouseEvent) => {
      const inButton = calendarButtonRef.current?.contains(e.target as Node);
      const inPopup = calendarPopupRef.current?.contains(e.target as Node);
      if (!inButton && !inPopup) {
        setCalendarOpen(false);
        setStep("date");
        setSelectedDate(undefined);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calendarOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { setIsListening(false); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => prev ? prev + " " + transcript : transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleDatePicked = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setStep("time");
  };

  const handleTimePicked = (hour: number) => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, "EEEE, MMMM d");
    const timeStr = hour === 12 ? "12:00 PM"
      : hour > 12 ? `${hour - 12}:00 PM`
      : `${hour}:00 AM`;
    const message = `How busy is traffic to Snowbasin on ${dateStr} at ${timeStr}?`;
    setCalendarOpen(false);
    setStep("date");
    setSelectedDate(undefined);
    onSend(message);
  };

  const openCalendar = () => {
    setStep("date");
    setSelectedDate(undefined);
    if (calendarButtonRef.current) {
      const rect = calendarButtonRef.current.getBoundingClientRect();
      const bottom = window.innerHeight - rect.top + 8;
      if (window.innerWidth < 640) {
        // Mobile: stretch full width with 12px side margins
        setCalendarStyle({ position: "fixed", bottom, left: 12, right: 12 });
      } else {
        // Desktop: right-aligned dropdown, 300px wide
        const right = Math.max(window.innerWidth - rect.right, 12);
        setCalendarStyle({ position: "fixed", bottom, right, width: 300 });
      }
    }
    setCalendarOpen(true);
  };

  return (
    <div className="border-t bg-background px-2 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-2">

        {/* Model Selector */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">Model:</span>
          <div className="flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => onModelChange("random-forest")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
                selectedModel === "random-forest"
                  ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              🌲 Random Forest
            </button>
            <button
              type="button"
              onClick={() => onModelChange("lstm")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
                selectedModel === "lstm"
                  ? "bg-background text-green-600 dark:text-green-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              🧠 LSTM
            </button>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {selectedModel === "random-forest"
              ? "· Fast & reliable for general forecasts"
              : "· Advanced time-series analysis"}
          </span>
        </div>

        {/* Textarea + Buttons */}
        <div className="relative flex items-end gap-2 rounded-2xl border bg-muted/50 p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedModel === "random-forest"
                ? "Ask about traffic, road conditions, ski resorts..."
                : "Ask about traffic predictions using LSTM time-series..."
            }
            disabled={disabled}
            rows={1}
            className={cn(
              "max-h-50 min-h-10 sm:min-h-11 flex-1 resize-none bg-transparent px-2 sm:px-3 py-2 text-sm outline-none placeholder:text-muted-foreground",
              disabled && "cursor-not-allowed opacity-50"
            )}
          />

          {/* Calendar icon */}
          <div className="relative shrink-0" ref={calendarButtonRef}>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={openCalendar}
              className={cn(
                "h-9 w-9 sm:h-10 sm:w-10 rounded-xl transition-colors",
                calendarOpen && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              title="Pick a date & time"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>

          {/* Mic button */}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={handleVoice}
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0 transition-colors",
              isListening && "bg-red-500 text-white hover:bg-red-600"
            )}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>

          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={onStop}
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || disabled}
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground hidden sm:block">
          Press Enter to send · Shift+Enter for new line · Ctrl+K to focus
        </p>
      </form>

      {/* Calendar portal — renders outside DOM tree so it's never clipped */}
      {calendarOpen && typeof document !== "undefined" && createPortal(
        <>
          {/* Backdrop for mobile tap-to-close */}
          <div
            className="fixed inset-0 z-9998 sm:hidden"
            onClick={() => { setCalendarOpen(false); setStep("date"); setSelectedDate(undefined); }}
          />
          {/* Popup */}
          <div
            ref={calendarPopupRef}
            className="z-9999 rounded-xl border bg-popover shadow-2xl overflow-hidden"
            style={calendarStyle}
          >
            {/* Header */}
            <div className="border-b">
              <div className="flex items-center gap-2 px-3 py-2.5">
                {step === "time" && (
                  <button
                    type="button"
                    onClick={() => setStep("date")}
                    className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {step === "date"
                  ? <><CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" /><span className="text-xs font-medium">Pick a date</span><span className="ml-auto text-[10px] text-muted-foreground">Step 1 of 2</span></>
                  : <><Clock className="h-3.5 w-3.5 text-primary shrink-0" /><span className="text-xs font-medium">{selectedDate ? format(selectedDate, "EEE, MMMM d") : "Pick a time"}</span><span className="ml-auto text-[10px] text-muted-foreground">Step 2 of 2</span></>
                }
              </div>
              <div className="h-0.5 bg-muted">
                <div className={cn("h-full bg-primary transition-all duration-300", step === "date" ? "w-1/2" : "w-full")} />
              </div>
            </div>

            {step === "date" && (
              <Calendar
                mode="single"
                onSelect={handleDatePicked}
                disabled={{ before: new Date() }}
                initialFocus
              />
            )}

            {step === "time" && (
              <div className="p-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {HOURS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleTimePicked(value)}
                      className="rounded-lg border bg-background px-2 py-2 text-xs font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors text-center"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">Select arrival time at Snowbasin</p>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
