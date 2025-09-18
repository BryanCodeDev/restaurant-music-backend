// src/services/emailService.js
const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

// Configuración del transportador de email
const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    logger.warn('Email configuration not found, email service disabled');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Plantilla base para emails
const createEmailTemplate = (title, content, footerText = 'MasterCode Company - Restaurant Music System') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px; 
          background-color: #f4f4f4; 
        }
        .content { 
          background: white; 
          padding: 30px; 
          border-radius: 10px; 
          box-shadow: 0 0 10px rgba(0,0,0,0.1); 
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          padding-bottom: 20px; 
          border-bottom: 2px solid #3b82f6; 
        }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #eee; 
          color: #666; 
          font-size: 12px; 
        }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
          color: white; 
          text-decoration: none; 
          border-radius: 6px; 
          font-weight: bold; 
          margin: 15px 0; 
        }
        .highlight { 
          background-color: #f0f9ff; 
          padding: 15px; 
          border-left: 4px solid #3b82f6; 
          margin: 15px 0; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <div class="header">
            <h1 style="color: #3b82f6; margin: 0;">${title}</h1>
          </div>
          ${content}
          <div class="footer">
            <p>${footerText}</p>
            <p>Si no solicitaste este email, puedes ignorarlo.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Enviar email de bienvenida
const sendWelcomeEmail = async (restaurantEmail, restaurantName, qrCodePath) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const content = `
      <h2>¡Bienvenido a MusicMenu!</h2>
      <p>Hola,</p>
      <p>Gracias por registrar <strong>${restaurantName}</strong> en nuestra plataforma de música interactiva.</p>
      
      <div class="highlight">
        <h3>Tu restaurante está listo:</h3>
        <ul>
          <li>✅ Panel de administración configurado</li>
          <li>✅ Código QR generado automáticamente</li>
          <li>✅ Biblioteca musical disponible</li>
          <li>✅ Sistema de cola en tiempo real</li>
        </ul>
      </div>

      <p>Puedes acceder a tu panel de administración para personalizar la configuración, ver estadísticas y gestionar las peticiones musicales.</p>
      
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin" class="button">
        Acceder al Panel Admin
      </a>

      <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
      <p>¡Que disfrutes revolucionando la experiencia musical de tus clientes!</p>
    `;

    const mailOptions = {
      from: `"MusicMenu" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: restaurantEmail,
      subject: `¡Bienvenido a MusicMenu, ${restaurantName}!`,
      html: createEmailTemplate('¡Bienvenido a MusicMenu!', content),
      // Adjuntar QR code si existe
      ...(qrCodePath && {
        attachments: [{
          filename: `${restaurantName}-QR.png`,
          path: qrCodePath,
          contentType: 'image/png'
        }]
      })
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${restaurantEmail}: ${info.messageId}`);
    return true;

  } catch (error) {
    logger.error('Error sending welcome email:', error.message);
    return false;
  }
};

// Enviar email de recuperación de contraseña
const sendPasswordResetEmail = async (email, resetToken, restaurantName) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const content = `
      <h2>Recuperación de Contraseña</h2>
      <p>Hola,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de <strong>${restaurantName}</strong>.</p>
      
      <div class="highlight">
        <p><strong>¿No solicitaste este cambio?</strong></p>
        <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu contraseña no será cambiada.</p>
      </div>

      <p>Para restablecer tu contraseña, haz clic en el siguiente botón:</p>
      
      <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
      
      <p>O copia y pega esta URL en tu navegador:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      
      <p><small>Este enlace expirará en 1 hora por razones de seguridad.</small></p>
    `;

    const mailOptions = {
      from: `"MusicMenu Support" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Recuperación de Contraseña - MusicMenu',
      html: createEmailTemplate('Recuperación de Contraseña', content)
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${email}: ${info.messageId}`);
    return true;

  } catch (error) {
    logger.error('Error sending password reset email:', error.message);
    return false;
  }
};

// Enviar notificación de actividad sospechosa
const sendSecurityAlert = async (email, restaurantName, activity, ipAddress) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const content = `
      <h2>Alerta de Seguridad</h2>
      <p>Hola,</p>
      <p>Detectamos actividad inusual en la cuenta de <strong>${restaurantName}</strong>.</p>
      
      <div class="highlight">
        <h3>Detalles de la actividad:</h3>
        <ul>
          <li><strong>Actividad:</strong> ${activity}</li>
          <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}</li>
          <li><strong>Dirección IP:</strong> ${ipAddress}</li>
        </ul>
      </div>

      <p>Si reconoces esta actividad, puedes ignorar este email.</p>
      
      <p>Si NO reconoces esta actividad:</p>
      <ol>
        <li>Cambia tu contraseña inmediatamente</li>
        <li>Revisa la configuración de tu cuenta</li>
        <li>Contacta nuestro soporte si tienes dudas</li>
      </ol>
      
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/security" class="button">
        Revisar Configuración
      </a>
    `;

    const mailOptions = {
      from: `"MusicMenu Security" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Alerta de Seguridad - Actividad Inusual Detectada',
      html: createEmailTemplate('Alerta de Seguridad', content)
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Security alert email sent to ${email}: ${info.messageId}`);
    return true;

  } catch (error) {
    logger.error('Error sending security alert email:', error.message);
    return false;
  }
};

