import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, SlidersHorizontal, MapPin, Star, X, ArrowUpRight, ArrowRight, ChevronLeft, ChevronRight, Sparkles, Heart, BadgeCheck, UsersRound,
  Scissors, Waves, Gem, Footprints, Paintbrush, Droplets, Hand, LayoutGrid, Map as MapIcon, 
  RotateCcw, Building2, UserCheck, Package, Palette, Car, Clock
} from 'lucide-react';
import MapWithPricePins from '@/components/map/MapWithPricePins';
import BeautyImage from '@/components/ui/BeautyImage';
import { supabase } from '@/api/supabaseClient';
import { entities } from '@/api/entities';
import { searchSalons, matchesCategory, normalizeSearch } from '@/lib/salonSearch.mjs';
import { useTheme } from '@/hooks/useTheme';
import { useCachedState, readPageCache, mergePageCache } from '@/hooks/usePageCache';
import './Recherche.css';

const entityTabs = [
  ['Tous', 'Tout explorer', Sparkles],
  ['Services', 'Services', Scissors],
  ['Salons', 'Salons Pro', Building2],
  ['Particuliers', 'Particuliers', UserCheck],
  ['Styles', 'Styles & Looks', Palette],
  ['Bundles', 'Packs & Bundles', Package],
];

const categories = [
  ['Tous', 'Tout explorer', Sparkles], ['Coiffure', 'Coiffure', Scissors], ['Tresses', 'Tresses', Waves],
  ['Ongles', 'Manucure', Gem], ['Pedicure', 'Pédicure', Footprints], ['Maquillage', 'Maquillage', Paintbrush],
  ['Soin', 'Soins', Droplets], ['Massage', 'Massage', Hand],
];

const money = value => Number(value).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const bundleImage = item => item.image_url || item.cover_url || item.thumbnail_url || item.image || item.images?.[0] || '';
const serviceImage = item => item.images?.[0] || item.image_url || item.cover_url || item.thumbnail_url || '';
const profileImage = item => item.avatar_url || item.profile_image_url || item.profile_photo_url || item.logo_url || item.owner_avatar_url || item.image_url || '';
const profileName = item => item.salon_name || item.business_name || item.pro_name || item.provider_name || item.name || 'Commerce BeautyBook';

