// fix-passwords.js
// Script para hashear contraseñas en la base de datos SaaS de música/restaurantes

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { executeQuery } = require('./src/config/database');

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

async function fixPasswords() {
  console.log('🔄 Corrigiendo contraseñas en la base de datos...');

  try {
    // Usuarios a actualizar (ejemplo inicial)
    const accounts = [
      { table: 'restaurants', email: 'admin@laterraza.com', password: 'admin123' },
      { table: 'registered_users', email: 'maria@demo.com', password: 'demo123' },
      { table: 'registered_users', email: 'carlos@demo.com', password: 'demo123' },
      { table: 'registered_users', email: 'ana@demo.com', password: 'demo123' }
    ];

    for (const acc of accounts) {
      console.log(`🔐 Procesando ${acc.email} (${acc.table})...`);

      const hashedPassword = await hashPassword(acc.password);

      // Actualizar en la tabla correspondiente
      const { rows: result } = await executeQuery(
        `UPDATE ${acc.table} SET password = ? WHERE email = ?`,
        [hashedPassword, acc.email]
      );

      if (result.affectedRows > 0) {
        console.log(`✅ ${acc.email} actualizado (password: ${acc.password})`);
        const isValid = await verifyPassword(acc.password, hashedPassword);
        console.log(`   🔍 Verificación: ${isValid ? 'CORRECTA' : 'ERROR'}`);
      } else {
        console.log(`❌ No se encontró: ${acc.email} en ${acc.table}`);
      }
    }

    console.log('\n🎉 Proceso completado!');
    console.log('🚀 Ahora puedes hacer login con los correos y contraseñas en texto plano que configuraste aquí.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

fixPasswords();
