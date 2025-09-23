// src/controllers/adminController.js
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Obtener restaurants pendientes de aprobación
const getPendingRestaurants = async (req, res) => {
  try {
    const { rows } = await executeQuery(
      `SELECT id, name, owner_name, email, slug, city, country, cuisine_type, 
              description, created_at, verified, pending_approval, plan_selected, 
              payment_proof_path
       FROM restaurants 
       WHERE pending_approval = true AND verified = true 
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      message: 'Pending restaurants retrieved successfully',
      data: {
        pendingRestaurants: rows
      }
    });
  } catch (error) {
    logger.error('Get pending restaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending restaurants'
    });
  }
};

// Aprobar restaurant
const approveRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, payment_proof_path, notes } = req.body;
    const approvedBy = req.user.id; // superadmin id

    const { rows } = await executeQuery(
      'SELECT id FROM restaurants WHERE id = ? AND pending_approval = true',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or already approved'
      });
    }

    await executeQuery(
      `UPDATE restaurants SET 
        pending_approval = false,
        approved_at = CURRENT_TIMESTAMP,
        approved_by = ?,
        plan_selected = ?,
        payment_proof_path = ?
        ${notes ? ', notes = ?' : ''}
       WHERE id = ?`,
      notes ? [approvedBy, plan, payment_proof_path, notes, id] : [approvedBy, plan, payment_proof_path, id]
    );

    logger.info(`Restaurant approved by superadmin: ${id}`);

    res.json({
      success: true,
      message: 'Restaurant approved successfully'
    });
  } catch (error) {
    logger.error('Approve restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve restaurant'
    });
  }
};

// Rechazar restaurant
const rejectRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { rows } = await executeQuery(
      'SELECT id FROM restaurants WHERE id = ? AND pending_approval = true',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or already processed'
      });
    }

    await executeQuery(
      `UPDATE restaurants SET 
        pending_approval = false,
        approved_at = NULL,
        approved_by = NULL,
        reason_rejection = ?
       WHERE id = ?`,
      [reason, id]
    );

    logger.info(`Restaurant rejected by superadmin: ${id}, reason: ${reason}`);

    res.json({
      success: true,
      message: 'Restaurant rejected successfully'
    });
  } catch (error) {
    logger.error('Reject restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject restaurant'
    });
  }
};

// Obtener todas las suscripciones (para superadmin)
const getAllSubscriptions = async (req, res) => {
  try {
    const { status = 'all', limit = 20, offset = 0, search } = req.query;

    let whereConditions = [];
    let queryParams = [];

    // Filtro por estado
    if (status !== 'all') {
      whereConditions.push('s.status = ?');
      queryParams.push(status);
    }

    // Filtro por búsqueda
    if (search && search.trim()) {
      whereConditions.push('(r.name LIKE ? OR r.email LIKE ? OR r.owner_name LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Obtener suscripciones con información del restaurante y plan
    const { rows: subscriptions } = await executeQuery(
      `SELECT
        s.id,
        s.user_id,
        s.plan_id,
        s.status,
        s.payment_method,
        s.amount,
        s.payment_proof_url,
        s.submitted_at,
        s.approved_at,
        s.rejected_at,
        s.rejection_reason,
        s.admin_notes,
        s.expires_at,
        r.name as restaurant_name,
        r.email as restaurant_email,
        r.owner_name,
        r.city,
        r.country,
        sp.name as plan_name,
        sp.price as plan_price,
        sp.period as plan_period
      FROM subscriptions s
      JOIN restaurants r ON s.user_id = r.id
      JOIN subscription_plans sp ON s.plan_id = sp.id
      ${whereClause}
      ORDER BY s.submitted_at DESC
      LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)]
    );

    // Obtener conteos por estado
    const { rows: statusCounts } = await executeQuery(
      `SELECT
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(*) as total
      FROM subscriptions`
    );

    res.json({
      success: true,
      message: 'Subscriptions retrieved successfully',
      data: {
        subscriptions,
        total: statusCounts[0].total,
        pending: statusCounts[0].pending,
        approved: statusCounts[0].approved,
        rejected: statusCounts[0].rejected
      }
    });

  } catch (error) {
    logger.error('Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscriptions',
      error: error.message
    });
  }
};

