import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { grokChat } from './grok';

const VoiceAgentContext = createContext(null);

export function useVoiceAgent() {
  return useContext(VoiceAgentContext);
}

// ── Route map pour navigation auto après action ─────────────────────────────
const ACTION_ROUTES = {
  NAVIGATE: (action) => action.path || action.route,
  RESERVATION_CREATED: () => "/rendez-vous",
  ROUTINE_CREATED: () => "/profil",
  OPEN_PRO_FORM: () => "/devenir-pro",
  SEARCH_PRODUCTS: () => "/boutique",
  ROUTINE_SUMMARY: () => null,
  BOOKING_SUMMARY: () => null,
  SERVICE_FORM: () => "/pro/catalogue-services",
  SEND_MESSAGE: () => "/messages",
  REDIRECT_TO_PRO: () => "/devenir-pro",
};

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

  // ── Envoi d'un message vocal ─────────────────────────────────────────────
  const sendVoiceMessage = useCallback(async (text) => {
    if (!text?.trim() || loadingRef.current) return;

    // Interrompre TTS si Maria parle encore
    if (isSpeakingRef.current) interruptSpeech();

    loadingRef.current = true;
    setLoading(true);

    const userMsg = { role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    let reply = "Désolée, une erreur s'est produite.";
    let action = null;

    const MARIA_SYSTEM_PROMPT = `Tu es Maria, l'assistante IA beauté de l'application BeautyBook.
Tu es une experte en coiffure, soins capillaires, skincare, maquillage et bien-être.
Tu parles de manière chaleureuse, professionnelle et personnalisée.
Tu réponds toujours en français. Tu es concise mais complète.
Quand l'utilisateur te demande d'ouvrir une page, retourne un bloc JSON d'action:
\`\`\`json
{"type": "NAVIGATE", "path": "/chemin"}
\`\`\``;

    try {
      const rawReply = await grokChat(
        [{ role: 'user', content: text }],
        { system: MARIA_SYSTEM_PROMPT, max_tokens: 300 }
      );
      reply = rawReply || reply;
      const jsonMatch = rawReply.match(/```json\s*({[^`]+})\s*```/);
      if (jsonMatch) {
        try { action = JSON.parse(jsonMatch[1]); } catch {}
      }
    } catch (err2) {
      console.error("[VoiceAgent] Grok failed:", err2);
      reply = "Désolée, je rencontre un problème technique. Réessaie dans quelques instants ! 💫";
    }

    // Fallback: détecter l'action par mots-clés si l'IA n'a pas retourné de JSON
    if (!action) {
      action = detectActionFromText(text, reply);
    }

    // Mettre fin au loading AVANT de parler pour que le micro puisse redémarrer
    loadingRef.current = false;
    setLoading(false);

    const assistantMsg = { role: "assistant", content: reply, action, ts: Date.now() };
    setMessages((prev) => [...prev, assistantMsg]);

    // ── Navigation IMMÉDIATE (pas après le TTS) ──
    if (action && navigateRef.current && !abortSpeakRef.current) {
      const getRoute = ACTION_ROUTES[action.type];
      if (getRoute) {
        const route = getRoute(action);
        if (route) {
          // Parler brièvement la confirmation puis naviguer
          speakText(reply).then(() => {});
          setTimeout(() => {
            navigateRef.current?.(route);
            setExpanded(false); // Réduire le panneau, garder le bouton flottant
          }, 600);
          return;
        }
      }
    }

    // Pas d'action → juste parler la réponse
    await speakText(reply);
  }, [speakText, interruptSpeech]);

  return (
    <VoiceAgentContext.Provider
      value={{
        active, start, stop,
        messages, loading, speaking,
        sendVoiceMessage, interruptSpeech,
        audioRef, navigateRef,
        expanded, setExpanded,
      }}
    >
      {children}
      <audio ref={audioRef} style={{ display: "none" }} />
    </VoiceAgentContext.Provider>
  );
}