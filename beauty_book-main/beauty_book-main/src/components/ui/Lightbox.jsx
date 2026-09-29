import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import BeautyImage from "@/components/ui/BeautyImage";

// ── Lightbox plein écran partagée ─────────────────────────────────────
// images : [{ url, caption?, type? }] ou ["url", ...]  (type auto-détecté : "video" si .mp4/.webm/.mov)
// Glisser horizontal (tactile), flèches, compteur, légende, Échap / clic fond pour fermer.
const isVideoUrl = (url) => !!url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov"));

export default function Lightbox({ images = [], initialIndex = 0, onClose }) {
  const list = (images || [])
    .map(it => typeof it === "string" ? { url: it, caption: "" } : it)
    .filter(it => it?.url)
    .map(it => ({ ...it, type: it.type || (isVideoUrl(it.url) ? "video" : "image") }));
  const [idx, setIdx] = useState(Math.min(initialIndex || 0, Math.max(list.length - 1, 0)));
  const touchStartX = useRef(null);

  const goNext = useCallback(() => setIdx(i => Math.min(i + 1, list.length - 1)), [list.length]);
  const goPrev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (list.length === 0) return null;
  const item = list[idx];

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { if (diff > 0) goNext(); else goPrev(); }
    touchStartX.current = null;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" onClick={() => onClose?.()}>
      {/* Barre haut */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={() => onClose?.()} aria-label="Fermer"
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center active:scale-90 transition-all">
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-white text-[13px] font-black tracking-widest">{idx + 1} / {list.length}</span>
        <div className="w-10" />
      </div>

      {/* Média */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-2"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onClick={e => e.stopPropagation()}>
        {item.type === "video" ? (
          <video src={item.url} controls autoPlay playsInline className="max-w-full max-h-full object-contain rounded-lg" />
        ) : (
          <BeautyImage src={item.url} alt={item.caption || `Photo ${idx + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg" />
        )}
      </div>

      {/* Légende */}
      {item.caption ? (
        <p className="text-center text-white/80 text-[13px] font-medium px-8 pb-1 shrink-0" onClick={e => e.stopPropagation()}>
          {item.caption}
        </p>
      ) : null}

      {/* Flèches */}
      {list.length > 1 && (
        <>
          {idx > 0 && (
            <button aria-label="Précédent"
              onClick={e => { e.stopPropagation(); goPrev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-all">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          {idx < list.length - 1 && (
            <button aria-label="Suivant"
              onClick={e => { e.stopPropagation(); goNext(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-all">
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
        </>
      )}

      {/* Miniatures */}
      {list.length > 1 && (
        <div className="shrink-0 px-4 pt-2 pb-6 flex gap-2 overflow-x-auto justify-start sm:justify-center" onClick={e => e.stopPropagation()}>
          {list.map((m, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${i === idx ? "border-white" : "border-transparent opacity-50"}`}>
              {m.type === "video" ? (
                <span className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" />
                </span>
              ) : (
                <BeautyImage src={m.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
