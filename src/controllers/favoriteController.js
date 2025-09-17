// src/controllers/favoriteController.js - ACTUALIZADO PARA NUEVO ESQUEMA CON FAVORITE MODEL
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');
const Favorite = require('../models/Favorite');
const { User, RegisteredUser } = require('../models/User');
const Song = require('../models/Song');

// Obtener favoritos de un usuario (temporal o registrado)
const getUserFavorites = async (req, res) => {
  try {
    const { userId } = req.params;
    const userType = req.user.type; // 'user' for temporary, 'registered_user' for permanent

    let favorites = [];
    let total = 0;

    if (userType === 'registered_user') {
      const regUser = await RegisteredUser.findById(userId);
      if (!regUser) {
        return res.status(404).json(
          formatErrorResponse('Registered user not found')
        );
      }
      favorites = await Favorite.getByRegisteredUser(userId);
      total = favorites.length;
    } else if (userType === 'user') {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json(
          formatErrorResponse('User session not found')
        );
      }
      favorites = await Favorite.getByUser(userId, req.user.restaurantId);
      total = favorites.length;
    } else {
      return res.status(401).json(
        formatErrorResponse('Invalid user type')
      );
    }

    res.json(formatSuccessResponse('Favorites retrieved', {
      favorites: favorites.map(fav => fav.toJSON()),
      total
    }));

  } catch (error) {
    logger.error('Get user favorites error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get favorites', error.message)
    );
  }
};

// Toggle favorito - Soporte para temporales y registrados
const toggleFavorite = async (req, res) => {
  try {
    const { songId } = req.body;
    const userId = req.user.id;
    const userType = req.user.type; // 'user' or 'registered_user'
    const restaurantId = req.user.restaurantId || null;

    logger.info('Toggle favorite request received:', {
      userId,
      songId,
      userType,
      ip: req.ip
    });

    // Validar parámetros
    if (!songId) {
      return res.status(400).json(
        formatErrorResponse('Song ID is required')
      );
    }

    let song;
    try {
      song = await Song.findById(songId);
      if (!song || !song.isActive) {
        return res.status(404).json(
          formatErrorResponse('Song not found or inactive')
        );
      }
    } catch (error) {
      return res.status(404).json(
        formatErrorResponse('Song not found')
      );
    }

    let favoriteType = userType === 'registered_user' ? 'permanent' : 'session';
    let existingFavorite = null;

    if (userType === 'registered_user') {
      existingFavorite = await Favorite.findByIdByRegisteredUserAndSong(userId, songId);
    } else {
      existingFavorite = await Favorite.findByIdByUserAndSong(userId, songId);
    }

    if (existingFavorite) {
      // Eliminar
      if (userType === 'registered_user') {
        await Favorite.deleteByRegisteredUserAndSong(userId, songId);
      } else {
        await Favorite.deleteByUserAndSong(userId, songId);
      }

      logger.info(`Favorite removed: ${song.title} by ${song.artist} (${favoriteType})`);

      res.json(formatSuccessResponse('Removed from favorites', {
        added: false,
        favoriteId: existingFavorite.id,
        song: song.toJSON()
      }));

    } else {
      // Agregar
      const favorite = await Favorite.create({
        userId: userType === 'user' ? userId : null,
        registeredUserId: userType === 'registered_user' ? userId : null,
        songId,
        restaurantId: song.restaurantId,
        favoriteType,
        notes: null
      });

      logger.info(`Favorite added: ${song.title} by ${song.artist} (${favoriteType})`);

      res.json(formatSuccessResponse('Added to favorites', {
        added: true,
        favorite: favorite.toJSON(),
        song: song.toJSON()
      }));
    }

  } catch (error) {
    logger.error('Toggle favorite error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      user: req.user
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
    const userId = req.user.id;
    const userType = req.user.type;

    let deletedCount = 0;

    if (userType === 'registered_user') {
      deletedCount = await Favorite.deleteByRegisteredUser(userId);
      logger.info(`All permanent favorites cleared for registered user: ${userId}, count: ${deletedCount}`);
    } else if (userType === 'user') {
      deletedCount = await Favorite.deleteByUser(userId);
      logger.info(`All session favorites cleared for user: ${userId}, count: ${deletedCount}`);
    } else {
      return res.status(401).json(
        formatErrorResponse('Invalid user type')
      );
    }

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