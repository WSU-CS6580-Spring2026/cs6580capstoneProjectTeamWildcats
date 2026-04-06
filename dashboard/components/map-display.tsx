"use client";

import { GoogleMap, useJsApiLoader, InfoWindow } from "@react-google-maps/api";
import { useState, useCallback, useEffect, useRef } from "react";
import { MapPin, Loader2, Car, Snowflake, AlertTriangle, ExternalLink } from "lucide-react";

const libraries: ("places" | "marker")[] = ["places", "marker"];

interface Place {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  type?: "location" | "road" | "plow" | "alert" | "weather";
  status?: string;
}

interface MapDisplayProps {
  places: Place[];
  center?: { lat: number; lng: number };
  zoom?: number;
}

// Build a colored map pin SVG for AdvancedMarkerElement
function buildMarkerContent(type?: string, status?: string): HTMLElement {
  const div = document.createElement("div");
  div.style.cursor = "pointer";

  let color = "#EA4335"; // default Google-red
  const size = 36; // bigger so visible at wide zoom

  switch (type) {
    case "road": {
      color = status?.toLowerCase().includes("closed")
        ? "#EF4444"
        : status?.toLowerCase().includes("chain")
        ? "#F97316"
        : status?.toLowerCase().includes("snow")
        ? "#3B82F6"
        : "#22C55E";
      break;
    }
    case "plow":
      color = "#FACC15";
      break;
    case "alert":
      color = "#EF4444";
      break;
    case "weather":
      color = "#06B6D4";
      break;
    default:
      break;
  }

  // Google Maps style pin shape
  div.innerHTML = `<svg width="${size}" height="${size + 12}" viewBox="0 0 27 43" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.5 0C6.044 0 0 6.044 0 13.5C0 24.82 13.5 43 13.5 43S27 24.82 27 13.5C27 6.044 20.956 0 13.5 0Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="13.5" cy="13.5" r="5" fill="#fff"/>
  </svg>`;

  return div;
}

const mapContainerStyle = {
  width: "100%",
  height: "300px",
  borderRadius: "12px",
};

const defaultCenter = { lat: 41.2160, lng: -111.8566 }; // Snowbasin, UT

