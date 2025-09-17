// src/controllers/favoriteController.js - SIMPLIFICADO PARA USUARIOS AUTENTICADOS SOLAMENTE
const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

// Obtener favoritos de un usuario autenticado
const getUserFavorites = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar que el usuario existe y está autenticado (no es sesión temporal)
    const { rows: userRows } = await executeQuery(
      'SELECT id FROM users WHERE id = ? AND name IS NOT NULL AND email IS NOT NULL',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('User not found or not authenticated')
      );
    }

    const { rows } = await executeQuery(
      `SELECT f.id, f.created_at,
              s.id as song_id, s.title, s.artist, s.album, s.duration, 
              s.genre, s.image, s.year, s.popularity
       FROM favorites f
       JOIN songs s ON f.song_id = s.id
       WHERE f.user_id = ? AND s.is_active = true
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json(formatSuccessResponse('Favorites retrieved', {
      favorites: rows,
      total: rows.length
    }));

  } catch (error) {
    logger.error('Get user favorites error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get favorites', error.message)
    );
  }
};

// Toggle favorito - SOLO PARA USUARIOS AUTENTICADOS
const toggleFavorite = async (req, res) => {
  try {
    const { userId, songId } = req.body;

    logger.info('Toggle favorite request received:', {
      userId,
      songId,
      ip: req.ip
    });

    // Validar parámetros requeridos
    if (!userId || !songId) {
      return res.status(400).json(
        formatErrorResponse('User ID and Song ID are required')
      );
    }

    // NUEVO: Verificar que el usuario está REALMENTE autenticado (no es sesión temporal)
    const { rows: userRows } = await executeQuery(
      'SELECT id, restaurant_id FROM users WHERE id = ? AND name IS NOT NULL AND email IS NOT NULL',
      [userId]
    );

    if (userRows.length === 0) {
      logger.warn('Unauthorized favorite attempt - user not authenticated:', userId);
      return res.status(401).json(
        formatErrorResponse('Authentication required', 'Para guardar favoritos necesitas crear una cuenta e iniciar sesión')
      );
    }

    const user = userRows[0];

    // Verificar que la canción existe
    const { rows: songRows } = await executeQuery(
      'SELECT id, restaurant_id, title, artist FROM songs WHERE id = ? AND is_active = true',
      [songId]
    );

    if (songRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Song not found or inactive')
      );
    }

    const song = songRows[0];

    // Verificar si ya existe el favorito
    const { rows: existingRows } = await executeQuery(
      'SELECT id FROM favorites WHERE user_id = ? AND song_id = ?',
      [userId, songId]
    );

    if (existingRows.length > 0) {
      // Eliminar favorito
      await executeQuery(
        'DELETE FROM favorites WHERE user_id = ? AND song_id = ?',
        [userId, songId]
      );

      logger.info(`Favorite removed: ${song.title} by ${song.artist}`);

      res.json(formatSuccessResponse('Removed from favorites', {
        added: false,
        favoriteId: existingRows[0].id,
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist
        }
      }));

    } else {
      // Agregar favorito
      const favoriteId = uuidv4();
      
      await executeQuery(
        'INSERT INTO favorites (id, user_id, song_id, restaurant_id) VALUES (?, ?, ?, ?)',
        [favoriteId, userId, songId, song.restaurant_id]
      );

      logger.info(`Favorite added: ${song.title} by ${song.artist}`);

      res.json(formatSuccessResponse('Added to favorites', {
        added: true,
        favoriteId,
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist
        }
      }));
    }

  } catch (error) {
    logger.error('Toggle favorite error:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json(
      formatErrorResponse('Failed to toggle favorite', 
        process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      )
    );
  }
};

// Limpiar todos los favoritos de un usuario
const clearAllFavorites = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar autenticación
    const { rows: userRows } = await executeQuery(
      'SELECT id FROM users WHERE id = ? AND name IS NOT NULL AND email IS NOT NULL',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(401).json(
        formatErrorResponse('Authentication required')
      );
    }

    // Obtener conteo antes de eliminar
    const { rows: countRows } = await executeQuery(
      'SELECT COUNT(*) as count FROM favorites WHERE user_id = ?',
      [userId]
    );

    const deletedCount = countRows[0].count;

    // Eliminar todos los favoritos del usuario
    await executeQuery(
      'DELETE FROM favorites WHERE user_id = ?',
      [userId]
    );

    logger.info(`All favorites cleared for user: ${userId}, count: ${deletedCount}`);

    res.json(formatSuccessResponse('All favorites cleared', {
      deletedCount
    }));

  } catch (error) {
    logger.error('Clear all favorites error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to clear favorites', error.message)
    );
  }
};

module.exports = {
  getUserFavorites,
  toggleFavorite,
  clearAllFavorites
};