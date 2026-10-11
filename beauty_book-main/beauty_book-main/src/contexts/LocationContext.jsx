import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import apiClient from "@/lib/apiClient";

const LOCATION_KEY = "bb_user_location";
const TRACKING_KEY = "bb_location_tracking";
const CITY_KEY = "bb_user_city";

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterByRadius(items, userLat, userLng, radiusKm = 100) {
  return items
    .map((item) => {
      const lat = item.latitude || item.lat || item._lat;
      const lng = item.longitude || item.lng || item._lng;
      if (lat && lng) {
        return { ...item, _distance: haversineDistance(userLat, userLng, lat, lng) };
      }
      return { ...item, _distance: Infinity };
    })
    .filter((item) => item._distance <= radiusKm)
    .sort((a, b) => a._distance - b._distance);
}

function sortByDistance(items, userLat, userLng) {
  return items
    .map((item) => {
      const lat = item.latitude || item.lat || item._lat;
      const lng = item.longitude || item.lng || item._lng;
      if (lat && lng) {
        return { ...item, _distance: haversineDistance(userLat, userLng, lat, lng) };
      }
      return { ...item, _distance: Infinity };
    })
    .sort((a, b) => a._distance - b._distance);
}

async function fallbackReverseGeocode(latitude, longitude) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${encodeURIComponent(longitude)}&lat=${encodeURIComponent(latitude)}`, {
      headers: { "Accept-Language": "fr" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Fallback geocoder returned ${response.status}`);
    const properties = (await response.json())?.features?.[0]?.properties || {};
    const city = properties.city || properties.municipality || "";
    return city ? { city, country: "FR" } : null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LOCATION_KEY) || "null");
      return stored;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tracking, setTracking] = useState(() => {
    try { return localStorage.getItem(TRACKING_KEY) === "1"; } catch { return false; }
  });
  const watchIdRef = useRef(null);
  const lastGeocodedRef = useRef(null);
  const reverseInFlightRef = useRef(false);
  const reverseCooldownUntilRef = useRef(0);
  const requestedRef = useRef(false);

  const publishCity = useCallback((city, country, latitude, longitude) => {
    if (!city) return;
    const normalizedCountry = String(country || "").toUpperCase() === "FR" ? "France" : country;
    const label = normalizedCountry ? `${city}, ${normalizedCountry}` : city;
    try { localStorage.setItem(CITY_KEY, label); } catch {}
    window.dispatchEvent(new CustomEvent("bb-location-change", {
      detail: { city: label, country: normalizedCountry || "", latitude, longitude, source: "gps" },
    }));
  }, []);

  const reverseGeocode = useCallback(async (latitude, longitude) => {
    if (reverseInFlightRef.current) return;
    if (Date.now() < reverseCooldownUntilRef.current) return;
    const previous = lastGeocodedRef.current;
    const movedKm = previous
      ? haversineDistance(previous.latitude, previous.longitude, latitude, longitude)
      : Infinity;
    const elapsedMs = previous ? Date.now() - previous.at : Infinity;
    // Une ville ne change pas à chaque point GPS : on évite de solliciter le
    // serveur à chaque rafraîchissement, tout en détectant un trajet.
    if (movedKm < 1 && elapsedMs < 60_000) return;

    reverseInFlightRef.current = true;
    try {
      // Le géocodage direct côté navigateur évite de dépendre du proxy API
      // local pendant le développement. Le backend reste le second choix
      // pour les environnements où l'API publique n'est pas accessible en CORS.
      let data = await fallbackReverseGeocode(latitude, longitude).catch(() => null);
      if (!data?.city) {
        try {
          data = await apiClient.get(`/maps/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
        } catch {
          // Keep location updates working while the local API is restarting or
          // while its primary geocoder is temporarily unavailable.
          data = null;
        }
      }
      if (data?.unavailable && !data?.city) {
        data = await fallbackReverseGeocode(latitude, longitude).catch(() => null);
      }
      if (data?.city) {
        lastGeocodedRef.current = { latitude, longitude, at: Date.now() };
        reverseCooldownUntilRef.current = 0;
        publishCity(data.city, data.country || "", latitude, longitude);
      } else {
        // Keep a short cooldown when both providers are unavailable so GPS
        // updates do not create a request storm in the background.
        lastGeocodedRef.current = { latitude, longitude, at: Date.now() };
        reverseCooldownUntilRef.current = Date.now() + 60_000;
        window.dispatchEvent(new CustomEvent("bb-location-change", {
          detail: { city: "Ma position", latitude, longitude, source: "gps" },
        }));
      }
    } catch {
      // Le suivi des coordonnées continue même si le reverse geocoding est
      // momentanément indisponible. Mémoriser l'échec évite de renvoyer une
      // requête à chaque point GPS lorsque l'API répond en 500.
      const now = Date.now();
      lastGeocodedRef.current = { latitude, longitude, at: now };
      reverseCooldownUntilRef.current = now + 60_000;
      window.dispatchEvent(new CustomEvent("bb-location-change", {
        detail: { city: "Ma position", latitude, longitude, source: "gps" },
      }));
    } finally {
      reverseInFlightRef.current = false;
    }
  }, [publishCity]);

  const handlePosition = useCallback((pos) => {
    const { latitude, longitude, accuracy } = pos.coords;
    const loc = { latitude, longitude, accuracy, updated_at: new Date().toISOString() };
    setLocation(loc);
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify(loc)); } catch {}
    setLoading(false);
    setError(null);
    void reverseGeocode(latitude, longitude);
  }, [reverseGeocode]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return false;
    try { localStorage.setItem(TRACKING_KEY, "1"); } catch {}
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        console.warn("[LocationProvider] Geolocation watch error:", err.message);
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
    return true;
  }, [handlePosition]);

  const requestLocation = useCallback(() => {
    if (requestedRef.current || !navigator.geolocation) {
      if (!navigator.geolocation) setError("Geolocation not supported");
      return;
    }
    requestedRef.current = true;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        try { localStorage.setItem(TRACKING_KEY, "1"); } catch {}
        setTracking(true);
      },
      (err) => {
        requestedRef.current = false;
        console.warn("[LocationProvider] Geolocation error:", err.message);
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, [handlePosition]);

  useEffect(() => {
    if (tracking) {
      startTracking();
    } else {
      stopTracking();
    }
    return stopTracking;
  }, [tracking, startTracking, stopTracking]);

  useEffect(() => {
    // L'application demande une première position comme auparavant. Une fois
    // autorisée, le watchPosition prend automatiquement le relais.
    if (tracking) startTracking();
    else requestLocation();

    const handleTrackingChange = (event) => {
      const enabled = event.detail?.enabled === true;
      try { localStorage.setItem(TRACKING_KEY, enabled ? "1" : "0"); } catch {}
      setTracking(enabled);
      if (!enabled) requestedRef.current = false;
    };
    const handleLocationChange = (event) => {
      const latitude = Number(event.detail?.latitude);
      const longitude = Number(event.detail?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      // A manually selected city is also a real location for distance filters
      // and maps. Previously only the displayed label changed, so the app
      // continued using the old GPS coordinates (often Paris).
      const nextLocation = {
        latitude,
        longitude,
        accuracy: Number(event.detail?.accuracy) || 0,
        updated_at: new Date().toISOString(),
      };
      setLocation(nextLocation);
      try { localStorage.setItem(LOCATION_KEY, JSON.stringify(nextLocation)); } catch {}
      lastGeocodedRef.current = { latitude, longitude, at: Date.now() };
      reverseCooldownUntilRef.current = Date.now() + 60_000;
    };
    window.addEventListener("bb-location-tracking", handleTrackingChange);
    window.addEventListener("bb-location-change", handleLocationChange);
    return () => {
      window.removeEventListener("bb-location-tracking", handleTrackingChange);
      window.removeEventListener("bb-location-change", handleLocationChange);
      stopTracking();
    };
    // Initialisation volontairement unique : les callbacks gèrent ensuite le suivi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        loading,
        error,
        hasLocation: !!location,
        latitude: location?.latitude,
        longitude: location?.longitude,
        requestLocation,
        tracking,
        startTracking,
        stopTracking,
        filterByRadius: (items, radius = 100) => {
          if (!location) return items;
          return filterByRadius(items, location.latitude, location.longitude, radius);
        },
        sortByDistance: (items) => {
          if (!location) return items;
          return sortByDistance(items, location.latitude, location.longitude);
        },
        haversineDistance: (lat, lng) => {
          if (!location) return null;
          return haversineDistance(location.latitude, location.longitude, lat, lng);
        },
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    return {
      location: null,
      loading: false,
      error: null,
      hasLocation: false,
      latitude: null,
      longitude: null,
      requestLocation: () => {},
      filterByRadius: (items) => items,
      sortByDistance: (items) => items,
      haversineDistance: () => null,
    };
  }
  return ctx;
}

export { haversineDistance, filterByRadius, sortByDistance };
