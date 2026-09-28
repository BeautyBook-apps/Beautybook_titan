import { useLiveSessions } from '@/hooks/useLiveSessions';
import BeautyImage from '@/components/ui/BeautyImage';
import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useCallback, useEffect, useRef } from "react";
import { Star, MapPin, Award, Users, Flame, ChevronRight, Radio, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { GLOBAL_CATEGORIES } from "@/lib/categories";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useLocale } from "@/hooks/useLocale";
import UserGuide from "@/components/UserGuide";


function getSectionBg() {
  const t = localStorage.getItem("bb_theme") || "light";
  if (t === "night") return "#0a0a0a";
  if (t === "dark") return "#1a1a2e";
  return "#FFF5F0";
}

// ── Cache page d'accueil ─────────────────────────────────────────────────────
// La page s'initialise depuis ce cache : affichage direct des dernières
// données connues dès la première peinture, sans page vide intermédiaire.
// Le cache est réécrit en arrière-plan à chaque chargement frais.
const HOME_CACHE_KEY = "home_cache_v1";
function readHomeCache() {
  try { return JSON.parse(localStorage.getItem(HOME_CACHE_KEY) || "null") || {}; }
  catch { return {}; }
}
function writeHomeCache(patch) {
  try {
    const prev = readHomeCache();
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {}
}



// Placeholder pour images manquantes


// ── Hero Banner ──────────────────────────────────────────────────────────────
function HeroSlider({ banners, user, navigate }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);
  const banner = banners[idx] || {};

  return (
    <div className="px-4 pt-5 pb-3">
      {/* Hero Card */}
      <div className="relative rounded-[28px] overflow-hidden h-[200px] shadow-xl shadow-primary/20">
        <BeautyImage src={banner.image || ""} alt="Banner" className="w-full h-full object-cover" />
        {/* Overlay opacité configurable */}
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${banner.overlay_opacity ?? 0.55})` }} />
        <div className="absolute inset-0 p-5 flex flex-col justify-between">
          <span className="self-start bg-white/25 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/30">
            {banner.badge || "Offre"}
          </span>
          <div>
            <h2 className="text-white text-[24px] font-black leading-tight whitespace-pre-line drop-shadow-sm">{banner.title || ""}</h2>
            {banner.subtitle && <p className="text-white/85 text-[12px] font-medium mt-1">{banner.subtitle}</p>}
            {banner.cta && (
              <button onClick={() => banner.cta_link && navigate(banner.cta_link)}
                className="mt-3 bg-white text-gray-900 text-[11px] font-black uppercase px-5 py-2.5 rounded-full tracking-widest shadow-lg active:scale-95 transition-all inline-flex items-center gap-1.5">
                {banner.cta} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {banners.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section Title ────────────────────────────────────────────────────────────
function SectionTitle({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[18px] font-black text-gray-900">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-0.5">
          {action} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [sectionBg, setSectionBg] = useState(getSectionBg);
  const adminRecommandesSet = useRef(false);
  // Première peinture directement depuis le cache (pas de page vide).
  const [homeCacheInitial] = useState(readHomeCache);
  const [homeConfig, setHomeConfig] = useState(homeCacheInitial.homeConfig || {});
  const { formatPrice } = useLocale();
  const { sessions: liveSessions, refetch: refreshLives } = useLiveSessions();
  const [partenairesDiplomes, setPartenairesDiplomes] = useState(homeCacheInitial.partenairesDiplomes || []);
  const [produitsTendanceLive, setProduitsTendanceLive] = useState(homeCacheInitial.produitsTendanceLive || []);
  const [produitsRecommandes, setProduitsRecommandes] = useState(homeCacheInitial.produitsRecommandes || []);
  const [offresImmoLive, setOffresImmoLive] = useState(homeCacheInitial.offresImmoLive || null);
  const [offresSpeciales, setOffresSpeciales] = useState(homeCacheInitial.offresSpeciales || []);
  const [bundles, setBundles] = useState(homeCacheInitial.bundles || []);
  const [bundlesTendance, setBundlesTendance] = useState(homeCacheInitial.bundlesTendance || []);
  // Devient true dès que de vraies données sont arrivées : autorise alors
  // la persistance du cache (on ne persiste jamais du vide).
  const homeLoadedRef = useRef(false);

  useEffect(() => {
    // Plus de reset ici : on garde les données affichées (cache ou précédent
    // chargement) pendant le rafraîchissement en arrière-plan.
    void refreshLives();

    // Charger config depuis AppConfig
    entities.AppConfig.filter({ key: "home_config" }, "-created_at", 50)
      .then(async rows => {
        if (rows[0]?.value) {
          const cfg = rows[0].value;
          setHomeConfig(cfg);
          homeLoadedRef.current = true;
          setOffresSpeciales(cfg.offres_speciales || []);

          // Sync immo : charger le vrai listing depuis la BDD par son ID
          const immoConfig = Array.isArray(cfg.offres_immobilier)
            ? cfg.offres_immobilier[0]
            : cfg.offres_immobilier;
          if (immoConfig?.id) {
            entities.ImmobilierListing.filter({ status: "actif" }, "-created_at", 50)
              .then(all => {
                const found = all.find(l => l.id === immoConfig.id);
                setOffresImmoLive(found || null);
              })
              .catch(() => {});
          }

          // Recommandé pour vous : utiliser la config admin si dispo
          const adminRecommandes = cfg.recommande_pour_vous || [];
          if (adminRecommandes.length > 0) {
            setProduitsRecommandes(adminRecommandes.slice(0, 8));
            adminRecommandesSet.current = true;
          }
        }
      })
      .catch(() => {});



    // Bundles
    entities.ServiceBundle.filter({ is_active: true, is_group: false }, "-created_at", 10)
      .then(items => {
        setBundles(items.slice(0, 6));
        setBundlesTendance(items.filter(b => b.discount_percent >= 20).slice(0, 6));
      })
      .catch(() => {});

    // Partenaires certifiés
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 50)
      .then(pros => setPartenairesDiplomes(pros.filter(p => p.type_activite === "Particulier" && p.has_diplome)))
      .catch(() => setPartenairesDiplomes([]));

    // Produits tendance : BDD + Shopify
    Promise.allSettled([
      entities.Produit.filter({ status: "actif" }, "-created_at", 4).then(items => items.map(p => ({ ...p, source: "db" }))),
      fetchShopifyProducts({}).then(r => (r.data?.products || []).slice(0, 4).map(p => ({ id: p.id, name: p.name, price: p.price, image_url: p.img, brand: p.brand, source: "shopify" }))),
    ]).then(([dbRes, shopifyRes]) => {
      const db = dbRes.status === "fulfilled" ? dbRes.value : [];
      const shopify = shopifyRes.status === "fulfilled" ? shopifyRes.value : [];
      setProduitsTendanceLive([...db, ...shopify].slice(0, 4));
    }).catch(() => setProduitsTendanceLive([]));

    // Produits recommandés : fallback Shopify + vendeurs si pas de config admin
    (async () => {
      if (adminRecommandesSet.current) return;
      const shopifyProds = [];
      const vendeurProds = [];

      try {
        const SHOPIFY_DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN || 'hwqnwb-hi.myshopify.com';
        const SHOPIFY_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '46a6de1eb3a2686abcae91039944762d';
        const r = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-10/graphql.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN },
          body: JSON.stringify({
            query: `{ products(first: 20, sortKey: BEST_SELLING) { edges { node { id title vendor productType images(first:1) { edges { node { url } } } variants(first:1) { edges { node { price { amount } } } } } } }`
          })
        });
        const json = await r.json();
        for (const { node } of (json.data?.products?.edges || [])) {
          const v = node.variants?.edges?.[0]?.node;
          const img = node.images?.edges?.[0]?.node;
          shopifyProds.push({
            id: node.id, name: node.title, brand: node.vendor || '',
            price: parseFloat(v?.price?.amount || '0'),
            image_url: img?.url || '', source: 'shopify',
          });
        }
      } catch (e) { console.error("[Home] Shopify error:", e); }

      try {
        const items = await entities.Produit.filter({ status: "actif" }, "-created_at", 20);
        for (const p of items) {
          vendeurProds.push({
            id: p.id, name: p.name || '', brand: p.brand || '',
            price: parseFloat(p.price || 0),
            image_url: p.image_url || (p.images && p.images[0]) || '', source: 'vendeur',
          });
        }
      } catch (e) { console.error("[Home] DB error:", e); }

      setProduitsRecommandes([...shopifyProds, ...vendeurProds].slice(0, 8));
    })();

    // Fallback : charger la première offre dispo si aucune config admin
    entities.ImmobilierListing.filter({ status: "actif" }, "-created_at", 1)
      .then(rows => { if (rows[0]) setOffresImmoLive(prev => prev || rows[0]); })
      .catch(() => {});
  }, [refreshKey]);

  // Persiste les données en cache dès qu'elles sont chargées (jamais de vide) :
  // la prochaine ouverture affiche directement la page complète.
  useEffect(() => {
    if (!homeLoadedRef.current) return;
    writeHomeCache({
      homeConfig,
      offresSpeciales,
      offresImmoLive,
      bundles,
      bundlesTendance,
      partenairesDiplomes,
      produitsTendanceLive,
      produitsRecommandes,
    });
  }, [homeConfig, offresSpeciales, offresImmoLive, bundles, bundlesTendance, partenairesDiplomes, produitsTendanceLive, produitsRecommandes]);

  useEffect(() => {
    const update = () => setSectionBg(getSectionBg());
    window.addEventListener("bb-theme-change", update);
    return () => window.removeEventListener("bb-theme-change", update);
  }, []);

  const handleRefresh = useCallback(() => {
    return new Promise(resolve => { setRefreshKey(k => k + 1); resolve(); });
  }, []);

  const { containerRef, pulling, pullDistance } = usePullToRefresh(handleRefresh);

  const heroBanners = homeConfig.hero_banners?.length > 0
    ? homeConfig.hero_banners
    : [];

  const servicesTendanceRaw = homeConfig.services_tendance?.length > 0
    ? homeConfig.services_tendance
    : [];
  const [servicesTendance, setServicesTendance] = useState(servicesTendanceRaw);

  useEffect(() => {
    if (!servicesTendanceRaw.length) return;
    Promise.allSettled([
      entities.Service.filter({ status: "actif" }, "-created_at", 200),
      entities.ProfilPro.filter({ status: "actif" }, "-created_at", 200),
    ]).then(([svcRes, proRes]) => {
      const allSvc = svcRes.status === "fulfilled" ? svcRes.value || [] : [];
      const byId = {};
      allSvc.forEach(s => { byId[s.id] = s; });
      const salonMap = {};
      (proRes.status === "fulfilled" ? proRes.value || [] : []).forEach(p => { salonMap[p.user_email] = p.salon_name || ""; });
      setServicesTendance(servicesTendanceRaw.map(s => {
        const real = byId[s.id];
        if (!real) return s;
        const img = real.image_url || (real.images && real.images[0]) || s.image_url;
        const salon = salonMap[real.pro_email] || "";
        return { ...s, image_url: img, price: real.price || s.price, title: real.title || s.title, salon_name: salon, pro_email: real.pro_email };
      }));
    }).catch(() => setServicesTendance(servicesTendanceRaw));
  }, [homeConfig.services_tendance]);

  const salonDuMois = homeConfig.salon_du_mois;
  const expertiseDuMois = homeConfig.expertise_du_mois;
  // Produits tendance : produits admin sélectionnés + produits Shopify live, fusionnés (max 4)
  const adminProduits = homeConfig.produits_tendance || [];
  const shopifyOnly = produitsTendanceLive.filter(p => p.source === "shopify");
  const merged = [...adminProduits, ...shopifyOnly];
  const produitsTendance = merged.length > 0
    ? merged.slice(0, 4)
    : [];

  // Offre immo : toujours préférer offresImmoLive (vrai ID BDD), sinon fallback config admin
  const offresImmo = offresImmoLive || (Array.isArray(homeConfig.offres_immobilier)
    ? homeConfig.offres_immobilier[0]
    : homeConfig.offres_immobilier) || null;

  return (
    <div ref={containerRef} className="font-display pb-6 bg-white">
      {/* Guide d'utilisation premier accès */}
      <UserGuide />
      {/* Pull to refresh */}
      {pullDistance > 10 && (
        <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance * 0.5 }}>
          <div className={`w-6 h-6 border-2 border-primary border-t-transparent rounded-full ${pulling ? "animate-spin" : ""}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
        </div>
      )}

      {/* ── Hero ── */}
      <div data-tour="hero">
        <HeroSlider banners={heroBanners} user={user} navigate={navigate} />
      </div>


      {/* ── Catégories — fond nude ── */}
      <div data-tour="categories" className="mx-4 rounded-3xl px-4 py-5 mb-2" style={{ background: sectionBg }}>
        <SectionTitle title="Catégories" />
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-1">
          {GLOBAL_CATEGORIES.map((cat) => {
            const Icon = cat.Icon;
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/services-salons?cat=${encodeURIComponent(cat.id)}`)}
                className="flex flex-col items-center gap-2 shrink-0 active:scale-95 transition-all"
              >
                <div className="w-[60px] h-[60px] flex items-center justify-center">
                  <Icon className={`w-7 h-7 ${cat.color}`} strokeWidth={1.6} />
                </div>
                <span className="text-[10px] font-bold text-gray-600 tracking-tight text-center">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Services Tendance ── */}
      <div data-tour="services" className="px-4 py-4">
        <SectionTitle title="Services Tendance" action="Voir tout" onAction={() => navigate("/services-salons")} />
        <div className="grid grid-cols-2 gap-3">
          {servicesTendance.slice(0, 4).map((s) => {
            const serviceImage = s.image_url || (s.images && s.images[0]) || "";
            return (
              <button key={s.id || s.title}
                onClick={() => navigate(`/service/${s.id}`, { state: { title: s.title, price: s.price, cover: serviceImage } })}
                className="bg-white rounded-[24px] overflow-hidden shadow-sm active:scale-95 transition-all text-left border border-orange-50">
                <div className="relative h-[150px]">
                  <BeautyImage src={serviceImage} alt={s.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <span className="absolute top-2.5 left-2.5 bg-primary text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5" /> {s.tag || "TENDANCE"}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[13px] font-black text-gray-900 leading-tight">{s.title}</p>
                  {s.salon_name && <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{s.salon_name}</p>}
                  <p className="text-[12px] font-bold text-primary mt-1">À partir de {formatPrice(s.price)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bundles ── */}
      {bundles.length > 0 && (
        <div className="mx-4 rounded-3xl px-4 py-5 mb-2" style={{ background: sectionBg }}>
          <SectionTitle title="Bundles" action="Voir tout" onAction={() => navigate("/services-salons")} />
          <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-1 px-1">
            {bundles.map(b => (
              <button
                key={b.id}
                onClick={() => navigate(`/bundle/${b.id}`)}
                className="shrink-0 w-[160px] bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-all text-left border border-orange-50"
              >
                <div className="h-[100px] relative overflow-hidden">
                  <BeautyImage src={b.image_url || b.banner_url || ""} alt="" className="w-full h-full object-cover" />
                  {b.discount_percent > 0 && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">-{b.discount_percent}%</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-black text-gray-900 line-clamp-1">{b.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {b.discount_percent > 0 && (
                      <span className="text-[11px] font-bold text-gray-400 line-through">{formatPrice(b.bundle_price)}</span>
                    )}
                    <span className="text-[14px] font-black text-[#E8732A]">{formatPrice(b.discount_percent > 0 ? Math.round(b.bundle_price * (1 - b.discount_percent / 100)) : b.bundle_price)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bundles Tendance ── */}
      {bundlesTendance.length > 0 && (
        <div className="mx-4 rounded-3xl px-4 py-5 mb-2" style={{ background: sectionBg }}>
          <SectionTitle title="Bundles Tendance" action="Voir tout" onAction={() => navigate("/services-salons")} />
          <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-1 px-1">
            {bundlesTendance.map(b => (
              <button
                key={b.id}
                onClick={() => navigate(`/bundle/${b.id}`)}
                className="shrink-0 w-[160px] bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-all text-left border border-orange-50 relative"
              >
                <div className="absolute top-2 right-2 z-10">
                  <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Flame className="w-3 h-3" /> POPULAIRE
                  </span>
                </div>
                <div className="h-[100px] relative overflow-hidden">
                  <BeautyImage src={b.image_url || b.banner_url || ""} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {b.discount_percent > 0 && (
                    <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-[#E8732A] text-[9px] font-black px-2 py-0.5 rounded-full">-{b.discount_percent}%</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-black text-gray-900 line-clamp-1">{b.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {b.discount_percent > 0 && (
                      <span className="text-[11px] font-bold text-gray-400 line-through">{formatPrice(b.bundle_price)}</span>
                    )}
                    <span className="text-[14px] font-black text-[#E8732A]">{formatPrice(b.discount_percent > 0 ? Math.round(b.bundle_price * (1 - b.discount_percent / 100)) : b.bundle_price)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Salon du Mois — fond nude ── */}
      <div data-tour="salon-mois" className="mx-4 rounded-3xl px-4 py-5 mb-2" style={{ background: sectionBg }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-black text-gray-900">Salon du Mois</h2>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/30" style={{ background: "#E8732A" }}>
            <Award className="w-3 h-3" /> À l'honneur
          </span>
        </div>
        <button onClick={() => navigate("/pro/vue-client", { state: { proEmail: salonDuMois?.user_email } })} className="w-full relative rounded-[24px] overflow-hidden shadow-lg active:scale-[0.99] transition-all">
          <BeautyImage src={salonDuMois?.cover_url || salonDuMois?.avatar_url || ""} alt="Salon du Mois" className="w-full h-52 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
            <h3 className="text-white text-[22px] font-black leading-tight">{salonDuMois?.salon_name || ""}</h3>
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="w-3.5 h-3.5 text-white/70" />
              <p className="text-white/70 text-[12px] font-bold">{salonDuMois?.city || ""}{salonDuMois?.rating > 0 ? ` • ★ ${salonDuMois.rating}` : ""}</p>
            </div>
          </div>
        </button>
      </div>

      {/* ── Produits Tendance ── */}
      <div data-tour="boutique" className="px-4 py-4">
        <SectionTitle title="Produits Tendance" action="Boutique" onAction={() => navigate("/boutique")} />
        <div className="grid grid-cols-2 gap-3">
          {produitsTendance.slice(0, 4).map((p) => (
            <button key={p.id || p.name}
              onClick={() => navigate(`/produit?id=${p.id}`)}
              className="bg-white rounded-[24px] overflow-hidden shadow-sm active:scale-95 transition-all text-left border border-orange-50">
              <div className="relative h-[140px]">
                <BeautyImage src={p.image_url || ""} alt={p.name || p.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="p-3">
                <p className="text-[13px] font-black text-gray-900 leading-tight">{p.name || p.title}</p>
                <p className="text-[13px] font-black text-primary mt-1">{formatPrice(p.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Recommandé pour vous ── */}
      {produitsRecommandes.length > 0 && (
        <div className="px-4 py-4">
          <SectionTitle title="Recommandé pour vous" action="Boutique" onAction={() => navigate("/boutique")} />
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {produitsRecommandes.map((p) => (
              <button key={p.id}
                onClick={() => navigate(`/produit?id=${encodeURIComponent(p.id)}`)}
                className="min-w-[160px] max-w-[160px] bg-white rounded-[24px] overflow-hidden shadow-sm active:scale-95 transition-all text-left border border-gray-100 snap-start shrink-0">
                <div className="relative h-[140px]">
                  <BeautyImage src={p.image_url || ""} alt={p.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <div className="p-3">
                  {p.brand && <p className="text-[10px] font-black text-primary uppercase tracking-wider truncate">{p.brand}</p>}
                  <p className="text-[12px] font-bold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-[13px] font-black text-primary mt-1">{formatPrice(p.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Offres Spéciales — fond nude ── */}
      {offresSpeciales.length > 0 && (
        <div className="mx-4 rounded-3xl px-4 py-5 mb-2" style={{ background: sectionBg }}>
          <SectionTitle title="Offres Spéciales" action="Tout voir" onAction={() => navigate("/services-salons")} />
          <div className="flex flex-col gap-3">
            {offresSpeciales.map((o, i) => (
              <button
                key={i}
                onClick={() => navigate(o.cta_link || "/services-salons")}
                className="w-full bg-white rounded-[24px] overflow-hidden shadow-sm active:scale-[0.99] transition-all border border-orange-100"
              >
                <div className="relative h-[180px]">
                  <BeautyImage src={o.image || ""} alt={o.salon_name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {o.rating && (
                    <div className="absolute top-3 right-3 bg-white/95 rounded-full px-3 py-1.5 flex items-center gap-1 shadow">
                      <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                      <span className="text-[12px] font-black text-gray-900">{o.rating}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-[18px] font-black text-white leading-tight">{o.salon_name}</h3>
                      {(o.distance || o.city) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3 h-3 text-white/70" />
                          <span className="text-[11px] font-bold text-white/70">{[o.distance, o.city].filter(Boolean).join(" • ")}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-white text-[11px] font-black px-4 py-2.5 rounded-xl uppercase tracking-widest shrink-0 shadow-md" style={{ background: "#E8732A" }}>
                      RÉSERVER
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Expertise du Mois ── */}
      <div data-tour="expert-mois" className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-black text-gray-900">Expertise du Mois</h2>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 rounded-full text-white text-[10px] font-black uppercase tracking-widest">
            <Users className="w-3 h-3" /> PARTICULIER
          </span>
        </div>
        <button onClick={() => navigate("/pro/vue-client", { state: { proEmail: expertiseDuMois?.user_email } })}
          className="w-full bg-white rounded-[24px] p-4 border border-orange-50 shadow-sm flex items-center gap-4 active:scale-[0.99] transition-all text-left">
          <div className="relative shrink-0">
            <div className="w-[68px] h-[68px] rounded-full overflow-hidden border-[3px] border-primary">
              <BeautyImage src={expertiseDuMois?.avatar_url || ""} alt="Expert" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-[16px] font-black text-gray-900">{expertiseDuMois?.salon_name || ""}</h3>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">{expertiseDuMois?.bio?.substring(0, 40) || ""}</p>
            <p className="text-[12px] text-gray-500 font-medium mt-1 leading-snug">{expertiseDuMois?.city || ""}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        </button>
      </div>

      {/* ── Partenaires Certifiés (diplômés) — fond nude ── */}
      {partenairesDiplomes.length > 0 && (
        <div className="mx-4 rounded-3xl px-4 py-5 mb-2" style={{ background: sectionBg }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-black text-gray-900">Partenaires Certifiés</h2>
              <span className="text-[14px]">🎓</span>
            </div>
            <button onClick={() => navigate("/services-salons")} className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-0.5">
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
            {partenairesDiplomes.map((p, i) => (
              <button
                key={p.id || i}
                onClick={() => navigate("/pro/vue-client", { state: { proEmail: p.user_email } })}
                className="min-w-[180px] bg-white rounded-[24px] p-4 shadow-sm shrink-0 flex flex-col items-center text-center gap-3 active:scale-95 transition-all border border-orange-100"
              >
                <div className="relative">
                  <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-[3px] border-primary/40">
                    <BeautyImage src={p.avatar_url || ""} alt={p.salon_name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                    <span className="text-[11px]">🎓</span>
                  </div>
                </div>
                <div>
                  <p className="text-[13px] font-black text-gray-900 line-clamp-1 w-full">{p.salon_name}</p>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{p.type_activite || (p.specialites || [])[0] || "PRO CERTIFIÉ"}</p>
                  {p.rating > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                      <span className="text-[13px] font-black text-gray-800">{p.rating}</span>
                      <span className="text-[11px] text-gray-400 font-medium">({p.reviews_count || 0})</span>
                    </div>
                  )}
                </div>
                <div className="w-full text-white text-[10px] font-black uppercase tracking-widest py-2.5 rounded-2xl" style={{ background: "#E8732A" }}>
                  VOIR LE PROFIL
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Directs ── */}
      {liveSessions.length > 0 && <section aria-label="Directs en cours" className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-black text-gray-900">Directs</h2>
            {liveSessions.length > 0 && <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />}
          </div>
          <button onClick={() => navigate("/live")} className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-0.5">
            Explorer <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {liveSessions.map((v) => (
            <button key={v.id} onClick={() => navigate(`/live-detail/${v.id}`)}
              className="min-w-[185px] shrink-0 active:scale-95 transition-all text-left">
              <div className="relative h-[200px] rounded-[24px] overflow-hidden">
                <BeautyImage src={v.thumbnail_url || ""} alt={v.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-[13px] font-black text-white leading-tight">{v.title}</p>
                  <p className="text-[11px] font-medium text-white/70 mt-0.5">par <span className="text-orange-300 font-bold">{v.host_name}</span></p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>}

      {/* ── Opportunité Business ── */}
      {offresImmoLive && (
        <div className="mx-4 rounded-3xl px-4 py-5 mb-2" style={{ background: sectionBg }}>
          <SectionTitle title="Opportunité Business" action="Voir tout" onAction={() => navigate("/immobilier")} />
          <button
            onClick={() => navigate(`/immobilier/${offresImmoLive.id || offresImmoLive.listing_id}`)}
            className="w-full bg-white rounded-[24px] p-4 shadow-sm flex gap-4 items-start active:scale-[0.99] transition-all text-left border border-orange-100"
          >
            <div className="w-[100px] h-[100px] rounded-[18px] overflow-hidden shrink-0">
              <BeautyImage src={offresImmoLive.images?.[0] || ""} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-start gap-2">
                <h3 className="text-[15px] font-black text-gray-900 leading-tight flex-1">{offresImmoLive.title}</h3>
                <span className="bg-green-100 text-green-600 text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0">DISPO</span>
              </div>
              <p className="text-[12px] text-gray-400 font-medium mt-1.5 leading-snug">{offresImmoLive.location}</p>
              <p className="text-[20px] font-black text-gray-900 mt-2">{formatPrice(offresImmoLive.price)}<span className="text-[12px] font-bold text-gray-500">/{offresImmoLive.unit || "mois"}</span></p>
            </div>
          </button>
        </div>
      )}

    </div>
  );
}