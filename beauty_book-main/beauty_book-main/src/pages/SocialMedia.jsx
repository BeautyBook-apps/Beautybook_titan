import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import {
  ArrowLeft, CheckCircle2, Shield, Eye, EyeOff, ChevronRight,
  ExternalLink, Settings, Power, PowerOff, BarChart3, MessageCircle,
  Bot, Users, TrendingUp, Clock, Search, Sparkles, Globe, Zap,
  ArrowUpRight, Calendar, Send, Heart, Share2, AlertCircle
} from "lucide-react";
import "../pages/Recherche.css";

const PLATFORMS = [
  {
    id: "instagram", name: "Instagram",
    icon: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
    color: "#E4405F", gradient: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)",
    desc: "DMs, commentaires et stories avec IA",
    audience: "2.1M utilisateurs beauté",
    fields: [
      { key: "accessToken", label: "Token d'accès", placeholder: "EAA...", type: "password", link: "https://developers.facebook.com/tools/explorer/", required: true },
      { key: "businessId", label: "Business Account ID", placeholder: "17841400...", type: "text", link: "https://business.facebook.com/settings/", required: true },
    ],
    features: ["Réponses auto DM", "Réponses commentaires", "Story replies", "Gestion mentions"]
  },
  {
    id: "facebook", name: "Facebook",
    icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    color: "#1877F2", gradient: "linear-gradient(135deg, #1877F2, #0A5AC8)",
    desc: "Messenger et commentaires automatisés",
    audience: "1.8M utilisateurs beauté",
    fields: [
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAA...", type: "password", link: "https://developers.facebook.com/tools/explorer/", required: true },
      { key: "pageId", label: "Page ID", placeholder: "123456789...", type: "text", link: "https://www.facebook.com/settings/pages/", required: true },
    ],
    features: ["Messenger auto-reply", "Comment auto-reply", "Broadcast", "Lead generation"]
  },
  {
    id: "whatsapp", name: "WhatsApp Business",
    icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
    color: "#25D366", gradient: "linear-gradient(135deg, #25D366, #128C7E)",
    desc: "Convertissez les prospects via WhatsApp",
    audience: "3.4M utilisateurs beauté",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "123456789...", type: "text", link: "https://developers.facebook.com/apps/", required: true },
      { key: "accessToken", label: "Token permanent", placeholder: "EAA...", type: "password", link: "https://business.facebook.com/wa/manage/", required: true },
    ],
    features: ["Messages texte/image", "Templates WhatsApp", "Catalogue produits", "Paiements"]
  },
  {
    id: "tiktok", name: "TikTok",
    icon: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.16z",
    color: "#000000", gradient: "linear-gradient(135deg, #000000, #333333)",
    desc: "Commentaires et DMs TikTok automatisés",
    audience: "4.2M utilisateurs beauté",
    fields: [
      { key: "accessToken", label: "Access Token", placeholder: "TikTok access token...", type: "password", link: "https://developers.tiktok.com/", required: true },
      { key: "openId", label: "Open ID", placeholder: "open_id...", type: "text", link: "https://business.tiktok.com/", required: true },
    ],
    features: ["Réponses commentaires", "DM automation", "Analytics"]
  },
];

function SocialIcon({ path, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d={path} />
    </svg>
  );
}

const TABS = [
  { id: "platforms", label: "Plateformes", icon: Globe },
  { id: "automation", label: "Automatisations", icon: Zap },
  { id: "stats", label: "Statistiques", icon: BarChart3 },
];

const AUTOMATIONS = [
  {
    id: "dm-welcome", name: "Message de bienvenue",
    desc: "Maria accueille chaque nouvel abonné avec un message personnalisé.",
    icon: Send, color: "#3B82F6", bg: "#EFF6FF", enabled: true,
  },
  {
    id: "comment-reply", name: "Réponse aux commentaires",
    desc: "L'IA répond aux commentaires avec votre ton de voix en moins d'une minute.",
    icon: MessageCircle, color: "#8B5CF6", bg: "#F5F3FF", enabled: true,
  },
  {
    id: "story-engage", name: "Engagement stories",
    desc: "Réactions automatiques aux stories qui mentionnent votre salon.",
    icon: Heart, color: "#EC4899", bg: "#FDF2F8", enabled: false,
  },
  {
    id: "post-schedule", name: "Publication planifiée",
    desc: "Maria génère et planifie vos posts aux heures d'affluence optimale.",
    icon: Calendar, color: "#F59E0B", bg: "#FFFBEB", enabled: false,
  },
  {
    id: "review-boost", name: "Boost d'avis",
    desc: "Sollicite automatiquement un avis Google après chaque rendez-vous.",
    icon: Share2, color: "#10B981", bg: "#ECFDF5", enabled: true,
  },
];

