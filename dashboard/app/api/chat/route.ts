import { createClient } from "@/lib/supabase/server";
import { streamChatResponse, generateChatTitle } from "@/lib/claude";
import {
  getServiceAlerts,
  getStopArrivals,
  formatAlertsResponse,
  POPULAR_STOPS,
} from "@/lib/uta";
import {
  getSkiCanyonConditions,
  getRoadConditions,
  getWeatherStations,
  formatRoadConditionsResponse,
  formatMountainPassesResponse,
  formatAlertsResponse as formatUDOTAlertsResponse,
  formatSnowPlowsResponse,
  formatWeatherStationsResponse,
} from "@/lib/udot";

// ─── Prediction helpers ───────────────────────────────────────────────────────

const HF_FASTAPI_URL =
  process.env.HF_FASTAPI_URL ||
  "https://hazemdhw26-snowbasin-traffic-api.hf.space";

const PREDICTION_KEYWORDS = [
  "predict", "forecast", "how busy", "traffic prediction",
  "how many cars", "how many vehicles", "vehicles per hour",
  "traffic estimate", "traffic forecast",
];

const DAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

function extractPredictionParams(
  content: string,
  previousMessages: Array<{ role: string; content: string }>
) {
  // Prioritize current message for params, fall back to user messages only (not assistant)
  const currentLower = content.toLowerCase();
  const userMsgs = previousMessages.filter((m) => m.role === "user");
  const userHistory = userMsgs.map((m) => m.content).join(" ").toLowerCase();
  const allUserText = userHistory + " " + currentLower;

  // Use Mountain Time (Utah) regardless of server timezone
  const now = new Date();
  const utahFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    weekday: "long", hour: "numeric", month: "numeric",
    hour12: false,
  });
  const utahParts = utahFormatter.formatToParts(now);
  const utahWeekday = utahParts.find((p) => p.type === "weekday")!.value.toLowerCase();
  const utahHour = parseInt(utahParts.find((p) => p.type === "hour")!.value);
  const utahMonth = parseInt(utahParts.find((p) => p.type === "month")!.value);

  const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  // Default = current day in Utah
  let day_of_week = utahWeekday.charAt(0).toUpperCase() + utahWeekday.slice(1);

  // Check current message first, then user history for day
  const daySource = currentLower.includes("tomorrow") || currentLower.includes("today")
    ? currentLower
    : allUserText;

  if (daySource.includes("tomorrow")) {
    const todayIndex = DAY_NAMES.indexOf(utahWeekday);
    const tomorrowIndex = (todayIndex + 1) % 7;
    day_of_week = DAY_NAMES[tomorrowIndex].charAt(0).toUpperCase() + DAY_NAMES[tomorrowIndex].slice(1);
  } else if (!daySource.includes("today")) {
    // Search current message first for explicit day names
    let foundDay = false;
    for (const day of Object.keys(DAY_MAP)) {
      if (currentLower.includes(day)) {
        day_of_week = day.charAt(0).toUpperCase() + day.slice(1);
        foundDay = true;
        break;
      }
    }
    // If not in current message, check user history (most recent first)
    if (!foundDay) {
      for (const msg of [...userMsgs].reverse()) {
        const msgLower = msg.content.toLowerCase();
        for (const day of Object.keys(DAY_MAP)) {
          if (msgLower.includes(day)) {
            day_of_week = day.charAt(0).toUpperCase() + day.slice(1);
            foundDay = true;
            break;
          }
        }
        if (foundDay) break;
      }
    }
  }

  // Default = current hour in Utah; check current message first, then user history
  let hour = utahHour;
  const hourMatchCurrent = currentLower.match(/\b(\d{1,2})(?::00)?\s*(am|pm)\b/);
  const hourMatchHistory = allUserText.match(/\b(\d{1,2})(?::00)?\s*(am|pm)\b/);
  const hourMatch = hourMatchCurrent || hourMatchHistory;
  if (hourMatch) {
    hour = parseInt(hourMatch[1]);
    if (hourMatch[2] === "pm" && hour !== 12) hour += 12;
    if (hourMatch[2] === "am" && hour === 12) hour = 0;
  }

  // Default = current month
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  let month = utahMonth;
  for (let i = 0; i < monthNames.length; i++) {
    if (allUserText.includes(monthNames[i])) { month = i + 1; break; }
  }

  // Snow depth — "18 inches of snow"
  let snow_depth_in = 18;
  const snowMatch = allUserText.match(/(\d+)\s*(?:inches?|in\.?)\s*(?:of\s*)?snow/);
  if (snowMatch) snow_depth_in = parseInt(snowMatch[1]);

  // Temperature
  let temp_f = 28;
  const tempMatch = allUserText.match(/(\d+)\s*(?:°f|degrees?\s*f)/);
  if (tempMatch) temp_f = parseInt(tempMatch[1]);

  // Humidity
  let humidity_pct = 65;
  const humMatch = allUserText.match(/(\d+)\s*%\s*humidity/);
  if (humMatch) humidity_pct = parseInt(humMatch[1]);

  // Wind
  let wind_speed_mph = 10;
  const windMatch = allUserText.match(/(\d+)\s*mph/);
  if (windMatch) wind_speed_mph = parseInt(windMatch[1]);

  const dayIndex = DAY_MAP[day_of_week.toLowerCase()] ?? 5;
  const is_weekend = dayIndex >= 5;
  const is_federal_holiday = allUserText.includes("holiday") || allUserText.includes("federal");

  return {
    hour, day_of_week, month, is_weekend, is_federal_holiday,
    temp_f, humidity_pct, wind_speed_mph, snow_depth_in, precip_1hr_in: 0.1,
  };
}

