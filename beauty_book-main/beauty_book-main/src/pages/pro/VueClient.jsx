import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Share2, Phone, MessageCircle, Calendar, MapPin,
  User, Scissors, Image, Star, Home, Moon, Wifi, Car,
  Coffee, Wind, ChevronRight, MoreVertical, CheckCircle2, Heart,
  Flag, UserMinus, X, PhoneCall, PhoneOff, Video, Mic, MicOff,
  Baby, CreditCard, Accessibility, Shirt, Sofa, Music, PawPrint,
  Snowflake, Sparkles, Clock, Zap, Droplets, Flower2, Brush,
  ChevronLeft, Play, Volume2, VolumeX, Maximize2, Palette, RotateCw,
  Instagram, Facebook, Globe
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useCall } from "@/components/call/CallManager";
import { useTheme } from "@/hooks/useTheme";
import VTCSection from "@/components/service/VTCSection";
import SalonMap from "@/components/map/SalonMap";
import { isOpenNow, getEffectiveOpening, formatOpeningHours, getOpeningStatus, applyNightMode } from "@/lib/hours";
import AssistantChatWidget from "@/components/AssistantChatWidget";

function getBannerGradient(theme) {
  if (theme === "night") return "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, #000000 100%)";
  if (theme === "dark")  return "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(26,26,46,0.75) 60%, #1a1a2e 100%)";
  return "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(255,255,255,0.25) 60%, #ffffff 100%)";
}

function getPageBg(theme) {
  if (theme === "night") return "#000000";
  if (theme === "dark")  return "#1a1a2e";
  return "#ffffff";
}
import CommandeModal from "@/components/restaurant/CommandeModal";
import PanoViewer from "@/components/virtualtour/PanoViewer";

const BANNER_IMG = "";
const PROFILE_IMG = "";
const SERVICE_1 = "";
const SERVICE_2 = "";
const VIRTUAL_IMG = "";

const TABS = [
  { id: "profil", label: "PROFIL", Icon: User },
  { id: "services", label: "SERVICES", Icon: Scissors },
  { id: "pub", label: "PUB", Icon: Image },
  { id: "avis", label: "AVIS", Icon: Star },
];

const HOURS = [];

// Map icônes commodités — Lucide épuré
const COMMODITE_ICONS = {
  "Wifi": { icon: Wifi, color: "text-sky-500", bg: "bg-sky-50" },
  "Parking": { icon: Car, color: "text-blue-500", bg: "bg-blue-50" },
  "Climatisation": { icon: Snowflake, color: "text-cyan-500", bg: "bg-cyan-50" },
  "Chauffage": { icon: Snowflake, color: "text-red-400", bg: "bg-red-50" },
  "Espace bébé": { icon: Baby, color: "text-pink-400", bg: "bg-pink-50" },
  "Café offert": { icon: Coffee, color: "text-amber-500", bg: "bg-amber-50" },
  "Paiement CB": { icon: CreditCard, color: "text-violet-500", bg: "bg-violet-50" },
  "Accessible PMR": { icon: Accessibility, color: "text-teal-500", bg: "bg-teal-50" },
  "Vestiaire": { icon: Shirt, color: "text-indigo-400", bg: "bg-indigo-50" },
  "Salle d'attente": { icon: Sofa, color: "text-orange-400", bg: "bg-orange-50" },
  "Douches": { icon: Droplets, color: "text-blue-400", bg: "bg-blue-50" },
  "Champagne": { icon: Sparkles, color: "text-yellow-400", bg: "bg-yellow-50" },
  "Musique d'ambiance": { icon: Music, color: "text-purple-400", bg: "bg-purple-50" },
  "Animaux acceptés": { icon: PawPrint, color: "text-green-500", bg: "bg-green-50" },
  "Miroir éclairé": { icon: Star, color: "text-amber-400", bg: "bg-amber-50" },
  "Espace VIP": { icon: Star, color: "text-yellow-500", bg: "bg-yellow-50" },
  "Loge privée": { icon: Star, color: "text-indigo-500", bg: "bg-indigo-50" },
  "TV écran": { icon: Star, color: "text-gray-500", bg: "bg-gray-50" },
  "Lumière naturelle": { icon: Star, color: "text-orange-300", bg: "bg-orange-50" },
  "Terrasse": { icon: Star, color: "text-green-400", bg: "bg-green-50" },
  "Bar à jus": { icon: Coffee, color: "text-orange-400", bg: "bg-orange-50" },
  "Bibliothèque": { icon: Star, color: "text-indigo-300", bg: "bg-indigo-50" },
  "Coin enfants": { icon: Baby, color: "text-pink-300", bg: "bg-pink-50" },
  "Stationnement privé": { icon: Car, color: "text-blue-600", bg: "bg-blue-50" },
  "Prise électrique": { icon: Zap, color: "text-yellow-500", bg: "bg-yellow-50" },
  "Miroirs plein corps": { icon: Star, color: "text-gray-400", bg: "bg-gray-50" },
  "Éclairage pro": { icon: Star, color: "text-amber-500", bg: "bg-amber-50" },
};

// Map icônes spécialités
const SPECIALITE_ICONS = {
  "Coiffure": { icon: Scissors, color: "text-primary", bg: "bg-orange-50" },
  "Coloration": { icon: Droplets, color: "text-rose-400", bg: "bg-rose-50" },
  "Maquillage": { icon: Sparkles, color: "text-pink-500", bg: "bg-pink-50" },
  "Ongles": { icon: Brush, color: "text-violet-500", bg: "bg-violet-50" },
  "Soin": { icon: Flower2, color: "text-teal-500", bg: "bg-teal-50" },
  "Massage": { icon: Zap, color: "text-amber-500", bg: "bg-amber-50" },
  "Barbe": { icon: Scissors, color: "text-gray-500", bg: "bg-gray-50" },
  "Épilation": { icon: Sparkles, color: "text-rose-300", bg: "bg-rose-50" },
  "default": { icon: Star, color: "text-primary", bg: "bg-orange-50" },
};

