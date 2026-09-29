import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Camera, Plus, Trash2, ChevronDown, ChevronUp, X,
  Scissors, Clock, Star, Zap, Check, Store, Phone, MapPin,
  Building2, FileText, Image, Palette, Wifi, Car, Snowflake,
  Baby, Coffee, CreditCard, Accessibility, Shirt, Sofa, ShowerHead,
  Wine, Music, UtensilsCrossed, ArrowRight, CircleDot, Save, Sun, Moon, PawPrint, Copy, Home, Package
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { uploadFile } from "@/api/entities";
import { apiClient } from "@/lib/apiClient";
import { useTheme, useThemeBg } from "@/hooks/useTheme";
import AddressInput from "@/components/ui/AddressInput";

const SPECIALITES_LIST = [
  "Coiffure afro", "Coiffure lisse", "Balayage", "Colorations", "Tresses",
  "Locks", "Maquillage mariée", "Maquillage éditorial", "Soins visage",
  "Épilation", "Ongles gel", "Nail art", "Massage relaxant", "Massage sportif",
  "Barbe", "Rasage traditionnel"
];

const COMMODITES_LIST = [
  { name: "Wifi", Icon: Wifi },
  { name: "Parking", Icon: Car },
  { name: "Climatisation", Icon: Snowflake },
  { name: "Chauffage", Icon: Snowflake },
  { name: "Espace bébé", Icon: Baby },
  { name: "Café offert", Icon: Coffee },
  { name: "Paiement CB", Icon: CreditCard },
  { name: "Accessible PMR", Icon: Accessibility },
  { name: "Vestiaire", Icon: Shirt },
  { name: "Salle d'attente", Icon: Sofa },
  { name: "Douches", Icon: ShowerHead },
  { name: "Champagne", Icon: Wine },
  { name: "Musique d'ambiance", Icon: Music },
  { name: "Miroir éclairé", Icon: Star },
  { name: "Espace VIP", Icon: Star },
  { name: "Loge privée", Icon: Star },
  { name: "TV écran", Icon: Sofa },
  { name: "Lumière naturelle", Icon: Sun },
  { name: "Animaux acceptés", Icon: PawPrint },
  { name: "Terrasse", Icon: Sun },
  { name: "Bar à jus", Icon: Coffee },
  { name: "Bibliothèque", Icon: FileText },
  { name: "Coin enfants", Icon: Baby },
  { name: "Stationnement privé", Icon: Car },
  { name: "Prise électrique", Icon: Zap },
  { name: "Miroirs plein corps", Icon: Star },
  { name: "Éclairage pro", Icon: Star },
];

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAYS_LOW = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const DEFAULT_DAY = { open: true, start: "09:00", end: "19:00", pause_start: "", pause_end: "" };