// Aprobar suscripción
const approveSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedAt, adminNotes } = req.body;

    // Buscar suscripción
    const { rows: subscriptionRows } = await executeQuery(
      'SELECT id, user_id, plan_id, status FROM subscriptions WHERE id = ?',
      [id]
    );

    if (subscriptionRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = subscriptionRows[0];

    if (subscription.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not pending approval'
      });
    }

    // Calcular fecha de expiración
    const approvalDate = approvedAt ? new Date(approvedAt) : new Date();
    const expirationDate = new Date(approvalDate);
    expirationDate.setMonth(expirationDate.getMonth() + 1); // 1 mes por defecto

    // Actualizar suscripción
    await executeQuery(
      `UPDATE subscriptions SET
        status = 'approved',
        approved_at = ?,
        admin_notes = COALESCE(?, admin_notes),
        expires_at = ?
      WHERE id = ?`,
      [approvalDate, adminNotes, expirationDate, id]
    );

    // Actualizar estado del restaurante
    await executeQuery(
      `UPDATE restaurants SET
        subscription_status = 'active',
        subscription_end_date = ?
      WHERE id = ?`,
      [expirationDate, subscription.user_id]
    );

    logger.info(`Subscription approved by admin: ${id}`);

    res.json({
      success: true,
      message: 'Subscription approved successfully',
      data: {
        subscriptionId: id,
        approvedAt: approvalDate,
        expiresAt: expirationDate
      }
    });

  } catch (error) {
    logger.error('Approve subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve subscription',
      error: error.message
    });
  }
};

// Rechazar suscripción
const rejectSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedAt, rejectionReason, adminNotes } = req.body;

    // Buscar suscripción
    const { rows: subscriptionRows } = await executeQuery(
      'SELECT id, user_id, status FROM subscriptions WHERE id = ?',
      [id]
    );

    if (subscriptionRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = subscriptionRows[0];

    if (subscription.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not pending approval'
      });
    }

    const rejectionDate = rejectedAt ? new Date(rejectedAt) : new Date();

    // Actualizar suscripción
    await executeQuery(
      `UPDATE subscriptions SET
        status = 'rejected',
        rejected_at = ?,
        rejection_reason = ?,
        admin_notes = COALESCE(?, admin_notes)
      WHERE id = ?`,
      [rejectionDate, rejectionReason, adminNotes, id]
    );

    // Actualizar estado del restaurante
    await executeQuery(
      `UPDATE restaurants SET
        subscription_status = 'rejected'
      WHERE id = ?`,
      [subscription.user_id]
    );

    logger.info(`Subscription rejected by admin: ${id}, reason: ${rejectionReason}`);

    res.json({
      success: true,
      message: 'Subscription rejected successfully',
      data: {
        subscriptionId: id,
        rejectedAt: rejectionDate,
        rejectionReason
      }
    });

  } catch (error) {
    logger.error('Reject subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject subscription',
      error: error.message
    });
  }
};

// Obtener estadísticas globales
const getGlobalStats = async (req, res) => {
  try {
    // Total users
    const { rows: userRows } = await executeQuery(
      'SELECT COUNT(*) as totalUsers FROM registered_users'
    );

    // Total restaurants
    const { rows: restaurantRows } = await executeQuery(
      'SELECT COUNT(*) as totalRestaurants FROM restaurants'
    );

    // Total requests
    const { rows: requestRows } = await executeQuery(
      'SELECT COALESCE(SUM(total_requests), 0) as totalRequests FROM registered_users'
    );

    // Pending restaurants
    const { rows: pendingRows } = await executeQuery(
      'SELECT COUNT(*) as pendingRestaurants FROM restaurants WHERE pending_approval = true'
    );

    // Subscription stats
    const { rows: subscriptionStats } = await executeQuery(
      `SELECT
        COUNT(CASE WHEN status = 'active' THEN 1 END) as activeSubscriptions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingSubscriptions,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expiredSubscriptions,
        COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) as totalRevenue
      FROM subscriptions`
    );

    const stats = {
      totalUsers: parseInt(userRows[0].totalUsers) || 0,
      totalRestaurants: parseInt(restaurantRows[0].totalRestaurants) || 0,
      totalRequests: parseInt(requestRows[0].totalRequests) || 0,
      pendingRestaurants: parseInt(pendingRows[0].pendingRestaurants) || 0,
      activeSubscriptions: subscriptionStats[0].activeSubscriptions || 0,
      pendingSubscriptions: subscriptionStats[0].pendingSubscriptions || 0,
      expiredSubscriptions: subscriptionStats[0].expiredSubscriptions || 0,
      totalRevenue: parseFloat(subscriptionStats[0].totalRevenue) || 0
    };

    res.json({
      success: true,
      message: 'Global stats retrieved successfully',
      data: stats
    });
  } catch (error) {
    logger.error('Get global stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve global stats'
    });
  }
};

module.exports = {
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getAllSubscriptions,
  approveSubscription,
  rejectSubscription,
  getGlobalStats
};