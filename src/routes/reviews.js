// src/routes/reviews.js - Rutas para gestión de reviews de restaurantes
const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken, requireRegisteredUser } = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

const router = express.Router();

// ===== RUTAS PÚBLICAS =====

// Obtener reviews de un restaurante
router.get('/restaurant/:restaurantId',
  param('restaurantId')
    .isUUID()
    .withMessage('Invalid restaurant ID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .withMessage('Offset must be a non-negative integer'),
  query('sortBy')
    .optional()
    .isIn(['created_at', 'rating', 'helpful_votes'])
    .withMessage('sortBy must be one of: created_at, rating, helpful_votes'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('sortOrder must be ASC or DESC'),
  validate,
  reviewController.getRestaurantReviews
);

// Obtener estadísticas de reviews
router.get('/stats/:restaurantId?',
  param('restaurantId')
    .optional()
    .isUUID()
    .withMessage('Invalid restaurant ID'),
  validate,
  reviewController.getReviewStats
);

// ===== RUTAS PROTEGIDAS (USUARIOS REGISTRADOS) =====

// Crear nueva review
router.post('/',
  authenticateToken,
  requireRegisteredUser,
  body('restaurantId')
    .isUUID()
    .withMessage('Invalid restaurant ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('comment')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters'),
  body('musicQualityRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Music quality rating must be between 1 and 5'),
  body('serviceRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Service rating must be between 1 and 5'),
  body('ambianceRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Ambiance rating must be between 1 and 5'),
  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be a boolean'),
  validate,
  reviewController.createReview
);

// Obtener reviews del usuario autenticado
router.get('/user',
  authenticateToken,
  requireRegisteredUser,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .withMessage('Offset must be a non-negative integer'),
  validate,
  reviewController.getUserReviews
);

// ===== RUTAS PROTEGIDAS (PROPIETARIO DE LA REVIEW) =====

// Obtener review específica
router.get('/:id',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid review ID'),
  validate,
  reviewController.getReviewById
);

// Actualizar review
router.put('/:id',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid review ID'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('comment')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters'),
  body('musicQualityRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Music quality rating must be between 1 and 5'),
  body('serviceRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Service rating must be between 1 and 5'),
  body('ambianceRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Ambiance rating must be between 1 and 5'),
  validate,
  reviewController.updateReview
);

// Eliminar review
router.delete('/:id',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid review ID'),
  validate,
  reviewController.deleteReview
);

// Marcar review como útil
router.post('/:id/helpful',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid review ID'),
  validate,
  reviewController.voteHelpful
);

module.exports = router;