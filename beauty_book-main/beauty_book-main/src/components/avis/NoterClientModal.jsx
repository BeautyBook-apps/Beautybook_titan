import { useState } from "react";
import { X, ShieldCheck, Loader2, CheckCircle2, XCircle, Clock, Star } from "lucide-react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";

const PRESENCE_OPTIONS = [
  {
    key: "present",
    label: "Présent à l'heure",
    description: "Le client était au RDV et à l'heure",
    icon: CheckCircle2,
    color: "border-green-400 bg-green-50 text-green-700",
    activeColor: "border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/30",
    score: 5,
  },
  {
    key: "retard",
    label: "En retard",
    description: "Le client est arrivé avec du retard",
    icon: Clock,
    color: "border-yellow-400 bg-yellow-50 text-yellow-700",
    activeColor: "border-yellow-500 bg-yellow-500 text-white shadow-lg shadow-yellow-500/30",
    score: 3,
  },
  {
    key: "absent",
    label: "No-show / Absent",
    description: "Le client n'est pas venu sans annuler",
    icon: XCircle,
    color: "border-red-400 bg-red-50 text-red-700",
    activeColor: "border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/30",
    score: 1,
  },
];

function StarSelector({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1.5 justify-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          className="active:scale-90 transition-all"
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              i <= (hovered || value) ? "text-primary fill-primary" : "text-gray-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function NoterClientModal({ reservation, onClose, onSuccess }) {
  const { user } = useAuth();
  const [presence, setPresence] = useState(null);
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-set note based on presence selection
  const handlePresence = (opt) => {
    setPresence(opt.key);
    setNote(opt.score);
  };

  const selectedOpt = PRESENCE_OPTIONS.find((o) => o.key === presence);

  const handleSubmit = async () => {
    if (!presence || note === 0) return;
    setLoading(true);
    setError('');
    try {
      if (!user?.id || !user.email) throw new Error("Connectez-vous pour enregistrer cet avis.");
      await entities.Avis.create({
        reservation_id: reservation.id,
        type: "pro_to_client",
        auteur_email: user.email,
        auteur_nom: user.full_name || user.user_metadata?.full_name || "Pro",
        auteur_avatar: user.avatar_url || user.user_metadata?.avatar_url || "",
        created_by_id: user.id,
        status: "published",
        cible_email: reservation.client_email,
        cible_nom: reservation.client_name || reservation.client_email?.split("@")[0] || "Client",
        note,
        commentaire,
        images: [],
        service_nom: reservation.service_name,
        criteres: {
          presence,
          ponctualite: presence === "present" ? 5 : presence === "retard" ? 2 : 0,
          communication: 0,
        },
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.message || 'L’avis n’a pas été enregistré. Réessayez.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl px-5 pt-4 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-gray-900">Score de Fiabilité</h2>
              <p className="text-[11px] text-gray-400 font-medium">{reservation.client_email} · {reservation.service_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 rounded-2xl px-4 py-3 mb-5 border border-blue-100">
          <p className="text-[11px] text-blue-700 font-medium leading-snug">
            Ce score est <span className="font-black">visible par tous les professionnels</span> de la plateforme. Il permet de prioriser les demandes de réservation futures.
          </p>
        </div>

        {/* Étape 1 : présence */}
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Le client était-il présent ?</p>
        <div className="space-y-2.5 mb-5">
          {PRESENCE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = presence === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handlePresence(opt)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  isActive ? opt.activeColor : opt.color
                }`}
              >
                <Icon className={`w-6 h-6 shrink-0 ${isActive ? "text-white" : ""}`} />
                <div className="text-left flex-1">
                  <p className={`text-[13px] font-black ${isActive ? "text-white" : ""}`}>{opt.label}</p>
                  <p className={`text-[10px] font-medium ${isActive ? "text-white/80" : "opacity-70"}`}>{opt.description}</p>
                </div>
                {isActive && (
                  <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Étape 2 : note globale (pré-remplie mais ajustable) */}
        {presence && (
          <>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Score de fiabilité global</p>
            <div className="bg-gray-50 rounded-2xl py-4 px-3 mb-5 flex flex-col items-center gap-2">
              <StarSelector value={note} onChange={setNote} />
              <p className="text-[12px] font-black text-gray-500 mt-1">
                {note === 0 ? "–" : ["", "Très peu fiable", "Peu fiable", "Moyen", "Fiable", "Excellent client !"][note]}
              </p>
            </div>

            {/* Commentaire privé optionnel */}
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Commentaire partagé avec le client et les professionnels…"
              maxLength={4000}
              rows={2}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-[13px] text-gray-700 placeholder:text-gray-300 outline-none resize-none mb-5"
            />
          </>
        )}

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={!presence || note === 0 || loading}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[14px] font-black uppercase tracking-widest shadow-md shadow-blue-600/30 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
          {loading ? "Enregistrement..." : "Valider le score"}
        </button>
      </div>
    </div>
  );
}
