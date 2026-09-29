// ─────────────────────────────────────────────────────────────────────────────
// serviceQuestions.js — questions personnalisées d'un service
// ─────────────────────────────────────────────────────────────────────────────
// Le pro définit ses questions à la création du service (étape 4). Elles sont
// stockées dans la colonne `questions` (jsonb) de la table Service — voir la
// migration supabase/migrations/20260928_add_service_questions.sql.
// Tant que la migration n'est pas appliquée, repli localStorage par service.
// Le parcours de réservation (StepQuestionnaire) lit via getEffectiveQuestions().
// ─────────────────────────────────────────────────────────────────────────────
import { getQuestionnaireForService, detectCategory } from "@/lib/questionnaires";

const FALLBACK_PREFIX = "bb_service_questions_";

export function saveQuestionsFallback(serviceId, questions) {
  if (!serviceId) return;
  try {
    localStorage.setItem(FALLBACK_PREFIX + serviceId, JSON.stringify(questions || []));
  } catch {}
}

export function loadQuestionsFallback(serviceId) {
  if (!serviceId) return [];
  try {
    const raw = localStorage.getItem(FALLBACK_PREFIX + serviceId);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Questions effectives d'un service : colonne DB d'abord, repli local ensuite.
export function getEffectiveQuestions(service = {}) {
  if (Array.isArray(service.questions) && service.questions.length > 0) {
    return service.questions;
  }
  return loadQuestionsFallback(service.id);
}

// Questions par défaut pour une catégorie (format éditable).
// type: "qcm" (options) | "ouverte" (réponse libre)
export function defaultQuestionsFor(serviceLike = {}) {
  const { questions } = getQuestionnaireForService(serviceLike);
  return (questions || []).map((q) => ({
    id: q.id,
    question: q.question,
    type: "qcm",
    options: [...(q.options || [])],
  }));
}

// Normalise une question (ancienne ou nouvelle) pour l'affichage / la réservation.
export function normalizeQuestion(q, idx = 0) {
  const opts = Array.isArray(q.options) ? q.options.filter((o) => String(o || "").trim()) : [];
  const type = q.type === "ouverte" || opts.length === 0 ? "ouverte" : "qcm";
  return {
    id: q.id || `q_${idx}`,
    question: q.question || "",
    type,
    options: type === "qcm" ? opts : [],
  };
}

// ── Catégorie selon la prestation réservée (service OU bundle) ───────────────
// Pour un bundle, la catégorie est celle DOMINANTE des prestations incluses
// (ex : un pack « coiffure + maquillage » majoritairement coiffure → questions
// coiffure). On ignore « general » sauf si tout est général.
export function dominantCategory(serviceLikes = []) {
  const cats = (serviceLikes || [])
    .map((s) => { try { return detectCategory(s || {}); } catch { return "general"; } })
    .filter((c) => c && c !== "general");
  if (cats.length === 0) return "general";
  const counts = {};
  cats.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Questions effectives pour une réservation : service OU bundle.
 * @param {Object} opts
 * @param {Object} opts.service - service réservé (prioritaire si présent)
 * @param {Object} opts.bundle - bundle réservé (ligne ServiceBundle : name, service_ids…)
 * @param {Array} opts.includedServices - lignes Service incluses dans le bundle
 * @returns {{ questions: Array, categoryKey: string, categoryLabel: string, isCustom: boolean }}
 *   questions = questions normalisées (id, question, type, options).
 */
export function getQuestionsForPrestation({ service = null, bundle = null, includedServices = [] } = {}) {
  const norm = (list) =>
    (list || [])
      .map((q, i) => normalizeQuestion(q, i))
      .filter((q) => String(q.question || "").trim());

  // 1) Service simple : questions perso du pro, sinon questionnaire de sa catégorie.
  if (service && !bundle) {
    let custom = [];
    try { custom = getEffectiveQuestions(service); } catch { custom = []; }
    if (custom.length > 0) {
      const qc = getQuestionnaireForService(service);
      return { questions: norm(custom), categoryKey: qc.key, categoryLabel: qc.label, isCustom: true, catTip: qc.tip, catIcon: qc.icon };
    }
    const q = getQuestionnaireForService(service);
    return { questions: norm(q.questions), categoryKey: q.key, categoryLabel: q.label, isCustom: false, catTip: q.tip, catIcon: q.icon };
  }

  // 2) Bundle : questionnaire de la catégorie dominante des prestations incluses.
  if (bundle) {
    const cat = dominantCategory(includedServices.length > 0 ? includedServices : [bundle]);
    const like = { category: cat, title: bundle.name || bundle.title || "", name: bundle.name || bundle.title || "" };
    const q = getQuestionnaireForService(like);
    return { questions: norm(q.questions), categoryKey: q.key, categoryLabel: q.label, isCustom: false, catTip: q.tip, catIcon: q.icon };
  }

  return { questions: [], categoryKey: "general", categoryLabel: "", isCustom: false };
}
