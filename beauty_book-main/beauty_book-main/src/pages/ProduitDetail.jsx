import BeautyImage from '@/components/ui/BeautyImage';
import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import {
  ArrowLeft, Share2, Heart, ShoppingCart, Star, ChevronRight,
  Truck, Shield, RotateCcw, ChevronDown, ChevronUp, Check, ZoomIn, CreditCard, Lock, X, Wand2,
  MapPin, MessageCircle, Phone, Clock, Headphones, Package, RefreshCw, ArrowUp, Store
} from "lucide-react";
import { useCartSync } from "@/hooks/useCartSync";
import { useLikedProducts } from "@/hooks/useLikedProducts";
import { readPageCache, writePageCache, mergePageCache } from "@/hooks/usePageCache";

// ── Scroll to Top Button ─────────────────────────────────────────────────────
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById("app-content");
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 600);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => {
        const el = document.getElementById("app-content");
        if (el) el.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 bg-primary/80 backdrop-blur-sm rounded-full flex items-center gap-2 shadow-lg shadow-primary/30 active:scale-90 transition-all"
    >
      <ArrowUp className="w-4 h-4 text-white" />
      <span className="text-[12px] font-black text-white uppercase tracking-wide">Retour en haut</span>
    </button>
  );
}

// ── Image Gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ images, focusIdx = 0 }) {
  const [activeIdx, setActiveIdx] = useState(focusIdx);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => { setActiveIdx(focusIdx); }, [focusIdx]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50 && activeIdx < images.length - 1) setActiveIdx(i => i + 1);
    if (diff < -50 && activeIdx > 0) setActiveIdx(i => i - 1);
    touchStartX.current = null;
  };

  return (
    <div className="relative bg-gray-50">
      <div className="relative aspect-[3/4] overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={() => setZoomed(true)}>
        <BeautyImage src={images[activeIdx]?.url || images[activeIdx] || ""} alt="" className="w-full h-full object-cover transition-opacity duration-200" />
        <button className="absolute bottom-3 right-3 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow">
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
        <div className="absolute bottom-3 left-3 bg-black/50 rounded-full px-2.5 py-1">
          <span className="text-white text-[11px] font-bold">{activeIdx + 1}/{images.length}</span>
        </div>
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto hide-scrollbar">
          {images.map((img, i) => (
            <button key={i} onClick={() => setActiveIdx(i)}
              className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === activeIdx ? "border-primary" : "border-transparent"}`}>
              <BeautyImage src={img.url || img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {zoomed && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={() => setZoomed(false)}>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-[13px] font-black">{activeIdx + 1} / {images.length}</span>
            <button className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center"><X className="w-5 h-5 text-white" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <BeautyImage src={images[activeIdx]?.url || images[activeIdx]} alt="" className="w-full h-full object-contain" />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto justify-center">
              {images.map((m, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                  className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === activeIdx ? "border-white scale-110" : "border-transparent opacity-50"}`}>
                  <BeautyImage src={m.url || m} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExpandableSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-4">
        <span className="text-[14px] font-black text-gray-900 uppercase tracking-wide">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="pb-4 text-[13px] text-gray-600 leading-relaxed">{children}</div>}
    </div>
  );
}

// ── Checkout Modal ────────────────────────────────────────────────────────────
function getColorHex(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  for (const [k, v] of Object.entries(COLOR_MAP)) { if (key.includes(k)) return v; }
  return null;
}

