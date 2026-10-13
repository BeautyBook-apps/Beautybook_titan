import BeautyImage from '@/components/ui/BeautyImage';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, LoaderCircle, Minus, Package, Plus, RefreshCw, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { supabase } from '@/api/supabaseClient';
import { createShopifyCheckout } from '@/api/shopifyClient';
import { useTheme } from '@/hooks/useTheme';
import './Recherche.css';
import './Panier.css';

const money = (value) => Number(value || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const isBeautyBookProduct = (id) => /^[a-f0-9-]{36}$/i.test(String(id || ''));
const localItems = () => { try { return JSON.parse(localStorage.getItem('bb_local_cart') || '[]'); } catch { return []; } };

function saveLocal(rows) {
  localStorage.setItem('bb_local_cart', JSON.stringify(rows));
}

export default function Panier() {
  const navigate = useNavigate();
  useTheme();
  const [items, setItems] = useState(() => localItems());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => localItems().length === 0);
  const [busy, setBusy] = useState(null);
  const [guest, setGuest] = useState(false);

  function save(rows, localRows = null) {
    setItems(rows);
    localStorage.setItem('bb_cart_count', String(rows.length));
    if (localRows) saveLocal(localRows);
    window.dispatchEvent(new Event('bb-cart-updated'));
  }

  async function load() {
    const cached = localItems();
    if (cached.length) setItems(cached);
    setLoading(!cached.length);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setGuest(!session);
      if (!session) {
        save(cached, cached);
        return;
      }

      // Shopify variants are intentionally kept locally: the BeautyBook API
      // only accepts UUID product IDs. Native BeautyBook products are merged
      // into the authenticated server cart below.
      const nativeItems = cached.filter((item) => isBeautyBookProduct(item.produit_id));
      const partnerItems = cached.filter((item) => !isBeautyBookProduct(item.produit_id));

      // A Shopify-only cart is already authoritative in local storage. Do not
      // call the BeautyBook cart endpoint in that case: it only accepts native
      // UUID products and would turn an otherwise usable cart into a 500 UI.
      if (!nativeItems.length && partnerItems.length) {
        save(cached, partnerItems);
        return;
      }

      for (const item of nativeItems) {
        await apiClient.post('/cart', { action: 'merge', item: { produit_id: item.produit_id, quantity: item.quantity } });
      }
      const remote = (await apiClient.get('/cart')).panier?.items || [];
      save([...remote, ...partnerItems], partnerItems);
    } catch (err) {
      // Keep cached products visible if the API is temporarily unavailable.
      if (!cached.length) setError(err.message || 'Le serveur n’a pas pu terminer cette opération.');
      save(cached, cached);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function update(action, item) {
    const id = item.produit_id;
    setBusy(id);
    setError('');
    try {
      const local = localItems();
      if (guest || !isBeautyBookProduct(id)) {
        const next = action === 'remove'
          ? items.filter((row) => row.produit_id !== id)
          : items.map((row) => row.produit_id === id ? { ...row, quantity: Math.max(1, row.quantity + (action === 'increment' ? 1 : -1)) } : row);
        save(next, next.filter((row) => !isBeautyBookProduct(row.produit_id)));
        return;
      }
      const remote = (await apiClient.post('/cart', { action, item: { produit_id: id } })).panier?.items || [];
      const partnerItems = local.filter((row) => !isBeautyBookProduct(row.produit_id));
      save([...remote, ...partnerItems], partnerItems);
    } catch (err) {
      setError(err.message || 'Impossible de modifier le panier.');
    } finally {
      setBusy(null);
    }
  }

  async function checkout() {
    if (guest) {
      navigate('/login?redirect=/panier');
      return;
    }
    const partnerItems = items.filter((item) => !isBeautyBookProduct(item.produit_id));
    const beautyBookItems = items.filter((item) => isBeautyBookProduct(item.produit_id));
    if (partnerItems.length && beautyBookItems.length) {
      setError('Sélectionnez séparément les produits partenaires et BeautyBook pour finaliser le paiement.');
      return;
    }
    if (partnerItems.length === 1) {
      const item = partnerItems[0];
      setBusy(item.produit_id);
      setError('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { checkoutUrl } = await createShopifyCheckout({
          variantId: item.variant_id || item.produit_id,
          quantity: item.quantity,
          email: session?.user?.email,
          countryCode: 'FR',
        });
        // Ouvrir directement le paiement évite d’afficher une page de sas
        // locale dans le parcours normal de l’utilisateur.
        window.location.replace(checkoutUrl);
      } catch (err) {
        setError(err.message || 'Impossible de préparer le paiement.');
      } finally {
        setBusy(null);
      }
      return;
    }
    navigate('/checkout');
  }

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0), [items]);
  const unavailable = items.some((item) => item.available === false);

  return <div className="discovery-page basket-page font-display">
    <header className="discovery-hero basket-hero">
      <div className="discovery-topline"><span className="discovery-eyebrow"><span className="pulse-dot" />VOTRE ESPACE BOUTIQUE</span><span className="discovery-brand">BeautyBook<span className="brand-dot">.</span></span></div>
      <div className="discovery-heading"><div><h1>Votre panier<br /><em>prêt à partir.</em></h1><p>Retrouvez vos produits et finalisez votre commande en toute simplicité.</p></div><div className="basket-badge"><ShoppingBag size={20} /><strong>{items.length}</strong><span>article{items.length > 1 ? 's' : ''}</span></div></div>
    </header>

    <main className="discovery-body basket-body">
      {error ? <div className="basket-alert" role="alert"><RefreshCw size={19} /><div><strong>Une petite interruption</strong><p>{error}</p><button onClick={load}>Réessayer</button></div></div> : null}
      {loading && items.length === 0 ? <div className="basket-empty basket-loading" role="status"><LoaderCircle className="spin" size={34} /><h2>Synchronisation de votre panier…</h2><p>Nous récupérons vos articles.</p></div> : items.length === 0 ? <div className="basket-empty"><span className="basket-empty-icon"><ShoppingBag size={40} /></span><p className="discovery-eyebrow">VOTRE SÉLECTION</p><h2>Votre panier est vide</h2><p>Explorez la boutique et ajoutez vos produits préférés.</p><button className="discovery-primary" onClick={() => navigate('/boutique')}>Découvrir la boutique <ChevronRight size={18} /></button></div> : <div className="basket-layout">
        <section className="basket-items" aria-labelledby="basket-title"><div className="basket-section-head"><div><p className="discovery-eyebrow"><Package size={14} /> MA SÉLECTION</p><h2 id="basket-title">Vos articles <span>{items.length} disponible{items.length > 1 ? 's' : ''}</span></h2></div><button className="basket-refresh" onClick={load} aria-label="Actualiser le panier"><RefreshCw size={17} /></button></div>{guest ? <div className="basket-note"><Check size={18} />Votre sélection est conservée sur cet appareil. Connectez-vous pour la synchroniser.</div> : null}{items.map((item) => <article className="basket-item" key={item.produit_id}><div className="basket-item-image">{item.image_url ? <BeautyImage src={item.image_url} alt="" /> : <Package size={25} />}</div><div className="basket-item-content"><div className="basket-item-top"><div><p className="basket-item-brand">{item.brand || (item.shopify ? 'Boutique partenaire' : 'BeautyBook')}</p><h3>{item.name || 'Produit'}</h3>{item.variant ? <p className="basket-item-variant">{item.variant}</p> : null}</div><strong>{item.price == null ? '—' : money(Number(item.price) * Number(item.quantity))}</strong></div>{item.available === false ? <p className="basket-unavailable">Produit indisponible dans cette quantité.</p> : null}<div className="basket-item-bottom"><div className="basket-quantity"><button aria-label={`Diminuer la quantité de ${item.name}`} disabled={busy === item.produit_id || item.quantity <= 1} onClick={() => update('decrement', item)}><Minus size={16} /></button><span>{item.quantity}</span><button aria-label={`Augmenter la quantité de ${item.name}`} disabled={busy === item.produit_id} onClick={() => update('increment', item)}><Plus size={16} /></button></div><button className="basket-delete" aria-label={`Retirer ${item.name}`} disabled={busy === item.produit_id} onClick={() => update('remove', item)}><Trash2 size={17} /> Retirer</button></div></div></article>)}</section>
        <aside className="basket-summary"><p className="discovery-eyebrow"><Truck size={14} /> COMMANDE SÉCURISÉE</p><h2>Récapitulatif</h2><div className="basket-summary-line"><span>Sous-total</span><strong>{money(subtotal)}</strong></div><div className="basket-summary-line"><span>Livraison</span><span className="basket-muted">Calculée à l’étape suivante</span></div><div className="basket-summary-total"><span>Total estimé</span><strong>{money(subtotal)}</strong></div><button className="discovery-primary basket-checkout" disabled={Boolean(busy) || unavailable} onClick={checkout}>{items.some((item) => item.shopify) ? 'Finaliser ma commande' : 'Continuer vers la livraison'} <ChevronRight size={18} /></button><p className="basket-secure"><Check size={16} />Paiement sécurisé.</p></aside>
      </div>}
    </main>
  </div>;
}
