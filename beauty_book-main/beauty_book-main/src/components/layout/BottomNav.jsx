import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Home, Scissors, CalendarDays, User, Bot, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { useIsPro } from "@/hooks/useIsPro";
// Note: /reseau-social also maps to Reels component

// Pages où la nav ne doit PAS s'afficher (parcours internes)
const HIDDEN_PATHS = [
  "/pro/beauty-pay", "/pro/catalogue-services", "/pro/ajouter-service", "/pro/creer-bundle",
  "/pro/avis-clients", "/pro/equipe", "/pro/nouveau-membre",
  "/pro/analytics", "/pro/publication", "/pro/visite-3d",
  "/pro/franchise", "/pro/lancer-direct", "/pro/modifier-profil",
  "/pro/abonnements",
  "/pro/gestion-styles", "/pro/promo-service",
  "/devenir-pro", "/modifier-profil",
  "/modifier-profil-client", "/programme-fidelite", "/notifications",
  "/produit", "/immobilier/",
  "/live-detail/",
];

// Root paths per tab
const TAB_ROOTS = {
  home: "/",
  services: "/services-salons",
  maria: "/maria",
  rendezvous: "/rendez-vous",
  profil: "/profil",
};

// Which tab does a given path belong to?
function getTabForPath(p) {
  if (p === "/") return "home";
  if (p.startsWith("/services-salons") || p.startsWith("/service/") || p.startsWith("/style/") || p.startsWith("/bundle/") || p.startsWith("/bundle-groupe/")) return "services";
  if (p.startsWith("/maria")) return "maria";
  if (p.startsWith("/rendez-vous") || p.startsWith("/pro/gestion-agenda")) return "rendezvous";
  if (p.startsWith("/profil-pro")) return "profil";
  if (p.startsWith("/profil")) return "profil";
  return null;
}

const THEME_NAV_BG = {
  light: "rgba(255,255,255,0.98)",
  dark:  "rgba(26,26,46,0.98)",
  night: "rgba(0,0,0,0.98)",
};
const THEME_NAV_BORDER = {
  light: "rgba(0,0,0,0.06)",
  dark:  "rgba(255,255,255,0.08)",
  night: "rgba(255,255,255,0.05)",
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  // Détection pro centralisée (hooks/useIsPro.js) : `null` tant qu'inconnu.
  // Test strict — "0" (client en cache) est truthy en JS, d'où le `=== true`.
  const isPro = useIsPro() === true;
  const { theme } = useTheme();
  const { user } = useAuth();
  const [hasNewEvents, setHasNewEvents] = useState(false);

  // Check for new reservations/events since last visit
  useEffect(() => {
    if (!user?.email) return;
    const checkNewEvents = async () => {
      try {
        const lastVisitKey = isPro ? "bb_agenda_last_visit" : "bb_rdv_last_visit";
        const lastVisit = localStorage.getItem(lastVisitKey) || new Date(0).toISOString();
        
        const table = isPro ? "Reservation" : "Reservation";
        const emailField = isPro ? "pro_email" : "client_email";
        
        const { count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq(emailField, user.email)
          .gt("created_at", lastVisit);
        
        if (count && count > 0) {
          setHasNewEvents(true);
        }
      } catch (e) {
        console.error("Check new events error:", e);
      }
    };
    checkNewEvents();
    const interval = setInterval(checkNewEvents, 30000);
    return () => clearInterval(interval);
  }, [user?.email, isPro]);

  // Mark as visited when navigating to the page
  useEffect(() => {
    if (path === "/rendez-vous" || path === "/pro/gestion-agenda") {
      const lastVisitKey = isPro ? "bb_agenda_last_visit" : "bb_rdv_last_visit";
      localStorage.setItem(lastVisitKey, new Date().toISOString());
      setHasNewEvents(false);
    }
  }, [path, isPro]);

  const shouldHide = HIDDEN_PATHS.some(p => path.startsWith(p)) || path.includes("creer-bundle");
  if (shouldHide) return null;

  const iconClass = (active) =>
    cn("w-6 h-6 transition-colors", active ? "text-primary" : "text-gray-400");

  const currentTab = getTabForPath(path);

  // If tapping the already-active tab → reset to its root; otherwise navigate there
  const handleTabPress = (tabKey, rootPath) => {
    if (currentTab === tabKey && path !== rootPath) {
      // Reset to root of this tab
      navigate(rootPath, { replace: true, state: { from: path } });
    } else if (currentTab !== tabKey) {
      navigate(rootPath, { state: { from: path } });
    }
    // If already at root of active tab → do nothing (native behavior)
  };

  const labelClass = (active) =>
    cn("text-[9px] font-black uppercase tracking-widest transition-colors", active ? "text-primary" : "text-gray-400");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 backdrop-blur-2xl flex justify-around items-center z-[100] px-2"
      style={{
        background: THEME_NAV_BG[theme] || THEME_NAV_BG.light,
        borderTop: `1px solid ${THEME_NAV_BORDER[theme] || THEME_NAV_BORDER.light}`,
        boxShadow: "0 -8px 24px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 16px)",
        height: "calc(68px + env(safe-area-inset-bottom, 16px))",
      }}
    >
      <button
        onClick={() => handleTabPress("home", "/")}
        className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
      >
        <Home className={iconClass(currentTab === "home")} strokeWidth={currentTab === "home" ? 2.5 : 1.8} />
        <span className={labelClass(currentTab === "home")}>Accueil</span>
      </button>

      <button
        onClick={() => handleTabPress("services", "/services-salons")}
        data-tour="nav-explore"
        className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
      >
        <Scissors className={iconClass(currentTab === "services")} strokeWidth={currentTab === "services" ? 2.5 : 1.8} />
        <span className={labelClass(currentTab === "services")}>Services</span>
      </button>

      {/* Central AI button */}
      <div className="flex-1 flex flex-col justify-center items-center relative -mt-5 gap-1">
        <button onClick={() => handleTabPress("maria", "/maria")} className="group">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all ${
            currentTab === "maria"
              ? "bg-white border-[3px] border-primary shadow-xl shadow-primary/30"
              : "bg-gradient-to-br from-primary to-orange-600 border-4 border-white shadow-xl shadow-primary/40"
          }`}>
            <Bot className={`w-7 h-7 ${currentTab === "maria" ? "text-primary" : "text-white"}`} strokeWidth={1.8} />
          </div>
        </button>
        <span className={labelClass(currentTab === "maria")}>Maria</span>
      </div>

      <button
        onClick={() => handleTabPress("rendezvous", isPro ? "/pro/gestion-agenda" : "/rendez-vous")}
        data-tour="nav-rdv"
        className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all relative"
      >
        {hasNewEvents && (
          <div className="absolute top-1 right-1/2 translate-x-4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
        {isPro
          ? <LayoutDashboard className={iconClass(currentTab === "rendezvous")} strokeWidth={currentTab === "rendezvous" ? 2.5 : 1.8} />
          : <CalendarDays className={iconClass(currentTab === "rendezvous")} strokeWidth={currentTab === "rendezvous" ? 2.5 : 1.8} />
        }
        <span className={labelClass(currentTab === "rendezvous")}>{isPro ? "Agenda" : "RDV"}</span>
      </button>

      <button
        onClick={() => handleTabPress("profil", isPro ? "/profil-pro" : "/profil")}
        className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
      >
        <User className={iconClass(currentTab === "profil")} strokeWidth={currentTab === "profil" ? 2.5 : 1.8} />
        <span className={labelClass(currentTab === "profil")}>Profil</span>
      </button>
    </nav>
  );
}