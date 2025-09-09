// src/controllers/songController.js
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse, paginate, calculatePagination } = require('../utils/helpers');

// Obtener todas las canciones de un restaurante
const getSongs = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { genre, search, page = 1, limit = 20 } = req.query;
    
    // Obtener información de paginación
    const { page: currentPage, limit: currentLimit, offset } = paginate(page, limit);
    
    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id, name FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );
    
    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found or inactive')
      );
    }
    
    const restaurant = restaurantRows[0];
    
    // Construir query base
    let query = `
      SELECT id, title, artist, album, duration, year, image, genre, 
             popularity, energy, is_explicit, times_requested
      FROM songs 
      WHERE restaurant_id = ? AND is_active = true
    `;
    let params = [restaurant.id];
    
    // Filtros adicionales
    if (genre && genre !== 'all') {
      query += ' AND genre = ?';
      params.push(genre);
    }
    
    if (search) {
      query += ' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Contar total de resultados
    const countQuery = query.replace(
      'SELECT id, title, artist, album, duration, year, image, genre, popularity, energy, is_explicit, times_requested',
      'SELECT COUNT(*) as total'
    );
    
    const { rows: countRows } = await executeQuery(countQuery, params);
    const total = countRows[0].total;
    
    // Agregar paginación y ordenamiento
    query += ' ORDER BY popularity DESC, times_requested DESC LIMIT ? OFFSET ?';
    params.push(currentLimit, offset);
    
    const { rows: songs } = await executeQuery(query, params);
    
    // Calcular paginación
    const pagination = calculatePagination(total, currentPage, currentLimit);
    
    res.json(formatSuccessResponse('Songs retrieved successfully', {
      songs,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurantSlug
      },
      pagination,
      filters: {
        genre: genre || 'all',
        search: search || ''
      }
    }));
    
  } catch (error) {
    logger.error('Get songs error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to retrieve songs', error.message)
    );
  }
};

// Buscar canciones
const searchSongs = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { q: query, genre, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json(
        formatErrorResponse('Search query must be at least 2 characters')
      );
    }
    
    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );
    
    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }
    
    const restaurant = restaurantRows[0];
    
    // Query de búsqueda
    let searchQuery = `
      SELECT id, title, artist, album, duration, year, image, genre, 
             popularity, energy, times_requested,
             MATCH(title, artist, album) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
      FROM songs 
      WHERE restaurant_id = ? AND is_active = true
      AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)
    `;
    
    const searchTerm = `%${query.trim()}%`;
    let params = [query, restaurant.id, searchTerm, searchTerm, searchTerm];
    
    // Filtro de género
    if (genre && genre !== 'all') {
      searchQuery += ' AND genre = ?';
      params.push(genre);
    }
    
    searchQuery += ' ORDER BY relevance DESC, popularity DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const { rows: songs } = await executeQuery(searchQuery, params);
    
    res.json(formatSuccessResponse('Search completed', {
      songs,
      query,
      total: songs.length
    }));
    
  } catch (error) {
    logger.error('Search songs error:', error.message);
    res.status(500).json(
      formatErrorResponse('Search failed', error.message)
    );
  }
};

// Obtener canciones populares
const getPopularSongs = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { limit = 10 } = req.query;
    
    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );
    
    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }
    
    const restaurant = restaurantRows[0];
    
    // Obtener canciones populares
    const { rows: songs } = await executeQuery(
      `SELECT id, title, artist, album, duration, year, image, genre, 
              popularity, energy, times_requested
       FROM songs 
       WHERE restaurant_id = ? AND is_active = true
       ORDER BY popularity DESC, times_requested DESC 
       LIMIT ?`,
      [restaurant.id, parseInt(limit)]
    );
    
    res.json(formatSuccessResponse('Popular songs retrieved', {
      songs
    }));
    
  } catch (error) {
    logger.error('Get popular songs error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get popular songs', error.message)
    );
  }
};

// Obtener canciones por género
const getSongsByGenre = async (req, res) => {
  try {
    const { restaurantSlug, genre } = req.params;
    const { limit = 20 } = req.query;
    
    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );
    
    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }
    
    const restaurant = restaurantRows[0];
    
    // Obtener canciones del género
    const { rows: songs } = await executeQuery(
      `SELECT id, title, artist, album, duration, year, image, genre, 
              popularity, energy, times_requested
       FROM songs 
       WHERE restaurant_id = ? AND genre = ? AND is_active = true
       ORDER BY popularity DESC, times_requested DESC 
       LIMIT ?`,
      [restaurant.id, genre, parseInt(limit)]
    );
    
    res.json(formatSuccessResponse(`${genre} songs retrieved`, {
      songs,
      genre,
      total: songs.length
    }));
    
  } catch (error) {
    logger.error('Get songs by genre error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get songs by genre', error.message)
    );
  }
};

// Obtener detalles de una canción
const getSongDetails = async (req, res) => {
  try {
    const { restaurantSlug, songId } = req.params;
    
    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );
    
    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }
    
    const restaurant = restaurantRows[0];
    
    // Buscar canción
    const { rows: songRows } = await executeQuery(
      `SELECT id, title, artist, album, duration, year, spotify_id, 
              preview_url, image, genre, popularity, energy, is_explicit, 
              times_requested, created_at
       FROM songs 
       WHERE id = ? AND restaurant_id = ? AND is_active = true`,
      [songId, restaurant.id]
    );
    
    if (songRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Song not found')
      );
    }
    
    const song = songRows[0];
    
    // Obtener estadísticas adicionales
    const { rows: statsRows } = await executeQuery(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
        AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100 as completion_rate
       FROM requests 
       WHERE song_id = ?`,
      [songId]
    );
    
    res.json(formatSuccessResponse('Song details retrieved', {
      song: {
        ...song,
        stats: statsRows[0] || {}
      }
    }));
    
  } catch (error) {
    logger.error('Get song details error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get song details', error.message)
    );
  }
};

// Obtener géneros disponibles
const getGenres = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    
    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );
    
    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found')
      );
    }
    
    const restaurant = restaurantRows[0];
    
    // Obtener géneros únicos con conteo
    const { rows: genres } = await executeQuery(
      `SELECT genre, COUNT(*) as count
       FROM songs 
       WHERE restaurant_id = ? AND is_active = true
       GROUP BY genre 
       ORDER BY count DESC, genre ASC`,
      [restaurant.id]
    );
    
    res.json(formatSuccessResponse('Genres retrieved', {
      genres
    }));
    
  } catch (error) {
    logger.error('Get genres error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get genres', error.message)
    );
  }
};

module.exports = {
  getSongs,
  searchSongs,
  getPopularSongs,
  getSongsByGenre,
  getSongDetails,
  getGenres
};