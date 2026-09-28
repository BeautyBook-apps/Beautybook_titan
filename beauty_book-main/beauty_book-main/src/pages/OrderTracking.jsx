import BeautyImage from '@/components/ui/BeautyImage';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { apiClient } from '@/lib/apiClient';
import {
  ArrowLeft, Search, Loader2, Package, Truck, CheckCircle2,
  MapPin, Clock, ExternalLink, ChevronRight, Box, Factory,
  Plane, Home, Star
} from "lucide-react";

const TRACKING_STEPS = [
  {
    key: "order_placed",
    label: "Commande confirmée",
    sub: "Votre commande a été reçue et confirmée",
    icon: CheckCircle2,
    color: "bg-green-500",
    doneColor: "bg-green-500",
  },
  {
    key: "processing",
    label: "En cours de préparation",
    sub: "Votre commande est en cours de préparation en entrepôt",
    icon: Factory,
    color: "bg-blue-500",
    doneColor: "bg-blue-500",
  },
  {
    key: "packaged",
    label: "Emballée & prête",
    sub: "Votre colis a été emballé et est prêt à être expédié",
    icon: Box,
    color: "bg-purple-500",
    doneColor: "bg-purple-500",
  },
  {
    key: "shipped",
    label: "Expédiée",
    sub: "Votre colis a quitté l'entrepôt",
    icon: Truck,
    color: "bg-orange-500",
    doneColor: "bg-orange-500",
  },
  {
    key: "in_transit",
    label: "En transit",
    sub: "Votre colis est en route vers son destination",
    icon: Plane,
    color: "bg-primary",
    doneColor: "bg-primary",
  },
  {
    key: "out_for_delivery",
    label: "En cours de livraison",
    sub: "Votre livreur est en route",
    icon: MapPin,
    color: "bg-yellow-500",
    doneColor: "bg-yellow-500",
  },
  {
    key: "delivered",
    label: "Livré !",
    sub: "Votre colis a été livré avec succès",
    icon: Home,
    color: "bg-green-600",
    doneColor: "bg-green-600",
  },
];

function getStatusIndex(financialStatus, fulfillmentStatus) {
  if (fulfillmentStatus === "fulfilled") return 6;
  if (fulfillmentStatus === "partial") return 4;
  if (fulfillmentStatus === "in_transit") return 4;
  if (financialStatus === "paid") return 2;
  if (financialStatus === "pending") return 0;
  return 1;
}

