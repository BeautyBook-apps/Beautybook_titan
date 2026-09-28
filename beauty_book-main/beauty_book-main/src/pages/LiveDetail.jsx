import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  X, Send, Users, Heart, Volume2, VolumeX, Loader2,
  Camera, CameraOff, Mic, MicOff, ShoppingBag, Tag, Package, Scissors,
  Share2, PhoneOff, Signal
} from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { readPageCache, mergePageCache, useCachedState } from "@/hooks/usePageCache";
import { useFollow } from "@/hooks/useFollow";

const PRIMARY = "#f97316";
const PRIMARY_ALPHA = "rgba(249,115,22,";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

// Un live est considéré comme fantôme si l'hôte n'a pas envoyé de
// pulsation depuis plus de 2 minutes (ex : page fermée sans "Terminer").
export const LIVE_STALE_MS = 2 * 60 * 1000;
export function isLiveFresh(session) {
  if (!session || session.status !== "live") return false;
  const ts = session.updated_at || session.created_at;
  if (!ts) return true;
  return Date.now() - new Date(ts).getTime() < LIVE_STALE_MS;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return (h > 0 ? h + ":" : "") + mm + ":" + String(s).padStart(2, "0");
}

// ── Shop Sheet ────────────────────────────────────────────────────────────────
function ShopSheet({ onClose, proEmail, onFeature }) {
  const [tab, setTab] = useState("produits");
  const [produits, setProduits] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    Promise.all([
      entities.Produit.filter({ status: "actif" }, "-created_at", 200).catch(() => []),
      entities.Service.filter({ pro_email: proEmail, status: "actif" }, "-created_at", 20).catch(() => []),
    ]).then(([p, s]) => { setProduits(p || []); setServices(s || []); }).catch(() => {}).finally(() => setLoading(false));
  }, [proEmail]);

  const items = tab === "produits" ? produits : services;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="rounded-t-3xl flex flex-col max-h-[80vh]" style={{ background: "#1a1a2e" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 pb-3">
          <h3 className="text-white text-[16px] font-black">Mettre en avant</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-white/60" /></button>
        </div>
        <div className="flex gap-1 mx-4 mb-3 bg-white/5 rounded-2xl p-1">
          {[{ key: "produits", label: "Produits", Icon: Package }, { key: "services", label: "Services", Icon: Scissors }].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black transition-all ${tab === key ? "bg-orange-500 text-white" : "text-white/50"}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2 hide-scrollbar">
          {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-white/20 border-t-orange-500 rounded-full animate-spin" /></div>}
          {!loading && items.length === 0 && (
            <p className="text-white/40 text-[12px] text-center py-8">Aucun élément actif pour le moment.</p>
          )}
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 shrink-0">
                {(item.image_url || item.images?.[0])
                  ? <BeautyImage src={item.image_url || item.images[0]} alt={item.name || item.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-white/20" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[13px] font-black truncate">{item.name || item.title}</p>
                <p className="text-orange-400 text-[13px] font-black">{item.price} €</p>
              </div>
              <button onClick={() => { const next = featured?.id === item.id ? null : item; setFeatured(next); onFeature(next); }}
                className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 ${featured?.id === item.id ? "bg-green-500 text-white" : "bg-white/10 text-white"}`}>
                {featured?.id === item.id ? "✓ Actif" : "Afficher"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Featured Product Overlay ──────────────────────────────────────────────────
function FeaturedProductOverlay({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="absolute bottom-24 left-3 z-30 w-52">
      <div className="rounded-2xl overflow-hidden p-2.5" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", border: `1px solid ${PRIMARY_ALPHA}0.2)` }}>
        <div className="flex items-center gap-1.5 pb-1.5">
          <Tag className="w-3 h-3" style={{ color: PRIMARY }} />
          <span className="text-white/60 text-[9px] font-black uppercase tracking-widest">Produit en avant</span>
        </div>
        <div className="flex items-center gap-2.5">
          {(item.image_url || item.images?.[0]) && (
            <BeautyImage src={item.image_url || item.images[0]} alt={item.name || item.title} className="w-11 h-11 rounded-xl object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[11px] font-black truncate">{item.name || item.title}</p>
            <p className="text-orange-400 text-[12px] font-black">{item.price} €</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-white/40" /></button>
        </div>
      </div>
    </div>
  );
}

// ── Floating hearts ───────────────────────────────────────────────────────────
function FloatingHearts({ hearts }) {
  return (
    <div className="absolute bottom-24 right-4 z-20 pointer-events-none" style={{ width: 60, height: 220 }}>
      {hearts.map(h => (
        <div key={h.id} className="absolute bottom-0"
          style={{
            left: h.x, animation: "live-heart-float 1.6s ease-out forwards",
          }}>
          <Heart className="w-7 h-7" style={{ color: "#ef4444", fill: "#ef4444", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }} />
        </div>
      ))}
      <style>{`@keyframes live-heart-float {
        0% { transform: translateY(0) scale(0.6); opacity: 0; }
        15% { opacity: 1; transform: translateY(-20px) scale(1.1); }
        100% { transform: translateY(-190px) scale(0.9) rotate(${Math.random() > 0.5 ? "" : "-"}12deg); opacity: 0; }
      }`}</style>
    </div>
  );
}

// ── Host Controls ─────────────────────────────────────────────────────────────
function HostControls({ cameraOn, micOn, onToggleCamera, onToggleMic, onShop, onStop, connOk }) {
  const controls = [
    { label: "Caméra", icon: cameraOn ? Camera : CameraOff, danger: !cameraOn, action: onToggleCamera },
    { label: "Micro", icon: micOn ? Mic : MicOff, danger: !micOn, action: onToggleMic },
    { label: "Boutique", icon: ShoppingBag, action: onShop },
  ];

  return (
    <div className="absolute right-2 flex flex-col items-center gap-1.5" style={{ top: 84, zIndex: 25 }}>
      {/* Indicateur de diffusion */}
      <div className="flex flex-col items-center gap-0.5 mb-1">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: connOk ? "rgba(16,185,129,0.9)" : "rgba(239,68,68,0.9)" }}>
          <Signal className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-[7px] font-black uppercase tracking-wider">{connOk ? "En ligne" : "Connexion"}</span>
      </div>
      {controls.map(({ label, icon: Icon, danger, action }) => (
        <button key={label} onClick={action} className="flex flex-col items-center gap-0.5 active:scale-95 transition-all">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: danger ? "#ef4444" : "rgba(30,37,53,0.95)", backdropFilter: "blur(8px)" }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[7px] font-black uppercase tracking-wider">{label}</span>
        </button>
      ))}
      <div className="w-6 border-t border-white/10 my-0.5" />
      <button onClick={onStop} className="flex flex-col items-center gap-0.5 active:scale-95 transition-all">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "#ef4444" }}>
          <PhoneOff className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-[7px] font-black uppercase tracking-wider">Terminer</span>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function LiveDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const cacheKey = id ? `live_${id}` : null;
  const [session, setSession] = useCachedState(cacheKey, null, c => c?.session ?? null);
  const [comments, setComments] = useCachedState(cacheKey, [], c => c?.comments || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.session);
  const [viewers, setViewers] = useState(() => readPageCache(cacheKey)?.session?.viewers || 0);
  const [muted, setMuted] = useState(false);
  const [connStatus, setConnStatus] = useState("connecting");
  const [duration, setDuration] = useState(0);

  const [isHost, setIsHost] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [featuredItem, setFeaturedItem] = useState(null);
  const [showShop, setShowShop] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [ending, setEnding] = useState(false);

  const bottomRef = useRef(null);
  const videoRef = useRef(null);
  const hostPeersRef = useRef({});
  const localStreamRef = useRef(null);
  const viewerPcRef = useRef(null);
  const callIdRef = useRef(null);
  const signalUnsubRef = useRef(null);
  const processedSignalsRef = useRef(new Set());
  const retryCountRef = useRef(0);
  const connectFnRef = useRef(null);
  const heartIdRef = useRef(0);
  const endingRef = useRef(false);

  const { followed, toggle: toggleFollow } = useFollow(session?.host_email);

  const spawnHeart = useCallback(() => {
    const hid = ++heartIdRef.current;
    const x = 8 + Math.random() * 32;
    setHearts(prev => [...prev.slice(-14), { id: hid, x }]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== hid)), 1700);
  }, []);

  // ── Load session ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const key = `live_${id}`;
    const cached = readPageCache(key);
    if (cached?.session) {
      setSession(cached.session);
      setViewers(cached.session.viewers || 0);
      setComments(cached.comments || []);
      setLoading(false);
    } else {
      setSession(null);
      setLoading(true);
    }
    setIsHost(false);
    const load = async () => {
      let found = null;
      try {
        found = await entities.LiveSession.get(id).catch(() => null);
      } catch {}
      setSession(found);
      setViewers(found?.viewers || 0);
      if (found && user?.email && found.host_email === user.email) setIsHost(true);
      mergePageCache(key, { session: found });
      setLoading(false);
    };
    load();
  }, [id, user?.email]);

  // ── Durée du live ───────────────────────────────────────────────────────────
  useEffect(() => {
    const start = session?.started_at || session?.created_at;
    if (!start) return;
    const t0 = new Date(start).getTime();
    const tick = () => setDuration(Math.max(0, Math.floor((Date.now() - t0) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.started_at, session?.created_at]);

  // ── Realtime session updates ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const unsub = entities.LiveSession.subscribe((event) => {
      const evId = event.data?.id || event.id;
      if (evId !== id) return;
      if (event.type === "delete" || event.data?.status === "ended") {
        if (!endingRef.current) navigate("/live");
        return;
      }
      if (event.data) {
        setSession(prev => {
          const next = prev ? { ...prev, ...event.data } : event.data;
          mergePageCache(`live_${id}`, { session: next });
          return next;
        });
        if (typeof event.data.viewers === "number") setViewers(event.data.viewers);
      }
    });
    return () => unsub();
  }, [id, navigate]);

  // ── Realtime messages (commentaires + likes) ────────────────────────────────
  useEffect(() => {
    if (!id) return;
    entities.LiveMessage.filter({ session_id: id }, "created_at", 80)
      .then(items => {
        const list = items || [];
        setComments(list.filter(m => m.type === "text" || m.type === "system"));
        const nLikes = list.filter(m => m.type === "like").length;
        setLikeCount(nLikes);
        mergePageCache(`live_${id}`, { comments: list.filter(m => m.type === "text" || m.type === "system") });
      })
      .catch(() => {});
    const unsub = entities.LiveMessage.subscribe((event) => {
      if (event.data?.session_id !== id || event.type !== "create") return;
      if (event.data.type === "like") {
        setLikeCount(c => c + 1);
        // Pas d'animation pour mes propres likes (déjà jouée au tap).
        if (event.data.sender_email !== user?.email) spawnHeart();
        return;
      }
      if (event.data.type === "text" || event.data.type === "system") {
        setComments(c => [...c.slice(-79), event.data]);
      }
    });
    return () => unsub();
  }, [id, user?.email, spawnHeart]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // ══════════════════════════════════════════════════════════════════════════════
  // HOST MODE — corrigé : déduplication des offres, intervalles nettoyés,
  // pulsation anti-fantôme, compteur de spectateurs unique (côté hôte).
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isHost || !id || !user?.email) return;

    let stream = null;
    let offerPoller = null;
    let heartbeat = null;
    let disposed = false;
    processedSignalsRef.current = new Set();

    const pushViewers = () => {
      if (disposed || endingRef.current) return;
      const count = Object.keys(hostPeersRef.current).length;
      setViewers(count);
      // La mise à jour rafraîchit aussi `updated_at` : pulsation anti-fantôme.
      entities.LiveSession.update(id, { viewers: count }).catch(() => {});
    };

    const handleSignal = async (sig) => {
      if (!sig || sig.callee_email !== user.email) return;
      if (!sig.call_id?.startsWith("live_" + id)) return;
      // Déduplication : une offre déjà traitée ne doit jamais être rejouée.
      if (sig.id && processedSignalsRef.current.has(sig.id)) return;
      if (sig.id) processedSignalsRef.current.add(sig.id);
      const viewerEmail = sig.caller_email;

      if (sig.type === "offer") {
        if (hostPeersRef.current[viewerEmail]) {
          try { hostPeersRef.current[viewerEmail].close(); } catch {}
          delete hostPeersRef.current[viewerEmail];
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" });
        hostPeersRef.current[viewerEmail] = pc;

        (localStreamRef.current?.getTracks() || []).forEach(track => {
          try { pc.addTrack(track, localStreamRef.current); } catch {}
        });

        pc.onicecandidate = (e) => {
          if (!e.candidate) return;
          entities.CallSignal.create({
            call_id: sig.call_id, caller_email: user.email, callee_email: viewerEmail,
            type: "ice-candidate", payload: JSON.stringify(e.candidate), status: "accepted",
          }).catch(() => {});
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
            try { pc.close(); } catch {}
            if (hostPeersRef.current[viewerEmail] === pc) {
              delete hostPeersRef.current[viewerEmail];
              pushViewers();
            }
          }
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await entities.CallSignal.create({
            call_id: sig.call_id, caller_email: user.email, callee_email: viewerEmail,
            type: "answer", payload: JSON.stringify(pc.localDescription), status: "accepted",
          }).catch(() => {});
          pushViewers();
        } catch (err) {
          console.error("Host answer error:", err);
        }
      }

      if (sig.type === "ice-candidate" && hostPeersRef.current[viewerEmail]) {
        try { await hostPeersRef.current[viewerEmail].addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload))); } catch {}
      }

      if (sig.type === "end" && hostPeersRef.current[viewerEmail]) {
        try { hostPeersRef.current[viewerEmail].close(); } catch {}
        delete hostPeersRef.current[viewerEmail];
        pushViewers();
      }
    };

    const pollOffers = async () => {
      if (disposed || endingRef.current) return;
      try {
        const recent = await entities.CallSignal.filter({ callee_email: user.email }, "-created_at", 20);
        const liveOffers = (recent || []).filter(s => s.call_id?.startsWith("live_" + id) && (s.type === "offer" || s.type === "ice-candidate" || s.type === "end"));
        for (const sig of liveOffers) await handleSignal(sig);
      } catch {}
    };

    const startHost = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (err) {
          console.error("Camera error:", err);
          setConnStatus("error");
          return;
        }
      }
      if (disposed) { stream.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setConnStatus("connected");

      pollOffers();
      offerPoller = setInterval(pollOffers, 2500);
      // Pulsation : le live reste "frais" même sans mouvement de spectateurs.
      heartbeat = setInterval(pushViewers, 20000);

      signalUnsubRef.current = entities.CallSignal.subscribe(async (event) => {
        if (event.type !== "create" || disposed) return;
        await handleSignal(event.data);
      });
    };

    const handleUnload = () => {
      // Meilleur effort : marquer le live comme terminé à la fermeture
      // (la pulsation anti-fantôme prend le relais dans tous les cas).
      try {
        supabase.from("LiveSession")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", id).then(() => {}, () => {});
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);

    startHost();

    return () => {
      disposed = true;
      window.removeEventListener("beforeunload", handleUnload);
      if (offerPoller) clearInterval(offerPoller);
      if (heartbeat) clearInterval(heartbeat);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (signalUnsubRef.current) { signalUnsubRef.current(); signalUnsubRef.current = null; }
      Object.values(hostPeersRef.current).forEach(pc => { try { pc.close(); } catch {} });
      hostPeersRef.current = {};
    };
  }, [isHost, id, user?.email]);

  useEffect(() => {
    if (!isHost || !localStream) return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = localStream;
    video.muted = true;
    video.play().catch(() => {});
  }, [isHost, localStream]);

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEWER MODE — corrigé : intervalles nettoyés, handshake plus rapide,
  // compteur de spectateurs géré uniquement par l'hôte.
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isHost || loading || !session || !user?.email) return;

    const hostEmail = session.host_email;
    if (!hostEmail) return;

    const myEmail = user.email;
    const callId = "live_" + id + "_" + myEmail.replace(/[^a-z0-9]/gi, "_");
    callIdRef.current = callId;

    let disposed = false;
    let answerPoller = null;
    let retryTimer = null;
    retryCountRef.current = 0;
    const maxRetries = 8;

    const applyHostSignal = async (sig) => {
      if (disposed || !sig || sig.call_id !== callId || sig.callee_email !== myEmail) return;
      const pc = viewerPcRef.current;
      if (!pc || pc.signalingState === "closed") return;
      if (sig.type === "answer" && pc.signalingState === "have-local-offer") {
        try { await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload))); } catch {}
      }
      if (sig.type === "ice-candidate") {
        try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload))); } catch {}
      }
    };

    const pollAnswer = async () => {
      if (disposed) return;
      const pc = viewerPcRef.current;
      if (!pc || pc.signalingState !== "have-local-offer") return;
      try {
        const sigs = await entities.CallSignal.filter({ call_id: callId, callee_email: myEmail }, "-created_at", 20);
        for (const sig of (sigs || [])) await applyHostSignal(sig);
      } catch {}
    };

    const connect = async () => {
      if (disposed) return;
      if (viewerPcRef.current) { try { viewerPcRef.current.close(); } catch {} viewerPcRef.current = null; }
      if (signalUnsubRef.current) { signalUnsubRef.current(); signalUnsubRef.current = null; }
      if (answerPoller) { clearInterval(answerPoller); answerPoller = null; }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      viewerPcRef.current = pc;
      setConnStatus("connecting");

      pc.ontrack = (event) => {
        if (disposed || !event.streams?.[0]) return;
        const stream = event.streams[0];
        const video = videoRef.current;
        if (!video) return;
        if (video.srcObject !== stream) video.srcObject = stream;
        video.muted = muted;
        video.play().catch(() => {});
        setConnStatus("connected");
      };

      pc.onconnectionstatechange = () => {
        if (disposed) return;
        const state = pc.connectionState;
        if (state === "connected") { setConnStatus("connected"); retryCountRef.current = 0; }
        else if (state === "failed" || state === "disconnected") {
          setConnStatus("connecting");
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            retryTimer = setTimeout(connect, 2000);
          } else {
            setConnStatus("error");
          }
        }
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate || disposed) return;
        entities.CallSignal.create({
          call_id: callId, caller_email: myEmail, callee_email: hostEmail,
          type: "ice-candidate", payload: JSON.stringify(e.candidate), status: "ringing",
        }).catch(() => {});
      };

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        await entities.CallSignal.create({
          call_id: callId, caller_email: myEmail, callee_email: hostEmail,
          type: "offer", payload: JSON.stringify(pc.localDescription), status: "ringing",
        }).catch(() => {});
      } catch (err) {
        console.error("Offer error:", err);
        return;
      }

      signalUnsubRef.current = entities.CallSignal.subscribe(async (event) => {
        if (event.type !== "create" || disposed) return;
        await applyHostSignal(event.data);
      });

      // Handshake rapide : sondages rapprochés au début, puis réguliers.
      pollAnswer();
      setTimeout(pollAnswer, 800);
      setTimeout(pollAnswer, 1800);
      setTimeout(pollAnswer, 3200);
      answerPoller = setInterval(pollAnswer, 2500);
    };

    connectFnRef.current = connect;
    connect();

    return () => {
      disposed = true;
      if (answerPoller) clearInterval(answerPoller);
      if (retryTimer) clearTimeout(retryTimer);
      if (viewerPcRef.current) { try { viewerPcRef.current.close(); } catch {} viewerPcRef.current = null; }
      if (signalUnsubRef.current) { signalUnsubRef.current(); signalUnsubRef.current = null; }
      entities.CallSignal.create({
        call_id: callId, caller_email: myEmail, callee_email: hostEmail,
        type: "end", payload: "", status: "ended",
      }).catch(() => {});
    };
  }, [isHost, loading, session?.id, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (videoRef.current && !isHost) videoRef.current.muted = muted;
  }, [muted, isHost]);

  // Verrouille le scroll du body pendant le live
  useEffect(() => {
    const prev = { overflow: document.body.style.overflow, position: document.body.style.position, width: document.body.style.width };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.width = prev.width;
    };
  }, []);

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !cameraOn; });
      setCameraOn(c => !c);
    }
  };
  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !micOn; });
      setMicOn(c => !c);
    }
  };

  const stopLive = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    Object.values(hostPeersRef.current).forEach(pc => { try { pc.close(); } catch {} });
    hostPeersRef.current = {};
    if (id) {
      await entities.LiveSession.update(id, { status: "ended", ended_at: new Date().toISOString(), viewers: 0 }).catch(() => {});
    }
    navigate("/profil-pro");
  };

  const send = async () => {
    if (!input.trim() || !user) return;
    const msg = input.trim();
    setInput("");
    await entities.LiveMessage.create({
      session_id: id, sender_email: user.email, sender_name: user.full_name || user.email,
      sender_avatar: user.avatar_url || null, content: msg, type: "text",
    }).catch(() => {});
  };

  const sendLike = async () => {
    if (!user || !id) return;
    spawnHeart();
    await entities.LiveMessage.create({
      session_id: id, sender_email: user.email, sender_name: user.full_name || user.email,
      sender_avatar: user.avatar_url || null, content: "❤", type: "like",
    }).catch(() => {});
  };

  const shareLive = async () => {
    const url = window.location.href;
    const text = session?.title ? `Regarde ce direct : ${session.title}` : "Regarde ce direct sur BeautyBook";
    try {
      if (navigator.share) {
        await navigator.share({ title: "BeautyBook Live", text, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  };

  const videoVisible = connStatus === "connected";
  const liveFresh = isLiveFresh(session);

  const content = (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", background: "#000", zIndex: 9999, overflow: "hidden", touchAction: "pan-y" }}>

      {/* Fond flouté */}
      {session?.host_avatar
        ? <BeautyImage src={session.host_avatar} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2, filter: "blur(20px)", transform: "scale(1.1)" }} />
        : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #f97316 0%, #000 100%)" }} />
      }

      {/* Vidéo */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: videoVisible ? 1 : 0, transition: "opacity 0.5s ease", zIndex: 1 }}
      />

      {/* Dégradé */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)", pointerEvents: "none", zIndex: 2 }} />

      {/* Caméra hôte coupée */}
      {isHost && !cameraOn && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 3 }}>
          <CameraOff style={{ width: 64, height: 64, color: "rgba(255,255,255,0.2)" }} />
        </div>
      )}

      {/* Spectateur : attente de connexion */}
      {!loading && session && !isHost && liveFresh && connStatus !== "connected" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 16, zIndex: 10 }}>
          {session.host_avatar
            ? <BeautyImage src={session.host_avatar} alt={session.host_name} style={{ width: 112, height: 112, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.5)", objectFit: "cover" }} />
            : <div style={{ width: 112, height: 112, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 44, fontWeight: 900 }}>{(session.host_name || "P")[0]}</span>
              </div>
          }
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.9)", borderRadius: 999, padding: "6px 16px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulse 2s infinite" }} />
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em" }}>EN DIRECT</span>
          </div>
          <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 16, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)" }}>
            <Loader2 style={{ width: 16, height: 16, color: "#fff", animation: "spin 1s linear infinite" }} />
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {connStatus === "error" ? "Connexion impossible" : "Connexion au live..."}
            </span>
          </div>
          {connStatus === "error" && (
            <button onClick={() => { setConnStatus("connecting"); retryCountRef.current = 0; if (connectFnRef.current) connectFnRef.current(); }}
              style={{ background: PRIMARY, color: "#fff", borderRadius: 16, padding: "8px 16px", fontSize: 12, fontWeight: 900, border: "none", cursor: "pointer", pointerEvents: "auto" }}>
              Réessayer
            </button>
          )}
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30 }}>
          <div style={{ width: 32, height: 32, border: "4px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {/* Introuvable / terminé */}
      {!loading && (!session || !liveFresh) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 32px", textAlign: "center", zIndex: 30 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: 28, height: 28, color: "rgba(255,255,255,0.4)" }} />
          </div>
          <p style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>Ce direct est terminé</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>L'hôte a mis fin à la diffusion.</p>
          <button onClick={() => navigate("/live")} style={{ background: PRIMARY, color: "#fff", borderRadius: 999, padding: "10px 24px", fontSize: 13, fontWeight: 900, border: "none", cursor: "pointer" }}>
            Voir les autres directs
          </button>
        </div>
      )}

      {session && liveFresh && (
        <>
          {/* ── Barre du haut ── */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", paddingTop: "max(14px, env(safe-area-inset-top, 14px))", background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)", zIndex: 20 }}>
            {!isHost && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                {session.host_avatar
                  ? <BeautyImage src={session.host_avatar} alt={session.host_name} style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #fff", objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #fff", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>{(session.host_name || "P")[0]}</span>
                    </div>
                }
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 900, lineHeight: "1.2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.host_name || "Professionnel"}</p>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</p>
                </div>
              </div>
            )}
            {isHost && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ef4444", borderRadius: 999, padding: "5px 12px", boxShadow: "0 0 16px rgba(239,68,68,0.5)" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "pulse 1.5s infinite" }} />
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>En direct</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "5px 12px", backdropFilter: "blur(8px)" }}>
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatDuration(duration)}</span>
                </div>
              </div>
            )}
            {!isHost && (
              <button onClick={toggleFollow}
                style={{ flexShrink: 0, borderRadius: 999, padding: "7px 14px", fontSize: 11, fontWeight: 900, background: followed ? "rgba(255,255,255,0.2)" : PRIMARY, color: "#fff", border: "none", cursor: "pointer" }}>
                {followed ? "Abonné ✓" : "+ Suivre"}
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {!isHost && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ef4444", borderRadius: 999, padding: "5px 10px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulse 2s infinite" }} />
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>LIVE</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.45)", borderRadius: 999, padding: "5px 10px", backdropFilter: "blur(8px)" }}>
                <Users style={{ width: 12, height: 12, color: "rgba(255,255,255,0.7)" }} />
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{viewers}</span>
              </div>
              {!isHost && (
                <button onClick={() => setMuted(m => !m)} style={{ width: 34, height: 34, background: "rgba(0,0,0,0.45)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", border: "none", cursor: "pointer" }}>
                  {muted ? <VolumeX style={{ width: 16, height: 16, color: "#fff" }} /> : <Volume2 style={{ width: 16, height: 16, color: "#fff" }} />}
                </button>
              )}
              {!isHost && (
                <button onClick={shareLive} style={{ width: 34, height: 34, background: "rgba(0,0,0,0.45)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", border: "none", cursor: "pointer" }}>
                  <Share2 style={{ width: 16, height: 16, color: "#fff" }} />
                </button>
              )}
              <button onClick={() => isHost ? stopLive() : navigate(-1)} style={{ width: 34, height: 34, background: "rgba(0,0,0,0.45)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", border: "none", cursor: "pointer" }}>
                <X style={{ width: 16, height: 16, color: "#fff" }} />
              </button>
            </div>
          </div>

          {/* ── Contrôles hôte ── */}
          {isHost && (
            <HostControls
              cameraOn={cameraOn} micOn={micOn}
              onToggleCamera={toggleCamera} onToggleMic={toggleMic}
              onShop={() => setShowShop(true)} onStop={stopLive}
              connOk={connStatus === "connected"}
            />
          )}

          {isHost && featuredItem && <FeaturedProductOverlay item={featuredItem} onClose={() => setFeaturedItem(null)} />}

          <FloatingHearts hearts={hearts} />

          {/* ── Commentaires ── */}
          <div style={{ position: "absolute", left: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", zIndex: 20, bottom: 78, maxHeight: "28vh", right: isHost ? 72 : 76 }} className="hide-scrollbar">
            {comments.map((c, i) => {
              const isHostComment = c.sender_email === session?.host_email;
              return (
              <div key={c.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                {c.sender_avatar
                  ? <BeautyImage src={c.sender_avatar} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginTop: 2 }} />
                  : <div style={{ width: 26, height: 26, borderRadius: "50%", background: isHostComment ? PRIMARY : "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>{(c.sender_name || "?")[0]}</span>
                    </div>
                }
                <div style={{ backdropFilter: "blur(8px)", borderRadius: 16, borderTopLeftRadius: 4, padding: "7px 12px", maxWidth: "78%", background: c.type === "system" ? `${PRIMARY_ALPHA}0.3)` : isHostComment ? "rgba(249,115,22,0.28)" : "rgba(0,0,0,0.45)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>{c.sender_name || "Utilisateur"}</p>
                    {isHostComment && (
                      <span style={{ fontSize: 8, fontWeight: 900, color: "#fff", background: PRIMARY, padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hôte</span>
                    )}
                  </div>
                  <p style={{ color: "#fff", fontSize: 12.5, lineHeight: 1.45 }}>{c.content}</p>
                </div>
              </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* ── Barre de chat ── */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom, 12px))", zIndex: 30, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)", paddingRight: isHost ? 72 : 12 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.14)", borderRadius: 999, padding: "9px 16px", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                placeholder={user ? "Écrire un commentaire..." : "Connectez-vous pour commenter"}
                disabled={!user}
                style={{ width: "100%", background: "transparent", color: "#fff", fontSize: 13, outline: "none", border: "none" }} />
            </div>
            <button onClick={send} disabled={!input.trim() || !user}
              style={{ width: 42, height: 42, background: PRIMARY, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: !input.trim() || !user ? 0.4 : 1, border: "none", cursor: "pointer" }}>
              <Send style={{ width: 16, height: 16, color: "#fff" }} />
            </button>
            <button onClick={sendLike} disabled={!user} title="Aimer"
              style={{ width: 42, height: 42, background: "rgba(255,255,255,0.14)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", position: "relative" }}>
              <Heart style={{ width: 17, height: 17, color: "#ef4444", fill: "#ef4444" }} />
              {likeCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 900, borderRadius: 999, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
                  {likeCount > 99 ? "99+" : likeCount}
                </span>
              )}
            </button>
          </div>

          {isHost && showShop && (
            <ShopSheet onClose={() => setShowShop(false)} proEmail={user?.email || ""} onFeature={(item) => { setFeaturedItem(item); setShowShop(false); }} />
          )}

          {/* Confirmation de fin de live */}
          {ending && (
            <div style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 32, border: "4px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
          )}
        </>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
