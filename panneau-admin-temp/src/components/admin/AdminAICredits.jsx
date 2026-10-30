import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, Check, Coins, CreditCard, Loader2, Save, Sparkles, TrendingUp, Users, Wand2 } from "lucide-react";
import apiClient from "@/lib/apiClient";

const euro = cents => (Number(cents || 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const number = value => Number(value || 0).toLocaleString("fr-FR");
const dayLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "") : "";

function Kpi({ icon: Icon, label, value, hint, tone = "orange" }) {
  const tones = {
    orange: "bg-orange-50 text-orange-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-2 text-[11px] font-medium text-slate-500">{hint}</p>
    </div>
  );
}

function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h2 className="text-[15px] font-black text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] shadow-xl">
      <p className="mb-2 font-black text-slate-800">{label}</p>
      {payload.map(item => <p key={item.dataKey} className="flex items-center justify-between gap-5 text-slate-600"><span>{item.name}</span><strong className="text-slate-900">{item.dataKey?.includes("cents") ? euro(item.value) : number(item.value)}</strong></p>)}
    </div>
  );
}

export default function AdminAICredits() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const next = await apiClient.get("/admin/ai-credits");
      setData(next);
      setForm({
        settings: { ...next.settings },
        packages: (next.packages || []).map(pkg => ({ ...pkg, amount_euros: (Number(pkg.amount_cents || 0) / 100).toFixed(2) })),
      });
    } catch (e) { setError(e.message || "Les données crédits IA sont indisponibles."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const chartData = useMemo(() => (data?.daily || []).map(row => ({
    ...row,
    label: dayLabel(row.day),
    generations: Number(row.free_generations || 0) + Number(row.paid_generations || 0),
  })), [data]);

  const updateSetting = (key, value) => setForm(current => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const updatePackage = (id, key, value) => setForm(current => ({ ...current, packages: current.packages.map(pkg => pkg.id === id ? { ...pkg, [key]: value } : pkg) }));

  const save = async event => {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = {
        settings: {
          free_daily_limit: Number(form.settings.free_daily_limit),
          provider_cost_cents: Number(form.settings.provider_cost_cents),
        },
        packages: form.packages.map((pkg, index) => ({
          id: pkg.id,
          name: String(pkg.name || "").trim(),
          credits: Number(pkg.credits),
          amount_cents: Math.round(Number(pkg.amount_euros) * 100),
          highlight: Boolean(pkg.highlight),
          active: pkg.active !== false,
          display_order: Number(pkg.display_order || index + 1),
        })),
      };
      const next = await apiClient.put("/admin/ai-credits", payload);
      setData(next);
      setForm({ settings: { ...next.settings }, packages: (next.packages || []).map(pkg => ({ ...pkg, amount_euros: (Number(pkg.amount_cents || 0) / 100).toFixed(2) })) });
      setNotice("Configuration crédits IA enregistrée.");
    } catch (e) { setError(e.message || "La configuration n’a pas pu être enregistrée."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!form || !data) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" />{error || "Impossible de charger les crédits IA."}<button onClick={load} className="ml-3 font-black underline">Réessayer</button></div>;

  const kpis = data.kpis || {};
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-5 text-white shadow-xl lg:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-orange-300"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Monétisation IA</span></div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">Crédits de génération IA</h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-slate-300">Pilotez les quotas, les packs de crédits, le coût de génération et la rentabilité de AI Styliste et AI HairChanger au même endroit.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right backdrop-blur-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Période analysée</p><p className="mt-1 text-lg font-black">30 derniers jours</p></div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] font-semibold text-emerald-700"><Check className="mr-2 inline h-4 w-4" />{notice}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={Wand2} label="Générations" value={number(kpis.total_generations)} hint={`${number(kpis.free_generations)} gratuites · ${number(kpis.paid_generations)} payées`} />
        <Kpi icon={Users} label="Utilisateurs actifs" value={number(kpis.active_users)} hint="Ayant utilisé l’IA sur 30 jours" tone="indigo" />
        <Kpi icon={CreditCard} label="Ventes crédits" value={euro(kpis.revenue_cents)} hint={`${number(kpis.paid_purchases)} achats confirmés`} tone="emerald" />
        <Kpi icon={Coins} label="Coût estimé" value={euro(kpis.estimated_cost_cents)} hint="Coût fournisseur configuré" tone="rose" />
        <Kpi icon={TrendingUp} label="Profit estimé" value={euro(kpis.estimated_profit_cents)} hint={`${number(kpis.failed_generations)} échecs enregistrés`} tone={Number(kpis.estimated_profit_cents) >= 0 ? "orange" : "rose"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card title="Utilisation quotidienne" subtitle="Générations gratuites et générations débitées, avec le nombre d’utilisateurs actifs.">
          <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="aiGenGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.3} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area type="monotone" dataKey="free_generations" name="Gratuites" stroke="#10b981" fill="transparent" strokeWidth={2} /><Area type="monotone" dataKey="paid_generations" name="Payées" stroke="#f97316" fill="url(#aiGenGradient)" strokeWidth={2} /><Area type="monotone" dataKey="active_users" name="Utilisateurs" stroke="#4f46e5" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
        </Card>
        <Card title="Revenus, coûts et profit" subtitle="Estimation : ventes de crédits moins coût fournisseur par génération.">
          <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={value => `${(Number(value) / 100).toFixed(0)}€`} /><Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="revenue_cents" name="Revenus (€)" fill="#10b981" radius={[5, 5, 0, 0]} /><Bar dataKey="cost_cents" name="Coûts (€)" fill="#f43f5e" radius={[5, 5, 0, 0]} /><Bar dataKey="profit_cents" name="Profit (€)" fill="#4f46e5" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>

      <Card title="Performance des packs" subtitle="Quels packs génèrent le plus de ventes et de crédits distribués ?">
        <div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.package_stats || []} margin={{ top: 8, right: 8, left: -22, bottom: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="package_id" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="purchases" name="Achats" fill="#f97316" radius={[5, 5, 0, 0]} /><Bar dataKey="credits_sold" name="Crédits vendus" fill="#4f46e5" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Card>

      <form onSubmit={save} className="space-y-5">
        <Card title="Paramètres de facturation" subtitle="Ces valeurs alimentent directement l’affichage client, le quota et l’estimation de rentabilité.">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500">Générations gratuites / jour</span><input type="number" min="1" max="100" value={form.settings.free_daily_limit} onChange={e => updateSetting("free_daily_limit", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-primary" /><span className="mt-1 block text-[10px] text-slate-400">Quota partagé AI Styliste + HairChanger</span></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-slate-500">Coût fournisseur / image</span><div className="relative"><input type="number" min="0" step="0.01" value={(Number(form.settings.provider_cost_cents || 0) / 100).toFixed(2)} onChange={e => updateSetting("provider_cost_cents", Math.round(Number(e.target.value || 0) * 100))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-bold outline-none focus:border-primary" /><span className="absolute right-3 top-3 text-sm font-black text-slate-400">€</span></div><span className="mt-1 block text-[10px] text-slate-400">Utilisé uniquement pour la rentabilité estimée</span></label>
            <div className="rounded-xl bg-orange-50 p-3 text-[11px] leading-relaxed text-orange-800"><strong>Conseil :</strong> garde une marge nette positive avant d’augmenter le quota gratuit. Les crédits payants restent synchronisés entre les deux outils.</div>
          </div>
        </Card>

        <Card title="Packs commercialisés" subtitle="Modifiez le nom, le nombre de crédits et le prix affiché dans l’application.">
          <div className="grid gap-3 lg:grid-cols-3">
            {form.packages.map(pkg => (
              <div key={pkg.id} className={`rounded-2xl border-2 p-4 ${pkg.highlight ? "border-orange-300 bg-orange-50/60" : "border-slate-200 bg-slate-50"}`}>
                <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{pkg.id}</span><label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><input type="checkbox" checked={pkg.highlight} onChange={e => updatePackage(pkg.id, "highlight", e.target.checked)} className="accent-orange-500" /> Populaire</label></div>
                <label className="block"><span className="sr-only">Nom du pack</span><input value={pkg.name} onChange={e => updatePackage(pkg.id, "name", e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-primary" /></label>
                <div className="mt-3 grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-[10px] font-bold text-slate-500">Crédits</span><input type="number" min="1" value={pkg.credits} onChange={e => updatePackage(pkg.id, "credits", e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary" /></label><label className="block"><span className="mb-1 block text-[10px] font-bold text-slate-500">Prix (€)</span><input type="number" min="0.50" step="0.01" value={pkg.amount_euros} onChange={e => updatePackage(pkg.id, "amount_euros", e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary" /></label></div>
                <label className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={pkg.active !== false} onChange={e => updatePackage(pkg.id, "active", e.target.checked)} className="accent-orange-500" /> Pack visible pour les clients</label>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end"><button type="submit" disabled={saving} className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[12px] font-black text-white shadow-lg shadow-orange-500/20 transition-transform active:scale-95 disabled:opacity-60">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> : <><Save className="h-4 w-4" /> Enregistrer la configuration</>}</button></div>
        </Card>
      </form>
    </div>
  );
}
