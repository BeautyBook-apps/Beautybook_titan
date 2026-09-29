import { grokChat } from '@/lib/grok';
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Users, CalendarCheck,
  DollarSign, Target, Zap, ChevronRight, Sparkles, Send,
  Rocket, Bot, LayoutDashboard, Magnet, PhoneCall, MessageSquareText,
  Share2, Smartphone, Globe, Crown, Flame, Lightbulb, Star,
  ArrowUpRight, Wallet, Repeat, UserPlus, Scissors, Settings2, BadgeCheck,
  CircleAlert, PartyPopper
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { entities } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { useTheme } from "@/hooks/useTheme";
import './Recherche.css';
import './AIScalingBusiness.css';

/* ── Constantes ─────────────────────────────────────────────── */
const PERIODS = [
  { id: '7d', label: '7 jours', days: 7 },
  { id: '30d', label: '30 jours', days: 30 },
  { id: '90d', label: '90 jours', days: 90 },
  { id: '12m', label: '12 mois', days: 365 },
];

const TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'objectifs', label: "Objectifs", icon: Target },
  { id: 'acquisition', label: "Acquisition", icon: Magnet },
  { id: 'equipe', label: "Équipe", icon: Users },
  { id: 'assistant', label: "Assistant IA", icon: Bot },
];

const CHANNELS = [
  { id: 'app', label: "Application", desc: "Réservations via l'app BeautyBook", icon: Smartphone, color: "#10B981", grad: "linear-gradient(135deg,#10B981,#34D399)" },
  { id: 'vocal', label: "Agent vocal", desc: "Appels traités par l'IA 24h/24", icon: PhoneCall, color: "#8B5CF6", grad: "linear-gradient(135deg,#8B5CF6,#A78BFA)" },
  { id: 'chatbot', label: "Chatbot site web", desc: "Assistant conversationnel de votre site", icon: MessageSquareText, color: "#3B82F6", grad: "linear-gradient(135deg,#3B82F6,#60A5FA)" },
  { id: 'social', label: "Réseaux sociaux IA", desc: "Campagnes et contenus générés par IA", icon: Share2, color: "#EC4899", grad: "linear-gradient(135deg,#EC4899,#F472B6)" },
  { id: 'maria', label: "Maria IA", desc: "Conciergerie IA BeautyBook", icon: Sparkles, color: "#FF6B00", grad: "linear-gradient(135deg,#FF6B00,#FFB25E)" },
  { id: 'autre', label: "Autres", desc: "Téléphone, passage, bouche-à-oreille", icon: Globe, color: "#9CA3AF", grad: "linear-gradient(135deg,#9CA3AF,#D1D5DB)" },
];

const QUICK_ACTIONS = [
  { icon: TrendingUp, label: "Analyser mon chiffre", prompt: "Analyse mon chiffre d'affaires actuel et donne-moi des recommandations concrètes pour augmenter mes revenus", gradient: "linear-gradient(135deg,#10B981,#34D399)" },
  { icon: Users, label: "Fidéliser clients", prompt: "Propose-moi des stratégies pour fidéliser mes clients et augmenter le taux de retour", gradient: "linear-gradient(135deg,#3B82F6,#60A5FA)" },
  { icon: Target, label: "Objectifs", prompt: "Aide-moi à définir des objectifs réalistes pour mon salon et crée un plan d'action", gradient: "linear-gradient(135deg,#8B5CF6,#A78BFA)" },
  { icon: Rocket, label: "Promo", prompt: "Crée une promotion attractive pour attirer de nouveaux clients dans mon salon", gradient: "linear-gradient(135deg,#FF6B00,#FFB25E)" },
  { icon: CalendarCheck, label: "Remplir mes creux", prompt: "Identifie mes jours et créneaux les plus calmes et propose un plan pour les remplir", gradient: "linear-gradient(135deg,#EC4899,#F472B6)" },
  { icon: Wallet, label: "Augmenter panier moyen", prompt: "Donne-moi des techniques concrètes pour augmenter le panier moyen de mon salon (ventes additionnelles, bundles, montées en gamme)", gradient: "linear-gradient(135deg,#F59E0B,#FBBF24)" },
];

