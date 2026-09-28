import { useState, useEffect, useRef, useCallback } from "react";

/**
 * ── Cache de page ──────────────────────────────────────────────────────────
 * Principe appliqué sur toute l'application :
 *   1. Chaque page s'initialise DIRECTEMENT depuis son cache local
 *      → la première peinture affiche les dernières données connues,
 *      jamais une page vide / « Chargement... » / placeholders.
 *   2. Le rafraîchissement réseau se fait en ARRIÈRE-PLAN, sans jamais
 *      vider l'affichage (pas de setX([]) / setX(null) au montage).
 *   3. Chaque chargement frais réécrit le cache (fusion : un chargement
 *      partiel n'écrase jamais les sections déjà en cache).
 */

export function readPageCache(key) {
  if (!key) return null;
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function writePageCache(key, value) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota dépassé ou indisponible : on ignore silencieusement */
  }
}

/** Fusion prudente : un patch partiel ne supprime jamais les clés existantes. */
export function mergePageCache(key, patch) {
  if (!key) return;
  const prev = readPageCache(key);
  writePageCache(key, { ...(prev && typeof prev === "object" ? prev : {}), ...patch });
}

/**
 * useState initialisé depuis le cache.
 * @param {string} key clé localStorage (ou null pour désactiver)
 * @param {*} initial valeur si aucun cache
 * @param {function} select optionnel : (cached) => slice à utiliser
 */
export function useCachedState(key, initial, select) {
  const [value, setValue] = useState(() => {
    if (!key) return initial;
    const cached = readPageCache(key);
    if (cached == null) return initial;
    return typeof select === "function" ? select(cached) : cached;
  });
  return [value, setValue];
}

/**
 * Recharge des données en arrière-plan puis persiste le résultat en cache.
 * Ne vide JAMAIS l'état affiché pendant le chargement.
 *
 * @param {string} key clé de cache
 * @param {function} fetcher async () => données fraîches (ou null si échec)
 * @param {object} opts { deps, select, merge }
 * @returns {function} refresh() à appeler pour recharger manuellement
 */
export function useBackgroundRefresh(key, fetcher, opts = {}) {
  const { deps = [], select, merge = true } = opts;
  const keyRef = useRef(key);
  keyRef.current = key;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    const k = keyRef.current;
    if (!k) return null;
    try {
      const fresh = await fetcherRef.current();
      if (fresh === undefined || fresh === null) return null;
      const value = typeof select === "function" ? select(fresh) : fresh;
      if (merge) mergePageCache(k, value && typeof value === "object" ? value : { value });
      else writePageCache(k, value);
      return value;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return refresh;
}
