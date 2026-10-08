import SocialAuthButtons from '@/components/auth/SocialAuthButtons';
import BeautyImage from '@/components/ui/BeautyImage';
import BrandLogo from '@/components/ui/BrandLogo';
import { createAuthFlows, readSignupDraft, saveSignupDraft, strongPassword } from "@/lib/authFlows";
import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Camera, RotateCcw, Check, ArrowLeft, ArrowRight, User, Mail, Lock, Sparkles } from "lucide-react";
import { uploadFile } from '@/api/entities';
import { authCallbackUrl, supabase } from '@/api/supabaseClient';
import { useRateLimit } from '@/hooks/useRateLimit';

const authFlows = createAuthFlows(supabase);
const BRAND = "#E8732A";
const BRAND_LIGHT = "#FFF4ED";
const INTERESTS = ["COIFFURE", "MAQUILLAGE", "SOINS", "ONGLES", "MASSAGE", "BARBIER", "ÉPILATION"];

function ProgressBar({ step, total }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-[3px] rounded-full transition-all duration-500" style={{ background: i < step ? BRAND : "#f3f4f6" }} />
      ))}
    </div>
  );
}

function StepLabel({ step, total }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND }} />
      <span className="text-[10px] font-extrabold uppercase tracking-[0.25em]" style={{ color: BRAND }}>Étape {step}/{total}</span>
    </div>
  );
}

const EyeIcon = ({ show }) => show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />;

