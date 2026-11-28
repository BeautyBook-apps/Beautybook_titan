import BeautyImage from '@/components/ui/BeautyImage';
import ImageJobHistory from '@/components/maria/ImageJobHistory';
import PhotoAnalysis from '@/components/maria/PhotoAnalysis';
import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useRef, useEffect, Component } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Wand2, Camera, Download,
  Sun, Contrast, Droplets, RefreshCw, X, Heart, Search,
  ShoppingCart, Check, Sparkles, Shirt, Repeat2, Clock,
  FlipHorizontal, RotateCw
} from "lucide-react";
import { entities } from '@/api/entities';
import { useTemporaryImages } from '@/hooks/useTemporaryImages';
import { prepareStylistImages } from '@/lib/stylistImages';
import { apiClient } from '@/lib/apiClient';
import { useLikedProducts } from "@/hooks/useLikedProducts";
import { useCartSync } from "@/hooks/useCartSync";
import { useTheme } from "@/hooks/useTheme";

function imageUrl(value) {
  return typeof value === "string" ? value : value?.url || value?.src || value?.image_url || "";
}

function productReferenceImages(product) {
  return [...new Set([
    product?.img,
    product?.image_url,
    ...(Array.isArray(product?.images) ? product.images : []),
  ].map(imageUrl).filter(Boolean))].slice(0, 8);
}

const OUTFIT_SLOTS = {
  top: { label: "Haut", emoji: "👕", category: "Vêtements", terms: ["haut", "t-shirt", "tshirt", "chemise", "blouse", "pull", "polo", "débardeur", "top", "crop"] },
  bottom: { label: "Bas", emoji: "👖", category: "Vêtements", terms: ["pantalon", "jean", "jupe", "short", "legging", "bermuda", "bas"] },
  jacket: { label: "Veste", emoji: "🧥", category: "Vêtements", terms: ["veste", "manteau", "blazer", "gilet", "cardigan", "jacket", "coat"] },
  shoes: { label: "Chaussures", emoji: "👟", category: "Chaussures", terms: ["chauss", "basket", "sneaker", "botte", "sandale", "escarpin", "mocassin"] },
  bag: { label: "Sac", emoji: "👜", category: "Sacs & accessoires", terms: ["sac", "bag", "pochette", "cartable", "accessoire"] },
};

function normalizeCatalogText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function productsForOutfitSlot(products, slot) {
  const config = OUTFIT_SLOTS[slot];
  if (!config) return [];
  const categoryTerms = slot === "shoes" ? ["chauss", "footwear"]
    : slot === "bag" ? ["sac", "bag", "accessoire"]
      : ["vetement", "clothing", "mode", "habillement"];
  const termMatches = product => {
    const details = normalizeCatalogText([
      product.name, product.category, product.sub_category, product.productType,
      ...(Array.isArray(product.tags) ? product.tags : []),
    ].join(" "));
    return config.terms.some(term => details.includes(normalizeCatalogText(term)));
  };
  const categoryMatches = product => {
    const category = normalizeCatalogText(`${product.category || ""} ${product.sub_category || ""} ${product.productType || ""}`);
    return categoryTerms.some(term => category.includes(normalizeCatalogText(term)));
  };
  const specificMatches = products.filter(termMatches);
  if (specificMatches.length) return specificMatches;
  const categoryMatchesForSlot = products.filter(categoryMatches);
  if (categoryMatchesForSlot.length) return categoryMatchesForSlot;
  // Some shop listings are tagged only as Homme/Femme. Use that broad Boutique
  // category as a final fallback for clothing, while excluding bags and shoes.
  if (slot !== "shoes" && slot !== "bag") return products.filter(product => {
    const details = normalizeCatalogText([
      product.name, product.category, product.sub_category, product.productType,
      ...(Array.isArray(product.tags) ? product.tags : []),
    ].join(" "));
    const broadClothingCategory = ["homme", "femme", "vetement", "mode", "habillement"].some(term => details.includes(term));
    const anotherSlot = OUTFIT_SLOTS.shoes.terms.some(term => details.includes(normalizeCatalogText(term)))
      || OUTFIT_SLOTS.bag.terms.some(term => details.includes(normalizeCatalogText(term)));
    return broadClothingCategory && !anotherSlot;
  });
  return [];
}


// ─────────────────────────────────────────────────────────────────────────────
// LOADING OVERLAY — smooth progress that never appears stuck
// ─────────────────────────────────────────────────────────────────────────────


