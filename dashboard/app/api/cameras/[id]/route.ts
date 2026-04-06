import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy UDOT camera images to avoid CORS issues.
 * GET /api/cameras/{imageUrl} — fetches and returns the camera snapshot.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // id is the UDOT view URL (base64-encoded to avoid path issues)
    const imageUrl = Buffer.from(id, "base64").toString("utf-8");

    if (!imageUrl.includes("udottraffic.utah.gov")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const response = await fetch(imageUrl, {
      headers: {
        "Accept": "image/*",
        "User-Agent": "SnowbasinTrafficDashboard/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Camera unavailable" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch camera" }, { status: 500 });
  }
}
