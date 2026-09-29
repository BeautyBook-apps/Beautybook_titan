import { useState } from "react";
import { Camera } from "lucide-react";
import ShowcaseSection from "./ShowcaseSection";
import ShowcasePhotoStep from "./ShowcasePhotoStep";
import { showcaseTargetFromRdv } from "@/lib/showcase";

// ── Section « Photos de la prestation » dans le Détail du RDV ─────────
// Pour un RDV terminé : affiche les photos déjà publiées dans
// « Prestations réalisées » + permet d'en prendre / importer d'autres
// si le pro a oublié de le faire à la validation.
export default function RdvShowcaseManager({ rdv }) {
  const [showPicker, setShowPicker] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const target = showcaseTargetFromRdv(rdv);
  if (!target) return null;

  const closeAndReload = () => {
    setShowPicker(false);
    setReloadKey(k => k + 1); // recharge la grille après ajout
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-4 mb-3">
      <ShowcaseSection
        key={reloadKey}
        serviceId={target.serviceId}
        isBundle={target.isBundle}
        title="Photos de la prestation"
        showWhenEmpty
        headerAction={
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            Ajouter
          </button>
        }
      />

      {showPicker && (
        <ShowcasePhotoStep
          rdv={rdv}
          onDone={closeAndReload}
          onSkip={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
