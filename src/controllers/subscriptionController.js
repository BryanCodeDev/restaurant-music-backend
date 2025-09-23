// src/controllers/subscriptionController.js
const { SubscriptionPlan, Restaurant } = require('../models');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

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
}

module.exports = new SubscriptionController();