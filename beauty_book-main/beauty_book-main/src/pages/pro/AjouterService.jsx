import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, X, Sparkles, Search, Zap, Save, Plus, Trash2, ChevronDown, Camera, GripVertical, ShoppingBag, Check, MessageCircleQuestion, ListChecks, Type, RotateCcw } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuth } from "@/lib/AuthContext";
import { entities, uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import PageHeader from "@/components/layout/PageHeader";
import SmartNameInput from "@/components/service/SmartNameInput";
import AIDescriptionButton from "@/components/service/AIDescriptionButton";
import { defaultQuestionsFor, saveQuestionsFallback } from "@/lib/serviceQuestions";

const TOTAL_STEPS = 4;
const CATEGORIES = ["Coiffure", "Maquillage", "Ongles", "Soin", "Massage", "Barbe", "Épilation"];
const audience = ["Femme", "Homme", "Mixte"];

// ── Searchable Select (catégorie & style) ─────────────────────────────────────
function SearchableSelect({ label, value, onChange, options, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (opt) => { onChange(opt); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <div
        className={`w-full bg-gray-50 border rounded-2xl px-4 py-3 flex items-center gap-2 cursor-pointer transition-all ${open ? "border-primary ring-1 ring-primary/20" : "border-gray-200"}`}
        onClick={() => setOpen(o => !o)}
      >
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          value={open ? query : (value || "")}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          placeholder={value || placeholder}
          className="flex-1 bg-transparent text-[14px] text-gray-700 placeholder:text-gray-400 outline-none"
        />
        {value && !open && (
          <button onClick={e => { e.stopPropagation(); onChange(""); }} className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
            <X className="w-3 h-3 text-gray-500" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {/* Chips rapides si pas ouvert */}
      {!open && (
        <div className="flex gap-2 flex-wrap mt-2">
          {options.slice(0, 5).map(opt => (
            <button key={opt} onClick={() => onChange(opt === value ? "" : opt)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all active:scale-95 ${value === opt ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200"}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(opt => (
            <button key={opt} onClick={() => select(opt)}
              className={`w-full text-left px-4 py-3 text-[14px] font-medium transition-colors flex items-center justify-between ${value === opt ? "bg-orange-50 text-primary font-black" : "text-gray-700 hover:bg-gray-50"}`}>
              {opt}
              {value === opt && <span className="text-primary text-[12px] font-black">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Style Selector (depuis la DB) ─────────────────────────────────────────────
function StyleSelector({ value, onChange }) {
  const [styles, setStyles] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Chargement initial
    entities.Style.filter({ status: "publie" }, "-created_at", 100)
      .then(items => setStyles(items.map(s => s.title).filter(Boolean)))
      .catch(() => {});

    // Souscription temps réel pour les nouveaux styles
    const unsubscribe = entities.Style.subscribe((event) => {
      if (event.type === "create" && event.data?.title && event.data?.status === "publie") {
        setStyles(prev => {
          if (prev.includes(event.data.title)) return prev;
          return [event.data.title, ...prev];
        });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = styles.filter(s => s.toLowerCase().includes(query.toLowerCase()));
  const select = (opt) => { onChange(opt === value ? "" : opt); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <div
        className={`w-full bg-gray-50 border rounded-2xl px-4 py-3 flex items-center gap-2 cursor-pointer transition-all ${open ? "border-primary ring-1 ring-primary/20" : "border-gray-200"}`}
        onClick={() => setOpen(o => !o)}
      >
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          value={open ? query : (value || "")}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          placeholder={value || "Rechercher ou sélectionner un style..."}
          className="flex-1 bg-transparent text-[14px] text-gray-700 placeholder:text-gray-400 outline-none"
        />
        {value && !open && (
          <button onClick={e => { e.stopPropagation(); onChange(""); }} className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
            <X className="w-3 h-3 text-gray-500" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {/* Chips rapides */}
      {!open && styles.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {styles.slice(0, 4).map(s => (
            <button key={s} onClick={() => onChange(s === value ? "" : s)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all active:scale-95 max-w-[120px] truncate ${value === s ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 font-medium py-6">Aucun style trouvé</p>
          ) : filtered.map(s => (
            <button key={s} onClick={() => select(s)}
              className={`w-full text-left px-4 py-3 text-[14px] font-medium transition-colors flex items-center justify-between ${value === s ? "bg-orange-50 text-primary font-black" : "text-gray-700 hover:bg-gray-50"}`}>
              {s}
              {value === s && <span className="text-primary text-[12px] font-black">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 1: Infos générales ───────────────────────────────────────────────────
function Step1({ data, setData }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-black text-gray-900 leading-tight">Informations<br />générales</h1>
        <p className="text-[14px] text-gray-400 font-medium mt-1">Définissez les informations principales de votre prestation.</p>
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Nom de la Prestation *</p>
        <SmartNameInput
          value={data.name || ""}
          onChange={val => setData(d => ({ ...d, name: val }))}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Description *</p>
          <AIDescriptionButton
            serviceName={data.name || ""}
            category={data.category || ""}
            onDescription={desc => setData(d => ({ ...d, description: desc }))}
          />
        </div>
        <textarea
          placeholder="Décrivez votre expertise et le déroulement de la séance..."
          value={data.description || ""}
          onChange={e => setData(d => ({ ...d, description: e.target.value }))}
          rows={4}
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-[14px] text-gray-700 placeholder:text-gray-300 outline-none resize-none"
        />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Catégorie *</p>
        <SearchableSelect
          value={data.category || ""}
          onChange={val => setData(d => ({ ...d, category: val }))}
          options={CATEGORIES}
          placeholder="Rechercher ou sélectionner une catégorie..."
        />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Style associé</p>
        <StyleSelector
          value={data.style || ""}
          onChange={val => setData(d => ({ ...d, style: val }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Prix TTC (€) *</p>
          <input
            type="number"
            value={data.price ?? ""}
            onChange={e => setData(d => ({ ...d, price: e.target.value }))}
            placeholder="0.00"
            className="w-full text-[24px] font-black text-gray-900 outline-none bg-transparent"
          />
          {data.price && Number(data.price) > 0 && (
            <div className="mt-1 space-y-0.5">
              <p className="text-[10px] text-gray-400 font-medium">HT : {(Number(data.price) / 1.2).toFixed(2)}€</p>
              <p className="text-[10px] text-primary font-bold">TVA (20%) : {(Number(data.price) - Number(data.price) / 1.2).toFixed(2)}€</p>
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Durée (min)</p>
          <input
            type="number"
            value={data.duration_min ?? ""}
            onChange={e => setData(d => ({ ...d, duration_min: e.target.value }))}
            placeholder="60"
            className="w-full text-[24px] font-black text-gray-900 outline-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}



// ── Step 2: Médias (images + vidéos) avec slider swipeable ────────────────────
function MediaSliderPreview({ media, onRemove }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);

  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") || url.includes("video"));

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 30) {
      if (diff > 0) setCurrent(c => Math.min(c + 1, media.length - 1));
      else setCurrent(c => Math.max(c - 1, 0));
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    if (current >= media.length && media.length > 0) setCurrent(media.length - 1);
  }, [media.length]);

  if (media.length === 0) return null;

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-gray-900" style={{ height: 260 }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {media.map((url, i) => (
        <div key={i} className="absolute inset-0 transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(${(i - current) * 100}%)` }}>
          {isVideo(url)
            ? <video src={url} muted loop playsInline autoPlay={i === current} className="w-full h-full object-cover" />
            : <BeautyImage src={url} alt="" className="w-full h-full object-cover" />
          }
          {isVideo(url) && (
            <div className="absolute top-3 left-3 bg-black/60 rounded-full px-2.5 py-1">
              <span className="text-white text-[10px] font-black">▶ VID</span>
            </div>
          )}
        </div>
      ))}
      {/* Supprimer l'item actuel */}
      <button onClick={() => { onRemove(current); }}
        className="absolute top-3 right-3 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow z-10 active:scale-95">
        <Trash2 className="w-4 h-4 text-white" />
      </button>
      {/* Dots */}
      {media.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {media.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${i === current ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}
      {/* Compteur */}
      <div className="absolute bottom-3 right-3 bg-black/50 rounded-full px-2.5 py-1 z-10">
        <span className="text-white text-[11px] font-black">{current + 1} / {media.length}</span>
      </div>
    </div>
  );
}

function Step2({ data, setData }) {
  const mediaInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleMediaChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await uploadFile({ file });
      urls.push(file_url);
    }
    setData(d => ({ ...d, images: [...(d.images || []), ...urls].slice(0, 10) }));
    setUploading(false);
    e.target.value = "";
  };

  const removeMedia = (idx) => setData(d => ({ ...d, images: (d.images || []).filter((_, i) => i !== idx) }));

  const reorderMedia = (from, to) => {
    setData(d => {
      const imgs = [...(d.images || [])];
      const [moved] = imgs.splice(from, 1);
      imgs.splice(to, 0, moved);
      return { ...d, images: imgs };
    });
  };

  const media = data.images || [];
  const isVideo = (url) => url && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") || url.includes("video"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-black text-gray-900 leading-tight">Photos & Vidéos<br />du Service</h1>
        <p className="text-[14px] text-gray-400 font-medium mt-1">Importez jusqu'à 10 photos ou vidéos. Glissez pour réorganiser.</p>
      </div>

      {/* Slider preview */}
      {media.length > 0 && (
        <MediaSliderPreview media={media} onRemove={removeMedia} />
      )}

      {/* Miniatures avec drag-and-drop */}
      {media.length > 0 && (
        <DragDropContext onDragEnd={(result) => {
          if (!result.destination) return;
          reorderMedia(result.source.index, result.destination.index);
        }}>
          <Droppable droppableId="step2-media" direction="horizontal">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {media.map((url, i) => (
                  <Draggable key={`media-${i}`} draggableId={`media-${i}`} index={i}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 bg-gray-100 ${snapshot.isDragging ? "border-primary opacity-80 z-50 shadow-lg" : "border-gray-100"}`}
                      >
                        {isVideo(url)
                          ? <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <Camera className="w-5 h-5 text-gray-400" />
                            </div>
                          : <BeautyImage src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                        }
                        {/* Drag handle */}
                        <div {...provided.dragHandleProps} className="absolute bottom-0 left-0 right-0 bg-black/50 flex items-center justify-center py-0.5 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-3 h-3 text-white/60" />
                        </div>
                        <button onClick={() => removeMedia(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center active:scale-95">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Bouton ajouter */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Médias</p>
        <span className="text-[10px] font-black text-primary">{media.length}/10</span>
      </div>
      {media.length < 10 && (
        <button onClick={() => mediaInputRef.current?.click()} disabled={uploading}
          className="w-full py-5 bg-gray-50 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all hover:border-primary/40 hover:bg-orange-50">
          {uploading
            ? <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            : <>
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-[12px] font-black text-gray-500 uppercase tracking-widest">Ajouter photos ou vidéos</span>
              </>
          }
        </button>
      )}
      <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaChange} />
    </div>
  );
}

// ── Step 3: Options & Suppléments ──────────────────────────────────────────────
function Step3({ data, setData }) {
  const { user } = useAuth();
  const [produits, setProduits] = useState([]);
  const [loadingProduits, setLoadingProduits] = useState(true);
  const [catalogue, setCatalogue] = useState([]);
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [savingToCatalog, setSavingToCatalog] = useState(null);

  useEffect(() => {
    if (!data.style) {
      setProduits([]);
      setLoadingProduits(false);
      return;
    }
    entities.Style.filter({ title: data.style }, "-created_at", 1)
      .then(styles => {
        setProduits(styles[0]?.produits_utilises?.length > 0 ? styles[0].produits_utilises : []);
      })
      .catch(() => setProduits([]))
      .finally(() => setLoadingProduits(false));
  }, [data.style]);

  useEffect(() => {
    entities.CatalogueOption.filter({}, "-usage_count", 50)
      .then(items => setCatalogue(items))
      .catch(() => setCatalogue([]))
      .finally(() => setLoadingCatalogue(false));
  }, []);

  const addAddon = () => setData(d => ({ ...d, addons: [...(d.addons || []), { name: "", price: "" }] }));

  const updateAddon = (i, field, val) => setData(d => {
    const addons = [...(d.addons || [])];
    addons[i] = { ...addons[i], [field]: val };
    return { ...d, addons };
  });

  const removeAddon = (i) => setData(d => ({ ...d, addons: (d.addons || []).filter((_, idx) => idx !== i) }));

  // Sauvegarder une option dans le catalogue
  const saveToCatalog = async (addon, idx) => {
    if (!addon.name?.trim()) return;
    setSavingToCatalog(idx);
    const existing = catalogue.find(c => c.name?.toLowerCase() === addon.name.trim().toLowerCase());
    if (existing) {
      await entities.CatalogueOption.update(existing.id, { usage_count: (existing.usage_count || 1) + 1 });
      setCatalogue(prev => prev.map(c => c.id === existing.id ? { ...c, usage_count: (c.usage_count || 1) + 1 } : c));
    } else {
      const created = await entities.CatalogueOption.create({
        name: addon.name.trim(),
        price: parseFloat(addon.price) || 0,
        category: data.category || "",
        pro_email: user?.email || "",
        usage_count: 1,
      });
      setCatalogue(prev => [created, ...prev]);
    }
    setSavingToCatalog(null);
  };

  // Ajouter une option depuis le catalogue
  const addFromCatalogue = (catItem) => {
    const alreadyExists = (data.addons || []).some(a => a.name?.toLowerCase() === catItem.name.toLowerCase());
    if (alreadyExists) return;
    setData(d => ({ ...d, addons: [...(d.addons || []), { name: catItem.name, price: String(catItem.price || "") }] }));
  };

  const filteredCatalogue = catalogueSearch.trim()
    ? catalogue.filter(c => c.name?.toLowerCase().includes(catalogueSearch.toLowerCase()))
    : catalogue;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-black text-gray-900 leading-tight">Services<br />Supplémentaires</h1>
        <p className="text-[14px] text-gray-400 font-medium mt-1">Ajoutez des options payantes à votre prestation.</p>
      </div>

      {/* Options saisies */}
      <div className="space-y-3">
        {(data.addons || []).map((addon, i) => (
          <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200">
            <input
              value={addon.name}
              onChange={e => updateAddon(i, "name", e.target.value)}
              placeholder="Nom de l'option"
              className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none"
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                value={addon.price}
                onChange={e => updateAddon(i, "price", e.target.value)}
                placeholder="0€"
                className="w-16 bg-transparent text-[14px] font-black text-primary text-right outline-none"
              />
              <span className="text-[13px] font-black text-primary">€</span>
            </div>
            {addon.name?.trim() && (
              <button onClick={() => saveToCatalog(addon, i)} disabled={savingToCatalog === i}
                className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center active:scale-95"
                title="Enregistrer dans le catalogue">
                {savingToCatalog === i
                  ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  : <Save className="w-3.5 h-3.5 text-primary" />
                }
              </button>
            )}
            <button onClick={() => removeAddon(i)} className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center active:scale-95">
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        ))}
        <button onClick={addAddon}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-[12px] font-black text-gray-400 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter une option
        </button>
      </div>

      {/* Catalogue partagé */}
      {!loadingCatalogue && catalogue.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Catalogue d'options</p>
            <span className="text-[10px] font-black text-gray-400">{catalogue.length} option(s)</span>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
            {/* Barre de recherche */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                value={catalogueSearch}
                onChange={e => setCatalogueSearch(e.target.value)}
                placeholder="Rechercher une option dans le catalogue..."
                className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
              />
              {catalogueSearch && (
                <button onClick={() => setCatalogueSearch("")} className="shrink-0">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
            {/* Liste */}
            {filteredCatalogue.length === 0 ? (
              <p className="text-center text-[13px] text-gray-400 py-2">Aucune option trouvée.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredCatalogue.map((cat, i) => {
                  const alreadyAdded = (data.addons || []).some(a => a.name?.toLowerCase() === cat.name.toLowerCase());
                  return (
                    <button
                      key={cat.id || i}
                      onClick={() => !alreadyAdded && addFromCatalogue(cat)}
                      disabled={alreadyAdded}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${alreadyAdded ? "bg-gray-100 border-gray-100 opacity-50 cursor-default" : "bg-white border-gray-100 hover:border-primary/30 active:scale-[0.99]"}`}
                    >
                      <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-900 truncate">{cat.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{cat.usage_count || 0} utilisation(s){cat.category ? ` · ${cat.category}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cat.price > 0 && <span className="text-[14px] font-black text-primary">{cat.price}€</span>}
                        {alreadyAdded
                          ? <Check className="w-4 h-4 text-green-400" />
                          : <Plus className="w-4 h-4 text-primary" />
                        }
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Produits utilisés — filtrés par le style sélectionné à l'étape 1 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Produits utilisés</p>
          {data.style && <span className="bg-orange-50 text-primary text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{data.style}</span>}
        </div>
        <p className="text-[12px] text-gray-400 font-medium mb-3 leading-snug">
          {data.style
            ? `Produits associés au style "${data.style}". Gérez-les depuis la fiche du style.`
            : "Sélectionnez un style à l'étape 1 pour voir les produits associés."}
        </p>
        {loadingProduits ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : produits.length === 0 ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
            <p className="text-[13px] text-gray-400 font-medium">
              {data.style ? "Aucun produit associé à ce style." : "Aucun style sélectionné."}
            </p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5 pb-1">
            {produits.map((prod, i) => (
              <div key={prod.id || i} className="shrink-0 w-36 bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
                <div className="h-24 bg-gray-100">
                  {prod.image_url
                    ? <BeautyImage src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[28px]">🧴</div>
                  }
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-black text-gray-700 leading-tight truncate">{prod.name}</p>
                  {prod.brand && <p className="text-[10px] text-gray-400 font-medium truncate">{prod.brand}</p>}
                  {prod.price > 0 && <p className="text-[12px] font-black text-primary mt-1">{prod.price}€</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
        <p className="text-[11px] font-black text-primary uppercase tracking-widest mb-1">Validation manuelle</p>
        <p className="text-[13px] text-gray-600 font-medium leading-snug">Vous pourrez valider et publier ce service depuis votre catalogue après enregistrement.</p>
      </div>
    </div>
  );
}

// ── Step 4: Questions du parcours de réservation ────────────────────────────
// Par défaut : les questions de la catégorie du service (même source que le
// parcours de réservation). Le pro peut modifier, supprimer, ajouter des
// questions QCM ou ouvertes.
function Step4Questions({ data, setData }) {
  // Initialisation depuis la catégorie (une seule fois, si aucune question)
  useEffect(() => {
    if (!data.questions || data.questions.length === 0) {
      setData(d => ({
        ...d,
        questions: defaultQuestionsFor({ category: d.category, name: d.name, title: d.name }),
        _qcat: d.category || "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questions = data.questions || [];
  const catChanged = (data._qcat || "") !== (data.category || "");

  const updateQ = (idx, patch) => {
    setData(d => ({
      ...d,
      questions: (d.questions || []).map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
  };
  const removeQ = (idx) => {
    setData(d => ({ ...d, questions: (d.questions || []).filter((_, i) => i !== idx) }));
  };
  const addQuestion = () => {
    setData(d => ({
      ...d,
      questions: [...(d.questions || []), { id: `q_${Date.now()}`, question: "", type: "qcm", options: ["", ""] }],
    }));
  };
  const updateOption = (qIdx, oIdx, val) => {
    const q = questions[qIdx];
    const options = [...(q.options || [])];
    options[oIdx] = val;
    updateQ(qIdx, { options });
  };
  const addOption = (qIdx) => {
    const q = questions[qIdx];
    updateQ(qIdx, { options: [...(q.options || []), ""] });
  };
  const removeOption = (qIdx, oIdx) => {
    const q = questions[qIdx];
    updateQ(qIdx, { options: (q.options || []).filter((_, i) => i !== oIdx) });
  };
  const setType = (qIdx, type) => {
    const q = questions[qIdx];
    updateQ(qIdx, {
      type,
      options: type === "qcm" && (!q.options || q.options.length === 0) ? ["", ""] : (q.options || []),
    });
  };
  const regenerate = () => {
    if (questions.length > 0 && !window.confirm("Remplacer les questions actuelles par celles par défaut de la catégorie « " + (data.category || "—") + " » ?")) return;
    setData(d => ({
      ...d,
      questions: defaultQuestionsFor({ category: d.category, name: d.name, title: d.name }),
      _qcat: d.category || "",
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Questions de réservation</p>
        <p className="text-[13px] text-gray-500 font-medium leading-snug">
          Ces questions seront posées au client à l'étape 2 de sa réservation.
          Par défaut, celles de la catégorie <span className="font-black text-gray-700">{data.category || "—"}</span> sont
          proposées : modifiez-les, supprimez-en ou ajoutez les vôtres.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircleQuestion className="w-5 h-5 text-primary shrink-0" />
          <p className="text-[13px] font-black text-gray-800">{questions.length} question{questions.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={regenerate}
          className="flex items-center gap-1.5 bg-white border border-orange-200 text-primary text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-xl active:scale-95 transition-all shrink-0">
          <RotateCcw className="w-3.5 h-3.5" /> Défaut catégorie
        </button>
      </div>

      {catChanged && questions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-[12px] text-amber-800 font-medium leading-snug">
            La catégorie a changé depuis la génération des questions. Touchez « Défaut catégorie » pour les régénérer.
          </p>
        </div>
      )}

      {questions.map((q, qIdx) => (
        <div key={q.id || qIdx} className="bg-white border border-gray-200 rounded-3xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-orange-100 text-primary text-[12px] font-black flex items-center justify-center shrink-0">
              {qIdx + 1}
            </span>
            <div className="flex bg-gray-100 rounded-xl p-0.5 shrink-0">
              <button onClick={() => setType(qIdx, "qcm")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${q.type !== "ouverte" ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>
                <ListChecks className="w-3.5 h-3.5" /> QCM
              </button>
              <button onClick={() => setType(qIdx, "ouverte")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${q.type === "ouverte" ? "bg-white shadow text-gray-900" : "text-gray-400"}`}>
                <Type className="w-3.5 h-3.5" /> Ouverte
              </button>
            </div>
            <button onClick={() => removeQ(qIdx)}
              className="ml-auto w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 active:scale-95 transition-all shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <input
            value={q.question || ""}
            onChange={e => updateQ(qIdx, { question: e.target.value })}
            placeholder="Votre question…"
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[14px] font-bold text-gray-900 outline-none focus:border-primary placeholder:text-gray-300 placeholder:font-medium"
          />

          {q.type !== "ouverte" ? (
            <div className="space-y-2 pl-1">
              {(q.options || []).map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/60 shrink-0 ml-1" />
                  <input
                    value={opt}
                    onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                    placeholder={`Option ${oIdx + 1}…`}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-800 outline-none focus:border-primary placeholder:text-gray-300"
                  />
                  <button onClick={() => removeOption(qIdx, oIdx)}
                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 active:scale-95 transition-all shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addOption(qIdx)}
                className="flex items-center gap-1.5 text-primary text-[12px] font-black uppercase tracking-widest px-2 py-2 active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Ajouter une option
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl px-4 py-3">
              <p className="text-[12px] text-gray-400 font-medium italic">Le client répondra librement à cette question.</p>
            </div>
          )}
        </div>
      ))}

      <button onClick={addQuestion}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-3xl py-4 text-gray-500 font-black text-[13px] uppercase tracking-widest active:scale-[0.98] transition-all">
        <Plus className="w-5 h-5" /> Ajouter une question
      </button>

      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
        <p className="text-[12px] text-gray-500 font-medium leading-snug">
          Les questions sont facultatives pour le client : il peut passer l'étape sans répondre.
        </p>
      </div>
    </div>
  );
}

// ── Sauvegarde robuste du service ───────────────────────────────────────────
// Si la colonne `questions` n'existe pas encore (migration non appliquée),
// on réessaie sans la colonne et on stocke les questions en local.
const isQuestionsColumnError = (e) => {
  const msg = String(e?.message || "");
  return /questions/i.test(msg) && /column|does not exist|schema cache/i.test(msg);
};

async function saveServiceRow(editId, payload) {
  const qs = Array.isArray(payload.questions) ? payload.questions : [];
  const stripQuestions = (p) => {
    const { questions, ...rest } = p;
    return rest;
  };
  const doSave = async (p, id) => {
    if (id) {
      const { data, error } = await supabase.from("Service").update(p).eq("id", id).select().single();
      if (error) throw error;
      return data;
    }
    return await entities.Service.create(p);
  };
  try {
    return await doSave(qs.length > 0 ? payload : stripQuestions(payload), editId);
  } catch (e) {
    if (qs.length > 0 && isQuestionsColumnError(e)) {
      const row = await doSave(stripQuestions(payload), editId);
      saveQuestionsFallback(editId || row?.id, qs);
      return row;
    }
    throw e;
  }
}

export default function AjouterService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state } = useLocation();
  const editService = state?.editService;
  const [step, setStep] = useState(1);
  const [data, setData] = useState(() => {
    if (editService) {
      const mediaList = [];
      if (editService.image_url) mediaList.push(editService.image_url);
      if (editService.images?.length > 0) {
        editService.images.forEach(u => { if (u && u !== editService.image_url) mediaList.push(u); });
      }
      return {
        name: editService.title || "",
        description: editService.description || "",
        category: editService.category || "",
        style: editService.style || "",
        price: editService.price ?? "",
        duration_min: editService.duration_min ?? "",
        images: mediaList,
        addons: editService.addons || [],
        questions: Array.isArray(editService.questions) ? editService.questions : [],
        status: editService.status || "brouillon",
        _editId: editService.id,
      };
    }
    try {
      const saved = localStorage.getItem("bb_service_draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Date.now() - (parsed._ts || 0) < 86400000) {
          return parsed;
        }
      }
    } catch {}
    return {};
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    if (!data.name && !data.description && !data.category) return;
    const timer = setTimeout(async () => {
      const dur = parseInt(data.duration_min || data.duration) || 60;
      const payload = {
        pro_email: user.email,
        name: data.name || "",
        title: data.name || "",
        description: data.description || "",
        category: data.category || "",
        style: data.style || null,
        price: parseFloat(data.price) || 0,
        duration: dur,
        duration_min: dur,
        images: (data.images || []),
        addons: (data.addons || []).map(a => ({ name: a.name, price: parseFloat(a.price) || 0 })),
        questions: (data.questions || []).map(q => ({
          id: q.id,
          question: q.question || "",
          type: q.type === "ouverte" ? "ouverte" : "qcm",
          options: (q.options || []).filter(o => String(o || "").trim()),
        })),
        status: data._editId ? (data.status || "brouillon") : "brouillon",
      };
      try {
        const row = await saveServiceRow(data._editId, payload);
        const newId = data._editId || row?.id;
        if (newId && !data._editId) {
          setData(d => ({ ...d, _editId: newId }));
          localStorage.setItem("bb_service_draft", JSON.stringify({ ...data, _editId: newId, _ts: Date.now() }));
        } else {
          localStorage.setItem("bb_service_draft", JSON.stringify({ ...data, _ts: Date.now() }));
        }
      } catch (e) { console.error("Auto-save error:", e); }
    }, 3000);
    return () => clearTimeout(timer);
  }, [data, editService, user?.email]);

  const goBack = () => {
    if (step > 1) setStep(s => s - 1);
    else navigate(-1);
  };

  const canNext = () => {
    if (step === 1) return data.name?.trim() && data.category && data.price;
    return true;
  };

  const handleFinish = async (asDraft = false) => {
    setSaving(true);
    try {
      const dur = parseInt(data.duration_min || data.duration) || 60;
      const payload = {
        pro_email: user?.email || "",
        name: data.name,
        title: data.name,
        description: data.description || "",
        category: data.category,
        style: data.style || null,
        price: parseFloat(data.price) || 0,
        duration: dur,
        duration_min: dur,
        images: (data.images || []),
        addons: (data.addons || []).map(a => ({ name: a.name, price: parseFloat(a.price) || 0 })),
        questions: (data.questions || []).map(q => ({
          id: q.id,
          question: q.question || "",
          type: q.type === "ouverte" ? "ouverte" : "qcm",
          options: (q.options || []).filter(o => String(o || "").trim()),
        })),
        status: asDraft ? "brouillon" : "actif",
      };
      await saveServiceRow(data._editId, payload);
      localStorage.removeItem("bb_service_draft");
      navigate("/pro/catalogue-services");
    } catch (err) {
      alert("Erreur lors de l'enregistrement : " + (err.message || "Erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="font-display min-h-full bg-white flex flex-col">
      {/* Header */}
      <PageHeader
        title="Ajouter Service"
        subtitle={`Étape ${step} sur ${TOTAL_STEPS}`}
        dark={false}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-56">
        {step === 1 && <Step1 data={data} setData={setData} />}
        {step === 2 && <Step2 data={data} setData={setData} />}
        {step === 3 && <Step3 data={data} setData={setData} />}
        {step === 4 && <Step4Questions data={data} setData={setData} />}
      </div>

      {/* Bottom CTAs */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-6 pt-4 bg-white border-t border-gray-100 space-y-3">
        {step === TOTAL_STEPS && (
          <button
            onClick={() => handleFinish(true)}
            className="w-full py-4 rounded-3xl border-2 border-gray-200 text-gray-700 font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            Sauvegarder Brouillon <Save className="w-4 h-4" />
          </button>
        )}
        <button
          disabled={!canNext() || saving}
          onClick={() => step < TOTAL_STEPS ? setStep(s => s + 1) : handleFinish()}
          className="w-full bg-primary text-white font-black text-[15px] uppercase tracking-widest py-5 rounded-3xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-primary/30"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : step === TOTAL_STEPS
              ? <><span>Enregistrer & Valider</span><Zap className="w-5 h-5" /></>
              : <span>Continuer →</span>
          }
        </button>
      </div>
    </div>
  );
}