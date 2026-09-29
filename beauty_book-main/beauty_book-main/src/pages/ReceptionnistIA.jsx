import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PhoneCall, Mic, MicOff, PhoneOff, BookOpen, Settings,
  Bot, CheckCircle2, AlertCircle, RefreshCw, Loader2, Sparkles,
  Scissors, KeyRound, ExternalLink, Volume2, MessageCircle, Power, Activity,
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { entities } from '@/api/entities';
import { useTheme } from '@/hooks/useTheme';
import { GrokVoiceSession } from '@/lib/grokVoice';
import { mintVoiceToken, DEFAULT_AGENT_ID } from '@/lib/grok';
import { getSalonAISettings, saveSalonAISettings } from '@/lib/salonAI';
import { buildVoiceInstructions, resolveWelcomeMessage, DEFAULT_INSTRUCTIONS, DEFAULT_WELCOME_MESSAGE } from '@/lib/voiceAgentPrompt';
import { buildVoiceTools, testVoiceDataAccess } from '@/lib/voiceAgentTools';
import { summarizeHours } from '@/lib/hours';
import { recordVoiceMinutes, getUsageSummary, getCredit, setCredit, getRates, setRates, DEFAULT_RATES, fmtUSD, fmtTokens, FEATURE_LABELS } from '@/lib/apiUsage';
import ApiUsageTab from '@/components/voice/ApiUsageTab';
import './ReceptionnistIA.css';

const GROK_VOICES = [
  { id: 'ara', label: 'Ara — voix féminine' },
  { id: 'eve', label: 'Eve — voix féminine' },
  { id: 'rex', label: 'Rex — voix masculine' },
  { id: 'sal', label: 'Sal — voix masculine' },
  { id: 'leo', label: 'Leo — voix masculine' },
];

const fmtPrice = (s) => (s.price != null && s.price !== '' ? `${Number(s.price).toFixed(0)} €` : '—');
const fmtDur = (s) => `${s.duration || s.duration_min || 60} min`;

