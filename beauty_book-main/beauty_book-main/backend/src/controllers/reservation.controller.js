import { supabaseAdmin } from '../config/supabase.js';

function timeToMin(t) {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(t, mins) {
  const total = timeToMin(t) + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(startA, endA, startB, endB) {
  return timeToMin(startA) < timeToMin(endB) && timeToMin(endA) > timeToMin(startB);
}

function isWithinOpeningHours(date, timeSlot, ouverture) {
  if (!ouverture || Object.keys(ouverture).length === 0) return true;
  const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const dow = new Date(date).getDay();
  const dayKey = days[dow];
  const d = ouverture[dayKey];
  if (!d || !d.open) return false;
  const slotMin = timeToMin(timeSlot);
  const startMin = timeToMin(d.start || "00:00");
  const endMin = timeToMin(d.end || "23:59");
  return slotMin >= startMin && slotMin < endMin;
}

function isDuringBreak(timeSlot, pauses) {
  if (!pauses || pauses.length === 0) return false;
  const slotMin = timeToMin(timeSlot);
  return pauses.some(p => {
    const pStart = timeToMin(p.start || "00:00");
    const pEnd = timeToMin(p.end || "00:00");
    return slotMin >= pStart && slotMin < pEnd;
  });
}

function generateICS({ summary, description, location, dtStart, dtEnd, uid }) {
  const fmt = (d) => d.replace(/[-:]/g, "").replace("T", "T").slice(0,15) + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BeautyBook//FR",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `DTSTART:${fmt(dtStart)}`,
    `DTEND:${fmt(dtEnd)}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel: votre RDV BeautyBook demain",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel: votre RDV BeautyBook dans 2 heures",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

export const createReservation = async (req, res) => {
  try {
    const user = req.user;
    
    // Fetch full profile of the user to get full_name
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const {
      pro_email, pro_name, service_name, service_id, service_price,
      date, time_slot, duration_min, addons, total_price, notes, custom_answers = {}, custom_answer_labels = {},
      salon_name, salon_address, persons = 1,
      service_location = "salon", client_address, client_postal_code, client_city,
      client_latitude, client_longitude, transport_fee = 0, transport_distance_km = 0,
      payment_type = "full", // "full" | "acompte"
      crg_code
    } = req.body;

    if (!pro_email || !service_name || !date || !time_slot) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const dur = duration_min || 60;
    const endSlot = addMinutes(time_slot, dur);

    // Fetch pro profile
    const { data: profilResults, error: profilError } = await supabaseAdmin
      .from('ProfilPro') // Assuming table name is ProfilPro
      .select('*')
      .eq('user_email', pro_email)
      .order('created_at', { ascending: false })
      .limit(1);

    const profil = profilResults?.[0];
    const seatsTotal = profil?.seats_count || 1;
    const ouverture = profil?.ouverture || {};
    const pauses = profil?.pauses || [];

    if (!isWithinOpeningHours(date, time_slot, ouverture)) {
      return res.status(409).json({ error: "Ce créneau est en dehors des horaires d'ouverture du professionnel." });
    }

    if (isDuringBreak(time_slot, pauses)) {
      return res.status(409).json({ error: "Ce créneau est pendant une pause du professionnel." });
    }

    // Check active overlapping reservations
    const { data: existingRes } = await supabaseAdmin
      .from('Reservation') // Assuming table name is Reservation
      .select('*')
      .eq('pro_email', pro_email)
      .eq('date', date)
      .in('status', ['en_attente', 'confirme']);

    const seatsOccupied = (existingRes || [])
      .filter(r => overlaps(time_slot, endSlot, r.time_slot, r.end_time_slot || addMinutes(r.time_slot, r.duration_min || 60)))
      .reduce((sum, r) => sum + (r.persons || 1), 0);

    const seatsAvailable = seatsTotal - seatsOccupied;
    if (persons > seatsAvailable) {
      return res.status(409).json({
        error: `Plus assez de sièges disponibles. Disponible: ${seatsAvailable}, demandé: ${persons}`,
        seats_available: seatsAvailable,
        seats_total: seatsTotal,
      });
    }

    const acompteAmount = payment_type === "acompte" ? Math.round(total_price * 0.3 * 100) / 100 : 0;
    const paymentStatus = payment_type === "acompte" ? "acompte_paye" : "paye";
    const reservationStatus = "en_attente";

    // Create reservation
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('Reservation')
      .insert({
        client_email: user.email,
        pro_email,
        pro_name,
        service_name,
        service_price,
        date,
        time: time_slot,
        end_time_slot: endSlot,
        duration_min: dur,
        persons,
        total_price,
        service_location,
         client_name: userProfile?.full_name || user.user_metadata?.full_name || "",
        client_address,
        client_postal_code,
        client_city,
        client_latitude,
        client_longitude,
        transport_fee,
        transport_distance_km,
        salon_name,
        salon_address,
         notes: typeof notes === "string" ? notes.slice(0, 4000) : "",
         custom_answers,
         custom_answer_labels,
        seats_total: seatsTotal,
        status: reservationStatus,
      })
      .select()
      .single();

    if (reservationError) {
      console.error(reservationError);
      return res.status(500).json({ error: "Erreur lors de la création de la réservation" });
    }

    // Generate ICS
    const dateTimeStart = `${date}T${time_slot}:00`;
    const dateTimeEnd = `${date}T${endSlot}:00`;
    const icsContent = generateICS({
      summary: `💆 ${service_name} – BeautyBook`,
      description: `Prestataire: ${salon_name || pro_name}\\nAdresse: ${salon_address || ""}\\nDurée: ${dur} min`,
      location: salon_address || salon_name || "",
      dtStart: dateTimeStart,
      dtEnd: dateTimeEnd,
      uid: `beautybook-${reservation.id}`,
    });
    const icsBase64 = Buffer.from(unescape(encodeURIComponent(icsContent))).toString('base64');

    // Google Calendar Link
    const gcalParams = new URLSearchParams({
      action: "TEMPLATE",
      text: `💆 ${service_name} – BeautyBook`,
      dates: (() => {
        const pad = (n) => String(n).padStart(2, "0");
        const [y, mo, d] = date.split("-").map(Number);
        const [sh, sm] = time_slot.split(":").map(Number);
        const endTotalMin = sh * 60 + sm + dur;
        const eh = Math.floor(endTotalMin / 60) % 24;
        const em = endTotalMin % 60;
        const fmt = (yy, mm, dd, hh, min) => `${yy}${pad(mm)}${pad(dd)}T${pad(hh)}${pad(min)}00`;
        return `${fmt(y, mo, d, sh, sm)}/${fmt(y, mo, d, eh, em)}`;
      })(),
      details: `Prestataire: ${salon_name || pro_name}\nCode de validation: ${crg_code || "—"}`,
      location: salon_address || salon_name || "",
    });
    const gcalLink = `https://calendar.google.com/calendar/render?${gcalParams.toString()}`;

    // Create notifications
    await supabaseAdmin.from('Notification').insert([
      {
        user_email: user.email,
        type: "reservation",
        title: "✅ Réservation confirmée !",
        body: `Merci ${userProfile?.full_name?.split(" ")[0] || ""} ! Votre rendez-vous pour "${service_name}" est confirmé le ${date} à ${time_slot}. À très bientôt ! 🌟`,
        link: "/rendez-vous",
        read: false,
        data: { reservation_id: reservation.id, ics_base64: icsBase64, gcal_link: gcalLink },
      },
      {
        user_email: pro_email,
        type: "reservation",
        title: "📅 Nouvelle réservation",
        body: `${userProfile?.full_name || user.email} a réservé : ${service_name} le ${date} à ${time_slot} (${persons} pers.)`,
        link: "/pro/gestion-agenda",
        read: false,
      }
    ]);

    return res.status(201).json({
      reservation,
      ics_base64: icsBase64,
      success: true,
      seats_available: seatsAvailable - persons,
    });
  } catch (error) {
    console.error("❌ createReservation error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
