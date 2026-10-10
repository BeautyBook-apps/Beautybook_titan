import express from 'express';
import { getStyles, getAnnonces, getProduits, getImmobilier, trackStyleEngagement, getStyleEngagementStats, setStyleLike } from '../controllers/content.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/styles', getStyles);
router.post('/styles/engagement', trackStyleEngagement);
router.post('/styles/engagement-stats', getStyleEngagementStats);
router.post('/styles/like', requireAuth, setStyleLike);
router.post('/annonces', getAnnonces);
router.post('/produits', getProduits);
router.post('/immobilier', getImmobilier);

export default router;
