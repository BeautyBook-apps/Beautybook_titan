import { useState, useMemo } from 'react';
import { RefreshCw, Wallet, Activity, MessageSquare, PhoneCall, Coins, Info, Save, ChevronDown } from 'lucide-react';
import {
  getUsageSummary, getCredit, setCredit, getRates, setRates, DEFAULT_RATES,
  fmtUSD, fmtTokens, FEATURE_LABELS,
} from '@/lib/apiUsage';
import MariaChart from '@/components/maria/MariaChart';

const FEATURE_ICONS = {
  maria: MessageSquare,
  global: Activity,
  vocal: PhoneCall,
  social: MessageSquare,
  other: Coins,
};

function Ring({ pct, size = 148 }) {
  const r = (size - 18) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  const color = p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : '#E8732A';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fdeede" strokeWidth="13" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export default function ApiUsageTab() {
  const [period, setPeriod] = useState(14);
  const [refreshKey, setRefreshKey] = useState(0);
  const [creditDraft, setCreditDraft] = useState(() => {
    const c = getCredit();
    return c != null ? String(c) : '';
  });
  const [creditSaved, setCreditSaved] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [ratesDraft, setRatesDraft] = useState(() => getRates());
  const [ratesSaved, setRatesSaved] = useState(false);

  const summary = useMemo(() => getUsageSummary(period), [period, refreshKey]);
  const { total, daily, byFeature, credit } = summary;
  const pct = credit ? (total.cost / credit) * 100 : null;

  const dailyChartSpec = useMemo(() => ({
    type: 'hbar',
    title: `Coût estimé par jour (USD)`,
    unit: '$',
    data: daily
      .filter((d) => d.cost > 0 || d.requests > 0)
      .map((d) => ({ label: d.label, value: Math.round(d.cost * 1000) / 1000 })),
  }), [daily]);

  const saveCredit = () => {
    setCredit(creditDraft);
    setCreditSaved(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setCreditSaved(false), 2500);
  };

  const saveRates = () => {
    setRates(ratesDraft);
    setRatesSaved(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRatesSaved(false), 2500);
  };

  const setModelRate = (model, field, v) => {
    const n = Number(v);
    setRatesDraft((prev) => ({
      ...prev,
      models: { ...prev.models, [model]: { ...prev.models[model], [field]: Number.isFinite(n) && n >= 0 ? n : 0 } },
    }));
  };

  const featureEntries = Object.entries(byFeature)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="space-y-4">
      {/* ── Jauge crédit ── */}
      <div className="rp-card">
        <div className="rp-card-title-row">
          <Wallet size={15} className="rp-card-icon" />
          <h3>Crédit du service IA vs utilisation</h3>
          <button className="rp-btn-ghost-sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>

        {credit == null ? (
          <div className="rp-info-box">
            <Info size={15} />
            <span>
              Indiquez le montant du crédit que vous avez chargé sur votre compte du service IA :
              l'anneau affichera votre taux d'utilisation en temps réel.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-5 my-2">
            <div className="relative shrink-0">
              <Ring pct={pct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-black text-gray-900 leading-none">
                  {pct >= 100 ? '100' : Math.round(pct * 10) / 10} %
                </span>
                <span className="text-[10px] font-bold text-gray-400 mt-1">utilisé</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[13px] text-gray-600">
                <strong className="text-gray-900">{fmtUSD(total.cost)}</strong> estimés
                sur <strong className="text-gray-900">{fmtUSD(credit)}</strong> de crédit
              </p>
              <p className="text-[11px] text-gray-400">
                {pct >= 100
                  ? '⚠️ Vous avez probablement dépassé votre crédit : rechargez votre compte du service IA.'
                  : pct >= 70
                    ? 'Votre crédit fond vite : surveillez les prochains jours.'
                    : 'Utilisation sous contrôle.'}
              </p>
              <p className="text-[11px] text-gray-400">Période : {period} derniers jours</p>
            </div>
          </div>
        )}

        <div className="rp-field" style={{ marginTop: 12 }}>
          <label className="rp-label">Crédit chargé sur le service IA (USD)</label>
          <div className="flex gap-2">
            <input
              type="number" min="0" step="1" inputMode="decimal"
              className="rp-input" style={{ flex: 1 }}
              value={creditDraft}
              onChange={(e) => setCreditDraft(e.target.value)}
              placeholder="Ex. 25"
            />
            <button className="rp-btn-ghost" onClick={saveCredit}>
              <Save size={13} /> Enregistrer
            </button>
          </div>
          {creditSaved && (
            <p className="text-[12px] font-bold text-emerald-600 mt-2">✓ Crédit enregistré.</p>
          )}
        </div>
      </div>

      {/* ── Chiffres clés ── */}
      <div className="rp-card">
        <div className="rp-card-title-row">
          <Activity size={15} className="rp-card-icon" />
          <h3>Activité — {period} derniers jours</h3>
        </div>
        <div className="flex gap-2 mb-3">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              className={`rp-btn-ghost-sm${period === d ? ' rp-btn-active' : ''}`}
              onClick={() => setPeriod(d)}
            >
              {d} j
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Coût estimé', value: fmtUSD(total.cost) },
            { label: 'Requêtes IA', value: String(total.requests) },
            { label: 'Tokens entrants', value: fmtTokens(total.tokens_in) },
            { label: 'Tokens sortants', value: fmtTokens(total.tokens_out) },
            { label: 'Minutes vocales', value: `${total.voice_min} min` },
          ].map((s) => (
            <div key={s.label} className="rp-stat-mini">
              <span className="rp-stat-mini-val">{s.value}</span>
              <span className="rp-stat-mini-label">{s.label}</span>
            </div>
          ))}
        </div>
        {dailyChartSpec.data.length > 0 && (
          <div className="mt-2"><MariaChart spec={dailyChartSpec} /></div>
        )}
      </div>

      {/* ── Par fonctionnalité ── */}
      <div className="rp-card">
        <div className="rp-card-title-row">
          <Coins size={15} className="rp-card-icon" />
          <h3>Par fonctionnalité</h3>
        </div>
        {featureEntries.length === 0 ? (
          <p className="rp-card-sub">Aucune utilisation enregistrée sur la période.</p>
        ) : (
          <div className="space-y-2">
            {featureEntries.map((f) => {
              const Icon = FEATURE_ICONS[f.key] || Coins;
              return (
                <div key={f.key} className="rp-service-row">
                  <div className="rp-service-info">
                    <strong className="flex items-center gap-2"><Icon size={13} className="rp-card-icon" /> {FEATURE_LABELS[f.key] || f.key}</strong>
                    <span>{f.requests} requêtes · {fmtTokens(f.tokens_in + f.tokens_out)} tokens{f.voice_min > 0 ? ` · ${Math.round(f.voice_min * 10) / 10} min vocal` : ''}</span>
                  </div>
                  <span className="rp-service-price">{fmtUSD(f.cost)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tarifs (avancé) ── */}
      <div className="rp-card">
        <button className="rp-card-title-row w-full text-left" onClick={() => setShowRates((s) => !s)}>
          <Info size={15} className="rp-card-icon" />
          <h3>Tarifs utilisés pour l'estimation</h3>
          <ChevronDown size={15} className={`ml-auto transition-transform ${showRates ? 'rotate-180' : ''}`} />
        </button>
        {showRates && (
          <div className="mt-2 space-y-3">
            {Object.entries(ratesDraft.models || {}).map(([model, r]) => (
              <div key={model}>
                <p className="rp-label" style={{ marginBottom: 4 }}>{r.label || model}</p>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="text-[10px] text-gray-400 font-bold">Entrée $/1M</span>
                    <input type="number" min="0" step="0.01" className="rp-input"
                      value={r.in} onChange={(e) => setModelRate(model, 'in', e.target.value)} />
                  </label>
                  <label className="flex-1">
                    <span className="text-[10px] text-gray-400 font-bold">Sortie $/1M</span>
                    <input type="number" min="0" step="0.01" className="rp-input"
                      value={r.out} onChange={(e) => setModelRate(model, 'out', e.target.value)} />
                  </label>
                </div>
              </div>
            ))}
            <div>
              <p className="rp-label" style={{ marginBottom: 4 }}>Voix temps réel ($/minute)</p>
              <input type="number" min="0" step="0.01" className="rp-input"
                value={ratesDraft.voicePerMin}
                onChange={(e) => setRatesDraft((p) => ({ ...p, voicePerMin: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
            <button className="rp-btn-ghost" onClick={saveRates}>
              <Save size={13} /> Enregistrer les tarifs
            </button>
            {ratesSaved && <p className="text-[12px] font-bold text-emerald-600">✓ Tarifs enregistrés.</p>}
            <button
              className="rp-btn-ghost-sm"
              onClick={() => { setRatesDraft(JSON.parse(JSON.stringify(DEFAULT_RATES))); }}
            >
              <RefreshCw size={12} /> Réinitialiser les tarifs par défaut
            </button>
          </div>
        )}
        <p className="rp-card-sub" style={{ marginTop: 10 }}>
          Estimations indicatives calculées depuis les tokens réellement consommés.
          Suivi local à cet appareil uniquement. Le crédit est saisi manuellement
          (le service IA n'expose pas votre solde via son API).
        </p>
      </div>
    </div>
  );
}
