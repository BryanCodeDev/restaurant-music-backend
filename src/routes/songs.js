// src/routes/songs.js
const express = require('express');
const { param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const {
  getSongs,
  searchSongs,
  getPopularSongs,
  getSongsByGenre,
  getSongDetails,
  getGenres
} = require('../controllers/songController');

const router = express.Router();

// Validaciones comunes
const restaurantValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier')
];

const songValidation = [
  ...restaurantValidation,
  param('songId')
    .isUUID()
    .withMessage('Valid song ID is required')
];

const genreValidation = [
  ...restaurantValidation,
  param('genre')
    .isAlpha()
    .isLength({ min: 2, max: 20 })
    .withMessage('Invalid genre')
];

const searchValidation = [
  ...restaurantValidation,
  query('q')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  
  query('genre')
    .optional()
    .isAlpha()
    .isLength({ min: 2, max: 20 })
    .withMessage('Invalid genre'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

const listValidation = [
  ...restaurantValidation,
  query('genre')
    .optional()
    .isAlpha()
    .withMessage('Invalid genre'),
    
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search must be between 2 and 100 characters'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

const popularValidation = [
  ...restaurantValidation,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20')
];

const genreListValidation = [
  ...restaurantValidation,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Rutas públicas
router.get('/:restaurantSlug', listValidation, validate, getSongs);
router.get('/:restaurantSlug/search', searchValidation, validate, searchSongs);
router.get('/:restaurantSlug/popular', popularValidation, validate, getPopularSongs);
router.get('/:restaurantSlug/genres', restaurantValidation, validate, getGenres);
router.get('/:restaurantSlug/genre/:genre', genreListValidation, validate, getSongsByGenre);
router.get('/:restaurantSlug/song/:songId', songValidation, validate, getSongDetails);

module.exports = router;