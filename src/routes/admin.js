// src/routes/admin.js
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { getPendingRestaurants, approveRestaurant, rejectRestaurant } = require('../controllers/adminController');

const router = express.Router();

// Middleware para superadmin (se añadirá en auth.js)
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.type === 'superadmin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Superadmin access required'
    });
  }
};

// Validaciones para approve/reject
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

// Rutas protegidas por superadmin
router.get('/pending-restaurants', authenticateToken, requireSuperAdmin, getPendingRestaurants);
router.patch('/approve-restaurant/:id', authenticateToken, requireSuperAdmin, approvalValidation, validate, approveRestaurant);
router.post('/reject-restaurant/:id', authenticateToken, requireSuperAdmin, approvalValidation, validate, rejectRestaurant);

module.exports = router;