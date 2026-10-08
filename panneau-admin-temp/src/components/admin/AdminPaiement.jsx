import { useState, useEffect } from "react";
import { adminApi } from '@/lib/adminApiClient';
import { Save, Loader, CheckCircle2, CreditCard, Percent, DollarSign, Users, Briefcase, XCircle } from "lucide-react";

const DEFAULT_CONFIG = {
  // Acompte
  acompte_type: "percent", // "percent" | "fixed"
  acompte_value: 30,       // % ou montant fixe €

  // Frais d'application
  app_fee_type: "percent",
  app_fee_value: 5,

  // Annulation
  cancel_fee_type: "percent",
  cancel_fee_value: 20,
  cancel_delay_hours: 24, // délai gratuit avant prélèvement

  // Abonnements clients
  abonnement_client: {
    free:    { price: 0,   label: "Gratuit",  features: ["Réservation de base", "Accès aux styles", "Messagerie"] },
    premium: { price: 9.99, label: "Premium", features: ["Réservations illimitées", "Priorité de réservation", "Support prioritaire", "Cashback 5%", "Accès aux lives exclusifs"] },
  },

  // Abonnements pros
  abonnement_pro: {
    free:    { price: 0,    label: "Gratuit",  features: ["Profil basique", "3 services max", "Statistiques de base"] },
    pro:     { price: 29.99, label: "Pro",     features: ["Services illimités", "Calendrier avancé", "Notifications clients", "Statistiques avancées", "Badge Pro"] },
    premium: { price: 59.99, label: "Premium", features: ["Tout Pro inclus", "Publication styles", "Live streaming", "Visite 3D", "Support dédié 24/7", "Commission réduite"] },
  },
};

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-[16px] font-black text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function TypeAmountRow({ label, typeKey, valueKey, config, setConfig, suffix = "%" }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-black text-gray-600 uppercase tracking-widest">{label}</p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfig(c => ({ ...c, [typeKey]: "percent" }))}
          className={`flex-1 py-2.5 rounded-xl text-[13px] font-black border-2 transition-all ${config[typeKey] === "percent" ? "border-primary bg-orange-50 text-primary" : "border-gray-100 text-gray-400"}`}
        >
          Pourcentage (%)
        </button>
        <button
          onClick={() => setConfig(c => ({ ...c, [typeKey]: "fixed" }))}
          className={`flex-1 py-2.5 rounded-xl text-[13px] font-black border-2 transition-all ${config[typeKey] === "fixed" ? "border-primary bg-orange-50 text-primary" : "border-gray-100 text-gray-400"}`}
        >
          Montant fixe (€)
        </button>
      </div>
      <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
        <input
          type="number"
          min={0}
          step={0.5}
          value={config[valueKey]}
          onChange={e => setConfig(c => ({ ...c, [valueKey]: parseFloat(e.target.value) || 0 }))}
          className="flex-1 bg-transparent text-[20px] font-black text-gray-900 outline-none"
        />
        <span className="text-[18px] font-black text-gray-400">{config[typeKey] === "percent" ? "%" : "€"}</span>
      </div>
    </div>
  );
}

