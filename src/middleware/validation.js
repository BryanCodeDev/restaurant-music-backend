// src/middleware/validation.js - UPDATED WITH ID VALIDATION HELPERS
const { validationResult } = require('express-validator');
const { logger } = require('../utils/logger');

// Middleware para manejar errores de validación
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', {
      url: req.originalUrl,
      method: req.method,
      errors: errors.array(),
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// NUEVO: Validadores de ID personalizados
const validateSongId = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const songIdRegex = /^song-\d{3,}$/;
  
  if (!uuidRegex.test(value) && !songIdRegex.test(value)) {
    throw new Error('Valid song ID is required (UUID or song-XXX format)');
  }
  return true;
};

const validateRequestId = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const requestIdRegex = /^req-\d{3,}$/;
  
  if (!uuidRegex.test(value) && !requestIdRegex.test(value)) {
    throw new Error('Valid request ID is required (UUID or req-XXX format)');
  }
  return true;
};

const validateUserId = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const userIdRegex = /^user-\d{3,}$/;
  
  if (!uuidRegex.test(value) && !userIdRegex.test(value)) {
    throw new Error('Valid user ID is required (UUID or user-XXX format)');
  }
  return true;
};

const validateRestaurantId = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const restIdRegex = /^rest-\d{3,}$/;
  
  if (!uuidRegex.test(value) && !restIdRegex.test(value)) {
    throw new Error('Valid restaurant ID is required (UUID or rest-XXX format)');
  }
  return true;
};

// Validador personalizado para verificar si un valor existe en la base de datos
const existsInDB = (model, field = 'id', message) => {
  return async (value) => {
    const { executeQuery } = require('../config/database');
    
    try {
      const { rows } = await executeQuery(
        `SELECT ${field} FROM ${model} WHERE ${field} = ? AND is_active = 1 LIMIT 1`,
        [value]
      );
      
      if (rows.length === 0) {
        throw new Error(message || `${model} not found or inactive`);
      }
      
      return true;
    } catch (error) {
      logger.error('Database validation error:', error);
      throw new Error(message || error.message);
    }
  };
};

// Validador personalizado para verificar unicidad en la base de datos
const uniqueInDB = (model, field, message, excludeId = null) => {
  return async (value, { req }) => {
    const { executeQuery } = require('../config/database');
    
    try {
      let query = `SELECT ${field} FROM ${model} WHERE ${field} = ?`;
      let params = [value];
      
      // Excluir registro actual en actualizaciones
      if (excludeId && req.params.id) {
        query += ' AND id != ?';
        params.push(req.params.id);
      }
      
      const { rows } = await executeQuery(query, params);
      
      if (rows.length > 0) {
        throw new Error(message || `${field} already exists`);
      }
      
      return true;
    } catch (error) {
      logger.error('Uniqueness validation error:', error);
      throw new Error(message || error.message);
    }
  };
};

// Validador para restaurante activo
const activeRestaurant = async (slug) => {
  const { executeQuery } = require('../config/database');
  
  try {
    const { rows } = await executeQuery(
      'SELECT id FROM restaurants WHERE slug = ? AND is_active = true',
      [slug]
    );
    
    if (rows.length === 0) {
      throw new Error('Restaurant not found or inactive');
    }
    
    return true;
  } catch (error) {
    logger.error('Restaurant validation error:', error);
    throw new Error(error.message);
  }
};

// MEJORADO: Validador de canción que verifica existencia en restaurante
const validateSongExistsInRestaurant = (restaurantSlug) => {
  return async (songId) => {
    const { executeQuery } = require('../config/database');
    
    try {
      // Validar formato del songId primero
      validateSongId(songId);
      
      // Verificar que la canción existe en el restaurante
      const { rows } = await executeQuery(
        `SELECT s.id FROM songs s 
         JOIN restaurants r ON s.restaurant_id = r.id 
         WHERE s.id = ? AND r.slug = ? AND s.is_active = 1 AND r.is_active = 1
         LIMIT 1`,
        [songId, restaurantSlug]
      );
      
      if (rows.length === 0) {
        throw new Error('Song not found in this restaurant or inactive');
      }
      
      return true;
    } catch (error) {
      logger.error('Song-Restaurant validation error:', { songId, restaurantSlug, error: error.message });
      throw new Error(error.message);
    }
  };
};

