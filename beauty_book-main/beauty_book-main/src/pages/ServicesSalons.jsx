import BeautyImage from '@/components/ui/BeautyImage';
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { useThemeBg } from "@/hooks/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { Search, Heart, Clock, MapPin, Share2, MessageSquare, Star, X, SlidersHorizontal, Play, Tag, Volume2, VolumeX, Sparkles, Palette, Scissors, Store, User, Zap, Users, LayoutGrid, Droplets, Calendar, Building2, UserCheck, Package, Paintbrush, Gem, Hand, Leaf, Crown, Waves, Eye, Footprints, PenTool, Circle, ArrowUpRight, ArrowRight, Map as MapIcon, Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import ProfilSheet from "@/components/salons/ProfilSheet";
import { entities, uploadFile } from '@/api/entities';
import apiClient from '@/lib/apiClient';
import { supabase } from '@/api/supabaseClient';
import { likesApi } from '@/api/likes';
import SponsoredCard from "@/components/reels/SponsoredCard";
import { getPublicAds } from "@/lib/publicAds";
import MapWithPricePins from "@/components/map/MapWithPricePins";
import AdvancedFilterSheet from "@/components/filters/AdvancedFilterSheet";
import FiltreAIModal from "@/components/modals/FiltreAIModal";
import { useLocation } from '@/contexts/LocationContext';
import { isOpenNow } from "@/lib/hours";
import { isProfilParticulier, isProfilSalon } from "@/lib/annonces";
import { SALON_CATEGORIES } from "@/lib/categories";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import './Recherche.css';
import './ServicesSalons.css';


// ── Images ────────────────────────────────────────────────────────────────────
const NAIL_IMG = "";
const SALON_IMG = "";
const SALON_IMG2 = "";
const PERSON_IMG1 = "";
const PERSON_IMG2 = "";
const PERSON_IMG3 = "";
const STYLE_IMG1 = "";
const STYLE_IMG2 = "";
const STYLE_IMG3 = "";
const SARAH_IMG = "";

const salonsData = [
  { id: 1, images: [SALON_IMG2, SALON_IMG, STYLE_IMG1], title: "Studio Lumière", location: "Paris 16e", rating: 4.9, price: 55, tag: "Prestige", category: "Coiffure" },
  { id: 2, images: [SALON_IMG, SALON_IMG2, STYLE_IMG2], title: "L'Atelier de Beauté", location: "Paris 8e", rating: 4.8, price: 65, tag: "Luxe", category: "Maquillage" },
  { id: 3, images: [STYLE_IMG1, STYLE_IMG2, STYLE_IMG3], title: "Beauté Marais", location: "Paris 3e", rating: 4.7, price: 45, tag: "Bio", category: "Soin" },
];

