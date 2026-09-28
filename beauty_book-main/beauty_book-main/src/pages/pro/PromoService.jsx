import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Tag, Clock, Percent, Calendar, CheckCircle2, Zap, Target, Users, MapPin, Megaphone, TrendingUp, Eye, MousePointer, CreditCard, Plus } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";

const OBJECTIFS = [
  { id: "visibilite", label: "Visibilité", icon: Eye, desc: "Augmenter les vues de votre profil", color: "bg-blue-50 border-blue-200", activeColor: "bg-blue-500", textColor: "text-blue-600" },
  { id: "reservations", label: "Réservations", icon: Calendar, desc: "Obtenir plus de rendez-vous", color: "bg-green-50 border-green-200", activeColor: "bg-green-500", textColor: "text-green-600" },
  { id: "notoriete", label: "Notoriété", icon: TrendingUp, desc: "Faire connaître votre salon", color: "bg-purple-50 border-purple-200", activeColor: "bg-purple-500", textColor: "text-purple-600" },
  { id: "promo", label: "Promotion", icon: Percent, desc: "Mettre en avant une offre", color: "bg-orange-50 border-orange-200", activeColor: "bg-primary", textColor: "text-primary" },
];

const AUDIENCES = [
  { id: "local", label: "Local", icon: MapPin, desc: "Dans votre quartier" },
  { id: "ville", label: "Ma ville", icon: Target, desc: "Toute la ville" },
  { id: "large", label: "Région", icon: Users, desc: "Zone élargie" },
];

const BUDGETS = [
  { id: "starter", label: "Starter", price: 9, reach: "500–1 000", duration: "3 jours", days: 3 },
  { id: "boost", label: "Boost", price: 29, reach: "3 000–6 000", duration: "7 jours", days: 7, popular: true },
  { id: "pro", label: "Pro", price: 79, reach: "12 000–25 000", duration: "14 jours", days: 14 },
];

// ── Cartes sauvegardées (appareil uniquement — même clé que la réservation)
// On ne stocke JAMAIS le numéro complet ni le CVV : enseigne + 4 derniers chiffres.
const SAVED_CARDS_KEY = "bb_saved_cards";
const CARD_BRAND_LABELS = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", generic: "Carte" };
function loadSavedCards() {
  try {
    const raw = localStorage.getItem(SAVED_CARDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(c => c && c.id && c.last4) : [];
  } catch { return []; }
}
function persistSavedCards(cards) {
  try { localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(cards)); } catch {}
}
function detectBrand(num) {
  const d = String(num || "").replace(/\D/g, "");
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  return "generic";
}

const FORMATS = [
  { id: "story", label: "Story", icon: "📱", desc: "Format vertical plein écran" },
  { id: "feed", label: "Feed", icon: "🖼️", desc: "Dans le fil d'actualité" },
  { id: "banner", label: "Bannière", icon: "📢", desc: "Bandeau en haut du fil" },
];

