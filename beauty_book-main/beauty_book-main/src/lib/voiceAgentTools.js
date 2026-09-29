// ─── Outils de l'agent vocal (function calling temps réel) ─────────────────
// Exécutés CÔTÉ CLIENT quand l'agent vocal (mode direct) appelle un outil.
// Chaque outil lit/écrit les VRAIES données Supabase du salon :
//   - check_availability : créneaux libres calculés EXACTEMENT comme dans
//     l'application (durée du service + 15 min de nettoyage, sièges libres) ;
//   - get_team           : vraie équipe du salon (choix du professionnel) ;
//   - get_service_questions : questions de préparation du service (étape 2) ;
//   - get_additional_services : vrais services supplémentaires du salon ;
//   - create_booking     : crée la réservation dans `Reservation`
//     (statut confirme → section « Confirmés » de la Gestion agenda du pro,
//     majoration nuit +50 % si 21h→7h, services supplémentaires inclus) ;
//   - find_booking / reschedule_booking / cancel_booking : gestion des RDV ;
//   - end_call           : l'agent demande la fin de l'appel.
//
// Règle d'or : en cas d'échec, on renvoie { status: 'error', message } —
// JAMAIS un faux succès. L'agent dira alors honnêtement qu'il ne peut pas
// accéder au planning (cf. ses instructions).
import { supabase } from '@/api/supabaseClient';
import { getEffectiveOpening, applyNightMode, DAY_KEYS, timeToMin } from './hours';
import { generateBookingCode, generateClientCode } from './bookingCodes';
import { getQuestionnaireForService, detectCategory } from './questionnaires';
import { getEffectiveQuestions, normalizeQuestion, dominantCategory } from './serviceQuestions';

// ─── Règle professionnelle des créneaux (identique à l'application) ──────────
// Intervalle entre deux créneaux = durée du service + SLOT_BUFFER_MIN (15)
// minutes de nettoyage/transition. Un créneau n'est proposé que s'il reste
// au moins un siège libre (sièges occupés < seats_count du salon).
const SLOT_BUFFER_MIN = 15;

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

const MISSING_COL_RES = [
  /Could not find the '([^']+)' column/i, // PostgREST schema cache
  /column "([^"]+)" does not exist/i,     // Postgres direct
  /column ([a-zA-Z_][\w]*) does not exist/i,
];
function missingColumn(msg) {
  const m = String(msg || '');
  for (const re of MISSING_COL_RES) {
    const hit = re.exec(m);
    if (hit) return hit[1];
  }
  return null;
}

/**
 * Select tolérant : si PostgREST rejette la requête parce qu'une colonne
 * n'existe pas encore (migration non exécutée côté Supabase), la colonne
 * fautive est retirée et la requête est relancée. L'agent continue de
 * fonctionner avec les colonnes réellement disponibles — sans jamais
 * inventer de valeur pour une colonne absente (les valeurs par défaut
 * explicites sont appliquées par l'appelant).
 */
async function lenientSelect(table, columns, buildQuery) {
  let cols = [...columns];
  for (let i = 0; i <= columns.length; i++) {
    const { data, error } = await qread(() => buildQuery(supabase.from(table).select(cols.join(','))));
    if (!error) return { data, error: null };
    const col = missingColumn(error.message);
    if (!col || !cols.includes(col)) return { data: null, error };
    cols = cols.filter((c) => c !== col);
  }
  return { data: null, error: { message: 'Colonnes indisponibles.' } };
}

/**
 * Insert tolérant : même principe que lenientSelect. Si une colonne du
 * payload n'existe pas dans la table de production, elle est retirée et
 * l'insertion est relancée. La réservation est TOUJOURS créée avec les
 * colonnes réellement disponibles.
 */
