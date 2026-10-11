import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { useWebRTC } from "./useWebRTC";
import CallScreen from "./CallScreen";
import { Send, X } from "lucide-react";

const CallContext = createContext(null);
export function useCall() { return useContext(CallContext); }
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function emailToName(email) {
  if (!email) return "Utilisateur";
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Sonnerie d'appel
let ringtoneInterval = null;
let ringtoneAudio = null;
let activeCallNotification = null;

function playRingtone() {
  try {
    stopRingtone();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTone = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    };
    
    playTone();
    ringtoneInterval = setInterval(playTone, 1000);
    ringtoneAudio = audioContext;
  } catch (e) {
    console.error('[CallManager] Ringtone error:', e);
  }
}

function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (ringtoneAudio) {
    ringtoneAudio.close().catch(() => {});
    ringtoneAudio = null;
  }
  if (activeCallNotification) {
    activeCallNotification.close();
    activeCallNotification = null;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
}

function vibratePhone(pattern = [1000, 500, 1000, 500, 1000]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

function showCallNotification(title, body, callerName) {
  if ('Notification' in window && Notification.permission === 'granted') {
    activeCallNotification = new Notification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [1000, 500, 1000],
      tag: 'incoming-call',
      requireInteraction: true,
      data: { callerName },
    });
    return activeCallNotification;
  }
  return null;
}

const POST_CALL_SUGGESTIONS = [
  "Je voudrais prendre rendez-vous",
  "Quels sont vos disponibilités ?",
  "C'est pour une coloration / coupe / soin",
  "Je vous envoie mes photos",
  "Merci, on se rappelle bientôt !",
  "Je passe demain en boutique",
];

function PostCallScreen({ targetName, targetAvatar, onSend, onDismiss, user }) {
  const [message, setMessage] = useState("");
  const initials = (targetName || "?")[0]?.toUpperCase() || "?";

  const handleSend = () => {
    if (message.trim()) onSend(message.trim());
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)' }}>
      <button onClick={onDismiss} className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.1)" }}>
        <X className="w-5 h-5 text-white/70" />
      </button>

      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-full overflow-hidden" style={{ border: "3px solid rgba(249,115,42,0.3)", background: "#312E81" }}>
          {targetAvatar
            ? <BeautyImage src={targetAvatar} alt={targetName} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-orange-400">{initials}</div>
          }
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">{targetName}</p>
          <p className="text-white/50 text-sm">Appel terminé</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <p className="text-white/60 text-sm font-semibold text-center mb-2">Envoyer un message</p>

        <div className="relative">
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Votre message..."
            className="w-full rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-white/40 outline-none"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }} />
          <button onClick={handleSend} disabled={!message.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: message.trim() ? "#F97316" : "rgba(255,255,255,0.1)" }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="space-y-2 pt-2">
          {POST_CALL_SUGGESTIONS.map((sug) => (
            <button key={sug} onClick={() => onSend(sug)}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium text-left active:scale-95 transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {sug}
            </button>
          ))}
        </div>

        <button onClick={onDismiss} className="w-full text-center text-white/40 text-sm font-semibold py-3">
          Ignorer
        </button>
      </div>
    </div>
  );
}

