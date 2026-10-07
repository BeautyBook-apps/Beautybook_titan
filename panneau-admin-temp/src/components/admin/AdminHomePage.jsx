import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';
import { adminApi } from "@/lib/adminApiClient";
import { entities } from "@/api/entities";
import { Upload, Loader2, Save, Plus, ChevronDown, ChevronUp, X, Check, Search, Info, Image, Flame, Scissors, Award, Gift, Home, Star, LayoutGrid, Play, Sparkles } from "lucide-react";


const HERO_BANNER_WIDTH = 800;
const HERO_BANNER_HEIGHT = 400;
const HERO_BANNER_RATIO = "4:2";

const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary";
const PRIVATE_CONFIG_KEY = /secret|token|password|credential|stripe|api[._-]?key/i;
const stripPrivateConfig = value => {
  if (Array.isArray(value)) return value.map(stripPrivateConfig);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_CONFIG_KEY.test(key))
      .map(([key, child]) => [key, stripPrivateConfig(child)])
  );
};

const ADMIN_TABS = [
  { id: "hero", label: "Hero", icon: Image },
  { id: "categories", label: "Catégories", icon: LayoutGrid },
  { id: "tendance", label: "Tendance", icon: Flame },
  { id: "salons", label: "Salons", icon: Award },
  { id: "offres", label: "Offres", icon: Gift },
  { id: "recommande", label: "Recommandé", icon: Sparkles },
  { id: "directs", label: "Lives", icon: Play },
  { id: "infos", label: "Infos", icon: Info },
];

