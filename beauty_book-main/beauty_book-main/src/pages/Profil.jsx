import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { likesApi } from '@/api/likes';
import { readIsProCache, writeIsProCache } from "@/hooks/useIsPro";
import { Share2, Settings, Star, ShoppingBag, Calendar, Award, CreditCard, Grid, Repeat2, Bookmark, Camera, Plus, Play, Heart, Video, BadgeCheck } from "lucide-react";
import ShareSheet from "@/components/ui/ShareSheet";
import ScoreFiabilite from "@/components/avis/ScoreFiabilite";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthModal from "@/components/ui/AuthModal";

const PROFILE_IMAGE = "";

const quickLinks = [
  { id: "commandes", label: "COMMANDES", icon: ShoppingBag, bg: "bg-blue-100", color: "text-blue-500", path: "/mes-commandes", statKey: "commandes" },
  { id: "rdv", label: "RDV", icon: Calendar, bg: "bg-green-100", color: "text-green-500", path: "/rendez-vous", statKey: "rdv" },
  { id: "points", label: "POINTS", icon: Star, bg: "bg-orange-100", color: "text-primary", path: "/programme-fidelite", statKey: "points" },
  { id: "solde", label: "SOLDE", icon: CreditCard, bg: "bg-amber-100", color: "text-amber-500", path: "/mon-solde", statKey: "solde", comingSoon: true },
];

