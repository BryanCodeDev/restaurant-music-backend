// src/models/Restaurant.js
const { executeQuery } = require('../config/database');
const { createSlug } = require('../utils/helpers');

class Restaurant {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.ownerName = data.owner_name;
    this.slug = data.slug;
    this.email = data.email;
    this.password = data.password; // No exponer en JSON
    this.phone = data.phone;
    this.address = data.address;
    this.city = data.city;
    this.country = data.country;
    this.logo = data.logo;
    this.coverImage = data.cover_image;
    this.description = data.description;
    this.website = data.website;
    this.socialMedia = data.social_media ? JSON.parse(data.social_media) : {};
    this.businessHours = data.business_hours ? JSON.parse(data.business_hours) : {};
    this.cuisineType = data.cuisine_type;
    this.priceRange = data.price_range;
    this.rating = data.rating;
    this.totalReviews = data.total_reviews;
    this.verified = data.verified;
    this.verificationDate = data.verification_date;
    this.timezone = data.timezone;
    this.maxRequestsPerUser = data.max_requests_per_user;
    this.queueLimit = data.queue_limit;
    this.autoPlay = data.auto_play;
    this.allowExplicit = data.allow_explicit;
    this.isActive = data.is_active;
    this.subscriptionPlan = data.subscription_plan;
    this.planType = data.subscription_plan || 'basic';
    this.lastLoginAt = data.last_login_at;
    this.settings = data.settings ? JSON.parse(data.settings) : {};
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Buscar restaurante por ID - Todos los campos
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, name, owner_name, slug, email, password, phone, address, city, country,
                logo, cover_image, description, website, social_media, business_hours,
                cuisine_type, price_range, rating, total_reviews, verified, verification_date,
                timezone, max_requests_per_user, queue_limit, auto_play, allow_explicit,
                is_active, subscription_plan, last_login_at, settings, created_at, updated_at
         FROM restaurants WHERE id = ?`,
        [id]
      );
      
      return rows.length > 0 ? new Restaurant(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding restaurant by ID: ${error.message}`);
    }
  }

  // Buscar restaurante por slug - Todos los campos
  static async findBySlug(slug) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, name, owner_name, slug, email, phone, address, city, country,
                logo, cover_image, description, website, social_media, business_hours,
                cuisine_type, price_range, rating, total_reviews, verified, verification_date,
                timezone, max_requests_per_user, queue_limit, auto_play, allow_explicit,
                is_active, subscription_plan, last_login_at, settings, created_at, updated_at
         FROM restaurants WHERE slug = ?`,
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

  // Crear nuevo restaurante - Todos los campos
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

      const restaurantId = data.id || uuidv4();

      const restaurantData = {
        ...data,
        id: restaurantId,
        slug,
        owner_name: data.ownerName || null,
        logo: data.logo || null,
        cover_image: data.coverImage || null,
        description: data.description || null,
        website: data.website || null,
        social_media: JSON.stringify(data.socialMedia || {}),
        business_hours: JSON.stringify(data.businessHours || {}),
        cuisine_type: data.cuisineType || null,
        price_range: data.priceRange || '$$',
        rating: 0.00,
        total_reviews: 0,
        verified: false,
        verification_date: null,
        timezone: data.timezone || 'America/Bogota',
        max_requests_per_user: data.maxRequestsPerUser || 2,
        queue_limit: data.queueLimit || 50,
        auto_play: data.autoPlay !== undefined ? data.autoPlay : true,
        allow_explicit: data.allowExplicit !== undefined ? data.allowExplicit : false,
        is_active: true,
        subscription_plan: data.subscriptionPlan || 'free',
        last_login_at: null,
        settings: JSON.stringify(data.settings || {})
      };

      await executeQuery(
        `INSERT INTO restaurants (
          id, name, owner_name, slug, email, password, phone, address, city, country,
          logo, cover_image, description, website, social_media, business_hours,
          cuisine_type, price_range, rating, total_reviews, verified, verification_date,
          timezone, max_requests_per_user, queue_limit, auto_play, allow_explicit,
          is_active, subscription_plan, last_login_at, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurantData.id, restaurantData.name, restaurantData.owner_name, restaurantData.slug,
          restaurantData.email, restaurantData.password, restaurantData.phone,
          restaurantData.address, restaurantData.city, restaurantData.country,
          restaurantData.logo, restaurantData.cover_image, restaurantData.description,
          restaurantData.website, restaurantData.social_media, restaurantData.business_hours,
          restaurantData.cuisine_type, restaurantData.price_range, restaurantData.rating,
          restaurantData.total_reviews, restaurantData.verified, restaurantData.verification_date,
          restaurantData.timezone, restaurantData.max_requests_per_user, restaurantData.queue_limit,
          restaurantData.auto_play, restaurantData.allow_explicit, restaurantData.is_active,
          restaurantData.subscription_plan, restaurantData.last_login_at, restaurantData.settings
        ]
      );

      return await Restaurant.findById(restaurantData.id);
    } catch (error) {
      throw new Error(`Error creating restaurant: ${error.message}`);
    }
  }

  // Actualizar restaurante - Manejar todos los campos
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      const fieldMap = {
        name: 'name',
        ownerName: 'owner_name',
        phone: 'phone',
        address: 'address',
        city: 'city',
        country: 'country',
        logo: 'logo',
        coverImage: 'cover_image',
        description: 'description',
        website: 'website',
        socialMedia: 'social_media',
        businessHours: 'business_hours',
        cuisineType: 'cuisine_type',
        priceRange: 'price_range',
        rating: 'rating',
        totalReviews: 'total_reviews',
        verified: 'verified',
        verificationDate: 'verification_date',
        timezone: 'timezone',
        maxRequestsPerUser: 'max_requests_per_user',
        queueLimit: 'queue_limit',
        autoPlay: 'auto_play',
        allowExplicit: 'allow_explicit',
        subscriptionPlan: 'subscription_plan',
        lastLoginAt: 'last_login_at',
        settings: 'settings'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          if (key === 'socialMedia' || key === 'businessHours' || key === 'settings') {
            updateValues.push(JSON.stringify(data[key]));
          } else {
            updateValues.push(data[key]);
          }
        }
      });

      if (updateFields.length === 0) {
        return this;
      }

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE restaurants SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
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

  // Obtener estadísticas del restaurante - Incluyendo reviews y ratings
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
          (SELECT COUNT(*) FROM users WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()) as today_users,
          (SELECT AVG(rating) FROM restaurant_reviews WHERE restaurant_id = ?) as avg_rating,
          (SELECT COUNT(*) FROM restaurant_reviews WHERE restaurant_id = ?) as total_reviews`,
        [this.id, this.id, this.id, this.id, this.id, this.id, this.id, this.id]
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

  // Serializar para JSON - Todos los campos
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      ownerName: this.ownerName,
      slug: this.slug,
      email: this.email,
      phone: this.phone,
      address: this.address,
      city: this.city,
      country: this.country,
      logo: this.logo,
      coverImage: this.coverImage,
      description: this.description,
      website: this.website,
      socialMedia: this.socialMedia,
      businessHours: this.businessHours,
      cuisineType: this.cuisineType,
      priceRange: this.priceRange,
      rating: this.rating,
      totalReviews: this.totalReviews,
      verified: this.verified,
      verificationDate: this.verificationDate,
      timezone: this.timezone,
      maxRequestsPerUser: this.maxRequestsPerUser,
      queueLimit: this.queueLimit,
      autoPlay: this.autoPlay,
      allowExplicit: this.allowExplicit,
      isActive: this.isActive,
      subscriptionPlan: this.subscriptionPlan,
      lastLoginAt: this.lastLoginAt,
      settings: this.settings,
      qrCodeUrl: this.getQRCodeUrl(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Restaurant;