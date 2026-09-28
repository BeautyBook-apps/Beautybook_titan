import { ArrowLeft, MapPin, Clock, CheckCircle2, Loader, Users, Download, CreditCard, Banknote, Share2, Pencil, X, Check, Tag, Lock, Shield, Moon, MessageSquare, Wallet, Trash2, Plus, Store } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { apiClient } from '@/lib/apiClient';
import { notifyPaymentConfirmed } from '@/lib/notificationService';
import QRCode from "qrcode";

// ── Formatage carte bancaire ──────────────────────────────────────────────────
function formatCardNumber(val) {
  const digits = val.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})/g, "$1 ").trim();
}

function formatExpiry(val) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + " / " + digits.slice(2);
  return digits;
}

function getCardType(number) {
  const n = number.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  return "generic";
}

function formatLocation(location) {
  return [location?.address, location?.postalCode, location?.city].filter(Boolean).join(", ");
}

// ── Cartes bancaires sauvegardées (appareil uniquement) ───────────────────────
// On ne stocke JAMAIS le numéro complet ni le CVV : uniquement l'enseigne,
// les 4 derniers chiffres, le titulaire et l'expiration.
const SAVED_CARDS_KEY = "bb_saved_cards";
function loadSavedCards() {
  try {
    const raw = localStorage.getItem(SAVED_CARDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(c => c && c.id && c.last4) : [];
  } catch {
    return [];
  }
}
function persistSavedCards(cards) {
  try { localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(cards)); } catch {}
}
const CARD_BRAND_LABELS = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", generic: "Carte" };

function normalizeAddressPrediction(pred) {
  const ban = pred?.properties;
  if (ban) {
    const coordinates = pred.geometry?.coordinates;
    const address = [ban.housenumber, ban.street || ban.name].filter(Boolean).join(" ");
    return {
      ...pred,
      address: address || ban.label || "",
      postalCode: ban.postcode || "",
      city: ban.city || ban.municipality || "",
      coordinates: coordinates?.length === 2 ? { latitude: coordinates[1], longitude: coordinates[0] } : null,
      description: ban.label || formatLocation({ address, postalCode: ban.postcode, city: ban.city }),
    };
  }
  const parts = pred?.structured || pred?.address || {};
  const components = pred?.address_components || pred?.structured_formatting;
  const address = pred?.address && typeof pred.address === "string"
    ? pred.address
    : [parts.house_number, parts.road].filter(Boolean).join(" ");
  const postalCode = pred?.postalCode || parts.postcode || components?.find?.(part => part.types?.includes("postal_code"))?.long_name || "";
  const city = pred?.city || parts.city || parts.town || parts.village || components?.find?.(part => part.types?.includes("locality"))?.long_name || "";
  return {
    ...pred,
    address,
    postalCode,
    city,
    description: pred?.description || formatLocation({ address, postalCode, city }),
  };
}

