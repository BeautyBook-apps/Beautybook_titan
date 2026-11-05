import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, X, Play, Volume2, VolumeX, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

function cacheBustedMediaUrl(src, retry = false) {
  if (!src) return src;
  try {
    const url = new URL(src, window.location.href);
    if (retry || url.pathname.includes("/storage/v1/object/public/")) {
      url.searchParams.set("bb_media", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    }
    return url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}bb_media=${Date.now()}`;
  }
}

export default function SponsoredCard({ annonce, onClose, variant = "reels" }) {
  if (!annonce || (!annonce.image_url && !annonce.video_url)) return null;

  return (
    <>
      {variant === "styles" ? (
        <StylesAd annonce={annonce} onClose={onClose} />
      ) : (
        <ReelsAd annonce={annonce} onClose={onClose} />
      )}
    </>
  );
}

function VideoPlayer({ src, poster, className, style, soundOn = false }) {
  const ref = useRef(null);
  const visibleRef = useRef(true);
  const pausedByVisibilityRef = useRef(false);
  const pauseDeadlineRef = useRef(0);
  const resumeTimerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mediaSrc, setMediaSrc] = useState(() => cacheBustedMediaUrl(src));

  useEffect(() => {
    setMediaSrc(cacheBustedMediaUrl(src));
    setRetryCount(0);
    setFailed(false);
  }, [src]);

  const tryPlay = useCallback(() => {
    const el = ref.current;
    if (!el || !visibleRef.current || pausedByVisibilityRef.current) return;
    el.muted = !soundOn;
    el.play().catch(() => {});
  }, [soundOn]);

  const scheduleAutoResume = useCallback(() => {
    clearTimeout(resumeTimerRef.current);
    const remaining = Math.max(0, pauseDeadlineRef.current - Date.now());
    resumeTimerRef.current = setTimeout(() => {
      if (visibleRef.current) {
        pausedByVisibilityRef.current = false;
        tryPlay();
      }
    }, remaining);
  }, [tryPlay]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      visibleRef.current = isVisible;

      if (!isVisible) {
        el.pause();
        el.muted = true;
        pausedByVisibilityRef.current = true;
        pauseDeadlineRef.current = Date.now() + 30000;
        scheduleAutoResume();
        return;
      }

      if (pausedByVisibilityRef.current) {
        clearTimeout(resumeTimerRef.current);
        pausedByVisibilityRef.current = false;
        tryPlay();
        return;
      }

      tryPlay();
    }, { threshold: [0, 0.35] });

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(resumeTimerRef.current);
      el.pause();
      el.muted = true;
    };
  }, [scheduleAutoResume, tryPlay]);

  useEffect(() => {
    if (!mediaSrc || failed) return;
    const el = ref.current;
    if (!el) return;

    el.muted = !soundOn;
    const onCanPlay = () => {
      if (visibleRef.current && !pausedByVisibilityRef.current) tryPlay();
    };
    el.addEventListener("canplay", onCanPlay);
    if (el.readyState >= 3) onCanPlay();
    return () => el.removeEventListener("canplay", onCanPlay);
  }, [mediaSrc, failed, tryPlay]);

  useEffect(() => {
    if (ref.current) {
      ref.current.muted = !soundOn;
      if (soundOn && visibleRef.current && !pausedByVisibilityRef.current) ref.current.play().catch(() => {});
    }
  }, [soundOn]);

  if (failed) {
    return (
      <div className={`relative ${className}`} style={style}>
        {poster && <BeautyImage src={poster} alt="" className="w-full h-full object-cover object-top" />}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <button onClick={tryPlay} className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all">
            <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={style}>
      <video ref={ref} src={mediaSrc} poster={poster}
        className="absolute inset-0 w-full h-full object-cover object-top"
        style={{ objectPosition: "top center" }}
        autoPlay playsInline preload="metadata" controls={false} loop
        muted={!soundOn}
        onError={() => {
          if (retryCount === 0 && src) {
            setRetryCount(1);
            setMediaSrc(cacheBustedMediaUrl(src, true));
          } else {
            setFailed(true);
          }
        }} />
    </div>
  );
}

function AdCountdown({ total = 5, onSkip }) {
  const [count, setCount] = useState(total);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) { onSkip(); return; }
    if (count <= 0) { setDone(true); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, done, onSkip]);

  if (done) return null;
  return (
    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
      <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      <span className="text-white text-[12px] font-black">{count}s</span>
    </div>
  );
}

// Helper pour extraire les repères (callouts) d'une annonce
function extractAdCallouts(annonce) {
  if (Array.isArray(annonce.callouts) && annonce.callouts.length > 0) {
    return annonce.callouts;
  }
  const raw = annonce.description || "";
  const match = raw.match(/<!--CALLOUTS:(.*?)-->/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

// Helper icône/emoji par type de repère (habit, coiffure, maquillage, produit, etc.)
function getCalloutIcon(label = "", targetType = "") {
  const text = (label + " " + targetType).toLowerCase();
  if (text.includes("robe") || text.includes("habit") || text.includes("tenue") || text.includes("veste") || text.includes("style")) return "👗";
  if (text.includes("coiffure") || text.includes("cheveu") || text.includes("chignon") || text.includes("tress") || text.includes("coupe") || text.includes("brushing")) return "✂️";
  if (text.includes("maquillage") || text.includes("teint") || text.includes("lèvre") || text.includes("yeux")) return "💄";
  if (text.includes("sérum") || text.includes("soin") || text.includes("crème") || text.includes("huile")) return "🧴";
  if (targetType === "service") return "✂️";
  return "✨";
}

/* ── REELS ── */
function ReelsAd({ annonce, onClose }) {
  const navigate = useNavigate();
  const [showSkip, setShowSkip] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [calloutsVisible, setCalloutsVisible] = useState(true);
  const isVideo = !!annonce.video_url;

  const callouts = extractAdCallouts(annonce);

  const cleanDescription = (annonce.description || "").replace(/<!--CALLOUTS:.*?-->/g, "").trim();

  const descSentences = (() => {
    const t = cleanDescription;
    if (!t) return [];
    const m = t.match(/[^.!?…]+[.!?…]+["»\s]*/g);
    return (m ? m.map(s => s.trim()).filter(Boolean) : [t]);
  })();
  const descPreview = descSentences.slice(0, 2).join(" ");
  const descHasMore = descSentences.length > 2;

  const handleCalloutClick = (c, e) => {
    e.stopPropagation();
    if (c.cta_url || c.url) {
      if (c.cta_url?.startsWith("/") || c.url?.startsWith("/")) {
        navigate(c.cta_url || c.url);
      } else {
        window.open(c.cta_url || c.url, "_blank");
      }
      return;
    }
    if (c.targetType === "service" && c.targetId) {
      navigate(`/service/${c.targetId}`);
    } else if (c.targetType === "produit" && c.targetId) {
      navigate(`/produit?id=${encodeURIComponent(c.targetId)}`);
    } else if (annonce.cta_url) {
      if (annonce.cta_url.startsWith("/")) {
        navigate(annonce.cta_url);
      } else {
        window.open(annonce.cta_url, "_blank");
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-black overflow-hidden font-display select-none">
      <div className="flex-1 relative min-h-0" onClick={() => setCalloutsVisible(v => !v)}>
        {isVideo ? (
          <VideoPlayer src={annonce.video_url} poster={annonce.image_url} soundOn={soundOn} className="absolute inset-0 w-full h-full" style={{ width: "100%", height: "100%" }} />
        ) : (
          <BeautyImage src={annonce.image_url} alt={annonce.title} className="absolute inset-0 w-full h-full object-cover object-top" />
        )}

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

        {/* Repères / Callouts publicitaires interactifs (Habits, Coiffure, Tête, Maquillage, Produits) */}
        {calloutsVisible && callouts.map((c, i) => (
          <div
            key={c.id || i}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto cursor-pointer animate-fade-in"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
            onClick={(e) => handleCalloutClick(c, e)}
          >
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-amber-400 opacity-60"></span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-primary text-white border-2 border-white shadow-2xl flex items-center justify-center text-[11px] font-black">
                {i + 1}
              </div>
            </div>
            <div className="mt-1 bg-black/90 backdrop-blur-md text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-2xl whitespace-nowrap flex items-center gap-1.5 border border-amber-400/50 active:scale-95 transition-all hover:bg-black">
              <span>{getCalloutIcon(c.label || c.targetName, c.targetType)} {c.label || c.targetName}</span>
              <span className="text-[10px] text-amber-300 font-bold ml-0.5">↗</span>
            </div>
          </div>
        ))}

        {/* Bouton d'indice/toggle des repères */}
        {callouts.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setCalloutsVisible(v => !v); }}
            className="absolute top-24 right-4 z-20 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-black border border-amber-400/40 flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>{calloutsVisible ? "Masquer les références" : `Voir références (${callouts.length})`}</span>
          </button>
        )}

        {/* Header */}
        <div className="absolute inset-x-0 z-20 flex items-center justify-between px-4 pb-2 bg-gradient-to-b from-black/60 to-transparent" style={{ top: "calc(64px + env(safe-area-inset-top, 0px))", paddingTop: "8px" }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {annonce.sponsor_logo ? (
              <BeautyImage src={annonce.sponsor_logo} alt={annonce.sponsor_name} className="w-10 h-10 rounded-full object-cover border-2 border-white/30 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-primary flex items-center justify-center shrink-0 shadow-md">
                <span className="text-white text-[14px] font-black">{(annonce.sponsor_name || "S")[0]}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-[14px] font-black truncate drop-shadow-lg">{annonce.sponsor_name}</p>
              <div className="flex items-center gap-1.5">
                <span className="bg-amber-400/90 text-gray-900 text-[9px] font-black uppercase px-1.5 py-0.2 rounded tracking-wider">Sponsorisé</span>
                {callouts.length > 0 && (
                  <span className="text-white/70 text-[10px] font-bold">· {callouts.length} articles tagués</span>
                )}
              </div>
            </div>
          </div>

          {isVideo ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSoundOn(v => !v); }}
                aria-label={soundOn ? "Couper le son" : "Activer le son"}
                className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-all touch-manipulation"
              >
                {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              {!showSkip ? (
                <AdCountdown total={5} onSkip={() => setShowSkip(true)} />
              ) : (
                <button onClick={onClose} className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 text-[12px] font-black text-gray-900 active:scale-95 transition-all shadow-lg">
                  Ignorer
                </button>
              )}
            </div>
          ) : (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-white/60 shrink-0">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bottom — collé tout en bas de la carte */}
        <div className="absolute bottom-0 inset-x-0 z-30 px-4" style={{ paddingBottom: "calc(108px + env(safe-area-inset-bottom, 0px))" }} onClick={e => e.stopPropagation()}>
          <h3 className="text-white text-[18px] font-black mb-1 drop-shadow-lg">{annonce.title}</h3>
          {cleanDescription && (
            <div className="max-h-20 overflow-y-auto overscroll-contain text-white/80 text-[13px] leading-snug mb-3 drop-shadow">
              <span>{descExpanded || !descHasMore ? cleanDescription : descPreview}</span>
              {descHasMore && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDescExpanded(v => !v); }}
                  className="text-white font-bold ml-1.5 underline underline-offset-2 decoration-white/50 whitespace-nowrap"
                >
                  {descExpanded ? "Voir moins" : "Voir plus"}
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => {
              if (annonce.cta_url) {
                if (annonce.cta_url.startsWith("/")) navigate(annonce.cta_url);
                else window.open(annonce.cta_url, "_blank");
              }
            }}
            className="w-full flex items-center justify-between bg-gradient-to-r from-primary to-orange-500 rounded-2xl px-4 py-3 active:scale-[0.98] transition-all shadow-lg shadow-primary/25"
          >
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-black text-white">{annonce.cta_label || "En savoir plus"}</span>
              {callouts.length > 0 && (
                <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {callouts.length} références
                </span>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-white/90" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── STYLES (flux Services) : carte pub plein format avec repères ── */
function StylesAd({ annonce, onClose }) {
  const navigate = useNavigate();
  const [showSkip, setShowSkip] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [calloutsVisible, setCalloutsVisible] = useState(true);
  const isVideo = !!annonce.video_url;

  const callouts = extractAdCallouts(annonce);
  const cleanDescription = (annonce.description || "").replace(/<!--CALLOUTS:.*?-->/g, "").trim();

  const descSentences = (() => {
    const t = cleanDescription;
    if (!t) return [];
    const m = t.match(/[^.!?…]+[.!?…]+["»\s]*/g);
    return (m ? m.map(s => s.trim()).filter(Boolean) : [t]);
  })();
  const descPreview = descSentences.slice(0, 2).join(" ");
  const descHasMore = descSentences.length > 2;

  const handleCalloutClick = (c, e) => {
    e.stopPropagation();
    if (c.cta_url || c.url) {
      if (c.cta_url?.startsWith("/") || c.url?.startsWith("/")) {
        navigate(c.cta_url || c.url);
      } else {
        window.open(c.cta_url || c.url, "_blank");
      }
      return;
    }
    if (c.targetType === "service" && c.targetId) {
      navigate(`/service/${c.targetId}`);
    } else if (c.targetType === "produit" && c.targetId) {
      navigate(`/produit?id=${encodeURIComponent(c.targetId)}`);
    } else if (annonce.cta_url) {
      if (annonce.cta_url.startsWith("/")) {
        navigate(annonce.cta_url);
      } else {
        window.open(annonce.cta_url, "_blank");
      }
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black font-display select-none" onClick={() => setCalloutsVisible(v => !v)}>
      {/* Média plein cadre */}
      {isVideo ? (
        <VideoPlayer src={annonce.video_url} poster={annonce.image_url} soundOn={soundOn} className="absolute inset-0 w-full h-full" style={{ width: "100%", height: "100%" }} />
      ) : (
        <BeautyImage src={annonce.image_url} alt={annonce.title} className="absolute inset-0 w-full h-full object-cover object-top" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

      {/* Repères / Callouts interactifs */}
      {calloutsVisible && callouts.map((c, i) => (
        <div
          key={c.id || i}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto cursor-pointer animate-fade-in"
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
          onClick={(e) => handleCalloutClick(c, e)}
        >
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-amber-400 opacity-60"></span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-primary text-white border-2 border-white shadow-2xl flex items-center justify-center text-[11px] font-black">
              {i + 1}
            </div>
          </div>
          <div className="mt-1 bg-black/90 backdrop-blur-md text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-2xl whitespace-nowrap flex items-center gap-1.5 border border-amber-400/50 active:scale-95 transition-all hover:bg-black">
            <span>{getCalloutIcon(c.label || c.targetName, c.targetType)} {c.label || c.targetName}</span>
            <span className="text-[10px] text-amber-300 font-bold ml-0.5">↗</span>
          </div>
        </div>
      ))}

      {/* Bouton d'indice/toggle */}
      {callouts.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setCalloutsVisible(v => !v); }}
          className="absolute top-20 right-4 z-20 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] font-black border border-amber-400/40 flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          <span>{calloutsVisible ? "Masquer les références" : `Voir références (${callouts.length})`}</span>
        </button>
      )}

      {/* Header sponsor */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pb-3 bg-gradient-to-b from-black/60 to-transparent" style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {annonce.sponsor_logo ? (
            <BeautyImage src={annonce.sponsor_logo} alt={annonce.sponsor_name} className="w-10 h-10 rounded-full object-cover border-2 border-white/30 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-primary flex items-center justify-center shrink-0 shadow-md">
              <span className="text-white text-[14px] font-black">{(annonce.sponsor_name || "S")[0]}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white text-[14px] font-black truncate drop-shadow-lg">{annonce.sponsor_name}</p>
            <div className="flex items-center gap-1.5">
              <span className="bg-amber-400/90 text-gray-900 text-[9px] font-black uppercase px-1.5 py-0.2 rounded tracking-wider">Sponsorisé</span>
              {callouts.length > 0 && (
                <span className="text-white/70 text-[10px] font-bold">· {callouts.length} articles tagués</span>
              )}
            </div>
          </div>
        </div>
        {isVideo ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSoundOn(v => !v); }}
              aria-label={soundOn ? "Couper le son" : "Activer le son"}
              className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-all touch-manipulation"
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {!showSkip ? (
              <AdCountdown total={5} onSkip={() => setShowSkip(true)} />
            ) : (
              <button onClick={onClose} className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 text-[12px] font-black text-gray-900 active:scale-95 transition-all shadow-lg shrink-0">
                Ignorer
              </button>
            )}
          </div>
        ) : (
          <button onClick={onClose} aria-label="Fermer la publicité" className="w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white/80 shrink-0 active:scale-95 transition-all">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bas : titre + description + CTA */}
      <div className="absolute bottom-0 inset-x-0 z-30 px-4" style={{ paddingBottom: "calc(108px + env(safe-area-inset-bottom, 0px))" }} onClick={e => e.stopPropagation()}>
        {annonce.title && (
          <h3 className="text-white text-[18px] font-black mb-1 drop-shadow-lg">{annonce.title}</h3>
        )}
        {cleanDescription && (
          <div className="max-h-20 overflow-y-auto overscroll-contain text-white/80 text-[13px] leading-snug mb-3 drop-shadow">
            <span>{descExpanded || !descHasMore ? cleanDescription : descPreview}</span>
            {descHasMore && (
              <button
                onClick={(e) => { e.stopPropagation(); setDescExpanded(v => !v); }}
                className="text-white font-bold ml-1.5 underline underline-offset-2 decoration-white/50 whitespace-nowrap"
              >
                {descExpanded ? "Voir moins" : "Voir plus"}
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => {
            if (annonce.cta_url) {
              if (annonce.cta_url.startsWith("/")) navigate(annonce.cta_url);
              else window.open(annonce.cta_url, "_blank");
            }
          }}
          className="w-full flex items-center justify-between bg-gradient-to-r from-primary to-orange-500 rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-all shadow-lg shadow-primary/25"
        >
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-black text-white">{annonce.cta_label || "En savoir plus"}</span>
            {callouts.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {callouts.length} références
              </span>
            )}
          </div>
          <ExternalLink className="w-4 h-4 text-white/90" />
        </button>
      </div>
    </div>
  );
}
