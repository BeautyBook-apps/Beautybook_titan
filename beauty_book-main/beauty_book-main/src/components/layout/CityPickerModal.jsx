import { useState, useEffect } from "react";
import { MapPin, X, Search, Navigation, ChevronDown } from "lucide-react";
import MapWithPricePins from "@/components/map/MapWithPricePins";
import apiClient from "@/lib/apiClient";

const POPULAR_CITIES = [
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { name: "Lyon", country: "France", lat: 45.764, lng: 4.8357 },
  { name: "Marseille", country: "France", lat: 43.2965, lng: 5.3698 },
  { name: "Bordeaux", country: "France", lat: 44.8378, lng: -0.5792 },
  { name: "Lille", country: "France", lat: 50.6292, lng: 3.0573 },
  { name: "Nice", country: "France", lat: 43.7102, lng: 7.262 },
  { name: "Toulouse", country: "France", lat: 43.6047, lng: 1.4442 },
  { name: "Nantes", country: "France", lat: 47.2184, lng: -1.5536 },
  { name: "Strasbourg", country: "France", lat: 48.5734, lng: 7.7521 },
  { name: "Montpellier", country: "France", lat: 43.6108, lng: 3.8767 },
  { name: "Bruxelles", country: "Belgique", lat: 50.8503, lng: 4.3517 },
  { name: "Montréal", country: "Canada", lat: 45.5017, lng: -73.5673 },
];

export default function CityPickerModal({ currentCity, onSelect, onClose }) {
  const [input, setInput] = useState(currentCity || "");
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);

  useEffect(() => {
    if (currentCity) {
      const found = POPULAR_CITIES.find(c => currentCity.includes(c.name));
      if (found) {
        setSelectedCity(found);
      }
    }
  }, [currentCity]);

  const handleSelectCity = (city) => {
    setInput(`${city.name}, ${city.country}`);
    setSelectedCity(city);
  };

  const handleConfirm = () => {
    const nextCity = input.trim();
    if (!nextCity) return;

    // Update the parent first so the header changes immediately, even when
    // localStorage is unavailable (private browsing / embedded webview).
    onSelect(nextCity);
    try { localStorage.setItem("bb_user_city", nextCity); } catch {}
    // Une ville saisie manuellement ne doit pas être remplacée immédiatement
    // par le prochain point GPS.
    try { localStorage.setItem("bb_location_tracking", "0"); } catch {}
    window.dispatchEvent(new CustomEvent("bb-location-change", { detail: { city: nextCity } }));
    window.dispatchEvent(new CustomEvent("bb-location-tracking", { detail: { enabled: false } }));
    onClose();
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const data = await apiClient.get(`/maps/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
          const city = data.city || "Ma ville";
          const country = data.country || "";
          const label = country ? `${city}, ${country}` : city;
          setInput(label);
          onSelect(label);
          try { localStorage.setItem("bb_user_city", label); } catch {}
          try { localStorage.setItem("bb_location_tracking", "1"); } catch {}
          window.dispatchEvent(new CustomEvent("bb-location-change", { detail: { city: label, latitude, longitude } }));
          window.dispatchEvent(new CustomEvent("bb-location-tracking", { detail: { enabled: true } }));
          onClose();
        } catch {}
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 5000 }
    );
  };

  const filtered = POPULAR_CITIES.filter(c =>
    input.length < 2 || `${c.name}, ${c.country}`.toLowerCase().includes(input.toLowerCase())
  );

  const mapItems = selectedCity ? [{ id: selectedCity.name, title: selectedCity.name, city: selectedCity.country, lat: selectedCity.lat, lng: selectedCity.lng }] : POPULAR_CITIES.map(c => ({ id: c.name, title: c.name, city: c.country, lat: c.lat, lng: c.lng }));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-[32px] z-10 max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2 shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="text-[17px] font-black text-gray-900">Choisir ma ville (Apple Maps)</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Apple Maps Embed */}
        <div className="relative shrink-0">
          <MapWithPricePins items={mapItems} height="h-44" />
        </div>

        <div className="px-5 pt-4 pb-6 space-y-4 overflow-y-auto">
          {/* GPS Button */}
          <button
            onClick={handleGeolocate}
            disabled={geoLoading}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-orange-50 border border-orange-200/60 rounded-2xl active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
              <Navigation className={`w-5 h-5 text-white ${geoLoading ? "animate-spin" : ""}`} />
            </div>
            <div className="text-left flex-1">
              <p className="text-[14px] font-black text-gray-900">{geoLoading ? "Localisation en cours..." : "Utiliser ma position"}</p>
              <p className="text-[11px] text-gray-500 font-medium">Détection automatique via GPS</p>
            </div>
            <ChevronDown className="w-4 h-4 text-orange-400 -rotate-90" />
          </button>

          {/* Search */}
          <div className="bg-gray-50 rounded-2xl flex items-center gap-3 px-4 py-3 border border-gray-200 focus-within:border-primary focus-within:bg-white transition-all">
            <Search className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Rechercher une ville..."
              className="flex-1 bg-transparent text-[14px] text-gray-800 outline-none placeholder:text-gray-400 font-medium"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleConfirm(); }}
            />
            {input && (
              <button onClick={() => { setInput(""); setSelectedCity(null); }} className="active:scale-90">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Confirm */}
          {input.trim().length > 1 && (
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full bg-primary hover:bg-orange-700 text-white font-black text-[14px] uppercase tracking-widest py-3.5 rounded-2xl shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" /> Confirmer cette ville
            </button>
          )}

          {/* Popular Cities */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Villes populaires</p>
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(city => (
                <button
                  key={city.name}
                  onClick={() => handleSelectCity(city)}
                  className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border transition-all text-left ${
                    selectedCity?.name === city.name
                      ? "bg-orange-50 border-orange-300 shadow-sm"
                      : "bg-white border-gray-100 shadow-sm active:scale-[0.97]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedCity?.name === city.name
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-bold truncate ${selectedCity?.name === city.name ? "text-primary" : "text-gray-800"}`}>
                      {city.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">{city.country}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
