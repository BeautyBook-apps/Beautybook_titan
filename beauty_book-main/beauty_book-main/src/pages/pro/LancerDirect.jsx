import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Radio, Video, Users, MessageCircle,
  Scissors, Palette, Hand, Heart, GraduationCap,
  Zap, Eye, Mic, Camera, CheckCircle2, AlertCircle,
  MicOff, CameraOff, RefreshCw
} from "lucide-react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { useThemeBg, useTheme } from "@/hooks/useTheme";

const PRIMARY = "#f97316"; // app orange
const PRIMARY_LIGHT = "#fff7ed";
const PRIMARY_ALPHA = "rgba(249,115,22,";

const CATEGORIES = [
  { key: "Coiffure", Icon: Scissors },
  { key: "Maquillage", Icon: Palette },
  { key: "Ongles", Icon: Hand },
  { key: "Soin", Icon: Heart },
  { key: "Barbier", Icon: Zap },
  { key: "Tutoriel", Icon: GraduationCap },
];

const STEPS = [
  { Icon: Video, text: "Donnez un titre et une catégorie" },
  { Icon: Camera, text: "Autorisez l'accès caméra et micro" },
  { Icon: Eye, text: "Votre audience vous voit en direct" },
  { Icon: MessageCircle, text: "Interagissez via le chat temps réel" },
];

