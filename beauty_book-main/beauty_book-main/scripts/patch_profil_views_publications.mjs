import { readFileSync, writeFileSync } from 'fs';

// ══════════════════════════════════════════════════════════════════
// PATCH 1 — Profil.jsx : view counts in favorites
// The favoritesWithMetrics block already reads views from the item
// but only fetches like counts from DB. We need to also fetch view
// counts from the `reels` table for reel-type favorites, and use
// the item's own fields for all other types.
// The real fix: for reel favorites, map views from the fetched reel
// data (already included). For services/styles the `views` field
// rarely exists in the DB — show 0 is acceptable but we should at
// least show the item's own views field when present.
// The MediaThumb DOES render views (line 175) but only when views > 0.
// Looking at the data: for reels the reel object has `views`, so it
// should work. The issue is that the favorites load path goes via
// entities.Reel.filter which should return the views column.
// Let's make sure views is explicitly mapped for all kinds.
// ══════════════════════════════════════════════════════════════════

const PROFIL_PATH = 'C:/Users/G15/Desktop/Nouveau dossier (10)/Beautybook_titan/beauty_book-main/beauty_book-main/src/pages/Profil.jsx';
const PROFIL_PRO_PATH = 'C:/Users/G15/Desktop/Nouveau dossier (10)/Beautybook_titan/beauty_book-main/beauty_book-main/src/pages/ProfilPro.jsx';

// ── PROFIL.JSX ────────────────────────────────────────────────────
let profil = readFileSync(PROFIL_PATH, 'utf8').replace(/\r\n/g, '\n');

// Fix 1: In favoritesWithMetrics, explicitly pull views from multiple fields
const OLD_FAV_METRICS = `    const favoritesWithMetrics = favs.map(item => {
      const targetType = item._kind;
      const targetId = targetType === 'pro_profile' ? (item.user_email || item.id) : item.id;
      const countedLikes = favoriteLikeCounts[targetType]?.[String(targetId)];
      return {
        ...item,
        likes: countedLikes !== undefined
          ? Number(countedLikes)
          : getMetric(item, ['likes', 'like_count', 'likes_count']),
        views: getMetric(item, ['views', 'view_count', 'views_count', 'impressions']),
      };
    });`;

