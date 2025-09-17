// src/routes/favorites.js - FIXED WITH FLEXIBLE VALIDATION
const express = require('express');
const { body, param } = require('express-validator');
const { validate, validateUserId, validateSongId } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');
const {
  getUserFavorites,
  toggleFavorite,
  clearAllFavorites
} = require('../controllers/favoriteController');

const router = express.Router();

// CORREGIDO: Validaciones más flexibles para favoritos
const toggleFavoriteValidation = [
  body('userId')
    .custom(validateUserId)
    .withMessage('Valid user ID is required'),
  
  body('songId')
    .custom(validateSongId)
    .withMessage('Valid song ID is required')
];

const userFavoritesValidation = [
  param('userId')
    .custom(validateUserId)
    .withMessage('Valid user ID is required')
];

// Rutas con autenticación opcional
router.get('/user/:userId', optionalAuth, userFavoritesValidation, validate, getUserFavorites);
router.post('/', optionalAuth, toggleFavoriteValidation, validate, toggleFavorite);
router.delete('/user/:userId', optionalAuth, userFavoritesValidation, validate, clearAllFavorites);

module.exports = router;