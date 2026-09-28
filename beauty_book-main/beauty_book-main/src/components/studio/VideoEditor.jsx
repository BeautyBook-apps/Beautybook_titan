import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Play, Pause, Volume2, VolumeX, ZoomIn, ZoomOut, Plus,
  AudioLines, Palette, Type, Trash2,
  ChevronLeft, ChevronRight, FlipHorizontal2, Music2, Loader2, Search,
  Slice, Timer, Gauge, Wand2, SlidersHorizontal, Share,
} from "lucide-react";
import { uploadFile } from "@/api/entities";
import SoundLibrary from "./SoundLibrary";
import { useStudioPalette, STUDIO_ACCENT } from "./studioTheme";

/* ═══════════════════════ Montage vidéo — style TikTok/CapCut ═══════════════════════
   Moteur de lecture réel : horloge maître (rAF), clips lus en séquence dans un
   seul <video>, calques texte, musique de fond synchronisée.
   Export réel : rendu canvas 720x1280 + mixage audio WebAudio → MediaRecorder → upload.
   L'interface suit le thème choisi dans l'app (clair/sombre/nuit). */

const ACCENT = STUDIO_ACCENT;

const FILTERS = [
  { id: "none", label: "Normal", css: "" },
  { id: "nb", label: "N&B", css: "grayscale(1)" },
  { id: "sepia", label: "Sépia", css: "sepia(0.9)" },
  { id: "vif", label: "Vif", css: "saturate(1.8) contrast(1.15)" },
  { id: "chaud", label: "Chaud", css: "saturate(1.4) hue-rotate(-15deg)" },
  { id: "froid", label: "Froid", css: "saturate(1.2) hue-rotate(25deg)" },
  { id: "fane", label: "Fané", css: "brightness(1.1) saturate(0.6) contrast(0.9)" },
  { id: "drama", label: "Drama", css: "contrast(1.4) brightness(0.9) saturate(0.7)" },
];
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const FONTS = ["Arial", "Georgia", "Impact", "Courier New", "Verdana", "Trebuchet MS"];
const COLORS = ["#ffffff", "#000000", "#E8732A", "#ff2c55", "#ffd60a", "#30d158", "#0a84ff", "#bf5af2"];

