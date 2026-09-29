// ─────────────────────────────────────────────────────────────────────────────
// AssistantChatWidget — bulle « Réserver avec MARIA » + fenêtre de chat,
// affichées sur la page publique du salon (VueClient, visiteurs uniquement).
// Questions libres via le moteur partagé (answerQuestion) + parcours de
// réservation RÉEL (table Reservation → Gestion agenda + Google Agenda).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { X, Send, Calendar, Clock, Sparkles, Phone, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  buildKnowledge, answerQuestion, detectBookingIntent, EMAIL_RE,
  createAssistantReservation, pushToGoogleCalendar, bookingConfirmationText,
  formatDateFr,
} from "@/lib/mariaAssistant";
import { getQuestionnaireForService } from "@/lib/questionnaires";
import "./AssistantChatWidget.css";

const AVATAR = "/maria-avatar.png";

const GREETING = (salon) =>
  `Bonjour ! Je suis Maria IA, votre assistante de réservation. 🌸\n` +
  `Je peux vous aider à réserver un créneau${salon ? ` chez ${salon}` : ""}, voir les disponibilités ou répondre à toutes vos questions.\n` +
  `Que souhaitez-vous faire ?`;

const QUICK_ACTIONS = [
  { id: "book", label: "Réserver un créneau", Icon: Calendar },
  { id: "slots", label: "Voir disponibilités", Icon: Clock },
  { id: "services", label: "Nos services", Icon: Sparkles },
  { id: "call", label: "Appeler le salon", Icon: Phone },
];

const SUGGESTIONS = [
  { id: "book", label: "Réserver", Icon: Calendar },
  { id: "slots", label: "Disponibilités", Icon: Clock },
  { id: "services", label: "Services", Icon: Sparkles },
];

