import { readFileSync, writeFileSync } from 'fs';

const HOME_PATH = 'C:/Users/G15/Desktop/Nouveau dossier (10)/Beautybook_titan/beauty_book-main/beauty_book-main/src/pages/Home.jsx';
const RECHERCHE_PATH = 'C:/Users/G15/Desktop/Nouveau dossier (10)/Beautybook_titan/beauty_book-main/beauty_book-main/src/pages/Recherche.jsx';

// ─────────────────────────── HOME.JSX ───────────────────────────────────────
let home = readFileSync(HOME_PATH, 'utf8');

// 1. Add import if not present
if (!home.includes('SearchSuggestionsDropdown')) {
  home = home.replace(
    `import { useState, useCallback, useEffect, useRef } from "react";`,
    `import { useState, useCallback, useEffect, useRef } from "react";\nimport SearchSuggestionsDropdown from "@/components/search/SearchSuggestionsDropdown";`
  );
  console.log('[Home] ✅ Import added');
} else {
  console.log('[Home] ℹ️  Import already present');
}

// 2. Replace the HomeSearch function with a version that has suggestions
const OLD_HOME_SEARCH = `function HomeSearch({ navigate }) {
  const [query, setQuery] = useState("");
  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? \`/recherche?q=\${encodeURIComponent(value)}&entity=Tous&category=Tous\` : "/recherche", {
      state: { source: "home-top-search", surfaces: ["services", "mobile", "social"] },
    });
  };

  return (
    <div className="px-4 pt-3 pb-1">
      <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Search className="ml-2.5 w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        <label className="sr-only" htmlFor="home-top-search">Rechercher une prestation, un style ou un salon</label>
        <input
          id="home-top-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Rechercher un style, un service ou un salon…"
          className="min-w-0 flex-1 h-10 bg-transparent text-[12px] font-bold text-gray-900 outline-none placeholder:text-gray-400"
        />
        <button type="submit" aria-label="Lancer la recherche" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-md shadow-primary/30 active:scale-95 transition-transform">
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}`;

const NEW_HOME_SEARCH = `function HomeSearch({ navigate }) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);

  const submitSearch = (event) => {
    event.preventDefault();
    setShowSuggestions(false);
    const value = query.trim();
    navigate(value ? \`/recherche?q=\${encodeURIComponent(value)}&entity=Tous&category=Tous\` : "/recherche", {
      state: { source: "home-top-search", surfaces: ["services", "mobile", "social"] },
    });
  };

  const handleSuggestionSelect = (suggestion) => {
    setShowSuggestions(false);
    if (suggestion.type === 'category') {
      navigate(\`/services-salons?tab=STYLES&cat=\${suggestion.id}\`, {
        state: { serviceTab: "STYLES", serviceCategory: suggestion.id },
      });
    } else if (suggestion.type === 'salon') {
      navigate(\`/recherche?q=\${encodeURIComponent(suggestion.name)}&entity=Salons&category=Tous\`);
    } else {
      navigate(\`/recherche?q=\${encodeURIComponent(suggestion.query)}&entity=Tous&category=Tous\`);
    }
  };

  return (
    <div className="px-4 pt-3 pb-1" ref={searchContainerRef}>
      <div className="relative">
        <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <Search className="ml-2.5 w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <label className="sr-only" htmlFor="home-top-search">Rechercher une prestation, un style ou un salon</label>
          <input
            id="home-top-search"
            type="search"
            value={query}
            onChange={event => { setQuery(event.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Rechercher un style, un service ou un salon…"
            className="min-w-0 flex-1 h-10 bg-transparent text-[12px] font-bold text-gray-900 outline-none placeholder:text-gray-400"
            autoComplete="off"
          />
          <button type="submit" aria-label="Lancer la recherche" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-md shadow-primary/30 active:scale-95 transition-transform">
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </form>
        <SearchSuggestionsDropdown
          query={query}
          isOpen={showSuggestions}
          onSelectSuggestion={handleSuggestionSelect}
          onClose={() => setShowSuggestions(false)}
          searchContainerRef={searchContainerRef}
        />
      </div>
    </div>
  );
}`;

if (home.includes('const submitSearch = (event) => {')) {
  // Normalize CRLF to LF for matching
  const homeNorm = home.replace(/\r\n/g, '\n');
  const oldNorm = OLD_HOME_SEARCH.replace(/\r\n/g, '\n');
  if (homeNorm.includes(oldNorm)) {
    home = homeNorm.replace(oldNorm, NEW_HOME_SEARCH);
    console.log('[Home] ✅ HomeSearch function replaced');
  } else {
    // Try a simpler targeted replace on the key distinctive line
    home = homeNorm.replace(
      /function HomeSearch\(\{ navigate \}\) \{[\s\S]*?\n\}/,
      NEW_HOME_SEARCH
    );
    console.log('[Home] ✅ HomeSearch replaced via regex');
  }
} else {
  console.log('[Home] ⚠️  HomeSearch pattern not matched');
}

