import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X, Clock, Phone, Mail, Building2, Car, Moon, ImagePlus, CheckCircle, Store, AtSign, Plus, Trash2, AlertCircle, Camera, Upload, MapPin, Wifi, ParkingCircle, Wind, Baby, Coffee, CreditCard, Sofa, Music, UtensilsCrossed, Wine, Tv, Lightbulb, Thermometer, Star, Lock, Sun, GripVertical, Volume2, Accessibility, Shirt, ShowerHead, PawPrint, BookOpen, Sparkles, Zap } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuth } from "@/lib/AuthContext";
import { writeIsProCache } from "@/hooks/useIsPro";
import { entities, uploadFile } from "@/api/entities";
import { apiClient } from "@/lib/apiClient";
import { supabase } from '@/api/supabaseClient';

const TOTAL_STEPS = 5;
const DRAFT_KEY = "bb_devenir_pro_draft";

// ─── Autocomplete adresse via Base Adresse Nationale (BAN) ─────────────────
function AddressAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const fetchSuggestions = async (input) => {
    if (!input || input.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(input)}&limit=6`);
      if (res.ok) {
        const json = await res.json();
        const features = json.features || [];
        setSuggestions(features);
        setOpen(features.length > 0);
      } else {
        setSuggestions([]);
      }
    } catch { setSuggestions([]); }
    setLoading(false);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setOpen(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const selectPlace = (item) => {
    setOpen(false);
    setSuggestions([]);
    const props = item.properties || {};
    const label = props.label || props.name || '';
    const city = props.city || '';
    const postalCode = props.postcode || '';
    const address = props.name || label;

    onChange(label);
    if (onSelect) {
      onSelect({
        address,
        fullAddress: label,
        city,
        postalCode,
      });
    }
  };

  return (
    <div className="relative">
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3 focus-within:border-primary transition-colors">
        <MapPin className="w-5 h-5 text-gray-300 shrink-0" />
        <input
          placeholder="Ex : 12 rue de la Paix, 75001 Paris"
          value={value}
          onChange={handleChange}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-300"
        />
        {loading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((item, i) => (
            <button
              key={item.properties?.id || i}
              type="button"
              onMouseDown={() => selectPlace(item)}
              className="w-full text-left px-4 py-3 text-[13px] text-gray-700 flex items-start gap-2.5 border-b border-gray-100 last:border-0 hover:bg-orange-50 active:bg-orange-100 transition-colors"
            >
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-800 leading-snug">{item.properties?.label || item.properties?.name}</p>
                <p className="text-[11px] text-gray-400">{item.properties?.postcode} {item.properties?.city} {item.properties?.context ? `(${item.properties.context})` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Tambour sélecteur de sièges ─────────────────────────────────────────────
function SeatsDrumPicker({ value, onChange }) {
  const MAX = 20;
  const ITEM_H = 48;
  const VISIBLE = 5;
  const containerRef = useRef(null);
  const items = Array.from({ length: MAX }, (_, i) => i + 1);

  const scrollTo = (val) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = (val - 1) * ITEM_H;
  };

  useEffect(() => { scrollTo(value); }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(containerRef.current.scrollTop / ITEM_H);
    const newVal = Math.min(Math.max(idx + 1, 1), MAX);
    if (newVal !== value) onChange(newVal);
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Tambour */}
      <div className="relative w-full overflow-hidden rounded-3xl bg-gray-50 border border-gray-200" style={{ height: ITEM_H * VISIBLE }}>
        {/* Sélection centrale highlight */}
        <div className="absolute left-0 right-0 pointer-events-none z-10"
          style={{ top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H, background: "rgba(232,115,42,0.08)", borderTop: "2px solid #E8732A", borderBottom: "2px solid #E8732A" }} />

        {/* Dégradés haut/bas */}
        <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-10" style={{ background: "linear-gradient(to bottom, #f9fafb, transparent)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-10" style={{ background: "linear-gradient(to top, #f9fafb, transparent)" }} />

        <div
          ref={containerRef}
          className="overflow-y-scroll hide-scrollbar"
          style={{ height: "100%", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
          onScroll={handleScroll}
        >
          {/* Padding haut pour centrer le 1er item */}
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
          {items.map(n => (
            <div key={n}
              onClick={() => { onChange(n); scrollTo(n); }}
              className="flex items-center justify-center cursor-pointer transition-all"
              style={{ height: ITEM_H, scrollSnapAlign: "center" }}>
              <span className={`font-black transition-all ${n === value ? "text-[32px] text-primary" : "text-[20px] text-gray-300"}`}>
                {n}
              </span>
            </div>
          ))}
          {/* Padding bas pour centrer le dernier item */}
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        </div>
      </div>

      {/* Label sous le tambour */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[28px] font-black text-primary">{value}</span>
        <span className="text-[14px] font-bold text-gray-500">{value === 1 ? "siège" : "sièges"}</span>
      </div>
      <p className="text-[11px] text-gray-400 font-medium mt-0.5">
        {value === 1 ? "1 client à la fois" : `Jusqu'à ${value} clients simultanément`}
      </p>
    </div>
  );
}