function StepSplash({ onNext }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 3000;
    const interval = 30;
    const step = (interval / duration) * 100;
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= 100) {
        setProgress(100);
        clearInterval(timer);
        setTimeout(() => onNext(), 200);
      } else {
        setProgress(current);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [onNext]);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative">
      <div className="absolute inset-0">
        <BeautyImage
          src="/splash_bg.jpg?v=20261008"
          alt="Beauty communities"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-16 pb-10">
        <div className="flex flex-col items-center gap-3 mb-12">
          <BrandLogo size={52} alt="Logo BeautyBook" />
          <span className="text-white/80 text-[13px] font-extrabold uppercase tracking-[0.35em]">BeautyBook</span>
        </div>

        <div className="flex-1" />

        <div className="mb-10">
          <h1 className="text-[48px] font-black leading-[0.92] text-white uppercase tracking-tight mb-4">
            REVEAL<br />YOUR<br />
            <span style={{ color: BRAND }}>BEAUTY.</span>
          </h1>
          <p className="text-[14px] text-white/50 leading-relaxed max-w-[260px]">Rejoignez la première communauté dédiée à l'excellence esthétique.</p>
        </div>

        <div className="space-y-3">
          <div className="h-[3px] w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-[30ms] ease-linear"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${BRAND}, #F59E0B)` }}
            />
          </div>
          <p className="text-center text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">
            {progress < 100 ? "Chargement..." : "Bienvenue !"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepSignup({ onNext, onBack }) {
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", password: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const { checkLimit } = useRateLimit({ maxAttempts: 5, windowMs: 300000 });

  const pwdChecks = { length: form.password.length >= 8, upper: /[A-Z]/.test(form.password), number: /[0-9]/.test(form.password), special: /[^A-Za-z0-9]/.test(form.password) };
  const pwdScore = Object.values(pwdChecks).filter(Boolean).length;
  const pwdStrong = strongPassword(form.password);
  const isValid = form.prenom && form.nom && form.email && pwdStrong && form.password === form.confirm && consentChecked;

  const handleSubmit = async () => {
    setTouched(true); if (!isValid || submitting) return;
    if (!checkLimit()) { setError("Trop de tentatives. Réessayez dans quelques minutes."); return; }
    setSubmitting(true); setError("");
    try {
       const result = await authFlows.signup(form, sessionStorage, authCallbackUrl);
      onNext(result.verified);
    } catch (error) { setError(error.message || "Inscription impossible. Réessayez."); }
    finally { setSubmitting(false); }
  };

   const inp = "w-full h-14 sm:h-[64px] bg-[#f8f9fa] border border-[#edf0f3] rounded-2xl px-4 text-[16px] sm:text-[17px] font-medium text-[#14213d] outline-none focus:border-orange-300 focus:bg-white transition placeholder:text-[#9aa6b8]";
   const lbl = "text-[12px] sm:text-[13px] font-extrabold text-[#617089] uppercase tracking-[0.2em] mb-2 block";

  return (
    <div className="min-h-screen w-full max-w-[680px] mx-auto bg-white flex flex-col">
      <div className="relative z-10 px-[27px] pt-1 pb-8 flex flex-col flex-1">
        <h2 className="text-[32px] sm:text-[36px] font-extrabold text-[#071936] leading-[1.12] mb-1 tracking-tight">Faisons<br />connaissance</h2>
        <p className="text-[16px] sm:text-[17px] text-[#617089] mb-7">Parlez-nous un peu de vous.</p>

        <div className="space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-[18px]">
            <div><label className={lbl}>Prénom</label><div className="relative"><User className="absolute left-5 top-1/2 -translate-y-1/2 w-[23px] h-[23px] text-[#6d788b]" /><input className={inp + " pl-[55px]"} aria-label="Prénom" autoComplete="given-name" placeholder="Sophie" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} /></div></div>
            <div><label className={lbl}>Nom</label><input className={inp} aria-label="Nom" autoComplete="family-name" placeholder="Martin" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} /></div>
          </div>

          <div><label className={lbl}>Email</label><div className="relative"><Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-[23px] h-[23px] text-[#6d788b]" /><input className={inp + " pl-[55px]"} aria-label="Email" autoComplete="email" type="email" placeholder="vous@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div></div>

          <div>
            <label className={lbl}>Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[23px] h-[23px] text-[#6d788b]" />
              <input className={inp + " pl-9 pr-10"} type={showPwd ? "text" : "password"} placeholder="••••••••" aria-label="Mot de passe" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <button type="button" aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowPwd(!showPwd)} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#6d788b] hover:text-[#6d788b] transition"><EyeIcon show={showPwd} /></button>
            </div>
            {form.password.length > 0 && (
              <div className="mt-2.5">
                <div className="flex gap-1 mb-1.5">{[1,2,3,4].map(i => <div key={i} className="flex-1 h-[3px] rounded-full transition-all duration-300" style={{ background: i <= pwdScore ? (pwdScore <= 1 ? "#ef4444" : pwdScore === 2 ? "#f97316" : pwdScore === 3 ? "#eab308" : "#22c55e") : "#f3f4f6" }} />)}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {[{ c: pwdChecks.length, l: "8 car." },{ c: pwdChecks.upper, l: "Maj." },{ c: pwdChecks.number, l: "Chiffre" },{ c: pwdChecks.special, l: "Spécial" }].map(({ c, l }) => (
                    <span key={l} className={`text-[10px] font-bold ${c ? "text-green-500" : "text-gray-500"}`}>{c ? "✓" : "○"} {l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={lbl}>Confirmer</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[23px] h-[23px] text-[#6d788b]" />
              <input className={inp + " pl-9 pr-10"} type={showConfirm ? "text" : "password"} placeholder="••••••••" aria-label="Confirmer le mot de passe" autoComplete="new-password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />
              <button type="button" aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"} onClick={() => setShowConfirm(!showConfirm)} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#6d788b] hover:text-[#6d788b] transition"><EyeIcon show={showConfirm} /></button>
            </div>
          </div>



          {touched && !isValid && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-[12px] text-red-500 font-bold">
                {!form.prenom || !form.nom ? "Prénom et nom requis." : !form.email ? "Email requis." : !pwdStrong ? "Mot de passe trop faible." : form.password !== form.confirm ? "Mots de passe différents." : !consentChecked ? "Acceptez les conditions." : ""}
              </p>
            </div>
          )}

          <div className="pt-2 space-y-4">
            <div role="checkbox" tabIndex={0} aria-checked={consentChecked} aria-label="Accepter les conditions et la politique de confidentialité" onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setConsentChecked(!consentChecked); } }} onClick={() => setConsentChecked(!consentChecked)} className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 flex items-start gap-3 cursor-pointer active:scale-[0.99] transition">
              <div className={`w-[27px] h-[27px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${consentChecked ? "bg-[#E8732A] border-[#E8732A]" : "border-[#e0e4e9] bg-white"}`}>
                {consentChecked && <Check className="w-3 h-3 text-white" />}
              </div>
              <p className="text-[13px] sm:text-[14px] text-[#617089] leading-relaxed">
                J'accepte les <a href="/parametres/conditions" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-bold underline" style={{ color: BRAND }}>CGU</a> et la <a href="/parametres/politique-confidentialite" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-bold underline" style={{ color: BRAND }}>Politique de Confidentialité</a>. RGPD.
              </p>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <div className="mt-7 space-y-5 pb-4">
          <button onClick={handleSubmit} disabled={submitting} className="w-full h-14 sm:h-[64px] rounded-2xl font-extrabold text-[16px] uppercase tracking-[0.12em] text-white active:scale-[0.98] transition-all flex items-center justify-center gap-3" style={{ background: isValid ? BRAND : "#e1e4e9" }}>
            {submitting ? "Envoi…" : "Suivant"} <ArrowRight className="w-4 h-4" />
          </button>
          <SocialAuthButtons mode="signup" disabled={submitting} beforeStart={() => {
            if (!consentChecked) { setError('Acceptez les conditions ci-dessus pour créer votre compte.'); return false; }
            setError(''); return true;
          }} />
          <p className="text-center text-[14px] sm:text-[15px] text-[#617089]">Déjà un compte ? <Link to="/connexion" className="font-bold" style={{ color: BRAND }}>Se connecter</Link></p>
          <button aria-label="Retour" onClick={onBack} className="w-full text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">Retour</button>
        </div>
      </div>
    </div>
  );
}

function StepVerification({ onNext, onBack }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(45);
  const inputs = useRef([]);
  const timerRef = useRef(null);
  const [data, setData] = useState(() => readSignupDraft(sessionStorage));
  const contact = data.mode === "email" ? data.email : data.phone;
  const masked = data.mode === "email" ? contact?.replace(/(.{2}).+(@.+)/, "$1***$2") : contact?.replace(/.(?=.{4})/g, "*");

  useEffect(() => { timerRef.current = setInterval(() => { setResendTimer(p => { if (p <= 1) { clearInterval(timerRef.current); return 0; } return p - 1; }); }, 1000); return () => clearInterval(timerRef.current); }, []);

  const handleChange = (i, val) => { if (!/^\d?$/.test(val)) return; const n = [...code]; n[i] = val; setCode(n); if (val && i < 5) inputs.current[i + 1]?.focus(); };
  const handleKeyDown = (i, e) => { if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus(); };
  const fullCode = code.join("");

  const handleVerify = async () => {
    if (fullCode.length < 6 || loading) return;
    setLoading(true); setError("");
    try {
      await authFlows.verifySignup(readSignupDraft(sessionStorage), fullCode);
      onNext();
    } catch (error) {
      setError(error.message); setCode(["", "", "", "", "", ""]); inputs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true); setError("");
    try {
       await authFlows.resendSignup(readSignupDraft(sessionStorage), authCallbackUrl);
      setResendTimer(45); clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setResendTimer(p => {
        if (p <= 1) { clearInterval(timerRef.current); return 0; } return p - 1;
      }), 1000);
    } catch (error) { setError(error.message); }
    finally { setResending(false); }
  };

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="h-1 w-full" style={{ background: BRAND }} />
      <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col flex-1">
        <div className="mb-8"><ProgressBar step={2} total={4} /></div>
        <StepLabel step={2} total={4} />

        <h2 className="text-[28px] font-extrabold text-gray-900 leading-tight mb-1.5 tracking-tight">Vérifiez<br />votre {data.mode === "email" ? "email" : "numéro"}</h2>
        <p className="text-[13px] text-gray-500 mb-8">Code à 6 chiffres envoyé à <span className="font-bold text-gray-700">{masked}</span></p>

        <div className="flex-1 flex flex-col items-center gap-5 pt-2">
          <div className="flex gap-2.5 justify-center">
            {code.map((d, i) => (
              <input key={i} ref={el => inputs.current[i] = el} aria-label={"Chiffre " + (i + 1) + " du code"} autoComplete={i === 0 ? "one-time-code" : "off"} type="text" inputMode="numeric" maxLength={1} value={d} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)} className="w-[44px] h-[52px] text-center text-[20px] font-extrabold bg-gray-50 border border-gray-100 rounded-xl outline-none transition-all text-gray-800 focus:border-orange-200 focus:bg-white" style={{ border: d ? `1.5px solid ${BRAND}` : undefined }} />
            ))}
          </div>

          {error && <div role="alert" className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 w-full text-center"><p className="text-[12px] text-red-500 font-bold">{error}</p></div>}

          <button onClick={handleResend} disabled={resendTimer > 0 || resending} className={`flex items-center gap-2 text-[11px] font-bold active:scale-95 transition ${resendTimer > 0 ? 'text-gray-500' : ''}`} style={{ color: resendTimer > 0 ? undefined : BRAND }}>
            <RotateCcw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
            {resendTimer > 0 ? `${resendTimer}s` : resending ? "Envoi..." : "Renvoyer"}
          </button>
        </div>

        <div className="space-y-3">
          <button onClick={handleVerify} disabled={fullCode.length < 6 || loading} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition-all flex items-center justify-center gap-2" style={{ background: fullCode.length === 6 && !loading ? BRAND : "#e5e7eb" }}>
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Confirmer</span><ArrowRight className="w-4 h-4" /></>}
          </button>
          <button aria-label="Retour" onClick={onBack} className="w-full text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">Retour</button>
        </div>
      </div>
    </div>
  );
}

