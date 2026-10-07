import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, SlidersHorizontal, MapPin, Star, X, ArrowUpRight, ArrowRight, Sparkles,
  Scissors, Waves, Gem, Paintbrush, Droplets, Hand,
  Briefcase, Euro, Users, Plus, Eye, BadgeCheck,
  Send, FileSignature
} from "lucide-react";
import BeautyImage from "@/components/ui/BeautyImage";
import { getAnnonces, getCategories, getTypesMission, getMesCandidatures, checkProfessionalAccess } from "@/lib/annonces";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import "./Annonces.css";

const categoryIcons = { Scissors, Waves, Gem, Paintbrush, Droplets, Hand, Sparkles };

const money = (v) => Number(v || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function AnnonceCard({ annonce, onClick }) {
  const cat = getCategories().find(c => c.id === annonce.category);
  const Icon = categoryIcons[cat?.icon] || Briefcase;
  const typeMission = getTypesMission().find(t => t.id === annonce.type_mission);
  const placesRestantes = (annonce.places || 1) - (annonce.places_prises || 0);

  return (
    <article className="annonce-card" onClick={onClick}>
      <div className="annonce-card-top">
        <div className="annonce-salon">
          <div className="annonce-avatar">
            {annonce.salon_avatar ? (
              <BeautyImage src={annonce.salon_avatar} alt={annonce.salon_name} className="w-full h-full object-cover" />
            ) : (
              <span>{(annonce.salon_name || "S")[0]}</span>
            )}
          </div>
          <div className="annonce-salon-info">
            <p className="annonce-salon-name">
              {annonce.salon_name}
              <BadgeCheck size={14} className="annonce-verified" />
            </p>
            <p className="annonce-salon-meta">
              <MapPin size={12} /> {annonce.salon_city}
              {annonce.salon_rating > 0 && (
                <span className="annonce-rating"><Star size={12} fill="currentColor" /> {annonce.salon_rating}</span>
              )}
            </p>
          </div>
        </div>
        <span className="annonce-time">{timeAgo(annonce.created_at)}</span>
      </div>

      <div className="annonce-card-body">
        <div className="annonce-icon-badge">
          <Icon size={20} />
        </div>
        <div className="annonce-main">
          <h3>{annonce.title}</h3>
          <div className="annonce-tags">
            {typeMission && <span className="annonce-tag annonce-tag-type">{typeMission.label}</span>}
            {cat && <span className="annonce-tag">{cat.label}</span>}
            {placesRestantes > 0 && (
              <span className="annonce-tag annonce-tag-places">
                <Users size={11} /> {placesRestantes} place{placesRestantes > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="annonce-desc">{annonce.description?.slice(0, 120)}...</p>
        </div>
      </div>

      <div className="annonce-card-foot">
        <div className="annonce-price">
          <Euro size={14} />
          <strong>{money(annonce.remuneration)}</strong>
          <span>/{annonce.remuneration_type === "jour" ? "jour" : "mission"}</span>
        </div>
        <div className="annonce-foot-meta">
          <span className="annonce-views"><Eye size={12} /> {annonce.vues || 0}</span>
          <span className="annonce-cta">Voir <ArrowRight size={14} /></span>
        </div>
      </div>
    </article>
  );
}

export default function Annonces() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState("tous");
  const [activeType, setActiveType] = useState("tous");
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("decouvrir"); // decouvrir | candidatures
  // Filtres avancés
  const [minRemu, setMinRemu] = useState(0);
  const [ville, setVille] = useState("toutes");
  const [dateMin, setDateMin] = useState("");
  const [placesDispoOnly, setPlacesDispoOnly] = useState(false);
  const [tri, setTri] = useState("recent"); // recent | remu_desc | remu_asc | date_debut

  const { user } = useAuth();
  const userEmail = user?.email || (() => { try { return JSON.parse(localStorage.getItem("bb_session") || "{}").email || ""; } catch { return ""; } })();

  // Le bouton "Publier une annonce" n'apparaît que pour les salons professionnels
  const [isSalon, setIsSalon] = useState(false);
  const [isParticulier, setIsParticulier] = useState(false);
  useEffect(() => {
    if (userEmail) checkProfessionalAccess(supabase, userEmail).then(r => {
      setIsSalon(r.isSalon);
      setIsParticulier(r.isParticulier);
    });
  }, [userEmail]);

  const mesCandidatures = useMemo(
    () => isParticulier && userEmail ? getMesCandidatures(userEmail) : [],
    [userEmail, view, isParticulier]
  );

  const annonces = useMemo(() => getAnnonces(), []);
  const categories = getCategories();
  const types = getTypesMission();

  // Villes disponibles dans les annonces
  const villes = useMemo(() => {
    const set = new Set();
    annonces.forEach(a => { if (a.salon_city) set.add(a.salon_city); });
    return [...set].sort();
  }, [annonces]);

  // Rémunération max pour le slider
  const maxRemu = useMemo(() => {
    return Math.max(200, ...annonces.map(a => Number(a.remuneration) || 0));
  }, [annonces]);

  const nbFiltresActifs = (minRemu > 0 ? 1 : 0) + (ville !== "toutes" ? 1 : 0) + (dateMin ? 1 : 0) + (placesDispoOnly ? 1 : 0) + (tri !== "recent" ? 1 : 0);

  const resetFiltres = () => {
    setMinRemu(0); setVille("toutes"); setDateMin(""); setPlacesDispoOnly(false); setTri("recent");
  };

  const filtered = useMemo(() => {
    const list = annonces.filter(a => {
      if (activeCat !== "tous" && a.category !== activeCat) return false;
      if (activeType !== "tous" && a.type_mission !== activeType) return false;
      if (minRemu > 0 && Number(a.remuneration || 0) < minRemu) return false;
      if (ville !== "toutes" && a.salon_city !== ville) return false;
      if (dateMin && (!a.date_debut || a.date_debut < dateMin)) return false;
      if (placesDispoOnly && ((a.places || 1) - (a.places_prises || 0)) <= 0) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const hay = `${a.title} ${a.description} ${a.salon_name} ${a.salon_city} ${(a.competences || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // Tri
    const sorted = [...list];
    if (tri === "remu_desc") sorted.sort((x, y) => (Number(y.remuneration) || 0) - (Number(x.remuneration) || 0));
    else if (tri === "remu_asc") sorted.sort((x, y) => (Number(x.remuneration) || 0) - (Number(y.remuneration) || 0));
    else if (tri === "date_debut") sorted.sort((x, y) => (x.date_debut || "").localeCompare(y.date_debut || ""));
    else sorted.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
    return sorted;
  }, [annonces, q, activeCat, activeType, minRemu, ville, dateMin, placesDispoOnly, tri]);

  return (
    <div className="annonces-page">
      {/* ── Hero inspiré Recherche ── */}
      <header className="discovery-hero">
        <div className="discovery-topline">
          <span className="discovery-eyebrow">
            <span className="pulse-dot" />
            OPPORTUNITÉS PRO
          </span>
          <span className="discovery-brand">
            BeautyBook<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="discovery-heading">
          <div>
            <h1>
              Trouvez votre<br />
              <em>prochaine mission.</em>
            </h1>
            <p>Les salons recrutent, les talents répondent.</p>
          </div>
          <button className="discovery-maria" onClick={() => navigate("/annonces/nouvelle")} style={{ display: isSalon ? undefined : "none" }}>
            <span className="discovery-maria-icon"><Plus size={22} /></span>
            <span>
              <strong>Publier une annonce</strong>
              <small>Salons : recrutez en 2 min</small>
            </span>
            <ArrowUpRight size={19} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="discovery-searchbar">
          <label className="discovery-query">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Rechercher une annonce</span>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Métier, compétence, ville, salon..."
            />
          </label>
          <button className="discovery-filter-button" onClick={() => setShowFilters(!showFilters)} style={{ position: "relative" }}>
            <SlidersHorizontal size={18} />
            <span>Filtres</span>
            {nbFiltresActifs > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 999, background: "#FF6B00", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                {nbFiltresActifs}
              </span>
            )}
          </button>
        </div>

        {/* ── Panneau filtres avancés ── */}
        {showFilters && (
          <div className="annonces-filter-panel">
            <div className="annonces-filter-head">
              <p><SlidersHorizontal size={15} /> Filtres avancés</p>
              {nbFiltresActifs > 0 && (
                <button onClick={resetFiltres} className="annonces-filter-reset">
                  <X size={13} /> Réinitialiser
                </button>
              )}
            </div>

            {/* Rémunération minimum */}
            <div className="annonces-filter-group">
              <label>Rémunération minimum : <strong>{minRemu > 0 ? money(minRemu) : "Toutes"}</strong></label>
              <input
                type="range" min={0} max={maxRemu} step={10} value={minRemu}
                onChange={e => setMinRemu(Number(e.target.value))}
                className="annonces-range"
              />
              <div className="annonces-range-labels"><span>0 €</span><span>{money(maxRemu)}</span></div>
            </div>

            {/* Ville */}
            <div className="annonces-filter-group">
              <label>Ville</label>
              <div className="annonces-filter-chips">
                <button className={`annonces-chip ${ville === "toutes" ? "active" : ""}`} onClick={() => setVille("toutes")}>
                  Toutes
                </button>
                {villes.map(v => (
                  <button key={v} className={`annonces-chip ${ville === v ? "active" : ""}`} onClick={() => setVille(v)}>
                    <MapPin size={12} /> {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + places + tri */}
            <div className="annonces-filter-row">
              <div className="annonces-filter-group" style={{ flex: 1 }}>
                <label>Début après le</label>
                <input
                  type="date" value={dateMin} min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setDateMin(e.target.value)}
                  className="annonces-date"
                />
              </div>
              <div className="annonces-filter-group" style={{ flex: 1 }}>
                <label>Trier par</label>
                <select value={tri} onChange={e => setTri(e.target.value)} className="annonces-select">
                  <option value="recent">Plus récentes</option>
                  <option value="remu_desc">Rémunération ↓</option>
                  <option value="remu_asc">Rémunération ↑</option>
                  <option value="date_debut">Date de début</option>
                </select>
              </div>
            </div>

            {/* Places dispo */}
            <button
              className={`annonces-toggle ${placesDispoOnly ? "active" : ""}`}
              onClick={() => setPlacesDispoOnly(v => !v)}
            >
              <span className="annonces-toggle-dot" />
              <Users size={14} /> Places disponibles uniquement
            </button>

            <button className="annonce-cta-btn" onClick={() => setShowFilters(false)} style={{ marginTop: 4 }}>
              Voir {filtered.length} annonce{filtered.length > 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* Category pills */}
        <div className="annonces-cats">
          <button
            className={`annonce-pill ${activeCat === "tous" ? "active" : ""}`}
            onClick={() => setActiveCat("tous")}
          >
            <Sparkles size={14} /> Tous
          </button>
          {categories.map(cat => {
            const Icon = categoryIcons[cat.icon] || Briefcase;
            return (
              <button
                key={cat.id}
                className={`annonce-pill ${activeCat === cat.id ? "active" : ""}`}
                onClick={() => setActiveCat(cat.id)}
              >
                <Icon size={14} /> {cat.label}
              </button>
            );
          })}
        </div>

        {/* Type mission pills */}
        <div className="annonces-types">
          <button
            className={`annonce-type ${activeType === "tous" ? "active" : ""}`}
            onClick={() => setActiveType("tous")}
          >
            Tous types
          </button>
          {types.map(t => (
            <button
              key={t.id}
              className={`annonce-type ${activeType === t.id ? "active" : ""}`}
              onClick={() => setActiveType(t.id)}
              title={t.desc}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Onglets Découvrir / Mes candidatures */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={() => setView("decouvrir")}
            className={`annonce-type ${view === "decouvrir" ? "active" : ""}`}
            style={{ flex: 1, padding: "10px 16px", fontSize: 13 }}
          >
            <Search size={13} style={{ marginRight: 5 }} /> Découvrir
          </button>
          <button
            onClick={() => setView("candidatures")}
            className={`annonce-type ${view === "candidatures" ? "active" : ""}`}
            style={{ flex: 1, padding: "10px 16px", fontSize: 13, display: isParticulier ? undefined : "none" }}
          >
            <Send size={13} style={{ marginRight: 5 }} /> Mes candidatures
            {mesCandidatures.length > 0 && (
              <span style={{ marginLeft: 6, background: view === "candidatures" ? "#fff" : "#FF6B00", color: view === "candidatures" ? "#FF6B00" : "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "1px 7px" }}>{mesCandidatures.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* ── Vue Mes candidatures ── */}
      {view === "candidatures" ? (
        <main className="annonces-list">
          <div className="annonces-count">
            <Send size={14} />
            <span><strong>{mesCandidatures.length}</strong> candidature{mesCandidatures.length > 1 ? "s" : ""} envoyée{mesCandidatures.length > 1 ? "s" : ""}</span>
          </div>
          {mesCandidatures.length === 0 ? (
            <div className="annonces-empty">
              <div className="annonces-empty-icon"><Send size={28} /></div>
              <p className="annonces-empty-title">Aucune candidature</p>
              <p className="annonces-empty-desc">Explorez les annonces et postulez à votre prochaine mission.</p>
              <button className="annonce-cta-btn" style={{ marginTop: 16, maxWidth: 260, margin: "16px auto 0" }} onClick={() => setView("decouvrir")}>
                Découvrir les annonces
              </button>
            </div>
          ) : (
            mesCandidatures.map(c => {
              const a = getAnnonces().find(x => x.id === c.annonce_id);
              if (!a) return null;
              return (
                <article key={c.id} className="annonce-card" onClick={() => navigate(`/annonces/${a.id}`)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="annonce-avatar" style={{ width: 46, height: 46 }}>
                      {a.salon_avatar ? (
                        <BeautyImage src={a.salon_avatar} alt={a.salon_name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(a.salon_name || "S")[0]}</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 800 }}>{a.title}</p>
                      <p style={{ fontSize: 11, color: "#6B7280" }}>{a.salon_name} · {money(a.remuneration)}/{a.remuneration_type === "jour" ? "j" : "m"}</p>
                    </div>
                    <CandidatureBadge status={c.status} signe={c.contrat?.signe} />
                  </div>
                  {c.status === "accepte" && !c.contrat?.signe && (
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#057A55", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <FileSignature size={14} /> Signez votre contrat depuis la page de l'annonce
                    </p>
                  )}
                </article>
              );
            })
          )}
        </main>
      ) : (
      <main className="annonces-list">
        <div className="annonces-count">
          <Briefcase size={14} />
          <span><strong>{filtered.length}</strong> annonce{filtered.length > 1 ? "s" : ""} disponible{filtered.length > 1 ? "s" : ""}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="annonces-empty">
            <div className="annonces-empty-icon"><Search size={28} /></div>
            <p className="annonces-empty-title">Aucune annonce trouvée</p>
            <p className="annonces-empty-desc">Essayez d'autres mots-clés ou catégories.</p>
          </div>
        ) : (
          filtered.map(a => (
            <AnnonceCard key={a.id} annonce={a} onClick={() => navigate(`/annonces/${a.id}`)} />
          ))
        )}
      </main>
      )}
    </div>
  );
}

function CandidatureBadge({ status, signe }) {
  if (signe) return <span className="candidat-status accepte">✓ Contrat signé</span>;
  if (status === "accepte") return <span className="candidat-status accepte">✓ Acceptée</span>;
  if (status === "refuse") return <span className="candidat-status refuse">✕ Refusée</span>;
  return <span className="candidat-status en_attente">En attente</span>;
}
