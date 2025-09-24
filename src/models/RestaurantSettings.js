// src/models/RestaurantSettings.js - Modelo para configuración extra de restaurantes
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

class RestaurantSettings {
  constructor(data) {
    this.id = data.id;
    this.restaurantId = data.restaurant_id;
    this.settingKey = data.setting_key;
    this.settingValue = data.setting_value;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Crear nueva configuración
  static async create(data) {
    try {
      const { insertId } = await executeQuery(
        `INSERT INTO restaurant_settings (
          restaurant_id, setting_key, setting_value
        ) VALUES (?, ?, ?)`,
        [
          data.restaurantId,
          data.settingKey,
          data.settingValue
        ]
      );

      return await RestaurantSettings.findById(insertId);
    } catch (error) {
      logger.error('Error creating restaurant setting:', error);
      throw new Error(`Error creating restaurant setting: ${error.message}`);
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, restaurant_id, setting_key, setting_value,
                created_at, updated_at
         FROM restaurant_settings WHERE id = ?`,
        [id]
      );
      return rows.length > 0 ? new RestaurantSettings(rows[0]) : null;
    } catch (error) {
      logger.error('Error finding restaurant setting by ID:', error);
      throw new Error(`Error finding restaurant setting by ID: ${error.message}`);
    }
  }

  // Obtener configuración por restaurante y clave
  static async getByRestaurantAndKey(restaurantId, settingKey) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, restaurant_id, setting_key, setting_value,
                created_at, updated_at
         FROM restaurant_settings
         WHERE restaurant_id = ? AND setting_key = ?`,
        [restaurantId, settingKey]
      );
      return rows.length > 0 ? new RestaurantSettings(rows[0]) : null;
    } catch (error) {
      logger.error('Error getting restaurant setting by key:', error);
      throw new Error(`Error getting restaurant setting by key: ${error.message}`);
    }
  }

  // Obtener todas las configuraciones de un restaurante
  static async getByRestaurant(restaurantId) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, restaurant_id, setting_key, setting_value,
                created_at, updated_at
         FROM restaurant_settings
         WHERE restaurant_id = ?
         ORDER BY setting_key ASC`,
        [restaurantId]
      );

      // Convertir a objeto clave-valor para facilitar el acceso
      const settings = {};
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });

      return settings;
    } catch (error) {
      logger.error('Error getting restaurant settings:', error);
      throw new Error(`Error getting restaurant settings: ${error.message}`);
    }
  }

  // Establecer configuración (upsert)
  static async set(restaurantId, settingKey, settingValue) {
    try {
      // Intentar actualizar primero
      const existing = await RestaurantSettings.getByRestaurantAndKey(restaurantId, settingKey);

      if (existing) {
        await executeQuery(
          'UPDATE restaurant_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE restaurant_id = ? AND setting_key = ?',
          [settingValue, restaurantId, settingKey]
        );
      } else {
        await RestaurantSettings.create({
          restaurantId,
          settingKey,
          settingValue
        });
      }

      return settingValue;
    } catch (error) {
      logger.error('Error setting restaurant configuration:', error);
      throw new Error(`Error setting restaurant configuration: ${error.message}`);
    }
  }

  // Establecer múltiples configuraciones
  static async setMultiple(restaurantId, settings) {
    try {
      const results = {};

      for (const [key, value] of Object.entries(settings)) {
        results[key] = await RestaurantSettings.set(restaurantId, key, value);
      }

      return results;
    } catch (error) {
      logger.error('Error setting multiple restaurant configurations:', error);
      throw new Error(`Error setting multiple restaurant configurations: ${error.message}`);
    }
  }

  // Eliminar configuración
  static async delete(restaurantId, settingKey) {
    try {
      const { affectedRows } = await executeQuery(
        'DELETE FROM restaurant_settings WHERE restaurant_id = ? AND setting_key = ?',
        [restaurantId, settingKey]
      );

      return affectedRows > 0;
    } catch (error) {
      logger.error('Error deleting restaurant setting:', error);
      throw new Error(`Error deleting restaurant setting: ${error.message}`);
    }
  }

  // Actualizar configuración
  async update(settingValue) {
    try {
      await executeQuery(
        'UPDATE restaurant_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [settingValue, this.id]
      );

      this.settingValue = settingValue;
      this.updatedAt = new Date();
      return this;
    } catch (error) {
      logger.error('Error updating restaurant setting:', error);
      throw new Error(`Error updating restaurant setting: ${error.message}`);
    }
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      settingKey: this.settingKey,
      settingValue: this.settingValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = RestaurantSettings;