// ─────────────────────────────────────────────────────────────────────────────
// Assistant conversationnel Maria — remplace AI Social Media (/social-media).
// Builder style Manychat : automatisations DM (déclencheurs mot-clé), aperçu
// téléphone interactif, capture d'emails, réservation RÉELLE (Gestion agenda +
// Google Agenda), base de connaissances, plateformes connectées, statistiques.
// Aucun bouton factice : tout ce qui est cliquable fait quelque chose de réel.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Zap, Globe, BarChart3, Plus, Trash2, CheckCircle2, AlertCircle,
  Eye, EyeOff, ExternalLink, Shield, MessageCircle, Calendar, Mail, Link2,
  Clock, Send, RotateCcw, Download, Sparkles, Bot, Users, TrendingUp,
  BookOpen, Phone, MapPin, ChevronRight,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { entities } from "@/api/entities";
import {
  startSocialOAuth, fetchSocialConnections, disconnectSocial,
  parseOAuthResult, isExpiringSoon,
} from "@/lib/socialOAuth";
import {
  buildKnowledge, answerQuestion, detectBookingIntent, EMAIL_RE,
  createAssistantReservation, pushToGoogleCalendar, bookingConfirmationText,
  formatDateFr, loadFaq, addFaqEntry, updateFaqEntry, deleteFaqEntry,
} from "@/lib/mariaAssistant";
import { getQuestionnaireForService } from "@/lib/questionnaires";
import "./AssistantConversationnel.css";

/* ════════════════════════ Plateformes (code repris de l'ancienne page) ════════════════════════ */

