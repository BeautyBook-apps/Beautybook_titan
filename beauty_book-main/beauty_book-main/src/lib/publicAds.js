import { entities } from '@/api/entities';

const PUBLIC_STATUSES = new Set(['actif', 'active', 'publie', 'publiee', 'published']);

function asPages(ad) {
  if (Array.isArray(ad.pages) && ad.pages.length > 0) {
    return ad.pages.map(page => {
      const value = String(page).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s]+/g, '');
      if (value.includes('style')) return 'styles';
      if (value.includes('service')) return 'services';
      if (value.includes('reel')) return 'reels';
      return String(page).toLowerCase();
    });
  }

  const type = String(ad.type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s]+/g, '');
  if (['feed', 'reel', 'reels'].includes(type)) return ['reels'];
  if (type.includes('style')) return ['styles'];
  if (type.includes('service')) return ['services'];
  if (['banner', 'banniere'].includes(type)) return ['styles', 'services'];
  return [];
}

function normalizeAd(ad) {
  const imageUrl = ad.image_url || (Array.isArray(ad.images) ? ad.images[0] : '') || '';
  return {
    ...ad,
    image_url: imageUrl,
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
