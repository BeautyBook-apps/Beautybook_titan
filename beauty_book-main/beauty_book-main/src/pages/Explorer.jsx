import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Star, X, Search, SlidersHorizontal, Bell, Sparkles, XCircle, Scissors, Waves, Diamond, PenTool, Droplets, Filter, ChevronRight, Flame, Zap } from "lucide-react";
import { entities } from '@/api/entities';
import { useLocation } from '@/contexts/LocationContext';
import MapWithPricePins from '@/components/map/MapWithPricePins';
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";

const CATEGORIES = [
  { id: "Tous", label: "Tout", icon: "all", emoji: "✨" },
  { id: "Coiffure", label: "Coiffure", icon: "scissors", emoji: "✂️" },
  { id: "Tresses", label: "Tresses", icon: "waves", emoji: "🌊" },
  { id: "Ongles", label: "Manucure", icon: "diamond", emoji: "💎" },
  { id: "Pedicure", label: "Pédicure", icon: "star", emoji: "⭐" },
  { id: "Maquillage", label: "Maquillage", icon: "pen", emoji: "💄" },
  { id: "Soin", label: "Soin", icon: "droplet", emoji: "💧" },
  { id: "Massage", label: "Massage", icon: "hand", emoji: "🤲" },
];

const FALLBACK_STYLES = [
  { id: "f1", title: "Havana Twists", category: "Coiffure", image_url: "" },
  { id: "f2", title: "Spring Twists", category: "Coiffure", image_url: "" },
  { id: "f3", title: "Passion Twists", category: "Coiffure", image_url: "" },
  { id: "f4", title: "Box Braids", category: "Coiffure", image_url: "" },
  { id: "f5", title: "Cornrows", category: "Coiffure", image_url: "" },
  { id: "f6", title: "Locs", category: "Coiffure", image_url: "" },
];

