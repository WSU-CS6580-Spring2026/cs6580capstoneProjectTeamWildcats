import { NextResponse } from "next/server";
import { getSkiCanyonConditions } from "@/lib/udot";

export async function GET() {
  try {
    const data = await getSkiCanyonConditions();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { passes: [], conditions: [], alerts: [], plows: [] },
      { status: 500 }
    );
  }
}
