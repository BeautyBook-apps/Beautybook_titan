// ─── Réglages IA par salon ──────────────────────────────────────────────────
// Chaque salon (pro_email) possède ses propres réglages :
//   - vocal_enabled   : l'agent vocal « Parler à l'agent » est actif ou non
//   - chatbot_enabled : le widget « Discuter avec Maria » (site web du pro)
//   - appel_interne   : si actif, les appels passés DANS l'application sont
//                       décrochés par l'agent vocal IA (si vocal_enabled)
//   - agent_id        : identifiant de l'agent vocal distant du salon (console du fournisseur)
//   - voice           : voix utilisée en mode direct
//
// Stockage : localStorage immédiat (clé par salon) + table Supabase
// `salon_ai_settings` en tâche de fond (le plus récent gagne). Sans la
// migration, tout fonctionne en local ; avec, les visiteurs voient aussi
// l'état du chatbot.
import { supabase } from "@/api/supabaseClient";
import { DEFAULT_AGENT_ID } from "./grok";

const LS_PREFIX = "bb_salon_ai_";
const LS_LEGACY_AGENT = "bb_grok_agent_id";
const LS_LEGACY_VOICE = "bb_grok_voice";
const TABLE = "salon_ai_settings";

export const DEFAULT_AI_SETTINGS = {
  vocal_enabled: true,
  chatbot_enabled: true,
  appel_interne: false,
  agent_id: "",
  voice: "ara",
  // Agent vocal : base de connaissances propre au salon
  welcome_message: "",      // message de bienvenue (vide = modèle par défaut)
  custom_instructions: "",  // instructions perso (vide = modèle par défaut)
  connection_mode: "agent", // 'agent' (console xAI) | 'direct' (FR + outils + données app)
  voice_api_key_set: false, // indicateur : une clé est enregistrée (via /api/voice-key, jamais lue au navigateur)
};

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}
function lsKey(email) {
  return LS_PREFIX + normEmail(email);
}
function readLocal(email) {
  try {
    const raw = localStorage.getItem(lsKey(email));
    if (raw) return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch { /* stockage indisponible */ }
  return { ...DEFAULT_AI_SETTINGS };
}
function writeLocal(email, settings) {
  try {
    localStorage.setItem(lsKey(email), JSON.stringify({ ...settings, updated_at: settings.updated_at || new Date().toISOString() }));
  } catch { /* stockage indisponible */ }
}
// Migration unique des anciennes clés globales vers le salon courant.
function migrateLegacy(email) {
  try {
    if (localStorage.getItem(lsKey(email))) return;
    // Ne pas copier l'ancien agent global partagé : chaque compte démarre propre
    writeLocal(email, { ...DEFAULT_AI_SETTINGS });
  } catch { /* stockage indisponible */ }
}
function fromRow(row) {
  return {
    vocal_enabled: row.vocal_enabled !== false,
    chatbot_enabled: row.chatbot_enabled !== false,
    appel_interne: row.appel_interne === true,
    agent_id: row.agent_id || "",
    voice: row.voice || "ara",
    welcome_message: row.welcome_message || "",
    custom_instructions: row.custom_instructions || "",
    // Une ligne historique sans mode utilise désormais l'agent xAI configuré.
    // Le mode Direct reste conservé lorsqu'il a été explicitement choisi.
    connection_mode: row.connection_mode === "direct" ? "direct" : "agent",
    // La clé brute n'est JAMAIS lue depuis le navigateur : seul l'indicateur
    // « configurée / non » transite, via la route serveur /api/voice-key.
    voice_api_key_set: false,
    updated_at: row.updated_at || "",
  };
}
function newer(a, b) {
  return String(a?.updated_at || "") >= String(b?.updated_at || "");
}

const OPT_COLS = ["welcome_message", "custom_instructions", "connection_mode", "appel_interne"];

async function readRow(email) {
  // `select('*')` ne référence aucune colonne optionnelle en dur. Supabase
  // renvoie uniquement les colonnes réellement présentes dans la table, ce
  // qui évite les 400 lorsque les migrations vocales ne sont pas encore
  // appliquées sur le projet distant.
  return supabase.from(TABLE).select("*").eq("pro_email", email).maybeSingle();
}

/**
 * Lit les réglages IA d'un salon. Le plus récent (local ou serveur) gagne.
 * @returns {Promise<{vocal_enabled,chatbot_enabled,agent_id,voice}>}
 */
export async function getSalonAISettings(proEmail) {
  const email = normEmail(proEmail);
  if (email) migrateLegacy(email);
  const local = email ? readLocal(email) : { ...DEFAULT_AI_SETTINGS };
  if (!email) {
    if (!local.agent_id) local.agent_id = DEFAULT_AGENT_ID;
    return local;
  }
  try {
    const { data, error } = await readRow(email);
    if (!error && data) {
      const server = fromRow(data);
      // Le serveur gagne sauf si le local est plus récent (écriture en attente)
      const merged = newer(local, server) ? { ...server, ...local } : server;
      merged.voice_api_key_set = !!server.voice_api_key_set;
      if (!merged.agent_id) merged.agent_id = DEFAULT_AGENT_ID;
      return merged;
    }
  } catch { /* table non migrée ou hors ligne → local */ }
  if (!local.agent_id) local.agent_id = DEFAULT_AGENT_ID;
  return local;
}

/**
 * Enregistre les réglages IA d'un salon (local immédiat + serveur en tâche de fond).
 */
export async function saveSalonAISettings(proEmail, patch) {
  const email = normEmail(proEmail);
  const prev = email ? readLocal(email) : { ...DEFAULT_AI_SETTINGS };
  const next = {
    ...prev,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (email) writeLocal(email, next);
  if (!email) return next;
  // Synchro serveur best-effort (ne bloque jamais l'UI)
  try {
    const fullPayload = {
      pro_email: email,
      vocal_enabled: !!next.vocal_enabled,
      chatbot_enabled: !!next.chatbot_enabled,
      appel_interne: !!next.appel_interne,
      agent_id: next.agent_id || "",
      voice: next.voice || "ara",
      welcome_message: next.welcome_message || "",
      custom_instructions: next.custom_instructions || "",
      connection_mode: next.connection_mode === "agent" ? "agent" : "direct",
      updated_at: next.updated_at,
    };
    // Détecte les colonnes existantes sans jamais les citer dans le select.
    // Cela permet de synchroniser les options vocales dès que la migration
    // est déployée, tout en restant compatible avec l'ancien schéma.
    const current = await supabase.from(TABLE).select("*").eq("pro_email", email).maybeSingle();
    const available = new Set(Object.keys(current.data || {}));
    const payload = { ...fullPayload };
    for (const col of OPT_COLS) {
      if (!available.has(col)) delete payload[col];
    }
    const r = await supabase.from(TABLE).upsert(payload, { onConflict: "pro_email" });
    if (r.error) {
      // Dernier repli pour une table historique réduite au schéma de base.
      const basePayload = {
        pro_email: email,
        vocal_enabled: !!next.vocal_enabled,
        chatbot_enabled: !!next.chatbot_enabled,
        agent_id: next.agent_id || "",
        voice: next.voice || "ara",
        updated_at: next.updated_at,
      };
      await supabase.from(TABLE).upsert(basePayload, { onConflict: "pro_email" });
    }
  } catch { /* RLS ou table absente → le local fait foi */ }
  return next;
}
