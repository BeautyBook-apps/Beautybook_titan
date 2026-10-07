import { readOAuthIntent, OAUTH_INTENT_KEY } from '@/lib/socialAuth';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { createAuthFlows, readSignupDraft, saveSignupDraft } from '@/lib/authFlows';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false, handling = false;
    const timers = new Set();
    const fail = message => { if (!disposed) setError(message); };

    const complete = async (user) => {
      if (disposed || handling) return;
      handling = true;
      try {
        const profile = await createAuthFlows(supabase).ensureProfile(user).catch(() => ({ id: user.id, email: user.email }));
        if (disposed) return;

        const intent = readOAuthIntent(sessionStorage);
        sessionStorage.removeItem(OAUTH_INTENT_KEY);

        const isSignupIntent = intent?.mode === 'signup';

        if (isSignupIntent) {
          // Lors de l'inscription via Google : afficher immédiatement la page "Vérifier l'email" / onboarding step 2
          const parts = String(user.user_metadata?.full_name || profile?.full_name || '').trim().split(/\s+/);
          saveSignupDraft(sessionStorage, { 
            mode: 'email', 
            email: user.email, 
            prenom: parts[0] || 'Utilisateur', 
            nom: parts.slice(1).join(' ') || '' 
          });
          sessionStorage.setItem('bb_social_signup', '1');
          sessionStorage.setItem('bb_social_verify', '1');
          navigate('/onboarding', { replace: true });
        } else {
          // Lors de la connexion via Google (compte existant) : la page d'accueil s'ouvre automatiquement
          sessionStorage.removeItem('bb_social_signup');
          sessionStorage.removeItem('bb_social_verify');
          localStorage.setItem('bb_onboarded', '1');
          navigate('/', { replace: true });
        }
      } catch (err) { 
        fail(err.message || 'Impossible de terminer la connexion.'); 
      }
    };

    const params = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    if (params.has('error') || query.has('error') || params.has('error_description') || query.has('error_description')) { 
      fail(params.get('error_description') || query.get('error_description') || 'Le fournisseur n’a pas autorisé la connexion. Réessayez.'); 
      return; 
    }

    const code = query.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error: exErr }) => {
        if (!exErr && data?.session?.user) {
          void complete(data.session.user);
        }
      }).catch(() => {});
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const timer = setTimeout(() => { timers.delete(timer); void complete(session.user); }, 0);
        timers.add(timer);
      }
    });

    supabase.auth.getSession().then(({ data, error: sessionErr }) => {
      if (sessionErr) fail('Le lien de connexion est invalide ou expiré.');
      else if (data?.session?.user) void complete(data.session.user);
    }).catch(() => fail('La connexion est indisponible. Réessayez.'));

    const timeout = setTimeout(() => { 
      if (!handling) {
        // As a final fallback, check if user session is already present in supabase auth
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user) void complete(data.user);
          else fail('Le lien de connexion est invalide ou expiré.');
        }).catch(() => fail('Le lien de connexion est invalide ou expiré.'));
      }
    }, 6000);
    return () => { disposed = true; clearTimeout(timeout); timers.forEach(clearTimeout); subscription.unsubscribe(); };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-white grid place-items-center px-6 font-display">
      <div className="text-center max-w-sm">
        {!error && <div className="w-10 h-10 border-4 border-orange-200 border-t-[#E8732A] rounded-full animate-spin mx-auto mb-4" />}
        <p role={error ? 'alert' : 'status'} className="text-gray-600 text-sm">{error || 'Connexion en cours…'}</p>
        {error && <Link className="inline-block mt-6 rounded-xl bg-orange-600 text-white px-5 py-3 font-bold" to="/connexion">Retour à la connexion</Link>}
      </div>
    </main>
  );
}
