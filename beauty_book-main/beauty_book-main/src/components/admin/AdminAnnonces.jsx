import { useState, useEffect, useRef, useCallback } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { Trash2, Plus, Eye, EyeOff, Upload, Loader2, Film, Link, Pencil, X } from "lucide-react";

const EMPTY_FORM = {
  title: "", sponsor_name: "", image_url: "", video_url: "",
  cta_label: "En savoir plus", cta_url: "",
  pages: ["reels"], status: "actif", start_date: "", end_date: "",
};

function extractVideoThumb(src) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.src = src;
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.preload = "metadata";
    v.currentTime = 0.1;
    v.onloadeddata = () => {
      v.currentTime = 0.5;
    };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = v.videoWidth || 320;
        c.height = v.videoHeight || 180;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.6));
      } catch { resolve(null); }
    };
    v.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 5000);
  });
}

function VideoThumb({ src, className, iconClassName }) {
  const [thumb, setThumb] = useState(null);
  useEffect(() => {
    if (!src) return;
    extractVideoThumb(src).then(t => { if (t) setThumb(t); });
  }, [src]);
  return (
    <div className={`relative ${className || ""}`}>
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <Film className={iconClassName || "w-5 h-5 text-white"} />
      </div>
    </div>
  );
}

export default function AdminAnnonces() {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [mediaMode, setMediaMode] = useState("upload");
  const mediaInputRef = useRef(null);

  const PAGES_OPTIONS = [
    { value: "reels", label: "Réels" },
    { value: "styles", label: "Styles" },
    { value: "services", label: "Services" },
    { value: "explorer", label: "Explorer" },
    { value: "social", label: "Social" },
  ];

  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    adminApi.listAnnonces().then(setAnnonces).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isVideoUrl = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") || url.includes("video"));

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setCreating(false);
    setUploadError("");
    setMediaMode("upload");
  };

  const startEdit = (a) => {
    setForm({
      title: a.title || "",
      sponsor_name: a.sponsor_name || "",
      image_url: a.image_url || "",
      video_url: a.video_url || "",
      cta_label: a.cta_label || "En savoir plus",
      cta_url: a.cta_url || "",
      pages: a.pages || [a.type || "reels"],
      status: a.status || "actif",
      start_date: a.start_date || "",
      end_date: a.end_date || "",
    });
    setEditingId(a.id);
    setCreating(true);
    setUploadError("");
    setMediaMode("url");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadMedia = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingMedia(true);
    setUploadError("");
    try {
      const { file_url } = await uploadFile({ file });
      if (isVideoUrl(file.name) || file.type?.startsWith("video/")) {
        setForm(f => ({ ...f, video_url: file_url, image_url: f.image_url || "" }));
      } else {
        setForm(f => ({ ...f, image_url: file_url }));
      }
    } catch (err) {
      console.error('[AdminAnnonces] Upload error:', err);
      setUploadError("Upload échoué — collez un lien URL en alternative");
      setMediaMode("url");
    }
    setUploadingMedia(false);
    e.target.value = "";
  };

  const toggleStatus = async (a) => {
    try {
      const updated = await adminApi.toggleAnnonceStatus(a.id);
      setAnnonces(prev => prev.map(x => x.id === a.id ? { ...x, status: updated.status } : x));
    } catch {}
  };

  const deleteAnnonce = async (id) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    try { await adminApi.deleteAnnonce(id); } catch {}
    setAnnonces(prev => prev.filter(a => a.id !== id));
  };

  const submitAnnonce = async (e) => {
    e.preventDefault();
    if (!form.title || !form.sponsor_name || (!form.image_url && !form.video_url)) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await adminApi.updateAnnonce(editingId, form);
        setAnnonces(prev => prev.map(a => a.id === editingId ? { ...a, ...updated } : a));
      } else {
        const created = await adminApi.createAnnonce(form);
        setAnnonces(prev => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      console.error('[AdminAnnonces] Save error:', err);
    }
    setSaving(false);
  };

  const getMediaPreview = (a) => {
    if (a.video_url) return <VideoThumb src={a.video_url} className="w-full h-full" />;
    if (a.image_url) return <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />;
    return <div className="w-full h-full flex items-center justify-center text-[20px]">📢</div>;
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {!creating && (
        <button onClick={() => { setCreating(true); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">
          <Plus className="w-4 h-4" /> Nouvelle annonce
        </button>
      )}

      {creating && (
        <form onSubmit={submitAnnonce} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-900 text-[14px] font-black">{editingId ? "Modifier l'annonce" : "Créer une annonce"}</h3>
            <button type="button" onClick={resetForm} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titre *" required
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <input value={form.sponsor_name} onChange={e => setForm(f => ({ ...f, sponsor_name: e.target.value }))}
            placeholder="Nom du sponsor *" required
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          {/* Media selector */}
          <div>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setMediaMode("upload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mediaMode === "upload" ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                <Upload className="w-3 h-3" /> Upload
              </button>
              <button type="button" onClick={() => setMediaMode("url")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mediaMode === "url" ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                <Link className="w-3 h-3" /> URL
              </button>
            </div>

            {mediaMode === "upload" ? (
              <>
                <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadMedia} />
                {(form.image_url || form.video_url) ? (
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                    {form.video_url ? (
                      <VideoThumb src={form.video_url} className="w-12 h-12 rounded-lg shrink-0" iconClassName="w-4 h-4 text-white" />
                    ) : (
                      <img src={form.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <span className="text-green-600 text-[12px] flex-1">✓ {form.video_url ? "Vidéo" : "Image"} uploadée</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "", video_url: "" }))} className="text-gray-400 text-[11px]">Changer</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => mediaInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-4 text-gray-400 text-[13px] hover:border-primary transition-all">
                    {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingMedia ? "Upload..." : "Image ou Vidéo *"}
                  </button>
                )}
                {uploadError && <p className="text-red-500 text-[11px] mt-1">{uploadError}</p>}
              </>
            ) : (
              <div className="space-y-2">
                <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="URL image (https://...)"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
                <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                  placeholder="URL vidéo (https://...mp4)"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
              </div>
            )}
          </div>

          {/* Preview */}
          {(form.image_url || form.video_url) && (
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
              {form.video_url ? (
                <video src={form.video_url} poster={form.image_url} className="w-full object-cover" style={{ maxHeight: "280px" }}
                  controls muted preload="metadata" />
              ) : form.image_url ? (
                <img src={form.image_url} alt="Preview" className="w-full object-cover" style={{ maxHeight: "280px" }} />
              ) : null}
            </div>
          )}

          <div>
            <label className="text-gray-700 text-[12px] font-black mb-2 block">Afficher sur *</label>
            <div className="flex flex-wrap gap-2">
              {PAGES_OPTIONS.map(opt => {
                const selected = form.pages.includes(opt.value);
                return (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      pages: selected ? f.pages.filter(p => p !== opt.value) : [...f.pages, opt.value]
                    }))}
                    className={`px-3 py-2 rounded-xl text-[12px] font-black border transition-all ${selected ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-gray-600 text-[11px] font-bold">
              Début de diffusion
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="mt-1 w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-primary" />
            </label>
            <label className="text-gray-600 text-[11px] font-bold">
              Fin de diffusion
              <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="mt-1 w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-primary" />
            </label>
          </div>

          <input value={form.cta_label} onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))}
            placeholder="Texte du bouton CTA"
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <input value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))}
            placeholder="Lien CTA (ex: https://...)"
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {editingId ? "Modification..." : "Création..."}</> : editingId ? "Modifier →" : "Créer →"}
            </button>
            <button type="button" onClick={resetForm}
              className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}

      <p className="text-gray-500 text-[12px]">{annonces.length} annonce(s)</p>
      <div className="space-y-3">
        {annonces.map(a => (
          <div key={a.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {getMediaPreview(a)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-[13px] font-black truncate">{a.title}</p>
              <p className="text-gray-500 text-[11px]">{a.sponsor_name} · {(a.pages || [a.type || "reels"]).join(", ")}</p>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${a.status === "actif" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                {a.status === "actif" ? "Actif" : "Pausé"}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => startEdit(a)} className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center active:scale-95" title="Modifier">
                <Pencil className="w-4 h-4 text-blue-500" />
              </button>
              <button onClick={() => toggleStatus(a)} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95">
                {a.status === "actif" ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-green-500" />}
              </button>
              <button onClick={() => deleteAnnonce(a.id)} className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-95">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {annonces.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucune annonce.</p>}
      </div>
    </div>
  );
}
