import { supabase } from '@/api/supabaseClient';
import { Operations } from '@/components/admin/AdminManagement';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminGuard from "@/components/admin/AdminGuard";
import AdminReels from "@/components/admin/AdminReels";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminServices from "@/components/admin/AdminServices";
import AdminCommandes from "@/components/admin/AdminCommandes";
import AdminReservations from "@/components/admin/AdminReservations";
import AdminAnnonces from "@/components/admin/AdminAnnonces";
import AdminStats from "@/components/admin/AdminStats";
import AdminPublications from "@/components/admin/AdminPublications";
import AdminLives from "@/components/admin/AdminLives";
import AdminStyles from "@/components/admin/AdminStyles";
import AdminProsRequests from "@/components/admin/AdminProsRequests";
import AdminNotifications from "@/components/admin/AdminNotifications";
import AdminAvis from "@/components/admin/AdminAvis";
import AdminHomePage from "@/components/admin/AdminHomePage";
import AdminLivraisonExpress from "@/components/admin/AdminLivraisonExpress";
import AdminImmobilier from "@/components/admin/AdminImmobilier";
import AdminSiteWeb from "@/components/admin/AdminSiteWeb";
import AdminExplorer from "@/components/admin/AdminExplorer";
import AdminVendeurs from "@/components/admin/AdminVendeurs";
import AdminBoutique from "@/components/admin/AdminBoutique";
import AdminPaiement from "@/components/admin/AdminPaiement";
import AdminAppearance from "@/components/admin/AdminAppearance";
import AdminMessages from "@/components/admin/AdminMessages";
import AdminFidelite from "@/components/admin/AdminFidelite";
import {
  LayoutDashboard, Video, Users, Scissors, ShoppingBag,
  CalendarCheck, Megaphone, LogOut, Menu, X, PlusSquare,
  Radio, Palette, UserCheck, Bell, Star, Home, ChevronRight,
  BookOpen, Truck, Building2, Compass, Store, ShoppingBasket, CreditCard, Type, MessageSquare, Gift, ShieldCheck, Globe2
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Vue d'ensemble",
    items: [
      { id: "stats", label: "Tableau de bord", icon: LayoutDashboard },
    ]
  },
  {
    label: "Contenu",
    items: [
      { id: "home", label: "Page d'accueil", icon: Home },
      { id: "styles", label: "Styles", icon: Palette },
      { id: "publications", label: "Publications", icon: PlusSquare },
      { id: "reels", label: "Modération Réels", icon: Video },
      { id: "lives", label: "Lives / Directs", icon: Radio },
      { id: "annonces", label: "Annonces pub", icon: Megaphone },
      { id: "explorer", label: "Explorer (Styles)", icon: Compass },
    ]
  },
  {
    label: "Utilisateurs",
    items: [
      { id: "users", label: "Utilisateurs", icon: Users },
      { id: "pros", label: "Demandes Pros", icon: UserCheck, badge: true },
      { id: "avis", label: "Avis & Commentaires", icon: Star },
      { id: "messages", label: "Messages", icon: MessageSquare, badge: true },
      { id: "notifications", label: "Notifications", icon: Bell },
    ]
  },
  {
    label: "Business",
    items: [
      { id: "services", label: "Services", icon: Scissors },
      { id: "commandes", label: "Commandes", icon: ShoppingBag },
      { id: "reservations", label: "Réservations", icon: CalendarCheck },
      { id: "boutique", label: "Boutique Produits", icon: ShoppingBasket },
      { id: "livraison_express", label: "Livraison Express", icon: Truck },
      { id: "immobilier", label: "Immobilier", icon: Building2 },
      { id: "siteweb", label: "Créateur de site web", icon: Globe2 },
      { id: "vendeurs", label: "Panneau Vendeurs", icon: Store },
    ]
  },
  {
    label: "Fidélité",
    items: [
      { id: "fidelite", label: "Programme Fidélité", icon: Gift },
    ]
  },
  {
    label: "Paramètres",
    items: [
      { id: "operations", label: "État des traitements", icon: ShieldCheck },
      { id: "paiement", label: "Paiement & Abonnements", icon: CreditCard },
      { id: "appearance", label: "Police & Icônes", icon: Type },
    ]
  },
];

const ALL_TABS = NAV_GROUPS.flatMap(g => g.items);

