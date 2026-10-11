import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Camera, Plus, Trash2, Zap, Check, Users, Gift, Tag, FileText, Search, X, Pencil, Sparkles, Save, Image } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { uploadFile } from "@/api/entities";
import { useThemeBg } from "@/hooks/useTheme";
import BeautyImage from "@/components/ui/BeautyImage";

const BUNDLE_CATEGORIES = ["Tous", "Coiffure", "Soin", "Ongles", "Maquillage"];
const DRAFT_KEY = "bb_bundle_draft";

const BANNER_THEMES = [
  { id: "glamour", name: "Glamour Rose & Orange", bg: "from-[#ff6b35] via-[#e84466] to-[#f7931e]", previewBg: "bg-gradient-to-r from-[#ff6b35] to-[#e84466]", badgeDefault: "PACK ÉCLAT ✨" },
  { id: "luxe", name: "Luxe Noir & Or", bg: "from-[#121212] via-[#2A1D08] to-[#45300B]", previewBg: "bg-gradient-to-r from-gray-900 to-amber-900", badgeDefault: "ÉDITION LIMITÉE 👑" },
  { id: "spa", name: "Spa & Sérénité Émeraude", bg: "from-[#0F3D3E] via-[#107A72] to-[#149B90]", previewBg: "bg-gradient-to-r from-teal-900 to-emerald-600", badgeDefault: "WELLNESS & DETOX 🌿" },
  { id: "coiffure", name: "Rituels Capillaires Choco", bg: "from-[#3D1E16] via-[#6B3728] to-[#8A4A36]", previewBg: "bg-gradient-to-r from-stone-900 to-amber-800", badgeDefault: "RITUELS CAPILLAIRES ✂️" },
  { id: "ongles", name: "Ongles & Beauty Neon", bg: "from-[#4C1D95] via-[#9333EA] to-[#C026D3]", previewBg: "bg-gradient-to-r from-purple-900 to-fuchsia-600", badgeDefault: "MANUCURE VIP 💅" },
  { id: "bridal", name: "Rose Gold Mariage", bg: "from-[#831843] via-[#BE185D] to-[#DB2777]", previewBg: "bg-gradient-to-r from-rose-900 to-pink-600", badgeDefault: "PACK MARIAGE 💍" },
];

