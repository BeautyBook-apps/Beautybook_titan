// ─────────────────────────────────────────────────────────────────────────────
// Moteur de réponses partagé de l'assistant conversationnel Maria.
// Utilisé par : la page /social-media (aperçu téléphone), le widget du site
// du salon (AssistantChatWidget) et la logique documentée du webhook.
// Règle d'or : JAMAIS d'invention — seules les données réelles du salon
// (profil, services, horaires, FAQ) sont utilisées pour répondre.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/api/supabaseClient";
import { entities } from "@/api/entities";
import { getEffectiveOpening, formatOpeningHours, isOpenNow } from "@/lib/hours";
import { formatAnswersSummary } from "@/lib/questionnaires";

/** Normalise pour le matching : minuscules + sans accents. */
export function normText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/* ───────────────────────── Base de connaissances ───────────────────────── */

/**
 * Charge la base de connaissances d'un salon depuis ses VRAIES données :
 * ProfilPro (nom, bio, adresse, téléphone), services actifs, horaires
 * effectifs (module hours.js) et FAQ personnalisées.
 */
export async function buildKnowledge(proEmail) {
  const knowledge = {
    proEmail,
    salonName: "",
    ownerName: "",
    bio: "",
    address: "",
    city: "",
    phone: "",
    services: [],
    hoursText: "",
    hoursGroups: [],
    openNow: null,
    faq: [],
    loadedAt: new Date().toISOString(),
  };
  if (!proEmail) return knowledge;

  try {
    const profiles = await entities.ProfilPro.filter({ user_email: proEmail }, "-created_at", 1).catch(() => []);
    const p = profiles && profiles[0];
    if (p) {
      knowledge.ownerName = [p.prenom, p.nom].filter(Boolean).join(" ");
      knowledge.salonName = p.salon_name || knowledge.ownerName || "notre salon";
      knowledge.bio = p.bio || "";
      knowledge.address = p.address || "";
      knowledge.city = p.city || "";
      knowledge.phone = p.phone || "";
      try {
        const ouverture = getEffectiveOpening(p, null);
        const groups = formatOpeningHours(ouverture) || [];
        knowledge.hoursGroups = groups;
        knowledge.hoursText = groups
          .map((g) => `${g.label} : ${g.open ? g.hours : "fermé"}`)
          .join("\n");
      } catch {
        knowledge.hoursGroups = [];
        knowledge.hoursText = "";
      }
      try {
        const ouverture = getEffectiveOpening(p, null);
        knowledge.openNow = isOpenNow(ouverture);
      } catch {
        knowledge.openNow = null;
      }
    }
  } catch {
    /* profil indisponible : on continue avec le reste */
  }

  try {
    const svcs = await entities.Service.filter(
      { pro_email: proEmail, status: "actif" },
      "-created_at",
      100
    ).catch(() => []);
    knowledge.services = (svcs || []).map((s) => ({
      id: s.id,
      name: s.name || s.title || "Prestation",
      price: s.price ?? null,
      duration: s.duration_min || s.duration || 60,
      category: s.category || "",
    }));
  } catch {
    knowledge.services = [];
  }

  knowledge.faq = await loadFaq(proEmail);
  return knowledge;
}

/* ───────────────────────── FAQ personnalisées ───────────────────────── */

const faqKey = (email) => `bb_assistant_faq:${email}`;

/** FAQ : tente Supabase (table social_faq), repli localStorage. */
export async function loadFaq(proEmail) {
  if (!proEmail) return [];
  try {
    const { data, error } = await supabase
      .from("social_faq")
      .select("id, question, answer, created_at")
      .eq("user_email", proEmail)
      .order("created_at", { ascending: true });
    if (!error && data) return data;
  } catch {
    /* table absente ou RLS : repli local */
  }
  try {
    return JSON.parse(localStorage.getItem(faqKey(proEmail)) || "[]");
  } catch {
    return [];
  }
}

function persistFaqLocal(proEmail, list) {
  try {
    localStorage.setItem(faqKey(proEmail), JSON.stringify(list));
  } catch {
    /* stockage indisponible */
  }
}