function StepSocialIdentity({ onNext }) {
  const draft = readSignupDraft(sessionStorage);
  const [prenom, setPrenom] = useState(draft.prenom || '');
  const [nom, setNom] = useState(draft.nom || '');
  function submit(event) {
    event.preventDefault();
    if (!prenom.trim() || !nom.trim()) return;
    saveSignupDraft(sessionStorage, { ...draft, prenom: prenom.trim(), nom: nom.trim() });
    sessionStorage.removeItem('bb_social_name_required'); onNext();
  }
  return <main className="min-h-screen max-w-lg mx-auto bg-white px-6 py-12">
    <BrandLogo size={44} alt="Logo BeautyBook" /><h1 className="mt-10 text-3xl font-extrabold tracking-tight text-gray-900">Comment vous appeler ?</h1>
    <p className="mt-3 mb-8 text-sm text-gray-500">Votre compte est connecté. Complétez votre nom pour vos rendez-vous et votre profil.</p>
    <form onSubmit={submit} className="space-y-5">
      <label className="block text-sm font-semibold text-gray-700">Prénom<input autoComplete="given-name" required maxLength={80} value={prenom} onChange={e => setPrenom(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5" /></label>
      <label className="block text-sm font-semibold text-gray-700">Nom<input autoComplete="family-name" required maxLength={80} value={nom} onChange={e => setNom(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5" /></label>
      <button className="min-h-[52px] w-full rounded-xl bg-[#E8732A] text-white font-bold">Continuer</button>
    </form>
  </main>;
}

function StepBeautyProfile({ onNext, onBack }) {
  const [gender, setGender] = useState(null);
  const [interests, setInterests] = useState([]);
  const toggle = (item) => setInterests(p => p.includes(item) ? p.filter(i => i !== item) : [...p, item]);
  const isValid = !!gender && interests.length >= 1;

  const handleContinue = () => { if (!isValid) return; const ex = readSignupDraft(sessionStorage); saveSignupDraft(sessionStorage, { ...ex, gender, interests }); onNext(); };

  const pill = (active) => `px-5 py-2.5 rounded-xl text-[11px] font-extrabold border transition-all active:scale-95 uppercase tracking-[0.15em] ${active ? "text-white border-transparent" : "text-gray-500 border-gray-100 bg-gray-50"}`;

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="h-1 w-full" style={{ background: BRAND }} />
      <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col flex-1">
        <div className="mb-8"><ProgressBar step={3} total={4} /></div>
        <StepLabel step={3} total={4} />

        <h2 className="text-[28px] font-extrabold text-gray-900 leading-tight mb-1.5 tracking-tight">Votre Profil<br />Beauté</h2>
        <p className="text-[13px] text-gray-500 mb-6">Personnalisez votre expérience.</p>

        <div className="flex-1 space-y-6">
          <div>
            <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.18em] mb-3">Vous êtes ? <span className="text-gray-500">*obligatoire</span></p>
            <div className="flex gap-2.5 flex-wrap">
              {["FEMME", "HOMME", "AUTRE"].map(g => <button key={g} onClick={() => setGender(g)} className={pill(gender === g)} style={gender === g ? { background: BRAND } : {}}>{g}</button>)}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.18em] mb-3">Vos intérêts <span className="text-gray-500">*au moins 1</span></p>
            <div className="flex flex-wrap gap-2.5">
              {INTERESTS.map(item => <button key={item} onClick={() => toggle(item)} className={pill(interests.includes(item))} style={interests.includes(item) ? { background: BRAND } : {}}>{item}</button>)}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 pb-4">
          <button onClick={handleContinue} disabled={!isValid} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition-all flex items-center justify-center gap-2" style={{ background: isValid ? BRAND : "#e5e7eb" }}>
            Continuer <ArrowRight className="w-4 h-4" />
          </button>
          <button aria-label="Retour" onClick={onBack} className="w-full text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">Retour</button>
        </div>
      </div>
    </div>
  );
}

function StepPhoto({ onNext, onBack }) {
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [banner, setBanner] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef(null);
  const bannerRef = useRef(null);

  const handlePhoto = (e) => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); setPhoto(URL.createObjectURL(f)); } };
  const handleBanner = (e) => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBanner(URL.createObjectURL(f)); } };

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => () => { if (banner) URL.revokeObjectURL(banner); }, [banner]);
  const handleFinish = async () => {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const draft = readSignupDraft(sessionStorage);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Votre session a expiré. Reconnectez-vous.');
      await authFlows.ensureProfile(user);
      const updates = { gender: draft.gender || null, beauty_interests: draft.interests || [],
        full_name: [draft.prenom, draft.nom].filter(Boolean).join(' ') || user.user_metadata?.full_name || '', updated_at: new Date().toISOString() };
      if (photoFile) { const { file_url } = await uploadFile({ file: photoFile }); updates.avatar_url = file_url; }
      if (bannerFile) { const { file_url } = await uploadFile({ file: bannerFile }); updates.cover_url = file_url; }
      const result = await supabase.from('profiles').update(updates).eq('id', user.id).select('id').single();
      if (result.error || !result.data) throw new Error('Votre profil n’a pas été enregistré. Réessayez.');
      onNext();
    } catch (error) { setError(error.message || 'Enregistrement impossible.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="h-1 w-full" style={{ background: BRAND }} />
      <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col flex-1">
        <div className="mb-8"><ProgressBar step={4} total={4} /></div>
        <StepLabel step={4} total={4} />

        <h2 className="text-[28px] font-extrabold text-gray-900 leading-tight mb-1.5 tracking-tight">Votre<br />profil</h2>
        <p className="text-[13px] text-gray-500 mb-6">Ajoutez une photo pour vous identifier.</p>

        <div className="flex-1 space-y-5">
          <div>
            <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.18em] mb-2.5">Bannière <span className="text-gray-500">optionnelle</span></p>
            <div onClick={() => bannerRef.current?.click()} className="relative w-full h-28 rounded-xl overflow-hidden cursor-pointer active:scale-[0.99] transition border border-dashed border-gray-200 bg-gray-50">
              {banner ? <BeautyImage src={banner} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2"><Camera className="w-7 h-7 text-gray-200" strokeWidth={1} /><span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.18em]">Ajouter</span></div>}
            </div>
            <input ref={bannerRef} type="file" accept="image/*" onChange={handleBanner} className="hidden" />
          </div>

          <div>
            <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.18em] mb-2.5">Photo de profil <span className="text-gray-500">optionnelle</span></p>
            <div className="flex items-center gap-5">
              <div className="relative">
                <div onClick={() => photoRef.current?.click()} className="w-20 h-20 rounded-full flex items-center justify-center border border-dashed border-gray-200 bg-gray-50 cursor-pointer">
                  {photo ? <BeautyImage src={photo} alt="" className="w-full h-full rounded-full object-cover" /> : <Camera className="w-7 h-7 text-gray-200" strokeWidth={1} />}
                </div>
                <button onClick={() => photoRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: BRAND }}><Camera className="w-3 h-3 text-white" /></button>
                <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </div>
              <div><p className="text-[13px] font-bold text-gray-700">Photo de profil</p><p className="text-[11px] text-gray-500 mt-0.5">Visible par la communauté</p></div>
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-5 pb-4">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button onClick={handleFinish} disabled={loading} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition-all flex items-center justify-center gap-2" style={{ background: !loading ? BRAND : "#e5e7eb" }}>
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Terminer</span><ArrowRight className="w-4 h-4" /></>}
          </button>
          <button aria-label="Retour" onClick={onBack} className="w-full text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">Retour</button>
        </div>
      </div>
    </div>
  );
}

