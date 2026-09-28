import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, History,
  Loader2, Plus, CreditCard, ChevronRight, X, Check
} from "lucide-react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { format, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
const tabs = ["TOUTES", "RECHARGEMENTS", "PAIEMENTS", "RETRAITS"];

export default function BeautyPay() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  // Affichage direct depuis le cache : première peinture avec les dernières
  // données connues, rafraîchissement réseau en arrière-plan sans vider l'affichage.
  const cacheKey = user?.email ? `beautypay_${user.email}` : null;
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [activeTab, setActiveTab] = useState("TOUTES");
  const [soldeRecord, setSoldeRecord] = useCachedState(cacheKey, null, c => c?.soldeRecord ?? null);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [retraitLoading, setRetraitLoading] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [reservations, setReservations] = useCachedState(cacheKey, [], c => c?.reservations || []);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    if (!user?.email) return;
    // Si l'utilisateur arrive après le montage, le cache peut déjà exister :
    // pas d'écran de chargement dans ce cas.
    if (readPageCache(cacheKey)) setLoading(false);
    loadData();

    if (searchParams.get("payment") === "success") {
      showSuccess("Paiement réussi ! Votre solde a été mis à jour.");
      setSearchParams({}, { replace: true });
    }
  }, [user, searchParams]);

  const loadData = async () => {
    try {
      const [soldeData, resData] = await Promise.all([
        entities.SoldeBeautyPay.filter({ user_email: user.email }, "-created_at", 1).catch(() => []),
        entities.Reservation.filter({ pro_email: user.email }, "-created_at", 200).catch(() => [])
      ]);

      let solde;
      if (soldeData.length > 0) {
        solde = soldeData[0];
      } else {
        const newRecord = await entities.SoldeBeautyPay.create({
          user_email: user.email,
          solde: 0,
          transactions: [],
        }).catch(() => null);
        solde = newRecord || { solde: 0, transactions: [] };
      }
      setSoldeRecord(solde);

      const resas = resData || [];
      setReservations(resas);
      mergePageCache(cacheKey, { soldeRecord: solde, reservations: resas });
    } catch (e) {
      console.error("[BeautyPay] load error", e);
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
        body: JSON.stringify({ amount: numAmount, returnPath: '/pro/beauty-pay' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création de la session de paiement");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error("[BeautyPay] Recharge error:", err);
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
    const nextSolde = { ...soldeRecord, ...updated };
    setSoldeRecord(nextSolde);
    mergePageCache(cacheKey, { soldeRecord: nextSolde });
    setRetraitLoading(false);
    showSuccess(`${solde.toFixed(2)}€ retirés avec succès`);
  };

  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const solde = soldeRecord?.solde || 0;
  const walletTransactions = soldeRecord?.transactions || [];

  const monthStart = startOfMonth(new Date());
  const monthlyRes = reservations.filter(r => r.date && new Date(r.date) >= monthStart);
  const monthlyRevenue = monthlyRes
    .filter(r => r.status === "termine")
    .reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);

  const pending = reservations.filter(r => ["en_attente", "confirme"].includes(r.status));
  const pendingAmount = pending.reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);

  const allTransactions = [
    ...walletTransactions.map(t => ({ ...t, source: "wallet" })),
    ...reservations.map(r => ({
      id: r.id,
      label: r.client_email || r.client_name,
      sublabel: r.service_name,
      date: r.created_at,
      amount: r.total_price || r.service_price || 0,
      type: r.status === "termine" ? "credit" : r.status === "annule" ? "cancelled" : "pending",
      category: "reservation",
      status: r.status,
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

  const filtered = allTransactions.filter(t => {
    if (activeTab === "RECHARGEMENTS") return t.category === "recharge";
    if (activeTab === "PAIEMENTS") return t.category === "reservation" && t.status === "termine";
    if (activeTab === "RETRAITS") return t.category === "retrait";
    return true;
  });

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy · HH:mm", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const getTxIcon = (t) => {
    if (t.category === "recharge") return { icon: ArrowDownLeft, bg: "bg-green-50", color: "text-green-500" };
    if (t.category === "retrait") return { icon: ArrowUpRight, bg: "bg-red-50", color: "text-red-400" };
    if (t.status === "termine") return { icon: ArrowDownLeft, bg: "bg-blue-50", color: "text-blue-500" };
    if (t.status === "annule") return { icon: ArrowUpRight, bg: "bg-red-50", color: "text-red-400" };
    return { icon: ArrowDownLeft, bg: "bg-yellow-50", color: "text-yellow-500" };
  };

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Beauty Wallet</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="px-5 pt-4 space-y-4 pb-24">
        {/* Success toast */}
        {actionSuccess && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-2xl shadow-lg shadow-green-500/30 flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4" />
            <span className="text-[13px] font-bold">{actionSuccess}</span>
          </div>
        )}

        {/* Wallet balance card */}
        <div className="bg-gradient-to-br from-[#1a2035] to-[#2d3654] rounded-3xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-white/60" />
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Solde portefeuille</p>
          </div>
          {loading && !soldeRecord ? (
            <Loader2 className="w-8 h-8 animate-spin text-white mt-1" />
          ) : (
            <p className="text-[42px] font-black text-white leading-none mb-1">{solde.toFixed(2)} €</p>
          )}
          <p className="text-[11px] text-white/40 font-medium">Beauty Wallet • Pro</p>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowRechargeModal(true)}
              className="flex-1 bg-white/15 border border-white/20 rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
              <span className="text-white text-[11px] font-black uppercase tracking-wider">Recharger</span>
            </button>
            <button
              onClick={handleRetrait}
              disabled={solde <= 0 || retraitLoading}
              className="flex-1 bg-white rounded-2xl py-3.5 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
            >
              {retraitLoading ? (
                <div className="w-4 h-4 border-2 border-[#1a2035] border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-[#1a2035]" />
              )}
              <span className="text-[#1a2035] text-[11px] font-black uppercase tracking-wider">Retirer</span>
            </button>
          </div>
        </div>

        {/* Revenue summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Revenu du mois</p>
            <p className="text-[22px] font-black text-gray-900">{monthlyRevenue} €</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{monthlyRes.filter(r => r.status === "termine").length} prestations</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">En attente</p>
            <p className="text-[22px] font-black text-yellow-500">{pendingAmount} €</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{pending.length} transactions</p>
          </div>
        </div>

        {/* Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-black text-gray-900 uppercase tracking-widest">Historique</h2>
            <span className="text-[11px] text-gray-400 font-medium">{filtered.length} transactions</span>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  activeTab === tab ? "bg-[#1a2035] text-white shadow-md" : "bg-white text-gray-500 border border-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading && reservations.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a2035]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <History className="w-12 h-12 text-gray-200" />
              <p className="text-[13px] text-gray-400 font-medium">Aucune transaction</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(t => {
                const { icon: Icon, bg, color } = getTxIcon(t);
                return (
                  <div key={t.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-gray-900 truncate">{t.label}</p>
                      <p className="text-[11px] text-gray-400 font-medium truncate">
                        {t.sublabel || t.category === "recharge" ? "Rechargement" : t.category === "retrait" ? "Retrait" : ""}
                      </p>
                      <p className="text-[10px] text-gray-300 font-medium">{formatDate(t.date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[15px] font-black ${
                        t.type === "cancelled" ? "text-red-400 line-through" :
                        t.amount > 0 ? "text-green-500" : "text-gray-700"
                      }`}>
                        {t.amount > 0 ? "+" : ""}{t.amount.toFixed(2)} €
                      </p>
                      <p className={`text-[10px] font-black uppercase ${
                        t.status === "termine" ? "text-green-500" :
                        t.status === "annule" ? "text-red-400" :
                        t.status === "confirme" ? "text-blue-400" :
                        "text-yellow-500"
                      }`}>
                        {t.category === "recharge" ? "Crédité" :
                         t.category === "retrait" ? "Retiré" :
                         t.status === "termine" ? "Reçu" :
                         t.status === "annule" ? "Annulé" :
                         t.status === "confirme" ? "Confirmé" : "En attente"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRechargeModal(false)} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-black text-gray-900">Recharger le portefeuille</h3>
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
                  className="bg-gray-50 border border-gray-200 rounded-2xl py-3.5 text-center active:scale-95 transition-all disabled:opacity-60 hover:border-[#1a2035]"
                >
                  {rechargeLoading ? (
                    <div className="w-4 h-4 border-2 border-[#1a2035] border-t-transparent rounded-full animate-spin mx-auto" />
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
                  className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-[16px] font-black text-gray-900 outline-none focus:border-[#1a2035] transition-all placeholder:text-gray-300"
                />
              </div>
              <button
                onClick={() => customAmount && handleRecharge(customAmount)}
                disabled={!customAmount || parseFloat(customAmount) <= 0 || rechargeLoading}
                className="px-6 py-3.5 bg-[#1a2035] text-white rounded-2xl text-[13px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40"
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
