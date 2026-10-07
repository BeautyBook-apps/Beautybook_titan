import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState({ id: 'beautybook', public_settings: {} });

  const activeUser = useRef(null);
  const profileRequest = useRef(0);

  const clearAllUserCaches = () => {
    try {
      const keysToRemove = [
        'bb_is_pro', 'bb_onboarded', 'pro_profile_cache', 'pro_stats_cache',
        'bb_switch_to', 'bb_liked_styles', 'bb_liked_services', 'bb_unliked_services',
        'bb_night_mode'
      ];
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // Remove any dynamic per-user cache keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('vueclient_cache_') || k.startsWith('bb_followed_') || k.startsWith('bb_subscribed_') || k.startsWith('chunk_reload_'))) {
          localStorage.removeItem(k);
        }
      }
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('bb_') || key.startsWith('chunk_reload_')) sessionStorage.removeItem(key);
      }
    } catch {}
  };

  const loadProfile = async (userId, email) => {
    const request = ++profileRequest.current;
    try {
      let profileData = null;
      if (userId) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (!error && data) profileData = data;
      }
      if (!profileData && email) {
        const { data, error } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
        if (!error && data) profileData = data;
      }
      if (request === profileRequest.current && (activeUser.current === userId || !activeUser.current)) {
        setProfile(profileData || null);
      }
      return profileData;
    } catch {
      if (request === profileRequest.current && (activeUser.current === userId || !activeUser.current)) {
        setProfile(null);
      }
      return null;
    }
  };

  useEffect(() => {
    let disposed = false;
    let eventReceived = false;
    // Supabase dispatches auth events under its session lock. Database calls run in a separate effect.
    const applySession = (session) => {
      if (disposed) return;
      const next = session?.user || null;
      if (activeUser.current !== next?.id) { 
        ++profileRequest.current; 
        setProfile(null); 
        // If switching from one user to another (or logging out), purge old user cache
        if (activeUser.current !== null && next?.id !== activeUser.current) {
          clearAllUserCaches();
        }
      }
      activeUser.current = next?.id || null;
      setUser(next); 
      setIsAuthenticated(Boolean(next));
      setAuthError(null); 
      setIsLoadingAuth(false); 
      setAuthChecked(true);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true; 
      applySession(session);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (disposed || eventReceived) return;
      if (error) throw error;
      applySession(data?.session);
    }).catch(() => {
      if (!disposed && !eventReceived) {
        applySession(null); 
        setAuthError({ type: 'session_unavailable', message: 'Session indisponible. Reconnectez-vous.' });
      }
    });
    return () => { disposed = true; activeUser.current = null; ++profileRequest.current; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { 
    if (user?.id || user?.email) {
      void loadProfile(user.id, user.email); 
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!user?.id || !user.email || !profile?.id || profile.email === user.email) return;
    void supabase.from('profiles').update({ email: user.email, updated_at: new Date().toISOString() }).eq('id', user.id);
  }, [user?.id, user?.email, profile?.id, profile?.email]);

  const logout = async (shouldRedirect = true) => {
    try { await supabase.auth.signOut(); } catch {}
    activeUser.current = null; 
    ++profileRequest.current;
    setUser(null); 
    setProfile(null); 
    setIsAuthenticated(false);
    clearAllUserCaches();
    if (shouldRedirect) window.location.href = '/';
  };

  const navigateToLogin = () => {
    window.location.href = '/connexion';
  };

  const refreshUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser(currentUser);
      await loadProfile(currentUser.id, currentUser.email);
    }
  };

  const enrichedUser = user ? {
    ...user,
    id: user.id,
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name || '',
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || '',
    cover_url: profile?.cover_url || user.user_metadata?.cover_url || '',
    role: profile?.role || 'user',
    maria_name: profile?.maria_name || '',
    maria_memory: profile?.maria_memory || {},
    name: profile?.full_name || user.user_metadata?.full_name || user.email,
    username: profile?.username || '',
    bio: profile?.bio || '',
  } : null;

  return (
    <AuthContext.Provider value={{
      user: enrichedUser,
      profile,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
