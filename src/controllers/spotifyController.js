// src/controllers/spotifyController.js
const axios = require('axios');
const SpotifyToken = require('../models/SpotifyToken');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// Login: Redirigir a Spotify
const spotifyLogin = (req, res) => {
  const { restaurantId } = req.query; // O usa req.user.restaurantId si auth
  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurantId requerido' });
  }

  const state = Buffer.from(JSON.stringify({ restaurantId })).toString('base64'); // Para seguridad
  const scopes = 'user-read-playback user-modify-playback playlist-read-private'; // Scopes mínimos
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${state}`;

  res.redirect(authUrl);
};

// Callback: Intercambiar code por tokens y guardar
const spotifyCallback = async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code) {
    return res.status(400).json({ error: 'Error en autorización Spotify' });
  }

  try {
    const { restaurantId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const restaurant = await executeQuery('SELECT id FROM restaurants WHERE id = ? AND is_active = 1', [restaurantId]);
    if (!restaurant.rows.length) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }

    // Intercambiar code por tokens
    const tokenResponse = await axios.post(SPOTIFY_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    // Guardar/actualizar en DB
    const tokenData = {
      restaurantId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expiresAt,
      scope
    };
    await SpotifyToken.upsert(tokenData);

    logger.info(`Tokens guardados para restaurante ${restaurantId}`);
    res.redirect(`/dashboard?success=Spotify conectado`); // O tu frontend
  } catch (err) {
    logger.error('Error en callback Spotify:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error guardando tokens' });
  }
};

// Refresh: Renovar access_token si expirado
const spotifyRefresh = async (req, res) => {
  const { restaurantId } = req.params;
  const token = await SpotifyToken.findByRestaurantId(restaurantId);
  if (!token || token.isValid()) {
    return res.status(400).json({ error: 'Token no expirado o no encontrado' });
  }

  try {
    const response = await axios.post(SPOTIFY_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    await SpotifyToken.upsert({
      restaurantId,
      accessToken: access_token,
      expiresAt // refresh_token no cambia usualmente
    });

    res.json({ success: true, access_token, expiresAt });
  } catch (err) {
    logger.error('Error renovando token:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error renovando token' });
  }
};

module.exports = { spotifyLogin, spotifyCallback, spotifyRefresh };