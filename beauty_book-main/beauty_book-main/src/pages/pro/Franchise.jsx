import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Network, GraduationCap, Brain, CheckCircle, Send, Play, Lock } from "lucide-react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";

// ── Données des modules ────────────────────────────────────────────────────────
const MARKETING_MODULES = [
  {
    emoji: "📱",
    title: "Maîtriser les Réseaux Sociaux",
    desc: "Instagram, TikTok, Pinterest — construire une audience fidèle pour votre salon.",
    duration: "2h30",
    level: "Débutant",
    free: true,
    steps: [
      "Créer un profil professionnel optimisé",
      "Stratégie de contenu beauté (posts, reels, stories)",
      "Hashtags et algorithmes expliqués",
      "Calendrier éditorial mensuel",
      "Analyser vos stats pour progresser",
    ]
  },
  {
    emoji: "📸",
    title: "Shooting & Contenu Visuel",
    desc: "Photographier vos créations avec votre téléphone pour attirer plus de clients.",
    duration: "1h45",
    level: "Débutant",
    free: true,
    steps: [
      "Lumière naturelle vs studio — bases",
      "Angles et mises en scène tendances",
      "Retouche rapide avec apps gratuites",
      "Before/After : format qui convertit",
      "Créer un feed cohérent et attractif",
    ]
  },
  {
    emoji: "🎯",
    title: "Publicité Locale & Google",
    desc: "Attirer des clients dans votre zone grâce à Google My Business et Meta Ads.",
    duration: "3h",
    level: "Intermédiaire",
    free: false,
    steps: [
      "Google My Business : profil parfait",
      "Avis clients : comment en obtenir plus",
      "Créer sa première pub Facebook/Instagram",
      "Ciblage géographique efficace",
      "Mesurer son ROI publicitaire",
    ]
  },
  {
    emoji: "💌",
    title: "Fidélisation & Email Marketing",
    desc: "Transformer vos clients ponctuels en ambassadeurs fidèles.",
    duration: "2h",
    level: "Intermédiaire",
    free: false,
    steps: [
      "Programme de fidélité rentable",
      "Newsletters et SMS marketing",
      "Offres d'anniversaire automatisées",
      "Parrainage : booster le bouche-à-oreille",
      "Segmentation de votre clientèle",
    ]
  },
];

const FRANCHISE_MODULES = [
  {
    emoji: "🏗️",
    title: "Créer son Concept de Franchise",
    desc: "Structurer son savoir-faire pour le répliquer dans plusieurs salons.",
    duration: "4h",
    level: "Avancé",
    free: false,
    steps: [
      "Identifier ce qui fait votre différence",
      "Documenter ses process opérationnels",
      "Créer le manuel du franchisé",
      "Définir les standards de qualité",
      "Protéger sa marque (INPI, dépôt)",
    ]
  },
  {
    emoji: "⚖️",
    title: "Aspects Juridiques & Financiers",
    desc: "Contrats de franchise, DIP, redevances — tout ce que vous devez savoir.",
    duration: "3h",
    level: "Avancé",
    free: false,
    steps: [
      "Le contrat de franchise expliqué",
      "DIP : Document d'Information Précontractuel",
      "Structurer ses redevances",
      "Choisir la bonne structure juridique",
      "Financer le développement du réseau",
    ]
  },
  {
    emoji: "🤝",
    title: "Recruter & Sélectionner ses Franchisés",
    desc: "Trouver les bons partenaires et les intégrer avec succès.",
    duration: "2h30",
    level: "Avancé",
    free: false,
    steps: [
      "Profil du franchisé idéal",
      "Canaux de recrutement efficaces",
      "Process de sélection en 5 étapes",
      "Entretiens et validation du candidat",
      "Onboarding et formation initiale",
    ]
  },
  {
    emoji: "📊",
    title: "Piloter son Réseau de Franchises",
    desc: "Outils et méthodes pour superviser plusieurs points de vente.",
    duration: "3h",
    level: "Expert",
    free: false,
    steps: [
      "Tableaux de bord réseau",
      "Audits et visites franchisés",
      "Animer la communauté de franchisés",
      "Gérer les conflits et litiges",
      "Scaler de 5 à 50 franchises",
    ]
  },
];

