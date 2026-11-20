import { useState } from "react";
import { X, Plus, Trash2, Loader2, Check, Sparkles, Wand2 } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import RoutineSuggestions from "@/components/routine/RoutineSuggestions";

const EMOJIS = ["✨", "🌸", "💆", "🧴", "💅", "🌿", "🧖", "💪", "🌙", "☀️"];
const COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700", label: "Bleu" },
  { bg: "bg-pink-100", text: "text-pink-700", label: "Rose" },
  { bg: "bg-purple-100", text: "text-purple-700", label: "Violet" },
  { bg: "bg-green-100", text: "text-green-700", label: "Vert" },
  { bg: "bg-orange-100", text: "text-orange-700", label: "Orange" },
  { bg: "bg-yellow-100", text: "text-yellow-700", label: "Jaune" },
];
const DAYS_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[14px] font-medium text-gray-900 outline-none focus:border-primary transition-all";

export default function RoutineModal({ onClose, onCreated, prefill = null }) {
  const [step, setStep] = useState(prefill ? 1 : 0); // 0=suggestions, 1=infos, 2=tâches, 3=objectif
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [newTask, setNewTask] = useState("");
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [form, setForm] = useState(prefill ? {
    name: prefill.name || "",
    emoji: prefill.emoji || "✨",
    color: prefill.color || "bg-blue-100",
    description: prefill.description || "",
    frequency: prefill.frequency || "quotidien",
    days_of_week: prefill.days_of_week || [1, 2, 3, 4, 5],
    time: prefill.time || "08:00",
    duration_min: prefill.duration_min || 20,
    tasks: (prefill.tasks || []).map(t => typeof t === "string" ? { id: Date.now() + Math.random(), label: t, done: false } : t),
    objectif: prefill.objectif || "",
    objectif_duree_semaines: 8,
    objectif_debut: new Date().toISOString().slice(0, 10),
    reminder_active: true,
  } : {
    name: "",
    emoji: "✨",
    color: "bg-blue-100",
    description: "",
    frequency: "quotidien",
    days_of_week: [1, 2, 3, 4, 5],
    time: "08:00",
    duration_min: 20,
    tasks: [],
    objectif: "",
    objectif_duree_semaines: 8,
    objectif_debut: new Date().toISOString().slice(0, 10),
    reminder_active: true,
  });

  const addTask = () => {
    if (!newTask.trim()) return;
    setForm(f => ({
      ...f,
      tasks: [...f.tasks, { id: Date.now().toString(), label: newTask.trim(), done: false }]
    }));
    setNewTask("");
  };

  const removeTask = (id) => setForm(f => ({ ...f, tasks: f.tasks.filter(t => t.id !== id) }));

  // Sélectionner une suggestion et préremplir le formulaire
  const handleSelectSuggestion = (suggestion) => {
    setForm({
      name: suggestion.name || "",
      emoji: suggestion.emoji || "✨",
      color: suggestion.color || "bg-blue-100",
      description: suggestion.description || "",
      frequency: suggestion.frequency || "quotidien",
      days_of_week: suggestion.days_of_week || [1, 2, 3, 4, 5],
      time: suggestion.time || "08:00",
      duration_min: suggestion.duration_min || 20,
      tasks: (suggestion.tasks || []).map((t, i) => ({ id: String(Date.now() + i), label: t, done: false })),
      objectif: suggestion.objectif || "",
      objectif_duree_semaines: 8,
      objectif_debut: new Date().toISOString().slice(0, 10),
      reminder_active: true,
    });
    setStep(1);
  };

  // Générer une description IA
  const generateDescription = async () => {
    if (!form.name.trim()) return;
    setLoadingDesc(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Génère une description courte et inspirante (2 phrases max) pour une routine beauté appelée "${form.name}" de type ${form.frequency}, durée ${form.duration_min} min. Sois bienveillante et motivante. Réponds uniquement la description, sans guillemets.`,
      });
      const desc = typeof res === "string" ? res : res?.text || "";
      if (desc) setForm(f => ({ ...f, description: desc.trim() }));
    } catch {}
    setLoadingDesc(false);
  };

  // Générer des tâches IA
  const generateTasks = async () => {
    if (!form.name.trim()) return;
    setLoadingTasks(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Pour une routine beauté "${form.name}" (${form.duration_min} min, ${form.frequency}), génère une liste de 4 à 6 étapes concrètes à réaliser. Réponds uniquement avec un tableau JSON de strings. Exemple: ["Nettoyage du visage","Tonique","Sérum","Crème hydratante"]`,
        response_json_schema: { type: "array", items: { type: "string" } }
      });
      const tasks = Array.isArray(res) ? res : [];
      if (tasks.length > 0) {
        setForm(f => ({
          ...f,
          tasks: tasks.map((label, i) => ({ id: String(Date.now() + i), label, done: false }))
        }));
      }
    } catch {}
    setLoadingTasks(false);
  };

  const toggleDay = (d) => {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter(x => x !== d)
        : [...f.days_of_week, d]
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const user = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);
      if (!user) throw new Error("Connectez-vous pour enregistrer votre routine.");

      // Calculer sessions_total selon la durée objectif et fréquence
      const weeks = form.objectif_duree_semaines || 8;
      const sessionsPerWeek = form.frequency === "quotidien" ? 7
        : form.days_of_week.length || 1;
      const sessions_total = Math.round(weeks * sessionsPerWeek);

      const routine = await entities.RoutineBeaute.create({
        ...form,
        user_email: user.email,
        sessions_total,
        sessions_faites: 0,
        streak: 0,
        status: "active",
      });
      onCreated(routine);
      onClose();
    } catch (error) {
      console.error("[RoutineModal] Échec de l'enregistrement de la routine", error);
      setSaveError(error?.code === "PGRST204" || /schema cache|column.*RoutineBeaute/i.test(error?.message || "")
        ? "La base Supabase doit être mise à jour pour enregistrer cette routine. Appliquez la migration 202611200001_routine_beaute_fields.sql dans le SQL Editor."
        : error?.message || "Impossible d'enregistrer cette routine. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full rounded-t-3xl z-10 max-h-[85vh] flex flex-col" style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))" }}>
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-[14px]">←</span>
              </button>
            )}
            <div>
              <h2 className="text-[18px] font-black text-gray-900">
                {step === 0 ? "Choisir une routine" : "Nouvelle Routine"}
              </h2>
              {step > 0 && <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Étape {step}/3</p>}
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Progress bar (only when past step 0) */}
        {step > 0 && (
          <div className="flex gap-1 px-5 pt-3 shrink-0">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-all ${step >= s ? "bg-primary" : "bg-gray-200"}`} />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 space-y-4">

          {/* Step 0 — Suggestions */}
          {step === 0 && (
            <>
              <RoutineSuggestions onSelect={handleSelectSuggestion} />
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all"
              >
                Créer depuis zéro →
              </button>
            </>
          )}

          {/* Step 1 — Informations générales */}
          {step === 1 && (
            <>
              {/* Emoji & couleur */}
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Emoji</p>
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      className={`w-11 h-11 rounded-2xl text-[22px] flex items-center justify-center border-2 transition-all ${form.emoji === e ? "border-primary bg-orange-50" : "border-gray-100 bg-gray-50"}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Couleur</p>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c.bg} onClick={() => setForm(f => ({ ...f, color: c.bg }))}
                      className={`w-10 h-10 rounded-full border-4 transition-all ${c.bg} ${form.color === c.bg ? "border-primary scale-110" : "border-transparent"}`} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Nom de la routine *</p>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Skincare du matin, Routine cheveux..." className={inputCls} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</p>
                  <button
                    onClick={generateDescription}
                    disabled={loadingDesc || !form.name.trim()}
                    className="flex items-center gap-1 text-[10px] font-black text-primary bg-orange-50 border border-orange-100 rounded-full px-2.5 py-1 active:scale-95 disabled:opacity-40 transition-all"
                  >
                    {loadingDesc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    IA
                  </button>
                </div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Décrivez votre routine... ou laissez l'IA le faire ✨" rows={2} className={`${inputCls} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Heure</p>
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Durée (min)</p>
                  <input type="number" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: parseInt(e.target.value) || 20 }))} className={inputCls} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Fréquence</p>
                <div className="flex gap-2">
                  {[{ v: "quotidien", l: "Tous les jours" }, { v: "hebdomadaire", l: "Hebdo" }, { v: "personnalise", l: "Perso" }].map(({ v, l }) => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, frequency: v }))}
                      className={`flex-1 py-2.5 rounded-2xl text-[12px] font-black border-2 transition-all ${form.frequency === v ? "border-primary bg-orange-50 text-primary" : "border-gray-200 text-gray-500"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {(form.frequency === "hebdomadaire" || form.frequency === "personnalise") && (
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Jours</p>
                  <div className="flex gap-2">
                    {DAYS_LABELS.map((d, i) => (
                      <button key={i} onClick={() => toggleDay(i)}
                        className={`flex-1 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${form.days_of_week.includes(i) ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-400"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 cursor-pointer">
                <div className={`w-12 h-6 rounded-full transition-all relative ${form.reminder_active ? "bg-primary" : "bg-gray-300"}`}
                  onClick={() => setForm(f => ({ ...f, reminder_active: !f.reminder_active }))}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.reminder_active ? "left-7" : "left-1"}`} />
                </div>
                <div>
                  <p className="text-[13px] font-black text-gray-900">Rappel 30 min avant</p>
                  <p className="text-[11px] text-gray-400 font-medium">Notification avant chaque séance</p>
                </div>
              </label>
            </>
          )}

          {/* Step 2 — Tâches */}
          {step === 2 && (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center justify-between">
                <p className="text-[12px] font-black text-blue-700">📋 Listez les étapes de votre routine.</p>
                <button
                  onClick={generateTasks}
                  disabled={loadingTasks}
                  className="flex items-center gap-1.5 bg-primary text-white text-[11px] font-black px-3 py-1.5 rounded-xl active:scale-95 disabled:opacity-50 transition-all"
                >
                  {loadingTasks ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Suggérer IA
                </button>
              </div>

              <div className="flex gap-2">
                <input value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="Ex: Nettoyage du visage..." className={`${inputCls} flex-1`} />
                <button onClick={addTask} className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shrink-0 active:scale-95">
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>

              {form.tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-[32px] mb-2">📝</p>
                  <p className="text-[13px] font-medium">Ajoutez vos premières étapes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.tasks.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-black text-primary">{i + 1}</span>
                      </div>
                      <p className="flex-1 text-[14px] font-medium text-gray-900">{t.label}</p>
                      <button onClick={() => removeTask(t.id)} className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 3 — Objectif */}
          {step === 3 && (
            <>
              <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
                <p className="text-[12px] font-black text-primary">🎯 Définissez un objectif mesurable. La barre de progression se mettra à jour automatiquement.</p>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Objectif</p>
                <input value={form.objectif} onChange={e => setForm(f => ({ ...f, objectif: e.target.value }))}
                  placeholder="Ex: Peau lumineuse, Cheveux plus forts..." className={inputCls} />
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Durée de l'objectif</p>
                <div className="grid grid-cols-4 gap-2">
                  {[4, 8, 12, 16].map(w => (
                    <button key={w} onClick={() => setForm(f => ({ ...f, objectif_duree_semaines: w }))}
                      className={`py-3 rounded-2xl text-[13px] font-black border-2 transition-all ${form.objectif_duree_semaines === w ? "border-primary bg-orange-50 text-primary" : "border-gray-200 text-gray-500"}`}>
                      {w}sem
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 font-medium mt-2 text-center">≈ {form.objectif_duree_semaines / 4} mois</p>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Date de début</p>
                <input type="date" value={form.objectif_debut} onChange={e => setForm(f => ({ ...f, objectif_debut: e.target.value }))} className={inputCls} />
              </div>

              {/* Aperçu */}
              <div className={`${form.color} rounded-3xl p-5`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[28px]">{form.emoji}</span>
                  <div>
                    <p className="text-[16px] font-black text-gray-900">{form.name || "Ma Routine"}</p>
                    <p className="text-[11px] text-gray-500 font-medium">{form.time} · {form.duration_min} min</p>
                  </div>
                </div>
                {form.objectif && (
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">🎯 {form.objectif}</p>
                    <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "0%" }} />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium mt-1">0% — début {form.objectif_debut}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-gray-100 shrink-0">
          {saveError && <p role="alert" className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-red-700">{saveError}</p>}
          {step > 0 && step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name.trim()}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-50">
              Suivant →
            </button>
          ) : step === 0 ? null : (
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</> : <><Check className="w-4 h-4" /> Créer la routine</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
