// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function : social-webhook
// Reçoit les événements Meta (Instagram / Facebook / WhatsApp) et fait répondre
// l'AGENT SOCIAL IA aux DMs et commentaires EN CONDITIONS RÉELLES.
//
// Nouveau principe (2026-09-30) : PLUS AUCUN mot-clé, PLUS AUCUNE automatisation.
// L'assistant SUIT les INSTRUCTIONS du salon (table `social_agent_config`, configurées
// dans la page « Agent Social IA »), avec les VRAIES données du salon
// (prestations, tarifs, durées, horaires, adresse, FAQ) — jamais d'invention.
//
// Routes :
//   GET  /                        -> vérification du webhook Meta
//                                    (hub.mode=subscribe, hub.verify_token)
//   POST /                        -> événements Instagram/Facebook/WhatsApp
//                                    (commentaires + messages)
//   POST /followup                -> envoie les relances dues
//                                    (à appeler via cron, ex. toutes les heures)
//
// Secrets requis (supabase secrets set) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERIFY_TOKEN, XAI_API_KEY
//   (optionnel) VOICE_SERVER_URL, VOICE_SERVER_ADMIN_TOKEN
//   → pour pousser les réservations vers Google Agenda via le serveur vocal.
//
// Parcours réservation : quand l'assistant détecte une intention de réservation, il
// préfixe sa réponse par [RÉSERVER] ; la machine à états prend alors le relais
// (service → questionnaire optionnel → date → heure → prénom/téléphone) puis
// crée la RÉSERVATION RÉELLE (table Reservation, source 'maria_assistant',
// visible dans « Gestion agenda ») + Google Agenda si connecté.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") ?? "";
const XAI_API_KEY = Deno.env.get("XAI_API_KEY") ?? "";
const VOICE_SERVER_URL = (Deno.env.get("VOICE_SERVER_URL") || "").replace(/\/+$/, "");
const VOICE_ADMIN_TOKEN = Deno.env.get("VOICE_SERVER_ADMIN_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const GRAPH = "https://graph.facebook.com/v21.0";
const XAI_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4-1-fast-non-reasoning";

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
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;

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

/* ───────────────────────── Config de l'agent social ───────────────────────── */

type AgentConfig = {
  enabled: boolean;
  instructions: string;
  tone: string;
  dm: Record<string, boolean>;
  comments: Record<string, boolean>;
};

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: true,
  instructions: "",
  tone: "chaleureux",
  dm: { instagram: true, facebook: true, whatsapp: true },
  comments: { instagram: true, facebook: true },
};

async function loadAgentConfig(userEmail: string): Promise<AgentConfig> {
  try {
    const { data } = await supabase
      .from("social_agent_config")
      .select("enabled, instructions, tone, dm_enabled, comments_enabled, platforms")
      .eq("pro_email", userEmail.toLowerCase())
      .maybeSingle();
    if (!data) return { ...DEFAULT_AGENT_CONFIG };
    const plats = (data.platforms || {}) as { dm?: Record<string, boolean>; comments?: Record<string, boolean> };
    return {
      enabled: data.enabled !== false,
      instructions: String(data.instructions || ""),
      tone: String(data.tone || "chaleureux"),
      dm: plats.dm || { instagram: !!data.dm_enabled, facebook: !!data.dm_enabled, whatsapp: !!data.dm_enabled },
      comments: plats.comments || { instagram: !!data.comments_enabled, facebook: !!data.comments_enabled },
    };
  } catch {
    // Table absente (migration non exécutée) : agent actif avec instructions par défaut.
    return { ...DEFAULT_AGENT_CONFIG };
  }
}

const TONE_LABELS: Record<string, string> = {
  chaleureux: "Chaleureux & convivial",
  pro: "Professionnel & rassurant",
  fun: "Fun & décontracté",
  luxe: "Premium & raffiné",
};

