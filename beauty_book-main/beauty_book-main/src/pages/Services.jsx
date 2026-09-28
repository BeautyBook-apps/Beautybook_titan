import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, SlidersHorizontal, Star, Heart, MapPin, User, Flame, CheckCircle } from "lucide-react";
import MapWithPricePins from "@/components/map/MapWithPricePins";
import AdvancedFilterSheet from "@/components/filters/AdvancedFilterSheet";
import { GLOBAL_CATEGORIES } from "@/lib/categories";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { useLocation } from '@/contexts/LocationContext';
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";

const isVideoUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url);
};

function VideoThumb({ src, className, alt }) {
  const videoRef = useRef(null);
  const [thumb, setThumb] = useState(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onCanPlay = () => { try { v.currentTime = 1; } catch {} };
    const onSeeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = v.videoWidth || 200;
        c.height = v.videoHeight || 200;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        setThumb(c.toDataURL("image/jpeg", 0.6));
      } catch {}
    };
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("seeked", onSeeked);
    v.load();
    return () => { v.removeEventListener("canplay", onCanPlay); v.removeEventListener("seeked", onSeeked); };
  }, [src]);

  if (thumb) return <BeautyImage src={thumb} alt={alt} className={className} />;

  return (
    <>
      <video ref={videoRef} src={src} muted playsInline preload="metadata" className="hidden" />
      <div className={className + " bg-gray-200 flex items-center justify-center"}>
        <span className="text-[10px] text-gray-400 font-bold">VIDEO</span>
      </div>
    </>
  );
}

// ── Filter Tab Bar ─────────────────────────────────────────────────────────────
const ENTITY_TABS = [
  { id: "all", label: "Tout" },
  { id: "services", label: "Services" },
  { id: "salons", label: "Salons" },
  { id: "particuliers", label: "Particuliers" },
  { id: "styles", label: "Styles" },
  { id: "bundles", label: "Bundles" },
];

