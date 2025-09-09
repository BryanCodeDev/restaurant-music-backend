// src/services/qrService.js
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

// Configuración del QR
const QR_CONFIG = {
  width: parseInt(process.env.QR_CODE_SIZE) || 300,
  margin: parseInt(process.env.QR_CODE_MARGIN) || 2,
  color: {
    dark: process.env.QR_CODE_COLOR_DARK || '#000000',
    light: process.env.QR_CODE_COLOR_LIGHT || '#FFFFFF'
  },
  errorCorrectionLevel: 'M'
};

// Crear directorio si no existe
const ensureQRDirectory = async () => {
  const qrDir = path.join(process.cwd(), 'uploads', 'qr-codes');
  
  try {
    await fs.access(qrDir);
  } catch {
    await fs.mkdir(qrDir, { recursive: true });
    logger.info(`Created QR codes directory: ${qrDir}`);
  }
  
  return qrDir;
};

// Generar QR code para restaurante
const generateQRCode = async (restaurantId, slug) => {
  try {
    const qrDir = await ensureQRDirectory();
    const fileName = `${slug}-qr.png`;
    const filePath = path.join(qrDir, fileName);
    
    // URL que apuntará a la aplicación del cliente
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrUrl = `${frontendUrl}/restaurant/${slug}`;
    
    // Generar QR code
    await QRCode.toFile(filePath, qrUrl, {
      ...QR_CONFIG,
      type: 'png'
    });
    
    logger.info(`QR code generated for restaurant ${slug}: ${fileName}`);
    
    // Retornar path relativo para la API
    return `/uploads/qr-codes/${fileName}`;
    
  } catch (error) {
    logger.error(`Error generating QR code for ${slug}:`, error.message);
    throw new Error('Failed to generate QR code');
  }
};

// Generar QR code personalizado con datos adicionales
const generateCustomQRCode = async (data, fileName) => {
  try {
    const qrDir = await ensureQRDirectory();
    const filePath = path.join(qrDir, fileName);
    
    // Generar QR code con datos personalizados
    await QRCode.toFile(filePath, JSON.stringify(data), {
      ...QR_CONFIG,
      type: 'png'
    });
    
    logger.info(`Custom QR code generated: ${fileName}`);
    
    return `/uploads/qr-codes/${fileName}`;
    
  } catch (error) {
    logger.error(`Error generating custom QR code ${fileName}:`, error.message);
    throw new Error('Failed to generate custom QR code');
  }
};

// Obtener QR code como buffer (para envío por email, etc.)
const getQRCodeBuffer = async (data, options = {}) => {
  try {
    const config = { ...QR_CONFIG, ...options };
    const buffer = await QRCode.toBuffer(data, config);
    
    return buffer;
    
  } catch (error) {
    logger.error('Error generating QR code buffer:', error.message);
    throw new Error('Failed to generate QR code buffer');
  }
};

// Regenerar QR code para restaurante existente
const regenerateQRCode = async (restaurantId, slug) => {
  try {
    // Eliminar QR existente si existe
    const qrDir = await ensureQRDirectory();
    const fileName = `${slug}-qr.png`;
    const filePath = path.join(qrDir, fileName);
    
    try {
      await fs.unlink(filePath);
      logger.info(`Removed existing QR code: ${fileName}`);
    } catch {
      // El archivo no existe, continuar
    }
    
    // Generar nuevo QR
    return await generateQRCode(restaurantId, slug);
    
  } catch (error) {
    logger.error(`Error regenerating QR code for ${slug}:`, error.message);
    throw new Error('Failed to regenerate QR code');
  }
};

// Validar si un QR code existe
const qrCodeExists = async (slug) => {
  try {
    const qrDir = await ensureQRDirectory();
    const fileName = `${slug}-qr.png`;
    const filePath = path.join(qrDir, fileName);
    
    await fs.access(filePath);
    return true;
    
  } catch {
    return false;
  }
};

// Eliminar QR code
const deleteQRCode = async (slug) => {
  try {
    const qrDir = await ensureQRDirectory();
    const fileName = `${slug}-qr.png`;
    const filePath = path.join(qrDir, fileName);
    
    await fs.unlink(filePath);
    logger.info(`QR code deleted: ${fileName}`);
    
    return true;
    
  } catch (error) {
    logger.warn(`Could not delete QR code ${fileName}:`, error.message);
    return false;
  }
};

module.exports = {
  generateQRCode,
  generateCustomQRCode,
  getQRCodeBuffer,
  regenerateQRCode,
  qrCodeExists,
  deleteQRCode
};