export function MapDisplay({ places, center, zoom = 12 }: MapDisplayProps) {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  const onMapClick = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  // Stable places key to prevent unnecessary marker recreation
  const placesKey = places.map(p => `${p.name}:${p.lat}:${p.lng}`).join("|");

  // Create markers and fit bounds when map is ready AND places change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || places.length === 0) return;

    // Remove old markers
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];

    // Create new markers
    const bounds = new google.maps.LatLngBounds();
    places.forEach((place) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        content: buildMarkerContent(place.type, place.status),
        gmpClickable: true,
      });

      marker.addEventListener("gmp-click", () => {
        setSelectedPlace(place);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: place.lat, lng: place.lng });
    });

    // Fit map to show all markers
    if (places.length > 1) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    } else {
      map.setCenter({ lat: places[0].lat, lng: places[0].lng });
      map.setZoom(zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, mapReady]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => { m.map = null; });
      markersRef.current = [];
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex h-75 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
        <p className="text-sm text-red-500">Error loading map</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-75 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={zoom}
        onClick={onMapClick}
        onLoad={onMapLoad}
        options={{
          mapId: "DEMO_MAP_ID",
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {selectedPlace && (
          <InfoWindow
            position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
            onCloseClick={() => setSelectedPlace(null)}
          >
            <div className="p-1 min-w-37.5">
              <h3 className="font-semibold text-neutral-900">
                {selectedPlace.name}
              </h3>
              {selectedPlace.address && (
                <p className="mt-1 text-sm text-neutral-600">
                  {selectedPlace.address}
                </p>
              )}
              {selectedPlace.status && (
                <p
                  className={`mt-1 text-sm font-medium ${
                    selectedPlace.status.toLowerCase().includes("closed")
                      ? "text-red-600"
                      : selectedPlace.status.toLowerCase().includes("chain")
                      ? "text-orange-600"
                      : selectedPlace.status.toLowerCase().includes("snow")
                      ? "text-blue-600"
                      : "text-green-600"
                  }`}
                >
                  {selectedPlace.status}
                </p>
              )}
              {selectedPlace.type && selectedPlace.type !== "location" && (
                <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                  {selectedPlace.type === "road"
                    ? "Road Condition"
                    : selectedPlace.type === "plow"
                    ? "Snow Plow"
                    : selectedPlace.type === "alert"
                    ? "Alert"
                    : selectedPlace.type === "weather"
                    ? "Weather Station"
                    : selectedPlace.type}
                </span>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.lat},${selectedPlace.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Get Directions in Google Maps ↗
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Places list */}
      {places.length > 0 && (
        <div className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {places.length} location{places.length > 1 ? "s" : ""} shown
            </p>
            <a
              href={places.length >= 2
                ? `https://www.google.com/maps/dir/?api=1&origin=${places[0].lat},${places[0].lng}&destination=${places[places.length - 1].lat},${places[places.length - 1].lng}`
                : `https://www.google.com/maps/search/?api=1&query=${places[0].lat},${places[0].lng}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Get Directions in Google Maps
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {places.map((place, index) => {
              const IconComponent =
                place.type === "road"
                  ? Car
                  : place.type === "plow"
                  ? Snowflake
                  : place.type === "alert"
                  ? AlertTriangle
                  : MapPin;
              const iconColor =
                place.type === "road"
                  ? place.status?.toLowerCase().includes("closed")
                    ? "text-red-500"
                    : place.status?.toLowerCase().includes("chain")
                    ? "text-orange-500"
                    : "text-green-500"
                  : place.type === "plow"
                  ? "text-yellow-500"
                  : place.type === "alert"
                  ? "text-red-500"
                  : "text-blue-500";

              return (
                <button
                  key={index}
                  onClick={() => setSelectedPlace(place)}
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm transition-colors hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600"
                >
                  <IconComponent
                    className={`h-3.5 w-3.5 ${iconColor}`}
                  />
                  <span className="max-w-32 truncate">{place.name}</span>
                  {place.status && (
                    <span
                      className={`text-xs ${
                        place.status.toLowerCase().includes("closed")
                          ? "text-red-600"
                          : place.status.toLowerCase().includes("chain")
                          ? "text-orange-600"
                          : "text-green-600"
                      }`}
                    >
                      •{" "}
                      {place.status.length > 15
                        ? place.status.slice(0, 15) + "..."
                        : place.status}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to parse places from AI response
export function parsePlacesFromContent(content: string): Place[] | null {
  // Look for JSON block with places data
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      if (data.places && Array.isArray(data.places)) {
        return data.places.map(validatePlace).filter(Boolean) as Place[];
      }
    } catch {
      // Not valid JSON
    }
  }

  // Look for MAP_DATA marker
  const mapDataMatch = content.match(/\[MAP_DATA\]([\s\S]*?)\[\/MAP_DATA\]/);
  if (mapDataMatch) {
    try {
      const data = JSON.parse(mapDataMatch[1]);
      if (Array.isArray(data)) {
        return data.map(validatePlace).filter(Boolean) as Place[];
      }
      if (data.places && Array.isArray(data.places)) {
        return data.places.map(validatePlace).filter(Boolean) as Place[];
      }
    } catch {
      // Not valid JSON
    }
  }

  return null;
}

// Validate and normalize place data
function validatePlace(place: unknown): Place | null {
  if (!place || typeof place !== "object") return null;
  const p = place as Record<string, unknown>;

  if (
    typeof p.name !== "string" ||
    typeof p.lat !== "number" ||
    typeof p.lng !== "number"
  ) {
    return null;
  }

  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    address: typeof p.address === "string" ? p.address : undefined,
    type:
      typeof p.type === "string" ? (p.type as Place["type"]) : "location",
    status: typeof p.status === "string" ? p.status : undefined,
  };
}

// Remove map data markers from displayed content
export function cleanMapDataFromContent(content: string): string {
  return content
    .replace(/```json\s*\{[\s\S]*?"places"[\s\S]*?\}\s*```/g, "")
    .replace(/\[MAP_DATA\][\s\S]*?\[\/MAP_DATA\]/g, "")
    .trim();
}
