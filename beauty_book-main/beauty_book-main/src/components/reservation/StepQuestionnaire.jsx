import { useState, useEffect } from "react";
import { ArrowLeft, Save, Scissors, Gem, Paintbrush, Flower2, Sparkles, Droplets, Zap, MessageSquare, ChevronRight, Check, Lightbulb } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { getQuestionsForPrestation } from "@/lib/serviceQuestions";

// Icônes par catégorie (le module canonique expose un nom d'icône texte).
// Source unique : src/lib/questionnaires.js — aussi publiée dans
// public/questionnaires.json pour l'agent vocal IA et Maria.
const ICON_COMPONENTS = {
  scissors: Scissors, gem: Gem, paintbrush: Paintbrush, flower: Flower2,
  sparkles: Sparkles, droplets: Droplets, zap: Zap, message: MessageSquare,
};

const STORAGE_KEY = "bb_client_service_preferences";
export default function StepQuestionnaire({
  booking,
  onUpdateBooking,
  onNext,
  onBack
}) {
  const primaryService = booking.services?.[0] || null;
  const bundle = booking.bundle || null;

  // Prestations incluses dans le bundle : la catégorie du questionnaire est
  // celle DOMINANTE des prestations incluses (service OU bundle → questions
  // adaptées à la catégorie réelle).
  const [includedServices, setIncludedServices] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = Array.isArray(bundle?.service_ids) ? bundle.service_ids : [];
      if (!ids.length) { if (alive) setIncludedServices([]); return; }
      try {
        const { data } = await supabase
          .from("Service")
          .select("id,title,name,category,subcategory")
          .in("id", ids);
        if (alive) setIncludedServices(data || []);
      } catch { if (alive) setIncludedServices([]); }
    })();
    return () => { alive = false; };
  }, [bundle?.id]);

  // Questionnaire synchronisé — même source que l'agent vocal IA et Maria
  // (src/lib/questionnaires.js → public/questionnaires.json) : questions
  // personnalisées du pro pour un service, sinon questionnaire de la catégorie
  // du service ou — pour un bundle — de la catégorie dominante de ses prestations.
  const { questions, categoryKey: catKey, categoryLabel: catLabel, catTip, catIcon } =
    getQuestionsForPrestation({ service: primaryService, bundle, includedServices });
  const CatIcon = ICON_COMPONENTS[catIcon] || Scissors;

  const [answers, setAnswers] = useState(() => {
    // Au retour depuis le récapitulatif (« Modifier »), on repart des réponses
    // déjà saisies ; sinon on reprend la sauvegarde locale éventuelle.
    const fromBooking = booking.customAnswers && typeof booking.customAnswers === "object" ? booking.customAnswers : {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...fromBooking, ...JSON.parse(saved) };
    } catch {}
    return { ...fromBooking };
  });

  const answeredCount = questions.filter(q => answers[q.id]).length;

  const [savePreference, setSavePreference] = useState(() => {
    try {
      const pref = localStorage.getItem("bb_save_preferences_enabled");
      return pref !== "false";
    } catch {}
    return true;
  });

  const handleAnswerSelect = (questionId, option) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: option };
      if (savePreference) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  };

  const toggleSavePreference = () => {
    const newVal = !savePreference;
    setSavePreference(newVal);
    try {
      localStorage.setItem("bb_save_preferences_enabled", String(newVal));
      if (!newVal) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
      }
    } catch {}
  };

  const [clientNotes, setClientNotes] = useState(booking.notes || "");

  const handleValidateStep = () => {
    onUpdateBooking({ customAnswers: answers, notes: clientNotes });
    onNext();
  };

  return (
    <div className="min-h-screen bg-[#FFF5F0] font-display" style={{ paddingBottom: "calc(220px + env(safe-area-inset-bottom, 16px))" }}>
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl px-5 pt-12 pb-4 flex items-center justify-between border-b border-gray-100 shadow-sm">
        <button onClick={onBack} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-[#E8732A] uppercase tracking-widest">Étape 2 sur 3</p>
          <p className="text-[17px] font-black text-gray-900">Vos Préférences</p>
        </div>
        <div className="w-9" />
      </div>

      <div className="px-5 pt-5 space-y-5">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                <Save className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-[13px] font-black text-gray-900">Sauvegarder mes réponses</p>
                <p className="text-[11px] text-gray-400 font-medium">Réutilisées automatiquement la prochaine fois</p>
              </div>
            </div>
            <button
              onClick={toggleSavePreference}
              className={`relative w-12 h-7 rounded-full transition-all ${savePreference ? "bg-[#E8732A]" : "bg-gray-200"}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${savePreference ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <CatIcon className="w-5 h-5 text-[#E8732A]" />
            <div className="flex-1">
              <h3 className="text-[16px] font-black text-gray-900">{catLabel}</h3>
              <p className="text-[11px] text-gray-400 font-medium">
                {primaryService.title || primaryService.name || "Votre service"}
              </p>
            </div>
            {/* Progression */}
            <div className="text-right shrink-0">
              <p className="text-[12px] font-black text-[#E8732A]">{answeredCount}/{questions.length}</p>
              <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-[#E8732A] rounded-full transition-all duration-300"
                  style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Conseil du pro */}
          {catTip && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-800 font-medium leading-relaxed">
                <span className="font-black">Conseil du pro : </span>{catTip}
              </p>
            </div>
          )}

          <div className="space-y-5">
            {questions.map((qItem, qIdx) => {
              const currentAns = answers[qItem.id] || "";
              return (
                <div key={qItem.id} className="space-y-2.5">
                  <p className="text-[14px] font-black text-gray-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-[#E8732A] text-[12px] font-black flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    {qItem.question}
                  </p>
                  {qItem.type === "ouverte" || qItem.options.length === 0 ? (
                    <input
                      type="text"
                      value={currentAns}
                      onChange={e => handleAnswerSelect(qItem.id, e.target.value)}
                      placeholder="Votre réponse…"
                      className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-[13px] font-medium text-gray-800 outline-none border border-gray-200 focus:border-[#E8732A] placeholder:text-gray-300"
                    />
                  ) : (
                  <div className="flex flex-wrap gap-2">
                    {qItem.options.map((opt) => {
                      const isSelected = currentAns === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleAnswerSelect(qItem.id, opt)}
                          className={`px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border ${
                            isSelected
                              ? "bg-[#E8732A] text-white border-[#E8732A] shadow-sm"
                              : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
                          }`}
                        >
                          {isSelected && <span className="mr-1">✓</span>}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Commentaire client */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[13px] font-black text-gray-900">Commentaire</p>
              <p className="text-[10px] text-gray-400 font-medium">Informations pour le professionnel</p>
            </div>
          </div>
          <textarea
            value={clientNotes}
            onChange={e => setClientNotes(e.target.value)}
            placeholder="Ex: allergies, demandes spéciales, étage, code d'accès…"
            rows={3}
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[13px] text-gray-700 font-medium outline-none border border-gray-200 focus:border-primary resize-none placeholder:text-gray-300"
          />
        </div>

      </div>

      <div className="fixed left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-3 z-[90] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ bottom: "calc(68px + env(safe-area-inset-bottom, 16px))" }}>
        <button
          onClick={handleValidateStep}
          className="w-full py-4 rounded-2xl font-black text-[15px] uppercase tracking-widest text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #E8732A, #E84466)", boxShadow: "0 8px 25px rgba(232,115,42,0.35)" }}
        >
          Continuer vers la confirmation <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