function TrackingTimeline({ stepIndex }) {
  return (
    <div className="relative">
      {TRACKING_STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i <= stepIndex;
        const active = i === stepIndex;
        const upcoming = i > stepIndex;

        return (
          <div key={step.key} className="flex gap-4 pb-5 last:pb-0 relative">
            {/* Vertical line */}
            {i < TRACKING_STEPS.length - 1 && (
              <div className={`absolute left-5 top-10 w-0.5 h-full -translate-x-1/2 ${done && i < stepIndex ? "bg-primary" : "bg-gray-100"}`} style={{ height: "calc(100% - 10px)" }} />
            )}
            {/* Icon */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${done ? (active ? step.color + " shadow-lg ring-4 ring-offset-2 ring-primary/20" : "bg-gray-300") : "bg-gray-100"}`}>
              <Icon className={`w-5 h-5 ${done ? "text-white" : "text-gray-300"}`} />
            </div>
            {/* Content */}
            <div className="flex-1 pt-1 pb-2">
              <p className={`text-[13px] font-black ${active ? "text-primary" : done ? "text-gray-900" : "text-gray-300"}`}>
                {step.label}
                {active && <span className="ml-2 bg-primary/10 text-primary text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">En cours</span>}
              </p>
              <p className={`text-[11px] font-medium mt-0.5 ${done && !upcoming ? "text-gray-400" : "text-gray-200"}`}>{step.sub}</p>
              {done && !active && i < stepIndex && (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span className="text-[10px] text-green-600 font-bold">Terminé</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTracking() {
  const navigate = useNavigate();
  // Dernière recherche restaurée depuis le cache : affichage immédiat, sans écran vide.
  const [orderNumber, setOrderNumber] = useCachedState("suivi_commande", "", c => c?.orderNumber || "");
  const [email, setEmail] = useCachedState("suivi_commande", "", c => c?.email || "");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useCachedState("suivi_commande", null, c => c?.order ?? null);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!orderNumber.trim()) return;
    setLoading(true);
    setError(null);
    // Ne jamais vider l'affichage pendant une nouvelle recherche : l'ancien
    // résultat reste visible jusqu'à l'arrivée du nouveau.
    setSearched(true);

    try {
      const res = await apiClient.callFunction("trackOrder", {
        orderNumber: orderNumber.trim(),
        email: email.trim(),
      });
      if (res.data?.order) {
        setOrder(res.data.order);
        mergePageCache("suivi_commande", { orderNumber: orderNumber.trim(), email: email.trim(), order: res.data.order });
      } else {
        setError("Commande introuvable. Vérifiez votre numéro et votre email.");
      }
    } catch (e) {
      setError("Impossible de récupérer votre commande. Réessayez.");
    }
    setLoading(false);
  };

  const stepIndex = order
    ? getStatusIndex(order.financial_status, order.fulfillment_status)
    : -1;

  const currentStep = TRACKING_STEPS[stepIndex];

  return (
    <div className="font-display bg-[#f8f8f8] min-h-screen pb-10">

      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 sticky top-0 z-20 border-b border-gray-100 shadow-sm">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        <div>
          <h1 className="text-[17px] font-black text-gray-900">Suivi de commande</h1>
          <p className="text-[10px] text-gray-400 font-medium">Synchronisé avec Shopify</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">

        {/* Search box */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-[13px] font-black text-gray-700">Suivre ma commande</p>
          <div className="space-y-2.5">
            <input
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Numéro de commande (ex: #1001)"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-900 outline-none focus:border-primary transition-colors"
            />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Email de commande"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-900 outline-none focus:border-primary transition-colors"
            />
            <button onClick={handleSearch} disabled={loading || !orderNumber.trim()}
              className="w-full py-3.5 bg-primary text-white rounded-xl text-[14px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/20">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Recherche...</> : <><Search className="w-4 h-4" /> Suivre ma commande</>}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-[13px] text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* ── Order found ── */}
        {order && (
          <>
            {/* Order header card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Commande</p>
                  <p className="text-[22px] font-black">{order.order_number}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[11px] font-black ${currentStep ? currentStep.color : "bg-gray-600"} text-white`}>
                  {currentStep?.label || "En cours"}
                </div>
              </div>
              <div className="flex gap-4 text-[12px]">
                <div>
                  <p className="text-white/50 font-medium">Date</p>
                  <p className="font-black">{new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</p>
                </div>
                <div>
                  <p className="text-white/50 font-medium">Total</p>
                  <p className="font-black">{parseFloat(order.total_price).toFixed(2)} €</p>
                </div>
                <div>
                  <p className="text-white/50 font-medium">Articles</p>
                  <p className="font-black">{order.line_items?.length || 1}</p>
                </div>
              </div>
              {order.tracking_number && (
                <a href={order.tracking_url || "#"} target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 text-[11px] font-black text-white/80 w-fit">
                  <Truck className="w-3.5 h-3.5" /> N° suivi : {order.tracking_number}
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-5">Parcours de votre colis</p>
              <TrackingTimeline stepIndex={stepIndex} />
            </div>

            {/* Estimated delivery */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-black text-gray-900">Livraison estimée</p>
                <p className="text-[12px] text-gray-500 font-medium">Dans 5 à 10 jours ouvrés</p>
              </div>
            </div>

            {/* Articles */}
            {order.line_items?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-3">Articles commandés</p>
                <div className="space-y-3">
                  {order.line_items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                        {item.image
                          ? <BeautyImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          : <Package className="w-5 h-5 text-gray-300 m-auto mt-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 line-clamp-1">{item.name}</p>
                        <p className="text-[11px] text-gray-400">Qté : {item.quantity}</p>
                      </div>
                      <span className="text-[14px] font-black text-gray-900">{parseFloat(item.price).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rate */}
            {order.fulfillment_status === "fulfilled" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-black text-gray-900">Votre avis compte !</p>
                  <p className="text-[11px] text-gray-500 font-medium">Évaluez votre expérience d'achat</p>
                </div>
                <button className="flex items-center gap-1.5 bg-yellow-400 text-white text-[11px] font-black px-3 py-2 rounded-xl active:scale-95 transition-all">
                  <Star className="w-3.5 h-3.5" /> Noter
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!order && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="relative">
              <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-300" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-[15px] font-black text-gray-700 text-center">Suivez votre colis en temps réel</p>
            <p className="text-[12px] text-gray-400 font-medium text-center px-8">
              Entrez votre numéro de commande pour voir le parcours complet de votre livraison
            </p>
          </div>
        )}
      </div>
    </div>
  );
}