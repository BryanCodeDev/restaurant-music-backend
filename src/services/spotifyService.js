// src/services/spotifyService.js
const axios = require('axios');
const SpotifyToken = require('../models/SpotifyToken');
const { logger } = require('../utils/logger');

const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

class SpotifyService {
  static async getValidToken(restaurantId) {
    let token = await SpotifyToken.findByRestaurantId(restaurantId);
    if (!token || !token.isValid()) {
      if (token) {
        // Auto-refresh
        const refreshResponse = await axios.post(SPOTIFY_TOKEN_URL, new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          client_id: process.env.SPOTIFY_CLIENT_ID,
          client_secret: process.env.SPOTIFY_CLIENT_SECRET,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, expires_in } = refreshResponse.data;
        const expiresAt = new Date(Date.now() + (expires_in * 1000));
        await SpotifyToken.upsert({ restaurantId, accessToken: access_token, expiresAt });
        token = await SpotifyToken.findByRestaurantId(restaurantId);
      } else {
        throw new Error('No hay tokens de Spotify configurados');
      }
    }
    return token.accessToken;
  }

  static async search(query, options = { limit: 10, type: 'track' }) {
    const restaurantId = options.restaurantId; // Pasar desde controller
    const accessToken = await this.getValidToken(restaurantId);

    try {
      const response = await axios.get(`${SPOTIFY_BASE_URL}/search`, {
        params: { q: `track:${query} artist:${query}`, type: options.type, limit: options.limit },
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data.tracks?.items || [];
    } catch (error) {
      logger.error('Error en búsqueda Spotify:', error.response?.data || error.message);
      if (error.response?.status === 401) throw new Error('Token inválido');
      throw error;
    }
  }

  static async queueSong(deviceId, trackUri, restaurantId) {
    const accessToken = await this.getValidToken(restaurantId);
    try {
      await axios.post(`${SPOTIFY_BASE_URL}/me/player/queue?uri=${trackUri}&device_id=${deviceId}`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (error) {
      logger.error('Error en queue Spotify:', error.response?.data || error.message);
      throw error;
    }
  }

  static async playSong(deviceId, contextUri, restaurantId) {
    const accessToken = await this.getValidToken(restaurantId);
    try {
      await axios.put(`${SPOTIFY_BASE_URL}/me/player/play`, {
        context_uri: contextUri, // o uris: [trackUri] para single
        device_id: deviceId
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (error) {
      logger.error('Error en play Spotify:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = SpotifyService;