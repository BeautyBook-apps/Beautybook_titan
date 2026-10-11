import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';
import { adminApi } from "@/lib/adminApiClient";
import { entities } from "@/api/entities";
import { supabase } from '@/api/supabaseClient';
import { Plus, Trash2, Eye, EyeOff, Upload, X, Image, Video, Loader2, Pencil } from "lucide-react";

const CATEGORIES = ["Réels", "Tutos", "Conseils"];
const PUBLICATION_DRAFT_KEY = "bb_admin_publication_draft";
const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Réels",
  video_url: "",
  thumbnail_url: "",
  images: [],
  sound: "Son original - BeautyBook",
  author_name: "BeautyBook",
  author_handle: "@beautybook",
};

export default function AdminPublications() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("Tous");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const videoInputRef = useRef(null);
  const imagesInputRef = useRef(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [draftId, setDraftId] = useState(null);
  const draftTimer = useRef(null);

  useEffect(() => {
    adminApi.listPublications()
      .then(res => setReels(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const hasDraftContent = (value) => Boolean(value.title || value.description || value.video_url || value.images?.length);

  const saveDraft = async (value) => {
    if (!creating || !hasDraftContent(value)) return;
    try {
      localStorage.setItem(PUBLICATION_DRAFT_KEY, JSON.stringify(value));
      const payload = {
        ...value,
        title: value.title || "Brouillon de publication",
        author_email: "borisnana955@gmail.com",
        status: "brouillon",
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
      };
      if (draftId) await entities.Reel.update(draftId, payload);
      else {
        const created = await entities.Reel.create(payload);
        const item = created?.id ? created : created?.data?.reel || created?.result;
        if (item?.id) setDraftId(item.id);
      }
    } catch (error) {
      console.warn("[AdminPublications] brouillon non synchronisé", error);
    }
  };

  useEffect(() => {
    if (!creating || !hasDraftContent(form)) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveDraft(form), 700);
    return () => clearTimeout(draftTimer.current);
  }, [form, creating, draftId]);

  const filtered = reels.filter(r =>
    activeTab === "Tous" || r.category === activeTab
  );

  const uploadVideo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, video_url: file_url }));
    } catch (err) { console.error('[AdminPublications] Upload video error:', err); }
    setUploadingVideo(false);
    e.target.value = "";
  };

  const uploadImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingImages(true);
    try {
      const urls = await Promise.all(files.map(f => uploadFile({ file: f }).then(r => r.file_url)));
      setForm(f => ({ ...f, images: [...f.images, ...urls], thumbnail_url: f.thumbnail_url || urls[0] || "" }));
    } catch (err) { console.error('[AdminPublications] Upload images error:', err); }
    setUploadingImages(false);
    e.target.value = "";
  };

  const removeImage = (idx) => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      const data = {
        title: form.title,
        description: form.description,
        category: form.category,
        video_url: form.video_url,
        thumbnail_url: form.thumbnail_url,
        images: form.images,
        author_email: "borisnana955@gmail.com",
        author_name: form.author_name,
        author_handle: form.author_handle,
        status: "publie",
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
      };
      const res = draftId ? await entities.Reel.update(draftId, data) : await entities.Reel.create(data);
      const created = res?.id ? res : res?.data?.reel || res?.result;
      setReels(prev => draftId ? prev.map(item => item.id === draftId ? created : item) : [created, ...prev]);
      setCreating(false);
      setDraftId(null);
      setForm({ ...EMPTY_FORM });
      clearTimeout(draftTimer.current);
      localStorage.removeItem(PUBLICATION_DRAFT_KEY);
    } catch {}
    setSaving(false);
  };

  const toggleStatus = async (reel) => {
    const newStatus = reel.status === "publie" ? "brouillon" : "publie";
    await entities.Reel.update(reel.id, { status: newStatus });
    setReels(prev => prev.map(r => r.id === reel.id ? { ...r, status: newStatus } : r));
  };

  const deleteReel = async (id) => {
    if (!confirm("Supprimer cette publication ?")) return;
    await adminApi.deletePublication(id);
    setReels(prev => prev.filter(r => r.id !== id));
  };

  const editReel = (reel) => {
    setDraftId(reel.status === "brouillon" ? reel.id : null);
    setForm({ ...EMPTY_FORM, ...reel, images: Array.isArray(reel.images) ? reel.images : [] });
    setCreating(true);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {["Tous", ...CATEGORIES].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-2 rounded-xl text-[12px] font-black whitespace-nowrap transition-all ${activeTab === t ? "bg-primary text-white" : "bg-gray-800 text-gray-400 border border-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setCreating(v => !v)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-[13px] font-black active:scale-95 transition-all">
          <Plus className="w-4 h-4" /> Nouvelle publication
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
          <h3 className="text-white text-[15px] font-black">Créer une publication</h3>

          {/* Title */}
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titre de la publication *" required
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          {/* Description */}
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description..." rows={2}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none" />

          {/* Category */}
          <div className="flex gap-2">
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, category: c }))}
                className={`flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all ${form.category === c ? "bg-primary text-white" : "bg-gray-700 text-gray-400"}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Video upload */}
          <div>
            <p className="text-gray-400 text-[11px] font-black uppercase tracking-widest mb-2">Vidéo (optionnel)</p>
            {form.video_url ? (
              <div className="flex items-center gap-3 bg-gray-700 rounded-xl p-3">
                <Video className="w-5 h-5 text-green-400 shrink-0" />
                <span className="text-green-400 text-[12px] font-medium flex-1 truncate">Vidéo uploadée ✓</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, video_url: "" }))} className="text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => videoInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 border border-dashed border-gray-500 rounded-xl py-4 text-gray-400 text-[13px] hover:border-primary transition-all active:scale-[0.99]">
                {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingVideo ? "Upload en cours..." : "Choisir une vidéo"}
              </button>
            )}
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={uploadVideo} />
          </div>

          {/* Images upload (slider) */}
          <div>
            <p className="text-gray-400 text-[11px] font-black uppercase tracking-widest mb-2">Images / Slider (optionnel)</p>
            <div className="flex gap-2 flex-wrap">
              {form.images.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => imagesInputRef.current?.click()}
                className="w-16 h-16 flex items-center justify-center bg-gray-700 border border-dashed border-gray-500 rounded-xl text-gray-400 hover:border-primary transition-all">
                {uploadingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>
            <input ref={imagesInputRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} />
          </div>

          {/* Sound */}
          <input value={form.sound} onChange={e => setForm(f => ({ ...f, sound: e.target.value }))}
            placeholder="Nom du son"
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Publication...</> : "Publier →"}
            </button>
            <button type="button" onClick={() => setCreating(false)}
              className="flex-1 bg-gray-700 text-gray-300 py-3 rounded-xl text-[13px] font-black">
              Annuler
            </button>
          </div>
        </form>
      )}

      <p className="text-gray-500 text-[12px]">{filtered.length} publication(s)</p>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(reel => (
          <div key={reel.id} className="bg-gray-800 rounded-2xl p-4 border border-gray-700 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-700">
              {reel.thumbnail_url || (reel.images && reel.images[0]) ? (
                <img src={reel.thumbnail_url || reel.images[0]} alt={reel.title} className="w-full h-full object-cover" />
              ) : reel.video_url ? (
                <div className="w-full h-full flex items-center justify-center"><Video className="w-5 h-5 text-gray-500" /></div>
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Image className="w-5 h-5 text-gray-500" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-black truncate">{reel.title}</p>
              <p className="text-gray-400 text-[11px]">{reel.category} · {reel.author_name}</p>
              <div className="flex items-center gap-2 mt-1">
                {reel.video_url && <span className="text-[10px] bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded-full font-black">Vidéo</span>}
                {reel.images?.length > 0 && <span className="text-[10px] bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded-full font-black">{reel.images.length} image(s)</span>}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reel.status === "publie" ? "bg-green-900/60 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                  {reel.status === "publie" ? "Publié" : "Brouillon"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => editReel(reel)} className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center active:scale-95 transition-all" title="Modifier">
                <Pencil className="w-4 h-4 text-blue-400" />
              </button>
              <button onClick={() => toggleStatus(reel)} className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                {reel.status === "publie" ? <EyeOff className="w-4 h-4 text-yellow-400" /> : <Eye className="w-4 h-4 text-green-400" />}
              </button>
              <button onClick={() => deleteReel(reel.id)} className="w-9 h-9 bg-red-900/40 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-500 text-center py-10 text-[13px]">Aucune publication.</p>}
      </div>
    </div>
  );
}
