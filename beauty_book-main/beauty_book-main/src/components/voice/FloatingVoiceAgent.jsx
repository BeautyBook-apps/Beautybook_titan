import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Mic, MicOff, Bot, Minimize2, Loader2, Volume2, Send, Phone, MapPin } from "lucide-react";
import { useVoiceAgent } from "@/lib/VoiceAgentContext";
import { motion, AnimatePresence } from "framer-motion";

function useSpeechRec({ onTranscript, enabled, isSpeaking }) {
  const recRef = useRef(null);
  const silenceRef = useRef(null);
  const pendingRef = useRef("");
  const enabledRef = useRef(enabled);
  const isSpeakingRef = useRef(isSpeaking);
  const [listening, setListening] = useState(false);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  const stopRec = useCallback(() => {
    clearTimeout(silenceRef.current);
    setListening(false);
    try { recRef.current?.abort(); } catch {}
    recRef.current = null;
  }, []);

  const startRec = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !enabledRef.current) return;

    try { recRef.current?.abort(); } catch {}
    recRef.current = null;

    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;

    rec.onstart = () => {
      setListening(true);
      pendingRef.current = "";
    };

    rec.onresult = (e) => {
      if (isSpeakingRef.current) return;

      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        }
      }

      if (finalText) {
        pendingRef.current += " " + finalText;
        clearTimeout(silenceRef.current);
        silenceRef.current = setTimeout(() => {
          const text = pendingRef.current.trim();
          pendingRef.current = "";
          if (text && text.length > 1) {
            onTranscript(text);
          }
        }, 350);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      setListening(false);
      if (enabledRef.current && !isSpeakingRef.current) {
        setTimeout(() => startRec(), 200);
      }
    };

    rec.onend = () => {
      setListening(false);
      if (enabledRef.current && !isSpeakingRef.current) {
        setTimeout(() => startRec(), 150);
      }
    };

    try { rec.start(); } catch (e) { console.error("rec.start error:", e); }
  }, [onTranscript]);

  useEffect(() => {
    if (enabled && !isSpeaking) {
      startRec();
    } else {
      stopRec();
    }
    return () => stopRec();
  }, [enabled, isSpeaking]);

  return { listening };
}

