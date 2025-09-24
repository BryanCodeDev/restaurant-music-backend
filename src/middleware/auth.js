// src/middleware/auth.js - VERSIÓN CORREGIDA
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

// Middleware para verificar JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.userType === 'restaurant') {
      // Buscar restaurante en base de datos
      const { rows } = await executeQuery(
        'SELECT id, name, email, slug, is_active FROM restaurants WHERE id = ?',
        [decoded.userId]
      );

      if (rows.length === 0 || !rows[0].is_active) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or inactive account'
        });
      }

      // Agregar información del restaurante al request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        type: 'restaurant',
        name: rows[0].name,
        slug: rows[0].slug,
        isActive: rows[0].is_active
      };

    } else if (decoded.userType === 'registered_user') {
      // Buscar usuario registrado en base de datos
      const { rows } = await executeQuery(
        'SELECT id, name, email, is_active, role FROM registered_users WHERE id = ?',
        [decoded.userId]
      );

      if (rows.length === 0 || !rows[0].is_active) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or inactive user account'
        });
      }

      // Agregar información del usuario al request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        type: 'registered_user',
        name: rows[0].name,
        isActive: rows[0].is_active,
        role: rows[0].role
      };

    } else if (decoded.userType === 'user') {
      // Usuario temporal (sesión de mesa)
      const { rows } = await executeQuery(
        'SELECT id, restaurant_id, table_number, session_id, name, user_type FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid user session'
        });
      }

      // Agregar información del usuario temporal al request
      req.user = {
        id: decoded.userId,
        type: 'user',
        restaurantId: decoded.restaurantId,
        tableNumber: decoded.tableNumber,
        sessionId: decoded.sessionId,
        registeredUserId: decoded.registeredUserId || null,
        name: rows[0].name
      };

    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Middleware para verificar que sea un restaurante
const requireRestaurant = (req, res, next) => {
  if (req.user && req.user.type === 'restaurant') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Restaurant access required'
    });
  }
};

// Middleware para verificar que sea un usuario registrado
const requireRegisteredUser = (req, res, next) => {
  if (req.user && req.user.type === 'registered_user') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Registered user access required'
    });
  }
};

// Middleware opcional de autenticación (para usuarios anónimos)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // Sin token, continuar como usuario anónimo
      req.user = null;
      return next();
    }

    // Si hay token, intentar verificarlo
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.userType === 'restaurant') {
      const { rows } = await executeQuery(
        'SELECT id, name, email, slug, is_active FROM restaurants WHERE id = ?',
        [decoded.userId]
      );

      if (rows.length > 0 && rows[0].is_active) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          type: 'restaurant',
          name: rows[0].name,
          slug: rows[0].slug
        };
      }
    } else if (decoded.userType === 'registered_user') {
      const { rows } = await executeQuery(
        'SELECT id, name, email, is_active, role FROM registered_users WHERE id = ?',
        [decoded.userId]
      );

      if (rows.length > 0 && rows[0].is_active) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          type: 'registered_user',
          name: rows[0].name,
          role: rows[0].role
        };
      }
    } else if (decoded.userType === 'user') {
      // Para usuarios temporales de mesa
      req.user = {
        id: decoded.userId,
        type: 'user',
        tableNumber: decoded.tableNumber,
        restaurantId: decoded.restaurantId,
        sessionId: decoded.sessionId,
        registeredUserId: decoded.registeredUserId || null
      };
    }

    next();
  } catch (error) {
    // Si falla la verificación, continuar como anónimo
    req.user = null;
    next();
  }
};

// Middleware para verificar que sea superadmin
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.type === 'registered_user' && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Superadmin access required'
    });
  }
};

// Middleware para verificar suscripción activa de restaurante
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (req.user && req.user.type === 'restaurant') {
      const { rows } = await executeQuery(
        `SELECT subscription_status, subscription_end_date
         FROM restaurants
         WHERE id = ?`,
        [req.user.id]
      );

      if (rows.length > 0) {
        const { subscription_status, subscription_end_date } = rows[0];

        // Verificar si la suscripción está activa
        if (subscription_status !== 'active') {
          return res.status(403).json({
            success: false,
            message: 'Active subscription required',
            subscriptionStatus: subscription_status
          });
        }

        // Verificar si la suscripción no ha expirado
        if (subscription_end_date && new Date(subscription_end_date) < new Date()) {
          return res.status(403).json({
            success: false,
            message: 'Subscription expired',
            expiredAt: subscription_end_date
          });
        }

        // Agregar información de suscripción al request
        req.user.subscriptionStatus = subscription_status;
        req.user.subscriptionEndDate = subscription_end_date;
      }
    }

    next();
  } catch (error) {
    logger.error('Subscription verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Subscription verification failed'
    });
  }
};

// Middleware para verificar permisos de suscripción por plan
const requireSubscriptionPlan = (requiredPlans) => {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.type === 'restaurant') {
        const { rows } = await executeQuery(
          `SELECT subscription_plan_id, subscription_status
           FROM restaurants
           WHERE id = ?`,
          [req.user.id]
        );

        if (rows.length > 0) {
          const { subscription_plan_id, subscription_status } = rows[0];

          if (subscription_status !== 'active') {
            return res.status(403).json({
              success: false,
              message: 'Active subscription required'
            });
          }

          if (requiredPlans && !requiredPlans.includes(subscription_plan_id)) {
            return res.status(403).json({
              success: false,
              message: 'Insufficient subscription plan',
              requiredPlans,
              currentPlan: subscription_plan_id
            });
          }
        }
      }

      next();
    } catch (error) {
      logger.error('Subscription plan verification error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Subscription plan verification failed'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  requireRestaurant,
  requireRegisteredUser,
  optionalAuth,
  requireSuperAdmin,
  requireActiveSubscription,
  requireSubscriptionPlan
};