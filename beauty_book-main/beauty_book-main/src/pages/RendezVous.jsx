import { useState, useEffect, useRef } from "react";
import { Calendar, Clock, MapPin, CheckCircle2, Plus, Star, ChevronLeft, ChevronRight, Scissors, LayoutGrid, X, Hash, Phone, User, CreditCard, MessageSquare, AlertTriangle, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { entities } from '@/api/entities';
import {apiClient} from '@/lib/apiClient';
import { supabase } from '@/api/supabaseClient';
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import PostServiceReview from "@/components/reservation/PostServiceReview";
import AddBookingIdModal from "@/components/booking/AddBookingIdModal";
import RoutineModal from "@/components/routine/RoutineModal";
import RoutineDashboard from "@/components/routine/RoutineDashboard";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import AuthModal from "@/components/ui/AuthModal";

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const formatLongDate = (dateStr) => {
  if (!dateStr) return "";
  try { return format(parseISO(dateStr), "EEEE d MMMM yyyy", { locale: fr }); }
  catch { return dateStr; }
};

function groupReservationsByDate(reservations) {
  const groups = {};
  const sorted = [...reservations].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  sorted.forEach(r => {
    const key = r.date || "sans-date";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  return Object.entries(groups).map(([date, rdvs]) => ({ date, rdvs }));
}

const MAIN_TABS = ["À venir", "Passés", "Annulés", "Calendrier"];

// Convertit une réservation BDD en event calendrier
function reservationToEvent(r) {
  return {
    id: r.id,
    service: r.service_name,
    salon: r.salon_name || r.pro_name || "",
    date: r.date,
    time: r.time || r.time_slot,
    location: r.salon_address || "",
    status: r.status === "confirme" ? "confirmed" : r.status === "annule" ? "cancelled" : r.status === "termine" ? "done" : "pending",
    type: "rdv",
    dateObj: new Date(r.date),
    pro_email: r.pro_email,
    pro_name: r.pro_name,
    service_name: r.service_name,
    raw: r,
  };
}

function routineToEvents(routine) {
  // Génère les dates de la routine pour le mois courant et les 2 prochains mois
  const events = [];
  const today = new Date();
  const startDate = routine.objectif_debut ? new Date(routine.objectif_debut) : new Date(routine.created_date || today);
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + 2);

  const colorMap = {
    "bg-blue-100": { color: "bg-blue-100", textColor: "text-blue-700" },
    "bg-pink-100": { color: "bg-pink-100", textColor: "text-pink-700" },
    "bg-purple-100": { color: "bg-purple-100", textColor: "text-purple-700" },
    "bg-green-100": { color: "bg-green-100", textColor: "text-green-700" },
    "bg-orange-100": { color: "bg-orange-100", textColor: "text-orange-700" },
    "bg-yellow-100": { color: "bg-yellow-100", textColor: "text-yellow-700" },
  };
  const colorInfo = colorMap[routine.color] || { color: "bg-blue-100", textColor: "text-blue-700" };

  // Calculer les jours de la semaine selon frequency
  let targetDays = []; // 0=dim, 1=lun, ..., 6=sam
  if (routine.frequency === "quotidien") {
    targetDays = [0, 1, 2, 3, 4, 5, 6];
  } else if (routine.days_of_week?.length > 0) {
    targetDays = routine.days_of_week;
  } else {
    targetDays = [1]; // lundi par défaut
  }

  const cur = new Date(Math.max(startDate, new Date(today.getFullYear(), today.getMonth() - 1, 1)));
  while (cur <= endDate) {
    if (targetDays.includes(cur.getDay())) {
      const dateStr = cur.toISOString().slice(0, 10);
      events.push({
        id: `routine-${routine.id}-${dateStr}`,
        service: routine.name,
        date: dateStr,
        time: routine.time || "",
        dateObj: new Date(cur),
        type: "routine",
        icon: routine.emoji || "✨",
        detail: `${routine.duration_min || 20} min`,
        ...colorInfo,
        raw: routine,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return events;
}

function CalendarView({ reservations, onEventClick }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [routines, setRoutines] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data?.user).then(user => {
      if (!user) return;
      entities.RoutineBeaute.filter({ user_email: user.email, status: "active" }, "-created_at", 50)
        .then(setRoutines).catch(() => {});
    }).catch(() => {});
  }, []);

  const rdvEvents = reservations.filter(r => r.status !== "annule").map(reservationToEvent);
  const routineEvents = routines.flatMap(routineToEvents);
  const allEvents = [...rdvEvents, ...routineEvents];

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const getEventsForDay = (day) => {
    const d = new Date(currentYear, currentMonth, day);
    return allEvents.filter(e =>
      e.dateObj.getFullYear() === d.getFullYear() &&
      e.dateObj.getMonth() === d.getMonth() &&
      e.dateObj.getDate() === d.getDate()
    );
  };

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const isToday = (day) => {
    const d = new Date(currentYear, currentMonth, day);
    return d.toDateString() === today.toDateString();
  };

  return (
    <div className="px-4 space-y-4">
      {/* Month Navigator */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <button onClick={prevMonth} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="text-[16px] font-black text-gray-900">{MONTHS_FR[currentMonth]} {currentYear}</h2>
          <button onClick={nextMonth} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 px-3 pb-1">
          {DAYS_FR.map(d => (
            <div key={d} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-wider py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0 px-3 pb-4">
          {/* Empty cells for first day */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const events = getEventsForDay(day);
            const hasRdv = events.some(e => e.type === "rdv");
            const hasRoutine = events.some(e => e.type === "routine");
            const isSelected = selectedDate === day;
            const todayDay = isToday(day);

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : day)}
                className={`relative flex flex-col items-center justify-center rounded-2xl py-2 mx-0.5 mb-1 transition-all active:scale-95 ${
                  isSelected ? "bg-primary" :
                  todayDay ? "bg-primary/10" : ""
                }`}
              >
                <span className={`text-[13px] font-black ${isSelected ? "text-white" : todayDay ? "text-primary" : "text-gray-700"}`}>{day}</span>
                {(hasRdv || hasRoutine) && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasRdv && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />}
                    {hasRoutine && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-blue-400"}`} />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 pb-4 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-[10px] font-bold text-gray-500">Rendez-vous</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-[10px] font-bold text-gray-500">Routine</span>
          </div>
        </div>
      </div>

      {/* Events for selected day */}
      {selectedDate && (
        <div className="space-y-3">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">
            {selectedEvents.length === 0 ? "Aucun événement" : `${selectedEvents.length} événement${selectedEvents.length > 1 ? "s" : ""} — ${selectedDate} ${MONTHS_FR[currentMonth]}`}
          </p>
          {selectedEvents.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
              <p className="text-[13px] text-gray-400 font-medium">Journée libre 🌸</p>
              <Link to="/services" className="mt-3 inline-block bg-primary text-white text-[11px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl shadow-md shadow-primary/30">
                Réserver
              </Link>
            </div>
          ) : (
            selectedEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={onEventClick} />
            ))
          )}
        </div>
      )}

      {/* Upcoming events */}
      {!selectedDate && (
        <div className="space-y-3">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Prochains rendez-vous</p>
          {allEvents.filter(e => e.dateObj >= today).length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
              <p className="text-[13px] text-gray-400 font-medium">Aucun RDV à venir 🌸</p>
              <p className="text-[11px] text-gray-400 font-medium mt-1">Réservé par téléphone ? Utilisez votre ID de réservation.</p>
              <button onClick={() => setShowAddBooking(true)} className="mt-3 inline-block bg-primary text-white text-[11px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl shadow-md shadow-primary/30 active:scale-95 transition-all">Ajouter un ID de réservation</button>
            </div>
          ) : (
            allEvents
              .filter(e => e.dateObj >= today)
              .sort((a, b) => a.dateObj - b.dateObj)
              .slice(0, 5)
              .map(ev => <EventCard key={ev.id} event={ev} onClick={onEventClick} />)
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, onClick }) {
  const dateObj = new Date(event.date);
  const dayName = DAYS_FR[dateObj.getDay()];
  const dayNum = dateObj.getDate();
  const monthShort = MONTHS_FR[dateObj.getMonth()].slice(0, 3);

  if (event.type === "routine") {
    return (
      <button onClick={() => onClick?.(event)} className={`bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 overflow-hidden w-full text-left active:scale-[0.98] transition-all`}>
        <div className={`w-16 shrink-0 ${event.color} flex flex-col items-center justify-center py-4`}>
          <span className="text-2xl">{event.icon}</span>
          <span className="text-[9px] font-black text-gray-500 uppercase mt-1">{dayName}</span>
          <span className="text-[14px] font-black text-gray-800">{dayNum}</span>
        </div>
        <div className="flex-1 py-3 pr-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${event.color} ${event.textColor}`}>ROUTINE</span>
          </div>
          <p className="text-[14px] font-black text-gray-900">{event.service}</p>
          <p className="text-[11px] font-medium text-gray-400 mt-0.5">{event.detail}</p>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-gray-300" />
            <span className="text-[11px] font-bold text-gray-400">{event.time}</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button onClick={() => onClick?.(event)} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 overflow-hidden w-full text-left active:scale-[0.98] transition-all">
      <div className="w-16 shrink-0 bg-primary/10 flex flex-col items-center justify-center py-4">
        <span className="text-[9px] font-black text-primary uppercase">{dayName}</span>
        <span className="text-[20px] font-black text-primary">{dayNum}</span>
        <span className="text-[9px] font-bold text-primary/70">{monthShort}</span>
      </div>
      <div className="flex-1 py-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Scissors className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">RDV</span>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${event.status === "confirmed" ? "bg-green-50 text-green-600" : event.status === "done" ? "bg-gray-100 text-gray-500" : "bg-orange-50 text-orange-500"}`}>
            {event.status === "confirmed" ? "Confirmé" : event.status === "done" ? "Terminé" : "En attente"}
          </span>
        </div>
        <p className="text-[14px] font-black text-gray-900">{event.service}</p>
        <p className="text-[11px] font-bold text-gray-400">{event.salon}</p>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-300" />
            <span className="text-[11px] font-bold text-gray-500">{event.time}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-300" />
            <span className="text-[11px] font-bold text-gray-400">{event.location}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function RendezVous() {
  const [activeTab, setActiveTab] = useState(0);
  const [reviewModal, setReviewModal] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const { user } = useAuth();
  // Affichage direct depuis le cache : les RDV s'affichent immédiatement,
  // le rafraîchissement réseau se fait en arrière-plan sans vider l'affichage.
  const cacheKey = user?.email ? `rdv_${user.email}` : null;
  const [reservations, setReservations] = useCachedState(cacheKey, [], c => c?.reservations || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.reservations?.length);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showRoutineDashboard, setShowRoutineDashboard] = useState(false);
  const [calendarSuggestion, setCalendarSuggestion] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(null);
  const { showAuthModal, authMessage, requireAuth, closeAuthModal } = useAuthGate();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        requireAuth("Connectez-vous pour accéder à vos rendez-vous.");
      }
    }).catch(() => requireAuth("Connectez-vous pour accéder à vos rendez-vous."));
  }, []);

  const handleCancelReservation = async (rdv) => {
    setCancelling(true);
    try {
      const rdvDate = new Date(`${rdv.date}T${rdv.time || rdv.time_slot || "00:00"}`);
      const now = new Date();
      const hoursUntil = (rdvDate - now) / (1000 * 60 * 60);
      const isFullRefund = hoursUntil >= 24;
      const refundAmount = isFullRefund ? rdv.total_price : Math.round((rdv.total_price || 0) * 0.5 * 100) / 100;

      const result = await apiClient.put("/api/reservations/"+rdv.id,{status:"annule"}).catch(() => null);
      if (!result?.reservation) {
        // Repli : le backend local n'est pas déployé → mise à jour directe Supabase
        const { error } = await supabase.from("Reservation").update({ status: "annule" }).eq("id", rdv.id);
        if (error) throw new Error("Annulation non confirmée.");
      }
      setReservations(prev => prev.map(r => r.id === rdv.id ? { ...r, status: "annule" } : r));
      setSelectedReservation(null);
      setShowCancelConfirm(null);
    } catch (e) { console.error("Cancel error:", e); }
    setCancelling(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("payment") === "success") {
      setPaymentSuccess(false); // A redirect alone never proves payment.
      // Nettoyer l'URL sans rechargement
      window.history.replaceState({}, "", "/rendez-vous");
      setTimeout(() => setPaymentSuccess(false), 6000);
    }
  }, [location.search]);

  const loadReservations = () => {
    supabase.auth.getUser().then(({ data }) => data?.user).then(user => {
      if (!user) { setLoading(false); return; }
      Promise.all([
        entities.Reservation.filter({ client_email: user.email }, "-date", 100).catch(() => []),
        entities.Avis.filter({ auteur_email: user.email, type: "client_to_pro" }, "-created_at", 200).catch(() => []),
      ]).then(([resData, avisData]) => {
        const reviewedIds = new Set(avisData.map(a => a.reservation_id).filter(Boolean));
        const enriched = resData.map(r => ({ ...r, review_done: reviewedIds.has(r.id) || !!r.review_done }));
        setReservations(enriched);
        mergePageCache(cacheKey, { reservations: enriched });
        const seenCalendars = JSON.parse(localStorage.getItem("bb_calendars_seen") || "[]");
        const pendingCalendar = enriched.find(r => r.status === "confirme" && !seenCalendars.includes(r.id));
        if (pendingCalendar) {
          setTimeout(() => setCalendarSuggestion(pendingCalendar), 800);
          localStorage.setItem("bb_calendars_seen", JSON.stringify([...seenCalendars, pendingCalendar.id]));
        }
        // Auto-open pourboire for termine reservations not yet reviewed
        const unreviewedTermine = enriched.find(r => r.status === "termine" && !reviewedIds.has(r.id));
        if (unreviewedTermine) {
          setTimeout(() => setReviewModal(unreviewedTermine), 1000);
        }
      }).catch(() => {}).finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadReservations();
  }, []);

  // ── Real-time: auto-open PostServiceReview when pro validates code ──
  const prevStatusRef = useRef({});
  const userEmailRef = useRef(null);
  useEffect(() => {
    // Snapshot current statuses so we only trigger on actual transitions
    reservations.forEach(r => { prevStatusRef.current[r.id] = r.status; });
  }, [reservations]);
  useEffect(() => {
    let channel;
    let pollInterval;
    const checkForModals = async (email) => {
      try {
        const { data: fresh } = await supabase
          .from("Reservation").select("*")
          .eq("client_email", email)
          .order("date", { ascending: false }).limit(100);
        if (!fresh) return;
        setReservations(prev => {
          let changed = false;
          const next = prev.map(r => {
            const freshR = fresh.find(f => f.id === r.id);
            if (freshR && freshR.status !== r.status) {
              changed = true;
              const prevSt = prevStatusRef.current[r.id] || r.status;
              prevStatusRef.current[r.id] = freshR.status;
              if (freshR.status === "confirme" && prevSt !== "confirme") {
                setTimeout(() => setCalendarSuggestion(freshR), 300);
              }
              if (freshR.status === "termine" && prevSt !== "termine") {
                setTimeout(() => {
                  entities.Avis.filter({ reservation_id: freshR.id, auteur_email: email }, "-created_at", 1).then(avis => {
                    if (!avis || avis.length === 0) {
                      setReviewModal(freshR);
                    }
                  }).catch(() => setReviewModal(freshR));
                }, 300);
              }
              return { ...r, ...freshR };
            }
            return r;
          });
          fresh.forEach(f => {
            if (!next.some(r => r.id === f.id)) {
              next.unshift(f);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      } catch {}
    };
    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;
      userEmailRef.current = user.email;
      // Initialiser prevStatusRef avec les statuts actuels AVANT de s'abonner au real-time
      const { data: currentRdvs } = await supabase
        .from("Reservation").select("id, status")
        .eq("client_email", user.email);
      if (currentRdvs) {
        currentRdvs.forEach(r => { prevStatusRef.current[r.id] = r.status; });
      }
      // Channel real-time
      channel = supabase
        .channel("reservation-status-" + user.email)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "Reservation",
          filter: `client_email=eq.${user.email}`,
        }, (payload) => {
          const newRdv = payload.new;
          const prevStatus = prevStatusRef.current[newRdv.id];
          prevStatusRef.current[newRdv.id] = newRdv.status;
          setReservations(prev => prev.map(r => r.id === newRdv.id ? { ...r, ...newRdv } : r));
          if (newRdv.status === "termine" && prevStatus !== "termine") {
            // Only open pourboire if no avis exists yet for this reservation
            entities.Avis.filter({ reservation_id: newRdv.id, auteur_email: newRdv.client_email }, "-created_at", 1).then(avis => {
              if (!avis || avis.length === 0) {
                setReviewModal(newRdv);
              }
            }).catch(() => setReviewModal(newRdv));
          }
          if (newRdv.status === "confirme" && prevStatus !== "confirme") {
            setCalendarSuggestion(newRdv);
          }
        })
        .subscribe();
      // Polling fallback toutes les 8s
      pollInterval = setInterval(() => checkForModals(user.email), 8000);
    };
    setup();
    // Re-check quand l'utilisateur revient sur la page
    const onVisible = () => {
      if (document.visibilityState === "visible" && userEmailRef.current) {
        checkForModals(userEmailRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = reservations.filter(r => r.date >= today && ["confirme", "en_attente"].includes(r.status));
  const past = reservations.filter(r => r.status === "termine" || r.date < today);
  const cancelled = reservations.filter(r => r.status === "annule");

  return (
    <div className="font-display pb-4">
      <AuthModal open={showAuthModal} onClose={closeAuthModal} message={authMessage} />

      {/* Bannière de succès paiement */}
      {paymentSuccess && (
        <div className="mx-5 mt-4 bg-green-500 text-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-lg shadow-green-500/30">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div>
            <p className="text-[14px] font-black">Paiement réussi ! 🎉</p>
            <p className="text-[11px] text-white/80 font-medium">Votre réservation est confirmée. Vous recevrez un email de confirmation.</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {showRoutineModal && (
        <RoutineModal onClose={() => setShowRoutineModal(false)} onCreated={() => setShowRoutineModal(false)} />
      )}
      {showRoutineDashboard && (
        <RoutineDashboard onClose={() => setShowRoutineDashboard(false)} />
      )}

      {/* Menu ajout */}
      {showAddMenu && (
        <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setShowAddMenu(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full rounded-t-3xl px-5 pt-4 z-10" onClick={e => e.stopPropagation()} style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))" }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-[18px] font-black text-gray-900 mb-1">Ajouter</h3>
            <p className="text-[13px] text-gray-400 font-medium mb-5">Que souhaitez-vous créer ?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowAddMenu(false); navigate("/services"); }}
                className="flex flex-col items-center gap-3 py-6 bg-orange-50 border-2 border-primary rounded-3xl active:scale-95 transition-all"
              >
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
                  <Scissors className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-black text-primary">Réservation</p>
                  <p className="text-[11px] text-gray-400 font-medium">Prenez un RDV</p>
                </div>
              </button>
              <button
                onClick={() => { setShowAddMenu(false); setShowRoutineModal(true); }}
                className="flex flex-col items-center gap-3 py-6 bg-blue-50 border-2 border-blue-400 rounded-3xl active:scale-95 transition-all"
              >
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <span className="text-[24px]">✨</span>
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-black text-blue-600">Routine</p>
                  <p className="text-[11px] text-gray-400 font-medium">Créez une routine</p>
                </div>
              </button>
            </div>
            <button onClick={() => setShowAddMenu(false)} className="w-full text-center text-[11px] font-black text-gray-400 mt-2 uppercase tracking-widest">Annuler</button>
          </div>
        </div>
      )}

      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-gray-900">Rendez-vous</h1>
          <p className="text-[13px] font-medium text-gray-400 mt-0.5">Gérez vos soins & routines</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tableau de bord routines */}
          <button
            data-tour="rdv-routines"
            onClick={() => setShowRoutineDashboard(true)}
            className="w-10 h-10 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 transition-all"
          >
            <LayoutGrid className="w-5 h-5 text-gray-600" />
          </button>
          {/* Bouton + */}
          <button
            data-tour="rdv-add"
            onClick={() => setShowAddMenu(true)}
            className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-md shadow-primary/30 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 mb-4 overflow-x-auto hide-scrollbar">
        {MAIN_TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide transition-all ${
              activeTab === i
                ? "bg-primary text-white shadow-md shadow-primary/30"
                : "bg-white text-gray-400 border border-gray-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>



      {/* Prochain RDV — visible sur tous les onglets sauf Calendrier */}
      {activeTab !== 3 && (() => {
        const next = upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.time_slot?.localeCompare(b.time_slot))[0];
        if (!next) return null;
        return (
          <div className="px-5 mb-4">
            <div className="bg-gradient-to-r from-primary to-orange-600 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-primary/20">
              <div>
                <p className="text-[11px] font-black text-white/70 uppercase tracking-widest">Prochain RDV</p>
                <p className="text-[15px] font-black text-white mt-0.5">{next.service_name}</p>
                <p className="text-[11px] text-white/80 font-medium mt-0.5 capitalize">
                  {formatLongDate(next.date)} · {next.time || next.time_slot}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* À venir */}
      {activeTab === 0 && (
        <div className="px-5 space-y-3">
          {loading && reservations.length === 0 ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-[15px] font-black text-gray-400">Aucun RDV à venir</p>
              <p className="text-[12px] text-gray-400 font-medium mt-1 mb-1">Réservé par téléphone ? Retrouvez votre RDV avec votre ID.</p>
              <button onClick={() => setShowAddBooking(true)} className="mt-3 inline-block bg-primary text-white text-[11px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl active:scale-95 transition-all">Ajouter un ID de réservation</button>
            </div>
          ) : groupReservationsByDate(upcoming).map(({ date, rdvs }) => (
            <div key={date}>
              <div className="flex items-center gap-3 px-1 mb-2 mt-1">
                <div className="w-1 h-6 bg-primary rounded-full" />
                <p className="text-[13px] font-black text-gray-900 capitalize">{formatLongDate(date)}</p>
                <span className="ml-auto shrink-0 text-[9px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">{rdvs.length}</span>
              </div>
              <div className="space-y-2">
                {rdvs.map((r) => (
            <div key={r.id} onClick={() => setSelectedReservation(r)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-20 shrink-0 bg-primary/10 flex flex-col items-center justify-center py-4">
                <span className="text-[9px] font-black text-primary uppercase">{DAYS_FR[new Date(r.date).getDay()]}</span>
                <span className="text-[22px] font-black text-primary leading-none">{new Date(r.date).getDate()}</span>
                <span className="text-[9px] font-bold text-primary/70">{MONTHS_FR[new Date(r.date).getMonth()].slice(0,3)}</span>
              </div>
              <div className="p-3 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-black text-gray-900 truncate">{r.service_name}</h3>
                  <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full ${r.status === "confirme" ? "bg-green-50 text-green-600" : r.status === "termine" ? "bg-gray-100 text-gray-500" : "bg-primary/10 text-primary"}`}>
                    {r.status === "confirme" ? "Confirmé" : r.status === "termine" ? "Terminé" : "En attente"}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-gray-400 capitalize mt-0.5">{r.salon_name || r.pro_name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-primary" />
                    <span className="text-[11px] font-bold text-gray-700">{r.time || r.time_slot}</span>
                  </div>
                  {r.total_price > 0 && (
                    <span className="text-[11px] font-black text-primary">{r.total_price}€</span>
                  )}
                </div>
                {r.salon_address && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-gray-300" />
                    <span className="text-[11px] font-bold text-gray-400 truncate">{r.salon_address}</span>
                  </div>
                )}
              </div>
            </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Passés */}
      {activeTab === 1 && (
        <div className="px-5 space-y-3">
          {loading && reservations.length === 0 ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : past.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[15px] font-black text-gray-400">Aucun RDV passé</p>
            </div>
          ) : groupReservationsByDate(past).map(({ date, rdvs }) => (
            <div key={date}>
              <div className="flex items-center gap-3 px-1 mb-2 mt-1">
                <div className="w-1 h-6 bg-green-500 rounded-full" />
                <p className="text-[13px] font-black text-gray-900 capitalize">{formatLongDate(date)}</p>
                <span className="ml-auto shrink-0 text-[9px] font-black bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{rdvs.length}</span>
              </div>
              <div className="space-y-2">
                {rdvs.map((r) => (
            <div key={r.id} onClick={() => setSelectedReservation(r)} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3 shadow-sm active:scale-[0.99] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900 truncate">{r.service_name}</p>
                <p className="text-[11px] font-bold text-gray-400 capitalize">{r.salon_name || r.pro_name}</p>
                {r.client_name && (
                  <p className="text-[11px] font-bold text-gray-500">{r.client_name}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {(r.time_slot || r.time) && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-500">{r.time_slot || r.time}</span>
                    </div>
                  )}
                  {r.salon_address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-400 truncate">{r.salon_address}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setReviewModal(r); }}
                className={`shrink-0 flex items-center gap-1.5 text-[11px] font-black px-3 py-2 rounded-xl active:scale-95 transition-all uppercase tracking-widest ${
                  r.review_done
                    ? "bg-green-50 text-green-600 border border-green-200"
                    : reviewModal?.id === r.id
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "bg-primary/10 text-primary"
                }`}
              >
                <Star className="w-3.5 h-3.5" fill={r.review_done ? "currentColor" : "none"} />
                {r.review_done ? "Avis ✓" : "Avis"}
              </button>
            </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewModal && (
        <PostServiceReview
          reservation={reviewModal}
          proEmail={reviewModal.pro_email}
          proName={reviewModal.pro_name || reviewModal.salon_name}
          onClose={() => setReviewModal(null)}
          onSubmitted={() => setReviewModal(null)}
        />
      )}

      {/* Calendar suggestion modal */}
      {calendarSuggestion && (() => {
        const r = calendarSuggestion;
        const pad = (n) => String(n).padStart(2, "0");
        const [y, mo, d] = (r.date || "2000-01-01").split("-").map(Number);
        const [sh, sm] = (r.time || r.time_slot || "00:00").split(":").map(Number);
        const endT = sh * 60 + sm + (r.duration_min || 60);
        const eh = Math.floor(endT / 60) % 24, em = endT % 60;
        const fmt = (yy, mm, dd, hh, min) => `${yy}${pad(mm)}${pad(dd)}T${pad(hh)}${pad(min)}00`;
        const gCalUrl = `https://calendar.google.com/calendar/render?${new URLSearchParams({
          action: "TEMPLATE",
          text: `💆 BeautyBook – ${r.service_name || "RDV"}`,
          dates: `${fmt(y, mo, d, sh, sm)}/${fmt(y, mo, d, eh, em)}`,
          details: `Prestataire: ${r.salon_name || r.pro_name || ""}\nCode: ${r.crg_code || ""}`,
          location: r.salon_address || r.salon_name || "",
        }).toString()}`;
        const dtStart = new Date(y, mo-1, d, sh, sm);
        const dtEnd = new Date(y, mo-1, d, eh, em);
        const ics = [
          "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//BeautyBook//FR",
          "BEGIN:VEVENT",
          `DTSTART:${fmt(dtStart.getFullYear(), dtStart.getMonth()+1, dtStart.getDate(), dtStart.getHours(), dtStart.getMinutes())}`,
          `DTEND:${fmt(dtEnd.getFullYear(), dtEnd.getMonth()+1, dtEnd.getDate(), dtEnd.getHours(), dtEnd.getMinutes())}`,
          `SUMMARY:💆 ${r.service_name || "RDV"}`,
          `DESCRIPTION:Prestataire: ${r.salon_name || ""}\\nCode: ${r.crg_code || ""}`,
          `LOCATION:${r.salon_address || r.salon_name || ""}`,
          "STATUS:CONFIRMED",
          "BEGIN:VALARM","TRIGGER:-P1D","ACTION:DISPLAY","DESCRIPTION:Rappel: votre RDV BeautyBook demain","END:VALARM",
          "END:VEVENT","END:VCALENDAR"
        ].join("\r\n");
        const downloadICS = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "rdv-beautybook.ics";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        };
        return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={() => setCalendarSuggestion(null)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative bg-white w-[90%] max-w-sm rounded-3xl p-6 z-10 text-center" onClick={e => e.stopPropagation()}>
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-[18px] font-black text-gray-900 mb-1">Réservation confirmée !</h3>
              <p className="text-[13px] text-gray-500 font-medium mb-1">{r.service_name}</p>
              <p className="text-[12px] text-gray-400 font-medium mb-5 capitalize">{formatLongDate(r.date)} · {r.time || r.time_slot}</p>
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Ajouter à votre agenda</p>
              <div className="space-y-2">
                <a href={gCalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#4285F4] text-white rounded-2xl text-[13px] font-black active:scale-95 transition-all">
                  <Calendar className="w-4 h-4" /> Google Calendar
                </a>
                <button onClick={downloadICS}
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl text-[13px] font-black active:scale-95 transition-all">
                  <Calendar className="w-4 h-4" /> Ajouter à Apple Calendar
                </button>
              </div>
              <button onClick={() => setCalendarSuggestion(null)}
                className="mt-4 text-[12px] font-black text-gray-400 uppercase tracking-widest">
                Plus tard
              </button>
            </div>
          </div>
        );
      })()}

      {/* Annulés */}
      {activeTab === 2 && (
        <div className="px-5 space-y-3">
          {cancelled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-[15px] font-black text-gray-400">Aucun RDV annulé</p>
            </div>
          ) : groupReservationsByDate(cancelled).map(({ date, rdvs }) => (
            <div key={date}>
              <div className="flex items-center gap-3 px-1 mb-2 mt-1">
                <div className="w-1 h-6 bg-red-400 rounded-full" />
                <p className="text-[13px] font-black text-gray-900 capitalize">{formatLongDate(date)}</p>
                <span className="ml-auto shrink-0 text-[9px] font-black bg-red-50 text-red-400 px-2 py-0.5 rounded-full">{rdvs.length}</span>
              </div>
              <div className="space-y-2">
                {rdvs.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3 shadow-sm opacity-60">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-gray-900 truncate">{r.service_name}</p>
                <p className="text-[11px] font-bold text-gray-400 capitalize">{r.salon_name}</p>
              </div>
              <span className="text-[9px] font-black text-red-400 uppercase bg-red-50 px-2 py-1 rounded-full">Annulé</span>
            </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calendrier */}
      {activeTab === 3 && <CalendarView reservations={reservations} onEventClick={(ev) => {
        if (ev.type === "rdv" && ev.raw) {
          setSelectedReservation(ev.raw);
        } else if (ev.type === "routine") {
          setSelectedRoutine(ev);
        }
      }} />}

      {/* Modal récapitulatif RDV */}
      {selectedReservation && (
        <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setSelectedReservation(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white w-full rounded-t-3xl z-10 overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))" }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
              <h3 className="text-[17px] font-black text-gray-900">Récapitulatif RDV</h3>
              <button onClick={() => setSelectedReservation(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Service & statut */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[18px] font-black text-gray-900 leading-tight">{selectedReservation.service_name}</p>
                  <p className="text-[13px] font-bold text-gray-400 mt-0.5">{selectedReservation.salon_name || selectedReservation.pro_name}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${selectedReservation.status === "confirme" ? "bg-green-50 text-green-600" : "bg-primary/10 text-primary"}`}>
                  {selectedReservation.status === "confirme" ? "Confirmé ✓" : selectedReservation.status === "termine" ? "Terminé" : "En attente"}
                </span>
              </div>

              {/* Détails */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</p>
                    <p className="text-[13px] font-black text-gray-900 capitalize">
                      {formatLongDate(selectedReservation.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Heure</p>
                    <p className="text-[13px] font-black text-gray-900">
                      {selectedReservation.time || selectedReservation.time_slot}{selectedReservation.end_time_slot ? ` → ${selectedReservation.end_time_slot}` : ""}
                      {selectedReservation.duration_min ? ` (${selectedReservation.duration_min} min)` : ""}
                    </p>
                  </div>
                </div>
                {(selectedReservation.salon_address) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adresse</p>
                      <p className="text-[13px] font-black text-gray-900">{selectedReservation.salon_address}</p>
                    </div>
                  </div>
                )}
                {selectedReservation.total_price > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</p>
                      <p className="text-[13px] font-black text-gray-900">{selectedReservation.total_price} €</p>
                    </div>
                  </div>
                )}
                {selectedReservation.persons > 1 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Personnes</p>
                      <p className="text-[13px] font-black text-gray-900">{selectedReservation.persons} personnes</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Code CRG */}
              {selectedReservation.crg_code && (
                <div className="bg-gradient-to-br from-primary/10 to-orange-50 border-2 border-primary/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Code à communiquer au professionnel</p>
                  </div>
                  <p className="text-[36px] font-black text-gray-900 tracking-[0.3em] text-center py-2">{selectedReservation.crg_code}</p>
                  <p className="text-[10px] text-gray-400 font-medium text-center">Présentez ce code au professionnel pour valider votre arrivée</p>
                </div>
              )}

              {/* QR code + ID de réservation */}
              {(selectedReservation.qr_code_url || selectedReservation.booking_code) && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
                  {selectedReservation.qr_code_url && (
                    <img src={selectedReservation.qr_code_url} alt="QR code du rendez-vous" className="w-24 h-24 rounded-xl border border-gray-200 bg-white shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ID de réservation</p>
                    <p className="text-[17px] font-black text-gray-900 tracking-[0.15em]">{selectedReservation.booking_code || "—"}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-1 leading-relaxed">Présentez ce QR code au professionnel ou communiquez votre ID.</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedReservation.notes && (
                <div className="bg-blue-50 rounded-2xl p-3">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Notes</p>
                  <p className="text-[12px] text-gray-700 font-medium">{selectedReservation.notes}</p>
                </div>
              )}

              {/* Boutons calendrier */}
              <div className="space-y-2 pt-2">
                {/* Google Calendar */}
                <a
                  href={(() => {
                    const pad = (n) => String(n).padStart(2, "0");
                    const [y, mo, d] = (selectedReservation.date || "2000-01-01").split("-").map(Number);
                    const [sh, sm] = (selectedReservation.time || selectedReservation.time_slot || "00:00").split(":").map(Number);
                    const endT = sh * 60 + sm + (selectedReservation.duration_min || 60);
                    const eh = Math.floor(endT / 60) % 24, em = endT % 60;
                    const fmt = (yy, mm, dd, hh, min) => `${yy}${pad(mm)}${pad(dd)}T${pad(hh)}${pad(min)}00`;
                    const p = new URLSearchParams({
                      action: "TEMPLATE",
                      text: `💆 BeautyBook – ${selectedReservation.service_name || "RDV"}`,
                      dates: `${fmt(y, mo, d, sh, sm)}/${fmt(y, mo, d, eh, em)}`,
                      details: `Prestataire: ${selectedReservation.salon_name || selectedReservation.pro_name || ""}\nCode: ${selectedReservation.crg_code || ""}`,
                      location: selectedReservation.salon_address || selectedReservation.salon_name || "",
                    });
                    return `https://calendar.google.com/calendar/render?${p.toString()}`;
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#4285F4] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all w-full"
                >
                  <Calendar className="w-4 h-4" />
                  Ajouter à Google Calendar
                </a>
                {/* Apple Calendar */}
                {(() => {
                  const pad = (n) => String(n).padStart(2, "0");
                  const [y, mo, d] = (selectedReservation.date || "2000-01-01").split("-").map(Number);
                  const [sh, sm] = (selectedReservation.time || selectedReservation.time_slot || "00:00").split(":").map(Number);
                  const endT = sh * 60 + sm + (selectedReservation.duration_min || 60);
                  const eh = Math.floor(endT / 60) % 24, em = endT % 60;
                  const fmtDate = (dt) => `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
                  const dtStart = new Date(y, mo-1, d, sh, sm);
                  const dtEnd = new Date(y, mo-1, d, eh, em);
                  const ics = [
                    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//BeautyBook//FR",
                    "BEGIN:VEVENT",
                    `DTSTART:${fmtDate(dtStart)}`,
                    `DTEND:${fmtDate(dtEnd)}`,
                    `SUMMARY:💆 ${selectedReservation.service_name || "RDV"}`,
                    `DESCRIPTION:Prestataire: ${selectedReservation.salon_name || ""}\\nCode: ${selectedReservation.crg_code || ""}`,
                    `LOCATION:${selectedReservation.salon_address || selectedReservation.salon_name || ""}`,
                    "STATUS:CONFIRMED",
                    "BEGIN:VALARM","TRIGGER:-P1D","ACTION:DISPLAY","DESCRIPTION:Rappel: votre RDV BeautyBook demain","END:VALARM",
                    "BEGIN:VALARM","TRIGGER:-PT2H","ACTION:DISPLAY","DESCRIPTION:Rappel: votre RDV BeautyBook dans 2 heures","END:VALARM",
                    "END:VEVENT","END:VCALENDAR"
                  ].join("\r\n");
                  const dataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
                  const downloadICS = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "rdv-beautybook.ics";
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
                  };
                  return (
                    <button
                      onClick={downloadICS}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all w-full"
                    >
                      <Calendar className="w-4 h-4" />
                      Ajouter à Apple Calendar
                    </button>
                  );
                })()}
              </div>

              {/* Contacter le professionnel */}
              {(selectedReservation.status === "confirme" || selectedReservation.status === "en_attente") && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setSelectedReservation(null); navigate(`/messages?to=${encodeURIComponent(selectedReservation.pro_email || selectedReservation.salon_email || "")}&name=${encodeURIComponent(selectedReservation.salon_name || selectedReservation.pro_name || "Pro")}`); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 text-primary rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Message
                  </button>
                  {selectedReservation.pro_phone && (
                    <a
                      href={`tel:${selectedReservation.pro_phone}`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-600 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      <Phone className="w-4 h-4" />
                      Appeler
                    </a>
                  )}
                </div>
              )}

              {/* Annuler le RDV */}
              {(selectedReservation.status === "confirme" || selectedReservation.status === "en_attente") && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowCancelConfirm(selectedReservation)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-500 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all border border-red-100"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Annuler le rendez-vous
                  </button>
                </div>
              )}

              {/* Fermer */}
              <button onClick={() => setSelectedReservation(null)} className="w-full py-3.5 bg-gray-100 text-gray-600 text-[13px] font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal détails routine */}
      {selectedRoutine && (() => {
        const r = selectedRoutine.raw || {};
        const tasks = r.tasks || [];
        const freqLabel = r.frequency === "quotidien" ? "Quotidien" : r.days_of_week?.length ? `Les ${r.days_of_week.map(d => ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"][d]).join(", ")}` : "Personnalisé";
        return (
          <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setSelectedRoutine(null)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative bg-white w-full rounded-t-3xl z-10 overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}
              style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))" }}>
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100 shrink-0">
                <h3 className="text-[17px] font-black text-gray-900">Détails Routine</h3>
                <button onClick={() => setSelectedRoutine(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                {/* Header routine */}
                <div className="flex items-center gap-3">
                  <span className="text-[40px]">{selectedRoutine.icon}</span>
                  <div className="flex-1">
                    <p className="text-[18px] font-black text-gray-900">{selectedRoutine.service}</p>
                    {r.description && (
                      <p className="text-[12px] text-gray-400 font-medium mt-0.5 leading-relaxed">{r.description}</p>
                    )}
                  </div>
                </div>

                {/* Infos rapides */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-2xl p-3 text-center">
                    <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-[12px] font-black text-gray-900">{selectedRoutine.detail}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Durée</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3 text-center">
                    <Calendar className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-[11px] font-black text-gray-900 leading-tight">{freqLabel}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Fréquence</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3 text-center">
                    <span className="text-[14px] block mb-1">⏰</span>
                    <p className="text-[12px] font-black text-gray-900">{r.time || "—"}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Heure</p>
                  </div>
                </div>

                {/* Objectif */}
                {r.objectif && (
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Objectif</p>
                    <p className="text-[13px] font-medium text-gray-700 leading-relaxed">{r.objectif}</p>
                  </div>
                )}

                {/* Étapes / Produits */}
                {tasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Étapes ({tasks.length})</p>
                    <div className="space-y-2">
                      {tasks.map((t, i) => (
                        <div key={t.id || i} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-black text-primary">{i + 1}</span>
                          </div>
                          <p className="text-[13px] font-medium text-gray-800">{t.label || t}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Catégorie */}
                {r.category && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Catégorie</span>
                    <span className="text-[12px] font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">{r.category}</span>
                  </div>
                )}

                <button onClick={() => setSelectedRoutine(null)} className="w-full py-3.5 bg-gray-100 text-gray-600 text-[13px] font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal confirmation annulation */}
      {showAddBooking && (
        <AddBookingIdModal
          onFound={(r) => { setShowAddBooking(false); setSelectedReservation(r); }}
          onClose={() => setShowAddBooking(false)}
        />
      )}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-5" onClick={() => setShowCancelConfirm(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white w-full max-w-sm rounded-3xl p-6 z-10" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-[18px] font-black text-gray-900 text-center mb-2">Annuler ce RDV ?</h3>
            {(() => {
              const rdvDate = new Date(`${showCancelConfirm.date}T${showCancelConfirm.time || showCancelConfirm.time_slot || "00:00"}`);
              const now = new Date();
              const hoursUntil = (rdvDate - now) / (1000 * 60 * 60);
              const isFullRefund = hoursUntil >= 24;
              const refundAmount = isFullRefund ? showCancelConfirm.total_price : Math.round((showCancelConfirm.total_price || 0) * 0.5 * 100) / 100;
              return (
                <div className="text-center mb-5">
                  {isFullRefund ? (
                    <p className="text-[13px] text-gray-500 font-medium">Annulation <span className="font-black text-green-600">remboursement intégral</span> de {showCancelConfirm.total_price}€</p>
                  ) : (
                    <p className="text-[13px] text-gray-500 font-medium">Annulation <span className="font-black text-orange-500">-50%</span> — vous récupérerez {refundAmount}€</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">Moins de 24h avant le RDV = pénalité de 50%</p>
                </div>
              );
            })()}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-[12px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all"
              >
                Garder
              </button>
              <button
                onClick={() => handleCancelReservation(showCancelConfirm)}
                disabled={cancelling}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Annuler"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}