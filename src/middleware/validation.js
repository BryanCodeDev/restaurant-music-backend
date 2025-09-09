// src/middleware/validation.js
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

// Validador personalizado para verificar si un valor existe en la base de datos
const existsInDB = (model, field = 'id', message) => {
  return async (value) => {
    const { executeQuery } = require('../config/database');
    
    try {
      const { rows } = await executeQuery(
        `SELECT ${field} FROM ${model} WHERE ${field} = ? LIMIT 1`,
        [value]
      );
      
      if (rows.length === 0) {
        throw new Error(message || `${model} not found`);
      }
      
      return true;
    } catch (error) {
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
    throw new Error(error.message);
  }
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

// Validador de género musical
const validateGenre = (value) => {
  const allowedGenres = [
    'rock', 'pop', 'electronic', 'hip-hop', 'jazz', 'reggaeton',
    'salsa', 'ballad', 'classical', 'reggae', 'funk', 'country',
    'blues', 'r&b', 'latin', 'folk', 'indie', 'metal', 'punk',
    'disco', 'house', 'techno', 'ambient', 'world'
  ];
  
  if (!allowedGenres.includes(value.toLowerCase())) {
    throw new Error('Invalid music genre');
  }
  
  return true;
};

// Validador de estado de petición
const validateRequestStatus = (value) => {
  const allowedStatuses = ['pending', 'playing', 'completed', 'cancelled'];
  
  if (!allowedStatuses.includes(value)) {
    throw new Error('Invalid request status');
  }
  
  return true;
};

// Middleware para logs de validación exitosa
const logValidation = (req, res, next) => {
  logger.debug('Validation passed:', {
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  next();
};

module.exports = {
  validate,
  existsInDB,
  uniqueInDB,
  activeRestaurant,
  sanitizeText,
  validateDuration,
  validateGenre,
  validateRequestStatus,
  logValidation
};