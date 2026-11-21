import { useState } from "react";
import { X, Copy, Check, MessageCircle, Send } from "lucide-react";
import BrandMark from "@/components/ui/BrandMark";

/**
 * ShareSheet — bottom sheet de partage natif/web
 * Props: open, onClose, title, text, url
 */
export default function ShareSheet({ open, onClose, title, text, url }) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const shareUrl = url || window.location.href;
  const shareTitle = title || document.title;
  const shareText = text || shareTitle;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    } catch {}
  };

  const options = [
    {
      label: "WhatsApp",
      brand: "whatsapp",
      emoji: "💬",
      bg: "bg-green-500",
      action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank"); onClose(); },
    },
    {
      label: "Partager",
      emoji: "📤",
      bg: "bg-blue-500",
      action: async () => {
        try {
          if (navigator.share) { await navigator.share({ title: shareTitle, text: shareText, url: shareUrl }); onClose(); }
          else copyLink();
        } catch { copyLink(); }
      },
    },
    {
      label: copied ? "Copié !" : "Copier",
      emoji: copied ? "✅" : "🔗",
      bg: copied ? "bg-green-600" : "bg-gray-700",
      action: copyLink,
    },
    {
      label: "SMS",
      emoji: "✉️",
      bg: "bg-indigo-500",
      action: () => { window.open(`sms:?body=${encodeURIComponent(shareText + " " + shareUrl)}`); onClose(); },
    },
  ];

  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full px-5 pb-safe pt-4 shadow-2xl"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* Title */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[16px] font-black text-gray-900">Partager</p>
            {shareTitle && <p className="text-[12px] text-gray-400 font-medium truncate max-w-[240px]">{shareTitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* URL preview */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-5">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-[16px]">🔗</span>
          </div>
          <p className="flex-1 text-[12px] text-gray-500 font-medium truncate">{shareUrl}</p>
          <button onClick={copyLink} className="shrink-0 active:scale-95 transition-all">
            {copied
              ? <Check className="w-4 h-4 text-green-500" />
              : <Copy className="w-4 h-4 text-gray-400" />
            }
          </button>
        </div>

        {/* Share options grid */}
        <div className="grid grid-cols-4 gap-4">
          {options.map(opt => (
            <button
              key={opt.label}
              onClick={opt.action}
              className="flex flex-col items-center gap-2 active:scale-95 transition-all"
            >
              <div className={`w-14 h-14 ${opt.bg} rounded-2xl flex items-center justify-center text-[22px] shadow-md`}>
                {opt.brand ? <BrandMark brand={opt.brand} label={opt.label} size={27} /> : opt.emoji}
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wide">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
