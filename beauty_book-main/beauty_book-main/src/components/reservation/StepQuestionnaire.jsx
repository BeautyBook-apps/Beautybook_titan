import { useState, useEffect } from "react";
import { ArrowLeft, Save, Scissors, Gem, Paintbrush, Flower2, Sparkles, Droplets, Zap, MessageSquare, ChevronRight, Check, Lightbulb } from "lucide-react";

// ── Questionnaires par catégorie de service ───────────────────────────────────
// Chaque catégorie a sa propre liste : elle s'affiche automatiquement selon
// la catégorie du service réservé (détection insensible aux accents).
const QUESTIONNAIRES = {
  coiffure: [
    { id: "hair_type", question: "Quelle est la nature de vos cheveux ?", options: ["Crépus / Afro (4A-4C)", "Bouclés / Frisés (3A-3C)", "Ondulés (2A-2C)", "Lisses (1A-1C)"] },
    { id: "hair_length", question: "Quelle est votre longueur actuelle ?", options: ["Courts (au-dessus des épaules)", "Mi-longs (sous les épaules)", "Longs (dans le dos)", "Très longs"] },
    { id: "hair_density", question: "Quelle est la densité de vos cheveux ?", options: ["Fins / Peu denses", "Densité moyenne", "Épais / Très denses"] },
    { id: "hair_history", question: "Historique capillaire récent ?", options: ["Aucun traitement récent", "Coloration (< 3 mois)", "Défrisage chimique", "Kératine / Lissage", "Mèches / Balayage"] },
    { id: "hair_ends", question: "État de vos pointes ?", options: ["Saines", "Sèches / Fourchues", "Cassantes — besoin d'un soin"] },
    { id: "hair_allergy", question: "Allergie aux produits capillaires ?", options: ["Aucune allergie connue", "Allergie PPD / coloration", "Cuir chevelu très réactif"] },
    { id: "extensions_provided", question: "Fourniture des mèches / rajouts ?", options: ["Mèches fournies par le salon", "J'apporte mes propres mèches", "Pas concerné(e)"] },
    { id: "hair_inspiration", question: "Avez-vous une photo d'inspiration ?", options: ["Oui, je l'apporterai", "Oui, je peux l'envoyer avant", "Non, je fais confiance au pro"] },
    { id: "styling_preference", question: "Quel rendu recherchez-vous ?", options: ["Naturel / Everyday", "Événementiel / Sophistiqué", "Tendance / Original", "Professionnel"] },
    { id: "sensitivities", question: "Sensibilités particulières ?", options: ["Cuir chevelu sensible", "Pellicules / Dermatite", "Chute de cheveux", "Aucune particularité"] },
  ],
  tresses: [
    { id: "braid_type", question: "Quel type de tresses souhaitez-vous ?", options: ["Box Braids", "Cornrows / Tresses collées", "Twists (Passion / Spring)", "Faux Locs", "Crochet Braids", "Nattes / Vanilles"] },
    { id: "braid_length", question: "Quelle longueur ?", options: ["Courtes (au-dessus des épaules)", "Moyennes (sous les épaules)", "Longues (dans le dos)", "Très longues"] },
    { id: "braid_size", question: "Quelle taille de tresses ?", options: ["Petites / Micro", "Moyennes", "Grosses / Chunky"] },
    { id: "braid_tension", question: "Tension des tresses souhaitée ?", options: ["Légère (cuir chevelu sensible)", "Normale", "Bien serrées (tenue max)"] },
    { id: "braid_hair_state", question: "Vos cheveux naturels sont-ils prêts ?", options: ["Oui, lavés et démêlés", "Non, prévoir le shampoing au salon", "Je ne sais pas"] },
    { id: "extensions_for_braids", question: "Fourniture des mèches ?", options: ["Mèches fournies par le salon", "J'apporte mes propres mèches", "Je ne sais pas"] },
    { id: "braid_edges", question: "Finition des bordures ?", options: ["Baby hairs dessinés", "Naturel", "Pas de préférence"] },
    { id: "braid_sensitivity", question: "Sensibilité du cuir chevelu ?", options: ["Cuir chevelu sensible / fragile", "Bordures / nuque délicates", "Aucune sensibilité"] },
    { id: "expected_duration", question: "Combien de temps comptez-vous garder vos tresses ?", options: ["2-3 semaines", "1-2 mois", "2-3 mois", "Plus de 3 mois"] },
  ],
  ongles: [
    { id: "nail_type", question: "Quel type de prestation ?", options: ["Manucure classique", "Pose gel / résine", "Pose acrylique", "Semi-permanent / Vernis", "Nail art / Décoration", "Pédicure"] },
    { id: "nail_status", question: "État actuel de vos ongles ?", options: ["Ongles naturels, bon état", "Pose gel/résine à déposer", "Ongles fragiles / abîmés", "Ongles rongés"] },
    { id: "nail_remove", question: "Faut-il déposer une ancienne pose ?", options: ["Non", "Oui, gel / résine", "Oui, semi-permanent"] },
    { id: "nail_length_pref", question: "Quelle longueur souhaitez-vous ?", options: ["Court / Naturel", "Moyen", "Long", "Très long (extra)"] },
    { id: "nail_shape", question: "Quelle forme d'ongle ?", options: ["Carrée", "Amande", "Stiletto", "Ronde", "Ballerine / Coffin"] },
    { id: "nail_design", question: "Type de design souhaité ?", options: ["Unie / Couleur simple", "French / Baby-boomer", "Nail art / Motifs", "Ombré / Dégradé", "Pailletés / Strass"] },
    { id: "nail_inspiration", question: "Avez-vous une photo du design voulu ?", options: ["Oui, je l'apporterai", "Non, je choisirai sur place"] },
    { id: "nail_lifestyle", question: "Vos mains sont-elles très sollicitées ?", options: ["Travail manuel / ménage", "Sport (musculation, escalade…)", "Usage normal"] },
    { id: "nail_allergies", question: "Allergies ou sensibilités ?", options: ["Aucune allergie", "Allergie au gel / acrylate", "Peau sensible autour des ongles"] },
  ],
  maquillage: [
    { id: "makeup_occasion", question: "Pour quelle occasion ?", options: ["Mariage", "Soirée / Gala", "Shooting photo / Vidéo", "Événement professionnel", "Quotidien / Look naturel", "Cours / Atelier"] },
    { id: "makeup_trial", question: "Souhaitez-vous un essai avant le jour J ?", options: ["Oui, réserver un essai", "Non, le jour J suffit"] },
    { id: "makeup_style", question: "Quel style de maquillage ?", options: ["Naturel / Fresh", "Glamour / Sophistiqué", "Artistique / Editorial", "Couleurs vives / Audacieux"] },
    { id: "makeup_outfit", question: "Couleurs de votre tenue ?", options: ["Je préciserai en commentaire", "Tons neutres / nude", "Tons vifs / colorés", "Pas encore décidées"] },
    { id: "skin_type_makeup", question: "Votre type de peau ?", options: ["Sèche / Déshydratée", "Mixte", "Grasse / Acnéique", "Sensible / Réactive", "Normale"] },
    { id: "makeup_duration", question: "Le maquillage doit-il tenir longtemps ?", options: ["Quelques heures (soirée)", "Journée complète (8h+)", "Résistant à l'eau / Sport"] },
    { id: "makeup_lashes", question: "Faux-cils souhaités ?", options: ["Oui, si possible", "Non", "À voir avec le pro"] },
    { id: "makeup_products_pref", question: "Préférence de produits ?", options: ["Clean beauty / Bio", "Marque de prestige", "Professionnel (MUFE, Kryolan…)", "Pas de préférence"] },
    { id: "makeup_allergies", question: "Allergies ou sensibilités ?", options: ["Aucune allergie", "Peau très réactive", "Port de lentilles", "Yeux sensibles / larmoiants"] },
  ],
  soin_visage: [
    { id: "skin_concern", question: "Votre préoccupation principale ?", options: ["Hydratation / Peau terne", "Anti-âge / Rides", "Acné / Imperfections", "Taches pigmentaires", "Rougeurs / Couperose", "Nettoyage profond / Points noirs"] },
    { id: "skin_type_soin", question: "Votre type de peau ?", options: ["Sèche / Déshydratée", "Mixte à Grasse", "Sensible / Réactive", "Normale", "Peau mate / Foncée"] },
    { id: "skin_medication", question: "Traitement dermatologique en cours ?", options: ["Non", "Rétinoïdes / acides", "Roaccutane (isotrétinoïne)", "Autre — précisé en commentaire"] },
    { id: "skin_sun", question: "Exposition au soleil récente ?", options: ["Non", "Oui, il y a moins d'une semaine", "Séance UV récente"] },
    { id: "skin_routine", question: "Votre routine actuelle ?", options: ["Quasi aucune routine", "Routine basique (nettoyant + crème)", "Routine avancée (sérums, exfoliants…)", "J'ai besoin de conseils"] },
    { id: "previous_treatments", question: "Soins professionnels déjà faits ?", options: ["Oui, régulièrement", "Oui, mais il y a longtemps", "Non, c'est ma première fois"] },
    { id: "skin_home_advice", question: "Souhaitez-vous des conseils produits pour la maison ?", options: ["Oui", "Non, juste le soin"] },
    { id: "sensitivities_soin", question: "Sensibilités ou allergies ?", options: ["Aucune", "Allergie connue", "Peau très réactive", "Enceinte (certaines molécules évitées)"] },
  ],
  barbe: [
    { id: "beard_type", question: "Quel type de barbe souhaitez-vous ?", options: ["Barbe courte / Stubble", "Barbe mi-longue", "Barbe longue / Entretien", "Barbe africaine / Poils crépus"] },
    { id: "beard_style", question: "Quel style recherchez-vous ?", options: ["Taille classique / Nettoyée", "Contour net / Sharp lines", "Fade / Dégradé barbe", "Design / Motif", "Barbe complète avec moustache"] },
    { id: "beard_length", question: "Longueur actuelle de votre barbe ?", options: ["Rasée / 1-2 jours", "Courte (1-2 cm)", "Moyenne (2-5 cm)", "Longue (+5 cm)"] },
    { id: "beard_condition", question: "État de votre barbe ?", options: ["Pas de problème particulier", "Poils ternes / cassants", "Peau en dessous irritée", "Barbe irrégulière"] },
    { id: "beard_hot_towel", question: "Serviette chaude incluse ?", options: ["Oui", "Non, juste la taille"] },
    { id: "beard_dye", question: "Teinture / camouflage des poils blancs ?", options: ["Oui", "Non"] },
    { id: "shaving_preference", question: "Préférence de rasage ?", options: ["Rasoir classique", "Lame unique précision", "Rasage à la serviette chaude", "Pas de rasage, que la barbe"] },
    { id: "beard_products", question: "Utilisez-vous des produits barbe ?", options: ["Huile à barbe", "Baume / Cire", "Rien du tout", "Je voudrais être conseillé"] },
  ],
  massage: [
    { id: "massage_type", question: "Quel type de massage souhaitez-vous ?", options: ["Relaxant / Détente", "Sportif / Deep tissue", "Ayurvédique", "Huiles chaudes / Aromathérapie", "Réflexologie plantaire", "Je ne sais pas, le pro me conseille"] },
    { id: "target_areas", question: "Zones à traiter en priorité ?", options: ["Dos & Épaules", "Jambes & Pieds", "Tête & Nuque", "Corps entier", "Zone précise (à préciser)"] },
    { id: "pressure", question: "Quelle intensité de pression ?", options: ["Douce & Relaxante", "Modérée", "Forte & Profonde", "Variable selon les zones"] },
    { id: "massage_pain_today", question: "Douleur particulière aujourd'hui ?", options: ["Non, détente uniquement", "Oui — précisée en commentaire"] },
    { id: "massage_oils", question: "Huiles essentielles : OK ?", options: ["Oui", "Non, huile neutre uniquement", "Allergie — précisée en commentaire"] },
    { id: "health_conditions", question: "Conditions de santé à signaler ?", options: ["Aucune", "Grossesse", "Douleurs chroniques", "Problèmes circulatoires", "Problèmes de dos / hernie"] },
    { id: "massage_position", question: "Position préférée ?", options: ["Sur le dos", "Sur le ventre", "Assis(e)", "Pas de préférence"] },
    { id: "massage_context", question: "Contexte de cette séance ?", options: ["Détente / Bien-être personnel", "Douleur musculaire / Stress", "Récupération sportive", "Cadeau / Moment à deux", "Première découverte"] },
    { id: "music_ambiance", question: "Ambiance musicale souhaitée ?", options: ["Musique douce / Relaxante", "Nature / Bruits d'eau", "Silence total", "Pas de préférence"] },
  ],
  epilation: [
    { id: "epilation_zone", question: "Quelle zone souhaitez-vous épiler ?", options: ["Visage (sourcils, duvet)", "Aisselles", "Jambes complètes", "Maillot", "Dos / Poitrine (homme)", "Combinaison de zones"] },
    { id: "epilation_method", question: "Méthode d'épilation souhaitée ?", options: ["Cire chaude", "Cire froide / Bandes", "Laser (séance)", "Pas de préférence, le pro me conseille"] },
    { id: "epil_laser_medication", question: "Médicaments photosensibilisants ? (important pour le laser)", options: ["Non", "Oui — précisé en commentaire"] },
    { id: "epil_tan", question: "Bronzage récent ?", options: ["Non", "Oui, soleil / UV il y a moins de 2 semaines"] },
    { id: "hair_density_epil", question: "Densité de poils sur la zone ?", options: ["Fine / Peu de poils", "Moyenne", "Forte / Poils épais"] },
    { id: "epil_regularity", question: "Vous épilez-vous régulièrement ?", options: ["Oui, toutes les 3-4 semaines", "Occasionnellement", "Première fois"] },
    { id: "previous_epilation", question: "Dernière épilation de la zone ?", options: ["Moins de 2 semaines", "2-4 semaines", "Plus d'un mois"] },
    { id: "pain_sensitivity", question: "Sensibilité à la douleur ?", options: ["Très sensible", "Moyennement sensible", "Peu sensible"] },
  ],
  cils: [
    { id: "lash_treatment", question: "Quel soin cils souhaitez-vous ?", options: ["Rehaussement de cils (Lash lift)", "Extension de cils", "Teinture de cils", "Retouche / Entretien"] },
    { id: "lash_style", question: "Quel style recherchez-vous ?", options: ["Naturel / Discret", "Envoûtant / Dramatique", "Doll eyes / Rond", "Événementiel / Mégaglam"] },
    { id: "brow_treatment", question: "Inclure un soin sourcils ?", options: ["Oui, restructuration + teinture", "Oui, juste épiler / dégrossir", "Non, juste les cils"] },
    { id: "lash_history", question: "Port actuel d'extensions ?", options: ["Non, première fois", "Oui, je veux une retouche", "Oui, je veux tout refaire"] },
    { id: "lash_glue_allergy", question: "Allergie à la colle d'extension ?", options: ["Non", "Oui / déjà réagi", "Je ne sais pas"] },
    { id: "lash_makeup", question: "Maquillage waterproof au quotidien ?", options: ["Oui", "Non"] },
    { id: "eye_sensitivity", question: "Sensibilité des yeux ?", options: ["Aucune sensibilité", "Yeux sensibles / Allergiques", "Port de lentilles", "Yeux facilement larmoyants"] },
  ],
  general: [
    { id: "prep_notes", question: "Préférences particulières pour votre rendez-vous", options: ["Silence / Moment de détente", "Conseils personnalisés souhaités", "Pas de préférence"] },
    { id: "how_known", question: "Comment avez-vous connu le salon ?", options: ["Bouche-à-oreille", "Instagram / TikTok", "Google", "Passage devant le salon"] },
  ],
};

