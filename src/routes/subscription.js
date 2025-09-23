// src/routes/subscription.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticateToken, requireRestaurant, requireSuperAdmin } = require('../middleware/auth');
const { uploadPaymentProof } = require('../middleware/upload');

// =============================
// RUTAS PÚBLICAS (sin auth)
// =============================

// Crear nueva suscripción (puede ser sin autenticación para nuevos usuarios)
router.post('/', uploadPaymentProof, subscriptionController.createSubscription);

// Obtener todos los planes (público)
router.get('/plans', subscriptionController.getPlans);

// Obtener plan específico (público)
router.get('/plans/:id', subscriptionController.getPlan);

// =============================
// RUTAS CON AUTENTICACIÓN
// =============================

// Todas las rutas siguientes requieren autenticación
router.use(authenticateToken);

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

// Obtener suscripciones pendientes (admin)
router.get('/admin/pending', requireSuperAdmin, subscriptionController.getPendingSubscriptions);

// Obtener suscripción por ID (admin)
router.get('/admin/:id', requireSuperAdmin, subscriptionController.getSubscriptionById);

// Aprobar suscripción (admin)
router.put('/admin/:id/approve', requireSuperAdmin, subscriptionController.approveSubscription);

// Rechazar suscripción (admin)
router.put('/admin/:id/reject', requireSuperAdmin, subscriptionController.rejectSubscription);

// Obtener estadísticas de suscripciones (admin)
router.get('/admin/stats/overview', requireSuperAdmin, subscriptionController.getSubscriptionStats);

module.exports = router;