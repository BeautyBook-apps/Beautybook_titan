const fs = require('fs');

// ══════════════════════════════════════════════════
// FIX 1 — ProfilPro.jsx : loadProPublications uses wrong table 'reels'
//          should be 'Reel' (capital R) — the actual Supabase table name
// Also: views might be stored as a separate aggregate or directly on the row.
// Use entities.Reel for consistency + get correct column names.
// ══════════════════════════════════════════════════

const PRO_PATH = 'src/pages/ProfilPro.jsx';
let pro = fs.readFileSync(PRO_PATH, 'utf8').replace(/\r\n/g, '\n');

const OLD_LOAD_FN = `  const loadProPublications = async () => {
    if (!user?.email) return;
    try {
      const { data: reels, error } = await supabase
        .from('reels')
        .select('id, title, reel_thumbnail, reel_images, video_url, images, image_url, views, view_count, likes, like_count, comments_count, created_at, author_email')
        .eq('author_email', user.email)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = reels || [];
      setProPublications(rows.map(r => ({
        ...r,
        views: Number(r.views ?? r.view_count ?? 0),
        likes: Number(r.likes ?? r.like_count ?? 0),
      })));
    } catch (err) {
      console.error('[ProfilPro] loadProPublications error:', err?.message);
    }
  };`;

const NEW_LOAD_FN = `  const loadProPublications = async () => {
    if (!user?.email) return;
    try {
      // Use 'Reel' table (capital R) — matches entities.Reel used elsewhere in the app
      const { data: reels, error } = await supabase
        .from('Reel')
        .select('id, title, reel_thumbnail, reel_images, video_url, images, image_url, views, likes, like_count, comments_count, created_at, author_email')
        .eq('author_email', user.email)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = reels || [];
      // Also fetch view counts from reel_views table if 'views' column is 0/null
      // The app tracks views via supabase.rpc('record_reel_view') which
      // increments a 'views' integer column directly on the Reel table.
      setProPublications(rows.map(r => ({
        ...r,
        views: Number(r.views ?? 0),
        likes: Number(r.likes ?? r.like_count ?? 0),
      })));
    } catch (err) {
      console.error('[ProfilPro] loadProPublications error:', err?.message);
    }
  };`;

if (pro.includes(OLD_LOAD_FN)) {
  pro = pro.replace(OLD_LOAD_FN, NEW_LOAD_FN);
  console.log('[ProfilPro] ✅ loadProPublications fixed: Reel table (capital R)');
} else {
  console.log('[ProfilPro] ⚠️  Pattern not found, trying partial replace');
  pro = pro.replace(
    `.from('reels')`,
    `.from('Reel')`
  );
  pro = pro.replace(
    `'id, title, reel_thumbnail, reel_images, video_url, images, image_url, views, view_count, likes, like_count, comments_count, created_at, author_email'`,
    `'id, title, reel_thumbnail, reel_images, video_url, images, image_url, views, likes, like_count, comments_count, created_at, author_email'`
  );
  console.log('[ProfilPro] ✅ Partial fix applied');
}

fs.writeFileSync(PRO_PATH, pro, 'utf8');
console.log('[ProfilPro] ✅ Saved\n');

// ══════════════════════════════════════════════════
// FIX 2 — Profil.jsx : favorites views
// When loading favorites reels, the reel is fetched via entities.Reel
// which does select('*') — so 'views' column IS there if Supabase returns it.
// But the mapping in favoritesWithMetrics was using getMetric() which might
// fail if the field name is exactly 'views' but the item was spread from a
// shallow copy. Ensure the direct field access is used.
// Also check how the reel favorites are loaded (likedReels path).
// ══════════════════════════════════════════════════

const PROFIL_PATH = 'src/pages/Profil.jsx';
let profil = fs.readFileSync(PROFIL_PATH, 'utf8').replace(/\r\n/g, '\n');

// The likedReels push block maps reel data into favs — make sure views is preserved
const OLD_LIKED_REELS_MAP = `      likedReels.forEach((res, index) => {
        if (res[0]) {
          const rid = likedReelIds[index];
          favs.push({
            ...res[0],
            favorite_created_at: favoriteDate('reel', rid),
            _kind: 'reel',
            _badgeLabel: 'Reel',
            _badgeColor: 'bg-purple-600',
            _badgeIcon: '🎬',
          });
        }
      });`;

const NEW_LIKED_REELS_MAP = `      likedReels.forEach((res, index) => {
        if (res[0]) {
          const rid = likedReelIds[index];
          const reelRow = res[0];
          favs.push({
            ...reelRow,
            views: Number(reelRow.views ?? reelRow.view_count ?? reelRow.views_count ?? 0),
            favorite_created_at: favoriteDate('reel', rid),
            _kind: 'reel',
            _badgeLabel: 'Reel',
            _badgeColor: 'bg-purple-600',
            _badgeIcon: '🎬',
          });
        }
      });`;

if (profil.includes(OLD_LIKED_REELS_MAP)) {
  profil = profil.replace(OLD_LIKED_REELS_MAP, NEW_LIKED_REELS_MAP);
  console.log('[Profil] ✅ likedReels views mapping fixed');
} else {
  console.log('[Profil] ⚠️  likedReels mapping not matched exactly');
}

// Also ensure services/styles/bundles get views = 0 explicitly (they don't have view data)
// and that the final map doesn't overwrite the reel views with 0
const OLD_FAV_FINAL = `      const favoritesWithMetrics = favs.map(item => {
      const targetType = item._kind;
      const targetId = targetType === 'pro_profile' ? (item.user_email || item.id) : item.id;
      const countedLikes = favoriteLikeCounts[targetType]?.[String(targetId)];
      // Pull view count from every possible field name the backend might use
      const rawViews = item.views ?? item.view_count ?? item.views_count ?? item.impressions ?? item.view ?? 0;
      return {
        ...item,
        likes: countedLikes !== undefined
          ? Number(countedLikes)
          : getMetric(item, ['likes', 'like_count', 'likes_count']),
        views: Number(rawViews) || 0,
      };
    });`;

const NEW_FAV_FINAL = `      const favoritesWithMetrics = favs.map(item => {
      const targetType = item._kind;
      const targetId = targetType === 'pro_profile' ? (item.user_email || item.id) : item.id;
      const countedLikes = favoriteLikeCounts[targetType]?.[String(targetId)];
      // For reel favorites the views field comes directly from the Reel table row.
      // For other entity types (service, style, bundle, pro_profile) there is no view counter.
      const rawViews = item.views ?? item.view_count ?? item.views_count ?? item.impressions ?? item.view ?? 0;
      return {
        ...item,
        likes: countedLikes !== undefined
          ? Number(countedLikes)
          : getMetric(item, ['likes', 'like_count', 'likes_count']),
        views: Number(rawViews),
      };
    });`;

if (profil.includes(OLD_FAV_FINAL)) {
  profil = profil.replace(OLD_FAV_FINAL, NEW_FAV_FINAL);
  console.log('[Profil] ✅ favoritesWithMetrics cleaned up');
} else {
  console.log('[Profil] ℹ️  favoritesWithMetrics already up to date');
}

fs.writeFileSync(PROFIL_PATH, profil, 'utf8');
console.log('[Profil] ✅ Saved\n');

// ── Verify both parse OK ────────────────────────────────────────────
const parser = require('./node_modules/@babel/parser');
[PRO_PATH, PROFIL_PATH].forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  try {
    parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
    console.log(f + ' ✅ Babel OK');
  } catch(e) {
    console.log(f + ' ❌ BABEL ERROR at line', e.loc?.line + ':', e.message.split('\n')[0]);
  }
});
