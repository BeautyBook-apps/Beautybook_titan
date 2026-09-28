import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import {
  ArrowLeft, Bell, Check, X, Settings,
  MessageCircle, CalendarCheck, Tag, Star, ShoppingBag,
  ShieldCheck, Scissors, User, Megaphone, Clock, MapPin,
  ChevronRight, ExternalLink, CheckCircle2, AlertCircle
} from "lucide-react";
import { supabase } from '@/api/supabaseClient';
import { entities } from '@/api/entities';
import {
  loadNotifications,
  markAsRead,
  markAllAsRead as markAllAsReadService,
} from '@/lib/notificationService';

function getNotifVisual(notif) {
  const isAdmin = notif.data?.is_admin || notif.title?.toLowerCase().includes("admin") || notif.data?.sender_role === "admin";
  const isPro   = notif.data?.sender_role === "pro" || notif.data?.is_pro;

  if (notif.type === "message") {
    if (isAdmin) return { Icon: ShieldCheck,   bg: "bg-violet-100", iconColor: "text-violet-600", border: "border-violet-200" };
    if (isPro)   return { Icon: Scissors,       bg: "bg-orange-100", iconColor: "text-orange-500", border: "border-orange-200" };
    return              { Icon: MessageCircle,  bg: "bg-sky-100",    iconColor: "text-sky-500",    border: "border-sky-200"    };
  }
  if (notif.type === "reservation") return { Icon: CalendarCheck, bg: "bg-blue-100",   iconColor: "text-blue-600",   border: "border-blue-200"   };
  if (notif.type === "promo")       return { Icon: Tag,           bg: "bg-amber-100",  iconColor: "text-amber-500",  border: "border-amber-200"  };
  if (notif.type === "avis")        return { Icon: Star,          bg: "bg-yellow-100", iconColor: "text-yellow-500", border: "border-yellow-200" };
  if (notif.type === "commande")    return { Icon: ShoppingBag,   bg: "bg-purple-100", iconColor: "text-purple-600", border: "border-purple-200" };
  if (notif.type === "system")      return { Icon: Megaphone,     bg: "bg-gray-100",   iconColor: "text-gray-500",   border: "border-gray-200"   };
  return                                   { Icon: Bell,          bg: "bg-gray-100",   iconColor: "text-gray-500",   border: "border-gray-200"   };
}

function SenderBadge({ notif }) {
  const isAdmin = notif.data?.is_admin || notif.title?.toLowerCase().includes("admin") || notif.data?.sender_role === "admin";
  const isPro   = notif.data?.sender_role === "pro" || notif.data?.is_pro;
  if (notif.type !== "message") return null;
  if (isAdmin) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full mt-1">
      <ShieldCheck className="w-2.5 h-2.5" /> Administrateur
    </span>
  );
  if (isPro) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full mt-1">
      <Scissors className="w-2.5 h-2.5" /> Professionnel
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full mt-1">
      <User className="w-2.5 h-2.5" /> Client
    </span>
  );
}

