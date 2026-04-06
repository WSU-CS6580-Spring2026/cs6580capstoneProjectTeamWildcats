/**
 * UDOT (Utah Department of Transportation) API Integration
 * Provides real-time road conditions, weather stations, and ski canyon data
 *
 * API Documentation: https://prod-ut.ibi511.com/developers/doc
 * Base URL: https://www.udottraffic.utah.gov/api/v2/get
 */

const UDOT_API_KEY = process.env.UDOT_API_KEY || "";
const UDOT_BASE_URL = "https://www.udottraffic.utah.gov/api/v2/get";

export interface RoadCondition {
  roadName: string;
  location: string;
  description: string;
  travelRestriction?: string;
  surfaceCondition?: string;
  lastUpdated: string;
}

export interface MountainPass {
  name: string;
  elevation: number;
  roadStatus: string;
  travelRestriction?: string;
  surfaceTemp?: number;
  airTemp?: number;
  windSpeed?: number;
  conditions?: string;
  lastUpdated: string;
}

export interface Alert {
  roadName: string;
  description: string;
  severity: string;
  startTime: string;
  endTime?: string;
  location: string;
}

export interface SnowPlow {
  plowId: string;
  roadName: string;
  direction: string;
  speed: number;
  latitude: number;
  longitude: number;
  lastReport: string;
  status: string;
}

export interface WeatherStation {
  stationName: string;
  location: string;
  airTemp?: number;
  surfaceTemp?: number;
  windSpeed?: number;
  windGust?: number;
  precipitation?: number;
  snowDepth?: number;
  visibility?: number;
  lastUpdated: string;
}

export interface TrafficCamera {
  id: string;
  roadway: string;
  direction: string;
  location: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  description?: string;
}

export interface SkiCanyonData {
  passes: MountainPass[];
  conditions: RoadCondition[];
  alerts: Alert[];
  plows: SnowPlow[];
}

/**
 * Fetch road conditions from UDOT
 */
