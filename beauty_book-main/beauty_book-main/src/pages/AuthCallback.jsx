import { readOAuthIntent, OAUTH_INTENT_KEY } from '@/lib/socialAuth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { createAuthFlows } from '@/lib/authFlows';

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
        const intent = readOAuthIntent(sessionStorage);
        sessionStorage.removeItem(OAUTH_INTENT_KEY);

        // Apple does not return a name through the regular OAuth flow. Keep
        // social signup inside the existing onboarding so the profile is
        // completed instead of silently creating an unnamed account.
        if (intent?.mode === 'signup') {
          const profile = await createAuthFlows(supabase).ensureProfile(user).catch(() => ({ id: user.id, email: user.email }));
          if (disposed) return;
          const fullName = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name;
          sessionStorage.setItem('bb_social_signup', '1');
          if (fullName) sessionStorage.removeItem('bb_social_name_required');
          else sessionStorage.setItem('bb_social_name_required', '1');
          localStorage.removeItem('bb_onboarded');
          navigate('/onboarding', { replace: true });
          return;
        }

        // Une fois le compte Google/Apple sélectionné, la session est active et validée.
        // La page d'accueil s'ouvre directement.
        sessionStorage.removeItem('bb_social_signup');
        sessionStorage.removeItem('bb_social_verify');
        sessionStorage.setItem('bb_splash_done', '1');
        localStorage.setItem('bb_onboarded', '1');
        navigate('/', { replace: true });

        // Do not block the home screen on profile synchronization. AuthContext
        // will load the profile again after the session is available.
        void createAuthFlows(supabase).ensureProfile(user).catch(() => {});
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
          else fail(query.has('code')
            ? 'Google a répondu, mais la session locale n’a pas pu être finalisée. Relancez la connexion depuis la même adresse locale.'
            : 'Le lien de connexion est invalide ou expiré.');
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
        <button
          type="button"
          onClick={() => navigate('/connexion', { replace: true })}
          aria-label="Retour à la connexion"
          className="inline-flex items-center gap-2 mt-6 rounded-xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Retour
        </button>
      </div>
    </main>
  );
}
