// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function : send-reservation-email
// Envoi des emails transactionnels de réservation via Resend.
//
// POST /  body JSON :
//   { type: "confirmed" | "cancelled" | "completed",
//     to, clientName, serviceName, date, time, proName, salonName,
//     salonAddress, price, bookingCode, clientCode, qrCodeUrl }
//
// Secrets requis (supabase secrets set) :
//   RESEND_API_KEY            (clé Resend — https://resend.com/api-keys)
//   RESEND_FROM               (ex : "BeautyBook <contact@beautybook.app>")
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "BeautyBook <contact@beautybook.app>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function layout(title, preheader, bodyHtml) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f4f1;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
<div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
<div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:28px 24px;text-align:center;">
<p style="margin:0;color:#fff;font-size:22px;font-weight:900;letter-spacing:.5px;">BeautyBook</p>
<p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:13px;">${esc(title)}</p>
</div>
<div style="padding:28px 24px;color:#1f2937;font-size:14px;line-height:1.6;">${bodyHtml}</div>
<div style="padding:18px 24px;background:#faf9f7;border-top:1px solid #f0ede8;text-align:center;">
<p style="margin:0;font-size:11px;color:#9ca3af;">Cet email a été envoyé automatiquement par BeautyBook.<br>Merci de ne pas y répondre.</p>
</div></div></div></body></html>`;
}

function recapRows(p) {
  const rows = [
    ["Prestation", p.serviceName],
    ["Date", p.date],
    ["Heure", p.time],
    ["Salon", p.salonName || p.proName],
    ["Adresse", p.salonAddress],
    ["Prix", p.price ? `${p.price}€` : ""],
  ].filter(([, v]) => v);
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#faf9f7;border-radius:12px;overflow:hidden;">` +
    rows.map(([k, v]) => `<tr><td style="padding:10px 14px;font-size:12px;color:#6b7280;font-weight:700;">${esc(k)}</td><td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600;text-align:right;">${esc(v)}</td></tr>`).join("") +
    `</table>`;
}

function confirmedEmail(p) {
  const firstName = esc((p.clientName || "").split(" ")[0] || "Bonjour");
  return {
    subject: `✅ Votre RDV est confirmé — ${p.serviceName || "BeautyBook"}`,
    html: layout("Rendez-vous confirmé", `Votre RDV ${p.serviceName} est confirmé. Présentez votre QR code au salon.`, `
      <p style="margin:0 0 4px;font-size:16px;font-weight:800;">${firstName}, bonne nouvelle ! 🎉</p>
      <p style="margin:0;color:#4b5563;">Votre rendez-vous a été <strong>confirmé</strong> par ${esc(p.salonName || p.proName || "votre salon")}.</p>
      ${recapRows(p)}
      <p style="margin:16px 0 8px;font-weight:800;">📱 Votre QR code — à présenter au professionnel</p>
      ${p.qrCodeUrl ? `<div style="text-align:center;margin:8px 0;"><img src="${esc(p.qrCodeUrl)}" alt="QR code du rendez-vous" width="200" style="width:200px;height:200px;border-radius:12px;border:1px solid #eee;"></div>` : ""}
      <div style="background:#fff7ed;border:2px dashed #fdba74;border-radius:14px;padding:14px;text-align:center;margin:12px 0;">
        <p style="margin:0;font-size:11px;color:#9a3412;font-weight:700;">CODE CLIENT</p>
        <p style="margin:4px 0;font-size:32px;font-weight:900;letter-spacing:.35em;color:#111827;">${esc(p.clientCode || "—")}</p>
        <p style="margin:0;font-size:11px;color:#9a3412;">ID de réservation : <strong>${esc(p.bookingCode || "")}</strong></p>
      </div>
      <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">💡 <strong>Pas encore l'application ?</strong> Conservez cet email : votre <strong>ID de réservation</strong> ci-dessus vous permet de retrouver ce rendez-vous dans l'application, rubrique « Rendez-vous » → « Ajouter un ID de réservation ».</p>
    `),
  };
}

function cancelledEmail(p) {
  return {
    subject: `Votre RDV a été annulé — ${p.serviceName || "BeautyBook"}`,
    html: layout("Rendez-vous annulé", `Votre RDV ${p.serviceName} a été annulé.`, `
      <p style="margin:0 0 4px;font-size:16px;font-weight:800;">Bonjour ${esc((p.clientName || "").split(" ")[0] || "")},</p>
      <p style="margin:0;color:#4b5563;">Votre rendez-vous <strong>${esc(p.serviceName || "")}</strong> du <strong>${esc(p.date || "")}</strong> a été <strong>annulé</strong> par ${esc(p.salonName || p.proName || "le salon")}.</p>
      <p style="margin:12px 0 0;color:#4b5563;">N'hésitez pas à réserver un nouveau créneau depuis l'application BeautyBook. 💛</p>
    `),
  };
}

function completedEmail(p) {
  const firstName = esc((p.clientName || "").split(" ")[0] || "");
  return {
    subject: `🙏 Merci ${firstName} ! Votre prestation est terminée`,
    html: layout("Prestation terminée — merci !", `Merci pour votre visite. Votre prestation ${p.serviceName} est terminée.`, `
      <p style="margin:0 0 4px;font-size:16px;font-weight:800;">Merci ${firstName} ! ✨</p>
      <p style="margin:0;color:#4b5563;">Votre prestation <strong>${esc(p.serviceName || "")}</strong> chez ${esc(p.salonName || p.proName || "votre salon")} est <strong>terminée</strong>. Nous espérons que le résultat vous plaît ! 💛</p>
      <div style="background:#faf9f7;border-radius:14px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-weight:800;">💬 Votre avis compte énormément</p>
        <p style="margin:0;font-size:13px;color:#4b5563;">Prenez 30 secondes pour noter votre expérience dans l'application BeautyBook : cela aide votre professionnel et guide les prochains clients.</p>
      </div>
      <p style="margin:0;color:#4b5563;">🎁 Vos <strong>points fidélité</strong> ont été crédités sur votre compte. À très vite pour votre prochain moment beauté !</p>
    `),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY manquante (supabase secrets set)" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  let p;
  try { p = await req.json(); } catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }
  if (!p.to || !p.type) {
    return new Response(JSON.stringify({ error: "Champs requis : to, type" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const builders = { confirmed: confirmedEmail, cancelled: cancelledEmail, completed: completedEmail };
  const build = builders[p.type];
  if (!build) return new Response(JSON.stringify({ error: "type inconnu" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  const { subject, html } = build(p);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [p.to], subject, html }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return new Response(JSON.stringify({ error: body?.message || "Resend error", details: body }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, id: body?.id }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
