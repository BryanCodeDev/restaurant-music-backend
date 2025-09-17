// src/routes/restaurants.js - COMPLETE ROUTES WITH PUBLIC ENDPOINT
const express = require('express');
const { body, param, query } = require('express-validator');
const { 
  validate, 
  validateOptionalQueryParams 
} = require('../middleware/validation');
const { authenticateToken, requireRestaurant } = require('../middleware/auth');
const {
  getRestaurantBySlug,
  getRestaurantStats,
  getRestaurantSettings,
  updateRestaurantSettings,
  getPublicRestaurants,  // NOW IMPORTED
  regenerateQR
} = require('../controllers/restaurantController');

const router = express.Router();

// ===== PUBLIC ROUTES =====

// Get all public restaurants (for RestaurantSelector) - THIS WAS MISSING
router.get('/', 
  validateOptionalQueryParams(['page', 'limit', 'search', 'isActive', 'city']),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('city')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City must be between 1 and 100 characters'),
  validate,
  getPublicRestaurants  // NOW CONNECTED TO CONTROLLER
);

// Get restaurant by slug (public)
router.get('/:slug', 
  param('slug')
    .isSlug()
    .withMessage('Invalid restaurant slug'),
  validate,
  getRestaurantBySlug
);

// Get restaurant statistics (public)
router.get('/:slug/stats', 
  param('slug')
    .isSlug()
    .withMessage('Invalid restaurant slug'),
  validateOptionalQueryParams(['period']),
  query('period')
    .optional()
    .isIn(['1h', '24h', '7d', '30d'])
    .withMessage('Period must be one of: 1h, 24h, 7d, 30d'),
  validate,
  getRestaurantStats
);

// ===== PROTECTED ROUTES (RESTAURANT ADMIN ONLY) =====

// Get restaurant settings
router.get('/admin/settings', 
  authenticateToken,
  requireRestaurant,
  getRestaurantSettings
);

// Update restaurant settings
router.put('/admin/settings', 
  authenticateToken,
  requireRestaurant,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Invalid phone number format'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Address must be between 5 and 500 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters'),
  body('max_requests_per_user')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max requests per user must be between 1 and 10'),
  body('queue_limit')
    .optional()
    .isInt({ min: 10, max: 200 })
    .withMessage('Queue limit must be between 10 and 200'),
  body('auto_play')
    .optional()
    .isBoolean()
    .withMessage('Auto play must be a boolean'),
  body('allow_explicit')
    .optional()
    .isBoolean()
    .withMessage('Allow explicit must be a boolean'),
  validate,
  updateRestaurantSettings
);

// Regenerate QR code
router.post('/:slug/regenerate-qr', 
  authenticateToken,
  requireRestaurant,
  param('slug')
    .isSlug()
    .withMessage('Invalid restaurant slug'),
  validate,
  regenerateQR
);

module.exports = router;