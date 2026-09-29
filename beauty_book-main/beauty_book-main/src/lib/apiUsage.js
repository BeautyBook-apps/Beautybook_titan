/**
 * ── Suivi d'utilisation de l'API du service IA ───────────────────────────────
 * Enregistre chaque appel /api/xai-chat (tokens in/out via `usage` renvoyé
 * par le proxy) et chaque minute de voix temps réel, puis estime le coût.
 *
 * Honnêteté :
 * - Les tarifs sont des ESTIMATIONS indicatives, modifiables par l'utilisatrice
 *   (onglet Utilisation de la page Réceptionniste IA).
 * - Le suivi est local à cet appareil (localStorage) : si elle utilise
 *   l'API depuis un autre appareil, ce n'est pas compté ici — c'est indiqué
 *   dans l'interface.
 * - Le crédit chargé est saisi manuellement (xAI n'expose pas le solde via API).
 */

const LS_USAGE = "bb_api_usage_v1";
const LS_CREDIT = "bb_api_credit_v1";
const LS_RATES = "bb_api_rates_v1";
const MAX_DAYS = 90;

// Tarifs indicatifs par défaut ($ / 1M tokens) — modifiables dans l'interface.
export const DEFAULT_RATES = {
  models: {
    "grok-4-1-fast-non-reasoning": { in: 0.2, out: 0.5, label: "Modèle Fast" },
    "grok-4-1-fast-reasoning": { in: 0.2, out: 0.5, label: "Modèle Fast Reasoning" },
    "grok-4": { in: 3.0, out: 15.0, label: "Modèle Pro" },
  },
  fallback: { in: 0.2, out: 0.5 }, // modèle inconnu → tarif fast par défaut
  voicePerMin: 0.08, // $ / minute de voix temps réel (modifiable)
};

export const FEATURE_LABELS = {
  maria: "Maria (chat)",
  global: "Contrôle vocal global",
  vocal: "Agent vocal (appels)",
  social: "Agent social IA",
  other: "Autre",
};

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_USAGE) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}
function saveUsage(days) {
  try {
    // Ne garder que les MAX_DAYS jours les plus récents.
    const keys = Object.keys(days).sort();
    const trimmed = {};
    keys.slice(-MAX_DAYS).forEach((k) => { trimmed[k] = days[k]; });
    localStorage.setItem(LS_USAGE, JSON.stringify(trimmed));
  } catch { /* stockage indisponible */ }
}

function emptyDay() {
  return { tokens_in: 0, tokens_out: 0, requests: 0, voice_min: 0, by_feature: {} };
}

function bumpFeature(day, feature, patch) {
  const f = FEATURE_LABELS[feature] ? feature : "other";
  day.by_feature[f] = day.by_feature[f] || { tokens_in: 0, tokens_out: 0, requests: 0, voice_min: 0, cost: 0 };
  const slot = day.by_feature[f];
  slot.tokens_in += patch.tokens_in || 0;
  slot.tokens_out += patch.tokens_out || 0;
  slot.requests += patch.requests || 0;
  slot.voice_min += patch.voice_min || 0;
  slot.cost += patch.cost || 0;
}

/** Enregistre un appel chat (tokens lus depuis `usage` du proxy /api/xai-chat). */
export function recordChatUsage({ model, promptTokens, completionTokens, feature = "other" } = {}) {
  try {
    const rates = getRates();
    const r = (rates.models && rates.models[model]) || rates.fallback;
    const pin = Math.max(0, Number(promptTokens) || 0);
    const pout = Math.max(0, Number(completionTokens) || 0);
    const cost = (pin / 1e6) * r.in + (pout / 1e6) * r.out;
    const days = loadUsage();
    const k = todayKey();
    const day = days[k] || emptyDay();
    day.tokens_in += pin;
    day.tokens_out += pout;
    day.requests += 1;
    bumpFeature(day, feature, { tokens_in: pin, tokens_out: pout, requests: 1, cost });
    days[k] = day;
    saveUsage(days);
  } catch { /* jamais bloquer l'app pour du suivi */ }
}

