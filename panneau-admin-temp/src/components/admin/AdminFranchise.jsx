import { useEffect, useMemo, useRef, useState } from "react";
import { entities, uploadFile } from "@/api/entities";
import { Check, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";

const CONFIG_KEY = "franchise_page";
const input = "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-800 outline-none transition focus:border-primary focus:bg-white";
const PILLAR_LABELS = { marketing: "Marketing", franchise: "Franchise", cours: "Formations", coaching: "Coaching" };

const module = (emoji, title, desc, duration, level, free = false) => ({ emoji, title, desc, duration, level, free, steps: ["Objectif et méthode", "Mise en pratique guidée", "Plan d'action personnalisé"], video_url: "" });
const DEFAULT_CONFIG = {
  eyebrow: "BeautyBook Pro",
  title: "Développez\nVotre Business",
  description: "Marketing, franchise, formations métier, coaching — tout ce qu'il faut pour passer au niveau supérieur.",
  stats: [{ value: "2 400+", label: "pros formés" }, { value: "94%", label: "satisfaction" }, { value: "18 mois", label: "ROI moyen" }],
  pillars: {
    marketing: { label: "Marketing", modules: [module("📱", "Maîtriser les Réseaux Sociaux", "Construire une audience fidèle pour votre salon.", "2h30", "Débutant", true), module("📸", "Shooting & Contenu Visuel", "Photographier vos créations pour attirer plus de clients.", "1h45", "Débutant", true), module("🎯", "Publicité Locale & Google", "Attirer des clients dans votre zone.", "3h", "Intermédiaire") , module("💌", "Fidélisation & Email Marketing", "Transformer vos clients ponctuels en ambassadeurs.", "2h", "Intermédiaire")] },
    franchise: { label: "Franchise", modules: [module("🏗️", "Créer son Concept de Franchise", "Structurer son savoir-faire pour le répliquer.", "4h", "Avancé"), module("⚖️", "Aspects Juridiques & Financiers", "Contrats, DIP et redevances.", "3h", "Avancé"), module("🤝", "Recruter ses Franchisés", "Trouver les bons partenaires.", "2h30", "Avancé"), module("📊", "Piloter son Réseau", "Superviser plusieurs points de vente.", "3h", "Expert")] },
    cours: { label: "Formations", modules: [module("✂️", "Techniques Coupe Avancées", "Maîtriser les techniques premium.", "6h", "Intermédiaire", true), module("🎨", "Colorimétrie & Balayage", "Techniques actuelles de coloration.", "8h", "Intermédiaire"), module("💆", "Soins Capillaires & Conseil", "Diagnostiquer tous types de cheveux.", "4h", "Débutant", true), module("💅", "Nail Art & Techniques Ongles", "Gel, semi-permanent et nail art.", "5h", "Débutant")] },
    coaching: { label: "Coaching", modules: [module("🧠", "Mindset de l'Entrepreneur Beauté", "Développer la mentalité d'un chef d'entreprise.", "3h", "Tous niveaux", true), module("💼", "Gestion & Finance du Salon", "Comprendre ses chiffres et sa rentabilité.", "4h", "Intermédiaire"), module("👥", "Leadership & Management", "Recruter et fidéliser votre équipe.", "3h30", "Intermédiaire"), module("🚀", "Scaler son Business Beauté", "Passer de 1 à plusieurs salons.", "5h", "Avancé")] },
  },
};

function parseValue(value) { if (!value) return null; if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } } return value; }
function normalize(value) { const parsed = parseValue(value); return parsed && parsed.pillars ? { ...DEFAULT_CONFIG, ...parsed, stats: parsed.stats?.length ? parsed.stats : DEFAULT_CONFIG.stats } : structuredClone(DEFAULT_CONFIG); }

