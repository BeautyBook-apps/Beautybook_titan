import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PhoneCall, PhoneIncoming, PhoneOutgoing, BookOpen, Settings,
  Bot, CheckCircle2, AlertCircle, Copy, Check, RefreshCw, Clock,
  ChevronDown, ExternalLink, Server, XCircle, Loader2, Sparkles,
  Scissors, CalendarCheck, Link2, Unplug,
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { entities } from '@/api/entities';
import './ReceptionnistIA.css';

// ─── Réglages persistés ─────────────────────────────────────────────────────
const LS_URL = 'voice_server_url';
const LS_TOKEN = 'voice_server_admin_token';
const LS_SALON = 'voice_server_salon';

const E164 = /^\+[1-9]\d{6,14}$/;
const normBase = (u) => (u || '').trim().replace(/\/+$/, '');

// ─── Appels API vers le serveur vocal ───────────────────────────────────────
async function apiCall(base, path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-admin-token'] = token;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* réponse non JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── Libellés ───────────────────────────────────────────────────────────────
const QUAL_LABEL = {
  qualifie: { label: 'RDV pris', cls: 'q-ok' },
  non_interesse: { label: 'Non intéressé', cls: 'q-no' },
  rappel_humain: { label: 'Rappel humain', cls: 'q-recall' },
  hors_sujet: { label: 'Hors sujet', cls: 'q-off' },
};

const LANG_LABEL = { fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand', it: 'Italien', pt: 'Portugais', ar: 'Arabe' };
const langName = (c) => LANG_LABEL[c] || c.toUpperCase();

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

const fmtDuration = (startIso, endIso) => {
  if (!startIso) return '—';
  const end = endIso ? new Date(endIso) : new Date();
  const s = Math.max(0, Math.round((end - new Date(startIso)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function ReceptionnistIA() {
  const navigate = useNavigate();

  // Navigation & salon
  const [tab, setTab] = useState('vocal');
  const [salonName, setSalonName] = useState('');
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Connexion au serveur vocal
  const [base, setBase] = useState(() => localStorage.getItem(LS_URL) || '');
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(LS_TOKEN) || '');
  const [urlDraft, setUrlDraft] = useState(() => localStorage.getItem(LS_URL) || '');
  const [tokenDraft, setTokenDraft] = useState(() => localStorage.getItem(LS_TOKEN) || '');
  const [health, setHealth] = useState(null); // null = non testé, false = injoignable, objet = OK
  const [checking, setChecking] = useState(false);
  const [connError, setConnError] = useState('');
  const [salons, setSalons] = useState([]);
  const [salonId, setSalonId] = useState(() => localStorage.getItem(LS_SALON) || '');
  const [callLog, setCallLog] = useState([]);
  const [copied, setCopied] = useState(false);

  // Appel de test
  const [tcNumber, setTcNumber] = useState('');
  const [tcContext, setTcContext] = useState('');
  const [tcState, setTcState] = useState('idle'); // idle | sending | waiting | done | error
  const [tcError, setTcError] = useState('');
  const [tcEntry, setTcEntry] = useState(null);
  const pollRef = useRef(null);

  const connected = !!(health && health.ok);
  const currentSalon = salons.find((s) => s.id === salonId) || null;

  // ─── Chargement initial : profil pro + vrais services ────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const email = authData?.user?.email;
        if (!email) { setLoadingServices(false); return; }
        const profiles = await entities.ProfilPro.filter({ user_email: email }, '-created_at', 1).catch(() => []);
        if (profiles.length > 0 && profiles[0].salon_name) setSalonName(profiles[0].salon_name);
        const { data: svcs } = await supabase
          .from('Service')
          .select('id,title,name,price,duration,duration_min')
          .eq('pro_email', email)
          .order('created_at', { ascending: false })
          .limit(100);
        setServices(svcs || []);
      } catch (e) {
        console.warn('[Réceptionniste IA] chargement salon :', e);
      } finally {
        setLoadingServices(false);
      }
    })();
  }, []);

  // ─── Santé + données serveur ──────────────────────────────────────────────
  const checkHealth = useCallback(async (b) => {
    const target = normBase(b);
    if (!target) { setHealth(null); return false; }
    setChecking(true);
    try {
      const h = await apiCall(target, '/health');
      setHealth(h);
      setConnError('');
      return true;
    } catch (e) {
      setHealth(false);
      setConnError(`Serveur injoignable (${e.message}). Vérifiez l'URL et que le serveur est démarré.`);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  const loadServerData = useCallback(async (b, tok) => {
    const target = normBase(b);
    if (!target) return;
    try {
      const list = await apiCall(target, '/api/salons', { token: tok });
      setSalons(list || []);
      setSalonId((prev) => {
        if (prev && (list || []).some((s) => s.id === prev)) return prev;
        if ((list || []).length === 1) {
          localStorage.setItem(LS_SALON, list[0].id);
          return list[0].id;
        }
        return prev;
      });
    } catch (e) {
      if (e.status === 401) {
        setConnError("L'API du serveur est protégée : renseignez le token admin ci-dessous.");
      } else {
        setConnError(e.message);
      }
    }
    try {
      const log = await apiCall(target, '/api/calls/log', { token: tok });
      setCallLog(log || []);
    } catch (_) { /* l'historique peut rester vide */ }
  }, []);

  const refreshServer = useCallback(async () => {
    const ok = await checkHealth(base);
    if (ok) await loadServerData(base, adminToken);
  }, [base, adminToken, checkHealth, loadServerData]);

  useEffect(() => {
    if (base) refreshServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ─── Configuration ────────────────────────────────────────────────────────
  const saveServerUrl = async () => {
    const v = normBase(urlDraft);
    localStorage.setItem(LS_URL, v);
    setBase(v);
    setHealth(null);
    setSalons([]);
    setCallLog([]);
    if (v) {
      const ok = await checkHealth(v);
      if (ok) await loadServerData(v, adminToken);
    }
  };

  const saveAdminToken = () => {
    const v = tokenDraft.trim();
    if (v) localStorage.setItem(LS_TOKEN, v);
    else localStorage.removeItem(LS_TOKEN);
    setAdminToken(v);
    setConnError('');
    if (base) loadServerData(base, v);
  };

  const chooseSalon = (id) => {
    setSalonId(id);
    if (id) localStorage.setItem(LS_SALON, id);
    else localStorage.removeItem(LS_SALON);
  };

  const copyWebhook = () => {
    if (!base) return;
    navigator.clipboard.writeText(`${base}/voice/incoming`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const connectGoogle = () => {
    if (base && salonId) window.open(`${base}/auth/google?salon=${encodeURIComponent(salonId)}`, '_blank');
  };

  // ─── Appel de test réel ───────────────────────────────────────────────────
  const launchTestCall = async () => {
    setTcError('');
    setTcEntry(null);
    const to = tcNumber.trim();
    if (!E164.test(to)) {
      setTcError("Numéro invalide : utilisez le format international, par ex. +33612345678.");
      return;
    }
    if (!salonId) {
      setTcError("Aucun salon sélectionné sur le serveur (onglet Configuration).");
      return;
    }
    setTcState('sending');
    try {
      const res = await apiCall(base, '/api/calls', {
        method: 'POST',
        body: { to, salon: salonId, context: tcContext.trim() },
        token: adminToken,
      });
      setTcState('waiting');
      let tries = 0;
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        tries += 1;
        try {
          const log = await apiCall(base, '/api/calls/log', { token: adminToken });
          const entry = (log || []).find((e) => e.callSid === res.callSid);
          if (entry) {
            setTcEntry(entry);
            setCallLog(log || []);
            if (entry.status !== 'en_cours' || tries >= 45) {
              clearInterval(pollRef.current);
              setTcState('done');
            }
          } else if (tries >= 45) {
            clearInterval(pollRef.current);
            setTcState('done');
          }
        } catch (_) { /* on réessaie au prochain tour */ }
      }, 4000);
    } catch (e) {
      setTcState('error');
      setTcError(e.status === 401
        ? "Le serveur exige un token admin : renseignez-le dans l'onglet Configuration."
        : `Échec de l'appel : ${e.message}`);
    }
  };

  const goTestCall = () => {
    if (connected) {
      setTab('vocal');
      setTimeout(() => document.getElementById('rp-testcall')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else {
      setTab('config');
    }
  };

  // ─── Statistiques réelles (historique serveur) ────────────────────────────
  const stats = {
    total: callLog.length,
    booked: callLog.filter((c) => c.qualification === 'qualifie').length,
    ongoing: callLog.filter((c) => c.status === 'en_cours').length,
  };

  const webhookUrl = base ? `${base}/voice/incoming` : '';

  return (
    <div className="receptionist-v2 min-h-screen pb-24">
      {/* ── HEADER ── */}
      <header className="rp-header">
        <button onClick={() => navigate(-1)} className="rp-back-btn" aria-label="Retour"><ArrowLeft size={19} /></button>
        <div className="rp-header-center">
          <h1>Réceptionniste IA</h1>
          <p>{salonName || 'Votre salon'}</p>
        </div>
        <div className={`rp-active-badge ${connected ? '' : 'inactive'}`}>
          <span className="rp-pulse-dot" />
          {connected ? 'ACTIF 24h/24' : 'NON CONNECTÉ'}
        </div>
      </header>

      <div className="rp-container">
        {/* ── HERO ── */}
        <div className="rp-hero-card">
          <div className="rp-hero-deco"><div className="rp-hero-deco-circle c1" /><div className="rp-hero-deco-circle c2" /></div>
          <div className="rp-hero-content">
            <div className="rp-hero-avatar"><Bot size={30} /></div>
            <div className="rp-hero-text">
              <span className="rp-hero-badge"><Sparkles size={10} /> Agent vocal téléphonique — appels réels</span>
              <h2>Maria — Votre Réceptionniste Vocale</h2>
              <p>
                Décroche vos appels, qualifie vos prospects et réserve automatiquement
                dans votre agenda BeautyBook et Google Agenda, 24h/24.
              </p>
              <button className="rp-hero-cta" onClick={goTestCall}>
                <PhoneCall size={14} /> Tester un appel téléphonique
              </button>
            </div>
          </div>
        </div>

        {/* ── ONGLETS ── */}
        <div className="rp-tab-bar">
          {[
            { id: 'vocal', label: 'Agent Vocal', icon: PhoneCall },
            { id: 'knowledge', label: 'Base de Connaissances', icon: BookOpen },
            { id: 'config', label: 'Configuration', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} className={`rp-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={13} /><span>{label}</span>
            </button>
          ))}
        </div>

        {connError && tab !== 'config' && (
          <div className="rp-alert warn"><AlertCircle size={15} /><span>{connError}</span>
            <button className="rp-alert-link" onClick={() => setTab('config')}>Configurer</button>
          </div>
        )}

        {/* ══════════ ONGLET : AGENT VOCAL ══════════ */}
        {tab === 'vocal' && (
          <div className="space-y-4">
            {/* État de l'agent */}
            <div className="rp-card">
              <div className="rp-card-title-row">
                <Server size={15} className="rp-card-icon" />
                <h3>État de l'agent vocal</h3>
                <button className="rp-btn-ghost-sm" onClick={refreshServer} disabled={checking || !base}>
                  <RefreshCw size={12} className={checking ? 'rp-spin' : ''} /> Actualiser
                </button>
              </div>

              {!connected ? (
                <div className="rp-notconn">
                  <Unplug size={26} className="rp-notconn-icon" />
                  <h4>Serveur vocal non connecté</h4>
                  <p>
                    L'agent téléphonique tourne sur un serveur dédié (pas encore déployé).
                    Renseignez son URL dans l'onglet <strong>Configuration</strong> pour voir
                    ici son état en direct, passer des appels de test et consulter l'historique.
                  </p>
                  <button className="rp-btn-primary" onClick={() => setTab('config')}>
                    <Settings size={14} /> Ouvrir la configuration
                  </button>
                </div>
              ) : (
                <div className="rp-status-grid">
                  <div className="rp-status-row">
                    <span className="rp-status-label">Serveur</span>
                    <span className="rp-status-val mono">{base}</span>
                  </div>
                  <div className="rp-status-row">
                    <span className="rp-status-label">Salon sur le serveur</span>
                    <span className="rp-status-val">{currentSalon ? currentSalon.name : '—'}</span>
                  </div>
                  <div className="rp-status-row">
                    <span className="rp-status-label">Numéro Twilio</span>
                    <span className="rp-status-val mono">{currentSalon?.twilio_number || '—'}</span>
                  </div>
                  <div className="rp-status-row">
                    <span className="rp-status-label">Langue par défaut</span>
                    <span className="rp-status-val">{currentSalon ? langName(currentSalon.default_language || 'fr') : '—'}</span>
                  </div>
                  <div className="rp-status-row">
                    <span className="rp-status-label">Voix configurées</span>
                    <span className="rp-status-val">
                      {currentSalon && Object.keys(currentSalon.voices || {}).length > 0
                        ? Object.keys(currentSalon.voices).map(langName).join(', ')
                        : '—'}
                    </span>
                  </div>
                  <div className="rp-status-row">
                    <span className="rp-status-label">Google Agenda</span>
                    <span className={`rp-pill ${currentSalon?.google_connected ? 'ok' : 'warn'}`}>
                      {currentSalon?.google_connected ? 'Connecté' : 'Non connecté'}
                    </span>
                  </div>
                  <div className="rp-status-row">
                    <span className="rp-status-label">Appels en cours</span>
                    <span className="rp-status-val">{health.activeCalls ?? 0}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Appel de test réel */}
            <div className="rp-card" id="rp-testcall">
              <div className="rp-card-title-row">
                <PhoneOutgoing size={15} className="rp-card-icon" />
                <h3>Passer un vrai appel de test</h3>
              </div>
              <p className="rp-card-sub">
                L'agent appelle le numéro indiqué, se présente et converse en conditions réelles.
              </p>
              {!connected ? (
                <div className="rp-info-box">
                  <AlertCircle size={15} />
                  <span>Connectez d'abord le serveur vocal (onglet Configuration) pour passer un appel.</span>
                </div>
              ) : (
                <>
                  <div className="rp-field">
                    <label className="rp-label">Numéro à appeler (format international)</label>
                    <input
                      type="tel"
                      className="rp-input mono"
                      placeholder="+33612345678"
                      value={tcNumber}
                      onChange={(e) => setTcNumber(e.target.value)}
                      disabled={tcState === 'sending' || tcState === 'waiting'}
                    />
                  </div>
                  <div className="rp-field">
                    <label className="rp-label">Contexte de l'appel (optionnel)</label>
                    <input
                      type="text"
                      className="rp-input"
                      placeholder="Ex : prospect intéressée par un lissage"
                      value={tcContext}
                      onChange={(e) => setTcContext(e.target.value)}
                      disabled={tcState === 'sending' || tcState === 'waiting'}
                    />
                  </div>
                  {tcError && <div className="rp-alert error"><XCircle size={15} /><span>{tcError}</span></div>}
                  <button
                    className="rp-btn-primary full"
                    onClick={launchTestCall}
                    disabled={tcState === 'sending' || tcState === 'waiting'}
                  >
                    {tcState === 'sending' || tcState === 'waiting'
                      ? <><Loader2 size={14} className="rp-spin" /> Appel en cours…</>
                      : <><PhoneCall size={14} /> Lancer l'appel</>}
                  </button>

                  {tcEntry && (
                    <div className="rp-call-result">
                      <div className="rp-call-result-head">
                        <span className={`rp-pill ${tcEntry.status === 'en_cours' ? 'warn' : 'ok'}`}>
                          {tcEntry.status === 'en_cours' ? 'En cours' : 'Terminé'}
                        </span>
                        {tcEntry.qualification && (
                          <span className={`rp-qual ${QUAL_LABEL[tcEntry.qualification]?.cls || ''}`}>
                            {QUAL_LABEL[tcEntry.qualification]?.label || tcEntry.qualification}
                          </span>
                        )}
                        <span className="rp-call-time"><Clock size={11} /> {fmtDuration(tcEntry.startedAt, tcEntry.endedAt)}</span>
                      </div>
                      {tcEntry.summary && <p className="rp-call-summary">{tcEntry.summary}</p>}
                      {tcEntry.transcript?.length > 0 && (
                        <details className="rp-transcript">
                          <summary><ChevronDown size={13} /> Transcription ({tcEntry.transcript.length})</summary>
                          <div className="rp-transcript-body">
                            {tcEntry.transcript.map((t, i) => (
                              <p key={i} className={`rp-tr-line ${/assistant|agent|maria/i.test(t.role || '') ? 'agent' : 'caller'}`}>
                                <strong>{/assistant|agent|maria/i.test(t.role || '') ? 'Maria' : 'Appelant'} :</strong> {t.text}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Historique réel des appels */}
            <div className="rp-card">
              <div className="rp-card-title-row">
                <Clock size={15} className="rp-card-icon" />
                <h3>Historique des appels</h3>
              </div>
              {!connected ? (
                <div className="rp-info-box">
                  <AlertCircle size={15} />
                  <span>L'historique apparaîtra ici une fois le serveur connecté.</span>
                </div>
              ) : callLog.length === 0 ? (
                <div className="rp-empty">
                  <PhoneCall size={24} />
                  <h4>Aucun appel pour le moment</h4>
                  <p>Les appels entrants et sortants de l'agent apparaîtront ici avec leur transcription et leur issue.</p>
                </div>
              ) : (
                <div className="rp-calls-list">
                  {callLog.slice(0, 15).map((c) => (
                    <details key={c.callSid} className="rp-call-item">
                      <summary>
                        <span className={`rp-dir ${c.direction === 'inbound' ? 'in' : 'out'}`}>
                          {c.direction === 'inbound' ? <PhoneIncoming size={13} /> : <PhoneOutgoing size={13} />}
                        </span>
                        <span className="rp-call-main">
                          <strong>{c.direction === 'inbound' ? (c.from || 'Appel entrant') : (c.to || 'Appel sortant')}</strong>
                          <span className="rp-call-meta">
                            {fmtDateTime(c.startedAt)} · {fmtDuration(c.startedAt, c.endedAt)}
                            {c.language ? ` · ${langName(c.language)}` : ''}
                          </span>
                        </span>
                        {c.qualification && (
                          <span className={`rp-qual ${QUAL_LABEL[c.qualification]?.cls || ''}`}>
                            {QUAL_LABEL[c.qualification]?.label || c.qualification}
                          </span>
                        )}
                        <ChevronDown size={14} className="rp-chev" />
                      </summary>
                      <div className="rp-call-detail">
                        {c.summary && <p className="rp-call-summary">{c.summary}</p>}
                        {c.transcript?.length > 0 ? (
                          <div className="rp-transcript-body">
                            {c.transcript.map((t, i) => (
                              <p key={i} className={`rp-tr-line ${/assistant|agent|maria/i.test(t.role || '') ? 'agent' : 'caller'}`}>
                                <strong>{/assistant|agent|maria/i.test(t.role || '') ? 'Maria' : 'Appelant'} :</strong> {t.text}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="rp-no-transcript">Pas de transcription disponible.</p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ONGLET : BASE DE CONNAISSANCES ══════════ */}
        {tab === 'knowledge' && (
          <div className="space-y-4">
            <div className="rp-card rp-kb-intro">
              <div className="rp-kb-intro-icon"><BookOpen size={20} /></div>
              <div>
                <h3>Ce que Maria connaît de votre salon</h3>
                <p>
                  L'agent lit vos <strong>vraies prestations BeautyBook</strong> en temps réel :
                  noms, tarifs et durées ci-dessous sont exactement ce qu'elle propose au téléphone.
                </p>
              </div>
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <Scissors size={15} className="rp-card-icon" />
                <h3>Prestations connues de l'agent ({services.length})</h3>
              </div>
              {loadingServices ? (
                <div className="rp-loading"><Loader2 size={18} className="rp-spin" /><span>Chargement…</span></div>
              ) : services.length === 0 ? (
                <div className="rp-empty">
                  <Scissors size={24} />
                  <h4>Aucune prestation trouvée</h4>
                  <p>Ajoutez vos prestations dans votre catalogue pour que l'agent puisse les proposer.</p>
                  <button className="rp-btn-primary" onClick={() => navigate('/pro/catalogue-services')}>
                    Gérer mes services
                  </button>
                </div>
              ) : (
                <>
                  <div className="rp-services-list">
                    {services.map((s) => (
                      <div key={s.id} className="rp-service-row">
                        <div className="rp-service-info">
                          <strong>{s.title || s.name || 'Prestation'}</strong>
                          <span>{s.duration || s.duration_min || 60} min</span>
                        </div>
                        <span className="rp-service-price">
                          {s.price != null && s.price !== '' ? `${Number(s.price).toFixed(0)} €` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button className="rp-btn-ghost full" onClick={() => navigate('/pro/catalogue-services')}>
                    <Scissors size={13} /> Gérer mes services
                  </button>
                </>
              )}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <Sparkles size={15} className="rp-card-icon" />
                <h3>Consignes fines de l'agent</h3>
              </div>
              <p className="rp-card-sub">
                Le ton, les spécialités du salon (ex : coiffure afro, lissages, tresses) et le message
                d'accueil se règlent dans la configuration du salon sur le serveur vocal
                (<span className="mono">salons/mamara-hair-91.json</span>, champ <span className="mono">extra_prompt</span>),
                puis dans l'onglet Configuration du dashboard serveur.
              </p>
              <div className="rp-info-box">
                <CheckCircle2 size={15} />
                <span>L'agent vérifie toujours vos disponibilités réelles (horaires + RDV existants) avant de proposer un créneau.</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET : CONFIGURATION ══════════ */}
        {tab === 'config' && (
          <div className="space-y-4">
            <div className="rp-card">
              <div className="rp-card-title-row">
                <Server size={15} className="rp-card-icon" />
                <h3>Serveur vocal</h3>
              </div>
              <div className="rp-field">
                <label className="rp-label">URL du serveur vocal</label>
                <input
                  type="url"
                  className="rp-input mono"
                  placeholder="https://votre-serveur.onrender.com"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                />
                <p className="rp-field-help">Adresse publique du serveur (Render, Railway…). Enregistrée sur cet appareil uniquement.</p>
              </div>
              <div className="flex gap-2">
                <button className="rp-btn-primary" onClick={saveServerUrl} disabled={checking}>
                  {checking ? <Loader2 size={14} className="rp-spin" /> : <Check size={14} />} Enregistrer
                </button>
                <button className="rp-btn-ghost" onClick={() => checkHealth(base)} disabled={checking || !base}>
                  <RefreshCw size={13} className={checking ? 'rp-spin' : ''} /> Tester la connexion
                </button>
              </div>
              {health && health.ok && (
                <div className="rp-alert ok"><CheckCircle2 size={15} /><span>Serveur joignable — {health.salons} salon(s), {health.activeCalls ?? 0} appel(s) en cours.</span></div>
              )}
              {health === false && (
                <div className="rp-alert error"><XCircle size={15} /><span>Serveur injoignable. Vérifiez l'URL et que le serveur est démarré.</span></div>
              )}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <Settings size={15} className="rp-card-icon" />
                <h3>Salon & sécurité</h3>
              </div>
              <div className="rp-field">
                <label className="rp-label">Salon sur le serveur</label>
                <select
                  className="rp-input"
                  value={salonId}
                  onChange={(e) => chooseSalon(e.target.value)}
                  disabled={salons.length === 0}
                >
                  <option value="">{salons.length === 0 ? '— connectez le serveur —' : 'Choisir un salon…'}</option>
                  {salons.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.twilio_number || 'sans numéro'})</option>
                  ))}
                </select>
              </div>
              <div className="rp-field">
                <label className="rp-label">Token admin du serveur (optionnel)</label>
                <input
                  type="password"
                  className="rp-input mono"
                  placeholder="x-admin-token"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  autoComplete="off"
                />
                <p className="rp-field-help">
                  Requis uniquement si le serveur est protégé par <span className="mono">ADMIN_TOKEN</span>.
                  Stocké localement sur cet appareil.
                </p>
              </div>
              <button className="rp-btn-ghost" onClick={saveAdminToken}><Check size={13} /> Enregistrer le token</button>
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <Link2 size={15} className="rp-card-icon" />
                <h3>Branchement Twilio</h3>
              </div>
              <p className="rp-card-sub">
                Pour que Maria décroche vos appels entrants, collez cette URL dans la console Twilio :
                <strong> Phone Numbers → votre numéro → Voice → « A call comes in » → Webhook (POST)</strong>.
              </p>
              <div className="rp-webhook-box">
                <code className="mono">{webhookUrl || '— renseignez d\u2019abord l\u2019URL du serveur —'}</code>
                <button className="rp-copy-btn" onClick={copyWebhook} disabled={!webhookUrl}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {copied && <p className="rp-copied-msg">URL copiée !</p>}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <CalendarCheck size={15} className="rp-card-icon" />
                <h3>Google Agenda</h3>
              </div>
              {!connected ? (
                <p className="rp-card-sub">Connectez le serveur pour gérer l'agenda Google.</p>
              ) : currentSalon?.google_connected ? (
                <div className="rp-alert ok"><CheckCircle2 size={15} /><span>Agenda Google connecté pour {currentSalon.name} — les RDV pris au téléphone y sont ajoutés.</span></div>
              ) : (
                <>
                  <p className="rp-card-sub">Reliez l'agenda Google du salon pour que chaque RDV téléphonique y soit créé automatiquement.</p>
                  <button className="rp-btn-primary" onClick={connectGoogle} disabled={!salonId}>
                    <ExternalLink size={14} /> Connecter Google Agenda
                  </button>
                </>
              )}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <Bot size={15} className="rp-card-icon" />
                <h3>Dashboard du serveur</h3>
              </div>
              <p className="rp-card-sub">
                Voix par langue, langue par défaut, journal détaillé : tout se règle aussi depuis le dashboard du serveur.
              </p>
              <button
                className="rp-btn-ghost full"
                disabled={!base}
                onClick={() => window.open(base, '_blank')}
              >
                <ExternalLink size={13} /> Ouvrir le dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── CHIFFRES RÉELS ── */}
        {connected && (
          <div className="rp-kpi-strip">
            <div className="rp-kpi"><strong>{stats.total}</strong><span>Appels</span></div>
            <div className="rp-kpi-divider" />
            <div className="rp-kpi"><strong>{stats.booked}</strong><span>RDV pris</span></div>
            <div className="rp-kpi-divider" />
            <div className="rp-kpi"><strong>{stats.ongoing}</strong><span>En cours</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
