import { NextResponse } from "next/server";
import { getTrafficCameras } from "@/lib/udot";

export async function GET() {
  try {
    const cameras = await getTrafficCameras();
    return NextResponse.json(cameras, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
