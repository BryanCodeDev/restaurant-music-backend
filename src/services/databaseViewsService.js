// src/services/databaseViewsService.js - Servicio para consultas complejas y vistas
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

class DatabaseViewsService {
  // Vista de restaurantes con información completa
  static async getRestaurantOverview(restaurantId) {
    try {
      const { rows } = await executeQuery(`
        SELECT
          r.*,
          sp.name as subscription_plan_name,
          sp.price as subscription_price,
          sp.period as subscription_period,
          sp.features as subscription_features,
          sp.max_requests as subscription_max_requests,
          sp.max_tables as subscription_max_tables,
          sp.has_spotify as subscription_has_spotify,
          CASE
            WHEN r.subscription_status = 'active' THEN 'Activo'
            WHEN r.subscription_status = 'pending' THEN 'Pendiente de aprobación'
            WHEN r.subscription_status = 'inactive' THEN 'Inactivo'
            WHEN r.subscription_status = 'cancelled' THEN 'Cancelado'
            ELSE 'Sin suscripción'
          END as subscription_status_label,
          -- Estadísticas del día
          COALESCE(stats_today.total_requests, 0) as today_requests,
          COALESCE(stats_today.unique_users, 0) as today_users,
          COALESCE(stats_today.completed_requests, 0) as today_completed,
          -- Estadísticas de la semana
          COALESCE(stats_week.total_requests, 0) as week_requests,
          COALESCE(stats_week.unique_users, 0) as week_users,
          -- Información de rating
          COALESCE(avg_rating.avg_rating, 0) as average_rating,
          COALESCE(avg_rating.total_reviews, 0) as total_reviews
        FROM restaurants r
        LEFT JOIN subscription_plans sp ON r.subscription_plan_id = sp.id
        LEFT JOIN (
          SELECT
            restaurant_id,
            COUNT(*) as total_requests,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests
          FROM requests
          WHERE DATE(created_at) = CURDATE()
          GROUP BY restaurant_id
        ) stats_today ON r.id = stats_today.restaurant_id
        LEFT JOIN (
          SELECT
            restaurant_id,
            COUNT(*) as total_requests,
            COUNT(DISTINCT user_id) as unique_users
          FROM requests
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY restaurant_id
        ) stats_week ON r.id = stats_week.restaurant_id
        LEFT JOIN (
          SELECT
            restaurant_id,
            AVG(rating) as avg_rating,
            COUNT(*) as total_reviews
          FROM restaurant_reviews
          GROUP BY restaurant_id
        ) avg_rating ON r.id = avg_rating.restaurant_id
        WHERE r.id = ?
      `, [restaurantId]);

      return rows[0] || null;
    } catch (error) {
      logger.error('Error getting restaurant overview:', error);
      throw new Error(`Error getting restaurant overview: ${error.message}`);
    }
  }

