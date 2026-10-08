import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';
import { adminApi } from "@/lib/adminApiClient";
import { Plus, Trash2, Upload, Loader2, X, Home, Eye, EyeOff, MapPin, Euro, Phone, Mail, AlertCircle, CheckCircle2, FileText, Clock, Save, Scissors, Building2, Receipt, Edit3 } from "lucide-react";
import AddressInput from "@/components/ui/AddressInput";

const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary transition-colors";
const labelCls = "text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1";
const DRAFT_KEY = "bb_immobilier_draft";
const DRAFTS_LIST_KEY = "bb_immobilier_drafts";

const SALON_TYPES = [
  { value: "salon_de_beaute", label: "Salon de beauté" },
  { value: "salon_de_coiffure", label: "Salon de coiffure" },
  { value: "salon_manucure", label: "Salon de manucure / pédicure" },
  { value: "institut_de_beaute", label: "Institut de beauté" },
  { value: "barbier", label: "Barbier" },
  { value: "spa", label: "Spa / Hammam" },
  { value: "tattoo", label: "Studio de tattoo / piercing" },
  { value: "autre", label: "Autre" },
];

const EMPTY_FORM = {
  title: "", description: "", type: "location",
  price: "", price_fonds_commerce: "", price_per_m2: "",
  tax_mode: "TTC",
  salon_type: "",
  surface: "", rooms: "", floor: "",
  location: "", city: "", area: "", postal_code: "",
  equip: "", extra: "",
  images: [], video_url: "",
  contact_email: "", contact_phone: "", status: "actif",
};

function saveDraft(form) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
function saveDraftToList(form) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFTS_LIST_KEY) || "[]");
    const draft = { ...form, _draftId: Date.now(), _draftDate: new Date().toLocaleString("fr-FR") };
    drafts.unshift(draft);
    localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(drafts.slice(0, 20)));
  } catch {}
}
function loadDraftsList() {
  try { return JSON.parse(localStorage.getItem(DRAFTS_LIST_KEY) || "[]"); } catch { return []; }
}
function deleteDraftFromList(draftId) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFTS_LIST_KEY) || "[]");
    localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(drafts.filter(d => d._draftId !== draftId)));
  } catch {}
}

