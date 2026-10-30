import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import BeautyImage from "@/components/ui/BeautyImage";
import {
  ArrowLeft, BarChart3, CalendarDays, Eye, Heart, MessageCircle,
  MousePointerClick, RefreshCw, Sparkles, Target, TrendingUp, Users,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

const PERIODS = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
];

const metric = (value) => Number(value || 0).toLocaleString("fr-FR");
const dateKey = (date) => new Date(date).toISOString().slice(0, 10);
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "");

function Kpi({ icon: Icon, label, value, hint, tone }) {
  const colors = {
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-2 text-[10px] font-medium text-slate-500">{hint}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] shadow-xl">
      <p className="mb-2 font-black text-slate-800">{label}</p>
      {payload.map(item => <p key={item.dataKey} className="flex items-center justify-between gap-5 text-slate-600"><span>{item.name}</span><strong className="text-slate-900">{metric(item.value)}</strong></p>)}
    </div>
  );
}

export default function PublicationAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReelId = searchParams.get("reel");
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState({ reels: [], likes: [], comments: [], views: [], ads: [] });
  const [selectedReelId, setSelectedReelId] = useState(requestedReelId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError("");
    try {
      const [emailReels, ownerReels, likesResult, commentsResult, viewsResult, emailAds, ownerAds] = await Promise.all([
        supabase.from("Reel").select("id,title,thumbnail_url,views,likes,comments_count,created_at,author_email,created_by_id,is_sponsored").eq("author_email", user.email).order("created_at", { ascending: false }).limit(500),
        user.id ? supabase.from("Reel").select("id,title,thumbnail_url,views,likes,comments_count,created_at,author_email,created_by_id,is_sponsored").eq("created_by_id", user.id).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
        supabase.from("user_like").select("target_id,created_at").eq("target_type", "reel").limit(10000),
        supabase.from("reel_comment").select("reel_id,created_at").limit(10000),
        supabase.from("reel_view_event").select("reel_id,created_at").limit(20000),
        supabase.from("Annonce").select("id,title,impressions,clicks,budget,created_at,status,pro_email,created_by_id").eq("pro_email", user.email).limit(200),
        user.id ? supabase.from("Annonce").select("id,title,impressions,clicks,budget,created_at,status,pro_email,created_by_id").eq("created_by_id", user.id).limit(200) : Promise.resolve({ data: [], error: null }),
      ]);
      const reels = [...new Map([...(emailReels.data || []), ...(ownerReels.data || [])].map(row => [row.id, row])).values()];
      const reelIds = new Set(reels.map(row => String(row.id)));
      const filterEvents = (rows, key) => (rows || []).filter(row => reelIds.has(String(row[key])));
      const views = viewsResult.error ? [] : filterEvents(viewsResult.data, "reel_id");
      const likes = filterEvents(likesResult.data, "target_id");
      const comments = commentsResult.error ? [] : filterEvents(commentsResult.data, "reel_id");
      const ads = [...new Map([...(emailAds.data || []), ...(ownerAds.data || [])].map(row => [row.id, row])).values()];
      setData({ reels, likes, comments, views, ads });
      if (!requestedReelId && reels[0]?.id) setSelectedReelId(current => current || String(reels[0].id));
    } catch (loadError) {
      setError(loadError?.message || "Les données analytiques sont indisponibles.");
    } finally {
      setLoading(false);
    }
  }, [requestedReelId, user?.email, user?.id]);

  useEffect(() => { load(); }, [load]);

  const since = useMemo(() => Date.now() - period * 86400000, [period]);
  const periodLikes = useMemo(() => data.likes.filter(row => new Date(row.created_at).getTime() >= since), [data.likes, since]);
  const periodComments = useMemo(() => data.comments.filter(row => new Date(row.created_at).getTime() >= since), [data.comments, since]);
  const periodViews = useMemo(() => data.views.filter(row => new Date(row.created_at).getTime() >= since), [data.views, since]);
  const totalViews = periodViews.length > 0 ? periodViews.length : data.reels.reduce((sum, row) => sum + Number(row.views || 0), 0);
  const engagementRate = totalViews > 0 ? Math.round(((periodLikes.length + periodComments.length) / totalViews) * 1000) / 10 : 0;
  const selectedReel = data.reels.find(row => String(row.id) === String(selectedReelId)) || data.reels[0];

  const chartData = useMemo(() => {
    const days = Array.from({ length: period }, (_, index) => {
      const date = new Date(Date.now() - (period - index - 1) * 86400000);
      const day = dateKey(date);
      return { day, label: dateLabel(day), views: 0, likes: 0, comments: 0 };
    });
    const byDay = new Map(days.map(row => [row.day, row]));
    periodViews.forEach(row => { const item = byDay.get(dateKey(row.created_at)); if (item) item.views += 1; });
    periodLikes.forEach(row => { const item = byDay.get(dateKey(row.created_at)); if (item) item.likes += 1; });
    periodComments.forEach(row => { const item = byDay.get(dateKey(row.created_at)); if (item) item.comments += 1; });
    return days;
  }, [period, periodComments, periodLikes, periodViews]);

  const performance = useMemo(() => data.reels.map(reel => {
    const likes = data.likes.filter(row => String(row.target_id) === String(reel.id)).length || Number(reel.likes || 0);
    const comments = data.comments.filter(row => String(row.reel_id) === String(reel.id)).length || Number(reel.comments_count || 0);
    const views = data.views.filter(row => String(row.reel_id) === String(reel.id)).length || Number(reel.views || 0);
    return { ...reel, likes, comments, views, engagement: views ? Math.round(((likes + comments) / views) * 1000) / 10 : 0 };
  }).sort((a, b) => b.views - a.views), [data]);

  const adStats = useMemo(() => data.ads.reduce((result, ad) => ({
    impressions: result.impressions + Number(ad.impressions || 0),
    clicks: result.clicks + Number(ad.clicks || 0),
    budget: result.budget + Number(ad.budget || 0),
  }), { impressions: 0, clicks: 0, budget: 0 }), [data.ads]);
  const ctr = adStats.impressions > 0 ? Math.round((adStats.clicks / adStats.impressions) * 1000) / 10 : 0;

  if (!user?.email) return <div className="flex min-h-[60vh] items-center justify-center text-sm font-bold text-slate-500">Connectez-vous pour voir vos données analytiques.</div>;

  return (
    <div className="analytics-page min-h-full bg-slate-50 pb-10 font-display">
      <header className="bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 px-5 pb-6 pt-5 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} aria-label="Retour" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-transform active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Espace créateur</p><h1 className="mt-1 text-2xl font-black tracking-tight">Données analytiques</h1></div>
            <button onClick={load} aria-label="Actualiser les données" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-transform active:scale-95"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {PERIODS.map(item => <button key={item.days} onClick={() => setPeriod(item.days)} className={`min-h-10 shrink-0 rounded-xl px-4 text-[11px] font-black transition-all ${period === item.days ? "bg-white text-slate-950 shadow-lg" : "bg-white/10 text-white/70"}`}>{item.label}</button>)}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4">
        {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error} Vérifiez que la migration analytics est appliquée.</div>}
        {loading && data.reels.length === 0 ? <div className="flex min-h-[320px] items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-violet-600" /></div> : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi icon={Eye} label="Vues" value={metric(totalViews)} hint={data.views.length ? "Vues uniques par jour" : "Compteur cumulé des publications"} tone="violet" />
              <Kpi icon={Heart} label="Likes" value={metric(periodLikes.length || data.reels.reduce((sum, row) => sum + Number(row.likes || 0), 0))} hint={`${metric(data.reels.length)} publication${data.reels.length > 1 ? "s" : ""}`} tone="rose" />
              <Kpi icon={MessageCircle} label="Commentaires" value={metric(periodComments.length || data.reels.reduce((sum, row) => sum + Number(row.comments_count || 0), 0))} hint="Conversations générées" tone="blue" />
              <Kpi icon={TrendingUp} label="Engagement" value={`${engagementRate}%`} hint="Likes + commentaires / vues" tone="emerald" />
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-base font-black text-slate-950">Évolution de l’engagement</h2><p className="mt-1 text-[11px] text-slate-500">Vues, likes et commentaires sur la période sélectionnée.</p></div><div className="flex flex-wrap gap-3 text-[10px] font-bold text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-violet-500" />Vues</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" />Likes</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-500" />Commentaires</span></div></div>
              <div className="mt-4 h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}><defs><linearGradient id="creatorViews" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.28} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="views" name="Vues" stroke="#8b5cf6" fill="url(#creatorViews)" strokeWidth={2.5} /><Area type="monotone" dataKey="likes" name="Likes" stroke="#f43f5e" fill="transparent" strokeWidth={2} /><Area type="monotone" dataKey="comments" name="Commentaires" stroke="#3b82f6" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
              {!data.views.length && <p className="text-center text-[10px] font-medium text-slate-400">Les courbes de vues se rempliront dès que les nouvelles vues seront enregistrées.</p>}
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-slate-950">Performance des publications</h2><p className="mt-1 text-[11px] text-slate-500">Classement synchronisé avec les interactions réelles.</p></div><BarChart3 className="h-5 w-5 text-violet-500" /></div>
                <div className="mt-4 space-y-3">{performance.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Aucune publication disponible.</p> : performance.slice(0, 6).map(row => <button key={row.id} onClick={() => setSelectedReelId(String(row.id))} className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${String(selectedReel?.id) === String(row.id) ? "bg-violet-50" : "hover:bg-slate-50"}`}><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">{row.thumbnail_url && <BeautyImage src={row.thumbnail_url} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-black text-slate-900">{row.title || "Publication sans titre"}</p><p className="mt-1 text-[10px] font-medium text-slate-500">{metric(row.views)} vues · {metric(row.likes)} likes · {metric(row.comments)} commentaires</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">{row.engagement}%</span></button>)}</div>
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-slate-950 to-violet-950 p-5 text-white shadow-lg"><div className="flex items-center gap-2 text-violet-300"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Publication sélectionnée</span></div><h2 className="mt-3 line-clamp-2 text-xl font-black">{selectedReel?.title || "Sélectionnez une publication"}</h2><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/10 p-3"><Eye className="h-4 w-4 text-violet-300" /><p className="mt-2 text-lg font-black">{metric(performance.find(row => String(row.id) === String(selectedReel?.id))?.views)}</p><p className="text-[9px] font-bold text-white/55">VUES</p></div><div className="rounded-2xl bg-white/10 p-3"><Heart className="h-4 w-4 text-rose-300" /><p className="mt-2 text-lg font-black">{metric(performance.find(row => String(row.id) === String(selectedReel?.id))?.likes)}</p><p className="text-[9px] font-bold text-white/55">LIKES</p></div><div className="rounded-2xl bg-white/10 p-3"><MessageCircle className="h-4 w-4 text-blue-300" /><p className="mt-2 text-lg font-black">{metric(performance.find(row => String(row.id) === String(selectedReel?.id))?.comments)}</p><p className="text-[9px] font-bold text-white/55">COMMENTAIRES</p></div></div></div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><div className="flex items-center justify-between"><div><h2 className="text-base font-black text-slate-950">Publicité et visibilité</h2><p className="mt-1 text-[11px] text-slate-500">Résultats des campagnes liées à votre compte.</p></div><Target className="h-5 w-5 text-orange-500" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-orange-50 p-4"><Users className="h-4 w-4 text-orange-600" /><p className="mt-3 text-2xl font-black text-slate-950">{metric(adStats.impressions)}</p><p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Impressions</p></div><div className="rounded-2xl bg-blue-50 p-4"><MousePointerClick className="h-4 w-4 text-blue-600" /><p className="mt-3 text-2xl font-black text-slate-950">{metric(adStats.clicks)}</p><p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Clics</p></div><div className="rounded-2xl bg-emerald-50 p-4"><TrendingUp className="h-4 w-4 text-emerald-600" /><p className="mt-3 text-2xl font-black text-slate-950">{ctr}%</p><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">CTR moyen</p></div></div><p className="mt-3 flex items-center gap-2 text-[10px] font-medium text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> {data.ads.length} campagne{data.ads.length > 1 ? "s" : ""} rattachée{data.ads.length > 1 ? "s" : ""} à ce compte</p></section>
          </>
        )}
      </main>
    </div>
  );
}
