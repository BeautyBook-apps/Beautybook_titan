import { supabase } from "@/api/supabaseClient";

// ── Photos « Prestations réalisées » ─────────────────────────────────
// Table Supabase : prestation_showcase
//   id, service_id (text), is_bundle (bool), photo_url (text),
//   caption (text), position (int), pro_email (text), created_at

const TABLE = "prestation_showcase";

/** Récupère les photos publiées pour un service ou un bundle (ordre : position). */
export async function getShowcasePhotos(serviceId, isBundle = false) {
  if (!serviceId) return [];
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, photo_url, caption, position")
      .eq("service_id", String(serviceId))
      .eq("is_bundle", !!isBundle)
      .order("position", { ascending: true })
      .limit(60);
    if (error) throw error;
    return (data || []).map(r => ({ id: r.id, url: r.photo_url, caption: r.caption || "" }));
  } catch {
    // Table non migrée ou erreur réseau → section simplement vide
    return [];
  }
}

/** Publie des photos (ajoutées à la suite des existantes). */
export async function addShowcasePhotos({ serviceId, isBundle = false, proEmail = "", photos = [] }) {
  if (!serviceId || photos.length === 0) return [];
  const existing = await getShowcasePhotos(serviceId, isBundle).catch(() => []);
  const startPos = existing.length;
  const rows = photos.map((p, i) => ({
    service_id: String(serviceId),
    is_bundle: !!isBundle,
    photo_url: p.url,
    caption: p.caption || "",
    position: startPos + i,
    pro_email: proEmail || "",
  }));
  const { data, error } = await supabase.from(TABLE).insert(rows).select("id");
  if (error) throw error;
  return data || [];
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