const COMPONENTS = {
  operations: Operations,
  stats: AdminStats,
  home: AdminHomePage,
  styles: AdminStyles,
  publications: AdminPublications,
  reels: AdminReels,
  lives: AdminLives,
  annonces: AdminAnnonces,
  users: AdminUsers,
  pros: AdminProsRequests,
  avis: AdminAvis,
  messages: AdminMessages,
  notifications: AdminNotifications,
  services: AdminServices,
  commandes: AdminCommandes,
  reservations: AdminReservations,
  boutique: AdminBoutique,
  livraison_express: AdminLivraisonExpress,
  immobilier: AdminImmobilier,
  siteweb: AdminSiteWeb,
  explorer: AdminExplorer,
  vendeurs: AdminVendeurs,
  paiement: AdminPaiement,
  appearance: AdminAppearance,
  fidelite: AdminFidelite,
};

const TAB_DESCRIPTIONS = {
  stats: "Vue d'ensemble de la plateforme BeautyBook",
  home: "Personnalisez le contenu de votre page d'accueil",
  styles: "Gérez les styles publiés sur Services & Salons",
  pros: "Approuvez ou rejetez les demandes de profils professionnels",
  notifications: "Envoyez des notifications push à vos utilisateurs",
  avis: "Modérez les avis et commentaires de la plateforme",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("stats");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiError,setApiError]=useState('');
  useEffect(()=>{const report=e=>setApiError(e.detail);window.addEventListener('bb:api-error',report);return()=>window.removeEventListener('bb:api-error',report);},[]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("bb_admin_auth");
    sessionStorage.removeItem("bb_admin_token");
    navigate("/admin");
  };

  const ActiveComponent = COMPONENTS[activeTab] || AdminStats;
  const activeLabel = ALL_TABS.find(t => t.id === activeTab)?.label || "";

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 flex font-display">

        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ── */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>

          {/* Logo */}
          <div className="px-5 py-5 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/30">
                <span className="text-white text-[15px] font-black">B</span>
              </div>
              <div>
                <h1 className="text-gray-900 text-[15px] font-black leading-tight">BeautyBook</h1>
                <p className="text-gray-400 text-[10px] font-medium">Admin Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-gray-400 text-[12px]">Rechercher...</span>
            </div>
          </div>

          {/* Nav groupée */}
          <nav className="flex-1 overflow-y-auto py-3">
            {NAV_GROUPS.map(group => (
              <div key={group.label} className="mb-1">
                <p className="px-5 py-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{group.label}</p>
                {group.items.map(({ id, label, icon: Icon, badge }) => (
                  <button
                    key={id}
                    onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                    className={`w-[calc(100%-8px)] mx-1 flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all group ${
                      activeTab === id
                        ? "bg-primary/10 text-primary font-black"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${activeTab === id ? "text-primary" : "text-gray-400 group-hover:text-gray-600"}`} />
                    <span className="flex-1 text-left">{label}</span>
                    {badge && activeTab !== id && (
                      <span className="w-2 h-2 bg-amber-400 rounded-full shrink-0" />
                    )}
                    {activeTab === id && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* User + Logout */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-[12px] font-black shrink-0">B</div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[12px] font-black truncate">Admin BeautyBook</p>
                <p className="text-gray-400 text-[10px]">Super Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-bold text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Topbar */}
          <header className="bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between lg:px-6 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700 p-1">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-gray-400 font-medium hidden sm:block">Tableau de bord</span>
                <span className="text-gray-300 hidden sm:block">/</span>
                <span className="text-gray-900 font-black">{activeLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173", "_blank", "noopener,noreferrer")}
                className="hidden sm:flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Ouvrir l'app
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
              >
                <Bell className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-[12px] font-black">B</div>
            </div>
          </header>

          {/* Page title bar */}
          <div className="bg-white border-b border-gray-100 px-4 py-4 lg:px-6 shrink-0">
            <h1 className="text-gray-900 text-[20px] font-black">{activeLabel}</h1>
            {TAB_DESCRIPTIONS[activeTab] && (
              <p className="text-gray-400 text-[12px] mt-0.5">{TAB_DESCRIPTIONS[activeTab]}</p>
            )}
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-50">
            {apiError&&<div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{apiError}<button className="ml-3 underline" onClick={()=>setApiError('')}>Fermer</button></div>}
            <ActiveComponent />
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}