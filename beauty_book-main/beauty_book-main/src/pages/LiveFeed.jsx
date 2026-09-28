import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Users, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import Hls from "hls.js";

// HLS player inline dans la card — joue avec son dès que possible
function LiveHlsVideo({ src, muted, onToggleMute }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!src || !video) return;

    let hls;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 5 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = muted;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setTimeout(() => hls.loadSource(src), 3000);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.muted = muted;
      video.play().catch(() => {});
    }
    return () => hls?.destroy();
  }, [src]);

  // sync muted state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

function LiveCard({ live, onNavigate }) {
  const [followed, setFollowed] = useState(false);
  const [viewers, setViewers] = useState(live.viewers || 0);
  const [muted, setMuted] = useState(true);
  const hasHls = !!live.hls_url;

  useEffect(() => {
    const unsub = entities.LiveSession.subscribe((event) => {
      if ((event.data?.id === live.id || event.id === live.id) && event.data) {
        setViewers(event.data.viewers || 0);
      }
    });
    return () => unsub();
  }, [live.id]);

  const handleMuteToggle = (e) => {
    e.stopPropagation();
    setMuted(m => !m);
  };

  return (
    <div
      className="relative w-full shrink-0 overflow-hidden cursor-pointer"
      style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always" }}
      onClick={() => onNavigate(live.id)}
    >
      {/* Background: HLS vidéo si disponible, sinon avatar flouté */}
      {hasHls ? (
        <LiveHlsVideo src={live.hls_url} muted={muted} />
      ) : live.host_avatar ? (
        <BeautyImage src={live.host_avatar} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm opacity-60" />
      ) : (
        <div className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 30% 40%, #E8732A 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, #f59540 0%, transparent 50%), #141b2b" }} />
      )}

      {/* Avatar centré (uniquement si pas de vidéo) */}
      {!hasHls && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          {live.host_avatar ? (
            <BeautyImage src={live.host_avatar} alt={live.host_name} className="w-28 h-28 rounded-full border-4 border-white/50 object-cover shadow-2xl" />
          ) : (
            <div className="w-28 h-28 rounded-full border-4 border-white/30 bg-white/20 flex items-center justify-center shadow-2xl">
              <span className="text-white text-[44px] font-black">{(live.host_name || "P")[0]}</span>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 bg-red-500/90 rounded-full px-4 py-1.5">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-white text-[11px] font-black uppercase tracking-widest">EN DIRECT</span>
          </div>
          <p className="mt-2 text-white/60 text-[11px] font-medium">Appuyer pour rejoindre</p>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40 pointer-events-none" />

      {/* LIVE badge */}
      <div className="absolute flex items-center gap-1.5 bg-red-500 rounded-full px-3 py-1.5 z-10"
        style={{ top: "calc(16px + env(safe-area-inset-top, 0px))", left: 16 }}>
        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        <span className="text-white text-[11px] font-black uppercase tracking-widest">LIVE</span>
      </div>

      {/* Viewers */}
      <div className="absolute bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 z-10 flex items-center gap-1.5"
        style={{ top: "calc(16px + env(safe-area-inset-top, 0px))", right: 16 }}>
        <Users className="w-3 h-3 text-white/70" />
        <span className="text-white text-[11px] font-bold">{(viewers || 0).toLocaleString()}</span>
      </div>

      {/* Mute button (seulement si HLS actif) */}
      {hasHls && (
        <button
          onClick={handleMuteToggle}
          className="absolute z-20 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
          style={{ top: "calc(56px + env(safe-area-inset-top, 0px))", right: 16 }}
        >
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
      )}

      {/* Bottom info */}
      <div className="absolute left-0 right-0 px-5 z-10"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 16px))" }}>
        <div className="flex items-center gap-3 mb-3">
          {live.host_avatar ? (
            <BeautyImage src={live.host_avatar} alt={live.host_name} className="w-12 h-12 rounded-full border-2 border-white object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-white bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-[16px]">{(live.host_name || "P")[0]}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[16px] font-black leading-tight truncate">{live.host_name || "Professionnel"}</p>
            <p className="text-white/60 text-[12px] font-medium">{live.category || "Beauté"}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setFollowed(f => !f); }}
            className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-black border transition-all ${
              followed ? "border-white/40 text-white/60" : "bg-primary border-primary text-white"
            }`}
          >
            {followed ? "Abonné ✓" : "+ Suivre"}
          </button>
        </div>

        <p className="text-white text-[15px] font-bold leading-snug mb-3">{live.title}</p>

        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2.5 self-start inline-flex">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-[12px] font-black">Appuyer pour rejoindre le live</span>
        </div>
      </div>
    </div>
  );
}

export default function LiveFeed() {
  const navigate = useNavigate();
  // Affichage direct depuis le cache : la dernière liste de lives connue s'affiche
  // immédiatement, le refresh (temps réel) suit en arrière-plan sans vider l'affichage.
  const [lives, setLives] = useCachedState("livefeed_page", [], c => c?.lives || []);
  const [loading, setLoading] = useState(() => !readPageCache("livefeed_page")?.lives?.length);

  const loadLives = () => {
    entities.LiveSession.filter({ status: "live" }, "-created_at", 20)
      .then(items => {
        const list = items || [];
        setLives(list);
        mergePageCache("livefeed_page", { lives: list });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    entities.LiveSession.filter({ status: "live" }, "-created_at", 20)
      .then(items => {
        const list = items || [];
        setLives(list);
        mergePageCache("livefeed_page", { lives: list });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    window.addEventListener("focus", loadLives);

    const unsub = entities.LiveSession.subscribe((event) => {
      if (event.type === "create" && event.data?.status === "live") {
        setLives(prev => {
          if (prev.find(l => l.id === event.data.id)) return prev;
          return [event.data, ...prev];
        });
        setLoading(false);
      }
      if (event.type === "update") {
        if (event.data?.status === "ended") {
          setLives(prev => prev.filter(l => l.id !== event.data.id));
        } else if (event.data?.status === "live") {
          setLives(prev => {
            const exists = prev.find(l => l.id === event.data.id);
            return exists ? prev.map(l => l.id === event.data.id ? event.data : l) : [event.data, ...prev];
          });
          setLoading(false);
        }
      }
      if (event.type === "delete") {
        setLives(prev => prev.filter(l => l.id !== event.id));
      }
    });

    return () => {
      window.removeEventListener("focus", loadLives);
      unsub();
    };
  }, []);

  // Spinner plein écran uniquement si aucune donnée en cache à afficher.
  if (loading && lives.length === 0) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (lives.length === 0) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4 px-8 text-center font-display"
        style={{ paddingBottom: "calc(65px + env(safe-area-inset-bottom, 16px))" }}>
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
          <Radio className="w-8 h-8 text-white/40" />
        </div>
        <p className="text-white text-[18px] font-black">Aucun live en cours</p>
        <p className="text-white/50 text-[13px] font-medium">Les lives apparaîtront ici dès qu'un professionnel sera en direct.</p>
        <button
          onClick={loadLives}
          className="mt-2 bg-white/10 border border-white/20 rounded-full px-6 py-3 text-white text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full bg-black overflow-y-scroll hide-scrollbar font-display"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {lives.map((live) => (
        <LiveCard
          key={live.id}
          live={live}
          onNavigate={(id) => navigate("/live-detail/" + id)}
        />
      ))}
    </div>
  );
}