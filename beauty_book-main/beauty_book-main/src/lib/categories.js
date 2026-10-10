// Catégories globales synchronisées — utilisées dans Home, ServicesSalons, Explorer
import { Scissors, Gem, Sparkles, Heart, Wind, Eye, Droplets, Waves, Flower2, Star, Brush, Zap } from "lucide-react";

export const GLOBAL_CATEGORIES = [
  { id: "coiffure",    label: "Coiffure",        dbValue: "Coiffure",    Icon: Scissors,  color: "text-purple-500",   bg: "bg-purple-50",   border: "border-purple-200" },
  { id: "perruque",    label: "Perruque",        dbValue: "Perruque",    Icon: Sparkles,  color: "text-violet-500",    bg: "bg-violet-50",  border: "border-violet-200" },
  { id: "tresses",     label: "Tresses",          dbValue: "Coiffure",    Icon: Waves,     color: "text-rose-500",     bg: "bg-rose-50",     border: "border-rose-200" },
  { id: "manucure",    label: "Manucure",         dbValue: "Ongles",      Icon: Gem,       color: "text-amber-500",    bg: "bg-amber-50",    border: "border-amber-200" },
  { id: "pedicure",    label: "Pédicure",         dbValue: "Ongles",      Icon: Star,      color: "text-pink-500",     bg: "bg-pink-50",     border: "border-pink-200" },
  { id: "maquillage",  label: "Maquillage",       dbValue: "Maquillage",  Icon: Brush,     color: "text-fuchsia-500",  bg: "bg-fuchsia-50",  border: "border-fuchsia-200" },
  { id: "soin-visage", label: "Soin Visage",      dbValue: "Soin",        Icon: Droplets,  color: "text-red-400",      bg: "bg-red-50",      border: "border-red-200" },
  { id: "barbe",       label: "Barbe",            dbValue: "Barbe",       Icon: Zap,       color: "text-slate-700",    bg: "bg-slate-100",   border: "border-slate-200" },
  { id: "extensions",  label: "Extensions",       dbValue: "Coiffure",    Icon: Sparkles,  color: "text-violet-500",   bg: "bg-violet-50",   border: "border-violet-200" },
  { id: "massage",     label: "Massage",          dbValue: "Massage",     Icon: Flower2,   color: "text-emerald-500",  bg: "bg-emerald-50",  border: "border-emerald-200" },
  { id: "epilation",   label: "Épilation",        dbValue: "Soin",        Icon: Wind,      color: "text-indigo-400",   bg: "bg-indigo-50",   border: "border-indigo-200" },
  { id: "cils",        label: "Cils & Sourcils",  dbValue: "Soin",        Icon: Eye,       color: "text-cyan-500",     bg: "bg-cyan-50",     border: "border-cyan-200" },
  { id: "spa",         label: "Spa & Bien-être",  dbValue: "Massage",     Icon: Heart,     color: "text-amber-600",    bg: "bg-amber-50",    border: "border-amber-200" },
];

// Positionnement d'un salon professionnel, partagé par l'inscription et la recherche.
export const SALON_CATEGORIES = ["Prestige", "Luxe", "Bio", "Moderne", "Classique"];
