import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useEffect, useRef } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { entities } from "@/api/entities";
import { uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { Trash2, Plus, Eye, EyeOff, Loader2, Search, Star, Image, X, Video, GripVertical, Edit3, Palette, Tag, Tags, Zap, Clock, ChevronDown, ChevronUp, Scissors, Wrench, Lightbulb } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import AdminStyleCategories from "./AdminStyleCategories";
import AdminStyleSubCategories from "./AdminStyleSubCategories";
import AdminStyleAutomation from "./AdminStyleAutomation";
import AdminStyleConseils from "./AdminStyleConseils";

const TABS = [
  { id: "styles", label: "Styles", icon: Palette },
  { id: "conseils", label: "Conseils", icon: Lightbulb },
  { id: "categories", label: "Catégories", icon: Tag },
  { id: "subcategories", label: "Sous-catégories", icon: Tags },
  { id: "automation", label: "Automatisation", icon: Zap },
];

const DIFFICULTY_LEVELS = ["Débutant", "Intermédiaire", "Avancé", "Expert"];

const HAIR_TYPES = ["Afro", "Européenne", "Asiatique", "Crépus", "Bouclés", "Ondulés", "Lisses", "Tresses", "Locks"];
const SKIN_TYPES = ["Normale", "Sèche", "Grasse", "Mixte", "Sensible", "Mature"];

export default function AdminStyles() {
  const [activeTab, setActiveTab] = useState("styles");
  const [styles, setStyles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSubCategory, setFilterSubCategory] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const imgInputRef = useRef(null);

  const EMPTY_FORM = {
    title: "", description: "", category: "", subcategory: "",
    image_url: "", images: [], video_url: "", tags: [], produits_utilises: [], outils_utilises: [],
    type_cheveux: "", type_peau: "", type_prestation: "", temps_moyen: "", niveau_difficulte: "", mots_cles: [],
  };
  const [showProduitPicker, setShowProduitPicker] = useState(false);
  const [produitsDispo, setProduitsDispo] = useState([]);
  const [loadingProduits, setLoadingProduits] = useState(false);
  const [outilsInput, setOutilsInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [draftId, setDraftId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const autoSaveTimer = useRef(null);

  const [subcategories, setSubcategories] = useState([]);

  const updateForm = (updater) => {
    setForm(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next.title) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => autoSaveDraft(next), 1500);
      }
      return next;
    });
  };

  const autoSaveDraft = async (data) => {
    try {
      const { category_id, subcategory_id, ...cleanData } = data;
      const styleData = { ...cleanData, pro_email: data.pro_email || "admin@beautybook.fr" };
      if (draftId) {
        await entities.Style.update(draftId, { ...styleData, status: "brouillon" });
      } else {
        const res = await entities.Style.create({ ...styleData, status: "brouillon" });
        if (res?.id) setDraftId(res.id);
      }
    } catch {}
  };

  const loadProduits = async () => {
    setLoadingProduits(true);
    const [dbRes, shopifyRes] = await Promise.all([
      entities.Produit.filter({ status: "actif" }, "-created_at", 100).catch(() => []),
      fetchShopifyProducts({}).catch(() => ({ data: { products: [] } })),
    ]);
    const dbItems = Array.isArray(dbRes) ? dbRes : dbRes?.data?.results || [];
    const shopifyItems = (Array.isArray(shopifyRes) ? shopifyRes : shopifyRes?.data?.products || []).map(p => ({
      id: p.id, name: p.name || p.title, brand: p.brand || p.vendor || "", price: p.price || 0,
      image_url: p.img || p.image_url || "", external_url: p.external_url || "", category: p.category || "", source: "shopify",
    }));
    setProduitsDispo([...shopifyItems.filter(s => !dbItems.some(d => d.id === s.id)), ...dbItems]);
    setLoadingProduits(false);
  };

  const toggleProduitUtilise = (produit) => {
    updateForm(f => {
      const exists = (f.produits_utilises || []).find(p => p.id === produit.id);
      if (exists) return { ...f, produits_utilises: f.produits_utilises.filter(p => p.id !== produit.id) };
      return { ...f, produits_utilises: [...(f.produits_utilises || []), { id: produit.id, name: produit.name, brand: produit.brand || "", price: produit.price || 0, image_url: produit.image_url || "", source: produit.source || "boutique" }] };
    });
  };

  const clearDraft = async () => {
    if (draftId && !editingId) { await entities.Style.delete(draftId).catch(() => {}); setDraftId(null); }
    setForm(EMPTY_FORM);
  };

  const refreshList = () => {
    adminApi.listStyles()
      .then(res => setStyles(Array.isArray(res) ? res : res?.data?.results || res?.data || []))
      .catch(() => {});
  };

  const loadCategories = () => {
    entities.StyleCategory.filter({ is_active: true }, "-created_at", 200)
      .then(res => setCategories(Array.isArray(res) ? res : res?.data?.results || []))
      .catch(() => {});
  };

  const loadSubcategories = (catId) => {
    const filter = catId ? { category_id: catId, is_active: true } : { is_active: true };
    entities.StyleSubCategory.filter(filter, "-created_at", 500)
      .then(res => setSubcategories(Array.isArray(res) ? res : res?.data?.results || []))
      .catch(() => {});
  };

  useEffect(() => {
    refreshList();
    loadCategories();
    loadSubcategories();
    setLoading(false);
    const onFocus = () => { if (document.visibilityState === 'visible') { refreshList(); loadCategories(); } };
    document.addEventListener('visibilitychange', onFocus);
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refreshList(); }, 30000);
    return () => { document.removeEventListener('visibilitychange', onFocus); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (activeTab === "styles") refreshList();
  }, [activeTab]);

  useEffect(() => {
    if (form.category_id) loadSubcategories(form.category_id);
    else loadSubcategories();
  }, [form.category_id]);

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
    setDraftId(null);
    setEditingId(style.id);
    setForm({
      title: style.title || "", description: style.description || "", category: style.category || "",
      subcategory: style.subcategory || "",
      image_url: style.image_url || "", images: style.images || [], video_url: style.video_url || "",
      tags: style.tags || [], produits_utilises: style.produits_utilises || [], outils_utilises: style.outils_utilises || [],
      type_cheveux: style.type_cheveux || "", type_peau: style.type_peau || "", type_prestation: style.type_prestation || "",
      temps_moyen: style.temps_moyen || "", niveau_difficulte: style.niveau_difficulte || "", mots_cles: style.mots_cles || [],
    });
    setCreating(true);
  };

  const deleteStyle = async (id) => {
    if (!confirm("Supprimer ce style ?")) return;
    try { await adminApi.deleteStyle(id); setStyles(prev => prev.filter(s => s.id !== id)); setTimeout(refreshList, 500); }
    catch (err) { alert("Erreur suppression : " + err.message); }
  };

  const saveStyle = async (status) => {
    if (!form.title || !form.image_url) { alert("Titre et image principale requis."); return; }
    setSaving(true);
    clearTimeout(autoSaveTimer.current);
    try {
      let savedStyle;
      const { category_id, subcategory_id, ...cleanForm } = form;
      const payload = { 
        ...cleanForm, 
        status, 
        pro_email: form.pro_email || "admin@beautybook.fr",
        author_email: form.author_email || form.pro_email || "admin@beautybook.fr",
        author_name: form.author_name || "BeautyBook Admin",
        author_avatar: form.author_avatar || form.image_url || "",
      };
      if (editingId) {
        const res = await entities.Style.update(editingId, payload);
        savedStyle = res || { ...form, id: editingId, status };
        setStyles(prev => prev.map(s => s.id === editingId ? savedStyle : s));
      } else if (draftId) {
        const res = await entities.Style.update(draftId, payload);
        savedStyle = res || { ...form, id: draftId, status };
        setStyles(prev => prev.map(s => s.id === draftId ? savedStyle : s));
      } else {
        const res = await entities.Style.create(payload);
        savedStyle = res;
        if (!savedStyle) throw new Error("Création échouée");
        setStyles(prev => [savedStyle, ...prev]);
      }
      setDraftId(null); setEditingId(null); setCreating(false); setForm(EMPTY_FORM); refreshList();
    } catch (err) { alert("Erreur : " + err.message); }
    setSaving(false);
  };

  const addOutil = () => {
    if (!outilsInput.trim()) return;
    updateForm(f => ({ ...f, outils_utilises: [...(f.outils_utilises || []), outilsInput.trim()] }));
    setOutilsInput("");
  };

  const removeOutil = (idx) => {
    updateForm(f => ({ ...f, outils_utilises: f.outils_utilises.filter((_, i) => i !== idx) }));
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    updateForm(f => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }));
    setTagInput("");
  };

  const removeTag = (idx) => {
    updateForm(f => ({ ...f, tags: f.tags.filter((_, i) => i !== idx) }));
  };

  const filtered = styles.filter(s => {
    const matchSearch = !search || s.title?.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || s.category === filterCategory;
    const matchSub = !filterSubCategory || s.subcategory === filterSubCategory;
    return matchSearch && matchCat && matchSub;
  });

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "styles" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 shadow-sm">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un style..." className="flex-1 bg-transparent text-gray-700 text-[13px] outline-none placeholder:text-gray-400" />
            </div>
            <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory(""); }}
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none text-gray-600 shadow-sm">
              <option value="">Toutes catégories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select value={filterSubCategory} onChange={e => setFilterSubCategory(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none text-gray-600 shadow-sm">
              <option value="">Toutes sous-catégories</option>
              {subcategories.filter(s => !filterCategory || categories.find(c => c.name === filterCategory && c.id === s.category_id)).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <button onClick={() => setCreating(v => !v)}
              className="relative flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all shadow-md shadow-primary/20">
              <Plus className="w-4 h-4" /> Nouveau style
            </button>
          </div>

          {creating && (
            <form onSubmit={e => { e.preventDefault(); saveStyle("publie"); }} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-900 text-[15px] font-black">{editingId ? "Modifier le style" : "Créer un style"}</h3>
                {form.title && !editingId && <span className="text-[10px] text-gray-400 font-medium">{draftId ? "Brouillon sauvegardé" : "Sauvegarde auto..."}</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={form.title} onChange={e => updateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Titre du style *" required
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
                <select value={form.category} onChange={e => {
                  const catName = e.target.value;
                  const cat = categories.find(c => c.name === catName);
                  updateForm(f => ({ ...f, category: catName, category_id: cat?.id || "", subcategory: "", subcategory_id: "" }));
                }}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary">
                  <option value="">Catégorie *</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {form.category_id && (
                <select value={form.subcategory} onChange={e => {
                  const subName = e.target.value;
                  const sub = subcategories.find(s => s.name === subName && s.category_id === form.category_id);
                  updateForm(f => ({ ...f, subcategory: subName, subcategory_id: sub?.id || "" }));
                }}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary">
                  <option value="">Sous-catégorie</option>
                  {subcategories.filter(s => s.category_id === form.category_id).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              )}

              <textarea value={form.description} onChange={e => updateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description du style (2-3 lignes)" rows={3}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none" />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Type de cheveux</p>
                  <select value={form.type_cheveux} onChange={e => updateForm(f => ({ ...f, type_cheveux: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary">
                    <option value="">Non spécifié</option>
                    {HAIR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Type de peau</p>
                  <select value={form.type_peau} onChange={e => updateForm(f => ({ ...f, type_peau: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary">
                    <option value="">Non spécifié</option>
                    {SKIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Niveau de difficulté</p>
                  <select value={form.niveau_difficulte} onChange={e => updateForm(f => ({ ...f, niveau_difficulte: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary">
                    <option value="">Non spécifié</option>
                    {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Temps moyen de réalisation</p>
                  <input value={form.temps_moyen} onChange={e => updateForm(f => ({ ...f, temps_moyen: e.target.value }))}
                    placeholder="ex: 45 min, 1h30" className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Type de prestation</p>
                  <input value={form.type_prestation} onChange={e => updateForm(f => ({ ...f, type_prestation: e.target.value }))}
                    placeholder="ex: domicile, salon" className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
                </div>
              </div>

              <div>
                <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest mb-2">Médias (images + vidéo)</p>
                <p className="text-gray-400 text-[10px] mb-2">La première = couverture. Glissez-déposez pour réordonner. 4-8 images recommandées.</p>
                <input ref={imgInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={uploadMedia} />
                <DragDropContext onDragEnd={(result) => { if (!result.destination) return; reorderImages(result.source.index, result.destination.index); }}>
                  <Droppable droppableId="media" direction="horizontal">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-2 flex-wrap mb-3">
                        {form.images.map((url, i) => (
                          <Draggable key={`img-${i}`} draggableId={`img-${i}`} index={i}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} className={`relative group ${snapshot.isDragging ? "z-50 opacity-80" : ""}`}>
                                <div className={`w-20 h-20 rounded-xl overflow-hidden border-2 ${i === 0 ? "border-primary ring-2 ring-primary/20" : "border-gray-200"}`}>
                                  <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                                </div>
                                {i === 0 && <span className="absolute -top-1 -left-1 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">MAIN</span>}
                                <button type="button" onClick={() => removeMedia(i)}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                  <X className="w-3 h-3" />
                                </button>
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
                {uploadError && <p className="text-red-500 text-[11px] mt-2 bg-red-50 rounded-xl px-3 py-2">{uploadError}</p>}
              </div>

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
                      ? <p className="text-gray-400 text-[12px] text-center py-3">Aucun produit</p>
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
                      })}
                  </div>
                )}
              </div>

              <div>
                <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest mb-2">Outils & accessoires</p>
                <div className="flex gap-2 mb-2">
                  <input value={outilsInput} onChange={e => setOutilsInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addOutil())}
                    placeholder="ex: Peigne, Mèches, Fer à lisser..."
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
                  <button type="button" onClick={addOutil} disabled={!outilsInput.trim()}
                    className="bg-gray-800 text-white px-4 rounded-xl text-[13px] font-black active:scale-95 disabled:opacity-40">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {(form.outils_utilises || []).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {form.outils_utilises.map((outil, i) => (
                      <span key={i} className="flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        <Wrench className="w-3 h-3" /> {outil}
                        <button type="button" onClick={() => removeOutil(i)} className="text-blue-300 hover:text-red-400 ml-0.5">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest mb-2">Tags</p>
                <div className="flex gap-2 mb-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Ajouter un tag..."
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
                  <button type="button" onClick={addTag} disabled={!tagInput.trim()}
                    className="bg-gray-800 text-white px-4 rounded-xl text-[13px] font-black active:scale-95 disabled:opacity-40">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {(form.tags || []).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {form.tags.map((tag, i) => (
                      <span key={i} className="flex items-center gap-1 bg-gray-100 text-gray-600 text-[11px] font-bold px-2.5 py-1 rounded-full">
                        #{tag}
                        <button type="button" onClick={() => removeTag(i)} className="text-gray-400 hover:text-red-400 ml-0.5">✕</button>
                      </span>
                    ))}
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
                  Brouillon
                </button>
                <button type="button" onClick={() => { setCreating(false); setEditingId(null); setDraftId(null); setForm(EMPTY_FORM); }}
                  className="bg-gray-100 text-gray-600 py-3 px-4 rounded-xl text-[13px] font-black">Annuler</button>
              </div>
            </form>
          )}

          <p className="text-gray-500 text-[12px]">{filtered.length} style(s)</p>
          <div className="space-y-3">
            {filtered.map(style => (
              <div key={style.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                    {style.image_url
                      ? <img src={style.image_url} alt={style.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Image className="w-5 h-5 text-gray-400" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-[13px] font-black truncate">{style.title}</p>
                    <p className="text-gray-500 text-[11px]">{style.category}{style.subcategory ? ` › ${style.subcategory}` : ""} · {style.pro_email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-gray-400 text-[10px]">❤️ {style.likes || 0}</span>
                      <span className="text-gray-400 text-[10px]">👁 {style.views || 0}</span>
                      {style.temps_moyen && <span className="text-gray-400 text-[10px] flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{style.temps_moyen}</span>}
                      {style.niveau_difficulte && <span className="text-gray-400 text-[10px]">{style.niveau_difficulte}</span>}
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
              </div>
            ))}
            {filtered.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun style trouvé.</p>}
          </div>
        </div>
      )}

      {activeTab === "categories" && <AdminStyleCategories />}
      {activeTab === "subcategories" && <AdminStyleSubCategories />}
      {activeTab === "automation" && <AdminStyleAutomation />}
      {activeTab === "conseils" && <AdminStyleConseils styles={styles} />}
    </div>
  );
}
