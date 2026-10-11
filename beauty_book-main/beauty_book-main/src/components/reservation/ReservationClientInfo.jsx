import { useEffect, useMemo, useState } from "react";
import { ClipboardList, MessageSquare, X, Clock3, ChevronRight } from "lucide-react";

const ACTIVE_STATUSES = new Set(["en_attente", "confirme"]);

function getReservationStart(reservation) {
  if (!reservation?.date) return null;
  const time = reservation.time || reservation.time_slot || "00:00";
  const start = new Date(`${String(reservation.date).slice(0, 10)}T${time}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function normalizeAnswers(reservation) {
  const raw = reservation?.custom_answers ?? reservation?.customAnswers ?? reservation?.questionnaire_answers ?? reservation?.answers;
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => ({
        id: item?.id || item?.question_id || `question-${index}`,
        label: item?.question || item?.label || item?.question_id || `Question ${index + 1}`,
        value: item?.answer ?? item?.value,
      }))
      .filter(item => item.value !== undefined && item.value !== null && item.value !== "");
  }
  if (!raw || typeof raw !== "object") return [];
  const labels = reservation?.custom_answer_labels || reservation?.customAnswerLabels || {};
  return Object.entries(raw)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([id, value]) => ({ id, label: labels[id] || id, value }));
}

function answerText(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return Object.values(value).join(", ");
  return String(value);
}

function InformationPanel({ reservation, mode, onClose, modal = false }) {
  const answers = normalizeAnswers(reservation);
  const comment = reservation?.notes || reservation?.commentaire || reservation?.comment || reservation?.client_comment || "";
  const title = mode === "client" ? "Informations de ma réservation" : "Informations du client";

  return (
    <div className={`bg-white ${modal ? "w-full max-w-lg rounded-3xl shadow-2xl" : "rounded-3xl border border-sky-100 shadow-sm"} overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 bg-gradient-to-r from-sky-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <ClipboardList className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-[14px] font-black text-gray-900">{title}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Réponses du formulaire et commentaire</p>
          </div>
        </div>
        {modal && (
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {answers.length > 0 ? (
          <div className="space-y-2">
            {answers.map(answer => (
              <div key={answer.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-3.5 py-3">
                <p className="text-[10px] font-bold text-gray-500">{answer.label}</p>
                <p className="text-[13px] font-black text-gray-900 mt-0.5 break-words">{answerText(answer.value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-gray-400 font-medium bg-gray-50 rounded-2xl px-3.5 py-3">Aucune réponse au formulaire enregistrée.</p>
        )}

        <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-3.5 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare className="w-4 h-4 text-orange-500" />
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Commentaire</p>
          </div>
          <p className="text-[13px] text-gray-700 font-medium whitespace-pre-wrap break-words">
            {comment || "Aucun commentaire ajouté."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReservationClientInfo({ reservation, mode = "client", autoOnly = false, autoTrigger = true }) {
  const [showDetails, setShowDetails] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const answers = useMemo(() => normalizeAnswers(reservation), [reservation]);
  const comment = reservation?.notes || reservation?.commentaire || reservation?.comment || reservation?.client_comment || "";

  useEffect(() => {
    if (!autoOnly || !reservation) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 20000);
    return () => window.clearInterval(timer);
  }, [autoOnly, reservation?.id]);

  useEffect(() => {
    if (!autoOnly || !reservation || !autoTrigger || !ACTIVE_STATUSES.has(reservation.status)) return;
    const start = getReservationStart(reservation);
    if (!start) return;
    const remaining = start.getTime() - now;
    if (remaining <= 0 || remaining > 15 * 60 * 1000) return;
    const storageKey = `bb_rdv_info_reminder_${reservation.id}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
    setShowDetails(true);
  }, [autoOnly, autoTrigger, now, reservation]);

  if (!reservation) return null;

  if (autoOnly) {
    return showDetails ? (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={() => setShowDetails(false)}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-lg" onClick={event => event.stopPropagation()}>
          <InformationPanel reservation={reservation} mode={mode} modal onClose={() => setShowDetails(false)} />
        </div>
      </div>
    ) : null;
  }

  return (
    <div>
      <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <ClipboardList className="w-5 h-5 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-gray-900">Informations du client</p>
            <p className="text-[11px] text-gray-500 font-medium">{answers.length} réponse{answers.length > 1 ? "s" : ""}{comment ? " · commentaire ajouté" : ""}</p>
          </div>
          <Clock3 className="w-4 h-4 text-sky-500 shrink-0" />
        </div>
        <button type="button" onClick={() => setShowDetails(true)} className="w-full mt-3 flex items-center justify-center gap-2 rounded-2xl bg-white border border-sky-100 py-3 text-[11px] font-black uppercase tracking-widest text-sky-700 active:scale-[0.98] transition-all">
          Voir les détails <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {showDetails && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={() => setShowDetails(false)}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-lg" onClick={event => event.stopPropagation()}>
            <InformationPanel reservation={reservation} mode={mode} modal onClose={() => setShowDetails(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
