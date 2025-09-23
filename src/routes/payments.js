// src/routes/payments.js
const express = require('express');
const multer = require('multer');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// Configuración de multer para upload de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: function (req, file, cb) {
    // Validar tipos de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG) y PDF.'), false);
    }
  }
});

// Validaciones
const uploadPaymentProofValidation = [
  body('subscriptionId')
    .notEmpty()
    .withMessage('Subscription ID es requerido'),
  body('paymentMethod')
    .isIn(['qr', 'transfer', 'card'])
    .withMessage('Método de pago inválido')
];

const generateQRValidation = [
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount debe ser un número positivo'),
  body('planId')
    .notEmpty()
    .withMessage('Plan ID es requerido'),
  body('subscriptionId')
    .optional()
    .isUUID()
    .withMessage('Subscription ID debe ser un UUID válido')
];

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// =============================
// RUTAS DE PAGOS
// =============================

// Subir comprobante de pago
router.post('/upload-proof',
  upload.single('paymentProof'),
  uploadPaymentProofValidation,
  validate,
  paymentController.uploadPaymentProof
);

// Obtener comprobante de pago
router.get('/proof/:fileId',
  param('fileId')
    .notEmpty()
    .withMessage('File ID es requerido'),
  validate,
  paymentController.getPaymentProof
);

// Generar código QR para pago
router.post('/generate-qr',
  generateQRValidation,
  validate,
  paymentController.generatePaymentQR
);

// Obtener métodos de pago disponibles
router.get('/methods',
  paymentController.getPaymentMethods
);

// Verificar estado de pago por QR
router.get('/status/:qrCodeId',
  param('qrCodeId')
    .notEmpty()
    .withMessage('QR Code ID es requerido'),
  validate,
  paymentController.checkPaymentStatus
);

module.exports = router;