import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, ChevronRight, Clock3, GraduationCap, Lock, Network, Play, Send, Sparkles, TrendingUp, Brain, X } from "lucide-react";
import { entities } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { PILLARS as DEFAULT_PILLARS } from "./Franchise";

const CONFIG_KEY = "franchise_page";
const ICONS = { marketing: TrendingUp, franchise: Network, cours: GraduationCap, coaching: Brain };
const DEFAULT_CONFIG = {
  eyebrow: "BeautyBook Pro",
  title: "Développez\nVotre Business",
  description: "Marketing, franchise, formations métier, coaching — tout ce qu'il faut pour passer au niveau supérieur.",
  stats: [{ value: "2 400+", label: "pros formés" }, { value: "94%", label: "satisfaction" }, { value: "18 mois", label: "ROI moyen" }],
  ctaLabel: "Accéder au module",
  pillars: {},
};

function readConfig(value) {
  if (!value) return {};
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return {}; } }
  return value;
}

function normalizeConfig(value) {
  const raw = readConfig(value);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    stats: Array.isArray(raw.stats) && raw.stats.length ? raw.stats.slice(0, 3) : DEFAULT_CONFIG.stats,
    pillars: raw.pillars && typeof raw.pillars === "object" ? raw.pillars : {},
  };
}

function getConfiguredPillars(config) {
  return DEFAULT_PILLARS.map(pillar => {
    const custom = config.pillars?.[pillar.key] || {};
    const modules = Array.isArray(custom.modules) && custom.modules.length
      ? custom.modules.map(module => ({ ...module, steps: Array.isArray(module.steps) ? module.steps : [] }))
      : pillar.modules;
    return { ...pillar, label: custom.label || pillar.label, modules };
  });
}

function embedUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  const youtube = value.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]+)/i);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return "";
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(url || ""));
}