// ── Variant Selector ─────────────────────────────────────────────────────────
function VariantSelector({ options, variants, selectedOptions, onChange }) {
  if (!options || options.length === 0) return null;
  const realOptions = options.filter(o => o.name !== "Title");
  if (realOptions.length === 0) return null;

  const isValueAvailable = (optionName, value) => {
    const testOptions = { ...selectedOptions, [optionName]: value };
    return variants.some(v => v.availableForSale && Object.entries(testOptions).every(([name, val]) => v.options.some(o => o.name === name && o.value === val)));
  };

  return (
    <div className="space-y-4 mb-4">
      {realOptions.map(option => {
        const isColor = option.name.toLowerCase().includes("couleur") || option.name.toLowerCase().includes("color");
        const selectedValue = selectedOptions[option.name];
        return (
          <div key={option.name}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[12px] font-black text-gray-900 uppercase tracking-wider">{option.name}</p>
              {selectedValue && <p className="text-[12px] font-bold text-gray-500">— {selectedValue}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {option.values.map(value => {
                const available = isValueAvailable(option.name, value);
                const selected = selectedValue === value;
                const colorHex = isColor ? getColorHex(value) : null;
                if (isColor && colorHex) {
                  return (
                    <button key={value} disabled={!available} onClick={() => onChange(option.name, value)} title={value}
                      className={`relative w-9 h-9 rounded-full border-2 transition-all active:scale-90 ${selected ? "border-primary shadow-md scale-110" : "border-gray-200"} ${!available ? "opacity-30" : ""}`}
                      style={{ backgroundColor: colorHex }}>
                      {selected && <span className="absolute inset-0 flex items-center justify-center"><Check className={`w-3.5 h-3.5 ${['#fff','#F5F0E8','#FFFDD0','#F5F5DC'].includes(colorHex) ? 'text-gray-800' : 'text-white'}`} strokeWidth={3} /></span>}
                      {!available && <span className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-gray-400 rotate-45 absolute" /></span>}
                    </button>
                  );
                }
                return (
                  <button key={value} disabled={!available} onClick={() => onChange(option.name, value)}
                    className={`px-3.5 py-2 rounded-xl border-2 text-[12px] font-black transition-all active:scale-95 ${selected ? "border-primary bg-primary text-white shadow-sm shadow-primary/30" : available ? "border-gray-200 text-gray-700 bg-white" : "border-gray-100 text-gray-300 bg-gray-50 line-through"}`}>
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProduitDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("id");
  const scrollRef = useRef(null);

  // Affichage direct depuis le cache du produit : jamais de skeleton vide,
  // le rafraîchissement se fait en arrière-plan sans vider l'affichage.
  const [initialCache] = useState(() => readPageCache(productId ? `produit_${productId}` : null) || {});
  const [product, setProduct] = useState(initialCache.product || null);
  const [isDbProduct, setIsDbProduct] = useState(!!initialCache.isDbProduct);
  const [loading, setLoading] = useState(() => !initialCache.product);
  const [error, setError] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const { toggle: toggleLike, isLiked } = useLikedProducts();
  const [addedToCart, setAddedToCart] = useState(false);

  const { addToCart, error: cartError } = useCartSync();
  const [vendorProducts, setVendorProducts] = useState(initialCache.vendorProducts || []);
  const [productReviews, setProductReviews] = useState(initialCache.productReviews || []);

  useEffect(() => {
    if (!productId) { setError("Produit introuvable"); setLoading(false); return; }
    const cacheKey = `produit_${productId}`;
    // Navigation d'un produit à l'autre : afficher le cache du nouveau produit
    // immédiatement plutôt qu'un skeleton vide.
    const cached = readPageCache(cacheKey);
    if (cached?.product) {
      setProduct(cached.product);
      setIsDbProduct(!!cached.isDbProduct);
      setVendorProducts(cached.vendorProducts || []);
      setProductReviews(cached.productReviews || []);
      setLoading(false);
    } else {
      setProduct(null); setLoading(true);
    }
    setError(null); setSelectedOptions({}); setAddedToCart(false);

    const isShopifyId = productId.startsWith("gid://shopify/");
    const loadShopifyProduct = (pid) => {
      fetchShopifyProducts({ productId: pid }).then(res => {
        const p = res.data.product;
        if (!p) { setError("Produit introuvable"); setLoading(false); return; }
        setProduct(p);
        writePageCache(cacheKey, { product: p, isDbProduct: false });
        const firstVariant = p?.variants?.find(v => v.availableForSale) || p?.variants?.[0];
        if (firstVariant?.options) {
          const initOpts = {};
          firstVariant.options.forEach(o => { initOpts[o.name] = o.value; });
          setSelectedOptions(initOpts);
        }
        setIsDbProduct(false); setLoading(false);
      }).catch(err => { setError(err.message); setLoading(false); });
    };

    if (isShopifyId) { loadShopifyProduct(productId); return; }

    entities.Produit.filter({}, "-created_at", 200).then(items => items.find(p => p.id === productId)).then(dbProduct => {
      if (dbProduct && !dbProduct.external_url) {
        const images = [dbProduct.image_url, ...(dbProduct.images || [])].filter(Boolean);
        const normalized = { id: dbProduct.id, title: dbProduct.name, name: dbProduct.name, vendor: dbProduct.brand || "BeautyBook", price: dbProduct.price, oldPrice: dbProduct.old_price || null, description: dbProduct.description || "", images: images.map(url => ({ url })), image_url: dbProduct.image_url, tags: dbProduct.tags || [], stock: dbProduct.stock, category: dbProduct.category, created_by: dbProduct.created_by };
        setProduct(normalized);
        writePageCache(cacheKey, { product: normalized, isDbProduct: true });
        setIsDbProduct(true); setLoading(false);
        // Charger les produits du même vendeur
        entities.Produit.filter({ status: "actif", brand: dbProduct.brand }, "-created_at", 10).then(items => {
          const vp = items.filter(p => p.id !== dbProduct.id).slice(0, 6);
          setVendorProducts(vp);
          mergePageCache(cacheKey, { vendorProducts: vp });
        }).catch(() => {});
        // Charger les avis
        entities.Avis.filter({ service_nom: dbProduct.name }, "-created_at", 20).then(reviews => {
          setProductReviews(reviews);
          mergePageCache(cacheKey, { productReviews: reviews });
        }).catch(() => {});
      } else { loadShopifyProduct(productId); }
    }).catch(() => { loadShopifyProduct(productId); });
  }, [productId]);

  const selectedVariant = product && !isDbProduct ? product.variants?.find(v => Object.entries(selectedOptions).every(([name, val]) => v.options.some(o => o.name === name && o.value === val))) || product.variants?.[0] : null;
  const handleOptionChange = (optionName, value) => { setSelectedOptions(prev => ({ ...prev, [optionName]: value })); };

  const handleBuyNow = () => {
    if (isDbProduct) { navigate('/checkout?productId='+encodeURIComponent(product.id)+'&quantity='+Math.max(1,product.min_qty||1)); return; }
    const variantId = selectedVariant?.id;
    if (!variantId) return;
    navigate(`/checkout?${new URLSearchParams({ variantId, title: product.title, img: product.images?.[0]?.url || "", price: String(displayPrice), brand: product.vendor || "", variant: selectedVariant?.title || "" }).toString()}`);
  };

  const handleAddToCart = async () => {
    const img = variantImageUrl || galleryImages[0]?.url || product.image_url || "";
    const added = await addToCart({ id: selectedVariant?.id || product.id || productId, name: product.title || product.name, price: displayPrice, img, brand: product.vendor || "" });
    if (!added) return; setAddedToCart(true); setTimeout(() => setAddedToCart(false), 2000);
  };

  if (loading) return <div className="min-h-screen bg-white flex flex-col"><div className="flex items-center gap-3 px-4 py-4"><div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" /><div className="flex-1 h-5 bg-gray-100 rounded-full animate-pulse" /></div><div className="aspect-[3/4] bg-gray-100 animate-pulse" /></div>;
  if (error || !product) return <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6"><p className="text-gray-400 font-medium">Produit introuvable</p><button onClick={() => navigate(-1)} className="text-primary font-black text-[14px]">← Retour</button></div>;

  const displayPrice = isDbProduct ? product.price : (selectedVariant?.price ?? product.price);
  const displayOldPrice = isDbProduct ? product.oldPrice : (selectedVariant?.compareAtPrice || product.oldPrice);
  const discount = displayOldPrice && displayOldPrice > displayPrice ? Math.round((1 - displayPrice / displayOldPrice) * 100) : null;
  const variantAvailable = isDbProduct ? (product.stock > 0) : (selectedVariant?.availableForSale !== false);
  const galleryImages = product.images?.length > 0 ? product.images : [{ url: product.image_url || "" }];
  const variantImageUrl = selectedVariant?.image?.url || null;
  const variantImageIdx = variantImageUrl ? galleryImages.findIndex(img => (img.url || img) === variantImageUrl) : -1;
  const displayGallery = variantImageUrl && variantImageIdx === -1 ? [{ url: variantImageUrl }, ...galleryImages] : galleryImages;
  const galleryFocusIdx = variantImageUrl ? (variantImageIdx >= 0 ? variantImageIdx : 0) : 0;
  const activeProductImg = variantImageUrl || galleryImages[0]?.url || product.image_url || "";
  const deliveryDate = product.delivery_estimate || "Délai communiqué par la boutique";

  return (
    <div ref={scrollRef} className="font-display bg-white min-h-screen pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white sticky top-0 z-20 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all"><ArrowLeft className="w-4 h-4 text-gray-700" /></button>
        <span className="text-[14px] font-black text-gray-900 uppercase tracking-wide line-clamp-1 flex-1 text-center mx-3">{product.category || product.vendor || "PRODUIT"}</span>
        <div className="flex items-center gap-2">
          <button onClick={async () => { if (navigator.share) { try { await navigator.share({ title: product?.title, url: window.location.href }); } catch {} } else { navigator.clipboard.writeText(window.location.href); } }} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all"><Share2 className="w-4 h-4 text-gray-600" /></button>
          <button onClick={() => toggleLike({ id: product?.id, name: product?.title, brand: product?.vendor || "", price: product?.price, img: product?.image_url, category: product?.category })} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all"><Heart className={`w-4 h-4 transition-all ${isLiked(product?.id) ? "fill-red-500 text-red-500" : "text-gray-600"}`} /></button>
        </div>
      </div>

      <ImageGallery images={displayGallery} focusIdx={galleryFocusIdx} />

      {/* Info */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[11px] font-black text-primary uppercase tracking-widest mb-1">{product.category || product.vendor}</p>
        <h1 className="text-[18px] font-black text-gray-900 leading-snug mb-3">{product.title || product.name}</h1>

        {isDbProduct && product.stock !== undefined && (
          <div className={`inline-flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-full text-[11px] font-black ${product.stock > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${product.stock > 0 ? "bg-green-500" : "bg-red-500"}`} />
            {product.stock > 0 ? `${product.stock} en stock` : "Rupture de stock"}
          </div>
        )}

        {Number(product.reviews_count)>0 && <p className="text-sm text-gray-600 mb-3">{Number(product.rating).toFixed(1)} / 5 · {product.reviews_count} avis</p>}

        <div className="flex items-center gap-3 mb-4">
          <span className="text-[26px] font-black text-gray-900">{parseFloat(displayPrice).toFixed(2)} €</span>
          {displayOldPrice && displayOldPrice > displayPrice && <span className="text-[15px] text-gray-400 line-through font-medium">{parseFloat(displayOldPrice).toFixed(2)} €</span>}
          {discount && <span className="bg-primary text-white text-[12px] font-black px-2.5 py-1 rounded-full">-{discount}%</span>}
        </div>

        {!isDbProduct && product.options && <VariantSelector options={product.options} variants={product.variants || []} selectedOptions={selectedOptions} onChange={handleOptionChange} />}
        {!isDbProduct && selectedVariant && !selectedVariant.availableForSale && <div className="inline-flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-full text-[11px] font-black bg-red-50 text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Rupture de stock pour cette variante</div>}
        {!isDbProduct && selectedVariant?.availableForSale && <div className="inline-flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-full text-[11px] font-black bg-green-50 text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Disponible</div>}

        {product.tags?.length > 0 && <div className="flex flex-wrap gap-1.5 mb-4">{product.tags.slice(0, 4).map((tag, i) => <span key={i} className="bg-gray-100 text-gray-500 text-[11px] font-bold px-2.5 py-1 rounded-full">{tag}</span>)}</div>}

        <button onClick={() => navigate("/sh-ai", { state: { preSelectedProduct: { id: product.id || productId, name: product.title || product.name, price: displayPrice, img: activeProductImg, brand: product.vendor || "" } } })}
          className="w-full flex items-center gap-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl px-4 py-3.5 active:scale-95 transition-all mb-1">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-md shadow-primary/30 shrink-0"><Wand2 className="w-5 h-5 text-white" /></div>
          <div className="flex-1 text-left"><p className="text-[14px] font-black text-gray-900">Essayer avec Styliste IA</p><p className="text-[11px] text-gray-500 font-medium">Simulez ce produit sur votre photo</p></div>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* Protections */}
      <div className="px-4 py-5">
        <h2 className="text-[15px] font-black text-gray-900 mb-4">Protections BeautyBook</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: CreditCard, label: "Paiements sécurisés" },
            { icon: Truck, label: "Suivi de commande" },
            { icon: RefreshCw, label: "Suivi des remboursements" },
            { icon: Headphones, label: "Contacter la boutique" },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center"><Icon className="w-5 h-5 text-teal-600" /></div>
              <span className="text-[10px] font-bold text-gray-600 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* Livraison et retours */}
      <div className="px-4 py-5">
        <h2 className="text-[15px] font-black text-gray-900 mb-4">Livraison et retours</h2>
        <div className="space-y-4">
          <button className="w-full flex items-center gap-3 text-left">
            <Truck className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-black text-primary">{product.free_shipping !== false ? "Livraison gratuite" : "Livraison payante"}</p>
              <p className="text-[12px] text-gray-600 font-medium">Livraison d'ici le {deliveryDate}</p>
              {product.delivery_time && <p className="text-[11px] text-gray-400 mt-0.5">Délai estimé : {product.delivery_time}</p>}
              {product.vendor && <p className="text-[11px] text-gray-500 font-medium mt-1">Expédié par <span className="font-black">{product.vendor}</span></p>}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
          <div className="h-px bg-gray-100" />
          <button className="w-full flex items-center gap-3 text-left">
            <Package className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-black text-gray-900">Politique de retour</p>
              <p className="text-[12px] text-gray-500 font-medium leading-relaxed">{product.return_policy || "Consultez les conditions de retour de la boutique avant votre achat."}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* Plus d'articles de cette boutique */}
      {vendorProducts.length > 0 && (
        <>
          <div className="px-4 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-black text-gray-900">Plus d'articles de cette boutique</h2>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2">
              {vendorProducts.map(p => (
                <button key={p.id} onClick={() => navigate(`/produit?id=${p.id}`)}
                  className="min-w-[140px] max-w-[140px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden shrink-0 active:scale-[0.98] transition-all">
                  <div className="aspect-square bg-gray-50"><BeautyImage src={p.image_url || ""} alt={p.name} className="w-full h-full object-cover" /></div>
                  <div className="p-2.5">
                    <p className="text-[11px] font-bold text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                    <p className="text-[13px] font-black text-gray-900 mt-1">Dès {parseFloat(p.price).toFixed(2)} €</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="h-2 bg-gray-50" />
        </>
      )}

      {/* À propos du produit */}
      <div className="px-4">
        {(() => {
          // Parser la description pour extraire les specs (Key: Value)
          const desc = product.description || "";
          const specLines = [];
          const descLines = [];
          const seen = new Set();
          for (const raw of desc.split(/\n/)) {
            const line = raw.trim();
            if (!line) continue;
            // Pattern: "Key: Value" ou "Key : Value"
            const m = line.match(/^([A-Za-zÀ-ÿ\s&'()-]+?)\s*[:]\s*(.+)$/);
            if (m && m[1].trim().length < 40 && m[2].trim().length > 0 && m[2].trim().length < 300) {
              const key = m[1].trim();
              const lower = key.toLowerCase();
              if (!seen.has(lower)) {
                seen.add(lower);
                specLines.push({ label: key, value: m[2].trim() });
              }
            } else {
              descLines.push(line);
            }
          }
          // Specs standard du produit BDD
          if (product.category && !seen.has("catégorie")) specLines.push({ label: "Catégorie", value: product.category });
          if (product.brand && !seen.has("marque")) specLines.push({ label: "Marque", value: product.brand });
          if (product.stock !== undefined && !seen.has("disponibilité")) specLines.push({ label: "Disponibilité", value: product.stock > 0 ? "En stock" : "Rupture de stock" });
          if (product.tags?.length > 0 && !seen.has("tags")) specLines.push({ label: "Tags", value: product.tags.join(", ") });

          const cleanDesc = descLines.join("\n").trim();

          return (
            <>
              <ExpandableSection title="Description du produit" defaultOpen>
                <p className="text-[13px] text-gray-600 leading-relaxed text-justify">{cleanDesc || "Aucune description disponible."}</p>
              </ExpandableSection>
              <ExpandableSection title="Spécifications">
                <div className="space-y-2">
                  {specLines.length > 0 ? specLines.slice(0, 15).map((s, i) => (
                    <div key={i} className={`flex items-center justify-between py-2 ${i < specLines.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="text-[12px] font-bold text-gray-500">{s.label}</span>
                      <span className="text-[12px] font-black text-gray-900 text-right max-w-[60%]">{s.value}</span>
                    </div>
                  )) : <p className="text-[13px] text-gray-400 italic">Aucune spécification disponible.</p>}
                </div>
              </ExpandableSection>
            </>
          );
        })()}
        <ExpandableSection title="Avis clients">
          {productReviews.length > 0 ? (
            <div className="space-y-3">
              {productReviews.slice(0, 5).map(a => (
                <div key={a.id} className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center"><span className="text-[10px] font-black text-primary">{(a.auteur_nom || "?")[0]}</span></div>
                    <span className="text-[12px] font-black text-gray-900">{a.auteur_nom || "Client"}</span>
                    <div className="flex gap-0.5 ml-auto">{[1,2,3,4,5].map(i => <Star key={i} className={`w-2.5 h-2.5 ${a.note >= i ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />)}</div>
                  </div>
                  {a.commentaire && <p className="text-[12px] text-gray-600 leading-relaxed">{a.commentaire}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-[13px] text-gray-400 italic">Aucun avis pour le moment.</p>}
        </ExpandableSection>

        {/* Conformité (représentant UE, fabricant, recyclage) */}
        {(() => {
          const euRep = product?.eu_representative || product?.representant_ue || {};
          const manufacturer = product?.manufacturer || product?.fabricant || {};
          const recycling = product?.recycling || product?.recyclage || product?.conformite || "";
          const hasData = euRep.name || euRep.email || euRep.phone || euRep.address
            || manufacturer.name || manufacturer.email || manufacturer.phone || manufacturer.address
            || recycling;
          if (!hasData) return null;
          return (
            <ExpandableSection title="Conformité">
              <div className="space-y-4">
                {(euRep.name || euRep.email || euRep.phone || euRep.address) && (
                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Représentant dans l'Union européenne</p>
                    <div className="space-y-1.5">
                      {euRep.name && <p className="text-[13px] text-gray-700"><span className="font-bold">Nom :</span> {euRep.name}</p>}
                      {euRep.address && <p className="text-[13px] text-gray-700"><span className="font-bold">Adresse :</span> {euRep.address}</p>}
                      {euRep.phone && <p className="text-[13px] text-gray-700"><span className="font-bold">Téléphone :</span> {euRep.phone}</p>}
                      {euRep.email && <p className="text-[13px] text-gray-700"><span className="font-bold">Email :</span> {euRep.email}</p>}
                    </div>
                  </div>
                )}
                {(manufacturer.name || manufacturer.email || manufacturer.phone || manufacturer.address) && (
                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Fabricant</p>
                    <div className="space-y-1.5">
                      {manufacturer.name && <p className="text-[13px] text-gray-700"><span className="font-bold">Nom :</span> {manufacturer.name}</p>}
                      {manufacturer.address && <p className="text-[13px] text-gray-700"><span className="font-bold">Adresse :</span> {manufacturer.address}</p>}
                      {manufacturer.phone && <p className="text-[13px] text-gray-700"><span className="font-bold">Téléphone :</span> {manufacturer.phone}</p>}
                      {manufacturer.email && <p className="text-[13px] text-gray-700"><span className="font-bold">Email :</span> {manufacturer.email}</p>}
                    </div>
                  </div>
                )}
                {recycling && (
                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">Politiques de recyclage</p>
                    <p className="text-[13px] text-gray-700 text-justify leading-relaxed">{recycling}</p>
                  </div>
                )}
              </div>
            </ExpandableSection>
          );
        })()}
      </div>

      <div className="h-2 bg-gray-50 mt-2" />

      {/* À propos de cette boutique */}
      <div className="px-4 py-5">
        <h2 className="text-[15px] font-black text-gray-900 mb-4">À propos de cette boutique</h2>
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center"><span className="text-[16px] font-black text-primary">{(product.vendor || "B")[0]}</span></div>
            <div>
              <p className="text-[14px] font-black text-gray-900">{product.vendor || "Vendeur BeautyBook"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}</div>
                <span className="text-[11px] text-gray-500 font-medium">4.7 · Vendeur vérifié</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white rounded-xl p-2.5 text-center"><p className="text-[14px] font-black text-gray-900">89%</p><p className="text-[9px] text-gray-400 font-bold uppercase">Avis positifs</p></div>
            <div className="bg-white rounded-xl p-2.5 text-center"><p className="text-[14px] font-black text-gray-900">48h</p><p className="text-[9px] text-gray-400 font-bold uppercase">Expédié en</p></div>
            <div className="bg-white rounded-xl p-2.5 text-center"><p className="text-[14px] font-black text-gray-900">24h</p><p className="text-[9px] text-gray-400 font-bold uppercase">Réponse</p></div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <MessageCircle className="w-4 h-4 text-gray-600" /><span className="text-[11px] font-black text-gray-700">Message</span>
            </button>
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />
      <RelatedServices productId={productId} productName={product.title || product.name} />
      <RecommendedProducts currentProductId={productId} product={product} title="PRODUITS DE LA BOUTIQUE" />
      <YouMayAlsoLike currentProductId={productId} />

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3 z-30" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <button onClick={handleAddToCart} className="flex-1 py-3.5 border-2 border-primary rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
          {addedToCart ? <><Check className="w-4 h-4 text-primary" /><span className="text-[13px] font-black text-primary">Ajouté !</span></> : <><ShoppingCart className="w-4 h-4 text-primary" /><span className="text-[13px] font-black text-primary">Panier</span></>}
        </button>
        <button onClick={handleBuyNow} disabled={!variantAvailable || (!isDbProduct && !selectedVariant)}
          className="flex-[2] py-3.5 bg-primary rounded-2xl text-white text-[14px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-40">
          {variantAvailable ? "Acheter maintenant" : "Rupture de stock"}
        </button>
      </div>

      {cartError && <div role="alert" className="fixed bottom-40 left-4 right-4 z-40 rounded-xl bg-red-50 border border-red-300 text-red-800 p-4">{cartError}</div>}
      <ScrollToTopButton />
    </div>
  );
}

// ── Produits de la même boutique (grille 2 colonnes) ─────────────────────────
function RecommendedProducts({ currentProductId, product, title = "PRODUITS DE LA BOUTIQUE" }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    const vendorName = product?.vendor || product?.brand || '';
    const createdBy = product?.created_by || '';

    (async () => {
      const all = [];

      // 1) Produits BDD même vendeur
      try {
        let items = await entities.Produit.filter({ status: "actif" }, "-created_at", 100).catch(() => []);
        if (!items || items.length === 0) {
          items = await entities.Produit.list("-created_at", 100).catch(() => []);
        }
        for (const p of (items || [])) {
          const sameVendor = (p.brand && vendorName && p.brand.toLowerCase() === vendorName.toLowerCase())
            || (p.created_by && createdBy && p.created_by === createdBy);
          if (!sameVendor) continue;
          if (p.id === currentProductId) continue;
          all.push({
            id: p.id,
            image_url: p.image_url || (p.images && p.images[0]) || '',
            name: p.name || p.title || '',
            brand: p.brand || '',
            price: parseFloat(p.price || 0),
          });
        }
      } catch (e) { console.warn("[Boutique] DB error:", e.message); }

      // 2) Shopify — même vendor
      try {
        const SHOPIFY_DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN || '';
        const SHOPIFY_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '';
        if (SHOPIFY_DOMAIN && SHOPIFY_TOKEN && vendorName) {
          const r = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-10/graphql.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN },
            body: JSON.stringify({
              query: `{
                products(first: 20, query: "vendor:${vendorName}", sortKey: BEST_SELLING) {
                  edges { node {
                    id title vendor
                    images(first: 1) { edges { node { url } } }
                    variants(first: 1) { edges { node { price { amount } } } }
                  } }
                }
              }`
            })
          });
          const json = await r.json();
          const edges = json.data?.products?.edges || [];
          for (const { node } of edges) {
            if (node.id === currentProductId) continue;
            const v = node.variants?.edges?.[0]?.node;
            const img = node.images?.edges?.[0]?.node;
            all.push({
              id: node.id,
              image_url: img?.url || '',
              name: node.title,
              brand: node.vendor || '',
              price: parseFloat(v?.price?.amount || '0'),
            });
          }
        }
      } catch (e) { console.warn("[Boutique] Shopify error:", e.message); }

      if (dead) return;
      setProducts(all.slice(0, 8));
      setLoading(false);
    })();
    return () => { dead = true; };
  }, [currentProductId, product?.vendor, product?.brand, product?.created_by]);

  return (
    <div className="px-4 py-5">
      <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-tight mb-4">{title}</h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-gray-100 rounded-2xl" />
              <div className="p-3 space-y-2 mt-2">
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {products.map(p => (
            <button key={p.id}
              onClick={() => navigate(`/produit?id=${encodeURIComponent(p.id)}`)}
              className="bg-white rounded-[24px] overflow-hidden shadow-sm active:scale-95 transition-all text-left border border-gray-100">
              <div className="relative h-[140px]">
                {p.image_url ? (
                  <BeautyImage src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <ShoppingCart className="w-8 h-8 text-gray-200" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="p-3">
                {p.brand && <p className="text-[10px] font-black text-primary uppercase tracking-wider truncate">{p.brand}</p>}
                <p className="text-[12px] font-bold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                <p className="text-[13px] font-black text-primary mt-1">{p.price.toFixed(2)} €</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-gray-400 italic text-center py-4">Aucun produit de cette boutique pour l'instant.</p>
      )}
    </div>
  );
}

// ── Services associés ────────────────────────────────────────────────────────
function RelatedServices({ productId, productName }) {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);

  useEffect(() => {
    if (!productId && !productName) return;
    (async () => {
      try {
        // 1) Charger tous les styles
        const styles = await entities.Style.list("-created_at", 500);
        if (!styles || styles.length === 0) return;
        // 2) Trouver les styles qui utilisent ce produit (par id, name, ou label)
        const needle = (productName || "").toLowerCase().trim();
        const needleId = String(productId || "");
        const matchingStyles = styles.filter(s => {
          const produits = s.produits_utilises || [];
          return produits.some(p => {
            const pid = String(p.id || "");
            const pname = (p.name || p.label || "").toLowerCase().trim();
            return pid === needleId || pname === needle || pname.includes(needle) || needle.includes(pname);
          });
        });
        if (matchingStyles.length === 0) return;
        // 3) Charger tous les services
        const allServices = await entities.Service.list("-created_at", 200);
        if (!allServices || allServices.length === 0) return;
        // 4) Trouver les services liés à ces styles
        const styleTitles = new Set(matchingStyles.map(s => (s.title || "").toLowerCase().trim()));
        const matchedServices = allServices.filter(s => {
          const svcStyle = (s.style || "").toLowerCase().trim();
          return svcStyle && (styleTitles.has(svcStyle) || [...styleTitles].some(t => t.includes(svcStyle) || svcStyle.includes(t)));
        });
        setServices(matchedServices.slice(0, 4));
      } catch (e) { console.error("[RelatedServices] error:", e); }
    })();
  }, [productId, productName]);

  if (services.length === 0) return null;
  return (
    <div className="px-4 py-5">
      <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-tight mb-4">Services associés</h2>
      <div className="space-y-3">
        {services.map(s => {
          const media = [];
          if (s.image_url) media.push(s.image_url);
          if (s.images?.length > 0) s.images.forEach(u => { if (u && !media.includes(u)) media.push(u); });
          return (
            <button key={s.id} onClick={() => navigate(`/service/${s.id}`, { state: { id: s.id } })}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex items-center gap-3 p-3 active:scale-[0.98] transition-all">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                {media[0] ? <BeautyImage src={media[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Scissors className="w-6 h-6 text-gray-300" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-gray-900 truncate">{s.title}</p>
                {s.category && <p className="text-[10px] text-primary font-bold">{s.category}</p>}
                <div className="flex items-center gap-2 mt-1">
                  {s.duration && <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{s.duration} min</span>}
                  <span className="text-[13px] font-black text-primary">{s.price}€</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tu pourrais aimer (produits de la page boutique) ──────────────────────────
function YouMayAlsoLike({ currentProductId }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    (async () => {
      const all = [];

      try {
        const items = await entities.Produit.filter({ status: "actif" }, "-created_at", 500).catch(() => []);
        for (const p of (items || [])) {
          if (p.id === currentProductId) continue;
          all.push({
            id: p.id,
            image_url: p.image_url || (p.images && p.images[0]) || '',
            name: p.name || '',
            brand: p.brand || '',
            price: parseFloat(p.price || 0),
            category: p.category || '',
          });
        }
      } catch {}

      try {
        const res = await fetchShopifyProducts({ first: 100 });
        const shopifyProducts = res.data?.products || [];
        for (const p of shopifyProducts) {
          if (p.id === currentProductId) continue;
          if (all.some(x => x.id === p.id)) continue;
          all.push({
            id: p.id,
            image_url: p.img || p.image_url || '',
            name: p.name || p.title || '',
            brand: p.brand || p.vendor || '',
            price: parseFloat(p.price || 0),
            category: p.category || p.productType || '',
          });
        }
      } catch {}

      if (dead) return;
      const shuffled = all.sort(() => Math.random() - 0.5);
      setProducts(shuffled);
      setLoading(false);
    })();
    return () => { dead = true; };
  }, [currentProductId]);

  if (loading || products.length === 0) return null;

  return (
    <div className="px-4 py-5">
      <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-tight mb-4">Tu pourrais aimer</h2>
      <div className="grid grid-cols-2 gap-3">
        {products.map(p => (
          <button key={p.id}
            onClick={() => navigate(`/produit?id=${encodeURIComponent(p.id)}`)}
            className="bg-white rounded-[24px] overflow-hidden shadow-sm active:scale-95 transition-all text-left border border-gray-100">
            <div className="relative h-[140px]">
              {p.image_url ? (
                <BeautyImage src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <ShoppingCart className="w-8 h-8 text-gray-200" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            <div className="p-3">
              {p.brand && <p className="text-[10px] font-black text-primary uppercase tracking-wider truncate">{p.brand}</p>}
              <p className="text-[12px] font-bold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
              <p className="text-[13px] font-black text-primary mt-1">{p.price.toFixed(2)} €</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
