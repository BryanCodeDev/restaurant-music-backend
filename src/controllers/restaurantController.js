// src/controllers/restaurantController.js
const { executeQuery } = require('../config/database');
const { regenerateQRCode } = require('../services/qrService');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

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
      `SELECT name, phone, address, city, country, timezone,
              max_requests_per_user, queue_limit, auto_play, allow_explicit,
              subscription_plan
       FROM restaurants 
       WHERE id = ?`,
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
      allow_explicit
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
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name, phone, address, city, country, timezone,
        max_requests_per_user, queue_limit, auto_play, allow_explicit,
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

module.exports = {
  getRestaurantBySlug,
  getRestaurantStats,
  getRestaurantSettings,
  updateRestaurantSettings,
  regenerateQR
};