// ── Conseil du pro par catégorie (affiché au client) ──────────────────────────
const CATEGORY_TIPS = {
  coiffure: "Venez avec des cheveux propres et démêlés pour un diagnostic précis.",
  tresses: "Des cheveux propres, démêlés et étirés réduisent le temps de pose.",
  ongles: "Retirez votre vernis avant de venir si aucune dépose n'est prévue.",
  maquillage: "Venez avec une peau propre et hydratée, sans maquillage.",
  soin_visage: "Évitez le soleil et les gommages agressifs 48h avant le soin.",
  barbe: "Ne rasez pas les contours 2-3 jours avant pour un tracé net.",
  massage: "Arrivez 10 minutes en avance pour profiter pleinement de la séance.",
  epilation: "Laissez 3-4 semaines de repousse pour une épilation efficace.",
  cils: "Venez sans maquillage des yeux, et sans lentilles si possible.",
  general: "Vos réponses aident le professionnel à préparer votre rendez-vous.",
};

const CATEGORY_ICONS = {
  coiffure: Scissors, tresses: Scissors, ongles: Gem, maquillage: Paintbrush,
  soin_visage: Droplets, barbe: Zap, massage: Flower2, epilation: Sparkles, cils: Sparkles,
};

const CATEGORY_LABELS = {
  coiffure: "Coiffure", tresses: "Tresses", ongles: "Onglerie", maquillage: "Maquillage",
  soin_visage: "Soin Visage", barbe: "Barbe", massage: "Massage & Spa", epilation: "Épilation", cils: "Cils & Sourcils",
};