function AbonnementEditor({ label, plans, onChange }) {
  const planKeys = Object.keys(plans);
  return (
    <div className="space-y-4">
      <p className="text-[12px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
      {planKeys.map(key => (
        <div key={key} className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                value={plans[key].label}
                onChange={e => onChange(key, "label", e.target.value)}
                className="text-[15px] font-black text-gray-900 bg-transparent outline-none border-b border-gray-200 w-full pb-1"
                placeholder="Nom du plan"
              />
            </div>
            {key !== "free" && (
              <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-2 border border-gray-200">
                <input
                  type="number"
                  min={0}
                  step={0.99}
                  value={plans[key].price}
                  onChange={e => onChange(key, "price", parseFloat(e.target.value) || 0)}
                  className="w-16 text-[15px] font-black text-primary bg-transparent outline-none text-right"
                />
                <span className="text-[13px] font-black text-gray-400">€/mois</span>
              </div>
            )}
            {key === "free" && <span className="text-[13px] font-black text-gray-400 bg-white rounded-xl px-3 py-2 border border-gray-100">Gratuit</span>}
          </div>

          {/* Features */}
          <div className="space-y-2">
            {plans[key].features.map((feat, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                </div>
                <input
                  value={feat}
                  onChange={e => {
                    const newFeats = [...plans[key].features];
                    newFeats[i] = e.target.value;
                    onChange(key, "features", newFeats);
                  }}
                  className="flex-1 text-[13px] text-gray-700 bg-transparent outline-none border-b border-gray-100 py-0.5"
                />
                <button onClick={() => {
                  const newFeats = plans[key].features.filter((_, fi) => fi !== i);
                  onChange(key, "features", newFeats);
                }} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => onChange(key, "features", [...plans[key].features, "Nouvelle fonctionnalité"])}
              className="text-[12px] font-black text-primary flex items-center gap-1 mt-1"
            >
              + Ajouter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminPaiement() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recordId, setRecordId] = useState(null);

  useEffect(() => {
    adminApi.getConfig("payment_settings")
      .then(res => {
        const data = Array.isArray(res) ? res : res?.data || res;
        const results = data?.results || data || [];
        if (results[0]) {
          setRecordId(results[0].id);
          setConfig({ ...DEFAULT_CONFIG, ...results[0].value });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (recordId) {
        await adminApi.updateConfig(recordId, { value: config });
      } else {
        const { data } = await adminApi.createConfig({ key: "payment_settings", value: config });
        setRecordId(data?.result?.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const updateAboClient = (planKey, field, val) => {
    setConfig(c => ({
      ...c,
      abonnement_client: {
        ...c.abonnement_client,
        [planKey]: { ...c.abonnement_client[planKey], [field]: val }
      }
    }));
  };

  const updateAboPro = (planKey, field, val) => {
    setConfig(c => ({
      ...c,
      abonnement_pro: {
        ...c.abonnement_pro,
        [planKey]: { ...c.abonnement_pro[planKey], [field]: val }
      }
    }));
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* ── Passerelle Stripe ── */}
      <Section title="Passerelle de paiement Stripe" icon={CreditCard}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-[16px]">
                S
              </div>
              <div>
                <p className="text-[14px] font-black text-gray-900 flex items-center gap-2">
                  Stripe Payments <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">CONNECTÉ</span>
                </p>
                <p className="text-[11px] text-gray-500 font-medium">Cartes bancaires, Apple Pay, Google Pay, Link, 3D Secure 2</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full uppercase">Mode Test</span>
          </div>

          <div>
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Clé Publique Stripe (Publishable Key)</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <input
                type="text"
                readOnly
                value="pk_test_51TFtM7GVJqnzDwxZH3EHUkKXbAE6JSldMylAe6RE143lcMMENTfpcmc9i4aTaMbLxFCEW6kDtLposnUe5u5SQRBH00NN0Awwjc"
                className="flex-1 bg-transparent text-[12px] font-mono text-gray-700 outline-none select-all"
              />
              <span className="text-[11px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-gray-400 font-bold text-[10px] uppercase">Devise</p>
              <p className="font-black text-gray-800 text-[13px] mt-0.5">EUR (€)</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-gray-400 font-bold text-[10px] uppercase">Sécurité</p>
              <p className="font-black text-gray-800 text-[13px] mt-0.5">TLS / PCI-DSS</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Acompte ── */}
      <Section title="Acompte de réservation" icon={CreditCard}>
        <TypeAmountRow
          label="Montant de l'acompte"
          typeKey="acompte_type"
          valueKey="acompte_value"
          config={config}
          setConfig={setConfig}
        />
      </Section>

      {/* ── Frais d'application ── */}
      <Section title="Frais d'application (commission)" icon={Percent}>
        <TypeAmountRow
          label="Commission prélevée par BeautyBook"
          typeKey="app_fee_type"
          valueKey="app_fee_value"
          config={config}
          setConfig={setConfig}
        />
      </Section>

      {/* ── Annulation ── */}
      <Section title="Frais d'annulation" icon={XCircle}>
        <TypeAmountRow
          label="Pénalité d'annulation"
          typeKey="cancel_fee_type"
          valueKey="cancel_fee_value"
          config={config}
          setConfig={setConfig}
        />
        <div className="space-y-2">
          <p className="text-[12px] font-black text-gray-600 uppercase tracking-widest">Annulation gratuite jusqu'à (heures avant)</p>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <input
              type="number"
              min={0}
              step={1}
              value={config.cancel_delay_hours}
              onChange={e => setConfig(c => ({ ...c, cancel_delay_hours: parseInt(e.target.value) || 0 }))}
              className="flex-1 bg-transparent text-[20px] font-black text-gray-900 outline-none"
            />
            <span className="text-[16px] font-black text-gray-400">heures</span>
          </div>
        </div>
      </Section>

      {/* ── Abonnements Clients ── */}
      <Section title="Abonnements Clients" icon={Users}>
        <AbonnementEditor
          label="Plans disponibles pour les clients"
          plans={config.abonnement_client}
          onChange={updateAboClient}
        />
      </Section>

      {/* ── Abonnements Pros ── */}
      <Section title="Abonnements Professionnels" icon={Briefcase}>
        <AbonnementEditor
          label="Plans disponibles pour les professionnels"
          plans={config.abonnement_pro}
          onChange={updateAboPro}
        />
      </Section>

      {/* ── Save Button ── */}
      <div className="sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-xl"
          style={{ background: saved ? "#22c55e" : "#E8732A" }}
        >
          {saving
            ? <><Loader className="w-5 h-5 animate-spin" />Enregistrement...</>
            : saved
            ? <><CheckCircle2 className="w-5 h-5" />Enregistré !</>
            : <><Save className="w-5 h-5" />Sauvegarder les paramètres</>
          }
        </button>
      </div>
    </div>
  );
}
