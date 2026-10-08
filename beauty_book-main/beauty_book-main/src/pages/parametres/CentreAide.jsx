import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Search, MessageCircle, Phone, Mail } from "lucide-react";
import { useThemeBg } from "@/hooks/useTheme";

const FAQS = [
  { q: "Comment annuler un rendez-vous ?", a: "Vous pouvez annuler un rendez-vous jusqu'à 24h avant depuis la page « Mes Rendez-vous ». Au-delà, des frais d'annulation peuvent s'appliquer selon la politique du salon." },
  { q: "Comment modifier mon profil ?", a: "Rendez-vous dans Paramètres → Modifier le profil. Vous pouvez y changer votre photo, nom, bio et coordonnées." },
  { q: "Comment fonctionne le programme fidélité ?", a: "Chaque réservation vous rapporte des points BeautyCoins. Vous pouvez les utiliser pour obtenir des réductions sur vos prochaines réservations." },
  { q: "Comment devenir professionnel sur BeautyBook ?", a: "Cliquez sur « Devenir Pro » depuis votre profil. Après validation de votre dossier, vous aurez accès à tous les outils professionnels." },
  { q: "Puis-je utiliser plusieurs moyens de paiement ?", a: "Oui, vous pouvez ajouter plusieurs cartes et utiliser Apple Pay, Google Pay ou Link depuis la section Paiement des paramètres, lorsque ces services sont disponibles sur votre appareil." },
  { q: "Comment contacter le support ?", a: "Vous pouvez nous contacter par chat en direct, email ou téléphone. Notre équipe est disponible du lundi au vendredi de 9h à 18h." },
];

export default function CentreAide() {
  const navigate = useNavigate();
  const themeBg = useThemeBg();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);

  const filtered = FAQS.filter(f => f.q.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="font-display min-h-screen" style={{ background: themeBg }}>
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Centre d'aide</h1>
      </div>

      <div className="px-4 pb-20 pt-5 space-y-5">

        {/* Hero */}
        <div className="bg-primary rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -right-2 top-8 w-16 h-16 bg-white/10 rounded-full" />
          <p className="text-white text-[22px] font-black leading-tight mb-1 relative z-10">Comment pouvons-<br />nous vous aider ?</p>
          <p className="text-white/70 text-[12px] font-medium relative z-10">Réponses à vos questions en moins de 2 minutes.</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full bg-white rounded-2xl pl-11 pr-4 py-3.5 text-[14px] font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-gray-400"
            placeholder="Rechercher une question..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* FAQ */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Questions fréquentes</p>
          <div className="space-y-2">
            {filtered.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full px-4 py-4 flex items-center justify-between text-left active:scale-[0.99] transition-all"
                >
                  <p className="text-[14px] font-black text-gray-900 flex-1 pr-3">{faq.q}</p>
                  {open === i ? <ChevronUp className="w-4 h-4 text-primary shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>
                {open === i && (
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Nous contacter</p>
          <div className="space-y-2">
            {[
              { icon: MessageCircle, label: "Chat en direct", sub: "Réponse en moins de 5 minutes", color: "bg-green-50", iconColor: "text-green-500" },
              { icon: Mail, label: "Email", sub: "support@beautybook.fr", color: "bg-blue-50", iconColor: "text-blue-500" },
              { icon: Phone, label: "Téléphone", sub: "+33 1 23 45 67 89", color: "bg-orange-50", iconColor: "text-primary" },
            ].map(({ icon: Icon, label, sub, color, iconColor }, i) => (
              <button key={i} className="w-full bg-white rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.99] transition-all">
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-black text-gray-900">{label}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{sub}</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180 shrink-0" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
