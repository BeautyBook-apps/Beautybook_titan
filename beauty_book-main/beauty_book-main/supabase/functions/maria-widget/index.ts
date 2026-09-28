// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function : maria-widget
// Chatbot Maria embarquable sur le SITE WEB du salon (iframe).
//
// Routes (CORS ouvert : la fonction est faite pour être appelée depuis
// n'importe quel site web) :
//   GET  /                         -> santé
//   GET  /knowledge?code=<code>    -> données PUBLIQUES du salon
//                                    (nom, bio, horaires, services, FAQ)
//   POST /chat                     -> { code, message } -> { reply, type }
//                                    répond avec les VRAIES données du salon
//   POST /book                     -> { code, serviceId, date, time, name,
//                                    phone, email? } -> crée la VRAIE
//                                    réservation (table Reservation,
//                                    source 'maria_widget', status
//                                    'en_attente' → visible dans
//                                    « Gestion agenda ») + Google Agenda
//                                    si le salon l'a connecté.
//
// Le <code> est l'email pro encodé en base64url (généré depuis la page
// « Assistant conversationnel »). La fonction travaille avec la
// service_role key : aucune modification RLS n'est nécessaire.
//
// Secrets requis (supabase secrets set) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   (optionnel) VOICE_SERVER_URL, VOICE_SERVER_ADMIN_TOKEN
//   → pour pousser les réservations vers Google Agenda via le serveur vocal.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VOICE_SERVER_URL = (Deno.env.get("VOICE_SERVER_URL") || "").replace(/\/+$/, "");
const VOICE_ADMIN_TOKEN = Deno.env.get("VOICE_SERVER_ADMIN_TOKEN") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* ───────────────────────── Utilitaires ───────────────────────── */

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** code base64url -> email pro (ou null si invalide). */
function decodeCode(code: string): string | null {
  try {
    const b64 = String(code || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const email = new TextDecoder().decode(bytes).trim().toLowerCase();
    return EMAIL_RE.test(email) ? email : null;
  } catch {
    return null;
  }
}

function detectBookingIntent(text: string): boolean {
  const t = norm(text);
  return /(reserver|reservation|rendez-vous|\brdv\b|prendre.*(rendez|creaneau|rdv)|je veux.*(venir|passer)|disponib|creaneau|book)/.test(t);
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatDateFr(iso: string): string {
  try {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return iso;
  }
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

/** Formate les réponses au questionnaire en "Question → Réponse ; ...". */
function formatAnswersText(answers: unknown, idToQuestion: Map<string, string>): string {
  const pairs: [string, string][] = [];
  const pushPair = (q: string, r: string) => {
    const qq = q.trim(), rr = r.trim();
    if (qq && rr) pairs.push([qq, rr]);
  };
  if (Array.isArray(answers)) {
    for (const a of answers) {
      if (a && typeof a === "object") {
        const o = a as Record<string, unknown>;
        const r = String(o.answer ?? o.reponse ?? o.a ?? "");
        const q = String(o.question ?? o.q ?? "");
        if (q) pushPair(q, r);
        else if (o.id) pushPair(idToQuestion.get(String(o.id)) || String(o.id), r);
      }
    }
  } else if (answers && typeof answers === "object") {
    for (const [id, v] of Object.entries(answers as Record<string, unknown>)) {
      pushPair(idToQuestion.get(id) || id, String(v ?? ""));
    }
  }
  return pairs.map(([q, r]) => `${q} → ${r}`).join(" ; ");
}

/* ───────────────────────── Connaissances ───────────────────────── */

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
  monday: "Lundi", tuesday: "Mardi", wednesday: "Mercredi", thursday: "Jeudi",
  friday: "Vendredi", saturday: "Samedi", sunday: "Dimanche",
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

/** Répond avec les vraies données du salon (même moteur que social-webhook). */
function answerQuestion(text: string, k: Knowledge): { type: string; text: string } {
  const salon = k.salonName || "notre salon";
  const t = norm(text || "");
  if (!t.trim()) {
    return { type: "fallback", text: "Dites-moi ce que vous cherchez 🙂 Je peux vous renseigner sur nos prestations, nos horaires, ou vous aider à réserver." };
  }
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

/* ───────────────────────── Réservation ───────────────────────── */

async function createReservation(
  k: Knowledge,
  service: Knowledge["services"][number],
  date: string, time: string,
  clientName: string, clientPhone: string, clientEmail?: string,
  answersText?: string,
) {
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
    notes: `RDV pris via le chatbot Maria du site web du salon. Tél client : ${clientPhone}.${answersText ? ` Réponses questionnaire : ${answersText}.` : ""}`,
    salon_name: k.salonName,
    source: "maria_widget",
  };
  const { data, error } = await supabase.from("Reservation").insert(payload).select().single();
  if (error) throw new Error(`Reservation: ${error.message}`);
  return data as Record<string, unknown>;
}

async function pushGoogleCalendar(
  k: Knowledge, date: string, time: string, endTime: string, summary: string, clientPhone: string,
): Promise<boolean> {
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
        description: "Réservation prise via le chatbot Maria du site web du salon (BeautyBook).",
        date, start_time: time, end_time: endTime, client_phone: clientPhone,
      }),
    });
    const data = await r2.json().catch(() => ({}));
    return !!(r2.ok && (data as { ok?: boolean })?.ok);
  } catch (e) {
    console.error("pushGoogleCalendar:", e);
    return false;
  }
}

