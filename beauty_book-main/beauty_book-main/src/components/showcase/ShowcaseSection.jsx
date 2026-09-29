import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import BeautyImage from "@/components/ui/BeautyImage";
import Lightbox from "@/components/ui/Lightbox";
import { getShowcasePhotos } from "@/lib/showcase";

// ── Section « Prestations réalisées » ─────────────────────────────────
// Vitrine photo du service / bundle, affichée juste au-dessus des avis.
// Un clic sur une photo l'agrandit en plein écran (Lightbox).
// Props optionnelles : title, headerAction (bouton dans l'en-tête),
// showWhenEmpty (affiche la section même sans photo, ex. pour en ajouter).
export default function ShowcaseSection({ serviceId, isBundle = false, title = "Prestations réalisées", headerAction = null, showWhenEmpty = false }) {
  const [photos, setPhotos] = useState([]);
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    let alive = true;
    getShowcasePhotos(serviceId, isBundle).then(list => { if (alive) setPhotos(list); });
    return () => { alive = false; };
  }, [serviceId, isBundle]);

  if (photos.length === 0 && !showWhenEmpty) return null;

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
        {photos.map((p, i) => (
          <button
            key={p.id || i}
            onClick={() => setLightboxIdx(i)}
            className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 active:scale-[0.97] transition-all"
            aria-label={`Agrandir la photo ${i + 1}`}
          >
            <BeautyImage src={p.url} alt={p.caption || `Prestation réalisée ${i + 1}`} className="w-full h-full object-cover" />
            {p.caption ? (
              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-left">
                <span className="text-white text-[10px] font-bold leading-tight line-clamp-2">{p.caption}</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox images={photos} initialIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}