  // Vista de estadísticas de usuario
  static async getUserStats(userId, userType) {
    try {
      if (userType === 'registered_user') {
        const { rows } = await executeQuery(`
          SELECT
            ru.*,
            -- Estadísticas de favoritos
            COALESCE(fav_stats.total_favorites, 0) as total_favorites,
            COALESCE(fav_stats.favorite_restaurants, 0) as favorite_restaurants,
            -- Estadísticas de playlists
            COALESCE(play_stats.total_playlists, 0) as total_playlists,
            COALESCE(play_stats.total_playlist_songs, 0) as total_playlist_songs,
            -- Estadísticas de reviews
            COALESCE(review_stats.total_reviews, 0) as total_reviews,
            COALESCE(review_stats.avg_rating_given, 0) as avg_rating_given,
            -- Estadísticas de actividad musical
            COALESCE(history_stats.total_songs_played, 0) as total_songs_played,
            COALESCE(history_stats.unique_restaurants, 0) as unique_restaurants_visited,
            COALESCE(history_stats.total_play_time, 0) as total_play_time_minutes,
            -- Información de suscripción
            COALESCE(sub_stats.subscription_status, 'none') as subscription_status,
            COALESCE(sub_stats.subscription_plan_name, 'none') as subscription_plan_name
          FROM registered_users ru
          LEFT JOIN (
            SELECT
              registered_user_id,
              COUNT(*) as total_favorites,
              COUNT(DISTINCT restaurant_id) as favorite_restaurants
            FROM favorites
            WHERE registered_user_id IS NOT NULL
            GROUP BY registered_user_id
          ) fav_stats ON ru.id = fav_stats.registered_user_id
          LEFT JOIN (
            SELECT
              registered_user_id,
              COUNT(*) as total_playlists,
              COUNT(ps.id) as total_playlist_songs
            FROM playlists p
            LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
            GROUP BY registered_user_id
          ) play_stats ON ru.id = play_stats.registered_user_id
          LEFT JOIN (
            SELECT
              registered_user_id,
              COUNT(*) as total_reviews,
              AVG(rating) as avg_rating_given
            FROM restaurant_reviews
            GROUP BY registered_user_id
          ) review_stats ON ru.id = review_stats.registered_user_id
          LEFT JOIN (
            SELECT
              registered_user_id,
              COUNT(DISTINCT song_id) as total_songs_played,
              COUNT(DISTINCT restaurant_id) as unique_restaurants,
              SUM(play_duration) as total_play_time
            FROM listening_history
            GROUP BY registered_user_id
          ) history_stats ON ru.id = history_stats.registered_user_id
          LEFT JOIN (
            SELECT
              r.id as restaurant_id,
              r.subscription_status,
              sp.name as subscription_plan_name
            FROM restaurants r
            LEFT JOIN subscription_plans sp ON r.subscription_plan_id = sp.id
          ) sub_stats ON ru.favorite_restaurant_id = sub_stats.restaurant_id
          WHERE ru.id = ?
        `, [userId]);

        return rows[0] || null;
      } else {
        // Para usuarios temporales
        const { rows } = await executeQuery(`
          SELECT
            u.*,
            r.name as restaurant_name,
            r.city as restaurant_city,
            r.cuisine_type as restaurant_cuisine,
            -- Estadísticas de actividad
            COALESCE(req_stats.total_requests, 0) as total_requests,
            COALESCE(req_stats.pending_requests, 0) as pending_requests,
            COALESCE(req_stats.completed_requests, 0) as completed_requests,
            -- Información de restaurante
            COALESCE(sub_stats.subscription_status, 'none') as restaurant_subscription_status,
            COALESCE(sub_stats.subscription_plan_name, 'none') as restaurant_subscription_plan
          FROM users u
          LEFT JOIN restaurants r ON u.restaurant_id = r.id
          LEFT JOIN (
            SELECT
              user_id,
              COUNT(*) as total_requests,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests
            FROM requests
            GROUP BY user_id
          ) req_stats ON u.id = req_stats.user_id
          LEFT JOIN (
            SELECT
              id as restaurant_id,
              subscription_status,
              sp.name as subscription_plan_name
            FROM restaurants r
            LEFT JOIN subscription_plans sp ON r.subscription_plan_id = sp.id
          ) sub_stats ON u.restaurant_id = sub_stats.restaurant_id
          WHERE u.id = ?
        `, [userId]);

        return rows[0] || null;
      }
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw new Error(`Error getting user stats: ${error.message}`);
    }
  }

  // Vista de canciones populares por restaurante
  static async getPopularSongsByRestaurant(restaurantId, period = '30d', limit = 20) {
    try {
      let dateFilter = '';
      switch (period) {
        case '1d':
          dateFilter = 'AND r.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)';
          break;
        case '7d':
          dateFilter = 'AND r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
        default:
          dateFilter = 'AND r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
      }

      const { rows } = await executeQuery(`
        SELECT
          s.id,
          s.title,
          s.artist,
          s.album,
          s.duration,
          s.genre,
          s.image,
          s.popularity,
          s.times_requested,
          COUNT(r.id) as request_count,
          AVG(r.queue_position) as avg_queue_position,
          MIN(r.created_at) as first_requested,
          MAX(r.created_at) as last_requested
        FROM songs s
        LEFT JOIN requests r ON s.id = r.song_id ${dateFilter}
        WHERE s.restaurant_id = ?
        GROUP BY s.id, s.title, s.artist, s.album, s.duration, s.genre, s.image, s.popularity, s.times_requested
        ORDER BY request_count DESC, s.popularity DESC
        LIMIT ?
      `, [restaurantId, limit]);

      return rows;
    } catch (error) {
      logger.error('Error getting popular songs:', error);
      throw new Error(`Error getting popular songs: ${error.message}`);
    }
  }

  // Vista de actividad del restaurante
  static async getRestaurantActivity(restaurantId, period = '7d', limit = 50) {
    try {
      let dateFilter = '';
      switch (period) {
        case '1d':
          dateFilter = 'AND a.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)';
          break;
        case '7d':
        default:
          dateFilter = 'AND a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
          dateFilter = 'AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
      }

      const { rows } = await executeQuery(`
        SELECT
          a.*,
          CASE
            WHEN a.user_id IS NOT NULL THEN 'registered_user'
            WHEN a.restaurant_id IS NOT NULL THEN 'restaurant'
            ELSE 'system'
          END as actor_type,
          COALESCE(ru.name, r.name, 'System') as actor_name,
          COALESCE(ru.email, r.email, 'system') as actor_email
        FROM activity_logs a
        LEFT JOIN registered_users ru ON a.user_id = ru.id
        LEFT JOIN restaurants r ON a.restaurant_id = r.id
        WHERE (a.restaurant_id = ? OR a.user_id IN (
          SELECT registered_user_id FROM users WHERE restaurant_id = ?
        )) ${dateFilter}
        ORDER BY a.created_at DESC
        LIMIT ?
      `, [restaurantId, restaurantId, limit]);

      return rows;
    } catch (error) {
      logger.error('Error getting restaurant activity:', error);
      throw new Error(`Error getting restaurant activity: ${error.message}`);
    }
  }

