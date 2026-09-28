// Génère public/questionnaires.json depuis le module canonique
// src/lib/questionnaires.js — exécuté à chaque build (voir package.json).
// Ce JSON est la source synchronisée pour l'agent vocal IA et l'assistant
// conversationnel Maria (widget + social-webhook).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const {
  QUESTIONNAIRE_VERSION,
  QUESTIONNAIRES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_TIPS,
} = await import("../src/lib/questionnaires.js");

const categories = {};
for (const key of Object.keys(QUESTIONNAIRES)) {
  categories[key] = {
    label: CATEGORY_LABELS[key] || key,
    icon: CATEGORY_ICONS[key] || "scissors",
    tip: CATEGORY_TIPS[key] || "",
    questions: QUESTIONNAIRES[key],
  };
}

const payload = {
  version: QUESTIONNAIRE_VERSION,
  updatedAt: new Date().toISOString(),
  source: "beautybook",
  categories,
};

mkdirSync(join(root, "public"), { recursive: true });
const out = join(root, "public", "questionnaires.json");
writeFileSync(out, JSON.stringify(payload, null, 2), "utf-8");
const total = Object.values(QUESTIONNAIRES).reduce((n, q) => n + q.length, 0);
console.log(`[questionnaires] v${QUESTIONNAIRE_VERSION} → public/questionnaires.json (${Object.keys(categories).length} catégories, ${total} questions)`);
