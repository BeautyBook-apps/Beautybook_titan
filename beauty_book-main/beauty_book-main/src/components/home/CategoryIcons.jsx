import React from "react";

// Assets vectoriels inspirés des références fournies pour l'accueil.
const VectorCategoryIcon = ({ asset, size = 28, className = "", strokeWidth: _strokeWidth, ...props }) => {
  const mask = `url(/category-icons/${asset}.svg)`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
      {...props}
    />
  );
};

export const HomeCoiffureIcon = (props) => <VectorCategoryIcon asset="coiffure" {...props} />;
export const HomePerruqueIcon = (props) => <VectorCategoryIcon asset="perruque" {...props} />;
export const HomeTressesIcon = (props) => <VectorCategoryIcon asset="tresses" {...props} />;

// ── 1. Tous : Étoile éclatante & découverte ──
export const TousIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 2l2.4 6.2 6.6 1.4-4.8 4.6 1.2 6.8-5.4-3.5-5.4 3.5 1.2-6.8L3 9.6l6.6-1.4L12 2z" />
    <circle cx="19" cy="4" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

// ── 2. Coiffure : Ciseaux & peigne de salon ──
export const CoiffureIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="8.5" y1="8.5" x2="19" y2="19" />
    <line x1="8.5" y1="15.5" x2="19" y2="5" />
    <path d="M17 10h4M17 12h3M17 14h4" strokeWidth={1.5} />
  </svg>
);

// ── 3. Perruque : Chevelure volumineuse sur support ──
export const PerruqueIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M5 12C4 7 6.5 3 12 3s8 4 7 9c-.5 2.5-1.5 5.5-1.5 8H6.5C6.5 17.5 5.5 14.5 5 12z" />
    <path d="M12 3c-1.5 3-3 5-4.5 7" />
    <path d="M12 5c1.5 2.5 3 4.5 4.5 6" />
    <path d="M9.5 20v2h5v-2" />
  </svg>
);

// ── 4. Tresses : Véritable tresse nattée 3 brins ──
export const TressesIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M8 2c3.5 1.8 5.5 3.8 5.5 5.5-2.5 1.8-5.5 3.8-5.5 5.5s5.5 3.8 5.5 5.5c-2.5 1.5-4 2.5-5 3.5" />
    <path d="M16 2c-3.5 1.8-5.5 3.8-5.5 5.5 2.5 1.8 5.5 3.8 5.5 5.5s-5.5 3.8-5.5 5.5c2.5 1.5 4 2.5 5 3.5" />
    <line x1="9.5" y1="5" x2="13.5" y2="7.5" strokeWidth={1.5} opacity="0.6" />
    <line x1="10.5" y1="11" x2="14.5" y2="13.5" strokeWidth={1.5} opacity="0.6" />
    <line x1="9.5" y1="16.5" x2="13.5" y2="19" strokeWidth={1.5} opacity="0.6" />
    <rect x="10.5" y="21" width="3" height="2" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
);

// ── 5. Extensions : Mèches avec barrette à clip & longueur ──
export const ExtensionsIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="5" y="3" width="14" height="3" rx="1.5" />
    <circle cx="8" cy="4.5" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="16" cy="4.5" r="0.75" fill="currentColor" stroke="none" />
    <path d="M7 6c-.5 5-2 9 0 15" />
    <path d="M11 6c0 6-1 11 1 15" />
    <path d="M15 6c0 5 1 9 0 15" />
    <path d="M17 6c.5 6 2 10 0 15" />
    <path d="M19 12l1 1-1 1-1-1z" fill="currentColor" stroke="none" />
  </svg>
);

// ── 6. Maquillage : Tube de rouge à lèvres (Lipstick) biseauté ──
export const MaquillageIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="7" y="12" width="10" height="9" rx="1.5" />
    <line x1="7" y1="15.5" x2="17" y2="15.5" />
    <path d="M9 12V8h6v4" />
    <path d="M9 8l4-5.5c1 0 3 1.5 3 4.5v1H9z" />
  </svg>
);

// ── 7. Ongles : Flacon de vernis à ongles & pinceau ──
export const OnglesIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="6" y="10" width="12" height="11" rx="3" />
    <path d="M10 10V6.5h4V10" />
    <rect x="9" y="2" width="6" height="4.5" rx="1" />
    <path d="M9 16c1.5 1.2 4.5 1.2 6 0" strokeWidth={1.5} opacity="0.7" />
  </svg>
);

// ── 8. Pédicure : Pied soigné avec orteils vernis ──
export const PedicureIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M6 17.5c0-3 1.5-6 4-7.5l2.5-4c.5-1 2-1 2.5 0l1 2.5c.5 1 1.2 1.8 2 2.5 2 1.5 2.5 3.5 2.5 5 0 2.5-2 4.5-5 4.5H9c-2 0-3-1.5-3-3z" />
    <circle cx="16.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="5" r="0.9" fill="currentColor" stroke="none" />
    <path d="M4 8c0 1.5-1 2.5-2 2.5S0 9.5 0 8c0-1 2-3 2-3s2 2 2 3z" fill="currentColor" stroke="none" />
  </svg>
);