function defaultSocialInstructions(salonName: string): string {
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

/** Construit le prompt système de l'agent : instructions du salon + VRAIES données. */
function buildSystemPrompt(cfg: AgentConfig, k: Knowledge, isComment: boolean): string {
  const base = cfg.instructions.trim() || defaultSocialInstructions(k.salonName);
  const tone = TONE_LABELS[cfg.tone] || TONE_LABELS.chaleureux;

  const svcLines = k.services.slice(0, 40).map((s) =>
    `- ${s.name}${s.price != null ? ` : ${s.price}€` : ""}${s.duration ? ` (${s.duration} min)` : ""}`
  );
  const faqLines = k.faq.slice(0, 20).map((f) => `Q: ${f.question}\nR: ${f.answer}`);
  const infoBits: string[] = [];
  if (k.address || k.city) infoBits.push(`Adresse : ${[k.address, k.city].filter(Boolean).join(", ")}`);
  if (k.phone) infoBits.push(`Téléphone : ${k.phone}`);
  if (k.hoursText) infoBits.push(`Horaires :\n${k.hoursText}`);

  const todayFr = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return `${base}

TONALITÉ SOUHAITÉE : ${tone}.

DONNÉES RÉELLES DU SALON (à utiliser telles quelles, ne rien inventer) :
${svcLines.length ? `Prestations :\n${svcLines.join("\n")}` : "Prestations : non renseignées — invite à demander au salon."}
${faqLines.length ? `\nQuestions fréquentes :\n${faqLines.join("\n")}` : ""}
${infoBits.length ? `\n${infoBits.join("\n")}` : ""}

Date du jour : ${todayFr}.

MODE OPÉRATOIRE (à suivre impérativement) :
- ${isComment ? "Ceci est un COMMENTAIRE PUBLIC : réponds avec chaleur et invite à continuer en message privé pour les détails." : "Ceci est un MESSAGE PRIVÉ : réponds directement et pose UNE question à la fois."}
- Si la personne veut réserver, demande un créneau ou des disponibilités, commence ta réponse par [RÉSERVER] puis réponds normalement.
- Ne mets JAMAIS [RÉSERVER] pour une simple question d'information (prix, horaires, adresse).
- Si la personne donne son email, remercie-la simplement (la capture est gérée par le salon).`;
}

/** Appelle l'assistant avec les instructions du salon + l'historique de conversation. */
/** Clé API vocale propre au salon (sinon clé BeautyBook XAI_API_KEY). */
async function getSalonApiKey(userEmail: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("salon_ai_settings")
      .select("voice_api_key")
      .eq("pro_email", userEmail)
      .maybeSingle();
    const k = String((data as { voice_api_key?: string } | null)?.voice_api_key || "").trim();
    if (k) return k;
  } catch { /* repli clé globale */ }
  return XAI_API_KEY;
}
async function callGrok(system: string, history: { role: string; text: string }[], message: string, salonApiKey?: string): Promise<string> {
  const apiKey = salonApiKey || XAI_API_KEY;
  if (!apiKey) {
    throw new Error("Clé du service IA manquante : ajoutez-la via `supabase secrets set XAI_API_KEY=...` ou dans la page Réceptionniste IA du salon.");
  }
  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROK_MODEL,
      temperature: 0.7,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        ...history.slice(-8).map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: h.text })),
        { role: "user", content: message },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Assistant indisponible (${detail}). Réessayez dans un moment.`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) throw new Error("L'assistant n'a pas généré de réponse. Réessayez.");
  return String(text).trim();
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

/** Envoie un message WhatsApp via l'API Cloud. */
async function sendWhatsAppMessage(userToken: string, phoneNumberId: string, to: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages?access_token=${encodeURIComponent(userToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.error("sendWhatsAppMessage:", JSON.stringify(data));
    return res.ok;
  } catch (e) {
    console.error("sendWhatsAppMessage:", e);
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
    notes: `RDV pris via l'agent social IA (DM/commentaire). Tél client : ${clientPhone}.${answersText ? ` Réponses questionnaire : ${answersText}.` : ""}`,
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
        description: "Réservation prise via l'agent social IA (BeautyBook).",
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

/* ───────── Questionnaires par catégorie (synchro étape 2 web) ───────── */

const QUESTIONNAIRES_URL = "https://thelastjiren.vercel.app/questionnaires.json";
const Q_CACHE_TTL = 6 * 3600 * 1000; // 6 h

type QuestionnaireQuestion = { id: string; question: string; options: string[] };
type QuestionnaireCategory = { label: string; tip?: string; questions: QuestionnaireQuestion[] };

let qCache: { at: number; data: Record<string, QuestionnaireCategory> } | null = null;

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

/* ───────────────────────── État de conversation + historique ───────────────────────── */

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

