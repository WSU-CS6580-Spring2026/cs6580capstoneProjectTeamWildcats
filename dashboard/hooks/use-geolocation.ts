"use client";

import { useState, useCallback, useRef } from "react";

interface GeolocationPosition {
  lat: number;
  lng: number;
}

interface UseGeolocationReturn {
  position: GeolocationPosition | null;
  error: string | null;
  loading: boolean;
  requestPosition: () => Promise<GeolocationPosition>;
}

// Default fallback: Ogden, UT area
const DEFAULT_POSITION: GeolocationPosition = {
  lat: 41.223,
  lng: -111.9738,
};

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cachedRef = useRef<GeolocationPosition | null>(null);

  const requestPosition = useCallback((): Promise<GeolocationPosition> => {
    // Return cached position if available
    if (cachedRef.current) {
      setPosition(cachedRef.current);
      return Promise.resolve(cachedRef.current);
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setPosition(DEFAULT_POSITION);
      return Promise.resolve(DEFAULT_POSITION);
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: GeolocationPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          cachedRef.current = coords;
          setPosition(coords);
          setLoading(false);
          resolve(coords);
        },
        (err) => {
          let errorMessage: string;
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = "Location permission denied";
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable";
              break;
            case err.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
            default:
              errorMessage = "An unknown error occurred";
              break;
          }
          setError(errorMessage);
          setPosition(DEFAULT_POSITION);
          setLoading(false);
          resolve(DEFAULT_POSITION);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    });
  }, []);

  return { position, error, loading, requestPosition };
}

// Check if user message mentions their location / directions
export function mentionsUserLocation(content: string): boolean {
  const lower = content.toLowerCase();
  const locationPhrases = [
    "my position",
    "my location",
    "my current location",
    "from here",
    "from my",
    "from where i am",
    "where i am",
    "current position",
    "near me",
    "closest to me",
    "from me",
  ];
  return locationPhrases.some((phrase) => lower.includes(phrase));
}

export { DEFAULT_POSITION };
export type { GeolocationPosition };
