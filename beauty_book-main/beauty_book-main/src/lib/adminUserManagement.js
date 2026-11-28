import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseServiceRoleKey } from '@/api/supabaseClient';

const SUPABASE_URL = supabaseUrl || import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = supabaseServiceRoleKey || import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SERVICE_ROLE_KEY || 'placeholder-service-key',
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

export function getDeviceId() {
  let devId = localStorage.getItem("bb_device_id");
  if (!devId) {
    devId = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("bb_device_id", devId);
  }
  return devId;
}

export async function deleteAccountCompletely({ userId, email }) {
  if (!userId && !email) throw new Error("ID ou Email manquant.");

  const targets = [];
  if (email) {
    targets.push(
      { col: 'email', val: email },
      { col: 'user_email', val: email },
      { col: 'client_email', val: email },
      { col: 'pro_email', val: email },
      { col: 'author_email', val: email },
      { col: 'sender_email', val: email },
      { col: 'receiver_email', val: email }
    );
  }

  const tables = [
    'profiles', 'ProfilPro', 'Service', 'ServiceBundle', 'Reservation', 'Commande',
    'Reel', 'Style', 'Publication', 'Repub', 'CommentaireStyle', 'Notification',
    'MessageChat', 'PointsFidelite', 'Annonce', 'DemandeProV2', 'ImmobilierListing',
    'LiveSession', 'LiveMessage', 'Client', 'MembreEquipe', 'RoutineBeaute',
    'PointsFidelitePro', 'CatalogueOption', 'Avis', 'VisiteVirtuelle',
    'MariaConversation', 'UserMemory', 'SoldeBeautyPay'
  ];

  for (const table of tables) {
    try {
      if (userId && (table === 'profiles' || table === 'ProfilPro')) {
        await supabaseAdmin.from(table).delete().eq('id', userId);
      }
      if (email) {
        if (table === 'profiles' || table === 'ProfilPro' || table === 'PointsFidelite' || table === 'Notification' || table === 'RoutineBeaute' || table === 'UserMemory' || table === 'MariaConversation') {
          await supabaseAdmin.from(table).delete().eq('email', email);
        }
        if (table === 'ProfilPro' || table === 'Service' || table === 'ServiceBundle' || table === 'Annonce' || table === 'Client' || table === 'MembreEquipe' || table === 'CatalogueOption' || table === 'VisiteVirtuelle') {
          await supabaseAdmin.from(table).delete().eq('pro_email', email);
        }
        if (table === 'Reservation' || table === 'Commande') {
          await supabaseAdmin.from(table).delete().eq('client_email', email);
        }
        if (table === 'Reel' || table === 'Style' || table === 'Publication' || table === 'Repub') {
          await supabaseAdmin.from(table).delete().eq('author_email', email);
        }
        if (table === 'MessageChat') {
          await supabaseAdmin.from(table).delete().or(`sender_email.eq.${email},receiver_email.eq.${email}`);
        }
        if (table === 'PointsFidelitePro') {
          await supabaseAdmin.from(table).delete().eq('pro_email', email);
        }
        if (table === 'SoldeBeautyPay') {
          await supabaseAdmin.from(table).delete().eq('user_email', email);
        }
      }
    } catch (e) {
      console.warn(`[DeleteAccount] Cleanup table ${table} warning:`, e);
    }
  }

  if (userId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (e) {
      console.warn("[DeleteAccount] Supabase auth.admin.deleteUser warning:", e);
    }
  }

  return true;
}

export async function banUserPermanently({ userId, email, deviceId, reason = "Bannissement administrateur à vie" }) {
  const currentDevId = deviceId || getDeviceId();

  try {
    const { data: configRows } = await supabaseAdmin.from('AppConfig').select('*').eq('key', 'banned_entities');
    let bannedList = configRows?.[0]?.value || { emails: [], devices: [] };

    if (!Array.isArray(bannedList.emails)) bannedList.emails = [];
    if (!Array.isArray(bannedList.devices)) bannedList.devices = [];

    if (email && !bannedList.emails.includes(email.toLowerCase())) {
      bannedList.emails.push(email.toLowerCase());
    }
    if (currentDevId && !bannedList.devices.includes(currentDevId)) {
      bannedList.devices.push(currentDevId);
    }

    if (configRows?.[0]?.id) {
      await supabaseAdmin.from('AppConfig').update({ value: bannedList }).eq('id', configRows[0].id);
    } else {
      await supabaseAdmin.from('AppConfig').insert({ key: 'banned_entities', value: bannedList });
    }
  } catch (e) {
    console.warn("[BanUser] AppConfig banned_entities update warning:", e);
  }

  if (userId || email) {
    try {
      const updateData = {
        role: 'banned',
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason,
        device_id: currentDevId
      };
      if (userId) {
        await supabaseAdmin.from('profiles').update(updateData).eq('id', userId);
      } else if (email) {
        await supabaseAdmin.from('profiles').update(updateData).eq('email', email);
      }
    } catch (e) {
      console.warn("[BanUser] Profile update warning:", e);
    }
  }

  if (userId) {
    try {
      await supabaseAdmin.auth.admin.signOut(userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (e) {
      console.warn("[BanUser] Auth revoke warning:", e);
    }
  }

  return true;
}

export async function unbanUser({ email, deviceId }) {
  try {
    const { data: configRows } = await supabaseAdmin.from('AppConfig').select('*').eq('key', 'banned_entities');
    if (configRows?.[0]) {
      let bannedList = configRows[0].value || { emails: [], devices: [] };
      if (email) bannedList.emails = (bannedList.emails || []).filter(e => e !== email.toLowerCase());
      if (deviceId) bannedList.devices = (bannedList.devices || []).filter(d => d !== deviceId);
      await supabaseAdmin.from('AppConfig').update({ value: bannedList }).eq('id', configRows[0].id);
    }
    if (email) {
      await supabaseAdmin.from('profiles').update({ role: 'user', is_banned: false, banned_reason: null }).eq('email', email);
    }
  } catch (e) {
    console.warn("[UnbanUser] Error:", e);
  }
}

export async function checkIfBanned({ email, deviceId }) {
  const devId = deviceId || getDeviceId();
  try {
    const { data: configRows } = await supabase.from('AppConfig').select('*').eq('key', 'banned_entities');
    const bannedList = configRows?.[0]?.value || { emails: [], devices: [] };

    const emailBanned = email && Array.isArray(bannedList.emails) && bannedList.emails.includes(email.toLowerCase());
    const deviceBanned = devId && Array.isArray(bannedList.devices) && bannedList.devices.includes(devId);

    if (emailBanned || deviceBanned) {
      return {
        isBanned: true,
        reason: "Votre compte ou votre appareil a été banni définitivement par l'administration."
      };
    }
  } catch (e) {
    console.warn("[CheckBanned] Error:", e);
  }
  return { isBanned: false };
}
