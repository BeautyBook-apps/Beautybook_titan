// ─── Outils de l'agent vocal (function calling temps réel) ─────────────────
// Exécutés CÔTÉ CLIENT quand l'agent vocal (mode direct) appelle un outil.
// Chaque outil lit/écrit les VRAIES données Supabase du salon :
//   - check_availability : créneaux libres calculés depuis les horaires du
//     salon + les réservations existantes (aucun créneau inventé) ;
//   - create_booking     : crée la réservation dans `Reservation`
//     (statut en_attente → visible dans la page Gestion agenda du pro) ;
//   - find_booking / reschedule_booking / cancel_booking : gestion des RDV ;
//   - end_call           : l'agent demande la fin de l'appel.
//
// Règle d'or : en cas d'échec, on renvoie { status: 'error', message } —
// JAMAIS un faux succès. L'agent dira alors honnêtement qu'il ne peut pas
// accéder au planning (cf. ses instructions).
import { supabase } from '@/api/supabaseClient';
import { getEffectiveOpening, DAY_KEYS, timeToMin } from './hours';
import { generateBookingCode, generateClientCode } from './bookingCodes';

const SLOT_STEP = 30; // pas de génération des créneaux (minutes)

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

// ─── Lecture Supabase robuste ─────────────────────────────────────────────
// supabase-js ne lève PAS d'exception sur une erreur RLS/schéma : elle arrive
// dans le champ `error` avec `data: null`. L'ancien code ignorait `error` et
// traitait ça comme « zéro donnée » — l'agent voyait alors un planning VIDE
// au lieu d'une erreur d'accès. Ici on renvoie toujours { data, error }.
//
// + 1 tentative en cas d'échec : les micro-coupures réseau (l'agent « n'arrive
// PAS TOUJOURS » à accéder au planning) sont la cause n°1 des accès
// intermittents. On ne retente que les LECTURES, jamais les écritures.
async function readOnce(fn) {
  try {
    return await fn();
  } catch (e) {
    return { data: null, error: e };
  }
}
async function qread(fn, retries = 1) {
  let res = await readOnce(fn);
  if (res.error && retries > 0) {
    await new Promise((r) => setTimeout(r, 700));
    res = await readOnce(fn);
  }
  return res;
}