export async function getRoadConditions(): Promise<RoadCondition[]> {
  try {
    const response = await fetch(
      `${UDOT_BASE_URL}/roadconditions?key=${UDOT_API_KEY}&format=json`,
      {
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      console.error("UDOT API error:", response.status);
      return [];
    }

    const data = await response.json();
    return parseRoadConditions(data);
  } catch (error) {
    console.error("Error fetching UDOT road conditions:", error);
    return [];
  }
}

/**
 * Fetch weather station data from UDOT
 */
export async function getWeatherStations(): Promise<WeatherStation[]> {
  try {
    const response = await fetch(
      `${UDOT_BASE_URL}/weatherstations?key=${UDOT_API_KEY}&format=json`,
      {
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      console.error("UDOT Weather API error:", response.status);
      return [];
    }

    const data = await response.json();
    return parseWeatherStations(data);
  } catch (error) {
    console.error("Error fetching UDOT weather stations:", error);
    return [];
  }
}

/**
 * Fetch ski canyon conditions (Little/Big Cottonwood, Ogden, Provo, etc.)
 */
export async function getSkiCanyonConditions(): Promise<SkiCanyonData> {
  try {
    const [mountainPasses, roadConditions, weatherStations, alerts, plows] = await Promise.all([
      getMountainPasses(),
      getRoadConditions(),
      getWeatherStations(),
      getAlerts(),
      getSnowPlows(),
    ]);

    // Filter for ski canyon areas
    const skiCanyonKeywords = [
      "cottonwood",
      "parley",
      "ogden",
      "provo",
      "sr-210",
      "sr-190",
      "sr-39",
      "sr-167",
      "sr-226",
      "us-189",
      "snowbasin",
      "trappers",
      "huntsville",
      "mountain green",
      "alta",
      "snowbird",
      "brighton",
      "solitude",
      "park city",
      "deer valley",
    ];

    const filterByCanyons = (item: any) => {
      const searchText = (item.roadName || item.location || item.name || item.stationName || "").toLowerCase();
      return skiCanyonKeywords.some((keyword) => searchText.includes(keyword));
    };

    return {
      passes: mountainPasses.filter(filterByCanyons),
      conditions: roadConditions.filter(filterByCanyons),
      alerts: alerts.filter(filterByCanyons),
      plows: plows.filter(filterByCanyons),
    };
  } catch (error) {
    console.error("Error fetching ski canyon conditions:", error);
    return { passes: [], conditions: [], alerts: [], plows: [] };
  }
}

/**
 * Fetch traffic alerts/events from UDOT
 */
async function getAlerts(): Promise<Alert[]> {
  try {
    const response = await fetch(
      `${UDOT_BASE_URL}/event?key=${UDOT_API_KEY}&format=json`,
      {
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      console.error("UDOT Alerts API error:", response.status);
      return [];
    }

    const data = await response.json();
    return parseAlerts(data);
  } catch (error) {
    console.error("Error fetching UDOT alerts:", error);
    return [];
  }
}

/**
 * Fetch mountain pass conditions from UDOT
 */
async function getMountainPasses(): Promise<MountainPass[]> {
  try {
    const response = await fetch(
      `${UDOT_BASE_URL}/mountainpasses?key=${UDOT_API_KEY}&format=json`,
      {
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      console.error("UDOT Mountain Passes API error:", response.status);
      return [];
    }

    const data = await response.json();
    return parseMountainPasses(data);
  } catch (error) {
    console.error("Error fetching UDOT mountain passes:", error);
    return [];
  }
}

/**
 * Fetch snow plow locations from UDOT
 * Note: Check UDOT API docs for snow plow endpoint availability
 */
async function getSnowPlows(): Promise<SnowPlow[]> {
  try {
    const response = await fetch(
      `${UDOT_BASE_URL}/servicevehicles?key=${UDOT_API_KEY}&format=json`,
      {
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 60 }, // Cache for 1 minute (more frequent updates)
      }
    );

    if (!response.ok) {
      console.error("UDOT Plows API error:", response.status);
      return [];
    }

    const data = await response.json();
    return parseSnowPlows(data);
  } catch (error) {
    console.error("Error fetching UDOT snow plows:", error);
    return [];
  }
}

/**
 * Parse road conditions from UDOT API response
 * API Response: { Id, SourceId, RoadCondition, WeatherCondition, Restriction, RoadwayName, EncodedPolyline, LastUpdated }
 */
function parseRoadConditions(data: any): RoadCondition[] {
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    roadName: item.RoadwayName || "Unknown Road",
    location: item.SourceId || "",
    description: `${item.RoadCondition || "Unknown"} - ${item.WeatherCondition || "Unknown weather"}`,
    travelRestriction: item.Restriction || undefined,
    surfaceCondition: item.RoadCondition || undefined,
    lastUpdated: item.LastUpdated ? new Date(item.LastUpdated * 1000).toISOString() : new Date().toISOString(),
  }));
}

/**
 * Parse weather stations from UDOT API response
 * API Response: { Id, Latitude, Longitude, StationName, AirTemperature, SurfaceTemp, SubSurfaceTemp,
 *                 SurfaceStatus, RelativeHumidity, DewpointTemp, Precipitation, WindSpeedAvg,
 *                 WindSpeedGust, WindDirection, Source, LastUpdated }
 */
function parseWeatherStations(data: any): WeatherStation[] {
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    stationName: item.StationName || "Unknown Station",
    location: `${item.Latitude?.toFixed(4)}, ${item.Longitude?.toFixed(4)}`,
    airTemp: item.AirTemperature ? parseFloat(item.AirTemperature) : undefined,
    surfaceTemp: item.SurfaceTemp ? parseFloat(item.SurfaceTemp) : undefined,
    windSpeed: item.WindSpeedAvg ? parseFloat(item.WindSpeedAvg) : undefined,
    windGust: item.WindSpeedGust ? parseFloat(item.WindSpeedGust) : undefined,
    precipitation: item.Precipitation || undefined,
    snowDepth: undefined, // Not in API response
    visibility: undefined, // Not in standard weather station response
    lastUpdated: item.LastUpdated ? new Date(item.LastUpdated * 1000).toISOString() : new Date().toISOString(),
  }));
}

/**
 * Parse alerts/events from UDOT API response
 * API Response: { ID, SourceId, Organization, RoadwayName, DirectionOfTravel, Description,
 *                 Reported, LastUpdated, StartDate, PlannedEndDate, LanesAffected, Latitude,
 *                 Longitude, EventType, EventSubType, IsFullClosure, Severity, Comment, etc. }
 */