export async function addFaqEntry(proEmail, question, answer) {
  const q = (question || "").trim();
  const a = (answer || "").trim();
  if (!q || !a) throw new Error("La question et la réponse sont obligatoires.");
  let row = { id: `local-${Date.now()}`, question: q, answer: a, created_at: new Date().toISOString() };
  try {
    const { data, error } = await supabase
      .from("social_faq")
      .insert({ user_email: proEmail, question: q, answer: a })
      .select("id, question, answer, created_at")
      .single();
    if (!error && data) row = data;
  } catch {
    /* repli local */
  }
  const list = [...(await loadFaq(proEmail)), row];
  persistFaqLocal(proEmail, list);
  return row;
}

export async function updateFaqEntry(proEmail, id, question, answer) {
  const q = (question || "").trim();
  const a = (answer || "").trim();
  if (!q || !a) throw new Error("La question et la réponse sont obligatoires.");
  try {
    await supabase.from("social_faq").update({ question: q, answer: a }).eq("id", id);
  } catch {
    /* repli local */
  }
  const list = (await loadFaq(proEmail)).map((f) =>
    String(f.id) === String(id) ? { ...f, question: q, answer: a } : f
  );
  persistFaqLocal(proEmail, list);
  return list;
}

export async function deleteFaqEntry(proEmail, id) {
  try {
    await supabase.from("social_faq").delete().eq("id", id);
  } catch {
    /* repli local */
  }
  const list = (await loadFaq(proEmail)).filter((f) => String(f.id) !== String(id));
  persistFaqLocal(proEmail, list);
  return list;
}

/* ───────────────────────── Moteur de réponses ───────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Détecte une intention de réservation dans un message libre. */
export function detectBookingIntent(text) {
  const t = normText(text);
  return /(reserver|reservation|rendez-vous|\brdv\b|prendre.*(rendez|creaneau|rdv)|je veux.*(venir|passer)|disponib|creaneau|book)/.test(t);
}

