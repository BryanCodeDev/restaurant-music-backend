// src/routes/restaurants.js
const express = require('express');
const { param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken, requireRestaurant } = require('../middleware/auth');
const {
  getRestaurantBySlug,
  getRestaurantStats,
  updateRestaurantSettings,
  getRestaurantSettings,
  regenerateQR
} = require('../controllers/restaurantController');

const router = express.Router();

// Validaciones
const restaurantValidation = [
  param('slug')
    .isSlug()
    .withMessage('Invalid restaurant slug')
];

const statsValidation = [
  ...restaurantValidation,
  query('period')
    .optional()
    .isIn(['1h', '24h', '7d', '30d'])
    .withMessage('Period must be one of: 1h, 24h, 7d, 30d')
];

// Rutas públicas
router.get('/:slug', restaurantValidation, validate, getRestaurantBySlug);
router.get('/:slug/stats', statsValidation, validate, getRestaurantStats);

// Rutas protegidas (requieren autenticación de restaurante)
router.get('/:slug/settings', authenticateToken, requireRestaurant, restaurantValidation, validate, getRestaurantSettings);
router.put('/:slug/settings', authenticateToken, requireRestaurant, restaurantValidation, validate, updateRestaurantSettings);
router.post('/:slug/regenerate-qr', authenticateToken, requireRestaurant, restaurantValidation, validate, regenerateQR);

module.exports = router;