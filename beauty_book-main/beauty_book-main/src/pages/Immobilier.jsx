import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Heart, Maximize, X, Map, RotateCcw, MapPin, Zap, Users, ArrowUpDown, Sofa, SearchX } from "lucide-react";
import MapWithPricePins from "@/components/map/MapWithPricePins";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";

const PRICE_RANGES = [
  { id: "tous", label: "Tous les prix", min: 0, max: Infinity },
  { id: "0-500", label: "< 500 €", min: 0, max: 500 },
  { id: "500-1000", label: "500 – 1 000 €", min: 500, max: 1000 },
  { id: "1000-2000", label: "1 000 – 2 000 €", min: 1000, max: 2000 },
  { id: "2000-5000", label: "2 000 – 5 000 €", min: 2000, max: 5000 },
  { id: "5000+", label: "5 000 €+", min: 5000, max: Infinity },
];

const SURFACE_RANGES = [
  { id: "tous", label: "Toutes", min: 0, max: Infinity },
  { id: "0-10", label: "< 10 m²", min: 0, max: 10 },
  { id: "10-20", label: "10 – 20 m²", min: 10, max: 20 },
  { id: "20-50", label: "20 – 50 m²", min: 20, max: 50 },
  { id: "50+", label: "50 m²+", min: 50, max: Infinity },
];

const SEAT_OPTIONS = [
  { id: "tous", label: "Tous", value: 0 },
  { id: "1", label: "1", value: 1 },
  { id: "2", label: "2", value: 2 },
  { id: "3", label: "3+", value: 3 },
];

const EQUIP_OPTIONS = ["Tous", "Meublé", "Non meublé", "À aménager"];

const DPE_OPTIONS = ["Tous", "A", "B", "C", "D", "E", "F", "G"];

const QUARTIERS = [
  "Tous", "Paris 1er", "Paris 2e", "Paris 3e", "Paris 4e", "Paris 5e", "Paris 6e",
  "Paris 7e", "Paris 8e", "Paris 9e", "Paris 10e", "Paris 11e", "Paris 12e",
  "Paris 13e", "Paris 14e", "Paris 15e", "Paris 16e", "Paris 17e", "Paris 18e",
  "Paris 19e", "Paris 20e", "Lyon", "Marseille", "Bordeaux", "Toulouse", "Nice", "Autre",
];

const SORT_OPTIONS = [
  { id: "recent", label: "Plus récent" },
  { id: "price-asc", label: "Prix croissant" },
  { id: "price-desc", label: "Prix décroissant" },
  { id: "surface-asc", label: "Surface croissante" },
];