export default function ModifierProfilPro() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const themeBg = useThemeBg();

  const [data, setData] = useState({
    salon_name: "", phone: "", address: "", city: "", postal_code: "",
    seats: 1, bio: "", avatar_url: "", cover_url: "",
    specialites: [], commodites: [], hours: {}, conges: [],
    travail_nuit: false, se_deplace: false,
    menu_restaurant: [], menu_bar: [], additional_services: [],
    produits: [],
    galerie_urls: [],
    email: "",
  });
  const [coords, setCoords] = useState(null);
  const [profileId, setProfileId] = useState(null); // ID du profil édité (anti-doublons)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({ infos: true });
  const [newService, setNewService] = useState({ name: "", price: "" });
  const [catalogueOptions, setCatalogueOptions] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  const avatarRef = useRef(null);
  const bannerRef = useRef(null);
  const galerieRef = useRef(null);
  const menuImgRefs = useRef({});
  const barImgRefs = useRef({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingGalerie, setUploadingGalerie] = useState(false);
  const [uploadingMenuImg, setUploadingMenuImg] = useState({});


  useEffect(() => {
    if (!user?.email) return;
    // Anti-doublons : récupère tous les profils et choisit le meilleur
    // (même priorité que VueClient : actif avec images > actif > avec images > plus récent).
    // maybeSingle() échouait en cas de doublons et chaque sauvegarde créait un nouveau profil.
    const pickBest = (profiles) => {
      if (!profiles || profiles.length === 0) return null;
      const sorted = [...profiles].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return (
        sorted.find(p => p.status === 'actif' && (p.avatar_url || p.cover_url)) ||
        sorted.find(p => p.status === 'actif') ||
        sorted.find(p => p.avatar_url || p.cover_url) ||
        sorted[0]
      );
    };
    supabase.from('ProfilPro').select('*').eq('user_email', user.email).order('created_at', { ascending: false })
      .then(({ data: profiles }) => {
        const p = pickBest(profiles);
        if (p?.id) setProfileId(p.id);
        let profile = p;
        if (!profile) {
          profile = { user_email: user.email };
        }
        if (profile) {
          const src = profile.ouverture || profile.horaires || {};
          const h = {};
          DAYS_LOW.forEach(d => {
            const existing = src[d] || {};
            h[d] = {
              open: existing.open !== undefined ? existing.open : true,
              start: existing.start || "09:00",
              end: existing.end || "19:00",
              pause_start: existing.pause_start || existing.break_start || "",
              pause_end: existing.pause_end || existing.break_end || "",
            };
          });
          setData({
            salon_name: profile.salon_name || "", phone: profile.phone || "", address: profile.address || "",
            city: profile.city || "", postal_code: profile.postal_code || "",
            seats: profile.seats_count || 1,
            bio: profile.bio || "", avatar_url: profile.avatar_url || "", cover_url: profile.cover_url || "",
            specialites: profile.specialites || [], commodites: profile.commodites || [],
            hours: h, conges: (src.conges || []),
            travail_nuit: !!profile.travail_nuit,
            se_deplace: !!profile.se_deplace,
            produits: Array.isArray(profile.produits) ? profile.produits : [],
            menu_restaurant: profile.menu_restaurant || [], menu_bar: profile.menu_bar || [],
            additional_services: profile.additional_services || [],
            galerie_urls: Array.isArray(profile.galerie_urls) ? profile.galerie_urls : [],
            email: user?.email || "",
          });
        }
        setLoading(false);
      });
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    supabase.from("CatalogueOption").select("*").eq("pro_email", user.email).order("usage_count", { ascending: false })
      .then(({ data }) => { if (!cancelled) setCatalogueOptions(data || []); });
    return () => { cancelled = true; };
  }, [user?.email]);

  const toggleSection = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleSpecialite = (s) => {
    setData(d => ({
      ...d,
      specialites: d.specialites.includes(s) ? d.specialites.filter(x => x !== s) : [...d.specialites, s],
    }));
  };

  const toggleCommodite = (c) => {
    setData(d => ({
      ...d,
      commodites: d.commodites.includes(c) ? d.commodites.filter(x => x !== c) : [...d.commodites, c],
    }));
  };

  const updateHours = (day, value) => {
    setData(d => ({ ...d, hours: { ...d.hours, [day]: value } }));
  };

  const toggleDay = (day) => {
    setData(d => ({ ...d, hours: { ...d.hours, [day]: { ...d.hours[day], open: !d.hours[day]?.open } } }));
  };

  const handleBulkApply = () => {
    const open = data.hours[DAYS_LOW[0]] || DEFAULT_DAY;
    const newHours = {};
    DAYS_LOW.forEach(d => { newHours[d] = { ...open }; });
    setData(d => ({ ...d, hours: newHours }));
  };

  const handleToggleNuit = (val) => {
    const newHours = {};
    DAYS_LOW.forEach(d => {
      const prev = data.hours[d] || DEFAULT_DAY;
      if (val && prev.open) {
        // Mode Nuit : 9h du matin → 7h le lendemain
        newHours[d] = { ...prev, start: "09:00", end: "07:00" };
      } else if (!val && prev.open) {
        newHours[d] = { ...prev, start: "09:00", end: "19:00" };
      } else {
        newHours[d] = prev;
      }
    });
    setData(d => ({ ...d, hours: newHours, travail_nuit: val }));
  };

  // Menu restaurant helpers
  const addMenuItem = () => setData(d => ({ ...d, menu_restaurant: [...(d.menu_restaurant || []), { nom: "", prix: "", description: "", image_url: "" }] }));
  const updateMenuItem = (i, field, val) => {
    const arr = [...(data.menu_restaurant || [])];
    arr[i] = { ...arr[i], [field]: val };
    setData(d => ({ ...d, menu_restaurant: arr }));
  };
  const removeMenuItem = (i) => setData(d => ({ ...d, menu_restaurant: (d.menu_restaurant || []).filter((_, idx) => idx !== i) }));

  // Menu bar helpers
  const addBarItem = () => setData(d => ({ ...d, menu_bar: [...(d.menu_bar || []), { nom: "", prix: "", description: "", image_url: "" }] }));
  const updateBarItem = (i, field, val) => {
    const arr = [...(data.menu_bar || [])];
    arr[i] = { ...arr[i], [field]: val };
    setData(d => ({ ...d, menu_bar: arr }));
  };
  const removeBarItem = (i) => setData(d => ({ ...d, menu_bar: (d.menu_bar || []).filter((_, idx) => idx !== i) }));

  const uploadMenuImg = async (i, file, type) => {
    if (!file) return;
    const key = `${type}_${i}`;
    setUploadingMenuImg(u => ({ ...u, [key]: true }));
    const { file_url } = await uploadFile({ file });
    if (type === "resto") updateMenuItem(i, "image_url", file_url);
    else updateBarItem(i, "image_url", file_url);
    setUploadingMenuImg(u => ({ ...u, [key]: false }));
  };

  const openUber = () => {
    const addr = encodeURIComponent(data.address || "");
    window.open(`https://www.ubereats.com/fr/search?q=${addr}`, "_blank");
  };
  const openDeliveroo = () => {
    const addr = encodeURIComponent(data.address || "");
    window.open(`https://deliveroo.fr/fr/restaurants?q=${addr}`, "_blank");
  };

  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (type === 'avatar') setUploadingAvatar(true);
      else setUploadingBanner(true);
      const { file_url } = await uploadFile({ file });
      setData(d => ({ ...d, [type === 'avatar' ? 'avatar_url' : 'cover_url']: file_url }));
    } catch (e) {
      console.error('Upload error:', e);
    }
    if (type === 'avatar') setUploadingAvatar(false);
    else setUploadingBanner(false);
  };

  const handleGalerieUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingGalerie(true);
    try {
      const newUrls = [];
      for (const file of files) {
        const { file_url } = await uploadFile({ file });
        newUrls.push(file_url);
      }
      setData(d => ({ ...d, galerie_urls: [...(d.galerie_urls || []), ...newUrls] }));
    } catch (e) {
      console.error('Galerie upload error:', e);
    }
    setUploadingGalerie(false);
    if (galerieRef.current) galerieRef.current.value = '';
  };

  const removeGalerieImage = (index) => {
    setData(d => ({ ...d, galerie_urls: d.galerie_urls.filter((_, i) => i !== index) }));
  };

  const geocodeAndSave = async (address, city) => {
    if (coords) return coords;
    const addr = [address, city].filter(Boolean).join(", ");
    if (!addr) return { latitude: null, longitude: null };
    try {
      const res = await apiClient.callFunction('geocode', { addresses: [addr] });
      const data = res?.data?.results || res?.results || [];
      if (data.length > 0 && data[0].lat) return { latitude: data[0].lat, longitude: data[0].lng };
    } catch {}
    return { latitude: null, longitude: null };
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setEmailChanged(false);
    try {
      // Si l'email a changé, mettre à jour via Supabase Auth
      if (data.email && data.email !== user?.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: data.email });
        if (emailErr) {
          setError("Erreur email: " + (emailErr.message || "Impossible de modifier l'email."));
          setSaving(false);
          return;
        }
        setEmailChanged(true);
      }

      // Utilise l'ID du profil chargé (anti-doublons). Si absent, vérifie une dernière fois
      // avec une requête ordonnée (maybeSingle échouait en cas de doublons).
      let existingId = profileId;
      if (!existingId) {
        const { data: rows } = await supabase.from('ProfilPro').select('id').eq('user_email', user.email).order('created_at', { ascending: false }).limit(1);
        existingId = rows?.[0]?.id || null;
        if (existingId) setProfileId(existingId);
      }

      const coords = await geocodeAndSave(data.address, data.city);

      const core = {
        salon_name: data.salon_name || "",
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        bio: data.bio || "",
        avatar_url: data.avatar_url || "",
        cover_url: data.cover_url || "",
        travail_nuit: data.travail_nuit,
        se_deplace: data.se_deplace,
        ...coords,
      };

      let saveError = null;
      if (existingId) {
        const { error } = await supabase.from('ProfilPro').update(core).eq('id', existingId);
        saveError = error;
      } else {
        const { user: authUser } = await supabase.auth.getUser();
        const { error } = await supabase.from('ProfilPro').insert({ ...core, user_email: user.email, created_by_id: authUser?.id || null });
        saveError = error;
      }
      if (saveError) throw saveError;

      // NOTE : les colonnes pauses, menu_restaurant, menu_bar et additional_services
      // n'existent pas dans la table ProfilPro — ne pas les inclure ici,
      // sinon la requête échoue et la sauvegarde affiche une erreur.
      // Les pauses sont déjà stockées dans ouverture/horaires (pause_start/pause_end par jour).
      const extra = {
        seats_count: data.seats,
        specialites: data.specialites,
        commodites: data.commodites,
        ouverture: { ...data.hours, conges: data.conges },
        horaires: { ...data.hours, conges: data.conges },
        galerie_urls: data.galerie_urls || [],
        updated_at: new Date().toISOString(),
      };
      if (existingId) {
        const { error: extraError } = await supabase.from('ProfilPro').update(extra).eq('id', existingId);
        if (extraError) throw extraError;
      }

      // Produits (mèches à commander…) : colonne récente — mise à jour
      // tolérante : si la migration n'a pas été exécutée, la sauvegarde
      // principale n'est pas bloquée (l'agent vocal proposera alors au
      // client d'en parler directement avec le salon).
      if (existingId) {
        try {
          const { error: prodError } = await supabase.from('ProfilPro').update({ produits: data.produits || [] }).eq('id', existingId);
          if (prodError && !/Could not find the 'produits' column/i.test(prodError.message || '')) throw prodError;
        } catch (e) {
          if (!/Could not find the 'produits' column/i.test(e?.message || '')) throw e;
        }
      }

      try { localStorage.setItem('pro_profile_cache', JSON.stringify(core)); } catch {}
      window.dispatchEvent(new CustomEvent('pro-profile-updated', { detail: { avatar_url: data.avatar_url, cover_url: data.cover_url } }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError("Erreur: " + e.message);
    }
    setSaving(false);
  };

  const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-[#E8732A] transition-colors";
  const sectionCls = "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden";

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-[#E8732A] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="font-display min-h-screen" style={{ background: themeBg }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-gray-900 to-gray-800 text-white px-5 pt-12 pb-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center active:scale-95 transition-transform">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-[18px] font-black tracking-tight">Modifier le Profil Pro</h1>
              <p className="text-[11px] font-bold text-[#E8732A] flex items-center gap-1">
                <CircleDot className="w-2.5 h-2.5 fill-[#E8732A]" /> Espace professionnel
              </p>
            </div>
          </div>
          <span className="bg-gradient-to-r from-[#E8732A] to-[#F59E0B] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-orange-500/25">PRO</span>
        </div>
      </div>

      <div className="px-4 pb-32 space-y-3 pt-4">
        {/* Notifications */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 text-[10px] font-black">!</span>
            </div>
            <p className="text-[12px] text-red-500 font-bold">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <p className="text-[12px] text-green-600 font-bold">Modifications enregistrées !</p>
          </div>
        )}
        {emailChanged && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 text-[10px] font-black">@</span>
            </div>
            <p className="text-[12px] text-blue-600 font-bold">Un email de confirmation a été envoyé à <strong>{data.email}</strong>.</p>
          </div>
        )}

        {/* Photos */}
        <div className={sectionCls + " p-4"}>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div onClick={() => avatarRef.current?.click()} className="w-24 h-24 rounded-full border-4 border-[#E8732A] overflow-hidden cursor-pointer shadow-lg shadow-orange-500/20 transition-transform active:scale-95">
                {data.avatar_url
                  ? <BeautyImage src={data.avatar_url} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center"><Camera className="w-8 h-8 text-orange-300" /></div>
                }
              </div>
              <button onClick={() => avatarRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 bg-gray-900 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <button onClick={() => avatarRef.current?.click()} className="text-[12px] font-black text-[#E8732A] active:scale-95 transition-transform">
              {uploadingAvatar ? "Upload..." : "CHANGER LA PHOTO"}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, 'avatar')} />
          </div>
          <div onClick={() => bannerRef.current?.click()} className="relative mt-3 h-28 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 cursor-pointer hover:border-[#E8732A]/40 transition-colors">
            {data.cover_url
              ? <BeautyImage src={data.cover_url} className="w-full h-full object-cover opacity-80" />
              : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <Image className="w-6 h-6 text-gray-300" />
                  <span className="text-[11px] text-gray-400 font-medium">MODIFIER LA BANNIERE</span>
                </div>
            }
          </div>
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, 'cover')} />
        </div>

        {/* Images du salon */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('images')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl flex items-center justify-center">
              <Palette className="w-5 h-5 text-pink-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Images du salon</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.images ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.images && (
            <div className="px-4 pb-4">
              <p className="text-[11px] text-gray-400 mb-3">{(data.galerie_urls || []).length} photo{(data.galerie_urls || []).length !== 1 ? 's' : ''} · Appuyez sur + pour en ajouter</p>
              {(data.galerie_urls || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {data.galerie_urls.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                      <BeautyImage src={url} alt={`Salon ${i + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removeGalerieImage(i)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div onClick={() => galerieRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#E8732A]/40 transition-colors active:scale-95">
                {uploadingGalerie ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-5 h-5 text-gray-300" />
                )}
                <span className="text-[10px] text-gray-400 mt-0.5">Ajouter</span>
              </div>
              <input ref={galerieRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalerieUpload} />
            </div>
          )}
        </div>

        {/* Informations générales */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('infos')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Informations générales</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.infos ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.infos && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Store className="w-3 h-3" /> Nom du salon / commerce *
                </p>
                <input value={data.salon_name} onChange={e => setData(d => ({ ...d, salon_name: e.target.value }))} placeholder="Ex: Jigen Beauty" className={inputCls} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> Email du compte
                </p>
                <input type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))}
                  placeholder="votre@email.com" className={inputCls} />
                <p className="text-[10px] text-gray-400 mt-1">Un email de confirmation sera envoyé à la nouvelle adresse</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> Téléphone
                </p>
                <input value={data.phone} onChange={e => setData(d => ({ ...d, phone: e.target.value }))} placeholder="+33 6 00 00 00 00" className={inputCls} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Adresse
                </p>
                <AddressInput
                  value={data.address}
                  onChange={(v) => setData(d => ({ ...d, address: v }))}
                  onCityChange={(city) => setData(d => ({ ...d, city }))}
                  onCoordinatesChange={(c) => setCoords(c)}
                  placeholder="Ex: 12 rue de la Paix, Paris"
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Ville
                  </p>
                  <input value={data.city} onChange={e => setData(d => ({ ...d, city: e.target.value }))} placeholder="Paris" className={inputCls} />
                </div>
                <div className="w-24">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> CP
                  </p>
                  <input value={data.postal_code} onChange={e => setData(d => ({ ...d, postal_code: e.target.value }))} placeholder="75001" maxLength={5} className={inputCls} />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nombre de postes simultanés</p>
                <p className="text-[11px] text-gray-400 mb-2">Clients servis en même temps.</p>
                <div className="flex items-center gap-4 justify-center">
                  <button onClick={() => setData(d => ({ ...d, seats: Math.max(1, d.seats - 1) }))} className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-gray-500 active:scale-95 transition-transform">
                    -
                  </button>
                  <div className="text-center min-w-[60px]">
                    <span className="text-[28px] font-black text-gray-900">{data.seats}</span>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Poste{data.seats > 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => setData(d => ({ ...d, seats: d.seats + 1 }))} className="w-11 h-11 bg-[#E8732A] rounded-full flex items-center justify-center text-xl font-bold text-white active:scale-95 transition-transform shadow-lg shadow-orange-500/25">
                    +
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Biographie professionnelle
                </p>
                <textarea value={data.bio} onChange={e => e.target.value.length <= 300 && setData(d => ({ ...d, bio: e.target.value }))} rows={4} placeholder="Décrivez votre expertise..." className={inputCls + " resize-none"} />
                <p className="text-right text-[10px] text-gray-400 mt-1">{data.bio.length} / 300</p>
              </div>
            </div>
          )}
        </div>

        {/* Nos spécialités */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('specs')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Nos spécialités</p>
            {data.specialites.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">{data.specialites.length}</span>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.specs ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.specs && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {SPECIALITES_LIST.map(s => (
                <button key={s} onClick={() => toggleSpecialite(s)}
                  className={`px-3 py-2 rounded-full text-[11px] font-bold border-2 transition-all active:scale-95 ${data.specialites.includes(s) ? "border-[#E8732A] bg-[#E8732A] text-white shadow-md shadow-orange-500/20" : "border-gray-200 text-gray-600 bg-white"}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Commodités */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('commodites')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Commodités</p>
            {data.commodites.length > 0 && (
              <span className="bg-cyan-100 text-cyan-700 text-[10px] font-black px-2 py-0.5 rounded-full">{data.commodites.length}</span>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.commodites ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.commodites && (
            <div className="px-4 pb-4 grid grid-cols-3 gap-2">
              {COMMODITES_LIST.map(({ name, Icon }) => (
                <button key={name} onClick={() => toggleCommodite(name)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all active:scale-95 ${data.commodites.includes(name) ? "border-[#E8732A] bg-orange-50" : "border-gray-100 bg-white"}`}>
                  <Icon className={`w-5 h-5 ${data.commodites.includes(name) ? 'text-[#E8732A]' : 'text-gray-400'}`} />
                  <span className="text-[10px] font-bold text-gray-700 leading-tight text-center">{name}</span>
                  {data.commodites.includes(name) && <Check className="w-3 h-3 text-[#E8732A]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Services supplémentaires — synchronisé avec Catalogue d'options */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('services')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl flex items-center justify-center">
              <Scissors className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Services supplémentaires</p>
            {catalogueOptions.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">{catalogueOptions.length}</span>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.services ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.services && (
            <div className="px-4 pb-4 space-y-3">
              {catalogueOptions.length > 0 ? (
                <div className="space-y-2">
                  {catalogueOptions.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-900 truncate">{opt.name}</p>
                        <div className="flex items-center gap-2">
                          {opt.price > 0 && <p className="text-[11px] font-bold text-primary">{opt.price}€</p>}
                          {opt.usage_count > 0 && <p className="text-[10px] text-gray-400">{opt.usage_count} utilisation(s)</p>}
                          {opt.category && <p className="text-[10px] text-gray-400">· {opt.category}</p>}
                        </div>
                      </div>
                      <button onClick={async () => {
                        await supabase.from("CatalogueOption").delete().eq("id", opt.id);
                        setCatalogueOptions(prev => prev.filter(o => o.id !== opt.id));
                        setData(d => ({ ...d, additional_services: d.additional_services.filter(s => s.name !== opt.name) }));
                      }}
                        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 active:scale-95">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : data.additional_services.length > 0 ? (
                <div className="space-y-2">
                  {data.additional_services.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-900 truncate">{s.name}</p>
                        {s.price && <p className="text-[11px] font-bold text-primary">{s.price}€</p>}
                      </div>
                      <button onClick={() => setData(d => ({ ...d, additional_services: d.additional_services.filter((_, j) => j !== i) }))}
                        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 active:scale-95">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-gray-400 text-center py-2">Aucun service supplémentaire</p>
              )}
              <div className="flex gap-2">
                <input value={newService.name} onChange={e => setNewService(s => ({ ...s, name: e.target.value }))}
                  placeholder="Nom du service" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#E8732A]" />
                <input value={newService.price} onChange={e => setNewService(s => ({ ...s, price: e.target.value }))}
                  placeholder="Prix €" type="number" className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#E8732A]" />
              </div>
              <button onClick={async () => {
                if (!newService.name.trim()) return;
                const name = newService.name.trim();
                const price = newService.price || "";
                const { data: inserted } = await supabase.from("CatalogueOption").insert({
                  name, price: parseFloat(price) || 0, pro_email: user.email, usage_count: 1, category: "Supplément"
                }).select();
                if (inserted?.[0]) setCatalogueOptions(prev => [inserted[0], ...prev]);
                setData(d => ({ ...d, additional_services: [...d.additional_services, { name, price }] }));
                setNewService({ name: "", price: "" });
              }} disabled={!newService.name.trim()}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-[12px] font-bold text-gray-400 hover:border-[#E8732A]/40 hover:text-[#E8732A] transition-colors active:scale-95 disabled:opacity-40">
                <Plus className="w-4 h-4" /> AJOUTER UN SERVICE
              </button>
            </div>
          )}
        </div>

        {/* Menu / Carte */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('menu')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Menu / Carte</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.menu ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.menu && (
            <div className="px-4 pb-4 space-y-6">
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

              {/* Menu Bar & Boissons */}
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
          )}
        </div>

        {/* Gérer les services */}
        <div className={sectionCls}>
          <button onClick={() => navigate('/pro/catalogue-services')} className="w-full flex items-center gap-3 p-4 active:bg-gray-50 transition-colors">
            <div className="w-11 h-11 bg-gradient-to-br from-[#E8732A]/10 to-orange-100 rounded-xl flex items-center justify-center">
              <Scissors className="w-5 h-5 text-[#E8732A]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14px] font-black text-gray-900">Gérer les services</p>
              <p className="text-[11px] text-gray-400">Voir le catalogue de prestations</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Mode de travail */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('workmode')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Mode de travail</p>
            {(data.travail_nuit || data.se_deplace) && (
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                {[data.se_deplace && "Domicile", data.travail_nuit && "Nuit"].filter(Boolean).join(" · ")}
              </span>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.workmode ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.workmode && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-[11px] text-gray-500 font-medium">Ces modes apparaissent sur votre page vue client et sont annoncés par l'assistant vocal (avec les coûts supplémentaires).</p>
              <button onClick={() => setData(d => ({ ...d, se_deplace: !d.se_deplace }))}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] ${data.se_deplace ? "border-[#E8732A] bg-orange-50" : "border-gray-200 bg-white"}`}>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl flex items-center justify-center">
                  <Home className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-black text-gray-900">Travail à domicile</p>
                  <p className="text-[11px] text-gray-500 font-medium">Déplacement chez le client (frais de transport calculés au km)</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${data.se_deplace ? "bg-[#E8732A]" : "bg-gray-200"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${data.se_deplace ? "left-[22px]" : "left-0.5"}`} />
                </div>
              </button>
              <button onClick={() => handleToggleNuit(!data.travail_nuit)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] ${data.travail_nuit ? "border-[#E8732A] bg-orange-50" : "border-gray-200 bg-white"}`}>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl flex items-center justify-center">
                  <Moon className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-black text-gray-900">Travail de nuit</p>
                  <p className="text-[11px] text-gray-500 font-medium">Horaires 09h00 → 07h00, majoration de 50 % entre 21h et 7h</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${data.travail_nuit ? "bg-[#E8732A]" : "bg-gray-200"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${data.travail_nuit ? "left-[22px]" : "left-0.5"}`} />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Produits à commander (mèches…) */}
        <div className={sectionCls}>
          <button onClick={() => toggleSection('produits')} className="w-full flex items-center gap-3 p-4">
            <div className="w-11 h-11 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="flex-1 text-left text-[14px] font-black text-gray-900">Produits à commander</p>
            {data.produits.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">{data.produits.length}</span>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${expanded.produits ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>
          {expanded.produits && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-[11px] text-gray-500 font-medium">Mèches et produits que vous pouvez commander pour vos clientes. L'assistant vocal annoncera ces prix et délais réels au téléphone.</p>
              {(data.produits || []).map((p, i) => (
                <div key={i} className="p-3 rounded-2xl border-2 border-gray-100 bg-white space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={p.name || ""} onChange={(e) => { const a = [...data.produits]; a[i] = { ...a[i], name: e.target.value }; setData(d => ({ ...d, produits: a })); }}
                      placeholder="Nom du produit (ex : Mèches brésiliennes)" className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-medium" />
                    <button onClick={() => setData(d => ({ ...d, produits: d.produits.filter((_, j) => j !== i) }))} className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center active:scale-95 shrink-0">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input type="number" min="0" step="0.01" value={p.price ?? ""} onChange={(e) => { const a = [...data.produits]; a[i] = { ...a[i], price: e.target.value }; setData(d => ({ ...d, produits: a })); }}
                        placeholder="Prix (€)" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-medium" />
                    </div>
                    <div className="flex-1">
                      <input value={p.delivery_delay || ""} onChange={(e) => { const a = [...data.produits]; a[i] = { ...a[i], delivery_delay: e.target.value }; setData(d => ({ ...d, produits: a })); }}
                        placeholder="Délai (ex : 3 à 5 jours)" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-medium" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setData(d => ({ ...d, produits: [...(d.produits || []), { name: "", price: "", delivery_delay: "" }] }))}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-[12px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Ajouter un produit
              </button>
            </div>
          )}
        </div>

        {/* Supprimer mon compte */}
        <div className={sectionCls}>
          <button onClick={() => navigate('/supprimer-compte')} className="w-full flex items-center gap-3 p-4 active:bg-gray-50 transition-colors">
            <div className="w-11 h-11 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-[14px] font-bold text-red-500">Supprimer mon compte</p>
          </button>
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-5 z-[99]" style={{ paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: saving ? "#d1d5db" : "linear-gradient(135deg, #E8732A, #F59E0B)", boxShadow: saving ? "none" : "0 8px 30px rgba(232,115,42,0.35)" }}>
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </div>
  );
}