const STORAGE_KEY = "bb_client_service_preferences";

// Normalisation insensible aux accents : "Épilation" → "epilation"
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function StepQuestionnaire({
  booking,
  onUpdateBooking,
  onNext,
  onBack
}) {
  const primaryService = booking.services?.[0] || {};

  // Détection robuste de la catégorie : catégorie officielle, nom du service,
  // sous-catégorie et style — le tout sans accents.
  const getQuestionSet = () => {
    const fields = [primaryService.category, primaryService.title, primaryService.name, primaryService.subcategory, primaryService.style].map(norm);
    const has = (...keys) => fields.some(v => keys.some(k => v.includes(k)));
    if (has("tresse", "braid", "natte", "vanille", "locs", "cornrow")) return { key: "tresses", questions: QUESTIONNAIRES.tresses };
    if (has("cil", "sourcil", "lash", "brow")) return { key: "cils", questions: QUESTIONNAIRES.cils };
    if (has("coiff", "cheveu", "lissage", "coloration", "coupe", "brushing", "chignon")) return { key: "coiffure", questions: QUESTIONNAIRES.coiffure };
    if (has("ongle", "manucure", "manucur", "pedicure", "nail")) return { key: "ongles", questions: QUESTIONNAIRES.ongles };
    if (has("maquillage", "makeup", "maquilleur")) return { key: "maquillage", questions: QUESTIONNAIRES.maquillage };
    if (has("barbe", "rasage", "barbier")) return { key: "barbe", questions: QUESTIONNAIRES.barbe };
    if (has("massage", "spa", "bien-etre", "relax", "hammam")) return { key: "massage", questions: QUESTIONNAIRES.massage };
    if (has("epilation", "epil")) return { key: "epilation", questions: QUESTIONNAIRES.epilation };
    if (has("soin", "visage", "peau", "facial", "gommage", "hydra")) return { key: "soin_visage", questions: QUESTIONNAIRES.soin_visage };
    return { key: "general", questions: QUESTIONNAIRES.general };
  };

  const { key: catKey, questions } = getQuestionSet();
  const CatIcon = CATEGORY_ICONS[catKey] || Scissors;

  const [answers, setAnswers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const answeredCount = questions.filter(q => answers[q.id]).length;

  const [savePreference, setSavePreference] = useState(() => {
    try {
      const pref = localStorage.getItem("bb_save_preferences_enabled");
      return pref !== "false";
    } catch {}
    return true;
  });

  const handleAnswerSelect = (questionId, option) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: option };
      if (savePreference) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  };

  const toggleSavePreference = () => {
    const newVal = !savePreference;
    setSavePreference(newVal);
    try {
      localStorage.setItem("bb_save_preferences_enabled", String(newVal));
      if (!newVal) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
      }
    } catch {}
  };

  const [clientNotes, setClientNotes] = useState(booking.notes || "");

  const handleValidateStep = () => {
    onUpdateBooking({ customAnswers: answers, notes: clientNotes });
    onNext();
  };

  return (
    <div className="min-h-screen bg-[#FFF5F0] font-display" style={{ paddingBottom: "calc(220px + env(safe-area-inset-bottom, 16px))" }}>
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl px-5 pt-12 pb-4 flex items-center justify-between border-b border-gray-100 shadow-sm">
        <button onClick={onBack} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-[#E8732A] uppercase tracking-widest">Étape 2 sur 3</p>
          <p className="text-[17px] font-black text-gray-900">Vos Préférences</p>
        </div>
        <div className="w-9" />
      </div>

      <div className="px-5 pt-5 space-y-5">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                <Save className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-[13px] font-black text-gray-900">Sauvegarder mes réponses</p>
                <p className="text-[11px] text-gray-400 font-medium">Réutilisées automatiquement la prochaine fois</p>
              </div>
            </div>
            <button
              onClick={toggleSavePreference}
              className={`relative w-12 h-7 rounded-full transition-all ${savePreference ? "bg-[#E8732A]" : "bg-gray-200"}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${savePreference ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <CatIcon className="w-5 h-5 text-[#E8732A]" />
            <div className="flex-1">
              <h3 className="text-[16px] font-black text-gray-900">{CATEGORY_LABELS[catKey] || "Préparation"}</h3>
              <p className="text-[11px] text-gray-400 font-medium">
                {primaryService.title || primaryService.name || "Votre service"}
              </p>
            </div>
            {/* Progression */}
            <div className="text-right shrink-0">
              <p className="text-[12px] font-black text-[#E8732A]">{answeredCount}/{questions.length}</p>
              <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-[#E8732A] rounded-full transition-all duration-300"
                  style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Conseil du pro */}
          {CATEGORY_TIPS[catKey] && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-800 font-medium leading-relaxed">
                <span className="font-black">Conseil du pro : </span>{CATEGORY_TIPS[catKey]}
              </p>
            </div>
          )}

          <div className="space-y-5">
            {questions.map((qItem, qIdx) => {
              const currentAns = answers[qItem.id] || "";
              return (
                <div key={qItem.id} className="space-y-2.5">
                  <p className="text-[14px] font-black text-gray-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-[#E8732A] text-[12px] font-black flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    {qItem.question}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {qItem.options.map((opt) => {
                      const isSelected = currentAns === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleAnswerSelect(qItem.id, opt)}
                          className={`px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border ${
                            isSelected
                              ? "bg-[#E8732A] text-white border-[#E8732A] shadow-sm"
                              : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"
                          }`}
                        >
                          {isSelected && <span className="mr-1">✓</span>}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Commentaire client */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[13px] font-black text-gray-900">Commentaire</p>
              <p className="text-[10px] text-gray-400 font-medium">Informations pour le professionnel</p>
            </div>
          </div>
          <textarea
            value={clientNotes}
            onChange={e => setClientNotes(e.target.value)}
            placeholder="Ex: allergies, demandes spéciales, étage, code d'accès…"
            rows={3}
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-[13px] text-gray-700 font-medium outline-none border border-gray-200 focus:border-primary resize-none placeholder:text-gray-300"
          />
        </div>

      </div>

      <div className="fixed left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-3 z-[90] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ bottom: "calc(68px + env(safe-area-inset-bottom, 16px))" }}>
        <button
          onClick={handleValidateStep}
          className="w-full py-4 rounded-2xl font-black text-[15px] uppercase tracking-widest text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #E8732A, #E84466)", boxShadow: "0 8px 25px rgba(232,115,42,0.35)" }}
        >
          Continuer vers la confirmation <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
