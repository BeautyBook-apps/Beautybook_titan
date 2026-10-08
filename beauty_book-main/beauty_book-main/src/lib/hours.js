// ─── Helpers partagés : horaires d'ouverture ─────────────────────────────────
// Source de vérité unique pour l'interprétation ET l'affichage des horaires pro.
// Gère les plages de nuit (ex : Mode Nuit 09:00 → 07:00 le lendemain,
// c'est-à-dire une heure de fin <= heure de début).

// ─── Mode Nuit : surcouche sans destruction ───
// Quand le Mode Nuit est actif, les horaires EFFECTIFS sont 09:00 → 07:00
// (lendemain) pour tous les jours ouverts, SANS modifier les horaires de jour
// stockés. Ça évite d'écraser les horaires personnalisés (ex : 08:30 – 20:30)
// quand on active/désactive le mode nuit.
export function applyNightMode(ouverture, travailNuit) {
  if (!travailNuit || !hasHoursData(ouverture)) return ouverture;
  const night = {};
  DAY_KEYS.forEach(k => {
    const d = ouverture[k];
    if (d && d.open) {
      night[k] = { ...d, start: NIGHT_START, end: NIGHT_END };
    } else {
      night[k] = d;
    }
  });
  if (ouverture.conges) night.conges = ouverture.conges;
  return night;
}

// ─── Sélection des horaires effectifs ────

// true si l'objet ouverture contient au moins un jour renseigné.
// Un objet vide {} est considéré comme ABSENT (évite le piège `{} || fallback`
// où {} est truthy et bloque le repli sur les autres sources).
export function hasHoursData(ouverture) {
  if (!ouverture || typeof ouverture !== "object") return false;
  return DAY_KEYS.some(k => {
    const d = ouverture[k];
    return d && typeof d === "object" && (d.open === true || d.open === false || d.start || d.end);
  });
}

// Horaires effectifs d'un pro : section Horaires & Congés (ouverture/horaires),
// sinon repli sur le parcours Devenir Pro. Les objets vides sont ignorés pour
// que l'affichage soit toujours synchronisé avec la section Horaires & Congés.
export function getEffectiveOpening(proInfo, demande) {
  let base = null;
  if (proInfo && hasHoursData(proInfo.ouverture)) base = proInfo.ouverture;
  else if (proInfo && hasHoursData(proInfo.horaires)) base = proInfo.horaires;
  else base = ouvertureFromDemande(demande);

  if (!base) return null;

  // `travail_nuit` est un réglage global du profil : il doit être appliqué
  // aussi lorsque l'appelant fournit déjà des horaires personnalisés.
  const travailNuit = proInfo?.travail_nuit ?? demande?.travail_nuit;
  return applyNightMode(base, !!travailNuit);
}

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Liste groupée pour l'affichage (ex : [{ label: "Lun – Sam", hours: "09:00 – 21:00", pause, open, isToday }]).
// Retourne [] si aucun horaire n'est configuré (l'appelant affiche "Non renseigné").
export function formatOpeningHours(ouverture, now = new Date()) {
  if (!hasHoursData(ouverture)) return [];
  const parsed = DAY_KEYS.map((key, index) => {
    const d = ouverture[key] || {};
    const isOpen = d.open === true;
    return {
      key,
      short: DAYS_SHORT[index],
      full: DAYS_FULL[index],
      open: isOpen,
      start: d.start || "",
      end: d.end || "",
      pause_start: d.pause_start || "",
      pause_end: d.pause_end || "",
    };
  });

  const groups = [];
  let currentGroup = null;
  parsed.forEach((dayObj) => {
    const hoursStr = dayObj.open && dayObj.start && dayObj.end ? `${dayObj.start} – ${dayObj.end}` : "Fermé";
    const pauseStr = (dayObj.open && dayObj.pause_start && dayObj.pause_end) ? `${dayObj.pause_start} – ${dayObj.pause_end}` : "";
    const overnight = !!(dayObj.open && dayObj.start && dayObj.end && isOvernight(dayObj.start, dayObj.end));
    const keyStr = `${hoursStr}|${pauseStr}|${overnight}`;
    if (!currentGroup) {
      currentGroup = { days: [dayObj], keyStr, open: dayObj.open, hoursStr, pauseStr, overnight };
    } else if (currentGroup.keyStr === keyStr) {
      currentGroup.days.push(dayObj);
    } else {
      groups.push(currentGroup);
      currentGroup = { days: [dayObj], keyStr, open: dayObj.open, hoursStr, pauseStr, overnight };
    }
  });
  if (currentGroup) groups.push(currentGroup);

  const todayKeyIndex = (now.getDay() + 6) % 7;
  const todayKey = DAY_KEYS[todayKeyIndex];

  return groups.map(g => {
    let label = "";
    if (g.days.length === 1) {
      label = g.days[0].full;
    } else if (g.days.length === 5 && g.days[0].key === "lundi" && g.days[4].key === "vendredi") {
      label = "Lun – Ven";
    } else if (g.days.length === 6 && g.days[0].key === "lundi" && g.days[5].key === "samedi") {
      label = "Lun – Sam";
    } else if (g.days.length === 7) {
      label = "Tous les jours";
    } else {
      label = `${g.days[0].short} – ${g.days[g.days.length - 1].short}`;
    }
    return {
      label,
      hours: g.hoursStr,
      pause: g.pauseStr,
      open: g.open,
      overnight: !!g.overnight,
      isToday: g.days.some(d => d.key === todayKey),
    };
  });
}