// ── Appel réel via numéro de téléphone ───────────────────────────────────────
function RealCallScreen({ targetName, targetAvatar, phoneNumber, onClose }) {
  useEffect(() => {
    // Déclenche immédiatement l'appel natif
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber.replace(/\s/g, "")}`;
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[500] bg-[#1a1a2e] flex flex-col items-center justify-between px-6 pt-16 pb-12">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
            <BeautyImage src={targetAvatar || PROFILE_IMG} alt={targetName} className="w-full h-full object-cover" />
          </div>
          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-full border-2 border-green-400/40 animate-ping" />
          <div className="absolute -inset-3 rounded-full border border-green-400/20 animate-ping" style={{ animationDelay: "0.3s" }} />
        </div>
        <p className="text-white text-[24px] font-black">{targetName}</p>
        {phoneNumber && (
          <p className="text-white/50 text-[14px] font-medium">{phoneNumber}</p>
        )}
        <p className="text-green-400 text-[14px] font-medium animate-pulse">
          {phoneNumber ? "Appel en cours..." : "Numéro non disponible"}
        </p>
      </div>

      <div className="flex items-center gap-1 h-12">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-1 bg-green-400/60 rounded-full animate-pulse"
            style={{ height: `${8 + (i % 5) * 6}px`, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onClose}
          className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/40 active:scale-95">
          <PhoneOff className="w-8 h-8 text-white" />
        </button>
        <p className="text-white/40 text-[11px] font-medium">Raccrocher</p>
      </div>
    </div>
  );
}

// ── Partage Sheet ──────────────────────────────────────────────────────────────
function ShareSheet({ title, url, onClose }) {
  const [copied, setCopied] = useState(false);
  const options = [
    { label: "WhatsApp", color: "bg-green-500", emoji: "💬", href: `https://wa.me/?text=${encodeURIComponent(title + " " + url)}` },
    { label: "Copier", color: "bg-gray-700", emoji: "🔗", href: null },
    { label: "SMS", color: "bg-blue-500", emoji: "✉️", href: `sms:?body=${encodeURIComponent(title + " " + url)}` },
    { label: "TikTok", color: "bg-black", emoji: "🎵", href: null },
  ];
  const handle = (opt) => {
    if (opt.label === "Copier") {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    } else if (opt.href) { window.open(opt.href, "_blank"); onClose(); }
    else onClose();
  };
  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onClose}>
      <div className="bg-[#1a1a2e] rounded-t-3xl w-full px-6 pb-8 pt-4" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
        <p className="text-white text-[14px] font-black text-center mb-5">Partager ce profil</p>
        <div className="grid grid-cols-4 gap-4">
          {options.map(opt => (
            <button key={opt.label} onClick={() => handle(opt)} className="flex flex-col items-center gap-2 active:scale-95">
              <div className={`w-14 h-14 ${opt.color} rounded-2xl flex items-center justify-center text-[22px]`}>{opt.emoji}</div>
              <span className="text-white/60 text-[10px] font-black">{opt.label === "Copier" && copied ? "Copié !" : opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Menu 3 points (petit popup ancré au bouton) ────────────────────────────────
function MoreMenu({ subscribed, onUnsubscribe, onReport, onClose }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-[400] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
      {subscribed && (
        <button onClick={onUnsubscribe}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left">
          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
            <UserMinus className="w-4 h-4 text-orange-500" />
          </div>
          <span className="text-[13px] font-black text-gray-800">Se désabonner</span>
        </button>
      )}
      <button onClick={onReport}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left">
        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
          <Flag className="w-4 h-4 text-red-500" />
        </div>
        <span className="text-[13px] font-black text-gray-800">Signaler</span>
      </button>
    </div>
  );
}

// ── Slider images service (identique à ServicesSalons) ───────────────────────
function ServiceSlider({ service, onCardClick }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));

  const media = [];
  if (service.video_url) media.push(service.video_url);
  if (service.image_url) media.push(service.image_url);
  if (service.images?.length > 0) service.images.forEach(u => { if (u && !media.includes(u)) media.push(u); });

  if (media.length === 0) return (
    <div className="h-[280px] bg-gray-100 flex items-center justify-center cursor-pointer" onClick={onCardClick}>
      <Scissors className="w-10 h-10 text-gray-300" />
    </div>
  );

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

  return (
    <div className="relative h-[280px] bg-gray-900 overflow-hidden cursor-pointer"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={onCardClick}>
      {media.map((url, i) => (
        <div key={i} className="absolute inset-0 transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(${(i - current) * 100}%)` }}>
          {isVideo(url)
            ? <video src={url} autoPlay={i === current} loop muted playsInline className="w-full h-full object-cover" />
            : <BeautyImage src={url} alt="" className="w-full h-full object-cover" />
          }
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      {/* Dots */}
      {media.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {media.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`rounded-full transition-all ${i === current ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}
      {/* Counter */}
      {media.length > 1 && (
        <div className="absolute top-3 right-4 bg-black/40 rounded-full px-2 py-0.5 z-10">
          <span className="text-white text-[10px] font-black">{current + 1}/{media.length}</span>
        </div>
      )}
      {/* Badge catégorie */}
      {service.category && (
        <span className="absolute bottom-10 left-4 bg-primary/90 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full z-10 tracking-wider">
          {service.category}
        </span>
      )}
    </div>
  );
}

// ── Visite Virtuelle 3D réelle depuis BDD ─────────────────────────────────────
function VisiteVirtuelle3D({ proEmail }) {
  const [visite, setVisite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewerActive, setViewerActive] = useState(false);

  useEffect(() => {
    if (!proEmail) { setLoading(false); return; }
    entities.VisiteVirtuelle.filter({ pro_email: proEmail, status: "actif" }, "-created_at", 1)
      .then(res => { setVisite(res[0] || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proEmail]);

  if (viewerActive && visite?.scenes?.length > 0) {
    return <PanoViewer scenes={visite.scenes} onClose={() => setViewerActive(false)} />;
  }

  if (loading) return null;

  const coverUrl = visite?.scenes?.[0]?.image_url || visite?.cover_url || null;
  const sceneCount = visite?.scenes?.length || 0;

  return (
    <div className="px-4 pt-4 pb-4 border-b border-gray-100">
      {visite ? (
        <div
          className="relative rounded-2xl overflow-hidden h-52 cursor-pointer active:scale-[0.99] transition-all group"
          onClick={() => setViewerActive(true)}
        >
          {/* Image de fond avec opacité basse */}
          {coverUrl ? (
            <BeautyImage
              src={coverUrl}
              alt="visite 3D"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          ) : (
            <div className="absolute inset-0 bg-gray-900" />
          )}
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/60" />

          {/* Contenu centré */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform duration-300">
              <RotateCw className="w-8 h-8 text-white" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewerActive(true);
              }}
              className="bg-primary hover:bg-primary/90 text-white text-[13px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-xl shadow-primary/30 active:scale-95 transition-all">
              Lancer la visite 360°
            </button>
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-[10px] font-medium">{sceneCount} scène{sceneCount !== 1 ? "s" : ""}</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                <path d="M3 12a9 9 0 1 1 18 0" />
                <path d="M21 12a9 9 0 0 1-18 0" />
              </svg>
              <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.15em]">Visite 360°</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden py-10 bg-[#F7F7F7] flex flex-col items-center justify-center gap-2 border border-dashed border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <path d="M3 21h18M3 7v1m0 6v1M3 8h.01M3 15h.01M7 21V9m6 12V3m2 18v-8m6 8v-4" />
            </svg>
          </div>
          <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Aucune visite virtuelle disponible</p>
          <p className="text-[11px] text-gray-300 font-medium">Le professionnel n'a pas encore ajouté de visite 3D</p>
        </div>
      )}
    </div>
  );
}

// ── Galerie Photo/Vidéo avec lightbox, slider et "Voir tout" ─────────────────
function GalerieSection({ gallery }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef({});

  if (!gallery?.length) return null;

  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));
  const MAX_VISIBLE = 6; // 2 lignes de 3
  const visible = showAll ? gallery : gallery.slice(0, MAX_VISIBLE);
  const hasMore = gallery.length > MAX_VISIBLE;

  const goNext = (e) => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % gallery.length); };
  const goPrev = (e) => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + gallery.length) % gallery.length); };

  const currentUrl = lightboxIdx !== null ? gallery[lightboxIdx] : null;
  const currentIsVideo = isVideo(currentUrl);

  return (
    <div className="px-4 pt-4 pb-4 border-b border-gray-100">
      <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Galerie Photos</p>
      <div className="grid grid-cols-3 gap-1.5">
        {visible.map((url, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer active:scale-[0.97] transition-all"
            onClick={() => setLightboxIdx(i)}
          >
            {isVideo(url) ? (
              <>
                <video src={url} muted playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-9 h-9 bg-white/80 rounded-full flex items-center justify-center">
                    <Play className="w-4 h-4 text-gray-900 ml-0.5" />
                  </div>
                </div>
              </>
            ) : (
              <BeautyImage src={url} alt={`galerie ${i + 1}`} className="w-full h-full object-cover" />
            )}
            {/* Bouton agrandir */}
            <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/40 rounded-full flex items-center justify-center">
              <Maximize2 className="w-3 h-3 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Voir tout / Réduire */}
      {hasMore && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="mt-3 w-full text-center text-[12px] font-black text-primary py-2.5 bg-orange-50 rounded-xl border border-orange-100 active:scale-[0.98] transition-all"
        >
          {showAll ? "Réduire ▲" : `Voir tout (${gallery.length}) ▼`}
        </button>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[600] bg-black flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
            className="absolute top-5 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center z-10">
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Navigation */}
          {gallery.length > 1 && (
            <>
              <button onClick={goPrev} className="absolute left-3 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center z-10 active:scale-95">
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button onClick={goNext} className="absolute right-3 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center z-10 active:scale-95">
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </>
          )}

          {/* Media */}
          <div className="w-full max-h-screen flex items-center justify-center px-14" onClick={e => e.stopPropagation()}>
            {currentIsVideo ? (
              <div className="relative w-full">
                <video
                  key={currentUrl}
                  src={currentUrl}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  controls={false}
                  className="w-full max-h-[85vh] object-contain rounded-xl"
                />
                <button
                  onClick={() => setMuted(m => !m)}
                  className="absolute bottom-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center active:scale-95"
                >
                  {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                </button>
              </div>
            ) : (
              <BeautyImage src={currentUrl} alt="" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            )}
          </div>

          {/* Compteur */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-4 py-1.5">
            <span className="text-white text-[12px] font-black">{lightboxIdx + 1} / {gallery.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grille Mosaïque TikTok/Pinterest ──────────────────────────────────────────
function MosaicGrid({ publications, navigate }) {
  const getThumb = (pub) => pub.thumbnail_url || pub.image_url || (pub.images && pub.images[0]);

  // Deux colonnes avec hauteurs variables style Pinterest
  const col1 = publications.filter((_, i) => i % 2 === 0);
  const col2 = publications.filter((_, i) => i % 2 !== 0);

  const Card = ({ pub }) => {
    const videoRef = useRef(null);
    const thumb = getThumb(pub);
    const isVideo = pub.video_url;
    const [hovering, setHovering] = useState(false);

    const handleMouseEnter = () => {
      setHovering(true);
      if (videoRef.current) { videoRef.current.play().catch(() => {}); }
    };
    const handleMouseLeave = () => {
      setHovering(false);
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    };

    return (
      <div
        className="relative rounded-2xl overflow-hidden bg-gray-100 cursor-pointer active:scale-[0.98] transition-all mb-2 shadow-sm"
        style={{ aspectRatio: isVideo ? "9/16" : (Math.random() > 0.5 ? "4/5" : "3/4") }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => navigate(`/reseau-social?reelId=${pub.id}`)}
      >
        {/* Image de base */}
        {thumb && <BeautyImage src={thumb} alt={pub.title} className="w-full h-full object-cover" />}
        {!thumb && <div className="w-full h-full flex items-center justify-center"><Image className="w-8 h-8 text-gray-300" /></div>}

        {/* Vidéo en lecture muette au survol */}
        {isVideo && (
          <video ref={videoRef} src={pub.video_url} muted loop playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${hovering ? "opacity-100" : "opacity-0"}`} />
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Badge vidéo */}
        {isVideo && !hovering && (
          <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5 flex items-center gap-1">
            <span className="text-white text-[9px] font-black">▶</span>
          </div>
        )}

        {/* Likes */}
        {pub.likes > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
            <Heart className="w-3 h-3 text-red-400 fill-red-400" />
            <span className="text-white text-[10px] font-black">{pub.likes >= 1000 ? (pub.likes / 1000).toFixed(1) + "k" : pub.likes}</span>
          </div>
        )}

        {/* Titre */}
        <div className="absolute bottom-2 right-2 left-10">
          <p className="text-white text-[10px] font-black truncate">{pub.title}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="px-2 pb-6">
      <div className="flex gap-2">
        <div className="flex-1">
          {col1.map(pub => <Card key={pub.id} pub={pub} />)}
        </div>
        <div className="flex-1 mt-4">
          {col2.map(pub => <Card key={pub.id} pub={pub} />)}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VueClient({ onClose, proEmail: proEmailProp, proPhone }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { startCall } = useCall() || {};
  // Priorité : prop → state de navigation → email user courant
  const proEmailFromState = location?.state?.proEmail || location?.state?.email;
  // Priorité stricte : prop → state de navigation — JAMAIS user courant (évite d'ouvrir son propre profil)
  const targetEmail = proEmailProp || proEmailFromState || null;
  const isOwnProfile = user?.email === targetEmail;

  // Cache « vue client » par salon : affichage direct des dernières données
  // connues dès la première peinture, sans page « Chargement... » intermédiaire.
  // Le cache est réécrit en arrière-plan à chaque chargement frais.
  const [vueCacheInitial] = useState(() => {
    if (!targetEmail) return {};
    try { return JSON.parse(localStorage.getItem(`vueclient_cache_${targetEmail}`) || "null") || {}; }
    catch { return {}; }
  });
  const [activeTab, setActiveTab] = useState("profil");
  const [subscribed, setSubscribed] = useState(() => {
    try {
      const key = `bb_subscribed_${proEmailProp || ""}`;
      return localStorage.getItem(key) === "1";
    } catch { return false; }
  });
  const [publications, setPublications] = useState(vueCacheInitial.publications || []);
  const [services, setServices] = useState(vueCacheInitial.services || []);
  const [bundles, setBundles] = useState(vueCacheInitial.bundles || []);
  const [catalogueOptions, setCatalogueOptions] = useState(vueCacheInitial.catalogueOptions || []);
  const [proInfo, setProInfo] = useState(() => {
    let p = vueCacheInitial.proInfo || null;
    // Pour son propre profil, le cache pro (dernières modifications) prime,
    // avec la même règle de fusion que le chargement frais (non-vide gagne).
    if (isOwnProfile) {
      try {
        const cached = JSON.parse(localStorage.getItem('pro_profile_cache') || 'null');
        if (cached && (!cached.user_email || cached.user_email === targetEmail)) {
          p = {
            ...(p || {}), user_email: targetEmail, id: p?.id || 'local',
            avatar_url: cached.avatar_url || p?.avatar_url,
            cover_url: cached.cover_url || p?.cover_url,
            salon_name: cached.salon_name || p?.salon_name,
            bio: cached.bio || p?.bio, city: cached.city || p?.city,
            phone: cached.phone || p?.phone, address: cached.address || p?.address,
          };
        }
      } catch {}
    }
    return p;
  });
  const [proInfoId, setProInfoId] = useState(vueCacheInitial.proInfo?.id || null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showCall] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [stats, setStats] = useState(vueCacheInitial.stats || { abonnes: 0, services: 0, avis: 0 });
  const [demandeInfo, setDemandeInfo] = useState(vueCacheInitial.demandeInfo || null);
  const [selectedPlat, setSelectedPlat] = useState(null);
  const [avis, setAvis] = useState(vueCacheInitial.avis || []);

  // (targetEmail et isOwnProfile sont définis plus haut, avant les states)

  const proAddress = proInfo?.address || proInfo?.city || null;
  const profileUrl = window.location.origin + "/profil-pro";

  // Horaires effectifs : section Horaires & Congés (ouverture/horaires),
  // sinon repli sur les horaires du parcours Devenir Pro (demande approuvée).
  // getEffectiveOpening ignore les objets vides : l'affichage est toujours
  // synchronisé avec la section Horaires & Congés.
  // applyNightMode : si le Mode Nuit est actif, les horaires effectifs sont
  // 09:00 → 07:00 (lendemain) pour les jours ouverts, sans toucher aux horaires de jour.
  const ouvertureEff = applyNightMode(
    getEffectiveOpening(proInfo, demandeInfo),
    proInfo?.travail_nuit || demandeInfo?.travail_nuit
  );

  useEffect(() => {
    if (!targetEmail) return;
    const isOwnProfile = targetEmail === user?.email;
    const getCached = () => {
      try { return JSON.parse(localStorage.getItem('pro_profile_cache') || 'null'); } catch { return null; }
    };
    const fetchProfil = async () => {
      const { data: profiles, error } = await supabase.from('ProfilPro').select('id, user_email, salon_name, phone, address, city, bio, avatar_url, cover_url, status, galerie_urls, followers, ouverture, horaires, travail_nuit, rating, reviews_count, se_deplace, specialites, commodites, latitude, longitude, type_activite, postal_code, seats_count').eq('user_email', targetEmail).order('created_at', { ascending: false });
      if (error || !profiles || profiles.length === 0) return null;
      // Priority: 1) actif with images, 2) actif, 3) any with images, 4) latest
      const activeWithImages = profiles.find(p => p.status === 'actif' && (p.avatar_url || p.cover_url));
      const active = profiles.find(p => p.status === 'actif');
      const withImages = profiles.find(p => p.avatar_url || p.cover_url);
      return activeWithImages || active || withImages || profiles[0];
    };
    const applyCache = (p) => {
      if (!isOwnProfile) return p;
      const cached = getCached();
      if (!cached) return p;
      if (!p) return { id: 'local', user_email: targetEmail, ...cached };
      return { ...p, avatar_url: cached.avatar_url || p.avatar_url, cover_url: cached.cover_url || p.cover_url, salon_name: cached.salon_name || p.salon_name, bio: cached.bio || p.bio, city: cached.city || p.city, phone: cached.phone || p.phone, address: cached.address || p.address };
    };
    const fetchData = async () => {
      const [reels, profileRaw, svcs, avis, demandes, bundleData, catOpts] = await Promise.all([
        entities.Reel.filter({ author_email: targetEmail, status: "publie" }, "-created_at", 30).catch(() => []),
        fetchProfil(),
        entities.Service.filter({ pro_email: targetEmail, status: "actif" }, "-created_at", 50).catch(() => []),
        entities.Avis.filter({ cible_email: targetEmail, type: "client_to_pro" }, "-created_at", 100).catch(() => []),
        entities.DemandeProV2.filter({ user_email: targetEmail, statut: "approuvee" }, "-created_at", 1).catch(() => []),
        entities.ServiceBundle.filter({ pro_email: targetEmail, is_active: true }, "-created_at", 20).catch(() => []),
        supabase.from("CatalogueOption").select("*").eq("pro_email", targetEmail).order("usage_count", { ascending: false }).then(r => r.data || [], () => []),
      ]);
      setPublications(reels);
      setServices(svcs);
      setBundles(bundleData);
      setCatalogueOptions(catOpts);
      const profile = applyCache(profileRaw);
      if (profile) {
        setProInfo(profile);
        setProInfoId(profile.id);
        try { setSubscribed(localStorage.getItem(`bb_subscribed_${targetEmail}`) === "1"); } catch {}
      }
      if (demandes.length > 0) setDemandeInfo(demandes[0]);
      setAvis(avis);
      let followerCount = profile?.followers || 0;
      try {
        const { count } = await supabase.from('user_follow').select('*', { count: 'exact', head: true }).eq('followed_email', targetEmail);
        if (count !== null) followerCount = count;
      } catch (e) {}
      setStats({ abonnes: followerCount, services: svcs.length, avis: avis.length });
      // Persiste la vue client en cache (fusion : un chargement partiel
      // n'écrase jamais les sections déjà en cache).
      try {
        const key = `vueclient_cache_${targetEmail}`;
        let prev = {};
        try { prev = JSON.parse(localStorage.getItem(key) || 'null') || {}; } catch {}
        localStorage.setItem(key, JSON.stringify({
          ...prev,
          ...(profile ? { proInfo: profile } : {}),
          services: svcs,
          bundles: bundleData,
          catalogueOptions: catOpts,
          publications: reels,
          avis,
          ...(demandes.length > 0 ? { demandeInfo: demandes[0] } : {}),
          stats: { abonnes: followerCount, services: svcs.length, avis: avis.length },
        }));
      } catch {}
    };
    fetchData();
    const onUpdated = (e) => {
      const d = e.detail || {};
      if (d.avatar_url || d.cover_url) {
        setProInfo(prev => prev ? { ...prev, avatar_url: d.avatar_url || prev.avatar_url, cover_url: d.cover_url || prev.cover_url } : prev);
      }
      fetchData();
    };
    window.addEventListener('pro-profile-updated', onUpdated);
    return () => window.removeEventListener('pro-profile-updated', onUpdated);
  }, [targetEmail, user]);

  const handleClose = () => {
    if (onClose) onClose();
    else navigate(-1);
  };

  const handleToggleSubscribe = async () => {
    if (!user?.email || !targetEmail) return;
    const newSubscribed = !subscribed;
    setSubscribed(newSubscribed);
    try { localStorage.setItem(`bb_subscribed_${targetEmail}`, newSubscribed ? "1" : "0"); } catch {}
    const newCount = newSubscribed ? (stats.abonnes + 1) : Math.max(0, stats.abonnes - 1);
    setStats(s => ({ ...s, abonnes: newCount }));
    try {
      if (newSubscribed) {
        try {
          await supabase.from('user_follow').insert({
            follower_email: user.email,
            followed_email: targetEmail,
          });
        } catch (_) {}
      } else {
        try {
          await supabase.from('user_follow')
            .delete().eq('follower_email', user.email).eq('followed_email', targetEmail);
        } catch (_) {}
      }
      const { count: realCount } = await supabase.from('user_follow').select('*', { count: 'exact', head: true }).eq('followed_email', targetEmail);
      if (realCount !== null) {
        setStats(s => ({ ...s, abonnes: realCount }));
      }
    } catch (e) { console.warn('[Subscribe] error:', e); }
  };

  const handleUnsubscribe = () => {
    handleToggleSubscribe();
    setShowMoreMenu(false);
  };

  const handleReport = () => {
    setShowMoreMenu(false);
    setShowReport(true);
    setTimeout(() => setShowReport(false), 2500);
  };

  return (
    <div className="font-display min-h-full" style={{ background: getPageBg(theme) }}>

      {/* Share Sheet */}
      {showShareSheet && (
        <ShareSheet title={proInfo?.salon_name || "Profil BeautyBook"} url={profileUrl} onClose={() => setShowShareSheet(false)} />
      )}

      {/* More Menu backdrop tap-outside */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-[390]" onClick={() => setShowMoreMenu(false)} />
      )}

      {/* Toast signalement */}
      {showReport && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-gray-900 text-white text-[13px] font-black px-5 py-3 rounded-2xl shadow-xl">
          ✅ Signalement envoyé, merci
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative">
        <div className="relative h-56 overflow-hidden">
          <BeautyImage src={proInfo?.cover_url || BANNER_IMG} alt="banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: getBannerGradient(theme) }} />
        </div>

        {/* Top controls — theme-aware */}
        {(() => {
          const isDark = theme === "dark" || theme === "night";
          const btnBg = isDark ? "bg-gray-900/90 border border-gray-700" : "bg-white/95";
          const btnIcon = isDark ? "text-gray-200" : "text-gray-800";
          return (
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <button onClick={handleClose}
                className={`flex items-center gap-2 ${btnBg} rounded-full px-4 py-2 shadow-md active:scale-95 transition-all`}>
                <ArrowLeft className={`w-4 h-4 ${btnIcon}`} />
                <span className={`text-[12px] font-black ${btnIcon} uppercase tracking-widest`}>Quitter</span>
              </button>
              <button onClick={() => setShowShareSheet(true)}
                className={`w-10 h-10 ${btnBg} rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all`}>
                <Share2 className={`w-4 h-4 ${btnIcon}`} />
              </button>
            </div>
          );
        })()}

        {/* Profile photo */}
        <div className="absolute -bottom-12 left-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-100">
              <BeautyImage src={proInfo?.avatar_url || PROFILE_IMG} alt="profil" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-1 right-1 w-6 h-6 bg-primary rounded-full border-2 border-white flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-white fill-white" />
            </div>
          </div>
        </div>

        {/* Subscribe + more — theme-aware */}
        {(() => {
          const isDark = theme === "dark" || theme === "night";
          const subscribedBg = isDark ? "bg-gray-800/90 text-gray-200 border border-gray-700" : "bg-gray-200 text-gray-700";
          const unsubscribedBg = "bg-primary text-white shadow-lg shadow-primary/30";
          const moreBg = isDark ? "bg-gray-900/90 border border-gray-700" : "bg-white rounded-xl border border-gray-200";
          const moreIcon = isDark ? "text-gray-200" : "text-gray-600";
          return (
            <div className="absolute -bottom-5 right-4 flex items-center gap-2">
              <button onClick={handleToggleSubscribe}
                className={`px-6 py-3 rounded-2xl font-black text-[14px] transition-all active:scale-95 ${subscribed ? subscribedBg : unsubscribedBg}`}>
                {subscribed ? "Abonné ✓" : "S'abonner"}
              </button>
              <div className="relative">
                <button onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`w-10 h-10 ${moreBg} rounded-xl flex items-center justify-center shadow-sm active:scale-95`}>
                  <MoreVertical className={`w-4 h-4 ${moreIcon}`} />
                </button>
                {showMoreMenu && (
                  <MoreMenu
                    subscribed={subscribed}
                    onUnsubscribe={handleUnsubscribe}
                    onReport={handleReport}
                    onClose={() => setShowMoreMenu(false)}
                  />
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Identity */}
      <div className="px-4 pt-16 pb-4">
        <h1 className="text-[20px] font-black text-gray-900 leading-tight truncate">{proInfo?.salon_name || user?.full_name || "Chargement..."}</h1>


        {/* Badges infos sous le nom */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {/* Note étoiles */}
          {proInfo?.rating > 0 ? (
            <span className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 text-[10px] font-black px-2.5 py-1 rounded-full">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-gray-800">{proInfo.rating}</span>
              <span className="text-gray-400">({proInfo.reviews_count || 0})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-gray-100 text-gray-400 text-[10px] font-black px-2.5 py-1 rounded-full">
              <Star className="w-3 h-3 text-gray-300" />
              <span>Pas de notation</span>
            </span>
          )}
          {/* Ville + Code postal */}
          {proInfo?.city && (
            <button
              onClick={() => proAddress && window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(proAddress)}`, "_blank")}
              className="flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-black px-2.5 py-1 rounded-full active:scale-95 transition-all whitespace-nowrap"
            >
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              {proInfo.city}{proInfo.postal_code ? `, ${String(proInfo.postal_code).slice(0, 2)}` : ""}
            </button>
          )}
          {/* Type d'activité complet */}
          {(proInfo?.type_activite || demandeInfo?.type_activite) && (
            <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-orange-200">
              {proInfo?.type_activite === "Salon" ? "Salon Professionnel"
               : proInfo?.type_activite === "Particulier" ? "Particulier"
               : proInfo?.type_activite || demandeInfo?.type_activite}
            </span>
          )}
          {/* Ouvert / Fermé */}
          {(() => {
            const open = isOpenNow(ouvertureEff);
            if (open === null) return null;
            return open
              ? <span className="bg-teal-50 text-teal-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-teal-200">● Ouvert</span>
              : <span className="bg-red-50 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-full border border-red-200">● Fermé</span>;
          })()}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            {
              icon: PhoneCall, label: "APPELER", color: "text-orange-500", bg: "bg-orange-50",
              action: () => {
                if (startCall) {
                  startCall({
                    targetEmail: targetEmail,
                    targetName: proInfo?.salon_name || targetEmail,
                    targetAvatar: proInfo?.avatar_url || null,
                  });
                }
              }
            },
            {
              icon: MessageCircle, label: "MESSAGE", color: "text-blue-500", bg: "bg-blue-50",
              action: () => navigate(`/messages?to=${targetEmail}&name=${encodeURIComponent(proInfo?.salon_name || targetEmail)}`)
            },
            { icon: Calendar, label: "RÉSERVER", color: "text-green-500", bg: "bg-green-50", action: () => navigate("/reservation", { state: { proEmail: targetEmail, services: services.length > 0 ? [services[0]] : [] } }) },
            { icon: MapPin, label: "CARTE", color: "text-violet-500", bg: "bg-violet-50", action: () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(proAddress)}`, "_blank") },
          ].map(({ icon: Icon, label, color, bg, action }) => (
            <button key={label} onClick={action} className="flex flex-col items-center gap-1.5 active:scale-95 transition-all">
              <div className={`w-14 h-12 ${bg} rounded-2xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{label}</span>
            </button>
          ))}
        </div>

        {/* Réseaux sociaux */}
        {(proInfo?.instagram || proInfo?.facebook || proInfo?.website) && (
          <div className="flex gap-3 mt-4 justify-center">
            {proInfo.instagram && (
              <a href={`https://instagram.com/${proInfo.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-all">
                <div className="w-14 h-12 bg-pink-50 rounded-2xl flex items-center justify-center">
                  <Instagram className="w-5 h-5 text-pink-500" />
                </div>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">INSTAGRAM</span>
              </a>
            )}
            {proInfo.facebook && (
              <a href={`https://facebook.com/${proInfo.facebook.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-all">
                <div className="w-14 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Facebook className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">FACEBOOK</span>
              </a>
            )}
            {proInfo.website && (
              <a href={proInfo.website.startsWith('http') ? proInfo.website : `https://${proInfo.website}`} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-all">
                <div className="w-14 h-12 bg-violet-50 rounded-2xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-violet-500" />
                </div>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">SITE WEB</span>
              </a>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-0 mt-4 border-t border-gray-100 pt-4">
          {[
            { value: stats.abonnes, label: "ABONNÉS" },
            { value: stats.services, label: "SERVICES" },
            { value: stats.avis, label: "AVIS" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-[22px] font-black text-gray-900">{value}</span>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 border-b-2 transition-all ${activeTab === id ? "border-primary" : "border-transparent"}`}>
              <Icon className={`w-4 h-4 ${activeTab === id ? "text-primary" : "text-gray-400"}`} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${activeTab === id ? "text-primary" : "text-gray-400"}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB: PROFIL */}
      {activeTab === "profil" && (
        <div className="pb-6 bg-white">
          <div className="px-4 pt-4 pb-4 flex items-center gap-3 border-b border-gray-100">
            <div className="w-14 h-14 bg-[#1a2535] rounded-2xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-[16px] font-black text-gray-900">{proInfo?.salon_name || user?.full_name || "Institut"}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{proInfo?.type_activite || demandeInfo?.type_activite || "Professionnel"}</p>
            </div>
          </div>
          <div className="px-4 pt-4 pb-4 border-b border-gray-100">
            {proInfo?.bio ? (
              <p className="text-[13px] text-gray-600 font-medium leading-relaxed">
                {proInfo.bio}
              </p>
            ) : isOwnProfile ? (
              <p className="text-[13px] text-gray-400 font-medium leading-relaxed italic">
                Ajoutez votre bio dans « Modifier profil pro » pour présenter votre salon.
              </p>
            ) : null}
          </div>
          {/* ── Visite Virtuelle 3D réelle depuis VisiteVirtuelle entity ── */}
          <VisiteVirtuelle3D proEmail={targetEmail} />
          {/* ── Galerie Photos — EN HAUT des infos pratiques ── */}
          <GalerieSection gallery={proInfo?.galerie_urls} />

          <div className="px-4 pt-4 space-y-4">
            <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Infos Pratiques</p>

            {/* Carte Adresse */}
            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(proAddress)}`, "_blank")}
                className="flex items-start gap-3 p-4 w-full text-left active:bg-orange-50 transition-colors">
                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-primary" /></div>
                <div className="flex-1">
                  <p className="text-[13px] font-black text-gray-800">Adresse du Salon</p>
                  <p className="text-[12px] text-gray-500 font-medium mt-0.5">
                    {[proInfo?.address, proInfo?.city, proInfo?.postal_code]
                      .filter(Boolean)
                      .filter((p, i, arr) => i === 0 || !arr[0].toLowerCase().includes(p.toLowerCase()))
                      .join(", ") || "Adresse non renseignée"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-primary mt-1 shrink-0" />
              </button>
            </div>

            {/* Carte Apple Maps — emplacement du salon */}
            <SalonMap
              lat={proInfo?.latitude}
              lng={proInfo?.longitude}
              address={proInfo?.address}
              city={proInfo?.city}
              postalCode={proInfo?.postal_code}
              name={proInfo?.salon_name}
            />

            {/* Carte Horaires d'ouverture redesignée */}
            <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-gray-900 leading-tight">Horaires d'ouverture</p>
                    <p className="text-[10px] font-bold text-gray-400">Planning hebdomadaire</p>
                  </div>
                </div>
                {(() => {
                  const st = getOpeningStatus(ouvertureEff);
                  if (!st) {
                    return (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-gray-100 text-gray-500 border-gray-200">
                        ● Non renseigné
                      </span>
                    );
                  }
                  return (
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${st.color}`}>
                      ● {st.label}
                    </span>
                  );
                })()}
              </div>

              <div className="space-y-2.5">
                {(() => {
                  const formatted = formatOpeningHours(ouvertureEff);
                  if (formatted.length === 0) {
                    return (
                      <p className="text-[12px] text-gray-400 font-medium text-center py-4">
                        Le professionnel n'a pas encore renseigné ses horaires
                      </p>
                    );
                  }
                  return formatted.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-2.5 rounded-2xl transition-all ${item.isToday ? "bg-orange-50/70 border border-orange-100" : "bg-gray-50/60"}`}>
                    <div className="flex items-center gap-2">
                      {item.isToday && <span className="w-2 h-2 rounded-full bg-primary" />}
                      <span className={`text-[13px] font-black ${item.isToday ? "text-primary" : !item.open ? "text-red-400" : "text-gray-800"}`}>
                        {item.label}
                      </span>
                      {item.isToday && <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase">Aujourd'hui</span>}
                      {item.overnight && item.open && (
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full uppercase">🌙 Nuit</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-[13px] font-bold ${!item.open ? "text-red-400" : "text-gray-900"}`}>
                        {item.hours}
                      </span>
                      {item.overnight && item.open && (
                        <p className="text-[10px] text-indigo-400 font-medium">jusqu'au lendemain</p>
                      )}
                      {item.pause && (
                        <p className="text-[10px] text-gray-400 font-medium">Pause {item.pause}</p>
                      )}
                    </div>
                  </div>
                  ));
                })()}
              </div>

              {ouvertureEff?.conges?.length > 0 && (
                <div className="pt-1">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">Congés programmés</p>
                      {ouvertureEff.conges.slice(0, 2).map((c, i) => (
                        <p key={i} className="text-[11px] text-amber-700 font-medium truncate">
                          {c.label || "Fermeture"} : {c.start} au {c.end}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Spécialités avec icônes Lucide ── */}
          {proInfo?.specialites?.length > 0 && (
            <div className="px-4 mt-5">
              <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Nos Spécialités</p>
              <div className="flex flex-wrap gap-2">
                {proInfo.specialites.map(s => {
                  const cfg = SPECIALITE_ICONS[s] || SPECIALITE_ICONS["default"];
                  const IconComp = cfg.icon;
                  return (
                    <div key={s} className={`${cfg.bg} border border-gray-100 rounded-2xl px-3 py-2.5 flex items-center gap-2 shadow-sm`}>
                      <IconComp className={`w-4 h-4 ${cfg.color} shrink-0`} />
                      <span className="text-[12px] font-bold text-gray-800">{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Commodités avec icônes Lucide ── */}
          <div className="px-4 mt-5">
            <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Commodités & Équipements</p>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const list = (proInfo?.commodites?.length > 0 ? proInfo.commodites : demandeInfo?.commodites?.length > 0 ? demandeInfo.commodites : ["Wifi", "Paiement CB", "Climatisation", "Café offert", "Salle d'attente"]);
                return list.map(c => {
                  const cfg = COMMODITE_ICONS[c];
                  const IconComp = cfg?.icon || CheckCircle2;
                  const color = cfg?.color || "text-primary";
                  const bg = cfg?.bg || "bg-orange-50";
                  return (
                    <div key={c} className={`${bg} border border-gray-100 rounded-2xl px-3.5 py-2.5 flex items-center gap-2 shadow-sm active:scale-95 transition-transform`}>
                      <IconComp className={`w-4 h-4 ${color} shrink-0`} />
                      <span className="text-[12px] font-bold text-gray-800">{c}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Travail à domicile / nuit */}
          {(proInfo?.se_deplace || proInfo?.travail_nuit || demandeInfo?.se_deplace || demandeInfo?.travail_nuit) && (
            <div className="px-4 mt-4">
              <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Modes de Travail</p>
              <div className="flex flex-wrap gap-2">
                {(proInfo?.se_deplace || demandeInfo?.se_deplace) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                    <Home className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-[12px] font-black text-blue-700">Déplacement à domicile</span>
                  </div>
                )}
                {(proInfo?.travail_nuit || demandeInfo?.travail_nuit) && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-[12px] font-black text-indigo-700">Travail de nuit</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Menu Restaurant */}
          {proInfo?.menu_restaurant?.length > 0 && (
            <div className="px-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Menu / Carte</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const q = encodeURIComponent(proInfo?.salon_name || proAddress);
                      const loc = proInfo?.address ? encodeURIComponent(proInfo.address) : "";
                      window.open(`https://www.ubereats.com/search?q=${q}&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMiR7bG9jfSUyMiU3RA==`, "_blank");
                    }}
                    className="flex items-center gap-1.5 bg-black text-white text-[10px] font-black px-3 py-1.5 rounded-full active:scale-95">
                    🛵 Uber Eats
                  </button>
                  <button
                    onClick={() => {
                      const q = encodeURIComponent(proInfo?.salon_name || proAddress);
                      window.open(`https://deliveroo.fr/fr/restaurants/search?q=${q}`, "_blank");
                    }}
                    className="flex items-center gap-1.5 bg-[#00CCBC] text-white text-[10px] font-black px-3 py-1.5 rounded-full active:scale-95">
                    🦘 Deliveroo
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {proInfo.menu_restaurant.map((item, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex cursor-pointer active:scale-[0.99] transition-all" onClick={() => setSelectedPlat(item)}>
                    {item.image_url ? (
                      <div className="w-24 h-24 shrink-0">
                        <BeautyImage src={item.image_url} alt={item.nom} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 shrink-0 bg-gray-100 flex items-center justify-center">
                        <span className="text-[28px]">🍽️</span>
                      </div>
                    )}
                    <div className="flex-1 p-3 flex flex-col justify-center">
                      <p className="text-[14px] font-black text-gray-800">{item.nom}</p>
                      {item.description && <p className="text-[11px] text-gray-400 font-medium mt-0.5 line-clamp-2">{item.description}</p>}
                      {item.prix > 0 && <span className="text-[15px] font-black text-primary mt-1">{item.prix}€</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Menu Bar & Boissons */}
          {proInfo?.menu_bar?.length > 0 && (
            <div className="px-4 mt-4">
              <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Menu Bar & Boissons</p>
              <div className="space-y-2">
                {proInfo.menu_bar.map((item, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex cursor-pointer active:scale-[0.99] transition-all" onClick={() => setSelectedPlat(item)}>
                    {item.image_url ? (
                      <div className="w-24 h-24 shrink-0">
                        <BeautyImage src={item.image_url} alt={item.nom} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 shrink-0 bg-gray-100 flex items-center justify-center">
                        <span className="text-[28px]">🍷</span>
                      </div>
                    )}
                    <div className="flex-1 p-3 flex flex-col justify-center">
                      <p className="text-[14px] font-black text-gray-800">{item.nom}</p>
                      {item.description && <p className="text-[11px] text-gray-400 font-medium mt-0.5 line-clamp-2">{item.description}</p>}
                      {item.prix > 0 && <span className="text-[15px] font-black text-primary mt-1">{item.prix}€</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services Supplémentaires — synchronisé avec Catalogue d'options */}
          {catalogueOptions.length > 0 && (
            <div className="px-4 mt-4">
              <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Services Supplémentaires</p>
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {catalogueOptions.map((opt, i) => (
                  <div key={opt.id} className={`flex items-center justify-between gap-3 p-4 ${i < catalogueOptions.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-gray-800 truncate">{opt.name}</p>
                      {opt.category && <p className="text-[10px] text-gray-400">{opt.category}</p>}
                    </div>
                    {opt.price > 0 && <span className="text-[13px] font-black text-primary">{opt.price}€</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VTC & Taxis — dernière section */}
          <div className="px-4 mt-4 pb-4">
            <VTCSection
              destinationLat={proInfo?.latitude}
              destinationLng={proInfo?.longitude}
              destinationAddress={proInfo?.address || proAddress}
            />
          </div>
        </div>
      )}

      {/* TAB: SERVICES — Réels depuis la DB */}
      {activeTab === "services" && (
        <div className="bg-[#f5f5f5] pb-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 pt-4 pb-3">
            {services.length} prestation{services.length !== 1 ? "s" : ""}
          </p>
          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Scissors className="w-12 h-12 text-gray-200" />
              <p className="text-[13px] font-black text-gray-400">Aucun service publié</p>
            </div>
          ) : (
            <div className="px-4 space-y-4">
              {services.map((s) => (
                <div key={s.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                  <ServiceSlider
                    service={s}
                    onCardClick={() => navigate(`/service/${s.id}`, { state: { service: s, id: s.id } })}
                  />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[18px] font-black text-gray-900">{s.title}</h3>
                      <span className="text-[22px] font-black text-primary">{s.price}€</span>
                    </div>
                    {/* Notation + Durée + Localisation sur une ligne */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {proInfo?.rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-[12px] font-black text-gray-800">{proInfo.rating}</span>
                          <span className="text-[10px] text-gray-400 font-medium">({proInfo.reviews_count || 0})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-gray-300" />
                          <span className="text-[12px] font-black text-gray-400">Pas encore noté</span>
                        </div>
                      )}
                      <span className="text-gray-300 font-light text-[11px]">|</span>
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">⏱ {s.duration_min} MIN</span>
                      {proInfo?.city && (
                        <>
                          <span className="text-gray-300 font-light text-[11px]">|</span>
                          <span className="flex items-center gap-1 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                            <MapPin className="w-3 h-3" />{proInfo.city}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Style associé & Filtre IA */}
                    <div className="flex items-center gap-2 mb-3">
                      {s.style && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            entities.Style.filter({ title: s.style, status: "publie" }, "-created_at", 1)
                              .then(results => {
                                if (results[0]) navigate(`/style/${results[0].id}`, { state: { id: results[0].id, title: results[0].title, cover: results[0].image_url || (results[0].images && results[0].images[0]), images: results[0].images || [], category: results[0].category, description: results[0].description, likes: results[0].likes } });
                              }).catch(() => {});
                          }}
                          className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1.5 active:scale-95 transition-all"
                        >
                          <Palette className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] font-black text-primary">Style associé</span>
                        </button>
                      )}
                      {s.image_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/scan-capillaire");
                          }}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-full px-3 py-1.5 active:scale-95 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="text-[11px] font-black text-purple-600">Filtre IA</span>
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/service/${s.id}`, { state: { id: s.id } })}
                        className="flex-1 bg-gray-900 text-white font-black text-[13px] uppercase tracking-widest py-3 rounded-2xl active:scale-95 transition-all">
                        Voir le détail
                      </button>
                      <button
                        onClick={() => navigate(`/messages?to=${targetEmail}&name=${encodeURIComponent(proInfo?.salon_name || targetEmail)}&service_id=${s.id}&service=${encodeURIComponent(s.title)}&service_price=${s.price}&service_img=${encodeURIComponent(s.image_url || "")}&service_duration=${s.duration_min}`)}
                        className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center active:scale-95 transition-all border border-blue-100">
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bundles section */}
          {bundles.length > 0 && (
            <div className="px-4 mt-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                {bundles.length} bundle{bundles.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-3">
                {bundles.map((b) => {
                  const includedSvcs = services.filter(s => b.service_ids?.includes(s.id));
                  const regularTotal = includedSvcs.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
                  return (
                    <div key={b.id} className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl overflow-hidden border border-pink-100 shadow-sm">
                      {b.image_url && <BeautyImage src={b.image_url} alt="" className="w-full h-36 object-cover" />}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-pink-500" />
                          <h3 className="text-[16px] font-black text-gray-900">{b.name}</h3>
                          {b.discount_percent > 0 && (
                            <span className="bg-green-100 text-green-700 text-[9px] font-black px-1.5 py-0.5 rounded-full">-{b.discount_percent}%</span>
                          )}
                        </div>
                        {b.description && <p className="text-[12px] text-gray-600 mb-3">{b.description}</p>}
                        <div className="flex items-center gap-2 mb-3">
                          {includedSvcs.map(s => (
                            <span key={s.id} className="bg-white border border-pink-200 rounded-full px-2 py-0.5 text-[10px] font-bold text-pink-600 truncate max-w-[120px]">
                              {s.title || s.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {regularTotal > 0 && <span className="text-[13px] text-gray-400 line-through">{regularTotal}€</span>}
                            <span className="text-[22px] font-black text-[#E8732A]">{b.bundle_price}€</span>
                          </div>
                          <button onClick={() => {
                            const bundleServices = includedSvcs.map(s => ({ ...s, persons: 1 }));
                            navigate(`/reservation?pro=${targetEmail}&bundle=${b.id}`, { state: { services: bundleServices, bundle: b } });
                          }} className="bg-[#E8732A] text-white px-5 py-2.5 rounded-2xl text-[12px] font-black active:scale-95 transition-transform">
                            Réserver
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="h-24" />
        </div>
      )}
      {activeTab === "pub" && (
        <div className="bg-white pb-6">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {publications.length} publication{publications.length !== 1 ? "s" : ""}
            </p>
          </div>
          {publications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Image className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-[13px] font-black text-gray-400">Aucune publication pour l'instant</p>
            </div>
          ) : (
            <MosaicGrid publications={publications} navigate={navigate} />
          )}
        </div>
      )}

      {/* TAB: AVIS */}
      {activeTab === "avis" && (
        <div className="bg-white pb-6">
          <div className="px-4 pt-4 flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[18px] font-black text-gray-900">Avis Clients</h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{avis.length} avis · Expériences réelles</p>
            </div>
            {avis.length > 0 && (() => {
              const avg = Math.round((avis.reduce((s, a) => s + (a.note || 0), 0) / avis.length) * 10) / 10;
              return (
                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-full px-4 py-2">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-[16px] font-black text-gray-900">{avg}</span>
                </div>
              );
            })()}
          </div>
          {avis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Star className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest">Aucun avis pour le moment</p>
            </div>
          ) : (
            <div className="px-4 space-y-3">
              {avis.map((a) => (
                <div key={a.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-black text-primary">{(a.auteur_nom || "?")[0]}</span>
                    </div>
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
          )}
        </div>
      )}

      {/* Modal Commande Restaurant */}
      {selectedPlat && (
        <CommandeModal
          plat={selectedPlat}
          proEmail={targetEmail}
          proName={proInfo?.salon_name}
          onClose={() => setSelectedPlat(null)}
        />
      )}

      {/* Widget « Discuter avec Maria » — visiteurs uniquement (pas le/la propriétaire) */}
      {!isOwnProfile && targetEmail && (
        <AssistantChatWidget proEmail={targetEmail} salonName={proInfo?.salon_name || ""} />
      )}

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setShowMenuModal(false)}>
          <div className="bg-white rounded-t-3xl w-full px-5 pb-10 pt-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="text-[18px] font-black text-gray-900 mb-1">Menu & Restauration</h3>
            <p className="text-[12px] text-gray-400 font-medium mb-5">Commandez directement ou consultez notre carte</p>
            <div className="space-y-3">
              <button onClick={() => { setShowMenuModal(false); window.open(`https://www.ubereats.com/search?q=${encodeURIComponent(proAddress)}`, "_blank"); }}
                className="w-full flex items-center gap-4 bg-black rounded-2xl p-4 active:scale-[0.98] transition-all">
                <div className="w-12 h-12 bg-[#06C167] rounded-xl flex items-center justify-center shrink-0"><span className="text-white text-[22px]">🛵</span></div>
                <div className="flex-1 text-left"><p className="text-white text-[15px] font-black">Uber Eats</p><p className="text-white/50 text-[11px] font-medium">Commande en ligne avec livraison</p></div>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </button>
              <button onClick={() => { setShowMenuModal(false); window.open(`https://www.google.com/maps/search/${encodeURIComponent("restaurant " + proAddress)}`, "_blank"); }}
                className="w-full flex items-center gap-4 bg-gray-100 rounded-2xl p-4 active:scale-[0.98] transition-all">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm"><span className="text-[22px]">🗺️</span></div>
                <div className="flex-1 text-left"><p className="text-gray-900 text-[15px] font-black">Voir sur Google Maps</p><p className="text-gray-400 text-[11px] font-medium">Restaurants à proximité</p></div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}