// src/routes/spotify.js
const express = require('express');
const router = express.Router();
const { spotifyLogin, spotifyCallback, spotifyRefresh } = require('../controllers/spotifyController');
const { authenticateToken } = require('../middleware/auth'); // Usar authenticateToken para refresh

router.get('/login', spotifyLogin);
router.get('/callback', spotifyCallback);
router.post('/:restaurantId/refresh', authenticateToken, spotifyRefresh); // Protegido

module.exports = router;