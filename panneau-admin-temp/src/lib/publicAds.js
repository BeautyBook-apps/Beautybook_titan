import { entities } from '@/api/entities';

const PUBLIC_STATUSES = new Set(['actif', 'active', 'publie', 'publiee', 'published']);

function normalizePlacement(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\s]+/g, '');
}

function asPages(ad) {
  const type = normalizePlacement(ad.type);
  const typePages = type.includes('style')
    ? ['styles']
    : type.includes('service')
      ? ['services']
      : ['banner', 'banniere'].includes(type)
        ? ['styles', 'services']
        : type.includes('reel') || type === 'feed'
          ? ['reels']
          : [];

  if (Array.isArray(ad.pages) && ad.pages.length > 0) {
    const explicitPages = ad.pages.map(page => {
      const value = normalizePlacement(page);
      if (value.includes('style')) return 'styles';
      if (value.includes('service')) return 'services';
      if (value.includes('reel')) return 'reels';
      return String(page).toLowerCase();
    });
    if (explicitPages.some(page => ['styles', 'services'].includes(page))) return [...new Set(explicitPages)];
    if (typePages.some(page => ['styles', 'services'].includes(page))) return typePages;
    return explicitPages;
  }

  return typePages;
}

function normalizeAd(ad) {
  return {
    ...ad,
    image_url: ad.image_url || (Array.isArray(ad.images) ? ad.images[0] : '') || '',
    video_url: ad.video_url || '',
    cta_url: ad.cta_url || ad.target_url || '',
    pages: asPages(ad),
  };
}

function isDateVisible(ad, today) {
  return (!ad.start_date || String(ad.start_date).slice(0, 10) <= today)
    && (!ad.end_date || String(ad.end_date).slice(0, 10) >= today);
}

export async function getPublicAds({ page, limit = 20 } = {}) {
  const rows = await entities.Annonce.list('-created_at', Math.min(Math.max(limit * 3, 20), 100));
  const today = new Date().toISOString().slice(0, 10);

  return (rows || [])
    .filter(ad => PUBLIC_STATUSES.has(String(ad.status || '').toLowerCase()))
    .filter(ad => ad.image_url || ad.video_url || (Array.isArray(ad.images) && ad.images.length > 0))
    .filter(ad => isDateVisible(ad, today))
    .map(normalizeAd)
    .filter(ad => !page || ad.pages.length === 0 || ad.pages.includes(page))
    .slice(0, limit);
}
