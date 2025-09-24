// src/controllers/reviewController.js - Controlador para gestión de reviews de restaurantes
const { RestaurantReview, Restaurant, RegisteredUser, ActivityLog } = require('../models');
const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const { formatSuccessResponse, formatErrorResponse } = require('../utils/helpers');

class ReviewController {
  // Crear nueva review
  async createReview(req, res) {
    try {
      const { user } = req;
      const { restaurantId, rating, title, comment, musicQualityRating, serviceRating, ambianceRating, isAnonymous } = req.body;

      if (!restaurantId || !rating) {
        return res.status(400).json(
          formatErrorResponse('El ID del restaurante y la calificación son requeridos')
        );
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json(
          formatErrorResponse('La calificación debe estar entre 1 y 5')
        );
      }

      if (user.type !== 'registered_user') {
        return res.status(403).json(
          formatErrorResponse('Solo usuarios registrados pueden crear reviews')
        );
      }

      // Verificar que el restaurante existe
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json(
          formatErrorResponse('Restaurante no encontrado')
        );
      }

      // Verificar que el usuario no haya hecho una review antes
      const existingReview = await RestaurantReview.getByUser(user.id);
      const hasReviewed = existingReview.some(review => review.restaurantId === restaurantId);

      if (hasReviewed) {
        return res.status(409).json(
          formatErrorResponse('Ya has hecho una review para este restaurante')
        );
      }

      const reviewData = {
        restaurantId,
        registeredUserId: user.id,
        rating: parseInt(rating),
        title: title || null,
        comment: comment || null,
        musicQualityRating: musicQualityRating ? parseInt(musicQualityRating) : null,
        serviceRating: serviceRating ? parseInt(serviceRating) : null,
        ambianceRating: ambianceRating ? parseInt(ambianceRating) : null,
        isAnonymous: isAnonymous || false
      };

      const review = await RestaurantReview.create(reviewData);

      // Actualizar rating del restaurante
      await RestaurantReview.updateRestaurantRating(restaurantId);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'review_created',
        entityType: 'restaurant_review',
        entityId: review.id,
        details: {
          restaurantId,
          rating,
          title,
          isAnonymous
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Review creada: ${review.id} para restaurante ${restaurantId} por usuario ${user.id}`);

      res.status(201).json(formatSuccessResponse('Review creada exitosamente', {
        review: review.toJSON()
      }));

    } catch (error) {
      logger.error('Error al crear review:', error);
      res.status(500).json(
        formatErrorResponse('Error al crear review', error.message)
      );
    }
  }

  // Obtener reviews de un restaurante
  async getRestaurantReviews(req, res) {
    try {
      const { restaurantId } = req.params;
      const { limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

      // Verificar que el restaurante existe
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json(
          formatErrorResponse('Restaurante no encontrado')
        );
      }

      const reviews = await RestaurantReview.getByRestaurant(
        restaurantId,
        parseInt(limit),
        parseInt(offset),
        sortBy,
        sortOrder
      );

      // Obtener estadísticas de reviews
      const { rows: statsRows } = await executeQuery(
        `SELECT
          AVG(rating) as avg_rating,
          COUNT(*) as total_reviews,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_stars,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_stars,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_stars,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_stars,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
         FROM restaurant_reviews
         WHERE restaurant_id = ?`,
        [restaurantId]
      );

      const stats = statsRows[0];

      res.json(formatSuccessResponse('Reviews obtenidas exitosamente', {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          rating: restaurant.rating,
          totalReviews: restaurant.totalReviews
        },
        reviews,
        stats: {
          averageRating: parseFloat(stats.avg_rating) || 0,
          totalReviews: parseInt(stats.total_reviews) || 0,
          ratingDistribution: {
            5: parseInt(stats.five_stars) || 0,
            4: parseInt(stats.four_stars) || 0,
            3: parseInt(stats.three_stars) || 0,
            2: parseInt(stats.two_stars) || 0,
            1: parseInt(stats.one_star) || 0
          }
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: reviews.length === parseInt(limit)
        }
      }));

    } catch (error) {
      logger.error('Error al obtener reviews del restaurante:', error);
      res.status(500).json(
        formatErrorResponse('Error al obtener reviews', error.message)
      );
    }
  }

  // Obtener reviews del usuario
  async getUserReviews(req, res) {
    try {
      const { user } = req;
      const { limit = 20, offset = 0 } = req.query;

      if (user.type !== 'registered_user') {
        return res.status(403).json(
          formatErrorResponse('Solo usuarios registrados pueden ver sus reviews')
        );
      }

      const reviews = await RestaurantReview.getByUser(
        user.id,
        parseInt(limit),
        parseInt(offset)
      );

      res.json(formatSuccessResponse('Reviews del usuario obtenidas exitosamente', {
        reviews,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: reviews.length === parseInt(limit)
        }
      }));

    } catch (error) {
      logger.error('Error al obtener reviews del usuario:', error);
      res.status(500).json(
        formatErrorResponse('Error al obtener reviews del usuario', error.message)
      );
    }
  }

  // Obtener review por ID
  async getReviewById(req, res) {
    try {
      const { id } = req.params;

      const review = await RestaurantReview.findById(id);

      if (!review) {
        return res.status(404).json(
          formatErrorResponse('Review no encontrada')
        );
      }

      res.json(formatSuccessResponse('Review obtenida exitosamente', {
        review: review.toJSON()
      }));

    } catch (error) {
      logger.error('Error al obtener review:', error);
      res.status(500).json(
        formatErrorResponse('Error al obtener review', error.message)
      );
    }
  }

  // Actualizar review
  async updateReview(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { rating, title, comment, musicQualityRating, serviceRating, ambianceRating } = req.body;

      const review = await RestaurantReview.findById(id);

      if (!review) {
        return res.status(404).json(
          formatErrorResponse('Review no encontrada')
        );
      }

      if (review.registeredUserId !== user.id) {
        return res.status(403).json(
          formatErrorResponse('Solo el autor puede modificar la review')
        );
      }

      const updateData = {};
      if (rating !== undefined) {
        if (rating < 1 || rating > 5) {
          return res.status(400).json(
            formatErrorResponse('La calificación debe estar entre 1 y 5')
          );
        }
        updateData.rating = parseInt(rating);
      }
      if (title !== undefined) updateData.title = title;
      if (comment !== undefined) updateData.comment = comment;
      if (musicQualityRating !== undefined) updateData.musicQualityRating = parseInt(musicQualityRating);
      if (serviceRating !== undefined) updateData.serviceRating = parseInt(serviceRating);
      if (ambianceRating !== undefined) updateData.ambianceRating = parseInt(ambianceRating);

      await review.update(updateData);

      // Actualizar rating del restaurante
      await RestaurantReview.updateRestaurantRating(review.restaurantId);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'review_updated',
        entityType: 'restaurant_review',
        entityId: review.id,
        details: updateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Review actualizada: ${review.id} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Review actualizada exitosamente', {
        review: review.toJSON()
      }));

    } catch (error) {
      logger.error('Error al actualizar review:', error);
      res.status(500).json(
        formatErrorResponse('Error al actualizar review', error.message)
      );
    }
  }

  // Eliminar review
  async deleteReview(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      const review = await RestaurantReview.findById(id);

      if (!review) {
        return res.status(404).json(
          formatErrorResponse('Review no encontrada')
        );
      }

      if (review.registeredUserId !== user.id) {
        return res.status(403).json(
          formatErrorResponse('Solo el autor puede eliminar la review')
        );
      }

      const restaurantId = review.restaurantId;
      await review.deleteById(id);

      // Actualizar rating del restaurante
      await RestaurantReview.updateRestaurantRating(restaurantId);

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'review_deleted',
        entityType: 'restaurant_review',
        entityId: id,
        details: { restaurantId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Review eliminada: ${id} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Review eliminada exitosamente'));

    } catch (error) {
      logger.error('Error al eliminar review:', error);
      res.status(500).json(
        formatErrorResponse('Error al eliminar review', error.message)
      );
    }
  }

  // Marcar review como útil
  async voteHelpful(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      if (user.type !== 'registered_user') {
        return res.status(403).json(
          formatErrorResponse('Solo usuarios registrados pueden votar')
        );
      }

      const review = await RestaurantReview.findById(id);

      if (!review) {
        return res.status(404).json(
          formatErrorResponse('Review no encontrada')
        );
      }

      // Verificar que el usuario no sea el autor de la review
      if (review.registeredUserId === user.id) {
        return res.status(400).json(
          formatErrorResponse('No puedes votar tu propia review')
        );
      }

      await review.voteHelpful();

      // Log de actividad
      await ActivityLog.create({
        userId: user.id,
        action: 'review_voted_helpful',
        entityType: 'restaurant_review',
        entityId: id,
        details: { restaurantId: review.restaurantId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Review marcada como útil: ${id} por usuario ${user.id}`);

      res.json(formatSuccessResponse('Review marcada como útil exitosamente', {
        review: review.toJSON()
      }));

    } catch (error) {
      logger.error('Error al votar review como útil:', error);
      res.status(500).json(
        formatErrorResponse('Error al votar review', error.message)
      );
    }
  }

  // Obtener estadísticas de reviews
  async getReviewStats(req, res) {
    try {
      const { restaurantId } = req.params;

      if (restaurantId) {
        // Estadísticas específicas de un restaurante
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
          return res.status(404).json(
            formatErrorResponse('Restaurante no encontrado')
          );
        }

        const { rows } = await executeQuery(
          `SELECT
            AVG(rating) as avg_rating,
            COUNT(*) as total_reviews,
            COUNT(CASE WHEN rating = 5 THEN 1 END) as five_stars,
            COUNT(CASE WHEN rating = 4 THEN 1 END) as four_stars,
            COUNT(CASE WHEN rating = 3 THEN 1 END) as three_stars,
            COUNT(CASE WHEN rating = 2 THEN 1 END) as two_stars,
            COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
            AVG(music_quality_rating) as avg_music_rating,
            AVG(service_rating) as avg_service_rating,
            AVG(ambiance_rating) as avg_ambiance_rating
           FROM restaurant_reviews
           WHERE restaurant_id = ?`,
          [restaurantId]
        );

        const stats = rows[0];

        res.json(formatSuccessResponse('Estadísticas de reviews del restaurante', {
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            rating: restaurant.rating,
            totalReviews: restaurant.totalReviews
          },
          stats: {
            averageRating: parseFloat(stats.avg_rating) || 0,
            totalReviews: parseInt(stats.total_reviews) || 0,
            ratingDistribution: {
              5: parseInt(stats.five_stars) || 0,
              4: parseInt(stats.four_stars) || 0,
              3: parseInt(stats.three_stars) || 0,
              2: parseInt(stats.two_stars) || 0,
              1: parseInt(stats.one_star) || 0
            },
            averageMusicRating: parseFloat(stats.avg_music_rating) || 0,
            averageServiceRating: parseFloat(stats.avg_service_rating) || 0,
            averageAmbianceRating: parseFloat(stats.avg_ambiance_rating) || 0
          }
        }));

      } else {
        // Estadísticas generales del sistema
        const { rows } = await executeQuery(
          `SELECT
            COUNT(*) as total_reviews,
            AVG(rating) as avg_rating,
            COUNT(DISTINCT restaurant_id) as restaurants_with_reviews,
            COUNT(DISTINCT registered_user_id) as users_who_reviewed
           FROM restaurant_reviews`
        );

        const stats = rows[0];

        res.json(formatSuccessResponse('Estadísticas generales de reviews', {
          stats: {
            totalReviews: parseInt(stats.total_reviews) || 0,
            averageRating: parseFloat(stats.avg_rating) || 0,
            restaurantsWithReviews: parseInt(stats.restaurants_with_reviews) || 0,
            usersWhoReviewed: parseInt(stats.users_who_reviewed) || 0
          }
        }));
      }

    } catch (error) {
      logger.error('Error al obtener estadísticas de reviews:', error);
      res.status(500).json(
        formatErrorResponse('Error al obtener estadísticas de reviews', error.message)
      );
    }
  }
}

module.exports = new ReviewController();