export default function AdminFranchise() {
  const [form, setForm] = useState(DEFAULT_CONFIG);
  const [recordId, setRecordId] = useState(null);
  const [activePillar, setActivePillar] = useState("marketing");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  const fileRefs = useRef({});

  useEffect(() => {
    entities.AppConfig.filter({ key: CONFIG_KEY }, "-updated_at", 1).then(rows => { const row = rows?.[0]; if (row) { setRecordId(row.id); setForm(normalize(row.value)); } }).catch(error => setMessage(error?.message || "Impossible de charger la configuration.")).finally(() => setLoading(false));
  }, []);

  const pillar = form.pillars[activePillar];
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateStat = (index, key, value) => setForm(current => ({ ...current, stats: current.stats.map((stat, i) => i === index ? { ...stat, [key]: value } : stat) }));
  const updatePillar = (key, value) => setForm(current => ({ ...current, pillars: { ...current.pillars, [activePillar]: { ...current.pillars[activePillar], [key]: value } } }));
  const updateModule = (index, key, value) => updatePillar("modules", pillar.modules.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const addModule = () => updatePillar("modules", [...pillar.modules, module("✨", "Nouveau module", "Description du module", "2h", "Débutant")]);
  const removeModule = index => updatePillar("modules", pillar.modules.filter((_, i) => i !== index));

  const uploadVideo = async (index, file) => {
    if (!file) return;
    const key = `${activePillar}-${index}`;
    setUploading(key); setMessage("");
    try { const result = await uploadFile({ file }); updateModule(index, "video_url", result.file_url); setMessage("Vidéo importée. Pensez à enregistrer la configuration."); }
    catch (error) { setMessage(error?.message || "L'import de la vidéo a échoué."); }
    finally { setUploading(""); }
  };

  const save = async event => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const payload = { key: CONFIG_KEY, value: form, description: "Contenu administrable de la page Développez Votre Business" };
      if (recordId) await entities.AppConfig.update(recordId, payload); else { const created = await entities.AppConfig.create(payload); setRecordId(created?.id); }
      setMessage("Configuration enregistrée et publiée.");
    } catch (error) { setMessage(error?.message || "La sauvegarde a échoué."); }
    finally { setSaving(false); }
  };

  const moduleCount = useMemo(() => Object.values(form.pillars).reduce((sum, item) => sum + (item.modules?.length || 0), 0), [form.pillars]);
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <form onSubmit={save} className="space-y-5 pb-10">
    <div className="rounded-3xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-800 p-6 text-white shadow-xl shadow-orange-500/20"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/70">Configuration de contenu</p><h2 className="mt-2 text-2xl font-black">Développez Votre Business</h2><p className="mt-2 max-w-xl text-sm font-medium text-white/80">Modifiez l’expérience visible dans l’application, module par module.</p></div><div className="rounded-2xl bg-white/15 px-4 py-3 text-center"><p className="text-2xl font-black">{moduleCount}</p><p className="text-[10px] font-black uppercase tracking-widest text-white/70">modules</p></div></div></div>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-base font-black text-gray-900">Hero et statistiques</h3><div className="grid gap-3 md:grid-cols-2"><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-gray-500">Sur-titre</span><input className={input} value={form.eyebrow} onChange={e => update("eyebrow", e.target.value)} /></label><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-gray-500">Titre</span><textarea rows={2} className={input} value={form.title} onChange={e => update("title", e.target.value)} /></label><label className="block md:col-span-2"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-gray-500">Description</span><textarea rows={3} className={input} value={form.description} onChange={e => update("description", e.target.value)} /></label></div><div className="mt-4 grid gap-3 md:grid-cols-3">{form.stats.map((stat, index) => <div key={index} className="rounded-2xl bg-orange-50 p-3"><input className={`${input} bg-white`} value={stat.value} onChange={e => updateStat(index, "value", e.target.value)} placeholder="Valeur" /><input className={`${input} mt-2 bg-white`} value={stat.label} onChange={e => updateStat(index, "label", e.target.value)} placeholder="Libellé" /></div>)}</div></section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-black text-gray-900">Parcours et modules</h3><p className="mt-1 text-[11px] text-gray-500">Chaque module peut avoir sa vidéo importée ou son lien YouTube/Vimeo.</p></div><div className="flex gap-1 rounded-xl bg-gray-100 p-1">{Object.keys(PILLAR_LABELS).map(key => <button type="button" key={key} onClick={() => setActivePillar(key)} className={`rounded-lg px-3 py-2 text-[10px] font-black ${activePillar === key ? "bg-white text-primary shadow-sm" : "text-gray-500"}`}>{PILLAR_LABELS[key]}</button>)}</div></div><div className="mt-4 rounded-2xl bg-orange-50 p-3"><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-orange-700">Nom du parcours</span><input className={`${input} bg-white`} value={pillar.label} onChange={e => updatePillar("label", e.target.value)} /></label></div><div className="mt-4 space-y-4">{pillar.modules.map((item, index) => <article key={index} className="rounded-2xl border border-gray-200 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Module {index + 1}</span><button type="button" onClick={() => removeModule(index)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500" aria-label="Supprimer le module"><Trash2 className="h-4 w-4" /></button></div><div className="grid gap-3 md:grid-cols-[80px_1fr_1fr]"><label><span className="mb-1 block text-[10px] font-bold text-gray-500">Emoji</span><input className={input} value={item.emoji || ""} onChange={e => updateModule(index, "emoji", e.target.value)} /></label><label><span className="mb-1 block text-[10px] font-bold text-gray-500">Titre</span><input className={input} value={item.title || ""} onChange={e => updateModule(index, "title", e.target.value)} /></label><label><span className="mb-1 block text-[10px] font-bold text-gray-500">Description</span><input className={input} value={item.desc || ""} onChange={e => updateModule(index, "desc", e.target.value)} /></label></div><div className="mt-3 grid gap-3 md:grid-cols-3"><label><span className="mb-1 block text-[10px] font-bold text-gray-500">Durée</span><input className={input} value={item.duration || ""} onChange={e => updateModule(index, "duration", e.target.value)} /></label><label><span className="mb-1 block text-[10px] font-bold text-gray-500">Niveau</span><input className={input} value={item.level || ""} onChange={e => updateModule(index, "level", e.target.value)} /></label><label className="flex items-end gap-2 pb-2 text-[12px] font-bold text-gray-600"><input type="checkbox" checked={Boolean(item.free)} onChange={e => updateModule(index, "free", e.target.checked)} className="h-4 w-4 accent-orange-500" /> Module gratuit</label></div><label className="mt-3 block"><span className="mb-1 block text-[10px] font-bold text-gray-500">Lien vidéo YouTube, Vimeo ou fichier hébergé</span><div className="flex gap-2"><input className={`${input} flex-1`} value={item.video_url || ""} onChange={e => updateModule(index, "video_url", e.target.value)} placeholder="https://youtube.com/watch?v=..." /><input ref={element => { fileRefs.current[`${activePillar}-${index}`] = element; }} type="file" accept="video/*" className="hidden" onChange={e => uploadVideo(index, e.target.files?.[0])} /><button type="button" onClick={() => fileRefs.current[`${activePillar}-${index}`]?.click()} className="flex min-w-12 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 text-orange-600" title="Importer une vidéo">{uploading === `${activePillar}-${index}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</button></div></label><label className="mt-3 block"><span className="mb-1 block text-[10px] font-bold text-gray-500">Programme (une étape par ligne)</span><textarea rows={4} className={input} value={(item.steps || []).join("\n")} onChange={e => updateModule(index, "steps", e.target.value.split("\n").map(value => value.trim()).filter(Boolean))} /></label>{item.video_url && <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600"><Check className="h-3.5 w-3.5" /> Vidéo configurée</p>}</article>)}</div><button type="button" onClick={addModule} className="mt-4 flex items-center gap-2 rounded-xl border border-orange-200 px-4 py-2.5 text-[12px] font-black text-orange-600"><Plus className="h-4 w-4" /> Ajouter un module</button></section>
    {message && <p className={`rounded-xl px-4 py-3 text-sm font-bold ${message.includes("échoué") || message.includes("Impossible") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    <div className="flex justify-end"><button type="submit" disabled={saving} className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[12px] font-black text-white shadow-lg shadow-orange-500/20 disabled:opacity-60">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> : <><Save className="h-4 w-4" /> Enregistrer et publier</>}</button></div>
  </form>;
}
