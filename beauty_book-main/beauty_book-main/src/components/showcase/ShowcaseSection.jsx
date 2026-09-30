import { useState, useEffect } from "react";
import { Sparkles, Star } from "lucide-react";
import BeautyImage from "@/components/ui/BeautyImage";
import Lightbox from "@/components/ui/Lightbox";
import { getShowcasePhotos, getShowcaseReviews } from "@/lib/showcase";

// ── Section « Prestations réalisées » ─────────────────────────────────
// Vitrine photo du service / bundle, affichée juste au-dessus des avis.
// Chaque photo publiée après un RDV est ASSOCIÉE à l'avis laissé par le
// client pour ce RDV : badge ★ sur la photo + carte avis dans le plein écran.
// Un clic sur une photo l'agrandit en plein écran (Lightbox).
// Props optionnelles : title, headerAction (bouton dans l'en-tête),
// showWhenEmpty (affiche la section même sans photo, ex. pour en ajouter).
function Stars({ note = 0, size = "w-3 h-3" }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${size} ${i <= Math.round(note) ? "text-yellow-400 fill-yellow-400" : "text-gray-300 fill-gray-300"}`} />
      ))}
    </span>
  );
}

export default function ShowcaseSection({ serviceId, isBundle = false, title = "Prestations réalisées", headerAction = null, showWhenEmpty = false }) {
  const [photos, setPhotos] = useState([]);
  const [reviews, setReviews] = useState({});
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await getShowcasePhotos(serviceId, isBundle);
      if (!alive) return;
      setPhotos(list);
      const map = await getShowcaseReviews(list);
      if (alive) setReviews(map);
    })();
    return () => { alive = false; };
  }, [serviceId, isBundle]);

  if (photos.length === 0 && !showWhenEmpty) return null;

  const reviewFor = (p) => (p.reservation_id && reviews[p.reservation_id]) || null;
  const currentReview = lightboxIdx !== null ? reviewFor(photos[lightboxIdx] || {}) : null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-[15px] font-black text-gray-900 flex-1">{title}</h3>
        {photos.length > 0 && (
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
        )}
        {headerAction}
      </div>

      {photos.length === 0 ? (
        <p className="text-[12px] text-gray-400 font-medium px-1 pb-1">Aucune photo pour le moment — ajoutez le résultat de cette prestation.</p>
      ) : (
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p, i) => {
          const rev = reviewFor(p);
          return (
            <button
              key={p.id || i}
              onClick={() => setLightboxIdx(i)}
              className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 active:scale-[0.97] transition-all"
              aria-label={`Agrandir la photo ${i + 1}`}
            >
              <BeautyImage src={p.url} alt={p.caption || `Prestation réalisée ${i + 1}`} className="w-full h-full object-cover" />
              {rev && (
                <span className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-white text-[9px] font-black">{Number(rev.note) || "—"}</span>
                </span>
              )}
              {p.caption ? (
                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-left">
                  <span className="text-white text-[10px] font-bold leading-tight line-clamp-2">{p.caption}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox images={photos} initialIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      {/* Avis du client associé à la photo affichée en plein écran */}
      {lightboxIdx !== null && currentReview && (
        <div className="fixed bottom-0 left-0 right-0 z-[10000] px-4" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="max-w-md mx-auto bg-white/95 backdrop-blur rounded-2xl p-3.5 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2.5">
              {currentReview.auteur_avatar ? (
                <BeautyImage src={currentReview.auteur_avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[13px] font-black text-primary">{(currentReview.auteur_nom || "?")[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-black text-gray-900 truncate">{currentReview.auteur_nom || "Cliente vérifiée"}</p>
                <Stars note={currentReview.note} />
              </div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest shrink-0">Avis client</span>
            </div>
            {currentReview.commentaire && (
              <p className="text-[12px] text-gray-600 font-medium leading-relaxed mt-2 line-clamp-3">« {currentReview.commentaire} »</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