function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtSlot(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function err(message, code) {
  return { status: 'error', message, code: code || 'ERROR' };
}

async function getProfil(proEmail) {
  const { data, error } = await qread(() =>
    supabase
      .from('ProfilPro')
      .select('salon_name,address,adresse,phone,telephone,ouverture,horaires')
      .eq('user_email', normEmail(proEmail))
      .maybeSingle()
  );
  if (error) return { profil: null, error };
  return { profil: data || null, error: null };
}

async function getService(proEmail, serviceId) {
  if (!serviceId) return null;
  const { data, error } = await qread(() =>
    supabase
      .from('Service')
      .select('id,title,name,price,duration,duration_min')
      .eq('pro_email', normEmail(proEmail))
      .eq('id', serviceId)
      .maybeSingle()
  );
  if (error) return null;
  return data || null;
}

async function getBundles(proEmail) {
  const { data, error } = await qread(() =>
    supabase
      .from('ServiceBundle')
      .select('id,name,description,bundle_price,service_ids,is_active')
      .eq('pro_email', normEmail(proEmail))
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(40)
  );
  if (error) return [];
  return data || [];
}

/**
 * Résout une prestation : d'abord dans `Service` (par id), puis dans
 * `ServiceBundle` (par id), puis par nom (insensible à la casse) dans les
 * deux tables. Retourne { id, name, price, duration, kind } ou null.
 */
async function resolvePrestation(proEmail, { service_id, service_name }) {
  const email = normEmail(proEmail);
  const svc = await getService(email, service_id);
  if (svc) {
    return { id: svc.id, name: svc.title || svc.name || 'Prestation', price: svc.price != null ? Number(svc.price) : null, duration: Number(svc.duration || svc.duration_min || 60), kind: 'service' };
  }
  if (service_id) {
    const { data: b, error: bErr } = await qread(() =>
      supabase
        .from('ServiceBundle')
        .select('id,name,description,bundle_price,service_ids')
        .eq('pro_email', email)
        .eq('id', service_id)
        .maybeSingle()
    );
    if (!bErr && b) return await bundleToPrestation(email, b);
  }
  const nameQ = String(service_name || '').trim();
  if (nameQ) {
    const { data: svcs, error: sErr } = await qread(() =>
      supabase
        .from('Service')
        .select('id,title,name,price,duration,duration_min')
        .eq('pro_email', email)
        .or(`title.ilike.%${nameQ}%,name.ilike.%${nameQ}%`)
        .limit(1)
    );
    if (!sErr && svcs && svcs[0]) {
      const s = svcs[0];
      return { id: s.id, name: s.title || s.name || 'Prestation', price: s.price != null ? Number(s.price) : null, duration: Number(s.duration || s.duration_min || 60), kind: 'service' };
    }
    const { data: bnds, error: bErr } = await qread(() =>
      supabase
        .from('ServiceBundle')
        .select('id,name,description,bundle_price,service_ids')
        .eq('pro_email', email)
        .ilike('name', `%${nameQ}%`)
        .limit(1)
    );
    if (!bErr && bnds && bnds[0]) return await bundleToPrestation(email, bnds[0]);
  }
  return null;
}

async function bundleToPrestation(email, b) {
  let duration = 60;
  const ids = Array.isArray(b.service_ids) ? b.service_ids : [];
  if (ids.length > 0) {
    const { data: svcs, error } = await qread(() =>
      supabase
        .from('Service')
        .select('duration,duration_min')
        .eq('pro_email', email)
        .in('id', ids)
    );
    if (!error && svcs && svcs.length > 0) {
      duration = svcs.reduce((sum, s) => sum + Number(s.duration || s.duration_min || 60), 0);
    }
  }
  return {
    id: b.id,
    name: b.name || 'Offre pack',
    price: b.bundle_price != null ? Number(b.bundle_price) : null,
    duration,
    kind: 'bundle',
  };
}

async function getBookings(proEmail, dateStr) {
  const { data, error } = await qread(() =>
    supabase
      .from('Reservation')
      .select('time_slot,duration_min,end_time_slot,status')
      .eq('pro_email', normEmail(proEmail))
      .eq('date', dateStr)
  );
  if (error) return null; // erreur d'accès → l'appelant renverra une erreur honnête
  return (data || []).filter((r) => r.status !== 'annule');
}

/**
 * Calcule les créneaux libres pour une date et une durée de prestation.
 * Retourne { ok, slots, reason } — jamais de créneaux inventés.
 */
async function findFreeSlots(proEmail, dateStr, durationMin) {
  const d = parseDate(dateStr);
  if (!d) return { ok: false, reason: 'Date invalide (format attendu : AAAA-MM-JJ).' };
  // On distingue « erreur d'accès au profil » (réseau/RLS → réessayer plus
  // tard) de « horaires réellement non configurés » : les deux donnaient
  // avant le même message trompeur.
  const { profil, error: profilErr } = await getProfil(proEmail);
  if (profilErr) {
    return { ok: false, reason: 'IMPOSSIBLE_DE_LIRE_LE_PLANNING' };
  }
  const opening = getEffectiveOpening(profil, null);
  if (!opening) {
    return { ok: false, reason: 'HORAIRES_NON_CONFIGURES' };
  }
  const dayKey = DAY_KEYS[(d.getDay() + 6) % 7];
  const day = opening[dayKey];
  if (!day || day.open !== true || !day.start || !day.end) {
    return { ok: true, slots: [], closed: true };
  }
  const startMin = timeToMin(day.start);
  let endMin = timeToMin(day.end);
  if (endMin <= startMin) endMin += 1440; // plage de nuit
  const pauseS = day.pause_start ? timeToMin(day.pause_start) : null;
  const pauseE = day.pause_end ? timeToMin(day.pause_end) : null;

  const existing = await getBookings(proEmail, dateStr);
  if (existing === null) {
    return { ok: false, reason: 'IMPOSSIBLE_DE_LIRE_LE_PLANNING' };
  }
  const busy = existing.map((r) => {
    const s = timeToMin(r.time_slot || '00:00');
    const e = r.end_time_slot ? timeToMin(r.end_time_slot) : s + (r.duration_min || 60);
    return [s, e];
  });

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const nowMin = now.getHours() * 60 + now.getMinutes() + 15; // marge 15 min

  const slots = [];
  for (let t = startMin; t + durationMin <= endMin; t += SLOT_STEP) {
    if (pauseS != null && pauseE != null && t < pauseE && t + durationMin > pauseS) continue;
    if (isToday && t < nowMin) continue;
    const overlap = busy.some(([s, e]) => t < e && t + durationMin > s);
    if (!overlap) slots.push(fmtSlot(t));
  }
  return { ok: true, slots, closed: false };
}

// ─── Définitions des outils (envoyées dans session.update) ──────────────────
const DEFINITIONS = [
  {
    type: 'function',
    name: 'check_availability',
    description:
      "Vérifie les créneaux réellement disponibles du salon pour une prestation et une date. À appeler AVANT de proposer un horaire au client.",
    parameters: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: "Identifiant de la prestation (si connu)" },
        service_name: { type: 'string', description: 'Nom de la prestation souhaitée' },
        date: { type: 'string', description: 'Date au format AAAA-MM-JJ (ex : 2026-10-02)' },
      },
      required: ['date'],
    },
  },
  {
    type: 'function',
    name: 'create_booking',
    description:
      "Crée la réservation dans le planning du salon (prestation OU offre pack). Le rendez-vous apparaît dans la page Gestion agenda du professionnel.",
    parameters: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Identifiant de la prestation' },
        service_name: { type: 'string', description: 'Nom de la prestation' },
        date: { type: 'string', description: 'Date au format AAAA-MM-JJ' },
        time_slot: { type: 'string', description: 'Heure au format HH:MM (ex : 14:30)' },
        client_name: { type: 'string', description: 'Nom du client' },
        client_phone: { type: 'string', description: 'Téléphone du client' },
        client_email: { type: 'string', description: 'Email du client (si communiqué)' },
        notes: { type: 'string', description: 'Notes éventuelles' },
      },
      required: ['date', 'time_slot', 'client_name'],
    },
  },
  {
    type: 'function',
    name: 'find_booking',
    description: 'Retrouve un ou des rendez-vous existants (par ID de réservation, nom ou téléphone du client).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "ID de réservation (ex BB-7K2Q9P), nom ou téléphone du client" },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'reschedule_booking',
    description: 'Déplace un rendez-vous existant vers un nouveau créneau (déjà vérifié disponible).',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Identifiant interne du rendez-vous (retourné par find_booking)' },
        new_date: { type: 'string', description: 'Nouvelle date au format AAAA-MM-JJ' },
        new_time_slot: { type: 'string', description: 'Nouvelle heure au format HH:MM' },
      },
      required: ['booking_id', 'new_date', 'new_time_slot'],
    },
  },
  {
    type: 'function',
    name: 'cancel_booking',
    description: 'Annule un rendez-vous existant.',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Identifiant interne du rendez-vous (retourné par find_booking)' },
      },
      required: ['booking_id'],
    },
  },
  {
    type: 'function',
    name: 'end_call',
    description:
      "Met fin à l'appel téléphonique. À utiliser quand le client souhaite raccrocher, ou après l'avertissement de sécurité si l'appelant insiste pour obtenir des données sensibles.",
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: "Raison de la fin d'appel (ex : demande traitée, insistance sur données sensibles)" },
      },
      required: [],
    },
  },
];