function hasPredictionIntent(
  content: string,
  previousMessages: Array<{ role: string; content: string }> = []
): boolean {
  // Check current message AND previous USER messages for prediction intent (skip assistant responses)
  const userMsgs = previousMessages.filter((m) => m.role === "user");
  const allUserText = [...userMsgs.map((m) => m.content), content]
    .join(" ")
    .toLowerCase();
  return PREDICTION_KEYWORDS.some((k) => allUserText.includes(k));
}

function hasEnoughInfoToPredict(
  content: string,
  previousMessages: Array<{ role: string; content: string }>
): boolean {
  const userMsgs = previousMessages.filter((m) => m.role === "user");
  const allUserText = [...userMsgs.map((m) => m.content), content]
    .join(" ")
    .toLowerCase();

  const hasDay = Object.keys(DAY_MAP).some((d) => allUserText.includes(d)) || allUserText.includes("today") || allUserText.includes("tomorrow");
  const hasTime = /\b\d{1,2}\s*(am|pm)\b/.test(allUserText) || allUserText.includes("now") || allUserText.includes("right now") || allUserText.includes("current");
  const wantsDefaults = /typical|default|usual|average|use (?:rf|random forest|lstm|the model)|just predict|go ahead|yes.*(?:use|go)|sure|ok/.test(allUserText);

  return hasDay || hasTime || wantsDefaults;
}

interface PredictionResult {
  text: string;
  mlRequest?: Record<string, unknown>;
  mlResponse?: Record<string, unknown>;
}

