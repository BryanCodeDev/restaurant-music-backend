// src/config/database.js
const mysql = require('mysql2/promise');
const { logger } = require('../utils/logger');

// Configuración de la base de datos - opciones válidas solamente
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3307, // Puerto configurado en .env
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'restaurant_music_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Removidas las opciones inválidas: acquireTimeout, timeout, reconnect
  charset: 'utf8mb4',
  // Opciones adicionales válidas para mejorar la conexión
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: false,
  debug: false,
  trace: false,
  multipleStatements: false
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para verificar la conexión con mejor manejo de errores
const checkConnection = async () => {
  let connection;
  try {
    logger.info('Intentando conectar a la base de datos...');
    connection = await pool.getConnection();
    
    // Hacer una consulta simple para verificar que todo funciona
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
    
    // Mensajes de error más específicos
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

// Función para ejecutar queries con mejor logging
const executeQuery = async (query, params = []) => {
  const startTime = Date.now();
  try {
    logger.debug('Executing query:', { query, params });
    const [rows, fields] = await pool.execute(query, params);
    const duration = Date.now() - startTime;
    
    logger.debug('Query executed successfully:', {
      duration: `${duration}ms`,
      rowsAffected: Array.isArray(rows) ? rows.length : 'N/A'
    });
    
    return { rows, fields };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database query error:', {
      query,
      params,
      duration: `${duration}ms`,
      error: error.message,
      code: error.code
    });
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
      logger.debug(`Executing transaction query ${i + 1}/${queries.length}`);
      const [rows] = await connection.execute(query, params);
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
  return {
    totalConnections: pool._allConnections ? pool._allConnections.length : 0,
    freeConnections: pool._freeConnections ? pool._freeConnections.length : 0,
    acquiringConnections: pool._acquiringConnections ? pool._acquiringConnections.length : 0
  };
};

// Cerrar pool de conexiones con timeout
const closeConnection = async (timeout = 5000) => {
  try {
    logger.info('Cerrando pool de conexiones de base de datos...');
    
    // Crear una promesa con timeout
    const closePromise = pool.end();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection close timeout')), timeout);
    });
    
    await Promise.race([closePromise, timeoutPromise]);
    logger.info('✅ Database connection pool closed successfully');
  } catch (error) {
    logger.error('Error closing database connection:', error.message);
    // Forzar cierre si hay timeout
    if (error.message === 'Connection close timeout') {
      logger.warn('Forcing connection pool termination...');
      // pool.destroy() si está disponible
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

module.exports = {
  pool,
  checkConnection,
  executeQuery,
  executeTransaction,
  closeConnection,
  getPoolStats
};