"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChatMessages, type Message, type MessageMeta } from "@/components/chat-messages";
import { ChatInput, type ModelType } from "@/components/chat-input";
import { ChatWelcome } from "@/components/ChatWelcome";
import { Snowflake, LogIn } from "lucide-react";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { SpaceStatus } from "@/components/space-status";
import { OfflineBanner } from "@/components/offline-banner";
import { PredictionHero } from "@/components/prediction-hero";
import { WeatherThemeProvider, useWeatherTheme } from "@/contexts/weather-theme";
import { useSnow } from "@/hooks/use-snow";
import { useGeolocation, mentionsUserLocation } from "@/hooks/use-geolocation";
import { Button } from "@/components/ui/button";

export default function GuestPage() {
  return (
    <WeatherThemeProvider>
      <GuestPageInner />
    </WeatherThemeProvider>
  );
}

function GuestPageInner() {
  const { snowEnabled, toggleSnow } = useSnow();
  const { position: userPosition, requestPosition } = useGeolocation();
  const { theme, updateFromPrediction } = useWeatherTheme();
  const heroActive = theme.condition !== "default" || (theme.prediction != null && theme.prediction > 0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelType>("random-forest");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (content: string) => {
    if (isLoading) return;

    // If the user mentions their location, get coordinates before sending
    const wantsLocation = mentionsUserLocation(content);
    let coordinates = userPosition;
    if (wantsLocation && !coordinates) {
      coordinates = await requestPosition();
    }

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
      const body: Record<string, unknown> = {
        content,
        guest: true,
        model: selectedModel,
        previousMessages: messages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (wantsLocation && coordinates) {
        body.userCoordinates = coordinates;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let responseMeta: MessageMeta | undefined;

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

              if (parsed.meta) {
                responseMeta = parsed.meta;
              }
              if (parsed.error && !fullContent) {
                fullContent = parsed.error;
              }
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
            meta: responseMeta,
          },
        ]);
      }

      // Update weather background when we get a prediction
      if (responseMeta?.debug?.mlResponse) {
        updateFromPrediction(
          responseMeta.debug.mlResponse as Record<string, unknown>,
          responseMeta.model,
          responseMeta.debug.mlRequest as Record<string, unknown> | undefined
        );
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
          <span className="font-semibold">Snowbasin</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Guest Mode
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SpaceStatus />
          <ThemeToggle />
          {!heroActive && <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />}
          <Link href="/login">
            <Button variant="outline" size="sm" className="gap-2">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          </Link>
        </div>
      </header>

      <OfflineBanner />

      {/* Hero panel — slides in when a prediction arrives */}
      <PredictionHero snowEnabled={snowEnabled} onToggleSnow={toggleSnow} />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-h-0 relative z-10">
        {/* Scrollable messages area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Welcome Screen - Show when no messages */}
          {messages.length === 0 && !isLoading && (
            <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-4">
              <ChatWelcome
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                isGuest
                onSend={handleSendMessage}
              />
              <p className="text-center text-xs text-muted-foreground mt-4">
                <Link href="/signup" className="text-blue-500 hover:underline font-medium">
                  Create an account
                </Link>{" "}
                to save your chat history
              </p>
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
              onRetry={() => {
                const lastUser = [...messages].reverse().find(m => m.role === "user");
                if (lastUser) handleSendMessage(lastUser.content);
              }}
              onSuggest={handleSendMessage}
            />
          )}
        </div>

        {/* Fixed input at bottom */}
        <div className="shrink-0">
          <ChatInput
            onSend={handleSendMessage}
            onStop={handleStop}
            isLoading={isLoading}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      </div>
    </div>
  );
}