const COURS_MODULES = [
  {
    emoji: "✂️",
    title: "Techniques Coupe Avancées",
    desc: "Dégradés, coupes structurées, géométriques — maîtrisez les techniques premium.",
    duration: "6h",
    level: "Intermédiaire",
    free: true,
    steps: [
      "Analyse morphologique du visage",
      "Dégradé américain & skin fade",
      "Coupe sur cheveux bouclés et frisés",
      "Finitions et styling professionnel",
      "Créer ses propres techniques signature",
    ]
  },
  {
    emoji: "🎨",
    title: "Colorimétrie & Balayage",
    desc: "Couleurs tendances, balayage, mèches — techniques actuelles complètes.",
    duration: "8h",
    level: "Intermédiaire",
    free: false,
    steps: [
      "Roue des couleurs et mélanges",
      "Diagnostic cheveux avant couleur",
      "Balayage naturel & californien",
      "Techniques babylights et toning",
      "Corriger les erreurs de couleur",
    ]
  },
  {
    emoji: "💆",
    title: "Soins Capillaires & Conseil",
    desc: "Diagnostiquer et traiter tous types de cheveux comme un expert.",
    duration: "4h",
    level: "Débutant",
    free: true,
    steps: [
      "Identifier les types de cheveux",
      "Soins kératine et lissages",
      "Soins naturels et clean beauty",
      "Conseil personnalisé client",
      "Vendre les soins en salon",
    ]
  },
  {
    emoji: "💅",
    title: "Nail Art & Techniques Ongles",
    desc: "Gel, semi-permanent, nail art tendances — formation complète.",
    duration: "5h",
    level: "Débutant",
    free: false,
    steps: [
      "Préparation et hygiène des ongles",
      "Pose gel et semi-permanent",
      "Nail art : dégradés, motifs, 3D",
      "Tendances saison et inspirations",
      "Prendre soin des cuticules",
    ]
  },
];

const COACHING_MODULES = [
  {
    emoji: "🧠",
    title: "Mindset de l'Entrepreneur Beauté",
    desc: "Développer la mentalité, la résilience et la vision d'un chef d'entreprise.",
    duration: "3h",
    level: "Tous niveaux",
    free: true,
    steps: [
      "Passer de salarié à patron : le shift mental",
      "Gérer le stress et l'incertitude",
      "Fixer des objectifs ambitieux et atteignables",
      "Routine matinale du professionnel performant",
      "Entourer de mentors et de pairs",
    ]
  },
  {
    emoji: "💼",
    title: "Gestion & Finance du Salon",
    desc: "Comprendre ses chiffres, gérer sa trésorerie et être rentable.",
    duration: "4h",
    level: "Intermédiaire",
    free: false,
    steps: [
      "Lire son compte de résultat simplement",
      "Seuil de rentabilité et prix de revient",
      "Gérer sa trésorerie au quotidien",
      "Prévoir ses charges fixes et variables",
      "Se payer correctement en tant que dirigeant",
    ]
  },
  {
    emoji: "👥",
    title: "Leadership & Management d'Équipe",
    desc: "Recruter, motiver et fidéliser vos collaborateurs.",
    duration: "3h30",
    level: "Intermédiaire",
    free: false,
    steps: [
      "Recruter les bons profils",
      "Onboarding réussi d'un nouveau collaborateur",
      "Donner du feedback constructif",
      "Gérer les conflits en équipe",
      "Créer une culture d'entreprise forte",
    ]
  },
  {
    emoji: "🚀",
    title: "Scaler son Business Beauté",
    desc: "Passer de 1 à plusieurs salons — stratégie et exécution.",
    duration: "5h",
    level: "Avancé",
    free: false,
    steps: [
      "Identifier le bon moment pour se développer",
      "Financer sa croissance (prêt, investisseurs)",
      "Déléguer sans perdre la qualité",
      "Automatiser ses opérations",
      "Ouvrir un 2e, 3e salon sereinement",
    ]
  },
];

export const PILLARS = [
  { key: "marketing", icon: TrendingUp, label: "Marketing", color: "text-pink-500", bg: "bg-pink-50", modules: MARKETING_MODULES },
  { key: "franchise", icon: Network, label: "Franchise", color: "text-blue-500", bg: "bg-blue-50", modules: FRANCHISE_MODULES },
  { key: "cours", icon: GraduationCap, label: "Formations", color: "text-green-500", bg: "bg-green-50", modules: COURS_MODULES },
  { key: "coaching", icon: Brain, label: "Coaching", color: "text-purple-500", bg: "bg-purple-50", modules: COACHING_MODULES },
];

// ── Module Card ────────────────────────────────────────────────────────────────
function ModuleCard({ module, onOpen }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm">
      <div className="flex items-start gap-4 mb-3">
        <span className="text-3xl">{module.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-black text-gray-900 leading-tight flex-1">{module.title}</h3>
            {module.free ? (
              <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[9px] font-black rounded-full uppercase tracking-widest shrink-0">Gratuit</span>
            ) : (
              <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            )}
          </div>
          <p className="text-[12px] text-gray-400 font-medium leading-snug">{module.desc}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">⏱ {module.duration}</span>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">· {module.level}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => onOpen(module)}
        className="w-full py-3 bg-gray-900 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        <Play className="w-4 h-4 text-white" />
        <span className="text-[12px] font-black text-white uppercase tracking-widest">Accéder au module</span>
      </button>
    </div>
  );
}