// ─── Exécuteurs ─────────────────────────────────────────────────────────────
function buildExecutors(proEmail) {
  const email = normEmail(proEmail);

  async function checkAvailability(args) {
    try {
      const dateStr = String(args.date || '').trim();
      const presta = await resolvePrestation(email, { service_id: args.service_id, service_name: args.service_name });
      const askedService = String(args.service_id || args.service_name || '').trim();
      if (askedService && !presta) {
        return err(
          `La prestation « ${askedService} » est introuvable dans le catalogue du salon. Demande au client de préciser ou propose-lui les prestations disponibles.`,
          'SERVICE_NOT_FOUND'
        );
      }
      const serviceName = presta?.name || 'prestation';
      const duration = Number(presta?.duration || 60);
      const res = await findFreeSlots(email, dateStr, duration);
      if (!res.ok) {
        if (res.reason === 'HORAIRES_NON_CONFIGURES') {
          return err(
            "Je n'arrive pas à accéder au planning pour le moment (horaires du salon non configurés). Propose de prendre un message.",
            'NO_HOURS'
          );
        }
        return err("Je n'arrive pas à accéder au planning pour le moment. Propose de prendre un message.", 'NO_ACCESS');
      }
      if (res.closed) {
        return { status: 'success', available: false, date: dateStr, reason: 'closed', message: 'Le salon est fermé ce jour-là.' };
      }
      return {
        status: 'success',
        available: res.slots.length > 0,
        date: dateStr,
        service: serviceName,
        duration_min: duration,
        free_slots: res.slots.slice(0, 8),
      };
    } catch (e) {
      return err("Je n'arrive pas à accéder au planning pour le moment. Propose de prendre un message.", 'NO_ACCESS');
    }
  }

  async function createBooking(args) {
    try {
      const dateStr = String(args.date || '').trim();
      const slot = String(args.time_slot || '').trim();
      const clientName = String(args.client_name || '').trim();
      if (!parseDate(dateStr) || !/^\d{2}:\d{2}$/.test(slot) || !clientName) {
        return err('Informations incomplètes : il me faut le nom du client, une date valide (AAAA-MM-JJ) et une heure (HH:MM).', 'MISSING_INFO');
      }
      const presta = await resolvePrestation(email, { service_id: args.service_id, service_name: args.service_name });
      const askedService = String(args.service_id || args.service_name || '').trim();
      if (askedService && !presta) {
        return err(
          `La prestation « ${askedService} » est introuvable dans le catalogue du salon. Demande au client de préciser la prestation souhaitée.`,
          'SERVICE_NOT_FOUND'
        );
      }
      const serviceName = presta?.name || 'Prestation';
      const duration = Number(presta?.duration || 60);
      const price = presta?.price != null ? Number(presta.price) : null;

      // Re-vérification défensive du créneau juste avant création.
      const check = await findFreeSlots(email, dateStr, duration);
      if (!check.ok) return err("Je n'arrive pas à accéder au planning pour le moment.", 'NO_ACCESS');
      if (check.closed) return err('Le salon est fermé ce jour-là.', 'CLOSED');
      if (!check.slots.includes(slot)) {
        return {
          status: 'error',
          code: 'SLOT_TAKEN',
          message: `Le créneau ${slot} n'est plus disponible. Propose au client : ${check.slots.slice(0, 3).join(', ') || 'aucun autre créneau ce jour-là'}.`,
          alternatives: check.slots.slice(0, 3),
        };
      }

      const { profil } = await getProfil(email);
      const booking_code = generateBookingCode();
      const crg_code = generateClientCode();
      const [hh, mm] = slot.split(':').map(Number);
      const endMin = hh * 60 + mm + duration;
      const payload = {
        pro_email: email,
        client_name: clientName,
        client_phone: String(args.client_phone || '').trim(),
        client_email: String(args.client_email || '').trim(),
        service_id: presta?.id || args.service_id || null,
        service_name: serviceName,
        service_price: price,
        total_price: price,
        date: dateStr,
        time_slot: slot,
        duration_min: duration,
        end_time_slot: fmtSlot(endMin),
        status: 'en_attente',
        source: 'agent_vocal',
        salon_name: profil?.salon_name || '',
        salon_address: profil?.address || profil?.adresse || '',
        notes: String(args.notes || '').trim(),
        booking_code,
        crg_code,
      };
      const { data, error } = await supabase.from('Reservation').insert(payload).select().single();
      if (error || !data) {
        return err("La création de la réservation a échoué. Propose de prendre un message pour l'équipe.", 'CREATE_FAILED');
      }
      return {
        status: 'success',
        booking_id: data.id,
        booking_code,
        client_code: crg_code,
        date: dateStr,
        time_slot: slot,
        service_name: serviceName,
        client_name: clientName,
        dictate_to_client:
          `Réservation enregistrée avec succès. COMMUNIQUE au client son ID de réservation en l'épelant lettre par lettre : ${booking_code}. ` +
          `Dis-lui qu'il pourra le saisir dans l'application BeautyBook, rubrique Rendez-vous → « Ajouter un ID de réservation », pour retrouver son rendez-vous.`,
      };
    } catch (e) {
      return err("La création de la réservation a échoué. Propose de prendre un message pour l'équipe.", 'CREATE_FAILED');
    }
  }

  async function findBooking(args) {
    try {
      const q = String(args.query || '').trim();
      if (!q) return err('Précise un ID de réservation, un nom ou un téléphone.', 'MISSING_INFO');
      let query = supabase
        .from('Reservation')
        .select('id,booking_code,date,time_slot,service_name,client_name,client_phone,status')
        .eq('pro_email', email)
        .neq('status', 'annule')
        .order('date', { ascending: true })
        .limit(10);
      const codeQ = q.toUpperCase().replace(/\s+/g, '');
      if (/^BB-[A-Z0-9]{6}$/.test(codeQ)) {
        query = query.eq('booking_code', codeQ);
      } else if (/^[0-9+ .-]{6,}$/.test(q)) {
        query = query.ilike('client_phone', `%${q.replace(/\D/g, '')}%`);
      } else {
        query = query.ilike('client_name', `%${q}%`);
      }
      const { data, error } = await query;
      if (error) return err("Je n'arrive pas à accéder au planning pour le moment.", 'NO_ACCESS');
      if (!data || data.length === 0) {
        return { status: 'success', found: false, message: 'Aucun rendez-vous trouvé avec ces informations.' };
      }
      return {
        status: 'success',
        found: true,
        bookings: data.map((b) => ({
          booking_id: b.id,
          booking_code: b.booking_code,
          date: b.date,
          time_slot: b.time_slot,
          service_name: b.service_name,
          client_name: b.client_name,
          status: b.status,
        })),
      };
    } catch (e) {
      return err("Je n'arrive pas à accéder au planning pour le moment.", 'NO_ACCESS');
    }
  }

  async function rescheduleBooking(args) {
    try {
      const { data: rdv, error: rErr } = await supabase
        .from('Reservation')
        .select('id,service_id,duration_min,time_slot,date,status,pro_email')
        .eq('id', args.booking_id)
        .eq('pro_email', email)
        .maybeSingle();
      if (rErr || !rdv) return err('Rendez-vous introuvable.', 'NOT_FOUND');
      if (rdv.status === 'annule') return err('Ce rendez-vous est déjà annulé.', 'ALREADY_CANCELLED');
      const dateStr = String(args.new_date || '').trim();
      const slot = String(args.new_time_slot || '').trim();
      if (!parseDate(dateStr) || !/^\d{2}:\d{2}$/.test(slot)) {
        return err('Nouvelle date ou heure invalide.', 'MISSING_INFO');
      }
      const duration = Number(rdv.duration_min || 60);
      const check = await findFreeSlots(email, dateStr, duration);
      if (!check.ok) return err("Je n'arrive pas à accéder au planning pour le moment.", 'NO_ACCESS');
      if (check.closed || !check.slots.includes(slot)) {
        return {
          status: 'error',
          code: 'SLOT_TAKEN',
          message: `Le créneau ${slot} le ${dateStr} n'est pas disponible. Alternatives : ${check.slots.slice(0, 3).join(', ') || 'aucune'}.`,
          alternatives: check.slots.slice(0, 3),
        };
      }
      const [hh, mm] = slot.split(':').map(Number);
      const { error: uErr } = await supabase
        .from('Reservation')
        .update({ date: dateStr, time_slot: slot, end_time_slot: fmtSlot(hh * 60 + mm + duration), status: 'en_attente' })
        .eq('id', rdv.id);
      if (uErr) return err('La modification a échoué.', 'UPDATE_FAILED');
      return { status: 'success', booking_id: rdv.id, new_date: dateStr, new_time_slot: slot };
    } catch (e) {
      return err('La modification a échoué.', 'UPDATE_FAILED');
    }
  }

  async function cancelBooking(args) {
    try {
      const { data: rdv, error: rErr } = await supabase
        .from('Reservation')
        .select('id,date,time_slot,service_name,status,pro_email')
        .eq('id', args.booking_id)
        .eq('pro_email', email)
        .maybeSingle();
      if (rErr || !rdv) return err('Rendez-vous introuvable.', 'NOT_FOUND');
      if (rdv.status === 'annule') return err('Ce rendez-vous est déjà annulé.', 'ALREADY_CANCELLED');
      const { error: uErr } = await supabase
        .from('Reservation')
        .update({ status: 'annule' })
        .eq('id', rdv.id);
      if (uErr) return err("L'annulation a échoué.", 'UPDATE_FAILED');
      return {
        status: 'success',
        booking_id: rdv.id,
        summary: `Rendez-vous du ${rdv.date} à ${rdv.time_slot} (${rdv.service_name || 'prestation'}) annulé.`,
      };
    } catch (e) {
      return err("L'annulation a échoué.", 'UPDATE_FAILED');
    }
  }

  async function execute(name, args) {
    const a = args && typeof args === 'object' ? args : {};
    switch (name) {
      case 'check_availability': return checkAvailability(a);
      case 'create_booking': return createBooking(a);
      case 'find_booking': return findBooking(a);
      case 'reschedule_booking': return rescheduleBooking(a);
      case 'cancel_booking': return cancelBooking(a);
      case 'end_call': return { status: 'success', action: 'hangup', reason: a.reason || '' };
      default: return err(`Outil inconnu : ${name}.`, 'UNKNOWN_TOOL');
    }
  }

  return { execute };
}

