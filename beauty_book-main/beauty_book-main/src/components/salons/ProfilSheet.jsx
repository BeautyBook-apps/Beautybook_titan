import { createPortal } from "react-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VueClient from "@/pages/pro/VueClient";

/**
 * ProfilSheet — wrapper qui affiche directement VueClient (même page que le profil pro).
 * Reçoit un objet `profil` avec user_email / pro_email / email pour identifier le pro.
 */
export default function ProfilSheet({ profil, onClose }) {
  const proEmail = profil?.user_email || profil?.pro_email || profil?.email;

  useEffect(() => {
    const appContent = document.getElementById("app-content");
    if (appContent) appContent.style.overflow = "hidden";
    return () => { if (appContent) appContent.style.overflow = ""; };
  }, []);

  if (!profil) return null;

  const container = document.getElementById("app-shell") || document.body;

  const sheet = (
    <div className="absolute inset-0 z-[9999] flex flex-col bg-[#f5f5f5] overflow-y-auto hide-scrollbar">
      <VueClient onClose={onClose} proEmail={proEmail} profil={profil} />
    </div>
  );

  return createPortal(sheet, container);
}