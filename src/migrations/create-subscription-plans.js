// src/migrations/create-subscription-plans.js
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

module.exports = {
  up: async () => {
    try {
      logger.info('🚀 Iniciando migración de sistema de suscripciones...');

      // Crear tabla subscription_plans
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS subscription_plans (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          price DECIMAL(10, 2) NOT NULL,
          period VARCHAR(20) NOT NULL,
          description TEXT,
          features JSON DEFAULT '[]',
          limitations JSON DEFAULT '[]',
          color VARCHAR(50),
          popular BOOLEAN DEFAULT FALSE,
          max_requests INT,
          max_tables INT,
          has_spotify BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      logger.info('✅ Tabla subscription_plans creada');

      // Insertar planes por defecto
      await executeQuery(`
        INSERT INTO subscription_plans (id, name, price, period, description, features, limitations, color, popular, max_requests, max_tables, has_spotify, created_at, updated_at)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        'starter', 'Starter', 29.00, 'mes', 'Perfecto para comenzar',
        JSON.stringify(['Hasta 50 mesas', 'Cola musical básica', '1,000 peticiones/mes', 'Soporte por email', 'Estadísticas básicas']),
        JSON.stringify(['Sin personalización avanzada', 'Sin API access']),
        'blue', false, 1000, 50, false,

        'professional', 'Professional', 79.00, 'mes', 'Ideal para restaurantes establecidos',
        JSON.stringify(['Mesas ilimitadas', 'Cola musical avanzada', '10,000 peticiones/mes', 'Soporte prioritario 24/7', 'Analytics completos', 'Personalización completa', 'Integración con Spotify', 'Control de contenido']),
        JSON.stringify([]),
        'amber', true, 10000, null, true,

        'enterprise', 'Enterprise', 199.00, 'mes', 'Para cadenas y grandes establecimientos',
        JSON.stringify(['Todo lo de Professional', 'Múltiples ubicaciones', 'Peticiones ilimitadas', 'Soporte dedicado', 'API completa', 'White-label', 'Integración personalizada', 'SLA garantizado']),
        JSON.stringify([]),
        'purple', false, null, null, true
      ]);

      logger.info('✅ Planes de suscripción insertados');

      // Agregar campos de suscripción a la tabla restaurants
      await executeQuery(`
        ALTER TABLE restaurants
        ADD COLUMN subscription_plan_id VARCHAR(50) NULL,
        ADD COLUMN subscription_status ENUM('active', 'inactive', 'pending', 'cancelled') DEFAULT 'pending',
        ADD COLUMN subscription_start_date TIMESTAMP NULL,
        ADD COLUMN subscription_end_date TIMESTAMP NULL,
        ADD CONSTRAINT fk_restaurants_subscription_plan
        FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)
        ON UPDATE CASCADE ON DELETE SET NULL
      `);

      logger.info('✅ Campos de suscripción agregados a restaurants');

      logger.info('🎉 Migración completada exitosamente');
      return true;

    } catch (error) {
      logger.error('❌ Error en migración:', error);
      throw error;
    }
  },

  down: async () => {
    try {
      logger.info('🔄 Revirtiendo migración de sistema de suscripciones...');

      // Eliminar campos de suscripción de restaurants
      await executeQuery(`
        ALTER TABLE restaurants
        DROP FOREIGN KEY fk_restaurants_subscription_plan,
        DROP COLUMN subscription_plan_id,
        DROP COLUMN subscription_status,
        DROP COLUMN subscription_start_date,
        DROP COLUMN subscription_end_date
      `);

      logger.info('✅ Campos de suscripción eliminados de restaurants');

      // Eliminar tabla subscription_plans
      await executeQuery('DROP TABLE IF EXISTS subscription_plans');

      logger.info('✅ Tabla subscription_plans eliminada');

      logger.info('🎉 Migración revertida exitosamente');
      return true;

    } catch (error) {
      logger.error('❌ Error al revertir migración:', error);
      throw error;
    }
  }
};