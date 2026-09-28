import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Share2, Heart, Clock, Star, MapPin, Sparkles, MessageSquare, Send, X, ShoppingCart, Scissors, ChevronLeft, ChevronRight, Eye, Bookmark } from "lucide-react";
import VueClient from "@/pages/pro/VueClient";
import FiltreAIModal from "@/components/modals/FiltreAIModal";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { readPageCache, mergePageCache } from "@/hooks/usePageCache";



// ── Full-screen Lightbox ──────────────────────────────────────────────────────
function ImageLightbox({ media, initialIndex, onClose }) {
  const [current, setCurrent] = useState(initialIndex || 0);
  const touchStartX = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrent(c => Math.max(c - 1, 0));
      if (e.key === "ArrowRight") setCurrent(c => Math.min(c + 1, media.length - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [media.length, onClose]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setCurrent(c => Math.min(c + 1, media.length - 1));
      else setCurrent(c => Math.max(c - 1, 0));
    }
    touchStartX.current = null;
  };

  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onClose} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-white/70 text-[13px] font-bold">{current + 1} / {media.length}</span>
        <div className="w-10" />
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-2 min-h-0">
        {isVideo(media[current]) ? (
          <video src={media[current]} autoPlay loop muted playsInline className="max-w-full max-h-full object-contain rounded-xl" />
        ) : (
          <BeautyImage src={media[current]} alt="" className="max-w-full max-h-full object-contain rounded-xl select-none" draggable={false} />
        )}
      </div>

      {/* Navigation arrows */}
      {media.length > 1 && (
        <>
          {current > 0 && (
            <button onClick={() => setCurrent(c => c - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-all">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          {current < media.length - 1 && (
            <button onClick={() => setCurrent(c => c + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-all">
              <ArrowLeft className="w-5 h-5 text-white rotate-180" />
            </button>
          )}
        </>
      )}

      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="shrink-0 flex justify-center gap-2 px-4 py-4">
          {media.map((url, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === current ? "border-white scale-105" : "border-white/20 opacity-60"}`}>
              {isVideo(url) ? (
                <div className="w-full h-full bg-black/50 flex items-center justify-center">
                  <span className="text-white text-[10px] font-black">▶</span>
                </div>
              ) : (
                <BeautyImage src={url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Media slider ──────────────────────────────────────────────────────────────
function HeroSlider({ media = [], onImageClick }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  if (!media || media.length === 0) return <div className="h-[420px] bg-gray-200" />;

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

  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));

  return (
    <div className="relative h-[420px] overflow-hidden bg-gray-900"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => onImageClick?.(current)}
    >
      {media.map((url, i) => (
        <div key={i} className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(${(i - current) * 100}%)` }}>
          {isVideo(url) ? (
            <video src={url} autoPlay={i === current} loop muted playsInline className="w-full h-full object-cover" />
          ) : (
            <BeautyImage src={url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />
      {media.length > 1 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {media.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`rounded-full transition-all duration-300 ${i === current ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40"}`}
            />
          ))}
        </div>
      )}
      {isVideo(media[current]) && (
        <div className="absolute top-20 right-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 z-10">
          <span className="text-white text-[10px] font-black">▶ VIDEO</span>
        </div>
      )}
    </div>
  );
}

// ── Comments Sheet (bottom sheet Instagram) ───────────────────────────────────
function CommentsSheet({ styleId, onClose }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!styleId) { setLoading(false); return; }
    entities.CommentaireStyle.filter({ style_id: styleId }, "-created_at", 50)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [styleId]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const newC = await entities.CommentaireStyle.create({
      style_id: styleId,
      user_email: user?.email || "anonyme@beautybook.fr",
      user_name: user?.full_name || "Utilisateur",
      user_avatar: user?.avatar_url || "",
      content: input.trim(),
    });
    setComments(c => [newC, ...c]);
    setInput("");
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-white rounded-t-3xl flex flex-col max-h-[75vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
          <h3 className="text-[16px] font-black text-gray-900">
            Commentaires {comments.length > 0 && <span className="text-primary">({comments.length})</span>}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 hide-scrollbar">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <MessageSquare className="w-10 h-10 text-gray-200" />
              <p className="text-[13px] text-gray-400 font-medium">Soyez le premier à commenter !</p>
            </div>
          ) : comments.map(c => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                {c.user_avatar ? <BeautyImage src={c.user_avatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[14px] font-black text-gray-400">{(c.user_name || "?")[0].toUpperCase()}</span>}
              </div>
              <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
                <p className="text-[12px] font-black text-gray-700 mb-0.5">{c.user_name || "Utilisateur"}</p>
                <p className="text-[13px] text-gray-600 leading-snug">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-6 pt-3 border-t border-gray-100 flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Ajouter un commentaire..."
              className="w-full bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="w-11 h-11 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/30 active:scale-95 disabled:opacity-40">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share Sheet ───────────────────────────────────────────────────────────────
function ShareSheet({ title, styleId, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const options = [
    { label: "WhatsApp", color: "bg-green-500", emoji: "💬", href: `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}` },
    { label: "Instagram", color: "bg-gradient-to-br from-purple-500 to-pink-500", emoji: "📸", href: null },
    { label: "TikTok", color: "bg-black", emoji: "🎵", href: null },
    { label: "Copier lien", color: "bg-gray-700", emoji: "🔗", href: null },
    { label: "Message", color: "bg-blue-500", emoji: "✉️", href: `sms:?body=${encodeURIComponent(title + ' ' + url)}` },
  ];
  const handle = (opt) => {
    if (opt.label === "Copier lien") {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    } else if (opt.href) { window.open(opt.href, "_blank"); onClose(); }
    else { onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-md pb-10 px-6 pt-5" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-[16px] font-black text-gray-900 text-center mb-5">Partager ce style</h3>
        <div className="grid grid-cols-5 gap-3">
          {options.map(opt => (
            <button key={opt.label} onClick={() => handle(opt)} className="flex flex-col items-center gap-2 active:scale-95">
              <div className={`w-12 h-12 ${opt.color} rounded-2xl flex items-center justify-center text-[22px] shadow`}>{opt.emoji}</div>
              <span className="text-[10px] font-black text-gray-500 text-center leading-tight">
                {opt.label === "Copier lien" && copied ? "Copié !" : opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Providers section ─────────────────────────────────────────────────────────
function ProvidersSection({ salons, particuliers, loading }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("SALONS");
  const [selectedPro, setSelectedPro] = useState(null);
  const list = tab === "SALONS" ? salons : particuliers;

  return (
    <>
      {selectedPro && (
        <div className="fixed inset-0 z-[200] bg-white overflow-y-auto animate-in slide-in-from-bottom duration-300">
          <VueClient onClose={() => setSelectedPro(null)} proEmail={selectedPro.pro_email} />
        </div>
      )}

      <div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 mb-4">
          {["SALONS", "PARTICULIERS"].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-black transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>
              {t} {t === "SALONS" ? `(${salons.length})` : `(${particuliers.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-full w-2/3" />
                  <div className="h-3 bg-gray-200 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 bg-gray-50 rounded-2xl border border-gray-100">
            <Scissors className="w-10 h-10 text-gray-200" />
            <p className="text-[13px] font-black text-gray-400">Aucun {tab === "SALONS" ? "salon" : "particulier"} ne propose ce style</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((item) => (
              <div key={item.service_id}
                className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 border border-gray-100">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-all"
                  onClick={() => navigate(`/service/${item.service_id}`)}>
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-gray-200">
                    {item.avatar_url
                      ? <BeautyImage src={item.avatar_url} alt={item.salon_name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Scissors className="w-6 h-6 text-gray-300" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-gray-900 truncate">{item.salon_name}</p>
                    {item.service_title && <p className="text-[11px] text-primary font-bold truncate">✂️ {item.service_title}</p>}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {item.city && (
                        <>
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-[11px] text-gray-400 font-medium">
                            {[item.city, item.postal_code ? String(item.postal_code).slice(0,2) : null].filter(Boolean).join(", ")}
                          </span>
                        </>
                      )}
                      {item.type_activite && (
                        <span className="bg-orange-100 text-orange-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">{item.type_activite}</span>
                      )}
                      {(() => {
                        if (!item.ouverture) return null;
                        const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
                        const now = new Date();
                        const d = item.ouverture[days[now.getDay()]];
                        if (!d) return null;
                        if (!d.open) return <span className="bg-red-50 text-red-500 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-red-200">● Fermé</span>;
                        const [sh, sm] = (d.start || "00:00").split(":").map(Number);
                        const [eh, em] = (d.end || "23:59").split(":").map(Number);
                        const cur = now.getHours() * 60 + now.getMinutes();
                        return cur >= sh*60+sm && cur <= eh*60+em
                          ? <span className="bg-teal-50 text-teal-600 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-teal-200">● Ouvert</span>
                          : <span className="bg-red-50 text-red-500 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-red-200">● Fermé</span>;
                      })()}
                    </div>
                    {item.rating > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-[11px] font-black text-gray-700">{item.rating}</span>
                        {item.reviews_count > 0 && <span className="text-[10px] text-gray-400">({item.reviews_count})</span>}
                      </div>
                    )}
                  </div>
                </button>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-gray-400 font-medium">Dès</p>
                  <p className="text-[18px] font-black text-primary">{item.service_price}€</p>
                  <button onClick={() => setSelectedPro(item)}
                    className="mt-2 bg-gray-900 text-white text-[11px] font-black px-4 py-2.5 rounded-2xl active:scale-95 transition-all">
                    Voir profil →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Conseils Section ─────────────────────────────────────────────────────────
function ConseilsSection({ category }) {
  const navigate = useNavigate();
  const [conseils, setConseils] = useState([]);

  useEffect(() => {
    entities.Reel.filter({ status: "publie", category: "Conseils" }, "-created_at", 10)
      .then(items => {
        const filtered = category
          ? items.filter(r => !r.category || r.category === "Conseils" || r.category === category)
          : items;
        setConseils(filtered.slice(0, 6));
      })
      .catch(() => {});
  }, [category]);

  if (conseils.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 bg-primary rounded-full" />
          <h2 className="text-[20px] font-black text-gray-900">Conseils</h2>
        </div>
        <button
          onClick={() => navigate("/reseau-social?tab=Conseils")}
          className="text-[12px] font-black text-primary uppercase tracking-widest"
        >
          VOIR TOUT
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1">
        {conseils.map((conseil) => {
          const thumb = conseil.thumbnail_url || conseil.image_url || (conseil.images && conseil.images[0]);
          return (
            <button
              key={conseil.id}
              onClick={() => navigate("/reseau-social?tab=Conseils")}
              className="shrink-0 w-40 rounded-2xl overflow-hidden relative active:scale-[0.98] transition-all bg-gray-900"
            >
              <div className="h-52">
                {thumb
                  ? <BeautyImage src={thumb} alt={conseil.title} className="w-full h-full object-cover opacity-90" />
                  : <div className="w-full h-full flex items-center justify-center text-[40px]">💡</div>
                }
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-[11px] font-black leading-tight line-clamp-2">{conseil.title}</p>
                {conseil.author_name && (
                  <p className="text-white/60 text-[10px] font-medium mt-0.5">{conseil.author_name}</p>
                )}
              </div>
              <div className="absolute top-2 left-2 bg-primary/90 rounded-full px-2 py-0.5">
                <span className="text-white text-[9px] font-black uppercase tracking-wider">Conseil</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StyleDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state } = useLocation();
  const { id: paramId } = useParams();
  const s = state || {};

  // ── Cache de page par style : affichage direct depuis le cache, jamais d'écran
  // vide — le rafraîchissement réseau se fait en arrière-plan (cf. ProduitDetail).
  const styleId = paramId || s.id;
  const styleCacheKey = styleId ? `style_${styleId}` : null;
  const [initialCache] = useState(() => readPageCache(styleCacheKey) || {});
  const initialStyle = s.title ? s : (initialCache.style || (s.id ? s : null));

  const [style, setStyle] = useState(initialStyle);
  const [loadingStyle, setLoadingStyle] = useState(() => !initialStyle?.title);
  const [produits, setProduits] = useState(s.produits_utilises || initialCache.produits || []);
  const [providers, setProviders] = useState(initialCache.providers || { salons: [], particuliers: [] });
  const [loadingProviders, setLoadingProviders] = useState(() => !initialCache.providers);
  const [similarStyles, setSimilarStyles] = useState(initialCache.similarStyles || []);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(s.likes || initialCache.likesCount || 0);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const produitsRef = useRef(null);
  const profilsRef = useRef(null);
  const aiRef = useRef(null);

  // 1. Charger le style réel depuis la DB si pas dans state
  // Quand l'id change : afficher le cache du nouveau style (ou les données de
  // navigation) immédiatement, jamais un écran vide — cf. ProduitDetail.
  useEffect(() => {
    const styleId = paramId || s.id;
    if (!styleId) { setLoadingStyle(false); return; }
    const cacheKey = `style_${styleId}`;

    const cached = readPageCache(cacheKey);
    const navStyle = s.id === styleId && s.title ? s : null;
    const display = navStyle || cached?.style || null;
    if (display?.title) {
      setStyle(display);
      setProduits(display.produits_utilises || cached?.produits || []);
      setLikesCount(display.likes || cached?.likesCount || 0);
      if (cached?.providers) {
        setProviders(cached.providers);
        setLoadingProviders(false);
      } else {
        setLoadingProviders(true);
      }
      if (cached?.similarStyles) setSimilarStyles(cached.similarStyles);
      setLoadingStyle(false);
    } else {
      setStyle(null);
      setLoadingStyle(true);
    }

    entities.Style.filter({ id: styleId }, "-created_at", 1)
      .then(res => {
        if (res[0]) {
          setStyle(res[0]);
          const prods = res[0].produits_utilises || [];
          setProduits(prods);
          setLikesCount(res[0].likes || 0);
          mergePageCache(cacheKey, { style: res[0], produits: prods, likesCount: res[0].likes || 0 });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStyle(false));
  }, [paramId, s.id]);

  // 2. Charger les services proposant ce style + les ProfilPro associés + styles similaires
  // Le rafraîchissement se fait en arrière-plan : on n'efface jamais les
  // providers déjà affichés (issus du cache) pendant le chargement.
  useEffect(() => {
    if (!style?.title) return;

    const cacheKey = style.id ? `style_${style.id}` : null;

    Promise.all([
      // Charger tous les services actifs + les filtrer côté client (insensible à la casse/espaces)
      entities.Service.filter({ status: "actif" }, "-created_at", 200).catch(() => []),
      // Styles similaires (même catégorie)
      style.category
        ? entities.Style.filter({ status: "publie" }, "-created_at", 30).catch(() => [])
        : Promise.resolve([]),
    ]).then(async ([allServices, allStyles]) => {
      // Filtre insensible à la casse et aux espaces superflus
      // Match sur style OU sur le titre du service (contient des mots-clés du style)
      const normalise = (s) => (s || "").trim().toLowerCase();
      const styleTitle = normalise(style.title);
      const styleWords = styleTitle.split(/\s+/).filter(w => w.length > 3);
      const services = allServices.filter(sv => {
        const svStyle = normalise(sv.style);
        const svTitle = normalise(sv.title);
        // Match exact sur le champ style
        if (svStyle && svStyle === styleTitle) return true;
        // Match partiel si le champ style contient le titre du style
        if (svStyle && styleTitle.includes(svStyle) && svStyle.length > 4) return true;
        if (svStyle && svStyle.includes(styleTitle) && styleTitle.length > 4) return true;
        // Match sur le titre du service : au moins 2 mots-clés du style présents
        if (styleWords.length >= 2) {
          const matchCount = styleWords.filter(w => svTitle.includes(w)).length;
          if (matchCount >= Math.min(2, styleWords.length)) return true;
        }
        return false;
      });
      // Styles similaires (même catégorie, exclu celui-ci)
      const similar = allStyles
        .filter(st => st.id !== style.id && (!style.category || st.category === style.category))
        .slice(0, 8);
      setSimilarStyles(similar);
      if (cacheKey) mergePageCache(cacheKey, { similarStyles: similar });

      if (services.length === 0) {
        setProviders({ salons: [], particuliers: [] });
        setLoadingProviders(false);
        if (cacheKey) mergePageCache(cacheKey, { providers: { salons: [], particuliers: [] } });
        return;
      }

      // Récupérer les ProfilPro pour chaque service
      const uniqueEmails = [...new Set(services.map(sv => sv.pro_email).filter(Boolean))];
      const prosRes = await Promise.all(
        uniqueEmails.map(email =>
          entities.ProfilPro.filter({ user_email: email }, "-created_at", 1).catch(() => [])
        )
      );

      const proMap = {};
      prosRes.forEach(res => { if (res[0]) proMap[res[0].user_email] = res[0]; });

      // Construire la liste des providers avec infos fusionnées
      const providerItems = services.map(sv => {
      const pro = proMap[sv.pro_email] || {};
      return {
        service_id: sv.id,
        service_title: sv.title,
        service_price: sv.price,
        pro_email: sv.pro_email,
        salon_name: pro.salon_name || sv.pro_email,
        avatar_url: pro.avatar_url || sv.image_url,
        city: pro.city || "",
        postal_code: pro.postal_code || "",
        ouverture: pro.ouverture || null,
        rating: pro.rating || 0,
        reviews_count: pro.reviews_count || 0,
        type_activite: pro.type_activite || "Salon",
      };
      });

      const salons = providerItems.filter(p => p.type_activite === "Salon" || p.type_activite !== "Particulier");
      const particuliers = providerItems.filter(p => p.type_activite === "Particulier");
      setProviders({ salons, particuliers });
      setLoadingProviders(false);
      if (cacheKey) mergePageCache(cacheKey, { providers: { salons, particuliers } });
    });
  }, [style?.title, style?.id, style?.category]);

  useEffect(() => {
    if (!s._scrollTo) return;
    const timer = setTimeout(() => {
      if (s._scrollTo === "produits") produitsRef.current?.scrollIntoView({ behavior: "smooth" });
      else if (s._scrollTo === "profils") profilsRef.current?.scrollIntoView({ behavior: "smooth" });
      else if (s._scrollTo === "ai") {
        aiRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowAIModal(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [s._scrollTo]);

  const handleLike = async () => {
    const newLiked = !liked;
    const sid = style?.id || s.id;
    const userEmail = user?.email;
    if (!sid || !userEmail) return;

    setLiked(newLiked);
    setLikesCount(c => newLiked ? c + 1 : Math.max(0, c - 1));

    try {
      if (newLiked) {
        await likesApi.addLike(userEmail, String(sid), 'style', user?.full_name || "Utilisateur", user?.avatar_url || "");
      } else {
        await likesApi.removeLike(userEmail, String(sid), 'style');
      }
    } catch (e) {
      console.error('[StyleDetail.handleLike]', e);
      setLiked(!newLiked);
      setLikesCount(c => newLiked ? Math.max(0, c - 1) : c + 1);
    }
  };

  if (loadingStyle) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Fusionner state + données DB
  const st = style || s;

  if (!st.title) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center px-8">
          <p className="text-[16px] font-black text-gray-700 mb-2">Style introuvable</p>
          <button onClick={() => navigate(-1)} className="text-primary font-black text-[13px]">← Retour</button>
        </div>
      </div>
    );
  }

  const mediaList = (() => {
    const imgs = st.images && st.images.length > 0 ? st.images : (st.cover || st.image_url ? [st.cover || st.image_url] : []);
    const vid = st.video_url;
    if (vid && !imgs.includes(vid)) return [...imgs, vid];
    return imgs.length > 0 ? imgs : [];
  })();

  return (
    <div className="font-display bg-white min-h-full pb-24">

      {/* ── Sticky top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-all hover:bg-gray-200">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <span className="text-[15px] font-black text-gray-900">Détail du Style</span>
        <div className="flex gap-2">
          <button onClick={() => setShowShare(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-all hover:bg-gray-200">
            <Share2 className="w-4.5 h-4.5 text-gray-600" />
          </button>
          <button onClick={handleLike} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-all hover:bg-gray-200">
            <Heart className={`w-4.5 h-4.5 transition-all ${liked ? "fill-red-500 text-red-500 scale-110" : "text-gray-600"}`} />
          </button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="relative mt-[52px]">
        <HeroSlider media={mediaList} onImageClick={(idx) => { setLightboxIndex(idx); setLightboxOpen(true); }} />
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10">
          <span className="inline-block bg-primary/90 backdrop-blur-sm rounded-full px-3 py-1 text-white text-[9px] font-black uppercase tracking-widest mb-2">
            {st.badge || st.category || "STYLE TENDANCE"}
          </span>
          <h1 className="text-white text-[28px] font-black leading-tight drop-shadow-lg">{st.title}</h1>
          {st.duration && (
            <div className="flex items-center gap-1.5 mt-2">
              <Clock className="w-4 h-4 text-white/70" />
              <span className="text-white/90 text-[12px] font-bold">{st.duration}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 pt-5 space-y-7">

        {/* Filtre AI */}
        <div ref={aiRef} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl p-5 border border-orange-100">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <Eye className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-black text-gray-900">Filtre AI & Recommandations</p>
              <p className="text-[12px] text-gray-500 leading-relaxed mt-1">Découvrez si ce style correspond à la forme de votre visage.</p>
            </div>
          </div>
          <button onClick={() => setShowAIModal(true)}
            className="w-full bg-gradient-to-r from-primary to-orange-500 rounded-2xl py-4 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg shadow-primary/30">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white text-[13px] font-black uppercase tracking-widest">Essayer le Filtre AI</span>
          </button>
        </div>

        {/* Détails du Style */}
        {st.description && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <h2 className="text-[20px] font-black text-gray-900">Détails du Style</h2>
            </div>
            <p className="text-[14px] text-gray-600 leading-relaxed pl-4">{st.description}</p>
          </div>
        )}

        {/* Produits utilisés — depuis style.produits_utilises */}
        {produits.length > 0 && (
          <div ref={produitsRef}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-0.5 bg-primary rounded-full" />
              <span className="text-[16px] font-black text-gray-900">Produits Utilisés</span>
              <span className="ml-auto text-[10px] font-black text-primary uppercase tracking-widest">BOUTIQUE</span>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1">
              {produits.map((prod, i) => {
                const handleProduitClick = () => {
                  if (prod.external_url) window.open(prod.external_url, "_blank");
                  else if (prod.id) navigate(`/produit?id=${encodeURIComponent(prod.id)}`);
                  else navigate("/boutique");
                };
                return (
                  <div key={prod.id || i} className="shrink-0 w-40 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                    <button className="relative h-28 w-full active:opacity-80 transition-all" onClick={handleProduitClick}>
                      {prod.image_url
                        ? <BeautyImage src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-3xl">🧴</div>
                      }
                      {prod.price > 0 && (
                        <div className="absolute top-2 left-2 bg-white/90 rounded-full px-2 py-0.5">
                          <span className="text-[11px] font-black text-gray-800">{prod.price}€</span>
                        </div>
                      )}
                    </button>
                    <div className="p-2.5">
                      <p className="text-[11px] font-black text-gray-900 mb-2 leading-tight cursor-pointer active:opacity-70" onClick={handleProduitClick}>{prod.name}</p>
                      <button
                        onClick={handleProduitClick}
                        className="w-full bg-gray-900 rounded-xl py-2 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
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

        {/* Qui propose ce style ? — données réelles */}
        <div ref={profilsRef}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[20px] font-black text-gray-900">Qui propose ce style ?</h2>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {providers.salons.length + providers.particuliers.length} résultat{providers.salons.length + providers.particuliers.length > 1 ? "s" : ""}
            </span>
          </div>
          <ProvidersSection
            salons={providers.salons}
            particuliers={providers.particuliers}
            loading={loadingProviders}
          />
        </div>

        {/* Conseils */}
        <ConseilsSection category={st.category} />

        {/* Styles similaires — données réelles */}
        {similarStyles.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[20px] font-black text-gray-900">Styles similaires</h2>
              <button onClick={() => navigate("/reseau-social")} className="text-[12px] font-black text-primary uppercase tracking-widest">VOIR TOUT</button>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1">
              {similarStyles.map((item) => {
                const imgs = item.images?.length > 0 ? item.images : (item.image_url ? [item.image_url] : []);
                return (
                  <button key={item.id}
                    onClick={() => navigate(`/style/${item.id}`, { state: { ...item, cover: item.image_url, images: imgs } })}
                    className="shrink-0 w-40 rounded-2xl overflow-hidden relative active:scale-[0.98] transition-all bg-gray-100">
                    {imgs[0]
                      ? <BeautyImage src={imgs[0]} alt={item.title} className="w-full h-52 object-cover" />
                      : <div className="w-full h-52 flex items-center justify-center"><Scissors className="w-8 h-8 text-gray-300" /></div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-[12px] font-black leading-tight">{item.title}</p>
                      {item.category && (
                        <span className="inline-block mt-1 bg-primary/80 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">{item.category}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      {lightboxOpen && <ImageLightbox media={mediaList} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
      {showAIModal && <FiltreAIModal styleTitle={st.title} onClose={() => setShowAIModal(false)} />}
      {showComments && <CommentsSheet styleId={st.id} onClose={() => setShowComments(false)} />}
      {showShare && <ShareSheet title={st.title} styleId={st.id} onClose={() => setShowShare(false)} />}
    </div>
  );
}