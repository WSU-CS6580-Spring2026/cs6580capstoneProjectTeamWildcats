"use client";

import { useEffect, useState, use } from "react";
import { Bot, User, ArrowLeft, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface SharedMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SharedChat {
  title: string;
  messages: SharedMessage[];
}

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

export default function SharedChatPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = use(params);
  const [chat, setChat] = useState<SharedChat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChat() {
      try {
        const response = await fetch(`/api/share/${shareId}`);
        if (!response.ok) {
          setError("Chat not found or is no longer shared");
          return;
        }
        const data = await response.json();
        setChat(data);
      } catch {
        setError("Failed to load chat");
      } finally {
        setLoading(false);
      }
    }

    fetchChat();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="mb-4 rounded-full bg-destructive/10 p-4">
          <Bot className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">{error}</h1>
        <Link
          href="/"
          className="mt-4 flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Go to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="font-semibold">{chat.title}</h1>
                <p className="text-xs text-muted-foreground">Shared conversation</p>
              </div>
            </div>
            <ThemeToggleButton />
          </div>
        </header>

        {/* Messages */}
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-4 sm:py-8">
          {chat.messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 sm:mb-6 flex gap-2 sm:gap-4 ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-gradient-to-br from-purple-500 to-blue-500 text-white"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </div>

              <div
                className={`flex max-w-[85%] sm:max-w-[80%] flex-col ${
                  message.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground shadow-sm border"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          <p>
            This is a shared conversation.{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Create your own account
            </Link>{" "}
            to start chatting.
          </p>
        </footer>
    </div>
  );
}
