import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import BeautyImage from "@/components/ui/BeautyImage";
import { useTheme } from "@/hooks/useTheme";
import {
  ArrowLeft, BarChart3, CalendarDays, Eye, Heart, MessageCircle,
  MousePointerClick, RefreshCw, Sparkles, Target, TrendingUp, Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PERIODS = [{ label: "7 jours", days: 7 }, { label: "30 jours", days: 30 }, { label: "90 jours", days: 90 }];
const number = value => Number(value || 0).toLocaleString("fr-FR");
const short = value => { const n = Number(value || 0); return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); };
const dayKey = date => new Date(date).toISOString().slice(0, 10);
const dayLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "");

const PALETTE = {
  light: { page: "bg-[#f6f7fb] text-slate-950", card: "bg-white border-slate-200/80", cardSoft: "bg-slate-50", title: "text-slate-950", body: "text-slate-500", muted: "text-slate-400", header: "from-[#151327] via-[#34205b] to-[#e15f2d]", grid: "#e2e8f0", axis: "#64748b", active: "bg-slate-950 text-white", inactive: "bg-slate-100 text-slate-500", selected: "bg-orange-50 ring-1 ring-orange-200", inset: "bg-slate-950/10" },
  dark: { page: "bg-[#1a1a2e] text-gray-100", card: "bg-[#1f2937] border-gray-700", cardSoft: "bg-[#111827]", title: "text-white", body: "text-gray-300", muted: "text-gray-400", header: "from-[#08090f] via-[#17152d] to-[#4c347c]", grid: "#374151", axis: "#9ca3af", active: "bg-orange-500 text-white", inactive: "bg-white/10 text-white/70", selected: "bg-orange-500/15 ring-1 ring-orange-500/30", inset: "bg-white/10" },
  night: { page: "bg-black text-gray-100", card: "bg-[#0a0a0a] border-gray-800", cardSoft: "bg-[#111111]", title: "text-white", body: "text-gray-300", muted: "text-gray-400", header: "from-black via-[#09090f] to-[#321d52]", grid: "#222222", axis: "#9ca3af", active: "bg-white text-black", inactive: "bg-white/10 text-white/70", selected: "bg-orange-500/15 ring-1 ring-orange-500/30", inset: "bg-white/10" },
};

