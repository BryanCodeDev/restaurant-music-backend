// src/models/Request.js - Modelo para peticiones de canciones
const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Song = require('./Song');
const { User } = require('./User');

class Request {
  constructor(data) {
    this.id = data.id;
    this.restaurantId = data.restaurant_id;
    this.userId = data.user_id;
    this.songId = data.song_id;
    this.status = data.status;
    this.queuePosition = data.queue_position;
    this.userTable = data.user_table;
    this.requestedAt = data.requested_at;
    this.startedPlayingAt = data.started_playing_at;
    this.completedAt = data.completed_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.song = data.song ? new Song(data.song) : null;
    this.user = data.user ? new User(data.user) : null;
  }

  // Buscar petición por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT r.*, s.title as song_title, s.artist as song_artist, s.duration as song_duration,
                s.image as song_image, u.table_number as user_table, u.name as user_name,
                u.user_type as user_type
         FROM requests r
         LEFT JOIN songs s ON r.song_id = s.id
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.id = ?`,
        [id]
      );

      if (rows.length > 0) {
        const row = rows[0];
        row.song = { title: row.song_title, artist: row.song_artist, duration: row.song_duration, image: row.song_image };
        row.user = { table_number: row.user_table, name: row.user_name, user_type: row.user_type };
        return new Request(row);
      }
      return null;
    } catch (error) {
      throw new Error(`Error finding request by ID: ${error.message}`);
    }
  }

  // Crear nueva petición
  static async create(data) {
    try {
      const requestId = data.id || uuidv4();

      await executeQuery(
        `INSERT INTO requests (
          id, restaurant_id, user_id, song_id, status, queue_position, user_table,
          requested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId, data.restaurantId, data.userId, data.songId,
          data.status || 'pending', data.queuePosition || 0, data.userTable,
          data.requestedAt || new Date()
        ]
      );

      return await Request.findById(requestId);
    } catch (error) {
      throw new Error(`Error creating request: ${error.message}`);
    }
  }

  // Obtener peticiones activas por restaurante
  static async getActiveRequests(restaurantId, limit = 50) {
    try {
      const { rows } = await executeQuery(
        `SELECT r.*, s.title, s.artist, s.duration, s.image, s.genre,
                u.table_number, u.name as user_name, u.user_type
         FROM requests r
         JOIN songs s ON r.song_id = s.id
         JOIN users u ON r.user_id = u.id
         WHERE r.restaurant_id = ? AND r.status IN ('pending', 'playing')
         ORDER BY r.queue_position ASC, r.requested_at ASC
         LIMIT ?`,
        [restaurantId, limit]
      );

      return rows.map(row => {
        row.song = { title: row.title, artist: row.artist, duration: row.duration, image: row.image, genre: row.genre };
        row.user = { table_number: row.table_number, name: row.user_name, user_type: row.user_type };
        return new Request(row);
      });
    } catch (error) {
      throw new Error(`Error getting active requests: ${error.message}`);
    }
  }

  // Obtener peticiones por usuario
  static async getUserRequests(userId, status = null, limit = 20) {
    try {
      let query = `
        SELECT r.*, s.title, s.artist, s.image
        FROM requests r
        JOIN songs s ON r.song_id = s.id
        WHERE r.user_id = ?
      `;
      let params = [userId];

      if (status) {
        query += ' AND r.status = ?';
        params.push(status);
      }

      query += ' ORDER BY r.requested_at DESC LIMIT ?';
      params.push(limit);

      const { rows } = await executeQuery(query, params);

      return rows.map(row => {
        row.song = { title: row.title, artist: row.artist, image: row.image };
        return new Request(row);
      });
    } catch (error) {
      throw new Error(`Error getting user requests: ${error.message}`);
    }
  }

  // Actualizar estado de petición
  async updateStatus(newStatus, queuePosition = null) {
    try {
      let updateFields = ['status = ?'];
      let updateValues = [newStatus];

      if (queuePosition !== null && queuePosition !== this.queuePosition) {
        updateFields.push('queue_position = ?');
        updateValues.push(queuePosition);
      }

      if (newStatus === 'playing') {
        updateFields.push('started_playing_at = CURRENT_TIMESTAMP');
      } else if (newStatus === 'completed') {
        updateFields.push('completed_at = CURRENT_TIMESTAMP');
      }

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE requests SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      this.status = newStatus;
      if (queuePosition !== null) this.queuePosition = queuePosition;
      if (newStatus === 'playing') this.startedPlayingAt = new Date();
      if (newStatus === 'completed') this.completedAt = new Date();

      // Actualizar times_requested en song
      if (newStatus === 'completed') {
        await Song.findById(this.songId).incrementRequests();
      }

      return this;
    } catch (error) {
      throw new Error(`Error updating request status: ${error.message}`);
    }
  }

  // Actualizar posición en cola
  async updateQueuePosition(newPosition) {
    try {
      await executeQuery(
        'UPDATE requests SET queue_position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPosition, this.id]
      );

      this.queuePosition = newPosition;
      return this;
    } catch (error) {
      throw new Error(`Error updating queue position: ${error.message}`);
    }
  }

  // Cancelar petición
  async cancel() {
    return this.updateStatus('cancelled');
  }

  // Verificar si está en cola
  isPending() {
    return this.status === 'pending';
  }

  // Calcular tiempo en cola
  getWaitTime() {
    if (!this.requestedAt) return 0;
    const now = new Date();
    const requested = new Date(this.requestedAt);
    return Math.floor((now - requested) / 1000 / 60); // minutos
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      userId: this.userId,
      songId: this.songId,
      status: this.status,
      queuePosition: this.queuePosition,
      userTable: this.userTable,
      requestedAt: this.requestedAt,
      startedPlayingAt: this.startedPlayingAt,
      completedAt: this.completedAt,
      waitTimeMinutes: this.getWaitTime(),
      song: this.song ? this.song.toJSON() : null,
      user: this.user ? this.user.toJSON() : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Request;