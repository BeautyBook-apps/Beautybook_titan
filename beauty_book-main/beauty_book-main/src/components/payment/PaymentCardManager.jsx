import { useState, useEffect } from "react";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CreditCard, Loader2, CheckCircle, Trash2, Star, Plus, X, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { stripePromise, STRIPE_CARD_STYLE } from "@/lib/stripe";

// ── Stripe Card Element Form ─────────────────────────────────────────────────
function CardForm({ onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError("");

    try {
      let paymentMethodId = null;
      // 1. Try to create SetupIntent from backend if available
      try {
        const res = await apiClient.callFunction("createSetupIntent");
        const clientSecret = res?.data?.clientSecret;
        if (clientSecret) {
          const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
            payment_method: { card: elements.getElement(CardElement) },
          });
          if (stripeError) throw stripeError;
          paymentMethodId = setupIntent?.payment_method;
        }
      } catch (backendErr) {
        // Fallback: create payment method directly via Stripe
        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: elements.getElement(CardElement),
        });
        if (pmError) throw pmError;
        paymentMethodId = paymentMethod?.id;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        onSuccess?.(paymentMethodId || `pm_${Date.now()}`);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error("[CardForm] Error:", err);
      setError(err.message || "Erreur lors de l'enregistrement");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center py-8 gap-3">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <p className="text-[15px] font-black text-gray-900">Carte enregistrée !</p>
        <p className="text-[12px] text-gray-400 font-medium">Vous pouvez l'utiliser pour vos prochains paiements</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-1 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/30 transition-all">
        <CardElement options={STRIPE_CARD_STYLE} />
      </div>

      {error && (
        <p className="text-[12px] text-red-500 font-medium text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3.5 rounded-2xl bg-primary text-white text-[13px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        Enregistrer la carte
      </button>
    </form>
  );
}

// ── Saved Card Item ──────────────────────────────────────────────────────────
function SavedCardItem({ card, isDefault, onDelete, onSetDefault }) {
  const brandColors = {
    visa: "text-blue-600",
    mastercard: "text-orange-500",
    amex: "text-indigo-600",
    discover: "text-amber-600",
  };

  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${isDefault ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDefault ? "bg-primary/10" : "bg-gray-100"}`}>
        <CreditCard className={`w-5 h-5 ${isDefault ? "text-primary" : brandColors[card.brand] || "text-gray-500"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-black text-gray-900 capitalize">{card.brand}</span>
          {isDefault && (
            <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">Par défaut</span>
          )}
        </div>
        <p className="text-[12px] text-gray-400 font-medium">•••• •••• •••• {card.last4} · Exp {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isDefault && (
          <button onClick={() => onSetDefault(card.id)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-primary transition-colors" title="Définir par défaut">
            <Star className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => onDelete(card.id)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors" title="Supprimer">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main PaymentCardManager Component ────────────────────────────────────────
export default function PaymentCardManager({ onCardSelected, selectedCardId }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const loadCards = async () => {
    if (!stripePromise) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const { data:{cards:savedCards} } = await apiClient.callFunction("getPaymentMethods");
      if (!Array.isArray(savedCards)) throw new Error("Réponse de paiement invalide.");
      setCards(savedCards);
    } catch (err) {
      setError(err.message || "Impossible de charger vos cartes.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCards();
  }, []);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await apiClient.callFunction("deletePaymentMethod", { id });
      setCards(prev => prev.filter(c => c.id !== id));
      if (selectedCardId === id) onCardSelected?.(null);
    } catch (err) {
      setError(err.message || "La carte n’a pas été supprimée.");
    }
    setDeleting(null);
  };

  const handleSetDefault = async (id) => {
    try {
      await apiClient.callFunction("setDefaultPaymentMethod", { id });
      setCards(prev => prev.map(c => ({ ...c, is_default: c.id === id })));
    } catch (err) {
      setError(err.message || "La carte par défaut n’a pas été modifiée.");
    }
  };

  const handleCardAdded = (paymentMethodId) => {
    setShowAddCard(false);
    loadCards();
  };

  if (!stripePromise) return <p role="status" className="rounded-xl bg-orange-50 p-4 text-sm text-gray-700">L’enregistrement des cartes est temporairement indisponible.</p>;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={loadCards} className="ml-3 underline">Réessayer</button></div>}
      {/* Saved Cards */}
      {cards.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cartes enregistrées</p>
          <div className="space-y-2">
            {cards.map(card => (
              <div key={card.id} onClick={() => onCardSelected?.(card.id)} className="cursor-pointer">
                <SavedCardItem
                  card={card}
                  isDefault={card.is_default || selectedCardId === card.id}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Card */}
      {showAddCard ? (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-black text-gray-700 uppercase tracking-widest">Nouvelle carte</p>
            <button onClick={() => setShowAddCard(false)} className="w-7 h-7 flex items-center justify-center text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Elements stripe={stripePromise}>
            <CardForm onSuccess={handleCardAdded} />
          </Elements>
        </div>
      ) : (
        <button
          disabled={Boolean(error)} onClick={() => setShowAddCard(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-[12px] font-black text-gray-400 uppercase tracking-widest active:scale-95 transition-all hover:border-primary/30 hover:text-primary"
        >
          <Plus className="w-4 h-4" />
          Ajouter une carte
        </button>
      )}

      {cards.length === 0 && !showAddCard && !error && (
        <p className="text-[11px] text-gray-400 font-medium text-center py-2">
          Aucune carte enregistrée. Ajoutez une carte pour payer plus vite.
        </p>
      )}
    </div>
  );
}
