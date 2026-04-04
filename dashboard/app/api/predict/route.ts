import { NextRequest, NextResponse } from "next/server";

const HF_FASTAPI_URL =
  process.env.HF_FASTAPI_URL ||
  "https://hazemdhw26-snowbasin-traffic-api.hf.space";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${HF_FASTAPI_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Prediction failed", details: error },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      prediction: data.prediction,
      model: data.model,
      confidence: data.confidence,
      details: data.details ?? {},
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(`${HF_FASTAPI_URL}/health`);
    const data = await response.json();
    return NextResponse.json({ status: data.status, url: HF_FASTAPI_URL });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