/** Petit interrupteur on/off. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label || 'Activer / désactiver'}
      className={`rp-toggle${checked ? ' on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    >
      <span className="rp-toggle-knob" />
    </button>
  );
}

export default function ReceptionnistIA() {
  useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState('vocal');
  const [salonName, setSalonName] = useState('');
  const [profil, setProfil] = useState(null); // ProfilPro complet (adresse, téléphone, horaires…)
  const [proEmail, setProEmail] = useState('');
  const [services, setServices] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Réglages IA du salon (agent vocal + chatbot propres à chaque salon)
  const [vocalEnabled, setVocalEnabled] = useState(true);
  const [aiReady, setAiReady] = useState(false);

  // Configuration vocale du salon
  const [voiceKeySet, setVoiceKeySet] = useState(false);
  const [voiceKeyDraft, setVoiceKeyDraft] = useState('');
  const [agentId, setAgentId] = useState(DEFAULT_AGENT_ID);
  const [agentDraft, setAgentDraft] = useState(DEFAULT_AGENT_ID);
  const [voice, setVoice] = useState('ara');

  // Base de connaissances de l'agent vocal (propre au salon)
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeDraft, setWelcomeDraft] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [connectionMode, setConnectionMode] = useState('direct');
  const [kbSaved, setKbSaved] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState(null);

  // État du service (test réel du endpoint de token)
  const [svcState, setSvcState] = useState('unknown'); // unknown | checking | ok | error
  const [svcError, setSvcError] = useState('');

  // Session voix en direct
  const [voiceState, setVoiceState] = useState('idle'); // idle | connecting | live | error
  const [voiceError, setVoiceError] = useState('');
  // Étape du pipeline vocal serveur : listening | thinking | responding | null.
  // Affichée en direct pour prouver que le serveur entend et répond.
  const [pipeStage, setPipeStage] = useState(null);
  const [speaking, setSpeaking] = useState(null); // 'user' | 'agent' | null
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [mode, setMode] = useState(null); // 'agent' | 'direct'
  const [transcript, setTranscript] = useState([]); // [{who, text, done}]
  const sessionRef = useRef(null);
  const transcriptEndRef = useRef(null);
  // Début de l'appel vocal en cours (pour le suivi des minutes → onglet Utilisation)
  const callStartRef = useRef(null);
  const recordCallMinutes = useCallback(() => {
    if (callStartRef.current) {
      const mins = (Date.now() - callStartRef.current) / 60000;
      callStartRef.current = null;
      recordVoiceMinutes(mins, 'vocal');
    }
  }, []);

  // ─── Test réel du service vocal (mint d'un token éphémère) ───────────────
  const checkService = useCallback(async () => {
    setSvcState('checking');
    setSvcError('');
    try {
      await mintVoiceToken(proEmail);
      setSvcState('ok');
    } catch (e) {
      setSvcState('error');
      setSvcError(e.message);
    }
  }, [proEmail]);

  // ─── Chargement initial : pro + réglages IA du salon + vrais services ────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const email = authData?.user?.email || '';
        if (alive) setProEmail(email);
        // Réglages IA propres à ce salon (agent vocal + chatbot + agent_id + voix + base de connaissances)
        const ai = await getSalonAISettings(email);
        if (!alive) return;
        setVocalEnabled(ai.vocal_enabled !== false);
        setAgentId(ai.agent_id || DEFAULT_AGENT_ID);
        setAgentDraft(ai.agent_id || DEFAULT_AGENT_ID);
        setVoice(ai.voice || 'ara');
        setWelcomeMessage(ai.welcome_message || '');
        setWelcomeDraft(ai.welcome_message || '');
        setCustomInstructions(ai.custom_instructions || '');
        setInstructionsDraft(ai.custom_instructions || '');
        setConnectionMode(ai.connection_mode === 'agent' ? 'agent' : 'direct');
        setVoiceKeySet(false);
        // Statut de la clé via la route serveur (la clé brute ne revient jamais au navigateur)
        try {
          const { data: sess } = await supabase.auth.getSession();
          const r = await fetch('/api/voice-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pro_email: email, access_token: sess?.session?.access_token || '', action: 'status' }),
          });
          const j = await r.json().catch(() => ({}));
          if (alive && r.ok) setVoiceKeySet(!!j.configured);
        } catch { /* indicateur indisponible */ }
        setAiReady(true);
        if (email) {
          const profiles = await entities.ProfilPro.filter({ user_email: email }, '-created_at', 1).catch(() => []);
          if (!alive) return;
          if (profiles.length > 0) {
            setProfil(profiles[0]);
            if (profiles[0].salon_name) setSalonName(profiles[0].salon_name);
          }
          const { data: svcs } = await supabase
            .from('Service')
            .select('id,title,name,price,duration,duration_min')
            .eq('pro_email', email)
            .order('created_at', { ascending: false })
            .limit(100);
          if (alive) setServices(svcs || []);
          const { data: bnds } = await supabase
            .from('ServiceBundle')
            .select('id,name,description,bundle_price,service_ids,is_active')
            .eq('pro_email', email)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(40);
          if (alive) setBundles(bnds || []);
        }
      } catch (e) {
        console.warn('[Réceptionniste IA] chargement salon :', e);
      } finally {
        if (alive) {
          setLoadingServices(false);
          // Vérification automatique du service → le badge passe au vert si tout est OK
          checkService();
        }
      }
    })();
    return () => { alive = false; sessionRef.current?.disconnect(); };
  }, [checkService]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [transcript]);

  // ─── Interrupteurs master (par salon) ────────────────────────────────────
  const toggleVocal = useCallback(async (on) => {
    setVocalEnabled(on);
    if (!on && sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
      setVoiceState('idle');
      setSpeaking(null);
      setMuted(false);
    }
    if (proEmail) await saveSalonAISettings(proEmail, { vocal_enabled: on });
  }, [proEmail]);

  // ─── Session voix ────────────────────────────────────────────────────────
  const handleVoiceEvent = useCallback((type, p) => {
    if (type === 'state') {
      if (p.state === 'connected') {
        setVoiceState('live');
        setMode(p.mode || null);
        setVoiceError('');
      } else if (p.state === 'disconnected') {
        setVoiceState('idle');
        setSpeaking(null);
        setMicLevel(0);
        setPipeStage(null);
        recordCallMinutes();
      } else if (p.state === 'error') {
        setVoiceState('error');
      }
    } else if (type === 'error') {
      setVoiceError(p.message || 'Erreur de session vocale.');
      setVoiceState((s) => (s === 'live' ? s : 'error'));
    } else if (type === 'mic-level') {
      setMicLevel(p.level || 0);
    } else if (type === 'tool-call') {
      // L'agent utilise un outil (créneaux, réservation…) — journal discret.
      console.log('[Réceptionniste IA] outil appelé :', p.name, p.args);
    } else if (type === 'agent-hangup') {
      setTranscript((t) => [...t, { who: 'agent', text: 'Appel terminé.', done: true }]);
    } else if (type === 'pipeline') {
      // Étapes serveur : listening (il nous entend) → thinking →
      // responding. 'ready' = config VAD acceptée par le serveur.
      setPipeStage(p.stage === 'ready' ? null : p.stage);
    } else if (type === 'speaking') {
      setSpeaking(p.who);
      if (p.who === 'agent') {
        setTranscript((t) => {
          const last = t[t.length - 1];
          if (last && last.who === 'agent' && !last.done) return t;
          return [...t, { who: 'agent', text: '', done: false }];
        });
      }
    } else if (type === 'user-transcript') {
      const text = (p.text || '').trim();
      if (!text) return;
      setTranscript((t) => {
        const last = t[t.length - 1];
        if (last && last.who === 'user' && !p.final) {
          return [...t.slice(0, -1), { who: 'user', text, done: false }];
        }
        if (last && last.who === 'user' && last.text === text) return t;
        return [...t, { who: 'user', text, done: !!p.final }];
      });
    } else if (type === 'agent-transcript') {
      if (p.delta) {
        setTranscript((t) => {
          const last = t[t.length - 1];
          if (last && last.who === 'agent' && !last.done) {
            return [...t.slice(0, -1), { who: 'agent', text: last.text + p.delta, done: false }];
          }
          return [...t, { who: 'agent', text: p.delta, done: false }];
        });
      }
      if (p.done) {
        setTranscript((t) => {
          const last = t[t.length - 1];
          if (last && last.who === 'agent') {
            return [...t.slice(0, -1), { who: 'agent', text: p.text || last.text, done: true }];
          }
          return t;
        });
        setSpeaking(null);
        setPipeStage(null); // réponse terminée → retour à « À vous… »
      }
    }
  }, []);

  const startCall = async () => {
    if (!vocalEnabled) return;
    if (voiceState === 'connecting' || voiceState === 'live') return;
    setVoiceState('connecting');
    setVoiceError('');
    setTranscript([]);
    setSpeaking(null);
    setMicLevel(0);
    setMode(null);
    try {
      const { token } = await mintVoiceToken(proEmail);
      // ── Données du salon RELUES À CHAQUE APPEL (temps réel) ──
      let liveServices = services;
      let liveBundles = bundles;
      let liveProfil = profil;
      try {
        const { data: svcs } = await supabase
          .from('Service')
          .select('id,title,name,price,duration,duration_min')
          .eq('pro_email', proEmail)
          .order('created_at', { ascending: false })
          .limit(100);
        if (svcs) { liveServices = svcs; setServices(svcs); }
        const { data: bnds } = await supabase
          .from('ServiceBundle')
          .select('id,name,description,bundle_price,service_ids,is_active')
          .eq('pro_email', proEmail)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(40);
        if (bnds) { liveBundles = bnds; setBundles(bnds); }
        const profiles = await entities.ProfilPro.filter({ user_email: proEmail }, '-created_at', 1).catch(() => []);
        if (profiles && profiles.length > 0) {
          liveProfil = profiles[0];
          setProfil(profiles[0]);
          if (profiles[0].salon_name) setSalonName(profiles[0].salon_name);
        }
      } catch { /* repli sur le cache déjà chargé */ }
      const name = liveProfil?.salon_name || salonName || 'votre salon';
      const hoursSummary = (() => {
        try {
          const groups = summarizeHours(liveProfil?.ouverture || liveProfil?.horaires);
          return groups.map((g) => `${g.label} : ${g.open ? g.hours : 'Fermé'}`).join(' · ') || '';
        } catch { return ''; }
      })();
      const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const instructions = buildVoiceInstructions({
        salonName: name,
        services: liveServices,
        bundles: liveBundles,
        profil: liveProfil,
        hoursSummary,
        customInstructions,
        todayLabel,
      });
      // ── Jamais deux sessions en même temps : l'ancienne est fermée avant
      // d'en créer une nouvelle (sinon deux agents écoutent et parlent en
      // même temps → écho et réponses en boucle).
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      const session = new GrokVoiceSession({
        token,
        agentId,
        voice,
        language: 'fr',
        instructions,
        tools: buildVoiceTools({ proEmail }),
        greeting: resolveWelcomeMessage(welcomeMessage, name),
        connectionMode,
        onEvent: handleVoiceEvent,
      });
      sessionRef.current = session;
      await session.connect();
      callStartRef.current = Date.now();
    } catch (e) {
      setVoiceState('error');
      setVoiceError(e.message || "Impossible de démarrer l'appel vocal.");
    }
  };

  const hangUp = () => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setMuted(false);
    setMicLevel(0);
    setPipeStage(null);
    recordCallMinutes();
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    sessionRef.current?.setMuted(m);
  };

  const saveAgentId = async () => {
    const v = agentDraft.trim();
    if (!v) return;
    setAgentId(v);
    if (proEmail) await saveSalonAISettings(proEmail, { agent_id: v });
  };

  const saveVoice = async (v) => {
    setVoice(v);
    if (proEmail) await saveSalonAISettings(proEmail, { voice: v });
  };

  // ─── Base de connaissances : message de bienvenue + instructions + mode ──
  const flashSaved = () => {
    setKbSaved(true);
    setTimeout(() => setKbSaved(false), 2500);
  };

  const saveWelcome = async () => {
    const v = welcomeDraft.trim();
    setWelcomeMessage(v);
    if (proEmail) await saveSalonAISettings(proEmail, { welcome_message: v });
    flashSaved();
  };

  const saveInstructions = async () => {
    const v = instructionsDraft.trim();
    setCustomInstructions(v);
    if (proEmail) await saveSalonAISettings(proEmail, { custom_instructions: v });
    flashSaved();
  };

  const resetInstructions = async () => {
    setInstructionsDraft('');
    setCustomInstructions('');
    if (proEmail) await saveSalonAISettings(proEmail, { custom_instructions: '' });
    flashSaved();
  };

  const saveConnectionMode = async (m) => {
    const v = m === 'agent' ? 'agent' : 'direct';
    setConnectionMode(v);
    if (proEmail) await saveSalonAISettings(proEmail, { connection_mode: v });
    flashSaved();
  };

  // ─── Diagnostic : vérifie que l'agent vocal peut VRAIMENT lire ──────────
  // le profil, les horaires, les prestations, les bundles et le planning.
  const runDiagnostics = async () => {
    if (diagLoading) return;
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const report = await testVoiceDataAccess(proEmail);
      setDiagResult(report);
    } catch (e) {
      setDiagResult({ email: proEmail || '(vide)', ok: false, checks: [{ label: 'Test', ok: false, detail: e?.message || 'Erreur inconnue' }] });
    } finally {
      setDiagLoading(false);
    }
  };

  const [savingKey, setSavingKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState(null);
  const callVoiceKeyApi = async (action, voice_api_key) => {
    const { data: sess } = await supabase.auth.getSession();
    const r = await fetch('/api/voice-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pro_email: proEmail, access_token: sess?.session?.access_token || '', action, voice_api_key }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Échec.');
    return j;
  };
  const saveVoiceKey = async () => {
    const v = voiceKeyDraft.trim();
    if (!v) { setKeyMsg({ type: 'error', text: 'Collez votre clé API vocale.' }); return; }
    setSavingKey(true);
    try {
      await callVoiceKeyApi('save', v);
      setVoiceKeySet(true); setVoiceKeyDraft('');
      setKeyMsg({ type: 'ok', text: 'Clé enregistrée. Les prochains appels utiliseront votre propre clé.' });
    } catch (e) { setKeyMsg({ type: 'error', text: e.message || "Échec de l'enregistrement." }); }
    finally { setSavingKey(false); }
  };
  const removeVoiceKey = async () => {
    if (!window.confirm('Supprimer la clé API vocale de ce salon ?')) return;
    try {
      await callVoiceKeyApi('remove');
      setVoiceKeySet(false); setVoiceKeyDraft('');
      setKeyMsg({ type: 'ok', text: 'Clé supprimée.' });
    } catch (e) { setKeyMsg({ type: 'error', text: e.message || 'Échec de la suppression.' }); }
  };

  const copyForXaiConsole = async () => {
    const name = profil?.salon_name || salonName || 'votre salon';
    const text = buildVoiceInstructions({
      salonName: name,
      services,
      bundles,
      profil,
      hoursSummary: '',
      customInstructions: instructionsDraft,
      todayLabel: '',
    });
    try {
      await navigator.clipboard.writeText(text);
      flashSaved();
    } catch {
      setVoiceError("Copie impossible : sélectionnez le texte manuellement.");
    }
  };

  const serviceReady = svcState === 'ok';
  const inCall = voiceState === 'live' || voiceState === 'connecting';
  const badgeLabel = !vocalEnabled ? 'DÉSACTIVÉ' : serviceReady ? 'AGENT PRÊT' : 'À CONFIGURER';
  const badgeActive = vocalEnabled && serviceReady;

  return (
    <div className="receptionist-v2 min-h-screen pb-24">
      {/* ── HEADER ── */}
      <header className="rp-header">
        <button onClick={() => navigate(-1)} className="rp-back-btn" aria-label="Retour"><ArrowLeft size={19} /></button>
        <div className="rp-header-center">
          <h1>Réceptionniste IA</h1>
          <p>{salonName || 'Votre salon'}</p>
        </div>
        <div className={`rp-active-badge ${badgeActive ? '' : 'inactive'}`}>
          <span className="rp-pulse-dot" />
          {badgeLabel}
        </div>
      </header>

      <div className="rp-container">
        {/* ── INTERRUPTEURS MASTER (tout en haut) ── */}
        <div className="rp-card rp-master-card">
          <div className="rp-card-title-row">
            <Power size={15} className="rp-card-icon" />
            <h3>Activation des assistants</h3>
          </div>
          <div className="rp-master-row">
            <div className="rp-master-info">
              <div className="rp-master-ico"><PhoneCall size={16} /></div>
              <div>
                <strong>Agent vocal</strong>
                <span>Maria répond à voix haute depuis cette page</span>
              </div>
            </div>
            <Toggle checked={vocalEnabled} onChange={toggleVocal} label="Activer ou désactiver l'agent vocal" />
          </div>
          {!aiReady && (
            <p className="rp-card-sub" style={{ marginTop: 8 }}>Chargement des réglages du salon…</p>
          )}
        </div>

        {/* ── HERO ── */}
        <div className="rp-hero-card">
          <div className="rp-hero-deco"><div className="rp-hero-deco-circle c1" /><div className="rp-hero-deco-circle c2" /></div>
          <div className="rp-hero-content">
            <div className="rp-hero-avatar"><Bot size={30} /></div>
            <div className="rp-hero-text">
              <span className="rp-hero-badge"><Sparkles size={10} /> Agent vocal IA — conversation en direct</span>
              <h2>Maria — Votre Réceptionniste Vocale</h2>
              <p>
                Parlez directement à votre agent vocal IA depuis cette page :
                il vous répond à voix haute, en français, 24h/24.
              </p>
              <button
                className={`rp-hero-cta${!vocalEnabled ? ' disabled' : ''}`}
                onClick={() => { if (!vocalEnabled) return; setTab('vocal'); setTimeout(startCall, 150); }}
                disabled={!vocalEnabled}
              >
                <PhoneCall size={14} /> {vocalEnabled ? "Parler à l'agent" : 'Agent vocal désactivé'}
              </button>
            </div>
          </div>
        </div>

        {/* ── ONGLETS ── */}
        <div className="rp-tab-bar">
          {[
            { id: 'vocal', label: 'Agent Vocal', icon: PhoneCall },
            { id: 'usage', label: 'Utilisation', icon: Activity },
            { id: 'knowledge', label: 'Base de Connaissances', icon: BookOpen },
            { id: 'config', label: 'Configuration', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} className={`rp-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={13} /><span>{label}</span>
            </button>
          ))}
        </div>

        {/* ══════════ ONGLET : AGENT VOCAL ══════════ */}
        {tab === 'vocal' && (
          <div className="space-y-4">
            {/* État du service */}
            <div className="rp-card">
              <div className="rp-card-title-row">
                <Bot size={15} className="rp-card-icon" />
                <h3>État de l'agent vocal</h3>
                <button className="rp-btn-ghost-sm" onClick={checkService} disabled={svcState === 'checking'}>
                  <RefreshCw size={12} className={svcState === 'checking' ? 'rp-spin' : ''} /> Vérifier
                </button>
              </div>
              {svcState === 'unknown' && (
                <div className="rp-info-box">
                  <AlertCircle size={15} />
                  <span>Vérification de la connexion au service vocal…</span>
                </div>
              )}
              {svcState === 'checking' && (
                <div className="rp-loading"><Loader2 size={18} className="rp-spin" /><span>Vérification…</span></div>
              )}
              {svcState === 'ok' && (
                <div className="rp-alert ok">
                  <CheckCircle2 size={15} />
                  <span>Service vocal opérationnel — token éphémère obtenu, clé API jamais exposée.</span>
                </div>
              )}
              {svcState === 'error' && (
                <div className="rp-alert error">
                  <AlertCircle size={15} />
                  <span>{svcError || 'Service vocal indisponible.'}</span>
                </div>
              )}
              <div className="rp-status-grid">
                <div className="rp-status-row">
                  <span className="rp-status-label">Agent (ce salon)</span>
                  <span className="rp-status-val mono">{(agentId || '').slice(0, 24)}…</span>
                </div>
                <div className="rp-status-row">
                  <span className="rp-status-label">Voix (mode direct)</span>
                  <span className="rp-status-val">{GROK_VOICES.find((v) => v.id === voice)?.label || voice}</span>
                </div>
                <div className="rp-status-row">
                  <span className="rp-status-label">Langue</span>
                  <span className="rp-status-val">Français</span>
                </div>
              </div>
            </div>

            {/* Conversation vocale en direct */}
            <div className="rp-card rp-voice-card">
              <div className="rp-card-title-row">
                <Volume2 size={15} className="rp-card-icon" />
                <h3>Conversation en direct</h3>
              </div>

              {!vocalEnabled && (
                <div className="rp-voice-idle">
                  <div className="rp-voice-start off"><MicOff size={26} /></div>
                  <p>L'agent vocal est désactivé pour ce salon.<br />Réactivez-le avec l'interrupteur ci-dessus.</p>
                </div>
              )}

              {vocalEnabled && !inCall && voiceState !== 'error' && (
                <div className="rp-voice-idle">
                  <button className="rp-voice-start" onClick={startCall} aria-label="Parler à l'agent">
                    <Mic size={26} />
                  </button>
                  <p>Appuyez et parlez à Maria.<br />Elle vous répond à voix haute.</p>
                </div>
              )}

              {vocalEnabled && voiceState === 'connecting' && (
                <div className="rp-voice-idle">
                  <div className="rp-voice-start connecting"><Loader2 size={26} className="rp-spin" /></div>
                  <p>Connexion à l'agent vocal…</p>
                </div>
              )}

              {vocalEnabled && voiceState === 'error' && (
                <div className="rp-voice-idle">
                  <div className="rp-alert error"><AlertCircle size={15} /><span>{voiceError}</span></div>
                  <button className="rp-btn-primary" onClick={startCall} style={{ marginTop: 12 }}>
                    <RefreshCw size={14} /> Réessayer
                  </button>
                </div>
              )}

              {vocalEnabled && voiceState === 'live' && (
                <>
                  <div className="rp-voice-live">
                    <div className={`rp-orb${speaking === 'agent' ? ' speaking-agent' : speaking === 'user' ? ' speaking-user' : ''}`}>
                      <Bot size={30} />
                    </div>
                    <p className="rp-voice-status">
                      {mode === 'agent' ? 'Agent distant connecté' : 'Mode direct'}
                      {' · '}
                      {speaking === 'agent' ? 'Maria parle…' : speaking === 'user' ? 'Vous parlez…' : muted ? 'Micro coupé' : 'À vous…'}
                    </p>
                    {/* Étape serveur en direct : prouve que l'agent entend / réfléchit / répond */}
                    {pipeStage && (
                      <p className="rp-pipe-stage">
                        {pipeStage === 'listening'
                          ? '🎤 Je vous écoute…'
                          : pipeStage === 'responding'
                            ? '🗣️ Je vous réponds…'
                            : '💭 Je réfléchis…'}
                      </p>
                    )}
                    {/* Niveau du micro : la barre bouge quand vous parlez = l'agent vous entend */}
                    <div className="rp-mic-meter" aria-hidden="true">
                      <div className="rp-mic-meter-fill" style={{ width: `${Math.round(micLevel * 100)}%` }} />
                    </div>
                    <p className="rp-mic-hint">
                      {muted ? 'Micro coupé — réactivez-le pour parler.' : micLevel > 0.05 ? 'Micro actif : Maria vous entend.' : 'Parlez… la barre ci-dessus doit bouger.'}
                    </p>
                    <div className="rp-voice-controls">
                      <button className={`rp-voice-btn${muted ? ' active' : ''}`} onClick={toggleMute} aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'}>
                        {muted ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                      <button className="rp-voice-btn hangup" onClick={hangUp} aria-label="Raccrocher">
                        <PhoneOff size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="rp-transcript-live">
                    {transcript.length === 0 && (
                      <p className="rp-transcript-hint">Parlez… la transcription s'affiche ici en direct.</p>
                    )}
                    {transcript.map((t, i) => (
                      <div key={i} className={`rp-tl ${t.who}`}>
                        <span className="rp-tl-who">{t.who === 'agent' ? 'Maria' : 'Vous'}</span>
                        <p>{t.text || '…'}</p>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                </>
              )}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <Sparkles size={15} className="rp-card-icon" />
                <h3>Bon à savoir</h3>
              </div>
              <p className="rp-card-sub">
                La connexion utilise un <strong>token éphémère de 5 minutes</strong> : votre clé API vocale
                reste sur le serveur et n'est jamais exposée dans l'application.
                Chaque salon possède son propre agent et ses propres réglages.
                Pour recevoir de vrais appels téléphoniques, attachez un numéro à votre agent
                depuis la console du service vocal (page de l'agent → onglet Deployment).
              </p>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET : UTILISATION API ══════════ */}
        {tab === 'usage' && <ApiUsageTab />}

        {/* ══════════ ONGLET : BASE DE CONNAISSANCES ══════════ */}
        {tab === 'knowledge' && (
          <div className="space-y-4">
            <div className="rp-card rp-kb-intro">
              <div className="rp-kb-intro-icon"><BookOpen size={20} /></div>
              <div>
                <h3>Ce que Maria connaît de votre salon</h3>
                <p>
                  L'agent lit vos <strong>vraies prestations BeautyBook</strong> en temps réel :
                  noms, tarifs et durées ci-dessous sont exactement ce qu'elle annonce à voix haute.
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
                          <span>{fmtDur(s)}</span>
                        </div>
                        <span className="rp-service-price">{fmtPrice(s)}</span>
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
                <h3>Ce que l'agent sait de votre salon</h3>
              </div>
              <p className="rp-card-sub">
                À chaque appel, l'agent relit <strong>en temps réel</strong> vos données BeautyBook :
                prestations, offres packs, tarifs, durées, horaires, adresse et téléphone.
                Modifiez-les dans votre profil ou votre catalogue : l'agent utilisera
                automatiquement les nouvelles informations, sans rien reconfigurer.
              </p>
              {(() => {
                let hoursTxt = '';
                try {
                  const groups = summarizeHours(profil?.ouverture || profil?.horaires);
                  hoursTxt = groups.map((g) => `${g.label} : ${g.open ? g.hours : 'Fermé'}`).join(' · ');
                } catch { /* horaires non configurés */ }
                const addr = profil?.address || profil?.adresse || '';
                const phone = profil?.phone || profil?.telephone || '';
                if (!hoursTxt && !addr && !phone && services.length === 0 && bundles.length === 0) return null;
                return (
                  <div className="rp-kb-data">
                    {hoursTxt ? <div className="rp-kb-data-row"><strong>Horaires :</strong><span>{hoursTxt}</span></div> : null}
                    {addr ? <div className="rp-kb-data-row"><strong>Adresse :</strong><span>{addr}</span></div> : null}
                    {phone ? <div className="rp-kb-data-row"><strong>Téléphone :</strong><span>{phone}</span></div> : null}
                    <div className="rp-kb-data-row"><strong>Prestations :</strong><span>{services.length} au catalogue</span></div>
                    <div className="rp-kb-data-row"><strong>Offres packs :</strong><span>{bundles.length} actif(s)</span></div>
                    <button className="rp-btn-ghost full" onClick={() => navigate('/pro/profil')}>
                      Modifier dans mon profil pro
                    </button>
                  </div>
                );
              })()}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <MessageCircle size={15} className="rp-card-icon" />
                <h3>Instructions et message de bienvenue</h3>
              </div>
              <p className="rp-card-sub">
                Le ton, les instructions détaillées et le message d'accueil de l'agent se règlent
                dans l'onglet <strong>Configuration</strong> ci-contre.
                {connectionMode === 'agent'
                  ? " Vous êtes en mode « Agent distant » : pensez aussi à mettre à jour la console du service vocal (bouton « Copier pour la console »)."
                  : " Vous êtes en mode « Direct » : l'agent parle français et utilise vos instructions ci-dessous."}
              </p>
              <button className="rp-btn-ghost full" onClick={() => setTab('config')}>
                <Settings size={13} /> Ouvrir la configuration
              </button>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET : CONFIGURATION ══════════ */}
        {tab === 'config' && (
          <div className="space-y-4">
            <div className="rp-card">
              <div className="rp-card-title-row">
                <KeyRound size={15} className="rp-card-icon" />
                <h3>Clé API vocale du salon</h3>
              </div>
              <p className="rp-card-sub">
                Chaque salon peut connecter sa <strong>propre clé API vocale</strong> : l'agent vocal
                utilisera alors votre clé (et votre facturation) au lieu de celle de BeautyBook.
                La clé est conservée <strong>côté serveur uniquement</strong> — elle n'est jamais
                affichée ni renvoyée au navigateur.
              </p>
              {voiceKeySet ? (
                <div className="rp-alert ok" style={{ marginTop: 4 }}>
                  <CheckCircle2 size={15} /><span>Une clé API vocale est enregistrée pour ce salon.</span>
                </div>
              ) : (
                <div className="rp-alert" style={{ marginTop: 4 }}>
                  <AlertCircle size={15} /><span>Aucune clé enregistrée : l'agent utilise la clé BeautyBook.</span>
                </div>
              )}
              <div className="rp-field" style={{ marginTop: 10 }}>
                <label className="rp-label">{voiceKeySet ? 'Remplacer la clé' : 'Ajouter votre clé API vocale'}</label>
                <input type="password" className="rp-input" autoComplete="new-password"
                  placeholder="Collez votre clé API vocale"
                  value={voiceKeyDraft} onChange={(e) => setVoiceKeyDraft(e.target.value)} />
                <p className="rp-field-help">La clé n'est jamais réaffichée après enregistrement.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="rp-btn-primary" onClick={saveVoiceKey} disabled={savingKey || !voiceKeyDraft.trim()}>
                  {savingKey ? <Loader2 size={14} className="rp-spin" /> : <KeyRound size={14} />}{' '}
                  {savingKey ? 'Enregistrement…' : 'Enregistrer la clé'}
                </button>
                {voiceKeySet && (
                  <button className="rp-btn-ghost danger" onClick={removeVoiceKey}>Supprimer la clé</button>
                )}
                <button className="rp-btn-ghost" onClick={checkService} disabled={svcState === 'checking'}>
                  {svcState === 'checking' ? <Loader2 size={14} className="rp-spin" /> : <CheckCircle2 size={14} />}{' '}
                  Tester la connexion au service
                </button>
              </div>
              {keyMsg && (
                <div className={`rp-alert ${keyMsg.type === 'ok' ? 'ok' : 'error'}`} style={{ marginTop: 10 }}>
                  <span>{keyMsg.text}</span>
                </div>
              )}
              {svcState === 'ok' && (
                <div className="rp-alert ok" style={{ marginTop: 12 }}>
                  <CheckCircle2 size={15} /><span>Clé configurée : le service vocal répond.</span>
                </div>
              )}
              {svcState === 'error' && (
                <div className="rp-alert error" style={{ marginTop: 12 }}>
                  <AlertCircle size={15} /><span>{svcError}</span>
                </div>
              )}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <BookOpen size={15} className="rp-card-icon" />
                <h3>Base de connaissances de l'agent</h3>
              </div>
              <p className="rp-card-sub">
                Chaque salon a son propre agent. Les instructions et le message de bienvenue
                ci-dessous sont utilisés <strong>en français</strong>, avec vos prestations,
                offres packs, tarifs, horaires, adresse et téléphone relus <strong>en temps réel</strong> à
                chaque appel. Modifiez votre profil ou votre catalogue : l'agent suit
                automatiquement, sans reconfiguration.
              </p>

              <div className="rp-field">
                <label className="rp-label">Diagnostic d'accès aux données</label>
                <p className="rp-field-help">
                  Vérifie que l'agent vocal peut vraiment lire votre profil, vos horaires,
                  vos prestations, vos offres packs et votre planning (aucune donnée n'est modifiée).
                </p>
                <button className="rp-btn-ghost" onClick={runDiagnostics} disabled={diagLoading}>
                  <Activity size={13} /> {diagLoading ? 'Test en cours…' : "Tester l'accès aux données"}
                </button>
              </div>
              {diagResult && (
                <div className={`rp-alert ${diagResult.ok ? 'ok' : 'error'}`} style={{ marginTop: 10, display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {diagResult.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span><strong>{diagResult.ok ? "L'agent peut accéder à vos données." : "L'agent ne peut pas tout lire — voir ci-dessous."}</strong></span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Email du salon testé : {diagResult.email}</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                    Mode actuel : <strong>{connectionMode === 'agent' ? 'Agent distant' : 'Direct'}</strong>
                    {connectionMode === 'agent'
                      ? " — attention : l'agent configuré dans la console du service vocal n'a AUCUN accès à vos données BeautyBook (aucun outil). Passez en mode Direct pour la prise de RDV."
                      : " — l'agent utilise les instructions et les outils de l'application."}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                    {diagResult.checks.map((c, i) => (
                      <li key={i}>
                        <span style={{ marginRight: 6 }}>{c.ok ? '✅' : '❌'}</span>
                        <strong>{c.label}</strong> — {c.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rp-field">
                <label className="rp-label">Mode de connexion</label>
                <select className="rp-input" value={connectionMode} onChange={(e) => saveConnectionMode(e.target.value)}>
                  <option value="direct">Direct (recommandé) — français, instructions et outils de l'app</option>
                  <option value="agent">Agent distant — configuration de votre console vocale</option>
                </select>
                <p className="rp-field-help">
                  En mode Direct, l'agent parle français, vérifie les vrais créneaux,
                  crée les réservations dans votre Gestion agenda et raccroche si un
                  appelant insiste pour obtenir des données sensibles.
                </p>
              </div>

              <div className="rp-field">
                <label className="rp-label">Message de bienvenue</label>
                <textarea
                  className="rp-input rp-textarea"
                  rows={3}
                  value={welcomeDraft}
                  onChange={(e) => setWelcomeDraft(e.target.value)}
                  placeholder={resolveWelcomeMessage('', profil?.salon_name || salonName || 'votre salon')}
                />
                <p className="rp-field-help">
                  Vide = message par défaut avec le nom de votre salon. Écrivez {`{{salon_name}}`} pour insérer le nom automatiquement.
                </p>
              </div>
              <button className="rp-btn-ghost" onClick={saveWelcome}>
                <CheckCircle2 size={13} /> Enregistrer le message
              </button>

              <div className="rp-field" style={{ marginTop: 16 }}>
                <label className="rp-label">Instructions de l'agent</label>
                <textarea
                  className="rp-input rp-textarea mono"
                  rows={10}
                  value={instructionsDraft}
                  onChange={(e) => setInstructionsDraft(e.target.value)}
                  placeholder="Vide = instructions par défaut (réceptionniste de salon, en français). Écrivez vos propres règles ici pour les remplacer."
                />
                <p className="rp-field-help">
                  Vide = le modèle complet par défaut (prise de RDV, tarifs, sécurité…).
                  Vos données sensibles (clés API, mots de passe) ne sont <strong>jamais</strong> transmises à l'agent :
                  s'il les réclame, il avertit puis raccroche.
                </p>
              </div>
              <div className="rp-btn-row">
                <button className="rp-btn-ghost" onClick={saveInstructions}>
                  <CheckCircle2 size={13} /> Enregistrer
                </button>
                <button className="rp-btn-ghost" onClick={resetInstructions}>
                  <RefreshCw size={13} /> Réinitialiser
                </button>
                <button className="rp-btn-ghost" onClick={copyForXaiConsole}>
                  <ExternalLink size={13} /> Copier pour la console
                </button>
              </div>
              {kbSaved && (
                <div className="rp-alert ok" style={{ marginTop: 12 }}>
                  <CheckCircle2 size={15} /><span>Enregistré : sera utilisé dès le prochain appel.</span>
                </div>
              )}
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <Bot size={15} className="rp-card-icon" />
                <h3>Agent vocal de ce salon</h3>
              </div>
              <div className="rp-field">
                <label className="rp-label">Identifiant de l'agent (console vocale)</label>
                <input
                  type="text"
                  className="rp-input mono"
                  value={agentDraft}
                  onChange={(e) => setAgentDraft(e.target.value)}
                  placeholder="agent_…"
                  autoComplete="off"
                />
                <p className="rp-field-help">L'agent créé dans votre console vocale → Voice → Agents. Propre à ce salon.</p>
              </div>
              <button className="rp-btn-ghost" onClick={saveAgentId}>
                <CheckCircle2 size={13} /> Enregistrer l'agent
              </button>
              <div className="rp-field" style={{ marginTop: 14 }}>
                <label className="rp-label">Voix (utilisée en mode direct)</label>
                <select className="rp-input" value={voice} onChange={(e) => saveVoice(e.target.value)}>
                  {GROK_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rp-card">
              <div className="rp-card-title-row">
                <PhoneCall size={15} className="rp-card-icon" />
                <h3>Numéro de téléphone</h3>
              </div>
              <p className="rp-card-sub">
                Pour que Maria décroche vos vrais appels, attachez un numéro à votre agent
                depuis la console du service vocal (page de l'agent → onglet <strong>Deployment</strong>).
              </p>
              <button
                className="rp-btn-ghost full"
                onClick={() => window.open('https://console.x.ai/', '_blank')}
              >
                <ExternalLink size={13} /> Ouvrir la console vocale
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
