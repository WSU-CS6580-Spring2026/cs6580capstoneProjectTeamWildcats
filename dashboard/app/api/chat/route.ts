import { createClient } from "@/lib/supabase/server";
import { streamChatResponse, generateChatTitle } from "@/lib/claude";
import {
  getServiceAlerts,
  getStopArrivals,
  formatAlertsResponse,
  POPULAR_STOPS,
} from "@/lib/uta";
// UDOT integration - commented out for now
// import {
//   getSkiCanyonConditions,
//   getRoadConditions,
//   getWeatherStations,
//   formatRoadConditionsResponse,
//   formatMountainPassesResponse,
//   formatAlertsResponse as formatUDOTAlertsResponse,
//   formatSnowPlowsResponse,
//   formatWeatherStationsResponse,
// } from "@/lib/udot";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { chatId, content, guest } = await request.json();

    if (!content) {
      return new Response("Message content is required", { status: 400 });
    }

    // Guest mode - just stream response without saving
    if (guest) {
      return handleGuestChat(content);
    }

    // Authenticated mode - require user
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    let currentChatId = chatId;
    let isNewChat = false;

    // Create new chat if no chatId provided
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

    // Save user message
    const { error: userMsgError } = await supabase
      .from("messages")
      .insert({
        chat_id: currentChatId,
        role: "user",
        content,
      });

    if (userMsgError) throw userMsgError;

    // Get all messages for context
    const { data: previousMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", currentChatId)
      .order("created_at", { ascending: true });

    const messagesForAI = (previousMessages || []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Check if the message is about transit and fetch real-time data
    const transitData = await fetchTransitDataIfNeeded(content);
    // UDOT road data - commented out for now
    // const roadData = await fetchRoadDataIfNeeded(content);
    const realTimeData = transitData || "";

    // Create streaming response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send chatId first if it's a new chat
          if (isNewChat) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chatId: currentChatId })}\n\n`)
            );
          }

          // Stream the AI response with real-time data if available
          for await (const chunk of streamChatResponse(messagesForAI, realTimeData)) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
            );
          }

          // Save assistant message
          await supabase
            .from("messages")
            .insert({
              chat_id: currentChatId,
              role: "assistant",
              content: fullResponse,
            });

          // Generate title for new chats
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
            // Update chat timestamp
            await supabase
              .from("chats")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", currentChatId);
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`)
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

async function handleGuestChat(content: string) {
  const transitData = await fetchTransitDataIfNeeded(content);
  // UDOT road data - commented out for now
  // const roadData = await fetchRoadDataIfNeeded(content);
  const realTimeData = transitData || "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messagesForAI = [{ role: "user" as const, content }];

        for await (const chunk of streamChatResponse(messagesForAI, realTimeData)) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Guest stream error:", error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`)
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

async function fetchTransitDataIfNeeded(content: string): Promise<string> {
  const transitKeywords = [
    "bus", "trax", "train", "transit", "uta", "frontrunner",
    "stop", "station", "route", "schedule", "arrival", "delay", "alert"
  ];

  const isTransitQuery = transitKeywords.some((keyword) =>
    content.toLowerCase().includes(keyword)
  );

  if (!isTransitQuery) return "";

  let transitData = "";
  try {
    // Fetch service alerts
    const alerts = await getServiceAlerts();
    if (alerts.length > 0) {
      transitData += formatAlertsResponse(alerts) + "\n\n";
    }

    // Fetch arrivals for popular stops
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

// UDOT road data function - commented out for now
// async function fetchRoadDataIfNeeded(content: string): Promise<string> {
//   const roadKeywords = [
//     "road", "highway", "canyon", "pass", "drive", "driving", "conditions",
//     "snow plow", "snowplow", "plow", "closure", "closed", "open",
//     "cottonwood", "parley", "provo canyon", "ogden canyon",
//     "ski", "skiing", "resort", "alta", "snowbird", "brighton", "solitude",
//     "park city", "deer valley", "sundance", "powder mountain", "snowbasin",
//     "i-80", "i-15", "sr-210", "sr-190", "sr-39", "us-189",
//     "traction", "chain", "restriction", "weather station", "surface temp"
//   ];
//
//   const isRoadQuery = roadKeywords.some((keyword) =>
//     content.toLowerCase().includes(keyword)
//   );
//
//   if (!isRoadQuery) return "";
//
//   let roadData = "";
//   try {
//     const skiCanyonKeywords = [
//       "cottonwood", "canyon", "ski", "alta", "snowbird", "brighton", "solitude",
//       "park city", "parley", "ogden", "snowbasin", "powder mountain", "provo", "sundance"
//     ];
//     const isSkiCanyonQuery = skiCanyonKeywords.some((keyword) =>
//       content.toLowerCase().includes(keyword)
//     );
//
//     if (isSkiCanyonQuery) {
//       const canyonData = await getSkiCanyonConditions();
//       roadData += "\n**UDOT REAL-TIME SKI CANYON DATA:**\n\n";
//       if (canyonData.passes.length > 0) {
//         roadData += formatMountainPassesResponse(canyonData.passes) + "\n";
//       }
//       if (canyonData.conditions.length > 0) {
//         roadData += formatRoadConditionsResponse(canyonData.conditions) + "\n";
//       }
//       if (canyonData.alerts.length > 0) {
//         roadData += formatUDOTAlertsResponse(canyonData.alerts) + "\n";
//       }
//       if (canyonData.plows.length > 0) {
//         roadData += formatSnowPlowsResponse(canyonData.plows) + "\n";
//       }
//     } else {
//       const [conditions, weatherStations] = await Promise.all([
//         getRoadConditions(),
//         getWeatherStations(),
//       ]);
//       roadData += "\n**UDOT REAL-TIME ROAD DATA:**\n\n";
//       if (conditions.length > 0) {
//         roadData += formatRoadConditionsResponse(conditions.slice(0, 10)) + "\n";
//       }
//       if (weatherStations.length > 0) {
//         roadData += formatWeatherStationsResponse(weatherStations.slice(0, 5)) + "\n";
//       }
//     }
//   } catch (error) {
//     console.error("Error fetching road data:", error);
//   }
//   return roadData;
// }
