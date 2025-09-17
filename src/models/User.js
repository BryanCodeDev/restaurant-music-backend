// src/models/User.js - Modelo para manejar usuarios registrados y temporales
const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class RegisteredUser {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.password = data.password; // No exponer en JSON
    this.phone = data.phone;
    this.avatar = data.avatar;
    this.bio = data.bio;
    this.dateOfBirth = data.date_of_birth;
    this.preferredGenres = data.preferred_genres ? JSON.parse(data.preferred_genres) : [];
    this.preferredLanguages = data.preferred_languages ? JSON.parse(data.preferred_languages) : [];
    this.notificationPreferences = data.notification_preferences ? JSON.parse(data.notification_preferences) : {};
    this.themePreference = data.theme_preference;
    this.privacyLevel = data.privacy_level;
    this.isActive = data.is_active;
    this.isPremium = data.is_premium;
    this.emailVerified = data.email_verified;
    this.emailVerifiedAt = data.email_verified_at;
    this.lastLoginAt = data.last_login_at;
    this.loginCount = data.login_count;
    this.totalRequests = data.total_requests;
    this.favoriteRestaurantId = data.favorite_restaurant_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, name, email, phone, avatar, bio, date_of_birth, 
                preferred_genres, preferred_languages, notification_preferences,
                theme_preference, privacy_level, is_active, is_premium, 
                email_verified, email_verified_at, last_login_at, login_count,
                total_requests, favorite_restaurant_id, created_at, updated_at
         FROM registered_users WHERE id = ?`,
        [id]
      );
      return rows.length > 0 ? new RegisteredUser(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding registered user by ID: ${error.message}`);
    }
  }

  // Buscar por email
  static async findByEmail(email) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, name, email, password, phone, avatar, bio, date_of_birth, 
                preferred_genres, preferred_languages, notification_preferences,
                theme_preference, privacy_level, is_active, is_premium, 
                email_verified, email_verified_at, last_login_at, login_count,
                total_requests, favorite_restaurant_id, created_at, updated_at
         FROM registered_users WHERE email = ?`,
        [email]
      );
      return rows.length > 0 ? new RegisteredUser(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding registered user by email: ${error.message}`);
    }
  }

  // Crear nuevo usuario registrado
  static async create(data) {
    try {
      const userId = data.id || uuidv4();
      const hashedPassword = data.password; // Asumir ya hasheado en controller

      await executeQuery(
        `INSERT INTO registered_users (
          id, name, email, password, phone, avatar, bio, date_of_birth,
          preferred_genres, preferred_languages, notification_preferences,
          theme_preference, privacy_level, is_active, is_premium, email_verified,
          email_verified_at, last_login_at, login_count, total_requests,
          favorite_restaurant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, data.name, data.email, hashedPassword, data.phone || null,
          data.avatar || null, data.bio || null, data.dateOfBirth || null,
          JSON.stringify(data.preferredGenres || []), JSON.stringify(data.preferredLanguages || ['es']),
          JSON.stringify(data.notificationPreferences || {}), data.themePreference || 'dark',
          data.privacyLevel || 'public', true, false, false, null, null, 0, 0, null
        ]
      );

      return await RegisteredUser.findById(userId);
    } catch (error) {
      throw new Error(`Error creating registered user: ${error.message}`);
    }
  }

  // Actualizar usuario
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      const fieldMap = {
        name: 'name',
        phone: 'phone',
        avatar: 'avatar',
        bio: 'bio',
        dateOfBirth: 'date_of_birth',
        preferredGenres: 'preferred_genres',
        preferredLanguages: 'preferred_languages',
        notificationPreferences: 'notification_preferences',
        themePreference: 'theme_preference',
        privacyLevel: 'privacy_level',
        isPremium: 'is_premium',
        emailVerified: 'email_verified',
        favoriteRestaurantId: 'favorite_restaurant_id'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          if (key === 'preferredGenres') {
            updateValues.push(JSON.stringify(data[key]));
          } else if (key === 'preferredLanguages') {
            updateValues.push(JSON.stringify(data[key]));
          } else if (key === 'notificationPreferences') {
            updateValues.push(JSON.stringify(data[key]));
          } else {
            updateValues.push(data[key]);
          }
        }
      });

      if (updateFields.length === 0) return this;

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE registered_users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      const updated = await RegisteredUser.findById(this.id);
      Object.assign(this, updated);
      return this;
    } catch (error) {
      throw new Error(`Error updating registered user: ${error.message}`);
    }
  }

  // Obtener estadísticas
  async getStats() {
    try {
      const { rows } = await executeQuery(
        `SELECT 
          COUNT(DISTINCT f.id) as total_favorites,
          COUNT(DISTINCT p.id) as total_playlists,
          COUNT(DISTINCT lh.id) as total_listening_history,
          COUNT(DISTINCT rr.id) as total_reviews
         FROM registered_users ru
         LEFT JOIN favorites f ON ru.id = f.registered_user_id
         LEFT JOIN playlists p ON ru.id = p.registered_user_id
         LEFT JOIN listening_history lh ON ru.id = lh.registered_user_id
         LEFT JOIN restaurant_reviews rr ON ru.id = rr.registered_user_id
         WHERE ru.id = ?`,
        [this.id]
      );
      return rows[0] || {};
    } catch (error) {
      throw new Error(`Error getting user stats: ${error.message}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      avatar: this.avatar,
      bio: this.bio,
      dateOfBirth: this.dateOfBirth,
      preferredGenres: this.preferredGenres,
      preferredLanguages: this.preferredLanguages,
      notificationPreferences: this.notificationPreferences,
      themePreference: this.themePreference,
      privacyLevel: this.privacyLevel,
      isActive: this.isActive,
      isPremium: this.isPremium,
      emailVerified: this.emailVerified,
      emailVerifiedAt: this.emailVerifiedAt,
      lastLoginAt: this.lastLoginAt,
      loginCount: this.loginCount,
      totalRequests: this.totalRequests,
      favoriteRestaurantId: this.favoriteRestaurantId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      stats: null // Cargar dinámicamente si se necesita
    };
  }
}

