/**
 * ── MariaChart ─────────────────────────────────────────────────────────────
 * Transforme un bloc ```chart (JSON émis par Maria) en vrai graphique coloré.
 * Rendu 100 % SVG/CSS (aucune dépendance lourde), pensé mobile-first.
 *
 * Spec JSON :
 * {
 *   "type": "kpi" | "hbar" | "bar" | "donut" | "progress",
 *   "title": "Titre du graphique",
 *   "unit": "€",                       // suffixe des valeurs ("€", "%", "")
 *   "data": [
 *     { "label": "Jan", "value": 1200, "delta": "+12%", "target": 5000, "color": "#E8732A" }
 *   ]
 * }
 * - kpi      : cartes de chiffres clés (CA, RDV, clientes…) — "delta" optionnel
 * - hbar     : barres horizontales — idéal mobile (comparaisons, top services)
 * - bar      : barres verticales (évolution dans le temps)
 * - donut    : répartition en parts (types de prestations…)
 * - progress : progression vers un objectif — "target" requis par ligne
 *
 * Règle d'or : on n'affiche QUE ce que la spec contient. Si la spec est
 * invalide, on ne rend rien (jamais de graphique inventé, jamais de crash).
 */

const PALETTE = ["#E8732A", "#f59540", "#fb7185", "#a78bfa", "#38bdf8", "#10b981", "#fbbf24", "#f472b6"];
const TYPES = ["kpi", "hbar", "bar", "donut", "progress"];

/** Parse + assainit une spec chart. Retourne null si invalide. Ne lève jamais. */
export function parseChartSpec(raw) {
  try {
    const s = JSON.parse(String(raw || "").trim());
    if (!s || typeof s !== "object" || !TYPES.includes(s.type)) return null;
    const data = Array.isArray(s.data) ? s.data.slice(0, 8) : [];
    if (data.length === 0) return null;
    const clean = [];
    for (const d of data) {
      if (!d || typeof d !== "object") continue;
      const value = Number(d.value);
      if (!Number.isFinite(value)) continue;
      const item = {
        label: String(d.label ?? "").slice(0, 24) || "—",
        value,
        color: /^#[0-9a-fA-F]{6}$/.test(String(d.color || "")) ? d.color : PALETTE[clean.length % PALETTE.length],
      };
      if (typeof d.delta === "string" && d.delta.trim()) item.delta = d.delta.trim().slice(0, 12);
      const target = Number(d.target);
      if (Number.isFinite(target) && target > 0) item.target = target;
      clean.push(item);
    }
    if (clean.length === 0) return null;
    if (s.type === "progress" && !clean.some((c) => c.target)) return null;
    return {
      type: s.type,
      title: String(s.title ?? "").slice(0, 60),
      unit: String(s.unit ?? "").slice(0, 8),
      data: clean,
    };
  } catch {
    return null;
  }
}

function fmt(value, unit) {
  const n = Number(value);
  const str = Number.isInteger(n) ? n.toLocaleString("fr-FR") : n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (unit === "€") return `${str} €`;
  if (unit === "%") return `${str} %`;
  return unit ? `${str} ${unit}` : str;
}

function ChartTitle({ title }) {
  if (!title) return null;
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1 h-5 rounded-full bg-gradient-to-b from-primary to-orange-400 shrink-0" />
      <span className="text-[13px] font-black text-gray-900">{title}</span>
    </div>
  );
}

