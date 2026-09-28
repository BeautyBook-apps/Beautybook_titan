import { useEffect, useState } from "react";
import { entities } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";

const CACHE_KEY = "bb_is_pro";

// Promesse partagée : une seule détection réseau par session, même si
// plusieurs pages utilisent le hook.
let detectionPromise = null;

/**
 * Lecture synchrone du cache.
 * Retourne `true` / `false` si connu, `null` sinon.
 * Normalise l'ancien format ("true"/"false") vers le format courant ("1"/"0").
 */
export function readIsProCache() {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
  } catch {
    /* stockage indisponible */
  }
  return null;
}

/** Écriture normalisée du cache ("1" / "0"). */
export function writeIsProCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, value ? "1" : "0");
  } catch {
    /* stockage indisponible */
  }
}

/** Invalide le cache (déconnexion, suppression de compte…). */
export function clearIsProCache() {
  detectionPromise = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* stockage indisponible */
  }
}

function detectOnce() {
  if (!detectionPromise) {
    detectionPromise = (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) return false;
        if (user.role === "vendeur" || user.role === "pro" || user.role === "admin") return true;
        const profiles = await entities.ProfilPro.filter({ user_email: user.email }, "-created_at", 1).catch(
          () => []
        );
        return profiles.length > 0;
      } catch {
        return false;
      }
    })().then((result) => {
      writeIsProCache(result);
      return result;
    });
  }
  return detectionPromise;
}

/**
 * Détecte si l'utilisateur connecté est un professionnel.
 *
 * Retourne `null` tant que le statut n'est pas connu (ni la version pro ni
 * la version cliente ne s'affichent entre-temps : pas de flash), puis
 * `true` / `false`.
 *
 * Le résultat est mémorisé en local : au retour, la bonne version s'affiche
 * instantanément, pendant qu'une revalidation silencieuse tourne en
 * arrière-plan (un compte peut devenir pro entre deux visites).
 */
export function useIsPro() {
  const [isPro, setIsPro] = useState(readIsProCache);

  useEffect(() => {
    let cancelled = false;
    detectOnce().then((result) => {
      if (!cancelled) setIsPro(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isPro;
}
