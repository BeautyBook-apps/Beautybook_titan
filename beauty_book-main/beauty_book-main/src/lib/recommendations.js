const TOKEN_FIELDS = [
  'name', 'title', 'description', 'brand', 'category', 'subcategory',
  'style', 'tags', 'specialites', 'type', 'service_name', 'target_title',
];

const normalizeText = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const tokenize = value => normalizeText(value)
  .split(/\s+/)
  .filter(token => token.length >= 3 && !STOP_WORDS.has(token));

const STOP_WORDS = new Set([
  'avec', 'pour', 'dans', 'sur', 'les', 'des', 'une', 'aux', 'par', 'and',
  'the', 'beauty', 'book', 'service', 'services', 'produit', 'produits',
]);

const toNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const firstValue = (...values) => values.find(value => value !== undefined && value !== null && value !== '');

const searchableText = value => {
  if (Array.isArray(value)) return value.map(searchableText).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(searchableText).filter(Boolean).join(' ');
  return String(value ?? '');
};

const addWeightedTokens = (weights, value, weight = 1) => {
  tokenize(searchableText(value)).forEach(token => weights.set(token, (weights.get(token) || 0) + weight));
};

const addWeightedCategory = (weights, value, weight = 1) => {
  const category = normalizeText(value);
  if (category) weights.set(category, (weights.get(category) || 0) + weight);
};

const itemId = item => String(item?.id ?? item?.target_id ?? '').trim();
const RECOMMENDATION_EVENTS_KEY = 'bb_recommendation_events';

export function readRecommendationEvents() {
  if (typeof window === 'undefined') return [];
  try {
    const events = JSON.parse(window.localStorage.getItem(RECOMMENDATION_EVENTS_KEY) || '[]');
    return Array.isArray(events) ? events.slice(-200) : [];
  } catch {
    return [];
  }
}

export function recordRecommendationEvent(type, item) {
  if (typeof window === 'undefined' || !item?.id) return;
  const event = {
    type,
    item_id: String(item.id),
    target_title: firstValue(item.title, item.name, item.service_name),
    target_data: item,
    created_at: new Date().toISOString(),
  };
  const events = readRecommendationEvents().filter(previous => !(previous.item_id === event.item_id && previous.type === type && Date.now() - Date.parse(previous.created_at) < 30000));
  try { window.localStorage.setItem(RECOMMENDATION_EVENTS_KEY, JSON.stringify([...events, event].slice(-200))); } catch {}
}

export const getRecommendationItemTokens = item => {
  const tokens = new Set();
  TOKEN_FIELDS.forEach(field => tokenize(item?.[field]).forEach(token => tokens.add(token)));
  return tokens;
};

const getRecommendationCategory = item => normalizeText(firstValue(
  item?.category,
  item?.subcategory,
  item?.type,
  item?.service_type,
  'beaute',
));

