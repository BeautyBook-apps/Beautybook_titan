/**
 * ── Statistiques d'activité réelles du pro ───────────────────────────────────
 * Mêmes sources que la page Analytics (Reservation par pro_email) :
 * chiffre d'affaires, RDV, clientes, service star, pourboires, RDV à venir.
 * Utilisé par Maria pour le résumé écrit « Mon activité » — les chiffres sont
 * injectés dans le prompt système, Maria ne doit JAMAIS en inventer.
 */
import { entities } from "@/api/entities";

export async function getProActivityStats(proEmail, days = 30) {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  const sincePrev = new Date(now);
  sincePrev.setDate(sincePrev.getDate() - days * 2);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  let reservations = [];
  try {
    reservations = (await entities.Reservation.filter({ pro_email: proEmail }, "-date", 1000)) || [];
  } catch {
    reservations = [];
  }

  const inPeriod = reservations.filter(r => r.date && new Date(r.date) >= since);
  const inPrev = reservations.filter(r => r.date && new Date(r.date) >= sincePrev && new Date(r.date) < since);
  const done = inPeriod.filter(r => r.status === "termine");
  const donePrev = inPrev.filter(r => r.status === "termine");

  const sum = list => list.reduce((s, r) => s + (Number(r.total_price) || Number(r.service_price) || 0), 0);
  const revenue = Math.round(sum(done));
  const revenuePrev = Math.round(sum(donePrev));
  const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);

  const rdvCount = inPeriod.filter(r => r.status !== "annule").length;
  const rdvPrev = inPrev.filter(r => r.status !== "annule").length;
  const clients = new Set(inPeriod.filter(r => r.status !== "annule").map(r => r.client_email).filter(Boolean)).size;
  const upcoming = reservations.filter(
    r => r.date && new Date(r.date) >= todayStart && (r.status === "confirme" || r.status === "en_attente")
  ).length;

  const svcCount = {};
  done.forEach(r => { if (r.service_name) svcCount[r.service_name] = (svcCount[r.service_name] || 0) + 1; });
  const bestService = Object.keys(svcCount).sort((a, b) => svcCount[b] - svcCount[a])[0] || null;

  const tips = Math.round(done.reduce((s, r) => s + (Number(r.tip_amount) || 0), 0));

  return {
    days, revenue, revenuePrev, revenuePct: pct(revenue, revenuePrev),
    rdvCount, rdvPct: pct(rdvCount, rdvPrev), clients, upcoming,
    bestService, bestServiceCount: bestService ? svcCount[bestService] : 0, tips,
  };
}

/** Bloc texte injecté dans le prompt système de Maria (chiffres réels). */
export function formatStatsForMaria(s) {
  const sign = v => (v >= 0 ? "+" : "") + v + "%";
  return [
    `STATISTIQUES RÉELLES DU SALON — ${s.days} derniers jours (utilise UNIQUEMENT ces chiffres, n'en invente jamais) :`,
    `- Chiffre d'affaires : ${s.revenue}€ (période précédente : ${s.revenuePrev}€, évolution ${sign(s.revenuePct)})`,
    `- Rendez-vous (hors annulés) : ${s.rdvCount} (évolution ${sign(s.rdvPct)})`,
    `- Clientes actives : ${s.clients}`,
    `- RDV à venir : ${s.upcoming}`,
    `- Service le plus demandé : ${s.bestService ? `${s.bestService} (${s.bestServiceCount} fois)` : "aucun pour le moment"}`,
    `- Pourboires totaux : ${s.tips}€`,
  ].join("\n");
}