async function fetchPredictionIfNeeded(
  content: string,
  model: string,
  previousMessages: Array<{ role: string; content: string }>
): Promise<PredictionResult> {
  if (!hasPredictionIntent(content, previousMessages)) return { text: "" };
  if (!hasEnoughInfoToPredict(content, previousMessages)) return { text: "" };

  const params = extractPredictionParams(content, previousMessages);
  const modelLabel = model === "lstm" ? "LSTM" : "Random Forest";

  try {
    const res = await fetch(`${HF_FASTAPI_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { text: "", mlRequest: params };
    const data = await res.json();

    const text = `**🤖 ML PREDICTION RESULT**
- **MODEL USED: ${modelLabel}** ← always name this exact model in your response
- Predicted traffic: ${data.prediction} vehicles/hour
- Conditions: ${params.day_of_week} at ${params.hour}:00 · ${params.temp_f}°F · ${params.snow_depth_in}" snow · ${params.humidity_pct}% humidity · ${params.wind_speed_mph} mph wind
- Weekend: ${params.is_weekend ? "Yes" : "No"} · Holiday: ${params.is_federal_holiday ? "Yes" : "No"} · Month: ${params.month}
- Confidence: ${data.confidence}

Interpret this for the user. IMPORTANT: You MUST say "${modelLabel} model" (not any other model name). Light traffic = <400/hr, moderate = 400-600, busy = 600-800, very busy = >800. Explain what the number means in practical terms for driving to Snowbasin.`;

    return { text, mlRequest: params, mlResponse: data };
  } catch {
    return { text: "", mlRequest: params };
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { chatId, content, guest, model = "random-forest" } = await request.json();

    if (!content) {
      return new Response("Message content is required", { status: 400 });
    }

    if (guest) {
      return handleGuestChat(content, model);
    }

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    let currentChatId = chatId;
    let isNewChat = false;

    if (!currentChatId) {
      isNewChat = true;
      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({ title: "New Chat", user_id: user.id })
        .select()
        .single();

      if (chatError) throw chatError;
      currentChatId = newChat.id;
    }

    const { error: userMsgError } = await supabase
      .from("messages")
      .insert({ chat_id: currentChatId, role: "user", content });

    if (userMsgError) throw userMsgError;

    const { data: previousMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", currentChatId)
      .order("created_at", { ascending: true });

    const messagesForAI = (previousMessages || []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // If the primary intent is prediction, only fetch road/transit if user explicitly asks
    const isPrediction = hasPredictionIntent(content, messagesForAI.slice(0, -1));
    const lower = content.toLowerCase();
    const wantsRoad = isPrediction
      ? ["condition", "road", "closure", "closed", "chain", "traction", "plow", "canyon"].some((k) => lower.includes(k))
      : true;
    const wantsTransit = isPrediction
      ? ["bus", "trax", "train", "transit", "uta", "frontrunner"].some((k) => lower.includes(k))
      : true;

    // Fetch all context in parallel
    const [transitData, roadData, predictionResult] = await Promise.all([
      wantsTransit ? fetchTransitDataIfNeeded(content) : Promise.resolve(""),
      wantsRoad ? fetchRoadDataIfNeeded(content) : Promise.resolve(""),
      fetchPredictionIfNeeded(content, model, messagesForAI.slice(0, -1)),
    ]);

    const realTimeData = [predictionResult.text, roadData, transitData]
      .filter(Boolean)
      .join("\n\n---\n\n");

    const mapsKeywords = ["direction", "how do i get", "how to get", "route to", "map", "navigate", "from ogden", "from salt lake"];
    const usesMaps = mapsKeywords.some((k) => content.toLowerCase().includes(k));

    const sources: string[] = [];
    if (predictionResult.text) sources.push("ML");
    if (roadData) sources.push("UDOT");
    if (transitData) sources.push("UTA");
    if (usesMaps) sources.push("Maps");

    const debug: Record<string, unknown> = {};
    if (predictionResult.mlRequest) debug.mlRequest = predictionResult.mlRequest;
    if (predictionResult.mlResponse) debug.mlResponse = predictionResult.mlResponse;
    if (roadData) debug.udotData = roadData;
    if (transitData) debug.utaData = transitData;

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (isNewChat) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chatId: currentChatId })}\n\n`)
            );
          }

          // Emit meta so client can show model/source badges + debug data
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ meta: { model, sources, debug } })}\n\n`)
          );

          for await (const chunk of streamChatResponse(messagesForAI, realTimeData, model)) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
            );
          }

          await supabase.from("messages").insert({
            chat_id: currentChatId,
            role: "assistant",
            content: fullResponse,
          });

          if (isNewChat) {
            const title = await generateChatTitle(content);
            await supabase
              .from("chats")
              .update({ title, updated_at: new Date().toISOString() })
              .eq("id", currentChatId);

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ title })}\n\n`)
            );
          } else {
            await supabase
              .from("chats")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", currentChatId);
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errMsg = getErrorMessage(error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Something went wrong. Please try again.";
  const e = error as Record<string, unknown>;
  const status = e.status as number | undefined;
  if (status === 429) return "⏳ Rate limit reached — too many requests. Please wait a moment and try again.";
  if (status === 529) return "🔄 Anthropic's servers are currently overloaded. Please try again in a few seconds.";
  if (status === 503) return "🔧 The AI service is temporarily unavailable. Please try again shortly.";
  if (status === 401) return "🔑 API key issue — please contact support.";
  if (status === 500) return "💥 Internal server error. Please try again.";
  const msg = (e.message as string) || "";
  if (msg.toLowerCase().includes("rate")) return "⏳ Rate limit reached. Please wait a moment and try again.";
  if (msg.toLowerCase().includes("overload")) return "🔄 AI servers are overloaded right now. Please try again in a few seconds.";
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) return "📡 Network error — check your connection and try again.";
  return "Something went wrong. Please try again.";
}

