import { createClient } from "@/lib/supabase/server";
import { streamChatResponse, generateChatTitle } from "@/lib/ai";
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

// Prediction helpers

const HF_FASTAPI_URL =
  process.env.HF_FASTAPI_URL ||
  "https://hazemdhw26-snowbasin-traffic-api.hf.space";

const PREDICTION_KEYWORDS = [
  "predict", "forecast", "how busy", "traffic prediction",
  "how many cars", "how many vehicles", "vehicles per hour",
  "traffic estimate", "traffic forecast", "trip plan", "plan my trip",
  "plan for", "traffic today", "traffic tomorrow", "traffic saturday",
  "traffic sunday", "traffic friday", "traffic monday", "traffic tuesday",
  "traffic wednesday", "traffic thursday",
];

const DAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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

  // Default = current day in Utah
  let day_of_week = utahWeekday.charAt(0).toUpperCase() + utahWeekday.slice(1);

  // ALWAYS check current message first for day — never let history override
  if (currentLower.includes("tomorrow")) {
    const todayIndex = DAY_NAMES.indexOf(utahWeekday);
    const tomorrowIndex = (todayIndex + 1) % 7;
    day_of_week = DAY_NAMES[tomorrowIndex].charAt(0).toUpperCase() + DAY_NAMES[tomorrowIndex].slice(1);
  } else if (currentLower.includes("today") || /\bright now\b|\bnow\b/.test(currentLower.replace(/snowbasin/g, "").replace(/snow\b/g, ""))) {
    // Keep current Utah day (already set as default) — exclude "now" inside "snowbasin" or "snow"
  } else {
    // Search current message for explicit day names
    let foundDay = false;
    for (const day of DAY_NAMES) {
      if (currentLower.includes(day)) {
        day_of_week = day.charAt(0).toUpperCase() + day.slice(1);
        foundDay = true;
        break;
      }
    }
    // Only fall back to history if NOTHING found in current message
    if (!foundDay) {
      for (const msg of [...userMsgs].reverse()) {
        const msgLower = msg.content.toLowerCase();
        if (msgLower.includes("tomorrow")) {
          const todayIndex = DAY_NAMES.indexOf(utahWeekday);
          const tomorrowIndex = (todayIndex + 1) % 7;
          day_of_week = DAY_NAMES[tomorrowIndex].charAt(0).toUpperCase() + DAY_NAMES[tomorrowIndex].slice(1);
          break;
        }
        for (const day of DAY_NAMES) {
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

  // Default = current hour in Utah; ALWAYS check current message first
  let hour = utahHour;

  // Check for relative time: "an hour from now", "2 hours from now", "in 3 hours"
  let foundHour = false;
  const relativeMatch = currentLower.match(/(?:in\s+)?(\d+|an?)\s*hours?\s*(?:from now|from here|later)/);
  if (relativeMatch) {
    const offset = relativeMatch[1] === "a" || relativeMatch[1] === "an" ? 1 : parseInt(relativeMatch[1]);
    hour = (utahHour + offset) % 24;
    // If hour rolls past midnight, also shift the day
    if (utahHour + offset >= 24) {
      const todayIndex = DAY_NAMES.indexOf(utahWeekday);
      const daysAhead = Math.floor((utahHour + offset) / 24);
      const newDayIndex = (todayIndex + daysAhead) % 7;
      day_of_week = DAY_NAMES[newDayIndex].charAt(0).toUpperCase() + DAY_NAMES[newDayIndex].slice(1);
    }
    foundHour = true;
  }
  // Check natural time words
  else if (currentLower.includes("morning")) { hour = 8; foundHour = true; }
  else if (currentLower.includes("afternoon")) { hour = 14; foundHour = true; }
  else if (currentLower.includes("evening")) { hour = 18; foundHour = true; }
  else if (currentLower.includes("night")) { hour = 20; foundHour = true; }
  else if (currentLower.includes("noon") || currentLower.includes("midday")) { hour = 12; foundHour = true; }
  else {
    const hourMatchCurrent = currentLower.match(/\b(\d{1,2})(?::00)?\s*(am|pm)\b/);
    if (hourMatchCurrent) {
      hour = parseInt(hourMatchCurrent[1]);
      if (hourMatchCurrent[2] === "pm" && hour !== 12) hour += 12;
      if (hourMatchCurrent[2] === "am" && hour === 12) hour = 0;
      foundHour = true;
    }
  }

  // Only fall back to history if nothing in current message
  if (!foundHour) {
    for (const msg of [...userMsgs].reverse()) {
      const msgLower = msg.content.toLowerCase();
      const histMatch = msgLower.match(/\b(\d{1,2})(?::00)?\s*(am|pm)\b/);
      if (histMatch) {
        hour = parseInt(histMatch[1]);
        if (histMatch[2] === "pm" && hour !== 12) hour += 12;
        if (histMatch[2] === "am" && hour === 12) hour = 0;
        foundHour = true;
        break;
      }
      if (msgLower.includes("morning")) { hour = 8; foundHour = true; break; }
      if (msgLower.includes("afternoon")) { hour = 14; foundHour = true; break; }
      if (msgLower.includes("evening")) { hour = 18; foundHour = true; break; }
    }
  }

  // If still no time found and it's a trip plan, default to 9 AM (useful ski hour)
  if (!foundHour && (currentLower.includes("trip plan") || currentLower.includes("plan for") || currentLower.includes("plan my"))) {
    hour = 9;
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

  // Weather: only send if user explicitly mentions values.
  // API uses real training data when these are omitted.
  const params: Record<string, unknown> = { hour, day_of_week, month };

  const dayIndex = DAY_MAP[day_of_week.toLowerCase()] ?? 5;
  params.is_weekend = dayIndex >= 5;
  params.is_federal_holiday = allUserText.includes("holiday") || allUserText.includes("federal");

  const tempMatch = allUserText.match(/(\d+)\s*(?:°f|degrees?\s*f)/);
  if (tempMatch) params.temp_f = parseInt(tempMatch[1]);

  const humMatch = allUserText.match(/(\d+)\s*%\s*humidity/);
  if (humMatch) params.humidity_pct = parseInt(humMatch[1]);

  const windMatch = allUserText.match(/(\d+)\s*mph/);
  if (windMatch) params.wind_speed_mph = parseInt(windMatch[1]);

  const snowMatch = allUserText.match(/(\d+)\s*(?:inches?|in\.?)\s*(?:of\s*)?snow/);
  if (snowMatch) params.snow_depth_in = parseInt(snowMatch[1]);

  return params;
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
  const hasTime = /\b\d{1,2}\s*(am|pm)\b/.test(allUserText) || /\bright now\b/.test(allUserText.replace(/snowbasin/g, "")) || allUserText.includes("current");
  const wantsDefaults = /typical|default|usual|average|use (?:lstm|the model)|just predict|go ahead|yes.*(?:use|go)|sure|ok/.test(allUserText);

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
  const modelLabel = "LSTM";

  // Track what was explicitly specified vs defaulted
  const currentLowerCheck = content.toLowerCase();
  const hasExplicitDay = Object.keys(DAY_MAP).some(d => currentLowerCheck.includes(d)) ||
    currentLowerCheck.includes("today") || currentLowerCheck.includes("tomorrow");
  const hasExplicitTime = /\b\d{1,2}\s*(am|pm)\b/.test(currentLowerCheck) ||
    ["morning", "afternoon", "evening", "night", "noon"].some(w => currentLowerCheck.includes(w)) ||
    /\d+\s*hours?\s*(?:from|later)/.test(currentLowerCheck);
  const defaultsUsed: string[] = [];
  if (!hasExplicitDay) defaultsUsed.push(`day defaulted to ${params.day_of_week} (today in Utah)`);
  if (!hasExplicitTime) defaultsUsed.push(`time defaulted to ${params.hour}:00 ${currentLowerCheck.includes("trip plan") || currentLowerCheck.includes("plan for") ? "(typical ski morning)" : "(current Utah time)"}`);


  try {
    const res = await fetch(`${HF_FASTAPI_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, model: "lstm" }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!res.ok) return { text: "", mlRequest: params };
    const data = await res.json();

    // Use the API response's actual input_params (real training data values)
    const actualParams = data.details?.input_params || params;
    const weatherAvailable = actualParams.weather_available !== false && actualParams.temp_f != null;

    let weatherLine: string;
    if (weatherAvailable) {
      weatherLine = `${actualParams.temp_f?.toFixed?.(1) ?? actualParams.temp_f}°F · ${actualParams.snow_depth_in?.toFixed?.(1) ?? actualParams.snow_depth_in}" snow · ${actualParams.humidity_pct?.toFixed?.(0) ?? actualParams.humidity_pct}% humidity · ${actualParams.wind_speed_mph?.toFixed?.(1) ?? actualParams.wind_speed_mph} mph wind`;
      if (actualParams.weather_source) {
        weatherLine += ` (real weather from ${actualParams.weather_source})`;
      }
    } else {
      weatherLine = "weather sensor data not available for this period — prediction based on traffic patterns and time features only";
    }

    // Compute the actual calendar date for the predicted day
    const predDay = actualParams.day_of_week || params.day_of_week;
    const predHour = actualParams.hour || params.hour;
    const predMonth = actualParams.month || params.month;
    const utahNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Denver" }));

    // Build target date: if the user specified a month different from current, find the correct date in that month
    let targetDate: Date;
    const requestedMonth = Number(predMonth); // 1-12
    const currentMonth = utahNow.getMonth() + 1; // 1-12

    if (requestedMonth !== currentMonth) {
      // User asked for a different month — find the matching day-of-week in that month
      const targetDayIndex = DAY_NAMES.indexOf((predDay as string).toLowerCase());
      const jsDay = targetDayIndex === 6 ? 0 : targetDayIndex + 1; // convert Mon=0 to Sun=0 JS format
      let year = utahNow.getFullYear();
      if (requestedMonth < currentMonth) year += 1; // next year if month already passed
      // Find first occurrence of that day-of-week in the requested month
      targetDate = new Date(year, requestedMonth - 1, 1);
      while (targetDate.getDay() !== jsDay) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      // If user specified a specific date number, try to use it
      const userDateMatch = content.match(/\b(\d{1,2})\b/);
      if (userDateMatch) {
        const dayNum = parseInt(userDateMatch[1]);
        if (dayNum >= 1 && dayNum <= 31) {
          const candidate = new Date(year, requestedMonth - 1, dayNum);
          if (candidate.getMonth() === requestedMonth - 1) {
            targetDate = candidate;
          }
        }
      }
    } else {
      // Same month — find the next matching day-of-week from today
      const targetDayIndex = DAY_NAMES.indexOf((predDay as string).toLowerCase());
      const currentDayIndex = utahNow.getDay() === 0 ? 6 : utahNow.getDay() - 1; // Sun=0 → Mon=0
      let daysAhead = targetDayIndex - currentDayIndex;
      if (daysAhead < 0) daysAhead += 7;
      if (daysAhead === 0 && Number(predHour) < utahNow.getHours()) daysAhead = 7;
      targetDate = new Date(utahNow);
      targetDate.setDate(targetDate.getDate() + daysAhead);
    }

    const formattedDate = targetDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const formattedTime = `${Number(predHour) % 12 || 12}:00 ${Number(predHour) >= 12 ? "PM" : "AM"}`;

    let text = `**🤖 ML PREDICTION RESULT**
- **MODEL USED: ${modelLabel}** ← always name this exact model in your response
- **Predicting for: ${formattedDate} at ${formattedTime}** ← YOUR RESPONSE TITLE MUST INCLUDE THIS EXACT DATE AND TIME. Write it as "${formattedDate} at ${formattedTime}" in your header. This applies to ALL responses including trip plans.
- Predicted traffic: ${data.prediction} vehicles/hour
- Conditions: ${predDay} at ${predHour}:00 · ${weatherLine}
- Weekend: ${actualParams.is_weekend ? "Yes" : "No"} · Holiday: ${actualParams.is_federal_holiday ? "Yes" : "No"} · Month: ${predMonth}
- Data source: real historical training data from Trappers Loop traffic sensors (2015-2024)
- Confidence: ${data.confidence}${defaultsUsed.length > 0 ? `\n- Note: ${defaultsUsed.join("; ")}. Make sure to tell the user.` : ""}`;

    // Add RF-specific info
    if (data.details?.date_used) {
      text += `\n- Matched historical date: ${data.details.date_used}`;
      if (data.details.weather_date_used) {
        text += ` (weather from ${data.details.weather_date_used})`;
      }
    }

    // Add LSTM-specific sequence info
    if (data.details?.sequence_used) {
      const seq = data.details.sequence_used;
      text += `\n- LSTM used real 48-hour historical sequence: ${seq.start} to ${seq.end}`;
      text += `\n- Recent traffic in sequence: ${seq.sample_traffic?.join(", ")} vehicles/hr`;
    }
    if (data.details?.forecast_72h) {
      const next6 = data.details.forecast_72h.slice(0, 6);
      text += `\n- Next 6 hours forecast: ${next6.map((h: { hours_ahead: number; prediction: number }) => `+${h.hours_ahead}h=${h.prediction}`).join(", ")}`;
    }

    text += `\n\nInterpret this for the user. IMPORTANT RULES:
1. Your response title/header MUST contain "${formattedDate} at ${formattedTime}" — this is the date and time being predicted. Include BOTH date AND time. Even for trip plans.
2. You MUST say "${modelLabel} model" (not any other model name).
3. Traffic levels: <400/hr = Light, 400-600 = Moderate, 600-800 = Busy, >800 = Very Busy.
4. If weather data was not available, say prediction is based on traffic patterns and time features.`;

    return { text, mlRequest: params, mlResponse: data };
  } catch {
    return { text: "", mlRequest: params };
  }
}

// Route handlers

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { chatId, content, guest, model = "lstm", previousMessages: guestPrevMessages, userCoordinates } = await request.json();

    if (!content) {
      return new Response("Message content is required", { status: 400 });
    }

    if (guest) {
      return handleGuestChat(content, model, guestPrevMessages || [], userCoordinates);
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
      ? ["condition", "road", "closure", "closed", "chain", "traction", "plow", "canyon", "udot", "i-15", "i 15", "i-80", "i 80", "sr-"].some((k) => lower.includes(k))
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

    // Include user's browser geolocation if provided
    const userLocationCtx = userCoordinates
      ? `**USER LOCATION (from browser geolocation):**\nThe user's current position is lat ${userCoordinates.lat}, lng ${userCoordinates.lng}. Use these coordinates as their starting point when giving directions.`
      : "";

    const realTimeData = [userLocationCtx, predictionResult.text, roadData, transitData]
      .filter(Boolean)
      .join("\n\n---\n\n");

    const mapsKeywords = ["direction", "how do i get", "how to get", "route to", "map", "navigate", "from ogden", "from salt lake", "from here", "from my", "my location", "my position"];
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

    // Use the SAME supabase client for saves (created before stream, has valid context)
    const supabaseForSave = supabase;
    const chatIdForSave = currentChatId;
    const isNewChatForSave = isNewChat;
    const contentForTitle = content;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (isNewChatForSave) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chatId: chatIdForSave })}\n\n`)
            );
          }

          // Emit meta so client can show model/source badges + debug data
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ meta: { model: predictionResult.text ? model : undefined, sources, debug } })}\n\n`)
          );

          for await (const chunk of streamChatResponse(messagesForAI, realTimeData, model)) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
            );
          }

          // Save to database — use the pre-created client
          try {
            await supabaseForSave.from("messages").insert({
              chat_id: chatIdForSave,
              role: "assistant",
              content: fullResponse,
            });

            if (isNewChatForSave) {
              const title = await generateChatTitle(contentForTitle);
              await supabaseForSave
                .from("chats")
                .update({ title, updated_at: new Date().toISOString() })
                .eq("id", chatIdForSave);

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ title })}\n\n`)
              );
            } else {
              await supabaseForSave
                .from("chats")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", chatIdForSave);
            }
          } catch (saveError) {
            console.error("Failed to save to database:", saveError);
            // Don't send error to client — the response already streamed successfully
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errMsg = getErrorMessage(error);
          if (!fullResponse) {
            // Only send error if no content was streamed yet
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
            );
          }
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
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) return "🔄 Network error — check your connection and try again.";
  return "Something went wrong. Please try again.";
}

async function handleGuestChat(
  content: string,
  model: string,
  prevMessages: Array<{ role: string; content: string }> = [],
  userCoordinates?: { lat: number; lng: number }
) {
  const messagesForContext = prevMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const isPredictionGuest = hasPredictionIntent(content, messagesForContext);
  const guestLower = content.toLowerCase();
  const guestWantsRoad = isPredictionGuest
    ? ["condition", "road", "closure", "closed", "chain", "traction", "plow", "canyon", "udot", "i-15", "i 15", "i-80", "i 80", "sr-"].some((k) => guestLower.includes(k))
    : true;
  const guestWantsTransit = isPredictionGuest
    ? ["bus", "trax", "train", "transit", "uta", "frontrunner"].some((k) => guestLower.includes(k))
    : true;

  const [transitData, roadData, predictionResult] = await Promise.all([
    guestWantsTransit ? fetchTransitDataIfNeeded(content) : Promise.resolve(""),
    guestWantsRoad ? fetchRoadDataIfNeeded(content) : Promise.resolve(""),
    fetchPredictionIfNeeded(content, model, messagesForContext),
  ]);

  // Include user's browser geolocation if provided
  const guestLocationCtx = userCoordinates
    ? `**USER LOCATION (from browser geolocation):**\nThe user's current position is lat ${userCoordinates.lat}, lng ${userCoordinates.lng}. Use these coordinates as their starting point when giving directions.`
    : "";

  const realTimeData = [guestLocationCtx, predictionResult.text, roadData, transitData]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const mapsKeywordsGuest = ["direction", "how do i get", "how to get", "route to", "map", "navigate", "from ogden", "from salt lake", "from here", "from my", "my location", "my position"];
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

  // Build full message history for AI context
  const allMessages = [...messagesForContext, { role: "user" as const, content }];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ meta: { model: predictionResult.text ? model : undefined, sources: guestSources, debug: guestDebug } })}\n\n`)
        );
        for await (const chunk of streamChatResponse(
          allMessages,
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

// Data fetchers

async function fetchTransitDataIfNeeded(content: string): Promise<string> {
  const transitKeywords = [
    "bus", "trax", "train", "transit", "uta", "frontrunner",
    "stop", "station", "schedule", "arrival", "delay", "alert",
  ];

  if (!transitKeywords.some((k) => content.toLowerCase().includes(k))) return "";

  let transitData = "";
  try {
    const alerts = await getServiceAlerts();
    if (alerts.length > 0) transitData += formatAlertsResponse(alerts);
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
    "i-80", "i-15", "i 80", "i 15", "sr-210", "sr-190", "sr-39", "sr-167",
    "sr 210", "sr 190", "sr 39", "sr 167", "us-189", "us 189",
    "traction", "chain", "restriction", "weather station", "surface temp",
    "udot",
  ];

  if (!roadKeywords.some((k) => content.toLowerCase().includes(k))) return "";

  let roadData = "";
  try {
    const skiCanyonKeywords = [
      "cottonwood", "canyon", "ski", "alta", "snowbird", "brighton", "solitude",
      "park city", "parley", "ogden", "snowbasin", "powder mountain", "provo", "sundance",
      "sr-167", "sr 167", "sr-226", "sr 226", "trappers", "huntsville",
      "sr-39", "sr 39", "sr-210", "sr 210", "sr-190", "sr 190",
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
