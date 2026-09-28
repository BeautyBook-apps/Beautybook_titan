import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  X, Send, Users, Heart, Volume2, VolumeX, Loader2,
  Camera, CameraOff, Mic, MicOff, ShoppingBag, LogOut, Tag, Package, Scissors
} from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { readPageCache, mergePageCache, useCachedState } from "@/hooks/usePageCache";

const PRIMARY = "#f97316";
const PRIMARY_ALPHA = "rgba(249,115,22,";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

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
      entities.Service.filter({ pro_email: proEmail, status: "actif" }, "-created_at", 20),
    ]).then(([p, s]) => { setProduits(p); setServices(s); }).catch(() => {}).finally(() => setLoading(false));
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

// ── Host Controls ─────────────────────────────────────────────────────────────
function HostControls({ cameraOn, micOn, onToggleCamera, onToggleMic, onShop, onStop }) {
  const controls = [
    { label: "Caméra", icon: cameraOn ? Camera : CameraOff, danger: !cameraOn, action: onToggleCamera },
    { label: "Micro", icon: micOn ? Mic : MicOff, danger: !micOn, action: onToggleMic },
    { label: "Boutique", icon: ShoppingBag, action: onShop },
  ];

  return (
    <div className="absolute right-2 flex flex-col items-center gap-1" style={{ top: 76, bottom: 72, zIndex: 25, justifyContent: "flex-start" }}>
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
          <LogOut className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-[7px] font-black uppercase tracking-wider">Quitter</span>
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
  // Affichage direct depuis le cache : la dernière fiche connue s'affiche
  // immédiatement, le rafraîchissement réseau se fait en arrière-plan.
  const [session, setSession] = useCachedState(cacheKey, null, c => c?.session ?? null);
  const [comments, setComments] = useCachedState(cacheKey, [], c => c?.comments || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.session);
  const [followed, setFollowed] = useState(false);
  const [viewers, setViewers] = useState(() => readPageCache(cacheKey)?.session?.viewers || 0);
  const [muted, setMuted] = useState(false);
  const [connStatus, setConnStatus] = useState("connecting");

  const [isHost, setIsHost] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [featuredItem, setFeaturedItem] = useState(null);
  const [showShop, setShowShop] = useState(false);

  const bottomRef = useRef(null);
  const videoRef = useRef(null);
  const hostPeersRef = useRef({});
  const localStreamRef = useRef(null);
  const viewerPcRef = useRef(null);
  const callIdRef = useRef(null);
  const signalUnsubRef = useRef(null);
  const retryTimerRef = useRef(null);
  const viewersCountRef = useRef(0);
  const retryCountRef = useRef(0);
  const connectFnRef = useRef(null);

  // ── Load session ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const key = `live_${id}`;
    // Changement de live : afficher le cache du nouveau live immédiatement
    // plutôt qu'un écran vide. Les données temps réel (viewers, statut)
    // sont ensuite rafraîchies en arrière-plan.
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
    const load = async () => {
      let found = null;
      try {
        const items = await entities.LiveSession.list();
        found = (items || []).find(i => i.id === id) || null;
      } catch {}
      if (!found && user?.email) {
        try {
          const items2 = await entities.LiveSession.filter({ host_email: user.email });
          found = (items2 || []).find(i => i.id === id) || null;
        } catch {}
      }
      setSession(found);
      setViewers(found?.viewers || 0);
      if (found && user?.email && found.host_email === user.email) {
        setIsHost(true);
      }
      mergePageCache(key, { session: found });
      setLoading(false);
    };
    load();
  }, [id, user?.email]);

  // ── Realtime session updates ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const unsub = entities.LiveSession.subscribe((event) => {
      const evId = event.data?.id || event.id;
      if (evId !== id) return;
      if (event.type === "delete" || event.data?.status === "ended") { navigate("/live"); return; }
      if (event.data) {
        setSession(prev => {
          const next = prev ? { ...prev, ...event.data } : event.data;
          mergePageCache(`live_${id}`, { session: next });
          return next;
        });
        setViewers(event.data.viewers || 0);
      }
    });
    return () => unsub();
  }, [id]);

  // ── Realtime messages ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    entities.LiveMessage.filter({ session_id: id }, "created_at", 60)
      .then(items => {
        const list = (items || []).filter(m => m.type === "text" || m.type === "system");
        setComments(list);
        // Les derniers commentaires connus sont mis en cache au chargement ;
        // les nouveaux messages temps réel arrivent via la subscription.
        mergePageCache(`live_${id}`, { comments: list });
      })
      .catch(() => {});
    const unsub = entities.LiveMessage.subscribe((event) => {
      if (event.data?.session_id !== id) return;
      if (event.type === "create" && (event.data.type === "text" || event.data.type === "system")) {
        setComments(c => [...c, event.data]);
      }
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // ══════════════════════════════════════════════════════════════════════════════
  // HOST MODE
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isHost || !id || !user?.email) return;

    let stream = null;

    const startHost = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (err) {
          console.error("Camera error:", err);
          return;
        }
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setConnStatus("connected");

      const updateViewers = () => {
        const count = Object.keys(hostPeersRef.current).length;
        setViewers(count);
        entities.LiveSession.update(id, { viewers: count }).catch(() => {});
      };

      const handleSignal = async (sig) => {
        if (!sig || sig.callee_email !== user.email) return;
        if (!sig.call_id?.startsWith("live_" + id)) return;
        const viewerEmail = sig.caller_email;

        if (sig.type === "offer") {
          if (hostPeersRef.current[viewerEmail]) {
            hostPeersRef.current[viewerEmail].close();
            delete hostPeersRef.current[viewerEmail];
          }

          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" });
          hostPeersRef.current[viewerEmail] = pc;

          (localStreamRef.current?.getTracks() || []).forEach(track => {
            pc.addTrack(track, localStreamRef.current);
          });

          const iceCandidates = [];
          let iceSendTimer = null;
          pc.onicecandidate = (e) => {
            if (!e.candidate) return;
            iceCandidates.push(e.candidate);
            if (!iceSendTimer) {
              iceSendTimer = setTimeout(async () => {
                const batch = iceCandidates.splice(0);
                for (const c of batch) {
                  await entities.CallSignal.create({
                    call_id: sig.call_id, caller_email: user.email, callee_email: viewerEmail,
                    type: "ice-candidate", payload: JSON.stringify(c), status: "accepted",
                  }).catch(() => {});
                }
                iceSendTimer = null;
              }, 200);
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
              pc.close();
              delete hostPeersRef.current[viewerEmail];
              updateViewers();
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
            updateViewers();
          } catch (err) {
            console.error("Host answer error:", err);
          }
        }

        if (sig.type === "ice-candidate" && hostPeersRef.current[viewerEmail]) {
          try { await hostPeersRef.current[viewerEmail].addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload))); } catch {}
        }

        if (sig.type === "end") {
          if (hostPeersRef.current[viewerEmail]) {
            hostPeersRef.current[viewerEmail].close();
            delete hostPeersRef.current[viewerEmail];
            updateViewers();
          }
        }
      };

      try {
        const existing = await entities.CallSignal.filter({ callee_email: user.email }, "created_at", 50);
        const liveOffers = (existing || []).filter(s => s.call_id?.startsWith("live_" + id) && s.type === "offer");
        for (const sig of liveOffers) await handleSignal(sig);
      } catch {}

      const offerPoller = setInterval(async () => {
        try {
          const recent = await entities.CallSignal.filter({ callee_email: user.email }, "created_at", 20);
          const liveOffers = (recent || []).filter(s => s.call_id?.startsWith("live_" + id) && s.type === "offer");
          for (const sig of liveOffers) await handleSignal(sig);
        } catch {}
      }, 2000);

      const signalUnsub = entities.CallSignal.subscribe(async (event) => {
        if (event.type !== "create") return;
        await handleSignal(event.data);
      });
      signalUnsubRef.current = signalUnsub;
    };

    startHost();

    return () => {
      clearInterval(offerPoller);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (signalUnsubRef.current) signalUnsubRef.current();
      Object.values(hostPeersRef.current).forEach(pc => pc.close());
      hostPeersRef.current = {};
    };
  }, [isHost, id, user?.email]);

  useEffect(() => {
    if (!isHost || !localStream) return;
    const tryBind = () => {
      const video = videoRef.current;
      if (!video) { setTimeout(tryBind, 100); return; }
      video.srcObject = localStream;
      video.muted = true;
      video.play().catch(() => {});
    };
    tryBind();
  }, [isHost, localStream]);

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEWER MODE
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isHost || loading || !session || !user?.email) return;

    const hostEmail = session.host_email;
    if (!hostEmail) return;

    const myEmail = user.email;
    const callId = "live_" + id + "_" + myEmail.replace(/[^a-z0-9]/gi, "_");
    callIdRef.current = callId;

    let pc = null;
    retryCountRef.current = 0;
    const maxRetries = 10;

    const connect = async () => {
      if (viewerPcRef.current) {
        viewerPcRef.current.close();
        viewerPcRef.current = null;
      }
      if (signalUnsubRef.current) { signalUnsubRef.current(); signalUnsubRef.current = null; }

      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      viewerPcRef.current = pc;

      pc.ontrack = (event) => {
        if (!event.streams?.[0]) return;
        const stream = event.streams[0];
        const bindStream = () => {
          const video = videoRef.current;
          if (!video) { setTimeout(bindStream, 100); return; }
          if (video.srcObject !== stream) {
            video.srcObject = stream;
          }
          video.muted = false;
          video.play().catch(() => {});
          setConnStatus("connected");
        };
        bindStream();
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") setConnStatus("connected");
        if (state === "failed" || state === "disconnected") {
          setConnStatus("connecting");
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            retryTimerRef.current = setTimeout(connect, 1500);
          } else {
            setConnStatus("error");
          }
        }
      };

      const iceCandidates = [];
      let iceSendTimer = null;
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        iceCandidates.push(e.candidate);
        if (!iceSendTimer) {
          iceSendTimer = setTimeout(async () => {
            const batch = iceCandidates.splice(0);
            for (const c of batch) {
              await entities.CallSignal.create({
                call_id: callId, caller_email: myEmail, callee_email: hostEmail,
                type: "ice-candidate", payload: JSON.stringify(c), status: "ringing",
              }).catch(() => {});
            }
            iceSendTimer = null;
          }, 200);
        }
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

      const applyHostSignal = async (sig) => {
        if (!sig || sig.call_id !== callId || sig.callee_email !== myEmail) return;
        if (sig.type === "answer" && viewerPcRef.current?.signalingState === "have-local-offer") {
          try { await viewerPcRef.current.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload))); } catch {}
        }
        if (sig.type === "ice-candidate" && viewerPcRef.current) {
          try { await viewerPcRef.current.addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload))); } catch {}
        }
      };

      const signalUnsub = entities.CallSignal.subscribe(async (event) => {
        if (event.type !== "create") return;
        await applyHostSignal(event.data);
      });
      signalUnsubRef.current = signalUnsub;

      const pollAnswerFiltered = async () => {
        if (!viewerPcRef.current || viewerPcRef.current.signalingState === "closed") return;
        try {
          const sigs = await entities.CallSignal.filter({ call_id: callId, callee_email: myEmail }, "created_at", 20);
          const answerSigs = (sigs || []).filter(s => s.type === "answer" || s.type === "ice-candidate");
          for (const sig of answerSigs) await applyHostSignal(sig);
        } catch {}
      };

      const answerPoller = setInterval(() => {
        if (viewerPcRef.current?.signalingState === "have-local-offer") {
          pollAnswerFiltered();
        } else {
          clearInterval(answerPoller);
        }
      }, 2000);

      setTimeout(pollAnswerFiltered, 1000);
      setTimeout(pollAnswerFiltered, 3000);
      setTimeout(pollAnswerFiltered, 5000);
      setTimeout(pollAnswerFiltered, 8000);
    };

    setConnStatus("connecting");
    connectFnRef.current = connect;
    connect();

    const nextViewers = (session?.viewers || 0) + 1;
    viewersCountRef.current = nextViewers;
    entities.LiveSession.update(id, { viewers: nextViewers }).catch(() => {});

    return () => {
      clearInterval(retryTimerRef.current);
      clearInterval(answerPoller);
      clearTimeout(iceSendTimer);
      if (viewerPcRef.current) { viewerPcRef.current.close(); viewerPcRef.current = null; }
      if (signalUnsubRef.current) { signalUnsubRef.current(); signalUnsubRef.current = null; }
      entities.CallSignal.create({
        call_id: callId, caller_email: myEmail, callee_email: hostEmail,
        type: "end", payload: "", status: "ended",
      }).catch(() => {});
      entities.LiveSession.update(id, { viewers: Math.max(0, viewersCountRef.current - 1) }).catch(() => {});
    };
  }, [isHost, loading, session?.id, user?.email]);

  useEffect(() => {
    if (videoRef.current && !isHost) videoRef.current.muted = muted;
  }, [muted, isHost]);

  // Lock body scroll when live is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
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
      setMicOn(m => !m);
    }
  };

  const stopLive = async () => {
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    Object.values(hostPeersRef.current).forEach(pc => pc.close());
    hostPeersRef.current = {};
    if (id) await entities.LiveSession.update(id, { status: "ended" }).catch(() => {});
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

  const videoVisible = connStatus === "connected";

  const content = (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", background: "#000", zIndex: 9999, overflow: "hidden", touchAction: "none" }}
      ref={(el) => {
        if (el) {
          document.body.style.overflow = "hidden";
          document.body.style.position = "fixed";
          document.body.style.width = "100%";
        }
      }}>

      {/* Background blur */}
      {session?.host_avatar
        ? <BeautyImage src={session.host_avatar} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2, filter: "blur(20px)", transform: "scale(1.1)" }} />
        : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #f97316 0%, #000 100%)" }} />
      }

      {/* Video */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: videoVisible ? 1 : 0, transition: "opacity 0.5s ease", zIndex: 1 }}
      />

      {/* Gradient overlay */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)", pointerEvents: "none", zIndex: 2 }} />

      {/* Camera off overlay */}
      {isHost && !cameraOn && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 3 }}>
          <CameraOff style={{ width: 64, height: 64, color: "rgba(255,255,255,0.2)" }} />
        </div>
      )}

      {/* Viewer waiting overlay */}
      {!loading && session && !isHost && connStatus !== "connected" && (
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

      {/* Loading */}
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30 }}>
          <div style={{ width: 32, height: 32, border: "4px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {/* Not found */}
      {!loading && !session && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 32px", textAlign: "center", zIndex: 30 }}>
          <p style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>Live introuvable ou terminé</p>
          <button onClick={() => navigate(-1)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "underline" }}>Retour</button>
        </div>
      )}

      {session && (
        <>
          {/* ── Top bar ── */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 10, padding: "16px 12px 10px", paddingTop: "max(16px, env(safe-area-inset-top, 16px))", background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)", zIndex: 20 }}>
            {!isHost && (
              <>
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
                <button onClick={() => setFollowed(f => !f)}
                  style={{ flexShrink: 0, borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 900, background: followed ? "rgba(255,255,255,0.2)" : PRIMARY, color: "#fff" }}>
                  {followed ? "Abonné ✓" : "+ Suivre"}
                </button>
              </>
            )}
            {isHost && <div style={{ flex: 1 }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ef4444", borderRadius: 999, padding: "4px 10px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulse 2s infinite" }} />
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>LIVE</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.4)", borderRadius: 999, padding: "4px 10px", backdropFilter: "blur(8px)" }}>
                <Users style={{ width: 12, height: 12, color: "rgba(255,255,255,0.7)" }} />
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{viewers}</span>
              </div>
              {!isHost && (
                <button onClick={() => setMuted(m => !m)} style={{ width: 32, height: 32, background: "rgba(0,0,0,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
                  {muted ? <VolumeX style={{ width: 16, height: 16, color: "#fff" }} /> : <Volume2 style={{ width: 16, height: 16, color: "#fff" }} />}
                </button>
              )}
              <button onClick={() => isHost ? stopLive() : navigate(-1)} style={{ width: 32, height: 32, background: "rgba(0,0,0,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
                <X style={{ width: 16, height: 16, color: "#fff" }} />
              </button>
            </div>
          </div>

          {/* ── Host controls ── */}
          {isHost && (
            <HostControls
              cameraOn={cameraOn} micOn={micOn}
              onToggleCamera={toggleCamera} onToggleMic={toggleMic}
              onShop={() => setShowShop(true)} onStop={stopLive}
            />
          )}

          {isHost && featuredItem && <FeaturedProductOverlay item={featuredItem} onClose={() => setFeaturedItem(null)} />}

          {/* ── Comments ── */}
          <div style={{ position: "absolute", left: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", zIndex: 20, bottom: 72, maxHeight: "30vh", right: isHost ? 72 : 12 }}>
            {comments.map((c, i) => {
              const isHostComment = c.sender_email === session?.host_email;
              return (
              <div key={c.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                {c.sender_avatar
                  ? <BeautyImage src={c.sender_avatar} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginTop: 2 }} />
                  : <div style={{ width: 24, height: 24, borderRadius: "50%", background: isHostComment ? PRIMARY : "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>{(c.sender_name || "?")[0]}</span>
                    </div>
                }
                <div style={{ backdropFilter: "blur(8px)", borderRadius: 16, borderTopLeftRadius: 4, padding: "6px 12px", maxWidth: "75%", background: c.type === "system" ? `${PRIMARY_ALPHA}0.3)` : isHostComment ? "rgba(249,115,22,0.25)" : "rgba(0,0,0,0.4)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>{c.sender_name || "Utilisateur"}</p>
                    {isHostComment && (
                      <span style={{ fontSize: 8, fontWeight: 900, color: PRIMARY, background: "rgba(249,115,22,0.3)", padding: "1px 5px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hôte</span>
                    )}
                  </div>
                  <p style={{ color: "#fff", fontSize: 12, lineHeight: 1.4 }}>{c.content}</p>
                </div>
              </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* ── Chat input ── */}
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", paddingTop: 8, paddingBottom: "calc(8px + env(safe-area-inset-bottom, 12px))", zIndex: 100, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)", paddingRight: isHost ? 72 : 12 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "8px 16px", backdropFilter: "blur(8px)" }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                placeholder={user ? "Écrire un commentaire..." : "Connectez-vous pour commenter"}
                disabled={!user}
                style={{ width: "100%", background: "transparent", color: "#fff", fontSize: 13, outline: "none", border: "none" }} />
            </div>
            <button onClick={send} disabled={!input.trim() || !user}
              style={{ width: 40, height: 40, background: PRIMARY, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: !input.trim() || !user ? 0.4 : 1 }}>
              <Send style={{ width: 16, height: 16, color: "#fff" }} />
            </button>
            <button style={{ width: 40, height: 40, background: "rgba(255,255,255,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backdropFilter: "blur(8px)" }}>
              <Heart style={{ width: 16, height: 16, color: "#ef4444", fill: "#ef4444" }} />
            </button>
          </div>

          {isHost && showShop && (
            <ShopSheet onClose={() => setShowShop(false)} proEmail={user?.email || ""} onFeature={(item) => { setFeaturedItem(item); setShowShop(false); }} />
          )}
        </>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
