import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Heart, MessageSquare, Phone, MapPin, Maximize2, Armchair, Zap, TrendingUp, X, Send, CheckCircle, Box, Users, User, Sparkles, Check, ExternalLink } from "lucide-react";
import { entities } from '@/api/entities';
import apiClient from '@/lib/apiClient';
import { supabase } from '@/api/supabaseClient';
import { likesApi } from '@/api/likes';
import { readPageCache, writePageCache } from "@/hooks/usePageCache";
import MapWithPricePins from "@/components/map/MapWithPricePins";
import PanoViewer from "@/components/virtualtour/PanoViewer";

const FALLBACK = {
  images: [""],
  badge: "PRO",
  title: "Poste de coiffure en location – Paris 8",
  location: "PARIS 8ÈME",
  area: "TRIANGLE D'OR",
  price: 650,
  unit: "MENSUEL HT",
  surface: "15 m²",
  equip: "Meublé",
  dpe: "A",
  type: "location",
  contact_phone: "+33 1 00 00 00 00",
};

// Email de l'admin (destinataire des messages depuis l'immo)
const ADMIN_EMAIL = "admin@beautybook.fr";
const ADMIN_PHONE = "+33 1 00 00 00 00";

// Les annonces historiques peuvent encore contenir les anciens noms de
// colonnes. On les normalise ici afin que la fiche publique affiche toujours
// les montants enregistrés dans l'administration.
const normalizeListing = (value) => {
  if (!value) return value;
  return {
    ...value,
    estimated_turnover: value.estimated_turnover ?? value.estimatedTurnover ?? value.estimated_ca ?? value.ca_estime ?? value.ca_estime_mensuel ?? null,
    estimated_net_revenue: value.estimated_net_revenue ?? value.estimatedNetRevenue ?? value.ebe_estime ?? value.net_revenue ?? value.revenu_net_estime ?? value.revenue_net_estime ?? null,
  };
};

const toAmount = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

