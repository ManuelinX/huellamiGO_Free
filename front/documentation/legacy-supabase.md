# Legacy Supabase

El frontend actual ya no usa Supabase.

## Estado actual

Auth:

- `components/auth-button.js`
- `components/auth-provider.js`
- `lib/auth.js`
- `lib/auth-session.js`

API:

- `lib/api.js`

Uploads:

- `lib/reports.js`
- Backend `/api/uploads/pet-photo`

Perfil y notificaciones:

- `lib/profile.js`
- `lib/notifications.js`
- Backend `/api/profile`
- Backend `/api/notifications`
- Service Worker local `public/huellamigo-sw.js` para Web Push.

## Variables obsoletas

No son necesarias para el frontend actual:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEFAULT_PROFILE_ID=
```

## Dependencia obsoleta

`@supabase/supabase-js` fue usada en la etapa anterior para Auth y Storage. No debe volver a agregarse salvo que se decida explicitamente reintroducir Supabase como proveedor externo.

## Flujo anterior

Antes:

- Supabase Auth manejaba registro/login/sesion.
- Supabase Storage recibia fotos desde el navegador.

Ahora:

- El backend maneja registro/login/JWT.
- El backend recibe uploads y guarda archivos en `/uploads`.
- El backend maneja verificacion de correo, recuperacion de contrasena, perfil, notificaciones y suscripciones Web Push.