// Enviar reporte semanal de estadísticas
const sendWeeklyReport = async (email, restaurantName, stats) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const content = `
      <h2>Reporte Semanal - ${restaurantName}</h2>
      <p>Hola,</p>
      <p>Aquí tienes el resumen de actividad de esta semana en tu restaurante:</p>
      
      <div class="highlight">
        <h3>Estadísticas de la Semana</h3>
        <ul>
          <li><strong>Total de peticiones:</strong> ${stats.totalRequests}</li>
          <li><strong>Canciones completadas:</strong> ${stats.completedRequests}</li>
          <li><strong>Usuarios únicos:</strong> ${stats.uniqueUsers}</li>
          <li><strong>Género más popular:</strong> ${stats.topGenre}</li>
          <li><strong>Tiempo promedio de espera:</strong> ${stats.avgWaitTime} min</li>
        </ul>
      </div>

      ${stats.topSongs && stats.topSongs.length > 0 ? `
        <h3>Canciones Más Pedidas:</h3>
        <ol>
          ${stats.topSongs.map(song => `<li>${song.title} - ${song.artist} (${song.count} veces)</li>`).join('')}
        </ol>
      ` : ''}

      <p>¡Sigue así! Tu restaurante está creando experiencias musicales increíbles.</p>
      
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/analytics" class="button">
        Ver Reporte Completo
      </a>
    `;

    const mailOptions = {
      from: `"MusicMenu Analytics" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: `Reporte Semanal - ${restaurantName}`,
      html: createEmailTemplate('Reporte Semanal', content)
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Weekly report email sent to ${email}: ${info.messageId}`);
    return true;

  } catch (error) {
    logger.error('Error sending weekly report email:', error.message);
    return false;
  }
};

// Verificar configuración de email
const verifyEmailConfig = async () => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    await transporter.verify();
    logger.info('Email configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('Email configuration verification failed:', error.message);
    return false;
  }
};

// Enviar email de prueba
const sendTestEmail = async (toEmail) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const content = `
      <h2>Email de Prueba</h2>
      <p>¡Este es un email de prueba de MusicMenu!</p>
      <p>Si recibiste este email, significa que la configuración está funcionando correctamente.</p>
      <div class="highlight">
        <p><strong>Información del sistema:</strong></p>
        <ul>
          <li>Fecha: ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}</li>
          <li>Servidor: ${process.env.NODE_ENV || 'development'}</li>
          <li>Versión: 1.0.0</li>
        </ul>
      </div>
    `;

    const mailOptions = {
      from: `"MusicMenu Test" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Email de Prueba - MusicMenu',
      html: createEmailTemplate('Email de Prueba', content)
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Test email sent to ${toEmail}: ${info.messageId}`);
    return true;

  } catch (error) {
    logger.error('Error sending test email:', error.message);
    return false;
  }
};

const sendVerificationEmail = async (userEmail, userName, verificationToken) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(userEmail)}`;

    const content = `
      <h2>¡Verifica tu Cuenta en MusicMenu!</h2>
      <p>Hola ${userName},</p>
      <p>Gracias por registrarte en MusicMenu. Para completar tu registro y activar tu cuenta, por favor verifica tu email haciendo clic en el botón de abajo.</p>
      
      <div class="highlight">
        <p><strong>¿Por qué verificar?</strong></p>
        <ul>
          <li>✅ Activa tu cuenta completamente</li>
          <li>✅ Accede a todas las funciones</li>
          <li>✅ Mejora la seguridad</li>
        </ul>
      </div>

      <p>Si no verificas tu email en las próximas 24 horas, podrás solicitar un nuevo enlace.</p>
      
      <a href="${verificationUrl}" class="button">Verificar Email Ahora</a>
      
      <p>O copia y pega esta URL en tu navegador:</p>
      <p style="word-break: break-all; color: #666; background: #f8f9fa; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
      
      <p>Si no solicitaste este registro, puedes ignorar este email.</p>
      <p>¡Estamos emocionados de que formes parte de nuestra comunidad musical!</p>
    `;

    const mailOptions = {
      from: `"MusicMenu" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Verifica tu Email - MusicMenu',
      html: createEmailTemplate('¡Verifica tu Email!', content)
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to ${userEmail}: ${info.messageId}`);
    return true;

  } catch (error) {
    logger.error('Error sending verification email:', error.message);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendSecurityAlert,
  sendWeeklyReport,
  verifyEmailConfig,
  sendTestEmail,
  sendVerificationEmail
};