"use client";

import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { useState, useCallback } from "react";
import { MapPin, Loader2, Car, Snowflake, AlertTriangle } from "lucide-react";

const libraries: ("places")[] = ["places"];

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

// Custom marker icons based on type
const getMarkerIcon = (type?: string, status?: string): google.maps.Icon | google.maps.Symbol | undefined => {
  if (typeof window === "undefined" || !window.google) return undefined;

  const baseScale = 8;

  switch (type) {
    case "road":
      // Road condition marker - color based on status
      const roadColor = status?.toLowerCase().includes("closed") ? "#EF4444" : // red
                       status?.toLowerCase().includes("chain") ? "#F97316" : // orange
                       status?.toLowerCase().includes("snow") ? "#3B82F6" : // blue
                       "#22C55E"; // green for clear
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: baseScale,
        fillColor: roadColor,
        fillOpacity: 0.9,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      };
    case "plow":
      // Snow plow marker - yellow
      return {
        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: baseScale,
        fillColor: "#FACC15",
        fillOpacity: 0.9,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      };
    case "alert":
      // Alert marker - red triangle
      return {
        path: "M 0,-8 L 7,6 L -7,6 Z",
        scale: 1.2,
        fillColor: "#EF4444",
        fillOpacity: 0.9,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      };
    case "weather":
      // Weather station - blue
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: baseScale,
        fillColor: "#06B6D4",
        fillOpacity: 0.9,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      };
    default:
      return undefined; // Use default Google marker
  }
};

const mapContainerStyle = {
  width: "100%",
  height: "300px",
  borderRadius: "12px",
};

const defaultCenter = { lat: 40.7128, lng: -74.006 }; // NYC default

export function MapDisplay({ places, center, zoom = 12 }: MapDisplayProps) {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const mapCenter = center || (places.length > 0 ? { lat: places[0].lat, lng: places[0].lng } : defaultCenter);

  const onMapClick = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  if (loadError) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
        <p className="text-sm text-red-500">Error loading map</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={zoom}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {places.map((place, index) => (
          <Marker
            key={index}
            position={{ lat: place.lat, lng: place.lng }}
            onClick={() => setSelectedPlace(place)}
            title={place.name}
            icon={getMarkerIcon(place.type, place.status)}
          />
        ))}

        {selectedPlace && (
          <InfoWindow
            position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
            onCloseClick={() => setSelectedPlace(null)}
          >
            <div className="p-1 min-w-[150px]">
              <h3 className="font-semibold text-neutral-900">{selectedPlace.name}</h3>
              {selectedPlace.address && (
                <p className="mt-1 text-sm text-neutral-600">{selectedPlace.address}</p>
              )}
              {selectedPlace.status && (
                <p className={`mt-1 text-sm font-medium ${
                  selectedPlace.status.toLowerCase().includes("closed") ? "text-red-600" :
                  selectedPlace.status.toLowerCase().includes("chain") ? "text-orange-600" :
                  selectedPlace.status.toLowerCase().includes("snow") ? "text-blue-600" :
                  "text-green-600"
                }`}>
                  {selectedPlace.status}
                </p>
              )}
              {selectedPlace.type && selectedPlace.type !== "location" && (
                <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                  {selectedPlace.type === "road" ? "Road Condition" :
                   selectedPlace.type === "plow" ? "Snow Plow" :
                   selectedPlace.type === "alert" ? "Alert" :
                   selectedPlace.type === "weather" ? "Weather Station" :
                   selectedPlace.type}
                </span>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Places list */}
      {places.length > 0 && (
        <div className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
          <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {places.length} location{places.length > 1 ? "s" : ""} shown
          </p>
          <div className="flex flex-wrap gap-2">
            {places.map((place, index) => {
              const IconComponent = place.type === "road" ? Car :
                                   place.type === "plow" ? Snowflake :
                                   place.type === "alert" ? AlertTriangle :
                                   MapPin;
              const iconColor = place.type === "road" ? (
                                  place.status?.toLowerCase().includes("closed") ? "text-red-500" :
                                  place.status?.toLowerCase().includes("chain") ? "text-orange-500" :
                                  "text-green-500"
                                ) :
                               place.type === "plow" ? "text-yellow-500" :
                               place.type === "alert" ? "text-red-500" :
                               "text-blue-500";

              return (
                <button
                  key={index}
                  onClick={() => setSelectedPlace(place)}
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm transition-colors hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600"
                >
                  <IconComponent className={`h-3.5 w-3.5 ${iconColor}`} />
                  <span className="max-w-32 truncate">{place.name}</span>
                  {place.status && (
                    <span className={`text-xs ${
                      place.status.toLowerCase().includes("closed") ? "text-red-600" :
                      place.status.toLowerCase().includes("chain") ? "text-orange-600" :
                      "text-green-600"
                    }`}>
                      • {place.status.length > 15 ? place.status.slice(0, 15) + "..." : place.status}
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

  if (typeof p.name !== "string" || typeof p.lat !== "number" || typeof p.lng !== "number") {
    return null;
  }

  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    address: typeof p.address === "string" ? p.address : undefined,
    type: typeof p.type === "string" ? p.type as Place["type"] : "location",
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
