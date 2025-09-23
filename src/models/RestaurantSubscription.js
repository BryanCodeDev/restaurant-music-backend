// src/models/RestaurantSubscription.js
const { executeQuery } = require('../config/database');

class RestaurantSubscription {
  constructor(data) {
    this.id = data.id;
    this.restaurantId = data.restaurant_id;
    this.planId = data.plan_id;
    this.status = data.status;
    this.paymentMethod = data.payment_method;
    this.paymentProof = data.payment_proof;
    this.rejectionReason = data.rejection_reason;
    this.submittedAt = data.submitted_at;
    this.approvedAt = data.approved_at;
    this.rejectedAt = data.rejected_at;
    this.expiresAt = data.expires_at;
    this.notes = data.notes;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Buscar suscripción por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT rs.*, sp.name as plan_name, sp.price as plan_price,
                sp.period as plan_period, sp.features as plan_features,
                sp.max_requests as plan_max_requests, sp.max_tables as plan_max_tables,
                sp.has_spotify as plan_has_spotify,
                r.name as restaurant_name, r.email as restaurant_email,
                r.city as restaurant_city, r.country as restaurant_country
         FROM restaurant_subscriptions rs
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         LEFT JOIN restaurants r ON rs.restaurant_id = r.id
         WHERE rs.id = ?`,
        [id]
      );

      if (rows.length === 0) return null;

      const subscription = new RestaurantSubscription(rows[0]);
      subscription.planInfo = {
        name: rows[0].plan_name,
        price: rows[0].plan_price,
        period: rows[0].plan_period,
        features: rows[0].plan_features ? JSON.parse(rows[0].plan_features) : [],
        maxRequests: rows[0].plan_max_requests,
        maxTables: rows[0].plan_max_tables,
        hasSpotify: rows[0].plan_has_spotify
      };

      subscription.restaurantInfo = {
        name: rows[0].restaurant_name,
        email: rows[0].restaurant_email,
        city: rows[0].restaurant_city,
        country: rows[0].restaurant_country
      };

      return subscription;
    } catch (error) {
      throw new Error(`Error finding restaurant subscription by ID: ${error.message}`);
    }
  }

  // Buscar suscripciones por restaurante
  static async findByRestaurantId(restaurantId) {
    try {
      const { rows } = await executeQuery(
        `SELECT rs.*, sp.name as plan_name, sp.price as plan_price,
                sp.period as plan_period, sp.features as plan_features,
                sp.max_requests as plan_max_requests, sp.max_tables as plan_max_tables,
                sp.has_spotify as plan_has_spotify
         FROM restaurant_subscriptions rs
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         WHERE rs.restaurant_id = ?
         ORDER BY rs.created_at DESC`,
        [restaurantId]
      );

      return rows.map(row => {
        const subscription = new RestaurantSubscription(row);
        subscription.planInfo = {
          name: row.plan_name,
          price: row.plan_price,
          period: row.plan_period,
          features: row.plan_features ? JSON.parse(row.plan_features) : [],
          maxRequests: row.plan_max_requests,
          maxTables: row.plan_max_tables,
          hasSpotify: row.plan_has_spotify
        };
        return subscription;
      });
    } catch (error) {
      throw new Error(`Error finding restaurant subscriptions: ${error.message}`);
    }
  }

  // Buscar suscripciones por estado
  static async findByStatus(status, limit = 50, offset = 0) {
    try {
      const { rows } = await executeQuery(
        `SELECT rs.*, sp.name as plan_name, sp.price as plan_price,
                sp.period as plan_period, sp.features as plan_features,
                sp.max_requests as plan_max_requests, sp.max_tables as plan_max_tables,
                sp.has_spotify as plan_has_spotify,
                r.name as restaurant_name, r.email as restaurant_email,
                r.city as restaurant_city, r.country as restaurant_country
         FROM restaurant_subscriptions rs
         LEFT JOIN subscription_plans sp ON rs.plan_id = sp.id
         LEFT JOIN restaurants r ON rs.restaurant_id = r.id
         WHERE rs.status = ?
         ORDER BY rs.submitted_at DESC
         LIMIT ? OFFSET ?`,
        [status, limit, offset]
      );

      return rows.map(row => {
        const subscription = new RestaurantSubscription(row);
        subscription.planInfo = {
          name: row.plan_name,
          price: row.plan_price,
          period: row.plan_period,
          features: row.plan_features ? JSON.parse(row.plan_features) : [],
          maxRequests: row.plan_max_requests,
          maxTables: row.plan_max_tables,
          hasSpotify: row.plan_has_spotify
        };
        subscription.restaurantInfo = {
          name: row.restaurant_name,
          email: row.restaurant_email,
          city: row.restaurant_city,
          country: row.restaurant_country
        };
        return subscription;
      });
    } catch (error) {
      throw new Error(`Error finding subscriptions by status: ${error.message}`);
    }
  }

  // Crear nueva suscripción
  static async create(data) {
    try {
      const subscriptionId = data.id || require('crypto').randomUUID();

      await executeQuery(
        `INSERT INTO restaurant_subscriptions (
          id, restaurant_id, plan_id, status, payment_method,
          payment_proof, rejection_reason, submitted_at, approved_at,
          rejected_at, expires_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subscriptionId,
          data.restaurantId,
          data.planId,
          data.status || 'pending',
          data.paymentMethod,
          data.paymentProof || null,
          data.rejectionReason || null,
          data.submittedAt || new Date(),
          data.approvedAt || null,
          data.rejectedAt || null,
          data.expiresAt || null,
          data.notes || null
        ]
      );