/** Historique récent des échanges avec cet expéditeur (pour l'assistant). */
async function getHistory(userEmail: string, senderId: string): Promise<{ role: string; text: string }[]> {
  try {
    const { data } = await supabase
      .from("social_events")
      .select("event_type, meta")
      .eq("user_email", userEmail)
      .in("event_type", ["message_in", "agent_reply"])
      .order("created_at", { ascending: false })
      .limit(60);
    const out: { role: string; text: string }[] = [];
    for (const row of (data || []).reverse()) {
      const m = (row.meta || {}) as { sender_id?: string; text?: string };
      if (m.sender_id !== senderId || !m.text) continue;
      out.push({ role: row.event_type === "message_in" ? "user" : "assistant", text: m.text });
      if (out.length >= 10) out.shift();
    }
    return out;
  } catch {
    return [];
  }
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

/* ───────────────────────── Traitement d'un message entrant ───────────────────────── */

type Conn = { access_token: string; user_email: string; phone_number_id?: string };

/** Envoie un message au bon canal (DM Instagram / réponse privée au commentaire / WhatsApp). */
async function replyToSender(conn: Conn, state: ConvState, text: string, platform: "instagram" | "facebook" | "whatsapp"): Promise<void> {
  if (platform === "whatsapp" && conn.phone_number_id) {
    await sendWhatsAppMessage(conn.access_token, conn.phone_number_id, state.senderId, text);
  } else if (platform === "instagram" && state.commentId) {
    await sendPrivateReply(conn.access_token, state.commentId, text);
  } else {
    await sendInstagramDM(conn.access_token, state.senderId, text);
  }
}

/** Capture un email donné spontanément dans un message (lead réel). */
async function captureEmailFromText(userEmail: string, platform: string, senderId: string, senderName: string, text: string): Promise<boolean> {
  const m = text.match(EMAIL_RE);
  if (!m) return false;
  try {
    const { data: existing } = await supabase
      .from("social_leads")
      .select("id")
      .eq("user_email", userEmail)
      .eq("email", m[0])
      .limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from("social_leads").insert({
        user_email: userEmail, platform, automation_id: null,
        email: m[0], pseudo: senderName || null,
      });
      await logEvent({ user_email: userEmail, platform, automation_id: null, event_type: "email_captured", meta: { email: m[0], sender_id: senderId } });
    }
    return true;
  } catch {
    return false;
  }
}

function serviceListText(services: Knowledge["services"]): string {
  return services.slice(0, 10).map((s, i) => `${i + 1}. ${s.name}${s.price != null ? ` (${s.price}€)` : ""}`).join("\n");
}

