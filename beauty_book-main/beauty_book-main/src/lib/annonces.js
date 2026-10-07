// ─── Annonces : job board salons ↔ particuliers ─────────────────────────────
// Les salons publient des annonces de travail (missions, remplacements, extras).
// Les particuliers répondent, le salon sélectionne un ou plusieurs candidats.
// Stockage localStorage (migrable vers Supabase : table `annonces` + `candidatures`).

const LS_KEY = "bb_annonces_v1";
const LS_CAND_KEY = "bb_candidatures_v1";
const LS_FAV_KEY = "bb_annonces_fav_v1";

// Statuts d'annonce : brouillon → publiee → pause → cloturee
export const ANNONCE_STATUS = {
  brouillon: { label: "Brouillon", color: "#6B7280", bg: "#F3F4F6" },
  publiee: { label: "Publiée", color: "#057A55", bg: "#DEF7EC" },
  pause: { label: "En pause", color: "#92400E", bg: "#FEF3C7" },
  cloturee: { label: "Clôturée", color: "#B91C1C", bg: "#FEE2E2" },
};

export function normalizeTypeActivite(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

export function getProfilType(profile) {
  const explicit = normalizeTypeActivite(profile?.type_activite);
  // Les anciens profils utilisent plusieurs libellés (ex. « indépendant(e) »,
  // « à domicile » ou « salon professionnel »). Les traiter par intention
  // évite de masquer un profil dès qu'un libellé légèrement différent est
  // enregistré en base.
  if (
    ["particulier", "independant", "freelance", "prestataire", "domicile"].some((value) => explicit.includes(value))
  ) return "particulier";
  if (["salon", "etablissement", "institut"].some((value) => explicit.includes(value))) return "salon";
  // Compatibilité avec les profils créés avant l'ajout du statut.
  return profile?.salon_name?.trim() ? "salon" : "particulier";
}

export const isProfilParticulier = profile => getProfilType(profile) === "particulier";
export const isProfilSalon = profile => getProfilType(profile) === "salon";

// Templates de messages automatiques (personnalisables par le salon)
// Variables : {nom}, {titre}, {salon}, {date_debut}, {remuneration}
export const DEFAULT_MSG_ACCEPTE = `Bonjour {nom} 🎉

Excellente nouvelle ! Votre candidature pour « {titre} » a été retenue par {salon}.

📅 Début de mission : {date_debut}
💰 Rémunération : {remuneration}

Prochaine étape : signez votre contrat électronique depuis l'application, puis nous vous contacterons pour les derniers détails.

À très vite !
L'équipe {salon}`;

export const DEFAULT_MSG_REFUSE = `Bonjour {nom},

Merci pour votre candidature à « {titre} » chez {salon}.

Après étude de votre profil, nous ne pourrons malheureusement pas donner suite cette fois-ci. Nous conservons vos coordonnées et n'hésiterons pas à vous recontacter pour de futures opportunités.

Bonne continuation !
L'équipe {salon}`;

const CATEGORIES = [
  { id: "coiffure", label: "Coiffure", icon: "Scissors" },
  { id: "tresses", label: "Tresses", icon: "Waves" },
  { id: "ongles", label: "Ongles", icon: "Gem" },
  { id: "maquillage", label: "Maquillage", icon: "Paintbrush" },
  { id: "soin", label: "Soins", icon: "Droplets" },
  { id: "massage", label: "Massage", icon: "Hand" },
  { id: "esthetique", label: "Esthétique", icon: "Sparkles" },
  { id: "barbier", label: "Barbier", icon: "Razor" },
];

const TYPES_MISSION = [
  { id: "extra", label: "Extra", desc: "Mission ponctuelle (1 jour)" },
  { id: "remplacement", label: "Remplacement", desc: "Remplace un membre absent" },
  { id: "renfort", label: "Renfort", desc: "Coup de main en période chargée" },
  { id: "recrutement", label: "Recrutement", desc: "Poste à pourvoir (CDD/CDI)" },
  { id: "stage", label: "Stage", desc: "Stage ou apprentissage" },
];

function seedAnnonces() {
  const now = Date.now();
  const day = 86400000;
  const base = {
    salon_avatar: "",
    salon_cover: "",
    salon_bio: "",
    salon_tel: "",
    msg_accepte: DEFAULT_MSG_ACCEPTE,
    msg_refuse: DEFAULT_MSG_REFUSE,
  };
  return [
    {
      ...base,
      id: "ann-001",
      salon_name: "Mamara_hair 91",
      salon_email: "salon@example.com",
      salon_city: "Athis-Mons",
      salon_rating: 4.3,
      salon_bio: "Salon afro-caribéen convivial depuis 2015. Spécialiste tresses, tissages et soins capillaires.",
      title: "Braideuse experte pour samedi chargé",
      category: "tresses",
      type_mission: "extra",
      description: "Notre salon cherche une braideuse confirmée pour un samedi exceptionnellement chargé. Vous rejoindrez notre équipe de 3 coiffeuses dans une ambiance conviviale et professionnelle. Matériel fourni, clientèle fidèle et agréable.",
      competences: ["Box braids", "Knotless", "Cornrows", "Pose rapide"],
      date_debut: new Date(now + 2 * day).toISOString().slice(0, 10),
      date_fin: new Date(now + 2 * day).toISOString().slice(0, 10),
      remuneration: 180,
      remuneration_type: "jour",
      places: 2,
      places_prises: 0,
      adresse: "54 Rue de Juvisy, 91200 Athis-Mons",
      status: "publiee",
      vues: 234,
      created_at: new Date(now - 1 * day).toISOString(),
    },
    {
      ...base,
      id: "ann-002",
      salon_name: "Glow Studio Paris",
      salon_email: "glow@example.com",
      salon_avatar: "",
      salon_city: "Paris 11e",
      salon_rating: 4.8,
      title: "Maquilleuse pour shooting mode",
      category: "maquillage",
      type_mission: "extra",
      description: "Studio photo recherche une maquilleuse créative pour un shooting éditorial. Thème : beauté naturelle sublimée. Book et références demandés. Belle opportunité de visibilité avec crédit photo.",
      competences: ["Maquillage nude", "Teint parfait", "Shooting"],
      date_debut: new Date(now + 5 * day).toISOString().slice(0, 10),
      date_fin: new Date(now + 5 * day).toISOString().slice(0, 10),
      remuneration: 250,
      remuneration_type: "jour",
      places: 1,
      places_prises: 0,
      adresse: "12 Rue de la Roquette, 75011 Paris",
      status: "publiee",
      vues: 189,
      created_at: new Date(now - 3 * day).toISOString(),
    },
    {
      id: "ann-003",
      salon_name: "Nails & Co",
      salon_email: "nails@example.com",
      salon_avatar: "",
      salon_city: "Lyon",
      salon_rating: 4.6,
      title: "Prothésiste ongulaire — renfort fêtes",
      category: "ongles",
      type_mission: "renfort",
      description: "Période des fêtes très chargée ! Nous cherchons un(e) prothésiste ongulaire pour nous épauler de mi-décembre à début janvier. Pose américaine, nail art et gainage : vous maîtrisez tout. Ambiance jeune et dynamique.",
      competences: ["Pose américaine", "Nail art", "Gainage", "Vernis semi-permanent"],
      date_debut: new Date(now + 10 * day).toISOString().slice(0, 10),
      date_fin: new Date(now + 30 * day).toISOString().slice(0, 10),
      remuneration: 160,
      remuneration_type: "jour",
      places: 3,
      places_prises: 1,
      adresse: "8 Place Bellecour, 69002 Lyon",
      status: "publiee",
      vues: 412,
      created_at: new Date(now - 5 * day).toISOString(),
    },
  ];
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getCategories() {
  return CATEGORIES;
}

export function getTypesMission() {
  return TYPES_MISSION;
}

export function getAnnonces() {
  let annonces = readLS(LS_KEY, null);
  if (!annonces) {
    annonces = seedAnnonces();
    writeLS(LS_KEY, annonces);
  }
  return annonces.filter(a => a.status === "publiee");
}

export function getAnnonceById(id) {
  return getAnnonces().find(a => a.id === id) || null;
}

export function createAnnonce(data) {
  const annonces = readLS(LS_KEY, seedAnnonces());
  const annonce = {
    id: "ann-" + Date.now().toString(36),
    status: data.status || "brouillon",
    vues: 0,
    places_prises: 0,
    salon_avatar: "",
    salon_cover: "",
    salon_bio: "",
    salon_tel: "",
    msg_accepte: DEFAULT_MSG_ACCEPTE,
    msg_refuse: DEFAULT_MSG_REFUSE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...data,
  };
  annonces.unshift(annonce);
  writeLS(LS_KEY, annonces);
  return annonce;
}

export function updateAnnonce(id, data) {
  const annonces = readLS(LS_KEY, []);
  const idx = annonces.findIndex(x => x.id === id);
  if (idx === -1) return null;
  annonces[idx] = { ...annonces[idx], ...data, updated_at: new Date().toISOString() };
  writeLS(LS_KEY, annonces);
  return annonces[idx];
}

export function deleteAnnonce(id) {
  const annonces = readLS(LS_KEY, []);
  writeLS(LS_KEY, annonces.filter(x => x.id !== id));
  const cands = readLS(LS_CAND_KEY, []);
  writeLS(LS_CAND_KEY, cands.filter(c => c.annonce_id !== id));
}

export function setAnnonceStatus(id, status) {
  return updateAnnonce(id, { status });
}

// Remplit les variables d'un template de message
export function fillTemplate(template, vars) {
  let out = template || "";
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replaceAll(`{${k}}`, v ?? "");
  });
  return out;
}

