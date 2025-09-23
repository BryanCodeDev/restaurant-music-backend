// src/controllers/adminStatsController.js
const { Restaurant, User, Song, Request, RestaurantSubscription, SubscriptionPlan, SubscriptionLog } = require('../models');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');

class AdminStatsController {
  // Obtener estadísticas globales del sistema
  async getGlobalStats(req, res) {
    try {
      // Obtener estadísticas básicas
      const { rows: basicStats } = await executeQuery(`
        SELECT
          (SELECT COUNT(*) FROM restaurants WHERE is_active = 1) as total_restaurants,
          (SELECT COUNT(*) FROM restaurants WHERE is_active = 1 AND subscription_status = 'active') as active_restaurants,
          (SELECT COUNT(*) FROM restaurants WHERE pending_approval = 1) as pending_restaurants,
          (SELECT COUNT(*) FROM registered_users WHERE is_active = 1) as total_users,
          (SELECT COUNT(*) FROM songs) as total_songs,
          (SELECT COUNT(*) FROM requests WHERE DATE(created_at) = CURDATE()) as today_requests,
          (SELECT COUNT(*) FROM restaurant_subscriptions WHERE status = 'pending') as pending_subscriptions,
          (SELECT COUNT(*) FROM restaurant_subscriptions WHERE status = 'approved') as approved_subscriptions,
          (SELECT COUNT(*) FROM restaurant_subscriptions WHERE status = 'rejected') as rejected_subscriptions
      `);

      const stats = basicStats[0];

      // Obtener ingresos mensuales
      const { rows: revenueStats } = await executeQuery(`
        SELECT
          COALESCE(SUM(sp.price), 0) as monthly_revenue,
          COUNT(rs.id) as total_subscriptions
        FROM restaurant_subscriptions rs
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        WHERE rs.status = 'approved'
        AND rs.approved_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      // Obtener planes más populares
      const { rows: popularPlans } = await executeQuery(`
        SELECT
          sp.id,
          sp.name,
          sp.price,
          COUNT(rs.id) as subscription_count,
          SUM(sp.price) as total_revenue
        FROM subscription_plans sp
        LEFT JOIN restaurant_subscriptions rs ON sp.id = rs.plan_id
        WHERE rs.status = 'approved'
        GROUP BY sp.id, sp.name, sp.price
        ORDER BY subscription_count DESC
        LIMIT 5
      `);

      // Obtener actividad reciente
      const { rows: recentActivity } = await executeQuery(`
        SELECT
          'subscription' as type,
          rs.id,
          rs.status,
          rs.created_at as date,
          r.name as restaurant_name,
          sp.name as plan_name
        FROM restaurant_subscriptions rs
        LEFT JOIN restaurants r ON rs.restaurant_id = r.id
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        ORDER BY rs.created_at DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          totalRestaurants: parseInt(stats.total_restaurants) || 0,
          activeRestaurants: parseInt(stats.active_restaurants) || 0,
          pendingRestaurants: parseInt(stats.pending_restaurants) || 0,
          totalUsers: parseInt(stats.total_users) || 0,
          totalSongs: parseInt(stats.total_songs) || 0,
          todayRequests: parseInt(stats.today_requests) || 0,
          totalSubscriptions: parseInt(revenueStats[0].total_subscriptions) || 0,
          pendingSubscriptions: parseInt(stats.pending_subscriptions) || 0,
          approvedSubscriptions: parseInt(stats.approved_subscriptions) || 0,
          rejectedSubscriptions: parseInt(stats.rejected_subscriptions) || 0,
          monthlyRevenue: parseFloat(revenueStats[0].monthly_revenue) || 0,
          popularPlans: popularPlans.map(plan => ({
            id: plan.id,
            name: plan.name,
            price: parseFloat(plan.price),
            subscriptionCount: parseInt(plan.subscription_count),
            totalRevenue: parseFloat(plan.total_revenue)
          })),
          recentActivity: recentActivity.map(activity => ({
            type: activity.type,
            id: activity.id,
            status: activity.status,
            date: activity.date,
            restaurantName: activity.restaurant_name,
            planName: activity.plan_name
          }))
        }
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas globales:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas globales',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de suscripciones por período
  async getSubscriptionStatsByPeriod(req, res) {
    try {
      const { period = 'month', planId, startDate, endDate } = req.query;

      let dateFilter = '';
      let dateParams = [];

      if (startDate && endDate) {
        dateFilter = 'AND rs.created_at BETWEEN ? AND ?';
        dateParams = [startDate, endDate];
      } else {
        // Calcular período automáticamente
        const now = new Date();
        switch (period) {
          case 'day':
            dateFilter = 'AND DATE(rs.created_at) = CURDATE()';
            break;
          case 'week':
            dateFilter = 'AND rs.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            break;
          case 'month':
          default:
            dateFilter = 'AND rs.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
            break;
        }
      }

      // Agregar filtro por plan si se especifica
      if (planId) {
        dateFilter += ' AND rs.plan_id = ?';
        dateParams.push(planId);
      }

      // Obtener estadísticas principales
      const { rows: mainStats } = await executeQuery(`
        SELECT
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_subscriptions,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_subscriptions,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_subscriptions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
          SUM(CASE WHEN status = 'approved' THEN sp.price ELSE 0 END) as total_revenue
        FROM restaurant_subscriptions rs
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        WHERE 1=1 ${dateFilter}
      `, dateParams);

      // Obtener estadísticas por plan
      const { rows: planStats } = await executeQuery(`
        SELECT
          sp.id as plan_id,
          sp.name as plan_name,
          sp.price as plan_price,
          COUNT(rs.id) as subscription_count,
          SUM(CASE WHEN rs.status = 'approved' THEN sp.price ELSE 0 END) as plan_revenue,
          COUNT(CASE WHEN rs.status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN rs.status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN rs.status = 'rejected' THEN 1 END) as rejected_count
        FROM subscription_plans sp
        LEFT JOIN restaurant_subscriptions rs ON sp.id = rs.plan_id
        WHERE 1=1 ${dateFilter}
        GROUP BY sp.id, sp.name, sp.price
        ORDER BY subscription_count DESC
      `, dateParams);

      // Calcular tasa de conversión
      const total = parseInt(mainStats[0].total_subscriptions) || 0;
      const approved = parseInt(mainStats[0].approved_subscriptions) || 0;
      const conversionRate = total > 0 ? (approved / total) * 100 : 0;

      res.json({
        success: true,
        data: {
          period,
          startDate: startDate || (period === 'day' ? new Date().toISOString().split('T')[0] : undefined),
          endDate: endDate || new Date().toISOString(),
          totalSubscriptions: total,
          pendingSubscriptions: parseInt(mainStats[0].pending_subscriptions) || 0,
          approvedSubscriptions: approved,
          rejectedSubscriptions: parseInt(mainStats[0].rejected_subscriptions) || 0,
          activeSubscriptions: parseInt(mainStats[0].active_subscriptions) || 0,
          totalRevenue: parseFloat(mainStats[0].total_revenue) || 0,
          conversionRate: conversionRate,
          subscriptionsByPlan: planStats.map(plan => ({
            planId: plan.plan_id,
            planName: plan.plan_name,
            planPrice: parseFloat(plan.plan_price),
            subscriptionCount: parseInt(plan.subscription_count),
            planRevenue: parseFloat(plan.plan_revenue),
            pendingCount: parseInt(plan.pending_count),
            approvedCount: parseInt(plan.approved_count),
            rejectedCount: parseInt(plan.rejected_count),
            conversionRate: plan.subscription_count > 0 ?
              (parseInt(plan.approved_count) / parseInt(plan.subscription_count)) * 100 : 0
          }))
        }
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de suscripciones por período:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas de suscripciones por período',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de actividad del sistema
  async getActivityStats(req, res) {
    try {
      const { days = 30 } = req.query;

      // Obtener actividad de suscripciones
      const { rows: subscriptionActivity } = await executeQuery(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
        FROM restaurant_subscriptions
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [days]);

      // Obtener actividad de restaurantes
      const { rows: restaurantActivity } = await executeQuery(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
          COUNT(CASE WHEN pending_approval = 1 THEN 1 END) as pending
        FROM restaurants
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [days]);

      // Obtener actividad de usuarios
      const { rows: userActivity } = await executeQuery(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total
        FROM registered_users
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [days]);

      res.json({
        success: true,
        data: {
          period: `${days} days`,
          subscriptionActivity: subscriptionActivity.map(activity => ({
            date: activity.date,
            total: parseInt(activity.total),
            pending: parseInt(activity.pending),
            approved: parseInt(activity.approved),
            rejected: parseInt(activity.rejected)
          })),
          restaurantActivity: restaurantActivity.map(activity => ({
            date: activity.date,
            total: parseInt(activity.total),
            active: parseInt(activity.active),
            pending: parseInt(activity.pending)
          })),
          userActivity: userActivity.map(activity => ({
            date: activity.date,
            total: parseInt(activity.total)
          }))
        }
      });
    } catch (error) {
      logger.error('Error al obtener estadísticas de actividad:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas de actividad',
        error: error.message
      });
    }
  }

  // Obtener logs de actividad recientes
  async getRecentActivityLogs(req, res) {
    try {
      const { limit = 50, action } = req.query;

      let query = `
        SELECT
          sl.*,
          rs.restaurant_id,
          r.name as restaurant_name,
          sp.name as plan_name,
          ru.name as performed_by_name
        FROM subscription_logs sl
        LEFT JOIN restaurant_subscriptions rs ON sl.subscription_id = rs.id
        LEFT JOIN restaurants r ON rs.restaurant_id = r.id
        LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
        LEFT JOIN registered_users ru ON sl.performed_by = ru.id
      `;

      const params = [];

      if (action) {
        query += ' WHERE sl.action = ?';
        params.push(action);
      }

      query += ' ORDER BY sl.created_at DESC LIMIT ?';
      params.push(parseInt(limit));

      const { rows } = await executeQuery(query, params);

      res.json({
        success: true,
        data: rows.map(log => ({
          id: log.id,
          subscriptionId: log.subscription_id,
          action: log.action,
          performedBy: log.performed_by,
          performedByName: log.performed_by_name,
          details: log.details ? JSON.parse(log.details) : {},
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          createdAt: log.created_at,
          restaurantInfo: {
            id: log.restaurant_id,
            name: log.restaurant_name
          },
          planInfo: {
            name: log.plan_name
          }
        }))
      });
    } catch (error) {
      logger.error('Error al obtener logs de actividad:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error al obtener logs de actividad',
        error: error.message
      });
    }
  }
}

module.exports = new AdminStatsController();