async function handleGuestChat(content: string, model: string) {
  const isPredictionGuest = hasPredictionIntent(content);
  const guestLower = content.toLowerCase();
  const guestWantsRoad = isPredictionGuest
    ? ["condition", "road", "closure", "closed", "chain", "traction", "plow", "canyon"].some((k) => guestLower.includes(k))
    : true;
  const guestWantsTransit = isPredictionGuest
    ? ["bus", "trax", "train", "transit", "uta", "frontrunner"].some((k) => guestLower.includes(k))
    : true;

  const [transitData, roadData, predictionResult] = await Promise.all([
    guestWantsTransit ? fetchTransitDataIfNeeded(content) : Promise.resolve(""),
    guestWantsRoad ? fetchRoadDataIfNeeded(content) : Promise.resolve(""),
    fetchPredictionIfNeeded(content, model, []),
  ]);

  const realTimeData = [predictionResult.text, roadData, transitData]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const mapsKeywordsGuest = ["direction", "how do i get", "how to get", "route to", "map", "navigate", "from ogden", "from salt lake"];
  const usesMapsGuest = mapsKeywordsGuest.some((k) => content.toLowerCase().includes(k));

  const guestSources: string[] = [];
  if (predictionResult.text) guestSources.push("ML");
  if (roadData) guestSources.push("UDOT");
  if (transitData) guestSources.push("UTA");
  if (usesMapsGuest) guestSources.push("Maps");

  const guestDebug: Record<string, unknown> = {};
  if (predictionResult.mlRequest) guestDebug.mlRequest = predictionResult.mlRequest;
  if (predictionResult.mlResponse) guestDebug.mlResponse = predictionResult.mlResponse;
  if (roadData) guestDebug.udotData = roadData;
  if (transitData) guestDebug.utaData = transitData;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ meta: { model, sources: guestSources, debug: guestDebug } })}\n\n`)
        );
        for await (const chunk of streamChatResponse(
          [{ role: "user" as const, content }],
          realTimeData,
          model
        )) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Guest stream error:", error);
        const errMsg = getErrorMessage(error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchTransitDataIfNeeded(content: string): Promise<string> {
  const transitKeywords = [
    "bus", "trax", "train", "transit", "uta", "frontrunner",
    "stop", "station", "route", "schedule", "arrival", "delay", "alert",
  ];

  if (!transitKeywords.some((k) => content.toLowerCase().includes(k))) return "";

  let transitData = "";
  try {
    const alerts = await getServiceAlerts();
    if (alerts.length > 0) transitData += formatAlertsResponse(alerts) + "\n\n";

    transitData += "**Popular UTA Stops:**\n";
    for (const stop of POPULAR_STOPS.slice(0, 5)) {
      const arrivals = await getStopArrivals(stop.stopId);
      if (arrivals.length > 0) {
        transitData += `\n${stop.stopName}:\n`;
        arrivals.slice(0, 3).forEach((arr) => {
          transitData += `- ${arr.routeName} → ${arr.headsign} in ${arr.minutesAway} min\n`;
        });
      }
    }
  } catch (error) {
    console.error("Error fetching transit data:", error);
  }

  return transitData;
}

async function fetchRoadDataIfNeeded(content: string): Promise<string> {
  const roadKeywords = [
    "road", "highway", "canyon", "pass", "drive", "driving", "conditions",
    "snow plow", "snowplow", "plow", "closure", "closed", "open",
    "cottonwood", "parley", "provo canyon", "ogden canyon",
    "ski", "skiing", "resort", "alta", "snowbird", "brighton", "solitude",
    "park city", "deer valley", "sundance", "powder mountain", "snowbasin",
    "i-80", "i-15", "sr-210", "sr-190", "sr-39", "us-189",
    "traction", "chain", "restriction", "weather station", "surface temp",
  ];

  if (!roadKeywords.some((k) => content.toLowerCase().includes(k))) return "";

  let roadData = "";
  try {
    const skiCanyonKeywords = [
      "cottonwood", "canyon", "ski", "alta", "snowbird", "brighton", "solitude",
      "park city", "parley", "ogden", "snowbasin", "powder mountain", "provo", "sundance",
    ];
    const isSkiQuery = skiCanyonKeywords.some((k) => content.toLowerCase().includes(k));

    if (isSkiQuery) {
      const canyonData = await getSkiCanyonConditions();
      roadData += "\n**UDOT REAL-TIME SKI CANYON DATA:**\n\n";
      if (canyonData.passes.length > 0)
        roadData += formatMountainPassesResponse(canyonData.passes) + "\n";
      if (canyonData.conditions.length > 0)
        roadData += formatRoadConditionsResponse(canyonData.conditions) + "\n";
      if (canyonData.alerts.length > 0)
        roadData += formatUDOTAlertsResponse(canyonData.alerts) + "\n";
      if (canyonData.plows.length > 0)
        roadData += formatSnowPlowsResponse(canyonData.plows) + "\n";
    } else {
      const [conditions, weatherStations] = await Promise.all([
        getRoadConditions(),
        getWeatherStations(),
      ]);
      roadData += "\n**UDOT REAL-TIME ROAD DATA:**\n\n";
      if (conditions.length > 0)
        roadData += formatRoadConditionsResponse(conditions.slice(0, 10)) + "\n";
      if (weatherStations.length > 0)
        roadData += formatWeatherStationsResponse(weatherStations.slice(0, 5)) + "\n";
    }
  } catch (error) {
    console.error("Error fetching road data:", error);
  }

  return roadData;
}
