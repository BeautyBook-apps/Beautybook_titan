import { supabaseAdmin } from '../config/supabase.js';

const engagementColumns = new Set(['views', 'shares']);

async function readStyleCounters(styleIds) {
  const selections = ['id,views,shares', 'id,views', 'id'];
  let result;
  for (const selection of selections) {
    result = await supabaseAdmin.from('Style').select(selection).in('id', styleIds);
    if (!result.error) return result;
    // Supabase rejects the whole select when an additive column is missing
    // from its schema cache. Retry with a smaller compatible projection.
    if (!/shares|views|column|schema cache|does not exist/i.test(result.error.message || '')) break;
  }
  return result;
}

export const getStyleEngagementStats = async (req, res) => {
  const styleIds = Array.isArray(req.body?.styleIds)
    ? [...new Set(req.body.styleIds.map(id => String(id).trim()).filter(Boolean))].slice(0, 500)
    : [];
  if (!styleIds.length) return res.json({ stats: {} });

  // Each read is isolated: a missing legacy table, column, or Supabase
  // configuration must not turn a read-only feed request into HTTP 500.
  let styles = [];
  let styleError = null;
  let likeRows = [];
  let likesError = null;
  try {
    const result = await readStyleCounters(styleIds);
    styles = result?.data || [];
    styleError = result?.error || null;
  } catch (error) {
    styleError = error;
  }
  try {
    const result = await supabaseAdmin.from('user_like')
      .select('target_id').eq('target_type', 'style').in('target_id', styleIds);
    likeRows = result?.data || [];
    likesError = result?.error || null;
  } catch (error) {
    likesError = error;
  }
  if (styleError) console.warn('getStyleEngagementStats styles unavailable:', styleError.message || styleError);
  if (likesError) console.warn('getStyleEngagementStats likes unavailable:', likesError.message || likesError);

  const stats = Object.fromEntries(styleIds.map(id => [id, { likes: 0, views: 0, shares: 0 }]));
  (styles || []).forEach(style => {
      const id = String(style.id);
      if (stats[id]) {
        stats[id].views = Number(style.views || 0);
        stats[id].shares = Number(style.shares || 0);
      }
  });
  (likeRows || []).forEach(row => {
    const id = String(row.target_id);
    if (stats[id]) stats[id].likes += 1;
  });
  // Always return a usable response. The client can keep the counters already
  // present on each Style row when a legacy source is unavailable.
  return res.json({ stats, partial: Boolean(styleError || likesError) });
};

// Engagement counters are updated server-side so clients cannot overwrite
// another style's metrics through the regular CRUD API.
export const trackStyleEngagement = async (req, res) => {
  const { styleId, kind } = req.body || {};
  if (typeof styleId !== 'string' || !styleId.trim() || !engagementColumns.has(kind)) {
    return res.status(400).json({ error: 'styleId et kind sont requis.' });
  }

  try {
    const column = kind;
    const { data: style, error: readError } = await supabaseAdmin
      .from('Style')
      .select(`id,${column}`)
      .eq('id', styleId.trim())
      .maybeSingle();
    if (readError) throw readError;
    if (!style) return res.status(404).json({ error: 'Style introuvable.' });

    const nextValue = Number(style[column] || 0) + 1;
    const { error: updateError } = await supabaseAdmin
      .from('Style')
      .update({ [column]: nextValue })
      .eq('id', styleId.trim());
    if (updateError) throw updateError;

    return res.json({ tracked: true, styleId: style.id, kind, value: nextValue });
  } catch (error) {
    // A deployment without the engagement migration must not break the feed.
    console.error('trackStyleEngagement error:', error.message);
    return res.status(200).json({ tracked: false });
  }
};

