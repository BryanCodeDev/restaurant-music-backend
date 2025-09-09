// src/middleware/auth.js
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
    
    // Buscar usuario en base de datos (para restaurantes)
    const { rows } = await executeQuery(
      'SELECT id, name, email, is_active FROM restaurants WHERE id = ?',
      [decoded.userId]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive account'
      });
    }

    // Agregar información del usuario al request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      type: decoded.userType || 'restaurant',
      ...rows[0]
    };

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
        'SELECT id, name, email, is_active FROM restaurants WHERE id = ?',
        [decoded.userId]
      );

      if (rows.length > 0 && rows[0].is_active) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          type: 'restaurant',
          ...rows[0]
        };
      }
    } else if (decoded.userType === 'user') {
      // Para usuarios temporales de mesa
      req.user = {
        id: decoded.userId,
        type: 'user',
        tableNumber: decoded.tableNumber,
        restaurantId: decoded.restaurantId
      };
    }

    next();
  } catch (error) {
    // Si falla la verificación, continuar como anónimo
    req.user = null;
    next();
  }
};

// Middleware para generar sesión temporal de usuario (mesa)
const createGuestSession = async (req, res, next) => {
  try {
    const { restaurantSlug, tableNumber } = req.params;
    
    if (!restaurantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant identifier required'
      });
    }

    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id, name, is_active FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );

    if (restaurantRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or inactive'
      });
    }

    const restaurant = restaurantRows[0];

    // Crear o encontrar sesión de usuario
    const sessionId = `${restaurantSlug}-${tableNumber || 'anonymous'}-${Date.now()}`;
    
    // Crear usuario temporal
    const { rows: userRows } = await executeQuery(
      `INSERT INTO users (restaurant_id, table_number, session_id, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [
        restaurant.id,
        tableNumber || `Mesa #${Math.floor(Math.random() * 20) + 1}`,
        sessionId,
        req.ip,
        req.get('User-Agent')
      ]
    );

    // Generar token temporal
    const tempToken = jwt.sign(
      {
        userId: userRows.insertId,
        userType: 'user',
        restaurantId: restaurant.id,
        tableNumber: tableNumber || 'anonymous',
        sessionId
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    req.tempUser = {
      id: userRows.insertId,
      restaurantId: restaurant.id,
      tableNumber: tableNumber || 'anonymous',
      sessionId,
      token: tempToken
    };

    req.restaurant = restaurant;
    next();
  } catch (error) {
    logger.error('Guest session creation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create session'
    });
  }
};

module.exports = {
  authenticateToken,
  requireRestaurant,
  optionalAuth,
  createGuestSession
};