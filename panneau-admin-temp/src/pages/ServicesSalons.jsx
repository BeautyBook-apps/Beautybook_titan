import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useThemeBg } from "@/hooks/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { Search, Heart, Clock, MapPin, Share2, MessageSquare, Star, Send, X, SlidersHorizontal, Plus, Play, Tag, Volume2, VolumeX, Sparkles, Palette } from "lucide-react";
import ProfilSheet from "@/components/salons/ProfilSheet";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { likesApi } from '@/api/likes';
import SponsoredCard from "@/components/reels/SponsoredCard";
import { getPublicAds } from "@/lib/publicAds";
import MapWithPricePins from "@/components/map/MapWithPricePins";
import AdvancedFilterSheet from "@/components/filters/AdvancedFilterSheet";
import FiltreAIModal from "@/components/modals/FiltreAIModal";


// ── Images ────────────────────────────────────────────────────────────────────
const NAIL_IMG = "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=600";
const SALON_IMG = "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=600";
const SALON_IMG2 = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600";
const PERSON_IMG1 = "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=400";
const PERSON_IMG2 = "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400";
const PERSON_IMG3 = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=400";
const STYLE_IMG1 = "https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?q=80&w=600";
const STYLE_IMG2 = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600";
const STYLE_IMG3 = "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=600";
const SARAH_IMG = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100";

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
            <img src={url} alt="" className="w-full h-full object-cover object-[center_55%]" />
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