writeFileSync(HOME_PATH, home, 'utf8');
console.log('[Home] ✅ File saved');

// ─────────────────────────── RECHERCHE.JSX ──────────────────────────────────
let rec = readFileSync(RECHERCHE_PATH, 'utf8').replace(/\r\n/g, '\n');

// 1. Add import after the last import line
if (!rec.includes('SearchSuggestionsDropdown')) {
  rec = rec.replace(
    `import './Recherche.css';`,
    `import './Recherche.css';\nimport SearchSuggestionsDropdown from '@/components/search/SearchSuggestionsDropdown';`
  );
  console.log('[Recherche] ✅ Import added');
} else {
  console.log('[Recherche] ℹ️  Import already present');
}

// 2. Find the main function component declaration to add state
// We inject showSuggestions state right after: const navigate = useNavigate();
if (!rec.includes('showSuggestionsR')) {
  rec = rec.replace(
    `const navigate = useNavigate();`,
    `const navigate = useNavigate();
  const [showSuggestionsR, setShowSuggestionsR] = useState(false);
  const searchBarRef = useRef(null);`
  );
  console.log('[Recherche] ✅ State + ref injected');
} else {
  console.log('[Recherche] ℹ️  State already injected');
}

// 3. Replace the search bar div to add relative positioning + dropdown
const OLD_SEARCHBAR = `        {/* Search Bar */}
        <div className="discovery-searchbar">
          <label className="discovery-query">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Rechercher un salon, service, particulier, style ou bundle</span>
            <input 
              type="search" 
              value={q} 
              onChange={e => updateParams({ q: e.target.value })} 
              placeholder="Chercher un salon, particulier, service, style..." 
            />
          </label>
          <button className="discovery-filter-button" aria-label="Ouvrir les filtres" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal size={18} />
            <span>Filtres</span>
            {filterCount > 0 && <b>{filterCount}</b>}
          </button>
        </div>`;

const NEW_SEARCHBAR = `        {/* Search Bar */}
        <div className="discovery-searchbar relative" ref={searchBarRef}>
          <label className="discovery-query">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Rechercher un salon, service, particulier, style ou bundle</span>
            <input 
              type="search" 
              value={q} 
              onChange={e => { updateParams({ q: e.target.value }); setShowSuggestionsR(true); }} 
              onFocus={() => setShowSuggestionsR(true)}
              placeholder="Chercher un salon, particulier, service, style..." 
              autoComplete="off"
            />
          </label>
          <button className="discovery-filter-button" aria-label="Ouvrir les filtres" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal size={18} />
            <span>Filtres</span>
            {filterCount > 0 && <b>{filterCount}</b>}
          </button>
          <SearchSuggestionsDropdown
            query={q}
            isOpen={showSuggestionsR}
            onSelectSuggestion={(suggestion) => {
              setShowSuggestionsR(false);
              if (suggestion.type === 'category') {
                updateParams({ q: suggestion.label, category: suggestion.label });
              } else if (suggestion.type === 'salon') {
                updateParams({ q: suggestion.name, entity: 'Salons' });
              } else {
                updateParams({ q: suggestion.query });
              }
            }}
            onClose={() => setShowSuggestionsR(false)}
            searchContainerRef={searchBarRef}
          />
        </div>`;

if (rec.includes(OLD_SEARCHBAR)) {
  rec = rec.replace(OLD_SEARCHBAR, NEW_SEARCHBAR);
  console.log('[Recherche] ✅ Search bar patched');
} else {
  console.log('[Recherche] ⚠️  Search bar pattern not found, trying partial match');
  // Try to find and replace just the input element
  rec = rec.replace(
    `<input \n              type="search" \n              value={q} \n              onChange={e => updateParams({ q: e.target.value })} \n              placeholder="Chercher un salon, particulier, service, style..." \n            />`,
    `<input \n              type="search" \n              value={q} \n              onChange={e => { updateParams({ q: e.target.value }); setShowSuggestionsR(true); }} \n              onFocus={() => setShowSuggestionsR(true)}\n              placeholder="Chercher un salon, particulier, service, style..." \n              autoComplete="off"\n            />`
  );
  console.log('[Recherche] ⚠️  Applied partial input patch only');
}

writeFileSync(RECHERCHE_PATH, rec, 'utf8');
console.log('[Recherche] ✅ File saved');

console.log('\n🎉 All patches applied!');
