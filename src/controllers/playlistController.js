// src/controllers/playlistController.js - Controlador para gestión de playlists
const { Playlist, PlaylistSong, Song, RegisteredUser, ActivityLog } = require('../models');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

class PlaylistController {
  // Crear nueva playlist
  async createPlaylist(req, res) {
    try {
      const { user } = req;
      const { name, description, coverImage, isPublic, isCollaborative } = req.body;

      if (!name) {
        return res.status(400).json(
          formatErrorResponse('El nombre de la playlist es requerido')
        );
      }

      if (user.type !== 'registered_user') {
        return res.status(403).json(
          formatErrorResponse('Solo usuarios registrados pueden crear playlists')
        );
      }

      const playlistData = {
        registeredUserId: user.id,
        name,
        description: description || null,
        coverImage: coverImage || null,
        isPublic: isPublic || false,
        isCollaborative: isCollaborative || false
      };

      const playlist = await Playlist.create(playlistData);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'playlist_created',
        entityType: 'playlist',
        entityId: playlist.id,
        details: { name, isPublic },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Playlist creada: ${playlist.id} por usuario ${user.id}`);

      res.status(201).json(formatSuccessResponse('Playlist creada exitosamente', {
        playlist: playlist.toJSON()
      }));

    } catch (error) {
      logger.error('Error al crear playlist:', error);
      res.status(500).json(
        formatErrorResponse('Error al crear playlist', error.message)
      );
    }
  }

  // Obtener playlists del usuario
  async getUserPlaylists(req, res) {
    try {
      const { user } = req;
      const { publicOnly = false, limit = 20, offset = 0 } = req.query;

      if (user.type !== 'registered_user') {
        return res.status(403).json(
          formatErrorResponse('Solo usuarios registrados pueden ver sus playlists')
        );
      }

      const playlists = await Playlist.getByUser(
        user.id,
        publicOnly === 'true',
        parseInt(limit),
        parseInt(offset)
      );

      res.json(formatSuccessResponse('Playlists obtenidas exitosamente', {
        playlists,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: playlists.length === parseInt(limit)
        }
      }));

    } catch (error) {
      logger.error('Error al obtener playlists del usuario:', error);
      res.status(500).json(
        formatErrorResponse('Error al obtener playlists', error.message)
      );
    }
  }

  // Obtener playlist por ID
  async getPlaylistById(req, res) {
    try {
      const { id } = req.params;
      const { includeSongs = false } = req.query;

      const playlist = await Playlist.findById(id, includeSongs === 'true');

      if (!playlist) {
        return res.status(404).json(
          formatErrorResponse('Playlist no encontrada')
        );
      }

      // Verificar permisos (solo el creador o playlists públicas)
      if (!playlist.isPublic && playlist.registeredUserId !== req.user?.id) {
        return res.status(403).json(
          formatErrorResponse('No tienes permisos para ver esta playlist')
        );
      }

      res.json(formatSuccessResponse('Playlist obtenida exitosamente', {
        playlist: playlist.toJSON()
      }));

    } catch (error) {
      logger.error('Error al obtener playlist:', error);
      res.status(500).json(
        formatErrorResponse('Error al obtener playlist', error.message)
      );
    }
  }

  // Actualizar playlist
  async updatePlaylist(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { name, description, coverImage, isPublic, isCollaborative } = req.body;

      const playlist = await Playlist.findById(id);

      if (!playlist) {
        return res.status(404).json(
          formatErrorResponse('Playlist no encontrada')
        );
      }

      if (playlist.registeredUserId !== user.id) {
        return res.status(403).json(
          formatErrorResponse('Solo el creador puede modificar la playlist')
        );
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (coverImage !== undefined) updateData.coverImage = coverImage;
      if (isPublic !== undefined) updateData.isPublic = isPublic;
      if (isCollaborative !== undefined) updateData.isCollaborative = isCollaborative;

      await playlist.update(updateData);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'playlist_updated',
        entityType: 'playlist',
        entityId: playlist.id,
        details: updateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Playlist actualizada: ${playlist.id} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Playlist actualizada exitosamente', {
        playlist: playlist.toJSON()
      }));

    } catch (error) {
      logger.error('Error al actualizar playlist:', error);
      res.status(500).json(
        formatErrorResponse('Error al actualizar playlist', error.message)
      );
    }
  }

  // Eliminar playlist
  async deletePlaylist(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      const playlist = await Playlist.findById(id);

      if (!playlist) {
        return res.status(404).json(
          formatErrorResponse('Playlist no encontrada')
        );
      }

      if (playlist.registeredUserId !== user.id) {
        return res.status(403).json(
          formatErrorResponse('Solo el creador puede eliminar la playlist')
        );
      }

      // Eliminar todas las canciones de la playlist
      await executeQuery('DELETE FROM playlist_songs WHERE playlist_id = ?', [id]);

      // Eliminar la playlist
      await executeQuery('DELETE FROM playlists WHERE id = ?', [id]);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'playlist_deleted',
        entityType: 'playlist',
        entityId: id,
        details: { name: playlist.name },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Playlist eliminada: ${id} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Playlist eliminada exitosamente'));

    } catch (error) {
      logger.error('Error al eliminar playlist:', error);
      res.status(500).json(
        formatErrorResponse('Error al eliminar playlist', error.message)
      );
    }
  }

  // Agregar canción a playlist
  async addSongToPlaylist(req, res) {
    try {
      const { user } = req;
      const { id } = req.params; // playlist id
      const { songId, position } = req.body;

      if (!songId) {
        return res.status(400).json(
          formatErrorResponse('El ID de la canción es requerido')
        );
      }

      const playlist = await Playlist.findById(id);

      if (!playlist) {
        return res.status(404).json(
          formatErrorResponse('Playlist no encontrada')
        );
      }

      if (playlist.registeredUserId !== user.id && !playlist.isCollaborative) {
        return res.status(403).json(
          formatErrorResponse('No tienes permisos para modificar esta playlist')
        );
      }

      // Verificar que la canción existe
      const song = await Song.findById(songId);
      if (!song) {
        return res.status(404).json(
          formatErrorResponse('Canción no encontrada')
        );
      }

      const playlistSong = await playlist.addSong(songId, position, user.id);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'song_added_to_playlist',
        entityType: 'playlist_song',
        entityId: playlistSong.id,
        details: {
          playlistId: id,
          songId,
          songTitle: song.title,
          songArtist: song.artist
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Canción agregada a playlist: ${songId} -> ${id} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Canción agregada a la playlist exitosamente', {
        playlistSong: playlistSong.toJSON()
      }));

    } catch (error) {
      logger.error('Error al agregar canción a playlist:', error);
      res.status(500).json(
        formatErrorResponse('Error al agregar canción a playlist', error.message)
      );
    }
  }

  // Remover canción de playlist
  async removeSongFromPlaylist(req, res) {
    try {
      const { user } = req;
      const { id, songId } = req.params;

      const playlist = await Playlist.findById(id);

      if (!playlist) {
        return res.status(404).json(
          formatErrorResponse('Playlist no encontrada')
        );
      }

      if (playlist.registeredUserId !== user.id && !playlist.isCollaborative) {
        return res.status(403).json(
          formatErrorResponse('No tienes permisos para modificar esta playlist')
        );
      }

      // Buscar la canción en la playlist
      const { rows } = await executeQuery(
        'SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
        [id, songId]
      );

      if (rows.length === 0) {
        return res.status(404).json(
          formatErrorResponse('Canción no encontrada en la playlist')
        );
      }

      await PlaylistSong.deleteById(rows[0].id);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'song_removed_from_playlist',
        entityType: 'playlist_song',
        entityId: rows[0].id,
        details: { playlistId: id, songId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Canción removida de playlist: ${songId} <- ${id} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Canción removida de la playlist exitosamente'));

    } catch (error) {
      logger.error('Error al remover canción de playlist:', error);
      res.status(500).json(
        formatErrorResponse('Error al remover canción de playlist', error.message)
      );
    }
  }

  // Reordenar canción en playlist
  async reorderPlaylistSong(req, res) {
    try {
      const { user } = req;
      const { id, songId } = req.params;
      const { newPosition } = req.body;

      if (newPosition === undefined || newPosition < 0) {
        return res.status(400).json(
          formatErrorResponse('La nueva posición debe ser un número válido')
        );
      }

      const playlist = await Playlist.findById(id);

      if (!playlist) {
        return res.status(404).json(
          formatErrorResponse('Playlist no encontrada')
        );
      }

      if (playlist.registeredUserId !== user.id && !playlist.isCollaborative) {
        return res.status(403).json(
          formatErrorResponse('No tienes permisos para modificar esta playlist')
        );
      }

      // Buscar la canción en la playlist
      const playlistSong = await PlaylistSong.findById(songId);
      if (!playlistSong || playlistSong.playlistId !== id) {
        return res.status(404).json(
          formatErrorResponse('Canción no encontrada en la playlist')
        );
      }

      await playlistSong.updatePosition(newPosition);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'playlist_song_reordered',
        entityType: 'playlist_song',
        entityId: playlistSong.id,
        details: {
          playlistId: id,
          songId,
          oldPosition: playlistSong.position,
          newPosition
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Canción reordenada en playlist: ${songId} -> posición ${newPosition} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Canción reordenada exitosamente'));

    } catch (error) {
      logger.error('Error al reordenar canción en playlist:', error);
      res.status(500).json(
        formatErrorResponse('Error al reordenar canción en playlist', error.message)
      );
    }
  }

  // Obtener playlists públicas (para descubrimiento)
  async getPublicPlaylists(req, res) {
    try {
      const { limit = 20, offset = 0, search } = req.query;

      let query = `
        SELECT p.*, ru.name as user_name, ru.avatar as user_avatar,
               COUNT(ps.id) as song_count
        FROM playlists p
        LEFT JOIN registered_users ru ON p.registered_user_id = ru.id
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
        WHERE p.is_public = true
      `;

      const params = [];

      if (search) {
        query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += `
        GROUP BY p.id, ru.name, ru.avatar
        ORDER BY p.updated_at DESC
        LIMIT ? OFFSET ?
      `;

      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await executeQuery(query, params);

      res.json(formatSuccessResponse('Playlists públicas obtenidas exitosamente', {
        playlists: rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: rows.length === parseInt(limit)
        }
      }));

    } catch (error) {
      logger.error('Error al obtener playlists públicas:', error);
      res.status(500).json(
        formatErrorResponse('Error al obtener playlists públicas', error.message)
      );
    }
  }
}

module.exports = new PlaylistController();