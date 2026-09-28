import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Share2, MapPin, Star, CalendarDays, Users, Clock,
  BadgeCheck, Briefcase, CheckCircle2, XCircle, Send, Eye, Sparkles,
  Phone, MessageCircle, ChevronRight, Banknote, Timer, Heart,
  FileSignature, PenLine, Building2, ShieldCheck
} from "lucide-react";
import BeautyImage from "@/components/ui/BeautyImage";
import {
  getAnnonceById, getAnnonces, getCategories, getTypesMission,
  getCandidatures, postuler, incrementVues,
  signerContrat, genererContrat, toggleFavori, isFavori
} from "@/lib/annonces";
import { useAuth } from "@/lib/AuthContext";
import { readPageCache, writePageCache } from "@/hooks/usePageCache";
import "./Annonces.css";

const money = (v) => Number(v || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
};

const fmtDateLong = (iso) => {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

const SUIVI_ICONS = { send: Send, eye: Eye, check: CheckCircle2, x: XCircle, pen: PenLine };

function SuiviTimeline({ suivi }) {
  return (
    <div className="ad-timeline">
      {(suivi || []).map((s, i) => {
        const Icon = SUIVI_ICONS[s.icon] || Send;
        const isLast = i === (suivi || []).length - 1;
        return (
          <div key={i} className={`ad-timeline-item ${isLast ? "last" : ""}`}>
            <div className="ad-timeline-dot"><Icon size={11} /></div>
            <div className="ad-timeline-content">
              <p className="ad-timeline-title">{s.etape}</p>
              <p className="ad-timeline-date">
                {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnnonceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userEmail = user?.email || "";

  // ── Cache de page par annonce : affichage direct depuis le cache, jamais de
  // rendu vide — le lib annonces (localStorage) est re-lu en arrière-plan
  // sans jamais vider l'affichage (cf. ProduitDetail).
  const [initialCache] = useState(() => readPageCache(id ? `annonce_${id}` : null) || {});

  const [annonce, setAnnonce] = useState(initialCache.annonce || null);
  const [maCandidature, setMaCandidature] = useState(initialCache.maCandidature || null);
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({ nom: "", tel: "", message: "" });
  const [sending, setSending] = useState(false);
  const [fav, setFav] = useState(!!initialCache.fav);
  const [showContrat, setShowContrat] = useState(false);
  const [nomSignataire, setNomSignataire] = useState("");
  const [contratSigne, setContratSigne] = useState(!!initialCache.contratSigne);
  const [signing, setSigning] = useState(false);

  const refresh = () => {
    const a = getAnnonceById(id);
    if (!a) { navigate("/annonces"); return; }
    setAnnonce(a);
    let mine = null;
    let favNow = false;
    let signeNow = contratSigne;
    if (userEmail) {
      favNow = isFavori(userEmail, id);
      setFav(favNow);
      const cands = getCandidatures(id);
      mine = cands.find(c => c.candidat_email === userEmail) || null;
      setMaCandidature(mine);
      if (mine?.contrat?.signe) { signeNow = true; setContratSigne(true); }
    }
    writePageCache(`annonce_${id}`, { annonce: a, maCandidature: mine, fav: favNow, contratSigne: signeNow });
  };

  useEffect(() => { refresh(); incrementVues(id); }, [id, userEmail]);

  const similar = useMemo(() => {
    if (!annonce) return [];
    return getAnnonces()
      .filter(a => a.id !== annonce.id && (a.category === annonce.category || a.salon_city === annonce.salon_city))
      .slice(0, 3);
  }, [annonce]);

  if (!annonce) return null;

  const cat = getCategories().find(c => c.id === annonce.category);
  const typeMission = getTypesMission().find(t => t.id === annonce.type_mission);
  const placesRestantes = (annonce.places || 1) - (annonce.places_prises || 0);
  const accepte = maCandidature?.status === "accepte";
  const refuse = maCandidature?.status === "refuse";
  const isOwner = userEmail && annonce.salon_email === userEmail;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: annonce.title, text: annonce.description?.slice(0, 100), url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); alert("Lien copié dans le presse-papiers !"); }
      catch { alert(url); }
    }
  };

  const handleFav = () => {
    if (!userEmail) { alert("Connectez-vous pour sauvegarder cette annonce"); return; }
    setFav(toggleFavori(userEmail, id));
  };

  const handleApply = () => {
    if (!userEmail) { alert("Connectez-vous pour postuler"); return; }
    if (!applyForm.nom.trim()) { alert("Indiquez votre nom"); return; }
    if (applyForm.tel && !/^[0-9+.\s]{8,}$/.test(applyForm.tel.trim())) { alert("Numéro de téléphone invalide"); return; }
    setSending(true);
    const res = postuler(annonce.id, {
      email: userEmail,
      nom: applyForm.nom.trim(),
      tel: applyForm.tel.trim(),
      message: applyForm.message.trim(),
    });
    setSending(false);
    if (res.error) { alert(res.error); return; }
    setMaCandidature(res.data);
    setShowApply(false);
    setApplyForm({ nom: "", tel: "", message: "" });
  };

  const handleSigner = () => {
    if (!nomSignataire.trim()) { alert("Indiquez votre nom complet pour signer"); return; }
    setSigning(true);
    signerContrat(maCandidature.id, nomSignataire.trim());
    setContratSigne(true);
    setShowContrat(false);
    setSigning(false);
    refresh();
  };

  const contratTexte = maCandidature
    ? genererContrat(annonce, { ...maCandidature, contrat: { ...maCandidature.contrat, nom_signataire: nomSignataire || maCandidature.contrat?.nom_signataire } })
    : "";

  return (
    <div className="ad-page">
      {/* ── Header sticky ── */}
      <div className="ad-header">
        <button className="ad-icon-btn" onClick={() => navigate(-1)} aria-label="Retour">
          <ArrowLeft size={20} />
        </button>
        <div className="ad-header-actions">
          <button className="ad-icon-btn" onClick={handleFav} aria-label="Sauvegarder">
            <Heart size={19} style={{ color: fav ? "#EF4444" : undefined }} fill={fav ? "#EF4444" : "none"} />
          </button>
          <button className="ad-icon-btn" onClick={handleShare} aria-label="Partager">
            <Share2 size={19} />
          </button>
        </div>
      </div>

      {/* ── Cover ── */}
      <div className="ad-cover">
        <BeautyImage
          src={annonce.salon_cover || "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200"}
          alt="" className="w-full h-full object-cover"
        />
        <div className="ad-cover-gradient" />
        <div className="ad-cover-tags">
          {typeMission && <span className="ad-chip ad-chip-dark">{typeMission.label}</span>}
          {cat && <span className="ad-chip ad-chip-light">{cat.label}</span>}
        </div>
      </div>

      <div className="ad-body">
        {/* ── Carte salon ── */}
        <div className="ad-salon-card">
          <div className="ad-salon-avatar">
            {annonce.salon_avatar ? (
              <BeautyImage src={annonce.salon_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{(annonce.salon_name || "S")[0]}</span>
            )}
          </div>
          <div className="ad-salon-info">
            <p className="ad-salon-name">{annonce.salon_name} <BadgeCheck size={16} className="ad-verified" /></p>
            <p className="ad-salon-meta">
              <span><MapPin size={12} /> {annonce.salon_city}</span>
              {annonce.salon_rating > 0 && <span><Star size={12} fill="currentColor" /> {annonce.salon_rating}</span>}
              <span><Eye size={12} /> {annonce.vues || 0} vues</span>
            </p>
          </div>
        </div>

        {/* ── Bannière propriétaire ── */}
        {isOwner && (
          <button className="ad-owner-banner" onClick={() => navigate(`/pro/annonces/${annonce.id}`)}>
            <span><Briefcase size={17} /> C'est votre annonce — gérez les candidatures</span>
            <ChevronRight size={18} />
          </button>
        )}

        {/* ── Titre ── */}
        <h1 className="ad-title">{annonce.title}</h1>
        <div className="ad-places-row">
          {placesRestantes > 0 ? (
            <span className="ad-places-ok"><Users size={13} /> {placesRestantes} place{placesRestantes > 1 ? "s" : ""} restante{placesRestantes > 1 ? "s" : ""}</span>
          ) : (
            <span className="ad-places-full">Complet — plus de place disponible</span>
          )}
          <span className="ad-date-posted">Publiée {new Date(annonce.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
        </div>

        {/* ── Suivi candidature ── */}
        {maCandidature && (
          <section className={`ad-card ad-suivi ${accepte ? "ok" : refuse ? "ko" : ""}`}>
            <p className="ad-card-title">
              {accepte ? <><CheckCircle2 size={15} className="ok" /> Candidature acceptée</>
               : refuse ? <><XCircle size={15} className="ko" /> Candidature refusée</>
               : <><Clock size={15} className="wait" /> Suivi de ma candidature</>}
            </p>
            <SuiviTimeline suivi={maCandidature.suivi} />

            {maCandidature.reponse_salon && (
              <div className="ad-salon-msg">
                <p className="ad-salon-msg-label">Message du salon</p>
                <p className="ad-salon-msg-text">{maCandidature.reponse_salon}</p>
              </div>
            )}

            {accepte && !contratSigne && (
              <button onClick={() => setShowContrat(true)} className="ad-btn-primary" style={{ marginTop: 14 }}>
                <FileSignature size={18} /> Signer mon contrat
              </button>
            )}
            {accepte && contratSigne && (
              <div className="ad-contract-ok">
                <ShieldCheck size={24} />
                <div>
                  <p>Contrat signé électroniquement</p>
                  <span>
                    {maCandidature.contrat?.date && new Date(maCandidature.contrat.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    {maCandidature.contrat?.nom_signataire && ` · par ${maCandidature.contrat.nom_signataire}`}
                  </span>
                </div>
              </div>
            )}
            {accepte && (
              <div className="ad-contact-row">
                {annonce.salon_tel && (
                  <a href={`tel:${annonce.salon_tel}`} className="ad-btn-dark"><Phone size={15} /> Appeler</a>
                )}
                <a href={`mailto:${annonce.salon_email}`} className="ad-btn-light"><MessageCircle size={15} /> Écrire au salon</a>
              </div>
            )}
          </section>
        )}

        {/* ── Infos clés ── */}
        <section className="ad-card">
          <p className="ad-card-title"><Sparkles size={14} /> Informations clés</p>
          <div className="ad-grid">
            <div className="ad-grid-item highlight">
              <p className="lbl">Rémunération</p>
              <p className="val"><Banknote size={17} /> {money(annonce.remuneration)}<small>/{annonce.remuneration_type === "jour" ? "jour" : "mission"}</small></p>
            </div>
            <div className="ad-grid-item">
              <p className="lbl">Places</p>
              <p className="val"><Users size={17} /> {placesRestantes} restante{placesRestantes > 1 ? "s" : ""}</p>
            </div>
            <div className="ad-grid-item">
              <p className="lbl">Début</p>
              <p className="val"><CalendarDays size={17} /> {fmtDate(annonce.date_debut)}</p>
              <p className="sub">{fmtDateLong(annonce.date_debut)}</p>
            </div>
            <div className="ad-grid-item">
              <p className="lbl">Fin</p>
              <p className="val"><Timer size={17} /> {fmtDate(annonce.date_fin)}</p>
              <p className="sub">{fmtDateLong(annonce.date_fin)}</p>
            </div>
          </div>
          {annonce.adresse && (
            <a
              className="ad-address"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(annonce.adresse)}`}
              target="_blank" rel="noreferrer"
            >
              <MapPin size={15} /> {annonce.adresse}
            </a>
          )}
        </section>

        {/* ── Description ── */}
        <section className="ad-card">
          <p className="ad-card-title"><Briefcase size={14} /> Description de la mission</p>
          <p className="ad-text">{annonce.description}</p>
        </section>

        {/* ── Compétences ── */}
        {annonce.competences?.length > 0 && (
          <section className="ad-card">
            <p className="ad-card-title"><CheckCircle2 size={14} /> Compétences recherchées</p>
            <div className="ad-skills">
              {annonce.competences.map((c, i) => <span key={i} className="ad-skill">{c}</span>)}
            </div>
          </section>
        )}

        {/* ── Salon ── */}
        <section className="ad-card">
          <p className="ad-card-title"><Building2 size={14} /> À propos du salon</p>
          <div className="ad-salon-about">
            <div className="ad-salon-avatar sm">
              {annonce.salon_avatar ? (
                <BeautyImage src={annonce.salon_avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{(annonce.salon_name || "S")[0]}</span>
              )}
            </div>
            <div>
              <p className="ad-salon-name sm">{annonce.salon_name} <BadgeCheck size={14} className="ad-verified" /></p>
              <p className="ad-salon-city">{annonce.salon_city}{annonce.salon_rating > 0 && ` · ★ ${annonce.salon_rating}`}</p>
            </div>
          </div>
          <p className="ad-text muted">{annonce.salon_bio || "Ce salon n'a pas encore ajouté de présentation."}</p>
        </section>

        {/* ── Similaires ── */}
        {similar.length > 0 && (
          <section className="ad-card">
            <p className="ad-card-title"><Sparkles size={14} /> Annonces similaires</p>
            <div className="ad-similar">
              {similar.map(s => (
                <button key={s.id} className="ad-similar-item" onClick={() => navigate(`/annonces/${s.id}`)}>
                  <div className="ad-similar-icon"><Briefcase size={18} /></div>
                  <div className="ad-similar-info">
                    <p>{s.title}</p>
                    <span>{s.salon_name} · {s.salon_city} · {money(s.remuneration)}/{s.remuneration_type === "jour" ? "j" : "m"}</span>
                  </div>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── CTA fixe ── */}
      {!maCandidature && (
        <div className="ad-cta-bar">
          <div className="ad-cta-price">
            <p>{money(annonce.remuneration)}</p>
            <span>/{annonce.remuneration_type === "jour" ? "jour" : "mission"}</span>
          </div>
          <button className="ad-btn-primary" onClick={() => setShowApply(true)} disabled={placesRestantes <= 0}>
            {placesRestantes <= 0 ? "Complet" : <><Send size={18} /> Postuler</>}
          </button>
        </div>
      )}

      {/* ── Modal candidature ── */}
      {showApply && (
        <div className="ad-modal-overlay" onClick={() => setShowApply(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <h3>Postuler à cette mission</h3>
            <p className="ad-modal-sub">{annonce.title} — {annonce.salon_name}</p>
            <div className="ad-field">
              <label>Votre nom *</label>
              <input value={applyForm.nom} onChange={e => setApplyForm({ ...applyForm, nom: e.target.value })} placeholder="Ex. Aïcha Diallo" />
            </div>
            <div className="ad-field">
              <label>Téléphone</label>
              <input value={applyForm.tel} onChange={e => setApplyForm({ ...applyForm, tel: e.target.value })} placeholder="06 12 34 56 78" type="tel" />
            </div>
            <div className="ad-field">
              <label>Message au salon</label>
              <textarea value={applyForm.message} onChange={e => setApplyForm({ ...applyForm, message: e.target.value })} placeholder="Présentez-vous : expérience, disponibilités..." rows={4} />
            </div>
            <button className="ad-btn-primary" onClick={handleApply} disabled={sending}>
              <Send size={18} /> {sending ? "Envoi..." : "Envoyer ma candidature"}
            </button>
            <button className="ad-btn-ghost" onClick={() => setShowApply(false)}>Annuler</button>
          </div>
        </div>
      )}

      {/* ── Modal contrat ── */}
      {showContrat && (
        <div className="ad-modal-overlay" onClick={() => setShowContrat(false)}>
          <div className="ad-modal wide" onClick={e => e.stopPropagation()}>
            <div className="ad-modal-head">
              <div className="ad-modal-icon"><FileSignature size={22} /></div>
              <div>
                <h3>Contrat de mission</h3>
                <p className="ad-modal-sub">Signature électronique</p>
              </div>
            </div>
            <div className="ad-contract-text">
              <pre>{contratTexte}</pre>
            </div>
            <div className="ad-field">
              <label>Signer : écrivez votre nom complet *</label>
              <input value={nomSignataire} onChange={e => setNomSignataire(e.target.value)} placeholder="Ex. Aïcha Diallo" className="ad-signature-input" />
            </div>
            {nomSignataire.trim() && (
              <div className="ad-signature-preview">
                <p>Aperçu de la signature</p>
                <p className="sig">{nomSignataire}</p>
              </div>
            )}
            <div className="ad-modal-actions">
              <button onClick={() => setShowContrat(false)} className="ad-btn-ghost">Plus tard</button>
              <button onClick={handleSigner} className="ad-btn-primary" disabled={signing}>
                <PenLine size={15} /> {signing ? "Signature..." : "Signer"}
              </button>
            </div>
            <p className="ad-legal"><ShieldCheck size={11} /> Signature horodatée enregistrée avec votre candidature</p>
          </div>
        </div>
      )}
    </div>
  );
}
