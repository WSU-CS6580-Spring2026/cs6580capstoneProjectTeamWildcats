"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Pencil, RefreshCw, Volume2, VolumeX, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapDisplay, parsePlacesFromContent, cleanMapDataFromContent } from "./map-display";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date | string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  streamingContent?: string;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onResendMessage?: (content: string) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  streamingContent,
  onEditMessage,
  onResendMessage,
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
        <p className="text-center text-sm sm:text-base text-muted-foreground max-w-md">
          Ask me about Utah snow forecasts, ski conditions, or UTA transit schedules.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-4 sm:py-8">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onEdit={onEditMessage}
            onResend={onResendMessage}
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
          />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  onEdit,
  onResend,
}: {
  message: Message;
  isStreaming?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onResend?: (content: string) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Parse places from assistant messages
  const places = !isUser ? parsePlacesFromContent(message.content) : null;
  const displayContent = places ? cleanMapDataFromContent(message.content) : message.content;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
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
      const utterance = new SpeechSynthesisUtterance(displayContent);
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
      {/* Message Label */}
      <span className={cn(
        "text-xs font-medium mb-1.5 px-1",
        isUser ? "text-primary" : "text-muted-foreground"
      )}>
        {isUser ? "You" : "Snowbasin"}
      </span>

      {/* Message Content */}
      {isEditing ? (
        <div className="w-full max-w-[85%] sm:max-w-[80%]">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded-xl border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
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
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground shadow-sm border"
          )}
        >
          {isStreaming ? (
            <div className="flex items-center gap-1.5 py-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60" />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
              {displayContent}
            </div>
          )}
        </div>
      )}

      {/* Message Actions */}
      {!isStreaming && !isEditing && message.id !== "streaming" && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 transition-opacity duration-200",
            showActions ? "opacity-100" : "opacity-0 sm:group-hover:opacity-100"
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
        </div>
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
