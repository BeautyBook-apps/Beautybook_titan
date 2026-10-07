import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';
import { adminApi } from "@/lib/adminApiClient";
import { entities } from "@/api/entities";
import { Upload, Loader2, Save, Plus, ChevronDown, ChevronUp, X, Check, Search, Info, Palette } from "lucide-react";


// Format recommandé pour les bannières Hero : 4:2 (env 800×400px)
const HERO_BANNER_WIDTH = 800;
const HERO_BANNER_HEIGHT = 400;
const HERO_BANNER_RATIO = "4:2";

const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary";

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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-gray-900 text-[14px] font-black">🖼 Bannières Hero</p>
          <p className="text-gray-500 text-[11px] mt-0.5">Plusieurs bannières avec navigation en points</p>
        </div>
        <button onClick={addBanner} className="flex items-center gap-1.5 text-primary text-[12px] font-black border border-primary/30 rounded-xl px-3 py-2 hover:bg-primary/5">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>
      {/* Info taille */}
      <div className="mx-5 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-700 text-[12px] font-black">Taille recommandée pour les bannières Hero</p>
          <p className="text-blue-600 text-[11px] mt-0.5">
            <strong>{HERO_BANNER_WIDTH} × {HERO_BANNER_HEIGHT} px</strong> — Ratio {HERO_BANNER_RATIO} (format carré large).<br />
            L'image sera automatiquement recadrée pour remplir la bannière. Préférez des images larges avec le sujet centré.
          </p>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        {list.map((banner, idx) => (
          <div key={idx} className="border border-gray-200 rounded-2xl p-4 space-y-3">
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
                <p className="text-[13px] font-black">{uploading === idx ? "Upload en cours..." : "Cliquer pour uploader"}</p>
                <p className="text-[11px] text-gray-400">Taille idéale : {HERO_BANNER_WIDTH}×{HERO_BANNER_HEIGHT}px (ratio {HERO_BANNER_RATIO})</p>
              </button>
            )}
            <input value={banner.title || ""} onChange={e => update(idx, "title", e.target.value)} placeholder="Titre principal" className={inputCls} />
            <input value={banner.subtitle || ""} onChange={e => update(idx, "subtitle", e.target.value)} placeholder="Sous-titre" className={inputCls} />
            {/* Slider opacité overlay */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Opacité de l'overlay sombre</label>
                <span className="text-[12px] font-black text-primary">{Math.round((banner.overlay_opacity ?? 0.55) * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="100" step="5"
                value={Math.round((banner.overlay_opacity ?? 0.55) * 100)}
                onChange={e => update(idx, "overlay_opacity", parseInt(e.target.value) / 100)}
                className="w-full accent-primary h-2 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0% (transparent)</span>
                <span>100% (noir total)</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={banner.cta || ""} onChange={e => update(idx, "cta", e.target.value)} placeholder="Texte bouton" className={inputCls} />
              <input value={banner.cta_link || ""} onChange={e => update(idx, "cta_link", e.target.value)} placeholder="Lien (/boutique)" className={inputCls} />
            </div>
          </div>
        ))}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder les bannières</>}
        </button>
      </div>
    </div>
  );
}

