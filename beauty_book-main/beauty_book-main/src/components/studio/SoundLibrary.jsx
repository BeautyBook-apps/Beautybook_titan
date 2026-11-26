import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X, Play, Pause, Volume2, VolumeX, Plus, Music2, Search, Trash2, AudioLines,
  Flame, Sparkles, Radio, Disc3, Check, Loader2, TrendingUp, Heart, RotateCw
} from "lucide-react";
import { useStudioPalette, STUDIO_ACCENT } from "./studioTheme";
import initialTikTokSounds from "./tiktokSoundsData.json";

const ACCENT = STUDIO_ACCENT;

const SOUND_CATEGORIES = [
  { id: "all", label: "Tout voir", icon: Flame },
  { id: "beauty", label: "Beauté & glow", icon: Sparkles },
  { id: "tiktok", label: "Populaires", icon: TrendingUp },
  { id: "afro", label: "Afrobeats", icon: Disc3 },
  { id: "hits_fr", label: "Hits France", icon: Radio },
  { id: "lofi", label: "Lofi & Chill", icon: Music2 },
];

// Puces de suggestions rapides pour la saisie sur mobile
const QUICK_SUGGESTION_TAGS = [
  "Tyla",
  "Aya Nakamura",
  "Espresso",
  "Tayc",
  "Makeba",
  "Afrobeats",
  "Beauté GRWM",
  "Lofi Chill",
  "Billie Eilish",
  "Doja Cat",
];

