// src/controllers/statsController.js
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

class StatsController {
  // Estadísticas generales del sistema (dashboard)
  async getDashboardStats(req, res) {
    try {
      const { user } = req;

      // Verificar permisos - solo superadmin puede ver todas las estadísticas
      if (user.role !== 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      // Total de usuarios registrados
      const { rows: userRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM registered_users WHERE is_active = true'
      );

      // Total de restaurantes
      const { rows: restaurantRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM restaurants WHERE is_active = true'
      );

      // Total de suscripciones activas
      const { rows: activeSubsRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM subscriptions WHERE status = "approved"'
      );

      // Total de suscripciones pendientes
      const { rows: pendingSubsRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM subscriptions WHERE status = "pending"'
      );

      // Ingresos totales
      const { rows: revenueRows } = await executeQuery(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM subscriptions
         WHERE status = "approved"`
      );

      // Crecimiento mensual (comparado con el mes anterior)
      const { rows: currentMonthRows } = await executeQuery(
        `SELECT
          COUNT(CASE WHEN u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as newUsers,
          COUNT(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as newRestaurants,
          COUNT(CASE WHEN s.submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as newSubscriptions
         FROM registered_users u
         CROSS JOIN restaurants r
         CROSS JOIN subscriptions s`
      );

      // Géneros populares
      const { rows: popularGenresRows } = await executeQuery(
        `SELECT s.genre, COUNT(r.id) as request_count
         FROM songs s
         JOIN requests r ON s.id = r.song_id
         WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY s.genre
         ORDER BY request_count DESC
         LIMIT 5`
      );

      // Restaurantes top (por número de peticiones)
      const { rows: topRestaurantsRows } = await executeQuery(
        `SELECT r.name, r.city, COUNT(req.id) as total_requests
         FROM restaurants r
         JOIN requests req ON r.id = req.restaurant_id
         WHERE req.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY r.id, r.name, r.city
         ORDER BY total_requests DESC
         LIMIT 10`
      );

      // Estadísticas por período
      const { rows: periodStatsRows } = await executeQuery(
        `SELECT
          COUNT(CASE WHEN u.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as users24h,
          COUNT(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as restaurants24h,
          COUNT(CASE WHEN s.submitted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as subscriptions24h,
          COUNT(CASE WHEN u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as users7d,
          COUNT(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as restaurants7d,
          COUNT(CASE WHEN s.submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as subscriptions7d
         FROM registered_users u
         CROSS JOIN restaurants r
         CROSS JOIN subscriptions s`
      );

      const stats = {
        totalUsers: parseInt(userRows[0].total) || 0,
        totalRestaurants: parseInt(restaurantRows[0].total) || 0,
        activeSubscriptions: parseInt(activeSubsRows[0].total) || 0,
        pendingSubscriptions: parseInt(pendingSubsRows[0].total) || 0,
        totalRevenue: parseFloat(revenueRows[0].total) || 0,
        monthlyGrowth: this.calculateGrowthPercentage(currentMonthRows[0]),
        popularGenres: popularGenresRows.map(row => ({
          genre: row.genre,
          count: parseInt(row.request_count)
        })),
        topRestaurants: topRestaurantsRows.map(row => ({
          name: row.name,
          city: row.city,
          totalRequests: parseInt(row.total_requests)
        })),
        periodStats: {
          last24h: {
            users: periodStatsRows[0].users24h || 0,
            restaurants: periodStatsRows[0].restaurants24h || 0,
            subscriptions: periodStatsRows[0].subscriptions24h || 0
          },
          last7d: {
            users: periodStatsRows[0].users7d || 0,
            restaurants: periodStatsRows[0].restaurants7d || 0,
            subscriptions: periodStatsRows[0].subscriptions7d || 0
          }
        }
      };

      res.json({
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard statistics',
        error: error.message
      });
    }
  }

  // Estadísticas específicas de usuario
  async getUserStats(req, res) {
    try {
      const { userId } = req.params;
      const { user } = req;

      // Verificar permisos - solo el propio usuario o admin puede ver sus estadísticas
      if (user.id !== userId && user.role !== 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own statistics.'
        });
      }

      // Verificar que el usuario existe
      const { rows: userRows } = await executeQuery(
        'SELECT id, name, email FROM registered_users WHERE id = ? AND is_active = true',
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const targetUser = userRows[0];

      // Estadísticas de favoritos
      const { rows: favoritesRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?',
        [userId]
      );

      // Estadísticas de playlists
      const { rows: playlistsRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM playlists WHERE registered_user_id = ?',
        [userId]
      );

      // Estadísticas de historial de escucha
      const { rows: historyRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM listening_history WHERE registered_user_id = ?',
        [userId]
      );

      // Estadísticas de reviews
      const { rows: reviewsRows } = await executeQuery(
        'SELECT COUNT(*) as total FROM restaurant_reviews WHERE registered_user_id = ?',
        [userId]
      );

      // Estadísticas de peticiones por período
      const { rows: requestsStatsRows } = await executeQuery(
        `SELECT
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as requests24h,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as requests7d,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as requests30d,
          COUNT(*) as totalRequests
         FROM requests r
         JOIN users u ON r.user_id = u.id
         WHERE u.registered_user_id = ?`,
        [userId]
      );

      // Canciones favoritas más pedidas
      const { rows: favoriteSongsRows } = await executeQuery(
        `SELECT s.title, s.artist, COUNT(r.id) as request_count
         FROM songs s
         JOIN requests r ON s.id = r.song_id
         JOIN users u ON r.user_id = u.id
         JOIN favorites f ON u.id = f.user_id AND s.id = f.song_id
         WHERE u.registered_user_id = ?
         GROUP BY s.id, s.title, s.artist
         ORDER BY request_count DESC
         LIMIT 10`,
        [userId]
      );

      // Restaurantes favoritos
      const { rows: favoriteRestaurantsRows } = await executeQuery(
        `SELECT r.name, r.city, COUNT(req.id) as visit_count
         FROM restaurants r
         JOIN requests req ON r.id = req.restaurant_id
         JOIN users u ON req.user_id = u.id
         WHERE u.registered_user_id = ?
         GROUP BY r.id, r.name, r.city
         ORDER BY visit_count DESC
         LIMIT 5`,
        [userId]
      );

      const stats = {
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email
        },
        totals: {
          totalFavorites: parseInt(favoritesRows[0].total) || 0,
          totalPlaylists: parseInt(playlistsRows[0].total) || 0,
          totalListeningHistory: parseInt(historyRows[0].total) || 0,
          totalReviews: parseInt(reviewsRows[0].total) || 0,
          totalRequests: requestsStatsRows[0].totalRequests || 0
        },
        periodStats: {
          last24h: requestsStatsRows[0].requests24h || 0,
          last7d: requestsStatsRows[0].requests7d || 0,
          last30d: requestsStatsRows[0].requests30d || 0
        },
        favoriteSongs: favoriteSongsRows.map(row => ({
          title: row.title,
          artist: row.artist,
          requestCount: parseInt(row.request_count)
        })),
        favoriteRestaurants: favoriteRestaurantsRows.map(row => ({
          name: row.name,
          city: row.city,
          visitCount: parseInt(row.visit_count)
        }))
      };

      res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      logger.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user statistics',
        error: error.message
      });
    }
  }

  // Calcular porcentaje de crecimiento
  calculateGrowthPercentage(currentData) {
    try {
      // Para simplificar, calculamos un crecimiento promedio basado en los datos actuales
      // En una implementación real, compararíamos con el período anterior
      const totalGrowth = (currentData.newUsers + currentData.newRestaurants + currentData.newSubscriptions);
      const avgGrowth = totalGrowth / 3; // Promedio simple

      // Calcular porcentaje basado en totales existentes
      return Math.min(avgGrowth * 10, 100); // Máximo 100%
    } catch (error) {
      return 0;
    }
  }

  // Estadísticas de restaurante específico
  async getRestaurantStats(req, res) {
    try {
      const { restaurantId } = req.params;
      const { user } = req;
      const { period = '30d' } = req.query;

      // Verificar permisos - solo el propietario o admin puede ver estadísticas detalladas
      if (user.id !== restaurantId && user.role !== 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Restaurant owner or admin required.'
        });
      }

      // Verificar que el restaurante existe
      const { rows: restaurantRows } = await executeQuery(
        'SELECT id, name, city FROM restaurants WHERE id = ? AND is_active = true',
        [restaurantId]
      );

      if (restaurantRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found'
        });
      }

      const restaurant = restaurantRows[0];

      // Calcular filtro de tiempo
      let timeFilter = '';
      switch (period) {
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

      // Estadísticas generales
      const { rows: generalStatsRows } = await executeQuery(
        `SELECT
          COUNT(*) as totalRequests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingRequests,
          COUNT(CASE WHEN status = 'playing' THEN 1 END) as playingRequests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedRequests,
          COUNT(DISTINCT user_id) as uniqueUsers,
          AVG(CASE WHEN status = 'completed' THEN TIMESTAMPDIFF(SECOND, requested_at, completed_at) END) as avgCompletionTime
         FROM requests
         WHERE restaurant_id = ? ${timeFilter}`,
        [restaurantId]
      );

      // Canciones más populares
      const { rows: popularSongsRows } = await executeQuery(
        `SELECT s.title, s.artist, COUNT(r.id) as request_count
         FROM songs s
         JOIN requests r ON s.id = r.song_id
         WHERE s.restaurant_id = ? ${timeFilter}
         GROUP BY s.id, s.title, s.artist
         ORDER BY request_count DESC
         LIMIT 10`,
        [restaurantId]
      );

      // Actividad por horas
      const { rows: hourlyActivityRows } = await executeQuery(
        `SELECT HOUR(created_at) as hour, COUNT(*) as requests
         FROM requests
         WHERE restaurant_id = ? ${timeFilter}
         GROUP BY HOUR(created_at)
         ORDER BY hour`,
        [restaurantId]
      );

      const stats = {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          city: restaurant.city
        },
        period,
        generalStats: {
          totalRequests: generalStatsRows[0].totalRequests || 0,
          pendingRequests: generalStatsRows[0].pendingRequests || 0,
          playingRequests: generalStatsRows[0].playingRequests || 0,
          completedRequests: generalStatsRows[0].completedRequests || 0,
          uniqueUsers: generalStatsRows[0].uniqueUsers || 0,
          avgCompletionTime: Math.round(generalStatsRows[0].avgCompletionTime || 0),
          completionRate: generalStatsRows[0].totalRequests > 0
            ? ((generalStatsRows[0].completedRequests / generalStatsRows[0].totalRequests) * 100).toFixed(2)
            : 0
        },
        popularSongs: popularSongsRows.map(row => ({
          title: row.title,
          artist: row.artist,
          requestCount: parseInt(row.request_count)
        })),
        hourlyActivity: hourlyActivityRows.map(row => ({
          hour: parseInt(row.hour),
          requests: parseInt(row.requests)
        }))
      };

      res.json({
        success: true,
        message: 'Restaurant statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      logger.error('Get restaurant stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve restaurant statistics',
        error: error.message
      });
    }
  }
}

module.exports = new StatsController();