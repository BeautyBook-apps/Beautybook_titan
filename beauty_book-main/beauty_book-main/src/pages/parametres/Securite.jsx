import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Key, Eye, EyeOff, CheckCircle, Fingerprint, ShieldCheck, Copy, Trash2 } from "lucide-react";
import { useThemeBg } from "@/hooks/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { hasSavedPassword, revealPassword, clearPassword, savePassword } from "@/lib/passwordVault";

export default function Securite() {
  const navigate = useNavigate();
  const themeBg = useThemeBg();
  const { user } = useAuth();
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ next: false, confirm: false });
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [lastPwdChange, setLastPwdChange] = useState(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState("");
  const [vaultExists, setVaultExists] = useState(false);
  const [revealedPwd, setRevealedPwd] = useState("");
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState("");
  const [copied, setCopied] = useState(false);
  const revealTimer = useRef(null);

  const biometricKey = user?.id ? `bb_biometric_${user.id}` : null;

  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

  useEffect(() => {
    let active = true;
    const detectBiometric = async () => {
      const supported = Boolean(window.PublicKeyCredential && navigator.credentials);
      if (!supported) return;
      const platformAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false);
      if (active) {
        setBiometricSupported(Boolean(platformAvailable));
        setBiometricEnabled(Boolean(biometricKey && localStorage.getItem(biometricKey)));
      }
    };
    detectBiometric();
    return () => { active = false; };
  }, [biometricKey]);

  useEffect(() => {
    if (user?.id) setVaultExists(hasSavedPassword(user.id));
  }, [user?.id]);

  // Déverrouillage natif de l'appareil (Face ID / empreinte / code PIN),
  // puis révélation du mot de passe chiffré stocké sur cet appareil.
  const handleRevealPassword = async () => {
    if (!user?.id || revealBusy) return;
    setRevealError(""); setCopied(false);
    if (revealedPwd) { setRevealedPwd(""); return; }
    if (!vaultExists) { setRevealError("Aucun mot de passe enregistré sur cet appareil."); return; }
    if (!biometricEnabled || !biometricKey) {
      setRevealError("Activez Face ID / Touch ID ci-dessus pour révéler votre mot de passe.");
      return;
    }
    setRevealBusy(true);
    try {
      const stored = JSON.parse(localStorage.getItem(biometricKey));
      const credentialId = new Uint8Array(stored);
      const assertion = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: credentialId, type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      }});
      if (!assertion) throw new Error("Déverrouillage annulé.");
      const pwd = await revealPassword(user.id);
      setRevealedPwd(pwd);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealedPwd(""), 30000);
    } catch (error) {
      if (error?.name !== "NotAllowedError") setRevealError("Déverrouillage impossible. Réessayez.");
    } finally {
      setRevealBusy(false);
    }
  };

  const handleCopyPwd = async () => {
    if (!revealedPwd) return;
    try { await navigator.clipboard.writeText(revealedPwd); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setRevealError("Copie impossible."); }
  };

  const handleClearVault = () => {
    if (!user?.id) return;
    clearPassword(user.id);
    setVaultExists(false);
    setRevealedPwd("");
  };

  useEffect(() => {
    const loadData = async () => {
      // Récupérer le profil pour la date du dernier changement de mot de passe
      if (user?.id) {
        const { data } = await supabase.from('profiles').select('updated_at, password_changed_at').eq('id', user.id).maybeSingle();
        if (data?.updated_at) setLastPwdChange(data.updated_at);
        if (data?.password_changed_at) setLastPwdChange(data.password_changed_at);
      }

    };
    loadData();
  }, [user?.id]);

  const toggleBiometric = async () => {
    if (!biometricKey || !biometricSupported || biometricBusy) return;
    setBiometricError("");
    if (biometricEnabled) {
      localStorage.removeItem(biometricKey);
      setBiometricEnabled(false);
      return;
    }
    setBiometricBusy(true);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const credential = await navigator.credentials.create({ publicKey: {
        challenge,
        rp: { name: "BeautyBook", id: window.location.hostname },
        user: { id: userId, name: user.email || "beautybook-user", displayName: user.username || user.email || "BeautyBook" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000,
        attestation: "none",
      } });
      if (!credential?.rawId) throw new Error("La biométrie n’a pas été enregistrée.");
      localStorage.setItem(biometricKey, JSON.stringify(Array.from(new Uint8Array(credential.rawId))));
      setBiometricEnabled(true);
    } catch (error) {
      if (error?.name !== "NotAllowedError") setBiometricError("Impossible d’activer la biométrie sur cet appareil.");
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleSavePwd = async () => {
    if (!pwd.next || pwd.next !== pwd.confirm) return;
    if (pwd.next.length < 8) { setPwdError("Le mot de passe doit faire au moins 8 caractères."); return; }
    setPwdError("");
    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) {
        setPwdError(error.message || "Erreur lors du changement de mot de passe.");
        setPwdLoading(false);
        return;
      }

      // Mettre à jour la date dans le profil
      try {
        await supabase.from('profiles').update({ password_changed_at: new Date().toISOString() }).eq('id', user.id);
      } catch {}

      // Si un mot de passe est enregistré sur cet appareil, le mettre à jour aussi
      try {
        if (hasSavedPassword(user.id)) { await savePassword(user.id, pwd.next); setVaultExists(true); }
      } catch {}

      setPwdSaved(true);
      setShowChangePwd(false);
      setPwd({ next: "", confirm: "" });
      setLastPwdChange(new Date().toISOString());
      setPwdLoading(false);
      setTimeout(() => setPwdSaved(false), 3000);
    } catch (e) {
      setPwdError("Erreur: " + (e.message || "Inconnue"));
      setPwdLoading(false);
    }
  };

  const formatTimeSince = (dateStr) => {
    if (!dateStr) return "Récemment";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 30) return `Il y a ${days} jours`;
    return `Il y a ${Math.floor(days / 30)} mois`;
  };

  const inputClass = "w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-gray-400 pr-12";

  return (
    <div className="font-display min-h-screen" style={{ background: themeBg }}>
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Sécurité</h1>
      </div>

      <div className="px-4 pb-20 pt-6 space-y-5">
        {pwdSaved && (
          <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-[13px] font-bold text-green-600">Mot de passe mis à jour avec succès !</p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Accès au compte</p>
          <div className="bg-white rounded-3xl overflow-hidden">
             <div className="px-4 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Key className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-black text-gray-900">Mot de passe</p>
                  <p className="text-[11px] text-gray-400 font-medium">Modifié {formatTimeSince(lastPwdChange)}</p>
                </div>
                <button onClick={() => setShowChangePwd(!showChangePwd)}
                  className="text-[13px] font-black active:scale-95 transition-all" style={{ color: "#E8732A" }}>
                  {showChangePwd ? "ANNULER" : "MODIFIER"}
                </button>
              </div>
              {showChangePwd && (
                <div className="mt-4 space-y-3">
                  {[
                     { key: "next", label: "Nouveau mot de passe", placeholder: "••••••••" },
                    { key: "confirm", label: "Confirmer le nouveau", placeholder: "••••••••" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                      <div className="relative">
                        <input className={inputClass} type={showPwd[key] ? "text" : "password"}
                          placeholder={placeholder} value={pwd[key]} onChange={e => setPwd(p => ({ ...p, [key]: e.target.value }))} />
                        <button onClick={() => setShowPwd(s => ({ ...s, [key]: !s[key] }))}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPwd[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                   {pwd.next && pwd.confirm && pwd.next !== pwd.confirm && (
                    <p className="text-[11px] text-red-400 font-bold">Les mots de passe ne correspondent pas.</p>
                  )}
                   {pwd.next && pwd.next.length < 8 && (
                     <p className="text-[11px] text-red-400 font-bold">Minimum 8 caractères.</p>
                  )}
                  {pwdError && <p className="text-[11px] text-red-400 font-bold">{pwdError}</p>}
                   <button onClick={handleSavePwd} disabled={!pwd.next || !pwd.confirm || pwd.next !== pwd.confirm || pwd.next.length < 8 || pwdLoading}
                    className="w-full py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: "#E8732A" }}>
                    {pwdLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Vérification...</> : "Enregistrer"}
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 py-4 flex items-center gap-3 border-t border-gray-50">
              <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center shrink-0">
                <Fingerprint className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-black text-gray-900">Face ID / Touch ID</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  {!biometricSupported ? "Non disponible sur cet appareil" : biometricEnabled ? "Activé sur cet appareil" : "Déverrouillage sécurisé"}
                </p>
                {biometricError && <p className="text-[11px] text-red-500 font-bold mt-1">{biometricError}</p>}
              </div>
              <button type="button" onClick={toggleBiometric} disabled={!biometricSupported || biometricBusy}
                aria-label={biometricEnabled ? "Désactiver Face ID ou Touch ID" : "Activer Face ID ou Touch ID"}
                className="w-12 h-6 rounded-full transition-all duration-300 flex items-center px-0.5 disabled:opacity-40"
                style={{ background: biometricEnabled ? "#E8732A" : "#d1d5db" }}>
                <span className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${biometricEnabled ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="px-4 py-4 border-t border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-black text-gray-900">Voir mon mot de passe</p>
                  <p className="text-[11px] text-gray-400 font-medium">
                    {vaultExists ? "Enregistré chiffré sur cet appareil" : "Aucun mot de passe enregistré"}
                  </p>
                  {revealError && <p className="text-[11px] text-red-500 font-bold mt-1">{revealError}</p>}
                </div>
                {vaultExists && (
                  <button onClick={handleRevealPassword} disabled={revealBusy}
                    className="text-[13px] font-black active:scale-95 transition-all disabled:opacity-40" style={{ color: "#E8732A" }}>
                    {revealBusy ? "..." : revealedPwd ? "MASQUER" : "VOIR"}
                  </button>
                )}
              </div>
              {revealedPwd && (
                <div className="mt-3 bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400 shrink-0" />
                  <p className="flex-1 text-[14px] font-mono font-bold text-gray-800 break-all select-all">{revealedPwd}</p>
                  <button onClick={handleCopyPwd} aria-label="Copier le mot de passe" className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:scale-95 transition-all shrink-0">
                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              )}
              {revealedPwd && <p className="text-[10px] text-gray-400 font-medium mt-2">Masqué automatiquement dans 30 secondes.</p>}
              {vaultExists && !revealedPwd && (
                <button onClick={handleClearVault} className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-gray-400 active:scale-95 transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Retirer de cet appareil
                </button>
              )}
              {!vaultExists && (
                <p className="text-[11px] text-gray-400 font-medium mt-2">Cochez « Enregistrer le mot de passe sur cet appareil » lors de votre prochaine connexion pour l'activer.</p>
              )}
            </div>
           </div>
         </div>
      </div>
    </div>
  );
}