/* ── Helpers ────────────────────────────────────────────────── */
const money = v => Number(v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const money2 = v => Number(v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const num = v => Number(v || 0).toLocaleString('fr-FR');

const rdvDate = r => new Date(r.date || r.start_time || r.start || r.rdv_date || r.created_at);
const rdvPrice = r => Number(r.total_price ?? r.price ?? r.montant ?? 0);
const isDone = r => ["confirme", "termine", "honore", "completed", "done"].includes((r.status || "").toLowerCase());
const isCancelled = r => ["annule", "cancelled", "canceled"].includes((r.status || "").toLowerCase());

function channelOf(source) {
  const s = (source || "app").toLowerCase();
  if (["receptionniste_ia", "receptionniste", "agent_vocal", "vocal", "appel_ia", "voice"].some(k => s.includes(k))) return "vocal";
  if (["chatbot", "site_web", "website", "site"].some(k => s.includes(k))) return "chatbot";
  if (["ai_social_media", "social", "instagram", "tiktok", "facebook"].some(k => s.includes(k))) return "social";
  if (s.includes("maria")) return "maria";
  if (["app", "application", "beautybook"].some(k => s.includes(k))) return "app";
  return "autre";
}

const STAFF_FIELDS = ["collaborateur", "collaboratrice", "staff", "staff_name", "praticien", "praticienne", "employe", "employee", "prestataire", "coiffeur", "esthetician"];
const staffOf = r => {
  for (const f of STAFF_FIELDS) if (r[f]) return String(r[f]).trim();
  return null;
};
const serviceNameOf = (r, servicesById) =>
  r.service_name || r.service || servicesById[r.service_id]?.title || servicesById[r.service_id]?.name || "Prestation";

function pctDelta(cur, prev) {
  if (prev > 0) return ((cur - prev) / prev) * 100;
  return cur > 0 ? 100 : 0;
}

const WD = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/* ── Sous-composants ────────────────────────────────────────── */
function DeltaBadge({ value, suffix = "%" }) {
  if (value === 0) return <span className="scaling-delta flat"><Minus className="w-3 h-3" />0{suffix}</span>;
  const up = value > 0;
  return (
    <span className={`scaling-delta ${up ? "up" : "down"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : "−"}{suffix === "pts" ? Math.round(Math.abs(value) * 10) / 10 : Math.round(Math.abs(value))}{suffix}
    </span>
  );
}

function Sparkline({ data, color = "#FF6B00", width = 120, height = 36 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / (max - min || 1)) * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const id = `sg-${color.replace("#", "")}-${data.length}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`2,${height} ${pts} ${width - 2},${height}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoalRing({ pct, size = 84, color = "#FF6B00", children }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg className="scaling-ring" width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth="10" fill="none" />
        <circle className="bar" cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="10" fill="none"
          strokeDasharray={c} strokeDashoffset={c - (c * clamped) / 100} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, action, onAction }) {
  return (
    <div className="scaling-section-head">
      <p className="scaling-eyebrow"><Sparkles size={13} /> {eyebrow}</p>
      {action && <button className="link" onClick={onAction}>{action}</button>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="scaling-empty">
      <div className="e-icon"><Icon className="w-6 h-6" /></div>
      <p className="text-[14px] font-extrabold text-gray-800">{title}</p>
      <p className="text-[12px] text-gray-500 font-medium mt-1 mb-4 max-w-[260px] mx-auto">{text}</p>
      {action && (
        <button onClick={onAction} className="bg-gray-900 text-white text-[13px] font-bold px-5 py-2.5 rounded-2xl active:scale-95">
          {action}
        </button>
      )}
    </div>
  );
}

const chartTooltipStyle = {
  background: "#111827", border: "none", borderRadius: 14, color: "#fff",
  fontSize: 12, fontWeight: 700, padding: "10px 14px",
  boxShadow: "0 10px 30px rgba(0,0,0,.3)",
};

/* ── Composant principal ──────────────────────────────────────── */
export default function AIScalingBusiness() {
  useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [periodId, setPeriodId] = useState("30d");
  const [chartMode, setChartMode] = useState("revenue");
  const [proProfile, setProProfile] = useState(null);
  const [rdvs, setRdvs] = useState([]);
  const [services, setServices] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [email, setEmail] = useState("");
  // Objectifs : AUCUNE valeur fictive par défaut. Tant que la pro n'a rien
  // défini, on affiche un état vide honnête au lieu de faux objectifs.
  const [objectives, setObjectives] = useState({ ca: null, clients: null, confirmation: null, note: null });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(null);
  // Chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  /* ── Chargement ── */
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user?.email) return;
        const em = data.user.email;
        setEmail(em);
        const profiles = await entities.ProfilPro.filter({ user_email: em }, "-created_at", 1);
        if (profiles.length > 0) setProProfile(profiles[0]);
        const [allRdvs, allServices, members] = await Promise.all([
          entities.Reservation.filter({ pro_email: em }, "-created_at", 1000).catch(() => []),
          entities.Service.filter({ pro_email: em }, "-created_at", 200).catch(() => []),
          // Vraie équipe du salon : synchronisée avec la page Équipe (MembreEquipe).
          entities.MembreEquipe.filter({ pro_email: em }, "-created_at", 50).catch(() => []),
        ]);
        setRdvs(allRdvs || []);
        setServices(allServices || []);
        setTeamMembers(members || []);
        try {
          const raw = localStorage.getItem(`bb_goals_${em}`);
          if (raw) setObjectives(o => ({ ...o, ...JSON.parse(raw) }));
        } catch {}
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, tab]);

  /* ── Période ── */
  const period = useMemo(() => {
    const days = PERIODS.find(p => p.id === periodId).days;
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = new Date(end); start.setDate(start.getDate() - days);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - days);
    return { days, start, end, prevStart };
  }, [periodId]);

  const inRange = (d, a, b) => d >= a && d <= b && !isNaN(d);

  const cur = useMemo(() => rdvs.filter(r => inRange(rdvDate(r), period.start, period.end)), [rdvs, period]);
  const prev = useMemo(() => rdvs.filter(r => inRange(rdvDate(r), period.prevStart, period.start)), [rdvs, period]);
  const doneCur = useMemo(() => cur.filter(r => isDone(r) && !isCancelled(r)), [cur]);
  const donePrev = useMemo(() => prev.filter(r => isDone(r) && !isCancelled(r)), [prev]);

  const revenueCur = useMemo(() => doneCur.reduce((s, r) => s + rdvPrice(r), 0), [doneCur]);
  const revenuePrev = useMemo(() => donePrev.reduce((s, r) => s + rdvPrice(r), 0), [donePrev]);

  const servicesById = useMemo(() => {
    const m = {};
    services.forEach(s => { if (s.id) m[s.id] = s; });
    return m;
  }, [services]);

  /* Premiers RDV par client (tous temps) */
  const firstRdvByClient = useMemo(() => {
    const m = {};
    [...rdvs].sort((a, b) => rdvDate(a) - rdvDate(b)).forEach(r => {
      const em = (r.client_email || "").toLowerCase().trim();
      if (em && !m[em]) m[em] = rdvDate(r);
    });
    return m;
  }, [rdvs]);

  const lastRdvByClient = useMemo(() => {
    const m = {};
    [...rdvs].sort((a, b) => rdvDate(b) - rdvDate(a)).forEach(r => {
      const em = (r.client_email || "").toLowerCase().trim();
      if (em && !m[em]) m[em] = rdvDate(r);
    });
    return m;
  }, [rdvs]);

  const newClientsCur = useMemo(() =>
    Object.values(firstRdvByClient).filter(d => inRange(d, period.start, period.end)).length,
    [firstRdvByClient, period]);
  const newClientsPrev = useMemo(() =>
    Object.values(firstRdvByClient).filter(d => inRange(d, period.prevStart, period.start)).length,
    [firstRdvByClient, period]);

  const panierCur = doneCur.length ? revenueCur / doneCur.length : 0;
  const panierPrev = donePrev.length ? revenuePrev / donePrev.length : 0;

  const confRateCur = cur.length ? (cur.filter(isDone).length / cur.length) * 100 : 0;
  const confRatePrev = prev.length ? (prev.filter(isDone).length / prev.length) * 100 : 0;

  const retentionCur = useMemo(() => {
    const counts = {};
    cur.forEach(r => { const em = (r.client_email || "").toLowerCase().trim(); if (em) counts[em] = (counts[em] || 0) + 1; });
    const uniq = Object.keys(counts).length;
    if (!uniq) return 0;
    return (Object.values(counts).filter(c => c > 1).length / uniq) * 100;
  }, [cur]);

  /* ── Données du graphique d'évolution ── */
  const chartData = useMemo(() => {
    const days = period.days;
    const mode = days <= 31 ? "day" : days <= 95 ? "week" : "month";
    const buckets = new Map();
    const keyOf = d => {
      if (mode === "day") return d.toISOString().slice(0, 10);
      if (mode === "week") { const t = new Date(d); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); }
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const labelOf = k => {
      if (mode === "day") { const [, m, dd] = k.split("-"); return `${parseInt(dd)} ${MONTHS[parseInt(m) - 1]}`; }
      if (mode === "week") { const [, m, dd] = k.split("-"); return `${parseInt(dd)}/${parseInt(m)}`; }
      const [, m] = k.split("-"); return MONTHS[parseInt(m) - 1];
    };
    const cursor = new Date(period.start);
    let guard = 0;
    while (cursor <= period.end && guard++ < 400) {
      const k = keyOf(cursor);
      if (!buckets.has(k)) buckets.set(k, { key: k, label: labelOf(k), revenue: 0, rdv: 0, nouveaux: 0, confirmed: 0, total: 0 });
      if (mode === "day") cursor.setDate(cursor.getDate() + 1);
      else if (mode === "week") cursor.setDate(cursor.getDate() + 7);
      else cursor.setMonth(cursor.getMonth() + 1);
    }
    cur.forEach(r => {
      const d = rdvDate(r); if (!inRange(d, period.start, period.end)) return;
      const b = buckets.get(keyOf(d)); if (!b) return;
      b.total += 1;
      if (isDone(r) && !isCancelled(r)) { b.confirmed += 1; b.revenue += rdvPrice(r); b.rdv += 1; }
    });
    Object.values(firstRdvByClient).forEach(d => {
      if (!inRange(d, period.start, period.end)) return;
      const b = buckets.get(keyOf(d)); if (b) b.nouveaux += 1;
    });
    return [...buckets.values()];
  }, [cur, firstRdvByClient, period]);

  /* ── KPIs ── */
  const kpis = useMemo(() => [
    {
      label: "Chiffre d'affaires", value: money(revenueCur), raw: revenueCur,
      delta: pctDelta(revenueCur, revenuePrev), icon: DollarSign,
      grad: "linear-gradient(135deg,#10B981,#34D399)", color: "#10B981",
      spark: chartData.map(b => Math.round(b.revenue)),
    },
    {
      label: "Rendez-vous", value: num(doneCur.length), raw: doneCur.length,
      delta: pctDelta(doneCur.length, donePrev.length), icon: CalendarCheck,
      grad: "linear-gradient(135deg,#3B82F6,#60A5FA)", color: "#3B82F6",
      spark: chartData.map(b => b.rdv),
    },
    {
      label: "Nouveaux clients", value: num(newClientsCur), raw: newClientsCur,
      delta: pctDelta(newClientsCur, newClientsPrev), icon: UserPlus,
      grad: "linear-gradient(135deg,#8B5CF6,#A78BFA)", color: "#8B5CF6",
      spark: chartData.map(b => b.nouveaux),
    },
    {
      label: "Panier moyen", value: money(panierCur), raw: panierCur,
      delta: pctDelta(panierCur, panierPrev), icon: Wallet,
      grad: "linear-gradient(135deg,#F59E0B,#FBBF24)", color: "#F59E0B",
      spark: chartData.map(b => (b.rdv ? Math.round(b.revenue / b.rdv) : 0)),
    },
    {
      label: "Taux de confirmation", value: `${Math.round(confRateCur)}%`, raw: confRateCur,
      delta: confRateCur - confRatePrev, icon: BadgeCheck, suffix: "pts",
      grad: "linear-gradient(135deg,#EC4899,#F472B6)", color: "#EC4899",
      spark: chartData.map(b => (b.total ? Math.round((b.confirmed / b.total) * 100) : 0)),
    },
    {
      label: "Taux de retour", value: `${Math.round(retentionCur)}%`, raw: retentionCur,
      delta: 0, icon: Repeat,
      grad: "linear-gradient(135deg,#FF6B00,#FFB25E)", color: "#FF6B00",
      spark: [],
    },
  ], [revenueCur, revenuePrev, doneCur, donePrev, newClientsCur, newClientsPrev, panierCur, panierPrev, confRateCur, confRatePrev, retentionCur, chartData]);

  /* ── Canaux d'acquisition ── */
  const channelStats = useMemo(() => {
    const base = CHANNELS.map(c => ({ ...c, count: 0, revenue: 0 }));
    const byId = Object.fromEntries(base.map(c => [c.id, c]));
    doneCur.forEach(r => { const c = byId[channelOf(r.source)]; c.count += 1; c.revenue += rdvPrice(r); });
    const pBase = CHANNELS.map(c => ({ id: c.id, count: 0 }));
    const pById = Object.fromEntries(pBase.map(c => [c.id, c]));
    donePrev.forEach(r => { pById[channelOf(r.source)].count += 1; });
    const totalRev = base.reduce((s, c) => s + c.revenue, 0) || 1;
    return base.map(c => ({
      ...c, share: (c.revenue / totalRev) * 100,
      avgTicket: c.count ? c.revenue / c.count : 0,
      delta: pctDelta(c.count, pById[c.id].count),
    })).sort((a, b) => b.revenue - a.revenue);
  }, [doneCur, donePrev]);

  /* ── Top services ── */
  const topServices = useMemo(() => {
    const m = {};
    doneCur.forEach(r => {
      const name = serviceNameOf(r, servicesById);
      if (!m[name]) m[name] = { name, revenue: 0, count: 0 };
      m[name].revenue += rdvPrice(r); m[name].count += 1;
    });
    return Object.values(m).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [doneCur, servicesById]);

  /* ── Équipe : synchronisée avec la vraie équipe du salon (MembreEquipe).
     Le CA de chaque membre vient des RDV auxquels il est réellement assigné
     (champ `collaborateur` de Reservation, via le détail du RDV en Gestion agenda).
     Aucun membre fictif : que des données réelles. ── */
  const teamRanking = useMemo(() => {
    // CA réel attribué par nom de collaborateur (insensible à la casse).
    const revByName = {};
    doneCur.forEach(r => {
      const name = staffOf(r);
      if (!name) return;
      const key = name.toLowerCase().trim();
      if (!revByName[key]) revByName[key] = { name, revenue: 0, count: 0 };
      revByName[key].revenue += rdvPrice(r); revByName[key].count += 1;
    });
    const norm = s => (s || "").toLowerCase().trim();
    const matchedKeys = new Set();
    const ranked = (teamMembers || []).map(m => {
      const key = norm(m.name);
      let rev = revByName[key];
      if (!rev && key) {
        // Correspondance tolérante (prénom seul, nom partiel…).
        const found = Object.keys(revByName).find(k => k.includes(key) || key.includes(k));
        if (found) rev = revByName[found];
      }
      if (rev) matchedKeys.add(norm(rev.name));
      return {
        name: m.name || "Membre",
        role: m.role || "",
        photo: m.membre_avatar || m.avatar_url || m.photo || "",
        status: m.status || "",
        revenue: rev?.revenue || 0,
        count: rev?.count || 0,
        inTeam: true,
      };
    });
    // Noms présents sur de vrais RDV mais absents de l'équipe (données réelles).
    Object.entries(revByName).forEach(([key, v]) => {
      if (!matchedKeys.has(key)) {
        ranked.push({ name: v.name, role: "", photo: "", status: "", revenue: v.revenue, count: v.count, inTeam: false });
      }
    });
    return ranked.sort((a, b) => b.revenue - a.revenue);
  }, [doneCur, teamMembers]);

  /* ── Entonnoir ── */
  const funnel = useMemo(() => {
    const created = cur.length;
    const confirmed = cur.filter(isDone).length;
    const honored = cur.filter(r => ["termine", "honore", "completed", "done"].includes((r.status || "").toLowerCase())).length;
    return [
      { label: "RDV créés", value: created, pct: 100, color: "linear-gradient(90deg,#3B82F6,#60A5FA)" },
      { label: "Confirmés", value: confirmed, pct: created ? (confirmed / created) * 100 : 0, color: "linear-gradient(90deg,#8B5CF6,#A78BFA)" },
      { label: "Honorés", value: honored, pct: created ? (honored / created) * 100 : 0, color: "linear-gradient(90deg,#10B981,#34D399)" },
    ];
  }, [cur]);

  /* ── Prévision fin de mois ── */
  const forecast = useMemo(() => {
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const elapsed = Math.max(1, now.getDate());
    const mtd = rdvs.filter(r => { const d = rdvDate(r); return d >= mStart && d <= now && isDone(r) && !isCancelled(r); })
      .reduce((s, r) => s + rdvPrice(r), 0);
    const projected = (mtd / elapsed) * daysInMonth;
    return { mtd, projected, elapsed, daysInMonth, pctOfGoal: objectives.ca ? (mtd / objectives.ca) * 100 : 0 };
  }, [rdvs, objectives.ca]);

  /* ── Insights IA ── */
  const insights = useMemo(() => {
    const out = [];
    if (!doneCur.length) return out;
    // Meilleur jour
    const byDay = Array(7).fill(0), countByDay = Array(7).fill(0);
    doneCur.forEach(r => { const d = rdvDate(r); byDay[d.getDay()] += rdvPrice(r); countByDay[d.getDay()] += 1; });
    const best = byDay.indexOf(Math.max(...byDay));
    const bestShare = revenueCur ? Math.round((byDay[best] / revenueCur) * 100) : 0;
    out.push({
      icon: Flame, color: "#FF6B00", grad: "linear-gradient(135deg,#FF6B00,#FFB25E)",
      title: `Votre jour star : ${WD[best]}`,
      text: `${bestShare}% de votre CA est généré le ${WD[best].toLowerCase()}. Sécurisez ce créneau avec vos meilleurs collaborateurs.`,
    });
    // Jour creux
    const activeDays = countByDay.map((c, i) => ({ i, c })).filter(x => x.c > 0);
    if (activeDays.length > 1) {
      const quiet = activeDays.reduce((a, b) => (a.c < b.c ? a : b));
      out.push({
        icon: Lightbulb, color: "#8B5CF6", grad: "linear-gradient(135deg,#8B5CF6,#A78BFA)",
        title: `Opportunité : le ${WD[quiet.i].toLowerCase()}`,
        text: `Seulement ${quiet.c} RDV sur la période. Une offre ciblée -20% ce jour-là pourrait combler le creux.`,
      });
    }
    // Top service
    if (topServices.length) {
      out.push({
        icon: Scissors, color: "#EC4899", grad: "linear-gradient(135deg,#EC4899,#F472B6)",
        title: `Service star : ${topServices[0].name}`,
        text: `${money(topServices[0].revenue)} générés (${topServices[0].count} prestations). Mettez-le en avant dans vos campagnes.`,
      });
    }
    // Réactivation
    const now = new Date(); const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 60);
    const dormant = Object.entries(lastRdvByClient).filter(([, d]) => d < cutoff).length;
    if (dormant > 0) {
      out.push({
        icon: UserPlus, color: "#3B82F6", grad: "linear-gradient(135deg,#3B82F6,#60A5FA)",
        title: `${dormant} clients à réactiver`,
        text: `Ils ne sont pas revenus depuis plus de 60 jours. Une campagne de relance personnalisée peut les faire revenir.`,
      });
    }
    // Confirmation
    if (confRateCur < 90 && cur.length >= 5) {
      out.push({
        icon: CircleAlert, color: "#F59E0B", grad: "linear-gradient(135deg,#F59E0B,#FBBF24)",
        title: "Taux de confirmation à surveiller",
        text: `${Math.round(confRateCur)}% de confirmation. Activez les rappels automatiques pour réduire les annulations.`,
      });
    }
    return out.slice(0, 4);
  }, [doneCur, revenueCur, topServices, lastRdvByClient, confRateCur, cur.length]);

  /* ── Objectifs : valeurs ── */
  const mtdNewClients = useMemo(() => {
    const now = new Date(); const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return Object.values(firstRdvByClient).filter(d => d >= mStart && d <= now).length;
  }, [firstRdvByClient]);

  const allGoals = useMemo(() => [
    {
      id: "ca", label: "Chiffre d'affaires", unit: "€", icon: DollarSign,
      current: forecast.mtd, target: objectives.ca, display: money(forecast.mtd), targetDisplay: money(objectives.ca),
      color: "#10B981", hint: `Projeté fin de mois : ${money(forecast.projected)}`,
    },
    {
      id: "clients", label: "Nouveaux clients", unit: "", icon: UserPlus,
      current: mtdNewClients, target: objectives.clients, display: num(mtdNewClients), targetDisplay: num(objectives.clients),
      color: "#8B5CF6", hint: "Ce mois-ci",
    },
    {
      id: "confirmation", label: "Taux de confirmation", unit: "%", icon: BadgeCheck,
      current: confRateCur, target: objectives.confirmation, display: `${Math.round(confRateCur)}%`, targetDisplay: `${objectives.confirmation}%`,
      color: "#EC4899", hint: "Sur la période sélectionnée",
    },
    {
      id: "note", label: "Note moyenne", unit: "/5", icon: Star,
      current: Number(proProfile?.rating || 0), target: objectives.note,
      display: proProfile?.rating ? `${Number(proProfile.rating).toFixed(1)}/5` : "—", targetDisplay: `${objectives.note}/5`,
      color: "#F59E0B", hint: `${num(proProfile?.reviews_count || 0)} avis clients`,
    },
  ], [forecast, mtdNewClients, confRateCur, proProfile, objectives]);

  // Seuls les objectifs réellement définis par la pro sont affichés.
  // Pas de valeurs fictives : un objectif non défini n'apparaît pas.
  const goals = useMemo(() => allGoals.filter(g => g.target != null && Number(g.target) > 0), [allGoals]);
  const hasGoals = goals.length > 0;

  // Ligne « Objectifs » pour le prompt IA : uniquement les objectifs réels.
  const objectivesLine = useMemo(() => {
    const parts = [];
    if (objectives.ca) parts.push(`CA ${money(objectives.ca)}/mois`);
    if (objectives.clients) parts.push(`${objectives.clients} nouveaux clients/mois`);
    if (objectives.confirmation) parts.push(`confirmation ${objectives.confirmation}%`);
    if (objectives.note) parts.push(`note ${objectives.note}/5`);
    return parts.length ? parts.join(", ") : "non définis par la pro";
  }, [objectives]);

  const saveObjectives = () => {
    if (!goalDraft) return;
    const next = { ...objectives, ...goalDraft };
    setObjectives(next);
    try { if (email) localStorage.setItem(`bb_goals_${email}`, JSON.stringify(next)); } catch {}
    setShowGoalModal(false);
  };

  /* ── Chat ── */
  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput(""); setLoading(true);
    setMessages(prev => [...prev, { role: "user", content }]);
    const systemPrompt = `Tu es l'assistant Business IA de BeautyBook pour les professionnels de la beauté.

CONTEXTE DU SALON:
- Nom: ${proProfile?.salon_name || "Non renseigné"}
- Ville: ${proProfile?.city || "Non renseigné"}
- Note: ${proProfile?.rating || "N/A"}/5 (${proProfile?.reviews_count || 0} avis)
- Période analysée: ${PERIODS.find(p => p.id === periodId).label}
- CA période: ${money(revenueCur)} (${doneCur.length} RDV)
- Nouveaux clients: ${newClientsCur} | Panier moyen: ${money(panierCur)}
- Taux de confirmation: ${Math.round(confRateCur)}% | Taux de retour: ${Math.round(retentionCur)}%
- Canaux: ${channelStats.map(c => `${c.label}: ${c.count} RDV / ${money(c.revenue)}`).join(" ; ")}
- Top services: ${topServices.slice(0, 3).map(s => `${s.name} (${money(s.revenue)})`).join(", ") || "Aucune donnée"}
- Objectifs: ${objectivesLine}
- Prévision fin de mois: ${money(forecast.projected)}

TU AIDES À: analyser le CA, fidéliser, définir des objectifs, créer des promos, optimiser prix et planning, développer l'acquisition (agent vocal, chatbot, app, réseaux sociaux).

STYLE: français, professionnel et accessible. Conseils concrets, chiffrés, actionnables. Listes et étapes claires. Ne.JAMAIS d'emojis.`;
    try {
      const reply = await grokChat(
        [...messages.slice(-6).map(m => ({ role: m.role, content: m.content })), { role: 'user', content }],
        { system: systemPrompt, max_tokens: 800 }
      );
      setMessages(prev => [...prev, { role: "assistant", content: reply || "Aucune réponse disponible. Vérifiez votre connexion." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Une erreur est survenue. Réessayez dans un instant." }]);
    }
    setLoading(false);
  };

  const askAI = (prompt) => { setTab("assistant"); setTimeout(() => sendMessage(prompt), 150); };

  /* ── Rendu ── */
  const salonName = proProfile?.salon_name || "votre salon";
  const hasData = rdvs.length > 0;

  return (
    <div className="scaling-page font-display h-full flex flex-col overflow-hidden">
      {/* ══ HERO (inspiré Recherche) ══ */}
      <header className="discovery-hero" style={{ flexShrink: 0 }}>
        <div className="discovery-topline">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate(-1)} aria-label="Retour"
              className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95 shrink-0">
              <ArrowLeft className="w-4.5 h-4.5 text-gray-700" size={18} />
            </button>
            <span className="discovery-eyebrow"><span className="pulse-dot" /> PILOTAGE IA · CROISSANCE</span>
          </div>
          <span className="discovery-brand">BeautyBook<span className="brand-dot">.</span></span>
        </div>

        <div className="discovery-heading" style={{ paddingBottom: 12 }}>
          <div>
            <h1>Faites décoller<br /><em>votre business.</em></h1>
            <p>{salonName} — objectifs, acquisition et revenus pilotés par l'IA.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap pb-1">
          <div className="scaling-periods">
            {PERIODS.map(p => (
              <button key={p.id} className={periodId === p.id ? "active" : ""} onClick={() => setPeriodId(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scaling-tabs" style={{ marginTop: 10 }}>
          {TABS.map(t => (
            <button key={t.id} className={`scaling-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ══ CONTENU ══ */}
      <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}>

        {/* ── VUE D'ENSEMBLE ── */}
        {tab === "overview" && (
          <div>
            {/* Hero métrique */}
            <div className="scaling-hero-metric mt-4">
              <div className="glow-orb" style={{ width: 220, height: 220, background: "#FF6B00", top: -70, right: -50 }} />
              <div className="glow-orb" style={{ width: 160, height: 160, background: "#8B5CF6", bottom: -60, left: "30%" }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/60">
                    Chiffre d'affaires · {PERIODS.find(p => p.id === periodId).label}
                  </p>
                  <DeltaBadge value={pctDelta(revenueCur, revenuePrev)} />
                </div>
                <p className="text-[38px] font-black tracking-tight mt-1">{money(revenueCur)}</p>
                <div className="flex items-end justify-between gap-4 mt-2">
                  <div>
                    <p className="text-[12px] text-white/60 font-medium">Projeté fin de mois</p>
                    <p className="text-[18px] font-extrabold text-white">{money(forecast.projected)}</p>
                    {objectives.ca ? (
                      <>
                        <div className="scaling-progress mt-2" style={{ width: 150, background: "rgba(255,255,255,.15)" }}>
                          <span style={{ width: `${Math.min(100, forecast.pctOfGoal)}%` }} />
                        </div>
                        <p className="text-[11px] text-white/50 font-medium mt-1">{Math.round(forecast.pctOfGoal)}% de l'objectif mensuel</p>
                      </>
                    ) : (
                      <button onClick={() => { setGoalDraft({ ca: "", clients: "", confirmation: "", note: "" }); setShowGoalModal(true); }}
                        className="text-[11px] text-white/70 font-bold mt-1 underline underline-offset-2 active:scale-95">
                        Définir mon objectif mensuel
                      </button>
                    )}
                  </div>
                  <div className="hidden sm:block opacity-90">
                    <Sparkline data={chartData.map(b => Math.round(b.revenue))} color="#FFB25E" width={170} height={64} />
                  </div>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <SectionHead eyebrow="Indicateurs clés" />
            <div className="scaling-kpis">
              {kpis.map(k => (
                <div key={k.label} className="scaling-kpi">
                  <div className="kpi-top">
                    <div className="kpi-icon" style={{ background: k.grad }}><k.icon size={17} /></div>
                    <DeltaBadge value={k.delta} suffix={k.suffix === "pts" ? "pts" : "%"} />
                  </div>
                  <p className="kpi-label">{k.label}</p>
                  <p className="kpi-value">{k.value}</p>
                  {k.spark.length > 1 && (
                    <div className="mt-1 opacity-80"><Sparkline data={k.spark} color={k.color} width={110} height={30} /></div>
                  )}
                </div>
              ))}
            </div>

            {/* Évolution */}
            <SectionHead eyebrow="Évolution" />
            <div className="scaling-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3>{chartMode === "revenue" ? "Revenus" : "Rendez-vous"}</h3>
                  <p className="sub">{PERIODS.find(p => p.id === periodId).label} · comparé à la période précédente</p>
                </div>
                <div className="scaling-periods">
                  <button className={chartMode === "revenue" ? "active" : ""} onClick={() => setChartMode("revenue")}>CA</button>
                  <button className={chartMode === "rdv" ? "active" : ""} onClick={() => setChartMode("rdv")}>RDV</button>
                </div>
              </div>
              <div style={{ height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF6B00" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#FF6B00" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} axisLine={false} tickLine={false}
                      tickFormatter={v => chartMode === "revenue" ? `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}€` : v} width={52} />
                    <Tooltip contentStyle={chartTooltipStyle}
                      formatter={v => [chartMode === "revenue" ? money(v) : `${v} RDV`, chartMode === "revenue" ? "CA" : "RDV"]} />
                    <Area type="monotone" dataKey={chartMode} stroke="#FF6B00" strokeWidth={3} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: "#FF6B00", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insights IA */}
            <SectionHead eyebrow="Insights IA" action="Tout demander à l'IA" onAction={() => askAI("Analyse mes données et donne-moi tes 5 meilleurs insights actionnables pour développer mon salon")} />
            {insights.length ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {insights.map((ins, i) => (
                  <div key={i} className="scaling-insight">
                    <div className="in-icon" style={{ background: ins.grad }}><ins.icon size={18} /></div>
                    <div>
                      <p className="text-[13px] font-extrabold text-gray-900">{ins.title}</p>
                      <p className="text-[12px] text-gray-600 font-medium mt-0.5 leading-relaxed">{ins.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Sparkles} title="Pas encore de données"
                text="Dès vos premiers rendez-vous, l'IA générera ici des insights personnalisés pour booster votre salon." />
            )}

            {/* Top services */}
            <SectionHead eyebrow="Services les plus rentables" />
            {topServices.length ? (
              <div className="scaling-card">
                <div className="space-y-3.5">
                  {topServices.map((s, i) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`scaling-rank ${i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : "rx"}`}>{i + 1}</span>
                          <p className="text-[13px] font-bold text-gray-800 truncate">{s.name}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-[13px] font-black">{money(s.revenue)}</p>
                          <p className="text-[10.5px] text-gray-400 font-semibold">{s.count} prestations</p>
                        </div>
                      </div>
                      <div className="scaling-progress">
                        <span style={{ width: `${topServices[0].revenue ? (s.revenue / topServices[0].revenue) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={Scissors} title="Aucun service enregistré"
                text="Vos services les plus rentables apparaîtront ici automatiquement." />
            )}
          </div>
        )}

        {/* ── OBJECTIFS ── */}
        {tab === "objectifs" && (
          <div>
            <div className="scaling-card mt-4" style={{ background: "linear-gradient(135deg,#111827,#1F2937)", border: "none", color: "#fff" }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#FF6B00,#FFB25E)", boxShadow: "0 8px 20px rgba(255,107,0,.4)" }}>
                  <Target size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white text-[15px]">Vos objectifs du mois</h3>
                  <p className="text-[12px] text-white/60 font-medium">{hasGoals ? "Définis par vous, suivis en temps réel par l'IA." : "Définissez vos objectifs, l'IA les suivra en temps réel."}</p>
                </div>
                <button onClick={() => { setGoalDraft({ ...objectives }); setShowGoalModal(true); }}
                  className="flex items-center gap-1.5 bg-white/10 border border-white/15 text-white text-[12px] font-bold px-3.5 py-2 rounded-xl active:scale-95">
                  <Settings2 size={14} /> Personnaliser
                </button>
              </div>
            </div>

            {!hasGoals ? (
              <div className="mt-3">
                <EmptyState icon={Target} title="Aucun objectif défini"
                  text="Définissez vos objectifs du mois : l'IA suivra votre progression en temps réel."
                  action="Définir mes objectifs"
                  onAction={() => { setGoalDraft({ ca: "", clients: "", confirmation: "", note: "" }); setShowGoalModal(true); }} />
              </div>
            ) : (
            <div className="grid gap-2.5 mt-3 sm:grid-cols-2">
              {goals.map(g => {
                const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
                const done = pct >= 100;
                return (
                  <div key={g.id} className="scaling-goal">
                    <GoalRing pct={pct} color={g.color}>
                      <span className="text-[15px] font-black">{Math.round(Math.min(999, pct))}%</span>
                    </GoalRing>
                    <div className="goal-info">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-extrabold text-gray-900">{g.label}</p>
                        {done && <PartyPopper size={14} className="text-amber-500" />}
                      </div>
                      <p className="text-[12px] text-gray-500 font-medium mt-0.5">{g.display} <span className="text-gray-400">/ {g.targetDisplay}</span></p>
                      <p className="text-[11px] text-gray-400 font-medium mt-1">{done ? "Objectif atteint. Fixez la barre plus haut." : g.hint}</p>
                      <div className="scaling-progress mt-2"><span style={{ width: `${Math.min(100, pct)}%`, background: g.color }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {hasGoals && (
            <div className="scaling-cta-banner mt-4">
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"><Bot size={20} className="text-white" /></div>
                <div className="flex-1">
                  <p className="text-[14px] font-extrabold">Un plan d'action sur-mesure ?</p>
                  <p className="text-[12px] text-white/80 font-medium">L'IA construit votre feuille de route vers ces objectifs.</p>
                </div>
                <button onClick={() => askAI(`Voici mes objectifs du mois : ${objectivesLine}. Où j'en suis : CA ${money(forecast.mtd)}, ${mtdNewClients} nouveaux clients, ${Math.round(confRateCur)}% de confirmation. Crée-moi un plan d'action concret et priorisé pour atteindre ces objectifs.`)}
                  className="bg-white text-purple-700 font-extrabold px-4 py-2.5 rounded-2xl text-[12px] shrink-0 active:scale-95 flex items-center gap-1">
                  Générer <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
            )}
          </div>
        )}

        {/* ── ACQUISITION ── */}
        {tab === "acquisition" && (
          <div>
            {/* Donut */}
            <div className="scaling-card mt-4">
              <h3>Mix d'acquisition</h3>
              <p className="sub mb-2">D'où vient votre chiffre d'affaires · {PERIODS.find(p => p.id === periodId).label}</p>
              {hasData ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div style={{ width: 190, height: 190, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={channelStats.filter(c => c.revenue > 0)} dataKey="revenue" nameKey="label"
                          innerRadius="64%" outerRadius="88%" paddingAngle={3} strokeWidth={0}>
                          {channelStats.filter(c => c.revenue > 0).map(c => <Cell key={c.id} fill={c.color} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} formatter={v => [money(v), "CA"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: -118, textAlign: "center", pointerEvents: "none" }}>
                      <p className="text-[20px] font-black">{money(revenueCur)}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">CA total</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    {channelStats.map(c => (
                      <div key={c.id} className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                        <p className="text-[12.5px] font-bold text-gray-700 flex-1">{c.label}</p>
                        <p className="text-[12.5px] font-black">{Math.round(c.share)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon={Magnet} title="Aucune donnée d'acquisition"
                  text="Les canaux de vos rendez-vous apparaîtront ici dès les premières réservations." />
              )}
            </div>

            {/* Cartes canaux */}
            <SectionHead eyebrow="Performance par canal" />
            <div className="space-y-2.5">
              {channelStats.map(c => (
                <div key={c.id} className="scaling-channel">
                  <div className="ch-icon" style={{ background: c.grad }}><c.icon size={21} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13.5px] font-extrabold text-gray-900">{c.label}</p>
                      <DeltaBadge value={c.delta} />
                    </div>
                    <p className="text-[11.5px] text-gray-400 font-medium">{c.desc}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-[12px] font-bold text-gray-700">
                      <span><b className="text-gray-900">{c.count}</b> RDV</span>
                      <span><b className="text-gray-900">{money(c.revenue)}</b> CA</span>
                      <span className="text-gray-400">Panier {money(c.avgTicket)}</span>
                    </div>
                    <div className="ch-bar"><span style={{ width: `${Math.min(100, c.share)}%`, background: c.color }} /></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Agent vocal CTA */}
            <div className="scaling-card mt-4" style={{ border: "1.5px solid #EDE9FE", background: "linear-gradient(135deg,#FAF5FF,#F5F3FF)" }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#8B5CF6,#A78BFA)", boxShadow: "0 8px 20px rgba(139,92,246,.35)" }}>
                  <PhoneCall size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-extrabold text-gray-900">Agent vocal 24h/24</p>
                  <p className="text-[12px] text-gray-500 font-medium">Décroche, qualifie et réserve même quand vous êtes en prestation.</p>
                </div>
                <button onClick={() => navigate("/receptionniste-ia")}
                  className="text-white font-extrabold px-4 py-2.5 rounded-2xl text-[12px] shrink-0 active:scale-95 flex items-center gap-1"
                  style={{ background: "linear-gradient(135deg,#8B5CF6,#A78BFA)" }}>
                  Activer <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Entonnoir */}
            <SectionHead eyebrow="Entonnoir de conversion" />
            <div className="scaling-card">
              <div className="space-y-2.5">
                {funnel.map((f, i) => (
                  <div key={f.label}>
                    <div className="scaling-funnel-bar" style={{ width: `${Math.max(8, f.pct)}%`, background: f.color }}>
                      <span>{f.label}</span><span>{num(f.value)}</span>
                    </div>
                    {i < funnel.length - 1 && funnel[i + 1].value > 0 && (
                      <p className="text-[11px] font-bold text-gray-400 mt-1 mb-1 ml-1">
                        → {Math.round((funnel[i + 1].value / Math.max(1, f.value)) * 100)}% de conversion
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="scaling-divider" />
              <button onClick={() => askAI("Analyse mon entonnoir de conversion (RDV créés, confirmés, honorés) et propose-moi 3 actions concrètes pour améliorer chaque étape.")}
                className="w-full flex items-center justify-center gap-2 text-[13px] font-extrabold text-purple-700 bg-purple-50 rounded-2xl py-3 active:scale-[.98]">
                <Sparkles size={16} /> Optimiser ma conversion avec l'IA
              </button>
            </div>
          </div>
        )}

        {/* ── ÉQUIPE ── */}
        {tab === "equipe" && (
          <div>
            <div className="scaling-card mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3>Chiffre d'affaires par collaborateur</h3>
                  <p className="sub">{PERIODS.find(p => p.id === periodId).label} · classé par revenus générés</p>
                </div>
                <span className="scaling-chip on"><Crown size={13} /> Top performer</span>
              </div>
            </div>

            {teamRanking.length ? (
              <div className="space-y-2.5 mt-3">
                {teamRanking.map((m, i) => {
                  const top = teamRanking[0].revenue || 1;
                  const initials = m.name.split(/[\s._-]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  const grads = ["linear-gradient(135deg,#FF6B00,#FFB25E)", "linear-gradient(135deg,#8B5CF6,#A78BFA)", "linear-gradient(135deg,#3B82F6,#60A5FA)", "linear-gradient(135deg,#10B981,#34D399)", "linear-gradient(135deg,#EC4899,#F472B6)"];
                  return (
                    <div key={`${m.name}-${i}`} className="scaling-member">
                      <span className={`scaling-rank ${i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : "rx"}`}>{i + 1}</span>
                      {m.photo ? (
                        <img src={m.photo} alt={m.name} className="scaling-avatar object-cover" style={{ padding: 0 }} />
                      ) : (
                        <div className="scaling-avatar" style={{ background: grads[i % grads.length] }}>{initials}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-extrabold text-gray-900 truncate">{m.name}{m.role ? <span className="font-semibold text-gray-400"> · {m.role}</span> : ""}</p>
                        <div className="scaling-progress mt-1.5"><span style={{ width: `${(m.revenue / top) * 100}%` }} /></div>
                        <p className="text-[11px] text-gray-400 font-semibold mt-1">
                          {m.count > 0 ? `${m.count} RDV · panier ${money(m.revenue / Math.max(1, m.count))}` : "Aucun RDV attribué sur la période"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[15px] font-black">{money(m.revenue)}</p>
                        <p className="text-[10.5px] text-gray-400 font-bold">{Math.round((m.revenue / (revenueCur || 1)) * 100)}% du CA</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="mt-3">
                <EmptyState icon={Users} title="Aucun membre dans votre équipe"
                  text="Ajoutez vos collaborateurs depuis la page Équipe pour suivre ici le chiffre d'affaires généré par chacun."
                  action="Ajouter un membre"
                  onAction={() => navigate("/pro/nouveau-membre")} />
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState icon={Users} title="Aucune donnée sur la période"
                  text="Vos collaborateurs sont bien synchronisés, mais aucun chiffre d'affaires ne leur est attribué sur cette période." />
              </div>
            )}

            {teamMembers.length > 0 && (
              <div className="scaling-insight mt-3">
                <div className="in-icon" style={{ background: "linear-gradient(135deg,#3B82F6,#60A5FA)" }}><Users size={18} /></div>
                <div>
                  <p className="text-[13px] font-extrabold text-gray-900">Équipe synchronisée</p>
                  <p className="text-[12px] text-gray-600 font-medium mt-0.5 leading-relaxed">
                    {teamMembers.length} collaborateur{teamMembers.length > 1 ? "s" : ""} · pour attribuer le CA de chacun, assignez un collaborateur à chaque RDV depuis le détail du RDV dans votre Gestion agenda.
                  </p>
                </div>
              </div>
            )}

            {teamRanking.filter(m => m.revenue > 0).length > 1 && (() => {
              const withRev = teamRanking.filter(m => m.revenue > 0);
              return (
              <div className="scaling-insight mt-3">
                <div className="in-icon" style={{ background: "linear-gradient(135deg,#10B981,#34D399)" }}><Lightbulb size={18} /></div>
                <div>
                  <p className="text-[13px] font-extrabold text-gray-900">Écart de performance</p>
                  <p className="text-[12px] text-gray-600 font-medium mt-0.5 leading-relaxed">
                    {withRev[0].name} génère {money(withRev[0].revenue - withRev[withRev.length - 1].revenue)} de plus que {withRev[withRev.length - 1].name}.
                    Organisez un partage de bonnes pratiques pour homogénéiser.
                  </p>
                </div>
              </div>
              );
            })()}

            <button onClick={() => askAI(`Mon équipe : ${teamMembers.map(m => `${m.name}${m.role ? ` (${m.role})` : ""}`).join(", ") || "aucun membre"}. Chiffre d'affaires par collaborateur sur la période : ${teamRanking.map(m => `${m.name} : ${money(m.revenue)}`).join(", ") || "aucune donnée"}. Analyse la performance de mon équipe et propose-moi un plan pour augmenter le chiffre d'affaires de chacun (formation, incentives, planning).`)}
              className="w-full mt-3 flex items-center justify-center gap-2 text-[13px] font-extrabold text-white rounded-2xl py-3.5 active:scale-[.98] shadow-lg"
              style={{ background: "linear-gradient(135deg,#FF6B00,#FFB25E)", boxShadow: "0 10px 24px rgba(255,107,0,.3)" }}>
              <Sparkles size={16} /> Coaching d'équipe par l'IA
            </button>
          </div>
        )}

        {/* ── ASSISTANT IA ── */}
        {tab === "assistant" && (
          <div className="pt-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="scaling-hero-metric">
                  <div className="glow-orb" style={{ width: 200, height: 200, background: "#FF6B00", top: -60, right: -40 }} />
                  <div className="relative z-10 flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
                      <Bot size={26} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[17px] font-black">Votre copilote business</p>
                      <p className="text-[12px] text-white/70 font-medium">Branchée sur vos données : {money(revenueCur)} de CA · {doneCur.length} RDV · {newClientsCur} nouveaux clients</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="scaling-eyebrow mb-3"><Zap size={13} /> ACTIONS RECOMMANDÉES</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {QUICK_ACTIONS.map(q => (
                      <button key={q.label} onClick={() => sendMessage(q.prompt)} className="scaling-quick">
                        <div className="q-icon" style={{ background: q.gradient }}><q.icon size={19} /></div>
                        <p className="text-[13px] font-extrabold text-gray-800">{q.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => sendMessage("Fais-moi un diagnostic complet de mon salon et un plan d'action priorisé pour les 30 prochains jours")}
                  className="w-full rounded-3xl p-5 text-left text-white active:scale-[.98]"
                  style={{ background: "linear-gradient(120deg,#111827,#374151)", boxShadow: "0 14px 30px rgba(17,24,39,.25)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#FF6B00,#FFB25E)" }}>
                      <Rocket size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-black">Diagnostic 360°</p>
                      <p className="text-[11.5px] text-white/60 font-medium">Analyse complète + plan d'action 30 jours</p>
                    </div>
                    <ChevronRight size={20} className="text-white/40 shrink-0" />
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 pb-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2.5`}>
                    {msg.role === "assistant" && <div className="scaling-chat-assistant mt-1"><Bot size={17} /></div>}
                    <div className={`max-w-[82%] px-4 py-3 rounded-2xl ${msg.role === "user"
                      ? "text-white rounded-br-md" : "bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm"}`}
                      style={msg.role === "user" ? { background: "linear-gradient(135deg,#FF6B00,#FFB25E)" } : {}}>
                      <p className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-start gap-2.5">
                    <div className="scaling-chat-assistant"><Bot size={17} /></div>
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-5 py-3.5 shadow-sm">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map(j => (
                          <span key={j} className="w-2 h-2 rounded-full animate-bounce" style={{ background: ["#FF6B00", "#FFB25E", "#FED7AA"][j], animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ BARRE DE CHAT (onglet assistant) ══ */}
      {tab === "assistant" && (
        <div className="bg-white border-t border-gray-100 shrink-0 px-5 pt-3" style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 8px))" }}>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-[11px] font-bold text-gray-400 mb-2 flex items-center gap-1">
              <Sparkles size={12} /> Nouvelle conversation
            </button>
          )}
          <div className="flex items-center gap-2.5 bg-gray-100 rounded-2xl px-4 py-2.5">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Demandez un conseil business..." className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-400 font-medium" />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30 active:scale-95 shrink-0 text-white shadow-md"
              style={{ background: "linear-gradient(135deg,#FF6B00,#FFB25E)", boxShadow: "0 6px 16px rgba(255,107,0,.3)" }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══ MODALE OBJECTIFS ══ */}
      {showGoalModal && (
        <div className="scaling-modal-backdrop" onClick={() => setShowGoalModal(false)}>
          <div className="scaling-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[17px] font-black">Personnaliser mes objectifs</h3>
              <button onClick={() => setShowGoalModal(false)} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-bold">✕</button>
            </div>
            <p className="text-[12.5px] text-gray-500 font-medium mb-5">Des objectifs clairs et suivis chaque jour par l'IA.</p>
            <div className="space-y-4">
              <div className="scaling-field">
                <label>CA mensuel visé (€)</label>
                <input type="number" min="0" step="100" value={goalDraft?.ca ?? ""}
                  onChange={e => setGoalDraft(d => ({ ...d, ca: Number(e.target.value) }))} />
              </div>
              <div className="scaling-field">
                <label>Nouveaux clients / mois</label>
                <input type="number" min="0" step="1" value={goalDraft?.clients ?? ""}
                  onChange={e => setGoalDraft(d => ({ ...d, clients: Number(e.target.value) }))} />
              </div>
              <div className="scaling-field">
                <label>Taux de confirmation visé (%)</label>
                <input type="number" min="0" max="100" step="1" value={goalDraft?.confirmation ?? ""}
                  onChange={e => setGoalDraft(d => ({ ...d, confirmation: Number(e.target.value) }))} />
              </div>
              <div className="scaling-field">
                <label>Note moyenne visée (/5)</label>
                <input type="number" min="0" max="5" step="0.1" value={goalDraft?.note ?? ""}
                  onChange={e => setGoalDraft(d => ({ ...d, note: Number(e.target.value) }))} />
              </div>
            </div>
            <button onClick={saveObjectives}
              className="w-full mt-6 text-white font-extrabold text-[14px] py-3.5 rounded-2xl active:scale-[.98]"
              style={{ background: "linear-gradient(135deg,#FF6B00,#FFB25E)", boxShadow: "0 10px 24px rgba(255,107,0,.3)" }}>
              Enregistrer mes objectifs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
