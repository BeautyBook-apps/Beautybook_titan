/**
 * ── Dictée vocale (Web Speech API) ─────────────────────────────────────────
 * La reconnaissance vocale échoue SILENCIEUSEMENT sur mobile quand :
 *  - le micro est bloqué dans les réglages (not-allowed),
 *  - une autre reconnaissance tourne déjà (conflit, ex : mode Vocal),
 *  - le réseau est coupé (network — la reco passe par les serveurs Google/Apple).
 * Ce helper traduit les codes d'erreur en messages FR actionnables,
 * au lieu de laisser l'utilisateur face à un micro qui « ne fait rien ».
 */

export function dictationErrorMessage(err) {
  switch (err) {
    case "not-allowed":
    case "service-not-allowed":
      return "Micro bloqué : autorisez l'accès au micro dans les réglages du navigateur, puis réessayez.";
    case "audio-capture":
      return "Aucun micro détecté sur cet appareil.";
    case "network":
      return "La dictée a besoin d'une connexion internet.";
    case "no-speech":
      return "Je n'ai rien entendu, parlez plus fort et réessayez.";
    default:
      return "Dictée impossible pour le moment, réessayez.";
  }
}

/** true si la dictée vocale est supportée par ce navigateur. */
export function isDictationSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
