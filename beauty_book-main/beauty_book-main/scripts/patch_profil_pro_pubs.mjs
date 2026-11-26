import { readFileSync, writeFileSync } from 'fs';

const PROFIL_PRO_PATH = 'C:/Users/G15/Desktop/Nouveau dossier (10)/Beautybook_titan/beauty_book-main/beauty_book-main/src/pages/ProfilPro.jsx';

let pro = readFileSync(PROFIL_PRO_PATH, 'utf8').replace(/\r\n/g, '\n');

const TAB_END = `        </div>
      </div>

      {/* Stats Cards */}`;

const TAB_END_WITH_PUBS = `        </div>
      </div>

      {/* ── Publications Tab Content ──────────────────────────────── */}
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
                const fmtNum = (n) => n >= 1000 ? \`\${(n / 1000).toFixed(1)}k\` : String(n);
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
                      {isVideo && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1">
                          <Video className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {/* Stats overlay */}
                      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                          <Heart className="h-2.5 w-2.5 shrink-0 fill-red-400 text-red-400" />
                          <span className="text-[9px] font-black leading-none text-white">{fmtNum(likes)}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                          <Eye className="h-2.5 w-2.5 shrink-0 text-white" />
                          <span className="text-[9px] font-black leading-none text-white">{fmtNum(views)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Info + Analytics */}
                    <div className={\`mt-1.5 rounded-xl border px-1.5 py-1.5 \${theme === "light" ? "border-gray-100 bg-white" : theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-800 bg-[#0a0a0a]"}\`}>
                      <p
                        className={\`truncate px-1 text-[9px] font-bold \${theme === "light" ? "text-gray-600" : "text-gray-200"}\`}
                        title={r.title || "Publication"}
                      >
                        {r.title || "Publication"}
                      </p>
                      <div className="flex items-center gap-1.5 px-1 mt-0.5">
                        {r.created_at && (
                          <span className="text-[8px] text-gray-400 font-medium">
                            {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        <span className="text-[8px] text-gray-300">·</span>
                        <span className="flex items-center gap-0.5 text-[8px] text-gray-400 font-medium">
                          <Eye className="w-2.5 h-2.5" />{fmtNum(views)} vues
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(\`/pro/publication-analytics?reel=\${encodeURIComponent(r.id)}\`); }}
                        aria-label={\`Données de \${r.title || "cette publication"}\`}
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

      {/* Stats Cards */}`;

if (pro.includes(TAB_END)) {
  pro = pro.replace(TAB_END, TAB_END_WITH_PUBS);
  console.log('[ProfilPro] ✅ Publications tab content injected');
} else {
  console.log('[ProfilPro] ⚠️  TAB_END marker not found — checking...');
  // Log what's around line 537
  const lines = pro.split('\n');
  for (let i = 530; i < 545 && i < lines.length; i++) {
    console.log(`  L${i+1}: ${lines[i]}`);
  }
}

writeFileSync(PROFIL_PRO_PATH, pro, 'utf8');
console.log('[ProfilPro] ✅ File saved');
