// src/controllers/requestController.js
const { v4: uuidv4 } = require('uuid');
const { executeQuery, executeTransaction } = require('../config/database');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse, paginate, calculatePagination } = require('../utils/helpers');

// Crear una nueva petición musical
const createRequest = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { songId, tableNumber } = req.body;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    // Buscar restaurante
    const { rows: restaurantRows } = await executeQuery(
      'SELECT id, name, max_requests_per_user, queue_limit, is_active FROM restaurants WHERE slug = ? AND is_active = true',
      [restaurantSlug]
    );

    if (restaurantRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Restaurant not found or inactive')
      );
    }

    const restaurant = restaurantRows[0];

    // Verificar que la canción existe y pertenece al restaurante
    const { rows: songRows } = await executeQuery(
      'SELECT id, title, artist, image FROM songs WHERE id = ? AND restaurant_id = ? AND is_active = true',
      [songId, restaurant.id]
    );

    if (songRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Song not found in this restaurant')
      );
    }

    const song = songRows[0];

    // Crear o encontrar usuario temporal
    let userId;
    const finalTableNumber = tableNumber || `Mesa #${Math.floor(Math.random() * 20) + 1}`;
    
    // Buscar si ya existe una sesión para esta mesa/IP
    const { rows: existingUserRows } = await executeQuery(
      'SELECT id FROM users WHERE restaurant_id = ? AND (table_number = ? OR ip_address = ?) ORDER BY created_at DESC LIMIT 1',
      [restaurant.id, finalTableNumber, ipAddress]
    );

    if (existingUserRows.length > 0) {
      userId = existingUserRows[0].id;
    } else {
      // Crear nuevo usuario temporal
      const newUserId = uuidv4();
      await executeQuery(
        'INSERT INTO users (id, restaurant_id, table_number, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
        [newUserId, restaurant.id, finalTableNumber, ipAddress, userAgent]
      );
      userId = newUserId;
    }

    // Verificar límite de peticiones por usuario
    const { rows: userRequestsRows } = await executeQuery(
      'SELECT COUNT(*) as count FROM requests WHERE user_id = ? AND status = "pending"',
      [userId]
    );

    if (userRequestsRows[0].count >= restaurant.max_requests_per_user) {
      return res.status(429).json(
        formatErrorResponse(`Maximum ${restaurant.max_requests_per_user} pending requests per table`, null, 'MAX_REQUESTS_EXCEEDED')
      );
    }

    // Verificar límite de cola global
    const { rows: queueCountRows } = await executeQuery(
      'SELECT COUNT(*) as count FROM requests WHERE restaurant_id = ? AND status = "pending"',
      [restaurant.id]
    );

    if (queueCountRows[0].count >= restaurant.queue_limit) {
      return res.status(429).json(
        formatErrorResponse('Queue is full, please try again later', null, 'QUEUE_FULL')
      );
    }

    // Verificar si la canción ya está en cola por el mismo usuario
    const { rows: duplicateRows } = await executeQuery(
      'SELECT id FROM requests WHERE user_id = ? AND song_id = ? AND status IN ("pending", "playing")',
      [userId, songId]
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json(
        formatErrorResponse('You have already requested this song', null, 'DUPLICATE_REQUEST')
      );
    }

    // Crear la petición usando transacción
    const requestId = uuidv4();
    const currentQueuePosition = queueCountRows[0].count + 1;

    const transactionQueries = [
      {
        query: `INSERT INTO requests (id, restaurant_id, user_id, song_id, user_table, queue_position, status) 
                VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        params: [requestId, restaurant.id, userId, songId, finalTableNumber, currentQueuePosition]
      },
      {
        query: 'UPDATE songs SET times_requested = times_requested + 1 WHERE id = ?',
        params: [songId]
      },
      {
        query: 'UPDATE users SET total_requests = total_requests + 1, requests_today = requests_today + 1, last_request_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [userId]
      }
    ];

    await executeTransaction(transactionQueries);

    logger.info(`New music request created: ${song.title} by ${song.artist} for table ${finalTableNumber}`);

    res.status(201).json(formatSuccessResponse('Request created successfully', {
      request: {
        id: requestId,
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          image: song.image
        },
        tableNumber: finalTableNumber,
        queuePosition: currentQueuePosition,
        status: 'pending',
        estimatedWaitTime: currentQueuePosition * 3 // 3 minutos promedio por canción
      }
    }));

  } catch (error) {
    logger.error('Create request error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to create request', error.message)
    );
  }
};

// Obtener peticiones de un usuario
const getUserRequests = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { tableNumber } = req.query;
    const ipAddress = req.ip;

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

    // Buscar usuario por mesa o IP
    let whereClause = 'u.restaurant_id = ?';
    let params = [restaurant.id];

    if (tableNumber) {
      whereClause += ' AND u.table_number = ?';
      params.push(tableNumber);
    } else {
      whereClause += ' AND u.ip_address = ?';
      params.push(ipAddress);
    }

    // Obtener peticiones del usuario
    const { rows: requests } = await executeQuery(
      `SELECT r.id, r.status, r.queue_position, r.requested_at, r.started_playing_at, r.completed_at,
              s.id as song_id, s.title, s.artist, s.album, s.image, s.duration,
              u.table_number
       FROM requests r
       JOIN songs s ON r.song_id = s.id  
       JOIN users u ON r.user_id = u.id
       WHERE ${whereClause}
       ORDER BY r.requested_at DESC`,
      params
    );

    res.json(formatSuccessResponse('User requests retrieved', {
      requests,
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      playing: requests.filter(r => r.status === 'playing').length,
      completed: requests.filter(r => r.status === 'completed').length
    }));

  } catch (error) {
    logger.error('Get user requests error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get user requests', error.message)
    );
  }
};

// Obtener cola de peticiones del restaurante
const getRestaurantQueue = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { status = 'pending', page = 1, limit = 50 } = req.query;

    // Obtener información de paginación
    const { page: currentPage, limit: currentLimit, offset } = paginate(page, limit);

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

    // Construir query base
    let query = `
      SELECT r.id, r.status, r.queue_position, r.user_table, r.requested_at, r.started_playing_at,
             s.id as song_id, s.title, s.artist, s.album, s.image, s.duration
      FROM requests r
      JOIN songs s ON r.song_id = s.id
      WHERE r.restaurant_id = ?
    `;
    let params = [restaurant.id];

    // Filtro de estado
    if (status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }

    // Contar total
    const countQuery = query.replace(
      'SELECT r.id, r.status, r.queue_position, r.user_table, r.requested_at, r.started_playing_at, s.id as song_id, s.title, s.artist, s.album, s.image, s.duration',
      'SELECT COUNT(*) as total'
    );

    const { rows: countRows } = await executeQuery(countQuery, params);
    const total = countRows[0].total;

    // Agregar ordenamiento y paginación
    if (status === 'pending') {
      query += ' ORDER BY r.queue_position ASC, r.requested_at ASC';
    } else {
      query += ' ORDER BY r.requested_at DESC';
    }
    
    query += ' LIMIT ? OFFSET ?';
    params.push(currentLimit, offset);

    const { rows: requests } = await executeQuery(query, params);

    // Calcular paginación
    const pagination = calculatePagination(total, currentPage, currentLimit);

    res.json(formatSuccessResponse('Restaurant queue retrieved', {
      requests,
      pagination,
      stats: {
        total,
        pending: requests.filter(r => r.status === 'pending').length,
        playing: requests.filter(r => r.status === 'playing').length,
        completed: requests.filter(r => r.status === 'completed').length
      }
    }));

  } catch (error) {
    logger.error('Get restaurant queue error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get restaurant queue', error.message)
    );
  }
};

// Cancelar una petición
const cancelRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { tableNumber } = req.body;
    const ipAddress = req.ip;

    // Buscar la petición
    const { rows: requestRows } = await executeQuery(
      `SELECT r.id, r.status, r.user_id, r.queue_position, r.restaurant_id,
              s.title, s.artist, u.table_number, u.ip_address
       FROM requests r
       JOIN songs s ON r.song_id = s.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [requestId]
    );

    if (requestRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Request not found')
      );
    }

    const request = requestRows[0];

    // Verificar autorización (por mesa o IP)
    const canCancel = (tableNumber && request.table_number === tableNumber) || 
                     request.ip_address === ipAddress;

    if (!canCancel) {
      return res.status(403).json(
        formatErrorResponse('Not authorized to cancel this request')
      );
    }

    // No se puede cancelar si ya está reproduciendo o completada
    if (request.status === 'playing') {
      return res.status(400).json(
        formatErrorResponse('Cannot cancel a request that is currently playing')
      );
    }

    if (request.status === 'completed' || request.status === 'cancelled') {
      return res.status(400).json(
        formatErrorResponse('Request is already completed or cancelled')
      );
    }

    // Cancelar usando transacción para actualizar posiciones de cola
    const transactionQueries = [
      {
        query: 'UPDATE requests SET status = "cancelled" WHERE id = ?',
        params: [requestId]
      },
      {
        query: `UPDATE requests 
                SET queue_position = queue_position - 1 
                WHERE restaurant_id = ? AND status = "pending" AND queue_position > ?`,
        params: [request.restaurant_id, request.queue_position]
      }
    ];

    await executeTransaction(transactionQueries);

    logger.info(`Request cancelled: ${request.title} by ${request.artist} from table ${request.table_number}`);

    res.json(formatSuccessResponse('Request cancelled successfully', {
      requestId: request.id,
      song: {
        title: request.title,
        artist: request.artist
      }
    }));

  } catch (error) {
    logger.error('Cancel request error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to cancel request', error.message)
    );
  }
};

