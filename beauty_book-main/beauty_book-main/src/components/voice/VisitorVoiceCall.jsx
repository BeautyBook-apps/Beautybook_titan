// ─────────────────────────────────────────────────────────────────────────────
// VisitorVoiceCall — « appel interne » : le visiteur appelle le salon depuis
// l'application et c'est l'AGENT VOCAL IA du salon qui décroche.
//
// Conditions (vérifiées côté serveur par /api/xai-visitor-token) :
//   salon_ai_settings.vocal_enabled = true ET appel_interne = true.
// Le visiteur n'a pas besoin d'être le professionnel : le token éphémère
// est minté pour le salon, avec sa clé vocale propre (ou celle de BeautyBook).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { X, Mic, MicOff, PhoneOff, Loader2, Bot } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { GrokVoiceSession } from "@/lib/grokVoice";
import { buildVoiceTools } from "@/lib/voiceAgentTools";
import { buildVoiceInstructions, resolveWelcomeMessage } from "@/lib/voiceAgentPrompt";
import { getSalonAISettings } from "@/lib/salonAI";
import { summarizeHours } from "@/lib/hours";
import BeautyImage from "@/components/ui/BeautyImage";

const PROFILE_IMG = "/maria-avatar.png";

async function mintVisitorToken(proEmail) {
  const res = await fetch("/api/xai-visitor-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pro_email: proEmail || "" }),
    signal: AbortSignal.timeout(20000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* pas de JSON */ }
  if (!res.ok || !data?.token) {
    const err = new Error((data && data.error) || "Impossible de joindre l'assistant vocal du salon.");
    err.code = data && data.code;
    throw err;
  }
  return data;
}

export default function VisitorVoiceCall({ proEmail, salonName, avatarUrl, onClose }) {
  const [callState, setCallState] = useState("connecting"); // connecting | live | error | ended
  const [callError, setCallError] = useState("");
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speaking, setSpeaking] = useState(null); // 'agent' | 'user' | null
  const [transcript, setTranscript] = useState([]);
  const sessionRef = useRef(null);
  const startedRef = useRef(false);

  const hangUp = useCallback(() => {
    try { sessionRef.current?.disconnect(); } catch { /* déjà fermé */ }
    sessionRef.current = null;
    setCallState("ended");
  }, []);

  const handleEvent = useCallback((type, p) => {
    if (type === "state") {
      if (p.state === "connected") {
        setCallState("live");
        setCallError("");
      } else if (p.state === "disconnected") {
        setCallState((s) => (s === "live" || s === "connecting" ? "ended" : s));
        setSpeaking(null);
        setMicLevel(0);
      } else if (p.state === "error") {
        setCallState((s) => (s === "live" ? s : "error"));
      }
    } else if (type === "error") {
      setCallError(p.message || "Erreur de session vocale.");
      setCallState((s) => (s === "live" ? s : "error"));
    } else if (type === "mic-level") {
      setMicLevel(p.level || 0);
    } else if (type === "speaking") {
      setSpeaking(p.who);
    } else if (type === "user-transcript") {
      const text = (p.text || "").trim();
      if (!text) return;
      setTranscript((t) => {
        const last = t[t.length - 1];
        if (last && last.who === "user" && !p.final) return [...t.slice(0, -1), { who: "user", text, done: false }];
        if (last && last.who === "user" && last.text === text) return t;
        return [...t.slice(-19), { who: "user", text, done: !!p.final }];
      });
    } else if (type === "agent-transcript") {
      if (p.delta) {
        setTranscript((t) => {
          const last = t[t.length - 1];
          if (last && last.who === "agent" && !last.done) {
            return [...t.slice(0, -1), { who: "agent", text: last.text + p.delta, done: false }];
          }
          return [...t.slice(-19), { who: "agent", text: p.delta, done: false }];
        });
      }
      if (p.done) {
        setTranscript((t) => {
          const last = t[t.length - 1];
          if (last && last.who === "agent") {
            return [...t.slice(0, -1), { who: "agent", text: p.text || last.text, done: true }];
          }
          return t;
        });
        setSpeaking(null);
      }
    } else if (type === "agent-hangup") {
      setCallState("ended");
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let alive = true;
    (async () => {
      try {
        // 1) Token éphémère (le serveur vérifie vocal_enabled + appel_interne)
        const { token } = await mintVisitorToken(proEmail);
        if (!alive) return;
        // 2) Données du salon RELUES À CHAQUE APPEL (temps réel)
        let liveServices = [];
        let liveBundles = [];
        let liveProfil = null;
        try {
          const { data: svcs } = await supabase
            .from("Service")
            .select("id,title,name,price,duration,duration_min")
            .eq("pro_email", proEmail)
            .order("created_at", { ascending: false })
            .limit(100);
          if (svcs) liveServices = svcs;
          const { data: bnds } = await supabase
            .from("ServiceBundle")
            .select("id,name,description,bundle_price,service_ids,is_active")
            .eq("pro_email", proEmail)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(40);
          if (bnds) liveBundles = bnds;
          // ProfilPro : lecture directe (même requête que la page VueClient,
          // lisible par les visiteurs), colonnes garanties d'abord.
          const { data: profs } = await supabase
            .from("ProfilPro")
            .select("salon_name,address,phone,ouverture,horaires")
            .eq("user_email", proEmail)
            .order("created_at", { ascending: false })
            .limit(1);
          if (profs && profs.length > 0) liveProfil = profs[0];
        } catch { /* repli : données minimales */ }
        if (!alive) return;
        // 3) Réglages IA du salon (message de bienvenue, voix…)
        const ai = await getSalonAISettings(proEmail).catch(() => null);
        const name = liveProfil?.salon_name || salonName || "votre salon";
        const hoursSummary = (() => {
          try {
            const groups = summarizeHours(liveProfil?.ouverture || liveProfil?.horaires);
            return groups.map((g) => `${g.label} : ${g.open ? g.hours : "Fermé"}`).join(" · ") || "";
          } catch { return ""; }
        })();
        const todayLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const instructions = buildVoiceInstructions({
          salonName: name,
          services: liveServices,
          bundles: liveBundles,
          profil: liveProfil,
          hoursSummary,
          customInstructions: ai?.custom_instructions || "",
          todayLabel,
        });
        const session = new GrokVoiceSession({
          token,
          agentId: ai?.agent_id || "",
          voice: ai?.voice || "ara",
          language: "fr",
          instructions,
          tools: buildVoiceTools({ proEmail }),
          greeting: resolveWelcomeMessage(ai?.welcome_message || "", name),
          connectionMode: ai?.connection_mode === "agent" ? "agent" : "direct",
          onEvent: handleEvent,
        });
        sessionRef.current = session;
        await session.connect();
      } catch (e) {
        if (!alive) return;
        setCallState("error");
        setCallError(e.message || "Impossible de joindre l'assistant vocal du salon.");
      }
    })();
    return () => {
      alive = false;
      try { sessionRef.current?.disconnect(); } catch { /* ignore */ }
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proEmail]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try { sessionRef.current?.setMuted(next); } catch { /* ignore */ }
  };

  const lastAgentLine = [...transcript].reverse().find((m) => m.who === "agent" && m.text);
  const statusLabel =
    callState === "connecting" ? "Connexion à l'assistant vocal…" :
    callState === "live" ? (speaking === "agent" ? "Maria vous parle…" : speaking === "user" ? "Maria vous écoute…" : "À vous…") :
    callState === "error" ? "Échec de l'appel" : "Appel terminé";

  return (
    <div className="fixed inset-0 z-[500] bg-[#14141f] flex flex-col items-center justify-between px-6 pt-14 pb-10 text-white">
      {/* Fermer */}
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition"
      >
        <X size={18} />
      </button>

      {/* Avatar + statut */}
      <div className="flex flex-col items-center gap-4 mt-6">
        <div className="relative">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-orange-400/60 shadow-[0_0_40px_rgba(255,107,0,0.35)]">
            <BeautyImage src={avatarUrl || PROFILE_IMG} alt={salonName} className="w-full h-full object-cover" />
          </div>
          {callState === "live" && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-orange-400/50 animate-ping" />
              <div className="absolute -inset-3 rounded-full border border-orange-400/25 animate-ping" style={{ animationDelay: "0.35s" }} />
            </>
          )}
          <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-green-400 border-[3px] border-[#14141f]" />
        </div>
        <div className="text-center">
          <p className="text-[20px] font-black">{salonName || "Salon"}</p>
          <p className="text-orange-300 text-[13px] font-bold mt-1 flex items-center justify-center gap-1.5">
            <Bot size={14} />
            {callState === "connecting" ? (
              <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{statusLabel}</span>
            ) : statusLabel}
          </p>
        </div>
        {/* Niveau micro */}
        {callState === "live" && (
          <div className="flex items-center gap-1 h-10">
            {Array.from({ length: 24 }).map((_, i) => {
              const active = micLevel * 24 > i;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all ${active ? "bg-orange-400" : "bg-white/15"}`}
                  style={{ height: `${6 + (active ? Math.min(1, micLevel * 2) * 26 : 4)}px` }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Transcription (derniers échanges) */}
      <div className="w-full max-w-md flex-1 min-h-0 overflow-y-auto my-4 space-y-2 px-1">
        {callState === "error" ? (
          <div className="bg-red-500/15 border border-red-400/30 rounded-2xl p-4 text-center">
            <p className="text-[14px] font-bold text-red-200">😔 {callError}</p>
            <p className="text-[12px] text-white/50 mt-2">Réessayez dans un instant ou contactez le salon autrement.</p>
          </div>
        ) : callState === "ended" ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-[14px] font-bold text-white/80">Appel terminé — merci ! 👋</p>
          </div>
        ) : (
          <>
            {lastAgentLine && (
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-md p-3.5">
                <p className="text-[13px] leading-relaxed text-white/90">{lastAgentLine.text}</p>
              </div>
            )}
            {!lastAgentLine && callState === "live" && (
              <p className="text-center text-white/40 text-[12px]">Parlez : l'assistante du salon vous répond à voix haute.</p>
            )}
          </>
        )}
      </div>

      {/* Contrôles */}
      <div className="flex items-center gap-6">
        {callState === "live" && (
          <button
            onClick={toggleMute}
            aria-label={muted ? "Réactiver le micro" : "Couper le micro"}
            className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition ${muted ? "bg-white/20" : "bg-white/10"}`}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        )}
        <button
          onClick={callState === "ended" || callState === "error" ? onClose : hangUp}
          aria-label="Raccrocher"
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] active:scale-90 transition"
        >
          <PhoneOff size={26} />
        </button>
        <div className="w-14" />
      </div>
      {callState === "live" && (
        <p className="text-white/35 text-[11px] mt-3">Vous parlez à l'assistante vocale IA du salon</p>
      )}
    </div>
  );
}
