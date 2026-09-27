// Supabase Edge Function : connexion OAuth réelle aux réseaux sociaux.
// Routes :
//   POST /start            -> vérifie le JWT Supabase, crée un `state` anti-CSRF, renvoie l'URL d'autorisation
//   GET  /callback         -> échange le `code` contre des tokens, récupère le profil, stocke la connexion, redirige vers l'app
//   GET  /health           -> contrôle simple
//
// Secrets requis (supabase secrets set) :
//   META_APP_ID, META_APP_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL (ex: https://thelastjiren.vercel.app)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
const APP_URL = (Deno.env.get("APP_URL") || "https://thelastjiren.vercel.app").replace(/\/$/, "");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/social-oauth/callback`;
const GRAPH = "https://graph.facebook.com/v21.0";

const PLATFORMS: Record<string, { scopes: string; kind: "meta" | "tiktok" }> = {
  facebook: { kind: "meta", scopes: "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging" },
  instagram: { kind: "meta", scopes: "instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement" },
  whatsapp: { kind: "meta", scopes: "business_management,whatsapp_business_management,whatsapp_business_messaging" },
  tiktok: { kind: "tiktok", scopes: "user.info.basic" },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

function redirectBack(returnTo: string, platform: string, ok: boolean, message = "") {
  const safe = returnTo.startsWith(APP_URL) ? returnTo : `${APP_URL}/social-media`;
  const url = `${safe}${safe.includes("?") ? "&" : "?"}oauth=${ok ? "success" : "error"}&platform=${platform}` +
    (message ? `&message=${encodeURIComponent(message)}` : "");
  return new Response(null, { status: 302, headers: { Location: url } });
}

async function metaTokenExchange(code: string) {
  const url = `${GRAPH}/oauth/access_token?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
    `&client_secret=${META_APP_SECRET}&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data?.error?.message || "Échange du code Meta impossible.");
  // Token longue durée (60 jours)
  const ll = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}` +
    `&client_secret=${META_APP_SECRET}&fb_exchange_token=${data.access_token}`
  ).then((r) => r.json());
  return {
    accessToken: ll.access_token || data.access_token,
    expiresIn: ll.expires_in || data.expires_in || 3600,
  };
}

async function tiktokTokenExchange(code: string) {
  const body = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: CALLBACK_URL,
  });
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data?.error_description || data?.error || "Échange du code TikTok impossible.");
  return data; // access_token, refresh_token, expires_in, open_id, scope
}

