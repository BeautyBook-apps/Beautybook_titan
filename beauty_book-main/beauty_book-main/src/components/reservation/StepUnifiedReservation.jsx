import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Calendar as CalendarIcon, Clock, User, Check, ChevronRight, ChevronLeft, Sun, Cloud, Moon, Users, Minus, Plus, Package, Sparkles, Tag, Ban } from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay, isSameMonth, isBefore, startOfDay, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { entities } from "@/api/entities";
import { applyNightMode } from "@/lib/hours";

const CLEANING_MINUTES = 15;

const DAY_MAP = { 0: "dimanche", 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi" };
const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "19:00";

function parseTime(str) {
  if (!str || typeof str !== "string") return null;
  const [h, m] = str.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function formatMinutes(mins) {
  // Plages de nuit : les minutes >= 24h s'affichent modulo 24 (ex : 25:00 → "01:00")
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Parse horaires/ouverture from proProfile — supports both structures
function getHoraires(proProfile) {
  const raw = proProfile?.ouverture || proProfile?.horaires;
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

// Get schedule for a specific day (full French name)
// Applique le Mode Nuit : si travail_nuit est actif, les jours ouverts
// passent en 09:00 → 07:00 (lendemain) via la surcouche applyNightMode.
function getDaySchedule(proProfile, dayOfWeek) {
  const dayName = DAY_MAP[dayOfWeek];
  const horaires = applyNightMode(getHoraires(proProfile), !!proProfile?.travail_nuit);
  if (!horaires) {
    // No horaires set → default: open Mon-Sat, closed Sunday
    // (plage de nuit si le Mode Nuit est actif)
    if (dayOfWeek === 0) return null;
    return proProfile?.travail_nuit
      ? { open: true, start: "09:00", end: "07:00", pause_start: "", pause_end: "" }
      : { open: true, start: DEFAULT_OPEN, end: DEFAULT_CLOSE, pause_start: "", pause_end: "" };
  }
  const day = horaires[dayName];
  if (!day) {
    // Day not in horaires → treat as closed
    return null;
  }
  // day.open can be boolean or "ferme" string
  const isOpen = day.open === true || day.open === "true" || day.open === 1;
  if (!isOpen) return null;
  return {
    open: true,
    start: day.start || day.ouverture || DEFAULT_OPEN,
    end: day.end || day.fermeture || DEFAULT_CLOSE,
    pause_start: day.pause_start || "",
    pause_end: day.pause_end || "",
  };
}

// Get conges array from proProfile (stored in multiple places)
function getConges(proProfile) {
  const horaires = getHoraires(proProfile);
  const fromHoraires = horaires?.conges;
  const fromProfile = proProfile?.conges;
  const arr = fromProfile || fromHoraires || [];
  return Array.isArray(arr) ? arr : [];
}

// Check if a date falls within any congé range
function isDateInConges(date, conges) {
  const ts = date.getTime();
  return conges.some(c => {
    if (!c?.start || !c?.end) return false;
    const startTs = new Date(c.start + "T00:00:00").getTime();
    const endTs = new Date(c.end + "T23:59:59").getTime();
    return ts >= startTs && ts <= endTs;
  });
}

// Check if a time slot overlaps with a pause
function isInPause(slotStartMin, durationMin, pauseStart, pauseEnd) {
  const pStart = parseTime(pauseStart);
  const pEnd = parseTime(pauseEnd);
  if (pStart == null || pEnd == null || pStart >= pEnd) return false;
  const slotEnd = slotStartMin + durationMin;
  return slotStartMin < pEnd && slotEnd > pStart;
}

// Generate time slots Planity-style: step = service duration + cleaning, with seat count
// Gère les plages de nuit (fin <= début → se termine le lendemain) : les minutes
// brutes sont conservées dans `mins` pour le tri et le filtre des créneaux passés.
function generateTimeSlots(schedule, durationMin, numSeats) {
  const openMin = parseTime(schedule.start);
  let closeMin = parseTime(schedule.end);
  if (openMin == null || closeMin == null) return [];
  if (closeMin <= openMin) closeMin += 24 * 60; // plage nocturne → lendemain
  const slots = [];
  const step = durationMin; // step includes service + cleaning
  for (let t = openMin; t + durationMin <= closeMin; t += step) {
    if (isInPause(t, durationMin, schedule.pause_start, schedule.pause_end)) continue;
    slots.push({ time: formatMinutes(t), seats: numSeats, mins: t });
  }
  return slots;
}

// Get real seat count from pro profile
function getSeatCount(proProfile) {
  return proProfile?.seats_count || proProfile?.nb_chaises || 1;
}

export default function StepUnifiedReservation({
  booking,
  proProfile,
  onUpdateBooking,
  onNext,
  onBack
}) {
  const isBundle = !!booking.bundle;
  const primaryService = booking.services?.[0] || {};
  const proEmail = primaryService.pro_email || booking.salon?.pro_email;

  const [selectedDate, setSelectedDate] = useState(booking.date || addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState(booking.time || null);
  const [selectedExpert, setSelectedExpert] = useState(booking.expert || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [persons, setPersons] = useState(booking.services?.[0]?.persons || 1);

  // Fetch team members
  useEffect(() => {
    if (!proEmail) return;
    setLoadingTeam(true);
    entities.MembreEquipe.filter({ pro_email: proEmail }, "-created_at", 50)
      .then(res => { setTeamMembers(res || []); setLoadingTeam(false); })
      .catch(() => setLoadingTeam(false));
  }, [proEmail]);

  // ── Duration ──
  const totalServiceMin = booking.services.reduce((sum, s) => sum + (parseInt(s.duration_min || s.duration) || 60), 0);
  const totalDurationWithCleaning = totalServiceMin + CLEANING_MINUTES;

  // ── Congés ──
  const conges = useMemo(() => getConges(proProfile), [proProfile]);

  // ── Calendar ──
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const isDateDisabled = (day) => isBefore(day, startOfDay(new Date()));

  const isDateClosed = (day) => {
    if (isDateDisabled(day)) return true;
    if (isDateInConges(day, conges)) return true;
    const schedule = getDaySchedule(proProfile, day.getDay());
    return !schedule;
  };

  // ── Time slots for selected date ──
  const numSeats = getSeatCount(proProfile);
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const schedule = getDaySchedule(proProfile, selectedDate.getDay());
    if (!schedule) return [];
    const slots = generateTimeSlots(schedule, totalDurationWithCleaning, numSeats);
    // Filter past time slots if selected date is today.
    // On compare les minutes brutes (mins) : les créneaux après minuit
    // (nuit, mins >= 24h) sont toujours à venir.
    const now = new Date();
    const isToday = isSameDay(selectedDate, now);
    if (!isToday) return slots;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return slots.filter(s => (s.mins ?? parseTime(s.time)) > nowMinutes);
  }, [selectedDate, proProfile, totalDurationWithCleaning, numSeats]);

  const morningSlots = availableTimeSlots.filter(s => (s.mins ?? parseTime(s.time)) < 12 * 60);
  const afternoonSlots = availableTimeSlots.filter(s => {
    const m = s.mins ?? parseTime(s.time);
    return m >= 12 * 60 && m < 21 * 60;
  });
  const nightSlots = availableTimeSlots.filter(s => (s.mins ?? parseTime(s.time)) >= 21 * 60);
  const morningAvailable = morningSlots.length;
  const afternoonAvailable = afternoonSlots.length;
  const nightAvailable = nightSlots.length;

  // ── Prices ──
  const bundlePrice = isBundle ? (booking.bundle?.bundle_price || 0) : 0;
  const bundlePP = isBundle ? (booking.bundle?.bundle_price_per_person || 0) : 0;
  const isGroupBundle = isBundle && booking.bundle?.is_group;
  const minPersons = isGroupBundle ? (booking.bundle?.min_persons || 1) : 1;
  const maxPersons = isGroupBundle ? (booking.bundle?.max_persons || 10) : 1;

  const totalAmount = isBundle
    ? (isGroupBundle ? bundlePP * persons : bundlePrice)
    : booking.services.reduce((sum, s) => sum + (parseFloat(s.price) || 0) * persons, 0);

  const handleValidateStep = () => {
    if (!selectedDate || !selectedTime) return;
    const updatedServices = booking.services.map(s => ({ ...s, persons }));
    onUpdateBooking({
      date: selectedDate,
      time: selectedTime,
      expert: selectedExpert || null,
      services: updatedServices,
      persons,
    });
    onNext();
  };

  const selectedSchedule = selectedDate ? getDaySchedule(proProfile, selectedDate.getDay()) : null;

  return (
    <div className="min-h-screen bg-[#FFF5F0] font-display" style={{ paddingBottom: "calc(220px + env(safe-area-inset-bottom, 16px))" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl px-5 pt-12 pb-4 flex items-center justify-between border-b border-gray-100 shadow-sm">
        <button onClick={onBack} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-[#E8732A] uppercase tracking-widest">Étape 1 sur 3</p>
          <p className="text-[17px] font-black text-gray-900">Date, Horaire & Professionnel</p>
        </div>
        <div className="w-9" />
      </div>

      <div className="px-5 pt-5 space-y-5">

        {/* ── SERVICE / BUNDLE SUMMARY ── */}
        {isBundle ? (
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shrink-0 border border-purple-200">
                <Package className="w-7 h-7 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-black text-gray-900 truncate">{booking.bundle?.name || "Bundle"}</p>
                  {booking.bundle?.discount_percent > 0 && (
                    <span className="shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full">
                      -{booking.bundle.discount_percent}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                  {booking.services.length} prestations • {totalServiceMin} min
                </p>
              </div>
              <span className="text-[18px] font-black text-[#E8732A] shrink-0">
                {isGroupBundle ? `${bundlePP}€/pers` : `${bundlePrice}€`}
              </span>
            </div>
            <div className="bg-purple-50/60 rounded-2xl p-3 space-y-1.5 border border-purple-100/60">
              {booking.services.map((svc, i) => (
                <div key={svc.id || i} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-200 text-purple-700 text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</div>
                  <span className="text-[12px] font-bold text-gray-700 flex-1 truncate">{svc.title || svc.name}</span>
                  <span className="text-[11px] font-bold text-gray-400">{svc.duration_min || svc.duration || "—"} min</span>
                </div>
              ))}
              {booking.bundle?.bonus && (
                <div className="flex items-center gap-2 pt-1 border-t border-purple-100">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="text-[11px] font-bold text-purple-600">{booking.bundle.bonus}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center shrink-0 border border-orange-200">
              <Sparkles className="w-7 h-7 text-[#E8732A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-black text-gray-900 truncate">{primaryService.title || primaryService.name || "Réservation"}</p>
              <div className="flex items-center gap-2 mt-1 text-[12px] text-gray-400 font-medium">
                <span>{totalServiceMin} min</span>
                <span>•</span>
                <span className="font-black text-gray-900">{primaryService.price}€</span>
              </div>
            </div>
          </div>
        )}

        {/* ── PERSONS SELECTOR ── */}
        {isBundle && isGroupBundle ? (
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-gray-900">Nombre de personnes</p>
                  <p className="text-[11px] text-gray-400 font-medium">{minPersons} à {maxPersons} personnes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setPersons(p => Math.max(minPersons, p - 1))} disabled={persons <= minPersons} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
                  <Minus className="w-4 h-4 text-gray-700" />
                </button>
                <span className="text-[20px] font-black text-gray-900 w-8 text-center">{persons}</span>
                <button onClick={() => setPersons(p => Math.min(maxPersons, p + 1))} disabled={persons >= maxPersons} className="w-9 h-9 rounded-full bg-[#E8732A] flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2">
              <Tag className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[11px] font-bold text-purple-600">{bundlePP}€ × {persons} pers. = {bundlePP * persons}€</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#E8732A]" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-gray-900">Nombre de personnes</p>
                  <p className="text-[11px] text-gray-400 font-medium">Maximum 6 personnes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setPersons(p => Math.max(1, p - 1))} disabled={persons <= 1} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
                  <Minus className="w-4 h-4 text-gray-700" />
                </button>
                <span className="text-[20px] font-black text-gray-900 w-8 text-center">{persons}</span>
                <button onClick={() => setPersons(p => Math.min(6, p + 1))} disabled={persons >= 6} className="w-9 h-9 rounded-full bg-[#E8732A] flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CALENDAR (Planity Style) ── */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h3 className="text-[17px] font-black text-gray-900 capitalize">{format(currentMonth, "MMMM yyyy", { locale: fr })}</h3>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          <div className="grid grid-cols-7">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(d => (
              <div key={d} className="text-center text-[11px] font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const inMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDate);
              const disabled = !inMonth || isDateDisabled(day);
              const closed = !disabled && isDateClosed(day);
              const isToday = isSameDay(day, new Date());

              if (!inMonth) return <div key={i} />;

              return (
                <button
                  key={i}
                  onClick={() => !disabled && !closed && setSelectedDate(day)}
                  disabled={disabled || closed}
                  className="flex flex-col items-center justify-center py-1.5"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isSelected ? "bg-[#E8732A] shadow-lg" :
                    disabled || closed ? "text-gray-300" :
                    "text-gray-900 hover:bg-orange-50"
                  }`}>
                    <span className={`text-[15px] font-bold ${
                      isSelected ? "text-white" :
                      isToday ? "text-[#E8732A] font-black" : ""
                    }`}>{format(day, "d")}</span>
                  </div>
                  {/* Dot: orange=available, gray=closed/congé */}
                  {!disabled && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      closed ? "bg-gray-300" : "bg-[#E8732A]"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-5 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#E8732A]" />
              <span className="text-[10px] font-bold text-gray-400">Disponible</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-[10px] font-bold text-gray-400">Fermé / Congés</span>
            </div>
          </div>
        </div>

        {/* ── TIME SLOTS ── */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Clock className="w-5 h-5 text-[#E8732A]" />
            <div>
              <p className="text-[14px] font-black text-[#E8732A] capitalize">
                {selectedDate ? format(selectedDate, "EEEE d MMMM", { locale: fr }) : "..."}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">
                {selectedSchedule
                  ? `${selectedSchedule.start} → ${selectedSchedule.end}${selectedSchedule.pause_start ? ` • Pause ${selectedSchedule.pause_start}-${selectedSchedule.pause_end}` : ""}`
                  : "Jour fermé"}
              </p>
            </div>
          </div>

          {availableTimeSlots.length === 0 ? (
            <div className="text-center py-8">
              <Ban className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-[14px] font-black text-gray-400">
                {isDateInConges(selectedDate || new Date(), conges) ? "Salon en congés" : "Aucun créneau disponible"}
              </p>
              <p className="text-[11px] text-gray-300 font-medium mt-1">
                {isDateInConges(selectedDate || new Date(), conges) ? "Choisissez une autre date" : "Essayez un autre jour"}
              </p>
            </div>
          ) : (
            <>
              {/* Matinée */}
              {morningSlots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span className="text-[14px] font-black text-gray-800">Matinée</span>
                    </div>
                    <span className="text-[11px] font-black text-[#E8732A] uppercase tracking-wider">{morningAvailable} DISPO</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {morningSlots.map(({ time, seats }) => {
                      const isSelected = selectedTime === time;
                      const isEmpty = seats === 0;
                      return (
                        <button
                          key={time}
                          onClick={() => !isEmpty && setSelectedTime(time)}
                          disabled={isEmpty}
                          className={`px-4 py-3 rounded-2xl border-2 flex flex-col items-center min-w-[72px] transition-all active:scale-95 ${
                            isSelected ? "border-[#E8732A] bg-[#E8732A] shadow-lg" :
                            isEmpty ? "border-gray-100 bg-gray-50 opacity-30 cursor-not-allowed" :
                            "border-gray-100 bg-white"
                          }`}
                        >
                          <span className={`text-[15px] font-black ${isSelected ? "text-white" : "text-gray-900"}`}>{time}</span>
                          <span className={`text-[10px] font-bold ${isSelected ? "text-white/80" : "text-[#E8732A]"}`}>
                            {isEmpty ? "Complet" : `${seats} sièges`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Après-midi */}
              {afternoonSlots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-orange-300" />
                      <span className="text-[14px] font-black text-gray-800">Après-midi</span>
                    </div>
                    <span className="text-[11px] font-black text-[#E8732A] uppercase tracking-wider">{afternoonAvailable} DISPO</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {afternoonSlots.map(({ time, seats }) => {
                      const isSelected = selectedTime === time;
                      const isEmpty = seats === 0;
                      return (
                        <button
                          key={time}
                          onClick={() => !isEmpty && setSelectedTime(time)}
                          disabled={isEmpty}
                          className={`px-4 py-3 rounded-2xl border-2 flex flex-col items-center min-w-[72px] transition-all active:scale-95 ${
                            isSelected ? "border-[#E8732A] bg-[#E8732A] shadow-lg" :
                            isEmpty ? "border-gray-100 bg-gray-50 opacity-30 cursor-not-allowed" :
                            "border-gray-100 bg-white"
                          }`}
                        >
                          <span className={`text-[15px] font-black ${isSelected ? "text-white" : "text-gray-900"}`}>{time}</span>
                          <span className={`text-[10px] font-bold ${isSelected ? "text-white/80" : "text-[#E8732A]"}`}>
                            {isEmpty ? "Complet" : `${seats} sièges`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nuit (Mode Nuit : 21h00 → 07h00 le lendemain) */}
              {nightSlots.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span className="text-[14px] font-black text-gray-800">Nuit</span>
                    </div>
                    <span className="text-[11px] font-black text-[#E8732A] uppercase tracking-wider">{nightAvailable} DISPO</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nightSlots.map(({ time, seats }) => {
                      const isSelected = selectedTime === time;
                      const isEmpty = seats === 0;
                      return (
                        <button
                          key={time}
                          onClick={() => !isEmpty && setSelectedTime(time)}
                          disabled={isEmpty}
                          className={`px-4 py-3 rounded-2xl border-2 flex flex-col items-center min-w-[72px] transition-all active:scale-95 ${
                            isSelected ? "border-[#E8732A] bg-[#E8732A] shadow-lg" :
                            isEmpty ? "border-gray-100 bg-gray-50 opacity-30 cursor-not-allowed" :
                            "border-gray-100 bg-white"
                          }`}
                        >
                          <span className={`text-[15px] font-black ${isSelected ? "text-white" : "text-gray-900"}`}>{time}</span>
                          <span className={`text-[10px] font-bold ${isSelected ? "text-white/80" : "text-[#E8732A]"}`}>
                            {isEmpty ? "Complet" : `${seats} sièges`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── PROFESSIONAL / TEAM SELECTOR ── */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#E8732A]" />
            <h3 className="text-[16px] font-black text-gray-900">Choix du Professionnel</h3>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedExpert(null)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                selectedExpert === null ? "border-[#E8732A] bg-orange-50/60 shadow-sm" : "border-gray-100 bg-white"
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#E8732A] to-[#E84466] text-white font-black flex items-center justify-center text-sm shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900">N'importe quel pro disponible</p>
                <p className="text-[11px] text-gray-400 font-medium">Premier créneau libre trouvé</p>
              </div>
              {selectedExpert === null && <Check className="w-5 h-5 text-[#E8732A] shrink-0" />}
            </button>

            {loadingTeam && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-[#E8732A] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {teamMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedExpert(member)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                  selectedExpert?.id === member.id ? "border-[#E8732A] bg-orange-50/60 shadow-sm" : "border-gray-100 bg-white"
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-orange-100 text-[#E8732A] font-black flex items-center justify-center text-sm shrink-0 overflow-hidden">
                  {member.membre_avatar ? (
                    <BeautyImage src={member.membre_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (member.membre_name || member.name || "M")[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black text-gray-900">{member.membre_name || member.name}</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">
                    {member.specialites || member.specialties || member.role || "Membre de l'équipe"}
                  </p>
                </div>
                {selectedExpert?.id === member.id && <Check className="w-5 h-5 text-[#E8732A] shrink-0" />}
              </button>
            ))}

            {!loadingTeam && teamMembers.length === 0 && (
              <div className="text-center py-4 text-[13px] text-gray-400 font-medium">Aucun membre d'équipe disponible</div>
            )}
          </div>
        </div>

      </div>

      {/* ── FIXED BOTTOM ── */}
      {/* Barre de validation : toujours entièrement visible au-dessus de la barre d'onglets */}
      <div className="fixed left-0 right-0 z-[90]" style={{ bottom: "calc(68px + env(safe-area-inset-bottom, 16px))" }}>
        {selectedDate && selectedTime && (
          <div className="mx-4 mb-2 bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-md flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-black text-gray-900 truncate">
                {format(selectedDate, "EEEE d MMMM", { locale: fr })} • {selectedTime}
              </p>
              <p className="text-[10px] text-gray-400 font-medium truncate">
                {isBundle ? booking.bundle?.name : (primaryService.title || primaryService.name)}
                {persons > 1 ? ` • ${persons} pers.` : ""}
              </p>
            </div>
            <span className="text-[14px] font-black text-[#E8732A] shrink-0">{totalAmount}€</span>
          </div>
        )}
        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <button
            onClick={handleValidateStep}
            disabled={!selectedDate || !selectedTime}
            className="w-full py-4 rounded-2xl font-black text-[15px] uppercase tracking-widest text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: selectedDate && selectedTime ? "linear-gradient(135deg, #E8732A, #E84466)" : "#ccc", boxShadow: selectedDate && selectedTime ? "0 8px 25px rgba(232,115,42,0.35)" : "none" }}
          >
            Continuer <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
