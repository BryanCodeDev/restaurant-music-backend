// src/models/RestaurantReview.js - Modelo para reviews de restaurantes
const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Restaurant = require('./Restaurant');
const { RegisteredUser } = require('./User');

class RestaurantReview {
  constructor(data) {
    this.id = data.id;
    this.restaurantId = data.restaurant_id;
    this.registeredUserId = data.registered_user_id;
    this.rating = data.rating;
    this.title = data.title;
    this.comment = data.comment;
    this.musicQualityRating = data.music_quality_rating;
    this.serviceRating = data.service_rating;
    this.ambianceRating = data.ambiance_rating;
    this.isAnonymous = data.is_anonymous;
    this.helpfulVotes = data.helpful_votes;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.restaurant = data.restaurant ? new Restaurant(data.restaurant) : null;
    this.user = data.user ? new RegisteredUser(data.user) : null;
  }

  // Crear nueva review
  static async create(data) {
    try {
      const reviewId = data.id || uuidv4();

      await executeQuery(
        `INSERT INTO restaurant_reviews (
          id, restaurant_id, registered_user_id, rating, title, comment,
          music_quality_rating, service_rating, ambiance_rating, is_anonymous,
          helpful_votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reviewId, data.restaurantId, data.registeredUserId, data.rating,
          data.title || null, data.comment || null, data.musicQualityRating || null,
          data.serviceRating || null, data.ambianceRating || null, data.isAnonymous || false,
          0
        ]
      );

      // Actualizar rating promedio del restaurante
      await RestaurantReview.updateRestaurantRating(data.restaurantId);

      return await RestaurantReview.findById(reviewId);
    } catch (error) {
      throw new Error(`Error creating review: ${error.message}`);
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const { rows } = await executeQuery(
        `SELECT rr.*, r.name as restaurant_name, r.slug as restaurant_slug,
                ru.name as user_name, ru.avatar as user_avatar
         FROM restaurant_reviews rr
         LEFT JOIN restaurants r ON rr.restaurant_id = r.id
         LEFT JOIN registered_users ru ON rr.registered_user_id = ru.id
         WHERE rr.id = ?`,
        [id]
      );

      if (rows.length > 0) {
        const row = rows[0];
        row.restaurant = { name: row.restaurant_name, slug: row.restaurant_slug };
        row.user = { name: row.user_name, avatar: row.user_avatar };
        return new RestaurantReview(row);
      }
      return null;
    } catch (error) {
      throw new Error(`Error finding review by ID: ${error.message}`);
    }
  }

  // Obtener reviews por restaurante
  static async getByRestaurant(restaurantId, limit = 20, offset = 0) {
    try {
      const { rows } = await executeQuery(
        `SELECT rr.*, ru.name as user_name, ru.avatar as user_avatar
         FROM restaurant_reviews rr
         LEFT JOIN registered_users ru ON rr.registered_user_id = ru.id
         WHERE rr.restaurant_id = ?
         ORDER BY rr.created_at DESC
         LIMIT ? OFFSET ?`,
        [restaurantId, limit, offset]
      );

      return rows.map(row => {
        row.user = { name: row.user_name, avatar: row.user_avatar };
        return new RestaurantReview(row);
      });
    } catch (error) {
      throw new Error(`Error getting restaurant reviews: ${error.message}`);
    }
  }

  // Obtener reviews por usuario
  static async getByUser(registeredUserId, limit = 20) {
    try {
      const { rows } = await executeQuery(
        `SELECT rr.*, r.name as restaurant_name
         FROM restaurant_reviews rr
         JOIN restaurants r ON rr.restaurant_id = r.id
         WHERE rr.registered_user_id = ?
         ORDER BY rr.created_at DESC
         LIMIT ?`,
        [registeredUserId, limit]
      );

      return rows.map(row => {
        row.restaurant = { name: row.restaurant_name };
        return new RestaurantReview(row);
      });
    } catch (error) {
      throw new Error(`Error getting user reviews: ${error.message}`);
    }
  }

  // Actualizar review
  async update(data) {
    try {
      const updateFields = [];
      const updateValues = [];

      const fieldMap = {
        title: 'title',
        comment: 'comment',
        rating: 'rating',
        musicQualityRating: 'music_quality_rating',
        serviceRating: 'service_rating',
        ambianceRating: 'ambiance_rating',
        isAnonymous: 'is_anonymous'
      };

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && fieldMap[key]) {
          updateFields.push(`${fieldMap[key]} = ?`);
          updateValues.push(data[key]);
        }
      });

      if (updateFields.length === 0) return this;

      updateValues.push(this.id);

      await executeQuery(
        `UPDATE restaurant_reviews SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      // Actualizar rating del restaurante si cambió el rating general
      if (data.rating !== undefined && data.rating !== this.rating) {
        await RestaurantReview.updateRestaurantRating(this.restaurantId);
      }

      const updated = await RestaurantReview.findById(this.id);
      Object.assign(this, updated);
      return this;
    } catch (error) {
      throw new Error(`Error updating review: ${error.message}`);
    }
  }

  // Eliminar review
  static async deleteById(id) {
    try {
      const { rows } = await executeQuery(
        'SELECT restaurant_id FROM restaurant_reviews WHERE id = ?',
        [id]
      );

      if (rows.length > 0) {
        const restaurantId = rows[0].restaurant_id;
        await executeQuery('DELETE FROM restaurant_reviews WHERE id = ?', [id]);
        await RestaurantReview.updateRestaurantRating(restaurantId);
        return true;
      }
      return false;
    } catch (error) {
      throw new Error(`Error deleting review: ${error.message}`);
    }
  }

  // Vote útil (incrementar helpful_votes)
  async voteHelpful() {
    try {
      await executeQuery(
        'UPDATE restaurant_reviews SET helpful_votes = helpful_votes + 1 WHERE id = ?',
        [this.id]
      );
      this.helpfulVotes += 1;
      return this;
    } catch (error) {
      throw new Error(`Error voting helpful: ${error.message}`);
    }
  }

  // Actualizar rating promedio del restaurante
  static async updateRestaurantRating(restaurantId) {
    try {
      const { rows } = await executeQuery(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
         FROM restaurant_reviews 
         WHERE restaurant_id = ?`,
        [restaurantId]
      );

      if (rows.length > 0) {
        const { avg_rating, total_reviews } = rows[0];
        await executeQuery(
          'UPDATE restaurants SET rating = ?, total_reviews = ? WHERE id = ?',
          [parseFloat(avg_rating) || 0.00, total_reviews, restaurantId]
        );
      }
    } catch (error) {
      throw new Error(`Error updating restaurant rating: ${error.message}`);
    }
  }

  // Serializar para JSON
  toJSON() {
    return {
      id: this.id,
      restaurantId: this.restaurantId,
      registeredUserId: this.registeredUserId,
      rating: this.rating,
      title: this.title,
      comment: this.comment,
      musicQualityRating: this.musicQualityRating,
      serviceRating: this.serviceRating,
      ambianceRating: this.ambianceRating,
      isAnonymous: this.isAnonymous,
      helpfulVotes: this.helpfulVotes,
      restaurant: this.restaurant ? this.restaurant.toJSON() : null,
      user: this.user ? this.user.toJSON() : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = RestaurantReview;