async function resolveMetaProfile(platform: string, token: string) {
  const g = async (path: string) => {
    const res = await fetch(`${GRAPH}${path}${path.includes("?") ? "&" : "?"}access_token=${token}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data?.error?.message || "Lecture du profil Meta impossible.");
    return data;
  };
  if (platform === "facebook") {
    const me = await g("/me?fields=id,name");
    const pages = await g("/me/accounts?fields=id,name&limit=50");
    const page = pages?.data?.[0];
    if (!page) throw new Error("Aucune Page Facebook trouvée sur ce compte.");
    return { platformUserId: page.id, username: page.name, displayName: me.name, accountId: page.id };
  }
  if (platform === "instagram") {
    const pages = await g("/me/accounts?fields=id,name,instagram_business_account{id,username}&limit=50");
    const withIg = (pages?.data || []).find((p: { instagram_business_account?: { id: string; username: string } }) => p.instagram_business_account);
    if (!withIg) throw new Error("Aucun compte Instagram professionnel lié à vos Pages Facebook.");
    const ig = withIg.instagram_business_account;
    return { platformUserId: ig.id, username: ig.username ? `@${ig.username}` : ig.id, displayName: ig.username || ig.id, accountId: withIg.id };
  }
  // whatsapp : utilisateur -> business -> compte WhatsApp -> numéro
  const businesses = await g("/me/businesses?fields=id,name&limit=20");
  const biz = businesses?.data?.[0];
  if (!biz) throw new Error("Aucun Business Meta trouvé. Créez un compte Business sur business.facebook.com.");
  const wabas = await g(`/${biz.id}/owned_whatsapp_business_accounts?fields=id,name&limit=20`);
  const waba = wabas?.data?.[0];
  if (!waba) throw new Error("Aucun compte WhatsApp Business dans votre Business Meta.");
  const numbers = await g(`/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=20`);
  const num = numbers?.data?.[0];
  if (!num) throw new Error("Aucun numéro WhatsApp connecté à ce compte Business.");
  return {
    platformUserId: num.id,
    username: num.display_phone_number || num.verified_name || num.id,
    displayName: num.verified_name || num.display_phone_number || biz.name,
    accountId: waba.id,
  };
}

async function resolveTiktokProfile(token: string) {
  const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok || data.error || !data?.data?.user) throw new Error(data?.error?.message || "Lecture du profil TikTok impossible.");
  const u = data.data.user;
  return { platformUserId: u.open_id, username: u.display_name ? `@${u.display_name}` : u.open_id, displayName: u.display_name || u.open_id, avatarUrl: u.avatar_url };
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── POST /start ──
  if (path.endsWith("/start") && req.method === "POST") {
    try {
      const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!jwt) return json({ error: "Non authentifié." }, 401);
      const { data: { user }, error: uErr } = await supabase.auth.getUser(jwt);
      if (uErr || !user?.email) return json({ error: "Session invalide. Reconnectez-vous." }, 401);

      const { platform, return_to } = await req.json();
      const cfg = PLATFORMS[platform];
      if (!cfg) return json({ error: "Plateforme inconnue." }, 400);
      const returnTo = typeof return_to === "string" && return_to.startsWith(APP_URL) ? return_to : `${APP_URL}/social-media`;

      const state = crypto.randomUUID();
      const { error: sErr } = await supabase.from("social_oauth_states").insert({
        state,
        user_email: user.email,
        platform,
        return_to: returnTo,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (sErr) throw new Error("Création de session OAuth impossible.");

      let authorizeUrl: string;
      if (cfg.kind === "meta") {
        if (!META_APP_ID) throw new Error("META_APP_ID non configuré côté serveur.");
        authorizeUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}` +
          `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
          `&state=${state}&response_type=code&scope=${encodeURIComponent(cfg.scopes)}`;
      } else {
        if (!TIKTOK_CLIENT_KEY) throw new Error("TIKTOK_CLIENT_KEY non configuré côté serveur.");
        authorizeUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${TIKTOK_CLIENT_KEY}` +
          `&response_type=code&scope=${encodeURIComponent(cfg.scopes)}` +
          `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&state=${state}`;
      }
      return json({ authorize_url: authorizeUrl });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Erreur inattendue." }, 500);
    }
  }

  // ── GET /callback ──
  if (path.endsWith("/callback") && req.method === "GET") {
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const err = url.searchParams.get("error");
    const errDesc = url.searchParams.get("error_description") || "";

    const { data: st } = await supabase.from("social_oauth_states").select("*").eq("state", state).maybeSingle();
    const fallbackReturn = `${APP_URL}/social-media`;
    const returnTo = st?.return_to || fallbackReturn;
    const platform = st?.platform || "unknown";

    if (err) return redirectBack(returnTo, platform, false, errDesc || "Connexion annulée.");
    if (!st || !code) return redirectBack(returnTo, platform, false, "Session OAuth invalide ou expirée.");
    if (new Date(st.expires_at).getTime() < Date.now()) {
      await supabase.from("social_oauth_states").delete().eq("state", state);
      return redirectBack(returnTo, platform, false, "Session OAuth expirée. Recommencez.");
    }
    // Usage unique
    await supabase.from("social_oauth_states").delete().eq("state", state);

    try {
      const cfg = PLATFORMS[platform];
      if (!cfg) throw new Error("Plateforme inconnue.");

      let accessToken = "", refreshToken: string | null = null, expiresAt: string | null = null;
      let profile: { platformUserId: string; username: string; displayName: string; accountId?: string; avatarUrl?: string };

      if (cfg.kind === "meta") {
        const t = await metaTokenExchange(code);
        accessToken = t.accessToken;
        expiresAt = new Date(Date.now() + Math.max(0, (t.expiresIn - 300) * 1000)).toISOString();
        profile = await resolveMetaProfile(platform, accessToken);
      } else {
        const t = await tiktokTokenExchange(code);
        accessToken = t.access_token;
        refreshToken = t.refresh_token || null;
        expiresAt = t.expires_in ? new Date(Date.now() + Math.max(0, (t.expires_in - 300) * 1000)).toISOString() : null;
        const p = await resolveTiktokProfile(accessToken);
        profile = { ...p, accountId: t.open_id };
      }

      const { error: upErr } = await supabase.from("social_connections").upsert({
        user_email: st.user_email,
        platform,
        platform_user_id: profile.platformUserId,
        username: profile.username,
        display_name: profile.displayName,
        avatar_url: (profile as { avatarUrl?: string }).avatarUrl || null,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scopes: cfg.scopes,
        account_id: profile.accountId || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_email,platform" });
      if (upErr) throw new Error("Enregistrement de la connexion impossible.");

      return redirectBack(returnTo, platform, true);
    } catch (e) {
      return redirectBack(returnTo, platform, false, e instanceof Error ? e.message : "Échec de la connexion.");
    }
  }

  if (path.endsWith("/health")) return json({ ok: true });

  return json({ error: "Route inconnue." }, 404);
});