function LoadingOverlay({ onCancel, status = 'preparing', mode = 'article' }) {
  const steps = ['Préparation', 'En attente', mode === 'exchange' ? 'Transfert de tenue' : mode === 'tenue' ? 'Création du look' : 'Essayage', 'Résultat'];
  const active = status === 'processing' ? 2 : status === 'queued' ? 1 : 0;
  return <div role="status" aria-live="polite" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-center">
    <Sparkles className="h-9 w-9 text-orange-300 animate-pulse motion-reduce:animate-none" />
    <p className="text-orange-200 text-[10px] font-bold tracking-widest mt-3">BEAUTYBOOK IA</p>
    <p className="text-white font-bold mt-2">Votre style prend vie</p>
    <div className="w-full mt-5 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label={steps[active]} aria-valuetext="Traitement en cours">
      <div className="w-1/3 h-full rounded-full bg-orange-400 animate-pulse motion-reduce:animate-none" />
    </div>
    <ol className="grid grid-cols-4 gap-1 w-full mt-4">{steps.map((label, index) => <li key={label} className={index <= active ? 'text-white' : 'text-white/50'}><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border ${index === active ? 'bg-orange-500 border-orange-300' : 'bg-white/10 border-white/20'}`}>{index < active ? <Check className="h-4 w-4" /> : index + 1}</span><span className="block mt-2 text-[10px] leading-tight">{label}</span></li>)}</ol>
    <p className="text-white/75 text-xs mt-5">{status === 'queued' ? 'Votre demande attend son tour.' : status === 'processing' ? 'La génération est en cours. Le résultat sera enregistré dans votre historique.' : 'Préparation de vos images…'}</p>
    <button onClick={onCancel} className="mt-4 min-h-11 px-4 text-white underline text-xs">Fermer le suivi</button>
  </div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIQUE ESSAYAGES
// ─────────────────────────────────────────────────────────────────────────────




function HistoryPanel(props){return <ImageJobHistory {...props}/>;}

// ─────────────────────────────────────────────────────────────────────────────
// RETOUCHE COMPLÈTE — synchronisée en temps réel
// ─────────────────────────────────────────────────────────────────────────────
function RetouchePanel({ imageUrl, onRestart }) {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("jpg");
  const [downloading, setDownloading] = useState(false);
  const [activeSection, setActiveSection] = useState("adjust");

  // Les styles CSS sont appliqués directement et en temps réel sur l'image
  const filterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
    transition: "filter 0.05s, transform 0.15s",
  };

  const reset = () => {
    setBrightness(100); setContrast(100); setSaturation(100);
    setRotation(0); setFlipH(false);
  };

  const handleDownload = () => {
    setDownloading(true);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Si rotation 90/270 on inverse largeur/hauteur
      const rad = (rotation * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      canvas.width = Math.round(img.width * absCos + img.height * absSin);
      canvas.height = Math.round(img.width * absSin + img.height * absCos);
      const ctx = canvas.getContext("2d");
      // Fond transparent → conserve l'arrière-plan original de l'image
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      if (flipH) ctx.scale(-1, 1);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      const mime = downloadFormat === "png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, 0.92);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `styliste-ia-${Date.now()}.${downloadFormat}`;
      a.click();
      setDownloading(false);
    };
    img.onerror = () => { window.open(imageUrl, "_blank"); setDownloading(false); };
    img.src = imageUrl;
  };

  const SECTIONS = [
    { id: "adjust", label: "Réglages", icon: Sun },
    { id: "transform", label: "Transformer", icon: RotateCw },
  ];

  return (
    <div className="space-y-3">
      {/* Image résultat — les retouches s'appliquent instantanément */}
      <div className="relative rounded-3xl overflow-hidden aspect-[3/4] shadow-xl bg-gray-100">
        <BeautyImage
          src={imageUrl}
          alt="Résultat"
          className="w-full h-full object-cover"
          style={filterStyle}
          crossOrigin="anonymous"
        />
        <div className="absolute top-3 left-3">
          <span className="bg-primary text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md shadow-primary/40">
            <Sparkles className="w-3 h-3" /> Styliste IA
          </span>
        </div>
      </div>

      {/* Section tabs */}
      <div className="bg-gray-100 rounded-2xl p-1 flex gap-1">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveSection(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition-all ${activeSection === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Outils — chaque changement met à jour l'image immédiatement */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
        {activeSection === "adjust" && (
          <>
            {[
              { label: "Luminosité", Icon: Sun, value: brightness, set: setBrightness, min: 50, max: 200 },
              { label: "Contraste", Icon: Contrast, value: contrast, set: setContrast, min: 50, max: 200 },
              { label: "Saturation", Icon: Droplets, value: saturation, set: setSaturation, min: 0, max: 300 },
            ].map(({ label, Icon, value, set, min, max }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider">{label}</span>
                  </div>
                  <span className="text-[12px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{value}%</span>
                </div>
                <input type="range" min={min} max={max} value={value}
                  onChange={e => set(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none bg-gray-200"
                  style={{ accentColor: "#E8732A" }} />
              </div>
            ))}
          </>
        )}

        {activeSection === "transform" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider">Rotation</span>
                <span className="text-[12px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{rotation}°</span>
              </div>
              <input type="range" min={-180} max={180} value={rotation}
                onChange={e => setRotation(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none bg-gray-200"
                style={{ accentColor: "#E8732A" }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFlipH(f => !f)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border text-[12px] font-black transition-all active:scale-95 ${flipH ? "bg-primary text-white border-primary" : "bg-white text-gray-700 border-gray-200"}`}>
                <FlipHorizontal className="w-4 h-4" /> Miroir
              </button>
              <button onClick={() => setRotation(r => (r + 90) % 360)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 bg-white text-gray-700 text-[12px] font-black active:scale-95 transition-all">
                <RotateCw className="w-4 h-4" /> +90°
              </button>
            </div>
          </div>
        )}

        <button onClick={reset} className="w-full py-2 text-[11px] font-black text-gray-400 uppercase tracking-widest">↺ Réinitialiser</button>
      </div>

      {/* Téléchargement */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Format de téléchargement</p>
        <div className="flex gap-2">
          {["jpg", "png"].map(fmt => (
            <button key={fmt} onClick={() => setDownloadFormat(fmt)}
              className={`flex-1 py-2.5 rounded-xl border-2 text-[13px] font-black uppercase transition-all ${downloadFormat === fmt ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500"}`}>
              .{fmt}
            </button>
          ))}
        </div>
        <button onClick={handleDownload} disabled={downloading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-900 text-white text-[13px] font-black active:scale-95 transition-all disabled:opacity-60">
          <Download className="w-4 h-4" /> {downloading ? "Export..." : `Télécharger en .${downloadFormat}`}
        </button>
      </div>

      <button onClick={onRestart}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 rounded-2xl text-[13px] font-black text-gray-700 active:scale-95 transition-all shadow-sm">
        <RefreshCw className="w-4 h-4" /> Recommencer
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD ZONE
// ─────────────────────────────────────────────────────────────────────────────
function UploadZone({ image, onUpload, onClear, label, hint, accent = true }) {
  const ref = useRef();
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>}
      {image ? (
        <div className="relative rounded-2xl overflow-hidden aspect-[3/4] shadow-md">
          <BeautyImage src={image} alt="" className="w-full h-full object-cover" />
          <button onClick={onClear} className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90">
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 aspect-[3/4] rounded-2xl border-2 border-dashed transition-all active:scale-[0.98] ${accent ? "border-primary/40 bg-primary/5" : "border-gray-200 bg-gray-50"}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${accent ? "bg-primary/10" : "bg-white"}`}>
            <Camera className={`w-6 h-6 ${accent ? "text-primary" : "text-gray-400"}`} />
          </div>
          <div className="text-center px-2">
            <p className={`text-[12px] font-black ${accent ? "text-primary" : "text-gray-500"}`}>Importer</p>
            {hint && <p className="text-[10px] text-gray-400 font-medium mt-0.5">{hint}</p>}
          </div>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onUpload} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIECE UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
function PieceUpload({ label, emoji, image, productName, onBrowse, onClear }) {
  return (
    <div className="flex flex-col gap-1.5">
      {image ? (
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
          <button type="button" onClick={onBrowse} aria-label={`Remplacer ${label}`} className="h-full w-full">
            <BeautyImage src={image} alt={productName || label} className="w-full h-full object-cover" />
          </button>
          <button type="button" aria-label={`Retirer ${label}`} onClick={onClear} className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
            <X className="w-3 h-3 text-white" />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent py-1.5 px-2">
            <p className="text-white text-[9px] font-black">{productName || label}</p>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onBrowse}
          className="aspect-square rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] transition-all">
          <span className="text-[22px]">{emoji}</span>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
          <span className="text-[9px] font-bold text-primary">Choisir dans la boutique</span>
        </button>
      )}
    </div>
  );
}

function OutfitProductPicker({ slot, products, currentImage, onSelect, onUpload, onClose }) {
  const [query, setQuery] = useState("");
  const config = OUTFIT_SLOTS[slot];
  const available = productsForOutfitSlot(products, slot);
  const matches = available.filter(product => !query.trim()
    || normalizeCatalogText(`${product.name} ${product.brand} ${product.category} ${product.sub_category} ${product.productType}`)
      .includes(normalizeCatalogText(query)));

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-5" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`Choisir ${config.label} dans la boutique`} className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-xl">{config.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-black text-gray-900">Choisir {config.label.toLowerCase()}</h2>
            <p className="text-[11px] font-medium text-gray-500">Produits de la catégorie {config.category} dans la boutique</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-3 overflow-y-auto p-4">
          <label className="flex items-center gap-2 rounded-2xl bg-gray-100 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={`Rechercher ${config.label.toLowerCase()}…`} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 text-[12px] font-bold text-primary">
            <Camera className="h-4 w-4" /> Importer une photo personnelle
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
          {matches.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {matches.map(product => {
                const image = productReferenceImages(product)[0];
                const selected = currentImage === image;
                return <button key={product.id} type="button" onClick={() => onSelect(product)} className={`overflow-hidden rounded-2xl border-2 text-left transition ${selected ? "border-primary shadow-md" : "border-gray-100"}`}>
                  <div className="relative aspect-square bg-gray-50"><BeautyImage src={image} alt={product.name} className="h-full w-full object-cover" />{selected && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white"><Check className="h-4 w-4" /></span>}</div>
                  <span className="block p-2.5"><span className="block truncate text-[11px] font-black text-gray-800">{product.name}</span><span className="block truncate text-[10px] text-gray-500">{product.category || product.sub_category || config.category}</span><span className="mt-1 block text-[11px] font-black text-primary">{product.price}€</span></span>
                </button>;
              })}
            </div>
          ) : <div className="py-10 text-center"><ShoppingCart className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-2 text-[12px] font-bold text-gray-500">Aucun produit de cette catégorie dans la boutique.</p><p className="mt-1 text-[10px] text-gray-400">Vous pouvez importer une photo personnelle.</p></div>}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT SELECTOR (réutilisé depuis ProduitDetail)
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blanc: "#fff", white: "#fff", beige: "#F5F0E8", crème: "#FFFDD0", creme: "#FFFDD0",
  noir: "#111", black: "#111", gris: "#888", grey: "#888", gray: "#888",
  rouge: "#E53E3E", red: "#E53E3E", rose: "#EC4899", pink: "#EC4899",
  orange: "#F97316", jaune: "#FBBF24", yellow: "#FBBF24", gold: "#D4AF37", doré: "#D4AF37",
  vert: "#22C55E", green: "#22C55E", kaki: "#6B7C45", bleu: "#3B82F6", blue: "#3B82F6",
  marine: "#1E3A5F", navy: "#1E3A5F", violet: "#8B5CF6", purple: "#8B5CF6",
  marron: "#92400E", brown: "#92400E", bordeaux: "#7F1D1D",
};
function getColorHex(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  for (const [k, v] of Object.entries(COLOR_MAP)) { if (key.includes(k)) return v; }
  return null;
}

function VariantSelector({ options, variants, selectedOptions, onChange }) {
  if (!options || options.length === 0) return null;
  const realOptions = options.filter(o => o.name !== "Title");
  if (realOptions.length === 0) return null;

  const isValueAvailable = (optionName, value) => {
    const testOptions = { ...selectedOptions, [optionName]: value };
    return variants.some(v =>
      v.availableForSale &&
      Object.entries(testOptions).every(([name, val]) =>
        v.options.some(o => o.name === name && o.value === val)
      )
    );
  };

  return (
    <div className="space-y-3">
      {realOptions.map(option => {
        const isColor = option.name.toLowerCase().includes("couleur") || option.name.toLowerCase().includes("color");
        const selectedValue = selectedOptions[option.name];
        return (
          <div key={option.name}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] font-black text-gray-700 uppercase tracking-wider">{option.name}</p>
              {selectedValue && <p className="text-[11px] font-bold text-gray-400">— {selectedValue}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {option.values.map(value => {
                const available = isValueAvailable(option.name, value);
                const selected = selectedValue === value;
                const colorHex = isColor ? getColorHex(value) : null;
                if (isColor && colorHex) {
                  return (
                    <button key={value} disabled={!available} onClick={() => onChange(option.name, value)} title={value}
                      className={`relative w-8 h-8 rounded-full border-2 transition-all active:scale-90 ${selected ? "border-primary scale-110 shadow-md" : "border-gray-200"} ${!available ? "opacity-30" : ""}`}
                      style={{ backgroundColor: colorHex }}>
                      {selected && <Check className={`w-3 h-3 absolute inset-0 m-auto ${colorHex === "#fff" || colorHex === "#F5F0E8" ? "text-gray-800" : "text-white"}`} strokeWidth={3} />}
                    </button>
                  );
                }
                return (
                  <button key={value} disabled={!available} onClick={() => onChange(option.name, value)}
                    className={`px-3 py-1.5 rounded-xl border-2 text-[11px] font-black transition-all active:scale-95 ${
                      selected ? "border-primary bg-primary text-white" :
                      available ? "border-gray-200 text-gray-700 bg-white" :
                      "border-gray-100 text-gray-300 bg-gray-50 line-through"}`}>
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({ product, selected, onSelect }) {
  return (
    <button onClick={onSelect}
      className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition-all active:scale-95 ${selected ? "border-primary shadow-lg shadow-primary/20" : "border-transparent"}`}>
      <BeautyImage src={product.img} alt={product.name} className="w-full h-full object-cover" />
      {selected && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
        <p className="text-white text-[9px] font-black line-clamp-1">{product.name}</p>
        <p className="text-primary text-[10px] font-black">{product.price}€</p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CABINE D'ESSAYAGE
// ─────────────────────────────────────────────────────────────────────────────
const SHAI_DRAFT_KEY = 'shai_cabine_draft';

function CabineEssayage({ products, likedProducts, preSelectedProduct }) {
  const temporaryImages = useTemporaryImages();
  const [jobStatus, setJobStatus] = useState('preparing');
  // ── Restore draft from localStorage ──
  const loadDraft=()=>null;
  const draft = useRef(loadDraft()).current;

  const [mode, setMode] = useState(draft?.mode || "article");
  const [showFavoris, setShowFavoris] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userPhoto, setUserPhoto] = useState(draft?.userPhoto || null);
  const [photoAnalysis, setPhotoAnalysis] = useState(draft?.photoAnalysis || null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(draft?.selectedProduct || preSelectedProduct || null);
  const [productVariants, setProductVariants] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [topPhoto, setTopPhoto] = useState(draft?.topPhoto || null);
  const [bottomPhoto, setBottomPhoto] = useState(draft?.bottomPhoto || null);
  const [jacketPhoto, setJacketPhoto] = useState(draft?.jacketPhoto || null);
  const [shoesPhoto, setShoesPhoto] = useState(draft?.shoesPhoto || null);
  const [bagPhoto, setBagPhoto] = useState(draft?.bagPhoto || null);
  const [outfitPickerSlot, setOutfitPickerSlot] = useState(null);
  const [outfitProductNames, setOutfitProductNames] = useState({});
  const [result, setResult] = useState(draft?.result || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const { addToCart } = useCartSync();
  const [justAdded, setJustAdded] = useState(false);
  const [comparePos, setComparePos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const compareRef = useRef(null);

  // ── Save draft to localStorage (debounced) ──
  useEffect(()=>{localStorage.removeItem(SHAI_DRAFT_KEY);localStorage.removeItem('sh_ai_history');},[]);

  // Pré-sélectionner le produit depuis ProduitDetail
  useEffect(() => {
    if (preSelectedProduct) setSelectedProduct(preSelectedProduct);
  }, [preSelectedProduct]);

  // Re-analyser si le produit change alors qu'une photo est déjà chargée
  useEffect(() => {
    if (userPhoto && selectedProduct?.name) {
      analyzePhoto(userPhoto, selectedProduct.name);
    }
  }, [selectedProduct?.id]);

  // Charger les variantes Shopify quand un produit est sélectionné
  useEffect(() => {
    if (!selectedProduct) { setProductVariants(null); setSelectedOptions({}); return; }
    // Les produits BDD n'ont pas de variantes Shopify
    if (!selectedProduct.shopify_id && !selectedProduct.id?.startsWith("gid://")) {
      // Chercher par l'id dans Shopify si le produit vient de la liste shopify
      const isShopify = products.find(p => p.id === selectedProduct.id && p.vendor);
      if (!isShopify) { setProductVariants(null); setSelectedOptions({}); return; }
    }
    setLoadingVariants(true);
    fetchShopifyProducts({ productId: selectedProduct.id })
      .then(res => {
        const p = res.data?.product;
        if (p?.options && p?.variants) {
          const realOptions = p.options.filter(o => o.name !== "Title");
          if (realOptions.length > 0) {
            setProductVariants({ options: p.options, variants: p.variants });
            // Initialiser avec la 1ère variante disponible
            const firstVariant = p.variants.find(v => v.availableForSale) || p.variants[0];
            if (firstVariant?.options) {
              const initOpts = {};
              firstVariant.options.forEach(o => { initOpts[o.name] = o.value; });
              setSelectedOptions(initOpts);
            }
          } else {
            setProductVariants(null);
          }
        } else {
          setProductVariants(null);
        }
      })
      .catch(() => setProductVariants(null))
      .finally(() => setLoadingVariants(false));
  }, [selectedProduct?.id]);

  const doUploadFile = async (file) => {
    try {
      return temporaryImages.add(file);
    } catch (err) {
      setError(err.message); return null;
    }
  };

  const analyzePhoto = async (photoUrl, productName, file) => {
    setAnalyzingPhoto(true);
    setPhotoAnalysis(null);
    try {
      const url = photoUrl || (file ? await doUploadFile(file) : null);
      if (!url) return;
      
      setPhotoAnalysis({ mode: 'upload_ready', suggestion: 'Photo prête sur cet appareil. Elle sera transmise uniquement au lancement de la génération.' });
    } catch (e) {
      console.warn('Photo analysis soft fallback:', e);
      setPhotoAnalysis({
        has_person: false,
        body_visible: false,
        quality_ok: false,
        issues: ['ANALYSIS_UNAVAILABLE'],
        suggestion: 'L’analyse visuelle est momentanément indisponible. Vérifiez la photo et réessayez.'
      });
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handleUserPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = await doUploadFile(file); if(!url)return;
    setUserPhoto(url); setResult(null); setPhotoAnalysis(null);
    e.target.value = "";
    analyzePhoto(url, selectedProduct?.name || "", file);
  };

  const setOutfitPiece = (slot, image, productName = "") => {
    const setters = { top: setTopPhoto, bottom: setBottomPhoto, jacket: setJacketPhoto, shoes: setShoesPhoto, bag: setBagPhoto };
    setters[slot]?.(image);
    setOutfitProductNames(current => ({ ...current, [slot]: image ? productName : "" }));
    setResult(null);
  };

  const handlePiece = async (e, slot) => {
    const file = e.target.files[0]; if (!file) return;
    const url = await doUploadFile(file); if(!url)return;
    setOutfitPiece(slot, url, "Photo importée"); e.target.value = "";
  };

  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const tryOn = async () => {
    if (abortRef.current) return;
    if (!userPhoto) {
      setError("Importez votre photo pour lancer la simulation.");
      return;
    }
    if (mode === "article" && !selectedProduct) {
      setError("Sélectionnez l’article que vous souhaitez essayer.");
      return;
    }
    if (mode === "tenue" && !topPhoto && !bottomPhoto) {
      setError("Ajoutez au moins un haut ou un bas pour composer la tenue.");
      return;
    }
    setLoading(true); setError(null); setJobStatus('preparing');
    const controller = new AbortController();
    abortRef.current = controller;
    const referenceImages = mode === "article"
      ? productReferenceImages(selectedProduct)
      : [topPhoto, bottomPhoto, jacketPhoto, shoesPhoto, bagPhoto].filter(Boolean).slice(0, 8);
    const garmentName = mode === "article"
      ? selectedProduct.name
      : `tenue (${[topPhoto && "haut", bottomPhoto && "bas", jacketPhoto && "veste", shoesPhoto && "chaussures", bagPhoto && "sac"].filter(Boolean).join(", ")})`;
    try {
      const prepared = await prepareStylistImages({
        photo: userPhoto, references: referenceImages,
        pieces: mode === 'tenue' ? { top: topPhoto, bottom: bottomPhoto, jacket: jacketPhoto, shoes: shoesPhoto, bag: bagPhoto } : undefined,
        signal: controller.signal,
      });
      const apiCall = apiClient.callFunction("shAiTryOn", {
        ...prepared,
        garment_name: garmentName,
        styleName: garmentName,
        preserve_face: true,
        preserve_background: true,
        mode: mode === "tenue" ? "outfit" : "article",
        module: "styliste_ia",
        page: "sh-ai",
        category: mode === "tenue" ? "outfit" : selectedProduct.category || "article",
        target_area: "silhouette complète",
        operation: mode === "tenue" ? "outfit_styling" : "style_change",
      }, { signal: controller.signal, onProgress: job => setJobStatus(job.status) });
      const res = await apiCall;
      setLoading(false);
      if (res.data?.result_url) {
        const resultUrl = res.data.result_url;
        setResult(resultUrl);
      } else {
        setError("L'essayage virtuel n'a pas pu être généré. Réessayez avec une autre photo.");
      }
    } catch (err) {
      setLoading(false);
      if (err.message === 'timeout') {
        setError("L'analyse prend trop de temps. Réessayez avec une photo plus petite.");
      } else if (err.name === 'AbortError') {
        setError("Suivi fermé. Retrouvez le résultat dans l’historique.");
      } else {
        setError(err.message || "La génération n’a pas abouti.");
      }
    } finally { if (abortRef.current === controller) abortRef.current = null; }
  };

  const cancelTryOn = () => {
    if (abortRef.current) abortRef.current.abort();
    setLoading(false);
    setError("Suivi fermé. Retrouvez le résultat dans l’historique.");
  };

  const reset = () => {
    setResult(null); setSelectedProduct(preSelectedProduct || null);
    setTopPhoto(null); setBottomPhoto(null); setJacketPhoto(null); setShoesPhoto(null); setBagPhoto(null); setOutfitProductNames({}); setError(null);
    setPhotoAnalysis(null); setUserPhoto(null);
    localStorage.removeItem(SHAI_DRAFT_KEY);
  };

  const handleCompareMove = (clientX) => {
    if (!compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setComparePos(Math.round((x / rect.width) * 100));
  };
  const onCompareMouseMove = (e) => { if (isDragging) handleCompareMove(e.clientX); };
  const onCompareTouchMove = (e) => { if (isDragging) handleCompareMove(e.touches[0].clientX); };

  const baseList = showFavoris && likedProducts.length > 0 ? likedProducts : products;
  const filteredProducts = searchQuery.trim()
    ? baseList.filter(p => (p.name + " " + (p.brand || "")).toLowerCase().includes(searchQuery.toLowerCase()))
    : baseList;

  const tryOnHint = loading
    ? "Création de votre aperçu…"
    : !userPhoto
      ? "Importez votre photo pour continuer"
      : mode === "article" && !selectedProduct
        ? "Sélectionnez un article à essayer"
        : mode === "tenue" && !topPhoto && !bottomPhoto
          ? "Ajoutez les pièces de votre tenue"
          : "Simulation personnalisée";

  // Open history before the result branch so it remains accessible afterwards.
  if (showHistory) return <HistoryPanel kinds="article,outfit,exchange" onSelect={(url, job) => { setUserPhoto(null); setSelectedProduct(null); setMode(job.kind === 'outfit' ? 'tenue' : 'article'); setResult(url); setShowHistory(false); }} onClose={() => setShowHistory(false)} />;

  // — Résultat —
  if (result) {
    return (
      <div className="px-4 pt-4 pb-10 space-y-4">
        <button onClick={() => setShowHistory(true)} className="min-h-11 flex items-center gap-2 text-primary font-bold"><Clock className="h-4 w-4" /> Historique des générations</button>
        {/* Avant / Après Slider */}
        {userPhoto && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-black text-gray-700 uppercase tracking-widest">Avant / Après</p>
              <span className="text-[10px] text-gray-400 font-medium">← Glisser →</span>
            </div>
            <div
              ref={compareRef}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden cursor-col-resize select-none bg-gray-100"
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onMouseMove={onCompareMouseMove}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onTouchMove={onCompareTouchMove}
            >
              <div className="absolute inset-0">
                <BeautyImage src={result} alt="Après" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 bg-primary/90 rounded-full px-2 py-0.5">
                  <span className="text-white text-[9px] font-black uppercase">APRÈS</span>
                </div>
              </div>
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}>
                <BeautyImage src={userPhoto} alt="Avant" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-gray-900/80 rounded-full px-2 py-0.5">
                  <span className="text-white text-[9px] font-black uppercase">AVANT</span>
                </div>
              </div>
              <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${comparePos}%` }}>
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-primary">
                  <div className="flex items-center gap-0.5">
                    <ArrowLeft className="w-3 h-3 text-primary" />
                    <ArrowRight className="w-3 h-3 text-primary" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-1.5 font-medium">Glissez pour comparer l'original et le résultat</p>
          </div>
        )}

        {mode === "article" && selectedProduct && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3">
            <BeautyImage src={selectedProduct.img} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-gray-900 truncate">{selectedProduct.name}</p>
              <p className="text-[15px] font-black text-primary mt-0.5">{selectedProduct.price}€</p>
            </div>
            <button
              onClick={async () => { await addToCart(selectedProduct); setJustAdded(true); setTimeout(() => setJustAdded(false), 1500); }}
              className="flex items-center gap-2 bg-primary text-white text-[11px] font-black px-4 py-2.5 rounded-xl active:scale-95 shadow-md shadow-primary/30">
              {justAdded ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              {justAdded ? "Ajouté !" : "Panier"}
            </button>
          </div>
        )}
        <RetouchePanel imageUrl={result} onRestart={reset} />
    </div>
    );
  }

  // — Historique —

  return (
    <div className="px-4 pt-4 pb-10 space-y-5">
      {/* Historique rapide */}
      <button onClick={() => setShowHistory(true)}
        className="w-full flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 active:scale-98 transition-all">
        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-[12px] font-black text-gray-600">Historique des générations</span>
        <span className="ml-auto text-gray-300 text-lg">›</span>
      </button>

      <p className="text-xs text-gray-500">Les photos importées restent sur cet appareil jusqu’à la génération. Elles sont effacées au plus tard 3 minutes après avoir quitté cette page.</p>

      {/* Pré-sélection depuis produit */}
      {preSelectedProduct && !selectedProduct && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <BeautyImage src={preSelectedProduct.img} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-blue-700">Produit pré-sélectionné depuis la boutique</p>
            <p className="text-[12px] font-bold text-gray-800 truncate">{preSelectedProduct.name}</p>
          </div>
        </div>
      )}

      {/* Mode switcher */}
      <div className="bg-gray-100 rounded-2xl p-1 flex gap-1">
        {[
          { id: "article", label: "Article seul", Icon: Shirt },
          { id: "tenue", label: "Tenue complète", Icon: Sparkles, isNew: true },
        ].map(({ id, label, Icon, isNew }) => (
          <button key={id} onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black transition-all ${mode === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {isNew && <span className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">NEW</span>}
          </button>
        ))}
      </div>

      {/* Étape 1 — photo avec barre de chargement superposée */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-black">1</span>
          </div>
          <p className="text-[14px] font-black text-gray-900">Votre photo</p>
        </div>

        {/* Zone photo avec overlay de chargement */}
        <div className="relative rounded-2xl overflow-hidden aspect-[3/4] shadow-md">
          {userPhoto ? (
            <>
              <BeautyImage src={userPhoto} alt="" className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-30' : 'opacity-100'}`} />
              {loading && <LoadingOverlay onCancel={cancelTryOn} status={jobStatus} mode={mode} />}
              {!loading && (
                <button onClick={() => { setUserPhoto(null); setResult(null); }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 z-10">
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
              {!loading && (
                <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
              )}
            </>
          ) : (
            <UploadZone image={null} onUpload={handleUserPhoto} onClear={() => {}} hint="Corps entier, fond neutre" accent />
          )}
        </div>

        {/* Analyse de concordance */}
        {userPhoto && !loading && analyzingPhoto && (
          <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-[11px] font-bold text-blue-600">Analyse de la photo en cours…</p>
          </div>
        )}
        {userPhoto && !loading && !analyzingPhoto && <PhotoAnalysis analysis={photoAnalysis}/>}

      </div>

      {/* Étape 2 */}
      {userPhoto && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-black">2</span>
            </div>
            <p className="text-[14px] font-black text-gray-900">{mode === "article" ? "Choisir un article" : "Composer la tenue"}</p>
          </div>

          {mode === "article" ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 flex-1">
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un article..." className="flex-1 bg-transparent text-[12px] text-gray-600 outline-none" />
                </div>
                {likedProducts.length > 0 && (
                  <button onClick={() => setShowFavoris(f => !f)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-black transition-all ${showFavoris ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                    <Heart className={`w-3.5 h-3.5 ${showFavoris ? "fill-white text-white" : ""}`} />
                    {likedProducts.length}
                  </button>
                )}
              </div>
              {baseList.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <ShoppingCart className="w-10 h-10 text-gray-200" />
                  <p className="text-[12px] text-gray-400 font-medium text-center">Aucun article disponible</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filteredProducts.slice(0, 12).map(p => (
                    <ProductCard key={p.id} product={p} selected={selectedProduct?.id === p.id}
                      onSelect={() => setSelectedProduct(prev => prev?.id === p.id ? null : p)} />
                  ))}
                </div>
              )}
              {/* Variantes Shopify */}
              {selectedProduct && loadingVariants && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-[11px] font-bold text-gray-500">Chargement des variantes…</p>
                </div>
              )}
              {selectedProduct && productVariants && !loadingVariants && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Options</p>
                  <VariantSelector
                    options={productVariants.options}
                    variants={productVariants.variants}
                    selectedOptions={selectedOptions}
                    onChange={(name, value) => setSelectedOptions(prev => ({ ...prev, [name]: value }))}
                  />
                </div>
              )}

              {selectedProduct && (
                <div className="bg-orange-50 rounded-2xl p-3 flex items-center gap-3 border border-orange-100">
                  <BeautyImage src={selectedProduct.img} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-gray-900 truncate">{selectedProduct.name}</p>
                    {Object.keys(selectedOptions).length > 0 && (
                      <p className="text-[10px] text-gray-400 font-medium truncate">
                        {Object.values(selectedOptions).join(" · ")}
                      </p>
                    )}
                    <p className="text-[13px] font-black text-primary">{selectedProduct.price}€</p>
                  </div>
                  <button onClick={() => { setSelectedProduct(null); setProductVariants(null); setSelectedOptions({}); }}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(OUTFIT_SLOTS).map(([slot, config]) => {
                  const images = { top: topPhoto, bottom: bottomPhoto, jacket: jacketPhoto, shoes: shoesPhoto, bag: bagPhoto };
                  return <PieceUpload key={slot} label={config.label} emoji={config.emoji} image={images[slot]} productName={outfitProductNames[slot]} onBrowse={() => setOutfitPickerSlot(slot)} onClear={() => setOutfitPiece(slot, null)} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
          <p className="text-[12px] text-orange-600/80 font-medium leading-relaxed">{error}</p>
        </div>
      )}

      <div className="sticky bottom-20 z-30 -mx-4 border-t border-orange-100 bg-white/95 px-4 pb-3 pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <button type="button" onClick={tryOn} disabled={loading}
          aria-label={mode === "tenue" ? "Essayer cette tenue" : "Essayer l’article"}
          className="group flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-orange-400/60 bg-gradient-to-r from-[#FF6B00] via-[#F97316] to-[#EA580C] px-5 py-3 text-[14px] font-black uppercase tracking-wider text-white shadow-[0_14px_30px_rgba(234,88,12,0.42)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_18px_36px_rgba(234,88,12,0.5)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/35 disabled:cursor-wait disabled:opacity-75 disabled:hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 shadow-inner"><Wand2 className="h-5 w-5" /></span>
          <span className="flex-1 text-left"><span className="block">{mode === "tenue" ? "Essayer cette tenue" : "Essayer l’article"}</span><span className="mt-0.5 block text-[10px] font-semibold normal-case tracking-normal text-white/95">{tryOnHint}</span></span>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
      {outfitPickerSlot && <OutfitProductPicker
        slot={outfitPickerSlot}
        products={products}
        currentImage={({ top: topPhoto, bottom: bottomPhoto, jacket: jacketPhoto, shoes: shoesPhoto, bag: bagPhoto })[outfitPickerSlot]}
        onSelect={product => {
          const image = productReferenceImages(product)[0];
          setOutfitPiece(outfitPickerSlot, image, product.name || product.title || OUTFIT_SLOTS[outfitPickerSlot].label);
          setOutfitPickerSlot(null);
        }}
        onUpload={async event => { await handlePiece(event, outfitPickerSlot); setOutfitPickerSlot(null); }}
        onClose={() => setOutfitPickerSlot(null)}
      />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCHANGE DE TENUES
// ─────────────────────────────────────────────────────────────────────────────
const SHAI_TENUES_DRAFT_KEY = 'shai_echange_draft';

function EchangeTenues() {
  const temporaryImages = useTemporaryImages();
  const [jobStatus, setJobStatus] = useState('preparing');
  const [showHistory, setShowHistory] = useState(false);
  const loadDraft=()=>null;
  const draft = useRef(loadDraft()).current;

  const [userPhoto, setUserPhoto] = useState(draft?.userPhoto || null);
  const [referencePhoto, setReferencePhoto] = useState(draft?.referencePhoto || null);
  const [result, setResult] = useState(draft?.result || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(draft?.searchResults || []);
  const [detectedItems, setDetectedItems] = useState(draft?.detectedItems || []);
  const [comparePos, setComparePos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const compareRef = useRef(null);

  useEffect(()=>{localStorage.removeItem(SHAI_TENUES_DRAFT_KEY);},[]);

  const doUploadFile=async(file)=>{try{return temporaryImages.add(file);}catch(e){setError(e.message);return null;}};

  const handleUserPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = await doUploadFile(file); if(!url)return;
    setUserPhoto(url); setResult(null); e.target.value = "";
  };

  const handleReferencePhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = await doUploadFile(file); if(!url)return;
    setReferencePhoto(url); setResult(null); setSearchResults([]); setDetectedItems([]);
    // Do not transmit unused reference photos for automatic product searches.
    e.target.value = "";
  };

  const abortRef = useRef(null);

  const exchange = async () => {
    if (abortRef.current) return;
    if (!userPhoto) {
      setError("Importez votre photo pour lancer l’essayage.");
      return;
    }
    if (!referencePhoto) {
      setError("Ajoutez la photo de la tenue que vous souhaitez copier.");
      return;
    }
    setLoading(true); setError(null); setJobStatus('preparing');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const prepared = await prepareStylistImages({ photo: userPhoto, references: [referencePhoto], signal: controller.signal });
      const apiCall = apiClient.callFunction("shAiTryOn", {
        ...prepared, garment_name: "Échange de tenue",
        preserve_face: true, preserve_background: true, mode: "exchange",
        module: "styliste_ia",
        page: "sh-ai",
        category: "article",
        target_area: "silhouette complète",
        operation: "exchange_style",
      }, {signal:controller.signal, onProgress: job => setJobStatus(job.status)});
      const res = await apiCall;
      setLoading(false);
      if (res.data?.result_url) {
        const resultUrl = res.data.result_url;
        setResult(resultUrl);
      } else {
        setError("L'échange de tenue n'a pas pu être généré. Réessayez.");
      }
    } catch (err) {
      setLoading(false);
      if (err.name === 'AbortError') {
        setError("Suivi fermé. Retrouvez le résultat dans l’historique.");
      } else {
        setError(err.message || "La génération n’a pas abouti.");
      }
    } finally { if (abortRef.current === controller) abortRef.current = null; }
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancelExchange = () => {
    if (abortRef.current) abortRef.current.abort();
    setLoading(false);
    setError("Suivi fermé. Retrouvez le résultat dans l’historique.");
  };

  const reset = () => {
    setResult(null); setError(null); setSearchResults([]); setDetectedItems([]);
    setUserPhoto(null); setReferencePhoto(null);
    localStorage.removeItem(SHAI_TENUES_DRAFT_KEY);
  };

  const handleCompareMove = (clientX) => {
    if (!compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setComparePos(Math.round((x / rect.width) * 100));
  };
  const onCompareMouseMove = (e) => { if (isDragging) handleCompareMove(e.clientX); };
  const onCompareTouchMove = (e) => { if (isDragging) handleCompareMove(e.touches[0].clientX); };

  const exchangeHint = loading
    ? "Création de votre aperçu…"
    : !userPhoto
      ? "Importez votre photo pour continuer"
      : !referencePhoto
        ? "Ajoutez la tenue à copier"
        : "Copier la tenue sur ma photo";

  if (showHistory) return <HistoryPanel kinds="article,outfit,exchange" onSelect={url => { setUserPhoto(null); setResult(url); setSearchResults([]); setShowHistory(false); }} onClose={() => setShowHistory(false)} />;

  if (result) return (
    <div className="px-4 pt-4 pb-10 space-y-4">
      <button onClick={() => setShowHistory(true)} className="min-h-11 flex items-center gap-2 text-primary font-bold"><Clock className="h-4 w-4" /> Historique des générations</button>
      {/* Avant / Après Slider */}
      {userPhoto && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-black text-gray-700 uppercase tracking-widest">Avant / Après</p>
            <span className="text-[10px] text-gray-400 font-medium">← Glisser →</span>
          </div>
          <div
            ref={compareRef}
            className="relative aspect-[3/4] rounded-2xl overflow-hidden cursor-col-resize select-none bg-gray-100"
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onMouseMove={onCompareMouseMove}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            onTouchMove={onCompareTouchMove}
          >
            <div className="absolute inset-0">
              <BeautyImage src={result} alt="Après" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 right-2 bg-primary/90 rounded-full px-2 py-0.5">
                <span className="text-white text-[9px] font-black uppercase">APRÈS</span>
              </div>
            </div>
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}>
              <BeautyImage src={userPhoto} alt="Avant" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 bg-gray-900/80 rounded-full px-2 py-0.5">
                <span className="text-white text-[9px] font-black uppercase">AVANT</span>
              </div>
            </div>
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${comparePos}%` }}>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-primary">
                <div className="flex items-center gap-0.5">
                  <ArrowLeft className="w-3 h-3 text-primary" />
                  <ArrowRight className="w-3 h-3 text-primary" />
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-1.5 font-medium">Glissez pour comparer l'original et le résultat</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">Articles similaires</p>
          <div className="grid grid-cols-3 gap-2">
            {searchResults.slice(0, 6).map((p, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm">
                <BeautyImage src={p.img} alt={p.name} className="w-full aspect-square object-cover" />
                <div className="px-2 py-1.5"><p className="text-[10px] font-bold text-gray-700 line-clamp-1">{p.name}</p><p className="text-[10px] font-black text-primary">{p.price}€</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
      <RetouchePanel imageUrl={result} onRestart={reset} />
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-10 space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
        <button onClick={() => setShowHistory(true)} className="min-h-11 flex items-center gap-2 text-primary font-bold"><Clock className="h-4 w-4" /> Historique des générations</button>
        <p className="text-xs text-gray-500">Les photos restent sur cet appareil jusqu’à la génération et sont effacées au plus tard 3 minutes après avoir quitté cette page.</p>
        <p className="text-[13px] font-black text-gray-800">Comment ça marche ?</p>
        {["Importez votre photo (corps entier)", "Importez une image de référence avec la tenue à copier", "Le Styliste IA transfère la tenue sur votre silhouette"].map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-[12px] text-gray-600 font-medium">{s}</p>
          </div>
        ))}
      </div>
      {/* Photos avec overlay chargement sur la photo utilisateur */}
      <div className="space-y-3">
        {/* Votre photo — grande */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Votre photo</p>
          <div className="relative rounded-2xl overflow-hidden aspect-[3/4] shadow-md max-w-[280px] mx-auto">
            {userPhoto ? (
              <>
                <BeautyImage src={userPhoto} alt="" className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-30' : 'opacity-100'}`} />
                {loading && <LoadingOverlay onCancel={cancelExchange} status={jobStatus} mode="exchange" />}
                {!loading && (
                  <button onClick={() => setUserPhoto(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center z-10">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
                {!loading && (
                  <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
                )}
              </>
            ) : (
              <UploadZone image={null} onUpload={handleUserPhoto} onClear={() => {}} hint="Corps entier, fond neutre" accent />
            )}
          </div>
        </div>
        {/* Tenue à copier — petite, centrée */}
        <div className="flex justify-center">
          <div className="w-[200px]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">Tenue à copier</p>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-md">
              {referencePhoto ? (
                <>
                  <BeautyImage src={referencePhoto} alt="" className="w-full h-full object-cover" />
                  {!loading && (
                    <button onClick={() => { setReferencePhoto(null); setSearchResults([]); setDetectedItems([]); }} className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center z-10">
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  )}
                </>
              ) : (
                <UploadZone image={null} onUpload={handleReferencePhoto} onClear={() => {}} hint="Photo référence" accent={false} />
              )}
            </div>
          </div>
        </div>
      </div>
      {searching && (
        <div className="flex items-center gap-2 bg-primary/5 rounded-xl px-4 py-3">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-[12px] font-bold text-primary">Analyse de l'image en cours...</p>
        </div>
      )}
      {detectedItems.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Détecté dans l'image</p>
          <div className="flex flex-wrap gap-1.5">
            {detectedItems.map((item, i) => (
              <span key={i} className="bg-white text-[11px] font-bold text-gray-700 px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">{item.color} {item.type}</span>
            ))}
          </div>
        </div>
      )}
      {error && <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3"><p className="text-[12px] text-orange-600/80 font-medium">{error}</p></div>}
      <div className="sticky bottom-20 z-30 -mx-4 border-t border-orange-100 bg-white/95 px-4 pb-3 pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <button type="button" onClick={exchange} disabled={loading}
          aria-label="Essayer cette tenue"
          className="group flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-orange-400/60 bg-gradient-to-r from-[#FF6B00] via-[#F97316] to-[#EA580C] px-5 py-3 text-[14px] font-black uppercase tracking-wider text-white shadow-[0_14px_30px_rgba(234,88,12,0.42)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_18px_36px_rgba(234,88,12,0.5)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/35 disabled:cursor-wait disabled:opacity-75 disabled:hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 shadow-inner"><Repeat2 className="h-5 w-5" /></span>
          <span className="flex-1 text-left"><span className="block">Essayer cette tenue</span><span className="mt-0.5 block text-[10px] font-semibold normal-case tracking-normal text-white/95">{exchangeHint}</span></span>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY — prevents white screen crashes
// ─────────────────────────────────────────────────────────────────────────────
class ShAIErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <p className="text-[40px] mb-4">😅</p>
          <p className="text-[14px] font-black text-gray-800 mb-2">Une erreur est survenue</p>
          <p className="text-[12px] text-gray-500 mb-6">{this.state.error.message || "Erreur inconnue"}</p>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="bg-primary text-white text-[13px] font-black px-6 py-3 rounded-2xl active:scale-95 transition-all">
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ShAI() {
  useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("cabine");
  const [products, setProducts] = useState([]);
  const { liked: likedProducts } = useLikedProducts();
  const { cartCount } = useCartSync();

  // Produit pré-sélectionné depuis ProduitDetail
  const preSelected = location.state?.preSelectedProduct || null;

  useEffect(() => {
    Promise.allSettled([
      fetchShopifyProducts({}).then(r => r.data?.products || []),
      entities.Produit.filter({ status: "actif" }, "-created_at", 200)
        .then(items => items.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand || "",
          price: p.price,
          img: imageUrl(p.images?.[0]) || imageUrl(p.image_url),
          image_url: p.image_url || "",
          images: [p.image_url, ...(p.images || [])].filter(Boolean),
          category: p.category || "",
          sub_category: p.sub_category || "",
          tags: p.tags || [],
        }))),
      entities.AppConfig.filter({ key: "shopify_category_mappings" }, "-created_at", 50)
        .then(rows => rows[0]?.value?.products || rows[0]?.value || {})
        .catch(() => ({})),
    ]).then(([shopify, db, mappings]) => {
      const categoryOverrides = mappings.status === "fulfilled" ? mappings.value : {};
      const shopifyProducts = (shopify.status === "fulfilled" ? shopify.value : []).map(product => {
        const override = categoryOverrides[product.id] || {};
        return {
          ...product,
          category: override.category ?? product.category ?? product.productType ?? "",
          sub_category: override.sub_category ?? product.sub_category ?? "",
          tags: override.tags ?? product.tags ?? [],
        };
      });
      const all = [
        ...(db.status === "fulfilled" ? db.value : []),
        ...shopifyProducts,
      ].filter(p => p.img);
      const deduplicated = [...new Map(all.map(product => [product.id, product])).values()];
      setProducts(deduplicated);
    });
  }, []);

  const tabs = [
    { id: "cabine", label: "Essayage", sublabel: "Article / Tenue", icon: <Shirt className="w-4 h-4 shrink-0" /> },
    { id: "echange", label: "Échange", sublabel: "Copier une tenue", icon: <Repeat2 className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <ShAIErrorBoundary>
    <div className="font-display bg-white min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-2xl flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shrink-0" style={{ background: "linear-gradient(135deg, #E8732A 0%, #f59540 100%)" }}>
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-black text-gray-900 leading-none">Styliste IA</h1>
              <span className="bg-primary/10 text-primary text-[8px] font-black px-2 py-0.5 rounded-full border border-primary/20 uppercase tracking-widest">BETA</span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Cabine d'essayage intelligente</p>
          </div>
        </div>
        <button onClick={() => navigate("/panier")} className="relative w-9 h-9 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-white text-[9px] font-black">{cartCount}</span>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white px-3 pt-3 pb-0 gap-2 border-b border-gray-100 sticky top-[73px] z-20">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-t-2xl transition-all ${isActive ? "bg-primary/5 border-b-2 border-primary" : "hover:bg-gray-50"}`}>
              <span className={isActive ? "text-primary" : "text-gray-400"}>{tab.icon}</span>
              <div className="text-left">
                <p className={`text-[13px] font-black leading-tight ${isActive ? "text-primary" : "text-gray-500"}`}>{tab.label}</p>
                <p className={`text-[10px] leading-tight ${isActive ? "text-primary/60" : "text-gray-400"}`}>{tab.sublabel}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "cabine"
          ? <CabineEssayage products={products} likedProducts={likedProducts} preSelectedProduct={preSelected} />
          : <EchangeTenues />}
      </div>
    </div>
    </ShAIErrorBoundary>
  );
}