const PLATFORMS = [
  {
    id: "instagram", name: "Instagram",
    icon: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
    gradient: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)",
    desc: "DMs et commentaires Instagram automatisés",
    features: ["Réponses auto DM", "Réponses commentaires", "Capture d'emails", "Réservation auto"],
    fields: [
      { key: "accessToken", label: "Token d'accès", placeholder: "EAA...", type: "password", link: "https://developers.facebook.com/tools/explorer/", required: true },
      { key: "businessId", label: "Business Account ID", placeholder: "17841400...", type: "text", link: "https://business.facebook.com/settings/", required: true },
    ],
  },
  {
    id: "facebook", name: "Facebook",
    icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    gradient: "linear-gradient(135deg, #1877F2, #0A5AC8)",
    desc: "Messenger et commentaires automatisés",
    features: ["Messenger auto-reply", "Comment auto-reply", "Capture d'emails", "Réservation auto"],
    fields: [
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAA...", type: "password", link: "https://developers.facebook.com/tools/explorer/", required: true },
      { key: "pageId", label: "Page ID", placeholder: "123456789...", type: "text", link: "https://www.facebook.com/settings/pages/", required: true },
    ],
  },
  {
    id: "whatsapp", name: "WhatsApp Business",
    icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
    gradient: "linear-gradient(135deg, #25D366, #128C7E)",
    desc: "Prospects et réservations via WhatsApp",
    features: ["Messages texte", "Capture d'emails", "Réservation auto"],
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "123456789...", type: "text", link: "https://developers.facebook.com/apps/", required: true },
      { key: "accessToken", label: "Token permanent", placeholder: "EAA...", type: "password", link: "https://business.facebook.com/wa/manage/", required: true },
    ],
  },
];

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
async function fetchJson(url, { headers, timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
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

/* ════════════════════════ Modèle des automatisations ════════════════════════ */

const PLATFORM_LABELS = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp" };
const TRIGGER_LABELS = {
  comment_keyword: "Commentaire avec mot-clé",
  dm_keyword: "DM avec mot-clé",
  new_follower: "Nouvel abonné",
};

const defaultSteps = (salonName) => ({
  opening: {
    enabled: true,
    message: `Salut 👋 Merci pour votre message ! Je suis Maria, l'assistante de ${salonName || "notre salon"}. Je peux répondre à vos questions et vous aider à réserver votre prochain rendez-vous.`,
    button_label: "Je veux réserver",
  },
  follow_ask: {
    enabled: false,
    message: "Avant de continuer, suivez notre compte pour ne rien rater de nos nouveautés 💛",
  },
  email_ask: {
    enabled: true,
    message: "Avec plaisir ! Pour vous envoyer la confirmation de réservation, quel est votre email ? 💌",
  },
  booking: {
    enabled: true,
    message: "Parfait, je peux vous réserver un créneau tout de suite — quel service vous intéresse ?",
  },
  link: {
    enabled: true,
    message: "Et voici le lien pour retrouver toutes nos prestations 👇",
    link_type: "url",
    link_url: "",
    service_id: "",
    button_label: "Voir nos prestations",
  },
  followup: {
    enabled: true,
    delay: "24h",
    message: "Petit rappel 💛 Votre créneau vous attend — répondez-moi quand vous voulez pour réserver !",
  },
});

const seedAutomation = (salonName) => ({
  id: `seed-${Date.now()}`,
  platform: "instagram",
  name: "Mot-clé RDV → réservation directe",
  trigger_type: "comment_keyword",
  trigger_keyword: "rdv",
  enabled: true,
  steps: defaultSteps(salonName),
  created_at: new Date().toISOString(),
});

const automationsKey = (email) => `bb_assistant_automations:${email}`;
const leadsKey = (email) => `bb_assistant_leads:${email}`;
const eventsKey = (email) => `bb_assistant_events:${email}`;

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/** Petit interrupteur on/off. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || "Activer / désactiver"}
      className={`ac-toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ac-toggle-knob" />
    </button>
  );
}

/* ════════════════════════ Aperçu téléphone interactif ════════════════════════ */

function PhonePreview({ automation, knowledge, proEmail, salonName, services, onLead, onEvent, onBooking, replayKey }) {
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [interactive, setInteractive] = useState(null); // {kind:'buttons'|'email'|'booking'}
  const [freeText, setFreeText] = useState("");
  const [freeError, setFreeError] = useState("");
  const timers = useRef([]);
  const waiter = useRef(null);
  const idRef = useRef(0);
  const scrollRef = useRef(null);
  const bookingDoneRef = useRef(false);
  const leadRef = useRef(null);
  const live = useRef({});
  live.current = { automation, knowledge, proEmail, salonName, services };

  const push = (m) => {
    idRef.current += 1;
    setMsgs((prev) => [...prev.slice(-60), { ...m, _id: idRef.current }]);
  };
  const later = (ms) => new Promise((res) => { const t = setTimeout(res, ms); timers.current.push(t); });
  const logEv = (ev) => { try { onEvent && onEvent(ev); } catch { /* ignore */ } };

  // Mise à jour INSTANTANÉE des textes déjà affichés quand le builder change.
  useEffect(() => {
    if (!automation?.steps) return;
    const s = automation.steps;
    setMsgs((prev) => prev.map((m) => {
      if (m.bind === "opening.message") return { ...m, text: s.opening.message };
      if (m.bind === "opening.button") return { ...m, label: s.opening.button_label };
      if (m.bind === "follow_ask.message") return { ...m, text: s.follow_ask.message };
      if (m.bind === "email_ask.message") return { ...m, text: s.email_ask.message };
      if (m.bind === "booking.message") return { ...m, text: s.booking.message };
      if (m.bind === "link.message") return { ...m, text: s.link.message };
      if (m.bind === "link.button") return { ...m, label: s.link.button_label };
      if (m.bind === "followup.message") return { ...m, text: s.followup.message };
      return m;
    }));
    setInteractive((prev) => {
      if (!prev) return prev;
      if (prev.kind === "buttons") return { ...prev, buttons: [{ id: "opening", label: s.opening.button_label }] };
      return prev;
    });
  }, [automation]);

  // Scroll auto vers le bas.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, interactive]);

  // ── Moteur du scénario ──
  useEffect(() => {
    let cancelled = false;
    idRef.current = 0;
    setMsgs([]);
    setTyping(false);
    setInteractive(null);
    bookingDoneRef.current = false;
    leadRef.current = null;

    const steps = live.current.automation?.steps;
    const platform = live.current.automation?.platform || "instagram";
    const automationId = live.current.automation?.id || null;
    if (!steps) return undefined;

    logEv({ event_type: "preview_start", platform, automation_id: automationId });

    const botSay = async (text, bind) => {
      if (cancelled) return;
      setTyping(true);
      await later(900);
      if (cancelled) return;
      setTyping(false);
      push({ from: "bot", kind: "text", text, bind });
      await later(450);
    };
    const waitFor = () => new Promise((res) => { waiter.current = res; });
    const linkUrlFor = () => {
      const lk = steps.link;
      if (lk.link_type === "service" && lk.service_id) return `${window.location.origin}/service/${lk.service_id}`;
      return (lk.link_url || "").trim();
    };

    const runBookingFlow = async (introText) => {
      if (introText) await botSay(introText, "booking.message");
      const p = waitFor();
      setInteractive({ kind: "booking" });
      const booking = await p;
      setInteractive(null);
      if (cancelled || !booking) return false;
      push({ from: "me", kind: "text", text: `Je réserve : ${booking.serviceName}, le ${formatDateFr(booking.date)} à ${booking.time}` });
      setTyping(true);
      try {
        const reservation = await onBooking(booking);
        if (cancelled) return false;
        setTyping(false);
        bookingDoneRef.current = true;
        await botSay(bookingConfirmationText(reservation, reservation.googleResult));
        logEv({ event_type: "booking_confirmed", platform, automation_id: automationId, meta: { service: reservation.service_name, date: reservation.date } });
      } catch (e) {
        if (cancelled) return false;
        setTyping(false);
        await botSay("Oups, la réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon.");
      }
      return true;
    };

    const run = async () => {
      // 1) DM d'ouverture
      await botSay(steps.opening.message, "opening.message");
      if (cancelled) return;
      if (steps.opening.enabled) {
        const p = waitFor();
        setInteractive({ kind: "buttons", buttons: [{ id: "opening", label: steps.opening.button_label }] });
        const clicked = await p;
        setInteractive(null);
        if (cancelled || !clicked) return;
        push({ from: "me", kind: "text", text: steps.opening.button_label, bind: "opening.button-echo" });
        logEv({ event_type: "button_click", platform, automation_id: automationId, meta: { button: "opening" } });
        await later(400);
      }
      // 2) Demande de follow (message seul → avance automatiquement)
      if (steps.follow_ask.enabled) {
        await botSay(steps.follow_ask.message, "follow_ask.message");
        if (cancelled) return;
        await later(1400);
      }
      // 3) Demande d'email
      if (steps.email_ask.enabled) {
        await botSay(steps.email_ask.message, "email_ask.message");
        if (cancelled) return;
        const p = waitFor();
        setInteractive({ kind: "email" });
        const data = await p;
        setInteractive(null);
        if (cancelled || !data) return;
        push({ from: "me", kind: "text", text: data.email });
        leadRef.current = { email: data.email, pseudo: data.pseudo };
        try { await onLead({ email: data.email, pseudo: data.pseudo, platform, automation_id: automationId }); } catch { /* déjà loggé */ }
        await botSay(`Merci${data.pseudo ? ` ${data.pseudo}` : ""} ! ✅ C'est bien noté.`);
        if (cancelled) return;
      }
      // 4) Réservation (mini-parcours réel)
      if (steps.booking.enabled && !bookingDoneRef.current) {
        const ok = await runBookingFlow(steps.booking.message);
        if (cancelled || !ok) return;
      }
      // 5) DM avec lien
      if (steps.link.enabled) {
        const url = linkUrlFor();
        await botSay(steps.link.message, "link.message");
        if (cancelled) return;
        if (url) {
          push({ from: "bot", kind: "linkbtn", text: "", label: steps.link.button_label, url, bind: "link.button" });
          await later(600);
        }
      }
      // 6) Relance (délai simulé accéléré dans l'aperçu)
      if (steps.followup.enabled) {
        push({ from: "sys", kind: "text", text: `(aperçu accéléré : en conditions réelles, la relance partirait dans ${steps.followup.delay})` });
        await later(5000);
        if (cancelled) return;
        await botSay(steps.followup.message, "followup.message");
        if (cancelled) return;
        logEv({ event_type: "followup_sent", platform, automation_id: automationId });
      }
    };
    run();

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const w = waiter.current;
      waiter.current = null;
      if (w) w(null);
      setInteractive(null);
      setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  /* ── Interactions ── */

  const clickOpeningButton = () => {
    const w = waiter.current;
    waiter.current = null;
    if (w) w({ id: "opening" });
  };

  const clickLinkButton = (url) => {
    const { automation: a } = live.current;
    logEv({ event_type: "link_click", platform: a?.platform, automation_id: a?.id, meta: { url } });
    window.open(url, "_blank", "noopener");
  };

  const submitEmail = (email, pseudo, setErr) => {
    if (!EMAIL_RE.test(email.trim())) {
      setErr("Cet email ne semble pas valide — vérifiez-le 🙂");
      return;
    }
    const w = waiter.current;
    waiter.current = null;
    if (w) w({ email: email.trim(), pseudo: (pseudo || "").trim() });
  };

  const submitBooking = (booking, setErr) => {
    const errs = [];
    if (!booking.serviceId) errs.push("Choisissez un service.");
    if (!booking.date) errs.push("Choisissez une date.");
    if (!booking.time) errs.push("Choisissez une heure.");
    if (!(booking.name || "").trim()) errs.push("Indiquez votre prénom.");
    if (String(booking.phone || "").replace(/\D/g, "").length < 8) errs.push("Numéro de téléphone incomplet.");
    if (errs.length) {
      setErr(errs[0]);
      return;
    }
    const svc = (live.current.services || []).find((s) => String(s.id) === String(booking.serviceId));
    const w = waiter.current;
    waiter.current = null;
    if (w) w({ ...booking, serviceName: svc ? svc.name : "Prestation", service: svc, email: leadRef.current?.email || "" });
  };

  // Question libre : Maria répond avec les VRAIES données du salon.
  const submitFreeText = async () => {
    const text = freeText.trim();
    if (!text || typing) return;
    setFreeText("");
    setFreeError("");
    push({ from: "me", kind: "text", text });
    const { knowledge: k, automation: a } = live.current;
    setTyping(true);
    await later(900);
    setTyping(false);
    if (detectBookingIntent(text) && !bookingDoneRef.current && a?.steps?.booking?.enabled) {
      push({ from: "bot", kind: "text", text: "Parfait, je peux vous réserver un créneau tout de suite 💛" });
      await later(300);
      const p = new Promise((res) => { waiter.current = res; });
      setInteractive({ kind: "booking" });
      const booking = await p;
      setInteractive(null);
      if (!booking) return;
      push({ from: "me", kind: "text", text: `Je réserve : ${booking.serviceName}, le ${formatDateFr(booking.date)} à ${booking.time}` });
      setTyping(true);
      try {
        const reservation = await onBooking(booking);
        setTyping(false);
        bookingDoneRef.current = true;
        push({ from: "bot", kind: "text", text: bookingConfirmationText(reservation, reservation.googleResult) });
        logEv({ event_type: "booking_confirmed", platform: a?.platform, automation_id: a?.id, meta: { via: "free_text", service: reservation.service_name } });
      } catch {
        setTyping(false);
        push({ from: "bot", kind: "text", text: "Oups, la réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon." });
      }
      return;
    }
    const ans = answerQuestion(text, k);
    push({ from: "bot", kind: "text", text: ans.text });
    if (ans.type === "booking" && a?.steps?.booking?.enabled && !bookingDoneRef.current) {
      await later(600);
      const p = new Promise((res) => { waiter.current = res; });
      setInteractive({ kind: "booking" });
      const booking = await p;
      setInteractive(null);
      if (!booking) return;
      push({ from: "me", kind: "text", text: `Je réserve : ${booking.serviceName}, le ${formatDateFr(booking.date)} à ${booking.time}` });
      setTyping(true);
      try {
        const reservation = await onBooking(booking);
        setTyping(false);
        bookingDoneRef.current = true;
        push({ from: "bot", kind: "text", text: bookingConfirmationText(reservation, reservation.googleResult) });
        logEv({ event_type: "booking_confirmed", platform: a?.platform, automation_id: a?.id, meta: { via: "free_text", service: reservation.service_name } });
      } catch {
        setTyping(false);
        push({ from: "bot", kind: "text", text: "Oups, la réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon." });
      }
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const initial = (salonName || "M").trim().charAt(0).toUpperCase();

  return (
    <div className="ac-phone-wrap">
      <div className="ac-phone">
        <div className="ac-phone-notch" />
        <div className="ac-phone-status">
          <span>11:48</span>
          <span className="ac-phone-status-icons">●●●</span>
        </div>
        <div className="ac-phone-header">
          <span className="ac-phone-back">‹</span>
          <span className="ac-phone-avatar">{initial}</span>
          <span className="ac-phone-name">{salonName || "Votre salon"}</span>
          <span className="ac-phone-preview-tag">Aperçu</span>
        </div>

        <div className="ac-phone-chat" ref={scrollRef}>
          {msgs.length === 0 && !typing && (
            <p className="ac-phone-hint">La conversation démarre…</p>
          )}
          {msgs.map((m) => {
            if (m.from === "sys") return <p key={m._id} className="ac-sys">{m.text}</p>;
            if (m.from === "me") return <div key={m._id} className="ac-bubble me">{m.text}</div>;
            if (m.kind === "linkbtn") {
              return (
                <div key={m._id} className="ac-bubble bot">
                  <button type="button" className="ac-chat-linkbtn" onClick={() => clickLinkButton(m.url)}>
                    {m.label || "Ouvrir le lien"} <Link2 size={13} />
                  </button>
                </div>
              );
            }
            return <div key={m._id} className="ac-bubble bot">{m.text}</div>;
          })}
          {typing && (
            <div className="ac-bubble bot ac-typing"><span /><span /><span /></div>
          )}

          {/* Boutons configurés (cliquables → font avancer la conversation) */}
          {interactive?.kind === "buttons" && (
            <div className="ac-interactive">
              {interactive.buttons.map((b) => (
                <button key={b.id} type="button" className="ac-chat-btn" onClick={clickOpeningButton}>
                  {b.label}
                </button>
              ))}
            </div>
          )}

          {/* Capture d'email : vrai champ + validation */}
          {interactive?.kind === "email" && (
            <EmailCaptureForm onSubmit={submitEmail} />
          )}

          {/* Mini-parcours de réservation réel */}
          {interactive?.kind === "booking" && (
            <BookingForm services={services} todayStr={todayStr} onSubmit={submitBooking} />
          )}
        </div>

        {/* Zone de saisie fonctionnelle : question libre → Maria répond */}
        <div className="ac-phone-inputbar">
          <input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitFreeText(); }}
            placeholder="Posez votre question…"
            aria-label="Poser une question à Maria"
          />
          <button type="button" onClick={submitFreeText} aria-label="Envoyer">
            <Send size={16} />
          </button>
        </div>
        {freeError && <p className="ac-phone-error">{freeError}</p>}
      </div>
    </div>
  );
}


function EmailCaptureForm({ onSubmit }) {
  const [email, setEmail] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="ac-interactive">
      <div className="ac-form">
        <input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="Votre prénom (optionnel)"
          aria-label="Prénom"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(email, pseudo, setErr); }}
          placeholder="votre@email.com"
          type="email"
          aria-label="Email"
        />
        {err && <p className="ac-form-err">{err}</p>}
        <button type="button" className="ac-chat-btn primary" onClick={() => onSubmit(email, pseudo, setErr)}>
          Envoyer <Send size={13} />
        </button>
      </div>
    </div>
  );
}

function BookingForm({ services, todayStr, onSubmit }) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState({});
  const [err, setErr] = useState("");

  const selectedService = (services || []).find((s) => String(s.id) === String(serviceId)) || null;
  // Mêmes questions que l'étape 2 du parcours web, selon la catégorie du service.
  const questionnaire = getQuestionnaireForService(selectedService || {});

  const pickService = (id) => {
    setServiceId(id);
    setAnswers({}); // on change de service → on réinitialise les réponses
  };
  const toggleAnswer = (qid, opt) => {
    setAnswers((prev) => ({ ...prev, [qid]: opt }));
  };

  return (
    <div className="ac-interactive">
      <div className="ac-form">
        <label>
          <span>Service</span>
          <select value={serviceId} onChange={(e) => pickService(e.target.value)} aria-label="Service">
            <option value="">— Choisir —</option>
            {(services || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.price != null ? ` — ${s.price}€` : ""}</option>
            ))}
          </select>
        </label>
        {selectedService && questionnaire.questions.length > 0 && (
          <div className="ac-q">
            <p className="ac-q-title">
              Vos préférences — {questionnaire.label} <span className="ac-q-optional">(optionnel)</span>
            </p>
            {questionnaire.tip && <p className="ac-q-tip">💡 {questionnaire.tip}</p>}
            {questionnaire.questions.map((q) => (
              <div key={q.id} className="ac-q-item">
                <p className="ac-q-label">{q.question}</p>
                <div className="ac-q-chips">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`ac-q-chip${answers[q.id] === opt ? " selected" : ""}`}
                      onClick={() => toggleAnswer(q.id, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="ac-form-row">
          <label>
            <span>Date</span>
            <input type="date" value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          </label>
          <label>
            <span>Heure</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Heure" />
          </label>
        </div>
        <label>
          <span>Votre prénom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Aïcha" aria-label="Prénom" />
        </label>
        <label>
          <span>Téléphone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 …" inputMode="tel" aria-label="Téléphone" />
        </label>
        {err && <p className="ac-form-err">{err}</p>}
        <button
          type="button"
          className="ac-chat-btn primary"
          onClick={() => onSubmit({ serviceId, date, time, name: name.trim(), phone: phone.trim(), answers }, setErr)}
        >
          <Calendar size={13} /> Confirmer la réservation
        </button>
        {(services || []).length === 0 && (
          <p className="ac-form-note">Aucun service actif trouvé pour ce salon.</p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════ Onglet Automatisations : liste + builder ════════════════════════ */

function AutomationList({ automations, selectedId, onSelect, onCreate, onDelete, onToggle }) {
  return (
    <div className="ac-list">
      <button type="button" className="ac-new-auto" onClick={onCreate}>
        <Plus size={16} /> Nouvelle automatisation
      </button>
      {automations.map((a) => (
        <div key={a.id} className={`ac-auto-item ${a.id === selectedId ? "selected" : ""}`} onClick={() => onSelect(a.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onSelect(a.id); }}>
          <div className="ac-auto-item-main">
            <p className="ac-auto-item-name">{a.name}</p>
            <p className="ac-auto-item-meta">
              <span className="ac-chip platform">{PLATFORM_LABELS[a.platform] || a.platform}</span>
              {a.trigger_type !== "new_follower" && a.trigger_keyword && (
                <span className="ac-chip keyword">« {a.trigger_keyword} »</span>
              )}
              {a.trigger_type === "new_follower" && <span className="ac-chip keyword">nouvel abonné</span>}
            </p>
          </div>
          <div className="ac-auto-item-actions" onClick={(e) => e.stopPropagation()}>
            <Toggle checked={!!a.enabled} onChange={() => onToggle(a.id)} label={`Activer ${a.name}`} />
            <button type="button" className="ac-icon-btn danger" aria-label={`Supprimer ${a.name}`} onClick={() => onDelete(a.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
      {automations.length === 0 && (
        <p className="ac-empty">Aucune automatisation. Créez-en une pour commencer.</p>
      )}
    </div>
  );
}

function StepCard({ title, hint, enabled, onToggle, children }) {
  return (
    <div className="ac-step">
      <div className="ac-step-head">
        <div>
          <p className="ac-step-title">{title}</p>
          {hint && <p className="ac-step-hint">{hint}</p>}
        </div>
        <Toggle checked={!!enabled} onChange={onToggle} label={title} />
      </div>
      {enabled && <div className="ac-step-body">{children}</div>}
    </div>
  );
}

function AutomationsBuilder({ draft, setDraft, services, dirty, saving, onSave, replayKey, setReplayKey, knowledge, proEmail, salonName, onLead, onEvent, onBooking }) {
  if (!draft) return <p className="ac-empty">Sélectionnez une automatisation.</p>;
  const s = draft.steps;
  const setStep = (key, patch) =>
    setDraft((d) => ({ ...d, steps: { ...d.steps, [key]: { ...d.steps[key], ...patch } } }));
  const setField = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const linkUrl = s.link.link_type === "service" && s.link.service_id
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/service/${s.link.service_id}`
    : (s.link.link_url || "").trim();

  return (
    <div className="ac-builder">
      {/* ── Carte Déclencheur ── */}
      <div className="ac-card">
        <p className="ac-card-eyebrow">Déclencheur</p>
        <label className="ac-field">
          <span>Nom de l'automatisation</span>
          <input value={draft.name} onChange={(e) => setField({ name: e.target.value })} placeholder="Ex. Mot-clé RDV → réservation" />
        </label>
        <div className="ac-field-row">
          <label className="ac-field">
            <span>Plateforme</span>
            <select value={draft.platform} onChange={(e) => setField({ platform: e.target.value })}>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="ac-field">
            <span>Type de déclencheur</span>
            <select value={draft.trigger_type} onChange={(e) => setField({ trigger_type: e.target.value })}>
              <option value="comment_keyword">Commentaire avec mot-clé</option>
              <option value="dm_keyword">DM avec mot-clé</option>
              <option value="new_follower">Nouvel abonné</option>
            </select>
          </label>
        </div>
        {draft.trigger_type !== "new_follower" && (
          <label className="ac-field">
            <span>Mot-clé déclencheur</span>
            <input value={draft.trigger_keyword} onChange={(e) => setField({ trigger_keyword: e.target.value })} placeholder="Ex. rdv" />
          </label>
        )}
        <div className="ac-save-row">
          <button type="button" className="ac-btn primary" onClick={onSave} disabled={saving || !dirty}>
            {saving ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré ✓"}
          </button>
          <button type="button" className="ac-btn ghost" onClick={() => setReplayKey((k) => k + 1)}>
            <RotateCcw size={14} /> Rejouer l'aperçu
          </button>
        </div>
      </div>

      {/* ── Ils recevront ── */}
      <p className="ac-section-title">Ils recevront</p>

      <StepCard title="Un DM d'ouverture" hint="Premier message envoyé quand le déclencheur se produit." enabled={s.opening.enabled} onToggle={() => setStep("opening", { enabled: !s.opening.enabled })}>
        <label className="ac-field">
          <span>Message</span>
          <textarea value={s.opening.message} onChange={(e) => setStep("opening", { message: e.target.value })} rows={3} />
        </label>
        <label className="ac-field">
          <span>Libellé du bouton</span>
          <input value={s.opening.button_label} onChange={(e) => setStep("opening", { button_label: e.target.value })} placeholder="Ex. Je veux réserver" />
        </label>
      </StepCard>

      <StepCard title="Un DM demandant de vous suivre avant de recevoir le lien" enabled={s.follow_ask.enabled} onToggle={() => setStep("follow_ask", { enabled: !s.follow_ask.enabled })}>
        <label className="ac-field">
          <span>Message</span>
          <textarea value={s.follow_ask.message} onChange={(e) => setStep("follow_ask", { message: e.target.value })} rows={2} />
        </label>
      </StepCard>

      <StepCard title="Un DM demandant leur email" hint="L'email est enregistré comme prospect (lead)." enabled={s.email_ask.enabled} onToggle={() => setStep("email_ask", { enabled: !s.email_ask.enabled })}>
        <label className="ac-field">
          <span>Message</span>
          <textarea value={s.email_ask.message} onChange={(e) => setStep("email_ask", { message: e.target.value })} rows={2} />
        </label>
      </StepCard>

      {/* ── Et ensuite ── */}
      <p className="ac-section-title">Et ensuite, ils recevront</p>

      <StepCard title="Une proposition de réservation" hint="Mini-parcours : service, date, heure, prénom, téléphone → vraie réservation dans votre agenda." enabled={s.booking.enabled} onToggle={() => setStep("booking", { enabled: !s.booking.enabled })}>
        <label className="ac-field">
          <span>Message</span>
          <textarea value={s.booking.message} onChange={(e) => setStep("booking", { message: e.target.value })} rows={2} />
        </label>
        <p className="ac-note">
          <Calendar size={13} /> La réservation est créée pour de vrai dans « Gestion agenda »
          (statut « en attente ») et poussée vers Google Agenda si le salon l'a connecté
          via la page Réceptionniste IA.
        </p>
      </StepCard>

      <StepCard title="Un DM avec un lien" enabled={s.link.enabled} onToggle={() => setStep("link", { enabled: !s.link.enabled })}>
        <label className="ac-field">
          <span>Message</span>
          <textarea value={s.link.message} onChange={(e) => setStep("link", { message: e.target.value })} rows={2} />
        </label>
        <div className="ac-field-row">
          <label className="ac-field">
            <span>Type de lien</span>
            <select value={s.link.link_type} onChange={(e) => setStep("link", { link_type: e.target.value })}>
              <option value="url">URL libre</option>
              <option value="service">Service du salon</option>
            </select>
          </label>
          <label className="ac-field">
            <span>Libellé du bouton</span>
            <input value={s.link.button_label} onChange={(e) => setStep("link", { button_label: e.target.value })} placeholder="Ex. Voir nos prestations" />
          </label>
        </div>
        {s.link.link_type === "url" ? (
          <label className="ac-field">
            <span>URL</span>
            <input value={s.link.link_url} onChange={(e) => setStep("link", { link_url: e.target.value })} placeholder="https://…" inputMode="url" />
          </label>
        ) : (
          <label className="ac-field">
            <span>Service du salon (données réelles)</span>
            <select value={s.link.service_id} onChange={(e) => setStep("link", { service_id: e.target.value })}>
              <option value="">— Choisir un service —</option>
              {(services || []).map((sv) => (
                <option key={sv.id} value={sv.id}>{sv.name}{sv.price != null ? ` — ${sv.price}€` : ""}</option>
              ))}
            </select>
          </label>
        )}
        {linkUrl && (
          <p className="ac-note"><Link2 size={13} /> Lien : {linkUrl}</p>
        )}
      </StepCard>

      <StepCard title="Un DM de relance" hint="Envoyé si la personne n'a pas réservé." enabled={s.followup.enabled} onToggle={() => setStep("followup", { enabled: !s.followup.enabled })}>
        <div className="ac-field-row">
          <label className="ac-field">
            <span>Délai</span>
            <select value={s.followup.delay} onChange={(e) => setStep("followup", { delay: e.target.value })}>
              <option value="1h">1 heure</option>
              <option value="24h">24 heures</option>
            </select>
          </label>
        </div>
        <label className="ac-field">
          <span>Message</span>
          <textarea value={s.followup.message} onChange={(e) => setStep("followup", { message: e.target.value })} rows={2} />
        </label>
      </StepCard>

    </div>
  );
}

/* ════════════════════════ Onglet Base de connaissances ════════════════════════ */

function KnowledgeTab({ knowledge, proEmail, onFaqChange, onResync, syncing }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const k = knowledge || {};
  const hasProfile = !!(k.salonName || k.services.length || k.hoursText);

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
    <div className="ac-knowledge">
      {/* ── Données synchronisées (réelles) ── */}
      <div className="ac-card">
        <div className="ac-card-head">
          <div>
            <p className="ac-card-eyebrow">Ce que Maria sait</p>
            <h3>Synchronisé depuis votre profil pro</h3>
          </div>
          <button type="button" className="ac-btn ghost" onClick={onResync} disabled={syncing}>
            <RotateCcw size={14} /> {syncing ? "Synchronisation…" : "Resynchroniser"}
          </button>
        </div>
        <p className="ac-badge-line">
          <span className="ac-badge real"><CheckCircle2 size={12} /> Données réelles</span>
          <span className="ac-muted">Mises à jour depuis votre ProfilPro, vos services et vos horaires.</span>
        </p>
        {!hasProfile ? (
          <p className="ac-empty">Aucune donnée de salon trouvée pour {proEmail || "ce compte"}. Complétez votre profil pro pour que Maria réponde avec vos informations.</p>
        ) : (
          <div className="ac-kv">
            {k.salonName && <div className="ac-kv-row"><span><BookOpen size={13} /> Salon</span><strong>{k.salonName}</strong></div>}
            {k.bio && <div className="ac-kv-row"><span><Sparkles size={13} /> Présentation</span><strong className="ac-kv-text">{k.bio}</strong></div>}
            {(k.address || k.city) && <div className="ac-kv-row"><span><MapPin size={13} /> Adresse</span><strong>{[k.address, k.city].filter(Boolean).join(", ")}</strong></div>}
            {k.phone && <div className="ac-kv-row"><span><Phone size={13} /> Téléphone</span><strong>{k.phone}</strong></div>}
            {k.hoursText && (
              <div className="ac-kv-row"><span><Clock size={13} /> Horaires</span>
                <strong className="ac-kv-text">{k.hoursText}{k.openNow === true ? " · 🟢 ouvert actuellement" : k.openNow === false ? " · fermé actuellement" : ""}</strong>
              </div>
            )}
          </div>
        )}
        {k.services?.length > 0 && (
          <>
            <p className="ac-subhead">Prestations ({k.services.length}) — prix et durées réels</p>
            <ul className="ac-service-list">
              {k.services.map((s) => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <span className="ac-service-meta">{s.price != null ? `${s.price}€` : "—"}{s.duration ? ` · ${s.duration} min` : ""}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── FAQ personnalisées ── */}
      <div className="ac-card">
        <p className="ac-card-eyebrow">Questions fréquentes</p>
        <h3>Vos réponses personnalisées</h3>
        <p className="ac-badge-line">
          <span className="ac-badge manual"><MessageCircle size={12} /> Réponses manuelles</span>
          <span className="ac-muted">Maria les utilise en priorité quand une question ressemble à l'une d'elles.</span>
        </p>

        <div className="ac-faq-form">
          <label className="ac-field">
            <span>Question</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. Acceptez-vous les enfants ?" />
          </label>
          <label className="ac-field">
            <span>Réponse de Maria</span>
            <textarea value={a} onChange={(e) => setA(e.target.value)} rows={2} placeholder="Ex. Bien sûr ! Les enfants sont les bienvenus…" />
          </label>
          {err && <p className="ac-form-err">{err}</p>}
          <button type="button" className="ac-btn primary" onClick={submitAdd} disabled={busy}>
            <Plus size={14} /> {busy ? "Ajout…" : "Ajouter"}
          </button>
        </div>

        <ul className="ac-faq-list">
          {(k.faq || []).map((f) => (
            <li key={f.id} className="ac-faq-item">
              {editingId === String(f.id) || editingId === f.id ? (
                <div className="ac-faq-edit">
                  <input value={editQ} onChange={(e) => setEditQ(e.target.value)} aria-label="Question" />
                  <textarea value={editA} onChange={(e) => setEditA(e.target.value)} rows={2} aria-label="Réponse" />
                  <div className="ac-faq-actions">
                    <button type="button" className="ac-btn primary small" onClick={submitEdit} disabled={busy}>Enregistrer</button>
                    <button type="button" className="ac-btn ghost small" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="ac-faq-q">« {f.question} »</p>
                  <p className="ac-faq-a">{f.answer}</p>
                  <div className="ac-faq-actions">
                    <button type="button" className="ac-btn ghost small" onClick={() => startEdit(f)}>Modifier</button>
                    <button type="button" className="ac-icon-btn danger" aria-label="Supprimer" onClick={() => remove(f.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {(k.faq || []).length === 0 && (
          <p className="ac-empty">Aucune question personnalisée pour l'instant.</p>
        )}
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
    <div className="ac-platforms">
      {oauthBanner && (
        <div className={`ac-banner ${oauthBanner.ok ? "ok" : "err"}`}>
          {oauthBanner.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p>{oauthBanner.text}</p>
        </div>
      )}
      <div className="ac-statusbar">
        <span className={`ac-dot ${connectedCount > 0 ? "on" : ""}`} />
        <span>
          {connectedCount > 0
            ? `${connectedCount} plateforme${connectedCount > 1 ? "s" : ""} connectée${connectedCount > 1 ? "s" : ""} — les automatisations pourront tourner en conditions réelles`
            : "Connectez une plateforme pour activer les réponses automatiques réelles"}
        </span>
      </div>

      {platforms.map((p) => {
        const isExpanded = expandedId === p.id;
        const keysValid = areKeysValid(p);
        const oauth = oauthConnections[p.id];
        return (
          <article key={p.id} className="ac-plat-card">
            <div className="ac-plat-banner" style={{ background: p.gradient }}>
              <div className="ac-plat-logo"><SocialIcon path={p.icon} size={22} /></div>
              {(p.connected || oauth) && <span className="ac-plat-active">ACTIF</span>}
            </div>
            <div className="ac-plat-body">
              <h3>{p.name}</h3>
              <p className="ac-muted">{p.desc}</p>
              {p.connected && p.verifiedLabel && (
                <p className="ac-verified">✓ Compte vérifié : {p.verifiedLabel}</p>
              )}
              <div className="ac-tags">
                {p.features.map((f, i) => <span key={i} className="ac-chip">{f}</span>)}
              </div>

              {isExpanded && (
                <div className="ac-keys">
                  <p className="ac-subhead">Clés API (vérifiées auprès de la plateforme)</p>
                  {p.fields.map((field) => {
                    const hasValue = p.keys[field.key]?.trim();
                    return (
                      <div key={field.key}>
                        <div className="ac-keys-head">
                          <p>{field.label}</p>
                          {field.link && (
                            <a href={field.link} target="_blank" rel="noopener noreferrer">Obtenir <ExternalLink size={12} /></a>
                          )}
                        </div>
                        <div className={`ac-keys-input ${hasValue ? "ok" : ""}`}>
                          <input
                            type={p.showKeys[field.key] ? "text" : field.type}
                            value={p.keys[field.key] || ""}
                            onChange={(e) => setKey(p.id, field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                          {hasValue && <CheckCircle2 size={14} className="ac-keys-check" />}
                          <button type="button" onClick={() => toggleShowKey(p.id, field.key)} aria-label="Afficher / masquer">
                            {p.showKeys[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <p className="ac-note"><Shield size={13} /> Clés stockées localement sur cet appareil uniquement.</p>
                </div>
              )}

              {oauth ? (
                <div className="ac-oauth-ok">
                  <CheckCircle2 size={20} />
                  <div>
                    <p><strong>Connecté via {p.name}</strong></p>
                    <p className="ac-muted">
                      {oauth.username || oauth.display_name || "Compte vérifié"}
                      {oauth.expires_at && <> · {isExpiringSoon(oauth) ? "à renouveler bientôt" : `valide jusqu'au ${new Date(oauth.expires_at).toLocaleDateString("fr-FR")}`}</>}
                    </p>
                  </div>
                  <button type="button" className="ac-btn danger-ghost" onClick={() => handleOAuthDisconnect(p.id)}>Déconnecter</button>
                </div>
              ) : (
                <>
                  <button type="button" className="ac-btn primary full" onClick={() => handleOAuthConnect(p.id)} disabled={oauthStarting === p.id}>
                    <SocialIcon path={p.icon} size={18} />
                    {oauthStarting === p.id ? "Redirection…" : `Se connecter avec ${p.name}`}
                  </button>
                  <p className="ac-or">
                    Connexion sécurisée via {p.name} — ou{" "}
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      saisir les clés API manuellement
                    </button>
                  </p>
                  <div className="ac-plat-actions">
                    <button
                      type="button"
                      className={`ac-btn ${p.connected ? "danger-ghost" : "secondary"} full`}
                      onClick={() => toggleConnect(p.id)}
                      disabled={validating === p.id || (!p.connected && !keysValid)}
                    >
                      {validating === p.id ? "Validation…" : p.connected ? "Déconnecter" : "Connecter avec Maria IA"}
                    </button>
                    <button type="button" className="ac-icon-btn" aria-label="Configurer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      <ChevronRight size={20} className={isExpanded ? "rot" : ""} />
                    </button>
                  </div>
                </>
              )}
              {p.error && (
                <div className="ac-banner err"><AlertCircle size={15} /><p>{p.error}</p></div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ════════════════════════ Onglet Statistiques (données réelles uniquement) ════════════════════════ */

function StatsTab({ leads, events, realBookings, onExportCsv }) {
  const count = (type) => events.filter((e) => e.event_type === type).length;
  const previews = count("preview_start");
  const emails = leads.length;
  const bookings = realBookings;
  const clicks = count("link_click");
  const completion = previews > 0 ? Math.round(((emails + bookings) / previews) * 100) : 0;

  const cards = [
    { label: "Aperçus lancés", value: previews, icon: MessageCircle },
    { label: "Emails capturés", value: emails, icon: Mail },
    { label: "Réservations créées via l'assistant", value: bookings, icon: Calendar },
    { label: "Clics sur le lien", value: clicks, icon: Link2 },
  ];

  return (
    <div className="ac-stats">
      <div className="ac-stat-grid">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="ac-stat-card">
              <Icon size={18} />
              <p className="ac-stat-value">{c.value}</p>
              <p className="ac-stat-label">{c.label}</p>
            </div>
          );
        })}
      </div>
      <div className="ac-card">
        <div className="ac-card-head">
          <div>
            <p className="ac-card-eyebrow">Performance</p>
            <h3>Taux de complétion : {completion} %</h3>
          </div>
          <TrendingUp size={22} className="ac-muted" />
        </div>
        <p className="ac-muted small">
          Part des conversations (aperçus) ayant abouti à un email capturé ou une réservation.
          0 au début, c'est normal : les chiffres se construisent avec vos vraies conversations.
        </p>
      </div>

      <div className="ac-card">
        <div className="ac-card-head">
          <div>
            <p className="ac-card-eyebrow">Prospects</p>
            <h3>Leads récents ({leads.length})</h3>
          </div>
          {leads.length > 0 && (
            <button type="button" className="ac-btn secondary small" onClick={onExportCsv}>
              <Download size={14} /> Exporter CSV
            </button>
          )}
        </div>
        {leads.length === 0 ? (
          <p className="ac-empty">Aucun lead pour l'instant. Les emails saisis dans l'aperçu ou via vos automatisations apparaîtront ici.</p>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Prénom</th>
                  <th>Plateforme</th>
                  <th>Automatisation</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 50).map((l) => (
                  <tr key={l.id}>
                    <td>{l.email}</td>
                    <td>{l.pseudo || "—"}</td>
                    <td>{PLATFORM_LABELS[l.platform] || l.platform || "—"}</td>
                    <td>{l.automation_name || "—"}</td>
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
    <div>
      <div className="ac-card">
        <p className="ac-card-eyebrow">Chatbot IA sur votre site</p>
        <h3>Maria sur le site web du salon</h3>
        <p className="ac-muted small" style={{ marginTop: 6 }}>
          Intégrez Maria à votre site internet : vos visiteurs discutent avec elle,
          posent leurs questions (prestations, tarifs, horaires — vos vraies données)
          et <strong>réservent directement</strong>. Chaque réservation arrive dans
          « Gestion agenda » avec le badge <strong>Site web</strong>.
        </p>
      </div>

      {!code ? (
        <p className="ac-empty">Connectez-vous avec votre compte pro pour générer le chatbot de votre salon.</p>
      ) : (
        <>
          <div className="ac-card">
            <div className="ac-card-head">
              <div>
                <p className="ac-card-eyebrow">Étape 1</p>
                <h3>Lien direct du chatbot</h3>
              </div>
              <button type="button" className="ac-btn secondary" onClick={() => copy(widgetUrl, "url")}>
                {copied === "url" ? "Copié ✓" : "Copier le lien"}
              </button>
            </div>
            <p className="ac-code">{widgetUrl}</p>
            <p className="ac-muted small" style={{ marginTop: 8 }}>
              Partagez ce lien ou ouvrez-le pour tester le chatbot tel que vos visiteurs le verront.
            </p>
          </div>

          <div className="ac-card">
            <div className="ac-card-head">
              <div>
                <p className="ac-card-eyebrow">Étape 2</p>
                <h3>Code à intégrer sur votre site</h3>
              </div>
              <button type="button" className="ac-btn secondary" onClick={() => copy(iframeCode, "iframe")}>
                {copied === "iframe" ? "Copié ✓" : "Copier le code"}
              </button>
            </div>
            <pre className="ac-code ac-code-block">{iframeCode}</pre>
            <p className="ac-muted small" style={{ marginTop: 8 }}>
              Collez ce code dans une page de votre site (WordPress, Wix, site sur mesure…)
              là où vous voulez afficher le chatbot.
            </p>
          </div>

          <div className="ac-card">
            <p className="ac-card-eyebrow">Aperçu en direct</p>
            <h3 style={{ marginBottom: 10 }}>Ce que verront vos visiteurs</h3>
            <div className="ac-site-preview">
              <iframe src={widgetUrl} title="Aperçu du chatbot Maria" loading="lazy" />
            </div>
            <p className="ac-muted small" style={{ marginTop: 8 }}>
              Si l'aperçu affiche « indisponible », déployez d'abord la fonction{" "}
              <code>maria-widget</code> sur Supabase (voir le guide dans{" "}
              <code>supabase/functions/maria-widget/index.ts</code>).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════ Composant principal ════════════════════════ */

const TABS = [
  { id: "automatisations", label: "Automatisations", icon: Zap },
  { id: "connaissances", label: "Connaissances", icon: BookOpen },
  { id: "plateformes", label: "Plateformes", icon: Globe },
  { id: "siteweb", label: "Site web", icon: ExternalLink },
  { id: "stats", label: "Statistiques", icon: BarChart3 },
];

function newId() {
  try { return crypto.randomUUID(); } catch { return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`; }
}
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));

export default function AssistantConversationnel() {
  // Design blanc & orange imposé sur cette page : on force le thème clair
  // pendant la visite SANS écraser le thème global mémorisé (bb_theme),
  // puis on le restaure à la sortie.
  useEffect(() => {
    const root = document.documentElement;
    const styleEl = document.getElementById("bb-theme-style");
    const prev = {
      dark: root.classList.contains("dark"),
      css: styleEl ? styleEl.textContent : "",
      bodyBg: document.body.style.backgroundColor,
      bodyColor: document.body.style.color,
      htmlBg: root.style.backgroundColor,
    };
    const rootEl = document.getElementById("root");
    const prevRootBg = rootEl ? rootEl.style.backgroundColor : "";
    root.classList.remove("dark");
    if (styleEl) styleEl.textContent = "";
    document.body.style.backgroundColor = "#fff7f2";
    document.body.style.color = "";
    root.style.backgroundColor = "#fff7f2";
    if (rootEl) rootEl.style.backgroundColor = "#fff7f2";
    return () => {
      if (prev.dark) root.classList.add("dark"); else root.classList.remove("dark");
      if (styleEl) styleEl.textContent = prev.css;
      document.body.style.backgroundColor = prev.bodyBg;
      document.body.style.color = prev.bodyColor;
      root.style.backgroundColor = prev.htmlBg;
      if (rootEl) rootEl.style.backgroundColor = prevRootBg;
    };
  }, []);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("automatisations");
  const [proEmail, setProEmail] = useState("");
  const [salonName, setSalonName] = useState("");
  const [proName, setProName] = useState("");
  const [services, setServices] = useState([]);
  const [knowledge, setKnowledge] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const [automations, setAutomations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [leads, setLeads] = useState([]);
  const [events, setEvents] = useState([]);
  const [realBookings, setRealBookings] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [loading, setLoading] = useState(true);

  /* ── Chargement initial ── */
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || "";
        setProEmail(email);
        if (!email) { setLoading(false); return; }

        // Profil du salon (nom réel pour le seed + messages)
        let sName = "";
        let pName = "";
        try {
          const profiles = await entities.ProfilPro.filter({ user_email: email }, "-created_at", 1).catch(() => []);
          const p = profiles && profiles[0];
          if (p) {
            sName = p.salon_name || [p.prenom, p.nom].filter(Boolean).join(" ") || "";
            pName = [p.prenom, p.nom].filter(Boolean).join(" ") || p.salon_name || "";
          }
        } catch { /* ignore */ }
        setSalonName(sName);
        setProName(pName);

        // Vrais services du salon
        try {
          const svcs = await entities.Service.filter({ pro_email: email, status: "actif" }, "-created_at", 100).catch(() => []);
          setServices((svcs || []).map((s) => ({
            id: s.id, name: s.name || s.title || "Prestation",
            price: s.price ?? null, duration_min: s.duration_min || s.duration || 60, duration: s.duration_min || s.duration || 60,
          })));
        } catch { setServices([]); }

        // Base de connaissances
        setSyncing(true);
        try { setKnowledge(await buildKnowledge(email)); } catch { /* ignore */ }
        setSyncing(false);

        // Automatisations : Supabase d'abord, sinon local, sinon seed
        let autos = null;
        try {
          const { data, error } = await supabase
            .from("social_automations")
            .select("*")
            .eq("user_email", email)
            .order("created_at", { ascending: true });
          if (!error && data && data.length) {
            autos = data.map((r) => ({
              id: r.id, platform: r.platform, name: r.name,
              trigger_type: r.trigger_type, trigger_keyword: r.trigger_keyword || "",
              enabled: !!r.enabled, steps: r.steps || defaultSteps(sName),
              created_at: r.created_at,
            }));
          }
        } catch { /* table absente : repli local */ }
        if (!autos) {
          const local = readLocal(automationsKey(email));
          autos = local.length ? local : [{ ...seedAutomation(sName), id: newId() }];
          writeLocal(automationsKey(email), autos);
        }
        setAutomations(autos);
        setSelectedId(autos[0]?.id || null);

        // Leads + événements réels
        setLeads(readLocal(leadsKey(email)));
        setEvents(readLocal(eventsKey(email)).slice(0, 500));

        // Vraies réservations créées via l'assistant (table Reservation, source='maria_assistant')
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

  /* ── Draft = copie éditable de l'automatisation sélectionnée ── */
  useEffect(() => {
    const a = automations.find((x) => x.id === selectedId) || null;
    setDraft(a ? JSON.parse(JSON.stringify(a)) : null);
    setDirty(false);
  }, [selectedId, automations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = (updater) => {
    setDraft((d) => (typeof updater === "function" ? updater(d) : updater));
    setDirty(true);
  };

  /* ── Persistance ── */
  const persistAutomations = async (list) => {
    writeLocal(automationsKey(proEmail), list);
    try {
      for (const a of list) {
        const row = {
          user_email: proEmail,
          platform: a.platform,
          name: a.name,
          trigger_type: a.trigger_type,
          trigger_keyword: a.trigger_keyword || "",
          steps: a.steps,
          enabled: !!a.enabled,
          updated_at: new Date().toISOString(),
        };
        if (isUuid(a.id)) {
          await supabase.from("social_automations").upsert({ id: a.id, ...row }, { onConflict: "id" });
        } else {
          const { data } = await supabase.from("social_automations").insert(row).select("id").single();
          if (data?.id) a.id = data.id;
        }
      }
      writeLocal(automationsKey(proEmail), list);
    } catch { /* échec silencieux : le local reste la source de vérité */ }
  };

  const handleSave = async () => {
    if (!draft || !proEmail) return;
    setSaving(true);
    const list = automations.map((a) => (a.id === draft.id ? draft : a));
    setAutomations(list);
    await persistAutomations(list);
    setDirty(false);
    setSaving(false);
    setReplayKey((k) => k + 1);
  };

  const handleCreate = () => {
    const a = { ...seedAutomation(salonName), id: newId(), name: "Nouvelle automatisation", enabled: true };
    const list = [...automations, a];
    setAutomations(list);
    setSelectedId(a.id);
    writeLocal(automationsKey(proEmail), list);
    persistAutomations(list);
  };

  const handleDelete = async (id) => {
    const target = automations.find((a) => a.id === id);
    if (!window.confirm(`Supprimer l'automatisation « ${target?.name || ""} » ?`)) return;
    const list = automations.filter((a) => a.id !== id);
    setAutomations(list);
    if (selectedId === id) setSelectedId(list[0]?.id || null);
    writeLocal(automationsKey(proEmail), list);
    try {
      if (isUuid(id)) await supabase.from("social_automations").delete().eq("id", id);
    } catch { /* ignore */ }
  };

  const handleToggleEnabled = async (id) => {
    const list = automations.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
    setAutomations(list);
    writeLocal(automationsKey(proEmail), list);
    try {
      if (isUuid(id)) {
        const a = list.find((x) => x.id === id);
        await supabase.from("social_automations").update({ enabled: !!a.enabled, updated_at: new Date().toISOString() }).eq("id", id);
      }
    } catch { /* ignore */ }
  };

  const handleSelect = (id) => {
    if (dirty && !window.confirm("Vous avez des modifications non enregistrées. Changer d'automatisation sans enregistrer ?")) return;
    setSelectedId(id);
  };

  /* ── Leads : enregistrement RÉEL ── */
  const handleLead = async ({ email, pseudo, platform, automation_id }) => {
    const auto = automations.find((a) => a.id === automation_id);
    const lead = {
      id: newId(),
      email,
      pseudo: pseudo || "",
      platform: platform || "",
      automation_id: automation_id || null,
      automation_name: auto?.name || "",
      created_at: new Date().toISOString(),
    };
    setLeads((prev) => {
      const next = [lead, ...prev].slice(0, 500);
      writeLocal(leadsKey(proEmail), next);
      return next;
    });
    logEvent({ event_type: "email_captured", platform, automation_id, meta: { email } });
    try {
      await supabase.from("social_leads").insert({
        user_email: proEmail, platform: platform || null,
        automation_id: isUuid(automation_id) ? automation_id : null,
        email, pseudo: pseudo || null,
      });
    } catch { /* repli local déjà fait */ }
    return lead;
  };

  /* ── Journal d'activité ── */
  const logEvent = (ev) => {
    const row = {
      id: newId(),
      event_type: ev.event_type,
      platform: ev.platform || null,
      automation_id: isUuid(ev.automation_id) ? ev.automation_id : null,
      meta: ev.meta || {},
      created_at: new Date().toISOString(),
    };
    setEvents((prev) => {
      const next = [row, ...prev].slice(0, 500);
      writeLocal(eventsKey(proEmail), next);
      return next;
    });
    try {
      supabase.from("social_events").insert({
        user_email: proEmail,
        platform: row.platform,
        automation_id: row.automation_id,
        event_type: row.event_type,
        meta: row.meta,
      }).then(() => {}, () => {});
    } catch { /* ignore */ }
  };

  /* ── Réservation RÉELLE (Gestion agenda + Google Agenda) ── */
  const handleBooking = async (booking) => {
    const reservation = await createAssistantReservation({
      proEmail,
      salonName,
      proName,
      service: booking.service,
      date: booking.date,
      time: booking.time,
      clientName: booking.name,
      clientPhone: booking.phone,
      clientEmail: booking.email || undefined,
      answers: booking.answers || {},
    });
    const googleResult = await pushToGoogleCalendar({
      date: booking.date,
      time: booking.time,
      endTime: reservation.end_time_slot,
      summary: `${reservation.service_name} — ${booking.name} (via Maria)`,
      description: "Réservation prise via l'assistant conversationnel Maria (BeautyBook).",
      clientPhone: booking.phone,
    });
    logEvent({
      event_type: "booking_confirmed",
      platform: booking.platform || null,
      automation_id: booking.automationId || null,
      meta: { service: reservation.service_name, date: reservation.date, time: reservation.time_slot, google: googleResult.ok },
    });
    try {
      const { count } = await supabase
        .from("Reservation")
        .select("id", { count: "exact", head: true })
        .eq("pro_email", proEmail)
        .eq("source", "maria_assistant");
      if (typeof count === "number") setRealBookings(count);
    } catch { /* ignore */ }
    return { ...reservation, googleResult };
  };

  /* ── Export CSV réel ── */
  const exportCsv = () => {
    const header = "email;prenom;plateforme;automatisation;date\n";
    const rows = leads.map((l) =>
      [l.email, l.pseudo || "", PLATFORM_LABELS[l.platform] || l.platform || "", l.automation_name || "", l.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-maria-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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

  const activeAutomations = automations.filter((a) => a.enabled).length;

  return (
    <div className="ac-page">
      <header className="ac-hero">
        <div className="ac-topline">
          <span className="ac-eyebrow"><span className="ac-pulse" /> MARIA IA · ASSISTANT</span>
          <button type="button" className="ac-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Retour
          </button>
        </div>
        <h1>Vos conversations,<br /><em>pilotées par l'IA.</em></h1>
        <p className="ac-subtitle">
          Maria répond à vos DMs et commentaires, capture vos prospects et envoie vos liens — automatiquement.
        </p>
        <div className="ac-hero-stats">
          <span><Bot size={14} /> {activeAutomations} automatisation{activeAutomations > 1 ? "s" : ""} active{activeAutomations > 1 ? "s" : ""}</span>
          <span><Users size={14} /> {leads.length} lead{leads.length > 1 ? "s" : ""} capturé{leads.length > 1 ? "s" : ""}</span>
          <span><Calendar size={14} /> {realBookings} réservation{realBookings > 1 ? "s" : ""} via l'assistant</span>
        </div>
        <nav className="ac-tabs" aria-label="Sections de l'assistant">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`ac-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="ac-main">
        {loading ? (
          <p className="ac-empty">Chargement de l'assistant…</p>
        ) : (
          <>
            {activeTab === "automatisations" && (
              <div className="ac-auto-layout">
                <div className="ac-col-list">
                  <AutomationList
                    automations={automations}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onCreate={handleCreate}
                    onDelete={handleDelete}
                    onToggle={handleToggleEnabled}
                  />
                </div>
                <div className="ac-col-builder">
                  <AutomationsBuilder
                    draft={draft}
                    setDraft={updateDraft}
                    services={services}
                    dirty={dirty}
                    saving={saving}
                    onSave={handleSave}
                    replayKey={replayKey}
                    setReplayKey={setReplayKey}
                    knowledge={knowledge}
                    proEmail={proEmail}
                    salonName={salonName}
                    onLead={handleLead}
                    onEvent={logEvent}
                    onBooking={handleBooking}
                  />
                </div>
                <div className="ac-col-preview">
                  <p className="ac-section-title">Aperçu en direct</p>
                  {draft ? (
                    <PhonePreview
                      automation={draft}
                      knowledge={knowledge}
                      proEmail={proEmail}
                      salonName={salonName}
                      services={services}
                      onLead={handleLead}
                      onEvent={logEvent}
                      onBooking={handleBooking}
                      replayKey={replayKey}
                    />
                  ) : (
                    <p className="ac-empty">Sélectionnez une automatisation.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "connaissances" && (
              <KnowledgeTab
                knowledge={knowledge}
                proEmail={proEmail}
                onFaqChange={(list) => setKnowledge((k) => ({ ...(k || {}), faq: list }))}
                onResync={resyncKnowledge}
                syncing={syncing}
              />
            )}

            {activeTab === "plateformes" && <PlatformsTab />}

            {activeTab === "siteweb" && <SiteWebTab proEmail={proEmail} salonName={salonName} />}

            {activeTab === "stats" && (
              <StatsTab leads={leads} events={events} realBookings={realBookings} onExportCsv={exportCsv} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
