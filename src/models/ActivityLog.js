// src/models/ActivityLog.js - Modelo para logs de actividad del sistema
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

class ActivityLog {
  constructor(data) {
    this.id = data.id;
    this.restaurantId = data.restaurant_id;
    this.userId = data.user_id;
    this.action = data.action;
    this.entityType = data.entity_type;
    this.entityId = data.entity_id;
    this.details = this.parseJSON(data.details, {});
    this.ipAddress = data.ip_address;
    this.userAgent = data.user_agent;
    this.createdAt = data.created_at;
  }

  // Helper para parsear JSON de forma segura
  parseJSON(jsonString, defaultValue = null) {
    if (!jsonString) return defaultValue;
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (error) {
      logger.warn('Failed to parse JSON in ActivityLog:', { jsonString, error: error.message });
      return defaultValue;
    }
  }

  // Crear nuevo log de actividad
  static async create(data) {
    try {
      const { insertId } = await executeQuery(
        `INSERT INTO activity_logs (
          restaurant_id, user_id, action, entity_type, entity_id,
          details, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.restaurantId || null,
          data.userId || null,
          data.action,
          data.entityType || null,
          data.entityId || null,
          JSON.stringify(data.details || {}),
          data.ipAddress || null,
          data.userAgent || null
        ]
      );

      return await ActivityLog.findById(insertId);
    } catch (error) {
      logger.error('Error creating activity log:', error);
      throw new Error(`Error creating activity log: ${error.message}`);
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, restaurant_id, user_id, action, entity_type, entity_id,
                details, ip_address, user_agent, created_at
         FROM activity_logs WHERE id = ?`,
        [id]
      );
      return rows.length > 0 ? new ActivityLog(rows[0]) : null;
    } catch (error) {
      logger.error('Error finding activity log by ID:', error);
      throw new Error(`Error finding activity log by ID: ${error.message}`);
    }
  }

  // Obtener logs por restaurante
  static async getByRestaurant(restaurantId, limit = 50, offset = 0) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, restaurant_id, user_id, action, entity_type, entity_id,
                details, ip_address, user_agent, created_at
         FROM activity_logs
         WHERE restaurant_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [restaurantId, limit, offset]
      );
      return rows.map(row => new ActivityLog(row));
    } catch (error) {
      logger.error('Error getting activity logs by restaurant:', error);
      throw new Error(`Error getting activity logs by restaurant: ${error.message}`);
    }
  }

  // Obtener logs por acción
  static async getByAction(action, limit = 50) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, restaurant_id, user_id, action, entity_type, entity_id,
                details, ip_address, user_agent, created_at
         FROM activity_logs
         WHERE action = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [action, limit]
      );
      return rows.map(row => new ActivityLog(row));
    } catch (error) {
      logger.error('Error getting activity logs by action:', error);
      throw new Error(`Error getting activity logs by action: ${error.message}`);
    }
  }

  // Obtener logs recientes del sistema
  static async getRecent(limit = 100) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, restaurant_id, user_id, action, entity_type, entity_id,
                details, ip_address, user_agent, created_at
         FROM activity_logs
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      return rows.map(row => new ActivityLog(row));
    } catch (error) {
      logger.error('Error getting recent activity logs:', error);
      throw new Error(`Error getting recent activity logs: ${error.message}`);
    }
  }

  // Obtener estadísticas de actividad por período
  static async getStatsByPeriod(startDate, endDate, restaurantId = null) {
    try {
      let query = `
        SELECT
          DATE(created_at) as date,
          action,
          COUNT(*) as count
        FROM activity_logs
        WHERE created_at BETWEEN ? AND ?`;

      let params = [startDate, endDate];

      if (restaurantId) {
        query += ' AND restaurant_id = ?';
        params.push(restaurantId);
      }

      query += ' GROUP BY DATE(created_at), action ORDER BY date DESC, count DESC';

      const { rows } = await executeQuery(query, params);
      return rows;
    } catch (error) {
      logger.error('Error getting activity stats by period:', error);
      throw new Error(`Error getting activity stats by period: ${error.message}`);
    }
  }

  // Limpiar logs antiguos (más de X días)
  static async cleanup(daysToKeep = 30) {
    try {
      const { affectedRows } = await executeQuery(
        'DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysToKeep]
      );

      logger.info(`Cleaned up ${affectedRows} old activity logs`);
      return affectedRows;
    } catch (error) {
      logger.error('Error cleaning up activity logs:', error);
      throw new Error(`Error cleaning up activity logs: ${error.message}`);
    }
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      userId: this.userId,
      action: this.action,
      entityType: this.entityType,
      entityId: this.entityId,
      details: this.details,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      createdAt: this.createdAt
    };
  }
}

module.exports = ActivityLog;