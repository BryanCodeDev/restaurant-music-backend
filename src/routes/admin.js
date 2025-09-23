// src/routes/admin.js
const express = require('express');
const { body, query, param } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const {
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getAllSubscriptions,
  approveSubscription,
  rejectSubscription,
  getGlobalStats
} = require('../controllers/adminController');

const router = express.Router();

// Validaciones para approve/reject restaurant
const approvalValidation = [
  body('plan')
    .optional()
    .isIn(['free', 'basic', 'pro'])
    .withMessage('Plan must be free, basic, or pro'),
  body('payment_proof_path')
    .optional()
    .isString()
    .withMessage('Payment proof path must be a string'),
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters')
];

// Validaciones para suscripciones
const subscriptionApprovalValidation = [
  body('approvedAt')
    .optional()
    .isISO8601()
    .withMessage('Approved at must be a valid ISO date'),
  body('adminNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must not exceed 1000 characters')
];

const subscriptionRejectionValidation = [
  body('rejectedAt')
    .optional()
    .isISO8601()
    .withMessage('Rejected at must be a valid ISO date'),
  body('rejectionReason')
    .notEmpty()
    .withMessage('Rejection reason is required'),
  body('adminNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must not exceed 1000 characters')
];

// Validaciones para obtener suscripciones
const getSubscriptionsValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'all'])
    .withMessage('Status must be pending, approved, rejected, or all'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
];

// Rutas protegidas por superadmin
router.get('/pending-restaurants', authenticateToken, requireSuperAdmin, getPendingRestaurants);
router.get('/global-stats', authenticateToken, requireSuperAdmin, getGlobalStats);
router.patch('/approve-restaurant/:id', authenticateToken, requireSuperAdmin, approvalValidation, validate, approveRestaurant);
router.post('/reject-restaurant/:id', authenticateToken, requireSuperAdmin, approvalValidation, validate, rejectRestaurant);

// Rutas de administración de suscripciones
router.get('/subscriptions',
  authenticateToken,
  requireSuperAdmin,
  getSubscriptionsValidation,
  validate,
  getAllSubscriptions
);

router.put('/subscriptions/:id/approve',
  authenticateToken,
  requireSuperAdmin,
  param('id')
    .notEmpty()
    .withMessage('Subscription ID is required'),
  subscriptionApprovalValidation,
  validate,
  approveSubscription
);

router.put('/subscriptions/:id/reject',
  authenticateToken,
  requireSuperAdmin,
  param('id')
    .notEmpty()
    .withMessage('Subscription ID is required'),
  subscriptionRejectionValidation,
  validate,
  rejectSubscription
);

module.exports = router;