/* ── Persistance locale des connexions vérifiées ── */
const SOCIAL_STORAGE_KEY = "bb_social_connections";

function loadSavedConnections() {
  try { return JSON.parse(localStorage.getItem(SOCIAL_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveConnection(id, keys, verifiedLabel) {
  try {
    const all = loadSavedConnections();
    all[id] = { keys, verifiedLabel, connectedAt: new Date().toISOString() };
    localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(all));
  } catch { /* stockage indisponible : la connexion reste en mémoire */ }
}

function removeConnection(id) {
  try {
    const all = loadSavedConnections();
    delete all[id];
    localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/* ── Vérification RÉELLE des identifiants auprès de l'API de chaque plateforme ── */
const GRAPH_API = "https://graph.facebook.com/v21.0";

async function fetchJson(url, { headers, timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Vérifie les identifiants saisis contre la vraie API de la plateforme.
 * Retourne { ok: true, label } si le token est valide ET correspond à l'ID saisi,
 * sinon { ok: false, message } avec le motif réel du refus.
 */
async function verifyPlatformCredentials(id, keys) {
  const get = (k) => (keys[k] || "").trim();
  try {
    if (id === "instagram") {
      const bid = get("businessId");
      const { res, data } = await fetchJson(
        `${GRAPH_API}/${encodeURIComponent(bid)}?fields=id,username,name&access_token=${encodeURIComponent(get("accessToken"))}`
      );
      if (data && data.error) throw new Error(`Instagram : ${data.error.message} (code ${data.error.code}).`);
      if (!res.ok || !data || !data.id) throw new Error("Instagram : réponse inattendue de l'API.");
      if (String(data.id) !== bid) throw new Error("Instagram : ce token ne correspond pas à ce Business Account ID.");
      return { ok: true, label: data.username ? `@${data.username}` : (data.name || bid) };
    }
    if (id === "facebook") {
      const pid = get("pageId");
      const { res, data } = await fetchJson(
        `${GRAPH_API}/${encodeURIComponent(pid)}?fields=id,name&access_token=${encodeURIComponent(get("pageAccessToken"))}`
      );
      if (data && data.error) throw new Error(`Facebook : ${data.error.message} (code ${data.error.code}).`);
      if (!res.ok || !data || !data.id) throw new Error("Facebook : réponse inattendue de l'API.");
      if (String(data.id) !== pid) throw new Error("Facebook : ce token ne correspond pas à cette Page ID.");
      return { ok: true, label: data.name || pid };
    }
    if (id === "whatsapp") {
      const pnid = get("phoneNumberId");
      const { res, data } = await fetchJson(
        `${GRAPH_API}/${encodeURIComponent(pnid)}?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(get("accessToken"))}`
      );
      if (data && data.error) throw new Error(`WhatsApp : ${data.error.message} (code ${data.error.code}).`);
      if (!res.ok || !data || !data.id) throw new Error("WhatsApp : réponse inattendue de l'API.");
      if (String(data.id) !== pnid) throw new Error("WhatsApp : ce token ne correspond pas à ce Phone Number ID.");
      return { ok: true, label: data.display_phone_number || data.verified_name || pnid };
    }
    if (id === "tiktok") {
      const oid = get("openId");
      const { res, data } = await fetchJson(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
        { headers: { Authorization: `Bearer ${get("accessToken")}` } }
      );
      if (data && data.error) throw new Error(`TikTok : ${data.error.message || data.error.code}.`);
      const user = data && data.data && data.data.user;
      if (!res.ok || !user || !user.open_id) throw new Error("TikTok : réponse inattendue de l'API.");
      if (String(user.open_id) !== oid) throw new Error("TikTok : ce token ne correspond pas à cet Open ID.");
      return { ok: true, label: user.display_name ? `@${user.display_name}` : oid };
    }
    throw new Error("Plateforme inconnue.");
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, message: "Délai dépassé : la plateforme ne répond pas. Vérifiez votre connexion et réessayez." };
    if (e instanceof TypeError) return { ok: false, message: "Impossible de joindre l'API de la plateforme depuis le navigateur (réseau ou restriction de l'API). La clé n'a pas pu être vérifiée : connexion refusée." };
    return { ok: false, message: e.message || "Échec de la vérification." };
  }
}

export default function SocialMedia() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("platforms");
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [validating, setValidating] = useState(null);
  const [automations, setAutomations] = useState(AUTOMATIONS);
  const [platforms, setPlatforms] = useState(() => {
    const saved = loadSavedConnections();
    return PLATFORMS.map(p => {
      const s = saved[p.id];
      return { ...p, connected: !!s, keys: s?.keys || {}, verifiedLabel: s?.verifiedLabel || null, showKeys: {}, error: null };
    });
  });

  const areKeysValid = (p) => {
    return p.fields.filter(f => f.required).every(f => p.keys[f.key]?.trim());
  };

  const toggleConnect = async (id) => {
    const platform = platforms.find(p => p.id === id);
    if (platform.connected) {
      removeConnection(id);
      setPlatforms(prev => prev.map(p => p.id === id ? { ...p, connected: false, verifiedLabel: null, error: null } : p));
      return;
    }
    if (!areKeysValid(platform)) return;
    setValidating(id);
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, error: null } : p));
    // Vérification réelle auprès de l'API de la plateforme : une clé invalide
    // ou qui ne correspond pas à l'ID saisi est refusée avec le motif exact.
    const result = await verifyPlatformCredentials(id, platform.keys);
    setValidating(null);
    if (result.ok) {
      saveConnection(id, platform.keys, result.label);
      setPlatforms(prev => prev.map(p => p.id === id ? { ...p, connected: true, verifiedLabel: result.label, error: null } : p));
    } else {
      setPlatforms(prev => prev.map(p => p.id === id ? { ...p, connected: false, verifiedLabel: null, error: result.message } : p));
    }
  };

  const setKey = (id, key, value) => {
    // Toute modification de clé invalide la connexion : il faudra re-vérifier.
    removeConnection(id);
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, keys: { ...p.keys, [key]: value }, connected: false, verifiedLabel: null, error: null } : p));
  };

  const toggleShowKey = (id, key) => {
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, showKeys: { ...p.showKeys, [key]: !p.showKeys[key] } } : p));
  };

  const toggleAutomation = (id) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const connectedCount = platforms.filter(p => p.connected).length;
  const activeAutomations = automations.filter(a => a.enabled).length;

  const filteredPlatforms = useMemo(() => {
    if (!q.trim()) return platforms;
    const needle = q.toLowerCase();
    return platforms.filter(p =>
      p.name.toLowerCase().includes(needle) ||
      p.desc.toLowerCase().includes(needle) ||
      p.features.some(f => f.toLowerCase().includes(needle))
    );
  }, [platforms, q]);

  return (
    <div className="discovery-page" style={{ minHeight: "100vh", paddingBottom: 100 }}>
      {/* ── Hero inspiré Recherche ── */}
      <header className="discovery-hero">
        <div className="discovery-topline">
          <span className="discovery-eyebrow">
            <span className="pulse-dot" />
            MARIA AI · SOCIAL
          </span>
          <button
            onClick={() => navigate(-1)}
            className="discovery-icon-button"
            aria-label="Retour"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13 }}
          >
            <ArrowLeft size={18} /> Retour
          </button>
        </div>

        <div className="discovery-heading">
          <div>
            <h1>
              Vos réseaux,<br />
              <em>pilotés par l'IA.</em>
            </h1>
            <p>Maria gère vos DMs, commentaires et publications.</p>
          </div>
          <button className="discovery-maria" onClick={() => setActiveTab("automation")}>
            <span className="discovery-maria-icon"><Zap size={22} /></span>
            <span>
              <strong>{activeAutomations} automatisations</strong>
              <small>{connectedCount} plateforme{connectedCount > 1 ? "s" : ""} connectée{connectedCount > 1 ? "s" : ""}</small>
            </span>
            <ArrowUpRight size={19} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="discovery-searchbar">
          <label className="discovery-query">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Rechercher une plateforme</span>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Chercher Instagram, WhatsApp, TikTok..."
            />
          </label>
        </div>

        {/* Tabs */}
        <div className="discovery-entity-tabs-container" style={{ marginTop: 12 }}>
          <div className="discovery-entity-tabs">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`discovery-entity-tab ${isActive ? "active" : ""}`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Contenu ── */}
      <main style={{ padding: "18px max(20px, calc((100% - 1180px) / 2))", maxWidth: 1180, margin: "0 auto" }}>

        {/* ── PLATEFORMES ── */}
        {activeTab === "platforms" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Statut global */}
            <div className="discovery-stat-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="pulse-dot" style={{ background: connectedCount > 0 ? "#10B981" : "#D1D5DB", boxShadow: "none" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>
                  {connectedCount > 0
                    ? `${connectedCount} plateforme${connectedCount > 1 ? "s" : ""} active${connectedCount > 1 ? "s" : ""} — Maria est en ligne`
                    : "Connectez une plateforme pour activer Maria"}
                </span>
              </div>
              {connectedCount > 0 && <CheckCircle2 size={20} style={{ color: "#10B981" }} />}
            </div>

            {filteredPlatforms.map(p => {
              const isExpanded = expandedId === p.id;
              const keysValid = areKeysValid(p);
              return (
                <article key={p.id} className="discovery-card" style={{ overflow: "hidden" }}>
                  {/* Bandeau */}
                  <div style={{ height: 72, background: p.gradient, position: "relative" }}>
                    <div style={{ position: "absolute", bottom: -22, left: 18, width: 56, height: 56, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: p.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <SocialIcon path={p.icon} size={22} />
                      </div>
                    </div>
                    {p.connected && (
                      <span style={{ position: "absolute", top: 12, right: 14, display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(6px)", padding: "5px 11px", borderRadius: 999, fontSize: 10, fontWeight: 900, color: "#fff", letterSpacing: "0.06em" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80" }} /> ACTIF
                      </span>
                    )}
                  </div>

                  <div style={{ padding: "28px 18px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <h3 style={{ fontSize: 17, fontWeight: 900 }}>{p.name}</h3>
                        <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{p.desc}</p>
                        <p style={{ fontSize: 11, color: "#FF6B00", fontWeight: 700, marginTop: 4 }}>📣 {p.audience}</p>
                        {p.connected && p.verifiedLabel && (
                          <p style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 4 }}>✓ Compte vérifié : {p.verifiedLabel}</p>
                        )}
                      </div>
                    </div>

                    {/* Features */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                      {p.features.map((f, i) => (
                        <span key={i} className="discovery-tag">{f}</span>
                      ))}
                    </div>

                    {/* Config dépliée */}
                    {isExpanded && (
                      <div style={{ marginTop: 14, background: "#FAFAFA", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 900, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Clés API</p>
                        {p.fields.map(field => {
                          const hasValue = p.keys[field.key]?.trim();
                          return (
                            <div key={field.key}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>{field.label}</p>
                                {field.link && (
                                  <a href={field.link} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#FF6B00", fontWeight: 700 }}>
                                    Obtenir <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `1.5px solid ${hasValue ? "#A7F3D0" : "#E5E7EB"}`, borderRadius: 12, overflow: "hidden" }}>
                                <input
                                  type={p.showKeys[field.key] ? "text" : field.type}
                                  value={p.keys[field.key] || ""}
                                  onChange={e => setKey(p.id, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  style={{ flex: 1, background: "transparent", fontSize: 13, padding: "11px 14px", outline: "none", border: "none", fontFamily: "monospace" }}
                                />
                                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12 }}>
                                  {hasValue && <CheckCircle2 size={14} style={{ color: "#10B981" }} />}
                                  <button onClick={() => toggleShowKey(p.id, field.key)} style={{ opacity: 0.4, background: "none", border: "none", cursor: "pointer" }}>
                                    {p.showKeys[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ECFDF5", borderRadius: 12, padding: "10px 12px" }}>
                          <Shield size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                          <p style={{ fontSize: 11, color: "#065F46" }}>Clés stockées localement sur cet appareil uniquement.</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button
                        onClick={() => toggleConnect(p.id)}
                        disabled={validating === p.id || (!p.connected && !keysValid)}
                        className="discovery-cta"
                        style={{
                          flex: 1, opacity: (validating === p.id || (!p.connected && !keysValid)) ? 0.45 : 1,
                          background: p.connected ? "#FEE2E2" : undefined, color: p.connected ? "#B91C1C" : undefined,
                        }}
                      >
                        {validating === p.id ? "Validation..." : p.connected ? "Déconnecter" : "Connecter avec Maria IA"}
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="discovery-icon-button"
                        style={{ width: 48, height: 48, border: "1.5px solid #E5E7EB", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", cursor: "pointer" }}
                        aria-label="Configurer"
                      >
                        <ChevronRight size={20} style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                      </button>
                    </div>

                    {/* Erreur de vérification réelle */}
                    {p.error && (
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 12px", marginTop: 10 }}>
                        <AlertCircle size={15} style={{ color: "#DC2626", flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.5 }}>{p.error}</p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {filteredPlatforms.length === 0 && (
              <div className="discovery-empty">
                <Search size={28} />
                <p>Aucune plateforme trouvée</p>
              </div>
            )}
          </div>
        )}

        {/* ── AUTOMATISATIONS ── */}
        {activeTab === "automation" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="discovery-stat-card" style={{ padding: 18, background: "linear-gradient(135deg, #7C3AED, #A855F7)", border: "none", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 16, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={24} style={{ color: "#fff" }} />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 900 }}>Pilote automatique</p>
                  <p style={{ fontSize: 12, opacity: 0.85 }}>{activeAutomations} automatisation{activeAutomations > 1 ? "s" : ""} active{activeAutomations > 1 ? "s" : ""} — Maria travaille pour vous 24/7</p>
                </div>
              </div>
            </div>

            {automations.map(a => {
              const Icon = a.icon;
              return (
                <article key={a.id} className="discovery-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={22} style={{ color: a.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 800 }}>{a.name}</p>
                    <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 1.45 }}>{a.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleAutomation(a.id)}
                    style={{
                      width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer",
                      background: a.enabled ? "#FF6B00" : "#E5E7EB",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                    aria-label={a.enabled ? "Désactiver" : "Activer"}
                  >
                    <span style={{
                      position: "absolute", top: 3, left: a.enabled ? 24 : 3,
                      width: 24, height: 24, borderRadius: "50%", background: "#fff",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)", transition: "left 0.2s",
                    }} />
                  </button>
                </article>
              );
            })}

            <div className="discovery-stat-card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Sparkles size={18} style={{ color: "#FF6B00", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
                <strong style={{ color: "#111827" }}>Conseil de Maria :</strong> activez au moins 3 automatisations
                pour transformer vos abonnés en clients. Les salons qui automatisent leurs DMs
                doublent leurs réservations en 30 jours.
              </p>
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {activeTab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="discovery-stat-card" style={{ padding: 20, background: "linear-gradient(135deg, #1A1A2E, #2D1B4E)", border: "none", color: "#fff" }}>
              <p className="discovery-eyebrow" style={{ marginBottom: 12 }}><BarChart3 size={14} /> PERFORMANCE · 30 JOURS</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Messages traités", value: connectedCount > 0 ? "1 248" : "—", icon: MessageCircle },
                  { label: "Réponses auto", value: connectedCount > 0 ? "1 186" : "—", icon: Bot },
                  { label: "Prospects générés", value: connectedCount > 0 ? "87" : "—", icon: Users },
                  { label: "RDV convertis", value: connectedCount > 0 ? "34" : "—", icon: TrendingUp },
                ].map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 14 }}>
                      <Icon size={18} style={{ color: "#FF9A3D", marginBottom: 8 }} />
                      <p style={{ fontSize: 22, fontWeight: 900 }}>{s.value}</p>
                      <p style={{ fontSize: 11, opacity: 0.7 }}>{s.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {connectedCount === 0 ? (
              <div className="discovery-empty">
                <BarChart3 size={28} />
                <p>Aucune donnée</p>
                <span>Connectez une plateforme pour voir vos statistiques.</span>
                <button className="discovery-cta" onClick={() => setActiveTab("platforms")} style={{ marginTop: 12 }}>
                  Connecter une plateforme
                </button>
              </div>
            ) : (
              <div className="discovery-card" style={{ padding: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  Plateformes actives
                </p>
                {platforms.filter(p => p.connected).map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: p.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <SocialIcon path={p.icon} size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</p>
                      <p style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>● En ligne{p.verifiedLabel ? ` · ${p.verifiedLabel}` : ""}</p>
                    </div>
                    <ChevronRight size={18} style={{ color: "#9CA3AF" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
