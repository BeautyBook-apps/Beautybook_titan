import { useState, useEffect, useRef } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { Trash2, Plus, Eye, EyeOff, Upload, Loader2 } from "lucide-react";

export default function AdminAnnonces() {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef(null);

  const [form, setForm] = useState({
    title: "", sponsor_name: "", image_url: "",
    cta_label: "En savoir plus", cta_url: "",
    type: "feed", status: "actif",
  });

  useEffect(() => {
    adminApi.listAnnonces().then(setAnnonces).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const uploadImg = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
    } catch (err) { console.error('[AdminAnnonces] Upload error:', err); }
    setUploadingImg(false);
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

  const createAnnonce = async (e) => {
    e.preventDefault();
    if (!form.title || !form.sponsor_name || !form.image_url) return;
    setSaving(true);
    try {
      // Keep the local-admin payload compatible with the deployed Annonce schema.
      // cta_url is stored in target_url; cta_label is a presentation default.
      const created = await adminApi.createAnnonce({
        title: form.title,
        sponsor_name: form.sponsor_name,
        image_url: form.image_url,
        type: form.type,
        status: form.status,
        target_url: form.cta_url || null,
      });
      setAnnonces(prev => [created, ...prev]);
      setCreating(false);
      setForm({ title: "", sponsor_name: "", image_url: "", cta_label: "En savoir plus", cta_url: "", type: "feed", status: "actif" });
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <button onClick={() => setCreating(v => !v)}
        className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">
        <Plus className="w-4 h-4" /> Nouvelle annonce
      </button>

      {creating && (
        <form onSubmit={createAnnonce} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3 shadow-sm">
          <h3 className="text-gray-900 text-[14px] font-black">Créer une annonce</h3>

          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titre *" required
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <input value={form.sponsor_name} onChange={e => setForm(f => ({ ...f, sponsor_name: e.target.value }))}
            placeholder="Nom du sponsor *" required
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <div>
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={uploadImg} />
            {form.image_url ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <img src={form.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <span className="text-green-600 text-[12px] flex-1">✓ Image uploadée</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="text-gray-400 text-[11px]">Changer</button>
              </div>
            ) : (
              <button type="button" onClick={() => imgInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-4 text-gray-400 text-[13px] hover:border-primary transition-all">
                {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingImg ? "Upload..." : "Choisir une image *"}
              </button>
            )}
          </div>

          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none">
            <option value="feed">Feed Réels</option>
            <option value="story">Story</option>
            <option value="banner">Bannière Services</option>
          </select>

          <input value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))}
            placeholder="Lien CTA (ex: https://...)"
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</> : "Créer →"}
            </button>
            <button type="button" onClick={() => setCreating(false)}
              className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}

      <p className="text-gray-500 text-[12px]">{annonces.length} annonce(s)</p>
      <div className="space-y-3">
        {annonces.map(a => (
          <div key={a.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {a.image_url ? <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[20px]">📢</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-[13px] font-black truncate">{a.title}</p>
              <p className="text-gray-500 text-[11px]">{a.sponsor_name} · {a.type}</p>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${a.status === "actif" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                {a.status === "actif" ? "Actif" : "Pausé"}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