// Statut d'ouverture actuel : { status, label, color } ou null si non configuré.
// Gère les plages de nuit (fin <= début) et le débordement du jour précédent.
export function getOpeningStatus(ouverture, now = new Date()) {
  if (!hasHoursData(ouverture)) return null;

  const conges = ouverture?.conges || [];
  const todayTs = now.getTime();
  const activeConges = conges.find(c => {
    if (!c.start || !c.end) return false;
    const s = new Date(c.start + "T00:00:00").getTime();
    const e = new Date(c.end + "T23:59:59").getTime();
    return todayTs >= s && todayTs <= e;
  });
  if (activeConges) {
    return { status: "conges", label: `En congés (${activeConges.label || "Fermé"})`, color: "bg-amber-50 text-amber-600 border-amber-200" };
  }

  const curMin = now.getHours() * 60 + now.getMinutes();
  const todayKey = DAY_KEYS_JS[now.getDay()];
  const prevKey = DAY_KEYS_JS[(now.getDay() + 6) % 7];
  const dayData = ouverture?.[todayKey];
  const prevData = ouverture?.[prevKey];

  const checkPause = (d) => {
    if (!d?.pause_start || !d?.pause_end) return null;
    const pStart = timeToMin(d.pause_start);
    const pEnd = timeToMin(d.pause_end);
    if (pStart != null && pEnd != null && curMin >= pStart && curMin <= pEnd) {
      return { status: "pause", label: `En pause (${d.pause_end})`, color: "bg-orange-50 text-orange-500 border-orange-200" };
    }
    return null;
  };

  // 1) Plage du jour (gère les plages de nuit : fin <= début)
  if (dayData?.open && dayData.start && dayData.end) {
    if (isInTimeRange(curMin, timeToMin(dayData.start), timeToMin(dayData.end))) {
      return checkPause(dayData) || { status: "open", label: `Ouvert · Ferme à ${dayData.end}`, color: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    }
  }

  // 2) Débordement : la nuit du jour précédent peut courir jusqu'au matin
  if (prevData?.open && isOvernight(prevData.start, prevData.end) && curMin <= timeToMin(prevData.end)) {
    return { status: "open", label: `Ouvert · Ferme à ${prevData.end}`, color: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  }

  if (!dayData || !dayData.open) {
    return { status: "closed", label: "Fermé aujourd'hui", color: "bg-red-50 text-red-500 border-red-200" };
  }

  if (dayData.start && curMin < timeToMin(dayData.start)) {
    return { status: "closed", label: `Fermé · Ouvre à ${dayData.start}`, color: "bg-gray-100 text-gray-600 border-gray-200" };
  }

  return { status: "closed", label: "Fermé actuellement", color: "bg-red-50 text-red-500 border-red-200" };
}

// Libellé court pour les en-têtes (ex : "Lun – Ven · 09:00 – 21:00").
// Prend la plage la plus fréquente parmi les jours ouverts.
// Retourne null si aucun horaire configuré (l'appelant affiche "Non configuré"
// plutôt qu'un faux "09h – 19h").
export function summarizeHours(ouverture) {
  if (!hasHoursData(ouverture)) return null;
  const shorts = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const fulls = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const tally = {};
  DAY_KEYS.forEach((k, i) => {
    const d = ouverture[k];
    if (d?.open && d.start && d.end) {
      const sig = `${d.start} – ${d.end}`;
      if (!tally[sig]) tally[sig] = { count: 0, first: i, last: i, sig };
      tally[sig].count += 1;
      tally[sig].last = i;
    }
  });
  const entries = Object.values(tally);
  if (entries.length === 0) return "Fermé";
  entries.sort((a, b) => b.count - a.count);
  const best = entries[0];
  const label = best.count === 1
    ? fulls[best.first]
    : (best.count === 7 ? "Tous les jours" : `${shorts[best.first]} – ${shorts[best.last]}`);
  return `${label} · ${best.sig}`;
}
// Source de vérité unique pour l'interprétation des horaires pro.
// Gère les plages de nuit (ex : Mode Nuit 09:00 → 07:00 le lendemain,
// c'est-à-dire une heure de fin <= heure de début).

export const DAY_KEYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
// Indexé par Date.getDay() (0 = dimanche)
export const DAY_KEYS_JS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// Clés de jours utilisées dans DemandeProV2 (parcours Devenir Pro)
const DEMANDE_DAY_MAP = {
  lun: "lundi", mar: "mardi", mer: "mercredi",
  jeu: "jeudi", ven: "vendredi", sam: "samedi", dim: "dimanche",
};

// Définition du Mode Nuit : 9h du matin → 7h le lendemain
export const NIGHT_START = "09:00";
export const NIGHT_END = "07:00";
export const DAY_START = "09:00";
export const DAY_END = "19:00";

export function timeToMin(t) {
  if (!t || typeof t !== "string") return null;
  const parts = t.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

// true si curMin est dans la plage [startMin, endMin].
// Si endMin <= startMin, la plage déborde sur le lendemain (nuit).
export function isInTimeRange(curMin, startMin, endMin) {
  if (startMin == null || endMin == null || curMin == null) return false;
  if (endMin <= startMin) return curMin >= startMin || curMin <= endMin;
  return curMin >= startMin && curMin <= endMin;
}

// true si la plage start → end se termine le lendemain
export function isOvernight(start, end) {
  const s = timeToMin(start);
  const e = timeToMin(end);
  return s != null && e != null && e <= s;
}

// true si ouvert maintenant, false si fermé, null si aucune donnée.
// Gère le débordement : la nuit du jour précédent peut courir jusqu'au matin.
export function isOpenNow(ouverture, now = new Date()) {
  if (!ouverture || typeof ouverture !== "object" || Object.keys(ouverture).length === 0) return null;
  const curMin = now.getHours() * 60 + now.getMinutes();
  const dayKey = DAY_KEYS_JS[now.getDay()];
  const d = ouverture[dayKey];
  if (d && d.open) {
    if (isInTimeRange(curMin, timeToMin(d.start || DAY_START), timeToMin(d.end || DAY_END))) return true;
  }
  // Nuit du jour précédent encore en cours ce matin ?
  const prevKey = DAY_KEYS_JS[(now.getDay() + 6) % 7];
  const p = ouverture[prevKey];
  if (p && p.open && isOvernight(p.start, p.end)) {
    if (curMin <= timeToMin(p.end)) return true;
  }
  return false;
}

// Construit un objet ouverture depuis une DemandeProV2 (parcours Devenir Pro).
// Retourne null si la demande ne définit aucun jour ouvert.
// Utilisé comme pré-remplissage / repli quand ProfilPro.ouverture est vide,
// pour que la section Horaires & Congés et la page client affichent la même chose.
export function ouvertureFromDemande(demande) {
  if (!demande || typeof demande !== "object") return null;
  const days = Array.isArray(demande.days) ? demande.days : [];
  const slots = Array.isArray(demande.time_slots) ? demande.time_slots : [];
  const night = !!demande.travail_nuit;
  const start = night ? NIGHT_START : (slots[0]?.start || DAY_START);
  const end = night ? NIGHT_END : (slots[0]?.end || DAY_END);
  const ouv = {};
  DAY_KEYS.forEach(k => { ouv[k] = { open: false, start: "", end: "" }; });
  let anyOpen = false;
  days.forEach(dk => {
    const key = DEMANDE_DAY_MAP[dk];
    if (key) {
      ouv[key] = { open: true, start, end };
      anyOpen = true;
    }
  });
  return anyOpen ? ouv : null;
}
