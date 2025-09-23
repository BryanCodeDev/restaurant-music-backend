// src/models/SubscriptionPlan.js
const { executeQuery } = require('../config/database');

class SubscriptionPlan {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.price = data.price;
    this.period = data.period;
    this.description = data.description;
    this.features = data.features ? JSON.parse(data.features) : [];
    this.limitations = data.limitations ? JSON.parse(data.limitations) : [];
    this.color = data.color;
    this.popular = data.popular;
    this.maxRequests = data.max_requests;
    this.maxTables = data.max_tables;
    this.hasSpotify = data.has_spotify;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Buscar plan por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT id, name, price, period, description, features, limitations,
                color, popular, max_requests, max_tables, has_spotify,
                created_at, updated_at
         FROM subscription_plans WHERE id = ?`,
        [id]
      );

      return rows.length > 0 ? new SubscriptionPlan(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding subscription plan by ID: ${error.message}`);
    }
  }

  // Obtener todos los planes
  static async findAll() {
    try {
      const { rows } = await executeQuery(
        `SELECT id, name, price, period, description, features, limitations,
                color, popular, max_requests, max_tables, has_spotify,
                created_at, updated_at
         FROM subscription_plans ORDER BY price ASC`
      );

      return rows.map(row => new SubscriptionPlan(row));
    } catch (error) {
      throw new Error(`Error finding subscription plans: ${error.message}`);
    }
  }

  // Crear nuevo plan
  static async create(data) {
    try {
      const planId = data.id;

      await executeQuery(
        `INSERT INTO subscription_plans (
          id, name, price, period, description, features, limitations,
          color, popular, max_requests, max_tables, has_spotify
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          planId,
          data.name,
          data.price,
          data.period,
          data.description || null,
          JSON.stringify(data.features || []),
          JSON.stringify(data.limitations || []),
          data.color || null,
          data.popular || false,
          data.maxRequests || null,
          data.maxTables || null,
          data.hasSpotify || false
        ]
      );

      return await SubscriptionPlan.findById(planId);
    } catch (error) {
      throw new Error(`Error creating subscription plan: ${error.message}`);
    }
  }

  // Actualizar plan
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      const fieldMap = {
        name: 'name',
        price: 'price',
        period: 'period',
        description: 'description',
        features: 'features',
        limitations: 'limitations',
        color: 'color',
        popular: 'popular',
        maxRequests: 'max_requests',
        maxTables: 'max_tables',
        hasSpotify: 'has_spotify'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          if (key === 'features' || key === 'limitations') {
            updateValues.push(JSON.stringify(data[key]));
          } else {
            updateValues.push(data[key]);
          }
        }
      });

      if (updateFields.length === 0) {
        return this;
      }

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE subscription_plans SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      // Recargar datos actualizados
      const updated = await SubscriptionPlan.findById(this.id);
      Object.assign(this, updated);

      return this;
    } catch (error) {
      throw new Error(`Error updating subscription plan: ${error.message}`);
    }
  }

  // Eliminar plan
  async delete() {
    try {
      await executeQuery(
        'DELETE FROM subscription_plans WHERE id = ?',
        [this.id]
      );

      return true;
    } catch (error) {
      throw new Error(`Error deleting subscription plan: ${error.message}`);
    }
  }

  // Convertir a JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      price: this.price,
      period: this.period,
      description: this.description,
      features: this.features,
      limitations: this.limitations,
      color: this.color,
      popular: this.popular,
      maxRequests: this.maxRequests,
      maxTables: this.maxTables,
      hasSpotify: this.hasSpotify,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = SubscriptionPlan;