// src/controllers/restaurantController.js - UPDATED WITH getPublicRestaurants
const { executeQuery } = require('../config/database');
const { regenerateQRCode } = require('../services/qrService');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

// Endpoint para obtener planes de precios
const getPricing = (req, res) => {
  const pricingPlans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfecto para comenzar',
      price: 80000,
      currency: 'COP',
      billingCycle: 'Mensual',
      features: [
        'Hasta 50 mesas',
        'Cola musical básica',
        '1,000 peticiones/mes',
        'Soporte por email',
        'Estadísticas básicas'
      ],
      recommended: false
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Ideal para restaurantes establecidos',
      price: 120000,
      currency: 'COP',
      billingCycle: 'Mensual',
      features: [
        'Mesas ilimitadas',
        'Cola musical avanzada',
        '10,000 peticiones/mes',
        'Soporte prioritario 24/7',
        'Analytics completos',
        'Personalización completa',
        'Integración con Spotify',
        'Control de contenido'
      ],
      recommended: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Para cadenas y grandes establecimientos',
      price: 300000,
      currency: 'COP',
      billingCycle: 'Mensual',
      features: [
        'Todo lo de Professional',
        'Múltiples ubicaciones',
        'Peticiones ilimitadas',
        'Soporte dedicado',
        'API completa',
        'White-label',
        'Integración personalizada',
        'SLA garantizado'
      ],
      recommended: false
    }
  ];

  res.json(formatSuccessResponse('Planes de precios', { plans: pricingPlans }));
};

// Obtener restaurante por slug
const getRestaurantBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const { rows } = await executeQuery(
      `SELECT id, name, slug, phone, address, city, country,
              max_requests_per_user, queue_limit, auto_play, allow_explicit,
              is_active, created_at
       FROM restaurants
       WHERE slug = ? AND is_active = true`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }

    const restaurant = rows[0];

    // Obtener estadísticas básicas
    const { rows: statsRows } = await executeQuery(
      `SELECT 
        (SELECT COUNT(*) FROM songs WHERE restaurant_id = ? AND is_active = true) as total_songs,
        (SELECT COUNT(*) FROM requests WHERE restaurant_id = ? AND status = 'pending') as pending_requests,
        (SELECT COUNT(*) FROM users WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()) as active_users_today
      `,
      [restaurant.id, restaurant.id, restaurant.id]
    );

    res.json(formatSuccessResponse('Restaurant found', {
      restaurant: {
        ...restaurant,
        qrCode: `/uploads/qr-codes/${restaurant.slug}-qr.png`,
        stats: statsRows[0] || {}
      }
    }));

  } catch (error) {
    logger.error('Get restaurant error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get restaurant', error.message)
    );
  }
};

