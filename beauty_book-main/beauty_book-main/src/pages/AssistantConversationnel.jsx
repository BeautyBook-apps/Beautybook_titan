// ─────────────────────────────────────────────────────────────────────────────
// Agent Social IA — Maria répond aux DMs et commentaires (remplace l'ancien
// builder Manychat : les automatisations à mot-clé sont SUPPRIMÉES).
//
// Nouveau principe : Grok suit les INSTRUCTIONS du salon (comme l'agent vocal
// IA) pour répondre aux DMs et commentaires Instagram / Facebook / WhatsApp,
// avec les VRAIES données du salon (prestations, tarifs, FAQ).
// En production, c'est la fonction Supabase `social-webhook` qui appelle Grok
// avec ces mêmes instructions (secret XAI_API_KEY requis côté Supabase).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Globe, BarChart3, Plus, Trash2, CheckCircle2, AlertCircle,
  Eye, EyeOff, ExternalLink, Shield, MessageCircle, Calendar, Mail, Link2,
  Send, RotateCcw, Download, Sparkles, Bot, Users, TrendingUp,
  BookOpen, Phone, MapPin, ChevronRight, Brain, Smartphone,
  Clock, RefreshCw,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { entities } from "@/api/entities";
import {
  startSocialOAuth, fetchSocialConnections, disconnectSocial,
  parseOAuthResult, isExpiringSoon,
} from "@/lib/socialOAuth";
import {
  buildKnowledge, loadFaq, addFaqEntry, updateFaqEntry, deleteFaqEntry,
} from "@/lib/mariaAssistant";
import { grokChat } from "@/lib/grok";
import { useTheme } from "@/hooks/useTheme";
import "./AssistantConversationnel.css";

/* ════════════════════════ Plateformes ════════════════════════ */

const PLATFORMS = [
  {
    id: "instagram", name: "Instagram",
    icon: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
    gradient: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)",
    desc: "Grok répond à vos DMs et commentaires Instagram",
    features: ["Réponses DM par IA", "Réponses commentaires par IA", "Capture d'emails", "Réservation assistée"],
    fields: [
      { key: "accessToken", label: "Token d'accès", placeholder: "EAA...", type: "password", link: "https://developers.facebook.com/tools/explorer/", required: true },
      { key: "businessId", label: "Business Account ID", placeholder: "17841400...", type: "text", link: "https://business.facebook.com/settings/", required: true },
    ],
  },
  {
    id: "facebook", name: "Facebook",
    icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    gradient: "linear-gradient(135deg, #1877F2, #0A5AC8)",
    desc: "Grok répond à vos messages Messenger et commentaires",
    features: ["Messenger par IA", "Commentaires par IA", "Capture d'emails", "Réservation assistée"],
    fields: [
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAA...", type: "password", link: "https://developers.facebook.com/tools/explorer/", required: true },
      { key: "pageId", label: "Page ID", placeholder: "123456789...", type: "text", link: "https://www.facebook.com/settings/pages/", required: true },
    ],
  },
  {
    id: "whatsapp", name: "WhatsApp Business",
    icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
    gradient: "linear-gradient(135deg, #25D366, #128C7E)",
    desc: "Grok discute avec vos prospects WhatsApp",
    features: ["Conversations par IA", "Capture d'emails", "Réservation assistée"],
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "123456789...", type: "text", link: "https://developers.facebook.com/apps/", required: true },
      { key: "accessToken", label: "Token permanent", placeholder: "EAA...", type: "password", link: "https://business.facebook.com/wa/manage/", required: true },
    ],
  },
];

const PLATFORM_LABELS = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp" };

