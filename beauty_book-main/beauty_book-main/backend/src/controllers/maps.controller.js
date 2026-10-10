const NOMINATIM_HEADERS = {
  "User-Agent": "BeautyBookApp/1.0 (contact@beautybook.fr)",
  "Accept-Language": "fr",
};
const MAPS_TIMEOUT_MS = 6000;

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

async function fetchJson(url, options = {}) {
  // AbortSignal.timeout n'est pas disponible dans toutes les versions Node
  // utilisées en développement. Un AbortController local garde le même
  // délai sans provoquer d'exception avant même l'appel réseau.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MAPS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Maps provider returned ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const placesAutocomplete = async (req, res) => {
  try {
    const { input, placeId } = req.body;

    // Récupérer les détails d'un lieu (place_id → adresse structurée)
    if (placeId) {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/lookup?osm_id=${encodeURIComponent(placeId)}&format=json&addressdetails=1&accept-language=fr`,
        { headers: NOMINATIM_HEADERS }
      );
      const data = await resp.json();
      if (!data.length) {
        return res.json({ address: "", city: "", postalCode: "", formatted: "", lat: null, lng: null });
      }

      const result = data[0];
      const addr = result.address || {};

      const streetNumber = addr.house_number || "";
      const route = addr.road || "";
      const city = addr.city || addr.town || addr.village || "";
      const postalCode = addr.postcode || "";

      const address = [streetNumber, route].filter(Boolean).join(" ");

      return res.json({
        address,
        city,
        postalCode,
        formatted: result.display_name || address,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      });
    }

    // Autocomplete
    if (!input || input.length < 2) return res.json({ predictions: [] });

    const resp = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(input)}&limit=5&autocomplete=1`,
      { headers: { "Accept-Language": "fr" } }
    );
    const data = await resp.json();

    const predictions = (data.features || []).map((item) => {
      const properties = item.properties || {};
      return {
        description: properties.label || input,
        place_id: properties.id || "",
        address: properties.name || "",
        postalCode: properties.postcode || "",
        city: properties.city || "",
        structured: {
          house_number: properties.housenumber || "",
          road: properties.street || properties.name || "",
          postcode: properties.postcode || "",
          city: properties.city || "",
        },
      };
    });

    return res.json({ predictions });
  } catch (error) {
    console.error("placesAutocomplete error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// ── Geocode: adresses → lat/lng (pour transport fees) ──
export const geocode = async (req, res) => {
  try {
    const { addresses } = req.body;
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: "addresses array required" });
    }

    const results = await Promise.all(
      addresses.map(async (addr) => {
        if (!addr) return { lat: null, lng: null, error: "empty address" };
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=fr,be,ch`,
            { headers: NOMINATIM_HEADERS }
          );
          const data = await resp.json();
          if (data.length === 0) return { lat: null, lng: null, error: "not found" };
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch (e) {
          return { lat: null, lng: null, error: e.message };
        }
      })
    );

    return res.json({ results });
  } catch (error) {
    console.error("geocode error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// ── Reverse geocode: lat/lng → ville (public, pas d'auth) ──
export const reverseGeocode = async (req, res) => {
  const latitude = validCoordinate(req.query.lat, -90, 90);
  const longitude = validCoordinate(req.query.lng, -180, 180);
  if (latitude === null || longitude === null) return res.status(400).json({ error: "lat & lng required" });

  try {
    const data = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`,
      { headers: NOMINATIM_HEADERS }
    );
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || data.address?.county || "";
    const country = data.address?.country_code?.toUpperCase() || "";
    if (city) return res.json({ city, country });
  } catch (error) {
    console.warn("reverseGeocode Nominatim unavailable:", error.message);
  }

  // Nominatim can throttle local development traffic. The French public
  // address API is a compatible fallback for the application's city label.
  try {
    const data = await fetchJson(
      `https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}`,
      { headers: { "Accept-Language": "fr" } }
    );
    const properties = data.features?.[0]?.properties || {};
    return res.json({
      city: properties.city || properties.municipality || "",
      country: properties.context?.includes("France") ? "FR" : "",
    });
  } catch (error) {
    // Location tracking must remain usable when both geocoders are down.
    console.warn("reverseGeocode providers unavailable:", error.message);
    return res.json({ city: "", country: "", unavailable: true });
  }
};
