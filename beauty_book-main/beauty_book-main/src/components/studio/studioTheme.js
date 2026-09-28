import { useState, useEffect } from "react";

// Palette du studio (Montage + bibliothèque de sons) qui suit le thème choisi
// dans l'app (bb_theme : light | dark | night). La scène vidéo reste noire
// dans tous les cas, seule l'interface (chrome) s'adapte.
export function studioPalette() {
  const t = localStorage.getItem("bb_theme") || "light";
  if (t === "night") {
    return {
      BG: "#000000", CARD: "#101014", INPUT: "#141418", TRACK: "#1e1e24",
      BORDER: "rgba(255,255,255,0.09)", TXT: "#f5f5f7", MUTED: "#8e8e99",
      STAGE: "#000000",
      CLIP: "linear-gradient(135deg,#1c1c22,#26262e)", RING: "#ffffff",
    };
  }
  if (t === "dark") {
    return {
      BG: "#1a1a2e", CARD: "#23233a", INPUT: "#1f1f31", TRACK: "#2e2e45",
      BORDER: "rgba(255,255,255,0.10)", TXT: "#f5f5f7", MUTED: "#9aa0b4",
      STAGE: "#000000",
      CLIP: "linear-gradient(135deg,#2a2a38,#3a3a4a)", RING: "#ffffff",
    };
  }
  return {
    BG: "#f8f9fa", CARD: "#ffffff", INPUT: "#f1f3f5", TRACK: "#e2e5ea",
    BORDER: "#e5e7eb", TXT: "#111827", MUTED: "#6b7280",
    STAGE: "#000000",
    CLIP: "linear-gradient(135deg,#e9ebef,#dcdfe5)", RING: "#E8732A",
  };
}

export function useStudioPalette() {
  const [p, setP] = useState(studioPalette);
  useEffect(() => {
    const h = () => setP(studioPalette());
    window.addEventListener("bb-theme-change", h);
    return () => window.removeEventListener("bb-theme-change", h);
  }, []);
  return p;
}

export const STUDIO_ACCENT = "#E8732A";
