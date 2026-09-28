import { useLiveSessions } from '@/hooks/useLiveSessions';
import { useLocation, useNavigate } from "react-router-dom";
import { MapPin, Radio, Search, Users, ShoppingBag, Building2, Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { getUnreadCount } from '@/lib/notificationService';
import CityPickerModal from "@/components/layout/CityPickerModal";

const topTabs = [
  { id: "live",       label: "Direct",    path: "/live",                Icon: Radio,      color: "#ef4444", badge: true },
  { id: "recherche",  label: "Recherche", path: "/recherche",           Icon: Search,     color: "#E8732A" },
  { id: "reels",      label: "Social",    path: "/reseau-social",       Icon: Users,      color: "#a855f7" },
  { id: "boutique",   label: "Boutique",  path: "/boutique",            Icon: ShoppingBag,color: "#06b6d4" },
  { id: "immobilier", label: "Immo",      path: "/immobilier",          Icon: Building2,  color: "#10b981" },
  { id: "fidelite",   label: "Fidélité",  path: "/programme-fidelite",  Icon: Star,       color: "#f59e0b" },
];

export default function MainHeader() {
  const { sessions: liveSessions } = useLiveSessions();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [userCity, setUserCity] = useState(() => localStorage.getItem("bb_user_city") || "Paris, France");
  const [geoLoading, setGeoLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Notifications non lues
        const notifCount = await getUnreadCount(user.email);
        setUnreadNotifs(notifCount);

        // Messages non lus
        try {
          const convIds = new Set();
          const [sent, received] = await Promise.all([
            entities.MessageChat.filter({ sender_email: user.email }, null, 200).catch(() => []),
            entities.MessageChat.filter({ receiver_email: user.email }, null, 200).catch(() => []),
          ]);
          const allMsgs = [...sent, ...received];
          for (const m of allMsgs) {
            if (m.conversation_id) convIds.add(m.conversation_id);
          }
          let unread = 0;
          for (const convId of convIds) {
            const { count } = await supabase
              .from("MessageChat")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", convId)
              .eq("receiver_email", user.email)
              .eq("read", false);
            unread += count || 0;
          }
          setUnreadMessages(unread);
        } catch {
          // silently fail for messages
        }

        // Panier
        try {
          const { data: panier } = await entities.Panier.filter({ user_email: user.email }, "-created_at", 1);
          if (panier && panier[0]?.items) {
            setCartCount(panier[0].items.reduce((s, i) => s + (i.quantity || 1), 0));
          }
        } catch {
          // silently fail
        }
      } catch {
        // silently fail
      }
    };
    load();
  }, [location.pathname]);

  // Realtime notification badge
  useEffect(() => {
    let userEmail = null;
    let channel = null, disposed = false;
    supabase.auth.getUser().then(({ data }) => {
      userEmail = data?.user?.email;
      if (!userEmail || disposed) return;
      channel = supabase
        .channel("header-notif-badge")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "Notification" },
          (payload) => {
            if (payload.new?.user_email === userEmail) {
              setUnreadNotifs(prev => prev + 1);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "Notification" },
          (payload) => {
            if (payload.new?.user_email === userEmail && (payload.new?.read || payload.new?.is_read)) {
              setUnreadNotifs(prev => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();
    });
    return () => { disposed = true; if (channel) void supabase.removeChannel(channel); };
  }, []);

  return (
    <>
    {showCityPicker && (
      <CityPickerModal
        currentCity={userCity}
        onSelect={city => setUserCity(city)}
        onClose={() => setShowCityPicker(false)}
      />
    )}
    <header className="flex flex-col bg-white sticky top-0 z-50 border-b border-gray-100/50 shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Row 1: Location + Icons */}
      <div className="flex items-center justify-between px-5 py-3">
        <button
          onClick={() => setShowCityPicker(true)}
          className="flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <MapPin className="w-5 h-5 text-primary shrink-0" />
          <span className="text-[13px] font-black text-gray-900">{userCity}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Messages */}
          <button onClick={() => navigate("/messages")} className="relative w-8 h-8 flex items-center justify-center text-gray-700 hover:text-primary transition-colors active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary rounded-full border border-white flex items-center justify-center text-white text-[8px] font-black px-1">
                {unreadMessages}
              </span>
            )}
          </button>
          {/* Notifications */}
          <button onClick={() => navigate("/notifications")} className="relative w-9 h-9 flex items-center justify-center rounded-2xl bg-gray-50 hover:bg-orange-50 transition-all active:scale-95">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-black px-0.5">
                {unreadNotifs}
              </span>
            )}
          </button>
          {/* Panier */}
          <button onClick={() => navigate("/panier")} className="relative w-8 h-8 flex items-center justify-center text-gray-700 hover:text-primary transition-colors active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary rounded-full border border-white flex items-center justify-center text-white text-[8px] font-black px-1">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Row 2: Top text tabs */}
      <div className="overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-2 px-4 pb-3 min-w-max">
          {topTabs.map((tab) => {
            const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");
            const isLive = tab.id === "live";
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border transition-all active:scale-95 text-[12px] font-black ${
                  isActive
                    ? "bg-gray-900 border-gray-900 text-white shadow-sm"
                    : isLive
                    ? "bg-red-50 border-red-200 text-red-600"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
              >
                <tab.Icon
                  className={`w-3.5 h-3.5 shrink-0 ${isLive && !isActive ? "animate-pulse" : ""}`}
                  style={{ color: isActive ? "white" : tab.color }}
                  strokeWidth={2}
                />
                {tab.label}
                {isLive && liveSessions.length > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-black">
                    {liveSessions.length > 9 ? "9+" : liveSessions.length}
                  </span>
                )}
                {isLive && liveSessions.length === 0 && (
                  <span className="relative flex h-2 w-2 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
    </>
    );
    }