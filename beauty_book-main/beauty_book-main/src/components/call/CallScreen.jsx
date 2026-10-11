import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageSquare, Phone, Clock, User } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const THEME = {
  light: {
    bg: "linear-gradient(180deg, #FFF8F0 0%, #FFFFFF 40%, #FFF8F0 100%)",
    cardBg: "rgba(255,255,255,0.8)",
    textPrimary: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    accent: "#E8732A",
    accentLight: "rgba(232,115,42,0.12)",
    accentGlow: "rgba(232,115,42,0.25)",
    hangupBg: "#EF4444",
    hangupShadow: "rgba(239,68,68,0.4)",
    acceptBg: "#22C55E",
    acceptShadow: "rgba(34,197,94,0.4)",
    equalizerBar: "#E8732A",
    avatarBorder: "rgba(232,115,42,0.3)",
    avatarBg: "#FFF7ED",
    controlBg: "rgba(0,0,0,0.05)",
    controlActive: "rgba(232,115,42,0.15)",
    quickMsgBg: "rgba(0,0,0,0.04)",
    quickMsgBorder: "rgba(0,0,0,0.08)",
    ringPulse: "rgba(232,115,42,0.3)",
    ringPulseOuter: "rgba(232,115,42,0.15)",
  },
  dark: {
    bg: "linear-gradient(180deg, #0F172A 0%, #1E293B 40%, #0F172A 100%)",
    cardBg: "rgba(30,41,59,0.8)",
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    accent: "#F97316",
    accentLight: "rgba(249,115,22,0.15)",
    accentGlow: "rgba(249,115,22,0.3)",
    hangupBg: "#EF4444",
    hangupShadow: "rgba(239,68,68,0.5)",
    acceptBg: "#22C55E",
    acceptShadow: "rgba(34,197,94,0.5)",
    equalizerBar: "#F97316",
    avatarBorder: "rgba(249,115,22,0.4)",
    avatarBg: "#1E293B",
    controlBg: "rgba(255,255,255,0.08)",
    controlActive: "rgba(249,115,22,0.2)",
    quickMsgBg: "rgba(255,255,255,0.06)",
    quickMsgBorder: "rgba(255,255,255,0.1)",
    ringPulse: "rgba(249,115,22,0.35)",
    ringPulseOuter: "rgba(249,115,22,0.15)",
  },
  night: {
    bg: "linear-gradient(180deg, #030712 0%, #111827 40%, #030712 100%)",
    cardBg: "rgba(17,24,39,0.8)",
    textPrimary: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textMuted: "#4B5563",
    accent: "#F97316",
    accentLight: "rgba(249,115,22,0.12)",
    accentGlow: "rgba(249,115,22,0.25)",
    hangupBg: "#DC2626",
    hangupShadow: "rgba(220,38,38,0.5)",
    acceptBg: "#16A34A",
    acceptShadow: "rgba(22,163,74,0.5)",
    equalizerBar: "#F97316",
    avatarBorder: "rgba(249,115,22,0.3)",
    avatarBg: "#0F172A",
    controlBg: "rgba(255,255,255,0.05)",
    controlActive: "rgba(249,115,22,0.15)",
    quickMsgBg: "rgba(255,255,255,0.04)",
    quickMsgBorder: "rgba(255,255,255,0.08)",
    ringPulse: "rgba(249,115,22,0.3)",
    ringPulseOuter: "rgba(249,115,22,0.1)",
  },
};

