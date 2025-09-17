// src/models/SpotifyToken.js
const { executeQuery } = require('../config/database');

class SpotifyToken {
  constructor(data) {
    this.id = data.id;
    this.restaurantId = data.restaurant_id;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = data.expires_at;
    this.scope = data.scope;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Encontrar por restaurant_id
  static async findByRestaurantId(restaurantId) {
    try {
      const { rows } = await executeQuery(
        'SELECT * FROM spotify_tokens WHERE restaurant_id = ?',
        [restaurantId]
      );
      return rows.length > 0 ? new SpotifyToken(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding Spotify token: ${error.message}`);
    }
  }

  // Crear o actualizar token
  static async upsert(data) {
    try {
      const existing = await SpotifyToken.findByRestaurantId(data.restaurantId);
      if (existing) {
        // Actualizar
        await executeQuery(
          `UPDATE spotify_tokens 
           SET access_token = ?, refresh_token = ?, expires_at = ?, scope = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE restaurant_id = ?`,
          [data.accessToken, data.refreshToken, data.expiresAt, data.scope, data.restaurantId]
        );
      } else {
        // Crear
        await executeQuery(
          `INSERT INTO spotify_tokens (restaurant_id, access_token, refresh_token, expires_at, scope, created_at) 
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [data.restaurantId, data.accessToken, data.refreshToken, data.expiresAt, data.scope]
        );
      }
      return await SpotifyToken.findByRestaurantId(data.restaurantId);
    } catch (error) {
      throw new Error(`Error upserting Spotify token: ${error.message}`);
    }
  }

  // Verificar si token es válido (no expirado)
  isValid() {
    return this.expiresAt > new Date();
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      accessToken: this.accessToken, // No exponer en prod, solo para internal use
      refreshToken: this.refreshToken, // Similar
      expiresAt: this.expiresAt,
      scope: this.scope,
      isValid: this.isValid(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = SpotifyToken;