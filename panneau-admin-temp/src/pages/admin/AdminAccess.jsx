import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, MailCheck, LoaderCircle } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import apiClient from '@/lib/apiClient';
import { authMessage, createAccount, confirmAccount, resendConfirmation, pendingEmail, savePendingEmail } from '../../../../shared/auth/accountAccess.mjs';

const PENDING = 'bb-admin-confirmation';
const inputClass = 'mt-2 w-full rounded-xl border border-gray-700 bg-gray-900 p-3 text-base outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30';
const buttonClass = 'flex w-full min-h-12 items-center justify-between gap-3 rounded-xl bg-orange-600 p-4 font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400';
const titles = { login: 'Votre console de pilotage', signup: 'Créez votre compte.', verify: 'Confirmez votre email.', reset: 'Retrouvez votre accès.', password: 'Un nouveau mot de passe.', access: 'Votre compte est connecté.', enroll: 'Protégez votre compte.', mfa: 'Vérification de sécurité' };

export default function AdminAccess() {
  const navigate = useNavigate();
  const savedEmail = pendingEmail(sessionStorage, PENDING);
  const [phase, setPhase] = useState(() => location.pathname.endsWith('/signup') ? 'signup' : location.pathname.endsWith('/verify') && savedEmail ? 'verify' : 'login');
  const [email, setEmail] = useState(savedEmail), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [googleLoading, setGoogleLoading] = useState(false);
  const [code, setCode] = useState(''), [cooldown, setCooldown] = useState(0), [factorId, setFactorId] = useState(''), [qr, setQr] = useState('');
  const alive = useRef(true);
  const redirectTo = `${window.location.origin}/admin/login?auth=confirmed`;
  async function signInWithGoogle() {
    if (!supabase || googleLoading) return;
    setGoogleLoading(true); setError(''); setNotice('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/admin/login` }
      });
      if (error) throw error;
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }
  async function checkAccess() {
    try { await apiClient.get('/api/admin/session'); if (alive.current) navigate('/admin/dashboard', { replace: true }); }
    catch (err) {
      if (!alive.current) return;
      if (err.code === 'MFA_REQUIRED') {
        const { data, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;
        const factor = data.totp?.find(f => f.status === 'verified');
        if (factor) { setFactorId(factor.id); setPhase('mfa'); } else setPhase('enroll');
        return;
      }
      setPhase('access');
      throw new Error(err.code === 'ADMIN_FORBIDDEN' ? 'Une habilitation administrateur est nécessaire pour accéder à la console. Demandez-la au responsable BeautyBook.' : ['ADMIN_CONFIGURATION_REQUIRED', 'DATABASE_NOT_CONFIGURED', 'BACKEND_NOT_CONFIGURED'].includes(err.code) ? 'La configuration du service d’administration doit être terminée par le responsable BeautyBook.' : err.message || 'Le service d’administration est indisponible. Réessayez.');
    }
  }
  useEffect(() => {
    alive.current = true;
    const hash = new URLSearchParams(location.hash.slice(1)), query = new URLSearchParams(location.search);
    if (hash.has('error') || query.has('error')) setError('Ce lien a expiré ou a déjà été utilisé. Demandez un nouvel email.');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { setPhase('password'); setError(''); }
    });
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!alive.current) return;
      if (error) throw error;
      if (data.session && !data.session.user?.is_anonymous && !hash.has('error') && !query.has('error')) {
        if (data.session.user?.email_confirmed_at) sessionStorage.removeItem(PENDING);
        if (query.get('auth') === 'recovery') setPhase('password');
        else if (!location.pathname.endsWith('/signup')) { setLoading(true); await checkAccess(); }
      }
    }).catch(err => { if (alive.current) setError(authMessage(err)); }).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(n => n - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  function changePhase(next) {
    setPhase(next); setError(''); setNotice(''); setCode(''); setPassword(''); setConfirmation('');
    navigate(next === 'signup' ? '/admin/signup' : next === 'verify' ? '/admin/verify' : '/admin/login', { replace: true });
  }
  function showConfirmation() { savePendingEmail(sessionStorage, PENDING, email); changePhase('verify'); setCooldown(60); }
  async function submit(event) {
    event.preventDefault(); if (loading) return; setLoading(true); setError(''); setNotice('');
    try {
      if (phase === 'signup') {
        if (password !== confirmation) throw new Error('Les mots de passe ne correspondent pas.');
        const result = await createAccount(supabase, { email, password, redirectTo });
        if (result.status === 'existing') { changePhase('login'); setNotice('Si vous possédez déjà un compte, connectez-vous ou utilisez « Mot de passe oublié ».'); }
        else if (result.status === 'authenticated') await checkAccess(); else showConfirmation();
      } else if (phase === 'verify') {
        await confirmAccount(supabase, email, code); sessionStorage.removeItem(PENDING); await checkAccess();
      } else if (phase === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error?.code === 'email_not_confirmed') { showConfirmation(); setNotice('Confirmez votre email. Vous pouvez demander un nouvel email ci-dessous.'); setCooldown(0); }
        else { if (error) throw error; sessionStorage.removeItem(PENDING); await checkAccess(); }
      } else if (phase === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin/login?auth=recovery` });
        if (error) throw error;
        setNotice('Si cette adresse correspond à un compte, vous recevrez un lien pour choisir un nouveau mot de passe.');
      } else if (phase === 'password') {
        if (password !== confirmation) throw new Error('Les mots de passe ne correspondent pas.');
        const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
        setPassword(''); setConfirmation(''); navigate('/admin/login', { replace: true }); await checkAccess();
      } else if (phase === 'access') await checkAccess();
      else {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (error) throw new Error('Code de vérification incorrect ou expiré.');
        await checkAccess();
      }
    } catch (err) { setError(authMessage(err)); } finally { setLoading(false); }
  }
  async function resend() {
    setLoading(true); setError(''); setNotice('');
    try { await resendConfirmation(supabase, email, redirectTo); setCooldown(60); setNotice('Un nouvel email a été demandé. Consultez aussi vos courriers indésirables.'); }
    catch (err) { setError(authMessage(err)); } finally { setLoading(false); }
  }
  async function enroll() {
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'BeautyBook Administration' });
      if (error) throw error; setFactorId(data.id); setQr(data.totp.qr_code); setPhase('mfa');
    } catch (err) { setError(authMessage(err)); } finally { setLoading(false); }
  }
  async function disconnect() {
    setLoading(true); setError('');
    try { const { error } = await supabase.auth.signOut(); if (error) throw error; changePhase('login'); }
    catch (err) { setError(authMessage(err)); } finally { setLoading(false); }
  }
  const descriptions = { login: 'Connectez-vous avec votre compte BeautyBook.', signup: 'Utilisez votre adresse email. L’accès à la console sera accordé par un administrateur habilité.', verify: `Saisissez le code envoyé à ${email}. Si l’email contient un lien, ouvrez-le pour confirmer votre compte.`, reset: 'Recevez un lien de récupération par email.', password: 'Choisissez au moins 12 caractères.', access: 'L’accès à la console dépend de vos habilitations.', enroll: 'Utilisez une application d’authentification pour sécuriser la console.', mfa: 'Saisissez le code de votre application d’authentification.' };
  return <main className="min-h-dvh bg-gray-950 text-white grid place-items-center px-6 py-12"><section className="w-full max-w-md">
    <div className="mb-8">{phase === 'verify' ? <MailCheck className="h-10 w-10 text-orange-400 mb-5" /> : <ShieldCheck className="h-10 w-10 text-orange-400 mb-5" />}<p className="text-xs uppercase tracking-widest text-orange-400">BeautyBook / Administration</p><h1 className="mt-3 text-3xl font-bold">{titles[phase]}</h1><p className="mt-3 text-base leading-relaxed text-gray-300 break-words">{descriptions[phase]}</p></div>
    {error && <p role="alert" className="my-4 rounded-xl border border-red-800 bg-red-950 p-3 text-sm">{error}</p>}{notice && <p role="status" className="my-4 rounded-xl border border-emerald-800 bg-emerald-950 p-3 text-sm">{notice}</p>}
    {phase === 'enroll' ? <button disabled={loading} onClick={enroll} className={buttonClass}>Activer la double authentification<ShieldCheck size={20} /></button> : <form onSubmit={submit} className="space-y-5">
      {['login', 'signup', 'reset'].includes(phase) && <label className="block text-sm">Adresse email<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></label>}
      {['login', 'signup', 'password'].includes(phase) && <label className="block text-sm">Mot de passe<input autoComplete={phase === 'login' ? 'current-password' : 'new-password'} type="password" minLength={phase === 'login' ? undefined : 12} required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />{phase !== 'login' && <small className="block mt-2 text-gray-400">12 caractères minimum.</small>}</label>}
      {['signup', 'password'].includes(phase) && <label className="block text-sm">Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} /></label>}
      {['verify', 'mfa'].includes(phase) && <>{qr && phase === 'mfa' && <img src={qr.startsWith('data:') ? qr : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr)} alt="Code QR à scanner dans votre application d’authentification" className="w-48 h-48 bg-white p-3 rounded-xl" />}<label className="block text-sm">{phase === 'verify' ? 'Code reçu par email' : 'Code de sécurité'}<input autoComplete="one-time-code" inputMode="numeric" pattern={phase === 'verify' ? '[0-9]{6,10}' : '[0-9]{6}'} maxLength={phase === 'verify' ? 10 : 6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={`${inputClass} text-2xl tracking-widest`} /></label></>}
      <button disabled={loading} className={buttonClass}>{loading ? 'Un instant…' : ({ login: 'Se connecter', signup: 'Créer mon compte', verify: 'Confirmer et continuer', reset: 'Envoyer le lien', password: 'Enregistrer', access: 'Vérifier mon accès', mfa: 'Valider le code' })[phase]}{loading ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} />}</button>
    </form>}
    {['login', 'signup', 'reset'].includes(phase) && (
      <button type="button" disabled={googleLoading || loading} onClick={signInWithGoogle} className="mt-4 flex w-full min-h-12 items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-900 p-4 font-bold text-white disabled:opacity-50">
        {googleLoading ? 'Connexion Google…' : 'Continuer avec Google'}
        <ArrowRight size={18} />
      </button>
    )}
    <div className="mt-6 flex flex-col gap-2 text-sm text-gray-300">
      {phase === 'verify' && <><button disabled={loading || cooldown > 0} onClick={resend} className="min-h-11 text-orange-300 disabled:opacity-50">{cooldown ? `Renvoyer dans ${cooldown} s` : 'Renvoyer l’email de confirmation'}</button><button disabled={loading} onClick={() => { sessionStorage.removeItem(PENDING); changePhase('signup'); }} className="min-h-11">Corriger mon adresse email</button></>}
      {phase === 'login' && <><button disabled={loading} onClick={() => changePhase('signup')} className="min-h-11 text-orange-300">Créer un compte</button><button disabled={loading} onClick={() => changePhase('reset')} className="min-h-11">Mot de passe oublié ?</button></>}
      {['signup', 'verify', 'reset'].includes(phase) && <button disabled={loading} onClick={() => changePhase('login')} className="min-h-11">Revenir à la connexion</button>}
      {['access', 'mfa', 'enroll', 'password'].includes(phase) && <button disabled={loading} onClick={disconnect} className="min-h-11">Se déconnecter</button>}
    </div>
  </section></main>;
}
