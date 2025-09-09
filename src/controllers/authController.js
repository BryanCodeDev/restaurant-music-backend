// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/database');
const { generateQRCode } = require('../services/qrService');
const { logger } = require('../utils/logger');
const { createSlug } = require('../utils/helpers');

// Generar JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Registro de restaurante
const registerRestaurant = async (req, res) => {
  try {
    const { name, email, password, phone, address, city, country } = req.body;

    // Verificar si el email ya existe
    const { rows: existingRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE email = ?',
      [email]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    
    // Generar ID y slug únicos
    const restaurantId = uuidv4();
    const slug = createSlug(name);
    
    // Verificar que el slug sea único
    let finalSlug = slug;
    let counter = 1;
    
    while (true) {
      const { rows: slugRows } = await executeQuery(
        'SELECT id FROM restaurants WHERE slug = ?',
        [finalSlug]
      );
      
      if (slugRows.length === 0) break;
      
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    // Crear restaurante
    await executeQuery(
      `INSERT INTO restaurants (id, name, slug, email, password, phone, address, city, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [restaurantId, name, finalSlug, email, hashedPassword, phone, address, city, country]
    );

    // Generar QR code
    const qrCodePath = await generateQRCode(restaurantId, finalSlug);

    // Generar token
    const token = generateToken({
      userId: restaurantId,
      email,
      userType: 'restaurant'
    });

    logger.info(`New restaurant registered: ${name} (${email})`);

    res.status(201).json({
      success: true,
      message: 'Restaurant registered successfully',
      data: {
        restaurant: {
          id: restaurantId,
          name,
          slug: finalSlug,
          email,
          phone,
          address,
          city,
          country,
          qrCode: qrCodePath
        },
        token
      }
    });

  } catch (error) {
    logger.error('Restaurant registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Login de restaurante
const loginRestaurant = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar restaurante
    const { rows } = await executeQuery(
      'SELECT id, name, slug, email, password, is_active FROM restaurants WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const restaurant = rows[0];

    // Verificar si está activo
    if (!restaurant.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, restaurant.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generar token
    const token = generateToken({
      userId: restaurant.id,
      email: restaurant.email,
      userType: 'restaurant'
    });

    // Obtener QR code path
    const qrCodePath = `/uploads/qr-codes/${restaurant.slug}-qr.png`;

    logger.info(`Restaurant login: ${restaurant.name} (${email})`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          email: restaurant.email,
          qrCode: qrCodePath
        },
        token
      }
    });

  } catch (error) {
    logger.error('Restaurant login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Crear sesión de usuario (mesa)
const createUserSession = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { tableNumber } = req.body;

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
    const finalTableNumber = tableNumber || `Mesa #${Math.floor(Math.random() * 20) + 1}`;
    const sessionId = uuidv4();

    // Crear usuario temporal
    const { rows: userResult } = await executeQuery(
      `INSERT INTO users (id, restaurant_id, table_number, session_id, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        restaurant.id,
        finalTableNumber,
        sessionId,
        req.ip,
        req.get('User-Agent')
      ]
    );

    // Generar token temporal (24 horas)
    const token = generateToken({
      userId: userResult.insertId || sessionId,
      userType: 'user',
      restaurantId: restaurant.id,
      tableNumber: finalTableNumber,
      sessionId
    });

    res.json({
      success: true,
      message: 'User session created',
      data: {
        user: {
          id: userResult.insertId || sessionId,
          tableNumber: finalTableNumber,
          sessionId,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name
        },
        token
      }
    });

  } catch (error) {
    logger.error('User session creation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener perfil del usuario autenticado
const getProfile = async (req, res) => {
  try {
    const { user } = req;

    if (user.type === 'restaurant') {
      // Obtener datos del restaurante
      const { rows } = await executeQuery(
        `SELECT id, name, slug, email, phone, address, city, country, 
                max_requests_per_user, queue_limit, auto_play, allow_explicit,
                subscription_plan, created_at, updated_at
         FROM restaurants WHERE id = ?`,
        [user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found'
        });
      }

      const restaurant = rows[0];
      const qrCodePath = `/uploads/qr-codes/${restaurant.slug}-qr.png`;

      // Obtener estadísticas
      const { rows: statsRows } = await executeQuery(
        `SELECT 
          (SELECT COUNT(*) FROM songs WHERE restaurant_id = ?) as total_songs,
          (SELECT COUNT(*) FROM requests WHERE restaurant_id = ? AND status = 'pending') as pending_requests,
          (SELECT COUNT(*) FROM users WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()) as today_users
        `,
        [user.id, user.id, user.id]
      );

      res.json({
        success: true,
        data: {
          restaurant: {
            ...restaurant,
            qrCode: qrCodePath,
            stats: statsRows[0] || {}
          }
        }
      });

    } else if (user.type === 'user') {
      // Obtener datos del usuario temporal
      const { rows } = await executeQuery(
        `SELECT u.*, r.name as restaurant_name 
         FROM users u 
         JOIN restaurants r ON u.restaurant_id = r.id 
         WHERE u.id = ?`,
        [user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User session not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: rows[0]
        }
      });
    }

  } catch (error) {
    logger.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Actualizar perfil de restaurante
const updateRestaurantProfile = async (req, res) => {
  try {
    const { user } = req;
    const { name, phone, address, city, country, max_requests_per_user, queue_limit, auto_play, allow_explicit } = req.body;

    if (user.type !== 'restaurant') {
      return res.status(403).json({
        success: false,
        message: 'Restaurant access required'
      });
    }

    // Actualizar restaurante
    await executeQuery(
      `UPDATE restaurants 
       SET name = ?, phone = ?, address = ?, city = ?, country = ?,
           max_requests_per_user = ?, queue_limit = ?, auto_play = ?, allow_explicit = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, phone, address, city, country, max_requests_per_user, queue_limit, auto_play, allow_explicit, user.id]
    );

    logger.info(`Restaurant profile updated: ${user.id}`);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    logger.error('Update restaurant profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verificar token
const verifyToken = async (req, res) => {
  try {
    const { user } = req; // Viene del middleware authenticateToken

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: {
          id: user.id,
          type: user.type,
          email: user.email || null,
          name: user.name || user.tableNumber || null
        }
      }
    });
  } catch (error) {
    logger.error('Token verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};

module.exports = {
  registerRestaurant,
  loginRestaurant,
  createUserSession,
  getProfile,
  updateRestaurantProfile,
  verifyToken
};