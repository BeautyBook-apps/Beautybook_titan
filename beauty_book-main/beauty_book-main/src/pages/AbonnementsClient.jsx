import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, CheckCircle, Crown, Car, MapPin, Calendar, Zap, Loader2, X, CreditCard, Smartphone, Wallet, ShieldCheck } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, mergePageCache } from "@/hooks/usePageCache";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthModal from "@/components/ui/AuthModal";

const FALLBACK_PLANS = [
  {
    id: "gratuit",
    name: "Gratuit",
    price: 0,
    priceId: null,
    current: true,
    popular: false,
    btnLabel: "PLAN ACTUEL",
    btnStyle: "bg-gray-200 text-gray-600 cursor-default",
    badge: null,
    color: "border-gray-200",
    features: [
      { icon: CheckCircle, label: "Accès à l'annuaire beauté" },
      { icon: CheckCircle, label: "Réservations standards" },
      { icon: CheckCircle, label: "Avis et notes" },
      { icon: CheckCircle, label: "Boutique produits" },
    ],
  },
  {
    id: "beautyplus",
    name: "Beauty Plus",
    price: 9.99,
    priceId: "price_1Td7eOLaNWrAdvdeA59wSI0m",
    current: false,
    popular: true,
    btnLabel: "DEVENIR VIP",
    btnStyle: "bg-primary text-white shadow-lg shadow-primary/40",
    badge: "VIP",
    color: "border-primary/30",
    features: [
      { icon: Star, label: "Priorité sur toutes les réservations", highlight: true },
      { icon: Crown, label: "Statut client VIP visible par les pros", highlight: true },
      { icon: Car, label: "Accès au Beauty Car (prestations à domicile)", highlight: true },
      { icon: MapPin, label: "Accès au Congo Beauty (réseau partenaire)" },
      { icon: Zap, label: "Suggestions personnalisées par IA" },
      { icon: Calendar, label: "Rappels & agenda beauté intelligent" },
    ],
  },
];

const FEATURE_ICONS = {
  "Réservation de base": CheckCircle,
  "Accès aux styles": Star,
  "Messagerie": CheckCircle,
  "Réservations illimitées": CheckCircle,
  "Priorité de réservation": Star,
  "Support prioritaire": CheckCircle,
  "Cashback 5%": Zap,
  "Accès aux lives exclusifs": Crown,
};

const PAYMENT_METHODS = [
  { id: "mobile_money", label: "Mobile Money", icon: Smartphone, desc: "Orange Money, M-Pesa, Airtel Money" },
  { id: "carte", label: "Carte bancaire", icon: CreditCard, desc: "Visa, Mastercard" },
  { id: "paypal", label: "PayPal", icon: Wallet, desc: "Paiement sécurisé PayPal" },
];

