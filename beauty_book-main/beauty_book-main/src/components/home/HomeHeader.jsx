import { MapPin, MessageSquare, Bell, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";

export default function HomeHeader() {
  const [city, setCity] = useState(() => {
    try { return localStorage.getItem("bb_user_city") || "Localisation en cours…"; } catch { return "Localisation en cours…"; }
  });

  useEffect(() => {
    const handleLocationChange = (event) => {
      if (event.detail?.city) setCity(event.detail.city);
    };
    window.addEventListener("bb-location-change", handleLocationChange);
    return () => window.removeEventListener("bb-location-change", handleLocationChange);
  }, []);

  return (
    <header className="px-4 pt-4 pb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">Ravi de te revoir</p>
          <p className="text-sm font-bold text-foreground">{city}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-colors">
          <MessageSquare className="w-[18px] h-[18px] text-foreground" />
        </button>
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-colors relative">
          <Bell className="w-[18px] h-[18px] text-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </button>
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-colors">
          <ShoppingCart className="w-[18px] h-[18px] text-foreground" />
        </button>
      </div>
    </header>
  );
}
