import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Star, Heart, Shield, Gift, ChevronRight, ChevronDown, Users, TrendingDown, Calendar, User, Package, Scissors, Sparkles } from "lucide-react";
import { entities } from "@/api/entities";
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

export default function BundleGroupeDetail() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();
  const cacheKey = id ? `bundle_groupe_${id}` : null;
  // Affichage direct depuis le cache : la dernière fiche connue s'affiche
  // immédiatement, le rafraîchissement réseau se fait en arrière-plan.
  const [bundle, setBundle] = useCachedState(cacheKey, state?.bundle || null, c => c?.bundle ?? null);
  const [services, setServices] = useCachedState(cacheKey, [], c => c?.services || []);
  const [proProfile, setProProfile] = useCachedState(cacheKey, null, c => c?.proProfile ?? null);
  const [reviews, setReviews] = useCachedState(cacheKey, [], c => c?.reviews || []);
  const [similarBundles, setSimilarBundles] = useCachedState(cacheKey, [], c => c?.similarBundles || []);
  const [servicesMap, setServicesMap] = useCachedState(cacheKey, {}, c => c?.servicesMap || {});
  const [loading, setLoading] = useState(() => !(state?.bundle || readPageCache(cacheKey)?.bundle));
  const [expandedSvc, setExpandedSvc] = useState(null);
  const [nbPers, setNbPers] = useState(2);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const key = `bundle_groupe_${id}`;
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
    } catch {}
    setLoading(false);
  };

  if (loading && !bundle) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#E8732A] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!bundle) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-gray-400 font-medium">Bundle introuvable</p>
      <button onClick={() => navigate(-1)} className="text-primary font-black text-[14px]">← Retour</button>
    </div>
  );

  const basePers = bundle.min_persons || 2;
  const maxPers = bundle.max_persons || 6;
  const basePrice = bundle.bundle_price || 0;
  const persMultiplier = Math.max(1, nbPers / basePers);
  const displayPrice = Math.round(basePrice * persMultiplier);
  const regularTotal = services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) * nbPers;
  const savings = regularTotal - displayPrice;
  const savingsPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

  const totalDuration = services.reduce((sum, s) => sum + (parseInt(s.duration || s.duration_min) || 60), 0);
  const durH = Math.floor(totalDuration / 60);
  const durM = totalDuration % 60;
  const durStr = durH > 0 ? `${durH}h${durM > 0 ? String(durM).padStart(2, '0') : ''}` : `${durM}min`;

  const proDisplayName = proProfile?.salon_name || (proProfile?.prenom ? `${proProfile.prenom} ${proProfile.nom || ''}`.trim() : proProfile?.nom) || proProfile?.name || "Salon Professionnel";

  const handleStartBooking = () => {
    navigate("/reservation", {
      state: {
        services: services.length > 0 ? services.map(s => ({ ...s, persons: nbPers })) : [{ id: bundle.id, name: bundle.name, title: bundle.name, price: displayPrice, duration_min: totalDuration || 60, pro_email: bundle.pro_email, category: bundle.category || "Coiffure" }],
        bundle,
        nbPers,
        proEmail: bundle.pro_email,
        skipToStep1: true
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-display pb-48">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl px-4 pt-12 pb-3 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-[17px] font-black text-gray-900">Bundle <span className="text-[#E8732A]">Groupe</span></h1>
          <p className="text-[11px] text-gray-400 font-medium">Plusieurs personnes, plus d'éclat ✨</p>
        </div>
        <button className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
          <Heart className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div>
        {/* Hero section */}
        <div className="relative h-[320px] overflow-hidden">
          {bundle.image_url ? (
            <BeautyImage src={bundle.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Badge */}
          <div className="absolute top-4 left-4 z-10">
            <span className="bg-white/95 backdrop-blur text-[10px] font-black text-[#E8732A] px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
              🎉 PARFAIT POUR SORTIE & ÉVÉNEMENTS
            </span>
          </div>

          {/* Name & description */}
          <div className="absolute bottom-6 left-5 right-5 z-10">
            <h2 className="text-[28px] font-black text-white leading-tight drop-shadow-md">{bundle.name}</h2>
            {bundle.description && <p className="text-[13px] text-white/90 mt-1 leading-relaxed drop-shadow">{bundle.description}</p>}
          </div>
        </div>

        {/* Stats row */}
        <div className="mx-4 -mt-5 bg-white rounded-2xl shadow-md border border-gray-100 p-3 flex items-center justify-around relative z-10">
          <div className="text-center">
            <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-1">
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-[9px] text-gray-400 font-medium">{basePers} à {maxPers}</p>
            <p className="text-[10px] font-bold text-gray-700">personnes</p>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="text-center">
            <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-1">
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-[9px] text-gray-400 font-medium">Économisez</p>
            <p className="text-[10px] font-bold text-[#E8732A]">jusqu'à {savingsPercent}%</p>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-[9px] text-gray-400 font-medium">Durée totale</p>
            <p className="text-[10px] font-bold text-gray-700">{durStr}</p>
          </div>
          <div className="w-px h-8 bg-gray-100" />
          <div className="text-center">
            <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
            <p className="text-[9px] text-gray-400 font-medium">Note</p>
            <p className="text-[10px] font-bold text-gray-700">{proProfile?.rating || 4.9}/5</p>
          </div>
        </div>

        {/* Section PROFESSIONNEL */}
        <div className="mx-4 mt-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#E8732A] to-[#E84466] shrink-0 flex items-center justify-center text-white font-black">
              {proProfile?.avatar_url || proProfile?.photo_url ? (
                <BeautyImage src={proProfile.avatar_url || proProfile.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{proDisplayName[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-gray-900 truncate">{proDisplayName}</p>
              <p className="text-[11px] text-gray-400 font-medium">Professionnel Partenaire</p>
            </div>
            <button
              onClick={() => navigate("/pro/vue-client", { state: { email: bundle.pro_email } })}
              className="text-[11px] font-black text-[#E8732A] bg-orange-50 px-3 py-1.5 rounded-xl"
            >
              Voir Profil
            </button>
          </div>
        </div>

        {/* Price card floating */}
        <div className="mx-4 mt-3 bg-gradient-to-r from-[#E8732A] to-[#E84466] rounded-2xl p-4 text-white flex items-center justify-between shadow-md">
          <div>
            <p className="text-[12px] font-bold opacity-90">À partir de</p>
            <p className="text-[32px] font-black leading-tight">{displayPrice} €</p>
            <p className="text-[12px] opacity-80">pour {nbPers} pers.</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] opacity-70">au lieu de</p>
            <p className="text-[16px] font-bold line-through opacity-60">{regularTotal} €</p>
          </div>
        </div>

        {/* Person selector */}
        <div className="px-4 mt-5">
          <p className="text-[15px] font-black text-gray-900 mb-3">Pour qui réservez-vous ce bundle ?</p>
          <div className="flex items-center gap-2">
            {Array.from({ length: maxPers - basePers + 1 }).map((_, i) => {
              const pers = basePers + i;
              const isSelected = nbPers === pers;
              return (
                <button key={pers} onClick={() => setNbPers(pers)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95 ${isSelected ? "border-[#E8732A] bg-orange-50 shadow-sm" : "border-gray-100 bg-white"}`}>
                  <div className="flex">
                    {Array.from({ length: Math.min(pers, 3) }).map((_, j) => (
                      <User key={j} className={`w-4 h-4 ${isSelected ? "text-[#E8732A]" : "text-gray-400"}`} />
                    ))}
                  </div>
                  <span className={`text-[14px] font-black ${isSelected ? "text-[#E8732A]" : "text-gray-900"}`}>{pers}</span>
                  <span className="text-[9px] text-gray-400 font-medium">personnes</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Savings banner */}
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center gap-2">
          <span className="text-lg">🎉</span>
          <p className="text-[12px] font-black text-amber-700">Plus vous êtes, plus vous économisez !</p>
        </div>

        {/* Services included (per person) */}
        <div className="px-4 mt-5">
          <h3 className="text-[16px] font-black text-gray-900 mb-3">Ce que comprend le bundle <span className="text-[13px] font-medium text-gray-400">(par personne)</span></h3>
          <div className="space-y-0 bg-white rounded-2xl border border-gray-100 px-3">
            {services.map((s) => {
              const isExpanded = expandedSvc === s.id;
              const durMin = parseInt(s.duration || s.duration_min) || 60;
              const durH2 = Math.floor(durMin / 60);
              const durM2 = durMin % 60;
              const durDisplay = durH2 > 0 ? `${durH2}h${durM2 > 0 ? String(durM2).padStart(2, '0') : ''}` : `${durM2} min`;
              return (
                <div key={s.id} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => setExpandedSvc(isExpanded ? null : s.id)} className="w-full flex items-center gap-3 py-3 text-left">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      {s.image_url || (s.images && s.images[0]) ? (
                        <BeautyImage src={s.image_url || s.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl bg-gradient-to-br from-pink-50 to-orange-50">💆</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-gray-900">{s.title || s.name}</p>
                      {s.description && <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-gray-400 flex items-center gap-0.5"><Clock className="w-3 h-3" /> {durDisplay}</span>
                      <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </button>
                  {isExpanded && s.description && (
                    <div className="pb-3 pl-15">
                      <p className="text-[12px] text-gray-500 leading-relaxed">{s.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bonus groupe */}
        {bundle.bonus && (
          <div className="mx-4 mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-[13px] font-black text-amber-700">Bonus groupe</p>
              <p className="text-[12px] text-amber-600 mt-0.5">{bundle.bonus} 🎁</p>
            </div>
          </div>
        )}

        {/* Bottom pricing summary */}
        <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Prix total pour {nbPers} personnes</p>
              <p className="text-[18px] font-black text-gray-900">{displayPrice} € <span className="text-[12px] font-medium text-gray-400 line-through">au lieu de {regularTotal} €</span></p>
              <p className="text-[11px] text-gray-400">Soit {Math.round(displayPrice / nbPers)} € par personne</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Économie</p>
              <p className="text-[18px] font-black text-[#E8732A]">{savings} €</p>
              <p className="text-[11px] text-[#E8732A] font-bold">({savingsPercent}%)</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-gray-50">
            <Clock className="w-3 h-3 text-gray-400" />
            <p className="text-[11px] text-gray-400">Durée totale estimée <span className="font-bold text-gray-600">{durStr}</span></p>
            <span className="text-[10px] text-gray-400 ml-auto">Pour tout le groupe</span>
          </div>
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
                Soyez les premières à réserver ce bundle groupe et laisser votre avis !
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
                      </div>
                      {(r.comment || r.commentaire) && (
                        <p className="text-[13px] text-gray-600 leading-relaxed font-medium">{r.comment || r.commentaire}</p>
                      )}
                      <div className="mt-2 pt-2.5 border-t border-gray-100 bg-orange-50/40 rounded-xl p-2.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-gray-800">
                          <Scissors className="w-3.5 h-3.5 text-[#E8732A]" />
                          <span>Prestation : {serviceTitle}</span>
                        </div>
                        {serviceImgs.length > 0 && <ServiceImageSlider images={serviceImgs} />}
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
                  onClick={() => navigate(`/bundle-groupe/${sb.id}`, { state: { bundle: sb } })}
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
          RÉSERVER CE BUNDLE POUR {nbPers} PERS. <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-center text-[10px] text-gray-400 mt-1.5 flex items-center justify-center gap-1 font-medium">
          <Shield className="w-3.5 h-3.5 text-gray-400" /> Paiement 100% sécurisé
        </p>
      </div>
    </div>
  );
}
