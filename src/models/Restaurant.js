// src/models/Restaurant.js
const { executeQuery } = require('../config/database');
const { createSlug } = require('../utils/helpers');

class Restaurant {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.email = data.email;
    this.phone = data.phone;
    this.address = data.address;
    this.city = data.city;
    this.country = data.country;
    this.timezone = data.timezone;
    this.maxRequestsPerUser = data.max_requests_per_user;
    this.queueLimit = data.queue_limit;
    this.autoPlay = data.auto_play;
    this.allowExplicit = data.allow_explicit;
    this.isActive = data.is_active;
    this.subscriptionPlan = data.subscription_plan;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Buscar restaurante por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        'SELECT * FROM restaurants WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? new Restaurant(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding restaurant by ID: ${error.message}`);
    }
  }

  // Buscar restaurante por slug
  static async findBySlug(slug) {
    try {
      const { rows } = await executeQuery(
        'SELECT * FROM restaurants WHERE slug = ?',
        [slug]
      );
      
      return rows.length > 0 ? new Restaurant(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding restaurant by slug: ${error.message}`);
    }
  }

  // Buscar restaurante por email
  static async findByEmail(email) {
    try {
      const { rows } = await executeQuery(
        'SELECT * FROM restaurants WHERE email = ?',
        [email]
      );
      
      return rows.length > 0 ? new Restaurant(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding restaurant by email: ${error.message}`);
    }
  }

  // Crear nuevo restaurante
  static async create(data) {
    try {
      // Generar slug único
      const baseSlug = createSlug(data.name);
      let slug = baseSlug;
      let counter = 1;

      while (await Restaurant.findBySlug(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const restaurantData = {
        ...data,
        slug,
        timezone: data.timezone || 'America/Bogota',
        max_requests_per_user: data.maxRequestsPerUser || 2,
        queue_limit: data.queueLimit || 50,
        auto_play: data.autoPlay !== undefined ? data.autoPlay : true,
        allow_explicit: data.allowExplicit !== undefined ? data.allowExplicit : false,
        is_active: true,
        subscription_plan: data.subscriptionPlan || 'free'
      };

      const { rows } = await executeQuery(
        `INSERT INTO restaurants 
         (id, name, slug, email, password, phone, address, city, country, timezone,
          max_requests_per_user, queue_limit, auto_play, allow_explicit, 
          is_active, subscription_plan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurantData.id, restaurantData.name, restaurantData.slug,
          restaurantData.email, restaurantData.password, restaurantData.phone,
          restaurantData.address, restaurantData.city, restaurantData.country,
          restaurantData.timezone, restaurantData.max_requests_per_user,
          restaurantData.queue_limit, restaurantData.auto_play,
          restaurantData.allow_explicit, restaurantData.is_active,
          restaurantData.subscription_plan
        ]
      );

      return await Restaurant.findById(restaurantData.id);
    } catch (error) {
      throw new Error(`Error creating restaurant: ${error.message}`);
    }
  }

  // Actualizar restaurante
  async update(data) {
    try {
      const updateFields = {};
      const updateValues = [];

      // Construir campos a actualizar dinámicamente
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && key !== 'id') {
          const dbKey = this.camelToSnake(key);
          updateFields[dbKey] = '?';
          updateValues.push(data[key]);
        }
      });

      if (updateValues.length === 0) {
        return this;
      }

      updateValues.push(this.id);

      const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
      
      await executeQuery(
        `UPDATE restaurants SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      // Recargar datos actualizados
      const updated = await Restaurant.findById(this.id);
      Object.assign(this, updated);
      
      return this;
    } catch (error) {
      throw new Error(`Error updating restaurant: ${error.message}`);
    }
  }

  // Eliminar restaurante (soft delete)
  async delete() {
    try {
      await executeQuery(
        'UPDATE restaurants SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [this.id]
      );

      this.isActive = false;
      return this;
    } catch (error) {
      throw new Error(`Error deleting restaurant: ${error.message}`);
    }
  }

  // Obtener estadísticas del restaurante
  async getStats(period = '24h') {
    try {
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

      const { rows } = await executeQuery(
        `SELECT 
          (SELECT COUNT(*) FROM songs WHERE restaurant_id = ? AND is_active = true) as total_songs,
          (SELECT COUNT(*) FROM requests WHERE restaurant_id = ? ${timeFilter}) as total_requests,
          (SELECT COUNT(*) FROM requests WHERE restaurant_id = ? AND status = 'pending') as pending_requests,
          (SELECT COUNT(*) FROM requests WHERE restaurant_id = ? AND status = 'completed' ${timeFilter}) as completed_requests,
          (SELECT COUNT(DISTINCT user_id) FROM requests WHERE restaurant_id = ? ${timeFilter}) as unique_users,
          (SELECT COUNT(*) FROM users WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()) as today_users`,
        [this.id, this.id, this.id, this.id, this.id, this.id]
      );

      return rows[0] || {};
    } catch (error) {
      throw new Error(`Error getting restaurant stats: ${error.message}`);
    }
  }

  // Obtener todas las canciones del restaurante
  async getSongs(filters = {}) {
    try {
      let query = 'SELECT * FROM songs WHERE restaurant_id = ? AND is_active = true';
      let params = [this.id];

      if (filters.genre && filters.genre !== 'all') {
        query += ' AND genre = ?';
        params.push(filters.genre);
      }

      if (filters.search) {
        query += ' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      query += ' ORDER BY popularity DESC, times_requested DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      const { rows } = await executeQuery(query, params);
      return rows;
    } catch (error) {
      throw new Error(`Error getting restaurant songs: ${error.message}`);
    }
  }

  // Obtener peticiones activas
  async getActiveRequests() {
    try {
      const { rows } = await executeQuery(
        `SELECT r.*, s.title, s.artist, s.duration, s.image, u.table_number
         FROM requests r
         JOIN songs s ON r.song_id = s.id
         JOIN users u ON r.user_id = u.id
         WHERE r.restaurant_id = ? AND r.status IN ('pending', 'playing')
         ORDER BY r.queue_position ASC`,
        [this.id]
      );

      return rows;
    } catch (error) {
      throw new Error(`Error getting active requests: ${error.message}`);
    }
  }

  // Verificar si el restaurante puede recibir más peticiones
  canAcceptRequests() {
    return this.isActive;
  }

  // Obtener URL del código QR
  getQRCodeUrl() {
    return `/uploads/qr-codes/${this.slug}-qr.png`;
  }

  // Convertir camelCase a snake_case
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      email: this.email,
      phone: this.phone,
      address: this.address,
      city: this.city,
      country: this.country,
      timezone: this.timezone,
      maxRequestsPerUser: this.maxRequestsPerUser,
      queueLimit: this.queueLimit,
      autoPlay: this.autoPlay,
      allowExplicit: this.allowExplicit,
      isActive: this.isActive,
      subscriptionPlan: this.subscriptionPlan,
      qrCodeUrl: this.getQRCodeUrl(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Restaurant;