// ── Hero Banners Editor ──────────────────────────────────────────────────────
function HeroBannersEditor({ banners = [], onSave }) {
  const [list, setList] = useState(banners.length > 0 ? banners : [{ title: "", subtitle: "", cta: "EN PROFITER", cta_link: "/", image: "" }]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const imgRefs = useRef([]);

  const upload = async (e, idx) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(idx);
    const { file_url } = await uploadFile({ file });
    setList(l => l.map((b, i) => i === idx ? { ...b, image: file_url } : b));
    setUploading(null); e.target.value = "";
  };

  const addBanner = () => setList(l => [...l, { title: "", subtitle: "", cta: "EN PROFITER", cta_link: "/", image: "" }]);
  const removeBanner = (idx) => setList(l => l.filter((_, i) => i !== idx));
  const update = (idx, field, val) => setList(l => l.map((b, i) => i === idx ? { ...b, [field]: val } : b));
  const save = async () => { setSaving(true); await onSave("hero_banners", list); setSaving(false); };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-700 text-[12px] font-black">Taille recommandée</p>
          <p className="text-blue-600 text-[11px] mt-0.5">
            <strong>{HERO_BANNER_WIDTH} × {HERO_BANNER_HEIGHT} px</strong> — Ratio {HERO_BANNER_RATIO}
          </p>
        </div>
      </div>
      {list.map((banner, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-black text-gray-500">Bannière {idx + 1}</span>
            {list.length > 1 && <button onClick={() => removeBanner(idx)} className="w-6 h-6 bg-red-50 rounded-full flex items-center justify-center"><X className="w-3 h-3 text-red-500" /></button>}
          </div>
          <input ref={el => imgRefs.current[idx] = el} type="file" accept="image/*" className="hidden" onChange={e => upload(e, idx)} />
          {banner.image ? (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
              <img src={banner.image} alt="" className="w-20 h-12 rounded-lg object-cover" />
              <span className="text-green-600 text-[12px] flex-1">✓ Image définie</span>
              <button onClick={() => imgRefs.current[idx]?.click()} className="text-primary text-[11px] font-black">Changer</button>
            </div>
          ) : (
            <button onClick={() => imgRefs.current[idx]?.click()} className="w-full flex flex-col items-center justify-center gap-1.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-4 text-gray-400 hover:border-primary transition-all">
              {uploading === idx ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              <p className="text-[13px] font-black">{uploading === idx ? "Upload..." : "Cliquer pour uploader"}</p>
            </button>
          )}
          <input value={banner.title || ""} onChange={e => update(idx, "title", e.target.value)} placeholder="Titre principal" className={inputCls} />
          <input value={banner.subtitle || ""} onChange={e => update(idx, "subtitle", e.target.value)} placeholder="Sous-titre" className={inputCls} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Opacité overlay</label>
              <span className="text-[12px] font-black text-primary">{Math.round((banner.overlay_opacity ?? 0.55) * 100)}%</span>
            </div>
            <input type="range" min="0" max="100" step="5" value={Math.round((banner.overlay_opacity ?? 0.55) * 100)} onChange={e => update(idx, "overlay_opacity", parseInt(e.target.value) / 100)} className="w-full accent-primary h-2 rounded-full cursor-pointer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={banner.cta || ""} onChange={e => update(idx, "cta", e.target.value)} placeholder="Texte bouton" className={inputCls} />
            <input value={banner.cta_link || ""} onChange={e => update(idx, "cta_link", e.target.value)} placeholder="Lien (/boutique)" className={inputCls} />
          </div>
        </div>
      ))}
      <div className="flex gap-3">
        <button onClick={addBanner} className="flex items-center gap-1.5 text-primary text-[12px] font-black border border-primary/30 rounded-xl px-4 py-2.5 hover:bg-primary/5">
          <Plus className="w-3.5 h-3.5" /> Ajouter une bannière
        </button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}

// ── Service Picker ────────────────────────────────────────────────────────────
function ServicesPicker({ selected = [], onSave }) {
  const [services, setServices] = useState([]);
  const [proMap, setProMap] = useState({});
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      entities.Service.filter({ status: "actif" }, "-created_at", 200),
      entities.ProfilPro.filter({ status: "actif" }, "-created_at", 200),
    ]).then(([svcRes, proRes]) => {
      setServices(svcRes.status === "fulfilled" ? svcRes.value || [] : []);
      const map = {};
      (proRes.status === "fulfilled" ? proRes.value || [] : []).forEach(p => { map[p.user_email] = p.salon_name || p.user_email; });
      setProMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (svc) => {
    const img = svc.image_url || (svc.images && svc.images[0]) || "";
    setPicks(p => p.some(x => x.id === svc.id) ? p.filter(x => x.id !== svc.id) : [...p, { id: svc.id, title: svc.title, price: svc.price, image_url: img, category: svc.category, pro_email: svc.pro_email, salon_name: proMap[svc.pro_email] || "", tag: "TENDANCE" }]);
  };

  const save = async () => { setSaving(true); await onSave("services_tendance", picks); setSaving(false); };

  const filtered = search.trim() ? services.filter(s => (s.title + " " + s.category + " " + (proMap[s.pro_email] || "")).toLowerCase().includes(search.toLowerCase())) : services;

  return (
    <div className="space-y-4">
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picks.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
              {p.image_url && <img src={p.image_url} className="w-5 h-5 rounded-lg object-cover" alt="" />}
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-orange-800">{p.title}</span>
                {(p.salon_name || p.pro_email) && <span className="text-[9px] text-orange-500 font-medium">{p.salon_name || p.pro_email}</span>}
              </div>
              <button onClick={() => toggle(p)}><X className="w-3 h-3 text-orange-400" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un service, un salon..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
        {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
          {filtered.map(svc => {
            const sel = picks.some(x => x.id === svc.id);
            const img = svc.image_url || (svc.images && svc.images[0]) || "";
            const salon = proMap[svc.pro_email] || "";
            return (
              <button key={svc.id} onClick={() => toggle(svc)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${sel ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                {img ? <img src={img} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-200 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black text-gray-900 truncate">{svc.title}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">{svc.price}€ · {svc.category}</span>
                    {salon && <span className="text-[9px] text-orange-500 font-bold truncate">· {salon}</span>}
                  </div>
                </div>
                {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
      </button>
    </div>
  );
}

// ── Produits Tendance Picker ──────────────────────────────────────────────────
function ProduitsPicker({ selected = [], onSave }) {
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      entities.Produit.filter({ status: "actif" }, "-created_at", 200),
      fetchShopifyProducts({}).then(r =>
        (r.data?.products || []).map(p => ({ id: p.id, name: p.name, price: p.price, image_url: p.img, brand: p.brand, source: "shopify" }))
      ),
    ]).then(([dbRes, shopifyRes]) => {
      const db = dbRes.status === "fulfilled" ? (dbRes.value || []) : [];
      const shopify = shopifyRes.status === "fulfilled" ? shopifyRes.value : [];
      setItems([...db, ...shopify]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (item) => {
    setPicks(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, item]);
  };

  const save = async () => { setSaving(true); await onSave("produits_tendance", picks); setSaving(false); };

  const filtered = search.trim() ? items.filter(i => (i.name + " " + (i.brand || "")).toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="space-y-4">
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picks.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
              {p.image_url && <img src={p.image_url} className="w-5 h-5 rounded-lg object-cover" alt="" />}
              <span className="text-[12px] font-black text-orange-800">{p.name}</span>
              <button onClick={() => toggle(p)}><X className="w-3 h-3 text-orange-400" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
        {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
          {filtered.map(item => {
            const sel = picks.some(x => x.id === item.id);
            return (
              <button key={item.id} onClick={() => toggle(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${sel ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                {item.image_url && <img src={item.image_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />}
                <div className="flex-1">
                  <p className="text-[12px] font-black text-gray-900">{item.name}</p>
                  <p className="text-[10px] text-gray-400">{item.price}€{item.brand ? ` · ${item.brand}` : ""}</p>
                </div>
                {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
      </button>
    </div>
  );
}

// ── Offres Spéciales Editor ───────────────────────────────────────────────────
function OffresSpecialesEditor({ offres = [], onSave }) {
  const [list, setList] = useState(offres.length > 0 ? offres : [{ salon_name: "", city: "", distance: "", rating: "", image: "", cta_link: "/services-salons" }]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const imgRefs = useRef([]);

  const upload = async (e, idx) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(idx);
    const { file_url } = await uploadFile({ file });
    setList(l => l.map((o, i) => i === idx ? { ...o, image: file_url } : o));
    setUploading(null); e.target.value = "";
  };

  const add = () => setList(l => [...l, { salon_name: "", city: "", distance: "", rating: "", image: "", cta_link: "/services-salons" }]);
  const remove = (idx) => setList(l => l.filter((_, i) => i !== idx));
  const update = (idx, field, val) => setList(l => l.map((o, i) => i === idx ? { ...o, [field]: val } : b));
  const save = async () => { setSaving(true); await onSave("offres_speciales", list); setSaving(false); };

  return (
    <div className="space-y-4">
      {list.map((o, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-black text-gray-500">Offre {idx + 1}</span>
            {list.length > 1 && <button onClick={() => remove(idx)} className="w-6 h-6 bg-red-50 rounded-full flex items-center justify-center"><X className="w-3 h-3 text-red-500" /></button>}
          </div>
          <input ref={el => imgRefs.current[idx] = el} type="file" accept="image/*" className="hidden" onChange={e => upload(e, idx)} />
          {o.image ? (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
              <img src={o.image} alt="" className="w-20 h-12 rounded-lg object-cover" />
              <span className="text-green-600 text-[12px] flex-1">✓ Image définie</span>
              <button onClick={() => imgRefs.current[idx]?.click()} className="text-primary text-[11px] font-black">Changer</button>
            </div>
          ) : (
            <button onClick={() => imgRefs.current[idx]?.click()} className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[12px] hover:border-primary">
              {uploading === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading === idx ? "Upload..." : "Uploader une image"}
            </button>
          )}
          <input value={o.salon_name || ""} onChange={e => update(idx, "salon_name", e.target.value)} placeholder="Nom du salon / offre" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input value={o.city || ""} onChange={e => update(idx, "city", e.target.value)} placeholder="Ville" className={inputCls} />
            <input value={o.distance || ""} onChange={e => update(idx, "distance", e.target.value)} placeholder="Distance" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={o.rating || ""} onChange={e => update(idx, "rating", e.target.value)} placeholder="Note" className={inputCls} />
            <input value={o.cta_link || ""} onChange={e => update(idx, "cta_link", e.target.value)} placeholder="Lien CTA" className={inputCls} />
          </div>
        </div>
      ))}
      <div className="flex gap-3">
        <button onClick={add} className="flex items-center gap-1.5 text-primary text-[12px] font-black border border-primary/30 rounded-xl px-4 py-2.5 hover:bg-primary/5">
          <Plus className="w-3.5 h-3.5" /> Ajouter une offre
        </button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}

// ── Offres Immobilières Picker ────────────────────────────────────────────────
function ImmosPicker({ selected = [], onSave }) {
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    entities.ImmobilierListing.filter({ status: "actif" }, "-created_at", 100)
      .then(res => setItems(res || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (item) => {
    setPicks(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, { id: item.id, title: item.title, price: item.price, location: item.location, images: item.images }]);
  };

  const save = async () => { setSaving(true); await onSave("offres_immobilier", picks); setSaving(false); };

  const filtered = search.trim() ? items.filter(i => (i.title + " " + (i.location || "")).toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="space-y-4">
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picks.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
              <span className="text-[12px] font-black text-orange-800">{p.title}</span>
              <button onClick={() => toggle(p)}><X className="w-3 h-3 text-orange-400" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une offre..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
        {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
          {filtered.map(item => {
            const sel = picks.some(x => x.id === item.id);
            return (
              <button key={item.id} onClick={() => toggle(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${sel ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                {item.images?.[0] && <img src={item.images[0]} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />}
                <div className="flex-1">
                  <p className="text-[12px] font-black text-gray-900">{item.title}</p>
                  <p className="text-[10px] text-gray-400">{item.price}€ · {item.location || ""}</p>
                </div>
                {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
      </button>
    </div>
  );
}

// ── Item Picker Générique ─────────────────────────────────────────────────────
function ItemPicker({ sectionKey, label, desc, emoji, entityName, nameField = "name", onSave, selected = [], single = false }) {
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const entity = entities[entityName];
    if (entity) {
      entity.list("-created_at", 100)
        .then(res => setItems(res || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [entityName]);

  const toggle = (item) => {
    if (single) { setPicks([item]); return; }
    setPicks(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, item]);
  };

  const save = async () => { setSaving(true); await onSave(sectionKey, single ? picks[0] : picks); setSaving(false); };

  const filtered = search.trim() ? items.filter(i => (i[nameField] || i.title || i.salon_name || "").toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="space-y-4">
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picks.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
              {(p.image_url || p.img) && <img src={p.image_url || p.img} className="w-5 h-5 rounded-lg object-cover" alt="" />}
              <span className="text-[12px] font-black text-orange-800">{p[nameField] || p.title || p.salon_name}</span>
              {!single && <button onClick={() => toggle(p)}><X className="w-3 h-3 text-orange-400" /></button>}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
        {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
          {filtered.length === 0 && <p className="text-gray-400 text-center text-[12px] py-4">Aucun résultat</p>}
          {filtered.map(item => {
            const sel = picks.some(x => x.id === item.id);
            return (
              <button key={item.id} onClick={() => toggle(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${sel ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                {(item.image_url || item.img) && <img src={item.image_url || item.img} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />}
                <div className="flex-1">
                  <p className="text-[12px] font-black text-gray-900">{item[nameField] || item.title || item.salon_name || "–"}</p>
                  <p className="text-[10px] text-gray-400">{item.price ? `${item.price}€` : ""} {item.category || item.location || ""}</p>
                </div>
                {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
      </button>
    </div>
  );
}

// ── Partenaires Info ──────────────────────────────────────────────────────────
function PartenairesInfo() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    entities.ProfilPro.filter({ status: "actif" }, "-created_at", 200)
      .then(res => {
        const pros = res || [];
        setCount(pros.filter(p => p.type_activite === "Particulier" && p.has_diplome).length);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-blue-700 text-[13px] font-black mb-1">Affichage automatique</p>
      <p className="text-blue-600 text-[12px] font-medium">
        Les Partenaires Certifiés sont affichés automatiquement : profils avec <strong>type "Particulier"</strong> + <strong>diplôme coché</strong>.
      </p>
      {count !== null && (
        <p className="text-blue-800 text-[13px] font-black mt-3">
          ✓ {count} partenaire{count > 1 ? "s" : ""} éligible{count > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ── Categories Editor ─────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "coiffure", label: "Coiffure", active: true },
  { id: "tresses", label: "Tresses", active: true },
  { id: "manucure", label: "Manucure", active: true },
  { id: "pedicure", label: "Pédicure", active: true },
  { id: "maquillage", label: "Maquillage", active: true },
  { id: "soin_visage", label: "Soin Visage", active: true },
  { id: "barbe", label: "Barbe", active: true },
  { id: "extensions", label: "Extensions", active: true },
  { id: "massage", label: "Massage", active: true },
  { id: "epilation", label: "Épilation", active: true },
  { id: "cils_sourcils", label: "Cils & Sourcils", active: true },
  { id: "spa", label: "Spa & Bien-être", active: true },
];

function CategoriesEditor({ categories = [], onSave }) {
  const [list, setList] = useState(categories.length > 0 ? categories : DEFAULT_CATEGORIES);
  const [saving, setSaving] = useState(false);

  const toggle = (idx) => {
    setList(l => l.map((c, i) => i === idx ? { ...c, active: !c.active } : c));
  };

  const updateLabel = (idx, val) => {
    setList(l => l.map((c, i) => i === idx ? { ...c, label: val } : c));
  };

  const addCategory = () => {
    setList(l => [...l, { id: `custom_${Date.now()}`, label: "", active: true }]);
  };

  const removeCategory = (idx) => {
    setList(l => l.filter((_, i) => i !== idx));
  };

  const save = async () => { setSaving(true); await onSave("categories", list); setSaving(false); };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-gray-500">
        Activez/désactivez les catégories affichées sur la page d'accueil. L'ordre correspond à l'affichage.
      </p>
      <div className="space-y-2">
        {list.map((cat, idx) => (
          <div key={cat.id || idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
            <button onClick={() => toggle(idx)}
              className={`w-10 h-6 rounded-full transition-all relative ${cat.active ? "bg-primary" : "bg-gray-300"}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${cat.active ? "left-[18px]" : "left-0.5"}`} />
            </button>
            <input value={cat.label || ""} onChange={e => updateLabel(idx, e.target.value)}
              placeholder="Nom de la catégorie"
              className="flex-1 bg-transparent text-[13px] font-black text-gray-800 outline-none" />
            {cat.id?.startsWith("custom_") && (
              <button onClick={() => removeCategory(idx)} className="w-6 h-6 bg-red-50 rounded-full flex items-center justify-center">
                <X className="w-3 h-3 text-red-500" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={addCategory} className="flex items-center gap-1.5 text-primary text-[12px] font-black border border-primary/30 rounded-xl px-4 py-2.5 hover:bg-primary/5">
          <Plus className="w-3.5 h-3.5" /> Ajouter une catégorie
        </button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}

// ── Recommandé pour vous Editor ───────────────────────────────────────────────
function RecommandeEditor({ selected = [], onSave }) {
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      entities.Produit.filter({ status: "actif" }, "-created_at", 100),
      fetchShopifyProducts({}).then(r =>
        (r.data?.products || []).map(p => ({ id: p.id, name: p.name, price: p.price, image_url: p.img, brand: p.brand, source: "shopify" }))
      ),
    ]).then(([dbRes, shopifyRes]) => {
      const db = dbRes.status === "fulfilled" ? (dbRes.value || []) : [];
      const shopify = shopifyRes.status === "fulfilled" ? shopifyRes.value : [];
      setItems([...db, ...shopify]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (item) => {
    setPicks(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, item]);
  };

  const save = async () => { setSaving(true); await onSave("recommande_pour_vous", picks); setSaving(false); };

  const filtered = search.trim() ? items.filter(i => (i.name + " " + (i.brand || "")).toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-gray-500">
        Sélectionnez les produits à afficher dans la section "Recommandé pour vous". Si vide, la section utilisera les meilleurs ventes automatiquement.
      </p>
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picks.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
              {p.image_url && <img src={p.image_url} className="w-5 h-5 rounded-lg object-cover" alt="" />}
              <span className="text-[12px] font-black text-orange-800">{p.name}</span>
              <button onClick={() => toggle(p)}><X className="w-3 h-3 text-orange-400" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
        {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
          {filtered.map(item => {
            const sel = picks.some(x => x.id === item.id);
            return (
              <button key={item.id} onClick={() => toggle(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${sel ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                {item.image_url && <img src={item.image_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />}
                <div className="flex-1">
                  <p className="text-[12px] font-black text-gray-900">{item.name}</p>
                  <p className="text-[10px] text-gray-400">{item.price}€{item.brand ? ` · ${item.brand}` : ""}</p>
                </div>
                {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
      </button>
    </div>
  );
}

// ── Directs / Lives Editor ────────────────────────────────────────────────────
function DirectsEditor({ sessions = [], onSave }) {
  const [list, setList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    entities.LiveSession.list("-created_at", 20)
      .then(res => {
        const all = res || [];
        const savedIds = sessions.map(s => s.id);
        const enriched = all.map(s => ({
          ...s,
          selected: savedIds.includes(s.id),
        }));
        setList(enriched);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (idx) => {
    setList(l => l.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));
  };

  const save = async () => {
    setSaving(true);
    const selected = list.filter(s => s.selected).map(({ id, title, host_name, thumbnail_url, status }) => ({ id, title, host_name, thumbnail_url, status }));
    await onSave("directs", selected);
    setSaving(false);
  };

  const STATUS_LABELS = { live: "EN DIRECT", ended: "Terminé", scheduled: "Planifié" };
  const STATUS_COLORS = { live: "bg-red-500", ended: "bg-gray-400", scheduled: "bg-blue-500" };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-gray-500">
        Sélectionnez les sessions live à mettre en avant sur la page d'accueil.
      </p>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : list.length === 0 ? (
        <p className="text-gray-400 text-center text-[12px] py-6">Aucune session live trouvée</p>
      ) : (
        <div className="space-y-2">
          {list.map((session, idx) => (
            <button key={session.id} onClick={() => toggle(idx)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${session.selected ? "border-primary bg-orange-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                {session.thumbnail_url ? (
                  <img src={session.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-gray-900 truncate">{session.title || "Session sans titre"}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">{session.host_name || "Hôte inconnu"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[session.status] || "bg-gray-300"}`} />
                  <span className="text-[10px] font-black text-gray-500 uppercase">{STATUS_LABELS[session.status] || session.status}</span>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${session.selected ? "border-primary bg-primary" : "border-gray-300"}`}>
                {session.selected && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          ))}
        </div>
      )}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminHomePage() {
  const [homeData, setHomeData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");

  useEffect(() => {
    adminApi.getConfig("home_config")
      .then(res => { const rows = res || []; if (rows[0]?.value) setHomeData(rows[0].value); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key, data) => {
    try {
      const updated = { ...homeData, [key]: data };
      const publicConfig = stripPrivateConfig(updated);
      setHomeData(publicConfig);
      const res = await adminApi.getConfig("home_config").catch(() => []);
      const rows = res || [];
      if (rows[0]?.id) {
        await adminApi.updateConfig(rows[0].id, { value: publicConfig });
      } else {
        await adminApi.createConfig({ key: "home_config", value: publicConfig });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('[handleSave] error:', e);
      alert("Erreur lors de la sauvegarde: " + (e.message || "Erreur inconnue"));
    }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-gray-900">Page d'accueil</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Personnalisez le contenu de la page d'accueil
          {saved && <span className="ml-2 text-green-600 font-black animate-pulse">✓ Sauvegardé !</span>}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {ADMIN_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
                isActive ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
              <span className={`text-[11px] font-black uppercase tracking-wider ${isActive ? "text-primary" : ""}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === "hero" && (
          <>
            <HeroBannersEditor banners={homeData.hero_banners || []} onSave={handleSave} />
          </>
        )}

        {activeTab === "tendance" && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Scissors className="w-5 h-5 text-primary" />
                <h3 className="text-[14px] font-black text-gray-900">Services Tendance</h3>
              </div>
              <ServicesPicker selected={homeData.services_tendance || []} onSave={handleSave} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-5 h-5 text-primary" />
                <h3 className="text-[14px] font-black text-gray-900">Produits Tendance</h3>
              </div>
              <ProduitsPicker selected={homeData.produits_tendance || []} onSave={handleSave} />
            </div>
          </>
        )}

        {activeTab === "salons" && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-primary" />
                <h3 className="text-[14px] font-black text-gray-900">Salon du Mois</h3>
              </div>
              <ItemPicker sectionKey="salon_du_mois" label="Salon du Mois" desc="Sélectionnez un salon" emoji="" entityName="ProfilPro" nameField="salon_name" onSave={handleSave} selected={homeData.salon_du_mois ? [homeData.salon_du_mois] : []} single />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h3 className="text-[14px] font-black text-gray-900">Expertise du Mois</h3>
              </div>
              <ItemPicker sectionKey="expertise_du_mois" label="Expertise du Mois" desc="Meilleur particulier" emoji="" entityName="ProfilPro" nameField="salon_name" onSave={handleSave} selected={homeData.expertise_du_mois ? [homeData.expertise_du_mois] : []} single />
            </div>
          </>
        )}

        {activeTab === "offres" && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-primary" />
                <h3 className="text-[14px] font-black text-gray-900">Offres Spéciales</h3>
              </div>
              <OffresSpecialesEditor offres={homeData.offres_speciales || []} onSave={handleSave} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Home className="w-5 h-5 text-primary" />
                <h3 className="text-[14px] font-black text-gray-900">Offres Immobilières</h3>
              </div>
              <ImmosPicker selected={Array.isArray(homeData.offres_immobilier) ? homeData.offres_immobilier : homeData.offres_immobilier ? [homeData.offres_immobilier] : []} onSave={handleSave} />
            </div>
          </>
        )}

        {activeTab === "categories" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-5 h-5 text-primary" />
              <h3 className="text-[14px] font-black text-gray-900">Catégories</h3>
            </div>
            <CategoriesEditor categories={homeData.categories || []} onSave={handleSave} />
          </div>
        )}

        {activeTab === "recommande" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-[14px] font-black text-gray-900">Recommandé pour vous</h3>
            </div>
            <RecommandeEditor selected={homeData.recommande_pour_vous || []} onSave={handleSave} />
          </div>
        )}

        {activeTab === "directs" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-primary" />
              <h3 className="text-[14px] font-black text-gray-900">Directs / Lives</h3>
            </div>
            <DirectsEditor sessions={homeData.directs || []} onSave={handleSave} />
          </div>
        )}

        {activeTab === "infos" && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h3 className="text-[14px] font-black text-gray-900">Partenaires Certifiés</h3>
              </div>
              <PartenairesInfo />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