export default function PromoService() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();
  const service = state?.service || {};
  const isBundle = !!state?.isBundle;

  const [step, setStep] = useState(1); // 1: objectif, 2: audience+format, 3: budget, 4: paiement, 5: récap
  const [form, setForm] = useState({
    objectif: "",
    audience: "ville",
    format: "feed",
    budget: "boost",
    titre: service.title || service.name || "",
    description: "",
    start_date: "",
    cardId: "",
  });
  const [cards, setCards] = useState(loadSavedCards);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ holder: "", number: "", expiry: "" });
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const selectedBudget = BUDGETS.find(b => b.id === form.budget);
  const selectedObjectif = OBJECTIFS.find(o => o.id === form.objectif);
  const selectedCard = cards.find(c => c.id === form.cardId);

  const handleAddCard = () => {
    const digits = newCard.number.replace(/\D/g, "");
    if (digits.length < 15 || !newCard.holder.trim() || !/^\d{2}\/\d{2}$/.test(newCard.expiry.trim())) {
      alert("Vérifiez les informations de la carte (titulaire, numéro, expiration MM/AA).");
      return;
    }
    const card = {
      id: `card_${Date.now()}`,
      brand: detectBrand(digits),
      last4: digits.slice(-4),
      holder: newCard.holder.trim(),
      expiry: newCard.expiry.trim(),
    };
    const next = [...cards, card];
    setCards(next);
    persistSavedCards(next);
    set("cardId", card.id);
    setNewCard({ holder: "", number: "", expiry: "" });
    setShowAddCard(false);
  };

  const handleLaunch = async () => {
    if (!selectedCard) {
      alert("Choisissez un moyen de paiement pour lancer la publicité.");
      setStep(4);
      return;
    }
    setLaunching(true);
    const startDate = form.start_date || new Date().toISOString().slice(0, 10);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (selectedBudget?.days || 7));
    // Sauvegarde l'annonce — target_url lie la pub au service/bundle promu
    await entities.Annonce.create({
      title: form.titre || serviceName,
      description: form.description,
      type: form.format,
      target_url: isBundle ? `/bundle/${service.id}` : `/service/${service.id}`,
      pro_email: user?.email || "",
      pro_name: user?.full_name || "",
      sponsor_name: user?.full_name || "Pro",
      budget: selectedBudget?.price || 0,
      start_date: startDate,
      end_date: endDate.toISOString().slice(0, 10),
      status: "actif",
    }).catch(() => {});
    // Trace locale du paiement (carte masquée uniquement)
    try {
      const ads = JSON.parse(localStorage.getItem("bb_my_ads") || "[]");
      ads.push({
        id: `ad_${Date.now()}`,
        service_id: service.id,
        is_bundle: isBundle,
        amount: selectedBudget?.price || 0,
        card: `${CARD_BRAND_LABELS[selectedCard.brand] || "Carte"} •••• ${selectedCard.last4}`,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem("bb_my_ads", JSON.stringify(ads));
    } catch {}
    setTimeout(() => {
      setLaunching(false);
      setLaunched(true);
    }, 1800);
  };

  const serviceName = service.title || service.name || "Service";

  if (launched) {
    return (
      <div className="font-display min-h-full bg-[#f5f5f5] flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        <div>
          <h2 className="text-[28px] font-black text-gray-900 mb-2">Publicité lancée !</h2>
          <p className="text-[14px] text-gray-500 font-medium leading-relaxed">
            Votre campagne est en cours de diffusion.<br />
            Vous recevrez vos premières statistiques sous 24h.
          </p>
        </div>
        <div className="bg-white rounded-3xl p-5 w-full shadow-sm space-y-3">
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-400 font-medium">Objectif</span>
            <span className="font-black text-gray-900">{selectedObjectif?.label}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-400 font-medium">Budget</span>
            <span className="font-black text-primary">{selectedBudget?.price}€</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-400 font-medium">Payé avec</span>
            <span className="font-black text-gray-900">{selectedCard ? `${CARD_BRAND_LABELS[selectedCard.brand] || "Carte"} •••• ${selectedCard.last4}` : "—"}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-400 font-medium">Portée estimée</span>
            <span className="font-black text-gray-900">{selectedBudget?.reach} vues</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-400 font-medium">Durée</span>
            <span className="font-black text-gray-900">{selectedBudget?.duration}</span>
          </div>
        </div>
        <button onClick={() => navigate("/pro/catalogue-services")}
          className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-primary/40 active:scale-95 transition-all">
          Retour au Catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">
            {isBundle ? "Publicité Bundle" : "L'Enseigne Publicité"}
          </p>
          <h1 className="text-[17px] font-black text-gray-900 leading-tight truncate">{serviceName}</h1>
        </div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(s => (
            <div key={s} className={`rounded-full transition-all ${step >= s ? "bg-primary w-6 h-2" : "bg-gray-200 w-2 h-2"}`} />
          ))}
        </div>
      </div>

      <div className="px-5 pt-5 pb-32 space-y-5">

        {/* ÉTAPE 1 — Objectif */}
        {step === 1 && (
          <>
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Étape 1 / 5</p>
              <h2 className="text-[26px] font-black text-gray-900 leading-tight">Quel est votre<br />objectif ?</h2>
              <p className="text-[13px] text-gray-400 font-medium mt-1">Choisissez ce que vous souhaitez accomplir</p>
            </div>
            <div className="space-y-3">
              {OBJECTIFS.map(({ id, label, icon: Icon, desc, color, textColor }) => (
                <button key={id} onClick={() => set("objectif", id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.99] ${form.objectif === id ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${form.objectif === id ? "bg-primary" : "bg-gray-100"}`}>
                    <Icon className={`w-6 h-6 ${form.objectif === id ? "text-white" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-[15px] font-black ${form.objectif === id ? "text-primary" : "text-gray-900"}`}>{label}</p>
                    <p className="text-[12px] text-gray-400 font-medium">{desc}</p>
                  </div>
                  {form.objectif === id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ÉTAPE 2 — Audience & Format */}
        {step === 2 && (
          <>
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Étape 2 / 5</p>
              <h2 className="text-[26px] font-black text-gray-900 leading-tight">Audience &<br />Format</h2>
            </div>

            {/* Audience */}
            <div>
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3 px-1">Zone de diffusion</p>
              <div className="grid grid-cols-3 gap-2">
                {AUDIENCES.map(({ id, label, icon: Icon, desc }) => (
                  <button key={id} onClick={() => set("audience", id)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${form.audience === id ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
                    <Icon className={`w-5 h-5 ${form.audience === id ? "text-primary" : "text-gray-400"}`} />
                    <span className={`text-[11px] font-black uppercase tracking-wider ${form.audience === id ? "text-primary" : "text-gray-500"}`}>{label}</span>
                    <span className="text-[10px] text-gray-400 font-medium text-center leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3 px-1">Format publicitaire</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map(({ id, label, icon, desc }) => (
                  <button key={id} onClick={() => set("format", id)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${form.format === id ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
                    <span className="text-[22px]">{icon}</span>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${form.format === id ? "text-primary" : "text-gray-500"}`}>{label}</span>
                    <span className="text-[10px] text-gray-400 font-medium text-center leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Titre & Description */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Contenu de l'annonce</p>
              <div className="bg-gray-50 rounded-2xl px-4 py-3">
                <input type="text" value={form.titre} onChange={e => set("titre", e.target.value)}
                  placeholder="Titre de votre pub..."
                  className="w-full bg-transparent text-[15px] font-black text-gray-900 outline-none placeholder:text-gray-400" />
              </div>
              <div className="bg-gray-50 rounded-2xl px-4 py-3">
                <textarea value={form.description} onChange={e => set("description", e.target.value)}
                  placeholder="Description de votre offre, ce qui vous différencie..."
                  rows={3}
                  className="w-full bg-transparent text-[13px] font-medium text-gray-700 outline-none placeholder:text-gray-400 resize-none" />
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE 3 — Budget */}
        {step === 3 && (
          <>
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Étape 3 / 5</p>
              <h2 className="text-[26px] font-black text-gray-900 leading-tight">Choisissez<br />votre budget</h2>
            </div>
            <div className="space-y-3">
              {BUDGETS.map(({ id, label, price, reach, duration, popular }) => (
                <button key={id} onClick={() => set("budget", id)}
                  className={`w-full rounded-3xl border-2 p-5 transition-all active:scale-[0.99] relative overflow-hidden ${form.budget === id ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
                  {popular && (
                    <span className="absolute top-3 right-3 bg-primary text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full tracking-widest">Populaire</span>
                  )}
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${form.budget === id ? "bg-primary" : "bg-gray-100"}`}>
                      <Megaphone className={`w-7 h-7 ${form.budget === id ? "text-white" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-[18px] font-black ${form.budget === id ? "text-primary" : "text-gray-900"}`}>{label}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                          <Eye className="w-3 h-3" /> {reach} vues
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                          <Clock className="w-3 h-3" /> {duration}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[26px] font-black ${form.budget === id ? "text-primary" : "text-gray-900"}`}>{price}€</p>
                      <p className="text-[10px] text-gray-400 font-medium">unique</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Date de début */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">Date de début</p>
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)}
                  className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none" />
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE 4 — Paiement */}
        {step === 4 && (
          <>
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Étape 4 / 5</p>
              <h2 className="text-[26px] font-black text-gray-900 leading-tight">Moyen de<br />paiement</h2>
              <p className="text-[13px] text-gray-400 font-medium mt-1">La campagne de {selectedBudget?.price}€ sera débitée sur la carte choisie</p>
            </div>

            <div className="space-y-3">
              {cards.map(card => (
                <button key={card.id} onClick={() => set("cardId", card.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.99] ${form.cardId === card.id ? "border-primary bg-orange-50" : "border-gray-100 bg-white"}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${form.cardId === card.id ? "bg-primary" : "bg-gray-100"}`}>
                    <CreditCard className={`w-6 h-6 ${form.cardId === card.id ? "text-white" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-[15px] font-black ${form.cardId === card.id ? "text-primary" : "text-gray-900"}`}>
                      {CARD_BRAND_LABELS[card.brand] || "Carte"} •••• {card.last4}
                    </p>
                    <p className="text-[12px] text-gray-400 font-medium">{card.holder}{card.expiry ? ` · Exp. ${card.expiry}` : ""}</p>
                  </div>
                  {form.cardId === card.id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                </button>
              ))}

              {cards.length === 0 && !showAddCard && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center">
                  <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400 font-medium">Aucune carte enregistrée sur cet appareil.</p>
                </div>
              )}

              {!showAddCard ? (
                <button onClick={() => setShowAddCard(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-4 text-gray-500 font-black text-[13px] uppercase tracking-widest active:scale-[0.98] transition-all">
                  <Plus className="w-5 h-5" /> Ajouter une carte
                </button>
              ) : (
                <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3 border border-gray-100">
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Nouvelle carte</p>
                  <input value={newCard.holder} onChange={e => setNewCard(c => ({ ...c, holder: e.target.value }))}
                    placeholder="Titulaire de la carte"
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[14px] font-bold text-gray-900 outline-none border border-gray-200 focus:border-primary placeholder:text-gray-300 placeholder:font-medium" />
                  <input value={newCard.number} onChange={e => setNewCard(c => ({ ...c, number: e.target.value.replace(/[^\d ]/g, "").slice(0, 23) }))}
                    placeholder="Numéro de carte" inputMode="numeric"
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[14px] font-bold text-gray-900 outline-none border border-gray-200 focus:border-primary placeholder:text-gray-300 placeholder:font-medium" />
                  <input value={newCard.expiry} onChange={e => {
                    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                    setNewCard(c => ({ ...c, expiry: v }));
                  }}
                    placeholder="Expiration MM/AA" inputMode="numeric"
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[14px] font-bold text-gray-900 outline-none border border-gray-200 focus:border-primary placeholder:text-gray-300 placeholder:font-medium" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddCard(false)}
                      className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all">
                      Annuler
                    </button>
                    <button onClick={handleAddCard}
                      className="flex-1 py-3 rounded-2xl bg-primary text-white font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all">
                      Enregistrer
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium leading-snug text-center">
                    Seuls l'enseigne et les 4 derniers chiffres sont conservés sur cet appareil.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ÉTAPE 5 — Récapitulatif */}
        {step === 5 && (
          <>
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Étape 5 / 5</p>
              <h2 className="text-[26px] font-black text-gray-900 leading-tight">Récapitulatif<br />de votre campagne</h2>
            </div>

            {/* Aperçu pub */}
            <div className="bg-gradient-to-br from-[#1a2035] to-[#2a3550] rounded-3xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-[11px] font-black uppercase tracking-widest">Aperçu annonce</span>
              </div>
              <p className="text-white text-[20px] font-black leading-tight mb-2">{form.titre || serviceName}</p>
              {form.description && <p className="text-white/60 text-[12px] font-medium leading-relaxed">{form.description}</p>}
              <div className="flex gap-2 mt-4">
                <span className="bg-white/10 rounded-full px-3 py-1 text-white/70 text-[10px] font-black uppercase">{selectedObjectif?.label}</span>
                <span className="bg-white/10 rounded-full px-3 py-1 text-white/70 text-[10px] font-black uppercase">{FORMATS.find(f => f.id === form.format)?.label}</span>
              </div>
            </div>

            {/* Détails */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
              {[
                { label: "Objectif", value: selectedObjectif?.label },
                { label: "Zone", value: AUDIENCES.find(a => a.id === form.audience)?.label },
                { label: "Format", value: FORMATS.find(f => f.id === form.format)?.label },
                { label: "Portée estimée", value: selectedBudget?.reach + " vues" },
                { label: "Durée", value: selectedBudget?.duration },
                { label: "Début", value: form.start_date || "Dès maintenant" },
                { label: "Paiement", value: selectedCard ? `${CARD_BRAND_LABELS[selectedCard.brand] || "Carte"} •••• ${selectedCard.last4}` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">{label}</span>
                  <span className="text-[13px] font-black text-gray-900">{value}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                <span className="text-[15px] font-black text-gray-900">Total</span>
                <span className="text-[26px] font-black text-primary">{selectedBudget?.price}€</span>
              </div>
            </div>

            {/* Stats prévisionnelles */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Eye, label: "Vues", value: selectedBudget?.reach },
                { icon: MousePointer, label: "Clics est.", value: Math.round((parseInt(selectedBudget?.reach) || 1000) * 0.04) + "+" },
                { icon: Calendar, label: "RDV est.", value: Math.round((parseInt(selectedBudget?.reach) || 1000) * 0.008) + "+" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <Icon className="w-4 h-4 text-primary" />
                  <p className="text-[16px] font-black text-gray-900">{value}</p>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* CTA fixe en bas */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5" style={{ paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        {step < 5 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={(step === 1 && !form.objectif) || (step === 4 && !form.cardId)}
            className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-primary/40 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
          >
            Continuer →
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-3xl shadow-xl shadow-primary/40 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70"
          >
            {launching ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Lancement en cours...</>
            ) : (
              <><Megaphone className="w-5 h-5" /> Lancer ma Publicité — {selectedBudget?.price}€</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}