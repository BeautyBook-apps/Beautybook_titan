import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { apiClient } from '@/lib/apiClient';
import { creditClientFidelite, creditProFidelite } from '@/lib/fideliteClient';
import {
  notifyReservationConfirmed,
  notifyReservationCancelled,
  notifyNewReservation,
} from '@/lib/notificationService';

function emailToDisplayName(email) {
  if (!email) return "Client";
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Search, ChevronRight, Lightbulb, Rocket,
  Scissors, Users, Clock, Megaphone, TrendingUp, UserPlus,
  MoreVertical, Calendar, CheckCircle, ArrowLeft, Phone,
  Mail, Download, ChevronLeft, ChevronDown, Star, MapPin,
  AlertCircle, Loader2, KeyRound, Shield, XCircle, Pencil, Save
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { summarizeHours, hasHoursData, applyNightMode } from "@/lib/hours";

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildWeek(baseDate) {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const SOURCE_CONFIG = {
  app:                { label: "Application",      color: "bg-orange-100 text-orange-600" },
  receptionniste:     { label: "Receptionniste",   color: "bg-green-100 text-green-600" },
  receptionniste_ia:  { label: "Receptionniste IA", color: "bg-green-100 text-green-600" },
  ai_social_media:    { label: "AI Social Media",  color: "bg-violet-100 text-violet-600" },
  maria_ai:           { label: "Maria AI",         color: "bg-orange-100 text-orange-600" },
  maria_assistant:    { label: "Assistant Maria",  color: "bg-violet-100 text-violet-600" },
};

function SourceBadge({ source, className = "" }) {
  const config = SOURCE_CONFIG[source];
  if (!config) return null;
  return (
    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${config.color} ${className}`}>
      {config.label}
    </span>
  );
}

// ── RDV Detail Modal ──────────────────────────────────────────────────────────
function RdvDetailModal({ rdv, onClose, onUpdateStatus, proEmail }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [codeInput, setCodeInput] = useState(["", "", "", ""]);
  const [codeError, setCodeError] = useState(false);
  const [showReliability, setShowReliability] = useState(false);
  const [reliabilityChoice, setReliabilityChoice] = useState(null);
  const [savingScore, setSavingScore] = useState(false);
  const codeRefs = [useRef(), useRef(), useRef(), useRef()];

  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(rdv.date || "");
  const [editTime, setEditTime] = useState(rdv.time || rdv.time_slot || "");
  const [editAddress, setEditAddress] = useState(rdv.salon_address || "");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      await supabase.from("Reservation").update({
        date: editDate,
        time: editTime,
        time_slot: editTime,
        salon_address: editAddress,
      }).eq("id", rdv.id);
      onUpdateStatus(rdv.id, rdv.status);
      rdv.date = editDate;
      rdv.time = editTime;
      rdv.time_slot = editTime;
      rdv.salon_address = editAddress;
      setEditing(false);
    } catch (e) { console.error("Edit RDV error:", e); }
    setSavingEdit(false);
  };

  const statusColors = {
    en_attente: "bg-orange-100 text-orange-600",
    confirme: "bg-green-100 text-green-600",
    annule: "bg-red-100 text-red-500",
    termine: "bg-gray-100 text-gray-500",
    no_show: "bg-red-50 text-red-400",
  };
  const statusLabels = {
    en_attente: "En attente",
    confirme: "Confirmé",
    annule: "Annulé",
    termine: "Terminé",
    no_show: "No Show",
  };

  const handleStatus = async (status, skipClose = false) => {
    setLoading(true);
    if (status === "termine") {
      const result = await apiClient.callFunction("completeReservation", { reservation_id: rdv.id }).catch(() => null);
      if (!result || result.data?.fallback || result.data?.success === false) {
        await supabase.from("Reservation").update({ status }).eq("id", rdv.id);
        // Fallback Vercel: crédit fidelite direct via Supabase
        await creditClientFidelite("reservation", `Prestation : ${rdv.service_name || "Service beauté"}`, rdv.client_email);
        await creditProFidelite("pro_reservation", `Réservation terminée : ${rdv.service_name || "Service beauté"}`, rdv.pro_email);
      }
    } else {
      await supabase.from("Reservation").update({ status }).eq("id", rdv.id);
    }

    // Envoyer notification + email au client
    try {
      const serviceName = rdv.service_name || rdv.service || "votre rendez-vous";
      const date = rdv.date || "";
      const time = rdv.time || rdv.time_slot || "";
      const proDisplayName = rdv.pro_name || rdv.salon_name || proEmail;
      if (status === "confirme") {
        await notifyReservationConfirmed({
          clientEmail: rdv.client_email,
          serviceName, date, time,
          proName: proDisplayName,
        });
        // Envoyer email confirmation
        try {
          await apiClient.callFunction("sendReservationEmail", {
            to: rdv.client_email,
            type: "confirmed",
            clientName: rdv.client_name,
            serviceName, date, time,
            proName: proDisplayName,
          });
        } catch (e) { console.error("Email confirmation error:", e); }
      } else if (status === "annule") {
        await notifyReservationCancelled({
          clientEmail: rdv.client_email, serviceName, date,
          proName: proDisplayName,
        });
        // Envoyer email annulation
        try {
          await apiClient.callFunction("sendReservationEmail", {
            to: rdv.client_email,
            type: "cancelled",
            clientName: rdv.client_name,
            serviceName, date,
            proName: proDisplayName,
          });
        } catch (e) { console.error("Email cancellation error:", e); }
      }
    } catch (e) {
      console.error("Notification error:", e);
    }

    onUpdateStatus(rdv.id, status);
    setLoading(false);
    if (!skipClose) onClose();
  };

  const handleCodeDigit = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...codeInput];
    next[idx] = val;
    setCodeInput(next);
    setCodeError(false);
    if (val && idx < 3) codeRefs[idx + 1].current?.focus();
  };

  const handleCodeKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !codeInput[idx] && idx > 0) {
      codeRefs[idx - 1].current?.focus();
    }
  };

  const handleValidateCode = async () => {
    const entered = codeInput.join("");
    const expected = rdv.crg_code;
    if (!expected || entered !== expected) {
      setCodeError(true);
      setCodeInput(["", "", "", ""]);
      codeRefs[0].current?.focus();
      return;
    }
    await supabase.from("Reservation").update({ status: "termine", code_validated: true }).eq("id", rdv.id);

    // Créditer points fidélité client (+50) et pro (+30) via Supabase direct
    await creditClientFidelite("reservation", `Prestation : ${rdv.service_name || "Service beauté"}`, rdv.client_email);
    await creditProFidelite("pro_reservation", `Réservation terminée : ${rdv.service_name || "Service beauté"}`, rdv.pro_email);

    setShowReliability(true);
  };

  const handleSubmitReliability = async () => {
    if (!reliabilityChoice) return;
    setSavingScore(true);
    try {
      const scoreMap = { present: 100, retard: 50, no_show: 0 };
      const score = scoreMap[reliabilityChoice] ?? 100;
      try {
        await supabase.from("Reservation").update({ reliability_score: score }).eq("id", rdv.id);
      } catch {}
      setShowReliability(false);
      onClose();
    } catch (e) { console.error("Reliability error:", e); }
    setSavingScore(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full rounded-t-3xl px-5 pt-4 pb-24 z-10 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[20px] font-black text-gray-900">Détail du RDV</h2>
          <div className="flex items-center gap-2">
            {rdv.status !== "termine" && rdv.status !== "annule" && (
              editing ? (
                <>
                  <button onClick={() => { setEditing(false); setEditDate(rdv.date || ""); setEditTime(rdv.time || rdv.time_slot || ""); setEditAddress(rdv.salon_address || ""); }}
                    className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                  <button onClick={handleSaveEdit} disabled={savingEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-full text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all">
                    {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Sauver
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </button>
              )
            )}
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
        </div>

        {/* Status badge */}
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest mb-4 ${statusColors[rdv.status] || "bg-gray-100 text-gray-500"}`}>
          {statusLabels[rdv.status] || rdv.status}
        </div>

        {/* Client */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-3">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Client</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-[18px] font-black text-primary">{(rdv.client_name || emailToDisplayName(rdv.client_email) || "?")[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-black text-gray-900">{rdv.client_name || emailToDisplayName(rdv.client_email)}</p>
              {rdv.client_phone && <p className="text-[12px] text-gray-400 font-medium">{rdv.client_phone}</p>}
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              navigate(`/messages?to=${encodeURIComponent(rdv.client_email)}&name=${encodeURIComponent(rdv.client_name || rdv.client_email)}`);
            }}
            className="w-full mt-3 bg-primary/10 text-primary py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Mail className="w-4 h-4" />
            Contacter par message
          </button>
        </div>

        {/* Prestation */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-3">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Prestation</p>
          <p className="text-[16px] font-black text-gray-900">{rdv.service_name}</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[13px] text-primary font-black">{rdv.total_price || rdv.service_price}€</span>
            <span className="text-[12px] text-gray-400 font-medium">{rdv.duration_min} min</span>
          </div>
        </div>

        {/* Date & Heure */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</p>
            {editing ? (
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                className="w-full text-[13px] font-black text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary" />
            ) : (
              <p className="text-[13px] font-black text-gray-900 capitalize">{rdv.date ? format(parseISO(rdv.date), "EEEE d MMMM yyyy", { locale: fr }) : "—"}</p>
            )}
          </div>
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Heure</p>
            {editing ? (
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                className="w-full text-[15px] font-black text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary" />
            ) : (
              <p className="text-[15px] font-black text-gray-900">{rdv.time || rdv.time_slot}</p>
            )}
          </div>
        </div>

        {rdv.notes && (
          <div className="bg-orange-50 rounded-2xl p-4 mb-3 border border-orange-100">
            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Notes client</p>
            <p className="text-[13px] text-gray-700 font-medium">{rdv.notes}</p>
          </div>
        )}

        {/* Adresse salon */}
        {(rdv.salon_address || editing) && (
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Adresse</p>
            {editing ? (
              <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Adresse du salon"
                className="w-full text-[13px] font-black text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-primary" />
            ) : (
              <p className="text-[13px] font-black text-gray-900">{rdv.salon_address}</p>
            )}
          </div>
        )}

        {/* Infos paiement — synchronisé avec le choix client */}
        {(rdv.payment_type || rdv.payment_status) && (() => {
          const type = rdv.payment_type || (rdv.payment_status === "paye" ? "full" : rdv.payment_status === "acompte_paye" ? "acompte" : null);
          const isFull = type === "full";
          const isAcompte = type === "acompte";
          const acompteAmt = isAcompte ? Math.round((rdv.total_price || rdv.service_price || 0) * 0.3 * 100) / 100 : 0;
          const resteAPayer = isAcompte ? ((rdv.total_price || rdv.service_price || 0) - acompteAmt).toFixed(2) : 0;
          return (
            <div className="bg-gray-50 rounded-2xl p-4 mb-3">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Paiement</p>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isFull ? "bg-green-100 text-green-600" :
                  isAcompte ? "bg-orange-100 text-orange-600" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {isFull ? "Paiement complet" : isAcompte ? "Acompte 30%" : rdv.payment_status === "paye" ? "Payé" : "Non payé"}
                </span>
                <span className="text-[11px] font-bold text-gray-700">
                  {isFull ? `${rdv.total_price || rdv.service_price || 0}€` :
                   isAcompte ? `${acompteAmt}€` : ""}
                </span>
              </div>
              {isAcompte && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="h-1.5 flex-1 bg-orange-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: "30%" }} />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Reste {resteAPayer}€ à régler au salon</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Actions selon statut */}
        {rdv.status === "en_attente" && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleStatus("annule")}
              disabled={loading}
              className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-[12px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all"
            >
              Refuser
            </button>
            <button
              onClick={() => handleStatus("confirme")}
              disabled={loading}
              className="flex-1 bg-primary text-white py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accepter"}
            </button>
          </div>
        )}
        {rdv.status === "confirme" && (
          <div className="mt-4 space-y-3">
            {/* Section validation code client */}
            <div className="bg-gray-900 rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-primary" />
                <p className="text-[11px] font-black text-white uppercase tracking-widest">Code client</p>
              </div>
              <p className="text-[11px] text-gray-400 font-medium mb-4">
                Demandez au client son code à 4 chiffres pour valider la prestation et débloquer les fonds.
              </p>
              <div className="flex items-center justify-center gap-3 mb-4">
                {codeInput.map((digit, i) => (
                  <input
                    key={i}
                    ref={codeRefs[i]}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeDigit(e.target.value, i)}
                    onKeyDown={e => handleCodeKeyDown(e, i)}
                    className={`w-14 h-16 text-center text-[32px] font-black rounded-2xl outline-none transition-all ${
                      codeError
                        ? "bg-red-500/20 border-2 border-red-500 text-red-400"
                        : "bg-white/10 border-2 border-white/20 text-white focus:border-primary"
                    }`}
                  />
                ))}
              </div>
              {codeError && (
                <p className="text-center text-[12px] font-black text-red-400 mb-3">Code incorrect — réessayez</p>
              )}
              <button
                onClick={handleValidateCode}
                disabled={loading || codeInput.some(d => !d)}
                className="w-full bg-primary text-white py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Valider"}
              </button>
            </div>
            {/* Annuler */}
            <button
              onClick={() => handleStatus("annule")}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl border border-red-100 text-[12px] font-black text-red-400 uppercase tracking-widest active:scale-95 transition-all"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Page Score de Fiabilite */}
      {showReliability && (
        <div className="fixed inset-0 z-[120] bg-white flex flex-col" style={{ height: "100dvh" }}>
          <div className="flex-1 overflow-y-auto px-5 pt-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-[18px] font-black text-gray-900">Score de Fiabilite</h2>
                  <p className="text-[11px] text-gray-400">{rdv.client_name || emailToDisplayName(rdv.client_email)} · {rdv.service_name}</p>
                </div>
              </div>
              <button onClick={() => { setShowReliability(false); onClose(); }} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-100">
              <p className="text-[12px] text-blue-700 font-medium leading-relaxed">
                Ce score est <strong>visible par tous les professionnels</strong> de la plateforme. Il permet de prioriser les demandes de reservation futures.
              </p>
            </div>
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-4">Le client etait-il present ?</p>
            <div className="space-y-3 pb-6">
              {[
                { key: "present", label: "Present a l'heure", sub: "Le client etait au RDV et a l'heure", color: "border-green-300 bg-green-50", iconColor: "text-green-500" },
                { key: "retard", label: "En retard", sub: "Le client est arrive avec du retard", color: "border-yellow-300 bg-yellow-50", iconColor: "text-yellow-500" },
                { key: "no_show", label: "No-show / Absent", sub: "Le client n'est pas venu sans annuler", color: "border-red-300 bg-red-50", iconColor: "text-red-500" },
              ].map(opt => (
                <button key={opt.key} onClick={() => setReliabilityChoice(opt.key)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${reliabilityChoice === opt.key ? opt.color + " shadow-md" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reliabilityChoice === opt.key ? "bg-white" : "bg-gray-100"}`}>
                      {opt.key === "present" && <CheckCircle className={`w-5 h-5 ${opt.iconColor}`} />}
                      {opt.key === "retard" && <Clock className={`w-5 h-5 ${opt.iconColor}`} />}
                      {opt.key === "no_show" && <XCircle className={`w-5 h-5 ${opt.iconColor}`} />}
                    </div>
                    <div>
                      <p className="text-[14px] font-black text-gray-900">{opt.label}</p>
                      <p className="text-[11px] text-gray-500">{opt.sub}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0 px-5 pb-8 pt-4 bg-white border-t border-gray-100" style={{ paddingBottom: "calc(120px + env(safe-area-inset-bottom, 16px))" }}>
            <button onClick={handleSubmitReliability} disabled={!reliabilityChoice || savingScore}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[14px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {savingScore ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              Confirmer mon avis
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Nouveau RDV Modal ─────────────────────────────────────────────────────────
function NouveauRdvModal({ onClose, proEmail, onCreated }) {
  const [step, setStep] = useState(1); // 1=client, 2=service, 3=datetime
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [searchClient, setSearchClient] = useState("");
  const [searchService, setSearchService] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client: null,
    service: null,
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    notes: "",
  });

  useEffect(() => {
    // Charger clients depuis réservations précédentes
    entities.Reservation.filter({ pro_email: proEmail }, "-created_at", 100)
      .then(reservations => {
        console.log('[NouveauRdv] Loaded previous reservations for clients:', reservations?.length);
        // Also fetch Client table to get real names
        entities.Client.filter({ pro_email: proEmail }, "-created_at", 500)
          .then(clientRows => {
            const nameLookup = {};
            (clientRows || []).forEach(c => {
              if (c.email && c.name) nameLookup[c.email] = c.name;
            });
            const seen = {};
            reservations.forEach(r => {
              if (!seen[r.client_email]) {
                seen[r.client_email] = {
                  email: r.client_email,
                  name: nameLookup[r.client_email] || r.client_name || emailToDisplayName(r.client_email),
                };
              }
            });
            setClients(Object.values(seen));
          })
          .catch(() => {
            const seen = {};
            reservations.forEach(r => {
              if (!seen[r.client_email]) {
                seen[r.client_email] = { email: r.client_email, name: emailToDisplayName(r.client_email) };
              }
            });
            setClients(Object.values(seen));
          });
      }).catch(e => console.error('[NouveauRdv] Error loading clients:', e));
    // Charger services du pro
    entities.Service.filter({ pro_email: proEmail, status: "actif" }, "title", 50)
      .then(s => { console.log('[NouveauRdv] Loaded services:', s?.length); setServices(s || []); })
      .catch(e => console.error('[NouveauRdv] Error loading services:', e));
  }, [proEmail]);

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(searchClient.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchClient.toLowerCase())
  );
  const filteredServices = services.filter(s =>
    s.title?.toLowerCase().includes(searchService.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!form.client || !form.service || !form.date || !form.time) return;
    setSaving(true);
    const payload = {
      pro_email: proEmail,
      pro_name: form.service.pro_email,
      client_email: form.client.email,
      client_phone: form.client.phone || "",
      service_id: form.service.id,
      service_name: form.service.title,
      service_price: form.service.price,
      total_price: form.service.price,
      duration_min: form.service.duration || form.service.duration_min || 60,
      date: form.date,
      time: form.time,
      time_slot: form.time,
      notes: form.notes,
      status: "en_attente",
      payment_status: "non_paye",
      source: "receptionniste",
    };
    const rdv = await entities.Reservation.create(payload);
    // Auto-create Client entry if not exists
    if (form.client.email) {
      entities.Client.filter({ pro_email: proEmail, email: form.client.email }, "-created_at", 1)
        .then(existing => {
          if (existing.length === 0) {
            entities.Client.create({
              pro_email: proEmail,
              name: form.client.name || form.client.email,
              email: form.client.email,
              phone: form.client.phone || "",
              source: "rdv",
              total_spent: form.service.price || 0,
              total_rdv: 1,
              last_rdv_date: form.date,
            });
          }
        }).catch(() => {});
    }
    setSaving(false);
    onCreated(rdv);
    onClose();
  };

  const inputClass = "w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full rounded-t-3xl px-5 pt-4 pb-8 z-10 max-h-[82vh] overflow-y-auto" style={{ marginBottom: '64px' }}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[20px] font-black text-gray-900">Nouveau Rendez-vous</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-all ${step >= s ? "bg-primary" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* Step 1 : Client */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Choisir un client</p>
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3 mb-3">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  value={searchClient}
                  onChange={e => setSearchClient(e.target.value)}
                  placeholder="Nom ou email du client…"
                  className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none"
                />
              </div>
              {/* Nouveau client manuel */}
              {searchClient && !filteredClients.find(c => c.email === searchClient) && (
                <button
                  onClick={() => { setForm(f => ({ ...f, client: { name: searchClient, email: searchClient } })); setStep(2); }}
                  className="w-full flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3.5 mb-2 active:scale-[0.98] transition-all"
                >
                  <UserPlus className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-[13px] font-black text-primary">Ajouter "{searchClient}" comme nouveau client</span>
                </button>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredClients.length === 0 && !searchClient && (
                  <p className="text-center text-[12px] text-gray-400 py-6">Aucun client trouvé. Saisissez un nom pour créer un nouveau client.</p>
                )}
                {filteredClients.map(c => (
                  <button
                    key={c.email}
                    onClick={() => { setForm(f => ({ ...f, client: c })); setStep(2); }}
                    className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-[16px] font-black text-primary">{(c.name || "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[14px] font-black text-gray-900">{c.name}</p>
                      <p className="text-[11px] text-gray-400 font-medium">{c.email}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 : Service */}
        {step === 2 && (
          <div className="space-y-4">
            {form.client && (
              <div className="flex items-center gap-2 bg-green-50 rounded-2xl px-4 py-3 border border-green-100">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-[13px] font-black text-green-700">{form.client.name}</span>
              </div>
            )}
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Choisir une prestation</p>
            <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                value={searchService}
                onChange={e => setSearchService(e.target.value)}
                placeholder="Rechercher une prestation…"
                className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredServices.length === 0 && (
                <p className="text-center text-[12px] text-gray-400 py-6">Aucun service actif. Créez-en un dans Catalogue Services.</p>
              )}
              {filteredServices.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setForm(f => ({ ...f, service: s })); setStep(3); }}
                  className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-all shadow-sm"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                    <Scissors className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[14px] font-black text-gray-900">{s.title}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{s.duration_min} min • {s.category}</p>
                  </div>
                  <span className="text-[15px] font-black text-primary">{s.price}€</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="text-[12px] font-black text-gray-400 uppercase tracking-widest">← Retour</button>
          </div>
        )}

        {/* Step 3 : Date & heure */}
        {step === 3 && (
          <div className="space-y-4">
            {form.service && (
              <div className="flex items-center gap-2 bg-green-50 rounded-2xl px-4 py-3 border border-green-100">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-[13px] font-black text-green-700">{form.service.title} – {form.service.price}€</span>
              </div>
            )}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Date</p>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Heure</p>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notes (optionnel)</p>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Instructions, précisions..."
                rows={3}
                className={inputClass + " resize-none"}
              />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(2)} className="text-[12px] font-black text-gray-400 uppercase tracking-widest">← Retour</button>
              <button
                onClick={handleConfirm}
                disabled={saving || !form.date || !form.time}
                className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer le RDV"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Planning Tab ──────────────────────────────────────────────────────────────
function PlanningTab({ proEmail, reservations, onSelectRdv }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekBase, setWeekBase] = useState(new Date());
  const week = buildWeek(weekBase);

  const dayRdvs = reservations.filter(r => {
    if (r.status !== "confirme" && r.status !== "termine") return false;
    try { return isSameDay(parseISO(r.date), selectedDate); } catch { return false; }
  }).sort((a, b) => (a.time || a.time_slot || "").localeCompare(b.time || b.time_slot || ""));

  // Stats for the selected week — CA = uniquement les réservations terminées
  const weekRdvs = reservations.filter(r => {
    try {
      const d = parseISO(r.date);
      return d >= week[0] && d <= week[6] && (r.status === "confirme" || r.status === "termine");
    } catch { return false; }
  });
  const weekRevenue = weekRdvs.filter(r => r.status === "termine").reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);
  const weekDone = weekRdvs.filter(r => r.status === "termine").length;
  const weekPending = weekRdvs.filter(r => r.status === "confirme").length;
  const completionRate = weekRdvs.length > 0 ? Math.round((weekDone / weekRdvs.length) * 100) : 0;

  // Progress for today
  const todayRdvs = dayRdvs.length;
  const todayDone = dayRdvs.filter(r => r.status === "termine").length;
  const todayProgress = todayRdvs > 0 ? Math.round((todayDone / todayRdvs) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ── AI Slope Stats Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-5">
        {/* Slope decorative shapes */}
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10">
          <svg viewBox="0 0 200 200" fill="none">
            <path d="M0 100 Q50 20 100 80 T200 60 V200 H0Z" fill="url(#slope1)" />
            <defs>
              <linearGradient id="slope1" x1="0" y1="0" x2="200" y2="200">
                <stop offset="0%" stopColor="#E8732A" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-32 h-32 opacity-10">
          <svg viewBox="0 0 200 200" fill="none">
            <path d="M0 150 Q80 80 160 120 T200 100 V200 H0Z" fill="url(#slope2)" />
            <defs>
              <linearGradient id="slope2" x1="0" y1="0" x2="200" y2="200">
                <stop offset="0%" stopColor="#E8732A" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">📈 Résumé de la semaine</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-[28px] font-black text-white leading-none">{weekRdvs.length}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">RDV</p>
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-[28px] font-black text-primary leading-none">{weekRevenue}€</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">CA</p>
            </div>
            <div className="text-center">
              <p className="text-[28px] font-black text-green-400 leading-none">{completionRate}%</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Complétion</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] font-bold text-gray-400">{weekDone} terminés</span>
            <span className="text-[9px] font-bold text-gray-400">{weekPending} en cours</span>
          </div>
        </div>
      </div>

      {/* ── Day Progress Indicator ── */}
      {todayRdvs > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">
              {isSameDay(selectedDate, new Date()) ? "Aujourd'hui" : format(selectedDate, "EEEE", { locale: fr })}
            </p>
            <span className="text-[11px] font-black text-primary">{todayDone}/{todayRdvs} prestations</span>
          </div>
          <div className="flex gap-1.5">
            {dayRdvs.map((r, i) => (
              <div
                key={r.id}
                className={`flex-1 h-3 rounded-full transition-all duration-500 ${
                  r.status === "termine"
                    ? "bg-gradient-to-r from-green-400 to-green-500"
                    : "bg-gray-200"
                }`}
                title={`${r.service_name} — ${r.status === "termine" ? "✓ Terminé" : "⏳ En cours"}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekBase(d => addDays(d, -7))} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-95 transition-all">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <p className="text-[12px] font-black text-gray-500 uppercase tracking-widest">
          {format(week[0], "d MMM", { locale: fr })} – {format(week[6], "d MMM yyyy", { locale: fr })}
        </p>
        <button onClick={() => setWeekBase(d => addDays(d, 7))} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 active:scale-95 transition-all">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Day selector */}
      <div className="grid grid-cols-7 gap-1">
        {week.map((day, i) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const hasRdv = reservations.some(r => { try { return isSameDay(parseISO(r.date), day); } catch { return false; } });
          const dayCount = reservations.filter(r => { try { return isSameDay(parseISO(r.date), day) && (r.status === "confirme" || r.status === "termine"); } catch { return false; } }).length;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(day)}
              className={`relative flex flex-col items-center py-2 rounded-2xl transition-all active:scale-95 ${isSelected ? "bg-primary text-white shadow-md shadow-primary/30" : isToday ? "bg-orange-50 text-primary" : "bg-gray-100 text-gray-500"}`}
            >
              <span className="text-[8px] font-black uppercase tracking-widest">{format(day, "EEE", { locale: fr })}</span>
              <span className="text-[18px] font-black leading-tight">{format(day, "d")}</span>
              {hasRdv && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />
                  {dayCount > 1 && <span className={`text-[7px] font-black ${isSelected ? "text-white" : "text-primary"}`}>{dayCount}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Date header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-black text-gray-900 capitalize">
          {format(selectedDate, "EEEE 'le' d MMMM yyyy", { locale: fr })}
        </p>
        <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full">{dayRdvs.length} rdv</span>
      </div>

      {/* RDV list */}
      {dayRdvs.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center">
            <Calendar className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-[14px] font-bold text-gray-400">Aucun rendez-vous ce jour</p>
          <p className="text-[11px] text-gray-300">Les rdv confirmés apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayRdvs.map((rdv, idx) => {
            const isDone = rdv.status === "termine";
            const timeStr = rdv.time || rdv.time_slot || "";
            const nextRdv = dayRdvs[idx + 1];
            const nextTime = nextRdv ? (nextRdv.time || nextRdv.time_slot || "") : null;

            return (
              <div key={rdv.id}>
                <button
                  onClick={() => onSelectRdv(rdv)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left active:scale-[0.99] transition-all shadow-sm border ${
                    isDone
                      ? "bg-gray-50 border-gray-200 opacity-70"
                      : "bg-white border-gray-100 hover:border-primary/30"
                  }`}
                >
                  {/* Time & duration */}
                  <div className="w-14 text-center shrink-0">
                    <p className={`text-[14px] font-black ${isDone ? "text-gray-400 line-through" : "text-gray-900"}`}>{timeStr}</p>
                    <p className="text-[9px] text-gray-400 font-medium">{rdv.duration_min || 60}min</p>
                  </div>

                  {/* Vertical timeline indicator */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-3 h-3 rounded-full border-2 ${isDone ? "bg-green-500 border-green-500" : "bg-white border-primary"}`} />
                    {nextTime && <div className="w-0.5 h-6 bg-gray-200 mt-1" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-[15px] font-black truncate ${isDone ? "text-gray-400" : "text-gray-900"}`}>{rdv.service_name}</p>
                      {isDone && <span className="text-[8px] font-black text-green-500 bg-green-50 px-1.5 py-0.5 rounded-full shrink-0">✓</span>}
                      <SourceBadge source={rdv.source} />
                    </div>
                    <p className="text-[12px] font-medium text-gray-500 truncate">{rdv.client_name || emailToDisplayName(rdv.client_email)}</p>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <p className={`text-[14px] font-black ${isDone ? "text-gray-400" : "text-primary"}`}>{rdv.total_price || rdv.service_price}€</p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Demandes Tab ──────────────────────────────────────────────────────────────
function DemandesTab({ proEmail, reservations, setReservations, onSelectRdv, autoAccept, toggleAutoAccept }) {
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(null);
  const [filterStatus, setFilterStatus] = useState("en_attente");
  const [filterSource, setFilterSource] = useState("all");
  const [clientScores, setClientScores] = useState({});

  // ── Format date long en français ──
  const formatLongDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      return format(parseISO(dateStr), "EEEE d MMMM yyyy", { locale: fr });
    } catch { return dateStr; }
  };

  // Charger les scores de fiabilite des clients
  useEffect(() => {
    const clientEmails = [...new Set(reservations.map(r => r.client_email).filter(Boolean))];
    if (clientEmails.length === 0) return;
    Promise.all(clientEmails.map(email =>
      supabase.from("Reservation").select("status").eq("client_email", email).then(({ data }) => {
        const total = (data || []).length;
        const noShows = (data || []).filter(r => r.status === "no_show").length;
        const annules = (data || []).filter(r => r.status === "annule").length;
        const completes = (data || []).filter(r => r.status === "termine").length;
        const score = total === 0 ? 100 : Math.max(0, Math.round(100 - (noShows * 20) - (annules * 5) + (completes * 2)));
        return { email, score: Math.min(100, score) };
      }).catch(() => ({ email, score: 100 }))
    )).then(results => {
      const map = {};
      results.forEach(r => { map[r.email] = r.score; });
      setClientScores(map);
    });
  }, [reservations]);

  const statusLabels = {
    en_attente: "En attente",
    confirme: "Confirmé",
    annule: "Annulé",
    termine: "Terminé",
    no_show: "No Show",
  };
  const statusBadgeColors = {
    en_attente: "bg-orange-100 text-orange-600",
    confirme: "bg-green-100 text-green-600",
    annule: "bg-red-100 text-red-500",
    termine: "bg-gray-100 text-gray-500",
    no_show: "bg-red-50 text-red-400",
  };

  const filtered = reservations.filter(r => {
    const matchSearch = r.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      r.service_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.date?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = r.status === filterStatus;
    const matchSource = filterSource === "all" || r.source === filterSource;
    return matchSearch && matchStatus && matchSource;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // ── Grouper par date ──
  const groupedByDate = {};
  filtered.forEach(r => {
    const key = r.date || "sans-date";
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(r);
  });
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const handleAction = async (id, status) => {
    setUpdating(id);
    await supabase.from("Reservation").update({ status }).eq("id", id);
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));

    // Envoyer notification au client
    try {
      const rdv = reservations.find(r => r.id === id);
      if (rdv) {
        const serviceName = rdv.service_name || rdv.service || "votre rendez-vous";
        const date = rdv.date || "";
        const proDisplayName = rdv.pro_name || rdv.salon_name || proEmail;
        if (status === "confirme") {
          await notifyReservationConfirmed({
            clientEmail: rdv.client_email, serviceName, date,
            time: rdv.time || rdv.time_slot || "", proName: proDisplayName,
          });
        } else if (status === "annule") {
          await notifyReservationCancelled({
            clientEmail: rdv.client_email, serviceName, date,
            proName: proDisplayName,
          });
        }
      }
    } catch (e) {
      console.error("Notification error:", e);
    }

    setUpdating(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrer par client, service, date…"
          className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none font-medium placeholder:text-gray-400"
        />
      </div>

      {/* Filter chips — status + source on same line */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[{ id: "en_attente", label: "En attente" }, { id: "confirme", label: "Confirmés" }, { id: "termine", label: "Terminés" }, { id: "annule", label: "Annulés" }].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${filterStatus === f.id ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}
          >
            {f.label}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-200 shrink-0" />
        {[{ id: "app", label: "Application", activeColor: "bg-orange-500 text-white" },
          { id: "receptionniste_ia", label: "Receptionniste IA", activeColor: "bg-green-500 text-white" },
          { id: "ai_social_media", label: "AI Social Media", activeColor: "bg-violet-500 text-white" }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterSource(filterSource === f.id ? "all" : f.id)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${filterSource === f.id ? f.activeColor : "bg-gray-100 text-gray-400"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="bg-orange-50 rounded-2xl px-4 py-3 border border-orange-100 text-center">
          <p className="text-[11px] font-black text-primary uppercase tracking-widest">
            {filtered.length} rendez-vous
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <CheckCircle className="w-10 h-10 text-green-400" />
          <p className="text-[13px] font-bold text-gray-400">
            {reservations.length === 0 ? "Aucun rendez-vous pour le moment" : "Aucun résultat pour ce filtre"}
          </p>
        </div>
      ) : (
        sortedDates.map(dateKey => (
          <div key={dateKey} className="space-y-3">
            {/* En-tête date */}
            <div className="flex items-center gap-3 pt-2">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <p className="text-[13px] font-black text-gray-900 capitalize">{formatLongDate(dateKey)}</p>
              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{groupedByDate[dateKey].length}</span>
            </div>
            {/* RDVs de cette date */}
            {groupedByDate[dateKey].map(r => (
              <div key={r.id} onClick={() => onSelectRdv(r)} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 relative cursor-pointer active:scale-[0.98] transition-all">
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <SourceBadge source={r.source} />
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${statusBadgeColors[r.status] || "bg-gray-100 text-gray-500"}`}>
                    {statusLabels[r.status] || r.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <span className="text-[18px] font-black text-primary">{(r.client_name || emailToDisplayName(r.client_email) || "?")[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-[16px] font-black text-gray-900">{r.client_name || emailToDisplayName(r.client_email)}</p>
                    <p className="text-[12px] font-medium text-gray-500">{r.service_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Heure</p>
                    <p className="text-[14px] font-black text-gray-900">{r.time || r.time_slot}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Durée & Prix</p>
                    <p className="text-[14px] font-black text-gray-900">{r.duration_min || 60}min • {r.total_price || r.service_price}€</p>
                  </div>
                </div>
                {r.status === "en_attente" && clientScores[r.client_email] !== undefined && (
                  <div className="flex items-center gap-2 mb-3 bg-gray-50 rounded-xl px-3 py-2">
                    <div className={`w-2 h-2 rounded-full ${clientScores[r.client_email] >= 80 ? "bg-green-500" : clientScores[r.client_email] >= 50 ? "bg-yellow-500" : "bg-red-500"}`} />
                    <span className="text-[11px] font-bold text-gray-600">Score de fiabilité</span>
                    <span className={`text-[13px] font-black ml-auto ${clientScores[r.client_email] >= 80 ? "text-green-600" : clientScores[r.client_email] >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                      {clientScores[r.client_email]}%
                    </span>
                  </div>
                )}
                {r.status === "en_attente" && (
                  <div className="flex gap-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleAction(r.id, "annule")}
                      disabled={updating === r.id}
                      className="flex-1 py-3 rounded-2xl text-[12px] font-black text-gray-500 uppercase tracking-widest border border-gray-200 active:scale-95 transition-all"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => handleAction(r.id, "confirme")}
                      disabled={updating === r.id}
                      className="flex-1 bg-[#1a2035] text-white py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {updating === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accepter"}
                    </button>
                  </div>
                )}
                {r.status === "confirme" && (
                  <div className="flex gap-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleAction(r.id, "annule")}
                      disabled={updating === r.id}
                      className="flex-1 py-3 rounded-2xl text-[12px] font-black text-red-400 uppercase tracking-widest border border-red-100 active:scale-95 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => onSelectRdv(r)}
                      className="flex-1 bg-primary text-white py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      Réservation
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ── CRM Tab ───────────────────────────────────────────────────────────────────
function CrmTab({ reservations, proEmail }) {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "" });
  const [manualClients, setManualClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Charger les clients depuis Supabase
  useEffect(() => {
    if (!proEmail) return;
    setLoadingClients(true);
    entities.Client.filter({ pro_email: proEmail }, "-created_at", 500)
      .then(clients => {
        setManualClients(clients || []);
        setLoadingClients(false);
      })
      .catch(() => setLoadingClients(false));
  }, [proEmail]);

  const addClient = async (client) => {
    try {
      const created = await entities.Client.create({
        pro_email: proEmail,
        name: client.name,
        email: client.email,
        phone: client.phone || "",
        source: "manuel",
        total_spent: 0,
        total_rdv: 0,
      });
      setManualClients(prev => [{ ...client, id: created?.id || Date.now(), pro_email: proEmail }, ...prev]);
    } catch (err) {
      console.error("Error saving client:", err);
    }
  };

  // Construire la base clients depuis les réservations ET les clients Supabase
  const nameLookup = {};
  manualClients.forEach(c => {
    const email = c.email || c.client_email;
    if (email && c.name) nameLookup[email] = c.name;
  });
  const clientMap = {};
  reservations.forEach(r => {
    if (!r.client_email) return;
    if (!clientMap[r.client_email]) {
      clientMap[r.client_email] = {
        email: r.client_email,
        name: nameLookup[r.client_email] || r.client_name || emailToDisplayName(r.client_email),
        phone: r.client_phone || "",
        rdvs: [],
        totalSpent: 0,
        lastDate: null,
      };
    }
    clientMap[r.client_email].rdvs.push(r);
    // CA = uniquement les réservations terminées
    if (r.status === "termine") {
      clientMap[r.client_email].totalSpent += (r.total_price || r.service_price || 0);
    }
    if (!clientMap[r.client_email].lastDate || r.date > clientMap[r.client_email].lastDate) {
      clientMap[r.client_email].lastDate = r.date;
    }
  });
  // Ajouter les clients Supabase (qui ne sont pas déjà dans les réservations)
  manualClients.forEach(c => {
    const email = c.email || c.client_email;
    if (!email || clientMap[email]) return;
    clientMap[email] = {
      email,
      name: c.name || email,
      phone: c.phone || "",
      rdvs: [],
      totalSpent: c.total_spent || 0,
      lastDate: c.last_rdv_date || null,
    };
  });
  const allClients = Object.values(clientMap);

  const filtered = allClients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const rows = [["Nom", "Email", "Nb RDV", "Total €", "Dernier RDV"]];
    allClients.forEach(c => rows.push([c.name, c.email, c.rdvs.length, c.totalSpent, c.lastDate || ""]));
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "clients.csv"; a.click();
  };

  if (selectedClient) {
    const rdvs = selectedClient.rdvs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedClient(null)} className="flex items-center gap-2 text-[12px] font-black text-gray-500 uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Tous les clients
        </button>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-[24px] font-black text-primary">{(selectedClient.name || "?")[0].toUpperCase()}</span>
            </div>
            <div>
              <h3 className="text-[20px] font-black text-gray-900">{selectedClient.name}</h3>
              <p className="text-[12px] text-gray-400 font-medium">{selectedClient.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <p className="text-[20px] font-black text-gray-900">{selectedClient.rdvs.length}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">RDV</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <p className="text-[20px] font-black text-primary">{selectedClient.totalSpent}€</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <p className="text-[14px] font-black text-gray-900">{selectedClient.lastDate || "—"}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Dernier</p>
            </div>
          </div>
          {/* Source breakdown */}
          {(() => {
            const sources = {};
            selectedClient.rdvs.forEach(r => {
              const s = r.source || "app";
              sources[s] = (sources[s] || 0) + 1;
            });
            const sourceEntries = Object.entries(sources).filter(([, c]) => c > 0);
            if (sourceEntries.length <= 1) return null;
            return (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sources:</p>
                {sourceEntries.map(([src, count]) => (
                  <SourceBadge key={src} source={src} className="text-[9px]" />
                ))}
              </div>
            );
          })()}
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Historique des RDV</p>
        {rdvs.map(r => (
          <div key={r.id} className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm border border-gray-100">
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-black text-gray-900">{r.service_name}</p>
                <SourceBadge source={r.source} />
              </div>
              <p className="text-[11px] text-gray-400 font-medium capitalize">{r.date ? format(parseISO(r.date), "EEEE d MMMM", { locale: fr }) : ""} • {r.time || r.time_slot}</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-black text-primary">{r.total_price || r.service_price}€</p>
              <p className={`text-[9px] font-black uppercase ${r.status === "confirme" ? "text-green-500" : r.status === "annule" ? "text-red-400" : "text-gray-400"}`}>{r.status}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[20px] font-black text-gray-900">Clients</h3>
          <p className="text-[12px] font-medium text-gray-400">{allClients.length} clients enregistrés</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center active:scale-95 transition-all">
            <Download className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={() => setShowAdd(true)} className="w-10 h-10 bg-[#1a2035] rounded-2xl flex items-center justify-center active:scale-95 transition-all">
            <UserPlus className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client…"
          className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none font-medium placeholder:text-gray-400"
        />
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-2">
          <Users className="w-10 h-10 text-gray-200" />
          <p className="text-[13px] font-bold text-gray-400">Aucun client pour l'instant</p>
          <p className="text-[11px] text-gray-300 text-center">Les clients apparaissent automatiquement après leurs réservations</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(c => (
          <button
            key={c.email}
            onClick={() => setSelectedClient(c)}
            className="w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm border border-gray-100 active:scale-[0.99] transition-all"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-[18px] font-black text-primary">{(c.name || "?")[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-black text-gray-900">{c.name}</p>
              <p className="text-[12px] font-medium text-gray-400">{c.rdvs.length} rdv • {c.totalSpent}€ total</p>
            </div>
            <div className="flex items-center gap-2">
              {c.lastDate && <span className="text-[10px] font-black text-gray-400">{c.lastDate}</span>}
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </button>
        ))}
      </div>

      {/* Stats card */}
      {allClients.length > 0 && (
        <div className="bg-[#1a2035] rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Statistiques</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[36px] font-black text-white leading-none">{allClients.length}</p>
              <p className="text-[11px] font-medium text-gray-400 mt-1">Clients total</p>
            </div>
            <div>
              <p className="text-[36px] font-black text-primary leading-none">
                {allClients.reduce((s, c) => s + c.totalSpent, 0)}€
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-1">CA cumulé</p>
            </div>
          </div>
          <button onClick={exportCSV} className="w-full mt-4 bg-white/10 text-white text-[12px] font-black uppercase tracking-widest py-3 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Exporter Excel / CSV
          </button>
        </div>
      )}

      {/* Modal ajout client */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white w-full rounded-t-3xl px-5 pt-4 pb-24 z-10">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-[18px] font-black text-gray-900 mb-5">Nouveau client</h3>
            <div className="space-y-3">
              <input value={newClient.name} onChange={e => setNewClient(c => ({ ...c, name: e.target.value }))} placeholder="Nom complet" className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-900 outline-none" />
              <input value={newClient.email} onChange={e => setNewClient(c => ({ ...c, email: e.target.value }))} placeholder="Email" type="email" className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-900 outline-none" />
              <input value={newClient.phone} onChange={e => setNewClient(c => ({ ...c, phone: e.target.value }))} placeholder="Téléphone" type="tel" className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-900 outline-none" />
              <button
                onClick={async () => {
                  if (!newClient.name.trim() || !newClient.email.trim()) return;
                  await addClient(newClient);
                  setNewClient({ name: "", email: "", phone: "" });
                  setShowAdd(false);
                }}
                className="w-full bg-primary text-white font-black text-[13px] uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all mt-2"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gestion Tab ───────────────────────────────────────────────────────────────
function GestionTab({ onNavigate, travailNuit = false, onToggleNuit, horairesSummary }) {
  // Sous-titre synchronisé avec la section Horaires & Congés (jamais de 9h-19h en dur)
  const horaires = horairesSummary || "Non configuré";
  const gestionItems = [
    { icon: Scissors, label: "Services & Tarifs", sub: "Gérer les prestations", color: "text-primary", bg: "bg-orange-50", route: "/pro/catalogue-services" },
    { icon: Users, label: "Équipe & Staff", sub: "Membres de l'équipe", color: "text-primary", bg: "bg-orange-50", route: "/pro/equipe" },
    { icon: Clock, label: "Horaires & Congés", sub: horaires, color: "text-blue-500", bg: "bg-blue-50", route: "/pro/horaires-conges" },
    { icon: Megaphone, label: "Marketing & Promo", sub: "Promotions actives", color: "text-purple-500", bg: "bg-purple-50", route: "/pro/promo-service/:id" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[22px] font-black text-gray-900">Gestion</h3>
        <p className="text-[13px] font-medium text-gray-400">Configurez votre établissement</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {gestionItems.map(({ icon: Icon, label, sub, color, bg, route }) => (
          <button
            key={label}
            onClick={() => route && onNavigate(route)}
            className="bg-white rounded-3xl p-5 flex flex-col gap-3 shadow-sm border border-gray-100 text-left active:scale-[0.97] transition-all"
          >
            <div className={`w-11 h-11 ${bg} rounded-2xl flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-[15px] font-black text-gray-900 leading-tight">{label}</p>
              <p className="text-[12px] font-medium text-gray-400 mt-0.5">{sub}</p>
            </div>
          </button>
        ))}
      </div>
      {/* Mode Nuit toggle synchronisé */}
      <div className={`rounded-3xl p-4 flex items-center gap-4 border ${travailNuit ? "bg-indigo-950 border-indigo-800" : "bg-indigo-50 border-indigo-100"}`}>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${travailNuit ? "bg-indigo-800" : "bg-indigo-100"}`}>
          <Clock className={`w-5 h-5 ${travailNuit ? "text-indigo-300" : "text-indigo-500"}`} />
        </div>
        <div className="flex-1">
          <p className={`text-[14px] font-black ${travailNuit ? "text-indigo-200" : "text-indigo-700"}`}>
            Mode Nuit
          </p>
          <p className={`text-[11px] font-medium mt-0.5 ${travailNuit ? "text-indigo-400" : "text-indigo-400"}`}>
            Horaires : {horaires}{travailNuit ? " · Mode Nuit ✓ Actif" : ""}
          </p>
          </div>
          <button
          onClick={() => onToggleNuit && onToggleNuit(!travailNuit)}
          className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${travailNuit ? "bg-indigo-500" : "bg-gray-200"}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${travailNuit ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="bg-[#1a2035] rounded-3xl p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[22px] font-black text-white leading-tight">Boostez votre<br /><span className="text-primary">Visibilité</span></p>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <Rocket className="w-6 h-6 text-primary" />
          </div>
        </div>
        <p className="text-[13px] font-medium text-gray-400 leading-relaxed mb-4">
          Apparaissez en tête des résultats et automatisez vos relances clients.
        </p>
        <button onClick={() => onNavigate("/pro/abonnements")} className="w-full bg-primary text-white font-black text-[13px] uppercase tracking-widest py-3.5 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all">
          Découvrir Pro+
        </button>
      </div>
      <button onClick={() => onNavigate("/profil-pro")} className="w-full text-center text-[12px] font-black text-primary uppercase tracking-widest py-3 active:scale-95 transition-all">
        Quitter le mode professionnel
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GestionAgenda() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("planning");
  const [showModal, setShowModal] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRdv, setSelectedRdv] = useState(null);
  const [travailNuit, setTravailNuit] = useState(false);
  const [profilId, setProfilId] = useState(null);
  // Horaires réels du pro (section Horaires & Congés) — source de l'affichage,
  // pour ne plus jamais afficher un "09h – 19h" en dur désynchronisé.
  const [proOuverture, setProOuverture] = useState(null);
  const [autoAccept, setAutoAccept] = useState(() => {
    return localStorage.getItem(`bb_auto_accept_${user?.email}`) === "true";
  });
  const autoAcceptRef = useRef(autoAccept);
  useEffect(() => { autoAcceptRef.current = autoAccept; }, [autoAccept]);

  const proEmail = user?.email;

  // Heures d'ouverture : toujours les vrais horaires du pro (Horaires & Congés),
  // jamais une valeur en dur. "Non configuré" si le pro n'a rien renseigné.
  // Avec le Mode Nuit actif, affiche les horaires de nuit effectifs.
  const horairesSummary = summarizeHours(applyNightMode(proOuverture, travailNuit));
  const horairesLabel = horairesSummary || "Horaires non configurés";

  const loadReservations = async () => {
    console.log('[GestionAgenda] loadReservations called, proEmail:', proEmail);
    if (!proEmail) { setLoading(false); return; }
    try {
      const [data, profils] = await Promise.all([
        entities.Reservation.filter({ pro_email: proEmail }, "-date", 200).catch(e => {
          console.error('[GestionAgenda] Reservation filter error:', e);
          return [];
        }),
        entities.ProfilPro.filter({ user_email: proEmail }, "-created_at", 1).catch(() => []),
      ]);
      console.log('[GestionAgenda] Loaded reservations:', data?.length, data);
      setReservations(data || []);
      if (profils.length > 0) {
        const dbNight = !!profils[0].travail_nuit;
        const localNight = localStorage.getItem("bb_night_mode") === "true";
        if (dbNight !== localNight) {
          localStorage.setItem("bb_night_mode", String(dbNight));
        }
        setTravailNuit(dbNight);
        setProfilId(profils[0].id);
        // Synchronise l'affichage avec la section Horaires & Congés
        const ouv = profils[0].ouverture && hasHoursData(profils[0].ouverture)
          ? profils[0].ouverture
          : (hasHoursData(profils[0].horaires) ? profils[0].horaires : null);
        setProOuverture(ouv);
      }
    } catch (e) {
      console.error('[GestionAgenda] loadReservations error:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReservations();
    // Subscribe aux changements du profil pro (mode nuit)
    const unsubProfil = entities.ProfilPro.subscribe((event) => {
      if (event.data?.user_email === proEmail) {
        setTravailNuit(event.data.travail_nuit || false);
        const ouv = event.data.ouverture && hasHoursData(event.data.ouverture)
          ? event.data.ouverture
          : (hasHoursData(event.data.horaires) ? event.data.horaires : null);
        setProOuverture(ouv);
      }
    });
    // Un seul channel Supabase pour tout le real-time + auto-accept
    const rtChannel = supabase
      .channel("pro-rdv-" + proEmail)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "Reservation",
        filter: `pro_email=eq.${proEmail}`,
      }, async (payload) => {
        if (payload.eventType === "INSERT") {
          const newRdv = payload.new;
          setReservations(prev => {
            if (prev.some(r => r.id === newRdv.id)) return prev;
            return [newRdv, ...prev];
          });
          // Auto-accept: lit depuis ref (toujours à jour, pas de stale closure)
          if (autoAcceptRef.current && newRdv.status === "en_attente") {
            try {
              await supabase.from("Reservation").update({ status: "confirme" }).eq("id", newRdv.id);
              setReservations(prev => prev.map(r => r.id === newRdv.id ? { ...r, status: "confirme" } : r));
              try {
                await notifyReservationConfirmed({
                  clientEmail: newRdv.client_email,
                  serviceName: newRdv.service_name || "Rendez-vous",
                  date: newRdv.date || "",
                  time: newRdv.time || newRdv.time_slot || "",
                  proName: newRdv.salon_name || newRdv.pro_name || proEmail,
                });
              } catch (e) { console.error("Auto-accept notification error:", e); }
            } catch (e) { console.error("Auto-accept error:", e); }
          }
        } else if (payload.eventType === "UPDATE") {
          setReservations(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
        } else if (payload.eventType === "DELETE") {
          setReservations(prev => prev.filter(r => r.id !== payload.old.id));
        }
      })
      .subscribe();
    // Polling fallback: vérifier les changements toutes les 15s + auto-accept si activé
    const pollInterval = setInterval(async () => {
      if (!proEmail) return;
      try {
        const { data } = await supabase.from("Reservation").select("*").eq("pro_email", proEmail).order("date", { ascending: false }).limit(200);
        if (!data) return;
        setReservations(data);
        // Auto-accept via polling si activé
        if (autoAcceptRef.current) {
          const pending = data.filter(r => r.status === "en_attente");
          for (const rdv of pending) {
            try {
              await supabase.from("Reservation").update({ status: "confirme" }).eq("id", rdv.id);
              setReservations(prev => prev.map(r => r.id === rdv.id ? { ...r, status: "confirme" } : r));
              try {
                await notifyReservationConfirmed({
                  clientEmail: rdv.client_email,
                  serviceName: rdv.service_name || "Rendez-vous",
                  date: rdv.date || "",
                  time: rdv.time || rdv.time_slot || "",
                  proName: rdv.salon_name || rdv.pro_name || proEmail,
                });
              } catch (e) { console.error("Auto-accept poll notify error:", e); }
            } catch (e) { console.error("Auto-accept poll error:", e); }
          }
        }
      } catch (e) { console.error("Poll error:", e); }
    }, 15000);
    // Listen for pro-profile-updated events (from ProfilPro page)
    const onProfileUpdated = (e) => {
      const d = e.detail || {};
    };
    window.addEventListener('pro-profile-updated', onProfileUpdated);
    return () => { unsubProfil(); if (rtChannel) supabase.removeChannel(rtChannel); clearInterval(pollInterval); window.removeEventListener('pro-profile-updated', onProfileUpdated); };
  }, [proEmail]);

  const toggleAutoAccept = async () => {
    const next = !autoAccept;
    setAutoAccept(next);
    autoAcceptRef.current = next;
    localStorage.setItem(`bb_auto_accept_${proEmail}`, String(next));

    // Si on active l'auto-accept, confirmer toutes les réservations en_attente
    if (next) {
      const pending = reservations.filter(r => r.status === "en_attente");
      for (const rdv of pending) {
        try {
          await supabase.from("Reservation").update({ status: "confirme" }).eq("id", rdv.id);
          setReservations(prev => prev.map(r => r.id === rdv.id ? { ...r, status: "confirme" } : r));
          try {
            await notifyReservationConfirmed({
              clientEmail: rdv.client_email,
              serviceName: rdv.service_name || "Rendez-vous",
              date: rdv.date || "",
              time: rdv.time || rdv.time_slot || "",
              proName: rdv.salon_name || rdv.pro_name || proEmail,
            });
          } catch (e) { console.error("Auto-accept notify error:", e); }
        } catch (e) { console.error("Auto-accept bulk confirm error:", e); }
      }
    }
  };

  const demandesCount = reservations.filter(r => r.status === "en_attente").length;

  const TABS = [
    { id: "planning", label: "PLANNING" },
    { id: "demandes", label: "DEMANDES", badge: demandesCount > 0 ? demandesCount : null },
    { id: "crm", label: "CRM" },
    { id: "gestion", label: "GESTION" },
  ];

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      {showModal && (
        <NouveauRdvModal
          onClose={() => setShowModal(false)}
          proEmail={proEmail}
          onCreated={(rdv) => setReservations(prev => [rdv, ...prev])}
        />
      )}
      {selectedRdv && (
        <RdvDetailModal
          rdv={selectedRdv}
          onClose={() => setSelectedRdv(null)}
          proEmail={proEmail}
          onUpdateStatus={(id, status) => {
            setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
          }}
        />
      )}

      <div className="bg-white px-5 pt-5 pb-4 sticky top-0 z-10 border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/profil-pro")}
            className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-[20px] font-black text-gray-900 leading-tight">Gestion Agenda</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">
              {loading ? "Chargement…" : `${reservations.length} rdv • ${horairesLabel}`}
            </p>
          </div>
          <button
            onClick={toggleAutoAccept}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${autoAccept ? "bg-green-500 text-white shadow-md shadow-green-500/30" : "bg-gray-100 text-gray-400"}`}
          >
            <div className={`w-2 h-2 rounded-full ${autoAccept ? "bg-white animate-pulse" : "bg-gray-300"}`} />
            Auto
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-gray-400"}`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="w-4 h-4 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === "planning" && (
              <PlanningTab proEmail={proEmail} reservations={reservations} onSelectRdv={setSelectedRdv} />
            )}
            {activeTab === "demandes" && (
              <DemandesTab proEmail={proEmail} reservations={reservations} setReservations={setReservations} onSelectRdv={setSelectedRdv} autoAccept={autoAccept} toggleAutoAccept={toggleAutoAccept} />
            )}
            {activeTab === "crm" && (
              <CrmTab reservations={reservations} proEmail={proEmail} />
            )}
            {activeTab === "gestion" && (
              <GestionTab onNavigate={navigate} travailNuit={travailNuit} profilId={profilId} horairesSummary={horairesSummary} onToggleNuit={async (val) => {
                setTravailNuit(val);
                localStorage.setItem("bb_night_mode", String(val));
                if (proEmail) {
                  const { error } = await supabase.from('ProfilPro').update({ travail_nuit: val }).eq('user_email', proEmail);
                  if (error) {
                    console.error('[GestionAgenda] Mode Nuit save error:', error.message);
                  }
                }
              }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}