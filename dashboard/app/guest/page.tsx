"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChatMessages, type Message } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { Loader2, Snowflake, Train, LogIn } from "lucide-react";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { useSnow } from "@/hooks/use-snow";
import { Button } from "@/components/ui/button";

export default function GuestPage() {
  const { snowEnabled, toggleSnow } = useSnow();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (content: string) => {
    if (isLoading) return;

    // Add user message optimistically
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent("");

    // Create abort controller for stopping
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, guest: true }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.content) {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Add assistant message
      if (fullContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: fullContent,
          },
        ]);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("Request aborted");
      } else {
        console.error("Send message error:", error);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1) {
      setMessages(messages.slice(0, messageIndex));
      handleSendMessage(newContent);
    }
  };

  const handleResendMessage = (content: string) => {
    handleSendMessage(content);
  };

  return (
    <div className="relative flex h-dvh flex-col bg-background">
      {snowEnabled && <SnowAnimation />}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 bg-background/80 backdrop-blur-sm relative z-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-400 to-cyan-500">
            <Snowflake className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold">Snowbase</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Guest Mode
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
          <Link href="/login">
            <Button variant="outline" size="sm" className="gap-2">
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-h-0 relative z-10">
        {/* Scrollable messages area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Info Banner - Show when no messages */}
          {messages.length === 0 && !isLoading && (
            <div className="mx-auto w-full max-w-3xl px-4 pt-6">
              <div className="rounded-xl border bg-linear-to-r from-blue-50 to-cyan-50 p-6 dark:from-blue-950/30 dark:to-cyan-950/30 dark:border-blue-900/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-blue-400 to-cyan-500">
                    <Snowflake className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Welcome to Snowbase</h2>
                    <p className="text-xs text-muted-foreground">Guest Mode - Chats are not saved</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  I can help you with Utah-specific information:
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-lg bg-white/60 p-3 dark:bg-white/5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
                      <Snowflake className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">Snow & Weather</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Snow forecasts, ski conditions, road conditions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-white/60 p-3 dark:bg-white/5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                      <Train className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">UTA Transit</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bus schedules, TRAX times, routes
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
                  <p className="text-xs text-muted-foreground">
                    <Link href="/signup" className="text-blue-500 hover:underline font-medium">
                      Create an account
                    </Link>{" "}
                    to save your chat history
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {(messages.length > 0 || isLoading) && (
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              streamingContent={streamingContent}
              onEditMessage={handleEditMessage}
              onResendMessage={handleResendMessage}
            />
          )}
        </div>

        {/* Fixed input at bottom */}
        <div className="shrink-0">
          <ChatInput
            onSend={handleSendMessage}
            onStop={handleStop}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