function StepSuccess({ onDone }) {
  const data = readSignupDraft(sessionStorage);
  const prenom = data.prenom || "";

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col items-center justify-center px-6">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto rounded-[24px] flex items-center justify-center mb-10" style={{ background: BRAND }}>
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-[34px] font-black text-gray-900 leading-tight mb-3 tracking-tight">{prenom ? `Bienvenue\n${prenom} !` : "Bienvenue !"}</h2>
        <p className="text-[14px] text-gray-500 max-w-[260px] mx-auto">Votre profil est prêt. Rejoignez la communauté.</p>
      </div>
      <div className="w-full mt-14">
        <button onClick={onDone} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition-all flex items-center justify-center gap-2" style={{ background: BRAND }}>
          Découvrir <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function StepNotifications({ onNext }) {
  const [status, setStatus] = useState('idle');
  const handleAllow = async () => {
    if (!('Notification' in window)) { setStatus('unavailable'); setTimeout(onNext, 1200); return; }
    if (Notification.permission === 'granted') { setStatus('granted'); setTimeout(onNext, 600); return; }
    setStatus('loading');
    try { const r = await Notification.requestPermission(); setStatus(r === 'granted' ? 'granted' : 'denied'); } catch { setStatus('denied'); }
    setTimeout(onNext, 1000);
  };

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="h-1 w-full" style={{ background: BRAND }} />
      <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col flex-1">
        <div className="mb-8"><ProgressBar step={5} total={4} /></div>
        <StepLabel step={5} total={4} />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <div className="w-24 h-24 rounded-[28px] flex items-center justify-center" style={{ background: BRAND_LIGHT }}><span className="text-[48px]">🔔</span></div>
          <div>
            <h2 className="text-[30px] font-extrabold text-gray-900 leading-tight mb-3 tracking-tight">Notifications</h2>
            <p className="text-[14px] text-gray-500 max-w-[280px] mx-auto">Alertes réservations, messages et offres.</p>
          </div>
          {status === 'granted' && <div className="flex items-center gap-2 bg-green-50 border border-green-100 px-4 py-2.5 rounded-xl"><Check className="w-4 h-4 text-green-500" /><span className="text-green-600 text-[12px] font-bold">Activées</span></div>}
          {status === 'denied' && <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl"><span className="text-red-500 text-[12px] font-bold">Refusé</span></div>}
        </div>
        <div className="space-y-3">
          {(status === 'idle' || status === 'loading') && <button onClick={handleAllow} disabled={status === 'loading'} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition-all" style={{ background: BRAND }}>{status === 'loading' ? "En attente..." : "Activer"}</button>}
          <button onClick={onNext} className="w-full py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] active:scale-95 transition">Passer</button>
        </div>
      </div>
    </div>
  );
}

function StepLocation({ onNext }) {
  const [status, setStatus] = useState('idle');
  const handleAllow = async () => {
    if (!navigator.geolocation) { setStatus('unavailable'); setTimeout(onNext, 1200); return; }
    setStatus('loading');
    try {
      const r = await new Promise(res => navigator.geolocation.getCurrentPosition(() => res('granted'), () => res('denied'), { timeout: 10000 }));
      setStatus(r);
      if (r === 'granted') navigator.geolocation.getCurrentPosition(async pos => { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('profiles').upsert({ id: user.id, latitude: pos.coords.latitude, longitude: pos.coords.longitude, updated_at: new Date().toISOString() }, { onConflict: 'id' }); }, () => {}, { enableHighAccuracy: false });
    } catch { setStatus('denied'); }
    setTimeout(onNext, 1000);
  };

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="h-1 w-full" style={{ background: BRAND }} />
      <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col flex-1">
        <div className="mb-8"><ProgressBar step={6} total={4} /></div>
        <StepLabel step={6} total={4} />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <div className="w-24 h-24 rounded-[28px] flex items-center justify-center" style={{ background: BRAND_LIGHT }}><span className="text-[48px]">📍</span></div>
          <div>
            <h2 className="text-[30px] font-extrabold text-gray-900 leading-tight mb-3 tracking-tight">Localisation</h2>
            <p className="text-[14px] text-gray-500 max-w-[280px] mx-auto">Trouvez les salons les plus proches.</p>
          </div>
          {status === 'granted' && <div className="flex items-center gap-2 bg-green-50 border border-green-100 px-4 py-2.5 rounded-xl"><Check className="w-4 h-4 text-green-500" /><span className="text-green-600 text-[12px] font-bold">Activée</span></div>}
          {status === 'denied' && <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl"><span className="text-red-500 text-[12px] font-bold">Refusé</span></div>}
        </div>
        <div className="space-y-3">
          {(status === 'idle' || status === 'loading') && <button onClick={handleAllow} disabled={status === 'loading'} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition-all" style={{ background: BRAND }}>{status === 'loading' ? "En attente..." : "Activer"}</button>}
          <button onClick={onNext} className="w-full py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] active:scale-95 transition">Passer</button>
        </div>
      </div>
    </div>
  );
}

function StepCameraMic({ onNext }) {
  const [camStatus, setCamStatus] = useState('idle');
  const [micStatus, setMicStatus] = useState('idle');

  const handleAllow = async () => {
    setCamStatus('loading'); setMicStatus('loading');
    try { const s = await navigator.mediaDevices?.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()); setCamStatus('granted'); const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('profiles').upsert({ id: user.id, camera_enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'id' }); } catch { setCamStatus('denied'); }
    try { const s = await navigator.mediaDevices?.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); setMicStatus('granted'); const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('profiles').upsert({ id: user.id, mic_enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'id' }); } catch { setMicStatus('denied'); }
    setTimeout(onNext, 1000);
  };

  const badge = (s) => `flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${s === 'granted' ? 'bg-green-50 text-green-600 border border-green-100' : s === 'denied' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-50 text-gray-500 border border-gray-100'}`;

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto bg-white flex flex-col">
      <div className="h-1 w-full" style={{ background: BRAND }} />
      <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col flex-1">
        <div className="mb-8"><ProgressBar step={7} total={4} /></div>
        <StepLabel step={7} total={4} />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <div className="w-24 h-24 rounded-[28px] flex items-center justify-center" style={{ background: BRAND_LIGHT }}><span className="text-[48px]">📸</span></div>
          <div>
            <h2 className="text-[30px] font-extrabold text-gray-900 leading-tight mb-3 tracking-tight">Caméra & Micro</h2>
            <p className="text-[14px] text-gray-500 max-w-[280px] mx-auto">Photos, reels et assistant vocal.</p>
          </div>
          <div className="flex gap-2.5">
            <div className={badge(camStatus)}>📷 {camStatus === 'granted' ? 'OK' : camStatus === 'denied' ? 'Non' : 'Cam'}</div>
            <div className={badge(micStatus)}>🎙️ {micStatus === 'granted' ? 'OK' : micStatus === 'denied' ? 'Non' : 'Mic'}</div>
          </div>
        </div>
        <div className="space-y-3">
          {camStatus === 'idle' && <button onClick={handleAllow} className="w-full h-[52px] rounded-xl font-extrabold text-[13px] uppercase tracking-[0.12em] text-white active:scale-[0.97] transition-all" style={{ background: BRAND }}>Autoriser</button>}
          <button onClick={onNext} className="w-full py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] active:scale-95 transition">Passer</button>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(() => {
    if (sessionStorage.getItem("bb_social_signup") === "1") { sessionStorage.removeItem("bb_social_signup"); sessionStorage.setItem("bb_social_signup_processed", "1"); return sessionStorage.getItem("bb_social_name_required") === "1" ? 9 : 3; }
    if (sessionStorage.getItem("bb_from_login") === "1") { sessionStorage.removeItem("bb_from_login"); return 1; }
    return 0;
  });

  const done = () => { localStorage.setItem("bb_onboarded", "1"); localStorage.removeItem("bb_is_pro"); sessionStorage.removeItem("bb_signup_data"); sessionStorage.removeItem("bb_social_signup_processed"); navigate("/", { replace: true }); };

  const handleSplashDone = () => {
    sessionStorage.setItem("bb_splash_done", "1");
    navigate("/", { replace: true });
  };

  return (
    <div className="font-display relative">
      {step === 0 && <StepSplash onNext={handleSplashDone} />}
      {step === 1 && <StepSignup onNext={(verified) => setStep(verified ? 3 : 2)} onBack={() => setStep(0)} />}
      {step === 2 && <StepVerification onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepBeautyProfile onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <StepPhoto onNext={() => setStep(8)} onBack={() => setStep(3)} />}
      {step === 8 && <StepSuccess onDone={done} />}
      {step === 9 && <StepSocialIdentity onNext={() => setStep(3)} />}

      {step > 0 && step < 8 && (
        <button aria-label="Étape précédente" onClick={() => { if (step === 1) navigate(-1); else setStep(step - 1); }} className="fixed bottom-6 left-6 w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center active:scale-90 transition z-50">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
      )}
    </div>
  );
}