function parseSurface(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function FilterChip({ active, onClick, children, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[11px] font-bold transition-all active:scale-95 ${
        active
          ? "bg-primary text-white shadow-md shadow-primary/20"
          : "bg-white text-gray-600 shadow-sm"
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function FilterSection({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  );
}

function ListingCard({ listing, onPress }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [liked, setLiked] = useState(false);

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 active:scale-[0.99] transition-all">
      <div className="relative h-52" onClick={() => onPress(listing)}>
        <BeautyImage
          src={listing.images?.[imgIdx] || ""}
          alt={listing.title}
          className="w-full h-full object-cover"
        />
        {listing.images?.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {listing.images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                className={`rounded-full transition-all ${i === imgIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
        <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
          <span className="text-white text-[10px] font-bold">{imgIdx + 1}/{listing.images?.length || 1}</span>
        </div>
        {imgIdx > 0 && (
          <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={(e) => { e.stopPropagation(); setImgIdx(i => Math.max(0, i - 1)); }} />
        )}
        {imgIdx < (listing.images?.length || 1) - 1 && (
          <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={(e) => { e.stopPropagation(); setImgIdx(i => Math.min((listing.images?.length || 1) - 1, i + 1)); }} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(l => !l); }}
          className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow z-20"
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
        </button>
        <div className="absolute top-3 left-3 bg-primary rounded-full px-2.5 py-1 z-20">
          <span className="text-white text-[9px] font-black uppercase tracking-wider">{listing.badge || "PRO"}</span>
        </div>
      </div>

      <div className="p-4 cursor-pointer" onClick={() => onPress(listing)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-black text-gray-900 leading-tight line-clamp-1">{listing.title}</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />{listing.location} • {listing.area}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[24px] font-black text-primary leading-none">{listing.price?.toLocaleString()}</span>
            <span className="text-primary text-[13px] font-black"> €</span>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{listing.unit}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          {listing.surface && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
              <Maximize className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500">{listing.surface}</span>
            </div>
          )}
          {listing.equip && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
              <Sofa className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500">{listing.equip}</span>
            </div>
          )}
          {listing.dpe && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
              <Zap className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500">DPE {listing.dpe}</span>
            </div>
          )}
          {listing.seats_count && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
              <Users className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500">{listing.seats_count} siège{listing.seats_count > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Immobilier() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("location");
  // Affichage direct depuis le cache : la dernière liste connue s'affiche
  // immédiatement, le rafraîchissement se fait en arrière-plan sans vider l'affichage.
  const [listings, setListings] = useCachedState("immobilier_page", [], c => c?.listings || []);
  const [loading, setLoading] = useState(() => !readPageCache("immobilier_page")?.listings?.length);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [sortBy, setSortBy] = useState("recent");

  const [filterPrice, setFilterPrice] = useState("tous");
  const [filterSurface, setFilterSurface] = useState("tous");
  const [filterSeats, setFilterSeats] = useState("tous");
  const [filterEquip, setFilterEquip] = useState("Tous");
  const [filterDpe, setFilterDpe] = useState("Tous");
  const [filterQuartier, setFilterQuartier] = useState("Tous");

  // Refresh en arrière-plan : jamais de reset, les données en cache restent affichées.
  useEffect(() => {
    setLoading(true);
    (async () => ({ data: { success: true } }))("getImmobilier", { type: activeTab })
      .then(res => {
        const items = res.data?.listings || [];
        setListings(items);
        mergePageCache("immobilier_page", { listings: items });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeTab]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterPrice !== "tous") c++;
    if (filterSurface !== "tous") c++;
    if (filterSeats !== "tous") c++;
    if (filterEquip !== "Tous") c++;
    if (filterDpe !== "Tous") c++;
    if (filterQuartier !== "Tous") c++;
    return c;
  }, [filterPrice, filterSurface, filterSeats, filterEquip, filterDpe, filterQuartier]);

  const resetFilters = () => {
    setFilterPrice("tous");
    setFilterSurface("tous");
    setFilterSeats("tous");
    setFilterEquip("Tous");
    setFilterDpe("Tous");
    setFilterQuartier("Tous");
  };

  const filtered = useMemo(() => {
    let result = listings.filter(l => {
      const matchSearch = !search.trim() ||
        l.title?.toLowerCase().includes(search.toLowerCase()) ||
        l.location?.toLowerCase().includes(search.toLowerCase()) ||
        l.area?.toLowerCase().includes(search.toLowerCase());

      const priceRange = PRICE_RANGES.find(r => r.id === filterPrice);
      const matchPrice = !priceRange || filterPrice === "tous" || (l.price >= priceRange.min && l.price < priceRange.max);

      const surfRange = SURFACE_RANGES.find(r => r.id === filterSurface);
      const surf = parseSurface(l.surface);
      const matchSurface = !surfRange || filterSurface === "tous" || (surf >= surfRange.min && surf < surfRange.max);

      const seatVal = SEAT_OPTIONS.find(s => s.id === filterSeats);
      const matchSeats = !seatVal || filterSeats === "tous" || (filterSeats === "3" ? (l.seats_count || 1) >= 3 : (l.seats_count || 1) === seatVal.value);

      const matchEquip = filterEquip === "Tous" || l.equip?.toLowerCase().includes(filterEquip.toLowerCase());

      const matchDpe = filterDpe === "Tous" || l.dpe?.toUpperCase() === filterDpe.toUpperCase();

      const matchQuartier = filterQuartier === "Tous" || l.location?.toLowerCase().includes(filterQuartier.toLowerCase());

      return matchSearch && matchPrice && matchSurface && matchSeats && matchEquip && matchDpe && matchQuartier;
    });

    switch (sortBy) {
      case "price-asc": result.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case "price-desc": result.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case "surface-asc": result.sort((a, b) => parseSurface(a.surface) - parseSurface(b.surface)); break;
      default: break;
    }

    return result;
  }, [listings, search, filterPrice, filterSurface, filterSeats, filterEquip, filterDpe, filterQuartier, sortBy]);

  return (
    <div className="font-display bg-[#f5f5f5] min-h-full pb-6">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 sticky top-0 z-30">
        <h1 className="text-[15px] font-black text-gray-900 uppercase tracking-widest text-center mb-3">IMMOBILIER PRO</h1>

        {/* Search + Map + Filter buttons */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 min-w-0 flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2.5">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 min-w-0 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400 truncate"
            />
            {search && (
              <button onClick={() => setSearch("")} className="shrink-0"><X className="w-3.5 h-3.5 text-gray-400" /></button>
            )}
          </div>
          <button
            onClick={() => setShowMap(s => !s)}
            className={`flex items-center gap-1.5 px-2.5 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all active:scale-95 shrink-0 ${showMap ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-gray-100 text-gray-600"}`}
          >
            <Map className="w-4 h-4" />
            Carte
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-1.5 px-2.5 h-10 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all active:scale-95 shrink-0 ${showFilters ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtrer
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Map */}
        {showMap && (
          <div className="mb-2">
            <MapWithPricePins
              items={filtered.slice(0, 8).map((l, i) => ({
                id: l.id, price: l.price, title: l.title,
                lat: 48.860 + (i * 0.007), lng: 2.330 + (i * 0.018),
              }))}
              onSelectItem={(item) => navigate("/immobilier/" + item.id)}
              height="h-52"
            />
          </div>
        )}

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 rounded-2xl p-4 mt-2 space-y-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-black text-gray-900 uppercase tracking-wider">Filtres avancés</p>
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="flex items-center gap-1 text-[11px] font-black text-primary">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </button>
              )}
            </div>

            <FilterSection title="Fourchette de prix">
              <div className="flex flex-wrap gap-2">
                {PRICE_RANGES.map(r => (
                  <FilterChip key={r.id} active={filterPrice === r.id} onClick={() => setFilterPrice(r.id)}>
                    {r.label}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Surface">
              <div className="flex flex-wrap gap-2">
                {SURFACE_RANGES.map(r => (
                  <FilterChip key={r.id} active={filterSurface === r.id} onClick={() => setFilterSurface(r.id)}>
                    {r.label}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Nombre de sièges">
              <div className="flex flex-wrap gap-2">
                {SEAT_OPTIONS.map(s => (
                  <FilterChip key={s.id} active={filterSeats === s.id} onClick={() => setFilterSeats(s.id)}>
                    {s.label === "3" ? "3+" : s.label === "tous" ? "Tous" : `${s.label} siège${s.value > 1 ? "s" : ""}`}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Équipement">
              <div className="flex flex-wrap gap-2">
                {EQUIP_OPTIONS.map(e => (
                  <FilterChip key={e} active={filterEquip === e} onClick={() => setFilterEquip(e)}>
                    {e}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="DPE (Énergie)">
              <div className="flex flex-wrap gap-2">
                {DPE_OPTIONS.map(d => (
                  <FilterChip key={d} active={filterDpe === d} onClick={() => setFilterDpe(d)}>
                    {d === "Tous" ? "Tous" : `DPE ${d}`}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Quartier / Ville">
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {QUARTIERS.map(q => (
                  <FilterChip key={q} active={filterQuartier === q} onClick={() => setFilterQuartier(q)}>
                    {q}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Trier par">
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map(s => (
                  <FilterChip key={s.id} active={sortBy === s.id} onClick={() => setSortBy(s.id)} icon={ArrowUpDown}>
                    {s.label}
                  </FilterChip>
                ))}
              </div>
            </FilterSection>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white px-5 pb-4 flex gap-2">
        {["location", "vente"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-full text-[13px] font-black uppercase tracking-widest transition-all active:scale-95 ${
              activeTab === tab
                ? "bg-primary text-white shadow-md shadow-primary/30"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {tab === "location" ? "LOCATIONS" : "VENTES"}
          </button>
        ))}
      </div>

      {/* Result count */}
      <div className="px-5 py-2 flex items-center justify-between">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
          {filtered.length} bien{filtered.length !== 1 ? "s" : ""} trouvé{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Listings */}
      <div data-tour="immobilier-listings" className="px-4 space-y-4">
        {(loading && listings.length === 0) ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl overflow-hidden animate-pulse">
              <div className="h-52 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded-full w-2/3" />
                <div className="h-3 bg-gray-100 rounded-full w-1/2" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center">
              <SearchX className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-[14px] font-bold text-gray-400">Aucun bien ne correspond à vos critères</p>
            <button onClick={resetFilters} className="text-[12px] font-black text-primary active:scale-95 transition-all">
              Réinitialiser les filtres
            </button>
          </div>
        ) : filtered.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onPress={(l) => navigate("/immobilier/" + l.id, { state: l })}
          />
        ))}
      </div>
    </div>
  );
}
