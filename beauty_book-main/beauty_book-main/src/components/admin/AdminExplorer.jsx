import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { adminApi } from "@/lib/adminApiClient";
import { entities } from "@/api/entities";
import { isProfilParticulier, isProfilSalon } from "@/lib/annonces";
import { Plus, Trash2, Upload, Loader2, Eye, EyeOff, Pencil, X, Star, Check } from "lucide-react";

const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary";
const CATEGORIES = ["Coiffure", "Maquillage", "Ongles", "Soin", "Barbe", "Massage"];
const SERVICE_CATEGORIES = ["Coiffure", "Maquillage", "Ongles", "Soin", "Barbe", "Massage", "Épilation"];

// ── Helper: load/save home config (partagé avec pages/Home) ──────────────────
const loadHomeConfig = () => {
  try { return JSON.parse(localStorage.getItem("bb_home_config") || "{}"); } catch { return {}; }
};
const saveHomeConfig = (cfg) => {
  localStorage.setItem("bb_home_config", JSON.stringify(cfg));
};

// ── Onglet Styles ─────────────────────────────────────────────────────────────
function StylesTab() {
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Tous");
  const imgRef = useRef(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "Coiffure",
    image_url: "", images: [], video_url: "", tags: [], featured: false,
  });

  useEffect(() => {
    adminApi.listStyles()
      .then(res => setStyles(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const uploadImg = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, image_url: f.image_url || file_url, images: [...f.images, file_url] }));
    }
    setUploading(false);
    e.target.value = "";
  };

  const createStyle = async (e) => {
    e.preventDefault();
    if (!form.title || !form.image_url) return;
    setSaving(true);
    const user = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);
    const { data } = await adminApi.createStyle({
      ...form, pro_email: user?.email || "admin@beautybook.fr", status: "publie",
    });
    setStyles(prev => [data?.result, ...prev]);
    setCreating(false);
    setForm({ title: "", description: "", category: "Coiffure", image_url: "", images: [], video_url: "", tags: [], featured: false });
    setSaving(false);
  };

  const toggleFeatured = async (style) => {
    await entities.Style.update(style.id, { featured: !style.featured });
    setStyles(prev => prev.map(s => s.id === style.id ? { ...s, featured: !s.featured } : s));
  };

  const toggleStatus = async (style) => {
    const newStatus = style.status === "publie" ? "brouillon" : "publie";
    await entities.Style.update(style.id, { status: newStatus });
    setStyles(prev => prev.map(s => s.id === style.id ? { ...s, status: newStatus } : s));
  };

  const deleteStyle = async (id) => {
    if (!confirm("Supprimer ce style ?")) return;
    await adminApi.deleteStyle(id);
    setStyles(prev => prev.filter(s => s.id !== id));
  };

  const filtered = activeFilter === "Tous" ? styles : styles.filter(s => s.category === activeFilter);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-blue-700 text-[12px] font-bold">🎨 Gérez les styles de l'onglet <strong>STYLES</strong>. ⭐ = mis en avant.</p>
      </div>
      <button onClick={() => setCreating(v => !v)}
        className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">
        <Plus className="w-4 h-4" /> Ajouter un style
      </button>
      {creating && (
        <form onSubmit={createStyle} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3 shadow-sm">
          <h3 className="text-gray-900 text-[15px] font-black">Nouveau style</h3>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre *" required className={inputCls} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className={`${inputCls} resize-none`} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Images *</label>
            <input ref={imgRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={uploadImg} />
            {form.images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {form.images.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => imgRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[13px] hover:border-primary transition-all">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Upload..." : "Ajouter images / vidéo"}
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="accent-primary" />
            <span className="text-[13px] font-bold text-gray-700">⭐ Mettre en avant</span>
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving || !form.image_url} className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</> : "Publier →"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["Tous", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setActiveFilter(c)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-all ${activeFilter === c ? "bg-primary text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
            {c}
          </button>
        ))}
      </div>
      <p className="text-gray-500 text-[12px]">{filtered.length} style(s)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="relative aspect-square bg-gray-100">
              {s.image_url || (s.images && s.images[0])
                ? <img src={s.image_url || s.images[0]} alt={s.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl">🎨</div>
              }
              <div className="absolute top-2 left-2 flex gap-1">
                {s.featured && <span className="bg-yellow-400 text-[8px] font-black px-1.5 py-0.5 rounded-full">⭐</span>}
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${s.status === "publie" ? "bg-green-500 text-white" : "bg-gray-400 text-white"}`}>
                  {s.status === "publie" ? "Publié" : "Masqué"}
                </span>
              </div>
            </div>
            <div className="p-2.5">
              <p className="text-[12px] font-black text-gray-900 truncate">{s.title}</p>
              <p className="text-[10px] text-primary font-bold">{s.category}</p>
              <div className="flex gap-1 mt-2">
                <button onClick={() => toggleFeatured(s)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${s.featured ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                  ⭐ {s.featured ? "En avant" : "Mettre en avant"}
                </button>
                <button onClick={() => toggleStatus(s)} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  {s.status === "publie" ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-green-500" />}
                </button>
                <button onClick={() => deleteStyle(s.id)} className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun style.</p>}
    </div>
  );
}

// ── Onglet Services ───────────────────────────────────────────────────────────
function ServicesTab() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [form, setForm] = useState({ title: "", description: "", category: "Coiffure", price: "", duration_min: 60, status: "actif" });

  useEffect(() => {
    adminApi.listServices().then(res => setServices(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveService = async (e) => {
    e.preventDefault();
    setSaving(true);
    const serviceData = { ...form, price: parseFloat(form.price) || 0, duration_min: parseInt(form.duration_min) || 60 };
    if (editingId) {
      const { data } = await entities.Service.update(editingId, serviceData);
      setServices(prev => prev.map(s => s.id === editingId ? { ...s, ...data?.result } : s));
      setEditingId(null);
    } else {
      const user = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);
      const { data } = await entities.Service.create({ ...serviceData, duration: serviceData.duration_min || 60, pro_email: user?.email || "admin@beautybook.fr" });
      setServices(prev => [data?.result, ...prev]);
    }
    setCreating(false);
    setForm({ title: "", description: "", category: "Coiffure", price: "", duration_min: 60, status: "actif" });
    setSaving(false);
  };

  const startEdit = (s) => {
    setForm({ title: s.title, description: s.description || "", category: s.category, price: s.price, duration_min: s.duration_min || 60, status: s.status });
    setEditingId(s.id);
    setCreating(true);
  };

  const toggleStatus = async (s) => {
    const newStatus = s.status === "actif" ? "inactif" : "actif";
    await entities.Service.update(s.id, { status: newStatus });
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, status: newStatus } : x));
  };

  const deleteService = async (id) => {
    if (!confirm("Supprimer ce service ?")) return;
    await entities.Service.delete(id);
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const filtered = activeFilter === "Tous" ? services : services.filter(s => s.category === activeFilter);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <p className="text-green-700 text-[12px] font-bold">✂️ Gérez les services affichés dans l'onglet <strong>SERVICES</strong>.</p>
      </div>
      <button onClick={() => { setCreating(v => !v); setEditingId(null); setForm({ title: "", description: "", category: "Coiffure", price: "", duration_min: 60, status: "actif" }); }}
        className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">
        <Plus className="w-4 h-4" /> Ajouter un service
      </button>
      {creating && (
        <form onSubmit={saveService} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3 shadow-sm">
          <h3 className="text-gray-900 text-[15px] font-black">{editingId ? "Modifier le service" : "Nouveau service"}</h3>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre *" required className={inputCls} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className={`${inputCls} resize-none`} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Prix (€) *" required className={inputCls} />
            <input type="number" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} placeholder="Durée (min)" className={inputCls} />
          </div>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
            {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Enregistrer" : "Créer →"}
            </button>
            <button type="button" onClick={() => { setCreating(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["Tous", ...SERVICE_CATEGORIES].map(c => (
          <button key={c} onClick={() => setActiveFilter(c)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-all ${activeFilter === c ? "bg-primary text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
            {c}
          </button>
        ))}
      </div>
      <p className="text-gray-500 text-[12px]">{filtered.length} service(s)</p>
      <div className="space-y-2">
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-black text-gray-900 truncate">{s.title}</p>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${s.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.status}</span>
              </div>
              <p className="text-[11px] text-gray-400">{s.category} • {s.duration_min}min • <span className="text-primary font-black">{s.price}€</span></p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEdit(s)} className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5 text-blue-500" />
              </button>
              <button onClick={() => toggleStatus(s)} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                {s.status === "actif" ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-green-500" />}
              </button>
              <button onClick={() => deleteService(s.id)} className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun service.</p>}
      </div>
    </div>
  );
}

// ── Onglet Salons ─────────────────────────────────────────────────────────────
function SalonsTab() {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.listProfilsPro()
      .then(res => {
        const all = Array.isArray(res) ? res : res?.data?.results || [];
        setSalons(all.filter(isProfilSalon));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (s) => {
    const newStatus = s.status === "actif" ? "pause" : "actif";
    await entities.ProfilPro.update(s.id, { status: newStatus });
    setSalons(prev => prev.map(x => x.id === s.id ? { ...x, status: newStatus } : x));
  };

  const deleteS = async (id) => {
    if (!confirm("Supprimer ce salon et toutes ses données ?")) return;
    if (!confirm("Cette action est IRRÉVERSIBLE. Continuer ?")) return;
    try {
      const salon = salons.find(s => s.id === id);
      const email = salon?.user_email;
      if (email) {
        await entities.Service.filter({ pro_email: email }).then(services => {
          services.forEach(s => entities.Service.delete(s.id));
        }).catch(() => {});
        await entities.ServiceBundle.filter({ pro_email: email }).then(bundles => {
          bundles.forEach(b => entities.ServiceBundle.delete(b.id));
        }).catch(() => {});
        await entities.MembreEquipe.filter({ pro_email: email }).then(members => {
          members.forEach(m => entities.MembreEquipe.delete(m.id));
        }).catch(() => {});
        await entities.Style.filter({ pro_email: email }).then(items => {
          items.forEach(i => entities.Style.delete(i.id));
        }).catch(() => {});
        await entities.Reel.filter({ author_email: email }).then(items => {
          items.forEach(i => entities.Reel.delete(i.id));
        }).catch(() => {});
        await entities.Publication.filter({ author_email: email }).then(items => {
          items.forEach(i => entities.Publication.delete(i.id));
        }).catch(() => {});
        await entities.Annonce.filter({ pro_email: email }).then(items => {
          items.forEach(i => entities.Annonce.delete(i.id));
        }).catch(() => {});
      }
      await entities.ProfilPro.delete(id);
      setSalons(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert("Erreur: " + e.message); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
        <p className="text-purple-700 text-[12px] font-bold">🏠 Gérez les profils salons affichés dans l'onglet <strong>SALONS</strong>.</p>
      </div>
      <p className="text-gray-500 text-[12px]">{salons.length} salon(s)</p>
      <div className="space-y-2">
        {salons.map(s => (
          <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-3">
            {s.avatar_url
              ? <img src={s.avatar_url} alt={s.salon_name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
              : <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-[18px] font-black text-primary">{(s.salon_name || "?")[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-black text-gray-900 truncate">{s.salon_name}</p>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${s.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.status}</span>
              </div>
              <p className="text-[11px] text-gray-400">{s.city || "—"} • {s.abonnement} • ⭐ {s.rating || 0}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => toggleStatus(s)} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                {s.status === "actif" ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-green-500" />}
              </button>
              <button onClick={() => deleteS(s.id)} className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {salons.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun salon enregistré.</p>}
      </div>
    </div>
  );
}

// ── Onglet Particuliers ───────────────────────────────────────────────────────
function ParticuliersTab() {
  const [pros, setPros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    entities.ProfilPro.filter({}, "-created_at", 500)
      .then(res => {
        const all = Array.isArray(res) ? res : res?.data?.results || [];
        setPros(all.filter(isProfilParticulier));
      })
      .catch(() => adminApi.listProfilsPro().then(res => {
        const all = Array.isArray(res) ? res : res?.data?.results || [];
        setPros(all.filter(isProfilParticulier));
      }))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (s) => {
    const newStatus = s.status === "actif" ? "pause" : "actif";
    await entities.ProfilPro.update(s.id, { status: newStatus });
    setPros(prev => prev.map(x => x.id === s.id ? { ...x, status: newStatus } : x));
  };

  const deleteP = async (id) => {
    if (!confirm("Supprimer ce particulier et toutes ses données ?")) return;
    if (!confirm("Cette action est IRRÉVERSIBLE. Continuer ?")) return;
    try {
      const pro = pros.find(p => p.id === id);
      const email = pro?.user_email;
      if (email) {
        await entities.Service.filter({ pro_email: email }).then(services => {
          services.forEach(s => entities.Service.delete(s.id));
        }).catch(() => {});
        await entities.ServiceBundle.filter({ pro_email: email }).then(bundles => {
          bundles.forEach(b => entities.ServiceBundle.delete(b.id));
        }).catch(() => {});
        await entities.MembreEquipe.filter({ pro_email: email }).then(members => {
          members.forEach(m => entities.MembreEquipe.delete(m.id));
        }).catch(() => {});
        await entities.Style.filter({ pro_email: email }).then(items => {
          items.forEach(i => entities.Style.delete(i.id));
        }).catch(() => {});
        await entities.Reel.filter({ author_email: email }).then(items => {
          items.forEach(i => entities.Reel.delete(i.id));
        }).catch(() => {});
        await entities.Publication.filter({ author_email: email }).then(items => {
          items.forEach(i => entities.Publication.delete(i.id));
        }).catch(() => {});
      }
      await entities.ProfilPro.delete(id);
      setPros(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert("Erreur: " + e.message); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
        <p className="text-orange-700 text-[12px] font-bold">👤 Gérez les profils particuliers/indépendants affichés dans l'onglet <strong>PARTICULIERS</strong>.</p>
      </div>
      <p className="text-gray-500 text-[12px]">{pros.length} profil(s)</p>
      <div className="space-y-2">
        {pros.map(p => (
          <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-3">
            {p.avatar_url
              ? <img src={p.avatar_url} alt={p.salon_name} className="w-12 h-12 rounded-full object-cover shrink-0" />
              : <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[18px] font-black text-primary">{(p.salon_name || "?")[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-black text-gray-900 truncate">{p.salon_name}</p>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${p.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.status}</span>
              </div>
              <p className="text-[11px] text-gray-400">{p.city || "—"} • {p.specialites?.slice(0, 2).join(", ") || "—"}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => toggleStatus(p)} className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                {p.status === "actif" ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-green-500" />}
              </button>
              <button onClick={() => deleteP(p.id)} className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {pros.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun profil particulier.</p>}
      </div>
    </div>
  );
}

// ── Onglet Recommandés ────────────────────────────────────────────────────────
function RecommandesTab() {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(() => loadHomeConfig());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 100)
      .then(res => setSalons(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectedIds = cfg.recommandes_ids || [];

  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    const newCfg = { ...cfg, recommandes_ids: next };
    setCfg(newCfg);
    saveHomeConfig(newCfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <p className="text-teal-700 text-[12px] font-bold">⭐ Sélectionnez les salons à afficher dans <strong>"Recommandés pour vous"</strong> sur la Home.</p>
        {saved && <span className="text-green-600 text-[11px] font-black flex items-center gap-1"><Check className="w-3 h-3" /> Sauvegardé</span>}
      </div>
      <p className="text-gray-500 text-[12px]">{selectedIds.length} sélectionné(s)</p>
      <div className="space-y-2">
        {salons.map(s => {
          const selected = selectedIds.includes(s.id);
          return (
            <button key={s.id} onClick={() => toggle(s.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.99] text-left ${selected ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
              {s.avatar_url
                ? <img src={s.avatar_url} alt={s.salon_name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-[16px] font-black text-primary">{(s.salon_name || "?")[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900 truncate">{s.salon_name}</p>
                <p className="text-[11px] text-gray-400">{s.city || "—"} • ⭐ {s.rating || 0}</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-gray-300"}`}>
                {selected && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          );
        })}
        {salons.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun salon actif.</p>}
      </div>
    </div>
  );
}

