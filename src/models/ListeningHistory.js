// src/models/ListeningHistory.js - Modelo para historial de reproducción
const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Song = require('./Song');

class ListeningHistory {
  constructor(data) {
    this.id = data.id;
    this.registeredUserId = data.registered_user_id;
    this.songId = data.song_id;
    this.restaurantId = data.restaurant_id;
    this.playedAt = data.played_at;
    this.playDuration = data.play_duration;
    this.wasCompleted = data.was_completed;
    this.deviceInfo = data.device_info ? JSON.parse(data.device_info) : {};
    this.createdAt = data.created_at;
    this.song = data.song ? new Song(data.song) : null;
  }

  // Agregar entrada al historial
  static async create(data) {
    try {
      const historyId = data.id || uuidv4();

      await executeQuery(
        `INSERT INTO listening_history (
          id, registered_user_id, song_id, restaurant_id, played_at, play_duration,
          was_completed, device_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyId, data.registeredUserId, data.songId, data.restaurantId,
          data.playedAt || new Date(), data.playDuration || null,
          data.wasCompleted || false, JSON.stringify(data.deviceInfo || {})
        ]
      );

      return await ListeningHistory.findById(historyId);
    } catch (error) {
      throw new Error(`Error creating listening history entry: ${error.message}`);
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT lh.*, s.title, s.artist
         FROM listening_history lh
         LEFT JOIN songs s ON lh.song_id = s.id
         WHERE lh.id = ?`,
        [id]
      );

      if (rows.length > 0) {
        const row = rows[0];
        row.song = { title: row.title, artist: row.artist };
        return new ListeningHistory(row);
      }
      return null;
    } catch (error) {
      throw new Error(`Error finding listening history by ID: ${error.message}`);
    }
  }

  // Obtener historial por usuario (últimos N)
  static async getByUser(registeredUserId, limit = 50, startDate = null) {
    try {
      let query = `
        SELECT lh.*, s.title, s.artist, s.image, s.genre
        FROM listening_history lh
        LEFT JOIN songs s ON lh.song_id = s.id
        WHERE lh.registered_user_id = ?
      `;
      let params = [registeredUserId];

      if (startDate) {
        query += ' AND lh.played_at >= ?';
        params.push(startDate);
      }

      query += ' ORDER BY lh.played_at DESC LIMIT ?';
      params.push(limit);

      const { rows } = await executeQuery(query, params);

      return rows.map(row => {
        row.song = { title: row.title, artist: row.artist, image: row.image, genre: row.genre };
        return new ListeningHistory(row);
      });
    } catch (error) {
      throw new Error(`Error getting user listening history: ${error.message}`);
    }
  }

  // Obtener estadísticas de escucha (e.g., top songs)
  static async getTopSongs(registeredUserId, limit = 10) {
    try {
      const { rows } = await executeQuery(
        `SELECT song_id, COUNT(*) as play_count, AVG(play_duration) as avg_duration
         FROM listening_history 
         WHERE registered_user_id = ?
         GROUP BY song_id
         ORDER BY play_count DESC
         LIMIT ?`,
        [registeredUserId, limit]
      );

      // Enriquecer con info de song si necesario
      for (let row of rows) {
        const song = await Song.findById(row.song_id);
        row.song = song ? song.toJSON() : null;
      }

      return rows;
    } catch (error) {
      throw new Error(`Error getting top songs: ${error.message}`);
    }
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      registeredUserId: this.registeredUserId,
      songId: this.songId,
      restaurantId: this.restaurantId,
      playedAt: this.playedAt,
      playDuration: this.playDuration,
      wasCompleted: this.wasCompleted,
      deviceInfo: this.deviceInfo,
      song: this.song ? this.song.toJSON() : null,
      createdAt: this.createdAt
    };
  }
}

module.exports = ListeningHistory;