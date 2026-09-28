import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { entities, uploadFile, fetchProduits } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import {
  Package, ShoppingBag, TrendingUp, Truck, Bell, Star,
  Plus, Pencil, Trash2, X, Upload, Loader2, Check,
  MessageSquare, AlertCircle, ToggleLeft, ToggleRight,
  Camera, LogOut, BarChart2, Settings, Boxes
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary";

const CATEGORIES = ["Beauté", "Soins Visage", "Cheveux", "Maquillage", "Parfums", "Ongles", "Corps", "Accessoires", "Vêtements", "Chaussures", "Alimentaire", "Hygiène", "Divers", "Grossiste"];
const EMPTY_PRODUCT = { name: "", description: "", price: "", old_price: "", stock: "", category: "Beauté", image_url: "", images: [], status: "actif", vente_type: "detail", min_qty: "", brand: "", delivery_time: "5-10 jours", free_shipping: true, return_policy: "Retour gratuit sous 30 jours. Satisfait ou remboursé." };
const DELIVERY_STATUSES = ["en_attente", "confirme", "en_preparation", "expedie", "livre", "annule"];
const STATUS_LABELS = { en_attente: "En attente", confirme: "Confirmé", en_preparation: "En préparation", expedie: "Expédié", livre: "Livré", annule: "Annulé" };



// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, subtitle, color }) {
  const colors = { primary: "bg-primary/10 text-primary", green: "bg-green-100 text-green-600", amber: "bg-amber-100 text-amber-600", blue: "bg-blue-100 text-blue-600" };
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color] || colors.primary}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-gray-500 text-[11px] font-medium">{label}</p>
        <p className="text-gray-900 text-[20px] font-black leading-tight">{value ?? "–"}</p>
        {subtitle && <p className="text-gray-400 text-[10px]">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab({ vendeurEmail }) {
  // Affichage direct depuis le cache : première peinture avec les derniers
  // produits connus, rafraîchissement réseau en arrière-plan sans vider l'affichage.
  const cacheKey = vendeurEmail ? `vendeur_${vendeurEmail}` : null;
  const [products, setProducts] = useCachedState(cacheKey, [], c => c?.productsDetail || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const items = await fetchProduits({});
    const filtered = items.filter(p =>
      p.pro_email === vendeurEmail || p.tags?.includes(`vendeur_${vendeurEmail}`)
    );
    setProducts(filtered);
    mergePageCache(cacheKey, { productsDetail: filtered });
    setLoading(false);
  };

  const uploadImg = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, image_url: f.image_url || file_url, images: [...f.images, file_url] }));
    }
    setUploading(false);
    e.target.value = "";
  };

  const save = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      const isGrossiste = form.vente_type === "grossiste";
      const tags = ["vendeur", `vendeur_${vendeurEmail}`];
      if (isGrossiste) tags.push("grossiste");
      else tags.push("livraison_express");
      const data = {
        name: form.name, description: form.description,
        price: parseFloat(form.price), old_price: form.old_price ? parseFloat(form.old_price) : null,
        stock: parseInt(form.stock) || 0, category: form.category,
        image_url: form.image_url, images: form.images,
        external_url: form.external_url, status: form.status,
        tags, pro_email: vendeurEmail,
        min_qty: isGrossiste && form.min_qty ? parseInt(form.min_qty) : null,
        brand: form.brand, delivery_time: form.delivery_time,
        free_shipping: form.free_shipping, return_policy: form.return_policy,
      };
      if (editId) await entities.Produit.update(editId, data);
      else await entities.Produit.create(data);
      await loadProducts();
      setShowForm(false); setEditId(null); setForm({ ...EMPTY_PRODUCT });
    } catch (err) {
      console.error("[VendeurDashboard] save error:", err);
      alert("Erreur lors de la création: " + (err.message || "Erreur inconnue"));
    }
    setSaving(false);
  };

  const handleEdit = (p) => {
    setForm({ name: p.name, description: p.description || "", price: p.price?.toString(), old_price: p.old_price?.toString() || "", stock: p.stock?.toString(), category: p.category, image_url: p.image_url || "", images: p.images || [], external_url: p.external_url || "", status: p.status, vente_type: p.tags?.includes("grossiste") ? "grossiste" : "detail", min_qty: p.min_qty?.toString() || "", brand: p.brand || "", delivery_time: p.delivery_time || "5-10 jours", free_shipping: p.free_shipping !== false, return_policy: p.return_policy || "Retour gratuit sous 30 jours. Satisfait ou remboursé." });
    setEditId(p.id); setShowForm(true);
  };

  const toggleStatus = async (p) => {
    const s = p.status === "actif" ? "inactif" : "actif";
    await entities.Produit.update(p.id, { status: s });
    const next = products.map(x => x.id === p.id ? { ...x, status: s } : x);
    setProducts(next);
    mergePageCache(cacheKey, { productsDetail: next });
  };

  const deleteProduct = async (id) => {
    if (!confirm("Archiver ce produit ?")) return;
    await entities.Produit.update(id, { status: "inactif" });
    const next = products.filter(p => p.id !== id);
    setProducts(next);
    mergePageCache(cacheKey, { productsDetail: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-gray-500 text-[13px]">{products.length} produit(s)</p>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm({ ...EMPTY_PRODUCT }); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-[13px] font-black">
          <Plus className="w-4 h-4" /> Nouveau produit
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-900 text-[15px]">{editId ? "Modifier" : "Nouveau produit"}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Nom *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Sérum Vitamine C" /></div>
            <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Prix (€) *</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inputCls} placeholder="29.99" /></div>
            <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Ancien prix</label>
              <input type="number" value={form.old_price} onChange={e => setForm(f => ({ ...f, old_price: e.target.value }))} className={inputCls} placeholder="49.99" /></div>
            <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Stock</label>
              <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className={inputCls} placeholder="10" /></div>
            <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
          {/* Infos livraison & boutique */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Livraison & Boutique</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Marque / Boutique</label>
                <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={inputCls} placeholder="Ex: MORE FACE HairBeauty" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Délai de livraison</label>
                <input value={form.delivery_time} onChange={e => setForm(f => ({ ...f, delivery_time: e.target.value }))} className={inputCls} placeholder="Ex: 5-10 jours" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-gray-700">Livraison gratuite</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, free_shipping: !f.free_shipping }))}
                className={`w-11 h-6 rounded-full transition-all ${form.free_shipping ? "bg-primary" : "bg-gray-300"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-all ${form.free_shipping ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Politique de retour</label>
              <textarea value={form.return_policy} onChange={e => setForm(f => ({ ...f, return_policy: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Ex: Retour gratuit sous 30 jours..." />
            </div>
          </div>
          {/* Type de vente */}
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Type de vente</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, vente_type: "detail" }))}
                className={`py-3 rounded-xl text-[12px] font-black border-2 transition-all ${form.vente_type !== "grossiste" ? "border-primary bg-orange-50 text-primary" : "border-gray-200 text-gray-500"}`}>
                🛍 Vente au détail
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, vente_type: "grossiste" }))}
                className={`py-3 rounded-xl text-[12px] font-black border-2 transition-all ${form.vente_type === "grossiste" ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500"}`}>
                📦 Grossiste
              </button>
            </div>
            {form.vente_type === "grossiste" && (
              <div className="mt-3">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Quantité minimum de commande</label>
                <input type="number" value={form.min_qty} onChange={e => setForm(f => ({ ...f, min_qty: e.target.value }))} className={inputCls} placeholder="Ex: 10" />
                <p className="text-[10px] text-blue-600 font-medium mt-1">Ce produit apparaîtra dans la section Grossiste de la boutique.</p>
              </div>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-blue-700 text-[11px] font-bold">ℹ️ Sans lien externe, votre produit aura sa propre page détail avec paiement BeautyBook. Les clients pourront l'acheter directement.</p>
          </div>
          {/* Images */}
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Photos produit</label>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadImg} />
            {form.images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {form.images.map((url, i) => (
                  <div key={i} className="relative">
                    <BeautyImage src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i), image_url: i === 0 ? (f.images[1] || "") : f.image_url }))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" /></button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => imgRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[13px]">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Upload..." : "Ajouter des photos"}
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editId ? "Modifier" : "Créer"}
            </button>
            <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </div>
      )}

      {loading && products.length === 0 ? <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        : products.length === 0 ? <div className="flex flex-col items-center py-16 gap-3"><Package className="w-12 h-12 text-gray-200" /><p className="text-gray-400 text-[14px]">Aucun produit</p></div>
        : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {p.image_url ? <BeautyImage src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-gray-300 m-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-gray-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-gray-500">{p.price}€ · Stock: {p.stock ?? "–"}</p>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.status === "actif" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>{p.status}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleStatus(p)} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
                    {p.status === "actif" ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => handleEdit(p)} className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Pencil className="w-4 h-4 text-blue-500" />
                  </button>
                  <button onClick={() => deleteProduct(p.id)} className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Orders Tab ───────────────────────────────────────────────────────────────
function OrdersTab() {
  // L'email vendeur vient de la session (pas de prop ici) : clé de cache stable.
  const sessEmail = sessionStorage.getItem("bb_vendeur_email");
  const cacheKey = sessEmail ? `vendeur_${sessEmail}` : null;
  const [orders, setOrders] = useCachedState(cacheKey, [], c => c?.orders || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [selected, setSelected] = useState(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef(null);

  useEffect(() => {
    entities.Commande.list("-created_at", 100).then(data => {
      setOrders(data);
      mergePageCache(cacheKey, { orders: data || [] });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id, status, trackingNumber = "", delivery_photo = "") => {
    const data = { status };
    if (trackingNumber) data.tracking_number = trackingNumber;
    if (delivery_photo) data.notes = `[LIVRAISON_PHOTO]:${delivery_photo}`;
    await entities.Commande.update(id, data);
    const next = orders.map(o => o.id === id ? { ...o, status, tracking_number: trackingNumber || o.tracking_number } : o);
    setOrders(next);
    mergePageCache(cacheKey, { orders: next });
    setSelected(null);
  };

  const uploadDeliveryPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await uploadFile({ file });
    setPhoto(file_url);
    setUploading(false);
    e.target.value = "";
  };

  const STATUS_COLORS = {
    en_attente: "bg-yellow-100 text-yellow-700",
    confirme: "bg-blue-100 text-blue-700",
    en_preparation: "bg-purple-100 text-purple-700",
    expedie: "bg-orange-100 text-orange-700",
    livre: "bg-green-100 text-green-700",
    annule: "bg-red-100 text-red-700",
  };

  if (loading && orders.length === 0) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-gray-500 text-[13px]">{orders.length} commande(s)</p>
      {orders.length === 0
        ? <div className="flex flex-col items-center py-16 gap-3"><ShoppingBag className="w-12 h-12 text-gray-200" /><p className="text-gray-400">Aucune commande</p></div>
        : orders.map(o => (
          <div key={o.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[14px] font-black text-gray-900">{o.client_name || o.client_email}</p>
                <p className="text-[11px] text-gray-500">{o.items?.length || 0} article(s) · {o.total}€</p>
              </div>
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-500"}`}>
                {STATUS_LABELS[o.status] || o.status}
              </span>
            </div>
            {o.shipping_address && <p className="text-[11px] text-gray-400 mb-3">📍 {o.shipping_address}</p>}
            {o.tracking_number && <p className="text-[11px] text-primary font-black mb-2">📦 Suivi: {o.tracking_number}</p>}
            
            <div className="flex gap-2 flex-wrap">
              {DELIVERY_STATUSES.filter(s => s !== o.status).slice(0, 4).map(s => (
                <button key={s} onClick={() => setSelected({ order: o, nextStatus: s })}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                  → {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        ))
      }

      {/* Order update modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-900">Mettre à jour la commande</h3>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-[13px] text-gray-600">Changer le statut vers : <strong>{STATUS_LABELS[selected.nextStatus]}</strong></p>
            
            {selected.nextStatus === "expedie" && (
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Numéro de suivi (optionnel)</label>
                <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="Ex: FR123456789" className={inputCls} />
              </div>
            )}
            
            {selected.nextStatus === "livre" && (
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Photo de livraison (preuve)</label>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadDeliveryPhoto} />
                {photo ? (
                  <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3 border border-green-200">
                    <BeautyImage src={photo} alt="livraison" className="w-16 h-12 rounded-lg object-cover" />
                    <span className="text-green-600 text-[12px] font-bold flex-1">✓ Photo ajoutée</span>
                    <button onClick={() => setPhoto("")} className="text-gray-400 text-[11px]">Retirer</button>
                  </div>
                ) : (
                  <button onClick={() => photoRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[13px]">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {uploading ? "Upload..." : "Ajouter une photo de livraison"}
                  </button>
                )}
              </div>
            )}
            
            <div className="flex gap-3">
              <button onClick={() => { setSelected(null); setTrackingInput(""); setPhoto(""); }}
                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
              <button onClick={() => updateStatus(selected.order.id, selected.nextStatus, trackingInput, photo)}
                className="flex-1 bg-primary text-white py-3 rounded-xl text-[13px] font-black">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!email || !message) return;
    setSending(true);
    try {
      await entities.Notification.create({
        user_email: email,
        title: "Mise à jour de votre commande - BeautyBook",
        body: message,
        read: false
      });
    } catch (e) {
      console.error('[NotificationsTab.send]', e);
    }
    setSending(false); setSent(true);
    setTimeout(() => setSent(false), 3000);
    setEmail(""); setMessage("");
  };

  return (
    <div className="space-y-4 max-w-md">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-blue-700 text-[12px] font-bold">📧 Envoyez une notification de livraison à un client par email.</p>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4 shadow-sm">
        <h3 className="font-black text-gray-900 text-[14px]">Notification client</h3>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email du client" className={inputCls} />
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Votre colis a été expédié. Numéro de suivi : ..." rows={4}
          className={`${inputCls} resize-none`} />
        <button onClick={send} disabled={sending || !email || !message}
          className="w-full bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          {sent ? "✓ Envoyé !" : "Envoyer"}
        </button>
      </div>
    </div>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────
function StatsTab({ products, orders }) {
  const totalRevenue = orders.filter(o => o.status !== "annule").reduce((s, o) => s + (o.total || 0), 0);
  const pending = orders.filter(o => o.status === "en_attente").length;
  const delivered = orders.filter(o => o.status === "livre").length;
  const activeProducts = products.filter(p => p.status === "actif").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Package} label="Produits actifs" value={activeProducts} color="primary" />
        <StatCard icon={ShoppingBag} label="Commandes" value={orders.length} color="blue" />
        <StatCard icon={TrendingUp} label="CA estimé" value={`${Math.round(totalRevenue)}€`} color="green" />
        <StatCard icon={Truck} label="Livrées" value={delivered} subtitle={`${pending} en attente`} color="amber" />
      </div>
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <h3 className="text-[14px] font-black text-gray-900 mb-4">Statut des commandes</h3>
        {Object.entries(STATUS_LABELS).map(([key, label]) => {
          const count = orders.filter(o => o.status === key).length;
          const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
          return (
            <div key={key} className="mb-3">
              <div className="flex justify-between text-[12px] mb-1">
                <span className="font-medium text-gray-600">{label}</span>
                <span className="font-black text-gray-900">{count}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Paiements Tab (Stripe Connect) ───────────────────────────────────────────
function PaiementsTab({ vendeurEmail }) {
  const cacheKey = vendeurEmail ? `vendeur_${vendeurEmail}` : null;
  // stripeId : valeur enregistrée (cache) ; input : champ du formulaire pré-rempli depuis le cache.
  const [stripeId, setStripeId] = useCachedState(cacheKey, "", c => c?.stripeId || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState(() => readPageCache(cacheKey)?.stripeId || "");
  const [configId, setConfigId] = useCachedState(cacheKey, null, c => c?.stripeConfigId ?? null);

  useEffect(() => {
    const key = `vendeur_stripe_${vendeurEmail}`;
    entities.AppConfig.filter({ key }, "-created_at", 50)
      .then(rows => {
        if (rows[0]?.value?.stripeId) {
          const sid = rows[0].value.stripeId;
          setStripeId(sid);
          setInput(sid);
          setConfigId(rows[0].id);
          mergePageCache(cacheKey, { stripeId: sid, stripeConfigId: rows[0].id });
        }
      }).catch(() => {});
  }, [vendeurEmail]);

  const save = async () => {
    if (!input) return;
    setSaving(true);
    const key = `vendeur_stripe_${vendeurEmail}`;
    if (configId) {
      await entities.AppConfig.update(configId, { value: { stripeId: input } });
    } else {
      const created = await entities.AppConfig.create({ key, value: { stripeId: input } });
      setConfigId(created.id);
      mergePageCache(cacheKey, { stripeConfigId: created.id });
    }
    setStripeId(input);
    mergePageCache(cacheKey, { stripeId: input });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Simuler les reversements à venir
  const mockReversal = [
    { date: "08/06/2026", montant: 47.60, statut: "en_attente", produit: "Sérum Vitamine C" },
    { date: "05/06/2026", montant: 23.90, statut: "vire", produit: "Huile Barbe Bio" },
    { date: "01/06/2026", montant: 89.00, statut: "vire", produit: "Coffret Soin" },
  ];

  return (
    <div className="space-y-5 max-w-md">
      {/* Explication */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
        <p className="text-[14px] font-black text-gray-900 mb-2">💳 Comment fonctionne le paiement ?</p>
        <ol className="space-y-1.5">
          {[
            "Le client paye via la page produit BeautyBook (Stripe sécurisé)",
            "Le montant est encaissé par BeautyBook d'abord",
            "BeautyBook vous reverse votre part sous 7 jours ouvrés",
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-gray-600">
              <span className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {/* Compte Stripe */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stripeId ? "bg-green-100" : "bg-gray-100"}`}>
            <Check className={`w-5 h-5 ${stripeId ? "text-green-600" : "text-gray-400"}`} />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-gray-900">Compte Stripe</h3>
            <p className={`text-[11px] font-medium ${stripeId ? "text-green-600" : "text-gray-400"}`}>
              {stripeId ? "Connecté — reversements activés" : "Non connecté — reversements en attente"}
            </p>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Votre Stripe Account ID</label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="acct_xxxxxxxxxxxx"
            className={inputCls}
          />
          <p className="text-[10px] text-gray-400 mt-1 font-medium">Trouvez votre ID sur dashboard.stripe.com → Paramètres → Compte</p>
        </div>
        <button
          onClick={save}
          disabled={!input || saving}
          className="w-full bg-primary text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde...</>
            : saved ? <><Check className="w-4 h-4" /> Sauvegardé !</>
            : "Enregistrer mon compte Stripe"}
        </button>
      </div>

      {/* Historique reversements */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <h3 className="text-[14px] font-black text-gray-900 mb-4">Historique des reversements</h3>
        <div className="space-y-3">
          {mockReversal.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-[12px] font-black text-gray-900">{r.produit}</p>
                <p className="text-[10px] text-gray-400">{r.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-black text-gray-900">{r.montant}€</span>
                <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${r.statut === "vire" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                  {r.statut === "vire" ? "Viré" : "En attente"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Grossiste Tab ─────────────────────────────────────────────────────────────
function GrossisteTab({ vendeurEmail }) {
  const cacheKey = vendeurEmail ? `vendeur_${vendeurEmail}` : null;
  const [products, setProducts] = useCachedState(cacheKey, [], c => c?.productsGrossiste || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT, vente_type: "grossiste", category: "Grossiste" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const items = await fetchProduits({});
    const filtered = items.filter(p =>
      (p.pro_email === vendeurEmail && (p.category === 'Grossiste' || p.tags?.includes('grossiste'))) ||
      (p.tags?.includes('grossiste') && p.tags?.includes(`vendeur_${vendeurEmail}`))
    );
    setProducts(filtered);
    mergePageCache(cacheKey, { productsGrossiste: filtered });
    setLoading(false);
  };

  const uploadImg = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, image_url: f.image_url || file_url, images: [...f.images, file_url] }));
    }
    setUploading(false);
    e.target.value = "";
  };

  const save = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      const data = {
        name: form.name, description: form.description,
        price: parseFloat(form.price), old_price: form.old_price ? parseFloat(form.old_price) : null,
        stock: parseInt(form.stock) || 0, category: form.category || "Grossiste",
        image_url: form.image_url, images: form.images,
        status: "actif", tags: ["vendeur", "grossiste", `vendeur_${vendeurEmail}`],
        min_qty: form.min_qty ? parseInt(form.min_qty) : null,
        pro_email: vendeurEmail,
      };
      if (editId) await entities.Produit.update(editId, data);
      else await entities.Produit.create(data);
      await loadProducts();
      setShowForm(false); setEditId(null); setForm({ ...EMPTY_PRODUCT, vente_type: "grossiste", category: "Grossiste" });
    } catch (err) {
      console.error("[GrossisteTab] save error:", err);
      alert("Erreur lors de la création: " + (err.message || "Erreur inconnue"));
    }
    setSaving(false);
  };

  const handleEdit = (p) => {
    setForm({ name: p.name, description: p.description || "", price: p.price?.toString(), old_price: p.old_price?.toString() || "", stock: p.stock?.toString() || "", category: p.category || "Grossiste", image_url: p.image_url || "", images: p.images || [], vente_type: "grossiste", min_qty: p.min_qty?.toString() || "" });
    setEditId(p.id); setShowForm(true);
  };

  const deleteProduct = async (id) => {
    if (!confirm("Archiver ce produit grossiste ?")) return;
    await entities.Produit.update(id, { status: "inactif" });
    const next = products.filter(p => p.id !== id);
    setProducts(next);
    mergePageCache(cacheKey, { productsGrossiste: next });
  };

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-[14px] font-black text-blue-800 mb-1">📦 Espace Grossiste</p>
        <p className="text-[12px] text-blue-600">Les produits ici apparaissent dans la section <strong>Grossiste</strong> de la boutique. Définissez une quantité minimum de commande.</p>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-gray-500 text-[13px]">{products.length} produit(s) grossiste</p>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm({ ...EMPTY_PRODUCT, vente_type: "grossiste", category: "Grossiste" }); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl text-[13px] font-black">
          <Plus className="w-4 h-4" /> Ajouter grossiste
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-5 border-2 border-blue-200 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-blue-700 text-[15px]">📦 {editId ? "Modifier" : "Nouveau produit grossiste"}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Nom du produit *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Huile Argan Bio (lot 12)" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Prix unitaire (€) *</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inputCls} placeholder="9.99" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Qté min. commande</label>
              <input type="number" value={form.min_qty} onChange={e => setForm(f => ({ ...f, min_qty: e.target.value }))} className={inputCls} placeholder="Ex: 10" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Stock disponible</label>
              <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className={inputCls} placeholder="100" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
          </div>
          {/* Images */}
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Photos produit</label>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadImg} />
            {form.images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {form.images.map((url, i) => (
                  <div key={i} className="relative">
                    <BeautyImage src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i), image_url: i === 0 ? (f.images[1] || "") : f.image_url }))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" /></button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => imgRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl py-3 text-gray-400 text-[13px]">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Upload..." : "Ajouter des photos"}
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[13px] font-black disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editId ? "Modifier" : "Créer"}
            </button>
            <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-[13px] font-black">Annuler</button>
          </div>
        </div>
      )}

      {loading && products.length === 0 ? <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>
        : products.length === 0
        ? <div className="flex flex-col items-center py-16 gap-3"><Package className="w-12 h-12 text-gray-200" /><p className="text-gray-400 text-[14px]">Aucun produit grossiste</p><p className="text-gray-300 text-[12px] text-center">Ajoutez des produits qui apparaîtront dans la section Grossiste de la boutique</p></div>
        : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 border-2 border-blue-100 flex items-center gap-4 shadow-sm">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-blue-50 shrink-0">
                  {p.image_url ? <BeautyImage src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-blue-200 m-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-gray-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-blue-600 font-bold">{p.price}€/unité · Min. {p.min_qty || "?"} unités</p>
                  <p className="text-[10px] text-gray-400">Stock: {p.stock ?? "–"} · {p.category}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleEdit(p)} className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Pencil className="w-4 h-4 text-blue-500" />
                  </button>
                  <button onClick={() => deleteProduct(p.id)} className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Reclamations Tab ─────────────────────────────────────────────────────────
function ReclamationsTab() {
  const sessEmail = sessionStorage.getItem("bb_vendeur_email");
  const cacheKey = sessEmail ? `vendeur_${sessEmail}` : null;
  const [avis, setAvis] = useCachedState(cacheKey, [], c => c?.avis || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));

  useEffect(() => {
    entities.Avis.list("-created_at", 50).then(data => {
      setAvis(data);
      mergePageCache(cacheKey, { avis: data || [] });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const negativeAvis = avis.filter(a => a.note <= 3);

  if (loading && avis.length === 0) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-amber-700 text-[12px] font-bold">⚠️ {negativeAvis.length} avis négatif(s) (note ≤ 3). Traitez-les en priorité.</p>
      </div>
      {avis.length === 0
        ? <div className="flex flex-col items-center py-16 gap-3"><MessageSquare className="w-12 h-12 text-gray-200" /><p className="text-gray-400">Aucun avis</p></div>
        : avis.map(a => (
          <div key={a.id} className={`bg-white rounded-2xl p-4 border shadow-sm ${a.note <= 3 ? "border-red-200" : "border-gray-200"}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[13px] font-black text-gray-900">{a.auteur_nom || a.auteur_email}</p>
                <p className="text-[11px] text-gray-500">{a.service_nom}</p>
              </div>
              <div className="flex">
                {[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= a.note ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />)}
              </div>
            </div>
            <p className="text-[13px] text-gray-600 leading-snug">{a.commentaire}</p>
            {a.note <= 3 && <div className="mt-2 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-[11px] text-red-600 font-bold">Nécessite une réponse</span></div>}
          </div>
        ))
      }
    </div>
  );
}

// ── Main Vendeur Dashboard ───────────────────────────────────────────────────
export default function VendeurDashboard() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(sessionStorage.getItem("bb_vendeur_email") || null);
  const [activeTab, setActiveTab] = useState("stats");
  // Stats du dashboard : affichage direct depuis le cache, refresh en arrière-plan.
  const cacheKey = auth ? `vendeur_${auth}` : null;
  const [products, setProducts] = useCachedState(cacheKey, [], c => c?.statsProducts || []);
  const [orders, setOrders] = useCachedState(cacheKey, [], c => c?.statsOrders || []);

  useEffect(() => {
    if (!auth) {
      navigate("/vendeur/login");
      return;
    }
    fetchProduits({}).then(items => {
      const filtered = items.filter(p => p.tags?.includes(`vendeur_${auth}`));
      setProducts(filtered);
      mergePageCache(cacheKey, { statsProducts: filtered });
    }).catch(() => {});
    entities.Commande.list("-created_at", 100).then(data => {
      setOrders(data);
      mergePageCache(cacheKey, { statsOrders: data || [] });
    }).catch(() => {});
  }, [auth, navigate]);

  if (!auth) return null;

  const TABS = [
    { id: "stats", label: "Dashboard", icon: BarChart2 },
    { id: "products", label: "Produits", icon: Package },
    { id: "grossiste", label: "Grossiste", icon: Boxes },
    { id: "orders", label: "Commandes", icon: ShoppingBag },
    { id: "paiements", label: "Paiements", icon: Settings },
    { id: "notifications", label: "Notifs", icon: Bell },
    { id: "reclamations", label: "Avis", icon: Star },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-display">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-gray-900 text-[15px] font-black leading-tight">Espace Vendeur</h1>
            <p className="text-gray-400 text-[10px]">{auth}</p>
          </div>
        </div>
        <button onClick={() => { sessionStorage.removeItem("bb_vendeur_email"); supabase.auth.signOut(); setAuth(null); navigate("/vendeur/login"); }}
          className="flex items-center gap-1.5 text-red-500 text-[12px] font-black">
          <LogOut className="w-4 h-4" /> Quitter
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="flex px-4 min-w-max">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[12px] font-black border-b-2 transition-all shrink-0 ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-gray-400"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="p-4 max-w-2xl mx-auto">
        {activeTab === "stats" && <StatsTab products={products} orders={orders} />}
        {activeTab === "products" && <ProductsTab vendeurEmail={auth} />}
        {activeTab === "grossiste" && <GrossisteTab vendeurEmail={auth} />}
        {activeTab === "orders" && <OrdersTab />}
        {activeTab === "paiements" && <PaiementsTab vendeurEmail={auth} />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "reclamations" && <ReclamationsTab />}
      </main>
    </div>
  );
}