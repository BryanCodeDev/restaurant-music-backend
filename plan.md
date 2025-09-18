# Plan de Implementación Backend para Flujo User/Restaurant/Superadmin

## Resumen
Este plan detalla los cambios necesarios en el backend (Node.js/Express/MySQL) para soportar el flujo de roles: user, restaurant y superadmin. Se basa en los archivos existentes y el esquema de BD (script2.sql) que ya incluye el campo `role ENUM('user', 'superadmin')` en `registered_users`. Los cambios se aplicarán paso a paso usando `apply_diff` para ediciones precisas, asegurando compatibilidad con el frontend (redirecciones por role/type, perfiles editables, paneles superadmin).

## Diagrama de Flujo de Autenticación con Roles (Mermaid)
```mermaid
sequenceDiagram
    participant U as Usuario (Frontend)
    participant A as API (Backend)
    participant M as Middleware (auth.js)
    participant C as Controller (authController.js)
    participant BD as Base de Datos
    participant D as Dashboard (Frontend)

    U->>A: POST /auth/login-user {email, password}
    A->>C: loginUser()
    C->>BD: SELECT id, name, email, password, role FROM registered_users WHERE email = ?
    BD-->>C: Datos + role
    Note over C: Verificar password
    C->>C: Generar token con payload: {userId, email, userType: 'registered_user', role?}
    C-->>A: {success: true, data: {user: {..., role}, access_token}}
    A-->>U: Response con role en user

    U->>A: GET /profile (con token)
    A->>M: authenticateToken
    M->>BD: SELECT id, name, email, role FROM registered_users WHERE id = ?
    BD-->>M: Datos + role
    M->>M: req.user = {..., type: 'registered_user', role}
    M-->>A: next()
    A->>C: getProfile()
    C->>BD: SELECT ... , role FROM registered_users WHERE id = ?
    BD-->>C: Datos completos
    C-->>A: {success: true, data: {user: {..., role}}}
    A-->>U: Profile con role

    alt Role = 'superadmin'
        U->>A: GET /admin/pending-restaurants (con token)
        A->>M: authenticateToken + requireSuperAdmin
        M->>M: Verificar req.user.type === 'registered_user' && role === 'superadmin'
        M-->>A: next() si OK, sino 403
        A->>C: getPendingRestaurants()
        C-->>A: Lista de restaurants pendientes
        A-->>U: Success
    else Role = 'user'
        U->>A: GET /admin/pending-restaurants (con token)
        M->>M: requireSuperAdmin falla
        A-->>U: 403 Forbidden
    end

    U->>D: Redirigir basado en role/type (user: selector; superadmin: panel admin)
```

## Lista de Tareas Detallada
La lista de todos se encuentra en el sistema de tracking. Cada paso es accionable en modo Code, con diffs específicos para evitar errores. Prioridad: BD > Models > Middleware > Controllers > Validation > Routes > Testing.

## Consideraciones
- **Seguridad**: Role solo se incluye en token si es 'superadmin' para minimizar exposición. Usar `requireSuperAdmin` en todas las rutas admin.
- **Compatibilidad**: Cambios no rompen flujos existentes (restaurant/user sin role). Frontend espera `role` en getProfile y login response.
- **Testing**: Usar ejemplos de BD: 'super@admin.com' (role='superadmin', password hasheada), 'maria@demo.com' (role='user').
- **Errores**: Manejar 401/403 con mensajes claros. Logs en logger.js.

Si necesitas ajustes en el plan o el diagrama, avísame.