// src/routes/favorites.js
const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');
const {
  getUserFavorites,
  toggleFavorite,
  clearAllFavorites
} = require('../controllers/favoriteController');

const router = express.Router();

// Validaciones
const toggleFavoriteValidation = [
  body('userId')
    .isUUID()
    .withMessage('Valid user ID is required'),
  
  body('songId')
    .isUUID()
    .withMessage('Valid song ID is required')
];

const userFavoritesValidation = [
  param('userId')
    .isUUID()
    .withMessage('Valid user ID is required')
];

// Rutas con autenticación opcional
router.get('/user/:userId', optionalAuth, userFavoritesValidation, validate, getUserFavorites);
router.post('/', optionalAuth, toggleFavoriteValidation, validate, toggleFavorite);
router.delete('/user/:userId', optionalAuth, userFavoritesValidation, validate, clearAllFavorites);

module.exports = router;