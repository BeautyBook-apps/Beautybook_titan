import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Copy, Check, Sparkles, Crown, Gem, Star,
  Scissors, Gift, Tag, UtensilsCrossed, Wine, Dumbbell,
  Ticket, Clapperboard, Hotel, Home, Car, Package, ShoppingBag,
  TrendingUp, Users, CalendarCheck, MessageSquareHeart, Zap
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { reconcileClientPoints } from '@/lib/fideliteClient';
import ProgrammeProCard from "@/components/fidelite/ProgrammeProCard";
import { readIsProCache, writeIsProCache } from "@/hooks/useIsPro";

const LEVELS = [
  { name: "Silver", pts: 0, icon: Crown, color: "from-gray-400 to-gray-500", bg: "bg-gray-100", text: "text-gray-600" },
  { name: "Gold", pts: 1000, icon: Star, color: "from-yellow-400 to-amber-500", bg: "bg-amber-50", text: "text-amber-600" },
  { name: "Platinum", pts: 2500, icon: Gem, color: "from-cyan-400 to-blue-500", bg: "bg-blue-50", text: "text-blue-600" },
];

const REWARDS = [
  { id: "r1", icon: Scissors, label: "Soin Visage Gratuit", desc: "Manucure ou Hydrafacial offert", pts: 800, cat: "Beauté", color: "text-pink-500", bg: "bg-pink-50" },
  { id: "r2", icon: Scissors, label: "Coupe Offerte", desc: "Coupe + brushing dans un salon partenaire", pts: 1200, cat: "Beauté", color: "text-rose-500", bg: "bg-rose-50" },
  { id: "r3", icon: Gift, label: "Coupon –10€", desc: "Valable sur tous les services BeautyBook", pts: 400, cat: "Beauté", color: "text-orange-500", bg: "bg-orange-50" },
  { id: "r4", icon: UtensilsCrossed, label: "–20% Restaurant", desc: "Réduction sur votre addition dans 200+ restos", pts: 500, cat: "Restaurant", color: "text-amber-500", bg: "bg-amber-50" },
  { id: "r5", icon: Wine, label: "Apéritif Offert", desc: "Boisson offerte dès 2 couverts", pts: 300, cat: "Restaurant", color: "text-red-500", bg: "bg-red-50" },
  { id: "r6", icon: Dumbbell, label: "Séance Sport Offerte", desc: "1 séance gratuite dans une salle partenaire", pts: 600, cat: "Loisirs", color: "text-emerald-500", bg: "bg-emerald-50" },
  { id: "r7", icon: Ticket, label: "–30% Parc Loisirs", desc: "Réduction sur l'entrée d'un parc d'attractions", pts: 700, cat: "Loisirs", color: "text-violet-500", bg: "bg-violet-50" },
  { id: "r8", icon: Clapperboard, label: "2 Places Cinéma", desc: "2 places offertes dans les cinémas partenaires", pts: 550, cat: "Loisirs", color: "text-indigo-500", bg: "bg-indigo-50" },
  { id: "r9", icon: Hotel, label: "Nuit d'Hôtel –25%", desc: "Réduction dans les hôtels & spas partenaires", pts: 1500, cat: "Séjours", color: "text-cyan-500", bg: "bg-cyan-50" },
  { id: "r10", icon: Home, label: "Location Weekend", desc: "–15% sur une location Airbnb partenaire", pts: 1800, cat: "Séjours", color: "text-teal-500", bg: "bg-teal-50" },
  { id: "r11", icon: Car, label: "Location Voiture", desc: "1 journée de location offerte chez nos partenaires", pts: 1000, cat: "Séjours", color: "text-sky-500", bg: "bg-sky-50" },
  { id: "r12", icon: Package, label: "Livraison Offerte", desc: "Frais de port offerts sur toute la boutique", pts: 150, cat: "Boutique", color: "text-lime-500", bg: "bg-lime-50" },
  { id: "r13", icon: ShoppingBag, label: "–15% Boutique", desc: "Réduction sur une commande boutique", pts: 350, cat: "Boutique", color: "text-fuchsia-500", bg: "bg-fuchsia-50" },
];

