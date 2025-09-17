// src/models/Playlist.js - Modelo para playlists y canciones en playlists
const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Song = require('./Song');
const { RegisteredUser } = require('./User');

class Playlist {
  constructor(data) {
    this.id = data.id;
    this.registeredUserId = data.registered_user_id;
    this.name = data.name;
    this.description = data.description;
    this.coverImage = data.cover_image;
    this.isPublic = data.is_public;
    this.isCollaborative = data.is_collaborative;
    this.playCount = data.play_count;
    this.songCount = data.song_count;
    this.totalDuration = data.total_duration;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.user = data.user ? new RegisteredUser(data.user) : null;
  }

  // Crear nueva playlist
  static async create(data) {
    try {
      const playlistId = data.id || uuidv4();

      await executeQuery(
        `INSERT INTO playlists (
          id, registered_user_id, name, description, cover_image, is_public,
          is_collaborative, play_count, song_count, total_duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          playlistId, data.registeredUserId, data.name, data.description || null,
          data.coverImage || null, data.isPublic || false, data.isCollaborative || false,
          0, 0, 0
        ]
      );

      return await Playlist.findById(playlistId);
    } catch (error) {
      throw new Error(`Error creating playlist: ${error.message}`);
    }
  }

  // Buscar por ID
  static async findById(id, includeSongs = false) {
    try {
      let query = `
        SELECT p.*, ru.name as user_name, ru.avatar as user_avatar
        FROM playlists p
        LEFT JOIN registered_users ru ON p.registered_user_id = ru.id
        WHERE p.id = ?
      `;
      const params = [id];

      const { rows } = await executeQuery(query, params);

      if (rows.length > 0) {
        const row = rows[0];
        row.user = { name: row.user_name, avatar: row.user_avatar };
        const playlist = new Playlist(row);

        if (includeSongs) {
          playlist.songs = await PlaylistSong.getByPlaylist(playlistId, true);
        }

        return playlist;
      }
      return null;
    } catch (error) {
      throw new Error(`Error finding playlist by ID: ${error.message}`);
    }
  }

  // Obtener playlists por usuario
  static async getByUser(registeredUserId, publicOnly = false, limit = 20) {
    try {
      let query = `
        SELECT p.*, COUNT(ps.id) as song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      `;
      const params = [registeredUserId];

      query += ' WHERE p.registered_user_id = ?';
      if (publicOnly) {
        query += ' AND p.is_public = true';
      }
      query += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ?';
      params.push(limit);

      const { rows } = await executeQuery(query, params);

      return rows.map(row => new Playlist(row));
    } catch (error) {
      throw new Error(`Error getting user playlists: ${error.message}`);
    }
  }

  // Actualizar playlist
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      const fieldMap = {
        name: 'name',
        description: 'description',
        coverImage: 'cover_image',
        isPublic: 'is_public',
        isCollaborative: 'is_collaborative'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          updateValues.push(data[key]);
        }
      });

      if (updateFields.length === 0) return this;

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE playlists SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      const updated = await Playlist.findById(this.id);
      Object.assign(this, updated);
      return this;
    } catch (error) {
      throw new Error(`Error updating playlist: ${error.message}`);
    }
  }

  // Obtener canciones de la playlist (ordenadas por position)
  async getSongs() {
    return await PlaylistSong.getByPlaylist(this.id, true);
  }

  // Agregar canción a playlist
  async addSong(songId, position = null, addedBy = this.registeredUserId) {
    try {
      // Encontrar posición si no especificada (al final)
      if (position === null) {
        const { rows } = await executeQuery(
          'SELECT MAX(position) as max_pos FROM playlist_songs WHERE playlist_id = ?',
          [this.id]
        );
        position = (rows[0]?.max_pos || 0) + 1;
      }

      // Reordenar posiciones si necesario
      await executeQuery(
        'UPDATE playlist_songs SET position = position + 1 WHERE playlist_id = ? AND position >= ?',
        [this.id, position]
      );

      const playlistSong = await PlaylistSong.create({
        playlistId: this.id,
        songId,
        position,
        addedBy
      });

      // Actualizar song_count y total_duration
      await this.updateStats();

      return playlistSong;
    } catch (error) {
      throw new Error(`Error adding song to playlist: ${error.message}`);
    }
  }

  // Actualizar estadísticas de playlist
  async updateStats() {
    try {
      const { rows } = await executeQuery(
        `SELECT COUNT(*) as song_count, SUM(s.duration_in_seconds) as total_duration
         FROM playlist_songs ps
         LEFT JOIN songs s ON ps.song_id = s.id
         WHERE ps.playlist_id = ?`,
        [this.id]
      );

      const { song_count, total_duration } = rows[0];

      await executeQuery(
        'UPDATE playlists SET song_count = ?, total_duration = ? WHERE id = ?',
        [song_count, total_duration || 0, this.id]
      );

      this.songCount = song_count;
      this.totalDuration = total_duration || 0;
      return this;
    } catch (error) {
      throw new Error(`Error updating playlist stats: ${error.message}`);
    }
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      registeredUserId: this.registeredUserId,
      name: this.name,
      description: this.description,
      coverImage: this.coverImage,
      isPublic: this.isPublic,
      isCollaborative: this.isCollaborative,
      playCount: this.playCount,
      songCount: this.songCount,
      totalDuration: this.totalDuration,
      user: this.user ? this.user.toJSON() : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class PlaylistSong {
  constructor(data) {
    this.id = data.id;
    this.playlistId = data.playlist_id;
    this.songId = data.song_id;
    this.position = data.position;
    this.addedBy = data.added_by;
    this.addedAt = data.added_at;
    this.song = data.song ? new Song(data.song) : null;
  }

  // Crear canción en playlist
  static async create(data) {
    try {
      const playlistSongId = data.id || uuidv4();

      await executeQuery(
        `INSERT INTO playlist_songs (
          id, playlist_id, song_id, position, added_by
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          playlistSongId, data.playlistId, data.songId, data.position,
          data.addedBy
        ]
      );

      return await PlaylistSong.findById(playlistSongId);
    } catch (error) {
      throw new Error(`Error creating playlist song: ${error.message}`);
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT ps.*, s.title, s.artist, s.image
         FROM playlist_songs ps
         LEFT JOIN songs s ON ps.song_id = s.id
         WHERE ps.id = ?`,
        [id]
      );

      if (rows.length > 0) {
        const row = rows[0];
        row.song = { title: row.title, artist: row.artist, image: row.image };
        return new PlaylistSong(row);
      }
      return null;
    } catch (error) {
      throw new Error(`Error finding playlist song by ID: ${error.message}`);
    }
  }

  // Obtener canciones por playlist (ordenadas)
  static async getByPlaylist(playlistId, includeFullSong = false) {
    try {
      let query = `
        SELECT ps.*, s.title, s.artist, s.duration, s.image
        FROM playlist_songs ps
        LEFT JOIN songs s ON ps.song_id = s.id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position ASC
      `;
      const params = [playlistId];

      const { rows } = await executeQuery(query, params);

      return rows.map(row => {
        const playlistSong = new PlaylistSong(row);
        if (includeFullSong) {
          playlistSong.song = new Song({ ...row, title: row.title, artist: row.artist, duration: row.duration, image: row.image });
        } else {
          playlistSong.song = { title: row.title, artist: row.artist, duration: row.duration, image: row.image };
        }
        return playlistSong;
      });
    } catch (error) {
      throw new Error(`Error getting playlist songs: ${error.message}`);
    }
  }

  // Reordenar canción
  async updatePosition(newPosition) {
    try {
      // Actualizar esta canción
      await executeQuery(
        'UPDATE playlist_songs SET position = ? WHERE id = ?',
        [newPosition, this.id]
      );

      // Reordenar otras
      const playlistId = this.playlistId;
      await executeQuery(
        'UPDATE playlist_songs SET position = position - 1 WHERE playlist_id = ? AND position > ?',
        [playlistId, this.position]
      );

      this.position = newPosition;
      return this;
    } catch (error) {
      throw new Error(`Error updating position: ${error.message}`);
    }
  }

  // Eliminar canción de playlist
  static async deleteById(id) {
    try {
      const { rows } = await executeQuery(
        'SELECT playlist_id, position FROM playlist_songs WHERE id = ?',
        [id]
      );

      if (rows.length > 0) {
        const { playlist_id, position } = rows[0];
        await executeQuery('DELETE FROM playlist_songs WHERE id = ?', [id]);

        // Reordenar restantes
        await executeQuery(
          'UPDATE playlist_songs SET position = position - 1 WHERE playlist_id = ? AND position > ?',
          [playlist_id, position]
        );

        // Actualizar stats de playlist
        const playlist = await Playlist.findById(playlist_id);
        await playlist.updateStats();

        return true;
      }
      return false;
    } catch (error) {
      throw new Error(`Error deleting playlist song: ${error.message}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      playlistId: this.playlistId,
      songId: this.songId,
      position: this.position,
      addedBy: this.addedBy,
      addedAt: this.addedAt,
      song: this.song ? this.song.toJSON() : null
    };
  }
}

module.exports = { Playlist, PlaylistSong };