export function CallManager({ children }) {
  const { user } = useAuth();
  const [callState, setCallState] = useState(null);
  const [postCallState, setPostCallState] = useState(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callIdRef = useRef(null);
  const callStartedAtRef = useRef(null);
  const pollRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const endPollRef = useRef(null);
  const currentCallRef = useRef({ callId: null, targetEmail: null, targetName: null, targetAvatar: null, isCaller: false });
  const cleanupRef = useRef(null);
  const rejectCallRef = useRef(null);

  const onRemoteStream = useCallback((stream) => {
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
  }, []);

  const { createOffer, createAnswer, setRemoteAnswer, addIceCandidate, close: closePC } = useWebRTC({
    callId: callIdRef.current, localStreamRef, onRemoteStream,
    onEnd: () => { if (cleanupRef.current) cleanupRef.current(); },
  });

  const getMic = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  };

  const cleanup = useCallback(() => {
    // Couper immédiatement tous les sons avant les écritures réseau et le
    // démontage de l'écran d'appel.
    stopRingtone();
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.removeAttribute("src");
      remoteAudioRef.current.load();
    }
    closePC();
    clearInterval(pollRef.current);
    clearInterval(endPollRef.current);
    clearTimeout(ringTimeoutRef.current);
    stopRingtone(); // Arrêter la sonnerie
    callIdRef.current = null;
    callStartedAtRef.current = null;
    setCallState(null);
  }, [closePC]);

  cleanupRef.current = cleanup;

  const saveCallLog = useCallback(async (callId, callerEmail, callerName, callerAvatar, calleeEmail, calleeName, calleeAvatar, status, startedAt, endedAt) => {
    const durationSec = (startedAt && endedAt) ? Math.round((new Date(endedAt) - new Date(startedAt)) / 1000) : 0;
    try {
      await supabase.from("CallLog").insert({
        caller_email: callerEmail, callee_email: calleeEmail,
        status, duration_sec: durationSec,
        started_at: startedAt || new Date().toISOString(),
        ended_at: endedAt || new Date().toISOString(),
      });
    } catch (e) { console.error("saveCallLog:", e); }
  }, []);

  // Polling pour les signaux d'appel
  const startPolling = useCallback((callId, onSignal) => {
    clearInterval(pollRef.current);
    const seen = new Set();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.from("call_signals")
          .select("*").eq("call_id", callId)
          .order("created_at", { ascending: true });
        for (const sig of (data || [])) {
          if (seen.has(sig.id)) continue;
          seen.add(sig.id);
          onSignal(sig);
        }
      } catch (e) { console.error("poll error:", e); }
    }, 2000);
  }, []);

  // ── Initier un appel ────────────────────────────────────────────────────────
  const startCall = useCallback(async ({ targetEmail, targetName, targetAvatar }) => {
    if (!user) return;
    const callId = `${user.email}_${targetEmail}_${Date.now()}`;
    callIdRef.current = callId;
    currentCallRef.current = { callId, targetEmail, targetName, targetAvatar, isCaller: true };
    setCallState({ callId, mode: "calling", targetEmail, targetName, targetAvatar, isCaller: true });
    playRingtone();

    let stream;
    try { stream = await getMic(); } catch { alert("Microphone inaccessible."); cleanup(); return; }

    const offer = await createOffer(stream);

    await supabase.from("call_signals").insert({
      call_id: callId, caller_email: user.email,
      callee_email: targetEmail, signal_type: "offer", payload: JSON.stringify(offer), status: "ringing",
    });

    try {
      await entities.Notification.create({
        user_email: targetEmail, type: "call", title: `Appel de ${user.full_name || "Un client"}`,
        body: "Appel entrant - touchez pour répondre", icon: "📞",
        link: `/messages?to=${user.email}&name=${encodeURIComponent(user.full_name || emailToName(user.email))}&call_id=${callId}`,
        read: false, data: { call_id: callId, caller_email: user.email, caller_name: user.full_name },
      });
    } catch (e) { console.error("notif error:", e); }

    startPolling(callId, async (sig) => {
      if (sig.call_id !== callId) return;
      if (sig.signal_type === "answer") {
        await setRemoteAnswer(JSON.parse(sig.payload));
        callStartedAtRef.current = new Date().toISOString();
        setCallState(s => s ? { ...s, mode: "active" } : s);
      } else if (sig.signal_type === "ice-candidate") {
        await addIceCandidate(JSON.parse(sig.payload).candidate);
      } else if (sig.signal_type === "reject" || sig.signal_type === "end") {
        const ci = currentCallRef.current;
        await saveCallLog(callId, user.email, user.full_name, user.avatar_url, ci.targetEmail, ci.targetName, ci.targetAvatar, sig.signal_type === "reject" ? "missed" : "outgoing", null, new Date().toISOString());
        await wait(500);
        cleanup();
      }
    });

    ringTimeoutRef.current = setTimeout(() => {
      setCallState(s => {
        if (s?.callId === callId && s?.mode === "calling") {
          saveCallLog(callId, user.email, user.full_name, user.avatar_url, targetEmail, targetName, targetAvatar, "missed", null, new Date().toISOString());
          cleanup();
        }
        return s;
      });
    }, 60000);
  }, [user, createOffer, setRemoteAnswer, addIceCandidate, cleanup, saveCallLog, startPolling]);

  // ── Écouter les appels entrants (polling) ───────────────────────────────────
  useEffect(() => {
    if (!user || callState) return;
    const seen = new Set();
    const check = setInterval(async () => {
      try {
        const { data, error } = await supabase.from("call_signals")
          .select("*").eq("callee_email", user.email).eq("signal_type", "offer").eq("status", "ringing")
          .order("created_at", { ascending: false }).limit(5);
        if (error) { console.error("Poll incoming error:", error); return; }
        for (const sig of (data || [])) {
          if (seen.has(sig.id)) continue;
          const age = Date.now() - new Date(sig.created_at).getTime();
          if (age > 65000) { seen.add(sig.id); continue; }
          const { data: endSig } = await supabase.from("call_signals")
            .select("id").eq("call_id", sig.call_id).in("signal_type", ["end", "reject"]).limit(1);
          if (endSig && endSig.length > 0) { seen.add(sig.id); continue; }
          seen.add(sig.id);
          callIdRef.current = sig.call_id;
          const callerName = sig.caller_name || emailToName(sig.caller_email);
          currentCallRef.current = { callId: sig.call_id, targetEmail: sig.caller_email, targetName: callerName, targetAvatar: null, isCaller: false };
          
          // Jouer la sonnerie et vibrer
          playRingtone();
          vibratePhone();
          
          // Notification native
          showCallNotification(
            '📞 Appel entrant',
            `${callerName} vous appelle...`,
            callerName
          );
          
          setCallState({
            callId: sig.call_id, mode: "ringing",
            targetEmail: sig.caller_email, targetName: callerName, targetAvatar: null,
            isCaller: false, offerSDP: JSON.parse(sig.payload),
          });
          break;
        }
      } catch (e) { console.error("Poll error:", e); }
    }, 2000);
    return () => clearInterval(check);
  }, [user?.email, callState?.mode]);

  // ── Détecter le raccrocher de l'appelant pendant la sonnerie ────────────────
  useEffect(() => {
    if (!user || !callState || callState.mode !== "ringing" || callState.isCaller) return;
    const currentCallId = callState.callId;
    clearInterval(endPollRef.current);
    endPollRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.from("call_signals")
          .select("id").eq("call_id", currentCallId).in("signal_type", ["end", "reject"]).limit(1);
        if (error) { console.error("End poll error:", error); return; }
        if (data && data.length > 0) {
          clearInterval(endPollRef.current);
          await wait(200);
          cleanup();
        }
      } catch (e) { console.error("End poll catch:", e); }
    }, 1000);
    return () => clearInterval(endPollRef.current);
  }, [user?.email, callState?.callId, callState?.mode, callState?.isCaller]);

  // ── Accepter ────────────────────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!callState || callState.mode !== "ringing") return;
    let stream;
    try { stream = await getMic(); } catch { alert("Microphone inaccessible."); if (rejectCallRef.current) await rejectCallRef.current(); return; }

    stopRingtone(); // Arrêter la sonnerie quand l'appel est accepté

    const answer = await createAnswer(stream, callState.offerSDP);

    await supabase.from("call_signals").insert({
      call_id: callState.callId, caller_email: user.email, callee_email: currentCallRef.current.targetEmail,
      signal_type: "answer", payload: JSON.stringify(answer), status: "accepted",
    });

    callStartedAtRef.current = new Date().toISOString();

    startPolling(callState.callId, async (sig) => {
      if (sig.signal_type === "ice-candidate") {
        await addIceCandidate(JSON.parse(sig.payload).candidate);
      } else if (sig.signal_type === "end") {
        const ci = currentCallRef.current;
        await saveCallLog(ci.callId, ci.targetEmail, ci.targetName, ci.targetAvatar, user.email, user.full_name, user.avatar_url, "received", callStartedAtRef.current, new Date().toISOString());
        await wait(500);
        cleanup();
      }
    });

    setCallState(s => s ? { ...s, mode: "active" } : s);
  }, [callState, user, createAnswer, addIceCandidate, cleanup, saveCallLog, startPolling]);

  // ── Refuser ─────────────────────────────────────────────────────────────────
  const rejectCall = useCallback(async () => {
    stopRingtone();
    const ci = currentCallRef.current;
    if (!ci.callId) return;
    try {
      await supabase.from("call_signals").insert({
        call_id: ci.callId, caller_email: ci.targetEmail, callee_email: user?.email || "",
        signal_type: "reject", payload: "", status: "rejected",
      });
    } catch (_) {}
    await saveCallLog(ci.callId, ci.targetEmail, ci.targetName, ci.targetAvatar, user?.email, user?.full_name, user?.avatar_url, "rejected", null, new Date().toISOString());
    await wait(500);
    cleanup();
  }, [user, cleanup, saveCallLog]);

  rejectCallRef.current = rejectCall;

  // ── Raccrocher ──────────────────────────────────────────────────────────────
  const hangup = useCallback(async () => {
    if (!callState) return;
    stopRingtone();
    const endedAt = new Date().toISOString();
    const { callId, targetEmail, targetName, targetAvatar, isCaller } = currentCallRef.current;
    try {
      await supabase.from("call_signals").insert({
        call_id: callId, caller_email: user?.email || "", callee_email: targetEmail,
        signal_type: "end", payload: "", status: "ended",
      });
    } catch (_) {}
    if (isCaller) {
      await saveCallLog(callId, user?.email, user?.full_name, user?.avatar_url, targetEmail, targetName, targetAvatar, "outgoing", callStartedAtRef.current, endedAt);
    } else {
      await saveCallLog(callId, targetEmail, targetName, targetAvatar, user?.email, user?.full_name, user?.avatar_url, "received", callStartedAtRef.current, endedAt);
    }
    const callInfo = { ...currentCallRef.current };
    await wait(500);
    cleanup();
    if (isCaller) {
      setPostCallState({ targetEmail: callInfo.targetEmail, targetName: callInfo.targetName, targetAvatar: callInfo.targetAvatar });
    }
  }, [callState, user, cleanup, saveCallLog]);

  // ── Messages rapides ────────────────────────────────────────────────────────
  const sendQuickMessage = useCallback(async (msg) => {
    if (!callState || callState.isCaller || !user) return;
    const convId = [user?.email, callState.targetEmail].sort().join("_");
    try {
      await supabase.from("MessageChat").insert({
        conversation_id: convId, sender_email: user?.email,
        receiver_email: callState.targetEmail,
        content: msg, read: false,
      });
    } catch (_) {}
    if (rejectCallRef.current) await rejectCallRef.current();
  }, [callState, user]);

  // ── Envoyer un message après l'appel ────────────────────────────────────────
  const sendPostCallMessage = useCallback(async (msg) => {
    if (!postCallState || !user) return;
    const convId = [user?.email, postCallState.targetEmail].sort().join("_");
    try {
      await supabase.from("MessageChat").insert({
        conversation_id: convId, sender_email: user?.email,
        receiver_email: postCallState.targetEmail,
        content: msg, read: false,
      });
    } catch (_) {}
    setPostCallState(null);
  }, [postCallState, user]);

  const dismissPostCall = useCallback(() => setPostCallState(null), []);

  return (
    <CallContext.Provider value={{ startCall, hangup, acceptCall, rejectCall, inCall: !!callState, sendQuickMessage, postCallState, sendPostCallMessage, dismissPostCall }}>
      {children}
      {callState && (
        <CallScreen mode={callState.mode} targetName={callState.targetName} targetAvatar={callState.targetAvatar}
          onHangup={hangup} onAccept={acceptCall} onReject={rejectCall} remoteAudioRef={remoteAudioRef}
          targetEmail={callState.targetEmail} currentUserEmail={user?.email}
          isCallee={!callState.isCaller} sendQuickMessage={sendQuickMessage} />
      )}
      {postCallState && !callState && (
        <PostCallScreen targetName={postCallState.targetName} targetAvatar={postCallState.targetAvatar}
          onSend={sendPostCallMessage} onDismiss={dismissPostCall} user={user} />
      )}
    </CallContext.Provider>
  );
}
