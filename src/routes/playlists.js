// src/routes/playlists.js - Rutas para gestión de playlists
const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken, requireRegisteredUser } = require('../middleware/auth');
const playlistController = require('../controllers/playlistController');

const router = express.Router();

// ===== RUTAS PÚBLICAS =====

// Obtener playlists públicas (para descubrimiento)
router.get('/public',
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .withMessage('Offset must be a non-negative integer'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  validate,
  playlistController.getPublicPlaylists
);

// Obtener playlist por ID (puede ser pública o privada con autenticación)
router.get('/:id',
  param('id')
    .isUUID()
    .withMessage('Invalid playlist ID'),
  query('includeSongs')
    .optional()
    .isBoolean()
    .withMessage('includeSongs must be a boolean'),
  validate,
  playlistController.getPlaylistById
);

// ===== RUTAS PROTEGIDAS (USUARIOS REGISTRADOS) =====

// Crear nueva playlist
router.post('/',
  authenticateToken,
  requireRegisteredUser,
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Playlist name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('coverImage')
    .optional()
    .isURL()
    .withMessage('Cover image must be a valid URL'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('isCollaborative')
    .optional()
    .isBoolean()
    .withMessage('isCollaborative must be a boolean'),
  validate,
  playlistController.createPlaylist
);

// Obtener todas las playlists del usuario
router.get('/',
  authenticateToken,
  requireRegisteredUser,
  query('publicOnly')
    .optional()
    .isBoolean()
    .withMessage('publicOnly must be a boolean'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .withMessage('Offset must be a non-negative integer'),
  validate,
  playlistController.getUserPlaylists
);

// Actualizar playlist
router.put('/:id',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid playlist ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Playlist name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('coverImage')
    .optional()
    .isURL()
    .withMessage('Cover image must be a valid URL'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('isCollaborative')
    .optional()
    .isBoolean()
    .withMessage('isCollaborative must be a boolean'),
  validate,
  playlistController.updatePlaylist
);

// Eliminar playlist
router.delete('/:id',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid playlist ID'),
  validate,
  playlistController.deletePlaylist
);

// ===== GESTIÓN DE CANCIONES EN PLAYLISTS =====

// Agregar canción a playlist
router.post('/:id/songs',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid playlist ID'),
  body('songId')
    .isUUID()
    .withMessage('Invalid song ID'),
  body('position')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Position must be a non-negative integer'),
  validate,
  playlistController.addSongToPlaylist
);

// Remover canción de playlist
router.delete('/:id/songs/:songId',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid playlist ID'),
  param('songId')
    .isUUID()
    .withMessage('Invalid song ID'),
  validate,
  playlistController.removeSongFromPlaylist
);

// Reordenar canción en playlist
router.patch('/:id/songs/:songId/reorder',
  authenticateToken,
  requireRegisteredUser,
  param('id')
    .isUUID()
    .withMessage('Invalid playlist ID'),
  param('songId')
    .isUUID()
    .withMessage('Invalid song ID'),
  body('newPosition')
    .isInt({ min: 0 })
    .withMessage('New position must be a non-negative integer'),
  validate,
  playlistController.reorderPlaylistSong
);

module.exports = router;