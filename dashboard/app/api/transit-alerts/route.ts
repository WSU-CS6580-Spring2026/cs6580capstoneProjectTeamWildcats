import { NextResponse } from "next/server";
import { getServiceAlerts } from "@/lib/uta";

export async function GET() {
  try {
    const alerts = await getServiceAlerts();
    return NextResponse.json(alerts, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
