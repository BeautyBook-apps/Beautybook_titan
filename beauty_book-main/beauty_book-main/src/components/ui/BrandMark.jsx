import { useState } from "react";

const SIMPLE_ICON_BRANDS = {
  uber: { slug: "uber", color: "FFFFFF" },
  whatsapp: { slug: "whatsapp", color: "25D366" },
  instagram: { slug: "instagram", color: "E4405F" },
  tiktok: { slug: "tiktok", color: "111111" },
};

const PROVIDER_DOMAINS = {
  bolt: "bolt.eu",
  freenow: "free-now.com",
  heetch: "heetch.com",
  lecab: "lecab.fr",
  g7: "g7.fr",
};

const WORDMARK_STYLES = {
  bolt: { text: "Bolt", className: "font-black italic tracking-[-.08em]" },
  freenow: { text: "FREE NOW", className: "font-black tracking-[-.07em]" },
  heetch: { text: "heetch", className: "font-black tracking-[-.06em]" },
  lecab: { text: "LeCab", className: "font-black tracking-[-.08em]" },
  g7: { text: "G7", className: "font-black italic tracking-[-.09em]" },
};

/** Official brand glyph when available; otherwise a branded wordmark fallback. */
export default function BrandMark({ brand, label, className = "", size = 26 }) {
  const icon = SIMPLE_ICON_BRANDS[brand];
  const wordmark = WORDMARK_STYLES[brand];
  const logoUrl = icon
    ? `https://cdn.simpleicons.org/${icon.slug}/${icon.color}`
    : PROVIDER_DOMAINS[brand]
      ? `https://www.google.com/s2/favicons?domain=${PROVIDER_DOMAINS[brand]}&sz=128`
      : "";
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${label || brand} logo`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`block object-contain ${className}`}
      />
    );
  }

  return (
    <span aria-label={`${label || brand} logo`} role="img" className={`${wordmark?.className || "font-black"} ${className}`}>
      {wordmark?.text || label || brand}
    </span>
  );
}
