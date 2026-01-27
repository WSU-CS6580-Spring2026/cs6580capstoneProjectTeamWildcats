"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatMessages, type Message } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import type { Chat } from "@/lib/db/schema";
import { Loader2, Menu, Snowflake, Train, MapPin } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { useSnow } from "@/hooks/use-snow";

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { snowEnabled, toggleSnow } = useSnow();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch chats
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

  // Fetch messages when chat changes
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
        body: JSON.stringify({ chatId: currentChatId, content }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let newChatId: string | null = null;
      let newTitle: string | null = null;

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

      // Refresh chat list
      if (newChatId || newTitle) {
        fetchChats();
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

  const handleSelectChat = (chatId: string | null) => {
    setCurrentChatId(chatId);
    if (!chatId) {
      setMessages([]);
    }
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    // Remove all messages after the edited one and resend
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1) {
      setMessages(messages.slice(0, messageIndex));
      handleSendMessage(newContent);
    }
  };

  const handleResendMessage = (content: string) => {
    handleSendMessage(content);
  };

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      {snowEnabled && <SnowAnimation />}
      <ChatSidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onChatsChange={fetchChats}
      />
      <SidebarInset className="relative z-10 flex h-dvh flex-col">
        {/* Snow toggle button - desktop */}
        <div className="absolute top-4 right-4 z-20 hidden md:block">
          <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
        </div>

        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden bg-background/80 backdrop-blur-sm">
          <SidebarTrigger className="-ml-2">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <Snowflake className="h-5 w-5 text-blue-500" />
          <span className="font-semibold">Snowbase</span>
          <div className="ml-auto">
            <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
          </div>
        </header>

        {/* Main chat area - flex-1 to fill remaining space */}
        <div className="flex flex-1 flex-col min-h-0">
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
                    <h2 className="text-lg font-semibold text-foreground">Welcome to Snowbase</h2>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    I'm specialized in helping you with Utah-specific information. Here's what I can help you with:
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-lg bg-white/60 p-3 dark:bg-white/5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
                        <Snowflake className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">Snow & Weather</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Snow forecasts, ski conditions, road conditions, winter weather alerts for Utah
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
                          Bus schedules, TRAX times, FrontRunner, routes, stops, and service alerts
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Try asking:</span> "What's the snow forecast for Park City?" or "When is the next TRAX at Temple Square?"
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
      </SidebarInset>
    </SidebarProvider>
  );
}
