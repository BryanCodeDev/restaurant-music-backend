// fix-passwords.js
// ============================================
// SCRIPT PARA HASHEAR CONTRASEÑAS
// ============================================
// Sistema de suscripciones musicales para restaurantes
// Actualizado para la nueva estructura de base de datos

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { executeQuery } = require('./src/config/database');

class PasswordManager {
  constructor() {
    this.rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  }

  async hashPassword(password) {
    const salt = await bcrypt.genSalt(this.rounds);
    return await bcrypt.hash(password, salt);
  }

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  async updateUserPassword(table, email, newPassword) {
    try {
      const hashedPassword = await this.hashPassword(newPassword);

      const { rows: result } = await executeQuery(
        `UPDATE ${table} SET password = ? WHERE email = ?`,
        [hashedPassword, email]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Error actualizando ${email}:`, error.message);
      return false;
    }
  }

  async createUser(table, userData) {
    try {
      const hashedPassword = await this.hashPassword(userData.password);

      const columns = Object.keys(userData).filter(key => key !== 'password');
      const values = columns.map(key => userData[key]);
      const placeholders = columns.map(() => '?').join(', ');

      const { rows: result } = await executeQuery(
        `INSERT INTO ${table} (${columns.join(', ')}, password) VALUES (${placeholders}, ?)`,
        [...values, hashedPassword]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Error creando usuario ${userData.email}:`, error.message);
      return false;
    }
  }

  async verifyExistingPassword(table, email, plainPassword) {
    try {
      const { rows: users } = await executeQuery(
        `SELECT password FROM ${table} WHERE email = ?`,
        [email]
      );

      if (users.length === 0) {
        return { exists: false, valid: false };
      }

      const isValid = await this.verifyPassword(plainPassword, users[0].password);
      return { exists: true, valid: isValid };
    } catch (error) {
      console.error(`❌ Error verificando ${email}:`, error.message);
      return { exists: false, valid: false };
    }
  }

