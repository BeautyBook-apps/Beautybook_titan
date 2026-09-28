import { deleteAccountCompletely, banUserPermanently } from "@/lib/adminUserManagement";
import { useState, useEffect } from "react";
import { adminApi } from "@/lib/adminApiClient";
import { supabase } from "@/api/supabaseClient";
import {
  Users, Video, Scissors, ShoppingBag, CalendarCheck, Radio,
  Palette, TrendingUp, Heart, Star, Package, Crown, Flame,
  ArrowUpRight, ArrowDownRight, Activity, DollarSign, Eye,
  UserCheck, Store, UserCircle, Trash2, Ban, AlertTriangle, BarChart2, PieChart, RefreshCw
} from "lucide-react";

// ── Micro bar chart (pure CSS/SVG) ──────────────────────────────────────────
function SparkBar({ data = [], color = "#E8732A" }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: i === data.length - 1 ? color : `${color}55`,
            transition: "height 0.3s"
          }}
        />
      ))}
    </div>
  );
}

// ── Mini donut SVG chart ─────────────────────────────────────────────────────
function DonutChart({ segments, size = 80 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;
  const r = 28;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dash = circumference * pct;
        const el = (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        );
        offset += dash;
        return el;
      })}
      <circle cx={size / 2} cy={size / 2} r={23} fill="white" />
    </svg>
  );
}