// Actualizar estado de petición (solo para restaurantes)
const updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const { user } = req;

    // Verificar que el usuario sea un restaurante
    if (!user || user.type !== 'restaurant') {
      return res.status(403).json(
        formatErrorResponse('Restaurant access required')
      );
    }

    // Buscar la petición
    const { rows: requestRows } = await executeQuery(
      `SELECT r.id, r.status, r.restaurant_id, r.queue_position,
              s.title, s.artist, s.duration
       FROM requests r
       JOIN songs s ON r.song_id = s.id
       WHERE r.id = ? AND r.restaurant_id = ?`,
      [requestId, user.id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Request not found in your restaurant')
      );
    }

    const request = requestRows[0];

    // Validar transición de estado
    const validTransitions = {
      'pending': ['playing', 'cancelled'],
      'playing': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    if (!validTransitions[request.status].includes(status)) {
      return res.status(400).json(
        formatErrorResponse(`Cannot change status from ${request.status} to ${status}`)
      );
    }

    // Actualizar estado
    let updateQuery = 'UPDATE requests SET status = ?';
    let params = [status, requestId];

    if (status === 'playing') {
      updateQuery += ', started_playing_at = CURRENT_TIMESTAMP';
    } else if (status === 'completed') {
      updateQuery += ', completed_at = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = ?';

    await executeQuery(updateQuery, params);

    // Si se completó o canceló, actualizar posiciones de cola
    if (status === 'completed' || status === 'cancelled') {
      await executeQuery(
        `UPDATE requests 
         SET queue_position = queue_position - 1 
         WHERE restaurant_id = ? AND status = "pending" AND queue_position > ?`,
        [user.id, request.queue_position]
      );
    }

    logger.info(`Request status updated: ${request.title} changed to ${status}`);

    res.json(formatSuccessResponse('Request status updated', {
      requestId: request.id,
      newStatus: status,
      song: {
        title: request.title,
        artist: request.artist
      }
    }));

  } catch (error) {
    logger.error('Update request status error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to update request status', error.message)
    );
  }
};

