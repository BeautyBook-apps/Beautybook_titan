import BeautyImage from '@/components/ui/BeautyImage';
import BookingConfirmation from '@/components/maria/BookingConfirmation';
import ActionConfirmation from '@/components/maria/ActionConfirmation';
import apiClient from '@/lib/apiClient';
import { useState, useRef, useEffect } from "react";
import {
  X, Plus, Sparkles, Search,
  Wand2, History, Bot, Send, Mic,
  Scissors, Lightbulb, Heart, Clock, Star, Paperclip,
  FileText, Volume2, CheckCircle, MessageSquare, Calendar, ExternalLink,
  Instagram, Facebook, Globe, TrendingUp
} from "lucide-react";
import { entities, uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import FiltreAIModal from "@/components/modals/FiltreAIModal";
import InlineVoice from "@/components/maria/InlineVoice";
import MariaMessage from "@/components/maria/MariaMessage";
import ServiceFormCard from "@/components/maria/ServiceFormCard";
import { NavigateCard, SearchProductsCard, OpenProFormCard } from "@/components/maria/ActionCards";
import RoutineSummaryCard from "@/components/maria/RoutineSummaryCard";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useIsPro } from "@/hooks/useIsPro";
import { useVoiceAgent } from "@/lib/VoiceAgentContext";
import { useAuth } from "@/lib/AuthContext";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import AuthModal from "@/components/ui/AuthModal";

const SCAN_IMG = "https://images.unsplash.com/photo-1620331311520-246422fd82f9?q=80&w=400";
const STYLE_IMG = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=400";

