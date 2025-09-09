// src/controllers/favoriteController.js
const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

// Obtener favoritos de un usuario
const getUserFavorites = async (req, res) => {
  try {
    const { userId } = req.params;

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

// Alternar favorito (agregar/quitar)
const toggleFavorite = async (req, res) => {
  try {
    const { userId, songId } = req.body;

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

      logger.info(`Favorite removed: user ${userId}, song ${songId}`);

      res.json(formatSuccessResponse('Removed from favorites', {
        added: false,
        favoriteId: existingRows[0].id
      }));

    } else {
      // Obtener información de la canción para validar y obtener restaurant_id
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

      // Agregar favorito
      const favoriteId = uuidv4();
      await executeQuery(
        'INSERT INTO favorites (id, user_id, song_id, restaurant_id) VALUES (?, ?, ?, ?)',
        [favoriteId, userId, songId, song.restaurant_id]
      );

      logger.info(`Favorite added: user ${userId}, song ${song.title}`);

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
    logger.error('Toggle favorite error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to toggle favorite', error.message)
    );
  }
};

// Limpiar todos los favoritos de un usuario
const clearAllFavorites = async (req, res) => {
  try {
    const { userId } = req.params;

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

// Obtener canciones favoritas por restaurante
const getFavoritesByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { limit = 10 } = req.query;

    const { rows } = await executeQuery(
      `SELECT s.id, s.title, s.artist, s.album, s.image, s.genre,
              COUNT(f.id) as favorite_count
       FROM songs s
       LEFT JOIN favorites f ON s.id = f.song_id
       WHERE s.restaurant_id = ? AND s.is_active = true
       GROUP BY s.id, s.title, s.artist, s.album, s.image, s.genre
       HAVING favorite_count > 0
       ORDER BY favorite_count DESC, s.popularity DESC
       LIMIT ?`,
      [restaurantId, parseInt(limit)]
    );

    res.json(formatSuccessResponse('Restaurant favorites retrieved', {
      favorites: rows,
      total: rows.length
    }));

  } catch (error) {
    logger.error('Get restaurant favorites error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get restaurant favorites', error.message)
    );
  }
};

module.exports = {
  getUserFavorites,
  toggleFavorite,
  clearAllFavorites,
  getFavoritesByRestaurant
};