const CATS = ["Tout", "Beauté", "Restaurant", "Loisirs", "Séjours", "Boutique"];

const HOW_TO_EARN = [
  { icon: Scissors, label: "Réservation service beauté", pts: "+50 pts", color: "text-pink-500", bg: "bg-pink-50" },
  { icon: ShoppingBag, label: "Achat en boutique (par 10€)", pts: "+10 pts", color: "text-orange-500", bg: "bg-orange-50" },
  { icon: MessageSquareHeart, label: "Laisser un avis", pts: "+30 pts", color: "text-amber-500", bg: "bg-amber-50" },
  { icon: Users, label: "Parrainer un(e) ami(e)", pts: "+200 pts", color: "text-emerald-500", bg: "bg-emerald-50" },
  { icon: CalendarCheck, label: "RDV honoré sans annulation", pts: "+20 pts", color: "text-blue-500", bg: "bg-blue-50" },
];

function getNiveau(pts) {
  return [...LEVELS].reverse().find(l => l.pts <= pts) || LEVELS[0];
}
function getNextNiveau(pts) {
  return LEVELS.find(l => l.pts > pts) || LEVELS[LEVELS.length - 1];
}

export default function ProgrammeFidelite() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const email = user?.email;
  const cacheKey = email ? `fidelite_${email}` : null;
  // Affichage direct depuis le cache : la première peinture montre les derniers
  // points connus, le rafraîchissement réseau se fait en arrière-plan.
  const [record, setRecord] = useCachedState(cacheKey, null, c => c?.record ?? null);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.record);
  const [activeCat, setActiveCat] = useState("Tout");
  const [copied, setCopied] = useState(false);
  const [redeeming, setRedeeming] = useState(null);
  const [toast, setToast] = useState(null);
  const [isPro, setIsPro] = useState(readIsProCache);

  const role = user?.role;
  useEffect(() => {
    if (!email) return;
    if (role === "vendeur" || role === "pro" || role === "admin") { setIsPro(true); writeIsProCache(true); return; }
    let cancelled = false;
    Promise.all([
      entities.DemandeProV2.filter({ user_email: email, statut: "approuvee" }, null, 1),
      entities.PointsFidelitePro.filter({ pro_email: email }, null, 1),
    ]).then(([demandes, pointsPro]) => {
      if (cancelled) return;
      const pro = demandes.length > 0 || pointsPro.length > 0;
      setIsPro(pro);
      writeIsProCache(pro);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [email, role]);

  const fullName = user?.full_name;
  // Persiste chaque chargement réussi en cache (jamais de reset d'affichage).
  const persistRecord = (r) => {
    setRecord(r);
    mergePageCache(cacheKey, { record: r });
  };
  useEffect(() => {
    if (!email) { setLoading(false); return; }
    let cancelled = false;
    entities.PointsFidelite.filter({ user_email: email }, null, 1)
      .then(results => {
        if (cancelled) return;
        if (results.length > 0) {
          persistRecord(results[0]);
        } else {
          const code = (fullName || "USER").split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "") + Math.floor(1000 + Math.random() * 9000);
          const payload = {
            user_email: email,
            points_total: 0,
            points_depenses: 0,
            niveau: "Silver",
            historique: [],
          };
          entities.PointsFidelite.create({ ...payload, code_parrainage: code })
            .then(r => { if (!cancelled) persistRecord(r); })
            .catch(() => entities.PointsFidelite.create(payload).then(r => { if (!cancelled) persistRecord(r); }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        reconcileClientPoints(email).then(() => {
          if (!cancelled) {
            entities.PointsFidelite.filter({ user_email: email }, null, 1).then(results => {
              if (!cancelled && results.length > 0) persistRecord(results[0]);
            });
          }
        }).catch(() => {});
      });
    return () => { cancelled = true; };
  }, [email]);

  const userPts = (record?.points_total || 0) - (record?.points_depenses || 0);
  const currentLevel = getNiveau(userPts);
  const nextLevel = getNextNiveau(userPts);
  const progress = currentLevel.pts === nextLevel.pts ? 100 : Math.min(((userPts - currentLevel.pts) / (nextLevel.pts - currentLevel.pts)) * 100, 100);
  const ptsToNext = Math.max(nextLevel.pts - userPts, 0);
  const historique = record?.historique || [];
  const refCode = record?.code_parrainage || "---";
  const filteredRewards = activeCat === "Tout" ? REWARDS : REWARDS.filter(r => r.cat === activeCat);

  const handleCopy = () => {
    navigator.clipboard.writeText(refCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleRedeem = async (reward) => {
    if (!record) return;
    if (userPts < reward.pts) { showToast("Points insuffisants pour cette récompense"); return; }
    setRedeeming(reward.id);
    const newHistorique = [
      { label: `Échange : ${reward.label}`, pts: -reward.pts, date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }), type: "debit" },
      ...historique,
    ];
    const updatedNiveau = getNiveau(userPts - reward.pts).name;
    await entities.PointsFidelite.update(record.id, {
      points_depenses: (record.points_depenses || 0) + reward.pts,
      niveau: updatedNiveau,
      historique: newHistorique,
    });
    persistRecord({ ...record, points_depenses: (record.points_depenses || 0) + reward.pts, niveau: updatedNiveau, historique: newHistorique });
    setRedeeming(null);
    showToast(`${reward.label} échangé avec succès !`);
  };

  const LevelIcon = currentLevel.icon;

  if (loading && !record) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] bg-gray-900 text-white text-[13px] font-bold px-5 py-3 rounded-2xl shadow-xl max-w-[320px] text-center flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <div>
          <h1 className="text-[20px] font-black text-gray-900">Programme Fidélité</h1>
          <div className="flex items-center gap-1.5">
            <LevelIcon className={`w-3.5 h-3.5 ${currentLevel.text}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${currentLevel.text}`}>Niveau {currentLevel.name}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-24 pt-4 space-y-5">

        {isPro ? (
          <ProgrammeProCard user={user} />
        ) : (
          <>
            {/* Points card */}
            <div data-tour="fidelite-points" className="bg-gradient-to-br from-primary to-orange-400 rounded-3xl p-5 shadow-lg shadow-primary/30">
              <p className="text-white/80 text-[12px] font-black uppercase tracking-widest mb-0.5">{user?.full_name?.toUpperCase() || "MON COMPTE"}</p>
              <div className="flex items-end justify-between">
                <p className="text-white text-[48px] font-black leading-none">
                  {userPts.toLocaleString()} <span className="text-[24px]">pts</span>
                </p>
                <div className="bg-white/20 border border-white/30 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                  <LevelIcon className="w-6 h-6 text-white" />
                  <p className="text-white text-[12px] font-black">{currentLevel.name}</p>
                </div>
              </div>
              {currentLevel.name !== "Platinum" && (
                <>
                  <p className="text-white/70 text-[11px] font-medium mt-3">Vers {nextLevel.name}</p>
                  <div className="mt-1.5 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-white/60 text-[11px] font-medium mt-1 text-right">encore {ptsToNext.toLocaleString()} pts</p>
                </>
              )}
              {currentLevel.name === "Platinum" && (
                <div className="flex items-center gap-2 mt-3">
                  <Sparkles className="w-4 h-4 text-white/80" />
                  <p className="text-white/80 text-[13px] font-bold">Niveau maximum atteint !</p>
                </div>
              )}
            </div>

            {/* Progression niveaux */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-widest mb-5">Progression</p>
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 right-0 top-6 h-1 bg-gray-100 mx-8 z-0" />
                {LEVELS.map((lv) => {
                  const LvIcon = lv.icon;
                  const active = lv.name === currentLevel.name;
                  const done = lv.pts < userPts;
                  return (
                    <div key={lv.name} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                      <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all ${active ? "border-primary bg-orange-50 scale-110 shadow-md shadow-primary/20" : done ? "border-primary bg-white" : "border-gray-200 bg-white"}`}>
                        <LvIcon className={`w-5 h-5 ${active ? "text-primary" : done ? "text-primary" : "text-gray-300"}`} />
                      </div>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${active ? "text-primary" : "text-gray-400"}`}>{lv.name}</span>
                      <span className="text-[9px] text-gray-300 font-medium">{lv.pts === 0 ? "Gratuit" : `${lv.pts.toLocaleString()} pts`}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Récompenses */}
            <div data-tour="fidelite-rewards">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-widest mb-3 px-1">Récompenses</p>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 -mx-4 px-4">
                {CATS.map(cat => (
                  <button key={cat} onClick={() => setActiveCat(cat)}
                    className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black border transition-all active:scale-95 ${activeCat === cat ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200"}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredRewards.map(r => {
                  const canAfford = userPts >= r.pts;
                  const isLoadingItem = redeeming === r.id;
                  const RIcon = r.icon;
                  return (
                    <div key={r.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                      <div className={`w-12 h-12 ${r.bg} rounded-2xl flex items-center justify-center shrink-0`}>
                        <RIcon className={`w-5 h-5 ${r.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-black text-gray-900 truncate">{r.label}</p>
                          <span className="shrink-0 text-[9px] font-black bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full uppercase tracking-wider">{r.cat}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">{r.desc}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Zap className={`w-3 h-3 ${canAfford ? "text-primary" : "text-gray-300"}`} />
                          <p className={`text-[12px] font-black ${canAfford ? "text-primary" : "text-gray-300"}`}>{r.pts.toLocaleString()} pts</p>
                        </div>
                      </div>
                      <button onClick={() => handleRedeem(r)} disabled={!canAfford || !!redeeming}
                        className={`text-[11px] font-black px-4 py-2.5 rounded-xl active:scale-95 transition-all shrink-0 flex items-center gap-1.5 ${canAfford ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-gray-100 text-gray-300"}`}>
                        {isLoadingItem ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : canAfford ? (
                          <>
                            <Gift className="w-3.5 h-3.5" />
                            Échanger
                          </>
                        ) : "Bientôt"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div>
                <p className="text-[13px] font-black text-gray-900 uppercase tracking-widest mb-3 px-1">Historique</p>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">
                  {historique.slice(0, 10).map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${h.pts > 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                          {h.pts > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <Gift className="w-4 h-4 text-red-400" />}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-gray-900">{h.label}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{h.date}</p>
                        </div>
                      </div>
                      <span className={`text-[15px] font-black ${h.pts > 0 ? "text-emerald-500" : "text-red-400"}`}>
                        {h.pts > 0 ? "+" : ""}{h.pts} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {historique.length === 0 && (
              <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center gap-3 shadow-sm">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <p className="text-[14px] font-black text-gray-700">Commencez à gagner des points !</p>
                <p className="text-[12px] text-gray-400 font-medium">Réservez un service, achetez en boutique ou parrainez des amies pour accumuler des points.</p>
              </div>
            )}

            {/* Parrainage */}
            <div className="bg-[#1e2535] rounded-3xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-white text-[15px] font-black">Parrainez vos amies</p>
                  <p className="text-white/60 text-[11px] font-medium">+200 pts pour vous · +100 pts pour elles</p>
                </div>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-2xl flex items-center justify-between px-4 py-3">
                <span className="text-white text-[16px] font-black tracking-widest">{refCode}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-primary text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all">
                  {copied ? <><Check className="w-4 h-4" /> Copié !</> : <><Copy className="w-4 h-4" /> Copier</>}
                </button>
              </div>
            </div>

            {/* Comment gagner */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-widest mb-4">Comment gagner des points ?</p>
              <div className="space-y-3">
                {HOW_TO_EARN.map((g, i) => {
                  const GIcon = g.icon;
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${g.bg} rounded-xl flex items-center justify-center`}>
                          <GIcon className={`w-4 h-4 ${g.color}`} />
                        </div>
                        <span className="text-[13px] font-medium text-gray-700">{g.label}</span>
                      </div>
                      <span className="text-[13px] font-black text-emerald-500">{g.pts}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
