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
    try {
      const { data, error } = await supabase.from('user_like')
        .select('target_id')
        .in('target_id', targetIds.map(String))
        .eq('target_type', targetType);
      if (!error && data) {
        data.forEach(row => {
          counts[row.target_id] = (counts[row.target_id] || 0) + 1;
        });
      }
    } catch (e) {
      console.error('[likesApi] getLikeCounts error:', e);
    }
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
      let query = supabase.from('user_like').select('target_id, target_type').eq('user_email', userEmail);
      if (targetType) query = query.eq('target_type', targetType);
      const { data } = await query;
      return data || [];
    } catch { return []; }
  },
};
