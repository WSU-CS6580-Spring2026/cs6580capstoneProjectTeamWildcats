import { createClient } from "@/lib/supabase/server";

// Get all chats for the current user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: chats, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return Response.json(chats || []);
  } catch (error) {
    console.error("Get chats error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
