/**
 * ── Scanner QR code (caméra) ────────────────────────────────────────────────
 * Utilisé par le professionnel depuis le détail d'un RDV confirmé :
 * scanne le QR code du client → onScan(decodedText).
 */
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, ScanLine, AlertCircle } from "lucide-react";

export default function QrScannerModal({ onScan, onClose, error }) {
  const handledRef = useRef(false);
  const [camError, setCamError] = useState("");

  // Si le parent signale une erreur de lecture, on réarme le scan après un délai.
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => { handledRef.current = false; }, 2200);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    const scanner = new Html5Qrcode("bb-qr-reader", { verbose: false });
    let cancelled = false;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (handledRef.current || cancelled) return;
          handledRef.current = true;
          onScan(decodedText);
        },
        () => {}
      )
      .catch((e) => {
        if (!cancelled) setCamError("Caméra inaccessible : autorisez l'accès à la caméra pour scanner.");
        console.error("QR scanner error:", e);
      });
    return () => {
      cancelled = true;
      try {
        scanner.stop().then(() => { try { scanner.clear(); } catch {} }).catch(() => {});
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[130] bg-black/90 flex flex-col" style={{ height: "100dvh" }}>
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-white" />
          <h2 className="text-[17px] font-black text-white">Scanner le QR code</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center active:scale-95" aria-label="Fermer">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {camError ? (
          <div className="bg-red-500/15 border border-red-500/40 rounded-2xl p-4 flex items-start gap-3 max-w-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-200 font-medium">{camError}</p>
          </div>
        ) : (
          <>
            <div id="bb-qr-reader" className="w-full max-w-sm rounded-3xl overflow-hidden" />
            {error ? (
              <p className="text-[12px] text-red-300 font-bold mt-5 text-center max-w-xs">{error}<br /><span className="text-white/50 font-medium">Réessayez…</span></p>
            ) : (
              <p className="text-[12px] text-white/60 font-medium mt-5 text-center">
                Pointez la caméra vers le QR code du client.<br />Il se trouve dans son email de confirmation.
              </p>
            )}
          </>
        )}
      </div>
      <div className="p-6">
        <button onClick={onClose} className="w-full py-4 bg-white/10 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest active:scale-95">
          Annuler
        </button>
      </div>
    </div>
  );
}
