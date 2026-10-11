import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Eye, Play, Trash2, Map, Camera, X, Loader2,
  Upload, Image, ChevronLeft, ChevronRight, Move, Pencil, RotateCw
} from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import PanoViewer from "@/components/virtualtour/PanoViewer";
import PhotoGuide from "@/components/virtualtour/PhotoGuide";
import SceneEditor from "@/components/virtualtour/SceneEditor";

// ── Éditeur de hotspots ─────────────────────────────────────────────────────────
function HotspotEditor({ visite, sceneIdx: initialSceneIdx, theme = "dark", onSave, onClose }) {
  const [sceneIdx, setSceneIdx] = useState(initialSceneIdx);
  const [hotspots, setHotspots] = useState(visite.scenes[sceneIdx]?.hotspots || []);
  const [adding, setAdding] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Recharger les hotspots quand on change de scène
  useEffect(() => {
    setHotspots(visite.scenes[sceneIdx]?.hotspots || []);
  }, [sceneIdx, visite.id]);

  const otherScenes = visite.scenes
    .map((s, i) => ({ idx: i, title: s.title }))
    .filter((_, i) => i !== sceneIdx);

  const handleImageClick = (e) => {
    if (!adding || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
    setHotspots(prev => [...prev, { x: parseFloat(x), y: parseFloat(y), target_scene: null }]);
    setAdding(false);
  };

  const setHotspotTarget = (idx, targetIdx) => {
    setHotspots(prev => prev.map((h, i) => i === idx ? { ...h, target_scene: targetIdx } : h));
  };

  const removeHotspot = (idx) => setHotspots(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const updatedScenes = [...visite.scenes];
    updatedScenes[sceneIdx] = { ...updatedScenes[sceneIdx], hotspots };
    const updated = await entities.VisiteVirtuelle.update(visite.id, { scenes: updatedScenes });
    onSave(updated);
    onClose();
  };

  const isLight = theme === "light";
  const sheetBg = isLight ? "bg-white" : "bg-black";
  const sheetBorder = isLight ? "border-gray-200" : "border-gray-800";
  const handleBg = isLight ? "bg-gray-300" : "bg-gray-700";
  const headingColor = isLight ? "text-gray-900" : "text-white";
  const subColor = isLight ? "text-gray-400" : "text-gray-500";
  const closeColor = isLight ? "text-gray-500" : "text-gray-500";
  const tabActive = "bg-primary/20 border-primary text-primary";
  const tabInactive = isLight ? "bg-gray-100 border-gray-200 text-gray-500" : "bg-[#1a1a1a] border-gray-700 text-gray-500";
  const cardBg = isLight ? "bg-gray-50 border-gray-200" : "bg-[#1a1a1a] border-gray-800";
  const selectBg = isLight ? "bg-white text-gray-700 border-gray-200" : "bg-gray-800 text-gray-300 border-gray-700";
  const addBtn = isLight ? "bg-gray-100 text-gray-700" : "bg-gray-800 text-white";
  const deleteBg2 = isLight ? "bg-red-50" : "bg-red-500/10";
  const deleteIcon2 = isLight ? "text-red-500" : "text-red-400";
  const hotspotText = isLight ? "text-gray-900" : "text-white";
  const previewBg = isLight ? "bg-gray-200" : "bg-gray-900";

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${sheetBg} w-full rounded-t-3xl px-5 pt-4 pb-8 z-10 max-h-[90vh] overflow-y-auto border-t ${sheetBorder}`}>
        <div className={`w-10 h-1 ${handleBg} rounded-full mx-auto mb-4`} />
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-[18px] font-black ${headingColor}`}>Navigation 3D</h2>
          <button onClick={onClose}><X className={`w-5 h-5 ${closeColor}`} /></button>
        </div>
        <p className={`text-[11px] ${subColor} font-medium mb-3`}>Placez des points sur la vue pour naviguer entre les pièces</p>

        {/* Sélecteur de scène */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4">
          {visite.scenes.map((s, i) => (
            <button
              key={i}
              onClick={() => setSceneIdx(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${i === sceneIdx ? tabActive : tabInactive}`}
            >
              {s.title || `Scène ${i + 1}`}
            </button>
          ))}
        </div>

        {/* Preview zone */}
        <div
          ref={containerRef}
          className={`relative rounded-2xl overflow-hidden mb-4 cursor-crosshair ${previewBg}`}
          style={{ aspectRatio: "4/3" }}
          onClick={handleImageClick}
        >
          <BeautyImage
            ref={imgRef}
            src={visite.scenes[sceneIdx]?.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
          {hotspots.map((h, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg ${h.target_scene != null ? "bg-primary border-white" : "bg-white/80 border-gray-300"}`}>
                <span className="text-[10px] font-black">{h.target_scene != null ? "→" : "?"}</span>
              </div>
            </div>
          ))}
          {adding && (
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
              <span className="text-white text-[14px] font-black bg-black/50 px-4 py-2 rounded-full">Tapez sur l'image pour placer un point</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setAdding(true)}
          className={`w-full ${addBtn} text-[12px] font-black uppercase tracking-widest py-3 rounded-2xl mb-4 active:scale-[0.98] transition-all`}
        >
          + Ajouter un point de navigation
        </button>

        {/* Liste des hotspots */}
        {hotspots.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className={`text-[10px] font-black ${subColor} uppercase tracking-widest mb-2`}>Points ({hotspots.length})</p>
            {hotspots.map((h, i) => (
              <div key={i} className={`${cardBg} rounded-2xl p-3 flex items-center gap-3 border`}>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Move className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-black ${hotspotText}`}>Point {i + 1} ({h.x}%, {h.y}%)</p>
                  <select
                    value={h.target_scene ?? ""}
                    onChange={e => setHotspotTarget(i, e.target.value ? parseInt(e.target.value) : null)}
                    className={`mt-1 text-[11px] font-medium ${selectBg} rounded-lg px-2 py-1 outline-none border w-full`}
                  >
                    <option value="">-- Destination --</option>
                    {otherScenes.map(s => (
                      <option key={s.idx} value={s.idx}>{s.title}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => removeHotspot(i)} className={`w-8 h-8 ${deleteBg2} rounded-lg flex items-center justify-center shrink-0`}>
                  <Trash2 className={`w-4 h-4 ${deleteIcon2}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full bg-primary text-white font-black text-[13px] uppercase tracking-widest py-4 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Fiche immobilière avant la création de la visite ───────────────────────────
function PropertySetupModal({ theme = "light", listings = [], form, setForm, onClose, onSubmit, saving }) {
  const isLight = theme === "light";
  const input = `w-full rounded-xl border px-3 py-2.5 text-[12px] outline-none focus:border-primary ${isLight ? "bg-gray-50 border-gray-200 text-gray-800" : "bg-[#1a1a1a] border-gray-700 text-white"}`;
  const label = `text-[9px] font-black uppercase tracking-widest ${isLight ? "text-gray-500" : "text-gray-400"}`;
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={onSubmit} className={`relative z-10 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 ${isLight ? "bg-white" : "bg-black"}`}>
        <div className={`w-10 h-1 rounded-full mx-auto mb-4 ${isLight ? "bg-gray-200" : "bg-gray-700"}`} />
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className={`text-[18px] font-black ${isLight ? "text-gray-900" : "text-white"}`}>Créer une visite virtuelle</h2>
            <p className={`text-[11px] mt-1 ${isLight ? "text-gray-500" : "text-gray-400"}`}>Commencez par créer la fiche du bien, comme pour une annonce immobilière.</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {listings.length > 0 && (
          <label className="block mt-4">
            <span className={label}>Fiche existante à associer (optionnel)</span>
            <select value={form.listing_id} onChange={e => set("listing_id", e.target.value)} className={`${input} mt-1`}>
              <option value="">Créer une nouvelle fiche immobilière</option>
              {listings.map(listing => <option key={listing.id} value={listing.id}>{listing.title || "Annonce sans titre"}</option>)}
            </select>
          </label>
        )}

        {!form.listing_id && (
          <>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <label><span className={label}>Titre *</span><input required value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ex : Studio bb" className={`${input} mt-1`} /></label>
              <label><span className={label}>Type</span><select value={form.type} onChange={e => set("type", e.target.value)} className={`${input} mt-1`}><option value="location">Location</option><option value="vente">Vente</option></select></label>
            </div>
            <label className="block mt-3"><span className={label}>Description</span><textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className={`${input} mt-1 resize-none`} placeholder="Présentez le bien et son activité" /></label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label><span className={label}>Prix (€) *</span><input required type="number" min="0" value={form.price} onChange={e => set("price", e.target.value)} placeholder="500" className={`${input} mt-1`} /></label>
              <label><span className={label}>Unité</span><input value={form.unit} onChange={e => set("unit", e.target.value)} placeholder="/MOIS" className={`${input} mt-1`} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label><span className={label}>Adresse complète</span><input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Adresse" className={`${input} mt-1`} /></label>
              <label><span className={label}>Ville</span><input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Évry-Courcouronnes" className={`${input} mt-1`} /></label>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <label><span className={label}>Code postal</span><input value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="91000" className={`${input} mt-1`} /></label>
              <label><span className={label}>Surface (m²)</span><input type="number" min="0" value={form.surface} onChange={e => set("surface", e.target.value)} placeholder="80" className={`${input} mt-1`} /></label>
              <label><span className={label}>Nombre de sièges</span><input type="number" min="1" value={form.seats_count} onChange={e => set("seats_count", e.target.value)} placeholder="3" className={`${input} mt-1`} /></label>
            </div>
            <label className="block mt-3"><span className={label}>Équipements</span><input value={form.equip} onChange={e => set("equip", e.target.value)} placeholder="Fauteuils, miroirs..." className={`${input} mt-1`} /></label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label><span className={label}>CA estimé / mois (€)</span><input type="number" min="0" value={form.estimated_turnover} onChange={e => set("estimated_turnover", e.target.value)} placeholder="5500" className={`${input} mt-1`} /></label>
              <label><span className={label}>Revenu net / mois (€)</span><input type="number" min="0" value={form.estimated_net_revenue} onChange={e => set("estimated_net_revenue", e.target.value)} placeholder="3200" className={`${input} mt-1`} /></label>
            </div>
          </>
        )}

        <button type="submit" disabled={saving} className="w-full mt-5 bg-primary text-white rounded-2xl py-3.5 text-[12px] font-black uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</> : "Créer la fiche et continuer"}
        </button>
      </form>
    </div>
  );
}

// ── Viewer 360° utilisant Three.js ──────────────────────────────────────────────

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Visite3D() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [visites, setVisites] = useState([]);
  const [proInfo, setProInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [propertySaving, setPropertySaving] = useState(false);
  const [propertyListings, setPropertyListings] = useState([]);
  const [propertyForm, setPropertyForm] = useState({
    listing_id: "", title: "", description: "", type: "location", price: "", unit: "/MOIS",
    address: "", city: "", postal_code: "", surface: "", seats_count: "", equip: "",
    estimated_turnover: "", estimated_net_revenue: "",
  });

  const isLight = theme === "light";

  // Guide première visite
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);

  // Modals
  const [activeVisite, setActiveVisite] = useState(null);
  const [editingVisite, setEditingVisite] = useState(null); // pour SceneEditor
  const [hotspotVisite, setHotspotVisite] = useState(null);
  const [hotspotSceneIdx, setHotspotSceneIdx] = useState(0);

  useEffect(() => {
    if (!user?.email) return;
    Promise.all([
      entities.ProfilPro.filter({ user_email: user.email }, "-created_at", 1).catch(() => []),
      entities.VisiteVirtuelle.filter({ pro_email: user.email }, "-created_at", 5).catch(() => []),
      entities.ImmobilierListing.filter({ pro_email: user.email }, "-created_at", 50).catch(() => []),
    ]).then(([profils, v, listings]) => {
      if (profils.length > 0) setProInfo(profils[0]);
      setVisites(v);
      setPropertyListings(listings);
      setLoading(false);
    });
  }, [user?.email]);

  // Ouvrir le guide automatiquement à la première visite
  useEffect(() => {
    try {
      const seen = localStorage.getItem("bb_visite3d_guide_seen");
      if (!seen) {
        setShowWelcomeGuide(true);
        localStorage.setItem("bb_visite3d_guide_seen", "1");
      }
    } catch {}
  }, []);

  const hasVisite = visites.length > 0;

  const createVisite = async (event) => {
    if (!user?.email) return;
    setCreating(true);
    setPropertySaving(true);
    try {
      const selected = event.listing_id ? propertyListings.find(item => item.id === event.listing_id) : null;
      let listing = selected;
      if (!listing) {
        listing = await entities.ImmobilierListing.create({
          title: event.title || proInfo?.salon_name || "Mon établissement",
          description: event.description || "",
          type: event.type || "location",
          price: Number(event.price) || 0,
          unit: event.unit || "/MOIS",
          address: event.address || "",
          location: event.city || "",
          city: event.city || "",
          postal_code: event.postal_code || "",
          surface: event.surface === "" ? null : Number(event.surface) || 0,
          seats_count: event.seats_count === "" ? null : parseInt(event.seats_count, 10) || 0,
          equip: event.equip || "",
          estimated_turnover: event.estimated_turnover === "" ? null : Number(event.estimated_turnover) || 0,
          estimated_net_revenue: event.estimated_net_revenue === "" ? null : Number(event.estimated_net_revenue) || 0,
          images: [],
          status: "brouillon",
          created_by_id: user.id,
        });
      }
      const propertyTitle = listing.title || proInfo?.salon_name || "Mon établissement";
      const payload = {
        title: propertyTitle,
        name: propertyTitle,
        scenes: [],
        status: "brouillon",
        pro_email: user.email,
        created_by_id: user.id,
      };
      let v;
      try {
        v = await entities.VisiteVirtuelle.create(payload);
      } catch (firstError) {
        // Compatibilité avec les anciennes bases qui utilisent `name` sans `title`,
        // ou les nouvelles qui utilisent uniquement `title`.
        const message = String(firstError?.message || firstError || "").toLowerCase();
        if (!message.includes("column") && !message.includes("schema cache") && !message.includes("not-null")) throw firstError;
        const fallbackPayload = { ...payload };
        if (message.includes("title")) delete fallbackPayload.title;
        if (message.includes("name")) delete fallbackPayload.name;
        v = await entities.VisiteVirtuelle.create(fallbackPayload);
      }
      if (!v) throw new Error("La création a retourné null — vérifiez que la table VisiteVirtuelle existe dans Supabase et que les RLS policies autorisent l'insertion.");
      await entities.ImmobilierListing.update(listing.id, { virtual_tour_id: v.id });
      const linkedListing = { ...listing, virtual_tour_id: v.id };
      setPropertyListings(prev => prev.map(item => item.id === linkedListing.id ? linkedListing : item));
      setVisites(prev => [v, ...prev]);
      setEditingVisite(v);
      setPropertyFormOpen(false);
    } catch (err) {
      console.error('[Visite3D] createVisite error:', err);
      alert("Erreur lors de la création : " + (err.message || err));
    } finally {
      setCreating(false);
      setPropertySaving(false);
    }
  };

  const deleteVisite = async (id) => {
    await entities.VisiteVirtuelle.delete(id);
    setVisites(prev => prev.filter(v => v.id !== id));
  };

  const toggleStatus = async (v) => {
    const updated = await entities.VisiteVirtuelle.update(v.id, {
      status: v.status === "actif" ? "brouillon" : "actif"
    });
    setVisites(prev => prev.map(x => x.id === v.id ? updated : x));
  };

  // Viewer 360°
  if (activeVisite) {
    return (
      <PanoViewer
        scenes={activeVisite.scenes}
        floorplanUrl={activeVisite.floorplan_url}
        onClose={() => setActiveVisite(null)}
      />
    );
  }

  return (
    <div className={`font-display min-h-full pb-24 ${isLight ? "bg-[#f8f9fa]" : "bg-black"}`}>
      {/* Header */}
      <div className={`px-5 pt-5 pb-3 flex items-center justify-between sticky top-0 z-10 ${isLight ? "bg-white border-b border-gray-100" : "bg-black"}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profil-pro")} className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 ${isLight ? "bg-gray-100" : "bg-[#1a1a1a]"}`}>
            <ArrowLeft className={`w-4 h-4 ${isLight ? "text-gray-700" : "text-white"}`} />
          </button>
          <div>
            <h1 className={`text-[22px] font-black ${isLight ? "text-gray-900" : "text-white"}`}>Visite 3D</h1>
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Visites virtuelles</p>
          </div>
        </div>
        {!hasVisite && (
          <button
            onClick={() => setPropertyFormOpen(true)}
            disabled={creating}
            className={`w-9 h-9 rounded-full flex items-center justify-center border active:scale-95 ${isLight ? "bg-gray-100 border-gray-200" : "bg-[#1a1a1a] border-gray-800"}`}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Plus className={`w-5 h-5 ${isLight ? "text-gray-700" : "text-white"}`} />}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "VISITES", value: visites.length },
            { label: "ACTIVES", value: visites.filter(v => v.status === "actif").length },
            { label: "SCÈNES", value: visites.reduce((s, v) => s + (v.scenes?.length || 0), 0) },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-4 text-center border ${isLight ? "bg-white border-gray-100 shadow-sm" : "bg-[#1a1a1a] border-gray-800"}`}>
              <p className={`text-[24px] font-black ${isLight ? "text-gray-900" : "text-white"}`}>{s.value}</p>
              <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isLight ? "text-gray-400" : "text-gray-500"}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className="px-5 mb-5">
        <div className={`rounded-3xl p-4 border border-cyan-500/20 flex items-start gap-3 ${isLight ? "bg-white shadow-sm" : "bg-[#121212]"}`}>
          <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center shrink-0">
            <Map className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className={`text-[13px] font-black ${isLight ? "text-gray-900" : "text-white"}`}>Visites virtuelles 3D</p>
            <p className={`text-[11px] font-medium mt-0.5 ${isLight ? "text-gray-500" : "text-gray-400"}`}>
              {proInfo?.salon_name
                ? <>Permettez à vos clients de découvrir <span className={isLight ? "text-gray-900 font-bold" : "text-white font-bold"}>{proInfo.salon_name}</span> avant même d'y venir.</>
                : "Permettez à vos clients de découvrir votre salon avant même d'y venir."
              }
            </p>
          </div>
        </div>
      </div>

      {/* Étapes du processus */}
      {hasVisite && (
        <div className="px-5 mb-5">
          <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isLight ? "text-gray-400" : "text-gray-500"}`}>
            <span>1. Photos</span>
            <span className={isLight ? "text-gray-300" : "text-gray-700"}>→</span>
            <span>2. Navigation</span>
            <span className={isLight ? "text-gray-300" : "text-gray-700"}>→</span>
            <span>3. Publier</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : visites.length === 0 ? (
          <div className={`rounded-3xl p-10 flex flex-col items-center border ${isLight ? "bg-white border-gray-100 shadow-sm" : "bg-[#121212] border-gray-800"}`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isLight ? "bg-gray-100" : "bg-[#1a1a1a]"}`}>
              <Camera className={`w-8 h-8 ${isLight ? "text-gray-400" : "text-white/40"}`} />
            </div>
            <p className={`text-[16px] font-black mb-2 ${isLight ? "text-gray-900" : "text-white"}`}>Aucune visite virtuelle</p>
            <p className={`text-[13px] font-medium text-center mb-6 ${isLight ? "text-gray-500" : "text-gray-400"}`}>
              {proInfo?.salon_name ? <>Créez une visite pour <span className={isLight ? "text-gray-900" : "text-white"}>{proInfo.salon_name}</span></> : "Créez votre première expérience 3D"}
            </p>
            <button
              onClick={() => setPropertyFormOpen(true)}
              disabled={creating}
              className="w-full bg-primary text-white text-[13px] font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</> : "Créer ma visite"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visites.map(v => {
              const sceneCount = v.scenes?.length || 0;
              const coverUrl = v.scenes?.[0]?.image_url || v.cover_url || "";
              return (
                <div key={v.id} className={`rounded-3xl overflow-hidden border ${isLight ? "bg-white border-gray-100 shadow-sm" : "bg-[#121212] border-gray-800"}`}>
                  {/* Couverture */}
                  <div className="relative h-44">
                    {coverUrl ? (
                      <BeautyImage src={coverUrl} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                        <Image className="w-10 h-10 text-gray-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    {sceneCount > 0 && (
                      <button onClick={() => setActiveVisite(v)} className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/40">
                          <RotateCw className="w-7 h-7 text-white" />
                        </div>
                      </button>
                    )}
                    <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${v.status === "actif" ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300"}`}>
                      {v.status === "actif" ? "Actif" : "Brouillon"}
                    </span>
                    <button onClick={() => deleteVisite(v.id)} className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-white/70" />
                    </button>
                  </div>

                  <div className="p-4">
                    <h3 className={`text-[16px] font-black flex items-center gap-2 ${isLight ? "text-gray-900" : "text-white"}`}>
                      {v.title || v.name || "Visite sans nom"}
                      <button onClick={() => setEditingVisite(v)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${isLight ? "bg-gray-100" : "bg-gray-800"}`}>
                        <Pencil className={`w-3 h-3 ${isLight ? "text-gray-500" : "text-gray-400"}`} />
                      </button>
                    </h3>
                    <p className={`text-[11px] font-medium mt-1 ${isLight ? "text-gray-500" : "text-gray-400"}`}>{sceneCount} scène{sceneCount !== 1 ? "s" : ""}</p>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <button
                        onClick={() => setEditingVisite(v)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-2xl border active:scale-[0.98] transition-all ${isLight ? "bg-gray-50 border-gray-200" : "bg-[#1a1a1a] border-gray-800"}`}
                      >
                        <Upload className="w-4 h-4 text-cyan-400" />
                        <span className={`text-[9px] font-black uppercase ${isLight ? "text-gray-500" : "text-gray-400"}`}>Photos</span>
                      </button>
                      <button
                        onClick={() => { setHotspotVisite(v); setHotspotSceneIdx(0); }}
                        disabled={sceneCount < 2}
                        className={`flex flex-col items-center gap-1 py-3 rounded-2xl border active:scale-[0.98] transition-all disabled:opacity-30 ${isLight ? "bg-gray-50 border-gray-200" : "bg-[#1a1a1a] border-gray-800"}`}
                      >
                        <Move className="w-4 h-4 text-yellow-400" />
                        <span className={`text-[9px] font-black uppercase ${isLight ? "text-gray-500" : "text-gray-400"}`}>Navigation</span>
                      </button>
                      <button
                        onClick={() => toggleStatus(v)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-2xl border active:scale-[0.98] transition-all ${v.status === "actif" ? "bg-green-500/10 border-green-500/20" : isLight ? "bg-gray-50 border-gray-200" : "bg-[#1a1a1a] border-gray-800"}`}
                      >
                        <Eye className={`w-4 h-4 ${v.status === "actif" ? "text-green-400" : isLight ? "text-gray-500" : "text-gray-500"}`} />
                        <span className={`text-[9px] font-black uppercase ${v.status === "actif" ? "text-green-400" : isLight ? "text-gray-500" : "text-gray-500"}`}>
                          {v.status === "actif" ? "Actif" : "Publier"}
                        </span>
                      </button>
                    </div>

                    {sceneCount > 0 && (
                      <button
                        onClick={() => setActiveVisite(v)}
                        className={`w-full mt-3 border text-[12px] font-black uppercase tracking-widest py-3 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isLight ? "bg-cyan-50 border-cyan-200 text-cyan-600" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"}`}
                      >
                        <RotateCw className="w-4 h-4" /> Lancer la visite 3D
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scene Editor Modal */}
      {editingVisite && (
        <SceneEditor
          visite={editingVisite}
          theme={theme}
          onSave={(updated) => setVisites(prev => prev.map(x => x.id === updated.id ? updated : x))}
          onClose={() => setEditingVisite(null)}
        />
      )}

      {/* Hotspot Editor Modal */}
      {hotspotVisite && (
        <HotspotEditor
          visite={hotspotVisite}
          sceneIdx={hotspotSceneIdx}
          theme={theme}
          onSave={(updated) => {
            setVisites(prev => prev.map(x => x.id === updated.id ? updated : x));
            setHotspotVisite(updated);
          }}
          onClose={() => setHotspotVisite(null)}
        />
      )}

      {propertyFormOpen && (
        <PropertySetupModal
          theme={theme}
          listings={propertyListings}
          form={propertyForm}
          setForm={setPropertyForm}
          saving={propertySaving}
          onClose={() => setPropertyFormOpen(false)}
          onSubmit={e => { e.preventDefault(); createVisite(propertyForm); }}
        />
      )}

      {/* Guide première visite */}
      {showWelcomeGuide && (
        <PhotoGuide theme={theme} onClose={() => setShowWelcomeGuide(false)} />
      )}
    </div>
  );
}
