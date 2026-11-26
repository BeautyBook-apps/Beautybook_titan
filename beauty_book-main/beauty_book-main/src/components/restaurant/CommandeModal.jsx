import BeautyImage from '@/components/ui/BeautyImage';
import { useState } from "react";
import { X, Plus, Minus, Send } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { apiClient } from '@/lib/apiClient';
import { isMenuItemFree, menuItemPriceLabel } from '@/lib/restaurantMenu';

export default function CommandeModal({ plat, proEmail, proName, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const itemIsFree = isMenuItemFree(plat);
  const total = (Number(plat.prix) || 0) * qty;
  const totalLabel = itemIsFree ? "Offert" : `${total}€`;

  const handleCommander = async () => {
    setSending(true);
    const content = `🍽️ *Nouvelle commande depuis BeautyBook*\n\n` +
      `📦 ${plat.nom} × ${qty}\n` +
      `💰 Total : ${totalLabel}\n` +
      (note ? `📝 Note : ${note}\n` : "") +
      `\nMerci de confirmer la commande !`;

    await apiClient.callFunction("createCommande", {
      receiver_email: proEmail,
      content,
      conversation_id: [user?.email || "guest", proEmail].sort().join("_"),
    }).catch(() => {});

    setSending(false);
    setDone(true);
    setTimeout(() => {
      onClose();
      navigate(`/messages?to=${proEmail}&name=${encodeURIComponent(proName || proEmail)}`);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full px-5 pt-4 pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-gray-500" />
        </button>

        {/* Plat */}
        <div className="flex items-center gap-3 mb-5">
          {plat.image_url ? (
            <BeautyImage src={plat.image_url} alt={plat.nom} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
              <span className="text-[28px]">🍽️</span>
            </div>
          )}
          <div>
            <p className="text-[16px] font-black text-gray-900">{plat.nom}</p>
            {plat.description && <p className="text-[12px] text-gray-400 font-medium mt-0.5 line-clamp-2">{plat.description}</p>}
            <p className={`text-[18px] font-black mt-1 ${itemIsFree ? "text-emerald-600" : "text-primary"}`}>
              {menuItemPriceLabel(plat) || "Prix à définir"}
            </p>
          </div>
        </div>

        {/* Quantité */}
        <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-2xl p-4">
          <span className="text-[14px] font-black text-gray-700">Quantité</span>
          <div className="flex items-center gap-4">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 active:scale-95">
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-[18px] font-black text-gray-900 w-6 text-center">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shadow-sm active:scale-95">
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Note */}
        <div className="mb-5">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Allergie, instructions spéciales... (optionnel)"
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[13px] text-gray-700 outline-none resize-none border border-gray-100 placeholder:text-gray-400"
            rows={2}
          />
        </div>

        {/* Total + bouton */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] font-black text-gray-500 uppercase tracking-widest">Total</span>
          <span className={`text-[24px] font-black ${itemIsFree ? "text-emerald-600" : "text-primary"}`}>{totalLabel}</span>
        </div>

        <button
          onClick={handleCommander}
          disabled={sending || done || !user}
          className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {done ? "✅ Commande envoyée !" : sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Send className="w-4 h-4" /> Commander · {totalLabel}</>
          )}
        </button>
        {!user && <p className="text-center text-[11px] text-red-400 font-medium mt-2">Connectez-vous pour commander</p>}
      </div>
    </div>
  );
}
