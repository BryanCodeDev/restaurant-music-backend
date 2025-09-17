// src/controllers/authController.js - COMPLETE VERSION
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/database');
const { generateQRCode } = require('../services/qrService');
const { sendWelcomeEmail } = require('../services/emailService');
const { logger } = require('../utils/logger');
const { createSlug } = require('../utils/helpers');

// Generar JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// =============================
// RESTAURANT AUTH
// =============================

// Registro de restaurante
const registerRestaurant = async (req, res) => {
  try {
    const { 
      name, 
      ownerName, 
      email, 
      password, 
      phone, 
      address, 
      city, 
      country,
      website,
      cuisineType,
      description
    } = req.body;

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

    // Crear restaurante con todos los nuevos campos
    await executeQuery(
      `INSERT INTO restaurants (
        id, name, owner_name, slug, email, password, phone, address, city, country,
        website, description, cuisine_type, timezone, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        restaurantId, 
        name, 
        ownerName || null, 
        finalSlug, 
        email, 
        hashedPassword, 
        phone || null, 
        address || null, 
        city || null, 
        country || null,
        website || null,
        description || null,
        cuisineType || null,
        'America/Bogota',
        true
      ]
    );

    // Generar QR code
    let qrCodePath = null;
    try {
      qrCodePath = await generateQRCode(restaurantId, finalSlug);
      // Actualizar el path del QR en la base de datos
      await executeQuery(
        'UPDATE restaurants SET logo = ? WHERE id = ?',
        [qrCodePath, restaurantId]
      );
    } catch (qrError) {
      logger.warn('QR code generation failed:', qrError.message);
    }

    // Enviar email de bienvenida (opcional)
    try {
      await sendWelcomeEmail(email, name, qrCodePath);
    } catch (emailError) {
      logger.warn('Welcome email failed to send:', emailError.message);
    }

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
          ownerName: ownerName || null,
          slug: finalSlug,
          email,
          phone: phone || null,
          address: address || null,
          city: city || null,
          country: country || null,
          website: website || null,
          description: description || null,
          cuisineType: cuisineType || null,
          qrCode: qrCodePath,
          isActive: true,
          verified: false
        },
        access_token: token
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

    // Buscar restaurante con todos los campos actualizados
    const { rows } = await executeQuery(
      `SELECT id, name, owner_name, slug, email, password, phone, city, country,
              website, description, cuisine_type, is_active, verified, last_login_at,
              subscription_plan
       FROM restaurants WHERE email = ?`,
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
        message: 'Account is inactive. Please contact support.'
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

    // Actualizar último login
    await executeQuery(
      'UPDATE restaurants SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [restaurant.id]
    );

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
          ownerName: restaurant.owner_name,
          slug: restaurant.slug,
          email: restaurant.email,
          phone: restaurant.phone,
          city: restaurant.city,
          country: restaurant.country,
          website: restaurant.website,
          description: restaurant.description,
          cuisineType: restaurant.cuisine_type,
          subscriptionPlan: restaurant.subscription_plan,
          verified: restaurant.verified,
          qrCode: qrCodePath
        },
        access_token: token
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

// =============================
// USER AUTH
// =============================

// Registro de usuario registrado
const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      dateOfBirth,
      preferredGenres,
      preferredLanguages
    } = req.body;

    // Verificar si el email ya existe
    const { rows: existingRows } = await executeQuery(
      'SELECT id FROM registered_users WHERE email = ?',
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
    const userId = uuidv4();

    // Crear usuario registrado
    await executeQuery(
      `INSERT INTO registered_users (
        id, name, email, password, phone, date_of_birth, 
        preferred_genres, preferred_languages, is_active, email_verified
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        email,
        hashedPassword,
        phone || null,
        dateOfBirth || null,
        JSON.stringify(preferredGenres || []),
        JSON.stringify(preferredLanguages || ['es']),
        true,
        false
      ]
    );

    // Generar token
    const token = generateToken({
      userId,
      email,
      userType: 'registered_user'
    });

    logger.info(`New registered user: ${name} (${email})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: userId,
          name,
          email,
          phone: phone || null,
          dateOfBirth: dateOfBirth || null,
          preferredGenres: preferredGenres || [],
          preferredLanguages: preferredLanguages || ['es'],
          isPremium: false,
          emailVerified: false
        },
        access_token: token
      }
    });

  } catch (error) {
    logger.error('User registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Login de usuario registrado
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario registrado
    const { rows } = await executeQuery(
      `SELECT id, name, email, password, phone, preferred_genres, 
              preferred_languages, is_active, is_premium, email_verified,
              theme_preference, privacy_level
       FROM registered_users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Actualizar último login
    await executeQuery(
      'UPDATE registered_users SET last_login_at = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?',
      [user.id]
    );

    // Generar token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      userType: 'registered_user'
    });

    logger.info(`Registered user login: ${user.name} (${email})`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          preferredGenres: JSON.parse(user.preferred_genres || '[]'),
          preferredLanguages: JSON.parse(user.preferred_languages || '["es"]'),
          isPremium: user.is_premium,
          emailVerified: user.email_verified,
          themePreference: user.theme_preference,
          privacyLevel: user.privacy_level
        },
        access_token: token
      }
    });

  } catch (error) {
    logger.error('User login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Crear sesión de usuario temporal (mesa) - ACTUALIZADO
const createUserSession = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { tableNumber, registeredUserId } = req.body;

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
    const userId = uuidv4();

    // Determinar tipo de usuario y nombre
    let userType = 'guest';
    let userName = null;
    
    if (registeredUserId) {
      // Verificar que el usuario registrado existe
      const { rows: regUserRows } = await executeQuery(
        'SELECT id, name FROM registered_users WHERE id = ? AND is_active = true',
        [registeredUserId]
      );
      
      if (regUserRows.length > 0) {
        userType = 'registered';
        userName = regUserRows[0].name;
      }
    }

    // Crear usuario temporal con referencia al usuario registrado si aplica
    await executeQuery(
      `INSERT INTO users (
        id, registered_user_id, user_type, restaurant_id, table_number, 
        session_id, name, ip_address, user_agent
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        registeredUserId || null,
        userType,
        restaurant.id,
        finalTableNumber,
        sessionId,
        userName,
        req.ip,
        req.get('User-Agent')
      ]
    );

    // Generar token temporal
    const token = generateToken({
      userId: userId,
      userType: 'user',
      restaurantId: restaurant.id,
      tableNumber: finalTableNumber,
      sessionId,
      registeredUserId: registeredUserId || null
    });

    res.json({
      success: true,
      message: 'User session created',
      data: {
        user: {
          id: userId,
          registeredUserId: registeredUserId || null,
          userType,
          tableNumber: finalTableNumber,
          sessionId,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          name: userName
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

// =============================
// PROFILE MANAGEMENT
// =============================

// Obtener perfil del usuario autenticado - ACTUALIZADO
const getProfile = async (req, res) => {
  try {
    const { user } = req;

    if (user.type === 'restaurant') {
      // Obtener datos completos del restaurante
      const { rows } = await executeQuery(
        `SELECT id, name, owner_name, slug, email, phone, address, city, country, 
                website, description, cuisine_type, price_range, rating, total_reviews,
                verified, timezone, max_requests_per_user, queue_limit, auto_play, 
                allow_explicit, subscription_plan, created_at, updated_at
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

      // Obtener estadísticas actualizadas
      const { rows: statsRows } = await executeQuery(
        `SELECT 
          (SELECT COUNT(*) FROM songs WHERE restaurant_id = ? AND is_active = true) as total_songs,
          (SELECT COUNT(*) FROM requests WHERE restaurant_id = ? AND status = 'pending') as pending_requests,
          (SELECT COUNT(*) FROM users WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()) as today_users,
          (SELECT COUNT(*) FROM restaurant_reviews WHERE restaurant_id = ?) as total_reviews
        `,
        [user.id, user.id, user.id, user.id]
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

    } else if (user.type === 'registered_user') {
      // Obtener datos del usuario registrado
      const { rows } = await executeQuery(
        `SELECT id, name, email, phone, avatar, bio, date_of_birth,
                preferred_genres, preferred_languages, theme_preference, 
                privacy_level, is_premium, email_verified, total_requests,
                favorite_restaurant_id, created_at
         FROM registered_users WHERE id = ?`,
        [user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userData = rows[0];

      // Obtener estadísticas del usuario
      const { rows: userStatsRows } = await executeQuery(
        `SELECT 
          COUNT(DISTINCT f.id) as total_favorites,
          COUNT(DISTINCT p.id) as total_playlists,
          COUNT(DISTINCT lh.id) as total_listening_history
         FROM registered_users ru
         LEFT JOIN favorites f ON ru.id = f.registered_user_id
         LEFT JOIN playlists p ON ru.id = p.registered_user_id  
         LEFT JOIN listening_history lh ON ru.id = lh.registered_user_id
         WHERE ru.id = ?`,
        [user.id]
      );

      res.json({
        success: true,
        data: {
          user: {
            ...userData,
            preferredGenres: JSON.parse(userData.preferred_genres || '[]'),
            preferredLanguages: JSON.parse(userData.preferred_languages || '["es"]'),
            stats: userStatsRows[0] || {}
          }
        }
      });

    } else if (user.type === 'user') {
      // Usuario temporal
      const { rows } = await executeQuery(
        `SELECT u.*, r.name as restaurant_name,
                ru.name as registered_user_name, ru.email as registered_user_email
         FROM users u 
         JOIN restaurants r ON u.restaurant_id = r.id 
         LEFT JOIN registered_users ru ON u.registered_user_id = ru.id
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

// Actualizar perfil de restaurante - ACTUALIZADO
const updateRestaurantProfile = async (req, res) => {
  try {
    const { user } = req;
    const { 
      name, 
      ownerName, 
      phone, 
      address, 
      city, 
      country, 
      website,
      description,
      cuisineType,
      priceRange,
      timezone,
      maxRequestsPerUser, 
      queueLimit, 
      autoPlay, 
      allowExplicit 
    } = req.body;

    if (user.type !== 'restaurant') {
      return res.status(403).json({
        success: false,
        message: 'Restaurant access required'
      });
    }

    // Actualizar restaurante con campos nuevos
    await executeQuery(
      `UPDATE restaurants 
       SET name = COALESCE(?, name),
           owner_name = COALESCE(?, owner_name),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           city = COALESCE(?, city),
           country = COALESCE(?, country),
           website = COALESCE(?, website),
           description = COALESCE(?, description),
           cuisine_type = COALESCE(?, cuisine_type),
           price_range = COALESCE(?, price_range),
           timezone = COALESCE(?, timezone),
           max_requests_per_user = COALESCE(?, max_requests_per_user),
           queue_limit = COALESCE(?, queue_limit),
           auto_play = COALESCE(?, auto_play),
           allow_explicit = COALESCE(?, allow_explicit),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name, ownerName, phone, address, city, country, website, description,
        cuisineType, priceRange, timezone, maxRequestsPerUser, queueLimit, 
        autoPlay, allowExplicit, user.id
      ]
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
    const { user } = req;

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
  registerUser,
  loginUser,
  createUserSession,
  getProfile,
  updateRestaurantProfile,
  verifyToken
};