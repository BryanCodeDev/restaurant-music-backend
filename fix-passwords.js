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
    // Usuarios de ejemplo del script.sql - Restaurantes
    const accounts = [
      // Restaurantes (10 usuarios)
      { table: 'restaurants', email: 'carlos@laterraza.com', password: 'terraza123' },
      { table: 'restaurants', email: 'maria@saborcubano.com', password: 'cubano123' },
      { table: 'restaurants', email: 'roberto@jazzblues.com', password: 'jazz123' },
      { table: 'restaurants', email: 'sofia@reggaetonpalace.com', password: 'reggaeton123' },
      { table: 'restaurants', email: 'diego@rockrolldiner.com', password: 'rock123' },
      { table: 'restaurants', email: 'camila@electroniclounge.com', password: 'electronic123' },
      { table: 'restaurants', email: 'miguel@salsayson.com', password: 'salsa123' },
      { table: 'restaurants', email: 'lucia@indiecafe.com', password: 'indie123' },
      { table: 'restaurants', email: 'andres@hiphopcorner.com', password: 'hiphop123' },
      { table: 'restaurants', email: 'isabella@classicalbistro.com', password: 'classical123' },

      // Usuarios registrados (15 usuarios)
      { table: 'registered_users', email: 'maria@example.com', password: 'maria123' },
      { table: 'registered_users', email: 'carlos@example.com', password: 'carlos123' },
      { table: 'registered_users', email: 'ana@example.com', password: 'ana123' },
      { table: 'registered_users', email: 'luis@example.com', password: 'luis123' },
      { table: 'registered_users', email: 'carmen@example.com', password: 'carmen123' },
      { table: 'registered_users', email: 'jorge@example.com', password: 'jorge123' },
      { table: 'registered_users', email: 'patricia@example.com', password: 'patricia123' },
      { table: 'registered_users', email: 'roberto@example.com', password: 'roberto123' },
      { table: 'registered_users', email: 'elena@example.com', password: 'elena123' },
      { table: 'registered_users', email: 'miguel@example.com', password: 'miguel123' },
      { table: 'registered_users', email: 'sofia@example.com', password: 'sofia123' },
      { table: 'registered_users', email: 'david@example.com', password: 'david123' },
      { table: 'registered_users', email: 'laura@example.com', password: 'laura123' },
      { table: 'registered_users', email: 'alejandro@example.com', password: 'alejandro123' },
      { table: 'registered_users', email: 'admin@restaurantmusic.com', password: 'admin123' }
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
    console.log('🚀 Ahora puedes hacer login con los usuarios de ejemplo:');
    console.log('   📋 RESTAURANTES (10 usuarios):');
    console.log('   • carlos@laterraza.com / terraza123');
    console.log('   • maria@saborcubano.com / cubano123');
    console.log('   • roberto@jazzblues.com / jazz123');
    console.log('   • sofia@reggaetonpalace.com / reggaeton123');
    console.log('   • diego@rockrolldiner.com / rock123');
    console.log('   • camila@electroniclounge.com / electronic123');
    console.log('   • miguel@salsayson.com / salsa123');
    console.log('   • lucia@indiecafe.com / indie123');
    console.log('   • andres@hiphopcorner.com / hiphop123');
    console.log('   • isabella@classicalbistro.com / classical123');
    console.log('   👥 USUARIOS REGISTRADOS (15 usuarios):');
    console.log('   • maria@example.com / maria123');
    console.log('   • carlos@example.com / carlos123');
    console.log('   • ana@example.com / ana123');
    console.log('   • luis@example.com / luis123');
    console.log('   • carmen@example.com / carmen123');
    console.log('   • jorge@example.com / jorge123');
    console.log('   • patricia@example.com / patricia123');
    console.log('   • roberto@example.com / roberto123');
    console.log('   • elena@example.com / elena123');
    console.log('   • miguel@example.com / miguel123');
    console.log('   • sofia@example.com / sofia123');
    console.log('   • david@example.com / david123');
    console.log('   • laura@example.com / laura123');
    console.log('   • alejandro@example.com / alejandro123');
    console.log('   • admin@restaurantmusic.com / admin123 (Super Admin)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

fixPasswords();