function Slider({ label, min, max, step = 1, value, fmtv, onChange }) {
  const { TXT, MUTED, TRACK } = useStudioPalette();
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold" style={{ color: MUTED }}>{label}</span>
        <span className="text-[12px] font-mono font-bold" style={{ color: TXT }}>{fmtv ? fmtv(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(90deg, ${ACCENT} ${((value - min) / (max - min)) * 100}%, ${TRACK} ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  );
}

export default function SoundLibrary({
  onClose,
  onPick,
  onImport,
  current,
  musicVol,
  setMusicVol,
  onRemoveCurrent,
  origMuted,
  setOrigMuted,
  selectedKey,
}) {
  const { BG, CARD, INPUT, TRACK, BORDER, TXT, MUTED } = useStudioPalette();
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [curatedTracks] = useState(initialTikTokSounds || []);
  const [featuredTracks, setFeaturedTracks] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [onlineResults, setOnlineResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTrackId, setPreviewTrackId] = useState(null);
  const [showSuggestDropdown, setShowSuggestDropdown] = useState(false);
  const [suggestItems, setSuggestItems] = useState([]);
  const previewRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const inputRef = useRef(null);

  // Catalogue public de previews Apple/iTunes : plusieurs marchés et genres
  // sont interrogés pour garder une sélection mondiale renouvelée à chaque
  // ouverture. On ne télécharge jamais les morceaux complets.
  const loadGlobalRecentTracks = useCallback(async () => {
    setLoadingFeatured(true);
    const discoveryTerms = [
      "new global hits",
      "afrobeats 2026",
      "pop 2026",
      "latin hits 2026",
      "k-pop 2026",
      "francophone 2026",
    ];
    try {
      const responses = await Promise.allSettled(discoveryTerms.map((term) =>
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=50`)
          .then((res) => res.ok ? res.json() : { results: [] })
      ));
      const seen = new Set();
      const tracks = [];
      responses.forEach((response) => {
        if (response.status !== "fulfilled") return;
        (response.value?.results || []).forEach((tr) => {
          if (!tr.previewUrl) return;
          const key = `${tr.trackName || ""}::${tr.artistName || ""}`.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          tracks.push({
            id: "it-" + tr.trackId,
            title: tr.trackName,
            artist: tr.artistName,
            artwork: tr.artworkUrl100 || tr.artworkUrl60,
            previewUrl: tr.previewUrl,
            durationMs: tr.trackTimeMillis || 30000,
            source: "global-recent",
            category: "tiktok",
          });
        });
      });
      setFeaturedTracks(tracks);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn("[SoundLibrary] Impossible d'actualiser la sélection mondiale:", err);
    } finally {
      setLoadingFeatured(false);
    }
  }, []);

  useEffect(() => {
    loadGlobalRecentTracks();
  }, [loadGlobalRecentTracks]);

  // Arrêter l'audio en quittant
  useEffect(() => {
    return () => {
      previewRef.current?.pause();
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // Recherche dans le catalogue musical en ligne.
  const searchMusicCatalog = useCallback(async (queryTerm) => {
    const term = queryTerm.trim();
    if (!term) {
      setOnlineResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      // Recherche par titre, artiste ou genre dans le catalogue musical.
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=200`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Catalogue indisponible (${res.status})`);
      const data = await res.json();

      const tracks = (data.results || [])
        .filter((tr) => Boolean(tr.previewUrl))
        .map((tr) => ({
          id: "it-" + tr.trackId,
          title: tr.trackName,
          artist: tr.artistName,
          artwork: tr.artworkUrl100 || tr.artworkUrl60,
          previewUrl: tr.previewUrl,
          durationMs: tr.trackTimeMillis || 30000,
          source: "global",
        }));

      setOnlineResults(tracks);
    } catch (err) {
      console.warn("[SoundLibrary] Erreur recherche en ligne:", err);
    } finally {
      setSearching(false);
    }
  }, []);

  // ── Saisie en temps réel optimisée mobile : recherche automatique + suggestions ──
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const term = q.trim();
    if (term.length === 0) {
      setOnlineResults([]);
      setSuggestItems([]);
      setShowSuggestDropdown(false);
      setSearching(false);
      return;
    }

    // Suggestions instantanées depuis la sélection locale.
    const discoveryTracks = [...featuredTracks, ...curatedTracks];
    const localMatches = discoveryTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(term.toLowerCase()) ||
        t.artist.toLowerCase().includes(term.toLowerCase())
    );
    setSuggestItems(localMatches.slice(0, 5));
    setShowSuggestDropdown(true);

    // Déclenchement automatique de la recherche globale après 220 ms
    searchDebounceRef.current = setTimeout(() => {
      searchMusicCatalog(term);
    }, 220);

    return () => clearTimeout(searchDebounceRef.current);
  }, [q, curatedTracks, featuredTracks, searchMusicCatalog]);

  // ── Filtrage des pistes à afficher ──
  const displayedTracks = useMemo(() => {
    const term = q.trim().toLowerCase();

    const discoveryTracks = [...featuredTracks, ...curatedTracks];

    // Si une recherche est saisie, combiner la sélection locale et le catalogue.
    if (term.length > 0) {
      const matchedLocal = discoveryTracks.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.artist.toLowerCase().includes(term)
      );

      // Éviter les doublons par titre + artiste
      const seen = new Set();
      const combined = [];

      [...matchedLocal, ...onlineResults].forEach((track) => {
        const key = `${track.title.toLowerCase()} - ${track.artist.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(track);
        }
      });

      return combined;
    }

    // Mode découverte : filtrer selon la catégorie sélectionnée.
    if (selectedCategory === "all") {
      return discoveryTracks;
    }
    return discoveryTracks.filter((t) => t.category === selectedCategory);
  }, [q, selectedCategory, curatedTracks, featuredTracks, onlineResults]);

  // ── Écoute d'un extrait audio de 30 secondes ──
  const togglePreview = (tr) => {
    if (previewUrl === tr.previewUrl) {
      previewRef.current?.pause();
      setPreviewUrl(null);
      setPreviewTrackId(null);
      return;
    }

    previewRef.current?.pause();
    const audio = new Audio(tr.previewUrl);
    audio.volume = 0.7;
    audio
      .play()
      .then(() => {
        setPreviewUrl(tr.previewUrl);
        setPreviewTrackId(tr.id);
      })
      .catch((e) => {
        console.warn("[SoundLibrary] Erreur lecture preview:", e);
      });

    audio.onended = () => {
      setPreviewUrl(null);
      setPreviewTrackId(null);
    };
    previewRef.current = audio;
  };

  const handlePickTrack = (tr) => {
    previewRef.current?.pause();
    onPick?.(tr);
  };

  const close = () => {
    previewRef.current?.pause();
    onClose?.();
  };

  const fmtDur = (ms) => {
    const s = Math.round((ms || 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const isSel = (tr) => selectedKey && selectedKey === `${tr.title} - ${tr.artist}`;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: BG, color: TXT }}>
      {/* ── En-tête : Titre & Bouton Fermer ── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          paddingTop: "max(14px, env(safe-area-inset-top))",
          paddingBottom: 12,
          borderBottom: `1px solid ${BORDER}`,
          background: BG,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={close}
            aria-label="Fermer"
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[18px] font-black tracking-tight">Ajouter un son</h1>
            <p className="text-[11px] font-medium" style={{ color: MUTED }}>
              Recherchez un titre, un artiste ou une ambiance
            </p>
          </div>
        </div>
      </div>

      {/* ── Barre de recherche avec suggestions en direct ── */}
      <div className="px-4 pt-3.5 pb-2 shrink-0 relative z-30" style={{ background: BG }}>
        <div className="relative">
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 h-12 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 transition-all"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <Music2 className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => {
                if (suggestItems.length > 0) setShowSuggestDropdown(true);
              }}
              placeholder="Rechercher un titre, un artiste, une musique…"
              className="flex-1 bg-transparent text-[13px] font-bold outline-none"
              style={{ color: TXT }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />
            ) : q ? (
              <button
                onClick={() => {
                  setQ("");
                  setOnlineResults([]);
                  setShowSuggestDropdown(false);
                  inputRef.current?.focus();
                }}
                aria-label="Effacer"
                className="shrink-0 p-1 rounded-full hover:bg-black/5"
              >
                <X className="w-4 h-4" style={{ color: MUTED }} />
              </button>
            ) : null}
          </div>

          {/* ── Dropdown des suggestions en temps réel sur mobile ── */}
          {showSuggestDropdown && suggestItems.length > 0 && q.trim().length >= 1 && (
            <div
              className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl overflow-hidden z-50 max-h-56 overflow-y-auto shadow-2xl border backdrop-blur-xl animate-in fade-in slide-in-from-top-1"
              style={{ background: CARD, borderColor: BORDER }}
            >
              <div className="p-1.5 divide-y divide-gray-100 dark:divide-white/5">
                {suggestItems.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setQ(s.title);
                      setShowSuggestDropdown(false);
                      searchMusicCatalog(s.title);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left active:bg-orange-50/70 dark:active:bg-white/5 transition-colors"
                  >
                    {s.artwork ? (
                      <img src={s.artwork} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-orange-100 text-orange-600">
                        <Music2 className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold truncate">{s.title}</p>
                      <p className="text-[10px] truncate" style={{ color: MUTED }}>{s.artist}</p>
                    </div>
                    <Search className="w-3.5 h-3.5 shrink-0 opacity-40" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Puces de suggestions rapides (Tap pour chercher) ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-2.5 pb-1">
          <span className="text-[10px] font-black uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1" style={{ color: MUTED }}>
            <Sparkles className="w-3 h-3 text-amber-500" /> Idées :
          </span>
          {QUICK_SUGGESTION_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setQ(tag);
                setShowSuggestDropdown(false);
                searchMusicCatalog(tag);
              }}
              className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all active:scale-95 shadow-xs"
              style={{
                background: q.toLowerCase() === tag.toLowerCase() ? ACCENT : CARD,
                borderColor: q.toLowerCase() === tag.toLowerCase() ? ACCENT : BORDER,
                color: q.toLowerCase() === tag.toLowerCase() ? "#ffffff" : TXT,
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* ── Catégories musicales ── */}
        {!q && (
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pt-2 pb-0.5">
            {SOUND_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isCatActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-sm ${
                    isCatActive ? "ring-2 ring-primary/40" : ""
                  }`}
                  style={{
                    background: isCatActive ? "linear-gradient(135deg, #E8732A, #f59540)" : CARD,
                    color: isCatActive ? "#ffffff" : MUTED,
                    border: `1px solid ${isCatActive ? ACCENT : BORDER}`,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Liste des morceaux ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* Morceau actuellement appliqué */}
        {current && (
          <div className="mb-3 p-3.5 rounded-2xl shadow-sm" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Son actuellement choisi
              </span>
              <button
                onClick={onRemoveCurrent}
                aria-label="Retirer"
                className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 bg-red-50 text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <AudioLines className="w-5 h-5 shrink-0 text-emerald-500 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black truncate">{current.name}</p>
                <p className="text-[11px]" style={{ color: MUTED }}>{fmtDur(current.durMs)}</p>
              </div>
            </div>
            {setMusicVol && (
              <div className="mt-3 pt-2 border-t" style={{ borderColor: BORDER }}>
                <Slider label="Volume du son" min={0} max={100} value={musicVol ?? 80} fmtv={(v) => `${v}%`} onChange={setMusicVol} />
              </div>
            )}
          </div>
        )}

        {/* Coupure son d'origine si vidéo */}
        {setOrigMuted && (
          <button
            onClick={() => setOrigMuted(!origMuted)}
            className="w-full mb-3 py-2.5 rounded-2xl text-[12px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={
              origMuted
                ? { background: "rgba(255,44,85,0.12)", color: "#ff2c55", border: "1px solid rgba(255,44,85,0.3)" }
                : { background: CARD, color: TXT, border: `1px solid ${BORDER}` }
            }
          >
            {origMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {origMuted ? "Son original vidéo coupé (silencieux)" : "Son original vidéo activé"}
          </button>
        )}

        {/* Titre de section */}
        <div className="flex items-center justify-between mb-2 px-1 gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: MUTED }}>
            {q ? (
              <>
                <Search className="w-3.5 h-3.5 text-primary" />
                Résultats pour « {q} » ({displayedTracks.length})
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                {featuredTracks.length > 0 ? "Nouveautés mondiales" : "Sélection musicale"} ({displayedTracks.length})
              </>
            )}
            </p>
            {!q && lastUpdated && (
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>
                Catalogue public actualisé à {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          {!q && (
            <button
              type="button"
              onClick={loadGlobalRecentTracks}
              disabled={loadingFeatured}
              aria-label="Actualiser les nouveautés musicales"
              className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-50"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}
            >
              <RotateCw className={`w-4 h-4 ${loadingFeatured ? "animate-spin" : ""}`} style={{ color: ACCENT }} />
            </button>
          )}
        </div>

        {/* Message d'état vide / chargement */}
        {searching && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-primary">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-[12px] font-bold">Recherche dans le catalogue musical…</span>
          </div>
        )}

        {!searching && displayedTracks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
            <Music2 className="w-12 h-12 opacity-20" />
            <p className="text-[13px] font-bold" style={{ color: TXT }}>
              Aucun résultat pour « {q} »
            </p>
            <p className="text-[11px] max-w-xs" style={{ color: MUTED }}>
              Essayez un autre mot-clé (ex: « Tyla », « Afrobeats », « Lofi ») ou importez votre propre musique.
            </p>
            {onImport && (
              <button
                onClick={onImport}
                className="mt-2 px-5 py-2.5 rounded-full text-white text-[12px] font-black uppercase tracking-wider shadow-md active:scale-95"
                style={{ background: ACCENT }}
              >
                + Importer un fichier audio
              </button>
            )}
          </div>
        )}

        {/* Liste des cartes de pistes */}
        {displayedTracks.map((tr) => {
          const isPlaying = previewTrackId === tr.id;
          const selected = isSel(tr);

          return (
            <div
              key={tr.id}
              onClick={() => handlePickTrack(tr)}
              className="flex items-center gap-3 p-2.5 rounded-2xl mb-2 cursor-pointer transition-all active:scale-[0.99] group"
              style={
                selected
                  ? {
                      background: "rgba(232,115,42,0.12)",
                      border: "1.5px solid rgba(232,115,42,0.6)",
                      boxShadow: "0 6px 18px rgba(232,115,42,0.15)",
                    }
                  : { background: CARD, border: `1px solid ${BORDER}` }
              }
            >
              {/* Image & bouton play preview */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePreview(tr);
                }}
                aria-label={isPlaying ? "Mettre en pause" : "Écouter l'extrait"}
                className="relative w-13 h-13 rounded-xl overflow-hidden shrink-0 shadow-sm active:scale-95 transition-transform"
                style={{ background: TRACK }}
              >
                {tr.artwork ? (
                  <img src={tr.artwork} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-400">
                    <Music2 className="w-5 h-5" />
                  </div>
                )}
                <span
                  className="absolute inset-0 flex items-center justify-center transition-opacity"
                  style={{ background: isPlaying ? "rgba(232,115,42,0.75)" : "rgba(0,0,0,0.38)" }}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white animate-pulse" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </span>
                {isPlaying && (
                  <span className="absolute bottom-1 right-1 flex gap-0.5 items-end h-2.5">
                    <span className="w-0.5 h-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-0.5 h-2 bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-0.5 h-3 bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </button>

              {/* Titre & Artiste */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-black truncate leading-tight">{tr.title}</p>
                  {tr.category === "tiktok" && (
                    <span className="text-[8px] font-black uppercase px-1 rounded bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300 shrink-0">
                      Tendance
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium truncate mt-0.5" style={{ color: MUTED }}>
                  {tr.artist}
                </p>
                {tr.durationMs && (
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: MUTED }}>
                    Extrait 30 s · {fmtDur(tr.durationMs)}
                  </p>
                )}
              </div>

              {/* Bouton Utiliser */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePickTrack(tr);
                }}
                className={`shrink-0 px-4 h-9 rounded-full text-[12px] font-black transition-all active:scale-95 shadow-sm flex items-center gap-1 ${
                  selected ? "text-white" : "text-white hover:opacity-95"
                }`}
                style={{
                  background: selected ? "#16a34a" : ACCENT,
                }}
              >
                {selected ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" /> Choisi
                  </>
                ) : (
                  "Utiliser"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Bouton Importer un audio (fixé en bas) ── */}
      {onImport && (
        <div
          className="px-4 shrink-0 shadow-lg"
          style={{
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            paddingTop: 10,
            borderTop: `1px solid ${BORDER}`,
            background: BG,
          }}
        >
          <button
            onClick={onImport}
            className="w-full py-3.5 rounded-2xl text-white text-[13px] font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md"
            style={{ background: ACCENT }}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" /> Importer un audio personnalisé
          </button>
        </div>
      )}
    </div>
  );
}