function CommerceAvatar({ item, label }) {
  const src = profileImage(item);
  const name = label || profileName(item);
  return (
    <span className="discovery-commerce-avatar" title={`Photo de profil de ${name}`}>
      {src ? (
        <BeautyImage src={src} alt={`Photo de profil de ${name}`} loading="lazy" />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
const bundleReviewCount = item => Number(item.review_count ?? item.reviews_count ?? item.reviews ?? 0);
const bundleServiceCount = item => Array.isArray(item.services) ? item.services.length : Number(item.service_count ?? item.services_count ?? 0);
const bundleDiscount = item => {
  if (item.discount_percentage) return Math.round(Number(item.discount_percentage));
  const original = Number(item.original_price);
  const price = Number(item.price);
  return original > price && price > 0 ? Math.round((1 - price / original) * 100) : 0;
};
const formatBundleDuration = value => {
  const minutes = Number(value);
  if (!minutes) return '2h';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h${String(remaining).padStart(2, '0')}` : `${hours}h`;
};
const emptyFilters = { city: '', maxPrice: '', minRating: '', estDomicile: false, enSalon: false, promoOnly: false };

const isParticulierProfile = profile => {
  const type = normalizeSearch([
    profile.type_pro,
    profile.profile_type,
    profile.account_type,
    profile.business_type,
  ].filter(Boolean).join(' '));
  const identity = normalizeSearch([
    profile.salon_name,
    profile.business_name,
    profile.name,
    profile.user_email,
  ].filter(Boolean).join(' '));

  return ['particulier', 'domicile', 'freelance', 'independant', 'independent'].some(value => type.includes(value))
    || Boolean(profile.est_domicile || profile.is_domicile || profile.is_particulier)
    || identity.includes('studio bb');
};

const mediaUrl = value => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return value.url || value.src || value.file_url || value.image_url || value.video_url || '';
};

const mediaIsVideo = value => {
  if (value && typeof value === 'object' && (value.type === 'video' || value.media_type === 'video')) return true;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrl(value));
};

function DiscoveryMediaSlider({ item, alt }) {
  const media = useMemo(() => {
    const candidates = [
      ...(Array.isArray(item.media) ? item.media : []),
      ...(Array.isArray(item.photos) ? item.photos : []),
      ...(Array.isArray(item.images) ? item.images : []),
      ...(Array.isArray(item.videos) ? item.videos : []),
      item.video_url,
      item.cover_url,
      item.avatar_url,
    ];
    const seen = new Set();
    return candidates.map(value => {
      const src = mediaUrl(value);
      if (!src || seen.has(src)) return null;
      seen.add(src);
      return {
        src,
        isVideo: mediaIsVideo(value),
        poster: value && typeof value === 'object' ? value.poster || value.thumbnail_url : undefined,
      };
    }).filter(Boolean);
  }, [item]);
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);

  useEffect(() => setIndex(0), [item?.id]);

  const change = (next, event) => {
    event?.stopPropagation();
    if (media.length < 2) return;
    setIndex((next + media.length) % media.length);
  };
  const onTouchStart = event => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = event => {
    const start = touchStart.current;
    const end = event.changedTouches[0]?.clientX;
    touchStart.current = null;
    if (start == null || end == null || Math.abs(end - start) < 35) return;
    change(index + (end < start ? 1 : -1), event);
  };

  const current = media[index] || { src: '', isVideo: false };
  return (
    <div className="discovery-media-slider" onClick={event => event.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {current.isVideo ? (
        <video src={current.src} poster={current.poster} autoPlay muted loop playsInline aria-label={alt} />
      ) : (
        <BeautyImage src={current.src} alt={alt} loading="lazy" />
      )}
      {media.length > 1 && (
        <>
          <button type="button" className="discovery-media-control prev" onClick={event => change(index - 1, event)} aria-label="Média précédent">
            <ChevronLeft size={17} />
          </button>
          <button type="button" className="discovery-media-control next" onClick={event => change(index + 1, event)} aria-label="Média suivant">
            <ChevronRight size={17} />
          </button>
          <div className="discovery-media-dots" aria-label={`${media.length} médias`}>
            {media.map((entry, mediaIndex) => (
              <button
                key={`${entry.src}-${mediaIndex}`}
                type="button"
                className={mediaIndex === index ? 'active' : ''}
                onClick={event => change(mediaIndex, event)}
                aria-label={`Afficher le média ${mediaIndex + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

async function activeRows(table, signal) {
  const rows = [];
  try {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from(table).select('*').eq('status', 'actif').order('created_at', { ascending: false }).order('id').range(offset, offset + 499).abortSignal(signal);
      if (error) break;
      rows.push(...(data || []));
      if (!data || data.length < 500) return rows;
    }
  } catch (e) {
    const { data } = await supabase.from(table).select('*').limit(200);
    return data || [];
  }
  return rows;
}

function FilterDialog({ filters, cities, servicesAvailable, onClose, onApply, resultCount = 0 }) {
  const ref = useRef(null);
  const [draft, setDraft] = useState(filters);
  useEffect(() => { 
    const dialog = ref.current; 
    if (dialog && !dialog.open) dialog.showModal(); 
    return () => dialog?.close(); 
  }, []);

  const update = (key, value) => setDraft(old => ({ ...old, [key]: value }));

  return (
    <dialog 
      ref={ref} 
      className="discovery-dialog" 
      onCancel={onClose} 
      onClick={event => { if (event.target === event.currentTarget) onClose(); }} 
      aria-labelledby="filter-title"
    >
      <form className="discovery-dialog-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}>
        <div className="discovery-dialog-head">
          <div>
            <p className="discovery-eyebrow"><Sparkles size={14} /> RECHERCHE APPROFONDIE</p>
            <h2 id="filter-title">Filtres de recherche sur-mesure</h2>
          </div>
          <button type="button" className="discovery-icon-button" onClick={onClose} aria-label="Fermer les filtres">
            <X size={21} />
          </button>
        </div>

        <div className="discovery-dialog-body">
          {/* Localisation */}
          <div className="discovery-filter-group">
            <label htmlFor="filter-city">Ville ou code postal</label>
            <div className="filter-input-wrapper">
              <MapPin size={18} className="filter-input-icon" />
              <input 
                id="filter-city"
                list="discovery-cities" 
                autoComplete="address-level2" 
                value={draft.city} 
                onChange={e => update('city', e.target.value)} 
                placeholder="Ex. Paris, Cergy, Lyon..." 
              />
              {draft.city && (
                <button type="button" className="filter-clear-btn" onClick={() => update('city', '')}>
                  <X size={14} />
                </button>
              )}
            </div>
            <datalist id="discovery-cities">{cities.map(city => <option key={city} value={city} />)}</datalist>
          </div>

          {/* Tarif Maximale */}
          <div className="discovery-filter-group">
            <div className="filter-label-header">
              <label htmlFor="filter-price">Tarif de départ maximal (€)</label>
              <span className="filter-badge-value">
                {draft.maxPrice ? `${draft.maxPrice} € max` : 'Sans limite'}
              </span>
            </div>
            <input 
              id="filter-price"
              type="number" 
              min="0" 
              step="5" 
              disabled={!servicesAvailable} 
              value={draft.maxPrice} 
              onChange={e => update('maxPrice', e.target.value)} 
              placeholder="Budget max..." 
            />
            <div className="filter-pills-row">
              {['30', '50', '80', '120', '150'].map(price => (
                <button
                  type="button"
                  key={price}
                  className={`filter-pill-btn ${draft.maxPrice === price ? 'active' : ''}`}
                  onClick={() => update('maxPrice', draft.maxPrice === price ? '' : price)}
                >
                  {price} €
                </button>
              ))}
              <button
                type="button"
                className={`filter-pill-btn ${draft.maxPrice === '' ? 'active' : ''}`}
                onClick={() => update('maxPrice', '')}
              >
                Illimité
              </button>
            </div>
            <small className="filter-help-text">Au moins une prestation de la sélection doit respecter ce budget.</small>
          </div>

          {/* Note minimale */}
          <div className="discovery-filter-group">
            <label>Note minimale des avis clients</label>
            <div className="filter-rating-grid">
              {[
                { val: '', label: 'Toutes les notes' },
                { val: '4', label: '★ 4.0 +' },
                { val: '4.5', label: '★ 4.5 +' },
                { val: '5', label: '★ 5.0 (Parfait)' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.val}
                  className={`filter-rating-pill ${draft.minRating === opt.val ? 'active' : ''}`}
                  onClick={() => update('minRating', opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modalités & Préférences */}
          <div className="discovery-filter-group">
            <label className="mb-2">Modalités & Type de prestation</label>
            <div className="filter-checkboxes-stack">
              <label className="filter-checkbox-item">
                <input 
                  type="checkbox" 
                  checked={Boolean(draft.estDomicile)} 
                  onChange={e => update('estDomicile', e.target.checked)} 
                />
                <span>Prestataires se déplaçant à domicile</span>
              </label>

              <label className="filter-checkbox-item">
                <input 
                  type="checkbox" 
                  checked={Boolean(draft.enSalon)} 
                  onChange={e => update('enSalon', e.target.checked)} 
                />
                <span>Salons & Établissements physiques</span>
              </label>

              <label className="filter-checkbox-item">
                <input 
                  type="checkbox" 
                  checked={Boolean(draft.promoOnly)} 
                  onChange={e => update('promoOnly', e.target.checked)} 
                />
                <span>Packs & Formules avantageuses</span>
              </label>
            </div>
          </div>
        </div>

        <div className="discovery-dialog-actions">
          <button type="button" className="discovery-secondary" onClick={() => setDraft(emptyFilters)}>
            Réinitialiser
          </button>
          <button type="submit" className="discovery-primary flex-1 justify-center">
            Voir les résultats ({resultCount}) <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function Recherche() {
  useTheme();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const entityType = entityTabs.some(([id]) => id === params.get('entity')) ? params.get('entity') : 'Tous';
  const category = categories.some(([id]) => id === params.get('category')) ? params.get('category') : 'Tous';
  const numericFilter = key => { const value = params.get(key); return value !== null && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? value : ''; };
  const filters = { city: params.get('city') || '', maxPrice: numericFilter('maxPrice'), minRating: numericFilter('minRating') };
  const sort = ['recent', 'price', 'rating'].includes(params.get('sort')) ? params.get('sort') : 'recent';

  // Affichage direct depuis le cache : la première peinture montre les dernières
  // données connues, jamais un écran vide ; le rafraîchissement réseau se fait
  // en arrière-plan sans vider l'affichage.
  const [data, setData] = useCachedState("recherche_page", { profiles: [], services: [], styles: [], bundles: [] }, c => ({
    profiles: c?.profiles || [],
    services: c?.services || [],
    styles: c?.styles || [],
    bundles: c?.bundles || [],
  }));
  const [loading, setLoading] = useState(() => !readPageCache("recherche_page"));
  const [error, setError] = useState('');
  const [servicesAvailable, setServicesAvailable] = useCachedState("recherche_page", true, c => c?.servicesAvailable ?? true);
  const [retry, setRetry] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.allSettled([
      activeRows('ProfilPro', controller.signal),
      activeRows('Service', controller.signal),
      entities.Style.filter({ status: ['publie', 'actif'] }, '-created_at', 50)
        .then(res => (res && res.length > 0) ? res : entities.Style.filter({}, '-created_at', 50))
        .then(res => (res || []).filter(s => s.status !== 'brouillon')),
      entities.ServiceBundle ? entities.ServiceBundle.filter({}, '-created_at', 10) : Promise.resolve([])
    ]).then(([profiles, services, styles, bundles]) => {
      if (controller.signal.aborted) return;
      if (profiles.status === 'rejected') { 
        setError('Les offres et professionnels n’ont pas pu être chargés. Vérifiez votre connexion et réessayez.'); 
        return; 
      }
      
      const loadedProfiles = profiles.value ? profiles.value.filter(p => p.user_email || p.salon_name || p.name) : [];
      const loadedServices = services.status === 'fulfilled' ? services.value : [];
      const loadedStyles = styles.status === 'fulfilled' ? styles.value : [];
      const loadedBundles = bundles.status === 'fulfilled' ? bundles.value : [];

      // Create synthetic mock bundles if DB has none for demonstration
      const demoBundles = loadedBundles.length > 0 ? loadedBundles : [
        {
          id: 'bundle-demo-1',
          title: 'Formule Éclat Total : Coupe & Soin',
          description: 'Coupe personnalisée + Soin Tokio Inkarami + Massage crânien 20min',
          original_price: 110,
          price: 89,
          discount_percentage: 15,
          category: 'Coiffure',
          pro_name: 'L\'Atelier Botanique',
          badge: '🔥 Le plus réservé',
          service_count: 2,
          duration_minutes: 140,
          persons: '2–4 pers.'
        },
        {
          id: 'bundle-demo-2',
          title: 'Pack Tresses & Restructuration',
          description: 'Knotless Braids taille moyenne + Soin hydratant cuir chevelu',
          original_price: 130,
          price: 104,
          discount_percentage: 20,
          category: 'Tresses',
          pro_name: 'Amandine K. Braider',
          badge: '✨ Offre découverte',
          service_count: 1,
          duration_minutes: 120,
          persons: '1 personne'
        }
      ];

      setData({ 
        profiles: loadedProfiles, 
        services: loadedServices, 
        styles: loadedStyles,
        bundles: demoBundles
      });
      setServicesAvailable(services.status === 'fulfilled');
      // Persister le chargement frais : le prochain affichage sera instantané.
      mergePageCache("recherche_page", {
        profiles: loadedProfiles,
        services: loadedServices,
        styles: loadedStyles,
        bundles: demoBundles,
        servicesAvailable: services.status === 'fulfilled',
      });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  // Main salon results matching filters
  const salonResults = useMemo(() => {
    return searchSalons(data.profiles, data.services, { q, category, ...filters, sort });
  }, [data.profiles, data.services, q, category, filters.city, filters.maxPrice, filters.minRating, sort]);

  // Categorize entity types
  const categorizedResults = useMemo(() => {
    const query = normalizeSearch(q);

    // Particuliers first: an individual may still have a salon_name filled in.
    // Studio bb is explicitly an individual profile and must never appear in Salons Pro.
    const particuliers = salonResults.filter(isParticulierProfile);

    // Salons: only profiles not already classified as individuals.
    const salons = salonResults.filter(p => !isParticulierProfile(p) && (
      p.type_pro === 'salon' || p.salon_name || !p.type_pro || p.type_pro === 'etablissement'
    ));

    // Services (Individual service items)
    const matchingServices = data.services.filter(s => {
      const matchCat = matchesCategory(s.category || s.name, category);
      const matchQ = !query || normalizeSearch([s.name, s.title, s.category, s.description].join(' ')).includes(query);
      const matchMaxPrice = !filters.maxPrice || Number(s.price) <= Number(filters.maxPrice);
      return matchCat && matchQ && matchMaxPrice;
    });

    // Styles (Hairstyle inspiration catalog)
    const matchingStyles = data.styles.filter(st => {
      const matchCat = matchesCategory(st.category || st.title, category);
      const matchQ = !query || normalizeSearch([st.title, st.category, st.description].join(' ')).includes(query);
      return matchCat && matchQ;
    });

    // Bundles (Promotional combo packages)
    const matchingBundles = data.bundles.filter(b => {
      const matchCat = matchesCategory(b.category || b.title, category);
      const matchQ = !query || normalizeSearch([b.title, b.description, b.category].join(' ')).includes(query);
      const matchMaxPrice = !filters.maxPrice || Number(b.price) <= Number(filters.maxPrice);
      return matchCat && matchQ && matchMaxPrice;
    });

    return {
      salons,
      particuliers: particuliers.length > 0 ? particuliers : salonResults.filter(p => p.type_pro === 'particulier'),
      services: matchingServices,
      styles: matchingStyles,
      bundles: matchingBundles
    };
  }, [salonResults, data.services, data.styles, data.bundles, q, category, filters.maxPrice]);

  // Aggregate results depending on selected entity tab
  const activeItems = useMemo(() => {
    if (entityType === 'Salons') return categorizedResults.salons.map(item => ({ ...item, entityKind: 'salon' }));
    if (entityType === 'Particuliers') return categorizedResults.particuliers.map(item => ({ ...item, entityKind: 'particulier' }));
    if (entityType === 'Services') return categorizedResults.services.map(item => ({ ...item, entityKind: 'service' }));
    if (entityType === 'Styles') return categorizedResults.styles.map(item => ({ ...item, entityKind: 'style' }));
    if (entityType === 'Bundles') return categorizedResults.bundles.map(item => ({ ...item, entityKind: 'bundle' }));

    // 'Tous': organize the main discovery sections. Styles remain available in their own tab.
    const combined = [];
    categorizedResults.salons.forEach(s => combined.push({ ...s, entityKind: 'salon' }));
    categorizedResults.particuliers.forEach(p => combined.push({ ...p, entityKind: 'particulier' }));
    categorizedResults.bundles.forEach(b => combined.push({ ...b, entityKind: 'bundle' }));
    categorizedResults.services.forEach(srv => combined.push({ ...srv, entityKind: 'service' }));
    return combined;
  }, [entityType, categorizedResults]);

  const mapped = useMemo(() => salonResults.filter(p => p.coordinates), [salonResults]);
  const points = useMemo(() => mapped.map(p => p.coordinates), [mapped]);
  const cities = [...new Set(data.profiles.map(p => p.city).filter(Boolean))].sort();
  const filterCount = Object.values(filters).filter(Boolean).length;
  const hasCriteria = Boolean(q || category !== 'Tous' || entityType !== 'Tous' || filterCount);

  useEffect(() => setVisibleCount(12), [q, entityType, category, filters.city, filters.maxPrice, filters.minRating, sort]);

  function updateParams(values) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(values)) {
        if (value !== '' && value !== 'Tous' && value !== 'recent') next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, { replace: true });
  }

  const openPro = pro => navigate('/pro/vue-client', { state: { proEmail: pro.user_email } });
  function openMaria() { 
    navigate('/maria', { state: { autoMessage: 'Bonjour Maria, aide-moi à trouver une prestation beauté' + (q ? ' : ' + q : '') + (filters.city ? ' à ' + filters.city : '') + '.' } }); 
  }

  // Afficher le contenu dès que des données en cache existent : jamais de
  // skeleton plein écran pendant le rafraîchissement en arrière-plan.
  const hasData = data.profiles.length > 0 || data.services.length > 0 || data.styles.length > 0 || data.bundles.length > 0;

  return (
    <div className="discovery-page font-display">
      {/* 1. Header & Hero Section */}
      <header className="discovery-hero">
        <div className="discovery-topline">
          <span className="discovery-eyebrow">
            <span className="pulse-dot" />
            LE RENDEZ-VOUS AVEC VOUS
          </span>
          <span className="discovery-brand">
            BeautyBook<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="discovery-heading">
          <div>
            <h1>
              Votre prochaine<br />
              <em>parenthèse beauté.</em>
            </h1>
            <p>Un style, un soin, une adresse qui vous ressemble.</p>
          </div>
          <button className="discovery-maria" onClick={openMaria}>
            <span className="discovery-maria-icon"><Sparkles size={22} /></span>
            <span>
              <strong>Un conseil de Maria ?</strong>
              <small>Laissez-vous guider par l'IA</small>
            </span>
            <ArrowUpRight size={19} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="discovery-searchbar">
          <label className="discovery-query">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Rechercher un salon, service, particulier, style ou bundle</span>
            <input 
              type="search" 
              value={q} 
              onChange={e => updateParams({ q: e.target.value })} 
              placeholder="Chercher un salon, particulier, service, style..." 
            />
          </label>
          <button className="discovery-filter-button" aria-label="Ouvrir les filtres" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal size={18} />
            <span>Filtres</span>
            {filterCount > 0 && <b>{filterCount}</b>}
          </button>
        </div>

        {/* 5 Entity Search Tabs */}
        <div className="discovery-entity-tabs-container">
          <div className="discovery-entity-tabs" role="tablist" aria-label="Filtres d'entités">
            {entityTabs.map(([id, label, Icon]) => {
              const count = id === 'Tous' ? activeItems.length : (categorizedResults[id.toLowerCase()] || []).length;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={entityType === id}
                  className={`discovery-entity-tab ${entityType === id ? 'active' : ''}`}
                  onClick={() => updateParams({ entity: id })}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {count > 0 && <span className="tab-badge">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Pills */}
        <nav className="discovery-categories" aria-label="Catégories de prestations">
          {categories.map(([id, label, Icon]) => (
            <button 
              key={id} 
              aria-pressed={category === id} 
              className={category === id ? 'selected' : ''} 
              onClick={() => updateParams({ category: id })}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Body */}
      <div className="discovery-body">
        {/* Active Filters Bar */}
        {filterCount > 0 && (
          <div className="discovery-active-filters">
            {Object.entries(filters).filter(([, value]) => value !== '').map(([key, value]) => (
              <button key={key} onClick={() => updateParams({ [key]: '' })} aria-label={'Retirer le filtre ' + value}>
                {key === 'city' ? value : key === 'maxPrice' ? 'Dès ' + value + ' € max.' : value + ' étoiles et +'}
                <X size={15} />
              </button>
            ))}
            <button onClick={() => updateParams(emptyFilters)}>Effacer les filtres</button>
          </div>
        )}

        {/* Results Header */}
        <section className="discovery-results" aria-labelledby="results-title">
          <div className="discovery-section-head">
            <div>
              <p className="discovery-eyebrow"><Sparkles size={14} /> TROUVEZ VOTRE BONHEUR</p>
              <h2 id="results-title">
                {q ? 'Résultats de votre recherche' : entityType !== 'Tous' ? `Recherche : ${entityType}` : 'Les pépites à découvrir'}
                <span aria-live="polite">
                  {loading ? 'Recherche en cours…' : error ? '' : `${activeItems.length} disponible${activeItems.length > 1 ? 's' : ''}`}
                </span>
              </h2>
            </div>
            
            <div className="discovery-view-toggle" aria-label="Affichage des résultats">
              <button aria-label="Afficher en liste" aria-pressed={!showMap} onClick={() => setShowMap(false)}>
                <LayoutGrid size={17} />
                <span>Liste</span>
              </button>
              <button aria-label="Afficher sur la carte" aria-pressed={showMap} onClick={() => { setShowMap(true); setMapError(false); }}>
                <MapIcon size={17} />
                <span>Carte</span>
              </button>
            </div>
          </div>

          <div className="discovery-result-tools">
            <p>Découvrez les salons, pros à domicile, styles et packs faits pour vous.</p>
            <label>Trier par 
              <select aria-label="Trier les résultats" value={sort} onChange={e => updateParams({ sort: e.target.value })}>
                <option value="recent">Nouveautés</option>
                <option value="rating">Meilleures notes</option>
                <option value="price" disabled={!servicesAvailable}>Prix croissant</option>
              </select>
            </label>
          </div>

          {!loading && !servicesAvailable && !error && (
            <div className="discovery-notice" role="status">
              Les tarifs sont momentanément indisponibles. <button onClick={() => setRetry(n => n + 1)}>Réessayer</button>
              {filters.maxPrice !== '' && <button onClick={() => updateParams({ maxPrice: '' })}>Retirer le filtre de prix</button>}
            </div>
          )}

          {(loading && !hasData) ? (
            <div className="discovery-grid" role="status" aria-label="Chargement des résultats">
              {[1, 2, 3, 4].map(id => <div key={id} className="discovery-skeleton"><div /><span /><span /></div>)}
            </div>
          ) : (error && !hasData) ? (
            <div className="discovery-empty" role="alert">
              <RotateCcw size={30} />
              <h3>Une petite interruption</h3>
              <p>{error}</p>
              <button className="discovery-primary" onClick={() => setRetry(n => n + 1)}>Réessayer</button>
            </div>
          ) : (
            <>
              {/* Map Panel */}
              {showMap && (
                <div className="discovery-map-panel">
                  <MapWithPricePins 
                    items={mapped} 
                    onSelectItem={pro => openPro(pro)} 
                    height="h-[380px]" 
                  />
                  {mapped.length ? (
                    <p className="discovery-map-caption">
                      <MapPin size={15} />
                      {mapped.length} adresse(s) localisée(s) sur Apple Maps. Cliquez sur une épingle de tarif pour voir les détails.
                    </p>
                  ) : (
                    <p className="discovery-map-caption">
                      <MapPin size={15} />
                      Les professionnels de cette sélection n'ont pas encore renseigné leurs coordonnées sur la carte. Retrouvez leurs fiches ci-dessous.
                    </p>
                  )}
                </div>
              )}

              {/* Grid of Multi-Entity Cards */}
              {activeItems.length > 0 ? (
                <>
                  <div className="discovery-grid">
                    {activeItems.slice(0, visibleCount).map((item, idx) => {
                      const kind = item.entityKind || 'salon';
                      const sectionMeta = {
                        salon: { label: 'Salons professionnels', icon: Building2, description: 'Les établissements beauté près de chez vous.' },
                        particulier: { label: 'Particuliers', icon: UserCheck, description: 'Des professionnels indépendants qui se déplacent à domicile.' },
                        bundle: { label: 'Bundles', icon: Package, description: 'Des formules beauté avantageuses.' },
                        service: { label: 'Prestations', icon: Scissors, description: 'Des services beauté adaptés à vos envies.' },
                      }[kind];
                      const startsSection = entityType === 'Tous' && (idx === 0 || activeItems[idx - 1]?.entityKind !== kind);
                      const SectionIcon = sectionMeta?.icon;
                      const sectionHeader = startsSection && sectionMeta ? (
                        <div className="discovery-subsection-head">
                          <div className="discovery-subsection-title">
                            <span className="discovery-subsection-icon"><SectionIcon size={17} /></span>
                            <div>
                              <h3>{sectionMeta.label}</h3>
                              <p>{sectionMeta.description}</p>
                            </div>
                          </div>
                          <span className="discovery-subsection-count">
                            {activeItems.slice(idx).filter(entry => entry.entityKind === kind).length}
                          </span>
                        </div>
                      ) : null;

                      // CARD TYPE 1: SALONS PRO
                      if (kind === 'salon') {
                        return (
                          <Fragment key={`salon-${item.id || idx}`}>
                            {sectionHeader}
                            <article className="discovery-salon" onClick={() => openPro(item)}>
                              <div className="discovery-salon-photo">
                                <DiscoveryMediaSlider item={item} alt={item.salon_name || 'Salon de beauté'} />
                                <div className="discovery-badge-cluster">
                                  <span className="entity-badge salon-badge">
                                    <Building2 size={12} /> Salon Pro
                                  </span>
                                </div>
                                {item.rating > 0 && (
                                  <span className="discovery-rating">
                                    <Star size={13} fill="currentColor" />
                                    {item.rating.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                                  </span>
                                )}
                                <span className="discovery-photo-arrow"><ArrowUpRight size={18} /></span>
                              </div>
                              <div className="discovery-salon-info">
                                <p className="discovery-specialties">
                                  {Array.isArray(item.specialites) && item.specialites.length ? item.specialites.slice(0, 2).join(' · ') : 'Établissement Beauté'}
                                </p>
                                <div className="discovery-commerce-title">
                                  <CommerceAvatar item={item} label={item.salon_name || 'Salon BeautyBook'} />
                                  <h3>{item.salon_name || 'Salon BeautyBook'}</h3>
                                </div>
                                <p className="discovery-city"><MapPin size={14} />{item.city || 'Paris & IDF'}</p>
                                <div className="discovery-salon-bottom">
                                  <span>{item.minPrice !== null ? <>À partir de <strong>{money(item.minPrice)}</strong></> : 'Découvrir l\'établissement'}</span>
                                  <ArrowRight size={18} />
                                </div>
                              </div>
                            </article>
                          </Fragment>
                        );
                      }

                      // CARD TYPE 2: PARTICULIERS / À DOMICILE
                      if (kind === 'particulier') {
                        return (
                          <Fragment key={`particulier-${item.id || idx}`}>
                            {sectionHeader}
                            <article className="discovery-salon particulier-card" onClick={() => openPro(item)}>
                              <div className="discovery-salon-photo particulier-photo">
                                <DiscoveryMediaSlider item={item} alt={item.salon_name || 'Coiffeur particulier'} />
                                <div className="discovery-badge-cluster">
                                  <span className="entity-badge particulier-badge">
                                    <UserCheck size={12} /> Particulier / À domicile
                                  </span>
                                </div>
                                {item.rating > 0 && (
                                  <span className="discovery-rating">
                                    <Star size={13} fill="currentColor" />
                                    {item.rating.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                                  </span>
                                )}
                              </div>
                              <div className="discovery-salon-info">
                                <p className="discovery-specialties text-orange">Prestataire Indépendant & Domicile</p>
                                <div className="discovery-commerce-title">
                                  <CommerceAvatar item={item} label={item.salon_name || item.name || 'Coiffeur à domicile'} />
                                  <h3>{item.salon_name || item.name || 'Coiffeur à domicile'}</h3>
                                </div>
                                <p className="discovery-city"><Car size={14} />{item.city || 'Déplacement à domicile'}</p>
                                <div className="discovery-salon-bottom">
                                  <span>Dès <strong>{item.minPrice ? money(item.minPrice) : '35 €'}</strong></span>
                                  <span className="btn-cta-small">Voir le profil <ArrowRight size={15} /></span>
                                </div>
                              </div>
                            </article>
                          </Fragment>
                        );
                      }

                      // CARD TYPE 3: BUNDLES / PACKS PROMO
                      if (kind === 'bundle') {
                        const discount = bundleDiscount(item);
                        const serviceCount = bundleServiceCount(item);
                        const reviewCount = bundleReviewCount(item);
                        const originalPrice = Number(item.original_price);
                        const rating = Number(item.rating || 4.3);
                        return (
                          <Fragment key={`bundle-${item.id || idx}`}>
                            {sectionHeader}
                            <article className="discovery-salon bundle-card">
                              <div className="bundle-card-media">
                                <BeautyImage src={bundleImage(item)} alt={item.title || 'Bundle beauté'} loading="lazy" />
                                <span className="bundle-ribbon">
                                  {item.badge || `Économisez ${discount || 15}%`}
                                </span>
                                <button className="bundle-favorite" type="button" aria-label="Ajouter ce bundle aux favoris">
                                  <Heart size={20} />
                                </button>
                              </div>
                              <div className="discovery-salon-info bundle-info">
                                <p className="bundle-kicker">{item.category || 'Beauté'}</p>
                                <h3>{item.title || 'Bundle beauté'}</h3>
                                <p className="bundle-subtitle">{item.subtitle || item.description || 'Une formule beauté pensée pour vous.'}</p>
                                <p className="bundle-provider">
                                  <CommerceAvatar item={item} label={item.pro_name || item.provider_name || 'BeautyBook'} />
                                  <span>By {item.pro_name || item.provider_name || 'BeautyBook'}</span>
                                  <BadgeCheck size={16} className="bundle-verified" />
                                  <Star size={15} fill="currentColor" />
                                  <strong>{rating.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</strong>
                                  <span>({reviewCount || 0})</span>
                                </p>
                                <div className="bundle-meta">
                                  <span><Scissors size={15} /> {serviceCount || 2} services</span>
                                  <span><Clock size={15} /> {formatBundleDuration(item.duration_minutes || item.duration)}</span>
                                  <span><UsersRound size={15} /> {item.persons || item.people || '1 personne'}</span>
                                </div>
                                <div className="bundle-pricing">
                                  <span className="bundle-saving">Économisez {discount || 15}%</span>
                                  <span className="bundle-from">À partir de</span>
                                  {originalPrice > Number(item.price) && <span className="old-price">{money(originalPrice)}</span>}
                                  <span className="deal-price">{money(item.price)}</span>
                                  <button className="discovery-primary bundle-btn" onClick={openMaria}>
                                    Voir le bundle <ArrowUpRight size={16} />
                                  </button>
                                </div>
                              </div>
                            </article>
                          </Fragment>
                        );
                      }

                      // CARD TYPE 4: STYLES / INSPIRATIONS
                      if (kind === 'style') {
                        return (
                          <Fragment key={`style-${item.id || idx}`}>
                            {sectionHeader}
                            <article className="discovery-style style-item-card" onClick={() => navigate('/style/' + item.id)}>
                              <BeautyImage src={item.image_url || item.images?.[0]} alt={item.title || 'Inspiration look'} loading="lazy" />
                              <span className="entity-badge style-badge">
                                <Palette size={12} /> Style / Look
                              </span>
                              <div className="style-overlay-content">
                                <small>{item.category || 'Inspiration'}</small>
                                <strong>{item.title || 'Découvrir ce style'}</strong>
                              </div>
                              <ArrowUpRight size={18} className="style-arrow" />
                            </article>
                          </Fragment>
                        );
                      }

                      // CARD TYPE 5: SERVICES / PRESTATIONS
                      const serviceRating = Number(item.rating || 4.3);
                      const serviceReviews = Number(item.reviews_count ?? item.review_count ?? 0);
                      const serviceDuration = Number(item.duration_min || item.duration_minutes || item.duration || 80);
                      const servicePrice = Number(item.promo_price || item.price || 40);
                      const serviceType = item.type_pro === 'particulier' || item.est_domicile ? 'Particulier' : 'Salon Professionnel';
                      const serviceStatus = item.is_open === false || ['fermé', 'ferme', 'inactif'].includes(String(item.status || '').toLowerCase()) ? 'Fermé' : 'Ouvert';
                      return (
                        <Fragment key={`service-${item.id || idx}`}>
                          {sectionHeader}
                          <article className="discovery-service">
                            <div className="service-card-media">
                              <BeautyImage src={serviceImage(item)} alt={item.name || item.title || 'Prestation beauté'} loading="lazy" />
                              <div className="service-media-dots"><span className="active" /><span /><span /></div>
                              <button className="service-favorite" type="button" aria-label="Ajouter cette prestation aux favoris">
                                <Heart size={20} />
                              </button>
                            </div>
                            <div className="service-card-content">
                              <p className="service-provider">
                                <CommerceAvatar item={item} label={item.pro_name || item.provider_name || 'BeautyBook'} />
                                <strong>{item.pro_name || item.provider_name || 'Mamara hair 91'}</strong>
                              </p>
                              <h3>{item.name || item.title || 'Prestation beauté'}</h3>
                              <div className="service-badges">
                                <span><MapPin size={14} /> {item.city || item.location || 'Paris & IDF'}</span>
                                <span className="service-type">{serviceType}</span>
                                <span className={serviceStatus === 'Fermé' ? 'service-closed' : 'service-open'}><i />{serviceStatus}</span>
                                <span className="service-rating"><Star size={14} fill="currentColor" /> {serviceRating.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} <small>({serviceReviews || 0})</small></span>
                              </div>
                              <div className="service-card-divider" />
                              <div className="service-actions">
                                <button type="button" className="service-action ai" onClick={openMaria}><Sparkles size={15} /> Filtre IA</button>
                                <button type="button" className="service-action style" onClick={openMaria}><Palette size={15} /> Style associé</button>
                              </div>
                              <div className="service-card-footer">
                                <span className="service-duration"><Clock size={16} /> {serviceDuration} min</span>
                                <strong>{money(servicePrice)}</strong>
                              </div>
                            </div>
                          </article>
                        </Fragment>
                      );
                    })}
                  </div>

                  {visibleCount < activeItems.length && (
                    <button className="discovery-load-more discovery-secondary" onClick={() => setVisibleCount(n => n + 12)}>
                      Voir plus de résultats <ArrowRight size={18} />
                    </button>
                  )}
                </>
              ) : (
                <div className="discovery-empty">
                  <Search size={36} />
                  <h3>{hasCriteria ? 'Aucun résultat dans cette catégorie.' : 'Les prochaines adresses arrivent.'}</h3>
                  <p>{hasCriteria ? 'Essayez de basculer d\'onglet (Salons, Particuliers, Styles, Bundles), d\'élargir la ville ou les filtres.' : 'Les professionnels apparaîtront ici dès leur enregistrement.'}</p>
                  {hasCriteria && (
                    <button className="discovery-primary" onClick={() => updateParams({ q: '', category: 'Tous', entity: 'Tous', ...emptyFilters })}>
                      Effacer la recherche
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* AI Maria Assistant CTA */}
        <aside className="discovery-assistant">
          <span className="discovery-assistant-icon"><Sparkles size={28} /></span>
          <div>
            <p className="discovery-eyebrow">ASSISTANTE IA MARIA</p>
            <h2>Trouvons votre prestation ou salon idéal ?</h2>
            <p>Discutez directement avec Maria pour dénicher les meilleurs styles, particuliers ou salons.</p>
          </div>
          <button className="discovery-primary" onClick={openMaria}>
            Parler à Maria <ArrowUpRight size={18} />
          </button>
        </aside>
      </div>

    {showFilters && (
      <FilterDialog
        filters={filters}
        cities={cities}
        servicesAvailable={servicesAvailable}
        resultCount={activeItems.length}
        onClose={() => setShowFilters(false)}
        onApply={next => { updateParams(next); setShowFilters(false); }}
      />
    )}
  </div>
  );
}

