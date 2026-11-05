import { entities } from '@/api/entities';

const PUBLIC_STATUSES = new Set(['actif', 'active', 'publie', 'publiee', 'published']);

// Annonces de démonstration intégrées avec repères / callouts interactifs
// (coiffure, habits / tenue, maquillage, soins, produits)
export const DEMO_ADS = [
  {
    id: 'demo-ad-haute-couture',
    title: 'Collection & Style Signature',
    description: 'Découvrez notre look complet : Coiffure tressée sculptée et Robe de soirée en soie. Cliquez sur les repères pour réserver ou commander !',
    sponsor_name: 'Atelier Maison Beauté',
    sponsor_logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
    image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop&q=80',
    type: 'reel',
    pages: ['reels', 'styles'],
    cta_label: 'Voir la collection',
    cta_url: '/services-salons',
    status: 'actif',
    callouts: [
      {
        id: 'ad-c1',
        x: 50,
        y: 20,
        label: 'Coiffure Chignon Sculpté',
        targetType: 'service',
        targetId: 'service_coiffure',
        targetName: 'Chignon & Tresses Signature'
      },
      {
        id: 'ad-c2',
        x: 48,
        y: 38,
        label: 'Maquillage Teint Lumineux',
        targetType: 'service',
        targetId: 'service_maquillage',
        targetName: 'Mise en Beauté Prestige'
      },
      {
        id: 'ad-c3',
        x: 52,
        y: 65,
        label: 'Robe Soie & Habit Soirée',
        targetType: 'produit',
        targetId: 'prod_robe',
        targetName: 'Robe Soirée Haute Couture'
      }
    ]
  },
  {
    id: 'demo-ad-street-glow',
    title: 'Street Style & Soin Capillaire',
    description: 'Look urbain tendance : Coupe texturisée dégradée, Veste Bomber satinée et Sérum Brillance Éclat.',
    sponsor_name: 'Studio Kérastase & Style',
    sponsor_logo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop&q=80',
    type: 'reel',
    pages: ['reels', 'styles'],
    cta_label: 'Découvrir les offres',
    cta_url: '/services-salons',
    status: 'actif',
    callouts: [
      {
        id: 'ad-c4',
        x: 48,
        y: 18,
        label: 'Coiffure Waves Naturelles',
        targetType: 'service',
        targetId: 'service_waves',
        targetName: 'Wavy & Brushing Volume'
      },
      {
        id: 'ad-c5',
        x: 35,
        y: 52,
        label: 'Ensemble Veste & Tenue Tendance',
        targetType: 'produit',
        targetId: 'prod_ensemble',
        targetName: 'Ensemble Casual Street Chic'
      },
      {
        id: 'ad-c6',
        x: 72,
        y: 70,
        label: 'Sérum Nutrition Élixir',
        targetType: 'produit',
        targetId: 'prod_serum',
        targetName: 'Huile Nourrissante Brillance'
      }
    ]
  }
];

function asPages(ad) {
  const type = String(ad.type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s]+/g, '');
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
      const value = String(page).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s]+/g, '');
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
  const imageUrl = ad.image_url || (Array.isArray(ad.images) ? ad.images[0] : '') || '';
  // Extraire les callouts si présents directement ou sérialisés dans la description
  let callouts = Array.isArray(ad.callouts) ? ad.callouts : [];
  if (callouts.length === 0 && ad.description) {
    const match = String(ad.description).match(/<!--CALLOUTS:(.*?)-->/);
    if (match) {
      try { callouts = JSON.parse(match[1]); } catch {}
    }
  }

  return {
    ...ad,
    image_url: imageUrl,
    video_url: ad.video_url || '',
    cta_url: ad.cta_url || ad.target_url || '',
    pages: asPages(ad),
    callouts,
  };
}

function isDateVisible(ad, today) {
  return (!ad.start_date || String(ad.start_date).slice(0, 10) <= today)
    && (!ad.end_date || String(ad.end_date).slice(0, 10) >= today);
}

export async function getPublicAds({ page, limit = 20 } = {}) {
  let dbRows = [];
  try {
    const rows = await entities.Annonce.list('-created_at', Math.min(Math.max(limit * 3, 20), 100));
    dbRows = rows || [];
  } catch (e) {
    console.warn('[getPublicAds] error loading from DB, using fallback demo ads:', e);
  }

  const today = new Date().toISOString().slice(0, 10);

  const activeDbAds = dbRows
    .filter(ad => PUBLIC_STATUSES.has(String(ad.status || '').toLowerCase()))
    .filter(ad => ad.image_url || ad.video_url || (Array.isArray(ad.images) && ad.images.length > 0))
    .filter(ad => isDateVisible(ad, today))
    .map(normalizeAd);

  // Fusionner les annonces DB et les annonces de démo enrichies
  const allAds = [...activeDbAds, ...DEMO_ADS.map(normalizeAd)];

  return allAds
    .filter(ad => !page || ad.pages.length === 0 || ad.pages.includes(page))
    .slice(0, limit);
}
