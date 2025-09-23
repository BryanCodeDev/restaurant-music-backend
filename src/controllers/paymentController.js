// src/controllers/paymentController.js
const { executeQuery } = require('../config/database');
const { generateQRCode } = require('../services/qrService');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

class PaymentController {
  // Subir comprobante de pago
  async uploadPaymentProof(req, res) {
    try {
      const { user } = req;
      const { subscriptionId, paymentMethod } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se ha proporcionado ningún archivo'
        });
      }

      // Validar que el usuario sea el propietario de la suscripción
      if (user.type === 'restaurant') {
        const { rows: subscriptionRows } = await executeQuery(
          'SELECT id, user_id FROM subscriptions WHERE id = ? AND user_id = ?',
          [subscriptionId, user.id]
        );

        if (subscriptionRows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para subir comprobante a esta suscripción'
          });
        }
      }

      // Generar nombre único para el archivo
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `payment-proof-${subscriptionId}-${Date.now()}${fileExtension}`;
      const uploadPath = path.join('uploads', 'payment-proofs', fileName);

      // Crear directorio si no existe
      const dir = path.dirname(uploadPath);
      await fs.mkdir(dir, { recursive: true });

      // Mover archivo
      await fs.rename(req.file.path, uploadPath);

      const fileUrl = `/uploads/payment-proofs/${fileName}`;
      const fileId = uuidv4();

      // Actualizar suscripción con el comprobante
      await executeQuery(
        `UPDATE subscriptions 
         SET payment_proof_url = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [fileUrl, paymentMethod, subscriptionId]
      );

      logger.info(`Payment proof uploaded: ${fileName} for subscription ${subscriptionId}`);

      res.json({
        success: true,
        message: 'Comprobante subido exitosamente',
        data: {
          fileUrl,
          fileId,
          uploadedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error uploading payment proof:', error);
      res.status(500).json({
        success: false,
        message: 'Error al subir comprobante',
        error: error.message
      });
    }
  }

  // Obtener comprobante de pago
  async getPaymentProof(req, res) {
    try {
      const { fileId } = req.params;
      const { user } = req;

      // Buscar el archivo por fileId o por URL
      const { rows } = await executeQuery(
        'SELECT payment_proof_url FROM subscriptions WHERE payment_proof_url LIKE ?',
        [`%${fileId}%`]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Comprobante no encontrado'
        });
      }

      const fileUrl = rows[0].payment_proof_url;
      const filePath = path.join(process.cwd(), fileUrl);

      // Verificar que el archivo existe
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'Archivo no encontrado en el servidor'
        });
      }

      // Enviar archivo
      res.sendFile(filePath);

    } catch (error) {
      logger.error('Error getting payment proof:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener comprobante',
        error: error.message
      });
    }
  }

  // Generar código QR para pago
  async generatePaymentQR(req, res) {
    try {
      const { user } = req;
      const { amount, planId, subscriptionId } = req.body;

      // Validar datos requeridos
      if (!amount || !planId) {
        return res.status(400).json({
          success: false,
          message: 'Amount y planId son requeridos'
        });
      }

      // Obtener información del plan
      const { rows: planRows } = await executeQuery(
        'SELECT id, name, price FROM subscription_plans WHERE id = ?',
        [planId]
      );

      if (planRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Plan no encontrado'
        });
      }

      const plan = planRows[0];

      // Verificar que el monto coincida con el precio del plan
      if (parseFloat(amount) !== parseFloat(plan.price)) {
        return res.status(400).json({
          success: false,
          message: 'El monto no coincide con el precio del plan'
        });
      }

      // Crear datos del QR
      const qrData = {
        type: 'payment',
        planId,
        planName: plan.name,
        amount: parseFloat(amount),
        currency: 'COP',
        subscriptionId: subscriptionId || null,
        restaurantId: user.type === 'restaurant' ? user.id : null,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
      };

      // Generar QR code
      const qrCodeFileName = `payment-qr-${Date.now()}.png`;
      const qrCodePath = path.join('uploads', 'qr-codes', qrCodeFileName);

      // Crear directorio si no existe
      const dir = path.dirname(qrCodePath);
      await fs.mkdir(dir, { recursive: true });

      // Generar QR con los datos
      const qrCodeUrl = await generateQRCode(JSON.stringify(qrData), qrCodePath);

      logger.info(`Payment QR generated: ${qrCodeFileName} for plan ${planId}`);

      res.json({
        success: true,
        message: 'Código QR generado exitosamente',
        data: {
          qrCodeUrl: `/uploads/qr-codes/${qrCodeFileName}`,
          qrData: qrData,
          expiresAt: qrData.expiresAt
        }
      });

    } catch (error) {
      logger.error('Error generating payment QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar código QR',
        error: error.message
      });
    }
  }

  // Obtener métodos de pago disponibles
  async getPaymentMethods(req, res) {
    try {
      const paymentMethods = [
        {
          id: 'qr',
          name: 'Código QR',
          description: 'Genera un código QR para pago',
          enabled: true
        },
        {
          id: 'transfer',
          name: 'Transferencia Bancaria',
          description: 'Transferencia a cuenta bancaria',
          enabled: true,
          bankInfo: {
            bank: 'Bancolombia',
            account: '123-456789-0',
            accountType: 'Cuenta de ahorros',
            beneficiary: 'Restaurant Music App'
          }
        },
        {
          id: 'card',
          name: 'Tarjeta de Crédito',
          description: 'Pago con tarjeta de crédito (próximamente)',
          enabled: false
        }
      ];

      res.json({
        success: true,
        data: paymentMethods
      });

    } catch (error) {
      logger.error('Error getting payment methods:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener métodos de pago',
        error: error.message
      });
    }
  }

  // Verificar estado de pago por QR
  async checkPaymentStatus(req, res) {
    try {
      const { qrCodeId } = req.params;

      // Buscar suscripción relacionada con el QR
      const { rows } = await executeQuery(
        `SELECT s.*, sp.name as plan_name, sp.price
         FROM subscriptions s
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE s.payment_proof_url LIKE ? OR s.id = ?`,
        [`%${qrCodeId}%`, qrCodeId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pago no encontrado'
        });
      }

      const subscription = rows[0];

      res.json({
        success: true,
        data: {
          subscriptionId: subscription.id,
          status: subscription.status,
          planName: subscription.plan_name,
          amount: subscription.amount,
          paymentMethod: subscription.payment_method,
          submittedAt: subscription.submitted_at,
          approvedAt: subscription.approved_at,
          rejectedAt: subscription.rejected_at,
          rejectionReason: subscription.rejection_reason
        }
      });

    } catch (error) {
      logger.error('Error checking payment status:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar estado de pago',
        error: error.message
      });
    }
  }
}

module.exports = new PaymentController();