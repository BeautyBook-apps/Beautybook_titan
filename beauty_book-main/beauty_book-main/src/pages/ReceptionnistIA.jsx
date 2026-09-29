import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PhoneCall, Mic, MicOff, PhoneOff, BookOpen, Settings,
  Bot, CheckCircle2, AlertCircle, RefreshCw, Loader2, Sparkles,
  Scissors, KeyRound, ExternalLink, Volume2, MessageCircle, Power,
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { entities } from '@/api/entities';
import { useTheme } from '@/hooks/useTheme';
import { GrokVoiceSession } from '@/lib/grokVoice';
import { mintVoiceToken, DEFAULT_AGENT_ID } from '@/lib/grok';
import { getSalonAISettings, saveSalonAISettings } from '@/lib/salonAI';
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

function buildInstructions(salonName, services) {
  const lines = (services || []).slice(0, 40).map(
    (s) => `- ${s.title || s.name || 'Prestation'} : ${fmtPrice(s)}, durée ${fmtDur(s)}`
  );
  return [
    `Tu es Maria, la réceptionniste vocale du salon de beauté « ${salonName || 'BeautyBook'} ».`,
    'Tu réponds toujours en français, avec un ton chaleureux et professionnel.',
    'Tu accueilles les appelants, présentes les prestations, donnes les tarifs et les durées,',
    "et proposes de les aider à réserver via l'application BeautyBook.",
    'Prestations du salon (noms, tarifs et durées réels — ne jamais en inventer d\'autres) :',
    ...lines,
    "Si on te demande quelque chose hors de ton rôle, redirige poliment vers le salon.",
    'Tes réponses restent courtes et adaptées à une conversation téléphonique.',
  ].join('\n');
}

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
  const [proEmail, setProEmail] = useState('');
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Réglages IA du salon (agent vocal + chatbot propres à chaque salon)
  const [vocalEnabled, setVocalEnabled] = useState(true);
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [aiReady, setAiReady] = useState(false);

  // Configuration Grok du salon
  const [agentId, setAgentId] = useState(DEFAULT_AGENT_ID);
  const [agentDraft, setAgentDraft] = useState(DEFAULT_AGENT_ID);
  const [voice, setVoice] = useState('ara');

  // État du service (test réel du endpoint de token)
  const [svcState, setSvcState] = useState('unknown'); // unknown | checking | ok | error
  const [svcError, setSvcError] = useState('');

  // Session voix en direct
  const [voiceState, setVoiceState] = useState('idle'); // idle | connecting | live | error
  const [voiceError, setVoiceError] = useState('');
  const [speaking, setSpeaking] = useState(null); // 'user' | 'agent' | null
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [mode, setMode] = useState(null); // 'agent' | 'direct'
  const [transcript, setTranscript] = useState([]); // [{who, text, done}]
  const sessionRef = useRef(null);
  const transcriptEndRef = useRef(null);

  // ─── Test réel du service vocal (mint d'un token éphémère) ───────────────
  const checkService = useCallback(async () => {
    setSvcState('checking');
    setSvcError('');
    try {
      await mintVoiceToken();
      setSvcState('ok');
    } catch (e) {
      setSvcState('error');
      setSvcError(e.message);
    }
  }, []);

  // ─── Chargement initial : pro + réglages IA du salon + vrais services ────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const email = authData?.user?.email || '';
        if (alive) setProEmail(email);
        // Réglages IA propres à ce salon (agent vocal + chatbot + agent_id + voix)
        const ai = await getSalonAISettings(email);
        if (!alive) return;
        setVocalEnabled(ai.vocal_enabled !== false);
        setChatbotEnabled(ai.chatbot_enabled !== false);
        setAgentId(ai.agent_id || DEFAULT_AGENT_ID);
        setAgentDraft(ai.agent_id || DEFAULT_AGENT_ID);
        setVoice(ai.voice || 'ara');
        setAiReady(true);
        if (email) {
          const profiles = await entities.ProfilPro.filter({ user_email: email }, '-created_at', 1).catch(() => []);
          if (!alive) return;
          if (profiles.length > 0 && profiles[0].salon_name) setSalonName(profiles[0].salon_name);
          const { data: svcs } = await supabase
            .from('Service')
            .select('id,title,name,price,duration,duration_min')
            .eq('pro_email', email)
            .order('created_at', { ascending: false })
            .limit(100);
          if (alive) setServices(svcs || []);
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

  const toggleChatbot = useCallback(async (on) => {
    setChatbotEnabled(on);
    if (proEmail) await saveSalonAISettings(proEmail, { chatbot_enabled: on });
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
      } else if (p.state === 'error') {
        setVoiceState('error');
      }
    } else if (type === 'error') {
      setVoiceError(p.message || 'Erreur de session vocale.');
      setVoiceState((s) => (s === 'live' ? s : 'error'));
    } else if (type === 'mic-level') {
      setMicLevel(p.level || 0);
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
      const { token } = await mintVoiceToken();
      const session = new GrokVoiceSession({
        token,
        agentId,
        voice,
        language: 'fr',
        instructions: buildInstructions(salonName, services),
        onEvent: handleVoiceEvent,
      });
      sessionRef.current = session;
      await session.connect();
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

  const serviceReady = svcState === 'ok';
  const inCall = voiceState === 'live' || voiceState === 'connecting';
  const badgeLabel = !vocalEnabled ? 'DÉSACTIVÉ' : serviceReady ? 'GROK PRÊT' : 'À CONFIGURER';
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
          <div className="rp-master-row">
            <div className="rp-master-info">
              <div className="rp-master-ico"><MessageCircle size={16} /></div>
              <div>
                <strong>Chatbot IA</strong>
                <span>« Discuter avec Maria » sur votre page salon</span>
              </div>
            </div>
            <Toggle checked={chatbotEnabled} onChange={toggleChatbot} label="Activer ou désactiver le chatbot IA" />
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
              <span className="rp-hero-badge"><Sparkles size={10} /> Agent vocal Grok — conversation en direct</span>
              <h2>Maria — Votre Réceptionniste Vocale</h2>
              <p>
                Parlez directement à votre agent vocal Grok depuis cette page :
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
                <h3>État de l'agent Grok</h3>
                <button className="rp-btn-ghost-sm" onClick={checkService} disabled={svcState === 'checking'}>
                  <RefreshCw size={12} className={svcState === 'checking' ? 'rp-spin' : ''} /> Vérifier
                </button>
              </div>
              {svcState === 'unknown' && (
                <div className="rp-info-box">
                  <AlertCircle size={15} />
                  <span>Vérification de la connexion au service vocal Grok…</span>
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
                  <p>Connexion à l'agent Grok…</p>
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
                      {mode === 'agent' ? 'Agent Grok connecté' : 'Mode direct Grok'}
                      {' · '}
                      {speaking === 'agent' ? 'Maria parle…' : speaking === 'user' ? 'Vous parlez…' : muted ? 'Micro coupé' : 'À vous…'}
                    </p>
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
                La connexion utilise un <strong>token éphémère de 5 minutes</strong> : votre clé API xAI
                reste sur le serveur et n'est jamais exposée dans l'application.
                Chaque salon possède son propre agent et ses propres réglages.
                Pour recevoir de vrais appels téléphoniques, attachez un numéro à votre agent
                depuis la console xAI (page de l'agent → onglet Deployment).
              </p>
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
                <h3>Personnalité de l'agent</h3>
              </div>
              <p className="rp-card-sub">
                Le ton, les instructions et la voix de l'agent se règlent dans la
                <strong> console xAI</strong> (votre agent <span className="mono">{agentId}</span>).
                Si l'agent configuré est injoignable, l'application bascule automatiquement
                en mode direct : Maria utilise alors les prestations ci-dessus et la voix « {voice} ».
              </p>
            </div>
          </div>
        )}

        {/* ══════════ ONGLET : CONFIGURATION ══════════ */}
        {tab === 'config' && (
          <div className="space-y-4">
            <div className="rp-card">
              <div className="rp-card-title-row">
                <KeyRound size={15} className="rp-card-icon" />
                <h3>Clé API xAI</h3>
              </div>
              <p className="rp-card-sub">
                Le service vocal et le chatbot utilisent votre clé xAI <strong>côté serveur uniquement</strong>.
                Ajoutez-la dans Vercel, puis redéployez :
              </p>
              <ol className="rp-steps">
                <li>Ouvrez le dashboard Vercel du projet <span className="mono">thelastjiren</span></li>
                <li><strong>Settings → Environment Variables</strong> → ajoutez <span className="mono">XAI_API_KEY</span></li>
                <li>Collez votre clé (console.x.ai → API Keys), environnement <strong>Production</strong></li>
                <li><strong>Deployments → Redéployer</strong> le dernier déploiement</li>
              </ol>
              <button className="rp-btn-primary" onClick={checkService} disabled={svcState === 'checking'}>
                {svcState === 'checking' ? <Loader2 size={14} className="rp-spin" /> : <CheckCircle2 size={14} />}
                {' '}Tester la connexion au service
              </button>
              {svcState === 'ok' && (
                <div className="rp-alert ok" style={{ marginTop: 12 }}>
                  <CheckCircle2 size={15} /><span>Clé configurée : le service vocal et le chatbot répondent.</span>
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
                <Bot size={15} className="rp-card-icon" />
                <h3>Agent vocal de ce salon</h3>
              </div>
              <div className="rp-field">
                <label className="rp-label">Identifiant de l'agent (console xAI)</label>
                <input
                  type="text"
                  className="rp-input mono"
                  value={agentDraft}
                  onChange={(e) => setAgentDraft(e.target.value)}
                  placeholder="agent_…"
                  autoComplete="off"
                />
                <p className="rp-field-help">L'agent créé dans console.x.ai → Voice → Agents. Propre à ce salon.</p>
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
                depuis la console xAI (page de l'agent → onglet <strong>Deployment</strong>).
              </p>
              <button
                className="rp-btn-ghost full"
                onClick={() => window.open('https://console.x.ai/', '_blank')}
              >
                <ExternalLink size={13} /> Ouvrir la console xAI
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
