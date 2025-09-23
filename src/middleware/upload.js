// src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

// Crear directorio de uploads si no existe
const createUploadsDir = async () => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  const paymentsDir = path.join(uploadsDir, 'payments');

  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  try {
    await fs.access(paymentsDir);
  } catch {
    await fs.mkdir(paymentsDir, { recursive: true });
  }

  return paymentsDir;
};

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const paymentsDir = await createUploadsDir();
      cb(null, paymentsDir);
    } catch (error) {
      logger.error('Error creating uploads directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);
    const filename = `${basename}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos para comprobantes de pago
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten: JPG, JPEG, PNG, GIF, PDF'), false);
  }
};

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
    files: 1 // Máximo 1 archivo por vez
  }
});

// Middleware para subir comprobante de pago
const uploadPaymentProof = (req, res, next) => {
  upload.single('paymentProof')(req, res, (err) => {
    if (err) {
      logger.error('Error uploading payment proof:', err);

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'El archivo es demasiado grande. Máximo 5MB permitido.',
            error: 'FILE_TOO_LARGE'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Solo se permite un archivo por solicitud.',
            error: 'TOO_MANY_FILES'
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'Error al subir el archivo',
        error: 'UPLOAD_ERROR'
      });
    }

    // Verificar que se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar un archivo de comprobante de pago',
        error: 'NO_FILE_UPLOADED'
      });
    }

    // Agregar información del archivo a la solicitud
    req.fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
      url: `/uploads/payments/${req.file.filename}`
    };

    logger.info(`Payment proof uploaded: ${req.file.filename}`);
    next();
  });
};

// Middleware para subir múltiples archivos (si es necesario en el futuro)
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const uploadMultipleFiles = multer({
      storage: storage,
      fileFilter: fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB máximo por archivo
        files: maxCount
      }
    }).array(fieldName, maxCount);

    uploadMultipleFiles(req, res, (err) => {
      if (err) {
        logger.error('Error uploading multiple files:', err);
        return res.status(400).json({
          success: false,
          message: 'Error al subir los archivos',
          error: 'UPLOAD_ERROR'
        });
      }

      // Procesar archivos subidos
      if (req.files && req.files.length > 0) {
        req.filesInfo = req.files.map(file => ({
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path,
          url: `/uploads/payments/${file.filename}`
        }));
      }

      next();
    });
  };
};

// Función para eliminar archivo
const deleteFile = async (filename) => {
  try {
    const paymentsDir = await createUploadsDir();
    const filePath = path.join(paymentsDir, filename);

    await fs.unlink(filePath);
    logger.info(`File deleted: ${filename}`);
    return true;
  } catch (error) {
    logger.error(`Error deleting file ${filename}:`, error);
    return false;
  }
};

// Función para obtener información del archivo
const getFileInfo = async (filename) => {
  try {
    const paymentsDir = await createUploadsDir();
    const filePath = path.join(paymentsDir, filename);

    const stats = await fs.stat(filePath);
    const fileInfo = {
      filename: filename,
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      url: `/uploads/payments/${filename}`
    };

    return fileInfo;
  } catch (error) {
    logger.error(`Error getting file info for ${filename}:`, error);
    return null;
  }
};

module.exports = {
  uploadPaymentProof,
  uploadMultiple,
  deleteFile,
  getFileInfo,
  createUploadsDir
};