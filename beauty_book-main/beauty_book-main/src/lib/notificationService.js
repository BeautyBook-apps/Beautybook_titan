import { supabase } from '@/api/supabaseClient';

/**
 * Service centralisé de création de notifications.
 * Utilise toujours action_url (pas link) + les deux flags read/is_read.
 */

const VALID_TYPES = ["message", "reservation", "promo", "avis", "commande", "system"];

function emailToName(email) {
  if (!email) return "Utilisateur";
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Crée une ou plusieurs notifications dans la table Notification.
 * @param {Object|Object[]} payloads - Un seul objet ou un tableau d'objets.
 *   Chaque objet : { user_email, title, body, type, icon?, action_url?, data? }
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function createNotification(payloads) {
  const items = Array.isArray(payloads) ? payloads : [payloads];

  const rows = items.map(p => ({
    user_email: p.user_email,
    title: p.title,
    message: p.body || p.message || "",
    body: p.body || p.message || "",
    type: VALID_TYPES.includes(p.type) ? p.type : "system",
    icon: p.icon || null,
    action_url: p.action_url || p.link || null,
    data: p.data || {},
    is_read: false,
    read: false,
    created_at: new Date().toISOString(),
  }));

  try {
    const { data, error } = await supabase.from("Notification").insert(rows);
    if (error) {
      console.error("[notificationService] insert error:", error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (e) {
    console.error("[notificationService] insert exception:", e);
    return { data: null, error: e };
  }
}

/**
 * Compte les notifications non lues pour un email donné.
 * @param {string} userEmail
 * @returns {Promise<number>}
 */
export async function getUnreadCount(userEmail) {
  if (!userEmail) return 0;
  const { count, error } = await supabase
    .from("Notification")
    .select("id", { count: "exact", head: true })
    .eq("user_email", userEmail)
    .eq("read", false);
  if (error) {
    console.error("[notificationService] count error:", error);
    return 0;
  }
  return count || 0;
}

/**
 * Charge les notifications d'un utilisateur.
 * @param {string} userEmail
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
export async function loadNotifications(userEmail, limit = 50) {
  if (!userEmail) return [];
  const { data, error } = await supabase
    .from("Notification")
    .select("*")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[notificationService] load error:", error);
    return [];
  }
  return data || [];
}

/**
 * Marque une notification comme lue.
 * @param {string} notifId
 */
export async function markAsRead(notifId) {
  if (!notifId) return;
  await supabase
    .from("Notification")
    .update({ read: true, is_read: true })
    .eq("id", notifId);
}

/**
 * Marque toutes les notifications non lues d'un utilisateur comme lues.
 * @param {string} userEmail
 */
export async function markAllAsRead(userEmail) {
  if (!userEmail) return;
  await supabase
    .from("Notification")
    .update({ read: true, is_read: true })
    .eq("user_email", userEmail)
    .eq("read", false);
}

/** Supprime définitivement une notification appartenant à l'utilisateur. */
export async function deleteNotification(notifId, userEmail) {
  if (!notifId) return;
  let query = supabase.from("Notification").delete().eq("id", notifId);
  if (userEmail) query = query.eq("user_email", userEmail);
  const { error } = await query;
  if (error) throw error;
}

// ── Notifications pré-générées ──────────────────────────────────────────────

/** Le pro confirme une réservation → notifie le client */
export async function notifyReservationConfirmed({ clientEmail, serviceName, date, time, proName }) {
  return createNotification({
    user_email: clientEmail,
    type: "reservation",
    title: "✅ Réservation confirmée !",
    body: `Votre rendez-vous "${serviceName}" le ${date} à ${time || ""} avec ${proName || "votre pro"} est confirmé.`,
    action_url: "/rendez-vous",
    data: { reservation_type: "confirmed" },
  });
}

/** Le client crée une réservation → notifie le pro */
export async function notifyNewReservation({ proEmail, clientEmail, serviceName, date, time }) {
  return createNotification({
    user_email: proEmail,
    type: "reservation",
    title: "📅 Nouvelle réservation",
    body: `${emailToName(clientEmail)} a réservé "${serviceName}" le ${date} à ${time || "00:00"}.`,
    action_url: "/pro/gestion-agenda",
    data: { reservation_type: "new" },
  });
}

/** Le pro annule une réservation → notifie le client */
export async function notifyReservationCancelled({ clientEmail, serviceName, date, proName }) {
  return createNotification({
    user_email: clientEmail,
    type: "reservation",
    title: "❌ Réservation annulée",
    body: `Votre rendez-vous "${serviceName}" le ${date} avec ${proName || "votre pro"} a été annulé.`,
    action_url: "/rendez-vous",
    data: { reservation_type: "cancelled" },
  });
}

/** Un message est reçu → notifie le destinataire */
export async function notifyMessageReceived({ receiverEmail, senderName, senderEmail, conversationId, preview }) {
  return createNotification({
    user_email: receiverEmail,
    type: "message",
    title: `💬 Nouveau message de ${senderName || emailToName(senderEmail)}`,
    body: preview || "Vous avez reçu un nouveau message.",
    action_url: `/messages?to=${encodeURIComponent(senderEmail)}&name=${encodeURIComponent(senderName || emailToName(senderEmail))}`,
    data: { conversation_id: conversationId, sender_email: senderEmail, sender_name: senderName },
  });
}

/** Paiement confirmé → notifie le client */
export async function notifyPaymentConfirmed({ clientEmail, serviceName, amount, date }) {
  return createNotification({
    user_email: clientEmail,
    type: "commande",
    title: "💳 Paiement confirmé",
    body: `Votre paiement de ${amount || ""}€ pour "${serviceName}" le ${date} a été confirmé.`,
    action_url: "/rendez-vous",
    data: { payment_type: "confirmed" },
  });
}
