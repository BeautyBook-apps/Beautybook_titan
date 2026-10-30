import { useState, useEffect } from "react";
import { MapPin, RefreshCw, ExternalLink } from "lucide-react";
import { loadAppleMaps } from "@/lib/appleMaps";

const VTC_PROVIDERS = [
  {
    id: "uber",
    name: "Uber",
    logoBg: "bg-black",
    logoText: "Uber",
    logoTextColor: "text-white",
    basePrice: 11,
    baseDuration: 17,
    perKm: 1.8,
    minPrice: 8,
    deepLink: "https://m.uber.com/",
  },
  {
    id: "bolt",
    name: "Bolt",
    logoBg: "bg-[#34D186]",
    logoText: "Bolt",
    logoTextColor: "text-white",
    basePrice: 10,
    baseDuration: 15,
    perKm: 1.6,
    minPrice: 7,
    deepLink: "https://bolt.eu/",
  },
  {
    id: "freenow",
    name: "FREE NOW",
    logoBg: "bg-[#E30613]",
    logoText: "F",
    logoTextColor: "text-white",
    basePrice: 11,
    baseDuration: 17,
    perKm: 1.7,
    minPrice: 8,
    deepLink: "https://free-now.com/",
  },
  {
    id: "heetch",
    name: "Heetch",
    logoBg: "bg-[#E91E8C]",
    logoText: "H",
    logoTextColor: "text-white",
    basePrice: 9,
    baseDuration: 18,
    perKm: 1.5,
    minPrice: 6,
    deepLink: "https://www.heetch.com/",
  },
  {
    id: "lecab",
    name: "Le Cab",
    logoBg: "bg-gray-900",
    logoText: "LC",
    logoTextColor: "text-white",
    basePrice: 14,
    baseDuration: 12,
    perKm: 2.2,
    minPrice: 10,
    deepLink: "https://www.lecab.fr/",
  },
  {
    id: "g7",
    name: "Taxi G7",
    logoBg: "bg-[#FFD700]",
    logoText: "G7",
    logoTextColor: "text-gray-900",
    basePrice: 13,
    baseDuration: 20,
    perKm: 2.0,
    minPrice: 9,
    deepLink: "https://www.g7.fr/",
  },
];

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computePrice(provider, distanceKm) {
  const surge = Math.random() > 0.7 ? 1.25 : 1;
  const price = Math.max(provider.minPrice, Math.round((provider.basePrice + distanceKm * provider.perKm) * surge));
  return { price, surge: surge > 1 };
}

function computeDuration(provider, distanceKm) {
  const baseMin = Math.round(distanceKm * 2.5);
  const variation = Math.floor(Math.random() * 6) - 3;
  return Math.max(5, provider.baseDuration + baseMin + variation);
}

export default function VTCSection({ destinationLat, destinationLng, destinationAddress }) {
  const [userLocation, setUserLocation] = useState(null);
  // Coordonnées du salon : props directes, sinon géocodage de l'adresse via Apple Maps
  const [resolvedDest, setResolvedDest] = useState(null);
  const destLat = destinationLat || resolvedDest?.lat || null;
  const destLng = destinationLng || resolvedDest?.lng || null;
  const [prices, setPrices] = useState(() =>
    VTC_PROVIDERS.map(p => ({
      id: p.id,
      price: p.basePrice,
      duration: p.baseDuration,
      surge: false,
    }))
  );
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [distanceKm, setDistanceKm] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  // Géocode l'adresse du salon quand aucune coordonnée n'est fournie :
  // les prix sont alors calculés depuis la vraie localisation du salon.
  useEffect(() => {
    if (destinationLat || destinationLng || !destinationAddress) return;
    let cancelled = false;
    loadAppleMaps()
      .then((mapkit) => {
        if (cancelled) return;
        const geocoder = new mapkit.Geocoder();
        geocoder.lookup(destinationAddress, (error, data) => {
          if (cancelled || error || !data?.results?.length) return;
          const coord = data.results[0].coordinate;
          if (coord) setResolvedDest({ lat: coord.latitude, lng: coord.longitude });
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [destinationLat, destinationLng, destinationAddress]);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      let dist = distanceKm || 5;
      if (userLocation && destLat && destLng) {
        dist = haversineDistance(userLocation.lat, userLocation.lng, destLat, destLng);
        setDistanceKm(dist);
      }
      setPrices(VTC_PROVIDERS.map(p => {
        const { price, surge } = computePrice(p, dist);
        return {
          id: p.id,
          price,
          duration: computeDuration(p, dist),
          surge,
        };
      }));
      setLastUpdate(new Date());
      setRefreshing(false);
    }, 600);
  };

  // Actualise immédiatement à l'ouverture de la page, puis quand la position
  // ou la destination deviennent disponibles.
  useEffect(() => {
    refresh();
  }, [userLocation, destLat, destLng, destinationAddress]);

  // Quand l'utilisateur revient sur la page, les estimations sont recalculées.
  useEffect(() => {
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => document.removeEventListener("visibilitychange", refreshOnVisible);
  }, [userLocation, destLat, destLng, destinationAddress]);

  useEffect(() => {
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [userLocation, destLat, destLng, distanceKm]);

  const timeStr = lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 bg-blue-500 rounded-full" />
          <span className="text-[16px] font-black text-gray-900">VTC & Taxis</span>
          <span className="bg-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">LIVE</span>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 uppercase tracking-widest active:scale-95 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-500" : ""}`} />
          {refreshing ? "..." : timeStr}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3 bg-blue-50 rounded-2xl px-3 py-2">
        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <p className="text-[11px] font-medium text-blue-700">
          {distanceKm
            ? `${distanceKm.toFixed(1)} km depuis votre position`
            : destinationAddress || "Activez la localisation pour des prix précis"}
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        {VTC_PROVIDERS.map((provider, i) => {
          const pData = prices.find(p => p.id === provider.id) || { price: provider.basePrice, duration: provider.baseDuration, surge: false };
          const isLast = i === VTC_PROVIDERS.length - 1;

          return (
            <a key={provider.id} href={provider.deepLink} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-4 px-4 py-4 active:bg-gray-50 transition-colors ${!isLast ? "border-b border-gray-100" : ""}`}>
              <div className={`w-12 h-12 ${provider.logoBg} rounded-2xl flex items-center justify-center shrink-0 shadow-sm`}>
                <span className={`${provider.logoTextColor} text-[12px] font-black`}>{provider.logoText}</span>
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-black text-gray-900">{provider.name}</p>
                {pData.surge && (
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Forte demande</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[15px] font-black ${pData.surge ? "text-orange-500" : "text-blue-500"}`}>
                  {pData.price}€+
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-[15px] font-black text-gray-700">~{pData.duration}</span>
                <span className="text-[12px] font-bold text-gray-400">min</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 ml-1" />
              </div>
            </a>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 font-medium mt-2 text-center">
        Tarifs estimatifs • Ouvrez l'app pour confirmer le prix exact
      </p>
    </div>
  );
}
