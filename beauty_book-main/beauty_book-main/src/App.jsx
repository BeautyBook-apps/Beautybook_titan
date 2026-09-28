import { Toaster } from "@/components/ui/toaster"
import React, { useEffect, useState, useRef, Component, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from "framer-motion";

import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { entities } from '@/api/entities';
import { VoiceAgentProvider } from '@/lib/VoiceAgentContext';
import FloatingVoiceAgent from '@/components/voice/FloatingVoiceAgent';
import { LocaleProvider } from '@/lib/LocaleContext.jsx';
import { LocationProvider } from '@/contexts/LocationContext';
import { CallManager } from '@/components/call/CallManager';

// Appliquer la config apparence depuis la BDD au démarrage
entities.AppConfig.filter({ key: "appearance_config" }, "-created_at", 50).then(rows => {
  if (!rows[0]?.value) return;
  const { fontId, sizeId } = rows[0].value;
  const FONTS = {
    "plus-jakarta": { import: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap", css: "'Plus Jakarta Sans', sans-serif" },
    "inter": { import: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap", css: "'Inter', sans-serif" },
    "poppins": { import: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap", css: "'Poppins', sans-serif" },
    "nunito": { import: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap", css: "'Nunito', sans-serif" },
    "dm-sans": { import: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap", css: "'DM Sans', sans-serif" },
    "outfit": { import: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap", css: "'Outfit', sans-serif" },
  };
  const SIZES = { sm: 0.9, md: 1, lg: 1.1, xl: 1.2 };
  const font = FONTS[fontId];
  if (font) {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = font.import;
    document.head.appendChild(link);
    document.documentElement.style.setProperty("--font-display", font.css);
  }
  if (sizeId && SIZES[sizeId]) {
    document.documentElement.style.fontSize = `${SIZES[sizeId] * 16}px`;
  }
}).catch(() => {});
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppShell from '@/components/layout/AppShell';
import LoadingScreen from '@/components/layout/LoadingScreen';

function safeLazy(importFn) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      if (err?.message?.includes('dynamically imported module') || err?.message?.includes('Loading chunk') || err?.name === 'TypeError') {
        const key = 'chunk_reload_' + window.location.pathname;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw err;
    }
  });
}

const Home = safeLazy(() => import('@/pages/Home'));
const Services = safeLazy(() => import('@/pages/Services'));
const ServicesSalons = safeLazy(() => import('@/pages/ServicesSalons'));
const Boutique = safeLazy(() => import('@/pages/Boutique'));
const RendezVous = safeLazy(() => import('@/pages/RendezVous'));
const Profil = safeLazy(() => import('@/pages/Profil'));
const Maria = safeLazy(() => import('@/pages/Maria'));
const ProfilPro = safeLazy(() => import('@/pages/ProfilPro'));
const DevenirPro = safeLazy(() => import('@/pages/DevenirPro'));
const BeautyPay = safeLazy(() => import('@/pages/pro/BeautyPay'));
const PaiementFacturation = safeLazy(() => import('@/pages/pro/PaiementFacturation'));
const CatalogueServices = safeLazy(() => import('@/pages/pro/CatalogueServices'));
const AjouterService = safeLazy(() => import('@/pages/pro/AjouterService'));
const BundleDetail = safeLazy(() => import('@/pages/BundleDetail'));
const BundleGroupeDetail = safeLazy(() => import('@/pages/BundleGroupeDetail'));
const AvisClients = safeLazy(() => import('@/pages/pro/AvisClients.jsx'));
const Equipe = safeLazy(() => import('@/pages/pro/Equipe'));
const NouveauMembre = safeLazy(() => import('@/pages/pro/NouveauMembre'));
const PlanningMembre = safeLazy(() => import('@/pages/pro/PlanningMembre'));
const Analytics = safeLazy(() => import('@/pages/pro/Analytics'));
const Publication = safeLazy(() => import('@/pages/pro/Publication'));
const VeoGenerator = safeLazy(() => import('@/pages/pro/VeoGenerator'));
const Visite3D = safeLazy(() => import('@/pages/pro/Visite3D'));
const Franchise = safeLazy(() => import('@/pages/pro/Franchise'));
const LancerDirect = safeLazy(() => import('@/pages/pro/LancerDirect'));
const ModifierProfilPro = safeLazy(() => import('@/pages/pro/ModifierProfilPro'));
const AssistantConversationnel = safeLazy(() => import('@/pages/AssistantConversationnel'));
const MariaSite = safeLazy(() => import('@/pages/MariaSite'));
const VueClient = safeLazy(() => import('@/pages/pro/VueClient'));
const Abonnements = safeLazy(() => import('@/pages/pro/Abonnements'));
const AbonnementsClient = safeLazy(() => import('@/pages/AbonnementsClient'));
const GestionAgenda = safeLazy(() => import('@/pages/pro/GestionAgenda'));
const HorairesConges = safeLazy(() => import('@/pages/pro/HorairesConges'));
const LiveFeed = safeLazy(() => import('@/pages/LiveFeed'));
const LiveDetail = safeLazy(() => import('@/pages/LiveDetail'));
const Reels = safeLazy(() => import('@/pages/Reels'));
const Immobilier = safeLazy(() => import('@/pages/Immobilier'));
const ImmobilierDetail = safeLazy(() => import('@/pages/ImmobilierDetail'));
const ServiceDetail = safeLazy(() => import('@/pages/ServiceDetail'));
const StyleDetail = safeLazy(() => import('@/pages/StyleDetail'));
const ModifierProfilClient = safeLazy(() => import('@/pages/ModifierProfilClient'));
const Parametres = safeLazy(() => import('@/pages/Parametres'));
const MesCommandes = safeLazy(() => import('@/pages/MesCommandes'));
const CommandeDetail = safeLazy(() => import('@/pages/CommandeDetail'));
const MonSolde = safeLazy(() => import('@/pages/MonSolde'));
const ProgrammeFidelite = safeLazy(() => import('@/pages/ProgrammeFidelite'));
const Onboarding = safeLazy(() => import('@/pages/Onboarding'));
const Connexion = safeLazy(() => import('@/pages/Connexion'));
const Reservation = safeLazy(() => import('@/pages/Reservation'));
const Securite = safeLazy(() => import('@/pages/parametres/Securite'));
const MoyensPaiement = safeLazy(() => import('@/pages/parametres/MoyensPaiement'));
const Notifications = safeLazy(() => import('@/pages/parametres/Notifications'));
const LangueMonnaie = safeLazy(() => import('@/pages/parametres/LangueMonnaie'));
const CentreAide = safeLazy(() => import('@/pages/parametres/CentreAide'));
const Confidentialite = safeLazy(() => import('@/pages/parametres/Confidentialite'));
const Conditions = safeLazy(() => import('@/pages/parametres/Conditions'));
const Contactez = safeLazy(() => import('@/pages/parametres/Contactez'));
const APropos = safeLazy(() => import('@/pages/parametres/APropos'));
const ProduitDetail = safeLazy(() => import('@/pages/ProduitDetail'));
const Messages = safeLazy(() => import('@/pages/Messages'));
const NotificationsPage = safeLazy(() => import('@/pages/Notifications'));
const Panier = safeLazy(() => import('@/pages/Panier'));
const GestionStyles = safeLazy(() => import('@/pages/pro/GestionStyles'));
const ParametresPro = safeLazy(() => import('@/pages/pro/ParametresPro'));
const PromoService = safeLazy(() => import('@/pages/pro/PromoService'));
const ScanCapillaire = safeLazy(() => import('@/pages/ScanCapillaire'));
const ReceptionnistIA = safeLazy(() => import('@/pages/ReceptionnistIA'));
const AIScalingBusiness = safeLazy(() => import('@/pages/AIScalingBusiness'));
const Annonces = safeLazy(() => import('@/pages/Annonces'));
const AnnonceDetail = safeLazy(() => import('@/pages/AnnonceDetail'));
const NouvelleAnnonce = safeLazy(() => import('@/pages/NouvelleAnnonce'));
const AnnoncesDashboard = safeLazy(() => import('@/pages/pro/AnnoncesDashboard'));
const AnnonceProDetail = safeLazy(() => import('@/pages/pro/AnnonceProDetail'));
const OrderTracking = safeLazy(() => import('@/pages/OrderTracking'));
const Checkout = safeLazy(() => import('@/pages/Checkout'));
const SupprimerCompte = safeLazy(() => import('@/pages/SupprimerCompte'));
const MentionsLegales = safeLazy(() => import('@/pages/parametres/MentionsLegales'));
const PolitiqueConfidentialite = safeLazy(() => import('@/pages/parametres/PolitiqueConfidentialite'));
const MesDonnees = safeLazy(() => import('@/pages/parametres/MesDonnees'));
import CookieConsent from '@/components/CookieConsent';
const ShAI = safeLazy(() => import('@/pages/ShAI'));
const Explorer = safeLazy(() => import('@/pages/Explorer'));
const Recherche = safeLazy(() => import('@/pages/Recherche'));
const About = safeLazy(() => import('@/pages/About'));
const Contact = safeLazy(() => import('@/pages/Contact'));
const AuthCallback = safeLazy(() => import('@/pages/AuthCallback'));
const AdminDashboard = safeLazy(() => import('@/pages/admin/AdminDashboard'));
const AdminLogin = safeLazy(() => import('@/pages/admin/AdminLogin'));
const AdminSignup = safeLazy(() => import('@/pages/admin/AdminSignup'));
const VendeurDashboard = safeLazy(() => import('@/pages/VendeurDashboard'));
const VendeurLogin = safeLazy(() => import('@/pages/VendeurLogin'));
const VendeurSignup = safeLazy(() => import('@/pages/VendeurSignup'));
import AuthModal from '@/components/ui/AuthModal';

function ExternalApplication({ kind }) {
  const url = kind === 'admin' ? import.meta.env.VITE_ADMIN_URL : import.meta.env.VITE_SELLER_URL;
  const target = url || (import.meta.env.DEV ? 'http://localhost:' + (kind === 'admin' ? '5174' : '5175') : '');
  return <main className="min-h-screen grid place-items-center p-6"><div className="text-center"><h1 className="text-2xl font-bold">BeautyBook {kind === 'admin' ? 'Administration' : 'Vendeur'}</h1><p className="my-4">Votre espace dispose de son application dédiée.</p>{target ? <a className="inline-block rounded-xl bg-orange-600 px-5 py-3 text-white" href={target}>Ouvrir l’application</a> : <p>Contactez votre responsable pour obtenir l’adresse de connexion.</p>}</div></main>;
}
const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated, profile } = useAuth();
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem("bb_onboarded"));
  const [showGlobalAuthModal, setShowGlobalAuthModal] = useState(false);
  const location = useLocation();
  const wasAuthenticatedRef = useRef(isAuthenticated);
  const hasCheckedInitialAuth = useRef(false);

  const isSpecialRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/vendeur');
  const isAuthPage = location.pathname === '/connexion' || location.pathname === '/onboarding' || location.pathname.startsWith('/auth/callback');

  // Detect logout: transition from authenticated → not authenticated (skip first render)
  useEffect(() => {
    if (isLoadingAuth) return;

    if (wasAuthenticatedRef.current && !isAuthenticated) {
      setShowGlobalAuthModal(true);
    }

    if (isAuthenticated) {
      wasAuthenticatedRef.current = true;
      hasCheckedInitialAuth.current = true;
      setShowGlobalAuthModal(false);
    }
  }, [isAuthenticated, isLoadingAuth]);

  // Sync avec localStorage — AuthCallback peut setter bb_onboarded après le montage
  useEffect(() => {
    const check = () => {
      if (localStorage.getItem("bb_onboarded") && !onboarded) {
        setOnboarded(true);
      }
    };
    // Vérifier immédiatement
    check();
    // Écouter les changements de route (navigate déclenche popstate)
    window.addEventListener('popstate', check);
    // Poll léger au cas où
    const interval = setInterval(check, 500);
    return () => {
      window.removeEventListener('popstate', check);
      clearInterval(interval);
    };
  }, [onboarded]);

  // Redirections automatiques selon le port local
  useEffect(() => {
    const port = window.location.port;
    const path = window.location.pathname;
    if (port === '5174' && path === '/') {
      window.location.href = '/admin';
    } else if (port === '5175' && path === '/') {
      window.location.href = '/vendeur';
    }
  }, []);

  // Si l'utilisateur est authentifié mais pas onboardé, vérifier le profil automatiquement
  useEffect(() => {
    if (!isAuthenticated || isSpecialRoute || onboarded) return;

    const checkProfile = async () => {
      try {
        const { supabase } = await import('@/api/supabaseClient');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Chercher le profil par ID ou email
        let profile = null;
        const { data: byId } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (byId) { profile = byId; }
        else {
          const { data: byEmail } = await supabase.from('profiles').select('id').eq('email', user.email).maybeSingle();
          if (byEmail) { profile = byEmail; }
        }

        if (profile) {
          // Profil existant → marquer onboardé
          localStorage.setItem('bb_onboarded', '1');
          setOnboarded(true);
        }
        // Si pas de profil, laisse l'onboarding se faire
      } catch (e) {
        console.error('[App] Profile check error:', e);
      }
    };

    checkProfile();
  }, [isAuthenticated, profile, onboarded, isSpecialRoute]);

  // Afficher le loading UNIQUEMENT pour les routes normales (pas admin/vendeur)
  if (!isSpecialRoute && (isLoadingPublicSettings || isLoadingAuth)) {
    return <LoadingScreen message="Initialisation de votre espace..." />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  const hasOnboarded = onboarded || localStorage.getItem("bb_onboarded");
  const splashDone = sessionStorage.getItem("bb_splash_done") === "1";

  // A single route tree keeps deep links available to guests and signed-in users.
  if (!hasOnboarded && !splashDone && !isAuthenticated && location.pathname === '/') {
    return <Navigate to="/onboarding" replace />;
  }

  // Render the main app
  return (
    <>
      <AuthModal
        open={showGlobalAuthModal && !isAuthPage && !isSpecialRoute}
        onClose={() => setShowGlobalAuthModal(false)}
      />
      <Suspense fallback={<LoadingScreen message="Chargement des modules..." />}><Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/maria-site/:code" element={<MariaSite />} />
        <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services-salons" element={<ServicesSalons />} />
        <Route path="/boutique" element={<Boutique />} />
        <Route path="/rendez-vous" element={<RendezVous />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/maria" element={<Maria />} />
        <Route path="/profil-pro" element={<ProfilPro />} />
        <Route path="/devenir-pro" element={<DevenirPro />} />
        <Route path="/pro/beauty-pay" element={<BeautyPay />} />
        <Route path="/pro/paiement-facturation" element={<PaiementFacturation />} />
        <Route path="/pro/catalogue-services" element={<CatalogueServices />} />
        <Route path="/pro/ajouter-service" element={<AjouterService />} />
        <Route path="/bundle/:id" element={<BundleDetail />} />
        <Route path="/bundle-groupe/:id" element={<BundleGroupeDetail />} />
        <Route path="/pro/avis-clients" element={<AvisClients />} />
        <Route path="/pro/equipe" element={<Equipe />} />
        <Route path="/pro/planning-membre" element={<PlanningMembre />} />
        <Route path="/pro/nouveau-membre" element={<NouveauMembre />} />
        <Route path="/pro/analytics" element={<Analytics />} />
        <Route path="/pro/publication" element={<Publication />} />
        <Route path="/pro/veo-generator" element={<VeoGenerator />} />
        <Route path="/pro/visite-3d" element={<Visite3D />} />
        <Route path="/pro/franchise" element={<Franchise />} />
        <Route path="/pro/lancer-direct" element={<LancerDirect />} />
        <Route path="/pro/modifier-profil" element={<ModifierProfilPro />} />
        <Route path="/pro/vue-client" element={<VueClient />} />
        <Route path="/pro/abonnements" element={<Abonnements />} />
        <Route path="/abonnements" element={<AbonnementsClient />} />
        <Route path="/pro/gestion-agenda" element={<GestionAgenda />} />
        <Route path="/pro/horaires-conges" element={<HorairesConges />} />
        <Route path="/live" element={<LiveFeed />} />
        <Route path="/live-detail/:id" element={<LiveDetail />} />
        <Route path="/reels" element={<Reels />} />
        <Route path="/social-media" element={<AssistantConversationnel />} />
        <Route path="/reseau-social" element={<Reels />} />
        <Route path="/immobilier" element={<Immobilier />} />
        <Route path="/immobilier/:id" element={<ImmobilierDetail />} />
        <Route path="/service/:id" element={<ServiceDetail />} />
        <Route path="/style/:id" element={<StyleDetail />} />
        <Route path="/modifier-profil-client" element={<ModifierProfilClient />} />
        <Route path="/parametres" element={<Parametres />} />
        <Route path="/mes-commandes" element={<MesCommandes />} />
        <Route path="/commande/:id" element={<CommandeDetail />} />
        <Route path="/mon-solde" element={<MonSolde />} />
        <Route path="/programme-fidelite" element={<ProgrammeFidelite />} />
        <Route path="/reservation" element={<Reservation />} />
        <Route path="/parametres/securite" element={<Securite />} />
        <Route path="/parametres/paiement" element={<MoyensPaiement />} />
        <Route path="/parametres/notifications" element={<Notifications />} />
        <Route path="/parametres/langue" element={<LangueMonnaie />} />
        <Route path="/parametres/aide" element={<CentreAide />} />
        <Route path="/parametres/confidentialite" element={<Confidentialite />} />
        <Route path="/parametres/conditions" element={<Conditions />} />
        <Route path="/parametres/contact" element={<Contactez />} />
        <Route path="/parametres/a-propos" element={<APropos />} />
        <Route path="/parametres/mentions-legales" element={<MentionsLegales />} />
        <Route path="/parametres/politique-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/parametres/mes-donnees" element={<MesDonnees />} />
        <Route path="/produit" element={<ProduitDetail />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/panier" element={<Panier />} />
        <Route path="/pro/gestion-styles" element={<GestionStyles />} />
        <Route path="/pro/parametres" element={<ParametresPro />} />
        <Route path="/pro/promo-service/:id" element={<PromoService />} />
        <Route path="/scan-capillaire" element={<ScanCapillaire />} />
        <Route path="/order-tracking" element={<OrderTracking />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/supprimer-compte" element={<SupprimerCompte />} />
        <Route path="/sh-ai" element={<ShAI />} />
        <Route path="/receptionniste-ia" element={<ReceptionnistIA />} />
        <Route path="/pro/receptionniste-ia" element={<ReceptionnistIA />} />
        <Route path="/ai-scaling-business" element={<AIScalingBusiness />} />
        <Route path="/pro/ai-scaling-business" element={<AIScalingBusiness />} />
        <Route path="/pro/scaling-business" element={<AIScalingBusiness />} />
        <Route path="/annonces" element={<Annonces />} />
        <Route path="/annonces/nouvelle" element={<NouvelleAnnonce />} />
        <Route path="/annonces/:id" element={<AnnonceDetail />} />
        <Route path="/pro/annonces" element={<AnnoncesDashboard />} />
        <Route path="/pro/annonces/:id" element={<AnnonceProDetail />} />
        <Route path="/recherche" element={<Recherche />} />
        <Route path="/explorer" element={<Navigate to="/recherche" replace />} />
        <Route path="/recherche-approfondie" element={<Recherche />} />
        <Route path="/a-propos" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Route>
      <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Routes Vendeur */}
        <Route path="/vendeur" element={<VendeurLogin />} />
        <Route path="/vendeur/login" element={<VendeurLogin />} />
        <Route path="/vendeur/signup" element={<VendeurSignup />} />
        <Route path="/vendeur/dashboard/*" element={<VendeurDashboard />} />

        {/* Routes Administration */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/signup" element={<AdminSignup />} />
        <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
      </Routes></Suspense>
    </>
  );
};


function App() {
  return (
    <AppErrorBoundary>
    <AuthProvider>
      <LocationProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <LocaleProvider>
            <VoiceAgentProvider>
              <CallManager>
                <AuthenticatedApp />
                <CookieConsent />
              </CallManager>
              <FloatingVoiceAgent />
            </VoiceAgentProvider>
          </LocaleProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
      </LocationProvider>
    </AuthProvider>
    </AppErrorBoundary>
  )
}

class AppErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    const msg = error?.message || '';
    if (msg.includes('dynamically imported module') || msg.includes('Loading chunk')) {
      const key = 'chunk_err_reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error.message || '';
      const isChunkError = msg.includes('dynamically imported module') || msg.includes('Loading chunk');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, textAlign: 'center', fontFamily: 'system-ui' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>✨</p>
          <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            {isChunkError ? "Mise à jour disponible" : "Une erreur est survenue"}
          </p>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
            {isChunkError ? "Une nouvelle version de BeautyBook est disponible." : (msg || 'Erreur inconnue')}
          </p>
          <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{ background: '#FF6B00', color: '#fff', fontSize: 14, fontWeight: 800, padding: '12px 32px', borderRadius: 16, border: 'none', cursor: 'pointer' }}>
            {isChunkError ? "Mettre à jour maintenant" : "Réessayer"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default App
