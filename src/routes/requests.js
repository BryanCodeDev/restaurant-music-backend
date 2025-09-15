// src/routes/requests.js - FINAL VERSION WITH PROPER VALIDATION
const express = require('express');
const { body, param, query } = require('express-validator');
const { 
  validate, 
  validateSongId, 
  validateRequestId, 
  validateSongExistsInRestaurant,
  validateOptionalQueryParams 
} = require('../middleware/validation');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
  createRequest,
  getUserRequests,
  getRestaurantQueue,
  cancelRequest,
  updateRequestStatus,
  getRequestStats
} = require('../controllers/requestController');

const router = express.Router();

// Validaciones mejoradas
const createRequestValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier'),
  
  body('songId')
    .custom(validateSongId)
    .withMessage('Valid song ID is required'),
  
  body('tableNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Table number must be between 1 and 50 characters')
];

const cancelRequestValidation = [
  param('requestId')
    .custom(validateRequestId)
    .withMessage('Valid request ID is required'),
  
  body('tableNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Table number must be between 1 and 50 characters')
];

const updateStatusValidation = [
  param('requestId')
    .custom(validateRequestId)
    .withMessage('Valid request ID is required'),
  
  body('status')
    .isIn(['pending', 'playing', 'completed', 'cancelled'])
    .withMessage('Invalid status value')
];

const queueValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier'),
  
  validateOptionalQueryParams(['status', 'page', 'limit']),
  
  query('status')
    .optional()
    .isIn(['pending', 'playing', 'completed', 'cancelled', 'all'])
    .withMessage('Invalid status filter'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100')
];

const userRequestsValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier'),
    
  validateOptionalQueryParams(['tableNumber']),
    
  query('tableNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Table number must be between 1 and 50 characters')
];

const statsValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier'),
    
  validateOptionalQueryParams(['period']),
    
  query('period')
    .optional()
    .isIn(['1h', '24h', '7d', '30d'])
    .withMessage('Period must be one of: 1h, 24h, 7d, 30d')
];

// === RUTAS PÚBLICAS ===
// Crear nueva petición musical
router.post('/:restaurantSlug', 
  createRequestValidation, 
  validate, 
  createRequest
);

// Obtener peticiones de usuario específico
router.get('/:restaurantSlug/user', 
  userRequestsValidation, 
  validate, 
  getUserRequests
);

// Obtener estadísticas de peticiones
router.get('/:restaurantSlug/stats', 
  statsValidation, 
  validate, 
  getRequestStats
);

// === RUTAS CON AUTENTICACIÓN OPCIONAL ===
// Cancelar petición (puede ser por usuario o admin)
router.delete('/:requestId', 
  optionalAuth, 
  cancelRequestValidation, 
  validate, 
  cancelRequest
);

// === RUTAS PROTEGIDAS (SOLO ADMINS) ===
// Obtener cola completa del restaurante
router.get('/:restaurantSlug/queue', 
  authenticateToken, 
  queueValidation, 
  validate, 
  getRestaurantQueue
);

// Actualizar estado de petición
router.patch('/:requestId/status', 
  authenticateToken, 
  updateStatusValidation, 
  validate, 
  updateRequestStatus
);

module.exports = router;