// src/models/Song.js
const { executeQuery } = require('../config/database');

class Song {
  constructor(data) {
    this.id = data.id;
    this.restaurantId = data.restaurant_id;
    this.title = data.title;
    this.artist = data.artist;
    this.album = data.album;
    this.duration = data.duration;
    this.year = data.year;
    this.spotifyId = data.spotify_id;
    this.previewUrl = data.preview_url;
    this.image = data.image;
    this.genre = data.genre;
    this.popularity = data.popularity;
    this.energy = data.energy;
    this.isExplicit = data.is_explicit;
    this.isActive = data.is_active;
    this.timesRequested = data.times_requested;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Buscar canción por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        'SELECT * FROM songs WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? new Song(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding song by ID: ${error.message}`);
    }
  }

  // Buscar canciones por restaurante
  static async findByRestaurant(restaurantId, filters = {}) {
    try {
      let query = 'SELECT * FROM songs WHERE restaurant_id = ? AND is_active = true';
      let params = [restaurantId];

      // Filtros adicionales
      if (filters.genre && filters.genre !== 'all') {
        query += ' AND genre = ?';
        params.push(filters.genre);
      }

      if (filters.search) {
        query += ' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (filters.year) {
        query += ' AND year = ?';
        params.push(filters.year);
      }

      if (filters.minPopularity) {
        query += ' AND popularity >= ?';
        params.push(filters.minPopularity);
      }

      // Ordenamiento
      const orderBy = filters.orderBy || 'popularity';
      const orderDirection = filters.orderDirection || 'DESC';
      query += ` ORDER BY ${orderBy} ${orderDirection}`;

      // Paginación
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
        
        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(parseInt(filters.offset));
        }
      }

      const { rows } = await executeQuery(query, params);
      return rows.map(row => new Song(row));
    } catch (error) {
      throw new Error(`Error finding songs by restaurant: ${error.message}`);
    }
  }

  // Buscar canciones por género
  static async findByGenre(restaurantId, genre, limit = 20) {
    try {
      const { rows } = await executeQuery(
        `SELECT * FROM songs 
         WHERE restaurant_id = ? AND genre = ? AND is_active = true
         ORDER BY popularity DESC, times_requested DESC
         LIMIT ?`,
        [restaurantId, genre, limit]
      );

      return rows.map(row => new Song(row));
    } catch (error) {
      throw new Error(`Error finding songs by genre: ${error.message}`);
    }
  }

  // Buscar canciones populares
  static async findPopular(restaurantId, limit = 10) {
    try {
      const { rows } = await executeQuery(
        `SELECT * FROM songs 
         WHERE restaurant_id = ? AND is_active = true
         ORDER BY popularity DESC, times_requested DESC
         LIMIT ?`,
        [restaurantId, limit]
      );

      return rows.map(row => new Song(row));
    } catch (error) {
      throw new Error(`Error finding popular songs: ${error.message}`);
    }
  }

  // Búsqueda de texto completo
  static async search(restaurantId, query, filters = {}) {
    try {
      let searchQuery = `
        SELECT *, 
        MATCH(title, artist, album) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
        FROM songs 
        WHERE restaurant_id = ? AND is_active = true
        AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)
      `;
      
      const searchTerm = `%${query}%`;
      let params = [query, restaurantId, searchTerm, searchTerm, searchTerm];

      // Filtros adicionales
      if (filters.genre && filters.genre !== 'all') {
        searchQuery += ' AND genre = ?';
        params.push(filters.genre);
      }

      if (filters.year) {
        searchQuery += ' AND year = ?';
        params.push(filters.year);
      }

      searchQuery += ' ORDER BY relevance DESC, popularity DESC';

      if (filters.limit) {
        searchQuery += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      const { rows } = await executeQuery(searchQuery, params);
      return rows.map(row => new Song(row));
    } catch (error) {
      throw new Error(`Error searching songs: ${error.message}`);
    }
  }

  // Crear nueva canción
  static async create(data) {
    try {
      const songData = {
        id: data.id,
        restaurant_id: data.restaurantId,
        title: data.title,
        artist: data.artist,
        album: data.album || null,
        duration: data.duration,
        year: data.year || null,
        spotify_id: data.spotifyId || null,
        preview_url: data.previewUrl || null,
        image: data.image || null,
        genre: data.genre,
        popularity: data.popularity || 0,
        energy: data.energy || 0,
        is_explicit: data.isExplicit || false,
        is_active: true,
        times_requested: 0
      };

      await executeQuery(
        `INSERT INTO songs 
         (id, restaurant_id, title, artist, album, duration, year, 
          spotify_id, preview_url, image, genre, popularity, energy, 
          is_explicit, is_active, times_requested)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          songData.id, songData.restaurant_id, songData.title, songData.artist,
          songData.album, songData.duration, songData.year, songData.spotify_id,
          songData.preview_url, songData.image, songData.genre, songData.popularity,
          songData.energy, songData.is_explicit, songData.is_active, songData.times_requested
        ]
      );

      return await Song.findById(songData.id);
    } catch (error) {
      throw new Error(`Error creating song: ${error.message}`);
    }
  }

  // Actualizar canción
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      // Mapear campos de camelCase a snake_case
      const fieldMap = {
        title: 'title',
        artist: 'artist',
        album: 'album',
        duration: 'duration',
        year: 'year',
        spotifyId: 'spotify_id',
        previewUrl: 'preview_url',
        image: 'image',
        genre: 'genre',
        popularity: 'popularity',
        energy: 'energy',
        isExplicit: 'is_explicit',
        isActive: 'is_active'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          updateValues.push(data[key]);
        }
      });

      if (updateFields.length === 0) {
        return this;
      }

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE songs SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      // Recargar datos actualizados
      const updated = await Song.findById(this.id);
      Object.assign(this, updated);
      
      return this;
    } catch (error) {
      throw new Error(`Error updating song: ${error.message}`);
    }
  }

  // Incrementar contador de peticiones
  async incrementRequests() {
    try {
      await executeQuery(
        'UPDATE songs SET times_requested = times_requested + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [this.id]
      );

      this.timesRequested += 1;
      return this;
    } catch (error) {
      throw new Error(`Error incrementing song requests: ${error.message}`);
    }
  }

  // Obtener estadísticas de la canción
  async getStats() {
    try {
      const { rows } = await executeQuery(
        `SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100 as completion_rate,
          (SELECT COUNT(*) FROM favorites WHERE song_id = ?) as favorite_count
         FROM requests 
         WHERE song_id = ?`,
        [this.id, this.id]
      );

      return rows[0] || {};
    } catch (error) {
      throw new Error(`Error getting song stats: ${error.message}`);
    }
  }

  // Obtener peticiones recientes de la canción
  async getRecentRequests(limit = 10) {
    try {
      const { rows } = await executeQuery(
        `SELECT r.*, u.table_number
         FROM requests r
         JOIN users u ON r.user_id = u.id
         WHERE r.song_id = ?
         ORDER BY r.created_at DESC
         LIMIT ?`,
        [this.id, limit]
      );

      return rows;
    } catch (error) {
      throw new Error(`Error getting recent requests: ${error.message}`);
    }
  }

  // Verificar si la canción está disponible
  isAvailable() {
    return this.isActive;
  }

  // Obtener duración en segundos
  getDurationInSeconds() {
    if (!this.duration) return 0;
    
    const parts = this.duration.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    
    return 0;
  }

  // Eliminar canción (soft delete)
  async delete() {
    try {
      await executeQuery(
        'UPDATE songs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [this.id]
      );

      this.isActive = false;
      return this;
    } catch (error) {
      throw new Error(`Error deleting song: ${error.message}`);
    }
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      title: this.title,
      artist: this.artist,
      album: this.album,
      duration: this.duration,
      year: this.year,
      spotifyId: this.spotifyId,
      previewUrl: this.previewUrl,
      image: this.image,
      genre: this.genre,
      popularity: this.popularity,
      energy: this.energy,
      isExplicit: this.isExplicit,
      isActive: this.isActive,
      timesRequested: this.timesRequested,
      durationInSeconds: this.getDurationInSeconds(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Song;