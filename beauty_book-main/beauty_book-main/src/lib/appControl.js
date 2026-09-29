// ─────────────────────────────────────────────────────────────────────────────
// Bus de contrôle applicatif — le pouvoir RÉEL de Global.
//
// Toute action que l'IA déclenche passe par ce bus : liste blanche fermée,
// validation stricte des paramètres, exécution réelle, résultat honnête.
// Aucune action « factice » : si l'exécution échoue, l'erreur remonte telle
// quelle à l'utilisateur au lieu d'un faux succès.
// ─────────────────────────────────────────────────────────────────────────────
import { applyTheme } from "@/hooks/useTheme";

/** Pages que Global peut réellement ouvrir (routes existantes de l'app). */
export const APP_ROUTES = [
  "/accueil",
  "/boutique",
  "/rendez-vous",
  "/messages",
  "/profil",
  "/profil-pro",
  "/mon-solde",
  "/parametres",
  "/notifications",
  "/reels",
  "/live",
  "/services",
  "/scan-capillaire",
  "/immobilier",
  "/mes-commandes",
  "/programme-fidelite",
  "/abonnements",
  "/pro/equipe",
  "/pro/catalogue-services",
  "/pro/analytics",
];

const ROUTE_LABELS = {
  "/accueil": "l'accueil",
  "/boutique": "la boutique",
  "/rendez-vous": "vos rendez-vous",
  "/messages": "vos messages",
  "/profil": "votre profil",
  "/profil-pro": "votre profil pro",
  "/mon-solde": "votre solde",
  "/parametres": "les paramètres",
  "/notifications": "vos notifications",
  "/reels": "les reels",
  "/live": "les lives",
  "/services": "les services",
  "/scan-capillaire": "le scan capillaire",
  "/immobilier": "l'immobilier",
  "/mes-commandes": "vos commandes",
  "/programme-fidelite": "le programme fidélité",
  "/abonnements": "vos abonnements",
  "/pro/equipe": "votre équipe",
  "/pro/catalogue-services": "votre catalogue de services",
  "/pro/analytics": "vos statistiques",
};

function assertRoute(path) {
  const p = String(path || "").split("?")[0].split("#")[0];
  if (!APP_ROUTES.includes(p)) {
    throw new Error(`Je ne connais pas la page « ${path} ». Dites-moi où aller parmi : accueil, boutique, rendez-vous, messages, profil, paramètres…`);
  }
  return p;
}

const ACTIONS = {
  NAVIGATE: {
    needsConfirm: false,
    describe: `NAVIGATE {"path": "/boutique"} — ouvrir une page de l'application`,
    run({ path }, { navigate }) {
      if (typeof navigate !== "function") throw new Error("Navigation indisponible pour le moment.");
      const p = assertRoute(path);
      navigate(p);
      return { ok: true, message: `C'est ouvert : ${ROUTE_LABELS[p] || p}.` };
    },
  },
  SET_THEME: {
    needsConfirm: false,
    describe: `SET_THEME {"theme": "night"} — changer le thème ("light", "dark" ou "night")`,
    run({ theme }) {
      const t = String(theme || "").toLowerCase().trim();
      if (!["light", "dark", "night"].includes(t)) {
        throw new Error("Thème inconnu : dites « clair », « sombre » ou « nuit ».");
      }
      applyTheme(t);
      return {
        ok: true,
        message: t === "night" ? "Mode nuit activé." : t === "dark" ? "Thème sombre activé." : "Thème clair activé.",
      };
    },
  },
  SEARCH_PRODUCTS: {
    needsConfirm: false,
    describe: `SEARCH_PRODUCTS {"query": "shampoing"} — chercher un produit dans la boutique`,
    run({ query }, { navigate }) {
      const q = String(query || "").trim().slice(0, 80);
      if (!q) throw new Error("Précisez ce que je dois chercher dans la boutique.");
      if (typeof navigate !== "function") throw new Error("Navigation indisponible pour le moment.");
      navigate("/boutique");
      // La page Boutique écoute cet événement et remplit réellement sa recherche.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("bb:global-search", { detail: { query: q } }));
      }, 450);
      return { ok: true, message: `Je cherche « ${q} » dans la boutique.` };
    },
  },
  CALL_SALON: {
    needsConfirm: true,
    describe: `CALL_SALON {"phone": "0612345678", "name": "Nom du salon"} — appeler un numéro (confirmation requise)`,
    run({ phone, name }) {
      const digits = String(phone || "").replace(/[^\d+]/g, "");
      if (digits.replace(/\D/g, "").length < 8) {
        throw new Error("Ce numéro de téléphone ne semble pas valide.");
      }
      window.location.href = `tel:${digits}`;
      return { ok: true, message: `J'appelle ${name || digits}.` };
    },
  },
  OPEN_DIRECTIONS: {
    needsConfirm: true,
    describe: `OPEN_DIRECTIONS {"address": "12 rue des Lilas, Paris"} — ouvrir l'itinéraire vers une adresse (confirmation requise)`,
    run({ address }) {
      const a = String(address || "").trim().slice(0, 200);
      if (!a) throw new Error("Précisez l'adresse de destination.");
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`, "_blank", "noopener");
      return { ok: true, message: `Itinéraire vers « ${a} » ouvert.` };
    },
  },
};

/** Catalogue lisible par le prompt système de Global. */
export function describeAppActions() {
  return Object.entries(ACTIONS)
    .map(([type, def]) => `- ${def.describe}${def.needsConfirm ? " [CONFIRMATION UTILISATEUR REQUISE]" : ""}`)
    .join("\n");
}

export function isKnownAction(type) {
  return !!ACTIONS[type];
}

export function actionNeedsConfirm(type) {
  return !!ACTIONS[type]?.needsConfirm;
}

/**
 * Exécute une action validée.
 * @returns {{ok: boolean, message: string}} — jamais de faux succès.
 * @throws Error avec le message d'échec exact si l'action est impossible.
 */
export async function runAppAction(type, params, ctx = {}) {
  const def = ACTIONS[type];
  if (!def) throw new Error(`Action inconnue : ${type}.`);
  return def.run(params || {}, ctx);
}
