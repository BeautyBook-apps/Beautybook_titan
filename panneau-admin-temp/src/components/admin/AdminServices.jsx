import { useState, useEffect, useRef } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { apiClient } from "@/lib/apiClient";
import { uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { Search, Eye, EyeOff, Plus, Upload, Loader2, Trash2, Grid2X2, List, X, Clock3, ExternalLink } from "lucide-react";

const CATEGORIES = ["Coiffure", "Maquillage", "Ongles", "Soin", "Barbe", "Massage", "Épilation"];
const PUBLIC_APP_URL = import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173";

const EMPTY_FORM = { title: "", description: "", category: "Coiffure", price: "", duration_min: 60, image_url: "", pro_email: "", status: "actif" };

function ServiceImage({ service, className }) {
  return service.image_url ? (
    <img src={service.image_url} alt={service.title || ""} className={className} />
  ) : (
    <div className={`${className} bg-primary/10 flex items-center justify-center`} aria-hidden="true">
      <span className="text-primary text-[18px]">✂️</span>
    </div>
  );
}

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [previewService, setPreviewService] = useState(null);
  const imgInputRef = useRef(null);

  useEffect(() => {
    adminApi.listServices().then(setServices).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!previewService) return undefined;
    const closeOnEscape = (event) => event.key === "Escape" && setPreviewService(null);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [previewService]);

  const filtered = services.filter(s =>
    !search || s.title?.toLowerCase().includes(search.toLowerCase()) || s.pro_email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = async (service) => {
    // Optimistic update
    const newStatus = service.status === "actif" ? "inactif" : "actif";
    setServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
    try {
      await adminApi.toggleServiceStatus(service.id);
    } catch {
      // Rollback on error
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, status: service.status } : s));
    }
  };

  const deleteService = async (id) => {
    if (!confirm("Supprimer ce service ?")) return;
    // Optimistic remove
    const backup = services.find(s => s.id === id);
    setServices(prev => prev.filter(s => s.id !== id));
    try {
      await apiClient.callFunction("adminCreateService", { action: "delete", id });
    } catch {
      // Rollback
      if (backup) setServices(prev => [...prev, backup].sort((a, b) => a.id > b.id ? -1 : 1));
    }
  };

  const uploadImg = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
    } catch (err) { console.error('[AdminServices] Upload error:', err); }
    setUploadingImg(false);
  };

  const createService = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price) return;
    setSaving(true);
    try {
      const res = await apiClient.callFunction("adminCreateService", {
        action: "create",
        data: { ...form, price: parseFloat(form.price), duration_min: parseInt(form.duration_min) }
      });
      if (!res.data?.service) throw new Error("Création échouée");
      setServices(prev => [res.data.service, ...prev]);
      setCreating(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      alert("Erreur lors de la création : " + err.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un service..." className="flex-1 bg-transparent text-gray-700 text-[13px] outline-none placeholder:text-gray-400" />
        </div>
        <button onClick={() => setCreating(v => !v)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all shadow-md shadow-primary/20">
          <Plus className="w-4 h-4" /> Nouveau service
        </button>
      </div>

      {creating && (
        <form onSubmit={createService} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4 shadow-sm">
          <h3 className="text-gray-900 text-[15px] font-black">Créer un service</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titre du service *" required
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optionnel)" rows={2}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-[11px] font-black uppercase tracking-wider block mb-1">Prix (€) *</label>
              <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="ex: 45" required
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-gray-500 text-[11px] font-black uppercase tracking-wider block mb-1">Durée (min)</label>
              <input type="number" min="15" step="15" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
            </div>
          </div>

          <input value={form.pro_email} onChange={e => setForm(f => ({ ...f, pro_email: e.target.value }))}
            placeholder="Email du pro (ex: coiffeur@salon.fr)"
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <div>
            <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest mb-2">Image du service</p>
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={uploadImg} />
            {form.image_url ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <img src={form.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <span className="text-green-600 text-[12px] font-medium flex-1">✓ Image uploadée</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="text-gray-400 text-[11px]">Changer</button>
              </div>
            ) : (
              <button type="button" onClick={() => imgInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-4 text-gray-400 text-[13px] hover:border-primary transition-all">
                {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingImg ? "Upload en cours..." : "Choisir une image"}
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</> : "Publier le service →"}
            </button>
            <button type="button" onClick={() => { setCreating(false); setForm(EMPTY_FORM); }}
              className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-500 text-[12px]">{filtered.length} service(s)</p>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm" role="group" aria-label="Mode d’affichage">
          <button type="button" onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"} title="Affichage en liste"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold transition ${viewMode === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <List className="w-4 h-4" /> Liste
          </button>
          <button type="button" onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"} title="Affichage en grille"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold transition ${viewMode === "grid" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <Grid2X2 className="w-4 h-4" /> Grille
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="space-y-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
              <ServiceImage service={s} className="w-12 h-12 rounded-xl object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[13px] font-black truncate">{s.title}</p>
                <p className="text-gray-500 text-[11px]">{s.category} · {s.pro_email}</p>
                <p className="text-primary text-[12px] font-black">{s.price}€ · {s.duration_min} min</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${s.status === "actif" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                  {s.status === "actif" ? "Actif" : "Inactif"}
                </span>
                <button onClick={() => setPreviewService(s)} aria-label={`Prévisualiser ${s.title}`} title="Prévisualiser" className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center active:scale-95">
                  <Eye className="w-4 h-4 text-blue-500" />
                </button>
                <button onClick={() => toggleStatus(s)} aria-label={s.status === "actif" ? "Masquer le service" : "Afficher le service"} title={s.status === "actif" ? "Masquer" : "Afficher"} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95">
                  {s.status === "actif" ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-green-500" />}
                </button>
                <button onClick={() => deleteService(s.id)} aria-label={`Supprimer ${s.title}`} title="Supprimer" className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-95">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(s => (
            <article key={s.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <ServiceImage service={s} className="h-40 w-full object-cover" />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black text-gray-900">{s.title}</p>
                    <p className="mt-1 truncate text-[11px] text-gray-500">{s.category} · {s.pro_email || "Professionnel non renseigné"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${s.status === "actif" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                    {s.status === "actif" ? "Actif" : "Inactif"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-black text-primary">{s.price}€ <span className="font-medium text-gray-400">· {s.duration_min} min</span></p>
                  <button onClick={() => setPreviewService(s)} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-600 hover:bg-blue-100">
                    <Eye className="h-3.5 w-3.5" /> Prévisualiser
                  </button>
                </div>
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <button onClick={() => toggleStatus(s)} className="flex-1 rounded-lg bg-gray-100 py-2 text-[11px] font-bold text-gray-600">
                    {s.status === "actif" ? "Masquer" : "Afficher"}
                  </button>
                  <button onClick={() => deleteService(s.id)} aria-label={`Supprimer ${s.title}`} className="rounded-lg bg-red-50 px-3 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {filtered.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun service trouvé.</p>}

      {previewService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" role="presentation" onMouseDown={() => setPreviewService(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="service-preview-title" onMouseDown={event => event.stopPropagation()}>
            <div className="relative">
              <ServiceImage service={previewService} className="h-56 w-full object-cover" />
              <button type="button" onClick={() => setPreviewService(null)} aria-label="Fermer la prévisualisation" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary">{previewService.category}</p>
                  <h2 id="service-preview-title" className="mt-1 text-xl font-black text-gray-900">{previewService.title}</h2>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${previewService.status === "actif" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                  {previewService.status === "actif" ? "Actif" : "Inactif"}
                </span>
              </div>
              <p className="text-sm leading-6 text-gray-600">{previewService.description || "Aucune description renseignée pour ce service."}</p>
              <div className="flex items-center gap-4 border-y border-gray-100 py-3 text-sm font-bold text-gray-800">
                <span className="text-primary">{previewService.price}€</span>
                <span className="flex items-center gap-1.5 text-gray-500"><Clock3 className="h-4 w-4" /> {previewService.duration_min} min</span>
              </div>
              <p className="text-xs text-gray-400">Proposé par {previewService.pro_email || "professionnel non renseigné"}</p>
              <div className="flex gap-2">
                <a href={`${PUBLIC_APP_URL}/service/${previewService.id}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white"><ExternalLink className="h-4 w-4" /> Voir la page détaillée</a>
                <button type="button" onClick={() => setPreviewService(null)} className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-black text-gray-600">Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
