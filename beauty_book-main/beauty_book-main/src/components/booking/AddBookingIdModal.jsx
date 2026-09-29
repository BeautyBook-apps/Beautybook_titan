/**
 * ── Retrouver une réservation par son ID / matricule ────────────────────────
 * Pour les clients qui ont réservé SANS l'application (ex : par téléphone
 * via l'agent vocal IA) : ils saisissent le matricule reçu par email
 * (ex « BB-7K2Q9P ») et le récapitulatif du RDV s'affiche.
 */
import { useState } from "react";
import { X, Hash, Loader2, Search } from "lucide-react";
import { supabase } from "@/api/supabaseClient";

function normalizeRow(r) {
  if (!r) return null;
  const num = (v, d = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    ...r,
    duration_min: num(r.duration_min, 60),
    total_price: num(r.total_price, num(r.service_price, 0)),
    service_price: num(r.service_price, 0),
    persons: parseInt(r.persons, 10) || 1,
  };
}

export default function AddBookingIdModal({ onFound, onClose }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const c = code.trim();
    if (!c) { setError("Saisissez votre ID de réservation."); return; }
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("get_reservation_by_code", { p_code: c });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError("Aucune réservation trouvée avec cet ID. Vérifiez le code reçu par email.");
        return;
      }
      onFound(normalizeRow(row));
    } catch (e) {
      console.error("Booking lookup error:", e);
      setError("Impossible de retrouver la réservation. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full rounded-t-3xl px-5 pt-4 pb-10 z-10">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[18px] font-black text-gray-900">Ajouter un ID de réservation</h2>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95" aria-label="Fermer">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-[12px] text-gray-400 font-medium mb-5 leading-relaxed">
          Vous avez réservé par téléphone ? Saisissez le <strong>ID de réservation</strong> reçu par email (ex : BB-7K2Q9P) pour voir votre récapitulatif.
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-1 focus-within:border-primary transition-all mb-3">
          <Hash className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="BB-XXXXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            className="flex-1 bg-transparent py-3.5 text-[16px] font-black tracking-[0.2em] text-gray-900 placeholder:text-gray-300 outline-none uppercase"
          />
        </div>
        {error && <p className="text-[12px] font-bold text-red-500 mb-3">{error}</p>}
        <button
          onClick={handleSearch}
          disabled={loading || !code.trim()}
          className="w-full bg-primary text-white py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Recherche…" : "Voir mon RDV"}
        </button>
      </div>
    </div>
  );
}
