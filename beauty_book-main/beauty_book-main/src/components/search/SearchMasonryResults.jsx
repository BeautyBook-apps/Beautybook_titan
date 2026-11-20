import { useRef, useState } from "react";
import { Heart } from "lucide-react";
import BeautyImage from "@/components/ui/BeautyImage";

function firstImage(...values) {
  for (const value of values.flat()) {
    const url = typeof value === "string" ? value : value?.url || value?.src || value?.image_url || "";
    if (url) return url;
  }
  return "";
}

function resultKind(item) {
  return item.entityKind || item.kind || (item.type_activite === "Particulier" ? "particulier" : "salon");
}

function resultTitle(item, kind) {
  return item.title || item.name || item.salon_name || item.business_name || item.nom ||
    (kind === "bundle" ? "Bundle beauté" : kind === "service" ? "Prestation beauté" : "Style beauté");
}

function resultMedia(item) {
  return {
    image: firstImage(item.image, item.image_url, item.img, item.cover_url, item.thumbnail_url, item.avatar_url, item.images, item.galerie_urls, item.portfolio),
    video: item.video_url || item.presentation_video_url || item.media_url || "",
  };
}

function authorFor(item, kind) {
  return item.author_name || item.pro_name || item.provider_name || item.salon_name || item.business_name || item.owner_name || item.brand || item.vendor ||
    (kind === "style" || kind === "social" ? "BeautyBook" : kind === "particulier" ? "Prestataire indépendant" : kind === "immobilier" ? "Annonce immobilière" : kind === "product" ? "Boutique BeautyBook" : "Commerce BeautyBook");
}

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(date);
}

function SearchMasonryCard({ item, onOpen }) {
  const videoRef = useRef(null);
  const videoDownAtRef = useRef(0);
  const suppressOpenRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const kind = resultKind(item);
  const title = resultTitle(item, kind);
  const { image, video } = resultMedia(item);
  const author = authorFor(item, kind);
  const avatar = firstImage(item.author_avatar_url, item.pro_avatar_url, item.avatar_url, item.profile_image_url, item.logo_url, item.owner_avatar_url);
  const date = dateLabel(item.created_at || item.created_date || item.published_at);
  const likes = Number(item.likes_count ?? item.likes ?? item.favorite_count ?? 0);
  const open = () => onOpen?.(item);
  const holdPlay = event => {
    event.stopPropagation();
    if (!video || !videoRef.current) return;
    videoDownAtRef.current = Date.now();
    videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
  };
  const holdStop = event => {
    event.stopPropagation();
    if (!videoRef.current) return;
    suppressOpenRef.current = Date.now() - videoDownAtRef.current > 180;
    if (suppressOpenRef.current) setTimeout(() => { suppressOpenRef.current = false; }, 350);
    videoRef.current.pause();
    setPlaying(false);
  };

  return (
    <article onClick={() => { if (!suppressOpenRef.current) open(); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }} tabIndex={0} role="button" className="min-w-0 overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/[0.05] transition active:scale-[0.99]">
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
        {video ? <video ref={videoRef} src={video} poster={image || undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" onPointerDown={holdPlay} onPointerUp={holdStop} onPointerCancel={holdStop} onPointerLeave={holdStop} />
          : image ? <BeautyImage src={image} alt={title} loading="lazy" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-50 to-rose-50 text-4xl">{kind === "service" ? "💆🏽‍♀️" : kind === "bundle" ? "🎁" : "✨"}</div>}
        {video && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[9px] font-black text-white">{playing ? "LECTURE" : "VIDÉO"}</span>}
        {item.badge && <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white">{item.badge}</span>}
        {(kind === "immobilier" || kind === "product") && <span className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-[12px] font-black text-orange-600 shadow">{Number(item.price || 0).toLocaleString("fr-FR")} €{kind === "immobilier" && item.unit ? ` / ${item.unit}` : ""}</span>}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-gray-900">{title}</p>
        {kind === "immobilier" && <p className="mt-1 truncate text-[10px] text-gray-500">{item.location || item.city || ""}{item.surface ? ` · ${item.surface}` : ""}</p>}
        <div className="mt-2 flex items-center gap-2">
          {avatar ? <BeautyImage src={avatar} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            : <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-100 text-[11px] font-black text-orange-700">{author.slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-gray-600">{author}</p>
            {date && <p className="text-[10px] text-gray-400">{date}</p>}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-gray-500"><Heart className="h-4 w-4" />{likes.toLocaleString("fr-FR")}</span>
        </div>
      </div>
    </article>
  );
}

export function navigateToSearchResult(navigate, item) {
  const kind = resultKind(item);
  if (kind === "immobilier") {
    navigate(`/immobilier/${item.id}`, { state: item });
  } else if (kind === "style") {
    navigate(`/style/${item.id}`, { state: { ...item, id: item.id, title: resultTitle(item, kind), cover: resultMedia(item).image, images: item.images || [], category: item.category } });
  } else if (kind === "service") {
    navigate(`/service/${item.id}`, { state: { ...item, id: item.id, title: resultTitle(item, kind), cover: resultMedia(item).image } });
  } else if (kind === "bundle") {
    navigate(item.is_group ? `/bundle-groupe/${item.id}` : `/bundle/${item.id}`, { state: { bundle: item } });
  } else if (kind === "product") {
    navigate(`/produit?id=${encodeURIComponent(item.id)}`, { state: { product: item } });
  } else if (kind === "social") {
    navigate(`/reels?reelId=${encodeURIComponent(item.id)}`);
  } else {
    navigate("/pro/vue-client", { state: { proEmail: item.user_email, profil: item } });
  }
}

export default function SearchMasonryResults({ items = [], onOpen }) {
  if (!items.length) return null;
  return <div className="grid grid-cols-2 items-start gap-2.5 sm:gap-3">{items.map((item, index) => <SearchMasonryCard key={`${resultKind(item)}-${item.id || index}`} item={item} onOpen={onOpen} />)}</div>;
}
