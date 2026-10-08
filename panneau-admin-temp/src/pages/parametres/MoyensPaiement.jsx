import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, CheckCircle, CreditCard } from "lucide-react";
import { useThemeBg } from "@/hooks/useTheme";

const METHODS = [
  { id: "apple", label: "Apple Pay", sub: "Activé", icon: "🍎", active: true },
  { id: "google", label: "Google Pay", sub: "Non configuré", icon: "G", active: false },
  { id: "link", label: "Link", sub: "Disponible avec Stripe", icon: "L", active: true },
];

export default function MoyensPaiement() {
  const navigate = useNavigate();
  const themeBg = useThemeBg();
  const [cards, setCards] = useState([
    { id: 1, last4: "8842", holder: "SARAH L.", expiry: "09/27", type: "mastercard" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newCard, setNewCard] = useState({ number: "", holder: "", expiry: "", cvv: "" });
  const [added, setAdded] = useState(false);

  const handleAddCard = () => {
    if (!newCard.number || !newCard.holder || !newCard.expiry) return;
    const last4 = newCard.number.replace(/\s/g, "").slice(-4);
    setCards(prev => [...prev, { id: Date.now(), last4, holder: newCard.holder.toUpperCase(), expiry: newCard.expiry, type: "visa" }]);
    setNewCard({ number: "", holder: "", expiry: "", cvv: "" });
    setShowAdd(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  const formatCard = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const inputClass = "w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-gray-400";

  return (
    <div className="font-display min-h-screen" style={{ background: themeBg }}>
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Paiement</h1>
      </div>

      <div className="px-4 pb-20 pt-6 space-y-5">

        {added && (
          <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-[13px] font-bold text-green-600">Carte ajoutée avec succès !</p>
          </div>
        )}

        {/* Cartes */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Ma carte</p>
          <div className="space-y-3">
            {cards.map(card => (
              <div key={card.id} className="rounded-3xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e2535, #2d3748)" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border border-white/40" />
                  </div>
                  <div className="flex">
                    <div className="w-7 h-7 rounded-full bg-red-500 opacity-90" />
                    <div className="w-7 h-7 rounded-full bg-orange-400 opacity-90 -ml-3" />
                  </div>
                </div>
                <p className="text-white/60 text-[14px] font-mono mb-1">•••• •••• •••• {card.last4}</p>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-[8px] text-white/40 uppercase tracking-widest">Titulaire</p>
                    <p className="text-white text-[13px] font-black">{card.holder}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-white/40 uppercase tracking-widest">Expire</p>
                    <p className="text-white text-[13px] font-black">{card.expiry}</p>
                  </div>
                  <button onClick={() => setCards(prev => prev.filter(c => c.id !== card.id))} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center active:scale-95">
                    <Trash2 className="w-3.5 h-3.5 text-white/60" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Méthodes */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Méthodes de paiement</p>
          <div className="bg-white rounded-3xl overflow-hidden divide-y divide-gray-50">
            {METHODS.map(m => (
              <div key={m.id} className="px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                  <span className="text-[16px] font-black text-blue-600">{m.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-black text-gray-900">{m.label}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{m.sub}</p>
                </div>
                {m.active && <CheckCircle className="w-5 h-5 text-green-500 fill-green-500" />}
              </div>
            ))}
          </div>
        </div>

        {/* Ajouter carte */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full bg-white border-2 border-dashed border-gray-200 rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-gray-400" />
            <span className="text-[13px] font-black text-gray-400 uppercase tracking-widest">Ajouter une méthode</span>
          </button>
        ) : (
          <div className="bg-white rounded-3xl p-5 space-y-4">
            <p className="text-[16px] font-black text-gray-900">Nouvelle carte</p>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Numéro de carte</p>
              <input className={inputClass} placeholder="0000 0000 0000 0000" value={newCard.number} onChange={e => setNewCard(p => ({ ...p, number: formatCard(e.target.value) }))} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Titulaire</p>
              <input className={inputClass} placeholder="NOM PRÉNOM" value={newCard.holder} onChange={e => setNewCard(p => ({ ...p, holder: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Expiration</p>
                <input className={inputClass} placeholder="MM/AA" maxLength={5} value={newCard.expiry} onChange={e => setNewCard(p => ({ ...p, expiry: e.target.value }))} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CVV</p>
                <input className={inputClass} placeholder="•••" maxLength={3} type="password" value={newCard.cvv} onChange={e => setNewCard(p => ({ ...p, cvv: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 font-black text-[13px] text-gray-500 active:scale-95 transition-all">Annuler</button>
              <button onClick={handleAddCard} className="flex-1 py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-widest text-white active:scale-95 transition-all" style={{ background: "#E8732A" }}>Ajouter</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