function NotifItem({ notif, onRead, onClick, onDelete }) {
  const { Icon, bg, iconColor, border } = getNotifVisual(notif);
  const date = new Date(notif.created_at);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  let timeLabel;
  if (diffMin < 1) timeLabel = "À l'instant";
  else if (diffMin < 60) timeLabel = `${diffMin}min`;
  else if (diffMin < 1440) timeLabel = `${Math.floor(diffMin / 60)}h`;
  else timeLabel = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  const handleClick = () => {
    onRead(notif.id);
    onClick(notif);
  };

  return (
    <div className={`flex items-start gap-3 px-4 py-4 border-b border-gray-50 transition-all ${!notif.read && !notif.is_read ? "bg-primary/[0.03]" : ""}`}>
      <button onClick={handleClick} className="flex items-start gap-3 flex-1 text-left active:scale-[0.99] transition-all min-w-0">
        <div className={`w-11 h-11 ${bg} ${border} border rounded-2xl flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[13px] leading-snug ${!notif.read && !notif.is_read ? "font-black text-gray-900" : "font-bold text-gray-700"}`}>
              {notif.title}
            </p>
            <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 font-medium">{timeLabel}</span>
          </div>
          <p className="text-[12px] text-gray-500 font-medium mt-0.5 leading-snug">{notif.body || notif.message}</p>
          <SenderBadge notif={notif} />
        </div>
        {!notif.read && !notif.is_read && (
          <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
        )}
      </button>
      <button
        onClick={() => onDelete(notif.id)}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-400 active:scale-95 transition-all shrink-0 mt-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NotifDetail({ notif, onClose, onNavigate }) {
  const { Icon, bg, iconColor, border } = getNotifVisual(notif);
  const date = new Date(notif.created_at);
  const dateStr = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const handleAction = () => {
    if (notif.type === "message" && notif.data?.conversation_id) {
      const senderEmail = notif.data?.sender_email;
      const isAdmin = notif.data?.is_admin || notif.title?.toLowerCase().includes("admin");
      if (senderEmail) {
        const nameParam = notif.data?.sender_name ? `&name=${encodeURIComponent(notif.data.sender_name)}` : `&name=${encodeURIComponent(senderEmail)}`;
        const adminParam = isAdmin ? "&readonly=1" : "";
        onNavigate(`/messages?to=${senderEmail}${nameParam}${adminParam}`);
      } else {
        onNavigate("/messages");
      }
    } else if (notif.type === "reservation") {
      onNavigate("/rendez-vous");
    } else if (notif.type === "commande") {
      onNavigate("/rendez-vous");
    } else if (notif.type === "avis") {
      onNavigate("/rendez-vous");
    } else if (notif.action_url) {
      onNavigate(notif.action_url);
    } else if (notif.link) {
      onNavigate(notif.link);
    }
  };

  const hasAction = notif.type === "message" || notif.type === "reservation" || notif.type === "commande" || notif.type === "avis" || notif.action_url || notif.link;

  return (
    <div className="fixed inset-0 z-[700] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full max-h-[85vh] rounded-t-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-black text-gray-900">Détail de la notification</h2>
            <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-14 h-14 ${bg} ${border} border rounded-2xl flex items-center justify-center shrink-0`}>
              <Icon className={`w-7 h-7 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-black text-gray-900 leading-tight">{notif.title}</p>
              <SenderBadge notif={notif} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Message</p>
            <p className="text-[14px] text-gray-700 font-medium leading-relaxed">{notif.body || notif.message}</p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Informations</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Clock className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Date</p>
                  <p className="text-[12px] font-bold text-gray-700">{dateStr}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Clock className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Heure</p>
                  <p className="text-[12px] font-bold text-gray-700">{timeStr}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Bell className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Type</p>
                  <p className="text-[12px] font-bold text-gray-700 capitalize">{notif.type || "Système"}</p>
                </div>
              </div>
              {notif.data?.salon_name && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <MapPin className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Salon</p>
                    <p className="text-[12px] font-bold text-gray-700">{notif.data.salon_name}</p>
                  </div>
                </div>
              )}
              {notif.data?.service_name && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Scissors className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Service</p>
                    <p className="text-[12px] font-bold text-gray-700">{notif.data.service_name}</p>
                  </div>
                </div>
              )}
              {notif.data?.amount && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <ShoppingBag className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Montant</p>
                    <p className="text-[12px] font-bold text-gray-700">{notif.data.amount}€</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {notif.data?.sender_name && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Expéditeur</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-gray-900">{notif.data.sender_name}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{notif.data.sender_email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {hasAction && (
          <div className="px-5 py-4 border-t border-gray-100">
            <button
              onClick={handleAction}
              className="w-full py-3.5 bg-primary text-white text-[13px] font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Voir les détails
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Affichage direct depuis le cache : les notifications s'affichent
  // immédiatement, le rafraîchissement réseau se fait en arrière-plan.
  const cacheKey = user?.email ? `notifs_${user.email}` : null;
  const [notifications, setNotifications] = useCachedState(cacheKey, [], c => c?.notifications || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey)?.notifications?.length);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const userEmailRef = useRef(null);

  useEffect(() => {
    fetchNotifs();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Notification" },
        (payload) => {
          const newNotif = payload.new;
          if (userEmailRef.current && newNotif.user_email === userEmailRef.current) {
            setNotifications(prev => [newNotif, ...prev]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      userEmailRef.current = user.email;
      const notifs = await loadNotifications(user.email, 50);
      setNotifications(notifs || []);
      mergePageCache(cacheKey, { notifications: notifs || [] });
    } catch (e) {
      console.error("[Notifications] Load error:", e);
      setNotifications([]);
    }
    setLoading(false);
  };

  const markRead = async (id) => {
    await markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, is_read: true } : n));
  };

  const markAllRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await markAllAsReadService(user.email);
    } catch (e) {
      console.error("Mark all read error:", e);
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true, is_read: true })));
  };

  const deleteNotif = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await entities.Notification.delete(id);
    } catch {
      await supabase.from("Notification").delete().eq("id", id);
    }
  };

  const unreadCount = notifications.filter(n => !n.read && !n.is_read).length;

  return (
    <div className="font-display bg-white min-h-full">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <div className="flex-1">
          <h1 className="text-[20px] font-black text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-[11px] text-primary font-bold">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 text-[11px] font-black text-primary active:scale-95 transition-all">
              <Check className="w-3.5 h-3.5" />
              Tout lire
            </button>
          )}
          <button
            onClick={() => navigate("/parametres/notifications")}
            className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {loading && notifications.length === 0 ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-11 h-11 bg-gray-100 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded-full w-2/3" />
                <div className="h-3 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Bell className="w-12 h-12 text-gray-200" />
          <p className="text-[14px] font-bold text-gray-400">Aucune notification</p>
          <p className="text-[12px] text-gray-300 font-medium">Vous êtes à jour !</p>
        </div>
      ) : (
        <div>
          {notifications.map(notif => (
            <NotifItem
              key={notif.id}
              notif={notif}
              onRead={markRead}
              onClick={setSelectedNotif}
              onDelete={deleteNotif}
            />
          ))}
        </div>
      )}

      {selectedNotif && (
        <NotifDetail
          notif={selectedNotif}
          onClose={() => setSelectedNotif(null)}
          onNavigate={(path) => { setSelectedNotif(null); navigate(path); }}
        />
      )}
    </div>
  );
}