function Kpi({ spec }) {
  return (
    <div>
      <ChartTitle title={spec.title} />
      <div className="grid grid-cols-2 gap-2">
        {spec.data.map((d, i) => (
          <div key={i} className="bg-white/80 rounded-2xl border border-orange-100 px-3 py-2.5 shadow-sm">
            <div
              className="text-[19px] font-black leading-tight bg-gradient-to-r bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, ${d.color}, ${d.color}cc)` }}
            >
              {fmt(d.value, spec.unit)}
            </div>
            <div className="text-[10.5px] font-bold text-gray-500 truncate mt-0.5">{d.label}</div>
            {d.delta && (
              <span
                className={`inline-block mt-1 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  d.delta.trim().startsWith("-") ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {d.delta}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HBar({ spec }) {
  const max = Math.max(...spec.data.map((d) => d.value), 1);
  return (
    <div>
      <ChartTitle title={spec.title} />
      <div className="space-y-2.5">
        {spec.data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-[74px] shrink-0 text-[10.5px] font-bold text-gray-600 truncate text-right">{d.label}</span>
            <div className="flex-1 h-[11px] bg-orange-100/70 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (d.value / max) * 100)}%`,
                  background: `linear-gradient(90deg, ${d.color}, ${d.color}bb)`,
                }}
              />
            </div>
            <span className="w-[62px] shrink-0 text-[10.5px] font-black text-gray-800 text-right">{fmt(d.value, spec.unit)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ spec }) {
  const max = Math.max(...spec.data.map((d) => d.value), 1);
  return (
    <div>
      <ChartTitle title={spec.title} />
      <div className="flex items-end gap-1.5 h-[118px] pt-1">
        {spec.data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <span className="text-[9.5px] font-black text-gray-700 mb-1 whitespace-nowrap">{fmt(d.value, spec.unit)}</span>
            <div
              className="w-full max-w-[34px] rounded-t-[7px]"
              style={{
                height: `${Math.max(4, (d.value / max) * 100)}%`,
                background: `linear-gradient(180deg, ${d.color}, ${d.color}99)`,
              }}
            />
            <span className="text-[9.5px] font-bold text-gray-500 mt-1 truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Donut({ spec }) {
  const total = spec.data.reduce((s, d) => s + d.value, 0);
  const R = 44;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segs = spec.data.map((d) => {
    const frac = total > 0 ? d.value / total : 0;
    const seg = { ...d, dash: frac * C, offset: acc, pct: Math.round(frac * 100) };
    acc += frac * C;
    return seg;
  });
  return (
    <div>
      <ChartTitle title={spec.title} />
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r={R} fill="none" stroke="#fdeede" strokeWidth="15" />
            {segs.map((s, i) => (
              <circle
                key={i}
                cx="56"
                cy="56"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="15"
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(0, s.dash - 1.5)} ${C - Math.max(0, s.dash - 1.5)}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 56 56)"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[15px] font-black text-gray-900 leading-none">{fmt(total, spec.unit)}</span>
            <span className="text-[9px] font-bold text-gray-400 mt-0.5">total</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {segs.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 text-[10.5px] font-bold text-gray-600 truncate">{s.label}</span>
              <span className="text-[10.5px] font-black text-gray-800">{s.pct} %</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Progress({ spec }) {
  return (
    <div>
      <ChartTitle title={spec.title} />
      <div className="space-y-3">
        {spec.data.map((d, i) => {
          const pct = d.target ? Math.min(100, Math.round((d.value / d.target) * 100)) : 0;
          return (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-bold text-gray-700 truncate">{d.label}</span>
                <span className="text-[11px] font-black" style={{ color: d.color }}>{pct} %</span>
              </div>
              <div className="h-3 bg-orange-100/70 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${d.color}, #f59540)` }}
                />
              </div>
              <div className="text-[10px] font-medium text-gray-400 mt-0.5">
                {fmt(d.value, spec.unit)} / objectif {fmt(d.target, spec.unit)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MariaChart({ spec }) {
  if (!spec) return null;
  // Repli défensif : même une spec construite à la main sans couleurs reste jolie.
  const withColors = {
    ...spec,
    data: spec.data.map((d, i) => ({ ...d, color: d.color || PALETTE[i % PALETTE.length] })),
  };
  return (
    <div className="my-3 rounded-[18px] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-rose-50 p-3.5 shadow-sm">
      {withColors.type === "kpi" && <Kpi spec={withColors} />}
      {withColors.type === "hbar" && <HBar spec={withColors} />}
      {withColors.type === "bar" && <Bar spec={withColors} />}
      {withColors.type === "donut" && <Donut spec={withColors} />}
      {withColors.type === "progress" && <Progress spec={withColors} />}
    </div>
  );
}