export default function FloatingVoiceAgent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { active, stop, messages, loading, speaking, sendVoiceMessage, interruptSpeech, navigateRef, expanded, setExpanded, pendingAction, confirmPendingAction } = useVoiceAgent();
  const [micEnabled, setMicEnabled] = useState(true);
  const [textInput, setTextInput] = useState("");
  const messagesEndRef = useRef(null);
  const textInputRef = useRef(null);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate, navigateRef]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus text input when panel opens
  useEffect(() => {
    if (expanded) {
      setTimeout(() => textInputRef.current?.focus(), 300);
    }
  }, [expanded]);

  // Voice transcript → send directly
  const handleTranscript = useCallback((text) => {
    if (speaking) interruptSpeech?.();
    sendVoiceMessage(text);
  }, [sendVoiceMessage, speaking, interruptSpeech]);

  // Send typed text
  const handleSendText = useCallback(() => {
    const text = textInput.trim();
    if (!text || loading) return;
    if (speaking) interruptSpeech?.();
    sendVoiceMessage(text);
    setTextInput("");
  }, [textInput, loading, speaking, interruptSpeech, sendVoiceMessage]);

  // Dictation → fill text input (not send)
  const handleDictate = useCallback((text) => {
    setTextInput(prev => prev ? prev + " " + text : text);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  const { listening } = useSpeechRec({
    onTranscript: handleTranscript,
    enabled: active && micEnabled && expanded,
    isSpeaking: speaking,
  });

  const isOnMariaPage = location.pathname === "/maria";
  if (!active || isOnMariaPage) return null;

  const lastMessages = messages.slice(-8);
  const status = speaking ? "speak" : loading ? "think" : listening ? "listen" : "idle";

  return (
    <AnimatePresence>
      <motion.div
        key="floating-voice"
        initial={{ opacity: 0, y: 60, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.9 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="fixed z-[999] font-display"
        style={{
          bottom: "calc(82px + env(safe-area-inset-bottom, 0px))",
          right: "12px",
          left: expanded ? "12px" : "auto",
        }}
      >
        {expanded ? (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-orange-100 flex flex-col" style={{ maxHeight: "70vh" }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#1a0800] to-[#2d1200] shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-orange-400 rounded-xl flex items-center justify-center shadow-md shrink-0">
                <Bot className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[13px] font-black">Maria · Contrôle Vocal Global</p>
                <StatusLine status={status} />
              </div>
              <button onClick={() => setExpanded(false)} className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center active:scale-90 shrink-0">
                <Minimize2 className="w-3.5 h-3.5 text-white/70" />
              </button>
              <button onClick={stop} className="w-7 h-7 bg-red-500/80 rounded-full flex items-center justify-center active:scale-90 shrink-0">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ minHeight: "100px" }}>
              {lastMessages.length === 0 && (
                <div className="py-6 text-center space-y-2">
                  <p className="text-[13px] font-black text-gray-400">Parlez ou écrivez</p>
                  <div className="text-[11px] text-gray-300 space-y-1">
                    <p>« Ouvre la boutique »</p>
                    <p>« Mets le thème nuit »</p>
                    <p>« Cherche un shampoing hydratant »</p>
                    <p>« Montre mes réservations »</p>
                  </div>
                </div>
              )}
              {lastMessages.map((msg, i) => (
                <div key={msg.id || i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] font-medium leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-primary to-orange-400 text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}>
                    {msg.actionResult && !msg.actionResult.ok && msg.actionResult.message !== "Action annulée." && (
                      <span className="block text-[10px] font-black text-red-500 mb-1">⚠️ ÉCHEC DE L'ACTION</span>
                    )}
                    {msg.actionResult && msg.actionResult.ok && msg.action && (
                      <span className="block text-[10px] font-black text-green-600 mb-1">✓ ACTION EXÉCUTÉE</span>
                    )}
                    {msg.content}
                    {msg.pendingConfirm && pendingAction && pendingAction.msgId === msg.id && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => confirmPendingAction(true)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 text-white text-[12px] font-black rounded-xl active:scale-95"
                        >
                          {pendingAction.type === "CALL_SALON" ? <Phone className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                          Confirmer
                        </button>
                        <button
                          onClick={() => confirmPendingAction(false)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-200 text-gray-700 text-[12px] font-black rounded-xl active:scale-95"
                        >
                          <X className="w-3.5 h-3.5" />
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-3 py-2.5 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                    {[0,1,2].map(j => (
                      <span key={j} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${j*0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Barre de saisie unique ── */}
            <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {/* Bouton micro */}
                <button
                  onClick={() => setMicEnabled(m => !m)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                    micEnabled
                      ? listening
                        ? "bg-green-500 shadow-md shadow-green-500/30 animate-pulse"
                        : "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                {/* Champ de texte */}
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={listening ? "🎤 J'écoute..." : "Écrivez ou parlez..."}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-[13px] text-gray-900 outline-none focus:border-primary focus:bg-white transition-all placeholder:text-gray-300 disabled:opacity-50"
                />

                {/* Bouton envoi / loading */}
                <button
                  onClick={handleSendText}
                  disabled={(!textInput.trim() && !listening) || loading}
                  className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/30 active:scale-95 transition-all disabled:opacity-40 shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Indicateur statut */}
              {listening && (
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-green-500 font-bold">Micro actif — parlez maintenant</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Bulle flottante ── */
          <div className="flex flex-col items-end gap-2">
            <AnimatePresence>
              {status !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-gray-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg"
                >
                  <StatusLine status={status} />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <button
                onClick={stop}
                className="w-9 h-9 bg-red-500 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setExpanded(true)}
                className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all relative"
                style={{ background: "linear-gradient(135deg, #E8732A, #f59540)" }}
              >
                {status === "listen" && (
                  <>
                    <span className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: "#E8732A" }} />
                    <span className="absolute inset-[-5px] rounded-full border-2 border-primary/30 animate-pulse" />
                  </>
                )}
                {status === "speak" && (
                  <span className="absolute inset-[-3px] rounded-full border-2 border-orange-300 animate-pulse" />
                )}
                <Bot className="w-6 h-6 text-white" strokeWidth={2.5} />
                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center transition-colors ${
                  status === "listen" ? "bg-green-400"
                  : status === "speak" ? "bg-orange-400"
                  : status === "think" ? "bg-blue-400"
                  : "bg-gray-400"
                }`}>
                  {status === "think"
                    ? <Loader2 className="w-2 h-2 text-white animate-spin" />
                    : <Mic className="w-2 h-2 text-white" />
                  }
                </div>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function StatusLine({ status }) {
  if (status === "speak") return (
    <div className="flex items-center gap-1">
      <Volume2 className="w-2.5 h-2.5 text-orange-300 animate-pulse" />
      <span className="text-[9px] text-orange-300 font-black">Maria parle…</span>
    </div>
  );
  if (status === "think") return (
    <div className="flex items-center gap-1">
      <Loader2 className="w-2.5 h-2.5 text-blue-300 animate-spin" />
      <span className="text-[9px] text-blue-300 font-black">Réfléchit…</span>
    </div>
  );
  if (status === "listen") return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      <span className="text-[9px] text-green-300 font-black">Écoute…</span>
    </div>
  );
  return <span className="text-[9px] text-white/30 font-bold">En attente…</span>;
}