function MetricBars({ items, valueFormatter = value => value }) {
  const max = Math.max(...items.map(item => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-gray-600">{item.label}</span>
            <span className="text-[11px] font-black text-gray-900">{valueFormatter(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, background: item.color || "#E8732A" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start gap-2 mb-5">
        <Icon className="w-4 h-4 text-orange-500 mt-0.5" />
        <div>
          <h3 className="text-[13px] font-black text-gray-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, trend, color, sparkData }) {
  const colorMap = {
    orange: { bg: "from-orange-500 to-amber-500", light: "bg-orange-50", text: "text-orange-600", icon: "text-orange-500" },
    blue: { bg: "from-blue-500 to-indigo-500", light: "bg-blue-50", text: "text-blue-600", icon: "text-blue-500" },
    green: { bg: "from-emerald-500 to-teal-500", light: "bg-emerald-50", text: "text-emerald-600", icon: "text-emerald-500" },
    purple: { bg: "from-purple-500 to-violet-500", light: "bg-purple-50", text: "text-purple-600", icon: "text-purple-500" },
    rose: { bg: "from-rose-500 to-pink-500", light: "bg-rose-50", text: "text-rose-600", icon: "text-rose-500" },
    amber: { bg: "from-amber-500 to-yellow-500", light: "bg-amber-50", text: "text-amber-600", icon: "text-amber-500" },
  };
  const c = colorMap[color] || colorMap.orange;
  const isUp = trend >= 0;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.light} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
            {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-gray-500 text-[12px] font-medium mb-1">{label}</p>
      <p className="text-gray-900 text-[28px] font-black leading-none mb-1">{value ?? "–"}</p>
      {sub && <p className="text-gray-400 text-[11px]">{sub}</p>}
      {sparkData && (
        <div className="mt-3">
          <SparkBar data={sparkData} color={c.icon.replace("text-", "").includes("orange") ? "#E8732A" : undefined} />
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, color = "#E8732A" }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <div>
        <h2 className="text-[15px] font-black text-gray-900">{title}</h2>
        {subtitle && <p className="text-[12px] text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Activity Row ──────────────────────────────────────────────────────────────
function ActivityRow({ emoji, label, value, badge, badgeColor = "green" }) {
  const badgeColors = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-600",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-[18px]">{emoji}</span>
      <span className="flex-1 text-[13px] font-semibold text-gray-800">{label}</span>
      {badge && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badgeColors[badgeColor]}`}>{badge}</span>}
      {value !== undefined && <span className="text-[14px] font-black text-gray-900">{value}</span>}
    </div>
  );
}

// ── Ranking Card ──────────────────────────────────────────────────────────────
function RankingCard({ title, icon: Icon, iconColor, items = [], valueKey, suffix = "" }) {
  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
        <h3 className="text-[13px] font-black text-gray-900">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-400 text-[12px] text-center py-6">Aucune donnée</p>
      ) : (
        <div>
          {items.slice(0, 5).map((item, i) => (
            <div key={item.id || i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-[16px] w-5 shrink-0">{medals[i]}</span>
              {(item.image_url || item.avatar_url) && (
                <img src={item.image_url || item.avatar_url} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
              )}
              <span className="flex-1 text-[12px] font-bold text-gray-800 truncate">{item.title || item.name || item.salon_name || "–"}</span>
              <span className="text-[12px] font-black" style={{ color: iconColor }}>{item[valueKey] || 0}{suffix}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PRO Section ──────────────────────────────────────────────────────────────
function ProSection({ salons = [], loading }) {
  const [tab, setTab] = useState("salons");
  const salonsVerifies = salons.filter(s => s.verified);
  const salonsEnAttente = salons.filter(s => !s.verified && s.status !== "pause");
  const particuliers = salons.filter(s => s.type_activite?.toLowerCase().includes("particulier") || s.type_activite?.toLowerCase().includes("domicile") || s.type_activite?.toLowerCase().includes("indep"));
  const salonsData = salons.filter(s => !particuliers.includes(s));

  const displayed = tab === "salons" ? salonsData : particuliers;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab("salons")}
          className={`flex-1 py-3.5 text-[12px] font-black transition-colors flex items-center justify-center gap-2 ${tab === "salons" ? "text-orange-500 border-b-2 border-orange-500 bg-orange-50/50" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Store className="w-3.5 h-3.5" /> Salons ({salonsData.length})
        </button>
        <button
          onClick={() => setTab("particuliers")}
          className={`flex-1 py-3.5 text-[12px] font-black transition-colors flex items-center justify-center gap-2 ${tab === "particuliers" ? "text-purple-500 border-b-2 border-purple-500 bg-purple-50/50" : "text-gray-400 hover:text-gray-600"}`}
        >
          <UserCircle className="w-3.5 h-3.5" /> Particuliers ({particuliers.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : displayed.length === 0 ? (
        <p className="text-center text-gray-400 text-[12px] py-10">Aucun professionnel</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Profil</th>
                <th className="text-left px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Ville</th>
                <th className="text-left px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden lg:table-cell">Spécialités</th>
                <th className="text-center px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Note</th>
                <th className="text-center px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
              </tr>
            </thead>
            <tbody>
              {displayed.slice(0, 10).map(pro => (
                <tr key={pro.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {pro.avatar_url ? (
                          <img src={pro.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-orange-500 font-black text-[13px]">{(pro.salon_name || "P")[0].toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-black text-gray-900 truncate max-w-[140px]">{pro.salon_name || "–"}</p>
                        <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{pro.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-gray-600 hidden md:table-cell">{pro.city || "–"}</td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {(pro.specialites || []).slice(0, 2).map(s => (
                        <span key={s} className="text-[9px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-[12px] font-black text-amber-500">{pro.rating ? `${pro.rating}★` : "–"}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${pro.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {pro.verified ? "Vérifié" : "En attente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayed.length > 10 && (
            <p className="text-center text-[11px] text-gray-400 py-3">{displayed.length - 10} autres résultats…</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Clients Section ───────────────────────────────────────────────────────────
function ClientsSection({ users = [], loading }) {
  const [search, setSearch] = useState("");
  const clients = users.filter(u => u.role === "client" || u.role === "user" || !u.role);
  const filtered = clients.filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeClients = clients.filter(u => {
    if (!u.created_at) return false;
    const created = new Date(u.created_at);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return created > thirtyDaysAgo;
  });

  return (
    <div className="space-y-4">
      {/* Stats rapides clients */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-[28px] font-black text-blue-600">{clients.length}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Total clients</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-[28px] font-black text-emerald-600">{activeClients.length}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Nouveaux (30j)</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-[28px] font-black text-purple-600">{clients.filter(u => u.avatar_url).length}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">Profils complets</p>
        </div>
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</th>
                  <th className="text-left px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Email</th>
                  <th className="text-center px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rôle</th>
                  <th className="text-center px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden lg:table-cell">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {(filtered.length > 0 ? filtered : clients).slice(0, 15).map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-blue-600 font-black text-[13px]">{(u.full_name || u.email || "C")[0].toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-[13px] font-bold text-gray-900 truncate max-w-[120px]">{u.full_name || "Client"}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-gray-500 hidden md:table-cell truncate max-w-[180px]">{u.email}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {u.role === "admin" ? "Admin" : "Client"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-[11px] text-gray-400 hidden lg:table-cell">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminStats() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});
  const [topStyles, setTopStyles] = useState([]);
  const [topSalons, setTopSalons] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [topProduits, setTopProduits] = useState([]);
  const [liveCount, setLiveCount] = useState(0);
  const [commandesStats, setCommandesStats] = useState({ total: 0, pending: 0, ca: 0 });
  const [reservationsStats, setReservationsStats] = useState({ total: 0, pending: 0 });
  const [salons, setSalons] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeSection, setActiveSection] = useState("overview");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [analytics, setAnalytics] = useState({
    retentionRate: 0, activeClients30: 0, returningClients30: 0,
    videoViews: 0, videoLikes: 0, videoComments: 0, videoEngagement: 0,
    dailyReels: [], reservationHealth: [],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, reelsRes, stylesRes, servicesRes, produitsRes, commandesRes, reservationsRes, livesRes, salonsRes] = await Promise.all([
        adminApi.listUsers().catch(() => []),
        adminApi.listReels().catch(() => []),
        adminApi.listStyles().catch(() => []),
        adminApi.listServices().catch(() => []),
        adminApi.listProduits().catch(() => []),
        adminApi.listCommandes().catch(() => []),
        adminApi.listReservations().catch(() => []),
        adminApi.listLives().catch(() => []),
        adminApi.listProfilsPro().catch(() => []),
      ]);
      let profilesRes = [];
      try {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        profilesRes = data || [];
      } catch { profilesRes = []; }

      const users = usersRes || [];
      const reels = reelsRes || [];
      const styles = stylesRes || [];
      const services = servicesRes || [];
      const produits = produitsRes || [];
      const commandes = commandesRes || [];
      const reservations = reservationsRes || [];
      const lives = livesRes || [];
      const allSalons = salonsRes || [];

      setCounts({ users: users.length, reels: reels.length, styles: styles.length, services: services.length, produits: produits.length });
      setTopStyles(styles.sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5));
      setTopServices(services.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5));
      setTopSalons(allSalons.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5));
      setTopProduits(produits.sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 5));
      setLiveCount(lives.length);
      setSalons(allSalons);
      setUsers(profilesRes);

      const pendingCmds = commandes.filter(c => c.status === "en_attente");
      const ca = commandes.filter(c => c.status !== "annule" && c.status !== "rembourse").reduce((s, c) => s + (c.total || 0), 0);
      setCommandesStats({ total: commandes.length, pending: pendingCmds.length, ca: Math.round(ca) });
      const pendingRdv = reservations.filter(r => r.status === "en_attente");
      setReservationsStats({ total: reservations.length, pending: pendingRdv.length });

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const recentReservations = reservations.filter(r => r.date && now - new Date(r.date).getTime() <= 30 * dayMs && r.status !== "annule");
      const previousReservations = reservations.filter(r => r.date && now - new Date(r.date).getTime() > 30 * dayMs && now - new Date(r.date).getTime() <= 90 * dayMs && r.status !== "annule");
      const recentClients = new Set(recentReservations.map(r => r.client_email).filter(Boolean));
      const previousClients = new Set(previousReservations.map(r => r.client_email).filter(Boolean));
      const returningClients = [...recentClients].filter(email => previousClients.has(email)).length;
      const videoViews = reels.reduce((sum, reel) => sum + Number(reel.views || 0), 0);
      const videoLikes = reels.reduce((sum, reel) => sum + Number(reel.likes || 0), 0);
      const videoComments = reels.reduce((sum, reel) => sum + Number(reel.comments_count || 0), 0);
      const videoEngagement = videoViews > 0 ? Math.round(((videoLikes + videoComments) / videoViews) * 1000) / 10 : 0;
      const dailyReels = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now - (6 - index) * dayMs);
        const key = date.toISOString().slice(0, 10);
        return {
          label: date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
          value: reels.filter(reel => reel.created_at?.slice(0, 10) === key).length,
        };
      });
      const statusCounts = ["en_attente", "confirme", "termine", "annule"].map(status => ({
        label: status === "en_attente" ? "En attente" : status === "confirme" ? "Confirmées" : status === "termine" ? "Terminées" : "Annulées",
        value: reservations.filter(r => r.status === status).length,
        color: status === "annule" ? "#F43F5E" : status === "termine" ? "#10B981" : status === "confirme" ? "#3B82F6" : "#F59E0B",
      }));
      setAnalytics({
        retentionRate: recentClients.size > 0 ? Math.round((returningClients / recentClients.size) * 100) : 0,
        activeClients30: recentClients.size, returningClients30: returningClients,
        videoViews, videoLikes, videoComments, videoEngagement, dailyReels,
        reservationHealth: statusCounts,
      });
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Mock sparkline data (7 days)
  const spark = [4, 6, 5, 8, 7, 9, 12];
  const sparkRdv = [3, 5, 4, 6, 5, 8, 9];
  const sparkCA = [0, 0, 200, 0, 0, 300, 0];

  const SECTIONS = [
    { id: "overview", label: "Vue d'ensemble", icon: BarChart2 },
    { id: "pros", label: "Professionnels", icon: Store },
    { id: "clients", label: "Clients", icon: Users },
  ];

  // Donut data for user breakdown
  const clientCount = users.filter(u => u.role === "client" || u.role === "user" || !u.role).length;
  const adminCount = users.filter(u => u.role === "admin").length;
  const prosCount = salons.length;

  const donutData = [
    { value: clientCount, color: "#3B82F6" },
    { value: prosCount, color: "#E8732A" },
    { value: adminCount, color: "#8B5CF6" },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-10 h-10 border-3 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" style={{ borderWidth: 3 }} />
      <p className="text-[13px] text-gray-400 font-medium">Chargement des données...</p>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Section Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
          {SECTIONS.map(sec => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-black transition-all ${activeSection === sec.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <sec.icon className="w-3.5 h-3.5" />
              {sec.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-gray-400 hidden sm:block">
            Actualisé à {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === "overview" && (
        <div className="space-y-6">

          {/* KPIs Globaux */}
          <div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Indicateurs clés</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard icon={Users} label="Utilisateurs" value={counts.users} sub="Total inscrits" trend={12} color="blue" sparkData={spark} />
              <KPICard icon={Store} label="Pros actifs" value={salons.length} sub={`${salons.filter(s => s.verified).length} vérifiés`} trend={8} color="orange" sparkData={spark} />
              <KPICard icon={CalendarCheck} label="Réservations" value={reservationsStats.total} sub={`${reservationsStats.pending} en attente`} trend={5} color="green" sparkData={sparkRdv} />
              <KPICard icon={DollarSign} label="CA estimé" value={`${commandesStats.ca}€`} sub="Commandes validées" trend={commandesStats.ca > 0 ? 15 : 0} color="amber" sparkData={sparkCA} />
            </div>
          </div>

          {/* KPIs Contenu */}
          <div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Contenu & Engagement</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard icon={Video} label="Réels publiés" value={counts.reels} trend={3} color="purple" />
              <KPICard icon={Palette} label="Styles" value={counts.styles} trend={7} color="rose" />
              <KPICard icon={Radio} label="Lives actifs" value={liveCount} color="orange" />
              <KPICard icon={Scissors} label="Services" value={counts.services} trend={2} color="blue" />
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Répartition utilisateurs */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <PieChart className="w-4 h-4 text-orange-500" />
                <h3 className="text-[13px] font-black text-gray-900">Répartition utilisateurs</h3>
              </div>
              <div className="flex items-center gap-6 justify-center">
                <DonutChart segments={donutData} size={100} />
                <div className="space-y-2.5">
                  {[
                    { label: "Clients", value: clientCount, color: "#3B82F6" },
                    { label: "Pros", value: prosCount, color: "#E8732A" },
                    { label: "Admins", value: adminCount, color: "#8B5CF6" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-[12px] text-gray-600 font-medium">{item.label}</span>
                      <span className="text-[13px] font-black text-gray-900 ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activité Business */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-[13px] font-black text-gray-900">Activité Business</h3>
              </div>
              <ActivityRow emoji="🛒" label="Commandes totales" value={commandesStats.total} />
              <ActivityRow emoji="⏳" label="En attente traitement" value={commandesStats.pending} badge={commandesStats.pending > 0 ? "Action requise" : null} badgeColor="amber" />
              <ActivityRow emoji="📅" label="Réservations total" value={reservationsStats.total} />
              <ActivityRow emoji="🔔" label="RDV en attente" value={reservationsStats.pending} badge={reservationsStats.pending > 0 ? "Action requise" : null} badgeColor="amber" />
              <ActivityRow emoji="📦" label="Produits en boutique" value={counts.produits} />
            </div>

            {/* Alertes & Actions */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-4 h-4 text-amber-500" />
                <h3 className="text-[13px] font-black text-gray-900">Alertes & Actions</h3>
              </div>
              {commandesStats.pending > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                  <p className="text-[12px] font-black text-amber-700">⚠️ {commandesStats.pending} commande(s) en attente</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Action requise dans le module Commandes</p>
                </div>
              )}
              {reservationsStats.pending > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                  <p className="text-[12px] font-black text-blue-700">📅 {reservationsStats.pending} réservation(s) en attente</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">Vérifiez les demandes de RDV</p>
                </div>
              )}
              {salons.filter(s => !s.verified).length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3">
                  <p className="text-[12px] font-black text-purple-700">👤 {salons.filter(s => !s.verified).length} pro(s) à vérifier</p>
                  <p className="text-[11px] text-purple-600 mt-0.5">Demandes de profils professionnels</p>
                </div>
              )}
              {commandesStats.pending === 0 && reservationsStats.pending === 0 && salons.filter(s => !s.verified).length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-[12px] font-black text-emerald-700">✅ Tout est à jour !</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Aucune action requise pour le moment</p>
                </div>
              )}
            </div>
          </div>

          {/* Analytics détaillées */}
          <div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Pilotage détaillé</p>
                <p className="text-[12px] text-gray-500 mt-1">Les indicateurs sont calculés à partir des données disponibles.</p>
              </div>
              <span className="text-[10px] font-bold text-gray-400">Fenêtre : 30 jours</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalyticsCard icon={UserCheck} title="Rétention clients" subtitle="Clients revenus après une première réservation">
                <div className="flex items-center gap-5">
                  <DonutChart
                    segments={[{ value: analytics.retentionRate, color: "#10B981" }, { value: 100 - analytics.retentionRate, color: "#E5E7EB" }]}
                    size={92}
                  />
                  <div>
                    <p className="text-[28px] font-black text-gray-900">{analytics.retentionRate}%</p>
                    <p className="text-[11px] text-gray-500">{analytics.returningClients30} sur {analytics.activeClients30} clients actifs</p>
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard icon={Video} title="Performance vidéo" subtitle="Vues et interactions cumulées des réels">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><p className="text-[24px] font-black text-gray-900">{analytics.videoViews.toLocaleString("fr-FR")}</p><p className="text-[10px] text-gray-400">Vues totales</p></div>
                  <div><p className="text-[24px] font-black text-gray-900">{analytics.videoEngagement}%</p><p className="text-[10px] text-gray-400">Taux engagement</p></div>
                </div>
                <MetricBars items={[
                  { label: "J'aime", value: analytics.videoLikes, color: "#E8732A" },
                  { label: "Commentaires", value: analytics.videoComments, color: "#6366F1" },
                ]} valueFormatter={value => value.toLocaleString("fr-FR")} />
                <p className="text-[10px] text-gray-400 mt-4">Temps de visionnage : non mesuré dans les données actuelles.</p>
              </AnalyticsCard>

              <AnalyticsCard icon={CalendarCheck} title="Santé des réservations" subtitle="Répartition de tous les rendez-vous">
                <MetricBars
                  items={analytics.reservationHealth}
                  valueFormatter={value => value.toLocaleString("fr-FR")}
                />
                <p className="text-[10px] text-gray-400 mt-4">Taux d'annulation : {reservationsStats.total > 0 ? Math.round(((analytics.reservationHealth.find(item => item.label === "Annulées")?.value || 0) / reservationsStats.total) * 100) : 0}%</p>
              </AnalyticsCard>
            </div>
          </div>

          <AnalyticsCard icon={Activity} title="Activité de publication" subtitle="Nombre de réels créés au cours des 7 derniers jours">
            <div className="flex items-end gap-2 h-32">
              {analytics.dailyReels.map(day => {
                const max = Math.max(...analytics.dailyReels.map(item => item.value), 1);
                return (
                  <div key={day.label} className="flex-1 h-full flex flex-col items-center justify-end gap-2">
                    <span className="text-[10px] font-black text-gray-600">{day.value}</span>
                    <div className="w-full max-w-12 rounded-t-lg bg-orange-100 overflow-hidden" style={{ height: `${Math.max(8, (day.value / max) * 78)}%` }}>
                      <div className="w-full h-full bg-orange-500 rounded-t-lg" />
                    </div>
                    <span className="text-[10px] text-gray-400 capitalize">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </AnalyticsCard>

          {/* Rankings */}
          <div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Classements & Tendances</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <RankingCard title="Styles les plus likés" icon={Heart} iconColor="#E8732A" items={topStyles} valueKey="likes" suffix=" ❤️" />
              <RankingCard title="Salons les mieux notés" icon={Star} iconColor="#F59E0B" items={topSalons} valueKey="rating" suffix=" ★" />
              <RankingCard title="Services populaires" icon={Eye} iconColor="#10B981" items={topServices} valueKey="views" suffix=" vues" />
              <RankingCard title="Top produits" icon={Package} iconColor="#6366F1" items={topProduits} valueKey="price" suffix=" €" />
            </div>
          </div>

          <p className="text-gray-400 text-[11px] text-center pt-2">
            Données en temps réel — BeautyBook Admin · Actualisé le {lastRefresh.toLocaleString("fr-FR")}
          </p>
        </div>
      )}

      {/* ── PROFESSIONNELS ── */}
      {activeSection === "pros" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={Store} label="Total pros" value={salons.length} color="orange" />
            <KPICard icon={UserCheck} label="Vérifiés" value={salons.filter(s => s.verified).length} color="green" />
            <KPICard icon={Activity} label="En attente" value={salons.filter(s => !s.verified).length} color="amber" />
            <KPICard icon={Flame} label="Avec services" value={salons.filter(s => s.status === "actif").length} color="rose" />
          </div>
          <SectionHeader icon={Store} title="Professionnels BeautyBook" subtitle="Salons & Particuliers" color="#E8732A" />
          <ProSection salons={salons} loading={false} />
        </div>
      )}

      {/* ── CLIENTS ── */}
      {activeSection === "clients" && (
        <div className="space-y-5">
          <SectionHeader icon={Users} title="Clients BeautyBook" subtitle="Gestion de la base clients" color="#3B82F6" />
          <ClientsSection users={users} loading={false} />
        </div>
      )}
    </div>
  );
}