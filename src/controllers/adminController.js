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

module.exports = {
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant
};