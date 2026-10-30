import { useState, useRef } from "react";
import { X, Scissors, Play, Check, Zap } from "lucide-react";
import { uploadFile } from '@/api/entities';

const CUT_MODES = [
  { id: "silence", label: "Couper les silences", desc: "Supprime automatiquement les passages silencieux", icon: "🔇", color: "bg-blue-500/20 text-blue-400" },
  { id: "beat", label: "Couper au rythme", desc: "Synchronise les coupes avec la musique", icon: "🎵", color: "bg-purple-500/20 text-purple-400" },
  { id: "jump", label: "Jump Cuts", desc: "Crée des coupes dynamiques toutes les X secondes", icon: "⚡", color: "bg-yellow-500/20 text-yellow-400" },
  { id: "auto", label: "AutoCut IA", desc: "L'IA analyse et coupe intelligemment", icon: "🤖", color: "bg-green-500/20 text-green-400" },
];

export default function AutoCut({ onClose, onDone }) {
  const [video, setVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [jumpInterval, setJumpInterval] = useState(3);
  const [silenceThreshold, setSilenceThreshold] = useState(0.5);
  const [cuts, setCuts] = useState([]); // timestamps de coupes simulées
  const videoRef = useRef(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const localUrl = URL.createObjectURL(file);
    setVideo({ localUrl, file_url: null });
    try {
      const { file_url } = await uploadFile({ file });
      setVideo({ localUrl, file_url });
    } catch (uploadError) {
      setError(uploadError?.message || "Impossible d'importer cette vidéo.");
      setVideo(null);
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause(); else v.play();
    setIsPlaying(!isPlaying);
  };

  const handleProcess = async () => {
    if (!mode || !video || !duration) return;
    setProcessing(true);
    // Simulation du traitement IA (2s)
    await new Promise(r => setTimeout(r, 2000));
    // Génère des coupes simulées
    const numCuts = mode === "jump" ? Math.floor(duration / jumpInterval) : Math.floor(Math.random() * 5) + 3;
    const fakeCuts = Array.from({ length: numCuts }, (_, i) => ({
      start: (i / numCuts) * duration,
      end: ((i + 0.8) / numCuts) * duration,
      kept: Math.random() > 0.3,
    }));
    setCuts(fakeCuts);
    setProcessed(true);
    setProcessing(false);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const keptCount = cuts.filter(c => c.kept).length;
  const removedDuration = cuts.filter(c => !c.kept).reduce((acc, c) => acc + (c.end - c.start), 0);

  return (
    <div className="fixed inset-0 bg-[#0d0d1a] z-[90] flex flex-col font-display" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={onClose} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center active:scale-95">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <Scissors className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-white text-[16px] font-black">AutoCut</span>
        </div>
        {processed && (
          <button onClick={() => onDone({ video_url: video.file_url, cuts, mode })}
            className="bg-primary text-white text-[12px] font-black px-4 py-2 rounded-full active:scale-95">
            Terminer
          </button>
        )}
        {!processed && <div className="w-20" />}
      </div>
      {error && <p role="alert" className="mx-5 mb-2 rounded-xl bg-red-500/15 px-3 py-2 text-center text-[11px] font-bold text-red-300">{error}</p>}

      {/* Video preview */}
      <div className="flex-1 flex items-center justify-center bg-black mx-4 rounded-3xl overflow-hidden relative" onClick={video ? togglePlay : undefined}>
        {video ? (
          <>
            <video
              ref={videoRef}
              src={video.localUrl}
              playsInline
              muted={muted}
              className="max-w-full max-h-full object-contain"
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onEnded={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 bg-black/50 rounded-full flex items-center justify-center">
                  <Play className="w-7 h-7 text-white ml-0.5" />
                </div>
              </div>
            )}
            {/* Timeline avec coupes visuelles */}
            {processed && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="h-6 bg-white/10 rounded-full overflow-hidden flex">
                  {cuts.map((cut, i) => (
                    <div key={i}
                      className="h-full"
                      style={{
                        width: `${((cut.end - cut.start) / duration) * 100}%`,
                        marginLeft: `${(cut.start / duration) * 100}%`,
                        background: cut.kept ? "hsl(var(--primary))" : "rgba(239,68,68,0.6)",
                        position: "absolute",
                        left: `${(cut.start / duration) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-white/40 text-[9px] font-bold">{formatTime(currentTime)}</span>
                  <span className="text-white/40 text-[9px] font-bold">{formatTime(duration)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center">
              <span className="text-4xl">🎬</span>
            </div>
            <p className="text-white/60 text-[14px] font-black uppercase tracking-widest">Importer une vidéo</p>
            <div className="bg-primary text-white font-black text-[13px] px-6 py-3 rounded-2xl">Choisir</div>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-3xl">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />

      {/* Panel */}
      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Résultats du traitement */}
        {processed ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-green-400 font-black text-[14px]">AutoCut terminé !</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-xl p-2">
                <p className="text-white font-black text-[18px]">{cuts.length}</p>
                <p className="text-white/40 text-[9px] font-black uppercase">Segments</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2">
                <p className="text-primary font-black text-[18px]">{keptCount}</p>
                <p className="text-white/40 text-[9px] font-black uppercase">Conservés</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2">
                <p className="text-red-400 font-black text-[18px]">{formatTime(removedDuration)}</p>
                <p className="text-white/40 text-[9px] font-black uppercase">Supprimé</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Modes */}
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Mode de découpe</p>
            <div className="grid grid-cols-2 gap-2">
              {CUT_MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`flex flex-col gap-1.5 p-3 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${mode === m.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]">{m.icon}</span>
                    <span className={`text-[10px] font-black uppercase ${mode === m.id ? "text-primary" : "text-white/60"}`}>{m.label}</span>
                  </div>
                  <p className="text-white/30 text-[9px] font-medium leading-tight">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* Paramètre du mode sélectionné */}
            {mode === "jump" && (
              <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3">
                <span className="text-white/50 text-[11px] font-black w-32">Intervalle (sec)</span>
                <input type="range" min={1} max={10} value={jumpInterval}
                  onChange={e => setJumpInterval(Number(e.target.value))}
                  className="flex-1 accent-primary h-1" />
                <span className="text-primary font-black text-[13px] w-6">{jumpInterval}s</span>
              </div>
            )}
            {mode === "silence" && (
              <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3">
                <span className="text-white/50 text-[11px] font-black w-32">Seuil silence</span>
                <input type="range" min={0.1} max={1} step={0.1} value={silenceThreshold}
                  onChange={e => setSilenceThreshold(Number(e.target.value))}
                  className="flex-1 accent-primary h-1" />
                <span className="text-primary font-black text-[13px] w-8">{silenceThreshold}</span>
              </div>
            )}

            {/* Bouton lancer */}
            <button
              onClick={handleProcess}
              disabled={!mode || !video || !duration || uploading || processing}
              className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Lancer AutoCut
                </>
              )}
            </button>
          </>
        )}
      </div>

      <div className="bg-[#0d0d1a]" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }} />
    </div>
  );
}
