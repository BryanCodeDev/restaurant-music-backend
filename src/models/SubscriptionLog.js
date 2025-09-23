// src/models/SubscriptionLog.js
const { executeQuery } = require('../config/database');

class SubscriptionLog {
  constructor(data) {
    this.id = data.id;
    this.subscriptionId = data.subscription_id;
    this.action = data.action;
    this.performedBy = data.performed_by;
    this.details = data.details ? JSON.parse(data.details) : {};
    this.ipAddress = data.ip_address;
    this.userAgent = data.user_agent;
    this.createdAt = data.created_at;
  }

  // Buscar logs por suscripción
  static async findBySubscriptionId(subscriptionId) {
    try {
      const { rows } = await executeQuery(
        `SELECT sl.*, ru.name as performed_by_name, ru.email as performed_by_email
         FROM subscription_logs sl
         LEFT JOIN registered_users ru ON sl.performed_by = ru.id
         WHERE sl.subscription_id = ?
         ORDER BY sl.created_at DESC`,
        [subscriptionId]
      );

      return rows.map(row => {
        const log = new SubscriptionLog(row);
        log.performedByInfo = {
          name: row.performed_by_name,
          email: row.performed_by_email
        };
        return log;
      });
    } catch (error) {
      throw new Error(`Error finding subscription logs: ${error.message}`);
    }
  }

  // Buscar logs por acción
  static async findByAction(action, limit = 100) {
    try {
      const { rows } = await executeQuery(
        `SELECT sl.*, ru.name as performed_by_name, ru.email as performed_by_email
         FROM subscription_logs sl
         LEFT JOIN registered_users ru ON sl.performed_by = ru.id
         WHERE sl.action = ?
         ORDER BY sl.created_at DESC
         LIMIT ?`,
        [action, limit]
      );

      return rows.map(row => {
        const log = new SubscriptionLog(row);
        log.performedByInfo = {
          name: row.performed_by_name,
          email: row.performed_by_email
        };
        return log;
      });
    } catch (error) {
      throw new Error(`Error finding subscription logs by action: ${error.message}`);
    }
  }

  // Crear nuevo log
  static async create(data) {
    try {
      const { insertId } = await executeQuery(
        `INSERT INTO subscription_logs (
          subscription_id, action, performed_by, details,
          ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.subscriptionId,
          data.action,
          data.performedBy || null,
          data.details ? JSON.stringify(data.details) : null,
          data.ipAddress || null,
          data.userAgent || null
        ]
      );

      return await SubscriptionLog.findById(insertId);
    } catch (error) {
      throw new Error(`Error creating subscription log: ${error.message}`);
    }
  }

  // Buscar log por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT sl.*, ru.name as performed_by_name, ru.email as performed_by_email
         FROM subscription_logs sl
         LEFT JOIN registered_users ru ON sl.performed_by = ru.id
         WHERE sl.id = ?`,
        [id]
      );

      if (rows.length === 0) return null;

      const log = new SubscriptionLog(rows[0]);
      log.performedByInfo = {
        name: rows[0].performed_by_name,
        email: rows[0].performed_by_email
      };

      return log;
    } catch (error) {
      throw new Error(`Error finding subscription log by ID: ${error.message}`);
    }
  }

  // Obtener estadísticas de logs por período
  static async getStatsByPeriod(startDate, endDate) {
    try {
      const { rows } = await executeQuery(
        `SELECT
          action,
          COUNT(*) as count,
          DATE(created_at) as date
         FROM subscription_logs
         WHERE created_at BETWEEN ? AND ?
         GROUP BY action, DATE(created_at)
         ORDER BY date DESC, action`,
        [startDate, endDate]
      );

      return rows;
    } catch (error) {
      throw new Error(`Error getting subscription log stats: ${error.message}`);
    }
  }

  // Convertir a JSON
  toJSON() {
    return {
      id: this.id,
      subscriptionId: this.subscriptionId,
      action: this.action,
      performedBy: this.performedBy,
      details: this.details,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      createdAt: this.createdAt,
      performedByInfo: this.performedByInfo
    };
  }
}

module.exports = SubscriptionLog;