function escapeXml(unsafe) {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateBannerSvg({ title, badge, subtitle, theme }) {
  const themesMap = {
    glamour: { bg1: "#ff6b35", bg2: "#e84466", text: "#FFFFFF", badgeBg: "rgba(255,255,255,0.25)", badgeText: "#FFFFFF", accent: "#FFE600" },
    luxe: { bg1: "#121212", bg2: "#45300B", text: "#F59E0B", badgeBg: "rgba(245,158,11,0.25)", badgeText: "#FCD34D", accent: "#F59E0B" },
    spa: { bg1: "#0F3D3E", bg2: "#149B90", text: "#FFFFFF", badgeBg: "rgba(255,255,255,0.2)", badgeText: "#A7F3D0", accent: "#6EE7B7" },
    coiffure: { bg1: "#3D1E16", bg2: "#8A4A36", text: "#FFFFFF", badgeBg: "rgba(255,255,255,0.2)", badgeText: "#FDE68A", accent: "#FCD34D" },
    ongles: { bg1: "#4C1D95", bg2: "#C026D3", text: "#FFFFFF", badgeBg: "rgba(255,255,255,0.2)", badgeText: "#F472B6", accent: "#F472B6" },
    bridal: { bg1: "#831843", bg2: "#DB2777", text: "#FFFFFF", badgeBg: "rgba(255,255,255,0.2)", badgeText: "#FBCFE8", accent: "#FDE68A" },
  };
  const t = themesMap[theme] || themesMap.glamour;
  const safeTitle = escapeXml(title || "MON BUNDLE BEAUTÉ");
  const safeBadge = escapeXml(badge || "OFFRE SPÉCIALE ✨");
  const safeSub = escapeXml(subtitle || "Une expérience soin exclusive");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${t.bg1}" />
        <stop offset="100%" stop-color="${t.bg2}" />
      </linearGradient>
    </defs>
    <rect width="800" height="400" fill="url(#bgGrad)" />
    <circle cx="720" cy="60" r="160" fill="white" opacity="0.08" />
    <circle cx="80" cy="360" r="200" fill="white" opacity="0.06" />
    <rect x="48" y="44" width="240" height="40" rx="20" fill="${t.badgeBg}" />
    <text x="168" y="69" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" fill="${t.badgeText}" text-anchor="middle" letter-spacing="2">${safeBadge}</text>
    <text x="48" y="180" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="900" fill="${t.text}">${safeTitle}</text>
    <text x="48" y="225" font-family="system-ui, -apple-system, sans-serif" font-size="19" font-weight="600" fill="${t.text}" opacity="0.85">${safeSub}</text>
    <line x1="48" y1="280" x2="752" y2="280" stroke="white" stroke-opacity="0.15" stroke-width="2" />
    <text x="48" y="335" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" fill="${t.accent}" letter-spacing="1">BEAUTYBOOK EXCLUSIVE BUNDLE</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function getDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}
function saveDraft(d) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

export default function CreerBundle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const themeBg = useThemeBg();
  const imgRef = useRef(null);
  const bannerImgRef = useRef(null);

  const [bundles, setBundles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBundle, setEditingBundle] = useState(null);
  const [services, setServices] = useState([]);
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bundleServiceSearch, setBundleServiceSearch] = useState("");
  const [bundleStyleSearch, setBundleStyleSearch] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [showBannerStudio, setShowBannerStudio] = useState(false);
  const [studioTheme, setStudioTheme] = useState("glamour");
  const [studioTitle, setStudioTitle] = useState("");
  const [studioBadge, setStudioBadge] = useState("PACK ÉCLAT ✨");
  const [studioSubtitle, setStudioSubtitle] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedStyleIds, setSelectedStyleIds] = useState([]);
  const [category, setCategory] = useState("Tous");
  const [svcCategoryFilter, setSvcCategoryFilter] = useState("Tous");
  const [isGroup, setIsGroup] = useState(false);
  const [minPersons, setMinPersons] = useState(2);
  const [maxPersons, setMaxPersons] = useState(6);
  const [bonus, setBonus] = useState("");

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    const loadData = async () => {
      try {
        const [bundleRes, svcRes, styleByProRes, styleByAuthorRes] = await Promise.all([
          supabase.from("ServiceBundle").select("*").eq("pro_email", user.email).order("created_at", { ascending: false }),
          supabase.from("Service").select("*").eq("pro_email", user.email).order("created_at", { ascending: false }),
          supabase.from("Style").select("*").eq("pro_email", user.email).order("created_at", { ascending: false }).limit(100),
          supabase.from("Style").select("*").eq("author_email", user.email).order("created_at", { ascending: false }).limit(100),
        ]);
        let fetchedSvcs = svcRes.data || [];
        if (fetchedSvcs.length === 0) {
          const { data: altData } = await supabase.from("Service").select("*").ilike("pro_email", user.email).order("created_at", { ascending: false });
          if (altData && altData.length > 0) fetchedSvcs = altData;
        }
        if (!cancelled) {
          setBundles(bundleRes.data || []);
          setServices(fetchedSvcs);
          const fetchedStyles = [...(styleByProRes.data || []), ...(styleByAuthorRes.data || [])]
            .filter((item, index, list) => item?.id && list.findIndex((candidate) => candidate.id === item.id) === index);
          setStyles(fetchedStyles);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) { console.error("[CreerBundle] Load error:", e); setLoading(false); }
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [user?.email]);

  // Auto-open form if navigated with state or draft exists
  useEffect(() => {
    const edit = location.state?.editBundle;
    if (edit) {
      setEditingBundle(edit);
      setName(edit.name || "");
      setDescription(edit.description || "");
      setBundlePrice(edit.bundle_price?.toString() || "");
      setImageUrl(edit.image_url || "");
      setCoverUrl(edit.cover_url || edit.banner_url || "");
      setSelectedIds(edit.service_ids || []);
      setSelectedStyleIds(edit.style_ids || []);
      setCategory(edit.category || "Tous");
      setIsGroup(edit.is_group || false);
      setMinPersons(edit.min_persons || 2);
      setMaxPersons(edit.max_persons || 6);
      setBonus(edit.bonus || "");
      setShowForm(true);
    } else if (location.state?.openForm) {
      // Load draft if available
      const draft = getDraft();
      if (draft) {
        setName(draft.name || "");
        setDescription(draft.description || "");
        setBundlePrice(draft.bundlePrice || "");
        setImageUrl(draft.imageUrl || "");
        setCoverUrl(draft.coverUrl || "");
        setSelectedIds(draft.selectedIds || []);
        setSelectedStyleIds(draft.selectedStyleIds || []);
        setCategory(draft.category || "Tous");
        setIsGroup(draft.isGroup || false);
        setMinPersons(draft.minPersons || 2);
        setMaxPersons(draft.maxPersons || 6);
        setBonus(draft.bonus || "");
      }
      setShowForm(true);
    } else {
      // Check for draft on mount
      const draft = getDraft();
      if (draft) {
        setShowForm(true);
        setName(draft.name || "");
        setDescription(draft.description || "");
        setBundlePrice(draft.bundlePrice || "");
        setImageUrl(draft.imageUrl || "");
        setCoverUrl(draft.coverUrl || "");
        setSelectedIds(draft.selectedIds || []);
        setSelectedStyleIds(draft.selectedStyleIds || []);
        setCategory(draft.category || "Tous");
        setIsGroup(draft.isGroup || false);
        setMinPersons(draft.minPersons || 2);
        setMaxPersons(draft.maxPersons || 6);
        setBonus(draft.bonus || "");
      }
    }
  }, [location.state]);

  // Auto-save draft on field changes
  useEffect(() => {
    if (!showForm || editingBundle) return;
    if (!name && !description && !bundlePrice && selectedIds.length === 0 && selectedStyleIds.length === 0) return;
    const timer = setTimeout(() => {
      saveDraft({ name, description, bundlePrice, imageUrl, coverUrl, selectedIds, selectedStyleIds, category, isGroup, minPersons, maxPersons, bonus });
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    }, 1500);
    return () => clearTimeout(timer);
  }, [name, description, bundlePrice, imageUrl, coverUrl, selectedIds, selectedStyleIds, category, isGroup, minPersons, maxPersons, bonus, showForm, editingBundle]);

  const resetForm = () => {
    setName(""); setDescription(""); setBundlePrice(""); setImageUrl(""); setCoverUrl("");
    setSelectedIds([]); setSelectedStyleIds([]); setCategory("Tous"); setIsGroup(false);
    setMinPersons(2); setMaxPersons(6); setBonus("");
    setEditingBundle(null); setBundleServiceSearch(""); setBundleStyleSearch(""); setValidationError("");
    clearDraft();
  };

  const toggleService = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleStyle = (id) => {
    setSelectedStyleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const processUploadedFile = async (file) => {
    if (!file) return "";
    try {
      const res = await uploadFile(file, "uploads");
      if (typeof res === "string" && res) return res;
      if (res?.file_url) return res.file_url;
      if (res?.url) return res.url;
    } catch (err) {
      console.warn("Storage upload failed, using Data URL fallback:", err);
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  const handleImgUpload = async (file) => {
    if (!file) return;
    setUploadingImg(true);
    try { const url = await processUploadedFile(file); setImageUrl(url); } catch (e) { console.error(e); }
    setUploadingImg(false);
  };

  const handleBannerUpload = async (file) => {
    if (!file) return;
    setUploadingBanner(true);
    try { const url = await processUploadedFile(file); setCoverUrl(url); } catch (e) { console.error(e); }
    setUploadingBanner(false);
  };

  const filteredServices = svcCategoryFilter === "Tous"
    ? services
    : services.filter(s => (s.category || "").toLowerCase() === svcCategoryFilter.toLowerCase());
  const searchedServices = bundleServiceSearch
    ? filteredServices.filter(s => (s.title || s.name || "").toLowerCase().includes(bundleServiceSearch.toLowerCase()))
    : filteredServices;
  const searchedStyles = bundleStyleSearch
    ? styles.filter(s => (s.title || "").toLowerCase().includes(bundleStyleSearch.toLowerCase()))
    : styles;
  const selectedServices = services.filter(s => selectedIds.includes(s.id));
  const regularTotal = selectedServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const discount = regularTotal > 0 && bundlePrice ? Math.round(((regularTotal - parseFloat(bundlePrice)) / regularTotal) * 100) : 0;
  const totalDuration = selectedServices.reduce((sum, s) => sum + (parseInt(s.duration || s.duration_min) || 60), 0);

  const handleSave = async () => {
    if (!name.trim()) {
      setValidationError("Veuillez saisir un nom pour le bundle");
      setTimeout(() => setValidationError(""), 3500);
      return;
    }
    if (selectedIds.length === 0) {
      setValidationError("Veuillez sélectionner au moins 1 service inclus");
      setTimeout(() => setValidationError(""), 3500);
      return;
    }
    if (!bundlePrice) {
      setValidationError("Veuillez indiquer le prix du bundle");
      setTimeout(() => setValidationError(""), 3500);
      return;
    }
    setSaving(true);
    setValidationError("");
    const finalImg = imageUrl || coverUrl || "";
    const payload = {
      pro_email: user.email,
      name: name.trim(),
      description: description.trim(),
      service_ids: selectedIds,
      style_ids: selectedStyleIds,
      bundle_price: parseFloat(bundlePrice),
      discount_percent: discount > 0 ? discount : 0,
      image_url: finalImg,
      category: category !== "Tous" ? category : "",
      is_group: isGroup,
      min_persons: isGroup ? minPersons : 1,
      max_persons: isGroup ? maxPersons : 1,
      bundle_price_per_person: parseFloat(bundlePrice),
      bonus: bonus.trim(),
    };
    try {
      if (editingBundle) {
        payload.updated_at = new Date().toISOString();
        const { error } = await supabase.from("ServiceBundle").update(payload).eq("id", editingBundle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ServiceBundle").insert(payload);
        if (error) throw error;
      }
      // Rafraîchir la liste après sauvegarde réussie
      const { data, error: fetchErr } = await supabase.from("ServiceBundle").select("*").eq("pro_email", user.email).order("created_at", { ascending: false });
      if (!fetchErr) setBundles(data || []);
      clearDraft();
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("[CreerBundle] Save error:", err);
      setValidationError("Erreur : " + (err.message || "impossible de sauvegarder le bundle"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => {
    saveDraft({ name, description, bundlePrice, imageUrl, coverUrl, selectedIds, selectedStyleIds, category, isGroup, minPersons, maxPersons, bonus });
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  };

  const handleDelete = async (id) => {
    await supabase.from("ServiceBundle").delete().eq("id", id);
    setBundles(b => b.filter(x => x.id !== id));
    setDeleteModal(null);
  };

  const startEdit = (b) => {
    setEditingBundle(b);
    setName(b.name || "");
    setDescription(b.description || "");
    setBundlePrice(b.bundle_price?.toString() || "");
    setImageUrl(b.image_url || "");
    setCoverUrl(b.cover_url || b.banner_url || "");
    setSelectedIds(b.service_ids || []);
    setSelectedStyleIds(b.style_ids || []);
    setCategory(b.category || "Tous");
    setIsGroup(b.is_group || false);
    setMinPersons(b.min_persons || 2);
    setMaxPersons(b.max_persons || 6);
    setBonus(b.bonus || "");
    setShowForm(true);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  return (
    <div className="font-display min-h-full" style={{ background: themeBg }}>
      <PageHeader
        title={showForm ? (editingBundle ? "Modifier le Bundle" : "Créer un Bundle") : "Mes Bundles"}
        subtitle="Gestion Professionnelle"
        dark={false}
      />

      <div className="px-5 pt-5 pb-32 space-y-5">
        {showForm ? (
          <>
            <button onClick={() => { resetForm(); setShowForm(false); }}
              className="flex items-center gap-2 text-[13px] font-bold text-gray-500 active:scale-95 transition-transform">
              <ArrowLeft className="w-4 h-4" /> Retour à la liste
            </button>

            <div className="flex items-start gap-3">
              <input type="file" ref={imgRef} accept="image/*" className="hidden" onChange={e => handleImgUpload(e.target.files?.[0])} />
              <button onClick={() => imgRef.current?.click()} disabled={uploadingImg}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden shrink-0 bg-white">
                {imageUrl ? (
                  <BeautyImage src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : uploadingImg ? (
                  <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-gray-300" />
                )}
              </button>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du bundle (ex: Bundle Roots)"
                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#E8732A]" />
            </div>

            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optionnel)"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#E8732A]" />

            {/* Section Bannière Bundle */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-[#ff6b35]" /> BANNIÈRE BUNDLE (Page Détaillée)
              </p>
              <input type="file" ref={bannerImgRef} accept="image/*" className="hidden" onChange={e => handleBannerUpload(e.target.files?.[0])} />
              <div onClick={() => bannerImgRef.current?.click()}
                className="relative h-36 w-full rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden bg-white flex flex-col items-center justify-center cursor-pointer hover:border-[#ff6b35] transition-all group shadow-sm">
                {coverUrl ? (
                  <>
                    <BeautyImage src={coverUrl} alt="Bannière Bundle" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-white text-[12px] font-black uppercase tracking-wider bg-black/60 px-3 py-1.5 rounded-full">Changer la bannière</span>
                    </div>
                  </>
                ) : uploadingBanner ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] text-gray-400 font-bold">Téléversement...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                      <Image className="w-5 h-5 text-[#ff6b35]" />
                    </div>
                    <p className="text-[12px] font-black text-gray-700">Ajouter une photo de bannière</p>
                    <p className="text-[10px] text-gray-400 font-medium">Recommandé : image grand format (ex: 800x400) pour la vue détaillée</p>
                  </div>
                )}
              </div>

              {/* Bouton Générer avec les modèles Beauty Studio */}
              <button type="button" onClick={() => setShowBannerStudio(true)}
                className="mt-2.5 w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white rounded-2xl p-3 flex items-center justify-center gap-2 text-[12px] font-black shadow-md shadow-pink-500/20 active:scale-95 transition-all">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Générer avec un Modèle Beauty Studio ✨
              </button>
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Tag className="w-3 h-3" /> Catégorie</p>
              <div className="flex flex-wrap gap-2">
                {BUNDLE_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-2 rounded-full text-[12px] font-black border-2 transition-all active:scale-95 ${category === c ? "border-[#E8732A] bg-[#E8732A] text-white" : "border-gray-200 text-gray-600 bg-white"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-black text-gray-900">Bundle Groupe</p>
                  <p className="text-[11px] text-gray-400">Plusieurs personnes, plus d'éclat ✨</p>
                </div>
                <div onClick={() => setIsGroup(!isGroup)} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${isGroup ? "bg-primary" : "bg-gray-200"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isGroup ? "translate-x-7" : "translate-x-1"}`} />
                </div>
              </div>
              {isGroup && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min personnes</p>
                      <input type="number" min={2} max={10} value={minPersons} onChange={e => setMinPersons(Math.max(2, parseInt(e.target.value) || 2))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] font-black text-center outline-none focus:border-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Max personnes</p>
                      <input type="number" min={minPersons} max={20} value={maxPersons} onChange={e => setMaxPersons(Math.max(minPersons, parseInt(e.target.value) || minPersons))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] font-black text-center outline-none focus:border-primary" />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">De {minPersons} à {maxPersons} personnes</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Gift className="w-3 h-3" /> Bonus inclus (optionnel)</p>
              <input value={bonus} onChange={e => setBonus(e.target.value)} placeholder="Ex: Huile capillaire offerte 🎁"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#E8732A]" />
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Services inclus ({searchedServices.length})</p>
              <div className="flex gap-1.5 mb-3 overflow-x-auto hide-scrollbar">
                {BUNDLE_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setSvcCategoryFilter(c)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${svcCategoryFilter === c ? "bg-[#ff6b35] border-[#ff6b35] text-white" : "bg-white border-gray-200 text-gray-500"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={bundleServiceSearch} onChange={e => setBundleServiceSearch(e.target.value)}
                  placeholder="Rechercher un service..."
                  className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-[12px] outline-none focus:border-[#E8732A]" />
                {bundleServiceSearch && (
                  <button onClick={() => setBundleServiceSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>
              {loading ? (
                <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : searchedServices.length === 0 ? (
                <p className="text-[13px] text-gray-400 text-center py-6">Aucun service dans cette catégorie</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchedServices.map(s => {
                    const selected = selectedIds.includes(s.id);
                    return (
                      <div key={s.id} onClick={() => toggleService(s.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selected ? "bg-orange-50 border border-orange-200" : "bg-white border border-gray-200"}`}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? "bg-[#E8732A] border-[#E8732A]" : "border-gray-300"}`}>
                          {selected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black text-gray-900">{s.title || s.name}</p>
                          <p className="text-[11px] text-gray-400">{s.category} · {s.duration || s.duration_min || 60} min</p>
                        </div>
                        <span className="text-[14px] font-black text-primary shrink-0">{s.price}€</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-purple-50/60 rounded-2xl border border-purple-100 p-4">
              <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Styles associés ({selectedStyleIds.length})
              </p>
              <p className="text-[11px] text-gray-500 mb-3">Associez plusieurs publications style à ce bundle pour inspirer vos clients.</p>
              {styles.length > 0 && (
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={bundleStyleSearch} onChange={e => setBundleStyleSearch(e.target.value)} placeholder="Rechercher un style..."
                    className="w-full bg-white border border-purple-100 rounded-xl pl-9 pr-3 py-2.5 text-[12px] outline-none focus:border-purple-400" />
                </div>
              )}
              {searchedStyles.length === 0 ? (
                <p className="text-[12px] text-gray-400 py-2">Aucun style disponible</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {searchedStyles.map(style => {
                    const selected = selectedStyleIds.includes(style.id);
                    const cover = style.image_url || style.images?.[0];
                    return (
                      <button type="button" key={style.id} onClick={() => toggleStyle(style.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left border transition-all ${selected ? "bg-purple-100 border-purple-300" : "bg-white border-purple-100"}`}>
                        <span className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {cover ? <BeautyImage src={cover} alt="" className="w-full h-full object-cover" /> : <Image className="w-4 h-4 m-3 text-gray-300" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-black text-gray-800 truncate">{style.title || "Style sans titre"}</span>
                          <span className="block text-[10px] text-gray-400 truncate">{style.category || "Style"}</span>
                        </span>
                        {selected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                {isGroup ? "Prix du bundle (par personne)" : "Prix du bundle"}
              </p>
              <input type="number" value={bundlePrice} onChange={e => setBundlePrice(e.target.value)} placeholder="Prix €"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#E8732A]" />
              {discount > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[12px] text-gray-400 line-through">{regularTotal}€</span>
                  <span className="text-[14px] font-black text-[#E8732A]">{bundlePrice}€</span>
                  <span className="bg-green-100 text-green-700 text-[11px] font-black px-2 py-0.5 rounded-full">-{discount}%</span>
                </div>
              )}
              {totalDuration > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">Durée totale estimée : {Math.floor(totalDuration / 60)}h{totalDuration % 60 > 0 ? String(totalDuration % 60).padStart(2, '0') : ''}</p>
              )}
            </div>
          </>
        ) : (
          <>
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : bundles.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-2">
                  <Zap className="w-9 h-9 text-orange-400" strokeWidth={2.5} />
                </div>
                <p className="text-[18px] font-black text-gray-800">Aucun bundle</p>
                <p className="text-[13px] text-gray-400 text-center max-w-[260px]">Créez des packs de services pour fidéliser vos clients et augmenter vos revenus.</p>
                <button onClick={startCreate}
                  className="mt-3 bg-gradient-to-r from-[#E8732A] to-[#F59E0B] text-white rounded-2xl px-8 py-3.5 flex items-center gap-2 text-[13px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/25 active:scale-95 transition-all">
                  <Plus className="w-5 h-5" /> AJOUTER UN BUNDLE
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={startCreate}
                  className="w-full bg-[#E8732A] text-white text-[12px] font-black py-3.5 rounded-2xl shadow-lg shadow-[#E8732A]/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> AJOUTER UN BUNDLE
                </button>
                {bundles.map(b => {
                  const includedSvcs = services.filter(s => b.service_ids?.includes(s.id));
                  const regTotal = includedSvcs.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
                  return (
                    <div key={b.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-start gap-3">
                        {b.image_url ? (
                          <BeautyImage src={b.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                            <Zap className="w-6 h-6 text-orange-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black text-gray-900 truncate">{b.name}</p>
                          {b.description && <p className="text-[12px] text-gray-400 truncate mt-0.5">{b.description}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            {regTotal > 0 && <span className="text-[12px] text-gray-400 line-through">{regTotal}€</span>}
                            <span className="text-[16px] font-black text-[#E8732A]">{b.bundle_price}€</span>
                            {b.discount_percent > 0 && (
                              <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full">-{b.discount_percent}%</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {includedSvcs.slice(0, 3).map(s => (
                              <span key={s.id} className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{s.title || s.name}</span>
                            ))}
                            {includedSvcs.length > 3 && (
                              <span className="text-[10px] text-gray-400 font-medium">+{includedSvcs.length - 3}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => startEdit(b)} className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center active:scale-95">
                            <Pencil className="w-4 h-4 text-blue-500" />
                          </button>
                          <button onClick={() => setDeleteModal(b)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center active:scale-95">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {!showForm && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5" style={{ paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <button onClick={startCreate}
            className="w-full bg-[#E8732A] text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-[#E8732A]/40 flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Plus className="w-5 h-5" /> AJOUTER UN BUNDLE
          </button>
        </div>
      )}

      {showForm && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-5 z-[200] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]" style={{ paddingTop: "12px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          {validationError && (
            <div className="mb-2 bg-red-50 border border-red-200 text-red-600 text-[11px] font-black py-1.5 px-3 rounded-xl text-center flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-bottom-1">
              <span>⚠️</span> {validationError}
            </div>
          )}
          {draftSaved && (
            <p className="text-center text-[11px] text-green-500 font-bold mb-1 flex items-center justify-center gap-1"><Save className="w-3 h-3" /> Brouillon sauvegardé</p>
          )}
          <div className="flex gap-2">
            {!editingBundle && (name || bundlePrice || selectedIds.length > 0) && (
              <button onClick={handleSaveDraft}
                className="bg-gray-100 text-gray-600 font-bold text-[12px] px-4 py-4 rounded-2xl flex items-center gap-1.5 active:scale-95 transition-all">
                <Save className="w-4 h-4" /> Brouillon
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-gradient-to-r from-[#ff6b35] to-[#f7931e] text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-orange-500/40 flex items-center justify-center gap-2 active:scale-95 transition-all">
              {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : editingBundle ? "ENREGISTRER LE BUNDLE" : "+ AJOUTER UN BUNDLE"}
            </button>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setDeleteModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8 space-y-4" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-black text-gray-900">Supprimer le bundle</p>
              <button onClick={() => setDeleteModal(null)} className="p-2"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-[13px] text-gray-500">Voulez-vous vraiment supprimer « {deleteModal.name} » ? Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-[13px] font-black text-gray-600 active:scale-95 transition-all">
                Annuler
              </button>
              <button onClick={() => handleDelete(deleteModal.id)}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-[13px] font-black active:scale-95 transition-all">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {showBannerStudio && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowBannerStudio(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8 space-y-4 max-h-[90vh] overflow-y-auto" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-pink-50 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                </div>
                <div>
                  <p className="text-[15px] font-black text-gray-900">Studio Bannières BeautyBook</p>
                  <p className="text-[11px] text-gray-400 font-medium">Modèles graphiques pour salon de beauté</p>
                </div>
              </div>
              <button onClick={() => setShowBannerStudio(false)} className="p-2"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Prévisualisation en direct */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Aperçu de la bannière</p>
              <div className="relative h-44 w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200">
                <BeautyImage src={generateBannerSvg({ title: studioTitle || name || "PACK BEAUTÉ SUBLIME", badge: studioBadge, subtitle: studioSubtitle || description || "Profitez de nos rituels exclusifs", theme: studioTheme })} alt="Aperçu Studio" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Choix des modèles / thèmes */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">1. Choisissez un style graphique</p>
              <div className="grid grid-cols-2 gap-2">
                {BANNER_THEMES.map(th => (
                  <button key={th.id} onClick={() => { setStudioTheme(th.id); setStudioBadge(th.badgeDefault); }}
                    className={`p-2.5 rounded-2xl text-left border-2 transition-all flex items-center gap-2.5 ${studioTheme === th.id ? "border-[#ff6b35] bg-orange-50/50 shadow-sm" : "border-gray-100 bg-white"}`}>
                    <div className={`w-6 h-6 rounded-full shrink-0 ${th.previewBg}`} />
                    <span className="text-[11px] font-bold text-gray-800 truncate">{th.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Champs de personnalisation */}
            <div className="space-y-3 pt-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">2. Personnalisez le texte</p>
              <div>
                <label className="text-[11px] font-bold text-gray-700 mb-1 block">Titre principal de la bannière</label>
                <input type="text" value={studioTitle} onChange={e => setStudioTitle(e.target.value)} placeholder={name || "ex: PACK GLAMOUR ROOTS"}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[12px] font-bold outline-none focus:border-[#ff6b35]" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 mb-1 block">Badge d'accroche (ex: PROMO, VIP, EXCLUSIF)</label>
                <input type="text" value={studioBadge} onChange={e => setStudioBadge(e.target.value)} placeholder="ex: PACK ÉCLAT ✨"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[12px] font-bold outline-none focus:border-[#ff6b35]" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 mb-1 block">Sous-titre explicatif</label>
                <input type="text" value={studioSubtitle} onChange={e => setStudioSubtitle(e.target.value)} placeholder={description || "ex: Soin + Coiffure + Produit Offert"}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[12px] font-bold outline-none focus:border-[#ff6b35]" />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <button onClick={() => {
                const generatedSvg = generateBannerSvg({ title: studioTitle || name || "PACK BEAUTÉ SUBLIME", badge: studioBadge, subtitle: studioSubtitle || description || "Profitez de nos rituels exclusifs", theme: studioTheme });
                setCoverUrl(generatedSvg);
                setShowBannerStudio(false);
              }} className="w-full bg-gradient-to-r from-[#ff6b35] to-[#f7931e] text-white py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-wider shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Appliquer cette bannière au bundle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