// ── 9. Soin : Pipette compte-gouttes avec sérum visage ──
export const SoinIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M14.5 3.5a2.5 2.5 0 0 0-3.5 0l-1.5 1.5 3.5 3.5 1.5-1.5a2.5 2.5 0 0 0 0-3.5z" />
    <path d="M9.5 5L4.5 10l3.5 3.5 5-5" />
    <path d="M4.5 10L2 15l4.5-1" />
    <path d="M17.5 13.5c0 2-1.5 3.5-1.5 3.5s-1.5-1.5-1.5-3.5a1.5 1.5 0 0 1 3 0z" fill="currentColor" />
  </svg>
);

// ── 10. Barbe : Moustache & barbe de barbier soignée ──
export const BarbeIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M6 7.5c2 0 4 1.5 6 3 2-1.5 4-3 6-3s3 1.5 3 3c-1.5 2-4 2-9 1-5 1-7.5 1-9-1 0-1.5 1-3 3-3z" />
    <path d="M4 6c0 7.5 3.5 14 8 14s8-6.5 8-14" />
    <path d="M8 14.5c1.2 1.8 2.5 2.5 4 2.5s2.8-.7 4-2.5" />
  </svg>
);

// ── 11. Massage : Pierres de massage chaudes & mains apaisantes ──
export const MassageIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <ellipse cx="12" cy="7" rx="3.5" ry="2" />
    <ellipse cx="12" cy="11" rx="5.5" ry="2.5" />
    <path d="M5 14c-1.5-1-3-1-4 .5s-.5 3 1.5 4.5l5.5 3.5 5-1.5" />
    <path d="M19 14c1.5-1 3-1 4 .5s.5 3-1.5 4.5l-5.5 3.5-5-1.5" />
  </svg>
);

// ── 12. Épilation : Pince à épiler de précision & peau satinée ──
export const EpilationIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M7 3l8 15c.5 1 1.5 2 2.5 2h.5l-3.5-17H10l-3 0z" />
    <path d="M7 3l3.5 15c.3 1 .8 2 1.5 2" />
    <path d="M10 11.5h4.5" />
    <path d="M19 7l1 1-1 1-1-1z" fill="currentColor" stroke="none" />
    <path d="M4 17l1 1-1 1-1-1z" fill="currentColor" stroke="none" />
  </svg>
);

// ── 13. Cils : Œil élégant avec longs cils recourbés ──
export const CilsIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M3 14c3-5 6-7 9-7s6 2 9 7" />
    <path d="M7 14a5 5 0 0 0 10 0" />
    <circle cx="12" cy="14" r="2.5" fill="currentColor" />
    <line x1="5" y1="11" x2="3.5" y2="7.5" />
    <line x1="8" y1="8.5" x2="7" y2="5" />
    <line x1="12" y1="7.5" x2="12" y2="3.5" />
    <line x1="16" y1="8.5" x2="17" y2="5" />
    <line x1="19" y1="11" x2="20.5" y2="7.5" />
  </svg>
);

// ── 14. Spa : Fleur de lotus épanouie sur l'eau ──
export const SpaIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 4c-1 3-3 6-6 7 2 2 5 2 6 0 1 2 4 2 6 0-3-1-5-4-6-7z" />
    <path d="M12 4c-2 4-2 8 0 11 2-3 2-7 0-11z" />
    <path d="M3 13.5c1.5 2 4 2.5 6 1.5" />
    <path d="M21 13.5c-1.5 2-4 2.5-6 1.5" />
    <path d="M5 19c3.5 1 10.5 1 14 0" />
    <path d="M8 21.5c2.5.6 5.5.6 8 0" />
  </svg>
);

// ── 15. Tatouage : Machine à tatouer rotative avec aiguille ──
export const TatouageIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M17.5 3.5l3 3-9 9-3.5.5.5-3.5 9-9z" />
    <path d="M8 12.5L3 17.5v3.5h3.5l5-5" />
    <line x1="3" y1="21" x2="1" y2="23" strokeWidth={2.5} />
    <circle cx="16.5" cy="17.5" r="2" fill="currentColor" stroke="none" />
  </svg>
);

// ── 16. Piercing : Anneau avec strass & bijou captif ──
export const PiercingIcon = ({ size = 28, className = "", strokeWidth = 1.9, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 4a8 8 0 1 0 7.5 5.5" />
    <circle cx="17.5" cy="7" r="2.8" fill="currentColor" />
    <path d="M17.5 2v2M17.5 10v2M12.5 7h2M20.5 7h2" opacity="0.6" strokeWidth={1.5} />
  </svg>
);

export const BEAUTY_CATEGORY_ICONS = {
  tous: TousIcon,
  coiffure: CoiffureIcon,
  perruque: PerruqueIcon,
  tresses: TressesIcon,
  extensions: ExtensionsIcon,
  maquillage: MaquillageIcon,
  ongles: OnglesIcon,
  pedicure: PedicureIcon,
  soin: SoinIcon,
  barbe: BarbeIcon,
  massage: MassageIcon,
  epilation: EpilationIcon,
  cils: CilsIcon,
  spa: SpaIcon,
  tatouage: TatouageIcon,
  piercing: PiercingIcon,
};