// ── Grille Instagram ──────────────────────────────────────────────────────────
function InstagramGrid({ items, onItemClick }) {
  return (
    <div className="px-1.5 pb-6">
      {Array.from({ length: Math.ceil(items.length / 3) }, (_, groupIdx) => {
        const group = items.slice(groupIdx * 3, groupIdx * 3 + 3);
        const bigOnRight = groupIdx % 2 === 0;
        const bigItem = bigOnRight ? group[2] : group[0];
        const smallItems = bigOnRight ? group.slice(0, 2) : group.slice(1, 3);

        const Thumb = ({ item, className }) => {
          const thumb = item?.reel_thumbnail || item?.thumbnail_url || (item?.reel_images && item.reel_images[0]) || (item?.images && item.images[0]);
          return (
            <div onClick={onItemClick} className={`overflow-hidden bg-gray-100 cursor-pointer relative rounded-2xl active:scale-[0.98] transition-all ${className}`}>
              {thumb ? <BeautyImage src={thumb} alt={item?.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center"><Camera className="w-6 h-6 text-gray-400" /></div>}
              {item?.video_url && <div className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-1"><Video className="w-2.5 h-2.5 text-white" /></div>}
              {item?.likes > 0 && <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/40 rounded-full px-1.5 py-0.5"><Heart className="w-2.5 h-2.5 text-red-400 fill-red-400" /><span className="text-white text-[9px] font-black">{item.likes >= 1000 ? (item.likes/1000).toFixed(1)+"k" : item.likes}</span></div>}
            </div>
          );
        };

        return (
          <div key={groupIdx} className="grid grid-cols-3 gap-1.5 mb-1.5" style={{ gridTemplateRows: "1fr 1fr" }}>
            {bigOnRight ? (
              <>
                {smallItems.map((item, i) => <Thumb key={item?.id || i} item={item} className="col-span-1 aspect-square" />)}
                {bigItem && <Thumb item={bigItem} className="col-span-2 row-span-2" style={{ gridColumn: "2/4", gridRow: "1/3" }} />}
              </>
            ) : (
              <>
                {bigItem && <Thumb item={bigItem} className="col-span-2 row-span-2" style={{ gridColumn: "1/3", gridRow: "1/3" }} />}
                {smallItems.map((item, i) => <Thumb key={item?.id || i} item={item} className="col-span-1 aspect-square" />)}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MediaThumb({ item, isRepub = false, onClick }) {
  const thumb = item.reel_thumbnail || item.thumbnail_url || (item.reel_images && item.reel_images[0]) || (item.images && item.images[0]);
  const isVideo = item.video_url || (thumb && (thumb.endsWith(".webm") || thumb.endsWith(".mp4")));

  return (
    <div
      onClick={onClick}
      className="aspect-[9/16] overflow-hidden bg-gray-100 cursor-pointer relative rounded-2xl group"
    >
      {thumb ? (
        <BeautyImage src={thumb} alt={item.title || item.reel_title} className="w-full h-full object-cover transition-transform duration-300 group-active:scale-110" />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <Camera className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-active:bg-black/30 transition-all duration-300 rounded-2xl flex items-center justify-center">
        <div className="opacity-0 group-active:opacity-100 transition-opacity duration-200 w-12 h-12 bg-white/80 rounded-full flex items-center justify-center shadow-lg">
          <Play className="w-5 h-5 text-primary ml-0.5" />
        </div>
      </div>
      {isRepub && (
        <div className="absolute top-1.5 left-1.5 bg-green-500 rounded-full p-1">
          <Repeat2 className="w-2.5 h-2.5 text-white" />
        </div>
      )}
      {isVideo && (
        <div className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-1">
          <Video className="w-2.5 h-2.5 text-white" />
        </div>
      )}
      {item.likes > 0 && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/40 rounded-full px-1.5 py-0.5">
          <Heart className="w-2.5 h-2.5 text-red-400 fill-red-400" />
          <span className="text-white text-[9px] font-black">{item.likes >= 1000 ? (item.likes/1000).toFixed(1)+"k" : item.likes}</span>
        </div>
      )}
    </div>
  );
}

function getBannerGradient(theme) {
  if (theme === "night") return "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 60%, #000000 100%)";
  if (theme === "dark")  return "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(26,26,46,0.7) 60%, #1a1a2e 100%)";
  return "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(255,255,255,0.3) 60%, #ffffff 100%)";
}

function getPageBg(theme) {
  if (theme === "night") return "#000000";
  if (theme === "dark")  return "#1a1a2e";
  return "#ffffff";
}

export default function Profil() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showAuthModal, authMessage, requireAuth, closeAuthModal } = useAuthGate();
  const [activeTab, setActiveTab] = useState("publications");
  const [publications, setPublications] = useState([]);
  const [repubsList, setRepubsList] = useState([]);
  const [favorisList, setFavorisList] = useState([]);
  const [loading, setLoading] = useState(false);
  // Initialisé depuis le cache : un pro qui revient voit directement la bonne
  // version. `null` = statut pas encore connu (pas de flash, voir hooks/useIsPro.js).
  const [isPro, setIsPro] = useState(readIsProCache);
  const [demandeStatus, setDemandeStatus] = useState(null); // null | 'en_attente' | 'approuvee' | 'refusee'
  const [shareOpen, setShareOpen] = useState(false);
  const [stats, setStats] = useState({ commandes: 0, rdv: 0, points: 0, solde: 0 });
  const [followersCount, setFollowersCount] = useState(0);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        requireAuth("Connectez-vous pour accéder à votre profil.");
      }
    }).catch(() => requireAuth("Connectez-vous pour accéder à votre profil."));
  }, []);

  useEffect(() => {
    loadData();
  }, [user?.email]);

  const loadData = async () => {
    if (!user?.email) return;
    setLoading(true);
    // Note : on ne réinitialise PAS isPro ici — le cache affiche la bonne
    // version immédiatement, loadData revalide en arrière-plan.
    setDemandeStatus(null);
    try {
    const today = new Date().toISOString().split("T")[0];

    // ── Charger les likes depuis backend ──
    const dbLikes = await likesApi.getUserLikesAll(user.email).catch(() => []);

    const likedReelIds = (dbLikes || []).filter(l => l.target_type === 'reel').map(l => l.target_id);
    const likedServiceIds = (dbLikes || []).filter(l => l.target_type === 'service').map(l => l.target_id);
    const likedStyleIds = (dbLikes || []).filter(l => l.target_type === 'style').map(l => l.target_id);

    // Requête Supabase directe — tous les reels publiés, filtrer côté client
    let reels = [];
    try {
      const { data: reelsData, error: reelsErr } = await supabase
        .from('Reel')
        .select('*')
        .eq('status', 'publie')
        .order('created_at', { ascending: false })
        .limit(200);
      if (reelsErr) {
        console.error('[Profil] Reels query error:', reelsErr);
      } else {
        const myEmail = (user.email || '').toLowerCase().trim();
        const myId = user.id || '';
        const myName = (user.full_name || user.name || '').toLowerCase().trim();

        // Debug: log exact values
        (reelsData || []).forEach((r, i) => {
          console.log(`[Profil] Reel[${i}]: email="${r.author_email}" name="${r.author_name}" createdBy="${r.created_by_id}"`);
        });
        console.log('[Profil] Me: email=', myEmail, 'id=', myId, 'name=', myName);

        reels = (reelsData || []).filter(r => {
          const rEmail = (r.author_email || '').toLowerCase().trim();
          const rCreatedBy = r.created_by_id || '';
          const rName = (r.author_name || '').toLowerCase().trim();
          // Match par email, id, OU nom
          if (rEmail && rEmail === myEmail) return true;
          if (rCreatedBy && rCreatedBy === myId) return true;
          if (myName && rName && rName === myName) return true;
          // Fallback: si aucun champ n'est rempli dans le reel, l'inclure
          if (!rEmail && !rCreatedBy) return true;
          return false;
        });
      }
    } catch (e) {
      console.error('[Profil] Reels query exception:', e);
    }

    let repubs = [];
    try {
      const { data: repubsData, error: repubsErr } = await supabase
        .from('Repub')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!repubsErr) repubs = repubsData || [];
    } catch (e) {}

    const [profil, commandes, reservations, pointsFidelite] = await Promise.all([
      entities.ProfilPro.filter({ user_email: user.email }, "-created_at", 1).catch(() => []),
      entities.Commande.filter({ client_email: user.email }, "-created_at", 100).catch(() => []),
      entities.Reservation.filter({ client_email: user.email }, "-created_at", 100).catch(() => []),
      entities.PointsFidelite.filter({ user_email: user.email }, "-created_at", 1).catch(() => []),
    ]);
    setPublications(reels);
    setRepubsList(repubs);

    // ── Charger les favoris (reels likés + services likés + styles likés) depuis la BDD ──
    const favs = [];
    if (likedReelIds.length > 0) {
      const likedReels = await Promise.all(
        likedReelIds.map(rid =>
          entities.Reel.filter({ id: rid }, "-created_at", 1).catch(() => [])
        )
      );
      likedReels.forEach(res => { if (res[0]) favs.push(res[0]); });
    }
    if (likedServiceIds.length > 0) {
      const allServices = await entities.Service.filter({ status: "actif" }, "-created_at", 200).catch(() => []);
      const likedSvcs = allServices.filter(s => likedServiceIds.includes(s.id)).map(s => ({
        ...s,
        thumbnail_url: s.image_url,
        title: s.title,
        likes: 0,
      }));
      favs.push(...likedSvcs);
    }
    if (likedStyleIds.length > 0) {
      const allStyles = await entities.Style.filter({ status: "publie" }, "-created_at", 200).catch(() => []);
      const likedStyles = allStyles.filter(s => likedStyleIds.includes(s.id)).map(s => ({
        ...s,
        thumbnail_url: s.image_url || (s.images && s.images[0]),
      }));
      favs.push(...likedStyles);
    }
    if (favs.length > 0) setFavorisList(favs);

    // Stats réelles pour les quick links
    const rdvAVenir = reservations.filter(r => r.date >= today && r.status !== "annule" && r.status !== "termine").length;
    const totalPoints = (pointsFidelite[0]?.points_total || 0) - (pointsFidelite[0]?.points_depenses || 0);
    const soldeDisponible = pointsFidelite[0]?.solde || 0;
    setStats({
      commandes: commandes.length,
      rdv: rdvAVenir,
      points: totalPoints,
      solde: soldeDisponible,
    });

    if (user?.role === 'vendeur' || user?.role === 'admin') {
      setIsPro(true);
      writeIsProCache(true);
    } else {
      // Check DemandeProV2 status + ProfilPro existence
      try {
        const { data } = await supabase.from('DemandeProV2')
          .select('statut')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const statut = data?.statut || null;
        setDemandeStatus(statut);

        if (statut === 'approuvee' && profil.length > 0 && profil[0].status === 'actif') {
          setIsPro(true);
          writeIsProCache(true);
        }
      } catch { setDemandeStatus(null); }
    }

    // Fetch followers count
    try {
      const { count } = await supabase.from("user_follow").select("*", { count: "exact", head: true }).eq("followed_email", user.email);
      setFollowersCount(count || 0);
    } catch (e) { console.error("Followers count error:", e); }

    } catch (e) { console.error('[Profil] loadData error:', e); }
    setLoading(false);
  };

  const postsCount = publications.length;
  const totalLikes = favorisList.length;
  const totalFavoris = favorisList.length;

  // Si la demande est en attente, on reste sur le profil client avec une info
  // Plus de redirect automatique vers profil-pro pour une demande en attente

  return (
    <div className="font-display pb-4 min-h-full" style={{ background: getPageBg(theme) }}>
      <AuthModal open={showAuthModal} onClose={closeAuthModal} message={authMessage} />

      {/* Banner — cliquable pour modifier */}
      <div className="relative h-48 cursor-pointer" onClick={() => navigate("/modifier-profil-client")}>
        {user?.cover_url ? (
          <BeautyImage src={user.cover_url} alt="Bannière" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-orange-100 to-orange-50" />
        )}
        <div className="absolute inset-0" style={{ background: getBannerGradient(theme) }} />

        {/* Top Buttons */}
        <div className="absolute top-4 left-0 right-0 px-5 flex items-center justify-center gap-3 z-10">
          <button onClick={(e) => { e.stopPropagation(); navigate("/abonnements"); }} className="px-6 py-2.5 bg-primary rounded-full flex items-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-all">
            <Star className="w-4 h-4 text-white fill-white" />
            <span className="text-white text-[12px] font-black uppercase tracking-wider">Abonnements</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
            className="w-10 h-10 bg-gray-400/80 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95 transition-all">
            <Share2 className="w-4 h-4 text-white" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigate("/parametres"); }} className="w-10 h-10 bg-gray-400/80 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95 transition-all">
            <Settings className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Profile Photo */}
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-[100px] h-[100px] rounded-full border-[3px] border-primary shadow-xl overflow-hidden bg-gray-100">
              <BeautyImage src={user?.avatar_url || PROFILE_IMAGE} alt="Profil" className="w-full h-full object-cover" />
            </div>
            <button onClick={(e) => { e.stopPropagation(); navigate("/modifier-profil-client"); }} className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full border-2 border-white flex items-center justify-center shadow active:scale-95 transition-all">
              <Camera className="w-4 h-4 text-white" />
            </button>
            {/* Badge PRO */}
            {isPro && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary rounded-full px-2 py-0.5 flex items-center gap-1 shadow-md border-2 border-white whitespace-nowrap">
                <BadgeCheck className="w-3 h-3 text-white" />
                <span className="text-white text-[9px] font-black uppercase tracking-widest">PRO</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="pt-16 px-5 pb-4 flex flex-col items-center text-center gap-1">
        <h1 className="text-[20px] font-black text-gray-500">@{user?.username || user?.email?.split("@")[0] || "beautybook"}</h1>
        {user?.bio && (
          <p className="text-[12px] text-gray-500 font-medium mt-1 max-w-[280px] leading-relaxed">{user.bio.length > 160 ? user.bio.slice(0, 160) + "…" : user.bio}</p>
        )}
      </div>

      {/* Stats */}
      <div className="mx-5 bg-gray-50 rounded-2xl px-4 py-4 grid grid-cols-3 divide-x divide-gray-200 mb-4">
        {[
          { value: postsCount, label: "PUBLICATIONS" },
          { value: followersCount, label: "ABONNÉS" },
          { value: totalLikes, label: "LIKES", highlight: true },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1 px-2">
            <span className={`text-[22px] font-black ${s.highlight ? "text-primary" : "text-gray-900"}`}>{s.value}</span>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</span>
          </div>
        ))}
      </div>

      {/* CTA Buttons */}
      <div className="px-5 flex gap-3 mb-5">
        <button onClick={() => navigate("/modifier-profil-client")}
          className="flex-1 py-3.5 bg-gray-900 rounded-2xl text-white text-[13px] font-black uppercase tracking-widest active:scale-95 transition-all">
          MODIFIER
        </button>
        {isPro === null ? (
          <div className="flex-1 py-3.5 bg-gray-100 rounded-2xl animate-pulse" aria-hidden="true" />
        ) : isPro ? (
          <button onClick={() => navigate("/pro/modifier-profil")}
            className="flex-1 py-3.5 bg-primary rounded-2xl text-white text-[13px] font-black uppercase tracking-widest shadow-md shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2">
            <BadgeCheck className="w-4 h-4" />
            MODIFIER PROFIL PRO
          </button>
        ) : demandeStatus === 'en_attente' ? (
          <button onClick={() => navigate("/profil-pro")}
            className="flex-1 py-3.5 bg-amber-400 rounded-2xl text-white text-[13px] font-black uppercase tracking-widest shadow-md shadow-amber-400/30 active:scale-95 transition-all">
            MON PROFIL PRO
          </button>
        ) : (
          <button data-tour="profil-devenir-pro" onClick={() => navigate("/devenir-pro")}
            className="flex-1 py-3.5 bg-primary rounded-2xl text-white text-[13px] font-black uppercase tracking-widest shadow-md shadow-primary/30 active:scale-95 transition-all">
            DEVENIR PRO
          </button>
        )}
      </div>

      {/* Quick Links */}
      <div className="px-5 flex justify-between mb-5">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] bg-gray-900 text-white text-[13px] font-bold px-5 py-3 rounded-2xl shadow-xl max-w-[320px] text-center flex items-center gap-2">
            <span className="text-primary text-[11px]">⏳</span> {toast}
          </div>
        )}
        {quickLinks.map((q) => {
          const Icon = q.icon;
          const val = stats[q.statKey];
          return (
            <button key={q.id} onClick={() => q.comingSoon ? showToast("Bientôt disponible !") : navigate(q.path)} className="flex flex-col items-center gap-2 active:scale-95 transition-all">
              <div className={`relative w-14 h-14 ${q.bg} rounded-2xl flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${q.color}`} />
                {q.comingSoon && (
                  <div className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                    Bientôt
                  </div>
                )}
                {!q.comingSoon && val > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] ${q.id === "solde" ? "bg-amber-500" : q.id === "points" ? "bg-primary" : "bg-gray-800"} text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 border border-white`}>
                    {val > 999 ? "999+" : val}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{q.label}</span>
            </button>
          );
        })}
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={user?.full_name ? `${user.full_name} – BeautyBook` : "Mon Profil BeautyBook"}
        url={window.location.origin + "/profil"}
      />

      {/* Score de Fiabilité */}
      <div data-tour="profil-score" className="mx-5 mb-5">
        <ScoreFiabilite userEmail={user?.email} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 mb-0">
        <div className="flex">
          {[
            { id: "publications", label: "PUBLICATIONS", Icon: Grid },
            { id: "repubs", label: `REPUB (${repubsList.length})`, Icon: Repeat2 },
            { id: "favoris", label: "FAVORIS", Icon: Bookmark },
          ].map((tab) => {
            const Icon = tab.Icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 border-b-2 transition-all ${activeTab === tab.id ? "border-primary" : "border-transparent"}`}>
                <Icon className={`w-5 h-5 ${activeTab === tab.id ? "text-primary" : "text-gray-400"}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${activeTab === tab.id ? "text-primary" : "text-gray-400"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Grid */}
      <div className="pt-1">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
            {activeTab === "publications" ? `${postsCount} publication${postsCount !== 1 ? "s" : ""}` :
              activeTab === "repubs" ? `${repubsList.length} publication${repubsList.length !== 1 ? "s" : ""}` : "Favoris"}
          </p>
          {activeTab === "publications" && (
            <button onClick={() => navigate("/pro/publication")}
              className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/30 active:scale-95 transition-all">
              <Plus className="w-4 h-4 text-white" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : activeTab === "publications" ? (
          publications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Camera className="w-12 h-12 text-gray-200" />
              <p className="text-[12px] text-gray-400 font-medium">Aucune publication</p>
              <button onClick={() => navigate("/pro/publication")}
                className="mt-1 bg-primary text-white font-black text-[12px] uppercase tracking-widest px-6 py-3 rounded-2xl shadow-md shadow-primary/30 active:scale-95 transition-all">
                Créer une publication
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-6">
              {publications.map((r) => (
                <MediaThumb key={r.id} item={r} onClick={() => navigate("/reels")} />
              ))}
            </div>
          )
        ) : activeTab === "repubs" ? (
          repubsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Repeat2 className="w-12 h-12 text-gray-200" />
              <p className="text-[12px] text-gray-400 font-medium">Aucune republication</p>
              <p className="text-[11px] text-gray-300 font-medium text-center px-8">Republier un reel depuis la page sociale pour le voir ici</p>
              <button onClick={() => navigate("/reels")}
                className="mt-1 bg-gray-900 text-white font-black text-[12px] uppercase tracking-widest px-6 py-3 rounded-2xl active:scale-95 transition-all">
                Voir les Réels
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-6">
              {repubsList.map((r) => (
                <MediaThumb key={r.id} item={r} isRepub onClick={() => navigate("/reels")} />
              ))}
            </div>
          )
        ) : (
          favorisList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Bookmark className="w-12 h-12 text-gray-200" />
              <p className="text-[12px] text-gray-400 font-medium">Aucun favori pour l'instant</p>
              <p className="text-[11px] text-gray-300 font-medium text-center px-8">Likez des réels pour les voir ici</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-6">
              {favorisList.map((r) => (
                <MediaThumb key={r.id} item={r} onClick={() => {
                  if (r.pro_email && r.price !== undefined && !r.author_email) {
                    // Service
                    navigate(`/service/${r.id}`);
                  } else if (r.image_url && r.category && !r.author_email && !r.pro_email) {
                    // Style
                    navigate(`/style/${r.id}`, { state: { id: r.id, title: r.title, cover: r.image_url, images: r.images || [], category: r.category, description: r.description, likes: r.likes } });
                  } else {
                    // Reel / publication
                    navigate("/reels");
                  }
                }} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
