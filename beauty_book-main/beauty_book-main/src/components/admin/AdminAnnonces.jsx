import { useState, useEffect, useRef } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { uploadFile, entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import BeautyImage from '@/components/ui/BeautyImage';
import {
  Trash2, Plus, Eye, EyeOff, Upload, Loader2, Film, Link, Pencil, X,
  MapPin, Sparkles, Scissors, ShoppingBag, ExternalLink, Tag, Check, Calendar, ArrowRight, ArrowLeft
} from "lucide-react";

const EMPTY_FORM = {
  title: "",
  sponsor_name: "",
  sponsor_logo: "",
  image_url: "",
  video_url: "",
  description: "",
  cta_label: "En savoir plus",
  cta_url: "",
  pages: ["reels"],
  status: "actif",
  start_date: "",
  end_date: "",
  callouts: [],
};

const PRESET_CALLOUT_CATEGORIES = [
  { id: "coiffure", label: "Coiffure & Tête", icon: "✂️", defaultName: "Coiffure Signature" },
  { id: "habit", label: "Habit & Tenue", icon: "👗", defaultName: "Tenue / Robe Stylée" },
  { id: "maquillage", label: "Maquillage & Teint", icon: "💄", defaultName: "Maquillage Éclat" },
  { id: "soin", label: "Soin & Sérum", icon: "🧴", defaultName: "Sérum Brillance" },
  { id: "accessoire", label: "Accessoire / Bijou", icon: "✨", defaultName: "Accessoire Beauté" },
];

function extractVideoThumb(src) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.src = src;
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.preload = "metadata";
    v.currentTime = 0.1;
    v.onloadeddata = () => { v.currentTime = 0.5; };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = v.videoWidth || 320;
        c.height = v.videoHeight || 180;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.6));
      } catch { resolve(null); }
    };
    v.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 5000);
  });
}

function VideoThumb({ src, className, iconClassName }) {
  const [thumb, setThumb] = useState(null);
  useEffect(() => {
    if (!src) return;
    extractVideoThumb(src).then(t => { if (t) setThumb(t); });
  }, [src]);
  return (
    <div className={`relative ${className || ""}`}>
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <Film className={iconClassName || "w-5 h-5 text-white"} />
      </div>
    </div>
  );
}

