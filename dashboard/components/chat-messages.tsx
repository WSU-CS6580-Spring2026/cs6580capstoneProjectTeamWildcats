"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Pencil, RefreshCw, Volume2, VolumeX, Snowflake, Clock, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapDisplay, parsePlacesFromContent, cleanMapDataFromContent } from "./map-display";
import { PredictionCards } from "./prediction-cards";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface MessageMeta {
  model?: string;
  sources?: string[]; // ["UDOT", "UTA", "ML"]
  debug?: {
    mlRequest?: Record<string, unknown>;
    mlResponse?: Record<string, unknown>;
    udotData?: string;
    utaData?: string;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date | string;
  meta?: MessageMeta;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  streamingContent?: string;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onResendMessage?: (content: string) => void;
  onRetry?: () => void;
  onSuggest?: (msg: string) => void;
}

// --- Follow-up suggestion helper ---
function getFollowUps(content: string): string[] {
  const lower = content.toLowerCase();
  const suggestions: string[] = [];
  if (lower.includes("vehicle") || lower.includes("traffic") || lower.includes("forecast")) {
    suggestions.push("What are current SR-167 road conditions?");
    suggestions.push("How busy is traffic to Snowbasin this Saturday at 9am?");
  }
  if (lower.includes("sr-167") || lower.includes("road condition") || lower.includes("udot")) {
    suggestions.push("How busy is traffic to Snowbasin tomorrow at 8am?");
    suggestions.push("Are chains required on SR-210?");
  }
  if (lower.includes("bus") || lower.includes("uta") || lower.includes("transit")) {
    suggestions.push("How busy is traffic to Snowbasin today at 9am?");
    suggestions.push("What are SR-167 road conditions?");
  }
  if (suggestions.length === 0) {
    suggestions.push("How busy is traffic to Snowbasin this Saturday at 9am?");
    suggestions.push("What are current SR-167 road conditions?");
  }
  return suggestions.slice(0, 3);
}

export function ChatMessages({
  messages,
  isLoading,
  streamingContent,
  onEditMessage,
  onResendMessage,
  onRetry,
  onSuggest,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-blue-400 to-cyan-500">
          <Snowflake className="h-8 w-8 text-white" />
        </div>
        <h2 className="mb-2 text-xl sm:text-2xl font-semibold text-center">Welcome to Snowbasin</h2>
        <p className="text-center text-sm sm:text-base text-white/60 max-w-md">
          Ask me about Utah snow forecasts, ski conditions, or UTA transit schedules.
        </p>
      </div>
    );
  }

  // Determine which message should receive the onRetry prop:
  // the last message if it is an assistant error and not currently loading.
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMsgIsError =
    lastMsg !== null &&
    lastMsg.role === "assistant" &&
    ["⏳","🔄","🔧","🔑","💥"].some(e => lastMsg.content.startsWith(e));

  // Determine whether to show follow-up suggestions:
  const showSuggestions =
    lastMsg !== null &&
    lastMsg.role === "assistant" &&
    !lastMsgIsError &&
    !isLoading &&
    !!onSuggest;

  return (
    <div className="h-full">
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-4 sm:py-8">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onEdit={onEditMessage}
            onResend={onResendMessage}
            onRetry={
              message.id === lastMsg?.id && lastMsgIsError && !isLoading
                ? onRetry
                : undefined
            }
          />
        ))}

        {/* Streaming message */}
        {(isLoading || streamingContent) && (
          <MessageBubble
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingContent || "",
            }}
            isStreaming={isLoading && !streamingContent}
            streamingMeta={streamingContent ? undefined : undefined}
          />
        )}

        {/* Follow-up suggestion chips */}
        {showSuggestions && (
          <div className="pb-2">
            <div className="flex flex-wrap gap-2 ml-1">
              {getFollowUps(lastMsg!.content).map((s) => (
                <button
                  key={s}
                  onClick={() => onSuggest!(s)}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const SOURCE_BADGE: Record<string, { icon: string; label: string; color: string; border: string }> = {
  UDOT:  { icon: "📡", label: "UDOT",  color: "bg-orange-500/15 text-orange-300", border: "border-orange-500/20" },
  UTA:   { icon: "🚌", label: "UTA",   color: "bg-green-500/15 text-green-300",   border: "border-green-500/20" },
  ML:    { icon: "",   label: "",      color: "bg-blue-500/15 text-blue-300",      border: "border-blue-500/20" },
  Maps:  { icon: "🗺️", label: "Maps",  color: "bg-purple-500/15 text-purple-300", border: "border-purple-500/20" },
};

function ModelBadge({ model, sources }: { model?: string; sources?: string[] }) {
  if (!model) return null;
  const modelLabel = model === "lstm" ? "📊 Deep Analysis" : "⚡ Quick Forecast";
  const hasPrediction = sources?.includes("ML");
  return (
    <>
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20">
        {modelLabel}
      </span>
      {hasPrediction && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20">
          {model === "lstm" ? "📊 Deep Analysis" : "⚡ Quick Forecast"}
        </span>
      )}
      {sources?.filter((s) => s !== "ML").map((src) => {
        const badge = SOURCE_BADGE[src];
        if (!badge) return null;
        return (
          <span
            key={src}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${badge.color} ${badge.border}`}
          >
            {badge.icon} {badge.label}
          </span>
        );
      })}
    </>
  );
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };
  return (
    <div className="relative group/code my-2">
      <pre className={cn("rounded-lg bg-black/30 p-4 overflow-x-auto text-xs text-white/80", className)}>
        <code>{children}</code>
      </pre>
      <button
        onClick={copyCode}
        className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity p-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/10 text-white/60 text-xs"
        title="Copy code"
      >
        {codeCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}


function SourcesPanel({ debug, model }: { debug: NonNullable<MessageMeta["debug"]>; model?: string }) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggle = (key: string) => setOpenSection(openSection === key ? null : key);
  const modelLabel = "LSTM";

  const sections: { key: string; title: string; icon: string; color: string; content: React.ReactNode }[] = [];

  if (debug.mlRequest) {
    const req = debug.mlRequest as Record<string, unknown>;
    const res = debug.mlResponse as Record<string, unknown> | undefined;
    sections.push({
      key: "ml",
      title: `${modelLabel} Model`,
      icon: model === "lstm" ? "📊" : "⚡",
      color: "border-blue-200 dark:border-blue-800",
      content: (
        <div className="space-y-3">
          {(() => {
            const resDetails = res ? (res as Record<string, unknown>).details as Record<string, unknown> | undefined : undefined;
            const actualParams = (resDetails?.input_params as Record<string, unknown>) || req;
            const weatherAvailable = actualParams.weather_available !== false && actualParams.temp_f != null;
            const weatherNote = actualParams.weather_note as string | undefined;
            const formatWeather = (val: unknown, unit: string, decimals = 1) => {
              if (val == null || val === 0) return "N/A";
              return `${Number(val).toFixed(decimals)}${unit}`;
            };
            return (
              <div>
                <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Model Input Parameters</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-white/60">Hour</span><span className="font-medium">{String(actualParams.hour ?? req.hour ?? "")}:00</span>
                  <span className="text-white/60">Day</span><span className="font-medium">{String(actualParams.day_of_week ?? req.day_of_week ?? "")}</span>
                  <span className="text-white/60">Month</span><span className="font-medium">{String(actualParams.month ?? req.month ?? "")}</span>
                  <span className="text-white/60">Weekend</span><span className="font-medium">{(actualParams.is_weekend ?? req.is_weekend) ? "Yes" : "No"}</span>
                  <span className="text-white/60">Holiday</span><span className="font-medium">{(actualParams.is_federal_holiday ?? req.is_federal_holiday) ? "Yes" : "No"}</span>
                  {weatherAvailable ? (
                    <>
                      <span className="text-white/60">Temp</span><span className="font-medium">{formatWeather(actualParams.temp_f, "°F")}</span>
                      <span className="text-white/60">Humidity</span><span className="font-medium">{formatWeather(actualParams.humidity_pct, "%", 0)}</span>
                      <span className="text-white/60">Wind</span><span className="font-medium">{formatWeather(actualParams.wind_speed_mph, " mph")}</span>
                      <span className="text-white/60">Snow Depth</span><span className="font-medium">{formatWeather(actualParams.snow_depth_in, "\"")}</span>
                      <span className="text-white/60">Precip (1hr)</span><span className="font-medium">{formatWeather(actualParams.precip_1hr_in, "\"", 2)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white/60">Weather</span>
                      <span className="font-medium text-yellow-600 dark:text-yellow-400">{weatherNote || "No sensor data for this period"}</span>
                    </>
                  )}
                  {(actualParams.weather_source as string) ? (
                    <>
                      <span className="text-white/60">Weather From</span>
                      <span className="font-medium">{String(actualParams.weather_source)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })()}
          {res && (
            <>
              <div>
                <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Response</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-white/60">Prediction</span><span className="font-bold text-blue-300">{String(res.prediction ?? "")} vehicles/hr</span>
                  <span className="text-white/60">Confidence</span><span className="font-medium">{String(res.confidence ?? "")}</span>
                  <span className="text-white/60">Model Used</span><span className="font-medium">{String(res.model ?? "")}</span>
                </div>
              </div>
              {/* RF: show lag data source */}
              {(res as Record<string, unknown>).details && (
                <div>
                  {(() => {
                    const details = (res as Record<string, unknown>).details as Record<string, unknown>;
                    const dataSource = (details.data_source || details.lag_source) as string | undefined;
                    const dateUsed = details.date_used as string | undefined;
                    const lagValues = details.lag_values as Record<string, number> | undefined;
                    const seqUsed = details.sequence_used as Record<string, unknown> | undefined;
                    const forecast = details.forecast_72h as Array<{ hours_ahead: number; prediction: number }> | undefined;
                    return (
                      <>
                        {dataSource && (
                          <div>
                            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Training Data Used</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span className="text-white/60">Source</span>
                              <span className={cn("font-medium", dataSource === "real_training_data" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400")}>
                                {dataSource === "real_training_data" ? "Real Training Data" : "Default"}
                              </span>
                              {dateUsed && (
                                <>
                                  <span className="text-white/60">Matched Date</span>
                                  <span className="font-medium">{dateUsed}</span>
                                </>
                              )}
                              {lagValues && Object.entries(lagValues).map(([k, v]) => (
                                <Fragment key={k}>
                                  <span className="text-white/60">{k.replace("traffic_lag_", "Lag ")}h</span>
                                  <span className="font-medium">{typeof v === "number" ? Math.round(v) : String(v)} veh/hr</span>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                        {seqUsed && (
                          <div>
                            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">LSTM Sequence Used</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span className="text-white/60">Start</span><span className="font-medium">{String(seqUsed.start ?? "")}</span>
                              <span className="text-white/60">End</span><span className="font-medium">{String(seqUsed.end ?? "")}</span>
                              <span className="text-white/60">Length</span><span className="font-medium">{String(seqUsed.length ?? "")} hours</span>
                              {seqUsed.sample_traffic ? (
                                <>
                                  <span className="text-white/60">Last 5h Traffic</span>
                                  <span className="font-medium">{(seqUsed.sample_traffic as number[]).map(Math.round).join(", ")}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        )}
                        {forecast && forecast.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">LSTM 72-Hour Forecast</p>
                            <div className="grid grid-cols-4 gap-1 text-xs">
                              {forecast.map((f) => (
                                <div key={f.hours_ahead} className="text-center rounded bg-white/5 px-1 py-0.5">
                                  <span className="text-white/60">+{f.hours_ahead}h</span>
                                  <br />
                                  <span className="font-bold">{f.prediction}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      ),
    });
  }

  if (debug.udotData) {
    sections.push({
      key: "udot",
      title: "UDOT Road Data",
      icon: "📡",
      color: "border-orange-500/20",
      content: (
        <pre className="text-xs whitespace-pre-wrap text-white/50 max-h-48 overflow-y-auto leading-relaxed">
          {String(debug.udotData)}
        </pre>
      ),
    });
  }

  if (debug.utaData) {
    sections.push({
      key: "uta",
      title: "UTA Transit Data",
      icon: "🚌",
      color: "border-green-500/20",
      content: (
        <pre className="text-xs whitespace-pre-wrap text-white/50 max-h-48 overflow-y-auto leading-relaxed">
          {String(debug.utaData)}
        </pre>
      ),
    });
  }

  if (sections.length === 0) return null;

  return (
    <div className="mt-2 w-full max-w-[85%] sm:max-w-[80%] space-y-1.5">
      {sections.map((s) => (
        <div key={s.key} className={cn("rounded-lg border bg-white/5 backdrop-blur-sm overflow-hidden", s.color)}>
          <button
            onClick={() => toggle(s.key)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors"
          >
            <span>{s.icon}</span>
            <span>{s.title}</span>
            <span className="ml-auto">
              {openSection === s.key ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </span>
          </button>
          {openSection === s.key && (
            <div className="px-3 pb-3 border-t border-white/10">
              <div className="pt-2">{s.content}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  onEdit,
  onResend,
  onRetry,
}: {
  message: Message;
  isStreaming?: boolean;
  streamingMeta?: MessageMeta;
  onEdit?: (messageId: string, newContent: string) => void;
  onResend?: (content: string) => void;
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Parse places from assistant messages
  const places = !isUser ? parsePlacesFromContent(message.content) : null;
  const displayContent = places ? cleanMapDataFromContent(message.content) : message.content;
  const isError = !isUser && ["⏳","🔄","🔧","🔑","💥"].some(e => message.content.startsWith(e));
  const hasDebug = !isUser && message.meta?.debug && Object.keys(message.meta.debug).length > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handleResend = () => {
    if (onResend) {
      onResend(message.content);
    }
  };

  const handleListen = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      // Strip markdown, emojis, table pipes, and special chars for clean TTS
      const cleanText = displayContent
        .replace(/\[MAP_DATA\][\s\S]*?\[\/MAP_DATA\]/g, "") // remove map data
        .replace(/\|/g, " ") // table pipes
        .replace(/^#{1,6}\s+/gm, "") // headers
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1") // bold/italic
        .replace(/`([^`]+)`/g, "$1") // inline code
        .replace(/^[-*+]\s+/gm, "") // list markers
        .replace(/^>\s+/gm, "") // blockquotes
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
        .replace(/---+/g, "") // horizontal rules
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "") // emojis
        .replace(/\n{3,}/g, "\n\n") // excessive newlines
        .trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  return (
    <div
      className={cn(
        "group mb-4 sm:mb-6 flex flex-col",
        isUser ? "items-end" : "items-start"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Message Label + inline source badges */}
      <div className={cn("flex items-center gap-1.5 flex-wrap mb-1.5 px-1", isUser ? "justify-end" : "justify-start")}>
        <span className={cn("text-xs font-medium", isUser ? "text-blue-300" : "text-white/60")}>
          {isUser ? "You" : "Snowbasin"}
        </span>
        {!isUser && !isStreaming && (
          <ModelBadge model={message.meta?.model} sources={message.meta?.sources} />
        )}
        {showActions && (
          <span className="text-[10px] text-white/60 ml-auto">
            {message.createdAt
              ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "just now"}
          </span>
        )}
      </div>

      {/* Message Content */}
      {isEditing ? (
        <div className="w-full max-w-[85%] sm:max-w-[80%]">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/20 resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleSaveEdit}>Save & Resend</Button>
            <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm sm:text-base",
            isUser
              ? "bg-blue-500/80 text-white backdrop-blur-sm"
              : isError
              ? "bg-red-500/10 text-white shadow-sm border border-red-500/20 backdrop-blur-sm"
              : "bg-white/8 text-white shadow-sm border border-white/10 backdrop-blur-sm",
            !isUser && isStreaming && "ring-1 ring-blue-400/20"
          )}
        >
          {isStreaming ? (
            <div className="flex items-center gap-1.5 py-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60" />
            </div>
          ) : (
            <div>
              <div className={cn(
                "prose prose-sm dark:prose-invert max-w-none overflow-hidden transition-all duration-300",
                !isUser && !expanded && displayContent.length > 800 ? "max-h-48" : "max-h-none"
              )}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const isBlock = className?.includes("language-");
                      if (isBlock) {
                        return <CodeBlock className={className}>{children}</CodeBlock>;
                      }
                      return <code className="rounded bg-white/10 px-1 py-0.5 text-xs font-mono" {...props}>{children}</code>;
                    },
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              </div>
              {!isUser && displayContent.length > 800 && (
                <button onClick={() => setExpanded(!expanded)}
                  className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 text-[11px] font-medium text-white/70 hover:text-white transition-colors">
                  {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visual prediction cards (weather + traffic) */}
      {!isUser && !isStreaming && message.meta?.debug?.mlResponse && (
        <PredictionCards meta={message.meta} />
      )}

      {/* Retry button for error assistant messages */}
      {isError && onRetry && (
        <button
          onClick={onRetry}
          className="mt-1.5 flex items-center gap-1.5 text-xs text-white/60 hover:text-destructive transition-colors px-1"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}

      {/* Message Actions */}
      {!isStreaming && !isEditing && message.id !== "streaming" && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 transition-opacity duration-200",
            showActions ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>

          {isUser && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          )}

          {isUser && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleResend}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resend</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleListen}
              >
                {isSpeaking ? (
                  <VolumeX className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isSpeaking ? "Stop" : "Listen"}</TooltipContent>
          </Tooltip>

          {hasDebug && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("h-7 w-7", sourcesOpen && "text-primary")}
                  onClick={() => setSourcesOpen(!sourcesOpen)}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sources</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Sources debug panel */}
      {sourcesOpen && hasDebug && (
        <SourcesPanel debug={message.meta!.debug!} model={message.meta?.model} />
      )}

      {/* Render map if places are found */}
      {places && places.length > 0 && (
        <div className="mt-3 w-full max-w-[85%] sm:max-w-[80%]">
          <MapDisplay places={places} />
        </div>
      )}
    </div>
  );
}
