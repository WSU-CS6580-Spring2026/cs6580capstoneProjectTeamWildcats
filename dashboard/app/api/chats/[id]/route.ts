import { createClient } from "@/lib/supabase/server";

// Get a specific chat with messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (chatError || !chatData) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    return Response.json({ ...chatData, messages: messages || [] });
  } catch (error) {
    console.error("Get chat error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Update chat (rename)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, shared } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (shared !== undefined) {
      updates.shared = shared;
      if (shared && !body.shareId) {
        updates.share_id = crypto.randomUUID().slice(0, 8);
      }
    }

    const { data: updated, error } = await supabase
      .from("chats")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !updated) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Update chat error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Delete chat
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete chat error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
