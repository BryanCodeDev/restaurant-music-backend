# Restaurant Music Backend API

API backend para el sistema de peticiones musicales en restaurantes desarrollado por MasterCode Company.

## Características

- **Autenticación JWT** para restaurantes
- **Sesiones temporales** para usuarios (mesas)
- **Sistema de cola** para peticiones musicales
- **Generación automática de QR** para cada restaurante
- **Base de datos MySQL** optimizada
- **Rate limiting** y seguridad
- **Validación completa** de datos
- **Logging estructurado**

## Tecnologías

- Node.js 18+
- Express.js
- MySQL 8.0+
- JWT Authentication
- bcryptjs para encriptación
- QRCode generation
- Express-validator

## Instalación

### 1. Configurar base de datos

```sql
-- Crear base de datos
CREATE DATABASE restaurant_music_db;

-- Importar schema
mysql -u root -p restaurant_music_db < database_schema.sql
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=restaurant_music_db

# JWT
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui

# Server
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### 4. Iniciar servidor

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## Estructura del Proyecto

```
src/
├── app.js              # Configuración Express
├── server.js           # Servidor principal
├── config/
│   └── database.js     # Configuración MySQL
├── controllers/        # Lógica de negocio
├── middleware/         # Middlewares personalizados
├── models/            # Modelos de datos
├── routes/            # Definición de rutas
├── services/          # Servicios (QR, email, etc.)
└── utils/             # Utilidades y helpers
```

## API Endpoints

### Autenticación

```
POST /api/v1/auth/register          # Registro de restaurante
POST /api/v1/auth/login            # Login de restaurante
POST /api/v1/auth/session/:slug    # Crear sesión de usuario
GET  /api/v1/auth/profile          # Obtener perfil
PUT  /api/v1/auth/profile          # Actualizar perfil
GET  /api/v1/auth/verify           # Verificar token
```

### Canciones

```
GET /api/v1/songs/:restaurantSlug              # Listar canciones
GET /api/v1/songs/:restaurantSlug/search       # Buscar canciones
GET /api/v1/songs/:restaurantSlug/popular      # Canciones populares
GET /api/v1/songs/:restaurantSlug/genres       # Géneros disponibles
GET /api/v1/songs/:restaurantSlug/genre/:genre # Canciones por género
GET /api/v1/songs/:restaurantSlug/song/:id     # Detalles de canción
```

### Peticiones

```
POST   /api/v1/requests/:restaurantSlug         # Crear petición
GET    /api/v1/requests/:restaurantSlug/user    # Peticiones de usuario
GET    /api/v1/requests/:restaurantSlug/queue   # Cola del restaurante [AUTH]
DELETE /api/v1/requests/:requestId              # Cancelar petición
PATCH  /api/v1/requests/:requestId/status       # Actualizar estado [AUTH]
GET    /api/v1/requests/:restaurantSlug/stats   # Estadísticas
```

### Ejemplo de Uso

#### 1. Registrar Restaurante

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Restaurante",
    "email": "admin@mirestaurante.com",
    "password": "MiPassword123",
    "phone": "+573001234567",
    "city": "Bogotá"
  }'
```

#### 2. Crear Sesión de Usuario

```bash
curl -X POST http://localhost:5000/api/v1/auth/session/mi-restaurante \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": "Mesa #5"
  }'
```

#### 3. Crear Petición Musical

```bash
curl -X POST http://localhost:5000/api/v1/requests/mi-restaurante \
  -H "Content-Type: application/json" \
  -d '{
    "songId": "song-001",
    "tableNumber": "Mesa #5"
  }'
```

## Configuración de Producción

### Variables de Entorno

```env
NODE_ENV=production
PORT=5000
DB_HOST=tu_host_mysql
DB_USER=tu_usuario
DB_PASSWORD=tu_password_seguro
JWT_SECRET=tu_jwt_super_secreto_de_64_caracteres_minimo
FRONTEND_URL=https://tu-frontend.com
```

### PM2 (Recomendado)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start src/server.js --name "restaurant-music-api"

# Ver logs
pm2 logs restaurant-music-api

# Reiniciar
pm2 restart restaurant-music-api
```

## Limpieza de Datos

El sistema incluye scripts automáticos para limpiar:

- Usuarios temporales mayores a 7 días
- Peticiones completadas mayores a 30 días
- Actualizacion automática de posiciones en cola

## Monitoreo y Logs

Los logs se guardan en `logs/app.log` y incluyen:

- Requests HTTP
- Errores del sistema
- Operaciones de base de datos
- Autenticación y autorización

## Seguridad

- Validación completa de inputs
- Rate limiting (100 requests/15min)
- Headers de seguridad (Helmet)
- Sanitización de datos
- JWT con expiración
- Passwords hasheados con bcrypt

## Soporte

Para soporte técnico contactar:
- Email: mastercodecompany@gmail.com
- WhatsApp: +57 321 220 9943

---

**MasterCode Company** - Transformamos ideas en realidades digitales