async function handleIncoming(
  conn: Conn,
  platform: "instagram" | "facebook" | "whatsapp",
  senderId: string,
  senderName: string,
  text: string,
  commentId: string | null
) {
  const userEmail = conn.user_email;
  const isComment = !!commentId;
  const k = await buildKnowledge(userEmail);
  const cfg = await loadAgentConfig(userEmail);

  await logEvent({ user_email: userEmail, platform, automation_id: null, event_type: "message_in", meta: { sender_id: senderId, sender_name: senderName, text: text.slice(0, 500), comment_id: commentId } });

  // Agent en pause ou canal désactivé → on ne répond pas (reprise manuelle).
  const channelOk = isComment ? cfg.comments[platform] !== false : cfg.dm[platform] !== false;
  if (!cfg.enabled || !channelOk) return;

  // Capture d'email spontanée (lead réel), quel que soit le contexte.
  const gotEmail = await captureEmailFromText(userEmail, platform, senderId, senderName, text);

  const state = await getConvState(userEmail, senderId);
  const say = (t: string) => replyToSender(conn, { ...(state as ConvState), senderId, commentId: state?.commentId ?? commentId } as ConvState, t, platform);
  const logReply = (t: string) => logEvent({ user_email: userEmail, platform, automation_id: null, event_type: "agent_reply", meta: { sender_id: senderId, text: t.slice(0, 500), via: "assistant" } });

  // ── Suite d'un parcours de réservation en cours (machine à états) ──
  if (state && state.stage !== "done") {
    const d = state.data;
    // Choix du service
    if (state.stage === "booking_service") {
      const n = parseInt(norm(text), 10);
      let svc: Knowledge["services"][number] | null = null;
      if (n >= 1 && n <= k.services.length) svc = k.services[n - 1];
      else svc = k.services.find((s) => norm(s.name).includes(norm(text)) || norm(text).includes(norm(s.name))) || null;
      if (!svc) {
        const t = "Je n'ai pas bien compris — répondez par le numéro du service 🙂";
        await say(t); await logReply(t);
        return;
      }
      d.service = svc;
      const questionnaires = await fetchQuestionnaires();
      const qKey = detectCategoryKey(svc.category, svc.name, questionnaires);
      const qs = (qKey && questionnaires[qKey] ? questionnaires[qKey].questions : []) || [];
      if (qs.length > 0) {
        d.questionnaire = { key: qKey, index: 0, answers: [] as { question: string; answer: string }[] };
        state.stage = "booking_questions";
        await setConvState(userEmail, platform, state);
        const t = `Parfait, ${svc.name} ✅\n\nPour bien préparer votre rendez-vous, voici ${qs.length} petites questions (écrivez « passer » pour ignorer) :\n\n` + formatQuestionMessage(qs[0], 0, qs.length);
        await say(t); await logReply(t);
      } else {
        state.stage = "booking_date";
        await setConvState(userEmail, platform, state);
        const t = `Parfait, ${svc.name} ✅\n\nPour quelle date ? (ex : 2026-10-05, ou « demain »)`;
        await say(t); await logReply(t);
      }
      return;
    }
    // Questionnaire (optionnel)
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
        const t = "Merci ! ✅\n\nPour quelle date souhaitez-vous réserver ? (ex : 2026-10-05, ou « demain »)";
        await say(t); await logReply(t);
      };
      const current = qd ? qs[qd.index] : undefined;
      if (!qd || !current) { await goToDate(); return; }
      const tn = norm(text).trim();
      if (/^(passer|suivant|suivante|skip|aucune|non merci|pas de question)/.test(tn)) { await goToDate(); return; }
      let answer = text.trim().slice(0, 300);
      if (current.options.length && /^\d+$/.test(tn)) {
        const n = parseInt(tn, 10);
        if (n >= 1 && n <= current.options.length) answer = current.options[n - 1];
      }
      if (answer) qd.answers.push({ question: current.question, answer });
      qd.index += 1;
      if (qd.index >= qs.length) { await goToDate(); return; }
      await setConvState(userEmail, platform, state);
      const t = formatQuestionMessage(qs[qd.index], qd.index, qs.length);
      await say(t); await logReply(t);
      return;
    }
    // Date
    if (state.stage === "booking_date") {
      const date = parseDateFr(text);
      if (!date) {
        const t = "Je n'ai pas compris la date — donnez-la au format AAAA-MM-JJ (ex : 2026-10-05), ou dites « demain » 🙂";
        await say(t); await logReply(t);
        return;
      }
      d.date = date;
      state.stage = "booking_time";
      await setConvState(userEmail, platform, state);
      const t = "À quelle heure ? (ex : 14:30)";
      await say(t); await logReply(t);
      return;
    }
    // Heure
    if (state.stage === "booking_time") {
      const time = parseTimeFr(text);
      if (!time) {
        const t = "Je n'ai pas compris l'heure — donnez-la au format HH:MM (ex : 14:30) 🙂";
        await say(t); await logReply(t);
        return;
      }
      d.time = time;
      state.stage = "booking_contact";
      await setConvState(userEmail, platform, state);
      const t = "Très bien ✅ Dernière étape : votre prénom et votre téléphone (ex : Aïcha 0612345678)";
      await say(t); await logReply(t);
      return;
    }
    // Prénom + téléphone → création RÉELLE
    if (state.stage === "booking_contact") {
      const contact = parseContact(text);
      if (!contact) {
        const t = "Il me faut votre prénom et un numéro de téléphone (ex : Aïcha 0612345678) 🙂";
        await say(t); await logReply(t);
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
          user_email: userEmail, platform, automation_id: null,
          event_type: "booking_confirmed",
          meta: { service: svc.name, date, time, google: gOk, via: "webhook" },
        });
        const dateFr = new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        const t = `C'est réservé ✅\n${svc.name} — ${dateFr} à ${time}\n\n` +
          (gOk ? "Ajouté à votre Google Agenda 📅 À très vite !" : "Réservation enregistrée dans votre agenda BeautyBook (Google Agenda non connecté)");
        await say(t); await logReply(t);
      } catch (e) {
        console.error("booking webhook:", e);
        const t = "Oups, la réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon.";
        await say(t); await logReply(t);
      }
      state.stage = "done";
      await setConvState(userEmail, platform, state);
      return;
    }
  }

  // ── Nouveau message : l'assistant répond avec les instructions du salon ──
  try {
    const system = buildSystemPrompt(cfg, k, isComment);
    const history = await getHistory(userEmail, senderId);
    const salonKey = await getSalonApiKey(userEmail);
    const raw = await callGrok(system, history, text, salonKey);

    let reply = raw;
    let wantsBooking = false;
    if (/^\s*\[RÉSERVER\]/i.test(reply)) {
      wantsBooking = true;
      reply = reply.replace(/^\s*\[RÉSERVER\]\s*/i, "");
    }
    if (!reply.trim()) reply = "Dites-moi ce que vous cherchez 🙂 Je peux vous renseigner sur nos prestations, nos horaires, ou vous aider à réserver.";
    if (gotEmail) reply += "\n\nVotre email est bien noté ✅ Je vous recontacterai si besoin.";

    await say(reply);
    await logReply(reply);

    // L'assistant a détecté une intention de réservation → parcours guidé réel.
    if (wantsBooking && k.services.length) {
      const newState: ConvState = {
        stage: "booking_service", automationId: null, senderId,
        senderName, commentId, data: {},
      };
      await setConvState(userEmail, platform, newState);
      const t = `Quel service vous intéresse ? Répondez par le numéro :\n${serviceListText(k.services)}`;
      await say(t); await logReply(t);
    }
  } catch (e) {
    console.error("social reply:", e);
    // Échec honnête : on ne prétend pas avoir répondu, on le dit.
    const t = e instanceof Error && e.message.includes("Clé du service IA")
      ? "Bonjour ! 👋 L'assistant IA n'est pas encore configuré (clé manquante). Écrivez-nous directement, on vous répond très vite."
      : "Oups, je suis momentanément indisponible 😔 Réessayez dans un instant, ou contactez directement le salon.";
    try { await say(t); await logReply(t); } catch { /* ignore */ }
  }
}