  // Vista de estadísticas de suscripciones
  static async getSubscriptionStats(restaurantId = null, period = '30d') {
    try {
      let dateFilter = '';
      let params = [];

      switch (period) {
        case '7d':
          dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
        default:
          dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        case '90d':
          dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
          break;
      }

      let whereClause = `WHERE 1=1 ${dateFilter}`;
      if (restaurantId) {
        whereClause += ' AND id = ?';
        params.push(restaurantId);
      }

      const { rows } = await executeQuery(`
        SELECT
          COUNT(*) as total_restaurants,
          COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_restaurants,
          COUNT(CASE WHEN subscription_status = 'pending' THEN 1 END) as pending_restaurants,
          COUNT(CASE WHEN subscription_status = 'inactive' THEN 1 END) as inactive_restaurants,
          COUNT(CASE WHEN subscription_status = 'cancelled' THEN 1 END) as cancelled_restaurants,
          AVG(CASE WHEN subscription_status = 'active' THEN sp.price END) as avg_subscription_price,
          SUM(CASE WHEN subscription_status = 'active' THEN sp.price END) as total_monthly_revenue,
          COUNT(CASE WHEN subscription_end_date < NOW() AND subscription_status = 'active' THEN 1 END) as expired_subscriptions,
          COUNT(CASE WHEN subscription_end_date <= DATE_ADD(NOW(), INTERVAL 7 DAY) AND subscription_status = 'active' THEN 1 END) as expiring_soon
        FROM restaurants r
        LEFT JOIN subscription_plans sp ON r.subscription_plan_id = sp.id
        ${whereClause}
      `, params);

      return rows[0];
    } catch (error) {
      logger.error('Error getting subscription stats:', error);
      throw new Error(`Error getting subscription stats: ${error.message}`);
    }
  }

  // Vista de análisis de reviews
  static async getReviewAnalytics(restaurantId = null, period = '30d') {
    try {
      let dateFilter = '';
      let params = [];

      switch (period) {
        case '7d':
          dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
        default:
          dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        case '90d':
          dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
          break;
      }

      let whereClause = `WHERE 1=1 ${dateFilter}`;
      if (restaurantId) {
        whereClause += ' AND restaurant_id = ?';
        params.push(restaurantId);
      }

      const { rows } = await executeQuery(`
        SELECT
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_stars,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_stars,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_stars,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_stars,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
          AVG(music_quality_rating) as avg_music_rating,
          AVG(service_rating) as avg_service_rating,
          AVG(ambiance_rating) as avg_ambiance_rating,
          COUNT(CASE WHEN is_anonymous = true THEN 1 END) as anonymous_reviews,
          COUNT(CASE WHEN helpful_votes > 0 THEN 1 END) as helpful_reviews,
          AVG(helpful_votes) as avg_helpful_votes
        FROM restaurant_reviews
        ${whereClause}
      `, params);

      return rows[0];
    } catch (error) {
      logger.error('Error getting review analytics:', error);
      throw new Error(`Error getting review analytics: ${error.message}`);
    }
  }

  // Procedimiento para actualizar estadísticas de restaurante
  static async updateRestaurantStats(restaurantId) {
    try {
      await executeQuery(`
        UPDATE restaurants r
        SET
          rating = COALESCE((
            SELECT AVG(rating)
            FROM restaurant_reviews
            WHERE restaurant_id = r.id
          ), 0.00),
          total_reviews = COALESCE((
            SELECT COUNT(*)
            FROM restaurant_reviews
            WHERE restaurant_id = r.id
          ), 0)
        WHERE r.id = ?
      `, [restaurantId]);

      logger.info(`Restaurant stats updated for: ${restaurantId}`);
    } catch (error) {
      logger.error('Error updating restaurant stats:', error);
      throw new Error(`Error updating restaurant stats: ${error.message}`);
    }
  }

  // Procedimiento para limpiar datos antiguos
  static async cleanupOldData(daysToKeep = 90) {
    try {
      // Limpiar logs de actividad antiguos
      const { affectedRows: activityLogsDeleted } = await executeQuery(
        'DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysToKeep]
      );

      // Limpiar tokens expirados
      const { affectedRows: expiredTokensDeleted } = await executeQuery(
        'DELETE FROM auth_tokens WHERE expires_at < NOW()',
        []
      );

      // Limpiar usuarios temporales inactivos (más de 24 horas)
      const { affectedRows: oldUsersDeleted } = await executeQuery(
        'DELETE FROM users WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY) AND user_type = "guest"',
        []
      );

      logger.info('Data cleanup completed', {
        activityLogsDeleted,
        expiredTokensDeleted,
        oldUsersDeleted
      });

      return {
        activityLogsDeleted,
        expiredTokensDeleted,
        oldUsersDeleted
      };
    } catch (error) {
      logger.error('Error during data cleanup:', error);
      throw new Error(`Error during data cleanup: ${error.message}`);
    }
  }
}

module.exports = DatabaseViewsService;