const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), d = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${d}`;
};
const tlDur = (c) => Math.max(0.1, (c.trimE - c.trimS) / c.speed);
const filterCSS = (c) => {
  const p = FILTERS.find((f) => f.id === c.filter)?.css || "";
  return `brightness(${c.b / 100}) contrast(${c.c / 100}) saturate(${c.s / 100})${p ? " " + p : ""}`;
};
const loadMeta = (url) => new Promise((resolve) => {
  const v = document.createElement("video");
  v.muted = true; v.preload = "metadata";
  v.onloadedmetadata = () => resolve({ dur: v.duration || 0, w: v.videoWidth, h: v.videoHeight });
  v.onerror = () => resolve({ dur: 0, w: 0, h: 0 });
  v.src = url;
});

export default function VideoEditor({ videoUrl, sound, soundUrl, onClose, onDone, onAddSound, onRemoveSound }) {
  const videoRef = useRef(null);
  const musicRef = useRef(null);
  const scrollRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(false);
  const fileClipRef = useRef(null);
  const fileMusicRef = useRef(null);
  const clockRef = useRef({ playing: false, t: 0, last: 0, raf: 0, curClipId: null, seekPending: false });
  const cancelRef = useRef(false);
  const toastTimer = useRef(null);

  const [clips, setClips] = useState([]);
  const [texts, setTexts] = useState([]);
  const [music, setMusic] = useState(null);
  const [sel, setSel] = useState(null); // {type:'clip'|'text'|'music', id}
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tool, setTool] = useState(null);
  // Palette adaptative au thème choisi (clair / sombre / nuit)
  const { BG, CARD, BORDER, TXT, MUTED, TRACK, STAGE, CLIP, RING } = useStudioPalette();
  const [zoom, setZoom] = useState(1);
  const [origMuted, setOrigMuted] = useState(false);
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(null); // {phase:'render'|'upload', progress}
  const [ready, setReady] = useState(false);
  const [showSoundPage, setShowSoundPage] = useState(false);

  const PPS = 90 * zoom; // pixels per second
  const starts = [];
  { let acc = 0; for (const c of clips) { starts.push(acc); acc += tlDur(c); } }
  const totalDur = starts.length ? starts[starts.length - 1] + tlDur(clips[clips.length - 1]) : 0;

  const say = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2200); };
  const selClip = sel?.type === "clip" ? clips.find((c) => c.id === sel.id) : null;
  const selText = sel?.type === "text" ? texts.find((t) => t.id === sel.id) : null;

  const locate = useCallback((t) => {
    for (let i = clips.length - 1; i >= 0; i--) {
      if (t >= starts[i] - 1e-6) return { i, clip: clips[i], start: starts[i], off: t - starts[i] };
    }
    return clips.length ? { i: 0, clip: clips[0], start: 0, off: 0 } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, totalDur]);

  /* ── Clip initial ── */
  useEffect(() => {
    let dead = false;
    (async () => {
      const init = [];
      if (videoUrl) {
        const isImg = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(videoUrl) || videoUrl.startsWith("data:image");
        if (isImg) {
          init.push({ id: uid("c"), url: videoUrl, name: "Image", kind: "image", srcDur: 3, trimS: 0, trimE: 3, speed: 1, filter: "none", b: 100, c: 100, s: 100, flip: false, vol: 100, muted: false });
        } else {
          const m = await loadMeta(videoUrl);
          if (m.dur > 0) init.push({ id: uid("c"), url: videoUrl, name: "Clip principal", kind: "video", srcDur: m.dur, trimS: 0, trimE: m.dur, speed: 1, filter: "none", b: 100, c: 100, s: 100, flip: false, vol: 100, muted: false });
        }
      }
      if (!dead) { setClips(init); if (init.length) setSel({ type: "clip", id: init[0].id }); setReady(true); }
    })();
    if (soundUrl) {
      const a = document.createElement("audio"); a.preload = "metadata";
      a.onloadedmetadata = () => setMusic({ url: soundUrl, name: sound || "Musique", dur: a.duration || 0, vol: 80 });
      a.src = soundUrl;
    }
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Précharge le premier clip pour une lecture immédiate au tap */
  useEffect(() => {
    const v = videoRef.current;
    const first = clips[0];
    if (!v || !first || first.kind !== "video") return;
    if (clockRef.current.curClipId) return;
    if (v.getAttribute("src") !== first.url) { v.src = first.url; v.load(); }
  }, [clips]);

  /* ── Les réglages visuels s'appliquent à l'aperçu même en pause ──
     (le moteur ne tournait que pendant la lecture : filtres, retouche,
     miroir, vitesse et rognage semblaient ne rien faire à l'arrêt) */
  useEffect(() => {
    const loc = locate(playhead);
    if (!loc?.clip) return;
    const { clip, off } = loc;
    const v = videoRef.current;
    const im = document.getElementById("ve-img");
    const f = filterCSS(clip);
    const tr = clip.flip ? "scaleX(-1)" : "";
    if (clip.kind === "video") {
      if (v) {
        v.style.filter = f;
        v.style.transform = tr;
        if (v.playbackRate !== clip.speed) { try { v.playbackRate = clip.speed; } catch {} }
        // Rognage visible en pause : recale l'aperçu sur la tête de lecture
        if (!clockRef.current.playing && v.readyState >= 1) {
          const want = clip.trimS + off * clip.speed;
          if (Math.abs(v.currentTime - want) > 0.5) {
            try { v.currentTime = Math.min(want, Math.max(0, (v.duration || 1) - 0.05)); } catch {}
          }
        }
      }
    } else if (im) {
      im.style.filter = f;
      im.style.transform = tr;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, playhead]);

  /* ── Moteur de lecture : horloge maître ── */
  const switchVideoTo = (clip, offSec) => {
    const v = videoRef.current; if (!v || !clip || clip.kind !== "video") return;
    const ck = clockRef.current;
    if (ck.curClipId !== clip.id) {
      ck.curClipId = clip.id;
      ck.seekPending = true;
      v.src = clip.url;
      v.load();
    }
    // La vitesse s'applique immédiatement, même sans changer de clip
    if (v.playbackRate !== clip.speed) { try { v.playbackRate = clip.speed; } catch {} }
    ck.pendingSeek = clip.trimS + offSec * clip.speed;
  };

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onCanPlay = () => {
      const ck = clockRef.current;
      if (ck.seekPending && ck.pendingSeek != null) {
        try { v.currentTime = clamp(ck.pendingSeek, 0, (v.duration || 1) - 0.05); } catch {}
        ck.seekPending = false; ck.pendingSeek = null;
      }
      if (ck.playing && v.paused) v.play().catch(() => {});
    };
    v.addEventListener("canplay", onCanPlay);
    return () => v.removeEventListener("canplay", onCanPlay);
  }, [ready]);

  useEffect(() => {
    const ck = clockRef.current;
    const loop = (now) => {
      if (!ck.playing) return;
      const dt = Math.min(0.1, (now - ck.last) / 1000); ck.last = now;
      let t = ck.t + dt;
      if (t >= totalDur) { t = totalDur; pauseAll(); setPlayhead(t); return; }
      ck.t = t;
      const loc = locate(t);
      const v = videoRef.current;
      if (loc && v) {
        const { clip, off } = loc;
        if (clip.kind === "video") {
          v.style.display = "";
          const im = document.getElementById("ve-img"); if (im) im.style.display = "none";
          switchVideoTo(clip, off);
          if (!ck.seekPending && v.readyState >= 2) {
            const want = clip.trimS + off * clip.speed;
            if (Math.abs(v.currentTime - want) > 0.4) { try { v.currentTime = want; } catch {} }
            const noSound = clip.muted || origMuted;
            v.muted = noSound;
            v.volume = noSound ? 0 : clip.vol / 100;
            if (v.paused) v.play().catch(() => {});
          }
          v.style.filter = filterCSS(clip);
          v.style.transform = clip.flip ? "scaleX(-1)" : "";
        } else {
          v.pause();
          const im = document.getElementById("ve-img");
          if (im) { im.style.display = ""; im.src = clip.url; im.style.filter = filterCSS(clip); im.style.transform = clip.flip ? "scaleX(-1)" : ""; }
        }
      }
      const m = musicRef.current;
      if (m && music) {
        const mt = Math.min(t, music.dur || t);
        if (Math.abs(m.currentTime - mt) > 0.6) { try { m.currentTime = mt; } catch {} }
        m.volume = music.vol / 100;
        if (m.paused) m.play().catch(() => {});
      }
      setPlayhead(t);
      // auto-scroll timeline
      const sc = scrollRef.current;
      if (sc) {
        const x = t * PPS;
        if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 120) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 2);
      }
      ck.raf = requestAnimationFrame(loop);
    };
    if (playing) { ck.playing = true; ck.last = performance.now(); ck.raf = requestAnimationFrame(loop); }
    else { ck.playing = false; cancelAnimationFrame(ck.raf); }
    return () => cancelAnimationFrame(ck.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, clips, totalDur, music, origMuted, PPS]);

  const pauseAll = () => {
    clockRef.current.playing = false;
    videoRef.current?.pause();
    musicRef.current?.pause();
    setPlaying(false);
  };

  const seek = (t) => {
    t = clamp(t, 0, totalDur);
    clockRef.current.t = t;
    setPlayhead(t);
    followPlayhead(t);
    const loc = locate(t);
    const v = videoRef.current;
    if (loc && v) {
      if (loc.clip.kind === "video") {
        v.style.display = "";
        const im = document.getElementById("ve-img"); if (im) im.style.display = "none";
        const sameClip = clockRef.current.curClipId === loc.clip.id;
        if (!sameClip) clockRef.current.curClipId = null; // recharge si changement de clip
        switchVideoTo(loc.clip, loc.off);
        if (sameClip && v.readyState >= 1) {
          // Clip déjà chargé : canplay ne se redéclenche pas, on applique le seek tout de suite
          // (sinon l'aperçu restait figé pendant le déplacement de la tête de lecture)
          clockRef.current.seekPending = false; clockRef.current.pendingSeek = null;
          try { v.currentTime = clamp(loc.clip.trimS + loc.off * loc.clip.speed, 0, Math.max(0, (v.duration || 1) - 0.05)); } catch {}
        }
        v.style.filter = filterCSS(loc.clip);
        v.style.transform = loc.clip.flip ? "scaleX(-1)" : "";
        const noSound = loc.clip.muted || origMuted;
        v.muted = noSound;
        v.volume = noSound ? 0 : loc.clip.vol / 100;
        if (clockRef.current.playing) { /* canplay reprendra */ } else { v.pause(); }
      } else {
        v.pause();
        const im = document.getElementById("ve-img");
        if (im) { im.style.display = ""; im.src = loc.clip.url; im.style.filter = filterCSS(loc.clip); }
      }
    }
    const m = musicRef.current;
    if (m && music) { try { m.currentTime = Math.min(t, music.dur || 0); } catch {} }
  };

  const togglePlay = () => {
    if (!clips.length) { say("Ajoutez d'abord un clip"); return; }
    if (playing) { pauseAll(); return; }
    if (playhead >= totalDur - 0.05) seek(0);
    setPlaying(true);
    // Tentative de lecture immédiate dans le geste utilisateur (crucial pour l'audio sur mobile)
    const v = videoRef.current;
    if (v && v.getAttribute("src")) v.play().catch(() => {});
  };

  /* ── Clips : ajout / suppression / split / trim / ordre ── */
  const addClips = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"));
    if (!list.length) return;
    const made = [];
    for (const f of list) {
      const url = URL.createObjectURL(f);
      if (f.type.startsWith("image/")) {
        made.push({ id: uid("c"), url, name: f.name.replace(/\.[^.]+$/, ""), kind: "image", srcDur: 3, trimS: 0, trimE: 3, speed: 1, filter: "none", b: 100, c: 100, s: 100, flip: false, vol: 100, muted: false });
      } else {
        const m = await loadMeta(url);
        if (m.dur <= 0) { say(`« ${f.name} » illisible`); continue; }
        made.push({ id: uid("c"), url, name: f.name.replace(/\.[^.]+$/, ""), kind: "video", srcDur: m.dur, trimS: 0, trimE: m.dur, speed: 1, filter: "none", b: 100, c: 100, s: 100, flip: false, vol: 100, muted: false });
      }
    }
    if (!made.length) return;
    setClips((p) => { const n = [...p, ...made]; setSel({ type: "clip", id: made[0].id }); return n; });
    say(`${made.length} clip${made.length > 1 ? "s" : ""} ajouté${made.length > 1 ? "s" : ""}`);
  };

  const patchClip = (id, patch) => setClips((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const deleteClip = (id) => {
    pauseAll();
    setClips((p) => {
      const n = p.filter((c) => c.id !== id);
      if (sel?.id === id) setSel(n.length ? { type: "clip", id: n[0].id } : null);
      return n;
    });
    clockRef.current.t = 0; setPlayhead(0); clockRef.current.curClipId = null;
  };

  const splitAtPlayhead = () => {
    const loc = locate(playhead);
    if (!loc) { say("Ajoutez d'abord un clip"); return; }
    if (loc.clip.kind === "image") { say("On ne peut pas diviser une image"); return; }
    const srcMid = loc.clip.trimS + loc.off * loc.clip.speed;
    if (srcMid - loc.clip.trimS < 0.2 || loc.clip.trimE - srcMid < 0.2) { say("Placez la tête de lecture au milieu du clip"); return; }
    const a = { ...loc.clip, id: uid("c"), trimE: srcMid, name: loc.clip.name };
    const b = { ...loc.clip, id: uid("c"), trimS: srcMid, name: loc.clip.name + " (2)" };
    setClips((p) => { const n = [...p]; n.splice(loc.i, 1, a, b); return n; });
    setSel({ type: "clip", id: b.id });
    say("Clip divisé");
  };

  /* ── Textes ── */
  const addText = () => {
    const t = { id: uid("t"), text: "Votre texte", x: 50, y: 30, size: 26, color: "#ffffff", font: "Arial", bold: true, start: playhead, end: Math.min(playhead + 3, totalDur || playhead + 3) };
    setTexts((p) => [...p, t]);
    setSel({ type: "text", id: t.id });
    setTool("TEXTE");
  };
  const patchText = (id, patch) => setTexts((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const deleteText = (id) => { setTexts((p) => p.filter((t) => t.id !== id)); if (sel?.id === id) setSel(null); };

  /* ── Musique ── */
  const addMusicFile = (f) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const a = document.createElement("audio"); a.preload = "metadata";
    a.onloadedmetadata = () => {
      setMusic({ url, name: f.name.replace(/\.[^.]+$/, ""), dur: a.duration || 0, vol: 80 });
      onAddSound?.({ name: f.name, url, file: f });
      say("Musique ajoutée");
    };
    a.onerror = () => say("Fichier audio illisible");
    a.src = url;
  };
  const removeMusic = () => { setMusic(null); onRemoveSound?.(); if (sel?.type === "music") setSel(null); };

  // Musique depuis une URL (résultat de recherche) — durée réelle lue depuis le fichier
  const adoptMusicUrl = (url, name) => {
    const a = document.createElement("audio"); a.preload = "metadata";
    a.onloadedmetadata = () => {
      setMusic({ url, name, dur: a.duration || 30, vol: 80 });
      onAddSound?.({ name, url });
      setShowSoundPage(false);
      say("Musique ajoutée");
    };
    a.onerror = () => say("Son illisible");
    a.src = url;
  };

  /* ── Timeline : interactions ── */
  const trackSeek = (e) => {
    const el = scrollRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    seek(clamp((cx - rect.left + el.scrollLeft) / PPS, 0, totalDur));
  };
  // Garde la tête de lecture visible : la timeline défile pour la suivre sur toute sa longueur
  const followPlayhead = (t) => {
    const sc = scrollRef.current;
    if (!sc || dragRef.current) return;
    const x = t * PPS;
    if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 120) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 2);
  };
  // Démarre un scrub (déplacement de la tête de lecture) : utilisable depuis
  // la règle ET depuis la poignée de la tête de lecture elle-même.
  const startScrub = (e) => {
    e.preventDefault();
    dragRef.current = true;
    trackSeek(e);
    const mv = (ev) => trackSeek(ev);
    const up = () => {
      dragRef.current = false;
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };
  const rulerMarks = [];
  {
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60];
    const step = steps.find((s) => s * PPS >= 70) || 60;
    for (let t = 0; t <= totalDur + 0.01; t += step) rulerMarks.push(t);
  }

  /* ── Export réel ── */
  const pickMime = () => {
    const cands = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    return cands.find((c) => window.MediaRecorder?.isTypeSupported(c)) || "";
  };

  // Cache d'images pour l'export (clips photo)
  const imgCache = useRef({});
  const drawCover = (ctx, src, W, H) => {
    const vw = src.videoWidth || src.naturalWidth || W, vh = src.videoHeight || src.naturalHeight || H;
    const s = Math.max(W / vw, H / vh);
    const w = vw * s, h = vh * s;
    ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
  };
  const drawImageClip = (ctx, clip, W, H) => {
    let im = imgCache.current[clip.id];
    if (!im) { im = new Image(); im.crossOrigin = "anonymous"; im.src = clip.url; imgCache.current[clip.id] = im; }
    if (im.complete && im.naturalWidth) drawCover(ctx, im, W, H);
  };

  const doExport = async () => {
    if (!clips.length) { say("Ajoutez d'abord un clip"); return; }
    if (!window.MediaRecorder) { say("Export non supporté par ce navigateur"); return; }
    pauseAll();
    cancelRef.current = false;
    setExporting({ phase: "render", progress: 0 });
    const W = 720, H = 1280;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      const AC = new (window.AudioContext || window.webkitAudioContext)();
      await AC.resume().catch(() => {});
      const dest = AC.createMediaStreamDestination();

      const ev = document.createElement("video");
      ev.muted = false; ev.playsInline = true; ev.crossOrigin = "anonymous";
      const evSrc = AC.createMediaElementSource(ev);
      const evGain = AC.createGain();
      evSrc.connect(evGain); evGain.connect(dest);

      let mEl = null, mGain = null;
      if (music) {
        mEl = document.createElement("audio"); mEl.crossOrigin = "anonymous"; mEl.src = music.url;
        const ms = AC.createMediaElementSource(mEl);
        mGain = AC.createGain(); mGain.gain.value = music.vol / 100;
        ms.connect(mGain); mGain.connect(dest);
      }

      const stream = canvas.captureStream(30);
      const mime = pickMime();
      const rec = new MediaRecorder(new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]), mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      const stopped = new Promise((r) => { rec.onstop = r; });
      rec.start(250);

      const stageW = stageRef.current?.clientWidth || 360;
      const k = W / stageW;

      const renderFrame = (clip, absT) => {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        ctx.save();
        const css = filterCSS(clip);
        ctx.filter = css === "" ? "none" : css;
        if (clip.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        if (clip.kind === "video" && ev.videoWidth) drawCover(ctx, ev, W, H);
        else if (clip.kind === "image") drawImageClip(ctx, clip, W, H);
        ctx.restore();
        ctx.filter = "none";
        for (const tx of texts) {
          if (absT < tx.start || absT > tx.end || !tx.text) continue;
          ctx.font = `${tx.bold ? "bold " : ""}${tx.size * k}px ${tx.font}`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)";
          const px = (tx.x / 100) * W, py = (tx.y / 100) * H;
          ctx.strokeText(tx.text, px, py); ctx.fillStyle = tx.color; ctx.fillText(tx.text, px, py);
        }
      };

      let t = 0;
      for (const clip of clips) {
        if (cancelRef.current) break;
        const dur = tlDur(clip);
        if (clip.kind === "video") {
          await new Promise((res, rej) => {
            ev.onloadeddata = () => { try { ev.currentTime = Math.min(clip.trimS, (ev.duration || 1) - 0.05); } catch {} };
            ev.onseeked = () => res();
            ev.onerror = () => rej(new Error("clip illisible"));
            ev.playbackRate = clip.speed;
            ev.src = clip.url; ev.load();
          });
          evGain.gain.value = (clip.muted || origMuted) ? 0 : clip.vol / 100;
          if (music && t === 0 && mEl) { try { mEl.currentTime = 0; await mEl.play(); } catch {} }
          // Piloté par le temps vidéo réel → reste synchro même si le décodage ralentit
          await new Promise((resolve) => {
            const frame = () => {
              if (cancelRef.current) return resolve();
              const vt = ev.currentTime;
              if (vt < clip.trimS - 0.01) { requestAnimationFrame(frame); return; }
              const el = clamp((vt - clip.trimS) / clip.speed, 0, dur);
              renderFrame(clip, t + el);
              setExporting({ phase: "render", progress: clamp((t + el) / totalDur, 0, 1) });
              if (vt >= clip.trimE - 0.08 || el >= dur) resolve();
              else requestAnimationFrame(frame);
            };
            ev.play().catch(() => resolve());
            requestAnimationFrame(frame);
          });
          ev.pause();
        } else {
          // Clip image : durée fixe, piloté par l'horloge
          if (music && t === 0 && mEl) { try { mEl.currentTime = 0; await mEl.play(); } catch {} }
          await new Promise((resolve) => {
            let last = performance.now(), el = 0;
            const frame = (now) => {
              if (cancelRef.current) return resolve();
              el += Math.min(0.1, (now - last) / 1000); last = now;
              renderFrame(clip, t + Math.min(el, dur));
              setExporting({ phase: "render", progress: clamp((t + el) / totalDur, 0, 1) });
              if (el >= dur) resolve(); else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          });
        }
        t += dur;
      }
      if (mEl) mEl.pause();
      rec.stop(); await stopped;
      AC.close().catch(() => {});
      if (cancelRef.current) { setExporting(null); return; }
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (!blob.size) throw new Error("Rendu vide");
      setExporting({ phase: "upload", progress: 0 });
      const file = new File([blob], `montage_${Date.now()}.webm`, { type: "video/webm" });
      const { file_url } = await uploadFile(file);
      setExporting(null);
      onDone?.({ video_url: file_url, duration: totalDur, originalSoundRemoved: origMuted, soundUrl: music?.url || null });
    } catch (err) {
      console.error("[export]", err);
      setExporting(null);
      say(err?.message === "Choisissez un fichier." ? "Export impossible" : "Échec de l'export. Réessayez.");
    }
  };

  // Cache d'images pour l'export
  // (déplacé plus haut, voir drawImageClip)

  /* ── Fermeture ── */
  const close = () => {
    if (clips.length && !window.confirm("Abandonner le montage ?")) return;
    pauseAll();
    onClose?.();
  };

  const activeTexts = texts.filter((t) => playhead >= t.start && playhead <= t.end && t.text);

  const TOOLS = [
    { id: "COUPER", label: "Couper", icon: Slice },
    { id: "ROGNER", label: "Rogner", icon: Timer },
    { id: "SON", label: "Son", icon: Music2 },
    { id: "VITESSE", label: "Vitesse", icon: Gauge },
    { id: "FILTRES", label: "Filtres", icon: Palette },
    { id: "RETOUCHE", label: "Retouche", icon: SlidersHorizontal },
    { id: "MIROIR", label: "Miroir", icon: FlipHorizontal2 },
    { id: "VOLUME", label: "Volume", icon: Volume2 },
    { id: "TEXTE", label: "Texte", icon: Type },
    { id: "SUPPR", label: "Suppr.", icon: Trash2 },
  ];

  // Sélectionne automatiquement le clip sous la tête de lecture si aucun n'est sélectionné
  const ensureClip = () => {
    if (selClip) return selClip;
    const loc = locate(playhead);
    const c = loc?.clip || clips[0];
    if (!c) { say("Ajoutez d'abord un clip"); setTool(null); return null; }
    setSel({ type: "clip", id: c.id });
    return c;
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col select-none" style={{ background: BG, color: TXT }}>
      <input ref={fileClipRef} type="file" accept="video/*,image/*" multiple style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={(e) => { addClips(e.target.files); e.target.value = ""; }} />
      <input ref={fileMusicRef} type="file" accept="audio/*" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={(e) => { addMusicFile(e.target.files?.[0]); e.target.value = ""; }} />
      <audio ref={musicRef} src={music?.url} preload="auto" />

      {/* Barre du haut */}
      <div className="flex items-center justify-between px-3 shrink-0" style={{ paddingTop: "max(12px, env(safe-area-inset-top))", paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={close} aria-label="Fermer" className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90" style={{ background: CARD }}>
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: CARD }}>
          <Wand2 className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-[14px] font-extrabold tracking-wide">Montage</span>
          {totalDur > 0 && <span className="text-[11px] font-mono" style={{ color: MUTED }}>{fmt(totalDur)}</span>}
        </div>
        <button onClick={doExport} disabled={!clips.length || !!exporting} className="px-5 h-10 rounded-full text-[13px] font-black text-white active:scale-95 disabled:opacity-40" style={{ background: ACCENT }}>
          Exporter
        </button>
      </div>

      {/* Scène */}
      <div className="flex justify-center px-4 pt-3 shrink-0">
        <div ref={stageRef} className="relative rounded-2xl overflow-hidden bg-black" style={{ width: "min(62vw, 300px)", aspectRatio: "9/16", maxHeight: "38vh" }}>
          {clips.length === 0 ? (
            <button onClick={() => fileClipRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-3 active:scale-[0.98]">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
                <Plus className="w-8 h-8 text-white" />
              </div>
              <span className="text-[13px] font-bold" style={{ color: MUTED }}>Ajouter un clip pour commencer</span>
            </button>
          ) : (
            <>
              <video ref={videoRef} playsInline preload="auto" className="absolute inset-0 w-full h-full" style={{ objectFit: "contain", background: STAGE }} />
              <img id="ve-img" alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "contain", display: "none" }} />
              {activeTexts.map((t) => (
                <div key={t.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSel({ type: "text", id: t.id }); setTool("TEXTE");
                    const el = e.currentTarget, sx = e.clientX, sy = e.clientY, ox = t.x, oy = t.y;
                    const st = stageRef.current?.getBoundingClientRect();
                    const mv = (ev) => {
                      if (!st) return;
                      patchText(t.id, { x: clamp(ox + ((ev.clientX - sx) / st.width) * 100, 5, 95), y: clamp(oy + ((ev.clientY - sy) / st.height) * 100, 5, 95) });
                    };
                    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
                    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
                    void el;
                  }}
                  className="absolute z-20 px-2 py-1 cursor-move whitespace-pre-wrap text-center"
                  style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%,-50%)", color: t.color, fontSize: t.size, fontFamily: t.font, fontWeight: t.bold ? 800 : 400, textShadow: "0 2px 8px rgba(0,0,0,0.7)", maxWidth: "90%" }}>
                  {t.text}
                </div>
              ))}
              {!playing && (
                <button onClick={togglePlay} aria-label="Lecture" className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </button>
              )}
            </>
          )}
          {toast && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap" style={{ background: "rgba(0,0,0,0.75)" }}>
              {toast}
            </div>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 shrink-0">
        <span className="text-[11px] font-mono w-14" style={{ color: MUTED }}>{fmt(playhead)}</span>
        <button onClick={() => seek(0)} aria-label="Début" className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90" style={{ background: CARD }}>
          <ChevronLeft className="w-4 h-4" style={{ color: MUTED }} /><ChevronLeft className="w-4 h-4 -ml-3" style={{ color: MUTED }} />
        </button>
        <button onClick={() => seek(playhead - 1)} aria-label="-1s" className="h-9 px-2.5 rounded-full text-[11px] font-bold active:scale-90" style={{ background: CARD, color: MUTED }}>-1s</button>
        <button onClick={togglePlay} aria-label={playing ? "Pause" : "Lecture"} className="w-13 h-13 rounded-full flex items-center justify-center active:scale-95" style={{ width: 52, height: 52, background: ACCENT }}>
          {playing ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
        </button>
        <button onClick={() => seek(playhead + 1)} aria-label="+1s" className="h-9 px-2.5 rounded-full text-[11px] font-bold active:scale-90" style={{ background: CARD, color: MUTED }}>+1s</button>
        <button onClick={() => seek(totalDur)} aria-label="Fin" className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90" style={{ background: CARD }}>
          <ChevronRight className="w-4 h-4" style={{ color: MUTED }} /><ChevronRight className="w-4 h-4 -ml-3" style={{ color: MUTED }} />
        </button>
        <span className="text-[11px] font-mono w-14 text-right" style={{ color: MUTED }}>{fmt(totalDur)}</span>
      </div>

      {/* Timeline */}
      <div className="mx-2 rounded-2xl overflow-hidden shrink-0" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setZoom((z) => clamp(z - 0.25, 0.5, 4))} aria-label="Zoom -" className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90" style={{ background: CARD }}>
              <ZoomOut className="w-3.5 h-3.5" style={{ color: MUTED }} />
            </button>
            <button onClick={() => setZoom((z) => clamp(z + 0.25, 0.5, 4))} aria-label="Zoom +" className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90" style={{ background: CARD }}>
              <ZoomIn className="w-3.5 h-3.5" style={{ color: MUTED }} />
            </button>
          </div>
          <button onClick={() => setOrigMuted((m) => !m)} className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[10px] font-black" style={{ background: origMuted ? "rgba(255,44,85,0.15)" : CARD, color: origMuted ? "#ff2c55" : MUTED }}>
            {origMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />} SON ORIG.
          </button>
        </div>
        <div className="flex">
          <div className="shrink-0" style={{ width: 40 }}>
            <div style={{ height: 20 }} />
            {["V1", "A1", "T1"].map((t) => (
              <div key={t} className="flex items-center justify-center" style={{ height: 46, borderTop: `1px solid ${BORDER}` }}>
                <span className="text-[9px] font-black" style={{ color: t === "V1" ? "#7c9eff" : t === "A1" ? "#30d158" : "#bf5af2" }}>{t}</span>
              </div>
            ))}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div className="relative" style={{ width: Math.max(totalDur * PPS + 80, 400) }}>
              {/* Règle */}
              <div className="relative" style={{ height: 20, touchAction: "none" }}
                onPointerDown={startScrub}>
                {rulerMarks.map((t) => (
                  <div key={t} className="absolute top-0" style={{ left: t * PPS }}>
                    <div className="w-px h-1.5" style={{ background: MUTED }} />
                    <span className="text-[7px] font-mono" style={{ color: MUTED }}>{fmt(t)}</span>
                  </div>
                ))}
              </div>
              {/* Piste V1 */}
              <div className="relative" style={{ height: 46, borderTop: `1px solid ${BORDER}` }}>
                {clips.map((c, i) => {
                  const x = starts[i] * PPS, w = Math.max(26, tlDur(c) * PPS);
                  const active = sel?.id === c.id;
                  return (
                    <div key={c.id}
                      onPointerDown={(e) => {
                        if (e.target.closest(".th")) return;
                        e.stopPropagation();
                        setSel({ type: "clip", id: c.id });
                        const sx = e.clientX, ox = x, dragId = c.id;
                        let moved = false;
                        const mv = (ev) => {
                          const dx = ev.clientX - sx;
                          if (!moved && Math.abs(dx) < 6) return;
                          moved = true;
                          const cxp = ox + dx + w / 2;
                          setClips((p) => {
                            const from = p.findIndex((cc) => cc.id === dragId);
                            if (from < 0) return p;
                            let acc2 = 0, target = from;
                            for (let j = 0; j < p.length; j++) { const cw = Math.max(26, tlDur(p[j]) * PPS); if (cxp >= acc2 && cxp < acc2 + cw) { target = j; break; } acc2 += cw; }
                            if (target === from) return p;
                            const n = [...p]; const [m] = n.splice(from, 1); n.splice(target, 0, m); return n;
                          });
                        };
                        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
                        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
                      }}
                      className="absolute top-1 bottom-1 rounded-lg flex items-center px-2 overflow-hidden cursor-grab"
                      style={{ left: x, width: w, background: active ? "linear-gradient(135deg,#E8732A,#ff9a3c)" : CLIP, border: active ? `2px solid ${RING}` : `1px solid ${BORDER}`, zIndex: active ? 5 : 1 }}>
                      <span className="text-[9px] font-bold truncate" style={{ color: active ? "#fff" : MUTED }}>{c.kind === "image" ? "🖼 " : ""}{c.name}</span>
                      {active && c.kind === "video" && (
                        <>
                          <div className="th absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize rounded-l-lg" style={{ background: "rgba(255,255,255,0.85)" }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const sx = e.clientX, oS = c.trimS;
                              const mv2 = (ev) => patchClip(c.id, { trimS: clamp(oS + ((ev.clientX - sx) / PPS) * c.speed, 0, c.trimE - 0.2) });
                              const up2 = () => { document.removeEventListener("pointermove", mv2); document.removeEventListener("pointerup", up2); };
                              document.addEventListener("pointermove", mv2); document.addEventListener("pointerup", up2);
                            }} />
                          <div className="th absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize rounded-r-lg" style={{ background: "rgba(255,255,255,0.85)" }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const sx = e.clientX, oE = c.trimE;
                              const mv2 = (ev) => patchClip(c.id, { trimE: clamp(oE + ((ev.clientX - sx) / PPS) * c.speed, c.trimS + 0.2, c.srcDur) });
                              const up2 = () => { document.removeEventListener("pointermove", mv2); document.removeEventListener("pointerup", up2); };
                              document.addEventListener("pointermove", mv2); document.addEventListener("pointerup", up2);
                            }} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Piste A1 */}
              <div className="relative" style={{ height: 46, borderTop: `1px solid ${BORDER}` }} onPointerDown={(e) => { if (e.target === e.currentTarget) { trackSeek(e); } }}>
                {music ? (
                  <div onClick={(e) => { e.stopPropagation(); setSel({ type: "music", id: "m" }); pauseAll(); setShowSoundPage(true); }}
                    className="absolute top-1 bottom-1 rounded-lg flex items-center gap-1.5 px-2 overflow-hidden cursor-pointer"
                    style={{ left: 0, width: Math.max(40, Math.min(music.dur, totalDur) * PPS), background: "rgba(48,209,88,0.16)", border: sel?.type === "music" ? `2px solid ${RING}` : "1px solid rgba(48,209,88,0.4)" }}>
                    <AudioLines className="w-3 h-3 shrink-0" style={{ color: "#30d158" }} />
                    <span className="text-[9px] font-bold truncate" style={{ color: "#30d158" }}>{music.name}</span>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); pauseAll(); setShowSoundPage(true); }}
                    className="absolute top-1.5 bottom-1.5 rounded-lg flex items-center gap-1.5 px-3 active:scale-[0.98]"
                    style={{ left: 4, border: "1.5px dashed rgba(48,209,88,0.55)", color: "#30d158" }}>
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black">Ajouter un son</span>
                  </button>
                )}
              </div>
              {/* Piste T1 */}
              <div className="relative" style={{ height: 46, borderTop: `1px solid ${BORDER}` }} onPointerDown={(e) => { if (e.target === e.currentTarget) trackSeek(e); }}>
                {texts.map((t) => (
                  <div key={t.id} onClick={(e) => { e.stopPropagation(); setSel({ type: "text", id: t.id }); setTool("TEXTE"); }}
                    className="absolute top-1 bottom-1 rounded-lg flex items-center px-2 overflow-hidden cursor-pointer"
                    style={{ left: t.start * PPS, width: Math.max(30, (t.end - t.start) * PPS), background: "rgba(191,90,242,0.16)", border: sel?.id === t.id ? `2px solid ${RING}` : "1px solid rgba(191,90,242,0.4)" }}>
                    <span className="text-[9px] font-bold truncate" style={{ color: "#bf5af2" }}>{t.text || "Texte"}</span>
                  </div>
                ))}
              </div>
              {/* Tête de lecture — poignée attrapable (28px) pour le scrub au doigt */}
              <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: playhead * PPS }}>
                <div className="absolute top-0 bottom-0 pointer-events-auto" style={{ left: -14, width: 28, touchAction: "none", cursor: "ew-resize" }}
                  onPointerDown={startScrub}>
                  <div className="w-[2px] h-full mx-auto pointer-events-none" style={{ background: "#ff2c55" }} />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid #ff2c55" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ajouter un clip */}
      <button onClick={() => fileClipRef.current?.click()} className="mx-4 mt-2.5 h-11 shrink-0 rounded-2xl border-2 border-dashed text-[13px] font-black flex items-center justify-center gap-2 active:scale-[0.98]" style={{ borderColor: "rgba(232,115,42,0.4)", color: ACCENT }}>
        <Plus className="w-4 h-4" /> AJOUTER UN CLIP
      </button>

      {/* Barre d'outils */}
      <div className="flex gap-1 overflow-x-auto px-2 py-2.5 shrink-0" style={{ scrollbarWidth: "none", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
        {TOOLS.map((t) => {
          const active = tool === t.id;
          return (
            <button key={t.id}
              onClick={() => {
                if (t.id === "SUPPR") {
                  if (sel?.type === "clip") deleteClip(sel.id);
                  else if (sel?.type === "text") deleteText(sel.id);
                  else if (sel?.type === "music") removeMusic();
                  else say("Sélectionnez un élément à supprimer");
                  return;
                }
                if (t.id === "MIROIR") {
                  const c = ensureClip(); if (!c) return;
                  patchClip(c.id, { flip: !c.flip });
                  say(c.flip ? "Miroir désactivé" : "Miroir activé");
                  return;
                }
                if (t.id === "COUPER") {
                  if (!ensureClip()) return;
                  splitAtPlayhead();
                  return;
                }
                if (t.id === "TEXTE" && tool !== "TEXTE") { addText(); return; }
                if (t.id === "SON") { pauseAll(); setShowSoundPage(true); return; }
                if (["ROGNER", "VITESSE", "FILTRES", "RETOUCHE", "VOLUME"].includes(t.id)) { if (!ensureClip()) return; }
                setTool(active ? null : t.id);
              }}
              className="flex flex-col items-center gap-1 w-[62px] shrink-0 py-1.5 rounded-xl active:scale-95">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: active ? "rgba(232,115,42,0.18)" : CARD, border: active ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}` }}>
                <t.icon className="w-5 h-5" style={{ color: active ? ACCENT : MUTED }} />
              </div>
              <span className="text-[8px] font-black uppercase tracking-wide" style={{ color: active ? ACCENT : MUTED }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panneau d'outil */}
      {tool && (
        <div className="shrink-0 rounded-t-3xl px-4 pt-3 pb-6 max-h-[34vh] overflow-y-auto" style={{ background: CARD, borderTop: `1px solid ${BORDER}`, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: BORDER }} />
          {tool === "ROGNER" && selClip && (
            <Panel title={`Rogner — ${selClip.name}`}>
              {selClip.kind === "video" ? (
                <>
                  <Slider label="Début" min={0} max={selClip.srcDur} step={0.1} value={selClip.trimS} fmtv={fmt} onChange={(v) => patchClip(selClip.id, { trimS: clamp(v, 0, selClip.trimE - 0.2) })} />
                  <Slider label="Fin" min={0} max={selClip.srcDur} step={0.1} value={selClip.trimE} fmtv={fmt} onChange={(v) => patchClip(selClip.id, { trimE: clamp(v, selClip.trimS + 0.2, selClip.srcDur) })} />
                  <p className="text-[11px] mt-1" style={{ color: MUTED }}>Durée montée : <b style={{ color: TXT }}>{fmt(tlDur(selClip))}</b></p>
                </>
              ) : (
                <Slider label="Durée d'affichage" min={1} max={10} step={0.5} value={selClip.trimE - selClip.trimS} fmtv={(v) => `${v.toFixed(1)}s`} onChange={(v) => patchClip(selClip.id, { trimE: selClip.trimS + v })} />
              )}
            </Panel>
          )}
          {tool === "VITESSE" && selClip && (
            <Panel title={`Vitesse — ${selClip.name}`}>
              <div className="flex gap-2 flex-wrap">
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => patchClip(selClip.id, { speed: s })}
                    className="px-4 py-2.5 rounded-xl text-[13px] font-black active:scale-95"
                    style={selClip.speed === s ? { background: ACCENT, color: "#fff" } : { background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>
                    {s}x
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: MUTED }}>Durée montée : <b style={{ color: TXT }}>{fmt(tlDur(selClip))}</b></p>
            </Panel>
          )}
          {tool === "FILTRES" && selClip && (
            <Panel title={`Filtres — ${selClip.name}`}>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {FILTERS.map((f) => (
                  <button key={f.id} onClick={() => patchClip(selClip.id, { filter: f.id })}
                    className="shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-black active:scale-95"
                    style={selClip.filter === f.id ? { background: ACCENT, color: "#fff" } : { background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Panel>
          )}
          {tool === "RETOUCHE" && selClip && (
            <Panel title={`Retouche — ${selClip.name}`}>
              <Slider label="Luminosité" min={40} max={180} value={selClip.b} fmtv={(v) => `${v}%`} onChange={(v) => patchClip(selClip.id, { b: v })} />
              <Slider label="Contraste" min={40} max={180} value={selClip.c} fmtv={(v) => `${v}%`} onChange={(v) => patchClip(selClip.id, { c: v })} />
              <Slider label="Saturation" min={0} max={220} value={selClip.s} fmtv={(v) => `${v}%`} onChange={(v) => patchClip(selClip.id, { s: v })} />
              <button onClick={() => patchClip(selClip.id, { b: 100, c: 100, s: 100, filter: "none" })} className="mt-1 text-[12px] font-bold" style={{ color: ACCENT }}>Réinitialiser</button>
            </Panel>
          )}
          {tool === "VOLUME" && selClip && (
            <Panel title={`Volume — ${selClip.name}`}>
              <Slider label="Volume du clip" min={0} max={100} value={selClip.vol} fmtv={(v) => `${v}%`} onChange={(v) => patchClip(selClip.id, { vol: v })} />
              <button onClick={() => patchClip(selClip.id, { muted: !selClip.muted })}
                className="mt-2 w-full py-3 rounded-xl text-[13px] font-black active:scale-[0.98]"
                style={selClip.muted ? { background: "rgba(255,44,85,0.15)", color: "#ff2c55" } : { background: CARD, color: MUTED, border: `1px solid ${BORDER}` }}>
                {selClip.muted ? "Réactiver le son" : "Couper le son du clip"}
              </button>
            </Panel>
          )}
          {tool === "TEXTE" && (
            <Panel title={selText ? "Modifier le texte" : "Texte"}>
              {!selText ? (
                <button onClick={addText} className="w-full py-3.5 rounded-2xl text-white text-[13px] font-black flex items-center justify-center gap-2 active:scale-[0.98]" style={{ background: ACCENT }}>
                  <Plus className="w-4 h-4" /> Ajouter un texte à {fmt(playhead)}
                </button>
              ) : (
                <div className="space-y-3">
                  <textarea value={selText.text} rows={2} onChange={(e) => patchText(selText.id, { text: e.target.value })}
                    placeholder="Votre texte..." className="w-full px-4 py-3 rounded-xl text-[14px] outline-none resize-none" style={{ background: CARD, border: `1px solid ${BORDER}`, color: TXT }} />
                  <div className="flex gap-2 flex-wrap">
                    {FONTS.map((f) => (
                      <button key={f} onClick={() => patchText(selText.id, { font: f })}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: selText.font === f ? ACCENT : CARD, color: selText.font === f ? "#fff" : MUTED, fontFamily: f }}>Ag</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => patchText(selText.id, { color: c })} aria-label={`Couleur ${c}`}
                        className="w-8 h-8 rounded-full" style={{ background: c, border: selText.color === c ? `2.5px solid ${ACCENT}` : "2px solid rgba(255,255,255,0.2)" }} />
                    ))}
                  </div>
                  <Slider label="Taille" min={12} max={64} value={selText.size} fmtv={(v) => `${v}px`} onChange={(v) => patchText(selText.id, { size: v })} />
                  <div className="flex gap-2">
                    <button onClick={() => patchText(selText.id, { bold: !selText.bold })} className="px-4 py-2 rounded-xl text-[13px] font-black" style={{ background: selText.bold ? ACCENT : CARD, color: selText.bold ? "#fff" : MUTED }}>Gras</button>
                    <button onClick={() => deleteText(selText.id)} className="px-4 py-2 rounded-xl text-[13px] font-black flex items-center gap-1.5" style={{ background: "rgba(255,44,85,0.12)", color: "#ff2c55" }}>
                      <Trash2 className="w-4 h-4" /> Supprimer
                    </button>
                  </div>
                  <Slider label="Apparaît à" min={0} max={totalDur} step={0.1} value={selText.start} fmtv={fmt} onChange={(v) => patchText(selText.id, { start: clamp(v, 0, selText.end - 0.3) })} />
                  <Slider label="Disparaît à" min={0} max={totalDur} step={0.1} value={selText.end} fmtv={fmt} onChange={(v) => patchText(selText.id, { end: clamp(v, selText.start + 0.3, totalDur) })} />
                  <p className="text-[11px]" style={{ color: MUTED }}>Astuce : glissez le texte sur l'aperçu pour le positionner.</p>
                </div>
              )}
            </Panel>
          )}
          {(tool === "COUPER" || tool === "ROGNER" || tool === "VITESSE" || tool === "FILTRES" || tool === "RETOUCHE" || tool === "VOLUME") && !selClip && (
            <p className="text-[13px] text-center py-4" style={{ color: MUTED }}>Sélectionnez d'abord un clip sur la timeline.</p>
          )}
        </div>
      )}

      {/* ── Page « Ajouter un son » plein écran ── */}
      {showSoundPage && (
        <SoundLibrary
          onClose={() => setShowSoundPage(false)}
          onPick={(tr) => adoptMusicUrl(tr.previewUrl, `${tr.title} — ${tr.artist}`)}
          onImport={() => fileMusicRef.current?.click()}
          current={music ? { name: music.name, durMs: music.dur * 1000 } : null}
          musicVol={music?.vol ?? 80}
          setMusicVol={(v) => setMusic((m) => (m ? { ...m, vol: v } : m))}
          onRemoveCurrent={removeMusic}
          origMuted={origMuted}
          setOrigMuted={setOrigMuted}
        />
      )}

      {/* Modale d'export */}
      {exporting && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-xs rounded-3xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {exporting.phase === "render" ? (
              <>
                <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: ACCENT }} />
                <p className="mt-3 text-[15px] font-black">Rendu de la vidéo…</p>
                <p className="text-[12px] mt-1" style={{ color: MUTED }}>{Math.round(exporting.progress * 100)}%</p>
              </>
            ) : (
              <>
                <Share className="w-10 h-10 mx-auto" style={{ color: ACCENT }} />
                <p className="mt-3 text-[15px] font-black">Envoi en cours…</p>
                <p className="text-[12px] mt-1" style={{ color: MUTED }}>Téléversement de la vidéo finale</p>
              </>
            )}
            <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: CARD }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${exporting.phase === "render" ? exporting.progress * 100 : 100}%`, background: ACCENT }} />
            </div>
            {exporting.phase === "render" && (
              <button onClick={() => { cancelRef.current = true; }} className="mt-4 text-[13px] font-bold" style={{ color: MUTED }}>Annuler</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-black">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Slider({ label, min, max, step = 1, value, fmtv, onChange }) {
  const { TXT, MUTED, TRACK } = useStudioPalette();
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold" style={{ color: MUTED }}>{label}</span>
        <span className="text-[12px] font-mono font-bold" style={{ color: TXT }}>{fmtv ? fmtv(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(90deg, ${ACCENT} ${((value - min) / (max - min)) * 100}%, ${TRACK} ${((value - min) / (max - min)) * 100}%)` }} />
    </div>
  );
}