  async fixPasswords() {
    console.log('🔄 Corrigiendo contraseñas en la base de datos...');
    console.log('=' .repeat(60));

    try {
      // ============================================
      // CREDENCIALES DEL SISTEMA (del script.sql)
      // ============================================
      const systemAccounts = [
        {
          table: 'registered_users',
          email: 'admin@musicmenu.com',
          password: 'admin123',
          description: 'Superadmin - Panel de administración completo'
        },
        {
          table: 'restaurants',
          email: 'admin@laterraza.com',
          password: 'admin123',
          description: 'Restaurante de prueba - Plan Professional'
        },
        {
          table: 'registered_users',
          email: 'maria.gonzalez@email.com',
          password: 'admin123',
          description: 'Usuario registrado - Cliente frecuente'
        }
      ];

      console.log('👑 PROCESANDO CREDENCIALES DEL SISTEMA:');
      console.log('-'.repeat(60));

      for (const acc of systemAccounts) {
        console.log(`\n🔐 Procesando: ${acc.email}`);
        console.log(`   📋 Descripción: ${acc.description}`);
        console.log(`   🗂️  Tabla: ${acc.table}`);

        // Verificar si existe
        const { exists } = await this.verifyExistingPassword(acc.table, acc.email, acc.password);

        if (!exists) {
          console.log(`   ❌ Usuario no existe, creando...`);

          const userData = {
            name: acc.email.split('@')[0].replace('.', ' ').toUpperCase(),
            email: acc.email,
            password: acc.password,
            phone: '+57 300 123 4567',
            preferred_genres: '["pop", "rock", "jazz"]',
            preferred_languages: '["es", "en"]',
            theme_preference: 'dark',
            privacy_level: 'public',
            is_active: true,
            email_verified: true,
            role: acc.table === 'registered_users' && acc.email.includes('admin') ? 'superadmin' : 'user'
          };

          const created = await this.createUser(acc.table, userData);

          if (created) {
            console.log(`   ✅ Usuario creado exitosamente`);
          } else {
            console.log(`   ❌ Error creando usuario`);
          }
        } else {
          console.log(`   ✅ Usuario ya existe, actualizando contraseña...`);

          const updated = await this.updateUserPassword(acc.table, acc.email, acc.password);

          if (updated) {
            console.log(`   ✅ Contraseña actualizada`);
          } else {
            console.log(`   ❌ Error actualizando contraseña`);
          }
        }

        // Verificar contraseña
        const { valid } = await this.verifyExistingPassword(acc.table, acc.email, acc.password);
        console.log(`   🔍 Verificación: ${valid ? '✅ CORRECTA' : '❌ ERROR'}`);
      }

      // ============================================
      // CREAR USUARIOS ADICIONALES DE PRUEBA
      // ============================================
      console.log('\n' + '='.repeat(60));
      console.log('🎭 CREANDO USUARIOS ADICIONALES DE PRUEBA:');
      console.log('-'.repeat(60));

      const testUsers = [
        {
          table: 'registered_users',
          email: 'cliente@ejemplo.com',
          password: 'cliente123',
          description: 'Cliente regular - Usuario básico'
        },
        {
          table: 'registered_users',
          email: 'musico@ejemplo.com',
          password: 'musico123',
          description: 'Usuario músico - Amante de la música'
        },
        {
          table: 'restaurants',
          email: 'restaurante2@ejemplo.com',
          password: 'restaurante123',
          description: 'Restaurante adicional - Plan Starter'
        }
      ];

      for (const user of testUsers) {
        console.log(`\n🎭 Creando: ${user.email}`);
        console.log(`   📋 ${user.description}`);

        const userData = {
          name: user.email.split('@')[0].replace('.', ' ').toUpperCase(),
          email: user.email,
          password: user.password,
          phone: '+57 300 987 6543',
          preferred_genres: '["pop", "salsa", "reggaeton"]',
          preferred_languages: '["es"]',
          theme_preference: 'dark',
          privacy_level: 'public',
          is_active: true,
          email_verified: true,
          role: 'user'
        };

        const created = await this.createUser(user.table, userData);

        if (created) {
          console.log(`   ✅ Usuario creado exitosamente`);

          // Verificar contraseña
          const { valid } = await this.verifyExistingPassword(user.table, user.email, user.password);
          console.log(`   🔍 Verificación: ${valid ? '✅ CORRECTA' : '❌ ERROR'}`);
        } else {
          console.log(`   ❌ Error creando usuario`);
        }
      }

      // ============================================
      // ESTADÍSTICAS FINALES
      // ============================================
      console.log('\n' + '='.repeat(60));
      console.log('📊 ESTADÍSTICAS FINALES:');
      console.log('-'.repeat(60));

      const tables = ['registered_users', 'restaurants'];
      for (const table of tables) {
        const { rows: count } = await executeQuery(
          `SELECT COUNT(*) as total FROM ${table}`
        );
        console.log(`   👥 ${table}: ${count[0].total} usuarios`);
      }

      console.log('\n🎉 ¡PROCESO COMPLETADO EXITOSAMENTE!');
      console.log('=' .repeat(60));
      console.log('🔐 CREDENCIALES CONFIGURADAS:');
      console.log('-'.repeat(60));

      const allCredentials = [
        ...systemAccounts,
        ...testUsers
      ];

      for (const cred of allCredentials) {
        console.log(`   📧 ${cred.email}`);
        console.log(`   🔑 ${cred.password}`);
        console.log(`   📋 ${cred.description}`);
        console.log('');
      }

      console.log('🚀 ¡Ya puedes hacer login con estas credenciales!');
      console.log('💡 Recuerda: Todas las contraseñas están hasheadas con bcrypt');

    } catch (error) {
      console.error('❌ Error general:', error.message);
    } finally {
      process.exit(0);
    }
  }
}

// ============================================
// EJECUCIÓN DEL SCRIPT
// ============================================
async function main() {
  const passwordManager = new PasswordManager();
  await passwordManager.fixPasswords();
}

if (require.main === module) {
  main();
}

module.exports = PasswordManager;