class User {
  constructor(data) {
    this.id = data.id;
    this.registeredUserId = data.registered_user_id;
    this.userType = data.user_type;
    this.restaurantId = data.restaurant_id;
    this.tableNumber = data.table_number;
    this.sessionId = data.session_id;
    this.name = data.name;
    this.totalRequests = data.total_requests;
    this.requestsToday = data.requests_today;
    this.lastRequestAt = data.last_request_at;
    this.ipAddress = data.ip_address;
    this.userAgent = data.user_agent;
    this.deviceInfo = data.device_info ? JSON.parse(data.device_info) : {};
    this.preferences = data.preferences ? JSON.parse(data.preferences) : {};
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT u.*, r.name as restaurant_name,
                ru.name as registered_user_name
         FROM users u
         LEFT JOIN restaurants r ON u.restaurant_id = r.id
         LEFT JOIN registered_users ru ON u.registered_user_id = ru.id
         WHERE u.id = ?`,
        [id]
      );
      return rows.length > 0 ? new User(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  // Buscar por session ID
  static async findBySession(sessionId) {
    try {
      const { rows } = await executeQuery(
        `SELECT u.*, r.name as restaurant_name,
                ru.name as registered_user_name
         FROM users u
         LEFT JOIN restaurants r ON u.restaurant_id = r.id
         LEFT JOIN registered_users ru ON u.registered_user_id = ru.id
         WHERE u.session_id = ?`,
        [sessionId]
      );
      return rows.length > 0 ? new User(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding user by session: ${error.message}`);
    }
  }

  // Crear usuario temporal (sesión de mesa)
  static async create(data) {
    try {
      const userId = data.id || uuidv4();
      const sessionId = data.sessionId || uuidv4();

      await executeQuery(
        `INSERT INTO users (
          id, registered_user_id, user_type, restaurant_id, table_number,
          session_id, name, total_requests, requests_today, last_request_at,
          ip_address, user_agent, device_info, preferences
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, data.registeredUserId || null, data.userType || 'guest',
          data.restaurantId, data.tableNumber, sessionId, data.name || null,
          0, 0, null, data.ipAddress || null, data.userAgent || null,
          JSON.stringify(data.deviceInfo || {}), JSON.stringify(data.preferences || {})
        ]
      );

      return await User.findById(userId);
    } catch (error) {
      throw new Error(`Error creating user session: ${error.message}`);
    }
  }

  // Actualizar usuario temporal
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      const fieldMap = {
        tableNumber: 'table_number',
        name: 'name',
        totalRequests: 'total_requests',
        requestsToday: 'requests_today',
        lastRequestAt: 'last_request_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        deviceInfo: 'device_info',
        preferences: 'preferences'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          if (key === 'deviceInfo') {
            updateValues.push(JSON.stringify(data[key]));
          } else if (key === 'preferences') {
            updateValues.push(JSON.stringify(data[key]));
          } else {
            updateValues.push(data[key]);
          }
        }
      });

      if (updateFields.length === 0) return this;

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      const updated = await User.findById(this.id);
      Object.assign(this, updated);
      return this;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  // Incrementar requests today
  async incrementRequests() {
    try {
      await executeQuery(
        `UPDATE users SET requests_today = requests_today + 1, total_requests = total_requests + 1, 
                last_request_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [this.id]
      );
      this.requestsToday += 1;
      this.totalRequests += 1;
      this.lastRequestAt = new Date();
      return this;
    } catch (error) {
      throw new Error(`Error incrementing user requests: ${error.message}`);
    }
  }

  // Verificar si puede hacer requests (basado en restaurant limits)
  async canMakeRequest() {
    try {
      const { rows } = await executeQuery(
        `SELECT r.max_requests_per_user, COUNT(req.id) as today_requests
         FROM users u
         JOIN restaurants r ON u.restaurant_id = r.id
         LEFT JOIN requests req ON req.user_id = u.id AND DATE(req.requested_at) = CURDATE()
         WHERE u.id = ?
         GROUP BY u.id, r.max_requests_per_user`,
        [this.id]
      );
      if (rows.length > 0) {
        const { max_requests_per_user, today_requests } = rows[0];
        return parseInt(today_requests) < (max_requests_per_user || 2);
      }
      return false;
    } catch (error) {
      throw new Error(`Error checking request limit: ${error.message}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      registeredUserId: this.registeredUserId,
      userType: this.userType,
      restaurantId: this.restaurantId,
      tableNumber: this.tableNumber,
      sessionId: this.sessionId,
      name: this.name,
      totalRequests: this.totalRequests,
      requestsToday: this.requestsToday,
      lastRequestAt: this.lastRequestAt,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      deviceInfo: this.deviceInfo,
      preferences: this.preferences,
      restaurantName: null, // Set from join if needed
      registeredUserName: null, // Set from join if needed
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { RegisteredUser, User };