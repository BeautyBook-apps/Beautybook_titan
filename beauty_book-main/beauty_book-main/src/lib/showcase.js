import { supabase } from "@/api/supabaseClient";

// ── Photos « Prestations réalisées » ─────────────────────────────────
// Table Supabase : prestation_showcase
//   id, service_id (text), is_bundle (bool), photo_url (text),
//   caption (text), position (int), pro_email (text), created_at

const TABLE = "prestation_showcase";

/** Message affiché au pro quand la table n'existe pas encore (migration non exécutée). */
export const SHOWCASE_MIGRATION_HELP =
  "La table « Prestations réalisées » n'existe pas encore dans votre base. " +
  "Exécutez la migration 20260929_prestation_showcase.sql dans le SQL Editor " +
  "de Supabase, puis réessayez.";

let _tableExists = null; // null = inconnu, true/false = sondé

function isMissingTable(err) {
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "");
  return (
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache") ||
    msg.includes("not found")
  );
}

/** Sonde (mise en cache) : la table existe-t-elle ? */
export async function showcaseTableExists() {
  if (_tableExists !== null) return _tableExists;
  try {
    const { error } = await supabase.from(TABLE).select("id").limit(0);
    _tableExists = !error || !isMissingTable(error);
  } catch {
    _tableExists = false;
  }
  return _tableExists;
}

function missingTableError() {
  const e = new Error(SHOWCASE_MIGRATION_HELP);
  e.code = "SHOWCASE_TABLE_MISSING";
  return e;
}

// Colonnes optionnelles (ajoutées par une migration ultérieure) : on essaie
// avec, puis sans, pour rester compatible avec les bases non migrées.
const EXTRA_COLS = ["reservation_id", "client_name"];

function stripExtra(row) {
  const r = { ...row };
  for (const c of EXTRA_COLS) delete r[c];
  return r;
}

/** Récupère les photos publiées pour un service ou un bundle (ordre : position). */
export async function getShowcasePhotos(serviceId, isBundle = false) {
  if (!serviceId) return [];
  try {
    let q = supabase
      .from(TABLE)
      .select("id, photo_url, caption, position, reservation_id, client_name")
      .eq("service_id", String(serviceId))
      .eq("is_bundle", !!isBundle)
      .order("position", { ascending: true })
      .limit(60);
    let { data, error } = await q;
    if (error && !isMissingTable(error)) {
      // Colonnes reservation_id/client_name absentes → relecture sans elles
      const r2 = await supabase
        .from(TABLE)
        .select("id, photo_url, caption, position")
        .eq("service_id", String(serviceId))
        .eq("is_bundle", !!isBundle)
        .order("position", { ascending: true })
        .limit(60);
      data = r2.data; error = r2.error;
    }
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      url: r.photo_url,
      caption: r.caption || "",
      reservation_id: r.reservation_id || "",
      client_name: r.client_name || "",
    }));
  } catch {
    // Table non migrée ou erreur réseau → section simplement vide
    return [];
  }
}

/** Publie des photos (ajoutées à la suite des existantes). */
export async function addShowcasePhotos({ serviceId, isBundle = false, proEmail = "", reservationId = "", clientName = "", photos = [] }) {
  if (!serviceId || photos.length === 0) return [];
  // La table n'existe pas (migration non exécutée) → message actionnable,
  // pas une 404 cryptique. Vérifié AVANT l'upload pour ne rien envoyer en vain.
  if (!(await showcaseTableExists())) throw missingTableError();
  const existing = await getShowcasePhotos(serviceId, isBundle).catch(() => []);
  const startPos = existing.length;
  const rows = photos.map((p, i) => ({
    service_id: String(serviceId),
    is_bundle: !!isBundle,
    photo_url: p.url,
    caption: p.caption || "",
    position: startPos + i,
    pro_email: proEmail || "",
    reservation_id: reservationId ? String(reservationId) : "",
    client_name: clientName || "",
  }));
  let { data, error } = await supabase.from(TABLE).insert(rows).select("id");
  if (error && !isMissingTable(error)) {
    // Colonnes reservation_id/client_name absentes → on réessaie sans elles
    const slim = rows.map(stripExtra);
    const r2 = await supabase.from(TABLE).insert(slim).select("id");
    data = r2.data; error = r2.error;
  }
  if (error) {
    if (isMissingTable(error)) { _tableExists = false; throw missingTableError(); }
    throw error;
  }
  return data || [];
}

/**
 * Récupère les avis clients liés aux photos (via reservation_id).
 * Retourne un objet { [reservation_id]: { note, commentaire, auteur_nom, auteur_avatar, created_date } }.
 */
export async function getShowcaseReviews(photos = []) {
  const ids = [...new Set((photos || []).map(p => p.reservation_id).filter(Boolean))];
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from("Avis")
      .select("reservation_id, note, commentaire, auteur_nom, auteur_avatar, created_date")
      .in("reservation_id", ids)
      .eq("type", "client_to_pro");
    if (error) throw error;
    const map = {};
    for (const a of data || []) {
      if (a?.reservation_id && !map[a.reservation_id]) map[a.reservation_id] = a;
    }
    return map;
  } catch {
    return {};
  }
}

/** Supprime une photo publiée (le pro peut retirer une photo de la vitrine). */
export async function deleteShowcasePhoto(id) {
  if (!id) return;
  await supabase.from(TABLE).delete().eq("id", id);
}

/** Déduit depuis un RDV s'il s'agit d'un bundle et l'identifiant vitrine. */
export function showcaseTargetFromRdv(rdv = {}) {
  let addons = rdv.addons;
  if (typeof addons === "string") {
    try { addons = JSON.parse(addons); } catch { addons = null; }
  }
  const bundleId = addons?.bundle_id;
  if (bundleId) return { serviceId: String(bundleId), isBundle: true };
  return { serviceId: rdv.service_id ? String(rdv.service_id) : "", isBundle: false };
}

/**
 * Résout la cible vitrine d'un RDV, avec repli par nom pour les anciennes
 * réservations dont le service_id est vide (ex. créées avant le champ).
 * Retourne { serviceId, isBundle } — serviceId peut rester vide si introuvable.
 */
export async function resolveShowcaseTarget(rdv = {}) {
  const direct = showcaseTargetFromRdv(rdv);
  if (direct.serviceId) return direct;
  const proEmail = (rdv.pro_email || "").trim();
  const name = (rdv.service_name || "").trim();
  if (!proEmail || !name) return direct;
  try {
    // 1) Service du pro portant ce nom (insensible à la casse)
    const { data: svc } = await supabase
      .from("Service").select("id")
      .eq("pro_email", proEmail)
      .ilike("title", name)
      .limit(1).maybeSingle();
    if (svc?.id) return { serviceId: String(svc.id), isBundle: false };
    // 2) Bundle du pro portant ce nom
    const { data: bdl } = await supabase
      .from("ServiceBundle").select("id")
      .eq("pro_email", proEmail)
      .ilike("name", name)
      .limit(1).maybeSingle();
    if (bdl?.id) return { serviceId: String(bdl.id), isBundle: true };
  } catch { /* repli silencieux : on garde direct */ }
  return direct;
}