/* ───────────────────────── Serveur HTTP ───────────────────────── */

async function findConn(platform: string, entryId: string, phoneNumberId?: string): Promise<Conn | null> {
  try {
    let query = supabase
      .from("social_connections")
      .select("access_token, user_email, platform_user_id")
      .eq("platform", platform)
      .limit(1);
    if (phoneNumberId) {
      query = query.eq("platform_user_id", phoneNumberId);
    } else {
      query = query.or(`platform_user_id.eq.${entryId},account_id.eq.${entryId}`);
    }
    const { data: conns } = await query;
    const c = conns?.[0];
    if (!c) return null;
    return { access_token: c.access_token, user_email: c.user_email, phone_number_id: c.platform_user_id };
  } catch {
    return null;
  }
}

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
        const m = row.meta as { run_at?: string; done?: boolean; sender_id?: string; message?: string; comment_id?: string; phone_number_id?: string };
        if (!m || m.done || !m.run_at || m.run_at > now) continue;
        const conn = await findConn(row.platform, "", m.phone_number_id);
        const token = conn?.access_token;
        if (token && m.sender_id && m.message) {
          let ok = false;
          if (row.platform === "whatsapp" && m.phone_number_id) {
            ok = await sendWhatsAppMessage(token, m.phone_number_id, m.sender_id, m.message);
          } else if (row.platform === "instagram" && m.comment_id) {
            ok = await sendPrivateReply(token, m.comment_id, m.message);
          } else {
            ok = await sendInstagramDM(token, m.sender_id, m.message);
          }
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
      const object = body.object as string; // "instagram" | "page" | "whatsapp_business_account"
      const platform: "instagram" | "facebook" | "whatsapp" =
        object === "page" ? "facebook" : object === "whatsapp_business_account" ? "whatsapp" : "instagram";

      for (const entry of body.entry || []) {
        const entryId = String(entry.id || "");

        // 0) WhatsApp : entry.changes[] (field === "messages")
        if (platform === "whatsapp") {
          for (const change of entry.changes || []) {
            if (change.field !== "messages") continue;
            const v = change.value || {};
            const phoneNumberId: string = v.metadata?.phone_number_id || "";
            if (!phoneNumberId) continue;
            const conn = await findConn("whatsapp", entryId, phoneNumberId);
            if (!conn) { console.error(`Aucune connexion whatsapp pour ${phoneNumberId}`); continue; }
            for (const m of v.messages || []) {
              const from: string = m.from || "";
              const text: string = m.text?.body || "";
              if (!from || !text) continue;
              if (m.type === "text") {
                await handleIncoming(conn, "whatsapp", from, "", text, null);
              }
            }
          }
          continue;
        }

        // 1) Commentaires : entry.changes[] (field === "comments")
        for (const change of entry.changes || []) {
          if (change.field !== "comments") continue;
          const v = change.value || {};
          const text: string = v.text || "";
          const commentId: string = v.comment_id || v.id || "";
          const senderName: string = v.from?.username || v.from?.id || "visiteur";
          if (!text || !commentId) continue;

          const conn = await findConn(platform, entryId);
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

          const conn = await findConn(platform, entryId);
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
