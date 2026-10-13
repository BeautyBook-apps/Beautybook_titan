// Catégories globales synchronisées — utilisées dans Home, ServicesSalons, Explorer
import { Scissors, Diamond, Crown, Heart, Wind, Eye, Droplets, Waves, Flower2, Footprints, Brush, Zap } from "lucide-react";

export const GLOBAL_CATEGORIES = [
  { id: "coiffure",    label: "Coiffure",        dbValue: "Coiffure",    Icon: Scissors,  color: "text-purple-500",   bg: "bg-purple-50",   border: "border-purple-200" },
  { id: "perruque",    label: "Perruque",        dbValue: "Perruque",    Icon: Crown,     color: "text-violet-500",    bg: "bg-violet-50",  border: "border-violet-200" },
  { id: "tresses",     label: "Tresses",          dbValue: "Coiffure",    Icon: Waves,     color: "text-rose-500",     bg: "bg-rose-50",     border: "border-rose-200" },
  { id: "manucure",    label: "Manucure",         dbValue: "Ongles",      Icon: Diamond,   color: "text-amber-500",    bg: "bg-amber-50",    border: "border-amber-200" },
  { id: "pedicure",    label: "Pédicure",         dbValue: "Ongles",      Icon: Footprints,color: "text-pink-500",     bg: "bg-pink-50",     border: "border-pink-200" },
  { id: "maquillage",  label: "Maquillage",       dbValue: "Maquillage",  Icon: Brush,     color: "text-fuchsia-500",  bg: "bg-fuchsia-50",  border: "border-fuchsia-200" },
  { id: "soin-visage", label: "Soin Visage",      dbValue: "Soin",        Icon: Droplets,  color: "text-red-400",      bg: "bg-red-50",      border: "border-red-200" },
  { id: "barbe",       label: "Barbe",            dbValue: "Barbe",       Icon: Zap,       color: "text-slate-700",    bg: "bg-slate-100",   border: "border-slate-200" },
  { id: "extensions",  label: "Extensions",       dbValue: "Coiffure",    Icon: Diamond,   color: "text-violet-500",   bg: "bg-violet-50",   border: "border-violet-200" },
  { id: "massage",     label: "Massage",          dbValue: "Massage",     Icon: Flower2,   color: "text-emerald-500",  bg: "bg-emerald-50",  border: "border-emerald-200" },
  { id: "epilation",   label: "Épilation",        dbValue: "Soin",        Icon: Wind,      color: "text-indigo-400",   bg: "bg-indigo-50",   border: "border-indigo-200" },
  { id: "cils",        label: "Cils & Sourcils",  dbValue: "Soin",        Icon: Eye,       color: "text-cyan-500",     bg: "bg-cyan-50",     border: "border-cyan-200" },
  { id: "spa",         label: "Spa & Bien-être",  dbValue: "Massage",     Icon: Heart,     color: "text-amber-600",    bg: "bg-amber-50",    border: "border-amber-200" },
];

// Visuels de couverture partagés par la page d’accueil et le catalogue des
// services. Chaque image correspond à la prestation affichée.
export const CATEGORY_IMAGES = {
  coiffure: "/category-images/coiffure.png",
  perruque: "/category-images/perruque.png",
  tresses: "/category-images/tresses.png",
  manucure: "/category-images/ongles.png",
  pedicure: "/category-images/pedicure.png",
  maquillage: "/category-images/maquillage.png",
  "soin-visage": "/category-images/soin.png",
  barbe: "/category-images/barbe.png",
  extensions: "/category-images/extensions.png",
  massage: "/category-images/massage.png",
  epilation: "/category-images/epilation.png",
  cils: "/category-images/cils.png",
  spa: "/category-images/spa.png",
  tous: "/category-images/tous.png",
  tatouage: "/category-images/tatouage.png",
  piercing: "/category-images/piercing.png",
};

// Liste canonique de l'onglet Styles de ServicesSalons. L'accueil réutilise
// cette même source afin que les libellés, l'ordre et la navigation restent
// synchronisés.
export const SERVICE_STYLE_CATEGORIES = [
  { id: "tous", label: "Tous", image: CATEGORY_IMAGES.tous },
  { id: "coiffure", label: "Coiffure", image: CATEGORY_IMAGES.coiffure },
  { id: "perruque", label: "Perruque", image: CATEGORY_IMAGES.perruque },
  { id: "tresses", label: "Tresses", image: CATEGORY_IMAGES.tresses },
  { id: "extensions", label: "Extensions", image: CATEGORY_IMAGES.extensions },
  { id: "maquillage", label: "Maquillage", image: CATEGORY_IMAGES.maquillage },
  { id: "ongles", label: "Ongles", image: CATEGORY_IMAGES.manucure },
  { id: "pedicure", label: "Pédicure", image: CATEGORY_IMAGES.pedicure },
  { id: "soin", label: "Soin", image: CATEGORY_IMAGES["soin-visage"] },
  { id: "barbe", label: "Barbe", image: CATEGORY_IMAGES.barbe },
  { id: "massage", label: "Massage", image: CATEGORY_IMAGES.massage },
  { id: "epilation", label: "Épilation", image: CATEGORY_IMAGES.epilation },
  { id: "cils", label: "Cils & Sourcils", image: CATEGORY_IMAGES.cils },
  { id: "spa", label: "Spa & Bien-être", image: CATEGORY_IMAGES.spa },
  { id: "tatouage", label: "Tatouage", image: CATEGORY_IMAGES.tatouage },
  { id: "piercing", label: "Piercing", image: CATEGORY_IMAGES.piercing },
];

// Filtres complémentaires affichés à côté des catégories dans Services.
export const SERVICE_QUICK_FILTERS = [
  { id: "type_cheveux", label: "Type de cheveux", image: "https://images.unsplash.com/photo-1522337360788-8b13df7a3be3?auto=format&fit=crop&w=240&q=85" },
  { id: "type_peau", label: "Type de peau", image: CATEGORY_IMAGES["soin-visage"] },
  { id: "niveau_difficulte", label: "Niveau de difficulté", image: "https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?auto=format&fit=crop&w=240&q=85" },
];

export const SERVICE_HOME_CATEGORIES = SERVICE_STYLE_CATEGORIES;

// Positionnement d'un salon professionnel, partagé par l'inscription et la recherche.
export const SALON_CATEGORIES = ["Prestige", "Luxe", "Bio", "Moderne", "Classique"];