function VideoPreview({ module }) {
  if (!module.video_url) return null;
  const embed = embedUrl(module.video_url);
  return (
    <div className="mb-5 overflow-hidden rounded-[26px] bg-black shadow-xl">
      {embed ? <iframe title={`Vidéo ${module.title}`} src={embed} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : isDirectVideo(module.video_url) ? <video src={module.video_url} controls playsInline className="aspect-video w-full object-cover" /> : <a href={module.video_url} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center gap-2 bg-gradient-to-br from-orange-500 to-orange-700 text-sm font-black text-white"><Play className="h-5 w-5" /> Ouvrir la vidéo</a>}
    </div>
  );
}

function ModuleCard({ module, onOpen, dark }) {
  return (
    <article className={`group overflow-hidden rounded-[28px] border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl ${dark ? "border-gray-700 bg-[#1f2937]" : "border-orange-100 bg-white"}`}>
      {module.video_url && <div className="mb-4 flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-orange-500"><Play className="h-3.5 w-3.5 fill-current" /> Vidéo disponible</div>}
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-3xl shadow-inner">{module.emoji}</span>
        <div className="min-w-0 flex-1"><div className="flex items-start gap-2"><h3 className={`flex-1 text-[15px] font-black leading-tight ${dark ? "text-white" : "text-gray-900"}`}>{module.title}</h3>{module.free ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700">Gratuit</span> : <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />}</div><p className={`mt-1 text-[12px] font-medium leading-snug ${dark ? "text-gray-300" : "text-gray-500"}`}>{module.desc}</p><div className={`mt-3 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest ${dark ? "text-gray-400" : "text-gray-400"}`}><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {module.duration}</span><span>· {module.level}</span></div></div>
      </div>
      <button onClick={() => onOpen(module)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 transition active:scale-95 hover:bg-orange-600"><Play className="h-4 w-4 fill-current" /> {module.ctaLabel || "Accéder au module"}<ChevronRight className="h-4 w-4" /></button>
    </article>
  );
}

function ModuleSheet({ module, onClose, dark }) {
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: user?.email || "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!form.name || !form.email) return;
    await entities.DemandefFranchise.create({ full_name: form.name, email: form.email, phone: form.phone, message: `[${module.title}] ${form.message}`, budget: "N/A" });
    setSent(true);
  };
  return <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm" onClick={onClose}><div className={`mt-auto max-h-[94dvh] overflow-y-auto rounded-t-[32px] ${dark ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"}`} onClick={e => e.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200/10 bg-inherit px-5 py-4"><span className="h-1.5 w-12 rounded-full bg-orange-300" /><button onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 text-orange-500"><X className="h-5 w-5" /></button></div><div className="px-5 pb-10 pt-2"><div className="mb-5 rounded-[28px] bg-gradient-to-br from-orange-500 to-orange-700 p-5 text-white shadow-xl"><span className="text-5xl">{module.emoji}</span><h2 className="mt-3 text-2xl font-black leading-tight">{module.title}</h2><p className="mt-2 text-sm font-medium text-white/80">{module.desc}</p><div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest"><span className="rounded-full bg-white/15 px-3 py-1.5">⏱ {module.duration}</span><span className="rounded-full bg-white/15 px-3 py-1.5">{module.level}</span>{module.free && <span className="rounded-full bg-emerald-400/25 px-3 py-1.5 text-emerald-50">Gratuit</span>}</div></div><VideoPreview module={module} /><h3 className={`mb-3 text-[11px] font-black uppercase tracking-[.18em] ${dark ? "text-gray-400" : "text-gray-500"}`}>Au programme</h3><div className="space-y-2">{module.steps.map((step, index) => <div key={`${step}-${index}`} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${dark ? "bg-gray-900" : "bg-orange-50/70"}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white">{index + 1}</span><p className={`text-[13px] font-bold leading-snug ${dark ? "text-gray-200" : "text-gray-800"}`}>{step}</p></div>)}</div>{!formOpen && !sent && <button onClick={() => setFormOpen(true)} className="mt-6 w-full rounded-2xl bg-orange-500 py-4 text-[13px] font-black uppercase tracking-widest text-white shadow-xl shadow-orange-500/25">{module.free ? "Commencer maintenant" : "Demander l'accès"} →</button>}{formOpen && !sent && <div className={`mt-6 space-y-3 rounded-3xl p-5 ${dark ? "bg-gray-900" : "bg-orange-50"}`}><h4 className="text-[15px] font-black">{module.free ? "Commencer le module" : "Demander l'accès"}</h4>{[{ key: "name", label: "Nom complet *" }, { key: "email", label: "Email *" }, { key: "phone", label: "Téléphone" }, { key: "message", label: "Message" }].map(field => <label key={field.key} className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">{field.label}</span><input value={form[field.key]} onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))} className={`w-full rounded-xl border px-3 py-3 text-sm outline-none ${dark ? "border-gray-700 bg-gray-800 text-white" : "border-orange-100 bg-white text-gray-800"}`} /></label>)}<button onClick={submit} disabled={!form.name || !form.email} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-[12px] font-black uppercase tracking-widest text-white disabled:opacity-50"><Send className="h-4 w-4" /> Envoyer ma demande</button></div>}{sent && <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-emerald-50 py-8 text-center"><CheckCircle className="h-12 w-12 text-emerald-500" /><p className="text-base font-black text-gray-900">Demande envoyée !</p><p className="text-xs text-gray-500">Notre équipe vous contactera sous 48h.</p></div>}</div></div></div>;
}

export default function FranchiseRedesigned() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === "dark" || theme === "night";
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [active, setActive] = useState("marketing");
  const [selected, setSelected] = useState(null);
  useEffect(() => { entities.AppConfig.filter({ key: CONFIG_KEY }, "-updated_at", 1).then(rows => { const row = rows?.[0]; if (row) setConfig(normalizeConfig(row.value)); }).catch(() => {}); }, []);
  const pillars = useMemo(() => getConfiguredPillars(config), [config]);
  const pillar = pillars.find(item => item.key === active) || pillars[0];
  const Icon = ICONS[pillar.key] || Sparkles;
  return <div className={`min-h-full font-display ${dark ? "bg-[#1a1a2e] text-white" : "bg-[#fffaf7] text-gray-900"}`}>
    <header className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-[#e85d2b] px-5 pb-7 pt-6 text-white"><div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" /><div className="relative mx-auto max-w-3xl"><button onClick={() => navigate(-1)} aria-label="Retour" className="mb-8 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button><p className="text-[10px] font-black uppercase tracking-[.22em] text-white/75">{config.eyebrow}</p><h1 className="mt-2 whitespace-pre-line text-[34px] font-black leading-[.98] tracking-tight">{config.title}</h1><p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-white/85">{config.description}</p><div className="mt-6 grid grid-cols-3 gap-2">{config.stats.map((stat, index) => <div key={`${stat.label}-${index}`} className="rounded-2xl border border-white/15 bg-white/15 px-2 py-3 text-center backdrop-blur-sm"><p className="text-lg font-black leading-none">{stat.value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/70">{stat.label}</p></div>)}</div></div></header>
    <main className="mx-auto max-w-3xl px-5 pb-24"><div className="-mt-5 rounded-[26px] border border-orange-100 bg-white p-2 shadow-xl shadow-orange-900/10 dark:border-gray-700 dark:bg-[#1f2937]"><div className="grid grid-cols-4 gap-1">{pillars.map(item => { const PillarIcon = ICONS[item.key] || Sparkles; const isActive = active === item.key; return <button key={item.key} onClick={() => setActive(item.key)} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-1 transition active:scale-95 ${isActive ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : dark ? "text-gray-300 hover:bg-gray-800" : "text-gray-500 hover:bg-orange-50"}`}><PillarIcon className="h-5 w-5" /><span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span></button>; })}</div></div><div className="mb-4 mt-8 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500"><Icon className="h-6 w-6" /></div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-500">Parcours sélectionné</p><h2 className={`text-2xl font-black ${dark ? "text-white" : "text-gray-900"}`}>{pillar.label}</h2><p className={`text-xs font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>{pillar.modules.length} modules disponibles</p></div></div><div className="space-y-4">{pillar.modules.map((module, index) => <ModuleCard key={`${module.title}-${index}`} module={module} onOpen={setSelected} dark={dark} />)}</div></main>{selected && <ModuleSheet module={selected} onClose={() => setSelected(null)} dark={dark} />}</div>;
}
