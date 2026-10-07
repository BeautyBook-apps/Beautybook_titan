import { useEffect, useRef, useState } from "react";
import { ExternalLink, Volume2, VolumeX, X } from "lucide-react";

function Media({ annonce, soundOn }) {
  const videoRef = useRef(null);
  const isVideo = Boolean(annonce.video_url);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn;
  }, [soundOn]);

  if (isVideo) {
    return <video ref={videoRef} src={annonce.video_url} poster={annonce.image_url || undefined}
      autoPlay loop muted={!soundOn} playsInline className="absolute inset-0 w-full h-full object-cover object-top"
      style={{ objectPosition: "top center" }} />;
  }
  return <img src={annonce.image_url} alt={annonce.title || "Publicité"}
    className="absolute inset-0 w-full h-full object-cover object-top" style={{ objectPosition: "top center" }} />;
}

export default function SponsoredCard({ annonce, onClose }) {
  const [soundOn, setSoundOn] = useState(false);
  if (!annonce || (!annonce.image_url && !annonce.video_url)) return null;

  const openCta = () => {
    if (!annonce.cta_url) return;
    if (annonce.cta_url.startsWith("/")) window.location.assign(annonce.cta_url);
    else window.open(annonce.cta_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <Media annonce={annonce} soundOn={soundOn} />
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/85 flex items-center justify-center shrink-0">
            <span className="text-white text-[14px] font-black">{(annonce.sponsor_name || "S")[0]}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-[14px] font-black truncate">{annonce.sponsor_name || "Sponsor"}</p>
            <p className="text-white/70 text-[11px] font-medium">Sponsorisé</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {annonce.video_url && <button onClick={() => setSoundOn(value => !value)} aria-label={soundOn ? "Couper le son" : "Activer le son"}
            className="w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center">
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>}
          <button onClick={onClose} aria-label="Fermer la publicité" className="w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 px-4" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <h3 className="text-white text-[18px] font-black mb-3 drop-shadow-lg">{annonce.title}</h3>
        <button onClick={openCta} className="w-full flex items-center justify-between bg-primary rounded-2xl px-4 py-3.5 text-white shadow-lg">
          <span className="text-[15px] font-black">{annonce.cta_label || "En savoir plus"}</span>
          <ExternalLink className="w-4 h-4 text-white/80" />
        </button>
      </div>
    </div>
  );
}