const nowTime = () =>
  new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function AssistantChatWidget({ proEmail, salonName }) {
  const [open, setOpen] = useState(false);
  const [knowledge, setKnowledge] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [bookingPreset, setBookingPreset] = useState("");
  const [bookingDone, setBookingDone] = useState(false);
  const timers = useRef([]);
  const scrollRef = useRef(null);
  const greeted = useRef(false);
  const idRef = useRef(0);

  const push = (m) => {
    idRef.current += 1;
    setMsgs((prev) => [...prev.slice(-80), { ...m, _id: idRef.current, time: m.time || nowTime() }]);
  };
  const later = (ms) => new Promise((res) => { const t = setTimeout(res, ms); timers.current.push(t); });

  // Charge les VRAIES données du salon à l'ouverture.
  useEffect(() => {
    if (!open || !proEmail || greeted.current) return;
    greeted.current = true;
    (async () => {
      let k = null;
      try { k = await buildKnowledge(proEmail); } catch { /* ignore */ }
      setKnowledge(k);
      setTyping(true);
      await later(800);
      setTyping(false);
      push({ from: "bot", text: GREETING(k?.salonName || salonName), actions: QUICK_ACTIONS });
    })();
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [open, proEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, showBooking]);

  const botAnswer = async (text) => {
    setTyping(true);
    await later(900);
    setTyping(false);
    const ans = answerQuestion(text, knowledge);
    push({ from: "bot", text: ans.text });
    if ((ans.type === "booking" || detectBookingIntent(text)) && !bookingDone) {
      await later(400);
      setBookingPreset("");
      setShowBooking(true);
    }
  };

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || typing) return;
    setInput("");
    push({ from: "me", text });
    await botAnswer(text);
  };

  const startBooking = (serviceId = "", serviceName = "") => {
    setBookingPreset(serviceId);
    setShowBooking(true);
    push({ from: "me", text: serviceName ? `Je veux réserver : ${serviceName}` : "Je veux réserver un créneau" });
  };

  const onQuickAction = async (id) => {
    if (id === "book") { startBooking(); return; }
    if (id === "slots") {
      push({ from: "me", text: "Voir les disponibilités" });
      setTyping(true);
      await later(800);
      setTyping(false);
      const svcs = (knowledge?.services || []).slice(0, 12);
      if (svcs.length > 0) {
        push({
          from: "bot",
          text: "Avec plaisir ! Voici nos prestations — touchez-en une pour réserver :",
          chips: svcs.map((s) => ({
            id: String(s.id),
            label: s.name,
            sub: s.price != null ? `${s.price}€` : "",
          })),
          onChip: (chip) => startBooking(chip.id, chip.label),
        });
      } else {
        push({ from: "bot", text: "Dites-moi quel service vous intéresse et je vous propose un créneau tout de suite 💛" });
      }
      return;
    }
    if (id === "services") {
      push({ from: "me", text: "Quels sont vos services ?" });
      await botAnswer("quels sont vos services et vos prix");
      return;
    }
    if (id === "call") {
      push({ from: "me", text: "Je veux parler au salon" });
      setTyping(true);
      await later(700);
      setTyping(false);
      const phone = (knowledge?.phone || "").trim();
      if (phone) {
        push({
          from: "bot",
          text: `Vous pouvez joindre le salon directement :`,
          link: { label: `📞 ${phone}`, href: `tel:${phone.replace(/[^+\d]/g, "")}` },
        });
      } else {
        push({ from: "bot", text: "Le salon vous répondra ici même — laissez votre question, je transmets 💛" });
      }
    }
  };

  const confirmBooking = async (data, setErr) => {
    const errs = [];
    if (!data.serviceId) errs.push("Choisissez un service.");
    if (!data.date) errs.push("Choisissez une date.");
    if (!data.time) errs.push("Choisissez une heure.");
    if (!(data.name || "").trim()) errs.push("Indiquez votre prénom.");
    if (String(data.phone || "").replace(/\D/g, "").length < 8) errs.push("Numéro de téléphone incomplet.");
    if (data.email && !EMAIL_RE.test(data.email.trim())) errs.push("Cet email ne semble pas valide.");
    if (errs.length) { setErr(errs[0]); return; }
    const svc = (knowledge?.services || []).find((s) => String(s.id) === String(data.serviceId));
    setShowBooking(false);
    push({ from: "me", text: `Réserver : ${svc ? svc.name : "Prestation"}, le ${formatDateFr(data.date)} à ${data.time}` });
    setTyping(true);
    try {
      const reservation = await createAssistantReservation({
        proEmail,
        salonName: knowledge?.salonName || salonName,
        proName: knowledge?.ownerName || "",
        service: svc,
        date: data.date,
        time: data.time,
        clientName: data.name.trim(),
        clientPhone: data.phone.trim(),
        clientEmail: data.email?.trim() || undefined,
        answers: data.answers || {},
      });
      const googleResult = await pushToGoogleCalendar({
        date: data.date,
        time: data.time,
        endTime: reservation.end_time_slot,
        summary: `${reservation.service_name} — ${data.name.trim()} (via Maria)`,
        description: "Réservation prise via l'assistant conversationnel Maria (BeautyBook).",
        clientPhone: data.phone.trim(),
      });
      setTyping(false);
      setBookingDone(true);
      push({ from: "bot", text: bookingConfirmationText(reservation, googleResult) });
    } catch {
      setTyping(false);
      push({ from: "bot", text: "Oups, la réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon." });
    }
  };

  if (!proEmail) return null;

  return (
    <div className="maria-widget">
      {open && (
        <div className="maria-panel" role="dialog" aria-label="Discuter avec Maria">
          <div className="maria-panel-head">
            <span className="maria-head-avatar">
              <img src={AVATAR} alt="Maria IA" />
              <span className="maria-online" />
            </span>
            <div className="maria-head-text">
              <p className="maria-title">Maria IA <span className="maria-live"><span className="maria-dot" /> En ligne</span></p>
              <p className="maria-subtitle">Assistant de réservation</p>
            </div>
            <button type="button" className="maria-head-btn" aria-label="Options"><MoreHorizontal size={20} /></button>
            <button type="button" className="maria-head-btn" onClick={() => setOpen(false)} aria-label="Fermer"><X size={20} /></button>
          </div>

          <div className="maria-chat" ref={scrollRef}>
            {msgs.map((m) => m.from === "me"
              ? (
                <div key={m._id} className="maria-row me">
                  <div className="maria-bubble me">{m.text}<span className="maria-time">{m.time}</span></div>
                </div>
              )
              : (
                <div key={m._id} className="maria-row bot">
                  <img className="maria-msg-avatar" src={AVATAR} alt="" />
                  <div className="maria-bubble bot">
                    {m.text}
                    <span className="maria-time">{m.time}</span>
                    {m.actions && (
                      <div className="maria-quick">
                        {m.actions.map(({ id, label, Icon }) => (
                          <button key={id} type="button" className="maria-quick-btn" onClick={() => onQuickAction(id)}>
                            <Icon size={17} className="maria-quick-icon" />
                            <span>{label}</span>
                            <ChevronRight size={15} className="maria-quick-chev" />
                          </button>
                        ))}
                      </div>
                    )}
                    {m.chips && (
                      <div className="maria-chips">
                        {m.chips.map((c) => (
                          <button key={c.id} type="button" className="maria-chip" onClick={() => m.onChip && m.onChip(c)}>
                            {c.label}{c.sub ? ` · ${c.sub}` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.link && (
                      <a className="maria-link-btn" href={m.link.href}>{m.link.label}</a>
                    )}
                  </div>
                </div>
              ))}
            {typing && (
              <div className="maria-row bot">
                <img className="maria-msg-avatar" src={AVATAR} alt="" />
                <div className="maria-bubble bot maria-typing"><span /><span /><span /></div>
              </div>
            )}
            {showBooking && (
              <WidgetBookingForm
                services={knowledge?.services || []}
                initialServiceId={bookingPreset}
                onConfirm={confirmBooking}
                onCancel={() => setShowBooking(false)}
              />
            )}
          </div>

          <div className="maria-suggest">
            {SUGGESTIONS.map(({ id, label, Icon }) => (
              <button key={id} type="button" className="maria-suggest-chip" onClick={() => onQuickAction(id)}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div className="maria-inputbar">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Écrivez votre message ici…"
              aria-label="Votre message"
            />
            <button type="button" onClick={() => send()} aria-label="Envoyer"><Send size={17} /></button>
          </div>
        </div>
      )}
      <button
        type="button"
        className={`maria-fab ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fermer le chat" : "Réserver avec Maria"}
      >
        {open ? <X size={22} /> : (
          <>
            <span className="maria-fab-avatar">
              <img src={AVATAR} alt="Maria IA" />
              <span className="maria-online" />
            </span>
            <span className="maria-fab-label">Réserver avec <b>MARIA</b></span>
          </>
        )}
      </button>
    </div>
  );
}

export function WidgetBookingForm({ services, initialServiceId = "", onConfirm, onCancel }) {
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState({});
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => { if (initialServiceId) setServiceId(initialServiceId); }, [initialServiceId]);

  const selectedService = (services || []).find((s) => String(s.id) === String(serviceId)) || null;
  // Mêmes questions que l'étape 2 du parcours web, selon la catégorie du service.
  const questionnaire = getQuestionnaireForService(selectedService || {});

  const pickService = (id) => {
    setServiceId(id);
    setAnswers({}); // on change de service → on réinitialise les réponses
  };
  const toggleAnswer = (qid, opt) => {
    setAnswers((prev) => ({ ...prev, [qid]: opt }));
  };

  const submit = async () => {
    setSending(true);
    try {
      await onConfirm({ serviceId, date, time, name, phone, email, answers }, setErr);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="maria-booking">
      <p className="maria-booking-title">📅 Votre réservation</p>
      <label><span>Service</span>
        <select value={serviceId} onChange={(e) => pickService(e.target.value)}>
          <option value="">— Choisir —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.price != null ? ` — ${s.price}€` : ""}</option>
          ))}
        </select>
      </label>
      {selectedService && questionnaire.questions.length > 0 && (
        <div className="maria-q">
          <p className="maria-q-title">
            Vos préférences — {questionnaire.label} <span className="maria-q-optional">(optionnel)</span>
          </p>
          {questionnaire.tip && <p className="maria-q-tip">💡 {questionnaire.tip}</p>}
          {questionnaire.questions.map((q) => (
            <div key={q.id} className="maria-q-item">
              <p className="maria-q-label">{q.question}</p>
              <div className="maria-q-chips">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`maria-q-chip${answers[q.id] === opt ? " selected" : ""}`}
                    onClick={() => toggleAnswer(q.id, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="maria-row">
        <label><span>Date</span>
          <input type="date" value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label><span>Heure</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <label><span>Votre prénom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Aïcha" />
      </label>
      <label><span>Téléphone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 …" inputMode="tel" />
      </label>
      <label><span>Email (pour la confirmation, optionnel)</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" type="email" />
      </label>
      {err && <p className="maria-err">{err}</p>}
      <div className="maria-booking-actions">
        <button type="button" className="maria-btn ghost" onClick={onCancel}>Annuler</button>
        <button type="button" className="maria-btn primary" onClick={submit} disabled={sending}>
          {sending ? "Réservation…" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