// Obtener estadísticas del restaurante
const getRestaurantStats = async (req, res) => {
  try {
    const { slug } = req.params;
    const { period = '24h' } = req.query;

    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE slug = ? AND is_active = true',
      [slug]
    );

    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }

    const restaurant = restaurantRows[0];

    // Determinar filtro de tiempo
    let timeFilter = '';
    switch (period) {
      case '1h':
        timeFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
        break;
      case '24h':
        timeFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
        break;
      case '7d':
        timeFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case '30d':
        timeFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
    }

    // Obtener estadísticas generales
    const { rows: generalStats } = await executeQuery(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'playing' THEN 1 END) as playing_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_requests,
        COUNT(DISTINCT user_id) as unique_users
       FROM requests 
       WHERE restaurant_id = ? ${timeFilter}`,
      [restaurant.id]
    );

    // Obtener canciones más populares
    const { rows: topSongs } = await executeQuery(
      `SELECT s.id, s.title, s.artist, s.image, COUNT(r.id) as request_count
       FROM requests r
       JOIN songs s ON r.song_id = s.id
       WHERE r.restaurant_id = ? ${timeFilter}
       GROUP BY s.id, s.title, s.artist, s.image
       ORDER BY request_count DESC
       LIMIT 10`,
      [restaurant.id]
    );

    // Obtener géneros más populares
    const { rows: topGenres } = await executeQuery(
      `SELECT s.genre, COUNT(r.id) as request_count
       FROM requests r
       JOIN songs s ON r.song_id = s.id
       WHERE r.restaurant_id = ? ${timeFilter}
       GROUP BY s.genre
       ORDER BY request_count DESC
       LIMIT 5`,
      [restaurant.id]
    );

    // Obtener actividad por horas
    const { rows: hourlyActivity } = await executeQuery(
      `SELECT HOUR(created_at) as hour, COUNT(*) as requests
       FROM requests
       WHERE restaurant_id = ? ${timeFilter}
       GROUP BY HOUR(created_at)
       ORDER BY hour`,
      [restaurant.id]
    );

    res.json(formatSuccessResponse('Statistics retrieved', {
      period,
      stats: {
        ...generalStats[0],
        completionRate: generalStats[0].total_requests > 0 
          ? ((generalStats[0].completed_requests / generalStats[0].total_requests) * 100).toFixed(2)
          : 0,
        avgWaitTime: generalStats[0].pending_requests > 0 
          ? (generalStats[0].pending_requests * 3.5).toFixed(1)
          : 0
      },
      topSongs,
      topGenres,
      hourlyActivity
    }));

  } catch (error) {
    logger.error('Get restaurant stats error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get statistics', error.message)
    );
  }
};

// Obtener configuración del restaurante
const getRestaurantSettings = async (req, res) => {
  try {
    const { user } = req;
    
    if (user.type !== 'restaurant') {
      return res.status(403).json(
        formatErrorResponse('Restaurant access required')
      );
    }

    const { rows } = await executeQuery(
      `SELECT r.name, r.phone, r.address, r.city, r.country, r.timezone,
              r.max_requests_per_user, r.queue_limit, r.auto_play, r.allow_explicit,
              r.subscription_plan_id, r.subscription_status, sp.name as subscription_plan_name
       FROM restaurants r
       LEFT JOIN subscription_plans sp ON r.subscription_plan_id = sp.id
       WHERE r.id = ?`,
      [user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }

    res.json(formatSuccessResponse('Settings retrieved', {
      settings: rows[0]
    }));

  } catch (error) {
    logger.error('Get restaurant settings error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get settings', error.message)
    );
  }
};

// Actualizar configuración del restaurante
const updateRestaurantSettings = async (req, res) => {
  try {
    const { user } = req;
    const {
      name,
      phone,
      address,
      city,
      country,
      timezone,
      max_requests_per_user,
      queue_limit,
      auto_play,
      allow_explicit,
      subscriptionPlan
    } = req.body;

    if (user.type !== 'restaurant') {
      return res.status(403).json(
        formatErrorResponse('Restaurant access required')
      );
    }

    // Validar límites
    if (max_requests_per_user && (max_requests_per_user < 1 || max_requests_per_user > 10)) {
      return res.status(400).json(
        formatErrorResponse('Max requests per user must be between 1 and 10')
      );
    }

    if (queue_limit && (queue_limit < 10 || queue_limit > 200)) {
      return res.status(400).json(
        formatErrorResponse('Queue limit must be between 10 and 200')
      );
    }

    if (subscriptionPlan && !['free', 'premium', 'enterprise'].includes(subscriptionPlan)) {
      return res.status(400).json(
        formatErrorResponse('subscriptionPlan debe ser free, premium o enterprise')
      );
    }

    // Actualizar configuración
    await executeQuery(
      `UPDATE restaurants
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           city = COALESCE(?, city),
           country = COALESCE(?, country),
           timezone = COALESCE(?, timezone),
           max_requests_per_user = COALESCE(?, max_requests_per_user),
           queue_limit = COALESCE(?, queue_limit),
           auto_play = COALESCE(?, auto_play),
           allow_explicit = COALESCE(?, allow_explicit),
           subscription_plan_id = COALESCE(?, subscription_plan_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name, phone, address, city, country, timezone,
        max_requests_per_user, queue_limit, auto_play, allow_explicit, subscriptionPlan,
        user.id
      ]
    );

    logger.info(`Restaurant settings updated: ${user.id}`);

    res.json(formatSuccessResponse('Settings updated successfully'));

  } catch (error) {
    logger.error('Update restaurant settings error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to update settings', error.message)
    );
  }
};