async function lenientInsert(table, payload) {
  let rest = { ...payload };
  for (let i = 0; i < 15; i++) {
    const { data, error } = await supabase.from(table).insert(rest).select('id').maybeSingle();
    if (!error) return { data, kept: rest, error: null };
    const col = missingColumn(error.message);
    if (!col || !(col in rest)) return { data: null, kept: rest, error };
    delete rest[col];
  }
  return { data: null, kept: rest, error: { message: "Échec de la création de la réservation." } };
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
  // Lecture tolérante : seats_count, travail_nuit, se_deplace et produits
  // peuvent manquer si une migration n'a pas été exécutée — la requête est
  // relancée sans les colonnes fautives au lieu d'échouer en 400.
  // (Il n'y a pas de colonne `adresse` ni `telephone` sur cette table.)
  const { data, error } = await lenientSelect(
    'ProfilPro',
    ['salon_name', 'address', 'phone', 'ouverture', 'horaires', 'seats_count', 'travail_nuit', 'se_deplace', 'produits'],
    (q) => q.eq('user_email', normEmail(proEmail)).maybeSingle()
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
  let category = 'general';
  const ids = Array.isArray(b.service_ids) ? b.service_ids : [];
  if (ids.length > 0) {
    const { data: svcs, error } = await qread(() =>
      supabase
        .from('Service')
        .select('id,title,name,category,subcategory,duration,duration_min')
        .eq('pro_email', email)
        .in('id', ids)
    );
    if (!error && svcs && svcs.length > 0) {
      duration = svcs.reduce((sum, s) => sum + Number(s.duration || s.duration_min || 60), 0);
      try { category = dominantCategory(svcs); } catch { /* repli : nom du bundle */ }
    }
  }
  if (category === 'general') {
    try { category = detectCategory({ title: b.name, name: b.name }) || 'general'; } catch { /* ignore */ }
  }
  return {
    id: b.id,
    name: b.name || 'Offre pack',
    price: b.bundle_price != null ? Number(b.bundle_price) : null,
    duration,
    category,
    kind: 'bundle',
  };
}

/**
 * Ligne Service brute pour les questions de préparation (avec les questions
 * personnalisées du pro si la colonne `questions` existe — la migration
 * 20260928_add_service_questions.sql n'est pas forcément exécutée : on
 * réessaie sans la colonne en cas d'erreur 400, sans jamais échouer).
 */
async function getServiceRowForQuestions(email, { service_id, service_name }) {
  const run = (cols) => {
    let q = supabase.from('Service').select(cols).eq('pro_email', email);
    if (service_id) q = q.eq('id', service_id);
    else if (service_name) q = q.or(`title.ilike.%${service_name}%,name.ilike.%${service_name}%`);
    else return Promise.resolve({ data: null, error: new Error('no selector') });
    return q.limit(1).maybeSingle();
  };
  let res = await qread(() => run('id,title,name,category,subcategory,questions'));
  if (res.error) res = await qread(() => run('id,title,name,category,subcategory'));
  if (res.error) res = await qread(() => run('id,title,name,category')); // colonnes optionnelles absentes (migrations non exécutées)
  return res.data || null;
}

// ─── Horaires effectifs du salon (même fusion que l'application) ─────────────
// StepCalendar fusionne ouverture/horaires (+ variantes capitalisées) puis
// applique le mode nuit (09:00 → 07:00 le lendemain) sans détruire les
// horaires de jour stockés. L'agent vocal fait EXACTEMENT pareil.
function mergedOpening(profil) {
  let ouvRaw = profil?.ouverture;
  let horRaw = profil?.horaires;
  if (typeof ouvRaw === 'string') { try { ouvRaw = JSON.parse(ouvRaw); } catch { ouvRaw = null; } }
  if (typeof horRaw === 'string') { try { horRaw = JSON.parse(horRaw); } catch { horRaw = null; } }
  const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const merged = {};
  DAY_NAMES.forEach((dn) => {
    const cap = dn.charAt(0).toUpperCase() + dn.slice(1);
    merged[dn] =
      (ouvRaw && ouvRaw[dn]) || (horRaw && horRaw[dn]) ||
      (ouvRaw && ouvRaw[cap]) || (horRaw && horRaw[cap]) || null;
  });
  if (ouvRaw?.conges) merged.conges = ouvRaw.conges;
  else if (horRaw?.conges) merged.conges = horRaw.conges;
  const anyDay = DAY_NAMES.some((dn) => merged[dn] && typeof merged[dn] === 'object');
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

// Majoration nocturne : +50 % pour tout créneau entre 21h00 et 07h00
// (même règle que le parcours de réservation de l'application).
export function isNightTimeSlot(slot) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(slot || '').trim());
  if (!m) return false;
  const h = Number(m[1]);
  return h >= 21 || h < 7;
}
export function nightSurchargeFor(basePrice, slot) {
  if (!isNightTimeSlot(slot) || basePrice == null) return 0;
  return Math.round(Number(basePrice) * 0.5 * 100) / 100;
}

async function getBookings(proEmail, dateStr) {
  const { data, error } = await qread(() =>
    supabase
      .from('Reservation')
      .select('time_slot,duration_min,end_time_slot,persons,status')
      .eq('pro_email', normEmail(proEmail))
      .eq('date', dateStr)
  );
  if (error) return null; // erreur d'accès → l'appelant renverra une erreur honnête
  return (data || []).filter((r) => r.status !== 'annule');
}

/**
 * Calcule les créneaux libres pour une date et une durée de prestation —
 * avec la MÉTHODE EXACTE de l'application (StepCalendar) :
 *   - intervalle entre créneaux = durée du service + 15 min de nettoyage ;
 *   - pauses du jour exclues ; congés exclus ; créneaux passés exclus ;
 *   - mode nuit (21:00 → 07:00) quand le salon l'a activé ;
 *   - un créneau n'est libre que si sièges occupés < seats_count du salon
 *     (chevauchement calculé avec le buffer des deux côtés, en personnes).
 * Retourne { ok, slots: [{ time, seats_left }], closed } — jamais de créneaux inventés.
 */
