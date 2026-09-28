import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Share2, Heart, MapPin, Clock, Star, CheckCircle, ShoppingCart, Play, Calendar, ChevronRight, ChevronDown, Scissors, Sparkles, Wand2, X, ChevronLeft, ArrowUp, Wifi, Car, Thermometer, CreditCard, Accessibility, PawPrint, Baby, Coffee, Package } from "lucide-react";
import VTCSection from "@/components/service/VTCSection";
import SalonMap from "@/components/map/SalonMap";
import CommandeModal from "@/components/restaurant/CommandeModal";
import PostServiceReview from "@/components/reservation/PostServiceReview";
import FiltreAIModal from "@/components/modals/FiltreAIModal";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useLocale } from "@/hooks/useLocale";
import { readPageCache, writePageCache, mergePageCache } from "@/hooks/usePageCache";

/* ── Media slider ──────────────────────────────────────────────────── */
function MediaSlider({ media, onImageClick }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setCurrent((c) => Math.min(c + 1, media.length - 1));
      else setCurrent((c) => Math.max(c - 1, 0));
    }
    touchStartX.current = null;
  };

  if (!media || media.length === 0) return null;

  return (
    <div
      className="relative h-[280px] bg-gray-900 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {media.map((item, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(${(i - current) * 100}%)` }}
        >
          {item.type === "video" ? (
            <div className="relative w-full h-full bg-black">
              <video src={item.url} muted loop playsInline autoPlay={i === current} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/40">
                  <Play className="w-7 h-7 text-white fill-white ml-1" />
                </div>
              </div>
            </div>
          ) : (
            <BeautyImage src={item.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => onImageClick?.(i)} />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      {/* Dots */}
      {media.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {media.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${i === current ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      )}
      {/* Counter */}
      {media.length > 1 && (
        <div className="absolute top-3 right-4 bg-black/40 rounded-full px-2 py-0.5 z-10">
          <span className="text-white text-[10px] font-black">{current + 1}/{media.length}</span>
        </div>
      )}
    </div>
  );
}

/* ── Scroll to Top Button ─────────────────────────────────────── */
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("app-content");
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 600);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button onClick={() => { const el = document.getElementById("app-content"); if (el) el.scrollTo({ top: 0, behavior: "smooth" }); }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 bg-primary/80 backdrop-blur-sm rounded-full flex items-center gap-2 shadow-lg shadow-primary/30 active:scale-90 transition-all">
      <ArrowUp className="w-4 h-4 text-white" />
      <span className="text-[12px] font-black text-white uppercase tracking-wide">Retour en haut</span>
    </button>
  );
}

