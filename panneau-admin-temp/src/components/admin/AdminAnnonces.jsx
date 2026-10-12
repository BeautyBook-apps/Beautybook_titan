import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { uploadFile } from "@/api/entities";
import {
  Check,
  CheckSquare,
  Eye,
  EyeOff,
  Grid2X2,
  LayoutList,
  Loader2,
  MonitorPlay,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const EMPTY_FORM = {
  title: "",
  sponsor_name: "",
  sponsor_logo: "",
  image_url: "",
  video_url: "",
  cta_label: "En savoir plus",
  cta_url: "",
  type: "feed",
  status: "actif",
  start_date: "",
  end_date: "",
};

const VIEW_MODES = [
  { id: "list", label: "Liste", Icon: LayoutList },
  { id: "compact", label: "Compact", Icon: CheckSquare },
  { id: "grid", label: "Galerie", Icon: Grid2X2 },
];

const formFromAnnonce = (annonce) => ({
  ...EMPTY_FORM,
  title: annonce?.title || "",
  sponsor_name: annonce?.sponsor_name || "",
  sponsor_logo: annonce?.sponsor_logo || "",
  image_url: annonce?.image_url || "",
  video_url: annonce?.video_url || "",
  cta_url: annonce?.target_url || annonce?.cta_url || "",
  type: annonce?.type || "feed",
  status: annonce?.status || "actif",
  start_date: annonce?.start_date ? String(annonce.start_date).slice(0, 10) : "",
  end_date: annonce?.end_date ? String(annonce.end_date).slice(0, 10) : "",
});

function AdMedia({ annonce, className = "w-full h-full object-cover", controls = false }) {
  if (annonce?.video_url) {
    return <video src={annonce.video_url} className={className} muted playsInline preload="metadata" controls={controls} />;
  }
  if (annonce?.image_url) return <img src={annonce.image_url} alt={annonce.title || "Annonce"} className={className} />;
  return <div className={`${className} flex items-center justify-center text-2xl`}>📢</div>;
}

export default function AdminAnnonces() {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewAnnonce, setPreviewAnnonce] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem("bb_admin_annonces_view") || "list"; } catch { return "list"; }
  });
  const imgInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    adminApi.listAnnonces()
      .then((items) => setAnnonces(Array.isArray(items) ? items : []))
      .catch((err) => setError(err?.message || "Impossible de charger les annonces."))
      .finally(() => setLoading(false));
  }, []);

  const selectedAnnonces = useMemo(
    () => annonces.filter((annonce) => selectedIds.has(annonce.id)),
    [annonces, selectedIds],
  );
  const allSelected = annonces.length > 0 && selectedAnnonces.length === annonces.length;

  const setMode = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem("bb_admin_annonces_view", mode); } catch {}
  };

  const openCreate = () => {
    setError("");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCreating(true);
  };

  const openEdit = (annonce) => {
    setError("");
    setEditingId(annonce.id);
    setForm(formFromAnnonce(annonce));
    setCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeEditor = () => {
    if (saving || uploadingMedia) return;
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const uploadMedia = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setUploadingMedia(true);
    try {
      const { file_url } = await uploadFile({ file });
      if (file.type?.startsWith("video/")) {
        setForm((current) => ({ ...current, video_url: file_url, image_url: "" }));
      } else {
        setForm((current) => ({ ...current, image_url: file_url, video_url: "" }));
      }
    } catch (err) {
      console.error("[AdminAnnonces] Upload error:", err);
      setError(err?.message || "Le média n'a pas pu être envoyé.");
    }
    setUploadingMedia(false);
    e.target.value = "";
  };

  const uploadSponsorLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setUploadingMedia(true);
    try {
      if (!file.type?.startsWith("image/")) throw new Error("Le logo doit être une image.");
      const { file_url } = await uploadFile({ file });
      setForm((current) => ({ ...current, sponsor_logo: file_url }));
    } catch (err) {
      console.error("[AdminAnnonces] Sponsor logo upload error:", err);
      setError(err?.message || "Le logo n'a pas pu être envoyé.");
    }
    setUploadingMedia(false);
    e.target.value = "";
  };

  const toggleStatus = async (annonce) => {
    setError("");
    try {
      const updated = await adminApi.toggleAnnonceStatus(annonce.id);
      setAnnonces((current) => current.map((item) => item.id === annonce.id ? { ...item, status: updated.status } : item));
    } catch (err) {
      setError(err?.message || "Impossible de modifier le statut.");
    }
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    sponsor_name: form.sponsor_name.trim(),
    sponsor_logo: form.sponsor_logo || null,
    image_url: form.image_url || null,
    video_url: form.video_url || null,
    type: form.type,
    status: form.status,
    target_url: form.cta_url.trim() || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
  });

  const saveAnnonce = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.sponsor_name.trim() || (!form.image_url && !form.video_url)) {
      setError("Renseignez le titre, le sponsor et un média.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      if (editingId) {
        const updated = await adminApi.updateAnnonce(editingId, payload);
        setAnnonces((current) => current.map((annonce) => annonce.id === editingId ? { ...annonce, ...updated } : annonce));
      } else {
        const created = await adminApi.createAnnonce(payload);
        setAnnonces((current) => [created, ...current]);
      }
      closeEditor();
    } catch (err) {
      setError(err?.message || "Impossible d'enregistrer cette annonce.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(annonces.map((annonce) => annonce.id)));
  };

  const requestDelete = (ids) => {
    const normalizedIds = Array.isArray(ids) ? ids : [ids];
    if (!normalizedIds.length) return;
    setConfirmAction({ type: "delete", ids: normalizedIds });
  };

  const confirmDelete = async () => {
    if (!confirmAction?.ids?.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(confirmAction.ids.map((id) => adminApi.deleteAnnonce(id)));
      setAnnonces((current) => current.filter((annonce) => !confirmAction.ids.includes(annonce.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        confirmAction.ids.forEach((id) => next.delete(id));
        return next;
      });
      setConfirmAction(null);
    } catch (err) {
      setError(err?.message || "Impossible de supprimer une ou plusieurs annonces.");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkStatus = async (status) => {
    if (!selectedAnnonces.length) return;
    setBulkBusy(true);
    setError("");
    try {
      const updated = await Promise.all(selectedAnnonces.map((annonce) => adminApi.updateAnnonce(annonce.id, { status })));
      const updates = new Map(updated.map((annonce) => [annonce.id, annonce]));
      setAnnonces((current) => current.map((annonce) => updates.has(annonce.id) ? { ...annonce, ...updates.get(annonce.id), status } : annonce));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err?.message || "Impossible de modifier les annonces sélectionnées.");
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={creating ? closeEditor : openCreate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all">
          {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {creating ? "Fermer l'éditeur" : "Nouvelle annonce"}
        </button>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {VIEW_MODES.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setMode(id)} title={`Affichage ${label.toLowerCase()}`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black transition-colors ${viewMode === id ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-[12px]">
          <span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {creating && (
        <form onSubmit={saveAnnonce} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3 shadow-sm">
          <h3 className="text-gray-900 text-[14px] font-black">{editingId ? "Modifier l'annonce" : "Créer une annonce"}</h3>

          <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            placeholder="Titre *" required
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <input value={form.sponsor_name} onChange={(e) => setForm((current) => ({ ...current, sponsor_name: e.target.value }))}
            placeholder="Nom du sponsor *" required
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-gray-700 text-[12px] font-black mb-2">Logo de l’entreprise (optionnel)</p>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadSponsorLogo} />
            {form.sponsor_logo ? (
              <div className="flex items-center gap-3">
                <img src={form.sponsor_logo} alt="Logo du sponsor" className="w-12 h-12 rounded-full object-cover border border-gray-200 bg-white" />
                <span className="text-green-600 text-[12px] flex-1">✓ Logo prêt</span>
                <button type="button" onClick={() => setForm((current) => ({ ...current, sponsor_logo: "" }))} className="text-gray-400 text-[11px]">Retirer</button>
              </div>
            ) : (
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingMedia}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-gray-500 text-[12px] hover:border-primary transition-all disabled:opacity-50">
                {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Ajouter le logo de l’entreprise
              </button>
            )}
            <input value={form.sponsor_logo} onChange={(e) => setForm((current) => ({ ...current, sponsor_logo: e.target.value }))}
              placeholder="Ou coller l’URL du logo"
              className="mt-2 w-full bg-white border border-gray-200 text-gray-800 rounded-xl px-4 py-2.5 text-[12px] outline-none focus:border-primary" />
          </div>

          <div>
            <input ref={imgInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadMedia} />
            {form.video_url ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <video src={form.video_url} className="w-12 h-12 rounded-lg object-cover shrink-0" muted playsInline preload="metadata" />
                <span className="text-green-600 text-[12px] flex-1">✓ Vidéo prête</span>
                <button type="button" onClick={() => setForm((current) => ({ ...current, image_url: "", video_url: "" }))} className="text-gray-400 text-[11px]">Changer</button>
              </div>
            ) : form.image_url ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <img src={form.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <span className="text-green-600 text-[12px] flex-1">✓ Image prête</span>
                <button type="button" onClick={() => setForm((current) => ({ ...current, image_url: "", video_url: "" }))} className="text-gray-400 text-[11px]">Changer</button>
              </div>
            ) : (
              <button type="button" onClick={() => imgInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-4 text-gray-400 text-[13px] hover:border-primary transition-all">
                {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingMedia ? "Upload..." : "Choisir une image ou vidéo *"}
              </button>
            )}
            <input value={form.video_url} onChange={(e) => setForm((current) => ({ ...current, video_url: e.target.value, image_url: e.target.value ? "" : current.image_url }))}
              placeholder="URL vidéo (optionnel, https://...mp4)"
              className="mt-2 w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none">
              <option value="feed">Feed Réels</option>
              <option value="story">Story</option>
              <option value="banner">Bannière Services</option>
              <option value="banner_styles">Bannière Styles</option>
            </select>
            <select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none">
              <option value="actif">Actif</option>
              <option value="pause">Pausé</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-gray-600 text-[11px] font-bold">Début de diffusion
              <input type="date" value={form.start_date} onChange={(e) => setForm((current) => ({ ...current, start_date: e.target.value }))}
                className="mt-1 w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-primary" />
            </label>
            <label className="text-gray-600 text-[11px] font-bold">Fin de diffusion
              <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => setForm((current) => ({ ...current, end_date: e.target.value }))}
                className="mt-1 w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-primary" />
            </label>
          </div>

          <input value={form.cta_url} onChange={(e) => setForm((current) => ({ ...current, cta_url: e.target.value }))}
            placeholder="Lien CTA (ex: https://...)"
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary" />

          <div className="flex gap-3">
            <button type="submit" disabled={saving || uploadingMedia}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : editingId ? "Enregistrer les modifications" : "Créer →"}
            </button>
            <button type="button" onClick={closeEditor} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-500 text-[12px]">{annonces.length} annonce(s)</p>
        {annonces.length > 0 && (
          <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-gray-600 text-[12px] font-bold hover:text-primary">
            {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <span className="w-4 h-4 rounded border border-gray-300" />}
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>

      {selectedAnnonces.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-3">
          <span className="text-[12px] font-black mr-auto">{selectedAnnonces.length} sélectionnée(s)</span>
          <button type="button" disabled={bulkBusy} onClick={() => bulkStatus("actif")} className="flex items-center gap-1.5 bg-green-500/20 text-green-200 rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-50"><Play className="w-3.5 h-3.5" /> Activer</button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkStatus("pause")} className="flex items-center gap-1.5 bg-white/10 text-gray-200 rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-50"><Pause className="w-3.5 h-3.5" /> Mettre en pause</button>
          <button type="button" disabled={bulkBusy} onClick={() => requestDelete(selectedAnnonces.map((annonce) => annonce.id))} className="flex items-center gap-1.5 bg-red-500/20 text-red-200 rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Supprimer</button>
        </div>
      )}

      <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-3"}>
        {annonces.map((annonce) => (
          <div key={annonce.id} className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${viewMode === "grid" ? "p-3" : "p-4 flex items-center gap-4"}`}>
            <div className={`${viewMode === "grid" ? "w-full h-44 mb-3" : viewMode === "compact" ? "w-10 h-10" : "w-14 h-14"} rounded-xl overflow-hidden bg-gray-100 shrink-0`}>
              <AdMedia annonce={annonce} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => toggleSelected(annonce.id)} aria-label={selectedIds.has(annonce.id) ? "Désélectionner" : "Sélectionner"}
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center ${selectedIds.has(annonce.id) ? "bg-primary border-primary text-white" : "border-gray-300 text-transparent"}`}>
                  <Check className="w-3.5 h-3.5" />
                </button>
                <div className="min-w-0">
                  <p className="text-gray-900 text-[13px] font-black truncate">{annonce.title}</p>
                  <p className="text-gray-500 text-[11px] truncate">{annonce.sponsor_name} · {annonce.type}</p>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${annonce.status === "actif" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                    {annonce.status === "actif" ? "Actif" : "Pausé"}
                  </span>
                </div>
              </div>
            </div>
            <div className={`flex items-center gap-2 shrink-0 ${viewMode === "grid" ? "mt-3" : ""}`}>
              <button type="button" onClick={() => setPreviewAnnonce(annonce)} title="Prévisualiser" className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center active:scale-95"><MonitorPlay className="w-4 h-4 text-blue-600" /></button>
              <button type="button" onClick={() => openEdit(annonce)} title="Modifier" className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center active:scale-95"><Pencil className="w-4 h-4 text-primary" /></button>
              <button type="button" onClick={() => toggleStatus(annonce)} title={annonce.status === "actif" ? "Mettre en pause" : "Activer"} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95">
                {annonce.status === "actif" ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-green-500" />}
              </button>
              <button type="button" onClick={() => requestDelete(annonce.id)} title="Supprimer" className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-95"><Trash2 className="w-4 h-4 text-red-500" /></button>
            </div>
          </div>
        ))}
        {annonces.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucune annonce.</p>}
      </div>

      {previewAnnonce && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Prévisualisation de l'annonce">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-4">
            <button type="button" onClick={() => setPreviewAnnonce(null)} aria-label="Fermer la prévisualisation" className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
            <div className="aspect-[9/14] max-h-[65vh] rounded-xl overflow-hidden bg-gray-100"><AdMedia annonce={previewAnnonce} className="w-full h-full object-contain bg-black" controls /></div>
            <div className="pt-3 px-1">
              <p className="text-gray-900 font-black">{previewAnnonce.title}</p>
              <p className="text-gray-500 text-[12px]">{previewAnnonce.sponsor_name} · {previewAnnonce.type}</p>
              {previewAnnonce.target_url && <a href={previewAnnonce.target_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-primary text-white rounded-xl px-4 py-2 text-[12px] font-black">En savoir plus</a>}
              <button type="button" onClick={() => { setPreviewAnnonce(null); openEdit(previewAnnonce); }} className="mt-3 ml-2 inline-flex items-center gap-2 bg-gray-100 text-gray-700 rounded-xl px-4 py-2 text-[12px] font-black"><Pencil className="w-3.5 h-3.5" /> Modifier</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction?.type === "delete" && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Confirmation de suppression">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4"><Trash2 className="w-5 h-5" /></div>
            <h3 className="text-gray-900 text-lg font-black">Supprimer cette annonce ?</h3>
            <p className="text-gray-500 text-[13px] mt-2">{confirmAction.ids.length > 1 ? `${confirmAction.ids.length} annonces seront supprimées définitivement.` : "Cette annonce sera supprimée définitivement."}</p>
            <div className="flex gap-3 mt-6">
              <button type="button" disabled={bulkBusy} onClick={() => setConfirmAction(null)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-[13px] font-black disabled:opacity-50">Annuler</button>
              <button type="button" disabled={bulkBusy} onClick={confirmDelete} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-[13px] font-black flex items-center justify-center gap-2 disabled:opacity-60">{bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Oui, supprimer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
