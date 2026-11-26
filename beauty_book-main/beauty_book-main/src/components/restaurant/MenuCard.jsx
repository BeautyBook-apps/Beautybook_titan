import BeautyImage from "@/components/ui/BeautyImage";
import { UtensilsCrossed, Wine, ChevronRight } from "lucide-react";
import { isMenuItemFree, menuItemPriceLabel } from "@/lib/restaurantMenu";

export default function MenuCard({ item, kind = "restaurant", onClick }) {
  const isBar = kind === "bar";
  const title = item.nom || (isBar ? "Boisson" : "Plat");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Voir ${title}`}
      className="group flex min-h-[152px] w-full items-center gap-4 overflow-hidden rounded-[32px] border border-slate-100/80 bg-white p-3.5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.07)] transition-[box-shadow,transform] duration-200 active:scale-[0.995] active:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
    >
      <div className={`h-[124px] w-[124px] shrink-0 overflow-hidden rounded-[26px] ${isBar ? "bg-white" : "bg-slate-50"}`}>
        {item.image_url ? (
          <BeautyImage
            src={item.image_url}
            alt={title}
            className={`h-full w-full ${isBar ? "object-contain" : "object-cover"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-300">
            {isBar ? <Wine className="h-9 w-9" strokeWidth={1.5} /> : <UtensilsCrossed className="h-9 w-9" strokeWidth={1.5} />}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 py-1">
        <p className="truncate text-[20px] font-black leading-tight tracking-[-0.02em] text-slate-950 sm:text-[22px]">{title}</p>
        {item.description && <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug text-slate-400">{item.description}</p>}
        {(isMenuItemFree(item) || menuItemPriceLabel(item)) && (
          <p className={`mt-3 text-[20px] font-black leading-none ${isMenuItemFree(item) ? "text-emerald-600" : "text-primary"}`}>
            {menuItemPriceLabel(item)}
          </p>
        )}
      </div>

      <ChevronRight className="mr-1 h-6 w-6 shrink-0 text-slate-300 transition-transform duration-200 group-active:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}
