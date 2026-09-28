import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, MapPin, CreditCard, Truck, Calendar, User, Scissors, Crown, Sparkles, Smartphone } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import OrderTracking from '@/components/commerce/OrderTracking';

// ── Statuts commande boutique ──
const STEPS_BOUTIQUE = [
  { key: "en_attente", label: "Commande reçue" },
  { key: "confirme", label: "Confirmée" },
  { key: "en_preparation", label: "En préparation" },
  { key: "expedie", label: "Expédiée" },
  { key: "livre", label: "Livrée" },
];

// ── Statuts RDV ──
const STEPS_RDV = [
  { key: "en_attente", label: "En attente" },
  { key: "confirme", label: "Confirmé" },
  { key: "termine", label: "Terminé" },
];

// ── Statuts Abonnement ──
const STEPS_ABONNEMENT = [
  { key: "pending", label: "En attente" },
  { key: "active", label: "Actif" },
];

const PAYMENT_LABELS = {
  mobile_money: "Mobile Money",
  carte: "Carte bancaire",
  paypal: "PayPal",
};

const STATUS_COLORS = {
  en_attente: "text-orange-500",
  confirme: "text-blue-600",
  en_preparation: "text-purple-600",
  expedie: "text-indigo-600",
  livre: "text-green-600",
  termine: "text-green-600",
  annule: "text-red-400",
  rembourse: "text-gray-400",
  no_show: "text-gray-400",
};

const STATUS_LABELS = {
  en_attente: "En attente",
  confirme: "Confirmé",
  en_preparation: "En préparation",
  expedie: "Expédié",
  livre: "Livré",
  termine: "Terminé",
  annule: "Annulé",
  rembourse: "Remboursé",
  no_show: "No show",
};