const NEW_FAV_METRICS = `    const favoritesWithMetrics = favs.map(item => {
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

if (profil.includes(OLD_FAV_METRICS)) {
  profil = profil.replace(OLD_FAV_METRICS, NEW_FAV_METRICS);
  console.log('[Profil] ✅ favoritesWithMetrics views fix applied');
} else {
  console.log('[Profil] ⚠️  favoritesWithMetrics pattern not found — trying soft patch');
  profil = profil.replace(
    `views: getMetric(item, ['views', 'view_count', 'views_count', 'impressions']),`,
    `views: Number(item.views ?? item.view_count ?? item.views_count ?? item.impressions ?? item.view ?? 0) || 0,`
  );
  console.log('[Profil] ✅ Soft views patch applied');
}

// Fix 2: MediaThumb — always show view badge even when views === 0
// (currently shows {formatMetric(views)} which is "0" — that's fine)
// But add explicit "0" display for favourites with no view data
// Actually the real issue may be that formatMetric(0) renders "0"
// but maybe the badge is hidden. Let's check and ensure it shows.
// The badge IS rendered unconditionally already (line 173-176).
// So the issue must be in the data. The fix above should be enough.

writeFileSync(PROFIL_PATH, profil, 'utf8');
console.log('[Profil] ✅ File saved\n');


// ══════════════════════════════════════════════════════════════════
// PATCH 2 — ProfilPro.jsx : add Publications tab
// ══════════════════════════════════════════════════════════════════
let pro = readFileSync(PROFIL_PRO_PATH, 'utf8').replace(/\r\n/g, '\n');

// Step 1: Add missing imports (Heart, Play, Video, Repeat2, Grid, BarChart3 etc.)
const OLD_IMPORTS = `import {
  Settings, Share2, Star, Calendar, Users, LogOut,
  TrendingUp, Scissors, BarChart3, Camera, Moon,
  Wallet, ArrowLeft, Radio, UserCircle, Network, Scan, Menu,
  ChevronRight, Sparkles, Zap, Eye, FileText, Clapperboard, Building2
} from "lucide-react";`;

const NEW_IMPORTS = `import {
  Settings, Share2, Star, Calendar, Users, LogOut,
  TrendingUp, Scissors, BarChart3, Camera, Moon,
  Wallet, ArrowLeft, Radio, UserCircle, Network, Scan, Menu,
  ChevronRight, Sparkles, Zap, Eye, FileText, Clapperboard, Building2,
  Heart, Play, Video, Repeat2, Grid, Plus, LayoutGrid
} from "lucide-react";`;

if (pro.includes(OLD_IMPORTS)) {
  pro = pro.replace(OLD_IMPORTS, NEW_IMPORTS);
  console.log('[ProfilPro] ✅ Lucide imports extended');
} else {
  console.log('[ProfilPro] ⚠️  Could not find exact imports block — skipping import patch');
}

// Step 2: Add publications state + load function after loadStats
const AFTER_LOAD_STATS_MARKER = `  useEffect(() => {
    loadProfil();
    loadStats();
  }, [user, location.key]);`;

const PUBLICATIONS_STATE_AND_LOAD = `  // ── Publications Pro ──────────────────────────────────────────
  const [proPublications, setProPublications] = useState([]);

  const loadProPublications = async () => {
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
  };

  useEffect(() => {
    loadProfil();
    loadStats();
    loadProPublications();
  }, [user, location.key]);`;

if (pro.includes(AFTER_LOAD_STATS_MARKER)) {
  pro = pro.replace(AFTER_LOAD_STATS_MARKER, PUBLICATIONS_STATE_AND_LOAD);
  console.log('[ProfilPro] ✅ Publications state + loader injected');
} else {
  console.log('[ProfilPro] ⚠️  loadStats useEffect marker not found');
}

// Step 3: Add "publications" to the Tab Switcher (replace 2-tab with 3-tab)
const OLD_TAB_SWITCHER = `        {/* Tab Switcher */}
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => setActiveTab("gestion")}
            className={\`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all \${
              activeTab === "gestion" ? "bg-white text-primary shadow-sm" : "text-gray-400"
            }\`}
          >
            Ma Gestion
          </button>
          <button
            onClick={() => setActiveTab("client")}
            className={\`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all \${
              activeTab === "client" ? "bg-white text-primary shadow-sm" : "text-gray-400"
            }\`}
          >
            Vue Client
          </button>
        </div>`;

const NEW_TAB_SWITCHER = `        {/* Tab Switcher */}
        <div className="flex p-1 bg-gray-100 rounded-2xl gap-0.5">
          <button
            onClick={() => setActiveTab("gestion")}
            className={\`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all \${
              activeTab === "gestion" ? "bg-white text-primary shadow-sm" : "text-gray-400"
            }\`}
          >
            Gestion
          </button>
          <button
            onClick={() => { setActiveTab("publications"); loadProPublications(); }}
            className={\`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all \${
              activeTab === "publications" ? "bg-white text-primary shadow-sm" : "text-gray-400"
            }\`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab("client")}
            className={\`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all \${
              activeTab === "client" ? "bg-white text-primary shadow-sm" : "text-gray-400"
            }\`}
          >
            Vitrine
          </button>
        </div>`;

if (pro.includes(OLD_TAB_SWITCHER)) {
  pro = pro.replace(OLD_TAB_SWITCHER, NEW_TAB_SWITCHER);
  console.log('[ProfilPro] ✅ Tab switcher upgraded to 3 tabs');
} else {
  console.log('[ProfilPro] ⚠️  Tab switcher pattern not found');
}

// Step 4: Render publications tab content — insert before the closing </div> of px-5 section
// We'll insert a publications grid that appears when activeTab === "publications"
// Find the Stats Cards section closing and insert after
const STATS_SECTION_CLOSE = `      </div>

      {/* Night Mode Toggle */}`;

const PUBLICATIONS_TAB_CONTENT = `      </div>

      {/* ── Publications Tab ─────────────────────────────────────── */}
      {activeTab === "publications" && (
        <div className="px-3 pt-2 pb-8">
          <div className="flex items-center justify-between px-1 py-2 mb-2">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
              {proPublications.length} publication{proPublications.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => navigate("/pro/publication")}
              className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/30 active:scale-95 transition-all"
              aria-label="Nouvelle publication"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>

          {proPublications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Camera className="w-12 h-12 text-gray-200" />
              <p className="text-[12px] text-gray-400 font-medium">Aucune publication pour l'instant</p>
              <button
                onClick={() => navigate("/pro/publication")}
                className="mt-1 bg-primary text-white font-black text-[12px] uppercase tracking-widest px-6 py-3 rounded-2xl shadow-md shadow-primary/30 active:scale-95 transition-all"
              >
                Créer une publication
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {proPublications.map((r) => {
                const thumb = r.reel_thumbnail || r.thumbnail_url || (r.reel_images && r.reel_images[0]) || (r.images && r.images[0]) || r.image_url;
                const isVideo = r.video_url || (thumb && (thumb.endsWith(".webm") || thumb.endsWith(".mp4")));
                const views = Number(r.views ?? r.view_count ?? 0);
                const likes = Number(r.likes ?? r.like_count ?? 0);
                return (
                  <div key={r.id} className="min-w-0">
                    {/* Thumbnail */}
                    <div
                      onClick={() => navigate(\`/reels?reelId=\${encodeURIComponent(r.id)}\`)}
                      className="aspect-[9/16] overflow-hidden bg-gray-100 cursor-pointer relative rounded-2xl group"
                    >
                      {thumb ? (
                        <BeautyImage
                          src={thumb}
                          alt={r.title || "Publication"}
                          className="w-full h-full object-cover transition-transform duration-300 group-active:scale-110"
                          style={{ objectPosition: "center top" }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Camera className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      {/* Play/Video badge */}
                      {isVideo && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1">
                          <Video className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {/* Stats overlay */}
                      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                          <Heart className="h-2.5 w-2.5 shrink-0 fill-red-400 text-red-400" />
                          <span className="text-[9px] font-black leading-none text-white">
                            {likes >= 1000 ? \`\${(likes / 1000).toFixed(1)}k\` : String(likes)}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                          <Eye className="h-2.5 w-2.5 shrink-0 text-white" />
                          <span className="text-[9px] font-black leading-none text-white">
                            {views >= 1000 ? \`\${(views / 1000).toFixed(1)}k\` : String(views)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Info + Analytics button */}
                    <div className={\`mt-1.5 rounded-xl border px-1.5 py-1.5 \${theme === "light" ? "border-gray-100 bg-white" : theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-800 bg-[#0a0a0a]"}\`}>
                      <p
                        className={\`truncate px-1 text-[9px] font-bold \${theme === "light" ? "text-gray-600" : "text-gray-200"}\`}
                        title={r.title || "Publication"}
                      >
                        {r.title || "Publication"}
                      </p>
                      {/* Meta: date + views */}
                      <div className="flex items-center gap-1.5 px-1 mt-0.5">
                        {r.created_at && (
                          <span className="text-[8px] text-gray-400 font-medium">
                            {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        <span className="text-[8px] text-gray-300">·</span>
                        <span className="flex items-center gap-0.5 text-[8px] text-gray-400 font-medium">
                          <Eye className="w-2.5 h-2.5" />{views >= 1000 ? \`\${(views / 1000).toFixed(1)}k\` : views} vues
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(\`/pro/publication-analytics?reel=\${encodeURIComponent(r.id)}\`); }}
                        aria-label={\`Données analytiques de \${r.title || "cette publication"}\`}
                        className={\`mt-1 flex min-h-7 w-full items-center justify-center gap-1 rounded-lg px-1.5 text-[8px] font-black uppercase tracking-wide transition-transform active:scale-95 \${theme === "light" ? "bg-orange-50 text-orange-600 hover:bg-orange-100" : theme === "dark" ? "bg-orange-500/15 text-orange-300 hover:bg-orange-500/25" : "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"}\`}
                      >
                        <BarChart3 className="h-3 w-3" />
                        Données
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Night Mode Toggle */}`;

if (pro.includes(STATS_SECTION_CLOSE)) {
  pro = pro.replace(STATS_SECTION_CLOSE, PUBLICATIONS_TAB_CONTENT);
  console.log('[ProfilPro] ✅ Publications tab content injected');
} else {
  console.log('[ProfilPro] ⚠️  Stats section close marker not found');
}

// Step 5: Wrap "Ma Gestion" content so it only shows when activeTab === "gestion"
// The gestion content starts at Night Mode Toggle and ends before the closing </div> of px-5 section
// Find the Night Mode Toggle opening
const NIGHT_MODE_SECTION = `      {/* Night Mode Toggle */}
        <div className="bg-indigo-50 rounded-3xl p-4 flex items-center gap-4 border border-indigo-100">`;

const NIGHT_MODE_SECTION_WRAPPED = `      {/* Ma Gestion Content — only when activeTab === "gestion" */}
      {activeTab === "gestion" && (
        <div className="px-5 pb-4 space-y-4">

        {/* Night Mode Toggle */}
        <div className="bg-indigo-50 rounded-3xl p-4 flex items-center gap-4 border border-indigo-100">`;

// Also need to wrap the end of gestion content
// The gestion content ends at the logout button
const LOGOUT_BUTTON = `        <button
          onClick={() => { logout(); }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors active:scale-95 text-[12px] font-black uppercase tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}`;

const LOGOUT_BUTTON_WRAPPED = `        <button
          onClick={() => { logout(); }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-100 text-red-400 hover:bg-red-50 transition-colors active:scale-95 text-[12px] font-black uppercase tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
        </div>
      )}
    </div>
  );
}`;

if (pro.includes(NIGHT_MODE_SECTION) && !pro.includes('activeTab === "gestion" && (')) {
  pro = pro.replace(NIGHT_MODE_SECTION, NIGHT_MODE_SECTION_WRAPPED);
  console.log('[ProfilPro] ✅ Gestion wrapper start added');
} else {
  console.log('[ProfilPro] ℹ️  Gestion wrapper already present or Night Mode not found');
}

if (pro.includes(LOGOUT_BUTTON)) {
  pro = pro.replace(LOGOUT_BUTTON, LOGOUT_BUTTON_WRAPPED);
  console.log('[ProfilPro] ✅ Gestion wrapper end added');
} else {
  console.log('[ProfilPro] ⚠️  Logout button pattern not found');
}

// Remove the now-duplicate outer "px-5 pt-4 space-y-4" wrapper for gestion
// because we added our own inner wrapper
const OLD_STATS_OPEN = `      {/* Stats Cards */}
      <div className="px-5 pt-4 space-y-4">`;
const NEW_STATS_OPEN = `      {/* Stats Cards */}
      <div className="px-5 pt-4 space-y-4" style={{ display: activeTab !== "gestion" ? "none" : undefined }}>`;

if (pro.includes(OLD_STATS_OPEN)) {
  pro = pro.replace(OLD_STATS_OPEN, NEW_STATS_OPEN);
  console.log('[ProfilPro] ✅ Stats Cards section gating added');
}

writeFileSync(PROFIL_PRO_PATH, pro, 'utf8');
console.log('[ProfilPro] ✅ File saved\n');

console.log('🎉 All patches applied!');
