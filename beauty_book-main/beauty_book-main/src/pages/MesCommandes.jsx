import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, ChevronRight, ShoppingBag, Calendar, Crown, Star, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_COMMANDE = {
  en_attente: { label: "En attente", color: "text-orange-500", bg: "bg-orange-50", Icon: Clock },
  confirme: { label: "Confirmé", color: "text-blue-600", bg: "bg-blue-50", Icon: CheckCircle },
  en_preparation: { label: "En préparation", color: "text-purple-600", bg: "bg-purple-50", Icon: Package },
  expedie: { label: "Expédié", color: "text-indigo-600", bg: "bg-indigo-50", Icon: Package },
  livre: { label: "Livré", color: "text-green-600", bg: "bg-green-50", Icon: CheckCircle },
  annule: { label: "Annulé", color: "text-red-400", bg: "bg-red-50", Icon: XCircle },
  rembourse: { label: "Remboursé", color: "text-gray-500", bg: "bg-gray-100", Icon: XCircle },
};

const STATUS_RDV = {
  en_attente: { label: "En attente", color: "text-orange-500", bg: "bg-orange-50", Icon: Clock },
  confirme: { label: "Confirmé", color: "text-blue-600", bg: "bg-blue-50", Icon: CheckCircle },
  annule: { label: "Annulé", color: "text-red-400", bg: "bg-red-50", Icon: XCircle },
  termine: { label: "Terminé", color: "text-green-600", bg: "bg-green-50", Icon: CheckCircle },
  no_show: { label: "No show", color: "text-gray-400", bg: "bg-gray-100", Icon: XCircle },
};

const STATUS_ABONNEMENT = {
  active: { label: "Actif", color: "text-green-600", bg: "bg-green-50", Icon: CheckCircle },
  expired: { label: "Expiré", color: "text-gray-400", bg: "bg-gray-100", Icon: XCircle },
  cancelled: { label: "Annulé", color: "text-red-400", bg: "bg-red-50", Icon: XCircle },
  pending: { label: "En attente", color: "text-orange-500", bg: "bg-orange-50", Icon: Clock },
};

const TABS = ["TOUT", "RDV", "BOUTIQUE", "ABONNEMENTS"];

