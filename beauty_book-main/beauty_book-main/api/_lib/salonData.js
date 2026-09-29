// ─── Données salon côté serveur (fonctions Vercel) ──────────────────────────
// Moteur LECTURE SEULE utilisé par les outils IA serveur (chatbot Maria,
// community manager IA) : catalogue réel + créneaux libres réels.
// Mêmes règles que l'application (StepCalendar) et l'agent vocal :
//   - intervalle entre créneaux = durée du service + 15 min de nettoyage ;
//   - pauses du jour exclues ; congés exclus ; créneaux passés exclus ;
//   - mode nuit quand le salon l'a activé ;
//   - un créneau n'est libre que si sièges occupés < seats_count.
// JAMAIS de créneaux inventés : en cas d'échec on renvoie
// { ok: false, reason } et l'IA le dit honnêtement.
import { createClient } from '@supabase/supabase-js';

const SLOT_BUFFER_MIN = 15;
const DAY_KEYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

let _admin = null;
function adminClient() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtSlot(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMin(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 1440 ? v : null;
}

function hasHoursData(ouverture) {
  if (!ouverture || typeof ouverture !== 'object') return false;
  return DAY_KEYS.some((k) => {
    const d = ouverture[k];
    return d && typeof d === 'object' && (d.open === true || d.open === false || d.start || d.end);
  });
}

function applyNightMode(ouverture, travailNuit) {
  if (!travailNuit || !hasHoursData(ouverture)) return ouverture;
  const night = {};
  DAY_KEYS.forEach((k) => {
    const d = ouverture[k];
    night[k] = d && d.open ? { ...d, start: '21:00', end: '07:00' } : d;
  });
  if (ouverture.conges) night.conges = ouverture.conges;
  return night;
}

function mergedOpening(profil) {
  let ouvRaw = profil?.ouverture;
  let horRaw = profil?.horaires;
  if (typeof ouvRaw === 'string') { try { ouvRaw = JSON.parse(ouvRaw); } catch { ouvRaw = null; } }
  if (typeof horRaw === 'string') { try { horRaw = JSON.parse(horRaw); } catch { horRaw = null; } }
  const merged = {};
  DAY_KEYS.forEach((dn) => {
    const cap = dn.charAt(0).toUpperCase() + dn.slice(1);
    merged[dn] =
      (ouvRaw && ouvRaw[dn]) || (horRaw && horRaw[dn]) ||
      (ouvRaw && ouvRaw[cap]) || (horRaw && horRaw[cap]) || null;
  });
  if (ouvRaw?.conges) merged.conges = ouvRaw.conges;
  else if (horRaw?.conges) merged.conges = horRaw.conges;
  const anyDay = DAY_KEYS.some((dn) => merged[dn] && typeof merged[dn] === 'object');
  const base = anyDay ? merged : (ouvRaw || horRaw || null);
  return applyNightMode(base, !!(profil && profil.travail_nuit));
}

function isInConges(date, ouverture) {
  let raw = ouverture;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return false; } }
  const conges = raw?.conges || [];
  if (!conges.length) return false;
  const ts = date.getTime();
  return conges.some((c) => {
    if (!c?.start || !c?.end) return false;
    const s = new Date(`${c.start}T00:00:00`).getTime();
    const e = new Date(`${c.end}T23:59:59`).getTime();
    return ts >= s && ts <= e;
  });
}

/** Catalogue réel du salon : services + offres/packs actifs. */
export async function getSalonServices(proEmail) {
  const sb = adminClient();
  if (!sb) return { ok: false, reason: 'SERVICE_NON_CONFIGURE' };
  const email = normEmail(proEmail);
  const { data: svcs, error: sErr } = await sb
    .from('Service')
    .select('id,title,name,price,duration,duration_min')
    .eq('pro_email', email)
    .limit(100);
  if (sErr) return { ok: false, reason: 'LECTURE_IMPOSSIBLE' };
  const { data: bundles } = await sb
    .from('ServiceBundle')
    .select('id,name,bundle_price,service_ids')
    .eq('pro_email', email)
    .eq('is_active', true)
    .limit(40);
  const services = (svcs || []).map((s) => ({
    name: s.title || s.name || 'Prestation',
    price: s.price != null ? Number(s.price) : null,
    duration_min: Number(s.duration || s.duration_min || 60),
  }));
  const packs = (bundles || []).map((b) => ({
    name: b.name || 'Offre pack',
    price: b.bundle_price != null ? Number(b.bundle_price) : null,
  }));
  return { ok: true, services, packs };
}

