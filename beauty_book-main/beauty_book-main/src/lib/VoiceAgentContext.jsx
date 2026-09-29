import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { grokChat } from './grok';
import { isKnownAction, actionNeedsConfirm, runAppAction, describeAppActions } from './appControl';

const VoiceAgentContext = createContext(null);

export function useVoiceAgent() {
  return useContext(VoiceAgentContext);
}

// ── Prompt système de Global : il peut RÉELLEMENT agir dans l'application ──
const GLOBAL_SYSTEM_PROMPT = `Tu es Global, l'assistante IA de l'application BeautyBook.
Tu es une experte en coiffure, soins capillaires, skincare, maquillage et bien-être.
Tu parles de manière chaleureuse, professionnelle et personnalisée.
Tu réponds toujours en français. Tu es concise mais complète.

POUVOIR D'ACTION RÉEL : quand l'utilisateur te demande de FAIRE quelque chose dans l'application
(ouvrir une page, changer le thème, chercher un produit, appeler, itinéraire), tu réponds
UNIQUEMENT avec un bloc JSON d'action, sans aucun autre texte :
\`\`\`json
{"type": "NAVIGATE", "path": "/boutique"}
\`\`\`

Actions disponibles :
${describeAppActions()}

Règles :
- N'utilise une action QUE si l'utilisateur demande explicitement de faire quelque chose.
- Pour une simple question, réponds normalement en texte, sans JSON.
- Pour CALL_SALON et OPEN_DIRECTIONS : tu dois connaître le numéro ou l'adresse. Si l'utilisateur ne l'a pas donné, demande-le en texte simple (sans JSON), n'invente jamais un numéro ou une adresse.
- Ne prétends jamais avoir fait une action : c'est l'application qui l'exécute et confirme le résultat.`;

