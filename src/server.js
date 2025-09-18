// src/server.js
require('dotenv').config();
const app = require('./app');
const { checkConnection } = require('./config/database');
const { logger } = require('./utils/logger');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Verificar conexión a la base de datos
    const dbConnected = await checkConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📱 Environment: ${NODE_ENV}`);
      logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
      
      if (NODE_ENV === 'development') {
        logger.info(`📋 Available endpoints:`);
        logger.info(`   - GET  /api/v1/health`);
        logger.info(`   - POST /api/v1/auth/register`);
        logger.info(`   - POST /api/v1/auth/login-user`);
        logger.info(`   - POST /api/v1/auth/register-restaurant`);
        logger.info(`   - POST /api/v1/auth/login-restaurant`);
        logger.info(`   - GET  /api/v1/auth/profile`);
        logger.info(`   - PUT  /api/v1/auth/profile`);
        logger.info(`   - GET  /api/v1/restaurants/:slug/songs`);
        logger.info(`   - POST /api/v1/requests`);
        logger.info(`   - GET  /api/v1/admin/pending-restaurants`);
        logger.info(`   - GET  /api/v1/admin/global-stats`);
        logger.info(`   - PATCH /api/v1/admin/approve-restaurant/:id`);
        logger.info(`   - POST /api/v1/admin/reject-restaurant/:id`);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('✅ HTTP server closed.');
        
        // Cerrar conexiones de base de datos
        const { closeConnection } = require('./config/database');
        closeConnection().then(() => {
          logger.info('✅ Database connections closed.');
          logger.info('👋 Server shutdown complete.');
          process.exit(0);
        });
      });
    };

    // Manejar señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejar errores no capturados
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Iniciar servidor
startServer();