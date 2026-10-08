import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';
import { adminApi } from "@/lib/adminApiClient";
import { Plus, Trash2, Upload, Loader2, X, Home, Eye, EyeOff, Edit3 } from "lucide-react";

const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary";

const EMPTY_FORM = {
  title: "", description: "", type: "location", price: "",
  unit: "/MOIS", surface: "", location: "", area: "",
  equip: "", extra: "", images: [], video_url: "",
  estimated_turnover: "", estimated_net_revenue: "", virtual_tour_id: "",
  status: "actif",
};

export default function AdminImmobilier() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const imgRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    adminApi.listImmobilier()
      .then(res => setListings(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleFileUpload = async (e, isVideo = false) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await uploadFile({ file });
    if (isVideo) {
      setForm(f => ({ ...f, video_url: file_url }));
    } else {
      setForm(f => ({ ...f, images: [...f.images, file_url] }));
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeImage = (idx) => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const createListing = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price) || 0,
        estimated_turnover: parseFloat(form.estimated_turnover) || 0,
        estimated_net_revenue: parseFloat(form.estimated_net_revenue) || 0,
        virtual_tour_id: form.virtual_tour_id || null,
      };
      delete payload.badge;
      const res = editingId
        ? await adminApi.updateImmobilier(editingId, payload)
        : await adminApi.createImmobilier(payload);
      const item = res?.data?.result || res?.result || res?.data || res;
      setListings(prev => editingId
        ? prev.map(listing => listing.id === editingId ? { ...listing, ...item } : listing)
        : [item, ...prev]);
      setCreating(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    } catch (err) {
      console.error("Erreur création immobilier:", err);
      alert("Erreur lors de la création. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (listing) => {
    const newStatus = listing.status === "actif" ? "loue" : "actif";
    await adminApi.updateImmobilier(listing.id, { status: newStatus });
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l));
  };

  const editListing = (listing) => {
    setEditingId(listing.id);
    setForm({
      ...EMPTY_FORM,
      ...listing,
      price: listing.price ?? "",
      images: Array.isArray(listing.images) ? listing.images : [],
      video_url: listing.video_url || "",
    });
    setCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteListing = async (id) => {
    if (!confirm("Êtes-vous vraiment sûr de vouloir supprimer cette annonce immobilière ? Cette action est définitive.")) return;
    await adminApi.deleteImmobilier(id);
    setListings(prev => prev.filter(l => l.id !== id));
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => setCreating(v => !v)}
        className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">
        <Plus className="w-4 h-4" /> Nouvelle annonce immobilière
      </button>

      {creating && (
        <form onSubmit={createListing} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3 shadow-sm">
          <h3 className="text-gray-900 text-[15px] font-black">{editingId ? "Modifier l'annonce" : "Créer une annonce"}</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Titre *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Fauteuil Luxe Paris 8e" required className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                <option value="location">Location</option>
                <option value="vente">Vente</option>
              </select>
            </div>
          </div>

          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description détaillée" rows={3} className={`${inputCls} resize-none`} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Prix * (€)</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="800" required className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Unité</label>
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="/MOIS" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ville / Arrondissement" className={inputCls} />
            <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Quartier / Zone" className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <input value={form.surface} onChange={e => setForm(f => ({ ...f, surface: e.target.value }))} placeholder="Surface (ex: 18m²)" className={inputCls} />
            <input value={form.equip} onChange={e => setForm(f => ({ ...f, equip: e.target.value }))} placeholder="Équipement (ex: 1 fauteuil)" className={inputCls} />
            <input value={form.extra} onChange={e => setForm(f => ({ ...f, extra: e.target.value }))} placeholder="Extra (ex: Parking)" className={inputCls} />
          </div>

          <div className="bg-emerald-50 rounded-2xl p-4 space-y-3 border border-emerald-100">
            <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Performance estimative</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="0" value={form.estimated_turnover} onChange={e => setForm(f => ({ ...f, estimated_turnover: e.target.value }))} placeholder="CA estimé / mois (€)" className={inputCls} />
              <input type="number" min="0" value={form.estimated_net_revenue} onChange={e => setForm(f => ({ ...f, estimated_net_revenue: e.target.value }))} placeholder="Revenu net / mois (€)" className={inputCls} />
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Photos (plusieurs possibles)</label>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={e => {
              const files = Array.from(e.target.files);
              files.forEach(async (file) => {
                setUploading(true);
                const { file_url } = await uploadFile({ file });
                setForm(f => ({ ...f, images: [...f.images, file_url] }));
                setUploading(false);
              });
              e.target.value = "";
            }} />
            {form.images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {form.images.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => imgRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[13px] hover:border-primary transition-all">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Upload..." : "Ajouter des photos"}
            </button>
          </div>

          {/* Vidéo */}
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Vidéo (optionnel)</label>
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={e => handleFileUpload(e, true)} />
            {form.video_url ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <video src={form.video_url} className="w-16 h-12 rounded-lg object-cover" />
                <span className="text-green-600 text-[12px] flex-1">✓ Vidéo uploadée</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, video_url: "" }))} className="text-red-400 text-[11px]">Supprimer</button>
              </div>
            ) : (
              <button type="button" onClick={() => videoRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[13px] hover:border-primary transition-all">
                <Upload className="w-4 h-4" /> Ajouter une vidéo
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {editingId ? "Enregistrement..." : "Création..."}</> : editingId ? "Enregistrer les modifications" : "Créer →"}
            </button>
            <button type="button" onClick={() => { setCreating(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
              className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}

      <p className="text-gray-500 text-[12px]">{listings.length} bien(s) immobilier(s)</p>

      <div className="space-y-3">
        {listings.map(l => (
          <div key={l.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {l.images?.[0]
                ? <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Home className="w-6 h-6 text-gray-300" /></div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-[13px] font-black truncate">{l.title}</p>
              <p className="text-gray-500 text-[11px]">{l.location} · {l.price}€{l.unit} · {l.type}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${l.status === "actif" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                  {l.status === "actif" ? "Disponible" : l.status === "loue" ? "Loué" : "Vendu"}
                </span>
                {l.images?.length > 1 && <span className="text-[10px] text-gray-400">{l.images.length} photos</span>}
                {l.video_url && <span className="text-[10px] text-blue-500">▶ Vidéo</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => editListing(l)} aria-label="Modifier l'annonce" className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center active:scale-95">
                <Edit3 className="w-4 h-4 text-blue-500" />
              </button>
              <button onClick={() => toggleStatus(l)} aria-label="Changer le statut" className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95">
                {l.status === "actif" ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-green-500" />}
              </button>
              <button onClick={() => deleteListing(l.id)} className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-95">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {listings.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun bien immobilier.</p>}
      </div>
    </div>
  );
}
