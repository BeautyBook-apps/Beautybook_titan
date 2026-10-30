import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef } from "react";
import { X, Sun, Contrast, Droplets, FlipHorizontal, ScanLine, Wand2 } from "lucide-react";
import { uploadFile } from '@/api/entities';

const FILTERS = [
  { id: null, label: "Original", css: "" },
  { id: "grayscale", label: "N&B", css: "grayscale(100%)" },
  { id: "sepia", label: "Sépia", css: "sepia(80%)" },
  { id: "warm", label: "Chaud", css: "saturate(150%) hue-rotate(-20deg)" },
  { id: "cool", label: "Froid", css: "saturate(120%) hue-rotate(30deg)" },
  { id: "vivid", label: "Vivid", css: "saturate(200%) contrast(110%)" },
  { id: "fade", label: "Fade", css: "brightness(115%) saturate(70%) contrast(85%)" },
  { id: "chrome", label: "Chrome", css: "saturate(130%) contrast(125%) brightness(105%)" },
  { id: "lomo", label: "Lomo", css: "saturate(180%) contrast(130%) brightness(90%)" },
  { id: "matte", label: "Matte", css: "saturate(80%) contrast(90%) brightness(110%)" },
];

const CROPS = [
  { id: "free", label: "Libre", icon: "⬜" },
  { id: "1:1", label: "Carré", icon: "🔲" },
  { id: "4:5", label: "Portrait", icon: "📱" },
  { id: "16:9", label: "Paysage", icon: "🖥" },
  { id: "9:16", label: "Reel", icon: "📹" },
];

export default function EditeurPhotos({ onClose, onDone }) {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ajuster"); // ajuster | filtres | recadrer
  const [filter, setFilter] = useState(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sharpness, setSharpness] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState("free");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const getStyle = () => ({
    filter: [
      filter ? FILTERS.find(f => f.id === filter)?.css || "" : "",
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
      warmth !== 0 ? `hue-rotate(${warmth > 0 ? -warmth : Math.abs(warmth)}deg)` : "",
    ].filter(Boolean).join(" "),
    transform: `scaleX(${flipH ? -1 : 1}) rotate(${rotation}deg)`,
    transition: "all 0.2s ease",
  });

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const localUrl = URL.createObjectURL(file);
    setImage({ localUrl, file_url: null, file });
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

  const handleSave = async () => {
    if (!image?.file_url) return;
    setSaving(true);
    onDone({
      image_url: image.file_url,
      style: { filter, brightness, contrast, saturation, warmth, flipH, rotation, crop },
    });
  };

  const TABS = [
    { id: "ajuster", label: "Ajuster" },
    { id: "filtres", label: "Filtres" },
    { id: "recadrer", label: "Recadrer" },
  ];

  return (
    <div className="fixed inset-0 bg-[#0d0d1a] z-[90] flex flex-col font-display" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={onClose} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center active:scale-95">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-white text-[16px] font-black">Éditeur de photos</span>
        </div>
        <button
          onClick={handleSave}
          disabled={!image?.file_url || saving}
          className="bg-primary text-white text-[12px] font-black px-4 py-2 rounded-full active:scale-95 disabled:opacity-40"
        >
          Terminer
        </button>
      </div>
      {error && <p role="alert" className="mx-5 mb-2 rounded-xl bg-red-500/15 px-3 py-2 text-center text-[11px] font-bold text-red-300">{error}</p>}

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center bg-black mx-4 rounded-3xl overflow-hidden relative">
        {image ? (
          <BeautyImage
            src={image.localUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={getStyle()}
          />
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center">
              <span className="text-4xl">🖼</span>
            </div>
            <p className="text-white/60 text-[14px] font-black uppercase tracking-widest">Importer une photo</p>
            <div className="bg-primary text-white font-black text-[13px] px-6 py-3 rounded-2xl">Choisir</div>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-3xl">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Tabs */}
      <div className="flex border-b border-white/10 mx-4 mt-3">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 pb-2.5 text-[12px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === t.id ? "text-primary border-primary" : "text-white/40 border-transparent"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="px-4 pt-3 pb-4">
        {activeTab === "ajuster" && (
          <div className="space-y-3">
            {[
              { label: "Luminosité", icon: Sun, val: brightness, set: setBrightness, min: 50, max: 200 },
              { label: "Contraste", icon: Contrast, val: contrast, set: setContrast, min: 50, max: 200 },
              { label: "Saturation", icon: Droplets, val: saturation, set: setSaturation, min: 0, max: 300 },
              { label: "Chaleur", icon: Sun, val: warmth, set: setWarmth, min: -30, max: 30 },
            ].map(({ label, icon: Icon, val, set, min, max }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-white/40 shrink-0" />
                <span className="text-white/60 text-[10px] font-black w-18 shrink-0">{label}</span>
                <input type="range" min={min} max={max} value={val}
                  onChange={e => set(Number(e.target.value))}
                  className="flex-1 accent-primary h-1" />
                <span className="text-primary text-[10px] font-black w-8 text-right">{val}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFlipH(f => !f)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black transition-all ${flipH ? "bg-primary text-white" : "bg-white/10 text-white/60"}`}>
                <FlipHorizontal className="w-3.5 h-3.5" /> Miroir
              </button>
              {[0, 90, 180, 270].map(r => (
                <button key={r} onClick={() => setRotation(r)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${rotation === r ? "bg-primary text-white" : "bg-white/10 text-white/60"}`}>
                  {r}°
                </button>
              ))}
              <button onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); setWarmth(0); setRotation(0); setFlipH(false); }}
                className="px-3 py-2 rounded-xl text-[11px] font-black bg-white/10 text-white/40">
                Reset
              </button>
            </div>
          </div>
        )}

        {activeTab === "filtres" && (
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1">
            {FILTERS.map(f => (
              <button key={String(f.id)} onClick={() => setFilter(f.id)}
                className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95">
                <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 ${filter === f.id ? "border-primary" : "border-transparent"}`}>
                  {image ? (
                    <BeautyImage src={image.localUrl} alt="" className="w-full h-full object-cover" style={{ filter: f.css }} />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                      <ScanLine className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                </div>
                <span className={`text-[9px] font-black uppercase ${filter === f.id ? "text-primary" : "text-white/50"}`}>{f.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === "recadrer" && (
          <div className="space-y-3">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Format du recadrage</p>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {CROPS.map(c => (
                <button key={c.id} onClick={() => setCrop(c.id)}
                  className={`flex flex-col items-center gap-1.5 shrink-0 px-4 py-3 rounded-2xl transition-all active:scale-95 ${crop === c.id ? "bg-primary text-white" : "bg-white/10 text-white/60"}`}>
                  <span className="text-[20px]">{c.icon}</span>
                  <span className="text-[10px] font-black">{c.label}</span>
                </button>
              ))}
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-white/40 text-[11px] font-medium">Format sélectionné : <span className="text-primary font-black">{crop}</span></p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0d0d1a]" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }} />
    </div>
  );
}
