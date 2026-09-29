import BeautyImage from '@/components/ui/BeautyImage';
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Search, ArrowLeft, Heart, MessageSquare, Share2, Volume2, VolumeX, ShoppingBag, Music, X, Send, Smile, Repeat2, Play, Pause, Lightbulb, Video, ChevronRight, Gauge, MoreHorizontal, ShoppingCart, Sparkles, Scissors, ArrowUpRight } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { likesApi } from '@/api/likes';
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import SponsoredCard from "@/components/reels/SponsoredCard";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";

const TABS = ["Réels", "Conseils", "Tutos"];
const SPEEDS = [0.5, 1, 1.5, 2, 5, 10];

const SHARE_OPTIONS = [
  { label: "WhatsApp", color: "bg-green-500", icon: "💬" },
  { label: "Instagram", color: "bg-pink-500", icon: "📸" },
  { label: "TikTok", color: "bg-black", icon: "🎵" },
  { label: "Copier lien", color: "bg-gray-700", icon: "🔗" },
  { label: "Message", color: "bg-blue-500", icon: "✉️" },
  { label: "Story", color: "bg-primary", icon: "⭐" },
];

// ── Comments Sheet ────────────────────────────────────────────────────────────
const PAGE_SIZE = 30;

function CommentsSheet({ reel, onClose, onCommentCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [likedComments, setLikedComments] = useState([]);
  const [dislikedComments, setDislikedComments] = useState([]);
  const [commentLikeCounts, setCommentLikeCounts] = useState({});
  const [collapsedReplies, setCollapsedReplies] = useState({});
  const [sortBy, setSortBy] = useState("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [reportSent, setReportSent] = useState(null);
  const [shareToast, setShareToast] = useState(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffJ = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "Maintenant";
    if (diffMin < 60) return `${diffMin} min`;
    if (diffH < 24) return `${diffH} h`;
    if (diffJ < 7) return `${diffJ} j`;
    if (diffJ < 30) return `${Math.floor(diffJ / 7)} sem`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const loadComments = useCallback(async () => {
    if (!reel?.id) return;
    setLoading(true);
    let allComments = [];
    try {
      const { data, error } = await supabase.from('reel_comment')
        .select('*').eq('reel_id', reel.id).order('created_at', { ascending: false }).limit(200);
      if (!error && data) allComments = data;
    } catch {}
    if (allComments.length === 0) {
      try {
        const { data: d2, error: e2 } = await supabase.from('CommentaireStyle')
          .select('*').eq('style_id', reel.id).order('created_at', { ascending: false }).limit(200);
        if (!e2 && d2) allComments = d2;
      } catch {}
    }
    setComments(allComments);
    setLoading(false);
  }, [reel?.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    if (!reel?.id || comments.length === 0) return;
    const commentIds = comments.map(c => String(c.id));

    likesApi.getLikeCounts(commentIds, 'comment')
      .then(counts => setCommentLikeCounts(counts))
      .catch(() => {});

    if (user?.email) {
      likesApi.getUserLikesAll(user.email, 'comment')
        .then(data => {
          if (data) {
            setLikedComments(data.filter(l => l.target_type === 'comment').map(l => String(l.target_id)));
            setDislikedComments(data.filter(l => l.target_type === 'dislike').map(l => String(l.target_id)));
          }
        }).catch(() => {});
      likesApi.getUserLikesAll(user.email, 'dislike')
        .then(data => {
          if (data) {
            setDislikedComments(data.filter(l => l.target_type === 'dislike').map(l => String(l.target_id)));
          }
        }).catch(() => {});
    }
  }, [comments.length, reel?.id, user?.email]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const userEmail = user?.email || "anonyme@beautybook.fr";
    const userName = user?.full_name || "Utilisateur";
    const userAvatar = user?.avatar_url || null;
    const text = input.trim();
    const parentId = replyTo?.id || null;
    setInput("");
    setReplyTo(null);

    let newComment = null;
    const { data, error } = await supabase.from('reel_comment').insert({
      reel_id: reel.id, user_email: userEmail, user_name: userName,
      user_avatar: userAvatar, content: text, likes: 0, parent_id: parentId,
    }).select().single();

    if (!error && data) {
      newComment = data;
    } else {
      const { data: d2, error: e2 } = await supabase.from('CommentaireStyle').insert({
        style_id: reel.id, user_email: userEmail, user_name: userName,
        user_avatar: userAvatar, content: text, likes: 0,
      }).select().single();
      if (!e2 && d2) newComment = d2;
    }

    if (newComment) {
      const updated = [newComment, ...comments];
      setComments(updated);
      onCommentCountChange?.(reel.id, updated.length);
      setTimeout(() => { listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, 100);
    }
    setSending(false);
  };

  const toggleCommentLike = async (c) => {
    const cid = String(c.id);
    const isLiked = likedComments.includes(cid);
    const cur = commentLikeCounts[cid] || c.likes || 0;
    const newLikes = isLiked ? Math.max(cur - 1, 0) : cur + 1;

    setCommentLikeCounts(prev => ({ ...prev, [cid]: newLikes }));

    if (isLiked) {
      setLikedComments(prev => prev.filter(id => id !== cid));
      likesApi.removeLike(user?.email, cid, 'comment').catch(() => {});
    } else {
      setLikedComments(prev => [...prev, cid]);
      if (dislikedComments.includes(cid)) {
        setDislikedComments(prev => prev.filter(id => id !== cid));
        likesApi.removeLike(user?.email, cid, 'dislike').catch(() => {});
      }
      likesApi.addLike(user?.email, cid, 'comment', user?.full_name || "Utilisateur", user?.avatar_url || "").catch(() => {});
    }
  };

  const toggleCommentDislike = async (c) => {
    const cid = String(c.id);
    const isDisliked = dislikedComments.includes(cid);
    if (isDisliked) {
      setDislikedComments(prev => prev.filter(id => id !== cid));
      likesApi.removeLike(user?.email, cid, 'dislike').catch(() => {});
    } else {
      setDislikedComments(prev => [...prev, cid]);
      if (likedComments.includes(cid)) {
        setLikedComments(prev => prev.filter(id => id !== cid));
        const cur = commentLikeCounts[cid] || c.likes || 0;
        const newLikes = Math.max(cur - 1, 0);
        setCommentLikeCounts(prev => ({ ...prev, [cid]: newLikes }));
        likesApi.removeLike(user?.email, cid, 'comment').catch(() => {});
      }
      likesApi.addLike(user?.email, cid, 'dislike', user?.full_name || "Utilisateur", user?.avatar_url || "").catch(() => {});
    }
  };

  const reportComment = async (c) => {
    setReportSent(c.id);
    setTimeout(() => setReportSent(null), 3000);
    setMenuId(null);
    try {
      await supabase.from('reel_comment_report').insert({
        comment_id: c.id, reporter_email: user?.email, reel_id: reel.id,
        reason: 'inappropriate', created_at: new Date().toISOString(),
      });
    } catch {}
  };

  const shareComment = async (c) => {
    const text = `${c.user_name}: "${c.content}" — Regarde sur BeautyBook`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Commentaire BeautyBook', text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareToast(c.id);
        setTimeout(() => setShareToast(null), 2000);
      }
    } catch {}
  };

  const deleteComment = async (c) => {
    const cid = String(c.id);
    if (c.reel_id) {
      await supabase.from('reel_comment').delete().eq('id', cid);
    } else {
      await supabase.from('CommentaireStyle').delete().eq('id', cid);
    }
    setComments(prev => {
      const updated = prev.filter(x => String(x.id) !== cid && String(x.parent_id) !== cid);
      onCommentCountChange?.(reel.id, updated.length);
      return updated;
    });
    setMenuId(null);
  };

  const saveEdit = async (c) => {
    if (!editText.trim()) return;
    if (c.reel_id) {
      await supabase.from('reel_comment').update({ content: editText.trim() }).eq('id', c.id);
    } else {
      await supabase.from('CommentaireStyle').update({ content: editText.trim() }).eq('id', c.id);
    }
    setComments(prev => prev.map(x => x.id === c.id ? { ...x, content: editText.trim() } : x));
    setEditingId(null); setEditText(""); setMenuId(null);
  };

  const isOwn = (c) => user?.email && c.user_email === user?.email;
  const rootComments = comments.filter(c => !c.parent_id);
  const sortedRoot = [...rootComments].sort((a, b) => {
    if (sortBy === "popular") return (commentLikeCounts[String(b.id)] || b.likes || 0) - (commentLikeCounts[String(a.id)] || a.likes || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const visibleRoot = sortedRoot.slice(0, visibleCount);
  const hasMore = sortedRoot.length > visibleCount;

  const repliesMap = {};
  comments.filter(c => c.parent_id).forEach(c => {
    if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
    repliesMap[c.parent_id].push(c);
  });

  const renderComment = (c, isReply = false) => {
    const cid = String(c.id);
    const hasReplies = !isReply && repliesMap[c.id]?.length > 0;
    const isCollapsed = collapsedReplies[c.id];
    const parentComment = isReply && comments.find(p => p.id === c.parent_id);
    const likeCount = commentLikeCounts[cid] || c.likes || 0;

    return (
      <div key={c.id} className={`${isReply ? 'ml-12' : ''}`}>
        <div className="flex gap-3 py-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 shrink-0 mt-0.5">
            {c.user_avatar ? (
              <BeautyImage src={c.user_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-[12px] font-bold bg-gray-100">
                {(c.user_name || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-900 text-[13px] font-bold">{c.user_name || "Utilisateur"}</span>
              {isOwn(c) && <span className="text-[9px] font-bold text-primary bg-orange-50 px-1.5 py-0.5 rounded-full">Vous</span>}
            </div>
            {isReply && parentComment && (
              <p className="text-gray-400 text-[11px] mt-0.5">en réponse à <span className="font-bold text-gray-500">{parentComment.user_name}</span></p>
            )}
            {editingId === c.id ? (
              <div className="flex items-center gap-2 mt-1">
                <input value={editText} onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveEdit(c)}
                  className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-[13px] text-gray-800 outline-none" autoFocus />
                <button onClick={() => saveEdit(c)} className="text-primary text-[11px] font-bold">OK</button>
                <button onClick={() => { setEditingId(null); setEditText(""); }} className="text-gray-400 text-[11px]">Annuler</button>
              </div>
            ) : (
              <p className="text-gray-800 text-[14px] leading-snug mt-0.5">{c.content}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-gray-400 text-[11px]">{formatDate(c.created_at)}</span>
              {!isReply && (
                <button onClick={() => setReplyTo(c)} className="text-gray-400 text-[11px] font-bold hover:text-gray-600">Répondre</button>
              )}
              {isOwn(c) && editingId !== c.id && (
                <div className="relative ml-auto">
                  <button onClick={() => setMenuId(menuId === cid ? null : cid)} className="text-gray-400 text-[11px]">•••</button>
                  {menuId === cid && (
                    <div className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[120px]">
                      <button onClick={() => { setEditingId(cid); setEditText(c.content); setMenuId(null); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        Modifier
                      </button>
                      <button onClick={() => deleteComment(c)}
                        className="w-full px-3 py-2 text-left text-[12px] text-red-500 hover:bg-red-50 border-t border-gray-100 flex items-center gap-2">
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!isOwn(c) && editingId !== cid && (
                <div className="relative ml-auto">
                  <button onClick={() => setMenuId(menuId === cid ? null : cid)} className="text-gray-400 text-[11px]">•••</button>
                  {menuId === cid && (
                    <div className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[120px]">
                      {reportSent === cid ? (
                        <div className="px-3 py-2 text-[12px] text-green-600 font-bold">Signalement envoyé</div>
                      ) : (
                        <button onClick={() => reportComment(c)}
                          className="w-full px-3 py-2 text-left text-[12px] text-orange-500 hover:bg-orange-50">
                          Signaler
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
            <button onClick={() => toggleCommentLike(c)} className="active:scale-90 p-1">
              <Heart className={`w-[18px] h-[18px] transition-all ${likedComments.includes(cid) ? "fill-red-500 text-red-500" : "text-gray-300"}`} />
            </button>
            {likeCount > 0 && <span className="text-[10px] text-gray-400 font-medium">{likeCount}</span>}
            <button onClick={() => toggleCommentDislike(c)} className="active:scale-90 p-1">
              <svg className={`w-[16px] h-[16px] transition-all ${dislikedComments.includes(cid) ? "text-red-500" : "text-gray-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </div>
        </div>
        {hasReplies && !isReply && (
          <button onClick={() => setCollapsedReplies(p => ({ ...p, [c.id]: !p[c.id] }))}
            className="ml-11 mb-1 text-gray-400 text-[11px] font-bold hover:text-gray-600">
            {isCollapsed ? `Afficher les ${repliesMap[c.id].length} réponse${repliesMap[c.id].length > 1 ? 's' : ''}` : `Masquer ^`}
          </button>
        )}
        {!isCollapsed && hasReplies && repliesMap[c.id]?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(r => renderComment(r, true))}
        {shareToast === cid && (
          <div className="ml-11 mb-2 text-[11px] text-green-600 font-bold">Copié dans le presse-papiers !</div>
        )}
      </div>
    );
  };

  const totalAll = rootComments.length;
  const totalReplies = comments.filter(c => c.parent_id).length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end" onClick={() => { setMenuId(null); setReplyTo(null); setShowSortMenu(false); }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-[20px] z-10 flex flex-col" style={{ maxHeight: "85%" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-gray-900 text-[15px] font-black">{totalAll + totalReplies} commentaires</h3>
            <div className="relative">
              <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
              </button>
              {showSortMenu && (
                <div className="absolute left-0 top-7 z-30 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[140px]">
                  <button onClick={() => { setSortBy("recent"); setShowSortMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 flex items-center gap-2 ${sortBy === "recent" ? "text-primary font-bold" : "text-gray-700"}`}>
                    Plus récents
                  </button>
                  <button onClick={() => { setSortBy("popular"); setShowSortMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 ${sortBy === "popular" ? "text-primary font-bold" : "text-gray-700"}`}>
                    Plus aimés
                  </button>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="border-t border-gray-100" />
        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-1 hide-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /></div>
          ) : sortedRoot.length === 0 ? (
            <p className="text-center text-gray-400 text-[13px] py-10">Aucun commentaire. Soyez le premier !</p>
          ) : (
            <>
              {visibleRoot.map(c => renderComment(c))}
              {hasMore && (
                <button onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  className="w-full py-3 text-center text-[12px] font-bold text-primary hover:text-orange-600 transition-colors">
                  Charger plus de commentaires ({sortedRoot.length - visibleCount} restants)
                </button>
              )}
            </>
          )}
        </div>
        <div className="border-t border-gray-100" />
        <div className="px-4 py-3 shrink-0 bg-white" style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 16px))" }}>
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-gray-400">Réponse à </span>
                <span className="text-[11px] font-bold text-gray-600">{replyTo.user_name}</span>
                <p className="text-[11px] text-gray-400 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="shrink-0"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={() => {}} />
            <button onClick={() => fileInputRef.current?.click()} className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            </button>
            <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2.5">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={replyTo ? `Réponse à ${replyTo.user_name}...` : "Ajouter un commentaire..."}
                disabled={sending}
                className="flex-1 bg-transparent text-gray-800 text-[13px] outline-none placeholder:text-gray-400 disabled:opacity-50" />
              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                <button className="text-gray-400 hover:text-gray-600 p-0.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                <button className="text-gray-400 hover:text-gray-600 p-0.5">
                  <span className="text-[14px] font-bold">@</span>
                </button>
                {input.trim() && (
                  <button onClick={send} disabled={sending} className="text-primary">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Share Sheet ───────────────────────────────────────────────────────────────
function ShareSheet({ onClose, reelUrl, reelTitle }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = reelUrl || window.location.href;
  const shareText = reelTitle || "Regarde ce réel sur BeautyBook !";

  const handleShare = async (platform) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    let url = "";

    switch (platform) {
      case "WhatsApp":
        url = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case "Instagram":
        // Instagram ne supporte pas de partage direct, on copie le lien
        setCopied(true);
        try { await navigator.clipboard.writeText(shareUrl); } catch {}
        setTimeout(() => { setCopied(false); onClose(); }, 1200);
        return;
      case "TikTok":
        setCopied(true);
        try { await navigator.clipboard.writeText(shareUrl); } catch {}
        setTimeout(() => { setCopied(false); onClose(); }, 1200);
        return;
      case "Message":
        url = `sms:?body=${encodedText}%20${encodedUrl}`;
        break;
      case "Story":
        // Utiliser l'API de partage native si disponible
        if (navigator.share) {
          try {
            await navigator.share({ title: shareText, url: shareUrl });
          } catch {}
          onClose();
          return;
        }
        setCopied(true);
        try { await navigator.clipboard.writeText(shareUrl); } catch {}
        setTimeout(() => { setCopied(false); onClose(); }, 1200);
        return;
      case "Copier lien":
        setCopied(true);
        try { await navigator.clipboard.writeText(shareUrl); } catch {}
        setTimeout(() => { setCopied(false); onClose(); }, 1200);
        return;
      default:
        return;
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#1a1a2e] rounded-t-3xl z-10">
        <div className="flex justify-center pt-3 pb-4"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
        <h3 className="text-white text-[16px] font-black text-center mb-5">Partager via</h3>
        <div className="grid grid-cols-3 gap-4 px-6" style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom, 20px))" }}>
          {SHARE_OPTIONS.map((opt) => (
            <button key={opt.label} onClick={() => handleShare(opt.label)} className="flex flex-col items-center gap-2 active:scale-95 transition-all">
              <div className={`w-14 h-14 ${opt.color} rounded-2xl flex items-center justify-center text-[24px] shadow-lg`}>{opt.icon}</div>
              <span className="text-white/70 text-[11px] font-black">{copied && opt.label === "Copier lien" ? "Copié !" : opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Speed Selector ────────────────────────────────────────────────────────────
function SpeedSelector({ speed, onChange, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#1a1a2e] rounded-t-3xl z-10 px-6" style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom, 16px))" }}>
        <div className="flex justify-center pt-3 pb-4"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
        <h3 className="text-white text-[16px] font-black text-center mb-5">Vitesse de lecture</h3>
        <div className="flex justify-center gap-3 flex-wrap">
          {SPEEDS.map(s => (
            <button key={s} onClick={() => { onChange(s); onClose(); }}
              className={`px-5 py-3 rounded-2xl text-[14px] font-black transition-all active:scale-95 ${speed === s ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-white/10 text-white/80"}`}>
              x{s}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Single Reel Card (plein écran, scroll vertical) ───────────────────────────
function ReelCard({ reel, isActive, muted, onMuteToggle, liked, onLike, repub, onRepub, followed, onFollow, onComment, onShare, onBuyProduits, onBuyServices, onSpeedChange, speed, currentUser, onAuthorClick, navigate, toast }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null); // piste musicale externe
  const progressRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showOfferOverlay, setShowOfferOverlay] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const keepAliveTimer = useRef(null);
  const lastPositionRef = useRef(0);

  // Découpe la description en phrases ; aperçu = 2 premières phrases + "Voir plus"
  const descSentences = (() => {
    const t = (reel.description || "").trim();
    if (!t) return [];
    const m = t.match(/[^.!?…]+[.!?…]+["»\s]*/g);
    return (m ? m.map(s => s.trim()).filter(Boolean) : [t]);
  })();
  const descPreview = descSentences.slice(0, 2).join(" ");
  const descHasMore = descSentences.length > 2;

  const hasMusicTrack = !!reel.sound_preview_url;

  // Autoplay when active
  useEffect(() => {
    if (!videoRef.current) return;
    clearTimeout(keepAliveTimer.current);

    if (isActive) {
      videoRef.current.currentTime = lastPositionRef.current;
      videoRef.current.playbackRate = speed;
      videoRef.current.muted = hasMusicTrack ? true : muted;
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
      if (hasMusicTrack && audioRef.current) {
        audioRef.current.src = reel.sound_preview_url;
        audioRef.current.volume = muted ? 0 : 0.8;
        audioRef.current.loop = true;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      lastPositionRef.current = 0;
      setPlaying(false);
      setProgress(0);
    }
    return () => clearTimeout(keepAliveTimer.current);
  }, [isActive]);

  // When video loops (ends), restart audio track too
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasMusicTrack) return;
    const handleEnded = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    };
    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [hasMusicTrack]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (hasMusicTrack) {
      // Piste musicale gère le volume
      if (audioRef.current) audioRef.current.volume = muted ? 0 : 0.8;
      videoRef.current.muted = true;
    } else {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      if (audioRef.current && hasMusicTrack && !muted) audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(pct);
    lastPositionRef.current = videoRef.current.currentTime;
  };

  // Click on progress bar to seek — sync vidéo + audio
  const handleProgressClick = (e) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * videoRef.current.duration;
    videoRef.current.currentTime = newTime;
    lastPositionRef.current = newTime;
    // Sync audio sur la même position relative
    if (hasMusicTrack && audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = ratio * audioRef.current.duration;
    }
    setProgress(ratio * 100);
  };

  // Touch seek on progress bar
  const handleProgressTouch = (e) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const newTime = ratio * videoRef.current.duration;
    videoRef.current.currentTime = newTime;
    lastPositionRef.current = newTime;
    if (hasMusicTrack && audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = ratio * audioRef.current.duration;
    }
    setProgress(ratio * 100);
  };

  const media = reel.video_url || null;
  const thumb = reel.thumbnail_url || (reel.images && reel.images[0]) || "";
  const likesCount = reel.likes ?? 0;

  return (
    <div className="relative w-full h-full shrink-0 overflow-hidden bg-black"
      style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}>

      {/* Audio externe (piste musicale) */}
      {hasMusicTrack && <audio ref={audioRef} loop />}

      {/* Media */}
      {media ? (
        <>
          <video ref={videoRef} src={media} className="absolute inset-0 w-full h-full object-cover" loop playsInline onTimeUpdate={handleTimeUpdate} onClick={togglePlay} style={{ pointerEvents: 'auto' }} />
          {!playing && (
            <button onClick={togglePlay} className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
            </button>
          )}
        </>
      ) : (
        <BeautyImage src={thumb} alt={reel.title} className="absolute inset-0 w-full h-full object-cover" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30 pointer-events-none" />

      {/* ── Progress bar (cliquable + tactile pour seek) ── */}
      {media && (
        <div className="absolute left-0 right-0 z-20 px-4" style={{ top: "calc(58px + env(safe-area-inset-top, 0px))" }}>
          <div
            className="w-full h-4 flex items-center cursor-pointer"
            onClick={handleProgressClick}
            onTouchStart={handleProgressTouch}
            onTouchMove={handleProgressTouch}
            ref={progressRef}
          >
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative">
              <div className="h-full bg-white rounded-full transition-none" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Right Controls ── */}
      <div className="absolute right-3 flex flex-col items-center gap-3" style={{ top: "calc(80px + env(safe-area-inset-top, 0px))", zIndex: 30, pointerEvents: 'auto' }}>
        <button onClick={onMuteToggle} className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95">
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
        {/* Speed */}
        <button onClick={() => setShowSpeed(true)} className="flex flex-col items-center gap-0.5 active:scale-95">
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Gauge className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-[9px] font-black">x{speed}</span>
        </button>
        {/* Author */}
        <button onClick={() => onAuthorClick?.(reel)} className="flex flex-col items-center gap-1 active:scale-95">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-lg">
            <BeautyImage src={reel.author_avatar || ""} alt={reel.author_name} className="w-full h-full object-cover" />
          </div>
        </button>
        {/* Like */}
        <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onLike(); }} onTouchStart={(e) => { e.stopPropagation(); }}
          className="flex flex-col items-center gap-0.5 active:scale-95" style={{ zIndex: 30, position: 'relative' }}>
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
            <Heart className={`w-5 h-5 transition-all ${liked ? "fill-red-500 text-red-500 scale-110" : "text-white"}`} />
          </div>
          <span className="text-white text-[10px] font-black">{likesCount >= 1000 ? (likesCount / 1000).toFixed(1) + 'k' : likesCount}</span>
        </button>
        {/* Comments */}
        <button onClick={onComment} className="flex flex-col items-center gap-0.5 active:scale-95">
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-black">{reel.comments_count ?? reel.comments ?? 0}</span>
        </button>
        {/* Share */}
        <button onClick={onShare} className="flex flex-col items-center gap-0.5 active:scale-95">
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-black">Partager</span>
        </button>
        {/* Offre */}
        <button data-tour="reels-offre" onClick={() => {
          if (!reel.product_id && !reel.service_id) {
            const t = toast({ title: "Aucun lien", description: "Ce réel n'est lié à aucun produit ou service.", variant: "default" });
            setTimeout(() => t.dismiss(), 3000);
            return;
          }
          setShowOfferOverlay(v => !v);
        }} className="flex flex-col items-center gap-0.5 active:scale-95">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${showOfferOverlay ? "bg-white" : "bg-primary shadow-primary/40"}`}>
            <ShoppingBag className={`w-5 h-5 ${showOfferOverlay ? "text-primary" : "text-white"}`} />
          </div>
          <span className="text-white text-[10px] font-black">Offre</span>
        </button>
        {/* Repub */}
        <button onClick={onRepub} className="flex flex-col items-center gap-0.5 active:scale-95">
          <div className={`w-10 h-10 backdrop-blur-sm rounded-full flex items-center justify-center ${repub ? "bg-green-500/60" : "bg-black/50"}`}>
            <Repeat2 className={`w-5 h-5 ${repub ? "text-green-300" : "text-white"}`} />
          </div>
          <span className="text-white text-[10px] font-black">{repub ? "Republié" : "Repub"}</span>
        </button>
      </div>

      {/* ── Offre overlay (au-dessus du nom) ── */}
      {showOfferOverlay && (
        <div className="absolute left-4 right-20 z-30 flex gap-2" style={{ bottom: "calc(170px + env(safe-area-inset-bottom, 16px))" }}>
          {reel.product_id && (
            <button onClick={() => { setShowOfferOverlay(false); navigate(`/produit?id=${encodeURIComponent(reel.product_id)}`); }}
              className="flex-1 flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 rounded-full active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.9) 0%, rgba(234,88,12,0.95) 100%)', boxShadow: '0 4px 20px rgba(249,115,22,0.4)' }}>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-white text-[12px] font-extrabold tracking-wide">Acheter</span>
              <ArrowUpRight className="w-3 h-3 text-white/60 ml-auto" />
            </button>
          )}
          {reel.service_id && (
            <button onClick={() => { setShowOfferOverlay(false); navigate(`/service/${reel.service_id}`); }}
              className="flex-1 flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 rounded-full active:scale-95 transition-all border border-white/20"
              style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <Scissors className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-white text-[12px] font-extrabold tracking-wide">Réserver</span>
              <ArrowUpRight className="w-3 h-3 text-white/60 ml-auto" />
            </button>
          )}
        </div>
      )}

      {/* ── Bottom info ── */}
      <div className="absolute left-4 right-20 z-20 space-y-1.5" style={{ bottom: "calc(112px + env(safe-area-inset-bottom, 16px))" }}>
        {/* Profile photo + username above legend */}
        <div className="flex items-center gap-2.5">
          <button onClick={() => onAuthorClick?.(reel)} className="shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/80 shadow-lg">
              <BeautyImage src={reel.author_avatar || ""} alt={reel.author_name} className="w-full h-full object-cover" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <button onClick={() => onAuthorClick?.(reel)} className="text-white text-[13px] font-bold truncate text-left block">{reel.author_name || reel.author_handle || "Utilisateur"}</button>
          </div>
          {reel.author_email && reel.author_email !== currentUser?.email && (
            <button onClick={onFollow} className={`shrink-0 border rounded-full px-3 py-1 text-[11px] font-black transition-all ${followed ? "border-white/40 text-white/60" : "border-white text-white"}`}>
              {followed ? "Abonné" : "SUIVRE"}
            </button>
          )}
        </div>
        {/* Titre + bio extensible (Voir plus après la 2e phrase) */}
        <p className="text-white text-[15px] font-bold leading-tight">{reel.title}</p>
        {reel.description && (
          <div className="text-white/90 text-[13px] leading-snug">
            <span>{descExpanded || !descHasMore ? reel.description : descPreview}</span>
            {descHasMore && (
              <button
                onClick={(e) => { e.stopPropagation(); setDescExpanded(v => !v); }}
                className="text-white font-bold ml-1.5 underline underline-offset-2 decoration-white/50 whitespace-nowrap"
              >
                {descExpanded ? "Voir moins" : "Voir plus"}
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          {reel.sound && (
            <>
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                <Music className="w-3 h-3 text-white" />
              </div>
              <p className="text-white/80 text-[12px] font-medium truncate">{reel.sound}</p>
            </>
          )}
        </div>
      </div>

      {/* ── Sheets ── */}
      {showSpeed && <SpeedSelector speed={speed} onChange={onSpeedChange} onClose={() => setShowSpeed(false)} />}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Reels() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  // Les liens de partage utilisent ?id=, les liens internes ?reelId=
  const targetReelId = searchParams.get("reelId") || searchParams.get("id");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Réels");
  const [reelsData, setReelsData] = useCachedState("reels_page", [], c => c?.reels || []);
  const [annonces, setAnnonces] = useCachedState("reels_page", [], c => c?.annonces || []);
  const [hiddenAds, setHiddenAds] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [liked, setLiked] = useState([]);
  const [reelLikeCounts, setReelLikeCounts] = useCachedState("reels_page", {}, c => c?.likeCounts || {});
  const [reelCommentCounts, setReelCommentCounts] = useCachedState("reels_page", {}, c => c?.commentCounts || {});
  const [showBuySheet] = useState(null);
  const [repubs, setRepubs] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(null);
  const [repubToast, setRepubToast] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const [feedAttempt, setFeedAttempt] = useState(0);
  const scrollRef = useRef(null);
  const observerRef = useRef(null);

  // ── À chaque (ré-)entrée sur la page Social, on repart du haut du fil ──
  // /reels et /reseau-social partagent ce composant sans toujours le démonter :
  // sans ceci, on retrouvait la dernière publication lue au lieu des nouveautés.
  const entryKeyRef = useRef(null);
  useEffect(() => {
    const entryKey = location.pathname + location.search;
    if (entryKeyRef.current === entryKey) return;
    entryKeyRef.current = entryKey;
    // Onglet demandé via ?tab= (ex : liens « Conseils » depuis les fiches)
    const wantedTab = new URLSearchParams(location.search).get("tab");
    if (wantedTab && TABS.includes(wantedTab)) setActiveTab(wantedTab);
    setCurrentIdx(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [location.pathname, location.search]);

  // Changement d'onglet : on remonte aussi en haut du fil
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentIdx(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  // ── Charger les likes de l'utilisateur depuis Supabase ──
  useEffect(() => {
    if (!user?.email) return;
    likesApi.getUserLikesAll(user.email, 'reel')
      .then(data => {
        if (data) setLiked(data.map(l => String(l.target_id)).filter(Boolean));
      })
      .catch(() => {});
  }, [user?.email]);

  // ── Charger les abonnements de l'utilisateur depuis Supabase ──
  useEffect(() => {
    if (!user?.email) return;
    supabase.from('user_follow').select('followed_email')
      .eq('follower_email', user.email)
      .then(({ data, error }) => {
        if (error) return;
        if (data) setFollowed(data.map(f => f.followed_email).filter(Boolean));
      })
      .catch(() => {});
  }, [user?.email]);

  useEffect(() => {
    setCurrentIdx(0);
    setFeedLoading(true);
    setFeedError(null);

    const filters = activeTab !== "Réels" ? { category: activeTab, status: "publie" } : { status: "publie" };

    entities.Reel.filter(filters, '-created_at', 50)
      .then(async (reels) => {
        // Enrichir les reels avec nom + avatar depuis les profils
        const emails = [...new Set(reels.map(r => r.author_email).filter(Boolean))];
        const profileMap = {};
        if (emails.length > 0) {
          const [proRes, clientRes] = await Promise.all([
            supabase.from('ProfilPro').select('user_email, salon_name, avatar_url').in('user_email', emails),
            supabase.from('profiles').select('email, full_name, avatar_url').in('email', emails),
          ]);
          (proRes.data || []).forEach(p => { if (p.salon_name) profileMap[p.user_email] = { name: p.salon_name, avatar: p.avatar_url }; });
          (clientRes.data || []).forEach(p => { if (!profileMap[p.email]) profileMap[p.email] = { name: p.full_name, avatar: p.avatar_url }; });
        }
        const enriched = reels.map(r => {
          const prof = profileMap[r.author_email];
          return {
            ...r,
            author_name: r.author_name || prof?.name || "",
            author_avatar: r.author_avatar || prof?.avatar || null,
          };
        });
        setReelsData(enriched);
        const ckm = {};
        enriched.forEach(r => { ckm[r.id] = r.comments_count ?? 0; });
        setReelCommentCounts(prev => ({ ...prev, ...ckm }));
        // Le cache ne garde que l'onglet par défaut (« Réels »)
        if (activeTab === "Réels") mergePageCache("reels_page", { reels: enriched, commentCounts: { ...(readPageCache("reels_page")?.commentCounts || {}), ...ckm } });

        // Scroll to specific reel if reelId param exists
        if (targetReelId) {
          setTimeout(() => {
            const idx = enriched.findIndex(r => String(r.id) === String(targetReelId));
            if (idx >= 0) {
              const el = document.querySelector(`[data-idx="${idx}"]`);
              if (el) el.scrollIntoView({ behavior: "smooth" });
              setCurrentIdx(idx);
            }
          }, 500);
        }

        try {
          const reelIds = reels.map(r => String(r.id));
          if (reelIds.length === 0) return;

          // Compter les commentaires réels depuis reel_comment + CommentaireStyle
          const { data: commentRC } = await supabase.from('reel_comment')
            .select('reel_id').in('reel_id', reelIds);
          const { data: commentCS } = await supabase.from('CommentaireStyle')
            .select('style_id').in('style_id', reelIds);
          const ccm = {};
          (commentRC || []).forEach(c => {
            const rid = String(c.reel_id);
            ccm[rid] = (ccm[rid] || 0) + 1;
          });
          (commentCS || []).forEach(c => {
            const rid = String(c.style_id);
            ccm[rid] = (ccm[rid] || 0) + 1;
          });
          setReelCommentCounts(prev => {
            const next = { ...prev, ...ccm };
            mergePageCache("reels_page", { commentCounts: next });
            return next;
          });

          // Compter les likes via backend
          const lkm = await likesApi.getLikeCounts(reelIds, 'reel');
          setReelLikeCounts(lkm);
          mergePageCache("reels_page", { likeCounts: lkm });
        } catch (e) {
          console.warn('[Reels] like count error:', e);
          const lkm = {};
          reels.forEach(r => { lkm[r.id] = r.likes ?? 0; });
          setReelLikeCounts(lkm);
        }
        setFeedLoading(false);
      })
      .catch((e) => {
        console.error("[Reels] chargement du fil:", e);
        setFeedLoading(false);
        setFeedError("Impossible de charger les réels. Vérifie ta connexion puis réessaie.");
      });

    entities.Annonce.filter({ status: 'actif' }, '-created_at', 20)
      .then(data => {
        // Une annonce sans image ni vidéo ne peut pas s'afficher : on l'exclut
        // de la rotation pour ne jamais montrer un emplacement vide/noir.
        const withMedia = (data || []).filter(a => a.image_url || a.video_url);
        const filtered = withMedia.filter(a => {
          const pages = a.pages || (a.type ? [a.type] : []);
          return pages.includes('reels');
        });
        const list = filtered.length > 0 ? filtered : withMedia;
        setAnnonces(list);
        mergePageCache("reels_page", { annonces: list });
      })
      .catch(() => {});
  }, [activeTab, feedAttempt]);

  // ── Realtime: like counts updates ──
  useEffect(() => {
    const reelIds = reelsData.map(r => String(r.id));
    if (reelIds.length === 0) return;
    const refreshCounts = () => {
      likesApi.getLikeCounts(reelIds, 'reel')
        .then(lkm => { setReelLikeCounts(lkm); mergePageCache("reels_page", { likeCounts: lkm }); })
        .catch(() => {});
    };
    const unsub = entities.Like.subscribe((event) => {
      if (event.type === 'create' || event.type === 'delete') refreshCounts();
    });
    return unsub;
  }, [reelsData]);

  // ── Refresh like counts on tab focus ──
  useEffect(() => {
    const reelIds = reelsData.map(r => String(r.id));
    if (reelIds.length === 0) return;
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        likesApi.getLikeCounts(reelIds, 'reel')
          .then(lkm => { setReelLikeCounts(lkm); mergePageCache("reels_page", { likeCounts: lkm }); })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [reelsData]);

  // IntersectionObserver to track which card is visible
  useEffect(() => {
    if (!scrollRef.current) return;
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.dataset.idx);
          if (!isNaN(idx)) setCurrentIdx(idx);
        }
      });
    }, { root: scrollRef.current, threshold: 0.6 });

    const cards = scrollRef.current.querySelectorAll("[data-idx]");
    cards.forEach(card => observerRef.current.observe(card));
    return () => observerRef.current?.disconnect();
  }, [reelsData]);

  const toggleLike = async (reel) => {
    const reelId = String(reel.id);
    const isLiked = liked.includes(reelId);
    const userEmail = user?.email;
    if (!userEmail) return;

    if (isLiked) {
      setLiked(prev => prev.filter(id => id !== reelId));
      try {
        await supabase.from('user_like').delete().eq('user_email', userEmail).eq('target_id', reelId).eq('target_type', 'reel');
      } catch (e) { console.error('[like] remove error:', e); }
    } else {
      setLiked(prev => [...prev, reelId]);
      try {
        await supabase.from('user_like').insert({ user_email: userEmail, target_id: reelId, target_type: 'reel', user_name: user?.full_name || '', user_avatar: user?.avatar_url || '' });
      } catch (e) { console.error('[like] insert error:', e); }
    }

    // Recharger le compteur depuis la base
    try {
      const { data } = await supabase.from('user_like').select('id').eq('target_id', reelId).eq('target_type', 'reel');
      const count = data ? data.length : 0;
      setReelLikeCounts(prev => {
        const next = { ...prev, [reelId]: count };
        mergePageCache("reels_page", { likeCounts: next });
        return next;
      });
      setReelsData(prev => prev.map(r => String(r.id) === reelId ? { ...r, likes: count } : r));
    } catch (e) { console.error('[like] count error:', e); }
  };

  const toggleFollow = async (reel) => {
    const authorEmail = reel.author_email;
    if (!authorEmail || !user?.email) return;
    const isFollowed = followed.includes(authorEmail);

    if (isFollowed) {
      setFollowed(prev => prev.filter(e => e !== authorEmail));
      const { error } = await supabase.from('user_follow').delete()
        .eq('follower_email', user.email).eq('followed_email', authorEmail);
      if (error) console.warn('[Follow] delete error:', error);

      // Décrémenter followers du profil pro
      try {
        const { data: proData } = await supabase.from('ProfilPro')
          .select('id, followers').eq('user_email', authorEmail).limit(1).maybeSingle();
        if (proData) {
          await supabase.from('ProfilPro')
            .update({ followers: Math.max((proData.followers || 1) - 1, 0) })
            .eq('id', proData.id);
        }
      } catch (e) { console.warn('[Follow] dec followers error:', e); }
    } else {
      setFollowed(prev => [...prev, authorEmail]);
      const { error } = await supabase.from('user_follow').insert({
        follower_email: user.email,
        follower_name: user?.full_name || "Utilisateur",
        follower_avatar: user?.avatar_url || "",
        followed_email: authorEmail,
      });
      if (error) console.warn('[Follow] insert error:', error);

      // Incrémenter followers du profil pro
      try {
        const { data: proData } = await supabase.from('ProfilPro')
          .select('id, followers').eq('user_email', authorEmail).limit(1).maybeSingle();
        if (proData) {
          await supabase.from('ProfilPro')
            .update({ followers: (proData.followers || 0) + 1 })
            .eq('id', proData.id);
        }
      } catch (e) { console.warn('[Follow] inc followers error:', e); }
    }
  };

  // ── Navigate to author profile (pro → VueClient, client → own Profil) ──
  const handleAuthorClick = async (reel) => {
    const email = reel.author_email;
    console.log('[Reels] handleAuthorClick email:', email);
    if (!email) return;
    try {
      const { data: proProfile } = await supabase.from('ProfilPro').select('user_email').eq('user_email', email).maybeSingle();
      console.log('[Reels] proProfile:', proProfile);
      if (proProfile) {
        navigate("/pro/vue-client", { state: { proEmail: email } });
      } else {
        if (user?.email === email) {
          navigate("/profil");
        }
      }
    } catch (e) {
      console.warn('[Reels] handleAuthorClick error:', e);
      if (user?.email === email) navigate("/profil");
    }
  };

  // ── Callback quand un commentaire est ajouté ──
  const handleCommentCountChange = (reelId, newCount) => {
    const id = String(reelId);
    setReelCommentCounts(prev => {
      const next = { ...prev, [id]: newCount };
      mergePageCache("reels_page", { commentCounts: next });
      return next;
    });
    setReelsData(prev => prev.map(r => String(r.id) === id ? { ...r, comments_count: newCount } : r));
  };

  const handleRepub = async (reel) => {
    if (repubs.includes(reel.id)) {
      // Annuler la republication
      setRepubs(p => p.filter(id => id !== reel.id));
      try {
        const existing = await entities.Repub.filter({ user_email: user?.email || "client@beautybook.fr", reel_id: reel.id }, "-created_at", 1);
        if (existing?.[0]?.id) await entities.Repub.delete(existing[0].id);
      } catch (e) {}
      return;
    }
    setRepubs(p => [...p, reel.id]);
    setRepubToast(true);
    setTimeout(() => setRepubToast(false), 2000);
    try {
      await entities.Repub.create({ user_email: user?.email || "client@beautybook.fr", user_name: user?.full_name || "Utilisateur", reel_id: reel.id, reel_title: reel.title, reel_thumbnail: reel.thumbnail_url, reel_images: reel.images || [], original_author: reel.author_name, original_author_avatar: reel.author_avatar || "", category: reel.category });
    } catch (e) {}
  };

  const REELS = reelsData.map(r => ({
    id: r.id, author_name: r.author_name, author_handle: r.author_handle || "", author_avatar: r.author_avatar,
    author_email: r.author_email || "",
    thumbnail_url: r.thumbnail_url || (r.images && r.images[0]) || "",
    images: r.images || [], video_url: r.video_url || null,
    title: r.title, sound: r.sound || null,
    sound_preview_url: r.sound_preview_url || null,
    likes: reelLikeCounts[String(r.id)] ?? reelLikeCounts[r.id] ?? r.likes ?? 0,
    realLikes: reelLikeCounts[String(r.id)] ?? reelLikeCounts[r.id] ?? r.likes ?? 0,
    comments: r.comments || 0,
    comments_count: reelCommentCounts[String(r.id)] ?? reelCommentCounts[r.id] ?? r.comments_count ?? r.comments ?? 0,
    category: r.category || activeTab,
    service_id: r.service_id || null,
    product_id: r.product_id || null,
  }));

  // Construit la liste intercalée : réels + pub toutes les 5 slides
  const feed = [];
  let adInsertCount = 0;
  REELS.forEach((reel, idx) => {
    feed.push({ type: "reel", reel, idx });
    if ((idx + 1) % 5 === 0 && annonces.length > 0) {
      const adIdx = adInsertCount % annonces.length;
      feed.push({ type: "ad", annonce: annonces[adIdx], adKey: `ad-${idx}` });
      adInsertCount++;
    }
  });

  const isCurrentAd = feed[currentIdx]?.type === "ad";

  // Filtrage recherche
  const filteredFeed = searchQuery.trim()
    ? feed.filter(item => item.type === "reel" && item.reel.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : feed;

  return (
    <div className="relative w-full bg-black overflow-hidden font-display" style={{ height: "100dvh" }}>

      {/* Scroll container */}
      <div data-tour="reels-feed" ref={scrollRef} className="w-full overflow-y-scroll hide-scrollbar" style={{ height: "100dvh", scrollSnapType: "y mandatory" }}>
        {filteredFeed.map((item, feedIdx) => {
          if (item.type === "ad") {
            const adKey = item.adKey;
            if (hiddenAds.includes(adKey)) return null;
            // Annonce malformée (ni image ni vidéo) → on n'affiche pas un
            // emplacement noir vide, on saute simplement cet emplacement.
            if (!item.annonce || (!item.annonce.image_url && !item.annonce.video_url)) return null;
            return (
              <div key={adKey} data-idx={feedIdx}
                className="relative bg-black flex flex-col items-center"
                style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))", paddingBottom: "calc(70px + env(safe-area-inset-bottom, 16px))" }}>
                <div className="w-full flex-1 overflow-hidden rounded-2xl mx-2">
                  <SponsoredCard annonce={item.annonce} onClose={() => setHiddenAds(h => [...h, adKey])} />
                </div>
              </div>
            );
          }
          const { reel, idx } = item;
          return (
            <div key={reel.id} data-idx={feedIdx}
              style={{ height: "100dvh" }}>
              <ReelCard
                reel={reel}
                isActive={currentIdx === feedIdx}
                muted={muted}
                onMuteToggle={() => setMuted(m => !m)}
                liked={liked.includes(String(reel.id))}
                onLike={() => toggleLike(reel)}
                repub={repubs.includes(reel.id)}
                onRepub={() => handleRepub(reel)}
                followed={followed.includes(reel.author_email)}
                onFollow={() => toggleFollow(reel)}
                onComment={() => setShowComments(reel)}
                onShare={() => setShowShare(reel)}
                onBuyProduits={() => navigate("/boutique")}
                onBuyServices={() => navigate("/services-salons")}
                onSpeedChange={setSpeed}
                speed={speed}
                currentUser={user}
                onAuthorClick={handleAuthorClick}
                navigate={navigate}
                toast={toast}
              />
            </div>
          );
        })}
        {/* ── États honnêtes du fil : jamais d'écran noir silencieux ── */}
        {filteredFeed.length === 0 && (
          <div className="w-full flex flex-col items-center justify-center gap-4 px-10 text-center"
            style={{ height: "100dvh", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))", paddingBottom: "calc(70px + env(safe-area-inset-bottom, 16px))" }}>
            {feedLoading ? (
              <>
                <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-primary animate-spin" />
                <p className="text-white/70 text-[14px] font-semibold">Chargement des réels…</p>
              </>
            ) : feedError ? (
              <>
                <p className="text-[40px]">📡</p>
                <p className="text-white text-[15px] font-bold leading-snug">{feedError}</p>
                <button onClick={() => setFeedAttempt(k => k + 1)}
                  className="px-6 py-3 bg-primary text-white text-[14px] font-black rounded-full active:scale-95">
                  Réessayer
                </button>
              </>
            ) : (
              <>
                <p className="text-[40px]">🎬</p>
                <p className="text-white text-[15px] font-bold">Aucun réel pour le moment</p>
                <p className="text-white/50 text-[13px]">Les nouvelles vidéos apparaîtront ici.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Top Header (overlay) ── */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 px-4 pb-2 pointer-events-none transition-colors duration-300 ${isCurrentAd ? "bg-white" : "bg-transparent"}`}
        style={{ paddingTop: "calc(16px + env(safe-area-inset-top, 0px))" }}
      >
        {showSearch ? (
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className={`flex-1 flex items-center gap-2 rounded-2xl px-4 py-2.5 ${isCurrentAd ? "bg-gray-100" : "bg-white/15 backdrop-blur-sm"}`}>
              <Search className={`w-4 h-4 shrink-0 ${isCurrentAd ? "text-gray-500" : "text-white/70"}`} />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher des réels..."
                className={`flex-1 bg-transparent text-[14px] outline-none ${isCurrentAd ? "text-gray-900 placeholder:text-gray-400" : "text-white placeholder:text-white/50"}`}
              />
            </div>
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="pointer-events-auto shrink-0">
              <span className={`text-[13px] font-black ${isCurrentAd ? "text-gray-700" : "text-white"}`}>Annuler</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center active:scale-95 shrink-0">
              <ArrowLeft className={`w-5 h-5 ${isCurrentAd ? "text-gray-900" : "text-white"}`} />
            </button>
            <div className="flex-1 flex items-center justify-center gap-1">
              {TABS.map(tab => (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className={`px-4 py-2 rounded-full text-[13px] font-black transition-all ${activeTab === tab ? "bg-primary text-white shadow-md shadow-primary/30" : isCurrentAd ? "text-gray-500" : "text-white/70"}`}>
                  {tab}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSearch(true)} className="w-9 h-9 flex items-center justify-center active:scale-95 shrink-0">
              <Search className={`w-5 h-5 ${isCurrentAd ? "text-gray-900" : "text-white"}`} />
            </button>
          </div>
        )}
      </div>

      {/* ── Repub Toast ── */}
      {repubToast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white text-[13px] font-black px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <Repeat2 className="w-4 h-4" /> Republié dans votre profil !
        </div>
      )}
      {/* ── Sheets (fixed pour couvrir toute la fenêtre, nav incluse) ── */}
      {showComments && (
        <CommentsSheet
          reel={showComments}
          onClose={() => setShowComments(false)}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
      {showShare && (
        <ShareSheet
          onClose={() => setShowShare(null)}
          reelUrl={`${window.location.origin}/reels?id=${showShare.id}`}
          reelTitle={showShare.title || "Regarde ce réel sur BeautyBook !"}
        />
      )}


    </div>
  );
}