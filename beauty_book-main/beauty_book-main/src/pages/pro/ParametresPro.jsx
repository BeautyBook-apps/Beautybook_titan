import BeautyImage from '@/components/ui/BeautyImage';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Shield, CreditCard, Bell, Globe, HelpCircle,
  Mail, FileText, LogOut, ChevronRight, Scissors, BarChart2,
  Users, Clock, Megaphone, Star, Network, Scan, Radio,
  Store, Lock, Info, Trash2, Sun, Moon
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import DeleteAccountFlow from "@/components/account/DeleteAccountFlow";
import { useTheme, useThemeBg } from "@/hooks/useTheme";

function SettingRow({ icon: Icon, iconBg, iconColor, label, sublabel, onClick, danger, badge }) {
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
      {badge && (
        <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full mr-1">{badge}</span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-black text-primary uppercase tracking-widest px-1 mb-2 mt-5">{children}</p>
  );
}

export default function ParametresPro() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const { theme, setTheme } = useTheme();
  const themeBg = useThemeBg();

  const memberSince = user?.created_date
    ? new Date(user.created_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
    : "2024";

  return (
    <div className="font-display min-h-full" style={{ background: themeBg }}>

      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Paramètres Pro</h1>
      </div>

      <div className="px-4 pb-28">

        {/* Pro card */}
        <div className="bg-[#1a2035] rounded-3xl p-5 mt-4 flex items-center gap-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-700 shrink-0 border-2 border-primary/30">
            {user?.avatar_url ? (
              <BeautyImage src={user.avatar_url} alt={user.full_name || "profil"} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-black text-xl">
                {(user?.full_name || "P")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-black text-white truncate">{user?.full_name || "Professionnel"}</p>
            <p className="text-[11px] text-gray-400 font-medium">Professionnel · depuis {memberSince}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="bg-primary/20 text-primary text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">PRO</span>
              <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">⭐ Actif</span>
            </div>
          </div>
        </div>

        {/* MON ÉTABLISSEMENT */}
        <SectionLabel>Mon Établissement</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={Store} iconBg="bg-orange-50" iconColor="text-primary"
            label="Modifier mon profil pro" sublabel="Nom, bio, photos, adresse"
            onClick={() => navigate("/pro/modifier-profil")} />
          <SettingRow icon={Scissors} iconBg="bg-blue-50" iconColor="text-blue-500"
            label="Services & Tarifs" sublabel="Gérer les prestations"
            onClick={() => navigate("/pro/catalogue-services")} />
          <SettingRow icon={Clock} iconBg="bg-green-50" iconColor="text-green-500"
            label="Horaires & Congés" sublabel="Planning hebdomadaire"
            onClick={() => navigate("/pro/horaires-conges")} />
          <SettingRow icon={Users} iconBg="bg-purple-50" iconColor="text-purple-500"
            label="Équipe & Staff" sublabel="Membres et rôles"
            onClick={() => navigate("/pro/equipe")} />
        </div>

        {/* OUTILS PRO */}
        <SectionLabel>Outils Pro</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={BarChart2} iconBg="bg-indigo-50" iconColor="text-indigo-500"
            label="Analytics & Stats" sublabel="Performance, avis, revenus"
            onClick={() => navigate("/pro/analytics")} />
          <SettingRow icon={Megaphone} iconBg="bg-rose-50" iconColor="text-rose-500"
            label="Marketing & Promotions" sublabel="Codes promo, campagnes"
            onClick={() => navigate("/pro/catalogue-services")} />
          <SettingRow icon={Radio} iconBg="bg-red-50" iconColor="text-red-500"
            label="Lancer un Direct Live" sublabel="Diffuser une prestation"
            onClick={() => navigate("/pro/lancer-direct")} />
          <SettingRow icon={Scan} iconBg="bg-cyan-50" iconColor="text-cyan-500"
            label="Visite Virtuelle 3D" sublabel="360° de votre salon"
            onClick={() => navigate("/pro/visite-3d")} />
          <SettingRow icon={Network} iconBg="bg-violet-50" iconColor="text-violet-500"
            label="Franchise & Partenariat" sublabel="Développer votre réseau"
            onClick={() => navigate("/pro/franchise")} />
        </div>

        {/* ABONNEMENT */}
        <SectionLabel>Abonnement</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={Star} iconBg="bg-yellow-50" iconColor="text-yellow-500"
            label="Plan & Abonnements" sublabel="Basique · Passer Premium ou Gold"
            badge="Upgrade"
            onClick={() => navigate("/pro/abonnements")} />
          <SettingRow icon={CreditCard} iconBg="bg-blue-50" iconColor="text-blue-500"
            label="Paiement & Facturation" sublabel="Carte enregistrée, facturation, historique"
            onClick={() => navigate("/pro/paiement-facturation")} />
        </div>

        {/* THÈME */}
        <SectionLabel>Apparence</SectionLabel>
        <div className="w-full flex flex-col gap-3 bg-white rounded-2xl px-4 py-4 mb-2">
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
            <button onClick={() => setTheme("light")}
              className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95 ${theme === "light" ? "border-amber-400 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
              <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
                <Sun className="w-4 h-4 text-amber-500" />
              </div>
              <span className={`text-[11px] font-black ${theme === "light" ? "text-amber-500" : "text-gray-400"}`}>Clair</span>
            </button>
            <button onClick={() => setTheme("dark")}
              className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95 ${theme === "dark" ? "border-indigo-500 bg-gray-800" : "border-gray-100 bg-gray-50"}`}>
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <Moon className="w-4 h-4 text-indigo-300" />
              </div>
              <span className={`text-[11px] font-black ${theme === "dark" ? "text-indigo-300" : "text-gray-400"}`}>Sombre</span>
            </button>
            <button onClick={() => setTheme("night")}
              className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all active:scale-95 ${theme === "night" ? "border-white bg-black" : "border-gray-100 bg-gray-50"}`}>
              <div className="w-8 h-8 bg-black border border-gray-700 rounded-full flex items-center justify-center">
                <Moon className="w-4 h-4 text-white" />
              </div>
              <span className={`text-[11px] font-black ${theme === "night" ? "text-white" : "text-gray-400"}`}>Nuit</span>
            </button>
          </div>
        </div>

        {/* COMPTE PARTAGÉ */}
        <SectionLabel>Compte Partagé</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={Bell} iconBg="bg-yellow-50" iconColor="text-yellow-500"
            label="Notifications" sublabel="Alertes, rappels, messages"
            onClick={() => navigate("/parametres/notifications")} />
          <SettingRow icon={Shield} iconBg="bg-purple-50" iconColor="text-purple-500"
            label="Sécurité" sublabel="Mot de passe, appareils connectés"
            onClick={() => navigate("/parametres/securite")} />
          <SettingRow icon={Lock} iconBg="bg-green-50" iconColor="text-green-500"
            label="Confidentialité" sublabel="Données, RGPD"
            onClick={() => navigate("/parametres/confidentialite")} />
          <SettingRow icon={Globe} iconBg="bg-teal-50" iconColor="text-teal-500"
            label="Langue & Monnaie" sublabel="Français · Euro (€)"
            onClick={() => navigate("/parametres/langue")} />
        </div>

        {/* AIDE */}
        <SectionLabel>Assistance et légal</SectionLabel>
        <div className="space-y-2">
          <SettingRow icon={HelpCircle} iconBg="bg-orange-50" iconColor="text-primary"
            label="Centre d'aide Pro" sublabel="FAQ, tutoriels, support prioritaire"
            onClick={() => navigate("/parametres/aide")} />
          <SettingRow icon={Mail} iconBg="bg-pink-50" iconColor="text-pink-500"
            label="Contactez-nous" sublabel="Assistance dédiée aux pros"
            onClick={() => navigate("/parametres/contact")} />
          <SettingRow icon={FileText} iconBg="bg-gray-100" iconColor="text-gray-500"
            label="CGU Professionnels" sublabel="Conditions, commissions, politique"
            onClick={() => navigate("/parametres/conditions")} />
          <SettingRow icon={Info} iconBg="bg-indigo-50" iconColor="text-indigo-500"
            label="À propos" sublabel="Version 2.4 · BeautyBook Pro"
            onClick={() => navigate("/parametres/a-propos")} />
        </div>

        {/* Supprimer le compte */}
        <div className="mt-6">
          <button
            onClick={() => setShowDeleteFlow(true)}
            className="w-full bg-white border border-red-100 rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span className="text-[15px] font-bold text-red-400">Supprimer mon compte</span>
          </button>
        </div>

        {/* Déconnexion */}
        <div className="mt-2">
          <button
            onClick={() => {
              localStorage.removeItem("bb_onboarded");
              localStorage.removeItem("bb_is_pro");
              supabase.auth.signOut().then(() => window.location.href = "/");
            }}
            className="w-full bg-red-50 border border-red-100 rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="text-[15px] font-bold text-red-400">Déconnexion</span>
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-300 font-medium mt-6">BeautyBook Pro v2.4.1 · Tous droits réservés</p>
      </div>

      {showDeleteFlow && <DeleteAccountFlow onClose={() => setShowDeleteFlow(false)} />}
    </div>
  );
}