// ── Onglet Salons Élites ──────────────────────────────────────────────────────
function SalonsElitesTab() {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(() => loadHomeConfig());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 100)
      .then(res => setSalons(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectedIds = cfg.salons_elites_ids || [];

  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    const newCfg = { ...cfg, salons_elites_ids: next };
    setCfg(newCfg);
    saveHomeConfig(newCfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <p className="text-yellow-700 text-[12px] font-bold">👑 Sélectionnez les salons à afficher dans la section <strong>"Salons Élites"</strong> sur la Home.</p>
        {saved && <span className="text-green-600 text-[11px] font-black flex items-center gap-1"><Check className="w-3 h-3" /> Sauvegardé</span>}
      </div>
      <p className="text-gray-500 text-[12px]">{selectedIds.length} sélectionné(s)</p>
      <div className="space-y-2">
        {salons.map(s => {
          const selected = selectedIds.includes(s.id);
          return (
            <button key={s.id} onClick={() => toggle(s.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.99] text-left ${selected ? "border-yellow-400 bg-yellow-50" : "border-gray-100 bg-white"}`}>
              {s.avatar_url
                ? <img src={s.avatar_url} alt={s.salon_name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0 text-[16px] font-black text-yellow-700">{(s.salon_name || "?")[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900 truncate">{s.salon_name}</p>
                <p className="text-[11px] text-gray-400">{s.city || "—"} • {s.abonnement} • ⭐ {s.rating || 0}</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "bg-yellow-400 border-yellow-400" : "border-gray-300"}`}>
                {selected && <Star className="w-3.5 h-3.5 text-white fill-white" />}
              </div>
            </button>
          );
        })}
        {salons.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun salon actif.</p>}
      </div>
    </div>
  );
}

// ── Onglet Expériences & Sorties ──────────────────────────────────────────────
function ExperiencesTab() {
  const [cfg, setCfg] = useState(() => loadHomeConfig());
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(null);
  const imgRefs = useRef([]);
  const experiences = cfg.experiences || [
    { id: 1, title: "", description: "", image_url: "", tag: "", link: "" }
  ];

  const update = (i, field, val) => {
    const next = experiences.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
    const newCfg = { ...cfg, experiences: next };
    setCfg(newCfg);
    saveHomeConfig(newCfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const uploadImg = async (e, idx) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(idx);
    const { file_url } = await uploadFile({ file });
    update(idx, "image_url", file_url);
    setUploading(null);
    e.target.value = "";
  };

  const addCard = () => {
    const next = [...experiences, { id: Date.now(), title: "", description: "", image_url: "", tag: "", link: "" }];
    const newCfg = { ...cfg, experiences: next };
    setCfg(newCfg);
    saveHomeConfig(newCfg);
  };

  const removeCard = (i) => {
    const next = experiences.filter((_, idx) => idx !== i);
    const newCfg = { ...cfg, experiences: next };
    setCfg(newCfg);
    saveHomeConfig(newCfg);
  };

  return (
    <div className="space-y-4">
      <div className="bg-pink-50 border border-pink-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <p className="text-pink-700 text-[12px] font-bold">🎭 Gérez les cartes de la section <strong>"Expériences & Sorties"</strong> sur la Home.</p>
        {saved && <span className="text-green-600 text-[11px] font-black flex items-center gap-1"><Check className="w-3 h-3" /> Sauvegardé</span>}
      </div>
      {experiences.map((exp, i) => (
        <div key={exp.id || i} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-black text-gray-700">Expérience #{i + 1}</p>
            <button onClick={() => removeCard(i)} className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
          <input value={exp.title} onChange={e => update(i, "title", e.target.value)} placeholder="Titre de l'expérience" className={inputCls} />
          <input value={exp.description} onChange={e => update(i, "description", e.target.value)} placeholder="Description courte" className={inputCls} />

          {/* Upload image */}
          <input ref={el => imgRefs.current[i] = el} type="file" accept="image/*" className="hidden" onChange={e => uploadImg(e, i)} />
          {exp.image_url ? (
            <div className="space-y-2">
              <img src={exp.image_url} alt="" className="w-full h-32 object-cover rounded-xl" onError={e => e.target.style.display = "none"} />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex-1">
                  <Upload className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-green-700 text-[12px] font-bold">✓ Image définie</span>
                </div>
                <button onClick={() => imgRefs.current[i]?.click()} className="text-primary text-[11px] font-black px-3 py-2 border border-primary/30 rounded-xl hover:bg-primary/5">
                  Changer
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => imgRefs.current[i]?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl py-6 text-gray-400 hover:border-primary hover:text-primary transition-all">
              {uploading === i ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              <div className="text-center">
                <p className="text-[13px] font-black">{uploading === i ? "Upload en cours..." : "Cliquer pour uploader une image"}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG — ratio 16:9 recommandé</p>
              </div>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input value={exp.tag} onChange={e => update(i, "tag", e.target.value)} placeholder="Badge (ex: NOUVEAU)" className={inputCls} />
            <input value={exp.link} onChange={e => update(i, "link", e.target.value)} placeholder="Lien (ex: /services)" className={inputCls} />
          </div>
        </div>
      ))}
      <button onClick={addCard} className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all w-full justify-center">
        <Plus className="w-4 h-4" /> Ajouter une expérience
      </button>
    </div>
  );
}

// ── Onglet Espaces Pro ────────────────────────────────────────────────────────
function EspacesProTab() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(() => loadHomeConfig());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    entities.ImmobilierListing.filter({ status: "actif" }, "-created_at", 50)
      .then(res => setListings(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectedIds = cfg.espaces_pro_ids || [];

  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    const newCfg = { ...cfg, espaces_pro_ids: next };
    setCfg(newCfg);
    saveHomeConfig(newCfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <p className="text-indigo-700 text-[12px] font-bold">🏢 Sélectionnez les espaces à afficher dans la section <strong>"Espaces Pro"</strong> sur la Home.</p>
        {saved && <span className="text-green-600 text-[11px] font-black flex items-center gap-1"><Check className="w-3 h-3" /> Sauvegardé</span>}
      </div>
      <p className="text-gray-500 text-[12px]">{selectedIds.length} sélectionné(s) • {listings.length} disponible(s)</p>
      <div className="space-y-2">
        {listings.map(l => {
          const selected = selectedIds.includes(l.id);
          return (
            <button key={l.id} onClick={() => toggle(l.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.99] text-left ${selected ? "border-indigo-400 bg-indigo-50" : "border-gray-100 bg-white"}`}>
              {l.images?.[0]
                ? <img src={l.images[0]} alt={l.title} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                : <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 text-[22px]">🏢</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900 truncate">{l.title}</p>
                <p className="text-[11px] text-gray-400">{l.location || "—"} • {l.price}€{l.unit ? `/${l.unit}` : ""}</p>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${l.type === "location" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}>{l.type}</span>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "bg-indigo-500 border-indigo-500" : "border-gray-300"}`}>
                {selected && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          );
        })}
        {listings.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun espace immobilier actif. Ajoutez-en dans la section Immobilier.</p>}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
const TABS = [
  { id: "styles", label: "🎨 Styles" },
  { id: "services", label: "✂️ Services" },
  { id: "salons", label: "🏠 Salons" },
  { id: "particuliers", label: "👤 Particuliers" },
  { id: "recommandes", label: "⭐ Recommandés" },
  { id: "elites", label: "👑 Élites" },
  { id: "experiences", label: "🎭 Expériences" },
  { id: "espaces", label: "🏢 Espaces Pro" },
];

export default function AdminExplorer() {
  const [activeTab, setActiveTab] = useState("styles");

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-gray-700 text-[12px] font-bold">🔍 Gérez ici tout le contenu de la page <strong>Explorer (Services & Salons)</strong> et les sections de la <strong>page d'accueil</strong>.</p>
      </div>

      {/* Tabs scrollable */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-[12px] font-black whitespace-nowrap transition-all ${activeTab === t.id ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white text-gray-600 border border-gray-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "styles" && <StylesTab />}
      {activeTab === "services" && <ServicesTab />}
      {activeTab === "salons" && <SalonsTab />}
      {activeTab === "particuliers" && <ParticuliersTab />}
      {activeTab === "recommandes" && <RecommandesTab />}
      {activeTab === "elites" && <SalonsElitesTab />}
      {activeTab === "experiences" && <ExperiencesTab />}
      {activeTab === "espaces" && <EspacesProTab />}
    </div>
  );
}