// ─── Step 1: Profil & Identité ────────────────────────────────────────────────
function Step1({ data, setData, errors }) {
  const services = ["Coiffure", "Maquillage", "Ongles", "Soin Visage", "Massage", "Barbier", "Spa", "Esthétique", "Extensions Cils"];
  const toggle = (arr, val) => arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nom du commerce *</p>
        <div className={`bg-white border rounded-2xl px-4 py-4 flex items-center gap-3 ${errors.salon_name ? "border-red-400 bg-red-50" : "border-gray-200"}`}>
          <Store className={`w-5 h-5 shrink-0 ${errors.salon_name ? "text-red-400" : "text-gray-300"}`} />
          <input
            placeholder="Ex : Studio Nadia, L'Atelier Beauté..."
            value={data.salon_name || ""}
            onChange={e => setData(d => ({ ...d, salon_name: e.target.value }))}
            className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-300"
          />
        </div>
        {errors.salon_name && <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.salon_name}</p>}
      </div>

      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Sélectionnez vos services * <span className="text-primary">(au moins 1)</span></p>
        <div className="flex flex-wrap gap-2">
          {services.map(s => (
            <button key={s} onClick={() => setData(d => ({ ...d, services: toggle(d.services || [], s) }))}
              className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-all ${(data.services || []).includes(s) ? "bg-primary text-white border-primary" : "bg-white text-gray-700 border-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>
        {errors.services && <p className="text-[11px] text-red-500 font-medium mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.services}</p>}
      </div>

      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Bio et expérience *</p>
        <textarea
          placeholder="Décrivez votre parcours (min. 20 caractères)..."
          value={data.bio || ""}
          onChange={e => setData(d => ({ ...d, bio: e.target.value }))}
          className={`w-full h-28 border rounded-2xl p-4 text-[13px] text-gray-700 placeholder:text-gray-300 outline-none resize-none ${errors.bio ? "border-red-400 bg-red-50" : "bg-gray-50 border-gray-200"}`}
        />
        {errors.bio && <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.bio}</p>}
      </div>

      {/* Type d'activité */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Type d'activité *</p>
        <div className="grid grid-cols-2 gap-2">
          {[["Salon professionnel", "Salon"], ["Particulier", "Particulier"]].map(([label, val]) => (
            <button key={val} onClick={() => setData(d => ({ ...d, type: val }))}
              className={`flex items-center gap-2 p-3 rounded-2xl border text-[13px] font-medium transition-all ${data.type === val ? "border-primary bg-orange-50" : "border-gray-200 bg-white"}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${data.type === val ? "border-primary" : "border-gray-300"}`}>
                {data.type === val && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              {label}
            </button>
          ))}
        </div>
        {errors.type && <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.type}</p>}
      </div>

      {/* Années d'expérience */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Années d'expérience</p>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex items-center justify-between">
          <button onClick={() => setData(d => ({ ...d, years: Math.max(0, (d.years || 0) - 1) }))} className="w-8 h-8 bg-white rounded-xl border text-gray-500 text-lg font-bold flex items-center justify-center">−</button>
          <span className="text-[22px] font-black text-gray-900">{data.years || 0}</span>
          <button onClick={() => setData(d => ({ ...d, years: (d.years || 0) + 1 }))} className="w-8 h-8 bg-white rounded-xl border text-gray-500 text-lg font-bold flex items-center justify-center">+</button>
        </div>
      </div>

      {/* Diplômes & Certifications */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Diplômes & Certifications</p>
        <p className="text-[11px] text-gray-400 font-medium mb-3">Les pros diplômés apparaissent dans la section "Partenaires Certifiés" de l'accueil</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {["CAP Coiffure", "BP Coiffure", "BTS Esthétique", "CAP Esthétique", "Brevet Coiffure", "CAP Barbier", "Certification Maquillage", "Diplôme Massage", "Titre Pro Esthéticien", "Autre diplôme"].map(d => {
            const selected = (data.diplomes || []).includes(d);
            return (
              <button key={d} onClick={() => setData(dd => ({ ...dd, diplomes: toggle(dd.diplomes || [], d) }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-[12px] font-medium transition-all ${selected ? "bg-amber-400 text-white border-amber-400" : "bg-white text-gray-700 border-gray-200"}`}>
                {selected && <span className="text-[11px]">🎓</span>}
                {d}
              </button>
            );
          })}
        </div>
        {(data.diplomes || []).length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-[20px]">🎓</span>
            <p className="text-[12px] font-bold text-amber-700">
              Votre profil sera affiché dans la section <span className="font-black">Partenaires Certifiés</span> visible par tous les utilisateurs.
            </p>
          </div>
        )}
      </div>

      {/* Nombre de sièges disponibles */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nombre de sièges disponibles</p>
        <p className="text-[11px] text-gray-400 font-medium mb-3">Postes disponibles en simultané — utilisé par le système de réservation</p>
        <SeatsDrumPicker value={data.seats_count || 1} onChange={v => setData(d => ({ ...d, seats_count: v }))} />
      </div>
    </div>
  );
}

// ─── Step 2: Spécialités + Adresse + Équipement + Menus ──────────────────────
function Step2({ data, setData }) {
  const categories = ["Coiffure", "Maquillage", "Ongles", "Soin Visage", "Massage", "Barbier"];
  const cheveux = ["Lisses", "Bouclés", "Frisés", "Crépus", "Fins", "Épais"];
  const toggle = (arr, val) => arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const commoditesOptions = [
    { label: "Wifi", Icon: Wifi },
    { label: "Parking", Icon: ParkingCircle },
    { label: "Climatisation", Icon: Wind },
    { label: "Chauffage", Icon: Thermometer },
    { label: "Espace bébé", Icon: Baby },
    { label: "Café / Thé", Icon: Coffee },
    { label: "Paiement CB", Icon: CreditCard },
    { label: "Salle d'attente", Icon: Sofa },
    { label: "Musique d'ambiance", Icon: Music },
    { label: "Miroir éclairé", Icon: Lightbulb },
    { label: "Espace VIP", Icon: Star },
    { label: "Loge privée", Icon: Lock },
    { label: "TV écran", Icon: Tv },
    { label: "Lumière naturelle", Icon: Sun },
    { label: "Accessible PMR", Icon: Accessibility },
    { label: "Vestiaire", Icon: Shirt },
    { label: "Douches", Icon: ShowerHead },
    { label: "Champagne", Icon: Wine },
    { label: "Animaux acceptés", Icon: PawPrint },
    { label: "Terrasse", Icon: Sun },
    { label: "Bar à jus", Icon: Coffee },
    { label: "Bibliothèque", Icon: BookOpen },
    { label: "Coin enfants", Icon: Baby },
    { label: "Stationnement privé", Icon: ParkingCircle },
    { label: "Prise électrique", Icon: Zap },
    { label: "Miroirs plein corps", Icon: Sparkles },
    { label: "Éclairage pro", Icon: Lightbulb },
  ];

  const [uploadingMenuImg, setUploadingMenuImg] = useState({});
  const menuImgRefs = useRef({});
  const barImgRefs = useRef({});

  // Menu restaurant
  const addMenuItem = () => setData(d => ({ ...d, menu_restaurant: [...(d.menu_restaurant || []), { nom: "", prix: "", description: "", image_url: "" }] }));
  const updateMenuItem = (i, field, val) => {
    const arr = [...(data.menu_restaurant || [])];
    arr[i] = { ...arr[i], [field]: val };
    setData(d => ({ ...d, menu_restaurant: arr }));
  };
  const removeMenuItem = (i) => setData(d => ({ ...d, menu_restaurant: (d.menu_restaurant || []).filter((_, idx) => idx !== i) }));
  const uploadMenuImg = async (i, file, type) => {
    if (!file) return;
    const key = `${type}_${i}`;
    setUploadingMenuImg(u => ({ ...u, [key]: true }));
    const { file_url } = await uploadFile({ file });
    if (type === "resto") updateMenuItem(i, "image_url", file_url);
    else updateBarItem(i, "image_url", file_url);
    setUploadingMenuImg(u => ({ ...u, [key]: false }));
  };

  // Menu bar
  const addBarItem = () => setData(d => ({ ...d, menu_bar: [...(d.menu_bar || []), { nom: "", prix: "", description: "", image_url: "" }] }));
  const updateBarItem = (i, field, val) => {
    const arr = [...(data.menu_bar || [])];
    arr[i] = { ...arr[i], [field]: val };
    setData(d => ({ ...d, menu_bar: arr }));
  };
  const removeBarItem = (i) => setData(d => ({ ...d, menu_bar: (d.menu_bar || []).filter((_, idx) => idx !== i) }));

  const openUber = () => {
    const addr = encodeURIComponent(data.address || "");
    window.open(`https://www.ubereats.com/fr/search?q=${addr}`, "_blank");
  };
  const openDeliveroo = () => {
    const addr = encodeURIComponent(data.address || "");
    window.open(`https://deliveroo.fr/fr/restaurants?q=${addr}`, "_blank");
  };

  return (
    <div className="space-y-7">
      {/* Catégories */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Catégories Principales</p>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(c => (
            <button key={c} onClick={() => setData(d => ({ ...d, categories: toggle(d.categories || [], c) }))}
              className={`flex items-center justify-between px-4 py-4 rounded-2xl border text-[14px] font-bold transition-all ${(data.categories || []).includes(c) ? "bg-orange-50 border-primary text-primary" : "bg-white border-gray-200 text-gray-800"}`}>
              {c}
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${(data.categories || []).includes(c) ? "border-primary bg-primary" : "border-gray-300"}`}>
                <span className={`text-white text-[14px] font-black leading-none ${(data.categories || []).includes(c) ? "opacity-100" : "opacity-0"}`}>✓</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Types de cheveux */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Types de Cheveux</p>
        <div className="flex flex-wrap gap-2">
          {cheveux.map(c => (
            <button key={c} onClick={() => setData(d => ({ ...d, cheveux: toggle(d.cheveux || [], c) }))}
              className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-all ${(data.cheveux || []).includes(c) ? "bg-primary text-white border-primary" : "bg-white text-gray-700 border-gray-200"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Adresse avec autocomplete Google Maps */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Adresse du salon</p>
        <AddressAutocomplete
          value={data.address || ""}
          onChange={val => setData(d => ({ ...d, address: val }))}
          onSelect={({ address, city, postalCode }) => setData(d => ({ ...d, address, city: city || d.city, postal_code: postalCode || d.postal_code }))}
        />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input
            placeholder="Ville"
            value={data.city || ""}
            onChange={e => setData(d => ({ ...d, city: e.target.value }))}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[13px] text-gray-700 outline-none placeholder:text-gray-300"
          />
          <input
            placeholder="Code postal"
            value={data.postal_code || ""}
            onChange={e => setData(d => ({ ...d, postal_code: e.target.value }))}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[13px] text-gray-700 outline-none placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Commodités */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Commodités & Équipements</p>
        <div className="grid grid-cols-4 gap-2">
          {commoditesOptions.map(({ label, Icon }) => {
            const selected = (data.commodites || []).includes(label);
            return (
              <button key={label} onClick={() => setData(d => ({ ...d, commodites: toggle(d.commodites || [], label) }))}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all active:scale-95 ${selected ? "bg-primary border-primary" : "bg-white border-gray-200"}`}>
                <Icon className={`w-4 h-4 ${selected ? "text-white" : "text-gray-400"}`} />
                <span className={`text-[9px] font-black text-center leading-tight ${selected ? "text-white" : "text-gray-500"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Restaurant */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menu Restaurant</p>
            <p className="text-[11px] text-gray-300 font-medium mt-0.5">Plats & boissons proposés</p>
          </div>
          <button onClick={addMenuItem} className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5 active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-black text-primary">Ajouter</span>
          </button>
        </div>
        <div className="space-y-2">
          {(data.menu_restaurant || []).map((item, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                {/* Photo du plat */}
                <div className="relative shrink-0">
                  <input ref={el => menuImgRefs.current[i] = el} type="file" accept="image/*" className="hidden"
                    onChange={e => uploadMenuImg(i, e.target.files?.[0], "resto")} />
                  <div onClick={() => menuImgRefs.current[i]?.click()}
                    className="w-12 h-12 rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer active:scale-95 transition-all">
                    {uploadingMenuImg[`resto_${i}`] ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : item.image_url ? (
                      <BeautyImage src={item.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                </div>
                <input value={item.nom} onChange={e => updateMenuItem(i, "nom", e.target.value)} placeholder="Nom du plat"
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-[13px] font-bold text-gray-700 outline-none" />
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" value={item.prix} onChange={e => updateMenuItem(i, "prix", e.target.value)} placeholder="0"
                    className="w-14 bg-white border border-gray-200 rounded-xl px-2 py-2 text-[13px] font-black text-primary text-right outline-none" />
                  <span className="text-[12px] font-black text-primary">€</span>
                </div>
                <button onClick={() => removeMenuItem(i)} className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center active:scale-95">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
              <input value={item.description} onChange={e => updateMenuItem(i, "description", e.target.value)} placeholder="Description (optionnel)"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12px] text-gray-400 outline-none" />
            </div>
          ))}
          {(data.menu_restaurant || []).length === 0 && (
            <button onClick={addMenuItem} className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-[12px] font-black text-gray-300 uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
              <UtensilsCrossed className="w-4 h-4" /> Ajouter un plat
            </button>
          )}
        </div>

        {/* Liens Uber / Deliveroo */}
        {data.address && (
          <div className="mt-3 flex gap-2">
            <button onClick={openUber}
              className="flex-1 flex items-center justify-center gap-2 bg-black text-white rounded-2xl py-3 text-[12px] font-black active:scale-95 transition-all">
              <span className="text-[16px]">🚗</span> Uber Eats
            </button>
            <button onClick={openDeliveroo}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-[12px] font-black active:scale-95 transition-all border-2 border-[#00CCBC]"
              style={{ color: "#00CCBC" }}>
              <span className="text-[16px]">🛵</span> Deliveroo
            </button>
          </div>
        )}
        {!data.address && (
          <p className="text-[11px] text-gray-300 font-medium mt-2 text-center">Renseignez votre adresse pour activer Uber Eats & Deliveroo</p>
        )}
      </div>

      {/* Menu Bar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menu Bar & Boissons</p>
            <p className="text-[11px] text-gray-300 font-medium mt-0.5">Cocktails, vins, softs...</p>
          </div>
          <button onClick={addBarItem} className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5 active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-black text-primary">Ajouter</span>
          </button>
        </div>
        <div className="space-y-2">
          {(data.menu_bar || []).map((item, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                {/* Photo de la boisson */}
                <div className="relative shrink-0">
                  <input ref={el => barImgRefs.current[i] = el} type="file" accept="image/*" className="hidden"
                    onChange={e => uploadMenuImg(i, e.target.files?.[0], "bar")} />
                  <div onClick={() => barImgRefs.current[i]?.click()}
                    className="w-12 h-12 rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer active:scale-95 transition-all">
                    {uploadingMenuImg[`bar_${i}`] ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : item.image_url ? (
                      <BeautyImage src={item.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                </div>
                <input value={item.nom} onChange={e => updateBarItem(i, "nom", e.target.value)} placeholder="Nom de la boisson"
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-[13px] font-bold text-gray-700 outline-none" />
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" value={item.prix} onChange={e => updateBarItem(i, "prix", e.target.value)} placeholder="0"
                    className="w-14 bg-white border border-gray-200 rounded-xl px-2 py-2 text-[13px] font-black text-primary text-right outline-none" />
                  <span className="text-[12px] font-black text-primary">€</span>
                </div>
                <button onClick={() => removeBarItem(i)} className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center active:scale-95">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
              <input value={item.description} onChange={e => updateBarItem(i, "description", e.target.value)} placeholder="Description (optionnel)"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12px] text-gray-400 outline-none" />
            </div>
          ))}
          {(data.menu_bar || []).length === 0 && (
            <button onClick={addBarItem} className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-[12px] font-black text-gray-300 uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Wine className="w-4 h-4" /> Ajouter une boisson
            </button>
          )}
        </div>

        {/* Liens Uber / Deliveroo aussi pour le bar */}
        {data.address && (
          <div className="mt-3 flex gap-2">
            <button onClick={openUber}
              className="flex-1 flex items-center justify-center gap-2 bg-black text-white rounded-2xl py-3 text-[12px] font-black active:scale-95 transition-all">
              <span className="text-[16px]">🚗</span> Uber Eats
            </button>
            <button onClick={openDeliveroo}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-[12px] font-black active:scale-95 transition-all border-2 border-[#00CCBC]"
              style={{ color: "#00CCBC" }}>
              <span className="text-[16px]">🛵</span> Deliveroo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Portfolio — Bannière, Photo profil + Médias fusionnés ────────────
function Step3({ data, setData, errors }) {
  const mediaInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Pré-charger avatar/bannière depuis le compte user si pas encore définis dans le draft
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data?.user).then(user => {
      if (!user) return;
      if (!data.avatar_url && user.avatar_url) setData(d => ({ ...d, avatar_url: user.avatar_url }));
      if (!data.cover_url && user.cover_url) setData(d => ({ ...d, cover_url: user.cover_url }));
    }).catch(() => {});
  }, []);

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const { file_url } = await uploadFile({ file });
    setData(d => ({ ...d, avatar_url: file_url }));
    setUploadingAvatar(false);
  };

  const handleBannerFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    const { file_url } = await uploadFile({ file });
    setData(d => ({ ...d, cover_url: file_url }));
    setUploadingBanner(false);
  };

  const handleMediaFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await uploadFile({ file });
      urls.push(file_url);
    }
    setData(d => ({ ...d, gallery: [...(d.gallery || []), ...urls] }));
    setUploading(false);
    e.target.value = "";
  };

  const removeMediaItem = (idx) => {
    setData(d => ({ ...d, gallery: (d.gallery || []).filter((_, i) => i !== idx) }));
  };

  const handleUsername = (val) => {
    const clean = val.replace(/[^a-z0-9_\.]/gi, "").toLowerCase();
    setData(d => ({ ...d, username: clean }));
  };

  return (
    <div className="space-y-6">
      {/* Username */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nom d'utilisateur *</p>
        <div className={`bg-white border rounded-2xl px-4 py-4 flex items-center gap-3 ${errors.username ? "border-red-400 bg-red-50" : "border-gray-200"}`}>
          <AtSign className={`w-5 h-5 shrink-0 ${errors.username ? "text-red-400" : "text-gray-300"}`} />
          <input
            placeholder="votre_pseudo_unique"
            value={data.username || ""}
            onChange={e => handleUsername(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-300"
          />
          {data.username && data.username.length >= 3 && !errors.username && (
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          )}
        </div>
        {errors.username
          ? <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.username}</p>
          : <p className="text-[11px] text-gray-400 font-medium mt-1 ml-1">Uniquement lettres, chiffres, _ et . — non modifiable après inscription.</p>
        }
      </div>

      {/* Bannière du profil */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Bannière du profil</p>
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerFile} />
        <div
          onClick={() => bannerInputRef.current?.click()}
          className="relative w-full h-28 rounded-2xl overflow-hidden border-2 border-dashed cursor-pointer active:scale-[0.99] transition-all"
          style={{ borderColor: data.cover_url ? "#E8732A" : "#e5e7eb", background: "#f9fafb" }}
        >
          {data.cover_url ? (
            <BeautyImage src={data.cover_url} alt="Bannière" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              {uploadingBanner ? <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : (
                <>
                  <Camera className="w-7 h-7 text-gray-300" strokeWidth={1} />
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Ajouter une bannière</span>
                </>
              )}
            </div>
          )}
          {data.cover_url && (
            <button onClick={e => { e.stopPropagation(); setData(d => ({ ...d, cover_url: null })); }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Photo de profil */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Photo de profil / Logo</p>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              onClick={() => avatarInputRef.current?.click()}
              className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden"
              style={{ borderColor: data.avatar_url ? "#E8732A" : "#e5e7eb", background: "#f9fafb" }}
            >
              {data.avatar_url ? (
                <BeautyImage src={data.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : uploadingAvatar ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-7 h-7 text-gray-300" strokeWidth={1} />
              )}
            </div>
            <button onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
              style={{ background: "#E8732A" }}>
              <Camera className="w-3 h-3 text-white" />
            </button>
          </div>
          <div>
            <p className="text-[13px] font-black text-gray-800">Photo de profil ou logo</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Visible par la communauté</p>
            <button onClick={() => avatarInputRef.current?.click()} className="text-[11px] font-black text-primary mt-1">
              {data.avatar_url ? "Changer la photo" : "Ajouter une photo"}
            </button>
          </div>
        </div>
      </div>

      {/* Médias — Photos & Vidéos fusionnées avec drag & drop */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Images & Vidéos *</p>
            <p className="text-[11px] text-gray-300 font-medium mt-0.5">Glissez pour réordonner · le 1er média est votre couverture</p>
          </div>
          <button onClick={() => mediaInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5 active:scale-95 transition-all">
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-black text-primary">Ajouter</span>
          </button>
        </div>
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaFiles} />

        {(data.gallery || []).length > 0 ? (
          <DragDropContext onDragEnd={({ source, destination }) => {
            if (!destination || source.index === destination.index) return;
            const items = Array.from(data.gallery);
            const [moved] = items.splice(source.index, 1);
            items.splice(destination.index, 0, moved);
            setData(d => ({ ...d, gallery: items }));
          }}>
            <Droppable droppableId="gallery" direction="horizontal">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-3 gap-2">
                  {(data.gallery || []).map((url, i) => {
                    const isVideo = url.includes(".mp4") || url.includes(".mov") || url.includes(".webm") || url.includes("video");
                    return (
                      <Draggable key={url + i} draggableId={url + i} index={i}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={`relative aspect-square rounded-xl overflow-hidden bg-gray-100 ${snapshot.isDragging ? "ring-2 ring-primary shadow-xl scale-105" : ""}`}
                          >
                            {/* Badge "Couverture" sur le premier */}
                            {i === 0 && (
                              <div className="absolute top-1 left-1 z-10 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                Couverture
                              </div>
                            )}
                            {isVideo ? (
                              <video
                                src={url}
                                className="w-full h-full object-cover"
                                autoPlay
                                playsInline
                                loop
                              />
                            ) : (
                              <BeautyImage src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
                            )}
                            {isVideo && (
                              <div className="absolute bottom-1 left-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                                <Volume2 className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                            {/* Handle drag */}
                            <div {...drag.dragHandleProps} className="absolute top-1 right-6 w-5 h-5 bg-black/40 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-3 h-3 text-white" />
                            </div>
                            <button onClick={() => removeMediaItem(i)}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                  {uploading && (
                    <div className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map(i => (
              <button key={i} onClick={() => mediaInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1">
                <ImagePlus className="w-6 h-6 text-gray-300" />
                <span className="text-[9px] font-black text-gray-300 uppercase">Média {i + 1}</span>
              </button>
            ))}
          </div>
        )}
        {errors.salon_photo && <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.salon_photo}</p>}
      </div>

      <div className="bg-orange-50 rounded-2xl p-4 flex items-start gap-3 border border-orange-100">
        <span className="text-[16px]">💡</span>
        <p className="text-[12px] text-gray-600 font-medium leading-snug">
          Les partenaires avec 5+ médias reçoivent <span className="text-primary font-black">3× plus</span> de réservations.
        </p>
      </div>
    </div>
  );
}

// ─── Indicatifs téléphoniques ─────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+33", flag: "🇫🇷", label: "France" },
  { code: "+32", flag: "🇧🇪", label: "Belgique" },
  { code: "+41", flag: "🇨🇭", label: "Suisse" },
  { code: "+1",  flag: "🇺🇸", label: "USA / Canada" },
  { code: "+44", flag: "🇬🇧", label: "Royaume-Uni" },
  { code: "+49", flag: "🇩🇪", label: "Allemagne" },
  { code: "+34", flag: "🇪🇸", label: "Espagne" },
  { code: "+39", flag: "🇮🇹", label: "Italie" },
  { code: "+212", flag: "🇲🇦", label: "Maroc" },
  { code: "+213", flag: "🇩🇿", label: "Algérie" },
  { code: "+216", flag: "🇹🇳", label: "Tunisie" },
  { code: "+225", flag: "🇨🇮", label: "Côte d'Ivoire" },
  { code: "+237", flag: "🇨🇲", label: "Cameroun" },
  { code: "+221", flag: "🇸🇳", label: "Sénégal" },
  { code: "+243", flag: "🇨🇩", label: "RD Congo" },
];

const EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.fr", "yahoo.com", "icloud.com", "laposte.net", "orange.fr", "sfr.fr", "free.fr"];

// ─── Step 4: Vérification & Légal ────────────────────────────────────────────
function Step4({ data, setData }) {
  const [uploading, setUploading] = useState({});
  const [showCodePicker, setShowCodePicker] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const countryCode = data.phone_code || "+33";

  const uploadDoc = async (key, file) => {
    if (!file) return;
    setUploading(u => ({ ...u, [key]: true }));
    const { file_url } = await uploadFile({ file }, 'private-documents');
    setData(d => ({ ...d, [key]: file_url }));
    setUploading(u => ({ ...u, [key]: false }));
  };

  // Formatage SIRET : groupe de 3-3-3-5
  const formatSiret = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 14);
    return digits.replace(/(\d{3})(\d{0,3})(\d{0,3})(\d{0,5})/, (_, a, b, c, d) =>
      [a, b, c, d].filter(Boolean).join(" ")
    );
  };

  const handleSiret = (val) => {
    const formatted = formatSiret(val);
    const digits = formatted.replace(/\s/g, "");
    setFieldErrors(e => ({ ...e, siret: digits.length > 0 && digits.length < 14 ? "Le SIRET doit contenir exactement 14 chiffres" : null }));
    setData(d => ({ ...d, siret: formatted }));
  };

  const handleEmail = (val) => {
    setData(d => ({ ...d, email_pro: val }));
    const atIdx = val.indexOf("@");
    if (atIdx > 0 && atIdx === val.length - 1) {
      // Juste après le @, proposer les domaines
      setEmailSuggestions(EMAIL_DOMAINS.map(d => val.slice(0, atIdx + 1) + d));
    } else if (atIdx > 0) {
      const typed = val.slice(atIdx + 1).toLowerCase();
      const matches = EMAIL_DOMAINS.filter(d => d.startsWith(typed)).map(d => val.slice(0, atIdx + 1) + d);
      setEmailSuggestions(matches.length > 0 && typed.length > 0 ? matches : []);
    } else {
      setEmailSuggestions([]);
    }
    // Validation format email
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    setFieldErrors(e => ({ ...e, email_pro: val.length > 0 && !valid ? "Adresse email invalide" : null }));
  };

  const handlePhone = (val) => {
    // Autoriser seulement chiffres, espaces, tirets
    const clean = val.replace(/[^\d\s\-]/g, "");
    setData(d => ({ ...d, phone: clean }));
  };

  const DocUpload = ({ label, keyRecto, keyVerso }) => (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
      <p className="text-[11px] font-black text-gray-600 uppercase tracking-widest">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {[{ key: keyRecto, label: "Recto" }, keyVerso && { key: keyVerso, label: "Verso" }].filter(Boolean).map(({ key, label: side }) => (
          <label key={key} className="cursor-pointer">
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => uploadDoc(key, e.target.files?.[0])} />
            {data[key] ? (
              <div className="relative h-20 rounded-xl overflow-hidden bg-gray-200">
                {data[key].endsWith(".pdf") ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 gap-1">
                    <span className="text-[20px]">📄</span>
                    <span className="text-[9px] font-black text-red-500">PDF chargé</span>
                  </div>
                ) : (
                  <BeautyImage src={data[key]} alt={side} className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-1 left-1 bg-green-500 rounded-full px-1.5 py-0.5">
                  <span className="text-white text-[8px] font-black">✓ {side}</span>
                </div>
              </div>
            ) : (
              <div className="h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1">
                {uploading[key] ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-gray-300" />
                    <span className="text-[10px] font-black text-gray-400">{side}</span>
                  </>
                )}
              </div>
            )}
          </label>
        ))}
      </div>
    </div>
  );

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <div className="space-y-4">
      <DocUpload label="Pièce d'identité *" keyRecto="doc_identite_recto" keyVerso="doc_identite_verso" />
      <DocUpload label="Justificatif SIRET / Kbis" keyRecto="doc_siret" />
      <DocUpload label="Attestation assurance pro" keyRecto="doc_assurance" />

      {/* Téléphone avec indicatif */}
      <div>
        <div className="bg-white border border-gray-200 rounded-2xl flex items-center overflow-hidden">
          {/* Sélecteur indicatif */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCodePicker(p => !p)}
              className="flex items-center gap-1.5 px-3 py-4 border-r border-gray-200 bg-gray-50 active:bg-gray-100 transition-all shrink-0"
            >
              <span className="text-[18px]">{selectedCountry.flag}</span>
              <span className="text-[13px] font-black text-gray-700">{countryCode}</span>
              <span className="text-gray-400 text-[10px]">▾</span>
            </button>
            {showCodePicker && (
              <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl w-60 max-h-64 overflow-y-auto mt-1">
                {COUNTRY_CODES.map(c => (
                  <button key={c.code} type="button"
                    onClick={() => { setData(d => ({ ...d, phone_code: c.code })); setShowCodePicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-orange-50 border-b border-gray-50 last:border-0 ${c.code === countryCode ? "bg-orange-50" : ""}`}>
                    <span className="text-[18px]">{c.flag}</span>
                    <span className="flex-1 text-[13px] font-medium text-gray-800">{c.label}</span>
                    <span className="text-[12px] font-black text-primary">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Phone className="w-4 h-4 text-gray-300 ml-3 shrink-0" />
          <input
            placeholder="6 12 34 56 78"
            value={data.phone || ""}
            onChange={e => handlePhone(e.target.value)}
            inputMode="tel"
            className="flex-1 px-3 py-4 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Email professionnel avec autocomplétion */}
      <div className="relative">
        <div className={`bg-white border rounded-2xl px-4 py-4 flex items-center gap-3 ${fieldErrors.email_pro ? "border-red-400" : "border-gray-200"}`}>
          <Mail className={`w-5 h-5 shrink-0 ${fieldErrors.email_pro ? "text-red-400" : "text-gray-300"}`} />
          <input
            placeholder="contact@votresalon.com"
            value={data.email_pro || ""}
            onChange={e => handleEmail(e.target.value)}
            onBlur={() => setTimeout(() => setEmailSuggestions([]), 200)}
            inputMode="email"
            className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-300"
          />
          {data.email_pro && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email_pro) && (
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          )}
        </div>
        {fieldErrors.email_pro && <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.email_pro}</p>}
        {emailSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl mt-1 overflow-hidden">
            {emailSuggestions.slice(0, 5).map(s => (
              <button key={s} type="button"
                onMouseDown={() => { setData(d => ({ ...d, email_pro: s })); setEmailSuggestions([]); setFieldErrors(e => ({ ...e, email_pro: null })); }}
                className="w-full text-left px-4 py-3 text-[13px] text-gray-700 border-b border-gray-50 last:border-0 active:bg-orange-50 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SIRET avec formatage et validation */}
      <div>
        <div className={`bg-white border rounded-2xl px-4 py-4 flex items-center gap-3 ${fieldErrors.siret ? "border-red-400" : "border-gray-200"}`}>
          <Building2 className={`w-5 h-5 shrink-0 ${fieldErrors.siret ? "text-red-400" : "text-gray-300"}`} />
          <input
            placeholder="123 456 789 00012"
            value={data.siret || ""}
            onChange={e => handleSiret(e.target.value)}
            inputMode="numeric"
            maxLength={19}
            className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-300 font-mono tracking-wider"
          />
          {data.siret && data.siret.replace(/\s/g, "").length === 14 && (
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          )}
        </div>
        {fieldErrors.siret
          ? <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.siret}</p>
          : <p className="text-[10px] text-gray-400 font-medium mt-1 ml-1">{(data.siret || "").replace(/\s/g, "").length} / 14 chiffres</p>
        }
      </div>

      {/* Visite Virtuelle — lien vers la page dédiée */}
      <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[18px]">🔭</span>
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-black text-cyan-800">Visite Virtuelle 360°</p>
          <p className="text-[11px] text-cyan-600 font-medium mt-0.5">Créez une visite virtuelle de votre salon depuis la section dédiée dans votre espace pro.</p>
          <button
            type="button"
            onClick={() => { window.location.href = "/pro/visite-3d"; }}
            className="mt-2 flex items-center gap-1.5 bg-cyan-500 text-white text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full active:scale-95 transition-all"
          >
            <span>Gérer mes visites virtuelles →</span>
          </button>
        </div>
        <span className="text-[9px] font-black text-cyan-500 bg-cyan-100 rounded-full px-2 py-1 shrink-0">OPTIONNEL</span>
      </div>
    </div>
  );
}

// ─── Step 5: Disponibilités & Pauses ──────────────────────────────────────────
function Step5({ data, setData }) {
  const dayKeys = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
  const dayLabels = { lun: "Lundi", mar: "Mardi", mer: "Mercredi", jeu: "Jeudi", ven: "Vendredi", sam: "Samedi", dim: "Dimanche" };
  const dayShorts = { lun: "L", mar: "M", mer: "M", jeu: "J", ven: "V", sam: "S", dim: "D" };

  // Tous les jours doivent être sélectionnés par défaut
  const activeDays = data.days ?? dayKeys;
  const toggleDay = (key) => {
    const updated = activeDays.includes(key)
      ? activeDays.filter(k => k !== key)
      : [...activeDays, key];
    setData(d => ({ ...d, days: updated }));
  };

  // Mode de configuration : "general" ou "par_jour"
  const [mode, setMode] = useState("general");
  const [selectedDayTab, setSelectedDayTab] = useState("lun");

  // Créneaux & Pauses généraux (non pré-remplis)
  const slots = data.time_slots || [];
  const pauses = data.pauses || [];

  const addSlot = () => {
    setData(d => ({ ...d, time_slots: [...(d.time_slots || []), { start: "", end: "" }] }));
  };
  const updateSlot = (i, field, val) => {
    const updated = (data.time_slots || []).map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    setData(d => ({ ...d, time_slots: updated }));
  };
  const removeSlot = (i) => {
    setData(d => ({ ...d, time_slots: (data.time_slots || []).filter((_, idx) => idx !== i) }));
  };

  const addPause = () => {
    setData(d => ({ ...d, pauses: [...(d.pauses || []), { start: "", end: "", label: "Pause déjeuner" }] }));
  };
  const updatePause = (i, field, val) => {
    const updated = (data.pauses || []).map((p, idx) => idx === i ? { ...p, [field]: val } : p);
    setData(d => ({ ...d, pauses: updated }));
  };
  const removePause = (i) => {
    setData(d => ({ ...d, pauses: (data.pauses || []).filter((_, idx) => idx !== i) }));
  };

  // Gestion des horaires spécifiques par jour
  const daySchedules = data.day_schedules || {};

  const getDaySchedule = (day) => {
    return daySchedules[day] || { custom: false, slots: [], pauses: [] };
  };

  const setDaySchedule = (day, updater) => {
    const current = getDaySchedule(day);
    const next = updater(current);
    setData(d => ({
      ...d,
      day_schedules: {
        ...(d.day_schedules || {}),
        [day]: next
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Jours de disponibilité (Tous sélectionnés par défaut) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Jours de disponibilité</p>
          <span className="text-[11px] font-bold text-primary">{activeDays.length}/7 jours sélectionnés</span>
        </div>
        <div className="flex gap-2 justify-between">
          {dayKeys.map((key) => {
            const active = activeDays.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black transition-all ${
                  active ? "bg-primary text-white shadow-md shadow-primary/30 scale-105" : "bg-gray-100 text-gray-400"
                }`}
              >
                {dayShorts[key]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selecteur mode : Horaires généraux vs Personnalisés par jour */}
      <div className="bg-gray-100 p-1 rounded-2xl flex">
        <button
          type="button"
          onClick={() => setMode("general")}
          className={`flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all ${
            mode === "general" ? "bg-white text-gray-900 shadow" : "text-gray-500"
          }`}
        >
          Horaires généraux
        </button>
        <button
          type="button"
          onClick={() => setMode("par_jour")}
          className={`flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all ${
            mode === "par_jour" ? "bg-white text-primary shadow" : "text-gray-500"
          }`}
        >
          Par jour spécifique
        </button>
      </div>

      {/* Mode Général */}
      {mode === "general" && (
        <>
          {/* Créneaux horaires */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Créneaux d'ouverture</p>
                <p className="text-[11px] text-gray-400 font-medium">Définissez vos heures d'ouverture générales</p>
              </div>
              <button
                type="button"
                onClick={addSlot}
                className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-black text-primary">Ajouter</span>
              </button>
            </div>

            {slots.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center bg-gray-50">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] font-bold text-gray-600 mb-1">Aucun créneau renseigné</p>
                <p className="text-[11px] text-gray-400 mb-3">Saisissez vos heures de début et fin.</p>
                <button
                  type="button"
                  onClick={addSlot}
                  className="bg-primary text-white text-[12px] font-black px-4 py-2 rounded-full inline-flex items-center gap-1.5 active:scale-95 transition-all shadow"
                >
                  <Plus className="w-3.5 h-3.5" /> Définir un créneau
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {slots.map((slot, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 flex items-center gap-2">
                      <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Début</p>
                        <input
                          type="time"
                          value={slot.start || ""}
                          onChange={e => updateSlot(i, "start", e.target.value)}
                          className="text-[15px] font-black text-gray-900 bg-gray-50 rounded-xl px-2 py-1 outline-none w-24 border border-gray-100"
                        />
                      </div>
                      <span className="text-gray-300 font-black">→</span>
                      <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Fin</p>
                        <input
                          type="time"
                          value={slot.end || ""}
                          onChange={e => updateSlot(i, "end", e.target.value)}
                          className="text-[15px] font-black text-gray-900 bg-gray-50 rounded-xl px-2 py-1 outline-none w-24 border border-gray-100"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlot(i)}
                      className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section Pause */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pauses & Pause Déjeuner</p>
                <p className="text-[11px] text-gray-400 font-medium">Créneaux d'indisponibilité pendant la journée</p>
              </div>
              <button
                type="button"
                onClick={addPause}
                className="flex items-center gap-1.5 bg-orange-100 rounded-full px-3 py-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-black text-primary">Ajouter pause</span>
              </button>
            </div>

            {pauses.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-2xl p-4 text-center bg-gray-50">
                <p className="text-[12px] font-semibold text-gray-500">Aucune pause configurée</p>
                <button
                  type="button"
                  onClick={addPause}
                  className="text-[11px] font-bold text-primary underline mt-1"
                >
                  + Ajouter une pause (ex: 12:00 - 13:00)
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {pauses.map((pause, i) => (
                  <div key={i} className="bg-orange-50/50 border border-orange-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <Sun className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <input
                        type="text"
                        placeholder="Intitulé (ex: Pause déjeuner)"
                        value={pause.label || ""}
                        onChange={e => updatePause(i, "label", e.target.value)}
                        className="text-[12px] font-bold text-gray-800 bg-transparent outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={pause.start || ""}
                          onChange={e => updatePause(i, "start", e.target.value)}
                          className="text-[14px] font-black text-gray-900 bg-white rounded-lg px-2 py-1 outline-none border border-gray-200 w-24"
                        />
                        <span className="text-gray-400 font-bold">→</span>
                        <input
                          type="time"
                          value={pause.end || ""}
                          onChange={e => updatePause(i, "end", e.target.value)}
                          className="text-[14px] font-black text-gray-900 bg-white rounded-lg px-2 py-1 outline-none border border-gray-200 w-24"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePause(i)}
                      className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Mode Par Jour Spécifique */}
      {mode === "par_jour" && (
        <div className="space-y-4">
          <p className="text-[11px] text-gray-500">
            Sélectionnez un jour pour lui assigner des horaires et pauses spécifiques.
          </p>

          {/* Onglets des jours */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            {dayKeys.map(key => {
              const isActive = activeDays.includes(key);
              const isSelected = selectedDayTab === key;
              const hasCustom = daySchedules[key]?.custom;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDayTab(key)}
                  className={`px-3 py-2 rounded-xl text-[12px] font-black shrink-0 flex items-center gap-1 transition-all ${
                    isSelected
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : isActive
                      ? "bg-gray-100 text-gray-700"
                      : "bg-gray-50 text-gray-300"
                  }`}
                >
                  {dayLabels[key]}
                  {hasCustom && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
              );
            })}
          </div>

          {/* Card d'édition pour le jour sélectionné */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <span className="text-[14px] font-black text-gray-900">{dayLabels[selectedDayTab]}</span>
              <button
                type="button"
                onClick={() => {
                  setDaySchedule(selectedDayTab, c => ({ ...c, custom: !c.custom }));
                }}
                className={`text-[11px] font-black px-3 py-1 rounded-full transition-colors ${
                  getDaySchedule(selectedDayTab).custom
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {getDaySchedule(selectedDayTab).custom ? "Horaires spécifiques activés" : "Utilise horaires généraux"}
              </button>
            </div>

            {getDaySchedule(selectedDayTab).custom ? (
              <div className="space-y-4">
                {/* Slots jour spécifique */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Créneaux du {dayLabels[selectedDayTab]}</p>
                    <button
                      type="button"
                      onClick={() => setDaySchedule(selectedDayTab, c => ({ ...c, slots: [...(c.slots || []), { start: "", end: "" }] }))}
                      className="text-[11px] font-black text-primary"
                    >
                      + Créneau
                    </button>
                  </div>
                  {(getDaySchedule(selectedDayTab).slots || []).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input
                        type="time"
                        value={s.start || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setDaySchedule(selectedDayTab, c => {
                            const arr = [...(c.slots || [])];
                            arr[idx] = { ...arr[idx], start: val };
                            return { ...c, slots: arr };
                          });
                        }}
                        className="text-[14px] font-bold bg-white border border-gray-200 rounded-xl px-2 py-1.5"
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        type="time"
                        value={s.end || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setDaySchedule(selectedDayTab, c => {
                            const arr = [...(c.slots || [])];
                            arr[idx] = { ...arr[idx], end: val };
                            return { ...c, slots: arr };
                          });
                        }}
                        className="text-[14px] font-bold bg-white border border-gray-200 rounded-xl px-2 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => setDaySchedule(selectedDayTab, c => ({ ...c, slots: c.slots.filter((_, i) => i !== idx) }))}
                        className="text-red-400 font-bold px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {(getDaySchedule(selectedDayTab).slots || []).length === 0 && (
                    <p className="text-[11px] text-gray-400 italic">Aucun créneau spécifique défini pour ce jour.</p>
                  )}
                </div>

                {/* Pauses jour spécifique */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pauses du {dayLabels[selectedDayTab]}</p>
                    <button
                      type="button"
                      onClick={() => setDaySchedule(selectedDayTab, c => ({ ...c, pauses: [...(c.pauses || []), { start: "", end: "", label: "Pause" }] }))}
                      className="text-[11px] font-black text-primary"
                    >
                      + Pause
                    </button>
                  </div>
                  {(getDaySchedule(selectedDayTab).pauses || []).map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input
                        type="time"
                        value={p.start || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setDaySchedule(selectedDayTab, c => {
                            const arr = [...(c.pauses || [])];
                            arr[idx] = { ...arr[idx], start: val };
                            return { ...c, pauses: arr };
                          });
                        }}
                        className="text-[14px] font-bold bg-white border border-gray-200 rounded-xl px-2 py-1.5"
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        type="time"
                        value={p.end || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setDaySchedule(selectedDayTab, c => {
                            const arr = [...(c.pauses || [])];
                            arr[idx] = { ...arr[idx], end: val };
                            return { ...c, pauses: arr };
                          });
                        }}
                        className="text-[14px] font-bold bg-white border border-gray-200 rounded-xl px-2 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => setDaySchedule(selectedDayTab, c => ({ ...c, pauses: c.pauses.filter((_, i) => i !== idx) }))}
                        className="text-red-400 font-bold px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {(getDaySchedule(selectedDayTab).pauses || []).length === 0 && (
                    <p className="text-[11px] text-gray-400 italic">Aucune pause spécifique pour ce jour.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-gray-500 italic">
                Ce jour utilise les horaires et pauses configurés dans l'onglet "Horaires généraux".
              </p>
            )}
          </div>
        </div>
      )}

      {/* Conditions supplémentaires */}
      <div className="space-y-3">
        {[{ key: "deplace", label: "Je me déplace chez les clients", Icon: Car }, { key: "nuit", label: "Prestations de nuit", Icon: Moon }].map(({ key, label, Icon }) => (
          <div key={key} className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3">
            <Icon className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="flex-1 text-[14px] font-bold text-gray-800">{label}</span>
            <button
              type="button"
              onClick={() => setData(d => ({ ...d, [key]: !d[key] }))}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${data[key] ? "bg-primary" : "bg-gray-200"}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${data[key] ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Validation par étape ──────────────────────────────────────────────────────
function validateStep(step, data) {
  const errs = {};
  if (step === 1) {
    if (!data.salon_name?.trim()) errs.salon_name = "Le nom du commerce est requis";
    if (!data.services?.length) errs.services = "Sélectionnez au moins un service";
    if (!data.bio?.trim() || data.bio.trim().length < 20) errs.bio = "La bio doit faire au moins 20 caractères";
    if (!data.type) errs.type = "Choisissez un type d'activité";
  }
  if (step === 3) {
    if (!data.username?.trim() || data.username.length < 3) errs.username = "Minimum 3 caractères";
    if (!data.gallery?.length) errs.salon_photo = "Ajoutez au moins un média (photo ou vidéo)";
  }
  if (step === 4) {
    const siretDigits = (data.siret || "").replace(/\s/g, "");
    if (siretDigits.length > 0 && siretDigits.length !== 14) errs.siret = "Le SIRET doit contenir exactement 14 chiffres";
    if (data.email_pro && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email_pro)) errs.email_pro = "Adresse email invalide";
  }
  return errs;
}

const stepConfig = [
  { title: "Profil & Identité", subtitle: "Présentez-vous au monde.", step: 1 },
  { title: "Spécialités &\nCompétences", subtitle: "Quels services proposez-vous ?", step: 2 },
  { title: "Votre Portfolio", subtitle: "Montrez votre talent au monde.", step: 3 },
  { title: "Vérification\n& Légal", subtitle: "Sécurité et confiance avant tout.", step: 4 },
  { title: "Disponibilités &\nConditions", subtitle: "Finalisez vos conditions de travail.", step: 5 },
];

export default function DevenirPro() {
  const navigate = useNavigate();
  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY + "_step");
      return saved ? parseInt(saved, 10) : 1;
    } catch { return 1; }
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ── Persistance brouillon localStorage ──────────────────────────────────────
  const [data, setDataRaw] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const setData = useCallback((updater) => {
    setDataRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Sync bannière & avatar avec le profil client ─────────────────────────────
  useEffect(() => {
    if (data.avatar_url || data.cover_url) {
      supabase.auth.getUser().then(({ data }) => data?.user).then(user => {
        if (!user) return;
        const updates = {};
        if (data.avatar_url) updates.avatar_url = data.avatar_url;
        if (data.cover_url) updates.cover_url = data.cover_url;
        supabase.auth.getUser().then(async ({ data }) => { if (data?.user) await entities.User.update(data.user.id, updates); }).catch(() => {});
      }).catch(() => {});
    }
  }, [data.avatar_url, data.cover_url]);

  const goNext = async () => {
    const errs = validateStep(step, data);

    // Vérification unicité username à l'étape 3
    if (step === 3 && data.username && !errs.username) {
      const existing = await entities.DemandeProV2.filter({ username: data.username }, "-created_at", 1).catch(() => []);
      if (existing.length > 0) {
        const salonName = (data.salon_name || "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        const suggestions = [
          `${data.username}_beauty`,
          `${data.username}_pro`,
          `${salonName || data.username}_bb`,
          `${data.username}${Math.floor(Math.random() * 99) + 1}`,
        ].filter(s => s.length >= 3);
        errs.username = `Ce nom d'utilisateur est déjà pris. Suggestions : ${suggestions.slice(0, 3).join(", ")}`;
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    if (step < TOTAL_STEPS) {
      const next = step + 1;
      localStorage.setItem(DRAFT_KEY + "_step", next);
      setStep(next);
    } else {
      setSaving(true);
      try {
        const user = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);

        // Payload assaini pour DemandeProV2 (exclut menu_bar & menu_restaurant qui ne sont pas des colonnes de table)
        const demandeData = {
          user_email: user?.email || data.email_pro || "pro@beautybook.fr",
          salon_name: data.salon_name || "",
          bio: data.bio || "",
          type_activite: data.type || "Salon",
          years_experience: data.years || 0,
          services: data.services || [],
          categories: data.categories || [],
          specialites_cheveux: data.cheveux || [],
          username: data.username || "",
          salon_photo: (data.gallery || [])[0] || "",
          portfolio: data.gallery || [],
          phone: data.phone || "",
          email_pro: data.email_pro || "",
          siret: data.siret || "",
          doc_identite_recto: data.doc_identite_recto || "",
          doc_identite_verso: data.doc_identite_verso || "",
          doc_siret: data.doc_siret || "",
          doc_assurance: data.doc_assurance || "",
          days: data.days || ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
          time_slots: data.time_slots || [],
          commodites: data.commodites || [],
          seats_count: data.seats_count || 1,
          se_deplace: data.deplace || false,
          travail_nuit: data.nuit || false,
          visite_video_url: data.visite_video_url || "",
          diplomes: data.diplomes || [],
          has_diplome: (data.diplomes || []).length > 0,
          address: data.address || "",
          city: data.city || "",
          statut: "en_attente",
          updated_at: new Date().toISOString(),
        };

        // Sauvegarde dans DemandeProV2 sans planter
        try {
          const { error: insErr } = await supabase.from('DemandeProV2').insert(demandeData);
          if (insErr) {
            await supabase.from('DemandeProV2').upsert(demandeData, { onConflict: 'user_email' });
          }
        } catch {
          try {
            await supabase.from('DemandeProV2').upsert(demandeData, { onConflict: 'user_email' });
          } catch {}
        }

        // Enregistrement / Activation directe dans ProfilPro
        if (user?.email) {
          const profilProPayload = {
            user_email: user.email,
            salon_name: data.salon_name || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            // Ne jamais écraser une bio existante avec une valeur vide
            ...(data.bio ? { bio: data.bio } : {}),
            avatar_url: data.avatar_url || (data.gallery || [])[0] || "",
            cover_url: data.cover_url || "",
            status: "actif",
            type_activite: data.type || "Salon",
            travail_nuit: data.nuit || false,
            galerie_urls: data.gallery || [],
            updated_at: new Date().toISOString(),
          };

          try {
            const { error: upsErr } = await supabase.from('ProfilPro').upsert(profilProPayload, { onConflict: 'user_email' });
            if (upsErr) {
              await supabase.from('ProfilPro').insert(profilProPayload);
            }
          } catch {
            try {
              await supabase.from('ProfilPro').insert(profilProPayload);
            } catch {}
          }

          localStorage.setItem('pro_profile_cache', JSON.stringify(profilProPayload));
        }

        // Effacer le brouillon et rediriger
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(DRAFT_KEY + "_step");
        writeIsProCache(true);
        navigate("/profil-pro");
      } catch (err) {
        alert("Erreur lors de la soumission : " + (err.message || err));
      }
      setSaving(false);
    }
  };

  const goBack = () => {
    if (step > 1) {
      const prev = step - 1;
      localStorage.setItem(DRAFT_KEY + "_step", prev);
      setStep(prev);
    } else {
      navigate(-1);
    }
  };

  const config = stepConfig[step - 1];

  return (
    <div className="font-display bg-white flex flex-col" style={{ minHeight: "calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between shrink-0">
        <button onClick={goBack} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          {step === 1 ? <X className="w-5 h-5 text-gray-600" /> : <ArrowLeft className="w-5 h-5 text-gray-600" />}
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all ${i + 1 === step ? "w-7 bg-primary" : i + 1 < step ? "w-4 bg-primary/50" : "w-4 bg-gray-200"}`} />
          ))}
        </div>
        <span className="text-[13px] font-black text-gray-400">{step}/{TOTAL_STEPS}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {data.salon_name && (
          <div className="mb-3 flex items-center gap-2 bg-green-50 border border-green-100 rounded-2xl px-3 py-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <span className="text-[11px] font-bold text-green-600">Brouillon sauvegardé automatiquement</span>
          </div>
        )}
        <div className="inline-flex items-center gap-2 bg-orange-100 px-3 py-1.5 rounded-full mb-4">
          <span className="w-2 h-2 bg-primary rounded-full" />
          <span className="text-[11px] font-black text-primary uppercase tracking-widest">Etape {step} / {TOTAL_STEPS}</span>
        </div>
        <h1 className="text-[28px] font-black text-gray-900 leading-tight whitespace-pre-line mb-1">{config.title}</h1>
        <p className="text-[14px] text-gray-400 font-medium mb-6">{config.subtitle}</p>

        {Object.keys(errors).length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-black text-red-600 mb-1">Informations manquantes</p>
              <p className="text-[12px] text-red-500 font-medium">Complétez les champs marqués en rouge pour continuer.</p>
            </div>
          </div>
        )}

        {step === 1 && <Step1 data={data} setData={setData} errors={errors} />}
        {step === 2 && <Step2 data={data} setData={setData} />}
        {step === 3 && <Step3 data={data} setData={setData} errors={errors} />}
        {step === 4 && <Step4 data={data} setData={setData} />}
        {step === 5 && <Step5 data={data} setData={setData} />}
      </div>

      {/* Bottom CTA — collé en bas, sans espace */}
      <div className="shrink-0 px-5 pt-3 pb-0 bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]" style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>
        <button onClick={goNext} disabled={saving}
          className="w-full bg-primary text-white font-black text-[15px] uppercase tracking-widest py-5 rounded-3xl shadow-xl shadow-primary/40 active:scale-95 transition-all hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-3">
          {saving ? (
            <>
              <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" />
              Sauvegarde...
            </>
          ) : step === TOTAL_STEPS ? (
            <><CheckCircle className="w-6 h-6" /> Finaliser ma demande</>
          ) : (
            "Continuer →"
          )}
        </button>
      </div>
    </div>
  );
}