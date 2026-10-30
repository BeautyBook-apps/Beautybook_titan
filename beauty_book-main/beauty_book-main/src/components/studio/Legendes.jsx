import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef } from "react";
import { X, MessageSquare, Wand2, ChevronDown, Type } from "lucide-react";
import { uploadFile } from '@/api/entities';

const FONTS = [
  { id: "bold", label: "Bold", style: "font-black" },
  { id: "serif", label: "Élégant", style: "font-serif" },
  { id: "mono", label: "Mono", style: "font-mono" },
  { id: "light", label: "Light", style: "font-light" },
];

const POSITIONS = [
  { id: "top", label: "Haut", icon: "⬆️" },
  { id: "center", label: "Centre", icon: "⏺" },
  { id: "bottom", label: "Bas", icon: "⬇️" },
];

const STYLES = [
  { id: "outline", label: "Contour", preview: "text-white [text-shadow:_0_0_4px_black,_0_0_4px_black]" },
  { id: "background", label: "Fond", preview: "text-white bg-black/70 px-2 py-0.5 rounded" },
  { id: "gradient", label: "Dégradé", preview: "bg-gradient-to-r from-primary to-yellow-400 bg-clip-text text-transparent font-black" },
  { id: "neon", label: "Néon", preview: "text-primary [text-shadow:_0_0_10px_hsl(var(--primary)),_0_0_20px_hsl(var(--primary))]" },
];

const ANIMATIONS = [
  { id: "none", label: "Aucune" },
  { id: "fade", label: "Fondu" },
  { id: "slide", label: "Glissement" },
  { id: "bounce", label: "Rebond" },
  { id: "typewriter", label: "Machine" },
];

const PRESETS = [
  { label: "🔥 Tendance", text: "Ce look est 🔥 !", font: "bold", style: "neon", position: "bottom" },
  { label: "💅 Pro", text: "Résultat professionnel ✨", font: "serif", style: "outline", position: "top" },
  { label: "🎯 CTA", text: "Réservez maintenant !", font: "bold", style: "background", position: "bottom" },
  { label: "✨ Beauté", text: "La beauté, c'est un art.", font: "serif", style: "gradient", position: "center" },
];