// Sanitizar entrada de texto
const sanitizeText = (text, maxLength = 255) => {
  if (!text) return '';
  
  return text
    .toString()
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Remover caracteres peligrosos básicos
};

// Validador de formato de duración musical (mm:ss)
const validateDuration = (value) => {
  const durationRegex = /^([0-9]{1,2}):([0-5][0-9])$/;
  
  if (!durationRegex.test(value)) {
    throw new Error('Duration must be in mm:ss format');
  }
  
  return true;
};

// MEJORADO: Validador de género musical con soporte para la base de datos
const validateGenre = (value) => {
  const allowedGenres = [
    'rock', 'pop', 'electronic', 'hip-hop', 'hiphop', 'jazz', 'reggaeton',
    'salsa', 'ballad', 'classical', 'reggae', 'funk', 'country',
    'blues', 'r&b', 'rnb', 'latin', 'folk', 'indie', 'metal', 'punk',
    'disco', 'house', 'techno', 'ambient', 'world', 'rap', 'trap', 
    'dancehall', 'cumbia', 'merengue', 'bachata', 'flamenco', 'tango', 
    'vallenato', 'ranchera', 'mariachi', 'alternative', 'grunge', 'ska', 
    'swing', 'gospel', 'soul', 'edm', 'dubstep', 'trance', 'drum-and-bass',
    'dnb', 'reggaeton-old', 'reggaeton-new', 'latin-pop', 'latin-rock'
  ];
  
  const normalizedValue = value.toString().toLowerCase().trim();
  
  const genreMapping = {
    'hip hop': 'hip-hop',
    'hiphop': 'hip-hop',
    'r and b': 'r&b',
    'rnb': 'r&b',
    'drum and bass': 'drum-and-bass',
    'dnb': 'drum-and-bass'
  };
  
  const mappedGenre = genreMapping[normalizedValue] || normalizedValue;
  
  if (!allowedGenres.includes(mappedGenre)) {
    logger.warn('Invalid genre attempted:', {
      original: value,
      normalized: normalizedValue,
      mapped: mappedGenre
    });
    throw new Error(`Invalid music genre: ${value}. Please use a valid genre.`);
  }
  
  return true;
};

// Validador de estado de petición
const validateRequestStatus = (value) => {
  const allowedStatuses = ['pending', 'playing', 'completed', 'cancelled'];
  
  if (!allowedStatuses.includes(value)) {
    throw new Error(`Invalid request status: ${value}. Allowed: ${allowedStatuses.join(', ')}`);
  }
  
  return true;
};

// Middleware para logs de validación exitosa
const logValidation = (req, res, next) => {
  logger.debug('Validation passed:', {
    url: req.originalUrl,
    method: req.method,
    body: Object.keys(req.body || {}),
    params: req.params,
    query: req.query
  });
  
  next();
};

// Middleware para validar parámetros de query opcionales
const validateOptionalQueryParams = (allowedParams = []) => {
  return (req, res, next) => {
    const queryKeys = Object.keys(req.query || {});
    const invalidParams = queryKeys.filter(key => !allowedParams.includes(key));
    
    if (invalidParams.length > 0) {
      logger.warn('Invalid query parameters:', {
        url: req.originalUrl,
        invalidParams,
        allowedParams,
        receivedParams: queryKeys
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: invalidParams.map(param => ({
          field: param,
          message: `Parameter '${param}' is not allowed`,
          allowedParams
        }))
      });
    }
    
    next();
  };
};

module.exports = {
  validate,
  // ID Validators
  validateSongId,
  validateRequestId,
  validateUserId,
  validateRestaurantId,
  // Database Validators
  existsInDB,
  uniqueInDB,
  activeRestaurant,
  validateSongExistsInRestaurant,
  // Content Validators
  sanitizeText,
  validateDuration,
  validateGenre,
  validateRequestStatus,
  // Utility
  logValidation,
  validateOptionalQueryParams
};