// ─── Skeleton affiché pendant la détection du type de profil ─────────────────
// Évite tout flash : ni la version cliente ni la version pro ne s'affichent
// avant que le profil soit connu.
function MariaProfileSkeleton({ isDark }) {
  const box = isDark ? "bg-gray-800" : "bg-gray-100";
  return (
    <div className="px-4 pt-4 animate-pulse" aria-hidden="true">
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-44 rounded-3xl ${box}`} />
        ))}
      </div>
      <div className={`h-7 w-3/4 rounded-xl mx-auto mb-3 ${box}`} />
      <div className={`h-4 w-1/2 rounded-lg mx-auto mb-6 ${box}`} />
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-14 rounded-2xl ${box}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Side Drawer ──────────────────────────────────────────────────────────────
function SideDrawer({ open, onClose, onNewChat, recentChats, savedSimulations, onOpenSimulator, onScanCapillaire, onStylisteIA, isPro }) {  const navigate = useNavigate();
  return (
    <>
      {open && <div className="absolute inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />}
      <div className={`absolute inset-y-0 left-0 w-[85%] bg-white z-50 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <h2 className="text-[20px] font-black text-gray-900">Maria AI</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 mb-2">
          <button
            onClick={() => { onNewChat(); onClose(); }}
            className="w-full flex items-center gap-3 bg-orange-50 rounded-2xl px-4 py-3 active:scale-[0.98] transition-all"
          >
            <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[16px] font-black text-primary">Nouveau Chat</span>
          </button>
        </div>
        <div className="px-4 space-y-1 mb-2">
          {isPro ? (
            <>
              {/* AI Scaling Business + Annonces en dessous, relié par un fil perpendiculaire */}
              <div>
                <button
                  onClick={() => { navigate("/ai-scaling-business"); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-black text-gray-800">AI Scaling Business</p>
                    <p className="text-[11px] text-gray-400 font-medium">Pousse ton business avec l'IA</p>
                  </div>
                </button>
                {/* Fil perpendiculaire */}
                <div className="flex justify-end pr-12">
                  <div className="w-[2px] h-[12px] bg-orange-400" />
                </div>
                {/* Bouton Annonces fin, décalé vers la droite */}
                <div className="flex justify-end pr-3">
                  <button
                    onClick={() => { navigate("/annonces"); onClose(); }}
                    className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/30 active:scale-95 transition-all"
                    title="Annonces de recrutement"
                  >
                    <Paperclip className="w-3 h-3 -rotate-45" />
                    <span className="text-[10px] font-black whitespace-nowrap">Annonces</span>
                  </button>
                </div>
              </div>
              {[
                { icon: Bot, label: "Receptionniste IA", desc: "Accueil & gestion de salon", action: "receptionniste" },
                { icon: Globe, label: "AI Social Media", desc: "Gère tes réseaux sociaux avec IA", action: "social" },
              ].map(({ icon: Icon, label, desc, action }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (action === "receptionniste") { navigate("/receptionniste-ia"); onClose(); }
                    if (action === "social") { navigate("/social-media"); onClose(); }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-black text-gray-800">{label}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{desc}</p>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <>
              {[
                { icon: Wand2, label: "AI Hairstyle Changer", desc: "Simule une coiffure sur ta photo", action: "simulator", tour: "maria-simulator" },
                { icon: Scissors, label: "Scan Capillaire", desc: "Analyse ton cuir chevelu avec IA", action: "scan", tour: "maria-scan" },
                { icon: Sparkles, label: "Styliste IA", desc: "Trouve le look parfait pour toi", action: "styliste", tour: "maria-styliste" },
              ].map(({ icon: Icon, label, desc, action, tour }) => (
                <button
                  key={label}
                  data-tour={tour}
                  onClick={() => {
                    if (action === "simulator") { onOpenSimulator(); onClose(); }
                    if (action === "scan") { onScanCapillaire(); onClose(); }
                    if (action === "styliste") { onStylisteIA(); onClose(); }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-black text-gray-800">{label}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{desc}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input placeholder="Rechercher un chat..." className="flex-1 bg-transparent text-[13px] text-gray-600 outline-none placeholder:text-gray-400 font-medium" />
          </div>
        </div>
        <div className="px-4 flex-1 overflow-y-auto">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Récents</p>
          {recentChats.length === 0 ? (
            <p className="text-[13px] text-gray-400 font-medium text-center py-6">Aucun historique</p>
          ) : (
            <div className="space-y-1">
              {recentChats.map((chat, i) => (
                <button key={i} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-[13px] font-medium text-gray-700 truncate">{chat}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── File Preview ─────────────────────────────────────────────────────────────
function FilePreview({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 py-2">
      {files.map((f, i) => (
        <div key={i} className="relative shrink-0">
          {f.type.startsWith("image/") ? (
            <BeautyImage src={f.preview} alt={f.name} className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
          ) : (
            <div className="w-14 h-14 bg-gray-100 rounded-xl flex flex-col items-center justify-center border border-gray-200">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-[7px] text-gray-500 font-bold mt-0.5 truncate max-w-[48px] px-1 text-center">{f.name.split(".").pop()?.toUpperCase()}</span>
            </div>
          )}
          <button onClick={() => onRemove(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center shadow">
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Booking Summary Card ─────────────────────────────────────────────────────
function BookingSummaryCard({ data }) {
  const navigate = useNavigate();
  const rows = [
    { label: "Prestation", value: data.service || data.service_name },
    { label: "Professionnel", value: data.pro_name || data.professional || data.salon_name },
    { label: "Date", value: data.date },
    { label: "Heure", value: data.time || data.time_slot },
    { label: "Personnes", value: data.persons > 1 ? `${data.persons} personnes` : null },
    { label: "Lieu", value: data.salon_address || data.address || data.salon_name },
    { label: "Durée", value: data.duration_min ? `${data.duration_min} min` : null },
    { label: "Prix estimé", value: data.price || (data.total_price ? `${data.total_price}€` : null) },
  ].filter(r => r.value);

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-green-600" />
        <span className="text-[12px] font-black text-green-700 uppercase tracking-widest">Récapitulatif réservation</span>
      </div>
      <div className="space-y-1.5 mb-3">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-2">
            <span className="text-[12px] text-gray-500 font-medium shrink-0">{label}</span>
            <span className="text-[12px] font-black text-gray-900 text-right">{value}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          navigate("/reservation", {
            state: {
              pro_email: data.pro_email,
              prefill: {
                service: data.service,
                date: data.date,
                time: data.time,
                persons: data.persons || 1,
              }
            }
          });
        }}
        className="w-full bg-green-600 text-white text-[11px] font-black uppercase tracking-widest py-2.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Finaliser & Payer →
      </button>
    </div>
  );
}

// ─── Service Recap Card (réservation guidée) ─────────────────────────────────
function ServiceRecapCard({ data, onConfirm, onModify }) {
  const steps = [
    { icon: "💇", label: "Service", value: data.service_name },
    { icon: "📅", label: "Date", value: data.date },
    { icon: "🕐", label: "Heure", value: data.time_slot },
    { icon: "⏱️", label: "Durée", value: data.duration_min ? `${data.duration_min} min` : null },
    { icon: "💰", label: "Prix", value: data.price ? `${data.price}€` : null },
    { icon: "📍", label: "Lieu", value: data.salon_name || data.address },
    { icon: "👤", label: "Prestataire", value: data.pro_name },
  ].filter(s => s.value);

  return (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5 mt-2 shadow-lg shadow-orange-100/50">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-md shadow-orange-200">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-[13px] font-black text-orange-700 uppercase tracking-widest block">Récapitulatif</span>
          <span className="text-[11px] text-gray-500 font-medium">Vérifiez les détails avant de confirmer</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 mb-4 space-y-2.5 border border-orange-100">
        {steps.map(({ icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[16px]">{icon}</span>
            <div className="flex-1 flex justify-between items-center">
              <span className="text-[12px] text-gray-500 font-medium">{label}</span>
              <span className="text-[13px] font-black text-gray-900">{value}</span>
            </div>
          </div>
        ))}
      </div>

      {data.notes && (
        <div className="bg-white rounded-xl px-4 py-3 mb-4 border border-orange-100">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes</p>
          <p className="text-[13px] text-gray-700 font-medium">{data.notes}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onModify}
          className="flex-1 bg-white border-2 border-orange-200 text-orange-600 text-[12px] font-black uppercase tracking-widest py-3.5 rounded-2xl active:scale-95 transition-all"
        >
          Modifier
        </button>
        <button
          onClick={onConfirm}
          className="flex-[2] bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[12px] font-black uppercase tracking-widest py-3.5 rounded-2xl shadow-lg shadow-orange-300/40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" /> Confirmer la réservation
        </button>
      </div>
    </div>
  );
}

// ─── Action Card (service créé) ───────────────────────────────────────────────
function ServiceCreatedCard({ service }) {
  const navigate = useNavigate();
  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-[12px] font-black text-green-700 uppercase tracking-widest">Service créé</span>
      </div>
      <p className="text-[14px] font-black text-gray-900">{service.title || service.name}</p>
      <p className="text-[12px] text-gray-500">{service.category} · {service.price}€ · {service.duration_min} min</p>
      <button
        onClick={() => navigate("/pro/catalogue-services")}
        className="mt-3 w-full bg-green-600 text-white text-[11px] font-black uppercase tracking-widest py-2.5 rounded-xl active:scale-95 transition-all"
      >
        Voir le catalogue →
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// ─── DictateButton ────────────────────────────────────────────────────────────
function DictateButton({ onDictate, isDark }) {
  const [dictating, setDictating] = useState(false);
  const recRef = useRef(null);

  const toggle = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée."); return; }
    if (dictating) { recRef.current?.stop(); setDictating(false); return; }
    const r = new SR();
    r.lang = "fr-FR"; r.continuous = false; r.interimResults = false;
    r.onstart = () => setDictating(true);
    r.onresult = (e) => { onDictate(e.results[0][0].transcript); setDictating(false); };
    r.onerror = () => setDictating(false);
    r.onend = () => setDictating(false);
    r.start(); recRef.current = r;
  };

  return (
    <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${dictating ? "bg-green-500 shadow-md shadow-green-400/50" : isDark ? "bg-gray-700" : "bg-gray-200"}`}>
      {dictating ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> : <Mic className="w-4 h-4 text-gray-600" />}
    </button>
  );
}

// ── Clé de cache par utilisateur, stable dès le premier rendu ─────────────────
// useAuth() est encore null au montage (session chargée en async) : on lit
// l'email directement dans la session persistée par supabase-js (synchrone).
function readSessionEmailSync() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
      const parsed = JSON.parse(localStorage.getItem(k));
      const email = parsed?.user?.email || parsed?.currentSession?.user?.email;
      if (email) return email;
    }
  } catch { /* stockage indisponible */ }
  return null;
}
const mariaCacheKey = (email) => (email ? `maria_${email}` : null);

export default function Maria() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const voiceAgent = useVoiceAgent();
  const { showAuthModal, authMessage, requireAuth, closeAuthModal } = useAuthGate();
  const { user } = useAuth();
  // Affichage direct depuis le cache : l'historique et les chats récents
  // s'affichent dès la première peinture, le rafraîchissement réseau se fait
  // en arrière-plan sans jamais vider l'affichage.
  const cacheKey = mariaCacheKey(user?.email || readSessionEmailSync());

  // Couleurs adaptées au thème
  const isDark = theme === "dark" || theme === "night";
  const bg = isDark ? "bg-gray-950" : "bg-white";
  const bgChat = isDark
    ? "linear-gradient(180deg, #0f1117 0%, #111318 100%)"
    : "linear-gradient(180deg, #fdf8f4 0%, #f5f0ec 100%)";
  const headerBg = isDark
    ? "linear-gradient(135deg, #1a1c24 0%, #111318 100%)"
    : "linear-gradient(135deg, #fff9f6 0%, #fff 100%)";
  const headerBorder = isDark ? "border-gray-800" : "border-orange-50";
  const inputBarBg = isDark ? "bg-gray-900/95 border-gray-800" : "bg-white/90 border-orange-100/60";
  const inputInnerBg = isDark
    ? "linear-gradient(135deg, #1e2130 0%, #181b26 100%)"
    : "linear-gradient(135deg, #fff9f6 0%, #fff 100%)";
  const inputBorder = isDark ? "border-gray-700" : "border-orange-100";
  const inputText = isDark ? "text-gray-100" : "text-gray-700";
  const inputPlaceholder = isDark ? "placeholder:text-gray-600" : "placeholder:text-gray-300";
  const footerText = isDark ? "text-gray-700" : "text-gray-300";
  // Bulles messages
  const bubbleAssistantBg = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-orange-50";
  const bubbleAssistantText = isDark ? "text-gray-100" : "";
  const loadingDotsBg = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-orange-50";
  // Home header
  const homeHeaderBg = isDark ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100";
  const homeHeaderText = isDark ? "text-gray-100" : "text-gray-900";
  const homeBodyBg = isDark ? "bg-gray-950" : "bg-white";
  const [drawerOpen, setDrawerOpen] = useState(false);
  // « chat » dès le premier rendu si l'historique est en cache (pas de flash « home »)
  const [view, setView] = useState(() => (readPageCache(cacheKey)?.messages?.length > 0 ? "chat" : "home"));
  // null tant que le profil n'est pas déterminé : ni la version cliente ni la
  // version pro ne s'affichent entre-temps (pas de flash). Mémorisé en local
  // pour un affichage instantané au retour (voir hooks/useIsPro.js).
  const isPro = useIsPro();
  const [messages, setMessages] = useCachedState(cacheKey, [], c => c?.messages || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [recentChats, setRecentChats] = useCachedState(cacheKey, [], c => c?.recentChats || []);
  const [showSimulator, setShowSimulator] = useState(false);
  const [savedSimulations, setSavedSimulations] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vocalActive, setVocalActive] = useState(false);
  const [proFormData, setProFormData] = useState({});
  const [serviceData, setServiceData] = useState({});
  const [typingText, setTypingText] = useState(""); // texte en cours de frappe
  const [typingIndex, setTypingIndex] = useState(null); // index du message en cours de frappe
  const [voiceboxReady, setVoiceboxReady] = useState(null); // null=checking, true/false
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const typingIntervalRef = useRef(null);

  // ── Vérifier l'auth au montage ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        requireAuth("Connectez-vous pour parler avec Maria AI.");
      }
    }).catch(() => requireAuth("Connectez-vous pour parler avec Maria AI."));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-message depuis Recherche IA (location.state.autoMessage) ──
  const autoMessageSentRef = useRef(false);
  useEffect(() => {
    if (!historyLoaded) return;
    const autoMsg = location?.state?.autoMessage;
    if (autoMsg && !autoMessageSentRef.current) {
      autoMessageSentRef.current = true;
      setTimeout(() => sendMessage(autoMsg), 500);
    }
  }, [historyLoaded, location?.state?.autoMessage]);

  // ── Vérifier Voicebox au démarrage ──
  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/ai/voicebox-status`)
      .then(r => r.json())
      .then(d => setVoiceboxReady(d.available))
      .catch(() => setVoiceboxReady(false));
  }, []);

  // ── Détection pro centralisée (hooks/useIsPro.js) ──

  // ── Charger historique + résumé ──
  // Les URL blob des pièces jointes ne survivent pas au rechargement :
  // on les retire avant de persister l'historique en cache.
  const sanitizeForCache = (list) => (list || []).map(m => {
    if (!m.files?.length) return m;
    return { ...m, files: m.files.map(f => ({ name: f.name, type: f.type })) };
  });
  useEffect(() => {
    const load = async () => {
      try {
        const user = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);
        if (!user) { setHistoryLoaded(true); return; }

        const convs = await entities.MariaConversation.filter({ user_email: user.email }, "-updated_date", 1);
        if (convs.length > 0) {
          const conv = convs[0];
          setConversationId(conv.id);
          const msgs = conv.messages || [];
          if (msgs.length > 0) {
            setMessages(msgs);
            setView("chat");
            const userMsgs = msgs.filter(m => m.role === "user").map(m => m.content).slice(0, 5);
            setRecentChats(userMsgs);
            mergePageCache(mariaCacheKey(user?.email) || cacheKey, { messages: sanitizeForCache(msgs), recentChats: userMsgs });
          }
        }
      } catch {}
      setHistoryLoaded(true);
    };
    load();
  }, []);

  // La sauvegarde de l'historique est gérée directement par le backend (mariaAgent)

  // ── File attach ──
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const withPreviews = files.map(f => ({
      file: f, name: f.name, type: f.type,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    setAttachedFiles(prev => [...prev, ...withPreviews]);
    e.target.value = "";
  };

  const removeFile = (idx) => setAttachedFiles(prev => prev.filter((_, i) => i !== idx));

  // ── Effet de frappe synchronisé avec la voix ──
  const startTypingEffect = (text, msgIndex) => {
    // Nettoyer un éventuel timer précédent
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    setTypingText("");
    setTypingIndex(msgIndex);

    let i = 0;
    // Vitesse adaptée à la longueur du texte pour finir en ~même temps que la voix
    const voiceDuration = Math.min(text.length * 60, 15000); // estimation durée voix en ms
    const intervalMs = Math.max(8, voiceDuration / text.length);

    typingIntervalRef.current = setInterval(() => {
      i++;
      setTypingText(text.slice(0, i));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      if (i >= text.length) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        setTypingIndex(null);
      }
    }, intervalMs);
  };

  // ── Synthèse vocale via OpenAI TTS (fallback: Web Speech API) ──
  const voiceAudioRef = useRef(null);
  const microsoftTTSAbortRef = useRef(null);

  const speakResponse = (text, msgIndex, withTyping = false, voiceUrl = null) => {
    if (muted) return;
    setSpeaking(true);
    if (withTyping) startTypingEffect(text, msgIndex ?? -1);

    // 1. Si on a une URL Voicebox, l'utiliser
    if (voiceUrl) {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current.src = "";
      }
      const audio = new Audio(voiceUrl);
      voiceAudioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        if (withTyping) { setTypingText(text); setTypingIndex(null); }
      };
      audio.onerror = () => speakMicrosoftTTS(text, msgIndex, withTyping);
      audio.play().catch(() => speakMicrosoftTTS(text, msgIndex, withTyping));
      return;
    }

    // 2. OpenAI TTS (gratuit, voix haute qualité)
    speakMicrosoftTTS(text, msgIndex, withTyping);
  };

  const speakMicrosoftTTS = async (text, msgIndex, withTyping) => {
    const clean = text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
      .replace(/\*\*/g, "").replace(/\*/g, "").replace(/#{1,6}\s/g, "")
      .replace(/`[^`]+`/g, "").replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim()
      .slice(0, 1500);

    if (!clean) { setSpeaking(false); return; }

    try {
      console.log('[Maria TTS] Requesting OpenAI TTS...');
      microsoftTTSAbortRef.current = new AbortController();
      const res = await apiClient.fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, voice: 'fr-FR' }),
        signal: microsoftTTSAbortRef.current.signal,
      });

      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current.src = "";
      }

      const audio = new Audio(url);
      voiceAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setSpeaking(false);
        if (withTyping) { setTypingText(text); setTypingIndex(null); }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        speakWithWebSpeech(text, msgIndex, withTyping);
      };
      audio.play().catch(() => speakWithWebSpeech(text, msgIndex, withTyping));
      console.log('[Maria TTS] OpenAI TTS playing');
    } catch (err) {
      console.log('[Maria TTS] OpenAI TTS failed:', err.message, '→ falling back to Web Speech API');
      speakWithWebSpeech(text, msgIndex, withTyping);
    }
  };

  const speakWithWebSpeech = (text, msgIndex, withTyping) => {
    const clean = text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
      .replace(/\*\*/g, "").replace(/\*/g, "").replace(/#{1,6}\s/g, "")
      .replace(/`[^`]+`/g, "").replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim()
      .slice(0, 400);

    if (!clean) { setSpeaking(false); return; }

    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "fr-FR";
    utt.rate = 1.05;
    utt.pitch = 1.0;

    // Prefer Microsoft French voices (high quality on Windows/Edge)
    const voices = window.speechSynthesis.getVoices();
    const msFrFemale = voices.filter(v => v.lang.startsWith("fr") && /Marie|Denise|Virginie|Amélie|Hortense|France/i.test(v.name));
    const msFrMale = voices.filter(v => v.lang.startsWith("fr") && /Henri|Paul|Quentin|Thomas/i.test(v.name));
    const frRemote = voices.filter(v => v.lang.startsWith("fr") && !v.localService);
    const allFr = voices.filter(v => v.lang.startsWith("fr"));

    const bestVoice = msFrFemale[0] || frRemote[0] || msFrMale[0] || allFr[0];
    if (bestVoice) {
      utt.voice = bestVoice;
      console.log('[Maria TTS] Web Speech voice:', bestVoice.name, bestVoice.lang, bestVoice.localService ? 'local' : 'remote');
    }

    utt.onend = () => {
      setSpeaking(false);
      if (withTyping) { setTypingText(text); setTypingIndex(null); }
    };
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    if (microsoftTTSAbortRef.current) {
      microsoftTTSAbortRef.current.abort();
      microsoftTTSAbortRef.current = null;
    }
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.src = "";
    }
    setSpeaking(false);
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setTypingIndex(null);
  };

  const handleToggleMuted = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    // Si on active le muet et que l'IA parle → couper immédiatement
    if (newMuted && speaking) {
      stopSpeaking();
    }
  };

  // ── Send message via mariaAgent ──
  const sendMessage = async (text, fromVocal = false) => {
    const content = text || input.trim();
    if (!content && !attachedFiles.length) return;
    if (loading) return;

    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      requireAuth("Connectez-vous pour parler avec Maria AI.");
      return;
    }
    const persistKey = mariaCacheKey(data?.user?.email) || cacheKey;
    setInput("");
    setView("chat");

    const fileUrls = [];
    try {
      for (const af of attachedFiles) {
        const { file_url } = await uploadFile({ file: af.file });
        fileUrls.push(file_url);
      }
    } catch (uploadErr) {
      console.error("[Maria] File upload failed:", uploadErr);
    }

    const userMsg = {
      role: "user",
      content: content || `[${attachedFiles.length} fichier(s)]`,
      files: attachedFiles.map(f => ({ name: f.name, type: f.type, preview: f.preview })),
      timestamp: new Date().toISOString(),
    };

    if (content) {
      const newRecent = [content, ...recentChats.filter(c => c !== content)].slice(0, 5);
      setRecentChats(newRecent);
      mergePageCache(persistKey, { recentChats: newRecent });
    }
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setAttachedFiles([]);
    setLoading(true);

    let reply = "Désolée, une erreur s'est produite.";
    let action = null;
    let voiceUrl = null;

    const MARIA_SYSTEM_PROMPT = `Tu es Maria, l'assistante IA beauté de l'application BeautyBook.
Tu es une experte en coiffure, soins capillaires, skincare, maquillage et bien-être.
Tu parles de manière chaleureuse, professionnelle et personnalisée.
Tu t'adresses à l'utilisateur directement, en tutoyant ou vouvoyant selon le contexte.
Tu donnes des conseils pratiques, des recommandations de produits réels, et des routines personnalisées.
Tu réponds toujours en français. Tu es concise mais complète.
Tu n'utilises JAMAIS d'emojis dans tes réponses texte.

${isPro ? `
══════════════════════════════════════════════════════════
FONCTIONNALITÉS PRO — TRÈS IMPORTANT
══════════════════════════════════════════════════════════
Tu assistes un PROFESSIONNEL du salon. Tu peux l'aider avec:

1. AI SCALING BUSINESS → NAVIGATE: {"type": "NAVIGATE", "path": "/ai-scaling-business"}
   - Développement commercial, stratégie de croissance
   - Analyse du chiffre d'affaires, fidélisation clients
   - Création de promotions, objectifs business
   - Quand il demande de l'aide pour "développer son business", "augmenter ses revenus", "fidéliser ses clients", "stratégie", "croissance" → propose NAVIGATE vers /ai-scaling-business

2. RÉCEPTIONNISTE IA → NAVIGATE: {"type": "NAVIGATE", "path": "/receptionniste-ia"}
   - Gestion des réservations, confirmations, annulations
   - Relance clients, optimisation agenda
   - Accueil et service client
   - Quand il demande de l'aide pour "gérer ses RDV", "confirmer des réservations", "relancer des clients", "agenda", "réception" → propose NAVIGATE vers /receptionniste-ia

3. AI SOCIAL MEDIA → NAVIGATE: {"type": "NAVIGATE", "path": "/social-media"}
   - Gestion des réseaux sociaux, création de contenu
   - Quand il demande de l'aider pour "réseaux sociaux", "publications", "contenu" → propose NAVIGATE vers /social-media

4. CRÉER UN SERVICE → SERVICE_FORM action:
   - Quand il veut créer un nouveau service dans son catalogue
   - Envoie: {"type": "SERVICE_FORM", "prefill": {"name": "...", "category": "...", "price": ..., "duration": ...}}

5. GESTION AGENDA → NAVIGATE: {"type": "NAVIGATE", "path": "/pro/gestion-agenda"}
   - Quand il veut gérer ses horaires, planning, équipe

RÈGLE: Quand l'utilisateur exprime un besoin lié à une de ces fonctionnalités, propose directement l'action NAVIGATE correspondante avec un court message expliquant ce que tu vas ouvrir.
` : ""}

══════════════════════════════════════════════════════════
FLUX DE RÉSERVATION GUIDÉE — TRÈS IMPORTANT
══════════════════════════════════════════════════════════
Quand l'utilisateur veut réserver un service ( RDV, prestation, brushing, coupe, coloration, soin, manucure, maquillage, etc. ), tu DOIS suivre ce processus:

1. POSE UNE QUESTION À LA FOIS (une seule question par message)
   - D'abord: "Quel service souhaites-tu?"
   - Puis: "Pour quelle date?"
   - Puis: "À quelle heure?"
   - Puis: "Combien de temps environ?" (durée estimée)
   - Puis: "As-tu un budget en tête?" (prix)
   - Puis: "As-tu des préférences de lieu?" (quartier, ville)
   - Puis: "Des notes ou demandes spéciales?"

2. APRÈS CHAQUE RÉPONSE de l'utilisateur, tu accumules les infos et tu passes à la question suivante.
   Tu confirmes brièvement la réponse reçue avant de poser la question suivante.
   Exemple: "Noté pour le brushing le vendredi. Et à quelle heure souhaites-tu?"

3. QUAND TOUTES LES INFOS SONT COLLECTÉES, tu envoies le RÉCAPITULATIF avec l'action SERVICE_RECAP:
\`\`\`json
{"type": "SERVICE_RECAP", "data": {"service_name": "...", "date": "...", "time_slot": "...", "duration_min": ..., "price": "...", "salon_name": "...", "pro_name": "...", "notes": "..."}}
\`\`\`

4. L'utilisateur voit une carte avec récap + boutons "Modifier" et "Confirmer"
   - S'il clique "Confirmer" → tu envoies NAVIGATE vers /rendez-vous
   - S'il dit "modifier" ou "changer" → tu relances la question concernée

══════════════════════════════════════════════════════════
AUTRES ACTIONS DISPONIBLES
══════════════════════════════════════════════════════════
- NAVIGATE: {"type": "NAVIGATE", "path": "/boutique"} | "/rendez-vous" | "/profil" | "/messages" | "/services" | "/mon-solde" | "/parametres" | "/notifications" | "/live" | "/reels" | "/scan-capillaire" | "/immobilier" | "/mes-commandes" | "/programme-fidelite" | "/abonnements" | "/pro/abonnements" | "/profil-pro" | "/pro/equipe" | "/pro/catalogue-services" | "/pro/analytics" | "/devenir-pro"
- SEARCH_PRODUCTS: {"type": "SEARCH_PRODUCTS", "query": "terme de recherche"}
- SERVICE_RECAP: {"type": "SERVICE_RECAP", "data": {"service_name": "...", "date": "...", "time_slot": "...", "duration_min": ..., "price": "...", "salon_name": "...", "pro_name": "...", "notes": "..."}}

══════════════════════════════════════════════════════════
EXEMPLES DE FLUX
══════════════════════════════════════════════════════════
User: "Je veux réserver un brushing"
Maria: "Super choix ! Quel type de brushing souhaites-tu? Classique, défrisé, lissage, ou autre?"
User: "Lissage"
Maria: "Parfait, un brushing lissage. Pour quelle date souhaites-tu?"
User: "Vendredi"
Maria: "Vendredi, c'est noté. Et à quelle heure?"
User: "14h"
Maria: "14h, parfait. Combien de temps environ dure ce service?"
User: "1h30"
Maria: "Noté. As-tu un budget en tête?"
User: "40€"
Maria: "Très bien. Tu as une préférence de lieu ou de quartier?"
User: "Non"
Maria: "Dernière question: des notes ou demandes spéciales?"
User: "Non c'est tout"
Maria: "Voici le récapitulatif de ta réservation:"
\`\`\`json
{"type": "SERVICE_RECAP", "data": {"service_name": "Brushing lissage", "date": "Vendredi", "time_slot": "14h", "duration_min": 90, "price": "40€", "notes": ""}}
\`\`\`

Si l'utilisateur dit "Ouvre la boutique" → NAVIGATE direct sans poser de questions.
Si l'utilisateur dit "Salut" → réponds normalement SANS action JSON.`;

    // Construire le contenu utilisateur avec images si présentes
    let userContent;
    if (fileUrls.length > 0) {
      userContent = [
        { type: "text", text: content || "Regarde cette image et dis-moi ce que tu en penses." },
        ...fileUrls.map(url => ({ type: "image_url", image_url: { url } })),
      ];
    } else {
      userContent = content;
    }

    try {
      const historyMsgs = messages.slice(-10).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));
      
      const apiData = await apiClient.post('/api/ai/maria', {
        messages: [...historyMsgs, { role: 'user', content: userContent }],
      });
      action = apiData.actions?.length>1 ? {type:'ACTION_GROUP',items:apiData.actions} : apiData.actions?.[0] || null;

      const rawReply = apiData.choices?.[0]?.message?.content || apiData.choices?.[0]?.message?.reasoning || '';
      reply = rawReply || reply;

    } catch (err2) {
      console.error("[Maria] All APIs failed:", err2);
      const errMsg = err2?.message || '';
      if (errMsg.includes('402') || errMsg.includes('credit') || errMsg.includes('balance') || errMsg.includes('insufficient')) {
        reply = "Le service IA est momentanément indisponible. Réessayez plus tard.";
      } else if (errMsg.includes('401') || errMsg.includes('unauthorized') || errMsg.includes('Invalid')) {
        reply = "Votre session a expiré ou le service est indisponible. Reconnectez-vous avant de réessayer.";
      } else if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('CORS')) {
        reply = "⚠️ Impossible de contacter l'API. Vérifiez votre connexion internet.";
      } else {
        reply = "Oups, j'ai un petit souci technique pour le moment. Réessaie dans quelques instants !";
      }
    }

    // Accumuler les données du profil pro si step guidé
    if (action?.type === "PRO_STEP" && action.field && action.value !== undefined) {
      setProFormData(prev => ({ ...prev, [action.field]: action.value }));
    }

    // Accumuler les données de réservation si SERVICE_RECAP
    if (action?.type === "SERVICE_RECAP" && action.data) {
      setServiceData(action.data);
    }

    const assistantMsg = {
      role: "assistant",
      content: reply,
      timestamp: new Date().toISOString(),
      action: action || null,
      voiceUrl: voiceUrl || null,
    };

    const finalMessages = [...newMessages, assistantMsg];
    setMessages(finalMessages);
    mergePageCache(persistKey, { messages: sanitizeForCache(finalMessages) });
    setLoading(false);

    // Lire la réponse vocalement (typing uniquement en mode vocal)
    speakResponse(reply, finalMessages.length - 1, fromVocal, voiceUrl);
  };

  const handleVoiceTranscript = (text, isVocal = false) => {
    stopSpeaking();
    sendMessage(text, isVocal);
  };

  const handleVoiceInterrupt = () => {
    stopSpeaking();
  };

  const handleNewChat = async () => {
    setMessages([]);
    mergePageCache(cacheKey, { messages: [] });
    setAttachedFiles([]);
    setProFormData({});
    setServiceData({});
    setView("home");
    setConversationId(null);
    try {
      const u = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);
      if (u) {
        const created = await entities.MariaConversation.create({ user_email: u.email, messages: [] });
        setConversationId(created.id);
      }
    } catch {}
  };

  const handleSimulationSaved = (sim) => {
    setSavedSimulations(prev => [sim, ...prev].slice(0, 10));
    setShowSimulator(false);
    setView("chat");
    const msg = {
      role: "assistant",
      content: `✨ J'ai analysé ta simulation pour le style **${sim.styleLabel}** ! Ton visage de forme **${sim.faceShape}** est compatible à **${sim.compatibilityScore}%**. ${sim.message}\n\n💡 ${sim.recommendations?.slice(0, 2).join(" · ")}`,
      isSimulation: true,
      sim,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, msg];
    setMessages(updated);
    mergePageCache(cacheKey, { messages: sanitizeForCache(updated) });
  };

  const headerBurger = (onOpen) => (
    <button onClick={onOpen} className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all">
      <span className={`w-5 h-0.5 rounded-full ${isDark ? "bg-gray-300" : "bg-gray-800"}`} />
      <span className={`w-5 h-0.5 rounded-full ${isDark ? "bg-gray-300" : "bg-gray-800"}`} />
      <span className={`w-5 h-0.5 rounded-full ${isDark ? "bg-gray-300" : "bg-gray-800"}`} />
    </button>
  );

  // ── Input bar ──────────────────────────────────────────────────────────────
  const inputBar = () => (
    <div className={`backdrop-blur-md border-t ${inputBarBg}`} style={{ paddingBottom: "calc(65px + env(safe-area-inset-bottom, 16px))" }}>
      <FilePreview files={attachedFiles} onRemove={removeFile} />
      <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.txt" multiple className="hidden" onChange={handleFileChange} />
      <div className={`flex items-center gap-2 mx-4 mt-3 mb-2 rounded-[22px] px-3 py-2.5 border shadow-sm ${inputBorder}`} style={{ background: inputInnerBg }}>
        <button onClick={() => fileInputRef.current?.click()} className={`w-8 h-8 flex items-center justify-center active:scale-95 transition-all shrink-0 hover:text-primary ${isDark ? "text-gray-600" : "text-gray-300"}`}>
          <Paperclip className="w-4.5 h-4.5" />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Écris à Maria…"
          className={`flex-1 bg-transparent text-[14px] font-medium outline-none min-w-0 ${inputText} ${inputPlaceholder}`}
        />
        {input.trim() ? (
          <>
            <DictateButton
              onDictate={(text) => setInput(prev => prev ? prev + " " + text : text)}
              isDark={isDark}
            />
            <button onClick={() => sendMessage()} disabled={loading} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shadow-md shrink-0" style={{ background: "linear-gradient(135deg, #E8732A, #f59540)" }}>
              <Send className="w-4 h-4 text-white" />
            </button>
          </>
        ) : (
          <InlineVoice
            onTranscript={(text, isVocal) => handleVoiceTranscript(text, isVocal)}
            onDictate={(text) => setInput(prev => prev ? prev + " " + text : text)}
            speaking={speaking}
            onInterrupt={handleVoiceInterrupt}
            onActivateGlobalVoice={() => { voiceAgent.start(); }}
            globalVoiceActive={voiceAgent.active}
            onDeactivateGlobalVoice={() => { voiceAgent.stop(); }}
          />
        )}
      </div>
      <p className={`text-center text-[9px] font-black uppercase tracking-widest pb-1 ${footerText}`}>
        Maria · Ton assistante beauté IA ✨
      </p>
    </div>
  );

  const handleServiceCreated = (service) => {
    setView("chat");
    const msg = {
      role: "assistant",
      content: `✅ Votre service **${service.title}** a été publié avec succès dans votre catalogue !`,
      timestamp: new Date().toISOString(),
      action: { type: "SERVICE_CREATED", service },
    };
    setMessages(prev => [...prev, msg]);
  };

  // ── CHAT VIEW ──────────────────────────────────────────────────────────────
  if (view === "chat") {
    return (
      <div className={`font-display flex flex-col h-full relative overflow-hidden ${isDark ? "bg-gray-950" : "bg-white"}`}>
        <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onNewChat={handleNewChat} recentChats={recentChats} savedSimulations={savedSimulations} onOpenSimulator={() => setShowSimulator(true)} onScanCapillaire={() => navigate("/scan-capillaire")} onStylisteIA={() => navigate("/sh-ai")} isPro={isPro} />
        {showSimulator && <FiltreAIModal styleTitle="" onClose={() => setShowSimulator(false)} onResultSaved={handleSimulationSaved} />}

        <div className={`px-4 pt-5 pb-4 flex items-center justify-between border-b ${headerBorder}`} style={{ background: headerBg }}>
          {headerBurger(() => setDrawerOpen(true))}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-primary via-orange-400 to-rose-400 rounded-xl flex items-center justify-center shadow-md shadow-primary/30">
              <Bot className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className={`text-[15px] font-black leading-tight ${isDark ? "text-gray-100" : "text-gray-900"}`}>Maria AI</p>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${voiceboxReady === true ? 'bg-blue-400 animate-pulse' : voiceboxReady === false ? 'bg-orange-400' : 'bg-gray-300 animate-pulse'}`} />
                <p className={`text-[10px] font-medium ${voiceboxReady === true ? 'text-blue-500' : voiceboxReady === false ? 'text-orange-500' : 'text-gray-400'}`}>
                  {voiceboxReady === true ? 'Voix naturelle' : voiceboxReady === false ? 'Voix standard' : 'Chargement...'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawerOpen(true)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all border ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
              <History className={`w-4 h-4 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 hide-scrollbar" style={{ background: bgChat }}>
          {messages.map((msg, i) => {
            const isTypingThis = typingIndex === i && typingIndex !== null;
            const displayContent = isTypingThis ? typingText : msg.content;

            return (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2.5`}>
                {msg.role === "assistant" && (
                  <div className="w-9 h-9 bg-gradient-to-br from-primary via-orange-500 to-rose-400 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-primary/30">
                    <Bot className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                  </div>
                )}
                <div className="flex flex-col gap-2 max-w-[82%]">
                  {msg.files?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {msg.files.map((f, fi) => (
                        f.type.startsWith("image/") && f.preview ? (
                          <BeautyImage key={fi} src={f.preview} alt={f.name} className="w-20 h-20 rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div key={fi} className="bg-white rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-sm border border-gray-100">
                            <FileText className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-bold text-gray-700 max-w-[80px] truncate">{f.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  {msg.content && (
                    msg.role === "user" ? (
                      <div className="px-4 py-3 rounded-[20px] rounded-tr-[6px] shadow-md" style={{ background: "linear-gradient(135deg, #E8732A 0%, #f59540 100%)" }}>
                        <p className="text-white text-[14px] font-medium leading-relaxed">{msg.content}</p>
                      </div>
                    ) : (
                      <div className={`rounded-[20px] rounded-tl-[6px] shadow-md shadow-black/5 border overflow-hidden ${bubbleAssistantBg}`}>
                        {/* Ligne de couleur en haut */}
                        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-orange-300 to-rose-300" />
                        <div className={`px-4 py-3.5 ${bubbleAssistantText}`}>
                          <MariaMessage
                            content={displayContent || ""}
                            onSpeak={() => speakResponse(msg.content, i, false, null)}
                            muted={muted}
                            onToggleMuted={i === messages.length - 1 ? handleToggleMuted : undefined}
                            voiceUrl={msg.voiceUrl}
                          />
                          {isTypingThis && displayContent.length < msg.content.length && (
                            <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse rounded-full" />
                          )}
                        </div>
                      </div>
                    )
                  )}
                  {!isTypingThis && msg.action?.type === "REDIRECT_TO_PRO" && (
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mt-2">
                      <p className="text-[12px] font-black text-primary mb-3">🚫 Fonctionnalité réservée aux comptes professionnels</p>
                      <button
                        onClick={() => navigate("/devenir-pro")}
                        className="w-full bg-primary text-white py-2.5 rounded-xl font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Devenir Professionnel →
                      </button>
                    </div>
                  )}
                  {!isTypingThis && msg.action?.type === "SERVICE_CREATED" && (
                    <ServiceCreatedCard service={msg.action.service} />
                  )}
                  {!isTypingThis && msg.action?.type === "SERVICE_FORM" && !msg.action?.published && (
                    <ServiceFormCard
                      prefill={msg.action.prefill || {}}
                      onSuccess={(service) => {
                        setMessages(prev => prev.map((m, mi) => mi === i
                          ? { ...m, action: { ...m.action, published: true } }
                          : m
                        ));
                        handleServiceCreated(service);
                      }}
                      onCancel={() => {
                        setMessages(prev => prev.map((m, mi) => mi === i
                          ? { ...m, action: { ...m.action, published: true } }
                          : m
                        ));
                      }}
                    />
                  )}
                  {!isTypingThis && msg.action?.type === "NAVIGATE" && (
                    <NavigateCard action={msg.action} onNavigate={() => {}} />
                  )}
                  {!isTypingThis && msg.action?.type === "SEARCH_PRODUCTS" && (
                    <SearchProductsCard query={msg.action.query} />
                  )}
                  {!isTypingThis && msg.action?.type === "SERVICE_RECAP" && !msg.action?.confirmed && (
                    <ServiceRecapCard
                      data={msg.action.data || serviceData}
                      onConfirm={() => {
                        setMessages(prev => prev.map((m, mi) => mi === i
                          ? { ...m, action: { ...m.action, confirmed: true } }
                          : m
                        ));
                        navigate("/rendez-vous", {
                          state: { prefill: msg.action.data || serviceData }
                        });
                      }}
                      onModify={() => {
                        setMessages(prev => [
                          ...prev,
                          { role: "user", content: "Je veux modifier les détails de ma réservation", timestamp: new Date().toISOString() }
                        ]);
                        sendMessage("Je veux modifier les détails de ma réservation", false);
                      }}
                    />
                  )}
                  {!isTypingThis && msg.action?.type === "OPEN_PRO_FORM" && (
                    <OpenProFormCard proData={msg.action.proData || proFormData} />
                  )}
                  {!isTypingThis && msg.action?.type === "BOOKING_CONFIRMATION" && <BookingConfirmation proposal={msg.action} />}
                  {!isTypingThis && ['ACTION_CONFIRMATION','ACTION_GROUP'].includes(msg.action?.type) && <ActionConfirmation proposal={msg.action}/>}
                  {!isTypingThis && msg.action?.type === "BOOKING_SUMMARY" && (
                    <BookingSummaryCard data={msg.action.data || {}} />
                  )}
                  {!isTypingThis && msg.action?.type === "RESERVATION_CREATED" && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-[12px] font-black text-green-700 uppercase tracking-widest">Réservation créée ✅</span>
                      </div>
                      <p className="text-[13px] font-black text-gray-900">{msg.action.reservation?.service_name}</p>
                      <p className="text-[12px] text-gray-500">{msg.action.reservation?.date} à {msg.action.reservation?.time_slot} · {msg.action.reservation?.salon_name}</p>
                      <button onClick={() => navigate("/rendez-vous")} className="mt-3 w-full bg-green-600 text-white text-[11px] font-black uppercase tracking-widest py-2.5 rounded-xl active:scale-95 transition-all">
                        Voir mes rendez-vous →
                      </button>
                    </div>
                  )}
                  {!isTypingThis && msg.action?.type === "ROUTINE_SUMMARY" && !msg.action?.created && (
                    <RoutineSummaryCard
                      data={msg.action.data || {}}
                      onCreated={() => {
                        setMessages(prev => prev.map((m, mi) => mi === i
                          ? { ...m, action: { ...m.action, created: true } }
                          : m
                        ));
                      }}
                    />
                  )}
                  {!isTypingThis && msg.action?.type === "ROUTINE_SUMMARY" && msg.action?.created && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mt-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <p className="text-[12px] font-black text-green-700">Routine créée avec succès ✨</p>
                    </div>
                  )}
                  {!isTypingThis && msg.action?.type === "ROUTINE_CREATED" && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-[12px] font-black text-green-700 uppercase tracking-widest">Routine créée ✨</span>
                      </div>
                      <p className="text-[14px] font-black text-gray-900">{msg.action.routine?.name}</p>
                      <p className="text-[12px] text-gray-500">{msg.action.routine?.frequency} — {msg.action.routine?.time}</p>
                      <button onClick={() => navigate("/profil")} className="mt-3 w-full bg-green-600 text-white text-[11px] font-black uppercase tracking-widest py-2.5 rounded-xl active:scale-95 transition-all">
                        Voir mes routines →
                      </button>
                    </div>
                  )}
                  
                  {msg.isSimulation && msg.sim && (
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-orange-100">
                      <div className="flex gap-3 p-3">
                        <BeautyImage src={msg.sim.styleImg} alt={msg.sim.styleLabel} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-primary uppercase tracking-widest">Simulation IA</p>
                          <p className="text-[13px] font-black text-gray-900">{msg.sim.styleLabel}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${msg.sim.compatibilityScore}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-primary shrink-0">{msg.sim.compatibilityScore}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-primary via-orange-500 to-rose-400 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                <Bot className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
              </div>
              <div className={`rounded-[20px] rounded-tl-[6px] px-5 py-3.5 flex gap-2 shadow-md shadow-black/5 border ${loadingDotsBg}`}>
                {[0, 1, 2].map(j => (
                  <span key={j} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: j === 0 ? "#E8732A" : j === 1 ? "#f59540" : "#fbbf7a", animationDelay: `${j * 0.18}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {inputBar()}
      </div>
    );
  }

  // ── HOME VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className={`font-display flex flex-col h-full relative overflow-hidden ${homeBodyBg}`}>
      <AuthModal open={showAuthModal} onClose={closeAuthModal} message={authMessage} />
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onNewChat={handleNewChat} recentChats={recentChats} savedSimulations={savedSimulations} onOpenSimulator={() => setShowSimulator(true)} onScanCapillaire={() => navigate("/scan-capillaire")} onStylisteIA={() => navigate("/sh-ai")} isPro={isPro} />
      {showSimulator && <FiltreAIModal styleTitle="" onClose={() => setShowSimulator(false)} onResultSaved={handleSimulationSaved} />}

      <div className={`px-4 pt-5 pb-3 flex items-center justify-between border-b ${homeHeaderBg}`}>
        {headerBurger(() => setDrawerOpen(true))}
        <div className="text-center">
          <p className={`text-[17px] font-black leading-tight ${homeHeaderText}`}>Maria AI</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(isPro ? "/pro/abonnements" : "/abonnements")} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-2 active:scale-95 transition-all">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <p className="text-[9px] font-black text-primary uppercase tracking-wider leading-none">Abonnement</p>
          </button>
          <button onClick={() => setDrawerOpen(true)} className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
            <History className={`w-4 h-4 ${isDark ? "text-gray-400" : "text-gray-600"}`} />
          </button>
        </div>
      </div>


      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {isPro === null ? (
          <MariaProfileSkeleton isDark={isDark} />
        ) : (
        <div className="px-4 pt-2" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {isPro ? (
              <>
                {/* AI Scaling Business + Annonces en bas, relié par un fil perpendiculaire */}
                <div>
                  <button
                    onClick={() => navigate("/ai-scaling-business")}
                    className="relative h-44 w-full rounded-3xl overflow-hidden active:scale-[0.98] transition-all"
                  >
                    <BeautyImage src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=400" alt="AI Scaling Business" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/80 to-blue-700/70" />
                    <div className="absolute inset-0 p-4 flex flex-col justify-between">
                      <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white text-[13px] font-black leading-tight">AI Scaling</p>
                        <p className="text-white text-[13px] font-black leading-tight">Business</p>
                        <span className="bg-white/20 border border-white/30 rounded-full px-1.5 py-0.5 text-white text-[8px] font-black uppercase tracking-wider mt-1 inline-block">IA</span>
                      </div>
                    </div>
                  </button>
                  {/* Fil perpendiculaire visible reliant la carte au bouton */}
                  <div className="flex justify-end pr-9">
                    <div className="w-[2px] h-[18px] bg-gradient-to-b from-orange-400 to-orange-300" />
                  </div>
                  {/* Bouton Annonces fin, décalé vers la droite */}
                  <div className="flex justify-end pr-1">
                    <button
                      onClick={() => navigate("/annonces")}
                      className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/30 active:scale-95 transition-all"
                    >
                      <Paperclip className="w-3 h-3 -rotate-45" />
                      <span className="text-[10px] font-black whitespace-nowrap">Annonces</span>
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/receptionniste-ia")}
                  className="relative h-44 rounded-3xl overflow-hidden active:scale-[0.98] transition-all"
                >
                  <BeautyImage src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400" alt="Receptionniste IA" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/80 to-teal-700/70" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-[13px] font-black leading-tight">Receptionniste</p>
                      <p className="text-white text-[13px] font-black leading-tight">IA</p>
                      <span className="bg-white/20 border border-white/30 rounded-full px-1.5 py-0.5 text-white text-[8px] font-black uppercase tracking-wider mt-1 inline-block">Essayer</span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/social-media")}
                  className="relative h-44 rounded-3xl overflow-hidden active:scale-[0.98] transition-all"
                >
                  <BeautyImage src="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=400" alt="AI Social Media" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/80 to-purple-700/70" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Globe className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-[13px] font-black leading-tight">AI Social</p>
                      <p className="text-white text-[13px] font-black leading-tight">Media</p>
                      <span className="bg-white/20 border border-white/30 rounded-full px-1.5 py-0.5 text-white text-[8px] font-black uppercase tracking-wider mt-1 inline-block">Essayer</span>
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/scan-capillaire")}
                  className="relative h-44 rounded-3xl overflow-hidden active:scale-[0.98] transition-all"
                >
                  <BeautyImage src={SCAN_IMG} alt="scan" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-400/80 to-blue-600/70" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Scissors className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-[13px] font-black leading-tight">Scan</p>
                      <p className="text-white text-[13px] font-black leading-tight">Capillaire</p>
                      <span className="bg-white/20 border border-white/30 rounded-full px-1.5 py-0.5 text-white text-[8px] font-black uppercase tracking-wider mt-1 inline-block">IA</span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setShowSimulator(true); }}
                  className="relative h-44 rounded-3xl overflow-hidden active:scale-[0.98] transition-all"
                >
                  <BeautyImage src="https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=400" alt="AI Hairstyle" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500/80 to-pink-700/70" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Wand2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-[13px] font-black leading-tight">AI Hairstyle</p>
                      <p className="text-white text-[13px] font-black leading-tight">Changer</p>
                      <span className="bg-white/20 border border-white/30 rounded-full px-1.5 py-0.5 text-white text-[8px] font-black uppercase tracking-wider mt-1 inline-block">Essayer</span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/sh-ai")}
                  className="relative h-44 rounded-3xl overflow-hidden active:scale-[0.98] transition-all"
                >
                  <BeautyImage src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=400" alt="Styliste IA" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/80 to-pink-700/70" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-[13px] font-black leading-tight">Styliste</p>
                      <p className="text-white text-[13px] font-black leading-tight">IA</p>
                      <span className="bg-white/20 border border-white/30 rounded-full px-1.5 py-0.5 text-white text-[8px] font-black uppercase tracking-wider mt-1 inline-block">Essayer</span>
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>

          <div className="text-center mb-5">
            <h1 className={`text-[26px] font-black leading-tight mb-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
              {isPro ? (
                <>Développe ton <span className="text-primary font-serif italic">activité beauté</span>.</>
              ) : (
                <>La nouvelle ère de la <span className="text-primary font-serif italic">beauté</span>.</>
              )}
            </h1>
            <p className={`text-[13px] font-medium leading-relaxed ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              {isPro
                ? "Crée tes services, gère tes réservations\net développe ton salon avec Maria. ✨"
                : "Conseils beauté, routines personnalisées,\nréservations et bien plus encore. ✨"
              }
            </p>
          </div>

          {/* Quick actions — "Créer un service" uniquement pour les pros */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { icon: Scissors, label: "Conseil coiffure", q: "Quelle coupe de cheveux me conseillerais-tu ?" },
              { icon: Star, label: "Tendances 2026", q: "Quelles sont les tendances beauté 2026 ?" },
              ...(isPro ? [{ icon: Heart, label: "Créer un service", q: "Je veux créer un nouveau service dans mon catalogue.", highlight: true }] : [{ icon: Heart, label: "Soin visage", q: "Quel soin visage est idéal pour ma peau ?" }]),
              { icon: MessageSquare, label: "Mes messages", q: "Affiche-moi mes derniers messages et aide-moi à y répondre." },
              { icon: Calendar, label: "Prendre RDV", q: "Je veux réserver une prestation beauté, guide-moi étape par étape." },
              { icon: Lightbulb, label: "Créer une routine", q: "Je veux créer une routine beauté personnalisée, propose-moi des idées adaptées à mon profil." },
            ].map(({ icon: Icon, label, q, highlight }) => (
              <button
                key={label}
                onClick={() => sendMessage(q)}
                className={`flex items-center gap-2 rounded-2xl px-3 py-3 active:scale-[0.98] transition-all text-left border ${
                  highlight
                    ? "bg-orange-50 border-orange-200"
                    : isDark
                      ? "bg-gray-800 border-gray-700"
                      : "bg-gray-50 border-gray-100"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 text-primary" />
                <span className={`text-[12px] font-black ${highlight ? "text-primary" : isDark ? "text-gray-200" : "text-gray-700"}`}>{label}</span>
              </button>
            ))}
          </div>

          {/* Bandeau pro exclusif — créer un service */}
          {isPro && (
            <button
              onClick={() => sendMessage("Je veux créer un nouveau service dans mon catalogue.")}
              className="w-full mb-4 flex items-center gap-3 bg-gradient-to-r from-primary to-orange-400 rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
            >
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-white text-[14px] font-black leading-tight">Créer un nouveau service</p>
                <p className="text-white/70 text-[11px] font-medium">Maria vous guide étape par étape ✨</p>
              </div>
            </button>
          )}
        </div>
        )}
      </div>

      <button
        onClick={() => navigate("/pro/publication")}
        className="fixed right-4 z-50 active:scale-90 transition-all flex items-center gap-2 bg-gradient-to-r from-primary to-orange-600 text-white rounded-full pl-5 pr-3 py-3 shadow-xl shadow-primary/30"
        style={{ top: "65%", transform: "translateY(-50%)" }}
      >
        <span className="text-[12px] font-black uppercase tracking-wider">Créer</span>
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <Plus className="w-4 h-4 text-white" strokeWidth={3} />
        </div>
      </button>

      {inputBar()}
    </div>
  );
}
