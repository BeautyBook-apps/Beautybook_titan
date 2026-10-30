import { useState, useEffect } from "react";

export const THEME_BG_COLORS = {
  light: "#f8f9fa",
  dark: "#1a1a2e",
  night: "#000000",
};

const DARK_STYLES = `
  html, body, #root, #app-shell, #app-content { background-color: #1a1a2e !important; color: #f9fafb !important; }
  .font-display, .font-display > div, [class*="min-h"] { background-color: inherit; }
  .bg-white { background-color: #1f2937 !important; color: #f9fafb !important; }
  .bg-\\[\\#f5f5f5\\], .bg-\\[\\#FAF9F6\\], .bg-\\[\\#f8f9fa\\] { background-color: #1a1a2e !important; }
  .bg-gray-50 { background-color: #1f2937 !important; }
  .bg-gray-100 { background-color: #374151 !important; }
  .text-gray-900 { color: #f9fafb !important; }
  .text-gray-800 { color: #e5e7eb !important; }
  .text-gray-700 { color: #d1d5db !important; }
  .text-gray-600 { color: #9ca3af !important; }
  .text-gray-500 { color: #6b7280 !important; }
  .text-gray-400 { color: #9ca3af !important; }
  .text-gray-300 { color: #6b7280 !important; }
  .border-gray-100 { border-color: #374151 !important; }
  .border-gray-200 { border-color: #4b5563 !important; }
  .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.5) !important; }
  .bg-orange-50 { background-color: #3d2000 !important; }
  .bg-yellow-50 { background-color: #2d2500 !important; }
  .bg-purple-50 { background-color: #1e1035 !important; }
  .bg-blue-50 { background-color: #0a1929 !important; }
  .bg-teal-50 { background-color: #042424 !important; }
  .bg-green-50 { background-color: #052e16 !important; }
  .bg-pink-50 { background-color: #2d0a1e !important; }
  .bg-indigo-50 { background-color: #1e1b4b !important; }
  .bg-red-50 { background-color: #2d0a0a !important; }
  .bg-rose-50 { background-color: #2d0a14 !important; }
  .bg-cyan-50 { background-color: #021a1f !important; }
  .bg-violet-50 { background-color: #150d28 !important; }
`;

const NIGHT_STYLES = `
  html, body, #root, #app-shell, #app-content { background-color: #000000 !important; color: #f9fafb !important; }
  .font-display, .font-display > div, [class*="min-h"] { background-color: inherit; }
  .bg-white { background-color: #0a0a0a !important; color: #f9fafb !important; }
  .bg-\\[\\#f5f5f5\\], .bg-\\[\\#FAF9F6\\], .bg-\\[\\#f8f9fa\\] { background-color: #000000 !important; }
  .bg-gray-50 { background-color: #0a0a0a !important; }
  .bg-gray-100 { background-color: #141414 !important; }
  .text-gray-900 { color: #f9fafb !important; }
  .text-gray-800 { color: #e5e7eb !important; }
  .text-gray-700 { color: #d1d5db !important; }
  .text-gray-600 { color: #9ca3af !important; }
  .text-gray-500 { color: #6b7280 !important; }
  .text-gray-400 { color: #9ca3af !important; }
  .text-gray-300 { color: #6b7280 !important; }
  .border-gray-100 { border-color: #1a1a1a !important; }
  .border-gray-200 { border-color: #222222 !important; }
  .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.8) !important; }
  .bg-orange-50 { background-color: #1a0d00 !important; }
  .bg-yellow-50 { background-color: #1a1500 !important; }
  .bg-purple-50 { background-color: #0d0820 !important; }
  .bg-blue-50 { background-color: #050d18 !important; }
  .bg-teal-50 { background-color: #021414 !important; }
  .bg-green-50 { background-color: #021a0d !important; }
  .bg-pink-50 { background-color: #1a0510 !important; }
  .bg-indigo-50 { background-color: #0d0b28 !important; }
  .bg-red-50 { background-color: #1a0505 !important; }
  .bg-rose-50 { background-color: #180007 !important; }
  .bg-cyan-50 { background-color: #010d10 !important; }
  .bg-violet-50 { background-color: #0a0614 !important; }
`;

const THEMES = {
  light: { bodyBg: "#f8f9fa", bodyColor: "", styles: "" },
  dark:  { bodyBg: "#1a1a2e", bodyColor: "#f9fafb", styles: DARK_STYLES },
  night: { bodyBg: "#000000", bodyColor: "#f9fafb", styles: NIGHT_STYLES },
};

export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.bbTheme = theme;
  let styleEl = document.getElementById("bb-theme-style");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "bb-theme-style";
    document.head.appendChild(styleEl);
  }

  if (theme === "dark" || theme === "night") {
    root.classList.add("dark");
    const t = THEMES[theme];
    // Force body + root
    document.body.style.backgroundColor = t.bodyBg;
    document.body.style.color = t.bodyColor;
    document.documentElement.style.backgroundColor = t.bodyBg;
    // Force #root element
    const rootEl = document.getElementById("root");
    if (rootEl) rootEl.style.backgroundColor = t.bodyBg;
    styleEl.textContent = t.styles;
  } else {
    root.classList.remove("dark");
    document.body.style.backgroundColor = "#f8f9fa";
    document.body.style.color = "";
    document.documentElement.style.backgroundColor = "#f8f9fa";
    const rootEl = document.getElementById("root");
    if (rootEl) rootEl.style.backgroundColor = "#f8f9fa";
    styleEl.textContent = "";
  }
  localStorage.setItem("bb_theme", theme);
  window.dispatchEvent(new Event("bb-theme-change"));
}

export function useThemeBg() {
  const [bg, setBg] = useState(() => THEME_BG_COLORS[localStorage.getItem("bb_theme") || "light"] || THEME_BG_COLORS.light);
  useEffect(() => {
    const handler = () => {
      const t = localStorage.getItem("bb_theme") || "light";
      setBg(THEME_BG_COLORS[t] || THEME_BG_COLORS.light);
    };
    window.addEventListener("bb-theme-change", handler);
    return () => window.removeEventListener("bb-theme-change", handler);
  }, []);
  return bg;
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem("bb_theme") || "light");

  const setTheme = (t) => {
    setThemeState(t);
    applyTheme(t);
  };

  useEffect(() => {
    applyTheme(theme);
    // Sync state if theme changes from another component
    const handler = () => {
      const current = localStorage.getItem("bb_theme") || "light";
      setThemeState(current);
    };
    window.addEventListener("bb-theme-change", handler);
    return () => window.removeEventListener("bb-theme-change", handler);
  }, []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggleTheme };
}
