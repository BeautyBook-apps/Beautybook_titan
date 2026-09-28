import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Tag, Scissors, Zap, Check, Pencil, Users, Gift, Sparkles, X, Clock, Star, Heart } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { useThemeBg } from "@/hooks/useTheme";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import BundleFormModal from "@/components/pro/BundleFormModal";

function ImageSlider({ images, onClick }) {
  const [current, setCurrent] = useState(0);
  const [failed, setFailed] = useState({});
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 30) {
      if (diff > 0) setCurrent(c => Math.min(c + 1, images.length - 1));
      else setCurrent(c => Math.max(c - 1, 0));
    }
    touchStartX.current = null;
  };

  const validImages = (images || []).filter(u => u && !failed[u]);
  const clampedCurrent = Math.min(current, Math.max(validImages.length - 1, 0));

  if (validImages.length === 0) {
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center"><Scissors className="w-10 h-10 text-gray-300" /></div>;
  }

  return (
    <div className="relative w-full h-full overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={onClick}>
      {validImages.map((url, i) => (
        <BeautyImage key={url} src={url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(${(i - clampedCurrent) * 100}%)` }}
          onError={() => setFailed(p => ({ ...p, [url]: true }))} />
      ))}
      {validImages.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {validImages.map((_, i) => (
            <div key={i} className={`rounded-full transition-all ${i === clampedCurrent ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

const filterTabs = ["Tous", "Actifs", "Brouillons", "BUNDLES"];

export default function CatalogueServices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const themeBg = useThemeBg();
  const cacheKey = user?.email ? `catalogue_${user.email}` : null;
  // Affichage direct depuis le cache : pas d'écran « chargement » intermédiaire,
  // le rafraîchissement réseau se fait en arrière-plan sans vider l'affichage.
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [services, setServices] = useCachedState(cacheKey, [], (c) => c?.services || []);
  const [bundles, setBundles] = useCachedState(cacheKey, [], (c) => c?.bundles || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [proName, setProName] = useCachedState(cacheKey, "", (c) => c?.proName ?? "");
  const [proAvatar, setProAvatar] = useCachedState(cacheKey, "", (c) => c?.proAvatar ?? "");
  const [confirmModal, setConfirmModal] = useState(null);
  const [bundleModal, setBundleModal] = useState({ open: false, editBundle: null });

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;

    // Fetch pro profile for card display
    supabase.from("ProfilPro").select("salon_name, avatar_url").eq("user_email", user.email).maybeSingle()
      .then(({ data }) => {
        if (data && !cancelled) {
          const pn = data.salon_name || "";
          const pa = data.avatar_url || "";
          setProName(pn);
          setProAvatar(pa);
          mergePageCache(cacheKey, { proName: pn, proAvatar: pa });
        }
      });

    // Fetch services
    supabase.from("Service").select("*").eq("pro_email", user.email).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => {
        if (!cancelled) {
          setServices(data || []);
          mergePageCache(cacheKey, { services: data || [] });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Fetch bundles
    supabase.from("ServiceBundle").select("*").eq("pro_email", user.email).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setBundles(data || []);
          mergePageCache(cacheKey, { bundles: data || [] });
        }
      });

    return () => { cancelled = true; };
  }, [user?.email]);

  const toggleActive = async (id) => {
    const svc = services.find(s => s.id === id);
    if (!svc) return;
    const isActive = svc.status === "actif";
    const newStatus = isActive ? "brouillon" : "actif";
    setServices(s => s.map(sv => sv.id === id ? { ...sv, status: newStatus } : sv));
    try {
      const { data, error } = await supabase.from("Service").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id).select();
      if (error) setServices(s => s.map(sv => sv.id === id ? { ...sv, status: svc.status } : sv));
      else if (data?.[0]) setServices(s => s.map(sv => sv.id === id ? { ...sv, status: data[0].status } : sv));
    } catch (e) {
      setServices(s => s.map(sv => sv.id === id ? { ...sv, status: svc.status } : sv));
    }
  };

  const toggleBundleActive = async (bundleId) => {
    const b = bundles.find(x => x.id === bundleId);
    if (!b) return;
    const newActive = b.is_active === false ? true : false;
    setBundles(prev => prev.map(x => x.id === bundleId ? { ...x, is_active: newActive } : x));
    try {
      const { error } = await supabase.from("ServiceBundle").update({ is_active: newActive, updated_at: new Date().toISOString() }).eq("id", bundleId);
      if (error) throw error;
    } catch (err) {
      console.error("Toggle bundle active error:", err);
      setBundles(prev => prev.map(x => x.id === bundleId ? { ...x, is_active: b.is_active } : x));
    }
  };

  const confirmDeleteService = (id) => {
    const svc = services.find(s => s.id === id);
    setConfirmModal({ type: "service", id, name: svc?.title || svc?.name || "Ce service" });
  };

  const confirmDeleteBundle = (id) => {
    const b = bundles.find(x => x.id === id);
    setConfirmModal({ type: "bundle", id, name: b?.name || "Ce bundle" });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal) return;
    const { type, id } = confirmModal;
    if (type === "service") {
      setServices(s => s.filter(sv => sv.id !== id));
      try { await entities.Service.delete(id); } catch {
        entities.Service.filter({ pro_email: user?.email }, "-created_at", 100).then(setServices).catch(() => {});
      }
    } else {
      setBundles(b => b.filter(x => x.id !== id));
      await supabase.from("ServiceBundle").delete().eq("id", id);
    }
    setConfirmModal(null);
  };

  const filtered = services.filter(s => {
    if (activeFilter === "Actifs") return s.status === "actif";
    if (activeFilter === "Brouillons") return s.status !== "actif";
    return true;
  });

  const draftsCount = services.filter(s => s.status !== "actif").length;
  const isPackTab = activeFilter === "BUNDLES";

  const renderContent = () => {
    // Gate : aucun spinner si des données en cache sont déjà affichées.
    if (loading && services.length === 0 && bundles.length === 0) {
      return (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (isPackTab) {
      return (
        <div className="space-y-4">
          {bundles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-[32px] border border-gray-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl flex items-center justify-center mb-5 border border-orange-100/50 shadow-inner">
                <Zap className="w-9 h-9 text-[#ff6b35]" strokeWidth={2.2} />
              </div>
              <p className="text-[20px] font-black text-gray-900 mb-2 tracking-tight">Aucun bundle</p>
              <p className="text-[13px] text-gray-400 max-w-xs leading-relaxed font-medium">
                Créez des packs de services pour fidéliser vos clients et augmenter vos revenus.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {bundles.map(b => {
                const isActive = b.is_active !== false;
                const includedSvcs = services.filter(s => b.service_ids?.includes(s.id));
                const totalSvcCount = includedSvcs.length || b.service_ids?.length || 1;
                const totalDuration = includedSvcs.reduce((sum, s) => sum + (parseInt(s.duration || s.duration_min) || 60), 0);
                const durationStr = totalDuration >= 60 ? `${Math.floor(totalDuration / 60)}h${totalDuration % 60 > 0 ? String(totalDuration % 60).padStart(2, '0') : '00'}` : `${totalDuration}min`;
                const regTotal = includedSvcs.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) || Math.round((b.bundle_price || 100) * 1.25);
                const savPct = b.discount_percent || (regTotal > b.bundle_price ? Math.round(((regTotal - b.bundle_price) / regTotal) * 100) : 15);
                const badgeText = b.bonus || b.category || (b.is_group ? "Parfait entre amies" : "Offre Spéciale ✨");

                return (
                  <div key={b.id} className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-3.5 transition-all ${!isActive ? "opacity-60 grayscale" : ""}`}>
                    {/* Top Row: Thumbnail + Details + Price (Click opens detail view) */}
                    <div
                      onClick={() => navigate(b.is_group ? `/bundle-groupe/${b.id}` : `/bundle/${b.id}`, { state: { bundle: b } })}
                      className="flex items-start gap-3.5 cursor-pointer active:scale-[0.99] transition-all"
                    >
                      {/* Thumbnail with Badge */}
                      <div className="relative w-28 h-36 shrink-0 rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-pink-100 to-orange-100">
                        {b.image_url ? (
                          <BeautyImage src={b.image_url} alt={b.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-orange-50">
                            <Zap className="w-10 h-10 text-orange-400" />
                          </div>
                        )}
                        {/* Top-left Badge on Image */}
                        <div className="absolute top-2 left-2 max-w-[90%] bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md truncate">
                          {badgeText}
                        </div>
                      </div>

                      {/* Main Details */}
                      <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between self-stretch">
                        <div>
                          {/* Title */}
                          <h4 className="text-[16px] font-black text-gray-900 leading-snug truncate">
                            {b.name}
                          </h4>

                          {/* Subtitle / Description */}
                          <p className="text-[12px] font-medium text-gray-400 line-clamp-2 mt-0.5 leading-tight">
                            {b.description || includedSvcs.map(s => s.title || s.name).join(" + ") || "Formule complète avec soin et finition"}
                          </p>

                          {/* Author line */}
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-5 h-5 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center shrink-0 border border-orange-200">
                              {proAvatar ? (
                                <BeautyImage src={proAvatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[9px] font-black text-orange-600">{(proName || "P")[0]}</span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-gray-700 truncate">
                              By {proName || "Salon Pro"}
                            </span>
                            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-black shrink-0">✓</span>
                            <div className="flex items-center gap-0.5 text-[11px] font-bold text-gray-600 ml-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>4.9</span>
                            </div>
                          </div>
                        </div>

                        {/* Metrics Bar */}
                        <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400 mt-2">
                          <span className="flex items-center gap-1">
                            <Scissors className="w-3.5 h-3.5 text-gray-400" /> {totalSvcCount} service{totalSvcCount !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" /> {durationStr}
                          </span>
                        </div>
                      </div>

                      {/* Right Price Column */}
                      <div className="flex flex-col items-end justify-between self-stretch py-0.5 shrink-0 pl-1">
                        {/* Savings Badge */}
                        <span className="bg-pink-50 border border-pink-100 text-pink-600 text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                          Économisez {savPct}%
                        </span>

                        {/* Price */}
                        <div className="text-right mt-2">
                          <div className="flex items-baseline justify-end gap-1.5">
                            <span className="text-[22px] font-black text-gray-900 leading-none">{b.bundle_price} €</span>
                            {regTotal > b.bundle_price && (
                              <span className="text-[12px] font-bold text-gray-400 line-through leading-none">{regTotal} €</span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                            {b.is_group ? `pour ${b.min_persons || 2} pers.` : "à partir de"}
                          </p>
                        </div>

                        {/* Persons */}
                        <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1 mt-2">
                          <Users className="w-3 h-3 text-gray-400" /> {b.min_persons && b.min_persons > 1 ? `${b.min_persons} personnes` : "1 personne"}
                        </span>
                      </div>
                    </div>

                    {/* Controls Footer for Seller */}
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-3">
                      {/* Active Status Toggle */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBundleActive(b.id)}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isActive ? "bg-primary" : "bg-gray-300"}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full shadow transition-transform bg-white ${isActive ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                        <span className={`text-[11px] font-black ${isActive ? "text-green-600" : "text-gray-400"}`}>
                          {isActive ? "Bundle Actif" : "Désactivé"}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/pro/promo-service/${b.id}`, { state: { service: b, isBundle: true } })}
                          className="bg-[#ff6b35]/10 text-[#ff6b35] border border-[#ff6b35]/20 font-bold text-[11px] px-3.5 py-1.5 rounded-xl active:scale-95 transition-all flex items-center gap-1"
                        >
                          <Tag className="w-3.5 h-3.5" /> Pub
                        </button>
                        <button
                          onClick={() => setBundleModal({ open: true, editBundle: b })}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] px-3.5 py-1.5 rounded-xl active:scale-95 transition-all flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Modifier
                        </button>
                        <button
                          onClick={() => confirmDeleteBundle(b.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-500 font-bold text-[11px] px-3.5 py-1.5 rounded-xl active:scale-95 transition-all flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center">
            <Scissors className="w-10 h-10 text-primary" />
          </div>
          <p className="text-[16px] font-black text-gray-700">Aucun service</p>
          <p className="text-[13px] text-gray-400">Ajoutez votre premier service ci-dessous.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filtered.map(service => {
          const isActive = service.status === "actif";
          const isDraft = !isActive;
          return (
            <div key={service.id} className={`bg-white rounded-3xl overflow-hidden shadow-sm transition-all ${isDraft ? "opacity-60 grayscale" : ""}`}>
              <div className="relative h-44 cursor-pointer">
                {(() => {
                  const imgs = [];
                  if (service.image_url) imgs.push(service.image_url);
                  if (service.images?.length > 0) service.images.forEach(u => { if (u && u !== service.image_url) imgs.push(u); });
                  return <ImageSlider images={imgs} onClick={() => navigate(`/service/${service.id}`, { state: { service } })} />;
                })()}
                {isDraft && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-orange-500 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full">Brouillon</span>
                  </div>
                )}
                {isActive && (
                  <span className="absolute top-3 left-3 bg-teal-400 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest z-10">Disponible</span>
                )}
                <span className="absolute top-3 right-3 bg-black/60 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-widest z-10">{service.category}</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 onClick={() => navigate(`/service/${service.id}`, { state: { service } })}
                    className={`text-[22px] font-black leading-tight flex-1 cursor-pointer active:opacity-70 ${isActive ? "text-gray-900" : "text-gray-400"}`}>{service.title}</h3>
                  <div className="flex items-center gap-2 mt-1 shrink-0">
                    <button onClick={() => toggleActive(service.id)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-gray-300"}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full shadow transition-transform bg-white ${isActive ? "translate-x-7" : "translate-x-1"}`} />
                    </button>
                    <button onClick={() => confirmDeleteService(service.id)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {service.description && (
                  <p className={`text-[12px] font-medium leading-snug mb-4 ${isActive ? "text-gray-400" : "text-gray-300"}`}>{service.description}</p>
                )}
                <div onClick={() => navigate(`/service/${service.id}`, { state: { service } })} className="flex items-end gap-6 mb-3 cursor-pointer active:opacity-80">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Durée</p>
                    <p className={`text-[18px] font-black leading-none ${isActive ? "text-gray-900" : "text-gray-400"}`}>{service.duration || service.duration_min || 60}</p>
                    <p className="text-[11px] font-bold text-gray-400">min</p>
                  </div>
                  <div className="ml-auto bg-gray-50 rounded-2xl px-5 py-3 text-right">
                    <p className={`text-[26px] font-black leading-none ${isActive ? "text-gray-900" : "text-gray-400"}`}>{Number(service.price).toFixed(2)}</p>
                    <p className={`text-[18px] font-black leading-none ${isActive ? "text-gray-900" : "text-gray-400"}`}>€</p>
                  </div>
                </div>
                {isDraft ? (
                  <button onClick={() => navigate("/pro/ajouter-service", { state: { editService: service } })}
                    className="w-full flex items-center justify-center gap-2 bg-orange-50 border border-orange-200 rounded-2xl py-3 active:scale-[0.98] transition-all">
                    <span className="text-[12px] font-black text-orange-500 uppercase tracking-widest">✏️ Continuer la saisie</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => navigate("/pro/ajouter-service", { state: { editService: service } })}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-100 border border-gray-200 rounded-2xl py-3 active:scale-[0.98] transition-all">
                      <span className="text-[12px] font-black text-gray-600 uppercase tracking-widest">✏️ Modifier</span>
                    </button>
                    <button onClick={() => navigate(`/pro/promo-service/${service.id}`, { state: { service } })}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#ff6b35]/10 text-[#ff6b35] border border-[#ff6b35]/20 rounded-2xl py-3 active:scale-[0.98] transition-all">
                      <Tag className="w-4 h-4 text-[#ff6b35]" />
                      <span className="text-[12px] font-black text-[#ff6b35] uppercase tracking-widest">Pub</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="font-display min-h-full" style={{ background: themeBg }}>
      <PageHeader
        title="Catalogue Services"
        subtitle="Gestion Professionnelle"
        dark={false}
        right={
          <button onClick={() => isPackTab ? setBundleModal({ open: true, editBundle: null }) : navigate("/pro/ajouter-service")} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
            <Plus className="w-5 h-5 text-gray-700" />
          </button>
        }
      />

      <div className="px-5 pt-5 space-y-5 pb-32">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-white rounded-3xl p-1.5 border border-gray-100 shadow-sm">
          {filterTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`flex-1 py-3 rounded-2xl text-[12px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeFilter === tab ? "bg-[#121826] text-white shadow-md" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
              {tab === "Brouillons" && draftsCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeFilter === tab ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                  {draftsCount}
                </span>
              )}
              {tab === "BUNDLES" && bundles.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeFilter === tab ? "bg-white/20 text-white" : "bg-orange-100 text-orange-600"}`}>
                  {bundles.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {renderContent()}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5" style={{ paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        {isPackTab ? (
          <button
            onClick={() => setBundleModal({ open: true, editBundle: null })}
            className="w-full bg-gradient-to-r from-[#ff6b35] to-[#f7931e] text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-orange-500/40 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            Ajouter un Bundle
          </button>
        ) : (
          <button
            onClick={() => navigate("/pro/ajouter-service")}
            className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-primary/40 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            Ajouter un Service
          </button>
        )}
      </div>

      {/* Confirmation modal for deletion */}
      {confirmModal && (
        <div className="fixed inset-0 z-[400] flex items-end justify-center" onClick={() => setConfirmModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl px-5 pt-6 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-[16px] font-black text-gray-900">Supprimer « {confirmModal.name} » ?</p>
              <p className="text-[13px] text-gray-400 mt-1">Cette action est irréversible.</p>
            </div>
            <div className="space-y-2">
              <button onClick={handleConfirmDelete}
                className="w-full bg-red-500 text-white font-black text-[13px] uppercase tracking-widest py-3.5 rounded-2xl shadow-lg shadow-red-500/30 active:scale-95 transition-all">
                Supprimer définitivement
              </button>
              <button onClick={() => setConfirmModal(null)}
                className="w-full text-gray-400 font-bold text-[12px] py-2 active:scale-95 transition-all">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bundle creation & edition modal */}
      <BundleFormModal
        open={bundleModal.open}
        editBundle={bundleModal.editBundle}
        services={services}
        onClose={() => setBundleModal({ open: false, editBundle: null })}
        onSaved={(updatedBundles) => {
          setBundles(updatedBundles);
          setBundleModal({ open: false, editBundle: null });
          setActiveFilter("BUNDLES");
        }}
      />
    </div>
  );
}
