import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, CreditCard, Plus, Trash2, CheckCircle, Star, X, Loader2, ChevronRight, Shield
} from "lucide-react";
import { useThemeBg } from "@/hooks/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { entities } from "@/api/entities";

const getCardBrand = (num) => {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6(?:011|5)/.test(n)) return "discover";
  return "visa";
};

const formatCard = (val) => {
  const digits = val.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
};

export default function PaiementFacturation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const themeBg = useThemeBg();
  // Affichage direct depuis le cache : première peinture avec les dernières
  // données connues, rafraîchissement réseau en arrière-plan sans vider l'affichage.
  const cacheKey = user?.email ? `facturation_${user.email}` : null;
  const [cards, setCards] = useCachedState(cacheKey, [], c => c?.cards || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCard, setNewCard] = useState({ number: "", holder: "", expiry: "", cvv: "" });
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [transactions, setTransactions] = useCachedState(cacheKey, [], c => c?.transactions || []);
  const [soldeRecord, setSoldeRecord] = useCachedState(cacheKey, null, c => c?.soldeRecord ?? null);

  useEffect(() => {
    if (!user?.email) return;
    if (readPageCache(cacheKey)) setLoading(false);
    loadCards();
    loadTransactions();
  }, [user]);

  const loadCards = async () => {
    try {
      const data = await entities.ProPaymentMethod.filter(
        { user_email: user.email },
        "-created_at"
      );
      setCards(data || []);
      mergePageCache(cacheKey, { cards: data || [] });
    } catch (e) {
      console.error("[PaiementFacturation] load error", e);
    }
    setLoading(false);
  };

  const loadTransactions = async () => {
    try {
      const data = await entities.SoldeBeautyPay.filter(
        { user_email: user.email },
        "-created_at",
        1
      );
      if (data?.length > 0) {
        const solde = data[0];
        const txs = solde.transactions || [];
        setSoldeRecord(solde);
        setTransactions(txs);
        mergePageCache(cacheKey, { soldeRecord: solde, transactions: txs });
      }
    } catch (e) {
      console.error("[PaiementFacturation] load tx error", e);
    }
  };

  const handleAddCard = async () => {
    if (!newCard.number || !newCard.holder || !newCard.expiry) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const last4 = newCard.number.replace(/\s/g, "").slice(-4);
      const brand = getCardBrand(newCard.number);
      const payload = {
        user_email: user.email,
        card_last4: last4,
        card_brand: brand,
        card_holder: newCard.holder.toUpperCase(),
        card_expiry: newCard.expiry,
        is_default: cards.length === 0,
      };
      const result = await entities.ProPaymentMethod.create(payload);
      const nextCards = [result, ...cards];
      setCards(nextCards);
      mergePageCache(cacheKey, { cards: nextCards });
      setNewCard({ number: "", holder: "", expiry: "", cvv: "" });
      setShowAdd(false);
      showSuccess("Carte enregistrée avec succès");
    } catch (e) {
      console.error("[PaiementFacturation] add error", e);
      setErrorMsg("Erreur lors de l'enregistrement de la carte");
    }
    setSaving(false);
  };

  const handleDeleteCard = async (cardId) => {
    setDeleting(cardId);
    try {
      await entities.ProPaymentMethod.delete(cardId);
      const nextCards = cards.filter(c => c.id !== cardId);
      setCards(nextCards);
      mergePageCache(cacheKey, { cards: nextCards });
      showSuccess("Carte supprimée");
    } catch (e) {
      setErrorMsg("Erreur lors de la suppression");
    }
    setDeleting(null);
  };

  const handleSetDefault = async (cardId) => {
    try {
      await Promise.all(
        cards.map(c =>
          entities.ProPaymentMethod.update(c.id, { is_default: c.id === cardId })
        )
      );
      const nextCards = cards.map(c => ({ ...c, is_default: c.id === cardId }));
      setCards(nextCards);
      mergePageCache(cacheKey, { cards: nextCards });
    } catch (e) {
      console.error(e);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const inputClass = "w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-800 outline-none focus:ring-2 focus:ring-[#E8732A]/40 transition-all placeholder:text-gray-400";

  const brandColors = {
    visa: "from-blue-600 to-blue-800",
    mastercard: "from-orange-500 to-red-600",
    amex: "from-green-500 to-emerald-700",
    discover: "from-orange-400 to-amber-600",
  };

  const brandLabels = {
    visa: "VISA",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
  };

  return (
    <div className="font-display min-h-screen" style={{ background: themeBg }}>
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-[#E8732A]" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Paiement & Facturation</h1>
      </div>

      <div className="px-4 pb-20 pt-6 space-y-5">

        {successMsg && (
          <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-[13px] font-bold text-green-600">{successMsg}</p>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center gap-2">
            <X className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-[13px] font-bold text-red-600">{errorMsg}</p>
          </div>
        )}

        {/* Sécurité */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Shield className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-[12px] text-green-700 font-medium">Vos données de paiement sont chiffrées et sécurisées</p>
        </div>

        {/* Cartes enregistrées */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
            Mes cartes enregistrées {cards.length > 0 && `(${cards.length})`}
          </p>
          {loading && cards.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#E8732A]" />
            </div>
          ) : cards.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center">
              <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[14px] font-bold text-gray-400">Aucune carte enregistrée</p>
              <p className="text-[12px] text-gray-300 mt-1">Ajoutez une carte pour vos paiements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cards.map(card => (
                <div key={card.id} className={`rounded-3xl p-5 relative overflow-hidden ${card.is_default ? 'ring-2 ring-[#E8732A]' : ''}`} style={{ background: "linear-gradient(135deg, #1e2535, #2d3748)" }}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-white/60" />
                      </div>
                      {card.is_default && (
                        <span className="bg-[#E8732A] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Par défaut</span>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded-full bg-white/10 text-white/80 text-[11px] font-bold uppercase`}>
                      {brandLabels[card.card_brand] || "Carte"}
                    </div>
                  </div>
                  <p className="text-white/60 text-[14px] font-mono mb-1">•••• •••• •••• {card.card_last4}</p>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <p className="text-[8px] text-white/40 uppercase tracking-widest">Titulaire</p>
                      <p className="text-white text-[13px] font-black">{card.card_holder}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-white/40 uppercase tracking-widest">Expire</p>
                      <p className="text-white text-[13px] font-black">{card.card_expiry}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!card.is_default && (
                        <button
                          onClick={() => handleSetDefault(card.id)}
                          className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center active:scale-95"
                          title="Définir par défaut"
                        >
                          <Star className="w-3.5 h-3.5 text-white/60" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        disabled={deleting === card.id}
                        className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center active:scale-95"
                      >
                        {deleting === card.id ? (
                          <Loader2 className="w-3.5 h-3.5 text-white/60 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-white/60" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ajouter carte */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full bg-white border-2 border-dashed border-gray-200 rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-[#E8732A]" />
            <span className="text-[13px] font-black text-[#E8732A] uppercase tracking-widest">Ajouter une carte</span>
          </button>
        ) : (
          <div className="bg-white rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-black text-gray-900">Nouvelle carte</p>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Numéro de carte</p>
              <input
                className={inputClass}
                placeholder="0000 0000 0000 0000"
                value={newCard.number}
                onChange={e => setNewCard(p => ({ ...p, number: formatCard(e.target.value) }))}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Titulaire</p>
              <input
                className={inputClass}
                placeholder="NOM PRÉNOM"
                value={newCard.holder}
                onChange={e => setNewCard(p => ({ ...p, holder: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Expiration</p>
                <input
                  className={inputClass}
                  placeholder="MM/AA"
                  maxLength={5}
                  value={newCard.expiry}
                  onChange={e => setNewCard(p => ({ ...p, expiry: e.target.value }))}
                />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CVV</p>
                <input
                  className={inputClass}
                  placeholder="•••"
                  maxLength={3}
                  type="password"
                  value={newCard.cvv}
                  onChange={e => setNewCard(p => ({ ...p, cvv: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 font-black text-[13px] text-gray-500 active:scale-95 transition-all">
                Annuler
              </button>
              <button
                onClick={handleAddCard}
                disabled={saving}
                className="flex-1 py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-widest text-white active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ background: "#E8732A" }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        )}

        {/* Historique des transactions */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Dernières transactions</p>
          {transactions.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center">
              <p className="text-[14px] font-bold text-gray-400">Aucune transaction</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl divide-y divide-gray-50 overflow-hidden">
              {transactions.slice(0, 10).map((tx, i) => (
                <div key={tx.id || i} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-bold text-gray-800">{tx.label}</p>
                    <p className="text-[11px] text-gray-400">
                      {tx.date ? new Date(tx.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                    </p>
                  </div>
                  <p className={`text-[15px] font-black ${tx.type === "credit" ? "text-green-500" : "text-red-500"}`}>
                    {tx.type === "credit" ? "+" : "-"}{tx.amount?.toFixed(2)}€
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
