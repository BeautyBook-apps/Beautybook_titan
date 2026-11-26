import BrandMark from "@/components/ui/BrandMark";

export default function DeliveryLogoButtons({ onUber, onDeliveroo }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onUber}
        aria-label="Ouvrir Uber Eats"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 transition-transform active:scale-90"
      >
        <BrandMark brand="ubereats" label="Uber Eats" size={30} className="h-7 w-7 object-contain" />
      </button>
      <button
        type="button"
        onClick={onDeliveroo}
        aria-label="Ouvrir Deliveroo"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 transition-transform active:scale-90"
      >
        <BrandMark brand="deliveroo" label="Deliveroo" size={30} className="h-7 w-7 object-contain" />
      </button>
    </div>
  );
}
