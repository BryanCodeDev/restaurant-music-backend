// src/routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const {
  registerRestaurant,
  loginRestaurant,
  createUserSession,
  getProfile,
  updateRestaurantProfile,
  verifyToken
} = require('../controllers/authController');

const router = express.Router();

// Validaciones
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Restaurant name must be between 2 and 255 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
    
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
    
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
    
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must not exceed 100 characters'),
    
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must not exceed 100 characters')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Restaurant name must be between 2 and 255 characters'),
    
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
    
  body('max_requests_per_user')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max requests per user must be between 1 and 10'),
    
  body('queue_limit')
    .optional()
    .isInt({ min: 10, max: 200 })
    .withMessage('Queue limit must be between 10 and 200'),
    
  body('auto_play')
    .optional()
    .isBoolean()
    .withMessage('Auto play must be a boolean value'),
    
  body('allow_explicit')
    .optional()
    .isBoolean()
    .withMessage('Allow explicit must be a boolean value')
];

const userSessionValidation = [
  body('tableNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Table number must not exceed 50 characters')
];

// Rutas públicas
router.post('/register', registerValidation, validate, registerRestaurant);
router.post('/login', loginValidation, validate, loginRestaurant);

// Crear sesión de usuario (mesa) - No requiere auth
router.post('/session/:restaurantSlug', userSessionValidation, validate, createUserSession);

// Rutas protegidas
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfileValidation, validate, updateRestaurantProfile);
router.get('/verify', authenticateToken, verifyToken);

module.exports = router;