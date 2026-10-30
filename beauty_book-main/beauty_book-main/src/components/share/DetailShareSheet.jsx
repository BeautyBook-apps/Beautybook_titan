import BeautyImage from "@/components/ui/BeautyImage";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Instagram, Link2, Mail, MessageCircle, Share2, Sparkles, X } from "lucide-react";

export default function DetailShareSheet({
  title,
  subtitle,
  eyebrow = "BeautyBook",
  category,
  image,
  price,
  description,
  url: sharedUrl,
  showQrCode = false,
  qrCaption = "Scannez pour ouvrir directement ce profil",
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const url = sharedUrl || window.location.href;
  const [qrCode, setQrCode] = useState("");
  const shareText = `${title || "Cette découverte BeautyBook"}${subtitle ? ` · ${subtitle}` : ""}`;
  const options = [
    { label: "WhatsApp", tone: "bg-[#eafaf1] text-[#16a34a]", Icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}` },
    { label: "Instagram", tone: "bg-gradient-to-br from-[#fff0f8] to-[#f0eaff] text-[#c026d3]", Icon: Instagram },
    { label: "Message", tone: "bg-[#edf5ff] text-blue-600", Icon: Mail, href: `sms:?body=${encodeURIComponent(`${shareText} ${url}`)}` },
    { label: "Copier le lien", tone: "bg-[#fff5ea] text-orange-600", Icon: Link2 },
  ];

  useEffect(() => {
    let active = true;
    if (!showQrCode || !url) {
      setQrCode("");
      return undefined;
    }
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    }).then(value => {
      if (active) setQrCode(value);
    }).catch(() => {
      if (active) setQrCode("");
    });
    return () => { active = false; };
  }, [showQrCode, url]);

  const copyLink = async () => {
    try { await navigator.clipboard?.writeText(url); } catch {}
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = async (option) => {
    if (option.label === "Copier le lien") {
      await copyLink();
      return;
    }
    if (option.href) {
      window.open(option.href, "_blank", "noopener,noreferrer");
      onClose();
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
        onClose();
      } catch (error) {
        if (error?.name !== "AbortError") onClose();
      }
      return;
    }
    await copyLink();
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-slate-950/60 backdrop-blur-[2px]" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-share-title"
        className="relative z-[501] w-full max-w-md overflow-hidden rounded-t-[2rem] border-t border-white/80 bg-[#fffdfb] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4 shadow-[0_-18px_50px_-24px_rgba(15,23,42,0.45)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">{eyebrow}</p>
              <h2 id="detail-share-title" className="mt-0.5 text-[18px] font-black tracking-tight text-slate-950">Partager cette fiche</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer le partage" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-orange-100">
            {image ? <BeautyImage src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-orange-400"><Sparkles className="h-5 w-5" /></div>}
          </div>
          <div className="min-w-0 flex-1">
            {category && <p className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-orange-600">{category}</p>}
            <p className="truncate text-[15px] font-black text-slate-950">{title || "Une découverte BeautyBook"}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-500">
              {subtitle && <span className="truncate">{subtitle}</span>}
              {price && <span className="shrink-0 font-black text-orange-600">{price}</span>}
            </div>
            {description && <p className="mt-1 line-clamp-1 text-[10px] text-slate-400">{description}</p>}
          </div>
        </div>

        {showQrCode && (
          <div className="mb-5 flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-2xl bg-white p-1 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.45)] ring-1 ring-slate-100">
              {qrCode ? <img src={qrCode} alt="QR code du profil" className="h-full w-full rounded-xl" /> : <div className="h-20 w-20 animate-pulse rounded-xl bg-slate-100" aria-label="Génération du QR code" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">Accès direct</p>
              <p className="mt-1 text-[15px] font-black leading-tight text-slate-950">Partager avec un QR code</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{qrCaption}</p>
            </div>
          </div>
        )}

        <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Choisir un canal</p>
        <div className="grid grid-cols-2 gap-2.5">
          {options.map(option => (
            <button key={option.label} onClick={() => handleShare(option)} className="group flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md active:scale-[0.97]">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105 ${option.tone}`}>
                {option.label === "Copier le lien" && copied ? <Check className="h-5 w-5" /> : <option.Icon className="h-5 w-5" />}
              </div>
              <span className="text-[11px] font-black leading-tight text-slate-700">{option.label === "Copier le lien" && copied ? "Lien copié" : option.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-[10px] font-medium text-slate-400">Le lien ouvre directement cette fiche dans BeautyBook.</p>
      </section>
    </div>
  );
}
