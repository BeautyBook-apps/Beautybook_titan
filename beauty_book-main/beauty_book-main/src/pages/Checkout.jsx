import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock, Package, RefreshCw, Truck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { createShopifyCheckout } from '@/api/shopifyClient';
import BrandLogo from '@/components/ui/BrandLogo';

const money = (cents) => (Number(cents || 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const countries = [['FR', 'France'], ['BE', 'Belgique'], ['LU', 'Luxembourg'], ['CH', 'Suisse'], ['DE', 'Allemagne'], ['ES', 'Espagne'], ['IT', 'Italie'], ['CA', 'Canada'], ['MA', 'Maroc'], ['SN', 'Sénégal'], ['CI', 'Côte d’Ivoire'], ['CM', 'Cameroun']];

function Field({ field, label, autoComplete, address, change, optional = false }) {
  return <label className="text-sm font-medium text-slate-700">{label}{optional ? <span className="font-normal text-slate-400"> (facultatif)</span> : null}<input className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" autoComplete={autoComplete} type={field === 'phone' ? 'tel' : 'text'} required={!optional} maxLength={160} value={address[field] || ''} onChange={(event) => change(field, event.target.value)} /></label>;
}

function FrenchAddressField({ address, change, suggestions, chooseSuggestion, addressLoading }) {
  return <label className="relative text-sm font-medium text-slate-700 sm:col-span-2">Adresse
    <input className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" autoComplete="address-line1" required maxLength={160} value={address.address1 || ''} onChange={(event) => change('address1', event.target.value)} />
    {addressLoading ? <span className="absolute right-3 top-9 text-xs text-slate-400">Recherche…</span> : null}
    {suggestions.length ? <div role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{suggestions.map((suggestion) => <button type="button" role="option" key={suggestion.id} className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-orange-50" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}><strong className="block">{suggestion.label}</strong><span className="text-slate-500">{suggestion.context}</span></button>)}</div> : null}
  </label>;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [shopifyRetry, setShopifyRetry] = useState(0);
  const [address, setAddress] = useState({ firstName: '', lastName: '', address1: '', address2: '', city: '', zip: '', country: 'FR', phone: '' });
  const productId = params.get('productId');
  const variantId = params.get('variantId');
  const isShopify = Boolean(variantId);
  const quantity = Math.max(1, Number(params.get('quantity')) || 1);
  const checkoutKey = useRef(null);
  const shopifyRedirectStarted = useRef(false);
  const shopifyProduct = { title: params.get('title') || 'Produit', variant: params.get('variant') || '', brand: params.get('brand') || 'Boutique partenaire', image: params.get('img') || '', unitPrice: Number(params.get('price')) || 0 };

  useEffect(() => {
    if (!isShopify || shopifyRedirectStarted.current) return undefined;
    shopifyRedirectStarted.current = true;
    let alive = true;
    setBusy(true);
    setError('');
    // Shopify doit afficher son checkout natif (adresse, livraison, total et
    // paiement). La page locale sert uniquement de sas de redirection.
    createShopifyCheckout({
      variantId,
      quantity,
      email: user?.email,
      countryCode: 'FR',
    }).then(({ checkoutUrl }) => {
      if (alive) window.location.replace(checkoutUrl);
    }).catch((err) => {
      if (alive) setError(err.message || 'Impossible d’ouvrir le paiement.');
    }).finally(() => {
      if (alive) setBusy(false);
    });
    return () => { alive = false; };
  }, [isShopify, variantId, quantity, user?.email, shopifyRetry]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    // Shopify owns its cart, stock and shipping quote. Its secure checkout is created after confirmation.
    if (!user || isShopify) {
      setLoading(false);
      return () => { alive = false; };
    }
    const source = productId ? Promise.resolve([{ product_id: productId, quantity }]) : apiClient.get('/cart').then((response) => response.panier?.items || []);
    source.then(async (rows) => {
      if (!rows.length) throw new Error('Votre panier est vide.');
      const clean = rows.map((item) => ({ product_id: item.product_id || item.produit_id, quantity: Math.max(1, Number(item.quantity) || 1) }));
      const nextQuote = await apiClient.post('/commerce/quote', { items: clean, country: address.country });
      if (alive) { setItems(clean); setQuote(nextQuote); }
    }).catch((err) => {
      if (alive) { setQuote(null); setError(err.message || 'Impossible de préparer la commande.'); }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id, productId, isShopify, quantity, address.country]);

  useEffect(() => {
    const query = address.address1.trim();
    if (address.country !== 'FR' || query.length < 3) {
      setSuggestions([]);
      setAddressLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressLoading(true);
      try {
        const data = await apiClient.post('/maps/places-autocomplete', { input: query }, { signal: controller.signal });
        setSuggestions((data.predictions || []).map((prediction) => ({
          id: prediction.place_id || prediction.description,
          label: prediction.description,
          street: prediction.address || prediction.description,
          postcode: prediction.postalCode || '',
          city: prediction.city || '',
          context: [prediction.postalCode, prediction.city].filter(Boolean).join(' '),
        })));
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setAddressLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [address.address1, address.country]);

  function change(field, value) {
    setAddress((current) => ({ ...current, [field]: value }));
    if (field === 'address1') setSuggestions([]);
    checkoutKey.current = null;
  }

  function chooseSuggestion(suggestion) {
    setAddress((current) => ({ ...current, address1: suggestion.street, zip: suggestion.postcode, city: suggestion.city }));
    setSuggestions([]);
    checkoutKey.current = null;
  }

  async function pay(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isShopify) {
        const result = await createShopifyCheckout({ variantId, quantity, email: user.email, countryCode: address.country, address });
        window.location.assign(result.checkoutUrl);
        return;
      }
      const body = { items, shipping_address: address, expected_total_cents: quote?.total_cents };
      const fingerprint = JSON.stringify(body);
      const storageKey = `bb_checkout_attempt_${user.id}`;
      if (!checkoutKey.current) {
        try {
          const saved = JSON.parse(sessionStorage.getItem(storageKey));
          if (saved?.fingerprint === fingerprint && Date.now() - saved.time < 35 * 60 * 1000) checkoutKey.current = saved.key;
        } catch { /* sessionStorage may be blocked by the browser */ }
      }
      checkoutKey.current ||= crypto.randomUUID();
      sessionStorage.setItem(storageKey, JSON.stringify({ key: checkoutKey.current, fingerprint, time: Date.now() }));
      const result = await apiClient.post('/payments/checkout-session', body, { headers: { 'Idempotency-Key': checkoutKey.current } });
      const target = new URL(result.checkoutUrl);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') throw new Error('Adresse de paiement Stripe invalide.');
      window.location.assign(target.href);
    } catch (err) {
      setError(err.message || 'Le serveur n’a pas pu terminer cette opération.');
      if (err.code === 'PRICE_CHANGED' && !isShopify) {
        setQuote(await apiClient.post('/commerce/quote', { items, country: address.country }).catch(() => null));
        checkoutKey.current = null;
      }
    } finally { setBusy(false); }
  }

  const shopifyTotalCents = Math.round(shopifyProduct.unitPrice * 100) * quantity;

  return <main className="min-h-full bg-[#f6f5f2] pb-28 text-slate-900">
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white p-5"><button className="rounded-full bg-slate-100 p-3 transition hover:bg-slate-200" aria-label="Retour au panier" onClick={() => navigate('/panier')}><ArrowLeft size={20} /></button><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">BeautyBook · Boutique</p><h1 className="text-2xl font-bold">Finaliser ma commande</h1></div></header>
    <div className="mx-auto max-w-3xl space-y-5 p-5">
      {isShopify ? <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><BrandLogo size={64} alt="BeautyBook" className="mx-auto mb-5 rounded-2xl shadow-lg shadow-orange-500/20" /><p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">BeautyBook · Boutique</p><h2 className="mt-3 text-2xl font-bold">Préparation de votre commande…</h2><p className="mt-3 text-slate-600">Un instant, votre espace de paiement sécurisé se prépare.</p>{busy ? <RefreshCw className="mx-auto mt-6 animate-spin text-orange-500" size={24} /> : null}{error ? <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-red-800"><p>{error}</p><button type="button" className="mt-3 font-semibold underline" onClick={() => { shopifyRedirectStarted.current = false; setError(''); setShopifyRetry((value) => value + 1); }}>Réessayer</button></div> : null}</section> : !user ? <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-bold">Connectez-vous pour continuer</h2><p className="my-3 text-slate-600">Votre commande sera rattachée à votre compte.</p><button className="rounded-xl bg-primary px-5 py-3 font-semibold text-white" onClick={() => navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>Me connecter</button></section> : <form onSubmit={pay} className="space-y-5">
        {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div> : null}
        <section className="rounded-2xl bg-white p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><Package className="text-orange-500" /><div><h2 className="text-xl font-bold">Votre commande</h2><p className="text-sm text-slate-500">Vérifiez les détails avant de continuer.</p></div></div>
          {isShopify ? <div className="flex gap-4 border-b border-slate-100 pb-5">{shopifyProduct.image ? <img src={shopifyProduct.image} alt="" className="h-24 w-24 rounded-xl object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-slate-100"><Package /></div>}<div className="min-w-0 flex-1"><p className="text-sm text-slate-500">{shopifyProduct.brand}</p><h3 className="font-bold">{shopifyProduct.title}</h3>{shopifyProduct.variant ? <p className="text-sm text-slate-500">{shopifyProduct.variant}</p> : null}<p className="mt-2 text-sm text-slate-600">Quantité : {quantity}</p></div><strong>{money(shopifyTotalCents)}</strong></div> : loading ? <p role="status" className="flex items-center gap-3 text-slate-600"><RefreshCw className="animate-spin" />Vérification des prix et de la livraison…</p> : quote ? <div className="space-y-3">{quote.items.map((item) => <div className="flex justify-between gap-4 border-b border-slate-100 pb-3" key={item.product_id}><div><strong>{item.name}</strong><p className="text-sm text-slate-500">{item.shop_name} · Quantité {item.quantity}</p></div><span>{money(Math.round(item.unit_price * 100) * item.quantity)}</span></div>)}{quote.shipments.map((shipment) => <div className="flex justify-between text-sm" key={shipment.seller_id}><span>Livraison · {shipment.shop_name}</span><span>{money(shipment.shipping_cents)}</span></div>)}</div> : null}
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Truck />Votre livraison</h2><div className="grid gap-4 sm:grid-cols-2"><Field field="firstName" label="Prénom" autoComplete="given-name" address={address} change={change} /><Field field="lastName" label="Nom" autoComplete="family-name" address={address} change={change} /><FrenchAddressField address={address} change={change} suggestions={suggestions} chooseSuggestion={chooseSuggestion} addressLoading={addressLoading} /><Field field="address2" label="Complément d’adresse" autoComplete="address-line2" address={address} change={change} optional /><Field field="zip" label="Code postal" autoComplete="postal-code" address={address} change={change} /><Field field="city" label="Ville" autoComplete="address-level2" address={address} change={change} /><Field field="phone" label="Téléphone" autoComplete="tel" address={address} change={change} optional /><label className="text-sm font-medium text-slate-700">Pays<select className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3" value={address.country} onChange={(event) => change('country', event.target.value)}>{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label></div><p className="mt-4 text-sm text-slate-500">{isShopify ? 'Adresse vérifiée par la base officielle française puis transmise à votre boutique.' : `Adresse utilisée pour la commande et enregistrée dans le compte ${user.email}.`}</p></section>
        {isShopify ? <section className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-4 text-xl font-bold"><span>Total de la commande</span><span>{money(shopifyTotalCents)}</span></div><button disabled={busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary p-4 font-bold text-white disabled:opacity-60">{busy ? 'Ouverture du paiement…' : 'Continuer vers le paiement'}<Check size={18} /></button><p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500"><Lock size={16} />Paiement sécurisé</p></section> : quote ? <section className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex justify-between border-t border-slate-100 pt-3 text-xl font-bold"><span>Total à payer</span><span>{money(quote.total_cents)}</span></div><button disabled={busy} className="mt-5 w-full min-h-12 rounded-xl bg-primary p-4 font-bold text-white disabled:opacity-60">{busy ? 'Préparation du paiement…' : `Payer ${money(quote.total_cents)}`}</button><p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500"><Lock size={16} />Vos coordonnées bancaires sont saisies sur Stripe.</p></section> : null}
      </form>}
    </div>
  </main>;
}
