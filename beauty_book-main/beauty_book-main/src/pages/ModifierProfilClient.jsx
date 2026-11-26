import BeautyImage from '@/components/ui/BeautyImage';
import AvatarPresetPicker from "@/components/ui/AvatarPresetPicker";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Image, Mail, ShieldCheck, CheckCircle2, Pencil, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { authCallbackUrl, supabase } from '@/api/supabaseClient';
import { useProfileMedia } from "@/hooks/useProfileMedia";
import { normalizeUsername, usernameCandidates } from "@/lib/authFlows";

const DEFAULT_AVATAR = "";
const DEFAULT_BANNER = "";
const bioMax = 160;

async function uploadToSupabase(file) {
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `profiles/${Date.now()}_${safeName}`;
  console.log('[uploadToSupabase] Uploading to:', filePath);
  const { error } = await supabase.storage.from('uploads').upload(filePath, file, { contentType: file.type, upsert: true });
  if (error) {
    console.error('[uploadToSupabase] Upload error:', error);
    throw new Error(error.message);
  }
  const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
  console.log('[uploadToSupabase] Public URL:', data.publicUrl);
  return data.publicUrl;
}

export default function ModifierProfilClient() {
  const navigate = useNavigate();
  const { user, profile, refreshUser } = useAuth();
  const { avatarUrl, coverUrl, uploadingAvatar, uploadingCover, selectAvatar, selectCover, setAvatar, removeAvatar, removeCover } = useProfileMedia(user);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [emailChanged, setEmailChanged] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailUpdateRequested, setEmailUpdateRequested] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);

  const pendingAvatarRef = useRef(null);
  const pendingCoverRef = useRef(null);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    bio: "",
    email: "",
    phone: "",
    instagram: "",
    facebook: "",
    website: "",
  });

  useEffect(() => {
    const loadForm = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) {
        setForm({
          fullName: data.full_name || "",
          username: user?.username || data.username || profile?.username || "",
          bio: data.bio || "",
          email: user?.email || data.email || "",
          phone: data.phone || "",
          instagram: data.instagram || "",
          facebook: data.facebook || "",
          website: data.website || "",
        });
      }
    };
    loadForm();
  }, [user?.id]);

  useEffect(() => {
    const username = normalizeUsername(form.username);
    const currentUsername = normalizeUsername(user?.username || profile?.username);
    if (username.length < 3 || username === currentUsername) {
      setUsernameSuggestions([]);
      setUsernameAvailable(username.length >= 3);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setUsernameChecking(true);
      const { data, error } = await supabase.from('profiles').select('id, username').not('username', 'is', null).limit(1000);
      if (!active) return;
      const used = new Set((data || []).filter(row => row.id !== user?.id).map(row => normalizeUsername(row.username)));
      const candidates = usernameCandidates(username).filter(candidate => !used.has(candidate));
      setUsernameAvailable(!error && !used.has(username));
      setUsernameSuggestions(candidates.slice(0, 4));
      setUsernameChecking(false);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [form.username, profile?.username, user?.id]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      pendingAvatarRef.current = file;
      selectAvatar(file);
    }
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      pendingCoverRef.current = file;
      selectCover(file);
    }
  };

  const requestEmailChange = async () => {
    const nextEmail = form.email.trim().toLowerCase();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setError("Vous devez être connecté."); return; }
    if (!nextEmail || !nextEmail.includes("@")) { setError("Saisissez une adresse e-mail valide."); return; }
    if (nextEmail === authUser.email?.toLowerCase()) { setEmailEditing(false); return; }
    setEmailLoading(true);
    setError(null);
    const { error: emailError } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: authCallbackUrl },
    );
    setEmailLoading(false);
    if (emailError) {
      setError(emailError.message || "Impossible de modifier l’adresse e-mail.");
      return;
    }
    setEmailChanged(true);
    setEmailUpdateRequested(true);
    setEmailEditing(false);
  };

  const save = async () => {
      setSaving(true);
      setError(null);
      setEmailChanged(false);
      let changingEmail = false;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError("Vous devez être connecté");
        setSaving(false);
        return;
      }

      const username = normalizeUsername(form.username);
      if (username.length < 3) {
        setError("Le nom d’utilisateur doit contenir au moins 3 caractères.");
        setSaving(false);
        return;
      }
      const { data: duplicate } = await supabase.from('profiles').select('id').ilike('username', username).neq('id', authUser.id).maybeSingle();
      if (duplicate) {
        setError("Ce nom d’utilisateur est déjà utilisé. Choisissez une suggestion disponible.");
        setSaving(false);
        return;
      }

      // Supabase demande confirmation de la nouvelle adresse avant de la rendre active.
       if (form.email && form.email !== authUser.email && !emailUpdateRequested) {
        setEmailLoading(true);
         const { error: emailErr } = await supabase.auth.updateUser(
           { email: form.email.trim().toLowerCase() },
           { emailRedirectTo: authCallbackUrl },
         );
        if (emailErr) {
          setError("Erreur email: " + (emailErr.message || "Impossible de modifier l'email. Vérifiez que l'adresse est valide."));
          setSaving(false);
          setEmailLoading(false);
          return;
         }
         setEmailChanged(true);
         changingEmail = true;
         setEmailLoading(false);
      }

       const profileData = { id: authUser.id, updated_at: new Date().toISOString() };
       if (form.fullName !== undefined) profileData.full_name = form.fullName;
       profileData.username = username;
       if (form.email !== undefined && !changingEmail && !emailUpdateRequested) profileData.email = form.email;
      if (form.phone !== undefined) profileData.phone = form.phone;
      if (form.instagram !== undefined) profileData.instagram = form.instagram;
      if (form.facebook !== undefined) profileData.facebook = form.facebook;
      if (form.website !== undefined) profileData.website = form.website;
      profileData.avatar_url = avatarUrl || "";
      profileData.cover_url = coverUrl || "";

      // Upload avatar via Supabase Storage
      if (pendingAvatarRef.current) {
        try {
          const url = await uploadToSupabase(pendingAvatarRef.current);
          if (url) {
            profileData.avatar_url = url;
            console.log('[ModifierProfil] Avatar uploaded:', url);
          }
        } catch (e) {
          console.error('[ModifierProfil] Avatar upload error:', e);
          setError("Erreur upload avatar: " + e.message);
          setSaving(false);
          return;
        }
        pendingAvatarRef.current = null;
      }

      // Upload cover via Supabase Storage
      if (pendingCoverRef.current) {
        try {
          const url = await uploadToSupabase(pendingCoverRef.current);
          if (url) {
            profileData.cover_url = url;
            console.log('[ModifierProfil] Cover uploaded:', url);
          }
        } catch (e) {
          console.error('[ModifierProfil] Cover upload error:', e);
          setError("Erreur upload bannière: " + e.message);
          setSaving(false);
          return;
        }
        pendingCoverRef.current = null;
      }

      console.log('[ModifierProfil] Saving profile:', profileData);

      // Upsert direct dans Supabase
      const { data: upsertData, error: upsertError } = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' }).select();
      if (upsertError) {
        console.error('[ModifierProfil] Profile upsert error:', upsertError);
        setError("Erreur sauvegarde: " + upsertError.message);
        setSaving(false);
        return;
      }

      console.log('[ModifierProfil] Profile saved:', upsertData);

      // Mettre à jour aussi user_metadata
      await supabase.auth.updateUser({
         data: { full_name: profileData.full_name, username: profileData.username }
      });

       setSaving(false);
       setSaved(true);
       if (refreshUser) await refreshUser();
       if (!changingEmail) {
         setTimeout(() => window.location.replace('/profil?' + Date.now()), 300);
       }
    } catch (error) {
      console.error("[ModifierProfil] Error saving:", error);
      setError("Erreur: " + error.message);
      setSaving(false);
    }
  };

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      <div className="bg-white px-5 pt-5 pb-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </button>
        <h1 className="text-[20px] font-black text-gray-900">Modifier le profil</h1>
      </div>

      <div className="pb-32">
        <div className="bg-white mb-3">
          <div className="flex flex-col items-center pt-6 pb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-[3px] border-primary shadow-lg">
                <BeautyImage src={avatarUrl || DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover" />
              </div>
              <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-8 h-8 bg-gray-900 rounded-full border-2 border-white flex items-center justify-center shadow active:scale-95">
                {uploadingAvatar ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => { pendingAvatarRef.current = null; removeAvatar(); }}
                  aria-label="Supprimer la photo de profil"
                  className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-red-500 shadow active:scale-90"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              )}
            </div>
            <button onClick={() => avatarInputRef.current?.click()} className="mt-2 text-[12px] font-black text-primary uppercase tracking-widest">
              Changer la photo
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <AvatarPresetPicker
              selectedUrl={avatarUrl}
              onSelect={(url) => { pendingAvatarRef.current = null; setAvatar(url); }}
            />
          </div>

          <div onClick={() => bannerInputRef.current?.click()}
            className="relative mx-4 mb-4 h-28 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 cursor-pointer active:scale-[0.99] transition-all">
            <BeautyImage src={coverUrl || DEFAULT_BANNER} alt="bannière" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              {uploadingCover
                ? <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                : <><Image className="w-5 h-5 text-gray-500" /><span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Modifier la bannière</span></>}
            </div>
            {coverUrl && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); pendingCoverRef.current = null; removeCover(); }}
                aria-label="Supprimer la bannière"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 active:scale-90"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            )}
          </div>
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
        </div>

        {error && (
          <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-[13px] text-red-600 font-medium">{error}</p>
          </div>
        )}
        <div className="bg-white px-5 py-5 space-y-5 mb-3">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nom complet</p>
            <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder="Utilisateur BeautyBook" className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[15px] font-medium text-gray-800 outline-none" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nom d'utilisateur</p>
            <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3.5 cursor-text" onClick={() => document.getElementById('username-input')?.focus()}>
              <span className="text-[15px] text-gray-400 font-medium mr-1 select-none">@</span>
              <input id="username-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: normalizeUsername(e.target.value) }))}
                placeholder="votre_nom_utilisateur" className="flex-1 bg-transparent text-[15px] font-medium text-gray-800 outline-none" />
            </div>
            <div className="mt-2 min-h-5">
              {usernameChecking && <p className="text-[11px] text-gray-400">Vérification de la disponibilité…</p>}
              {!usernameChecking && usernameAvailable === true && <p className="text-[11px] text-green-600 font-bold">Nom d’utilisateur disponible</p>}
              {!usernameChecking && usernameAvailable === false && <p className="text-[11px] text-red-500 font-bold">Nom déjà utilisé. Suggestions :</p>}
              {!usernameChecking && usernameSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {usernameSuggestions.map(suggestion => (
                    <button type="button" key={suggestion} onClick={() => setForm(f => ({ ...f, username: suggestion }))} className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-primary">
                      @{suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
           <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-4 shadow-sm">
             <div className="flex items-start gap-3 mb-4">
               <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0">
                 <Mail className="w-5 h-5 text-primary" />
               </div>
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2">
                   <p className="text-[13px] font-black text-gray-900">Adresse e-mail</p>
                   {!emailEditing && !emailUpdateRequested && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black uppercase text-green-700">Active</span>}
                 </div>
                 <p className="text-[11px] text-gray-500 mt-0.5">Utilisée pour vous connecter à BeautyBook</p>
               </div>
             </div>

             <input type="email" value={form.email} disabled={!emailEditing || emailLoading}
               onChange={e => { setEmailUpdateRequested(false); setEmailChanged(false); setForm(f => ({ ...f, email: e.target.value })); }}
               placeholder="votre@email.com"
               className="w-full bg-white border border-orange-100 disabled:bg-white/70 disabled:text-gray-600 rounded-2xl px-4 py-3.5 text-[15px] font-medium text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition" />

             {emailChanged && emailUpdateRequested && !emailEditing ? (
               <div className="mt-3 flex items-start gap-2 rounded-2xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                 <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                 <p className="text-[11px] leading-relaxed text-blue-700">Lien envoyé à <strong>{form.email}</strong>. Confirmez-le pour activer cette adresse.</p>
               </div>
             ) : emailEditing ? (
               <div className="flex gap-2 mt-3">
                 <button type="button" onClick={requestEmailChange} disabled={emailLoading} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[12px] font-black text-white disabled:opacity-50">
                   <CheckCircle2 className="w-4 h-4" /> {emailLoading ? "Envoi…" : "Envoyer la confirmation"}
                 </button>
                 <button type="button" onClick={() => { setEmailEditing(false); setForm(f => ({ ...f, email: user?.email || f.email })); }} className="w-11 rounded-2xl border border-gray-200 bg-white flex items-center justify-center">
                   <X className="w-4 h-4 text-gray-500" />
                 </button>
               </div>
             ) : (
               <button type="button" onClick={() => setEmailEditing(true)} disabled={emailUpdateRequested} className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-white py-3 text-[12px] font-black text-primary disabled:opacity-60">
                 <Pencil className="w-3.5 h-3.5" /> Modifier mon adresse e-mail
               </button>
             )}
           </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Numéro de téléphone</p>
            <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3.5">
              <span className="text-[15px] text-gray-400 font-medium mr-1 select-none">📱</span>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+33 6 12 34 56 78" className="flex-1 bg-transparent text-[15px] font-medium text-gray-800 outline-none" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Biographie</p>
            <textarea value={form.bio} onChange={e => e.target.value.length <= bioMax && setForm(f => ({ ...f, bio: e.target.value }))}
              rows={4} placeholder="Parlez de vous..." className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[15px] font-medium text-gray-800 outline-none resize-none" />
            <p className="text-right text-[11px] text-gray-400 font-medium mt-1">{form.bio.length} / {bioMax}</p>
          </div>

        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 z-[99]" style={{ paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <button onClick={save} disabled={saving}
          className="w-full bg-primary text-white font-black text-[15px] uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-all">
          {saved ? "✓ Enregistré !" : saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
