// ─────────────────────────────────────────────────────────────────────────────
// serviceQuestions.js — questions personnalisées d'un service
// ─────────────────────────────────────────────────────────────────────────────
// Le pro définit ses questions à la création du service (étape 4). Elles sont
// stockées dans la colonne `questions` (jsonb) de la table Service — voir la
// migration supabase/migrations/20260928_add_service_questions.sql.
// Tant que la migration n'est pas appliquée, repli localStorage par service.
// Le parcours de réservation (StepQuestionnaire) lit via getEffectiveQuestions().
// ─────────────────────────────────────────────────────────────────────────────
import { getQuestionnaireForService } from "@/lib/questionnaires";

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
