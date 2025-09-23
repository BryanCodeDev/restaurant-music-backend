// test-endpoints.js - Script para probar todos los endpoints implementados
const axios = require('axios');

// Configuración base
const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = null;

// Función para hacer requests
async function makeRequest(method, endpoint, data = null, useAuth = false) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (useAuth && authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log(`✅ ${method.toUpperCase()} ${endpoint} - Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.log(`❌ ${method.toUpperCase()} ${endpoint} - Error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.log('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Función para probar autenticación
async function testAuth() {
  console.log('\n🔐 === PRUEBAS DE AUTENTICACIÓN ===');

  // Login de restaurante
  const loginData = await makeRequest('POST', '/auth/login-restaurant', {
    email: 'admin@laterraza.com',
    password: 'admin123'
  });

  if (loginData?.success && loginData.data?.access_token) {
    authToken = loginData.data.access_token;
    console.log('✅ Login exitoso, token obtenido');
  } else {
    console.log('❌ Login fallido, usando token de prueba');
    authToken = 'test-token';
  }
}

// Función para probar restaurantes
async function testRestaurants() {
  console.log('\n🏪 === PRUEBAS DE RESTAURANTES ===');

  // Obtener restaurantes públicos
  await makeRequest('GET', '/restaurants');

  // Obtener restaurante específico
  await makeRequest('GET', '/restaurants/la-terraza-musical');

  // Obtener estadísticas del restaurante
  await makeRequest('GET', '/restaurants/la-terraza-musical/stats');
}

// Función para probar suscripciones
async function testSubscriptions() {
  console.log('\n💳 === PRUEBAS DE SUSCRIPCIONES ===');

  // Obtener planes disponibles
  await makeRequest('GET', '/subscription/plans');

  // Obtener plan específico
  await makeRequest('GET', '/subscription/plans/starter');
}

// Función para probar pagos
async function testPayments() {
  console.log('\n💰 === PRUEBAS DE PAGOS ===');

  // Obtener métodos de pago
  await makeRequest('GET', '/payments/methods', null, true);

  // Generar QR de pago
  await makeRequest('POST', '/payments/generate-qr', {
    amount: 79000,
    planId: 'professional'
  }, true);
}

// Función para probar estadísticas
async function testStats() {
  console.log('\n📊 === PRUEBAS DE ESTADÍSTICAS ===');

  // Dashboard (requiere superadmin)
  await makeRequest('GET', '/stats/dashboard', null, true);

  // Estadísticas de usuario
  await makeRequest('GET', '/stats/user/test-user-id', null, true);

  // Estadísticas de restaurante
  await makeRequest('GET', '/stats/restaurant/rest-001', null, true);
}

// Función para probar administración
async function testAdmin() {
  console.log('\n👑 === PRUEBAS DE ADMINISTRACIÓN ===');

  // Obtener estadísticas globales
  await makeRequest('GET', '/admin/global-stats', null, true);

  // Obtener suscripciones (admin)
  await makeRequest('GET', '/admin/subscriptions?status=pending', null, true);
}

// Función principal
async function runTests() {
  console.log('🚀 Iniciando pruebas de endpoints de la API Restaurant Music');
  console.log('=' .repeat(60));

  try {
    // Probar autenticación primero
    await testAuth();

    // Probar endpoints públicos
    await testRestaurants();
    await testSubscriptions();

    // Probar endpoints autenticados
    await testPayments();
    await testStats();
    await testAdmin();

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Pruebas completadas');
    console.log('📝 Nota: Algunos endpoints pueden fallar si no hay datos en la BD');
    console.log('💡 Asegúrate de que el servidor esté ejecutándose en puerto 3000');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  runTests();
}

module.exports = { runTests, makeRequest };