// MISSING FUNCTION - Obtener todos los restaurantes públicos (para el selector)
const getPublicRestaurants = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      isActive, 
      city
    } = req.query;

    logger.info('Getting public restaurants:', { page, limit, search, isActive, city });

    // Construir condiciones de búsqueda
    let whereConditions = ['1=1']; // Condición base
    let queryParams = [];
    
    // Filtro por búsqueda de texto
    if (search && search.trim()) {
      whereConditions.push('(name LIKE ? OR address LIKE ? OR city LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Filtro por estado activo (por defecto solo mostrar activos)
    if (isActive !== undefined) {
      whereConditions.push('r.is_active = ?');
      queryParams.push(isActive === 'true' ? 1 : 0);
    } else {
      // Por defecto, solo mostrar restaurantes activos
      whereConditions.push('r.is_active = true');
    }

    // Filtro por ciudad
    if (city && city.trim()) {
      whereConditions.push('city LIKE ?');
      queryParams.push(`%${city.trim()}%`);
    }

    // Construir query principal
    const whereClause = whereConditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Consultar restaurantes con información adicional
    const { rows: restaurants } = await executeQuery(
      `SELECT
        r.id, r.name, r.slug, r.email, r.phone, r.address, r.city, r.country,
        r.subscription_plan_id, r.subscription_status, r.is_active, r.created_at, r.updated_at,
        sp.name as subscription_plan_name
      FROM restaurants r
      LEFT JOIN subscription_plans sp ON r.subscription_plan_id = sp.id
      WHERE ${whereClause}
      ORDER BY r.is_active DESC, r.name ASC
      LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    // Obtener el conteo total
    const { rows: countRows } = await executeQuery(
      `SELECT COUNT(*) as total FROM restaurants r WHERE ${whereClause}`,
      queryParams
    );

    const totalCount = countRows[0]?.total || 0;

    logger.info(`Found ${totalCount} restaurants, returning ${restaurants.length}`);

    // Enriquecer datos de cada restaurante
    const enrichedRestaurants = await Promise.all(
      restaurants.map(async (restaurant) => {
        try {
          // Obtener estadísticas adicionales del restaurante
          const { rows: statsRows } = await executeQuery(
            `SELECT 
              (SELECT COUNT(*) FROM songs WHERE restaurant_id = ? AND is_active = true) as total_songs,
              (SELECT COUNT(*) FROM requests WHERE restaurant_id = ? AND status = 'pending') as queue_length,
              (SELECT COUNT(DISTINCT user_id) FROM requests WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()) as active_customers
            `,
            [restaurant.id, restaurant.id, restaurant.id]
          );

          const stats = statsRows[0] || {};

          // Obtener canción actual (la que está sonando o la más reciente completada)
          const { rows: currentSongRows } = await executeQuery(
            `SELECT s.title, s.artist, r.status, r.created_at
             FROM requests r
             JOIN songs s ON r.song_id = s.id
             WHERE r.restaurant_id = ? AND r.status IN ('playing', 'completed')
             ORDER BY 
               CASE WHEN r.status = 'playing' THEN 1 ELSE 2 END,
               r.updated_at DESC
             LIMIT 1`,
            [restaurant.id]
          );

          const currentSong = currentSongRows[0];

          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            email: restaurant.email,
            phone: restaurant.phone,
            address: restaurant.address,
            city: restaurant.city,
            country: restaurant.country,
            subscriptionPlan: restaurant.subscription_plan_name || 'starter',
            isActive: restaurant.is_active,
            
            // Datos enriquecidos
            totalSongs: stats.total_songs || 0,
            queueLength: stats.queue_length || 0,
            activeCustomers: stats.active_customers || 0,
            
            // Canción actual
            currentSong: currentSong ? `${currentSong.title} - ${currentSong.artist}` : null,
            currentArtist: currentSong?.artist || null,
            
            // Datos por defecto para UI
            rating: 4.5, // Por ahora fijo, después puedes implementar sistema de ratings
            reviewCount: Math.floor(Math.random() * 200) + 50, // Temporal
            coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop&crop=center',
            logo: null,
            genres: ['Música Variada'], // Por ahora fijo, después basado en canciones
            priceRange: '$',
            musicStyle: 'Variado',
            hours: restaurant.is_active ? 'Abierto ahora' : 'Cerrado',
            capacity: 50, // Por ahora fijo
            ambiance: 'Musical', // Por ahora fijo
            
            // Metadatos
            createdAt: restaurant.created_at,
            updatedAt: restaurant.updated_at
          };
        } catch (err) {
          logger.warn(`Error enriching restaurant ${restaurant.id}:`, err);
          // Retornar datos básicos si hay error
          return {
            ...restaurant,
            subscriptionPlan: restaurant.subscription_plan_name || 'starter',
            totalSongs: 0,
            queueLength: 0,
            activeCustomers: 0,
            currentSong: null,
            rating: 4.5,
            reviewCount: 0,
            coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop&crop=center',
            genres: ['Música Variada'],
            hours: restaurant.is_active ? 'Abierto ahora' : 'Cerrado'
          };
        }
      })
    );

    // Calcular metadatos de paginación
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPreviousPage = parseInt(page) > 1;

    res.status(200).json(formatSuccessResponse(`Found ${totalCount} restaurants`, {
      restaurants: enrichedRestaurants,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit: parseInt(limit)
      }
    }));

  } catch (error) {
    logger.error('Error fetching public restaurants:', error);
    res.status(500).json(
      formatErrorResponse('Error al obtener restaurantes', error.message)
    );
  }
};

// Regenerar código QR
const regenerateQR = async (req, res) => {
  try {
    const { user } = req;
    const { slug } = req.params;

    if (user.type !== 'restaurant') {
      return res.status(403).json(
        formatErrorResponse('Restaurant access required')
      );
    }

    // Verificar que el slug pertenece al usuario
    const { rows } = await executeQuery(
      'SELECT id, slug FROM restaurants WHERE id = ? AND slug = ?',
      [user.id, slug]
    );

    if (rows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found or access denied')
      );
    }

    // Regenerar QR code
    const qrCodePath = await regenerateQRCode(user.id, slug);

    logger.info(`QR code regenerated for restaurant: ${slug}`);

    res.json(formatSuccessResponse('QR code regenerated successfully', {
      qrCode: qrCodePath
    }));

  } catch (error) {
    logger.error('Regenerate QR error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to regenerate QR code', error.message)
    );
  }
};

const Restaurant = require('../models/Restaurant');

// Crear nuevo restaurante
const createRestaurant = async (req, res) => {
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
      subscriptionPlan = 'free'
    } = req.body;

    // Validación de subscriptionPlan
    if (!['free', 'premium', 'enterprise'].includes(subscriptionPlan)) {
      return res.status(400).json(
        formatErrorResponse('subscriptionPlan debe ser free, premium o enterprise')
      );
    }

    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json(
        formatErrorResponse('Name, email and password are required')
      );
    }

    // Verificar si email ya existe
    const existing = await Restaurant.findByEmail(email);
    if (existing) {
      return res.status(400).json(
        formatErrorResponse('Email already registered')
      );
    }

    const restaurantData = {
      name,
      ownerName,
      email,
      password, // Asume hashing en middleware o aquí
      phone,
      address,
      city,
      country,
      subscriptionPlan
    };

    const newRestaurant = await Restaurant.create(restaurantData);

    // Si planType es 'pro', opcional: redirigir a Spotify login
    if (planType === 'pro') {
      logger.info(`New pro restaurant created: ${newRestaurant.id}. Redirect to Spotify setup.`);
    }

    res.status(201).json(formatSuccessResponse('Restaurant created successfully', newRestaurant.toJSON()));
  } catch (error) {
    logger.error('Create restaurant error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to create restaurant', error.message)
    );
  }
};

module.exports = {
  getRestaurantBySlug,
  getRestaurantStats,
  getRestaurantSettings,
  updateRestaurantSettings,
  getPublicRestaurants,  // NOW EXPORTED
  regenerateQR,
  createRestaurant,
  getPricing
};