import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import {
  ArrowLeft, RefreshCw, Loader2, Download,
  TrendingUp, TrendingDown, Users, Crown,
  BarChart3, Sparkles, ArrowUpRight, ArrowDownRight,
  Calendar, DollarSign, Star, Repeat, ChevronRight, Gift
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const periods = [
  { label: "7J", days: 7 },
  { label: "30J", days: 30 },
  { label: "90J", days: 90 },
];

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30J");
  const cacheKey = user?.email ? `analytics_${user.email}` : null;
  // Affichage direct depuis le cache : pas d'écran « chargement » intermédiaire,
  // le rafraîchissement réseau se fait en arrière-plan sans vider l'affichage.
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.reservations?.length);
  const [reservations, setReservations] = useCachedState(cacheKey, [], c => c?.reservations || []);

  useEffect(() => {
    if (!user?.email) return;
    entities.Reservation.filter({ pro_email: user.email }, "-date", 1000)
      .then(data => {
        const list = data || [];
        setReservations(list);
        mergePageCache(cacheKey, { reservations: list });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const periodDays = periods.find(p => p.label === period)?.days || 30;
  const since = startOfDay(subDays(new Date(), periodDays));
  const sincePrev = startOfDay(subDays(new Date(), periodDays * 2));

  const inPeriod = reservations.filter(r => r.date && new Date(r.date) >= since);
  const inPrevPeriod = reservations.filter(r => r.date && new Date(r.date) >= sincePrev && new Date(r.date) < since);

  const revenue = inPeriod.filter(r => r.status === "termine").reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);
  const revenuePrev = inPrevPeriod.filter(r => r.status === "termine").reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);
  const revenuePct = revenuePrev > 0 ? Math.round(((revenue - revenuePrev) / revenuePrev) * 100) : revenue > 0 ? 100 : 0;

  const clientsActive = new Set(inPeriod.filter(r => r.status !== "annule").map(r => r.client_email)).size;
  const clientsPrev = new Set(inPrevPeriod.filter(r => r.status !== "annule").map(r => r.client_email)).size;
  const clientsPct = clientsPrev > 0 ? Math.round(((clientsActive - clientsPrev) / clientsPrev) * 100) : clientsActive > 0 ? 100 : 0;

  const totalRdv = inPeriod.filter(r => r.status !== "annule").length;

  const serviceCount = {};
  const serviceRevenue = {};
  inPeriod.filter(r => r.status === "termine").forEach(r => {
    if (!r.service_name) return;
    serviceCount[r.service_name] = (serviceCount[r.service_name] || 0) + 1;
    serviceRevenue[r.service_name] = (serviceRevenue[r.service_name] || 0) + (r.total_price || r.service_price || 0);
  });
  const bestService = Object.keys(serviceCount).sort((a, b) => serviceCount[b] - serviceCount[a])[0] || null;
  const bestServicePct = bestService && revenue > 0 ? Math.round((serviceRevenue[bestService] / revenue) * 100) : 0;

  const clientsInPeriod = new Set(inPeriod.filter(r => r.status !== "annule").map(r => r.client_email));
  const clientsBefore = new Set(reservations.filter(r => r.date && new Date(r.date) < since && r.status !== "annule").map(r => r.client_email));
  const retained = [...clientsInPeriod].filter(e => clientsBefore.has(e)).length;
  const retentionRate = clientsInPeriod.size > 0 ? Math.round((retained / clientsInPeriod.size) * 100) : 0;

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayLabel = format(day, "EEE").toUpperCase().slice(0, 3);
    const revenu = reservations
      .filter(r => r.date === dayStr && r.status === "termine")
      .reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);
    return { day: dayLabel, revenu };
  });

  const popularServices = Object.entries(serviceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, revenue: serviceRevenue[name] || 0 }));

  const totalTips = inPeriod.filter(r => r.status === "termine").reduce((s, r) => s + (Number(r.tip_amount) || 0), 0);
  const totalTipsPrev = inPrevPeriod.filter(r => r.status === "termine").reduce((s, r) => s + (Number(r.tip_amount) || 0), 0);
  const tipsPct = totalTipsPrev > 0 ? Math.round(((totalTips - totalTipsPrev) / totalTipsPrev) * 100) : totalTips > 0 ? 100 : 0;
  const tipsCount = inPeriod.filter(r => r.status === "termine" && Number(r.tip_amount) > 0).length;
  const avgTip = tipsCount > 0 ? Math.round(totalTips / tipsCount) : 0;

  const sourceStats = {};
  inPeriod.filter(r => r.status !== "annule").forEach(r => {
    const s = r.source || "app";
    if (!sourceStats[s]) sourceStats[s] = { count: 0, revenue: 0 };
    sourceStats[s].count++;
    if (r.status === "termine") sourceStats[s].revenue += (r.total_price || r.service_price || 0);
  });

  const serviceTips = {};
  const serviceTipsCount = {};
  inPeriod.filter(r => r.status === "termine" && Number(r.tip_amount) > 0).forEach(r => {
    if (!r.service_name) return;
    serviceTips[r.service_name] = (serviceTips[r.service_name] || 0) + Number(r.tip_amount);
    serviceTipsCount[r.service_name] = (serviceTipsCount[r.service_name] || 0) + 1;
  });
  const topTippedServices = Object.entries(serviceTips)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total, count: serviceTipsCount[name] || 0, avg: Math.round(total / (serviceTipsCount[name] || 1)) }));

  if (loading && reservations.length === 0) {
    return (
      <div className="font-display min-h-full bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-display min-h-full bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-[#1a2035] px-5 pt-5 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center active:scale-95 transition-all">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-[20px] font-black text-white">Analytics</h1>
            <p className="text-[11px] text-primary font-bold uppercase tracking-widest">Donnees & Analyses</p>
          </div>
          <button onClick={() => { setLoading(true); entities.Reservation.filter({ pro_email: user?.email }, "-date", 1000).then(d => { const list = d || []; setReservations(list); mergePageCache(cacheKey, { reservations: list }); }).finally(() => setLoading(false)); }} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center active:scale-95 transition-all">
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white/10 rounded-xl active:scale-95 transition-all">
            <Download className="w-3.5 h-3.5 text-white" />
            <span className="text-[11px] font-black text-white uppercase tracking-widest">Exporter</span>
          </button>
          <div className="flex-1 flex items-center bg-white/10 rounded-xl p-1">
            {periods.map(p => (
              <button
                key={p.label}
                onClick={() => setPeriod(p.label)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase transition-all ${
                  period === p.label ? "bg-primary text-white shadow-lg shadow-primary/30" : "text-white/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 -mt-1 pb-10 space-y-4">

        {/* Revenue Hero Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Revenu {period}</p>
            </div>
            <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${revenuePct >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
              {revenuePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {revenuePct >= 0 ? "+" : ""}{revenuePct}%
            </span>
          </div>
          <p className="text-[44px] font-black text-gray-900 leading-none tracking-tight">{revenue} <span className="text-[28px]">EUR</span></p>
          <p className="text-[11px] text-gray-400 font-medium mt-2">vs periode precedente</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Clients Actifs */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Clients</p>
            </div>
            <p className="text-[36px] font-black text-gray-900 leading-none">{clientsActive}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-[10px] font-black ${clientsPct >= 0 ? "text-green-500" : "text-red-400"}`}>
                {clientsPct >= 0 ? "+" : ""}{clientsPct}%
              </span>
              <span className="text-[10px] text-gray-400">{period}</span>
            </div>
          </div>

          {/* RDV total */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">RDV</p>
            </div>
            <p className="text-[36px] font-black text-gray-900 leading-none">{totalRdv}</p>
            <p className="text-[10px] text-gray-400 mt-2">{period}</p>
          </div>
        </div>

        {/* Meilleure Performance */}
        <div className="bg-gradient-to-br from-[#1a2035] to-[#2a3050] rounded-3xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center">
              <Crown className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[11px] font-black text-primary uppercase tracking-widest">Meilleure Performance</p>
          </div>
          <p className="text-[20px] font-black text-white leading-tight mb-1">{bestService || "Aucune donnee"}</p>
          <p className="text-[11px] text-gray-400 font-medium mb-3">{bestServicePct}% du volume total</p>
          <div className="h-1.5 bg-white/10 rounded-full">
            <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full transition-all" style={{ width: `${bestServicePct}%` }} />
          </div>
        </div>

        {/* Source Breakdown */}
        {Object.keys(sourceStats).length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-500" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900">Sources de RDV</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(sourceStats).sort((a, b) => b[1].count - a[1].count).map(([src, data]) => {
                const totalAll = Object.values(sourceStats).reduce((s, v) => s + v.count, 0);
                const pct = totalAll > 0 ? Math.round((data.count / totalAll) * 100) : 0;
                const srcColors = {
                  app: "bg-orange-500", receptionniste: "bg-green-500",
                  receptionniste_ia: "bg-green-500", ai_social_media: "bg-violet-500", maria_ai: "bg-orange-500"
                };
                const srcLabels = {
                  app: "Application", receptionniste: "Receptionniste",
                  receptionniste_ia: "Receptionniste IA", ai_social_media: "AI Social Media", maria_ai: "Maria AI"
                };
                return (
                  <div key={src}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-gray-700">{srcLabels[src] || src}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-500">{data.count} RDV</span>
                        <span className="text-[11px] font-black text-primary">{data.revenue}€</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${srcColors[src] || "bg-gray-400"} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[16px] font-black text-gray-900">Tendances</h3>
              <p className="text-[11px] text-gray-400 font-medium">7 derniers jours</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-[10px] font-black text-gray-500 uppercase">Revenu</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fontWeight: 700, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} formatter={(v) => [`${v} EUR`, "Revenu"]} />
              <Line type="monotone" dataKey="revenu" stroke="hsl(28,90%,55%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(28,90%,55%)", strokeWidth: 0 }} activeDot={{ r: 5, fill: "hsl(28,90%,55%)", strokeWidth: 2, stroke: "#fff" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Services Populaires */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center">
                <Star className="w-4 h-4 text-orange-500" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900">Services Populaires</h3>
            </div>
          </div>
          {popularServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-[12px] text-gray-400 font-medium">Aucune donnee disponible</p>
            </div>
          ) : (
            <div className="space-y-3">
              {popularServices.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary/10" : "bg-gray-100"}`}>
                    <span className={`text-[11px] font-black ${i === 0 ? "text-primary" : "text-gray-400"}`}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">{s.name}</p>
                    <div className="h-1 bg-gray-100 rounded-full mt-1.5">
                      <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full" style={{ width: `${revenue > 0 ? Math.round((s.revenue / revenue) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-black text-primary">{s.revenue}EUR</p>
                    <p className="text-[10px] text-gray-400">{s.count} rdv</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pourboires par Service */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                <Gift className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900">Pourboires</h3>
            </div>
            {totalTips > 0 && (
              <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${tipsPct >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                {tipsPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {tipsPct >= 0 ? "+" : ""}{tipsPct}%
              </span>
            )}
          </div>

          {/* Resume rapide */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-amber-50/60 rounded-2xl p-3 text-center">
              <p className="text-[22px] font-black text-amber-600 leading-none">{totalTips}<span className="text-[12px]">EUR</span></p>
              <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-1">Total</p>
            </div>
            <div className="bg-amber-50/60 rounded-2xl p-3 text-center">
              <p className="text-[22px] font-black text-amber-600 leading-none">{tipsCount}</p>
              <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-1">Fois</p>
            </div>
            <div className="bg-amber-50/60 rounded-2xl p-3 text-center">
              <p className="text-[22px] font-black text-amber-600 leading-none">{avgTip}<span className="text-[12px]">EUR</span></p>
              <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-1">Moyen</p>
            </div>
          </div>

          {topTippedServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Gift className="w-8 h-8 text-gray-200" />
              <p className="text-[12px] text-gray-400 font-medium">Aucun pourboire pour cette periode</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topTippedServices.map((s, i) => {
                const pct = totalTips > 0 ? Math.round((s.total / totalTips) * 100) : 0;
                return (
                  <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${i === 0 ? "bg-amber-100" : "bg-gray-100"}`}>
                      <span className={`text-[11px] font-black ${i === 0 ? "text-amber-600" : "text-gray-400"}`}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 truncate">{s.name}</p>
                      <div className="h-1 bg-gray-100 rounded-full mt-1.5">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-black text-amber-600">{s.total} EUR</p>
                      <p className="text-[10px] text-gray-400">{s.count}x · {s.avg} EUR moy.</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Retention */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center">
              <Repeat className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-[15px] font-black text-gray-900">Retention</h4>
              <p className="text-[11px] text-gray-400 font-medium">Clients qui reviennent</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[40px] font-black text-gray-900 leading-none">{retentionRate}%</span>
            <span className="text-[13px] font-black text-gray-400">{retained} clients</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full mt-3">
            <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all" style={{ width: `${retentionRate}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