// ── Visuel carte bancaire ─────────────────────────────────────────────────────
function CardVisual({ cardNumber, cardHolder, expiry }) {
  const type = getCardType(cardNumber);
  const display = cardNumber || "•••• •••• •••• ••••";
  const holder = cardHolder || "VOTRE NOM";
  const exp = expiry || "MM / AA";

  return (
    <div className="relative w-full aspect-[1.586/1] max-w-[340px] mx-auto rounded-2xl overflow-hidden shadow-2xl" style={{
      background: type === "visa" ? "linear-gradient(135deg, #1a1f71 0%, #2d3489 50%, #4a5ab9 100%)"
        : type === "mastercard" ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
        : "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #404040 100%)"
    }}>
      {/* Texture overlay */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)" }} />

      {/* Chip + Type */}
      <div className="absolute top-4 left-5 flex items-center gap-3">
        <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 shadow-inner" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)" }}>
          <div className="w-full h-full rounded-md border border-yellow-700/30" style={{ background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)" }} />
        </div>
        {type === "visa" && <span className="text-white/80 text-[18px] font-black italic tracking-tight">VISA</span>}
        {type === "mastercard" && (
          <div className="flex items-center -space-x-2">
            <div className="w-5 h-5 rounded-full bg-red-500/80" />
            <div className="w-5 h-5 rounded-full bg-yellow-500/80" />
          </div>
        )}
        {type === "amex" && <span className="text-white/80 text-[14px] font-black tracking-wider">AMEX</span>}
        {type === "generic" && <CreditCard className="w-5 h-5 text-white/60" />}
      </div>

      {/* Card Number */}
      <div className="absolute top-1/2 left-5 -translate-y-1/2">
        <p className="text-[20px] sm:text-[22px] font-mono text-white/90 tracking-[0.15em] font-medium">
          {display}
        </p>
      </div>

      {/* Holder + Expiry */}
      <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
        <div className="flex-1 min-w-0 mr-4">
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">Titulaire</p>
          <p className="text-[13px] font-black text-white/90 uppercase tracking-wider truncate">{holder}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">Expire</p>
          <p className="text-[14px] font-black text-white/90 tracking-wider font-mono">{exp}</p>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire carte bancaire ─────────────────────────────────────────────────
// Gère aussi les cartes sauvegardées sur l'appareil (enseigne + 4 derniers
// chiffres uniquement, jamais le numéro complet ni le CVV) : sélection d'une
// carte enregistrée (CVV re-demandé) ou saisie d'une nouvelle carte avec
// option de sauvegarde.
function PaymentCardForm({ amount, onPay, saving, savedCards = [], selectedCardId, onSelectCard, onDeleteCard, onSaveCard }) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState("form"); // form | processing | success
  const cvvRef = useRef(null);

  const selectedCard = savedCards.find(c => c.id === selectedCardId) || null;
  const usingSavedCard = !!selectedCard;

  const handleCardNumber = (e) => {
    const raw = e.target.value.replace(/[^\d\s]/g, "");
    setCardNumber(formatCardNumber(raw));
  };

  const handleExpiry = (e) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length >= 2) {
      const month = parseInt(val.slice(0, 2));
      if (month > 12) val = "12" + val.slice(2);
    }
    setExpiry(formatExpiry(val));
  };

  const handleCvv = (e) => {
    setCvv(e.target.value.replace(/\D/g, "").slice(0, 4));
  };

  const isFormValid = usingSavedCard
    ? cvv.length >= 3
    : cardNumber.replace(/\s/g, "").length >= 15
      && cardHolder.trim().length >= 2
      && expiry.replace(/\D/g, "").length === 4
      && cvv.length >= 3;

  const handlePay = async () => {
    if (!isFormValid || paying) return;
    setPaying(true);
    setStep("processing");

    // Simulate payment processing
    await new Promise(r => setTimeout(r, 2200));
    await new Promise(r => setTimeout(r, 800));

    // Sauvegarde de la nouvelle carte (données non sensibles uniquement)
    if (!usingSavedCard && saveCard && onSaveCard) {
      const digits = cardNumber.replace(/\D/g, "");
      onSaveCard({
        brand: getCardType(cardNumber),
        last4: digits.slice(-4),
        holder: cardHolder.trim().toUpperCase(),
        expiry: expiry,
      });
    }

    setStep("success");
    await new Promise(r => setTimeout(r, 1000));
    onPay();
  };

  if (step === "processing") {
    return (
      <div className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
          <Loader className="w-8 h-8 text-primary animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-[16px] font-black text-gray-900">Paiement en cours...</p>
          <p className="text-[12px] text-gray-400 font-medium mt-1">Validation sécurisée en cours</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "70%" }} />
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="bg-white border border-green-100 rounded-3xl p-6 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <div className="text-center">
          <p className="text-[16px] font-black text-green-700">Paiement accepté !</p>
          <p className="text-[12px] text-gray-400 font-medium mt-1">Transaction {Math.random().toString(36).slice(2, 10).toUpperCase()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 space-y-5">
      <div>
        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Paiement par carte</p>
        <p className="text-[11px] text-gray-400 font-medium">Environnement de test — aucun réel débit</p>
      </div>

      {/* Cartes sauvegardées sur cet appareil */}
      {savedCards.length > 0 && !usingSavedCard && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mes cartes enregistrées</p>
          {savedCards.map(card => (
            <div
              key={card.id}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50/60"
            >
              <button
                onClick={() => onSelectCard(card.id)}
                className="flex-1 flex items-center gap-3 text-left active:scale-[0.98] transition-all min-w-0"
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black text-gray-900">
                    {CARD_BRAND_LABELS[card.brand] || "Carte"} •••• {card.last4}
                  </p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">
                    {card.holder || "Titulaire"} {card.expiry ? `• Expire ${card.expiry}` : ""}
                  </p>
                </div>
              </button>
              <button
                onClick={() => onDeleteCard(card.id)}
                aria-label="Supprimer cette carte"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <p className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5 pt-1">
            <Plus className="w-3.5 h-3.5" /> Ou payez avec une nouvelle carte ci-dessous
          </p>
        </div>
      )}

      {/* Carte enregistrée sélectionnée : seul le CVV est re-demandé */}
      {usingSavedCard ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-primary bg-orange-50">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black text-gray-900">
                {CARD_BRAND_LABELS[selectedCard.brand] || "Carte"} •••• {selectedCard.last4}
              </p>
              <p className="text-[11px] text-gray-500 font-medium truncate">
                {selectedCard.holder || ""} {selectedCard.expiry ? `• Expire ${selectedCard.expiry}` : ""}
              </p>
            </div>
            <button
              onClick={() => onSelectCard(null)}
              className="text-[11px] font-black text-primary uppercase tracking-widest shrink-0 active:scale-95 transition-all"
            >
              Changer
            </button>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Code de sécurité (CVV)</label>
            <div className="relative">
              <input
                ref={cvvRef}
                type="text"
                inputMode="numeric"
                value={cvv}
                onChange={handleCvv}
                placeholder="123"
                maxLength={4}
                autoFocus
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 pr-10 text-[15px] font-mono text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300"
              />
              <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            </div>
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">Le CVV n'est jamais conservé.</p>
          </div>
        </div>
      ) : (
      <>
      {/* Card visual */}
      <CardVisual cardNumber={cardNumber} cardHolder={cardHolder} expiry={expiry} />

      {/* Form fields */}
      <div className="space-y-3">
        {/* Numéro */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Numéro de carte</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={cardNumber}
              onChange={handleCardNumber}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 pr-12 text-[15px] font-mono text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300"
            />
            <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          </div>
        </div>

        {/* Nom */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nom du titulaire</label>
          <input
            type="text"
            value={cardHolder}
            onChange={e => setCardHolder(e.target.value.toUpperCase())}
            placeholder="JEAN DUPONT"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-[15px] font-medium text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300 uppercase"
          />
        </div>

        {/* Expiry + CVV */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Expiration</label>
            <input
              type="text"
              inputMode="numeric"
              value={expiry}
              onChange={handleExpiry}
              placeholder="MM / AA"
              maxLength={7}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-[15px] font-mono text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">CVV</label>
            <div className="relative">
              <input
                ref={cvvRef}
                type="text"
                inputMode="numeric"
                value={cvv}
                onChange={handleCvv}
                placeholder="123"
                maxLength={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 pr-10 text-[15px] font-mono text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300"
              />
              <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Sauvegarder la carte (nouvelle carte uniquement) */}
      <button
        onClick={() => setSaveCard(v => !v)}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] text-left"
        style={{ borderColor: saveCard ? "#E8732A" : "#f3f4f6", background: saveCard ? "#fff7f0" : "#fafafa" }}
      >
        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${saveCard ? "bg-primary border-primary" : "border-gray-300 bg-white"}`}>
          {saveCard && <Check className="w-4 h-4 text-white" />}
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-black text-gray-900">Sauvegarder cette carte</p>
          <p className="text-[11px] text-gray-400 font-medium">Uniquement l'enseigne et les 4 derniers chiffres, sur cet appareil.</p>
        </div>
        <Wallet className={`w-5 h-5 shrink-0 ${saveCard ? "text-primary" : "text-gray-300"}`} />
      </button>

      {/* Sécurité */}
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
        <Shield className="w-4 h-4 text-green-500 shrink-0" />
        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Paiement 100% sécurisé SSL/TLS</p>
      </div>

      {/* Test cards info */}
      <details className="group">
        <summary className="text-[11px] text-gray-400 font-medium cursor-pointer hover:text-gray-600 transition-colors">
          Cartes de test disponibles ↓
        </summary>
        <div className="mt-2 space-y-1 bg-gray-50 rounded-xl p-3">
          <div className="flex justify-between text-[11px]">
            <span className="font-mono text-gray-600">4242 4242 4242 4242</span>
            <span className="text-green-500 font-black">Visa ✓</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="font-mono text-gray-600">5555 5555 5555 4444</span>
            <span className="text-green-500 font-black">MC ✓</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="font-mono text-gray-600">3782 822463 10005</span>
            <span className="text-green-500 font-black">Amex ✓</span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium pt-1">Date: any future · CVV: any 3 digits</p>
        </div>
      </details>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={!isFormValid || saving}
        className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: isFormValid ? "#E8732A" : "#ccc" }}
      >
        <Lock className="w-4 h-4" />
        Payer {amount}€ de manière sécurisée
      </button>
      </>
      )}
    </div>
  );
}

// ── Génère un code à 4 chiffres unique ───────────────────────────────────────
function generateCRG() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ── QR Code Canvas ────────────────────────────────────────────────────────────
function QRCodeDisplay({ value, size = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
    });
  }, [value, size]);
  return <canvas ref={canvasRef} className="rounded-xl" />;
}

// ── Écran de confirmation avec QR Code ───────────────────────────────────────
function ConfirmationSuccess({ totalPrice, icsData, crgCode, paymentMode, acompteAmount, payMethod }) {
  const [icsDownloaded, setIcsDownloaded] = useState(false);

  // Auto-download ICS on mount (iPhone/iOS will prompt "Ajouter à l'agenda")
  useEffect(() => {
    if (icsData && !icsDownloaded) {
      const raw = decodeURIComponent(escape(atob(icsData)));
      const blob = new Blob([raw], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "beautybook-rdv.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIcsDownloaded(true);
    }
  }, [icsData, icsDownloaded]);

  const downloadICS = () => {
    if (!icsData) return;
    const raw = decodeURIComponent(escape(atob(icsData)));
    const blob = new Blob([raw], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beautybook-rdv.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAppleCalendar = () => {
    if (!icsData) return;
    const raw = decodeURIComponent(escape(atob(icsData)));
    const blob = new Blob([raw], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const shareCode = () => {
    if (navigator.share) {
      navigator.share({ title: "Ma réservation BeautyBook", text: `Mon code de réservation : ${crgCode}` });
    } else {
      navigator.clipboard.writeText(crgCode).catch(() => {});
    }
  };

  const resteAPayer = paymentMode === "acompte" ? (totalPrice - acompteAmount).toFixed(2) : 0;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-5 pt-10 pb-16 gap-6">
      {/* Icône succès */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl" style={{ background: "#E8732A" }}>
        <CheckCircle2 className="w-10 h-10 text-white" />
      </div>

      <div className="text-center">
        <h2 className="text-[30px] font-black text-gray-900 leading-tight mb-1">Réservation<br />Confirmée !</h2>
        <p className="text-[13px] text-gray-400 font-medium">Rappels automatiques 24h et 2h avant votre RDV 🌟</p>
      </div>

      {/* Code à 4 chiffres */}
      <div className="w-full bg-gray-900 rounded-3xl p-6 flex flex-col items-center gap-4">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Votre code de validation</p>

        {/* Les 4 chiffres bien séparés */}
        <div className="flex items-center gap-3">
          {crgCode.split("").map((digit, i) => (
            <div key={i} className="w-16 h-20 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center">
              <span className="text-[38px] font-black text-white">{digit}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 font-medium text-center leading-relaxed">
          Communiquez ce code au professionnel à votre arrivée.<br />
          Il débloquera votre prestation et vos points fidélité.
        </p>

        <button
          onClick={shareCode}
          className="flex items-center gap-2 bg-white/10 text-white text-[12px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl active:scale-95 transition-all border border-white/20"
        >
          <Share2 className="w-4 h-4" />
          Partager le code
        </button>
      </div>

      {/* Récap paiement */}
      {paymentMode === "acompte" && (
        <div className="w-full bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4 space-y-2">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Récap paiement</p>
          <div className="flex justify-between">
            <span className="text-[13px] text-gray-600 font-medium">
              {payMethod === "onsite" ? "Acompte (30%) à régler au salon" : "Acompte payé (30%)"}
            </span>
            <span className={`text-[13px] font-black ${payMethod === "onsite" ? "text-gray-900" : "text-green-600"}`}>
              {payMethod === "onsite" ? "" : "✓ "}{acompteAmount}€
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[13px] text-gray-600 font-medium">Reste à payer au salon</span>
            <span className="text-[13px] font-black text-gray-900">{resteAPayer}€</span>
          </div>
        </div>
      )}

      {paymentMode === "full" && payMethod === "onsite" && (
        <div className="w-full bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Store className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-[13px] font-black text-blue-700">Paiement de {totalPrice}€ au salon</p>
        </div>
      )}

      {paymentMode === "full" && payMethod !== "onsite" && (
        <div className="w-full bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-[13px] font-black text-green-700">Paiement complet effectué ✓</p>
        </div>
      )}

      {/* Points fidélité */}
      <div className="w-full bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-[22px]">🎁</span>
        <div>
          <p className="text-[12px] font-black text-primary">+{Math.floor(totalPrice)} points fidélité</p>
          <p className="text-[11px] text-gray-500 font-medium">Crédités après votre prestation</p>
        </div>
      </div>

      {/* Calendrier */}
      <div className="w-full space-y-2">
        {/* Google Calendar */}
        <a
          href={(() => {
            const pad = (n) => String(n).padStart(2, "0");
            const b = window.__bb_last_booking__;
            if (!b) return "#";
            const [y, mo, d] = (b.dateStr || "2000-01-01").split("-").map(Number);
            const [sh, sm] = (b.time || "00:00").split(":").map(Number);
            const endT = sh * 60 + sm + (b.totalDuration || 60);
            const eh = Math.floor(endT / 60) % 24, em = endT % 60;
            const fmt = (yy, mm, dd, hh, min) => `${yy}${pad(mm)}${pad(dd)}T${pad(hh)}${pad(min)}00`;
            const p = new URLSearchParams({
              action: "TEMPLATE",
              text: `💆 BeautyBook – ${b.serviceName || "RDV"}`,
              dates: `${fmt(y, mo, d, sh, sm)}/${fmt(y, mo, d, eh, em)}`,
              details: `Prestataire: ${b.salonName || ""}\nCode: ${b.crgCodeVal || ""}`,
              location: b.salonAddress || b.salonName || "",
            });
            return `https://calendar.google.com/calendar/render?${p.toString()}`;
          })()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#4285F4] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all w-full"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
          Ajouter à Google Calendar
        </a>
        {/* Apple Calendar (iOS) */}
        {icsData && (
          <button
            onClick={openAppleCalendar}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all w-full"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.81 11.78 5.72 12.57 5.72C13.36 5.72 14.85 4.62 16.4 4.8C17.06 4.83 18.85 5.07 19.97 6.72C19.88 6.79 17.66 8.04 17.68 10.78C17.71 14.05 20.56 15.11 20.59 15.12C20.56 15.21 20.12 16.77 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/></svg>
            Ajouter à Apple Calendar
          </button>
        )}
        {/* ICS / Autre calendrier */}
        {icsData && (
          <button
            onClick={downloadICS}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all w-full"
          >
            <Download className="w-4 h-4" />
            Télécharger le fichier .ics
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StepConfirmation({ booking, onConfirm, onBack }) {
  const [confirmed, setConfirmed] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMode, setPaymentMode] = useState("full"); // "full" | "acompte"
  const [payMethod, setPayMethod] = useState("card"); // "card" | "onsite"
  const [savedCards, setSavedCards] = useState(loadSavedCards);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [paid, setPaid] = useState(false);
  const [icsData, setIcsData] = useState(null);
  const [crgCode] = useState(() => generateCRG());
  const [editingLieu, setEditingLieu] = useState(false);
  const [customAddress, setCustomAddress] = useState("");
  const [customPostalCode, setCustomPostalCode] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customCoordinates, setCustomCoordinates] = useState(null);
  const [customName, setCustomName] = useState("");
  const [savedLieu, setSavedLieu] = useState({ name: "", address: "", postalCode: "", city: "", coordinates: null });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const addressDebounceRef = useRef(null);
  const transportRequestRef = useRef(0);
  const scrollRef = useRef(null);
  const summaryRef = useRef(null);
  const [clientNotes, setClientNotes] = useState(booking.notes || "");

  useLayoutEffect(() => {
    const scrollTop = () => {
      scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    scrollTop();
    const frame = requestAnimationFrame(scrollTop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // À l'ouverture de l'étape, amener directement le résumé de la réservation
  // en haut de l'écran (le contenu asynchrone peut décaler le scroll initial).
  useEffect(() => {
    const t = setTimeout(() => {
      const container = scrollRef.current;
      const el = summaryRef.current;
      if (container && el) {
        container.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: "smooth" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // ── Cartes sauvegardées ──
  const handleSaveCard = (card) => {
    const entry = { ...card, id: `card_${Date.now()}` };
    setSavedCards(prev => {
      // Évite les doublons (même enseigne + 4 derniers chiffres + expiration)
      if (prev.some(c => c.brand === entry.brand && c.last4 === entry.last4 && c.expiry === entry.expiry)) {
        return prev;
      }
      const next = [...prev, entry].slice(-5); // max 5 cartes
      persistSavedCards(next);
      return next;
    });
    setSelectedCardId(entry.id);
  };
  const handleDeleteCard = (id) => {
    setSavedCards(prev => {
      const next = prev.filter(c => c.id !== id);
      persistSavedCards(next);
      return next;
    });
    setSelectedCardId(prev => (prev === id ? null : prev));
  };

  // Synchroniser le lieu avec le profil pro
  useEffect(() => {
    const proEmail = booking.services?.[0]?.pro_email || booking.salon?.pro_email;
    if (!proEmail) {
      const fallback = {
        name: booking.salon?.name || "",
        address: booking.salon?.address || "",
        postalCode: booking.salon?.postal_code || booking.salon?.postalCode || "",
        city: booking.salon?.city || "",
        coordinates: null,
      };
      setSavedLieu(fallback);
      setCustomName(fallback.name);
      setCustomAddress(fallback.address);
      setCustomPostalCode(fallback.postalCode);
      setCustomCity(fallback.city);
      setCustomCoordinates(fallback.coordinates);
      return;
    }
    entities.ProfilPro.filter({ user_email: proEmail }, "-created_at", 1)
      .then(profils => {
        const p = profils[0];
        const lieu = {
          name: p?.salon_name || booking.salon?.name || "",
          address: p?.address || booking.salon?.address || "",
          postalCode: p?.postal_code || booking.salon?.postal_code || booking.salon?.postalCode || "",
          city: p?.city || booking.salon?.city || "",
          coordinates: Number.isFinite(Number(p?.latitude)) && Number.isFinite(Number(p?.longitude))
            ? { latitude: Number(p.latitude), longitude: Number(p.longitude) }
            : null,
        };
        setSavedLieu(lieu);
        setCustomName(lieu.name);
        setCustomAddress(lieu.address);
        setCustomPostalCode(lieu.postalCode);
        setCustomCity(lieu.city);
        setCustomCoordinates(lieu.coordinates);
      })
      .catch(() => {});
  }, []);

  const handleAddressChange = (val) => {
    setCustomAddress(val);
    setCustomCoordinates(null);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (val.length < 3) { setAddressSuggestions([]); return; }
    addressDebounceRef.current = setTimeout(async () => {
      setLoadingAddress(true);
      try {
        const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(val)}&limit=5&autocomplete=1`);
        if (!response.ok) throw new Error("BAN indisponible");
        const results = await response.json();
        let suggestions = results.features || [];
        if (suggestions.length === 0) {
          suggestions = [{
            description: `Utiliser cette adresse : ${val}`,
            address: val,
            postalCode: "",
            city: "",
            manual: true,
          }];
        }
        setAddressSuggestions(suggestions.map(normalizeAddressPrediction));
      } catch { setAddressSuggestions([]); }
      finally { setLoadingAddress(false); }
    }, 400);
  };

  const selectSuggestion = (pred) => {
    const normalized = normalizeAddressPrediction(pred);
    setCustomAddress(normalized.address || normalized.description || "");
    setCustomPostalCode(normalized.postalCode);
    setCustomCity(normalized.city);
    setCustomCoordinates(normalized.coordinates || null);
    setAddressSuggestions([]);
  };

  const totalPersons = booking.services.reduce((s, svc) => s + (svc.persons || 1), 0);
  const basePrice = booking.bundle?.bundle_price
    ? booking.bundle.bundle_price
    : booking.services.reduce((s, svc) => s + svc.price * (svc.persons || 1), 0);
  const totalDuration = booking.services.reduce((s, svc) => s + (svc.duration_min || parseInt(svc.duration) || 60), 0);

  // ── Majoration nocturne (+50%) si créneau entre 21h et 07h ──
  const isNightSlot = (() => {
    const time = booking.time;
    if (!time) return false;
    const [h] = time.split(":").map(Number);
    return h >= 21 || h < 7;
  })();
  const nightSurcharge = isNightSlot ? Math.round(basePrice * 0.5 * 100) / 100 : 0;

  // ── Frais de transport (si adresse modifiée à domicile) ──
  const TRANSPORT_RATE_PER_KM = 0.50; // 0.50€ par km
  const MIN_TRANSPORT_FEE = 3.00;     // minimum 3€
  const [transportDistance, setTransportDistance] = useState(0);
  const [transportFee, setTransportFee] = useState(0);
  const [transportLoading, setTransportLoading] = useState(false);

  // Calculer la distance quand l'adresse change
  useEffect(() => {
    const calcTransport = async () => {
      const requestId = ++transportRequestRef.current;
      const salonAddress = formatLocation(savedLieu);
      const destinationAddress = formatLocation({ address: customAddress, postalCode: customPostalCode, city: customCity });
      if (!salonAddress || !destinationAddress) {
        setTransportFee(0);
        setTransportDistance(0);
        return;
      }
      // Si l'adresse est la même que le salon, pas de frais
      if (destinationAddress.toLowerCase().trim() === salonAddress.toLowerCase().trim()) {
        setTransportFee(0);
        setTransportDistance(0);
        return;
      }
      setTransportLoading(true);
      try {
        const geocode = async (address, coordinates) => {
          if (coordinates?.latitude && coordinates?.longitude) return coordinates;
          const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`);
          if (!response.ok) throw new Error("BAN indisponible");
          const data = await response.json();
          const point = data.features?.[0]?.geometry?.coordinates || [];
          return point.length === 2 ? { latitude: point[1], longitude: point[0] } : null;
        };
        const [origin, destination] = await Promise.all([
          geocode(salonAddress, savedLieu.coordinates),
          geocode(destinationAddress, customCoordinates),
        ]);
        if (requestId !== transportRequestRef.current) return;
        if (origin && destination) {
          const lat1 = origin.latitude, lng1 = origin.longitude;
          const lat2 = destination.latitude, lng2 = destination.longitude;
          // Haversine
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLng = ((lng2 - lng1) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          setTransportDistance(Math.round(dist * 10) / 10);
          setTransportFee(Math.max(MIN_TRANSPORT_FEE, Math.round(dist * TRANSPORT_RATE_PER_KM * 100) / 100));
        }
      } catch (e) {
        console.warn('[Transport] Geocoding error:', e);
        if (requestId === transportRequestRef.current) {
          setTransportDistance(0);
          setTransportFee(0);
        }
      }
      if (requestId === transportRequestRef.current) setTransportLoading(false);
    };
    calcTransport();
  }, [customAddress, customPostalCode, customCity, customCoordinates, savedLieu]);

  const totalPrice = basePrice + nightSurcharge + transportFee;
  const acompteAmount = Math.round(totalPrice * 0.3 * 100) / 100;
  const isHomeService = Boolean(customAddress && formatLocation(savedLieu) &&
    formatLocation({ address: customAddress, postalCode: customPostalCode, city: customCity }).toLowerCase().trim() !== formatLocation(savedLieu).toLowerCase().trim());
  const dateStr = booking.date ? format(booking.date, "yyyy-MM-dd") : null;

  const buildPayload = (pType) => {
    const pro_email = booking.services[0]?.pro_email || booking.salon?.pro_email || "";
    return {
      pro_email,
      pro_name: savedLieu.name || "",
      service_id: booking.services[0]?.id || "",
      service_name: booking.services.map(s => s.title || s.name).join(" + "),
      service_price: basePrice,
      date: dateStr,
      time_slot: booking.time || "00:00",
      duration_min: totalDuration,
      persons: totalPersons,
      total_price: totalPrice,
      night_surcharge: nightSurcharge,
      transport_fee: transportFee,
      transport_distance_km: transportDistance,
      service_location: isHomeService ? "domicile" : "salon",
      client_address: isHomeService ? customAddress : "",
      client_postal_code: isHomeService ? customPostalCode : "",
      client_city: isHomeService ? customCity : "",
      client_latitude: isHomeService ? customCoordinates?.latitude || null : null,
      client_longitude: isHomeService ? customCoordinates?.longitude || null : null,
      salon_name: savedLieu.name || "",
      salon_address: formatLocation(savedLieu),
      seat_number: booking.seat || null,
      payment_type: pType,
      crg_code: crgCode,
      notes: clientNotes || "",
      addons: booking.bundle ? { bundle_id: booking.bundle.id, bundle_name: booking.bundle.name, bundle_price: booking.bundle.bundle_price } : null,
      source: "app",
    };
  };

  const handleConfirmAndBook = async (method = "card") => {
    const payOnSite = method === "onsite";
    setSaving(true);
    setPaid(true);
    setError(null);
    try {
      // ── Sauvegarder la réservation via l'API Backend ──────────────────────
      const payload = buildPayload(paymentMode);
      let res;
      try {
        res = await apiClient.callFunction('createReservation', payload);
      } catch (apiError) {
        // The local API requires PostgreSQL configuration; keep reservations usable through Supabase.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Connectez-vous pour confirmer la réservation.');
        const { data: reservation, error: reservationError } = await supabase.from('Reservation').insert({
          client_email: user.email,
          client_name: user.user_metadata?.full_name || '',
          pro_email: payload.pro_email,
          pro_name: payload.pro_name,
          service_id: payload.service_id,
          service_name: payload.service_name,
          service_price: payload.service_price,
          date: payload.date,
          time_slot: payload.time_slot,
          duration_min: payload.duration_min,
          end_time_slot: (() => {
            const [hours, minutes] = payload.time_slot.split(':').map(Number);
            const end = hours * 60 + minutes + payload.duration_min;
            return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
          })(),
          persons: payload.persons,
          total_price: payload.total_price,
          payment_type: payload.payment_type === 'acompte' ? 'acompte' : 'full',
          payment_status: payOnSite ? 'non_paye' : (payload.payment_type === 'acompte' ? 'acompte_paye' : 'paye'),
          status: 'en_attente',
          notes: payload.notes,
          salon_name: payload.salon_name,
          salon_address: payload.salon_address,
          created_by_id: user.id,
        }).select().single();
        if (reservationError) throw new Error(reservationError.message || apiError.message);
        res = { data: { reservation } };
      }

      // Générer l'ICS côté frontend (toujours, même si le backend n'en retourne pas)
      const pad = (n) => String(n).padStart(2, "0");
      const [y, mo, d] = dateStr.split("-").map(Number);
      const [sh, sm] = (booking.time || "00:00").split(":").map(Number);
      // Créneau de nuit après minuit (00:00–07:00) : il appartient au lendemain
      // calendaire de la date de session (journée pro 09:00 → 07:00).
      const icsDay = new Date(y, mo - 1, d + (sh < 7 ? 1 : 0));
      const fmtICS = (dt) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
      const dtStartObj = new Date(icsDay.getFullYear(), icsDay.getMonth(), icsDay.getDate(), sh, sm);
      const dtEndObj = new Date(dtStartObj.getTime() + totalDuration * 60000);
      const dtStart = `${fmtICS(dtStartObj)}00`;
      const dtEnd = `${fmtICS(dtEndObj)}00`;
      const uid = `beautybook-${Date.now()}@beautybook`;
      const serviceName = booking.services.map(s => s.title || s.name).join(" + ");
      const salonName = savedLieu.name || "";
      const salonAddress = savedLieu.address || "";

      const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//BeautyBook//FR",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `SUMMARY:💆 ${serviceName}`,
        `DESCRIPTION:Prestataire: ${salonName}\\nCode: ${crgCode}`,
        `LOCATION:${salonAddress}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Rappel: votre RDV BeautyBook demain",
        "END:VALARM",
        "BEGIN:VALARM",
        "TRIGGER:-PT2H",
        "ACTION:DISPLAY",
        "DESCRIPTION:Rappel: votre RDV BeautyBook dans 2 heures",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");

      // Encoder en base64
      const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));
      setIcsData(icsBase64);

      // Stocker les données pour le lien Google Calendar sur l'écran de confirmation
      window.__bb_last_booking__ = {
        dateStr,
        time: booking.time,
        totalDuration,
        serviceName,
        salonName,
        salonAddress,
        crgCodeVal: crgCode,
      };

      setConfirmed(true);

      // Notification paiement au client (uniquement si un paiement en ligne a eu lieu)
      if (!payOnSite) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const amount = paymentMode === "acompte" ? Math.round(totalPrice * 0.3) : totalPrice;
          await notifyPaymentConfirmed({
            clientEmail: user?.email,
            serviceName,
            amount,
            date: dateStr,
          });
        } catch (e) {
          console.error("Payment notification error:", e);
        }
      }
    } catch (err) {
      const msg = err?.message || "Erreur lors de la réservation. Veuillez réessayer.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (confirmed) {
    return (
      <ConfirmationSuccess
        totalPrice={totalPrice}
        icsData={icsData}
        crgCode={crgCode}
        paymentMode={paymentMode}
        acompteAmount={acompteAmount}
        payMethod={payMethod}
      />
    );
  }

  const amountToPay = paymentMode === "acompte" ? acompteAmount : totalPrice;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between border-b border-gray-100">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Étape 3 sur 3</p>
          <p className="text-[17px] font-black text-gray-900">Confirmation</p>
        </div>
        <div className="w-9" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-5 pb-4 space-y-4">

        {/* ── Ticket récapitulatif ── */}
        <div ref={summaryRef} className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
          {/* En-tête ticket */}
          <div className="px-5 pt-5 pb-4 border-b border-dashed border-gray-200" style={{ background: "linear-gradient(135deg,#fff7f0 0%,#fff 100%)" }}>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">🎟 Résumé de la réservation</p>
            {booking.services.map(svc => (
              <div key={svc.id} className="flex items-start justify-between gap-2 mb-2 last:mb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-black text-gray-900 leading-tight">{svc.title || svc.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 bg-orange-50 rounded-full px-2.5 py-1 border border-orange-100">
                      <Clock className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-black text-primary">{svc.duration_min} min</span>
                    </span>
                    {(svc.persons || 1) > 1 && (
                      <span className="flex items-center gap-1 bg-blue-50 rounded-full px-2.5 py-1 border border-blue-100">
                        <Users className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-black text-blue-600">{svc.persons} pers.</span>
                      </span>
                    )}
                    {svc.category && (
                      <span className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1">
                        <Tag className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] font-black text-gray-500">{svc.category}</span>
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[18px] font-black text-gray-900 shrink-0">{svc.price * (svc.persons || 1)}€</span>
              </div>
            ))}
          </div>

          {/* Grille infos */}
          <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-gray-100">
            {/* Date */}
            <div className="px-4 py-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">📅 Date</p>
              <p className="text-[13px] font-black text-gray-900 capitalize">
                {booking.date ? format(booking.date, "EEE d MMM", { locale: fr }) : "—"}
              </p>
            </div>
            {/* Heure */}
            <div className="px-4 py-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">⏰ Heure</p>
              <p className="text-[13px] font-black text-gray-900">{booking.time || "—"}</p>
              {booking.time && (
                <p className="text-[10px] text-gray-400 font-medium">→ {(() => {
                  const [h, m] = (booking.time || "00:00").split(":").map(Number);
                  const total = h * 60 + m + totalDuration;
                  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                })()}</p>
              )}
            </div>
            {/* Durée */}
            <div className="px-4 py-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">⏱ Durée</p>
              <p className="text-[13px] font-black text-gray-900">{totalDuration} min</p>
            </div>
            {/* Siège */}
            <div className="px-4 py-4">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">💺 Siège</p>
              <p className="text-[13px] font-black text-gray-900">
                {booking.seat ? `Siège n°${booking.seat}` : "Attribué à l'arrivée"}
              </p>
            </div>
          </div>
        {/* 📋 Caractéristiques & Réponses aux questions */}
        {booking.customAnswers && Object.keys(booking.customAnswers).length > 0 && (
          <div className="bg-orange-50/80 border border-orange-200/70 rounded-3xl p-4.5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#E8732A] font-black text-[12px] uppercase tracking-wider">
              <span>📋</span> Caractéristiques & Réponses aux questions
            </div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              {Object.entries(booking.customAnswers).map(([questionText, answerVal]) => (
                answerVal ? (
                  <div key={questionText} className="bg-white rounded-2xl p-3 border border-orange-100/80 shadow-2xs">
                    <p className="text-[11px] font-bold text-gray-500">{questionText}</p>
                    <p className="text-[13px] font-black text-gray-900 mt-0.5">{Array.isArray(answerVal) ? answerVal.join(", ") : answerVal}</p>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}

        {/* Commentaire client */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[13px] font-black text-gray-900">Commentaire</p>
              <p className="text-[10px] text-gray-400 font-medium">Informations pour le professionnel</p>
            </div>
          </div>
          <textarea
            value={clientNotes}
            onChange={e => setClientNotes(e.target.value)}
            placeholder="Ex: allergies, demandes spéciales, étage, code d'accès…"
            rows={3}
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[13px] text-gray-700 font-medium outline-none border border-gray-200 focus:border-primary resize-none placeholder:text-gray-300"
          />
        </div>

        {/* Lieu */}
        <div className="rounded-3xl p-5 text-white" style={{ background: "#111" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lieu</p>
              {isHomeService && <span className="rounded-full bg-orange-500/20 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-orange-300">Prestation à domicile</span>}
            </div>
            {!editingLieu && (
              <button
                onClick={() => { setEditingLieu(true); setCustomName(savedLieu.name); setCustomAddress(savedLieu.address); setCustomPostalCode(savedLieu.postalCode); setCustomCity(savedLieu.city); setCustomCoordinates(savedLieu.coordinates || null); }}
                className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5 active:scale-95 transition-all border border-white/10"
              >
                <Pencil className="w-3 h-3 text-white/60" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Modifier</span>
              </button>
            )}
          </div>

          {editingLieu ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nom du lieu</p>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Ex : Salon de Julie, Domicile..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-[14px] font-medium outline-none placeholder:text-gray-500"
                />
              </div>
              <div className="relative">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Adresse</p>
                <div className="relative">
                  <input
                    value={customAddress}
                    onChange={e => handleAddressChange(e.target.value)}
                    placeholder="Ex : 12 rue de la Paix, Paris 75001"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-10 text-white text-[14px] font-medium outline-none placeholder:text-gray-500"
                  />
                  {loadingAddress && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {addressSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-gray-800 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                    {addressSuggestions.map((pred, i) => (
                      <button
                        key={i}
                        onClick={() => selectSuggestion(pred)}
                        className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-white/10 active:bg-white/15 transition-all border-b border-white/5 last:border-0"
                      >
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-[12px] text-white font-medium leading-snug">{pred.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Code postal</p>
                  <input
                    value={customPostalCode}
                    onChange={e => setCustomPostalCode(e.target.value)}
                    placeholder="91190"
                    inputMode="numeric"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-[14px] font-medium outline-none placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Ville</p>
                  <input
                    value={customCity}
                    onChange={e => setCustomCity(e.target.value)}
                    placeholder="Gif-sur-Yvette"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-[14px] font-medium outline-none placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setSavedLieu({ name: customName, address: customAddress, postalCode: customPostalCode, city: customCity, coordinates: customCoordinates });
                    setEditingLieu(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary rounded-xl py-3 font-black text-[13px] text-white uppercase tracking-widest active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" /> Valider
                </button>
                <button
                  onClick={() => setEditingLieu(false)}
                  className="w-12 flex items-center justify-center bg-white/10 rounded-xl border border-white/10 active:scale-95 transition-all"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[18px] font-black text-white leading-tight">{savedLieu.name}</p>
                <p className="text-[12px] text-gray-400 font-medium mt-0.5">{formatLocation(savedLieu) || "Adresse non renseignée"}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Banner Majoration nocturne ── */}
        {isNightSlot && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Moon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-black text-white">Majoration nocturne active</p>
              <p className="text-[11px] text-white/70 font-medium">Créneau entre 21h et 07h → +50% appliqué</p>
            </div>
            <span className="text-[16px] font-black text-white">+{nightSurcharge}€</span>
          </div>
        )}

        {/* ── Détail du prix ── */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Détail du prix</p>
          {isHomeService && <div className="mb-3 rounded-xl bg-orange-50 px-3 py-2 text-[11px] font-black text-orange-600">🏠 Prestation à domicile</div>}
          <div className="space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-500 font-medium">Services</span>
              <span className="font-bold text-gray-900">{basePrice}€</span>
            </div>
            {isNightSlot && (
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500 font-medium">Majoration nocturne (+50%)</span>
                <span className="font-bold text-orange-500">+{nightSurcharge}€</span>
              </div>
            )}
            {transportFee > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500 font-medium">Transport ({transportDistance} km)</span>
                <span className="font-bold text-orange-500">+{transportFee}€</span>
              </div>
            )}
            {transportLoading && (
              <div className="flex justify-between text-[12px] text-gray-400">
                <span>Calcul des frais de déplacement…</span>
                <span className="animate-pulse">En cours</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between">
              <span className="text-[14px] font-black text-gray-900">Total</span>
              <span className="text-[16px] font-black text-primary">{totalPrice}€</span>
            </div>
          </div>
        </div>

        {/* ── Montant à régler ── */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Montant à régler</p>
          <p className="text-[11px] text-gray-400 font-medium mb-4">Choisissez combien régler maintenant.</p>
          <div className="space-y-3">
            {/* Payer en totalité */}
            <button
              onClick={() => setPaymentMode("full")}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${paymentMode === "full" ? "border-primary bg-orange-50" : "border-gray-100 bg-gray-50"}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                <CreditCard className={`w-5 h-5 ${paymentMode === "full" ? "text-primary" : "text-gray-400"}`} />
              </div>
              <div className="flex-1">
                <p className={`text-[14px] font-black ${paymentMode === "full" ? "text-gray-900" : "text-gray-600"}`}>Payer en totalité</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  {payMethod === "onsite" ? "Tout régler au salon le jour J" : "Tout régler maintenant via l'app"}
                </p>
              </div>
              <span className="text-[16px] font-black text-primary">{totalPrice}€</span>
            </button>

            {/* Acompte 30% */}
            <button
              onClick={() => setPaymentMode("acompte")}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${paymentMode === "acompte" ? "border-primary bg-orange-50" : "border-gray-100 bg-gray-50"}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                <Banknote className={`w-5 h-5 ${paymentMode === "acompte" ? "text-primary" : "text-gray-400"}`} />
              </div>
              <div className="flex-1">
                <p className={`text-[14px] font-black ${paymentMode === "acompte" ? "text-gray-900" : "text-gray-600"}`}>Acompte 30%</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  Reste {(totalPrice - acompteAmount).toFixed(2)}€ à régler au salon{payMethod === "onsite" ? "" : " via l'app"}
                </p>
              </div>
              <span className="text-[16px] font-black text-primary">{acompteAmount}€</span>
            </button>
          </div>
        </div>

        {/* ── Moyen de paiement ── */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Moyen de paiement</p>
          <p className="text-[11px] text-gray-400 font-medium mb-4">Payez en ligne ou directement au salon.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPayMethod("card")}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${payMethod === "card" ? "border-primary bg-orange-50" : "border-gray-100 bg-gray-50"}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <CreditCard className={`w-5 h-5 ${payMethod === "card" ? "text-primary" : "text-gray-400"}`} />
              </div>
              <p className={`text-[13px] font-black ${payMethod === "card" ? "text-gray-900" : "text-gray-500"}`}>Carte bancaire</p>
            </button>
            <button
              onClick={() => setPayMethod("onsite")}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${payMethod === "onsite" ? "border-primary bg-orange-50" : "border-gray-100 bg-gray-50"}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <Store className={`w-5 h-5 ${payMethod === "onsite" ? "text-primary" : "text-gray-400"}`} />
              </div>
              <p className={`text-[13px] font-black ${payMethod === "onsite" ? "text-gray-900" : "text-gray-500"}`}>Au salon</p>
            </button>
          </div>
        </div>

        {/* Formulaire carte bancaire (+ cartes sauvegardées) */}
        {payMethod === "card" && (
          <PaymentCardForm
            amount={amountToPay}
            onPay={() => handleConfirmAndBook("card")}
            saving={saving}
            savedCards={savedCards}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            onDeleteCard={handleDeleteCard}
            onSaveCard={handleSaveCard}
          />
        )}

        {/* Paiement au salon */}
        {payMethod === "onsite" && (
          <div className="bg-white border border-gray-100 rounded-3xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-black text-gray-900">Paiement au salon</p>
                <p className="text-[12px] text-gray-500 font-medium mt-1 leading-relaxed">
                  Aucun débit aujourd'hui. Vous réglerez{" "}
                  <span className="font-black text-gray-900">
                    {paymentMode === "acompte" ? `${acompteAmount}€ d'acompte` : `${totalPrice}€`}
                  </span>{" "}
                  directement au salon, en espèces ou par carte.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
              <Shield className="w-4 h-4 text-green-500 shrink-0" />
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Réservation garantie sans paiement en ligne</p>
            </div>
            <button
              onClick={() => handleConfirmAndBook("onsite")}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#E8732A" }}
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmer la réservation
            </button>
          </div>
        )}

        {/* Info QR Code */}
        <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${paid ? "bg-gray-900" : "bg-gray-200 opacity-50"}`}>
          <span className="text-[22px]">📲</span>
          <div>
            <p className={`text-[12px] font-black ${paid ? "text-white" : "text-gray-500"}`}>QR Code de validation</p>
            <p className={`text-[11px] font-medium ${paid ? "text-gray-400" : "text-gray-400"}`}>{paid ? "Présentez-le au salon." : "Disponible après le paiement."}</p>
          </div>
        </div>

        {/* Points à gagner */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-[22px]">🎁</span>
          <div>
            <p className="text-[12px] font-black text-primary">+{Math.floor(totalPrice)} points fidélité</p>
            <p className="text-[11px] text-gray-500 font-medium">Crédités automatiquement après votre prestation</p>
          </div>
        </div>

        {/* Bouton télécharger ticket avant paiement */}
        <button
          disabled={!paid}
          onClick={() => {
            const lines = [
              `🎟 BEAUTYBOOK — TICKET DE RÉSERVATION`,
              ``,
              `Prestation : ${booking.services.map(s => s.title || s.name).join(" + ")}`,
              `Date       : ${booking.date ? format(booking.date, "EEEE d MMMM yyyy", { locale: fr }) : "—"}`,
              `Heure      : ${booking.time || "—"} → ${(() => { const [h, m] = (booking.time || "00:00").split(":").map(Number); const t = h * 60 + m + totalDuration; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; })()}`,
              `Durée      : ${totalDuration} min`,
              `Siège      : ${booking.seat ? `N°${booking.seat}` : "Attribué à l'arrivée"}`,
              `Lieu       : ${savedLieu.name}`,
              `Adresse    : ${savedLieu.address || "Non renseignée"}`,
              ``,
              `Total      : ${totalPrice}€`,
              ``,
              `Code       : ${crgCode}`,
              ``,
              `Merci de votre confiance — BeautyBook`,
            ].join("\n");
            const blob = new Blob([lines], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `beautybook-ticket-${crgCode}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-[13px] uppercase tracking-widest transition-all ${paid ? "border-gray-200 bg-gray-50 text-gray-700 active:scale-95" : "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"}`}
        >
          <Download className="w-4 h-4" />
          Télécharger le ticket
        </button>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-[13px] font-black text-red-500">⚠️ {error}</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