/**
 * Créneaux libres réels pour une date (AAAA-MM-JJ) et une durée en minutes.
 * Retourne { ok, slots: [{ time, seats_left }], closed } — jamais inventé.
 */
export async function getAvailableSlots(proEmail, dateStr, durationMin) {
  const sb = adminClient();
  if (!sb) return { ok: false, reason: 'SERVICE_NON_CONFIGURE' };
  const d = parseDate(dateStr);
  if (!d) return { ok: false, reason: 'DATE_INVALIDE' };
  const email = normEmail(proEmail);

  const { data: profil, error: pErr } = await sb
    .from('ProfilPro')
    .select('salon_name,ouverture,horaires,seats_count,travail_nuit')
    .eq('user_email', email)
    .maybeSingle();
  if (pErr) return { ok: false, reason: 'IMPOSSIBLE_DE_LIRE_LE_PLANNING' };
  if (!profil) return { ok: false, reason: 'SALON_INTROUVABLE' };

  const opening = mergedOpening(profil);
  if (!opening) return { ok: false, reason: 'HORAIRES_NON_CONFIGURES' };
  const dayKey = DAY_KEYS[(d.getDay() + 6) % 7];
  const day = opening[dayKey];
  if (!day || day.open !== true || !day.start || !day.end) {
    return { ok: true, slots: [], closed: true };
  }
  if (isInConges(d, opening)) return { ok: true, slots: [], closed: true };

  const duration = Math.max(5, Number(durationMin) || 60);
  const interval = duration + SLOT_BUFFER_MIN;
  const openMin = timeToMin(day.start);
  let closeMin = timeToMin(day.end);
  if (openMin == null || closeMin == null) return { ok: false, reason: 'HORAIRES_NON_CONFIGURES' };
  const overnightRange = closeMin <= openMin;
  const endCursor = overnightRange ? closeMin + 1440 : closeMin;
  const pauseS = day.pause_start ? timeToMin(day.pause_start) : null;
  const pauseE = day.pause_end ? timeToMin(day.pause_end) : null;

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const minSlotMin = isToday ? now.getHours() * 60 + now.getMinutes() + 15 : null;

  const { data: bookings, error: bErr } = await sb
    .from('Reservation')
    .select('time_slot,duration_min,end_time_slot,persons,status')
    .eq('pro_email', email)
    .eq('date', dateStr);
  if (bErr) return { ok: false, reason: 'IMPOSSIBLE_DE_LIRE_LE_PLANNING' };
  const seatsTotal = Math.max(1, Number(profil?.seats_count) || 1);
  const busy = (bookings || [])
    .filter((r) => r.status !== 'annule')
    .map((r) => {
      const s = timeToMin(r.time_slot || '00:00') ?? 0;
      let e = r.end_time_slot ? timeToMin(r.end_time_slot) : null;
      if (e == null) e = s + (Number(r.duration_min) || 60);
      if (e < s) e += 1440;
      return { s, e, persons: Math.max(1, Number(r.persons) || 1) };
    });

  const slots = [];
  const pushIfFree = (cursor) => {
    const slotStr = fmtSlot(cursor);
    const endStr = fmtSlot(cursor + duration);
    if (pauseS != null && pauseE != null && timeToMin(slotStr) < pauseE && timeToMin(endStr) > pauseS) return;
    if (minSlotMin !== null) {
      const past = cursor >= 1440
        ? (minSlotMin < 720 ? (cursor - 1440) < minSlotMin : false)
        : cursor < minSlotMin;
      if (past) return;
    }
    const slotEndBuf = cursor + duration + SLOT_BUFFER_MIN;
    let occupied = 0;
    for (const b of busy) {
      let bs = b.s;
      let be = b.e;
      if (cursor >= 1440 && bs < 720) { bs += 1440; be += 1440; }
      const beBuf = be + SLOT_BUFFER_MIN;
      if (cursor < beBuf && slotEndBuf > bs) occupied += b.persons;
    }
    if (occupied < seatsTotal) slots.push({ time: slotStr, seats_left: seatsTotal - occupied });
  };

  let cursor = openMin;
  while (cursor + duration <= endCursor) {
    pushIfFree(cursor);
    cursor += interval;
  }

  const travailNuit = !!profil.travail_nuit;
  if (travailNuit && !overnightRange) {
    let nc = 21 * 60;
    while (nc + duration <= 31 * 60) {
      pushIfFree(nc);
      nc += interval;
    }
  }

  return { ok: true, slots, closed: false, seats_total: seatsTotal };
}