// Obtener estadísticas de peticiones
const getRequestStats = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const { period = '24h' } = req.query;

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

    // Determinar filtro de tiempo
    let timeFilter = '';
    switch (period) {
      case '1h':
        timeFilter = 'AND requested_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
        break;
      case '24h':
        timeFilter = 'AND requested_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
        break;
      case '7d':
        timeFilter = 'AND requested_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case '30d':
        timeFilter = 'AND requested_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
    }

    // Obtener estadísticas generales
    const { rows: generalStats } = await executeQuery(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'playing' THEN 1 END) as playing_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_requests,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(queue_position) as avg_queue_position
       FROM requests 
       WHERE restaurant_id = ? ${timeFilter}`,
      [restaurant.id]
    );

    // Obtener canciones más pedidas
    const { rows: topSongs } = await executeQuery(
      `SELECT s.id, s.title, s.artist, s.image, COUNT(r.id) as request_count
       FROM requests r
       JOIN songs s ON r.song_id = s.id
       WHERE r.restaurant_id = ? ${timeFilter}
       GROUP BY s.id, s.title, s.artist, s.image
       ORDER BY request_count DESC
       LIMIT 10`,
      [restaurant.id]
    );

    // Obtener géneros más populares
    const { rows: topGenres } = await executeQuery(
      `SELECT s.genre, COUNT(r.id) as request_count
       FROM requests r
       JOIN songs s ON r.song_id = s.id
       WHERE r.restaurant_id = ? ${timeFilter}
       GROUP BY s.genre
       ORDER BY request_count DESC
       LIMIT 5`,
      [restaurant.id]
    );

    res.json(formatSuccessResponse('Request statistics retrieved', {
      period,
      stats: generalStats[0],
      topSongs,
      topGenres,
      completionRate: generalStats[0].total_requests > 0 
        ? ((generalStats[0].completed_requests / generalStats[0].total_requests) * 100).toFixed(2)
        : 0
    }));

  } catch (error) {
    logger.error('Get request stats error:', error.message);
    res.status(500).json(
      formatErrorResponse('Failed to get request statistics', error.message)
    );
  }
};

module.exports = {
  createRequest,
  getUserRequests,
  getRestaurantQueue,
  cancelRequest,
  updateRequestStatus,
  getRequestStats
};