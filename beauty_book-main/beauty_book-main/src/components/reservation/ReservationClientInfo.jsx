import { useEffect, useMemo, useState } from "react";
import { ClipboardList, MessageSquare, X, Clock3, ChevronRight, Search, CheckCircle2 } from "lucide-react";
import { getReservationTime } from "@/lib/reservationTime";

const ACTIVE_STATUSES = new Set(["en_attente", "confirme"]);
const QUESTION_LABELS = {
  prep_notes: "Préférences pendant la prestation",
  hair_length: "Longueur actuelle des cheveux",
  hair_history: "Historique capillaire",
  sensitivities: "Sensibilités connues",
  styling_preference: "Style souhaité",
  extensions_provided: "Extensions à prévoir",
  hair_texture: "Texture des cheveux",
  hair_type: "Type de cheveux",
  scalp_sensitivity: "Sensibilité du cuir chevelu",
  appointment_source: "Comment avez-vous connu le salon ?",
};

function prettyQuestionLabel(label, id) {
  const raw = String(label || id || "Question").trim();
  const key = String(id || raw).trim().toLowerCase().replace(/[ -]+/g, "_");
  if (QUESTION_LABELS[key]) return QUESTION_LABELS[key];
  if (raw === id || /^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(raw)) {
    const readable = raw.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
    return QUESTION_LABELS[readable.toLowerCase().replace(/ /g, "_")] || readable;
  }
  return raw;
}

