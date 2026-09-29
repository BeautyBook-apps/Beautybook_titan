/**
 * ── Codes de réservation + QR code ──────────────────────────────────────────
 * - booking_code : matricule unique et saisissable (ex « BB-7K2Q9P »). Il
 *   permet à un client SANS l'application (ex : réservation par téléphone
 *   via l'agent vocal IA) de retrouver son récapitulatif en le tapant dans
 *   « Ajouter un ID de réservation ».
 * - client_code  : code à 4 chiffres à présenter au professionnel (crg_code
 *   historique). Le pro le saisit ou le scanne pour valider la prestation.
 * - QR code      : contient le récapitulatif + les deux codes. Généré à la
 *   confirmation du RDV, stocké dans le bucket public « qr-codes », inclus
 *   dans l'email de confirmation.
 */
import QRCode from "qrcode";
import { supabase } from "@/api/supabaseClient";

const BOOKING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I

export function generateBookingCode() {
  let s = "";
  const bytes = new Uint32Array(6);
  (window.crypto || {}).getRandomValues
    ? window.crypto.getRandomValues(bytes)
    : bytes.map(() => Math.floor(Math.random() * 4294967296));
  for (let i = 0; i < 6; i++) s += BOOKING_ALPHABET[bytes[i] % BOOKING_ALPHABET.length];
  return `BB-${s}`;
}

/** Code client à 4 chiffres (même format que le crg_code historique). */
export function generateClientCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Contenu compact du QR code : récapitulatif + codes. */
export function buildQrPayload(r) {
  return JSON.stringify({
    v: 1,
    booking: r.booking_code || "",
    code: r.crg_code || "",
    service: r.service_name || r.service || "",
    date: r.date || "",
    time: r.time || r.time_slot || "",
    salon: r.salon_name || r.pro_name || "",
    price: r.total_price ?? r.service_price ?? 0,
  });
}

/** Parse le contenu d'un QR scanné. Retourne null si ce n'est pas un QR BeautyBook. */
export function parseQrPayload(text) {
  try {
    const o = JSON.parse(String(text || "").trim());
    if (o && o.v === 1 && o.booking) return o;
    return null;
  } catch {
    return null;
  }
}

export async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { width: 512, margin: 2, errorCorrectionLevel: "M" });
}

/** Upload le PNG du QR dans le bucket public « qr-codes ». Retourne l'URL publique. */
export async function uploadQrCode(dataUrl, bookingCode) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${bookingCode || "qr"}.png`;
  const { error } = await supabase.storage.from("qr-codes").upload(path, blob, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("qr-codes").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Garantit qu'une réservation a un QR code : le génère + l'upload + le
 * sauvegarde si manquant. Retourne l'URL (ou "" en cas d'échec silencieux).
 */
export async function ensureReservationQr(rdv) {
  try {
    if (rdv.qr_code_url) return rdv.qr_code_url;
    const booking = rdv.booking_code || generateBookingCode();
    const url = await uploadQrCode(await generateQrDataUrl(buildQrPayload({ ...rdv, booking_code: booking })), booking);
    await supabase.from("Reservation").update({ qr_code_url: url, booking_code: booking }).eq("id", rdv.id);
    return url;
  } catch (e) {
    console.error("QR generation error:", e);
    return "";
  }
}

/** Envoi d'email via la Edge Function « send-reservation-email » (Resend). */
export async function sendReservationEmail(type, payload) {
  const { data, error } = await supabase.functions.invoke("send-reservation-email", {
    body: { type, ...payload },
  });
  if (error) throw error;
  return data;
}
