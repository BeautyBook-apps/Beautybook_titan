import React, { useEffect, useRef, useMemo } from "react";
import { Search, Sparkles, Store, ChevronRight, Tag, Scissors, Flame } from "lucide-react";
import { SERVICE_HOME_CATEGORIES } from "@/lib/categories";
import { BEAUTY_CATEGORY_ICONS } from "@/components/home/CategoryIcons";
import { readPageCache } from "@/hooks/usePageCache";
import SearchMasonryResults from "@/components/search/SearchMasonryResults";

// ── Liste riche de prestations populaires par catégorie ─────────────────────
const POPULAR_BEAUTY_TERMS = [
  // Tresses
  { term: "Tresses collées", category: "tresses", icon: "tresses" },
  { term: "Box braids", category: "tresses", icon: "tresses" },
  { term: "Knotless braids", category: "tresses", icon: "tresses" },
  { term: "Twists / Vanilles", category: "tresses", icon: "tresses" },
  { term: "Nattes africaines", category: "tresses", icon: "tresses" },
  // Coiffure
  { term: "Brushing & Coiffage", category: "coiffure", icon: "coiffure" },
  { term: "Coupe & Dégradé", category: "coiffure", icon: "coiffure" },
  { term: "Coloration & Balayage", category: "coiffure", icon: "coiffure" },
  { term: "Lissage brésilien / tanin", category: "coiffure", icon: "coiffure" },
  // Perruques & Extensions
  { term: "Pose de perruque Lace Wig", category: "perruque", icon: "perruque" },
  { term: "Customisation de perruque", category: "perruque", icon: "perruque" },
  { term: "Extensions kératine", category: "extensions", icon: "extensions" },
  { term: "Tissage capillaire", category: "extensions", icon: "extensions" },
  { term: "Extensions à clips", category: "extensions", icon: "extensions" },
  // Ongles & Pédicure
  { term: "Pose d'ongles en gel", category: "ongles", icon: "ongles" },
  { term: "Vernis semi-permanent", category: "ongles", icon: "ongles" },
  { term: "Nail Art créatif", category: "ongles", icon: "ongles" },
  { term: "Manucure russe", category: "ongles", icon: "ongles" },
  { term: "Beauté des pieds spa", category: "pedicure", icon: "pedicure" },
  // Maquillage & Cils
  { term: "Maquillage soirée / cocktail", category: "maquillage", icon: "maquillage" },
  { term: "Maquillage mariée", category: "maquillage", icon: "maquillage" },
  { term: "Extensions de cils cil à cil", category: "cils", icon: "cils" },
  { term: "Lash Lift & Rehaussement", category: "cils", icon: "cils" },
  { term: "Microblading & Restructuration", category: "cils", icon: "cils" },
  // Soin & Barbe
  { term: "Soin visage Hydrafacial", category: "soin", icon: "soin" },
  { term: "Nettoyage de peau éclat", category: "soin", icon: "soin" },
  { term: "Taille de barbe & rasoir", category: "barbe", icon: "barbe" },
  { term: "Rasage traditionnel à l'ancienne", category: "barbe", icon: "barbe" },
  // Massage & Spa
  { term: "Massage californien relaxant", category: "massage", icon: "massage" },
  { term: "Massage pierres chaudes", category: "massage", icon: "massage" },
  { term: "Hammam & Gommage rituel", category: "spa", icon: "spa" },
  // Épilation, Tatouage & Piercing
  { term: "Épilation cire chaude", category: "epilation", icon: "epilation" },
  { term: "Épilation orientale", category: "epilation", icon: "epilation" },
  { term: "Tatouage flash / fine line", category: "tatouage", icon: "tatouage" },
  { term: "Piercing hélix / oreille", category: "piercing", icon: "piercing" },
  { term: "Piercing nez / nombril", category: "piercing", icon: "piercing" },
];