function parseAlerts(data: any): Alert[] {
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    roadName: item.RoadwayName || "Unknown Road",
    description: item.Description || item.Comment || "No description",
    severity: item.Severity || item.EventType || "medium",
    startTime: item.StartDate ? new Date(item.StartDate * 1000).toISOString() : new Date().toISOString(),
    endTime: item.PlannedEndDate ? new Date(item.PlannedEndDate * 1000).toISOString() : undefined,
    location: item.Location || `${item.Latitude?.toFixed(4)}, ${item.Longitude?.toFixed(4)}`,
  }));
}

/**
 * Parse mountain passes from UDOT API response
 * API Response: { Id, Latitude, Longitude, Name, Roadway, MaxElevation, MountainPassId, Forecasts,
 *                 WtaSourceId, CameraId, SeasonalRouteName, SeasonalClosureTitle, SeasonalInfo,
 *                 StationName, AirTemperature, WindDirection, WindSpeed, WindGust, SurfaceTemp,
 *                 SurfaceStatus, Visibility }
 */
function parseMountainPasses(data: any): MountainPass[] {
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    name: item.Name || "Unknown Pass",
    elevation: item.MaxElevation ? parseInt(item.MaxElevation) : 0,
    roadStatus: item.SeasonalClosureTitle || item.SurfaceStatus || "Unknown",
    travelRestriction: item.SeasonalInfo?.[0]?.SeasonalClosureDescription,
    surfaceTemp: item.SurfaceTemp ? parseFloat(item.SurfaceTemp) : undefined,
    airTemp: item.AirTemperature ? parseFloat(item.AirTemperature) : undefined,
    windSpeed: item.WindSpeed ? parseFloat(item.WindSpeed) : undefined,
    conditions: item.SurfaceStatus || undefined,
    lastUpdated: new Date().toISOString(), // API doesn't provide LastUpdated for passes
  }));
}

/**
 * Parse snow plows from UDOT API response
 */
function parseSnowPlows(data: any): SnowPlow[] {
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    plowId: String(item.Id || item.id || item.plowId || "unknown"),
    roadName: item.Name || item.roadName || item.route || "Service Vehicle",
    direction: item.Bearing || item.direction || "N/A",
    speed: item.speed || 0,
    latitude: item.Latitude || item.latitude || item.lat || 0,
    longitude: item.Longitude || item.longitude || item.lon || 0,
    lastReport: item.LastUpdated
      ? new Date(item.LastUpdated * 1000).toISOString()
      : item.lastReport || new Date().toISOString(),
    status: item.status || "active",
  }));
}


/**
 * Fetch traffic cameras from UDOT, filtered to Snowbasin / Ogden area
 */
export async function getTrafficCameras(): Promise<TrafficCamera[]> {
  try {
    const response = await fetch(
      `${UDOT_BASE_URL}/cameras?key=${UDOT_API_KEY}&format=json`,
      {
        headers: { "Accept": "application/json" },
        next: { revalidate: 60 }, // Cache 1 min — images update frequently
      }
    );

    if (!response.ok) {
      console.error("UDOT Cameras API error:", response.status);
      return [];
    }

    const data = await response.json();
    return parseCameras(data);
  } catch (error) {
    console.error("Error fetching UDOT cameras:", error);
    return [];
  }
}

function parseCameras(data: any): TrafficCamera[] {
  if (!Array.isArray(data)) return [];

  const canyonKeywords = [
    "snowbasin", "ogden", "trappers", "huntsville", "mountain green",
    "sr-226", "sr-167", "i-84", "12th street", "harrison",
    "weber canyon", "north ogden", "eden",
  ];

  const cameras: TrafficCamera[] = [];

  for (const item of data) {
    const searchText = `${item.Roadway || ""} ${item.Location || ""} ${item.Direction || ""}`.toLowerCase();
    const isRelevant = canyonKeywords.some(k => searchText.includes(k));
    if (!isRelevant) continue;

    const views = item.Views;
    if (!Array.isArray(views) || views.length === 0) continue;

    // Use the first enabled view
    const view = views.find((v: any) => v.Status === "Enabled") || views[0];
    if (!view) continue;

    // UDOT camera image URL format: /map/Cctv/{ViewId}
    const viewId = view.Id || view.ViewId;
    const imageUrl = view.Url || (viewId ? `https://www.udottraffic.utah.gov/map/Cctv/${viewId}` : null);
    if (!imageUrl) continue;

    cameras.push({
      id: String(item.Id || viewId),
      roadway: item.Roadway || "Unknown",
      direction: item.Direction || "",
      location: item.Location || "",
      latitude: item.Latitude || 0,
      longitude: item.Longitude || 0,
      imageUrl,
      description: view.Description || undefined,
    });
  }

  return cameras;
}