function getReservationStart(reservation) {
  if (!reservation?.date) return null;
  const time = getReservationTime(reservation) || "00:00";
  const start = new Date(`${String(reservation.date).slice(0, 10)}T${time}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function normalizeAnswers(reservation) {
  const candidates = [
    reservation?.custom_answers,
    reservation?.customAnswers,
    reservation?.questionnaire_answers,
    reservation?.questionnaireAnswers,
    reservation?.questionnaire_responses,
    reservation?.form_answers,
    reservation?.responses,
    reservation?.reponses,
    reservation?.answers,
  ];
  const hasAnswers = value => {
    if (typeof value === "string") {
      try { return hasAnswers(JSON.parse(value)); } catch { return value.trim().length > 0; }
    }
    if (Array.isArray(value)) return value.length > 0;
    if (!value || typeof value !== "object") return false;
    return Object.keys(value).length > 0;
  };
  let raw = candidates.find(hasAnswers);
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return [{ id: "reponses", label: "Réponses du formulaire", value: raw }]; }
  }
  // Certaines intégrations stockent l'objet complet du formulaire sous une clé
  // imbriquée plutôt que directement sous custom_answers.
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    raw = raw.answers ?? raw.responses ?? raw.reponses ?? raw.questions ?? raw;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { return [{ id: "reponses", label: "Réponses du formulaire", value: raw }]; }
    }
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => ({
        id: item?.id || item?.question_id || `question-${index}`,
        label: prettyQuestionLabel(item?.question || item?.question_text || item?.label || item?.question_id, item?.question_id || item?.id),
        value: item && typeof item === "object" ? (item.answer ?? item.answer_text ?? item.response ?? item.value) : item,
      }))
      .filter(item => item.value !== undefined && item.value !== null && item.value !== "" && !(Array.isArray(item.value) && item.value.length === 0));
  }
  if (!raw || typeof raw !== "object") return [];
  const labels = [reservation?.custom_answer_labels, reservation?.customAnswerLabels, reservation?.question_labels, reservation?.questionLabels]
    .find(value => value && typeof value === "object" && Object.keys(value).length > 0) || {};
  return Object.entries(raw)
    .filter(([key, value]) => !["notes", "comment", "commentaire", "created_at", "updated_at"].includes(key.toLowerCase()) && value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0))
    .map(([id, value]) => ({
      id,
      label: prettyQuestionLabel(labels[id] || value?.question || value?.question_text || value?.label || id, id),
      value: value && typeof value === "object" && !Array.isArray(value)
        ? (value.answer ?? value.answer_text ?? value.response ?? value.value ?? value.selected ?? value)
        : value,
    }))
    .filter(item => item.value !== undefined && item.value !== null && item.value !== "");
}

function getReservationComment(reservation) {
  const comment = [reservation?.notes, reservation?.client_notes, reservation?.commentaire, reservation?.comment,
    reservation?.client_comment, reservation?.booking_comment, reservation?.commentaire_parcours]
    .find(value => typeof value === "string" && value.trim());
  return comment?.trim() || "";
}

function answerText(value) {
  if (Array.isArray(value)) return value.map(answerText).filter(Boolean).join(", ");
  if (typeof value === "object" && value !== null) return Object.values(value).map(answerText).filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
}

function InformationPanel({ reservation, mode, onClose, modal = false }) {
  const [query, setQuery] = useState("");
  const answers = normalizeAnswers(reservation);
  const visibleAnswers = answers.filter(answer => `${answer.label} ${answerText(answer.value)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const comment = getReservationComment(reservation);
  const title = mode === "client" ? "Informations de ma réservation" : "Informations du client";

  return (
    <div role={modal ? "dialog" : undefined} aria-modal={modal ? "true" : undefined} aria-labelledby={modal ? "reservation-info-title" : undefined}
      className={`flex flex-col bg-white ${modal ? "h-[100dvh] max-h-[100dvh] w-full rounded-none shadow-2xl md:h-auto md:max-h-[min(88dvh,820px)] md:max-w-2xl md:rounded-[28px]" : "rounded-3xl border border-sky-100 shadow-sm"} overflow-hidden`}>
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 pb-4 pt-[calc(14px+env(safe-area-inset-top,0px))] md:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p id={modal ? "reservation-info-title" : undefined} className="truncate text-[15px] font-black text-slate-900">{title}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">Réponses du formulaire et commentaire</p>
          </div>
        </div>
        {modal && <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"><X className="h-4 w-4" /></button>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f7f8fb] px-4 py-4 md:px-6 md:py-5">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Votre rendez-vous</p><p className="mt-1 text-[13px] font-extrabold text-slate-800">{answers.length} réponse{answers.length > 1 ? "s" : ""} enregistrée{answers.length > 1 ? "s" : ""}</p></div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-[18px] w-[18px]" /></span>
        </div>

        {answers.length > 6 && <label className="mb-4 flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-slate-400 shadow-sm focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100"><Search className="h-4 w-4 shrink-0" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une réponse…" className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-slate-800 outline-none placeholder:text-slate-400" /></label>}

        {answers.length > 0 ? (
          <section aria-label="Réponses au formulaire">
            <div className="mb-2 flex items-center justify-between px-1"><h3 className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Réponses du formulaire</h3><span className="text-[10px] font-bold text-slate-400">{visibleAnswers.length}/{answers.length}</span></div>
            {visibleAnswers.length ? <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {visibleAnswers.map((answer, index) => (
                <article key={answer.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,.035)]">
                  <div className="mb-2 flex items-start justify-between gap-2"><p className="text-[11px] font-semibold leading-snug text-slate-500">{answer.label}</p><span className="shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-[9px] font-black text-slate-400">{String(index + 1).padStart(2, "0")}</span></div>
                  <p className="break-words text-[14px] font-extrabold leading-snug text-slate-900">{answerText(answer.value)}</p>
                </article>
              ))}
            </div> : <p className="rounded-2xl bg-white p-4 text-center text-[12px] font-medium text-slate-500">Aucune réponse ne correspond à cette recherche.</p>}
          </section>
        ) : <p className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[12px] font-medium text-slate-500">Aucune réponse au formulaire n’a été enregistrée.</p>}

        <section className="mt-5 rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50 to-white p-4">
          <div className="mb-2 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600"><MessageSquare className="h-4 w-4" /></span><h3 className="text-[11px] font-black uppercase tracking-[.12em] text-orange-700">Commentaire</h3></div>
          <p className="whitespace-pre-wrap break-words text-[13px] font-medium leading-relaxed text-slate-700">{comment || "Aucun commentaire ajouté."}</p>
        </section>
      </div>

      {modal && <footer className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 md:px-6"><button type="button" onClick={onClose} className="w-full rounded-2xl bg-slate-900 py-3.5 text-[12px] font-black uppercase tracking-[.1em] text-white transition hover:bg-slate-800 active:scale-[.98]">Fermer les informations</button></footer>}
    </div>
  );
}

export default function ReservationClientInfo({ reservation, mode = "client", autoOnly = false, autoTrigger = true }) {
  const [showDetails, setShowDetails] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const answers = useMemo(() => normalizeAnswers(reservation), [reservation]);
  const comment = getReservationComment(reservation);

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
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-0 md:p-5" onClick={() => setShowDetails(false)}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
        <div className="relative z-10 h-full w-full md:h-auto md:max-w-2xl" onClick={event => event.stopPropagation()}>
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
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-0 md:p-5" onClick={() => setShowDetails(false)}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div className="relative z-10 h-full w-full md:h-auto md:max-w-2xl" onClick={event => event.stopPropagation()}>
            <InformationPanel reservation={reservation} mode={mode} modal onClose={() => setShowDetails(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
