import SocialAuthButtons from '@/components/auth/SocialAuthButtons';
import { createAuthFlows, strongPassword } from "@/lib/authFlows";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, CheckCircle, Mail, Lock, ArrowRight } from "lucide-react";
import { authCallbackUrl, supabase } from "@/api/supabaseClient";
import { useRateLimit } from "@/hooks/useRateLimit";
import { savePassword, hasSavedPassword } from "@/lib/passwordVault";

const BRAND = "#E8732A";
const BRAND_LIGHT = "#FFF4ED";

function B({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="48" fill={BRAND}/>
      <path d="M35 28h14c8 0 14 5 14 12s-6 12-14 12H35V28z" fill="white" opacity="0.85"/>
      <path d="M35 52h15c8 0 14 5 14 12s-6 12-14 12H35V52z" fill="white"/>
      <circle cx="66" cy="32" r="5" fill="white" opacity="0.7"/>
    </svg>
  );
}

function ResetPassword({ onBack }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const pwdChecks = { length: newPassword.length >= 8, upper: /[A-Z]/.test(newPassword), number: /[0-9]/.test(newPassword), special: /[^A-Za-z0-9]/.test(newPassword) };
  const pwdScore = Object.values(pwdChecks).filter(Boolean).length;
  const pwdStrong = strongPassword(newPassword);
  const isValid = pwdStrong && newPassword === confirmPassword && newPassword.length > 0;

  const handleReset = async () => {
    if (!isValid || loading) return;
    setLoading(true); setError("");
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPassword }); if (e) throw e;
      // Si un mot de passe est enregistré sur cet appareil, le mettre à jour aussi
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && hasSavedPassword(user.id)) await savePassword(user.id, newPassword);
      } catch {}
      setSuccess(true);
    }
    catch { setError("Lien expiré ou invalide."); } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center mb-8"><CheckCircle className="w-8 h-8 text-green-500" /></div>
          <h2 className="text-[24px] font-extrabold text-gray-900 mb-2 tracking-tight">C'est fait !</h2>
          <p className="text-[13px] text-gray-500 mb-10">Mot de passe mis à jour.</p>
          <button aria-label="Retour" onClick={onBack} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition" style={{ background: BRAND }}>Se connecter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button aria-label="Retour" onClick={onBack} className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center active:scale-95 transition"><ArrowLeft className="w-[18px] h-[18px] text-gray-500" /></button>
        <span className="text-[15px] font-bold text-gray-800">Nouveau mot de passe</span>
      </div>

      <div className="flex-1 px-6 flex flex-col">
        <div className="text-center mt-8 mb-10">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-6" style={{ background: BRAND_LIGHT }}><Lock className="w-6 h-6" style={{ color: BRAND }} /></div>
          <h2 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2 tracking-tight">Nouveau<br />mot de passe</h2>
          <p className="text-[13px] text-gray-500">Sécurisez votre compte.</p>
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.18em] mb-2 block">Mot de passe</label>
            <div className="relative">
              <input className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 pr-11 text-[14px] font-medium text-gray-800 outline-none focus:border-orange-200 focus:bg-white transition placeholder:text-gray-400" type={showPwd ? "text" : "password"} placeholder="••••••••" aria-label="Nouveau mot de passe" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              <button aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowPwd(!showPwd)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-500 transition"><EyeIcon show={showPwd} /></button>
            </div>
            {newPassword.length > 0 && (
              <div className="mt-3">
                <div className="flex gap-1 mb-2">{[1,2,3,4].map(i => <div key={i} className="flex-1 h-[3px] rounded-full transition-all duration-300" style={{ background: i <= pwdScore ? (pwdScore <= 1 ? "#ef4444" : pwdScore === 2 ? "#f97316" : pwdScore === 3 ? "#eab308" : "#22c55e") : "#f3f4f6" }} />)}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {[{ c: pwdChecks.length, l: "8 car." },{ c: pwdChecks.upper, l: "Maj." },{ c: pwdChecks.number, l: "Chiffre" },{ c: pwdChecks.special, l: "Spécial" }].map(({ c, l }) => (
                    <span key={l} className={`text-[10px] font-bold ${c ? "text-green-500" : "text-gray-500"}`}>{c ? "✓" : "○"} {l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.18em] mb-2 block">Confirmer</label>
            <input className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 text-[14px] font-medium text-gray-800 outline-none focus:border-orange-200 focus:bg-white transition placeholder:text-gray-400" type={showPwd ? "text" : "password"} placeholder="••••••••" aria-label="Confirmer le mot de passe" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            {newPassword && confirmPassword && newPassword !== confirmPassword && <p className="text-[11px] text-red-400 mt-2">Ne correspondent pas</p>}
          </div>

          {error && <div role="alert" className="bg-red-50 border border-red-100 rounded-xl px-4 py-3"><p className="text-[12px] text-red-500 font-medium">{error}</p></div>}
        </div>

        <button onClick={handleReset} disabled={!isValid || loading} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white mb-8 active:scale-[0.97] transition-all" style={{ background: isValid && !loading ? BRAND : "#e5e7eb" }}>
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : "Confirmer"}
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ show }) { return show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />; }

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const { checkLimit } = useRateLimit({ maxAttempts: 3, windowMs: 300000 });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSend = async () => {
    if (!email || loading || cooldown > 0) return;
    if (!checkLimit()) { setError("Trop de tentatives."); return; }
    setLoading(true); setError("");
    try { const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/connexion` }); if (e) throw e; setSent(true); setCooldown(60); }
    catch { setError("Impossible d'envoyer."); } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center mb-8"><Mail className="w-8 h-8 text-green-500" /></div>
          <h2 className="text-[24px] font-extrabold text-gray-900 mb-2 tracking-tight">Email envoyé</h2>
          <p className="text-[13px] text-gray-500 mb-2">Lien envoyé à <span className="font-bold text-gray-700">{email}</span>.</p>
          <p className="text-[12px] text-gray-400 mb-10">Pensez à vérifier vos spams. Le lien expire après 1 heure.</p>
          <button onClick={handleSend} disabled={cooldown > 0 || loading} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white mb-3 active:scale-[0.97] transition-all" style={{ background: cooldown > 0 ? "#e5e7eb" : BRAND }}>
            {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le lien"}
          </button>
          <button aria-label="Retour" onClick={onBack} className="w-full text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">Retour</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button aria-label="Retour" onClick={onBack} className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center active:scale-95 transition"><ArrowLeft className="w-[18px] h-[18px] text-gray-500" /></button>
        <span className="text-[15px] font-bold text-gray-800">Mot de passe oublié</span>
      </div>

      <div className="flex-1 px-6 flex flex-col">
        <div className="text-center mt-8 mb-10">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-6" style={{ background: BRAND_LIGHT }}><Lock className="w-6 h-6" style={{ color: BRAND }} /></div>
          <h2 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2 tracking-tight">Récupérez<br />votre accès</h2>
          <p className="text-[13px] text-gray-500">On vous envoie un lien.</p>
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.18em] mb-2 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 text-[14px] font-medium text-gray-800 outline-none focus:border-orange-200 focus:bg-white transition placeholder:text-gray-400" aria-label="Email" autoComplete="email" type="email" placeholder="vous@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} />
            </div>
          </div>
          {error && <div role="alert" className="bg-red-50 border border-red-100 rounded-xl px-4 py-3"><p className="text-[12px] text-red-500 font-medium">{error}</p></div>}
        </div>

        <button onClick={handleSend} disabled={!email || loading} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white mb-8 active:scale-[0.97] transition-all" style={{ background: email && !loading ? BRAND : "#e5e7eb" }}>
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : "Envoyer"}
        </button>
      </div>
    </div>
  );
}

export default function Connexion() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [savePwdDevice, setSavePwdDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resending, setResending] = useState(false);
  const { checkLimit } = useRateLimit({ maxAttempts: 5, windowMs: 300000 });

  useEffect(() => { const r = localStorage.getItem("bb_remember_email"); if (r) { setEmail(r); setRemember(true); } }, []);

  const [isResetMode, setIsResetMode] = useState(() => {
    if (window.location.hash.includes('type=recovery')) return true;
    const q = new URLSearchParams(window.location.search);
    return q.get('type') === 'recovery' && (q.get('token_hash') || q.get('code'));
  });
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setIsResetMode(true); });
    // Les emails Supabase récents utilisent ?token_hash=...&type=recovery, format que le SDK
    // ne traite pas automatiquement : on le vérifie explicitement ici.
    try {
      const q = new URLSearchParams(window.location.search);
      const tokenHash = q.get('token_hash');
      if (q.get('type') === 'recovery' && tokenHash) {
        setVerifyingLink(true);
        supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error }) => {
          const url = new URL(window.location.href);
          url.searchParams.delete('token_hash'); url.searchParams.delete('type');
          window.history.replaceState(window.history.state, '', url.toString());
          if (error) setLinkError("Ce lien est expiré ou a déjà été utilisé. Demandez un nouveau lien ci-dessous.");
          else setIsResetMode(true);
        }).catch(() => setLinkError("Ce lien est invalide. Demandez un nouveau lien ci-dessous."))
          .finally(() => setVerifyingLink(false));
      }
    } catch { /* URL illisible : on ignore */ }
    return () => subscription.unsubscribe();
  }, []);

  if (verifyingLink) {
    return (
      <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col items-center justify-center px-6">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-[#E8732A] rounded-full animate-spin mb-4" />
        <p className="text-gray-600 text-sm font-medium">Vérification de votre lien…</p>
      </div>
    );
  }
  if (linkError) {
    return (
      <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-8"><Lock className="w-8 h-8 text-red-400" /></div>
          <h2 className="text-[24px] font-extrabold text-gray-900 mb-2 tracking-tight">Lien invalide</h2>
          <p className="text-[13px] text-gray-500 mb-10">{linkError}</p>
          <button onClick={() => { setLinkError(''); setShowForgot(true); }} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition" style={{ background: BRAND }}>Demander un nouveau lien</button>
        </div>
      </div>
    );
  }
  if (isResetMode) return <ResetPassword onBack={() => { setIsResetMode(false); navigate('/connexion', { replace: true }); }} />;
  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true); setError(""); setEmailNotConfirmed(false);
    if (!email.trim() || !password) { setError("Email et mot de passe requis."); setLoading(false); return; }
    if (!checkLimit()) { setError("Trop de tentatives. Réessayez dans quelques minutes."); setLoading(false); return; }
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e) {
        if (e.code === 'email_not_confirmed') { setEmailNotConfirmed(true); setError("Email non confirmé."); }
        else setError(e.code === 'user_banned' ? "Ce compte est suspendu. Contactez l’assistance." : "Identifiants invalides ou connexion indisponible.");
        return;
      }
      if (!data?.user) throw new Error('Session indisponible.');
      await createAuthFlows(supabase).ensureProfile(data.user);
      localStorage.setItem("bb_onboarded", "1");
      if (remember) { localStorage.setItem("bb_remember_email", email.trim()); localStorage.setItem("bb_remember", "1"); }
      else { localStorage.removeItem("bb_remember_email"); localStorage.removeItem("bb_remember"); }
      // Coffre chiffré : enregistre le mot de passe sur cet appareil si l'utilisateur l'a demandé
      if (savePwdDevice) {
        try { await savePassword(data.user.id, password); } catch {}
      }
      navigate("/", { replace: true });
    } catch (error) { setError(error.message || "Erreur de connexion."); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!email || resending) return; setResending(true);
     try { const { error } = await supabase.auth.resend({ email, type: "signup", options: { emailRedirectTo: authCallbackUrl } }); if (error) throw error; setError("Email renvoyé."); setEmailNotConfirmed(false); } catch { setError("Le message n’a pas pu être envoyé."); }
    setResending(false);
  };

  return (
    <div className="min-h-screen w-full max-w-[680px] mx-auto bg-white flex flex-col">
      <div className="px-[27px] pt-[43px] pb-4">
        <div className="flex items-center gap-4 mb-[108px]">
          <B size={60} />
          <span className="text-[#617089] text-[16px] font-extrabold uppercase tracking-[0.3em]">BeautyBook</span>
        </div>
      </div>

      <div className="flex-1 px-[27px] flex flex-col">
        <h2 className="text-[32px] sm:text-[36px] font-extrabold text-[#071936] leading-[1.12] mb-1 tracking-tight">Bon retour<br />parmi nous</h2>
        <p className="text-[16px] sm:text-[17px] text-[#617089] mb-7">Connectez-vous pour accéder à votre espace.</p>

        <div className="space-y-5 flex-1">
          <div>
            <label className="text-[14px] font-extrabold text-[#617089] uppercase tracking-[0.22em] mb-3 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-[23px] h-[23px] text-[#6d788b]" />
              <input className="w-full h-14 sm:h-[64px] bg-[#f8f9fa] border border-[#edf0f3] rounded-2xl pl-12 pr-4 text-[16px] sm:text-[17px] font-medium text-[#14213d] outline-none focus:border-orange-300 focus:bg-white transition placeholder:text-[#9aa6b8]" aria-label="Email" autoComplete="email" type="email" placeholder="vous@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-[14px] font-extrabold text-[#617089] uppercase tracking-[0.22em] mb-3 block">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[23px] h-[23px] text-[#6d788b]" />
              <input className="w-full h-14 sm:h-[64px] bg-[#f8f9fa] border border-[#edf0f3] rounded-2xl pl-12 pr-12 text-[16px] sm:text-[17px] font-medium text-[#14213d] outline-none focus:border-orange-300 focus:bg-white transition placeholder:text-[#9aa6b8]" type={showPwd ? "text" : "password"} placeholder="••••••••" aria-label="Mot de passe" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button type="button" aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowPwd(!showPwd)} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#6d788b] hover:text-[#6d788b] transition"><EyeIcon show={showPwd} /></button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <button role="checkbox" aria-checked={remember} onClick={() => setRemember(!remember)} className="flex items-center gap-2.5 active:scale-95 transition">
              <div className={`w-[27px] h-[27px] rounded-full border-2 flex items-center justify-center transition-all ${remember ? "border-[#E8732A] bg-[#E8732A]" : "border-[#e0e4e9] bg-white"}`}>
                {remember && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
               <span className="text-[14px] sm:text-[15px] font-semibold text-[#617089]">Mémoriser mon email</span>
            </button>
             <button onClick={() => setShowForgot(true)} className="text-[14px] sm:text-[15px] font-bold" style={{ color: BRAND }}>Mot de passe oublié ?</button>
          </div>
          <button role="checkbox" aria-checked={savePwdDevice} onClick={() => setSavePwdDevice(!savePwdDevice)} className="flex items-center gap-2.5 active:scale-95 transition pt-1">
            <div className={`w-[27px] h-[27px] rounded-full border-2 flex items-center justify-center transition-all ${savePwdDevice ? "border-[#E8732A] bg-[#E8732A]" : "border-[#e0e4e9] bg-white"}`}>
              {savePwdDevice && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-[14px] sm:text-[15px] font-semibold text-[#617089]">Enregistrer le mot de passe sur cet appareil <span className="text-gray-400 font-normal">(chiffré)</span></span>
          </button>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[12px] text-red-500 font-medium">{error}</p>
              {emailNotConfirmed && <button onClick={handleResend} disabled={resending} className="text-[12px] font-bold underline" style={{ color: BRAND }}>{resending ? "Envoi..." : "Renvoyer"}</button>}
            </div>
          )}
        </div>

        <div className="pt-10 pb-8 space-y-5">
          <button onClick={handleLogin} disabled={loading} className="w-full h-14 sm:h-[64px] rounded-2xl font-extrabold text-[16px] uppercase tracking-[0.12em] text-white active:scale-[0.98] transition-all flex items-center justify-center gap-3" style={{ background: BRAND }}>
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Se connecter</span><ArrowRight className="w-4 h-4" /></>}
          </button>
          <SocialAuthButtons disabled={loading} />
            <p className="text-center text-[14px] sm:text-[15px] text-[#617089]">
            Pas encore de compte ? <button onClick={() => { sessionStorage.removeItem("bb_signup_data"); sessionStorage.setItem("bb_from_login", "1"); navigate("/onboarding"); }} className="font-bold" style={{ color: BRAND }}>Créer un compte</button>
          </p>
        </div>
      </div>
    </div>
  );
}
