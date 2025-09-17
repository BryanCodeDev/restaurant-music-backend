// src/routes/auth.js - FIXED WITH ALL ENDPOINTS
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const {
  registerRestaurant,
  loginRestaurant,
  registerUser,
  loginUser,
  createUserSession,
  getProfile,
  updateRestaurantProfile,
  verifyToken
} = require('../controllers/authController');

const router = express.Router();

// Validaciones para restaurante
const restaurantRegisterValidation = [
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
    
  body('ownerName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Owner name must be between 2 and 100 characters'),
    
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
    .withMessage('Country must not exceed 100 characters'),

  body('cuisineType')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Cuisine type must not exceed 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

const restaurantLoginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Validaciones para usuario registrado
const userRegisterValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
    
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
    
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
    
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date'),
    
  body('preferredGenres')
    .optional()
    .isArray()
    .withMessage('Preferred genres must be an array'),
    
  body('preferredLanguages')
    .optional()
    .isArray()
    .withMessage('Preferred languages must be an array')
];

const userLoginValidation = [
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
    .withMessage('Name must be between 2 and 255 characters'),
    
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
    
  body('maxRequestsPerUser')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max requests per user must be between 1 and 10'),
    
  body('queueLimit')
    .optional()
    .isInt({ min: 10, max: 200 })
    .withMessage('Queue limit must be between 10 and 200'),
    
  body('autoPlay')
    .optional()
    .isBoolean()
    .withMessage('Auto play must be a boolean value'),
    
  body('allowExplicit')
    .optional()
    .isBoolean()
    .withMessage('Allow explicit must be a boolean value')
];

const userSessionValidation = [
  body('tableNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Table number must not exceed 50 characters'),
    
  body('registeredUserId')
    .optional()
    .isUUID()
    .withMessage('Registered user ID must be a valid UUID')
];

// =============================
// RUTAS PÚBLICAS
// =============================

// Restaurant routes
router.post('/register-restaurant', restaurantRegisterValidation, validate, registerRestaurant);
router.post('/login-restaurant', restaurantLoginValidation, validate, loginRestaurant);

// User routes  
router.post('/register-user', userRegisterValidation, validate, registerUser);
router.post('/login-user', userLoginValidation, validate, loginUser);

// Session routes
router.post('/session/:restaurantSlug', userSessionValidation, validate, createUserSession);

// Legacy routes (for backward compatibility)
router.post('/register', restaurantRegisterValidation, validate, registerRestaurant);
router.post('/login', restaurantLoginValidation, validate, loginRestaurant);

// =============================
// RUTAS PROTEGIDAS
// =============================

// Profile routes
router.get('/profile', authenticateToken, getProfile);
router.get('/profile-user', authenticateToken, getProfile); // Alias for registered users
router.put('/profile', authenticateToken, updateProfileValidation, validate, updateRestaurantProfile);
router.put('/profile-user', authenticateToken, updateProfileValidation, validate, updateRestaurantProfile);

// Token verification
router.get('/verify', authenticateToken, verifyToken);

module.exports = router;