// ── Service Picker ────────────────────────────────────────────────────────────
function ServicesPicker({ selected = [], onSave }) {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (services.length) return;
    setLoading(true);
    const res = await entities.Service.filter({ status: "actif" }, "-created_at", 100).catch(() => []);
    setServices(res || []);
    setLoading(false);
  };

  const toggle = (svc) => {
    setPicks(p => p.some(x => x.id === svc.id) ? p.filter(x => x.id !== svc.id) : [...p, { id: svc.id, title: svc.title, price: svc.price, image_url: svc.image_url, category: svc.category, tag: "TENDANCE" }]);
  };

  const save = async () => { setSaving(true); await onSave("services_tendance", picks); setSaving(false); setOpen(false); };

  const filtered = search.trim() ? services.filter(s => (s.title + " " + s.category).toLowerCase().includes(search.toLowerCase())) : services;
  const suggestions = search.trim() ? filtered.slice(0, 5) : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => { setOpen(o => !o); load(); }} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
        <div>
          <p className="text-gray-900 text-[14px] font-black">✂️ Services Tendance</p>
          <p className="text-gray-500 text-[11px] mt-0.5">{picks.length} sélectionné(s)</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
          {picks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {picks.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
                  {p.image_url && <img src={p.image_url} className="w-5 h-5 rounded-lg object-cover" alt="" />}
                  <span className="text-[12px] font-black text-orange-800">{p.title}</span>
                  <button onClick={() => toggle(p)}><X className="w-3 h-3 text-orange-400" /></button>
                </div>
              ))}
            </div>
          )}
          {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : (
            <div className="relative">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-1">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un service..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
                {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
              </div>
              {suggestions.length > 0 && (
                <div className="border border-primary/20 rounded-xl overflow-hidden mb-2">
                  {suggestions.map(svc => (
                    <button key={svc.id} onClick={() => { toggle(svc); setSearch(""); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-100 last:border-0">
                      {svc.image_url && <img src={svc.image_url} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0" />}
                      <div className="flex-1">
                        <p className="text-[12px] font-black text-gray-900">{svc.title}</p>
                        <p className="text-[10px] text-gray-400">{svc.price}€ · {svc.category}</p>
                      </div>
                      {picks.some(x => x.id === svc.id) && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                {(search.trim() ? filtered : services).map(svc => {
                  const sel = picks.some(x => x.id === svc.id);
                  return (
                    <button key={svc.id} onClick={() => toggle(svc)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${sel ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                      {svc.image_url && <img src={svc.image_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />}
                      <div className="flex-1">
                        <p className="text-[12px] font-black text-gray-900">{svc.title}</p>
                        <p className="text-[10px] text-gray-400">{svc.price}€ · {svc.category}</p>
                      </div>
                      {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Styles Tendance Picker ───────────────────────────────────────────────────
function StylesPicker({ selected = [], onSave }) {
  const [styles, setStyles] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (styles.length) return;
    setLoading(true);
    const res = await entities.Style.filter({ status: "publie" }, "-created_at", 200).catch(() => []);
    setStyles(res || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (style) => {
    const image = style.image_url || (style.images && style.images[0]) || "";
    setPicks(p => p.some(x => x.id === style.id)
      ? p.filter(x => x.id !== style.id)
      : [...p, { id: style.id, title: style.title, image_url: image, images: style.images || [], category: style.category, description: style.description }]);
  };

  const save = async () => { setSaving(true); await onSave("styles_tendance", picks); setSaving(false); };
  const filtered = search.trim()
    ? styles.filter(s => `${s.title || ""} ${s.category || ""}`.toLowerCase().includes(search.toLowerCase()))
    : styles;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => { load(); }} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
        <div>
          <p className="text-gray-900 text-[14px] font-black">🎨 Styles Tendance</p>
          <p className="text-gray-500 text-[11px] mt-0.5">{picks.length} style(s) sélectionné(s)</p>
        </div>
        <Palette className="w-4 h-4 text-primary" />
      </button>
      <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
        {picks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {picks.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
                {p.image_url && <img src={p.image_url} className="w-5 h-5 rounded-lg object-cover" alt="" />}
                <span className="text-[12px] font-black text-orange-800">{p.title}</span>
                <button onClick={() => toggle(p)} aria-label={`Retirer ${p.title}`}><X className="w-3 h-3 text-orange-400" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input value={search} onFocus={load} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un style..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
          {search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
        </div>
        {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : (
          <div className="max-h-56 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
            {filtered.map(style => {
              const isSelected = picks.some(x => x.id === style.id);
              const image = style.image_url || (style.images && style.images[0]) || "";
              return (
                <button key={style.id} onClick={() => toggle(style)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${isSelected ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                  {image ? <img src={image} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-200 shrink-0" />}
                  <div className="flex-1 min-w-0"><p className="text-[12px] font-black text-gray-900 truncate">{style.title}</p><p className="text-[10px] text-gray-400 truncate">{style.category || "Style"}</p></div>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}

// ── Produits Tendance Picker (depuis Boutique Produit entity) ─────────────────
function ProduitsPicker({ selected = [], onSave }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (items.length) return;
    setLoading(true);
    const [dbRes, shopifyRes] = await Promise.allSettled([
      entities.Produit.filter({ status: "actif" }, "-created_at", 200),
      fetchShopifyProducts({}).then(r =>
        (r.data?.products || []).map(p => ({
          id: p.id, name: p.name, price: p.price,
          image_url: p.img, brand: p.brand, source: "shopify",
        }))
      ),
    ]);
    const db = dbRes.status === "fulfilled" ? (dbRes.value || []) : [];
    const shopify = shopifyRes.status === "fulfilled" ? shopifyRes.value : [];
    setItems([...db, ...shopify]);
    setLoading(false);
  };

  const toggle = (item) => {
    setPicks(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, item]);
  };

  const save = async () => { setSaving(true); await onSave("produits_tendance", picks); setSaving(false); setOpen(false); };

  const allFiltered = search.trim() ? items.filter(i => (i.name + " " + (i.brand || "")).toLowerCase().includes(search.toLowerCase())) : items;
  const suggestions = search.trim() ? allFiltered.slice(0, 5) : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => { setOpen(o => !o); load(); }} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
        <div>
          <p className="text-gray-900 text-[14px] font-black">🛍 Produits Tendance</p>
          <p className="text-gray-500 text-[11px] mt-0.5">{picks.length} produit(s) sélectionné(s) depuis la boutique</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
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
          {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : (
            <div className="relative">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-1">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
                {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
              </div>
              {suggestions.length > 0 && (
                <div className="border border-primary/20 rounded-xl overflow-hidden mb-2">
                  {suggestions.map(item => (
                    <button key={item.id} onClick={() => { toggle(item); setSearch(""); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-100 last:border-0">
                      {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0" />}
                      <div className="flex-1">
                        <p className="text-[12px] font-black text-gray-900">{item.name}</p>
                        <p className="text-[10px] text-gray-400">{item.price}€ · {item.brand || ""}</p>
                      </div>
                      {picks.some(x => x.id === item.id) && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              {items.length === 0 ? (
                <p className="text-gray-400 text-center text-[12px] py-6">Aucun produit dans la boutique</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                  {allFiltered.map(item => {
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
            </div>
          )}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
          </button>
        </div>
      )}
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
  const update = (idx, field, val) => setList(l => l.map((o, i) => i === idx ? { ...o, [field]: val } : o));
  const save = async () => { setSaving(true); await onSave("offres_speciales", list); setSaving(false); };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-gray-900 text-[14px] font-black">🎁 Offres Spéciales</p>
          <p className="text-gray-500 text-[11px] mt-0.5">Salons/offres mis en avant avec bouton RÉSERVER</p>
        </div>
        <button onClick={add} className="flex items-center gap-1.5 text-primary text-[12px] font-black border border-primary/30 rounded-xl px-3 py-2 hover:bg-primary/5">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>
      <div className="px-5 py-4 space-y-4">
        {list.map((o, idx) => (
          <div key={idx} className="border border-gray-200 rounded-2xl p-4 space-y-3">
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
                {uploading === idx ? "Upload en cours..." : "Uploader une image"}
              </button>
            )}
            <input value={o.salon_name || ""} onChange={e => update(idx, "salon_name", e.target.value)} placeholder="Nom du salon / offre" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input value={o.city || ""} onChange={e => update(idx, "city", e.target.value)} placeholder="Ville (ex: Paris)" className={inputCls} />
              <input value={o.distance || ""} onChange={e => update(idx, "distance", e.target.value)} placeholder="Distance (ex: 3.8 km)" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={o.rating || ""} onChange={e => update(idx, "rating", e.target.value)} placeholder="Note (ex: 4.9)" className={inputCls} />
              <input value={o.cta_link || ""} onChange={e => update(idx, "cta_link", e.target.value)} placeholder="Lien CTA (/services-salons)" className={inputCls} />
            </div>
          </div>
        ))}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95 transition-all">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder les offres spéciales</>}
        </button>
      </div>
    </div>
  );
}

// ── Offres Immobilières Picker (multi, depuis ImmobilierListing) ───────────────
function ImmosPicker({ selected = [], onSave }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (items.length) return;
    setLoading(true);
    const res = await entities.ImmobilierListing.filter({ status: "actif" }, "-created_at", 100).catch(() => []);
    setItems(res || []);
    setLoading(false);
  };

  const toggle = (item) => {
    // Ne sauvegarder que l'ID pour garantir la sync avec la BDD
    setPicks(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, { id: item.id, title: item.title, price: item.price, location: item.location, images: item.images }]);
  };

  const save = async () => { setSaving(true); await onSave("offres_immobilier", picks); setSaving(false); setOpen(false); };

  const allFiltered = search.trim() ? items.filter(i => (i.title + " " + (i.location || "") + " " + (i.area || "")).toLowerCase().includes(search.toLowerCase())) : items;
  const suggestions = search.trim() ? allFiltered.slice(0, 5) : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => { setOpen(o => !o); load(); }} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
        <div>
          <p className="text-gray-900 text-[14px] font-black">🏠 Offres Immobilières à mettre en avant</p>
          <p className="text-gray-500 text-[11px] mt-0.5">{picks.length} offre(s) sélectionnée(s)</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
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
          {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : (
            <div className="relative">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-1">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une offre..." className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
                {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
              </div>
              {suggestions.length > 0 && (
                <div className="border border-primary/20 rounded-xl overflow-hidden mb-2">
                  {suggestions.map(item => (
                    <button key={item.id} onClick={() => { toggle(item); setSearch(""); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-100 last:border-0">
                      {item.images?.[0] && <img src={item.images[0]} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0" />}
                      <div className="flex-1">
                        <p className="text-[12px] font-black text-gray-900">{item.title}</p>
                        <p className="text-[10px] text-gray-400">{item.price}€ · {item.location || ""}</p>
                      </div>
                      {picks.some(x => x.id === item.id) && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              {items.length === 0 ? (
                <p className="text-gray-400 text-center text-[12px] py-6">Aucune offre immobilière disponible</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                  {allFiltered.map(item => {
                    const sel = picks.some(x => x.id === item.id);
                    return (
                      <button key={item.id} onClick={() => toggle(item)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-left ${sel ? "border-primary bg-orange-50" : "border-transparent bg-gray-50 hover:bg-gray-100"}`}>
                        {item.images?.[0] && <img src={item.images[0]} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />}
                        <div className="flex-1">
                          <p className="text-[12px] font-black text-gray-900">{item.title}</p>
                          <p className="text-[10px] text-gray-400">{item.price}€{item.location ? ` · ${item.location}` : ""} · {item.type}</p>
                        </div>
                        {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Item Picker Générique ─────────────────────────────────────────────────────
function ItemPicker({ sectionKey, label, desc, emoji, entityName, nameField = "name", onSave, selected = [], single = false }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [picks, setPicks] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (items.length) return;
    setLoading(true);
    const entity = entities[entityName];
    const res = entity ? await entity.list("-created_at", 100).catch(() => []) : [];
    setItems(res || []);
    setLoading(false);
  };

  const toggle = (item) => {
    if (single) { setPicks([item]); return; }
    setPicks(p => p.some(x => x.id === item.id) ? p.filter(x => x.id !== item.id) : [...p, item]);
  };

  const save = async () => { setSaving(true); await onSave(sectionKey, single ? picks[0] : picks); setSaving(false); setOpen(false); };

  const allFiltered = search.trim() ? items.filter(i => (i[nameField] || i.title || i.salon_name || "").toLowerCase().includes(search.toLowerCase())) : items;
  const suggestions = search.trim() ? allFiltered.slice(0, 5) : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => { setOpen(o => !o); load(); }} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
        <div>
          <p className="text-gray-900 text-[14px] font-black">{emoji} {label}</p>
          <p className="text-gray-500 text-[11px] mt-0.5">{picks.length > 0 ? `${picks.length} sélectionné(s)` : desc}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
          {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : (
            <div>
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-1">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Rechercher...`} className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
                {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
              </div>
              {suggestions.length > 0 && (
                <div className="border border-primary/20 rounded-xl overflow-hidden mb-2">
                  {suggestions.map(item => (
                    <button key={item.id} onClick={() => { toggle(item); setSearch(""); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-100 last:border-0">
                      {(item.image_url || item.img) && <img src={item.image_url || item.img} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0" />}
                      <div className="flex-1">
                        <p className="text-[12px] font-black text-gray-900">{item[nameField] || item.title || item.salon_name || "–"}</p>
                      </div>
                      {picks.some(x => x.id === item.id) && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                {allFiltered.length === 0 && <p className="text-gray-400 text-center text-[12px] py-4">Aucun résultat</p>}
                {allFiltered.map(item => {
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
            </div>
          )}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[12px] font-black disabled:opacity-60 active:scale-95 transition-all">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Partenaires Certifiés — Particuliers avec diplôme ────────────────────────
function PartenairesInfo() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(null);

  const load = async () => {
    if (count !== null) return;
    const res = await entities.ProfilPro.filter({ status: "actif" }, "-created_at", 200).catch(() => []);
    const pros = res || [];
    const eligible = pros.filter(p => p.type_activite === "Particulier" && p.has_diplome);
    setCount(eligible.length);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => { setOpen(o => !o); load(); }} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50">
        <div>
          <p className="text-gray-900 text-[14px] font-black">⭐ Partenaires Certifiés</p>
          <p className="text-gray-500 text-[11px] mt-0.5">Particuliers avec type d'activité "Particulier" + diplôme coché</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-700 text-[13px] font-black mb-1">Affichage automatique</p>
            <p className="text-blue-600 text-[12px] font-medium">
              Cette section affiche automatiquement les profils professionnels dont le <strong>type d'activité est "Particulier"</strong> et qui ont <strong>coché avoir un diplôme</strong> lors de leur inscription.
            </p>
            {count !== null && (
              <p className="text-blue-800 text-[13px] font-black mt-3">
                ✓ {count} partenaire{count > 1 ? "s" : ""} éligible{count > 1 ? "s" : ""} actuellement
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminHomePage() {
  const [homeData, setHomeData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getConfig("home_config")
      .then(res => { const rows = res || []; if (rows[0]?.value) setHomeData(rows[0].value); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key, data) => {
    try {
      const updated = { ...homeData, [key]: data };
      setHomeData(updated);
      const res = await adminApi.getConfig("home_config").catch(() => []);
      const rows = res || [];
      if (rows[0]?.id) {
        await adminApi.updateConfig(rows[0].id, { value: updated });
      } else {
        await adminApi.createConfig({ key: "home_config", value: updated });
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
    <div className="space-y-4 max-w-2xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-blue-700 text-[12px] font-bold">
          🏠 Personnalisez entièrement la page d'accueil. Chaque section est modifiable.
          {saved && <span className="ml-2 text-green-600 font-black animate-pulse">✓ Sauvegardé !</span>}
        </p>
      </div>

      <HeroBannersEditor banners={homeData.hero_banners || []} onSave={handleSave} />

      <StylesPicker selected={homeData.styles_tendance || []} onSave={handleSave} />

      <ServicesPicker selected={homeData.services_tendance || []} onSave={handleSave} />

      <ItemPicker sectionKey="salon_du_mois" label="Salon du Mois" desc="Sélectionnez un salon depuis les profils actifs" emoji="🏆" entityName="ProfilPro" nameField="salon_name" onSave={handleSave} selected={homeData.salon_du_mois ? [homeData.salon_du_mois] : []} single />

      <ItemPicker sectionKey="expertise_du_mois" label="Expertise du Mois" desc="Meilleur particulier / indépendant" emoji="👤" entityName="ProfilPro" nameField="salon_name" onSave={handleSave} selected={homeData.expertise_du_mois ? [homeData.expertise_du_mois] : []} single />

      <ProduitsPicker selected={homeData.produits_tendance || []} onSave={handleSave} />

      <OffresSpecialesEditor offres={homeData.offres_speciales || []} onSave={handleSave} />

      <ImmosPicker selected={Array.isArray(homeData.offres_immobilier) ? homeData.offres_immobilier : homeData.offres_immobilier ? [homeData.offres_immobilier] : []} onSave={handleSave} />

      <PartenairesInfo />
    </div>
  );
}