// ── Module Detail Sheet ────────────────────────────────────────────────────────
function ModuleSheet({ module, pillarColor, onClose }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const { user } = useAuth();

  const handleSend = async () => {
    if (!form.name || !form.email) return;
    await entities.DemandefFranchise.create({
      full_name: form.name,
      email: form.email || user?.email,
      phone: form.phone,
      message: `[${module.title}] ${form.message}`,
      budget: "N/A",
    });
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white font-display" onClick={onClose}>
      <div className="flex-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#1a2035] px-5 pt-10 pb-6">
          <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-5xl mb-3 block">{module.emoji}</span>
          <h2 className="text-[24px] font-black text-white leading-tight mb-1">{module.title}</h2>
          <p className="text-[13px] text-gray-400 font-medium">{module.desc}</p>
          <div className="flex gap-3 mt-3">
            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest">⏱ {module.duration}</span>
            <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest">{module.level}</span>
            {module.free && <span className="px-3 py-1 bg-green-500/20 rounded-full text-[10px] font-black text-green-400 uppercase tracking-widest">Gratuit</span>}
          </div>
        </div>

        <div className="px-5 pt-5 pb-10 space-y-5">
          {/* Programme */}
          <div>
            <h3 className="text-[12px] font-black text-gray-500 uppercase tracking-widest mb-3">Au programme</h3>
            <div className="space-y-2">
              {module.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-primary">{i + 1}</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-800 leading-snug">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          {!formOpen && !sent && (
            <button
              onClick={() => setFormOpen(true)}
              className="w-full bg-primary text-white font-black text-[14px] uppercase tracking-widest py-5 rounded-3xl shadow-xl shadow-primary/40 active:scale-95 transition-all"
            >
              {module.free ? "Commencer maintenant →" : "Demander l'accès →"}
            </button>
          )}

          {formOpen && !sent && (
            <div className="bg-gray-50 rounded-3xl p-5 space-y-3">
              <h4 className="text-[15px] font-black text-gray-900">{module.free ? "Commencer le module" : "Demander l'accès"}</h4>
              {[
                { key: "name", label: "Nom complet *", placeholder: "Jean Dupont" },
                { key: "email", label: "Email *", placeholder: "jean@exemple.com" },
                { key: "phone", label: "Téléphone", placeholder: "+33 6 00 00 00 00" },
                { key: "message", label: "Message (optionnel)", placeholder: "Parlez-nous de votre projet..." },
              ].map(f => (
                <div key={f.key}>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{f.label}</p>
                  <input
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-[13px] text-gray-700 outline-none"
                  />
                </div>
              ))}
              <button
                onClick={handleSend}
                disabled={!form.name || !form.email}
                className="w-full bg-primary text-white font-black text-[13px] uppercase tracking-widest py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Envoyer ma demande
              </button>
            </div>
          )}

          {sent && (
            <div className="flex flex-col items-center py-8 gap-3 bg-green-50 rounded-3xl">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-[16px] font-black text-gray-900">Demande envoyée !</p>
              <p className="text-[12px] text-gray-500 font-medium text-center">Notre équipe vous contactera sous 48h.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Franchise() {
  const navigate = useNavigate();
  const [activePillar, setActivePillar] = useState("marketing");
  const [selectedModule, setSelectedModule] = useState(null);

  const pillar = PILLARS.find(p => p.key === activePillar);

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      {/* Header Hero */}
      <div className="bg-[#1a2035] px-5 pt-10 pb-6">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center active:scale-95 mb-5">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">BeautyBook Pro</p>
        <h1 className="text-[30px] font-black text-white leading-tight mb-2">Développez<br />Votre Business</h1>
        <p className="text-[13px] text-gray-400 font-medium leading-snug">
          Marketing, franchise, formations métier, coaching — tout ce qu'il faut pour passer au niveau supérieur.
        </p>

        {/* Stats */}
        <div className="flex gap-3 mt-5">
          {[
            { value: "2 400+", label: "pros formés" },
            { value: "94%", label: "satisfaction" },
            { value: "18 mois", label: "ROI moyen" },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-white/10 rounded-2xl px-3 py-2.5 text-center">
              <p className="text-[16px] font-black text-white leading-none">{s.value}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pillar Navigation */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-4 gap-2">
          {PILLARS.map(p => {
            const Icon = p.icon;
            const active = activePillar === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setActivePillar(p.key)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 ${active ? "bg-gray-900 shadow-lg" : "bg-white shadow-sm"}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? "bg-white/10" : p.bg}`}>
                  <Icon className={`w-4 h-4 ${active ? "text-white" : p.color}`} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${active ? "text-white" : "text-gray-500"}`}>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pillar Title */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${pillar.bg}`}>
            <pillar.icon className={`w-5 h-5 ${pillar.color}`} />
          </div>
          <div>
            <h2 className="text-[20px] font-black text-gray-900">{pillar.label}</h2>
            <p className="text-[11px] text-gray-400 font-medium">{pillar.modules.length} modules disponibles</p>
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="px-5 pb-24 space-y-4">
        {pillar.modules.map((mod, i) => (
          <ModuleCard key={i} module={mod} onOpen={setSelectedModule} />
        ))}
      </div>

      {/* Module Detail Sheet */}
      {selectedModule && (
        <ModuleSheet
          module={selectedModule}
          pillarColor={pillar.color}
          onClose={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
}