const readLocalArray = key => {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

/**
 * Construit un profil de goût à partir des signaux déjà disponibles dans
 * BeautyBook. Les poids sont volontairement simples et lisibles pour pouvoir
 * être ajustés sans réentraîner un modèle.
 */
export function buildRecommendationProfile({
  user,
  profile,
  reservations = [],
  favorites = [],
  likes = [],
  events = [],
  catalog = [],
} = {}) {
  const positiveTokens = new Map();
  const categoryWeights = new Map();
  const positiveIds = new Set();
  const negativeIds = new Set();
  const serviceById = new Map(catalog.map(item => [itemId(item), item]));
  const serviceByName = new Map(catalog.map(item => [normalizeText(firstValue(item?.name, item?.title)), item]));

  const addPreference = (value, weight = 1) => addWeightedTokens(positiveTokens, value, weight);
  const addCategory = (value, weight = 1) => addWeightedCategory(categoryWeights, value, weight);

  addPreference(profile?.beauty_interests, 3);
  addPreference(user?.beauty_interests, 3);
  addPreference(profile?.favorite_categories, 3);
  addPreference(user?.favorite_categories, 3);

  const memory = profile?.maria_memory || user?.maria_memory;
  if (memory && typeof memory === 'object') {
    addPreference(memory.preferences, 2);
    addPreference(memory.interests, 2);
    addPreference(memory.favorites, 2);
    addPreference(memory.last_services, 2);
  }

  reservations.forEach(reservation => {
    const service = serviceById.get(String(reservation?.service_id || ''))
      || serviceByName.get(normalizeText(reservation?.service_name));
    const source = service || reservation;
    addPreference(firstValue(source?.name, source?.title, reservation?.service_name), 5);
    addPreference(source?.tags, 3);
    addCategory(firstValue(source?.category, source?.subcategory), 5);
    if (source?.id) positiveIds.add(String(source.id));
  });

  [...favorites, ...likes].forEach(signal => {
    const id = itemId(signal);
    if (id) positiveIds.add(id);
    addPreference(signal?.target_title, 4);
    addPreference(signal?.target_data, 3);
    addCategory(signal?.target_type, 2);
  });

  events.forEach(event => {
    const weight = event.type === 'favorite' ? 5 : event.type === 'like' ? 4 : event.type === 'click' ? 2.5 : 1;
    if (event.item_id) positiveIds.add(String(event.item_id));
    addPreference(event.target_title, weight);
    addPreference(event.target_data, weight * 0.5);
    addCategory(event.target_data?.category || event.target_type, weight * 0.5);
  });

  readLocalArray('bb_liked_services').forEach(id => positiveIds.add(String(id)));
  readLocalArray('bb_liked_styles').forEach(id => positiveIds.add(String(id)));
  readLocalArray('bb_unliked_services').forEach(id => negativeIds.add(String(id)));

  return { positiveTokens, categoryWeights, positiveIds, negativeIds };
}

const popularityOf = item => Math.log1p(
  toNumber(firstValue(item?.likes, item?.favorites, item?.orders_count, 0))
  + toNumber(firstValue(item?.views, item?.reviews_count, item?.review_count, 0)) * 0.25,
);

const recencyOf = item => {
  const timestamp = Date.parse(firstValue(item?.created_at, item?.updated_at, ''));
  if (!Number.isFinite(timestamp)) return 0;
  const days = Math.max(0, (Date.now() - timestamp) / 86400000);
  return Math.max(0, 1 - days / 365);
};

const reasonFor = (item, profile, score) => {
  const matchedTokens = [...getRecommendationItemTokens(item)]
    .filter(token => profile.positiveTokens.has(token))
    .sort((a, b) => (profile.positiveTokens.get(b) || 0) - (profile.positiveTokens.get(a) || 0));
  const category = getRecommendationCategory(item);
  if (matchedTokens.length) return `Correspond à vos envies : ${matchedTokens.slice(0, 2).join(' · ')}`;
  if (category && profile.categoryWeights.has(category)) return 'Dans une catégorie que vous appréciez';
  if (toNumber(item?.rating) >= 4.5) return 'Très apprécié par la communauté';
  if (score > 0) return 'Sélectionné pour vous';
  return 'À découvrir';
};

/** Classe des contenus avec une stratégie hybride : goût, historique,
 * signaux explicites, qualité, popularité et fraîcheur. */
export function rankRecommendations(items = [], profile = {}, { limit = 8, excludeIds = [] } = {}) {
  const excluded = new Set(excludeIds.map(String));
  const candidates = (Array.isArray(items) ? items : [])
    .filter(item => item && itemId(item) && !excluded.has(itemId(item)))
    .map((item, index) => {
      const tokens = getRecommendationItemTokens(item);
      const tokenScore = [...tokens].reduce((total, token) => total + (profile.positiveTokens?.get(token) || 0), 0);
      const category = getRecommendationCategory(item);
      const categoryScore = profile.categoryWeights?.get(category) || 0;
      const idScore = profile.positiveIds?.has(itemId(item)) ? 8 : 0;
      const negativeScore = profile.negativeIds?.has(itemId(item)) ? 12 : 0;
      const ratingScore = Math.min(2, Math.max(0, (toNumber(item.rating) - 3) * 0.8));
      const popularityScore = Math.min(2, popularityOf(item) * 0.4);
      const recencyScore = recencyOf(item) * 0.5;
      const promoScore = firstValue(item.promo_price, item.discount_percent, item.discount_percentage) ? 0.35 : 0;
      const score = tokenScore + categoryScore * 1.5 + idScore + ratingScore + popularityScore + recencyScore + promoScore - negativeScore;
      return {
        ...item,
        recommendation_score: Math.round(score * 100) / 100,
        recommendation_reason: reasonFor(item, profile, score),
        _recommendationIndex: index,
      };
    })
    .sort((a, b) => b.recommendation_score - a.recommendation_score || a._recommendationIndex - b._recommendationIndex);

  return candidates.slice(0, Math.max(0, limit)).map(({ _recommendationIndex, ...item }) => item);
}

export async function loadRecommendationSignals({ email, entities } = {}) {
  if (!email || !entities) return { reservations: [], favorites: [], likes: [], events: readRecommendationEvents() };
  const [reservations, favorites, likes] = await Promise.allSettled([
    entities.Reservation.filter({ client_email: email }, '-created_at', 100),
    entities.Favori.filter({ user_email: email }, '-created_at', 100),
    entities.Like.filter({ user_email: email }, '-created_at', 100),
  ]);
  return {
    reservations: reservations.status === 'fulfilled' ? reservations.value || [] : [],
    favorites: favorites.status === 'fulfilled' ? favorites.value || [] : [],
    likes: likes.status === 'fulfilled' ? likes.value || [] : [],
    events: readRecommendationEvents(),
  };
}
