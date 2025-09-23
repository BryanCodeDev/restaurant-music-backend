// src/controllers/authController.js - VERSIÓN CORREGIDA
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/database');
const { generateQRCode } = require('../services/qrService');
const { sendWelcomeEmail, sendVerificationEmail } = require('../services/emailService');
const { createSlug } = require('../utils/helpers');
const { logger } = require('../utils/logger');

// Función helper segura para parsear JSON con fallback
const safeJsonParse = (str, fallback) => {
  if (!str || typeof str !== 'string' || str.trim() === '') return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    logger.warn('Invalid JSON in DB field, using fallback:', { field: str, error: e.message });
    return fallback;
  }
};

// Generar JWT token
const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
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

    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    // Verificar si el email ya existe en restaurants
    const { rows: existingRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE email = ?',
      [email]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered as restaurant'
      });
    }

    // Verificar si el email ya existe en registered_users
    const { rows: userRows } = await executeQuery(
      'SELECT id FROM registered_users WHERE email = ?',
      [email]
    );

    if (userRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered as user. Please use user login.'
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Generar ID y slug únicos
    const restaurantId = uuidv4();
    const baseSlug = createSlug(name);
    
    // Verificar que el slug sea único
    let finalSlug = baseSlug;
    let counter = 1;
    
    while (true) {
      const { rows: slugRows } = await executeQuery(
        'SELECT id FROM restaurants WHERE slug = ?',
        [finalSlug]
      );
      
      if (slugRows.length === 0) break;
      
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Crear restaurante (activado automáticamente, sin verificación de email)
    await executeQuery(
      `INSERT INTO restaurants (
        id, name, owner_name, slug, email, password, phone, address, city, country,
        website, description, cuisine_type, timezone, is_active, verified, pending_approval, verification_token
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        country || 'Colombia',
        website || null,
        description || null,
        cuisineType || null,
        'America/Bogota',
        true,
        true, // verified = true (sin verificación requerida)
        true, // pending_approval (revisión manual si se desea)
        null // verification_token no usado
      ]
    );

    // Generar QR code (opcional)
    let qrCodePath = null;
    try {
      if (typeof generateQRCode === 'function') {
        qrCodePath = await generateQRCode(restaurantId, finalSlug);
        if (qrCodePath) {
          await executeQuery(
            'UPDATE restaurants SET logo = ? WHERE id = ?',
            [qrCodePath, restaurantId]
          );
        }
      }
    } catch (qrError) {
      logger.warn('QR code generation failed:', qrError.message);
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
          country: country || 'Colombia',
          website: website || null,
          description: description || null,
          cuisineType: cuisineType || null,
          qrCode: qrCodePath,
          isActive: true,
          verified: true,
          pendingApproval: true
        },
        access_token: token
      }
    });

  } catch (error) {
    logger.error('Restaurant registration error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Login de restaurante
const loginRestaurant = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Buscar restaurante
    const { rows } = await executeQuery(
      `SELECT id, name, owner_name, slug, email, password, phone, city, country,
              website, description, cuisine_type, is_active, verified, last_login_at,
              subscription_plan, created_at
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

    // No requerir verificación de email - login directo

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

    // Construir QR code path
    const qrCodePath = restaurant.logo || `/uploads/qr-codes/${restaurant.slug}-qr.png`;

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
          qrCode: qrCodePath,
          createdAt: restaurant.created_at
        },
        access_token: token
      }
    });

  } catch (error) {
    logger.error('Restaurant login error:', {
      message: error.message,
      stack: error.stack,
      email: req.body?.email
    });
    
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    // Verificar si el email ya existe en users
    const { rows: existingRows } = await executeQuery(
      'SELECT id FROM registered_users WHERE email = ?',
      [email]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered as user'
      });
    }

    // Verificar si el email ya existe en restaurants
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE email = ?',
      [email]
    );

    if (restaurantRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered as restaurant. Please use restaurant login.'
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    // Crear usuario registrado (activado automáticamente, sin verificación de email)
    await executeQuery(
      `INSERT INTO registered_users (
        id, name, email, password, phone, date_of_birth,
        preferred_genres, preferred_languages, is_active, email_verified, verification_token
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        true, // email_verified = true (sin verificación requerida)
        null // verification_token no usado
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
          emailVerified: true
        },
        access_token: token
      }
    });

  } catch (error) {
    logger.error('User registration error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Login de usuario registrado
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Buscar usuario registrado
    const { rows } = await executeQuery(
      `SELECT id, name, email, password, phone, preferred_genres,
              preferred_languages, is_active, is_premium, email_verified,
              theme_preference, privacy_level, role, created_at
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

    // No requerir verificación de email - login directo

    // Actualizar último login
    await executeQuery(
      'UPDATE registered_users SET last_login_at = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?',
      [user.id]
    );

    // Generar token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      userType: 'registered_user'
    };
    if (user.role === 'superadmin') {
      tokenPayload.role = user.role;
    }
    const token = generateToken(tokenPayload);

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
          preferredGenres: safeJsonParse(user.preferred_genres, []),
          preferredLanguages: safeJsonParse(user.preferred_languages, ['es']),
          isPremium: user.is_premium,
          emailVerified: user.email_verified,
          themePreference: user.theme_preference,
          privacyLevel: user.privacy_level,
          role: user.role,
          createdAt: user.created_at
        },
        access_token: token
      }
    });

  } catch (error) {
    logger.error('User login error:', {
      message: error.message,
      stack: error.stack,
      email: req.body?.email
    });
    
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Crear sesión de usuario temporal (mesa)
const createUserSession = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { tableNumber, registeredUserId } = req.body;

    if (!restaurantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant slug is required'
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
    const finalTableNumber = tableNumber || `Mesa #${Math.floor(Math.random() * 20) + 1}`;
    const sessionId = uuidv4();
    const userId = uuidv4();

    // Determinar tipo de usuario y nombre
    let userType = 'guest';
    let userName = null;
    
    if (registeredUserId) {
      const { rows: regUserRows } = await executeQuery(
        'SELECT id, name FROM registered_users WHERE id = ? AND is_active = true',
        [registeredUserId]
      );
      
      if (regUserRows.length > 0) {
        userType = 'registered';
        userName = regUserRows[0].name;
      }
    }

    // Crear usuario temporal
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

    logger.info(`User session created: ${userId} at ${restaurant.name}`);

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
    logger.error('User session creation error:', {
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create session',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// =============================
// PROFILE MANAGEMENT
// =============================

// Obtener perfil del usuario autenticado
const getProfile = async (req, res) => {
  try {
    const { user } = req;

    if (!user || !user.type) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (user.type === 'restaurant') {
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
      const qrCodePath = restaurant.logo || `/uploads/qr-codes/${restaurant.slug}-qr.png`;

      res.json({
        success: true,
        data: {
          restaurant: {
            ...restaurant,
            qrCode: qrCodePath
          }
        }
      });

    } else if (user.type === 'registered_user') {
      const { rows } = await executeQuery(
        `SELECT id, name, email, phone, avatar, bio, date_of_birth,
                preferred_genres, preferred_languages, theme_preference,
                privacy_level, is_premium, email_verified, total_requests,
                favorite_restaurant_id, role, created_at
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

      res.json({
        success: true,
        data: {
          user: {
            ...userData,
            preferredGenres: safeJsonParse(userData.preferred_genres, []),
            preferredLanguages: safeJsonParse(userData.preferred_languages, ['es']),
            role: userData.role
          }
        }
      });

    } else if (user.type === 'user') {
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
    logger.error('Get profile error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Actualizar perfil
const updateProfile = async (req, res) => {
  try {
    const { user } = req;

    if (!user || !user.type) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (user.type === 'restaurant') {
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
        maxRequestsPerUser, 
        queueLimit, 
        autoPlay, 
        allowExplicit 
      } = req.body;

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
             max_requests_per_user = COALESCE(?, max_requests_per_user),
             queue_limit = COALESCE(?, queue_limit),
             auto_play = COALESCE(?, auto_play),
             allow_explicit = COALESCE(?, allow_explicit),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          name, ownerName, phone, address, city, country, website, description,
          cuisineType, maxRequestsPerUser, queueLimit, autoPlay, allowExplicit, 
          user.id
        ]
      );

      logger.info(`Restaurant profile updated: ${user.id}`);

    } else if (user.type === 'registered_user') {
      const { 
        name, 
        phone, 
        bio,
        preferredGenres,
        preferredLanguages,
        themePreference,
        privacyLevel
      } = req.body;

      await executeQuery(
        `UPDATE registered_users 
         SET name = COALESCE(?, name),
             phone = COALESCE(?, phone),
             bio = COALESCE(?, bio),
             preferred_genres = COALESCE(?, preferred_genres),
             preferred_languages = COALESCE(?, preferred_languages),
             theme_preference = COALESCE(?, theme_preference),
             privacy_level = COALESCE(?, privacy_level),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          name, phone, bio,
          preferredGenres ? JSON.stringify(preferredGenres) : null,
          preferredLanguages ? JSON.stringify(preferredLanguages) : null,
          themePreference, privacyLevel,
          user.id
        ]
      );

      logger.info(`User profile updated: ${user.id}`);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    logger.error('Update profile error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
    logger.error('Token verification error:', {
      message: error.message,
      stack: error.stack
    });
    
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
  updateProfile,
  verifyToken
};