import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, BarChart2, ShieldCheck, Award, TrendingUp, Infinity, Headphones, Star, Users, Mic, Percent, CheckCircle, Loader2, X, CreditCard, Smartphone, Wallet } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useCachedState, mergePageCache } from "@/hooks/usePageCache";

const FALLBACK_PLANS = [
  {
    id: "basique",
    name: "Basique",
    price: 0,
    priceId: null,
    current: true,
    popular: false,
    btnLabel: "PLAN ACTUEL",
    btnStyle: "bg-gray-200 text-gray-600",
    color: "border-gray-200",
    features: [
      { icon: CheckCircle, label: "Profil standard" },
      { icon: CheckCircle, label: "Accès à l'annuaire" },
      { icon: CheckCircle, label: "Réservations limitées" },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 19,
    priceId: "price_1Td7eOLaNWrAdvdeq3Tf30i5",
    current: false,
    popular: true,
    btnLabel: "CHOISIR CE PLAN",
    btnStyle: "bg-primary text-white shadow-lg shadow-primary/40",
    color: "border-primary/30",
    features: [
      { icon: Award, label: "Badge certifié", highlight: true },
      { icon: TrendingUp, label: "Statistiques avancées", highlight: true },
      { icon: Infinity, label: "Réservations illimitées", highlight: true },
      { icon: Headphones, label: "Support prioritaire" },
    ],
  },
  {
    id: "gold",
    name: "Gold",
    price: 49,
    priceId: "price_1Td7eOLaNWrAdvdepth9zQuk",
    current: false,
    popular: false,
    btnLabel: "CHOISIR CE PLAN",
    btnStyle: "bg-[#1a2035] text-white",
    color: "border-[#1a2035]/30",
    features: [
      { icon: Star, label: "Tout le Premium", highlight: true },
      { icon: Eye, label: 'Mise en avant "Salon du Mois"', highlight: true },
      { icon: Users, label: "Gestion d'équipe complète", highlight: true },
      { icon: Mic, label: "Assistant Vocal AI inclus" },
      { icon: Percent, label: "Commission réduite" },
    ],
  },
];

const FEATURE_ICONS = {
  "Profil basique": CheckCircle, "Profil standard": CheckCircle,
  "Accès à l'annuaire": CheckCircle, "Services illimités": CheckCircle,
  "Réservations limitées": CheckCircle, "Réservations illimitées": Infinity,
  "Statistiques de base": BarChart2, "Statistiques avancées": TrendingUp,
  "Notifications clients": Eye, "Badge Pro": Award, "Badge certifié": Award,
  "Calendrier avancé": Eye, "Support prioritaire": Headphones,
  "Support dédié 24/7": Headphones,
  "Publication styles": Star, "Live streaming": Mic, "Visite 3D": Eye,
  "Commission réduite": Percent, "Tout Pro inclus": Star,
  'Mise en avant "Salon du Mois"': Eye,
  "Gestion d'équipe complète": Users, "Assistant Vocal AI inclus": Mic,
};

const WHY_PREMIUM = [
  { icon: Eye, title: "Visibilité accrue", desc: "Apparaissez en tête des résultats de recherche locaux." },
  { icon: BarChart2, title: "Décisions basées sur les données", desc: "Comprenez le comportement de vos clients grâce à nos rapports." },
  { icon: ShieldCheck, title: "Confiance instantanée", desc: "Les badges de confiance augmentent votre taux de conversion de 30%." },
];

const PAYMENT_METHODS = [
  { id: "mobile_money", label: "Mobile Money", icon: Smartphone, desc: "Orange Money, M-Pesa, Airtel Money" },
  { id: "carte", label: "Carte bancaire", icon: CreditCard, desc: "Visa, Mastercard" },
  { id: "paypal", label: "PayPal", icon: Wallet, desc: "Paiement sécurisé PayPal" },
];

// ── Cache : les icônes sont des composants (non sérialisables) → retirées à
// l'écriture, restaurées via FEATURE_ICONS à la lecture.
const serializePlans = (list) => (list || []).map(p => ({
  id: p.id, name: p.name, price: p.price, priceId: p.priceId,
  current: p.current, popular: p.popular, btnLabel: p.btnLabel,
  btnStyle: p.btnStyle, color: p.color,
  features: (p.features || []).map(f => ({ label: f.label, highlight: f.highlight })),
}));
const hydratePlans = (list) => (list || []).map(p => ({
  ...p,
  features: (p.features || []).map(f => ({ ...f, icon: FEATURE_ICONS[f.label] || CheckCircle })),
}));

export default function Abonnements() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingId, setLoadingId] = useState(null);
  const cacheKey = user?.email ? `abonnements_${user.email}` : null;
  // Affichage direct depuis le cache (plans dynamiques déjà connus),
  // rafraîchissement réseau en arrière-plan sans vider l'affichage.
  const [plans, setPlans] = useCachedState(cacheKey, FALLBACK_PLANS, c => (c?.plans?.length ? hydratePlans(c.plans) : FALLBACK_PLANS));
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
    entities.AppConfig.filter({ key: "payment_settings" }, "-created_at", 1)
      .then(res => {
        const results = res?.results || res || [];
        const row = Array.isArray(results) ? results[0] : results;
        const cfg = row?.value;
        if (cfg?.abonnement_pro) {
          const ap = cfg.abonnement_pro;
          const planIds = ["free", "pro", "premium"];
          const btnStyles = {
            free: "bg-gray-200 text-gray-600",
            pro: "bg-primary text-white shadow-lg shadow-primary/40",
            premium: "bg-[#1a2035] text-white",
          };
          const priceIds = { free: null, pro: "price_1Td7eOLaNWrAdvdeq3Tf30i5", premium: "price_1Td7eOLaNWrAdvdepth9zQuk" };
          const labels = { free: "PLAN ACTUEL", pro: "CHOISIR CE PLAN", premium: "CHOISIR CE PLAN" };
          const populars = { free: false, pro: true, premium: false };
          const colors = { free: "border-gray-200", pro: "border-primary/30", premium: "border-[#1a2035]/30" };
          const dynamicPlans = [];
          for (const key of planIds) {
            const planData = ap[key];
            if (!planData) continue;
            dynamicPlans.push({
              id: key,
              name: planData.label || key,
              price: planData.price || 0,
              priceId: priceIds[key],
              current: key === "free",
              popular: populars[key],
              btnLabel: labels[key],
              btnStyle: btnStyles[key],
              color: colors[key],
              features: (planData.features || []).map(f => ({
                icon: FEATURE_ICONS[f] || CheckCircle,
                label: f,
                highlight: key !== "free",
              })),
            });
          }
          if (dynamicPlans.length > 0) {
            setPlans(dynamicPlans);
            mergePageCache(cacheKey, { plans: serializePlans(dynamicPlans) });
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
        plan_type: "pro",
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
        await supabase.from("ProfilPro").update({
          abonnement: selectedPlan.id,
          abonnement_expires_at: expiresAt.toISOString(),
        }).eq("user_email", user.email);
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
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-[17px] font-black text-gray-900">Abonnements Pro</h1>
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
          <span className="text-[14px] font-black text-primary">{(user?.full_name || "P")[0].toUpperCase()}</span>
        </div>
      </div>

      <div className="px-4 pt-5 pb-10 space-y-4">
        {/* Hero */}
        <div className="px-1 pb-1">
          <span className="inline-block bg-orange-100 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-3">
            Propulsez votre salon
          </span>
          <h2 className="text-[28px] font-black text-gray-900 leading-tight mb-2">
            Élevez votre{" "}
            <span className="text-primary">Expérience Client</span>
          </h2>
          <p className="text-[13px] text-gray-500 font-medium leading-relaxed">
            Le plan idéal pour l'ambition de votre établissement.
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
            <div className={`bg-white rounded-3xl p-5 shadow-sm ${plan.popular ? `border-2 ${plan.color} pt-6` : ""}`}>
              <p className="text-[18px] font-black text-gray-900 mb-0.5">{plan.name}</p>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-[44px] font-black text-gray-900 leading-none">{plan.price}€</span>
                <span className="text-[15px] font-bold text-gray-400 mb-2">/mois</span>
              </div>
              <div className="space-y-3 mb-5">
                {plan.features.map(({ icon: Icon, label, highlight }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${highlight ? "text-primary" : "text-primary/60"}`} />
                    <span className={`text-[14px] ${highlight ? "font-black text-gray-900" : "font-medium text-gray-700"}`}>{label}</span>
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

        {/* Why Premium */}
        <div className="bg-[#f5f5f5] rounded-3xl p-6 mt-2">
          <h3 className="text-[22px] font-black text-gray-900 text-center leading-tight mb-6">Pourquoi passer au Premium ?</h3>
          <div className="space-y-8">
            {WHY_PREMIUM.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-2">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-1">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-[16px] font-black text-gray-900">{title}</p>
                <p className="text-[13px] text-gray-500 font-medium leading-relaxed max-w-[260px]">{desc}</p>
              </div>
            ))}
          </div>
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
                  Vous êtes maintenant <span className="text-primary font-black">{selectedPlan.name}</span>
                </p>
                <p className="text-[12px] text-gray-400 mb-8">
                  Profitez de tous vos avantages dès maintenant.
                </p>
                <button
                  onClick={() => { setSelectedPlan(null); navigate("/profil-pro"); }}
                  className="w-full py-4 bg-primary text-white rounded-2xl text-[13px] font-black uppercase tracking-widest active:scale-[0.98] transition-all"
                >
                  Voir mon profil pro
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
                  <div className={`rounded-2xl p-4 border ${selectedPlan.color}`} style={{ background: `linear-gradient(135deg, ${selectedPlan.id === "gold" ? "#1a203510" : selectedPlan.id === "premium" ? "#ff6b3510" : "#f5f5f5"}, transparent)` }}>
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
