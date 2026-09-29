// ─── Réglages IA par salon ──────────────────────────────────────────────────
// Chaque salon (pro_email) possède ses propres réglages :
//   - vocal_enabled   : l'agent vocal « Parler à l'agent » est actif ou non
//   - chatbot_enabled : le widget « Discuter avec Maria » visible par les visiteurs
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
  agent_id: "",
  voice: "ara",
  // Agent vocal : base de connaissances propre au salon
  welcome_message: "",      // message de bienvenue (vide = modèle par défaut)
  custom_instructions: "",  // instructions perso (vide = modèle par défaut)
  connection_mode: "direct", // 'direct' (FR + outils + données app) | 'agent' (console du fournisseur vocal)
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
    const patch = {};
    const a = localStorage.getItem(LS_LEGACY_AGENT);
    const v = localStorage.getItem(LS_LEGACY_VOICE);
    if (a) patch.agent_id = a;
    if (v) patch.voice = v;
    if (Object.keys(patch).length > 0) {
      writeLocal(email, { ...DEFAULT_AI_SETTINGS, ...patch });
    }
  } catch { /* stockage indisponible */ }
}
function fromRow(row) {
  return {
    vocal_enabled: row.vocal_enabled !== false,
    chatbot_enabled: row.chatbot_enabled !== false,
    agent_id: row.agent_id || "",
    voice: row.voice || "ara",
    welcome_message: row.welcome_message || "",
    custom_instructions: row.custom_instructions || "",
    connection_mode: row.connection_mode === "agent" ? "agent" : "direct",
    // La clé brute n'est JAMAIS lue depuis le navigateur : seul l'indicateur
    // « configurée / non » transite, via la route serveur /api/voice-key.
    voice_api_key_set: false,
    updated_at: row.updated_at || "",
  };
}
function newer(a, b) {
  return String(a?.updated_at || "") >= String(b?.updated_at || "");
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
    const { data, error } = await supabase
      .from(TABLE)
      .select("pro_email,vocal_enabled,chatbot_enabled,agent_id,voice,welcome_message,custom_instructions,connection_mode,updated_at")
      .eq("pro_email", email)
      .maybeSingle();
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
    await supabase.from(TABLE).upsert(
      {
        pro_email: email,
        vocal_enabled: !!next.vocal_enabled,
        chatbot_enabled: !!next.chatbot_enabled,
        agent_id: next.agent_id || "",
        voice: next.voice || "ara",
        welcome_message: next.welcome_message || "",
        custom_instructions: next.custom_instructions || "",
        connection_mode: next.connection_mode === "agent" ? "agent" : "direct",
        updated_at: next.updated_at,
      },
      { onConflict: "pro_email" }
    );
  } catch { /* RLS ou table absente → le local fait foi */ }
  return next;
}
