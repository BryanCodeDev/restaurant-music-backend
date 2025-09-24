// src/services/activityLogService.js - Servicio centralizado para logs de actividad
const { ActivityLog } = require('../models');
const { logger } = require('../utils/logger');

class ActivityLogService {
  // Log de acciones de usuarios
  static async logUserAction(userId, action, entityType, entityId, details = {}, req = null) {
    try {
      const logData = {
        userId,
        action,
        entityType,
        entityId,
        details,
        ipAddress: req?.ip || null,
        userAgent: req?.get('User-Agent') || null
      };

      await ActivityLog.create(logData);

      // Log adicional en el logger del sistema para debugging
      logger.info(`Activity logged: ${action} on ${entityType}:${entityId}`, {
        userId,
        details,
        ip: req?.ip
      });

    } catch (error) {
      logger.error('Error logging user activity:', error);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  // Log de acciones de restaurantes
  static async logRestaurantAction(restaurantId, action, entityType, entityId, details = {}, req = null) {
    try {
      const logData = {
        restaurantId,
        action,
        entityType,
        entityId,
        details,
        ipAddress: req?.ip || null,
        userAgent: req?.get('User-Agent') || null
      };

      await ActivityLog.create(logData);

      logger.info(`Restaurant activity logged: ${action} on ${entityType}:${entityId}`, {
        restaurantId,
        details,
        ip: req?.ip
      });

    } catch (error) {
      logger.error('Error logging restaurant activity:', error);
    }
  }

  // Log de acciones del sistema (sin usuario específico)
  static async logSystemAction(action, entityType, entityId, details = {}) {
    try {
      const logData = {
        action,
        entityType,
        entityId,
        details
      };

      await ActivityLog.create(logData);

      logger.info(`System activity logged: ${action} on ${entityType}:${entityId}`, {
        details
      });

    } catch (error) {
      logger.error('Error logging system activity:', error);
    }
  }

  // Logs específicos para diferentes tipos de acciones

  // Logs de autenticación
  static async logLogin(userId, userType, req) {
    await this.logUserAction(
      userId,
      'user_login',
      'user',
      userId,
      { userType },
      req
    );
  }

  static async logLogout(userId, userType, req) {
    await this.logUserAction(
      userId,
      'user_logout',
      'user',
      userId,
      { userType },
      req
    );
  }

  static async logFailedLogin(email, reason, req) {
    await this.logSystemAction(
      'failed_login',
      'auth_attempt',
      null,
      { email, reason, ip: req?.ip }
    );
  }

  // Logs de canciones
  static async logSongRequested(userId, songId, restaurantId, req) {
    await this.logUserAction(
      userId,
      'song_requested',
      'song',
      songId,
      { restaurantId },
      req
    );
  }

  static async logSongFavorited(userId, songId, restaurantId, req) {
    await this.logUserAction(
      userId,
      'song_favorited',
      'favorite',
      songId,
      { restaurantId },
      req
    );
  }

  // Logs de playlists
  static async logPlaylistCreated(userId, playlistId, req) {
    await this.logUserAction(
      userId,
      'playlist_created',
      'playlist',
      playlistId,
      {},
      req
    );
  }

  static async logPlaylistSongAdded(userId, playlistId, songId, req) {
    await this.logUserAction(
      userId,
      'song_added_to_playlist',
      'playlist_song',
      songId,
      { playlistId },
      req
    );
  }

  // Logs de reviews
  static async logReviewCreated(userId, reviewId, restaurantId, req) {
    await this.logUserAction(
      userId,
      'review_created',
      'restaurant_review',
      reviewId,
      { restaurantId },
      req
    );
  }

  static async logReviewUpdated(userId, reviewId, req) {
    await this.logUserAction(
      userId,
      'review_updated',
      'restaurant_review',
      reviewId,
      {},
      req
    );
  }

  // Logs de suscripciones
  static async logSubscriptionCreated(restaurantId, planId, req) {
    await this.logRestaurantAction(
      restaurantId,
      'subscription_created',
      'subscription',
      planId,
      { planId },
      req
    );
  }

  static async logSubscriptionApproved(restaurantId, planId, approvedBy, req) {
    await this.logRestaurantAction(
      restaurantId,
      'subscription_approved',
      'subscription',
      planId,
      { planId, approvedBy },
      req
    );
  }

  static async logSubscriptionRejected(restaurantId, planId, rejectedBy, reason, req) {
    await this.logRestaurantAction(
      restaurantId,
      'subscription_rejected',
      'subscription',
      planId,
      { planId, rejectedBy, reason },
      req
    );
  }

  // Logs de administración
  static async logAdminAction(adminId, action, entityType, entityId, details, req) {
    await this.logUserAction(
      adminId,
      `admin_${action}`,
      entityType,
      entityId,
      details,
      req
    );
  }

  // Obtener logs recientes
  static async getRecentLogs(limit = 50, restaurantId = null) {
    try {
      if (restaurantId) {
        return await ActivityLog.getByRestaurant(restaurantId, limit);
      } else {
        return await ActivityLog.getRecent(limit);
      }
    } catch (error) {
      logger.error('Error getting recent logs:', error);
      return [];
    }
  }

  // Obtener estadísticas de actividad
  static async getActivityStats(startDate, endDate, restaurantId = null) {
    try {
      return await ActivityLog.getStatsByPeriod(startDate, endDate, restaurantId);
    } catch (error) {
      logger.error('Error getting activity stats:', error);
      return [];
    }
  }

  // Limpiar logs antiguos
  static async cleanupOldLogs(daysToKeep = 30) {
    try {
      const deletedCount = await ActivityLog.cleanup(daysToKeep);
      logger.info(`Cleaned up ${deletedCount} old activity logs`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old logs:', error);
      return 0;
    }
  }
}

module.exports = ActivityLogService;