// src/routes/stats.js
const express = require('express');
const { param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const statsController = require('../controllers/statsController');

const router = express.Router();

// Validaciones
const userStatsValidation = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  query('period')
    .optional()
    .isIn(['24h', '7d', '30d'])
    .withMessage('Period must be 24h, 7d, or 30d')
];

const restaurantStatsValidation = [
  param('restaurantId')
    .notEmpty()
    .withMessage('Restaurant ID is required'),
  query('period')
    .optional()
    .isIn(['24h', '7d', '30d'])
    .withMessage('Period must be 24h, 7d, or 30d')
];

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// =============================
// RUTAS DE ESTADÍSTICAS
// =============================

// Dashboard general (solo superadmin)
router.get('/dashboard',
  requireSuperAdmin,
  statsController.getDashboardStats
);

// Estadísticas de usuario específico
router.get('/user/:userId',
  userStatsValidation,
  validate,
  statsController.getUserStats
);

// Estadísticas de restaurante específico
router.get('/restaurant/:restaurantId',
  restaurantStatsValidation,
  validate,
  statsController.getRestaurantStats
);

module.exports = router;