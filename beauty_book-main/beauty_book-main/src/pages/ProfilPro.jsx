import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import {
  Settings, Share2, Star, Calendar, Users, LogOut,
  TrendingUp, Scissors, BarChart3, Camera, Moon,
  Wallet, ArrowLeft, Radio, UserCircle, Network, Scan, Menu,
  ChevronRight, Sparkles, Zap, Eye, FileText, Clapperboard, Building2
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";

const NIGHT_STORAGE_KEY = "bb_night_mode";

function getBannerGradient(theme) {
  if (theme === "night") return "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, #000000 100%)";
  if (theme === "dark")  return "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(26,26,46,0.75) 60%, #1a1a2e 100%)";
  return "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(255,255,255,0.25) 60%, #ffffff 100%)";
}

function getBannerFallback(theme) {
  if (theme === "night") return "linear-gradient(135deg, #1a1a2e 0%, #000000 50%, #16213e 100%)";
  if (theme === "dark")  return "linear-gradient(135deg, #1a1a2e 0%, #0f3460 50%, #1a1a2e 100%)";
  return "linear-gradient(135deg, #E8732A 0%, #f59540 40%, #f8b978 100%)";
}

function getPageBg(theme) {
  if (theme === "night") return "#000000";
  if (theme === "dark")  return "#1a1a2e";
  return "#ffffff";
}
import VueClient from "@/pages/pro/VueClient";
import ShareSheet from "@/components/ui/ShareSheet";

const quickActions = [
  { id: "beauty_pay", label: "BEAUTY PAY", Icon: Wallet, bg: "bg-gradient-to-br from-amber-50 to-orange-100", color: "text-amber-500", route: "/pro/beauty-pay", comingSoon: true },
  { id: "services", label: "SERVICES", Icon: Scissors, bg: "bg-gradient-to-br from-sky-50 to-blue-100", color: "text-sky-500", route: "/pro/catalogue-services" },
  { id: "avis", label: "AVIS CLIENTS", Icon: Star, bg: "bg-gradient-to-br from-emerald-50 to-green-100", color: "text-emerald-500", route: "/pro/avis-clients" },
  { id: "equipe", label: "ÉQUIPE", Icon: Users, bg: "bg-gradient-to-br from-violet-50 to-purple-100", color: "text-violet-500", route: "/pro/equipe" },
  { id: "analytics", label: "ANALYTICS", Icon: BarChart3, bg: "bg-gradient-to-br from-indigo-50 to-blue-100", color: "text-indigo-500", route: "/pro/analytics" },
  { id: "publication", label: "PUBLICATION", Icon: Camera, bg: "bg-gradient-to-br from-rose-50 to-pink-100", color: "text-rose-500", route: "/pro/publication" },
  { id: "visite3d", label: "VISITE VIRTUELLE", Icon: Eye, bg: "bg-gradient-to-br from-cyan-50 to-teal-100", color: "text-cyan-500", route: "/pro/visite-3d" },
  { id: "franchise", label: "FRANCHISE", Icon: Building2, bg: "bg-gradient-to-br from-purple-50 to-fuchsia-100", color: "text-purple-500", route: "/pro/franchise" },
];

export default function ProfilPro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  // Lecture synchrone du cache : la première peinture affiche déjà les vraies
  // données du salon (nom, avatar, ville, statut) au lieu d'une page
  // intermédiaire avec placeholders (« P », bannière documents, stats à 0).
  const readProCache = () => {
    try { return JSON.parse(localStorage.getItem('pro_profile_cache') || 'null'); }
    catch { return null; }
  };
  const [activeTab, setActiveTab] = useState("gestion");
  const [nightMode, setNightMode] = useState(() => localStorage.getItem(NIGHT_STORAGE_KEY) === "true");
  const [proInfo, setProInfo] = useState(() => readProCache());
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('pro_stats_cache') || 'null');
      if (cached && (!cached.user_email || cached.user_email === user?.email)) {
        return { rdvSemaine: cached.rdvSemaine || 0, nouveauxClients: cached.nouveauxClients || 0, caMonth: cached.caMonth || 0, caLastMonth: cached.caLastMonth || 0 };
      }
    } catch {}
    return { rdvSemaine: 0, nouveauxClients: 0, caMonth: 0, caLastMonth: 0 };
  });
  const [clientProfile, setClientProfile] = useState(null);
  const [demandeStatus, setDemandeStatus] = useState(() => {
    const cached = readProCache();
    return cached?.status === 'actif' ? 'approuvee' : null;
  });
  const nightModeSyncedRef = useRef(false);

  const loadProfil = () => {
    if (!user?.email) return;
    // Ne PAS réinitialiser proInfo à null : on garde les données affichées
    // pendant le rafraîchissement en arrière-plan (fini le flash de placeholders).

    const applyCache = (p) => {
      if (!p) return null;
      try {
        const cached = JSON.parse(localStorage.getItem('pro_profile_cache') || 'null');
        if (cached) {
          return { ...p, avatar_url: cached.avatar_url || p.avatar_url, cover_url: cached.cover_url || p.cover_url, salon_name: cached.salon_name || p.salon_name, bio: cached.bio || p.bio, city: cached.city || p.city, phone: cached.phone || p.phone, address: cached.address || p.address };
        }
      } catch {}
      return p;
    };

    // 1) Fetch ProfilPro — prefer active record, then latest with data
    supabase.from('ProfilPro').select('id, user_email, salon_name, phone, address, city, bio, avatar_url, cover_url, status, type_activite, travail_nuit, galerie_urls, rating, reviews_count').eq('user_email', user.email).order('created_at', { ascending: false })
      .then(({ data: profiles, error }) => {
        const all = profiles || [];
        if (all.length === 0) return null;
        // Priority: 1) actif with images, 2) actif, 3) any with images, 4) latest
        const activeWithImages = all.find(p => p.status === 'actif' && (p.avatar_url || p.cover_url));
        const active = all.find(p => p.status === 'actif');
        const withImages = all.find(p => p.avatar_url || p.cover_url);
        return activeWithImages || active || withImages || all[0];
      })
      .then((p) => {
        if (!p) {
          try {
            const cached = JSON.parse(localStorage.getItem('pro_profile_cache') || 'null');
            if (cached) p = { user_email: user.email, ...cached };
          } catch {}
        } else {
          try {
            const cached = JSON.parse(localStorage.getItem('pro_profile_cache') || 'null');
            if (cached) {
              p = { ...p, avatar_url: cached.avatar_url || p.avatar_url, cover_url: cached.cover_url || p.cover_url, salon_name: cached.salon_name || p.salon_name, bio: cached.bio || p.bio, city: cached.city || p.city, phone: cached.phone || p.phone, address: cached.address || p.address };
            }
          } catch {}
        }
        if (p) {
          setProInfo(p);
          // Cache enrichi (email + statut) : la prochaine ouverture affiche
          // directement les vraies données, sans page intermédiaire.
          try {
            localStorage.setItem('pro_profile_cache', JSON.stringify({
              user_email: user.email,
              salon_name: p.salon_name || '', phone: p.phone || '', address: p.address || '',
              city: p.city || '', bio: p.bio || '', avatar_url: p.avatar_url || '',
              cover_url: p.cover_url || '', status: p.status || '',
            }));
          } catch {}
          // Précharge l'avatar pour éviter son flash à l'affichage.
          if (p.avatar_url) { const img = new Image(); img.src = p.avatar_url; }
          if (!nightModeSyncedRef.current) {
            const dbVal = !!p.travail_nuit;
            setNightMode(dbVal);
            localStorage.setItem(NIGHT_STORAGE_KEY, String(dbVal));
            nightModeSyncedRef.current = true;
          }
        }
        if (p?.status === 'actif') setDemandeStatus('approuvee');
      })
      .catch(() => {});

    // 2) Fetch client profile for avatar/banner fallback
    supabase.from('profiles').select('avatar_url, cover_url').eq('email', user.email).maybeSingle()
      .then(({ data }) => { if (data) setClientProfile(data); })
      .catch(() => {});

    // 3) Fetch DemandeProV2 status for banner visibility
    entities.DemandeProV2.filter({ user_email: user.email }, '-created_at', 1)
      .then((rows) => {
        if (rows && rows.length > 0 && rows[0].statut === 'approuvee') {
          setDemandeStatus('approuvee');
        }
      })
      .catch(() => {});
  };

  const loadStats = async () => {
    if (!user?.email) return;
    const reservations = await entities.Reservation.filter({ pro_email: user.email }, "-date", 500).catch(() => []);
    const now = new Date();
    // RDV cette semaine
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const rdvSemaine = reservations.filter(r => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= weekStart && d <= weekEnd && r.status !== "annule";
    }).length;
    // Nouveaux clients ce mois (clients uniques)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const clientsThisMonth = new Set(reservations.filter(r => r.date && new Date(r.date) >= monthStart && r.status !== "annule").map(r => r.client_email));
    const clientsBeforeThisMonth = new Set(reservations.filter(r => r.date && new Date(r.date) < monthStart).map(r => r.client_email));
    const nouveauxClients = [...clientsThisMonth].filter(e => !clientsBeforeThisMonth.has(e)).length;
    // CA ce mois
    const caMonth = reservations.filter(r => r.date && new Date(r.date) >= monthStart && r.status === "termine").reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);
    // CA mois dernier
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const caLastMonth = reservations.filter(r => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= lastMonthStart && d <= lastMonthEnd && r.status === "termine";
    }).reduce((s, r) => s + (r.total_price || r.service_price || 0), 0);
    setStats({ rdvSemaine, nouveauxClients, caMonth, caLastMonth });
    // Cache des stats : la prochaine ouverture affiche directement les vrais
    // chiffres au lieu de 0 pendant le chargement.
    try {
      localStorage.setItem('pro_stats_cache', JSON.stringify({
        user_email: user.email, rdvSemaine, nouveauxClients, caMonth, caLastMonth,
      }));
    } catch {}
  };

  useEffect(() => {
    loadProfil();
    loadStats();
  }, [user, location.key]);

  useEffect(() => {
    const onUpdated = (e) => {
      const d = e.detail || {};
      if (d.avatar_url || d.cover_url) {
        setProInfo(prev => prev ? { ...prev, avatar_url: d.avatar_url || prev.avatar_url, cover_url: d.cover_url || prev.cover_url } : prev);
      }
      loadProfil();
      loadStats();
    };
    window.addEventListener('pro-profile-updated', onUpdated);
    return () => window.removeEventListener('pro-profile-updated', onUpdated);
  }, [user]);

  useEffect(() => {
    const handleFocus = () => { loadProfil(); loadStats(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") { loadProfil(); loadStats(); }
    });
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  // Ne jamais afficher les données d'un autre utilisateur (évite le flash).
  // Le cache enrichi porte user_email (contrôle strict) ; l'ancien format
  // sans email est accepté pour un affichage immédiat dès la première ouverture.
  const proInfoCurrent = (proInfo && (!proInfo.user_email || proInfo.user_email === user?.email)) ? proInfo : null;
  const nomCommerce = proInfoCurrent?.salon_name || "";

  if (activeTab === "client") {
    // Aperçu "Vue client" du pro : on passe explicitement son email pour charger
    // son vrai profil (stats, badges, services) au lieu d'une page vide 0;0;0.
    return <VueClient onClose={() => setActiveTab("gestion")} proEmail={user?.email} />;
  }

  // ── Menu latéral : entrées regroupées par usage ──
  const menuSections = [
    {
      title: "Pilotage",
      items: [
        { id: "agenda", label: "Agenda", Icon: Calendar, tile: "bg-teal-400/15", iconColor: "text-teal-300", route: "/pro/gestion-agenda" },
        { id: "services", label: "Services", Icon: Scissors, tile: "bg-sky-400/15", iconColor: "text-sky-300", route: "/pro/catalogue-services" },
        { id: "avis", label: "Avis clients", Icon: Star, tile: "bg-emerald-400/15", iconColor: "text-emerald-300", route: "/pro/avis-clients" },
        { id: "analytics", label: "Analytics", Icon: BarChart3, tile: "bg-indigo-400/15", iconColor: "text-indigo-300", route: "/pro/analytics" },
      ],
    },
    {
      title: "Contenu",
      items: [
        { id: "publication", label: "Publication", Icon: Camera, tile: "bg-rose-400/15", iconColor: "text-rose-300", route: "/pro/publication" },
        { id: "lancer_direct", label: "Lancer un direct", Icon: Clapperboard, tile: "bg-pink-400/15", iconColor: "text-pink-300", route: "/pro/lancer-direct" },
        { id: "visite3d", label: "Visite virtuelle", Icon: Eye, tile: "bg-cyan-400/15", iconColor: "text-cyan-300", route: "/pro/visite-3d" },
      ],
    },
    {
      title: "Mon salon",
      items: [
        { id: "equipe", label: "Équipe", Icon: Users, tile: "bg-violet-400/15", iconColor: "text-violet-300", route: "/pro/equipe" },
        { id: "franchise", label: "Franchise", Icon: Building2, tile: "bg-purple-400/15", iconColor: "text-purple-300", route: "/pro/franchise" },
        { id: "beauty_pay", label: "Beauty Pay", Icon: Wallet, tile: "bg-amber-400/15", iconColor: "text-amber-300", route: "/pro/beauty-pay", comingSoon: true },
        { id: "modifier_profil", label: "Modifier profil", Icon: UserCircle, tile: "bg-slate-400/15", iconColor: "text-slate-300", route: "/pro/parametres" },
        { id: "parametres_pro", label: "Paramètres", Icon: Settings, tile: "bg-slate-400/15", iconColor: "text-slate-300", route: "/pro/parametres" },
      ],
    },
  ];
  const drawerBg = theme === "night" ? "#05070c" : theme === "dark" ? "#0c1322" : "#101a33";

  return (
    <div className="font-display pb-4 min-h-full" style={{ background: getPageBg(theme) }}>

      {/* ── Menu Drawer ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[400] flex" onClick={() => setMenuOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Drawer */}
          <div
            className="relative w-[84vw] max-w-[340px] h-full shadow-2xl flex flex-col overflow-hidden"
            style={{
              background: drawerBg,
              animation: "slideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-5 pt-12 pb-6 overflow-hidden shrink-0">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-orange-500/25 blur-3xl pointer-events-none" />
              <div className="absolute -top-16 -left-20 w-56 h-56 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-[20px] overflow-hidden ring-2 ring-white/25 shadow-xl bg-gradient-to-br from-orange-500 to-rose-600">
                    {proInfoCurrent?.avatar_url || clientProfile?.avatar_url ? (
                      <BeautyImage src={proInfoCurrent?.avatar_url || clientProfile?.avatar_url} alt="profil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black text-2xl">{nomCommerce?.[0]?.toUpperCase() || "P"}</div>
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-black/50 flex items-center justify-center ${proInfoCurrent?.status === 'actif' ? "bg-emerald-400" : "bg-amber-400"}`}>
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[18px] font-extrabold leading-tight truncate">{nomCommerce}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="px-2.5 py-0.5 bg-orange-500 rounded-full text-white text-[10px] font-black uppercase tracking-widest">Pro</span>
                    {proInfoCurrent?.city && (
                      <span className="text-white/50 text-[12px] font-medium truncate">{proInfoCurrent.city}</span>
                    )}
                    {proInfoCurrent?.rating > 0 && (
                      <span className="flex items-center gap-1 text-amber-300 text-[12px] font-bold">
                        <Star className="w-3 h-3 fill-amber-300" />{proInfoCurrent.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
              {menuSections.map((section, si) => (
                <div key={section.title} className="mb-5">
                  <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{section.title}</p>
                  <div>
                    {section.items.map(({ id, label, Icon, tile, iconColor, route, comingSoon }, ii) => (
                      <button
                        key={id}
                        onClick={() => {
                          setMenuOpen(false);
                          if (comingSoon) {
                            setTimeout(() => alert("Bientôt disponible !"), 200);
                            return;
                          }
                          navigate(route);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.07] active:scale-[0.98] active:bg-white/[0.1] transition-all duration-150 text-left group"
                        style={{ animation: "fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${(si * 4 + ii) * 40}ms` }}
                      >
                        <div className={`w-11 h-11 ${tile} rounded-xl flex items-center justify-center shrink-0`}>
                          <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} />
                        </div>
                        <span className="flex-1 text-[14px] font-semibold text-white/90">{label}</span>
                        {comingSoon ? (
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-300 bg-amber-400/15 px-2.5 py-1 rounded-full">Bientôt</span>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Logout */}
            <div className="px-4 pb-6 pt-3 border-t border-white/10 shrink-0">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  localStorage.removeItem("bb_is_pro");
                  supabase.auth.signOut().then(() => window.location.href = "/");
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-red-500/10 active:scale-[0.98] transition-all duration-150 group"
              >
                <div className="w-11 h-11 bg-red-500/15 rounded-xl flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5 text-red-400" strokeWidth={2} />
                </div>
                <span className="text-[14px] font-semibold text-red-400">Se déconnecter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={nomCommerce + " – BeautyBook"}
        url={window.location.origin + "/profil-pro"}
      />

      {/* Banner + Profile Photo */}
      <div className="relative h-52">
        {proInfoCurrent?.cover_url || clientProfile?.cover_url ? (
          <>
            <BeautyImage src={proInfoCurrent?.cover_url || clientProfile?.cover_url} alt="Bannière" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: getBannerGradient(theme) }} />
          </>
        ) : (
          <div className="w-full h-full" style={{ background: getBannerFallback(theme) }} />
        )}

        {/* Top Buttons */}
        {(() => {
          const isDark = theme === "dark" || theme === "night";
          const btnBg = isDark ? "bg-gray-900/90 border border-gray-700" : "bg-white/95";
          const btnIcon = isDark ? "text-gray-200" : "text-gray-800";
          return (
            <div className="absolute top-4 left-0 right-0 px-5 flex items-center justify-between z-10">
              <button
                onClick={() => setMenuOpen(true)}
                className={`w-11 h-11 ${btnBg} rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200`}
              >
                <Menu className={`w-5 h-5 ${btnIcon}`} strokeWidth={2.5} />
              </button>

              <button onClick={() => navigate("/pro/abonnements")} className={`px-5 py-2.5 rounded-full flex items-center gap-2 shadow-lg active:scale-95 transition-all ${isDark ? "bg-primary/90 shadow-primary/20" : "bg-primary shadow-primary/30"}`}>
                <span className="text-white text-[12px] font-black uppercase tracking-wider">⭐ Abonnements</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShareOpen(true)}
                  className={`w-10 h-10 ${btnBg} rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all`}>
                  <Share2 className={`w-4 h-4 ${btnIcon}`} />
                </button>
                <button onClick={() => navigate("/pro/parametres")} className={`w-10 h-10 ${btnBg} rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all`}>
                  <Settings className={`w-4 h-4 ${btnIcon}`} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Profile Photo */}
        <div className="absolute -bottom-12 left-5">
          <div className="relative">
            <div className="w-[100px] h-[100px] rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-100">
              {proInfoCurrent?.avatar_url || clientProfile?.avatar_url ? (
                <BeautyImage src={proInfoCurrent?.avatar_url || clientProfile?.avatar_url} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 font-black text-3xl">{nomCommerce?.[0]?.toUpperCase() || "P"}</div>
              )}
            </div>
            <div className={`absolute bottom-1 right-1 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow ${proInfoCurrent?.status === 'actif' ? "bg-green-500" : "bg-orange-400"}`}>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="px-5 pt-14 pb-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-[24px] font-black text-gray-900 leading-tight">
              {nomCommerce}
            </h1>
            <div className="flex items-center gap-2">
              {proInfoCurrent?.rating > 0 && (
                <div className="flex items-center gap-1 text-primary">
                  <Star className="w-4 h-4" />
                  <span className="text-[14px] font-black">{proInfoCurrent.rating}</span>
                  {proInfoCurrent?.reviews_count > 0 && (
                    <span className="text-[11px] text-gray-400 font-medium">({proInfoCurrent.reviews_count})</span>
                  )}
                </div>
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              <span className="text-[13px] font-bold text-gray-500">{proInfoCurrent?.city || "Paris"}</span>
              {proInfoCurrent?.type_activite && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-primary border border-orange-100">
                    {proInfoCurrent.type_activite === "Salon" ? "Salon professionnel" : proInfoCurrent.type_activite}
                  </span>
                </>
              )}
            </div>
          </div>
          <span className="mt-1 bg-gray-100 text-gray-500 text-[11px] font-black px-3 py-1 rounded-lg uppercase tracking-wider">PRO</span>
        </div>

        {/* Pending Alert — affiché uniquement si on SAIT que les documents sont
            en attente (statut connu non-actif ou demande non approuvée).
            Quand le statut est encore inconnu (chargement), on n'affiche rien
            pour éviter le flash de la bannière chez les pros validés. */}
        {((proInfoCurrent?.status && proInfoCurrent.status !== 'actif') || (demandeStatus && demandeStatus !== 'approuvee')) && (
          <div className="flex gap-3 bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <div className="w-8 h-8 shrink-0 bg-orange-100 rounded-xl flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-black text-primary uppercase tracking-widest block leading-tight">Documents en attente de validation</span>
              <span className="text-[12px] text-orange-600 font-medium block mt-0.5 leading-snug">Votre espace sera visible par les clients après validation.</span>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => setActiveTab("gestion")}
            className={`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all ${
              activeTab === "gestion" ? "bg-white text-primary shadow-sm" : "text-gray-400"
            }`}
          >
            Ma Gestion
          </button>
          <button
            onClick={() => setActiveTab("client")}
            className={`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all ${
              activeTab === "client" ? "bg-white text-primary shadow-sm" : "text-gray-400"
            }`}
          >
            Vue Client
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-5 pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col justify-between min-h-[110px]">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="text-4xl font-black text-gray-900 leading-none">{stats.rdvSemaine}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1.5">Rdv cette semaine</p>
            </div>
          </div>
          <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col justify-between min-h-[110px]">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-4xl font-black text-gray-900 leading-none">{stats.nouveauxClients}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1.5">Nouveaux clients</p>
            </div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className={`rounded-3xl p-5 shadow-lg ${theme === "night" ? "bg-gray-950 border border-gray-800" : theme === "dark" ? "bg-[#12152a] border border-gray-700" : "bg-[#1a2035]"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chiffre d'affaires</span>
            </div>
            <button className="px-3 py-1.5 bg-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-wider">Ce mois</button>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[42px] font-black text-white leading-none">{stats.caMonth} €</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[12px] font-bold text-green-400">
                  {(() => {
                    if (stats.caLastMonth > 0) {
                      const pct = Math.round(((stats.caMonth - stats.caLastMonth) / stats.caLastMonth) * 100);
                      return `${pct > 0 ? "+" : ""}${pct}%`;
                    }
                    return stats.caMonth > 0 ? "+100%" : "+0%";
                  })()} vs mois dernier
                </span>
              </div>
            </div>
            <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/40">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        {/* Night Mode Toggle */}
        <div className="bg-indigo-50 rounded-3xl p-4 flex items-center gap-4 border border-indigo-100">
          <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
            <Moon className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-black text-indigo-700">Mode Nuit (09h–07h)</p>
            <p className="text-[11px] font-medium text-indigo-400 mt-0.5">Tarification nocturne active (+15min)</p>
          </div>
          <button
            onClick={async () => {
              const next = !nightMode;
              setNightMode(next);
              localStorage.setItem(NIGHT_STORAGE_KEY, String(next));
              setProInfo(prev => prev ? { ...prev, travail_nuit: next } : prev);
              if (user?.email) {
                const { error } = await supabase.from('ProfilPro').update({ travail_nuit: next }).eq('user_email', user.email);
                if (error) {
                  console.error('[ProfilPro] Mode Nuit save error:', error.message);
                }
              }
            }}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${nightMode ? "bg-indigo-500" : "bg-gray-200"}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${nightMode ? "translate-x-7" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Gestion Rapide */}
        <div className="space-y-3">
          <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-widest px-1">Gestion Rapide</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.Icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    if (action.comingSoon) {
                      alert("Bientôt disponible !");
                      return;
                    }
                    action.route && navigate(action.route);
                  }}
                  className={`bg-white border border-gray-100 rounded-3xl py-7 px-4 flex flex-col items-center gap-3 shadow-sm active:scale-95 transition-all ${action.comingSoon ? "opacity-60" : ""}`}
                >
                  <div className={`w-14 h-14 ${action.bg} rounded-2xl flex items-center justify-center`}>
                    <Icon className={`w-7 h-7 ${action.color}`} />
                  </div>
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest text-center">{action.label}</span>
                  {action.comingSoon && (
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Bientôt</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* CTA Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={() => navigate("/pro/lancer-direct")} className="bg-primary rounded-3xl py-7 px-4 flex flex-col items-center gap-3 shadow-lg shadow-primary/40 active:scale-95 transition-all">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Radio className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Lancer un Direct</span>
            </button>
            <button onClick={() => navigate("/pro/parametres")} className="bg-gray-900 rounded-3xl py-7 px-4 flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-all">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                <UserCircle className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Modifier Profil Pro</span>
            </button>
          </div>
        </div>



        {/* Logout */}
        <button
          onClick={() => { localStorage.removeItem("bb_is_pro"); supabase.auth.signOut().then(() => window.location.href = "/"); }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors active:scale-95 text-[12px] font-black uppercase tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}