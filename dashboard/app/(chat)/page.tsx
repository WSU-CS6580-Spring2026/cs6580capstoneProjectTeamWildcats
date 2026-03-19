"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatMessages, type Message, type MessageMeta } from "@/components/chat-messages";
import { ChatInput, type ModelType } from "@/components/chat-input";
import { ChatWelcome } from "@/components/ChatWelcome";
import type { Chat } from "@/lib/db/schema";
import { Loader2, Menu, Snowflake } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { SpaceStatus } from "@/components/space-status";
import { OfflineBanner } from "@/components/offline-banner";
import { PredictionHero } from "@/components/prediction-hero";
import { WeatherThemeProvider, useWeatherTheme } from "@/contexts/weather-theme";
import { useSnow } from "@/hooks/use-snow";
import { useGeolocation, mentionsUserLocation } from "@/hooks/use-geolocation";

export default function ChatPage() {
  return (
    <WeatherThemeProvider>
      <ChatPageInner />
    </WeatherThemeProvider>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { snowEnabled, toggleSnow } = useSnow();
  const { position: userPosition, requestPosition } = useGeolocation();
  const { theme, updateFromPrediction } = useWeatherTheme();
  const heroActive = theme.condition !== "default" || (theme.prediction != null && theme.prediction > 0);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelType>("random-forest");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchChats = useCallback(async () => {
    try {
      const response = await fetch("/api/chats");
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user, fetchChats]);

  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId);
    } else {
      setMessages([]);
    }
  }, [currentChatId]);

  const fetchMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string; created_at: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            createdAt: m.created_at,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (isLoading) return;

    // If the user mentions their location, get coordinates before sending
    const wantsLocation = mentionsUserLocation(content);
    let coordinates = userPosition;
    if (wantsLocation && !coordinates) {
      coordinates = await requestPosition();
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent("");

    abortControllerRef.current = new AbortController();

    // Build request body, attaching user coordinates when relevant
    const body: Record<string, unknown> = {
      chatId: currentChatId,
      content,
      model: selectedModel,
    };
    if (wantsLocation && coordinates) {
      body.userCoordinates = coordinates;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let newChatId: string | null = null;
      let newTitle: string | null = null;
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
              if (parsed.chatId) {
                newChatId = parsed.chatId;
                setCurrentChatId(newChatId);
              }
              if (parsed.meta) {
                responseMeta = parsed.meta;
              }
              if (parsed.error && !fullContent) {
                // Only show error if no content was received yet
                fullContent = parsed.error;
              }
              if (parsed.content) {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }
              if (parsed.title) {
                newTitle = parsed.title;
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      if (fullContent) {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", content: fullContent, meta: responseMeta },
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

      if (newChatId || newTitle) {
        fetchChats();
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("Request aborted");
      } else {
        console.error("Send message error:", error);
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => abortControllerRef.current?.abort();

  const handleSelectChat = (chatId: string | null) => {
    setCurrentChatId(chatId);
    if (!chatId) setMessages([]);
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1) {
      setMessages(messages.slice(0, messageIndex));
      handleSendMessage(newContent);
    }
  };

  const handleResendMessage = (content: string) => handleSendMessage(content);

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <ChatSidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onChatsChange={fetchChats}
      />
      <SidebarInset className="relative z-10 flex h-dvh flex-col">
        {!heroActive && (
          <div className="absolute top-4 right-4 z-20 hidden md:block">
            <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
          </div>
        )}

        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden bg-background/80 backdrop-blur-sm">
          <SidebarTrigger className="-ml-2">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <Snowflake className="h-5 w-5 text-blue-500" />
          <span className="font-semibold">Snowbasin</span>
          <div className="ml-auto flex items-center gap-2">
            <SpaceStatus />
            <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
          </div>
        </header>

        <OfflineBanner />

        {/* Hero panel — slides in when a prediction arrives */}
        <PredictionHero snowEnabled={snowEnabled} onToggleSnow={toggleSnow} />

        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* Welcome screen — shown when no messages */}
            {messages.length === 0 && !isLoading && (
              <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <ChatWelcome selectedModel={selectedModel} onModelChange={setSelectedModel} onSend={handleSendMessage} />
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
      </SidebarInset>
      {snowEnabled && <SnowAnimation />}
    </SidebarProvider>
  );
}
