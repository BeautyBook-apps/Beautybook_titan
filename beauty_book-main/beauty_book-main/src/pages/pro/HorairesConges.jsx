import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useState, useEffect } from "react";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { ArrowLeft, Clock, Save, Plus, X, Trash2, Loader2, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { isOvernight, ouvertureFromDemande, applyNightMode, summarizeHours } from "@/lib/hours";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DEFAULT_DAY = { open: false, start: "", end: "", pause_start: "", pause_end: "" };
// Structure d'horaires vierge partagée (valeur initiale quand aucun cache).
const DEFAULT_HORAIRES = (() => {
  const init = {};
  DAYS.forEach(d => { init[d] = { ...DEFAULT_DAY }; });
  return init;
})();

// ── Horaires Form ──────────────────────────────────────────────────────────────
function HorairesForm({ horaires, onChange }) {
  const [bulkOpen, setBulkOpen] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [bulkPauseStart, setBulkPauseStart] = useState("");
  const [bulkPauseEnd, setBulkPauseEnd] = useState("");
  const [applied, setApplied] = useState(false);

  const handleApplyToAll = () => {
    DAYS.forEach(day => {
      onChange(day, {
        open: true,
        start: bulkOpen,
        end: bulkEnd,
        pause_start: bulkPauseStart,
        pause_end: bulkPauseEnd,
      });
    });
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* ── Configuration rapide ── */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
            <Copy className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-black text-gray-900">Appliquer à tous les jours</p>
            <p className="text-[10px] font-medium text-gray-400">Définissez une fois, activez partout</p>
          </div>
        </div>

        {/* Ouverturaire */}
        <div className="mb-4">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Horaires d'ouverture</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="time"
                value={bulkOpen}
                onChange={e => setBulkOpen(e.target.value)}
                className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] font-black text-gray-900 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <span className="text-[12px] font-bold text-gray-300 shrink-0">→</span>
            <div className="flex-1">
              <input
                type="time"
                value={bulkEnd}
                onChange={e => setBulkEnd(e.target.value)}
                className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] font-black text-gray-900 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Pause */}
        <div className="mb-4">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Pause</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="time"
                value={bulkPauseStart}
                onChange={e => setBulkPauseStart(e.target.value)}
                placeholder="Début"
                className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] font-black text-gray-900 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <span className="text-[12px] font-bold text-gray-300 shrink-0">→</span>
            <div className="flex-1">
              <input
                type="time"
                value={bulkPauseEnd}
                onChange={e => setBulkPauseEnd(e.target.value)}
                placeholder="Fin"
                className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] font-black text-gray-900 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleApplyToAll}
          className={`w-full py-3 rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 ${
            applied
              ? "bg-green-500 text-white"
              : "bg-primary text-white shadow-md shadow-primary/20"
          }`}
        >
          {applied ? (
            <><Check className="w-4 h-4" /> Appliqué à tous les jours</>
          ) : (
            <><Copy className="w-4 h-4" /> Appliquer à tous les jours</>
          )}
        </button>
      </div>

      {/* ── Horaires par jour ── */}
      <div className="space-y-2">
        {DAYS.map((day, i) => {
          const h = horaires[day] || DEFAULT_DAY;
          const hasPause = h.pause_start && h.pause_end;
          const nightColors = h.open && isOvernight(h.start, h.end);
          return (
            <div key={day} className={`rounded-2xl p-4 transition-all ${h.open ? nightColors ? "bg-indigo-50 border border-indigo-100" : "bg-white border border-gray-100 shadow-sm" : "bg-gray-50 border border-gray-100"}`}>
              {/* Ligne principale : toggle + jour + horaires */}
              <div className="flex items-center gap-3">
                {/* Toggle */}
                <button
                  onClick={() => onChange(day, { ...h, open: !h.open })}
                  className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${h.open ? "bg-primary" : "bg-gray-200"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.open ? "translate-x-6" : "translate-x-1"}`} />
                </button>

                {/* Nom du jour */}
                <span className={`text-[13px] font-black w-20 shrink-0 ${h.open ? "text-gray-900" : "text-gray-300"}`}>
                  {DAY_LABELS[i]}
                </span>

                {/* Horaires ouverture/fermeture */}
                {h.open ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={h.start}
                      onChange={e => onChange(day, { ...h, start: e.target.value })}
                      className="bg-gray-100 rounded-xl px-3 py-2 text-[13px] font-black text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 w-full"
                    />
                    <span className="text-[12px] font-medium text-gray-300 shrink-0">→</span>
                    <input
                      type="time"
                      value={h.end}
                      onChange={e => onChange(day, { ...h, end: e.target.value })}
                      className="bg-gray-100 rounded-xl px-3 py-2 text-[13px] font-black text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 w-full"
                    />
                  </div>
                ) : (
                  <span className="text-[12px] font-medium text-gray-300 flex-1">Fermé</span>
                )}
              </div>

              {/* Ligne pause (seulement si jour ouvert) */}
              {h.open && (
                <div className="flex items-center gap-3 mt-2.5">
                  <div className="w-11 shrink-0" />
                  <span className="text-[10px] font-bold text-gray-300 w-20 shrink-0 uppercase tracking-wider">Pause</span>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={h.pause_start || ""}
                      onChange={e => onChange(day, { ...h, pause_start: e.target.value })}
                      className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[12px] font-bold text-gray-500 outline-none focus:ring-2 focus:ring-primary/30 w-full placeholder:text-gray-300"
                    />
                    <span className="text-[12px] font-medium text-gray-300 shrink-0">→</span>
                    <input
                      type="time"
                      value={h.pause_end || ""}
                      onChange={e => onChange(day, { ...h, pause_end: e.target.value })}
                      className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[12px] font-bold text-gray-500 outline-none focus:ring-2 focus:ring-primary/30 w-full placeholder:text-gray-300"
                    />
                    {(h.pause_start || h.pause_end) && (
                      <button
                        onClick={() => onChange(day, { ...h, pause_start: "", pause_end: "" })}
                        className="w-7 h-7 flex items-center justify-center shrink-0 active:scale-90"
                      >
                        <X className="w-3.5 h-3.5 text-gray-300" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Congés Section ─────────────────────────────────────────────────────────────
function CongesSection({ conges, onChange }) {
  const [adding, setAdding] = useState(false);
  const [newConge, setNewConge] = useState({ start: "", end: "", label: "" });

  const handleAdd = () => {
    if (!newConge.start || !newConge.end) return;
    onChange([...conges, { ...newConge, id: Date.now().toString() }]);
    setNewConge({ start: "", end: "", label: "" });
    setAdding(false);
  };

  const handleRemove = (id) => {
    onChange(conges.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-black text-gray-900">Périodes de congés</h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 bg-gray-100 active:bg-gray-200 rounded-xl px-3 py-2 text-[12px] font-black text-gray-600 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Début</p>
              <input
                type="date"
                value={newConge.start}
                onChange={e => setNewConge(c => ({ ...c, start: e.target.value }))}
                className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-900 outline-none"
              />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fin</p>
              <input
                type="date"
                value={newConge.end}
                onChange={e => setNewConge(c => ({ ...c, end: e.target.value }))}
                className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-900 outline-none"
              />
            </div>
          </div>
          <input
            type="text"
            value={newConge.label}
            onChange={e => setNewConge(c => ({ ...c, label: e.target.value }))}
            placeholder="Motif (ex: Vacances d'été)"
            className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-900 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setNewConge({ start: "", end: "", label: "" }); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[12px] font-black text-gray-500 active:scale-95 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!newConge.start || !newConge.end}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[12px] font-black active:scale-95 transition-all disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {conges.length > 0 ? (
        <div className="space-y-2">
          {conges.sort((a, b) => (a.start || "").localeCompare(b.start || "")).map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-red-50 rounded-2xl px-4 py-3 border border-red-100">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-gray-900">{c.label || "Congés"}</p>
                <p className="text-[11px] font-medium text-gray-500">
                  {c.start} → {c.end}
                </p>
              </div>
              <button onClick={() => handleRemove(c.id)} className="w-8 h-8 flex items-center justify-center active:scale-90">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-[12px] font-medium text-gray-300">Aucune période de congés ajoutée</p>
        </div>
      )}
    </div>
  );
}

// ── Mode Nuit Card ─────────────────────────────────────────────────────────────
function ModeNuitCard({ travailNuit, onToggle, horaires }) {
  const effSummary = summarizeHours(applyNightMode(horaires, travailNuit));
  return (
    <div className={`rounded-3xl p-4 flex items-center gap-4 border active:scale-[0.98] transition-all cursor-pointer ${travailNuit ? "bg-indigo-950 border-indigo-800" : "bg-indigo-50 border-indigo-100"}`}
      onClick={() => onToggle(!travailNuit)}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${travailNuit ? "bg-indigo-800" : "bg-indigo-100"}`}>
        <Clock className={`w-6 h-6 ${travailNuit ? "text-indigo-300" : "text-indigo-500"}`} />
      </div>
      <div className="flex-1">
        <p className={`text-[15px] font-black ${travailNuit ? "text-indigo-200" : "text-indigo-700"}`}>
          Mode Nuit {travailNuit ? "🌙" : ""}
        </p>
        <p className={`text-[12px] font-medium mt-0.5 ${travailNuit ? "text-indigo-400" : "text-indigo-400"}`}>
          {travailNuit ? `Actif · ${effSummary || "09:00 – 07:00"} (lendemain)` : "Désactivé — horaires de jour"}
        </p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggle(!travailNuit); }}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${travailNuit ? "bg-indigo-500" : "bg-gray-200"}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${travailNuit ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function HorairesConges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cacheKey = user?.email ? `horaires_${user.email}` : null;
  // Affichage direct depuis le cache : les dernières valeurs connues s'affichent
  // immédiatement, le rafraîchissement réseau se fait en arrière-plan sans jamais
  // vider l'affichage. La logique de pré-remplissage reste dans l'effet ci-dessous.
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.horaires);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [profil, setProfil] = useCachedState(cacheKey, null, c => c?.profil || null);
  const [horaires, setHoraires] = useCachedState(cacheKey, DEFAULT_HORAIRES, c => c?.horaires || DEFAULT_HORAIRES);
  const [conges, setConges] = useCachedState(cacheKey, [], c => c?.conges || []);
  const [travailNuit, setTravailNuit] = useState(() => localStorage.getItem("bb_night_mode") === "true");

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    Promise.all([
      supabase.from('ProfilPro').select('*').eq('user_email', user.email).maybeSingle(),
      // Dernière demande Devenir Pro : sert de pré-remplissage si aucun horaire n'est encore configuré
      supabase.from('DemandeProV2').select('days, time_slots, travail_nuit').eq('user_email', user.email).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
      .then(([{ data: row }, { data: demande }]) => {
        if (row) {
          setProfil(row);
          const ouv = row.ouverture || row.horaires || {};
          const hasHours = ouv && typeof ouv === "object" && DAYS.some(d => ouv[d] && (ouv[d].open || ouv[d].start || ouv[d].end));
          // Pré-remplissage depuis le parcours Devenir Pro quand rien n'est configuré
          const prefill = !hasHours ? ouvertureFromDemande(demande) : null;
          const init = {};
          DAYS.forEach(d => {
            const existing = ouv[d] || prefill?.[d];
            if (existing) {
              init[d] = {
                open: existing.open !== undefined ? existing.open : false,
                start: existing.start || "",
                end: existing.end || "",
                pause_start: existing.pause_start || "",
                pause_end: existing.pause_end || "",
              };
            } else {
              init[d] = { ...DEFAULT_DAY };
            }
          });
          setHoraires(init);
          const congesVal = row.conges || ouv.conges || [];
          setConges(congesVal);
          mergePageCache(cacheKey, { profil: row, horaires: init, conges: congesVal });
          const dbNight = !!row.travail_nuit || (prefill ? !!demande?.travail_nuit : false);
          const localNight = localStorage.getItem("bb_night_mode") === "true";
          if (dbNight !== localNight) {
            localStorage.setItem("bb_night_mode", String(dbNight));
          }
          setTravailNuit(dbNight);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("[HorairesConges] Fetch error:", err);
        setLoading(false);
      });
  }, [user?.email]);

  const handleDayChange = (day, value) => {
    setHoraires(prev => ({ ...prev, [day]: value }));
  };

  const handleSave = async () => {
    if (!user?.email) {
      setSaveError("Vous devez être connecté pour modifier vos horaires.");
      return;
    }
    setSaving(true);
    setSaveError("");

    try {
      const fullHoraires = {};
      DAYS.forEach(d => {
        fullHoraires[d] = horaires[d] || { ...DEFAULT_DAY };
      });
      const ouverture = { ...fullHoraires, conges };

      // Générer les pauses au format attendu par StepCalendar
      const pauseMap = {};
      DAYS.forEach(day => {
        const h = fullHoraires[day];
        if (h.open && h.pause_start && h.pause_end) {
          const key = `${h.pause_start}-${h.pause_end}`;
          if (!pauseMap[key]) {
            pauseMap[key] = { start: h.pause_start, end: h.pause_end, days: [] };
          }
          pauseMap[key].days.push(day);
        }
      });
      const pauses = Object.values(pauseMap);

      // Check if profile exists
      let profileId = profil?.id;
      if (!profileId) {
        const { data: existing } = await supabase
          .from('ProfilPro')
          .select('id')
          .eq('user_email', user.email)
          .maybeSingle();
        if (existing?.id) {
          profileId = existing.id;
        }
      }

      const updateData = {
        ouverture,
        horaires: ouverture,
        conges,
        travail_nuit: travailNuit,
        updated_at: new Date().toISOString(),
      };

      let saveErr = null;
      if (profileId) {
        const { data: updatedRows, error } = await supabase
          .from('ProfilPro')
          .update(updateData)
          .eq('id', profileId)
          .select();
        saveErr = error;
        // If RLS blocks update (created_by_id mismatch), try with user_email match
        if (error) {
          const { data: updatedRows2, error: error2 } = await supabase
            .from('ProfilPro')
            .update(updateData)
            .eq('user_email', user.email)
            .select();
          if (!error2 && updatedRows2?.[0]) { saveErr = null; setProfil(updatedRows2[0]); }
        }
        if (!saveErr && updatedRows?.[0]) setProfil(updatedRows[0]);
      } else {
        const { user: authUser } = await supabase.auth.getUser();
        // Upsert plutôt qu'insert : évite les lignes ProfilPro en double
        // (qui désynchroniseraient la page client)
        const { data: createdRows, error } = await supabase
          .from('ProfilPro')
          .upsert({
            user_email: user.email,
            created_by_id: authUser?.id || null,
            ...updateData
          }, { onConflict: 'user_email' })
          .select();
        saveErr = error;
        if (createdRows?.[0]) setProfil(createdRows[0]);
      }

      if (saveErr) {
        console.error('[HorairesConges] Save error:', saveErr);
        setSaveError("Erreur lors de la sauvegarde : " + saveErr.message);
      } else {
        setSaveSuccess(true);
        mergePageCache(cacheKey, { horaires: ouverture, conges });
        setTimeout(() => setSaveSuccess(false), 3000);
      }

      window.dispatchEvent(new CustomEvent('pro-profile-updated', { detail: { travail_nuit: travailNuit } }));
    } catch (e) {
      console.error('[HorairesConges] Save exception:', e);
      setSaveError("Erreur lors de la sauvegarde : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNuit = (val) => {
    setTravailNuit(val);
    localStorage.setItem("bb_night_mode", String(val));
    // Le flag suffit : applyNightMode() applique 09:00 → 07:00 à l'affichage
    // (client + réservation) sans écraser les horaires de jour personnalisés.
  };

  if (loading && !readPageCache(cacheKey)?.horaires) {
    return (
      <div className="font-display min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="font-display min-h-full bg-[#f5f5f5] pb-10">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 sticky top-0 z-10 border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate("/pro/gestion-agenda?tab=gestion")}
            className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div>
            <h1 className="text-[20px] font-black text-gray-900">Horaires & Congés</h1>
            <p className="text-[11px] font-medium text-gray-400">Configurez vos horaires d'ouverture</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-xs font-bold flex items-center justify-between">
            <span>{saveError}</span>
            <button onClick={() => setSaveError("")} className="text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Mode Nuit */}
        <ModeNuitCard travailNuit={travailNuit} onToggle={handleToggleNuit} horaires={horaires} />

        {/* Horaires */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-[14px] font-black text-gray-900 uppercase tracking-widest">Horaires</h2>
          </div>
          <HorairesForm horaires={horaires} onChange={handleDayChange} />
        </div>

        {/* Congés */}
        <CongesSection conges={conges} onChange={setConges} />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
          ) : saveSuccess ? (
            <><Check className="w-4 h-4" /> Enregistré !</>
          ) : (
            <><Save className="w-4 h-4" /> Enregistrer</>
          )}
        </button>
      </div>
    </div>
  );
}
