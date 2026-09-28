import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Briefcase, Users, Eye, Clock, CheckCircle2, XCircle,
  Pencil, Trash2, Play, Pause, Archive, ChevronRight, Sparkles, TrendingUp,
  CalendarDays, Euro, Search
} from "lucide-react";
import {
  getMesAnnonces, deleteAnnonce, setAnnonceStatus, getAnnonceStats,
  ANNONCE_STATUS, getCategories, getTypesMission, checkSalonAccess
} from "@/lib/annonces";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, mergePageCache } from "@/hooks/usePageCache";
import "../Annonces.css";

const money = (v) => Number(v || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function getUserEmail(authEmail) {
  if (authEmail) return authEmail;
  try { return JSON.parse(localStorage.getItem("bb_session") || "{}").email || "salon@beautybook.app"; }
  catch { return "salon@beautybook.app"; }
}

export default function AnnoncesDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userEmail = getUserEmail(user?.email);
  // Affichage direct depuis le cache : le rafraîchissement se fait en arrière-plan
  // sans jamais vider l'affichage. La clé est stable au montage (fallback localStorage).
  const cacheKey = `annonces_${userEmail}`;
  const [annonces, setAnnonces] = useCachedState(cacheKey, [], (c) => c?.annonces || []);
  const [filter, setFilter] = useState("toutes");
  const [q, setQ] = useState("");
  const [access, setAccess] = useState({ loading: true, isSalon: false });
  const email = userEmail;

  const refresh = () => {
    const items = getMesAnnonces(email);
    setAnnonces(items);
    mergePageCache(cacheKey, { annonces: items });
  };
  useEffect(refresh, []);
  useEffect(() => {
    checkSalonAccess(supabase, email).then(setAccess);
  }, [email]);

  if (access.loading) {
    return <div className="annonces-page"><div className="annonces-empty"><p>Vérification de votre profil...</p></div></div>;
  }
  if (!access.isSalon) {
    return (
      <div className="annonces-page">
        <div className="annonces-empty" style={{ padding: "60px 20px" }}>
          <div className="annonces-empty-icon"><Briefcase size={28} /></div>
          <p className="annonces-empty-title">Réservé aux salons professionnels</p>
          <p className="annonces-empty-desc">
            La publication et la gestion des annonces sont réservées aux profils
            professionnels ayant le statut de « Salon professionnel ».
          </p>
          <button className="annonce-cta-btn" style={{ marginTop: 16, maxWidth: 280, margin: "16px auto 0" }} onClick={() => navigate("/annonces")}>
            Voir les annonces
          </button>
        </div>
      </div>
    );
  }

  const stats = useMemo(() => {
    let total = annonces.length, publiees = 0, candidatures = 0, enAttente = 0, vues = 0;
    annonces.forEach(a => {
      if (a.status === "publiee") publiees++;
      vues += a.vues || 0;
      const s = getAnnonceStats(a.id);
      candidatures += s.total;
      enAttente += s.en_attente;
    });
    return { total, publiees, candidatures, enAttente, vues };
  }, [annonces]);

  const filtered = useMemo(() => {
    return annonces.filter(a => {
      if (filter !== "toutes" && a.status !== filter) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        if (!`${a.title} ${a.description}`.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [annonces, filter, q]);

  const handleDelete = (id, title) => {
    if (!confirm(`Supprimer définitivement « ${title} » ?`)) return;
    deleteAnnonce(id);
    refresh();
  };

  const handleStatus = (id, status) => {
    setAnnonceStatus(id, status);
    refresh();
  };

  return (
    <div className="annonces-page">
      {/* Hero */}
      <header className="discovery-hero">
        <div className="discovery-topline">
          <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>
            <ArrowLeft size={18} /> Retour
          </button>
          <span className="discovery-brand">BeautyBook<span className="brand-dot">.</span></span>
        </div>
        <div className="discovery-heading" style={{ marginTop: 12 }}>
          <div>
            <p className="discovery-eyebrow"><Sparkles size={14} /> ESPACE RECRUTEMENT</p>
            <h1>Mes<br /><em>annonces.</em></h1>
            <p>Publiez, suivez et recrutez comme un pro.</p>
          </div>
          <button className="discovery-maria" onClick={() => navigate("/annonces/nouvelle")}>
            <span className="discovery-maria-icon"><Plus size={22} /></span>
            <span><strong>Nouvelle annonce</strong><small>En 2 minutes chrono</small></span>
          </button>
        </div>
      </header>

      <div style={{ padding: "18px max(20px, calc((100% - 1180px) / 2))", maxWidth: 1180, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          {[
            { label: "Annonces", value: stats.total, icon: Briefcase, color: "#FF6B00", bg: "#FFF2E8" },
            { label: "Candidatures", value: stats.candidatures, icon: Users, color: "#7C3AED", bg: "#F5F3FF" },
            { label: "En attente", value: stats.enAttente, icon: Clock, color: "#D97706", bg: "#FFFBEB" },
            { label: "Vues", value: stats.vues, icon: Eye, color: "#059669", bg: "#ECFDF5" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="annonce-section" style={{ margin: 0, padding: 14, textAlign: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                  <Icon size={18} style={{ color: s.color }} />
                </div>
                <p style={{ fontSize: 20, fontWeight: 900 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: "#6B7280", fontWeight: 700 }}>{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Filtres + recherche */}
        <div className="discovery-searchbar" style={{ marginBottom: 12 }}>
          <label className="discovery-query">
            <Search size={18} />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher mes annonces..." />
          </label>
        </div>
        <div className="annonces-types" style={{ padding: "0 0 14px" }}>
          {["toutes", "publiee", "brouillon", "pause", "cloturee"].map(f => (
            <button key={f} className={`annonce-type ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "toutes" ? "Toutes" : ANNONCE_STATUS[f].label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 ? (
            <div className="annonces-empty">
              <div className="annonces-empty-icon"><Briefcase size={28} /></div>
              <p className="annonces-empty-title">Aucune annonce</p>
              <p className="annonces-empty-desc">Créez votre première annonce pour recruter.</p>
              <button className="annonce-cta-btn" style={{ marginTop: 16, maxWidth: 260, margin: "16px auto 0" }} onClick={() => navigate("/annonces/nouvelle")}>
                <Plus size={18} /> Créer une annonce
              </button>
            </div>
          ) : filtered.map(a => {
            const st = ANNONCE_STATUS[a.status] || ANNONCE_STATUS.brouillon;
            const s = getAnnonceStats(a.id);
            const typeMission = getTypesMission().find(t => t.id === a.type_mission);
            return (
              <article key={a.id} className="annonce-card" style={{ cursor: "default" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => navigate(`/pro/annonces/${a.id}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 900 }}>{a.title}</h3>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#6B7280" }}>
                      {typeMission?.label} · {money(a.remuneration)}/{a.remuneration_type === "jour" ? "j" : "m"} · {a.vues || 0} vues
                    </p>
                  </div>
                  <ChevronRight size={18} style={{ color: "#9CA3AF", cursor: "pointer", flexShrink: 0 }} onClick={() => navigate(`/pro/annonces/${a.id}`)} />
                </div>

                {/* Compteurs candidatures */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <span className="annonce-tag"><Users size={11} /> {s.total} candidature{s.total > 1 ? "s" : ""}</span>
                  {s.en_attente > 0 && <span className="annonce-tag" style={{ background: "#FEF3C7", color: "#92400E" }}><Clock size={11} /> {s.en_attente} en attente</span>}
                  {s.accepte > 0 && <span className="annonce-tag annonce-tag-places"><CheckCircle2 size={11} /> {s.accepte} accepté{s.accepte > 1 ? "s" : ""}</span>}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => navigate(`/pro/annonces/${a.id}`)} className="candidat-btn" style={{ flex: "1 1 auto", background: "#111827", color: "#fff" }}>
                    <Users size={13} /> Candidats
                  </button>
                  <button onClick={() => navigate(`/annonces/nouvelle?edit=${a.id}`)} className="candidat-btn" style={{ background: "#F3F4F6", color: "#111827" }}>
                    <Pencil size={13} /> Modifier
                  </button>
                  {a.status === "brouillon" && (
                    <button onClick={() => handleStatus(a.id, "publiee")} className="candidat-btn accept">
                      <Play size={13} /> Publier
                    </button>
                  )}
                  {a.status === "publiee" && (
                    <button onClick={() => handleStatus(a.id, "pause")} className="candidat-btn" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      <Pause size={13} /> Pause
                    </button>
                  )}
                  {a.status === "pause" && (
                    <button onClick={() => handleStatus(a.id, "publiee")} className="candidat-btn accept">
                      <Play size={13} /> Reprendre
                    </button>
                  )}
                  {(a.status === "publiee" || a.status === "pause") && (
                    <button onClick={() => handleStatus(a.id, "cloturee")} className="candidat-btn" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                      <Archive size={13} /> Clôturer
                    </button>
                  )}
                  <button onClick={() => handleDelete(a.id, a.title)} className="candidat-btn reject" style={{ flex: "0 1 auto", padding: "9px 14px" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
