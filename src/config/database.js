// src/config/database.js - IMPROVED VERSION WITH BETTER PARAMETER HANDLING
const mysql = require('mysql2/promise');
const { logger } = require('../utils/logger');

// Configuración de la base de datos mejorada
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'restaurant_music_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: false,
  debug: false,
  trace: false,
  multipleStatements: false,
  // AGREGADO: Opciones para mejor manejo de tipos
  typeCast: function (field, next) {
    // Convertir TINYINT(1) a boolean
    if (field.type === 'TINY' && field.length === 1) {
      return (field.string() === '1');
    }
    // Para otros tipos, usar el comportamiento por defecto
    return next();
  }
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función mejorada para normalizar parámetros
const normalizeParams = (params) => {
  if (!Array.isArray(params)) return params;
  
  return params.map(param => {
    // Convertir valores undefined/null a null
    if (param === undefined) return null;
    if (param === null) return null;
    
    // Mantener strings como están
    if (typeof param === 'string') return param;
    
    // Convertir números a strings para LIMIT/OFFSET
    if (typeof param === 'number') return param.toString();
    
    // Convertir booleans a números
    if (typeof param === 'boolean') return param ? 1 : 0;
    
    // Para otros tipos, convertir a string
    return String(param);
  });
};

// Función para verificar la conexión
const checkConnection = async () => {
  let connection;
  try {
    logger.info('Intentando conectar a la base de datos...');
    connection = await pool.getConnection();
    
    await connection.execute('SELECT 1 as test');
    
    logger.info('✅ Database connection established successfully');
    logger.info(`📊 Connected to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    });
    
    if (error.code === 'ECONNREFUSED') {
      logger.error('💡 Solución: Asegúrate de que MySQL esté ejecutándose');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      logger.error('💡 Solución: Verifica usuario y contraseña');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      logger.error('💡 Solución: La base de datos no existe, créala primero');
    }
    
    return false;
  } finally {
    if (connection) connection.release();
  }
};

// Función mejorada para ejecutar queries
const executeQuery = async (query, params = []) => {
  const startTime = Date.now();
  try {
    // Normalizar parámetros antes de ejecutar
    const normalizedParams = normalizeParams(params);
    
    logger.debug('Executing query:', { 
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      originalParams: params,
      normalizedParams: normalizedParams,
      paramCount: normalizedParams.length
    });
    
    const [rows, fields] = await pool.execute(query, normalizedParams);
    const duration = Date.now() - startTime;
    
    logger.debug('Query executed successfully:', {
      duration: `${duration}ms`,
      rowsAffected: Array.isArray(rows) ? rows.length : 'N/A'
    });
    
    return { rows, fields };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database query error:', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      originalParams: params,
      normalizedParams: normalizeParams(params),
      duration: `${duration}ms`,
      error: error.message,
      code: error.code,
      errno: error.errno
    });
    
    // Proporcionar errores más específicos
    if (error.code === 'ER_WRONG_ARGUMENTS') {
      const betterError = new Error('Parameter type mismatch - check query parameters');
      betterError.originalError = error;
      betterError.code = error.code;
      throw betterError;
    }
    
    throw error;
  }
};

// Función para transacciones mejorada
const executeTransaction = async (queries) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    logger.debug(`Starting transaction with ${queries.length} queries`);
    
    const results = [];
    for (let i = 0; i < queries.length; i++) {
      const { query, params } = queries[i];
      const normalizedParams = normalizeParams(params || []);
      
      logger.debug(`Executing transaction query ${i + 1}/${queries.length}`);
      const [rows] = await connection.execute(query, normalizedParams);
      results.push(rows);
    }
    
    await connection.commit();
    logger.debug('Transaction committed successfully');
    return results;
    
  } catch (error) {
    await connection.rollback();
    logger.error('Transaction error - rolled back:', {
      message: error.message,
      code: error.code
    });
    throw error;
  } finally {
    connection.release();
  }
};

// Función para obtener estadísticas de la pool
const getPoolStats = () => {
  const stats = {
    totalConnections: pool._allConnections ? pool._allConnections.length : 0,
    freeConnections: pool._freeConnections ? pool._freeConnections.length : 0,
    acquiringConnections: pool._acquiringConnections ? pool._acquiringConnections.length : 0
  };
  
  return stats;
};

// Función de prueba para verificar tipos de parámetros
const testParameterTypes = async () => {
  try {
    // Probar diferentes tipos de parámetros
    const testCases = [
      { params: ['string', 123, true, null, undefined], expected: 'success' },
      { params: [1, '2', 3.14], expected: 'success' }
    ];
    
    for (const testCase of testCases) {
      const normalized = normalizeParams(testCase.params);
      logger.debug('Parameter normalization test:', {
        original: testCase.params,
        normalized: normalized,
        types: normalized.map(p => typeof p)
      });
    }
    
    return true;
  } catch (error) {
    logger.error('Parameter type test failed:', error);
    return false;
  }
};

// Cerrar pool de conexiones
const closeConnection = async (timeout = 5000) => {
  try {
    logger.info('Cerrando pool de conexiones de base de datos...');
    
    const closePromise = pool.end();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection close timeout')), timeout);
    });
    
    await Promise.race([closePromise, timeoutPromise]);
    logger.info('✅ Database connection pool closed successfully');
  } catch (error) {
    logger.error('Error closing database connection:', error.message);
    if (error.message === 'Connection close timeout') {
      logger.warn('Forcing connection pool termination...');
    }
  }
};

// Event listeners para el pool
pool.on('connection', (connection) => {
  logger.debug(`New connection established: ${connection.threadId}`);
});

pool.on('error', (error) => {
  logger.error('Database pool error:', error);
});

// Función auxiliar para debugging de queries
const debugQuery = (query, params) => {
  const normalizedParams = normalizeParams(params);
  let debugQuery = query;
  
  // Reemplazar ? con valores reales para debug
  normalizedParams.forEach((param, index) => {
    const value = typeof param === 'string' ? `'${param}'` : param;
    debugQuery = debugQuery.replace('?', value);
  });
  
  return debugQuery;
};

module.exports = {
  pool,
  checkConnection,
  executeQuery,
  executeTransaction,
  closeConnection,
  getPoolStats,
  testParameterTypes,
  normalizeParams,
  debugQuery
};