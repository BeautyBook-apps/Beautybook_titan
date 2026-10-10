import { supabaseAdmin } from '../config/supabase.js';
import pgClient from '../config/pg.js';

export const approvePro = async (req, res) => {
  try {
    const { action, demande_id, note } = req.body;
    
    if (!demande_id) return res.status(400).json({ error: 'demande_id requis' });

    // Fetch demande via SQL brut
    const { rows: demandeRows } = await pgClient.query(
      `SELECT * FROM "DemandeProV2" WHERE id = $1`, [demande_id]
    );
    const demande = demandeRows[0];
    if (!demande) return res.status(404).json({ error: 'Demande introuvable' });

    if (action === 'approuver') {
      const specialites = [...(demande.services || []), ...(demande.categories || [])];
      const galerieUrls = demande.portfolio || [];
      const ouverture = {
        days: demande.days || [],
        time_slots: demande.time_slots || [],
        commodites: demande.commodites || [],
      };

      // Auto-geocode address to lat/lng
      let latitude = null;
      let longitude = null;
      const fullAddr = [demande.address, demande.city].filter(Boolean).join(', ');
      if (fullAddr) {
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullAddr)}&format=json&limit=1&countrycodes=fr,be,ch`;
          const geoRes = await fetch(geoUrl, { headers: { "Accept-Language": "fr" } });
          const geoData = await geoRes.json();
          if (geoData.length > 0) {
            latitude = parseFloat(geoData[0].lat);
            longitude = parseFloat(geoData[0].lon);
          }
        } catch {}
      }

      const { rows: existingRows } = await pgClient.query(
        `SELECT id FROM "ProfilPro" WHERE user_email = $1 ORDER BY created_at DESC LIMIT 1`,
        [demande.user_email]
      );

      let profilId;
      if (existingRows.length > 0) {
        const { rows } = await pgClient.query(
          `UPDATE "ProfilPro" SET salon_name=$1, bio=$2, avatar_url=$3, cover_url=$4, phone=$5, specialites=$6, categorie=$7, abonnement=$8, status=$9, galerie_urls=$10, ouverture=$11, address=$12, city=$13, latitude=$14, longitude=$15 WHERE id=$16 RETURNING id`,
          [demande.salon_name, demande.bio, demande.salon_photo||'', demande.salon_photo||'', demande.phone||'', specialites, demande.categorie||'', 'free', 'actif', galerieUrls, ouverture, demande.address||'', demande.city||'', latitude, longitude, existingRows[0].id]
        );
        profilId = rows[0].id;
      } else {
        const { rows } = await pgClient.query(
          `INSERT INTO "ProfilPro" (user_email, salon_name, bio, avatar_url, cover_url, phone, specialites, categorie, abonnement, status, galerie_urls, ouverture, address, city, latitude, longitude)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
          [demande.user_email, demande.salon_name, demande.bio, demande.salon_photo||'', demande.salon_photo||'', demande.phone||'', specialites, demande.categorie||'', 'free', 'actif', galerieUrls, ouverture, demande.address||'', demande.city||'', latitude, longitude]
        );
        profilId = rows[0].id;
      }

      await pgClient.query(
        `UPDATE "DemandeProV2" SET statut = 'approuvee', admin_notes = $1 WHERE id = $2`,
        [note || '', demande_id]
      );

      await pgClient.query(
        `INSERT INTO "Notification" (user_email, title, message, type, action_url, is_read) VALUES ($1, $2, $3, 'system', '/profil-pro', false)`,
        [demande.user_email, 'Demande Pro approuvée', `Félicitations ! Votre compte professionnel "${demande.salon_name}" est maintenant actif sur BeautyBook.`]
      );

      // Migrate client role → vendeur
      await pgClient.query(
        `UPDATE profiles SET role = 'vendeur', updated_at = now() WHERE email = $1`,
        [demande.user_email]
      );

      return res.json({ success: true, profil_id: profilId });
    }

    if (action === 'refuser') {
      await pgClient.query(
        `UPDATE "DemandeProV2" SET statut = 'refusee', admin_notes = $1 WHERE id = $2`,
        [note || '', demande_id]
      );

      await pgClient.query(
        `INSERT INTO "Notification" (user_email, title, message, type, action_url, is_read) VALUES ($1, $2, $3, 'system', '/devenir-pro', false)`,
        [demande.user_email, 'Demande Pro refusée', note ? `Votre demande a été refusée. Motif : ${note}` : 'Votre demande pro a été refusée. Contactez le support pour plus d\'informations.']
      );

      return res.json({ success: true });
    }

    if (action === 'pieces_manquantes') {
      const { notification } = req.body;
      await pgClient.query(
        `UPDATE "DemandeProV2" SET admin_notes = $1 WHERE id = $2`,
        [note || '', demande_id]
      );

      if (notification) {
        await pgClient.query(
          `INSERT INTO "Notification" (user_email, title, message, type, is_read) VALUES ($1, $2, $3, $4, false)`,
          [notification.user_email, notification.title, notification.body, notification.type || 'system']
        );
      }

      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Action non reconnue' });
  } catch (error) {
    console.error('approvePro error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const adminCreateService = async (req, res) => {
  try {
    const { action, id, data } = req.body;

    // Assuming req.user is populated by auth middleware
    
    if (action === 'create') {
      const { data: service, error } = await supabaseAdmin
        .from('Service')
        .insert({
          ...data,
          pro_email: data.pro_email || req.user.email,
          status: 'actif',
        })
        .select()
        .single();
      if (error) throw error;
      return res.json({ service });
    }

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      await supabaseAdmin.from('Service').delete().eq('id', id);
      return res.json({ success: true });
    }

    if (action === 'toggle') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      const { data: existing, error: errGet } = await supabaseAdmin.from('Service').select('*').eq('id', id).single();
      if (errGet) throw errGet;
      
      const newStatus = existing.status === 'actif' ? 'inactif' : 'actif';
      const { data: updated, error: errUp } = await supabaseAdmin.from('Service').update({ status: newStatus }).eq('id', id).select().single();
      if (errUp) throw errUp;
      return res.json({ service: updated });
    }

    return res.status(400).json({ error: 'Action non reconnue' });
  } catch (error) {
    console.error('adminCreateService error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const manageStyle = async (req, res) => {
  try {
    const { action, id, data } = req.body;


    if (action === 'create') {
      const styleData = {
        ...data,
        pro_email: data.pro_email ? data.pro_email : req.user.email,
        status: data.status || 'publie',
        likes: data.likes ?? 0,
        views: data.views ?? 0,
        featured: data.featured ?? false,
      };
      const { data: styles, error } = await supabaseAdmin.from('Style').insert(styleData).select();
      if (error) throw error;
      return res.json({ style: styles?.[0] || null });
    }

    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      const { data: styles, error } = await supabaseAdmin.from('Style').update(data).eq('id', id).select();
      if (error) throw error;
      return res.json({ style: styles?.[0] || null });
    }

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      await supabaseAdmin.from('Style').delete().eq('id', id);
      return res.json({ success: true });
    }

    if (action === 'list') {
      const { data: styles, error } = await supabaseAdmin.from('Style').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return res.json({ styles });
    }

    return res.status(400).json({ error: 'Action non reconnue' });
  } catch (error) {
    console.error('manageStyle error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const manageAnnonce = async (req, res) => {
  try {
    const { action, id, data } = req.body;

    if (action === 'create') {
      const { data: annonce, error } = await supabaseAdmin
        .from('Annonce')
        .insert({
          ...data,
          status: data.status || 'actif',
          clicks: 0,
          impressions: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return res.json({ annonce });
    }

    if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      const { data: annonce, error } = await supabaseAdmin
        .from('Annonce')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ annonce });
    }

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'ID requis' });
      await supabaseAdmin.from('Annonce').delete().eq('id', id);
      return res.json({ success: true });
    }

    if (action === 'list') {
      const { data: annonces, error } = await supabaseAdmin
        .from('Annonce')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return res.json({ annonces });
    }

    return res.status(400).json({ error: 'Action non reconnue' });
  } catch (error) {
    console.error('manageAnnonce error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const adminApi = async (req, res) => {
  const expectedToken = process.env.ADMIN_SECRET_TOKEN;
  const { action, params = {} } = req.body;
  
  // Auth check is mostly handled by middleware, but we can double check token if action is login
  if (action === 'login') {
    const { token: loginToken } = params;
    if (loginToken && expectedToken && loginToken === expectedToken) {
      return res.json({ success: true, data: { token: expectedToken } });
    }
    return res.status(401).json({ success: false, error: 'Token invalide' });
  }

  try {
    let result;
    switch (action) {
      case "getStats": {
        const [
          { count: reelsCount },
          { count: reelsPublieCount },
          { count: servicesCount },
          { count: commandesCount },
          { count: commandesPendingCount },
          { count: reservationsCount },
          { count: reservationsPendingCount },
          { count: usersCount },
          { count: livesActifsCount },
          { count: stylesCount },
        ] = await Promise.all([
          supabaseAdmin.from('Reel').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('Reel').select('*', { count: 'exact', head: true }).eq('status', 'publie'),
          supabaseAdmin.from('Service').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('Commande').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('Commande').select('*', { count: 'exact', head: true }).eq('status', 'en_attente'),
          supabaseAdmin.from('Reservation').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('Reservation').select('*', { count: 'exact', head: true }).eq('status', 'en_attente'),
          supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('LiveSession').select('*', { count: 'exact', head: true }).eq('status', 'live'),
          supabaseAdmin.from('Style').select('*', { count: 'exact', head: true })
        ]);
        result = {
          reels: reelsCount || 0,
          reels_publie: reelsPublieCount || 0,
          services: servicesCount || 0,
          commandes: commandesCount || 0,
          commandes_pending: commandesPendingCount || 0,
          reservations: reservationsCount || 0,
          reservations_pending: reservationsPendingCount || 0,
          users: usersCount || 0,
          lives_actifs: livesActifsCount || 0,
          styles: stylesCount || 0,
        };
        break;
      }
      case "listUsers": {
        const { data } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "updateUserRole": {
        const { data } = await supabaseAdmin.from('profiles').update({ role: params.role }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "listStyles": {
        const { data } = await supabaseAdmin.from('Style').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "toggleStyleStatus": {
        const { data: style } = await supabaseAdmin.from('Style').select('*').eq('id', params.id).single();
        const newStatus = style.status === "publie" ? "brouillon" : "publie";
        const { data } = await supabaseAdmin.from('Style').update({ status: newStatus }).eq('id', params.id).select();
        result = data?.[0] || null;
        break;
      }
      case "deleteStyle": {
        await supabaseAdmin.from('Style').delete().eq('id', params.id);
        result = { success: true };
        break;
      }
      case "createStyle": {
        const { data } = await supabaseAdmin.from('Style').insert({ ...params.data, likes: 0, views: 0, featured: false }).select();
        result = data?.[0] || null;
        break;
      }
      case "listReels": {
        const { data } = await supabaseAdmin.from('Reel').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "toggleReelStatus": {
        const { data: reel } = await supabaseAdmin.from('Reel').select('*').eq('id', params.id).single();
        const newStatus = reel.status === "publie" ? "brouillon" : "publie";
        const { data } = await supabaseAdmin.from('Reel').update({ status: newStatus }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "deleteReel": {
        await supabaseAdmin.from('Reel').delete().eq('id', params.id);
        result = { success: true };
        break;
      }
      case "listLives": {
        const { data } = await supabaseAdmin.from('LiveSession').select('*').order('created_at', { ascending: false }).limit(200);
        result = data;
        break;
      }
      case "toggleLiveStatus": {
        const { data: live } = await supabaseAdmin.from('LiveSession').select('*').eq('id', params.id).single();
        const newStatus = live.status === "live" ? "ended" : "live";
        const { data } = await supabaseAdmin.from('LiveSession').update({ status: newStatus }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "deleteLive": {
        await supabaseAdmin.from('LiveSession').delete().eq('id', params.id);
        result = { success: true };
        break;
      }
      case "listServices": {
        const { data } = await supabaseAdmin.from('Service').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "toggleServiceStatus": {
        const { data: svc } = await supabaseAdmin.from('Service').select('*').eq('id', params.id).single();
        const newStatus = svc.status === "actif" ? "inactif" : "actif";
        const { data } = await supabaseAdmin.from('Service').update({ status: newStatus }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "listCommandes": {
        const { data } = await supabaseAdmin.from('Commande').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "updateCommandeStatus": {
        const { data } = await supabaseAdmin.from('Commande').update({ status: params.status }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "listReservations": {
        const { data } = await supabaseAdmin.from('Reservation').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "updateReservationStatus": {
        const { data } = await supabaseAdmin.from('Reservation').update({ status: params.status }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "listAnnonces": {
        const { data } = await supabaseAdmin.from('Annonce').select('*').order('created_at', { ascending: false }).limit(200);
        result = data;
        break;
      }
      case "createAnnonce": {
        const { data } = await supabaseAdmin.from('Annonce').insert({ ...params.data, clicks: 0, impressions: 0 }).select().single();
        result = data;
        break;
      }
      case "toggleAnnonceStatus": {
        const { data: annonce } = await supabaseAdmin.from('Annonce').select('*').eq('id', params.id).single();
        const newStatus = annonce.status === "actif" ? "pause" : "actif";
        const { data } = await supabaseAdmin.from('Annonce').update({ status: newStatus }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "deleteAnnonce": {
        await supabaseAdmin.from('Annonce').delete().eq('id', params.id);
        result = { success: true };
        break;
      }
      case "listProfilsPro": {
        const { data } = await supabaseAdmin.from('ProfilPro').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "verifyProfil": {
        const { rows } = await pgClient.query(
          `UPDATE "ProfilPro" SET status = 'actif' WHERE id = $1 RETURNING *`,
          [params.id]
        );
        result = rows[0] || null;
        break;
      }
      case "suspendProfil": {
        const { rows } = await pgClient.query(
          `UPDATE "ProfilPro" SET status = 'pause' WHERE id = $1 RETURNING *`,
          [params.id]
        );
        result = rows[0] || null;
        break;
      }
      case "listAvis": {
        const { data } = await supabaseAdmin.from('CommentaireStyle').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "deleteAvis": {
        await supabaseAdmin.from('CommentaireStyle').delete().eq('id', params.id);
        result = { success: true };
        break;
      }
      case "sendNotification": {
        const { target, title, body, type, link } = params;
        if (target === "all") {
          const { data: users } = await supabaseAdmin.from('profiles').select('email').limit(1000);
          const notifications = users.map(u => ({
            user_email: u.email, title, message: body, type: type || "system", action_url: link, is_read: false
          }));
          await supabaseAdmin.from('Notification').insert(notifications);
          result = { sent: users.length };
        } else {
          await supabaseAdmin.from('Notification').insert({
            user_email: target, title, message: body, type: type || "system", action_url: link, is_read: false
          });
          result = { sent: 1 };
        }
        break;
      }
      case "listPublications": {
        const { data } = await supabaseAdmin.from('Reel').select('*').order('created_at', { ascending: false }).limit(500);
        result = data;
        break;
      }
      case "deletePublication": {
        await supabaseAdmin.from('Reel').delete().eq('id', params.id);
        result = { success: true };
        break;
      }
      case "togglePublicationStatus": {
        const { data: pub } = await supabaseAdmin.from('Reel').select('*').eq('id', params.id).single();
        const newStatus = pub.status === "publie" ? "brouillon" : "publie";
        const { data } = await supabaseAdmin.from('Reel').update({ status: newStatus }).eq('id', params.id).select().single();
        result = data;
        break;
      }
      case "list_demandes": {
        const { rows } = await pgClient.query(
          'SELECT * FROM "DemandeProV2" ORDER BY created_at DESC LIMIT 500'
        );
        result = rows;
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error(`[AdminAPI] Error on action "${action}":`, error.message);
    return res.status(500).json({ error: error.message });
  }
};