/**
 * Format road conditions for display
 */
export function formatRoadConditionsResponse(conditions: RoadCondition[]): string {
  if (conditions.length === 0) return "";

  let response = "**Road Conditions:**\n";
  conditions.slice(0, 10).forEach((condition) => {
    response += `\n**${condition.roadName}** ${condition.location ? `(${condition.location})` : ""}\n`;
    response += `- Conditions: ${condition.description}\n`;
    if (condition.travelRestriction) {
      response += `- ⚠️ Restrictions: ${condition.travelRestriction}\n`;
    }
    if (condition.surfaceCondition) {
      response += `- Surface: ${condition.surfaceCondition}\n`;
    }
  });
  return response;
}

/**
 * Format mountain passes for display
 */
export function formatMountainPassesResponse(passes: MountainPass[]): string {
  if (passes.length === 0) return "";

  let response = "**Mountain Passes & Canyons:**\n";
  passes.forEach((pass) => {
    response += `\n**${pass.name}**\n`;
    response += `- Status: ${pass.roadStatus}\n`;
    if (pass.travelRestriction) {
      response += `- ⚠️ ${pass.travelRestriction}\n`;
    }
    if (pass.surfaceTemp !== undefined) {
      response += `- Surface Temp: ${pass.surfaceTemp}°F\n`;
    }
    if (pass.airTemp !== undefined) {
      response += `- Air Temp: ${pass.airTemp}°F\n`;
    }
    if (pass.conditions) {
      response += `- Conditions: ${pass.conditions}\n`;
    }
  });
  return response;
}

/**
 * Format alerts for display
 */
export function formatAlertsResponse(alerts: Alert[]): string {
  if (alerts.length === 0) return "";

  let response = "**⚠️ Traffic Alerts:**\n";
  alerts.forEach((alert) => {
    const severity = alert.severity.toUpperCase();
    response += `\n**${severity}**: ${alert.roadName}\n`;
    response += `- ${alert.description}\n`;
    if (alert.location) {
      response += `- Location: ${alert.location}\n`;
    }
  });
  return response;
}

/**
 * Format snow plows for display
 */
export function formatSnowPlowsResponse(plows: SnowPlow[]): string {
  if (plows.length === 0) return "";

  let response = "**🚜 Active Snow Plows:**\n";
  plows.slice(0, 5).forEach((plow) => {
    response += `\n- ${plow.roadName} (${plow.direction})\n`;
    response += `  Speed: ${plow.speed} mph\n`;
  });
  return response;
}

/**
 * Format weather stations for display
 */
export function formatWeatherStationsResponse(stations: WeatherStation[]): string {
  if (stations.length === 0) return "";

  let response = "**🌡️ Weather Stations:**\n";
  stations.forEach((station) => {
    response += `\n**${station.stationName}** ${station.location ? `(${station.location})` : ""}\n`;
    if (station.airTemp !== undefined) {
      response += `- Air Temp: ${station.airTemp}°F\n`;
    }
    if (station.surfaceTemp !== undefined) {
      response += `- Surface Temp: ${station.surfaceTemp}°F\n`;
    }
    if (station.windSpeed !== undefined) {
      response += `- Wind: ${station.windSpeed} mph`;
      if (station.windGust !== undefined) {
        response += ` (gusts ${station.windGust} mph)`;
      }
      response += `\n`;
    }
    if (station.snowDepth !== undefined) {
      response += `- Snow Depth: ${station.snowDepth}"\n`;
    }
    if (station.visibility !== undefined) {
      response += `- Visibility: ${station.visibility} mi\n`;
    }
  });
  return response;
}