function MessageModal({ listing, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null).then(user => {
      if (user) {
        setName(user.full_name || "");
        setEmail(user.email || "");
      }
    });
  }, []);

  const handleSend = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const user = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);
      const convId = [user?.email || email, ADMIN_EMAIL].sort().join("_");
      await entities.MessageChat.create({
        conversation_id: convId,
        sender_email: user?.email || email,
        receiver_email: ADMIN_EMAIL,
        content: `📍 Offre immobilière : "${listing.title}"\n\n${msg}`,
        read: false,
      });
      // Notifier l'admin (via Notification entity)
      await base44.asServiceRole?.entities?.Notification?.create?.({
        user_email: ADMIN_EMAIL,
        type: "message",
        title: `Nouveau message immobilier`,
        body: `"${listing.title}" — ${name || email} : ${msg.slice(0, 60)}`,
        icon: "🏠",
        link: "/admin/dashboard",
        read: false,
      }).catch(() => {});
      setSent(true);
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-black text-gray-900">Envoyer un message</h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-[15px] font-black text-gray-900">Message envoyé !</p>
            <p className="text-[12px] text-gray-500 text-center">Notre équipe vous répondra dans les plus brefs délais.</p>
            <button onClick={onClose} className="mt-2 bg-primary text-white px-8 py-3 rounded-2xl font-black text-[13px] active:scale-95 transition-all">Fermer</button>
          </div>
        ) : (
          <>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 flex items-center gap-2">
              <span className="text-[20px]">🏠</span>
              <div>
                <p className="text-[11px] font-black text-gray-900 line-clamp-1">{listing.title}</p>
                <p className="text-[10px] text-primary font-bold">{listing.price}€ {listing.unit || "/mois"}</p>
              </div>
            </div>

            {!email && (
              <div className="grid grid-cols-2 gap-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Votre prénom" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-primary" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Votre email" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-[13px] outline-none focus:border-primary" />
              </div>
            )}

            {/* Suggestions rapides */}
            <div className="flex flex-wrap gap-2">
              {["Je suis intéressé(e) par cette offre", "Pouvez-vous me donner plus d'infos ?", "Je souhaite visiter"].map(s => (
                <button key={s} onClick={() => setMsg(s)} className="text-[10px] font-black text-primary bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5 active:scale-95 transition-all">
                  {s}
                </button>
              ))}
            </div>

            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Votre message..."
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-primary resize-none"
            />

            <button
              onClick={handleSend}
              disabled={!msg.trim() || sending}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
            >
              {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Envoi..." : "Envoyer le message"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ImmobilierDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();

  // Affichage direct : le state de navigation d'abord (le plus frais),
  // sinon le cache de cette annonce — jamais un affichage vide.
  const [listing, setListing] = useState(() => normalizeListing(state || readPageCache(id ? `immobilier_${id}` : null)?.listing || null));
  const [imgIdx, setImgIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [virtualTour, setVirtualTour] = useState(() => state?.virtual_tour || null);
  const [virtualTourLoading, setVirtualTourLoading] = useState(false);
  const [showVirtualTour, setShowVirtualTour] = useState(false);

  // Charger le listing depuis la BDD si on a un ID.
  // Navigation d'une annonce à l'autre : afficher le cache de la nouvelle annonce
  // immédiatement plutôt que de vider l'affichage ; le refresh suit en arrière-plan.
  useEffect(() => {
    if (!id) return;
    const cacheKey = `immobilier_${id}`;
    if (state) {
      // Navigation depuis la liste : l'objet transmis est le plus frais.
      setListing(normalizeListing(state));
    } else {
      const cached = readPageCache(cacheKey);
      if (cached?.listing) setListing(normalizeListing(cached.listing));
      // Sinon on garde l'affichage actuel (jamais de reset à vide).
    }
    setImgIdx(0);
    // En développement sans backend explicitement configuré, lire directement
    // l'entité Supabase comme la page liste. Cela évite un POST proxy inutile
    // vers localhost et conserve le fallback si le backend n'est pas lancé.
    const loadListing = async () => {
      let found = null;
      if (import.meta.env.DEV && !import.meta.env.VITE_BACKEND_URL) {
        found = await entities.ImmobilierListing.get(id).catch(() => null);
      } else {
        // Le endpoint de contenu accepte listingId et évite de dépendre de la
        // limite de la liste publique ou d'un cache incomplet.
        found = await apiClient.callFunction("getImmobilier", { listingId: id })
          .then(response => response?.data?.listing || null)
          .catch(() => entities.ImmobilierListing.get(id).catch(() => null));
      }
      if (!found) return;
      setListing(current => {
        const merged = normalizeListing({ ...(current || {}), ...found });
        writePageCache(cacheKey, { listing: merged });
        return merged;
      });
    };
    loadListing().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const tourId = listing?.virtual_tour_id;
    const embeddedTour = listing?.virtual_tour || null;
    if (embeddedTour?.scenes?.length) {
      setVirtualTour(embeddedTour);
      setVirtualTourLoading(false);
      return undefined;
    }
    if (!tourId && !listing?.title) {
      setVirtualTour(null);
      setVirtualTourLoading(false);
      return undefined;
    }
    let cancelled = false;
    setVirtualTourLoading(true);
    const loadTour = async () => {
      let tour = null;
      if (tourId) {
        tour = await entities.VisiteVirtuelle.get(tourId).catch(() => null);
      }
      // Compatibilité avec les visites créées avant l'ajout de
      // ImmobilierListing.virtual_tour_id : le titre permet de retrouver la
      // visite existante et de l'ouvrir sans demander un nouveau contact.
      if (!tour && listing?.title) {
        const matches = await entities.VisiteVirtuelle.filter({ title: listing.title }, "-created_at", 20).catch(() => []);
        tour = matches.find(item => item?.scenes?.length) || matches[0] || null;
      }
      if (!cancelled) {
        setVirtualTour(tour);
        setVirtualTourLoading(false);
      }
    };
    loadTour().catch(() => { if (!cancelled) { setVirtualTour(null); setVirtualTourLoading(false); } });
    return () => { cancelled = true; };
  }, [listing?.title, listing?.virtual_tour_id, listing?.virtual_tour]);

  const data = listing || FALLBACK;
  const images = data.images?.length ? data.images : FALLBACK.images;

  useEffect(() => {
    let cancelled = false;
    setLiked(false);
    (async () => {
      if (!id) return;
      const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: {} }));
      const email = authData?.user?.email;
      if (!email) return;
      const rows = await likesApi.getUserLikes(email, [id], "immobilier");
      if (!cancelled) setLiked(rows.length > 0);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const toggleLike = async () => {
    const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: {} }));
    const user = authData?.user;
    if (!user?.email) return;
    const targetId = data.id || id;
    const nextLiked = !liked;
    setLiked(nextLiked);
    try {
      if (nextLiked) {
        await likesApi.addLike(
          user.email,
          targetId,
          "immobilier",
          user.user_metadata?.full_name || user.user_metadata?.name || "",
          user.user_metadata?.avatar_url || "",
        );
      } else {
        await likesApi.removeLike(user.email, targetId, "immobilier");
      }
    } catch {
      setLiked(!nextLiked);
    }
  };
  const phone = data.contact_phone || ADMIN_PHONE;
  const turnover = toAmount(data.estimated_turnover);
  const netRevenue = toAmount(data.estimated_net_revenue);
  const addressLabel = [data.address || data.location || data.city, data.postal_code, data.city && data.city !== data.location ? data.city : null].filter(Boolean).join(", ");
  const mapItem = [{ id: data.id || id || "listing", title: data.title, address: data.location || data.address, postal_code: data.postal_code, city: data.city, latitude: data.latitude ?? data._lat, longitude: data.longitude ?? data._lng, price: data.price }];
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(addressLabel || data.title || "Emplacement du local")}`;

  if (showVirtualTour && virtualTour?.scenes?.length) {
    return <PanoViewer scenes={virtualTour.scenes} floorplanUrl={virtualTour.floorplan_url} propertyName={data.title} propertyAddress={addressLabel} onClose={() => setShowVirtualTour(false)} />;
  }

  return (
    <div className="font-display bg-[#f5f5f5] min-h-full" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>

      {showMsgModal && <MessageModal listing={data} onClose={() => setShowMsgModal(false)} />}

      {showImageLightbox && images[imgIdx] && (
        <div
          className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-3"
          onClick={() => setShowImageLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image agrandie"
        >
          <button
            type="button"
            onClick={() => setShowImageLightbox(false)}
            aria-label="Fermer l'image"
            className="absolute top-5 right-5 z-20 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center backdrop-blur-sm"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={images[imgIdx]}
            alt={data.title}
            className="max-w-[96vw] max-h-[90vh] w-auto h-auto object-contain rounded-xl select-none"
            onClick={event => event.stopPropagation()}
          />
          {imgIdx > 0 && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); setImgIdx(index => index - 1); }}
              aria-label="Image précédente"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center backdrop-blur-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {imgIdx < images.length - 1 && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); setImgIdx(index => index + 1); }}
              aria-label="Image suivante"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center backdrop-blur-sm"
            >
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </button>
          )}
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-white text-xs font-bold">
            {imgIdx + 1}/{images.length}
          </span>
        </div>
      )}

      {/* ── Gallery ── */}
      <div className="relative h-[300px] bg-black">
        <BeautyImage
          src={images[imgIdx]}
          alt={data.title}
          onClick={() => setShowImageLightbox(true)}
          className="w-full h-full object-cover cursor-zoom-in"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {imgIdx > 0 && <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={() => setImgIdx(i => i - 1)} />}
        {imgIdx < images.length - 1 && <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={() => setImgIdx(i => i + 1)} />}

        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
          {images.map((_, i) => (
            <button key={i} onClick={() => setImgIdx(i)}
              className={`rounded-full transition-all ${i === imgIdx ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`} />
          ))}
        </div>

        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 z-20">
          <span className="text-white text-[11px] font-bold">{imgIdx + 1}/{images.length}</span>
        </div>

        <div className="absolute top-5 left-4 right-4 flex items-center justify-between z-30">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <button onClick={toggleLike} aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow active:scale-95 transition-all">
            <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : "text-gray-700"}`} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-4 space-y-3">

        {/* Title */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary rounded-full px-2.5 py-0.5 text-white text-[9px] font-black uppercase tracking-wider">{data.badge || "PRO"}</span>
          </div>
          <h1 className="text-[20px] font-black text-gray-900 leading-tight mb-1">{data.title}</h1>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-[28px] font-black text-primary leading-none">{data.price} €</span>
            <span className="text-[12px] font-black text-gray-400 uppercase tracking-wider">{data.unit || "MENSUEL HT"}</span>
          </div>
          <div className="flex items-center gap-4">
            {data.surface && <div className="flex items-center gap-1.5"><Maximize2 className="w-4 h-4 text-gray-400" /><span className="text-[12px] font-bold text-gray-600">{data.surface}</span></div>}
            {data.equip && <div className="flex items-center gap-1.5"><Armchair className="w-4 h-4 text-gray-400" /><span className="text-[12px] font-bold text-gray-600">{data.equip}</span></div>}
            {data.dpe && <div className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-gray-400" /><span className="text-[12px] font-bold text-gray-600">DPE: {data.dpe}</span></div>}
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-[13px] font-black text-gray-900 uppercase tracking-wider">PERFORMANCE ESTIMATIVE</span>
          </div>
          <div className="bg-[#1e2535] rounded-2xl p-4 mb-3">
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">CHIFFRE D'AFFAIRES ESTIMÉ</p>
            <p className="text-white text-[32px] font-black leading-none">{turnover > 0 ? `${turnover.toLocaleString("fr-FR")} €` : "—"} <span className="text-[16px] font-bold">{turnover > 0 ? "/mois" : "à renseigner"}</span></p>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-4">
            <p className="text-white/80 text-[10px] font-black uppercase tracking-widest mb-1">REVENU NET ESTIMÉ (EBE)</p>
            <p className="text-white text-[32px] font-black leading-none">{netRevenue > 0 ? `${netRevenue.toLocaleString("fr-FR")} €` : "—"} <span className="text-[16px] font-bold">{netRevenue > 0 ? "/mois" : "à renseigner"}</span></p>
            <span className="text-white/70 text-[11px] font-medium">✓ Après charges &amp; location</span>
          </div>
        </div>

        {/* Critères & Localisation */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-gray-900">Critères &<br />Localisation</h2>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[14px] font-black text-gray-900">{data.location || "Paris"}</p>
              <p className="text-[11px] text-gray-500 font-medium">{data.city || data.postal_code || "Localisation à préciser"}</p>
            </div>
          </div>
          {[
            { label: "Type de bien", value: data.type === "vente" ? "Vente" : "Location" },
            ...(data.surface ? [{ label: "Surface totale", value: data.surface }] : []),
            ...(data.extra ? [{ label: "Extra", value: data.extra }] : []),
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-[13px] text-gray-400 font-medium">{row.label}</span>
              <span className="text-[13px] font-black text-gray-900">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Apple Maps */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-[16px] font-black text-gray-900">Emplacement du local</h2>
                <p className="text-[11px] text-gray-500">{addressLabel || "Adresse à préciser"}</p>
              </div>
            </div>
            <a href={appleMapsUrl} target="_blank" rel="noreferrer" className="text-primary text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              Apple Plans <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <MapWithPricePins items={mapItem} height="h-44" />
        </div>

        {/* Visite virtuelle 3D */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <Box className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[13px] font-black text-gray-900 uppercase tracking-wider">VISITE VIRTUELLE 3D</span>
          </div>
          <button
            onClick={() => virtualTour?.scenes?.length ? setShowVirtualTour(true) : setShowMsgModal(true)}
            disabled={virtualTourLoading}
            className="relative w-full h-40 rounded-2xl overflow-hidden active:scale-[0.99] transition-all disabled:cursor-wait"
          >
            <BeautyImage src={virtualTour?.scenes?.[0]?.image_url || images[0]} alt="Visite 3D" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                <Box className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-white text-[12px] font-black uppercase tracking-widest">{virtualTourLoading ? "Chargement de la visite..." : virtualTour?.scenes?.length ? "Lancer la visite 3D" : "Demander une visite"}</span>
            </div>
          </button>
          <p className="text-[11px] text-gray-400 font-medium text-center mt-2">{virtualTour?.scenes?.length ? "Explorez l'espace à 360° avant votre visite" : "La visite virtuelle sera bientôt disponible"}</p>
        </div>

        {/* Nombre de sièges & Propriétaire */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl p-4 shadow-sm flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-[22px] font-black text-gray-900 leading-none">{data.seats_count ?? data.seats ?? 1}</p>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Sièges</p>
          </div>
          <div className="bg-white rounded-3xl p-4 shadow-sm flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-[14px] font-black text-gray-900 leading-tight line-clamp-1">{data.owner_name || data.pro_name || "Propriétaire Pro"}</p>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Propriétaire</p>
          </div>
        </div>

        {/* Atouts du bien */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-[13px] font-black text-gray-900 uppercase tracking-wider">ATOUTS DU BIEN</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(data.atouts?.length ? data.atouts : [
              "Emplacement premium",
              "Parking à proximité",
              "Transports en commun",
              "Vitrine sur rue",
              "Climatisation",
              "Accès PMR",
            ]).map((atout, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-[12px] font-bold text-gray-700 leading-tight">{atout}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <h2 className="text-[16px] font-black text-gray-900 mb-2">Description</h2>
          <div className="space-y-3 text-[13px] text-gray-600 leading-7 text-justify break-words">
            {(data.description || "Aucune description fournie pour cette offre.")
              .split(/\n+/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{showFullDesc || paragraph.length <= 180 ? paragraph : `${paragraph.slice(0, 180).trim()}…`}</p>
              ))}
          </div>
          {data.description?.length > 180 && (
            <button onClick={() => setShowFullDesc(v => !v)} className="mt-2 text-primary text-[12px] font-black uppercase tracking-wider">
              {showFullDesc ? "RÉDUIRE" : "LIRE LA SUITE"}
            </button>
          )}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 z-40 flex items-center gap-3 bg-white/90 backdrop-blur-md border-t border-gray-100 py-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <button
          onClick={() => setShowMsgModal(true)}
          className="flex-1 bg-primary rounded-full py-4 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-all">
          <MessageSquare className="w-5 h-5 text-white" />
          <span className="text-white text-[14px] font-black uppercase tracking-wider">MESSAGE</span>
        </button>
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          className="w-14 h-14 border-2 border-primary rounded-full flex items-center justify-center bg-white shadow active:scale-95 transition-all">
          <Phone className="w-5 h-5 text-primary" />
        </a>
      </div>
    </div>
  );
}
