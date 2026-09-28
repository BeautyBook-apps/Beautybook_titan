import BeautyImage from '@/components/ui/BeautyImage';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Shield, CreditCard, Bell, Globe, HelpCircle, Mail, Lock, FileText, LogOut, ChevronRight, BadgeCheck, Scissors, BarChart2, Star, RefreshCw, UserPlus, Trash2, Moon, Sun, Download } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import DeleteAccountFlow from "@/components/account/DeleteAccountFlow";
import { readIsProCache } from "@/hooks/useIsPro";
import { useTheme, useThemeBg } from "@/hooks/useTheme";

const DEFAULT_AVATAR = "";

function SettingRow({ icon: Icon, iconBg, iconColor, label, sublabel, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-white rounded-2xl px-4 py-4 active:scale-[0.99] transition-all"
    >
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 text-left">
        <p className={`text-[15px] font-bold ${danger ? "text-red-500" : "text-gray-900"}`}>{label}</p>
        {sublabel && <p className="text-[12px] text-gray-400 font-medium mt-0.5">{sublabel}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-black text-primary uppercase tracking-widest px-1 mb-2 mt-5">{children}</p>
  );
}

export default function Parametres() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAccountSwitch, setShowAccountSwitch] = useState(false);
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const { theme, setTheme } = useTheme();
  const themeBg = useThemeBg();

  // Récupérer les comptes sauvegardés sur l'appareil
  const savedAccounts = JSON.parse(localStorage.getItem("bb_saved_accounts") || "[]");
  // Sauvegarder le compte courant si pas déjà dedans
  if (user?.email && !savedAccounts.find(a => a.email === user.email)) {
    savedAccounts.push({ email: user.email, name: user.username || user.email });
    localStorage.setItem("bb_saved_accounts", JSON.stringify(savedAccounts));
  }
  const otherAccounts = savedAccounts.filter(a => a.email !== user?.email);

  const handleSwitchAccount = (account) => {
    // Sauvegarder l'email cible et déconnecter pour relogin
    localStorage.setItem("bb_switch_to", account.email);
    supabase.auth.signOut().then(() => window.location.href = "/");
  };

  return (
    <div className="font-display" style={{ minHeight: "100dvh", background: themeBg }}>

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Paramètres</h1>
      </div>

      <div className="px-4" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>

        {/* User card */}
        <div className="bg-white rounded-3xl p-5 mt-4 flex flex-col items-center text-center gap-2 shadow-sm">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-primary">
              <BeautyImage src={user?.avatar_url || DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white text-[10px] font-black">✓</span>
            </div>
          </div>
          <div>
            <p className="text-[18px] font-black text-gray-900">@{user?.username || user?.email?.split("@")[0] || "beautybook"}</p>
          </div>
        </div>

        {/* CONFIGURATION DU COMPTE */}
        <SectionLabel>Configuration du compte</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={User} iconBg="bg-orange-50" iconColor="text-primary" label="Modifier le profil" onClick={() => navigate("/modifier-profil-client")} />
          <SettingRow icon={Shield} iconBg="bg-purple-50" iconColor="text-purple-500" label="Sécurité" sublabel="Mot de passe, Face ID, appareils" onClick={() => navigate("/parametres/securite")} />
          <SettingRow icon={CreditCard} iconBg="bg-blue-50" iconColor="text-blue-500" label="Paiement" sublabel="Cartes, Apple Pay, Google Pay" onClick={() => navigate("/parametres/paiement")} />
        </div>

        {/* PRÉFÉRENCES */}
        <SectionLabel>Préférences</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={Bell} iconBg="bg-yellow-50" iconColor="text-yellow-500" label="Notifications" sublabel="Rendez-vous, messages, promos" onClick={() => navigate("/parametres/notifications")} />
          <SettingRow icon={Globe} iconBg="bg-teal-50" iconColor="text-teal-500" label="Langue & Monnaie" sublabel="Français · Euro (€)" onClick={() => navigate("/parametres/langue")} />
          <SettingRow icon={Lock} iconBg="bg-green-50" iconColor="text-green-500" label="Confidentialité" sublabel="Visibilité, données, RGPD" onClick={() => navigate("/parametres/confidentialite")} />

          {/* Thème */}
          <div className="w-full flex flex-col gap-3 bg-white rounded-2xl px-4 py-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === "night" ? "bg-black" : theme === "dark" ? "bg-gray-800" : "bg-amber-50"}`}>
                {theme === "light" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-bold text-gray-900">Thème</p>
                <p className="text-[12px] text-gray-400 font-medium mt-0.5">
                  {theme === "light" ? "Mode clair" : theme === "dark" ? "Mode sombre" : "Mode nuit (noir)"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95 ${theme === "light" ? "border-amber-400 bg-amber-50" : "border-gray-100 bg-gray-50"}`}
              >
                <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
                  <Sun className="w-4 h-4 text-amber-500" />
                </div>
                <span className={`text-[11px] font-black ${theme === "light" ? "text-amber-500" : "text-gray-400"}`}>Clair</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95 ${theme === "dark" ? "border-indigo-500 bg-gray-800" : "border-gray-100 bg-gray-50"}`}
              >
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                  <Moon className="w-4 h-4 text-indigo-300" />
                </div>
                <span className={`text-[11px] font-black ${theme === "dark" ? "text-indigo-300" : "text-gray-400"}`}>Sombre</span>
              </button>
              <button
                onClick={() => setTheme("night")}
                className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95 ${theme === "night" ? "border-white bg-black" : "border-gray-100 bg-gray-50"}`}
              >
                <div className="w-8 h-8 bg-black border border-gray-700 rounded-full flex items-center justify-center">
                  <Moon className="w-4 h-4 text-white" />
                </div>
                <span className={`text-[11px] font-black ${theme === "night" ? "text-white" : "text-gray-400"}`}>Nuit</span>
              </button>
            </div>
          </div>
        </div>

        {/* ASSISTANCE ET LÉGAL */}
        <SectionLabel>Assistance et légal</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={HelpCircle} iconBg="bg-orange-50" iconColor="text-primary" label="Centre d'aide" sublabel="FAQ et support" onClick={() => navigate("/parametres/aide")} />
          <SettingRow icon={FileText} iconBg="bg-gray-100" iconColor="text-gray-500" label="Conditions Générales" sublabel="CGU et conditions d'utilisation" onClick={() => navigate("/parametres/conditions")} />
          <SettingRow icon={Shield} iconBg="bg-blue-50" iconColor="text-blue-500" label="Politique de Confidentialité" sublabel="RGPD, données, droits" onClick={() => navigate("/parametres/politique-confidentialite")} />
          <SettingRow icon={Lock} iconBg="bg-green-50" iconColor="text-green-500" label="Mentions Légales" sublabel="Éditeur, hébergeur, contact" onClick={() => navigate("/parametres/mentions-legales")} />
          <SettingRow icon={Download} iconBg="bg-indigo-50" iconColor="text-indigo-500" label="Mes Données" sublabel="Exporter mes données (RGPD)" onClick={() => navigate("/parametres/mes-donnees")} />
        </div>

        {/* COMPTE PRO — test strict : "0" (client) est truthy en JS, d'où readIsProCache */}
        {readIsProCache() === true && (
          <>
            <SectionLabel>Compte Professionnel</SectionLabel>
            <div className="space-y-2">
              <SettingRow icon={BadgeCheck} iconBg="bg-orange-50" iconColor="text-primary"
                label="Espace Pro" sublabel="Gérer mon salon & prestations"
                onClick={() => navigate("/profil-pro")} />
              <SettingRow icon={Scissors} iconBg="bg-blue-50" iconColor="text-blue-500"
                label="Services & Tarifs" sublabel="Catalogue des prestations"
                onClick={() => navigate("/pro/catalogue-services")} />
              <SettingRow icon={BarChart2} iconBg="bg-indigo-50" iconColor="text-indigo-500"
                label="Analytics & Stats" sublabel="Performance et revenus"
                onClick={() => navigate("/pro/analytics")} />
              <SettingRow icon={Star} iconBg="bg-yellow-50" iconColor="text-yellow-500"
                label="Abonnement Pro" sublabel="Gérer mon plan BeautyBook Pro"
                onClick={() => navigate("/pro/abonnements")} />
              <SettingRow icon={BadgeCheck} iconBg="bg-gray-100" iconColor="text-gray-600"
                label="Paramètres Pro complets" sublabel="Toutes les options professionnelles"
                onClick={() => navigate("/pro/parametres")} />
            </div>
          </>
        )}

        {/* CHANGER DE COMPTE */}
        <SectionLabel>Compte</SectionLabel>
        <div className="space-y-2">
          <SettingRow
            icon={RefreshCw} iconBg="bg-blue-50" iconColor="text-blue-500"
            label="Changer de compte"
            sublabel={otherAccounts.length > 0 ? `${otherAccounts.length} autre${otherAccounts.length > 1 ? "s" : ""} compte${otherAccounts.length > 1 ? "s" : ""} détecté${otherAccounts.length > 1 ? "s" : ""}` : "Aucun autre compte sur cet appareil"}
            onClick={() => {
              if (otherAccounts.length > 0) setShowAccountSwitch(true);
              else { localStorage.removeItem("bb_onboarded"); supabase.auth.signOut().then(() => window.location.href = "/"); }
            }}
          />
          <SettingRow icon={UserPlus} iconBg="bg-green-50" iconColor="text-green-500" label="Ajouter un compte" sublabel="Se connecter avec un autre email" onClick={() => { localStorage.removeItem("bb_onboarded"); supabase.auth.signOut().then(() => window.location.href = "/"); }} />
        </div>

        {/* Modal switch de compte */}
        {showAccountSwitch && (
          <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setShowAccountSwitch(false)}>
            <div className="bg-white rounded-t-3xl w-full px-5 pb-10 pt-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <h3 className="text-[18px] font-black text-gray-900 mb-1">Changer de compte</h3>
              <p className="text-[12px] text-gray-400 font-medium mb-5">Sélectionnez un compte sur cet appareil</p>
              <div className="space-y-3">
                {otherAccounts.map(acc => (
                  <button key={acc.email} onClick={() => handleSwitchAccount(acc)}
                    className="w-full flex items-center gap-4 bg-gray-50 rounded-2xl p-4 active:scale-[0.99] transition-all">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-[18px] font-black text-primary">{(acc.name || acc.email)[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[15px] font-black text-gray-900">{acc.name || acc.email}</p>
                      <p className="text-[12px] text-gray-400 font-medium">{acc.email}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
                <button onClick={() => { setShowAccountSwitch(false); localStorage.removeItem("bb_onboarded"); supabase.auth.signOut().then(() => window.location.href = "/"); }}
                  className="w-full flex items-center gap-4 bg-blue-50 rounded-2xl p-4 active:scale-[0.99] transition-all">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] font-black text-blue-600">Ajouter un nouveau compte</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Supprimer le compte */}
        <div className="mt-6 mb-3">
          <button
            onClick={() => setShowDeleteFlow(true)}
            className="w-full bg-white border border-red-100 rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span className="text-[15px] font-bold text-red-400">Supprimer mon compte</span>
          </button>
        </div>

        {showDeleteFlow && <DeleteAccountFlow onClose={() => setShowDeleteFlow(false)} />}

        {/* Déconnexion */}
        <div className="mt-2">
          <button
            onClick={() => {
              localStorage.removeItem("bb_onboarded");
              supabase.auth.signOut().then(() => window.location.href = "/onboarding");
            }}
            className="w-full bg-red-50 border border-red-100 rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="text-[15px] font-bold text-red-400">Déconnexion</span>
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-300 font-medium mt-6">BeautyBook v2.4.1 · Tous droits réservés</p>
      </div>
    </div>
  );
}
