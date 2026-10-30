import { AlertTriangle, Camera, Check, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";

const TRANSLATIONS = {
  "Excellent centered framing with full face and upper body visibility, ideal for hairstyle and outfit virtual try-on.": "Cadrage centré excellent : votre visage et le haut du corps sont bien visibles, idéal pour essayer une coiffure ou une tenue.",
};

function frenchText(value) {
  const text = String(value || "").trim();
  return TRANSLATIONS[text] || text;
}

export default function PhotoAnalysis({ analysis }) {
  if (!analysis) return null;

  const ready = Boolean(analysis.quality_ok && analysis.has_person);
  const checks = [
    { label: "Visage détecté", ok: Boolean(analysis.has_person) },
    { label: "Cadrage", ok: Boolean(analysis.quality_ok) },
    { label: "Corps visible", ok: Boolean(analysis.body_visible) },
  ];

  return (
    <section
      className={`relative mt-4 overflow-hidden rounded-3xl border shadow-sm ${ready ? "border-emerald-200 bg-white" : "border-amber-200 bg-white"}`}
      role="status"
      aria-live="polite"
    >
      <div className={`relative overflow-hidden px-4 py-4 ${ready ? "bg-gradient-to-br from-emerald-50 via-white to-blue-50" : "bg-gradient-to-br from-amber-50 via-white to-orange-50"}`}>
        <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${ready ? "bg-emerald-200/40" : "bg-amber-200/40"}`} aria-hidden="true" />
        <div className="relative flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${ready ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
            {ready ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Analyse de votre photo</p>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{ready ? "Photo prête" : "À améliorer"}</span>
            </div>
            <h4 className="mt-1 text-[15px] font-black text-slate-900">{ready ? "Votre photo est idéale pour l’essayage" : "Optimisons votre photo"}</h4>
            {analysis.suggestion && <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{frenchText(analysis.suggestion)}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          {checks.map(check => (
            <div key={check.label} className={`flex min-h-11 flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center ${check.ok ? "border-emerald-100 bg-emerald-50" : "border-slate-100 bg-slate-50"}`}>
              <Check className={`h-3.5 w-3.5 ${check.ok ? "text-emerald-600" : "text-slate-300"}`} />
              <span className={`mt-1 text-[9px] font-bold leading-tight ${check.ok ? "text-emerald-700" : "text-slate-400"}`}>{check.label}</span>
            </div>
          ))}
        </div>

        {analysis.issues?.length > 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-black text-amber-800"><Lightbulb className="h-3.5 w-3.5" /> Conseils pour un meilleur résultat</p>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-amber-700">{analysis.issues.map((issue, index) => <li key={index} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{frenchText(issue)}</span></li>)}</ul>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-[10px] font-semibold text-slate-500"><Camera className="h-3.5 w-3.5 shrink-0 text-primary" /> L’IA préservera votre visage et votre identité pendant la simulation.</div>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400"><Sparkles className="h-3 w-3 text-primary" /> Analyse IA terminée</div>
    </section>
  );
}
