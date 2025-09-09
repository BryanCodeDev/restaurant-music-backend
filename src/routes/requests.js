// src/routes/requests.js
const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
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

// Validaciones
const createRequestValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier'),
  
  body('songId')
    .isUUID()
    .withMessage('Valid song ID is required'),
  
  body('tableNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Table number must be between 1 and 50 characters')
];

const cancelRequestValidation = [
  param('requestId')
    .isUUID()
    .withMessage('Valid request ID is required'),
  
  body('tableNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Table number must be between 1 and 50 characters')
];

const updateStatusValidation = [
  param('requestId')
    .isUUID()
    .withMessage('Valid request ID is required'),
  
  body('status')
    .isIn(['pending', 'playing', 'completed', 'cancelled'])
    .withMessage('Invalid status value')
];

const queueValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier'),
  
  query('status')
    .optional()
    .isIn(['pending', 'playing', 'completed', 'cancelled', 'all'])
    .withMessage('Invalid status filter'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const userRequestsValidation = [
  param('restaurantSlug')
    .isSlug()
    .withMessage('Invalid restaurant identifier'),
    
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
    
  query('period')
    .optional()
    .isIn(['1h', '24h', '7d', '30d'])
    .withMessage('Period must be one of: 1h, 24h, 7d, 30d')
];

// Rutas públicas (sin autenticación requerida)
router.post('/:restaurantSlug', createRequestValidation, validate, createRequest);
router.get('/:restaurantSlug/user', userRequestsValidation, validate, getUserRequests);
router.get('/:restaurantSlug/stats', statsValidation, validate, getRequestStats);

// Rutas que requieren identificación opcional
router.delete('/:requestId', optionalAuth, cancelRequestValidation, validate, cancelRequest);

// Rutas protegidas (solo restaurantes autenticados)
router.get('/:restaurantSlug/queue', authenticateToken, queueValidation, validate, getRestaurantQueue);
router.patch('/:requestId/status', authenticateToken, updateStatusValidation, validate, updateRequestStatus);

module.exports = router;