function normalize(text = "") {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Composant de suggestions en temps réel pour la barre de recherche.
 * Affiche les catégories, les termes de recherche populaires et les salons correspondants.
 * Optimisé mobile (touch, safe area, affichage immédiat au focus).
 */
export default function SearchSuggestionsDropdown({
  query = "",
  isOpen = false,
  onSelectSuggestion,
  onClose,
  searchContainerRef,
}) {
  const dropdownRef = useRef(null);

  // Fermer si clic / tap en dehors
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        searchContainerRef?.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        onClose?.();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, searchContainerRef]);

  // Calcul des suggestions
  const suggestions = useMemo(() => {
    const qNorm = normalize(query);

    // Si aucune saisie (focus direct sur mobile) : afficher les tendances par défaut
    if (!qNorm || qNorm.length < 1) {
      return {
        isEmptyQuery: true,
        categories: SERVICE_HOME_CATEGORIES.slice(1, 5), // Coiffure, Perruque, Tresses, Extensions...
        terms: POPULAR_BEAUTY_TERMS.slice(0, 5), // Box braids, Coupe, Ongles en gel...
        salons: [],
        results: [],
        totalCount: 9,
      };
    }

    // 1. Catégories correspondantes
    const matchedCategories = SERVICE_HOME_CATEGORIES.filter((cat) => {
      const labelNorm = normalize(cat.label);
      const idNorm = normalize(cat.id);
      return labelNorm.includes(qNorm) || idNorm.includes(qNorm);
    }).slice(0, 3);

    // 2. Prestations & styles populaires
    const matchedTerms = POPULAR_BEAUTY_TERMS.filter((item) => {
      const termNorm = normalize(item.term);
      const catNorm = normalize(item.category);
      return termNorm.includes(qNorm) || catNorm.includes(qNorm);
    }).slice(0, 5);

    // 3. Salons depuis le cache local recherche
    let matchedSalons = [];
    let matchedResults = [];
    try {
      const cache = readPageCache("recherche_page");
      const profiles = cache?.profiles || [];
      let homeCache = {};
      try { homeCache = JSON.parse(localStorage.getItem("home_cache_v1") || "{}"); } catch {}
      const catalog = [
        ...(cache?.styles || []).map(item => ({ ...item, entityKind: "style" })),
        ...(cache?.services || []).map(item => ({ ...item, entityKind: "service" })),
        ...(cache?.bundles || []).map(item => ({ ...item, entityKind: "bundle" })),
        ...profiles.map(item => ({ ...item, entityKind: item.type_activite === "Particulier" || item.type_pro === "particulier" ? "particulier" : "salon" })),
        ...(homeCache?.stylesTendance || []).map(item => ({ ...item, entityKind: "style" })),
        ...(homeCache?.servicesRecommandes || []).map(item => ({ ...item, entityKind: "service" })),
        ...(homeCache?.bundles || []).map(item => ({ ...item, entityKind: "bundle" })),
        ...(homeCache?.servicesSponsorises || []).map(entry => ({ ...(entry.item || {}), entityKind: entry.kind || "service" })),
      ];
      matchedResults = catalog.filter(item => normalize([
        item.title, item.name, item.salon_name, item.description, item.category, item.city,
      ].filter(Boolean).join(" ")).includes(qNorm)).slice(0, 8);
      matchedSalons = profiles
        .filter((p) => {
          const name = normalize(p.salon_name || p.name || "");
          const city = normalize(p.city || p.adresse_ville || "");
          return name.includes(qNorm) || city.includes(qNorm);
        })
        .slice(0, 3)
        .map((p) => ({
          id: p.id,
          name: p.salon_name || p.name,
          city: p.city || p.adresse_ville || "",
          type: "salon",
        }));
    } catch {
      matchedSalons = [];
    }

    return {
      isEmptyQuery: false,
      categories: matchedCategories,
      terms: matchedTerms,
      salons: matchedSalons,
      results: matchedResults,
      totalCount: matchedCategories.length + matchedTerms.length + matchedSalons.length + matchedResults.length,
    };
  }, [query]);

  if (!isOpen || !suggestions || suggestions.totalCount === 0) {
    return null;
  }

  // Met en valeur la partie de texte saisie
  const highlightMatch = (text) => {
    const qNorm = normalize(query);
    const textNorm = normalize(text);
    const startIdx = textNorm.indexOf(qNorm);
    if (startIdx === -1 || !qNorm) return text;

    const before = text.substring(0, startIdx);
    const match = text.substring(startIdx, startIdx + query.length);
    const after = text.substring(startIdx + query.length);

    return (
      <span>
        {before}
        <strong className="text-primary font-black underline decoration-primary/40 underline-offset-2">
          {match}
        </strong>
        {after}
      </span>
    );
  };

  return (
    <div
      ref={dropdownRef}
      onTouchStart={(e) => e.stopPropagation()}
      className="absolute left-0 right-0 top-full mt-2 z-[100] rounded-2xl bg-white/95 dark:bg-[#1a1a2e]/95 backdrop-blur-xl border border-orange-100/90 dark:border-white/10 shadow-[0_20px_45px_rgba(15,23,42,0.18)] overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2 text-left"
      role="listbox"
      aria-label="Suggestions de recherche"
    >
      <div className="py-2 divide-y divide-gray-100 dark:divide-white/5 max-h-[380px] overflow-y-auto hide-scrollbar">
        {suggestions.results?.length > 0 && (
          <div className="px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Résultats</p>
              <button type="button" onClick={() => onSelectSuggestion?.({ type: "search-all", query })} className="text-[10px] font-bold text-primary">Tout afficher</button>
            </div>
            <SearchMasonryResults items={suggestions.results.slice(0, 4)} onOpen={item => onSelectSuggestion?.({ type: "result", item })} />
          </div>
        )}
        {/* ── En-tête pour recherche vide (Tendances) ── */}
        {suggestions.isEmptyQuery && (
          <div className="px-3 py-1.5 bg-orange-50/50 dark:bg-white/[0.02]">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Flame size={12} className="text-orange-500" /> Tendances & Idées de recherche
            </p>
          </div>
        )}

        {/* ── Catégories trouvées ── */}
        {suggestions.categories.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Tag size={12} className="text-primary" /> {suggestions.isEmptyQuery ? "Catégories phares" : "Catégories"}
            </p>
            <div className="flex flex-col gap-1">
              {suggestions.categories.map((cat) => {
                const CatIcon = BEAUTY_CATEGORY_ICONS[cat.id] || Sparkles;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      onSelectSuggestion?.({
                        type: "category",
                        id: cat.id,
                        label: cat.label,
                      })
                    }
                    className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl hover:bg-orange-50/70 dark:hover:bg-white/5 active:scale-[0.99] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-100/60 dark:bg-white/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <CatIcon size={18} strokeWidth={2} />
                      </div>
                      <span className="text-[13px] font-bold text-gray-800 dark:text-gray-100">
                        {suggestions.isEmptyQuery ? cat.label : highlightMatch(cat.label)}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      Voir catégorie <ChevronRight size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Prestations & Styles populaires ── */}
        {suggestions.terms.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Sparkles size={12} className="text-primary" /> {suggestions.isEmptyQuery ? "Recherches les plus demandées" : "Prestations suggérées"}
            </p>
            <div className="flex flex-col gap-1">
              {suggestions.terms.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    onSelectSuggestion?.({
                      type: "query",
                      query: item.term,
                      category: item.category,
                    })
                  }
                  className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl hover:bg-orange-50/70 dark:hover:bg-white/5 active:scale-[0.99] transition-all group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Search size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
                    <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                      {suggestions.isEmptyQuery ? item.term : highlightMatch(item.term)}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 group-hover:text-primary transition-colors">
                    Rechercher
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Salons & Professionnels trouvés ── */}
        {suggestions.salons.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Store size={12} className="text-primary" /> Salons & Pros
            </p>
            <div className="flex flex-col gap-1">
              {suggestions.salons.map((salon) => (
                <button
                  key={salon.id}
                  type="button"
                  onClick={() =>
                    onSelectSuggestion?.({
                      type: "salon",
                      id: salon.id,
                      name: salon.name,
                    })
                  }
                  className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl hover:bg-orange-50/70 dark:hover:bg-white/5 active:scale-[0.99] transition-all text-left group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300">
                      <Store size={13} />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
                        {highlightMatch(salon.name)}
                      </p>
                      {salon.city && (
                        <p className="text-[10px] text-gray-400">{salon.city}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Pied du menu avec suggestion d'action ── */}
      {query && (
        <div className="px-4 py-2 bg-orange-50/50 dark:bg-white/[0.02] border-t border-orange-100/50 dark:border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-medium truncate">
            Rechercher « <strong className="text-primary">{query}</strong> »
          </span>
          <button
            type="button"
            onClick={() =>
              onSelectSuggestion?.({
                type: "query",
                query: query,
              })
            }
            className="text-[10px] font-bold text-primary hover:underline shrink-0 ml-2"
          >
            Lancer la recherche
          </button>
        </div>
      )}
    </div>
  );
}
