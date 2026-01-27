import { createClient } from "@/lib/supabase/server";

// Get shared chat (public, no auth required)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    const supabase = await createClient();

    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .select("*")
      .eq("share_id", shareId)
      .eq("shared", true)
      .single();

    if (chatError || !chatData) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatData.id)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    return Response.json({
      title: chatData.title,
      messages: (messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    console.error("Get shared chat error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
