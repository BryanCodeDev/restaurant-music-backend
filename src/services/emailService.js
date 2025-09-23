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

  // Enviar notificación de nueva suscripción (para admin)
  const sendNewSubscriptionNotification = async (adminEmail, subscriptionData) => {
    const transporter = createTransporter();
    if (!transporter) return false;

    try {
      const content = `
        <h2>¡Nueva Suscripción Recibida!</h2>
        <p>Hola Admin,</p>
        <p>Se ha recibido una nueva solicitud de suscripción que requiere tu aprobación.</p>

        <div class="highlight">
          <h3>Detalles de la Suscripción:</h3>
          <ul>
            <li><strong>Restaurante:</strong> ${subscriptionData.restaurantInfo?.name || 'N/A'}</li>
            <li><strong>Email:</strong> ${subscriptionData.restaurantInfo?.email || 'N/A'}</li>
            <li><strong>Plan:</strong> ${subscriptionData.planInfo?.name || 'N/A'}</li>
            <li><strong>Precio:</strong> $${subscriptionData.planInfo?.price || 'N/A'}</li>
            <li><strong>Método de Pago:</strong> ${subscriptionData.paymentMethod || 'N/A'}</li>
            <li><strong>Fecha de Solicitud:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}</li>
          </ul>
        </div>

        <p>Por favor, revisa el panel de administración para aprobar o rechazar esta suscripción.</p>

        <a href="${process.env.ADMIN_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/subscriptions" class="button">
          Revisar Suscripciones
        </a>

        <p>¡No olvides revisar el comprobante de pago adjunto!</p>
      `;

      const mailOptions = {
        from: `"MusicMenu Admin" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: adminEmail,
        subject: '🔔 Nueva Suscripción Pendiente de Aprobación',
        html: createEmailTemplate('Nueva Suscripción Recibida', content)
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`New subscription notification sent to ${adminEmail}: ${info.messageId}`);
      return true;

    } catch (error) {
      logger.error('Error sending new subscription notification:', error.message);
      return false;
    }
  };

  // Enviar notificación de aprobación de suscripción (para restaurante)
  const sendSubscriptionApprovedEmail = async (restaurantEmail, restaurantName, subscriptionData) => {
    const transporter = createTransporter();
    if (!transporter) return false;

    try {
      const expiresAt = subscriptionData.expiresAt ? new Date(subscriptionData.expiresAt).toLocaleDateString('es-ES', { timeZone: 'America/Bogota' }) : 'N/A';

      const content = `
        <h2>¡Tu Suscripción ha sido Aprobada! 🎉</h2>
        <p>Hola ${restaurantName},</p>
        <p>¡Excelentes noticias! Tu solicitud de suscripción a MusicMenu ha sido aprobada.</p>

        <div class="highlight">
          <h3>Detalles de tu Suscripción:</h3>
          <ul>
            <li><strong>Plan:</strong> ${subscriptionData.planInfo?.name || 'N/A'}</li>
            <li><strong>Precio:</strong> $${subscriptionData.planInfo?.price || 'N/A'} ${subscriptionData.planInfo?.period || 'mes'}</li>
            <li><strong>Fecha de Activación:</strong> ${new Date().toLocaleDateString('es-ES', { timeZone: 'America/Bogota' })}</li>
            <li><strong>Fecha de Expiración:</strong> ${expiresAt}</li>
            <li><strong>Estado:</strong> ✅ Activa</li>
          </ul>
        </div>

        <p>Tu restaurante ahora tiene acceso completo a todas las funciones de MusicMenu:</p>
        <ul>
          <li>🎵 Biblioteca musical ilimitada</li>
          <li>📊 Estadísticas en tiempo real</li>
          <li>🎛️ Control de contenido</li>
          <li>📱 Integración con Spotify</li>
          <li>🔄 Sistema de cola automático</li>
        </ul>

        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin" class="button">
          Acceder a tu Panel
        </a>

        <p>¡Gracias por elegir MusicMenu! Estamos emocionados de ayudarte a crear experiencias musicales inolvidables.</p>
      `;

      const mailOptions = {
        from: `"MusicMenu" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: restaurantEmail,
        subject: '✅ ¡Tu Suscripción ha sido Aprobada!',
        html: createEmailTemplate('¡Suscripción Aprobada!', content)
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Subscription approved email sent to ${restaurantEmail}: ${info.messageId}`);
      return true;

    } catch (error) {
      logger.error('Error sending subscription approved email:', error.message);
      return false;
    }
  };

  // Enviar notificación de rechazo de suscripción (para restaurante)
  const sendSubscriptionRejectedEmail = async (restaurantEmail, restaurantName, subscriptionData) => {
    const transporter = createTransporter();
    if (!transporter) return false;

    try {
      const content = `
        <h2>Suscripción Rechazada</h2>
        <p>Hola ${restaurantName},</p>
        <p>Lamentamos informarte que tu solicitud de suscripción a MusicMenu no pudo ser aprobada en este momento.</p>

        <div class="highlight">
          <h3>Detalles de la Solicitud:</h3>
          <ul>
            <li><strong>Plan Solicitado:</strong> ${subscriptionData.planInfo?.name || 'N/A'}</li>
            <li><strong>Fecha de Solicitud:</strong> ${new Date().toLocaleDateString('es-ES', { timeZone: 'America/Bogota' })}</li>
            <li><strong>Razón:</strong> ${subscriptionData.rejectionReason || 'No especificada'}</li>
          </ul>
        </div>

        <p>Posibles razones comunes para el rechazo:</p>
        <ul>
          <li>📋 Documentación incompleta</li>
          <li>💳 Problemas con el comprobante de pago</li>
          <li>🏢 Información del restaurante incompleta</li>
          <li>⚠️ No cumple con requisitos del plan</li>
        </ul>

        <p>¿Qué puedes hacer?</p>
        <ol>
          <li>Revisa la documentación enviada</li>
          <li>Verifica que el comprobante de pago sea claro y legible</li>
          <li>Asegúrate de que toda la información del restaurante esté completa</li>
          <li>Envía una nueva solicitud con la documentación corregida</li>
        </ol>

        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription" class="button">
          Enviar Nueva Solicitud
        </a>

        <p>Si tienes dudas sobre los requisitos o necesitas ayuda, no dudes en contactarnos.</p>
        <p>Estamos aquí para ayudarte a unirte a la comunidad MusicMenu.</p>
      `;

      const mailOptions = {
        from: `"MusicMenu Support" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: restaurantEmail,
        subject: '❌ Tu Suscripción no pudo ser Aprobada',
        html: createEmailTemplate('Suscripción Rechazada', content)
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Subscription rejected email sent to ${restaurantEmail}: ${info.messageId}`);
      return true;

    } catch (error) {
      logger.error('Error sending subscription rejected email:', error.message);
      return false;
    }
  };

  // Enviar recordatorio de expiración de suscripción
  const sendExpirationReminderEmail = async (restaurantEmail, restaurantName, subscriptionData, daysUntilExpiration) => {
    const transporter = createTransporter();
    if (!transporter) return false;

    try {
      const expirationDate = new Date(subscriptionData.expiresAt).toLocaleDateString('es-ES', { timeZone: 'America/Bogota' });

      const content = `
        <h2>Recordatorio: Tu Suscripción Expirará Pronto ⏰</h2>
        <p>Hola ${restaurantName},</p>
        <p>Te recordamos que tu suscripción a MusicMenu expirará en ${daysUntilExpiration} días.</p>

        <div class="highlight">
          <h3>Detalles de tu Suscripción:</h3>
          <ul>
            <li><strong>Plan Actual:</strong> ${subscriptionData.planInfo?.name || 'N/A'}</li>
            <li><strong>Fecha de Expiración:</strong> ${expirationDate}</li>
            <li><strong>Días Restantes:</strong> ${daysUntilExpiration}</li>
            <li><strong>Estado:</strong> Activa</li>
          </ul>
        </div>

        <p>Para evitar interrupciones en el servicio, te recomendamos renovar tu suscripción antes de la fecha de expiración.</p>

        <p>Beneficios de renovar ahora:</p>
        <ul>
          <li>✅ Continuidad del servicio sin interrupciones</li>
          <li>💰 Posibles descuentos por renovación temprana</li>
          <li>🎵 Acceso continuo a toda la biblioteca musical</li>
          <li>📊 Mantenimiento de tus estadísticas históricas</li>
        </ul>

        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/renew" class="button">
          Renovar Suscripción
        </a>

        <p>Si tienes alguna pregunta sobre la renovación o deseas cambiar de plan, contáctanos.</p>
        <p>¡Gracias por ser parte de MusicMenu!</p>
      `;

      const mailOptions = {
        from: `"MusicMenu" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: restaurantEmail,
        subject: `⏰ Recordatorio: Tu Suscripción Expira en ${daysUntilExpiration} días`,
        html: createEmailTemplate('Recordatorio de Expiración', content)
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Expiration reminder email sent to ${restaurantEmail}: ${info.messageId}`);
      return true;

    } catch (error) {
      logger.error('Error sending expiration reminder email:', error.message);
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
  sendVerificationEmail,
  sendNewSubscriptionNotification,
  sendSubscriptionApprovedEmail,
  sendSubscriptionRejectedEmail,
  sendExpirationReminderEmail
};