export default function Legendes({ onClose, onDone }) {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [font, setFont] = useState("bold");
  const [position, setPosition] = useState("bottom");
  const [styleId, setStyleId] = useState("outline");
  const [animation, setAnimation] = useState("none");
  const [fontSize, setFontSize] = useState(24);
  const [activeTab, setActiveTab] = useState("texte");
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setUploading(true);
    setError("");
    setImage(localUrl);
    try {
      const { file_url } = await uploadFile({ file });
      setImage(file_url || localUrl);
    } catch (uploadError) {
      setError(uploadError?.message || "Impossible d'importer ce média.");
      setImage(null);
    } finally {
      setUploading(false);
    }
  };

  const generateAI = async () => {
    setGenerating(true);
    try {
      const res = await window.base44?.integrations?.Core?.InvokeLLM?.({
        prompt: `Génère une légende courte et percutante (max 10 mots) pour une publication beauté/coiffure/salon sur les réseaux sociaux. Réponds uniquement avec la légende, sans guillemets.`,
      });
      setText(res?.result || "Un look irrésistible ✨");
    } catch {
      setText("Un look irrésistible ✨");
    }
    setGenerating(false);
  };

  const applyPreset = (preset) => {
    setText(preset.text);
    setFont(preset.font);
    setStyleId(preset.style);
    setPosition(preset.position);
  };

  const textPositionClass = {
    top: "top-4 left-4 right-4",
    center: "top-1/2 -translate-y-1/2 left-4 right-4",
    bottom: "bottom-4 left-4 right-4",
  };

  const currentStyle = STYLES.find(s => s.id === styleId);

  const TABS = [
    { id: "texte", label: "Texte" },
    { id: "style", label: "Style" },
    { id: "presets", label: "Presets" },
  ];

  return (
    <div className="fixed inset-0 bg-[#0d0d1a] z-[90] flex flex-col font-display" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={onClose} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center active:scale-95">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-white text-[16px] font-black">Légendes</span>
        </div>
        <button
          onClick={() => onDone({ image_url: image, caption: text, font, position, style: styleId, animation })}
          disabled={!text || uploading}
          className="bg-primary text-white text-[12px] font-black px-4 py-2 rounded-full active:scale-95 disabled:opacity-40"
        >
          Terminer
        </button>
      </div>
      {error && <p role="alert" className="mx-5 mb-2 rounded-xl bg-red-500/15 px-3 py-2 text-center text-[11px] font-bold text-red-300">{error}</p>}

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center bg-black mx-4 rounded-3xl overflow-hidden relative">
        {image ? (
          <BeautyImage src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center">
              <span className="text-4xl">🖼</span>
            </div>
            <p className="text-white/60 text-[13px] font-black uppercase tracking-widest">Importer un média</p>
            <div className="bg-primary text-white font-black text-[13px] px-6 py-3 rounded-2xl">Choisir</div>
          </button>
        )}
        {/* Légende preview */}
        {text && (
          <div className={`absolute ${textPositionClass[position]} z-10 text-center`}>
            <span
              className={`inline-block ${FONTS.find(f => f.id === font)?.style || "font-black"} ${currentStyle?.preview || "text-white"} leading-snug`}
              style={{ fontSize: `${fontSize}px` }}
            >
              {text}
            </span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mx-4 mt-3">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 pb-2.5 text-[12px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === t.id ? "text-primary border-primary" : "text-white/40 border-transparent"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {activeTab === "texte" && (
          <>
            <div className="flex gap-2">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Votre légende..."
                className="flex-1 bg-white/10 text-white text-[13px] rounded-2xl px-4 py-3 outline-none placeholder:text-white/30"
              />
              <button onClick={generateAI} disabled={generating}
                className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center active:scale-95 disabled:opacity-60 shrink-0">
                {generating
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Wand2 className="w-5 h-5 text-white" />
                }
              </button>
            </div>
            <p className="text-white/30 text-[10px] font-medium text-center">✨ Appuyez sur la baguette pour générer une légende IA</p>

            {/* Position */}
            <div className="flex gap-2">
              {POSITIONS.map(p => (
                <button key={p.id} onClick={() => setPosition(p.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all active:scale-95 ${position === p.id ? "bg-primary text-white" : "bg-white/10 text-white/60"}`}>
                  <span className="text-[18px]">{p.icon}</span>
                  <span className="text-[10px] font-black">{p.label}</span>
                </button>
              ))}
            </div>

            {/* Taille */}
            <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3">
              <Type className="w-4 h-4 text-white/40" />
              <span className="text-white/50 text-[11px] font-black">Taille</span>
              <input type="range" min={12} max={48} value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="flex-1 accent-primary h-1" />
              <span className="text-primary font-black text-[13px]">{fontSize}px</span>
            </div>
          </>
        )}

        {activeTab === "style" && (
          <div className="space-y-3">
            {/* Police */}
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Police</p>
            <div className="flex gap-2">
              {FONTS.map(f => (
                <button key={f.id} onClick={() => setFont(f.id)}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] transition-all active:scale-95 ${font === f.id ? "bg-primary text-white font-black" : "bg-white/10 text-white/60"} ${f.style}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Style texte */}
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-2">Style</p>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyleId(s.id)}
                  className={`py-3 px-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${styleId === s.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/5"}`}>
                  <span className={`text-[14px] font-black ${s.preview}`}>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Animation */}
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-2">Animation</p>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {ANIMATIONS.map(a => (
                <button key={a.id} onClick={() => setAnimation(a.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 ${animation === a.id ? "bg-primary text-white" : "bg-white/10 text-white/60"}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "presets" && (
          <div className="space-y-2">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Légendes prêtes à l'emploi</p>
            {PRESETS.map((preset, i) => (
              <button key={i} onClick={() => applyPreset(preset)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 active:scale-[0.98] transition-all">
                <div className="text-left">
                  <p className="text-white font-black text-[13px]">{preset.label}</p>
                  <p className="text-white/50 text-[11px] font-medium mt-0.5">{preset.text}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-white/30 -rotate-90" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#0d0d1a]" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }} />
    </div>
  );
}
