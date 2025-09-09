// src/utils/logger.js
const fs = require('fs');
const path = require('path');

// Crear directorio de logs si no existe
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// Niveles de log
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

// Formatear timestamp
const getTimestamp = () => {
  return new Date().toISOString();
};

// Formatear mensaje para archivo
const formatFileMessage = (level, message, data = null) => {
  const timestamp = getTimestamp();
  const logObject = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(data && { data }),
    pid: process.pid,
    env: process.env.NODE_ENV
  };
  
  return JSON.stringify(logObject) + '\n';
};

// Formatear mensaje para consola
const formatConsoleMessage = (level, message, data = null) => {
  const timestamp = getTimestamp();
  const colorMap = {
    error: colors.red,
    warn: colors.yellow,
    info: colors.green,
    debug: colors.gray
  };
  
  const color = colorMap[level] || colors.white;
  const resetColor = colors.reset;
  
  let consoleMessage = `${colors.gray}[${timestamp}]${resetColor} ${color}${level.toUpperCase()}${resetColor}: ${message}`;
  
  if (data) {
    consoleMessage += `\n${colors.gray}${JSON.stringify(data, null, 2)}${resetColor}`;
  }
  
  return consoleMessage;
};

// Escribir a archivo
const writeToFile = (level, message, data = null) => {
  if (process.env.NODE_ENV === 'production') {
    const logFile = path.join(logDir, 'app.log');
    const formattedMessage = formatFileMessage(level, message, data);
    
    fs.appendFile(logFile, formattedMessage, (err) => {
      if (err) console.error('Error writing to log file:', err);
    });
  }
};

// Funciones de logging
const logger = {
  error: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(formatConsoleMessage('error', message, data));
      writeToFile('error', message, data);
    }
  },

  warn: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(formatConsoleMessage('warn', message, data));
      writeToFile('warn', message, data);
    }
  },

  info: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(formatConsoleMessage('info', message, data));
      writeToFile('info', message, data);
    }
  },

  debug: (message, data = null) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(formatConsoleMessage('debug', message, data));
      writeToFile('debug', message, data);
    }
  }
};

module.exports = { logger };