export function getAnnonceStats(id) {
  const cands = getCandidatures(id);
  return {
    total: cands.length,
    en_attente: cands.filter(c => c.status === "en_attente").length,
    accepte: cands.filter(c => c.status === "accepte").length,
    refuse: cands.filter(c => c.status === "refuse").length,
    contrats_signes: cands.filter(c => c.contrat?.signe).length,
  };
}

export function incrementVues(id) {
  const annonces = readLS(LS_KEY, []);
  const a = annonces.find(x => x.id === id);
  if (a) {
    a.vues = (a.vues || 0) + 1;
    writeLS(LS_KEY, annonces);
  }
}

// ─── Candidatures ───

export function getCandidatures(annonceId) {
  const all = readLS(LS_CAND_KEY, []);
  return all.filter(c => c.annonce_id === annonceId);
}

export function hasCandidature(annonceId, email) {
  const all = readLS(LS_CAND_KEY, []);
  return all.some(c => c.annonce_id === annonceId && c.candidat_email === email);
}

export function postuler(annonceId, candidat) {
  const all = readLS(LS_CAND_KEY, []);
  if (all.some(c => c.annonce_id === annonceId && c.candidat_email === candidat.email)) {
    return { error: "Vous avez déjà postulé à cette annonce." };
  }
  const candidature = {
    id: "cand-" + Date.now().toString(36),
    annonce_id: annonceId,
    candidat_email: candidat.email,
    candidat_nom: candidat.nom || "Candidat",
    candidat_avatar: candidat.avatar || "",
    candidat_bio: candidat.bio || "",
    candidat_tel: candidat.tel || "",
    message: candidat.message || "",
    status: "en_attente", // en_attente | accepte | refuse
    reponse_salon: "", // message personnalisé ou automatique du salon
    suivi: [
      { etape: "Candidature envoyée", date: new Date().toISOString(), icon: "send" },
    ],
    contrat: { signe: false, date: null, nom_signataire: "" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  all.unshift(candidature);
  writeLS(LS_CAND_KEY, all);
  return { data: candidature };
}

function pushSuivi(c, etape, icon) {
  c.suivi = [...(c.suivi || []), { etape, date: new Date().toISOString(), icon }];
}

export function updateCandidatureStatus(candidatureId, status, reponse_salon = "") {
  const all = readLS(LS_CAND_KEY, []);
  const c = all.find(x => x.id === candidatureId);
  if (c) {
    const prevStatus = c.status;
    c.status = status;
    c.reponse_salon = reponse_salon;
    c.updated_at = new Date().toISOString();
    if (status === "accepte" && prevStatus !== "accepte") {
      pushSuivi(c, "Candidature acceptée par le salon", "check");
      const annonces = readLS(LS_KEY, []);
      const a = annonces.find(x => x.id === c.annonce_id);
      if (a) {
        a.places_prises = (a.places_prises || 0) + 1;
        writeLS(LS_KEY, annonces);
      }
    } else if (status === "refuse" && prevStatus !== "refuse") {
      pushSuivi(c, "Candidature refusée", "x");
    } else if (status === "en_attente") {
      pushSuivi(c, "Candidature en cours d'examen", "eye");
    }
    writeLS(LS_CAND_KEY, all);
  }
  return c;
}

// Signature électronique du contrat par le candidat
export function signerContrat(candidatureId, nomSignataire) {
  const all = readLS(LS_CAND_KEY, []);
  const c = all.find(x => x.id === candidatureId);
  if (c && c.status === "accepte" && !c.contrat?.signe) {
    c.contrat = { signe: true, date: new Date().toISOString(), nom_signataire: nomSignataire };
    pushSuivi(c, "Contrat signé électroniquement", "pen");
    c.updated_at = new Date().toISOString();
    writeLS(LS_CAND_KEY, all);
  }
  return c;
}

// Génère le texte du contrat de mission
export function genererContrat(annonce, candidature) {
  const money = (v) => Number(v || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const fmtD = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
  return `CONTRAT DE MISSION — EXTRA

Entre les soussignés :

LE SALON : ${annonce.salon_name}
Adresse : ${annonce.adresse || annonce.salon_city || "—"}
Email : ${annonce.salon_email || "—"}

Ci-après « le Salon »,

ET :

LE PRESTATAIRE : ${candidature.candidat_nom}
Email : ${candidature.candidat_email}
Téléphone : ${candidature.candidat_tel || "—"}

Ci-après « le Prestataire »,

IL A ÉTÉ CONVENU CE QUI SUIT :

Article 1 — Objet
Le Salon confie au Prestataire la mission suivante : ${annonce.title}
Catégorie : ${annonce.category || "—"}

Article 2 — Durée
La mission se déroulera du ${fmtD(annonce.date_debut)} au ${fmtD(annonce.date_fin)}.

Article 3 — Rémunération
En contrepartie de la mission, le Prestataire percevra ${money(annonce.remuneration)} ${annonce.remuneration_type === "jour" ? "par jour" : "pour la mission"}.

Article 4 — Obligations
Le Prestataire s'engage à exécuter la mission avec professionnalisme, ponctualité et dans le respect des règles d'hygiène du Salon.

Article 5 — Signature électronique
Les parties reconnaissent la validité de la signature électronique apposée via l'application BeautyBook.

Fait le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}

Signature du Prestataire : ${candidature.contrat?.nom_signataire || ".............................."}`;
}

// ─── Favoris ───
export function getFavoris(email) {
  const all = readLS(LS_FAV_KEY, {});
  return all[email] || [];
}

export function toggleFavori(email, annonceId) {
  const all = readLS(LS_FAV_KEY, {});
  const favs = all[email] || [];
  const idx = favs.indexOf(annonceId);
  if (idx === -1) favs.push(annonceId);
  else favs.splice(idx, 1);
  all[email] = favs;
  writeLS(LS_FAV_KEY, all);
  return favs.includes(annonceId);
}

export function isFavori(email, annonceId) {
  return getFavoris(email).includes(annonceId);
}

export function getMesAnnonces(email) {
  const annonces = readLS(LS_KEY, []);
  return annonces.filter(a => a.salon_email === email);
}

export function getMesCandidatures(email) {
  const all = readLS(LS_CAND_KEY, []);
  return all.filter(c => c.candidat_email === email);
}

export async function checkProfessionalAccess(supabase, email) {
  if (!supabase || !email) return { loading: false, isParticulier: false, isSalon: false, typeActivite: null };
  try {
    const { data: profiles } = await supabase.from("ProfilPro")
      .select("id, type_activite, salon_name, status, created_at")
      .eq("user_email", email).order("created_at", { ascending: false });
    let active = (profiles || []).filter(p => p.status === "actif");
    let best = active[0] || (profiles || [])[0] || null;
    if (!best) {
      const { data: demandes } = await supabase.from("DemandeProV2")
        .select("id, type_activite, salon_name, status, statut, created_at")
        .eq("user_email", email).order("created_at", { ascending: false }).limit(1);
      best = demandes?.[0] || null;
    }
    const type = getProfilType(best);
    return { loading: false, isParticulier: !!best && type === "particulier", isSalon: !!best && type === "salon", typeActivite: best?.type_activite || null };
  } catch {
    return { loading: false, isParticulier: false, isSalon: false, typeActivite: null };
  }
}

// ─── Accès réservé aux salons professionnels ───
// La gestion des annonces (dashboard + détail + création) est réservée aux profils
// pro dont le type_activite est "Salon" (salon professionnel).
// Sélection du profil avec la même priorité que VueClient (actif avec images >
// actif > avec images > plus récent) car des doublons ProfilPro existent.
// Repli sur DemandeProV2 si le profil n'a pas de type_activite.
// Retourne { loading, isSalon, typeActivite }.
export async function checkSalonAccess(supabase, email) {
  if (!supabase || !email) return { loading: false, isSalon: false, typeActivite: null };
  const isSalonValue = (v) => ["salon", "salon professionnel", "salon pro"].includes(normalizeTypeActivite(v));
  try {
    const { data: profiles } = await supabase
      .from("ProfilPro")
      .select("id, type_activite, status, avatar_url, cover_url, created_at")
      .eq("user_email", email)
      .order("created_at", { ascending: false });
    let best = null;
    if (profiles && profiles.length > 0) {
      best = profiles.find(p => p.status === "actif" && (p.avatar_url || p.cover_url))
        || profiles.find(p => p.status === "actif")
        || profiles.find(p => p.avatar_url || p.cover_url)
        || profiles.find(p => isSalonValue(p.type_activite))
        || profiles[0];
    }
    if (best && isSalonValue(best.type_activite)) {
      return { loading: false, isSalon: true, typeActivite: best.type_activite };
    }
    // Aucun profil avec type Salon ? Chercher dans tous les doublons
    if (profiles && profiles.some(p => isSalonValue(p.type_activite))) {
      return { loading: false, isSalon: true, typeActivite: "Salon" };
    }
    // Repli : DemandeProV2 (parcours Devenir Pro)
    try {
      const { data: demande } = await supabase
        .from("DemandeProV2")
        .select("type_activite")
        .eq("user_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (demande && isSalonValue(demande.type_activite)) {
        return { loading: false, isSalon: true, typeActivite: demande.type_activite };
      }
    } catch {}
    return { loading: false, isSalon: false, typeActivite: best?.type_activite || null };
  } catch {
    return { loading: false, isSalon: false, typeActivite: null };
  }
}
