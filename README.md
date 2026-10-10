<p align="center">
  <img src="./front/assets/branding/logo.png" alt="HuellamiGO" width="180" />
</p>

<h1 align="center">HuellamiGO</h1>

<p align="center">
  Plataforma web y móvil para reportar mascotas perdidas, registrar avistamientos y organizar búsquedas colaborativas.
</p>

## Descripción

HuellamiGO busca conectar a personas que perdieron una mascota con miembros de su comunidad que puedan aportar avistamientos e información útil. Este monorepo reúne la experiencia web, la API y la aplicación móvil en un solo lugar.

El proyecto permite crear y administrar reportes, visualizar mascotas y avistamientos en mapas, registrar pistas de búsqueda y recibir notificaciones relacionadas con actividad cercana.

## Componentes

| Componente | Tecnologías principales | Responsabilidad |
| --- | --- | --- |
| [`front/`](./front/) | Next.js, React, Leaflet | Aplicación web, mapas y flujos de usuario |
| [`back/`](./back/) | Node.js, Express, PostgreSQL, PostGIS | API, autenticación, reportes, archivos y notificaciones |
| [`mobile/`](./mobile/) | Flutter, Dart, Firebase Messaging | Aplicación móvil para Android, iOS y otras plataformas Flutter |

## Funcionalidades

- Registro, inicio de sesión y perfiles de usuario.
- Publicación y administración de reportes de mascotas.
- Registro de avistamientos y evidencia fotográfica.
- Mapas interactivos para reportes, pistas y zonas revisadas.
- Historial de actividad y rutas de búsqueda.
- Alertas de actividad cercana.
- Preferencias y entrega de notificaciones.
- Notificaciones web y push móvil.
- Herramientas de acceso controlado para pruebas beta.

## Arquitectura

```text
┌──────────────────┐       ┌──────────────────┐
│  Web / Next.js   │──────▶│                  │
└──────────────────┘       │                  │       ┌─────────────────────┐
                           │ API Node/Express │──────▶│ PostgreSQL/PostGIS  │
┌──────────────────┐       │                  │       └─────────────────────┘
│ Mobile / Flutter │──────▶│                  │
└──────────────────┘       └────────┬─────────┘
                                    │
                                    ├── Email y Web Push
                                    └── Firebase Cloud Messaging
```

El frontend y la aplicación móvil consumen la misma API. La API concentra las reglas de negocio y el acceso a PostgreSQL/PostGIS, además de integrar los canales de notificación.

## Estado de la demo

El código fuente completo puede revisarse en este repositorio. GitHub aloja el código, pero no ejecuta automáticamente el frontend, el backend ni la base de datos.

Para ofrecer una demostración pública funcional es necesario desplegar:

1. El backend y una base PostgreSQL con PostGIS.
2. El frontend configurado con la URL pública del backend.
3. Opcionalmente, los servicios de correo, Web Push y Firebase.

**Demo web:** pendiente de publicación.

## Ejecución local

### Requisitos

- Node.js en una versión LTS compatible.
- PostgreSQL con la extensión PostGIS.
- Flutter SDK para ejecutar la aplicación móvil.

### 1. Backend

```bash
cd back
npm ci
```

Crea `back/.env` con las variables requeridas para tu entorno. Como mínimo, la aplicación necesita configurar la conexión a la base de datos y un secreto JWT:

```env
PORT=4000
DATABASE_URL=postgresql://USUARIO:CONTRASENA@localhost:5432/BASE_DE_DATOS
JWT_SECRET=REEMPLAZAR_CON_UN_VALOR_SEGURO
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

Los scripts de una base nueva están en [`back/sql/current/`](./back/sql/current/) y deben ejecutarse en orden numérico.

Inicia la API:

```bash
npm run dev
```

Las integraciones de correo, mapas, Web Push y Firebase usan variables adicionales documentadas dentro del backend y son opcionales para una instalación básica.

### 2. Frontend

```bash
cd front
npm ci
```

Crea `front/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Después inicia el servidor de desarrollo:

```bash
npm run dev
```

La aplicación web estará disponible normalmente en `http://localhost:3000`.

### 3. Aplicación móvil

```bash
cd mobile/app
flutter pub get
flutter run --dart-define=HUELLAMIGO_API_URL=http://10.0.2.2:4000
```

En el emulador de Android, `10.0.2.2` apunta al equipo anfitrión. En un dispositivo físico se debe utilizar una URL alcanzable desde el dispositivo.

Las funciones de Firebase requieren un archivo local `google-services.json`. Este archivo está excluido del repositorio deliberadamente y debe obtenerse desde el proyecto Firebase correspondiente.

## Variables y secretos

Los siguientes tipos de archivo están excluidos mediante [`.gitignore`](./.gitignore):

- Archivos `.env` y configuraciones locales.
- Llaves privadas, certificados y keystores.
- Configuración local de Firebase.
- Dependencias, builds y cachés.
- Logs, uploads y respaldos.
- Configuración personal del editor.

Nunca deben publicarse valores reales de contraseñas, tokens, llaves privadas o cuentas de servicio. Para documentar nuevas variables se deben utilizar valores ficticios o archivos `.env.example`.

## Estructura resumida

```text
huellamiGO_Free/
├── back/                  # API y scripts SQL
├── front/                 # Aplicación web
├── mobile/
│   └── app/               # Proyecto Flutter
├── .gitignore
└── README.md
```

## Documentación adicional

- [Frontend](./front/README.md)
- [Backend](./back/README.md)
- [Aplicación móvil](./mobile/README.md)

## Autor

Desarrollado por [ManuelinX](https://github.com/ManuelinX).

## Licencia

La licencia de distribución y reutilización todavía no ha sido definida.