export default function AdminAnnonces() {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [mediaMode, setMediaMode] = useState("upload");

  // Type d'annonce : "standard" (bannière classique) ou "reference" (avec repères interactifs pour le réseau social)
  const [annonceType, setAnnonceType] = useState("standard");

  // Parcours multi-étapes de création
  // Étape 1 : Médias & Sponsor (image/vidéo, titre, logo)
  // Étape 2 : Repères interactifs sur l'image (habits, coiffure, tête, maquillage, produits/services)
  // Étape 3 : Diffusion, Cibles & CTA
  const [wizardStep, setWizardStep] = useState(1);

  // État du positionnement de repères
  const [pendingPoint, setPendingPoint] = useState(null);
  const [calloutModalOpen, setCalloutModalOpen] = useState(false);
  const [calloutForm, setCalloutForm] = useState({
    label: "",
    targetType: "service",
    targetId: "",
    targetName: "",
    cta_url: "",
  });

  // Services et Produits disponibles dans la plateforme pour liaison
  const [availableServices, setAvailableServices] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  const mediaInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const PAGES_OPTIONS = [
    { value: "reels", label: "Réels & Vidéos" },
    { value: "styles", label: "Flux Styles & Tendances" },
    { value: "services", label: "Catalogue Services" },
    { value: "explorer", label: "Explorer" },
    { value: "social", label: "Réseau Social" },
  ];

  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    adminApi.listAnnonces().then(setAnnonces).catch(() => {}).finally(() => setLoading(false));
    // Charger liste des services & produits pour enrichir les repères
    entities.Service.list("-created_at", 100)
      .then(res => setAvailableServices(res || []))
      .catch(() => {});
    entities.Produit.list("-created_at", 100)
      .then(res => setAvailableProducts(res || []))
      .catch(() => {});
  }, []);

  const isVideoUrl = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") || url.includes("video"));

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setCreating(false);
    setWizardStep(1);
    setUploadError("");
    setMediaMode("upload");
    setPendingPoint(null);
    setCalloutModalOpen(false);
    setAnnonceType("standard");
  };

  const startEdit = (a) => {
    let callouts = Array.isArray(a.callouts) ? a.callouts : [];
    if (callouts.length === 0 && a.description) {
      const match = String(a.description).match(/<!--CALLOUTS:(.*?)-->/);
      if (match) {
        try { callouts = JSON.parse(match[1]); } catch {}
      }
    }
    const cleanDesc = (a.description || "").replace(/<!--CALLOUTS:.*?-->/g, "").trim();

    // Déterminer le type d'annonce à l'édition
    const detectedType = (callouts.length > 0 || a.annonce_type === "reference") ? "reference" : "standard";

    setForm({
      title: a.title || "",
      sponsor_name: a.sponsor_name || "",
      sponsor_logo: a.sponsor_logo || "",
      image_url: a.image_url || "",
      video_url: a.video_url || "",
      description: cleanDesc,
      cta_label: a.cta_label || "En savoir plus",
      cta_url: a.cta_url || "",
      pages: a.pages || [a.type || "reels"],
      status: a.status || "actif",
      start_date: a.start_date || "",
      end_date: a.end_date || "",
      callouts,
    });
    setAnnonceType(detectedType);
    setEditingId(a.id);
    setCreating(true);
    setWizardStep(1);
    setUploadError("");
    setMediaMode("url");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadMedia = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingMedia(true);
    setUploadError("");
    try {
      const { file_url } = await uploadFile({ file });
      if (isVideoUrl(file.name) || file.type?.startsWith("video/")) {
        setForm(f => ({ ...f, video_url: file_url, image_url: f.image_url || "" }));
      } else {
        setForm(f => ({ ...f, image_url: file_url }));
      }
    } catch (err) {
      console.error('[AdminAnnonces] Upload error:', err);
      setUploadError("Upload échoué — vous pouvez aussi coller une URL directe");
      setMediaMode("url");
    }
    setUploadingMedia(false);
    e.target.value = "";
  };

  const uploadSponsorLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingMedia(true);
    setUploadError("");
    try {
      if (!file.type?.startsWith("image/")) throw new Error("Le logo doit être une image.");
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, sponsor_logo: file_url }));
    } catch (err) {
      console.error('[AdminAnnonces] Sponsor logo upload error:', err);
      setUploadError(err?.message || "Upload du logo échoué");
    }
    setUploadingMedia(false);
    e.target.value = "";
  };

  const toggleStatus = async (a) => {
    try {
      const updated = await adminApi.toggleAnnonceStatus(a.id);
      setAnnonces(prev => prev.map(x => x.id === a.id ? { ...x, status: updated.status } : x));
    } catch {}
  };

  const deleteAnnonce = async (id) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    try { await adminApi.deleteAnnonce(id); } catch {}
    setAnnonces(prev => prev.filter(a => a.id !== id));
  };

  const submitAnnonce = async (e) => {
    if (e) e.preventDefault();
    if (!form.title || !form.sponsor_name || (!form.image_url && !form.video_url)) {
      alert("Veuillez renseigner le titre, le nom du sponsor et au moins un média (image ou vidéo).");
      setWizardStep(1);
      return;
    }
    setSaving(true);
    try {
      // Encoder les callouts dans la description pour rétrocompatibilité totale
      let finalDescription = form.description || "";
      if (form.callouts && form.callouts.length > 0) {
        finalDescription = `${finalDescription.replace(/<!--CALLOUTS:.*?-->/g, "").trim()} <!--CALLOUTS:${JSON.stringify(form.callouts)}-->`;
      }

      const payload = {
        title: form.title,
        sponsor_name: form.sponsor_name,
        sponsor_logo: form.sponsor_logo,
        image_url: form.image_url,
        video_url: form.video_url,
        description: finalDescription,
        cta_label: form.cta_label || "En savoir plus",
        cta_url: form.cta_url || "",
        pages: form.pages,
        type: form.pages[0] || "reels",
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        callouts: form.callouts,
        annonce_type: annonceType, // "standard" ou "reference"
      };

      if (editingId) {
        const updated = await adminApi.updateAnnonce(editingId, payload);
        setAnnonces(prev => prev.map(a => a.id === editingId ? { ...a, ...updated, callouts: form.callouts } : a));
      } else {
        const created = await adminApi.createAnnonce(payload);
        setAnnonces(prev => [{ ...created, callouts: form.callouts }, ...prev]);
      }
      resetForm();
    } catch (err) {
      console.error('[AdminAnnonces] Save error:', err);
      alert("Erreur lors de l'enregistrement de l'annonce.");
    }
    setSaving(false);
  };

  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPendingPoint({ x, y });
    setCalloutForm({
      label: "",
      targetType: "service",
      targetId: "",
      targetName: "",
      cta_url: "",
    });
    setCalloutModalOpen(true);
  };

  const handleAddCallout = () => {
    if (!calloutForm.label && !calloutForm.targetName) return;
    const newCallout = {
      id: `c_${Date.now()}`,
      x: pendingPoint.x,
      y: pendingPoint.y,
      label: calloutForm.label || calloutForm.targetName,
      targetType: calloutForm.targetType,
      targetId: calloutForm.targetId,
      targetName: calloutForm.targetName,
      cta_url: calloutForm.cta_url,
    };
    setForm(f => ({ ...f, callouts: [...(f.callouts || []), newCallout] }));
    setCalloutModalOpen(false);
    setPendingPoint(null);
  };

  const removeCallout = (calloutId) => {
    setForm(f => ({ ...f, callouts: (f.callouts || []).filter(c => c.id !== calloutId) }));
  };

  const getMediaPreview = (a) => {
    if (a.video_url) return <VideoThumb src={a.video_url} className="w-full h-full" />;
    if (a.image_url) return <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />;
    return <div className="w-full h-full flex items-center justify-center text-[20px]">📢</div>;
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Barre supérieure : deux boutons création */}
      {!creating && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent p-5 rounded-3xl border border-primary/20">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[20px]">✨</span>
                <h2 className="text-[18px] font-black text-gray-900">Annonces & Campagnes Réseau Social</h2>
              </div>
              <p className="text-[13px] text-gray-600 mt-0.5">
                Créez des publicités interactives avec références visuelles (coiffure, habits, tête, produits) visibles dans les Réels et les flux.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                onClick={() => { setAnnonceType("standard"); setCreating(true); setEditingId(null); setForm({ ...EMPTY_FORM }); setWizardStep(1); }}
                className="flex items-center gap-2 bg-white border-2 border-primary text-primary px-4 py-3 rounded-2xl text-[12px] font-black active:scale-95 transition-all shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" /> Nouvelle annonce
              </button>
              <button
                onClick={() => {
                  setAnnonceType("reference");
                  setCreating(true);
                  setEditingId(null);
                  setForm({ ...EMPTY_FORM, pages: ["reels", "social"] });
                  setWizardStep(1);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 rounded-2xl text-[12px] font-black active:scale-95 transition-all shadow-lg shadow-amber-500/30 shrink-0"
              >
                <Sparkles className="w-4 h-4" /> Nouvelle annonce référence
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── PARCOURS DE CRÉATION MULTI-ÉTAPES ── */}
      {creating && (
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xl space-y-6">
          {/* Header du wizard */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-primary/10 text-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Parcours Admin
                </span>
                {annonceType === "reference" && (
                  <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Annonce Référence
                  </span>
                )}
                <span className="text-gray-400 text-[12px] font-bold">Étape {wizardStep} / 3</span>
              </div>
              <h3 className="text-gray-900 text-[18px] font-black mt-1">
                {wizardStep === 1 && "1. Média & Identité de la Publicité"}
                {wizardStep === 2 && "2. Positionnement des Repères (Habits, Tête, Produits)"}
                {wizardStep === 3 && "3. Emplacements, Diffusion & Bouton CTA"}
              </h3>
            </div>
            <button type="button" onClick={resetForm} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 active:scale-95 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bannière descriptive pour annonce référence */}
          {annonceType === "reference" && wizardStep === 1 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-900 text-[13px] font-black">Annonce Référence — Réseau Social</p>
                <p className="text-amber-700 text-[12px] mt-0.5">
                  Cette annonce apparaîtra dans les <strong>Réels</strong> et le fil social avec des <strong>repères interactifs</strong> (habits, coiffure, maquillage, produits) sur lesquels les utilisateurs peuvent cliquer pour voir les références.
                </p>
              </div>
            </div>
          )}


          {/* Stepper bar */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: 1, label: "Média & Sponsor" },
              { num: 2, label: "Repères Visuels", badge: form.callouts?.length ? `${form.callouts.length}` : null },
              { num: 3, label: "Diffusion & CTA" },
            ].map(s => (
              <button
                key={s.num}
                type="button"
                onClick={() => setWizardStep(s.num)}
                className={`py-2.5 px-3 rounded-2xl flex items-center justify-between text-left transition-all border ${wizardStep === s.num ? "border-primary bg-primary/10 text-primary" : wizardStep > s.num ? "border-green-200 bg-green-50 text-green-700" : "border-gray-100 bg-gray-50 text-gray-400"}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${wizardStep === s.num ? "bg-primary text-white" : wizardStep > s.num ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                    {wizardStep > s.num ? "✓" : s.num}
                  </span>
                  <span className="text-[12px] font-black truncate">{s.label}</span>
                </div>
                {s.badge && (
                  <span className="bg-amber-400 text-gray-900 text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                    {s.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ──── ÉTAPE 1 : Médias & Sponsor ──── */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-gray-700 text-[12px] font-black block mb-1">Titre de l'annonce *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Collection Haute Couture & Chignon Signature..."
                  required
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[14px] outline-none focus:border-primary font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-700 text-[12px] font-black block mb-1">Nom du Sponsor / Marque *</label>
                  <input
                    value={form.sponsor_name}
                    onChange={e => setForm(f => ({ ...f, sponsor_name: e.target.value }))}
                    placeholder="Ex: Atelier Maison Beauté, L'Oréal..."
                    required
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[13px] outline-none focus:border-primary font-bold"
                  />
                </div>
                <div>
                  <label className="text-gray-700 text-[12px] font-black block mb-1">Logo du Sponsor (optionnel)</label>
                  <div className="flex gap-2">
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadSponsorLogo} />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-[12px] font-bold text-gray-700 flex items-center gap-1.5 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" /> Fichier
                    </button>
                    <input
                      value={form.sponsor_logo}
                      onChange={e => setForm(f => ({ ...f, sponsor_logo: e.target.value }))}
                      placeholder="Ou URL du logo"
                      className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-3 py-3 text-[12px] outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-gray-700 text-[12px] font-black block mb-1">Texte / Description de l'annonce</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Décrivez votre offre, vos inspirations ou les styles présentés..."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none font-medium"
                />
              </div>

              {/* Sélecteur Média Visuel */}
              <div className="rounded-3xl border border-gray-200 p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-gray-800 text-[13px] font-black">Visuel principal de la publicité (Image ou Vidéo) *</p>
                  <div className="flex gap-1 bg-gray-200 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setMediaMode("upload")}
                      className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${mediaMode === "upload" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaMode("url")}
                      className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${mediaMode === "url" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                    >
                      Lien direct
                    </button>
                  </div>
                </div>

                {mediaMode === "upload" ? (
                  <>
                    <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadMedia} />
                    {(form.image_url || form.video_url) ? (
                      <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-gray-200">
                        <div className="flex items-center gap-3">
                          {form.video_url ? (
                            <VideoThumb src={form.video_url} className="w-14 h-14 rounded-xl shrink-0" />
                          ) : (
                            <img src={form.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                          )}
                          <div>
                            <p className="text-green-600 font-bold text-[12px]">✓ Média chargé avec succès</p>
                            <p className="text-gray-400 text-[11px]">{form.video_url ? "Format Vidéo" : "Format Image"}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "", video_url: "" }))} className="text-red-500 text-[12px] font-bold px-3 py-1 bg-red-50 rounded-xl hover:bg-red-100">
                          Changer
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => mediaInputRef.current?.click()}
                        disabled={uploadingMedia}
                        className="w-full flex flex-col items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-300 rounded-2xl py-6 text-gray-500 hover:border-primary hover:text-primary transition-all cursor-pointer"
                      >
                        {uploadingMedia ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6" />}
                        <span className="text-[13px] font-black">{uploadingMedia ? "Téléversement en cours..." : "Cliquez pour importer votre photo ou vidéo"}</span>
                        <span className="text-[11px] text-gray-400 font-medium">Recommandé : Format vertical (9:16) pour les Réels</span>
                      </button>
                    )}
                    {uploadError && <p className="text-red-500 text-[11px]">{uploadError}</p>}
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={form.image_url}
                      onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="URL directe de l'image (https://...)"
                      className="w-full bg-white border border-gray-200 text-gray-800 rounded-xl px-4 py-2.5 text-[12px] outline-none focus:border-primary"
                    />
                    <input
                      value={form.video_url}
                      onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                      placeholder="URL directe de la vidéo (optionnel)"
                      className="w-full bg-white border border-gray-200 text-gray-800 rounded-xl px-4 py-2.5 text-[12px] outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>

              {/* Bouton pour avancer vers les repères */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!form.title || !form.sponsor_name) {
                      alert("Veuillez indiquer au moins un titre et le sponsor.");
                      return;
                    }
                    if (!form.image_url && !form.video_url) {
                      alert("Veuillez importer ou renseigner une image pour positionner les repères.");
                      return;
                    }
                    setWizardStep(2);
                  }}
                  className="bg-primary text-white px-6 py-3.5 rounded-2xl text-[13px] font-black flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-primary/20"
                >
                  Continuer : Poser les repères <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ──── ÉTAPE 2 : Positionnement des repères visuels ──── */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[13px] font-black text-amber-900">Placez des repères interactifs sur l'annonce</h4>
                  <p className="text-[12px] text-amber-800 leading-relaxed mt-0.5">
                    <strong>Cliquez sur l'image</strong> ci-dessous à l'endroit précis que vous souhaitez taguer :
                    la <strong>tête / coiffure</strong>, les <strong>habits / robes / tenue</strong>, le <strong>maquillage</strong>, ou un <strong>produit/service</strong>.
                  </p>
                </div>
              </div>

              {/* Image interactive de repérage */}
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="w-full lg:w-1/2 flex flex-col items-center">
                  <div
                    onClick={handleCanvasClick}
                    className="relative w-full max-w-sm rounded-3xl overflow-hidden cursor-crosshair border-2 border-primary/30 shadow-2xl bg-black select-none group"
                    style={{ aspectRatio: "9/16", maxHeight: "520px" }}
                  >
                    {form.image_url ? (
                      <img src={form.image_url} alt="" className="w-full h-full object-cover pointer-events-none" />
                    ) : form.video_url ? (
                      <VideoThumb src={form.video_url} className="w-full h-full pointer-events-none" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50">Aucun média</div>
                    )}

                    {/* Overlay d'aide au survol */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="bg-black/75 backdrop-blur-md text-white text-[12px] font-bold px-3 py-1.5 rounded-full border border-white/20">
                        ✦ Cliquez pour ajouter un repère
                      </div>
                    </div>

                    {/* Affichage des repères existants */}
                    {(form.callouts || []).map((c, idx) => (
                      <div
                        key={c.id || idx}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group/pin"
                        style={{ left: `${c.x}%`, top: `${c.y}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Supprimer le repère "${c.label}" ?`)) removeCallout(c.id);
                        }}
                      >
                        <div className="relative flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-amber-400 opacity-60"></span>
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-primary text-white border-2 border-white shadow-xl flex items-center justify-center text-[10px] font-black">
                            {idx + 1}
                          </div>
                        </div>
                        <div className="mt-1 bg-black/90 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-2xl whitespace-nowrap flex items-center gap-1 border border-amber-400/50">
                          <span>{c.label}</span>
                          <span className="text-red-400 font-bold ml-1 text-[9px]">✕</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 text-center">
                    {(form.callouts || []).length} repère(s) positionné(s) · Touchez un repère pour le supprimer
                  </p>
                </div>

                {/* Liste des repères & suggestions rapides */}
                <div className="w-full lg:w-1/2 space-y-4">
                  <div>
                    <h4 className="text-[14px] font-black text-gray-900 mb-2">Exemples de catégories à taguer :</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_CALLOUT_CATEGORIES.map(cat => (
                        <div key={cat.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-2.5 flex items-center gap-2 text-[12px] font-bold text-gray-700">
                          <span className="text-[16px]">{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[14px] font-black text-gray-900">Repères configurés :</h4>
                      <span className="text-[11px] font-bold text-primary">{(form.callouts || []).length} au total</span>
                    </div>

                    {(form.callouts || []).length === 0 ? (
                      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-[12px]">
                        Aucun repère pour l'instant.<br />
                        <span className="text-primary font-bold">Cliquez sur la photo à gauche</span> pour en ajouter un.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {(form.callouts || []).map((c, idx) => (
                          <div key={c.id || idx} className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-primary text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-black text-gray-900 truncate">{c.label}</p>
                                <p className="text-[11px] text-gray-500 truncate">
                                  {c.targetType === "service" ? "✂️ Service" : c.targetType === "produit" ? "🧴 Produit" : "🔗 Lien"} : {c.targetName || c.cta_url || "Direct"}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCallout(c.id)}
                              className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation étape 2 */}
              <div className="flex justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="bg-gray-100 text-gray-700 px-5 py-3 rounded-2xl text-[13px] font-bold flex items-center gap-2 active:scale-95 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="bg-primary text-white px-6 py-3.5 rounded-2xl text-[13px] font-black flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-primary/20"
                >
                  Continuer : Diffusion & CTA <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ──── ÉTAPE 3 : Emplacements, Diffusion & CTA ──── */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              <div>
                <label className="text-gray-800 text-[13px] font-black block mb-2">Emplacements de diffusion *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PAGES_OPTIONS.map(opt => {
                    const selected = form.pages.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          pages: selected ? f.pages.filter(p => p !== opt.value) : [...f.pages, opt.value]
                        }))}
                        className={`p-3.5 rounded-2xl text-[12px] font-black border text-left flex items-center justify-between transition-all ${selected ? "bg-primary text-white border-primary shadow-sm" : "bg-gray-50 text-gray-700 border-gray-200"}`}
                      >
                        <span>{opt.label}</span>
                        {selected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-700 text-[12px] font-black block mb-1">Texte du bouton CTA principal</label>
                  <input
                    value={form.cta_label}
                    onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))}
                    placeholder="Ex: Réserver ce look, Voir la collection..."
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[13px] outline-none focus:border-primary font-bold"
                  />
                </div>
                <div>
                  <label className="text-gray-700 text-[12px] font-black block mb-1">Lien de redirection CTA</label>
                  <input
                    value={form.cta_url}
                    onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))}
                    placeholder="Ex: /services-salons ou https://..."
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[13px] outline-none focus:border-primary font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-700 text-[12px] font-black block mb-1">Date de début de diffusion</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[13px] outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-gray-700 text-[12px] font-black block mb-1">Date de fin de diffusion</label>
                  <input
                    type="date"
                    value={form.end_date}
                    min={form.start_date || undefined}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[13px] outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Récapitulatif visuel avant enregistrement */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-[12px] font-black uppercase tracking-wider text-amber-300">Prêt pour la publication</span>
                  </div>
                  <span className="bg-white/20 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">
                    {(form.callouts || []).length} repère(s) interactif(s)
                  </span>
                </div>
                <p className="text-[16px] font-black">{form.title || "Titre de l'annonce"}</p>
                <p className="text-[12px] text-white/70">Sponsor : {form.sponsor_name} · Diffusé sur : {form.pages.join(", ")}</p>
              </div>

              {/* Navigation étape 3 */}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="bg-gray-100 text-gray-700 px-5 py-3 rounded-2xl text-[13px] font-bold flex items-center gap-2 active:scale-95 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Modifier les repères
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-100 text-gray-600 px-5 py-3 rounded-2xl text-[13px] font-bold active:scale-95 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={submitAnnonce}
                    disabled={saving}
                    className="bg-primary text-white px-8 py-3.5 rounded-2xl text-[13px] font-black flex items-center gap-2 active:scale-95 transition-all shadow-xl shadow-primary/30 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {editingId ? "Enregistrer les modifications" : "Publier l'annonce sur le réseau"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL AJOUT DE REPÈRE SUR LE CLIC ── */}
      {calloutModalOpen && pendingPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-gray-900">Configurer le repère</h3>
                  <p className="text-[11px] text-gray-400">Position : {pendingPoint.x}%, {pendingPoint.y}%</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setCalloutModalOpen(false); setPendingPoint(null); }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Raccourcis types fréquents */}
            <div>
              <label className="text-gray-700 text-[11px] font-black uppercase tracking-wider block mb-1.5">
                Suggestions rapides
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CALLOUT_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCalloutForm(f => ({ ...f, label: cat.defaultName }))}
                    className="bg-gray-100 hover:bg-orange-50 hover:text-primary text-gray-700 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1"
                  >
                    <span>{cat.icon}</span> <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Libellé du repère */}
            <div>
              <label className="text-gray-700 text-[11px] font-black uppercase tracking-wider block mb-1">
                Titre du repère (affiché au tap) *
              </label>
              <input
                type="text"
                value={calloutForm.label}
                onChange={e => setCalloutForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Coiffure Chignon, Robe Haute Couture, Sérum..."
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-3 text-[13px] outline-none focus:border-primary font-bold"
              />
            </div>

            {/* Type de lien */}
            <div>
              <label className="text-gray-700 text-[11px] font-black uppercase tracking-wider block mb-1.5">
                Redirection lors du clic
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { id: "service", label: "✂️ Service", icon: Scissors },
                  { id: "produit", label: "🧴 Produit", icon: ShoppingBag },
                  { id: "url", label: "🔗 Lien libre", icon: ExternalLink },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCalloutForm(f => ({ ...f, targetType: t.id, targetId: "", targetName: "" }))}
                    className={`py-2 rounded-xl text-[11px] font-black border transition-all ${calloutForm.targetType === t.id ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sélection Service existant */}
              {calloutForm.targetType === "service" && (
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-100 rounded-2xl p-2 bg-gray-50">
                  {availableServices.length === 0 ? (
                    <p className="text-[12px] text-gray-400 text-center py-2">Aucun service créé.</p>
                  ) : (
                    availableServices.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCalloutForm(f => ({
                          ...f,
                          targetId: s.id,
                          targetName: s.title || s.name,
                          label: f.label || s.title || s.name
                        }))}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-[12px] font-bold transition-all ${calloutForm.targetId === s.id ? "bg-primary text-white" : "bg-white text-gray-800 hover:bg-gray-100"}`}
                      >
                        <span className="truncate">{s.title || s.name}</span>
                        <span className="text-[11px] opacity-80">{s.price}€</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Sélection Produit existant */}
              {calloutForm.targetType === "produit" && (
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-100 rounded-2xl p-2 bg-gray-50">
                  {availableProducts.length === 0 ? (
                    <p className="text-[12px] text-gray-400 text-center py-2">Aucun produit disponible.</p>
                  ) : (
                    availableProducts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCalloutForm(f => ({
                          ...f,
                          targetId: p.id,
                          targetName: p.name,
                          label: f.label || p.name
                        }))}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-[12px] font-bold transition-all ${calloutForm.targetId === p.id ? "bg-primary text-white" : "bg-white text-gray-800 hover:bg-gray-100"}`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[11px] opacity-80">{p.price}€</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* URL Libre */}
              {calloutForm.targetType === "url" && (
                <input
                  type="text"
                  value={calloutForm.cta_url}
                  onChange={e => setCalloutForm(f => ({ ...f, cta_url: e.target.value }))}
                  placeholder="https://... ou /services-salons"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl px-4 py-2.5 text-[12px] outline-none focus:border-primary"
                />
              )}
            </div>

            <button
              type="button"
              disabled={!calloutForm.label && !calloutForm.targetName}
              onClick={handleAddCallout}
              className="w-full py-3.5 bg-primary text-white rounded-2xl font-black text-[13px] uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
            >
              Ajouter ce repère ✦
            </button>
          </div>
        </div>
      )}

      {/* ── LISTE DES ANNONCES EXISTANTES ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-gray-600 text-[13px] font-bold">{annonces.length} annonce(s) enregistrée(s)</p>
          <span className="text-[11px] text-gray-400">Gérez l'activation et les repères en un clic</span>
        </div>

        {annonces.map(a => {
          let calloutsCount = 0;
          if (Array.isArray(a.callouts)) calloutsCount = a.callouts.length;
          else if (a.description && a.description.includes("<!--CALLOUTS:")) {
            try {
              const m = a.description.match(/<!--CALLOUTS:(.*?)-->/);
              if (m) calloutsCount = JSON.parse(m[1]).length;
            } catch {}
          }

          return (
            <div key={a.id} className={`bg-white rounded-3xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow ${a.annonce_type === "reference" || calloutsCount > 0 ? "border-2 border-amber-200" : "border border-gray-200"}`}>
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                {getMediaPreview(a)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-gray-900 text-[14px] font-black truncate">{a.title}</p>
                  {(a.annonce_type === "reference" || calloutsCount > 0) && (
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <Sparkles className="w-2.5 h-2.5" /> Référence
                    </span>
                  )}
                  {calloutsCount > 0 && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      {calloutsCount} repère(s)
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-[12px] truncate">
                  {a.sponsor_name} · Diffusé sur : {(a.pages || [a.type || "reels"]).join(", ")}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${a.status === "actif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {a.status === "actif" ? "Actif" : "Pausé"}
                  </span>
                  {a.cta_label && (
                    <span className="text-gray-400 text-[11px]">Bouton : "{a.cta_label}"</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(a)}
                  className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center active:scale-95 transition-all hover:bg-blue-100"
                  title="Modifier l'annonce et ses repères"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleStatus(a)}
                  className="w-10 h-10 bg-gray-100 text-gray-700 rounded-2xl flex items-center justify-center active:scale-95 transition-all hover:bg-gray-200"
                  title={a.status === "actif" ? "Mettre en pause" : "Activer"}
                >
                  {a.status === "actif" ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-green-600" />}
                </button>
                <button
                  onClick={() => deleteAnnonce(a.id)}
                  className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all hover:bg-red-100"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {annonces.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-3">
            <span className="text-[32px]">📢</span>
            <p className="text-gray-800 text-[15px] font-black">Aucune annonce publicitaire créée</p>
            <p className="text-gray-400 text-[13px] max-w-sm mx-auto">
              Cliquez sur "Créer une annonce publicitaire" ci-dessus pour lancer votre première campagne avec repères interactifs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
