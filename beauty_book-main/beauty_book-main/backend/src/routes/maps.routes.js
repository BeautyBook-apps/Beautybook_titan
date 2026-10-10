import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { placesAutocomplete, geocode, reverseGeocode } from '../controllers/maps.controller.js';

const router = express.Router();

router.post('/places-autocomplete', requireAuth, placesAutocomplete);
router.post('/geocode', requireAuth, geocode);
router.get('/reverse', async (req, res, next) => {
  try {
    await reverseGeocode(req, res);
  } catch (error) {
    // Reverse geocoding is optional: GPS tracking must keep working when a
    // provider or the network is temporarily unavailable.
    console.warn('reverse route unavailable:', error.message);
    if (!res.headersSent) res.json({ city: '', country: '', unavailable: true });
    else next(error);
  }
});

export default router;