function FilterChips({ filters, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
      {filters.map((f) => (
        <button key={f} onClick={() => onChange(f)}
          className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-black border transition-all active:scale-95 ${active === f ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "bg-white text-gray-600 border-gray-200"}`}>
          {f}
        </button>
      ))}
    </div>
  );
}

const STYLE_CATEGORIES = ["Tous", "Coiffure", "Perruque", "Maquillage", "Ongles", "Soin", "Barbe", "Massage"];
const SERVICE_CATEGORIES = ["Tous", "Coiffure", "Maquillage", "Ongles", "Soin", "Barbe", "Massage", "Épilation"];
const SALON_CATEGORIES = ["Tous", "Prestige", "Luxe", "Bio", "Moderne", "Classique"];
const PARTICULIER_CATEGORIES = ["Tous", "Coiffure", "Maquillage", "Ongles", "Soin", "Barbe"];

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
              <img src={style.img} alt={style.title} className="w-full h-full object-cover" />
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

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
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
      action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`, "_blank"); onClose(); }
    },
    {
      label: copied ? "Copié !" : "Copier lien", bg: copied ? "bg-green-600" : "bg-gray-700", emoji: copied ? "✅" : "🔗",
      action: handleCopy
    },
    {
      label: "SMS", bg: "bg-blue-500", emoji: "✉️",
      action: () => { window.open(`sms:?body=${encodeURIComponent(text + "\n" + url)}`); onClose(); }
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
          {style.img && <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0"><img src={style.img} alt={style.title} className="w-full h-full object-cover" /></div>}
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

function StylesTab({ activeCategory }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liked, setLiked] = useState([]);
  const [likeCounts, setLikeCounts] = useState({});
  const [showImmobilier, setShowImmobilier] = useState(false);
  const [styles, setStyles] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [hiddenAds, setHiddenAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(null);
  const [showShare, setShowShare] = useState(null);
  const [showBook, setShowBook] = useState(null);
  const scrollRef = useRef(null);

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
      const items = await entities.Style.filter({ status: "publie" }, "-created_at", 200);
      const mapped = (items || []).map(r => ({
        id: r.id, img: r.image_url || (r.images && r.images[0]) || STYLE_IMG1,
        images: r.images && r.images.length > 0 ? r.images : [r.image_url || STYLE_IMG1],
        video_url: r.video_url || null,
        author: r.pro_email?.split("@")[0] || "Pro",
        authorImg: SARAH_IMG,
        title: r.title, likes: r.likes || 0, comments: r.comments || 0,
        category: r.category, description: r.description,
      }));
      setStyles(mapped);

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
      setStyles(prev => prev.map(s => ({
        ...s,
        comments: ccm[String(s.id)] ?? s.comments ?? 0,
      })));

      const counts = await likesApi.getLikeCounts(styleIds, 'style');
      setLikeCounts(counts);
    } catch {}
  }, []);

  useEffect(() => {
    getPublicAds({ page: "styles", limit: 20 })
      .then(setAnnonces)
      .catch(() => setAnnonces([]));

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

  const handleLike = async (e, styleId) => {
    e.stopPropagation();
    const alreadyLiked = liked.includes(styleId);
    const userEmail = user?.email;
    if (!userEmail) return;

    if (alreadyLiked) {
      setLiked(prev => prev.filter(id => id !== styleId));
      try {
        await supabase.from('user_like').delete().eq('user_email', userEmail).eq('target_id', styleId).eq('target_type', 'style');
      } catch (e) { console.error('[like] remove error:', e); }
    } else {
      setLiked(prev => [...prev, styleId]);
      try {
        await supabase.from('user_like').insert({ user_email: userEmail, target_id: styleId, target_type: 'style', user_name: user?.full_name || '', user_avatar: user?.avatar_url || '' });
      } catch (e) { console.error('[like] insert error:', e); }
    }

    // Recharger le compteur
    try {
      const { data } = await supabase.from('user_like').select('id').eq('target_id', styleId).eq('target_type', 'style');
      const count = data ? data.length : 0;
      setLikeCounts(prev => ({ ...prev, [styleId]: count }));
    } catch (e) { console.error('[like] count error:', e); }
  };

  const filteredStyles = activeCategory === "Tous" ? styles : styles.filter(s => s.category === activeCategory);

  const goToDetail = (style) => navigate(`/style/${style.id}`, {
    state: { id: style.id, title: style.title, cover: style.img, images: style.images, video_url: style.video_url, badge: style.category || "STYLE", category: style.category, description: style.description, likes: likeCounts[style.id] || style.likes, comments: style.comments }
  });

  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));

  if (loading) return <div className="flex items-center justify-center" style={{ height: "calc(100vh - 220px)" }}><div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" /></div>;

  if (filteredStyles.length === 0) return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 text-center" style={{ height: "calc(100vh - 260px)" }}>
      <span className="text-[48px]">✂️</span>
      <p className="text-[16px] font-black text-gray-700">Aucun style publié</p>
      <p className="text-[13px] text-gray-400 font-medium">Les professionnels n'ont pas encore publié de styles.</p>
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
      <div ref={scrollRef} className="overflow-y-scroll hide-scrollbar" style={{ height: "calc(100dvh - 180px - env(safe-area-inset-bottom, 60px))", scrollSnapType: "y mandatory", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {filteredStyles.map((style, idx) => (
          <React.Fragment key={style.id}>
            {idx > 0 && idx % 5 === 0 && annonces.length > 0 && !hiddenAds.includes(idx) && (
              <div style={{ scrollSnapAlign: "start", scrollSnapStop: "always", height: "calc(100dvh - 180px - env(safe-area-inset-bottom, 60px))" }}
                className="bg-black flex flex-col overflow-hidden">
                <SponsoredCard annonce={annonces[Math.floor(idx / 5 - 1) % annonces.length]} onClose={() => setHiddenAds(h => [...h, idx])} variant="styles" />
              </div>
            )}
            <StyleCard
              style={style} liked={liked.includes(style.id)} likeCount={likeCounts[style.id] || 0}
              onLike={(e) => handleLike(e, style.id)}
              onComment={(e) => { e.stopPropagation(); setShowComments(style); }}
              onShare={(e) => { e.stopPropagation(); setShowShare(style); }}
              onBook={(e) => { e.stopPropagation(); setShowBook(style); }}
              onDetail={() => goToDetail(style)} isVideo={isVideo}
            />
          </React.Fragment>
        ))}
        {filteredStyles.length === 5 && annonces[0] && !hiddenAds.includes(5) && (
          <div style={{ scrollSnapAlign: "start", scrollSnapStop: "always", height: "calc(100dvh - 180px - env(safe-area-inset-bottom, 60px))" }}
            className="bg-black flex flex-col overflow-hidden">
            <SponsoredCard annonce={annonces[0]} onClose={() => setHiddenAds(h => [...h, 5])} variant="styles" />
          </div>
        )}
      </div>
      {showComments && <CommentsSheet style={showComments} onClose={() => setShowComments(null)} onCommentCountChange={(styleId, newCount) => {
        setStyles(prev => prev.map(s => String(s.id) === String(styleId) ? { ...s, comments: newCount } : s));
      }} />}
      {showShare && <StyleShareSheet style={showShare} onClose={() => setShowShare(null)} />}
      {showBook && <OffreSheet style={showBook} onClose={() => setShowBook(null)} navigate={navigate} />}
    </>
  );
}

function StyleCard({ style, liked, likeCount, onLike, onComment, onShare, onDetail, onBook, isVideo }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
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

  return (
    <div className="relative w-full shrink-0 overflow-hidden"
      style={{ height: "calc(100dvh - 180px - env(safe-area-inset-bottom, 60px))", scrollSnapAlign: "start", scrollSnapStop: "always" }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {allMedia.map((url, i) => (
      <div key={i} className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out" style={{ transform: `translateX(${(i - imgIdx) * 100}%)` }}>
        {isVideo(url) ? (
          <video ref={i === imgIdx ? videoRef : null} src={url} autoPlay={i === imgIdx} loop muted={muted} playsInline
            className="w-full h-full object-cover object-[center_55%]" onTimeUpdate={i === imgIdx ? handleTimeUpdate : undefined} onClick={togglePlay} />
        ) : (
          <img src={url} alt={style.title} className="w-full h-full object-cover object-[center_55%]" onClick={onDetail} />
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
        <div className="absolute left-4 right-20 z-20 flex items-center gap-2" style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
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
      <div className="absolute right-3 flex flex-col items-center gap-3 z-10" style={{ bottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}>
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

      <div className="absolute left-4 right-20 z-10 cursor-pointer" style={{ bottom: "calc(50px + env(safe-area-inset-bottom, 0px))" }} onClick={onDetail}>
        {style.description && (
          <p className="text-white/80 text-[11px] font-medium mb-1.5 line-clamp-2 leading-relaxed">
            {style.description}
            {style.description.length > 60 && (
              <span className="text-primary font-bold ml-1">Voir plus</span>
            )}
          </p>
        )}
        <h3 className="text-white text-[20px] font-black leading-tight">{style.title}</h3>
        {style.category && (
          <span className="inline-block mt-1.5 bg-primary/80 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">{style.category}</span>
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
              <img src={c.user_avatar} alt="" className="w-full h-full object-cover" />
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
    entities.Service.filter({ status: "actif" }, "-created_at", 100)
      .then(async (svcs) => {
        setServices(svcs);
        // Charger les profils pro pour chaque service
        const emails = [...new Set(svcs.map(s => s.pro_email).filter(Boolean))];
        const profils = await Promise.all(
          emails.map(e => entities.ProfilPro.filter({ user_email: e }, "-created_at", 1).catch(() => []))
        );
        const map = {};
        emails.forEach((e, i) => { if (profils[i]?.[0]) map[e] = profils[i][0]; });
        setProfilsMap(map);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  let filtered = activeCategory === "Tous" ? services : services.filter(s => s.category === activeCategory);
  if (filters.priceMax) filtered = filtered.filter(s => s.price >= (filters.priceMin || 0) && s.price <= filters.priceMax);

  return (
    <div className="space-y-4">
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
          <span className="text-[48px]">✂️</span>
          <p className="text-[16px] font-black text-gray-700">Aucun service disponible</p>
          <p className="text-[13px] text-gray-400">Aucun professionnel dans cette catégorie.</p>
        </div>
      ) : filtered.map((item) => {
        const pro = profilsMap[item.pro_email];
        // Rassembler toutes les images du service
        // Rassembler toutes les images du service
        const media = [];
        if (item.image_url) media.push(item.image_url);
        if (item.images?.length > 0) item.images.forEach(u => { if (u && u !== item.image_url) media.push(u); });
        // Ajouter la vidéo si présente
        if (item.video_url && !media.includes(item.video_url)) media.unshift(item.video_url);
        const isOnline = pro?.status === "actif";
        return (
          <div key={item.id} className="mx-4 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
            <div className="relative">
              {media.length > 0 ? (
                <CardMediaSlider media={media} onCardClick={() => navigate(`/service/${item.id}`, { state: { id: item.id } })} />
              ) : (
                <div className="h-52 bg-gray-100 flex items-center justify-center" onClick={() => navigate(`/service/${item.id}`, { state: { id: item.id } })}><span className="text-[48px]">✂️</span></div>
              )}
              {/* Badge Disponible si pro en ligne */}
              {isOnline && (
                <span className="absolute top-3 left-3 bg-teal-400 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest z-10">
                  Disponible
                </span>
              )}
              <button onClick={(e) => {
                 e.stopPropagation();
                 setUnliked(prev => {
                   const next = prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id];
                   localStorage.setItem("bb_unliked_services", JSON.stringify(next));
                   // Mettre à jour bb_liked_services pour la page Profil favoris
                   const allLikedStr = localStorage.getItem("bb_liked_services") || "[]";
                   const allLiked = JSON.parse(allLikedStr);
                   const isNowUnliked = next.includes(item.id);
                   const updatedLiked = isNowUnliked
                     ? allLiked.filter(x => x !== item.id)
                     : [...new Set([...allLiked, item.id])];
                   localStorage.setItem("bb_liked_services", JSON.stringify(updatedLiked));
                   return next;
                 });
               }}
               className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow z-10">
               <Heart className={`w-4 h-4 ${!unliked.includes(item.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
              </button>
            </div>
            <div className="px-4 pt-3 pb-4 cursor-pointer active:opacity-80" onClick={() => navigate(`/service/${item.id}`, { state: { id: item.id } })}>
              {/* Nom du salon */}
              {pro?.salon_name && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-100 shrink-0">
                    {pro.avatar_url
                      ? <img src={pro.avatar_url} alt={pro.salon_name} className="w-full h-full object-cover" />
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
                  {pro.rating > 0 && (
                    <span className="flex items-center gap-1 bg-yellow-50 rounded-full px-2.5 py-1 border border-yellow-100">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-[11px] font-black text-gray-700">{pro.rating}</span>
                    </span>
                  )}
                  {(pro.city || pro.salon_name) && (
                    <span className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {[pro.city, pro.postal_code ? String(pro.postal_code).slice(0,2) : null].filter(Boolean).join(", ") || pro.salon_name}
                      </span>
                    </span>
                  )}
                  {pro.type_activite && (
                    <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2.5 py-1 rounded-full">
                      {pro.type_activite === "Salon" ? "Salon Professionnel" : pro.type_activite}
                    </span>
                  )}
                  {(() => { const open = isOpenNow(pro.ouverture); return open === null ? null : open
                    ? <span className="bg-teal-50 text-teal-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-teal-100">● Ouvert</span>
                    : <span className="bg-red-50 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-full border border-red-100">● Fermé</span>;
                  })()}
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
                  <span className="text-[12px] font-black text-gray-600">{item.duration_min} min</span>
                </div>
                <span className="text-[22px] font-black text-primary">{item.price} €</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Carte Profil Pro (Salon / Particulier) ────────────────────────────────────
function ProfilCard({ item, media, liked, onLike, onSelect, open, badge, minPrice, highlighted }) {
  const navigate = useNavigate();
  const city = [item.city, item.postal_code ? String(item.postal_code).slice(0, 2) : null].filter(Boolean).join(", ");

  const goToDetail = (e) => {
    if (e) e.stopPropagation();
    navigate("/pro/vue-client", { state: { proEmail: item.user_email } });
  };

  return (
    <div className={`mx-4 bg-white rounded-3xl overflow-hidden shadow-sm border active:scale-[0.99] transition-all duration-300 cursor-pointer ${highlighted ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20 scale-[1.01]" : "border-gray-100"}`} onClick={onSelect}>
      {/* Media — clic direct vers page détail */}
      <div className="relative">
        <CardMediaSlider media={media} onCardClick={goToDetail} />
        {/* Bouton like */}
        <button onClick={onLike} className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow z-10 active:scale-95 transition-all">
          <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
        </button>
        {/* Badge abonnement */}
        {badge && <span className="absolute top-3 left-3 bg-gray-900/80 text-white text-[10px] font-black px-2.5 py-1 rounded-full z-10 uppercase">{badge}</span>}
      </div>

      {/* Section blanche bas */}
      <div className="px-4 py-3">
        {/* Nom du salon + avatar */}
        <div className="flex items-center gap-2 mb-0.5">
          {item.avatar_url && (
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
              <img src={item.avatar_url} alt={item.salon_name} className="w-full h-full object-cover" />
            </div>
          )}
          <h3 className="text-[17px] font-black text-gray-900 leading-tight truncate">{item.salon_name}</h3>
        </div>
        {/* Spécialités / catégorie */}
        {item.specialites?.length > 0 && (
          <p className="text-[12px] text-primary font-bold truncate mt-0.5">{item.specialites.slice(0, 2).join(" · ")}</p>
        )}
        {/* Ville + type d'activité + ouvert/fermé sur une ligne */}
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-[12px] text-gray-500 font-semibold">{city}</span>
            </span>
          )}
          {item.type_activite && (
            <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2.5 py-0.5 rounded-full">
              {item.type_activite === "Salon" ? "Salon Professionnel" : item.type_activite}
            </span>
          )}
          {open !== null && (
            open
              ? <span className="bg-teal-50 text-teal-600 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-teal-100">● Ouvert</span>
              : <span className="bg-red-50 text-red-500 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-red-100">● Fermé</span>
          )}
          {item.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-[12px] font-black text-gray-700">{item.rating}</span>
            </span>
          )}
        </div>
        {/* Bouton Voir le profil + prix minimum */}
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); goToDetail(e); }}
            className="bg-primary text-white text-[11px] font-black px-4 py-1.5 rounded-2xl active:scale-95 transition-all shadow-sm shadow-primary/30"
          >
            Voir le profil →
          </button>
          {minPrice != null && (
            <span className="text-[13px] font-black text-gray-500">
              dès <span className="text-[16px] text-primary">{minPrice}€</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Utilitaire ouvert/fermé ───────────────────────────────────────────────────
function isOpenNow(ouverture) {
  if (!ouverture || Object.keys(ouverture).length === 0) return null;
  const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const now = new Date();
  const dayKey = days[now.getDay()];
  const d = ouverture[dayKey];
  if (!d || !d.open) return false;
  const [sh, sm] = (d.start || "00:00").split(":").map(Number);
  const [eh, em] = (d.end || "23:59").split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
}

// ── Salons Tab ────────────────────────────────────────────────────────────────

function SalonsTab({ activeCategory }) {
  const [liked, setLiked] = useState([]);
  const [selectedProfil, setSelectedProfil] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [profils, setProfils] = useState([]);
  const [minPricesMap, setMinPricesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 50)
      .then(async (all) => {
        const salons = all.filter(p => !p.type_activite || p.type_activite === "Salon");
        setProfils(salons);
        const emails = salons.map(p => p.user_email).filter(Boolean);
        const servicesArr = await Promise.all(
          emails.map(e => entities.Service.filter({ pro_email: e, status: "actif" }, "price", 10).catch(() => []))
        );
        const map = {};
        emails.forEach((e, i) => {
          const prices = servicesArr[i].map(s => s.price).filter(p => p > 0);
          if (prices.length > 0) map[e] = Math.min(...prices);
        });
        setMinPricesMap(map);
      })
      .catch(() => setProfils([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === "Tous" ? profils : profils.filter(p => p.specialites?.some(s => s.toLowerCase().includes(activeCategory.toLowerCase())));

  const mapItems = filtered.map((p) => ({
    id: p.id,
    price: minPricesMap[p.user_email] || 0,
    title: p.salon_name,
    lat: p.latitude || p._lat || null,
    lng: p.longitude || p._lng || null,
    address: p.address || null,
    city: p.city || null,
  }));

  const handleMapSelect = (item) => {
    setHighlightedId(item.id);
    setSelectedProfil(item);
    // Faire défiler vers la carte correspondante
    setTimeout(() => {
      const el = document.getElementById(`salon-card-${item.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleCardSelect = (item) => {
    setHighlightedId(item.id);
    setSelectedProfil(item);
  };

  return (
    <div className="space-y-4">
      {/* ── Map ── */}
      <div className="mx-4 pt-3"><MapWithPricePins items={mapItems} onSelectItem={handleMapSelect} height="h-40" /></div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="text-[48px]">🏪</span>
          <p className="text-[16px] font-black text-gray-700">Aucun salon disponible</p>
        </div>
      ) : (
        <div ref={listRef}>
          {filtered.map((item) => {
            const media = [];
            if (item.gallery?.length > 0) item.gallery.forEach(u => { if (u) media.push(u); });
            if (media.length === 0 && item.cover_url) media.push(item.cover_url);
            if (media.length === 0 && item.avatar_url) media.push(item.avatar_url);
            const open = isOpenNow(item.ouverture);
            return (
              <div key={item.id} id={`salon-card-${item.id}`}>
                <ProfilCard
                  item={item}
                  media={media.length > 0 ? media : ["https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=600"]}
                  liked={liked.includes(item.id)}
                  onLike={(e) => { e.stopPropagation(); setLiked(p => p.includes(item.id) ? p.filter(x => x !== item.id) : [...p, item.id]); }}
                  onSelect={() => handleCardSelect(item)}
                  open={open}
                  badge={item.abonnement && item.abonnement !== "free" ? item.abonnement : null}
                  minPrice={minPricesMap[item.user_email] ?? null}
                  highlighted={highlightedId === item.id}
                />
              </div>
            );
          })}
        </div>
      )}
      {selectedProfil && <ProfilSheet profil={selectedProfil} onClose={() => { setSelectedProfil(null); setHighlightedId(null); }} />}
    </div>
  );
}

// ── Particuliers Tab ──────────────────────────────────────────────────────────

function ParticuliersTab({ activeCategory }) {
  const [liked, setLiked] = useState([]);
  const [selectedProfil, setSelectedProfil] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [profils, setProfils] = useState([]);
  const [minPricesMap, setMinPricesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 50)
      .then(async (all) => {
        const particuliers = all.filter(p => p.type_activite === "Particulier");
        setProfils(particuliers);
        const emails = particuliers.map(p => p.user_email).filter(Boolean);
        const servicesArr = await Promise.all(
          emails.map(e => entities.Service.filter({ pro_email: e, status: "actif" }, "price", 10).catch(() => []))
        );
        const map = {};
        emails.forEach((e, i) => {
          const prices = servicesArr[i].map(s => s.price).filter(p => p > 0);
          if (prices.length > 0) map[e] = Math.min(...prices);
        });
        setMinPricesMap(map);
      })
      .catch(() => setProfils([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === "Tous" ? profils : profils.filter(p => p.specialites?.some(s => s.toLowerCase().includes(activeCategory.toLowerCase())));

  const mapItems = filtered.map((p) => ({
    id: p.id,
    price: minPricesMap[p.user_email] || 0,
    title: p.salon_name,
    lat: p.latitude || p._lat || null,
    lng: p.longitude || p._lng || null,
    address: p.address || null,
    city: p.city || null,
  }));

  const handleMapSelect = (item) => {
    setHighlightedId(item.id);
    setSelectedProfil(item);
    setTimeout(() => {
      const el = document.getElementById(`part-card-${item.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleCardSelect = (item) => {
    setHighlightedId(item.id);
    setSelectedProfil(item);
  };

  return (
    <div className="space-y-4">
      <div className="mx-4 pt-3"><MapWithPricePins items={mapItems} onSelectItem={handleMapSelect} height="h-40" /></div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="text-[48px]">👤</span>
          <p className="text-[16px] font-black text-gray-700">Aucun particulier disponible</p>
        </div>
      ) : (
        <div ref={listRef}>
          {filtered.map((item) => {
            const media = [];
            if (item.gallery?.length > 0) item.gallery.forEach(u => { if (u) media.push(u); });
            if (media.length === 0 && item.avatar_url) media.push(item.avatar_url);
            if (media.length === 0 && item.cover_url) media.push(item.cover_url);
            const open = isOpenNow(item.ouverture);
            return (
              <div key={item.id} id={`part-card-${item.id}`}>
                <ProfilCard
                  item={item}
                  media={media.length > 0 ? media : ["https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=400"]}
                  liked={liked.includes(item.id)}
                  onLike={(e) => { e.stopPropagation(); setLiked(p => p.includes(item.id) ? p.filter(x => x !== item.id) : [...p, item.id]); }}
                  onSelect={() => handleCardSelect(item)}
                  open={open}
                  minPrice={minPricesMap[item.user_email] ?? null}
                  highlighted={highlightedId === item.id}
                />
              </div>
            );
          })}
        </div>
      )}
      {selectedProfil && <ProfilSheet profil={selectedProfil} onClose={() => { setSelectedProfil(null); setHighlightedId(null); }} />}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ["STYLES", "SERVICES", "SALONS", "PARTICULIERS"];

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
                      <img src={style.image_url || style.images[0]} alt={style.title} className="w-full h-full object-cover" />
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
                      <img src={service.image_url} alt={service.title} className="w-full h-full object-cover" />
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
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "STYLES";

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
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const [activeCategoryMap, setActiveCategoryMap] = useState({
    STYLES: catMapped?.tab === "STYLES" ? catMapped.sub : "Tous",
    SERVICES: catMapped?.tab === "SERVICES" ? catMapped.sub : "Tous",
    SALONS: "Tous",
    PARTICULIERS: "Tous",
  });

  const closeSearch = () => { setShowSearch(false); setSearch(""); };

  return (
    <div className="font-display bg-[#f7f7f7] flex flex-col" style={{ height: "100dvh" }}>

      {showPublish && <QuickPublishModal onClose={() => setShowPublish(false)} />}

      {/* ── Header ── */}
      <div className="bg-white px-5 pt-4 pb-0 z-40 shadow-sm flex-shrink-0 relative">
        <div className="flex items-center justify-between mb-3">
          {showSearch ? (
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Styles, services, catégories..."
                className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none"
              />
              <button onClick={closeSearch} className="text-[12px] font-black text-gray-500">✕</button>
            </div>
          ) : (
            <>
              <h1 className="text-[22px] font-black text-gray-900">Services & Salons</h1>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowSearch(true)} className="w-9 h-9 flex items-center justify-center text-gray-600">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSearch && <SearchResults query={search} onClose={closeSearch} />}

        {/* Main Tabs */}
        <div className="flex gap-6 overflow-x-auto hide-scrollbar">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`shrink-0 pb-3 text-[13px] font-black border-b-2 transition-all ${activeTab === tab ? "text-primary border-primary" : "text-gray-400 border-transparent"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sous-catégories sticky ── */}
      <div className="bg-white px-4 py-2 border-b border-gray-100 flex-shrink-0">
        {activeTab === "STYLES" && <FilterChips filters={STYLE_CATEGORIES} active={activeCategoryMap["STYLES"]} onChange={v => setActiveCategoryMap(p => ({ ...p, STYLES: v }))} />}
        {activeTab === "SERVICES" && <FilterChips filters={SERVICE_CATEGORIES} active={activeCategoryMap["SERVICES"]} onChange={v => setActiveCategoryMap(p => ({ ...p, SERVICES: v }))} />}
        {activeTab === "SALONS" && <FilterChips filters={SALON_CATEGORIES} active={activeCategoryMap["SALONS"]} onChange={v => setActiveCategoryMap(p => ({ ...p, SALONS: v }))} />}
        {activeTab === "PARTICULIERS" && <FilterChips filters={PARTICULIER_CATEGORIES} active={activeCategoryMap["PARTICULIERS"]} onChange={v => setActiveCategoryMap(p => ({ ...p, PARTICULIERS: v }))} />}
      </div>

      {/* ── Tab Content ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-24"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", height: "100%" }}
      >
        {activeTab === "STYLES" && <StylesTab activeCategory={activeCategoryMap["STYLES"]} />}
        {activeTab === "SERVICES" && <ServicesTab activeCategory={activeCategoryMap["SERVICES"]} />}
        {activeTab === "SALONS" && <SalonsTab activeCategory={activeCategoryMap["SALONS"]} />}
        {activeTab === "PARTICULIERS" && <ParticuliersTab activeCategory={activeCategoryMap["PARTICULIERS"]} />}
      </div>
    </div>
  );
}