export const setStyleLike = async (req, res) => {
  const styleId = typeof req.body?.styleId === 'string' ? req.body.styleId.trim() : '';
  const userEmail = String(req.user?.email || '').trim();
  const liked = req.body?.liked !== false;
  if (!styleId || !userEmail) return res.status(400).json({ error: 'styleId et utilisateur requis.' });

  try {
    const { data: style, error: styleError } = await supabaseAdmin
      .from('Style').select('id').eq('id', styleId).maybeSingle();
    if (styleError) throw styleError;
    if (!style) return res.status(404).json({ error: 'Style introuvable.' });

    if (liked) {
      const { error } = await supabaseAdmin.from('user_like').upsert({
        user_email: userEmail,
        target_id: styleId,
        target_type: 'style',
        user_name: req.user?.user_metadata?.full_name || '',
        user_avatar: req.user?.user_metadata?.avatar_url || '',
      }, { onConflict: 'user_email,target_id,target_type', ignoreDuplicates: true });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('user_like')
        .delete().eq('user_email', userEmail).eq('target_id', styleId).eq('target_type', 'style');
      if (error) throw error;
    }

    const { data: likeRows, error: countError } = await supabaseAdmin
      .from('user_like').select('id').eq('target_id', styleId).eq('target_type', 'style');
    if (countError) throw countError;
    const count = likeRows?.length || 0;
    // Keep the denormalized Style counter synchronized as well. The feed can
    // still render from user_like when the aggregate endpoint is unavailable,
    // while older clients reading Style.likes continue to receive the real
    // value after a like/unlike action.
    const { error: counterError } = await supabaseAdmin
      .from('Style').update({ likes: count }).eq('id', styleId);
    if (counterError && !/likes|column|schema cache|does not exist/i.test(counterError.message || '')) {
      throw counterError;
    }
    return res.json({ liked, count });
  } catch (error) {
    console.error('setStyleLike error:', error.message);
    return res.status(500).json({ error: 'Le like n’a pas pu être enregistré.' });
  }
};

// getStyles
export const getStyles = async (req, res) => {
  try {
    const { category, limit = 20 } = req.body;

    let query = supabaseAdmin.from('Style').select('*').eq('status', 'publie');
    
    if (category && category !== "Tout") {
      query = query.eq('category', category);
    }
    
    const { data: styles, error } = await query.order('likes', { ascending: false }).limit(limit);

    if (error) throw error;

    return res.json({ styles: styles || [] });
  } catch (error) {
    console.error('getStyles error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// getAnnonces
export const getAnnonces = async (req, res) => {
  try {
    const { type = "feed" } = req.body;

    const { data: annonces, error } = await supabaseAdmin.from('Annonce')
      .select('*')
      .eq('status', 'actif')
      .eq('type', type)
      .order('created_date', { ascending: false })
      .limit(5);

    if (error) throw error;

    // Track impressions asynchronously
    if (annonces && annonces.length > 0) {
      Promise.all(annonces.map(a => 
        supabaseAdmin.from('Annonce').update({ impressions: (a.impressions || 0) + 1 }).eq('id', a.id)
      )).catch(err => console.error("Error tracking impressions", err));
    }

    return res.json({ annonces: annonces || [] });
  } catch (error) {
    console.error('getAnnonces error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// getProduits
export const getProduits = async (req, res) => {
  try {
    const { produitId, category, featured } = req.body;

    if (produitId) {
      const { data: produit, error } = await supabaseAdmin.from('Produit').select('*').eq('id', produitId).single();
      if (error || !produit) return res.status(404).json({ error: "Produit introuvable" });
      return res.json({ produit });
    }

    let query = supabaseAdmin.from('Produit').select('*').eq('status', 'actif');
    
    if (category && category !== "Tout") {
      query = query.eq('category', category);
    }
    if (featured) {
      query = query.eq('featured', true);
    }

    const { data: produits, error } = await query.order('created_date', { ascending: false }).limit(50);
    
    if (error) throw error;

    return res.json({ produits: produits || [] });
  } catch (error) {
    console.error('getProduits error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// getImmobilier
export const getImmobilier = async (req, res) => {
  try {
    const { type, listingId } = req.body;

    if (listingId) {
      const { data: listing, error } = await supabaseAdmin.from('ImmobilierListing').select('*').eq('id', listingId).single();
      if (error || !listing) return res.status(404).json({ error: "Annonce immobilière introuvable" });
      return res.json({ listing });
    }

    let query = supabaseAdmin.from('ImmobilierListing').select('*').eq('status', 'actif');
    
    if (type) {
      query = query.eq('type', type);
    }

    const { data: listings, error } = await query.order('created_at', { ascending: false }).limit(50);
    
    if (error) throw error;

    return res.json({ listings: listings || [] });
  } catch (error) {
    console.error('getImmobilier error:', error);
    return res.status(500).json({ error: error.message });
  }
};
