import { useState, useRef, useEffect } from "react";
import {
  X, Play, Pause, Volume2, VolumeX, Plus, Music2, Search, Trash2, AudioLines,
} from "lucide-react";

const ACCENT = "#E8732A";
const BG = "#0b0b10";
const CARD = "#17171f";
const BORDER = "rgba(255,255,255,0.08)";
const TXT = "#f5f5f7";
const MUTED = "#8e8e99";

function Slider({ label, min, max, step = 1, value, fmtv, onChange }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold" style={{ color: MUTED }}>{label}</span>
        <span className="text-[12px] font-mono font-bold" style={{ color: TXT }}>{fmtv ? fmtv(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(90deg, ${ACCENT} ${((value - min) / (max - min)) * 100}%, #2a2a35 ${((value - min) / (max - min)) * 100}%)` }} />
    </div>
  );
}

/* ── Bibliothèque de sons partagée : tendances + recherche + import ──
   track = { title, artist, artwork, previewUrl, durationMs } */

export default function SoundLibrary({ onClose, onPick, onImport, current, musicVol, setMusicVol, onRemoveCurrent, origMuted, setOrigMuted, selectedKey }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingTop, setLoadingTop] = useState(true);
  const [searched, setSearched] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewRef = useRef(null);
  const [suggests, setSuggests] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef(null);

  useEffect(() => { loadTrending(); return () => { previewRef.current?.pause(); }; }, []);

  // Suggestions en direct pendant la frappe (debounce 450 ms)
  useEffect(() => {
    clearTimeout(suggestTimer.current);
    const term = q.trim();
    if (term.length < 2) { setSuggests([]); setShowSuggest(false); return; }
    suggestTimer.current = setTimeout(async () => {
      const out = [];
      try {
        const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&country=FR&limit=6`);
        const d = await r.json();
        (d.results || []).forEach((tr, i) => {
          if (tr.previewUrl) out.push({
            id: "sg-it-" + (tr.trackId || i), title: tr.trackName, artist: tr.artistName,
            artwork: tr.artworkUrl60 || tr.artworkUrl100, previewUrl: tr.previewUrl,
          });
        });
      } catch {}
      try {
        const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=6`);
        const d = await r.json();
        (d.data || []).forEach((t) => {
          if (t.preview) out.push({
            id: "sg-dz-" + t.id, title: t.title, artist: t.artist?.name || "",
            artwork: t.album?.cover_small || t.album?.cover_medium, previewUrl: t.preview,
          });
        });
      } catch {}
      setSuggests(out.slice(0, 10));
      setShowSuggest(out.length > 0);
    }, 450);
    return () => clearTimeout(suggestTimer.current);
  }, [q]);

  // Tendances : Top iTunes France + Top Deezer (sans clé)
  const loadTrending = async () => {
    setLoadingTop(true);
    const it = [], dz = [];
    try {
      const r = await fetch("https://itunes.apple.com/fr/rss/topsongs/limit=25/json");
      const j = await r.json();
      (j.feed?.entry || []).forEach((e, i) => {
        const links = Array.isArray(e.link) ? e.link : [e.link].filter(Boolean);
        const enc = links.find((l) => l.attributes?.rel === "enclosure");
        const imgs = e["im:image"] || [];
        if (enc?.attributes?.href) it.push({
          id: "it-top-" + i, title: e["im:name"]?.label || "Sans titre", artist: e["im:artist"]?.label || "",
          artwork: imgs[imgs.length - 1]?.label, previewUrl: enc.attributes.href,
        });
      });
    } catch {}
    try {
      const r = await fetch("https://api.deezer.com/chart/0/tracks?limit=25");
      const j = await r.json();
      (j.data || []).forEach((t) => {
        if (t.preview) dz.push({
          id: "dz-top-" + t.id, title: t.title, artist: t.artist?.name || "",
          artwork: t.album?.cover_medium, previewUrl: t.preview,
        });
      });
    } catch {}
    // Alterne les deux sources pour varier
    const mixed = [];
    const n = Math.max(it.length, dz.length);
    for (let i = 0; i < n; i++) { if (it[i]) mixed.push(it[i]); if (dz[i]) mixed.push(dz[i]); }
    setTrending(mixed.slice(0, 40));
    setLoadingTop(false);
  };

  // Recherche combinée iTunes + Deezer
  const search = async (termOverride) => {
    const term = (termOverride ?? q).trim();
    if (!term) return;
    if (termOverride) setQ(termOverride);
    setShowSuggest(false); setSuggests([]);
    setSearching(true); setSearched(true);
    const out = [];
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&country=FR&limit=20`);
      const d = await r.json();
      (d.results || []).forEach((tr, i) => {
        if (tr.previewUrl) out.push({
          id: "it-" + (tr.trackId || i), title: tr.trackName, artist: tr.artistName,
          artwork: tr.artworkUrl100, previewUrl: tr.previewUrl, durationMs: tr.trackTimeMillis,
        });
      });
    } catch {}
    try {
      const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=20`);
      const d = await r.json();
      (d.data || []).forEach((t) => {
        if (t.preview) out.push({
          id: "dz-" + t.id, title: t.title, artist: t.artist?.name || "",
          artwork: t.album?.cover_medium, previewUrl: t.preview, durationMs: (t.duration || 30) * 1000,
        });
      });
    } catch {}
    setResults(out);
    setSearching(false);
  };

  const togglePreview = (tr) => {
    if (previewUrl === tr.previewUrl) { previewRef.current?.pause(); setPreviewUrl(null); return; }
    previewRef.current?.pause();
    const a = new Audio(tr.previewUrl);
    a.volume = 0.6;
    a.play().catch(() => {});
    a.onended = () => setPreviewUrl(null);
    previewRef.current = a;
    setPreviewUrl(tr.previewUrl);
  };

  const close = () => { previewRef.current?.pause(); onClose(); };
  const fmtDur = (ms) => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  const list = searched ? results : trending;
  const emptyMsg = searching || loadingTop ? "Chargement…" : searched
    ? "Aucun résultat. Essayez un autre titre ou importez votre audio."
    : "Les tendances arrivent…";

  const isSel = (tr) => selectedKey && selectedKey === `${tr.title} - ${tr.artist}`;
  const TrackRow = ({ tr, badge }) => (
    <div onClick={() => onPick(tr)}
      className="flex items-center gap-3 p-2.5 rounded-2xl mb-2 cursor-pointer active:scale-[0.99]"
      style={isSel(tr)
        ? { background: "rgba(232,115,42,0.12)", border: "1px solid rgba(232,115,42,0.45)" }
        : { background: CARD, border: `1px solid ${BORDER}` }}>
      <button onClick={() => togglePreview(tr)} aria-label="Écouter l'extrait" className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ background: "#2a2a35" }}>
        {tr.artwork && <img src={tr.artwork} alt="" className="w-full h-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
          {previewUrl === tr.previewUrl ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
        </span>
        {badge && <span className="absolute top-0 left-0 text-[7px] font-black px-1 rounded-br-lg text-white" style={{ background: ACCENT }}>{badge}</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold truncate">{tr.title}</p>
        <p className="text-[11px] truncate" style={{ color: MUTED }}>{tr.artist}</p>
      </div>
      {tr.durationMs ? <span className="text-[11px] font-mono shrink-0" style={{ color: MUTED }}>{fmtDur(tr.durationMs)}</span> : null}
      <button onClick={(e) => { e.stopPropagation(); onPick(tr); }} className="shrink-0 px-3.5 h-9 rounded-full text-[12px] font-black text-white active:scale-95" style={{ background: ACCENT }}>
        {isSel(tr) ? "✓" : "Utiliser"}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: BG, color: TXT }}>
      <div className="flex items-center gap-3 px-3 shrink-0" style={{ paddingTop: "max(12px, env(safe-area-inset-top))", paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={close} aria-label="Fermer" className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90" style={{ background: CARD }}>
          <X className="w-5 h-5" />
        </button>
        <span className="text-[17px] font-black">Ajouter un son</span>
      </div>

      <div className="px-4 pt-3 shrink-0">
        <div className="relative">
          <div className="flex items-center gap-2 rounded-2xl px-4 h-12" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <Music2 className="w-4 h-4 shrink-0" style={{ color: MUTED }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }}
              onFocus={() => { if (suggests.length > 0 && q.trim().length >= 2) setShowSuggest(true); }}
              placeholder="Titre, artiste…" className="flex-1 bg-transparent text-[14px] outline-none" style={{ color: TXT }} />
            {(searched || q) && (
              <button onClick={() => { setQ(""); setResults([]); setSearched(false); setSuggests([]); setShowSuggest(false); }} aria-label="Effacer" className="shrink-0">
                <X className="w-4 h-4" style={{ color: MUTED }} />
              </button>
            )}
            <button onClick={() => search()} className="text-[13px] font-black shrink-0" style={{ color: ACCENT }}>Rechercher</button>
          </div>
          {showSuggest && suggests.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl overflow-hidden z-30 max-h-64 overflow-y-auto"
              style={{ background: "#1e1e26", border: `1px solid ${BORDER}`, boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
              {suggests.map((s) => (
                <button key={s.id} onClick={() => search(`${s.title} ${s.artist}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-white/5">
                  {s.artwork
                    ? <img src={s.artwork} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    : <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#2a2a35" }}><Music2 className="w-4 h-4" style={{ color: MUTED }} /></span>}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-bold truncate">{s.title}</span>
                    <span className="block text-[11px] truncate" style={{ color: MUTED }}>{s.artist}</span>
                  </span>
                  <Search className="w-4 h-4 shrink-0" style={{ color: MUTED }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] mt-1.5 px-1" style={{ color: MUTED }}>Tendances du moment + recherche — extraits de 30 s. Importez votre audio pour la version intégrale.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {current && (
          <div className="mb-3 p-3 rounded-2xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: MUTED }}>Musique actuelle</p>
            <div className="flex items-center gap-3">
              <AudioLines className="w-5 h-5 shrink-0" style={{ color: "#30d158" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{current.name}</p>
                <p className="text-[11px]" style={{ color: MUTED }}>{fmtDur(current.durMs)}</p>
              </div>
              <button onClick={onRemoveCurrent} aria-label="Retirer" className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90" style={{ background: "rgba(255,44,85,0.12)" }}>
                <Trash2 className="w-4 h-4" style={{ color: "#ff2c55" }} />
              </button>
            </div>
            <div className="mt-2">
              <Slider label="Volume musique" min={0} max={100} value={musicVol ?? 80} fmtv={(v) => `${v}%`} onChange={setMusicVol} />
            </div>
          </div>
        )}

        {setOrigMuted && (
          <button onClick={() => setOrigMuted(!origMuted)}
            className="w-full mb-3 py-3 rounded-2xl text-[13px] font-black flex items-center justify-center gap-2 active:scale-[0.98]"
            style={origMuted ? { background: "rgba(255,44,85,0.15)", color: "#ff2c55" } : { background: CARD, color: TXT, border: `1px solid ${BORDER}` }}>
            {origMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {origMuted ? "Son original coupé" : "Son original activé"}
          </button>
        )}

        {!searched && list.length > 0 && (
          <p className="text-[11px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: MUTED }}>🔥 Tendances</p>
        )}
        {list.length === 0 && <p className="text-center py-8 text-[13px]" style={{ color: MUTED }}>{emptyMsg}</p>}
        {list.map((tr) => <TrackRow key={tr.id} tr={tr} badge={searched ? null : "TOP"} />)}
      </div>

      {onImport && (
        <div className="px-4 shrink-0" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))", paddingTop: 8, borderTop: `1px solid ${BORDER}`, background: BG }}>
          <button onClick={onImport} className="w-full py-4 rounded-2xl text-white text-[14px] font-black flex items-center justify-center gap-2 active:scale-[0.98]" style={{ background: ACCENT }}>
            <Plus className="w-5 h-5" /> Importer un audio
          </button>
        </div>
      )}
    </div>
  );
}