export default function Explorer() {
  const navigate = useNavigate();
  const { hasLocation, latitude, longitude } = useLocation();
  // Affichage direct depuis le cache : la première peinture montre les dernières
  // données connues, jamais un écran « Chargement... » ; le rafraîchissement
  // réseau se fait en arrière-plan sans vider l'affichage.
  const [profils, setProfils] = useCachedState("explorer_page", [], c => c?.profils || []);
  const [minPricesMap, setMinPricesMap] = useCachedState("explorer_page", {}, c => c?.minPricesMap || {});
  const [styles, setStyles] = useCachedState("explorer_page", [], c => c?.styles || []);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => !readPageCache("explorer_page"));
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (hasLocation && latitude && longitude) {
      setUserLocation({ lat: latitude, lng: longitude });
    } else if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [hasLocation, latitude, longitude]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [allProfils, allStyles] = await Promise.all([
          entities.ProfilPro.filter({ status: "actif" }, "-created_at", 500).catch(() => []),
          entities.Style.filter({ status: "actif" }, "-created_at", 50).catch(() => []),
        ]);
        if (cancelled) return;
        setProfils(allProfils);
        setStyles(allStyles.length > 0 ? allStyles : FALLBACK_STYLES);
        // Persister le chargement frais (uniquement les vraies données, jamais
        // les styles de secours) : le prochain affichage sera instantané.
        mergePageCache("explorer_page", {
          profils: allProfils,
          ...(allStyles.length > 0 ? { styles: allStyles } : {}),
        });
        const emails = allProfils.map(p => p.user_email).filter(Boolean);
        const servicesArr = await Promise.all(
          emails.map(e => entities.Service.filter({ pro_email: e, status: "actif" }, "price", 5).catch(() => []))
        );
        const pMap = {};
        emails.forEach((e, i) => {
          const prices = servicesArr[i].map(s => s.price).filter(p => p > 0);
          if (prices.length > 0) pMap[e] = Math.min(...prices);
        });
        if (!cancelled) {
          setMinPricesMap(pMap);
          mergePageCache("explorer_page", { minPricesMap: pMap });
        }
      } catch {
        if (!cancelled) setStyles(FALLBACK_STYLES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return profils.filter(p => {
      const matchCat = activeCategory === "Tous" || p.specialites?.some(s => s.toLowerCase().includes(activeCategory.toLowerCase()));
      const matchSearch = !search || p.salon_name?.toLowerCase().includes(search.toLowerCase()) || p.city?.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [profils, activeCategory, search]);

  const allMapItems = useMemo(() => filtered.map((p) => ({
    ...p,
    mapLat: p.latitude || p.lat || 48.866 + (Math.random() - 0.5) * 0.08,
    mapLng: p.longitude || p.lng || 2.333 + (Math.random() - 0.5) * 0.12,
  })), [filtered]);

  const mapCenter = useMemo(() => {
    if (userLocation) return userLocation;
    return { lat: 48.866, lng: 2.333 };
  }, [userLocation]);

  const handleSelectMarker = (proId) => {
    const pro = allMapItems.find(p => p.id === proId);
    if (pro) navigate("/pro/vue-client", { state: { proEmail: pro.user_email } });
  };

  // Afficher le contenu dès que des données en cache existent : jamais de
  // spinner plein écran pendant le rafraîchissement en arrière-plan.
  const hasData = profils.length > 0 || styles.length > 0;

  if (loading && !hasData) {
    return (
      <div className="font-display h-full flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)" }}>
        <div className="relative mb-5">
          <div className="w-16 h-16 border-[3px] border-[#E8732A]/20 rounded-full animate-spin" style={{ borderTopColor: "#E8732A" }} />
          <Sparkles className="w-7 h-7 text-[#E8732A] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-[13px] font-bold text-white/40">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="font-display h-full bg-[#f8f7f5] flex flex-col overflow-hidden">

      {/* ── HERO HEADER ── */}
      <div
        className="flex-shrink-0 px-5 pt-[env(safe-area-inset-top,16px)]"
        style={{ background: "linear-gradient(160deg, #111111 0%, #1e1e1e 60%, #2a1a0e 100%)" }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between pt-5 pb-4">
          <div>
            <h1
              className="text-[32px] font-black leading-none tracking-tight text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              Explorer
            </h1>
            <p className="text-[11px] font-bold mt-1 flex items-center gap-1.5" style={{ color: "#E8732A" }}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#E8732A" }}
              />
              VIVEZ L'EXPÉRIENCE BEAUTYBOOK
            </p>
          </div>
          <button
            onClick={() => navigate("/notifications")}
            className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-all relative"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Bell className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="flex-1 flex items-center gap-2.5 px-4 py-3.5 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Salons, Styles, Services..."
              className="flex-1 bg-transparent text-[14px] font-medium outline-none"
              style={{ color: "white" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="shrink-0">
                <XCircle className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-all shrink-0"
            style={{ background: "#E8732A" }}
          >
            <SlidersHorizontal className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4 -mx-5 px-5">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all active:scale-95"
                style={{
                  background: isActive ? "#E8732A" : "rgba(255,255,255,0.08)",
                  border: isActive ? "none" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span className="text-[15px]">{cat.emoji}</span>
                <span
                  className="text-[12px] font-bold whitespace-nowrap"
                  style={{ color: isActive ? "white" : "rgba(255,255,255,0.6)" }}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Map Toggle + Map */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => setShowMap(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all active:scale-[0.99]"
            style={{
              background: showMap ? "linear-gradient(135deg, #111 0%, #1e1e1e 100%)" : "#f0eeeb",
              border: showMap ? "none" : "1px solid #e8e4df",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: showMap ? "#E8732A" : "#e8e4df" }}
              >
                <MapPin className="w-4 h-4" style={{ color: showMap ? "white" : "#999" }} />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-bold" style={{ color: showMap ? "white" : "#222" }}>
                  Carte interactive
                </p>
                <p className="text-[11px]" style={{ color: showMap ? "rgba(255,255,255,0.5)" : "#aaa" }}>
                  {allMapItems.length} salon{allMapItems.length !== 1 ? "s" : ""} près de vous
                </p>
              </div>
            </div>
            <span
              className="text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full"
              style={{
                background: showMap ? "rgba(232,115,42,0.2)" : "#e8e4df",
                color: showMap ? "#E8732A" : "#888",
              }}
            >
              {showMap ? "Masquer" : "Afficher"}
            </span>
          </button>
        </div>

        {showMap && (
          <div className="mx-4 mb-4 rounded-3xl overflow-hidden shadow-lg relative">
            <MapWithPricePins
              items={allMapItems.map(p => ({
                id: p.id,
                title: p.salon_name || p.name || 'Salon',
                lat: p.mapLat || p.latitude || 48.8566,
                lng: p.mapLng || p.longitude || 2.3522,
                minPrice: p.minPrice || p.price || 0,
                city: p.city || 'Paris'
              }))}
              height="h-56"
              onSelectItem={(item) => handleSelectMarker(item.id)}
            />
          </div>
        )}

        {/* ── STYLES SECTION ── */}
        {styles.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4" style={{ color: "#E8732A" }} />
                <p className="text-[16px] font-black text-gray-900">Styles Tendance</p>
              </div>
              <button
                onClick={() => navigate("/services-salons?tab=STYLES")}
                className="flex items-center gap-1 text-[12px] font-black uppercase tracking-wide"
                style={{ color: "#E8732A" }}
              >
                Tout voir
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-0 px-4">
              {styles.map((style, idx) => (
                <button
                  key={style.id}
                  onClick={() => navigate(`/style/${style.id}`, { state: { ...style, cover: style.image_url, images: style.images || (style.image_url ? [style.image_url] : []), category: style.category } })}
                  className="shrink-0 w-[130px] text-left active:scale-[0.97] transition-all"
                >
                  <div className="w-[130px] h-[170px] rounded-2xl overflow-hidden mb-2 relative">
                    <BeautyImage
                      src={style.image_url || (style.images?.[0]) || ""}
                      alt={style.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Gradient overlay */}
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)" }}
                    />
                    {/* Hot badge for first 3 */}
                    {idx < 3 && (
                      <div
                        className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black text-white"
                        style={{ background: "#E8732A" }}
                      >
                        🔥 HOT
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[12px] font-black text-white truncate leading-tight">{style.title}</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium text-gray-400 mt-0.5">{style.category}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SALONS SECTION ── */}
        <div className="px-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: "#E8732A" }} />
              <p className="text-[16px] font-black text-gray-900">
                Salons{activeCategory !== "Tous" ? ` · ${activeCategory}` : ""}
              </p>
            </div>
            {filtered.length > 0 && (
              <span className="text-[11px] font-bold text-gray-400">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: "#f0eeeb" }}
              >
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-[16px] font-black text-gray-800 mb-1">Aucun salon trouvé</p>
              <p className="text-[13px] text-gray-400 font-medium text-center px-10">
                Essayez une autre catégorie ou un autre mot-clé.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((pro) => {
                const img = pro.avatar_url || pro.cover_url || "";
                const price = minPricesMap[pro.user_email];
                const city = [pro.city, pro.postal_code ? String(pro.postal_code).slice(0, 2) : null].filter(Boolean).join(", ");
                const isOpen = pro.is_open;
                return (
                  <button
                    key={pro.id}
                    onClick={() => navigate("/pro/vue-client", { state: { proEmail: pro.user_email } })}
                    className="w-full rounded-2xl overflow-hidden active:scale-[0.98] transition-all text-left flex bg-white"
                    style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
                  >
                    {/* Image */}
                    <div className="w-[100px] h-[110px] shrink-0 relative overflow-hidden">
                      <BeautyImage src={img} alt={pro.salon_name} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.1) 0%, transparent 50%)" }} />
                      {isOpen === true && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-[8px] font-black text-green-700 uppercase">Ouvert</span>
                        </div>
                      )}
                      {isOpen === false && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                          <span className="text-[8px] font-black text-red-500 uppercase">Fermé</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 px-3.5 py-3 flex flex-col justify-between">
                      <div>
                        <p className="text-[15px] font-extrabold text-gray-900 truncate leading-tight">{pro.salon_name}</p>
                        {pro.specialites?.length > 0 && (
                          <p className="text-[11px] font-bold mt-0.5 truncate" style={{ color: "#E8732A" }}>
                            {pro.specialites.slice(0, 2).join(" · ")}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {city && (
                            <span className="flex items-center gap-0.5 text-[11px] text-gray-400 font-medium">
                              <MapPin className="w-3 h-3" />{city}
                            </span>
                          )}
                          {pro.rating > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-500">
                              <Star className="w-3 h-3 fill-amber-400" />{pro.rating}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        {price > 0 && (
                          <span className="text-[12px] font-extrabold text-gray-800">
                            dès <span style={{ color: "#E8732A" }}>{price}€</span>
                          </span>
                        )}
                        <div
                          className="ml-auto w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(232,115,42,0.1)" }}
                        >
                          <ChevronRight className="w-3.5 h-3.5" style={{ color: "#E8732A" }} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FILTER MODAL ── */}
      {showFilters && (
        <div className="fixed inset-0 z-[999] flex items-end" onClick={() => setShowFilters(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full rounded-t-[32px] max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: "#E8732A" }} />
                <h2 className="text-[16px] font-black text-gray-900">Filtres</h2>
              </div>
              <button
                onClick={() => setShowFilters(false)}
                className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <p className="text-[13px] text-gray-400 font-medium text-center py-8">
                Filtres avancés disponibles prochainement ✨
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowFilters(false)}
                className="w-full py-4 text-white text-[13px] font-black uppercase tracking-wider rounded-2xl active:scale-[0.98] transition-all"
                style={{ background: "linear-gradient(135deg, #E8732A 0%, #d4601a 100%)" }}
              >
                Appliquer les filtres
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
