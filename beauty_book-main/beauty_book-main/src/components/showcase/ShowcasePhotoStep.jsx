import { useState, useRef, useEffect } from "react";
import { Camera, ImagePlus, GripVertical, Trash2, Pencil, Check, X, ArrowRight, Loader2 } from "lucide-react";
import { uploadFile } from "@/api/entities";
import { addShowcasePhotos, showcaseTargetFromRdv } from "@/lib/showcase";

// ── Étape « Photos de la prestation » ─────────────────────────────────
// Affichée après validation du code client. Le pro peut :
//  - prendre des photos (appareil photo) ou importer depuis la galerie
//  - déplacer les photos en glissant (poignée, tactile OK)
//  - supprimer / modifier (légende + remplacer) / sélectionner
// « Suivant » publie les photos sélectionnées dans « Prestations réalisées ».
export default function ShowcasePhotoStep({ rdv = {}, onDone, onSkip }) {
  const [photos, setPhotos] = useState([]); // {id, file, preview, caption, selected}
  const [dragId, setDragId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [replaceId, setReplaceId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const cardEls = useRef({});
  const dragState = useRef(null);
  const cameraInput = useRef(null);
  const importInput = useRef(null);
  const replaceInput = useRef(null);

  useEffect(() => () => { photos.forEach(p => p.preview && URL.revokeObjectURL(p.preview)); }, []);

  const addFiles = (files, targetId = null) => {
    const arr = Array.from(files || []).filter(f => f.type && f.type.startsWith("image/"));
    if (arr.length === 0) return;
    if (targetId) {
      // Remplacement d'une photo existante (garde légende + sélection)
      const f = arr[0];
      const preview = URL.createObjectURL(f);
      setPhotos(prev => prev.map(p => {
        if (p.id !== targetId) return p;
        if (p.preview) URL.revokeObjectURL(p.preview);
        return { ...p, file: f, preview };
      }));
      setReplaceId(null);
      return;
    }
    const mapped = arr.map(f => ({
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      preview: URL.createObjectURL(f),
      caption: "",
      selected: true,
    }));
    setPhotos(prev => [...prev, ...mapped]);
  };

  const removePhoto = (id) => {
    setPhotos(prev => {
      const p = prev.find(x => x.id === id);
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return prev.filter(x => x.id !== id);
    });
  };

  const toggleSelect = (id) => {
    if (dragState.current) return;
    setPhotos(prev => prev.map(p => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  const toggleSelectAll = () => {
    const allSelected = photos.length > 0 && photos.every(p => p.selected);
    setPhotos(prev => prev.map(p => ({ ...p, selected: !allSelected })));
  };

  const startCaptionEdit = (p) => {
    setEditingId(p.id);
    setCaptionDraft(p.caption || "");
  };
  const saveCaption = () => {
    setPhotos(prev => prev.map(p => (p.id === editingId ? { ...p, caption: captionDraft.trim() } : p)));
    setEditingId(null);
    setCaptionDraft("");
  };

  // ── Glisser-déplacer (Pointer Events : tactile + souris) ──
  const startDrag = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = { id };
    setDragId(id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const onMove = (ev) => {
      const st = dragState.current;
      if (!st) return;
      let targetId = null;
      for (const [pid, el] of Object.entries(cardEls.current)) {
        if (!el || pid === st.id) continue;
        const r = el.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          targetId = pid;
          break;
        }
      }
      if (targetId) {
        setPhotos(prev => {
          const from = prev.findIndex(p => p.id === st.id);
          const to = prev.findIndex(p => p.id === targetId);
          if (from < 0 || to < 0 || from === to) return prev;
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        });
      }
    };
    const onUp = () => {
      dragState.current = null;
      setDragId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const selectedCount = photos.filter(p => p.selected).length;

  const handleNext = async () => {
    const selected = photos.filter(p => p.selected);
    if (selected.length === 0) { onDone?.([]); return; }
    setUploading(true);
    try {
      const uploaded = [];
      for (let i = 0; i < selected.length; i++) {
        setProgress(`Envoi ${i + 1} / ${selected.length}…`);
        const res = await uploadFile(selected[i].file, "uploads");
        const url = res?.file_url || res;
        if (!url) throw new Error("URL manquante");
        uploaded.push({ url, caption: selected[i].caption || "" });
      }
      const { serviceId, isBundle } = showcaseTargetFromRdv(rdv);
      if (!serviceId) throw new Error("Service introuvable");
      setProgress("Publication…");
      await addShowcasePhotos({ serviceId, isBundle, proEmail: rdv.pro_email || "", photos: uploaded });
      onDone?.(uploaded);
    } catch (err) {
      alert(`Échec de la publication : ${err?.message || "réessayez"}`);
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-white flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[22px] font-black text-gray-900">Prestations réalisées</h2>
          <button onClick={onSkip} className="text-[12px] font-black text-gray-400 uppercase tracking-widest active:scale-95">
            Passer
          </button>
        </div>
        <p className="text-[13px] text-gray-400 font-medium leading-snug">
          Montrez votre travail : les photos sélectionnées apparaîtront sur la page du service, juste au-dessus des avis.
        </p>
      </div>

      {/* Boutons capture / import */}
      <div className="px-5 shrink-0 grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => cameraInput.current?.click()}
          className="flex items-center justify-center gap-2 bg-primary text-white rounded-2xl py-3.5 font-black text-[13px] uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-95 transition-all">
          <Camera className="w-5 h-5" /> Photo
        </button>
        <button onClick={() => importInput.current?.click()}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white rounded-2xl py-3.5 font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all">
          <ImagePlus className="w-5 h-5" /> Importer
        </button>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={importInput} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={replaceInput} type="file" accept="image/*" className="hidden"
          onChange={e => { addFiles(e.target.files, replaceId); e.target.value = ""; }} />
      </div>

      {/* Tout sélectionner */}
      {photos.length > 0 && (
        <div className="px-5 shrink-0 mb-3 flex items-center justify-between">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
            {photos.length} photo{photos.length > 1 ? "s" : ""} · {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
          </p>
          <button onClick={toggleSelectAll} className="text-[11px] font-black text-primary uppercase tracking-widest active:scale-95">
            {photos.every(p => p.selected) ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>
      )}

      {/* Grille */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {photos.length === 0 ? (
          <div className="h-full min-h-[240px] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <p className="text-[14px] font-black text-gray-700">Aucune photo pour l'instant</p>
            <p className="text-[12px] text-gray-400 font-medium leading-relaxed">
              Prenez des photos de la prestation réalisée ou importez-les depuis votre galerie.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((p) => (
              <div key={p.id}
                ref={el => { if (el) cardEls.current[p.id] = el; else delete cardEls.current[p.id]; }}
                onClick={() => toggleSelect(p.id)}
                className={`relative rounded-2xl overflow-hidden bg-gray-100 border-2 transition-all ${
                  dragId === p.id ? "scale-105 shadow-2xl z-10 opacity-90" : ""
                } ${p.selected ? "border-primary" : "border-transparent opacity-70"}`}>
                <img src={p.preview} alt="" className="w-full aspect-square object-cover pointer-events-none select-none" draggable={false} />

                {/* Badge sélection */}
                <div className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  p.selected ? "bg-primary" : "bg-black/40 border-2 border-white/70"}`}>
                  {p.selected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </div>

                {/* Poignée de déplacement */}
                <button
                  onPointerDown={e => startDrag(e, p.id)}
                  onClick={e => e.stopPropagation()}
                  aria-label="Déplacer la photo"
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90"
                  style={{ touchAction: "none" }}>
                  <GripVertical className="w-4 h-4 text-white" />
                </button>

                {/* Supprimer */}
                <button
                  onClick={e => { e.stopPropagation(); removePhoto(p.id); }}
                  aria-label="Supprimer la photo"
                  className="absolute bottom-2 right-2 w-8 h-8 bg-red-500/90 rounded-full flex items-center justify-center active:scale-90">
                  <Trash2 className="w-4 h-4 text-white" />
                </button>

                {/* Modifier : légende / remplacer */}
                {editingId === p.id ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <input autoFocus value={captionDraft} onChange={e => setCaptionDraft(e.target.value)} maxLength={80}
                      placeholder="Légende…"
                      className="flex-1 min-w-0 bg-white/10 text-white text-[12px] font-medium rounded-lg px-2 py-1.5 outline-none placeholder:text-white/40" />
                    <button onClick={saveCaption} aria-label="Enregistrer"
                      className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <div className="absolute bottom-2 left-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => startCaptionEdit(p)} aria-label="Ajouter une légende"
                      className="h-8 px-2.5 bg-black/50 backdrop-blur-sm rounded-full flex items-center gap-1 active:scale-90">
                      <Pencil className="w-3.5 h-3.5 text-white" />
                      <span className="text-white text-[10px] font-black uppercase">{p.caption ? "Modifier" : "Légende"}</span>
                    </button>
                    <button onClick={() => { setReplaceId(p.id); replaceInput.current?.click(); }} aria-label="Remplacer la photo"
                      className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90">
                      <ImagePlus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}

                {/* Légende affichée */}
                {p.caption && editingId !== p.id && (
                  <div className="absolute bottom-11 left-2 right-2 pointer-events-none">
                    <p className="text-white text-[10px] font-bold leading-tight line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{p.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-center text-[11px] text-gray-300 font-medium mt-4 px-6">
          Glissez une photo par sa poignée <GripVertical className="w-3 h-3 inline" /> pour changer l'ordre · touchez une photo pour la sélectionner
        </p>
      </div>

      {/* CTA fixe */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-5" style={{ paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <button onClick={handleNext} disabled={uploading}
          className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-primary/40 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70">
          {uploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> {progress || "Envoi…"} </>
          ) : (
            <>Suivant <ArrowRight className="w-5 h-5" /></>
          )}
        </button>
        {selectedCount > 0 && !uploading && (
          <p className="text-center text-[11px] text-gray-400 font-medium mt-2">
            {selectedCount} photo{selectedCount > 1 ? "s" : ""} sera{selectedCount > 1 ? "ont" : ""} publiée
          </p>
        )}
      </div>
    </div>
  );
}