/* ───────────────────────── Anti-abus basique ───────────────────────── */

const bookHits = new Map<string, number[]>();
function bookAllowed(ip: string): boolean {
  const now = Date.now();
  const arr = (bookHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (arr.length >= 10) return false; // max 10 réservations / 10 min / IP
  arr.push(now);
  bookHits.set(ip, arr);
  return true;
}

/* ───────────────────────── Routes ───────────────────────── */

serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (req.method === "GET" && (path === "/" || path === "/maria-widget")) {
    return json({ ok: true, service: "maria-widget", version: "1.0.0" });
  }

  // GET /knowledge?code=...
  if (req.method === "GET" && path.endsWith("/knowledge")) {
    const email = decodeCode(url.searchParams.get("code") || "");
    if (!email) return json({ ok: false, error: "code invalide" }, 400);
    const k = await buildKnowledge(email);
    if (!k.salonName && !k.services.length) {
      return json({ ok: false, error: "salon introuvable" }, 404);
    }
    return json({
      ok: true,
      salonName: k.salonName,
      bio: k.bio,
      address: k.address,
      city: k.city,
      phone: k.phone,
      hoursText: k.hoursText,
      services: k.services,
    });
  }

  // GET /questions?category=xxx  (ou ?service_id= + ?code=)
  // Retourne les questions du questionnaire de la catégorie
  // (synchro avec l'étape 2 du parcours de réservation web).
  if (req.method === "GET" && path.endsWith("/questions")) {
    const questionnaires = await fetchQuestionnaires();
    const categoryParam = url.searchParams.get("category") || "";
    const serviceId = url.searchParams.get("service_id") || "";
    const code = url.searchParams.get("code") || "";
    let key = "";
    if (serviceId && code) {
      const email = decodeCode(code);
      if (email) {
        const k = await buildKnowledge(email);
        const svc = k.services.find((s) => s.id === serviceId);
        if (svc) key = detectCategoryKey(svc.category, svc.name, questionnaires);
      }
    }
    if (!key) key = detectCategoryKey(categoryParam, "", questionnaires);
    const cat = key ? questionnaires[key] : undefined;
    if (!cat) return json({ ok: false, error: "Aucune question pour cette catégorie." }, 404);
    return json({ ok: true, category: key, label: cat.label, tip: cat.tip || null, questions: cat.questions });
  }

  // POST /chat
  if (req.method === "POST" && path.endsWith("/chat")) {
    const body = await req.json().catch(() => ({})) as { code?: string; message?: string };
    const email = decodeCode(body.code || "");
    if (!email) return json({ ok: false, error: "code invalide" }, 400);
    const message = String(body.message || "").slice(0, 500);
    const k = await buildKnowledge(email);
    const ans = answerQuestion(message, k);
    return json({ ok: true, reply: ans.text, type: ans.type, bookingIntent: ans.type === "booking" || detectBookingIntent(message) });
  }

  // POST /book
  if (req.method === "POST" && path.endsWith("/book")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!bookAllowed(ip)) return json({ ok: false, error: "Trop de tentatives, réessayez dans quelques minutes." }, 429);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const email = decodeCode(String(body.code || ""));
    if (!email) return json({ ok: false, error: "code invalide" }, 400);

    const serviceId = String(body.serviceId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const clientEmail = String(body.email || "").trim();

    const k = await buildKnowledge(email);
    if (!k.salonName && !k.services.length) return json({ ok: false, error: "salon introuvable" }, 404);
    const service = k.services.find((s) => s.id === serviceId);
    if (!service) return json({ ok: false, error: "Service invalide." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false, error: "Date invalide." }, 400);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(`${date}T00:00:00`);
    if (isNaN(d.getTime()) || d < today) return json({ ok: false, error: "La date doit être aujourd'hui ou plus tard." }, 400);
    if (d.getTime() - today.getTime() > 120 * 864e5) return json({ ok: false, error: "Date trop éloignée (120 jours max)." }, 400);
    if (!/^\d{2}:\d{2}$/.test(time)) return json({ ok: false, error: "Heure invalide." }, 400);
    if (name.length < 2) return json({ ok: false, error: "Indiquez votre prénom." }, 400);
    if (phone.replace(/\D/g, "").length < 8) return json({ ok: false, error: "Numéro de téléphone incomplet." }, 400);
    if (clientEmail && !EMAIL_RE.test(clientEmail)) return json({ ok: false, error: "Cet email ne semble pas valide." }, 400);

    // Réponses au questionnaire (optionnel) : "Q → R ; ..." concaténé aux notes.
    // Accepte [{ question, answer }] ou { <id_question>: <reponse> }.
    let answersText = "";
    if (body.answers !== undefined) {
      const questionnaires = await fetchQuestionnaires();
      const qKey = detectCategoryKey(service.category, service.name, questionnaires);
      const idToQuestion = new Map<string, string>();
      const qs = (qKey && questionnaires[qKey] ? questionnaires[qKey].questions : []) || [];
      for (const q of qs) if (q.id) idToQuestion.set(q.id, q.question);
      answersText = formatAnswersText(body.answers, idToQuestion);
    }

    try {
      const reservation = await createReservation(k, service, date, time, name, phone, clientEmail || undefined, answersText || undefined);
      const endTime = String(reservation.end_time_slot || addMinutes(time, service.duration));
      const googleOk = await pushGoogleCalendar(k, date, time, endTime, `${service.name} — ${name} (via Maria, site web)`, phone);
      const dateFr = formatDateFr(date);
      return json({
        ok: true,
        reservation: { id: reservation.id, service: service.name, date, time, name },
        confirmation: `C'est réservé ✅\n${service.name} — ${dateFr} à ${time}\n\nRéservation enregistrée dans l'agenda du salon${googleOk ? " et Google Agenda" : ""} 📅 À très vite !`,
        googleCalendar: googleOk,
      });
    } catch (e) {
      console.error("book:", e);
      return json({ ok: false, error: "La réservation n'a pas pu être enregistrée. Réessayez ou contactez directement le salon." }, 500);
    }
  }

  return json({ ok: false, error: "route inconnue" }, 404);
});
