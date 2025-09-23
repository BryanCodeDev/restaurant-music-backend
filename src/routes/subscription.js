// src/routes/subscription.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticateToken, requireRestaurant, requireSuperAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// =============================
// RUTAS PÚBLICAS (con auth)
// =============================

// Obtener todos los planes
router.get('/plans', subscriptionController.getPlans);

// Obtener plan específico
router.get('/plans/:id', subscriptionController.getPlan);

// Obtener suscripción de un restaurante específico
router.get('/restaurants/:id/subscription', subscriptionController.getRestaurantSubscription);

// =============================
// RUTAS DE RESTAURANTE
// =============================

// Actualizar plan de restaurante (requiere ser el propietario)
router.put('/restaurants/:id/plan', requireRestaurant, subscriptionController.updateRestaurantPlan);

// Cancelar suscripción de restaurante
router.delete('/restaurants/:id/subscription', requireRestaurant, subscriptionController.cancelRestaurantSubscription);

// =============================
// RUTAS DE ADMIN
// =============================

// Aprobar suscripción de restaurante (solo superadmin)
router.put('/restaurants/:id/subscription/approve', requireSuperAdmin, subscriptionController.approveRestaurantSubscription);

module.exports = router;