export default function LancerDirect() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const themeBg = useThemeBg();
  const isDark = theme === "dark" || theme === "night";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Coiffure");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  // Environment test
  const [testStream, setTestStream] = useState(null);
  const [cameraAllowed, setCameraAllowed] = useState(null);
  const [micAllowed, setMicAllowed] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testCameraOn, setTestCameraOn] = useState(true);
  const [testMicOn, setTestMicOn] = useState(true);
  const videoRef = useRef(null);

  const cardBg = isDark ? (theme === "night" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.85)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const inputBg = isDark ? (theme === "night" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.9)";
  const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const textPrimary = isDark ? "#f9fafb" : "#111827";
  const textSecondary = isDark ? "#9ca3af" : "#6b7280";
  const textMuted = isDark ? "#6b7280" : "#9ca3af";
  const headerBg = isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.85)";

  const startEnvironmentTest = async () => {
    if (testStreamRef.current) testStreamRef.current.getTracks().forEach(t => t.stop());
    setTesting(true);
    setCameraAllowed(null);
    setMicAllowed(null);
    setStartError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      testStreamRef.current = stream;
      setTestStream(stream);
      setCameraAllowed(true);
      setMicAllowed(true);
    } catch (err) {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        testStreamRef.current = audioOnly;
        setTestStream(audioOnly);
        setCameraAllowed(false);
        setMicAllowed(true);
      } catch {
        setCameraAllowed(false);
        setMicAllowed(false);
        setStartError("Impossible d'accéder à la caméra et au micro. Vérifiez vos autorisations.");
      }
    }
    setTesting(false);
  };

  useEffect(() => {
    if (videoRef.current && testStream) {
      videoRef.current.srcObject = testStream;
    }
  }, [testStream]);

  const testStreamRef = useRef(null);

  useEffect(() => {
    startEnvironmentTest();
    return () => {
      if (testStreamRef.current) testStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleTestCamera = () => {
    if (!testStream) return;
    testStream.getVideoTracks().forEach(t => { t.enabled = !testCameraOn; });
    setTestCameraOn(!testCameraOn);
  };

  const toggleTestMic = () => {
    if (!testStream) return;
    testStream.getAudioTracks().forEach(t => { t.enabled = !testMicOn; });
    setTestMicOn(!testMicOn);
  };

  const startLive = async () => {
    if (!title.trim()) return;
    setStarting(true);
    setStartError(null);

    try {
      const existingLives = await entities.LiveSession.filter({ host_email: user?.email, status: "live" }, "-created_at", 20).catch(() => []);
      await Promise.all(existingLives.map(l => entities.LiveSession.update(l.id, { status: "ended", ended_at: new Date().toISOString() }).catch(() => {})));

      // Vérifie l'accès caméra/micro (réutilise le test d'environnement si déjà OK).
      let hasVideo = cameraAllowed === true;
      let hasAudio = micAllowed === true;
      if (!testStreamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach(t => t.stop());
          hasVideo = true; hasAudio = true;
        } catch {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            audioOnly.getTracks().forEach(t => t.stop());
            hasAudio = true;
          } catch {
            throw new Error("Impossible d'accéder à la caméra ou au micro. Autorisez l'accès dans votre navigateur.");
          }
        }
      }
      if (!hasAudio) throw new Error("Micro requis pour lancer un direct.");

      const session = await entities.LiveSession.create({
        host_email: user?.email || "",
        host_name: user?.full_name || "Hôte",
        host_avatar: user?.avatar_url || "",
        title,
        category,
        status: "live",
        viewers: 0,
        started_at: new Date().toISOString(),
      });

      await entities.LiveMessage.create({
        session_id: session.id,
        sender_email: "system@beautybook.fr",
        sender_name: "BeautyBook",
        content: "🎬 Live démarré ! Vos abonnés peuvent vous rejoindre.",
        type: "system",
      }).catch(() => {});

      navigate(`/live-detail/${session.id}`);
    } catch (e) {
      setStartError(e.message || "Erreur lors du démarrage.");
    }
    setStarting(false);
  };

  return (
    <div className="font-display min-h-full" style={{ background: themeBg, paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>

      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-5 pt-5 pb-4"
        style={{ background: headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <button onClick={() => navigate("/profil-pro")}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" }}>
          <ArrowLeft className="w-5 h-5" style={{ color: textPrimary }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-black leading-tight" style={{ color: textPrimary }}>Lancer un Direct</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>Streaming en direct</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ background: `${PRIMARY_ALPHA}0.10)`, border: `1px solid ${PRIMARY_ALPHA}0.20)` }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PRIMARY }} />
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: PRIMARY }}>Live</span>
        </div>
      </div>

      <div className="px-5 space-y-5 pb-10">

        {/* Environment test */}
        <div className="rounded-3xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: cardBorder }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: PRIMARY_LIGHT }}>
                <Camera className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
              </div>
              <p className="text-[12px] font-black" style={{ color: textPrimary }}>Test de l'environnement</p>
            </div>
            <button onClick={startEnvironmentTest} disabled={testing}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 active:scale-95 transition-all"
              style={{ background: `${PRIMARY_ALPHA}0.10)` }}>
              <RefreshCw className={`w-3 h-3 ${testing ? "animate-spin" : ""}`} style={{ color: PRIMARY }} />
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: PRIMARY }}>{testing ? "Test..." : "Retester"}</span>
            </button>
          </div>

          <div className="relative aspect-video bg-black/80 flex items-center justify-center overflow-hidden">
            {cameraAllowed === true ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : cameraAllowed === false ? (
              <div className="flex flex-col items-center gap-2">
                <CameraOff className="w-10 h-10" style={{ color: textMuted }} />
                <p className="text-[11px] font-medium" style={{ color: textMuted }}>Caméra non autorisée</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-[11px] font-medium" style={{ color: textMuted }}>Test en cours...</p>
              </div>
            )}

            {/* Test controls */}
            {testStream && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button onClick={toggleTestCamera}
                  className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: testCameraOn ? `${PRIMARY_ALPHA}0.90)` : "rgba(0,0,0,0.5)" }}>
                  {testCameraOn ? <Camera className="w-4 h-4 text-white" /> : <CameraOff className="w-4 h-4 text-white" />}
                </button>
                <button onClick={toggleTestMic}
                  className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: testMicOn ? `${PRIMARY_ALPHA}0.90)` : "rgba(0,0,0,0.5)" }}>
                  {testMicOn ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-white" />}
                </button>
              </div>
            )}
          </div>

          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              {cameraAllowed === true ? <CheckCircle2 className="w-4 h-4" style={{ color: PRIMARY }} /> : cameraAllowed === false ? <AlertCircle className="w-4 h-4 text-red-500" /> : <div className="w-4 h-4 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />}
              <span className="text-[11px] font-bold" style={{ color: textSecondary }}>
                {cameraAllowed === true ? "Caméra détectée" : cameraAllowed === false ? "Caméra non disponible" : "Vérification caméra..."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {micAllowed === true ? <CheckCircle2 className="w-4 h-4" style={{ color: PRIMARY }} /> : micAllowed === false ? <AlertCircle className="w-4 h-4 text-red-500" /> : <div className="w-4 h-4 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />}
              <span className="text-[11px] font-bold" style={{ color: textSecondary }}>
                {micAllowed === true ? "Micro détecté" : micAllowed === false ? "Micro non disponible" : "Vérification micro..."}
              </span>
            </div>
          </div>
        </div>

        {/* Hero card */}
        <div className="rounded-3xl p-5" style={{ background: `${PRIMARY_ALPHA}0.06)`, border: `1px solid ${PRIMARY_ALPHA}0.12)` }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: PRIMARY }}>
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-black" style={{ color: textPrimary }}>Diffusez en direct</p>
              <p className="text-[11px] font-medium" style={{ color: textSecondary }}>Engagez votre communauté en temps réel</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {STEPS.map(({ Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: PRIMARY_LIGHT }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
                </div>
                <p className="text-[11px] font-medium" style={{ color: textSecondary }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Title input */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1 h-4 rounded-full" style={{ background: PRIMARY }} />
            <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: textMuted }}>Titre du live</p>
            <span className="text-red-500 text-[10px] font-black">*</span>
          </div>
          <input
            placeholder="Ex: Coupe en live avec Q&A..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-2xl px-4 py-4 text-[14px] outline-none transition-all"
            style={{
              background: inputBg,
              border: `1.5px solid ${inputBorder}`,
              color: textPrimary,
            }}
          />
        </div>

        {/* Category selector */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: PRIMARY }} />
            <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: textMuted }}>Catégorie</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(({ key, Icon }) => {
              const active = category === key;
              return (
                <button key={key} onClick={() => setCategory(key)}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: active ? `${PRIMARY_ALPHA}0.10)` : cardBg,
                    border: active ? `1.5px solid ${PRIMARY_ALPHA}0.35)` : `1px solid ${cardBorder}`,
                  }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: active ? `${PRIMARY_ALPHA}0.15)` : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)") }}>
                    <Icon className="w-4.5 h-4.5 transition-all" style={{ color: active ? PRIMARY : textMuted, width: 18, height: 18 }} />
                  </div>
                  <span className="text-[10px] font-black transition-all"
                    style={{ color: active ? PRIMARY : textMuted }}>{key}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {startError && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-500 text-[12px] font-medium">{startError}</p>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={startLive}
          disabled={!title.trim() || starting || micAllowed === false}
          className="w-full rounded-3xl py-5 font-black text-[15px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
          style={{
            background: PRIMARY,
            boxShadow: `0 8px 24px ${PRIMARY_ALPHA}0.35)`,
            color: "#fff",
          }}
        >
          {starting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Démarrage...
            </>
          ) : (
            <>
              <Radio className="w-6 h-6" />
              Démarrer le Direct
            </>
          )}
        </button>

        {/* Footer hint */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <Users className="w-3.5 h-3.5" style={{ color: textMuted }} />
          <p className="text-[10px] font-medium" style={{ color: textMuted }}>
            Vos abonnés seront notifiés dès que vous démarrez
          </p>
        </div>
      </div>
    </div>
  );
}
