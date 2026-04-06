import { NextResponse } from "next/server";

const HF_FASTAPI_URL =
  process.env.HF_FASTAPI_URL ||
  "https://hazemdhw26-snowbasin-traffic-api.hf.space";

export async function GET() {
  try {
    const response = await fetch(`${HF_FASTAPI_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return NextResponse.json({
      pinged: true,
      space_status: data.status,
      models: data.models,
      training_data: data.training_data,
    });
  } catch (error) {
    return NextResponse.json({ pinged: false, error: String(error) }, { status: 503 });
  }
}
