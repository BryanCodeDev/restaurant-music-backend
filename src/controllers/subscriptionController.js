// src/controllers/subscriptionController.js
const { SubscriptionPlan, RestaurantSubscription, SubscriptionLog, Restaurant } = require('../models');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const {
  sendNewSubscriptionNotification,
  sendSubscriptionApprovedEmail,
  sendSubscriptionRejectedEmail
} = require('../services/emailService');

class SubscriptionController {
  // Obtener todos los planes
  async getPlans(req, res) {
    try {
      const plans = await SubscriptionPlan.findAll();
      res.json({ success: true, data: plans });
    } catch (error) {
      logger.error('Error al obtener planes:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener planes',
        error: error.message
      });
    }
  }

  // Obtener plan específico
  async getPlan(req, res) {
    try {
      const { id } = req.params;
      const plan = await SubscriptionPlan.findById(id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plan no encontrado'
        });
      }

      res.json({ success: true, data: plan });
    } catch (error) {
      logger.error('Error al obtener plan:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener plan',
        error: error.message
      });
    }
  }

  // Actualizar plan de restaurante
  async updateRestaurantPlan(req, res) {
    try {
      const { id } = req.params; // restaurant id
      const { planId, paymentProof } = req.body;

      const restaurant = await Restaurant.findById(id);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurante no encontrado'
        });
      }

      // Verificar que el plan existe
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: 'Plan no válido'
        });
      }

      // Actualizar plan
      await restaurant.update({
        subscriptionPlanId: planId,
        subscriptionStatus: 'pending', // Pendiente de aprobación
        subscriptionStartDate: new Date()
      });

      // TODO: Procesar paymentProof si existe
      // TODO: Enviar notificación de cambio de plan

      logger.info(`Plan actualizado para restaurante ${restaurant.id}: ${planId}`);

      res.json({
        success: true,
        message: 'Plan actualizado correctamente',
        data: { restaurant, plan }
      });
    } catch (error) {
      logger.error('Error al actualizar plan:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar plan',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de suscripción de un restaurante
  async getRestaurantSubscription(req, res) {
    try {
      const { id } = req.params;

      const restaurant = await Restaurant.findById(id);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurante no encontrado'
        });
      }

      let subscriptionPlan = null;
      if (restaurant.subscriptionPlanId) {
        subscriptionPlan = await SubscriptionPlan.findById(restaurant.subscriptionPlanId);
      }

      res.json({
        success: true,
        data: {
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            subscriptionPlanId: restaurant.subscriptionPlanId,
            subscriptionStatus: restaurant.subscriptionStatus,
            subscriptionStartDate: restaurant.subscriptionStartDate,
            subscriptionEndDate: restaurant.subscriptionEndDate
          },
          subscriptionPlan
        }
      });
    } catch (error) {
      logger.error('Error al obtener suscripción del restaurante:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener suscripción del restaurante',
        error: error.message
      });
    }
  }

  // Cancelar suscripción de restaurante
  async cancelRestaurantSubscription(req, res) {
    try {
      const { id } = req.params;

      const restaurant = await Restaurant.findById(id);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurante no encontrado'
        });
      }

      // Actualizar estado de suscripción
      await restaurant.update({
        subscriptionStatus: 'cancelled',
        subscriptionEndDate: new Date()
      });

      logger.info(`Suscripción cancelada para restaurante ${restaurant.id}`);

      res.json({
        success: true,
        message: 'Suscripción cancelada correctamente',
        data: { restaurant }
      });
    } catch (error) {
      logger.error('Error al cancelar suscripción:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al cancelar suscripción',
        error: error.message
      });
    }
  }

  // Aprobar suscripción de restaurante (para admin)
  async approveRestaurantSubscription(req, res) {
    try {
      const { id } = req.params; // restaurant id

      const restaurant = await Restaurant.findById(id);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurante no encontrado'
        });
      }

      if (restaurant.subscriptionStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'La suscripción no está pendiente de aprobación'
        });
      }

      // Calcular fecha de fin basado en el plan
      let subscriptionEndDate = null;
      if (restaurant.subscriptionPlanId) {
        const plan = await SubscriptionPlan.findById(restaurant.subscriptionPlanId);
        if (plan) {
          const startDate = restaurant.subscriptionStartDate || new Date();
          // Calcular fecha de fin (ejemplo: 1 mes)
          subscriptionEndDate = new Date(startDate);
          subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
        }
      }

      // Actualizar estado de suscripción
      await restaurant.update({
        subscriptionStatus: 'active',
        subscriptionEndDate
      });

      logger.info(`Suscripción aprobada para restaurante ${restaurant.id}`);

      res.json({
        success: true,
        message: 'Suscripción aprobada correctamente',
        data: { restaurant }
      });
    } catch (error) {
      logger.error('Error al aprobar suscripción:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al aprobar suscripción',
        error: error.message
      });
    }
  }

  // ============================
  // NUEVOS MÉTODOS PARA SUSCRIPCIONES
  // ============================

  // Crear nueva suscripción
  async createSubscription(req, res) {
    try {
      const { planId, restaurantInfo, userInfo, paymentMethod, notes } = req.body;
      let paymentProof = req.body.paymentProof; // URL o path del comprobante

      // Validar datos requeridos
      if (!planId || !restaurantInfo || !userInfo || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos',
          errors: {
            planId: !planId ? 'Plan es requerido' : null,
            restaurantInfo: !restaurantInfo ? 'Información del restaurante es requerida' : null,
            userInfo: !userInfo ? 'Información del usuario es requerida' : null,
            paymentMethod: !paymentMethod ? 'Método de pago es requerido' : null
          }
        });
      }

      // Procesar archivo de comprobante si se subió
      if (req.fileInfo) {
        paymentProof = req.fileInfo.url; // Usar la URL del archivo subido
        logger.info(`Payment proof processed: ${req.fileInfo.filename}`);
      } else if (paymentMethod === 'qr' || paymentMethod === 'transfer') {
        // Para métodos que requieren comprobante, validar que se haya subido
        return res.status(400).json({
          success: false,
          message: 'Debe subir un comprobante de pago para este método de pago',
          error: 'PAYMENT_PROOF_REQUIRED'
        });
      }

      // Verificar que el plan existe
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: 'Plan de suscripción no válido'
        });
      }

      // Crear restaurante si no existe
      let restaurant = await Restaurant.findByEmail(restaurantInfo.email);
      if (!restaurant) {
        const restaurantId = require('crypto').randomUUID();
        restaurant = await Restaurant.create({
          id: restaurantId,
          name: restaurantInfo.name,
          email: restaurantInfo.email,
          password: 'temp123', // Temporal, se actualizará después
          address: restaurantInfo.address,
          cuisineType: restaurantInfo.cuisineType,
          subscriptionPlanId: planId,
          subscriptionStatus: 'pending'
        });
      }

      // Crear suscripción
      const subscription = await RestaurantSubscription.create({
        restaurantId: restaurant.id,
        planId: planId,
        status: 'pending',
        paymentMethod: paymentMethod,
        paymentProof: paymentProof,
        notes: notes
      });

      // Registrar log
      await SubscriptionLog.create({
        subscriptionId: subscription.id,
        action: 'created',
        details: {
          planId: planId,
          paymentMethod: paymentMethod,
          restaurantInfo: restaurantInfo,
          userInfo: userInfo
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Enviar notificación al admin
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@musicmenu.com';
      await sendNewSubscriptionNotification(adminEmail, {
        restaurantInfo: restaurantInfo,
        planInfo: {
          name: plan.name,
          price: plan.price,
          period: plan.period
        },
        paymentMethod: paymentMethod
      });

      logger.info(`Nueva suscripción creada: ${subscription.id} para restaurante ${restaurant.id}`);

      res.status(201).json({
        success: true,
        message: 'Suscripción creada correctamente. Será revisada por nuestro equipo.',
        data: { subscription, restaurant, plan }
      });
    } catch (error) {
      logger.error('Error al crear suscripción:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al crear suscripción',
        error: error.message
      });
    }
  }

  // Obtener suscripciones pendientes (para admin)
  async getPendingSubscriptions(req, res) {
    try {
      const { page = 1, limit = 10, status = 'pending' } = req.query;
      const offset = (page - 1) * limit;

      const subscriptions = await RestaurantSubscription.findByStatus(status, parseInt(limit), parseInt(offset));

      // Obtener total para paginación
      const { rows: countResult } = await executeQuery(
        'SELECT COUNT(*) as total FROM restaurant_subscriptions WHERE status = ?',
        [status]
      );
      const total = countResult[0].total;

      res.json({
        success: true,
        data: {
          subscriptions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      logger.error('Error al obtener suscripciones pendientes:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener suscripciones pendientes',
        error: error.message
      });
    }
  }

  // Obtener suscripción por ID
  async getSubscriptionById(req, res) {
    try {
      const { id } = req.params;
      const subscription = await RestaurantSubscription.findById(id);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Suscripción no encontrada'
        });
      }

      res.json({
        success: true,
        data: subscription
      });
    } catch (error) {
      logger.error('Error al obtener suscripción:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener suscripción',
        error: error.message
      });
    }
  }

  // Aprobar suscripción
  async approveSubscription(req, res) {
    try {
      const { id } = req.params;
      const { approvedAt, expiresAt, notes } = req.body;

      const subscription = await RestaurantSubscription.findById(id);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Suscripción no encontrada'
        });
      }

      if (subscription.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'La suscripción no está pendiente de aprobación'
        });
      }

      // Aprobar suscripción
      await subscription.approve(approvedAt, expiresAt);

      // Actualizar restaurante
      const restaurant = await Restaurant.findById(subscription.restaurantId);
      if (restaurant) {
        await restaurant.update({
          subscriptionStatus: 'active',
          subscriptionStartDate: new Date(),
          subscriptionEndDate: expiresAt
        });
      }

      // Registrar log
      await SubscriptionLog.create({
        subscriptionId: subscription.id,
        action: 'approved',
        performedBy: req.user?.id,
        details: {
          approvedAt: approvedAt,
          expiresAt: expiresAt,
          notes: notes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Enviar notificación de aprobación al restaurante
      if (restaurant && restaurant.email) {
        await sendSubscriptionApprovedEmail(
          restaurant.email,
          restaurant.name,
          {
            planInfo: subscription.planInfo,
            expiresAt: expiresAt
          }
        );
      }

      logger.info(`Suscripción aprobada: ${subscription.id} por usuario ${req.user?.id}`);

      res.json({
        success: true,
        message: 'Suscripción aprobada correctamente. El restaurante ha sido notificado.',
        data: { subscription, restaurant }
      });
    } catch (error) {
      logger.error('Error al aprobar suscripción:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al aprobar suscripción',
        error: error.message
      });
    }
  }

  // Rechazar suscripción
  async rejectSubscription(req, res) {
    try {
      const { id } = req.params;
      const { reason, rejectedAt, notes } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'La razón de rechazo es requerida'
        });
      }

      const subscription = await RestaurantSubscription.findById(id);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Suscripción no encontrada'
        });
      }

      if (subscription.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'La suscripción no está pendiente de aprobación'
        });
      }

      // Rechazar suscripción
      await subscription.reject(reason, rejectedAt);

      // Registrar log
      await SubscriptionLog.create({
        subscriptionId: subscription.id,
        action: 'rejected',
        performedBy: req.user?.id,
        details: {
          reason: reason,
          rejectedAt: rejectedAt,
          notes: notes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Enviar notificación de rechazo al restaurante
      if (subscription.restaurantInfo && subscription.restaurantInfo.email) {
        await sendSubscriptionRejectedEmail(
          subscription.restaurantInfo.email,
          subscription.restaurantInfo.name,
          {
            planInfo: subscription.planInfo,
            rejectionReason: reason
          }
        );
      }

      logger.info(`Suscripción rechazada: ${subscription.id} por usuario ${req.user?.id}`);

      res.json({
        success: true,
        message: 'Suscripción rechazada correctamente. El restaurante ha sido notificado.',
        data: { subscription }
      });
    } catch (error) {
      logger.error('Error al rechazar suscripción:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al rechazar suscripción',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de suscripciones
  async getSubscriptionStats(req, res) {
    try {
      const { period = 'month', planId } = req.query;
      const now = new Date();
      let startDate, endDate;

      // Calcular período
      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          break;
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          break;
        case 'month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          break;
      }

      // Obtener estadísticas
      const { rows } = await executeQuery(`
        SELECT
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_subscriptions,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_subscriptions,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_subscriptions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
          SUM(CASE WHEN status = 'approved' THEN sp.price ELSE 0 END) as monthly_revenue
        FROM restaurant_subscriptions rs
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        WHERE rs.created_at BETWEEN ? AND ?
        ${planId ? 'AND rs.plan_id = ?' : ''}
      `, planId ? [startDate, endDate, planId] : [startDate, endDate]);

      const stats = rows[0];

      // Obtener suscripciones por plan
      const { rows: planStats } = await executeQuery(`
        SELECT
          sp.id as plan_id,
          sp.name as plan_name,
          sp.price as plan_price,
          COUNT(rs.id) as subscription_count,
          SUM(CASE WHEN rs.status = 'approved' THEN sp.price ELSE 0 END) as revenue
        FROM subscription_plans sp
        LEFT JOIN restaurant_subscriptions rs ON sp.id = rs.plan_id
        WHERE rs.created_at BETWEEN ? AND ? OR rs.id IS NULL
        GROUP BY sp.id, sp.name, sp.price
        ORDER BY subscription_count DESC
      `, [startDate, endDate]);

      res.json({
        success: true,
        data: {
          period,
          startDate,
          endDate,
          totalSubscriptions: parseInt(stats.total_subscriptions) || 0,
          pendingSubscriptions: parseInt(stats.pending_subscriptions) || 0,
          approvedSubscriptions: parseInt(stats.approved_subscriptions) || 0,
          rejectedSubscriptions: parseInt(stats.rejected_subscriptions) || 0,
          activeSubscriptions: parseInt(stats.active_subscriptions) || 0,
          monthlyRevenue: parseFloat(stats.monthly_revenue) || 0,
          conversionRate: stats.total_subscriptions > 0 ?
            (parseInt(stats.approved_subscriptions) / parseInt(stats.total_subscriptions)) * 100 : 0,
          subscriptionsByPlan: planStats
        }
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de suscripciones:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas de suscripciones',
        error: error.message
      });
    }
  }
}

module.exports = new SubscriptionController();