import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef, useCallback, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { X, Upload, Loader2, Trash2, HelpCircle, GripVertical, Image, Box, CheckCircle2 } from "lucide-react";
import { entities, uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import PhotoGuide from "@/components/virtualtour/PhotoGuide";

async function uploadImage(file) {
  const { file_url } = await uploadFile({ file });
  return file_url;
}

const isHdrFile = (file) => /\.(hdr|hdri|exr)$/i.test(file?.name || '') || ['image/vnd.radiance', 'image/x-hdr', 'image/exr', 'image/x-exr'].includes(file?.type);
const isHdrScene = (scene) => Boolean(scene?.hdr_url || scene?.hdri_url || scene?.asset_type === 'hdr');

// ── Progress indicator pour multi-upload ──
function UploadProgress({ current, total, fileName }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="flex items-center gap-3 bg-black/60 rounded-xl px-3 py-2">
      <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-white truncate">{fileName}</p>
        <div className="w-full h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[10px] font-black text-white/60 shrink-0">{current}/{total}</span>
    </div>
  );
}

export default function SceneEditor({ visite, theme = "dark", onSave, onClose }) {
  const isLight = theme === "light";
  const [scenes, setScenes] = useState(
    (visite.scenes || []).map((s, i) => ({
      ...s,
      _id: s._id || `scene_${Date.now()}_${i}`,
    }))
  );
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState({ current: 0, total: 0, fileName: "" });
  const [showGuide, setShowGuide] = useState(false);
  const [showFloorPlanPicker, setShowFloorPlanPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  // ── Classes thématiques ──
  const sheetBg = isLight ? "bg-white" : "bg-[#0d0d0d]";
  const sheetBorder = isLight ? "border-gray-200" : "border-gray-800";
  const handleBg = isLight ? "bg-gray-300" : "bg-gray-700";
  const headingColor = isLight ? "text-gray-900" : "text-white";
  const subColor = isLight ? "text-gray-400" : "text-gray-500";
  const closeBtnBg = isLight ? "bg-gray-100" : "bg-gray-800";
  const closeIconColor = isLight ? "text-gray-500" : "text-gray-400";
  const sceneCardBg = isLight ? "bg-gray-50" : "bg-[#1a1a1a]";
  const sceneCardBorder = isLight ? "border-gray-200" : "border-gray-800";
  const inputBg = isLight ? "bg-transparent text-gray-900" : "bg-transparent text-white";
  const inputPlaceholder = isLight ? "placeholder:text-gray-400" : "placeholder:text-gray-600";
  const deleteBg = isLight ? "bg-red-50" : "bg-red-500/10";
  const deleteIcon = isLight ? "text-red-500" : "text-red-400";
  const dashedBorder = isLight ? "border-gray-300" : "border-gray-700";
  const dashedBg = isLight ? "bg-gray-50" : "bg-transparent";
  const dashedText = isLight ? "text-gray-400" : "text-gray-500";
  const addIconBg = isLight ? "bg-white" : "bg-[#1a1a1a]";
  const addIconColor = isLight ? "text-gray-400" : "text-gray-500";
  const warningBg = isLight ? "bg-amber-50 border-amber-200" : "bg-amber-500/10 border-amber-500/20";
  const warningTitle = isLight ? "text-amber-700" : "text-amber-300";
  const warningText = isLight ? "text-amber-500" : "text-amber-400/60";
  const warningIconBg = isLight ? "bg-amber-100" : "bg-amber-500/20";
  const warningIcon = isLight ? "text-amber-600" : "text-amber-400";
  const saveBtn = isLight
    ? "bg-gray-900 text-white"
    : "bg-primary text-white shadow-lg shadow-primary/20";
  const dragHandleColor = isLight ? "text-gray-400" : "text-gray-600";

  // ── Multi-upload ──
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadQueue({ current: 0, total: files.length, fileName: files[0].name });

    const newScenes = [];
    for (let i = 0; i < files.length; i++) {
      setUploadQueue({ current: i + 1, total: files.length, fileName: files[i].name });
      try {
        const url = await uploadImage(files[i]);
        const hdr = isHdrFile(files[i]);
        const format = files[i].name?.split('.').pop()?.toLowerCase();
        newScenes.push({
          _id: `scene_${Date.now()}_${newScenes.length}`,
          title: `Scène ${scenes.length + newScenes.length + 1}`,
          ...(hdr ? {
            hdr_url: url,
            asset_type: "hdr",
            format: format === "exr" ? "exr" : format === "hdri" ? "hdri" : "hdr",
            source_name: files[i].name,
            projection: "equirectangular",
          } : {
            image_url: url,
            asset_type: "image",
          }),
          floor_x: 50,
          floor_y: 50,
          hotspots: [],
        });
      } catch (err) {
        console.error("Upload failed for", files[i].name, err);
      }
    }

    setScenes(prev => {
      const combined = [...prev, ...newScenes];
      // Re-number all scenes
      return combined.map((s, idx) => ({ ...s, title: `Scène ${idx + 1}` }));
    });
    setUploading(false);
    setUploadQueue({ current: 0, total: 0, fileName: "" });

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Upload floorplan ──
  const handleFloorPlanUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowFloorPlanPicker(false);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setScenes(prev => prev.map(s => ({ ...s, _floorplan_url: url })));
    } catch (err) {
      console.error("Floorplan upload failed", err);
    }
    setUploading(false);
  };

  // ── Drag & drop handler ──
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(scenes);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    // Re-number
    setScenes(items.map((s, idx) => ({ ...s, title: `Scène ${idx + 1}` })));
  };

  const removeScene = (sceneId) => {
    setScenes(prev => {
      const filtered = prev.filter(s => s._id !== sceneId);
      return filtered.map((s, idx) => ({ ...s, title: `Scène ${idx + 1}` }));
    });
  };

  const updateTitle = (sceneId, title) => {
    setScenes(prev => prev.map(s => s._id === sceneId ? { ...s, title } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    const cleanScenes = scenes.map(({ _id, _floorplan_url, ...rest }) => rest);
    const updateData = { scenes: cleanScenes };
    const updated = await entities.VisiteVirtuelle.update(visite.id, updateData);
    onSave(updated);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${sheetBg} w-full rounded-t-3xl px-5 pt-4 pb-8 z-10 max-h-[90vh] overflow-y-auto border-t ${sheetBorder}`}>
        <div className={`w-10 h-1 ${handleBg} rounded-full mx-auto mb-4`} />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className={`text-[20px] font-black ${headingColor}`}>Scènes ({scenes.length})</h2>
            <button
              onClick={() => setShowGuide(true)}
              className="w-8 h-8 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20 active:scale-95"
              title="Guide photo 360°"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
          <button onClick={onClose} className={`w-8 h-8 ${closeBtnBg} rounded-lg flex items-center justify-center`}>
            <X className={`w-4 h-4 ${closeIconColor}`} />
          </button>
        </div>

        <p className={`text-[12px] ${subColor} font-medium mb-4`}>
          Ajoutez des panoramas 360° de chaque pièce. Les fichiers JPG/PNG, HDR/HDRI et EXR équirectangulaires (ratio 2:1) sont pris en charge.
        </p>

        {/* Upload progress */}
        {uploading && uploadQueue.total > 1 && (
          <div className="mb-4">
            <UploadProgress current={uploadQueue.current} total={uploadQueue.total} fileName={uploadQueue.fileName} />
          </div>
        )}

        {/* Drag & Drop scene list */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="scenes">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 mb-4">
                {scenes.map((scene, index) => (
                  <Draggable key={scene._id} draggableId={scene._id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`${sceneCardBg} rounded-2xl p-3 flex items-center gap-3 border ${sceneCardBorder} transition-all ${
                          snapshot.isDragging ? "shadow-2xl scale-[1.02] z-50 ring-2 ring-primary/30" : ""
                        }`}
                      >
                        {/* Drag handle */}
                        <div {...provided.dragHandleProps} className="shrink-0 cursor-grab active:cursor-grabbing touch-none">
                          <GripVertical className={`w-5 h-5 ${dragHandleColor}`} />
                        </div>

                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-800 shrink-0 relative">
                          {isHdrScene(scene) ? (
                            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-cyan-950 to-blue-900 flex flex-col items-center justify-center gap-1">
                              <Box className="w-6 h-6 text-cyan-300" />
                              <span className="text-[8px] font-black text-cyan-100 tracking-wider">HDR 360°</span>
                            </div>
                          ) : (
                            <BeautyImage src={scene.image_url} alt={scene.title} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 flex items-center justify-center">
                            <span className="text-[7px] font-black text-white">{isHdrScene(scene) ? "HDR" : "360°"}</span>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <input
                            value={scene.title}
                            onChange={e => updateTitle(scene._id, e.target.value)}
                            className={`w-full text-[14px] font-black outline-none ${inputBg} ${inputPlaceholder}`}
                          />
                          <p className={`text-[10px] ${subColor} font-medium mt-0.5`}>
                            {(scene.hotspots?.length || 0)} points de navigation
                          </p>
                        </div>

                        {/* Scene number badge */}
                        <div className={`shrink-0 w-7 h-7 ${isLight ? "bg-gray-200" : "bg-gray-800"} rounded-full flex items-center justify-center`}>
                          <span className={`text-[10px] font-black ${isLight ? "text-gray-500" : "text-gray-400"}`}>{index + 1}</span>
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => removeScene(scene._id)}
                          className={`w-8 h-8 ${deleteBg} rounded-lg flex items-center justify-center shrink-0 active:scale-95`}
                        >
                          <Trash2 className={`w-4 h-4 ${deleteIcon}`} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Floorplan upload section */}
        <div className="mb-4">
          <button
            onClick={() => setShowFloorPlanPicker(true)}
            className={`w-full ${dashedBg} border border-dashed ${dashedBorder} rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-all`}
          >
            <div className={`w-10 h-10 ${addIconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <Image className={`w-5 h-5 ${addIconColor}`} />
            </div>
            <div className="text-left">
              <p className={`text-[12px] font-black ${headingColor}`}>Ajouter un plan 2D</p>
              <p className={`text-[10px] ${subColor} font-medium`}>Plan de l'établissement pour la navigation (optionnel)</p>
            </div>
          </button>
          {showFloorPlanPicker && (
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={el => el && showFloorPlanPicker && el.click()}
              onChange={handleFloorPlanUpload}
            />
          )}
        </div>

        {/* Add scene button */}
        {!uploading && (
          <button
            onClick={() => fileRef.current?.click()}
            className={`w-full border-2 border-dashed ${dashedBorder} rounded-2xl p-6 flex flex-col items-center gap-2 active:scale-[0.98] transition-all hover:border-primary/50 mb-4`}
          >
            <div className={`w-12 h-12 ${addIconBg} rounded-xl flex items-center justify-center`}>
              <Upload className={`w-5 h-5 ${addIconColor}`} />
            </div>
            <span className={`text-[12px] font-black ${dashedText} uppercase tracking-widest`}>Ajouter des panoramas</span>
            <span className={`text-[10px] ${subColor} font-medium`}>JPG, PNG, HDR, HDRI ou EXR · sélection multiple</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.hdr,.hdri,.exr,image/vnd.radiance,image/x-hdr,image/exr,image/x-exr,application/octet-stream"
          multiple
          className="hidden"
          onChange={handleFiles}
        />

        {/* Warning minimum 3 */}
        {scenes.length < 3 && (
          <div className={`${warningBg} rounded-2xl p-4 mb-4 flex items-start gap-3`}>
            <div className={`w-8 h-8 ${warningIconBg} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
              <span className={`text-[14px] font-black ${warningIcon}`}>!</span>
            </div>
            <div>
              <p className={`text-[12px] font-black ${warningTitle}`}>Minimum 3 scènes requises</p>
              <p className={`text-[11px] ${warningText} font-medium mt-0.5`}>
                Ajoutez au moins {3 - scenes.length} photo{3 - scenes.length > 1 ? "s" : ""} supplémentaire{3 - scenes.length > 1 ? "s" : ""} pour pouvoir enregistrer la visite.
              </p>
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={scenes.length < 3 || saving}
          className={`w-full ${saveBtn} font-black text-[13px] uppercase tracking-widest py-4 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${
            isLight ? "disabled:bg-gray-300 disabled:text-gray-400" : ""
          }`}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
          ) : scenes.length < 3 ? (
            `${scenes.length}/3 scènes — Minimum 3 requis`
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Enregistrer les scènes</>
          )}
        </button>

        {/* Photo Guide Modal */}
        {showGuide && <PhotoGuide theme={theme} onClose={() => setShowGuide(false)} />}
      </div>
    </div>
  );
}
