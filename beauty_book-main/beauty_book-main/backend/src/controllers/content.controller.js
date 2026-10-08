import { supabaseAdmin } from '../config/supabase.js';

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