export default function CommandeDetail(){
 const type=new URLSearchParams(window.location.search).get('type')||'boutique';
 return type==='boutique'?<OrderTracking/>:<LegacyDetail/>;
}
function LegacyDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get("type") || "boutique";

  // Affichage direct depuis le cache, rafraîchissement en arrière-plan.
  const cacheKey = id ? `commande_${id}` : null;
  const [item, setItem] = useCachedState(cacheKey, null, c => c?.item ?? null);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.item);

  useEffect(() => {
    if (!id) return;
    let entity;
    if (type === "rdv") entity = entities.Reservation;
    else if (type === "abonnement") entity = entities.UserSubscription;
    else entity = entities.Commande;
    entity.filter({}, "-created_at", 200)
      .then(list => {
        const found = list.find(i => i.id === id);
        if (found) {
          setItem(found);
          mergePageCache(cacheKey, { item: found });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, type]);

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  const formatDateTime = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const isCancelled = item?.status === "annule" || item?.status === "rembourse" || item?.status === "no_show";

  const getStepIndex = (steps, status) => steps.findIndex(s => s.key === status);

  const steps = type === "rdv" ? STEPS_RDV : type === "abonnement" ? STEPS_ABONNEMENT : STEPS_BOUTIQUE;
  const currentStepIdx = item ? getStepIndex(steps, item.status) : -1;

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
            <ArrowLeft className="w-4 h-4 text-primary" />
          </button>
          <h1 className="text-[18px] font-black text-gray-900 flex-1 text-center">
            {type === "rdv" ? "Détail RDV" : type === "abonnement" ? "Détail abonnement" : "Détail commande"}
          </h1>
          <div className="w-9" />
        </div>
      </div>

      {(loading && !item) ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !item ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 px-8 text-center">
          <Package className="w-12 h-12 text-gray-200" />
          <p className="text-[14px] font-black text-gray-400">Commande introuvable</p>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-24 space-y-4">

          {/* Status card */}
          <div className={`bg-white rounded-3xl p-5 shadow-sm ${isCancelled ? "border-l-4 border-red-400" : "border-l-4 border-primary"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Statut actuel</p>
                <p className={`text-[20px] font-black ${STATUS_COLORS[item.status] || "text-gray-700"}`}>
                  {STATUS_LABELS[item.status] || item.status}
                </p>
                {type === "boutique" && item.tracking_number && (
                  <p className="text-[12px] text-gray-400 font-medium mt-1">N° suivi : <span className="font-black text-gray-600">{item.tracking_number}</span></p>
                )}
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isCancelled ? "bg-red-50" : "bg-primary/10"}`}>
                {isCancelled ? <XCircle className="w-6 h-6 text-red-400" /> : type === "rdv" ? <Calendar className="w-6 h-6 text-primary" /> : type === "abonnement" ? <Crown className="w-6 h-6 text-primary" /> : <Package className="w-6 h-6 text-primary" />}
              </div>
            </div>

            {/* Référence */}
            <p className="text-[10px] text-gray-300 font-medium mt-3">Réf. #{item.id?.slice(-8).toUpperCase()}</p>
          </div>

          {/* Progression */}
          {!isCancelled && (
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Progression</p>
              <div className="relative">
                {/* Ligne de fond */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />
                {/* Ligne remplie */}
                {currentStepIdx > 0 && (
                  <div
                    className="absolute left-4 top-4 w-0.5 bg-primary transition-all duration-500"
                    style={{ height: `${Math.min(currentStepIdx / (steps.length - 1), 1) * 100}%` }}
                  />
                )}
                <div className="space-y-5 relative">
                  {steps.map((step, i) => {
                    const done = i <= currentStepIdx;
                    const active = i === currentStepIdx;
                    return (
                      <div key={step.key} className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                          done ? "bg-primary" : "bg-gray-100"
                        } ${active ? "ring-4 ring-primary/20 scale-110" : ""}`}>
                          {done ? (
                            <CheckCircle className="w-4 h-4 text-white" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-300" />
                          )}
                        </div>
                        <div>
                          <p className={`text-[13px] font-black ${done ? "text-gray-900" : "text-gray-300"}`}>{step.label}</p>
                          {active && item.updated_date && (
                            <p className="text-[10px] text-gray-400 font-medium">{formatDateTime(item.updated_date)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Détails RDV */}
          {type === "rdv" && (
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Détails du rendez-vous</p>
              <InfoRow icon={<Scissors className="w-4 h-4 text-primary" />} label="Service" value={item.service_name} />
              <InfoRow icon={<User className="w-4 h-4 text-primary" />} label="Professionnel" value={item.pro_name || item.salon_name} />
              <InfoRow icon={<Calendar className="w-4 h-4 text-primary" />} label="Date" value={item.date ? formatDate(item.date) : ""} />
              <InfoRow icon={<Clock className="w-4 h-4 text-primary" />} label="Heure" value={item.time_slot ? `${item.time_slot}${item.end_time_slot ? ` — ${item.end_time_slot}` : ""}` : ""} />
              {item.salon_address && <InfoRow icon={<MapPin className="w-4 h-4 text-primary" />} label="Adresse" value={item.salon_address} />}
              {item.notes && <InfoRow icon={<Package className="w-4 h-4 text-primary" />} label="Notes" value={item.notes} />}
            </div>
          )}

          {/* Articles boutique */}
          {type === "boutique" && item.items?.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Articles</p>
              <div className="space-y-3">
                {item.items.map((art, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      {art.image_url ? (
                        <BeautyImage src={art.image_url} alt={art.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-gray-900 truncate">{art.name}</p>
                      <p className="text-[11px] text-gray-400 font-medium">Qté : {art.quantity || 1}</p>
                    </div>
                    <p className="text-[14px] font-black text-gray-900 shrink-0">{art.price}€</p>
                  </div>
                ))}
              </div>
              {item.shipping_address && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Livraison</p>
                    <p className="text-[12px] text-gray-600 font-medium mt-0.5">{item.shipping_address}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Récapitulatif paiement */}
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Récapitulatif</p>
            <div className="space-y-2">
              {type === "boutique" && item.subtotal != null && (
                <div className="flex justify-between">
                  <span className="text-[13px] text-gray-500 font-medium">Sous-total</span>
                  <span className="text-[13px] text-gray-700 font-black">{item.subtotal}€</span>
                </div>
              )}
              {type === "boutique" && item.shipping != null && (
                <div className="flex justify-between">
                  <span className="text-[13px] text-gray-500 font-medium">Livraison</span>
                  <span className="text-[13px] text-gray-700 font-black">{item.shipping === 0 ? "Gratuit" : `${item.shipping}€`}</span>
                </div>
              )}
              {type === "rdv" && item.addons?.length > 0 && item.addons.map((addon, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[13px] text-gray-500 font-medium">{addon.name}</span>
                  <span className="text-[13px] text-gray-700 font-black">{addon.price}€</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-[14px] font-black text-gray-900">Total</span>
                <span className="text-[16px] font-black text-primary">
                  {type === "rdv" ? (item.total_price || item.service_price || 0) : (item.total || 0)}€
                </span>
              </div>
              {item.payment_type && (
                <div className="flex items-center gap-2 pt-1">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] text-gray-400 font-medium capitalize">
                    {item.payment_type === "surplace" ? "Paiement sur place" :
                     item.payment_type === "acompte" ? `Acompte de ${item.acompte_amount || 0}€ payé` :
                     "Paiement complet"}
                  </span>
                </div>
              )}
              {item.payment_method && (
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] text-gray-400 font-medium capitalize">{item.payment_method}</span>
                </div>
              )}
            </div>
          </div>

          {/* Date de commande */}
          <p className="text-center text-[11px] text-gray-300 font-medium">
            Passé le {formatDate(item.created_date)}
          </p>

        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 bg-primary/5 rounded-lg flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-[13px] font-black text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
