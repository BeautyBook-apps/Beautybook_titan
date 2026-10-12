/**
 * Client API Admin — entities.* utilise l’API administrative authentifiée.
 * Une opération échouée est remontée à l’interface, sans sauvegarde locale implicite.
 */

import { entities } from "@/api/entities";
import apiClient, { localAdminEnabled } from "@/lib/apiClient";
import { supabase } from "@/api/supabaseClient";

export function getToken() {
  return sessionStorage.getItem("bb_admin_token") || "";
}

export function setAdminToken(token) {
  sessionStorage.setItem("bb_admin_token", token);
}

export function clearAdminToken() {
  sessionStorage.removeItem("bb_admin_token");
  sessionStorage.removeItem("bb_admin_auth");
}

export const adminApi = {
  // Stats
  getStats: async () => {
    if (localAdminEnabled) return apiClient.get('/admin/stats');
    const [reels, services, commandes, reservations, lives, styles, users] = await Promise.all([
      entities.Reel.list("-created_at", 1000),
      entities.Service.list("-created_at", 1000),
      entities.Commande.list("-created_at", 1000),
      entities.Reservation.list("-created_at", 1000),
      entities.LiveSession.list("-created_at", 1000),
      entities.Style.list("-created_at", 1000),
      entities.User.list("-created_at", 1000),
    ]);
    return {
      reels: reels.length,
      reels_publie: reels.filter(r => r.status === "publie").length,
      services: services.length,
      commandes: commandes.length,
      commandes_pending: commandes.filter(c => c.status === "en_attente").length,
      reservations: reservations.length,
      reservations_pending: reservations.filter(r => r.status === "en_attente").length,
      users: users.length,
      lives_actifs: lives.filter(l => l.status === "live").length,
      styles: styles.length,
    };
  },

  // Users
  listUsers: () => entities.User.list("-created_at", 500),
  updateUserRole: (id, role) => entities.User.update(id, { role }),

  // Styles
  listStyles: () => entities.Style.list("-created_at", 500),
  toggleStyleStatus: async (id) => {
    const style = await entities.Style.get(id);
    const newStatus = style.status === "publie" ? "brouillon" : "publie";
    return entities.Style.update(id, { status: newStatus });
  },
  deleteStyle: (id) => entities.Style.delete(id),
  createStyle: (data) => entities.Style.create({ ...data, featured: false }),

  // Réels
  listReels: () => entities.Reel.list("-created_at", 500),
  toggleReelStatus: async (id) => {
    const reel = await entities.Reel.get(id);
    const newStatus = reel.status === "publie" ? "brouillon" : "publie";
    return entities.Reel.update(id, { status: newStatus });
  },
  deleteReel: (id) => entities.Reel.delete(id),

  // Lives
  listLives: () => entities.LiveSession.list("-created_at", 200),
  toggleLiveStatus: async (id) => {
    const live = await entities.LiveSession.get(id);
    const newStatus = live.status === "live" ? "ended" : "live";
    return entities.LiveSession.update(id, { status: newStatus });
  },
  deleteLive: (id) => entities.LiveSession.delete(id),

  // Services
  listServices: () => entities.Service.list("-created_at", 500),
  toggleServiceStatus: async (id) => {
    const service = await entities.Service.get(id);
    const newStatus = service.status === "actif" ? "pause" : "actif";
    return entities.Service.update(id, { status: newStatus });
  },

  // Commandes
  listCommandes: () => entities.Commande.list("-created_at", 500),
  updateCommandeStatus: (id, status) => entities.Commande.update(id, { status }),

  // Réservations
  listReservations: () => entities.Reservation.list("-created_at", 500),
  updateReservationStatus: async (id, status) => (await apiClient.put('/admin/reservations/'+id,{status})).reservation,

  // Annonces
  listAnnonces: () => entities.Annonce.list("-created_at", 200),
  listSubscriptions: () => entities.UserSubscription.list("-created_at", 1000),
  createAnnonce: (data) => entities.Annonce.create(data),
  updateAnnonce: (id, data) => entities.Annonce.update(id, data),
  toggleAnnonceStatus: async (id) => {
    const annonce = await entities.Annonce.get(id);
    const newStatus = annonce.status === "actif" ? "pause" : "actif";
    return entities.Annonce.update(id, { status: newStatus });
  },
  deleteAnnonce: (id) => entities.Annonce.delete(id),

  // Profils Pro
  listProfilsPro: () => entities.ProfilPro.list("-created_at", 500),
  verifyProfil: (id) => entities.ProfilPro.update(id, { verified: true }),
  suspendProfil: (id) => entities.ProfilPro.update(id, { verified: false, status: "pause" }),

  // Avis
  listAvis: () => entities.CommentaireStyle.list("-created_at", 500),
  deleteAvis: (id) => entities.CommentaireStyle.delete(id),

  // Notifications
  sendNotification: async ({ target, title, body, type, link }) => {
    if (target === "all") {
      const users = await entities.User.list("-created_at", 1000);
      if (users && users.length > 0) {
        await Promise.all(users.map(u =>
          entities.Notification.create({ user_email: u.email, title, message: body, type: type || "system", action_url: link, is_read: false })
        ));
        return { sent: users.length };
      }
      return { sent: 0 };
    } else {
      await entities.Notification.create({ user_email: target, title, message: body, type: type || "system", action_url: link, is_read: false });
      return { sent: 1 };
    }
  },

  // Publications
  listPublications: () => entities.Reel.list("-created_at", 500),
  deletePublication: (id) => entities.Reel.delete(id),
  togglePublicationStatus: async (id) => {
    const pub = await entities.Reel.get(id);
    const newStatus = pub.status === "publie" ? "brouillon" : "publie";
    return entities.Reel.update(id, { status: newStatus });
  },

  // Produits
  listProduits: () => entities.Produit.list("-created_at", 200),
  filterProduits: (filters, orderBy, limit) => entities.Produit.filter(filters, orderBy, limit),
  createProduit: (data) => entities.Produit.create(data),
  updateProduit: (id, data) => entities.Produit.update(id, data),
  deleteProduit: (id) => entities.Produit.delete(id),

  // AppConfig
  getConfig: (key) => entities.AppConfig.filter({ key }, "-created_at", 50),
  updateConfig: (id, data) => entities.AppConfig.update(id, data),
  createConfig: (data) => entities.AppConfig.create(data),

  // Immobilier
  listImmobilier: () => entities.ImmobilierListing.list("-created_at", 200),
  filterImmobilier: (filters, orderBy, limit) => entities.ImmobilierListing.filter(filters, orderBy, limit),
  createImmobilier: (data) => entities.ImmobilierListing.create(data),
  updateImmobilier: (id, data) => entities.ImmobilierListing.update(id, data),
  deleteImmobilier: (id) => entities.ImmobilierListing.delete(id),
  listVirtualTours: () => entities.VisiteVirtuelle.list("-created_at", 200),
  createVirtualTour: (data) => entities.VisiteVirtuelle.create(data),
  updateVirtualTour: (id, data) => entities.VisiteVirtuelle.update(id, data),

  // Messages
  filterMessages: (filters, orderBy, limit) => entities.MessageChat.filter(filters, orderBy, limit),
  updateMessage: (id, data) => entities.MessageChat.update(id, data),
  createMessage: (data) => entities.MessageChat.create(data),

  // Fidélité
  listPointsFidelite: () => entities.PointsFidelite.list("-created_at", 500),
  updatePointsFidelite: (id, data) => entities.PointsFidelite.update(id, data),
  listPointsFidelitePro: () => entities.PointsFidelitePro.list("-created_at", 500),
  updatePointsFidelitePro: (id, data) => entities.PointsFidelitePro.update(id, data),
};
