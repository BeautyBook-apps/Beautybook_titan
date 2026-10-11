import { useState, useEffect, useRef, useMemo } from "react";
import { MapPin, Navigation } from "lucide-react";
import { loadAppleMaps } from "@/lib/appleMaps";

export default function MapWithPricePins({ items = [], onSelectItem, height = "h-96" }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [geocodedItems, setGeocodedItems] = useState([]);

  const getCoordinates = (item) => {
    const lat = item?.lat ?? item?.latitude ?? (Array.isArray(item?.coordinates) ? item.coordinates[0] : null);
    const lng = item?.lng ?? item?.longitude ?? (Array.isArray(item?.coordinates) ? item.coordinates[1] : null);
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) && parsedLat !== 0 && parsedLng !== 0
      ? { lat: parsedLat, lng: parsedLng }
      : null;
  };

  const getAddressQuery = (item) => [item?.address, item?.postal_code, item?.city]
    .filter(Boolean)
    .join(", ")
    .trim();

  // MapKit peut retrouver les épingles à partir de l'adresse quand un ancien
  // profil n'a pas encore de latitude/longitude enregistrée.
  useEffect(() => {
    const pending = items
      .filter((item) => !getCoordinates(item) && getAddressQuery(item))
      .slice(0, 50);

    if (pending.length === 0) {
      setGeocodedItems([]);
      return undefined;
    }

    let cancelled = false;
    loadAppleMaps()
      .then((mapkit) => Promise.all(pending.map((item) => new Promise((resolve) => {
        new mapkit.Geocoder().lookup(getAddressQuery(item), (error, data) => {
          const coordinate = !error && data?.results?.[0]?.coordinate;
          resolve(coordinate && Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)
            ? { id: item.id, lat: coordinate.latitude, lng: coordinate.longitude }
            : null);
        });
      }))))
      .then((results) => {
        if (!cancelled) setGeocodedItems(results.filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setGeocodedItems([]);
      });

    return () => { cancelled = true; };
  }, [items]);

  const resolvedItems = useMemo(() =>
    items
      .map((it) => {
        const geocoded = geocodedItems.find((candidate) => candidate.id === it.id);
        const coordinates = getCoordinates(it) || geocoded;
        if (!coordinates) return null;
        return {
          ...it,
          _lat: coordinates.lat,
          _lng: coordinates.lng,
          displayTitle: it.salon_name || it.name || it.title || 'Professionnel BeautyBook',
          displayPrice: it.minPrice || it.price || 0,
        };
      })
      .filter(Boolean),
    [items, geocodedItems]);

  const center = useMemo(() => {
    if (resolvedItems.length === 0) return { lat: 48.8566, lng: 2.3522 };
    const lat = resolvedItems.reduce((s, it) => s + it._lat, 0) / resolvedItems.length;
    const lng = resolvedItems.reduce((s, it) => s + it._lng, 0) / resolvedItems.length;
    return { lat, lng };
  }, [resolvedItems]);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadAppleMaps().then((mapkit) => {
      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        // Map is initialized, update annotations
        try {
          const existing = mapInstanceRef.current.annotations || [];
          mapInstanceRef.current.removeAnnotations(existing);

          const annotations = resolvedItems.slice(0, 50).map(item => {
            const ann = new window.mapkit.MarkerAnnotation(
              new mapkit.Coordinate(item._lat, item._lng),
              {
                title: item.displayTitle,
                subtitle: item.displayPrice > 0 ? `Dès ${item.displayPrice}€` : item.city || "",
                color: "#FF6B00",
                glyphText: item.displayPrice > 0 ? `${item.displayPrice}€` : "•",
              }
            );
            ann.addEventListener("select", () => {
              setSelected(item.id);
              onSelectItem?.(item);
            });
            ann.addEventListener("deselect", () => setSelected(null));
            ann._item = item;
            return ann;
          });

          if (annotations.length > 0) {
            mapInstanceRef.current.addAnnotations(annotations);
            if (annotations.length > 1) {
              mapInstanceRef.current.showItems(annotations, { animate: true, padding: new mapkit.Padding(40, 40, 40, 40) });
            } else {
              // When the city picker switches from Paris to one selected city,
              // keep the existing MapKit instance but move its camera too.
              mapInstanceRef.current.center = new mapkit.Coordinate(resolvedItems[0]._lat, resolvedItems[0]._lng);
              mapInstanceRef.current.cameraDistance = 12000;
            }
          }
          setMapError(false);
        } catch (e) {
          console.warn("[MapWithPricePins] Failed updating annotations:", e);
          setMapError(true);
        }
        return;
      }

      // Initialize map for the first time
      try {
        const map = new mapkit.Map(mapRef.current, {
          center: new mapkit.Coordinate(center.lat, center.lng),
          cameraDistance: resolvedItems.length > 0 ? 12000 : 25000,
          mapType: mapkit.Map.MapTypes.Standard,
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsUserLocationControl: true,
          showsZoomControl: true,
        });

        const annotations = resolvedItems.slice(0, 50).map(item => {
          const ann = new window.mapkit.MarkerAnnotation(
            new mapkit.Coordinate(item._lat, item._lng),
            {
              title: item.displayTitle,
              subtitle: item.displayPrice > 0 ? `Dès ${item.displayPrice}€` : item.city || "",
              color: "#FF6B00",
              glyphText: item.displayPrice > 0 ? `${item.displayPrice}€` : "•",
            }
          );
          ann.addEventListener("select", () => {
            setSelected(item.id);
            onSelectItem?.(item);
          });
          ann.addEventListener("deselect", () => setSelected(null));
          ann._item = item;
          return ann;
        });

        if (annotations.length > 0) {
          map.addAnnotations(annotations);
          if (annotations.length > 1) {
            map.showItems(annotations, { animate: false, padding: new mapkit.Padding(40, 40, 40, 40) });
          }
        }

        map.showsUserLocation = true;
        mapInstanceRef.current = map;
        setReady(true);
        setMapError(false);
      } catch (e) {
        console.warn("[MapWithPricePins] Apple Maps init error:", e);
        setReady(false);
        setMapError(true);
      }
    }).catch((error) => {
      if (cancelled) return;
      console.error("[MapWithPricePins] Apple Maps unavailable:", error);
      setReady(false);
      setMapError(true);
    });

    return () => { cancelled = true; };
  }, [resolvedItems, center, onSelectItem, retryKey]);

  const selectedItem = selected ? resolvedItems.find(it => it.id === selected) : null;

  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm`}>
      {/* Apple Maps container */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading placeholder */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
          style={{ background: "linear-gradient(135deg, #FFF5F0 0%, #FFE8D6 100%)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "#FF6B00" }}>
            <MapPin className="w-6 h-6 text-white animate-bounce" />
          </div>
          <p className="text-[13px] font-extrabold" style={{ color: "#FF6B00" }}>
            {mapError ? "Apple Maps est momentanément indisponible" : "Chargement de la carte Apple Maps…"}
          </p>
          {mapError && (
            <button
              className="map-retry-btn"
              onClick={() => { setMapError(false); setReady(false); setRetryKey(k => k + 1); }}
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {/* Selected item popup card */}
      {selectedItem && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 z-[1000] flex items-center justify-between gap-4 border border-orange-100 transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.12)" }}>
              <Navigation className="w-5 h-5" style={{ color: "#FF6B00" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-black text-gray-900 truncate">{selectedItem.displayTitle}</p>
              <p className="text-[12px] text-gray-500 font-medium truncate">{selectedItem.city || selectedItem.address || 'Adresse disponible sur la fiche'}</p>
            </div>
          </div>
          {selectedItem.displayPrice > 0 && (
            <span className="text-[15px] font-black px-3 py-1.5 rounded-xl shrink-0 text-white shadow-sm" style={{ background: "#FF6B00" }}>
              Dès {selectedItem.displayPrice}€
            </span>
          )}
        </div>
      )}
    </div>
  );
}