async function findFreeSlots(proEmail, dateStr, durationMin) {
  const d = parseDate(dateStr);
  if (!d) return { ok: false, reason: 'INVALID_DATE' };
  // On distingue « erreur d'accès au profil » (réseau/RLS → réessayer plus
  // tard) de « horaires réellement non configurés » : les deux donnaient
  // avant le même message trompeur.
  const { profil, error: profilErr } = await getProfil(proEmail);
  if (profilErr) {
    return { ok: false, reason: 'IMPOSSIBLE_DE_LIRE_LE_PLANNING' };
  }
  const opening = mergedOpening(profil);
  if (!opening) {
    return { ok: false, reason: 'HORAIRES_NON_CONFIGURES' };
  }
  const dayKey = DAY_KEYS[(d.getDay() + 6) % 7];
  const day = opening[dayKey];
  if (!day || day.open !== true || !day.start || !day.end) {
    return { ok: true, slots: [], closed: true };
  }
  if (isInConges(d, opening)) {
    return { ok: true, slots: [], closed: true };
  }
  const duration = Math.max(5, Number(durationMin) || 60);
  const interval = duration + SLOT_BUFFER_MIN;
  const openMin = timeToMin(day.start);
  let closeMin = timeToMin(day.end);
  if (openMin == null || closeMin == null) {
    return { ok: false, reason: 'HORAIRES_NON_CONFIGURES' };
  }
  const overnightRange = closeMin <= openMin; // ex : 09:00 → 07:00 (mode nuit)
  const endCursor = overnightRange ? closeMin + 1440 : closeMin;
  const pauseS = day.pause_start ? timeToMin(day.pause_start) : null;
  const pauseE = day.pause_end ? timeToMin(day.pause_end) : null;

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const minSlotMin = isToday ? now.getHours() * 60 + now.getMinutes() + 15 : null; // marge 15 min

  const existing = await getBookings(proEmail, dateStr);
  if (existing === null) {
    return { ok: false, reason: 'IMPOSSIBLE_DE_LIRE_LE_PLANNING' };
  }
  const seatsTotal = Math.max(1, Number(profil?.seats_count) || 1);
  const busy = existing.map((r) => {
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
    // Pause du jour : le créneau [début, fin] ne doit pas la chevaucher
    if (pauseS != null && pauseE != null && timeToMin(slotStr) < pauseE && timeToMin(endStr) > pauseS) return;
    // Créneaux passés (le segment après minuit appartient au lendemain)
    if (minSlotMin !== null) {
      const past = cursor >= 1440
        ? (minSlotMin < 720 ? (cursor - 1440) < minSlotMin : false)
        : cursor < minSlotMin;
      if (past) return;
    }
    // Sièges occupés : toute réservation active dont la plage (+ buffer)
    // chevauche le créneau candidat (+ buffer), en nombre de personnes.
    // Segment nuit (>= 24h) : les réservations du petit matin sont décalées
    // de +1440 pour être comparées dans le même référentiel.
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

  // Plage nocturne supplémentaire si le mode nuit est actif mais que la
  // plage du jour ne couvre pas déjà la nuit (21:00 → 07:00 le lendemain).
  const travailNuit = !!(profil && profil.travail_nuit);
  if (travailNuit && !overnightRange) {
    const nightStart = 21 * 60;
    const nightEnd = 31 * 60;
    let nc = nightStart;
    while (nc + duration <= nightEnd) {
      pushIfFree(nc);
      nc += interval;
    }
  }

  return { ok: true, slots, closed: false, seats_total: seatsTotal };
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
    name: 'get_team',
    description:
      "Retourne la VRAIE équipe du salon (noms et rôles des collaborateurs). À appeler quand le client souhaite un(e) professionnel(le) précis(e). Ne propose JAMAIS un nom qui n'y figure pas.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'get_service_questions',
    description:
      "Retourne les questions de préparation du service choisi (les mêmes que dans l'application : d'abord celles personnalisées par le professionnel, sinon celles de la catégorie du service). À appeler UNIQUEMENT quand l'ÉTAPE 1 est complète (le client a répondu à la question des services supplémentaires), JAMAIS avant — ne jamais enchaîner cet appel juste après get_additional_services sans attendre la réponse du client.",
    parameters: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Identifiant de la prestation (si connu)' },
        service_name: { type: 'string', description: 'Nom de la prestation' },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'get_additional_services',
    description:
      "Retourne les VRAIS services supplémentaires du salon (options proposées par le professionnel : soins, massages, finitions… avec leurs prix réels). À appeler dès que le client a choisi sa prestation principale, pour lui proposer ces options AVANT le récapitulatif.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'get_products',
    description:
      "Retourne les VRAIS produits que le salon peut commander pour le client (ex : mèches, rajouts) avec leurs prix réels et leurs délais de livraison, tels que configurés par le professionnel. À appeler quand le client ne fournit pas lui-même ses mèches/produits, pour lui annoncer les prix et délais AVANT de valider.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'estimate_transport_fee',
    description:
      "Calcule les VRAIS frais de déplacement pour une prestation à domicile à partir de l'adresse du client (distance réelle depuis le salon × 0,50 €/km, minimum 3 € — même règle que l'application). À appeler uniquement si le salon fait du travail à domicile ET que le client choisit une prestation à domicile.",
    parameters: {
      type: 'object',
      properties: {
        client_address: { type: 'string', description: "Adresse complète du client (rue, code postal, ville)" },
      },
      required: ['client_address'],
    },
  },
  {
    type: 'function',
    name: 'create_booking',
    description:
      "Crée la réservation dans le planning du salon (prestation OU offre pack). Le rendez-vous apparaît dans la section « Confirmés » de la page Gestion agenda du professionnel.",
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
        questionnaire_answers: { type: 'string', description: 'Réponses du client aux questions de préparation, au format « question → réponse » séparées par « ; »' },
        payment_preference: { type: 'string', description: "Préférence de paiement exprimée par le client : 'onsite' (règlement au salon) ou 'card' (paiement par carte — le salon enverra un lien de paiement sécurisé)" },
        persons: { type: 'integer', description: 'Nombre de personnes pour ce rendez-vous (1 par défaut)' },
        collaborateur: { type: 'string', description: "Nom du/de la professionnel(le) choisi(e) par le client — doit figurer dans get_team, sinon laisser vide" },
        additional_service_names: {
          type: 'array',
          items: { type: 'string' },
          description: "Noms EXACTS des services supplémentaires acceptés par le client (tels que retournés par get_additional_services). Leurs prix réels sont repris du catalogue et ajoutés au total.",
        },
        product_name: { type: 'string', description: "Nom EXACT du produit commandé par le client (tel que retourné par get_products, ex : mèches). Son prix réel est ajouté au total et son délai de livraison est noté." },
        service_location: { type: 'string', description: "Lieu de la prestation : 'salon' (défaut) ou 'domicile' (uniquement si le salon fait du travail à domicile et que le client l'a choisi)" },
        transport_fee: { type: 'number', description: "Frais de déplacement calculés par estimate_transport_fee (uniquement pour une prestation à domicile)" },
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

  // ── Équipe réelle du salon (pour le choix du professionnel, étape 1) ─────
  async function getTeam() {
    try {
      const { data, error } = await qread(() =>
        supabase
          .from('MembreEquipe')
          .select('name,role,status')
          .eq('pro_email', email)
          .order('name', { ascending: true })
      );
      if (error) return err("Je n'arrive pas à lire l'équipe du salon pour le moment.", 'NO_ACCESS');
      const members = (data || [])
        .filter((m) => String(m?.name || '').trim())
        .filter((m) => {
          const st = String(m?.status || '').toLowerCase();
          return !st || st === 'actif' || st === 'active';
        })
        .map((m) => ({ name: String(m.name).trim(), role: String(m.role || '').trim() }));
      if (members.length === 0) {
        return { status: 'success', members: [], message: "Le salon n'a pas renseigné d'équipe : ne propose aucun nom de collaborateur, dis simplement que l'équipe s'occupera du client." };
      }
      return {
        status: 'success',
        members,
        hint: 'Propose UNIQUEMENT ces noms. Si le client cite un nom absent de cette liste, dis-le poliment et propose un membre de la liste.',
      };
    } catch {
      return err("Je n'arrive pas à lire l'équipe du salon pour le moment.", 'NO_ACCESS');
    }
  }

  // ── Questions de préparation du service (parcours de réservation vocal) ──
  // Mêmes questions que dans l'application (étape « Vos Préférences ») :
  // d'abord celles personnalisées par le pro, sinon celles de la catégorie.
  async function getServiceQuestions(args) {
    try {
      const presta = await resolvePrestation(email, { service_id: args.service_id, service_name: args.service_name });
      const askedService = String(args.service_id || args.service_name || '').trim();
      if (askedService && !presta) {
        return err(
          `La prestation « ${askedService} » est introuvable dans le catalogue du salon.`,
          'SERVICE_NOT_FOUND'
        );
      }
      const row = presta && presta.kind === 'bundle'
        ? null // bundle : catégorie dominante déjà calculée dans resolvePrestation
        : await getServiceRowForQuestions(email, {
            service_id: presta ? presta.id : null,
            service_name: presta ? presta.name : askedService,
          });
      let custom = [];
      try { custom = getEffectiveQuestions(row || {}); } catch { custom = []; }
      const like = row || {
        title: presta?.name || askedService,
        name: presta?.name || askedService,
        category: presta?.category || undefined, // bundle : catégorie dominante des prestations incluses
      };
      const questions = (custom.length > 0 ? custom : getQuestionnaireForService(like).questions || [])
        .map((q, i) => normalizeQuestion(q, i))
        .filter((q) => String(q.question || '').trim());
      // À l'oral on limite aux plus pertinentes (l'agent les pose naturellement,
      // une à la fois, sans lire les listes de choix de façon exhaustive).
      const picked = questions.slice(0, 6).map((q) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.type === 'qcm' ? q.options.slice(0, 5) : [],
      }));
      return {
        status: 'success',
        service: presta?.name || askedService,
        questions: picked,
        hint: "Pose ces questions naturellement à l'oral, une à la fois, les plus pertinentes d'abord (allergies, sensibilités, état). Transmets les réponses à create_booking via questionnaire_answers.",
      };
    } catch (e) {
      return err("Je n'arrive pas à charger les questions de préparation pour le moment.", 'NO_ACCESS');
    }
  }

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
      const price = presta?.price != null ? Number(presta.price) : null;
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
      // Règle tarifaire : créneau de nuit (21h00 → 07h00) = +50 % de majoration.
      const withNight = res.slots.slice(0, 8).map((s) => ({
        time: s.time,
        seats_left: s.seats_left,
        night: isNightTimeSlot(s.time),
        night_surcharge: nightSurchargeFor(price, s.time),
        total_with_night: price != null ? Math.round((price + nightSurchargeFor(price, s.time)) * 100) / 100 : null,
      }));
      return {
        status: 'success',
        available: res.slots.length > 0,
        date: dateStr,
        service: serviceName,
        duration_min: duration,
        price: price,
        currency: '€',
        night_rule: 'Majoration nocturne de +50 % pour tout créneau entre 21h00 et 07h00 — à annoncer systématiquement au client.',
        free_slots: withNight,
        hint: "Ces créneaux sont calculés comme dans l'application (durée du service + 15 min de nettoyage, sièges réellement libres) : propose uniquement ceux-ci, 2 ou 3 maximum à la fois. Quand le client choisit sa prestation, annonce TOUJOURS son prix et sa durée.",
      };
    } catch (e) {
      return err("Je n'arrive pas à accéder au planning pour le moment. Propose de prendre un message.", 'NO_ACCESS');
    }
  }

  // ── Services supplémentaires du salon (options du pro, prix réels) ────────
  async function getAdditionalServices() {
    try {
      const { data, error } = await qread(() =>
        supabase
          .from('CatalogueOption')
          .select('name,price,category,usage_count')
          .eq('pro_email', email)
          .order('usage_count', { ascending: false })
          .limit(30)
      );
      if (error) return err("Je n'arrive pas à lire les services supplémentaires pour le moment.", 'NO_ACCESS');
      const list = (data || [])
        .filter((o) => String(o?.name || '').trim())
        .map((o) => ({ name: String(o.name).trim(), price: o.price != null ? Number(o.price) : null }));
      if (list.length === 0) {
        return { status: 'success', services: [], message: "Le salon n'a renseigné aucun service supplémentaire : ne propose aucune option." };
      }
      return {
        status: 'success',
        services: list,
        hint: "Propose naturellement 1 à 3 de ces options après le choix de la prestation principale (« Souhaitez-vous ajouter… ? »), avec leurs VRAIS prix. Ne les impose pas, ne les invente pas. Transmets les noms EXACTS acceptés à create_booking via additional_service_names.",
      };
    } catch {
      return err("Je n'arrive pas à lire les services supplémentaires pour le moment.", 'NO_ACCESS');
    }
  }

  /**
   * VRAIS produits du salon (configurés par le professionnel dans
   * « Modifier mon profil » → Produits) : nom, prix réel, délai de
   * livraison. Utilisés pour la question « apportez-vous vos mèches ou
   * souhaitez-vous les commander ? ». Jamais inventés.
   */
  async function getProducts() {
    try {
      const { data, error } = await lenientSelect(
        'ProfilPro',
        ['produits'],
        (q) => q.eq('user_email', email).maybeSingle()
      );
      if (error) return err("Je n'arrive pas à lire les produits du salon pour le moment.", 'NO_ACCESS');
      const raw = data?.produits;
      const arr = Array.isArray(raw) ? raw : [];
      const list = arr
        .filter((p) => p && String(p.name || '').trim())
        .map((p) => ({
          name: String(p.name).trim(),
          price: p.price != null && p.price !== '' ? Number(p.price) : null,
          delivery_delay: String(p.delivery_delay || p.delai || '').trim() || null,
        }));
      if (list.length === 0) {
        return { status: 'success', products: [], message: "Le salon n'a renseigné aucun produit à commander : si le client ne fournit pas ses mèches, propose-lui d'en parler directement avec le salon." };
      }
      return {
        status: 'success',
        products: list,
        hint: "Annonce ces VRAIS produits avec leurs prix et délais de livraison (« Nous pouvons commander … à X €, délai … »). Ne propose que ceux-ci, n'invente ni prix ni délai. Transmets le nom EXACT choisi à create_booking via product_name.",
      };
    } catch {
      return err("Je n'arrive pas à lire les produits du salon pour le moment.", 'NO_ACCESS');
    }
  }

  /**
   * VRAIS frais de déplacement pour une prestation à domicile : distance
   * réelle salon → adresse du client (géocodage api-adresse.data.gouv.fr,
   * haversine) × 0,50 €/km, minimum 3 € — EXACTEMENT la même règle que le
   * parcours de réservation de l'application (StepConfirmation).
   */
  async function estimateTransportFee(args) {
    try {
      const clientAddress = String(args.client_address || '').trim();
      if (!clientAddress) return err("J'ai besoin de l'adresse complète du client pour calculer les frais de déplacement.", 'MISSING_ADDRESS');
      const { profil } = await getProfil(email);
      const salonAddress = [profil?.address, profil?.postal_code, profil?.city].filter(Boolean).join(', ');
      if (!salonAddress) return err("Je n'ai pas l'adresse du salon pour calculer le déplacement.", 'NO_SALON_ADDRESS');
      const geocode = async (address) => {
        const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`);
        if (!r.ok) throw new Error('geocoding indisponible');
        const d = await r.json();
        const c = d.features?.[0]?.geometry?.coordinates || [];
        return c.length === 2 ? { lat: c[1], lng: c[0] } : null;
      };
      const [origin, dest] = await Promise.all([geocode(salonAddress), geocode(clientAddress)]);
      if (!origin || !dest) {
        return err("Je n'arrive pas à localiser l'une des adresses : annonce au client qu'un forfait déplacement minimum de 3 € s'appliquera, calculé précisément par le salon.", 'GEOCODE_FAILED');
      }
      const R = 6371;
      const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
      const dLng = ((dest.lng - origin.lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((origin.lat * Math.PI) / 180) * Math.cos((dest.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance_km = Math.round(dist * 10) / 10;
      const fee = Math.max(3, Math.round(dist * 0.5 * 100) / 100);
      return {
        status: 'success',
        distance_km,
        transport_fee: fee,
        message: `Déplacement à domicile : ${distance_km} km depuis le salon, soit ${fee} € de frais de transport (0,50 €/km, minimum 3 €). Annonce ce montant au client AVANT de valider, et transmets-le à create_booking via transport_fee avec service_location='domicile'.`,
      };
    } catch {
      return err("Je n'arrive pas à calculer les frais de déplacement : annonce au client qu'un forfait déplacement minimum de 3 € s'appliquera.", 'TRANSPORT_FAILED');
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
      const slotInfo = check.slots.find((s) => s.time === slot);
      if (!slotInfo) {
        return {
          status: 'error',
          code: 'SLOT_TAKEN',
          message: `Le créneau ${slot} n'est plus disponible. Propose au client : ${check.slots.slice(0, 3).map((s) => s.time).join(', ') || 'aucun autre créneau ce jour-là'}.`,
          alternatives: check.slots.slice(0, 3).map((s) => s.time),
        };
      }

      const { profil } = await getProfil(email);
      const booking_code = generateBookingCode();
      const crg_code = generateClientCode();
      const [hh, mm] = slot.split(':').map(Number);
      const endMin = hh * 60 + mm + duration;

      // ── Services supplémentaires acceptés : prix repris du catalogue ──────
      // (jamais ceux dictés par l'agent — on ne fait confiance qu'au salon).
      const wantedAddons = Array.isArray(args.additional_service_names)
        ? args.additional_service_names.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
        : [];
      let addons = [];
      let addonsTotal = 0;
      if (wantedAddons.length > 0) {
        const { data: cat } = await qread(() =>
          supabase.from('CatalogueOption').select('name,price').eq('pro_email', email).limit(100)
        );
        const byName = new Map((cat || []).map((o) => [String(o.name || '').trim().toLowerCase(), o]));
        for (const w of wantedAddons) {
          const o = byName.get(w);
          if (o) {
            const p = o.price != null ? Number(o.price) : 0;
            addons.push({ name: String(o.name).trim(), price: p });
            addonsTotal += p;
          }
        }
      }

      // ── Questionnaire vocal + préférence de paiement (parcours vocal) ──
      // Rien n'est débité par l'agent vocal : payment_status reste 'non_paye',
      // la préférence exprimée par le client est simplement notée pour le salon.
      const qaText = String(args.questionnaire_answers || '').trim();
      const payPref = String(args.payment_preference || '').trim().toLowerCase();
      const payLabel = payPref === 'card'
        ? 'par carte (le salon enverra un lien de paiement sécurisé au client)'
        : 'au salon';
      const persons = Math.max(1, Math.min(20, parseInt(args.persons, 10) || 1));
      const collaborateur = String(args.collaborateur || '').trim() || null;

      // ── Tarification : base × personnes + majoration nuit (+50 % si 21h→7h)
      // + services supplémentaires + produit commandé + frais de déplacement.
      // Même règle que le parcours de l'application.
      const baseTotal = price != null ? price * persons : null;
      const nightSurcharge = nightSurchargeFor(baseTotal, slot);
      // ── Produit commandé (ex : mèches) : prix réel du catalogue du salon ─
      let productInfo = null;
      const wantedProduct = String(args.product_name || '').trim().toLowerCase();
      if (wantedProduct) {
        const { data: pdata } = await lenientSelect('ProfilPro', ['produits'], (q) => q.eq('user_email', email).maybeSingle());
        const plist = Array.isArray(pdata?.produits) ? pdata.produits : [];
        const found = plist.find((p) => String(p?.name || '').trim().toLowerCase() === wantedProduct);
        if (found) {
          const pp = found.price != null && found.price !== '' ? Number(found.price) : 0;
          productInfo = { name: String(found.name).trim(), price: pp, delivery_delay: String(found.delivery_delay || found.delai || '').trim() || null };
        }
      }
      const productTotal = productInfo ? productInfo.price : 0;
      // ── Prestation à domicile : frais de transport réels ─────────────────
      const isHomeService = String(args.service_location || '').trim().toLowerCase() === 'domicile';
      const transportFee = isHomeService ? (Number(args.transport_fee) || 0) : 0;
      const totalPrice = baseTotal != null
        ? Math.round((baseTotal + nightSurcharge + addonsTotal + productTotal + transportFee) * 100) / 100
        : null;

      const notesParts = [];
      if (qaText) notesParts.push(`[Questionnaire vocal] ${qaText}`);
      notesParts.push(`[Paiement] préférence du client : ${payLabel}`);
      if (persons > 1) notesParts.push(`[Personnes] ${persons}`);
      if (addons.length > 0) notesParts.push(`[Services supplémentaires] ${addons.map((a) => `${a.name} (${a.price}€)`).join(' ; ')}`);
      if (productInfo) notesParts.push(`[Produit commandé] ${productInfo.name} (${productInfo.price}€)${productInfo.delivery_delay ? ` — délai de livraison : ${productInfo.delivery_delay}` : ''}`);
      if (isHomeService) notesParts.push(`[Prestation à domicile] frais de déplacement : ${transportFee}€`);
      if (nightSurcharge > 0) notesParts.push(`[Majoration nuit +50%] ${nightSurcharge}€`);
      const extraNotes = String(args.notes || '').trim();
      if (extraNotes) notesParts.push(extraNotes);

      const payload = {
        pro_email: email,
        client_name: clientName,
        client_phone: String(args.client_phone || '').trim(),
        client_email: String(args.client_email || '').trim(),
        service_id: presta?.id || args.service_id || null,
        service_name: serviceName,
        service_price: price,
        total_price: totalPrice,
        night_surcharge: nightSurcharge,
        persons,
        collaborateur,
        date: dateStr,
        time_slot: slot,
        duration_min: duration,
        end_time_slot: fmtSlot(endMin),
        status: 'confirme',
        source: 'agent_vocal',
        salon_name: profil?.salon_name || '',
        salon_address: profil?.address || profil?.adresse || '',
        payment_status: 'non_paye',
        notes: notesParts.join('\n'),
        booking_code,
        crg_code,
        service_location: isHomeService ? 'domicile' : 'salon',
        transport_fee: transportFee,
      };
      // ── Insertion tolérante : si une colonne n'existe pas encore en
      // production (migration non exécutée), elle est retirée et l'insertion
      // est relancée — la réservation est TOUJOURS créée avec les colonnes
      // réellement disponibles. La majoration nuit reste notée dans les notes.
      let insertRes = await lenientInsert('Reservation', payload);
      if (insertRes.data && !insertRes.kept.collaborateur && collaborateur) {
        // La colonne `collaborateur` a dû être retirée : le professionnel
        // souhaité est conservé dans les notes du RDV.
        try {
          await supabase.from('Reservation').update({ notes: `${payload.notes}\n[Professionnel souhaité] ${collaborateur}` }).eq('id', insertRes.data.id);
        } catch { /* non bloquant */ }
      }
      const { data, error } = insertRes;
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
        service_price: price,
        duration_min: duration,
        persons,
        collaborateur,
        additional_services: addons,
        product: productInfo,
        night_surcharge: nightSurcharge,
        service_location: isHomeService ? 'domicile' : 'salon',
        transport_fee: transportFee,
        total_price: totalPrice,
        client_name: clientName,
        payment_preference: payPref === 'card' ? 'card' : 'onsite',
        announce:
          `Annonce au client : « ${serviceName}, ${price != null ? `${price} €` : 'tarif sur demande'} pour ${duration} minutes »` +
          (addons.length > 0 ? `, plus ${addons.map((a) => `${a.name} ${a.price} €`).join(', ')}` : '') +
          (productInfo ? `, plus ${productInfo.name} ${productInfo.price} €${productInfo.delivery_delay ? ` (livraison : ${productInfo.delivery_delay})` : ''}` : '') +
          (transportFee > 0 ? `, plus ${transportFee} € de frais de déplacement à domicile` : '') +
          (nightSurcharge > 0 ? ` — créneau de nuit : majoration de 50 % soit +${nightSurcharge} €, total ${totalPrice} €` : (totalPrice != null ? `, total ${totalPrice} €` : '')) +
          `.`,
        dictate_to_client:
          `Réservation enregistrée avec succès. COMMUNIQUE au client son ID de réservation en l'épelant lettre par lettre : ${booking_code}. ` +
          `Dis-lui qu'il pourra le saisir dans l'application BeautyBook, rubrique Rendez-vous → « Ajouter un ID de réservation », pour retrouver son rendez-vous. ` +
          (payPref === 'card'
            ? 'Rappelle-lui que le salon lui enverra un lien de paiement sécurisé par carte.'
            : 'Rappelle-lui que le règlement se fera au salon.'),
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
      if (check.closed || !check.slots.some((s) => s.time === slot)) {
        return {
          status: 'error',
          code: 'SLOT_TAKEN',
          message: `Le créneau ${slot} le ${dateStr} n'est pas disponible. Alternatives : ${check.slots.slice(0, 3).map((s) => s.time).join(', ') || 'aucune'}.`,
          alternatives: check.slots.slice(0, 3).map((s) => s.time),
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
      case 'get_team': return getTeam(a);
      case 'get_service_questions': return getServiceQuestions(a);
      case 'get_additional_services': return getAdditionalServices(a);
      case 'get_products': return getProducts();
      case 'estimate_transport_fee': return estimateTransportFee(a);
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

  let team = [];
  let teamErr = null;
  {
    const res = await qread(() =>
      supabase.from('MembreEquipe').select('id,name,role').eq('pro_email', email).limit(50)
    );
    team = res.data || [];
    teamErr = res.error || null;
  }
  push(
    'Équipe du salon (choix du professionnel)',
    !teamErr,
    teamErr
      ? `lecture impossible : ${teamErr?.message || 'erreur réseau/accès'}`
      : (team.length > 0
          ? `${team.length} membre(s) : ${team.slice(0, 5).map((m) => m.name).join(', ')}${team.length > 5 ? '…' : ''}`
          : "aucun membre renseigné — l'agent ne proposera aucun nom")
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const res = await findFreeSlots(email, dateStr, 60);
  push(
    `Créneaux libres demain (${dateStr})`,
    res.ok,
    res.ok
      ? (res.closed ? 'salon fermé ce jour-là' : `${res.slots.length} créneau(x) libre(s)${res.slots.length ? ` — ex : ${res.slots.slice(0, 3).map((s) => s.time).join(', ')}` : ''} (${res.seats_total || 1} siège(s) par créneau)`)
      : `échec : ${res.reason === 'HORAIRES_NON_CONFIGURES' ? 'horaires non configurés' : res.reason}`
  );

  const bookings = await getBookings(email, dateStr);
  push(
    'Lecture du planning (réservations)',
    bookings !== null,
    bookings === null ? 'lecture impossible' : `${bookings.length} réservation(s) existante(s) demain`
  );

  // Questions de préparation (parcours vocal) sur la 1re prestation.
  if (!servicesErr && services.length > 0) {
    try {
      const row = await getServiceRowForQuestions(email, { service_id: services[0].id });
      let custom = [];
      try { custom = getEffectiveQuestions(row || {}); } catch { custom = []; }
      const like = row || { title: services[0].title || services[0].name };
      const qs = (custom.length > 0 ? custom : getQuestionnaireForService(like).questions || [])
        .map((q, i) => normalizeQuestion(q, i))
        .filter((q) => String(q.question || '').trim());
      push(
        'Questions de préparation (parcours vocal)',
        qs.length > 0,
        qs.length > 0
          ? `${qs.length} question(s) pour « ${services[0].title || services[0].name} »${custom.length > 0 ? ' (personnalisées du pro)' : ' (catégorie)'}`
          : `aucune question détectée pour « ${services[0].title || services[0].name} » — l'agent posera quand même les infos de base`
      );
    } catch {
      push('Questions de préparation (parcours vocal)', false, 'lecture impossible');
    }
  }

  return report;
}
