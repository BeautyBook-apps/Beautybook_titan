// Helpers frontend pour la connexion OAuth réelle aux réseaux sociaux.
// Le flux : startSocialOAuth(platform) -> redirection vers la plateforme ->
// retour sur /social-media?oauth=success|error -> parseOAuthResult() + fetchSocialConnections().

import { supabase } from "@/api/supabaseClient";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://vimusrczrjvefsbljtmf.supabase.co";
const FUNCTION_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/social-oauth`;

export const OAUTH_PLATFORMS = ["instagram", "facebook", "whatsapp", "tiktok"];

/** Lance la connexion OAuth : récupère l'URL d'autorisation puis redirige. */
export async function startSocialOAuth(platform) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Connectez-vous à votre compte BeautyBook pour relier un réseau social.");
  }
  const res = await fetch(`${FUNCTION_URL}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ platform, return_to: `${window.location.origin}/social-media` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.authorize_url) {
    throw new Error(data.error || "Démarrage de la connexion impossible.");
  }
  window.location.href = data.authorize_url;
}

/** Connexions OAuth de l'utilisateur connecté, indexées par plateforme. */
export async function fetchSocialConnections() {
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email;
  if (!email) return {};
  const { data, error } = await supabase
    .from("social_connections")
    .select("platform, username, display_name, avatar_url, expires_at, updated_at, account_id")
    .eq("user_email", email);
  if (error) {
    console.error("social_connections:", error);
    return {};
  }
  const map = {};
  (data || []).forEach((r) => { map[r.platform] = r; });
  return map;
}

/** Déconnecte une plateforme (supprime la connexion). */
export async function disconnectSocial(platform) {
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email;
  if (!email) return;
  const { error } = await supabase
    .from("social_connections")
    .delete()
    .eq("user_email", email)
    .eq("platform", platform);
  if (error) throw new Error("Déconnexion impossible.");
}

/** Lit le résultat du retour OAuth dans l'URL puis nettoie l'URL. */
export function parseOAuthResult() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("oauth");
  if (!status) return null;
  const result = {
    status, // "success" | "error"
    platform: params.get("platform"),
    message: params.get("message"),
  };
  ["oauth", "platform", "message"].forEach((k) => params.delete(k));
  const qs = params.toString();
  window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  return result;
}

/** true si le token expire dans moins de 7 jours (ou déjà expiré). */
export function isExpiringSoon(row) {
  if (!row?.expires_at) return false;
  return new Date(row.expires_at).getTime() - Date.now() < 7 * 24 * 3600 * 1000;
}