function MetricCard({ ui, icon: Icon, label, value, hint, color }) {
  const colors = { orange: "bg-orange-500/15 text-orange-500", rose: "bg-rose-500/15 text-rose-500", blue: "bg-blue-500/15 text-blue-500", green: "bg-emerald-500/15 text-emerald-500" };
  return <div className={`rounded-[26px] border p-4 shadow-sm ${ui.card}`}><div className="flex items-start justify-between gap-3"><div><p className={`text-[10px] font-black uppercase tracking-[.18em] ${ui.muted}`}>{label}</p><p className={`mt-2 text-[28px] font-black tracking-tight ${ui.title}`}>{value}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${colors[color]}`}><Icon className="h-5 w-5" /></span></div><p className={`mt-2 text-[10px] font-medium ${ui.body}`}>{hint}</p></div>;
}

function ChartTooltip({ ui, active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className={`rounded-2xl border p-3 text-[11px] shadow-2xl ${ui.card}`}><p className={`mb-2 font-black ${ui.title}`}>{label}</p>{payload.map(item => <p key={item.dataKey} className={`flex justify-between gap-5 ${ui.body}`}><span>{item.name}</span><b className={ui.title}>{number(item.value)}</b></p>)}</div>;
}

export default function PublicationAnalyticsRedesigned() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const ui = PALETTE[theme] || PALETTE.light;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedReelId = params.get("reel");
  const [period, setPeriod] = useState(30);
  const [selectedId, setSelectedId] = useState(requestedReelId || "");
  const [data, setData] = useState({ reels: [], likes: [], comments: [], views: [], ads: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true); setError("");
    try {
      const [emailReels, ownerReels, likesResult, commentsResult, viewsResult, emailAds, ownerAds] = await Promise.all([
        supabase.from("Reel").select("id,title,thumbnail_url,views,likes,comments_count,created_at,author_email,created_by_id").eq("author_email", user.email).order("created_at", { ascending: false }).limit(500),
        user.id ? supabase.from("Reel").select("id,title,thumbnail_url,views,likes,comments_count,created_at,author_email,created_by_id").eq("created_by_id", user.id).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
        supabase.from("user_like").select("target_id,created_at").eq("target_type", "reel").limit(10000),
        supabase.from("reel_comment").select("reel_id,created_at").limit(10000),
        supabase.from("reel_view_event").select("reel_id,created_at").limit(20000),
        supabase.from("Annonce").select("id,title,impressions,clicks,budget,created_at,status,pro_email,created_by_id").eq("pro_email", user.email).limit(200),
        user.id ? supabase.from("Annonce").select("id,title,impressions,clicks,budget,created_at,status,pro_email,created_by_id").eq("created_by_id", user.id).limit(200) : Promise.resolve({ data: [] }),
      ]);
      const reels = [...new Map([...(emailReels.data || []), ...(ownerReels.data || [])].map(row => [row.id, row])).values()];
      const ids = new Set(reels.map(row => String(row.id)));
      const onlyMine = (rows, key) => (rows || []).filter(row => ids.has(String(row[key])));
      const views = viewsResult.error ? [] : onlyMine(viewsResult.data, "reel_id");
      const comments = commentsResult.error ? [] : onlyMine(commentsResult.data, "reel_id");
      const likes = onlyMine(likesResult.data, "target_id");
      const ads = [...new Map([...(emailAds.data || []), ...(ownerAds.data || [])].map(row => [row.id, row])).values()];
      setData({ reels, likes, comments, views, ads });
      if (!requestedReelId && reels[0]?.id) setSelectedId(value => value || String(reels[0].id));
    } catch (loadError) { setError(loadError?.message || "Les données analytiques sont indisponibles."); }
    finally { setLoading(false); }
  }, [requestedReelId, user?.email, user?.id]);

  useEffect(() => { load(); }, [load]);

  const since = useMemo(() => Date.now() - period * 86400000, [period]);
  const periodRows = useMemo(() => ({
    likes: data.likes.filter(row => new Date(row.created_at).getTime() >= since),
    comments: data.comments.filter(row => new Date(row.created_at).getTime() >= since),
    views: data.views.filter(row => new Date(row.created_at).getTime() >= since),
  }), [data, since]);
  const totals = useMemo(() => ({
    views: periodRows.views.length || data.reels.reduce((sum, row) => sum + Number(row.views || 0), 0),
    likes: periodRows.likes.length || data.reels.reduce((sum, row) => sum + Number(row.likes || 0), 0),
    comments: periodRows.comments.length || data.reels.reduce((sum, row) => sum + Number(row.comments_count || 0), 0),
  }), [data.reels, periodRows]);
  const engagement = totals.views ? Math.round(((totals.likes + totals.comments) / totals.views) * 1000) / 10 : 0;
  const chartData = useMemo(() => {
    const rows = Array.from({ length: period }, (_, index) => { const date = new Date(Date.now() - (period - index - 1) * 86400000); const day = dayKey(date); return { day, label: dayLabel(day), views: 0, likes: 0, comments: 0 }; });
    const byDay = new Map(rows.map(row => [row.day, row]));
    periodRows.views.forEach(row => { const item = byDay.get(dayKey(row.created_at)); if (item) item.views += 1; });
    periodRows.likes.forEach(row => { const item = byDay.get(dayKey(row.created_at)); if (item) item.likes += 1; });
    periodRows.comments.forEach(row => { const item = byDay.get(dayKey(row.created_at)); if (item) item.comments += 1; });
    return rows;
  }, [period, periodRows]);
  const performance = useMemo(() => data.reels.map(reel => {
    const likes = data.likes.filter(row => String(row.target_id) === String(reel.id)).length || Number(reel.likes || 0);
    const comments = data.comments.filter(row => String(row.reel_id) === String(reel.id)).length || Number(reel.comments_count || 0);
    const views = data.views.filter(row => String(row.reel_id) === String(reel.id)).length || Number(reel.views || 0);
    return { ...reel, likes, comments, views, rate: views ? Math.round(((likes + comments) / views) * 1000) / 10 : 0 };
  }).sort((a, b) => b.views - a.views), [data]);
  const selected = performance.find(row => String(row.id) === String(selectedId)) || performance[0];
  const adStats = data.ads.reduce((result, row) => ({ impressions: result.impressions + Number(row.impressions || 0), clicks: result.clicks + Number(row.clicks || 0), budget: result.budget + Number(row.budget || 0) }), { impressions: 0, clicks: 0, budget: 0 });
  const ctr = adStats.impressions ? Math.round((adStats.clicks / adStats.impressions) * 1000) / 10 : 0;

  if (!user?.email) return <div className={`flex min-h-[60vh] items-center justify-center text-sm font-bold ${ui.muted}`}>Connectez-vous pour voir vos données analytiques.</div>;

  return <div className={`analytics-redesigned min-h-full pb-12 font-display ${ui.page}`} data-theme={theme}>
    <header className={`relative overflow-hidden bg-gradient-to-br px-4 pb-5 pt-4 text-white ${ui.header}`}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
      <div className="relative mx-auto max-w-5xl">
        <div className="flex items-center gap-3"><button onClick={() => navigate(-1)} aria-label="Retour" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.24em] text-orange-200">Studio créateur</p><h1 className="mt-1 truncate text-2xl font-black">Vue d’ensemble</h1></div><button onClick={load} aria-label="Actualiser" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 transition active:scale-95"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="max-w-lg text-sm font-medium leading-relaxed text-white/75">Suivez la portée de vos créations, comprenez votre audience et développez votre visibilité.</p><div className="mt-3 flex gap-2 text-[10px] font-black text-white/75"><span className="rounded-full bg-white/10 px-3 py-1.5">{number(data.reels.length)} publications</span><span className="rounded-full bg-white/10 px-3 py-1.5">{number(data.ads.length)} campagnes</span></div></div><div className="flex gap-2 overflow-x-auto pb-1">{PERIODS.map(item => <button key={item.days} onClick={() => setPeriod(item.days)} className={`min-h-10 shrink-0 rounded-xl px-4 text-[11px] font-black ${period === item.days ? ui.active : ui.inactive}`}>{item.label}</button>)}</div></div>
      </div>
    </header>

    <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4 sm:px-6">
      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
      {loading && !data.reels.length ? <div className="flex min-h-[320px] items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-500" /></div> : <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard ui={ui} icon={Eye} label="Vues" value={short(totals.views)} hint="Portée de vos publications" color="orange" /><MetricCard ui={ui} icon={Heart} label="Likes" value={short(totals.likes)} hint="Réactions obtenues" color="rose" /><MetricCard ui={ui} icon={MessageCircle} label="Commentaires" value={short(totals.comments)} hint="Discussions générées" color="blue" /><MetricCard ui={ui} icon={TrendingUp} label="Engagement" value={`${engagement}%`} hint="Likes + commentaires / vues" color="green" /></section>

        <section className={`rounded-[28px] border p-5 shadow-sm ${ui.card}`}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500"><TrendingUp className="h-4 w-4" /></span><div><h2 className={`text-base font-black ${ui.title}`}>Votre audience au fil du temps</h2><p className={`mt-1 text-[11px] ${ui.body}`}>Les signaux clés de la période sélectionnée.</p></div></div></div><div className={`flex flex-wrap gap-3 text-[10px] font-bold ${ui.body}`}><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-orange-500" />Vues</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" />Likes</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-500" />Commentaires</span></div></div><div className="mt-4 h-[245px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}><defs><linearGradient id="analyticsOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={.32} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={ui.grid} /><XAxis dataKey="label" tick={{ fontSize: 9, fill: ui.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: ui.axis }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip ui={ui} />} /><Area type="monotone" dataKey="views" name="Vues" stroke="#f97316" fill="url(#analyticsOrange)" strokeWidth={2.5} /><Area type="monotone" dataKey="likes" name="Likes" stroke="#f43f5e" fill="transparent" strokeWidth={2} /><Area type="monotone" dataKey="comments" name="Commentaires" stroke="#3b82f6" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>{!data.views.length && <p className={`text-center text-[10px] ${ui.muted}`}>Les nouvelles vues alimenteront automatiquement cette courbe.</p>}</section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]"><div className={`rounded-[28px] border p-5 shadow-sm ${ui.card}`}><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500"><BarChart3 className="h-4 w-4" /></span><div><h2 className={`text-base font-black ${ui.title}`}>Publications à la une</h2><p className={`mt-1 text-[11px] ${ui.body}`}>Touchez une publication pour voir son détail.</p></div></div><div className="mt-4 space-y-2">{performance.length ? performance.slice(0, 6).map(row => <button key={row.id} onClick={() => setSelectedId(String(row.id))} className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${String(selected?.id) === String(row.id) ? ui.selected : "hover:bg-black/5 dark:hover:bg-white/5"}`}><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">{row.thumbnail_url && <BeautyImage src={row.thumbnail_url} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className={`truncate text-[12px] font-black ${ui.title}`}>{row.title || "Publication sans titre"}</p><p className={`mt-1 text-[10px] ${ui.body}`}>{short(row.views)} vues · {short(row.likes)} likes · {short(row.comments)} commentaires</p></div><span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-500">{row.rate}%</span></button>) : <p className={`py-8 text-center text-sm ${ui.muted}`}>Aucune publication disponible.</p>}</div></div><div className={`rounded-[28px] p-5 text-white shadow-xl ${theme === "light" ? "bg-gradient-to-br from-[#171426] via-[#34205b] to-[#a84a35]" : "bg-gradient-to-br from-[#111827] via-[#241538] to-[#4a235e]"}`}><div className="flex items-center gap-2 text-orange-300"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[.18em]">Détail sélectionné</span></div><h2 className="mt-3 line-clamp-2 text-xl font-black">{selected?.title || "Sélectionnez une publication"}</h2><div className="mt-6 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/10 p-3"><Eye className="h-4 w-4 text-orange-300" /><p className="mt-2 text-lg font-black">{short(selected?.views)}</p><p className="text-[9px] font-bold text-white/55">VUES</p></div><div className="rounded-2xl bg-white/10 p-3"><Heart className="h-4 w-4 text-rose-300" /><p className="mt-2 text-lg font-black">{short(selected?.likes)}</p><p className="text-[9px] font-bold text-white/55">LIKES</p></div><div className="rounded-2xl bg-white/10 p-3"><MessageCircle className="h-4 w-4 text-blue-300" /><p className="mt-2 text-lg font-black">{short(selected?.comments)}</p><p className="text-[9px] font-bold text-white/55">COMMENTAIRES</p></div></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-3"><span className="text-[10px] font-bold text-white/65">Taux d’engagement</span><b className="text-lg text-orange-200">{selected?.rate || 0}%</b></div></div></section>

        <section className={`rounded-[28px] border p-5 shadow-sm ${ui.card}`}><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500"><Target className="h-4 w-4" /></span><div><h2 className={`text-base font-black ${ui.title}`}>Publicité et visibilité</h2><p className={`mt-1 text-[11px] ${ui.body}`}>Les résultats de vos campagnes sont centralisés ici.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className={`rounded-2xl p-4 ${theme === "light" ? "bg-orange-50" : "bg-orange-500/15"}`}><Users className="h-4 w-4 text-orange-500" /><p className={`mt-3 text-2xl font-black ${ui.title}`}>{number(adStats.impressions)}</p><p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Impressions</p></div><div className={`rounded-2xl p-4 ${theme === "light" ? "bg-blue-50" : "bg-blue-500/15"}`}><MousePointerClick className="h-4 w-4 text-blue-500" /><p className={`mt-3 text-2xl font-black ${ui.title}`}>{number(adStats.clicks)}</p><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Clics</p></div><div className={`rounded-2xl p-4 ${theme === "light" ? "bg-emerald-50" : "bg-emerald-500/15"}`}><TrendingUp className="h-4 w-4 text-emerald-500" /><p className={`mt-3 text-2xl font-black ${ui.title}`}>{ctr}%</p><p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">CTR moyen</p></div></div><p className={`mt-4 flex items-center gap-2 text-[10px] ${ui.muted}`}><CalendarDays className="h-3.5 w-3.5" /> {data.ads.length} campagne{data.ads.length > 1 ? "s" : ""} rattachée{data.ads.length > 1 ? "s" : ""} à votre compte</p></section>
      </>}
    </main>
  </div>;
}