function faqMatch(text, faq) {
  const words = normText(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  if (!words.length || !faq.length) return null;
  let best = null;
  let bestScore = 0;
  for (const f of faq) {
    const qWords = new Set(
      normText(f.question).split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    );
    let score = 0;
    for (const w of words) if (qWords.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return bestScore >= 2 ? best : null;
}

function servicesPriceList(services, max = 8) {
  return services
    .slice(0, max)
    .map(
      (s) =>
        `• ${s.name}${s.price != null ? ` — ${s.price}€` : ""}${
          s.duration ? ` (${s.duration} min)` : ""
        }`
    )
    .join("\n");
}

/**
 * Répond à une question libre avec les VRAIES données du salon.
 * Retourne { type, text } où type ∈ greeting|prices|hours|address|phone|
 * services|booking|faq|thanks|bye|fallback.
 * Jamais d'invention : si aucune correspondance, réponse honnête.
 */
export function answerQuestion(text, knowledge) {
  const k = knowledge || {};
  const salon = k.salonName || "notre salon";
  const t = normText(text || "");

  if (!t.trim()) {
    return { type: "fallback", text: `Dites-moi ce que vous cherchez 🙂 Je peux vous renseigner sur nos prestations, nos horaires, ou vous aider à réserver.` };
  }

  // 1) FAQ personnalisées en priorité (matching par mots-clés)
  const faqHit = faqMatch(text, k.faq || []);
  if (faqHit) return { type: "faq", text: faqHit.answer };

  // 2) Intention de réservation → branche réservation
  if (detectBookingIntent(text)) {
    return {
      type: "booking",
      text: `Avec plaisir ! Je peux vous réserver un créneau tout de suite 💛 Dites-moi quel service vous intéresse${k.services?.length ? " :" : "."}`,
    };
  }

  // 3) Salutations
  if (/^(bonjour|salut|coucou|hello|bonsoir|yo)\b/.test(t)) {
    return {
      type: "greeting",
      text: `Bonjour et bienvenue chez ${salon} ! 👋 Je suis Maria, l'assistante du salon. Posez-moi vos questions sur nos prestations, nos prix ou nos horaires — ou dites-moi simplement « je veux réserver ».`,
    };
  }

  // 4) Prix / tarifs
  if (/(prix|tarif|combien|coute|price)/.test(t)) {
    if (k.services?.length) {
      const list = servicesPriceList(k.services);
      const more = k.services.length > 8 ? `\n…et ${k.services.length - 8} autres prestations.` : "";
      return { type: "prices", text: `Voici nos tarifs 💅\n${list}${more}\n\nDites-moi ce qui vous plaît, je peux vous réserver un créneau !` };
    }
    return {
      type: "prices",
      text: `Nos tarifs sont affichés sur la page du salon. Dites-moi quelle prestation vous intéresse et je vous renseigne — ou réservez directement, je m'occupe du reste 💛`,
    };
  }

  // 5) Horaires / ouverture
  if (/(horaire|ouvert|ferme|heure|quand|disponible aujourd|jour)/.test(t)) {
    if (k.hoursText) {
      const status = k.openNow === true ? "\n\nBonne nouvelle : nous sommes ouverts en ce moment 🟢" : k.openNow === false ? "\n\nNous sommes fermés pour le moment, mais je peux déjà vous réserver un créneau 🌙" : "";
      return { type: "hours", text: `Nos horaires 🕐\n${k.hoursText}${status}` };
    }
    return {
      type: "hours",
      text: `Nos horaires sont affichés sur la page du salon. Voulez-vous que je vous réserve un créneau ? Dites-moi simplement « je veux réserver » 💛`,
    };
  }

  // 6) Adresse / localisation
  if (/(adresse|ou etes|situe|venir|acces|localisation|quartier|plan)/.test(t)) {
    const where = [k.address, k.city].filter(Boolean).join(", ");
    if (where) return { type: "address", text: `Vous nous trouverez ici 📍\n${where}` };
    return { type: "address", text: `Notre adresse est indiquée sur la page du salon 📍 Voulez-vous réserver un créneau ?` };
  }

  // 7) Téléphone / contact
  if (/(telephone|tel\b|contact|appeler|numero|joindre)/.test(t)) {
    if (k.phone) return { type: "phone", text: `Vous pouvez nous joindre au ${k.phone} 📞` };
    return { type: "phone", text: `Écrivez-moi ici, je réponds tout de suite 💬 — ou réservez directement, c'est encore plus simple !` };
  }

  // 8) Prestations / services
  if (/(service|prestation|propose|faites|coiffure|ongle|soin|massage|beaute|carte)/.test(t)) {
    if (k.services?.length) {
      const list = k.services.slice(0, 10).map((s) => `• ${s.name}`).join("\n");
      const more = k.services.length > 10 ? `\n…et ${k.services.length - 10} autres.` : "";
      return { type: "services", text: `Voici ce que nous proposons ✨\n${list}${more}\n\nLequel vous tente ? Je peux vous réserver un créneau tout de suite.` };
    }
    return { type: "services", text: `Toutes nos prestations sont listées sur la page du salon ✨ Dites-moi ce qui vous intéresse !` };
  }

  // 9) Remerciements / au revoir
  if (/(merci|thanks)/.test(t)) {
    return { type: "thanks", text: `Avec grand plaisir ! 💛 N'hésitez pas si vous avez d'autres questions — et à très vite chez ${salon}.` };
  }
  if (/(au revoir|bye|a bientot|bonne journee|bonne soiree)/.test(t)) {
    return { type: "bye", text: `À très bientôt chez ${salon} ! 💛` };
  }

  // 10) Réponse honnête : jamais d'invention
  const contact = k.phone ? ` ou appelez-nous au ${k.phone}` : "";
  return {
    type: "fallback",
    text: `Hmm, je ne suis pas sûre de bien comprendre 🤔 Je peux vous renseigner sur nos prestations, nos tarifs et nos horaires — ou vous aider à réserver un créneau${contact}. Que puis-je faire pour vous ?`,
  };
}

export { EMAIL_RE };

/* ───────────────────────── Réservation réelle ───────────────────────── */

/** Calcule l'heure de fin à partir d'une heure de début et d'une durée (min). */
export function addMinutes(timeStr, minutes) {
  const [h, m] = String(timeStr).split(":").map(Number);
  const total = h * 60 + m + (minutes || 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Crée une VRAIE réservation dans la table `Reservation` — EXACTEMENT le même
 * schéma que la page « Gestion agenda » du profil pro et l'assistante vocale
 * (status 'en_attente', source 'maria_assistant'). La réservation apparaît
 * immédiatement dans Gestion agenda (temps réel Supabase).
 */
export async function createAssistantReservation({
  proEmail,
  salonName,
  proName,
  service,
  date, // YYYY-MM-DD
  time, // HH:MM
  clientName,
  clientPhone,
  clientEmail, // optionnel : email capturé plus tôt dans la conversation
  answers, // optionnel : réponses au questionnaire par catégorie (étape 2 du parcours)
}) {
  const digits = String(clientPhone || "").replace(/\D/g, "");
  const svcName = service?.name || service?.title || "Prestation";
  const duration = service?.duration_min || service?.duration || 60;
  // Résumé des réponses au questionnaire (mêmes questions que l'étape 2 web),
  // concaténé aux notes pour le professionnel. Réponses optionnelles.
  const answersSummary = formatAnswersSummary(answers || {}, service || {});
  const baseNotes = `RDV pris via l'assistant conversationnel Maria. Tél client : ${clientPhone}.`;
  const payload = {
    // client_email est NOT NULL : sans email, identifiant déterministe basé
    // sur le téléphone (même convention que l'assistante vocale).
    client_email: clientEmail || `tel:${digits}@phone.local`,
    client_name: clientName,
    pro_email: proEmail,
    pro_name: proName || "",
    service_id: service?.id ?? null,
    service_name: svcName,
    service_price: service?.price ?? 0,
    date,
    time_slot: time,
    duration_min: duration,
    end_time_slot: addMinutes(time, duration),
    persons: 1,
    total_price: service?.price ?? 0,
    payment_type: "surplace",
    payment_status: "non_paye",
    status: "en_attente",
    notes: answersSummary ? `${baseNotes} Préférences : ${answersSummary}` : baseNotes,
    salon_name: salonName || "",
    source: "maria_assistant",
  };
  const { data, error } = await supabase.from("Reservation").insert(payload).select().single();
  if (error) throw new Error(error.message || "Création de la réservation impossible.");
  return data;
}

/**
 * Tente d'ajouter la réservation à Google Agenda en réutilisant la connexion
 * Google du salon sur le serveur vocal (mêmes tokens que la page
 * « Réceptionniste IA » : localStorage voice_server_url + voice_server_admin_token,
 * endpoint POST /api/calendar/event du serveur vocal).
 * Retourne { ok: true } ou { ok: false, reason } — jamais d'exception.
 */
export async function pushToGoogleCalendar({ date, time, endTime, summary, description, clientPhone }) {
  try {
    const base = (localStorage.getItem("voice_server_url") || "").replace(/\/+$/, "");
    if (!base) return { ok: false, reason: "no_server" };
    const adminToken = localStorage.getItem("voice_server_admin_token") || "";
    const headers = adminToken ? { "x-admin-token": adminToken } : {};

    const r1 = await fetch(`${base}/api/salons`, { headers });
    if (!r1.ok) return { ok: false, reason: "server_unreachable" };
    const salons = await r1.json().catch(() => []);
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }));
    const proEmail = session?.user?.email || "";
    const salon =
      (salons || []).find((s) => s.pro_email && proEmail && s.pro_email === proEmail) ||
      (salons || []).find((s) => s.id === localStorage.getItem("voice_server_salon")) ||
      (salons || [])[0];
    if (!salon) return { ok: false, reason: "no_salon" };
    if (!salon.google_connected) return { ok: false, reason: "not_connected" };

    const r2 = await fetch(`${base}/api/calendar/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        salon_id: salon.id,
        summary,
        description,
        date,
        start_time: time,
        end_time: endTime,
        client_phone: clientPhone,
      }),
    });
    const data = await r2.json().catch(() => ({}));
    if (r2.ok && data && data.ok) return { ok: true, link: data.link || null };
    return { ok: false, reason: data?.error || "event_failed" };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

/** Message affiché dans le chat après une réservation (honnête sur Google). */
export function bookingConfirmationText(reservation, googleResult) {
  const dateFr = formatDateFr(reservation.date);
  const recap = `${reservation.service_name} — ${dateFr} à ${reservation.time_slot}`;
  if (googleResult && googleResult.ok) {
    return `C'est réservé ✅\n${recap}\n\nAjouté à votre Google Agenda 📅 À très vite !`;
  }
  return `C'est réservé ✅\n${recap}\n\nRéservation enregistrée dans votre agenda BeautyBook (Google Agenda non connecté)`;
}

/** "2026-09-30" → "mercredi 30 septembre". */
export function formatDateFr(iso) {
  try {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}