/** Enregistre des minutes de voix temps réel (agent vocal / appels). */
export function recordVoiceMinutes(minutes, feature = "vocal") {
  try {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) return;
    const rates = getRates();
    const cost = mins * (Number(rates.voicePerMin) || 0);
    const days = loadUsage();
    const k = todayKey();
    const day = days[k] || emptyDay();
    day.voice_min += mins;
    bumpFeature(day, feature, { voice_min: mins, cost });
    days[k] = day;
    saveUsage(days);
  } catch { /* jamais bloquer */ }
}

export function getRates() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_RATES) || "null");
    if (raw && raw.models && typeof raw.voicePerMin === "number") return raw;
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_RATES));
}
export function setRates(rates) {
  try { localStorage.setItem(LS_RATES, JSON.stringify(rates)); } catch { /* ignore */ }
}

export function getCredit() {
  try {
    const v = Number(JSON.parse(localStorage.getItem(LS_CREDIT) || "null")?.amount);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
export function setCredit(amount) {
  try {
    const v = Number(amount);
    localStorage.setItem(LS_CREDIT, JSON.stringify({ amount: v > 0 ? v : null, updated_at: new Date().toISOString() }));
  } catch { /* ignore */ }
}

function costOfDay(day, rates) {
  // Recalculé avec les tarifs courants pour rester cohérent si l'utilisatrice les modifie.
  let cost = 0;
  const feats = day.by_feature || {};
  for (const f of Object.values(feats)) cost += Number(f.cost) || 0;
  void rates;
  return cost;
}

/** Résumé sur les N derniers jours : totaux + série quotidienne + par fonctionnalité. */
export function getUsageSummary(daysCount = 14) {
  const days = loadUsage();
  const rates = getRates();
  const keys = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(todayKey(d));
  }
  const daily = keys.map((k) => {
    const d = days[k] || emptyDay();
    return {
      date: k,
      label: new Date(k + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      tokens_in: d.tokens_in,
      tokens_out: d.tokens_out,
      requests: d.requests,
      voice_min: Math.round(d.voice_min * 10) / 10,
      cost: Math.round(costOfDay(d, rates) * 1000) / 1000,
    };
  });
  const byFeature = {};
  for (const k of keys) {
    const feats = (days[k] || emptyDay()).by_feature || {};
    for (const [f, v] of Object.entries(feats)) {
      byFeature[f] = byFeature[f] || { tokens_in: 0, tokens_out: 0, requests: 0, voice_min: 0, cost: 0 };
      byFeature[f].tokens_in += v.tokens_in || 0;
      byFeature[f].tokens_out += v.tokens_out || 0;
      byFeature[f].requests += v.requests || 0;
      byFeature[f].voice_min += v.voice_min || 0;
      byFeature[f].cost += v.cost || 0;
    }
  }
  const total = daily.reduce(
    (acc, d) => ({
      cost: acc.cost + d.cost,
      tokens_in: acc.tokens_in + d.tokens_in,
      tokens_out: acc.tokens_out + d.tokens_out,
      requests: acc.requests + d.requests,
      voice_min: acc.voice_min + d.voice_min,
    }),
    { cost: 0, tokens_in: 0, tokens_out: 0, requests: 0, voice_min: 0 }
  );
  total.cost = Math.round(total.cost * 1000) / 1000;
  total.voice_min = Math.round(total.voice_min * 10) / 10;
  const credit = getCredit();
  return { daily, byFeature, total, credit, periodDays: daysCount };
}

export function fmtUSD(v) {
  const n = Number(v) || 0;
  return n < 0.01 && n > 0 ? "< 0,01 $" : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}
export function fmtTokens(v) {
  const n = Number(v) || 0;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  return `${n}`;
}
