import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useEffect, useRef } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { entities } from "@/api/entities";
import { uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { Trash2, Plus, Eye, EyeOff, Loader2, Search, Star, Image, X, Video, GripVertical, Edit3, Lightbulb } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import AdminStyleConseils from "./AdminStyleConseils";


const CATEGORIES = ["Coiffure", "Maquillage", "Ongles", "Soin", "Barbe", "Massage"];

export default function AdminStyles() {
  const [styles, setStyles] = useState([]);
  const [activeTab, setActiveTab] = useState("styles");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const imgInputRef = useRef(null);
  const extraImgsRef = useRef(null);

  const EMPTY_FORM = { title: "", description: "", category: "Coiffure", image_url: "", images: [], video_url: "", tags: [], produits_utilises: [] };
  const [showProduitPicker, setShowProduitPicker] = useState(false);
  const [produitsDispo, setProduitsDispo] = useState([]);
  const [loadingProduits, setLoadingProduits] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [draftId, setDraftId] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = création, string = édition d'un style existant
  const autoSaveTimer = useRef(null);

  const updateForm = (updater) => {
    setForm(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Auto-save en base avec debounce 1.5s si titre renseigné
      if (next.title) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => autoSaveDraft(next), 1500);
      }
      return next;
    });
  };

  const autoSaveDraft = async (data) => {
    try {
      const styleData = { ...data, pro_email: data.pro_email || "admin@beautybook.fr" };
      if (draftId) {
        await entities.Style.update(draftId, { ...styleData, status: "brouillon" });
      } else {
        const res = await entities.Style.create({ ...styleData, status: "brouillon" });
        if (res.data?.style?.id) setDraftId(res.data.style.id);
      }
    } catch {}
  };

  const loadProduits = async () => {
    setLoadingProduits(true);
    // Charger les produits BDD + Shopify en parallèle
    const [dbRes, shopifyRes] = await Promise.all([
      entities.Produit.filter({ status: "actif" }, "-created_at", 100).catch(() => ({ data: { results: [] } })),
      fetchShopifyProducts({}).catch(() => ({ data: { products: [] } })),
    ]);
    const dbItems = Array.isArray(dbRes) ? dbRes : dbRes?.data?.results || [];
    const shopifyItems = (Array.isArray(shopifyRes) ? shopifyRes : shopifyRes?.data?.products || []).map(p => ({
      id: p.id,
      name: p.name || p.title,
      brand: p.brand || p.vendor || "",
      price: p.price || 0,
      image_url: p.img || p.image_url || "",
      external_url: p.external_url || "",
      category: p.category || "",
      source: "shopify",
    }));
    // Fusionner : BDD en priorité (écrase les doublons Shopify si même ID)
    const merged = [...shopifyItems.filter(s => !dbItems.some(d => d.id === s.id)), ...dbItems];
    setProduitsDispo(merged);
    setLoadingProduits(false);
  };

  const toggleProduitUtilise = (produit) => {
    updateForm(f => {
      const exists = (f.produits_utilises || []).find(p => p.id === produit.id);
      if (exists) {
        return { ...f, produits_utilises: f.produits_utilises.filter(p => p.id !== produit.id) };
      }
      return {
        ...f,
        produits_utilises: [...(f.produits_utilises || []), {
          id: produit.id,
          name: produit.name,
          brand: produit.brand || produit.vendor || "",
          price: produit.price || 0,
          image_url: produit.image_url || produit.img || "",
          external_url: produit.external_url || "",
          source: produit.source || (produit.external_url ? "lien" : "boutique"),
        }]
      };
    });
  };

  const clearDraft = async () => {
     if (draftId && !editingId) {
       await entities.Style.delete(draftId).catch(() => {});
       setDraftId(null);
     }
     setForm(EMPTY_FORM);
   };

  const refreshList = () => {
    adminApi.listStyles()
      .then(res => setStyles(Array.isArray(res) ? res : res?.data?.results || res?.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    refreshList();
    setLoading(false);
    const onFocus = () => { if (document.visibilityState === 'visible') refreshList(); };
    document.addEventListener('visibilitychange', onFocus);
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refreshList(); }, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(interval);
    };
  }, []);

  // Upload multiple media at once — first image/video = main if not already set
  const uploadMedia = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingImg(true);
    setUploadError("");
    for (const file of files) {
      try {
        const { file_url } = await uploadFile({ file });
        const isVideo = file.type.startsWith("video/");
        updateForm(f => {
          if (isVideo) return { ...f, video_url: file_url };
          const newImages = [...f.images, file_url];
          return { ...f, images: newImages, image_url: f.image_url || newImages[0] };
        });
      } catch (err) {
        console.error('[AdminStyles] Upload error:', err);
        setUploadError(`Erreur lors de l'upload: ${err.message}`);
      }
    }
    setUploadingImg(false);
    e.target.value = "";
  };

  const reorderImages = (from, to) => {
    updateForm(f => {
      const imgs = [...f.images];
      const [moved] = imgs.splice(from, 1);
      imgs.splice(to, 0, moved);
      return { ...f, images: imgs, image_url: imgs[0] || f.image_url };
    });
  };

  const removeMedia = (idx) => {
    updateForm(f => {
      const imgs = f.images.filter((_, i) => i !== idx);
      return { ...f, images: imgs, image_url: imgs[0] || "" };
    });
  };

  const toggleStatus = async (style) => {
    try {
      const newStatus = style.status === "publie" ? "brouillon" : "publie";
      await entities.Style.update(style.id, { status: newStatus });
      setStyles(prev => prev.map(s => s.id === style.id ? { ...s, status: newStatus } : s));
      setTimeout(refreshList, 500);
    } catch {}
  };

  const editStyle = (style) => {
     setDraftId(null); // ne pas confondre avec un brouillon
     setEditingId(style.id);
     setForm({
       title: style.title || "",
       description: style.description || "",
       category: style.category || "Coiffure",
       image_url: style.image_url || "",
       images: style.images || [],
       video_url: style.video_url || "",
       tags: style.tags || [],
       produits_utilises: style.produits_utilises || [],
     });
     setCreating(true);
   };

   const deleteStyle = async (id) => {
      if (!confirm("Êtes-vous vraiment sûr de vouloir supprimer ce style ? Cette action est définitive.")) return;
      try {
        await adminApi.deleteStyle(id);
        setStyles(prev => prev.filter(s => s.id !== id));
        setTimeout(refreshList, 500);
      } catch (err) {
        alert("Erreur suppression : " + err.message);
      }
    };

   const saveStyle = async (status) => {
     if (!form.title || !form.image_url) { alert("Titre et image principale requis."); return; }
     setSaving(true);
     clearTimeout(autoSaveTimer.current);
     try {
       let savedStyle;
       if (editingId) {
         const res = await entities.Style.update(editingId, { ...form, status });
         savedStyle = res?.data?.style || res?.result || res || { ...form, id: editingId, status };
         setStyles(prev => prev.map(s => s.id === editingId ? savedStyle : s));
       } else if (draftId) {
         const res = await entities.Style.update(draftId, { ...form, status });
         savedStyle = res?.data?.style || res?.result || res || { ...form, id: draftId, status };
         setStyles(prev => prev.map(s => s.id === draftId ? savedStyle : s));
        } else {
          const res = await entities.Style.create({ ...form, pro_email: form.pro_email || "admin@beautybook.fr", status });
         savedStyle = res?.data?.style || res?.result || res;
         if (!savedStyle) throw new Error("Création échouée");
         setStyles(prev => [savedStyle, ...prev]);
       }
        setDraftId(null);
        setEditingId(null);
        setCreating(false);
        setForm(EMPTY_FORM);
        refreshList();
      } catch (err) {
        alert("Erreur : " + err.message);
      }
      setSaving(false);
    };

  const filtered = styles.filter(s =>
    !search || s.title?.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const renderTabs = () => (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setActiveTab("styles")}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black transition-all ${activeTab === "styles" ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
        <Star className="w-4 h-4" /> Styles
      </button>
      <button type="button" onClick={() => setActiveTab("conseils")}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black transition-all ${activeTab === "conseils" ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
        <Lightbulb className="w-4 h-4" /> Conseils
      </button>
    </div>
  );

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (activeTab === "conseils") {
    return <div className="space-y-4">{renderTabs()}<AdminStyleConseils styles={styles} /></div>;
  }

  return (
    <div className="space-y-4">
      {renderTabs()}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un style..." className="flex-1 bg-transparent text-gray-700 text-[13px] outline-none placeholder:text-gray-400" />
        </div>
        <button onClick={() => setCreating(v => !v)}
          className="relative flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all shadow-md shadow-primary/20">
          <Plus className="w-4 h-4" /> Nouveau style
          {form.title && !creating && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full text-[8px] font-black text-white flex items-center justify-center">!</span>}
        </button>
      </div>

      {creating && (
        <form onSubmit={e => { e.preventDefault(); saveStyle("publie"); }} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-900 text-[15px] font-black">{editingId ? "Modifier le style" : "Créer un style"}</h3>
            {form.title && !editingId && <span className="text-[10px] text-gray-400 font-medium">💾 {draftId ? "Brouillon sauvegardé en ligne" : "Sauvegarde auto..."}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={e => updateForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titre du style *" required
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
            <select value={form.category} onChange={e => updateForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <textarea value={form.description} onChange={e => updateForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optionnel)" rows={2}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none" />

          <div>
            <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest mb-2">Médias (images + vidéo)</p>
            <p className="text-gray-400 text-[10px] mb-2">La première à gauche = couverture. Glissez-déposez pour réordonner.</p>
            <input ref={imgInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={uploadMedia} />

            {/* Drag-and-drop media grid */}
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              reorderImages(result.source.index, result.destination.index);
            }}>
              <Droppable droppableId="media" direction="horizontal">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-2 flex-wrap mb-3">
                    {form.images.map((url, i) => (
                      <Draggable key={`img-${i}`} draggableId={`img-${i}`} index={i}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`relative group ${snapshot.isDragging ? "z-50 opacity-80" : ""}`}
                          >
                            <div className={`w-20 h-20 rounded-xl overflow-hidden border-2 ${i === 0 ? "border-primary ring-2 ring-primary/20" : "border-gray-200"}`}>
                              <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                            </div>
                            {i === 0 && <span className="absolute -top-1 -left-1 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">MAIN</span>}
                            <button type="button" onClick={() => removeMedia(i)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                              <X className="w-3 h-3" />
                            </button>
                            {/* Drag handle */}
                            <div {...provided.dragHandleProps} className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/60 rounded-t-md px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {form.video_url && (
                      <div className="relative group">
                        <div className="w-20 h-20 rounded-xl bg-gray-900 border-2 border-purple-400 flex flex-col items-center justify-center">
                          <Video className="w-6 h-6 text-white" />
                          <span className="text-white text-[8px] font-black mt-1">VIDÉO</span>
                        </div>
                        <button type="button" onClick={() => updateForm(f => ({ ...f, video_url: "" }))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <button type="button" onClick={() => imgInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-4 text-gray-400 text-[13px] hover:border-primary transition-all">
              {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {uploadingImg ? "Upload en cours..." : "Ajouter des images / vidéo"}
            </button>
            {uploadError && (
              <p className="text-red-500 text-[11px] mt-2 bg-red-50 rounded-xl px-3 py-2">{uploadError}</p>
            )}
          </div>

          {/* Produits utilisés */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest">Produits utilisés</p>
              <button type="button" onClick={() => { setShowProduitPicker(v => !v); if (!produitsDispo.length) loadProduits(); }}
                className="text-primary text-[11px] font-black border border-primary/30 rounded-xl px-3 py-1.5 hover:bg-primary/5">
                + Ajouter un produit
              </button>
            </div>
            {(form.produits_utilises || []).length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {form.produits_utilises.map((p, i) => (
                  <div key={p.id || i} className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                    {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                    <div>
                      <p className="text-[11px] font-black text-gray-800">{p.name}</p>
                      {p.price > 0 && <p className="text-[10px] text-primary font-bold">{p.price}€</p>}
                    </div>
                    <button type="button" onClick={() => updateForm(f => ({ ...f, produits_utilises: f.produits_utilises.filter((_, j) => j !== i) }))}
                      className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-[10px]">✕</button>
                  </div>
                ))}
              </div>
            )}
            {showProduitPicker && (
              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200 max-h-48 overflow-y-auto space-y-2">
                {loadingProduits
                  ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  : produitsDispo.length === 0
                  ? <p className="text-gray-400 text-[12px] text-center py-3">Aucun produit dans la boutique</p>
                  : produitsDispo.map(prod => {
                    const selected = (form.produits_utilises || []).some(p => p.id === prod.id);
                    return (
                      <button key={prod.id} type="button" onClick={() => toggleProduitUtilise(prod)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${selected ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
                        {prod.image_url && <img src={prod.image_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black text-gray-900 truncate">{prod.name}</p>
                          <p className="text-[10px] text-gray-500">{prod.price}€ · {prod.category}</p>
                        </div>
                        {selected && <span className="text-primary text-[12px] font-black shrink-0">✓</span>}
                      </button>
                    );
                  })
                }
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2 min-w-[120px]">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : "Publier →"}
            </button>
            <button type="button" disabled={saving} onClick={() => saveStyle("brouillon")}
              className="flex-1 bg-gray-700 text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2 min-w-[120px]">
              💾 Brouillon
            </button>
            <button type="button" onClick={() => { setCreating(false); setEditingId(null); setDraftId(null); setForm(EMPTY_FORM); }}
              className="bg-gray-100 text-gray-600 py-3 px-4 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}

      <p className="text-gray-500 text-[12px]">{filtered.length} style(s)</p>
      <div className="space-y-3">
        {filtered.map(style => (
          <div key={style.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-100">
              {style.image_url
                ? <img src={style.image_url} alt={style.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Image className="w-5 h-5 text-gray-400" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-[13px] font-black truncate">{style.title}</p>
              <p className="text-gray-500 text-[11px]">{style.category} · {style.pro_email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-[10px]">❤️ {style.likes || 0}</span>
                <span className="text-gray-400 text-[10px]">👁 {style.views || 0}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${style.status === "publie" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                  {style.status === "publie" ? "Publié" : "Brouillon"}
                </span>
                {style.featured && <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => editStyle(style)} className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                <Edit3 className="w-4 h-4 text-blue-500" />
              </button>
              <button onClick={() => toggleStatus(style)} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                {style.status === "publie" ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-green-500" />}
              </button>
              <button onClick={() => deleteStyle(style.id)} className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun style trouvé.</p>}
      </div>
    </div>
  );
}