/* ── Image Lightbox ─────────────────────────────────────────────── */
function ImageLightbox({ images, initialIndex, onClose }) {
  const [idx, setIdx] = useState(initialIndex || 0);
  const touchStartX = useRef(null);

  const goNext = useCallback(() => setIdx(i => Math.min(i + 1, images.length - 1)), [images.length]);
  const goPrev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, onClose]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  const imagesOnly = images.filter(m => m.type !== "video");

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-white text-[13px] font-black">{idx + 1} / {images.length}</span>
        <div className="w-9" />
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center min-h-0"
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
        onClick={e => e.stopPropagation()}>
        {images[idx]?.type === "video" ? (
          <video src={images[idx].url} controls autoPlay className="w-full h-full object-contain" />
        ) : (
          <BeautyImage src={images[idx]?.url} alt="" className="w-full h-full object-contain" />
        )}
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          {idx > 0 && (
            <button onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center z-10">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          {idx < images.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center z-10">
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
        </>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="shrink-0 px-4 py-3 flex gap-2 overflow-x-auto justify-center" onClick={e => e.stopPropagation()}>
          {images.map((m, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === idx ? "border-white scale-110" : "border-transparent opacity-50"}`}>
              {m.type === "video"
                ? <div className="w-full h-full bg-gray-800 flex items-center justify-center"><Play className="w-4 h-4 text-white" /></div>
                : <BeautyImage src={m.url} alt="" className="w-full h-full object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Section title ─────────────────────────────────────────────────── */
function SectionTitle({ children, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-5 h-0.5 bg-primary rounded-full" />
      <span className="text-[16px] font-black text-gray-900">{children}</span>
      {badge && (
        <span className="ml-auto text-[10px] font-black text-primary uppercase tracking-widest">{badge}</span>
      )}
    </div>
  );
}

export default function ServiceDetail() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();
  const serviceId = id || state?.id;

  // Affichage direct depuis le cache du service : jamais de page vide,
  // le rafraîchissement se fait en arrière-plan sans vider l'affichage.
  const [initialCache] = useState(() => readPageCache(serviceId ? `service_${serviceId}` : null) || {});
  const [service, setService] = useState(initialCache.service || null);
  const [proData, setProData] = useState(initialCache.proData || null);
  const [conseils, setConseils] = useState(initialCache.conseils || []);
  const [styleRecord, setStyleRecord] = useState(initialCache.styleRecord || null);
  const [styleProducts, setStyleProducts] = useState(initialCache.styleProducts || []);
  const [similarStyles, setSimilarStyles] = useState(initialCache.similarStyles || []);
  const [serviceRating, setServiceRating] = useState(initialCache.serviceRating || null);
  const [avis, setAvis] = useState(initialCache.avis || []);
  const [loading, setLoading] = useState(() => !initialCache.service);
  const [liked, setLiked] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedPlat, setSelectedPlat] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewReservation, setReviewReservation] = useState(null);
  const [showFiltreAI, setShowFiltreAI] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [bundles, setBundles] = useState(initialCache.bundles || []);
  const [showAllAvis, setShowAllAvis] = useState(false);
  const scrollRef = useRef(null);
  const { formatPrice } = useLocale();

  // Ouvrir automatiquement la modale d'avis si ?avis=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("avis") === "1") {
      const reservationId = params.get("reservation_id");
      if (reservationId) {
        entities.Reservation.filter({ id: reservationId }, "-created_at", 1)
          .then(res => { if (res[0] && res[0].code_validated) { setReviewReservation(res[0]); setShowReview(true); } })
          .catch(() => {});
      } else {
        setShowReview(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!serviceId) { setLoading(false); return; }
    const cacheKey = `service_${serviceId}`;
    // Navigation d'un service à l'autre : afficher le cache du nouveau service
    // immédiatement plutôt qu'une page vide.
    const cached = readPageCache(cacheKey);
    if (cached?.service) {
      setService(cached.service);
      setProData(cached.proData || null);
      setConseils(cached.conseils || []);
      setStyleRecord(cached.styleRecord || null);
      setStyleProducts(cached.styleProducts || []);
      setSimilarStyles(cached.similarStyles || []);
      setServiceRating(cached.serviceRating || null);
      setAvis(cached.avis || []);
      setBundles(cached.bundles || []);
      setLoading(false);
    } else {
      setService(null); setProData(null); setConseils([]); setStyleRecord(null);
      setStyleProducts([]); setSimilarStyles([]); setServiceRating(null); setAvis([]);
      setBundles([]); setLoading(true);
    }

    entities.Service.filter({ id: serviceId }, "-created_at", 1)
      .then(async (res) => {
        const svc = res[0];
        if (!svc) return;
        setService(svc);
        writePageCache(cacheKey, { service: svc });

        const [pros, reels] = await Promise.all([
          svc.pro_email ? entities.ProfilPro.filter({ user_email: svc.pro_email }, "-created_at", 1).catch(() => []) : [],
          entities.Reel.filter({ category: "Conseils", status: "publie" }, "-created_at", 4).catch(() => []),
        ]);
        if (pros[0]) {
          setProData(pros[0]);
          mergePageCache(cacheKey, { proData: pros[0] });
        }
        setConseils(reels);
        mergePageCache(cacheKey, { conseils: reels });

        // Produits du style associé + styles similaires
        const styleCategory = svc.category;
        const styleSearchTerm = svc.style || svc.title; // fallback sur le titre du service
        const [allStyleRecords, avisRecords] = await Promise.all([
          styleSearchTerm
            ? entities.Style.list("-created_at", 200).catch(() => [])
            : Promise.resolve([]),
          pros[0]?.user_email
            ? entities.Avis.filter({ cible_email: pros[0].user_email, type: "client_to_pro" }, "-created_at", 100).catch(() => [])
            : Promise.resolve([]),
        ]);

        // Style associé — matching partiel insensible à la casse (style explicite ou titre du service)
        if (styleSearchTerm && allStyleRecords.length > 0) {
          const needle = styleSearchTerm.toLowerCase().trim();
          const matched = allStyleRecords.find(st => {
            const haystack = st.title?.toLowerCase().trim() || "";
            return haystack === needle ||
              haystack.includes(needle) ||
              needle.includes(haystack);
          });
          if (matched) {
            setStyleRecord(matched);
            mergePageCache(cacheKey, { styleRecord: matched });
            if (matched.produits_utilises?.length > 0) {
              setStyleProducts(matched.produits_utilises);
              mergePageCache(cacheKey, { styleProducts: matched.produits_utilises });
            }
          }
        }

        // Services similaires — autres services du même pro d'abord, puis même catégorie
        let similar = [];
        if (svc.pro_email) {
          const proServices = await entities.Service.filter({ pro_email: svc.pro_email, status: "actif" }, "-created_at", 50).catch(() => []);
          const others = proServices.filter(sv => sv.id !== svc.id);
          if (others.length > 0) {
            const sameCategory = others.filter(sv => svc.category && sv.category === svc.category);
            const otherCategory = others.filter(sv => !svc.category || sv.category !== svc.category);
            similar = [...sameCategory, ...otherCategory].slice(0, 6);
          }
        }
        if (similar.length === 0) {
          const allServices = await entities.Service.filter({ status: "actif" }, "-created_at", 100).catch(() => []);
          const others = allServices.filter(sv => sv.id !== svc.id);
          const sameCategory = others.filter(sv => svc.category && sv.category === svc.category);
          const otherCategory = others.filter(sv => !svc.category || sv.category !== svc.category);
          similar = [...sameCategory, ...otherCategory].slice(0, 6);
        }
        setSimilarStyles(similar);
        mergePageCache(cacheKey, { similarStyles: similar });

        // Note réelle depuis les avis
        if (avisRecords.length > 0) {
          const avg = avisRecords.reduce((sum, a) => sum + (a.note || 0), 0) / avisRecords.length;
          const rating = { rating: Math.round(avg * 10) / 10, count: avisRecords.length };
          setServiceRating(rating);
          setAvis(avisRecords);
          mergePageCache(cacheKey, { serviceRating: rating, avis: avisRecords });
        } else {
          setServiceRating({ rating: 0, count: 0 });
          mergePageCache(cacheKey, { serviceRating: { rating: 0, count: 0 } });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, state?.id]);

  useEffect(() => {
    const svc = service || state;
    if (!svc?.pro_email) return;
    entities.ServiceBundle.filter({ pro_email: svc.pro_email, is_active: true }, "-created_at", 50)
      .then(all => {
        const matched = all.filter(b => {
          const ids = (b.service_ids || []).map(String);
          return ids.includes(String(svc.id));
        });
        setBundles(matched);
        if (serviceId) mergePageCache(`service_${serviceId}`, { bundles: matched });
      })
      .catch(() => {});
  }, [service, state]);

  const s = service || state || {};

  // Construire le media slider complet (toutes les images)
  const media = (() => {
    const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));
    const items = [];
    const seen = new Set();
    const addUrl = (url) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({ type: isVideo(url) ? "video" : "image", url });
    };
    if (s.image_url) addUrl(s.image_url);
    if (s.images?.length > 0) s.images.forEach(addUrl);
    return items;
  })();

  const toggleAddon = (label) =>
    setSelectedAddons((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );

  const addonsTotal = (s.addons || [])
    .filter((a) => selectedAddons.includes(a.name || a.label))
    .reduce((sum, a) => sum + (a.price || 0), 0);

  const price = s.price || state?.price || 0;
  const total = price + addonsTotal;

  const handleOpenPro = () => {
    const email = service?.pro_email || service?.user_email || service?.author_email || proData?.user_email || state?.proEmail || state?.email;
    if (email) {
      navigate("/pro/vue-client", { state: { proEmail: email } });
    }
  };

  // Afficher le contenu dès que le service est connu (cache ou navigation) :
  // jamais de spinner plein écran pendant le rafraîchissement en arrière-plan.
  if (loading && !service) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="font-display bg-white min-h-full pb-32">

      {/* ── Sticky top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        <span className="text-[14px] font-black text-gray-900">Détail du Service</span>
        <div className="flex gap-2">
          <button className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-all">
            <Share2 className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={() => setLiked((l) => !l)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-all">
            <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
          </button>
        </div>
      </div>

      {/* ── Hero slider ── */}
      <div className="relative mt-[52px]">
        <MediaSlider media={media} onImageClick={(idx) => setLightboxIdx(idx)} />
        {/* Badges */}
        <div className="absolute bottom-10 left-4 flex gap-2 z-20">
          {s.category && (
            <span className="bg-primary/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-[9px] font-black uppercase tracking-wider">
              {s.category}
            </span>
          )}
          {s.featured && (
            <span className="bg-gray-900/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-[9px] font-black uppercase tracking-wider">
              ⭐ FEATURED
            </span>
          )}
        </div>
      </div>

      {/* ── Title block ── */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-[26px] font-black text-gray-900 leading-tight">{s.title}</h1>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">DÈS</p>
            <span className="text-[28px] font-black text-primary leading-none">{formatPrice(price)}</span>
          </div>
        </div>

        {/* Salon + disponibilité + ouvert/fermé + type */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-[12px] font-bold text-gray-400">{proData?.salon_name || s.salon || ""}</span>
          {proData?.type_activite && (
            <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-0.5 rounded-full">{proData.type_activite}</span>
          )}
          {(() => {
            if (bundles.length > 0) {
              return <span className="ml-auto bg-primary/10 text-primary text-[10px] font-black px-2.5 py-1 rounded-full border border-primary/20 flex items-center gap-1">Bundle</span>;
            }
            if (!proData?.ouverture) return proData?.status === "actif"
              ? <span className="ml-auto bg-teal-50 text-teal-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-teal-200 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full inline-block" />Disponible</span>
              : null;
            const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
            const now = new Date();
            const d = proData.ouverture[days[now.getDay()]];
            if (!d) return null;
            if (!d.open) return <span className="ml-auto bg-red-50 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-full border border-red-200">● Fermé</span>;
            const [sh, sm] = (d.start || "00:00").split(":").map(Number);
            const [eh, em] = (d.end || "23:59").split(":").map(Number);
            const cur = now.getHours() * 60 + now.getMinutes();
            return cur >= sh*60+sm && cur <= eh*60+em
              ? <span className="ml-auto bg-teal-50 text-teal-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-teal-200">● Ouvert</span>
              : <span className="ml-auto bg-red-50 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-full border border-red-200">● Fermé</span>;
          })()}
        </div>

        {/* Étoiles — synchronisées avec les avis réels */}
        {serviceRating !== null && (
          <div className="flex items-center gap-1 mb-3">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-4 h-4 ${serviceRating.rating >= i ? "text-yellow-400 fill-yellow-400" : serviceRating.rating >= i - 0.5 ? "text-yellow-400 fill-yellow-200" : "text-gray-200 fill-gray-200"}`} />
            ))}
            <span className="text-[13px] font-black text-gray-800 ml-1">
              {serviceRating.rating > 0 ? serviceRating.rating : "—"}
            </span>
            <span className="text-[12px] text-gray-400 font-medium">
              · {serviceRating.count > 0 ? `${serviceRating.count} avis` : "Pas encore noté"}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 rounded-2xl p-2.5 flex flex-col items-center gap-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-[13px] font-black text-gray-900 leading-none text-center">{s.duration_min || 60} min</span>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">DURÉE</span>
          </div>
          <div className="flex-1 bg-gray-50 rounded-2xl p-2.5 flex flex-col items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-[13px] font-black text-gray-900 leading-none text-center">{serviceRating?.rating > 0 ? serviceRating.rating : "—"}</span>
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{serviceRating?.count > 0 ? `${serviceRating.count} AVIS` : "AVIS"}</span>
          </div>
        </div>

        {/* Boutons Style associé + Filtre AI */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {styleRecord ? (
            <button
              onClick={() => navigate(`/style/${styleRecord.id}`, { state: { id: styleRecord.id, title: styleRecord.title, cover: styleRecord.image_url || (styleRecord.images && styleRecord.images[0]), images: styleRecord.images || [], category: styleRecord.category, description: styleRecord.description, likes: styleRecord.likes } })}
              className="relative overflow-hidden rounded-2xl active:scale-95 transition-all shadow-md group"
              style={{ minHeight: 100 }}
            >
              {styleRecord.image_url ? (
                <BeautyImage src={styleRecord.image_url} alt="" className="absolute inset-0 w-full h-full object-cover group-active:scale-105 transition-transform duration-300" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-pink-500" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute top-2 left-2 z-10">
                <div className="w-7 h-7 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                  <Scissors className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div className="relative z-10 flex flex-col justify-end h-full p-3">
                <p className="text-[8px] font-black text-white/60 uppercase tracking-widest leading-none">Style associé</p>
                <p className="text-[12px] font-black text-white leading-tight mt-0.5 line-clamp-2">{styleRecord.title}</p>
              </div>
              <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                <ChevronRight className="w-3 h-3 text-white" />
              </div>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl py-4 px-3" style={{ minHeight: 100 }}>
              <Sparkles className="w-5 h-5 text-gray-300" />
              <div className="text-center">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Style associé</p>
                <p className="text-[10px] text-gray-400 font-medium">Non défini</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowFiltreAI(true)}
            className="relative overflow-hidden rounded-2xl active:scale-95 transition-all shadow-md group"
            style={{ minHeight: 100 }}
          >
            <BeautyImage src="https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=400" alt="Filtre IA" className="absolute inset-0 w-full h-full object-cover group-active:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-purple-900/90 via-purple-800/50 to-transparent" />
            <div className="absolute top-2 left-2 z-10">
              <div className="w-7 h-7 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                <Wand2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div className="relative z-10 flex flex-col justify-end h-full p-3">
              <p className="text-[8px] font-black text-white/60 uppercase tracking-widest leading-none">Essayer</p>
              <p className="text-[12px] font-black text-white leading-tight mt-0.5">Filtre AI</p>
            </div>
            <div className="absolute top-2 right-2 z-10">
              <span className="text-[10px] font-black text-white bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/20">IA</span>
            </div>
          </button>
        </div>
      </div>

      {/* ── Body sections ── */}
      <div className="px-5 pt-5 space-y-7">

        {/* Description */}
        {s.description && (
          <div>
            <SectionTitle>À propos de ce service</SectionTitle>
            <p className="text-[13px] text-gray-600 leading-relaxed">{s.description}</p>
          </div>
        )}

        {/* Bundles incluant ce service */}
        {bundles.length > 0 && (
          <div>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                Bundles incluant ce service
              </span>
            </SectionTitle>
            <div className="space-y-3">
              {bundles.map(b => {
                const svcIds = (b.service_ids || []).map(String);
                const includedServices = (b.services_list || []).filter(sv => sv && sv.id && svcIds.includes(String(sv.id)));
                const originalTotal = includedServices.reduce((sum, sv) => sum + (sv.price || 0), 0);
                const discount = originalTotal > 0 ? Math.round(((originalTotal - b.price) / originalTotal) * 100) : 0;
                return (
                  <button
                    key={b.id}
                    onClick={() => navigate("/reservation", { state: { bundle: b, services: includedServices, service: { ...s, price: b.price, addons: [], pro_name: proData?.salon_name, pro_avatar: proData?.avatar_url, pro_city: proData?.city } } })}
                    className="w-full flex items-center gap-3 p-3 bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-2xl active:scale-[0.98] transition-all"
                  >
                    {b.image_url ? (
                      <BeautyImage src={b.image_url} alt={b.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-orange-400" />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-bold text-[13px] text-gray-900 truncate">{b.name}</p>
                      {b.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{b.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {originalTotal > b.price && (
                          <span className="text-[11px] text-gray-400 line-through">{formatPrice(originalTotal)}</span>
                        )}
                        <span className="text-[14px] font-black text-orange-600">{formatPrice(b.price)}</span>
                        {discount > 0 && (
                          <span className="text-[10px] font-bold text-white bg-orange-500 rounded-full px-2 py-0.5">-{discount}%</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-orange-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Produits utilisés — juste après la description */}
        {styleProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-0.5 bg-primary rounded-full" />
              <span className="text-[16px] font-black text-gray-900">Produits Utilisés</span>
              <span className="ml-auto text-[10px] font-black text-primary uppercase tracking-widest">BOUTIQUE</span>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1">
              {styleProducts.map((p, i) => {
                const handleProduitClick = () => {
                  if (p.external_url) window.open(p.external_url, "_blank");
                  else if (p.id) navigate(`/produit?id=${encodeURIComponent(p.id)}`);
                  else navigate("/boutique");
                };
                return (
                  <div key={p.id || i} className="shrink-0 w-40 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                    <button className="relative h-28 w-full active:opacity-80 transition-all" onClick={handleProduitClick}>
                      {p.image_url
                        ? <BeautyImage src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-3xl">🧴</div>
                      }
                      {p.price > 0 && (
                        <div className="absolute top-2 left-2 bg-white/90 rounded-full px-2 py-0.5">
                          <span className="text-[11px] font-black text-gray-800">{formatPrice(p.price)}</span>
                        </div>
                      )}
                    </button>
                    <div className="p-2.5">
                      <p className="text-[11px] font-black text-gray-900 mb-2 leading-tight cursor-pointer active:opacity-70" onClick={handleProduitClick}>{p.name}</p>
                      <button
                        onClick={handleProduitClick}
                        className="w-full bg-gray-900 rounded-xl py-2 flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                        <span className="text-white text-[10px] font-black uppercase tracking-widest">ACHETER</span>
                        <ShoppingCart className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Style associé — section complète */}
        {styleRecord && (
          <div>
            <SectionTitle>Style associé</SectionTitle>
            <button
              onClick={() => navigate(`/style/${styleRecord.id}`, { state: { id: styleRecord.id, title: styleRecord.title, cover: styleRecord.image_url || (styleRecord.images && styleRecord.images[0]), images: styleRecord.images || [], category: styleRecord.category, description: styleRecord.description, likes: styleRecord.likes } })}
              className="w-full rounded-3xl overflow-hidden relative active:scale-[0.99] transition-all border border-gray-100 shadow-sm"
            >
              {styleRecord.image_url ? (
                <div className="relative h-40">
                  <BeautyImage src={styleRecord.image_url} alt={styleRecord.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Style associé</span>
                    <p className="text-white text-[18px] font-black leading-tight">{styleRecord.title}</p>
                    {styleRecord.category && (
                      <span className="inline-block mt-1 bg-primary/80 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">{styleRecord.category}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-3xl p-4 flex items-center gap-3 text-left">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-gray-900">{styleRecord.title}</p>
                    {styleRecord.category && <p className="text-[11px] text-primary font-bold">{styleRecord.category}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                </div>
              )}
            </button>
          </div>
        )}

        {/* Personnaliser */}
        <div>
          <SectionTitle>Personnalisez votre soin</SectionTitle>
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-gray-700">Base : {s.title}</span>
              <span className="text-[13px] font-black text-gray-900">{formatPrice(price)}</span>
            </div>
            {(s.addons || []).map((a, i) => {
              const key = a.name || a.label || i;
              const checked = selectedAddons.includes(key);
              return (
                <button key={key} onClick={() => toggleAddon(key)} className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${checked ? "bg-primary border-primary" : "border-gray-300 bg-white"}`}>
                      {checked && <CheckCircle className="w-3 h-3 text-white fill-white" />}
                    </div>
                    <span className="text-[13px] font-bold text-gray-700">{a.name || a.label}</span>
                  </div>
                  <span className="text-[13px] font-black text-primary">+{formatPrice(a.price)}</span>
                </button>
              );
            })}
            <div className="border-t border-gray-200 pt-3">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">TOTAL ESTIMÉ</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-black text-primary">{formatPrice(total)}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">À PAYER SUR PLACE</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Commodités du salon ── */}
        {proData?.commodites?.length > 0 && (
          <div>
            <SectionTitle>Commodités</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {proData.commodites.map((c, i) => {
                const iconMap = {
                  "Wifi": <Wifi className="w-4 h-4 text-blue-500" />,
                  "Parking": <Car className="w-4 h-4 text-green-600" />,
                  "Climatisation": <Thermometer className="w-4 h-4 text-cyan-500" />,
                  "Café offert": <Coffee className="w-4 h-4 text-amber-600" />,
                  "Paiement CB": <CreditCard className="w-4 h-4 text-indigo-500" />,
                  "Accessible PMR": <Accessibility className="w-4 h-4 text-violet-500" />,
                  "Animaux acceptés": <PawPrint className="w-4 h-4 text-pink-500" />,
                  "Espace bébé": <Baby className="w-4 h-4 text-sky-500" />,
                };
                return (
                  <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-2 border border-gray-100">
                    {iconMap[c] || <CheckCircle className="w-4 h-4 text-gray-400" />}
                    <span className="text-[12px] font-bold text-gray-700">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Menu / Carte ── */}
        {proData?.menu_restaurant?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-0.5 bg-primary rounded-full" />
              <span className="text-[16px] font-black text-gray-900">Menu & Carte</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => window.open(`https://www.ubereats.com/search?q=${encodeURIComponent(proData?.salon_name || "")}`, "_blank")}
                  className="flex items-center gap-1 bg-black text-white text-[9px] font-black px-2.5 py-1.5 rounded-full active:scale-95">
                  🛵 Uber Eats
                </button>
                <button
                  onClick={() => window.open(`https://deliveroo.fr/fr/restaurants/search?q=${encodeURIComponent(proData?.salon_name || "")}`, "_blank")}
                  className="flex items-center gap-1 bg-[#00CCBC] text-white text-[9px] font-black px-2.5 py-1.5 rounded-full active:scale-95">
                  🦘 Deliveroo
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {proData.menu_restaurant.map((item, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPlat(item)}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex items-center gap-3 p-3 shadow-sm cursor-pointer active:scale-[0.99] transition-all"
                >
                  {item.image_url ? (
                    <BeautyImage src={item.image_url} alt={item.nom} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                      <span className="text-[28px]">🍽️</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-gray-900">{item.nom}</p>
                    {item.description && <p className="text-[11px] text-gray-400 font-medium mt-0.5 line-clamp-2">{item.description}</p>}
                    {item.prix > 0 && <span className="text-[15px] font-black text-primary mt-1 block">{item.prix}€</span>}
                  </div>
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-primary text-[16px]">+</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Menu Bar & Boissons ── */}
        {proData?.menu_bar?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-0.5 bg-primary rounded-full" />
              <span className="text-[16px] font-black text-gray-900">Menu Bar & Boissons</span>
            </div>
            <div className="space-y-2">
              {proData.menu_bar.map((item, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPlat(item)}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex items-center gap-3 p-3 shadow-sm cursor-pointer active:scale-[0.99] transition-all"
                >
                  {item.image_url ? (
                    <BeautyImage src={item.image_url} alt={item.nom} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                      <span className="text-[28px]">🍷</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-gray-900">{item.nom}</p>
                    {item.description && <p className="text-[11px] text-gray-400 font-medium mt-0.5 line-clamp-2">{item.description}</p>}
                    {item.prix > 0 && <span className="text-[15px] font-black text-primary mt-1 block">{item.prix}€</span>}
                  </div>
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-primary text-[16px]">+</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* L'expert beauté — ouvre la vue client du pro */}
        {(proData || s.pro_email) && (
          <div>
            <SectionTitle>L'expert beauté</SectionTitle>
            <button
              onClick={handleOpenPro}
              className="w-full rounded-3xl p-4 text-left active:scale-[0.99] transition-all"
              style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 60%, #111111 100%)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <BeautyImage
                    src={proData?.avatar_url || ""}
                    alt={proData?.salon_name}
                    className="w-14 h-14 rounded-2xl object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white fill-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-white text-[18px] font-black leading-tight">{proData?.salon_name || s.salon}</p>
                  {proData?.city && <p className="text-white/60 text-[12px] font-medium">{proData.city}</p>}
                  <p className="text-white/80 text-[9px] font-black uppercase tracking-widest mt-0.5">Professionnel BeautyBook</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {proData?.status === "actif" && (
                    <span className="bg-teal-400/20 text-teal-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-widest">
                      En ligne
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </div>
              </div>
              <div className="flex gap-2">
                {["VÉRIFIÉ", "PRO"].map((tag) => (
                  <span key={tag} className="bg-white/10 rounded-full px-2.5 py-1 text-white text-[9px] font-black uppercase tracking-widest">{tag}</span>
                ))}
                {proData?.reviews_count > 0 && (
                  <span className="ml-auto bg-white/20 rounded-full px-2.5 py-1 text-white text-[9px] font-black">
                    ⭐ {proData.rating} · {proData.reviews_count} avis
                  </span>
                )}
              </div>
            </button>
          </div>
        )}

        {/* Avis clients */}
        <div>
          <SectionTitle badge={avis.length > 0 ? `${avis.length} AVIS` : undefined}>Avis clients</SectionTitle>
          {avis.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-5 flex flex-col items-center gap-2 border border-gray-100">
              <Star className="w-8 h-8 text-gray-200" />
              <p className="text-[13px] font-black text-gray-400">Aucun avis pour le moment</p>
              <p className="text-[11px] text-gray-300 font-medium text-center">Soyez le premier à laisser un avis après votre réservation</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {(showAllAvis ? avis : avis.slice(0, 5)).map((a) => (
                  <div key={a.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      {a.auteur_avatar ? (
                        <BeautyImage src={a.auteur_avatar} alt={a.auteur_nom} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-[13px] font-black text-primary">{(a.auteur_nom || "?")[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-900 truncate">{a.auteur_nom || "Client"}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className={`w-3 h-3 ${a.note >= i ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
                          ))}
                        </div>
                      </div>
                      {a.created_date && (
                        <span className="text-[10px] text-gray-400 font-medium shrink-0">
                          {new Date(a.created_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    {a.commentaire && (
                      <p className="text-[12px] text-gray-600 font-medium leading-relaxed">{a.commentaire}</p>
                    )}
                    {a.service_nom && (
                      <span className="inline-block mt-2 bg-orange-50 text-primary text-[10px] font-black px-2.5 py-1 rounded-full border border-orange-100">
                        ✂️ {a.service_nom}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {!showAllAvis && avis.length > 5 && (
                <button
                  onClick={() => setShowAllAvis(true)}
                  className="w-full mt-4 py-3 rounded-2xl border-2 border-primary bg-white text-primary text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <ChevronDown className="w-4 h-4" />
                  Voir les {avis.length} avis
                </button>
              )}
              {showAllAvis && avis.length > 5 && (
                <button
                  onClick={() => { setShowAllAvis(false); document.querySelector('[class*="Avis clients"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="w-full mt-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-500 text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <ChevronDown className="w-4 h-4 rotate-180" />
                  Voir moins
                </button>
              )}
            </>
          )}
        </div>

        {/* Conseils beauté */}
        {conseils.length > 0 && (
          <div>
            <SectionTitle badge={`${conseils.length} CONSEIL(S)`}>Conseils Beauté</SectionTitle>
            <div className="space-y-3">
              {conseils.map((reel, i) => (
                <button
                  key={i}
                  onClick={() => navigate("/reseau-social?tab=Conseils")}
                  className="w-full bg-gray-50 rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-all border border-gray-100"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-200">
                    {(reel.thumbnail_url || reel.images?.[0]) && (
                      <BeautyImage src={reel.thumbnail_url || reel.images[0]} alt={reel.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-gray-900 leading-tight truncate">{reel.title}</p>
                    {reel.description && <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{reel.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">CONSEIL</span>
                      {reel.views > 0 && <span className="text-[9px] text-gray-400 font-medium">{reel.views} vues</span>}
                    </div>
                  </div>
                  <Play className="w-5 h-5 text-primary shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}



        {/* Localisation */}
        <div>
          <SectionTitle>Localisation</SectionTitle>
          <button
            onClick={() => {
              const addr = proData?.address || proData?.city || "";
              const name = proData?.salon_name || s.salon || "";
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name + " " + addr)}`, "_blank");
            }}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-black text-gray-900">{proData?.salon_name || s.salon}</p>
              <p className="text-[12px] text-gray-500 font-medium">{proData?.address || proData?.city || ""}</p>
              <p className="text-[11px] font-black text-primary mt-1 uppercase tracking-widest">Obtenir l'itinéraire →</p>
            </div>
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
          </button>

          {/* Carte Apple Maps — emplacement du salon */}
          <div className="mt-3">
            <SalonMap
              lat={proData?.latitude}
              lng={proData?.longitude}
              address={proData?.address}
              city={proData?.city}
              postalCode={proData?.postal_code}
              name={proData?.salon_name || s.salon}
            />
          </div>
        </div>

        {/* VTC & Taxis — prix calculés depuis la localisation réelle du salon */}
        <VTCSection
          destinationLat={proData?.latitude}
          destinationLng={proData?.longitude}
          destinationAddress={[proData?.address, proData?.postal_code, proData?.city].filter(Boolean).join(", ")}
        />

        {/* Services similaires */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-primary rounded-full" />
              <h2 className="text-[16px] font-black text-gray-900">Services similaires</h2>
            </div>
            {similarStyles.length > 0 && (
              <button
                onClick={() => navigate("/services-salons?tab=SERVICES")}
                className="text-[11px] font-black text-primary uppercase tracking-widest"
              >VOIR TOUT</button>
            )}
          </div>
          {similarStyles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 bg-gray-50 rounded-2xl border border-gray-100">
              <Scissors className="w-8 h-8 text-gray-200" />
              <p className="text-[13px] font-black text-gray-400">Aucun service similaire</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {similarStyles.map((sv) => {
                const serviceImage = sv.image_url || (sv.images?.length > 0 ? sv.images[0] : null);
                return (
                  <button
                    key={sv.id}
                    onClick={() => navigate(`/service/${sv.id}`, { state: { id: sv.id } })}
                    className="rounded-2xl overflow-hidden relative active:scale-[0.98] transition-all bg-gray-100 aspect-[3/4]"
                  >
                    {serviceImage
                      ? <BeautyImage src={serviceImage} alt={sv.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Scissors className="w-8 h-8 text-gray-300" /></div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-[12px] font-black leading-tight line-clamp-2">{sv.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        {sv.category && (
                          <span className="bg-primary/80 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">{sv.category}</span>
                        )}
                        <span className="text-white font-black text-[11px]">{formatPrice(sv.price)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Modal commande restaurant */}
      {selectedPlat && (
        <CommandeModal
          plat={selectedPlat}
          proEmail={s.pro_email || proData?.user_email}
          proName={proData?.salon_name}
          onClose={() => setSelectedPlat(null)}
        />
      )}

      {/* Modal Filtre AI — style du service pré-sélectionné */}
      {showFiltreAI && (
        <FiltreAIModal
          styleTitle={styleRecord?.title || s.style || s.title || ""}
          onClose={() => setShowFiltreAI(false)}
        />
      )}

      {/* Modal avis post-prestation */}
      {showReview && (
        <PostServiceReview
          reservation={reviewReservation || { service_name: s.title, client_email: "", client_name: "", pro_email: s.pro_email, pro_name: proData?.salon_name, salon_name: proData?.salon_name }}
          proEmail={s.pro_email || proData?.user_email}
          proName={proData?.salon_name}
          onClose={() => setShowReview(false)}
          onSubmitted={() => {
            // Recharger les avis
            if (s.pro_email || proData?.user_email) {
              entities.Avis.filter({ cible_email: s.pro_email || proData.user_email, type: "client_to_pro" }, "-created_at", 100)
                .then(records => {
                  setAvis(records);
                  if (records.length > 0) {
                    const avg = records.reduce((sum, a) => sum + (a.note || 0), 0) / records.length;
                    setServiceRating({ rating: Math.round(avg * 10) / 10, count: records.length });
                  }
                }).catch(() => {});
            }
          }}
        />
      )}

      {/* Image Lightbox */}
      {lightboxIdx !== null && media.length > 0 && (
        <ImageLightbox images={media} initialIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      {/* ── Sticky CTA (positioned above bottom navigation bar — nav is 68px + safe-area) ── */}
      <div className="fixed bottom-28 left-0 right-0 z-[90] bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={() => navigate("/reservation", { state: { service: { ...s, price: total, addons: selectedAddons, pro_name: proData?.salon_name, pro_avatar: proData?.avatar_url, pro_city: proData?.city } } })}
          className="w-full relative overflow-hidden rounded-3xl active:scale-[0.98] transition-all shadow-2xl shadow-primary/40"
          style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 pointer-events-none" />
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-white text-[10px] font-black uppercase tracking-widest opacity-80">Confirmation immédiate</p>
                <p className="text-white text-[16px] font-black leading-tight">Réserver maintenant</p>
              </div>
            </div>
            <div className="bg-white/20 rounded-2xl px-4 py-2.5 flex flex-col items-center shrink-0">
              <span className="text-white/70 text-[9px] font-black uppercase tracking-widest">dès</span>
              <span className="text-white text-[20px] font-black leading-none">{formatPrice(total)}</span>
            </div>
          </div>
        </button>
      </div>

      {/* Scroll to top */}
      <ScrollToTopButton />

    </div>
  );
}

