import { supabase } from '../api/supabaseClient';
import { clientSendVerificationCode, clientVerifyCode } from './clientOtp';
import { requestApi, apiUrl } from './apiTransport';
import { requestImageJob } from './imageJobsClient';

export const apiClient = {
  async fetch(endpoint, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(options.headers);
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    return globalThis.fetch(apiUrl(endpoint, import.meta.env.VITE_BACKEND_URL || ''), { ...options, headers, signal: options.signal || AbortSignal.timeout(60000) });
  },
  async request(endpoint, options = {}) {
    return requestApi(endpoint, options, {
      baseUrl: import.meta.env.VITE_BACKEND_URL || '',
      getSession: async () => (await supabase.auth.getSession()).data.session,
      refreshSession: async () => (await supabase.auth.refreshSession()).data.session,
    });
  },
  get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
  post(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
  async callFunction(functionName, payload = {}, requestOptions = {}) {
    if(['shAiTryOn','simulateHairstyle'].includes(functionName))return {data:await requestImageJob(this.request.bind(this),functionName==='simulateHairstyle'?{...payload,mode:'hair'}:payload,requestOptions)};
    if (functionName === 'sendVerificationCode') {
      if (payload.mode === 'phone') throw new Error('La vérification par SMS n’est pas configurée.');
      return { data: await clientSendVerificationCode(payload.email) };
    }
    if (functionName === 'verifyCode') {
      const result = await clientVerifyCode(payload.key, payload.code);
      if (!result.valid) throw new Error(result.error);
      return { data: { success: true } };
    }
    const endpointMap = {
      // ----- Admin & Management (Phase 3) -----
      approvePro: { path: '/admin/approve-pro', method: 'POST' },
      adminCreateService: { path: '/admin/create-service', method: 'POST' },
      manageStyle: { path: '/admin/manage-style', method: 'POST' },
      manageReel: { path: '/v8/manage/reel', method: 'POST' },
      manageAnnonce: { path: '/admin/annonce', method: 'POST' },
      adminApi: { path: '/admin/api', method: 'POST' },
      deleteAccount: { path: '/account/delete', method: 'POST' },
      addFidelitePoints: { path: '/account/fidelite/add', method: 'POST' },
      creditFideliteAuto: { path: '/account/fidelite/auto', method: 'POST' },
      sendVerificationCode: { path: '/auth/send-verification-code', method: 'POST' },
      verifyCode: { path: '/auth/verify-code', method: 'POST' },
      adminLogin: { path: '/auth/admin/login', method: 'POST' },
      adminRegister: { path: '/auth/admin/register', method: 'POST' },
      vendeurLogin: { path: '/auth/vendeur/login', method: 'POST' },
      vendeurRegister: { path: '/auth/vendeur/register', method: 'POST' },
      placesAutocomplete: { path: '/maps/places-autocomplete', method: 'POST' },
      geocode: { path: '/maps/geocode', method: 'POST' },

      // --- Sellers / Pro (Phase 3) ---
      getProfilPro: { path: '/pro/profile/get', method: 'POST' },
      updateProfilPro: { path: '/pro/profile/update', method: 'POST' },

      // --- Reservations ---
      createReservation:           { path: '/reservations',          method: 'POST' },
      completeReservation:         { path: '/reservations/complete', method: 'POST' },
      getReservations:             { path: '/reservations/list',     method: 'POST' },
      updateReservation:           { path: `/reservations/${payload?.reservationId || ''}`, method: 'PUT' },
      sendReservationReminders:    { path: '/reservations/reminders',method: 'POST' },

      // --- Payments / Commerce ---
      createCheckoutSession:       { path: '/payments/checkout-session',      method: 'POST' },
      createSubscriptionCheckout:  { path: '/payments/subscription-checkout', method: 'POST' },
      createSetupIntent:           { path: '/payments/setup-intent',          method: 'POST' },
      getPaymentMethods:           { path: '/payments/payment-methods',       method: 'GET'  },
      deletePaymentMethod:         { path: '/payments/payment-methods',       method: 'DELETE' },
      setDefaultPaymentMethod:     { path: '/payments/payment-methods',       method: 'POST'  },
      chargeSavedCard:             { path: '/payments/charge-saved',          method: 'POST' },
      createCommande:              { path: '/commandes',                       method: 'POST' },
      getCommandes:                { path: '/commandes/list',                  method: 'POST' },
      trackOrder:                  { path: '/commandes/track',                 method: 'POST' },

      // --- Cart ---
      getPanier:                   { path: '/cart', method: 'GET'  },
      updatePanier:                { path: '/cart', method: 'POST' },

      // --- Feed & Social (Phase 5) ---
      getHomeData: { path: '/feed/home', method: 'POST' },
      getReels: { path: '/feed/reels', method: 'POST' },
      likeReel: { path: '/feed/reels/like', method: 'POST' },
      searchMusic: { path: '/feed/music/search', method: 'POST' },
      
      // --- Content & Catalog (Phase 5) ---
      getStyles: { path: '/content/styles', method: 'POST' },
      getAnnonces: { path: '/content/annonces', method: 'POST' },
      getProduits: { path: '/content/produits', method: 'POST' },
      getImmobilier: { path: '/content/immobilier', method: 'POST' },

      // --- Communication (Phase 6) ---
      getMessages: { path: '/communication/messages/get', method: 'POST' },
      sendMessage: { path: '/communication/messages/send', method: 'POST' },
      getNotifications: { path: '/communication/notifications/get', method: 'POST' },
      markNotificationsRead: { path: '/communication/notifications/mark-read', method: 'POST' },

      // --- AI (routed via _callMariaAI above) ---
      mariaAgent: { path: '/api/ai/maria', method: 'POST' },

      stripeWebhook: { path: '/webhooks/stripe', method: 'POST' },
      shopifyProducts: { path: '/webhooks/shopify', method: 'POST' },
      muxLive: { path: '/webhooks/mux-live', method: 'POST' },

      // --- Phase 8 ---
      addFidelitePoints:          { path: '/v8/fidelite/add', method: 'POST' },
      creditFideliteAuto:         { path: '/v8/fidelite/auto-credit', method: 'POST' },
      createShopifyCheckout:      { path: '/v8/boutique/shopify-checkout', method: 'POST' },
      createSubscriptionCheckout: { path: '/v8/subscription/checkout', method: 'POST' },
      manageAnnonce:              { path: '/v8/manage/annonce', method: 'POST' },
      manageStyle:                { path: '/v8/manage/style', method: 'POST' },
      manageEntity:               { path: '/v8/manage/entity', method: 'POST' },
      deleteAccount:              { path: '/v8/account', method: 'DELETE' },
    };
    Object.assign(endpointMap, {
      analyzePhoto: { path: '/api/ai/analyze-photo', method: 'POST' },
      simulateHairstyle: { path: '/api/ai/simulate-hairstyle', method: 'POST' },
      shAiTryOn: { path: '/api/ai/try-on', method: 'POST' },
      shAiImageSearch: { path: '/api/ai/image-search', method: 'POST' },
      mariaAutoReply: { path: '/api/ai/maria', method: 'POST' },
      deleteAccount: { path: '/api/account/delete', method: 'POST' },
    });
    const route = endpointMap[functionName];
    if (!route) throw new Error(`La fonction ${functionName} n’est pas disponible.`);
    const options = { method: route.method };
    let path = route.path;
    if (route.method === 'GET') {
      const query = new URLSearchParams(payload).toString();
      if (query) path += '?' + query;
    } else options.body = JSON.stringify(payload);
    if (functionName === 'createReservation') {
      options.headers = { 'Idempotency-Key': payload.idempotency_key || crypto.randomUUID() };
    }
    return { data: await this.request(path, options) };
  },
};
export default apiClient;