function SocialIcon({ path, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const SOCIAL_STORAGE_KEY = "bb_social_connections";
function loadSavedConnections() {
  try { return JSON.parse(localStorage.getItem(SOCIAL_STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveConnection(id, keys, verifiedLabel) {
  try {
    const all = loadSavedConnections();
    all[id] = { keys, verifiedLabel, connectedAt: new Date().toISOString() };
    localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(all));
  } catch { /* stockage indisponible */ }
}
function removeConnection(id) {
  try {
    const all = loadSavedConnections();
    delete all[id];
    localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

const GRAPH_API = "https://graph.facebook.com/v21.0";
async function fetchJson(url, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally { clearTimeout(timer); }
}

/** Vérifie les identifiants saisis contre la vraie API de la plateforme. */
async function verifyPlatformCredentials(id, keys) {
  const get = (k) => (keys[k] || "").trim();
  try {
    if (id === "instagram") {
      const bid = get("businessId");
      const { res, data } = await fetchJson(`${GRAPH_API}/${encodeURIComponent(bid)}?fields=id,username,name&access_token=${encodeURIComponent(get("accessToken"))}`);
      if (data && data.error) throw new Error(`Instagram : ${data.error.message} (code ${data.error.code}).`);
      if (!res.ok || !data || !data.id) throw new Error("Instagram : réponse inattendue de l'API.");
      if (String(data.id) !== bid) throw new Error("Instagram : ce token ne correspond pas à ce Business Account ID.");
      return { ok: true, label: data.username ? `@${data.username}` : (data.name || bid) };
    }
    if (id === "facebook") {
      const pid = get("pageId");
      const { res, data } = await fetchJson(`${GRAPH_API}/${encodeURIComponent(pid)}?fields=id,name&access_token=${encodeURIComponent(get("pageAccessToken"))}`);
      if (data && data.error) throw new Error(`Facebook : ${data.error.message} (code ${data.error.code}).`);
      if (!res.ok || !data || !data.id) throw new Error("Facebook : réponse inattendue de l'API.");
      if (String(data.id) !== pid) throw new Error("Facebook : ce token ne correspond pas à cette Page ID.");
      return { ok: true, label: data.name || pid };
    }
    if (id === "whatsapp") {
      const pnid = get("phoneNumberId");
      const { res, data } = await fetchJson(`${GRAPH_API}/${encodeURIComponent(pnid)}?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(get("accessToken"))}`);
      if (data && data.error) throw new Error(`WhatsApp : ${data.error.message} (code ${data.error.code}).`);
      if (!res.ok || !data || !data.id) throw new Error("WhatsApp : réponse inattendue de l'API.");
      if (String(data.id) !== pnid) throw new Error("WhatsApp : ce token ne correspond pas à ce Phone Number ID.");
      return { ok: true, label: data.display_phone_number || data.verified_name || pnid };
    }
    throw new Error("Plateforme inconnue.");
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, message: "Délai dépassé : la plateforme ne répond pas. Vérifiez votre connexion et réessayez." };
    if (e instanceof TypeError) return { ok: false, message: "Impossible de joindre l'API de la plateforme depuis le navigateur (réseau ou restriction de l'API). La clé n'a pas pu être vérifiée : connexion refusée." };
    return { ok: false, message: e.message || "Échec de la vérification." };
  }
}

/* ════════════════════════ Cerveau de l'agent : instructions Grok ════════════════════════
   Comme l'agent vocal IA : pas de mot-clé, Grok SUIT ces instructions pour
   répondre aux DMs et commentaires, avec les vraies données du salon. */

const SOCIAL_CFG_KEY = (email) => `bb_social_agent:${String(email || "").toLowerCase()}`;

const TONES = [
  { id: "chaleureux", label: "Chaleureux & convivial" },
  { id: "pro", label: "Professionnel & rassurant" },
  { id: "fun", label: "Fun & décontracté" },
  { id: "luxe", label: "Premium & raffiné" },
];

const DEFAULT_SOCIAL_CFG = {
  enabled: true,
  tone: "chaleureux",
  instructions: "", // vide = modèle par défaut ci-dessous
  dm: { instagram: true, facebook: true, whatsapp: true },
  comments: { instagram: true, facebook: true },
};

function defaultSocialInstructions(salonName) {
  return `Tu es Maria, la community manager IA du salon « ${salonName || "notre salon"} ».
Tu réponds aux messages privés (DM) et aux commentaires Instagram / Facebook / WhatsApp du salon.

RÈGLES D'OR
- Réponds TOUJOURS en français, de façon naturelle comme un humain.
- Réponses COURTES, style message : 1 à 4 phrases maximum. Jamais de pavé.
- Utilise UNIQUEMENT les informations fournies ci-dessous (prestations, tarifs, durées, horaires, adresse, FAQ).
  Si tu ne sais pas, dis-le honnêtement et propose de demander directement au salon — n'invente JAMAIS un prix, un créneau ou une information.
- Si la personne veut réserver ou demande un créneau : annonce le VRAI tarif de la prestation, puis guide-la étape par étape (quel service ? quelle date ? quelle heure ?) comme une vraie réceptionniste.
- Pour un COMMENTAIRE public : réponds publiquement avec chaleur et invite à continuer en message privé pour les détails (« je vous écris en DM »).
- Pour un DM : réponds directement, pose UNE question à la fois pour faire avancer la conversation.
- N'utilise les emojis qu'avec modération. Pas de hashtags sauf si la personne en met.
- Ne demande JAMAIS de mot de passe, de code ou d'information bancaire.
- Si quelqu'un est agressif ou insultant, reste polie et propose de passer au salon.`;
}

/**
 * Construit le prompt système complet de l'agent social :
 * instructions du salon + VRAIES données (prestations, FAQ, infos salon).
 * Utilisé à l'identique par le simulateur (cette page) et par la fonction
 * Supabase `social-webhook` en production.
 */
export function buildSocialInstructions({ salonName, services, faq, info, cfg }) {
  const c = { ...DEFAULT_SOCIAL_CFG, ...(cfg || {}) };
  const toneLabel = (TONES.find((t) => t.id === c.tone) || TONES[0]).label;
  const base = (c.instructions || "").trim() || defaultSocialInstructions(salonName);

  const svcLines = (services || []).slice(0, 40).map((s) =>
    `- ${s.name}${s.price != null ? ` : ${s.price}€` : ""}${s.duration ? ` (${s.duration} min)` : ""}`
  );
  const faqLines = (faq || []).slice(0, 20).map((f) => `Q: ${f.question}\nR: ${f.answer}`);
  const infoBits = [];
  if (info?.address) infoBits.push(`Adresse : ${info.address}`);
  if (info?.phone) infoBits.push(`Téléphone : ${info.phone}`);
  if (info?.hoursText) infoBits.push(`Horaires : ${info.hoursText}`);

  return `${base}

TONALITÉ SOUHAITÉE : ${toneLabel}.

DONNÉES RÉELLES DU SALON (à utiliser telles quelles, ne rien inventer) :
${svcLines.length ? `Prestations :\n${svcLines.join("\n")}` : "Prestations : non renseignées — invite à demander au salon."}
${faqLines.length ? `\nQuestions fréquentes :\n${faqLines.join("\n")}` : ""}
${infoBits.length ? `\n${infoBits.join("\n")}` : ""}

Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`;
}

function loadSocialConfig(email) {
  try {
    const raw = localStorage.getItem(SOCIAL_CFG_KEY(email));
    if (raw) return { ...DEFAULT_SOCIAL_CFG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SOCIAL_CFG };
}
function saveSocialConfigLocal(email, cfg) {
  try { localStorage.setItem(SOCIAL_CFG_KEY(email), JSON.stringify(cfg)); } catch { /* ignore */ }
}
/** Persiste la config côté Supabase (table social_agent_config) pour que le
 *  webhook la lise en production. Échec silencieux si la table n'existe pas
 *  (migration non exécutée) : le local reste la source de vérité. */
async function persistSocialConfig(email, cfg) {
  if (!email) return false;
  try {
    const { error } = await supabase.from("social_agent_config").upsert({
      pro_email: String(email).toLowerCase(),
      enabled: !!cfg.enabled,
      instructions: cfg.instructions || "",
      tone: cfg.tone || "chaleureux",
      dm_enabled: !!(cfg.dm?.instagram || cfg.dm?.facebook || cfg.dm?.whatsapp),
      comments_enabled: !!(cfg.comments?.instagram || cfg.comments?.facebook),
      platforms: { dm: cfg.dm || {}, comments: cfg.comments || {} },
      updated_at: new Date().toISOString(),
    }, { onConflict: "pro_email" });
    return !error;
  } catch { return false; }
}

/** Petit interrupteur on/off. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label || "Activer / désactiver"}
      className={`sa-toggle${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="sa-toggle-knob" />
    </button>
  );
}

/* ════════════════════════ Onglet Cerveau : instructions + canaux ════════════════════════ */

function AgentBrainTab({ cfg, setCfg, salonName, onSave, saving, saved, servicesCount }) {
  const [showDefault, setShowDefault] = useState(false);
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const setChannel = (kind, platform, v) =>
    setCfg((c) => ({ ...c, [kind]: { ...(c[kind] || {}), [platform]: v } }));

  const channels = [
    { id: "instagram", name: "Instagram", kinds: ["dm", "comments"] },
    { id: "facebook", name: "Facebook", kinds: ["dm", "comments"] },
    { id: "whatsapp", name: "WhatsApp", kinds: ["dm"] },
  ];
  const KIND_LABEL = { dm: "Messages privés", comments: "Commentaires" };

  return (
    <div className="sa-stack">
      {/* Interrupteur master */}
      <div className="sa-card sa-master">
        <div className="sa-master-info">
          <div className="sa-master-ico"><Brain size={20} /></div>
          <div>
            <strong>Agent social IA {cfg.enabled ? "activé" : "en pause"}</strong>
            <span>
              {cfg.enabled
                ? "Grok répond à vos DMs et commentaires en suivant vos instructions."
                : "L'agent ne répond plus : reprenez la main manuellement."}
            </span>
          </div>
        </div>
        <Toggle checked={!!cfg.enabled} onChange={(v) => set({ enabled: v })} label="Activer ou mettre en pause l'agent social" />
      </div>

      {/* Instructions */}
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <p className="sa-eyebrow">Cerveau de l'agent</p>
            <h3>Instructions suivies par Grok</h3>
          </div>
          <span className="sa-badge"><Sparkles size={12} /> Comme l'agent vocal</span>
        </div>
        <p className="sa-muted">
          Fini les mots-clés : décrivez comment Maria doit se comporter et Grok s'en charge,
          avec vos <strong>{servicesCount} prestations réelles</strong>, vos tarifs et votre FAQ.
          Vide = le modèle par défaut ci-dessous.
        </p>
        <textarea
          className="sa-textarea"
          rows={9}
          value={cfg.instructions || ""}
          onChange={(e) => set({ instructions: e.target.value })}
          placeholder={defaultSocialInstructions(salonName)}
        />
        <div className="sa-row">
          <label className="sa-field">
            <span>Tonalité</span>
            <select value={cfg.tone} onChange={(e) => set({ tone: e.target.value })}>
              {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <button type="button" className="sa-btn ghost" onClick={() => setShowDefault((s) => !s)}>
            {showDefault ? "Masquer le modèle" : "Voir le modèle par défaut"}
          </button>
        </div>
        {showDefault && <pre className="sa-code">{defaultSocialInstructions(salonName)}</pre>}
        <button type="button" className="sa-btn primary" onClick={onSave} disabled={saving}>
          <CheckCircle2 size={15} /> {saving ? "Enregistrement…" : "Enregistrer les instructions"}
        </button>
        {saved && <p className="sa-saved">✓ Enregistré — utilisé dès le prochain message.</p>}
      </div>

      {/* Canaux */}
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <p className="sa-eyebrow">Canaux</p>
            <h3>Où l'agent répond</h3>
          </div>
        </div>
        <div className="sa-channels">
          {channels.map((p) => (
            <div key={p.id} className="sa-channel">
              <strong>{p.name}</strong>
              <div className="sa-channel-rows">
                {p.kinds.map((k) => (
                  <div key={k} className="sa-channel-row">
                    <span>{KIND_LABEL[k]}</span>
                    <Toggle
                      checked={!!(cfg[k] && cfg[k][p.id])}
                      onChange={(v) => setChannel(k, p.id, v)}
                      label={`${KIND_LABEL[k]} ${p.name}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="sa-btn primary" onClick={onSave} disabled={saving}>
          <CheckCircle2 size={15} /> {saving ? "Enregistrement…" : "Enregistrer les canaux"}
        </button>
      </div>

      {/* Comment ça marche */}
      <div className="sa-card sa-how">
        <p className="sa-eyebrow">En conditions réelles</p>
        <h3>Comment l'agent répond vraiment</h3>
        <ol className="sa-steps">
          <li><strong>1.</strong> Un client vous écrit (DM) ou commente sur Instagram / Facebook.</li>
          <li><strong>2.</strong> Le webhook <code>social-webhook</code> reçoit le message instantanément.</li>
          <li><strong>3.</strong> Grok génère la réponse avec <strong>vos instructions</strong> + vos vraies données.</li>
          <li><strong>4.</strong> La réponse est envoyée automatiquement. Si le client veut réserver, l'agent le guide jusqu'à la réservation réelle.</li>
        </ol>
        <p className="sa-muted small">
          Prérequis : fonction <code>social-webhook</code> déployée sur Supabase, webhook Meta configuré,
          secret <code>XAI_API_KEY</code> ajouté (<code>supabase secrets set XAI_API_KEY=…</code>) et
          migration <code>20260930_social_agent_config.sql</code> exécutée.
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════ Onglet Simulateur : tester l'agent en direct ════════════════════════ */

const SIM_PLATFORMS = [
  { id: "instagram", name: "Instagram", gradient: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)", icon: PLATFORMS[0].icon },
  { id: "facebook", name: "Facebook", gradient: "linear-gradient(135deg,#1877F2,#0A5AC8)", icon: PLATFORMS[1].icon },
  { id: "whatsapp", name: "WhatsApp", gradient: "linear-gradient(135deg,#25D366,#128C7E)", icon: PLATFORMS[2].icon },
];
const SIM_KINDS = [
  { id: "dm", label: "Message privé" },
  { id: "comment", label: "Commentaire" },
];
const SIM_SUGGESTIONS = [
  "Salut ! Vous faites les tresses ? C'est combien ?",
  "Bonjour, je peux avoir un rdv samedi ?",
  "Vous êtes ouverts le dimanche ?",
  "C'est quoi votre adresse ?",
];

function SimulatorTab({ salonName, services, faq, info, cfg }) {
  const [platform, setPlatform] = useState("instagram");
  const [kind, setKind] = useState("dm");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const idRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking]);

  const reset = () => { setMsgs([]); setError(""); idRef.current = 0; };

  const send = async (text) => {
    const t = (text || "").trim();
    if (!t || thinking) return;
    setError("");
    idRef.current += 1;
    setMsgs((m) => [...m, { id: idRef.current, from: "user", text: t }]);
    setInput("");
    setThinking(true);
    try {
      const system = buildSocialInstructions({ salonName, services, faq, info, cfg });
      const context = kind === "comment"
        ? `[Contexte : commentaire public ${PLATFORM_LABELS[platform]} — réponds publiquement avec chaleur et invite à continuer en DM]\n${t}`
        : `[Contexte : message privé ${PLATFORM_LABELS[platform]}]\n${t}`;
      const reply = await grokChat([{ role: "user", content: context }], {
        system, max_tokens: 400, feature: "social",
      });
      idRef.current += 1;
      setMsgs((m) => [...m, { id: idRef.current, from: "bot", text: (reply || "").trim() }]);
    } catch (e) {
      setError(e.message || "L'agent n'a pas pu répondre. Vérifiez la clé XAI_API_KEY.");
    } finally {
      setThinking(false);
    }
  };

  const plat = SIM_PLATFORMS.find((p) => p.id === platform);

  return (
    <div className="sa-sim-layout">
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <p className="sa-eyebrow">Bac à sable</p>
            <h3>Testez votre agent en direct</h3>
          </div>
          <button type="button" className="sa-btn ghost small" onClick={reset}>
            <RotateCcw size={13} /> Recommencer
          </button>
        </div>
        <p className="sa-muted">
          Écrivez comme un vrai client : Grok répond avec <strong>vos instructions</strong> et
          vos <strong>données réelles</strong> — exactement comme en production.
        </p>

        <div className="sa-sim-pickers">
          <div className="sa-chip-row">
            {SIM_PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sa-chip-pick${platform === p.id ? " active" : ""}`}
                onClick={() => { setPlatform(p.id); }}
              >
                <span className="sa-chip-dot" style={{ background: p.gradient }} />
                {p.name}
              </button>
            ))}
          </div>
          <div className="sa-chip-row">
            {SIM_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`sa-chip-pick${kind === k.id ? " active" : ""}`}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {msgs.length === 0 && !thinking && (
          <div className="sa-suggest">
            <p className="sa-muted small">Essayez par exemple :</p>
            {SIM_SUGGESTIONS.map((s, i) => (
              <button key={i} type="button" className="sa-suggest-btn" onClick={() => send(s)}>
                « {s} »
              </button>
            ))}
          </div>
        )}

        <div className="sa-sim-inputrow">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
            placeholder={kind === "comment" ? "Écrivez un commentaire…" : "Écrivez un DM…"}
            disabled={thinking}
          />
          <button type="button" className="sa-send" onClick={() => send(input)} disabled={thinking || !input.trim()} aria-label="Envoyer">
            <Send size={16} />
          </button>
        </div>
        {error && <p className="sa-error"><AlertCircle size={14} /> {error}</p>}
      </div>

      {/* ── Téléphone ── */}
      <div className="sa-phone-wrap">
        <div className="sa-phone">
          <div className="sa-phone-notch" />
          <div className="sa-phone-header" style={{ background: plat.gradient }}>
            <SocialIcon path={plat.icon} size={20} />
            <div>
              <strong>{salonName || "Votre salon"}</strong>
              <span>{kind === "comment" ? "Commentaires" : "Messages privés"} · simulation</span>
            </div>
          </div>
          <div className="sa-phone-body" ref={scrollRef}>
            {msgs.length === 0 && !thinking && (
              <p className="sa-phone-empty">Vos échanges avec l'agent apparaîtront ici.</p>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`sa-bubble ${m.from}`}>
                <p>{m.text}</p>
              </div>
            ))}
            {thinking && (
              <div className="sa-bubble bot typing">
                <span className="sa-dot" /><span className="sa-dot" /><span className="sa-dot" />
              </div>
            )}
          </div>
          <div className="sa-phone-footer">
            <span>Maria écrit avec vos instructions…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ Onglet Plateformes ════════════════════════ */

function PlatformsTab() {
  const [expandedId, setExpandedId] = useState(null);
  const [validating, setValidating] = useState(null);
  const [platforms, setPlatforms] = useState(() => {
    const saved = loadSavedConnections();
    return PLATFORMS.map((p) => {
      const s = saved[p.id];
      return { ...p, connected: !!s, keys: s?.keys || {}, verifiedLabel: s?.verifiedLabel || null, showKeys: {}, error: null };
    });
  });
  const [oauthConnections, setOauthConnections] = useState({});
  const [oauthStarting, setOauthStarting] = useState(null);
  const [oauthBanner, setOauthBanner] = useState(null);

  useEffect(() => {
    const result = parseOAuthResult();
    if (result) {
      const pname = PLATFORMS.find((p) => p.id === result.platform)?.name || result.platform;
      setOauthBanner(result.status === "success"
        ? { ok: true, text: `${pname} connecté avec succès.` }
        : { ok: false, text: result.message ? decodeURIComponent(result.message) : `Échec de la connexion ${pname}.` });
    }
    fetchSocialConnections().then(setOauthConnections).catch(() => {});
  }, []);

  const areKeysValid = (p) => p.fields.filter((f) => f.required).every((f) => p.keys[f.key]?.trim());

  const toggleConnect = async (id) => {
    const platform = platforms.find((p) => p.id === id);
    if (platform.connected) {
      removeConnection(id);
      setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, connected: false, verifiedLabel: null, error: null } : p)));
      return;
    }
    if (!areKeysValid(platform)) return;
    setValidating(id);
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, error: null } : p)));
    const result = await verifyPlatformCredentials(id, platform.keys);
    setValidating(null);
    if (result.ok) {
      saveConnection(id, platform.keys, result.label);
      setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, connected: true, verifiedLabel: result.label, error: null } : p)));
    } else {
      setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, connected: false, verifiedLabel: null, error: result.message } : p)));
    }
  };

  const setKey = (id, key, value) => {
    removeConnection(id);
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, keys: { ...p.keys, [key]: value }, connected: false, verifiedLabel: null, error: null } : p)));
  };

  const handleOAuthConnect = async (id) => {
    setOauthStarting(id);
    setOauthBanner(null);
    try {
      await startSocialOAuth(id);
    } catch (e) {
      setOauthBanner({ ok: false, text: e.message || "Connexion impossible." });
      setOauthStarting(null);
    }
  };

  const handleOAuthDisconnect = async (id) => {
    try {
      await disconnectSocial(id);
      setOauthConnections((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) {
      setOauthBanner({ ok: false, text: e.message || "Déconnexion impossible." });
    }
  };

  const toggleShowKey = (id, key) => {
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, showKeys: { ...p.showKeys, [key]: !p.showKeys[key] } } : p)));
  };

  const connectedCount = platforms.filter((p) => p.connected).length + Object.keys(oauthConnections).length;

  return (
    <div className="sa-stack">
      {oauthBanner && (
        <div className={`sa-banner ${oauthBanner.ok ? "ok" : "err"}`}>
          {oauthBanner.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p>{oauthBanner.text}</p>
        </div>
      )}
      <div className="sa-statusbar">
        <span className={`sa-dot-live ${connectedCount > 0 ? "on" : ""}`} />
        <span>
          {connectedCount > 0
            ? `${connectedCount} plateforme${connectedCount > 1 ? "s" : ""} connectée${connectedCount > 1 ? "s" : ""} — l'agent peut répondre en conditions réelles`
            : "Connectez une plateforme pour activer les réponses réelles de l'agent"}
        </span>
      </div>

      {platforms.map((p) => {
        const isExpanded = expandedId === p.id;
        const keysValid = areKeysValid(p);
        const oauth = oauthConnections[p.id];
        return (
          <article key={p.id} className="sa-card sa-plat">
            <div className="sa-plat-banner" style={{ background: p.gradient }}>
              <div className="sa-plat-logo"><SocialIcon path={p.icon} size={22} /></div>
              <div>
                <h3>{p.name}</h3>
                <p>{p.desc}</p>
              </div>
              {(p.connected || oauth) && <span className="sa-plat-active">ACTIF</span>}
            </div>
            <div className="sa-plat-body">
              {p.connected && p.verifiedLabel && (
                <p className="sa-verified">✓ Compte vérifié : {p.verifiedLabel}</p>
              )}
              <div className="sa-tags">
                {p.features.map((f, i) => <span key={i} className="sa-tag">{f}</span>)}
              </div>

              {isExpanded && (
                <div className="sa-keys">
                  <p className="sa-subhead">Clés API (vérifiées auprès de la plateforme)</p>
                  {p.fields.map((field) => {
                    const hasValue = p.keys[field.key]?.trim();
                    return (
                      <div key={field.key} className="sa-keyrow">
                        <div className="sa-keys-head">
                          <p>{field.label}</p>
                          {field.link && (
                            <a href={field.link} target="_blank" rel="noopener noreferrer">Obtenir <ExternalLink size={12} /></a>
                          )}
                        </div>
                        <div className={`sa-keys-input ${hasValue ? "ok" : ""}`}>
                          <input
                            type={p.showKeys[field.key] ? "text" : field.type}
                            value={p.keys[field.key] || ""}
                            onChange={(e) => setKey(p.id, field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                          {hasValue && <CheckCircle2 size={14} className="sa-keys-check" />}
                          <button type="button" onClick={() => toggleShowKey(p.id, field.key)} aria-label="Afficher / masquer">
                            {p.showKeys[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <p className="sa-note"><Shield size={13} /> Clés stockées localement sur cet appareil uniquement.</p>
                </div>
              )}

              {oauth ? (
                <div className="sa-oauth-ok">
                  <CheckCircle2 size={20} />
                  <div>
                    <p><strong>Connecté via {p.name}</strong></p>
                    <p className="sa-muted small">
                      {oauth.username || oauth.display_name || "Compte vérifié"}
                      {oauth.expires_at && <> · {isExpiringSoon(oauth) ? "à renouveler bientôt" : `valide jusqu'au ${new Date(oauth.expires_at).toLocaleDateString("fr-FR")}`}</>}
                    </p>
                  </div>
                  <button type="button" className="sa-btn danger-ghost small" onClick={() => handleOAuthDisconnect(p.id)}>Déconnecter</button>
                </div>
              ) : (
                <>
                  <button type="button" className="sa-btn primary full" onClick={() => handleOAuthConnect(p.id)} disabled={oauthStarting === p.id}>
                    <SocialIcon path={p.icon} size={18} />
                    {oauthStarting === p.id ? "Redirection…" : `Se connecter avec ${p.name}`}
                  </button>
                  <p className="sa-or">
                    Connexion sécurisée via {p.name} — ou{" "}
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      saisir les clés API manuellement
                    </button>
                  </p>
                  <div className="sa-plat-actions">
                    <button
                      type="button"
                      className={`sa-btn ${p.connected ? "danger-ghost" : "secondary"} full`}
                      onClick={() => toggleConnect(p.id)}
                      disabled={validating === p.id || (!p.connected && !keysValid)}
                    >
                      {validating === p.id ? "Validation…" : p.connected ? "Déconnecter" : "Connecter avec Maria IA"}
                    </button>
                    <button type="button" className="sa-icon-btn" aria-label="Configurer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      <ChevronRight size={20} className={isExpanded ? "rot" : ""} />
                    </button>
                  </div>
                </>
              )}
              {p.error && (
                <div className="sa-banner err"><AlertCircle size={15} /><p>{p.error}</p></div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ════════════════════════ Onglet Connaissances ════════════════════════ */

function KnowledgeTab({ knowledge, proEmail, onFaqChange, onResync, syncing }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const k = knowledge || {};
  const hasProfile = !!(k.salonName || (k.services && k.services.length) || k.hoursText);

  const submitAdd = async () => {
    setErr("");
    if (!q.trim() || !a.trim()) { setErr("La question et la réponse sont obligatoires."); return; }
    setBusy(true);
    try {
      await addFaqEntry(proEmail, q, a);
      setQ(""); setA("");
      onFaqChange(await loadFaq(proEmail));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const startEdit = (f) => { setEditingId(f.id); setEditQ(f.question); setEditA(f.answer); setErr(""); };
  const submitEdit = async () => {
    setErr("");
    setBusy(true);
    try {
      const list = await updateFaqEntry(proEmail, editingId, editQ, editA);
      setEditingId(null);
      onFaqChange(list);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const remove = async (id) => {
    if (!window.confirm("Supprimer cette question / réponse ?")) return;
    setBusy(true);
    try {
      const list = await deleteFaqEntry(proEmail, id);
      onFaqChange(list);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="sa-stack">
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <p className="sa-eyebrow">Ce que Maria sait</p>
            <h3>Synchronisé depuis votre profil pro</h3>
          </div>
          <button type="button" className="sa-btn ghost small" onClick={onResync} disabled={syncing}>
            <RotateCcw size={14} /> {syncing ? "Synchronisation…" : "Resynchroniser"}
          </button>
        </div>
        <p className="sa-badge-line">
          <span className="sa-badge"><CheckCircle2 size={12} /> Données réelles</span>
          <span className="sa-muted small">ProfilPro, services, horaires — utilisés tels quels par Grok.</span>
        </p>
        {!hasProfile ? (
          <p className="sa-empty">Aucune donnée de salon trouvée pour {proEmail || "ce compte"}. Complétez votre profil pro pour que Maria réponde avec vos informations.</p>
        ) : (
          <div className="sa-kv">
            {k.salonName && <div className="sa-kv-row"><span><BookOpen size={13} /> Salon</span><strong>{k.salonName}</strong></div>}
            {k.bio && <div className="sa-kv-row"><span><Sparkles size={13} /> Présentation</span><strong className="sa-kv-text">{k.bio}</strong></div>}
            {(k.address || k.city) && <div className="sa-kv-row"><span><MapPin size={13} /> Adresse</span><strong>{[k.address, k.city].filter(Boolean).join(", ")}</strong></div>}
            {k.phone && <div className="sa-kv-row"><span><Phone size={13} /> Téléphone</span><strong>{k.phone}</strong></div>}
            {k.hoursText && (
              <div className="sa-kv-row"><span><Clock size={13} /> Horaires</span>
                <strong className="sa-kv-text">{k.hoursText}{k.openNow === true ? " · 🟢 ouvert actuellement" : k.openNow === false ? " · fermé actuellement" : ""}</strong>
              </div>
            )}
          </div>
        )}
        {k.services?.length > 0 && (
          <>
            <p className="sa-subhead">Prestations ({k.services.length}) — prix et durées réels</p>
            <ul className="sa-service-list">
              {k.services.map((s) => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <span className="sa-service-meta">{s.price != null ? `${s.price}€` : "—"}{s.duration ? ` · ${s.duration} min` : ""}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="sa-card">
        <p className="sa-eyebrow">Questions fréquentes</p>
        <h3>Vos réponses personnalisées</h3>
        <p className="sa-badge-line">
          <span className="sa-badge"><MessageCircle size={12} /> Réponses manuelles</span>
          <span className="sa-muted small">Grok les utilise en priorité dans ses réponses.</span>
        </p>

        <div className="sa-faq-form">
          <label className="sa-field">
            <span>Question</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. Acceptez-vous les enfants ?" />
          </label>
          <label className="sa-field">
            <span>Réponse de Maria</span>
            <textarea value={a} onChange={(e) => setA(e.target.value)} rows={2} placeholder="Ex. Bien sûr ! Les enfants sont les bienvenus…" />
          </label>
          {err && <p className="sa-error">{err}</p>}
          <button type="button" className="sa-btn primary" onClick={submitAdd} disabled={busy}>
            <Plus size={14} /> {busy ? "Ajout…" : "Ajouter"}
          </button>
        </div>

        <ul className="sa-faq-list">
          {(k.faq || []).map((f) => (
            <li key={f.id} className="sa-faq-item">
              {editingId === String(f.id) || editingId === f.id ? (
                <div className="sa-faq-edit">
                  <input value={editQ} onChange={(e) => setEditQ(e.target.value)} aria-label="Question" />
                  <textarea value={editA} onChange={(e) => setEditA(e.target.value)} rows={2} aria-label="Réponse" />
                  <div className="sa-faq-actions">
                    <button type="button" className="sa-btn primary small" onClick={submitEdit} disabled={busy}>Enregistrer</button>
                    <button type="button" className="sa-btn ghost small" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="sa-faq-q">« {f.question} »</p>
                  <p className="sa-faq-a">{f.answer}</p>
                  <div className="sa-faq-actions">
                    <button type="button" className="sa-btn ghost small" onClick={() => startEdit(f)}>Modifier</button>
                    <button type="button" className="sa-icon-btn danger" aria-label="Supprimer" onClick={() => remove(f.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {(k.faq || []).length === 0 && (
          <p className="sa-empty">Aucune question personnalisée pour l'instant.</p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════ Onglet Statistiques (données réelles uniquement) ════════════════════════ */

function StatsTab({ events, realBookings, onExportCsv }) {
  const [leads, setLeads] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || "";
        if (!email) return;
        const { data } = await supabase
          .from("social_leads")
          .select("id,email,pseudo,platform,created_at")
          .eq("user_email", email)
          .order("created_at", { ascending: false })
          .limit(50);
        setLeads(data || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const count = (type) => events.filter((e) => e.event_type === type).length;
  const replies = count("agent_reply");
  const emails = leads.length;
  const bookings = realBookings;
  const completion = replies > 0 ? Math.round(((emails + bookings) / replies) * 100) : 0;

  const cards = [
    { label: "Réponses envoyées par l'agent", value: replies, icon: Bot },
    { label: "Emails capturés", value: emails, icon: Mail },
    { label: "Réservations via l'assistant", value: bookings, icon: Calendar },
  ];

  return (
    <div className="sa-stack">
      <div className="sa-stat-grid">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="sa-stat-card">
              <Icon size={18} />
              <p className="sa-stat-value">{c.value}</p>
              <p className="sa-stat-label">{c.label}</p>
            </div>
          );
        })}
      </div>
      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <p className="sa-eyebrow">Performance</p>
            <h3>Taux de conversion : {completion} %</h3>
          </div>
          <TrendingUp size={22} className="sa-muted" />
        </div>
        <p className="sa-muted small">
          Part des conversations ayant abouti à un email capturé ou une réservation.
          0 au début, c'est normal : les chiffres se construisent avec vos vraies conversations.
        </p>
      </div>

      <div className="sa-card">
        <div className="sa-card-head">
          <div>
            <p className="sa-eyebrow">Prospects</p>
            <h3>Leads récents ({leads.length})</h3>
          </div>
          {leads.length > 0 && (
            <button type="button" className="sa-btn secondary small" onClick={onExportCsv}>
              <Download size={14} /> Exporter CSV
            </button>
          )}
        </div>
        {leads.length === 0 ? (
          <p className="sa-empty">Aucun lead pour l'instant. Les emails capturés par l'agent apparaîtront ici.</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Prénom</th>
                  <th>Plateforme</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>{l.email}</td>
                    <td>{l.pseudo || "—"}</td>
                    <td>{PLATFORM_LABELS[l.platform] || l.platform || "—"}</td>
                    <td>{new Date(l.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════ Onglet « Site web » : chatbot embarquable ════════════════════════ */

function encodeWidgetCode(email) {
  try {
    return btoa(unescape(encodeURIComponent(String(email || "").trim().toLowerCase())))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch { return ""; }
}

function SiteWebTab({ proEmail, salonName }) {
  const [copied, setCopied] = useState(null);
  const code = encodeWidgetCode(proEmail);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const widgetUrl = code ? `${origin}/maria-site/${code}` : "";
  const iframeCode = code
    ? `<iframe\n  src="${widgetUrl}"\n  title="Chatbot ${salonName || "Maria"}"\n  style="width:100%;height:640px;max-height:85vh;border:1px solid #fed7aa;border-radius:18px;"\n  allow="clipboard-write">\n</iframe>`
    : "";

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="sa-stack">
      <div className="sa-card">
        <p className="sa-eyebrow">Chatbot IA sur votre site</p>
        <h3>Maria sur le site web du salon</h3>
        <p className="sa-muted small" style={{ marginTop: 6 }}>
          Intégrez Maria à votre site internet : vos visiteurs discutent avec elle,
          posent leurs questions (prestations, tarifs, horaires — vos vraies données)
          et <strong>réservent directement</strong>. Chaque réservation arrive dans
          « Gestion agenda » avec le badge <strong>Site web</strong>.
        </p>
      </div>

      {!code ? (
        <p className="sa-empty">Connectez-vous avec votre compte pro pour générer le chatbot de votre salon.</p>
      ) : (
        <>
          <div className="sa-card">
            <div className="sa-card-head">
              <div>
                <p className="sa-eyebrow">Étape 1</p>
                <h3>Lien direct du chatbot</h3>
              </div>
              <button type="button" className="sa-btn secondary small" onClick={() => copy(widgetUrl, "url")}>
                {copied === "url" ? "Copié ✓" : "Copier le lien"}
              </button>
            </div>
            <p className="sa-code">{widgetUrl}</p>
          </div>

          <div className="sa-card">
            <div className="sa-card-head">
              <div>
                <p className="sa-eyebrow">Étape 2</p>
                <h3>Code à intégrer sur votre site</h3>
              </div>
              <button type="button" className="sa-btn secondary small" onClick={() => copy(iframeCode, "iframe")}>
                {copied === "iframe" ? "Copié ✓" : "Copier le code"}
              </button>
            </div>
            <pre className="sa-code sa-code-block">{iframeCode}</pre>
          </div>

          <div className="sa-card">
            <p className="sa-eyebrow">Aperçu en direct</p>
            <h3 style={{ marginBottom: 10 }}>Ce que verront vos visiteurs</h3>
            <div className="sa-site-preview">
              <iframe src={widgetUrl} title="Aperçu du chatbot Maria" loading="lazy" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════ Composant principal ════════════════════════ */

const TABS = [
  { id: "cerveau", label: "Cerveau", icon: Brain },
  { id: "simulateur", label: "Simulateur", icon: Smartphone },
  { id: "plateformes", label: "Plateformes", icon: Globe },
  { id: "connaissances", label: "Connaissances", icon: BookOpen },
  { id: "siteweb", label: "Site web", icon: ExternalLink },
  { id: "stats", label: "Stats", icon: BarChart3 },
];

function newId() {
  try { return crypto.randomUUID(); } catch { return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`; }
}

export default function AssistantConversationnel() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("cerveau");
  const [proEmail, setProEmail] = useState("");
  const [salonName, setSalonName] = useState("");
  const [services, setServices] = useState([]);
  const [knowledge, setKnowledge] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Config de l'agent social (instructions Grok + canaux)
  const [cfg, setCfg] = useState({ ...DEFAULT_SOCIAL_CFG });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [events, setEvents] = useState([]);
  const [realBookings, setRealBookings] = useState(0);

  /* ── Chargement initial ── */
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || "";
        setProEmail(email);
        if (!email) { setLoading(false); return; }

        setCfg(loadSocialConfig(email));
        // Si la table existe, la version serveur prime (plus récente).
        try {
          const { data: row } = await supabase
            .from("social_agent_config")
            .select("*")
            .eq("pro_email", email.toLowerCase())
            .maybeSingle();
          if (row) {
            const serverCfg = {
              enabled: row.enabled !== false,
              tone: row.tone || "chaleureux",
              instructions: row.instructions || "",
              dm: row.platforms?.dm || DEFAULT_SOCIAL_CFG.dm,
              comments: row.platforms?.comments || DEFAULT_SOCIAL_CFG.comments,
            };
            setCfg(serverCfg);
            saveSocialConfigLocal(email, serverCfg);
          }
        } catch { /* table absente : repli local */ }

        let sName = "";
        try {
          const profiles = await entities.ProfilPro.filter({ user_email: email }, "-created_at", 1).catch(() => []);
          const p = profiles && profiles[0];
          if (p) sName = p.salon_name || [p.prenom, p.nom].filter(Boolean).join(" ") || "";
        } catch { /* ignore */ }
        setSalonName(sName);

        try {
          const svcs = await entities.Service.filter({ pro_email: email, status: "actif" }, "-created_at", 100).catch(() => []);
          setServices((svcs || []).map((s) => ({
            id: s.id, name: s.name || s.title || "Prestation",
            price: s.price ?? null, duration: s.duration_min || s.duration || 60,
          })));
        } catch { setServices([]); }

        setSyncing(true);
        try { setKnowledge(await buildKnowledge(email)); } catch { /* ignore */ }
        setSyncing(false);

        // Événements réels du webhook (social_events)
        try {
          const { data: evs } = await supabase
            .from("social_events")
            .select("id,event_type,platform,created_at")
            .eq("user_email", email)
            .order("created_at", { ascending: false })
            .limit(300);
          setEvents(evs || []);
        } catch { /* ignore */ }

        try {
          const { count } = await supabase
            .from("Reservation")
            .select("id", { count: "exact", head: true })
            .eq("pro_email", email)
            .eq("source", "maria_assistant");
          if (typeof count === "number") setRealBookings(count);
        } catch { /* ignore */ }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resyncKnowledge = async () => {
    if (!proEmail) return;
    setSyncing(true);
    try {
      const k = await buildKnowledge(proEmail);
      setKnowledge(k);
      setSalonName(k.salonName || salonName);
    } catch { /* ignore */ }
    setSyncing(false);
  };

  const handleSaveCfg = async () => {
    if (!proEmail || saving) return;
    setSaving(true);
    saveSocialConfigLocal(proEmail, cfg);
    await persistSocialConfig(proEmail, cfg);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2600);
  };

  const exportCsv = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || "";
      const { data } = await supabase
        .from("social_leads")
        .select("email,pseudo,platform,created_at")
        .eq("user_email", email)
        .order("created_at", { ascending: false })
        .limit(500);
      const header = "email;prenom;plateforme;date\n";
      const rows = (data || []).map((l) =>
        [l.email, l.pseudo || "", PLATFORM_LABELS[l.platform] || l.platform || "", l.created_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      ).join("\n");
      const blob = new Blob(["﻿" + header + rows], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-maria-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const replies = events.filter((e) => e.event_type === "agent_reply").length;

  const info = {
    address: [knowledge?.address, knowledge?.city].filter(Boolean).join(", "),
    phone: knowledge?.phone || "",
    hoursText: knowledge?.hoursText || "",
  };

  return (
    <div className="sa-page" data-theme={theme}>
      {/* ── HERO ── */}
      <header className="sa-hero">
        <div className="sa-hero-glow" />
        <div className="sa-topline">
          <span className="sa-eyebrow light"><span className={`sa-dot-live ${cfg.enabled ? "on" : "paused"}`} /> MARIA IA · AGENT SOCIAL</span>
          <button type="button" className="sa-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Retour
          </button>
        </div>
        <h1>Votre community manager<br /><em>qui ne dort jamais.</em></h1>
        <p className="sa-subtitle">
          Grok répond à vos DMs et commentaires en suivant <strong>vos instructions</strong>,
          avec vos <strong>vraies prestations</strong>, tarifs et FAQ. Fini les mots-clés.
        </p>
        <div className="sa-hero-stats">
          <span><Bot size={14} /> {cfg.enabled ? "Agent actif" : "Agent en pause"}</span>
          <span><MessageCircle size={14} /> {replies} réponses envoyées</span>
          <span><Calendar size={14} /> {realBookings} réservations via l'assistant</span>
        </div>
        <nav className="sa-tabs" aria-label="Sections de l'agent social">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`sa-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="sa-main">
        {loading ? (
          <p className="sa-empty">Chargement de l'agent…</p>
        ) : (
          <>
            {activeTab === "cerveau" && (
              <AgentBrainTab
                cfg={cfg}
                setCfg={setCfg}
                salonName={salonName}
                onSave={handleSaveCfg}
                saving={saving}
                saved={saved}
                servicesCount={services.length}
              />
            )}
            {activeTab === "simulateur" && (
              <SimulatorTab
                salonName={salonName}
                services={services}
                faq={knowledge?.faq || []}
                info={info}
                cfg={cfg}
              />
            )}
            {activeTab === "plateformes" && <PlatformsTab />}
            {activeTab === "connaissances" && (
              <KnowledgeTab
                knowledge={knowledge}
                proEmail={proEmail}
                onFaqChange={(list) => setKnowledge((k) => ({ ...(k || {}), faq: list }))}
                onResync={resyncKnowledge}
                syncing={syncing}
              />
            )}
            {activeTab === "siteweb" && <SiteWebTab proEmail={proEmail} salonName={salonName} />}
            {activeTab === "stats" && (
              <StatsTab events={events} realBookings={realBookings} onExportCsv={exportCsv} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
