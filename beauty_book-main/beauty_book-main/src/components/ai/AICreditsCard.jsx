import { useEffect, useState } from 'react';
import { ArrowRight, Check, Coins, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

const DEFAULT_PACKAGES = [
  { id: 'starter', name: 'Pack Découverte', credits: 10, amount_cents: 499, highlight: false },
  { id: 'studio', name: 'Pack Studio', credits: 30, amount_cents: 999, highlight: true },
  { id: 'creator', name: 'Pack Créateur', credits: 100, amount_cents: 2499, highlight: false },
];

export default function AICreditsCard({ compact = false, returnPath = '/sh-ai' }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      setAccount(await apiClient.get('/api/ai/credits'));
    } catch (err) {
      setError('Le portefeuille IA est momentanément indisponible. Les packs restent visibles et seront activés dès que le serveur est prêt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    load().then(() => { if (!active) return; });
    const params = new URLSearchParams(window.location.search);
    const paid = params.get('credits') === 'success';
    const timer = paid ? window.setTimeout(load, 2200) : null;
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, []);

  const buy = async (pkg) => {
    if (!pkg) return;
    setBuying(pkg.id);
    setError('');
    try {
      const result = await apiClient.post('/api/ai/credits/checkout', {
        package_id: pkg.id,
        request_key: crypto.randomUUID(),
        return_path: returnPath,
      });
      if (!result?.checkout_url) throw new Error('La page de paiement n’a pas pu être ouverte.');
      window.location.assign(result.checkout_url);
    } catch (err) {
      setError(err.message || 'Le paiement n’a pas pu être préparé.');
      setBuying('');
    }
  };

  const unlimited = account?.unlimited === true;
  const freeRemaining = account?.free_remaining ?? 5;
  const freeLimit = account?.free_limit ?? 5;
  const credits = account?.credits ?? 0;
  const packages = account?.packages || DEFAULT_PACKAGES;

  return (
    <section className={`rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-purple-50 shadow-sm ${compact ? 'p-3' : 'p-4'}`} aria-label="Crédits IA">
      <div className="flex items-start gap-3">
        <div className={`grid shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-md shadow-primary/20 ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-black uppercase tracking-widest text-gray-900">Crédits IA synchronisés</p>
              <p className="mt-1 text-[11px] font-medium text-gray-500">{unlimited ? 'Générations IA illimitées, sans quota quotidien.' : `${freeLimit} génération${freeLimit > 1 ? 's' : ''} gratuite${freeLimit > 1 ? 's' : ''} chaque jour.`}</p>
            </div>
            <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Crédits</p>
              <p className="text-[18px] font-black leading-none text-gray-900">{loading ? '…' : credits}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-green-700">
            <Check className="h-3.5 w-3.5" />
            {loading ? 'Vérification de votre accès…' : unlimited ? 'Générations illimitées actives' : `${freeRemaining} gratuite${freeRemaining > 1 ? 's' : ''} restante${freeRemaining > 1 ? 's' : ''} aujourd’hui`}
          </div>
        </div>
      </div>

      {!unlimited && packages.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <Coins className="h-3.5 w-3.5 text-primary" /> Acheter des crédits
          </div>
          <div className="grid grid-cols-3 gap-2">
          {packages.map(pkg => {
            const isSelected = selectedPackage?.id === pkg.id;
            return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => { setSelectedPackage(pkg); setError(''); }}
              disabled={Boolean(buying)}
              aria-pressed={isSelected}
              className={`relative rounded-2xl border px-2 py-3 text-center transition active:scale-95 disabled:opacity-60 ${isSelected ? 'border-primary ring-2 ring-primary/25 shadow-lg shadow-primary/15' : ''} ${pkg.highlight ? 'bg-primary text-white shadow-md shadow-primary/20' : 'border-gray-200 bg-white text-gray-900'}`}
            >
              {pkg.highlight && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 px-2 py-0.5 text-[8px] font-black uppercase text-white">Populaire</span>}
              {isSelected ? <Check className="mx-auto h-4 w-4" /> : <Coins className="mx-auto h-4 w-4 opacity-70" />}
              <span className="mt-1 block text-[12px] font-black">{pkg.credits} crédits</span>
              <span className={`mt-0.5 block text-[11px] font-bold ${pkg.highlight ? 'text-white/80' : 'text-primary'}`}>{(pkg.amount_cents / 100).toFixed(2)}€</span>
            </button>
            );
          })}
          </div>

          {selectedPackage && (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-white p-3 shadow-sm" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Pack sélectionné</p>
                  <p className="mt-1 truncate text-[13px] font-black text-gray-900">{selectedPackage.name} · {selectedPackage.credits} crédits</p>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-500">Paiement sécurisé par Stripe</p>
                </div>
                <p className="shrink-0 text-[16px] font-black text-gray-900">{(selectedPackage.amount_cents / 100).toFixed(2)}€</p>
              </div>
              <button
                type="button"
                onClick={() => buy(selectedPackage)}
                disabled={Boolean(buying)}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-md shadow-primary/20 transition active:scale-[0.98] disabled:opacity-60"
              >
                {buying === selectedPackage.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Préparation du paiement…</>
                ) : (
                  <>Continuer vers le paiement <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{error}</p>}
      <p className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] font-medium text-gray-400"><ShieldCheck className="h-3 w-3" /> Paiement sécurisé par Stripe · solde partagé entre AI Styliste et AI HairChanger</p>
    </section>
  );
}
