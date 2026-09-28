import { useState, useEffect } from "react";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, User, Scissors, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { format, addDays, startOfWeek, isSameDay, parseISO, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_COLORS = {
  confirme: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: CheckCircle, dot: "bg-green-400" },
  en_attente: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", icon: AlertCircle, dot: "bg-yellow-400" },
  annule: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: XCircle, dot: "bg-red-400" },
  termine: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500", icon: CheckCircle, dot: "bg-gray-400" },
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h à 20h

function buildWeek(baseDate) {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export default function PlanningMembre() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const memberName = searchParams.get("name") || "Membre";
  const memberId = searchParams.get("id");
  const { user } = useAuth();
  // Cache par pro + membre : affichage direct des dernières données, refresh en arrière-plan.
  const pmKey = user?.email && memberId ? `planningmembre_${user.email}_${memberId}` : null;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useCachedState(pmKey, [], c => c?.reservations || []);
  const [memberInfo, setMemberInfo] = useCachedState(pmKey, null, c => c?.memberInfo ?? null);
  const [loading, setLoading] = useState(() => !readPageCache(pmKey)?.reservations?.length);
  const [selectedDay, setSelectedDay] = useState(new Date());

  const weekDays = buildWeek(currentDate);

  useEffect(() => {
    if (!user?.email || !memberId) return;
    loadData();
  }, [user?.email, memberId, currentDate]);

  const loadData = async () => {
    setLoading(true);
    const weekStart = format(weekDays[0], "yyyy-MM-dd");
    const weekEnd = format(addDays(weekDays[6], 1), "yyyy-MM-dd");

    try {
      // Membre info
      const { data: memberData } = await supabase.from("MembreEquipe").select("*").eq("id", memberId).single();
      setMemberInfo(memberData);

      // RDV du pro pour cette semaine
      const { data: rdvs } = await entities.Reservation.filter({ pro_email: user.email }, "-date", 200);
      const weekRdvs = (rdvs || []).filter(r => {
        const d = r.date;
        return d >= weekStart && d < weekEnd;
      }).map(r => ({
        ...r,
        _statusColor: STATUS_COLORS[r.status] || STATUS_COLORS.en_attente,
      }));
      setReservations(weekRdvs);
      mergePageCache(pmKey, { memberInfo: memberData, reservations: weekRdvs });
    } catch (e) {
      console.error("[PlanningMembre] Error:", e);
    }
    setLoading(false);
  };

  const getRdvForSlot = (day, hour) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return reservations.find(r => {
      if (r.date !== dayStr) return false;
      const slotHour = parseInt((r.time || r.time_slot || "").split("h")[0], 10);
      return slotHour === hour;
    });
  };

  const getRdvForDay = (day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return reservations.filter(r => r.date === dayStr);
  };

  const todayRdvs = getRdvForDay(selectedDay);

  return (
    <div className="font-display min-h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate("/pro/equipe")} className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center active:scale-95">
          <ArrowLeft className="w-5 h-5 text-primary" />
        </button>
        <div className="flex-1">
          <h1 className="text-[17px] font-black text-gray-900">Planning</h1>
          <p className="text-[12px] text-primary font-bold">{memberName}</p>
        </div>
      </div>

      {/* Navigation semaine */}
      <div className="px-5 flex items-center justify-between mb-3">
        <button onClick={() => setCurrentDate(d => subWeeks(d, 1))} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-[13px] font-black text-gray-900">
          {format(weekDays[0], "dd MMM", { locale: fr })} — {format(weekDays[6], "dd MMM yyyy", { locale: fr })}
        </span>
        <button onClick={() => setCurrentDate(d => addWeeks(d, 1))} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="px-3 flex gap-1 mb-4 overflow-x-auto">
        {weekDays.map((day, i) => {
          const dayRdvs = getRdvForDay(day);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDay);
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              className={`flex-1 min-w-[48px] py-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
                isSelected ? "bg-primary text-white shadow-md shadow-primary/30"
                : isToday ? "bg-orange-50 text-primary border border-orange-200"
                : "bg-gray-50 text-gray-600"
              }`}
            >
              <span className="text-[9px] font-bold uppercase">{format(day, "EEE", { locale: fr })}</span>
              <span className="text-[16px] font-black">{format(day, "d")}</span>
              {dayRdvs.length > 0 && (
                <div className="flex gap-0.5">
                  {dayRdvs.slice(0, 3).map((r, j) => (
                    <div key={j} className={`w-1.5 h-1.5 rounded-full ${r._statusColor.dot}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="h-px bg-gray-100 mx-5" />

      {/* Planning horaire */}
      <div className="flex-1 overflow-y-auto px-5 pb-32">
        <h3 className="text-[13px] font-black text-gray-900 mt-3 mb-2">
          {format(selectedDay, "EEEE d MMMM", { locale: fr })}
        </h3>

        {(loading && reservations.length === 0) ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : HOURS.map(hour => {
          const rdv = getRdvForSlot(selectedDay, hour);
          return (
            <div key={hour} className="flex gap-3 mb-1">
              {/* Heure */}
              <div className="w-12 shrink-0 pt-2">
                <span className="text-[11px] font-bold text-gray-400">{String(hour).padStart(2, "0")}h00</span>
              </div>
              {/* Slot */}
              <div className="flex-1 min-h-[52px]">
                {rdv ? (
                  <div className={`p-3 rounded-xl border ${rdv._statusColor.bg} ${rdv._statusColor.border}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${rdv._statusColor.dot}`} />
                      <span className={`text-[11px] font-black ${rdv._statusColor.text} uppercase`}>
                        {rdv.status === "confirme" ? "Confirmé" : rdv.status === "en_attente" ? "En attente" : rdv.status}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">{rdv.time_slot}</span>
                    </div>
                    <p className="text-[13px] font-bold text-gray-900">{rdv.service_name || "Service"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-[11px] text-gray-500">{rdv.client_email}</span>
                    </div>
                    {rdv.duration_min && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-gray-400">{rdv.duration_min} min</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[52px] border border-dashed border-gray-100 rounded-xl flex items-center justify-center">
                    <span className="text-[10px] text-gray-200 font-medium">Libre</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Résumé du jour */}
        {todayRdvs.length > 0 && (
          <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
            <h4 className="text-[12px] font-black text-primary uppercase tracking-wider mb-2">Résumé de la journée</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-bold text-gray-900">{todayRdvs.length} RDV</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-bold text-gray-900">
                  {todayRdvs.reduce((acc, r) => acc + (r.duration_min || 30), 0)} min total
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
