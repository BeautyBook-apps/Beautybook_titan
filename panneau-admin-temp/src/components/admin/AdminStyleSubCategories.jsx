import { useState, useEffect } from "react";
import { entities, ensureDefaultStyleTaxonomy } from "@/api/entities";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Check, ChevronDown, ChevronUp, Tag } from "lucide-react";

const generateSlug = (str) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const EMPTY_FORM = { name: "", slug: "", category_id: "", description: "", is_active: true, styles_count: 0 };

export default function AdminStyleSubCategories() {
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filterCategory, setFilterCategory] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      await ensureDefaultStyleTaxonomy().catch((error) => {
        console.warn("[AdminStyleSubCategories] taxonomy bootstrap deferred:", error);
      });
      const [subs, cats] = await Promise.all([
        entities.StyleSubCategory.filter({}, "-created_at", 1000),
        entities.StyleCategory.filter({}, "-created_at", 500),
      ]);
      setSubcategories(Array.isArray(subs) ? subs : subs?.data?.results || []);
      setCategories(Array.isArray(cats) ? cats : cats?.data?.results || []);
    } catch (err) {
      console.error("[AdminStyleSubCategories] Load error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getCategoryName = (categoryId) =>
    categories.find(c => c.id === categoryId)?.name || "—";

  const updateForm = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "name") next.slug = generateSlug(value);
      return next;
    });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (sub) => {
    setEditingId(sub.id);
    setForm({
      name: sub.name || "",
      slug: sub.slug || "",
      category_id: sub.category_id || "",
      description: sub.description || "",
      is_active: sub.is_active !== false,
      styles_count: sub.styles_count || 0,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const save = async () => {
    if (!form.name.trim() || !form.category_id) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug || generateSlug(form.name),
        category_id: form.category_id,
        description: form.description.trim(),
        is_active: form.is_active,
      };
      if (editingId) {
        await entities.StyleSubCategory.update(editingId, payload);
      } else {
        await entities.StyleSubCategory.create(payload);
      }
      closeForm();
      await loadData();
    } catch (err) {
      console.error("[AdminStyleSubCategories] Save error:", err);
    }
    setSaving(false);
  };

  const toggleActive = async (sub) => {
    try {
      await entities.StyleSubCategory.update(sub.id, { is_active: !sub.is_active });
      await loadData();
    } catch (err) {
      console.error("[AdminStyleSubCategories] Toggle error:", err);
    }
  };

  const deleteSub = async (id) => {
    try {
      await entities.StyleSubCategory.delete(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (err) {
      console.error("[AdminStyleSubCategories] Delete error:", err);
    }
  };

  const filtered = filterCategory
    ? subcategories.filter(s => s.category_id === filterCategory)
    : subcategories;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-[15px] font-black text-gray-900 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" /> Sous-catégories de styles
        </h3>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-[13px] font-black shadow-md shadow-primary/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Nouvelle sous-catégorie
        </button>
      </div>

      {/* Filtre par catégorie */}
      {categories.length > 0 && (
        <div className="relative">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] font-medium text-gray-700 outline-none focus:border-primary appearance-none"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* Formulaire création/édition */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-900 text-[15px] font-black">
              {editingId ? "Modifier la sous-catégorie" : "Nouvelle sous-catégorie"}
            </h3>
            <button onClick={closeForm} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.name}
              onChange={e => updateForm("name", e.target.value)}
              placeholder="Nom de la sous-catégorie *"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary"
            />
            <input
              value={form.slug}
              onChange={e => updateForm("slug", e.target.value)}
              placeholder="slug"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary text-gray-500"
            />
          </div>

          <div className="relative">
            <select
              value={form.category_id}
              onChange={e => updateForm("category_id", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary appearance-none text-gray-700"
            >
              <option value="">Choisir une catégorie *</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <textarea
            value={form.description}
            onChange={e => updateForm("description", e.target.value)}
            placeholder="Description (optionnel)"
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none"
          />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => updateForm("is_active", e.target.checked)}
                className="sr-only"
              />
              <div className={`w-9 h-5 rounded-full transition-all ${form.is_active ? "bg-primary" : "bg-gray-300"}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all mt-0.5 ${form.is_active ? "ml-[18px]" : "ml-0.5"}`} />
              </div>
              <span className="text-[13px] font-medium text-gray-600">{form.is_active ? "Active" : "Inactive"}</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !form.name.trim() || !form.category_id}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[13px] font-black shadow-md shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {editingId ? "Mettre à jour" : "Créer"}
            </button>
            <button
              onClick={closeForm}
              className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl text-[13px] font-black active:scale-95 transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <Tag className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-gray-400">
            {filterCategory ? "Aucune sous-catégorie pour cette catégorie" : "Aucune sous-catégorie de style"}
          </p>
          <button
            onClick={openAdd}
            className="mt-3 text-primary text-[13px] font-black hover:underline"
          >
            + Créer une sous-catégorie
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => (
            <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-900 text-[13px] font-black truncate">{sub.name}</p>
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {getCategoryName(sub.category_id)}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {sub.styles_count || 0} style{(sub.styles_count || 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {sub.description && (
                    <p className="text-gray-500 text-[12px] mt-1 truncate">{sub.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(sub)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all ${
                      sub.is_active !== false ? "bg-green-50" : "bg-gray-100"
                    }`}
                    title={sub.is_active !== false ? "Désactiver" : "Activer"}
                  >
                    {sub.is_active !== false
                      ? <Eye className="w-4 h-4 text-green-500" />
                      : <EyeOff className="w-4 h-4 text-gray-400" />}
                  </button>

                  <button
                    onClick={() => openEdit(sub)}
                    className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4 text-blue-500" />
                  </button>

                  {confirmDeleteId === sub.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteSub(sub.id)}
                        className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                        title="Confirmer"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                        title="Annuler"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(sub.id)}
                      className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