      return await RestaurantSubscription.findById(subscriptionId);
    } catch (error) {
      throw new Error(`Error creating restaurant subscription: ${error.message}`);
    }
  }

  // Actualizar suscripción
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      const fieldMap = {
        status: 'status',
        paymentMethod: 'payment_method',
        paymentProof: 'payment_proof',
        rejectionReason: 'rejection_reason',
        approvedAt: 'approved_at',
        rejectedAt: 'rejected_at',
        expiresAt: 'expires_at',
        notes: 'notes'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          updateValues.push(data[key]);
        }
      });

      if (updateFields.length === 0) {
        return this;
      }

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE restaurant_subscriptions SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      // Recargar datos actualizados
      const updated = await RestaurantSubscription.findById(this.id);
      Object.assign(this, updated);

      return this;
    } catch (error) {
      throw new Error(`Error updating restaurant subscription: ${error.message}`);
    }
  }

  // Aprobar suscripción
  async approve(approvedAt = new Date(), expiresAt = null) {
    try {
      // Calcular fecha de expiración si no se proporciona
      if (!expiresAt) {
        const plan = await require('./SubscriptionPlan').findById(this.planId);
        if (plan && plan.period === 'mes') {
          expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }
      }

      await this.update({
        status: 'approved',
        approvedAt: approvedAt,
        expiresAt: expiresAt
      });

      return this;
    } catch (error) {
      throw new Error(`Error approving subscription: ${error.message}`);
    }
  }

  // Rechazar suscripción
  async reject(rejectionReason, rejectedAt = new Date()) {
    try {
      await this.update({
        status: 'rejected',
        rejectionReason: rejectionReason,
        rejectedAt: rejectedAt
      });

      return this;
    } catch (error) {
      throw new Error(`Error rejecting subscription: ${error.message}`);
    }
  }

  // Convertir a JSON
  toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      planId: this.planId,
      status: this.status,
      paymentMethod: this.paymentMethod,
      paymentProof: this.paymentProof,
      rejectionReason: this.rejectionReason,
      submittedAt: this.submittedAt,
      approvedAt: this.approvedAt,
      rejectedAt: this.rejectedAt,
      expiresAt: this.expiresAt,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      planInfo: this.planInfo,
      restaurantInfo: this.restaurantInfo
    };
  }
}

module.exports = RestaurantSubscription;