// src/models/Favorite.js - Modelo para favoritos de canciones
const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Song = require('./Song');
const { User } = require('./User');

class Favorite {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.registeredUserId = data.registered_user_id;
    this.songId = data.song_id;
    this.restaurantId = data.restaurant_id;
    this.favoriteType = data.favorite_type;
    this.notes = data.notes;
    this.playCount = data.play_count;
    this.lastPlayedAt = data.last_played_at;
    this.createdAt = data.created_at;
    this.song = data.song ? new Song(data.song) : null;
    this.user = data.user ? new User(data.user) : null;
  }

  // Buscar favorito por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT f.*, s.title as song_title, s.artist as song_artist,
                u.name as user_name, u.table_number as user_table,
                ru.name as reg_user_name
         FROM favorites f
         LEFT JOIN songs s ON f.song_id = s.id
         LEFT JOIN users u ON f.user_id = u.id
         LEFT JOIN registered_users ru ON f.registered_user_id = ru.id
         WHERE f.id = ?`,
        [id]
      );

      if (rows.length > 0) {
        const row = rows[0];
        row.song = { title: row.song_title, artist: row.song_artist };
        if (row.user_id) {
          row.user = { name: row.user_name, table_number: row.user_table };
        } else if (row.registered_user_id) {
          row.user = { name: row.reg_user_name };
        }
        return new Favorite(row);
      }
      return null;
    } catch (error) {
      throw new Error(`Error finding favorite by ID: ${error.message}`);
    }
  }

  // Agregar favorito (para user temporal o registrado)
  static async create(data) {
    try {
      const favoriteId = data.id || uuidv4();

      // Verificar si ya existe (unique constraint)
      let existingQuery = `
        SELECT id FROM favorites 
        WHERE (? IS NOT NULL AND user_id = ? AND song_id = ?) OR 
              (? IS NOT NULL AND registered_user_id = ? AND song_id = ?)
      `;
      let existingParams = [
        data.userId, data.userId, data.songId,
        data.registeredUserId, data.registeredUserId, data.songId
      ];

      const { rows: existing } = await executeQuery(existingQuery, existingParams);
      if (existing.length > 0) {
        throw new Error('Favorite already exists for this user and song');
      }

      await executeQuery(
        `INSERT INTO favorites (
          id, user_id, registered_user_id, song_id, restaurant_id, favorite_type, notes, play_count, last_played_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          favoriteId, data.userId || null, data.registeredUserId || null,
          data.songId, data.restaurantId, data.favoriteType || 'session',
          data.notes || null, 0, null
        ]
      );

      return await Favorite.findById(favoriteId);
    } catch (error) {
      throw new Error(`Error creating favorite: ${error.message}`);
    }
  }

  // Obtener favoritos por usuario temporal
  static async getByUser(userId, restaurantId = null, limit = 50) {
    try {
      let query = `
        SELECT f.*, s.title, s.artist, s.image, s.genre
        FROM favorites f
        JOIN songs s ON f.song_id = s.id
        WHERE f.user_id = ? AND f.favorite_type = 'session'
      `;
      let params = [userId];

      if (restaurantId) {
        query += ' AND f.restaurant_id = ?';
        params.push(restaurantId);
      }

      query += ' ORDER BY f.created_at DESC LIMIT ?';
      params.push(limit);

      const { rows } = await executeQuery(query, params);

      return rows.map(row => {
        row.song = { title: row.title, artist: row.artist, image: row.image, genre: row.genre };
        return new Favorite(row);
      });
    } catch (error) {
      throw new Error(`Error getting user favorites: ${error.message}`);
    }
  }

  // Obtener favoritos por usuario registrado
  static async getByRegisteredUser(registeredUserId, limit = 50) {
    try {
      const { rows } = await executeQuery(
        `SELECT f.*, s.title, s.artist, s.image, s.genre
         FROM favorites f
         JOIN songs s ON f.song_id = s.id
         WHERE f.registered_user_id = ? AND f.favorite_type = 'permanent'
         ORDER BY f.created_at DESC
         LIMIT ?`,
        [registeredUserId, limit]
      );

      return rows.map(row => {
        row.song = { title: row.title, artist: row.artist, image: row.image, genre: row.genre };
        return new Favorite(row);
      });
    } catch (error) {
      throw new Error(`Error getting registered user favorites: ${error.message}`);
    }
  }

  // Eliminar favorito
  static async deleteByUserAndSong(userId, songId, isRegistered = false) {
    try {
      const field = isRegistered ? 'registered_user_id' : 'user_id';
      await executeQuery(
        `DELETE FROM favorites WHERE ${field} = ? AND song_id = ?`,
        [userId || registeredUserId, songId]
      );
      return true;
    } catch (error) {
      throw new Error(`Error deleting favorite: ${error.message}`);
    }
  }

  // Incrementar play count
  async incrementPlayCount() {
    try {
      await executeQuery(
        'UPDATE favorites SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id = ?',
        [this.id]
      );

      this.playCount += 1;
      this.lastPlayedAt = new Date();
      return this;
    } catch (error) {
      throw new Error(`Error incrementing play count: ${error.message}`);
    }
  }

  // Verificar si es permanente
  isPermanent() {
    return this.favoriteType === 'permanent';
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      registeredUserId: this.registeredUserId,
      songId: this.songId,
      restaurantId: this.restaurantId,
      favoriteType: this.favoriteType,
      notes: this.notes,
      playCount: this.playCount,
      lastPlayedAt: this.lastPlayedAt,
      song: this.song ? this.song.toJSON() : null,
      user: this.user ? this.user.toJSON() : null,
      createdAt: this.createdAt
    };
  }
}

module.exports = Favorite;