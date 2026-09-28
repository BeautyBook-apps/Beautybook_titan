// ─────────────────────────────────────────────────────────────────────────────
// MariaSite — chatbot Maria embarquable sur le SITE WEB du salon.
// Route publique : /maria-site/:code  (sans connexion, sans barre de nav —
// faite pour être intégrée en iframe sur n'importe quel site).
// Le :code est généré depuis la page « Assistant conversationnel ».
// Tout passe par l'Edge Function `maria-widget` (données réelles du salon,
// réservation RÉELLE → table Reservation, source 'maria_widget').
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Send, Bot, Calendar, RotateCcw } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { WidgetBookingForm } from "@/components/AssistantChatWidget";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import "./MariaSite.css";

const FN_URL = `${supabase.supabaseUrl}/functions/v1/maria-widget`;
const FN_KEY = supabase.supabaseKey;

async function fn(path, { method = "GET", body } = {}) {
  const res = await fetch(`${FN_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: FN_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || "Service indisponible.");
  return data;
}

export default function MariaSite() {
  const { code } = useParams();
  // Page publique (pas d'utilisateur) : clé par salon via le :code de l'URL.
  // La fiche salon (knowledge) s'affiche dès la première peinture depuis le
  // cache, le rafraîchissement réseau se fait en arrière-plan.
  const cacheKey = `maria_site_${code || "default"}`;
  const [status, setStatus] = useState(() => (readPageCache(cacheKey)?.knowledge ? "ready" : "loading")); // loading | ready | error
  const [knowledge, setKnowledge] = useCachedState(cacheKey, null, c => c?.knowledge ?? null);
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef(null);
  const greeted = useRef(false);

  const push = (m) => {
    idRef.current += 1;
    setMsgs((prev) => [...prev.slice(-100), { ...m, _id: idRef.current }]);
  };

  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    (async () => {
      try {
        const k = await fn(`/knowledge?code=${encodeURIComponent(code || "")}`);
        setKnowledge(k);
        mergePageCache(cacheKey, { knowledge: k });
        setStatus("ready");
        setTyping(true);
        await new Promise((r) => setTimeout(r, 700));
        setTyping(false);
        push({ from: "bot", text: `Bonjour 👋 Bienvenue chez ${k.salonName || "notre salon"} ! Je suis Maria, l'assistante du salon. Posez-moi vos questions ou dites « je veux réserver ».` });
        if ((k.services || []).length > 0) {
          push({ from: "bot", text: "", action: { id: "book", label: "📅 Réserver un créneau" } });
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [code]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, showBooking]);

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || typing || status !== "ready") return;
    setInput("");
    push({ from: "me", text });
    setTyping(true);
    try {
      const data = await fn("/chat", { method: "POST", body: { code, message: text } });
      await new Promise((r) => setTimeout(r, 500));
      setTyping(false);
      push({ from: "bot", text: data.reply });
      if (data.bookingIntent && !bookingDone) {
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
    const svc = (knowledge?.services || []).find((s) => String(s.id) === String(data.serviceId));
    setShowBooking(false);
    push({ from: "me", text: `Réserver : ${svc ? svc.name : "Prestation"}` });
    setTyping(true);
    try {
      const res = await fn("/book", {
        method: "POST",
        body: {
          code,
          serviceId: data.serviceId,
          date: data.date,
          time: data.time,
          name: (data.name || "").trim(),
          phone: (data.phone || "").trim(),
          email: (data.email || "").trim() || undefined,
        },
      });
      setTyping(false);
      setBookingDone(true);
      push({ from: "bot", text: res.confirmation });
    } catch (e) {
      setTyping(false);
      push({ from: "bot", text: e.message || "La réservation n'a pas pu être enregistrée 😔 Réessayez ou contactez directement le salon." });
    }
  };

  const reset = () => {
    idRef.current = 0;
    setMsgs([]);
    setShowBooking(false);
    setBookingDone(false);
    setInput("");
    if (knowledge) {
      push({ from: "bot", text: `Rebonjour 👋 Je suis Maria, l'assistante ${knowledge.salonName ? `de ${knowledge.salonName}` : "du salon"}. Comment puis-je vous aider ?` });
    }
  };

  return (
    <div className="msite">
      <header className="msite-head">
        <span className="msite-avatar"><Bot size={20} /></span>
        <div className="msite-head-txt">
          <p className="msite-title">Maria · {knowledge?.salonName || "Assistant du salon"}</p>
          <p className="msite-status"><span className="msite-dot" /> En ligne — répond instantanément</p>
        </div>
        <button type="button" className="msite-reset" onClick={reset} aria-label="Recommencer la conversation">
          <RotateCcw size={16} />
        </button>
      </header>

      <div className="msite-chat" ref={scrollRef}>
        {status === "loading" && !knowledge && (
          <div className="msite-loading">
            <div className="msite-bubble bot msite-typing"><span /><span /><span /></div>
          </div>
        )}
        {status === "error" && (
          <div className="msite-error">
            <p className="msite-error-title">Chat momentanément indisponible 😔</p>
            <p className="msite-error-txt">Le chatbot du salon n'est pas configuré pour le moment. Réessayez plus tard ou contactez directement le salon.</p>
          </div>
        )}
        {msgs.map((m) => m.from === "me" ? (
          <div key={m._id} className="msite-bubble me">{m.text}</div>
        ) : (
          <div key={m._id} className="msite-bubble bot">
            {m.text}
            {m.action && !bookingDone && (
              <button type="button" className="msite-action" onClick={startBooking}>
                <Calendar size={13} /> {m.action.label}
              </button>
            )}
          </div>
        ))}
        {typing && <div className="msite-bubble bot msite-typing"><span /><span /><span /></div>}
        {showBooking && status === "ready" && (
          <WidgetBookingForm
            services={knowledge?.services || []}
            onConfirm={confirmBooking}
            onCancel={() => setShowBooking(false)}
          />
        )}
      </div>

      <div className="msite-foot">
        <div className="msite-inputbar">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={status === "ready" ? "Posez votre question…" : "Chargement…"}
            aria-label="Votre message"
            disabled={status !== "ready"}
          />
          <button type="button" onClick={() => send()} aria-label="Envoyer" disabled={status !== "ready"}>
            <Send size={16} />
          </button>
        </div>
        <p className="msite-powered">
          Propulsé par <a href="https://thelastjiren.vercel.app" target="_blank" rel="noreferrer">BeautyBook</a> · Maria IA
        </p>
      </div>
    </div>
  );
}
