import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';
import { adminApi } from "@/lib/adminApiClient";
import { Plus, X, Upload, Loader2, Check, Pencil, Trash2, ToggleLeft, ToggleRight, Link, ExternalLink, Package, Tag, GripVertical } from "lucide-react";
import AdminBoutiqueBanners from "@/components/admin/AdminBoutiqueBanners";
import AdminBoutiqueCategories, { DEFAULT_BOUTIQUE_CATS, CONFIG_KEY } from "@/components/admin/AdminBoutiqueCategories";

const SHOPIFY_CATEGORY_CONFIG_KEY = "shopify_category_mappings";

const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary transition-colors";

const EMPTY = {
name: "", description: "", price: "", old_price: "",
stock: "", category: "", sub_category: "", brand: "",
image_url: "", images: [], external_url: "",
status: "actif", featured: false, tags: []
};

export default function AdminBoutique() {
  const [products, setProducts] = useState([]);
  const [shopifyProducts, setShopifyProducts] = useState([]);
  const [shopifyCategoryOverrides, setShopifyCategoryOverrides] = useState({});
  const [shopifyCategoryConfigId, setShopifyCategoryConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allCategories, setAllCategories] = useState(DEFAULT_BOUTIQUE_CATS);

  // Charger les catégories dynamiques
  useEffect(() => {
    adminApi.getConfig(CONFIG_KEY)
      .then(res => {
        const rows = res || [];
        if (rows[0]?.value?.categories?.length > 0) setAllCategories(rows[0].value.categories);
      }).catch(() => {});
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editingShopify, setEditingShopify] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const imgRef = useRef(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    const [dbRes, shopifyRes, overrideRes] = await Promise.allSettled([
      adminApi.listProduits().then(res => res || []),
      fetchShopifyProducts({}).then(r => r.data?.products || []),
      adminApi.getConfig(SHOPIFY_CATEGORY_CONFIG_KEY),
    ]);
    setProducts(dbRes.status === "fulfilled" ? dbRes.value : []);
    setShopifyProducts(shopifyRes.status === "fulfilled" ? shopifyRes.value : []);
    if (overrideRes.status === "fulfilled") {
      const rows = Array.isArray(overrideRes.value) ? overrideRes.value : [];
      const row = rows[0];
      setShopifyCategoryConfigId(row?.id || null);
      setShopifyCategoryOverrides(row?.value?.products || row?.value || {});
    }
    setLoading(false);
  };

  const openNew = () => {
    setForm({ ...EMPTY });
    setEditId(null);
    setEditingShopify(false);
    setShowForm(true);
    setTimeout(() => document.getElementById("form-top")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || "", description: p.description || "",
      price: p.price?.toString() || "", old_price: p.old_price?.toString() || "",
      stock: p.stock?.toString() || "", category: p.category || "",
      sub_category: p.sub_category || "",
      brand: p.brand || "", image_url: p.image_url || "",
      images: p.images || [], external_url: p.external_url || "",
      status: p.status || "actif", featured: p.featured || false,
      tags: p.tags || []
    });
    setEditId(p.id);
    setEditingShopify(Boolean(p._shopify));
    setShowForm(true);
    setTimeout(() => document.getElementById("form-top")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const uploadImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({
        ...f,
        image_url: f.image_url || file_url,
        images: [...f.images, file_url]
      }));
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeImage = (i) => {
    setForm(f => {
      const imgs = f.images.filter((_, j) => j !== i);
      return { ...f, images: imgs, image_url: imgs[0] || "" };
    });
  };

  const save = async () => {
    if (!form.name || !form.price || (editingShopify && !editId)) return;
    setSaving(true);
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      old_price: form.old_price ? parseFloat(form.old_price) : null,
      stock: form.stock !== "" ? parseInt(form.stock) : 0,
      category: form.category,
      sub_category: form.sub_category || "",
      brand: form.brand.trim(),
      image_url: form.image_url,
      images: form.images,
      external_url: form.external_url.trim(),
      status: form.status,
      featured: form.featured,
      tags: form.tags,
    };
    if (editingShopify) {
      const nextOverrides = {
        ...shopifyCategoryOverrides,
        [editId]: {
          category: form.category || "",
          sub_category: form.sub_category || "",
          updated_at: new Date().toISOString(),
        },
      };
      if (shopifyCategoryConfigId) {
        await adminApi.updateConfig(shopifyCategoryConfigId, {
          value: nextOverrides,
          description: "Catégories BeautyBook des produits Shopify",
        });
      } else {
        const response = await adminApi.createConfig({
          key: SHOPIFY_CATEGORY_CONFIG_KEY,
          value: nextOverrides,
          description: "Catégories BeautyBook des produits Shopify",
        });
        const created = response?.data?.result || response?.result || response;
        setShopifyCategoryConfigId(created?.id || null);
      }
      setShopifyCategoryOverrides(nextOverrides);
      setShopifyProducts(prev => prev.map(product => product.id === editId
        ? { ...product, category: form.category || "", sub_category: form.sub_category || "" }
        : product));
    } else if (editId) {
      await adminApi.updateProduit(editId, data);
    } else {
      await adminApi.createProduit(data);
    }
    await loadProducts();
    setShowForm(false);
    setEditId(null);
    setEditingShopify(false);
    setForm({ ...EMPTY });
    setSaving(false);
  };

  const toggleStatus = async (p) => {
    const s = p.status === "actif" ? "inactif" : "actif";
    await adminApi.updateProduit(p.id, { status: s });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, status: s } : x));
  };

  const toggleFeatured = async (p) => {
    await adminApi.updateProduit(p.id, { featured: !p.featured });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, featured: !x.featured } : x));
  };

  const deleteProduct = async (id) => {
    if (!confirm("Supprimer ce produit ?")) return;
    await adminApi.deleteProduit(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const allProducts = [
    ...products,
    ...shopifyProducts.map(p => {
      const override = shopifyCategoryOverrides[p.id] || {};
      return {
        ...p,
        image_url: p.img,
        category: override.category ?? p.category ?? "",
        sub_category: override.sub_category ?? p.sub_category ?? "",
        _shopify: true,
      };
    }),
  ];

  const filtered = allProducts.filter(p =>
    !search.trim() ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">

      {/* ── Section Bannières ── */}
      <div>
        <AdminBoutiqueBanners />
      </div>

      <hr className="border-gray-200" />

      {/* ── Section Catégories ── */}
      <div>
        <AdminBoutiqueCategories onSaved={() => {
          adminApi.getConfig(CONFIG_KEY)
            .then(res => {
              const rows = res || [];
              if (rows[0]?.value?.categories?.length > 0) setAllCategories(rows[0].value.categories);
            })
            .catch(() => {});
        }} />
      </div>

      <hr className="border-gray-200" />

      {/* ── Section Produits ── */}
      <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-primary w-64"
          />
          <span className="text-[13px] text-gray-400">{filtered.length} produit(s)</span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl text-[13px] font-black shadow-md shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nouveau produit
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div id="form-top" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-[16px] font-black text-gray-900">{editId ? "Modifier le produit" : "Nouveau produit"}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nom */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Nom du produit *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Sérum Vitamine C 30ml" />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                className={`${inputCls} resize-none`} placeholder="Description détaillée du produit, ingrédients, bénéfices..." />
            </div>

            {/* Prix */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Prix (€) *</label>
              <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inputCls} placeholder="29.99" />
            </div>

            {/* Ancien prix */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Prix barré / Avant promo (€)</label>
              <input type="number" step="0.01" value={form.old_price} onChange={e => setForm(f => ({ ...f, old_price: e.target.value }))} className={inputCls} placeholder="49.99" />
              {form.old_price && form.price && parseFloat(form.old_price) > parseFloat(form.price) && (
                <p className="text-green-600 text-[11px] font-bold mt-1">
                  -{ Math.round((1 - parseFloat(form.price)/parseFloat(form.old_price))*100) }% de réduction
                </p>
              )}
            </div>

            {/* Marque */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Marque / Brand</label>
              <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={inputCls} placeholder="Ex: L'Oréal, Nuxe..." />
            </div>

            {/* Stock */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Stock</label>
              <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className={inputCls} placeholder="100" />
            </div>

            {/* Catégories BeautyBook */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Catégorie BeautyBook</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, sub_category: "" }))} className={inputCls}>
                <option value="">-- Choisir --</option>
                {allCategories.filter(c => c.id !== "tout").map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                {form.category && !allCategories.some(c => c.label === form.category) && (
                  <option value={form.category}>{form.category} (Shopify)</option>
                )}
              </select>
            </div>

            {/* Sous-catégorie */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Sous-catégorie BeautyBook</label>
              <select value={form.sub_category || ""} onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))} className={inputCls}>
                <option value="">-- Aucune --</option>
                {allCategories.find(c => c.label === form.category)?.subs.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {form.sub_category && !allCategories.find(c => c.label === form.category)?.subs.includes(form.sub_category) && (
                  <option value={form.sub_category}>{form.sub_category} (actuelle)</option>
                )}
              </select>
            </div>

            {editingShopify && (
              <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
                Ces catégories sont celles affichées dans BeautyBook. Le produit, son prix et son inventaire restent synchronisés avec Shopify.
              </div>
            )}

            {/* Statut */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Statut</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                <option value="actif">Actif (visible)</option>
                <option value="inactif">Inactif (caché)</option>
              </select>
            </div>

            {/* Lien externe */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5 text-primary" /> Lien externe (au clic → ouvre ce lien)</span>
              </label>
              <input value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} className={inputCls}
                placeholder="https://boutique.com/produit-xyz — lien Shopify, Amazon, etc." />
              <p className="text-[11px] text-gray-400 mt-1">Si renseigné, un clic sur le produit ouvre ce lien au lieu de la page détail.</p>
            </div>

            {/* Mis en avant */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.featured ? "bg-primary" : "bg-gray-200"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.featured ? "left-6" : "left-1"}`} />
                </div>
                <span className="text-[13px] font-bold text-gray-700">Produit mis en avant (vedette)</span>
              </label>
            </div>

            {/* Photos */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Photos du produit</label>
              <p className="text-[11px] text-gray-400 mb-3">La première image sera l'image principale. Glissez pour réordonner.</p>
              <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} />
              {form.images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
                  {form.images.map((url, i) => (
                    <div
                      key={url}
                      draggable
                      onDragStart={e => e.dataTransfer.setData("idx", String(i))}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const from = parseInt(e.dataTransfer.getData("idx"));
                        if (from === i) return;
                        setForm(f => {
                          const imgs = [...f.images];
                          const [moved] = imgs.splice(from, 1);
                          imgs.splice(i, 0, moved);
                          return { ...f, images: imgs, image_url: imgs[0] || "" };
                        });
                      }}
                      className="relative group cursor-grab active:cursor-grabbing rounded-xl overflow-hidden border-2 border-gray-200 hover:border-primary transition-all aspect-square"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">MAIN</span>
                      )}
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <div className="w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                          <GripVertical className="w-3 h-3 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                      <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        {i + 1}/{form.images.length}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => imgRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-400 text-[13px] hover:border-primary hover:text-primary transition-all"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Téléchargement..." : "Cliquer pour ajouter des photos"}
              </button>
            </div>
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={save}
              disabled={saving || !form.name || !form.price}
              className="flex-1 bg-primary text-white py-3.5 rounded-xl text-[14px] font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/30"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editId ? "Sauvegarder les modifications" : "Créer le produit"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-6 bg-gray-100 text-gray-600 py-3.5 rounded-xl text-[14px] font-black hover:bg-gray-200 transition-all">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Products list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Package className="w-14 h-14 text-gray-200" />
          <p className="text-gray-400 text-[14px] font-medium">Aucun produit. Cliquez sur "Nouveau produit" pour commencer.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Catégorie</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Prix</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Lien</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {p.image_url
                          ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                          : <Package className="w-5 h-5 text-gray-300 m-3.5" />
                        }
                      </div>
                      <div>
                        <p className="font-black text-gray-900 leading-tight">{p.name}</p>
                        {p.brand && <p className="text-[11px] text-gray-400 font-medium">{p.brand}</p>}
                        {p._shopify && <span className="inline-block text-[9px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full mt-0.5">SHOPIFY</span>}
                        {p.featured && <span className="inline-block text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-0.5">★ EN VEDETTE</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="bg-gray-100 text-gray-600 text-[11px] font-black px-2.5 py-1 rounded-full">{p.category || p.brand || "—"}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-black text-gray-900">{p.price}€</p>
                    {p.old_price && <p className="text-[11px] text-gray-400 line-through">{p.old_price}€</p>}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    {p._shopify
                      ? <span className="text-green-600 text-[11px] font-bold">Shopify</span>
                      : p.external_url
                      ? <a href={p.external_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-primary text-[11px] font-bold hover:underline"
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3.5 h-3.5" /> Lien actif
                        </a>
                      : <span className="text-gray-300 text-[11px]">—</span>
                    }
                  </td>
                  <td className="px-4 py-4">
                    {p._shopify
                      ? <span className="bg-green-100 text-green-700 text-[11px] font-black px-3 py-1.5 rounded-full">Actif</span>
                      : <button onClick={() => toggleStatus(p)}
                          className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full transition-all ${
                            p.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                          {p.status === "actif" ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {p.status === "actif" ? "Actif" : "Inactif"}
                        </button>
                    }
                  </td>
                  <td className="px-4 py-4">
                    {p._shopify
                      ? <button onClick={() => openEdit(p)} className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-all" title="Modifier les catégories BeautyBook">
                          <Pencil className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                      : <div className="flex items-center gap-2">
                          <button onClick={() => toggleFeatured(p)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${p.featured ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                            title="Mettre en vedette">
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(p)} className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-all">
                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                          </button>
                          <button onClick={() => deleteProduct(p.id)} className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
