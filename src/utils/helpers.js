// src/utils/helpers.js

// Crear slug desde un string
const createSlug = (text) => {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Reemplazar espacios con guiones
    .replace(/[^\w\-]+/g, '')       // Remover caracteres especiales
    .replace(/\-\-+/g, '-')         // Reemplazar múltiples guiones con uno
    .replace(/^-+/, '')             // Remover guiones al inicio
    .replace(/-+$/, '');            // Remover guiones al final
};

// Generar ID único
const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

// Validar email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Formatear duración de segundos a mm:ss
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Convertir duración mm:ss a segundos
const durationToSeconds = (duration) => {
  if (!duration) return 0;
  
  const [minutes, seconds] = duration.split(':').map(Number);
  return (minutes * 60) + seconds;
};

// Limpiar texto de caracteres peligrosos
const sanitizeString = (str, maxLength = 255) => {
  if (!str) return '';
  
  return str
    .toString()
    .trim()
    .substring(0, maxLength)
    .replace(/[<>'"]/g, '');
};

// Generar código aleatorio
const generateCode = (length = 6) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

// Validar formato de teléfono colombiano
const isValidColombianPhone = (phone) => {
  const phoneRegex = /^(\+57)?[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Formatear respuesta de error estándar
const formatErrorResponse = (message, details = null, code = null) => {
  return {
    success: false,
    message,
    ...(details && { details }),
    ...(code && { code }),
    timestamp: new Date().toISOString()
  };
};

// Formatear respuesta de éxito estándar
const formatSuccessResponse = (message, data = null) => {
  return {
    success: true,
    message,
    ...(data && { data }),
    timestamp: new Date().toISOString()
  };
};

// Paginar resultados
const paginate = (page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;
  
  return {
    page: pageNum,
    limit: limitNum,
    offset
  };
};

// Calcular datos de paginación
const calculatePagination = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

// Debounce función
const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Generar token de reset de password
const generateResetToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

// Validar fuerza de contraseña
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const score = [
    password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar
  ].filter(Boolean).length;
  
  return {
    isValid: score >= 4,
    score,
    feedback: {
      length: password.length >= minLength,
      upperCase: hasUpperCase,
      lowerCase: hasLowerCase,
      numbers: hasNumbers,
      specialChar: hasSpecialChar
    }
  };
};

// Convertir string a boolean
const stringToBoolean = (str) => {
  if (typeof str === 'boolean') return str;
  if (typeof str === 'string') {
    return str.toLowerCase() === 'true' || str === '1';
  }
  return false;
};

// Obtener IP real del cliente
const getClientIP = (req) => {
  return req.ip ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
};

// Generar nombre de mesa aleatorio
const generateTableName = () => {
  const adjectives = ['Rápida', 'Feliz', 'Brillante', 'Cómoda', 'Especial', 'Única'];
  const nouns = ['Mesa', 'Estación', 'Zona', 'Punto', 'Lugar', 'Sitio'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 50) + 1;
  
  return `${adjective} ${noun} #${number}`;
};

// Validar coordenadas geográficas
const isValidCoordinates = (lat, lng) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  
  return !isNaN(latitude) && 
         !isNaN(longitude) &&
         latitude >= -90 && 
         latitude <= 90 &&
         longitude >= -180 && 
         longitude <= 180;
};

module.exports = {
  createSlug,
  generateId,
  isValidEmail,
  formatDuration,
  durationToSeconds,
  sanitizeString,
  generateCode,
  isValidColombianPhone,
  formatErrorResponse,
  formatSuccessResponse,
  paginate,
  calculatePagination,
  debounce,
  generateResetToken,
  validatePasswordStrength,
  stringToBoolean,
  getClientIP,
  generateTableName,
  isValidCoordinates
};