const particuliersData = [
  { id: 1, images: [PERSON_IMG1, STYLE_IMG1, SALON_IMG], name: "Claire Dubois", role: "Coiffeuse", location: "Paris 11e", rating: 4.9, price: 45, category: "Coiffure" },
  { id: 2, images: [PERSON_IMG2, STYLE_IMG2, NAIL_IMG], name: "Amina Koné", role: "Maquilleuse", location: "Paris 9e", rating: 4.8, price: 60, category: "Maquillage" },
  { id: 3, images: [PERSON_IMG3, SALON_IMG2, STYLE_IMG3], name: "Julie Martin", role: "Esthéticienne Ongles", location: "Paris 4e", rating: 4.7, price: 35, category: "Ongles" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const isVideoUrl = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") || url.includes("video"));

function CardMediaSlider({ media, onCardClick }) {
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef({});
  const touchStartX = useRef(null);
  const observerRef = useRef(null);
  const containerRef = useRef(null);

  // Pause vidéo quand la card sort du viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        const vid = videoRefs.current[current];
        if (!vid) return;
        if (entry.isIntersecting) { vid.play().catch(() => {}); }
        else { vid.pause(); }
      },
      { threshold: 0.3 }
    );
    observerRef.current.observe(container);
    return () => observerRef.current?.disconnect();
  }, [current]);

  // Quand on change de slide, pause l'ancien, play le nouveau
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([i, v]) => {
      if (!v) return;
      if (Number(i) === current) { v.play().catch(() => {}); }
      else { v.pause(); v.currentTime = 0; }
    });
  }, [current]);

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

  const currentIsVideo = isVideoUrl(media[current]);

  return (
    <div
      ref={containerRef}
      className="relative h-[280px] bg-gray-900 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={onCardClick}
    >
      {media.map((url, i) => (
        <div key={i} className="absolute inset-0 transition-transform duration-300 ease-in-out" style={{ transform: `translateX(${(i - current) * 100}%)` }}>
          {isVideoUrl(url) ? (
            <video
              ref={el => { if (el) videoRefs.current[i] = el; }}
              src={url}
              loop
              muted={muted}
              playsInline
              autoPlay={i === current}
              className="w-full h-full object-cover object-[center_55%]"
            />
          ) : (
            <BeautyImage src={url} alt="" className="w-full h-full object-cover object-[center_55%]" />
          )}
        </div>
      ))}
      {/* Dégradé bas */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

      {/* Bouton son si la slide actuelle est une vidéo */}
      {currentIsVideo && (
        <button
          onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
          className="absolute bottom-10 right-3 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center z-10 active:scale-90 transition-all"
        >
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
      )}

      {/* Dots */}
      {media.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {media.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`rounded-full transition-all ${i === current ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}
      {/* Compteur */}
      {media.length > 1 && (
        <div className="absolute top-3 right-4 bg-black/40 rounded-full px-2 py-0.5 z-10">
          <span className="text-white text-[10px] font-black">{current + 1}/{media.length}</span>
        </div>
      )}
    </div>
  );
}

const STYLE_CATEGORIES = ["Tous", "Coiffure", "Perruque", "Tresses", "Extensions", "Maquillage", "Ongles", "Pédicure", "Soin", "Barbe", "Massage", "Épilation", "Cils & Sourcils", "Spa & Bien-être", "Tatouage", "Piercing"];
const STYLE_HAIR_TYPES = ["Afro", "Européenne", "Asiatique", "Crépus", "Bouclés", "Ondulés", "Lisses", "Tresses", "Locks"];
const STYLE_SKIN_TYPES = ["Normale", "Sèche", "Grasse", "Mixte", "Sensible", "Mature"];
const STYLE_DIFFICULTY_LEVELS = ["Débutant", "Intermédiaire", "Avancé", "Expert"];
const STYLE_INLINE_FILTER_OPTIONS = {
  type_cheveux: STYLE_HAIR_TYPES,
  type_peau: STYLE_SKIN_TYPES,
  niveau_difficulte: STYLE_DIFFICULTY_LEVELS,
};
const STYLE_SUBCATEGORY_FALLBACKS = {
  Coiffure: ["Coupe Femme", "Coupe Homme", "Coupe Enfant", "Brushing", "Coloration", "Décoloration", "Lissage", "Permanente", "Chignon", "Coiffure de mariage"],
  Perruque: ["Lace Wig", "Closure", "Frontale", "Perruque naturelle", "Perruque synthétique", "Pose de perruque", "Entretien de perruque"],
  Tresses: ["Box Braids", "Knotless Braids", "Cornrows", "Fulani Braids", "Vanilles", "Twist", "Passion Twist", "Sisterlocks"],
  Extensions: ["Clip-in", "Tape-in", "Kératine", "Tissage ouvert", "Tissage fermé", "Pose d'extensions", "Retrait d'extensions"],
  Maquillage: ["Naturel", "Mariage", "Glamour", "Soirée", "Artistique", "Professionnel", "Maquillage permanent", "Microblading", "Faux cils"],
  Ongles: ["Gel", "Résine", "Acrylique", "Semi-permanent", "Nail Art", "French", "Baby Boomer", "Capsules", "Chrome"],
  Pédicure: ["Pédicure classique", "Pédicure spa", "Semi-permanent", "Gel pieds", "French pieds", "Soin des pieds"],
  Soin: ["Soins visage", "Soins corps", "Hydratation", "Anti-âge", "Acné", "Éclat", "Détox", "Gommage"],
  Barbe: ["Taille classique", "Taille design", "Dégradé", "Rasage complet", "Soin barbe", "Coloration barbe"],
  Massage: ["Relaxant", "Sportif", "Thérapeutique", "Drainant", "Prénatal", "Hot Stone", "Aromathérapie"],
  Épilation: ["Cire chaude", "Cire froide", "Épilation laser", "Sourcils", "Visage", "Corps", "Maillot"],
  "Cils & Sourcils": ["Extension cil à cil", "Volume russe", "Rehaussement de cils", "Teinture cils", "Brow Lift", "Teinture sourcils"],
  "Spa & Bien-être": ["Hammam", "Sauna", "Jacuzzi", "Rituel corps", "Rituel visage", "Balnéothérapie", "Détox"],
  Tatouage: ["Blackwork", "Coloré", "Aquarelle", "Japonais", "Géométrique", "Cover-up", "Temporaire"],
  Piercing: ["Lobe", "Cartilage", "Nez", "Sourcil", "Lèvre", "Nombril", "Corps"],
};

const normalizeStyleTaxonomyValue = value => String(value || "")
  .trim()
  .toLocaleLowerCase("fr-FR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const styleTaxonomyValues = item => [
  item?.id,
  item?.name,
  item?.label,
  item?.title,
  item?.slug,
  item?.category_id,
  item?.category,
  item?.category_name,
  item?.category_slug,
].flatMap(value => (
  value && typeof value === "object"
    ? [value.id, value.name, value.label, value.title, value.slug]
    : [value]
)).map(normalizeStyleTaxonomyValue).filter(Boolean);

const styleCategoryValues = item => [
  item?.category_id,
  item?.category,
  item?.category_name,
  item?.category_slug,
].flatMap(value => (
  value && typeof value === "object"
    ? [value.id, value.name, value.label, value.title, value.slug]
    : [value]
)).map(normalizeStyleTaxonomyValue).filter(Boolean);

const SERVICE_CATEGORIES = ["Tous", "Coiffure", "Maquillage", "Ongles", "Soin", "Barbe", "Massage", "Épilation"];
const SALON_FILTER_CATEGORIES = ["Tous", ...SALON_CATEGORIES];
const PARTICULIER_CATEGORIES = ["Tous", "Coiffure", "Maquillage", "Ongles", "Soin", "Barbe"];

const STYLES_RETURN_STORAGE_KEY = "bb_services_styles_return_context";
const STYLES_RETURN_MAX_AGE = 15 * 60 * 1000;

function shuffleStyleIds(ids) {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function orderStylesForTous(items) {
  if (!Array.isArray(items) || items.length < 2) return items || [];

  const byId = new Map(items.map(item => [String(item.id), item]));
  // L'onglet « Tous » doit proposer une découverte différente à chaque
  // rechargement/récupération des publications. Aucun ordre n'est persisté
  // dans sessionStorage : le retour vers un style reste géré séparément par
  // STYLES_RETURN_STORAGE_KEY.
  const shuffledIds = shuffleStyleIds([...byId.keys()]);
  // Le premier élément est volontairement la publication mise en avant :
  // elle doit apparaître en haut du flux, comme une publication récente.
  const [featuredId, ...remainingIds] = shuffledIds;
  return [featuredId, ...remainingIds].map(id => byId.get(id)).filter(Boolean);
}

function readStylesReturnContext() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STYLES_RETURN_STORAGE_KEY) || "null");
    if (!parsed || Date.now() - Number(parsed.createdAt || 0) > STYLES_RETURN_MAX_AGE) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStylesReturnContext(context) {
  const savedContext = {
    ...context,
    createdAt: Date.now(),
  };
  try {
    sessionStorage.setItem(STYLES_RETURN_STORAGE_KEY, JSON.stringify(savedContext));
  } catch {}
  return savedContext;
}

// ── Offre Sheet (thème-aware) ─────────────────────────────────────────────────
function OffreSheet({ style, onClose, navigate }) {
  const themeBg = useThemeBg();
  const isDark = themeBg === "#1a1a2e" || themeBg === "#000000";
  const sheetBg = isDark ? (themeBg === "#000000" ? "#0a0a0a" : "#1f2035") : "#ffffff";
  const textPrimary = isDark ? "#f9fafb" : "#111827";
  const textSecondary = isDark ? "#9ca3af" : "#6b7280";
  const rowBg = isDark ? (themeBg === "#000000" ? "#141414" : "#252840") : "#f9fafb";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const handleBg = isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-t-[2rem] w-full px-6 pt-5 pb-10 shadow-2xl" style={{ background: sheetBg }} onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: handleBg }} />
        <div className="flex items-center gap-3 mb-6">
          {style.img && (
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0">
              <BeautyImage src={style.img} alt={style.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">Style sélectionné</p>
            <h3 className="text-[17px] font-black leading-tight" style={{ color: textPrimary }}>{style.title}</h3>
            {style.category && <span className="text-[11px] font-medium" style={{ color: textSecondary }}>{style.category}</span>}
          </div>
        </div>
        <div className="space-y-3">
          {[
            { emoji: "✨", title: "Essayer le Filtre AI", sub: "Simulez ce style sur votre photo", scrollTo: "ai" },
            { emoji: "🛍️", title: "Voir les produits utilisés", sub: "Retrouvez tous les produits de ce look", scrollTo: "produits" },
            { emoji: "👤", title: "Voir les profils pros", sub: "Qui propose ce style près de vous", scrollTo: "profils" },
          ].map(({ emoji, title, sub, scrollTo }) => (
            <button key={scrollTo}
              onClick={() => { onClose(); navigate(`/style/${style.id}`, { state: { ...style, cover: style.img, images: style.images, video_url: style.video_url, badge: style.category || "STYLE", category: style.category, description: style.description, likes: style.likes, _scrollTo: scrollTo } }); }}
              className="w-full flex items-center gap-4 rounded-2xl p-4 active:scale-[0.98] transition-all border"
              style={{ background: rowBg, borderColor }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#ffffff" }}>
                <span className="text-[22px]">{emoji}</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-black" style={{ color: textPrimary }}>{title}</p>
                <p className="text-[11px] font-medium" style={{ color: textSecondary }}>{sub}</p>
              </div>
              <span className="text-lg" style={{ color: textSecondary }}>›</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full text-center text-[11px] font-black mt-5 uppercase tracking-widest" style={{ color: textSecondary }}>Fermer</button>
      </div>
    </div>,
    document.body
  );
}

// ── StylesTab ────────────────────────────────────────────────────────────────

// ── Annonce immobilière popup ─────────────────────────────────────────────────
function ImmobilierPopup({ onClose, onView }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-md px-5 pt-4 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
            <span className="text-[22px]">🏠</span>
          </div>
          <div>
            <p className="text-[11px] font-black text-primary uppercase tracking-widest">Sponsorisé</p>
            <p className="text-[15px] font-black text-gray-900">Espaces beauté disponibles</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-500 font-medium mb-4">Vous avez aimé ce style ? Trouvez un espace pro pour réaliser cette prestation.</p>
        <button onClick={onView} className="w-full bg-primary text-white font-black text-[13px] uppercase tracking-widest py-3.5 rounded-2xl shadow-md shadow-primary/30 active:scale-95 transition-all">
          Voir les espaces disponibles →
        </button>
        <button onClick={onClose} className="w-full text-center text-[11px] font-black text-gray-400 mt-3 uppercase tracking-widest">Plus tard</button>
      </div>
    </div>
  );
}

// ── Share Sheet style ──────────────────────────────────────────────────────────
function StyleShareSheet({ style, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.origin + `/style/${style.id}`;
  const text = `${style.title} — BeautyBook`;
  const recordShare = () => {
    if (style?.id) apiClient.post('/content/styles/engagement', { styleId: String(style.id), kind: 'shares' }).catch(() => {});
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        recordShare();
        onClose();
      } catch {}
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 1200);
  };

  const options = [
    {
      label: "WhatsApp", bg: "bg-green-500", emoji: "💬",
      action: () => { recordShare(); window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`, "_blank"); onClose(); }
    },
    {
      label: copied ? "Copié !" : "Copier lien", bg: copied ? "bg-green-600" : "bg-gray-700", emoji: copied ? "✅" : "🔗",
    action: () => { recordShare(); handleCopy(); }
    },
    {
      label: "SMS", bg: "bg-blue-500", emoji: "✉️",
      action: () => { recordShare(); window.open(`sms:?body=${encodeURIComponent(text + "\n" + url)}`); onClose(); }
    },
    {
      label: "Partager", bg: "bg-indigo-500", emoji: "📤",
      action: navigator.share ? handleNativeShare : handleCopy
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-[#1a1a2e] rounded-t-3xl w-full px-6 pt-4 shadow-2xl" style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))" }} onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
        {/* Preview du style */}
        <div className="flex items-center gap-3 mb-5 bg-white/5 rounded-2xl p-3">
          {style.img && <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0"><BeautyImage src={style.img} alt={style.title} className="w-full h-full object-cover" /></div>}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[14px] font-black truncate">{style.title}</p>
            <p className="text-white/40 text-[11px] font-medium truncate">{url}</p>
          </div>
        </div>
        <p className="text-white/60 text-[11px] font-black uppercase tracking-widest text-center mb-4">Partager via</p>
        <div className="grid grid-cols-4 gap-4">
          {options.map(opt => (
            <button key={opt.label} onClick={opt.action} className="flex flex-col items-center gap-2 active:scale-95 transition-all">
              <div className={`w-14 h-14 ${opt.bg} rounded-2xl flex items-center justify-center text-[22px] shadow-lg`}>{opt.emoji}</div>
              <span className="text-white/60 text-[10px] font-black text-center leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-5 text-center text-[11px] font-black text-white/30 uppercase tracking-widest">Fermer</button>
      </div>
    </div>,
    document.body
  );
}

function StyleAdvancedFilterBar({ styles = [], value, onChange, activeCategory = "Tous", quickFilter, onQuickFilterConsumed }) {
  const [open, setOpen] = useState(false);
  const [adminCategories, setAdminCategories] = useState([]);
  const [adminSubcategories, setAdminSubcategories] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const rows = result => Array.isArray(result) ? result : result?.data?.results || [];
    const localRows = key => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const mergeRows = (remoteRows, localKey) => {
      const seen = new Set();
      return [...remoteRows, ...localRows(localKey)]
        .filter(item => item && item.is_active !== false)
        .filter(item => {
          const identity = String(item.id || `${item.category_id || ""}:${item.name || item.label || item.title || ""}`);
          if (seen.has(identity)) return false;
          seen.add(identity);
          return true;
        });
    };
    const loadAdminRows = async (entity, filters, sort, limit, localKey) => {
      const filtered = rows(await entity.filter(filters, sort, limit).catch(() => []));
      const remoteRows = filtered.length > 0
        ? filtered
        : rows(await entity.list(sort, limit).catch(() => []));
      return mergeRows(remoteRows, localKey);
    };
    const refreshTaxonomy = () => Promise.all([
      loadAdminRows(entities.StyleCategory, { is_active: true }, "-created_at", 500, "bb_style_categories"),
      loadAdminRows(entities.StyleSubCategory, { is_active: true }, "-created_at", 1000, "bb_style_subcategories"),
    ]).then(([categories, subcategories]) => {
      if (!cancelled) {
        setAdminCategories(rows(categories));
        setAdminSubcategories(rows(subcategories));
      }
    });
    refreshTaxonomy();
    const unsubscribeCategory = entities.StyleCategory?.subscribe?.(refreshTaxonomy);
    const unsubscribeSubcategory = entities.StyleSubCategory?.subscribe?.(refreshTaxonomy);
    return () => {
      cancelled = true;
      unsubscribeCategory?.();
      unsubscribeSubcategory?.();
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const values = [
      ...adminCategories.map(item => item.name || item.label || item.title),
      ...styles.map(style => style.category),
      ...STYLE_CATEGORIES.slice(1),
    ];
    return [...new Set(values.filter(Boolean))];
  }, [adminCategories, styles]);

  // A category pill has priority over a previous modal selection so that the
  // subcategories always follow the category currently visible in the UI.
  const selectedCategoryName = activeCategory !== "Tous" ? activeCategory : (value.category || "");

  const subcategoryOptions = useMemo(() => {
    if (!selectedCategoryName) return [];

    const selectedCategoryKey = normalizeStyleTaxonomyValue(selectedCategoryName);
    const selectedCategory = adminCategories.find(item => styleTaxonomyValues(item).includes(selectedCategoryKey));
    const selectedCategoryKeys = new Set([
      selectedCategoryName,
      ...styleTaxonomyValues(selectedCategory),
    ].map(normalizeStyleTaxonomyValue).filter(Boolean));
    const adminValues = adminSubcategories
      .filter(item => {
        if (!selectedCategoryName) return true;
        const itemCategoryKeys = styleCategoryValues(item);
        return itemCategoryKeys.some(key => selectedCategoryKeys.has(key));
      })
      .map(item => item.name || item.label || item.title);
    const styleValues = styles
      .filter(style => !selectedCategoryName || normalizeStyleTaxonomyValue(style.category) === selectedCategoryKey)
      .map(style => style.subcategory);
    const fallbackValues = selectedCategoryName && adminValues.length === 0 && styleValues.length === 0
      ? (STYLE_SUBCATEGORY_FALLBACKS[selectedCategoryName] || [])
      : [];
    return [...new Set([...adminValues, ...styleValues, ...fallbackValues].filter(Boolean))];
  }, [adminCategories, adminSubcategories, styles, selectedCategoryName]);

  const inlineFilterOptions = quickFilter ? (STYLE_INLINE_FILTER_OPTIONS[quickFilter] || []) : [];

  const activeCount = Object.entries(value).filter(([key, item]) => item && !(key === "sortBy" && item === "recent")).length;
  const update = (key, item) => onChange({ ...value, [key]: item });
  const reset = () => onChange({ category: "", subcategory: "", type_cheveux: "", type_peau: "", niveau_difficulte: "", priceMin: "", priceMax: "", sortBy: "recent" });
  const selectClass = "w-full min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[13px] font-semibold text-gray-700 outline-none focus:border-primary";

  return (
    <div className="shrink-0 border-b border-gray-100 bg-white px-3 py-2">
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1" role="toolbar" aria-label="Filtres des styles">
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 shrink-0 flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[13px] font-bold text-gray-600 shadow-sm">
          <SlidersHorizontal size={16} /> Trier {activeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">{activeCount}</span>}
        </button>
        {inlineFilterOptions.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => update(quickFilter, value[quickFilter] === item ? "" : item)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-bold shadow-sm ${value[quickFilter] === item ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"}`}
          >
            {item}
          </button>
        ))}
        {subcategoryOptions.map(item => (
          <button key={item} type="button" onClick={() => update("subcategory", value.subcategory === item ? "" : item)} className={`min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-bold shadow-sm ${value.subcategory === item ? "border-primary bg-primary text-white" : "border-gray-200 bg-white text-gray-600"}`}>
            {item}
          </button>
        ))}
      </div>
      {open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(24px+env(safe-area-inset-bottom,16px))] pt-4 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[20px] font-black text-gray-900">Filtrer les styles</p>
                <p className="mt-1 text-[12px] font-medium text-gray-400">Filtres synchronisés avec le panneau admin</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer les filtres" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-black uppercase tracking-wide text-gray-500">Catégorie
                <select className={selectClass} value={value.category} onChange={event => onChange({ ...value, category: event.target.value, subcategory: "" })}>
                  <option value="">Toutes les catégories</option>{categoryOptions.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-black uppercase tracking-wide text-gray-500">Sous-catégorie
                <select className={selectClass} value={value.subcategory} onChange={event => update("subcategory", event.target.value)}>
                  <option value="">Toutes les sous-catégories</option>{subcategoryOptions.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-black uppercase tracking-wide text-gray-500">Type de cheveux
                <select className={selectClass} value={value.type_cheveux} onChange={event => update("type_cheveux", event.target.value)}>
                  <option value="">Tous les types</option>{STYLE_HAIR_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-black uppercase tracking-wide text-gray-500">Type de peau
                <select className={selectClass} value={value.type_peau} onChange={event => update("type_peau", event.target.value)}>
                  <option value="">Tous les types</option>{STYLE_SKIN_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-black uppercase tracking-wide text-gray-500">Niveau de difficulté
                <select className={selectClass} value={value.niveau_difficulte} onChange={event => update("niveau_difficulte", event.target.value)}>
                  <option value="">Tous les niveaux</option>{STYLE_DIFFICULTY_LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-black uppercase tracking-wide text-gray-500">Trier par
                <select className={selectClass} value={value.sortBy} onChange={event => update("sortBy", event.target.value)}>
                  <option value="recent">Plus récents</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={reset} className="min-h-12 flex-1 rounded-xl border border-gray-200 text-[12px] font-black uppercase tracking-wide text-gray-600">Réinitialiser</button>
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 flex-1 rounded-xl bg-primary text-[12px] font-black uppercase tracking-wide text-white shadow-lg shadow-orange-200">Voir les styles</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function StylesTab({ activeCategory, quickFilter, onQuickFilterConsumed, returnContext }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Affichage direct depuis le cache : pas d'écran « chargement » intermédiaire,
  // le rafraîchissement réseau se fait en arrière-plan sans vider l'affichage.
  const [liked, setLiked] = useCachedState("bb_liked_styles", []);
  const [likeCounts, setLikeCounts] = useCachedState("services_salons", {}, c => c?.likeCounts || {});
  const [showImmobilier, setShowImmobilier] = useState(false);
  const [styles, setStyles] = useCachedState("services_salons", [], c => orderStylesForTous(c?.styles || []));
  const [annonces, setAnnonces] = useCachedState("services_salons", [], c => c?.annonces || []);
  const stylesOrderRef = useRef([]);
  const [hiddenAds, setHiddenAds] = useState([]);
  const [styleFilters, setStyleFilters] = useState(() => ({
    category: "",
    subcategory: "",
    type_cheveux: "",
    type_peau: "",
    niveau_difficulte: "",
    priceMin: "",
    priceMax: "",
    sortBy: "recent",
    ...(returnContext?.filters || {}),
  }));
  const [loading, setLoading] = useState(() => !readPageCache("services_salons")?.styles?.length);
  const [showComments, setShowComments] = useState(null);
  const [showShare, setShowShare] = useState(null);
  const [showBook, setShowBook] = useState(null);

  useEffect(() => {
    const category = activeCategory === "Tous" ? "" : activeCategory;
    setStyleFilters(previous => (
      previous.category === category && previous.subcategory === ""
        ? previous
        : { ...previous, category, subcategory: "" }
    ));
  }, [activeCategory]);

  const [followed, setFollowed] = useState(() => {
    try {
      const k = user?.email ? `bb_followed_${user.email}` : null;
      return k ? JSON.parse(localStorage.getItem(k) || "[]") : [];
    } catch { return []; }
  });
  const scrollRef = useRef(null);
  const restoredReturnRef = useRef(false);

  // « Tous » est un point d'entrée frais : on remet le flux à zéro pour que
  // la publication aléatoirement mise en avant soit réellement visible en
  // haut, même si le navigateur avait conservé l'ancien scroll interne.
  // Un retour depuis une fiche détaillée est volontairement exclu : il est
  // restauré par l'effet dédié ci-dessous.
  useEffect(() => {
    if (activeCategory !== "Tous" || returnContext?.styleId || loading || styles.length === 0) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const list = scrollRef.current;
      list?.scrollTo({ top: 0, behavior: "auto" });
      // Le conteneur parent peut également avoir conservé une position
      // verticale lors d'un rechargement. On le remet à zéro avec la liste.
      list?.parentElement?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeCategory, returnContext?.styleId, loading, styles.length]);

  useEffect(() => {
    // Nouveau mélange à l'ouverture/actualisation de la page uniquement.
    // L'ordre est ensuite conservé pendant les rafraîchissements réseau.
    setStyles(previous => {
      const ordered = orderStylesForTous(previous);
      stylesOrderRef.current = ordered.map(style => String(style.id));
      return ordered;
    });
  }, [setStyles]);

  const orderStylesForCurrentSession = useCallback((items) => {
    if (!Array.isArray(items) || items.length < 2) return items || [];

    const byId = new Map(items.map(item => [String(item.id), item]));
    const availableIds = [...byId.keys()];
    // Preserve the exact feed order that was visible before opening a detail
    // page. This keeps the selected publication at the same place on return.
    const restoredIds = Array.isArray(returnContext?.styleOrder)
      ? returnContext.styleOrder.map(String).filter(id => byId.has(id))
      : [];
    if (restoredIds.length > 0) {
      const remainingIds = availableIds.filter(id => !restoredIds.includes(id));
      const orderedIds = [...restoredIds, ...remainingIds];
      stylesOrderRef.current = orderedIds;
      return orderedIds.map(id => byId.get(id)).filter(Boolean);
    }

    const knownIds = stylesOrderRef.current.filter(id => byId.has(id));
    const newIds = availableIds.filter(id => !knownIds.includes(id));
    const orderedIds = [...knownIds, ...shuffleStyleIds(newIds)];
    stylesOrderRef.current = orderedIds;

    return orderedIds.map(id => byId.get(id)).filter(Boolean);
  }, [returnContext?.styleOrder]);

  // ── Charger les follows ──
  useEffect(() => {
    if (!user?.email) return;
    supabase.from('user_follow').select('followed_email')
      .eq('follower_email', user.email)
      .then(({ data }) => {
        if (data) {
          const list = data.map(f => f.followed_email).filter(Boolean);
          setFollowed(list);
          try { localStorage.setItem(`bb_followed_${user.email}`, JSON.stringify(list)); } catch {}
        }
      })
      .catch(() => {});
  }, [user?.email]);

  const handleFollow = async (e, authorEmail) => {
    e.stopPropagation();
    if (!user?.email || !authorEmail) return;
    const isFollowed = followed.includes(authorEmail);
    if (isFollowed) {
      await supabase.from('user_follow').delete().eq('follower_email', user.email).eq('followed_email', authorEmail);
      setFollowed(prev => prev.filter(x => x !== authorEmail));
    } else {
      await supabase.from('user_follow').insert({ follower_email: user.email, followed_email: authorEmail });
      setFollowed(prev => [...prev, authorEmail]);
    }
  };

  // ── Charger les styles likés depuis la BDD ──
  useEffect(() => {
    if (!user?.email) return;
    likesApi.getUserLikesAll(user.email, 'style')
      .then(data => {
        if (data) {
          const ids = data.map(l => l.target_id);
          setLiked(ids);
          localStorage.setItem("bb_liked_styles", JSON.stringify(ids));
        }
      })
      .catch(() => {});
  }, [user?.email]);

  const fetchStyles = useCallback(async () => {
    try {
      let items = await entities.Style.filter({ status: ["publie", "actif"] }, "-created_at", 200).catch(() => []);
      if (!items || items.length === 0) {
        items = await entities.Style.filter({}, "-created_at", 200).then(r => (r || []).filter(s => s.status !== "brouillon")).catch(() => []);
      }
      const mapped = (items || []).map(r => ({
        id: r.id, img: r.image_url || (r.images && r.images[0]) || STYLE_IMG1,
        images: r.images && r.images.length > 0 ? r.images : [r.image_url || STYLE_IMG1],
        video_url: r.video_url || null,
        author: r.pro_email?.split("@")[0] || "Pro",
        author_name: r.author_name || r.pro_email?.split("@")[0] || "Pro",
        author_email: r.author_email || r.pro_email || "",
        authorImg: SARAH_IMG,
        title: r.title, likes: r.likes || 0, comments: r.comments || 0,
        category: r.category, subcategory: r.subcategory, description: r.description,
        type_cheveux: r.type_cheveux || "", type_peau: r.type_peau || "",
        niveau_difficulte: r.niveau_difficulte || "", price: r.price ?? r.prix ?? "",
        created_at: r.created_at,
      }));
      const orderedMapped = orderStylesForCurrentSession(mapped);
      setStyles(orderedMapped);
      mergePageCache("services_salons", { styles: orderedMapped });

      const styleIds = mapped.map(s => String(s.id));
      if (styleIds.length === 0) return;

      const { data: commentCS } = await supabase.from('CommentaireStyle')
        .select('style_id').in('style_id', styleIds);
      const { data: commentRC } = await supabase.from('reel_comment')
        .select('reel_id').in('reel_id', styleIds);
      const ccm = {};
      (commentCS || []).forEach(c => {
        const sid = String(c.style_id);
        ccm[sid] = (ccm[sid] || 0) + 1;
      });
      (commentRC || []).forEach(c => {
        const sid = String(c.reel_id);
        ccm[sid] = (ccm[sid] || 0) + 1;
      });
      const enriched = mapped.map(s => ({
        ...s,
        comments: ccm[String(s.id)] ?? s.comments ?? 0,
      }));
      const orderedEnriched = orderStylesForCurrentSession(enriched);
      setStyles(orderedEnriched);
      mergePageCache("services_salons", { styles: orderedEnriched });

      // The public Supabase policy may hide user_like rows from the browser.
      // Read the aggregate through the server-side content endpoint instead.
      let counts = {};
      try {
        const engagement = await apiClient.post('/content/styles/engagement-stats', { styleIds });
        counts = Object.fromEntries(styleIds.map(id => [id, Number(engagement?.stats?.[id]?.likes || 0)]));
      } catch {
        counts = await likesApi.getLikeCounts(styleIds, 'style');
      }
      setLikeCounts(counts);
      mergePageCache("services_salons", { likeCounts: counts });
    } catch {}
  }, []);

  useEffect(() => {
    getPublicAds({ page: 'styles', limit: 20 })
      .then(annoncesList => {
        setAnnonces(annoncesList);
        mergePageCache("services_salons", { annonces: annoncesList });
      })
      .catch(() => {});

    fetchStyles().finally(() => setLoading(false));

    const onFocus = () => fetchStyles();
    document.addEventListener('visibilitychange', onFocus);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStyles();
    }, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(interval);
    };
  }, [fetchStyles]);

  useEffect(() => {
    if (restoredReturnRef.current || !returnContext?.styleId || loading || styles.length === 0) return undefined;

    let attempts = 0;
    let frameId;
    const restore = () => {
      const container = scrollRef.current;
      if (!container) return;

      const target = [...container.querySelectorAll("[data-style-id]")]
        .find(element => element.dataset.styleId === String(returnContext.styleId));
      if (!target && attempts < 5) {
        attempts += 1;
        frameId = window.requestAnimationFrame(restore);
        return;
      }

      const top = target
        ? target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
        : Number(returnContext.scrollTop || 0);
      container.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      container.parentElement?.scrollTo({ top: 0, behavior: "auto" });
      restoredReturnRef.current = true;
      try { sessionStorage.removeItem(STYLES_RETURN_STORAGE_KEY); } catch {}
    };
    const timer = window.setTimeout(() => {
      frameId = window.requestAnimationFrame(restore);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [loading, returnContext, styles.length]);

  const handleLike = async (e, styleId) => {
    e.stopPropagation();
    const alreadyLiked = liked.includes(styleId);
    const userEmail = user?.email || user?.user_metadata?.email || "";
    if (!userEmail) return;

    try {
      const result = await apiClient.post('/content/styles/like', {
        styleId: String(styleId),
        liked: !alreadyLiked,
      });
      setLiked(prev => alreadyLiked ? prev.filter(id => id !== styleId) : [...prev, styleId]);
      setLikeCounts(prev => ({ ...prev, [styleId]: Number(result?.count || 0) }));
    } catch (error) {
      console.error('[like] save error:', error);
    }
  };

  const filteredStyles = useMemo(() => {
    let result = activeCategory === "Tous" ? [...styles] : styles.filter(s => s.category === activeCategory);
    if (styleFilters.category) result = result.filter(s => s.category === styleFilters.category);
    if (styleFilters.subcategory) result = result.filter(s => s.subcategory === styleFilters.subcategory);
    if (styleFilters.type_cheveux) result = result.filter(s => s.type_cheveux === styleFilters.type_cheveux);
    if (styleFilters.type_peau) result = result.filter(s => s.type_peau === styleFilters.type_peau);
    if (styleFilters.niveau_difficulte) result = result.filter(s => s.niveau_difficulte === styleFilters.niveau_difficulte);
    if (styleFilters.priceMin !== "") result = result.filter(s => Number(s.price) >= Number(styleFilters.priceMin));
    if (styleFilters.priceMax !== "") result = result.filter(s => Number(s.price) <= Number(styleFilters.priceMax));

    const hasActiveFilter = Boolean(
      styleFilters.category || styleFilters.subcategory || styleFilters.type_cheveux ||
      styleFilters.type_peau || styleFilters.niveau_difficulte ||
      styleFilters.priceMin !== "" || styleFilters.priceMax !== ""
    );
    // Only the unfiltered « Tous » feed is randomized. Every category and
    // filtered result follows the publication date, newest first.
    if (activeCategory !== "Tous" || hasActiveFilter) {
      result.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
    }
    if (styleFilters.sortBy === "price_asc") result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (styleFilters.sortBy === "price_desc") result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    return result;
  }, [activeCategory, styles, styleFilters]);

  const goToDetail = (style) => {
    const restoreStylesContext = saveStylesReturnContext({
      styleId: style.id,
      scrollTop: scrollRef.current?.scrollTop || 0,
      styleOrder: styles.map(item => String(item.id)),
      activeCategory,
      quickFilter,
      filters: styleFilters,
      activeTab: "STYLES",
    });
    navigate(`/style/${style.id}`, {
      state: { id: style.id, title: style.title, cover: style.img, images: style.images, video_url: style.video_url, badge: style.subcategory || style.category || "STYLE", category: style.category, subcategory: style.subcategory, description: style.description, likes: likeCounts[style.id] || style.likes, comments: style.comments, returnTo: "/services-salons?tab=STYLES", restoreStylesContext }
    });
  };

  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));

  if (loading) return <div className="flex items-center justify-center" style={{ height: "calc(100vh - 220px)" }}><div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" /></div>;

  if (filteredStyles.length === 0) return (
    <div className="h-full flex flex-col">
      <StyleAdvancedFilterBar styles={styles} value={styleFilters} activeCategory={activeCategory} quickFilter={quickFilter} onQuickFilterConsumed={onQuickFilterConsumed} onChange={setStyleFilters} />
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-orange-50 flex items-center justify-center">
          <Palette className="w-10 h-10 text-orange-400" />
        </div>
        <p className="text-[16px] font-black text-gray-700">{styles.length ? "Aucun style pour ces filtres" : "Aucun style publié"}</p>
        <p className="text-[13px] text-gray-400 font-medium">{styles.length ? "Modifiez vos critères pour voir d'autres styles." : "Les professionnels n'ont pas encore publié de styles."}</p>
        {styles.length > 0 && <button type="button" onClick={() => setStyleFilters({ category: "", subcategory: "", type_cheveux: "", type_peau: "", niveau_difficulte: "", priceMin: "", priceMax: "", sortBy: "recent" })} className="min-h-11 px-4 rounded-xl bg-primary text-white text-[12px] font-black">Effacer les filtres</button>}
      </div>
    </div>
  );

  return (
    <>
      {showImmobilier && (
        <ImmobilierPopup
          onClose={() => setShowImmobilier(false)}
          onView={() => { setShowImmobilier(false); navigate("/immobilier"); }}
        />
      )}
      <div className="h-full flex flex-col">
        <StyleAdvancedFilterBar styles={styles} value={styleFilters} activeCategory={activeCategory} quickFilter={quickFilter} onQuickFilterConsumed={onQuickFilterConsumed} onChange={setStyleFilters} />
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-scroll hide-scrollbar" style={{ scrollSnapType: "y mandatory", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {filteredStyles.map((style, idx) => (
          <React.Fragment key={style.id}>
            {idx > 0 && idx % 5 === 0 && annonces.length > 0 && !hiddenAds.includes(idx) && (
              <div style={{ scrollSnapAlign: "start", scrollSnapStop: "always", height: "100%" }}
                className="bg-black flex flex-col overflow-hidden">
                <SponsoredCard annonce={annonces[Math.floor(idx / 5 - 1) % annonces.length]} onClose={() => setHiddenAds(h => [...h, idx])} variant="styles" />
              </div>
            )}
            <StyleCard
              styleId={style.id}
              style={style} liked={liked.includes(style.id)} likeCount={likeCounts[style.id] || 0}
              followed={followed.includes(style.author_email)}
              onFollow={(e) => handleFollow(e, style.author_email)}
              onLike={(e) => handleLike(e, style.id)}
              onComment={(e) => { e.stopPropagation(); setShowComments(style); }}
              onShare={(e) => { e.stopPropagation(); setShowShare(style); }}
              onBook={(e) => { e.stopPropagation(); setShowBook(style); }}
              onDetail={() => goToDetail(style)} isVideo={isVideo}
            />
          </React.Fragment>
        ))}
        {filteredStyles.length === 5 && annonces[0] && !hiddenAds.includes(5) && (
          <div style={{ scrollSnapAlign: "start", scrollSnapStop: "always", height: "100%" }}
            className="bg-black flex flex-col overflow-hidden">
            <SponsoredCard annonce={annonces[0]} onClose={() => setHiddenAds(h => [...h, 5])} variant="styles" />
          </div>
        )}
        </div>
      </div>
      {showComments && <CommentsSheet style={showComments} onClose={() => setShowComments(null)} onCommentCountChange={(styleId, newCount) => {
        setStyles(prev => prev.map(s => String(s.id) === String(styleId) ? { ...s, comments: newCount } : s));
      }} />}
      {showShare && <StyleShareSheet style={showShare} onClose={() => setShowShare(null)} />}
      {showBook && <OffreSheet style={showBook} onClose={() => setShowBook(null)} navigate={navigate} />}
    </>
  );
}

function StyleCard({ style, styleId, liked, likeCount, followed, onFollow, onLike, onComment, onShare, onDetail, onBook, isVideo }) {
  const { user } = useAuth();
  const [imgIdx, setImgIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const videoRef = useRef(null);
  const touchStartX = useRef(null);
  const allMedia = style.video_url ? [...style.images, style.video_url] : style.images;
  const currentIsVideo = isVideo(allMedia[imgIdx]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setImgIdx(i => Math.min(i + 1, allMedia.length - 1));
      else setImgIdx(i => Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play(); setPlaying(true); }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const newMuted = !muted;
    videoRef.current.muted = newMuted;
    setMuted(newMuted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !videoRef.current.duration) return;
    setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
  };

  const handleProgressClick = (e) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = ratio * videoRef.current.duration;
    setProgress(ratio * 100);
  };

  const isBeautyBookAdmin = normalizeStyleTaxonomyValue(style.author_name) === "beautybook admin";
  const displayAuthorName = isBeautyBookAdmin ? "" : style.author_name;

  return (
    <div data-style-id={styleId || style.id} className="relative w-full shrink-0 overflow-hidden"
      style={{ height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {allMedia.map((url, i) => (
      <div key={i} className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out" style={{ transform: `translateX(${(i - imgIdx) * 100}%)` }}>
        {isVideo(url) ? (
          <video ref={i === imgIdx ? videoRef : null} src={url} autoPlay={i === imgIdx} loop muted={muted} playsInline
            className="w-full h-full object-cover object-[center_55%]" onTimeUpdate={i === imgIdx ? handleTimeUpdate : undefined} onClick={togglePlay} />
        ) : (
          <BeautyImage src={url} alt={style.title} className="w-full h-full object-cover object-[center_55%]" onClick={onDetail} />
        )}
      </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
      
      {/* Indicateurs de slides */}
      {allMedia.length > 1 && (
        <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 z-10">
          {allMedia.map((_, i) => (
            <div key={i} className={`rounded-full transition-all h-1 ${i === imgIdx ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
      )}

      {/* Barre de progression haut — style Reels */}
      {currentIsVideo && (
        <div className="absolute left-0 right-0 z-20 px-4" style={{ top: "12px" }}>
          <div className="w-full h-4 flex items-center cursor-pointer" onClick={handleProgressClick}>
            <div className="w-full h-1 bg-white/25 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-none" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Contrôles vidéo bas — play/pause + son */}
      {currentIsVideo && (
        <div className="absolute left-4 right-20 z-20 flex items-center gap-2" style={{ bottom: "calc(128px + env(safe-area-inset-bottom, 0px))" }}>
          <button onClick={togglePlay} className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95">
            {playing
              ? <div className="flex gap-0.5"><div className="w-1 h-3.5 bg-white rounded-full" /><div className="w-1 h-3.5 bg-white rounded-full" /></div>
              : <Play className="w-4 h-4 text-white ml-0.5" />}
          </button>
          <button onClick={toggleMute} className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95">
            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>
        </div>
      )}

      {/* Icônes actions — style cercle plein */}
      <div className="absolute right-3 flex flex-col items-center gap-3 z-10" style={{ bottom: "calc(128px + env(safe-area-inset-bottom, 0px))" }}>
        <button onClick={onLike} className="flex flex-col items-center gap-0.5 active:scale-90 transition-all">
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
            <Heart className={`w-5 h-5 transition-all ${liked ? "fill-red-500 text-red-500 scale-110" : "text-white"}`} />
          </div>
          <span className="text-white text-[10px] font-black">{likeCount >= 1000 ? (likeCount / 1000).toFixed(1) + "k" : likeCount}</span>
        </button>
        <button onClick={onComment} className="flex flex-col items-center gap-0.5 active:scale-90 transition-all">
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-black">{style.comments || 0}</span>
        </button>
        <button onClick={onShare} className="flex flex-col items-center gap-0.5 active:scale-90 transition-all">
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-black">Partager</span>
        </button>
        {/* Offre */}
        <button onClick={onBook} className="flex flex-col items-center gap-0.5 active:scale-90 transition-all">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40">
            <Tag className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-[10px] font-black">Offre</span>
        </button>
      </div>

      <div className="absolute left-4 right-20 z-10" style={{ bottom: "calc(104px + env(safe-area-inset-bottom, 0px))" }}>
        {displayAuthorName && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-white text-[13px] font-bold truncate" onClick={onDetail}>{displayAuthorName}</span>
            {style.author_email && style.author_email !== user?.email && (
              <button onClick={onFollow} className={`shrink-0 border rounded-full px-2.5 py-0.5 text-[10px] font-black transition-all ${followed ? "border-white/40 text-white/60" : "border-white text-white"}`}>
                {followed ? "Abonné" : "Suivre"}
              </button>
            )}
          </div>
        )}
        <h3 className="text-white text-[21px] font-black leading-tight mb-1 cursor-pointer drop-shadow-sm" onClick={onDetail}>{style.title}</h3>
        {style.description && (
          <div className="relative">
            <p className={`text-white/90 text-[12px] font-medium leading-relaxed drop-shadow-sm ${!descExpanded ? 'line-clamp-2 pr-14' : ''}`}>
              {style.description}
            </p>
            {style.description.length > 60 && !descExpanded && (
              <button
                type="button"
                aria-expanded="false"
                className="absolute bottom-0 right-0 bg-gradient-to-l from-black/80 via-black/70 to-transparent pl-3 text-[11px] font-black text-primary"
                onClick={(e) => { e.stopPropagation(); setDescExpanded(true); }}
              >
                Voir plus
              </button>
            )}
            {style.description.length > 60 && descExpanded && (
              <button
                type="button"
                aria-expanded="true"
                className="mt-1 text-[11px] font-black text-primary"
                onClick={(e) => { e.stopPropagation(); setDescExpanded(false); }}
              >
                Voir moins
              </button>
            )}
          </div>
        )}
        {(style.subcategory || style.category) && (
          <span className="inline-block mt-1.5 bg-primary/80 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest cursor-pointer" onClick={onDetail}>{style.subcategory || style.category}</span>
        )}
      </div>
    </div>
  );
}

function CommentsSheet({ style, onClose, onCommentCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [likedComments, setLikedComments] = useState([]);
  const [dislikedComments, setDislikedComments] = useState([]);
  const [commentLikeCounts, setCommentLikeCounts] = useState({});
  const [collapsedReplies, setCollapsedReplies] = useState({});
  const [sortBy, setSortBy] = useState("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [reportSent, setReportSent] = useState(null);
  const [shareToast, setShareToast] = useState(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffJ = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "Maintenant";
    if (diffMin < 60) return `${diffMin} min`;
    if (diffH < 24) return `${diffH} h`;
    if (diffJ < 7) return `${diffJ} j`;
    if (diffJ < 30) return `${Math.floor(diffJ / 7)} sem`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const loadComments = useCallback(async () => {
    if (!style?.id) return;
    setLoading(true);
    let allComments = [];
    try {
      const { data, error } = await supabase.from('CommentaireStyle')
        .select('*').eq('style_id', style.id).order('created_at', { ascending: false }).limit(200);
      if (!error && data) allComments = data;
    } catch {}
    if (allComments.length === 0) {
      try {
        const { data: d2, error: e2 } = await supabase.from('reel_comment')
          .select('*').eq('reel_id', style.id).order('created_at', { ascending: false }).limit(200);
        if (!e2 && d2) allComments = d2;
      } catch {}
    }
    setComments(allComments);
    setLoading(false);
  }, [style?.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    if (!style?.id || comments.length === 0) return;
    const commentIds = comments.map(c => String(c.id));

    likesApi.getLikeCounts(commentIds, 'comment')
      .then(counts => setCommentLikeCounts(counts))
      .catch(() => {});

    if (user?.email) {
      likesApi.getUserLikesAll(user.email, 'comment')
        .then(data => {
          if (data) {
            setLikedComments(data.filter(l => l.target_type === 'comment').map(l => String(l.target_id)));
          }
        }).catch(() => {});
      likesApi.getUserLikesAll(user.email, 'dislike')
        .then(data => {
          if (data) {
            setDislikedComments(data.filter(l => l.target_type === 'dislike').map(l => String(l.target_id)));
          }
        }).catch(() => {});
    }
  }, [comments.length, style?.id, user?.email]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const userEmail = user?.email || "anonyme@beautybook.fr";
    const userName = user?.full_name || "Utilisateur";
    const userAvatar = user?.avatar_url || null;
    const text = input.trim();
    const parentId = replyTo?.id || null;
    setInput("");
    setReplyTo(null);

    let newComment = null;
    const { data, error } = await supabase.from('CommentaireStyle').insert({
      style_id: style.id, user_email: userEmail, user_name: userName,
      user_avatar: userAvatar, content: text, likes: 0, parent_id: parentId,
    }).select().single();

    if (!error && data) {
      newComment = data;
    } else {
      const { data: d2, error: e2 } = await supabase.from('reel_comment').insert({
        reel_id: style.id, user_email: userEmail, user_name: userName,
        user_avatar: userAvatar, content: text, likes: 0,
      }).select().single();
      if (!e2 && d2) newComment = d2;
    }

    if (newComment) {
      const updated = [newComment, ...comments];
      setComments(updated);
      onCommentCountChange?.(style.id, updated.length);
      setTimeout(() => { listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, 100);
    }
    setSending(false);
  };

  const toggleCommentLike = async (c) => {
    const cid = String(c.id);
    const isLiked = likedComments.includes(cid);
    const cur = commentLikeCounts[cid] || c.likes || 0;
    const newLikes = isLiked ? Math.max(cur - 1, 0) : cur + 1;

    setCommentLikeCounts(prev => ({ ...prev, [cid]: newLikes }));

    if (isLiked) {
      setLikedComments(prev => prev.filter(id => id !== cid));
      likesApi.removeLike(user?.email, cid, 'comment').catch(() => {});
    } else {
      setLikedComments(prev => [...prev, cid]);
      if (dislikedComments.includes(cid)) {
        setDislikedComments(prev => prev.filter(id => id !== cid));
        likesApi.removeLike(user?.email, cid, 'dislike').catch(() => {});
      }
      likesApi.addLike(user?.email, cid, 'comment', user?.full_name || "Utilisateur", user?.avatar_url || "").catch(() => {});
    }
  };

  const toggleCommentDislike = async (c) => {
    const cid = String(c.id);
    const isDisliked = dislikedComments.includes(cid);
    if (isDisliked) {
      setDislikedComments(prev => prev.filter(id => id !== cid));
      likesApi.removeLike(user?.email, cid, 'dislike').catch(() => {});
    } else {
      setDislikedComments(prev => [...prev, cid]);
      if (likedComments.includes(cid)) {
        setLikedComments(prev => prev.filter(id => id !== cid));
        const cur = commentLikeCounts[cid] || c.likes || 0;
        const newLikes = Math.max(cur - 1, 0);
        setCommentLikeCounts(prev => ({ ...prev, [cid]: newLikes }));
        likesApi.removeLike(user?.email, cid, 'comment').catch(() => {});
      }
      likesApi.addLike(user?.email, cid, 'dislike', user?.full_name || "Utilisateur", user?.avatar_url || "").catch(() => {});
    }
  };

  const reportComment = async (c) => {
    setReportSent(c.id);
    setTimeout(() => setReportSent(null), 3000);
    setMenuId(null);
    try {
      await supabase.from('reel_comment_report').insert({
        comment_id: c.id, reporter_email: user?.email, reel_id: style.id,
        reason: 'inappropriate', created_at: new Date().toISOString(),
      });
    } catch {}
  };

  const shareComment = async (c) => {
    const text = `${c.user_name}: "${c.content}" — Regarde sur BeautyBook`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Commentaire BeautyBook', text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareToast(c.id);
        setTimeout(() => setShareToast(null), 2000);
      }
    } catch {}
  };

  const deleteComment = async (c) => {
    const cid = String(c.id);
    if (c.style_id) {
      await supabase.from('CommentaireStyle').delete().eq('id', cid);
    } else {
      await supabase.from('reel_comment').delete().eq('id', cid);
    }
    setComments(prev => prev.filter(x => String(x.id) !== cid && String(x.parent_id) !== cid));
    setMenuId(null);
  };

  const saveEdit = async (c) => {
    if (!editText.trim()) return;
    if (c.style_id) {
      await supabase.from('CommentaireStyle').update({ content: editText.trim() }).eq('id', c.id);
    } else {
      await supabase.from('reel_comment').update({ content: editText.trim() }).eq('id', c.id);
    }
    setComments(prev => prev.map(x => x.id === c.id ? { ...x, content: editText.trim() } : x));
    setEditingId(null); setEditText(""); setMenuId(null);
  };

  const isOwn = (c) => user?.email && c.user_email === user?.email;
  const rootComments = comments.filter(c => !c.parent_id);
  const sortedRoot = [...rootComments].sort((a, b) => {
    if (sortBy === "popular") return (commentLikeCounts[String(b.id)] || b.likes || 0) - (commentLikeCounts[String(a.id)] || a.likes || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const visibleRoot = sortedRoot.slice(0, visibleCount);
  const hasMore = sortedRoot.length > visibleCount;

  const repliesMap = {};
  comments.filter(c => c.parent_id).forEach(c => {
    if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
    repliesMap[c.parent_id].push(c);
  });

  const renderComment = (c, isReply = false) => {
    const cid = String(c.id);
    const hasReplies = !isReply && repliesMap[c.id]?.length > 0;
    const isCollapsed = collapsedReplies[c.id];
    const parentComment = isReply && comments.find(p => p.id === c.parent_id);
    const likeCount = commentLikeCounts[cid] || c.likes || 0;

    return (
      <div key={c.id} className={`${isReply ? 'ml-12' : ''}`}>
        <div className="flex gap-3 py-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 shrink-0 mt-0.5">
            {c.user_avatar ? (
              <BeautyImage src={c.user_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-[12px] font-bold bg-gray-100">
                {(c.user_name || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-900 text-[13px] font-bold">{c.user_name || "Utilisateur"}</span>
              {isOwn(c) && <span className="text-[9px] font-bold text-primary bg-orange-50 px-1.5 py-0.5 rounded-full">Vous</span>}
            </div>
            {isReply && parentComment && (
              <p className="text-gray-400 text-[11px] mt-0.5">en réponse à <span className="font-bold text-gray-500">{parentComment.user_name}</span></p>
            )}
            {editingId === c.id ? (
              <div className="flex items-center gap-2 mt-1">
                <input value={editText} onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveEdit(c)}
                  className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[13px] text-gray-800 outline-none" autoFocus />
                <button onClick={() => saveEdit(c)} className="text-primary text-[11px] font-bold">OK</button>
                <button onClick={() => { setEditingId(null); setEditText(""); }} className="text-gray-400 text-[11px]">Annuler</button>
              </div>
            ) : (
              <p className="text-gray-800 text-[14px] leading-snug mt-0.5">{c.content}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-gray-400 text-[11px]">{formatDate(c.created_at)}</span>
              {!isReply && (
                <button onClick={() => setReplyTo(c)} className="text-gray-400 text-[11px] font-bold hover:text-gray-600">Répondre</button>
              )}
              {isOwn(c) && editingId !== c.id && (
                <div className="relative ml-auto">
                  <button onClick={() => setMenuId(menuId === cid ? null : cid)} className="text-gray-400 text-[11px]">•••</button>
                  {menuId === cid && (
                    <div className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[120px]">
                      <button onClick={() => { setEditingId(cid); setEditText(c.content); setMenuId(null); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        Modifier
                      </button>
                      <button onClick={() => deleteComment(c)}
                        className="w-full px-3 py-2 text-left text-[12px] text-red-500 hover:bg-red-50 border-t border-gray-100 flex items-center gap-2">
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!isOwn(c) && editingId !== cid && (
                <div className="relative ml-auto">
                  <button onClick={() => setMenuId(menuId === cid ? null : cid)} className="text-gray-400 text-[11px]">•••</button>
                  {menuId === cid && (
                    <div className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[120px]">
                      {reportSent === cid ? (
                        <div className="px-3 py-2 text-[12px] text-green-600 font-bold">Signalement envoyé</div>
                      ) : (
                        <button onClick={() => reportComment(c)}
                          className="w-full px-3 py-2 text-left text-[12px] text-orange-500 hover:bg-orange-50">
                          Signaler
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
            <button onClick={() => toggleCommentLike(c)} className="active:scale-90 p-1">
              <Heart className={`w-[18px] h-[18px] transition-all ${likedComments.includes(cid) ? "fill-red-500 text-red-500" : "text-gray-300"}`} />
            </button>
            {likeCount > 0 && <span className="text-[10px] text-gray-400 font-medium">{likeCount}</span>}
            <button onClick={() => toggleCommentDislike(c)} className="active:scale-90 p-1">
              <svg className={`w-[16px] h-[16px] transition-all ${dislikedComments.includes(cid) ? "text-red-500" : "text-gray-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </div>
        </div>
        {hasReplies && !isReply && (
          <button onClick={() => setCollapsedReplies(p => ({ ...p, [c.id]: !p[c.id] }))}
            className="ml-11 mb-1 text-gray-400 text-[11px] font-bold hover:text-gray-600">
            {isCollapsed ? `Afficher les ${repliesMap[c.id].length} réponse${repliesMap[c.id].length > 1 ? 's' : ''}` : `Masquer ^`}
          </button>
        )}
        {!isCollapsed && hasReplies && repliesMap[c.id]?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(r => renderComment(r, true))}
        {shareToast === cid && (
          <div className="ml-11 mb-2 text-[11px] text-green-600 font-bold">Copié dans le presse-papiers !</div>
        )}
      </div>
    );
  };

  const totalAll = rootComments.length;
  const totalReplies = comments.filter(c => c.parent_id).length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end" onClick={() => { setMenuId(null); setReplyTo(null); setShowSortMenu(false); }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-[20px] z-10 flex flex-col" style={{ maxHeight: "85%" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-gray-900 text-[15px] font-black">{totalAll + totalReplies} commentaires</h3>
            <div className="relative">
              <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
              </button>
              {showSortMenu && (
                <div className="absolute left-0 top-7 z-30 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[140px]">
                  <button onClick={() => { setSortBy("recent"); setShowSortMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 flex items-center gap-2 ${sortBy === "recent" ? "text-primary font-bold" : "text-gray-700"}`}>
                    Plus récents
                  </button>
                  <button onClick={() => { setSortBy("popular"); setShowSortMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 ${sortBy === "popular" ? "text-primary font-bold" : "text-gray-700"}`}>
                    Plus aimés
                  </button>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="border-t border-gray-100" />
        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-1 hide-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /></div>
          ) : sortedRoot.length === 0 ? (
            <p className="text-center text-gray-400 text-[13px] py-10">Aucun commentaire. Soyez le premier !</p>
          ) : (
            <>
              {visibleRoot.map(c => renderComment(c))}
              {hasMore && (
                <button onClick={() => setVisibleCount(v => v + 30)}
                  className="w-full py-3 text-center text-[12px] font-bold text-primary hover:text-orange-600 transition-colors">
                  Charger plus de commentaires ({sortedRoot.length - visibleCount} restants)
                </button>
              )}
            </>
          )}
        </div>
        <div className="border-t border-gray-100" />
        <div className="px-4 py-3 shrink-0 bg-white" style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 16px))" }}>
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-gray-400">Réponse à </span>
                <span className="text-[11px] font-bold text-gray-600">{replyTo.user_name}</span>
                <p className="text-[11px] text-gray-400 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="shrink-0"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={() => {}} />
            <button onClick={() => fileInputRef.current?.click()} className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            </button>
            <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2.5">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={replyTo ? `Réponse à ${replyTo.user_name}...` : "Ajouter un commentaire..."}
                disabled={sending}
                className="flex-1 bg-transparent text-gray-800 text-[13px] outline-none placeholder:text-gray-400 disabled:opacity-50" />
              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                <button className="text-gray-400 hover:text-gray-600 p-0.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                <button className="text-gray-400 hover:text-gray-600 p-0.5">
                  <span className="text-[14px] font-bold">@</span>
                </button>
                {input.trim() && (
                  <button onClick={send} disabled={sending} className="text-primary">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}



// ── Services Tab ──────────────────────────────────────────────────────────────

function ServicesTab({ activeCategory }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unliked, setUnliked] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bb_unliked_services") || "[]"); } catch { return []; }
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});
  const [services, setServices] = useState([]);
  const [profilsMap, setProfilsMap] = useState({});
  const [bundleServiceIds, setBundleServiceIds] = useState(new Set());
  const [annonces, setAnnonces] = useState([]);
  const [hiddenAds, setHiddenAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtreAIStyle, setFiltreAIStyle] = useState(null); // { title, id } du style à pré-sélectionner

  // ── Charger les services likés depuis la BDD ──
  useEffect(() => {
    if (!user?.email) return;
    likesApi.getUserLikesAll(user.email, 'service')
      .then(data => {
        if (data) {
          const ids = data.map(l => l.target_id);
          setUnliked(ids);
          localStorage.setItem("bb_unliked_services", JSON.stringify(ids));
        }
      })
      .catch(() => {});
  }, [user?.email]);

  useEffect(() => {
    entities.Service.filter({ status: "actif" }, "-created_at", 500)
      .then(async (svcs) => {
        setServices(svcs);
        const emails = [...new Set(svcs.map(s => s.pro_email).filter(Boolean))];
        const profils = await Promise.all(
          emails.map(e => entities.ProfilPro.filter({ user_email: e }, "-created_at", 1).catch(() => []))
        );
        const map = {};
        emails.forEach((e, i) => { if (profils[i]?.[0]) map[e] = profils[i][0]; });
        setProfilsMap(map);
      }).catch(() => {}).finally(() => setLoading(false));
    entities.ServiceBundle.filter({ is_active: true }, "-created_at", 200)
      .then(bundles => {
        const ids = new Set(bundles.flatMap(b => (b.service_ids || []).map(String)));
        setBundleServiceIds(ids);
      }).catch(() => {});
    getPublicAds({ page: 'services', limit: 20 })
      .then(setAnnonces)
      .catch(() => setAnnonces([]));
  }, []);

  let filtered = activeCategory === "Tous" ? services : services.filter(s => s.category === activeCategory);
  if (filters.priceMax) filtered = filtered.filter(s => s.price >= (filters.priceMin || 0) && s.price <= filters.priceMax);

  return (
    <div className="space-y-4">
      <div className="px-4 pt-5">
        <div className="discovery-section-head">
          <div>
            <p className="discovery-eyebrow"><Sparkles size={14} /> Prestations à la carte</p>
            <h2>
              Les services à découvrir
              <span>{loading ? "Chargement…" : `${filtered.length} disponible${filtered.length > 1 ? "s" : ""}`}</span>
            </h2>
          </div>
        </div>
      </div>
      <AdvancedFilterSheet open={showFilters} onClose={() => setShowFilters(false)} onApply={setFilters} initialFilters={filters} />
      {filtreAIStyle && (
        <FiltreAIModal
          styleTitle={filtreAIStyle.title}
          onClose={() => setFiltreAIStyle(null)}
        />
      )}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center">
            <Scissors className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-[16px] font-black text-gray-700">Aucun service disponible</p>
          <p className="text-[13px] text-gray-400">Aucun professionnel dans cette catégorie.</p>
        </div>
      ) : filtered.map((item, idx) => {
        const pro = profilsMap[item.pro_email];
        // Rassembler toutes les images du service
        // Rassembler toutes les images du service
        const media = [];
        if (item.image_url) media.push(item.image_url);
        if (item.images?.length > 0) item.images.forEach(u => { if (u && u !== item.image_url) media.push(u); });
        // Ajouter la vidéo si présente
        if (item.video_url && !media.includes(item.video_url)) media.unshift(item.video_url);
        const isOnline = pro?.status === "actif";
        const adSlot = idx > 0 && idx % 5 === 0 ? Math.floor(idx / 5 - 1) : null;
        const annonce = adSlot === null ? null : annonces[adSlot % annonces.length];
        return (
          <React.Fragment key={item.id}>
            {annonce && !hiddenAds.includes(adSlot) && (
              <div className="w-full overflow-hidden bg-black" style={{ height: "calc(100dvh - 252px - env(safe-area-inset-bottom, 60px))" }}>
                <SponsoredCard
                  annonce={annonce}
                  onClose={() => setHiddenAds(hidden => [...hidden, adSlot])}
                  variant="styles"
                />
              </div>
            )}
            <div className="mx-4 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
              <div className="relative">
              {media.length > 0 ? (
                <CardMediaSlider media={media} onCardClick={() => navigate(`/service/${item.id}`, { state: { id: item.id } })} />
              ) : (
                <div className="h-52 bg-gray-100 flex items-center justify-center" onClick={() => navigate(`/service/${item.id}`, { state: { id: item.id } })}><span className="text-[48px]">✂️</span></div>
              )}
              {/* Badge BUNDLE si le service est inclus dans un bundle */}
              {bundleServiceIds.has(String(item.id)) && (
                <span className="absolute top-3 left-3 bg-primary text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest z-10">
                  Bundle
                </span>
              )}
              <button onClick={(e) => {
                 e.stopPropagation();
                 const isLiked = unliked.includes(item.id);
                 // Update local state + localStorage
                 setUnliked(prev => {
                   const next = prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id];
                   localStorage.setItem("bb_unliked_services", JSON.stringify(next));
                   const allLikedStr = localStorage.getItem("bb_liked_services") || "[]";
                   const allLiked = JSON.parse(allLikedStr);
                   const updatedLiked = isLiked
                     ? allLiked.filter(x => x !== item.id)
                     : [...new Set([...allLiked, item.id])];
                   localStorage.setItem("bb_liked_services", JSON.stringify(updatedLiked));
                   return next;
                 });
                 // Persist to Supabase
                 if (user?.email) {
                   if (isLiked) {
                     likesApi.removeLike(user.email, item.id, 'service').catch(() => {});
                   } else {
                     likesApi.addLike(user.email, item.id, 'service', user?.full_name || '', user?.avatar_url || '').catch(() => {});
                   }
                 }
               }}
               className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow z-10">
               <Heart className={`w-4 h-4 transition-all ${unliked.includes(item.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
              </button>
            </div>
            <div className="px-4 pt-3 pb-4 cursor-pointer active:opacity-80" onClick={() => navigate(`/service/${item.id}`, { state: { id: item.id } })}>
              {/* Nom du salon */}
              {pro?.salon_name && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-100 shrink-0">
                    {pro.avatar_url
                      ? <BeautyImage src={pro.avatar_url} alt={pro.salon_name} className="w-full h-full object-cover" />
                      : <span className="w-full h-full flex items-center justify-center text-[9px] font-black text-gray-400">{pro.salon_name[0]}</span>}
                  </div>
                  <span className="text-[12px] font-semibold text-gray-400 truncate">{pro.salon_name}</span>
                </div>
              )}
              {/* Nom de la prestation — grand et bien lisible */}
              <h3 className="text-[18px] font-black text-gray-900 leading-tight mb-2">{item.title}</h3>

              {/* Badges info : ville · type · ouvert/fermé · note */}
              {pro && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {(pro.city || pro.salon_name) && (
                    <span className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {[pro.city, pro.postal_code ? String(pro.postal_code).slice(0,2) : null].filter(Boolean).join(", ") || pro.salon_name}
                      </span>
                    </span>
                  )}
                  <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2.5 py-1 rounded-full">
                    {pro.type_activite === "Salon" || !pro.type_activite ? "Salon Professionnel" : pro.type_activite}
                  </span>
                  {(() => { const open = isOpenNow(pro.ouverture); return open === true
                    ? <span className="bg-teal-50 text-teal-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-teal-100">● Ouvert</span>
                    : open === false
                    ? <span className="bg-red-50 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-full border border-red-100">● Fermé</span>
                    : null;
                  })()}
                  {pro.rating > 0 && pro.reviews_count > 0 ? (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-[11px] font-black text-gray-700">{pro.rating}</span>
                      <span className="text-[9px] text-gray-400">({pro.reviews_count})</span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-gray-400 italic">Pas de notation</span>
                  )}
                </div>
              )}

              {/* Séparateur fin */}
              <div className="h-px bg-gray-100 mb-3" />

              {/* Ligne 1 : Filtre IA (gauche) + Style associé (droite) */}
              {item.style && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setFiltreAIStyle({ title: item.style }); }}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-full px-3 py-1.5 active:scale-95 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="text-[11px] font-black text-purple-600">Filtre IA</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      entities.Style.filter({ title: item.style, status: "publie" }, "-created_at", 1)
                        .then(results => {
                          if (results[0]) navigate(`/style/${results[0].id}`, { state: { id: results[0].id, title: results[0].title, cover: results[0].image_url || (results[0].images && results[0].images[0]), images: results[0].images || [], category: results[0].category, description: results[0].description, likes: results[0].likes } });
                        }).catch(() => {});
                    }}
                    className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1.5 active:scale-95 transition-all"
                  >
                    <Palette className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-black text-primary">Style associé</span>
                  </button>
                </div>
              )}

              {/* Ligne 2 : Durée (gauche) + Prix (droite) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[12px] font-black text-gray-600">{item.duration || item.duration_min || 60} min</span>
                </div>
                <span className="text-[22px] font-black text-primary">{item.price} €</span>
              </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Helper d'extraction des médias du profil (galerie photos/vidéos synchronisée) ──
function extractProfilMedia(item) {
  const media = [];
  const add = (u) => {
    if (!u || typeof u !== 'string') return;
    const clean = u.trim();
    if (clean && !media.includes(clean)) media.push(clean);
  };

  if (Array.isArray(item?.galerie_urls)) {
    item.galerie_urls.forEach(add);
  } else if (typeof item?.galerie_urls === 'string' && item.galerie_urls.trim()) {
    try {
      const parsed = JSON.parse(item.galerie_urls);
      if (Array.isArray(parsed)) parsed.forEach(add);
      else add(item.galerie_urls);
    } catch {
      add(item.galerie_urls);
    }
  }

  if (Array.isArray(item?.photos)) item.photos.forEach(add);
  if (Array.isArray(item?.images)) item.images.forEach(add);
  if (item?.cover_url) add(item.cover_url);
  if (item?.avatar_url) add(item.avatar_url);
  if (item?.image_url) add(item.image_url);

  return media.length > 0 ? media : [""];
}

// ── Carte Profil Pro (Salon / Particulier) — Slider médias & galerie synchronisée ───────────────
function DiscoveryProfilCard({ item, media: initialMedia, liked, onLike, onSelect, open, badge, minPrice, highlighted, kind }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const touchStartX = useRef(null);
  const videoRefs = useRef({});

  const validMedia = useMemo(() => {
    const list = Array.isArray(initialMedia) && initialMedia.length > 0 && initialMedia[0]
      ? initialMedia
      : extractProfilMedia(item);
    return list.filter(Boolean);
  }, [initialMedia, item]);

  const city = [item.city, item.postal_code ? String(item.postal_code).slice(0, 2) : null].filter(Boolean).join(", ");
  const hasRating = item.rating > 0 && item.reviews_count > 0;
  const specialties = item.specialites?.filter(Boolean) || [];
  const isSalon = kind !== "particulier";
  const BadgeIcon = isSalon ? Building2 : UserCheck;

  const currentUrl = validMedia[slideIdx] || validMedia[0] || "";
  const currentIsVideo = isVideoUrl(currentUrl);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 35) {
      if (diff > 0) setSlideIdx((c) => Math.min(c + 1, validMedia.length - 1));
      else setSlideIdx((c) => Math.max(c - 1, 0));
    }
    touchStartX.current = null;
  };

  const nextSlide = (e) => {
    e.stopPropagation();
    setSlideIdx((c) => (c + 1) % validMedia.length);
  };
  const prevSlide = (e) => {
    e.stopPropagation();
    setSlideIdx((c) => (c - 1 + validMedia.length) % validMedia.length);
  };

  return (
    <article
      onClick={() => onSelect()}
      className={`discovery-salon ${highlighted ? "ring-2 ring-primary" : ""}`}
      style={{ cursor: "pointer" }}
    >
      {/* Slider Media synchronisé avec la galerie */}
      <div
        className="discovery-salon-photo relative group select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {validMedia.map((url, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(${(i - slideIdx) * 100}%)` }}
          >
            {isVideoUrl(url) ? (
              <video
                ref={el => { if (el) videoRefs.current[i] = el; }}
                src={url}
                loop
                muted={muted}
                playsInline
                autoPlay={i === slideIdx}
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center top' }}
              />
            ) : (
              <BeautyImage
                src={url}
                alt={item.salon_name || item.name || "Professionnel beauté"}
                loading="lazy"
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center top' }}
              />
            )}
          </div>
        ))}

        {/* Dégradé bas et haut */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

        {/* Badges types */}
        <div className="discovery-badge-cluster pointer-events-none">
          <span className={`entity-badge ${isSalon ? "salon-badge" : "particulier-badge"}`}>
            <BadgeIcon size={12} /> {isSalon ? "Salon Pro" : "Particulier"}
          </span>
        </div>

        {/* Bouton Like */}
        <button
          onClick={(e) => { e.stopPropagation(); onLike(e); }}
          aria-label="Ajouter aux favoris"
          className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 ${liked ? "bg-primary" : "bg-white/90 backdrop-blur-sm"}`}
        >
          <Heart className={`w-4 h-4 ${liked ? "text-white fill-white" : "text-gray-500"}`} />
        </button>

        {/* Statut ouvert / fermé */}
        {open === true && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 z-10 shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-green-700">Ouvert</span>
          </div>
        )}
        {open === false && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 z-10 shadow-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-[10px] font-black text-red-500">Fermé</span>
          </div>
        )}

        {/* Contrôles slider si plusieurs médias */}
        {validMedia.length > 1 && (
          <>
            {/* Flèches de navigation discrètes */}
            {slideIdx > 0 && (
              <button
                onClick={prevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
              >
                ‹
              </button>
            )}
            {slideIdx < validMedia.length - 1 && (
              <button
                onClick={nextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
              >
                ›
              </button>
            )}

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {validMedia.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setSlideIdx(i); }}
                  className={`rounded-full transition-all ${i === slideIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`}
                />
              ))}
            </div>

            {/* Compteur */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 z-10">
              <span className="text-white text-[9px] font-black">{slideIdx + 1}/{validMedia.length}</span>
            </div>
          </>
        )}

        {/* Bouton son si vidéo */}
        {currentIsVideo && (
          <button
            onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
            className="absolute bottom-3 right-3 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center z-10 active:scale-90 transition-all"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
          </button>
        )}

        {!currentIsVideo && <span className="discovery-photo-arrow"><ArrowUpRight size={18} /></span>}
      </div>

      <div className="discovery-salon-info">
        <p className="discovery-specialties">
          {specialties.length > 0 ? specialties.slice(0, 2).join(" · ") : (isSalon ? "Établissement Beauté" : "Prestataire indépendant")}
        </p>
        <h3>{item.salon_name || item.name || (isSalon ? "Salon BeautyBook" : "Professionnel à domicile")}</h3>
        <p className="discovery-city">
          <MapPin size={14} />
          {city || (isSalon ? "Paris & Île-de-France" : "Déplacement à domicile")}
          {hasRating && (
            <span className="flex items-center gap-1 ml-2 font-bold text-gray-700">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              {item.rating}
              <span className="font-normal text-gray-400">({item.reviews_count})</span>
            </span>
          )}
        </p>
        <div className="discovery-salon-bottom">
          <span>
            {minPrice != null && minPrice > 0 ? (<>À partir de <strong>{minPrice} €</strong></>) : "Découvrir le profil"}
          </span>
          {badge
            ? <span className="text-[10px] font-black text-primary border border-primary/30 bg-primary/5 px-2 py-0.5 rounded-full uppercase">Pro</span>
            : <ArrowRight size={18} />}
        </div>
      </div>
    </article>
  );
}

// ── Utilitaire ouvert/fermé ───────────────────────────────────────────────────
// ── isOpenNow : voir @/lib/hours (gère les plages de nuit, ex 09:00 → 07:00) ──

const PUBLIC_PROFILE_STATUSES = new Set(["", "actif", "active", "publie", "publiee"]);

async function loadPublicProfilPros() {
  const [activeResult, allResult] = await Promise.all([
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 500).catch(() => []),
    // Repli utile pour les anciennes lignes (status vide ou « active »).
    entities.ProfilPro.filter({}, "-created_at", 500).catch(() => []),
  ]);
  const rows = [...new Map(
    [...activeResult, ...allResult].map((profile) => [profile.id || profile.user_email, profile])
  ).values()];
  return rows.filter((profile) => PUBLIC_PROFILE_STATUSES.has(
    String(profile?.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
  ));
}

function getProfilCoordinates(profile) {
  const lat = profile?.latitude ?? profile?.lat ?? (Array.isArray(profile?.coordinates) ? profile.coordinates[0] : null);
  const lng = profile?.longitude ?? profile?.lng ?? (Array.isArray(profile?.coordinates) ? profile.coordinates[1] : null);
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) && parsedLat !== 0 && parsedLng !== 0
    ? { lat: parsedLat, lng: parsedLng }
    : null;
}

// ── Salons Tab ────────────────────────────────────────────────────────────────

function SalonsTab({ activeCategory }) {
  const [liked, setLiked] = useState([]);
  const [selectedProfil, setSelectedProfil] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [data, setData] = useState({ profils: [], minPricesMap: {} });
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [sort, setSort] = useState("recent");
  const listRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    loadPublicProfilPros()
      .then(async (all) => {
        if (cancelled) return;
        const salons = all.filter(p => isProfilSalon(p));
        const emails = salons.map(p => p.user_email).filter(Boolean);
        const servicesArr = await Promise.all(
          emails.map(e => entities.Service.filter({ pro_email: e, status: "actif" }, "price", 10).catch(() => []))
        );
        const map = {};
        emails.forEach((e, i) => {
          const prices = servicesArr[i].map(s => s.price).filter(p => p > 0);
          if (prices.length > 0) map[e] = Math.min(...prices);
        });
        if (!cancelled) setData({ profils: salons, minPricesMap: map });
      })
      .catch(() => { if (!cancelled) setData({ profils: [], minPricesMap: {} }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCardSelect = (item) => {
    if (!item.user_email) return;
    setHighlightedId(item.id);
    navigate("/pro/vue-client", { state: { proEmail: item.user_email } });
  };

  const { profils, minPricesMap } = data;

  const filtered = useMemo(() => {
    if (activeCategory === "Tous") return profils;
    const target = activeCategory.toLowerCase();
    return profils.filter(profile => {
      const values = [
        profile.categorie,
        profile.salon_category,
        ...(Array.isArray(profile.salon_categories) ? profile.salon_categories : []),
      ].filter(Boolean).map(value => String(value).toLowerCase());
      return values.some(value => value === target || value.includes(target));
    });
  }, [profils, activeCategory]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "price") arr.sort((a, b) => (minPricesMap[a.user_email] ?? 1e9) - (minPricesMap[b.user_email] ?? 1e9));
    if (sort === "rating") arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return arr;
  }, [filtered, sort, minPricesMap]);

  const mapItems = useMemo(() => {
    return filtered.map((p, idx) => {
      let lat = p.latitude || p.lat || (Array.isArray(p.coordinates) ? p.coordinates[0] : null);
      let lng = p.longitude || p.lng || (Array.isArray(p.coordinates) ? p.coordinates[1] : null);
      if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
        lat = 48.8566 + (idx * 0.012 - 0.03);
        lng = 2.3522 + (idx * 0.015 - 0.03);
      }
      return {
        id: p.id || `salon-${idx}`,
        price: minPricesMap[p.user_email] || p.minPrice || 35,
        title: p.salon_name || 'Salon BeautyBook',
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: p.address || p.city || 'Paris & Île-de-France',
        city: p.city || 'Paris',
        user_email: p.user_email
      };
    });
  }, [filtered, minPricesMap]);

  const handleMapSelect = (item) => {
    if (!item.user_email) return;
    setHighlightedId(item.id);
    navigate("/pro/vue-client", { state: { proEmail: item.user_email } });
  };

  return (
    <div className="services-section">
      <div className="discovery-section-head">
        <div>
          <p className="discovery-eyebrow"><Sparkles size={14} /> Carte & adresses</p>
          <h2>
            Les salons à découvrir
            <span>{loading ? "Chargement…" : `${sorted.length} disponible${sorted.length > 1 ? "s" : ""}`}</span>
          </h2>
        </div>
        <div className="discovery-view-toggle" aria-label="Affichage des résultats">
          <button aria-label="Afficher en liste" aria-pressed={!showMap} onClick={() => setShowMap(false)}>
            <LayoutGrid size={17} /><span>Liste</span>
          </button>
          <button aria-label="Afficher sur la carte" aria-pressed={showMap} onClick={() => setShowMap(true)}>
            <MapIcon size={17} /><span>Carte</span>
          </button>
        </div>
      </div>

      <div className="discovery-result-tools">
        <p>Les établissements beauté près de vous.</p>
        <label>Trier par
          <select aria-label="Trier les salons" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="recent">Nouveautés</option>
            <option value="rating">Meilleures notes</option>
            <option value="price">Prix croissant</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {showMap && (
            <div className="discovery-map-panel">
              {mapItems.length > 0 ? (
                <>
                  <MapWithPricePins items={mapItems} onSelectItem={handleMapSelect} height="h-[340px]" />
                  <p className="discovery-map-caption">
                    <MapPin size={15} />
                    {mapItems.length} adresse(s) localisée(s) sur Apple Maps. Touchez une épingle pour voir la fiche.
                  </p>
                </>
              ) : (
                <div className="discovery-empty">
                  <MapPin size={30} className="text-orange-400" />
                  <h3>Aucune adresse sur la carte</h3>
                  <p>Les salons de cette sélection n'ont pas encore renseigné leurs coordonnées.</p>
                </div>
              )}
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="discovery-empty">
              <Store size={30} className="text-gray-300" />
              <h3>Aucun salon trouvé</h3>
              <p>Essayez une autre catégorie.</p>
            </div>
          ) : (
            <div ref={listRef} className="discovery-grid">
              {sorted.map((item) => {
                const media = extractProfilMedia(item);
                const open = isOpenNow(item.ouverture);
                return (
                  <div key={item.id} id={`salon-card-${item.id}`}>
                    <DiscoveryProfilCard
                      item={item}
                      media={media}
                      liked={liked.includes(item.id)}
                      onLike={(e) => { e.stopPropagation(); setLiked(p => p.includes(item.id) ? p.filter(x => x !== item.id) : [...p, item.id]); }}
                      onSelect={() => handleCardSelect(item)}
                      open={open}
                      badge={item.abonnement && item.abonnement !== "free" ? item.abonnement : null}
                      minPrice={minPricesMap[item.user_email] ?? null}
                      highlighted={highlightedId === item.id}
                      kind="salon"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {selectedProfil && <ProfilSheet profil={selectedProfil} onClose={() => { setSelectedProfil(null); setHighlightedId(null); }} />}
    </div>
  );
}

// ── Particuliers Tab ──────────────────────────────────────────────────────────

function ParticuliersTab({ activeCategory }) {
  const { filterByRadius, hasLocation } = useLocation();
  const [liked, setLiked] = useState([]);
  const [selectedProfil, setSelectedProfil] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [data, setData] = useState({ profils: [], minPricesMap: {} });
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [sort, setSort] = useState("recent");
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadPublicProfilPros()
      .then(async (all) => {
        if (cancelled) return;
        const particuliers = all.filter(p => isProfilParticulier(p));
        const emails = particuliers.map(p => p.user_email).filter(Boolean);
        const servicesArr = await Promise.all(
          emails.map(e => entities.Service.filter({ pro_email: e, status: "actif" }, "price", 10).catch(() => []))
        );
        const map = {};
        emails.forEach((e, i) => {
          const prices = servicesArr[i].map(s => s.price).filter(p => p > 0);
          if (prices.length > 0) map[e] = Math.min(...prices);
        });
        if (!cancelled) setData({ profils: particuliers, minPricesMap: map });
      })
      .catch(() => { if (!cancelled) setData({ profils: [], minPricesMap: {} }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const { profils, minPricesMap } = data;

  const filtered = useMemo(() => {
    let list = activeCategory === "Tous" ? profils : profils.filter(p => p.specialites?.some(s => s.toLowerCase().includes(activeCategory.toLowerCase())));
    if (hasLocation) {
      // Ne pas supprimer les profils légitimes qui n'ont pas encore de
      // coordonnées : ils restent visibles et leur adresse sera géocodée par
      // Apple Plans dans la carte.
      const located = list
        .map((profile) => ({ profile, coordinates: getProfilCoordinates(profile) }))
        .filter(({ coordinates }) => coordinates)
        .map(({ profile, coordinates }) => ({ ...profile, latitude: coordinates.lat, longitude: coordinates.lng }));
      const withoutCoordinates = list.filter((profile) => !getProfilCoordinates(profile));
      list = [...filterByRadius(located, 100), ...withoutCoordinates];
    }
    return list;
  }, [profils, activeCategory, hasLocation, filterByRadius]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "price") arr.sort((a, b) => (minPricesMap[a.user_email] ?? 1e9) - (minPricesMap[b.user_email] ?? 1e9));
    if (sort === "rating") arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return arr;
  }, [filtered, sort, minPricesMap]);

  const mapItems = useMemo(() => {
    return filtered.map((p, idx) => {
      const coordinates = getProfilCoordinates(p);
      return {
        id: p.id || `part-${idx}`,
        price: minPricesMap[p.user_email] || p.minPrice || 30,
        title: p.salon_name || p.name || 'Coiffeur particulier',
        ...(coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : {}),
        address: p.address || null,
        postal_code: p.postal_code || null,
        city: p.city || null,
        user_email: p.user_email
      };
    });
  }, [filtered, minPricesMap]);

  const handleMapSelect = (item) => {
    setHighlightedId(item.id);
    setSelectedProfil(item);
  };

  const handleCardSelect = (item) => {
    setHighlightedId(item.id);
    setSelectedProfil(item);
  };

  return (
    <div className="services-section">
      <div className="discovery-section-head">
        <div>
          <p className="discovery-eyebrow"><Sparkles size={14} /> À domicile & indépendants</p>
          <h2>
            Les particuliers à découvrir
            <span>{loading ? "Chargement…" : `${sorted.length} disponible${sorted.length > 1 ? "s" : ""}`}</span>
          </h2>
        </div>
        <div className="discovery-view-toggle" aria-label="Affichage des résultats">
          <button aria-label="Afficher en liste" aria-pressed={!showMap} onClick={() => setShowMap(false)}>
            <LayoutGrid size={17} /><span>Liste</span>
          </button>
          <button aria-label="Afficher sur la carte" aria-pressed={showMap} onClick={() => setShowMap(true)}>
            <MapIcon size={17} /><span>Carte</span>
          </button>
        </div>
      </div>

      <div className="discovery-result-tools">
        <p>Des pros indépendants qui se déplacent chez vous.</p>
        <label>Trier par
          <select aria-label="Trier les particuliers" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="recent">Nouveautés</option>
            <option value="rating">Meilleures notes</option>
            <option value="price">Prix croissant</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {showMap && (
            <div className="discovery-map-panel">
              <MapWithPricePins items={mapItems} onSelectItem={handleMapSelect} height="h-[340px]" />
              <p className="discovery-map-caption">
                <MapPin size={15} />
                {mapItems.length > 0
                  ? `${mapItems.length} prestataire(s) affiché(s) sur Apple Maps. Touchez une épingle pour voir la fiche.`
                  : "Apple Maps est prêt : les prestataires apparaîtront dès qu'une adresse sera disponible."}
              </p>
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="discovery-empty">
              <User size={30} className="text-gray-300" />
              <h3>Aucun particulier disponible</h3>
              <p>Essayez une autre catégorie.</p>
            </div>
          ) : (
            <div ref={listRef} className="discovery-grid">
              {sorted.map((item) => {
                const media = extractProfilMedia(item);
                const open = isOpenNow(item.ouverture);
                return (
                  <div key={item.id} id={`part-card-${item.id}`}>
                    <DiscoveryProfilCard
                      item={item}
                      media={media}
                      liked={liked.includes(item.id)}
                      onLike={(e) => { e.stopPropagation(); setLiked(p => p.includes(item.id) ? p.filter(x => x !== item.id) : [...p, item.id]); }}
                      onSelect={() => handleCardSelect(item)}
                      open={open}
                      minPrice={minPricesMap[item.user_email] ?? null}
                      highlighted={highlightedId === item.id}
                      kind="particulier"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {selectedProfil && <ProfilSheet profil={selectedProfil} onClose={() => { setSelectedProfil(null); setHighlightedId(null); }} />}
    </div>
  );
}

function BundlesTab() {
  const navigate = useNavigate();
  const [bundles, setBundles] = useState([]);
  const [profilsMap, setProfilsMap] = useState({});
  const [servicesMap, setServicesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("popular");
  const [showSort, setShowSort] = useState(false);
  const [sortLabel, setSortLabel] = useState("Trier");
  const [localCategory, setLocalCategory] = useState("Tous les bundles");

  useEffect(() => {
    let cancelled = false;
    entities.ServiceBundle.filter({ is_active: true }, "-created_at", 200)
      .then(async (bundles) => {
        if (cancelled) return;
        setBundles(bundles);
        const emails = [...new Set(bundles.map(b => b.pro_email).filter(Boolean))];
        const svcIds = [...new Set(bundles.flatMap(b => b.service_ids || []).filter(Boolean))];
        const [profilsResults, svcResults] = await Promise.all([
          Promise.all(emails.map(e => entities.ProfilPro.filter({ user_email: e }, "-created_at", 1).catch(() => []))),
          svcIds.length > 0 ? entities.Service.filter({ status: "actif" }, "-created_at", 500).catch(() => []) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const pMap = {};
        emails.forEach((e, i) => { if (profilsResults[i]?.[0]) pMap[e] = profilsResults[i][0]; });
        setProfilsMap(pMap);
        const sMap = {};
        svcResults.forEach(s => { sMap[s.id] = s; });
        setServicesMap(sMap);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const enriched = bundles.map(b => {
    const includedSvcs = (b.service_ids || []).map(id => servicesMap[id]).filter(Boolean);
    const regularTotal = includedSvcs.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
    const pro = profilsMap[b.pro_email] || {};
    const totalDuration = includedSvcs.reduce((sum, s) => sum + (parseInt(s.duration_min) || 60), 0);
    return { ...b, includedSvcs, regularTotal, proProfile: pro, serviceCount: includedSvcs.length, totalDuration };
  });

  const filtered = localCategory !== "Tous les bundles"
    ? enriched.filter(b => {
        const cats = (b.includedSvcs || []).map(s => s.category?.toLowerCase());
        return cats.includes(localCategory.toLowerCase());
      })
    : enriched;

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "price_asc") return (a.bundle_price || 0) - (b.bundle_price || 0);
    if (sortBy === "price_desc") return (b.bundle_price || 0) - (a.bundle_price || 0);
    if (sortBy === "persons") return (a.max_persons || 1) - (b.max_persons || 1);
    if (sortBy === "discount") return (b.discount_percent || 0) - (a.discount_percent || 0);
    return 0;
  });

  const BADGES = [
    { text: "Le plus réservé", bg: "bg-amber-500", icon: "🔥" },
    { text: "Nouveau", bg: "bg-emerald-500", icon: "✨" },
    { text: "Parfait entre amies", bg: "bg-pink-500", icon: "💕" },
    { text: "Spécial copines", bg: "bg-purple-500", icon: "💜" },
    { text: "Best Friends", bg: "bg-rose-400", icon: "👯" },
  ];

  const getBadge = (b, i) => {
    if (i === 0) return BADGES[0];
    if (b.is_new) return BADGES[1];
    const maxP = b.max_persons || 1;
    if (maxP >= 3) return BADGES[4];
    if (maxP >= 2) return BADGES[2];
    if (b.discount_percent >= 15) return BADGES[3];
    return null;
  };

  const CATEGORY_FILTERS = [
    { label: "Tous les bundles", icon: LayoutGrid },
    { label: "Coiffure", icon: Scissors },
    { label: "Soin", icon: Droplets },
    { label: "Ongles", icon: Sparkles },
    { label: "Maquillage", icon: Palette },
  ];

  const sortOptions = [
    { key: "popular", label: "Populaires" },
    { key: "price_asc", label: "Prix croissant" },
    { key: "price_desc", label: "Prix décroissant" },
    { key: "persons", label: "Nombre de personnes" },
    { key: "discount", label: "Meilleure réduction" },
  ];

  return (
    <div className="space-y-3">
      <div className="px-4 pt-5">
        <div className="discovery-section-head">
          <div>
            <p className="discovery-eyebrow"><Sparkles size={14} /> Offres combinées</p>
            <h2>
              Les bundles à découvrir
              <span>{loading ? "Chargement…" : `${sorted.length} disponible${sorted.length > 1 ? "s" : ""}`}</span>
            </h2>
          </div>
        </div>
      </div>
      {/* Icon-based category filters */}
      <div className="px-4 flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {CATEGORY_FILTERS.map(cat => {
          const Icon = cat.icon;
          return (
            <button key={cat.label} onClick={() => setLocalCategory(cat.label)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold border transition-all ${localCategory === cat.label ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200"}`}>
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Sort bar */}
      <div className="px-4 flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <button onClick={() => setShowSort(s => !s)} className="shrink-0 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-2 text-[11px] font-black text-gray-600 active:scale-95">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Trier
        </button>
        <button onClick={() => setSortBy(sortBy === "price_asc" ? "price_desc" : "price_asc")} className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold border transition-all ${sortBy === "price_asc" || sortBy === "price_desc" ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-gray-500"}`}>
          ↑↓ Prix
        </button>
        <button onClick={() => setSortBy("persons")} className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold border transition-all ${sortBy === "persons" ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-gray-500"}`}>
          <Users className="w-3.5 h-3.5" /> Nombre de personnes
        </button>
        <button onClick={() => setSortBy("discount")} className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold border transition-all ${sortBy === "discount" ? "bg-primary/10 border-primary text-primary" : "bg-white border-gray-200 text-gray-500"}`}>
          <Calendar className="w-3.5 h-3.5" /> Disponibilités
        </button>
      </div>

      {/* Sort dropdown */}
      {showSort && (
        <div className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-lg p-2 space-y-1">
          {sortOptions.map(s => (
            <button key={s.key} onClick={() => { setSortBy(s.key); setSortLabel(s.label); setShowSort(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-[12px] font-bold ${sortBy === s.key ? "bg-primary/10 text-primary" : "text-gray-600"}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-pink-50 flex items-center justify-center">
            <Sparkles className="w-9 h-9 text-pink-400" />
          </div>
          <p className="text-[16px] font-black text-gray-700">Aucun bundle disponible</p>
          <p className="text-[13px] text-gray-400">Les professionnels n'ont pas encore créé de packs.</p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {sorted.map((b, i) => {
            const badge = getBadge(b, i);
            const minP = b.min_persons || 1;
            const maxP = b.max_persons || 1;
            const grp = maxP > 1;
            const durH = Math.floor(b.totalDuration / 60);
            const durM = b.totalDuration % 60;
            const durStr = durH > 0 ? `${durH}h${durM > 0 ? String(durM).padStart(2, '0') : ''}` : `${durM}min`;
            const savings = b.regularTotal > 0 && b.bundle_price < b.regularTotal ? b.regularTotal - b.bundle_price : 0;
            const savPct = b.regularTotal > 0 ? Math.round((savings / b.regularTotal) * 100) : 0;
            return (
              <button key={b.id} onClick={() => navigate(b.is_group ? `/bundle-groupe/${b.id}` : `/bundle/${b.id}`, { state: { bundle: b } })}
                className="w-full bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm active:scale-[0.98] transition-all text-left">
                <div className="flex">
                  <div className="w-[120px] h-[150px] shrink-0 bg-gray-100 relative overflow-hidden rounded-l-2xl">
                    {b.image_url ? (
                      <BeautyImage src={b.image_url} alt={b.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-pink-50 to-orange-50">📦</div>
                    )}
                    {badge && (
                      <span className={`absolute top-2 left-2 ${badge.bg} text-white text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-md`}>
                        {badge.icon} {badge.text}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-black text-gray-900 truncate">{b.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{(b.includedSvcs || []).map(s => s.title || s.name).join(", ")}</p>
                        </div>
                        <Heart className="w-4 h-4 text-gray-300 shrink-0 ml-1" />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {b.proProfile?.avatar_url ? (
                          <BeautyImage src={b.proProfile.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px]">👤</div>
                        )}
                        <span className="text-[10px] text-gray-400 font-medium truncate">By {b.proProfile?.salon_name || b.pro_email}</span>
                        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        <span className="text-[10px] text-gray-500 font-bold">{b.proProfile?.rating || 4.9}</span>
                        <span className="text-[9px] text-gray-400">({Math.floor(Math.random() * 200 + 10)})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1.5">
                      <span className="flex items-center gap-0.5"><Scissors className="w-3 h-3" /> {b.serviceCount} services</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {durStr}</span>
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {grp ? `${minP}-${maxP} pers.` : "1 personne"}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2">
                        {savings > 0 && <span className="bg-rose-50 text-rose-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-100">Économisez {savPct}%</span>}
                        {grp ? <span className="text-[10px] text-gray-400">À partir de</span> : <span className="text-[10px] text-gray-400">pour 1 pers.</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {b.regularTotal > 0 && b.bundle_price < b.regularTotal && (
                          <span className="text-[10px] text-gray-400 line-through">{b.regularTotal}€</span>
                        )}
                        <span className="text-[18px] font-black text-primary">{b.bundle_price}€</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          <div className="text-center py-4 border-t border-gray-100 mt-2">
            <p className="text-[12px] text-gray-500 font-bold">Plus vous êtes, plus vous économisez !</p>
            <p className="text-[11px] text-primary font-bold mt-1">Voir comment ça marche →</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// Onglets principaux (style page Recherche : pastille icône + label)
const TAB_META = [
  { id: "STYLES", label: "Styles", Icon: Palette },
  { id: "SERVICES", label: "Services", Icon: Scissors },
  { id: "BUNDLES", label: "Bundles", Icon: Package },
  { id: "SALONS", label: "Salons", Icon: Building2 },
  { id: "PARTICULIERS", label: "Particuliers", Icon: UserCheck },
];

// Icônes des pastilles de catégories (style page Recherche)
const CAT_ICONS = {
  "Tous": Sparkles, "Coiffure": Scissors, "Maquillage": Paintbrush, "Ongles": Gem,
  "Perruque": Sparkles, "Tresses": Waves, "Extensions": Sparkles, "Pédicure": Footprints,
  "Soin": Droplets, "Barbe": Zap, "Massage": Hand, "Épilation": Sparkles,
  "Cils & Sourcils": Eye, "Spa & Bien-être": Heart, "Tatouage": PenTool, "Piercing": Circle,
  "Prestige": Gem, "Luxe": Crown, "Bio": Leaf, "Moderne": Zap, "Classique": Star,
};

function CategoryPills({ cats, active, onChange, extras = [], extraActive, onExtraChange }) {
  // Keep one visual selection in the whole category row. When a quick filter
  // is active, it replaces the generic "Tous" state instead of appearing
  // selected alongside it.
  const activeCategory = extraActive ? null : (cats.includes(active) ? active : "Tous");

  const renderExtra = ({ id, label, Icon }) => (
    <button
      key={id}
      type="button"
      aria-label={label}
      aria-pressed={extraActive === id}
      className={extraActive === id ? "selected" : ""}
      onClick={() => onExtraChange?.(id)}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  const categoryItems = cats.flatMap((cat) => {
    const Icon = CAT_ICONS[cat] || Sparkles;
    const categoryButton = (
      <button
        key={`category-${cat}`}
        type="button"
        aria-pressed={activeCategory === cat}
        aria-current={activeCategory === cat ? "true" : undefined}
        className={activeCategory === cat ? "selected" : ""}
        onClick={() => onChange(cat)}
      >
        <Icon size={16} />
        {cat}
      </button>
    );

    if (cat !== "Coiffure" || extras.length === 0) return [categoryButton];
    return [categoryButton, ...extras.map(renderExtra)];
  });

  return (
    <nav className="discovery-categories" aria-label="Catégories de prestations">
      {categoryItems}
    </nav>
  );
}

// ── Mini Publication Wizard inline ───────────────────────────────────────────
function QuickPublishModal({ onClose }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full px-5 pt-4 pb-10" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h3 className="text-[18px] font-black text-gray-900 mb-1">Créer une publication</h3>
        <p className="text-[13px] text-gray-400 font-medium mb-5">Partagez votre style avec la communauté</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => { onClose(); navigate("/pro/publication"); }}
            className="flex flex-col items-center gap-3 py-6 bg-orange-50 border-2 border-primary rounded-3xl active:scale-95 transition-all">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
              <span className="text-[24px]">📸</span>
            </div>
            <span className="text-[13px] font-black text-primary">Photos</span>
          </button>
          <button onClick={() => { onClose(); navigate("/pro/publication"); }}
            className="flex flex-col items-center gap-3 py-6 bg-gray-50 border-2 border-gray-200 rounded-3xl active:scale-95 transition-all">
            <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center">
              <Play className="w-6 h-6 text-white" />
            </div>
            <span className="text-[13px] font-black text-gray-700">Vidéo / Réel</span>
          </button>
        </div>
        <button onClick={onClose} className="w-full text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">Annuler</button>
      </div>
    </div>
  );
}

// ── Search Results ────────────────────────────────────────────────────────────
function VisualSearchResults({ result, onClose }) {
  const products = result?.products || [];
  const detectedItems = result?.detected_items || [];

  return (
    <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-primary">Recherche visuelle</p>
          <p className="mt-1 text-[12px] text-gray-500">Éléments détectés dans votre photo</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer la recherche visuelle" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200">
          <X size={17} />
        </button>
      </div>
      {detectedItems.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {detectedItems.map((item, index) => <span key={`${item.type}-${index}`} className="rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-700">{item.type}{item.color ? ` · ${item.color}` : ""}</span>)}
        </div>
      )}
      {products.length > 0 ? (
        <>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Produits correspondants ({products.length})</p>
          <div className="grid grid-cols-2 gap-3">
            {products.slice(0, 6).map(product => (
              <a key={product.id} href={product.url || `/produit/${product.id}`} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="h-24 bg-gray-100">
                  {product.img ? <BeautyImage src={product.img} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl">✨</div>}
                </div>
                <div className="p-2.5"><p className="truncate text-[12px] font-black text-gray-900">{product.name}</p>{product.price != null && <p className="mt-1 text-[11px] font-bold text-primary">{product.price}€</p>}</div>
              </a>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-gray-50 px-4 py-5 text-center"><p className="text-[13px] font-bold text-gray-600">Aucun produit correspondant pour le moment.</p><p className="mt-1 text-[11px] text-gray-400">Essayez une photo plus nette ou utilisez la recherche texte.</p></div>
      )}
    </div>
  );
}

function SearchResults({ query, onClose }) {
  const navigate = useNavigate();
  const [results, setResults] = useState({ styles: [], services: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2) { setResults({ styles: [], services: [] }); return; }
    setLoading(true);
    const q = query.toLowerCase();
    Promise.all([
      entities.Style.filter({ status: "publie" }, "-created_at", 100).then(items => (items || []).filter(s => s.title?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))).catch(() => []),
      entities.Service.filter({ status: "actif" }, "-created_at", 100).catch(() => []),
    ]).then(([styles, services]) => {
      setResults({
        styles,
        services: services.filter(s => s.title?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)).slice(0, 5),
      });
    }).finally(() => setLoading(false));
  }, [query]);

  const total = results.styles.length + results.services.length;

  if (!query || query.trim().length < 2) return null;

  return (
    <div className="absolute top-full left-0 right-0 bg-white shadow-xl z-50 max-h-[70vh] overflow-y-auto border-t border-gray-100">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2">
          <span className="text-[32px]">🔍</span>
          <p className="text-[14px] font-black text-gray-500">Aucun résultat pour "{query}"</p>
        </div>
      ) : (
        <div className="pb-4">
          {results.styles.length > 0 && (
            <>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">Styles ({results.styles.length})</p>
              {results.styles.map(style => (
                <button key={style.id}
                  onClick={() => { onClose(); navigate(`/style/${style.id}`, { state: { id: style.id, title: style.title, cover: style.image_url || (style.images && style.images[0]), images: style.images || [], category: style.category, description: style.description, likes: style.likes } }); }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors text-left">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {(style.image_url || (style.images && style.images[0])) ? (
                      <BeautyImage src={style.image_url || style.images[0]} alt={style.title} className="w-full h-full object-cover" />
                    ) : <span className="w-full h-full flex items-center justify-center text-[20px]">✂️</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-gray-900 truncate">{style.title}</p>
                    {style.category && <p className="text-[11px] text-primary font-bold">{style.category}</p>}
                  </div>
                  <span className="text-gray-300 text-lg shrink-0">›</span>
                </button>
              ))}
            </>
          )}
          {results.services.length > 0 && (
            <>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">Services ({results.services.length})</p>
              {results.services.map(service => (
                <button key={service.id}
                  onClick={() => { onClose(); navigate(`/service/${service.id}`, { state: { title: service.title, price: service.price, duration: service.duration_min, cover: service.image_url } }); }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors text-left">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {service.image_url ? (
                      <BeautyImage src={service.image_url} alt={service.title} className="w-full h-full object-cover" />
                    ) : <span className="w-full h-full flex items-center justify-center text-[20px]">💆</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-gray-900 truncate">{service.title}</p>
                    <div className="flex items-center gap-2">
                      {service.price && <p className="text-[12px] font-black text-primary">{service.price}€</p>}
                      {service.category && <p className="text-[11px] text-gray-400 font-medium">{service.category}</p>}
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg shrink-0">›</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicesSalons() {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const restoredStylesContext = routerLocation.state?.restoreStylesContext || readStylesReturnContext();
  const initialTab = urlParams.get("tab") || restoredStylesContext?.activeTab || "STYLES";

  // Mapping catégorie id (depuis Home GLOBAL_CATEGORIES) → tab + sous-catégorie
  const CAT_MAP = {
    "coiffure":   { tab: "STYLES",       sub: "Coiffure" },
    "perruque":   { tab: "STYLES",       sub: "Perruque" },
    "tresses":    { tab: "STYLES",       sub: "Coiffure" },
    "maquillage": { tab: "STYLES",       sub: "Maquillage" },
    "manucure":   { tab: "STYLES",       sub: "Ongles" },
    "pedicure":   { tab: "STYLES",       sub: "Ongles" },
    "extensions": { tab: "STYLES",       sub: "Coiffure" },
    "soin-visage":{ tab: "SERVICES",     sub: "Soin" },
    "barbe":      { tab: "SERVICES",     sub: "Barbe" },
    "massage":    { tab: "SERVICES",     sub: "Massage" },
    "epilation":  { tab: "SERVICES",     sub: "Épilation" },
    "cils":       { tab: "SERVICES",     sub: "Soin" },
    "spa":        { tab: "SERVICES",     sub: "Massage" },
  };

  const catParam = (urlParams.get("cat") || "").toLowerCase();
  const catMapped = CAT_MAP[catParam];

  const [activeTab, setActiveTab] = useState(catMapped?.tab || initialTab);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [visualSearch, setVisualSearch] = useState(null);
  const [visualSearchLoading, setVisualSearchLoading] = useState(false);
  const [visualSearchError, setVisualSearchError] = useState("");
  const imageSearchInputRef = useRef(null);
  const [showPublish, setShowPublish] = useState(false);
  const [styleQuickFilter, setStyleQuickFilter] = useState(restoredStylesContext?.quickFilter || null);
  const [adminStyleCategories, setAdminStyleCategories] = useState([]);
  const [activeCategoryMap, setActiveCategoryMap] = useState({
    STYLES: catMapped?.tab === "STYLES" ? catMapped.sub : (restoredStylesContext?.activeCategory || "Tous"),
    SERVICES: catMapped?.tab === "SERVICES" ? catMapped.sub : "Tous",
    SALONS: "Tous",
    PARTICULIERS: "Tous",
  });

  const loadAdminStyleCategories = useCallback(async () => {
    const remoteResult = await entities.StyleCategory
      .filter({ is_active: true }, "-created_at", 500)
      .catch(() => []);
    const remoteRows = Array.isArray(remoteResult) ? remoteResult : remoteResult?.data?.results || [];
    let localRows = [];
    try {
      const parsed = JSON.parse(localStorage.getItem("bb_style_categories") || "[]");
      localRows = Array.isArray(parsed) ? parsed : [];
    } catch {}
    const seen = new Set();
    const merged = [...remoteRows, ...localRows]
      .filter(item => item && item.is_active !== false)
      .filter(item => {
        const identity = normalizeStyleTaxonomyValue(item.id || item.name || item.label || item.title);
        if (!identity || seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
    setAdminStyleCategories(merged);
  }, []);

  useEffect(() => {
    loadAdminStyleCategories();
    const unsubscribe = entities.StyleCategory?.subscribe?.(() => loadAdminStyleCategories());
    return () => unsubscribe?.();
  }, [loadAdminStyleCategories]);

  const closeSearch = () => { setSearch(""); setSearchOpen(false); setVisualSearch(null); setVisualSearchError(""); };

  const handleImageSearch = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSearchOpen(true);
    setVisualSearch(null);
    setVisualSearchError("");
    setVisualSearchLoading(true);
    try {
      const { file_url } = await uploadFile({ file });
      const response = await apiClient.callFunction("shAiImageSearch", { image_url: file_url });
      setVisualSearch(response?.data || response || { detected_items: [], products: [] });
    } catch (error) {
      setVisualSearchError(error?.message || "La recherche par image est momentanément indisponible.");
    } finally {
      setVisualSearchLoading(false);
    }
  };

  const dynamicStyleCategories = useMemo(() => {
    const adminNames = adminStyleCategories.map(item => item.name || item.label || item.title).filter(Boolean);
    return ["Tous", ...new Set([...STYLE_CATEGORIES.slice(1), ...adminNames])];
  }, [adminStyleCategories]);

  const currentCats = activeTab === "STYLES" ? dynamicStyleCategories
    : activeTab === "SERVICES" ? SERVICE_CATEGORIES
    : activeTab === "SALONS" ? SALON_FILTER_CATEGORIES
    : activeTab === "PARTICULIERS" ? PARTICULIER_CATEGORIES : [];

  return (
    <div className="discovery-page services-page font-display flex flex-col" style={{ height: "100dvh" }}>

      {showPublish && <QuickPublishModal onClose={() => setShowPublish(false)} />}

      {/* ── En-tête compact : la recherche est accessible à la demande ── */}
      <header className="discovery-hero flex-shrink-0 relative z-40">
        <div className="services-page-toolbar">
          <div className="services-page-heading">
            <span className="services-page-kicker">BeautyBook</span>
            <span className="services-page-context">Explorer les styles et prestations</span>
          </div>
          <button type="button" aria-label={searchOpen ? "Fermer la recherche" : "Ouvrir la recherche"} aria-expanded={searchOpen} onClick={() => setSearchOpen(previous => !previous)} className={`services-search-trigger ${searchOpen ? "active" : ""}`}>
            <Search size={21} aria-hidden="true" />
          </button>
        </div>

        {searchOpen && <div className="services-search-panel relative">
          <div className="services-search-controls">
            <label className="discovery-query flex-1">
              <Search size={19} aria-hidden="true" />
              <span className="sr-only">Rechercher un style, un service ou une catégorie</span>
              <input autoFocus type="search" value={search} onChange={event => { setSearch(event.target.value); setVisualSearch(null); }} placeholder="Styles, services, catégories..." />
            </label>
            <input ref={imageSearchInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSearch} />
            <button type="button" onClick={() => imageSearchInputRef.current?.click()} aria-label="Rechercher par image" title="Rechercher par image" className="services-image-search-button">
              {visualSearchLoading ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />}
              <span className="sr-only">Rechercher par image</span>
            </button>
          </div>
          <p className="services-search-hint"><ImageIcon size={13} /> Importez une photo pour trouver des produits similaires.</p>
          {visualSearchError && <p role="alert" className="services-search-error">{visualSearchError}</p>}
          {visualSearch && <VisualSearchResults result={visualSearch} onClose={() => setVisualSearch(null)} />}
          {search.trim().length >= 2 && !visualSearch && <SearchResults query={search} onClose={closeSearch} />}
        </div>}

        {/* Onglets principaux */}
        <div className="discovery-entity-tabs-container">
          <div className="discovery-entity-tabs" role="tablist" aria-label="Onglets Services et Salons">
            {TAB_META.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                className={`discovery-entity-tab ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pastilles catégories */}
        {currentCats.length > 0 && (
          <CategoryPills
            cats={currentCats}
            active={activeCategoryMap[activeTab]}
            onChange={v => {
              setActiveCategoryMap(p => ({ ...p, [activeTab]: v }));
              if (activeTab === "STYLES") setStyleQuickFilter(null);
            }}
            extras={activeTab === "STYLES" ? [
              { id: "type_cheveux", label: "Type de cheveux", Icon: Scissors },
              { id: "type_peau", label: "Type de peau", Icon: Droplets },
              { id: "niveau_difficulte", label: "Niveau de difficulté", Icon: Sparkles },
            ] : []}
            extraActive={activeTab === "STYLES" ? styleQuickFilter : null}
            onExtraChange={id => {
              setActiveCategoryMap(p => ({ ...p, STYLES: "Tous" }));
              setStyleQuickFilter(previous => previous === id ? null : id);
            }}
          />
        )}
      </header>

      {/* ── Tab Content ── */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 ${activeTab === "STYLES" ? "pb-0" : "pb-24"}`}
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", height: "100%" }}
      >
        {activeTab === "STYLES" && <StylesTab activeCategory={activeCategoryMap["STYLES"]} quickFilter={styleQuickFilter} returnContext={restoredStylesContext} onQuickFilterConsumed={() => setStyleQuickFilter(null)} />}
        {activeTab === "SERVICES" && <ServicesTab activeCategory={activeCategoryMap["SERVICES"]} />}
        {activeTab === "SALONS" && <SalonsTab activeCategory={activeCategoryMap["SALONS"]} />}
        {activeTab === "PARTICULIERS" && <ParticuliersTab activeCategory={activeCategoryMap["PARTICULIERS"]} />}
        {activeTab === "BUNDLES" && <BundlesTab />}
      </div>
    </div>
  );
}
