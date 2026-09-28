// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function : social-webhook
// Reçoit les événements Meta (Instagram / Facebook) et fait tourner les
// automatisations de l'assistant conversationnel Maria EN CONDITIONS RÉELLES.
//
// Routes :
//   GET  /                        -> vérification du webhook Meta
//                                    (hub.mode=subscribe, hub.verify_token)
//   POST /                        -> événements Instagram/Facebook
//                                    (commentaires + messages)
//   POST /followup                -> envoie les relances dues
//                                    (à appeler via cron, ex. toutes les heures)
//
// Secrets requis (supabase secrets set) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERIFY_TOKEN
//   (optionnel) VOICE_SERVER_URL, VOICE_SERVER_ADMIN_TOKEN
//   → pour pousser les réservations vers Google Agenda via le serveur vocal.
//
// Principe : chaque message entrant passe D'ABORD par le moteur de réponses
// (questions libres → vraies données du salon, jamais d'invention). Si une
// intention de réservation est détectée, la machine à états de réservation
// démarre : service → date → heure → prénom/téléphone → création RÉELLE de
// la réservation (table Reservation, source 'maria_assistant', visible dans
// « Gestion agenda ») + Google Agenda si connecté.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") ?? "";
const VOICE_SERVER_URL = (Deno.env.get("VOICE_SERVER_URL") || "").replace(/\/+$/, "");
const VOICE_ADMIN_TOKEN = Deno.env.get("VOICE_SERVER_ADMIN_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = "https://graph.facebook.com/v21.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* ───────────────────────── Utilitaires ───────────────────────── */

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function detectBookingIntent(text: string): boolean {
  const t = norm(text);
  return /(reserver|reservation|rendez-vous|\brdv\b|prendre.*(rendez|creaneau|rdv)|je veux.*(venir|passer)|disponib|creaneau|book)/.test(t);
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + (mins || 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function logEvent(row: Record<string, unknown>) {
  try {
    await supabase.from("social_events").insert({
      user_email: row.user_email,
      platform: row.platform ?? null,
      automation_id: row.automation_id ?? null,
      event_type: row.event_type,
      meta: row.meta ?? {},
    });
  } catch (e) {
    console.error("logEvent:", e);
  }
}

/* ───────────────────────── Base de connaissances (côté serveur) ───────────────────────── */

type Knowledge = {
  userEmail: string;
  salonName: string;
  bio: string;
  address: string;
  city: string;
  phone: string;
  hoursText: string;
  services: { id: string; name: string; category: string; price: number | null; duration: number }[];
  faq: { question: string; answer: string }[];
};

const DAY_LABELS: Record<string, string> = {
  lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu",
  vendredi: "Ven", samedi: "Sam", dimanche: "Dim",
};

async function buildKnowledge(userEmail: string): Promise<Knowledge> {
  const k: Knowledge = {
    userEmail, salonName: "", bio: "", address: "", city: "",
    phone: "", hoursText: "", services: [], faq: [],
  };
  try {
    const { data: profiles } = await supabase
      .from("ProfilPro")
      .select("salon_name, prenom, nom, bio, address, city, phone, ouverture, horaires")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(1);
    const p = profiles?.[0];
    if (p) {
      k.salonName = p.salon_name || [p.prenom, p.nom].filter(Boolean).join(" ") || "notre salon";
      k.bio = p.bio || "";
      k.address = p.address || "";
      k.city = p.city || "";
      k.phone = p.phone || "";
      const ouv = p.ouverture && Object.keys(p.ouverture).length ? p.ouverture : p.horaires;
      if (ouv && typeof ouv === "object") {
        const parts: string[] = [];
        for (const day of Object.keys(DAY_LABELS)) {
          const d = ouv[day];
          if (!d) continue;
          parts.push(`${DAY_LABELS[day]} : ${d.open && d.start && d.end ? `${d.start}–${d.end}` : "fermé"}`);
        }
        k.hoursText = parts.join("\n");
      }
    }
  } catch (e) { console.error("knowledge profil:", e); }

  try {
    const { data: svcs } = await supabase
      .from("Service")
      .select("id, name, title, category, price, duration_min, duration")
      .eq("pro_email", userEmail)
      .eq("status", "actif")
      .order("created_at", { ascending: false })
      .limit(50);
    k.services = (svcs || []).map((s: Record<string, unknown>) => ({
      id: String(s.id),
      name: String(s.name || s.title || "Prestation"),
      category: String(s.category || ""),
      price: s.price != null ? Number(s.price) : null,
      duration: Number(s.duration_min || s.duration || 60),
    }));
  } catch (e) { console.error("knowledge services:", e); }

  try {
    const { data: faq } = await supabase
      .from("social_faq")
      .select("question, answer")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: true });
    k.faq = (faq || []).map((f: Record<string, string>) => ({ question: f.question, answer: f.answer }));
  } catch { /* table absente : pas de FAQ */ }

  return k;
}

/** Répond avec les vraies données du salon (portage serveur du moteur partagé). */
function answerQuestion(text: string, k: Knowledge): { type: string; text: string } {
  const salon = k.salonName || "notre salon";
  const t = norm(text || "");
  if (!t.trim()) {
    return { type: "fallback", text: "Dites-moi ce que vous cherchez 🙂 Je peux vous renseigner sur nos prestations, nos horaires, ou vous aider à réserver." };
  }
  // FAQ en priorité
  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let best: { question: string; answer: string } | null = null;
  let bestScore = 0;
  for (const f of k.faq) {
    const qWords = new Set(norm(f.question).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    let score = 0;
    for (const w of words) if (qWords.has(w)) score++;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  if (best && bestScore >= 2) return { type: "faq", text: best.answer };

  if (detectBookingIntent(text)) return { type: "booking", text: "Avec plaisir ! Je peux vous réserver un créneau tout de suite 💛" };
  if (/^(bonjour|salut|coucou|hello|bonsoir|yo)\b/.test(t)) {
    return { type: "greeting", text: `Bonjour et bienvenue chez ${salon} ! 👋 Je suis Maria, l'assistante du salon. Posez-moi vos questions ou dites-moi « je veux réserver ».` };
  }
  if (/(prix|tarif|combien|coute|price)/.test(t)) {
    if (k.services.length) {
      const list = k.services.slice(0, 8).map((s) => `• ${s.name}${s.price != null ? ` — ${s.price}€` : ""}`).join("\n");
      return { type: "prices", text: `Voici nos tarifs 💅\n${list}\n\nDites-moi ce qui vous plaît, je peux vous réserver un créneau !` };
    }
    return { type: "prices", text: "Nos tarifs sont affichés sur la page du salon. Dites-moi quelle prestation vous intéresse !" };
  }
  if (/(horaire|ouvert|ferme|heure|quand)/.test(t)) {
    if (k.hoursText) return { type: "hours", text: `Nos horaires 🕐\n${k.hoursText}` };
    return { type: "hours", text: "Nos horaires sont affichés sur la page du salon. Voulez-vous que je vous réserve un créneau ?" };
  }
  if (/(adresse|ou etes|situe|venir|acces|localisation)/.test(t)) {
    const where = [k.address, k.city].filter(Boolean).join(", ");
    if (where) return { type: "address", text: `Vous nous trouverez ici 📍\n${where}` };
    return { type: "address", text: "Notre adresse est indiquée sur la page du salon 📍" };
  }
  if (/(telephone|tel\b|contact|appeler|numero|joindre)/.test(t)) {
    if (k.phone) return { type: "phone", text: `Vous pouvez nous joindre au ${k.phone} 📞` };
    return { type: "phone", text: "Écrivez-moi ici, je réponds tout de suite 💬" };
  }
  if (/(service|prestation|propose|faites|coiffure|ongle|soin|massage|beaute)/.test(t)) {
    if (k.services.length) {
      const list = k.services.slice(0, 10).map((s) => `• ${s.name}`).join("\n");
      return { type: "services", text: `Voici ce que nous proposons ✨\n${list}\n\nLequel vous tente ? Je peux vous réserver un créneau tout de suite.` };
    }
    return { type: "services", text: "Toutes nos prestations sont listées sur la page du salon ✨" };
  }
  if (/(merci|thanks)/.test(t)) return { type: "thanks", text: `Avec grand plaisir ! 💛 À très vite chez ${salon}.` };
  const contact = k.phone ? ` ou appelez-nous au ${k.phone}` : "";
  return { type: "fallback", text: `Hmm, je ne suis pas sûre de bien comprendre 🤔 Je peux vous renseigner sur nos prestations, nos tarifs et nos horaires — ou vous aider à réserver un créneau${contact}.` };
}

/* ───────────────────────── Envoi de messages Meta ───────────────────────── */

const pageTokenCache = new Map<string, string>();

/** Récupère le token de Page (nécessaire pour envoyer des DMs Instagram). */
async function getPageToken(userToken: string): Promise<string | null> {
  if (pageTokenCache.has(userToken)) return pageTokenCache.get(userToken)!;
  try {
    const res = await fetch(`${GRAPH}/me/accounts?fields=access_token&limit=5&access_token=${encodeURIComponent(userToken)}`);
    const data = await res.json();
    const token = data?.data?.[0]?.access_token || null;
    if (token) pageTokenCache.set(userToken, token);
    return token;
  } catch {
    return null;
  }
}

async function sendInstagramDM(userToken: string, igSid: string, text: string): Promise<boolean> {
  try {
    const pageToken = await getPageToken(userToken);
    const token = pageToken || userToken;
    const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: igSid }, messaging_type: "RESPONSE", message: { text } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error("sendInstagramDM:", JSON.stringify(data));
    return res.ok;
  } catch (e) {
    console.error("sendInstagramDM:", e);
    return false;
  }
}

async function sendPrivateReply(userToken: string, commentId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${commentId}/private_replies?access_token=${encodeURIComponent(userToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error("sendPrivateReply:", JSON.stringify(data));
    return res.ok;
  } catch (e) {
    console.error("sendPrivateReply:", e);
    return false;
  }
}

/* ───────────────────────── Réservation réelle ───────────────────────── */

async function createReservation(k: Knowledge, service: Knowledge["services"][number], date: string, time: string, clientName: string, clientPhone: string, clientEmail?: string, answersText?: string) {
  const digits = clientPhone.replace(/\D/g, "");
  const payload = {
    client_email: clientEmail || `tel:${digits}@phone.local`,
    client_name: clientName,
    pro_email: k.userEmail,
    pro_name: "",
    service_id: service.id,
    service_name: service.name,
    service_price: service.price ?? 0,
    date,
    time_slot: time,
    duration_min: service.duration,
    end_time_slot: addMinutes(time, service.duration),
    persons: 1,
    total_price: service.price ?? 0,
    payment_type: "surplace",
    payment_status: "non_paye",
    status: "en_attente",
    notes: `RDV pris via l'assistant conversationnel Maria (DM/commentaire). Tél client : ${clientPhone}.${answersText ? ` Réponses questionnaire : ${answersText}.` : ""}`,
    salon_name: k.salonName,
    source: "maria_assistant",
  };
  const { data, error } = await supabase.from("Reservation").insert(payload).select().single();
  if (error) throw new Error(`Reservation: ${error.message}`);
  return data;
}

/** Pousse la réservation vers Google Agenda via le serveur vocal (si configuré). */
async function pushGoogleCalendar(k: Knowledge, date: string, time: string, endTime: string, summary: string, clientPhone: string): Promise<boolean> {
  if (!VOICE_SERVER_URL) return false;
  try {
    const headers: Record<string, string> = {};
    if (VOICE_ADMIN_TOKEN) headers["x-admin-token"] = VOICE_ADMIN_TOKEN;
    const r1 = await fetch(`${VOICE_SERVER_URL}/api/salons`, { headers });
    if (!r1.ok) return false;
    const salons = await r1.json().catch(() => []);
    const salon = (salons || []).find((s: { pro_email?: string }) => s.pro_email === k.userEmail) || (salons || [])[0];
    if (!salon?.google_connected) return false;
    const r2 = await fetch(`${VOICE_SERVER_URL}/api/calendar/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        salon_id: salon.id, summary,
        description: "Réservation prise via l'assistant conversationnel Maria (BeautyBook).",
        date, start_time: time, end_time: endTime, client_phone: clientPhone,
      }),
    });
    const data = await r2.json().catch(() => ({}));
    return !!(r2.ok && data?.ok);
  } catch (e) {
    console.error("pushGoogleCalendar:", e);
    return false;
  }
}

/* ───────────────────────── Machine à états ───────────────────────── */

type ConvState = {
  stage: string;
  automationId: string | null;
  senderId: string;
  senderName: string;
  commentId: string | null; // pour répondre en privé au commentaire
  data: Record<string, unknown>;
};

async function getConvState(userEmail: string, senderId: string): Promise<ConvState | null> {
  const { data } = await supabase
    .from("social_events")
    .select("meta")
    .eq("user_email", userEmail)
    .eq("event_type", "conv_state")
    .order("created_at", { ascending: false })
    .limit(50);
  for (const row of data || []) {
    const m = row.meta as ConvState;
    if (m?.senderId === senderId && m?.stage !== "done") return m;
  }
  return null;
}

async function setConvState(userEmail: string, platform: string, state: ConvState) {
  await logEvent({ user_email: userEmail, platform, automation_id: state.automationId, event_type: "conv_state", meta: state });
}

function parseDateFr(text: string): string | null {
  const t = norm(text).trim();
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (/aujourd/.test(t)) return iso(today);
  if (/demain/.test(t)) { const d = new Date(today); d.setDate(d.getDate() + 1); return iso(d); }
  const m = t.match(/(\d{4})-(\d{2})-(\d{2})/) || t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    if (m[0].includes("-")) return `${m[1]}-${m[2]}-${m[3]}`;
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(today.getFullYear());
    const cand = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (cand >= iso(today)) return cand;
  }
  return null;
}

function parseTimeFr(text: string): string | null {
  const m = norm(text).match(/(\d{1,2})[:hH](\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseContact(text: string): { name: string; phone: string } | null {
  const tokens = text.trim().split(/\s+/);
  const phoneIdx = tokens.findIndex((tk) => tk.replace(/\D/g, "").length >= 8);
  if (phoneIdx === -1) return null;
  const phone = tokens[phoneIdx].replace(/\D/g, "");
  const name = tokens.filter((_, i) => i !== phoneIdx).join(" ").trim();
  if (!name) return null;
  return { name, phone };
}

/* ───────── Questionnaires par catégorie (synchro étape 2 web) ───────── */

const QUESTIONNAIRES_URL = "https://thelastjiren.vercel.app/questionnaires.json";
const Q_CACHE_TTL = 6 * 3600 * 1000; // 6 h

type QuestionnaireQuestion = { id: string; question: string; options: string[] };
type QuestionnaireCategory = { label: string; tip?: string; questions: QuestionnaireQuestion[] };

let qCache: { at: number; data: Record<string, QuestionnaireCategory> } | null = null;

/**
 * Récupère les questionnaires par catégorie depuis le site web (même source
 * que l'étape 2 du parcours de réservation). Cache mémoire 6 h.
 * Repli silencieux : retourne {} si le JSON est injoignable — ne bloque jamais.
 */
async function fetchQuestionnaires(): Promise<Record<string, QuestionnaireCategory>> {
  const now = Date.now();
  if (qCache && now - qCache.at < Q_CACHE_TTL) return qCache.data;
  try {
    const res = await fetch(QUESTIONNAIRES_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = (data && typeof data === "object"
      ? (data as Record<string, unknown>).categories
      : null) as Record<string, unknown> | null;
    const clean: Record<string, QuestionnaireCategory> = {};
    if (raw && typeof raw === "object") {
      for (const [key, v] of Object.entries(raw)) {
        const c = v as Partial<QuestionnaireCategory>;
        if (!c || !Array.isArray(c.questions)) continue;
        clean[key] = {
          label: String(c.label || key),
          tip: c.tip ? String(c.tip) : undefined,
          questions: (c.questions as unknown[])
            .filter((q) => q && typeof q === "object" && (q as Record<string, unknown>).question)
            .map((q) => {
              const o = q as Record<string, unknown>;
              return {
                id: String(o.id || ""),
                question: String(o.question),
                options: Array.isArray(o.options) ? (o.options as unknown[]).map(String) : [],
              };
            }),
        };
      }
    }
    qCache = { at: now, data: clean };
    return clean;
  } catch (e) {
    console.error("fetchQuestionnaires:", e);
    return {};
  }
}

/**
 * Détecte la clé de catégorie du questionnaire pour un service
 * (insensible aux accents — même logique que l'étape 2 du parcours web).
 */
function detectCategoryKey(
  category: string,
  serviceName: string,
  questionnaires: Record<string, QuestionnaireCategory>,
): string {
  const keys = Object.keys(questionnaires);
  if (!keys.length) return "";
  const catN = norm(category);
  if (catN) {
    for (const k of keys) {
      if (k === "general") continue;
      const kN = norm(k);
      if (catN === kN || catN.includes(kN) || kN.includes(catN)) return k;
    }
  }
  const fields = [category, serviceName].map(norm);
  const has = (...words: string[]) => fields.some((f) => words.some((w) => f.includes(w)));
  const order: [string, string[]][] = [
    ["tresses", ["tresse", "braid", "natte", "vanille", "locs", "cornrow"]],
    ["cils", ["cil", "sourcil", "lash", "brow"]],
    ["coiffure", ["coiff", "cheveu", "lissage", "coloration", "coupe", "brushing", "chignon"]],
    ["ongles", ["ongle", "manucure", "manucur", "pedicure", "nail"]],
    ["maquillage", ["maquillage", "makeup"]],
    ["barbe", ["barbe", "rasage", "barbier"]],
    ["massage", ["massage", "spa", "bien-etre", "relax", "hammam"]],
    ["epilation", ["epilation", "epil"]],
    ["soin_visage", ["soin", "visage", "peau", "facial", "gommage", "hydra"]],
  ];
  for (const [key, words] of order) {
    if (keys.includes(key) && has(...words)) return key;
  }
  return keys.includes("general") ? "general" : "";
}

/** Formate une question pour un message DM (options numérotées si présentes). */
function formatQuestionMessage(q: QuestionnaireQuestion, idx: number, total: number): string {
  let t = `Question ${idx + 1}/${total} : ${q.question}`;
  if (q.options.length) {
    t += "\n" + q.options.map((o, i) => `${i + 1}. ${o}`).join("\n");
    t += "\nRépondez par le numéro, ou écrivez « passer » pour ignorer cette question.";
  } else {
    t += "\n(Écrivez « passer » pour ignorer cette question)";
  }
  return t;
}

/** Envoie un message au bon canal (DM Instagram ou réponse privée au commentaire). */
async function replyToSender(conn: { access_token: string }, state: ConvState, text: string, platform: string): Promise<void> {
  if (platform === "instagram" && state.commentId) {
    // Commentaire → réponse privée (le visiteur reçoit un DM)
    await sendPrivateReply(conn.access_token, state.commentId, text);
  } else {
    await sendInstagramDM(conn.access_token, state.senderId, text);
  }
}

async function handleIncoming(
  conn: { access_token: string; user_email: string },
  platform: "instagram" | "facebook",
  senderId: string,
  senderName: string,
  text: string,
  commentId: string | null
) {
  const userEmail = conn.user_email;
  const k = await buildKnowledge(userEmail);
  const state = await getConvState(userEmail, senderId);

  const say = (t: string) => replyToSender(conn, { ...(state as ConvState), senderId, commentId: state?.commentId ?? commentId } as ConvState, t, platform);

  // ── Suite d'une conversation en cours (machine à états) ──
  if (state) {
    const d = state.data;
    // Étape email : on attend un email valide
    if (state.stage === "awaiting_email") {
      const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
      if (m) {
        await supabase.from("social_leads").insert({
          user_email: userEmail, platform,
          automation_id: state.automationId,
          email: m[0], pseudo: senderName || null,
        });
        await logEvent({ user_email: userEmail, platform, automation_id: state.automationId, event_type: "email_captured", meta: { email: m[0] } });
        state.stage = "booking_service";
        state.data = {};
        await setConvState(userEmail, platform, state);
        if (k.services.length) {
          const list = k.services.slice(0, 10).map((s, i) => `${i + 1}. ${s.name}${s.price != null ? ` (${s.price}€)` : ""}`).join("\n");
          await say(`Merci, c'est noté ✅\n\nQuel service vous intéresse ? Répondez par le numéro :\n${list}`);
        } else {
          state.stage = "booking_date";
          await setConvState(userEmail, platform, state);
          await say("Merci, c'est noté ✅\n\nPour quelle date souhaitez-vous réserver ? (ex : 2026-10-05, ou « demain »)");
        }
      } else {
        await say("Hmm, cet email ne semble pas valide — pouvez-vous le vérifier ? 🙂");
      }
      return;
    }
    // Choix du service
    if (state.stage === "booking_service") {
      const n = parseInt(norm(text), 10);
      let svc = null;
      if (n >= 1 && n <= k.services.length) svc = k.services[n - 1];
      else svc = k.services.find((s) => norm(s.name).includes(norm(text)) || norm(text).includes(norm(s.name)));
      if (!svc) {
        await say("Je n'ai pas bien compris — répondez par le numéro du service 🙂");
        return;
      }
      d.service = svc;
      // ── Questionnaire de la catégorie (optionnel, synchro étape 2 web) ──
      const questionnaires = await fetchQuestionnaires();
      const qKey = detectCategoryKey(svc.category, svc.name, questionnaires);
      const qs = (qKey && questionnaires[qKey] ? questionnaires[qKey].questions : []) || [];
      if (qs.length > 0) {
        d.questionnaire = { key: qKey, index: 0, answers: [] as { question: string; answer: string }[] };
        state.stage = "booking_questions";
        await setConvState(userEmail, platform, state);
        await say(
          `Parfait, ${svc.name} ✅\n\nPour bien préparer votre rendez-vous, voici ${qs.length} petites questions (vous pouvez écrire « passer » à tout moment) :\n\n` +
          formatQuestionMessage(qs[0], 0, qs.length)
        );
      } else {
        state.stage = "booking_date";
        await setConvState(userEmail, platform, state);
        await say(`Parfait, ${svc.name} ✅\n\nPour quelle date ? (ex : 2026-10-05, ou « demain »)`);
      }
      return;
    }
    // Questionnaire par catégorie : questions posées UNE PAR UNE (optionnelles)
    if (state.stage === "booking_questions") {
      const questionnaires = await fetchQuestionnaires();
      const qd = d.questionnaire as { key: string; index: number; answers: { question: string; answer: string }[] } | undefined;
      const qs = (qd && questionnaires[qd.key] ? questionnaires[qd.key].questions : []) || [];
      const goToDate = async () => {
        const done = qd ? qd.answers : [];
        delete d.questionnaire;
        if (done.length) d.questionnaireAnswers = done;
        state.stage = "booking_date";
        await setConvState(userEmail, platform, state);
        await say("Merci ! ✅\n\nPour quelle date souhaitez-vous réserver ? (ex : 2026-10-05, ou « demain »)");
      };
      const current = qd ? qs[qd.index] : undefined;
      if (!qd || !current) { await goToDate(); return; }
      const t = norm(text).trim();
      if (/^(passer|suivant|suivante|skip|aucune|non merci|pas de question)/.test(t)) {
        await goToDate();
        return;
      }
      // Réponse libre ; si la cliente répond par un numéro et que la question
      // a des options, on mappe le numéro vers l'option correspondante.
      let answer = text.trim().slice(0, 300);
      if (current.options.length && /^\d+$/.test(t)) {
        const n = parseInt(t, 10);
        if (n >= 1 && n <= current.options.length) answer = current.options[n - 1];
      }
      if (answer) qd.answers.push({ question: current.question, answer });
      qd.index += 1;
      if (qd.index >= qs.length) { await goToDate(); return; }
      await setConvState(userEmail, platform, state);
      await say(formatQuestionMessage(qs[qd.index], qd.index, qs.length));
      return;
    }
    // Date
    if (state.stage === "booking_date") {
      const date = parseDateFr(text);
      if (!date) {
        await say("Je n'ai pas compris la date — donnez-la au format AAAA-MM-JJ (ex : 2026-10-05), ou dites « demain » 🙂");
        return;
      }
      d.date = date;
      state.stage = "booking_time";
      await setConvState(userEmail, platform, state);
      await say("À quelle heure ? (ex : 14:30)");
      return;
    }
    // Heure
    if (state.stage === "booking_time") {
      const time = parseTimeFr(text);
      if (!time) {
        await say("Je n'ai pas compris l'heure — donnez-la au format HH:MM (ex : 14:30) 🙂");
        return;
      }
      d.time = time;
      state.stage = "booking_contact";
      await setConvState(userEmail, platform, state);
      await say("Très bien ✅ Dernière étape : votre prénom et votre téléphone (ex : Aïcha 0612345678)");
      return;
    }
    // Prénom + téléphone → création RÉELLE
    if (state.stage === "booking_contact") {
      const contact = parseContact(text);
      if (!contact) {
        await say("Il me faut votre prénom et un numéro de téléphone (ex : Aïcha 0612345678) 🙂");
        return;
      }
      const svc = d.service as Knowledge["services"][number];
      const date = d.date as string;
      const time = d.time as string;
      const qAnswers = (d.questionnaireAnswers || []) as { question: string; answer: string }[];
      const answersText = qAnswers.map((p) => `${p.question} → ${p.answer}`).join(" ; ");
      try {
        const reservation = await createReservation(k, svc, date, time, contact.name, contact.phone, d.email as string | undefined, answersText || undefined);
        const gOk = await pushGoogleCalendar(k, date, time, reservation.end_time_slot, `${svc.name} — ${contact.name} (via Maria)`, contact.phone);
        await logEvent({
          user_email: userEmail, platform, automation_id: state.automationId,
          event_type: "booking_confirmed",
          meta: { service: svc.name, date, time, google: gOk, via: "webhook" },
        });
        const dateFr = new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        await say(
          `C'est réservé ✅\n${svc.name} — ${dateFr} à ${time}\n\n` +
          (gOk ? "Ajouté à votre Google Agenda 📅 À très vite !" : "Réservation enregistrée dans votre agenda BeautyBook (Google Agenda non connecté)")
        );
      } catch (e) {
        console.error("booking webhook:", e);
        await say("Oups, la réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon.");
      }
      state.stage = "done";
      await setConvState(userEmail, platform, state);
      return;
    }
  }

  // ── Nouveau message : cherche une automatisation correspondante ──
  const { data: autos } = await supabase
    .from("social_automations")
    .select("*")
    .eq("user_email", userEmail)
    .eq("platform", platform)
    .eq("enabled", true);

  let matched: Record<string, unknown> | null = null;
  const triggerKind = commentId ? "comment_keyword" : "dm_keyword";
  for (const a of autos || []) {
    const tt = a.trigger_type as string;
    if (tt === triggerKind) {
      const kw = norm(a.trigger_keyword as string);
      if (kw && norm(text).includes(kw)) { matched = a; break; }
    }
  }

  if (matched) {
    const steps = (matched.steps || {}) as Record<string, { enabled?: boolean; message?: string; button_label?: string }>;
    const newState: ConvState = {
      stage: "awaiting_reply",
      automationId: matched.id as string,
      senderId,
      senderName,
      commentId,
      data: {},
    };
    // 1) DM d'ouverture
    if (steps.opening?.enabled && steps.opening.message) {
      await say(steps.opening.message);
    }
    // 2) Demande de follow (message seul)
    if (steps.follow_ask?.enabled && steps.follow_ask.message) {
      await say(steps.follow_ask.message);
    }
    // 3) Demande d'email → on attend la réponse
    if (steps.email_ask?.enabled && steps.email_ask.message) {
      newState.stage = "awaiting_email";
      await setConvState(userEmail, platform, newState);
      await say(steps.email_ask.message);
      return;
    }
    // Pas d'étape email : on passe direct à la réservation si active
    if (steps.booking?.enabled) {
      newState.stage = "booking_service";
      await setConvState(userEmail, platform, newState);
      const intro = steps.booking.message || "Je peux vous réserver un créneau tout de suite — quel service vous intéresse ?";
      if (k.services.length) {
        const list = k.services.slice(0, 10).map((s, i) => `${i + 1}. ${s.name}${s.price != null ? ` (${s.price}€)` : ""}`).join("\n");
        await say(`${intro}\n${list}`);
      } else {
        await say(intro);
      }
      return;
    }
    // Sinon : envoi du lien configuré
    if (steps.link?.enabled) {
      const lk = steps.link as { message?: string; link_type?: string; link_url?: string; service_id?: string; button_label?: string };
      let url = (lk.link_url || "").trim();
      if (lk.link_type === "service" && lk.service_id) {
        url = `${Deno.env.get("APP_URL") || "https://thelastjiren.vercel.app"}/service/${lk.service_id}`;
      }
      await say(`${lk.message || "Voici votre lien 👇"}${url ? `\n${url}` : ""}`);
    }
    // Relance programmée
    if (steps.followup?.enabled && steps.followup.message) {
      const delayH = steps.followup.delay === "1h" ? 1 : 24;
      const runAt = new Date(Date.now() + delayH * 3600 * 1000).toISOString();
      await logEvent({
        user_email: userEmail, platform, automation_id: matched.id,
        event_type: "pending_followup",
        meta: { sender_id: senderId, sender_name: senderName, comment_id: commentId, run_at: runAt, message: steps.followup.message, done: false },
      });
    }
    newState.stage = "done";
    await setConvState(userEmail, platform, newState);
    return;
  }

  // ── Aucune automatisation : réponse libre via le moteur (vraies données) ──
  const ans = answerQuestion(text, k);
  await say(ans.text);
  if (ans.type === "booking" && k.services.length) {
    const newState: ConvState = {
      stage: "booking_service", automationId: null, senderId,
      senderName, commentId, data: {},
    };
    await setConvState(userEmail, platform, newState);
    const list = k.services.slice(0, 10).map((s, i) => `${i + 1}. ${s.name}${s.price != null ? ` (${s.price}€)` : ""}`).join("\n");
    await say(`Quel service vous intéresse ? Répondez par le numéro :\n${list}`);
  }
}

/* ───────────────────────── Serveur HTTP ───────────────────────── */

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── GET : vérification du webhook Meta ──
  if (req.method === "GET" && !path.endsWith("/followup")) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Verification echouee.", { status: 403 });
  }

  // ── POST /followup : envoie les relances dues (cron) ──
  if (path.endsWith("/followup") && req.method === "POST") {
    try {
      const { data } = await supabase
        .from("social_events")
        .select("id, user_email, platform, automation_id, meta")
        .eq("event_type", "pending_followup")
        .order("created_at", { ascending: true })
        .limit(100);
      const now = new Date().toISOString();
      let sent = 0;
      for (const row of data || []) {
        const m = row.meta as { run_at?: string; done?: boolean; sender_id?: string; message?: string; comment_id?: string };
        if (!m || m.done || !m.run_at || m.run_at > now) continue;
        const { data: conns } = await supabase
          .from("social_connections")
          .select("access_token")
          .eq("user_email", row.user_email)
          .eq("platform", row.platform)
          .limit(1);
        const token = conns?.[0]?.access_token;
        if (token && m.sender_id && m.message) {
          const ok = row.platform === "instagram" && m.comment_id
            ? await sendPrivateReply(token, m.comment_id, m.message)
            : await sendInstagramDM(token, m.sender_id, m.message);
          if (ok) sent++;
        }
        await supabase.from("social_events").update({ meta: { ...m, done: true } }).eq("id", row.id);
        await logEvent({ user_email: row.user_email, platform: row.platform, automation_id: row.automation_id, event_type: "followup_sent", meta: { sender_id: m.sender_id } });
      }
      return json({ ok: true, sent });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Erreur." }, 500);
    }
  }

  // ── POST : événements Meta ──
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      const object = body.object as string; // "instagram" | "page"
      const platform: "instagram" | "facebook" = object === "page" ? "facebook" : "instagram";

      for (const entry of body.entry || []) {
        const entryId = String(entry.id || "");

        // 1) Commentaires : entry.changes[] (field === "comments")
        for (const change of entry.changes || []) {
          if (change.field !== "comments") continue;
          const v = change.value || {};
          const text: string = v.text || "";
          const commentId: string = v.comment_id || v.id || "";
          const senderName: string = v.from?.username || v.from?.id || "visiteur";
          if (!text || !commentId) continue;

          const { data: conns } = await supabase
            .from("social_connections")
            .select("access_token, user_email")
            .or(`platform_user_id.eq.${entryId},account_id.eq.${entryId}`)
            .eq("platform", platform)
            .limit(1);
          const conn = conns?.[0];
          if (!conn) { console.error(`Aucune connexion ${platform} pour entry ${entryId}`); continue; }

          await handleIncoming(conn, platform, `comment:${commentId}`, senderName, text, commentId);
        }

        // 2) Messages : entry.messaging[]
        for (const msg of entry.messaging || []) {
          const senderId: string = msg.sender?.id || "";
          const text: string = msg.message?.text || "";
          const payload: string = msg.postback?.payload || "";
          if (!senderId || (!text && !payload)) continue;
          // Ignore nos propres messages (echo)
          if (msg.message?.is_echo) continue;

          const { data: conns } = await supabase
            .from("social_connections")
            .select("access_token, user_email")
            .or(`platform_user_id.eq.${entryId},account_id.eq.${entryId}`)
            .eq("platform", platform)
            .limit(1);
          const conn = conns?.[0];
          if (!conn) { console.error(`Aucune connexion ${platform} pour entry ${entryId}`); continue; }

          await handleIncoming(conn, platform, senderId, "", text || payload, null);
        }
      }
      return json({ ok: true });
    } catch (e) {
      console.error("webhook:", e);
      return json({ ok: false, error: e instanceof Error ? e.message : "Erreur." }, 500);
    }
  }

  return json({ error: "Route inconnue." }, 404);
});
