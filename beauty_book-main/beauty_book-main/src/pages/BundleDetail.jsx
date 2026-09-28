import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft, Heart, Share2, Timer, Percent, Star, MapPin,
  BadgeCheck, ChevronRight, ChevronDown, Calendar, Shield, Sparkles, Package, Scissors, Gift, Clock
} from "lucide-react";
import { entities } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { readPageCache, mergePageCache, useCachedState } from "@/hooks/usePageCache";

function ServiceImageSlider({ images }) {
  const validImages = (images || []).filter(Boolean);
  if (validImages.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1.5 hide-scrollbar">
      {validImages.map((imgUrl, i) => (
        <BeautyImage
          key={i}
          src={imgUrl}
          alt=""
          className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-100 shadow-sm"
        />
      ))}
    </div>
  );
}

export default function BundleDetail() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();
  const cacheKey = id ? `bundle_${id}` : null;
  // Affichage direct depuis le cache : la dernière fiche connue s'affiche
  // immédiatement, le rafraîchissement réseau se fait en arrière-plan.
  const [bundle, setBundle] = useCachedState(cacheKey, state?.bundle || null, c => c?.bundle ?? null);
  const [services, setServices] = useCachedState(cacheKey, [], c => c?.services || []);
  const [proProfile, setProProfile] = useCachedState(cacheKey, null, c => c?.proProfile ?? null);
  const [reviews, setReviews] = useCachedState(cacheKey, [], c => c?.reviews || []);
  const [similarBundles, setSimilarBundles] = useCachedState(cacheKey, [], c => c?.similarBundles || []);
  const [servicesMap, setServicesMap] = useCachedState(cacheKey, {}, c => c?.servicesMap || {});
  const [loading, setLoading] = useState(() => !(state?.bundle || readPageCache(cacheKey)?.bundle));
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const key = `bundle_${id}`;
    // Navigation d'un bundle à l'autre : afficher le cache du nouveau bundle
    // (ou le bundle passé en state de navigation) plutôt qu'un spinner vide.
    const navBundle = state?.bundle?.id === id ? state.bundle : null;
    const cached = readPageCache(key);
    const shown = navBundle || cached?.bundle || null;
    if (shown) {
      setBundle(shown);
      setServices(cached?.services || []);
      setProProfile(cached?.proProfile ?? null);
      setReviews(cached?.reviews || []);
      setSimilarBundles(cached?.similarBundles || []);
      setServicesMap(cached?.servicesMap || {});
      setLoading(false);
      refreshDetails(key, shown);
    } else {
      setBundle(null); setServices([]); setProProfile(null); setReviews([]); setSimilarBundles([]); setServicesMap({});
      setLoading(true);
      entities.ServiceBundle.filter({ id }, "-created_at", 1).then(rows => {
        if (rows[0]) { setBundle(rows[0]); refreshDetails(key, rows[0]); }
        else setLoading(false);
      }).catch(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const refreshDetails = async (key, b) => {
    try {
      const [allSvcs, profils, avisData, allBundles] = await Promise.all([
        entities.Service.filter({}, "-created_at", 500).catch(() => []),
        entities.ProfilPro.filter({ user_email: b.pro_email }, "-created_at", 1).catch(() => []),
        entities.Avis.filter({ cible_email: b.pro_email, type: "client_to_pro" }, "-created_at", 20).catch(() => []),
        entities.ServiceBundle.filter({ is_active: true, pro_email: b.pro_email }, "-created_at", 10).catch(() => []),
      ]);

      const map = {};
      (allSvcs || []).forEach(s => {
        if (s.id) map[s.id] = s;
        if (s.title) map[s.title] = s;
        if (s.name) map[s.name] = s;
      });
      setServicesMap(map);

      const matched = (allSvcs || []).filter(s => b.service_ids?.includes(s.id));
      setServices(matched);
      const profil = profils[0] || null;
      setProProfile(profil);
      const avis = avisData || [];
      setReviews(avis);
      const sim = (allBundles || []).filter(x => x.id !== b.id).slice(0, 4);
      setSimilarBundles(sim);
      mergePageCache(key, { bundle: b, services: matched, proProfile: profil, reviews: avis, similarBundles: sim, servicesMap: map });
    } catch (err) {
      console.error("BundleDetail load error:", err);
    }
    setLoading(false);
  };

  if (loading && !bundle) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-[#E8732A] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!bundle) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-gray-400 font-medium">Bundle introuvable</p>
      <button onClick={() => navigate(-1)} className="text-primary font-black text-[14px]">← Retour</button>
    </div>
  );

  const totalDuration = services.reduce((sum, s) => sum + (parseInt(s.duration || s.duration_min) || 60), 0);
  const durH = Math.floor(totalDuration / 60);
  const durM = totalDuration % 60;
  const durStr = durH > 0 ? `${durH}h${durM > 0 ? String(durM).padStart(2, '0') : ''}` : `${durM}min`;

  const regularTotal = services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const savings = regularTotal - (bundle.bundle_price || 0);
  const savingsPercent = bundle.discount_percent || (regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0);
  const avgRating = proProfile?.rating || (reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.note || r.rating || 5), 0) / reviews.length).toFixed(1) : "4.9");

  const proDisplayName = proProfile?.salon_name || (proProfile?.prenom ? `${proProfile.prenom} ${proProfile.nom || ''}`.trim() : proProfile?.nom) || proProfile?.name || "Salon Professionnel";

  const fmtDur = (s) => {
    const m = parseInt(s.duration || s.duration_min) || 60;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return h > 0 ? `${h}h${rm > 0 ? String(rm).padStart(2, "0") : ""}` : `${rm} min`;
  };

  const handleStartBooking = () => {
    navigate("/reservation", {
      state: {
        services: services.length > 0 ? services.map(s => ({ ...s, persons: 1 })) : [{ id: bundle.id, name: bundle.name, title: bundle.name, price: bundle.bundle_price, duration_min: totalDuration || 60, pro_email: bundle.pro_email, category: bundle.category || "Coiffure" }],
        bundle,
        proEmail: bundle.pro_email,
        skipToStep1: true
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#FFF5F0] font-display pb-48">
      {/* Hero Header */}
      <div className="relative h-[320px] overflow-hidden rounded-b-[32px]">
        {bundle.image_url ? (
          <BeautyImage src={bundle.image_url} alt={bundle.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-100 via-orange-100 to-pink-100 flex items-center justify-center">
            <Package className="w-16 h-16 text-[#E8732A]/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Top Navbar overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-3 z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center active:scale-95 shadow-md">
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center active:scale-95 shadow-md">
              <Heart className="w-4 h-4 text-gray-500" />
            </button>
            <button className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center active:scale-95 shadow-md">
              <Share2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Hero Title (Clean, NO 'beauty book' text) */}
        <div className="absolute bottom-6 left-5 right-5 z-10">
          <span className="inline-block bg-[#E8732A] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-2 shadow-sm">
            {bundle.bonus || (bundle.is_group ? "Bundle Groupe" : "Offre Spéciale ✨")}
          </span>
          <h1 className="text-[26px] font-black text-white leading-tight drop-shadow-md">
            {bundle.name}
          </h1>
          {bundle.description && (
            <p className="text-[13px] text-white/90 mt-1 line-clamp-2 leading-relaxed drop-shadow">
              {bundle.description}
            </p>
          )}
        </div>
      </div>

      <div>
        {/* Floating Stats Row */}
        <div className="mx-4 -mt-6 bg-white rounded-[24px] shadow-lg border border-gray-100 p-4 flex items-center justify-around relative z-10">
          <div className="text-center">
            <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-1.5">
              <Timer className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-[11px] text-gray-400 font-medium">Durée totale</p>
            <p className="text-[16px] font-black text-gray-900 mt-0.5">{durStr}</p>
          </div>
          <div className="w-px h-12 bg-gray-100" />
          <div className="text-center">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-1.5">
              <Percent className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-[11px] text-gray-400 font-medium">Économisez</p>
            <p className="text-[16px] font-black text-[#E8732A] mt-0.5">{savingsPercent}%</p>
          </div>
          <div className="w-px h-12 bg-gray-100" />
          <div className="text-center">
            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-1.5">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <p className="text-[11px] text-gray-400 font-medium">Note</p>
            <p className="text-[16px] font-black text-gray-900 mt-0.5">{avgRating}/5</p>
          </div>
        </div>

        {/* Section PROFESSIONNEL (Commercial Name) */}
        <div className="mx-4 mt-6">
          <h3 className="text-[13px] text-gray-400 font-bold uppercase tracking-wider mb-3">Professionnel</h3>
          <button
            onClick={() => navigate("/pro/vue-client", { state: { email: bundle.pro_email } })}
            className="w-full bg-white rounded-[20px] border border-gray-100 p-4 flex items-center gap-3.5 active:scale-[0.98] transition-all shadow-sm"
          >
            <div className="w-13 h-13 rounded-full overflow-hidden bg-gradient-to-br from-[#E8732A] to-[#E84466] shrink-0 flex items-center justify-center border-2 border-orange-100">
              {proProfile?.avatar_url || proProfile?.photo_url ? (
                <BeautyImage src={proProfile.avatar_url || proProfile.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-lg font-black">{proDisplayName[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[16px] font-black text-gray-900 truncate">{proDisplayName}</p>
                <BadgeCheck className="w-4 h-4 text-[#E8732A] shrink-0" />
              </div>
              {proProfile?.address && (
                <p className="text-[12px] text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" /> {proProfile.address}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-0.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-[12px] font-bold text-gray-700">{avgRating}</span>
                </div>
                <span className="text-[11px] text-gray-300">|</span>
                <span className="text-[12px] text-gray-400">{reviews.length} avis</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
          </button>
        </div>

        {/* Ce que comprend ce bundle */}
        <div className="px-4 mt-7">
          <h3 className="text-[18px] font-black text-gray-900 mb-4">Ce que comprend ce bundle</h3>
          <div className="space-y-0">
            {services.map((s, i) => (
              <div key={s.id}>
                <button
                  onClick={() => navigate("/service/" + s.id, { state: { service: s } })}
                  className="w-full flex items-center gap-4 py-3.5 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                    {s.image_url || (s.images && s.images[0]) ? (
                      <BeautyImage src={s.image_url || s.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-orange-50">
                        <Sparkles className="w-6 h-6 text-[#E8732A]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-gray-900">{s.title || s.name}</p>
                    {s.description && (
                      <p className="text-[12px] text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">{s.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[12px] text-gray-400 font-medium flex items-center gap-1 justify-end">
                      <Timer className="w-3.5 h-3.5" /> {fmtDur(s)}
                    </span>
                    <p className="text-[17px] font-black text-gray-900 mt-1">{s.price} €</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
                {i < services.length - 1 && (
                  <div className="flex justify-center -my-1 relative z-10">
                    <div className="w-7 h-7 bg-[#E8732A] rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-white text-lg font-bold leading-none">+</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary Card */}
        <div className="mx-4 mt-6 bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-gray-400 font-medium">Prix total</p>
              <p className="text-[16px] text-gray-400 line-through">{regularTotal} €</p>
            </div>
            <div className="text-center">
              <p className="text-[12px] text-[#E8732A] font-black uppercase">Prix bundle</p>
              <p className="text-[32px] font-black text-[#E8732A] leading-tight">{bundle.bundle_price} €</p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2 text-center">
              <p className="text-[10px] font-black text-rose-500 uppercase">ÉCONOMISEZ</p>
              <p className="text-[14px] font-black text-rose-500">{savings > 0 ? savings : Math.abs(savings)} € ({savingsPercent}%)</p>
            </div>
          </div>
          {bundle.bonus && (
            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-50">
              <div className="w-7 h-7 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#E8732A]" />
              </div>
              <p className="text-[13px] text-gray-600 font-medium">
                <span className="font-black text-gray-800">Bonus inclus :</span> {bundle.bonus}
              </p>
            </div>
          )}
        </div>

        {/* Avis clients section — ALWAYS VISIBLE */}
        <div className="mx-4 mt-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-black text-gray-900">Avis des clientes</h3>
            <span className="text-[13px] text-gray-400 font-medium">{reviews.length} avis</span>
          </div>

          {reviews.length === 0 ? (
            <div className="bg-white rounded-[22px] border border-gray-100 p-6 text-center shadow-sm">
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Star className="w-6 h-6 text-[#E8732A]" />
              </div>
              <p className="text-[14px] font-black text-gray-900 mb-1">Aucun avis pour le moment</p>
              <p className="text-[12px] text-gray-400 font-medium max-w-xs mx-auto">
                Soyez la première personne à réserver ce bundle et partager votre expérience !
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3.5">
                {(showAllReviews ? reviews : reviews.slice(0, 5)).map((r, i) => {
                  const assocService = servicesMap[r.service_id] || servicesMap[r.service_name] || services[0] || null;
                  const serviceTitle = r.service_name || assocService?.title || assocService?.name || "Prestation générale";
                  const serviceImgs = assocService?.images?.length > 0 ? assocService.images : (assocService?.image_url ? [assocService.image_url] : []);

                  return (
                    <div key={r.id || i} className="bg-white rounded-[22px] border border-gray-100 p-4 shadow-sm space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center shrink-0 border border-orange-200">
                          {r.user_avatar || r.auteur_avatar ? (
                            <BeautyImage src={r.user_avatar || r.auteur_avatar} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <span className="text-xs font-black text-[#E8732A]">
                              {(r.user_name || r.auteur_name || r.auteur_email || "C")[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-gray-900 truncate">{r.user_name || r.auteur_name || "Cliente"}</p>
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, si) => (
                              <Star key={si} className={"w-3 h-3 " + (si < (r.rating || r.note || 5) ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
                            ))}
                          </div>
                        </div>
                        {r.created_at && (
                          <span className="text-[10px] text-gray-400 font-bold">
                            {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>

                      {(r.comment || r.commentaire) && (
                        <p className="text-[13px] text-gray-600 leading-relaxed font-medium">{r.comment || r.commentaire}</p>
                      )}

                      {/* Associated service line & image slider */}
                      <div className="mt-2 pt-2.5 border-t border-gray-100 bg-orange-50/40 rounded-xl p-2.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-gray-800">
                          <Scissors className="w-3.5 h-3.5 text-[#E8732A]" />
                          <span>Prestation : {serviceTitle}</span>
                        </div>
                        {serviceImgs.length > 0 && (
                          <ServiceImageSlider images={serviceImgs} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!showAllReviews && reviews.length > 5 && (
                <button
                  onClick={() => setShowAllReviews(true)}
                  className="w-full mt-4 py-3 rounded-2xl border-2 border-[#E8732A] bg-white text-[#E8732A] text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <ChevronDown className="w-4 h-4" />
                  Voir les {reviews.length} avis
                </button>
              )}
              {showAllReviews && reviews.length > 5 && (
                <button
                  onClick={() => { setShowAllReviews(false); document.querySelector('.mx-4.mt-7')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="w-full mt-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <ChevronDown className="w-4 h-4 rotate-180" />
                  Voir moins
                </button>
              )}
            </>
          )}
        </div>

        {/* Bundles similaires */}
        {similarBundles.length > 0 && (
          <div className="mx-4 mt-8">
            <h3 className="text-[18px] font-black text-gray-900 mb-4">Bundles similaires</h3>
            <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory hide-scrollbar">
              {similarBundles.map((sb) => (
                <button
                  key={sb.id}
                  onClick={() => navigate(`/bundle/${sb.id}`, { state: { bundle: sb } })}
                  className="snap-start shrink-0 w-[200px] bg-white rounded-[22px] border border-gray-100 overflow-hidden active:scale-[0.97] transition-all text-left shadow-sm"
                >
                  <div className="h-[105px] overflow-hidden bg-gray-100 relative">
                    {sb.image_url ? (
                      <BeautyImage src={sb.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-50 to-orange-50 flex items-center justify-center">
                        <Package className="w-8 h-8 text-[#E8732A]/40" />
                      </div>
                    )}
                    {sb.discount_percent > 0 && (
                      <span className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        -{sb.discount_percent}%
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[13px] font-black text-gray-900 truncate">{sb.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{sb.service_ids?.length || 1} services inclus</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[16px] font-black text-[#E8732A]">{sb.bundle_price} €</p>
                      {sb.is_group && (
                        <span className="text-[9px] font-bold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full uppercase">Groupe</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom CTA (positioned above bottom navigation bar — nav is 68px + safe-area) */}
      <div className="fixed bottom-28 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-3 z-[90] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={handleStartBooking}
          className="w-full py-4 rounded-2xl font-black text-[15px] uppercase tracking-widest text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #E8732A, #E84466)", boxShadow: "0 8px 25px rgba(232,115,42,0.35)" }}
        >
          <Calendar className="w-5 h-5" /> RÉSERVER CE BUNDLE
        </button>
        <p className="text-center text-[10px] text-gray-400 mt-1.5 flex items-center justify-center gap-1 font-medium">
          <Shield className="w-3.5 h-3.5 text-gray-400" /> Paiement 100% sécurisé
        </p>
      </div>
    </div>
  );
}
