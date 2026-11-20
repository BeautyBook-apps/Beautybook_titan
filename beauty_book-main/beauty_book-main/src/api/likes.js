import { supabase } from '@/api/supabaseClient';

export const likesApi = {
  async addLike(userEmail, targetId, targetType = 'reel', userName = '', userAvatar = '') {
    const payload = {
      user_email: userEmail,
      target_id: String(targetId),
      target_type: targetType,
      user_name: userName || '',
      user_avatar: userAvatar || '',
    };
    const { error } = await supabase.from('user_like').upsert(payload, { onConflict: 'user_email,target_id,target_type' });
    if (error) {
      // Some deployed databases have the unique index but do not expose it
      // yet through PostgREST's schema cache. Treat an existing row as a
      // successful like, otherwise retry with a plain insert.
      const { data: existing, error: existingError } = await supabase.from('user_like')
        .select('id')
        .eq('user_email', userEmail)
        .eq('target_id', String(targetId))
        .eq('target_type', targetType)
        .maybeSingle();
      if (existingError) throw error;
      if (!existing) {
        const { error: insertError } = await supabase.from('user_like').insert(payload);
        if (insertError) throw insertError;
      }
    }
    return { success: true };
  },

  async removeLike(userEmail, targetId, targetType = 'reel') {
    const { error } = await supabase.from('user_like')
      .delete()
      .eq('user_email', userEmail)
      .eq('target_id', String(targetId))
      .eq('target_type', targetType);
    if (error) throw error;
    return { success: true };
  },

  async getLikeCounts(targetIds, targetType = 'reel') {
    if (!targetIds || targetIds.length === 0) return {};
    const counts = {};
    targetIds.forEach(id => { counts[String(id)] = 0; });
    const typeAliases = targetType === 'product' ? ['product', 'produit']
      : targetType === 'reel' ? ['reel', 'publication']
      : [targetType];
    // user_like est la table canonique (la table legacy "Like" n'est pas
    // déployée sur toutes les bases Supabase et générait des 404 à chaque
    // chargement de profil, quel que soit le type de contenu).
    const { data, error } = await supabase.from('user_like')
      .select('id,user_email,target_id')
      .in('target_id', targetIds.map(String))
      .in('target_type', typeAliases);
    if (error || !data) return counts;

    const seen = new Set();
    data.forEach(row => {
      const id = String(row.target_id);
      if (!(id in counts)) return;
      const uniqueLike = `${id}:${String(row.user_email || row.id || '')}`;
      if (seen.has(uniqueLike)) return;
      seen.add(uniqueLike);
      counts[id] += 1;
    });
    return counts;
  },

  async getUserLikes(userEmail, targetIds, targetType = 'reel') {
    if (!userEmail || !targetIds || targetIds.length === 0) return [];
    try {
      const { data } = await supabase.from('user_like')
        .select('target_id')
        .eq('user_email', userEmail)
        .in('target_id', targetIds.map(String))
        .eq('target_type', targetType);
      return data || [];
    } catch { return []; }
  },

  async getUserLikesAll(userEmail, targetType) {
    if (!userEmail) return [];
    try {
      let query = supabase.from('user_like').select('target_id, target_type, created_at').eq('user_email', userEmail);
      if (targetType) query = query.eq('target_type', targetType);
      const result = await query;
      if (!result.error) return result.data || [];
      // Compatibilité avec les anciennes tables user_like qui n'avaient pas
      // encore la colonne created_at.
      let fallback = supabase.from('user_like').select('target_id, target_type').eq('user_email', userEmail);
      if (targetType) fallback = fallback.eq('target_type', targetType);
      const { data } = await fallback;
      return data || [];
    } catch { return []; }
  },
};
