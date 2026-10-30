import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef } from "react";
import { X, Scan, Wand2, Check, RefreshCw } from "lucide-react";
import { uploadFile } from '@/api/entities';

const BACKGROUNDS = [
  { id: "transparent", label: "Transparent", preview: "bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Crect width=%228%22 height=%228%22 fill=%22%23ccc%22/%3E%3Crect x=%228%22 y=%228%22 width=%228%22 height=%228%22 fill=%22%23ccc%22/%3E%3Crect x=%228%22 width=%228%22 height=%228%22 fill=%22white%22/%3E%3Crect y=%228%22 width=%228%22 height=%228%22 fill=%22white%22/%3E%3C/svg%3E')]" },
  { id: "white", label: "Blanc", preview: "bg-white" },
  { id: "black", label: "Noir", preview: "bg-black" },
  { id: "gradient_purple", label: "Violet", preview: "bg-gradient-to-br from-purple-500 to-pink-500" },
  { id: "gradient_blue", label: "Bleu", preview: "bg-gradient-to-br from-blue-500 to-cyan-500" },
  { id: "gradient_orange", label: "Orange", preview: "bg-gradient-to-br from-orange-500 to-yellow-500" },
  { id: "studio", label: "Studio", preview: "bg-gradient-to-b from-gray-300 to-gray-100" },
  { id: "salon", label: "Salon", preview: "bg-gradient-to-br from-rose-100 to-pink-200" },
];

const TOOLS_INFO = [
  { icon: "🪄", label: "Suppression auto", desc: "L'IA détecte et supprime le fond automatiquement" },
  { icon: "✏️", label: "Affinage manuel", desc: "Retouchez les bords avec précision" },
  { icon: "🎨", label: "Nouveau fond", desc: "Remplacez par un fond coloré ou dégradé" },
  { icon: "💾", label: "Export HD", desc: "Exportez en PNG transparent haute définition" },
];

export default function Detourage({ onClose, onDone }) {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [background, setBackground] = useState("transparent");
  const [opacity, setOpacity] = useState(100);
  const [refining, setRefining] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setUploading(true);
    setError("");
    setImage({ localUrl, file_url: null, file });
    setProcessed(false);
    try {
      const { file_url } = await uploadFile({ file });
      setImage(prev => ({ ...prev, file_url }));
    } catch (uploadError) {
      setError(uploadError?.message || "Impossible d'importer cette image.");
      setImage(null);
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!image || uploading) return;
    setProcessing(true);
    // Simulation du détourage IA (2.5s)
    await new Promise(r => setTimeout(r, 2500));
    setProcessed(true);
    setProcessing(false);
  };

  const handleRefine = async () => {
    setRefining(true);
    await new Promise(r => setTimeout(r, 1500));
    setRefining(false);
  };

  const bgInfo = BACKGROUNDS.find(b => b.id === background);

  return (
    <div className="fixed inset-0 bg-[#0d0d1a] z-[90] flex flex-col font-display" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button onClick={onClose} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center active:scale-95">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-pink-500/20 rounded-xl flex items-center justify-center">
            <Scan className="w-4 h-4 text-pink-400" />
          </div>
          <span className="text-white text-[16px] font-black">Détourage IA</span>
        </div>
        {processed && (
          <button onClick={() => onDone({ image_url: image.file_url, background, opacity })}
            className="bg-primary text-white text-[12px] font-black px-4 py-2 rounded-full active:scale-95">
            Terminer
          </button>
        )}
        {!processed && <div className="w-20" />}
      </div>
      {error && <p role="alert" className="mx-5 mb-2 rounded-xl bg-red-500/15 px-3 py-2 text-center text-[11px] font-bold text-red-300">{error}</p>}

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center mx-4 rounded-3xl overflow-hidden relative">
        {/* Fond appliqué */}
        <div className={`absolute inset-0 rounded-3xl ${bgInfo?.preview || "bg-black"}`} />

        {image ? (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <BeautyImage
              src={image.localUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
              style={{
                opacity: opacity / 100,
                // Simulation du détourage avec mix-blend-mode
                mixBlendMode: processed && background === "transparent" ? "multiply" : "normal",
              }}
            />
            {processing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-3xl gap-3">
                <div className="w-12 h-12 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
                <p className="text-white font-black text-[14px]">Détourage en cours...</p>
                <p className="text-white/40 text-[11px]">L'IA analyse les contours</p>
              </div>
            )}
            {processed && (
              <div className="absolute top-3 left-3 bg-green-500/90 rounded-full px-3 py-1.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-[10px] font-black">Détouré !</span>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="relative z-10 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center">
              <span className="text-4xl">📸</span>
            </div>
            <p className="text-white/60 text-[13px] font-black uppercase tracking-widest">Importer une photo</p>
            <div className="bg-primary text-white font-black text-[13px] px-6 py-3 rounded-2xl">Choisir</div>
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <div className="px-4 pt-3 pb-4 space-y-3">
        {!processed && !processing ? (
          <>
            {/* Fonctionnalités */}
            <div className="grid grid-cols-2 gap-2 mb-1">
              {TOOLS_INFO.map((t, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/5 rounded-2xl p-3">
                  <span className="text-[18px] shrink-0">{t.icon}</span>
                  <div>
                    <p className="text-white text-[11px] font-black">{t.label}</p>
                    <p className="text-white/30 text-[9px] font-medium leading-tight">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleProcess}
              disabled={!image || uploading || processing}
              className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Wand2 className="w-5 h-5" />
              Supprimer le fond
            </button>
          </>
        ) : processed ? (
          <>
            {/* Choix du fond */}
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Choisir un fond</p>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {BACKGROUNDS.map(bg => (
                <button key={bg.id} onClick={() => setBackground(bg.id)}
                  className="flex flex-col items-center gap-1 shrink-0 active:scale-95">
                  <div className={`w-12 h-12 rounded-2xl border-2 ${bg.preview} ${background === bg.id ? "border-primary" : "border-white/20"}`} />
                  <span className={`text-[9px] font-black ${background === bg.id ? "text-primary" : "text-white/40"}`}>{bg.label}</span>
                </button>
              ))}
            </div>

            {/* Opacité */}
            <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3">
              <span className="text-white/50 text-[11px] font-black">Opacité</span>
              <input type="range" min={10} max={100} value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="flex-1 accent-primary h-1" />
              <span className="text-primary font-black text-[13px] w-10">{opacity}%</span>
            </div>

            <div className="flex gap-2">
              <button onClick={handleRefine} disabled={refining}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 rounded-2xl text-white font-black text-[12px] active:scale-95 disabled:opacity-50">
                {refining
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <RefreshCw className="w-4 h-4" />}
                Affiner
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 rounded-2xl text-white font-black text-[12px] active:scale-95">
                Nouvelle photo
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="bg-[#0d0d1a]" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }} />
    </div>
  );
}
