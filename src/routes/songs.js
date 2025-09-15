// src/routes/songs.js - FIXED GENRE VALIDATION
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const {
  getSongs,
  searchSongs,
  getPopularSongs,
  getSongsByGenre,
  getSongDetails,
  getGenres
} = require('../controllers/songController');

const {
  validate,
  validateOptionalQueryParams
} = require('../middleware/validation');

// Validaciones comunes
const restaurantSlugValidation = [
  param('restaurantSlug')
    .isLength({ min: 3, max: 100 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Restaurant slug must contain only lowercase letters, numbers and hyphens')
];

const songIdValidation = [
  param('songId')
    .notEmpty()
    .withMessage('Song ID is required')
];

// CORREGIDO: Validación de género más permisiva
const genreValidation = [
  query('genre')
    .optional()
    .custom((value) => {
      // Lista expandida de géneros permitidos
      const allowedGenres = [
        'all', // Opción especial para "todos los géneros"
        'rock', 'pop', 'electronic', 'hip-hop', 'hiphop', 'jazz', 
        'reggaeton', 'salsa', 'ballad', 'classical', 'reggae', 
        'funk', 'country', 'blues', 'r&b', 'rnb', 'latin', 
        'folk', 'indie', 'metal', 'punk', 'disco', 'house', 
        'techno', 'ambient', 'world', 'rap', 'trap', 'dancehall',
        'cumbia', 'merengue', 'bachata', 'flamenco', 'tango',
        'vallenato', 'ranchera', 'mariachi', 'alternative', 
        'grunge', 'ska', 'swing', 'gospel', 'soul', 'edm',
        'dubstep', 'trance', 'drum-and-bass', 'dnb'
      ];
      
      const normalizedValue = value.toLowerCase().trim();
      
      if (!allowedGenres.includes(normalizedValue)) {
        throw new Error(`Invalid genre. Received: "${value}". Must be one of: ${allowedGenres.slice(0, 15).join(', ')}...`);
      }
      
      return true;
    })
];

const searchValidation = [
  query('q')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters')
    .trim()
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer (max 1000)')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

// Rutas principales

// GET /songs/:restaurantSlug - Obtener canciones con filtros opcionales
router.get('/:restaurantSlug', [
  ...restaurantSlugValidation,
  ...genreValidation,
  ...paginationValidation,
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be between 2 and 100 characters')
    .trim(),
  validateOptionalQueryParams(['page', 'limit', 'genre', 'search', 'sort']),
  validate
], getSongs);

// GET /songs/:restaurantSlug/search - Buscar canciones
router.get('/:restaurantSlug/search', [
  ...restaurantSlugValidation,
  ...searchValidation,
  ...genreValidation,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),
  validate
], searchSongs);

// GET /songs/:restaurantSlug/popular - Canciones populares
router.get('/:restaurantSlug/popular', [
  ...restaurantSlugValidation,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),
  validate
], getPopularSongs);

// GET /songs/:restaurantSlug/genres - Obtener géneros disponibles
router.get('/:restaurantSlug/genres', [
  ...restaurantSlugValidation,
  validate
], getGenres);

// GET /songs/:restaurantSlug/genre/:genre - Canciones por género específico
router.get('/:restaurantSlug/genre/:genre', [
  ...restaurantSlugValidation,
  param('genre')
    .notEmpty()
    .withMessage('Genre is required')
    .custom((value) => {
      const allowedGenres = [
        'rock', 'pop', 'electronic', 'hip-hop', 'hiphop', 'jazz', 
        'reggaeton', 'salsa', 'ballad', 'classical', 'reggae', 
        'funk', 'country', 'blues', 'r&b', 'rnb', 'latin', 
        'folk', 'indie', 'metal', 'punk', 'disco', 'house', 
        'techno', 'ambient', 'world'
      ];
      
      if (!allowedGenres.includes(value.toLowerCase())) {
        throw new Error(`Invalid genre: ${value}`);
      }
      
      return true;
    }),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  validate
], getSongsByGenre);

// GET /songs/:restaurantSlug/song/:songId - Detalles de canción específica
router.get('/:restaurantSlug/song/:songId', [
  ...restaurantSlugValidation,
  ...songIdValidation,
  validate
], getSongDetails);

// Middleware de manejo de errores específico para esta ruta
router.use((error, req, res, next) => {
  console.error('Songs route error:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body'
    });
  }
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error in songs route',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

module.exports = router;