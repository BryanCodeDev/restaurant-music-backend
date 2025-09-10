// test-database.js - Script para probar la conexión y datos (CommonJS)
require('dotenv').config();
const { executeQuery, checkConnection, closeConnection } = require('./src/config/database');

// Función para enmascarar la contraseña
const maskPassword = (password) => {
  if (!password) return '[NO CONFIGURADA]';
  if (password.length <= 4) return '*'.repeat(password.length);
  return (
    password.substring(0, 3) +
    '*'.repeat(password.length - 4) +
    password.substring(password.length - 1)
  );
};

const testDatabase = async () => {
  console.log('🔍 Probando conexión y datos de la base de datos...\n');
  
  // Mostrar configuración actual
  console.log('📋 Configuración Actual:');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Puerto: ${process.env.DB_PORT || '3307'}`);
  console.log(`   Base de datos: ${process.env.DB_NAME || 'restaurant_music_db'}`);
  console.log(`   Usuario: ${process.env.DB_USER || 'root'}`);
  console.log(`   Contraseña: ${process.env.DB_PASSWORD ? maskPassword(process.env.DB_PASSWORD) : '[NO CONFIGURADA]'}\n`);

  try {
    // 1. Probar conexión
    console.log('1. 🔌 Probando conexión a la base de datos...');
    const connected = await checkConnection();
    
    if (!connected) {
      console.log('\n❌ Falló la conexión a la base de datos');
      console.log('\n🔧 Pasos para solucionar:');
      
      const port = process.env.DB_PORT || '3307';
      const dbName = process.env.DB_NAME || 'restaurant_music_db';
      
      console.log('\n1️⃣ Verificar que MySQL esté ejecutándose:');
      console.log(`   📝 Comando para verificar: mysql -u root -p -P ${port}`);
      
      console.log('\n2️⃣ Si MySQL no está ejecutándose:');
      console.log('   🔧 Inicia XAMPP/WAMP/MAMP');
      console.log('   🔧 O inicia MySQL como servicio: net start mysql');
      console.log('   🔧 Verifica que MySQL esté configurado en el puerto', port);
      
      console.log('\n3️⃣ Verificar que la base de datos existe:');
      console.log(`   📝 Conéctate a MySQL y ejecuta: CREATE DATABASE IF NOT EXISTS ${dbName};`);
      
      console.log('\n4️⃣ Verificar credenciales:');
      console.log('   📝 Usuario y contraseña deben ser correctos en el archivo .env');
      
      return;
    }

    console.log('✅ Conexión exitosa a la base de datos\n');

    // 2. Verificar base de datos existe
    console.log('2. 🗄️ Verificando base de datos y tablas...');
    
    try {
      const { rows: dbInfo } = await executeQuery('SELECT DATABASE() as current_db');
      console.log(`✅ Base de datos activa: ${dbInfo[0].current_db}`);
    } catch (error) {
      console.log('❌ Error verificando base de datos:', error.message);
    }

    // 3. Listar todas las tablas
    try {
      const dbName = process.env.DB_NAME || 'restaurant_music_db';
      const { rows: tables } = await executeQuery('SHOW TABLES');
      
      if (tables.length === 0) {
        console.log('⚠️ No se encontraron tablas en la base de datos');
        console.log('💡 Necesitas ejecutar el script de creación de tablas primero');
      } else {
        console.log(`✅ Se encontraron ${tables.length} tablas:`);
        tables.forEach(table => {
          const tableName = table[`Tables_in_${dbName}`];
          console.log(`   📋 ${tableName}`);
        });
      }
    } catch (error) {
      console.log('❌ Error listando tablas:', error.message);
    }

    console.log();

    // 4. Verificar tabla restaurants específicamente
    console.log('3. 🏪 Verificando tabla restaurants...');
    try {
      // Primero verificar si la tabla existe
      const { rows: tableExists } = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'restaurants'",
        [process.env.DB_NAME || 'restaurant_music_db']
      );

      if (tableExists[0].count === 0) {
        console.log('❌ La tabla restaurants no existe');
        console.log('💡 Necesitas crear la tabla restaurants primero');
      } else {
        // Verificar estructura
        const { rows: columns } = await executeQuery('DESCRIBE restaurants');
        console.log('✅ Estructura de la tabla restaurants:');
        columns.forEach(col => {
          console.log(`   📋 ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : '(NULL)'} ${col.Key ? `(${col.Key})` : ''}`);
        });

        // Contar registros
        const { rows: countResult } = await executeQuery('SELECT COUNT(*) as total FROM restaurants');
        const total = countResult[0].total;
        console.log(`📊 Total de restaurantes: ${total}`);

        if (total > 0) {
          const { rows: sampleRestaurants } = await executeQuery('SELECT id, name, slug FROM restaurants LIMIT 3');
          console.log('🏪 Restaurantes de ejemplo:');
          sampleRestaurants.forEach(r => {
            console.log(`   - ID: ${r.id}, Nombre: "${r.name}", Slug: "${r.slug}"`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Error verificando tabla restaurants:', error.message);
    }

    console.log();

    // 5. Verificar tabla songs
    console.log('4. 🎵 Verificando tabla songs...');
    try {
      const { rows: tableExists } = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'songs'",
        [process.env.DB_NAME || 'restaurant_music_db']
      );

      if (tableExists[0].count === 0) {
        console.log('❌ La tabla songs no existe');
        console.log('💡 Necesitas crear la tabla songs primero');
      } else {
        const { rows: countResult } = await executeQuery('SELECT COUNT(*) as total FROM songs');
        const total = countResult[0].total;
        console.log(`📊 Total de canciones: ${total}`);

        if (total > 0) {
          const { rows: sampleSongs } = await executeQuery(`
            SELECT s.id, s.title, s.artist, r.name as restaurant_name 
            FROM songs s 
            LEFT JOIN restaurants r ON s.restaurant_id = r.id 
            LIMIT 3
          `);
          console.log('🎵 Canciones de ejemplo:');
          sampleSongs.forEach(s => {
            console.log(`   - "${s.title}" por ${s.artist} (${s.restaurant_name || 'Sin restaurante'})`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Error verificando tabla songs:', error.message);
    }

    console.log();

    // 6. Probar la consulta específica que estaba fallando
    console.log('5. 🎯 Probando consulta específica (slug: la-terraza-musical)...');
    try {
      const { rows: restaurant } = await executeQuery(
        'SELECT id, name FROM restaurants WHERE slug = ?',
        ['la-terraza-musical']
      );

      if (restaurant.length === 0) {
        console.log('⚠️ No se encontró restaurante con slug "la-terraza-musical"');
        
        // Mostrar slugs disponibles
        const { rows: allRestaurants } = await executeQuery('SELECT slug, name FROM restaurants LIMIT 5');
        if (allRestaurants.length > 0) {
          console.log('🏪 Slugs disponibles:');
          allRestaurants.forEach(r => console.log(`   - "${r.slug}" (${r.name})`));
        } else {
          console.log('💡 No hay restaurantes en la base de datos');
        }
      } else {
        const rest = restaurant[0];
        console.log(`✅ Restaurante encontrado: "${rest.name}" (ID: ${rest.id})`);
        
        // Probar consulta de canciones
        const { rows: songs } = await executeQuery(`
          SELECT COUNT(*) as total FROM songs WHERE restaurant_id = ?
        `, [rest.id]);
        
        console.log(`🎵 Canciones disponibles para este restaurante: ${songs[0].total}`);
      }
    } catch (error) {
      console.log('❌ Error en consulta específica:', error.message);
    }

    console.log('\n✅ Diagnóstico completo');

  } catch (error) {
    console.log('❌ Error durante las pruebas:', error.message);
    console.log('Stack trace:', error.stack);
  } finally {
    // Cerrar conexión
    console.log('\n🔌 Cerrando conexiones...');
    await closeConnection();
    console.log('✅ Prueba completada');
    process.exit(0);
  }
};

// Ejecutar la prueba
testDatabase().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error);
  process.exit(1);
});