export default function AdminImmobilier() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(() => loadDraft() || { ...EMPTY_FORM });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [drafts, setDrafts] = useState(() => loadDraftsList());
  const [activeTab, setActiveTab] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    adminApi.listImmobilier()
      .then(res => setListings(Array.isArray(res) ? res : res?.data?.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (creating && (form.title || form.description || form.price)) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => saveDraft(form), 1000);
    }
  }, [form, creating]);

  useEffect(() => {
    if (creating) {
      const draft = loadDraft();
      if (draft && draft.title) setForm(draft);
    }
  }, [creating]);

  const handleFileUpload = async (e, isVideo = false) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const { file_url } = await uploadFile({ file });
      if (isVideo) setForm(f => ({ ...f, video_url: file_url }));
      else setForm(f => ({ ...f, images: [...f.images, file_url] }));
    } catch (err) { console.error("Upload error:", err); }
    setUploading(false);
    e.target.value = "";
  };

  const removeImage = (idx) => setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const computePricePerM2 = (price, surface) => {
    const p = parseFloat(price);
    const s = parseFloat(surface);
    if (p > 0 && s > 0) return Math.round(p / s);
    return "";
  };

  const createListing = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price) {
      setError("Le titre et le prix sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
      const toInt = (v) => { const n = parseInt(v); return isNaN(n) ? 0 : n; };
      const payload = {
        title: form.title || "",
        description: form.description || "",
        type: form.type || "location",
        price: toNum(form.price),
        price_fonds_commerce: toNum(form.price_fonds_commerce),
        price_per_m2: toNum(form.price_per_m2) || computePricePerM2(form.price, form.surface) || 0,
        tax_mode: form.type === "location" ? (form.tax_mode || "TTC") : null,
        salon_type: form.salon_type || "",
        surface: toNum(form.surface),
        rooms: toInt(form.rooms),
        floor: form.floor || "",
        location: form.location || "",
        city: form.city || "",
        area: toNum(form.area),
        postal_code: form.postal_code || "",
        equip: form.equip || "",
        extra: form.extra || "",
        images: form.images || [],
        video_url: form.video_url || "",
        contact_email: form.contact_email || "",
        contact_phone: form.contact_phone || "",
        status: form.status || "actif",
        latitude: form._lat || null,
        longitude: form._lng || null,
      };
      const result = editingId
        ? await adminApi.updateImmobilier(editingId, payload)
        : await adminApi.createImmobilier(payload);
      const newItem = result?.data ? result.data : result;
      setListings(prev => editingId
        ? prev.map(item => item.id === editingId ? { ...item, ...newItem } : item)
        : [newItem, ...prev]);
      setCreating(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      clearDraft();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error("[AdminImmobilier] Create error:", err);
      setError("Erreur lors de la création : " + (err.message || "Erreur inconnue"));
    }
    setSaving(false);
  };

  const saveAsDraft = () => {
    saveDraftToList(form);
    setDrafts(loadDraftsList());
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const loadDraftToForm = (draft) => {
    setForm({ ...EMPTY_FORM, ...draft });
    setCreating(true);
  };

  const removeDraft = (draftId) => {
    deleteDraftFromList(draftId);
    setDrafts(loadDraftsList());
  };

  const toggleStatus = async (listing) => {
    const newStatus = listing.status === "actif" ? "loue" : "actif";
    try {
      await adminApi.updateImmobilier(listing.id, { status: newStatus });
      setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l));
    } catch (err) { console.error("[AdminImmobilier] Toggle error:", err); }
  };

  const editListing = (listing) => {
    setEditingId(listing.id);
    setForm({
      ...EMPTY_FORM,
      ...listing,
      price: listing.price ?? "",
      price_fonds_commerce: listing.price_fonds_commerce ?? "",
      price_per_m2: listing.price_per_m2 ?? "",
      surface: listing.surface ?? "",
      rooms: listing.rooms ?? "",
      images: Array.isArray(listing.images) ? listing.images : [],
      video_url: listing.video_url || "",
    });
    setError("");
    setCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteListing = async (id) => {
    if (!confirm("Êtes-vous vraiment sûr de vouloir supprimer cette annonce immobilière ? Cette action est définitive.")) return;
    try {
      await adminApi.deleteImmobilier(id);
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (err) { console.error("[AdminImmobilier] Delete error:", err); }
  };

  const isVente = form.type === "vente";

  const filteredListings = activeTab === "all" ? listings
    : activeTab === "vente" ? listings.filter(l => l.type === "vente")
    : listings.filter(l => l.type === "location");

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-[12px] text-red-600 font-bold flex-1">{error}</p>
          <button onClick={() => setError("")}><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-[12px] text-green-600 font-bold">Enregistré avec succès !</p>
        </div>
      )}

      <button onClick={() => { setCreating(v => !v); setError(""); }}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black active:scale-95 transition-all shadow-lg shadow-primary/20">
        <Plus className="w-4 h-4" /> Nouvelle annonce immobilière
      </button>

      {creating && (
        <form onSubmit={createListing} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-900 text-[15px] font-black">{editingId ? "Modifier l'annonce" : "Créer une annonce"}</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" /> Sauvegarde auto
            </div>
          </div>

          {/* ── Titre ── */}
          <div>
            <label className={labelCls}>Titre de l'annonce *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Salon de coiffure 80m² — Paris 15e" required className={inputCls} />
          </div>

          {/* ── Type de transaction ── */}
          <div>
            <label className={labelCls}>Type de transaction *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, type: "location", unit: "/MOIS" }))}
                className={`py-3 rounded-xl text-[13px] font-black border-2 transition-all active:scale-95 ${
                  !isVente ? "border-primary bg-primary text-white shadow-md shadow-primary/20" : "border-gray-200 bg-white text-gray-500"
                }`}>
                Location
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, type: "vente", unit: "" }))}
                className={`py-3 rounded-xl text-[13px] font-black border-2 transition-all active:scale-95 ${
                  isVente ? "border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/20" : "border-gray-200 bg-white text-gray-500"
                }`}>
                Vente
              </button>
            </div>
          </div>

          {/* ── Type de salon (vente uniquement) ── */}
          {isVente && (
            <div className="bg-blue-50 rounded-2xl p-4 space-y-3 border border-blue-100">
              <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5" /> Type de salon
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {SALON_TYPES.map(st => (
                  <button key={st.value} type="button" onClick={() => setForm(f => ({ ...f, salon_type: st.value }))}
                    className={`py-2.5 px-3 rounded-xl text-[12px] font-bold border transition-all text-left ${
                      form.salon_type === st.value
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                    }`}>
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Description ── */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={isVente ? "Décrivez le fonds de commerce, l'emplacement, la clientèle..." : "Décrivez le local, les conditions de location..."}
              rows={3} className={`${inputCls} resize-none`} />
          </div>

          {/* ── Prix (vente) ── */}
          {isVente && (
            <div className="bg-blue-50 rounded-2xl p-4 space-y-3 border border-blue-100">
              <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5" /> Prix de vente
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prix de vente (€) *</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Ex: 120000" required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fonds de commerce (€)</label>
                  <input type="number" value={form.price_fonds_commerce} onChange={e => setForm(f => ({ ...f, price_fonds_commerce: e.target.value }))}
                    placeholder="Ex: 45000" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Surface (m²)</label>
                  <input type="number" value={form.surface} onChange={e => {
                    const s = e.target.value;
                    setForm(f => {
                      const updated = { ...f, surface: s };
                      if (f.price && s) updated.price_per_m2 = Math.round(parseFloat(f.price) / parseFloat(s));
                      return updated;
                    });
                  }} placeholder="Ex: 80" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Prix au m² (€)</label>
                  <input type="number" value={form.price_per_m2} onChange={e => setForm(f => ({ ...f, price_per_m2: e.target.value }))}
                    placeholder="Calculé auto" className={inputCls} readOnly={!form.price_per_m2} />
                </div>
              </div>
            </div>
          )}

          {/* ── Loyer (location) ── */}
          {!isVente && (
            <div className="bg-purple-50 rounded-2xl p-4 space-y-3 border border-purple-100">
              <h4 className="text-[11px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5" /> Loyer
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Loyer mensuel (€) *</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Ex: 1200" required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Taxe</label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setForm(f => ({ ...f, tax_mode: "HT" }))}
                      className={`flex-1 py-3 rounded-xl text-[12px] font-black border transition-all ${
                        form.tax_mode === "HT" ? "border-purple-500 bg-purple-500 text-white" : "border-gray-200 bg-white text-gray-500"
                      }`}>HT</button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, tax_mode: "TTC" }))}
                      className={`flex-1 py-3 rounded-xl text-[12px] font-black border transition-all ${
                        form.tax_mode === "TTC" ? "border-purple-500 bg-purple-500 text-white" : "border-gray-200 bg-white text-gray-500"
                      }`}>TTC</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Adresse ── */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
            <h4 className="text-[11px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Adresse
            </h4>
            <div>
              <label className={labelCls}>Adresse complète *</label>
              <AddressInput
                value={form.location}
                onChange={(v) => setForm(f => ({ ...f, location: v }))}
                onCityChange={(city) => setForm(f => ({ ...f, city: f.city || city, area: f.area || city }))}
                onPostalCodeChange={(pc) => setForm(f => ({ ...f, postal_code: f.postal_code || pc }))}
                onCoordinatesChange={(c) => setForm(f => ({ ...f, _lat: c.latitude, _lng: c.longitude }))}
                placeholder="Ex: 12 rue de la Paix, Paris"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Ville</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Paris" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Quartier</label>
                <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Opéra" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Code postal</label>
                <input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} placeholder="75002" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── Détails du bien ── */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
            <h4 className="text-[11px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Détails du bien
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Pièces</label>
                <input type="number" value={form.rooms} onChange={e => setForm(f => ({ ...f, rooms: e.target.value }))} placeholder="3" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Étage</label>
                <input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="RDC" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Équipements</label>
                <input value={form.equip} onChange={e => setForm(f => ({ ...f, equip: e.target.value }))} placeholder="Fauteuils, miroirs..." className={inputCls} />
              </div>
            </div>
            <input value={form.extra} onChange={e => setForm(f => ({ ...f, extra: e.target.value }))} placeholder="Extras : Parking, Cave, Terrasse..." className={inputCls} />
          </div>

          {/* ── Photos ── */}
          <div>
            <label className={labelCls}>Photos</label>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
              const files = Array.from(e.target.files);
              for (const file of files) {
                try {
                  setUploading(true);
                  const { file_url } = await uploadFile({ file });
                  setForm(f => ({ ...f, images: [...f.images, file_url] }));
                } catch (err) { console.error("Upload error:", err); }
              }
              setUploading(false);
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

          {/* ── Vidéo ── */}
          <div>
            <label className={labelCls}>Vidéo (optionnel)</label>
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={e => handleFileUpload(e, true)} />
            {form.video_url ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <video src={form.video_url} className="w-16 h-12 rounded-lg object-cover" />
                <span className="text-green-600 text-[12px] flex-1">Vidéo uploadée</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, video_url: "" }))} className="text-red-400 text-[11px]">Supprimer</button>
              </div>
            ) : (
              <button type="button" onClick={() => videoRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[13px] hover:border-primary transition-all">
                <Upload className="w-4 h-4" /> Ajouter une vidéo
              </button>
            )}
          </div>

          {/* ── Contact ── */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
            <h4 className="text-[11px] font-black text-gray-700 uppercase tracking-widest">Contact</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="Email" className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="Téléphone" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── Boutons ── */}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {editingId ? "Enregistrement..." : "Création..."}</> : editingId ? "Enregistrer les modifications" : "Publier l'annonce"}
            </button>
            <button type="button" onClick={saveAsDraft}
              className="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl text-[13px] font-black flex items-center gap-1.5 active:scale-95 transition-all">
              <Save className="w-4 h-4" /> Brouillon
            </button>
            <button type="button" onClick={() => { setCreating(false); setEditingId(null); clearDraft(); setError(""); }}
              className="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </form>
      )}

      {/* ── Brouillons ── */}
      {drafts.length > 0 && !creating && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600" />
            <p className="text-[12px] font-black text-amber-700">{drafts.length} brouillon(s) sauvegardé(s)</p>
          </div>
          {drafts.map(d => (
            <div key={d._draftId} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-amber-100">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-gray-800 truncate">{d.title || "Sans titre"}</p>
                <p className="text-[10px] text-gray-400">{d._draftDate} · {d.type === "vente" ? "Vente" : "Location"}{d.price ? ` · ${d.price}€` : ""}</p>
              </div>
              <button onClick={() => loadDraftToForm(d)} className="text-[10px] font-black text-primary px-2 py-1 bg-primary/10 rounded-lg active:scale-95">
                Reprendre
              </button>
              <button onClick={() => removeDraft(d._draftId)} className="text-red-400 active:scale-95">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {[
          { id: "all", label: "Tous", count: listings.length },
          { id: "vente", label: "Vente", count: listings.filter(l => l.type === "vente").length },
          { id: "location", label: "Location", count: listings.filter(l => l.type === "location").length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-gray-400"}`}>
            {tab.label}
            <span className="text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      <p className="text-gray-500 text-[12px] font-bold">{filteredListings.length} bien(s) immobilier(s)</p>

      <div className="space-y-3">
        {filteredListings.map(l => {
          const isVenteCard = l.type === "vente";
          const salonLabel = SALON_TYPES.find(s => s.value === l.salon_type)?.label;
          return (
            <div key={l.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {l.images?.[0]
                    ? <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Home className="w-6 h-6 text-gray-300" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-[13px] font-black truncate">{l.title}</p>
                  <p className="text-gray-500 text-[11px]">{l.city || l.location}{l.area ? ` · ${l.area}` : ""}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isVenteCard ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                      {isVenteCard ? "Vente" : "Location"}
                    </span>
                    {salonLabel && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{salonLabel}</span>}
                    <span className="text-[11px] font-black text-primary">{l.price?.toLocaleString("fr-FR")}€{!isVenteCard && l.tax_mode ? ` ${l.tax_mode}` : ""}</span>
                    {l.price_per_m2 > 0 && <span className="text-[10px] text-gray-400">{l.price_per_m2.toLocaleString("fr-FR")}€/m²</span>}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${l.status === "actif" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                      {l.status === "actif" ? "Disponible" : l.status === "loue" ? (isVenteCard ? "Vendu" : "Loué") : l.status}
                    </span>
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
              {l.images?.length > 1 && <div className="px-4 pb-3"><span className="text-[10px] text-gray-400">{l.images.length} photos</span></div>}
            </div>
          );
        })}
        {listings.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucun bien immobilier.</p>}
      </div>
    </div>
  );
}