// ── Détection fallback par mots-clés (si l'IA ne retourne pas de JSON action)
function detectActionFromText(userText, aiReply) {
  const text = (userText + " " + aiReply).toLowerCase();

  // Navigation patterns
  if (text.match(/ouvr(e|ir|ez).*(boutique|shop|store|produit)/)) return { type: "NAVIGATE", path: "/boutique" };
  if (text.match(/ouvr(e|ir|ez).*(rendez[- ]?vous|rdv|réservation|booking)/)) return { type: "NAVIGATE", path: "/rendez-vous" };
  if (text.match(/ouvr(e|ir|ez).*(profil|compte|mon compte)/)) return { type: "NAVIGATE", path: "/profil" };
  if (text.match(/ouvr(e|ir|ez).*(messages|chat|conversation)/)) return { type: "NAVIGATE", path: "/messages" };
  if (text.match(/ouvr(e|ir|ez).*(services|prestation)/)) return { type: "NAVIGATE", path: "/services" };
  if (text.match(/ouvr(e|ir|ez).*(solde|portefeuille|wallet|beauty.?pay|payer)/)) return { type: "NAVIGATE", path: "/mon-solde" };
  if (text.match(/ouvr(e|ir|ez).*(paramètres|settings|configuration)/)) return { type: "NAVIGATE", path: "/parametres" };
  if (text.match(/ouvr(e|ir|ez).*(notifications|alertes)/)) return { type: "NAVIGATE", path: "/notifications" };
  if (text.match(/ouvr(e|ir|ez).*(live|stream|direct)/)) return { type: "NAVIGATE", path: "/live" };
  if (text.match(/ouvr(e|ir|ez).*(reels|vidéos|video)/)) return { type: "NAVIGATE", path: "/reels" };
  if (text.match(/ouvr(e|ir|ez).*(scan|capillaire|cheveux)/)) return { type: "NAVIGATE", path: "/scan-capillaire" };
  if (text.match(/ouvr(e|ir|ez).*(immobilier|logement|appartement)/)) return { type: "NAVIGATE", path: "/immobilier" };
  if (text.match(/ouvr(e|ir|ez).*(commande|order|achat)/)) return { type: "NAVIGATE", path: "/mes-commandes" };
  if (text.match(/ouvr(e|ir|ez).*(fidélité|fidelite|points|reward)/)) return { type: "NAVIGATE", path: "/programme-fidelite" };
  if (text.match(/ouvr(e|ir|ez).*(abonnement|subscription)/)) return { type: "NAVIGATE", path: "/abonnements" };
  if (text.match(/va(s|-|\s)*(sur|à|a).*(boutique|shop)/)) return { type: "NAVIGATE", path: "/boutique" };
  if (text.match(/va(s|-|\s)*(sur|à|a).*(rendez|rdv)/)) return { type: "NAVIGATE", path: "/rendez-vous" };
  if (text.match(/montre|affiche|montrez|affichez.*(boutique|produit)/)) return { type: "NAVIGATE", path: "/boutique" };
  if (text.match(/montre|affiche.*(rendez|rdv|réservation)/)) return { type: "NAVIGATE", path: "/rendez-vous" };
  if (text.match(/je veux.*(réserver|prendre.*rendez)/)) return { type: "NAVIGATE", path: "/rendez-vous" };
  if (text.match(/je veux.*(acheter|commander|payer)/)) return { type: "NAVIGATE", path: "/boutique" };

  // Pro actions
  if (text.match(/ouvr(e|ir|ez).*(profil.?pro|espace.?pro|dashboard.?pro)/)) return { type: "NAVIGATE", path: "/profil-pro" };
  if (text.match(/ouvr(e|ir|ez).*(équipe|equipe|membre)/)) return { type: "NAVIGATE", path: "/pro/equipe" };
  if (text.match(/ouvr(e|ir|ez).*(catalogue|service)/)) return { type: "NAVIGATE", path: "/pro/catalogue-services" };
  if (text.match(/ouvr(e|ir|ez).*(analytics|statistiques|stats)/)) return { type: "NAVIGATE", path: "/pro/analytics" };

  return null;
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

// ── Nettoyage texte pour voix (Odysseus-inspired: strip markdown for TTS) ────
function stripForVoice(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\|[^\n]+\|/g, "") // tableaux markdown
    .replace(/`[^`]+`/g, "")    // code inline
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/[【】\[\]]/g, "")
    .trim()
    .slice(0, 600);
}

// ── Découper le texte en chunks naturels pour TTS fluide ─────────────────────
function splitIntoChunks(text, maxLen = 300) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

export function VoiceAgentProvider({ children }) {
  const [active, setActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const audioRef = useRef(null);
  const navigateRef = useRef(null);
  const loadingRef = useRef(false);
  const speakQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const abortSpeakRef = useRef(false);
  const msgIdRef = useRef(0);
  const [pendingAction, setPendingAction] = useState(null); // {msgId, type, params, label}

  const nextMsgId = () => { msgIdRef.current += 1; return msgIdRef.current; };

  const stop = useCallback(() => {
    setActive(false);
    setExpanded(false);
    setSpeaking(false);
    isSpeakingRef.current = false;
    abortSpeakRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  const start = useCallback(() => {
    setActive(true);
    abortSpeakRef.current = false;
    setMessages([]);
  }, []);

  // ── Interrupt: coupe la voix immédiatement (quand user parle) ────────────
  const interruptSpeech = useCallback(() => {
    abortSpeakRef.current = true;
    speakQueueRef.current = [];
    isSpeakingRef.current = false;
    setSpeaking(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    // Reset pour la prochaine réponse
    setTimeout(() => { abortSpeakRef.current = false; }, 100);
  }, []);

  // ── Lecteur TTS via Voicebox (fallback: Web Speech API) ──────────────────
  const speakText = useCallback(async (text) => {
    if (!text?.trim()) return;

    const voiceText = stripForVoice(text);
    if (!voiceText) return;

    abortSpeakRef.current = false;
    setSpeaking(true);
    isSpeakingRef.current = true;

    try {
      // Try Voicebox first
      const res = await fetch(`${API_BASE}/ai/voicebox-speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: voiceText, profile: 'Maria', engine: 'qwen', language: 'fr' }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio_url) {
          if (abortSpeakRef.current) {
            setSpeaking(false);
            isSpeakingRef.current = false;
            return;
          }
          if (audioRef.current) {
            audioRef.current.src = data.audio_url;
            try { await audioRef.current.play(); } catch {}
            await new Promise((resolve) => {
              if (!audioRef.current) { resolve(); return; }
              const checkAbort = setInterval(() => {
                if (abortSpeakRef.current) {
                  clearInterval(checkAbort);
                  if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
                  resolve();
                }
              }, 200);
              audioRef.current.onended = () => { clearInterval(checkAbort); resolve(); };
              audioRef.current.onerror = () => { clearInterval(checkAbort); resolve(); };
            });
          }
          isSpeakingRef.current = false;
          setSpeaking(false);
          return;
        }
      }

      // Fallback: Web Speech API
      const clean = voiceText.slice(0, 400);
      if (clean && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        await new Promise((resolve) => {
          const utt = new SpeechSynthesisUtterance(clean);
          utt.lang = "fr-FR";
          utt.rate = 1.1;
          utt.onend = resolve;
          utt.onerror = resolve;
          window.speechSynthesis.speak(utt);
        });
      }
    } catch (e) {
      console.error("speakText error:", e);
    }

    isSpeakingRef.current = false;
    setSpeaking(false);
  }, []);

  // ── Exécute une action du bus applicatif, résultat honnête (jamais de faux succès) ──
  const executeAction = useCallback(async (action, msgId) => {
    const { type, ...params } = action;
    try {
      const result = await runAppAction(type, params, { navigate: navigateRef.current });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: result.message, action, actionResult: result } : m)));
      return result;
    } catch (e) {
      const result = { ok: false, message: e.message || "L'action n'a pas pu être exécutée." };
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: result.message, action, actionResult: result } : m)));
      return result;
    }
  }, []);

  // ── Confirmation d'une action sensible (appel, itinéraire) ────────────────
  const confirmPendingAction = useCallback(async (ok) => {
    const p = pendingAction;
    if (!p) return;
    setPendingAction(null);
    if (!ok) {
      setMessages((prev) => prev.map((m) =>
        m.id === p.msgId ? { ...m, content: "Très bien, j'annule.", actionResult: { ok: false, message: "Action annulée." } } : m
      ));
      await speakText("Très bien, j'annule.");
      return;
    }
    const result = await executeAction({ type: p.type, ...p.params }, p.msgId);
    await speakText(result.message);
  }, [pendingAction, executeAction, speakText]);

  // ── Envoi d'un message vocal ─────────────────────────────────────────────
  const sendVoiceMessage = useCallback(async (text) => {
    if (!text?.trim() || loadingRef.current) return;

    // Interrompre TTS si Maria parle encore
    if (isSpeakingRef.current) interruptSpeech();

    loadingRef.current = true;
    setLoading(true);

    const userMsg = { role: "user", content: text, ts: Date.now(), id: nextMsgId() };
    setMessages((prev) => [...prev, userMsg]);

    let reply = "Désolée, une erreur s'est produite.";
    let action = null;

    try {
      const rawReply = await grokChat(
        [{ role: 'user', content: text }],
        { system: GLOBAL_SYSTEM_PROMPT, max_tokens: 300, feature: "global" }
      );
      reply = rawReply || reply;
      const jsonMatch = rawReply.match(/```json\s*({[^`]+})\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed && isKnownAction(parsed.type)) action = parsed;
        } catch {}
      }
    } catch (err2) {
      console.error("[VoiceAgent] Grok failed:", err2);
      reply = "Désolée, je rencontre un problème technique. Réessaie dans quelques instants ! 💫";
    }

    // Fallback: détecter une navigation par mots-clés si l'IA n'a pas retourné d'action
    if (!action) {
      const fallback = detectActionFromText(text, reply);
      if (fallback && isKnownAction(fallback.type)) action = fallback;
    }

    // Mettre fin au loading AVANT de parler pour que le micro puisse redémarrer
    loadingRef.current = false;
    setLoading(false);

    const msgId = nextMsgId();

    // ── Une action a été demandée ──
    if (action) {
      const { type, ...params } = action;
      if (actionNeedsConfirm(type)) {
        // Action sensible : on demande confirmation, on n'exécute RIEN pour l'instant.
        const label = type === "CALL_SALON"
          ? `appeler le ${params.phone || "numéro"}`
          : `ouvrir l'itinéraire vers « ${params.address || ""} »`;
        setPendingAction({ msgId, type, params, label });
        const confirmText = `Voulez-vous vraiment que je ${label} ? Confirmez dans le panneau.`;
        setMessages((prev) => [...prev, { role: "assistant", content: confirmText, action, pendingConfirm: true, ts: Date.now(), id: msgId }]);
        setExpanded(true);
        await speakText(confirmText);
        return;
      }
      // Action directe : exécution réelle, résultat honnête.
      setMessages((prev) => [...prev, { role: "assistant", content: "…", action, ts: Date.now(), id: msgId }]);
      const result = await executeAction(action, msgId);
      if (type === "NAVIGATE") {
        setExpanded(false); // Réduire le panneau après navigation
      }
      await speakText(result.message);
      return;
    }

    const assistantMsg = { role: "assistant", content: reply, action, ts: Date.now(), id: msgId };
    setMessages((prev) => [...prev, assistantMsg]);

    // Pas d'action → juste parler la réponse
    await speakText(reply);
  }, [speakText, interruptSpeech, executeAction]);

  return (
    <VoiceAgentContext.Provider
      value={{
        active, start, stop,
        messages, loading, speaking,
        sendVoiceMessage, interruptSpeech,
        audioRef, navigateRef,
        expanded, setExpanded,
        pendingAction, confirmPendingAction,
      }}
    >
      {children}
      <audio ref={audioRef} style={{ display: "none" }} />
    </VoiceAgentContext.Provider>
  );
}