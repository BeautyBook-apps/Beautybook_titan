import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Heart, MessageSquare, Phone, MapPin, Maximize2, Armchair, Zap, TrendingUp, X, Send, CheckCircle, Box, Users, User, Sparkles, Check } from "lucide-react";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { readPageCache, writePageCache } from "@/hooks/usePageCache";

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
  const [listing, setListing] = useState(() => state || readPageCache(id ? `immobilier_${id}` : null)?.listing || null);
  const [imgIdx, setImgIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showMsgModal, setShowMsgModal] = useState(false);

  // Charger le listing depuis la BDD si on a un ID.
  // Navigation d'une annonce à l'autre : afficher le cache de la nouvelle annonce
  // immédiatement plutôt que de vider l'affichage ; le refresh suit en arrière-plan.
  useEffect(() => {
    if (!id) return;
    const cacheKey = `immobilier_${id}`;
    if (state) {
      // Navigation depuis la liste : l'objet transmis est le plus frais.
      setListing(state);
    } else {
      const cached = readPageCache(cacheKey);
      if (cached?.listing) setListing(cached.listing);
      // Sinon on garde l'affichage actuel (jamais de reset à vide).
    }
    setImgIdx(0);
    entities.ImmobilierListing.filter({ status: "actif" }, "-created_at", 100)
      .then(all => {
        const found = all.find(l => l.id === id);
        if (found) {
          setListing(found);
          writePageCache(cacheKey, { listing: found });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const data = listing || FALLBACK;
  const images = data.images?.length ? data.images : FALLBACK.images;
  const phone = data.contact_phone || ADMIN_PHONE;

  return (
    <div className="font-display bg-[#f5f5f5] min-h-full" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>

      {showMsgModal && <MessageModal listing={data} onClose={() => setShowMsgModal(false)} />}

      {/* ── Gallery ── */}
      <div className="relative h-[300px] bg-black">
        <BeautyImage src={images[imgIdx]} alt={data.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

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
          <button onClick={() => setLiked(l => !l)} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow active:scale-95 transition-all">
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
            <p className="text-white text-[32px] font-black leading-none">5 500 € <span className="text-[16px] font-bold">/mois</span></p>
            <div className="flex items-center gap-1 mt-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 text-[11px] font-bold">+12% vs secteur</span>
            </div>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-4">
            <p className="text-white/80 text-[10px] font-black uppercase tracking-widest mb-1">REVENU NET ESTIMÉ (EBE)</p>
            <p className="text-white text-[32px] font-black leading-none">3 200 € <span className="text-[16px] font-bold">/mois</span></p>
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
              <p className="text-[11px] text-gray-500 font-medium">{data.area || "Zone premium"}</p>
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

        {/* Visite virtuelle 3D */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <Box className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[13px] font-black text-gray-900 uppercase tracking-wider">VISITE VIRTUELLE 3D</span>
          </div>
          <button
            onClick={() => setShowMsgModal(true)}
            className="relative w-full h-40 rounded-2xl overflow-hidden active:scale-[0.99] transition-all"
          >
            <BeautyImage src={images[0]} alt="Visite 3D" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                <Box className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-white text-[12px] font-black uppercase tracking-widest">Lancer la visite 3D</span>
            </div>
          </button>
          <p className="text-[11px] text-gray-400 font-medium text-center mt-2">Explorez l'espace à 360° avant votre visite</p>
        </div>

        {/* Nombre de sièges & Propriétaire */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl p-4 shadow-sm flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-[22px] font-black text-gray-900 leading-none">{data.seats_count || data.seats || 1}</p>
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
          <p className="text-[13px] text-gray-600 leading-relaxed text-justify">
            {data.description
              ? (showFullDesc ? data.description : data.description.slice(0, 180) + (data.description.length > 180 ? "…" : ""))
              : "Aucune description fournie pour cette offre."}
          </p>
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