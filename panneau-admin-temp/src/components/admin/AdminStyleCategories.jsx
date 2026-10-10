import { useState, useEffect } from "react";
import { entities, ensureDefaultStyleTaxonomy } from "@/api/entities";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, Check, ChevronDown, ChevronUp, Palette } from "lucide-react";

const COLOR_PRESETS = ["#E8732A", "#6366F1", "#EC4899", "#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EF4444", "#14B8A6", "#F97316"];

const generateSlug = (name) => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

export default function AdminStyleCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "#E8732A",
    is_active: true,
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      await ensureDefaultStyleTaxonomy().catch((error) => {
        console.warn("[AdminStyleCategories] taxonomy bootstrap deferred:", error);
      });
      const data = await entities.StyleCategory.list("-created_at", 500);
      setCategories(data);
    } catch (err) {
      console.error("[AdminStyleCategories] load error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setForm({ name: "", slug: "", description: "", icon: "", color: "#E8732A", is_active: true });
    setShowForm(true);
  };

  const openEditForm = (cat) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name || "",
      slug: cat.slug || "",
      description: cat.description || "",
      icon: cat.icon || "",
      color: cat.color || "#E8732A",
      is_active: cat.is_active !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleNameChange = (val) => {
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: editingId ? prev.slug : generateSlug(val),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug || generateSlug(form.name),
        description: form.description.trim(),
        icon: form.icon.trim(),
        color: form.color,
        is_active: form.is_active,
      };

      if (editingId) {
        await entities.StyleCategory.update(editingId, payload);
      } else {
        await entities.StyleCategory.create(payload);
      }

      closeForm();
      await loadCategories();
    } catch (err) {
      console.error("[AdminStyleCategories] save error:", err);
    }
    setSaving(false);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer la catégorie « ${name} » ? Cette action est irréversible.`)) return;
    setSaving(true);
    try {
      await entities.StyleCategory.delete(id);
      await loadCategories();
    } catch (err) {
      console.error("[AdminStyleCategories] delete error:", err);
    }
    setSaving(false);
  };

  const handleToggleActive = async (id, current) => {
    setSaving(true);
    try {
      await entities.StyleCategory.update(id, { is_active: !current });
      await loadCategories();
    } catch (err) {
      console.error("[AdminStyleCategories] toggle error:", err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-black text-gray-900 flex items-center gap-2">
          <Palette className="w-4 h-4" style={{ color: "#E8732A" }} />
          Catégories de styles
        </h3>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-black shadow-md active:scale-95 transition-all"
          style={{ backgroundColor: "#E8732A", color: "#fff", boxShadow: "0 4px 14px rgba(232,115,42,0.25)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Nouvelle catégorie
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[14px] font-black text-gray-900">
              {editingId ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </h4>
            <button onClick={closeForm} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Nom *</label>
              <input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Coiffure, Maquillage..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="coiffure-mariage"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description de la catégorie..."
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Icône (nom lucide)</label>
              <input
                value={form.icon}
                onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                placeholder="Ex: Scissors, Paintbrush..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary"
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Couleur</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer shrink-0"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm((prev) => ({ ...prev, color: c }))}
                      className="w-6 h-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? "#1f2937" : "transparent",
                        transform: form.color === c ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Statut</label>
              <button
                onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-bold border transition-all w-full ${
                  form.is_active
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                {form.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {form.is_active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[14px] font-black shrink-0"
              style={{ backgroundColor: form.color }}
            >
              {form.name ? form.name.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-black text-gray-900 truncate">{form.name || "Nom de la catégorie"}</p>
              <p className="text-[11px] text-gray-400 truncate">{form.description || "Aucune description"}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={closeForm}
              className="px-4 py-2 rounded-xl text-[13px] font-bold bg-gray-100 text-gray-600 active:scale-95 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all"
              style={{ backgroundColor: "#E8732A", boxShadow: "0 4px 14px rgba(232,115,42,0.25)" }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {editingId ? "Mettre à jour" : "Créer"}
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      {categories.length === 0 && !showForm ? (
        <div className="text-center py-10">
          <Palette className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] text-gray-400 font-medium">Aucune catégorie de styles</p>
          <p className="text-[11px] text-gray-300 mt-1">Créez votre première catégorie pour commencer</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Icon circle */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[14px] font-black shrink-0"
                  style={{ backgroundColor: cat.color || "#E8732A" }}
                >
                  {cat.name ? cat.name.charAt(0).toUpperCase() : "?"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black text-gray-900 truncate">{cat.name}</p>
                  {cat.description && (
                    <p className="text-[11px] text-gray-400 font-medium truncate">{cat.description}</p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    {cat.styles_count || 0} styles
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                    {cat.subcategories_count || 0} sous-cat.
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggleActive(cat.id, cat.is_active)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      cat.is_active !== false ? "bg-green-50 hover:bg-green-100" : "bg-gray-100 hover:bg-gray-200"
                    }`}
                    title={cat.is_active !== false ? "Désactiver" : "Activer"}
                  >
                    {cat.is_active !== false ? (
                      <Eye className="w-3 h-3 text-green-500" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditForm(cat)}
                    className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-all"
                  >
                    <Pencil className="w-3 h-3 text-blue-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
                    className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all"
                  >
                    {expandedId === cat.id ? (
                      <ChevronUp className="w-3 h-3 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === cat.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Slug</p>
                      <p className="text-[12px] font-bold text-gray-700">{cat.slug || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Icône</p>
                      <p className="text-[12px] font-bold text-gray-700">{cat.icon || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Créé le</p>
                      <p className="text-[12px] font-bold text-gray-700">
                        {cat.created_at ? new Date(cat.created_at).toLocaleDateString("fr-FR") : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Modifié le</p>
                      <p className="text-[12px] font-bold text-gray-700">
                        {cat.updated_at ? new Date(cat.updated_at).toLocaleDateString("fr-FR") : "—"}
                      </p>
                    </div>
                  </div>
                  {cat.description && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Description</p>
                      <p className="text-[12px] text-gray-600 mt-0.5">{cat.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
