import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, ShieldCheck, MessageSquare, Loader2, Send, Quote, MessageCircle } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import PageHeader from "@/components/layout/PageHeader";
import NoterClientModal from "@/components/avis/NoterClientModal";

function emailToDisplayName(email) {
  if (!email) return "Client";
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function StarDisplay({ value, size = "w-3 h-3" }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= value ? "text-primary fill-primary" : "text-gray-200"}`} />
      ))}
    </div>
  );
}

export default function AvisClients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cacheKey = user?.email ? `avisclients_${user.email}` : null;
  // Affichage direct depuis le cache : pas d'écran « chargement » intermédiaire,
  // le rafraîchissement réseau se fait en arrière-plan sans vider l'affichage.
  const [tab, setTab] = useState("recus");
  const [avisRecus, setAvisRecus] = useCachedState(cacheKey, [], (c) => c?.avisRecus || []);
  const [reservationsTerminees, setReservationsTerminees] = useCachedState(cacheKey, [], (c) => c?.reservationsTerminees || []);
  const [avisEnvoyes, setAvisEnvoyes] = useCachedState(cacheKey, [], (c) => c?.avisEnvoyes || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [noterModal, setNoterModal] = useState(null);

  useEffect(() => {
    if (!user?.email) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [recus, envoyesPro, reservations] = await Promise.all([
        entities.Avis.filter({ type: "client_to_pro", cible_email: user.email }, "-created_at", 50),
        entities.Avis.filter({ type: "pro_to_client", auteur_email: user.email }, "-created_at", 50),
        entities.Reservation.filter({ pro_email: user.email, status: "termine" }, "-created_at", 50),
      ]);
      setAvisRecus(recus);
      setAvisEnvoyes(envoyesPro);
      const reservationsNotees = new Set(envoyesPro.map((a) => a.reservation_id));
      const aNoter = reservations.filter((r) => !reservationsNotees.has(r.id));
      setReservationsTerminees(aNoter);
      mergePageCache(cacheKey, { avisRecus: recus, avisEnvoyes: envoyesPro, reservationsTerminees: aNoter });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const submitReply = async (avisId) => {
    if (!replyText.trim()) return;
    setSavingReply(true);
    try {
      await entities.Avis.update(avisId, { reponse_pro: replyText });
      setAvisRecus((prev) => {
        const next = prev.map((a) => (a.id === avisId ? { ...a, reponse_pro: replyText } : a));
        mergePageCache(cacheKey, { avisRecus: next });
        return next;
      });
      setReplyingId(null);
      setReplyText("");
    } catch (e) {
      console.error(e);
    }
    setSavingReply(false);
  };

  const avgRating =
    avisRecus.length > 0
      ? (avisRecus.reduce((s, a) => s + a.note, 0) / avisRecus.length).toFixed(1)
      : "–";

  const reviewsWithComment = avisRecus.filter(a => a.commentaire && a.commentaire.trim());
  const commentCount = reviewsWithComment.length;
  // Gate : aucun spinner plein écran si des données en cache sont déjà affichées.
  const hasData = avisRecus.length > 0 || avisEnvoyes.length > 0 || reservationsTerminees.length > 0;

  return (
    <div className="font-display min-h-full bg-[#f5f5f5]">
      <PageHeader
        title="Avis & Notations"
        subtitle="Gestion des évaluations"
        dark={false}
      />
      {/* Tabs */}
      <div className="bg-white px-5 pt-4 pb-0 flex p-1 bg-gray-100 rounded-2xl mx-5 mt-4">
        <button onClick={() => setTab("recus")} className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${tab === "recus" ? "bg-white text-primary shadow-sm" : "text-gray-400"}`}>
          <MessageCircle className="w-3.5 h-3.5" /> Avis reçus
        </button>
        <button onClick={() => setTab("clients")} className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${tab === "clients" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400"}`}>
          <ShieldCheck className="w-3.5 h-3.5" /> Score Fiabilité
        </button>
      </div>

      <div className="px-5 pt-4 pb-8 space-y-4">
        {loading && !hasData ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : tab === "recus" ? (
          <>
            {/* ── Stats globales ── */}
            <div className="bg-[#1a2035] rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Note Globale</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[44px] font-black text-white leading-none">{avgRating}</span>
                    <Star className="w-6 h-6 text-primary fill-primary" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Avis</p>
                  <span className="text-[44px] font-black text-white leading-none">{avisRecus.length}</span>
                </div>
              </div>
              {/* Barre commentaires */}
              <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[22px] font-black text-white leading-none">{commentCount}</span>
                    <span className="text-[10px] text-gray-400 font-medium">commentaire{commentCount > 1 ? "s" : ""}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avisRecus.length > 0 ? (commentCount / avisRecus.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {avisRecus.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Aucun avis reçu</p>
                <p className="text-[12px] text-gray-400 font-medium text-center">Vos clients peuvent laisser des avis après leurs prestations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {avisRecus.map((a) => (
                  <div key={a.id} className="bg-white rounded-3xl p-4 shadow-sm">
                    {/* Header client + note */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-black text-primary text-[15px] shrink-0">
                        {(a.auteur_nom || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-black text-gray-900 truncate">{a.auteur_nom || emailToDisplayName(a.auteur_email)}</p>
                        <p className="text-[11px] text-gray-400 font-medium">{a.service_nom} · {new Date(a.created_date || a.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StarDisplay value={a.note} />
                        <span className="text-[13px] font-black text-gray-700">{a.note}/5</span>
                      </div>
                    </div>

                    {/* Commentaire — mis en avant */}
                    {a.commentaire && a.commentaire.trim() ? (
                      <div className="bg-gray-50 rounded-2xl p-4 mb-3 border border-gray-100">
                        <div className="flex items-start gap-2">
                          <Quote className="w-4 h-4 text-primary/40 shrink-0 mt-0.5" />
                          <p className="text-[14px] text-gray-700 font-medium leading-relaxed">{a.commentaire}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-2xl p-3 mb-3 flex items-center gap-2 border border-gray-100">
                        <MessageSquare className="w-4 h-4 text-gray-300" />
                        <p className="text-[12px] text-gray-300 italic">Aucun commentaire</p>
                      </div>
                    )}

                    {/* Critères (optionnel, discret) */}
                    {a.criteres && Object.keys(a.criteres).some((k) => a.criteres[k] > 0) && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {a.criteres.ponctualite > 0 && (
                          <div className="flex items-center gap-1 bg-gray-50 rounded-full px-2.5 py-1">
                            <span className="text-[10px] text-gray-500 font-medium">Ponctualité</span>
                            <StarDisplay value={a.criteres.ponctualite} size="w-2.5 h-2.5" />
                          </div>
                        )}
                        {a.criteres.proprete > 0 && (
                          <div className="flex items-center gap-1 bg-gray-50 rounded-full px-2.5 py-1">
                            <span className="text-[10px] text-gray-500 font-medium">Propreté</span>
                            <StarDisplay value={a.criteres.proprete} size="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Réponse pro */}
                    {a.reponse_pro && (
                      <div className="bg-orange-50 rounded-2xl p-3 border border-orange-100 mb-3">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Votre réponse</p>
                        <p className="text-[12px] text-gray-600 font-medium leading-snug">{a.reponse_pro}</p>
                      </div>
                    )}

                    {/* Bouton répondre */}
                    {replyingId === a.id ? (
                      <div className="space-y-2">
                        <textarea autoFocus placeholder="Répondez à cet avis..." value={replyText} onChange={(e) => setReplyText(e.target.value)}
                          className="w-full h-20 bg-gray-50 border border-gray-200 rounded-2xl p-3 text-[13px] text-gray-700 placeholder:text-gray-300 outline-none resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => { setReplyingId(null); setReplyText(""); }}
                            className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-[12px] font-black text-gray-500 uppercase tracking-widest active:scale-95 transition-all">
                            Annuler
                          </button>
                          <button onClick={() => submitReply(a.id)} disabled={savingReply}
                            className="flex-1 py-2.5 rounded-2xl bg-primary text-white text-[12px] font-black uppercase tracking-widest shadow-md shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {savingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Publier
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setReplyingId(a.id); setReplyText(a.reponse_pro || ""); }}
                        className="flex items-center gap-1.5 text-[11px] font-black text-primary uppercase tracking-widest active:scale-95 transition-all">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {a.reponse_pro ? "Modifier la réponse →" : "Répondre →"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Bannière explicative */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white text-[14px] font-black">Score de Fiabilité Client</p>
                  <p className="text-blue-200 text-[11px] font-medium leading-snug mt-0.5">
                    Évaluez la fiabilité de vos clients après chaque RDV. Ce score est visible par tous les pros de la plateforme pour prioriser les réservations.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-white/10 rounded-2xl p-3 text-center">
                  <span className="text-[28px] font-black text-white leading-none">{avisEnvoyes.length}</span>
                  <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mt-0.5">Notés</p>
                </div>
                <div className="flex-1 bg-white/10 rounded-2xl p-3 text-center">
                  <span className="text-[28px] font-black text-yellow-300 leading-none">{reservationsTerminees.length}</span>
                  <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mt-0.5">À noter</p>
                </div>
                <div className="flex-1 bg-white/10 rounded-2xl p-3 text-center">
                  <span className="text-[28px] font-black text-green-300 leading-none">
                    {avisEnvoyes.length > 0 ? (avisEnvoyes.reduce((s, a) => s + a.note, 0) / avisEnvoyes.length).toFixed(1) : "–"}
                  </span>
                  <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mt-0.5">Moy.</p>
                </div>
              </div>
            </div>

            {/* RDV à évaluer */}
            {reservationsTerminees.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Clients à évaluer</p>
                <div className="space-y-3">
                  {reservationsTerminees.slice(0, 10).map((r) => (
                    <div key={r.id} className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center font-black text-blue-500 text-[14px] shrink-0">
                        {(r.client_name || r.client_email || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-900 truncate">{r.client_name || emailToDisplayName(r.client_email)}</p>
                        <p className="text-[11px] text-gray-400 font-medium">{r.service_name} · {r.date}</p>
                      </div>
                      <button onClick={() => setNoterModal(r)}
                        className="bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl active:scale-95 transition-all shrink-0">
                        Évaluer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historique */}
            {avisEnvoyes.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Historique des évaluations</p>
                <div className="space-y-3">
                  {avisEnvoyes.map((a) => (
                    <div key={a.id} className="bg-white rounded-3xl p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500 text-[13px] shrink-0">
                          {(a.cible_nom || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-gray-900 truncate">{a.cible_nom || emailToDisplayName(a.cible_email)}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{new Date(a.created_date || a.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                        <StarDisplay value={a.note} size="w-3.5 h-3.5" />
                      </div>
                      {a.commentaire && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-2">
                          <p className="text-[12px] text-gray-600 font-medium leading-snug">{a.commentaire}</p>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        {a.criteres?.presence && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.criteres.presence === "present" ? "bg-green-100 text-green-600" : a.criteres.presence === "absent" ? "bg-red-100 text-red-500" : "bg-yellow-100 text-yellow-600"}`}>
                            {a.criteres.presence === "present" ? "Présent" : a.criteres.presence === "absent" ? "No-show" : "En retard"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reservationsTerminees.length === 0 && avisEnvoyes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Aucun client à évaluer</p>
              </div>
            )}
          </>
        )}
      </div>

      {noterModal && <NoterClientModal reservation={noterModal} onClose={() => setNoterModal(null)} onSaved={loadData} />}
    </div>
  );
}
