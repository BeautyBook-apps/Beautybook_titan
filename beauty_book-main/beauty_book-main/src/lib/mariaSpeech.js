// Lecteur audio partagé de MARIA.
// Il est créé hors du composant /maria afin que les différents modes vocaux
// utilisent le même lecteur. La page Maria le nettoie à son démontage.
let mariaAudio = null;

export function getMariaAudio() {
  if (mariaAudio || typeof document === "undefined") return mariaAudio;

  mariaAudio = document.querySelector("audio[data-maria-global-audio]") || document.createElement("audio");
  mariaAudio.dataset.mariaGlobalAudio = "true";
  mariaAudio.preload = "auto";
  mariaAudio.setAttribute("playsinline", "true");
  mariaAudio.setAttribute("aria-hidden", "true");

  if (!mariaAudio.parentNode) {
    mariaAudio.style.display = "none";
    document.body.appendChild(mariaAudio);
  }

  return mariaAudio;
}

export function stopMariaAudio() {
  const audio = getMariaAudio();
  if (!audio) return;
  const objectUrl = audio.dataset.mariaObjectUrl;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    delete audio.dataset.mariaObjectUrl;
  }
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}
