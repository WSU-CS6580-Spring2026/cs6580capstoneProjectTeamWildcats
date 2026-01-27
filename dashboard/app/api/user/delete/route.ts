import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all user's messages first
    const { error: messagesError } = await supabase
      .from("messages")
      .delete()
      .in(
        "chat_id",
        (
          await supabase.from("chats").select("id").eq("user_id", user.id)
        ).data?.map((c) => c.id) || []
      );

    if (messagesError) {
      console.error("Error deleting messages:", messagesError);
    }

    // Delete all user's chats
    const { error: chatsError } = await supabase
      .from("chats")
      .delete()
      .eq("user_id", user.id);

    if (chatsError) {
      console.error("Error deleting chats:", chatsError);
    }

    // Delete the user from auth using RPC function
    const { error: deleteError } = await supabase.rpc("delete_user");

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