export default function CallScreen({ mode, targetName, targetAvatar, onHangup, onAccept, onReject, remoteAudioRef, targetEmail, currentUserEmail, isCallee, sendQuickMessage }) {
  const { theme } = useTheme();
  const t = THEME[theme] || THEME.light;

  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [showQuickMsgs, setShowQuickMsgs] = useState(false);
  const timerRef = useRef(null);

  const QUICK_MESSAGES = [
    "Je te rappelle plus tard",
    "Disponible dans 5 min",
    "En réunion, rappelle-moi",
    "Merci, pas maintenant",
  ];

  const handleQuickMsg = (msg) => {
    if (sendQuickMessage) sendQuickMessage(msg);
    setShowQuickMsgs(false);
  };

  useEffect(() => {
    if (mode === "active") {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [mode]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const statusLabel = {
    calling: "Appel en cours...",
    ringing: isCallee ? "Appel entrant" : "Appel en cours...",
    active: formatTime(seconds),
    ended: "Appel terminé",
  }[mode] || "";

  const initials = (targetName || "?")[0]?.toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between px-6 pt-14 pb-12" style={{ background: t.bg }}>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Header status */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: t.textMuted }}>
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {mode === "active" && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)" }}>
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-green-500">APPEL EN COURS</span>
          </div>
        )}
      </div>

      {/* Avatar + nom */}
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-36 h-36 rounded-full overflow-hidden shadow-2xl" style={{ border: `4px solid ${t.avatarBorder}`, background: t.avatarBg }}>
            {targetAvatar
              ? <BeautyImage src={targetAvatar} alt={targetName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-[48px] font-black" style={{ color: t.accent }}>{initials}</div>
            }
          </div>
          {(mode === "calling" || mode === "ringing") && (
            <>
              <div className="absolute inset-0 rounded-full animate-ping" style={{ border: `2px solid ${t.ringPulse}`, opacity: 0.6 }} />
              <div className="absolute -inset-6 rounded-full animate-ping" style={{ border: `2px solid ${t.ringPulseOuter}`, opacity: 0.4, animationDelay: "0.5s" }} />
              <div className="absolute -inset-12 rounded-full animate-ping" style={{ border: `1.5px solid ${t.ringPulseOuter}`, opacity: 0.2, animationDelay: "1s" }} />
            </>
          )}
          {mode === "active" && (
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-3 flex items-center justify-center shadow-lg" style={{ borderColor: t.bg.includes("030712") || t.bg.includes("0F172A") ? "#111827" : "#FFF8F0" }}>
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-[28px] font-black tracking-tight" style={{ color: t.textPrimary }}>{targetName || "Inconnu"}</p>
          <p className="text-[14px] font-bold mt-1" style={{ color: mode === "active" ? t.accent : t.textMuted }}>
            {statusLabel}
          </p>
        </div>
      </div>

      {/* Equalizer */}
      {mode === "active" && (
        <div className="flex items-end gap-[3px] h-16 px-4">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="w-[2.5px] rounded-full"
              style={{
                height: `${8 + Math.sin(Date.now() / 300 + i) * 12 + (i % 4) * 5}px`,
                background: t.equalizerBar,
                opacity: 0.4 + (i % 3) * 0.2,
                animationDelay: `${i * 0.05}s`,
                transition: "height 0.3s ease"
              }} />
          ))}
        </div>
      )}

      {/* Contrôles */}
      <div className="w-full max-w-sm">
        {mode === "ringing" ? (
          <div className="flex flex-col items-center gap-8">
            {isCallee && (
              <div className="w-full max-w-xs">
                {showQuickMsgs ? (
                  <div className="space-y-2">
                    {QUICK_MESSAGES.map(msg => (
                      <button key={msg} onClick={() => handleQuickMsg(msg)}
                        className="w-full rounded-2xl px-4 py-3.5 text-[13px] font-semibold text-left active:scale-95 transition-all"
                        style={{ background: t.quickMsgBg, color: t.textPrimary, border: `1px solid ${t.quickMsgBorder}` }}>
                        {msg}
                      </button>
                    ))}
                    <button onClick={() => setShowQuickMsgs(false)} className="w-full text-[12px] font-bold py-2" style={{ color: t.textMuted }}>Annuler</button>
                  </div>
                ) : (
                  <button onClick={() => setShowQuickMsgs(true)}
                    className="w-full rounded-2xl px-4 py-3.5 text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{ background: t.quickMsgBg, color: t.textSecondary, border: `1px solid ${t.quickMsgBorder}` }}>
                    <MessageSquare className="w-4 h-4" /> Message rapide
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-around w-full">
              <div className="flex flex-col items-center gap-3">
                <button onClick={onReject} className="w-[76px] h-[76px] rounded-full flex items-center justify-center active:scale-90 transition-all shadow-xl" style={{ background: t.hangupBg, boxShadow: `0 10px 30px ${t.hangupShadow}` }}>
                  <PhoneOff className="w-8 h-8 text-white" />
                </button>
                <p className="text-[11px] font-bold" style={{ color: t.textMuted }}>Refuser</p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <button onClick={onAccept} className="w-[76px] h-[76px] rounded-full flex items-center justify-center active:scale-90 animate-pulse transition-all shadow-xl" style={{ background: t.acceptBg, boxShadow: `0 10px 30px ${t.acceptShadow}` }}>
                  <Phone className="w-8 h-8 text-white" />
                </button>
                <p className="text-[11px] font-bold" style={{ color: t.textMuted }}>Accepter</p>
              </div>
            </div>
          </div>
        ) : mode === "calling" ? (
          <div className="flex flex-col items-center gap-8">
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <button onClick={onHangup} className="w-[76px] h-[76px] rounded-full flex items-center justify-center active:scale-90 transition-all shadow-xl" style={{ background: t.hangupBg, boxShadow: `0 10px 30px ${t.hangupShadow}` }}>
                  <PhoneOff className="w-8 h-8 text-white" />
                </button>
                <p className="text-[11px] font-bold" style={{ color: t.textMuted }}>Raccrocher</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => setMuted(m => !m)} className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all"
                style={{ background: muted ? t.controlActive : t.controlBg, border: `1px solid ${muted ? t.accent : "transparent"}` }}>
                {muted ? <MicOff className="w-6 h-6" style={{ color: t.accent }} /> : <Mic className="w-6 h-6" style={{ color: t.textSecondary }} />}
              </button>
              <p className="text-[10px] font-bold" style={{ color: t.textMuted }}>{muted ? "Muet" : "Micro"}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => setSpeaker(s => !s)} className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all"
                style={{ background: speaker ? t.controlActive : t.controlBg, border: `1px solid ${speaker ? t.accent : "transparent"}` }}>
                {speaker ? <Volume2 className="w-6 h-6" style={{ color: t.accent }} /> : <VolumeX className="w-6 h-6" style={{ color: t.textSecondary }} />}
              </button>
              <p className="text-[10px] font-bold" style={{ color: t.textMuted }}>HP</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={onHangup} className="w-[76px] h-[76px] rounded-full flex items-center justify-center active:scale-90 transition-all shadow-xl" style={{ background: t.hangupBg, boxShadow: `0 10px 30px ${t.hangupShadow}` }}>
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <p className="text-[11px] font-bold" style={{ color: t.textMuted }}>Raccrocher</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
