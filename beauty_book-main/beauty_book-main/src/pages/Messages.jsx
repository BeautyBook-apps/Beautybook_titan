import BeautyImage from '@/components/ui/BeautyImage';
import apiClient from '@/lib/apiClient';
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Send, Search, MessageSquare, Trash2, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Scissors, Clock, ChevronRight, PhoneCall, Sparkles, Zap, Image, Smile, Users } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { useIsPro } from "@/hooks/useIsPro";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { useCall } from "@/components/call/CallManager";
import { notifyMessageReceived } from '@/lib/notificationService';

function emailToDisplayName(email) {
  if (!email) return "Utilisateur";
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ── Réponse auto Toggle ───────────────────────────────────────────────────────
const MARIA_AI_KEY = "bb_maria_ai_active";
const MARIA_CHAT_CACHE = {};

async function generateAutoReply({ clientMessage, clientName, proProfile, conversationHistory }) {
  const systemPrompt = `Tu es l'assistant IA de réception du salon "${proProfile?.salon_name || "de beauté"}".

CONTEXTE DU SALON:
- Nom: ${proProfile?.salon_name || "Non renseigné"}
- Spécialités: ${proProfile?.specialites?.join(", ") || "Non renseigné"}
- Ville: ${proProfile?.city || "Non renseigné"}
- Note: ${proProfile?.rating || "N/A"}/5

RÈGLES:
- Tu réponds EN FRANÇAIS, de manière chaleureuse et professionnelle
- Tu es la réceptionniste du salon, pas Maria l'assistante personnelle
- Tu gères les demandes de RDV, les questions sur les services, les prix
- Tu proposes de prendre un RDV quand c'est pertinent
- Tu restes concis (2-3 phrases max par réponse)
- Tu n'inventes pas de prix ou d'horaires, tu dis que tu vérifies si nécessaire
- Tu peux utiliser des emojis avec modération
- Ne JAMAIS mentionner que tu es une IA`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory || []).slice(-6).map(m => ({
      role: m.sender_email === proProfile?.user_email ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: `Message de ${clientName}: "${clientMessage}"` },
  ];

  const data = await apiClient.post('/api/ai/maria', { messages });
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Maria n’a pas pu générer de réponse.');
  return reply;
}

function MariaAIToggle({ active, onChange }) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all active:scale-95 ${
        active
          ? "bg-violet-600 border-violet-600 shadow-lg shadow-violet-500/30"
          : "bg-white border-gray-200"
      }`}
    >
      <Sparkles className={`w-3.5 h-3.5 ${active ? "text-white" : "text-gray-400"}`} />
      <span className={`text-[11px] font-black ${active ? "text-white" : "text-gray-500"}`}>
        Réponse auto
      </span>
      <div className={`w-7 h-4 rounded-full transition-all flex items-center px-0.5 ${active ? "bg-white/30" : "bg-gray-200"}`}>
        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-all ${active ? "translate-x-3" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

// ── ConversationList ──────────────────────────────────────────────────────────
function ConversationList({ conversations, loading, onSelect, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);

  if (loading && conversations.length === 0) {
    return (
      <div className="space-y-3 px-4 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 bg-gray-100 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded-full w-1/2" />
              <div className="h-3 bg-gray-100 rounded-full w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <MessageSquare className="w-12 h-12 text-gray-200" />
        <p className="text-[14px] font-bold text-gray-400">Aucun message</p>
        <p className="text-[12px] text-gray-300 font-medium text-center px-8">Commencez une conversation avec un professionnel</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {conversations.map((conv) => {
        const initials = (conv.other_name || conv.other_email || "?")[0].toUpperCase();
        const isConfirming = confirmId === conv.conversation_id;
        return (
          <div key={conv.conversation_id} className="relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 flex items-center">
              {isConfirming ? (
                <div className="flex h-full">
                  <button onClick={() => setConfirmId(null)} className="bg-gray-200 text-gray-700 text-[11px] font-black px-4 h-full">Annuler</button>
                  <button onClick={() => { onDelete(conv.conversation_id); setConfirmId(null); }} className="bg-red-500 text-white text-[11px] font-black px-4 h-full flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> Supprimer
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmId(conv.conversation_id)} className="bg-red-50 text-red-400 w-12 h-full flex items-center justify-center border-l border-gray-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => { setConfirmId(null); onSelect(conv); }}
              className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-all text-left ${isConfirming ? "pr-44" : "pr-14"}`}
            >
              <div className="relative shrink-0 w-12 h-12">
                {conv.other_avatar ? (
                  <BeautyImage src={conv.other_avatar} alt={conv.other_name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-[16px] font-black text-primary">{initials}</span>
                  </div>
                )}
                {conv.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[9px] font-black">{conv.unread}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-[14px] font-black truncate ${conv.unread > 0 ? "text-gray-900" : "text-gray-700"}`}>
                    {conv.other_name || emailToDisplayName(conv.other_email)}
                  </p>
                  <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-2">
                    {conv.last_date ? timeAgo(conv.last_date) : ""}
                  </span>
                </div>
                <p className={`text-[12px] truncate mt-0.5 ${conv.unread > 0 ? "font-bold text-gray-700" : "font-medium text-gray-400"}`}>
                  {conv.last_message}
                </p>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── ServiceCard dans le chat ──────────────────────────────────────────────────
function ServiceCard({ service, navigate }) {
  return (
    <button
      onClick={() => navigate(`/service/${service.id}`)}
      className="w-full text-left rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm active:scale-[0.98] transition-all"
    >
      {service.image_url ? (
        <div className="h-32 w-full overflow-hidden">
          <BeautyImage src={service.image_url} alt={service.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-32 w-full bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
          <Scissors className="w-10 h-10 text-primary/40" />
        </div>
      )}
      <div className="p-3">
        <p className="text-[13px] font-black text-gray-900">{service.title}</p>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="text-[11px] font-medium">{service.duration} min</span>
          </div>
          <span className="text-[15px] font-black text-primary">{service.price}€</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-primary">
          <span className="text-[11px] font-black">Voir le service</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </button>
  );
}

// ── Nettoyage markdown pour affichage naturel ────────────────────────────────
function cleanMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/#{1,6}\s+/g, '')       // titres # ## ###
    .replace(/\*\*(.*?)\*\*/g, '$1') // **gras**
    .replace(/\*(.*?)\*/g, '$1')     // *italique*
    .replace(/__(.*?)__/g, '$1')     // __gras__
    .replace(/_(.*?)_/g, '$1')       // _italique_
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // `code`
    .replace(/^\s*[-*+]\s+/gm, '• ') // listes → bullet simple
    .replace(/^\s*\d+\.\s+/gm, '')   // listes numérotées
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [lien](url) → texte
    .replace(/^>\s+/gm, '')          // blockquotes
    .replace(/\n{3,}/g, '\n\n')      // trop de sauts de ligne
    .trim();
}

// ── Utilitaire temps relatif ──────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return "hier";
  return `il y a ${Math.floor(diff / 86400)} jours`;
}

// ── ChatView ──────────────────────────────────────────────────────────────────
function ChatView({ conversation, currentUser, onBack, onStartCall }) {
  const navigate = useNavigate();
  // Affichage direct depuis le cache (par conversation) : les derniers messages
  // connus s'affichent immédiatement, le rafraîchissement se fait en arrière-plan.
  // Le cache ne sert qu'à l'init — le temps réel continue d'appeler setMessages normalement.
  const chatCacheKey = currentUser?.email && conversation?.conversation_id
    ? `messages_${currentUser.email}_${conversation.conversation_id}`
    : null;
  const [messages, setMessages] = useCachedState(chatCacheKey, [], c => c?.messages || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(() => !readPageCache(chatCacheKey)?.messages?.length);
  const [sending, setSending] = useState(false);
  const [serviceCardSent, setServiceCardSent] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [securityWarning, setSecurityWarning] = useState(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const msgIdsRef = useRef(new Set());
  const fileInputRef = useRef(null);
  const channelRef = useRef(null);

  const convId = conversation.conversation_id;

  // Security detection
  const detectSensitiveContent = (text) => {
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/;
    const addressRegex = /\d+\s+(rue|avenue|boulevard|chemin|impasse|allée|place|rond-point|route|bd)\s+/i;
    if (phoneRegex.test(text)) return "phone";
    if (addressRegex.test(text)) return "address";
    return null;
  };

  // Charger les messages
  const loadMessages = useCallback(async () => {
    try {
      // Charger tous les messages entre les deux personnes
      const { data: sent } = await supabase.from("MessageChat")
        .select("*")
        .eq("sender_email", currentUser.email)
        .eq("receiver_email", conversation.other_email)
        .order("created_at", { ascending: true });
      const { data: received } = await supabase.from("MessageChat")
        .select("*")
        .eq("sender_email", conversation.other_email)
        .eq("receiver_email", currentUser.email)
        .order("created_at", { ascending: true });
      const allById = {};
      for (const m of [...(sent || []), ...(received || [])]) {
        // Ignorer les signaux "typing" (contenu vide, sans pièce jointe)
        if (m.content || m.attachment_url || m.file_url) {
          // Normaliser attachment_url et file_url
          if (!m.attachment_url && m.file_url) m.attachment_url = m.file_url;
          if (!m.file_url && m.attachment_url) m.file_url = m.attachment_url;
          allById[m.id] = m;
        }
      }
      const filtered = Object.values(allById).sort((a, b) => new Date(a.created_at || a.created_date) - new Date(b.created_at || b.created_date));
      msgIdsRef.current = new Set(filtered.map(m => m.id));
      setMessages(filtered);
      // Persister en cache (clé de CETTE conversation : le composant peut
      // changer de conversation sans se démonter)
      const k = currentUser?.email && conversation?.conversation_id
        ? `messages_${currentUser.email}_${conversation.conversation_id}`
        : null;
      mergePageCache(k, { messages: filtered });
      // Mark as read — await all updates so conversations list reflects changes
      const markPromises = filtered
        .filter(m => !m.read && !m.is_read && m.receiver_email === currentUser.email)
        .map(m => supabase.from("MessageChat").update({ read: true, is_read: true }).eq("id", m.id));
      if (markPromises.length > 0) {
        await Promise.all(markPromises);
      }
    } catch (e) { console.error("[Chat] loadMessages:", e); }
    setLoading(false);
  }, [conversation.other_email, conversation.conversation_id, currentUser.email]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Auto-send service card
  useEffect(() => {
    if (!conversation.service || serviceCardSent) return;
    setServiceCardSent(true);
    supabase.from("MessageChat").insert({
      conversation_id: conversation.conversation_id,
      sender_email: currentUser.email,
      receiver_email: conversation.other_email,
      content: JSON.stringify({ type: "service_card", ...conversation.service }),
      read: false,
      is_read: false,
    }).catch(e => console.error("Service card error:", e));
  }, []);

  // Realtime
  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`chat_${conversation.conversation_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "MessageChat" }, (payload) => {
        const m = payload.new;
        if (!m) return;
        // Filtrer: seulement les messages entre ces deux personnes
        const isRelevant = (m.sender_email === currentUser.email && m.receiver_email === conversation.other_email) ||
          (m.sender_email === conversation.other_email && m.receiver_email === currentUser.email);
        if (!isRelevant) return;
        // Signal "typing" = ligne sans contenu ni pièce jointe
        if (!m.content && !m.attachment_url && !m.file_url) {
          setOtherTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
          supabase.from("MessageChat").delete().eq("id", m.id).then(() => {}, () => {});
          return;
        }
        if (msgIdsRef.current.has(m.id)) return;
        msgIdsRef.current.add(m.id);
        // Normaliser attachment_url et file_url
        if (!m.attachment_url && m.file_url) m.attachment_url = m.file_url;
        if (!m.file_url && m.attachment_url) m.file_url = m.attachment_url;
        setMessages(prev => {
          // Vérifier si le message existe déjà (optimistic insert)
          const exists = prev.some(msg => msg.id === m.id || (msg.sender_email === m.sender_email && msg.receiver_email === m.receiver_email && msg.content === m.content && msg.created_at === m.created_at));
          if (exists) return prev;
          return [...prev, m];
        });
        // Mark incoming messages as read immediately
        if (m.receiver_email === currentUser.email) {
          supabase.from("MessageChat").update({ read: true, is_read: true }).eq("id", m.id).then(() => {}, () => {});
        }
        setOtherTyping(false);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "MessageChat", filter: `conversation_id=eq.${convId}` }, (payload) => {
        const old = payload.old;
        if (old?.id) setMessages(prev => prev.filter(m => m.id !== old.id));
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); clearTimeout(typingTimeoutRef.current); };
  }, [convId, currentUser.email]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendTypingSignal = () => {
    clearTimeout(typingTimeoutRef.current);
    supabase.from("MessageChat").insert({
      conversation_id: convId, sender_email: currentUser.email,
      receiver_email: conversation.other_email, content: "", read: false,
    }).catch(() => {});
    typingTimeoutRef.current = setTimeout(() => {}, 2500);
  };

  const deleteMessage = async (msgId) => {
    await supabase.from("MessageChat").delete().eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setContextMenu(null);
  };

  const send = async (imageFile = null) => {
    if ((!input.trim() && !imageFile) || sending) return;
    clearTimeout(typingTimeoutRef.current);
    setSending(true);
    const content = input.trim();
    setInput("");

    // Check for sensitive content
    const sensitive = detectSensitiveContent(content);
    if (sensitive && !securityWarning) {
      setSecurityWarning(sensitive);
      setSending(false);
      setInput(content);
      return;
    }

    let fileUrl = "";
    if (imageFile) {
      try {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const fileName = `chat/${convId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("media").upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        fileUrl = urlData?.publicUrl || "";
      } catch (e) {
        console.error("Upload error:", e);
        try {
          fileUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          });
        } catch (e2) { console.error("Base64 error:", e2); }
      }
    }

    const now = new Date().toISOString();
    const payload = {
      conversation_id: convId,
      sender_email: currentUser.email,
      receiver_email: conversation.other_email,
      content: content || (fileUrl ? "📷 Image" : ""),
      attachment_url: fileUrl || "",
      file_url: fileUrl || "",
      is_read: false, read: false,
      created_at: now, updated_at: now,
    };

    // Optimistic insert
    const tempId = `tmp_${Date.now()}`;
    msgIdsRef.current.add(tempId);
    setMessages(prev => [...prev, { ...payload, id: tempId }]);

    const { data, error } = await supabase.from("MessageChat").insert(payload).select().single();
    if (error) {
      console.error("Send error:", error);
      msgIdsRef.current.delete(tempId);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else if (data) {
      msgIdsRef.current.add(data.id);
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    }
    setSending(false);

    // Notification
    try {
      await notifyMessageReceived({
        receiverEmail: conversation.other_email,
        senderName: currentUser.user_metadata?.full_name || emailToDisplayName(currentUser.email),
        senderEmail: currentUser.email,
        conversationId: convId,
        preview: content || (fileUrl ? "📷 Image" : ""),
      });
    } catch {}
  };

  const isReadonly = conversation.readonly;

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 z-50">
      {/* Security Warning Modal */}
      {securityWarning && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6" onClick={() => setSecurityWarning(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <h3 className="text-[16px] font-black text-gray-900 text-center mb-2">
              {securityWarning === "phone" ? "Numéro de téléphone détecté" : "Adresse détectée"}
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-4 leading-relaxed">
              Pour votre sécurité, nous vous déconseillons de partager des {securityWarning === "phone" ? "numéros de téléphone" : "adresses personnelles"} sur la plateforme. BeautyBook ne peut être tenu responsable des échanges effectués en dehors de la plateforme.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setSecurityWarning(null); setInput(""); }} className="flex-1 py-3 bg-gray-100 rounded-xl text-[13px] font-black text-gray-600">Annuler</button>
              <button onClick={() => { setSecurityWarning(null); send(); }} className="flex-1 py-3 bg-primary rounded-xl text-[13px] font-black text-white">Envoyer quand même</button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)}>
          <div className="absolute bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[160px]"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 180) }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => deleteMessage(contextMenu.msgId)} className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 transition-all">
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button onClick={onBack} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        {conversation.other_avatar ? (
          <BeautyImage src={conversation.other_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-[14px] font-black text-primary">{(conversation.other_name || "?")[0]}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-black text-gray-900 truncate">{conversation.other_name || emailToDisplayName(conversation.other_email)}</p>
          {otherTyping ? (
            <p className="text-[10px] text-primary font-bold">en train d'écrire...</p>
          ) : (
            <p className="text-[10px] text-green-500 font-bold">● En ligne</p>
          )}
        </div>
        {onStartCall && !isReadonly && (
          <button onClick={() => onStartCall({ targetEmail: conversation.other_email, targetName: conversation.other_name, targetAvatar: conversation.other_avatar })}
            className="w-9 h-9 bg-orange-50 rounded-full flex items-center justify-center border border-orange-100 active:scale-95">
            <PhoneCall className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
        {loading && messages.length === 0 ? (
          <div className="flex justify-center pt-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-primary/40" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border border-orange-100">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-black text-gray-800">Démarrez la conversation</p>
              <p className="text-[12px] text-gray-400 font-medium mt-1 px-6">Envoyez un message à {conversation.other_name || "cette personne"}</p>
            </div>
            <div className="flex gap-2 mt-2">
              {["Bonjour ! 👋", "Disponible ?", "Merci"].map(g => (
                <button key={g} onClick={() => setInput(g)}
                  className="px-4 py-2 bg-white border border-orange-200 rounded-full text-[12px] font-bold text-primary active:scale-95 transition-all shadow-sm">
                  {g}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_email === currentUser.email;
            let serviceData = null;
            try { const p = JSON.parse(m.content); if (p?.type === "service_card") serviceData = p; } catch {}
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ msgId: m.id, x: e.clientX, y: e.clientY }); }}>
                <div className={`max-w-[78%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {serviceData ? (
                    <div className="w-56"><ServiceCard service={serviceData} navigate={navigate} /></div>
                  ) : (m.attachment_url || m.file_url) ? (
                    <div>
                      <BeautyImage src={m.attachment_url || m.file_url} alt="image" className="rounded-2xl max-w-full shadow-sm max-h-64 object-cover" loading="lazy" />
                      {m.content && m.content !== "📷 Image" && (
                        <div className={`mt-1 px-3 py-2 rounded-2xl text-[13px] font-medium ${isMe ? "bg-primary text-white rounded-br-sm" : "bg-white text-gray-900 rounded-bl-sm shadow-sm"}`}>{m.content}</div>
                      )}
                    </div>
                  ) : (
                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] font-medium leading-snug ${isMe ? "bg-primary text-white rounded-br-sm" : "bg-white text-gray-900 rounded-bl-sm shadow-sm"}`}>
                      {cleanMarkdown(m.content)}
                    </div>
                  )}
                  <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                    <span className="text-[9px] text-gray-400">{timeAgo(m.created_at || m.created_date)}</span>
                    {isMe && (
                      <span className={`text-[11px] font-bold ${m.read ? "text-blue-500" : "text-gray-400"}`}>
                        {m.read ? "✓✓" : "✓✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {otherTyping && (
          <div className="flex justify-start"><div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div></div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isReadonly ? (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0"><p className="text-center text-[12px] text-gray-400">🔒 Lecture seule</p></div>
      ) : (
        <div className="px-3 py-3 border-t border-gray-100 bg-white flex items-end gap-2 shrink-0" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await send(f); e.target.value = ""; } }} />
          <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0 active:scale-95">
            <Image className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex-1 flex items-center bg-gray-100 rounded-2xl px-4 py-2.5">
            <input value={input} onChange={e => { setInput(e.target.value); if (e.target.value) sendTypingSignal(); }}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Écrire un message..." className="flex-1 bg-transparent text-[13px] text-gray-800 outline-none" />
          </div>
          <button onClick={() => send()} disabled={(!input.trim() && !sending) || sending}
            className="w-11 h-11 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-40 shrink-0">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── CallHistory ───────────────────────────────────────────────────────────────
function CallHistory({ user }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const { startCall } = useCall() || {};

  useEffect(() => {
    if (!user) return;
    const loadCalls = async () => {
      try {
        // Utiliser supabase directement au lieu de entities pour éviter les erreurs silencieuses
        const { data: asCaller, error: err1 } = await supabase
          .from("CallLog")
          .select("*")
          .eq("caller_email", user.email)
          .order("created_at", { ascending: false })
          .limit(50);

        const { data: asCallee, error: err2 } = await supabase
          .from("CallLog")
          .select("*")
          .eq("callee_email", user.email)
          .order("created_at", { ascending: false })
          .limit(50);

        if (err1) console.error("[CallHistory] Caller query error:", err1);
        if (err2) console.error("[CallHistory] Callee query error:", err2);

        const allRaw = [...(asCaller || []), ...(asCallee || [])];
        console.log("[CallHistory] Calls loaded:", allRaw.length);

        // Dédoublonner par call_id
        const byId = {};
        for (const c of allRaw) {
          const key = c.call_id || c.id;
          if (!byId[key]) byId[key] = c;
        }
        const all = Object.values(byId).sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));
        setCalls(all);
      } catch (e) {
        console.error("[CallHistory] Error:", e);
      }
      setLoading(false);
    };
    loadCalls();
  }, [user]);

  const statusConfig = {
    outgoing:  { label: "Appel émis",   color: "text-blue-500",  Icon: PhoneOutgoing },
    received:  { label: "Appel reçu",   color: "text-green-500", Icon: PhoneIncoming },
    missed:    { label: "Appel manqué", color: "text-red-500",   Icon: PhoneMissed   },
    rejected:  { label: "Appel refusé", color: "text-orange-400",Icon: PhoneMissed   },
  };

  const formatDuration = (sec) => {
    if (!sec || sec <= 0) return "";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}m${s > 0 ? s + "s" : ""}` : `${s}s`;
  };

  if (loading) {
    return (
      <div className="space-y-3 px-4 pt-4">
        {[1,2,3].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 bg-gray-100 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded-full w-1/2" />
              <div className="h-3 bg-gray-100 rounded-full w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Phone className="w-12 h-12 text-gray-200" />
        <p className="text-[14px] font-bold text-gray-400">Aucun appel</p>
        <p className="text-[12px] text-gray-300 font-medium text-center px-8">Votre historique d'appels apparaîtra ici</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {calls.map((call) => {
        const isCaller = call.caller_email === user.email;
        const otherEmail = isCaller ? call.callee_email : call.caller_email;
        const otherName  = isCaller ? (call.callee_name || emailToDisplayName(call.callee_email)) : (call.caller_name || emailToDisplayName(call.caller_email));
        const otherAvatar = isCaller ? call.callee_avatar : call.caller_avatar;

        // Status du point de vue de l'utilisateur courant
        let displayStatus = call.status;
        if (call.status === "missed" && isCaller) displayStatus = "outgoing"; // il a appelé mais pas répondu

        const cfg = statusConfig[displayStatus] || statusConfig.missed;
        const { label, color, Icon } = cfg;
        const dur = formatDuration(call.duration_sec);

        return (
          <div key={call.id} className="flex items-center gap-3 px-4 py-4">
            <div className="relative shrink-0">
              {otherAvatar ? (
                <BeautyImage src={otherAvatar} alt={otherName} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-[16px] font-black text-primary">{(otherName || "?")[0].toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-gray-800 truncate">{otherName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className={`text-[11px] font-bold ${color}`}>{label}</span>
                {dur && <span className="text-[10px] text-gray-400 font-medium">· {dur}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] text-gray-400 font-medium">
                {call.started_at
                  ? new Date(call.started_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : call.created_date ? new Date(call.created_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
              </span>
              {startCall && (
                <button
                  onClick={() => startCall({ targetEmail: otherEmail, targetName: otherName, targetAvatar: otherAvatar })}
                  className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center active:scale-95 transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-primary" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── FollowersList - Affiche les abonnés et abonnements ────────────────────────
function FollowersList({ user, onSelectConversation }) {
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("following");

  useEffect(() => {
    if (!user) return;
    loadFollows();
  }, [user]);

  const loadFollows = async () => {
    setLoading(true);
    try {
      // Load people I follow
      const { data: myFollowing, error: errFollow } = await supabase
        .from("user_follow")
        .select("*")
        .eq("follower_email", user.email);
      
      if (errFollow) console.error("[FollowersList] Following query error:", errFollow);
      
      // Load my followers
      const { data: myFollowers, error: errFollowers } = await supabase
        .from("user_follow")
        .select("*")
        .eq("followed_email", user.email);

      if (errFollowers) console.error("[FollowersList] Followers query error:", errFollowers);

      console.log("[FollowersList] Following:", myFollowing?.length, "Followers:", myFollowers?.length);

      // Get profile data for following
      if (myFollowing && myFollowing.length > 0) {
        const followingEmails = [...new Set(myFollowing.map(f => f.followed_email).filter(Boolean))];
        
        // Essayer d'abord profiles, puis ProfilPro comme fallback
        let profileMap = {};
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email, full_name, avatar_url")
          .in("email", followingEmails);
        
        (profiles || []).forEach(p => { profileMap[p.email] = p; });

        // Fallback: ProfilPro pour les noms de salon
        if (Object.keys(profileMap).length < followingEmails.length) {
          const { data: proProfiles } = await supabase
            .from("ProfilPro")
            .select("user_email, salon_name, avatar_url")
            .in("user_email", followingEmails);
          (proProfiles || []).forEach(p => {
            if (!profileMap[p.user_email]) {
              profileMap[p.user_email] = { email: p.user_email, full_name: p.salon_name, avatar_url: p.avatar_url };
            }
          });
        }
        
        setFollowing(myFollowing.map(f => ({
          email: f.followed_email,
          name: profileMap[f.followed_email]?.full_name || emailToDisplayName(f.followed_email),
          avatar: profileMap[f.followed_email]?.avatar_url || f.follower_avatar || null,
          since: f.created_at,
        })));
      } else {
        setFollowing([]);
      }

      // Get profile data for followers
      if (myFollowers && myFollowers.length > 0) {
        const followerEmails = [...new Set(myFollowers.map(f => f.follower_email).filter(Boolean))];
        
        let profileMap = {};
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email, full_name, avatar_url")
          .in("email", followerEmails);
        
        (profiles || []).forEach(p => { profileMap[p.email] = p; });

        // Fallback: ProfilPro
        if (Object.keys(profileMap).length < followerEmails.length) {
          const { data: proProfiles } = await supabase
            .from("ProfilPro")
            .select("user_email, salon_name, avatar_url")
            .in("user_email", followerEmails);
          (proProfiles || []).forEach(p => {
            if (!profileMap[p.user_email]) {
              profileMap[p.user_email] = { email: p.user_email, full_name: p.salon_name, avatar_url: p.avatar_url };
            }
          });
        }
        
        setFollowers(myFollowers.map(f => ({
          email: f.follower_email,
          name: profileMap[f.follower_email]?.full_name || emailToDisplayName(f.follower_email),
          avatar: profileMap[f.follower_email]?.avatar_url || f.follower_avatar || null,
          since: f.created_at,
        })));
      } else {
        setFollowers([]);
      }
    } catch (e) {
      console.error("[FollowersList] Error:", e);
    }
    setLoading(false);
  };

  const handleMessage = (person) => {
    const convId = [user.email, person.email].sort().join("_");
    onSelectConversation({
      conversation_id: convId,
      other_email: person.email,
      other_name: person.name,
      other_avatar: person.avatar,
    });
  };

  const displayList = activeTab === "following" ? following : followers;

  if (loading) {
    return (
      <div className="space-y-3 px-4 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 bg-gray-100 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded-full w-1/2" />
              <div className="h-3 bg-gray-100 rounded-full w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        <button 
          onClick={() => setActiveTab("following")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black border-b-2 transition-all ${activeTab === "following" ? "border-primary text-primary" : "border-transparent text-gray-400"}`}
        >
          Abonnements ({following.length})
        </button>
        <button 
          onClick={() => setActiveTab("followers")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black border-b-2 transition-all ${activeTab === "followers" ? "border-primary text-primary" : "border-transparent text-gray-400"}`}
        >
          Abonnés ({followers.length})
        </button>
      </div>

      {displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users className="w-12 h-12 text-gray-200" />
          <p className="text-[14px] font-bold text-gray-400">
            {activeTab === "following" ? "Aucun abonnement" : "Aucun abonné"}
          </p>
          <p className="text-[12px] text-gray-300 font-medium text-center px-8">
            {activeTab === "following" 
              ? "Suivez des professionnels pour les contacter ici" 
              : "Vos abonnés apparaîtront ici"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {displayList.map((person) => (
            <div key={person.email} className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-all">
              {person.avatar ? (
                <BeautyImage src={person.avatar} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-[16px] font-black text-primary">
                    {(person.name || "?")[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900 truncate">{person.name}</p>
                <p className="text-[11px] text-gray-400 font-medium truncate">{person.role === "pro" ? "Professionnel" : "Client"}</p>
              </div>
              <button
                onClick={() => handleMessage(person)}
                className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-2 rounded-full active:scale-95 transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black">Message</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { startCall } = useCall() || {};
  // Affichage direct depuis le cache : la liste des conversations s'affiche
  // immédiatement, le rafraîchissement réseau se fait en arrière-plan.
  const cacheKey = user?.email ? `messages_${user.email}` : null;
  const [conversations, setConversations] = useCachedState(cacheKey, [], c => c?.conversations || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.conversations?.length);
  const [activeConv, setActiveConv] = useState(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("messages");
  const [mariaAIActive, setMariaAIActive] = useState(() => localStorage.getItem(MARIA_AI_KEY) === "1");
  const isPro = useIsPro();
  const mariaAIRef = useRef(mariaAIActive);
  const processedMsgIds = useRef(new Set());
  const deletedConvIds = useRef(new Set());

  const handleRefresh = useCallback(() => loadConversations(), []);
  const { containerRef, pulling, pullDistance } = usePullToRefresh(handleRefresh);

  // Détection pro centralisée (hooks/useIsPro.js) — remplace la vérification locale.

  // Sync mariaAIRef avec l'état
  useEffect(() => {
    mariaAIRef.current = mariaAIActive;
    localStorage.setItem(MARIA_AI_KEY, mariaAIActive ? "1" : "0");
  }, [mariaAIActive]);

  // Écouter les nouveaux messages entrants pour Maria AI
  useEffect(() => {
    if (!user) return;
    let proProfileCache = null;
    let cancelled = false;

    // Load pro profile once for context
    entities.ProfilPro.filter({ user_email: user.email }, '-created_at', 1)
      .then(res => { if (!cancelled) proProfileCache = res[0] || null; })
      .catch(() => {});

    // ── Logique de réponse auto (réutilisable par realtime + polling) ──
    const processAutoReply = async (m) => {
      if (!m || cancelled) return;
      if (m.receiver_email !== user.email) return;
      if (!m.content && !m.attachment_url && !m.file_url) return;
      if (m.sender_email === user.email) return; // ne jamais répondre à ses propres messages (anti-boucle)
      if (processedMsgIds.current.has(m.id)) return;
      if (!mariaAIRef.current) return;
      if (deletedConvIds.current.has(m.conversation_id)) return;

      processedMsgIds.current.add(m.id);

      const delay = 600 + Math.random() * 400;
      setTimeout(async () => {
        if (cancelled || !mariaAIRef.current) return;
        try {
          const convId = m.conversation_id;
          const clientName = m.sender_name || emailToDisplayName(m.sender_email);

          // Vérifier qu'aucune réponse n'a déjà été envoyée après ce message
          const { data: newer } = await supabase
            .from("MessageChat")
            .select("id")
            .eq("conversation_id", convId)
            .eq("sender_email", user.email)
            .gt("created_at", m.created_at)
            .limit(1);
          if (newer && newer.length > 0) return; // déjà répondu

          // Fetch recent conversation history for context
          const { data: history } = await supabase
            .from("MessageChat")
            .select("content, sender_email")
            .eq("conversation_id", convId)
            .order("created_at", { ascending: false })
            .limit(10);

          const conversationHistory = (history || []).reverse();

          const mariaReply = await generateAutoReply({
            clientMessage: m.content,
            clientName,
            proProfile: proProfileCache,
            conversationHistory,
          });

          const { error } = await supabase.from("MessageChat").insert({
            conversation_id: convId,
            sender_email: user.email,
            receiver_email: m.sender_email,
            content: mariaReply,
            is_read: true,
            read: true,
          });
          if (error) console.error("Maria AI reply error:", error);
          else loadConversations();
        } catch (e) {
          console.error("Maria AI reply error:", e);
        }
      }, delay);
    };

    const channelName = `maria-ai-autoreply-${user.email}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'MessageChat' },
        async (payload) => { await processAutoReply(payload.new); }
      )
      .subscribe();

    // ── Polling de secours (si le realtime ne capte pas) : toutes les 30s ──
    const pollInterval = setInterval(async () => {
      if (cancelled || !mariaAIRef.current || !isPro) return;
      try {
        const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 dernières minutes
        const { data: recent } = await supabase
          .from("MessageChat")
          .select("*")
          .eq("receiver_email", user.email)
          .gt("created_at", since)
          .order("created_at", { ascending: true })
          .limit(20);
        for (const m of (recent || [])) {
          await processAutoReply(m);
        }
      } catch (e) {
        console.error("Maria AI poll error:", e);
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user, isPro]);

  const loadConversations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load all messages where user is sender or receiver
      const { data: sent, error: sentError } = await supabase
        .from("MessageChat")
        .select("*")
        .eq("sender_email", user.email)
        .order("created_at", { ascending: false })
        .limit(200);
      
      const { data: received, error: receivedError } = await supabase
        .from("MessageChat")
        .select("*")
        .eq("receiver_email", user.email)
        .order("created_at", { ascending: false })
        .limit(200);

      if (sentError) console.error("[Messages] sent error:", sentError);
      if (receivedError) console.error("[Messages] received error:", receivedError);

      const allMessages = [...(sent || []), ...(received || [])];
      console.log("[Messages] Total messages loaded:", allMessages.length);

      // Grouper par l'autre personne (pas par conversation_id)
      const convMap = {};
      for (const m of allMessages) {
        // Skip typing signals (contenu vide, sans pièce jointe)
        if (!m.content && !m.attachment_url && !m.file_url) continue;
        
        const otherEmail = m.sender_email === user.email ? m.receiver_email : m.sender_email;
        if (!otherEmail) continue;
        
        if (!convMap[otherEmail] || new Date(m.created_at || m.created_date) > new Date(convMap[otherEmail].created_at || convMap[otherEmail].created_date)) {
          convMap[otherEmail] = m;
        }
      }

      const convs = Object.entries(convMap).map(([otherEmail, m]) => {
        const isMe = m.sender_email === user.email;
        const otherName = isMe ? (m.receiver_name || emailToDisplayName(otherEmail)) : (m.sender_name || emailToDisplayName(otherEmail));
        const otherAvatar = isMe ? (m.receiver_avatar || null) : (m.sender_avatar || null);
        
        // Count unread messages from this person
        const unread = allMessages.filter(msg =>
          !msg.read && !msg.is_read &&
          msg.receiver_email === user.email &&
          msg.sender_email === otherEmail &&
          (msg.content || msg.attachment_url || msg.file_url)
        ).length;
        
        let lastMessage = m.content || "";
        try { 
          const p = JSON.parse(m.content); 
          if (p?.type === "service_card") lastMessage = `✂️ ${p.title} — ${p.price}€`; 
        } catch {}
        if (m.attachment_url || m.file_url) lastMessage = "📷 Image";
        
        return {
          conversation_id: [user.email, otherEmail].sort().join("_"),
          other_email: otherEmail,
          other_name: otherName, 
          other_avatar: otherAvatar,
          last_message: lastMessage, 
          last_date: m.created_at || m.created_date, 
          unread,
        };
      });

      convs.sort((a, b) => new Date(b.last_date) - new Date(a.last_date));
      setConversations(convs);
      mergePageCache(cacheKey, { conversations: convs });
    } catch (e) { 
      console.error("[Messages] loadConversations error:", e); 
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  // Temps réel sur la liste des conversations
  useEffect(() => {
    if (!user) return;
    const unsub = entities.MessageChat.subscribe((event) => {
      if (event.type === "create") {
        const m = event.data;
        if (m.sender_email !== user.email && m.receiver_email !== user.email) return;
        // Rafraîchir la liste
        loadConversations();
      }
    });
    return unsub;
  }, [user]);

  // Ouvrir directement une conv si ?to= dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const toEmail = params.get("to");
    const toName = params.get("name");
    const serviceId = params.get("service_id");
    const serviceTitle = params.get("service");
    const servicePrice = params.get("service_price");
    const serviceImg = params.get("service_img");
    const serviceDuration = params.get("service_duration");
    const readonly = params.get("readonly") === "1";
    if (toEmail && user) {
      const convId = [user.email, toEmail].sort().join("_");
      setActiveConv({
        conversation_id: convId,
        other_email: toEmail,
        other_name: toName ? decodeURIComponent(toName) : toEmail,
        other_avatar: null,
        readonly,
        service: serviceId ? {
          id: serviceId,
          title: serviceTitle ? decodeURIComponent(serviceTitle) : "",
          price: servicePrice ? Number(servicePrice) : 0,
          image_url: serviceImg ? decodeURIComponent(serviceImg) : "",
          duration: serviceDuration ? Number(serviceDuration) : 60,
        } : null,
      });
    }
  }, [location.search, user]);

  const deleteConversation = async (conversationId) => {
    // Ne supprimer que les messages où l'utilisateur est sender ou receiver
    const [sent, received] = await Promise.all([
      entities.MessageChat.filter({ conversation_id: conversationId, sender_email: user.email }, null, 200).catch(() => []),
      entities.MessageChat.filter({ conversation_id: conversationId, receiver_email: user.email }, null, 200).catch(() => []),
    ]);
    const allById = {};
    for (const m of [...sent, ...received]) allById[m.id] = m;
    await Promise.all(Object.values(allById).map(m => entities.MessageChat.delete(m.id).catch(() => {})));
    deletedConvIds.current.add(conversationId);
    setConversations(prev => prev.filter(c => c.conversation_id !== conversationId));
  };

  const filtered = conversations.filter(c =>
    (c.other_name || c.other_email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (activeConv) {
    return <ChatView conversation={activeConv} currentUser={user} onBack={() => { setActiveConv(null); setTimeout(() => loadConversations(), 300); }} onStartCall={startCall} />;
  }

  return (
    <div ref={containerRef} className="font-display bg-white min-h-full flex flex-col">
      {pullDistance > 10 && (
        <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance * 0.5 }}>
          <div className={`w-6 h-6 border-2 border-primary border-t-transparent rounded-full ${pulling ? "animate-spin" : ""}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white sticky top-0 z-10 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900 flex-1">Messagerie</h1>
        <div className="flex items-center gap-2">
          {tab === "messages" && conversations.some(c => c.unread > 0) && (
            <span className="bg-primary text-white text-[11px] font-black px-2.5 py-1 rounded-full">
              {conversations.reduce((s, c) => s + (c.unread || 0), 0)} non lus
            </span>
          )}
          {isPro && <MariaAIToggle active={mariaAIActive} onChange={setMariaAIActive} />}
        </div>
      </div>

      {/* Bandeau Réponse auto actif */}
      {isPro && mariaAIActive && (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-100">
          <div className="w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <p className="text-[11px] font-bold text-violet-700">
            Réponse auto active — vos clients reçoivent une réponse immédiate
          </p>
          <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse ml-auto shrink-0" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        <button onClick={() => setTab("messages")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black border-b-2 transition-all ${tab === "messages" ? "border-primary text-primary" : "border-transparent text-gray-400"}`}>
          <MessageSquare className="w-4 h-4" /> Messages
        </button>
        <button onClick={() => setTab("contacts")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black border-b-2 transition-all ${tab === "contacts" ? "border-primary text-primary" : "border-transparent text-gray-400"}`}>
          <Users className="w-4 h-4" /> Contacts
        </button>
        <button onClick={() => setTab("calls")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black border-b-2 transition-all ${tab === "calls" ? "border-primary text-primary" : "border-transparent text-gray-400"}`}>
          <Phone className="w-4 h-4" /> Appels
        </button>
      </div>

      {tab === "messages" && (
        <>
          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une conversation..."
                className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
              />
            </div>
          </div>
          <ConversationList
            conversations={filtered}
            loading={loading}
            onSelect={setActiveConv}
            onDelete={deleteConversation}
          />
        </>
      )}

      {tab === "contacts" && (
        <FollowersList 
          user={user} 
          onSelectConversation={(conv) => {
            setActiveConv(conv);
            setTab("messages");
          }} 
        />
      )}

      {tab === "calls" && <CallHistory user={user} />}
    </div>
  );
}