/**
 * Construit les outils vocaux pour un salon.
 * @param {Object} p
 * @param {string} p.proEmail
 * @returns {{ definitions: Array, execute: Function }}
 */
export function buildVoiceTools({ proEmail }) {
  const { execute } = buildExecutors(proEmail);
  return { definitions: DEFINITIONS, execute };
}

/**
 * Diagnostic d'accès aux données du salon — utilisé par le bouton
 * « Tester l'accès aux données » de la page Réceptionniste IA.
 * Exécute les VRAIES lectures Supabase (aucune écriture) et renvoie un
 * rapport honnête : { email, ok, checks: [{ label, ok, detail }] }.
 */
export async function testVoiceDataAccess(proEmail) {
  const email = normEmail(proEmail);
  const report = { email: email || '(vide — email du salon introuvable)', ok: true, checks: [] };
  const push = (label, ok, detail) => {
    report.checks.push({ label, ok: !!ok, detail: String(detail || '') });
    if (!ok) report.ok = false;
  };

  const { profil, error: profilErr } = await getProfil(email);
  push(
    'Profil du salon',
    !!profil,
    profilErr
      ? `lecture impossible : ${profilErr?.message || 'erreur réseau/accès'} — c'est exactement ce qui fait échouer l'agent de temps en temps`
      : (profil ? `trouvé : ${profil.salon_name || 'sans nom'}` : 'introuvable pour cet email')
  );

  let opening = null;
  try { opening = getEffectiveOpening(profil, null); } catch { opening = null; }
  push(
    'Horaires du salon',
    !!opening,
    opening
      ? 'horaires lus (base du calcul des créneaux)'
      : (profilErr
          ? 'non vérifiables — la lecture du profil a échoué (voir ci-dessus)'
          : 'aucun horaire configuré — les créneaux ne peuvent pas être calculés')
  );

  let services = [];
  let servicesErr = null;
  {
    const res = await qread(() =>
      supabase
        .from('Service')
        .select('id,title,name,price')
        .eq('pro_email', email)
        .limit(100)
    );
    services = res.data || [];
    servicesErr = res.error || null;
  }
  push(
    'Prestations',
    !servicesErr && services.length > 0,
    servicesErr
      ? `lecture impossible : ${servicesErr?.message || 'erreur réseau/accès'}`
      : `${services.length} prestation(s) dans le catalogue`
  );

  const bundles = await getBundles(email);
  push('Offres / packs (bundles)', true, `${bundles.length} bundle(s) actif(s)`);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const res = await findFreeSlots(email, dateStr, 60);
  push(
    `Créneaux libres demain (${dateStr})`,
    res.ok,
    res.ok
      ? (res.closed ? 'salon fermé ce jour-là' : `${res.slots.length} créneau(x) libre(s)${res.slots.length ? ` — ex : ${res.slots.slice(0, 3).join(', ')}` : ''}`)
      : `échec : ${res.reason === 'HORAIRES_NON_CONFIGURES' ? 'horaires non configurés' : res.reason}`
  );

  const bookings = await getBookings(email, dateStr);
  push(
    'Lecture du planning (réservations)',
    bookings !== null,
    bookings === null ? 'lecture impossible' : `${bookings.length} réservation(s) existante(s) demain`
  );

  return report;
}
