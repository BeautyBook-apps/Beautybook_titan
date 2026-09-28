import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, Wallet, History,
  Loader2, Plus, X, Check, ChevronRight, CreditCard, Gift
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { entities } from '@/api/entities';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

export default function MonSolde() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  // Affichage direct depuis le cache : le solde et l'historique s'affichent
  // immédiatement, le rafraîchissement réseau se fait en arrière-plan.
  const cacheKey = user?.email ? `solde_${user.email}` : null;
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.soldeRecord);
  const [soldeRecord, setSoldeRecord] = useCachedState(cacheKey, null, c => c?.soldeRecord ?? null);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [retraitLoading, setRetraitLoading] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    if (!user?.email) return;
    loadSolde();

    // Handle payment return
    if (searchParams.get("payment") === "success") {
      showSuccess("Paiement réussi ! Votre solde a été mis à jour.");
      setSearchParams({}, { replace: true });
    }
  }, [user, searchParams]);

  const loadSolde = async () => {
    setLoading(true);
    const records = await entities.SoldeBeautyPay.filter({ user_email: user.email }, "-created_at", 1).catch(() => []);
    if (records.length > 0) {
      setSoldeRecord(records[0]);
      mergePageCache(cacheKey, { soldeRecord: records[0] });
    } else {
      const newRecord = await entities.SoldeBeautyPay.create({
        user_email: user.email,
        solde: 0,
        transactions: [],
      }).catch(() => null);
      const record = newRecord || { solde: 0, transactions: [] };
      setSoldeRecord(record);
      mergePageCache(cacheKey, { soldeRecord: record });
    }
    setLoading(false);
  };

  const handleRecharge = async (amount) => {
    if (!amount || amount <= 0) return;
    const numAmount = parseFloat(amount);
    if (numAmount < 1) {
      showSuccess("Montant minimum: 1€");
      return;
    }

    setRechargeLoading(true);
    try {
      const { supabase } = await import("@/api/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const res = await fetch(`${API_BASE}/api/payments/wallet-recharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ amount: numAmount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création de la session de paiement");
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error("[MonSolde] Recharge error:", err);
      showSuccess(`Erreur: ${err.message}`);
      setRechargeLoading(false);
    }
  };

  const handleRetrait = async () => {
    const solde = soldeRecord?.solde || 0;
    if (solde <= 0) return;
    setRetraitLoading(true);
    const newTx = {
      id: Date.now().toString(),
      label: `Retrait vers compte bancaire`,
      date: new Date().toISOString(),
      amount: -solde,
      type: "debit",
      category: "retrait",
    };
    const updated = {
      solde: 0,
      transactions: [newTx, ...(soldeRecord.transactions || [])],
    };
    await entities.SoldeBeautyPay.update(soldeRecord.id, updated);
    const nextRecord = { ...soldeRecord, ...updated };
    setSoldeRecord(nextRecord);
    mergePageCache(cacheKey, { soldeRecord: nextRecord });
    setRetraitLoading(false);
    showSuccess(`${solde.toFixed(2)}€ retirés avec succès`);
  };

  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const solde = soldeRecord?.solde || 0;
  const transactions = soldeRecord?.transactions || [];

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy · HH:mm", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const totalRecharges = transactions.filter(t => t.type === "credit").reduce((s, t) => s + (t.amount || 0), 0);
  const totalDepenses = transactions.filter(t => t.type === "debit").reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Mon Solde</h1>
      </div>

      <div className="px-4 pb-24">

        {/* Success toast */}
        {actionSuccess && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-2xl shadow-lg shadow-green-500/30 flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4" />
            <span className="text-[13px] font-bold">{actionSuccess}</span>
          </div>
        )}

        {(loading && !soldeRecord) ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Balance card */}
            <div className="mt-4 bg-gradient-to-br from-primary to-orange-400 rounded-3xl p-6 shadow-lg shadow-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-white/60" />
                <p className="text-white/70 text-[11px] font-black uppercase tracking-widest">Solde disponible</p>
              </div>
              <p className="text-white text-[48px] font-black leading-none mb-1">
                {solde.toFixed(2)}€
              </p>
              <p className="text-white/70 text-[12px] font-medium">BeautyPay • Compte principal</p>

              {/* Actions */}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowRechargeModal(true)}
                  className="flex-1 bg-white/20 border border-white/30 rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span className="text-white text-[11px] font-black uppercase tracking-wider">Recharger</span>
                </button>
                <button
                  onClick={handleRetrait}
                  disabled={solde <= 0 || retraitLoading}
                  className="flex-1 bg-white rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {retraitLoading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-primary" />
                  )}
                  <span className="text-primary text-[11px] font-black uppercase tracking-wider">Retirer</span>
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-green-50 rounded-xl flex items-center justify-center">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
                  </div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total rechargé</p>
                </div>
                <p className="text-[18px] font-black text-green-500">+{totalRecharges.toFixed(2)}€</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-red-50 rounded-xl flex items-center justify-center">
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total dépensé</p>
                </div>
                <p className="text-[18px] font-black text-red-400">-{totalDepenses.toFixed(2)}€</p>
              </div>
            </div>

            {/* How it works */}
            <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-3">Comment ça marche</p>
              <div className="space-y-3">
                {[
                  { icon: Plus, text: "Rechargez votre portefeuille en un clic", color: "text-primary" },
                  { icon: CreditCard, text: "Utilisez votre solde pour réserver ou acheter", color: "text-blue-500" },
                  { icon: Gift, text: "Gagnez des bonus avec le programme fidélité", color: "text-orange-500" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <p className="text-[12px] text-gray-600 font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Historique */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                  Historique ({transactions.length})
                </p>
                {transactions.length > 0 && (
                  <button
                    onClick={() => navigate("/programme-fidelite")}
                    className="text-[11px] font-black text-primary flex items-center gap-1"
                  >
                    Voir plus <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              {transactions.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm">
                  <Wallet className="w-10 h-10 text-gray-200" />
                  <p className="text-[13px] text-gray-400 font-medium">Aucune transaction</p>
                  <p className="text-[11px] text-gray-300 text-center">Rechargez votre compte pour commencer</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">
                  {transactions.slice(0, 20).map(t => (
                    <div key={t.id} className="flex items-center gap-4 px-4 py-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        t.category === "recharge" ? "bg-green-50" :
                        t.category === "retrait" ? "bg-red-50" :
                        t.category === "paiement" ? "bg-blue-50" : "bg-orange-50"
                      }`}>
                        {t.type === "credit"
                          ? <ArrowDownLeft className="w-5 h-5 text-green-500" />
                          : <ArrowUpRight className="w-5 h-5 text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 truncate">{t.label}</p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          {t.category === "recharge" ? "Rechargement" :
                           t.category === "retrait" ? "Retrait" :
                           t.category === "paiement" ? "Paiement" : "Transaction"}
                        </p>
                        <p className="text-[10px] text-gray-300 font-medium">{formatDate(t.date)}</p>
                      </div>
                      <span className={`text-[15px] font-black shrink-0 ${t.type === "credit" ? "text-green-500" : "text-gray-700"}`}>
                        {t.amount > 0 ? "+" : ""}{t.amount.toFixed(2)}€
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRechargeModal(false)} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-black text-gray-900">Recharger votre portefeuille</h3>
              <button onClick={() => setShowRechargeModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[5, 10, 20, 50, 100, 200, 500, 1000].map(amount => (
                <button
                  key={amount}
                  onClick={() => handleRecharge(amount)}
                  disabled={rechargeLoading}
                  className="bg-gray-50 border border-gray-200 rounded-2xl py-3.5 text-center active:scale-95 transition-all disabled:opacity-60 hover:border-primary"
                >
                  {rechargeLoading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    <span className="text-[14px] font-black text-gray-900">{amount}€</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-black text-gray-400">€</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="Montant libre"
                  className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-[16px] font-black text-gray-900 outline-none focus:border-primary transition-all placeholder:text-gray-300"
                />
              </div>
              <button
                onClick={() => customAmount && handleRecharge(customAmount)}
                disabled={!customAmount || parseFloat(customAmount) <= 0 || rechargeLoading}
                className="px-6 py-3.5 bg-primary text-white rounded-2xl text-[13px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40"
              >
                {rechargeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Valider"}
              </button>
            </div>

            <p className="text-[10px] text-gray-400 text-center mt-4">
              Paiement sécurisé · Crédit instantané sur votre portefeuille
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
