// ─────────────────────────────────────────────────────────────────────────────
// MariaSite — chatbot Maria embarquable sur le SITE WEB du salon.
// Route publique : /maria-site/:code  (iframe ou lien direct, sans connexion).
// Le :code est l'email pro encodé en base64url (généré depuis l'onglet
// « Site web » de l'Assistant conversationnel).
//
// Fonctionnement (aucune Edge Function requise) :
// - Bulle flottante (FAB) en bas à droite : ouvre le panneau de conversation.
// - Cerveau : Grok via /api/xai-chat, avec accès LECTURE aux vraies données
//   du salon (catalogue + créneaux libres réels, jamais inventés).
// - Réservation RÉELLE → table Reservation (source 'maria_widget',
//   statut 'en_attente' → visible dans « Gestion agenda » avec le badge
//   « Site web »).
// - L'iframe signale sa taille à la page parente (postMessage
//   'bb-maria-resize') pour un embed de type bulle flottante.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Send, MessageCircle, X, Calendar, RotateCcw, Bot } from "lucide-react";
import { WidgetBookingForm } from "@/components/AssistantChatWidget";
import {
  buildKnowledge, detectBookingIntent, createAssistantReservation,
  bookingConfirmationText, pushToGoogleCalendar,
} from "@/lib/mariaAssistant";
import { grokChat } from "@/lib/grok";
import "./MariaSite.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** code base64url -> email pro (ou null si invalide). */
function decodeCode(code) {
  try {
    const b64 = String(code || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const email = new TextDecoder().decode(bytes).trim().toLowerCase();
    return EMAIL_RE.test(email) ? email : null;
  } catch {
    return null;
  }
}

/** Signale sa taille à la page parente (embed « bulle flottante »). */
function postResize(open) {
  try {
    const w = open ? Math.min(400, window.innerWidth - 16) : 120;
    const h = open ? Math.min(680, window.innerHeight - 16) : 110;
    window.parent.postMessage({ type: "bb-maria-resize", w, h }, "*");
  } catch {
    /* pas dans une iframe : rien à signaler */
  }
}

function buildSystemPrompt(k) {
  const salon = k.salonName || "notre salon";
  const lines = [
    `Tu es Maria, l'assistante d'accueil du salon « ${salon} » sur son site web. Tu parles français, avec chaleur, en 2 à 4 phrases maximum.`,
    `Tu réponds aux questions des visiteurs (prestations, tarifs, horaires, adresse, contact) et tu les aides à réserver.`,
  ];
  if (k.bio) lines.push(`Présentation du salon : ${k.bio}`);
  if (k.address || k.city) lines.push(`Adresse : ${[k.address, k.city].filter(Boolean).join(", ")}`);
  if (k.phone) lines.push(`Téléphone : ${k.phone}`);
  if (k.hoursText) lines.push(`Horaires :\n${k.hoursText}`);
  if (k.faq && k.faq.length) {
    lines.push("Questions fréquentes du salon :");
    k.faq.slice(0, 8).forEach((f) => lines.push(`- ${f.question} → ${f.answer}`));
  }
  lines.push(
    "RÉSERVATION : quand un visiteur veut réserver, propose-lui 2 à 3 créneaux réels (via tes outils) puis invite-le à cliquer sur le bouton « 📅 Réserver un créneau » sous le message pour finaliser. Ne demande JAMAIS de coordonnées bancaires.",
    "RÈGLE D'OR : utilise toujours tes outils avant de parler d'un prix, d'une durée ou d'une disponibilité. N'invente jamais."
  );
  return lines.join("\n");
}

export default function MariaSite() {
  const { code } = useParams();
  const [email, setEmail] = useState(null);
  const [knowledge, setKnowledge] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef(null);
  const loaded = useRef(false);

  const push = (m) => {
    idRef.current += 1;
    setMsgs((prev) => [...prev.slice(-100), { ...m, _id: idRef.current }]);
  };

  // Taille initiale (bulle fermée) pour la page parente.
  useEffect(() => {
    postResize(false);
    const onResize = () => postResize(open);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      const em = decodeCode(code);
      if (!em) {
        setStatus("error");
        return;
      }
      setEmail(em);
      try {
        const k = await buildKnowledge(em);
        if (!k.salonName && !(k.services || []).length) {
          setStatus("error");
          return;
        }
        setKnowledge(k);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    })();
  }, [code]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, showBooking, open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    postResize(next);
    if (next && msgs.length === 0 && knowledge) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        push({
          from: "bot",
          text: `Bonjour 👋 Bienvenue chez ${knowledge.salonName || "notre salon"} ! Je suis Maria, l'assistante du salon. Posez-moi vos questions ou dites-moi « je veux réserver ».`,
        });
        if ((knowledge.services || []).length > 0) {
          push({ from: "bot", text: "", action: { id: "book", label: "📅 Réserver un créneau" } });
        }
      }, 700);
    }
  };

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || typing || status !== "ready") return;
    setInput("");
    push({ from: "me", text });
    setTyping(true);
    try {
      const history = [...msgs, { from: "me", text }].slice(-10).map((m) => ({
        role: m.from === "me" ? "user" : "assistant",
        content: m.text || "",
      })).filter((m) => m.content.trim());
      const reply = await grokChat(history, {
        system: buildSystemPrompt(knowledge),
        max_tokens: 600,
        feature: "social",
        enableTools: true,
        salonEmail: email,
      });
      await new Promise((r) => setTimeout(r, 400));
      setTyping(false);
      push({ from: "bot", text: (reply || "").trim() });
      if (detectBookingIntent(text) && !bookingDone) {
        await new Promise((r) => setTimeout(r, 400));
        setShowBooking(true);
      }
    } catch {
      setTyping(false);
      push({ from: "bot", text: "Oups, je n'arrive pas à répondre pour le moment 😔 Réessayez dans un instant." });
    }
  };

  const startBooking = () => {
    push({ from: "me", text: "Je veux réserver" });
    setShowBooking(true);
  };

  const confirmBooking = async (data, setErr) => {
    const errs = [];
    if (!data.serviceId) errs.push("Choisissez un service.");
    if (!data.date) errs.push("Choisissez une date.");
    if (!data.time) errs.push("Choisissez une heure.");
    if (!(data.name || "").trim()) errs.push("Indiquez votre prénom.");
    if (String(data.phone || "").replace(/\D/g, "").length < 8) errs.push("Numéro de téléphone incomplet.");
    if (data.email && !EMAIL_RE.test(data.email.trim())) errs.push("Cet email ne semble pas valide.");
    if (errs.length) {
      setErr(errs[0]);
      return;
    }
    const svc = (knowledge?.services || []).find((s) => String(s.id) === String(data.serviceId));
    setShowBooking(false);
    push({ from: "me", text: `Réserver : ${svc ? svc.name : "Prestation"}` });
    setTyping(true);
    try {
      const reservation = await createAssistantReservation({
        proEmail: email,
        salonName: knowledge?.salonName || "",
        proName: knowledge?.ownerName || "",
        service: svc,
        date: data.date,
        time: data.time,
        clientName: data.name.trim(),
        clientPhone: data.phone.trim(),
        clientEmail: data.email?.trim() || undefined,
        answers: data.answers || {},
        source: "maria_widget", // badge « Site web » dans Gestion agenda
      });
      let googleResult = { ok: false };
      try {
        googleResult = await pushToGoogleCalendar({
          date: data.date,
          time: data.time,
          endTime: reservation.end_time_slot,
          summary: `${reservation.service_name} — ${data.name.trim()} (via Maria, site web)`,
          description: "Réservation prise via le chatbot Maria du site web du salon (BeautyBook).",
          clientPhone: data.phone.trim(),
        });
      } catch {
        /* Google Agenda optionnel */
      }
      setTyping(false);
      setBookingDone(true);
      push({ from: "bot", text: bookingConfirmationText(reservation, googleResult) });
    } catch (e) {
      setTyping(false);
      push({ from: "bot", text: "La réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon." });
    }
  };

  const reset = () => {
    idRef.current = 0;
    setMsgs([]);
    setShowBooking(false);
    setBookingDone(false);
    setInput("");
    if (knowledge) {
      push({
        from: "bot",
        text: `Rebonjour 👋 Je suis Maria, l'assistante ${knowledge.salonName ? `de ${knowledge.salonName}` : "du salon"}. Comment puis-je vous aider ?`,
      });
    }
  };

  return (
    <div className="maria-site">
      {open && (
        <div className="maria-site-panel" role="dialog" aria-label="Discuter avec Maria">
          <div className="maria-site-head">
            <span className="maria-site-avatar"><Bot size={18} /></span>
            <div className="maria-site-head-txt">
              <p className="maria-site-title">Maria · {knowledge?.salonName || "Assistant du salon"}</p>
              <p className="maria-site-status"><span className="maria-site-dot" /> En ligne — répond instantanément</p>
            </div>
            <button type="button" className="maria-site-reset" onClick={reset} aria-label="Recommencer la conversation">
              <RotateCcw size={15} />
            </button>
          </div>

          <div className="maria-site-chat" ref={scrollRef}>
            {status === "loading" && (
              <div className="maria-site-bubble bot maria-site-typing"><span /><span /><span /></div>
            )}
            {status === "error" && (
              <div className="maria-site-error">
                <p className="maria-site-error-title">Chat momentanément indisponible 😔</p>
                <p className="maria-site-error-txt">Le chatbot du salon n'est pas configuré pour le moment. Réessayez plus tard ou contactez directement le salon.</p>
              </div>
            )}
            {msgs.map((m) => m.from === "me" ? (
              <div key={m._id} className="maria-site-bubble me">{m.text}</div>
            ) : (
              <div key={m._id} className="maria-site-bubble bot">
                {m.text}
                {m.action && !bookingDone && (
                  <button type="button" className="maria-site-action" onClick={startBooking}>
                    <Calendar size={13} /> {m.action.label}
                  </button>
                )}
              </div>
            ))}
            {typing && <div className="maria-site-bubble bot maria-site-typing"><span /><span /><span /></div>}
            {showBooking && status === "ready" && (
              <WidgetBookingForm
                services={knowledge?.services || []}
                onConfirm={confirmBooking}
                onCancel={() => setShowBooking(false)}
              />
            )}
          </div>

          <div className="maria-site-foot">
            <div className="maria-site-inputbar">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder={status === "ready" ? "Posez votre question…" : "Chargement…"}
                aria-label="Votre message"
                disabled={status !== "ready"}
              />
              <button type="button" onClick={() => send()} aria-label="Envoyer" disabled={status !== "ready"}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        className={`maria-site-fab${open ? " open" : ""}`}
        onClick={toggle}
        aria-label={open ? "Fermer le chat" : "Discuter avec Maria"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && <span className="maria-site-fab-label">Discuter avec Maria</span>}
      </button>
    </div>
  );
}