export default function AbonnementsClient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAuthModal, authMessage, requireAuth, closeAuthModal } = useAuthGate();
  const [loadingId, setLoadingId] = useState(null);
  // Affichage direct depuis le cache : les icônes (composants) ne sont pas
  // sérialisables → retirées avant persistance, réhydratées via FEATURE_ICONS.
  const cacheKey = user?.email ? `abonnements_${user.email}` : null;
  const [plans, setPlans] = useCachedState(cacheKey, FALLBACK_PLANS, c => {
    const cached = c?.plans;
    if (!cached?.length) return FALLBACK_PLANS;
    return cached.map(p => ({
      ...p,
      features: (p.features || []).map(f => ({ ...f, icon: FEATURE_ICONS[f.label] || CheckCircle })),
    }));
  });
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    payment_method: "mobile_money",
  });

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        name: user.full_name || "",
        email: user.email || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        requireAuth("Connectez-vous pour gérer votre abonnement.");
      }
    }).catch(() => requireAuth("Connectez-vous pour gérer votre abonnement."));
  }, []);

  useEffect(() => {
    entities.AppConfig.filter({ key: "payment_settings" }, "-created_at", 1)
      .then(res => {
        const results = res?.results || res || [];
        const row = Array.isArray(results) ? results[0] : results;
        const cfg = row?.value;
        if (cfg?.abonnement_client) {
          const ac = cfg.abonnement_client;
          const dynamicPlans = [];
          if (ac.free) {
            dynamicPlans.push({
              id: "gratuit",
              name: ac.free.label || "Gratuit",
              price: ac.free.price || 0,
              priceId: null,
              current: true,
              popular: false,
              btnLabel: "PLAN ACTUEL",
              btnStyle: "bg-gray-200 text-gray-600 cursor-default",
              badge: null,
              color: "border-gray-200",
              features: (ac.free.features || []).map(f => ({
                icon: FEATURE_ICONS[f] || CheckCircle,
                label: f,
              })),
            });
          }
          if (ac.premium) {
            dynamicPlans.push({
              id: "beautyplus",
              name: ac.premium.label || "Beauty Plus",
              price: ac.premium.price || 9.99,
              priceId: "price_1Td7eOLaNWrAdvdeA59wSI0m",
              current: false,
              popular: true,
              btnLabel: "DEVENIR VIP",
              btnStyle: "bg-primary text-white shadow-lg shadow-primary/40",
              badge: "VIP",
              color: "border-primary/30",
              features: (ac.premium.features || []).map(f => ({
                icon: FEATURE_ICONS[f] || Star,
                label: f,
                highlight: true,
              })),
            });
          }
          if (dynamicPlans.length > 0) {
            setPlans(dynamicPlans);
            mergePageCache(cacheKey, {
              plans: dynamicPlans.map(p => ({
                ...p,
                features: (p.features || []).map(({ icon, ...f }) => f),
              })),
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = (plan) => {
    if (!plan.priceId || plan.current) return;
    setSelectedPlan(plan);
    setSuccess(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      alert("Veuillez remplir votre nom et email.");
      return;
    }
    setSubmitting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await entities.UserSubscription.create({
        user_email: form.email.trim(),
        user_name: form.name.trim(),
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        plan_price: selectedPlan.price,
        plan_type: "client",
        status: "active",
        payment_method: form.payment_method,
        payment_status: "paye",
        billing_name: form.name.trim(),
        billing_email: form.email.trim(),
        billing_phone: form.phone.trim(),
        starts_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (user?.email) {
        await supabase.from("profiles").update({
          abonnement: selectedPlan.id,
          abonnement_expires_at: expiresAt.toISOString(),
        }).eq("email", user.email);
      }

      setSuccess(true);
    } catch (e) {
      console.error("Subscription error:", e);
      alert("Erreur lors de l'activation. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="font-display min-h-full bg-[#f0f0f0]">
      <AuthModal open={showAuthModal} onClose={closeAuthModal} message={authMessage} />
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-[17px] font-black text-gray-900">Abonnements</h1>
        <div className="w-9" />
      </div>

      <div className="px-4 pt-5 pb-10 space-y-5">
        {/* Hero */}
        <div className="px-1 pb-1">
          <span className="inline-block bg-orange-100 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-3">
            Pour les clients BeautyBook
          </span>
          <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-2">
            Profitez de la{" "}
            <span className="text-primary">beauté à son meilleur</span>
          </h2>
          <p className="text-[13px] text-gray-500 font-medium leading-relaxed">
            Passez VIP et accédez à des privilèges exclusifs que les autres clients n'ont pas.
          </p>
        </div>

        {/* Plan cards */}
        {plans.map((plan) => (
          <div key={plan.id} className="relative">
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md shadow-primary/30">
                  Le plus populaire
                </span>
              </div>
            )}
            <div className={`bg-white rounded-3xl p-5 shadow-sm border-2 ${plan.color} ${plan.popular ? "pt-6" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[18px] font-black text-gray-900">{plan.name}</p>
                {plan.badge && (
                  <span className="bg-primary/10 text-primary text-[11px] font-black px-3 py-1 rounded-full">{plan.badge}</span>
                )}
              </div>
              <div className="flex items-end gap-1 mb-5">
                <span className="text-[44px] font-black text-gray-900 leading-none">{plan.price}€</span>
                <span className="text-[15px] font-bold text-gray-400 mb-2">/mois</span>
              </div>
              <div className="space-y-3 mb-5">
                {plan.features.map(({ icon: Icon, label, highlight }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${highlight ? "bg-primary/10" : "bg-gray-100"}`}>
                      <Icon className={`w-3 h-3 ${highlight ? "text-primary" : "text-gray-400"}`} />
                    </div>
                    <span className={`text-[13px] leading-snug ${highlight ? "font-black text-gray-900" : "font-medium text-gray-600"}`}>{label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={!plan.priceId || plan.current || loadingId === plan.id}
                className={`w-full py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${plan.btnStyle}`}
              >
                {loadingId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.btnLabel}
              </button>
            </div>
          </div>
        ))}

        {/* Beauty Car highlight */}
        <div className="bg-gradient-to-br from-[#1a2035] to-[#2d3555] rounded-3xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-black">Beauty Car</p>
              <p className="text-[11px] text-white/60 font-medium">Exclusif membres Beauty Plus</p>
            </div>
          </div>
          <p className="text-[13px] text-white/70 font-medium leading-relaxed">
            Des professionnels de beauté se déplacent directement chez vous dans un véhicule équipé. Coiffure, maquillage, manucure... tout à domicile.
          </p>
        </div>
      </div>

      {/* Subscription Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && setSelectedPlan(null)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            {success ? (
              /* Success View */
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-[22px] font-black text-gray-900 mb-2">Abonnement activé !</h3>
                <p className="text-[14px] text-gray-500 font-medium mb-2">
                  Vous êtes maintenant membre <span className="text-primary font-black">{selectedPlan.name}</span>
                </p>
                <p className="text-[12px] text-gray-400 mb-8">
                  Profitez de tous vos avantages VIP dès maintenant.
                </p>
                <button
                  onClick={() => { setSelectedPlan(null); navigate("/profil"); }}
                  className="w-full py-4 bg-primary text-white rounded-2xl text-[13px] font-black uppercase tracking-widest active:scale-[0.98] transition-all"
                >
                  Voir mon profil
                </button>
                <button
                  onClick={() => { setSelectedPlan(null); navigate("/mes-commandes"); }}
                  className="w-full py-3 mt-3 bg-gray-100 text-gray-700 rounded-2xl text-[13px] font-black uppercase tracking-widest active:scale-[0.98] transition-all"
                >
                  Voir mes commandes
                </button>
              </div>
            ) : (
              /* Form View */
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-[18px] font-black text-gray-900">Souscrire</h3>
                    <p className="text-[12px] text-gray-400 font-medium">{selectedPlan.name} - {selectedPlan.price}€/mois</p>
                  </div>
                  <button onClick={() => !submitting && setSelectedPlan(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Plan Summary */}
                  <div className={`bg-gradient-to-br ${selectedPlan.id === "beautyplus" ? "from-primary/5 to-orange-50" : "from-gray-50 to-gray-100"} rounded-2xl p-4 border ${selectedPlan.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[15px] font-black text-gray-900">{selectedPlan.name}</span>
                      <span className="text-[20px] font-black text-primary">{selectedPlan.price}€<span className="text-[12px] text-gray-400">/mois</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                      <span>Paiement sécurisé • Annulation possible à tout moment</span>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="text-[12px] font-black text-gray-700 uppercase tracking-wider mb-1.5 block">Nom complet</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Votre nom"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-[14px] font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[12px] font-black text-gray-700 uppercase tracking-wider mb-1.5 block">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="votre@email.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-[14px] font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-[12px] font-black text-gray-700 uppercase tracking-wider mb-1.5 block">Téléphone <span className="text-gray-300">(optionnel)</span></label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="+243 ..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-[14px] font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-[12px] font-black text-gray-700 uppercase tracking-wider mb-2 block">Mode de paiement</label>
                    <div className="space-y-2">
                      {PAYMENT_METHODS.map(pm => (
                        <button
                          key={pm.id}
                          onClick={() => setForm({ ...form, payment_method: pm.id })}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                            form.payment_method === pm.id
                              ? "border-primary bg-primary/5"
                              : "border-gray-100 bg-white hover:border-gray-200"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            form.payment_method === pm.id ? "bg-primary/10" : "bg-gray-100"
                          }`}>
                            <pm.icon className={`w-5 h-5 ${form.payment_method === pm.id ? "text-primary" : "text-gray-400"}`} />
                          </div>
                          <div className="text-left">
                            <p className={`text-[13px] font-black ${form.payment_method === pm.id ? "text-primary" : "text-gray-900"}`}>{pm.label}</p>
                            <p className="text-[11px] text-gray-400 font-medium">{pm.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !form.name.trim() || !form.email.trim()}
                    className="w-full py-4 bg-primary text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Activation en cours...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" /> Activer {selectedPlan.name} - {selectedPlan.price}€/mois</>
                    )}
                  </button>

                  <p className="text-[11px] text-gray-400 text-center font-medium">
                    En souscrivant, vous acceptez les conditions générales d'utilisation.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