export default function MesCommandes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("TOUT");
  // Affichage direct depuis le cache : la première peinture montre les dernières
  // données connues, le rafraîchissement réseau se fait en arrière-plan.
  const cacheKey = user?.email ? `commandes_${user.email}` : null;
  const [reservations, setReservations] = useCachedState(cacheKey, [], c => c?.reservations || []);
  const [commandes, setCommandes] = useCachedState(cacheKey, [], c => c?.commandes || []);
  const [abonnements, setAbonnements] = useCachedState(cacheKey, [], c => c?.abonnements || []);
  const [loading, setLoading] = useState(() => {
    const cached = readPageCache(cacheKey);
    return !(cached?.reservations?.length || cached?.commandes?.length || cached?.abonnements?.length);
  });

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    Promise.all([
      entities.Reservation.filter({ client_email: user.email }, "-created_at", 50).catch(() => []),
      entities.Commande.filter({ client_email: user.email }, "-created_at", 50).catch(() => []),
      entities.UserSubscription.filter({ user_email: user.email }, "-created_at", 50).catch(() => []),
    ]).then(([r, c, s]) => {
      setReservations(r);
      setCommandes(c);
      setAbonnements(s);
      mergePageCache(cacheKey, { reservations: r, commandes: c, abonnements: s });
    }).finally(() => setLoading(false));
  }, [user?.email]);

  // Merge into unified list
  const allItems = [
    ...reservations.map(r => ({ ...r, _type: "rdv" })),
    ...commandes.map(c => ({ ...c, _type: "boutique" })),
    ...abonnements.map(s => ({ ...s, _type: "abonnement" })),
  ].sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));

  const filtered = allItems.filter(item => {
    if (activeTab === "TOUT") return true;
    if (activeTab === "RDV") return item._type === "rdv";
    if (activeTab === "ABONNEMENTS") return item._type === "abonnement";
    return item._type === "boutique";
  });

  const formatDate = (d) => {
    if (!d) return "";
    try {
      return format(new Date(d), "EEEE d MMMM yyyy", { locale: fr });
    } catch {
      return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    }
  };

  const getStatus = (item) => {
    if (item._type === "rdv") return STATUS_RDV[item.status] || STATUS_RDV.en_attente;
    if (item._type === "abonnement") return STATUS_ABONNEMENT[item.status] || STATUS_ABONNEMENT.active;
    return STATUS_COMMANDE[item.status] || STATUS_COMMANDE.en_attente;
  };

  const getTitle = (item) => {
    if (item._type === "rdv") return item.service_name || "Rendez-vous";
    if (item._type === "boutique") return item.items?.[0]?.name || "Commande";
    if (item._type === "abonnement") return `Abonnement ${item.plan_name || ""}`.trim();
    return "Commande";
  };

  const getSubtitle = (item) => {
    if (item._type === "rdv") return item.pro_name || item.salon_name || "";
    if (item._type === "boutique") return `${item.items?.length || 1} article${item.items?.length > 1 ? "s" : ""}`;
    if (item._type === "abonnement") return item.plan_type === "pro" ? "Compte Professionnel" : "Compte Client";
    return "";
  };

  const getPrice = (item) => {
    if (item._type === "rdv") return item.total_price || item.service_price || 0;
    if (item._type === "abonnement") return item.plan_price || 0;
    return item.total || 0;
  };

  const getImage = (item) => {
    if (item._type === "boutique") return item.items?.[0]?.image_url || null;
    return null;
  };

  const getDate = (item) => {
    if (item._type === "rdv") {
      if (item.date) {
        try {
          return format(parseISO(item.date), "EEEE d MMMM yyyy", { locale: fr });
        } catch {
          return new Date(item.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        }
      }
      return formatDate(item.created_date || item.created_at);
    }
    if (item._type === "abonnement") return formatDate(item.starts_at || item.created_at);
    return formatDate(item.created_date || item.created_at);
  };

  const getTypeIcon = (item) => {
    if (item._type === "rdv") return Calendar;
    if (item._type === "abonnement") return Crown;
    return ShoppingBag;
  };

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
            <ArrowLeft className="w-4 h-4 text-primary" />
          </button>
          <h1 className="text-[20px] font-black text-gray-900 flex-1 text-center">Mes Commandes</h1>
          <div className="w-9" />
        </div>
        {/* Tabs */}
        <div className="flex justify-center gap-5 overflow-x-auto hide-scrollbar">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-[11px] font-black border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? "text-primary border-primary" : "text-gray-400 border-transparent"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 pb-24">
        {(loading && allItems.length === 0) ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-pulse">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-2 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Package className="w-10 h-10 text-gray-200" />
            <p className="text-[13px] font-black text-gray-400">Connectez-vous pour voir vos commandes</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-[12px] font-black text-gray-300 uppercase tracking-widest">
              {activeTab === "ABONNEMENTS" ? "Aucun abonnement" : "Aucune commande"}
            </p>
          </div>
        ) : filtered.map(item => {
          const s = getStatus(item);
          const Icon = s.Icon;
          const img = getImage(item);
          const TypeIcon = getTypeIcon(item);
          return (
            <button key={item.id} onClick={() => navigate(`/commande/${item.id}?type=${item._type}`)}
              className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-all text-left">
              <div className={`w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center ${
                item._type === "abonnement" ? "bg-gradient-to-br from-primary/10 to-orange-50" : "bg-gray-100"
              }`}>
                {img ? (
                  <BeautyImage src={img} alt={getTitle(item)} className="w-full h-full object-cover" />
                ) : (
                  <TypeIcon className={`w-6 h-6 ${item._type === "abonnement" ? "text-primary" : "text-gray-300"}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900 truncate">{getTitle(item)}</p>
                <p className="text-[11px] text-gray-400 font-medium truncate">{getSubtitle(item)}</p>
                <p className="text-[11px] text-gray-300 font-medium mt-0.5">{getDate(item)}</p>
                <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full ${s.bg}`}>
                  <Icon className={`w-3 h-3 ${s.color}`} />
                  <span className={`text-[10px] font-black uppercase tracking-wider ${s.color}`}>{s.label}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[16px] font-black text-gray-900">{getPrice(item)}€</p>
                {item._type === "abonnement" && item.plan_price > 0 && (
                  <p className="text-[10px] text-gray-400 font-medium">/mois</p>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-2" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
