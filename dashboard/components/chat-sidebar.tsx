"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MessageSquare,
  Trash2,
  Share2,
  Pencil,
  Check,
  X,
  Copy,
  MoreHorizontal,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Snowflake,
  Settings,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { Chat } from "@/lib/db/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string | null) => void;
  onChatsChange: () => void;
}

export function ChatSidebar({
  chats,
  currentChatId,
  onSelectChat,
  onChatsChange,
}: ChatSidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isMobile, setOpenMobile } = useSidebar();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNewChat = () => {
    onSelectChat(null);
    if (isMobile) setOpenMobile(false);
  };

  const handleSelectChat = (chatId: string) => {
    onSelectChat(chatId);
    if (isMobile) setOpenMobile(false);
  };

  const handleRename = async (chatId: string) => {
    if (!editTitle.trim()) return;

    try {
      await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
      setEditingId(null);
      onChatsChange();
    } catch (error) {
      console.error("Failed to rename chat:", error);
    }
  };

  const handleDelete = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (currentChatId === chatId) {
        onSelectChat(null);
      }
      onChatsChange();
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleShare = async (chat: Chat) => {
    try {
      const response = await fetch(`/api/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared: true }),
      });
      const updated = await response.json();

      const shareUrl = `${window.location.origin}/share/${updated.share_id}`;
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Link copied!");
      setTimeout(() => setShareMessage(null), 2000);
      onChatsChange();
    } catch (error) {
      console.error("Failed to share chat:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  // Group chats by date
  const groupedChats = chats.reduce(
    (groups, chat) => {
      const date = formatDate(chat.updated_at);
      if (!groups[date]) groups[date] = [];
      groups[date].push(chat);
      return groups;
    },
    {} as Record<string, Chat[]>
  );

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-400 to-cyan-500">
            <Snowflake className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold">Snowbasin</h1>
        </div>
        <div className="px-2 pb-2">
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {shareMessage && (
          <div className="mx-2 mb-2 rounded-lg bg-green-100 p-2 text-center text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
            {shareMessage}
          </div>
        )}

        {Object.entries(groupedChats).map(([date, dateChats]) => (
          <SidebarGroup key={date}>
            <SidebarGroupLabel>{date}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dateChats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    {editingId === chat.id ? (
                      <div className="flex items-center gap-1 px-2 py-1">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(chat.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 flex-1"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleRename(chat.id)}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <SidebarMenuButton
                          onClick={() => handleSelectChat(chat.id)}
                          isActive={currentChatId === chat.id}
                          className="pr-8"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate">{chat.title}</span>
                          {chat.shared && (
                            <Share2 className="ml-auto h-3 w-3 shrink-0 text-blue-500" />
                          )}
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction>
                              <MoreHorizontal className="h-4 w-4" />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingId(chat.id);
                                setEditTitle(chat.title);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShare(chat)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(chat.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {chats.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No chats yet. Start a new conversation!
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {/* Theme Toggle */}
        <div className="flex items-center justify-center gap-1 rounded-lg bg-muted p-1">
          <Button
            size="icon"
            variant={mounted && theme === "light" ? "secondary" : "ghost"}
            className="h-8 w-8"
            onClick={() => setTheme("light")}
          >
            <Sun className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={mounted && theme === "dark" ? "secondary" : "ghost"}
            className="h-8 w-8"
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={mounted && theme === "system" ? "secondary" : "ghost"}
            className="h-8 w-8"
            onClick={() => setTheme("system")}
          >
            <Monitor className="h-4 w-4" />
          </Button>
        </div>

        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2 px-2 py-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col items-start text-left">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {userName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {user.email}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