export default function Services() {
  const navigate = useNavigate();
  const { filterByRadius, hasLocation } = useLocation();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [styles, setStyles] = useCachedState("services_page", [], c => c?.styles || []);
  const [services, setServices] = useCachedState("services_page", [], c => c?.services || []);
  const [pros, setPros] = useCachedState("services_page", [], c => c?.pros || []);
  const [loadingStyles, setLoadingStyles] = useState(() => !readPageCache("services_page")?.styles?.length);
  const [loadingServices, setLoadingServices] = useState(() => !readPageCache("services_page")?.services?.length);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    return new Promise(resolve => setTimeout(() => { setRefreshKey(k => k + 1); resolve(); }, 800));
  }, []);
  const { containerRef, pulling, pullDistance } = usePullToRefresh(handleRefresh);

  useEffect(() => {
    const filterObj = { status: "publie" };
    if (activeCategory) filterObj.category = activeCategory.dbValue;
    entities.Style.filter(filterObj, "-created_at", 20)
      .then(data => {
        setStyles(data || []);
        // Le cache ne garde que la vue non filtrée (« Tous »)
        if (!activeCategory) mergePageCache("services_page", { styles: data || [] });
      })
      .catch(() => {})
      .finally(() => setLoadingStyles(false));
  }, [activeCategory, refreshKey]);

  useEffect(() => {
    const filterObj = { status: "actif" };
    if (activeCategory) filterObj.category = activeCategory.dbValue;
    entities.Service.filter(filterObj, "-created_at", 20)
      .then(data => {
        setServices(data || []);
        if (!activeCategory) mergePageCache("services_page", { services: data || [] });
      })
      .catch(() => {})
      .finally(() => setLoadingServices(false));
  }, [activeCategory, refreshKey]);

  useEffect(() => {
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 500)
      .then(items => {
        const list = items || [];
        setPros(list);
        mergePageCache("services_page", { pros: list });
      })
      .catch(() => {});
  }, [refreshKey]);

  let mapItems = useMemo(() => pros
    .filter(p => p.latitude && p.longitude)
    .slice(0, 30)
    .map(p => {
      const proServices = services.filter(s => s.pro_email === p.user_email);
      const minPrice = proServices.length > 0
        ? Math.min(...proServices.map(s => s.price || 0))
        : 0;
      return {
        id: p.id,
        price: minPrice,
        title: p.salon_name,
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude),
        address: p.address || "",
        city: p.city || "",
      };
    }), [pros, services]);
  if (hasLocation) {
    mapItems = filterByRadius(mapItems, 100);
  }

  const filteredSalons = useMemo(() => {
    let result = pros.filter(p => p.type_activite !== "Particulier");
    if (activeCategory) {
      result = result.filter(p => p.specialites?.some(s => s.toLowerCase().includes(activeCategory.label.toLowerCase())));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => (p.salon_name || "").toLowerCase().includes(q) || (p.city || "").toLowerCase().includes(q));
    }
    return result.slice(0, 12);
  }, [pros, activeCategory, search]);

  const filteredParticuliers = useMemo(() => {
    let result = pros.filter(p => p.type_activite === "Particulier");
    if (activeCategory) {
      result = result.filter(p => p.specialites?.some(s => s.toLowerCase().includes(activeCategory.label.toLowerCase())));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => (p.salon_name || "").toLowerCase().includes(q));
    }
    return result.slice(0, 12);
  }, [pros, activeCategory, search]);

  const filteredServices = useMemo(() => {
    let result = [...services];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => (s.title || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q));
    }
    return result.slice(0, 6);
  }, [services, search]);

  const filteredStyles = useMemo(() => {
    let result = [...styles];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => (s.title || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q));
    }
    return result;
  }, [styles, search]);

  const goToServicesSalons = (tab = "STYLES") => {
    const cat = activeCategory ? `&cat=${activeCategory.id}` : "";
    navigate(`/services-salons?tab=${tab}${cat}`);
  };

  const filterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div ref={containerRef} className="font-display bg-white min-h-full pb-6">
      {pullDistance > 10 && (
        <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance * 0.5 }}>
          <div className={`w-6 h-6 border-2 border-primary border-t-transparent rounded-full ${pulling ? "animate-spin" : ""}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
        </div>
      )}

      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[28px] font-black text-gray-900 leading-none tracking-tight">Explorer</h1>
            <p className="text-[11px] font-black uppercase tracking-widest mt-0.5" style={{ color: "#FF6B00" }}>
              • Services · Salons · Styles
            </p>
          </div>
          <button onClick={() => navigate("/notifications")}
            className="w-10 h-10 border border-gray-100 rounded-2xl flex items-center justify-center text-gray-600 active:scale-95 transition-all bg-gray-50">
            <Bell className="w-5 h-5" />
          </button>
        </div>

        {/* Search + Filtres */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5">
            <Search className="w-4 h-4 shrink-0" style={{ color: "#FF6B00" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Services, salons, styles..."
              className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-400 font-medium" />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500">
                ×
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all"
            style={{ background: "#FF6B00", boxShadow: "0 4px 12px rgba(255,107,0,0.35)" }}
          >
            <SlidersHorizontal className="w-5 h-5 text-white" />
            {filterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 rounded-full text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {filterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Entity Tabs ── */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 pb-3">
        {ENTITY_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-black border transition-all active:scale-95 ${
              activeTab === tab.id
                ? "text-white border-transparent"
                : "bg-white text-gray-600 border-gray-200"
            }`}
            style={activeTab === tab.id ? { background: "#FF6B00", boxShadow: "0 4px 12px rgba(255,107,0,0.3)" } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Catégories ── */}
      <div className="px-5 mb-4">
        <div className="flex gap-2.5 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-all"
          >
            <div className={`w-[54px] h-[54px] rounded-[18px] flex items-center justify-center border text-[18px] transition-all ${!activeCategory ? "border-2" : "bg-gray-50 border-gray-100"}`}
              style={!activeCategory ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.08)" } : {}}>
              🌟
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${!activeCategory ? "text-primary" : "text-gray-500"}`}>Tous</span>
          </button>

          {GLOBAL_CATEGORIES.map((cat) => {
            const Icon = cat.Icon;
            const isActive = activeCategory?.id === cat.id;
            return (
              <button key={cat.id}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-all">
                <div
                  className={`w-[54px] h-[54px] rounded-[18px] flex items-center justify-center border transition-all ${isActive ? "border-2" : "bg-gray-50 border-gray-100"}`}
                  style={isActive ? { borderColor: "#FF6B00", background: "rgba(255,107,0,0.08)" } : {}}>
                  <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-gray-500"}`} strokeWidth={1.5} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? "text-primary" : "text-gray-500"}`}>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Map ── */}
      {(activeTab === "all" || activeTab === "salons") && (
        <div className="px-5 mb-5">
          <div className="rounded-[20px] overflow-hidden border border-gray-100" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <MapWithPricePins
              items={mapItems}
              onSelectItem={() => goToServicesSalons("SALONS")}
              height="h-44"
            />
          </div>
        </div>
      )}

      <AdvancedFilterSheet open={showFilters} onClose={() => setShowFilters(false)} onApply={setFilters} initialFilters={filters} pros={pros} />

      {/* ── Content Sections ── */}
      <div className="space-y-8 pb-4">

        {/* ── Styles ── */}
        {(activeTab === "all" || activeTab === "styles") && (
          <section>
            <div className="px-5 flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">✨</span>
                <h2 className="text-[14px] font-black text-gray-900">
                  Styles{activeCategory ? ` · ${activeCategory.label}` : ""}
                </h2>
              </div>
              <button onClick={() => goToServicesSalons("STYLES")}
                className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#FF6B00" }}>
                Découvrir →
              </button>
            </div>
            {loadingStyles && filteredStyles.length === 0 ? (
              <div className="flex gap-3 overflow-x-auto px-5">
                {[1, 2, 3].map(i => <div key={i} className="shrink-0 w-44 h-64 bg-gray-100 rounded-3xl animate-pulse" />)}
              </div>
            ) : filteredStyles.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-[12px] font-black text-gray-300 uppercase tracking-widest">Aucun style trouvé</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pb-1">
                {filteredStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => navigate(`/style/${style.id}`, { state: { id: style.id, title: style.title, cover: style.image_url, category: style.category } })}
                    className="shrink-0 w-[160px] rounded-[22px] overflow-hidden bg-white shadow-sm border border-gray-100 active:scale-[0.98] transition-all text-left">
                    <div className="relative h-[180px]">
                      <BeautyImage src={style.image_url || ""} alt={style.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[12px] font-black text-white leading-tight">{style.title}</p>
                        <p className="text-[10px] text-white/70 font-medium mt-0.5">{style.category}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Services ── */}
        {(activeTab === "all" || activeTab === "services") && (
          <section className="px-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4" style={{ color: "#FF6B00" }} />
                <h2 className="text-[14px] font-black text-gray-900">
                  Services{activeCategory ? ` · ${activeCategory.label}` : ""}
                </h2>
              </div>
              <button onClick={() => goToServicesSalons("SERVICES")}
                className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#FF6B00" }}>
                Voir tout →
              </button>
            </div>
            {loadingServices && filteredServices.length === 0 ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : filteredServices.length === 0 ? (
              <p className="text-[12px] font-black text-gray-300 uppercase tracking-widest text-center py-4">Aucun service trouvé</p>
            ) : (
              <div className="space-y-3">
                {filteredServices.map(s => {
                  let serviceImg = s.image_url || null;
                  let isVideo = false;
                  if (!serviceImg && s.images) {
                    const imgs = typeof s.images === "string" ? JSON.parse(s.images) : s.images;
                    if (Array.isArray(imgs) && imgs.length > 0) {
                      serviceImg = imgs[0];
                      isVideo = isVideoUrl(imgs[0]);
                    }
                  }
                  if (!isVideo && serviceImg) isVideo = isVideoUrl(serviceImg);
                  const pro = pros.find(p => p.user_email === s.pro_email);
                  const proName = pro?.salon_name || s.pro_email?.split("@")[0] || "";
                  return (
                    <button key={s.id}
                      onClick={() => navigate(`/service/${s.id}`, { state: { title: s.title, price: s.price, cover: serviceImg } })}
                      className="w-full bg-white rounded-[20px] border border-gray-100 flex items-center gap-4 p-3 active:scale-[0.99] transition-all text-left"
                      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                      {serviceImg ? (
                        isVideo ? (
                          <VideoThumb src={serviceImg} alt={s.title} className="w-[72px] h-[72px] rounded-[16px] object-cover shrink-0" />
                        ) : (
                          <BeautyImage src={serviceImg} alt={s.title} className="w-[72px] h-[72px] rounded-[16px] object-cover shrink-0" />
                        )
                      ) : (
                        <div className="w-[72px] h-[72px] rounded-[16px] bg-orange-50 shrink-0 flex items-center justify-center">
                          <User className="w-6 h-6" style={{ color: "#FF6B00" }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-black text-gray-900 truncate">{s.title}</p>
                        {proName && (
                          <p className="text-[11px] text-gray-400 font-medium truncate flex items-center gap-1 mt-0.5">
                            <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                            {proName}
                          </p>
                        )}
                        {(s.duration || s.duration_min) && (
                          <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                            🕐 {s.duration || s.duration_min} min
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        <span className="text-[17px] font-black" style={{ color: "#FF6B00" }}>{s.price}€</span>
                        <span className="text-[10px] font-black text-white px-2.5 py-1 rounded-full"
                          style={{ background: "#FF6B00" }}>
                          Réserver
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Salons ── */}
        {(activeTab === "all" || activeTab === "salons") && (
          <section>
            <div className="px-5 flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">🏢</span>
                <h2 className="text-[14px] font-black text-gray-900">
                  Salons{activeCategory ? ` · ${activeCategory.label}` : ""}
                </h2>
              </div>
              <button onClick={() => goToServicesSalons("SALONS")}
                className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#FF6B00" }}>
                Voir tout →
              </button>
            </div>
            {filteredSalons.length === 0 ? (
              <p className="text-[12px] font-black text-gray-300 uppercase tracking-widest text-center py-4 px-5">Aucun salon trouvé</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-0 px-5 pb-1">
                {filteredSalons.map(salon => {
                  const proServices = services.filter(s => s.pro_email === salon.user_email);
                  const minPrice = proServices.length > 0 ? Math.min(...proServices.map(s => s.price || 0)) : 0;
                  return (
                    <button
                      key={salon.id}
                      onClick={() => navigate("/pro/vue-client", { state: { proEmail: salon.user_email } })}
                      className="shrink-0 w-[180px] bg-white rounded-[22px] border border-gray-100 overflow-hidden active:scale-[0.98] transition-all text-left"
                      style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                      <div className="relative h-[130px]">
                        <BeautyImage src={salon.avatar_url || salon.cover_url || ""} alt={salon.salon_name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <div className="absolute top-2 right-2 bg-white/95 rounded-xl px-2 py-1 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" style={{ color: "#FF6B00" }} />
                          <span className="text-[11px] font-black text-gray-900">{salon.rating || "—"}</span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-[13px] font-black text-gray-900 truncate">{salon.salon_name}</p>
                        <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {salon.city || "Paris"}
                        </p>
                        {minPrice > 0 && (
                          <p className="text-[14px] font-black mt-1.5" style={{ color: "#FF6B00" }}>Dès {minPrice}€</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Particuliers ── */}
        {(activeTab === "all" || activeTab === "particuliers") && (
          <section>
            <div className="px-5 flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">👤</span>
                <h2 className="text-[14px] font-black text-gray-900">
                  Particuliers{activeCategory ? ` · ${activeCategory.label}` : ""}
                </h2>
              </div>
              <button onClick={() => goToServicesSalons("PARTICULIERS")}
                className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#FF6B00" }}>
                Voir tout →
              </button>
            </div>
            {filteredParticuliers.length === 0 ? (
              <p className="text-[12px] font-black text-gray-300 uppercase tracking-widest text-center py-4 px-5">Aucun particulier trouvé</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pb-1">
                {filteredParticuliers.map(p => {
                  const proServices = services.filter(s => s.pro_email === p.user_email);
                  const minPrice = proServices.length > 0 ? Math.min(...proServices.map(s => s.price || 0)) : 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate("/pro/vue-client", { state: { proEmail: p.user_email } })}
                      className="shrink-0 w-[150px] bg-white rounded-[22px] border border-gray-100 overflow-hidden active:scale-[0.98] transition-all text-left"
                      style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                      <div className="relative h-[150px]">
                        <BeautyImage src={p.avatar_url || ""} alt={p.salon_name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        {/* Availability dot */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 rounded-full px-2 py-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          <span className="text-[9px] font-black text-gray-700">Dispo</span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-[12px] font-black text-gray-900 truncate">{p.salon_name}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: "#FF6B00" }}>
                          {(p.specialites || [])[0] || "PRO"}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          {minPrice > 0 && <p className="text-[13px] font-black text-gray-800">{minPrice}€</p>}
                          {p.rating > 0 && (
                            <div className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-current" style={{ color: "#FF6B00" }} />
                              <span className="text-[10px] font-black text-gray-600">{p.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}