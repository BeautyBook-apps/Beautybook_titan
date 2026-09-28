import { useState, useEffect } from "react";
import { ArrowLeft, Save, Scissors, Gem, Paintbrush, Flower2, Sparkles, Droplets, Zap, MessageSquare, ChevronRight, Check } from "lucide-react";

const QUESTIONNAIRES = {
  coiffure: [
    { id: "hair_type", question: "Quelle est la nature de vos cheveux ?", options: ["Crépus / Afro (4A-4C)", "Bouclés / Frisés (3A-3C)", "Ondulés (2A-2C)", "Lisses (1A-1C)"] },
    { id: "hair_length", question: "Quelle est votre longueur actuelle ?", options: ["Courts (au-dessus des épaules)", "Mi-longs (sous les épaules)", "Longs (dans le dos)", "Très longs"] },
    { id: "hair_density", question: "Quelle est la densité de vos cheveux ?", options: ["Fins / Peu denses", "Densité moyenne", "Épais / Très denses"] },
    { id: "hair_history", question: "Historique capillaire récent ?", options: ["Aucun traitement récent", "Coloration (< 3 mois)", "Défrisage chimique", "Kératine / Lissage", "Mèches / Balayage"] },
    { id: "extensions_provided", question: "Fourniture des mèches / rajouts ?", options: ["Mèches fournies par le salon", "J'apporte mes propres mèches", "Pas concerné(e)"] },
    { id: "styling_preference", question: "Quel rendu recherchez-vous ?", options: ["Naturel / Everyday", "Événementiel / Sophistiqué", "Tendance / Original", "Professionnel"] },
    { id: "sensitivities", question: "Sensibilités particulières ?", options: ["Cuir chevelu sensible", "Pellicules / Dermatite", "Chute de cheveux", "Aucune particularité"] },
  ],
  tresses: [
    { id: "braid_type", question: "Quel type de tresses souhaitez-vous ?", options: ["Box Braids", "Cornrows / Tresses collées", "Twists (Passion / Spring)", "Faux Locs", "Crochet Braids", "Tresses afro"] },
    { id: "braid_length", question: "Quelle longueur ?", options: ["Courtes (au-dessus des épaules)", "Moyennes (sous les épaules)", "Longues (dans le dos)", "Très longues"] },
    { id: "braid_size", question: "Quelle taille de tresses ?", options: ["Petites / Micro", "Moyennes", "Grosses / Chunky"] },
    { id: "extensions_for_braids", question: "Fourniture des mèches ?", options: ["Mèches fournies par le salon", "J'apporte mes propres mèches", "Je ne sais pas"] },
    { id: "braid_sensitivity", question: "Sensibilité du cuir chevelu ?", options: ["Cuir chevelu sensible / fragile", "Bordures / nuque délicates", "Aucune sensibilité"] },
    { id: "expected_duration", question: "Combien de temps comptez-vous garder vos tresses ?", options: ["2-3 semaines", "1-2 mois", "2-3 mois", "Plus de 3 mois"] },
  ],
  ongles: [
    { id: "nail_type", question: "Quel type de prestation ?", options: ["Manucure classique", "Pose gel / résine", "Pose acrylique", "Semi-permanent / Vernis", "Nail art / Décoration", "Pédicure"] },
    { id: "nail_status", question: "État actuel de vos ongles ?", options: ["Ongles naturels, bon état", "Pose gel/résine à déposer", "Ongles fragiles / abîmés", "Ongles rongés"] },
    { id: "nail_length_pref", question: "Quelle longueur souhaitez-vous ?", options: ["Court / Naturel", "Moyen", "Long", "Très long (extra)"] },
    { id: "nail_shape", question: "Quelle forme d'ongle ?", options: ["Carrée", "Amande", "Stiletto", "Ronde", "Ballerine / Coffin"] },
    { id: "nail_design", question: "Type de design souhaité ?", options: ["Unie / Couleur simple", "French / Baby-boomer", "Nail art / Motifs", "Ombré / Dégradé", "Pailletés / Strass"] },
    { id: "nail_allergies", question: "Allergies ou sensibilités ?", options: ["Aucune allergie", "Allergie au gel / acrylate", "Peau sensible autour des ongles"] },
  ],
  maquillage: [
    { id: "makeup_occasion", question: "Pour quelle occasion ?", options: ["Mariage", "Soirée / Gala", "Shooting photo / Vidéo", "Événement professionnel", "Quotidien / Look naturel", "Cours / Atelier"] },
    { id: "makeup_style", question: "Quel style de maquillage ?", options: ["Naturel / Fresh", "Glamour / Sophistiqué", "Artistique / Editorial", "Proéminent / Couleurs vives"] },
    { id: "skin_type_makeup", question: "Votre type de peau ?", options: ["Sèche / Déshydratée", "Mixte", "Grasse / Acnéique", "Sensible / Réactive", "Normale"] },
    { id: "makeup_duration", question: "Le maquillage doit-il tenir longtemps ?", options: ["Quelques heures (soirée)", "Journée complète (8h+)", "Résistant à l'eau / Sport"] },
    { id: "makeup_products_pref", question: "Préférence de produits ?", options: ["Clean beauty / Bio", "Marque de prestige", "Professionnel (MUFE, Kryolan...)", "Pas de préférence"] },
    { id: "makeup_allergies", question: "Allergies ou sensibilités ?", options: ["Aucune allergie", "Allergie au cochenille / carmin", "Peau très réactive", "Port de lentilles"] },
    { id: "lash_brow", question: "Inclure cils & sourcils ?", options: ["Oui, mascara + rehaussement", "Non, juste le teint et les lèvres", "Je veux un devis pour tout"] },
  ],
  soin_visage: [
    { id: "skin_concern", question: "Votre préoccupation principale ?", options: ["Hydratation / Peau terne", "Anti-âge / Rides", "Acné / Imperfections", "Taches pigmentaires", "Rougeurs / Cuperose", "Nettoyage profond / Points noirs"] },
    { id: "skin_type_soin", question: "Votre type de peau ?", options: ["Sèche / Déshydratée", "Mixte à Grasse", "Sensible / Réactive", "Normale", "Peau mate / Foncée"] },
    { id: "skin_routine", question: "Votre routine actuelle ?", options: ["Quasi aucune routine", "Routine basique (nettoyant + crème)", "Routine avancée (sérums, exfoliants...)", "J'ai besoin de conseils"] },
    { id: "previous_treatments", question: "Soins professionnels déjà faits ?", options: ["Oui, régulièrement", "Oui, mais il y a longtemps", "Non, c'est ma première fois"] },
    { id: "sensitivities_soin", question: "Sensibilités ou allergies ?", options: ["Aucune", "Allergie connue", "Peau très réactive", "Enceinte (certaines molécules évitées)"] },
    { id: "soin_budget", question: "Avez-vous un budget en tête ?", options: ["Pas de contrainte", "Entre 30 et 60€", "Moins de 30€", "Je veux le meilleur soin possible"] },
  ],
  barbe: [
    { id: "beard_type", question: "Quel type de barbe souhaitez-vous ?", options: ["Barbe courte / Stubble", "Barbe mi-longue", "Barbe longue / Entretien", "Barbe africaine / Poils crépus"] },
    { id: "beard_style", question: "Quel style recherchez-vous ?", options: ["Taille classique / Nettoyée", "Contour net / Sharp lines", "Fade / Dégradé barbe", "Design / Motif", "Barbe complète avec moustache"] },
    { id: "beard_length", question: "Longueur actuelle de votre barbe ?", options: ["Rasée / 1-2 jours", "Courte (1-2 cm)", "Moyenne (2-5 cm)", "Longue (+5 cm)"] },
    { id: "beard_condition", question: "État de votre barbe ?", options: ["Pas de problème particulier", "Poils ternes / cassants", "Peau en dessous irritée", "Barbe irrégulière"] },
    { id: "shaving_preference", question: "Préférence de rasage ?", options: ["Rasoir classique", "Lame unique précision", "Rasage à la serviette chaude", "Pas de rasage, que la barbe"] },
    { id: "beard_products", question: "Utilisez-vous des produits barbe ?", options: ["Huile à barbe", "Baume / Cire", "Rien du tout", "Je voudrais être conseillé"] },
  ],
  massage: [
    { id: "massage_type", question: "Quel type de massage souhaitez-vous ?", options: ["Relaxant / Détente", "Sportif / Deep tissue", "Ayurvédique", "Huiles chaudes / Aromathérapie", "Réflexologie plantaire", "Je ne sais pas, le pro me conseille"] },
    { id: "target_areas", question: "Zones à traiter en priorité ?", options: ["Dos & Épaules", "Jambes & Pieds", "Tête & Nuque", "Corps entier", "Zone précise (à préciser)"] },
    { id: "pressure", question: "Intensité de pression désirez-vous ?", options: ["Douce & Relaxante", "Modérée", "Forte & Profonde", "Variable selon les zones"] },
    { id: "health_conditions", question: "Conditions de santé à signaler ?", options: ["Aucune", "Grossesse", "Douleurs chroniques", "Problèmes circulatoires", "Allergies aux huiles"] },
    { id: "massage_context", question: "Contexte de cette séance ?", options: ["Détente / Bien-être personnel", "Douleur musculaire / Stress", "Récupération sportive", "Cadeau / Moment à deux", "Première découverte"] },
    { id: "music_ambiance", question: "Ambiance musicale souhaitée ?", options: ["Musique douce / Relaxante", "Nature / Bruits d'eau", "Silence total", "Pas de préférence"] },
  ],
  epilation: [
    { id: "epilation_zone", question: "Quelle zone souhaitez-vous épiler ?", options: ["Visage (sourcils, duvet)", "Aisselles", "Jambes complètes", "Maillot", "Dos / Poitrine (homme)", "Combinaison de zones"] },
    { id: "epilation_method", question: "Méthode d'épilation souhaitée ?", options: ["Cire chaude", "Cire froide / Bandes", "Laser (séance)", "Pas de préférence, le pro me conseille"] },
    { id: "hair_density_epil", question: "Densité de poils sur la zone ?", options: ["Fine / Peu de poils", "Moyenne", "Forte / Poils épais"] },
    { id: "pain_sensitivity", question: "Sensibilité à la douleur ?", options: ["Très sensible", "Moyennement sensible", "Peu sensible"] },
    { id: "previous_epilation", question: "Dernière épilation de la zone ?", options: ["Moins de 2 semaines", "2-4 semaines", "Plus d'un mois", "Première fois"] },
  ],
  cils: [
    { id: "lash_treatment", question: "Quel soin cils souhaitez-vous ?", options: ["Rehaussement de cils (Lash lift)", "Extension de cils", "Teinture de cils", "Retouche / Entretien"] },
    { id: "lash_style", question: "Quel style recherchez-vous ?", options: ["Naturel / Discret", "Envoutant / Dramatique", "Doll eyes / Rond", "Événementiel / Mégaglam"] },
    { id: "brow_treatment", question: "Inclure un soin sourcils ?", options: ["Oui, restructuration + teinture", "Oui, juste épiler / dégrossir", "Non, juste les cils"] },
    { id: "lash_history", question: "Port actuel d'extensions ?", options: ["Non, première fois", "Oui, je veux une retouche", "Oui, je veux tout refaire"] },
    { id: "eye_sensitivity", question: "Sensibilité des yeux ?", options: ["Aucune sensibilité", "Yeux sensibles / Allergiques", "Port de lentilles", "Yeux facilement larmoiants"] },
  ],
  general: [
    { id: "prep_notes", question: "Préférences particulières pour votre rendez-vous", options: ["Silence / Moment de détente", "Conseils personnalisés souhaités", "Pas de préférence"] },
  ],
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

export default function StepQuestionnaire({
  booking,
  onUpdateBooking,
  onNext,
  onBack
}) {
  const primaryService = booking.services?.[0] || {};
  const categoryRaw = (primaryService.category || "coiffure").toLowerCase();
  const serviceName = (primaryService.title || primaryService.name || "").toLowerCase();

  const getQuestionSet = () => {
    const sub = (primaryService.subcategory || "").toLowerCase();
    const style = (primaryService.style || "").toLowerCase();
    if (categoryRaw.includes("coiff") && (sub.includes("tresse") || serviceName.includes("tresse") || serviceName.includes("braid"))) return { key: "tresses", questions: QUESTIONNAIRES.tresses };
    if (categoryRaw.includes("coiff") || categoryRaw.includes("cheveux") || categoryRaw.includes("extension")) return { key: "coiffure", questions: QUESTIONNAIRES.coiffure };
    if (categoryRaw.includes("ongle") || categoryRaw.includes("manucure") || categoryRaw.includes("pedicure")) return { key: "ongles", questions: QUESTIONNAIRES.ongles };
    if (categoryRaw.includes("maquillage") || categoryRaw.includes("makeup")) return { key: "maquillage", questions: QUESTIONNAIRES.maquillage };
    if (categoryRaw.includes("soin") || categoryRaw.includes("visage")) return { key: "soin_visage", questions: QUESTIONNAIRES.soin_visage };
    if (categoryRaw.includes("barbe") || serviceName.includes("barbe") || serviceName.includes("rasage")) return { key: "barbe", questions: QUESTIONNAIRES.barbe };
    if (categoryRaw.includes("massage") || categoryRaw.includes("spa") || categoryRaw.includes("bien-etre")) return { key: "massage", questions: QUESTIONNAIRES.massage };
    if (categoryRaw.includes("epilation") || serviceName.includes("épil")) return { key: "epilation", questions: QUESTIONNAIRES.epilation };
    if (categoryRaw.includes("cil") || categoryRaw.includes("sourcil") || serviceName.includes("cil") || serviceName.includes("sourcil")) return { key: "cils", questions: QUESTIONNAIRES.cils };
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

  const allAnswered = questions.every(q => answers[q.id]);

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
            <div>
              <h3 className="text-[16px] font-black text-gray-900">{CATEGORY_LABELS[catKey] || "Préparation"}</h3>
              <p className="text-[11px] text-gray-400 font-medium">
                {primaryService.title || primaryService.name || "Votre service"}
              </p>
            </div>
          </div>

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
